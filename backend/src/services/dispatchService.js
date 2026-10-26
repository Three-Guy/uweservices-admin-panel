// backend/src/services/dispatchService.js
const mongoose = require('mongoose');
const { getBookingModel, getProviderConnection } = require('../config/database');
const { getProviderOfferModel } = require('../models/ProviderOffer');
const { getDispatchJobModel } = require('../models/DispatchJob');
const { findEligibleProviders } = require('./eligibilityService');
const { sendBookingOfferToProvider, sendCancellationToProvider } = require('./fcmService');
const { createAdminAlert } = require('./adminAlertService');
const logger = require('../utils/logger');

// ✅ Centralized live emitter (Socket.IO)
const liveEmitter = require('./liveEmitter');

// ─── Config ───
const CFG = {
  radiusProgression: (process.env.DISPATCH_RADIUS_PROGRESSION || '5,8,12')
    .split(',')
    .map((x) => Number(x.trim()))
    .filter((x) => x > 0),
  batchSize: Number(process.env.DISPATCH_BATCH_SIZE || 5),
  maxBatchesPerCycle: Number(process.env.DISPATCH_MAX_BATCHES_PER_CYCLE || 3),
  requestTimeoutMs: Number(process.env.DISPATCH_REQUEST_TIMEOUT_MS || 15000),
  scheduledTimeoutMs: Number(process.env.DISPATCH_SCHEDULED_TIMEOUT_MS || 30000),
  scheduleThresholdMin: Number(process.env.DISPATCH_SCHEDULE_THRESHOLD_MINUTES || 30),
  maxGeoResults: Number(process.env.DISPATCH_MAX_GEO_RESULTS || 50),
  cooldownAfterFailMs: Number(process.env.DISPATCH_COOLDOWN_AFTER_FAIL_MS || 180000), // 3 min
};

// ─── Per-booking locks (event-driven, NOT polling) ───
const activeDispatches = new Map();        // bookingId -> timestamp when started
const recentlyFailed = new Map();          // bookingId -> timestamp when last failed (cooldown)

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Guard: has this booking been dispatched recently? ───
function isInCooldown(bookingId) {
  const last = recentlyFailed.get(String(bookingId));
  if (!last) return false;
  const age = Date.now() - last;
  if (age > CFG.cooldownAfterFailMs) {
    recentlyFailed.delete(String(bookingId));
    return false;
  }
  return true;
}

function markFailed(bookingId) {
  recentlyFailed.set(String(bookingId), Date.now());
  // Auto-cleanup after 10 min
  setTimeout(() => recentlyFailed.delete(String(bookingId)), 10 * 60 * 1000);
}

function isBookingScheduled(booking) {
  try {
    if (booking.bookingType === 'scheduled') return true;
    if (!booking.scheduledDate || !booking.scheduledTime) return false;
    const scheduled = new Date(`${booking.scheduledDate} ${booking.scheduledTime}`);
    if (isNaN(scheduled.getTime())) return false;
    const diffMin = (scheduled.getTime() - Date.now()) / 60000;
    return diffMin > CFG.scheduleThresholdMin;
  } catch {
    return false;
  }
}

async function acquireBookingLock(bookingObjectId) {
  const Booking = getBookingModel();
  return Booking.findOneAndUpdate(
    {
      _id: bookingObjectId,
      $and: [
        { $or: [{ providerId: null }, { providerId: { $exists: false } }, { providerId: '' }] },
        { status: { $in: ['confirmed', 'pending', 'searching', 'no_provider_found'] } },
      ],
    },
    {
      $set: { status: 'searching', assignmentMethod: 'admin-dispatch' },
      $push: {
        statusHistory: {
          status: 'searching',
          changedAt: new Date(),
          changedBy: 'admin-dispatch',
          reason: 'Dispatch started by admin backend',
        },
      },
    },
    { new: true }
  );
}

async function checkIfAssigned(bookingObjectId) {
  const Booking = getBookingModel();
  const b = await Booking.findById(bookingObjectId).lean();
  if (!b) return { assigned: false, cancelled: true, booking: null };
  const terminal = ['assigned', 'accepted', 'en-route', 'arrived', 'in-progress', 'completed', 'cancelled'];
  if (b.providerId && terminal.includes(b.status)) return { assigned: true, cancelled: false, booking: b };
  if (b.status === 'cancelled') return { assigned: false, cancelled: true, booking: b };
  return { assigned: false, cancelled: false, booking: b };
}

async function supersedeOldOffers(bookingObjectId) {
  const Offer = getProviderOfferModel();
  await Offer.updateMany(
    { bookingObjectId, isCurrentOffer: true, status: { $in: ['sent', 'delivered', 'viewed'] } },
    { $set: { isCurrentOffer: false } }
  );
}

