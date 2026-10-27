// backend/src/controllers/manualDispatch.controller.js
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');

const DISPATCH_TIMEOUT_MS = parseInt(process.env.MANUAL_DISPATCH_TIMEOUT_MS || '30000', 10);

// ============================================================
// DATABASE CONNECTIONS
// ============================================================
let providerConn, bookingConn;

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
      serviceName: String, serviceIcon: String, categoryId: mongoose.Schema.Types.ObjectId,
      categoryName: String, address: String, city: String, totalAmount: Number,
      baseAmount: Number, servicePrice: String, status: String,
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
      dispatchedAt: Date, expiresAt: Date, result: String, fcmMessageId: String
    }, { strict: false, collection: 'dispatchjobs' }));
  } catch (e) { return null; }
}

// ============================================================
// 🔥 BULLETPROOF FIREBASE INIT
//
// ROOT CAUSE: admin.credential is undefined in firebase-admin v12+
// FIX: Try ALL possible APIs + use NAMED app to avoid conflicts
// ============================================================
let providerMessaging = null;

function loadServiceAccount() {
  const paths = [
    path.join(__dirname, '../config/serviceproviderapp-b7767-firebase-adminsdk.json'),
    path.join(__dirname, '../../config/serviceproviderapp-b7767-firebase-adminsdk.json'),
    path.join(process.cwd(), 'src/config/serviceproviderapp-b7767-firebase-adminsdk.json'),
    path.join(process.cwd(), 'config/serviceproviderapp-b7767-firebase-adminsdk.json'),
  ];
  if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
    paths.unshift(path.resolve(process.cwd(), process.env.FIREBASE_SERVICE_ACCOUNT_PATH));
  }
  for (const fp of paths) {
    try {
      if (fs.existsSync(fp)) {
        const sa = JSON.parse(fs.readFileSync(fp, 'utf8'));
        if (sa.project_id && sa.private_key) {
          console.log('✅ SA loaded from file: ' + fp);
          return sa;
        }
      }
    } catch (e) {}
  }
  const b64keys = ['PROVIDER_FIREBASE_SERVICE_ACCOUNT_BASE64', 'FIREBASE_SERVICE_ACCOUNT_BASE64'];
  for (const k of b64keys) {
    try {
      const v = process.env[k];
      if (v && typeof v === 'string' && v.trim().length > 50) {
        const sa = JSON.parse(Buffer.from(v.trim(), 'base64').toString('utf8'));
        if (sa.project_id && sa.private_key) {
          console.log('✅ SA loaded from env: ' + k);
          return sa;
        }
      }
    } catch (e) { console.warn('⚠️ ' + k + ' parse failed'); }
  }
  return null;
}

