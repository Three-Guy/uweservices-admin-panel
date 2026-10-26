// backend/src/services/dispatchService.js
// ✅ FIXED: Single source of dispatch, cooldown 10 min
// ✅ Supersedes old offers on redispatch
// ✅ Full ProviderOffer tracking
// ✅ REMOVED: no_provider_found admin alert (new_booking only)

const mongoose = require('mongoose');
const { getBookingModel } = require('../config/database');
const ProviderOffer = require('../models/ProviderOffer');
const DispatchJob = require('../models/DispatchJob');
const { findEligibleProviders } = require('./eligibilityService');
const { sendBookingOfferToProvider, sendCancellationToProvider } = require('./fcmService');
const liveEmitter = require('./liveEmitter');
const { createAdminAlert } = require('./adminAlertService');

// ─── CONFIG ───
const CFG = {
  radiusProgression: (process.env.DISPATCH_RADIUS_PROGRESSION || '5,8,12')
    .split(',').map((x) => parseInt(x.trim(), 10)).filter(Boolean),
  batchSize: parseInt(process.env.DISPATCH_BATCH_SIZE || '5', 10),
  requestTimeoutMs: parseInt(process.env.DISPATCH_REQUEST_TIMEOUT_MS || '15000', 10),
  cooldownAfterFailMs: parseInt(process.env.DISPATCH_COOLDOWN_AFTER_FAIL_MS || '600000', 10),
  retryAfterMs: parseInt(process.env.DISPATCH_RETRY_AFTER_MS || '600000', 10),
};

console.log('[DispatchService] Config:', CFG);

const activeDispatches = new Map();
const recentlyFailed = new Map();

function isInCooldown(bookingId) {
  const t = recentlyFailed.get(String(bookingId));
  if (!t) return false;
  const elapsed = Date.now() - t;
  if (elapsed > CFG.cooldownAfterFailMs) {
    recentlyFailed.delete(String(bookingId));
    return false;
  }
  return true;
}

function markFailed(bookingId) { recentlyFailed.set(String(bookingId), Date.now()); }
function clearCooldown(bookingId) { recentlyFailed.delete(String(bookingId)); }
function isActive(bookingId) { return activeDispatches.has(String(bookingId)); }
function markActive(bookingId) { activeDispatches.set(String(bookingId), Date.now()); }
function markInactive(bookingId) { activeDispatches.delete(String(bookingId)); }

function safeEmit(event, payload) {
  try {
    if (liveEmitter && typeof liveEmitter.emitLive === 'function') {
      liveEmitter.emitLive(event, payload);
    } else if (global.emitLive) {
      global.emitLive(event, payload);
    }
  } catch (e) {
    console.warn('[DispatchService] emit error:', e.message);
  }
}

async function supersedeOldOffers(bookingId) {
  try {
    const result = await ProviderOffer.updateMany(
      { bookingId, status: { $in: ['sent', 'delivered', 'viewed'] } },
      {
        $set: {
          status: 'superseded',
          isCurrentOffer: false,
          respondedAt: new Date(),
          reason: 'Superseded by new dispatch cycle',
        },
      }
    );
    if (result.modifiedCount > 0) {
      console.log(`[Dispatch] Superseded ${result.modifiedCount} old offers for ${bookingId}`);
    }
    return result.modifiedCount;
  } catch (e) {
    console.error('[Dispatch] supersedeOldOffers error:', e.message);
    return 0;
  }
}

async function updateBookingStatus(bookingObjectId, status, reason = '', changedBy = 'dispatch_system') {
  const Booking = getBookingModel();
  const update = { status, updatedAt: new Date() };
  const push = {
    statusHistory: { status, changedAt: new Date(), changedBy, reason },
  };
  await Booking.updateOne({ _id: bookingObjectId }, { $set: update, $push: push });
}

