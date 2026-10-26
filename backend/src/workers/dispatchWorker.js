// backend/src/workers/dispatchWorker.js
const { getDispatchJobModel } = require('../models/DispatchJob');
const { getBookingModel } = require('../config/database');
const { triggerDispatchById, activeDispatches, recentlyFailed, CFG } = require('../services/dispatchService');
const liveEmitter = require('../services/liveEmitter');
const logger = require('../utils/logger');

let watcherInterval = null;
let staleOfferInterval = null;
let isShuttingDown = false;

// Track jobs currently being retried
const inFlight = new Set();

const WATCHER_INTERVAL_MS = Number(process.env.DISPATCH_WATCHER_INTERVAL_MS || 10000); // 10s
const STALE_OFFER_INTERVAL_MS = Number(process.env.STALE_OFFER_INTERVAL_MS || 30000); // 30s
const RETRY_AFTER_NO_PROVIDER_MS = Number(process.env.DISPATCH_RETRY_AFTER_MS || 5 * 60 * 1000); // 5 min

/**
 * Safe trigger — never crashes, respects locks and cooldown
 */
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
    .catch((e) => logger.error(`dispatchWorker.safeTrigger error for ${key}: ${e.message}`))
    .finally(() => {
      setTimeout(() => inFlight.delete(key), 2000); // Keep lock for 2s after completion
    });
}

/**
 * Safe emit — never throws
 */
function safeEmit(event, data) {
  try {
    if (liveEmitter && typeof liveEmitter.emitLive === 'function') {
      liveEmitter.emitLive(event, data || {});
    }
  } catch (e) {
    logger.error(`safeEmit error: ${e.message}`);
  }
}

/**
 * 1. WATCHER — scans DispatchJob for jobs needing retry
 */
async function watcherTick() {
  try {
    if (isShuttingDown) return;

    const DispatchJob = getDispatchJobModel();
    const now = new Date();

    const jobs = await DispatchJob.find({
      $or: [
        { status: 'queued' },
        {
          status: 'no_provider_found',
          nextRunAt: { $lte: now },
        },
      ],
    })
      .limit(10)
      .lean();

    if (!jobs || jobs.length === 0) return;

    let triggered = 0;
    for (const job of jobs) {
      if (isShuttingDown) break;
      const key = String(job.bookingObjectId);
      if (inFlight.has(key)) continue;
      if (activeDispatches.has(key)) continue;
      if (recentlyFailed.has(key)) {
        const age = Date.now() - recentlyFailed.get(key);
        if (age < CFG.cooldownAfterFailMs) continue;
      }

      // Verify booking still needs dispatch
      try {
        const Booking = getBookingModel();
        const b = await Booking.findById(job.bookingObjectId).lean();
        if (!b) continue;
        if (b.providerId) continue; // Already assigned
        if (!['pending', 'confirmed', 'searching', 'no_provider_found'].includes(b.status)) continue;

        // For no_provider_found — ensure retry delay has passed
        if (b.status === 'no_provider_found') {
          const lastHist = (b.statusHistory || []).slice(-1)[0];
          const lastChangedAt = lastHist?.changedAt ? new Date(lastHist.changedAt).getTime() : 0;
          const age = Date.now() - lastChangedAt;
          if (age < RETRY_AFTER_NO_PROVIDER_MS) continue;
        }
      } catch (e) {
        logger.error(`Booking verify error: ${e.message}`);
        continue;
      }

      safeTrigger(job.bookingObjectId);
      triggered++;

      // Stagger
      await new Promise((r) => setTimeout(r, 200));
    }

    if (triggered > 0) {
      safeEmit('dispatch:watcher_tick', { triggered, total: jobs.length });
    }
  } catch (e) {
    logger.error(`Dispatch watcher error: ${e.message}`);
  }
}

/**
 * 2. STALE OFFER CLEANER — mark old offers as expired
 */
async function cleanStaleOffers() {
  try {
    if (isShuttingDown) return;

    const { getProviderOfferModel } = require('../models/ProviderOffer');
    const Offer = getProviderOfferModel();

    const now = new Date();
    const result = await Offer.updateMany(
      {
        status: { $in: ['sent', 'delivered', 'viewed'] },
        expiresAt: { $lt: now },
      },
      {
        $set: {
          status: 'expired',
          respondedAt: now,
          isCurrentOffer: false,
        },
      }
    );

    if (result.modifiedCount > 0) {
      logger.info(`🧹 Expired ${result.modifiedCount} stale offers`);
      safeEmit('dispatch:offers_expired', { count: result.modifiedCount });
    }
  } catch (e) {
    logger.error(`cleanStaleOffers error: ${e.message}`);
  }
}

function startWatcher() {
  if (watcherInterval) {
    logger.warn('Dispatch watcher already running');
    return;
  }

  isShuttingDown = false;

  watcherInterval = setInterval(() => {
    watcherTick().catch((e) => logger.error(`watcherTick fatal: ${e.message}`));
  }, WATCHER_INTERVAL_MS);

  staleOfferInterval = setInterval(() => {
    cleanStaleOffers().catch((e) => logger.error(`cleanStaleOffers fatal: ${e.message}`));
  }, STALE_OFFER_INTERVAL_MS);

  logger.info(`✅ Dispatch watcher started (every ${WATCHER_INTERVAL_MS / 1000}s)`);
  logger.info(`✅ Stale offer cleaner started (every ${STALE_OFFER_INTERVAL_MS / 1000}s)`);
}

function stopWatcher() {
  isShuttingDown = true;
  try {
    if (watcherInterval) {
      clearInterval(watcherInterval);
      watcherInterval = null;
    }
  } catch {}
  try {
    if (staleOfferInterval) {
      clearInterval(staleOfferInterval);
      staleOfferInterval = null;
    }
  } catch {}
  logger.info('🛑 Dispatch watcher stopped');
}

module.exports = {
  startWatcher,
  stopWatcher,
  // Aliases
  start: startWatcher,
  stop: stopWatcher,
};