// backend/src/workers/bookingPoller.js
const mongoose = require('mongoose');
const cron = require('node-cron');
const { getBookingModel } = require('../config/database');
const { triggerDispatchById, activeDispatches, recentlyFailed, CFG } = require('../services/dispatchService');
const logger = require('../utils/logger');

let changeStream = null;
let safetyNetCron = null;
let isShuttingDown = false;

// Track bookings currently being considered (not just actively dispatching, but queued)
const inFlight = new Set();

// How long to wait before retrying a booking that got no_provider_found
const RETRY_AFTER_NO_PROVIDER_MS = Number(process.env.DISPATCH_RETRY_AFTER_MS || 5 * 60 * 1000); // 5 min

function safeTrigger(bookingId) {
  const key = String(bookingId);
  if (inFlight.has(key)) return;
  if (activeDispatches.has(key)) return;
  if (recentlyFailed.has(key)) {
    const age = Date.now() - recentlyFailed.get(key);
    if (age < CFG.cooldownAfterFailMs) return;
  }
  inFlight.add(key);
  Promise.resolve()
    .then(() => triggerDispatchById(bookingId))
    .catch((e) => logger.error(`safeTrigger error for ${key}: ${e.message}`))
    .finally(() => {
      setTimeout(() => inFlight.delete(key), 2000);
    });
}

// ─── 1. CHANGE STREAM (real-time) ───
async function startChangeStream() {
  try {
    const Booking = getBookingModel();
    const pipeline = [
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
    ];

    changeStream = Booking.watch(pipeline, { fullDocument: 'updateLookup' });

    changeStream.on('change', (change) => {
      try {
        if (isShuttingDown) return;
        const doc = change.fullDocument;
        if (!doc) return;

        const needsDispatch =
          !doc.providerId &&
          ['pending', 'confirmed', 'searching', 'no_provider_found'].includes(doc.status);

        if (!needsDispatch) return;

        // If no_provider_found → only retry after cooldown
        if (doc.status === 'no_provider_found') {
          const lastHist = (doc.statusHistory || []).slice(-1)[0];
          const lastChangedAt = lastHist?.changedAt ? new Date(lastHist.changedAt).getTime() : 0;
          const age = Date.now() - lastChangedAt;
          if (age < RETRY_AFTER_NO_PROVIDER_MS) {
            return; // Skip — too soon
          }
        }

        logger.info(`⚡ Change stream: dispatching booking ${doc._id} (status=${doc.status})`);
        safeTrigger(doc._id);
      } catch (e) {
        logger.error(`Change stream handler error: ${e.message}`);
      }
    });

    changeStream.on('error', (err) => {
      logger.error(`Change stream error: ${err.message}`);
      setTimeout(() => {
        if (!isShuttingDown) {
          logger.info('🔄 Restarting change stream...');
          startChangeStream().catch((e) => logger.error('Restart failed: ' + e.message));
        }
      }, 10000);
    });

    changeStream.on('close', () => {
      logger.warn('Change stream closed');
    });

    logger.info('✅ Change Stream started on bookings collection');
  } catch (e) {
    logger.error(`Failed to start change stream: ${e.message}`);
  }
}

// ─── 2. SAFETY NET CRON (every 2 min) ───
function startSafetyNet() {
  safetyNetCron = cron.schedule('*/2 * * * *', async () => {
    try {
      if (isShuttingDown) return;
      const Booking = getBookingModel();

      const twoMinAgo = new Date(Date.now() - 2 * 60 * 1000);
      const retryAgo = new Date(Date.now() - RETRY_AFTER_NO_PROVIDER_MS);

      const query = {
        $or: [
          { providerId: null },
          { providerId: { $exists: false } },
          { providerId: '' },
        ],
        $and: [
          {
            $or: [
              { status: { $in: ['pending', 'confirmed', 'searching'] }, createdAt: { $lt: twoMinAgo } },
              { status: 'no_provider_found', updatedAt: { $lt: retryAgo } },
            ],
          },
        ],
      };

      const bookings = await Booking.find(query).limit(20).lean();
      if (bookings.length === 0) return;

      const dispatchable = bookings.filter((b) => {
        const key = String(b._id);
        if (inFlight.has(key)) return false;
        if (activeDispatches.has(key)) return false;
        if (recentlyFailed.has(key)) {
          const age = Date.now() - recentlyFailed.get(key);
          if (age < CFG.cooldownAfterFailMs) return false;
        }
        return true;
      });

      if (dispatchable.length === 0) return;

      logger.info(`🛡️  Safety-net: dispatching ${dispatchable.length}/${bookings.length} bookings`);
      for (const b of dispatchable) {
        safeTrigger(b._id);
        await new Promise((r) => setTimeout(r, 300));
      }
    } catch (e) {
      logger.error(`Safety-net error: ${e.message}`);
    }
  });
  logger.info('✅ Safety-net cron started (every 2 min)');
}

// ─── 3. STARTUP SCAN (15s after boot) ───
function startupScan() {
  setTimeout(async () => {
    try {
      const Booking = getBookingModel();
      const bookings = await Booking.find({
        $or: [{ providerId: null }, { providerId: { $exists: false } }, { providerId: '' }],
        status: { $in: ['pending', 'confirmed', 'searching'] },
      }).limit(10).lean();

      if (bookings.length === 0) return;
      logger.info(`🚀 Startup scan: found ${bookings.length} unassigned bookings`);
      for (const b of bookings) {
        safeTrigger(b._id);
        await new Promise((r) => setTimeout(r, 500));
      }
    } catch (e) {
      logger.error(`Startup scan error: ${e.message}`);
    }
  }, 15000);
}

async function startPoller() {
  await startChangeStream();
  startSafetyNet();
  startupScan();
  logger.info('✅ Booking poller started (change stream + safety-net + startup scan)');
}

async function stopPoller() {
  isShuttingDown = true;
  try {
    if (changeStream) await changeStream.close();
  } catch {}
  try {
    if (safetyNetCron) safetyNetCron.stop();
  } catch {}
  logger.info('🛑 Booking poller stopped');
}

module.exports = {
  startPoller,
  stopPoller,
  start: startPoller,
  stop: stopPoller,
  startBookingPoller: startPoller,
  stopBookingPoller: stopPoller,
};