async function dispatchBooking(bookingId, { manual = false, forceCycle = false } = {}) {
  const Booking = getBookingModel();

  let booking;
  try {
    booking = await Booking.findOne({
      $or: [
        { _id: mongoose.Types.ObjectId.isValid(bookingId) ? new mongoose.Types.ObjectId(bookingId) : null },
        { bookingId: bookingId },
      ],
    }).lean();
  } catch (e) {
    console.error('[Dispatch] Booking lookup error:', e.message);
    return { success: false, error: 'Booking lookup failed' };
  }

  if (!booking) return { success: false, error: 'Booking not found' };

  const bId = booking.bookingId;
  const bOid = booking._id;

  console.log(`\n[Dispatch] 🚀 Starting dispatch for ${bId} (manual=${manual})`);

  if (isActive(bId) && !manual) {
    console.log(`[Dispatch] ${bId} already in-flight, skipping`);
    return { success: false, error: 'Already dispatching', skipped: true };
  }
  if (isInCooldown(bId) && !manual) {
    console.log(`[Dispatch] ${bId} in cooldown, skipping`);
    return { success: false, error: 'In cooldown', skipped: true };
  }
  if (booking.providerId && !manual && !forceCycle) {
    console.log(`[Dispatch] ${bId} already has provider ${booking.providerId}, skipping`);
    return { success: false, error: 'Already assigned', skipped: true };
  }
  if (['completed', 'cancelled', 'refunded'].includes(booking.status)) {
    console.log(`[Dispatch] ${bId} in terminal status ${booking.status}, skipping`);
    return { success: false, error: `Terminal status: ${booking.status}` };
  }

  markActive(bId);
  await supersedeOldOffers(bId);

  let dispatchJob;
  try {
    dispatchJob = await DispatchJob.create({
      bookingId: bId,
      bookingObjectId: bOid,
      status: 'running',
      cycle: 1,
      startedAt: new Date(),
      isScheduled: booking.bookingType === 'scheduled',
    });
  } catch (e) {
    console.error('[Dispatch] DispatchJob create error:', e.message);
    markInactive(bId);
    return { success: false, error: 'Failed to create dispatch job' };
  }

  await updateBookingStatus(bOid, 'searching', 'Dispatch started');
  safeEmit('dispatch:started', { bookingId: bId, dispatchJobId: dispatchJob._id });
  safeEmit('booking:status_changed', { bookingId: bId, status: 'searching' });

  const triedProviderIds = [];
  const triedProviderObjectIds = [];
  let assignedProvider = null;
  let totalOffersSent = 0;

  for (let radiusIdx = 0; radiusIdx < CFG.radiusProgression.length; radiusIdx++) {
    const radiusKm = CFG.radiusProgression[radiusIdx];
    console.log(`[Dispatch] ${bId} radius ${radiusKm}km`);

    const freshBooking = await Booking.findById(bOid).lean();
    if (!freshBooking) break;
    if (['completed', 'cancelled', 'refunded', 'accepted', 'assigned'].includes(freshBooking.status) && !manual) {
      console.log(`[Dispatch] ${bId} status changed to ${freshBooking.status}, aborting`);
      break;
    }
    if (freshBooking.providerId && !manual) {
      console.log(`[Dispatch] ${bId} got provider ${freshBooking.providerId}, aborting`);
      assignedProvider = { providerId: freshBooking.providerId, name: freshBooking.providerName };
      break;
    }

    const providers = await findEligibleProviders(booking, {
      radiusKm,
      excludeProviderIds: triedProviderObjectIds,
      strict: true,
      debug: true,
    });

    if (providers.length === 0) {
      console.log(`[Dispatch] ${bId} no providers at ${radiusKm}km`);
      continue;
    }

    const batch = providers.slice(0, CFG.batchSize);
    console.log(`[Dispatch] ${bId} sending to ${batch.length} providers at ${radiusKm}km`);

    const offerPromises = batch.map(async (provider, idx) => {
      try {
        const providerIdStr = provider.providerId || String(provider._id);
        triedProviderIds.push(providerIdStr);
        triedProviderObjectIds.push(provider._id);

        const offerDoc = await ProviderOffer.create({
          bookingId: bId,
          bookingObjectId: bOid,
          providerId: providerIdStr,
          providerObjectId: provider._id,
          providerName: provider.name || 'Unknown',
          providerPhone: provider.phone || '',
          providerCategory: provider.profession || provider.categoryName || '',
          providerCity: provider.city || '',
          status: 'sent',
          offeredAt: new Date(),
          expiresAt: new Date(Date.now() + CFG.requestTimeoutMs),
          dispatchCycle: dispatchJob.cycle,
          batchNumber: radiusIdx + 1,
          radiusKm,
          distanceKm: provider._distanceKm || 0,
          isCurrentOffer: true,
          isScheduled: booking.bookingType === 'scheduled',
          bookingSnapshot: {
            serviceName: booking.serviceName,
            totalAmount: booking.totalAmount,
            address: booking.address,
            scheduledDate: booking.scheduledDate,
            scheduledTime: booking.scheduledTime,
          },
          fcmSent: false,
        });

        totalOffersSent++;

        try {
          const fcmResult = await sendBookingOfferToProvider(provider, booking, {
            offerId: String(offerDoc._id),
            expiresAt: offerDoc.expiresAt,
            distanceKm: provider._distanceKm,
          });
          offerDoc.fcmSent = fcmResult.success;
          offerDoc.fcmMessageId = fcmResult.messageId || null;
          offerDoc.fcmError = fcmResult.error || null;
          if (fcmResult.success) {
            offerDoc.status = 'delivered';
            offerDoc.deliveredAt = new Date();
          }
          await offerDoc.save();
        } catch (fcmErr) {
          console.error(`[Dispatch] FCM error for provider ${providerIdStr}:`, fcmErr.message);
          offerDoc.fcmSent = false;
          offerDoc.fcmError = fcmErr.message;
          await offerDoc.save();
        }

        safeEmit('dispatch:offer_sent', {
          bookingId: bId,
          providerId: providerIdStr,
          providerName: provider.name,
          distanceKm: provider._distanceKm,
        });

        return offerDoc;
      } catch (e) {
        console.error(`[Dispatch] Offer creation error:`, e.message);
        return null;
      }
    });

    await Promise.all(offerPromises);

    await DispatchJob.updateOne(
      { _id: dispatchJob._id },
      {
        $set: {
          currentRadiusKm: radiusKm,
          batchNumber: radiusIdx + 1,
          totalProvidersConsidered: triedProviderIds.length,
          totalOffersSent,
          triedProviderIds,
        },
      }
    );

    const waitStart = Date.now();
    while (Date.now() - waitStart < CFG.requestTimeoutMs) {
      await new Promise((r) => setTimeout(r, 1500));

      const acceptedOffer = await ProviderOffer.findOne({
        bookingId: bId,
        dispatchCycle: dispatchJob.cycle,
        batchNumber: radiusIdx + 1,
        status: 'accepted',
      }).lean();

      if (acceptedOffer) {
        console.log(`[Dispatch] ✅ ${bId} accepted by ${acceptedOffer.providerId}`);
        assignedProvider = {
          providerId: acceptedOffer.providerId,
          providerObjectId: acceptedOffer.providerObjectId,
          name: acceptedOffer.providerName,
          phone: acceptedOffer.providerPhone,
        };
        break;
      }

      const chk = await Booking.findById(bOid).lean();
      if (chk && chk.providerId && !assignedProvider) {
        assignedProvider = {
          providerId: chk.providerId,
          name: chk.providerName,
          phone: chk.providerPhone,
        };
        break;
      }
    }

    if (assignedProvider) break;

    await ProviderOffer.updateMany(
      {
        bookingId: bId,
        dispatchCycle: dispatchJob.cycle,
        batchNumber: radiusIdx + 1,
        status: { $in: ['sent', 'delivered', 'viewed'] },
      },
      {
        $set: {
          status: 'timeout',
          respondedAt: new Date(),
          reason: 'No response within window',
          isCurrentOffer: false,
        },
      }
    );
  }

  if (assignedProvider) {
    await Booking.updateOne(
      { _id: bOid },
      {
        $set: {
          providerId: assignedProvider.providerId,
          providerName: assignedProvider.name || null,
          providerPhone: assignedProvider.phone || null,
          assignedAt: new Date(),
          dispatchCompletedAt: new Date(),
          status: 'accepted',
        },
        $push: {
          statusHistory: {
            status: 'accepted',
            changedAt: new Date(),
            changedBy: 'dispatch_system',
            reason: `Accepted by ${assignedProvider.name}`,
          },
        },
      }
    );

    await DispatchJob.updateOne(
      { _id: dispatchJob._id },
      {
        $set: {
          status: 'completed',
          completedAt: new Date(),
          assignedProviderId: assignedProvider.providerId,
        },
      }
    );

    clearCooldown(bId);
    markInactive(bId);

    safeEmit('dispatch:assigned', {
      bookingId: bId,
      providerId: assignedProvider.providerId,
      providerName: assignedProvider.name,
    });
    safeEmit('booking:status_changed', { bookingId: bId, status: 'accepted' });

    try {
      await createAdminAlert('booking_assigned', {
        title: '✅ Provider Assigned',
        message: `${assignedProvider.name} accepted booking ${bId}`,
        severity: 'success',
        bookingId: bId,
        providerId: assignedProvider.providerId,
        actionUrl: `/bookings?open=${bId}`,
        actionLabel: 'View Booking',
      });
    } catch (e) {
      console.warn('[Dispatch] admin alert error:', e.message);
    }

    return { success: true, assignedProvider };
  }

  // ─── No provider found ───
  console.log(`[Dispatch] ❌ ${bId} no provider found after ${totalOffersSent} offers`);

  await updateBookingStatus(bOid, 'no_provider_found', `Tried ${totalOffersSent} providers, none accepted`);

  await DispatchJob.updateOne(
    { _id: dispatchJob._id },
    {
      $set: {
        status: 'no_provider_found',
        completedAt: new Date(),
        totalOffersSent,
        totalProvidersConsidered: triedProviderIds.length,
      },
    }
  );

  markFailed(bId);
  markInactive(bId);

  // Socket emit (silent — doesn't trigger notification bell)
  safeEmit('dispatch:no_provider_found', { bookingId: bId, totalOffersSent });
  safeEmit('booking:status_changed', { bookingId: bId, status: 'no_provider_found' });

  // ❌ NO admin alert — user requested removal
  // (createAdminAlert('no_provider_found', ...) deleted on purpose)

  return { success: false, error: 'No provider accepted', totalOffersSent };
}

