// backend/src/controllers/manualDispatch.controller.js
const mongoose = require('mongoose');

// ═══════════════════════════════════════════════════════════════
// 🔧 CONFIG
// ═══════════════════════════════════════════════════════════════
const DISPATCH_TIMEOUT_MS = parseInt(process.env.MANUAL_DISPATCH_TIMEOUT_MS) || 30000;
const DISPATCHABLE_STATUSES = ['confirmed', 'searching', 'no_provider_found', 'pending'];

// ═══════════════════════════════════════════════════════════════
// 🗄️ DIRECT DB CONNECTION LOADERS
// Uses your actual config/database.js connections:
//   provider_db  → providers (fcmToken, isAvailable, providerId etc.)
//   bookings_db  → bookings (real customer bookings)
//   admin_panel  → provideroffers, dispatchjobs
// ═══════════════════════════════════════════════════════════════
let _providerConn = null;
let _bookingConn = null;
let _adminConn = null;

function getProviderConn() {
  if (_providerConn && _providerConn.readyState === 1) return _providerConn;
  try {
    const db = require('../config/database');
    _providerConn = db.getProviderConnection ? db.getProviderConnection() : null;
    if (_providerConn) return _providerConn;
  } catch (e) {}
  // Fallback: scan all connections
  for (const conn of mongoose.connections) {
    if (conn.readyState === 1 && (conn.name || '').toLowerCase().includes('provider')) {
      _providerConn = conn;
      return conn;
    }
  }
  return null;
}

function getBookingConn() {
  if (_bookingConn && _bookingConn.readyState === 1) return _bookingConn;
  try {
    const db = require('../config/database');
    _bookingConn = db.getBookingConnection ? db.getBookingConnection() : null;
    if (_bookingConn) return _bookingConn;
  } catch (e) {}
  for (const conn of mongoose.connections) {
    if (conn.readyState === 1 && (conn.name || '').toLowerCase().includes('booking')) {
      _bookingConn = conn;
      return conn;
    }
  }
  // Fallback: user_db also has bookings
  for (const conn of mongoose.connections) {
    if (conn.readyState === 1 && (conn.name || '').toLowerCase().includes('user')) {
      _bookingConn = conn;
      return conn;
    }
  }
  return null;
}

function getAdminConn() {
  if (_adminConn && _adminConn.readyState === 1) return _adminConn;
  try {
    const db = require('../config/database');
    _adminConn = db.getAdminConnection ? db.getAdminConnection() : null;
    if (_adminConn) return _adminConn;
  } catch (e) {}
  for (const conn of mongoose.connections) {
    if (conn.readyState === 1 && (conn.name || '').toLowerCase().includes('admin')) {
      _adminConn = conn;
      return conn;
    }
  }
  return null;
}

// ═══════════════════════════════════════════════════════════════
// 🗄️ MODEL GETTERS — tries registered models first, then raw collection
// ═══════════════════════════════════════════════════════════════
function getProviderModel() {
  const conn = getProviderConn();
  if (!conn) return null;

  // Try registered models
  const candidates = ['Provider', 'provider', 'providers'];
  for (const name of candidates) {
    try {
      const m = conn.model(name);
      if (m) return m;
    } catch (e) {}
  }
  // Fallback: ad-hoc model on 'providers' collection
  try {
    const schema = new mongoose.Schema({}, { strict: false, collection: 'providers' });
    return conn.model('Provider_adhoc', schema, 'providers');
  } catch (e) {
    return null;
  }
}

function getBookingModel() {
  const conn = getBookingConn();
  if (!conn) return null;

  const candidates = ['Booking', 'booking', 'bookings'];
  for (const name of candidates) {
    try {
      const m = conn.model(name);
      if (m) return m;
    } catch (e) {}
  }
  try {
    const schema = new mongoose.Schema({}, { strict: false, collection: 'bookings' });
    return conn.model('Booking_adhoc', schema, 'bookings');
  } catch (e) {
    return null;
  }
}