async function dispatchBatch({ booking, providers, batchNumber, radiusKm, cycle, isScheduled, dispatchJob }) {
  const Offer = getProviderOfferModel();
  const timeoutMs = isScheduled ? CFG.scheduledTimeoutMs : CFG.requestTimeoutMs;
  const expiresAt = new Date(Date.now() + timeoutMs);

  await Promise.all(
    providers.map(async (p) => {
      const providerIdStr = String(p.providerId || p._id);
      const offer = await Offer.create({
        bookingId: booking.bookingId || String(booking._id),
        bookingObjectId: booking._id,
        providerId: providerIdStr,
        providerObjectId: p._id,
        providerName: p.name || '',
        providerPhone: p.phone || '',
        providerCategory: p.categoryName || p.profession || '',
        providerCity: p.city || '',
        status: 'sent',
        offeredAt: new Date(),
        expiresAt,
        dispatchCycle: cycle,
        batchNumber,
        radiusKm,
        distanceKm: Number(p._distanceKm) || 0,
        isCurrentOffer: true,
        isScheduled,
        fcmToken: p.fcmToken ? String(p.fcmToken).slice(0, 20) + '...' : null,
        bookingSnapshot: {
          serviceName: booking.serviceName,
          totalAmount: booking.totalAmount,
          address: booking.address,
          scheduledDate: booking.scheduledDate,
          scheduledTime: booking.scheduledTime,
        },
      });

      const fcmRes = await sendBookingOfferToProvider({
        fcmToken: p.fcmToken,
        booking,
        distanceKm: Number(p._distanceKm) || 0,
        batchNumber,
        isScheduled,
        timeoutMs,
      });

      await Offer.findByIdAndUpdate(offer._id, {
        $set: {
          fcmSent: fcmRes.success,
          fcmMessageId: fcmRes.messageId || null,
          fcmError: fcmRes.error || null,
          status: fcmRes.success ? 'delivered' : 'failed',
          deliveredAt: fcmRes.success ? new Date() : null,
        },
      });

      liveEmitter.emitLive('dispatch:offer_sent', {
        bookingId: booking.bookingId || String(booking._id),
        providerId: providerIdStr,
        providerName: p.name,
        batchNumber,
        radiusKm,
        distanceKm: p._distanceKm,
        fcmSuccess: fcmRes.success,
        timestamp: new Date().toISOString(),
      });
    })
  );

  await getDispatchJobModel().findByIdAndUpdate(dispatchJob._id, {
    $inc: { totalOffersSent: providers.length },
    $push: { triedProviderIds: { $each: providers.map((p) => String(p.providerId || p._id)) } },
    $set: { batchNumber, currentRadiusKm: radiusKm },
  });

  // Poll ONLY for the duration of this one batch (acceptance check)
  const pollInterval = 2000;
  const iterations = Math.ceil(timeoutMs / pollInterval);
  for (let i = 0; i < iterations; i++) {
    await sleep(pollInterval);
    const { assigned, cancelled, booking: fresh } = await checkIfAssigned(booking._id);
    if (cancelled) return { accepted: false, cancelled: true };
    if (assigned && fresh?.providerId) {
      await Offer.updateMany(
        { bookingObjectId: booking._id, providerId: String(fresh.providerId), isCurrentOffer: true },
        { $set: { status: 'accepted', respondedAt: new Date() } }
      );
      await Offer.updateMany(
        {
          bookingObjectId: booking._id,
          isCurrentOffer: true,
          providerId: { $ne: String(fresh.providerId) },
          status: { $in: ['sent', 'delivered', 'viewed'] },
        },
        { $set: { status: 'superseded', respondedAt: new Date() } }
      );
      providers.forEach((p) => {
        if (String(p.providerId || p._id) !== String(fresh.providerId) && p.fcmToken) {
          sendCancellationToProvider({
            fcmToken: p.fcmToken,
            bookingId: booking.bookingId || String(booking._id),
            reason: 'assigned_to_another',
          }).catch(() => {});
        }
      });
      return { accepted: true, providerId: fresh.providerId, booking: fresh };
    }
  }

  await Offer.updateMany(
    { bookingObjectId: booking._id, isCurrentOffer: true, status: { $in: ['sent', 'delivered', 'viewed'] } },
    { $set: { status: 'timeout', respondedAt: new Date() } }
  );
  await getDispatchJobModel().findByIdAndUpdate(dispatchJob._id, {
    $inc: { totalTimeouts: providers.length },
  });
  return { accepted: false };
}