async function manualReassign(bookingId, reason = 'Admin reassignment') {
  const Booking = getBookingModel();

  const booking = await Booking.findOne({
    $or: [
      { _id: mongoose.Types.ObjectId.isValid(bookingId) ? new mongoose.Types.ObjectId(bookingId) : null },
      { bookingId: bookingId },
    ],
  }).lean();

  if (!booking) return { success: false, error: 'Booking not found' };

  await supersedeOldOffers(booking.bookingId);

  await Booking.updateOne(
    { _id: booking._id },
    {
      $set: {
        providerId: null,
        providerName: null,
        providerPhone: null,
        assignedAt: null,
        status: 'confirmed',
      },
      $push: {
        statusHistory: {
          status: 'confirmed',
          changedAt: new Date(),
          changedBy: 'admin',
          reason: `Reassignment: ${reason}`,
        },
      },
    }
  );

  clearCooldown(booking.bookingId);
  markInactive(booking.bookingId);

  if (booking.providerId) {
    try {
      await sendCancellationToProvider(booking.providerId, booking, reason);
    } catch (e) {
      console.warn('[Dispatch] cancel notify error:', e.message);
    }
  }

  safeEmit('booking:status_changed', { bookingId: booking.bookingId, status: 'confirmed' });

  setImmediate(() => {
    dispatchBooking(booking.bookingId, { manual: true, forceCycle: true }).catch((e) => {
      console.error('[Dispatch] Reassign-triggered dispatch error:', e.message);
    });
  });

  return { success: true, bookingId: booking.bookingId };
}

