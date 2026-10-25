// src/services/dispatchService.js
const mongoose = require('mongoose');
const { getBookingModel, getProviderConnection } = require('../config/database');
const { getProviderOfferModel } = require('../models/ProviderOffer');
const { getDispatchJobModel } = require('../models/DispatchJob');
const { findEligibleProviders } = require('./eligibilityService');
const { sendBookingOfferToProvider, sendCancellationToProvider } = require('./fcmService');
const { createAdminAlert, emitLive } = require('./adminAlertService');
const logger = require('../utils/logger');

// Config
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
};

const activeDispatches = new Map(); // bookingId -> boolean (in-process lock)

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Check if booking is scheduled type (service > threshold minutes away)
 */
function isBookingScheduled(booking) {
  try {
    if (booking.bookingType === 'scheduled') return true;
    if (!booking.scheduledDate || !booking.scheduledTime) return false;

    // Parse scheduled datetime - best effort
    const dateStr = `${booking.scheduledDate} ${booking.scheduledTime}`;
    const scheduled = new Date(dateStr);
    if (isNaN(scheduled.getTime())) return false;

    const diffMin = (scheduled.getTime() - Date.now()) / 60000;
    return diffMin > CFG.scheduleThresholdMin;
  } catch (e) {
    return false;
  }
}

/**
 * Atomic lock: set booking status to 'searching' only if currently 'confirmed' and no provider
 */