/**
 * Main dispatch — event-driven, no polling, cooldown-protected
 */
async function dispatchBooking(booking) {
  const bookingIdKey = String(booking._id);

  // GUARD 1: Already running
  if (activeDispatches.has(bookingIdKey)) {
    logger.debug(`⏭️  Dispatch already running for ${bookingIdKey}`);
    return { ok: false, reason: 'already_running' };
  }

  // GUARD 2: Recently failed (cooldown)
  if (isInCooldown(bookingIdKey)) {
    logger.debug(`⏭️  Booking ${bookingIdKey} in cooldown, skip`);
    return { ok: false, reason: 'cooldown' };
  }

  activeDispatches.set(bookingIdKey, Date.now());

  const DispatchJob = getDispatchJobModel();
  const Booking = getBookingModel();
  let dispatchJob = null;

  try {
    const locked = await acquireBookingLock(booking._id);
    if (!locked) {
      logger.info(`🔒 Lock failed for ${bookingIdKey} — already assigned/cancelled`);
      return { ok: false, reason: 'lock_failed' };
    }
    booking = locked.toObject ? locked.toObject() : locked;

    const isScheduled = isBookingScheduled(booking);

    const existingJob = await DispatchJob.findOne({
      bookingObjectId: booking._id,
      status: { $in: ['queued', 'running'] },
    });

    if (existingJob) {
      dispatchJob = existingJob;
      dispatchJob.status = 'running';
      dispatchJob.cycle += 1;
      await dispatchJob.save();
    } else {
      dispatchJob = await DispatchJob.create({
        bookingId: booking.bookingId || bookingIdKey,
        bookingObjectId: booking._id,
        status: 'running',
        cycle: 1,
        isScheduled,
        startedAt: new Date(),
      });
    }

    await supersedeOldOffers(booking._id);

    liveEmitter.emitLive('dispatch:started', {
      bookingId: booking.bookingId || bookingIdKey,
      cycle: dispatchJob.cycle,
      isScheduled,
    });

    const triedThisDispatch = new Set((dispatchJob.triedProviderIds || []).map(String));
    let totalBatches = 0;

    // SEQUENTIAL radius expansion — stops at first provider found
    for (const radiusKm of CFG.radiusProgression) {
      if (totalBatches >= CFG.maxBatchesPerCycle) break;

      logger.info(`🔍 Searching providers for ${bookingIdKey} within ${radiusKm}km`);
      const eligible = await findEligibleProviders({
        booking,
        radiusKm,
        excludeProviderIds: Array.from(triedThisDispatch),
        limit: CFG.maxGeoResults,
      });

      if (eligible.length === 0) {
        logger.info(`No eligible providers at ${radiusKm}km`);
        continue;
      }

      await DispatchJob.findByIdAndUpdate(dispatchJob._id, {
        $inc: { totalProvidersConsidered: eligible.length },
      });

      for (let i = 0; i < eligible.length && totalBatches < CFG.maxBatchesPerCycle; i += CFG.batchSize) {
        const batch = eligible.slice(i, i + CFG.batchSize);
        totalBatches += 1;
        batch.forEach((p) => triedThisDispatch.add(String(p.providerId || p._id)));

        logger.info(`📤 Batch ${totalBatches}: sending to ${batch.length} providers (radius=${radiusKm}km)`);

        const result = await dispatchBatch({
          booking,
          providers: batch,
          batchNumber: totalBatches,
          radiusKm,
          cycle: dispatchJob.cycle,
          isScheduled,
          dispatchJob,
        });

        if (result.cancelled) {
          dispatchJob.status = 'cancelled';
          dispatchJob.completedAt = new Date();
          await dispatchJob.save();
          liveEmitter.emitLive('dispatch:cancelled', { bookingId: booking.bookingId || bookingIdKey });
          return { ok: true, result: 'cancelled' };
        }

        if (result.accepted) {
          dispatchJob.status = 'completed';
          dispatchJob.completedAt = new Date();
          dispatchJob.assignedProviderId = String(result.providerId);
          await dispatchJob.save();

          liveEmitter.emitLive('dispatch:assigned', {
            bookingId: booking.bookingId || bookingIdKey,
            providerId: result.providerId,
          });

          await createAdminAlert({
            type: 'booking_assigned',
            title: '✅ Booking Assigned',
            message: `Booking ${booking.bookingId || bookingIdKey} assigned to provider ${result.providerId}`,
            severity: 'success',
            bookingId: booking.bookingId || bookingIdKey,
            providerId: String(result.providerId),
            data: { cycle: dispatchJob.cycle, batchNumber: totalBatches },
            actionUrl: `/bookings?open=${booking.bookingId || bookingIdKey}`,
          });
          return { ok: true, result: 'assigned', providerId: result.providerId };
        }
      }
    }

    logger.warn(`❌ No provider accepted ${bookingIdKey} after ${totalBatches} batches`);

    await Booking.findByIdAndUpdate(booking._id, {
      $set: { status: 'no_provider_found' },
      $push: {
        statusHistory: {
          status: 'no_provider_found',
          changedAt: new Date(),
          changedBy: 'admin-dispatch',
          reason: `Tried ${triedThisDispatch.size} providers across ${CFG.radiusProgression.join('/')} km`,
        },
      },
    });

    dispatchJob.status = 'no_provider_found';
    dispatchJob.completedAt = new Date();
    dispatchJob.nextRunAt = new Date(Date.now() + CFG.cooldownAfterFailMs);
    await dispatchJob.save();

    // Mark cooldown so safety-net doesn't instantly retry
    markFailed(bookingIdKey);

    liveEmitter.emitLive('dispatch:no_provider_found', {
      bookingId: booking.bookingId || bookingIdKey,
      triedCount: triedThisDispatch.size,
    });

    await createAdminAlert({
      type: 'no_provider_found',
      title: '⚠️ No Provider Found',
      message: `Booking ${booking.bookingId || bookingIdKey} — ${triedThisDispatch.size} providers tried`,
      severity: 'warning',
      bookingId: booking.bookingId || bookingIdKey,
      data: { triedCount: triedThisDispatch.size, batches: totalBatches },
      actionUrl: `/bookings?open=${booking.bookingId || bookingIdKey}`,
    });

    return { ok: true, result: 'no_provider_found' };
  } catch (err) {
    logger.error(`Dispatch error for ${bookingIdKey}: ${err.message}`);
    logger.error(err.stack);
    markFailed(bookingIdKey); // cooldown on error too
    if (dispatchJob) {
      dispatchJob.status = 'failed';
      dispatchJob.lastError = err.message;
      dispatchJob.completedAt = new Date();
      await dispatchJob.save().catch(() => {});
    }
    await createAdminAlert({
      type: 'dispatch_failed',
      title: '🚨 Dispatch Failed',
      message: `Dispatch error for ${bookingIdKey}: ${err.message}`,
      severity: 'error',
      bookingId: booking.bookingId || bookingIdKey,
    }).catch(() => {});
    return { ok: false, error: err.message };
  } finally {
    activeDispatches.delete(bookingIdKey);
  }
}

