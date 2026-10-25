// backend/src/workers/bookingPoller.js
// EVENT-DRIVEN with MongoDB Change Streams + light safety-net cron (every 2 min)
const cron = require('node-cron');
const logger = require('../utils/logger');
const { getBookingModel } = require('../config/database');
const { triggerDispatchById, activeDispatches, recentlyFailed } = require('../services/dispatchService');

let changeStream = null;

// ─── 1. CHANGE STREAM: Instantly detect new bookings ───
async function startChangeStream() {
  try {
    const Booking = getBookingModel();
    changeStream = Booking.watch(
      [
        {
          $match: {
            $or: [
              // New booking inserted
              { operationType: 'insert' },
              // Booking updated to a status that needs dispatch
              {
                operationType: 'update',
                'updateDescription.updatedFields.status': { $in: ['confirmed', 'pending', 'no_provider_found'] },
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

        // Only dispatch if truly unassigned
        if (doc.providerId) return;
        if (!['confirmed', 'pending', 'no_provider_found', 'searching'].includes(doc.status)) return;

        logger.info(`⚡ Change stream: dispatching booking ${doc._id} (status=${doc.status})`);
        triggerDispatchById(doc._id).catch((e) =>
          logger.error(`Change stream dispatch error: ${e.message}`)
        );
      } catch (err) {
        logger.error(`Change stream handler error: ${err.message}`);
      }
    });

    changeStream.on('error', (err) => {
      logger.error(`Change stream error: ${err.message}. Restarting in 10s...`);
      try { changeStream.close(); } catch {}
      changeStream = null;
      setTimeout(startChangeStream, 10000);
    });

    logger.info('✅ Change Stream started on bookings collection');
  } catch (err) {
    logger.warn(`Change stream unavailable (${err.message}) — falling back to cron only`);
  }
}

// ─── 2. SAFETY-NET CRON: Every 2 min, catch anything missed ───
async function safetyNetScan() {
  try {
    const Booking = getBookingModel();
    const stuck = await Booking.find({
      status: { $in: ['no_provider_found', 'searching', 'confirmed'] },
      $or: [{ providerId: null }, { providerId: { $exists: false } }, { providerId: '' }],
      createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    })
      .select('_id status')
      .sort({ createdAt: -1 })
      .limit(10) // cap at 10 per scan
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
        logger.error(`Safety-net dispatch error: ${e.message}`)
      );
      // Stagger by 500ms to avoid thundering herd
      await new Promise((r) => setTimeout(r, 500));
    }
  } catch (err) {
    logger.error(`Safety-net scan error: ${err.message}`);
  }
}

function startBookingPoller() {
  // Change stream for instant pickup
  startChangeStream();

  // Safety net every 2 minutes (NOT every 2 seconds!)
  cron.schedule('*/2 * * * *', safetyNetScan);
  logger.info('✅ Safety-net cron started (every 2 min)');

  // One-time scan on startup after 15s
  setTimeout(safetyNetScan, 15000);
}

function stopBookingPoller() {
  if (changeStream) {
    try { changeStream.close(); } catch {}
    changeStream = null;
  }
}

module.exports = { startBookingPoller, stopBookingPoller };