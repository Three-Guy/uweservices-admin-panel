// backend/src/workers/dispatchWorker.js
// ✅ ONLY processes DispatchJob queue (no booking scanning)
// ✅ Cleans stale offers

const DispatchJob = require('../models/DispatchJob');
const ProviderOffer = require('../models/ProviderOffer');
const { dispatchBooking } = require('../services/dispatchService');

let jobWatcher = null;
let staleOfferCleaner = null;
const inFlightJobs = new Set();

const JOB_WATCH_INTERVAL_MS = parseInt(process.env.DISPATCH_JOB_WATCH_INTERVAL_MS || '10000', 10);
const STALE_CLEANER_INTERVAL_MS = parseInt(process.env.DISPATCH_STALE_CLEANER_INTERVAL_MS || '30000', 10);

async function processQueuedJobs() {
  try {
    // Guard: ensure DispatchJob is a mongoose model
    if (!DispatchJob || typeof DispatchJob.find !== 'function') {
      console.error('[DispatchWorker] ❌ DispatchJob model not usable — check models/DispatchJob.js export');
      return;
    }

    const queued = await DispatchJob.find({
      status: 'queued',
      $or: [{ nextRunAt: { $lte: new Date() } }, { nextRunAt: null }],
    })
      .sort({ createdAt: 1 })
      .limit(3)
      .lean();

    if (queued.length === 0) return;

    for (const job of queued) {
      const jobId = String(job._id);
      if (inFlightJobs.has(jobId)) continue;
      inFlightJobs.add(jobId);

      try {
        console.log(`[DispatchWorker] 🎯 Processing job ${jobId} for ${job.bookingId}`);
        await DispatchJob.updateOne(
          { _id: job._id },
          { $set: { status: 'running', startedAt: new Date() } }
        );
        await dispatchBooking(job.bookingId, { reason: `queued_job:${jobId}` });
      } catch (e) {
        console.error(`[DispatchWorker] Job ${jobId} error:`, e.message);
        try {
          await DispatchJob.updateOne(
            { _id: job._id },
            {
              $set: {
                status: 'failed',
                completedAt: new Date(),
                lastError: e.message,
              },
            }
          );
        } catch (_) { /* ignore */ }
      } finally {
        setTimeout(() => inFlightJobs.delete(jobId), 5000);
      }
    }
  } catch (e) {
    console.error('[DispatchWorker] processQueuedJobs error:', e.message);
  }
}

async function cleanStaleOffers() {
  try {
    if (!ProviderOffer || typeof ProviderOffer.updateMany !== 'function') {
      console.error('[DispatchWorker] ❌ ProviderOffer model not usable — check models/ProviderOffer.js export');
      return;
    }

    const now = new Date();
    const result = await ProviderOffer.updateMany(
      {
        status: { $in: ['sent', 'delivered', 'viewed', 'pending'] },
        expiresAt: { $lt: now },
      },
      {
        $set: {
          status: 'timeout',
          respondedAt: now,
          reason: 'Expired without response',
          isCurrentOffer: false,
        },
      }
    );
    if (result.modifiedCount > 0) {
      console.log(`[DispatchWorker] 🧹 Cleaned ${result.modifiedCount} stale offers`);
    }
  } catch (e) {
    console.error('[DispatchWorker] cleanStaleOffers error:', e.message);
  }
}

async function startDispatchWorker() {
  console.log('[DispatchWorker] Starting dispatch worker...');

  // Verify models are loaded correctly
  if (!DispatchJob || typeof DispatchJob.find !== 'function') {
    console.error('[DispatchWorker] 🚨 CRITICAL: DispatchJob model is broken!');
    console.error('   Fix models/DispatchJob.js to export mongoose model directly');
  } else {
    console.log('[DispatchWorker] ✅ DispatchJob model OK');
  }

  if (!ProviderOffer || typeof ProviderOffer.updateMany !== 'function') {
    console.error('[DispatchWorker] 🚨 CRITICAL: ProviderOffer model is broken!');
  } else {
    console.log('[DispatchWorker] ✅ ProviderOffer model OK');
  }

  jobWatcher = setInterval(processQueuedJobs, JOB_WATCH_INTERVAL_MS);
  staleOfferCleaner = setInterval(cleanStaleOffers, STALE_CLEANER_INTERVAL_MS);
  console.log(`[DispatchWorker] ✅ Job watcher every ${JOB_WATCH_INTERVAL_MS / 1000}s`);
  console.log(`[DispatchWorker] ✅ Stale offer cleaner every ${STALE_CLEANER_INTERVAL_MS / 1000}s`);
}

async function stopDispatchWorker() {
  if (jobWatcher) { clearInterval(jobWatcher); jobWatcher = null; }
  if (staleOfferCleaner) { clearInterval(staleOfferCleaner); staleOfferCleaner = null; }
  console.log('[DispatchWorker] Stopped');
}

module.exports = { startDispatchWorker, stopDispatchWorker };