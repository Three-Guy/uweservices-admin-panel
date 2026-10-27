// backend/src/controllers/manualDispatch.controller.js
const mongoose = require('mongoose');

const DISPATCH_TIMEOUT_MS = parseInt(process.env.MANUAL_DISPATCH_TIMEOUT_MS || '30000', 10);
const DISPATCHABLE_STATUSES = ['confirmed', 'searching', 'no_provider_found', 'pending'];

// ============================================================
// DATABASE CONNECTIONS
// ============================================================
let providerConn, bookingConn, adminConn;

function getProviderConn() {
  if (providerConn && providerConn.readyState === 1) return providerConn;
  try { const db = require('../config/database'); providerConn = db.getProviderConnection(); if (providerConn) return providerConn; } catch (e) {}
  for (const c of mongoose.connections) { if (c.readyState === 1 && c.name && /provider/i.test(c.name)) { providerConn = c; return c; } }
  return mongoose.connection;
}

function getBookingConn() {
  if (bookingConn && bookingConn.readyState === 1) return bookingConn;
  try { const db = require('../config/database'); bookingConn = db.getBookingConnection(); if (bookingConn) return bookingConn; } catch (e) {}
  for (const c of mongoose.connections) { if (c.readyState === 1 && c.name && /booking/i.test(c.name)) { bookingConn = c; return c; } }
  return mongoose.connection;
}

function getAdminConn() {
  if (adminConn && adminConn.readyState === 1) return adminConn;
  try { const db = require('../config/database'); adminConn = db.getAdminConnection(); if (adminConn) return adminConn; } catch (e) {}
  for (const c of mongoose.connections) { if (c.readyState === 1 && c.name && /admin/i.test(c.name)) { adminConn = c; return c; } }
  return mongoose.connection;
}

// ============================================================
// MODEL GETTERS
// ============================================================
function getProviderModel() {
  const conn = getProviderConn();
  try { return conn.model('Provider'); } catch (e) {}
  try {
    return conn.model('Provider', new mongoose.Schema({
      name: String, providerId: String, phone: String, email: String, fcmToken: String,
      isActive: Boolean, isAvailable: Boolean, isAcceptingJobs: Boolean, isBusy: Boolean,
      verificationStatus: String, isVerified: Boolean, categoryId: mongoose.Schema.Types.ObjectId,
      categoryName: String, profession: String, city: String, cityId: String,
      rating: mongoose.Schema.Types.Mixed, completedJobs: Number, totalBookings: Number,
      profilePicture: String, profileImage: String, profilePic: String,
      selfieImage: mongoose.Schema.Types.Mixed, gender: String, lastOnlineAt: Date,
      currentBookingId: mongoose.Schema.Types.ObjectId, isOnline: Boolean
    }, { strict: false, collection: 'providers' }));
  } catch (e) { return null; }
}

function getBookingModel() {
  const conn = getBookingConn();
  try { return conn.model('Booking'); } catch (e) {}
  try {
    return conn.model('Booking', new mongoose.Schema({
      bookingId: String, orderId: String, customerId: mongoose.Schema.Types.ObjectId,
      customerName: String, customerPhone: String, providerId: mongoose.Schema.Types.ObjectId,
      serviceName: String, categoryId: mongoose.Schema.Types.ObjectId, categoryName: String,
      address: String, city: String, totalAmount: Number, status: String,
      bookingType: String, scheduledDate: String, scheduledTime: String
    }, { strict: false, collection: 'bookings' }));
  } catch (e) { return null; }
}

function getOfferModel() {
  const conn = getBookingConn();
  try { return conn.model('ProviderOffer'); } catch (e) {}
  try {
    return conn.model('ProviderOffer', new mongoose.Schema({
      bookingId: mongoose.Schema.Types.ObjectId, providerId: mongoose.Schema.Types.ObjectId,
      status: String, source: String, expiresAt: Date, respondedAt: Date,
      response: String, adminNote: String
    }, { strict: false, collection: 'provideroffers' }));
  } catch (e) { return null; }
}

