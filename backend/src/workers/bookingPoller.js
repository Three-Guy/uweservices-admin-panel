// backend/src/workers/bookingPoller.js
// EVENT-DRIVEN with MongoDB Change Streams + safety-net cron (every 2 min)
const cron = require('node-cron');
const logger = require('../utils/logger');
const { getBookingModel } = require('../config/database');
const { createAdminAlert } = require('../services/adminAlertService');
const {
  triggerDispatchById,
  activeDispatches,
  recentlyFailed,
} = require('../services/dispatchService');

let changeStream = null;
let safetyNetTask = null;
const notifiedNewBookings = new Set(); // Prevent duplicate "new_booking" alerts

// ─── 1. CHANGE STREAM: Instantly detect new/updated bookings ───
async function startChangeStream() {
  try {
    const Booking = getBookingModel();

    changeStream = Booking.watch(
      [
        {
          $match: {
            $or: [
              { operationType: 'insert' },
              {
                operationType: 'update',
                'updateDescription.updatedFields.status': {
                  $in: ['confirmed', 'pending', 'no_provider_found'],
                },
              },
            ],
          },
        },
      ],
      { fullDocument: 'updateLookup' }
    );

    changeStream.on('change', async (change) => {
      try {
        const doc = change.fullDocument;
        if (!doc) return;

        const bookingKey = String(doc._id);

        // NEW BOOKING ALERT (fires once per booking)
        if (change.operationType === 'insert' && !notifiedNewBookings.has(bookingKey)) {
          notifiedNewBookings.add(bookingKey);
          setTimeout(() => notifiedNewBookings.delete(bookingKey), 60 * 60 * 1000); // 1h cleanup

          await createAdminAlert({
            type: 'new_booking',
            title: '🔔 New Booking!',
            message: `${doc.customerName || 'Customer'} booked ${doc.serviceName || 'a service'} (₹${doc.totalAmount || 0})`,
            severity: 'info',
            bookingId: doc.bookingId || bookingKey,
            userId: doc.userId ? String(doc.userId) : null,
            data: {
              serviceName: doc.serviceName,
              totalAmount: doc.totalAmount,
              address: doc.address,
              city: doc.city?.cityName || '',
              bookingType: doc.bookingType,
            },
            actionUrl: `/bookings?open=${doc.bookingId || bookingKey}`,
            actionLabel: 'View Booking',
          }).catch((e) => logger.warn(`New booking alert failed: ${e.message}`));
        }

        // AUTO-DISPATCH if unassigned
        if (!doc.providerId && ['confirmed', 'pending', 'no_provider_found', 'searching'].includes(doc.status)) {
          logger.info(`⚡ Change stream: dispatching booking ${bookingKey} (status=${doc.status})`);
          triggerDispatchById(doc._id).catch((e) =>
            logger.error(`Change stream dispatch error: ${e.message}`)
          );
        }
      } catch (err) {
        logger.error(`Change stream handler error: ${err.message}`);
      }
    });

    changeStream.on('error', (err) => {
      logger.error(`Change stream error: ${err.message}. Restarting in 10s...`);
      try {
        changeStream.close();
      } catch {}
      changeStream = null;
      setTimeout(startChangeStream, 10000);
    });

    changeStream.on('close', () => {
      logger.warn('Change stream closed');
      changeStream = null;
    });

    logger.info('✅ Change Stream started on bookings collection');
  } catch (err) {
    logger.warn(`Change stream unavailable (${err.message}) — falling back to safety-net cron only`);
    logger.warn('💡 TIP: MongoDB must be running as a replica set for change streams to work');
  }
}

// ─── 2. SAFETY-NET CRON: Every 2 min, catch anything missed ───
async function safetyNetScan() {
  try {
    const Booking = getBookingModel();
    const stuck = await Booking.find({
      status: { $in: ['no_provider_found', 'searching', 'confirmed', 'pending'] },
      $or: [{ providerId: null }, { providerId: { $exists: false } }, { providerId: '' }],
      createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      isDeleted: { $ne: true },
    })
      .select('_id status bookingId')
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    if (stuck.length === 0) return;

    const toDispatch = stuck.filter((b) => {
      const key = String(b._id);
      if (activeDispatches.has(key)) return false;
      if (recentlyFailed.has(key)) return false;
      return true;
    });

    if (toDispatch.length === 0) {
      logger.debug(`🛡️  Safety-net: ${stuck.length} stuck, all skipped (active/cooldown)`);
      return;
    }

    logger.info(`🛡️  Safety-net: dispatching ${toDispatch.length}/${stuck.length} bookings`);
    for (const b of toDispatch) {
      triggerDispatchById(b._id).catch((e) =>
        logger.error(`Safety-net dispatch error for ${b.bookingId || b._id}: ${e.message}`)
      );
      await new Promise((r) => setTimeout(r, 500));
    }
  } catch (err) {
    logger.error(`Safety-net scan error: ${err.message}`);
  }
}

function startBookingPoller() {
  startChangeStream();

  // Safety net every 2 minutes
  safetyNetTask = cron.schedule('*/2 * * * *', safetyNetScan);
  logger.info('✅ Safety-net cron started (every 2 min)');

  // One-time scan after 15s to catch startup backlog
  setTimeout(safetyNetScan, 15000);
}

function stopBookingPoller() {
  if (changeStream) {
    try {
      changeStream.close();
    } catch {}
    changeStream = null;
  }
  if (safetyNetTask) {
    safetyNetTask.stop();
    safetyNetTask = null;
  }
}

module.exports = {
  startBookingPoller,
  stopBookingPoller,
  // Aliases (so server.js old code also works)
  startPoller: startBookingPoller,
  stopPoller: stopBookingPoller,
};