function getProviderOfferModel() {
  // Try admin_panel first, then bookings_db
  const conns = [getAdminConn(), getBookingConn()].filter(Boolean);
  for (const conn of conns) {
    const candidates = ['ProviderOffer', 'provideroffer', 'provideroffers'];
    for (const name of candidates) {
      try {
        const m = conn.model(name);
        if (m) return m;
      } catch (e) {}
    }
  }
  // Fallback: ad-hoc on admin conn
  const adminConn = getAdminConn();
  if (adminConn) {
    try {
      const schema = new mongoose.Schema({
        bookingId: mongoose.Schema.Types.ObjectId,
        providerId: mongoose.Schema.Types.ObjectId,
        status: String,
        source: String,
        adminNote: String,
        expiresAt: Date,
        timeoutMs: Number,
        acceptedAt: Date,
        rejectedAt: Date,
        timeoutAt: Date,
        supersededAt: Date,
        supersededBy: String,
        createdAt: { type: Date, default: Date.now }
      }, { strict: false, collection: 'provideroffers' });
      return adminConn.model('ProviderOffer_adhoc', schema, 'provideroffers');
    } catch (e) {
      return null;
    }
  }
  return null;
}

function getDispatchJobModel() {
  const conns = [getAdminConn(), getBookingConn()].filter(Boolean);
  for (const conn of conns) {
    const candidates = ['DispatchJob', 'dispatchjob', 'dispatchjobs'];
    for (const name of candidates) {
      try {
        const m = conn.model(name);
        if (m) return m;
      } catch (e) {}
    }
  }
  const adminConn = getAdminConn();
  if (adminConn) {
    try {
      const schema = new mongoose.Schema({}, { strict: false, collection: 'dispatchjobs' });
      return adminConn.model('DispatchJob_adhoc', schema, 'dispatchjobs');
    } catch (e) {
      return null;
    }
  }
  return null;
}

// ═══════════════════════════════════════════════════════════════
// 📡 SERVICE LOADERS
// ═══════════════════════════════════════════════════════════════
let fcmService = null;
try {
  fcmService = require('../services/fcmService');
  console.log('✅ [ManualDispatch] fcmService loaded');
} catch (e) {
  console.warn('⚠️ [ManualDispatch] fcmService load failed:', e.message);
}

let liveEmitter = null;
try {
  liveEmitter = require('../services/liveEmitter');
  console.log('✅ [ManualDispatch] liveEmitter loaded');
} catch (e) {
  console.warn('⚠️ [ManualDispatch] liveEmitter load failed:', e.message);
}

