// backend/src/controllers/manualDispatch.controller.js
// 🚨 MANUAL DISPATCH CONTROLLER — DATA-ONLY FCM (matches normal booking flow)
// Fix: Removed `notification` field from FCM — sends DATA-ONLY so provider app
//      onMessage handler triggers Accept/Reject popup inside the app

const mongoose = require('mongoose');

// ============================================================
// CONFIG
// ============================================================
const DISPATCH_TIMEOUT_MS = parseInt(process.env.MANUAL_DISPATCH_TIMEOUT_MS || '30000', 10);
const DISPATCHABLE_STATUSES = ['confirmed', 'searching', 'no_provider_found', 'pending'];

// ============================================================
// DATABASE CONNECTIONS
// ============================================================
let providerConn, bookingConn, adminConn;

function getProviderConn() {
  if (providerConn && providerConn.readyState === 1) return providerConn;
  try {
    const db = require('../config/database');
    providerConn = db.getProviderConnection();
    if (providerConn) return providerConn;
  } catch (e) {}
  for (const c of mongoose.connections) {
    if (c.readyState === 1 && c.name && /provider/i.test(c.name)) {
      providerConn = c;
      return c;
    }
  }
  return mongoose.connection;
}

function getBookingConn() {
  if (bookingConn && bookingConn.readyState === 1) return bookingConn;
  try {
    const db = require('../config/database');
    bookingConn = db.getBookingConnection();
    if (bookingConn) return bookingConn;
  } catch (e) {}
  for (const c of mongoose.connections) {
    if (c.readyState === 1 && c.name && /booking/i.test(c.name)) {
      bookingConn = c;
      return c;
    }
  }
  return mongoose.connection;
}

function getAdminConn() {
  if (adminConn && adminConn.readyState === 1) return adminConn;
  try {
    const db = require('../config/database');
    adminConn = db.getAdminConnection();
    if (adminConn) return adminConn;
  } catch (e) {}
  for (const c of mongoose.connections) {
    if (c.readyState === 1 && c.name && /admin/i.test(c.name)) {
      adminConn = c;
      return c;
    }
  }
  return mongoose.connection;
}

// ============================================================
// MODEL GETTERS
// ============================================================
function getProviderModel() {
  const conn = getProviderConn();
  try { return conn.model('Provider'); } catch (e) {}
  try {
    const s = new mongoose.Schema({
      name: String, providerId: String, phone: String, email: String,
      fcmToken: String, isActive: Boolean, isAvailable: Boolean,
      isAcceptingJobs: Boolean, isBusy: Boolean, verificationStatus: String,
      isVerified: Boolean, categoryId: mongoose.Schema.Types.ObjectId,
      categoryName: String, profession: String, city: String, cityId: String,
      rating: mongoose.Schema.Types.Mixed, completedJobs: Number,
      totalBookings: Number, profilePicture: String, profileImage: String,
      profilePic: String, selfieImage: mongoose.Schema.Types.Mixed,
      gender: String, lastOnlineAt: Date, currentBookingId: mongoose.Schema.Types.ObjectId,
      isOnline: Boolean
    }, { strict: false, collection: 'providers' });
    return conn.model('Provider', s);
  } catch (e) { return null; }
}

function getBookingModel() {
  const conn = getBookingConn();
  try { return conn.model('Booking'); } catch (e) {}
  try {
    const s = new mongoose.Schema({
      bookingId: String, orderId: String, customerId: mongoose.Schema.Types.ObjectId,
      customerName: String, customerPhone: String, customerEmail: String,
      providerId: mongoose.Schema.Types.ObjectId, serviceName: String,
      serviceId: mongoose.Schema.Types.ObjectId, categoryId: mongoose.Schema.Types.ObjectId,
      categoryName: String, address: String, city: String, totalAmount: Number,
      status: String, bookingType: String, scheduledDate: String,
      scheduledTime: String, description: String, notes: String
    }, { strict: false, collection: 'bookings' });
    return conn.model('Booking', s);
  } catch (e) { return null; }
}

