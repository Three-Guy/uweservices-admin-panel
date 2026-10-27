// backend/src/controllers/manualDispatch.controller.js
// ══════════════════════════════════════════════════════════════
//  MANUAL DISPATCH CONTROLLER
//  - List ALL online providers (available to assign)
//  - List all dispatchable bookings
//  - Admin manually sends full-screen alarm FCM to specific provider
//  - Zero changes to Provider App / Service Provider Backend
// ══════════════════════════════════════════════════════════════

const mongoose = require('mongoose');
const { getProviderConnection } = require('../config/database');

/* ─── SAFE MODEL LOADER (same pattern as dispatch.controller.js) ─── */
function safeLoadModel(modelPath, modelName, collection) {
  try {
    const mod = require(modelPath);
    let M = mod?.[modelName] || mod?.default || mod;
    if (M && typeof M.find === 'function') {
      console.log(`[ManualDispatchCtrl] ✅ ${modelName} loaded`);
      return M;
    }
    throw new Error(`${modelName} import invalid`);
  } catch (e) {
    console.error(`[ManualDispatchCtrl] ⚠️ ${modelName} fallback:`, e.message);
    try {
      return mongoose.model(modelName);
    } catch {
      const schema = new mongoose.Schema({}, { strict: false, collection });
      return mongoose.model(modelName, schema);
    }
  }
}

const Booking = safeLoadModel('../models/Booking', 'Booking', 'bookings');
const ProviderOffer = safeLoadModel('../models/ProviderOffer', 'ProviderOffer', 'provideroffers');
const DispatchJob = safeLoadModel('../models/DispatchJob', 'DispatchJob', 'dispatchjobs');

/* ─── Services (safe load) ─── */
let dispatchService = {};
try { dispatchService = require('../services/dispatchService'); } catch (e) {
  console.error('[ManualDispatchCtrl] dispatchService load error:', e.message);
}

let fcmService = {};
try { fcmService = require('../services/fcmService'); } catch (e) {
  console.error('[ManualDispatchCtrl] fcmService load error:', e.message);
}

let liveEmitter = {};
try { liveEmitter = require('../services/liveEmitter'); } catch (e) {
  console.warn('[ManualDispatchCtrl] liveEmitter not available:', e.message);
}

/* ─── Config ─── */
const MANUAL_DISPATCH_TIMEOUT_MS = parseInt(process.env.MANUAL_DISPATCH_TIMEOUT_MS || '30000', 10);
const ADMIN_SECRET = process.env.ADMIN_SECRET_KEY || 'uwe_admin_super_secret_2026';

/* ─── Helpers ─── */
const ok = (res, data, extra = {}) => res.json({ success: true, data, ...extra });

const fail = (res, err, code = 500) => {
  const msg = err?.message || String(err) || 'Internal error';
  console.error('[ManualDispatchCtrl]', msg);
  return res.status(code).json({ success: false, message: msg });
};

function safeEmit(event, payload) {
  try {
    if (liveEmitter && typeof liveEmitter.emitLive === 'function') {
      liveEmitter.emitLive(event, payload);
    }
  } catch (e) {
    console.warn('[ManualDispatchCtrl] emit error:', e.message);
  }
}

/* ══════════════════════════════════════════════════════════════
   GET /admin/manual-dispatch/online-providers
   ──────────────────────────────────────────────────────────────
   Returns ALL providers currently online/available/accepting jobs
   NO category/city filter — admin sees everyone they can assign
   ══════════════════════════════════════════════════════════════ */