function getDispatchJobModel() {
  const conn = getBookingConn();
  try { return conn.model('DispatchJob'); } catch (e) {}
  try {
    return conn.model('DispatchJob', new mongoose.Schema({
      bookingId: mongoose.Schema.Types.ObjectId, providerId: mongoose.Schema.Types.ObjectId,
      offerId: mongoose.Schema.Types.ObjectId, status: String, source: String,
      adminNote: String, dispatchedAt: Date, expiresAt: Date, result: String,
      fcmMessageId: String
    }, { strict: false, collection: 'dispatchjobs' }));
  } catch (e) { return null; }
}

// ============================================================
// 🔥 FIREBASE INIT — BULLETPROOF (fixes the crash)
// ============================================================
let firebaseAdmin = null;
let firebaseReady = false;

async function initFirebase() {
  if (firebaseReady) return true;

  // Step 1: require firebase-admin safely
  try {
    firebaseAdmin = require('firebase-admin');
  } catch (e) {
    console.error('❌ firebase-admin package not found');
    return false;
  }

  if (!firebaseAdmin) {
    console.error('❌ firebase-admin is null after require');
    return false;
  }

  // Step 2: check if already initialized (SAFE null check)
  try {
    const apps = firebaseAdmin.apps;
    if (apps && Array.isArray(apps) && apps.length > 0) {
      firebaseReady = true;
      console.log('✅ Firebase already initialized (' + apps.length + ' apps)');
      return true;
    }
  } catch (e) {
    console.warn('⚠️ firebaseAdmin.apps check failed:', e.message);
  }

  // Step 3: find credentials from env vars (SAFE null checks)
  let serviceAccount = null;

  const envKeys = [
    'PROVIDER_FIREBASE_SERVICE_ACCOUNT_BASE64',
    'FIREBASE_SERVICE_ACCOUNT_BASE64',
    'FIREBASE_ADMIN_BASE64',
    'PROVIDER_FIREBASE_SERVICE_ACCOUNT',
    'FIREBASE_SERVICE_ACCOUNT'
  ];

  for (let i = 0; i < envKeys.length; i++) {
    const key = envKeys[i];
    let val = null;
    try { val = process.env[key]; } catch (e) { continue; }

    // SAFE check: val must be a non-empty string
    if (!val || typeof val !== 'string') continue;
    val = val.trim();
    if (val.length < 10) continue;

    // Try base64 decode first
    if (key.indexOf('BASE64') !== -1) {
      try {
        const decoded = Buffer.from(val, 'base64').toString('utf8');
        serviceAccount = JSON.parse(decoded);
        console.log('✅ Firebase creds loaded from ' + key + ' (base64)');
        break;
      } catch (e) {
        console.warn('⚠️ ' + key + ' base64 decode failed: ' + e.message);
      }
    }

    // Try direct JSON parse
    if (!serviceAccount) {
      try {
        serviceAccount = JSON.parse(val);
        console.log('✅ Firebase creds loaded from ' + key + ' (json)');
        break;
      } catch (e) {
        console.warn('⚠️ ' + key + ' JSON parse failed: ' + e.message);
      }
    }
  }

  // Step 4: try file path
  if (!serviceAccount) {
    try {
      const filePath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
      if (filePath && typeof filePath === 'string' && filePath.length > 5) {
        const fs = require('fs');
        if (fs.existsSync(filePath)) {
          serviceAccount = JSON.parse(fs.readFileSync(filePath, 'utf8'));
          console.log('✅ Firebase creds from file: ' + filePath);
        }
      }
    } catch (e) {
      console.warn('⚠️ File credentials failed: ' + e.message);
    }
  }

  // Step 5: try loading from local config file
  if (!serviceAccount) {
    try {
      const path = require('path');
      const configPath = path.join(__dirname, '../config/serviceproviderapp-b7767-firebase-adminsdk.json');
      const fs = require('fs');
      if (fs.existsSync(configPath)) {
        serviceAccount = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        console.log('✅ Firebase creds from local config file');
      }
    } catch (e) {
      console.warn('⚠️ Local config file failed: ' + e.message);
    }
  }

  if (!serviceAccount) {
    console.error('❌ NO Firebase credentials found anywhere!');
    console.error('   Set PROVIDER_FIREBASE_SERVICE_ACCOUNT_BASE64 in Render env vars');
    return false;
  }

  // Step 6: initialize
  try {
    firebaseAdmin.initializeApp({
      credential: firebaseAdmin.credential.cert(serviceAccount)
    });
    firebaseReady = true;
    console.log('✅ Firebase initialized successfully!');
    return true;
  } catch (e) {
    console.error('❌ Firebase init failed: ' + e.message);
    // Check if it's "already exists" error — that's fine
    if (e.message && e.message.indexOf('already exists') !== -1) {
      firebaseReady = true;
      console.log('✅ Firebase app already exists, using it');
      return true;
    }
    return false;
  }
}

