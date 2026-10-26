// backend/src/workers/bookingPoller.js
// ✅ FCM alert to admin on every NEW booking (change stream)
// ✅ Change stream for real-time dispatch
// ✅ Safety net for stuck bookings > 30 min
// ✅ No duplicate handlers

const { getBookingModel } = require('../config/database');
const { dispatchBooking, isInCooldown } = require('../services/dispatchService');

let changeStream = null;
let safetyNetInterval = null;
const inFlight = new Set();
const notifiedBookings = new Set(); // Dedupe admin alerts

const SAFETY_NET_STUCK_MIN = parseInt(process.env.DISPATCH_SAFETY_NET_STUCK_MIN || '30', 10);
const SAFETY_NET_INTERVAL_MS = parseInt(process.env.DISPATCH_SAFETY_NET_INTERVAL_MS || '120000', 10);

/* ─── Helper: safely load admin alert service ─── */
let adminAlertService = null;
try {
  adminAlertService = require('../services/adminAlertService');
} catch (e) {
  console.warn('[Poller] ⚠️ adminAlertService not available:', e.message);
}

/* ─── Helper: safely load socket emitter ─── */
let socketEmitter = null;
try {
  socketEmitter = require('../socket/socketServer');
} catch (_) {
  try {
    socketEmitter = require('../config/socket');
  } catch (_) { /* ignore */ }
}

function emitToAdmins(event, payload) {
  try {
    if (!socketEmitter) return;
    if (typeof socketEmitter.emitToAdmins === 'function') {
      socketEmitter.emitToAdmins(event, payload);
    } else if (typeof socketEmitter.emitLive === 'function') {
      socketEmitter.emitLive(event, payload);
    } else if (typeof socketEmitter.io === 'object' && socketEmitter.io?.emit) {
      socketEmitter.io.emit(event, payload);
    } else if (typeof socketEmitter.getIO === 'function') {
      socketEmitter.getIO().emit(event, payload);
    }
  } catch (e) {
    console.warn('[Poller] socket emit failed:', e.message);
  }
}

/* ─── Alert admins when a new booking arrives ─── */
async function notifyAdminsOfNewBooking(booking) {
  const bid = booking.bookingId || String(booking._id);
  if (notifiedBookings.has(bid)) return;
  notifiedBookings.add(bid);
  // Clean dedupe set after 1 hour
  setTimeout(() => notifiedBookings.delete(bid), 60 * 60 * 1000);

  const payload = {
    bookingId: bid,
    customerName: booking.customerName,
    serviceName: booking.serviceName,
    categoryName: booking.categoryName,
    cityName: booking.city?.cityName || booking.cityName,
    bookingType: booking.bookingType,
    status: booking.status,
    createdAt: booking.createdAt,
  };

  // 1. Emit Socket.IO event to all connected admins
  emitToAdmins('new:booking', payload);
  emitToAdmins('new_booking', payload);

  // 2. Create persistent admin alert + send FCM push
  try {
    if (adminAlertService) {
      if (typeof adminAlertService.createAdminAlert === 'function') {
        await adminAlertService.createAdminAlert({
          type: 'new_booking',
          title: '🆕 New Booking Received',
          message: `${bid} · ${booking.serviceName || 'Service'} · ${booking.customerName || 'Customer'}`,
          bookingId: bid,
          priority: 'high',
          data: payload,
        });
      } else if (typeof adminAlertService.notifyNewBooking === 'function') {
        await adminAlertService.notifyNewBooking(booking);
      }
    }
  } catch (e) {
    console.warn('[Poller] Admin alert failed:', e.message);
  }

  console.log(`[Poller] 🔔 Admin alerted: ${bid}`);
}

/* ─── Safe dispatch (dedupe + cooldown) ─── */
async function safeDispatch(bookingId, reason) {
  if (inFlight.has(bookingId)) {
    console.log(`[Poller] ${bookingId} already in flight (${reason})`);
    return;
  }
  if (typeof isInCooldown === 'function' && isInCooldown(bookingId)) {
    console.log(`[Poller] ${bookingId} in cooldown, skip (${reason})`);
    return;
  }

  inFlight.add(bookingId);
  try {
    console.log(`[Poller] 🚀 Triggering dispatch for ${bookingId} (${reason})`);
    await dispatchBooking(bookingId, { reason });
  } catch (e) {
    console.error(`[Poller] Dispatch error for ${bookingId}:`, e.message);
  } finally {
    setTimeout(() => inFlight.delete(bookingId), 5000);
  }
}