async function getProviderMessaging() {
  if (providerMessaging) return providerMessaging;

  let admin;
  try { admin = require('firebase-admin'); } catch (e) {
    console.error('❌ firebase-admin not installed');
    return null;
  }

  // Check if 'provider' app already exists
  try {
    const existingApp = admin.app('provider');
    if (existingApp) {
      providerMessaging = admin.messaging(existingApp);
      console.log('✅ Reusing existing "provider" Firebase app');
      return providerMessaging;
    }
  } catch (e) {
    // App doesn't exist yet — that's fine
  }

  const sa = loadServiceAccount();
  if (!sa) {
    console.error('❌ No service account found!');
    console.error('   Set PROVIDER_FIREBASE_SERVICE_ACCOUNT_BASE64 in Render');
    return null;
  }

  console.log('🔄 Initializing Firebase for provider (project: ' + sa.project_id + ')...');

  // ── APPROACH 1: admin.credential.cert() (v11 and below) ──
  try {
    if (admin.credential && typeof admin.credential.cert === 'function') {
      console.log('🔄 Approach 1: admin.credential.cert()');
      const app = admin.initializeApp({
        credential: admin.credential.cert(sa),
        projectId: sa.project_id,
      }, 'provider');
      providerMessaging = admin.messaging(app);
      console.log('✅ Approach 1 SUCCESS');
      return providerMessaging;
    } else {
      console.log('⚠️ admin.credential.cert not available');
    }
  } catch (e) {
    console.warn('⚠️ Approach 1 failed: ' + e.message);
  }

  // ── APPROACH 2: modular cert() from firebase-admin/app (v12+) ──
  try {
    console.log('🔄 Approach 2: modular cert() from firebase-admin/app');
    const appModule = require('firebase-admin/app');
    if (appModule && typeof appModule.cert === 'function' && typeof appModule.initializeApp === 'function') {
      const app = appModule.initializeApp({
        credential: appModule.cert(sa),
        projectId: sa.project_id,
      }, 'provider');
      const msgModule = require('firebase-admin/messaging');
      if (msgModule && typeof msgModule.getMessaging === 'function') {
        providerMessaging = msgModule.getMessaging(app);
      } else {
        providerMessaging = admin.messaging(app);
      }
      console.log('✅ Approach 2 SUCCESS');
      return providerMessaging;
    } else {
      console.log('⚠️ firebase-admin/app not available');
    }
  } catch (e) {
    console.warn('⚠️ Approach 2 failed: ' + e.message);
  }

  // ── APPROACH 3: Use default app if it matches provider project ──
  try {
    console.log('🔄 Approach 3: check default app');
    if (admin.apps && admin.apps.length > 0) {
      const defaultApp = admin.apps[0];
      console.log('   Default app project: ' + (defaultApp.options ? defaultApp.options.projectId : 'unknown'));
      providerMessaging = admin.messaging(defaultApp);
      console.log('✅ Approach 3 SUCCESS (using default app)');
      return providerMessaging;
    }
  } catch (e) {
    console.warn('⚠️ Approach 3 failed: ' + e.message);
  }

  // ── APPROACH 4: Initialize default app (no name) ──
  try {
    console.log('🔄 Approach 4: initialize default app');
    const app = admin.initializeApp({
      credential: sa,
      projectId: sa.project_id,
    });
    providerMessaging = admin.messaging(app);
    console.log('✅ Approach 4 SUCCESS');
    return providerMessaging;
  } catch (e) {
    if (e.message && e.message.indexOf('already exists') !== -1) {
      providerMessaging = admin.messaging();
      console.log('✅ Approach 4 SUCCESS (app existed)');
      return providerMessaging;
    }
    console.warn('⚠️ Approach 4 failed: ' + e.message);
  }

  console.error('❌ ALL Firebase approaches failed!');
  console.error('   firebase-admin version: ' + (admin.SDK_VERSION || 'unknown'));
  console.error('   admin.credential exists: ' + !!admin.credential);
  console.error('   admin.apps count: ' + (admin.apps ? admin.apps.length : 0));
  return null;
}

