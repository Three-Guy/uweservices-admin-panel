// backend/src/controllers/dispatch.controller.js
// ✅ Safe model loading — handles broken imports gracefully
const mongoose = require('mongoose');

/* ─── SAFE MODEL LOADER ─── */
function safeLoadModel(modelPath, modelName, collection) {
  try {
    const mod = require(modelPath);
    let M = mod?.[modelName] || mod?.default || mod;
    if (M && typeof M.find === 'function') {
      console.log(`[DispatchCtrl] ✅ ${modelName} loaded`);
      return M;
    }
    throw new Error(`${modelName} import invalid`);
  } catch (e) {
    console.error(`[DispatchCtrl] ⚠️ ${modelName} fallback:`, e.message);
    try {
      return mongoose.model(modelName);
    } catch {
      const schema = new mongoose.Schema({}, { strict: false, collection });
      return mongoose.model(modelName, schema);
    }
  }
}

const Booking = safeLoadModel('../models/Booking', 'Booking', 'bookings');
const DispatchJob = safeLoadModel('../models/DispatchJob', 'DispatchJob', 'dispatchjobs');
const ProviderOffer = safeLoadModel('../models/ProviderOffer', 'ProviderOffer', 'provideroffers');

/* ─── Services (safe load) ─── */
let dispatchService = {};
try { dispatchService = require('../services/dispatchService'); } catch (e) {
  console.error('[DispatchCtrl] dispatchService load error:', e.message);
}

let eligibilityService = {};
try { eligibilityService = require('../services/eligibilityService'); } catch (e) {
  console.error('[DispatchCtrl] eligibilityService load error:', e.message);
}

/* ─── Helpers ─── */
const ok = (res, data, extra = {}) => res.json({ success: true, data, ...extra });

const fail = (res, err, code = 500) => {
  const msg = err?.message || String(err) || 'Internal error';
  console.error('[DispatchController]', msg);
  return res.status(code).json({ success: false, message: msg });
};

const safeCount = async (model, query = {}) => {
  if (!model || typeof model.countDocuments !== 'function') return 0;
  try { return await model.countDocuments(query); } catch { return 0; }
};

const safeFind = async (model, query = {}, opts = {}) => {
  if (!model || typeof model.find !== 'function') return [];
  try {
    let q = model.find(query);
    if (opts.sort) q = q.sort(opts.sort);
    if (opts.limit) q = q.limit(opts.limit);
    if (opts.skip) q = q.skip(opts.skip);
    if (opts.select) q = q.select(opts.select);
    if (opts.lean !== false) q = q.lean();
    return await q;
  } catch (e) {
    console.error('[safeFind] error:', e.message);
    return [];
  }
};

/* ══════════════════════════════════════════════════════════════
   GET /stats
   ══════════════════════════════════════════════════════════════ */
exports.getStats = async (req, res) => {
  try {
    const [activeDispatches, queuedJobs, recentFailures, noProviderFound] = await Promise.all([
      safeCount(DispatchJob, { status: 'running' }),
      safeCount(DispatchJob, { status: 'queued' }),
      safeCount(DispatchJob, {
        status: 'no_provider_found',
        updatedAt: { $gte: new Date(Date.now() - 60 * 60 * 1000) },
      }),
      safeCount(Booking, { status: 'no_provider_found' }),
    ]);

    const offers24h = await safeFind(
      ProviderOffer,
      { createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
      { select: 'status' }
    );

    const cooldownBookings = await safeCount(Booking, {
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
    const acceptRate24h = total24h > 0 ? (breakdown24h.accepted / total24h) * 100 : 0;

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
   GET /active
   ══════════════════════════════════════════════════════════════ */
exports.getActiveDispatches = async (req, res) => {
  try {
    const jobs = await safeFind(
      DispatchJob,
      { status: { $in: ['running', 'queued'] } },
      { sort: { createdAt: -1 }, limit: 50 }
    );

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
    const bookings = await safeFind(
      Booking,
      { status: 'no_provider_found' },
      { sort: { updatedAt: -1 }, limit: 100 }
    );
    return ok(res, bookings);
  } catch (err) {
    return fail(res, err);
  }
};

/* ══════════════════════════════════════════════════════════════
   GET /unassigned
   ══════════════════════════════════════════════════════════════ */
exports.getUnassignedBookings = async (req, res) => {
  try {
    const bookings = await safeFind(
      Booking,
      {
        status: { $in: ['confirmed', 'searching', 'no_provider_found', 'pending'] },
        $or: [{ providerId: null }, { providerId: { $exists: false } }, { providerId: '' }],
      },
      { sort: { createdAt: -1 }, limit: 100 }
    );

    const ids = bookings.map((b) => b.bookingId).filter(Boolean);
    const offers = ids.length
      ? await safeFind(ProviderOffer, { bookingId: { $in: ids } }, { sort: { sentAt: -1 } })
      : [];

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
    if (!Booking || typeof Booking.findOne !== 'function') {
      return fail(res, new Error('Booking model unavailable'));
    }
    const booking = await Booking.findOne({ bookingId }).lean();
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

    if (typeof eligibilityService.findEligibleProviders !== 'function') {
      return ok(res, []);
    }
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
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

    if (typeof eligibilityService.debugEligibility === 'function') {
      const result = await eligibilityService.debugEligibility(booking);
      return ok(res, result);
    }

    const providers = typeof eligibilityService.findEligibleProviders === 'function'
      ? await eligibilityService.findEligibleProviders(booking)
      : [];
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
    if (typeof dispatchService.dispatchBooking !== 'function') {
      return fail(res, new Error('dispatchService.dispatchBooking unavailable'));
    }
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
    if (typeof dispatchService.manualReassign !== 'function') {
      return fail(res, new Error('manualReassign unavailable'));
    }
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

    if (ProviderOffer && typeof ProviderOffer.updateMany === 'function') {
      await ProviderOffer.updateMany(
        { bookingId, status: { $in: ['pending', 'sent', 'failed'] } },
        { $set: { status: 'superseded', supersededBy: 'auto_redispatch' } }
      );
    }

    if (Booking && typeof Booking.updateOne === 'function') {
      await Booking.updateOne(
        { bookingId },
        { $set: { status: 'confirmed', providerId: null } }
      );
    }

    if (typeof dispatchService.clearCooldown === 'function') {
      dispatchService.clearCooldown(bookingId);
    }

    const result = typeof dispatchService.dispatchBooking === 'function'
      ? await dispatchService.dispatchBooking(bookingId, { manual: true, reason: 'auto_redispatch' })
      : { message: 'dispatch service unavailable' };

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
    if (!providerId) {
      return res.status(400).json({ success: false, message: 'providerId required' });
    }
    if (typeof dispatchService.manualAssignProvider !== 'function') {
      return fail(res, new Error('manualAssignProvider unavailable'));
    }
    const result = await dispatchService.manualAssignProvider(bookingId, providerId);
    return ok(res, result);
  } catch (err) {
    return fail(res, err);
  }
};