/**
 * Trigger dispatch by booking ID (event entry point)
 */
async function triggerDispatchById(bookingId) {
  const Booking = getBookingModel();
  let booking = null;
  if (mongoose.Types.ObjectId.isValid(bookingId)) {
    booking = await Booking.findById(bookingId).lean();
  }
  if (!booking) booking = await Booking.findOne({ bookingId }).lean();
  if (!booking) {
    logger.warn(`triggerDispatchById: booking not found: ${bookingId}`);
    return { ok: false, reason: 'not_found' };
  }
  return dispatchBooking(booking);
}

async function manualReassign(bookingId, { reason, actorEmail } = {}) {
  const Booking = getBookingModel();
  let booking;
  if (mongoose.Types.ObjectId.isValid(bookingId)) booking = await Booking.findById(bookingId);
  if (!booking) booking = await Booking.findOne({ bookingId });
  if (!booking) throw new Error('Booking not found');

  const previousProviderId = booking.providerId;
  booking.providerId = null;
  booking.providerName = undefined;
  booking.providerPhone = undefined;
  booking.status = 'confirmed';
  booking.statusHistory = booking.statusHistory || [];
  booking.statusHistory.push({
    status: 'confirmed',
    changedAt: new Date(),
    changedBy: actorEmail || 'admin',
    reason: reason || `Manual reassignment (previous: ${previousProviderId || 'none'})`,
  });
  await booking.save();

  // Clear cooldown since admin manually asked for retry
  recentlyFailed.delete(String(booking._id));

  await createAdminAlert({
    type: 'reassignment',
    title: '🔄 Manual Reassignment Triggered',
    message: `Admin ${actorEmail || ''} triggered reassignment for ${booking.bookingId}`,
    severity: 'info',
    bookingId: booking.bookingId,
    data: { previousProviderId, reason },
  });

  dispatchBooking(booking.toObject ? booking.toObject() : booking).catch((e) =>
    logger.error(`Manual dispatch error: ${e.message}`)
  );
  return booking;
}

module.exports = {
  dispatchBooking,
  triggerDispatchById,
  manualReassign,
  isBookingScheduled,
  activeDispatches,
  recentlyFailed,
  CFG,
};