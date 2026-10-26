// backend/src/controllers/dispatch.controller.js
const DispatchJob = require('../models/DispatchJob');
const ProviderOffer = require('../models/ProviderOffer');
const Booking = require('../models/Booking');

const dispatchService = require('../services/dispatchService');
const eligibilityService = require('../services/eligibilityService');

/* ─── small helpers ─────────────────────────────────────────── */
const ok = (res, data, extra = {}) =>
  res.json({ success: true, data, ...extra });

const fail = (res, err, code = 500) => {
  const msg = err?.message || String(err) || 'Internal error';
  console.error('[DispatchController]', msg);
  return res.status(code).json({ success: false, message: msg });
};

/* ══════════════════════════════════════════════════════════════
   GET /stats  — live dispatch engine stats
   ══════════════════════════════════════════════════════════════ */
exports.getStats = async (req, res) => {
  try {
    const [
      activeDispatches,
      queuedJobs,
      recentFailures,
      noProviderFound,
      offers24h,
    ] = await Promise.all([
      DispatchJob.countDocuments({ status: 'running' }),
      DispatchJob.countDocuments({ status: 'queued' }),
      DispatchJob.countDocuments({
        status: 'no_provider_found',
        updatedAt: { $gte: new Date(Date.now() - 60 * 60 * 1000) },
      }),
      Booking.countDocuments({ status: 'no_provider_found' }),
      ProviderOffer.find({
        createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      }).select('status').lean(),
    ]);

    // Cooldowns = unique bookings currently in no_provider_found with recent fail
    const cooldownBookings = await Booking.countDocuments({
      status: 'no_provider_found',
      updatedAt: { $gte: new Date(Date.now() - 10 * 60 * 1000) },
    });

    const total24h = offers24h.length;
    const breakdown24h = {
      total: total24h,
      accepted: offers24h.filter((o) => o.status === 'accepted').length,
      rejected: offers24h.filter((o) => o.status === 'rejected').length,
      expired: offers24h.filter((o) => o.status === 'expired').length,
      failed: offers24h.filter((o) => o.status === 'failed').length,
      noProvider: 0,
    };
    const acceptRate24h =
      total24h > 0 ? (breakdown24h.accepted / total24h) * 100 : 0;

    return ok(res, {
      activeDispatches,
      queuedJobs,
      recentFailures,
      noProviderFoundTotal: noProviderFound,
      cooldowns: cooldownBookings,
      acceptRate24h,
      breakdown24h,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return fail(res, err);
  }
};

/* ══════════════════════════════════════════════════════════════
   GET /active — currently running dispatches
   ══════════════════════════════════════════════════════════════ */
exports.getActiveDispatches = async (req, res) => {
  try {
    const jobs = await DispatchJob.find({
      status: { $in: ['running', 'queued'] },
    })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    const data = jobs.map((j) => ({
      bookingId: j.bookingId,
      startedAt: j.createdAt,
      status: j.status,
      cycle: j.currentCycle,
      batch: j.currentBatch,
      currentRadius: j.currentRadiusKm,
      attempt: j.attempts,
      reason: j.reason,
    }));

    return ok(res, data);
  } catch (err) {
    return fail(res, err);
  }
};

/* ══════════════════════════════════════════════════════════════
   GET /no-provider-found
   ══════════════════════════════════════════════════════════════ */
exports.getNoProviderBookings = async (req, res) => {
  try {
    const bookings = await Booking.find({ status: 'no_provider_found' })
      .sort({ updatedAt: -1 })
      .limit(100)
      .lean();
    return ok(res, bookings);
  } catch (err) {
    return fail(res, err);
  }
};

/* ══════════════════════════════════════════════════════════════
   GET /unassigned — confirmed / searching / no_provider_found
   ══════════════════════════════════════════════════════════════ */
exports.getUnassignedBookings = async (req, res) => {
  try {
    const bookings = await Booking.find({
      status: { $in: ['confirmed', 'searching', 'no_provider_found', 'pending'] },
      $or: [{ providerId: null }, { providerId: { $exists: false } }],
    })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    // Attach offer trail per booking
    const ids = bookings.map((b) => b.bookingId);
    const offers = await ProviderOffer.find({ bookingId: { $in: ids } })
      .sort({ sentAt: -1 })
      .lean();

    const offerMap = {};
    offers.forEach((o) => {
      if (!offerMap[o.bookingId]) offerMap[o.bookingId] = [];
      offerMap[o.bookingId].push({
        providerId: o.providerId,
        providerName: o.providerName,
        status: o.status,
        sentAt: o.sentAt,
        respondedAt: o.respondedAt,
        distanceKm: o.distanceKm,
        fcmSent: o.fcmSent,
      });
    });

    const enriched = bookings.map((b) => ({
      ...b,
      offers: offerMap[b.bookingId] || [],
      offerCount: (offerMap[b.bookingId] || []).length,
    }));

    return ok(res, enriched);
  } catch (err) {
    return fail(res, err);
  }
};

/* ══════════════════════════════════════════════════════════════
   GET /eligible-providers/:bookingId
   ══════════════════════════════════════════════════════════════ */
exports.getEligibleProviders = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const booking = await Booking.findOne({ bookingId }).lean();
    if (!booking)
      return res
        .status(404)
        .json({ success: false, message: 'Booking not found' });

    const providers = await eligibilityService.findEligibleProviders(booking);
    return ok(res, providers);
  } catch (err) {
    return fail(res, err);
  }
};

