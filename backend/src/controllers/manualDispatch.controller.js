// backend/src/controllers/manualDispatch.controller.js
// ═══════════════════════════════════════════════════════════════
// MANUAL DISPATCH CONTROLLER
// Admin manually sends booking to a specific provider with FCM alarm
// ═══════════════════════════════════════════════════════════════

const Booking = require('../models/booking.model');
const Provider = require('../models/provider.model');
const ProviderOffer = require('../models/providerOffer.model');
const DispatchJob = require('../models/dispatchJob.model');

const fcmService = require('../services/fcmService');
const dispatchService = require('../services/dispatchService');
const liveEmitter = require('../utils/liveEmitter');

const DISPATCH_TIMEOUT_MS = parseInt(process.env.MANUAL_DISPATCH_TIMEOUT_MS || '30000', 10);
const DISPATCHABLE_STATUSES = ['confirmed', 'searching', 'no_provider_found', 'pending'];

/* ═══════════════════════════════════════════════════════════════
   GET /online-providers
   Returns all online providers (or all providers if ?all=1)
   ═══════════════════════════════════════════════════════════════ */
exports.getOnlineProviders = async (req, res) => {
  try {
    const { all, search, category } = req.query;

    const filter = {};

    // By default only online providers; if ?all=1 then include all
    if (!all || all === '0' || all === 'false') {
      filter.isOnline = true;
    }

    // Category filter
    if (category && category.trim()) {
      filter.$or = [
        { profession: { $regex: category, $options: 'i' } },
        { categoryName: { $regex: category, $options: 'i' } },
      ];
    }

    let providers = await Provider.find(filter)
      .select(
        '_id providerId name fullName phone email profession categoryName city ' +
        'isAvailable isAcceptingJobs isBusy isOnline lastOnlineAt verificationStatus ' +
        'rating completedJobs totalBookings profileImage fcmToken currentBookingId'
      )
      .sort({ isOnline: -1, lastOnlineAt: -1 })
      .lean();

    // Text search (name / phone / city / email)
    if (search && search.trim()) {
      const s = search.trim().toLowerCase();
      providers = providers.filter((p) => {
        return (
          (p.name && p.name.toLowerCase().includes(s)) ||
          (p.fullName && p.fullName.toLowerCase().includes(s)) ||
          (p.phone && p.phone.toLowerCase().includes(s)) ||
          (p.email && p.email.toLowerCase().includes(s)) ||
          (p.city && String(p.city).toLowerCase().includes(s))
        );
      });
    }

    // Normalize response shape for frontend
    const normalized = providers.map((p) => ({
      providerId: String(p._id),
      name: p.name || p.fullName || 'Unknown',
      phone: p.phone || '',
      email: p.email || '',
      profession: p.profession || '',
      categoryName: p.categoryName || p.profession || '',
      city: typeof p.city === 'string' ? p.city : p.city?.name || '',
      isAvailable: !!p.isAvailable,
      isAcceptingJobs: !!p.isAcceptingJobs,
      isBusy: !!p.isBusy,
      isOnline: !!p.isOnline,
      lastOnlineAt: p.lastOnlineAt,
      verificationStatus: p.verificationStatus || 'pending',
      rating: p.rating || 0,
      completedJobs: p.completedJobs || 0,
      totalBookings: p.totalBookings || 0,
      profileImage: p.profileImage || '',
      hasFcmToken: !!(p.fcmToken && p.fcmToken.length > 10),
      currentBookingId: p.currentBookingId ? String(p.currentBookingId) : null,
    }));

    return res.json({
      success: true,
      count: normalized.length,
      providers: normalized,
    });
  } catch (err) {
    console.error('❌ [ManualDispatch] getOnlineProviders error:', err);
    return res.status(500).json({
      success: false,
      message: err.message || 'Failed to fetch providers',
    });
  }
};

/* ═══════════════════════════════════════════════════════════════
   GET /dispatchable-bookings
   Returns all bookings that can be dispatched
   ═══════════════════════════════════════════════════════════════ */
exports.getDispatchableBookings = async (req, res) => {
  try {
    const bookings = await Booking.find({
      status: { $in: DISPATCHABLE_STATUSES },
    })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    // For each booking count previous offers
    const bookingIds = bookings.map((b) => b._id);
    const offerCounts = await ProviderOffer.aggregate([
      { $match: { bookingId: { $in: bookingIds } } },
      { $group: { _id: '$bookingId', count: { $sum: 1 } } },
    ]);
    const countMap = {};
    offerCounts.forEach((o) => {
      countMap[String(o._id)] = o.count;
    });

    const normalized = bookings.map((b) => ({
      _id: String(b._id),
      bookingId: b.bookingId || String(b._id).slice(-8),
      customerName: b.customerName || b.userName || 'Customer',
      customerPhone: b.customerPhone || b.userPhone || '',
      serviceName: b.serviceName || b.service?.name || 'Service',
      categoryName: b.categoryName || b.category?.name || '',
      address: b.address || b.serviceAddress || '',
      city: b.city || b.serviceCity || '',
      totalAmount: b.totalAmount || b.amount || 0,
      status: b.status,
      bookingType: b.bookingType || 'normal',
      scheduledDate: b.scheduledDate,
      scheduledTime: b.scheduledTime,
      createdAt: b.createdAt,
      previousOfferCount: countMap[String(b._id)] || 0,
    }));

    return res.json({
      success: true,
      count: normalized.length,
      bookings: normalized,
    });
  } catch (err) {
    console.error('❌ [ManualDispatch] getDispatchableBookings error:', err);
    return res.status(500).json({
      success: false,
      message: err.message || 'Failed to fetch bookings',
    });
  }
};