// ═══════════════════════════════════════════════════════════════
// 1️⃣ GET ONLINE PROVIDERS — from provider_db.providers
// ═══════════════════════════════════════════════════════════════
exports.getOnlineProviders = async (req, res) => {
  try {
    const Provider = getProviderModel();
    if (!Provider) {
      return res.status(500).json({
        success: false,
        message: 'Provider model not available — provider_db connection not found',
        providers: []
      });
    }

    const includeAll = req.query.all === '1' || req.query.all === 'true';
    const search = (req.query.search || '').trim();
    const category = (req.query.category || '').trim();

    // Base query
    const query = {
      isActive: true,
      verificationStatus: 'approved'
    };

    if (!includeAll) {
      query.isAcceptingJobs = { $ne: false };
    }

    if (category) {
      query.$or = [
        { categoryName: { $regex: category, $options: 'i' } },
        { profession: { $regex: category, $options: 'i' } }
      ];
    }

    if (search) {
      const searchOr = [
        { name: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { providerId: { $regex: search, $options: 'i' } },
        { city: { $regex: search, $options: 'i' } },
        { profession: { $regex: search, $options: 'i' } }
      ];
      if (query.$or) {
        query.$and = [{ $or: query.$or }, { $or: searchOr }];
        delete query.$or;
      } else {
        query.$or = searchOr;
      }
    }

    const providers = await Provider.find(query)
      .sort({ isAvailable: -1, isAcceptingJobs: -1, lastOnlineAt: -1 })
      .limit(200)
      .lean();

    const normalized = providers.map(p => ({
      _id: p._id,
      providerId: p.providerId || String(p._id).slice(-8).toUpperCase(),
      name: p.name || 'Unknown',
      phone: p.phone || '',
      email: p.email || '',
      profession: p.profession || p.categoryName || '',
      categoryName: p.categoryName || p.profession || '',
      categoryId: p.categoryId || null,
      city: p.city || '',
      cityId: p.cityId || null,
      isAvailable: !!p.isAvailable,
      isAcceptingJobs: p.isAcceptingJobs !== false,
      isBusy: !!p.isBusy,
      isOnline: !!(p.isAvailable && p.isAcceptingJobs !== false && !p.isBusy),
      lastOnlineAt: p.lastOnlineAt || null,
      verificationStatus: p.verificationStatus || 'pending',
      isVerified: !!p.isVerified,
      rating: typeof p.rating === 'object' ? (p.rating?.average || 0) : (p.rating || 0),
      ratingCount: typeof p.rating === 'object' ? (p.rating?.count || 0) : 0,
      completedJobs: p.completedJobs || 0,
      totalBookings: p.completedJobs || 0,
      profileImage: p.profilePicture || p.profileImage || p.profilePic || p.selfieImage?.url || '',
      hasFcmToken: !!(p.fcmToken && typeof p.fcmToken === 'string' && p.fcmToken.length > 10),
      currentBookingId: p.currentBookingId || null,
      gender: p.gender || '',
    }));

    console.log(`📊 [ManualDispatch] Returned ${normalized.length} providers (all=${includeAll}, search="${search}", cat="${category}")`);

    return res.json({
      success: true,
      count: normalized.length,
      providers: normalized
    });

  } catch (err) {
    console.error('❌ [ManualDispatch] getOnlineProviders error:', err);
    return res.status(500).json({
      success: false,
      message: err.message,
      providers: []
    });
  }
};

// ═══════════════════════════════════════════════════════════════
// 2️⃣ GET DISPATCHABLE BOOKINGS — from bookings_db.bookings
// ═══════════════════════════════════════════════════════════════
exports.getDispatchableBookings = async (req, res) => {
  try {
    const Booking = getBookingModel();
    if (!Booking) {
      return res.status(500).json({
        success: false,
        message: 'Booking model not available — bookings_db connection not found',
        bookings: []
      });
    }

    const ProviderOffer = getProviderOfferModel();

    const query = {
      status: { $in: DISPATCHABLE_STATUSES }
    };

    const bookings = await Booking.find(query)
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    // Offer counts
    let offerCounts = {};
    if (ProviderOffer && bookings.length > 0) {
      try {
        const offerAgg = await ProviderOffer.aggregate([
          { $match: { bookingId: { $in: bookings.map(b => b._id) } } },
          { $group: { _id: '$bookingId', count: { $sum: 1 } } }
        ]);
        offerAgg.forEach(a => { offerCounts[String(a._id)] = a.count; });
      } catch (e) {
        console.warn('⚠️ Offer count aggregation failed:', e.message);
      }
    }

    const normalized = bookings.map(b => {
      const customerName =
        b.customerName ||
        b.userName ||
        b.customer?.name ||
        b.customer?.fullName ||
        b.userId?.name ||
        b.user?.name ||
        'Customer';

      const customerPhone =
        b.customerPhone ||
        b.customer?.phone ||
        b.customer?.mobile ||
        b.userId?.phone ||
        b.user?.phone ||
        b.mobile ||
        '';

      const serviceName =
        b.serviceName ||
        b.service?.name ||
        b.service?.title ||
        b.subServiceName ||
        b.subService?.name ||
        'Service';

      const categoryName =
        b.categoryName ||
        b.category?.name ||
        b.service?.categoryName ||
        b.service?.category?.name ||
        '';

      const address =
        b.address ||
        b.fullAddress ||
        b.location?.address ||
        b.customerAddress ||
        b.deliveryAddress ||
        '';

      const city =
        b.city ||
        b.location?.city ||
        b.customerCity ||
        '';

      const totalAmount =
        b.totalAmount ||
        b.amount ||
        b.total ||
        b.price ||
        b.estimatedAmount ||
        b.finalAmount ||
        0;

      return {
        _id: b._id,
        bookingId: b.bookingId || b.orderId || String(b._id).slice(-8).toUpperCase(),
        customerName,
        customerPhone,
        serviceName,
        categoryName,
        address,
        city,
        totalAmount,
        status: b.status || 'pending',
        bookingType: b.bookingType || b.type || b.serviceType || 'standard',
        scheduledDate: b.scheduledDate || b.date || b.bookingDate || null,
        scheduledTime: b.scheduledTime || b.time || b.bookingTime || null,
        createdAt: b.createdAt || null,
        previousOfferCount: offerCounts[String(b._id)] || 0,
        providerId: b.providerId || b.assignedProviderId || null,
      };
    });

    console.log(`📊 [ManualDispatch] Returned ${normalized.length} dispatchable bookings`);

    return res.json({
      success: true,
      count: normalized.length,
      bookings: normalized
    });

  } catch (err) {
    console.error('❌ [ManualDispatch] getDispatchableBookings error:', err);
    return res.status(500).json({
      success: false,
      message: err.message,
      bookings: []
    });
  }
};

// ═══════════════════════════════════════════════════════════════
// 3️⃣ SEND MANUAL DISPATCH — real FCM alarm to provider phone
// ═══════════════════════════════════════════════════════════════
exports.send = async (req, res) => {
  try {
    const { bookingId, providerId, adminNote } = req.body;

    if (!bookingId || !providerId) {
      return res.status(400).json({
        success: false,
        message: 'bookingId and providerId are required'
      });
    }

    const Booking = getBookingModel();
    const Provider = getProviderModel();
    const ProviderOffer = getProviderOfferModel();
    const DispatchJob = getDispatchJobModel();

    if (!Booking || !Provider) {
      return res.status(500).json({
        success: false,
        message: 'Required models not available (Booking or Provider)'
      });
    }

    // ── Find booking ──
    let booking = null;
    if (mongoose.Types.ObjectId.isValid(bookingId)) {
      booking = await Booking.findById(bookingId).lean();
    }
    if (!booking) {
      booking = await Booking.findOne({
        $or: [
          { bookingId: bookingId },
          { orderId: bookingId }
        ]
      }).lean();
    }
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: `Booking not found: ${bookingId}`
      });
    }

    // ── Find provider ──
    let provider = null;
    if (mongoose.Types.ObjectId.isValid(providerId)) {
      provider = await Provider.findById(providerId).lean();
    }
    if (!provider) {
      provider = await Provider.findOne({
        $or: [{ providerId: providerId }]
      }).lean();
    }
    if (!provider) {
      return res.status(404).json({
        success: false,
        message: `Provider not found: ${providerId}`
      });
    }

    // ── Check FCM token ──
    if (!provider.fcmToken || typeof provider.fcmToken !== 'string' || provider.fcmToken.length < 10) {
      return res.status(400).json({
        success: false,
        message: `Provider ${provider.name} has no valid FCM token. Phone alarm cannot be sent.`
      });
    }

    console.log(`\n🚨 [ManualDispatch] Dispatching booking ${booking._id} to ${provider.name} (${provider.phone})`);

    // ── Supersede old offers ──
    if (ProviderOffer) {
      try {
        const supResult = await ProviderOffer.updateMany(
          {
            bookingId: booking._id,
            status: { $in: ['pending', 'sent', 'offered'] }
          },
          {
            $set: {
              status: 'superseded',
              supersededAt: new Date(),
              supersededBy: 'manual_admin'
            }
          }
        );
        console.log(`🔄 Superseded ${supResult.modifiedCount} old offers`);
      } catch (e) {
        console.warn('⚠️ Supersede failed:', e.message);
      }
    }

    // ── Create new offer ──
    const expiresAt = new Date(Date.now() + DISPATCH_TIMEOUT_MS);
    let offer = null;

    if (ProviderOffer) {
      try {
        offer = await ProviderOffer.create({
          bookingId: booking._id,
          providerId: provider._id,
          status: 'pending',
          source: 'manual_admin',
          adminNote: adminNote || '',
          expiresAt,
          timeoutMs: DISPATCH_TIMEOUT_MS,
          createdAt: new Date()
        });
        console.log(`📝 Created ProviderOffer: ${offer._id}`);
      } catch (e) {
        console.warn('⚠️ ProviderOffer create failed:', e.message);
      }
    }

    // ── Create DispatchJob ──
    if (DispatchJob) {
      try {
        await DispatchJob.create({
          bookingId: booking._id,
          providerId: provider._id,
          offerId: offer?._id || null,
          status: 'dispatched',
          source: 'manual_admin',
          dispatchType: 'manual',
          adminNote: adminNote || '',
          dispatchedAt: new Date(),
          expiresAt,
          timeoutMs: DISPATCH_TIMEOUT_MS
        });
        console.log(`📝 Created DispatchJob`);
      } catch (e) {
        console.warn('⚠️ DispatchJob create failed:', e.message);
      }
    }

    // ── 🚨 SEND FCM ALARM TO PROVIDER PHONE ──
    let fcmSent = false;
    let fcmError = null;
    let fcmResult = null;

    if (fcmService && typeof fcmService.sendBookingOfferToProvider === 'function') {
      try {
        console.log(`📲 Firing FCM alarm to ${provider.name}...`);
        fcmResult = await fcmService.sendBookingOfferToProvider(
          provider,
          booking,
          {
            offerId: offer?._id || null,
            expiresAt,
            timeoutMs: DISPATCH_TIMEOUT_MS,
            source: 'manual_admin',
            adminNote: adminNote || `Manual dispatch by ${req.admin?.email || 'admin'}`
          }
        );
        fcmSent = true;
        console.log(`✅ FCM alarm sent successfully to ${provider.name}`, fcmResult);
      } catch (e) {
        fcmError = e.message;
        console.error(`❌ FCM alarm failed for ${provider.name}:`, e.message);
      }
    } else {
      fcmError = 'fcmService.sendBookingOfferToProvider not available';
      console.error(`❌ ${fcmError}`);
    }

    // ── Update booking status ──
    try {
      const currentStatus = booking.status;
      if (['pending', 'no_provider_found'].includes(currentStatus)) {
        await Booking.findByIdAndUpdate(booking._id, {
          $set: {
            status: 'searching',
            updatedAt: new Date()
          }
        });
        console.log(`🔄 Booking status: ${currentStatus} → searching`);
      }
    } catch (e) {
      console.warn('⚠️ Booking status update failed:', e.message);
    }

    // ── Socket emit ──
    if (liveEmitter) {
      try {
        const emitFn = liveEmitter.emitToAdmins || liveEmitter.emitLive || liveEmitter.broadcastLive;
        if (typeof emitFn === 'function') {
          emitFn('manual-dispatch:sent', {
            bookingId: booking._id,
            providerId: provider._id,
            providerName: provider.name,
            offerId: offer?._id,
            fcmSent,
            timestamp: new Date()
          });
        }
      } catch (e) {}
    }

    // ── Auto-timeout ──
    if (offer) {
      setTimeout(async () => {
        try {
          const OfferModel = getProviderOfferModel();
          if (!OfferModel) return;
          const current = await OfferModel.findById(offer._id).lean();
          if (current && ['pending', 'sent', 'offered'].includes(current.status)) {
            await OfferModel.findByIdAndUpdate(offer._id, {
              $set: { status: 'timeout', timeoutAt: new Date() }
            });
            console.log(`⏰ Offer ${offer._id} auto-timed out`);
            if (liveEmitter) {
              try {
                const emitFn = liveEmitter.emitToAdmins || liveEmitter.emitLive;
                if (typeof emitFn === 'function') {
                  emitFn('manual-dispatch:timeout', {
                    offerId: offer._id,
                    bookingId: booking._id,
                    providerId: provider._id
                  });
                }
              } catch (e) {}
            }
          }
        } catch (e) {
          console.error('Auto-timeout error:', e.message);
        }
      }, DISPATCH_TIMEOUT_MS + 2000);
    }

    return res.json({
      success: true,
      message: fcmSent
        ? `🚨 Alarm sent to ${provider.name} (${provider.phone})`
        : `⚠️ Offer created but FCM failed: ${fcmError}`,
      data: {
        offerId: offer?._id || null,
        bookingId: booking._id,
        providerId: provider._id,
        providerName: provider.name,
        providerPhone: provider.phone,
        fcmSent,
        fcmError,
        fcmResult,
        expiresAt,
        timeoutMs: DISPATCH_TIMEOUT_MS
      }
    });

  } catch (err) {
    console.error('❌ [ManualDispatch] send error:', err);
    return res.status(500).json({
      success: false,
      message: err.message
    });
  }
};