async function manualAssignProvider(bookingId, providerId) {
  const Booking = getBookingModel();
  const { getProviderConnection } = require('../config/database');
  const providerColl = getProviderConnection().collection('providers');

  const booking = await Booking.findOne({
    $or: [
      { _id: mongoose.Types.ObjectId.isValid(bookingId) ? new mongoose.Types.ObjectId(bookingId) : null },
      { bookingId: bookingId },
    ],
  }).lean();
  if (!booking) return { success: false, error: 'Booking not found' };

  let provider = null;
  try {
    provider = await providerColl.findOne({
      $or: [
        { providerId: providerId },
        ...(mongoose.Types.ObjectId.isValid(providerId)
          ? [{ _id: new mongoose.Types.ObjectId(providerId) }]
          : []),
      ],
    });
  } catch (e) {}

  if (!provider) return { success: false, error: 'Provider not found' };

  await supersedeOldOffers(booking.bookingId);

  const offer = await ProviderOffer.create({
    bookingId: booking.bookingId,
    bookingObjectId: booking._id,
    providerId: provider.providerId || String(provider._id),
    providerObjectId: provider._id,
    providerName: provider.name,
    providerPhone: provider.phone || '',
    providerCategory: provider.profession || provider.categoryName || '',
    providerCity: provider.city || '',
    status: 'sent',
    offeredAt: new Date(),
    expiresAt: new Date(Date.now() + CFG.requestTimeoutMs),
    dispatchCycle: 1,
    batchNumber: 1,
    radiusKm: 999,
    distanceKm: 0,
    isCurrentOffer: true,
    isScheduled: booking.bookingType === 'scheduled',
    ProviderOffer.findOne({
        bookingId: bId,
        dispatchCycle: dispatchJob.cycle,
        batchNumber: radiusIdx + 1,
        status: 'accepted',
      }).lean();

      if (acceptedOffer) {
        console.log(`[Dispatch] ✅ ${bId} accepted by ${acceptedOffer.providerId}`);
        assignedProvider = {
          providerId: acceptedOffer.providerId,
          providerObjectId: acceptedOffer.providerObjectId,
          name: acceptedOffer.providerName,
          phone: acceptedOffer.providerPhone,
        };
        break;
      }

      const chk = await Booking.findById(bOid).lean();
      if (chk && chk.providerId && !assignedProvider) {
        assignedProvider = {
          providerId: chk.providerId,
          name: chk.providerName,
          phone: chk.providerPhone,
        };
        break;
      }
    }

    if (assignedProvider) break;

    await ProviderOffer.updateMany(
      {
        bookingId: bId,
        dispatchCycle: dispatchJob.cycle,
        batchNumber: radiusIdx + 1,
        status: { $in: ['sent', 'delivered', 'viewed'] },
      },
      {
        $set: {
          status: 'timeout',
          respondedAt: new Date(),
          reason: 'No response within window',
          isCurrentOffer: false,
        },
      }
    );
  }

  if (assignedProvider) {
    await Booking.updateOne(
      { _id: bOid },
      {
        $set: {
          providerId: assignedProvider.providerId,
          providerName: assignedProvider.name || null,
          providerPhone: assignedProvider.phone || null,
          assignedAt: new Date(),
          dispatchCompletedAt: new Date(),
          status: 'accepted',
        },
        $push: {
          statusHistory: {
            status: 'accepted',
            changedAt: new Date(),
            changedBy: 'dispatch_system',
            reason: `Accepted by ${assignedProvider.name}`,
          },
        },
      }
    );

    await DispatchJob.updateOne(
      { _id: dispatchJob._id },
      {
        $set: {
          status: 'completed',
          completedAt: new Date(),
          assignedProviderId: assignedProvider.providerId,
        },
      }
    );

    clearCooldown(bId);
    markInactive(bId);

    safeEmit('dispatch:assigned', {
      bookingId: bId,
      providerId: assignedProvider.providerId,
      providerName: assignedProvider.name,
    });
    safeEmit('booking:status_changed', { bookingId: bId, status: 'accepted' });

    // ✅ Still send "booking_assigned" admin alert (silent — not blocked by filter)
    try {
      await createAdminAlert('booking_assigned', {
        title: '✅ Provider Assigned',
        message: `${assignedProvider.name} accepted booking ${bId}`,
        severity: 'success',
        bookingId: bId,
        providerId: assignedProvider.providerId,
        actionUrl: `/bookings?open=${bId}`,
        actionLabel: 'View Booking',
      });
    } catch (e) {
      console.warn('[Dispatch] admin alert error:', e.message);
    }

    return { success: true, assignedProvider };
  }

  // ─── NO PROVIDER FOUND ───
  console.log(`[Dispatch] ❌ ${bId} no provider found after ${totalOffersSent} offers`);

  await updateBookingStatus(bOid, 'no_provider_found', `Tried ${totalOffersSent} providers, none accepted`);

  await DispatchJob.updateOne(
    { _id: dispatchJob._id },
    {
      $set: {
        status: 'no_provider_found',
        completedAt: new Date(),
        totalOffersSent,
        totalProvidersConsidered: triedProviderIds.length,
      },
    }
  );

  markFailed(bId);
  markInactive(bId);

  // ✅ Still emit socket for admin dispatch dashboard (if any dashboard listens)
  safeEmit('dispatch:no_provider_found', {
    bookingId: bId,
    totalOffersSent,
  });
  safeEmit('booking:status_changed', { bookingId: bId, status: 'no_provider_found' });

  // ❌ REMOVED: createAdminAlert('no_provider_found', ...) — no more annoying notification!
  // Status update + DispatchJob record still exist for audit; admin can see it in dispatch dashboard
  console.log(`[Dispatch] 🔕 No admin notification sent (silenced by user request)`);

  return { success: false, error: 'No provider accepted', totalOffersSent };
}