function getOfferModel() {
  const conn = getBookingConn();
  try { return conn.model('ProviderOffer'); } catch (e) {}
  try {
    const s = new mongoose.Schema({
      bookingId: mongoose.Schema.Types.ObjectId, providerId: mongoose.Schema.Types.ObjectId,
      status: String, source: String, expiresAt: Date, respondedAt: Date,
      response: String, adminNote: String, dispatchJobId: mongoose.Schema.Types.ObjectId
    }, { strict: false, collection: 'provideroffers' });
    return conn.model('ProviderOffer', s);
  } catch (e) { return null; }
}

function getDispatchJobModel() {
  const conn = getBookingConn();
  try { return conn.model('DispatchJob'); } catch (e) {}
  try {
    const s = new mongoose.Schema({
      bookingId: mongoose.Schema.Types.ObjectId, providerId: mongoose.Schema.Types.ObjectId,
      offerId: mongoose.Schema.Types.ObjectId, status: String, source: String,
      adminNote: String, dispatchedAt: Date, expiresAt: Date, completedAt: Date,
      result: String, errorMessage: String, fcmMessageId: String
    }, { strict: false, collection: 'dispatchjobs' });
    return conn.model('DispatchJob', s);
  } catch (e) { return null; }
}

// ============================================================
// 🔥 FIREBASE INIT (one-time)
// ============================================================
let firebaseAdmin = null;
let firebaseInitialized = false;

async function initFirebase() {
  if (firebaseInitialized && firebaseAdmin) return true;

  try {
    firebaseAdmin = require('firebase-admin');
  } catch (e) {
    console.error('❌ firebase-admin not installed:', e.message);
    return false;
  }

  if (firebaseAdmin.apps.length > 0) {
    firebaseInitialized = true;
    console.log('✅ Firebase already initialized');
    return true;
  }

  const b64Keys = [
    'PROVIDER_FIREBASE_SERVICE_ACCOUNT_BASE64',
    'FIREBASE_SERVICE_ACCOUNT_BASE64',
    'FIREBASE_ADMIN_BASE64'
  ];

  let serviceAccount = null;

  for (const key of b64Keys) {
    const val = process.env[key];
    if (val && val.length > 50) {
      try {
        serviceAccount = JSON.parse(Buffer.from(val, 'base64').toString('utf8'));
        console.log(`✅ Firebase creds from ${key}`);
        break;
      } catch (e) {
        console.warn(`⚠️ ${key} parse failed`);
      }
    }
  }

  if (!serviceAccount) {
    const jsonKeys = ['PROVIDER_FIREBASE_SERVICE_ACCOUNT', 'FIREBASE_SERVICE_ACCOUNT'];
    for (const key of jsonKeys) {
      const val = process.env[key];
      if (val && val.length > 50) {
        try {
          serviceAccount = JSON.parse(val);
          console.log(`✅ Firebase creds from ${key}`);
          break;
        } catch (e) {}
      }
    }
  }

  if (!serviceAccount) {
    console.error('❌ NO Firebase credentials! Add PROVIDER_FIREBASE_SERVICE_ACCOUNT_BASE64 to Render');
    return false;
  }

  try {
    firebaseAdmin.initializeApp({
      credential: firebaseAdmin.credential.cert(serviceAccount)
    });
    firebaseInitialized = true;
    console.log('✅ Firebase initialized for provider FCM!');
    return true;
  } catch (e) {
    console.error('❌ Firebase init failed:', e.message);
    return false;
  }
}