// ============================================================
// 📲 HYBRID ALARM FCM — EXACT MATCH with provider backend
// ============================================================
async function sendHybridAlarmFCM(provider, booking) {
  const token = provider.fcmToken;
  if (!token || typeof token !== 'string' || token.length < 10) {
    return { success: false, error: 'No valid FCM token' };
  }

  console.log('📲 getProviderMessaging()...');
  const messaging = await getProviderMessaging();
  if (!messaging) {
    return { success: false, error: 'Firebase messaging not available' };
  }

  // ── Format price (exact match) ──
  let exactPrice = 0;
  let priceDisplay = '';
  if (booking.totalAmount && !isNaN(parseFloat(String(booking.totalAmount)))) {
    exactPrice = parseFloat(String(booking.totalAmount));
  } else if (booking.baseAmount && !isNaN(parseFloat(String(booking.baseAmount)))) {
    exactPrice = parseFloat(String(booking.baseAmount));
  }
  if (exactPrice > 0) {
    priceDisplay = exactPrice % 1 === 0 ? '₹' + exactPrice.toFixed(0) : '₹' + exactPrice.toFixed(2);
  } else if (booking.servicePrice) {
    priceDisplay = String(booking.servicePrice);
  } else {
    priceDisplay = 'Price TBD';
  }

  const serviceName = booking.serviceName || 'Service';
  const address = booking.address || '';
  const shortAddress = address.length > 50 ? address.substring(0, 47) + '...' : address;
  const scheduledTime = booking.scheduledTime || '';
  const bookingIdStr = String(booking._id);

  let body = serviceName + ' • ' + priceDisplay;
  if (scheduledTime) body += ' • ' + scheduledTime;
  if (shortAddress) body += '\n📍 ' + shortAddress;

  const fcmTitle = '🔔 New Booking! ' + priceDisplay;
  const fcmBody = body;

  // ── EXACT data fields from fcmService.sendNewBookingNotification ──
  const stringData = {
    type: 'booking_request',
    bookingId: bookingIdStr,
    bookingObjectId: bookingIdStr,
    actionUrl: '/booking-detail?bookingId=' + bookingIdStr,
    serviceName: serviceName,
    serviceIcon: booking.serviceIcon || '🔧',
    categoryName: booking.categoryName || '',
    customerName: booking.customerName || 'Customer',
    totalAmount: String(exactPrice || 0),
    baseAmount: String(booking.baseAmount || 0),
    servicePrice: booking.servicePrice || '',
    priceDisplay: priceDisplay,
    scheduledTime: scheduledTime,
    scheduledDate: booking.scheduledDate || '',
    address: address,
    city: booking.city || '',
    priority: 'high',
    channelId: 'bookings_alarm',
    category: 'booking_request',
    clickAction: 'OPEN_BOOKING',
    timeout: String(Math.floor(DISPATCH_TIMEOUT_MS / 1000)),
    expiresAt: String(Date.now() + DISPATCH_TIMEOUT_MS),
    isExclusive: 'true',
    source: 'manual_admin',
    _isBookingAlarm: 'true',
    _source: 'fcm',
    _sentAt: String(Date.now()),
    sound: 'booking_alarm',
    title: fcmTitle,
    body: fcmBody,
  };

  // ── HYBRID message (notification + data + android.notification) ──
  const message = {
    token: token,
    notification: { title: fcmTitle, body: fcmBody },
    data: stringData,
    android: {
      priority: 'high',
      ttl: 120000,
      collapseKey: 'booking_' + bookingIdStr,
      notification: {
        channelId: 'bookings_alarm',
        sound: 'booking_alarm',
        priority: 'max',
        visibility: 'public',
        defaultSound: false,
        defaultVibrateTimings: false,
        vibrateTimingsMillis: [0, 1000, 500, 1000, 500, 1000],
        notificationPriority: 'PRIORITY_MAX',
        color: '#EF4444',
        title: fcmTitle,
        body: fcmBody,
      }
    },
    apns: {
      headers: {
        'apns-priority': '10',
        'apns-expiration': String(Math.floor(Date.now() / 1000) + 120),
      },
      payload: {
        aps: {
          sound: 'booking_alarm.caf',
          'interruption-level': 'time-sensitive',
          alert: { title: fcmTitle, body: fcmBody }
        }
      }
    }
  };

  try {
    console.log('📲 Sending FCM via messaging.send()...');
    const messageId = await messaging.send(message);
    console.log('✅ HYBRID ALARM FCM SENT! ID: ' + messageId);
    return { success: true, messageId: messageId, method: 'hybrid_alarm' };
  } catch (err) {
    const msg = err && err.message ? err.message : String(err);
    console.error('❌ FCM FAILED: ' + msg);
    return { success: false, error: msg };
  }
}

// ============================================================
// 📲 CANCELLATION FCM to old provider
// ============================================================
async function sendCancellationFCM(oldProvider, bookingId) {
  if (!oldProvider || !oldProvider.fcmToken || typeof oldProvider.fcmToken !== 'string' || oldProvider.fcmToken.length < 10) return;
  const messaging = await getProviderMessaging();
  if (!messaging) return;
  try {
    await messaging.send({
      token: oldProvider.fcmToken,
      notification: { title: '❌ Booking Cancelled', body: 'Reassigned by admin' },
      data: {
        type: 'booking_cancelled', bookingId: String(bookingId),
        reason: 'admin_reassigned', channelId: 'default',
        _source: 'fcm', _sentAt: String(Date.now()),
        title: '❌ Booking Cancelled', body: 'Reassigned by admin',
      },
      android: { priority: 'high', ttl: 30000 },
    });
    console.log('✅ Cancellation sent to ' + oldProvider.name);
  } catch (e) { console.warn('⚠️ Cancel FCM: ' + e.message); }
}

// ============================================================
// HELPERS
// ============================================================
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
    if (search) { query.$and = query.$and || []; query.$and.push({ $or: [{ name: { $regex: search, $options: 'i' } }, { phone: { $regex: search, $options: 'i' } }, { providerId: { $regex: search, $options: 'i' } }] }); }
    if (category) { query.$and = query.$and || []; query.$and.push({ $or: [{ categoryName: { $regex: category, $options: 'i' } }, { profession: { $regex: category, $options: 'i' } }] }); }
    const providers = await Provider.find(query).sort({ isAvailable: -1, lastOnlineAt: -1 }).limit(200).lean();
    const normalized = providers.map(normalizeProvider).filter(Boolean);
    console.log('📊 Returned ' + normalized.length + ' providers');
    res.json({ success: true, count: normalized.length, providers: normalized });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// ============================================================