async function manualReassign(bookingId, reason = 'Admin reassignment') {
  const Booking = getBookingModel();

  const booking = await Booking.findOne({
    $or: [
      { _id: mongoose.Types.ObjectId.isValid(bookingId) ? new mongoose.Types.ObjectId(bookingId) : null },
      { bookingId: bookingId },
    ],
  }).lean();

  if (!booking) return { success: false, error: 'Booking not found' };

  await supersedeOldOffers(booking.bookingId);

  await Booking.updateOne(
    { _id: booking._id },
    {
      $set: {
        providerId: null,
        providerName: null,
        providerPhone: null,
        assignedAt: null,
        status: 'confirmed',
      },
      $push: {
        statusHistory: {
          status: 'confirmed',
          changedAt: new Date(),
          changedBy: 'admin',
          reason: `Reassignment: ${reason}`,
        },
      },
    }
  );

  clearCooldown(booking.bookingId);
  markInactive(booking.bookingId);

  if (booking.providerId) {
    try {
      await sendCancellationToProvider(booking.providerId, booking, reason);
    } catch (e) {
      console.warn('[Dispatch] cancel notify error:', e.message);
    }
  }

  safeEmit('booking:status_changed', { bookingId: booking.bookingId, status: 'confirmed' });

  setImmediate(() => {
    dispatchBooking(booking.bookingId, { manual: true, forceCycle: true }).catch((e) => {
      console.error('[Dispatch] Reassign-triggered dispatch error:', e.message);
    });
  });

  return { success: true, bookingId: booking.bookingId };
}