// ============================================================
// 📲 DATA-ONLY FCM SENDER — THE KEY FIX
//
// NORMAL BOOKING sends DATA-ONLY (no `notification` field)
// → Flutter onMessage fires → App shows Accept/Reject popup
//
// MANUAL DISPATCH was sending notification + data
// → System tray notification → No popup inside app
//
// FIX: Remove `notification` field, send DATA-ONLY
// ============================================================
async function sendDataOnlyFCM(provider, booking, offerId, expiresAt) {
  const token = provider.fcmToken;
  if (!token || token.length < 10) {
    return { success: false, error: 'No valid FCM token' };
  }

  const ready = await initFirebase();
  if (!ready) {
    return { success: false, error: 'Firebase not initialized' };
  }

  const bookingId = String(booking._id);
  const serviceName = booking.serviceName || booking.categoryName || 'Service';
  const amount = booking.totalAmount || 0;
  const address = booking.address || '';
  const customerName = booking.customerName || booking.customerPhone || 'Customer';
  const customerPhone = booking.customerPhone || '';
  const categoryName = booking.categoryName || '';

  // ============================================================
  // 🔥 DATA-ONLY MESSAGE — NO `notification` FIELD!
  // This is EXACTLY how normal booking dispatch works.
  // Flutter onMessage handler reads `data` and shows popup.
  // ============================================================
  const message = {
    token: token,

    // ❌ NO `notification` field — this was the bug!
    // notification: { title: '...', body: '...' }  ← REMOVED!

    // ✅ ONLY `data` field — app handles everything
    data: {
      // === TYPE — app checks this to show popup ===
      type: 'booking_request',
      click_action: 'FLUTTER_NOTIFICATION_CLICK',

      // === CHANNEL — app uses this for alarm sound ===
      channelId: 'booking_requests',
      channel_id: 'booking_requests',
      isBookingAlarm: 'true',
      is_booking_alarm: 'true',

      // === BOOKING IDs ===
      bookingId: bookingId,
      booking_id: bookingId,
      id: bookingId,
      offerId: String(offerId),
      offer_id: String(offerId),

      // === SERVICE INFO ===
      serviceName: serviceName,
      service_name: serviceName,
      service: serviceName,
      categoryName: categoryName,
      category_name: categoryName,
      category: categoryName,

      // === CUSTOMER INFO ===
      customerName: customerName,
      customer_name: customerName,
      userName: customerName,
      user_name: customerName,
      customerPhone: customerPhone,
      customer_phone: customerPhone,
      phone: customerPhone,

      // === MONEY ===
      totalAmount: String(amount),
      total_amount: String(amount),
      amount: String(amount),
      price: String(amount),

      // === LOCATION ===
      address: address,
      city: booking.city || '',
      location: address,

      // === TIMING ===
      scheduledDate: booking.scheduledDate || '',
      scheduled_date: booking.scheduledDate || '',
      date: booking.scheduledDate || '',
      scheduledTime: booking.scheduledTime || '',
      scheduled_time: booking.scheduledTime || '',
      time: booking.scheduledTime || '',

      // === NOTIFICATION DISPLAY (app reads these to show local notification) ===
      title: '🚨 New Booking Request!',
      body: `${serviceName} — ₹${amount} — ${address.substring(0, 50)}`,
      sound: 'default',
      priority: 'max',
      importance: 'max',

      // === DISPATCH META ===
      source: 'manual_admin',
      timeoutMs: String(DISPATCH_TIMEOUT_MS),
      timeout: String(DISPATCH_TIMEOUT_MS / 1000),
      expiresAt: String(expiresAt.getTime()),
      dispatchedAt: String(Date.now()),

      // === EXTRA FLAGS ===
      isUrgent: 'true',
      showPopup: 'true',
      show_popup: 'true',
      fullScreen: 'true',
      full_screen: 'true',
      autoOpen: 'true'
    },

    // === ANDROID CONFIG (high priority for instant delivery) ===
    android: {
      priority: 'high',
      ttl: 60,
      data: {
        // Android-specific data overrides if needed
      }
    },

    // === iOS CONFIG ===
    apns: {
      headers: {
        'apns-priority': '10',
        'apns-push-type': 'background',
        'apns-expiration': String(Math.floor(Date.now() / 1000) + 60)
      },
      payload: {
        aps: {
          'content-available': 1,
          sound: 'default',
          badge: 1
        }
      }
    }
  };

  try {
    const messageId = await firebaseAdmin.messaging().send(message);
    console.log(`✅ DATA-ONLY FCM SENT! messageId: ${messageId}`);
    console.log(`   → token: ${token.substring(0, 25)}...`);
    console.log(`   → type: booking_request (data-only, no notification field)`);
    console.log(`   → booking: ${bookingId}`);
    console.log(`   → service: ${serviceName} ₹${amount}`);
    return { success: true, messageId, method: 'data_only_fcm' };
  } catch (fcmError) {
    console.error(`❌ FCM FAILED: ${fcmError.message}`);
    if (fcmError.code === 'messaging/registration-token-not-registered' ||
        fcmError.code === 'messaging/invalid-registration-token') {
      console.error(`⚠️ Provider ${provider.name} has INVALID FCM token!`);
    }
    return { success: false, error: fcmError.message, code: fcmError.code };
  }
}