/* ─── Change stream (real-time trigger) ─── */
async function startChangeStream() {
  const Booking = getBookingModel();

  try {
    changeStream = Booking.watch(
      [
        {
          $match: {
            $or: [
              { operationType: 'insert' },
              {
                operationType: 'update',
                'updateDescription.updatedFields.status': { $exists: true },
              },
            ],
          },
        },
      ],
      { fullDocument: 'updateLookup' }
    );

    changeStream.on('change', async (change) => {
      const doc = change.fullDocument;
      if (!doc) return;

      const status = doc.status;
      const bookingId = doc.bookingId || String(doc._id);

      // 🔔 On INSERT: always alert admins (regardless of status)
      if (change.operationType === 'insert') {
        await notifyAdminsOfNewBooking(doc);
      }

      // 🚀 On confirmed + no provider: trigger dispatch
      if (status === 'confirmed' && !doc.providerId) {
        if (doc.bookingType === 'instant' || !doc.scheduledDateTime) {
          await safeDispatch(bookingId, 'change_stream:confirmed_instant');
        } else if (doc.scheduledDateTime) {
          const now = new Date();
          const schedTime = new Date(doc.scheduledDateTime);
          const diffMs = schedTime - now;
          if (diffMs <= 2 * 60 * 60 * 1000 && diffMs > -5 * 60 * 1000) {
            await safeDispatch(bookingId, 'change_stream:scheduled_near');
          }
        }
      }

      // 📡 Emit status updates to admins
      if (change.operationType === 'update') {
        emitToAdmins('booking:updated', {
          bookingId,
          status,
          providerId: doc.providerId,
        });
      }
    });

    changeStream.on('error', (err) => {
      console.error('[Poller] Change stream error:', err.message);
      setTimeout(() => {
        try { changeStream.close(); } catch (_) {}
        startChangeStream();
      }, 5000);
    });

    console.log('[Poller] ✅ Change stream started');
  } catch (e) {
    console.error('[Poller] Failed to start change stream:', e.message);
  }
}

/* ─── Safety net for stuck bookings ─── */
async function runSafetyNet() {
  try {
    const Booking = getBookingModel();
    const cutoff = new Date(Date.now() - SAFETY_NET_STUCK_MIN * 60 * 1000);

    const stuck = await Booking.find({
      status: { $in: ['confirmed', 'no_provider_found'] },
      providerId: { $in: [null, undefined] },
      isDeleted: { $ne: true },
      updatedAt: { $lt: cutoff },
    })
      .sort({ updatedAt: 1 })
      .limit(5)
      .lean();

    if (stuck.length === 0) return;

    console.log(`[Poller] 🩺 Safety net: ${stuck.length} stuck bookings`);
    for (const b of stuck) {
      await safeDispatch(b.bookingId, `safety_net:stuck_${SAFETY_NET_STUCK_MIN}min`);
    }
  } catch (e) {
    console.error('[Poller] Safety net error:', e.message);
  }
}

/* ─── Start / Stop ─── */
async function startBookingPoller() {
  console.log('[Poller] Starting booking poller...');
  await startChangeStream();
  safetyNetInterval = setInterval(runSafetyNet, SAFETY_NET_INTERVAL_MS);
  console.log(`[Poller] ✅ Safety net every ${SAFETY_NET_INTERVAL_MS / 1000}s, stuck > ${SAFETY_NET_STUCK_MIN}min`);
}

async function stopBookingPoller() {
  if (changeStream) {
    try { await changeStream.close(); } catch (_) {}
    changeStream = null;
  }
  if (safetyNetInterval) {
    clearInterval(safetyNetInterval);
    safetyNetInterval = null;
  }
  console.log('[Poller] Stopped');
}

// Backward-compat aliases
const startPoller = startBookingPoller;
const stopPoller = stopBookingPoller;
const startWatcher = startBookingPoller;
const stopWatcher = stopBookingPoller;

module.exports = {
  startBookingPoller,
  stopBookingPoller,
  startPoller,
  stopPoller,
  startWatcher,
  stopWatcher,
};