async function manualAssignProvider(bookingId, providerId) {
  const Booking = getBookingModel();
  const { getProviderConnection } = require('../config/database');
  const providerColl = getProviderConnection().collection('providers');

  const booking = await Booking.findOne({
    $or: [
      { _id: mongoose.Types.ObjectId.isValid(bookingId) ? new mongoose.Types.ObjectId(bookingId) : null },
      { bookingId: bookingId },
    ],
  }).lean();
  if (!booking) return { success: false, error: 'Booking not found' };

  let provider = null;
  try {
    provider = await providerColl.findOne({
      $or: [
        { providerId: providerId },
        ...(mongoose.Types.ObjectId.isValid(providerId)
          ? [{ _id: new mongoose.Types.ObjectId(providerId) }]
          : []),
      ],
    });
  } catch (e) {}

  if (!provider) return { success: false, error: 'Provider not found' };

  await supersedeOldOffers(booking.bookingId);

  const offer = await ProviderOffer.create({
    bookingId: booking.bookingId,
    bookingObjectId: booking._id,
    providerId: provider.providerId || String(provider._id),
    providerObjectId: provider._id,
    providerName: provider.name,
    providerPhone: provider.phone || '',
    providerCategory: provider.profession || provider.categoryName || '',
    providerCity: provider.city || '',
    status: 'sent',
    offeredAt: new Date(),
    expiresAt: new Date(Date.now() + CFG.requestTimeoutMs),
    dispatchCycle: 1,
    batchNumber: 1,
    radiusKm: 999,
    distanceKm: 0,
    isCurrentOffer: true,
    isScheduled: booking.bookingType === 'scheduled',
    fcmSent: false,
  });

  await Booking.updateOne(
    { _id: booking._id },
    {
      $set: {
        providerId: provider.providerId || String(provider._id),
        providerName: provider.name,
        providerPhone: provider.phone || null,
        assignedAt: new Date(),
        assignmentMethod: 'manual-admin',
        status: 'assigned',
      },
      $push: {
        statusHistory: {
          status: 'assigned',
          changedAt: new Date(),
          changedBy: 'admin',
          reason: `Manually assigned to ${provider.name}`,
        },
      },
    }
  );

  try {
    const fcmResult = await sendBookingOfferToProvider(provider, booking, {
      offerId: String(offer._id),
      expiresAt: offer.expiresAt,
      distanceKm: 0,
      isManual: true,
    });
    offer.fcmSent = fcmResult.success;
    offer.fcmMessageId = fcmResult.messageId || null;
    offer.fcmError = fcmResult.error || null;
    if (fcmResult.success) {
      offer.status = 'delivered';
      offer.deliveredAt = new Date();
    }
    await offer.save();
  } catch (e) {
    console.error('[Dispatch] FCM error on manual assign:', e.message);
  }

  clearCooldown(booking.bookingId);

  safeEmit('dispatch:assigned', {
    bookingId: booking.bookingId,
    providerId: provider.providerId || String(provider._id),
    providerName: provider.name,
    manual: true,
  });

  return { success: true, provider: { id: provider.providerId, name: provider.name } };
}

module.exports = {
  dispatchBooking,
  manualReassign,
  manualAssignProvider,
  supersedeOldOffers,
  isInCooldown,
  clearCooldown,
  CFG,
};