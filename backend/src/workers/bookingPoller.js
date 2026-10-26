// src/workers/bookingPoller.js
const logger = require('../utils/logger');

let changeStream = null;
let isRunning = false;
let pollInterval = null;
let lastPolledAt = null;

// Track which booking IDs we've already notified (prevent duplicates)
const notifiedBookingIds = new Set();
const MAX_TRACKED = 500;

function trackBookingId(id) {
  const idStr = String(id);
  if (notifiedBookingIds.has(idStr)) return false;
  notifiedBookingIds.add(idStr);
  if (notifiedBookingIds.size > MAX_TRACKED) {
    const first = notifiedBookingIds.values().next().value;
    notifiedBookingIds.delete(first);
  }
  return true;
}

async function notifyAdminsOfNewBooking(booking) {
  try {
    const bookingId = String(booking._id);

    // Skip if already notified
    if (!trackBookingId(bookingId)) {
      return;
    }

    console.log(`\n🔔🔔🔔 [BookingPoller] NEW BOOKING DETECTED: ${bookingId} 🔔🔔🔔`);
    console.log(`   Service: ${booking.serviceName || booking.service || 'unknown'}`);
    console.log(`   Status: ${booking.status}`);
    console.log(`   Customer: ${booking.customerName || booking.customerId || 'unknown'}`);

    const payload = {
      _id: bookingId,
      id: bookingId,
      type: 'new_booking',
      title: '🆕 New Booking Received',
      message: `New booking for ${booking.serviceName || booking.service || 'service'} from ${booking.customerName || 'customer'}`,
      bookingId: bookingId,
      serviceName: booking.serviceName || booking.service || '',
      customerName: booking.customerName || '',
      status: booking.status || 'pending',
      amount: booking.totalAmount || booking.amount || 0,
      timestamp: new Date().toISOString(),
      createdAt: booking.createdAt || new Date().toISOString(),
    };

    // ── METHOD 1: Emit via liveEmitter ──
    try {
      const liveEmitter = require('../services/liveEmitter');
      if (typeof liveEmitter.emitLive === 'function') {
        const result = liveEmitter.emitLive('admin:notification', payload, 'admins');
        console.log(`✅ [BookingPoller] liveEmitter.emitLive result: ${result}`);
      } else {
        console.warn('⚠️ [BookingPoller] liveEmitter.emitLive is not a function');
      }

      if (typeof liveEmitter.emitToAdmins === 'function') {
        liveEmitter.emitToAdmins('new_booking', payload);
        liveEmitter.emitToAdmins('new:booking', payload);
        liveEmitter.emitToAdmins('booking:created', payload);
        console.log(`✅ [BookingPoller] emitToAdmins called`);
      }
    } catch (e) {
      console.error('❌ [BookingPoller] liveEmitter error:', e.message);
    }

    // ── METHOD 2: Emit via adminAlertService ──
    try {
      const adminAlertService = require('../services/adminAlertService');
      if (typeof adminAlertService.createAdminAlert === 'function') {
        await adminAlertService.createAdminAlert({
          type: 'new_booking',
          title: payload.title,
          message: payload.message,
          bookingId: bookingId,
          severity: 'info',
          data: payload,
        });
        console.log(`✅ [BookingPoller] adminAlertService.createAdminAlert called`);
      }
    } catch (e) {
      console.error('❌ [BookingPoller] adminAlertService error:', e.message);
    }

    // ── METHOD 3: Direct io emit (ultimate fallback) ──
    try {
      const liveEmitter = require('../services/liveEmitter');
      const io = liveEmitter.getIo ? liveEmitter.getIo() : null;
      if (io) {
        io.to('admins').emit('admin:notification', payload);
        io.emit('admin:notification', payload);
        console.log(`✅ [BookingPoller] Direct io.emit to 'admins' room + global`);

        // Log room info
        try {
          const adminRoom = io.sockets.adapter.rooms.get('admins');
          const count = adminRoom ? adminRoom.size : 0;
          console.log(`👥 [BookingPoller] Sockets in 'admins' room: ${count}`);
        } catch (e) {}
      } else {
        console.error('❌ [BookingPoller] io is NULL — cannot emit directly');
      }
    } catch (e) {
      console.error('❌ [BookingPoller] Direct io emit error:', e.message);
    }

    console.log(`✅ [BookingPoller] Notification complete for booking ${bookingId}\n`);
  } catch (err) {
    console.error('❌ [BookingPoller] notifyAdminsOfNewBooking error:', err.message);
    console.error(err.stack);
  }
}

