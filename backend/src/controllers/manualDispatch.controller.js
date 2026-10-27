// backend/src/controllers/manualDispatch.controller.js
// ═══════════════════════════════════════════════════════════════
// MANUAL DISPATCH CONTROLLER — FIXED MODEL LOADING
// ═══════════════════════════════════════════════════════════════

const mongoose = require('mongoose');

/* ─────────────────────────────────────────────
   ROBUST MODEL LOADER
   Searches all mongoose connections for the model
   ───────────────────────────────────────────── */
function getModel(name) {
  // 1. Try default mongoose.model
  try {
    const m = mongoose.model(name);
    if (m) return m;
  } catch (e) { /* not on default */ }

  // 2. Search ALL connections
  for (const conn of mongoose.connections) {
    try {
      const m = conn.model(name);
      if (m) return m;
    } catch (e) { /* not on this connection */ }
  }

  // 3. Try common alternate names
  const alternates = {
    Booking: ['booking', 'Bookings', 'bookings'],
    Provider: ['provider', 'Providers', 'providers'],
    ProviderOffer: ['provideroffer', 'ProviderOffers', 'provideroffers'],
    DispatchJob: ['dispatchjob', 'DispatchJobs', 'dispatchjobs'],
  };

  const alts = alternates[name] || [];
  for (const alt of alts) {
    try {
      const m = mongoose.model(alt);
      if (m) return m;
    } catch {}
    for (const conn of mongoose.connections) {
      try {
        const m = conn.model(alt);
        if (m) return m;
      } catch {}
    }
  }

  console.error(`❌ [ManualDispatch] Model "${name}" NOT FOUND on any connection`);
  return null;
}

/* ─────────────────────────────────────────────
   LAZY MODEL GETTERS (loaded on first use)
   ───────────────────────────────────────────── */
let _Booking = null;
let _Provider = null;
let _ProviderOffer = null;
let _DispatchJob = null;

function getBookingModel() {
  if (!_Booking) _Booking = getModel('Booking');
  return _Booking;
}
function getProviderModel() {
  if (!_Provider) _Provider = getModel('Provider');
  return _Provider;
}
function getProviderOfferModel() {
  if (!_ProviderOffer) _ProviderOffer = getModel('ProviderOffer');
  return _ProviderOffer;
}
function getDispatchJobModel() {
  if (!_DispatchJob) _DispatchJob = getModel('DispatchJob');
  return _DispatchJob;
}

/* ─────────────────────────────────────────────
   LOAD SERVICES (with fallbacks)
   ───────────────────────────────────────────── */
let fcmService = null;
let dispatchService = null;
let liveEmitter = null;

try { fcmService = require('../services/fcmService'); } catch (e) {
  console.warn('⚠️ [ManualDispatch] fcmService load failed:', e.message);
}
try { dispatchService = require('../services/dispatchService'); } catch (e) {
  console.warn('⚠️ [ManualDispatch] dispatchService load failed:', e.message);
}
try { liveEmitter = require('../utils/liveEmitter'); } catch (e) {
  console.warn('⚠️ [ManualDispatch] liveEmitter load failed:', e.message);
}

const DISPATCH_TIMEOUT_MS = parseInt(process.env.MANUAL_DISPATCH_TIMEOUT_MS || '30000', 10);
const DISPATCHABLE_STATUSES = ['confirmed', 'searching', 'no_provider_found', 'pending'];

/* ═══════════════════════════════════════════════════════════════
   GET /online-providers
   ═══════════════════════════════════════════════════════════════ */