exports.getOnlineProviders = async (req, res) => {
  try {
    const providerColl = getProviderConnection().collection('providers');

    // Default view: online providers only
    // Pass ?all=1 to include everyone (even offline, for emergency assign)
    const includeAll = String(req.query.all || '').trim() === '1';
    const search = String(req.query.search || '').trim();
    const categoryFilter = String(req.query.category || '').trim();

    const andClauses = [
      { isActive: { $ne: false } },
      { isDeleted: { $ne: true } },
      { isBlocked: { $ne: true } },
      { fcmToken: { $exists: true, $ne: null, $ne: '' } },
    ];

    if (!includeAll) {
      // Only truly online providers
      andClauses.push({ isAvailable: true });
      andClauses.push({ isAcceptingJobs: true });
      andClauses.push({ isBusy: { $ne: true } });
    }

    if (search) {
      const safe = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(safe, 'i');
      andClauses.push({
        $or: [
          { name: regex },
          { phone: regex },
          { email: regex },
          { providerId: regex },
          { profession: regex },
        ],
      });
    }

    if (categoryFilter) {
      const safe = categoryFilter.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(safe, 'i');
      andClauses.push({
        $or: [
          { profession: regex },
          { categoryName: regex },
        ],
      });
    }

    const query = { $and: andClauses };

    const providers = await providerColl
      .find(query, {
        projection: {
          _id: 1,
          providerId: 1,
          name: 1,
          phone: 1,
          email: 1,
          profession: 1,
          categoryName: 1,
          categoryId: 1,
          city: 1,
          cityId: 1,
          isAvailable: 1,
          isAcceptingJobs: 1,
          isBusy: 1,
          isOnline: 1,
          lastOnlineAt: 1,
          verificationStatus: 1,
          rating: 1,
          completedJobs: 1,
          completedBookings: 1,
          totalBookings: 1,
          profilePicture: 1,
          profileImage: 1,
          location: 1,
          latitude: 1,
          longitude: 1,
          currentBookingId: 1,
          fcmToken: 1, // used to check if provider is reachable; will mask below
        },
      })
      .limit(500)
      .toArray();

    // Mask FCM token but expose boolean
    const sanitized = providers.map((p) => ({
      _id: String(p._id),
      providerId: p.providerId || String(p._id),
      name: p.name || 'Unknown',
      phone: p.phone || '',
      email: p.email || '',
      profession: p.profession || p.categoryName || '',
      categoryName: p.categoryName || p.profession || '',
      categoryId: p.categoryId || null,
      city: p.city || '',
      cityId: p.cityId || null,
      isAvailable: p.isAvailable === true,
      isAcceptingJobs: p.isAcceptingJobs === true,
      isBusy: p.isBusy === true,
      isOnline: p.isOnline === true,
      lastOnlineAt: p.lastOnlineAt || null,
      verificationStatus: p.verificationStatus || 'unknown',
      rating: typeof p.rating === 'object' ? (p.rating?.average || 0) : (p.rating || 0),
      completedJobs: p.completedJobs || p.completedBookings || 0,
      totalBookings: p.totalBookings || 0,
      profileImage: p.profilePicture || p.profileImage || null,
      hasFcmToken: !!(p.fcmToken && String(p.fcmToken).length > 10),
      currentBookingId: p.currentBookingId || null,
      location: p.location || (p.latitude != null && p.longitude != null
        ? { type: 'Point', coordinates: [p.longitude, p.latitude] }
        : null),
    }));

    // Sort: fully-online first, then by rating, then by name
    sanitized.sort((a, b) => {
      const aScore = (a.isAvailable && a.isAcceptingJobs && !a.isBusy && a.hasFcmToken) ? 1 : 0;
      const bScore = (b.isAvailable && b.isAcceptingJobs && !b.isBusy && b.hasFcmToken) ? 1 : 0;
      if (aScore !== bScore) return bScore - aScore;
      if ((b.rating || 0) !== (a.rating || 0)) return (b.rating || 0) - (a.rating || 0);
      return String(a.name).localeCompare(String(b.name));
    });

    return ok(res, {
      providers: sanitized,
      total: sanitized.length,
      onlineCount: sanitized.filter((p) => p.isAvailable && p.isAcceptingJobs && !p.isBusy).length,
      includedAll: includeAll,
    });
  } catch (err) {
    return fail(res, err);
  }
};

/* ══════════════════════════════════════════════════════════════
   GET /admin/manual-dispatch/dispatchable-bookings
   ──────────────────────────────────────────────────────────────
   Bookings jo admin manually assign kar sakta hai:
   confirmed, searching, no_provider_found (+ pending as fallback)
   ══════════════════════════════════════════════════════════════ */