// ============================================================
// POLLING FALLBACK — works even if change streams fail
// Checks for new bookings every 15 seconds
// ============================================================
async function pollForNewBookings() {
  try {
    const Booking = require('../models/Booking');

    // Determine time window
    const now = new Date();
    const since = lastPolledAt
      ? new Date(lastPolledAt.getTime() - 5000) // 5s overlap to avoid missing any
      : new Date(now.getTime() - 60000); // First poll: look back 60s

    lastPolledAt = now;

    // Query for recently created bookings
    const newBookings = await Booking.find({
      createdAt: { $gte: since, $lte: now },
    })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    if (newBookings.length > 0) {
      console.log(`\n🔍 [Polling] Found ${newBookings.length} new booking(s) since ${since.toISOString()}`);
      for (const booking of newBookings) {
        await notifyAdminsOfNewBooking(booking);
      }
    }
  } catch (err) {
    // Don't log every 15s if model doesn't exist — only log once
    if (!pollForNewBookings._loggedError) {
      console.error('❌ [Polling] Error polling bookings:', err.message);
      pollForNewBookings._loggedError = true;
    }
  }
}

// ============================================================
// CHANGE STREAM (primary method — may not work on all MongoDB setups)
// ============================================================
function startChangeStream() {
  try {
    const Booking = require('../models/Booking');
    const conn = Booking.db || require('mongoose').connection;

    if (!conn || conn.readyState !== 1) {
      console.warn('⚠️ [BookingPoller] MongoDB not connected, skipping change stream');
      return;
    }

    const pipeline = [
      {
        $match: {
          operationType: { $in: ['insert', 'update'] },
        },
      },
    ];

    changeStream = conn.watch(pipeline, { fullDocument: 'updateLookup' });

    changeStream.on('change', async (change) => {
      try {
        console.log(`\n📡 [ChangeStream] Event: ${change.operationType}`);

        if (change.operationType === 'insert') {
          const doc = change.fullDocument;
          if (doc) {
            console.log(`📡 [ChangeStream] New document in ${change.ns?.coll || 'unknown'}`);
            // Only process booking-related collections
            const collName = (change.ns?.coll || '').toLowerCase();
            if (collName.includes('booking')) {
              await notifyAdminsOfNewBooking(doc);
            }
          }
        }

        if (change.operationType === 'update') {
          const doc = change.fullDocument;
          if (doc) {
            const collName = (change.ns?.coll || '').toLowerCase();
            if (collName.includes('booking') && doc.status === 'pending') {
              await notifyAdminsOfNewBooking(doc);
            }
          }
        }
      } catch (err) {
        console.error('❌ [ChangeStream] Error processing change:', err.message);
      }
    });

    changeStream.on('error', (err) => {
      console.error('❌ [ChangeStream] Stream error:', err.message);
      console.log('🔄 [ChangeStream] Relying on polling fallback instead');
    });

    changeStream.on('close', () => {
      console.warn('⚠️ [ChangeStream] Stream closed');
    });

    console.log('✅ [BookingPoller] Change stream started');
  } catch (err) {
    console.error('❌ [BookingPoller] Change stream failed:', err.message);
    console.log('🔄 [BookingPoller] Will rely on polling fallback');
  }
}

// ============================================================
// STARTUP SCAN — check for any bookings created while server was down
// ============================================================
async function startupScan() {
  try {
    const Booking = require('../models/Booking');
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

    const recentBookings = await Booking.find({
      createdAt: { $gte: fiveMinutesAgo },
    })
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    if (recentBookings.length > 0) {
      console.log(`\n🔍 [Startup] Found ${recentBookings.length} recent booking(s) from last 5 minutes`);
      for (const booking of recentBookings) {
        await notifyAdminsOfNewBooking(booking);
      }
    } else {
      console.log('🔍 [Startup] No recent bookings found');
    }
  } catch (err) {
    console.error('❌ [Startup] Scan error:', err.message);
  }
}

// ============================================================
// MAIN START FUNCTION
// ============================================================
function startBookingPoller() {
  if (isRunning) {
    console.log('⚠️ [BookingPoller] Already running');
    return;
  }

  isRunning = true;
  console.log('\n🚀 [BookingPoller] Starting...');

  // 1. Start change stream (primary)
  startChangeStream();

  // 2. Start polling fallback (every 15 seconds)
  lastPolledAt = new Date();
  pollInterval = setInterval(pollForNewBookings, 15000);
  console.log('✅ [BookingPoller] Polling fallback started (every 15s)');

  // 3. Run startup scan after 5 seconds
  setTimeout(startupScan, 5000);

  console.log('✅ [BookingPoller] Fully started (change stream + polling + startup scan)\n');
}

function stopBookingPoller() {
  isRunning = false;
  if (changeStream) {
    try { changeStream.close(); } catch (e) {}
    changeStream = null;
  }
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
  }
  console.log('🛑 [BookingPoller] Stopped');
}

module.exports = {
  startBookingPoller,
  stopBookingPoller,
  notifyAdminsOfNewBooking,
};