/* ═══════════════════════════════════════════════════════════════
   POST /send
   Admin manually sends FCM alarm to specific provider
   Body: { bookingId, providerId, adminNote? }
   ═══════════════════════════════════════════════════════════════ */
exports.send = async (req, res) => {
  try {
    const { bookingId, providerId, adminNote } = req.body;

    if (!bookingId || !providerId) {
      return res.status(400).json({
        success: false,
        message: 'bookingId and providerId are required',
      });
    }

    // Load booking
    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    // Load provider
    const provider = await Provider.findById(providerId);
    if (!provider) {
      return res.status(404).json({ success: false, message: 'Provider not found' });
    }

    if (!provider.fcmToken || provider.fcmToken.length < 10) {
      return res.status(400).json({
        success: false,
        message: 'Provider has no FCM token — cannot send alarm',
      });
    }

    // Supersede old pending offers for this booking
    try {
      if (typeof dispatchService.supersedeOldOffers === 'function') {
        await dispatchService.supersedeOldOffers(booking._id);
      } else {
        await ProviderOffer.updateMany(
          { bookingId: booking._id, status: 'pending' },
          { $set: { status: 'superseded', respondedAt: new Date() } }
        );
      }
    } catch (e) {
      console.warn('⚠️ supersedeOldOffers failed:', e.message);
    }

    // Clear cooldown for this provider+booking (so FCM goes through)
    try {
      if (typeof dispatchService.clearCooldown === 'function') {
        await dispatchService.clearCooldown(provider._id, booking._id);
      }
    } catch (e) {
      /* non-critical */
    }

    // Create new ProviderOffer
    const expiresAt = new Date(Date.now() + DISPATCH_TIMEOUT_MS);
    const offer = await ProviderOffer.create({
      bookingId: booking._id,
      providerId: provider._id,
      status: 'pending',
      sentAt: new Date(),
      expiresAt,
      source: 'manual_admin',
      adminNote: adminNote || null,
    });

    // Create DispatchJob record (for history/tracking)
    try {
      await DispatchJob.create({
        bookingId: booking._id,
        providerId: provider._id,
        offerId: offer._id,
        status: 'dispatched',
        source: 'manual_admin',
        createdAt: new Date(),
      });
    } catch (e) {
      /* non-critical */
    }

    // Send FCM full-screen alarm
    try {
      await fcmService.sendBookingOfferToProvider(provider, booking, {
        offerId: String(offer._id),
        expiresAt: expiresAt.toISOString(),
        timeoutMs: DISPATCH_TIMEOUT_MS,
        source: 'manual_admin',
        adminNote: adminNote || '',
      });
    } catch (fcmErr) {
      console.error('❌ FCM send failed:', fcmErr);
      await ProviderOffer.findByIdAndUpdate(offer._id, {
        status: 'failed',
        failureReason: fcmErr.message,
      });
      return res.status(500).json({
        success: false,
        message: 'FCM send failed: ' + fcmErr.message,
      });
    }

    // Update booking status to searching if it was pending/no_provider_found
    if (['no_provider_found', 'pending'].includes(booking.status)) {
      booking.status = 'searching';
      await booking.save();
    }

    // Live socket emit for admin dashboard
    try {
      liveEmitter.emitToAdmins('manual-dispatch:sent', {
        bookingId: String(booking._id),
        providerId: String(provider._id),
        providerName: provider.name || provider.fullName,
        offerId: String(offer._id),
        expiresAt,
      });
    } catch (e) {
      /* non-critical */
    }

    // Auto-timeout: mark offer as expired after DISPATCH_TIMEOUT_MS
    setTimeout(async () => {
      try {
        const o = await ProviderOffer.findById(offer._id);
        if (o && o.status === 'pending') {
          o.status = 'timeout';
          o.respondedAt = new Date();
          await o.save();

          try {
            liveEmitter.emitToAdmins('manual-dispatch:timeout', {
              offerId: String(offer._id),
              bookingId: String(booking._id),
              providerId: String(provider._id),
            });
          } catch {}
        }
      } catch (e) {
        console.warn('⚠️ offer timeout handler failed:', e.message);
      }
    }, DISPATCH_TIMEOUT_MS + 2000);

    return res.json({
      success: true,
      message: 'Alarm sent successfully',
      offerId: String(offer._id),
      expiresAt,
      timeoutMs: DISPATCH_TIMEOUT_MS,
    });
  } catch (err) {
    console.error('❌ [ManualDispatch] send error:', err);
    return res.status(500).json({
      success: false,
      message: err.message || 'Manual dispatch failed',
    });
  }
};

/* ═══════════════════════════════════════════════════════════════
   GET /offer-status/:offerId
   Poll offer status
   ═══════════════════════════════════════════════════════════════ */
exports.getOfferStatus = async (req, res) => {
  try {
    const { offerId } = req.params;

    const offer = await ProviderOffer.findById(offerId).lean();
    if (!offer) {
      return res.status(404).json({ success: false, message: 'Offer not found' });
    }

    let providerName = '';
    try {
      const provider = await Provider.findById(offer.providerId).select('name fullName').lean();
      providerName = provider?.name || provider?.fullName || '';
    } catch {}

    return res.json({
      success: true,
      offer: {
        offerId: String(offer._id),
        bookingId: String(offer.bookingId),
        providerId: String(offer.providerId),
        providerName,
        status: offer.status,
        sentAt: offer.sentAt,
        respondedAt: offer.respondedAt,
        expiresAt: offer.expiresAt,
        responseNote: offer.responseNote || '',
      },
    });
  } catch (err) {
    console.error('❌ [ManualDispatch] getOfferStatus error:', err);
    return res.status(500).json({
      success: false,
      message: err.message || 'Failed to fetch offer status',
    });
  }
};