exports.getDispatchableBookings = async (req, res) => {
  try {
    if (!Booking || typeof Booking.find !== 'function') {
      return fail(res, new Error('Booking model unavailable'));
    }

    const bookings = await Booking.find({
      status: { $in: ['confirmed', 'searching', 'no_provider_found', 'pending'] },
      $or: [
        { providerId: null },
        { providerId: { $exists: false } },
        { providerId: '' },
      ],
      isDeleted: { $ne: true },
    })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    // Attach latest offer counts (lightweight)
    const ids = bookings.map((b) => b.bookingId).filter(Boolean);
    let offerCountMap = {};
    if (ids.length && ProviderOffer && typeof ProviderOffer.aggregate === 'function') {
      try {
        const agg = await ProviderOffer.aggregate([
          { $match: { bookingId: { $in: ids } } },
          { $group: { _id: '$bookingId', count: { $sum: 1 } } },
        ]);
        offerCountMap = Object.fromEntries(agg.map((x) => [x._id, x.count]));
      } catch (e) {
        console.warn('[ManualDispatchCtrl] offer count agg error:', e.message);
      }
    }

    const enriched = bookings.map((b) => ({
      _id: String(b._id),
      bookingId: b.bookingId,
      customerName: b.customerName || '',
      customerPhone: b.customerPhone || '',
      serviceName: b.serviceName || '',
      categoryName: b.categoryName || '',
      categoryId: b.categoryId || null,
      address: b.address || '',
      city: b.city || null,
      totalAmount: b.totalAmount || b.amount || 0,
      status: b.status,
      bookingType: b.bookingType || 'instant',
      scheduledDate: b.scheduledDate || null,
      scheduledTime: b.scheduledTime || null,
      createdAt: b.createdAt,
      updatedAt: b.updatedAt,
      previousOfferCount: offerCountMap[b.bookingId] || 0,
    }));

    return ok(res, {
      bookings: enriched,
      total: enriched.length,
    });
  } catch (err) {
    return fail(res, err);
  }
};

/* ══════════════════════════════════════════════════════════════
   POST /admin/manual-dispatch/send
   Body: { bookingId, providerId, adminNote? }
   ──────────────────────────────────────────────────────────────
   Admin manually sends full-screen alarm FCM to a specific provider
   - Supersedes old offers
   - Creates new ProviderOffer entry (audit trail)
   - Creates DispatchJob entry
   - Sends FCM using existing sendBookingOfferToProvider (channel: booking_requests)
   - Updates booking status to 'searching'
   - Emits socket event for live admin dashboard refresh
   - Does NOT force-assign; provider still needs to accept via their app
   ══════════════════════════════════════════════════════════════ */