// ═══════════════════════════════════════════════════════════════
// 4️⃣ GET OFFER STATUS
// ═══════════════════════════════════════════════════════════════
exports.getOfferStatus = async (req, res) => {
  try {
    const { offerId } = req.params;
    if (!offerId) {
      return res.status(400).json({ success: false, message: 'offerId required' });
    }

    const ProviderOffer = getProviderOfferModel();
    if (!ProviderOffer) {
      return res.status(500).json({
        success: false,
        message: 'ProviderOffer model not available',
        status: 'unknown'
      });
    }

    let offer = null;
    if (mongoose.Types.ObjectId.isValid(offerId)) {
      offer = await ProviderOffer.findById(offerId).lean();
    }
    if (!offer) {
      offer = await ProviderOffer.findOne({ offerId }).lean();
    }

    if (!offer) {
      return res.status(404).json({
        success: false,
        message: 'Offer not found',
        status: 'not_found'
      });
    }

    return res.json({
      success: true,
      data: {
        offerId: offer._id,
        status: offer.status,
        providerId: offer.providerId,
        bookingId: offer.bookingId,
        createdAt: offer.createdAt,
        expiresAt: offer.expiresAt,
        acceptedAt: offer.acceptedAt || null,
        rejectedAt: offer.rejectedAt || null,
        timeoutAt: offer.timeoutAt || null,
        supersededAt: offer.supersededAt || null,
        source: offer.source || 'manual_admin'
      }
    });

  } catch (err) {
    console.error('❌ [ManualDispatch] getOfferStatus error:', err);
    return res.status(500).json({
      success: false,
      message: err.message,
      status: 'error'
    });
  }
};