exports.getOnlineProviders = async (req, res) => {
  try {
    const Provider = getProviderModel();
    if (!Provider) {
      return res.status(500).json({ success: false, message: 'Provider model not available' });
    }

    const { all, search, category } = req.query;
    const filter = {};

    if (!all || all === '0' || all === 'false') {
      filter.isOnline = true;
    }

    if (category && category.trim()) {
      filter.$or = [
        { profession: { $regex: category, $options: 'i' } },
        { categoryName: { $regex: category, $options: 'i' } },
      ];
    }

    let providers = await Provider.find(filter)
      .sort({ isOnline: -1, lastOnlineAt: -1 })
      .limit(200)
      .lean();

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

    const normalized = providers.map((p) => ({
      providerId: String(p._id),
      name: p.name || p.fullName || 'Unknown',
      phone: p.phone || '',
      email: p.email || '',
      profession: p.profession || '',
      categoryName: p.categoryName || p.profession || '',
      city: typeof p.city === 'string' ? p.city : (p.city?.name || p.city?.city || ''),
      isAvailable: !!p.isAvailable,
      isAcceptingJobs: p.isAcceptingJobs !== false,
      isBusy: !!p.isBusy,
      isOnline: !!p.isOnline,
      lastOnlineAt: p.lastOnlineAt,
      verificationStatus: p.verificationStatus || 'pending',
      rating: p.rating || 0,
      completedJobs: p.completedJobs || 0,
      totalBookings: p.totalBookings || 0,
      profileImage: p.profileImage || p.profilePic || '',
      hasFcmToken: !!(p.fcmToken && String(p.fcmToken).length > 10),
      currentBookingId: p.currentBookingId ? String(p.currentBookingId) : null,
    }));

    return res.json({
      success: true,
      count: normalized.length,
      providers: normalized,
    });
  } catch (err) {
    console.error('❌ [ManualDispatch] getOnlineProviders:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

/* ═══════════════════════════════════════════════════════════════
   GET /dispatchable-bookings
   ═══════════════════════════════════════════════════════════════ */
exports.getDispatchableBookings = async (req, res) => {
  try {
    const Booking = getBookingModel();
    if (!Booking) {
      return res.status(500).json({ success: false, message: 'Booking model not available' });
    }

    const bookings = await Booking.find({
      status: { $in: DISPATCHABLE_STATUSES },
    })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    // Count previous offers per booking
    const ProviderOffer = getProviderOfferModel();
    let countMap = {};
    if (ProviderOffer && bookings.length > 0) {
      try {
        const bookingIds = bookings.map((b) => b._id);
        const offerCounts = await ProviderOffer.aggregate([
          { $match: { bookingId: { $in: bookingIds } } },
          { $group: { _id: '$bookingId', count: { $sum: 1 } } },
        ]);
        offerCounts.forEach((o) => {
          countMap[String(o._id)] = o.count;
        });
      } catch (e) {
        console.warn('⚠️ offer count failed:', e.message);
      }
    }

    const normalized = bookings.map((b) => ({
      _id: String(b._id),
      bookingId: b.bookingId || String(b._id).slice(-8),
      customerName: b.customerName || b.userName || b.customer?.name || 'Customer',
      customerPhone: b.customerPhone || b.userPhone || b.customer?.phone || '',
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
    console.error('❌ [ManualDispatch] getDispatchableBookings:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

/* ═══════════════════════════════════════════════════════════════
   POST /send
   ═══════════════════════════════════════════════════════════════ */
exports.send = async (req, res) => {
  try {
    const { bookingId, providerId, adminNote } = req.body;

    if (!bookingId || !providerId) {
      return res.status(400).json({ success: false, message: 'bookingId and providerId required' });
    }

    const Booking = getBookingModel();
    const Provider = getProviderModel();
    const ProviderOffer = getProviderOfferModel();
    const DispatchJob = getDispatchJobModel();

    if (!Booking || !Provider) {
      return res.status(500).json({ success: false, message: 'Models not available' });
    }

    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    const provider = await Provider.findById(providerId);
    if (!provider) {
      return res.status(404).json({ success: false, message: 'Provider not found' });
    }

    if (!provider.fcmToken || String(provider.fcmToken).length < 10) {
      return res.status(400).json({ success: false, message: 'Provider has no FCM token' });
    }

    // Supersede old pending offers
    if (ProviderOffer) {
      try {
        if (dispatchService && typeof dispatchService.supersedeOldOffers === 'function') {
          await dispatchService.supersedeOldOffers(booking._id);
        } else {
          await ProviderOffer.updateMany(
            { bookingId: booking._id, status: 'pending' },
            { $set: { status: 'superseded', respondedAt: new Date() } }
          );
        }
      } catch (e) {
        console.warn('⚠️ supersede failed:', e.message);
      }
    }

    // Clear cooldown
    try {
      if (dispatchService && typeof dispatchService.clearCooldown === 'function') {
        await dispatchService.clearCooldown(provider._id, booking._id);
      }
    } catch (e) { /* non-critical */ }

    // Create ProviderOffer
    let offer = null;
    const expiresAt = new Date(Date.now() + DISPATCH_TIMEOUT_MS);

    if (ProviderOffer) {
      try {
        offer = await ProviderOffer.create({
          bookingId: booking._id,
          providerId: provider._id,
          status: 'pending',
          sentAt: new Date(),
          expiresAt,
          source: 'manual_admin',
          adminNote: adminNote || null,
        });
      } catch (e) {
        console.warn('⚠️ ProviderOffer create failed:', e.message);
      }
    }

    // Create DispatchJob
    if (DispatchJob) {
      try {
        await DispatchJob.create({
          bookingId: booking._id,
          providerId: provider._id,
          offerId: offer ? offer._id : null,
          status: 'dispatched',
          source: 'manual_admin',
          createdAt: new Date(),
        });
      } catch (e) {
        console.warn('⚠️ DispatchJob create failed:', e.message);
      }
    }

    // Send FCM alarm
    let fcmSent = false;
    if (fcmService && typeof fcmService.sendBookingOfferToProvider === 'function') {
      try {
        await fcmService.sendBookingOfferToProvider(provider, booking, {
          offerId: offer ? String(offer._id) : '',
          expiresAt: expiresAt.toISOString(),
          timeoutMs: DISPATCH_TIMEOUT_MS,
          source: 'manual_admin',
          adminNote: adminNote || '',
        });
        fcmSent = true;
      } catch (fcmErr) {
        console.error('❌ FCM send failed:', fcmErr);
        if (offer) {
          try {
            await ProviderOffer.findByIdAndUpdate(offer._id, {
              status: 'failed',
              failureReason: fcmErr.message,
            });
          } catch {}
        }
        return res.status(500).json({
          success: false,
          message: 'FCM send failed: ' + fcmErr.message,
        });
      }
    } else {
      console.warn('⚠️ fcmService.sendBookingOfferToProvider not available');
      return res.status(500).json({
        success: false,
        message: 'FCM service not available. Check Provider Firebase credentials.',
      });
    }

    // Update booking status
    if (['no_provider_found', 'pending'].includes(booking.status)) {
      try {
        booking.status = 'searching';
        await booking.save();
      } catch (e) { /* non-critical */ }
    }

    // Socket emit
    try {
      if (liveEmitter && typeof liveEmitter.emitToAdmins === 'function') {
        liveEmitter.emitToAdmins('manual-dispatch:sent', {
          bookingId: String(booking._id),
          providerId: String(provider._id),
          providerName: provider.name || provider.fullName,
          offerId: offer ? String(offer._id) : '',
          expiresAt,
        });
      }
    } catch (e) { /* non-critical */ }

    // Auto-timeout
    if (offer) {
      setTimeout(async () => {
        try {
          const o = await ProviderOffer.findById(offer._id);
          if (o && o.status === 'pending') {
            o.status = 'timeout';
            o.respondedAt = new Date();
            await o.save();
            try {
              if (liveEmitter && typeof liveEmitter.emitToAdmins === 'function') {
                liveEmitter.emitToAdmins('manual-dispatch:timeout', {
                  offerId: String(offer._id),
                  bookingId: String(booking._id),
                  providerId: String(provider._id),
                });
              }
            } catch {}
          }
        } catch (e) {
          console.warn('⚠️ timeout handler:', e.message);
        }
      }, DISPATCH_TIMEOUT_MS + 2000);
    }

    return res.json({
      success: true,
      message: 'Alarm sent successfully',
      offerId: offer ? String(offer._id) : null,
      expiresAt,
      timeoutMs: DISPATCH_TIMEOUT_MS,
      fcmSent,
    });
  } catch (err) {
    console.error('❌ [ManualDispatch] send:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

/* ═══════════════════════════════════════════════════════════════
   GET /offer-status/:offerId
   ═══════════════════════════════════════════════════════════════ */
exports.getOfferStatus = async (req, res) => {
  try {
    const ProviderOffer = getProviderOfferModel();
    const Provider = getProviderModel();

    if (!ProviderOffer) {
      return res.status(500).json({ success: false, message: 'ProviderOffer model not available' });
    }

    const { offerId } = req.params;
    const offer = await ProviderOffer.findById(offerId).lean();
    if (!offer) {
      return res.status(404).json({ success: false, message: 'Offer not found' });
    }

    let providerName = '';
    if (Provider) {
      try {
        const p = await Provider.findById(offer.providerId).select('name fullName').lean();
        providerName = p?.name || p?.fullName || '';
      } catch {}
    }

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
    console.error('❌ [ManualDispatch] getOfferStatus:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};