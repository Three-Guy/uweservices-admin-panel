// backend/src/workers/dispatchWorker.js
// ✅ FIXED: ONLY processes DispatchJob queue
// ✅ Does NOT scan bookings table (that's bookingPoller's job)
// ✅ Handles stale offer cleanup only

const DispatchJob = require('../models/DispatchJob');
const ProviderOffer = require('../models/ProviderOffer');
const { dispatchBooking } = require('../services/dispatchService');

let jobWatcher = null;
let staleOfferCleaner = null;
const inFlightJobs = new Set();

const JOB_WATCH_INTERVAL_MS = parseInt(process.env.DISPATCH_JOB_WATCH_INTERVAL_MS || '10000', 10); // 10s
const STALE_CLEANER_INTERVAL_MS = parseInt(process.env.DISPATCH_STALE_CLEANER_INTERVAL_MS || '30000', 10); // 30s

async function processQueuedJobs() {
  try {
    const queued = await DispatchJob.find({
      status: 'queued',
      $or: [{ nextRunAt: { $lte: new Date() } }, { nextRunAt: null }],
    })
      .sort({ createdAt: 1 })
      .limit(3)
      .lean();

    if (queued.length === 0) return;

    for (const job of queued) {
      if (inFlightJobs.has(String(job._id))) continue;
      inFlightJobs.add(String(job._id));

      try {
        console.log(`[DispatchWorker] 🎯 Processing queued job ${job._id} for ${job.bookingId}`);
        await DispatchJob.updateOne({ _id: job._id }, { $set: { status: 'running', startedAt: new Date() } });
        await dispatchBooking(job.bookingId);
      } catch (e) {
        console.error(`[DispatchWorker] Job error:`, e.message);
        await DispatchJob.updateOne({ _id: job._id }, {
          $set: { status: 'failed', completedAt: new Date(), lastError: e.message },
        });
      } finally {
        setTimeout(() => inFlightJobs.delete(String(job._id)), 5000);
      }
    }
  } catch (e) {
    console.error('[DispatchWorker] processQueuedJobs error:', e.message);
  }
}

async function cleanStaleOffers() {
  try {
    const now = new Date();
    const result = await ProviderOffer.updateMany(
      {
        status: { $in: ['sent', 'delivered', 'viewed'] },
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
  jobWatcher = setInterval(processQueuedJobs, JOB_WATCH_INTERVAL_MS);
  staleOfferCleaner = setInterval(cleanStaleOffers, STALE_CLEANER_INTERVAL_MS);
  console.log(`[DispatchWorker] ✅ Job watcher every ${JOB_WATCH_INTERVAL_MS / 1000}s`);
  console.log(`[DispatchWorker] ✅ Stale offer cleaner every ${STALE_CLEANER_INTERVAL_MS / 1000}s`);
}

async function stopDispatchWorker() {
  if (jobWatcher) {
    clearInterval(jobWatcher);
    jobWatcher = null;
  }
  if (staleOfferCleaner) {
    clearInterval(staleOfferCleaner);
    staleOfferCleaner = null;
  }
  console.log('[DispatchWorker] Stopped');
}

module.exports = {
  startDispatchWorker,
  stopDispatchWorker,
};