// ============================================================
// SUPERSEDE OLD OFFERS
// ============================================================
async function supersedeOldOffers(bookingId) {
  const Offer = getOfferModel();
  if (!Offer) return 0;
  try {
    const result = await Offer.updateMany(
      { bookingId, status: { $in: ['pending', 'sent', 'dispatched', 'waiting'] } },
      { $set: { status: 'superseded', respondedAt: new Date(), response: 'superseded' } }
    );
    return result.modifiedCount || 0;
  } catch (e) {
    console.warn('⚠️ supersede error:', e.message);
    return 0;
  }
}

// ============================================================
// SOCKET EMIT
// ============================================================
function emitToAdmins(event, data) {
  try {
    const le = require('../services/liveEmitter');
    if (le && le.emitToAdmins) { le.emitToAdmins(event, data); return; }
  } catch (e) {}
  try {
    const le = require('../utils/liveEmitter');
    if (le && le.emitToAdmins) { le.emitToAdmins(event, data); return; }
  } catch (e) {}
  try {
    const io = require('../socket');
    const inst = io.getIO ? io.getIO() : (io.io || io);
    if (inst && inst.to) inst.to('admins').emit(event, data);
  } catch (e) {}
}

// ============================================================
// NORMALIZE HELPERS
// ============================================================
function normalizeProvider(doc) {
  if (!doc) return null;
  const p = doc.toObject ? doc.toObject() : doc;
  const r = p.rating;
  let rating = 0, ratingCount = 0;
  if (typeof r === 'object' && r) { rating = r.average || r.rating || 0; ratingCount = r.count || r.totalReviews || 0; }
  else if (typeof r === 'number') { rating = r; }
  let img = p.profilePicture || p.profileImage || p.profilePic || '';
  if (!img && p.selfieImage) img = typeof p.selfieImage === 'string' ? p.selfieImage : (p.selfieImage.url || '');
  return {
    _id: String(p._id), providerId: p.providerId || '', name: p.name || 'Unknown',
    phone: p.phone || '', email: p.email || '', profession: p.profession || p.categoryName || '',
    categoryName: p.categoryName || p.profession || '', categoryId: p.categoryId ? String(p.categoryId) : '',
    city: p.city || '', cityId: p.cityId || '',
    isAvailable: p.isAvailable !== false, isAcceptingJobs: p.isAcceptingJobs !== false,
    isBusy: p.isBusy === true, isOnline: p.isOnline !== false,
    lastOnlineAt: p.lastOnlineAt || null, verificationStatus: p.verificationStatus || 'pending',
    isVerified: p.isVerified === true || p.verificationStatus === 'approved',
    rating: Math.round(rating * 10) / 10, ratingCount,
    completedJobs: p.completedJobs || 0, totalBookings: p.totalBookings || 0,
    profileImage: img, hasFcmToken: !!(p.fcmToken && p.fcmToken.length > 10),
    currentBookingId: p.currentBookingId ? String(p.currentBookingId) : null, gender: p.gender || ''
  };
}

function normalizeBooking(doc) {
  if (!doc) return null;
  const b = doc.toObject ? doc.toObject() : doc;
  const cn = b.customerName || (b.customerId && b.customerId.name) || (b.user && b.user.name) || b.customerPhone || 'Customer';
  return {
    _id: String(b._id), bookingId: b.bookingId || String(b._id),
    customerName: cn, customerPhone: b.customerPhone || (b.customerId && b.customerId.phone) || '',
    serviceName: b.serviceName || b.service || '', categoryName: b.categoryName || '',
    address: b.address || '', city: b.city || '', totalAmount: b.totalAmount || 0,
    status: b.status || 'unknown', bookingType: b.bookingType || 'regular',
    scheduledDate: b.scheduledDate || '', scheduledTime: b.scheduledTime || '',
    createdAt: b.createdAt || new Date(), previousOfferCount: b.previousOfferCount || 0,
    providerId: b.providerId ? String(b.providerId) : null
  };
}