async function acquireBookingLock(bookingObjectId) {
  const Booking = getBookingModel();
  const updated = await Booking.findOneAndUpdate(
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
  return updated;
}

/**
 * Check if a provider has accepted the booking (external process may have assigned)
 */
async function checkIfAssigned(bookingObjectId) {
  const Booking = getBookingModel();
  const b = await Booking.findById(bookingObjectId).lean();
  if (!b) return { assigned: false, cancelled: true, booking: null };
  const terminal = ['assigned', 'accepted', 'en-route', 'arrived', 'in-progress', 'completed', 'cancelled'];
  if (b.providerId && terminal.includes(b.status)) {
    return { assigned: true, cancelled: false, booking: b };
  }
  if (b.status === 'cancelled') return { assigned: false, cancelled: true, booking: b };
  return { assigned: false, cancelled: false, booking: b };
}

/**
 * Mark all currently-sent offers for a booking as superseded (new cycle starting)
 */
async function supersedeOldOffers(bookingObjectId) {
  const Offer = getProviderOfferModel();
  await Offer.updateMany(
    { bookingObjectId, isCurrentOffer: true, status: { $in: ['sent', 'delivered', 'viewed'] } },
    { $set: { isCurrentOffer: false } }
  );
}

/**
 * Send offers to a batch of providers; wait for timeout; return accepted provider (or null)
 */
async function dispatchBatch({ booking, providers, batchNumber, radiusKm, cycle, isScheduled, dispatchJob }) {
  const Offer = getProviderOfferModel();
  const timeoutMs = isScheduled ? CFG.scheduledTimeoutMs : CFG.requestTimeoutMs;
  const expiresAt = new Date(Date.now() + timeoutMs);

  // Create offer records + send FCM in parallel
  const offerIds = [];
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
      offerIds.push(offer._id);

      // Send FCM
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

      // Live emit to admin panel
      emitLive('dispatch:offer_sent', {
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

  // Update dispatch job counters
  await getDispatchJobModel().findByIdAndUpdate(dispatchJob._id, {
    $inc: { totalOffersSent: providers.length },
    $push: { triedProviderIds: { $each: providers.map((p) => String(p.providerId || p._id)) } },
    $set: { batchNumber, currentRadiusKm: radiusKm },
  });

  // Poll every 2s for timeoutMs to detect acceptance
  const pollInterval = 2000;
  const iterations = Math.ceil(timeoutMs / pollInterval);
  for (let i = 0; i < iterations; i++) {
    await sleep(pollInterval);
    const { assigned, cancelled, booking: fresh } = await checkIfAssigned(booking._id);
    if (cancelled) {
      logger.info(`Dispatch stopped: booking ${booking._id} cancelled`);
      return { accepted: false, cancelled: true };
    }
    if (assigned && fresh?.providerId) {
      logger.info(`✅ Booking ${booking._id} accepted by provider ${fresh.providerId}`);
      // Mark the accepting offer
      await Offer.updateMany(
        { bookingObjectId: booking._id, providerId: String(fresh.providerId), isCurrentOffer: true },
        { $set: { status: 'accepted', respondedAt: new Date() } }
      );
      // Mark others as superseded
      await Offer.updateMany(
        {
          bookingObjectId: booking._id,
          isCurrentOffer: true,
          providerId: { $ne: String(fresh.providerId) },
          status: { $in: ['sent', 'delivered', 'viewed'] },
        },
        { $set: { status: 'superseded', respondedAt: new Date() } }
      );
      // Cancel other providers' pending notifications
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

  // Timeout — mark unresponded offers as timeout
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
 * Main dispatch loop for one booking
 */
async function dispatchBooking(booking) {
  const bookingIdKey = String(booking._id);
  if (activeDispatches.has(bookingIdKey)) {
    logger.debug(`Dispatch already running for ${bookingIdKey}`);
    return { ok: false, reason: 'already_running' };
  }
  activeDispatches.set(bookingIdKey, true);

  const DispatchJob = getDispatchJobModel();
  const Booking = getBookingModel();
  let dispatchJob = null;

  try {
    // Step 1: Acquire lock
    const locked = await acquireBookingLock(booking._id);
    if (!locked) {
      logger.info(`Could not acquire lock for ${bookingIdKey} — already assigned/cancelled`);
      return { ok: false, reason: 'lock_failed' };
    }
    booking = locked.toObject ? locked.toObject() : locked;

    const isScheduled = isBookingScheduled(booking);

    // Step 2: Create or resume dispatch job
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

    // Supersede any lingering old offers before fresh cycle
    await supersedeOldOffers(booking._id);

    emitLive('dispatch:started', {
      bookingId: booking.bookingId || bookingIdKey,
      cycle: dispatchJob.cycle,
      isScheduled,
    });

    const triedThisDispatch = new Set((dispatchJob.triedProviderIds || []).map(String));
    let totalBatches = 0;

    // Step 3: Iterate radii
    for (const radiusKm of CFG.radiusProgression) {
      if (totalBatches >= CFG.maxBatchesPerCycle) break;

      logger.info(`🔍 Searching providers for booking ${bookingIdKey} within ${radiusKm}km`);
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

      // Batch providers
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
          emitLive('dispatch:cancelled', { bookingId: booking.bookingId || bookingIdKey });
          return { ok: true, result: 'cancelled' };
        }

        if (result.accepted) {
          dispatchJob.status = 'completed';
          dispatchJob.completedAt = new Date();
          dispatchJob.assignedProviderId = String(result.providerId);
          await dispatchJob.save();

          emitLive('dispatch:assigned', {
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

    // Step 4: No provider found
    logger.warn(`❌ No provider accepted booking ${bookingIdKey} after ${totalBatches} batches`);

    const Booking = getBookingModel();
    await Booking.findByIdAndUpdate(booking._id, {
      $set: { status: 'no_provider_found' },
      $push: {
        statusHistory: {
          status: 'no_provider_found',
          changedAt: new Date(),
          changedBy: 'admin-dispatch',
          reason: `Tried ${triedThisDispatch.size} providers across ${CFG.radiusProgression.join('/')} km — none accepted`,
        },
      },
    });

    dispatchJob.status = 'no_provider_found';
    dispatchJob.completedAt = new Date();
    dispatchJob.nextRunAt = new Date(Date.now() + 60000); // retry in 1 minute
    await dispatchJob.save();

    emitLive('dispatch:no_provider_found', {
      bookingId: booking.bookingId || bookingIdKey,
      triedCount: triedThisDispatch.size,
    });

    await createAdminAlert({
      type: 'no_provider_found',
      title: '⚠️ No Provider Found',
      message: `Booking ${booking.bookingId || bookingIdKey} — ${triedThisDispatch.size} providers tried, none accepted`,
      severity: 'warning',
      bookingId: booking.bookingId || bookingIdKey,
      data: { triedCount: triedThisDispatch.size, batches: totalBatches },
      actionUrl: `/bookings?open=${booking.bookingId || bookingIdKey}`,
    });

    return { ok: true, result: 'no_provider_found' };
  } catch (err) {
    logger.error(`Dispatch error for ${bookingIdKey}: ${err.message}`);
    logger.error(err.stack);
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
 * Manual reassignment triggered by admin
 */
async function manualReassign(bookingId, { reason, actorEmail } = {}) {
  const Booking = getBookingModel();

  let booking;
  if (mongoose.Types.ObjectId.isValid(bookingId)) {
    booking = await Booking.findById(bookingId);
  }
  if (!booking) booking = await Booking.findOne({ bookingId });
  if (!booking) throw new Error('Booking not found');

  // Clear previous assignment (preserve history)
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

  await createAdminAlert({
    type: 'reassignment',
    title: '🔄 Manual Reassignment Triggered',
    message: `Admin ${actorEmail || ''} triggered reassignment for ${booking.bookingId}`,
    severity: 'info',
    bookingId: booking.bookingId,
    data: { previousProviderId, reason },
  });

  // Trigger dispatch (fire & forget)
  dispatchBooking(booking.toObject ? booking.toObject() : booking).catch((e) =>
    logger.error(`Manual dispatch error: ${e.message}`)
  );

  return booking;
}

module.exports = {
  dispatchBooking,
  manualReassign,
  isBookingScheduled,
  CFG,
};