/* ══════════════════════════════════════════════════════════════
   GET /eligible-providers-debug/:bookingId
   ══════════════════════════════════════════════════════════════ */
exports.getEligibleProvidersDebug = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const booking = await Booking.findOne({ bookingId }).lean();
    if (!booking)
      return res
        .status(404)
        .json({ success: false, message: 'Booking not found' });

    if (typeof eligibilityService.debugEligibility === 'function') {
      const result = await eligibilityService.debugEligibility(booking);
      return ok(res, result);
    }

    // Fallback
    const providers = await eligibilityService.findEligibleProviders(booking);
    return ok(res, { booking, eligibleCount: providers.length, providers });
  } catch (err) {
    return fail(res, err);
  }
};

/* ══════════════════════════════════════════════════════════════
   POST /trigger/:bookingId
   ══════════════════════════════════════════════════════════════ */
exports.triggerDispatch = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const result = await dispatchService.dispatchBooking(bookingId, {
      manual: true,
      reason: 'manual_trigger',
    });
    return ok(res, result);
  } catch (err) {
    return fail(res, err);
  }
};

/* ══════════════════════════════════════════════════════════════
   POST /reassign/:bookingId
   ══════════════════════════════════════════════════════════════ */
exports.reassignBooking = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { providerId } = req.body || {};
    const result = await dispatchService.manualReassign(bookingId, providerId);
    return ok(res, result);
  } catch (err) {
    return fail(res, err);
  }
};

/* ══════════════════════════════════════════════════════════════
   POST /auto-redispatch/:bookingId
   ══════════════════════════════════════════════════════════════ */
exports.autoRedispatch = async (req, res) => {
  try {
    const { bookingId } = req.params;

    // 1. Supersede old offers
    await ProviderOffer.updateMany(
      { bookingId, status: { $in: ['pending', 'sent', 'failed'] } },
      { $set: { status: 'superseded', supersededBy: 'auto_redispatch' } }
    );

    // 2. Reset booking status
    await Booking.updateOne(
      { bookingId },
      { $set: { status: 'confirmed', providerId: null } }
    );

    // 3. Clear cooldown in dispatch service memory
    if (typeof dispatchService.clearCooldown === 'function') {
      dispatchService.clearCooldown(bookingId);
    }

    // 4. Trigger fresh dispatch
    const result = await dispatchService.dispatchBooking(bookingId, {
      manual: true,
      reason: 'auto_redispatch',
    });

    return ok(res, result);
  } catch (err) {
    return fail(res, err);
  }
};

/* ══════════════════════════════════════════════════════════════
   POST /assign-manual/:bookingId
   ══════════════════════════════════════════════════════════════ */
exports.assignProviderManually = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { providerId } = req.body || {};
    if (!providerId)
      return res
        .status(400)
        .json({ success: false, message: 'providerId required' });

    const result = await dispatchService.manualAssignProvider(
      bookingId,
      providerId
    );
    return ok(res, result);
  } catch (err) {
    return fail(res, err);
  }
};