// ═══════════════════════════════════════════════════════════════
// 5️⃣ DEBUG — list all DB connections and their models
// ═══════════════════════════════════════════════════════════════
exports.debugConnections = async (req, res) => {
  try {
    const conns = mongoose.connections.map(c => ({
      id: c.id,
      name: c.name,
      readyState: c.readyState,
      readyStateText: ['disconnected', 'connected', 'connecting', 'disconnecting'][c.readyState] || 'unknown',
      host: c.host,
      models: Object.keys(c.models || {}),
      collections: Object.keys(c.collections || {})
    }));

    // Try sample queries
    const samples = {};
    try {
      const Provider = getProviderModel();
      if (Provider) {
        const count = await Provider.countDocuments({});
        const sample = await Provider.findOne({}).lean();
        samples.providers = {
          totalCount: count,
          sampleFields: sample ? Object.keys(sample).slice(0, 20) : [],
          sampleName: sample?.name || null,
          samplePhone: sample?.phone || null,
          hasFcmToken: !!(sample?.fcmToken && sample.fcmToken.length > 10)
        };
      } else {
        samples.providers = { error: 'Model not available' };
      }
    } catch (e) { samples.providers = { error: e.message }; }

    try {
      const Booking = getBookingModel();
      if (Booking) {
        const count = await Booking.countDocuments({});
        const dispatchable = await Booking.countDocuments({ status: { $in: DISPATCHABLE_STATUSES } });
        const sample = await Booking.findOne({}).lean();
        samples.bookings = {
          totalCount: count,
          dispatchableCount: dispatchable,
          sampleFields: sample ? Object.keys(sample).slice(0, 20) : [],
          sampleStatus: sample?.status || null
        };
      } else {
        samples.bookings = { error: 'Model not available' };
      }
    } catch (e) { samples.bookings = { error: e.message }; }

    return res.json({
      success: true,
      connections: conns,
      samples,
      config: {
        dispatchTimeoutMs: DISPATCH_TIMEOUT_MS,
        dispatchableStatuses: DISPATCHABLE_STATUSES,
        fcmServiceLoaded: !!fcmService,
        liveEmitterLoaded: !!liveEmitter
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};