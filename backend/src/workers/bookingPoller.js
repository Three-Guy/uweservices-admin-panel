// backend/src/workers/bookingPoller.js
// ✅ FIXED: Only change stream + safety net for >30 min stuck bookings
// ✅ No duplicate handlers

const { getBookingModel } = require('../config/database');
const { dispatchBooking, isInCooldown } = require('../services/dispatchService');

let changeStream = null;
let safetyNetInterval = null;
const inFlight = new Set();

const SAFETY_NET_STUCK_MIN = parseInt(process.env.DISPATCH_SAFETY_NET_STUCK_MIN || '30', 10);
const SAFETY_NET_INTERVAL_MS = parseInt(process.env.DISPATCH_SAFETY_NET_INTERVAL_MS || '120000', 10); // 2 min

async function safeDispatch(bookingId, reason) {
  if (inFlight.has(bookingId)) {
    console.log(`[Poller] ${bookingId} already in flight (${reason})`);
    return;
  }
  if (isInCooldown(bookingId)) {
    console.log(`[Poller] ${bookingId} in cooldown, skip (${reason})`);
    return;
  }

  inFlight.add(bookingId);
  try {
    console.log(`[Poller] 🚀 Triggering dispatch for ${bookingId} (${reason})`);
    await dispatchBooking(bookingId);
  } catch (e) {
    console.error(`[Poller] Dispatch error for ${bookingId}:`, e.message);
  } finally {
    setTimeout(() => inFlight.delete(bookingId), 5000);
  }
}

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

      // Only trigger for 'confirmed' status with no provider assigned
      if (status === 'confirmed' && !doc.providerId) {
        // Instant bookings go NOW. Scheduled go only within 2 hrs of scheduled time.
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
    });

    changeStream.on('error', (err) => {
      console.error('[Poller] Change stream error:', err.message);
      // Restart after 5s
      setTimeout(() => {
        try { changeStream.close(); } catch (e) {}
        startChangeStream();
      }, 5000);
    });

    console.log('[Poller] ✅ Change stream started');
  } catch (e) {
    console.error('[Poller] Failed to start change stream:', e.message);
  }
}

// Safety net: Pick stuck bookings (>30 min in confirmed/searching/no_provider_found) and retry
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

async function startBookingPoller() {
  console.log('[Poller] Starting booking poller...');
  await startChangeStream();
  safetyNetInterval = setInterval(runSafetyNet, SAFETY_NET_INTERVAL_MS);
  console.log(`[Poller] ✅ Safety net every ${SAFETY_NET_INTERVAL_MS / 1000}s, stuck > ${SAFETY_NET_STUCK_MIN}min`);
}

async function stopBookingPoller() {
  if (changeStream) {
    try { await changeStream.close(); } catch (e) {}
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