// GET DISPATCHABLE BOOKINGS
// ============================================================
exports.getDispatchableBookings = async (req, res) => {
  try {
    const Booking = getBookingModel();
    if (!Booking) return res.status(500).json({ success: false, message: 'Booking model unavailable' });
    const bookings = await Booking.find({ status: { $in: ['confirmed', 'searching', 'no_provider_found', 'pending', 'assigned', 'accepted', 'in_progress'] } }).sort({ createdAt: -1 }).limit(200).lean();
    const normalized = bookings.map(normalizeBooking).filter(Boolean);
    console.log('📊 Returned ' + normalized.length + ' bookings');
    res.json({ success: true, count: normalized.length, bookings: normalized });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// ============================================================
// 🚨 FORCE RE-DISPATCH
// ============================================================
exports.send = async (req, res) => {
  console.log('\n' + '='.repeat(60));
  console.log('📨 FORCE RE-DISPATCH');
  console.log('📦 Body:', JSON.stringify(req.body));
  console.log('='.repeat(60));

  try {
    const { bookingId, providerId, adminNote } = req.body;
    if (!bookingId || !providerId) return res.status(400).json({ success: false, message: 'bookingId and providerId required' });

    const Booking = getBookingModel();
    const Provider = getProviderModel();
    const Offer = getOfferModel();
    const DispatchJob = getDispatchJobModel();
    if (!Booking || !Provider) return res.status(500).json({ success: false, message: 'DB models unavailable' });

    let booking = null;
    if (mongoose.Types.ObjectId.isValid(bookingId)) booking = await Booking.findById(bookingId);
    if (!booking) booking = await Booking.findOne({ $or: [{ bookingId: bookingId }, { orderId: bookingId }] });
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

    const oldStatus = booking.status;
    const oldProviderId = booking.providerId;

    let newProvider = null;
    if (mongoose.Types.ObjectId.isValid(providerId)) newProvider = await Provider.findById(providerId);
    if (!newProvider) newProvider = await Provider.findOne({ providerId: providerId });
    if (!newProvider) return res.status(404).json({ success: false, message: 'Provider not found' });

    console.log('📋 Booking: ' + booking._id + ' | Status: ' + oldStatus);
    console.log('🎯 Target: ' + newProvider.name + ' | FCM token: ' + (newProvider.fcmToken ? newProvider.fcmToken.substring(0, 15) + '...' : 'NONE'));

    if (!newProvider.fcmToken || typeof newProvider.fcmToken !== 'string' || newProvider.fcmToken.length < 10) {
      return res.status(400).json({ success: false, message: 'Provider has no FCM token' });
    }

    // CANCEL OLD PROVIDER
    if (oldProviderId && String(oldProviderId) !== String(newProvider._id)) {
      try {
        const oldP = await Provider.findById(oldProviderId);
        if (oldP) {
          console.log('🔄 Cancelling old: ' + oldP.name);
          await sendCancellationFCM(oldP, booking._id);
          if (Offer) await Offer.updateMany({ bookingId: booking._id, providerId: oldP._id, status: { $in: ['pending', 'accepted', 'sent'] } }, { $set: { status: 'cancelled', respondedAt: new Date() } });
          await Provider.findByIdAndUpdate(oldP._id, { $set: { currentBookingId: null, isBusy: false, isAvailable: true } });
        }
      } catch (e) { console.warn('⚠️ Cancel old: ' + e.message); }
    }

    // SUPERSEDE
    if (Offer) { try { await Offer.updateMany({ bookingId: booking._id, status: { $in: ['pending', 'sent', 'dispatched'] } }, { $set: { status: 'superseded', respondedAt: new Date() } }); } catch (e) {} }

    // RESET BOOKING
    try {
      await Booking.findByIdAndUpdate(booking._id, { $set: { status: 'searching', providerId: newProvider._id, updatedAt: new Date() } });
      console.log('🔄 Status: ' + oldStatus + ' → searching');
    } catch (e) {}

    // CREATE OFFER
    const expiresAt = new Date(Date.now() + DISPATCH_TIMEOUT_MS);
    let offer = null;
    if (Offer) { try { offer = await Offer.create({ bookingId: booking._id, providerId: newProvider._id, status: 'pending', source: 'manual_admin', expiresAt: expiresAt }); console.log('📝 Offer: ' + offer._id); } catch (e) {} }

    // CREATE JOB
    let dispatchJob = null;
    if (DispatchJob) {
      for (const s of ['pending', 'active', 'dispatched', 'searching', 'sent']) {
        try { dispatchJob = await DispatchJob.create({ bookingId: booking._id, providerId: newProvider._id, offerId: offer ? offer._id : null, status: s, source: 'manual_admin', dispatchedAt: new Date(), expiresAt: expiresAt }); break; } catch (e) { if (e.message && e.message.indexOf('enum') !== -1) continue; break; }
      }
    }

    // 🔥 SEND HYBRID ALARM FCM
    console.log('📲 Sending HYBRID ALARM FCM...');
    const fcmResult = await sendHybridAlarmFCM(newProvider, booking);

    if (dispatchJob && DispatchJob) { try { await DispatchJob.findByIdAndUpdate(dispatchJob._id, { $set: { fcmMessageId: fcmResult.messageId || '', result: fcmResult.success ? 'sent' : 'fcm_failed' } }); } catch (e) {} }

    emitToAdmins('manual-dispatch:sent', { bookingId: String(booking._id), providerName: newProvider.name, fcmSent: fcmResult.success });

    if (offer && Offer) {
      setTimeout(async () => {
        try {
          const cur = await Offer.findById(offer._id);
          if (cur && cur.status === 'pending') {
            await Offer.findByIdAndUpdate(offer._id, { $set: { status: 'timeout', respondedAt: new Date() } });
            const cb = await Booking.findById(booking._id);
            if (cb && cb.status === 'searching') await Booking.findByIdAndUpdate(booking._id, { $set: { status: 'no_provider_found', providerId: null } });
            emitToAdmins('manual-dispatch:timeout', { bookingId: String(booking._id) });
          }
        } catch (e) {}
      }, DISPATCH_TIMEOUT_MS + 2000);
    }

    console.log('✅ FCM: ' + (fcmResult.success ? 'SENT ✅' : 'FAILED ❌ ' + fcmResult.error));
    console.log('='.repeat(60) + '\n');

    res.json({
      success: true,
      message: fcmResult.success ? 'Hybrid alarm sent!' : 'FCM failed: ' + fcmResult.error,
      data: { offerId: offer ? String(offer._id) : null, bookingId: String(booking._id), providerName: newProvider.name, fcmSent: fcmResult.success, fcmError: fcmResult.success ? null : fcmResult.error, oldStatus: oldStatus, newStatus: 'searching' }
    });
  } catch (err) {
    console.error('❌ Error: ' + err.message, err.stack);
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getOfferStatus = async (req, res) => {
  try {
    const Offer = getOfferModel();
    if (!Offer) return res.status(500).json({ success: false, message: 'Offer model unavailable' });
    const offer = await Offer.findById(req.params.offerId).lean();
    if (!offer) return res.status(404).json({ success: false, message: 'Offer not found' });
    res.json({ success: true, offer: { _id: String(offer._id), status: offer.status, respondedAt: offer.respondedAt, expiresAt: offer.expiresAt } });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.debugConnections = async (req, res) => {
  try {
    let fbInfo = { status: 'not_checked', version: 'unknown', apps: 0, credentialExists: false };
    try {
      const a = require('firebase-admin');
      fbInfo.version = a.SDK_VERSION || 'unknown';
      fbInfo.apps = a.apps ? a.apps.length : 0;
      fbInfo.credentialExists = !!(a.credential);
      fbInfo.status = fbInfo.apps > 0 ? 'initialized' : 'no apps';
    } catch (e) { fbInfo.status = 'not installed'; }

    const sa = loadServiceAccount();
    const messaging = await getProviderMessaging();

    res.json({
      success: true, firebase: fbInfo,
      serviceAccountFound: !!sa,
      serviceAccountProject: sa ? sa.project_id : 'none',
      messagingReady: !!messaging,
      fcmFormat: 'HYBRID ALARM',
      channelId: 'bookings_alarm', sound: 'booking_alarm',
      timestamp: new Date().toISOString()
    });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};