exports.sendManualDispatch = async (req, res) => {
  try {
    const { bookingId, providerId, adminNote } = req.body || {};

    if (!bookingId || !providerId) {
      return res.status(400).json({
        success: false,
        message: 'bookingId and providerId are required',
      });
    }

    // ── 1. Load booking ──
    if (!Booking || typeof Booking.findOne !== 'function') {
      return fail(res, new Error('Booking model unavailable'));
    }

    const bookingQuery = {
      $or: [
        { bookingId: String(bookingId) },
        ...(mongoose.Types.ObjectId.isValid(bookingId)
          ? [{ _id: new mongoose.Types.ObjectId(bookingId) }]
          : []),
      ],
    };

    const booking = await Booking.findOne(bookingQuery).lean();
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    if (['completed', 'cancelled', 'refunded'].includes(booking.status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot dispatch booking in terminal status: ${booking.status}`,
      });
    }

    // ── 2. Load provider ──
    const providerColl = getProviderConnection().collection('providers');
    const providerQuery = {
      $or: [
        { providerId: String(providerId) },
        ...(mongoose.Types.ObjectId.isValid(providerId)
          ? [{ _id: new mongoose.Types.ObjectId(providerId) }]
          : []),
      ],
    };

    const provider = await providerColl.findOne(providerQuery);
    if (!provider) {
      return res.status(404).json({ success: false, message: 'Provider not found' });
    }

    if (!provider.fcmToken || String(provider.fcmToken).length < 10) {
      return res.status(400).json({
        success: false,
        message: `Provider "${provider.name}" has no FCM token — cannot receive push`,
      });
    }

    if (provider.isActive === false || provider.isDeleted === true || provider.isBlocked === true) {
      return res.status(400).json({
        success: false,
        message: `Provider "${provider.name}" is inactive/blocked`,
      });
    }

    const bId = booking.bookingId;
    const bOid = booking._id;
    const pIdStr = provider.providerId || String(provider._id);

    console.log(`\n[ManualDispatch] 🎯 Admin sending booking ${bId} → provider ${pIdStr} (${provider.name})`);

    // ── 3. Supersede ALL existing active offers for this booking ──
    if (typeof dispatchService.supersedeOldOffers === 'function') {
      await dispatchService.supersedeOldOffers(bId);
    } else {
      // Inline fallback
      try {
        await ProviderOffer.updateMany(
          { bookingId: bId, status: { $in: ['sent', 'delivered', 'viewed', 'pending'] } },
          {
            $set: {
              status: 'superseded',
              isCurrentOffer: false,
              respondedAt: new Date(),
              reason: 'Superseded by admin manual dispatch',
            },
          }
        );
      } catch (e) {
        console.warn('[ManualDispatch] inline supersede error:', e.message);
      }
    }

    // ── 4. Clear cooldown (admin override) ──
    if (typeof dispatchService.clearCooldown === 'function') {
      dispatchService.clearCooldown(bId);
    }

    // ── 5. Create DispatchJob record ──
    let dispatchJob = null;
    try {
      dispatchJob = await DispatchJob.create({
        bookingId: bId,
        bookingObjectId: bOid,
        status: 'running',
        cycle: 1,
        batchNumber: 1,
        currentRadiusKm: 0,
        totalOffersSent: 1,
        totalProvidersConsidered: 1,
        triedProviderIds: [pIdStr],
        startedAt: new Date(),
        isScheduled: booking.bookingType === 'scheduled',
        source: 'manual_admin',
        adminNote: adminNote || null,
      });
    } catch (e) {
      console.warn('[ManualDispatch] DispatchJob create failed (non-critical):', e.message);
    }

    // ── 6. Create ProviderOffer record (audit trail) ──
    const expiresAt = new Date(Date.now() + MANUAL_DISPATCH_TIMEOUT_MS);
    let offerDoc = null;
    try {
      offerDoc = await ProviderOffer.create({
        bookingId: bId,
        bookingObjectId: bOid,
        providerId: pIdStr,
        providerObjectId: provider._id,
        providerName: provider.name || 'Unknown',
        providerPhone: provider.phone || '',
        providerCategory: provider.profession || provider.categoryName || '',
        providerCity: provider.city || '',
        status: 'sent',
        offeredAt: new Date(),
        expiresAt,
        dispatchCycle: 1,
        batchNumber: 1,
        radiusKm: 0,
        distanceKm: 0,
        isCurrentOffer: true,
        isScheduled: booking.bookingType === 'scheduled',
        source: 'manual_admin',
        adminNote: adminNote || null,
        bookingSnapshot: {
          serviceName: booking.serviceName,
          totalAmount: booking.totalAmount,
          address: booking.address,
          scheduledDate: booking.scheduledDate,
          scheduledTime: booking.scheduledTime,
        },
        fcmSent: false,
      });
    } catch (e) {
      console.error('[ManualDispatch] ProviderOffer create failed:', e.message);
      return fail(res, new Error('Failed to create offer record: ' + e.message));
    }

    // ── 7. Update booking status to 'searching' (if not already assigned) ──
    try {
      await Booking.updateOne(
        { _id: bOid },
        {
          $set: {
            status: 'searching',
            lastDispatchAt: new Date(),
            lastDispatchSource: 'manual_admin',
          },
          $push: {
            statusHistory: {
              status: 'searching',
              changedAt: new Date(),
              changedBy: 'admin_manual_dispatch',
              reason: `Admin manually sent to ${provider.name} (${pIdStr})${adminNote ? ' — ' + adminNote : ''}`,
            },
          },
        }
      );
    } catch (e) {
      console.warn('[ManualDispatch] booking status update warn:', e.message);
    }

    // ── 8. Send FCM via existing function (uses booking_requests channel) ──
    let fcmResult = { success: false, error: 'FCM not attempted' };
    try {
      if (typeof fcmService.sendBookingOfferToProvider === 'function') {
        fcmResult = await fcmService.sendBookingOfferToProvider(
          provider,
          booking,
          {
            offerId: String(offerDoc._id),
            expiresAt,
            distanceKm: 0,
            timeoutMs: MANUAL_DISPATCH_TIMEOUT_MS,
            batchNumber: 1,
            isManual: true,
            source: 'admin_manual',
          }
        );
      } else {
        fcmResult = { success: false, error: 'fcmService.sendBookingOfferToProvider unavailable' };
      }
    } catch (fcmErr) {
      console.error('[ManualDispatch] FCM send error:', fcmErr.message);
      fcmResult = { success: false, error: fcmErr.message };
    }

    // Update offer with FCM result
    try {
      offerDoc.fcmSent = !!fcmResult.success;
      offerDoc.fcmMessageId = fcmResult.messageId || null;
      offerDoc.fcmError = fcmResult.error || null;
      if (fcmResult.success) {
        offerDoc.status = 'delivered';
        offerDoc.deliveredAt = new Date();
      } else {
        offerDoc.status = 'failed';
        offerDoc.reason = `FCM failed: ${fcmResult.error || 'unknown'}`;
      }
      await offerDoc.save();
    } catch (e) {
      console.warn('[ManualDispatch] offer save warn:', e.message);
    }

    // ── 9. Emit socket for live admin dashboard ──
    safeEmit('dispatch:manual_sent', {
      bookingId: bId,
      providerId: pIdStr,
      providerName: provider.name,
      fcmSuccess: !!fcmResult.success,
      timestamp: new Date().toISOString(),
    });
    safeEmit('dispatch:offer_sent', {
      bookingId: bId,
      providerId: pIdStr,
      providerName: provider.name,
      distanceKm: 0,
      source: 'manual_admin',
    });
    safeEmit('booking:status_changed', { bookingId: bId, status: 'searching' });

    // ── 10. Response ──
    if (!fcmResult.success) {
      return res.status(502).json({
        success: false,
        message: `FCM push failed: ${fcmResult.error || 'unknown error'}`,
        data: {
          bookingId: bId,
          providerId: pIdStr,
          providerName: provider.name,
          offerId: String(offerDoc._id),
          dispatchJobId: dispatchJob ? String(dispatchJob._id) : null,
          fcmError: fcmResult.error,
          expiresAt,
        },
      });
    }

    console.log(`[ManualDispatch] ✅ Successfully sent ${bId} → ${provider.name}`);

    return ok(res, {
      bookingId: bId,
      providerId: pIdStr,
      providerName: provider.name,
      providerPhone: provider.phone || '',
      offerId: String(offerDoc._id),
      dispatchJobId: dispatchJob ? String(dispatchJob._id) : null,
      fcmMessageId: fcmResult.messageId || null,
      expiresAt,
      timeoutMs: MANUAL_DISPATCH_TIMEOUT_MS,
      message: `Full-screen alarm sent to ${provider.name}. Provider has ${MANUAL_DISPATCH_TIMEOUT_MS / 1000}s to respond.`,
    });
  } catch (err) {
    return fail(res, err);
  }
};

/* ══════════════════════════════════════════════════════════════
   GET /admin/manual-dispatch/offer-status/:offerId
   Quick poll endpoint — frontend can poll to see if provider accepted
   ══════════════════════════════════════════════════════════════ */
exports.getOfferStatus = async (req, res) => {
  try {
    const { offerId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(offerId)) {
      return res.status(400).json({ success: false, message: 'Invalid offerId' });
    }

    const offer = await ProviderOffer.findById(offerId).lean();
    if (!offer) {
      return res.status(404).json({ success: false, message: 'Offer not found' });
    }

    // Also fetch booking's current providerId to confirm acceptance
    let bookingAssigned = null;
    try {
      const b = await Booking.findOne({ bookingId: offer.bookingId }).select('providerId status').lean();
      if (b) {
        bookingAssigned = {
          providerId: b.providerId || null,
          status: b.status,
        };
      }
    } catch (_) {}

    return ok(res, {
      offerId: String(offer._id),
      bookingId: offer.bookingId,
      providerId: offer.providerId,
      providerName: offer.providerName,
      status: offer.status,
      fcmSent: offer.fcmSent,
      fcmError: offer.fcmError,
      offeredAt: offer.offeredAt,
      deliveredAt: offer.deliveredAt,
      respondedAt: offer.respondedAt,
      expiresAt: offer.expiresAt,
      isExpired: offer.expiresAt ? new Date(offer.expiresAt) < new Date() : false,
      bookingAssigned,
    });
  } catch (err) {
    return fail(res, err);
  }
};