// ============================================================
// 📲 DATA-ONLY FCM — NO notification FIELD (popup fix)
// ============================================================
async function sendDataOnlyFCM(provider, booking, offerId, expiresAt) {
  const token = provider.fcmToken;
  if (!token || typeof token !== 'string' || token.length < 10) {
    return { success: false, error: 'No valid FCM token' };
  }

  const ready = await initFirebase();
  if (!ready || !firebaseAdmin) {
    return { success: false, error: 'Firebase not initialized' };
  }

  const bookingId = String(booking._id);
  const serviceName = booking.serviceName || booking.categoryName || 'Service';
  const amount = String(booking.totalAmount || 0);
  const address = booking.address || '';
  const customerName = booking.customerName || booking.customerPhone || 'Customer';
  const customerPhone = booking.customerPhone || '';
  const categoryName = booking.categoryName || '';
  const title = 'New Booking Request!';
  const body = serviceName + ' - Rs.' + amount + ' - ' + address.substring(0, 40);

  // ============================================================
  // DATA-ONLY MESSAGE
  // NO `notification` field — this is the popup fix!
  // Flutter onMessage reads `data` and shows Accept/Reject popup
  // ============================================================
  const message = {
    token: token,
    data: {
      type: 'booking_request',
      click_action: 'FLUTTER_NOTIFICATION_CLICK',
      channelId: 'booking_requests',
      channel_id: 'booking_requests',
      isBookingAlarm: 'true',
      is_booking_alarm: 'true',
      bookingId: bookingId,
      booking_id: bookingId,
      id: bookingId,
      offerId: String(offerId),
      offer_id: String(offerId),
      serviceName: serviceName,
      service_name: serviceName,
      service: serviceName,
      categoryName: categoryName,
      category_name: categoryName,
      category: categoryName,
      customerName: customerName,
      customer_name: customerName,
      userName: customerName,
      customerPhone: customerPhone,
      customer_phone: customerPhone,
      phone: customerPhone,
      totalAmount: amount,
      total_amount: amount,
      amount: amount,
      price: amount,
      address: address,
      city: booking.city || '',
      location: address,
      scheduledDate: booking.scheduledDate || '',
      scheduled_date: booking.scheduledDate || '',
      date: booking.scheduledDate || '',
      scheduledTime: booking.scheduledTime || '',
      scheduled_time: booking.scheduledTime || '',
      time: booking.scheduledTime || '',
      title: title,
      body: body,
      sound: 'default',
      priority: 'max',
      importance: 'max',
      source: 'manual_admin',
      timeoutMs: String(DISPATCH_TIMEOUT_MS),
      timeout: String(Math.floor(DISPATCH_TIMEOUT_MS / 1000)),
      expiresAt: String(expiresAt.getTime()),
      dispatchedAt: String(Date.now()),
      isUrgent: 'true',
      showPopup: 'true',
      show_popup: 'true',
      fullScreen: 'true',
      full_screen: 'true',
      autoOpen: 'true'
    },
    android: {
      priority: 'high',
      ttl: 60
    },
    apns: {
      headers: {
        'apns-priority': '10',
        'apns-push-type': 'background'
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
    const messaging = firebaseAdmin.messaging();
    const messageId = await messaging.send(message);
    console.log('✅ DATA-ONLY FCM SENT! ID: ' + messageId);
    console.log('   Token: ' + token.substring(0, 20) + '...');
    console.log('   Booking: ' + bookingId);
    console.log('   Service: ' + serviceName + ' Rs.' + amount);
    return { success: true, messageId: messageId, method: 'data_only' };
  } catch (fcmError) {
    const errMsg = fcmError && fcmError.message ? fcmError.message : String(fcmError);
    const errCode = fcmError && fcmError.code ? fcmError.code : 'unknown';
    console.error('❌ FCM FAILED: ' + errMsg);
    if (errCode === 'messaging/registration-token-not-registered' || errCode === 'messaging/invalid-registration-token') {
      console.error('⚠️ Provider ' + provider.name + ' has INVALID FCM token!');
    }
    return { success: false, error: errMsg, code: errCode };
  }
}

// ============================================================
// HELPERS
// ============================================================
async function supersedeOldOffers(bookingId) {
  const Offer = getOfferModel();
  if (!Offer) return 0;
  try {
    const r = await Offer.updateMany(
      { bookingId: bookingId, status: { $in: ['pending', 'sent', 'dispatched', 'waiting'] } },
      { $set: { status: 'superseded', respondedAt: new Date(), response: 'superseded' } }
    );
    return r.modifiedCount || 0;
  } catch (e) { return 0; }
}

function emitToAdmins(event, data) {
  try { const le = require('../services/liveEmitter'); if (le && le.emitToAdmins) { le.emitToAdmins(event, data); return; } } catch (e) {}
  try { const le = require('../utils/liveEmitter'); if (le && le.emitToAdmins) { le.emitToAdmins(event, data); return; } } catch (e) {}
  try { const io = require('../socket'); const inst = io.getIO ? io.getIO() : io; if (inst && inst.to) inst.to('admins').emit(event, data); } catch (e) {}
}

function normalizeProvider(doc) {
  if (!doc) return null;
  const p = doc.toObject ? doc.toObject() : doc;
  const r = p.rating;
  let rating = 0, rc = 0;
  if (r && typeof r === 'object') { rating = r.average || r.rating || 0; rc = r.count || 0; }
  else if (typeof r === 'number') { rating = r; }
  let img = p.profilePicture || p.profileImage || p.profilePic || '';
  if (!img && p.selfieImage) img = typeof p.selfieImage === 'string' ? p.selfieImage : (p.selfieImage.url || '');
  return {
    _id: String(p._id), providerId: p.providerId || '', name: p.name || 'Unknown',
    phone: p.phone || '', email: p.email || '', profession: p.profession || p.categoryName || '',
    categoryName: p.categoryName || '', categoryId: p.categoryId ? String(p.categoryId) : '',
    city: p.city || '', isAvailable: p.isAvailable !== false,
    isAcceptingJobs: p.isAcceptingJobs !== false, isBusy: p.isBusy === true,
    isOnline: p.isOnline !== false, verificationStatus: p.verificationStatus || 'pending',
    isVerified: p.isVerified === true || p.verificationStatus === 'approved',
    rating: Math.round(rating * 10) / 10, ratingCount: rc,
    completedJobs: p.completedJobs || 0, profileImage: img,
    hasFcmToken: !!(p.fcmToken && typeof p.fcmToken === 'string' && p.fcmToken.length > 10),
    gender: p.gender || ''
  };
}

function normalizeBooking(doc) {
  if (!doc) return null;
  const b = doc.toObject ? doc.toObject() : doc;
  return {
    _id: String(b._id), bookingId: b.bookingId || String(b._id),
    customerName: b.customerName || b.customerPhone || 'Customer',
    customerPhone: b.customerPhone || '', serviceName: b.serviceName || '',
    categoryName: b.categoryName || '', address: b.address || '',
    city: b.city || '', totalAmount: b.totalAmount || 0,
    status: b.status || 'unknown', bookingType: b.bookingType || 'regular',
    scheduledDate: b.scheduledDate || '', scheduledTime: b.scheduledTime || '',
    createdAt: b.createdAt || new Date(), providerId: b.providerId ? String(b.providerId) : null
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
    if (!showAll) query.$or = [{ isAvailable: true }, { isOnline: true }, { isAcceptingJobs: true }];
    if (search) {
      query.$and = query.$and || [];
      query.$and.push({ $or: [{ name: { $regex: search, $options: 'i' } }, { phone: { $regex: search, $options: 'i' } }, { providerId: { $regex: search, $options: 'i' } }] });
    }
    if (category) {
      query.$and = query.$and || [];
      query.$and.push({ $or: [{ categoryName: { $regex: category, $options: 'i' } }, { profession: { $regex: category, $options: 'i' } }] });
    }
    const providers = await Provider.find(query).sort({ isAvailable: -1, lastOnlineAt: -1 }).limit(200).lean();
    const normalized = providers.map(normalizeProvider).filter(Boolean);
    console.log('📊 Returned ' + normalized.length + ' providers (all=' + showAll + ')');
    res.json({ success: true, count: normalized.length, providers: normalized });
  } catch (err) {
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
    const bookings = await Booking.find({ status: { $in: DISPATCHABLE_STATUSES } }).sort({ createdAt: -1 }).limit(200).lean();
    const normalized = bookings.map(normalizeBooking).filter(Boolean);
    console.log('📊 Returned ' + normalized.length + ' dispatchable bookings');
    res.json({ success: true, count: normalized.length, bookings: normalized });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ============================================================
// 🚨 SEND DISPATCH
// ============================================================
exports.send = async (req, res) => {
  console.log('\n============================================================');
  console.log('📨 POST /api/v1/admin/manual-dispatch/send');
  console.log('📦 Body:', JSON.stringify(req.body));
  console.log('============================================================');

  try {
    const { bookingId, providerId, adminNote } = req.body;
    if (!bookingId || !providerId) {
      return res.status(400).json({ success: false, message: 'bookingId and providerId required' });
    }

    const Booking = getBookingModel();
    const Provider = getProviderModel();
    const Offer = getOfferModel();
    const DispatchJob = getDispatchJobModel();
    if (!Booking || !Provider) return res.status(500).json({ success: false, message: 'DB models unavailable' });

    // FIND BOOKING
    let booking = null;
    if (mongoose.Types.ObjectId.isValid(bookingId)) booking = await Booking.findById(bookingId);
    if (!booking) booking = await Booking.findOne({ $or: [{ bookingId: bookingId }, { orderId: bookingId }] });
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

    // FIND PROVIDER
    let provider = null;
    if (mongoose.Types.ObjectId.isValid(providerId)) provider = await Provider.findById(providerId);
    if (!provider) provider = await Provider.findOne({ providerId: providerId });
    if (!provider) return res.status(404).json({ success: false, message: 'Provider not found' });

    console.log('🚨 Dispatching ' + booking._id + ' → ' + provider.name + ' (' + provider.phone + ')');

    if (!provider.fcmToken || typeof provider.fcmToken !== 'string' || provider.fcmToken.length < 10) {
      return res.status(400).json({ success: false, message: 'Provider has no FCM token' });
    }

    // SUPERSEDE
    const sup = await supersedeOldOffers(booking._id);
    console.log('🔄 Superseded ' + sup + ' old offers');

    // CREATE OFFER
    const expiresAt = new Date(Date.now() + DISPATCH_TIMEOUT_MS);
    let offer = null;
    if (Offer) {
      try {
        offer = await Offer.create({
          bookingId: booking._id, providerId: provider._id,
          status: 'pending', source: 'manual_admin',
          expiresAt: expiresAt, adminNote: adminNote || ''
        });
        console.log('📝 Offer: ' + offer._id);
      } catch (e) { console.warn('⚠️ Offer create failed: ' + e.message); }
    }

    // CREATE DISPATCH JOB
    let dispatchJob = null;
    if (DispatchJob) {
      const tries = ['pending', 'active', 'dispatched', 'searching', 'sent', 'waiting'];
      for (let i = 0; i < tries.length; i++) {
        try {
          dispatchJob = await DispatchJob.create({
            bookingId: booking._id, providerId: provider._id,
            offerId: offer ? offer._id : null, status: tries[i],
            source: 'manual_admin', dispatchedAt: new Date(), expiresAt: expiresAt
          });
          console.log('📝 DispatchJob status=' + tries[i]);
          break;
        } catch (e) {
          if (e.message && e.message.indexOf('not a valid enum') !== -1) continue;
          break;
        }
      }
    }

    // 🔥 SEND DATA-ONLY FCM
    console.log('📲 Sending DATA-ONLY FCM (no notification field)...');
    console.log('   Token: ' + provider.fcmToken.substring(0, 20) + '...');

    let fcmResult = await sendDataOnlyFCM(provider, booking, offer ? offer._id : 'manual', expiresAt);

    // Fallback to fcmService
    if (!fcmResult.success) {
      console.log('🔄 Trying fcmService fallback...');
      try {
        const fcmService = require('../services/fcmService');
        if (fcmService && typeof fcmService.sendBookingOfferToProvider === 'function') {
          const r = await fcmService.sendBookingOfferToProvider(provider, booking, {
            offerId: offer ? offer._id : 'manual', expiresAt: expiresAt,
            timeoutMs: DISPATCH_TIMEOUT_MS, source: 'manual_admin'
          });
          if (r && r.success) fcmResult = r;
        }
      } catch (e) { console.warn('⚠️ fcmService fallback: ' + e.message); }
    }

    // Update job
    if (dispatchJob && DispatchJob) {
      try {
        await DispatchJob.findByIdAndUpdate(dispatchJob._id, {
          $set: { fcmMessageId: fcmResult.messageId || '', result: fcmResult.success ? 'sent' : 'fcm_failed' }
        });
      } catch (e) {}
    }

    // UPDATE BOOKING STATUS
    const oldStatus = booking.status;
    try {
      await Booking.findByIdAndUpdate(booking._id, {
        $set: { status: 'searching', providerId: provider._id, updatedAt: new Date() }
      });
      console.log('🔄 Booking: ' + oldStatus + ' → searching');
    } catch (e) { console.warn('⚠️ Status update: ' + e.message); }

    // SOCKET
    emitToAdmins('manual-dispatch:sent', {
      bookingId: String(booking._id), providerId: String(provider._id),
      providerName: provider.name, fcmSent: fcmResult.success
    });

    // 30s TIMEOUT
    if (offer && Offer) {
      setTimeout(async () => {
        try {
          const cur = await Offer.findById(offer._id);
          if (cur && cur.status === 'pending') {
            await Offer.findByIdAndUpdate(offer._id, { $set: { status: 'timeout', respondedAt: new Date() } });
            const cb = await Booking.findById(booking._id);
            if (cb && cb.status === 'searching') {
              await Booking.findByIdAndUpdate(booking._id, { $set: { status: 'no_provider_found', providerId: null } });
            }
            emitToAdmins('manual-dispatch:timeout', { bookingId: String(booking._id) });
            console.log('⏰ Offer ' + offer._id + ' TIMEOUT');
          }
        } catch (e) {}
      }, DISPATCH_TIMEOUT_MS + 2000);
    }

    console.log('✅ Done! FCM: ' + (fcmResult.success ? 'SENT' : 'FAILED - ' + fcmResult.error));
    console.log('============================================================\n');

    res.json({
      success: true,
      message: fcmResult.success ? 'Data-only FCM sent — popup should appear!' : 'FCM failed: ' + fcmResult.error,
      data: {
        offerId: offer ? String(offer._id) : null,
        bookingId: String(booking._id),
        providerName: provider.name,
        fcmSent: fcmResult.success,
        fcmError: fcmResult.success ? null : fcmResult.error,
        timeoutMs: DISPATCH_TIMEOUT_MS
      }
    });
  } catch (err) {
    console.error('❌ send error: ' + err.message);
    console.error(err.stack);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ============================================================
// GET OFFER STATUS
// ============================================================
exports.getOfferStatus = async (req, res) => {
  try {
    const Offer = getOfferModel();
    if (!Offer) return res.status(500).json({ success: false, message: 'Offer model unavailable' });
    const offer = await Offer.findById(req.params.offerId).lean();
    if (!offer) return res.status(404).json({ success: false, message: 'Offer not found' });
    res.json({ success: true, offer: { _id: String(offer._id), status: offer.status, respondedAt: offer.respondedAt, expiresAt: offer.expiresAt } });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// ============================================================
// DEBUG
// ============================================================
exports.debugConnections = async (req, res) => {
  try {
    let fbStatus = 'not_checked';
    try {
      const a = require('firebase-admin');
      const apps = a && a.apps ? a.apps : [];
      fbStatus = apps.length > 0 ? 'initialized (' + apps.length + ' apps)' : 'no apps';
    } catch (e) { fbStatus = 'not installed'; }

    const envCheck = {};
    const keys = ['PROVIDER_FIREBASE_SERVICE_ACCOUNT_BASE64', 'FIREBASE_SERVICE_ACCOUNT_BASE64'];
    for (let i = 0; i < keys.length; i++) {
      const v = process.env[keys[i]];
      envCheck[keys[i]] = !!(v && typeof v === 'string' && v.trim().length > 50);
    }

    res.json({ success: true, firebaseStatus: fbStatus, envVars: envCheck, fcmFormat: 'DATA-ONLY', timestamp: new Date().toISOString() });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};