// ============================================================
// GET ONLINE PROVIDERS
// ============================================================
exports.getOnlineProviders = async (req, res) => {
  try {
    const Provider = getProviderModel();
    if (!Provider) return res.status(500).json({ success: false, message: 'Provider model unavailable' });

    const showAll = req.query.all === '1' || req.query.all === 'true';
    const search = (req.query.search || '').trim().toLowerCase();
    const category = (req.query.category || '').trim();

    const query = { isActive: { $ne: false } };
    if (!showAll) {
      query.$or = [{ isAvailable: true }, { isOnline: true }, { isAcceptingJobs: true }, { isBusy: false }];
    }
    if (search) {
      query.$and = query.$and || [];
      query.$and.push({
        $or: [
          { name: { $regex: search, $options: 'i' } },
          { phone: { $regex: search, $options: 'i' } },
          { providerId: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } },
          { city: { $regex: search, $options: 'i' } }
        ]
      });
    }
    if (category) {
      query.$and = query.$and || [];
      query.$and.push({
        $or: [
          { categoryName: { $regex: category, $options: 'i' } },
          { profession: { $regex: category, $options: 'i' } }
        ]
      });
    }

    const providers = await Provider.find(query).sort({ isAvailable: -1, isOnline: -1, lastOnlineAt: -1 }).limit(200).lean();
    const normalized = providers.map(normalizeProvider).filter(Boolean);
    console.log(`📊 [ManualDispatch] Returned ${normalized.length} providers (all=${showAll})`);
    res.json({ success: true, count: normalized.length, providers: normalized });
  } catch (err) {
    console.error('❌ getOnlineProviders:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ============================================================
// GET DISPATCHABLE BOOKINGS
// ============================================================
exports.getDispatchableBookings = async (req, res) => {
  try {
    const Booking = getBookingModel();
    if (!Booking) return res.status(500).json({ success: false, message: 'Booking model unavailable' });

    const bookings = await Booking.find({ status: { $in: DISPATCHABLE_STATUSES } })
      .sort({ createdAt: -1 }).limit(200).lean();
    const normalized = bookings.map(normalizeBooking).filter(Boolean);
    console.log(`📊 [ManualDispatch] Returned ${normalized.length} dispatchable bookings`);
    res.json({ success: true, count: normalized.length, bookings: normalized });
  } catch (err) {
    console.error('❌ getDispatchableBookings:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ============================================================
// 🚨 SEND DISPATCH — MAIN FLOW
// ============================================================
exports.send = async (req, res) => {
  console.log('\n' + '='.repeat(60));
  console.log(`📨 POST /api/v1/admin/manual-dispatch/send`);
  console.log(`📦 Body:`, JSON.stringify(req.body));
  console.log('='.repeat(60));

  try {
    const { bookingId, providerId, adminNote } = req.body;

    if (!bookingId || !providerId) {
      return res.status(400).json({ success: false, message: 'bookingId and providerId required' });
    }

    const Booking = getBookingModel();
    const Provider = getProviderModel();
    const Offer = getOfferModel();
    const DispatchJob = getDispatchJobModel();

    if (!Booking || !Provider) {
      return res.status(500).json({ success: false, message: 'DB models unavailable' });
    }

    // ── FIND BOOKING ──
    let booking = null;
    if (mongoose.Types.ObjectId.isValid(bookingId)) {
      booking = await Booking.findById(bookingId);
    }
    if (!booking) {
      booking = await Booking.findOne({ $or: [{ bookingId }, { orderId: bookingId }] });
    }
    if (!booking) {
      return res.status(404).json({ success: false, message: `Booking not found: ${bookingId}` });
    }

    // ── FIND PROVIDER ──
    let provider = null;
    if (mongoose.Types.ObjectId.isValid(providerId)) {
      provider = await Provider.findById(providerId);
    }
    if (!provider) {
      provider = await Provider.findOne({ providerId });
    }
    if (!provider) {
      return res.status(404).json({ success: false, message: `Provider not found: ${providerId}` });
    }

    console.log(`🚨 Dispatching booking ${booking._id} → ${provider.name} (${provider.phone})`);

    if (!provider.fcmToken || provider.fcmToken.length < 10) {
      return res.status(400).json({ success: false, message: `Provider ${provider.name} has no FCM token` });
    }

    // ── SUPERSEDE OLD OFFERS ──
    const superseded = await supersedeOldOffers(booking._id);
    console.log(`🔄 Superseded ${superseded} old offers`);

    // ── CREATE OFFER ──
    const expiresAt = new Date(Date.now() + DISPATCH_TIMEOUT_MS);
    let offer = null;
    if (Offer) {
      try {
        offer = await Offer.create({
          bookingId: booking._id, providerId: provider._id,
          status: 'pending', source: 'manual_admin',
          expiresAt, adminNote: adminNote || '', dispatchedAt: new Date()
        });
        console.log(`📝 ProviderOffer: ${offer._id}`);
      } catch (e) { console.warn('⚠️ Offer create failed:', e.message); }
    }

    // ── CREATE DISPATCH JOB (enum-safe) ──
    let dispatchJob = null;
    if (DispatchJob) {
      const statuses = ['pending', 'active', 'dispatched', 'searching', 'sent', 'waiting'];
      for (const s of statuses) {
        try {
          dispatchJob = await DispatchJob.create({
            bookingId: booking._id, providerId: provider._id,
            offerId: offer ? offer._id : null, status: s,
            source: 'manual_admin', adminNote: adminNote || '',
            dispatchedAt: new Date(), expiresAt
          });
          console.log(`📝 DispatchJob status="${s}"`);
          break;
        } catch (e) {
          if (e.message && e.message.includes('not a valid enum')) continue;
          console.warn('⚠️ DispatchJob error:', e.message);
          break;
        }
      }
    }

    // ── 🔥 SEND DATA-ONLY FCM (THE KEY FIX!) ──
    console.log(`📲 Sending DATA-ONLY FCM to ${provider.name}...`);
    console.log(`   Token: ${provider.fcmToken.substring(0, 25)}...`);
    console.log(`   Format: data-only (NO notification field)`);
    console.log(`   Channel: booking_requests`);

    let fcmResult = await sendDataOnlyFCM(provider, booking, offer ? offer._id : 'manual', expiresAt);

    // Fallback: try fcmService if direct failed
    if (!fcmResult.success) {
      console.log('🔄 Trying fcmService fallback...');
      try {
        const fcmService = require('../services/fcmService');
        if (fcmService && fcmService.sendBookingOfferToProvider) {
          const r = await fcmService.sendBookingOfferToProvider(provider, booking, {
            offerId: offer ? offer._id : 'manual', expiresAt,
            timeoutMs: DISPATCH_TIMEOUT_MS, source: 'manual_admin'
          });
          if (r && r.success) fcmResult = r;
        }
      } catch (e) { console.warn('⚠️ fcmService fallback:', e.message); }
    }

    // Update job
    if (dispatchJob && DispatchJob) {
      try {
        await DispatchJob.findByIdAndUpdate(dispatchJob._id, {
          $set: { fcmMessageId: fcmResult.messageId || '', result: fcmResult.success ? 'sent' : 'fcm_failed' }
        });
      } catch (e) {}
    }

    // ── UPDATE BOOKING STATUS → searching ──
    const oldStatus = booking.status;
    try {
      await Booking.findByIdAndUpdate(booking._id, {
        $set: { status: 'searching', providerId: provider._id, updatedAt: new Date() }
      });
      console.log(`🔄 Booking: ${oldStatus} → searching`);
    } catch (e) { console.warn('⚠️ Status update failed:', e.message); }

    // ── SOCKET EMIT ──
    const evData = {
      bookingId: String(booking._id), providerId: String(provider._id),
      providerName: provider.name, offerId: offer ? String(offer._id) : null,
      fcmSent: fcmResult.success, timestamp: new Date().toISOString()
    };
    emitToAdmins('manual-dispatch:sent', evData);
    emitToAdmins('booking:updated', { ...evData, status: 'searching' });

    // ── 30s TIMEOUT ──
    if (offer && Offer) {
      setTimeout(async () => {
        try {
          const cur = await Offer.findById(offer._id);
          if (cur && cur.status === 'pending') {
            await Offer.findByIdAndUpdate(offer._id, {
              $set: { status: 'timeout', respondedAt: new Date(), response: 'timeout_30s' }
            });
            const cb = await Booking.findById(booking._id);
            if (cb && cb.status === 'searching') {
              await Booking.findByIdAndUpdate(booking._id, { $set: { status: 'no_provider_found', providerId: null } });
            }
            if (dispatchJob && DispatchJob) {
              try { await DispatchJob.findByIdAndUpdate(dispatchJob._id, { $set: { status: 'timeout', result: 'timeout', completedAt: new Date() } }); } catch (e) {}
            }
            emitToAdmins('manual-dispatch:timeout', { bookingId: String(booking._id), offerId: String(offer._id) });
            console.log(`⏰ Offer ${offer._id} TIMEOUT`);
          }
        } catch (e) { console.error('⚠️ Timeout error:', e.message); }
      }, DISPATCH_TIMEOUT_MS + 2000);
    }

    // ── RESPONSE ──
    console.log(`✅ Dispatch complete! FCM: ${fcmResult.success ? 'SENT' : 'FAILED'}`);
    console.log('='.repeat(60) + '\n');

    res.json({
      success: true,
      message: fcmResult.success
        ? `🔔 Data-only FCM sent to ${provider.name} — popup should appear!`
        : `Offer created but FCM failed: ${fcmResult.error}`,
      data: {
        offerId: offer ? String(offer._id) : null,
        dispatchJobId: dispatchJob ? String(dispatchJob._id) : null,
        bookingId: String(booking._id),
        providerId: String(provider._id),
        providerName: provider.name,
        fcmSent: fcmResult.success,
        fcmMethod: fcmResult.method || 'unknown',
        fcmError: fcmResult.success ? null : fcmResult.error,
        expiresAt: expiresAt.toISOString(),
        timeoutMs: DISPATCH_TIMEOUT_MS,
        oldStatus, newStatus: 'searching'
      }
    });

  } catch (err) {
    console.error('❌ send error:', err.message, err.stack);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ============================================================
// GET OFFER STATUS
// ============================================================
exports.getOfferStatus = async (req, res) => {
  try {
    const { offerId } = req.params;
    if (!offerId) return res.status(400).json({ success: false, message: 'offerId required' });
    const Offer = getOfferModel();
    if (!Offer) return res.status(500).json({ success: false, message: 'Offer model unavailable' });
    const offer = await Offer.findById(offerId).lean();
    if (!offer) return res.status(404).json({ success: false, message: 'Offer not found' });
    res.json({
      success: true,
      offer: {
        _id: String(offer._id), status: offer.status,
        response: offer.response || '', respondedAt: offer.respondedAt || null,
        expiresAt: offer.expiresAt || null, createdAt: offer.createdAt || null
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ============================================================
// DEBUG
// ============================================================
exports.debugConnections = async (req, res) => {
  try {
    const conns = mongoose.connections.map(c => ({
      name: c.name, readyState: c.readyState, host: c.host, models: Object.keys(c.models || {})
    }));
    let firebaseStatus = 'not_checked';
    try {
      const a = require('firebase-admin');
      firebaseStatus = a.apps.length > 0 ? `initialized (${a.apps.length} apps)` : 'no apps';
    } catch (e) { firebaseStatus = 'not installed'; }

    res.json({
      success: true, connections: conns, firebaseStatus,
      envVars: {
        PROVIDER_FIREBASE_SERVICE_ACCOUNT_BASE64: !!(process.env.PROVIDER_FIREBASE_SERVICE_ACCOUNT_BASE64 && process.env.PROVIDER_FIREBASE_SERVICE_ACCOUNT_BASE64.length > 50),
        FIREBASE_SERVICE_ACCOUNT_BASE64: !!(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64 && process.env.FIREBASE_SERVICE_ACCOUNT_BASE64.length > 50)
      },
      fcmFormat: 'DATA-ONLY (no notification field — matches normal booking)',
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};