// backend/src/controllers/manualDispatch.controller.js
// 🚨 FORCE RE-DISPATCH — EXACT MATCH with Provider Backend FCM Format
// Matches: fcmService.sendNewBookingNotification() HYBRID ALARM mode
// Channel: bookings_alarm | Sound: booking_alarm | isBookingAlarm: true
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
      bookingType: String, scheduledDate: String, scheduledTime: String,
      scheduledDateTime: Date, latitude: Number, longitude: Number
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
// 🔥 FIREBASE INIT — EXACT COPY of provider backend logic
//
// Provider backend uses: admin.credential.cert(serviceAccount)
// from config/firebase.config.js with local JSON file.
// We do the SAME thing here.
// ============================================================
let firebaseAdmin = null;
let firebaseReady = false;

function loadServiceAccount() {
  // Try multiple locations for the service account JSON
  const possiblePaths = [
    path.join(__dirname, '../config/serviceproviderapp-b7767-firebase-adminsdk.json'),
    path.join(__dirname, '../../config/serviceproviderapp-b7767-firebase-adminsdk.json'),
    path.join(process.cwd(), 'src/config/serviceproviderapp-b7767-firebase-adminsdk.json'),
    path.join(process.cwd(), 'config/serviceproviderapp-b7767-firebase-adminsdk.json'),
  ];

  // Also try env var path
  if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
    possiblePaths.unshift(path.resolve(process.cwd(), process.env.FIREBASE_SERVICE_ACCOUNT_PATH));
  }

  for (const fp of possiblePaths) {
    try {
      if (fs.existsSync(fp)) {
        const sa = JSON.parse(fs.readFileSync(fp, 'utf8'));
        if (sa.project_id && sa.private_key && sa.client_email) {
          console.log('✅ Service account loaded from: ' + fp);
          return sa;
        }
      }
    } catch (e) {}
  }

  // Try base64 env var
  const b64Keys = ['PROVIDER_FIREBASE_SERVICE_ACCOUNT_BASE64', 'FIREBASE_SERVICE_ACCOUNT_BASE64'];
  for (const key of b64Keys) {
    try {
      const val = process.env[key];
      if (val && typeof val === 'string' && val.trim().length > 50) {
        const sa = JSON.parse(Buffer.from(val.trim(), 'base64').toString('utf8'));
        if (sa.project_id && sa.private_key && sa.client_email) {
          console.log('✅ Service account loaded from env: ' + key);
          return sa;
        }
      }
    } catch (e) {}
  }

  return null;
}

async function initFirebase() {
  if (firebaseReady && firebaseAdmin) return true;

  try {
    firebaseAdmin = require('firebase-admin');
  } catch (e) {
    console.error('❌ firebase-admin not installed');
    return false;
  }

  // Check if already initialized
  try {
    if (firebaseAdmin.apps && Array.isArray(firebaseAdmin.apps) && firebaseAdmin.apps.length > 0) {
      firebaseReady = true;
      console.log('✅ Firebase already initialized (' + firebaseAdmin.apps.length + ' apps)');
      return true;
    }
  } catch (e) {}

  // Load service account
  const serviceAccount = loadServiceAccount();
  if (!serviceAccount) {
    console.error('❌ No service account found!');
    return false;
  }

  // Initialize — try multiple approaches
  // APPROACH 1: admin.credential.cert() — same as provider backend
  try {
    if (firebaseAdmin.credential && typeof firebaseAdmin.credential.cert === 'function') {
      firebaseAdmin.initializeApp({
        credential: firebaseAdmin.credential.cert(serviceAccount),
        projectId: serviceAccount.project_id,
      });
      firebaseReady = true;
      console.log('✅ Firebase initialized via admin.credential.cert()');
      return true;
    }
  } catch (e) {
    if (e.message && e.message.indexOf('already exists') !== -1) {
      firebaseReady = true;
      return true;
    }
    console.warn('⚠️ Approach 1 failed: ' + e.message);
  }

  // APPROACH 2: modular cert()
  try {
    const appModule = require('firebase-admin/app');
    if (appModule && typeof appModule.cert === 'function') {
      appModule.initializeApp({
        credential: appModule.cert(serviceAccount),
        projectId: serviceAccount.project_id,
      });
      firebaseReady = true;
      console.log('✅ Firebase initialized via modular cert()');
      return true;
    }
  } catch (e) {
    if (e.message && e.message.indexOf('already exists') !== -1) {
      firebaseReady = true;
      return true;
    }
    console.warn('⚠️ Approach 2 failed: ' + e.message);
  }

  // APPROACH 3: direct object
  try {
    firebaseAdmin.initializeApp({
      credential: serviceAccount,
      projectId: serviceAccount.project_id,
    });
    firebaseReady = true;
    console.log('✅ Firebase initialized via direct object');
    return true;
  } catch (e) {
    if (e.message && e.message.indexOf('already exists') !== -1) {
      firebaseReady = true;
      return true;
    }
    console.warn('⚠️ Approach 3 failed: ' + e.message);
  }

  console.error('❌ All Firebase init approaches failed');
  return false;
}

// ============================================================
// 📲 HYBRID ALARM FCM — EXACT MATCH with provider backend
//
// This matches fcmService.sendNewBookingNotification() +
// firebase.config.js sendToDevice() with isBookingAlarm: true
//
// KEY FIELDS that trigger popup in provider app:
// - notification.title + notification.body (OS renders in bg)
// - data._isBookingAlarm = 'true' (JS handler shows modal)
// - data.channelId = 'bookings_alarm' (alarm sound channel)
// - data.clickAction = 'OPEN_BOOKING' (opens booking screen)
// - android.notification.channelId = 'bookings_alarm'
// - android.notification.sound = 'booking_alarm'
// - android.notification.priority = 'max'
// ============================================================
async function sendHybridAlarmFCM(provider, booking) {
  const token = provider.fcmToken;
  if (!token || typeof token !== 'string' || token.length < 10) {
    return { success: false, error: 'No valid FCM token' };
  }

  const ready = await initFirebase();
  if (!ready || !firebaseAdmin) {
    return { success: false, error: 'Firebase not initialized' };
  }

  // ── Format price (EXACT match with provider backend) ──
  let exactPrice = 0;
  let priceDisplay = '';

  if (booking.totalAmount && !isNaN(parseFloat(String(booking.totalAmount)))) {
    exactPrice = parseFloat(String(booking.totalAmount));
  } else if (booking.baseAmount && !isNaN(parseFloat(String(booking.baseAmount)))) {
    exactPrice = parseFloat(String(booking.baseAmount));
  }

  if (exactPrice > 0) {
    priceDisplay = exactPrice % 1 === 0 ? '₹' + exactPrice.toFixed(0) : '₹' + exactPrice.toFixed(2);
  } else if (booking.servicePrice && typeof booking.servicePrice === 'string') {
    priceDisplay = booking.servicePrice;
  } else {
    priceDisplay = 'Price TBD';
  }

  const serviceName = booking.serviceName || 'Service';
  const address = booking.address || '';
  const shortAddress = address.length > 50 ? address.substring(0, 47) + '...' : address;
  const scheduledTime = booking.scheduledTime || '';
  const bookingIdStr = String(booking._id);

  // ── Notification block (OS renders when killed/background) ──
  let body = serviceName + ' • ' + priceDisplay;
  if (scheduledTime) body += ' • ' + scheduledTime;
  if (shortAddress) body += '\n📍 ' + shortAddress;

  const fcmTitle = '🔔 New Booking! ' + priceDisplay;
  const fcmBody = body;

  // ── Data block (JS handler reads when foreground) ──
  // EXACT match with fcmService.sendNewBookingNotification data fields
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

    // ── HYBRID ALARM FLAGS (these trigger the popup!) ──
    _isBookingAlarm: 'true',
    _source: 'fcm',
    _sentAt: String(Date.now()),
    sound: 'booking_alarm',
    title: fcmTitle,
    body: fcmBody,
  };

  // ── Build message EXACTLY like firebase.config.js sendToDevice() ──
  const message = {
    token: token,

    // ✅ notification block — OS renders when app killed/background
    notification: {
      title: fcmTitle,
      body: fcmBody,
    },

    // ✅ data block — JS handler reads when app foreground
    data: stringData,

    // ✅ Android config — alarm channel + sound
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

    // ✅ iOS config — time-sensitive alarm
    apns: {
      headers: {
        'apns-priority': '10',
        'apns-expiration': String(Math.floor(Date.now() / 1000) + 120),
        'apns-collapse-id': 'booking_' + bookingIdStr,
      },
      payload: {
        aps: {
          sound: 'booking_alarm.caf',
          'interruption-level': 'time-sensitive',
          alert: {
            title: fcmTitle,
            body: fcmBody,
          }
        }
      }
    }
  };

  try {
    const messaging = firebaseAdmin.messaging();
    const messageId = await messaging.send(message);
    console.log('✅ HYBRID ALARM FCM SENT!');
    console.log('   messageId: ' + messageId);
    console.log('   token: ' + token.substring(0, 20) + '...');
    console.log('   title: ' + fcmTitle);
    console.log('   channelId: bookings_alarm');
    console.log('   sound: booking_alarm');
    console.log('   isBookingAlarm: true');
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
  const ready = await initFirebase();
  if (!ready || !firebaseAdmin) return;

  try {
    await firebaseAdmin.messaging().send({
      token: oldProvider.fcmToken,
      notification: { title: '❌ Booking Cancelled', body: 'This booking has been reassigned by admin' },
      data: {
        type: 'booking_cancelled',
        bookingId: String(bookingId),
        reason: 'admin_reassigned',
        channelId: 'default',
        _source: 'fcm',
        _sentAt: String(Date.now()),
        title: '❌ Booking Cancelled',
        body: 'Reassigned by admin',
      },
      android: { priority: 'high', ttl: 30000 },
    });
    console.log('✅ Cancellation sent to ' + oldProvider.name);
  } catch (e) {
    console.warn('⚠️ Cancellation FCM failed: ' + e.message);
  }
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
    console.log('📊 Returned ' + normalized.length + ' providers');
    res.json({ success: true, count: normalized.length, providers: normalized });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// ============================================================
// GET DISPATCHABLE BOOKINGS — ALL active statuses
// ============================================================
exports.getDispatchableBookings = async (req, res) => {
  try {
    const Booking = getBookingModel();
    if (!Booking) return res.status(500).json({ success: false, message: 'Booking model unavailable' });
    const allStatuses = ['confirmed', 'searching', 'no_provider_found', 'pending', 'assigned', 'accepted', 'in_progress'];
    const bookings = await Booking.find({ status: { $in: allStatuses } }).sort({ createdAt: -1 }).limit(200).lean();
    const normalized = bookings.map(normalizeBooking).filter(Boolean);
    console.log('📊 Returned ' + normalized.length + ' bookings');
    res.json({ success: true, count: normalized.length, bookings: normalized });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// ============================================================
// 🚨 FORCE RE-DISPATCH — MAIN FLOW
//
// 1. Find booking (ANY status — even assigned/accepted)
// 2. Find NEW provider
// 3. If old provider exists → cancel their offer + FCM
// 4. Reset booking → "searching"
// 5. Create new offer
// 6. Send HYBRID ALARM FCM (exact match with provider backend)
// 7. 30s timeout
// ============================================================
exports.send = async (req, res) => {
  console.log('\n' + '='.repeat(60));
  console.log('📨 FORCE RE-DISPATCH (HYBRID ALARM FCM)');
  console.log('📦 Body:', JSON.stringify(req.body));
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
    if (!Booking || !Provider) return res.status(500).json({ success: false, message: 'DB models unavailable' });

    // ── FIND BOOKING (any status) ──
    let booking = null;
    if (mongoose.Types.ObjectId.isValid(bookingId)) booking = await Booking.findById(bookingId);
    if (!booking) booking = await Booking.findOne({ $or: [{ bookingId: bookingId }, { orderId: bookingId }] });
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

    const oldStatus = booking.status;
    const oldProviderId = booking.providerId;
    console.log('📋 Booking: ' + booking._id + ' | Status: ' + oldStatus + ' | Old Provider: ' + (oldProviderId || 'none'));

    // ── FIND NEW PROVIDER ──
    let newProvider = null;
    if (mongoose.Types.ObjectId.isValid(providerId)) newProvider = await Provider.findById(providerId);
    if (!newProvider) newProvider = await Provider.findOne({ providerId: providerId });
    if (!newProvider) return res.status(404).json({ success: false, message: 'Provider not found: ' + providerId });

    console.log('🎯 NEW Provider: ' + newProvider.name + ' (' + newProvider.phone + ')');

    if (!newProvider.fcmToken || typeof newProvider.fcmToken !== 'string' || newProvider.fcmToken.length < 10) {
      return res.status(400).json({ success: false, message: 'Provider ' + newProvider.name + ' has no FCM token' });
    }

    // ── CANCEL OLD PROVIDER (if different) ──
    let oldProviderCancelled = false;
    if (oldProviderId && String(oldProviderId) !== String(newProvider._id)) {
      try {
        const oldProvider = await Provider.findById(oldProviderId);
        if (oldProvider) {
          console.log('🔄 Cancelling old provider: ' + oldProvider.name);
          await sendCancellationFCM(oldProvider, booking._id);
          if (Offer) {
            await Offer.updateMany(
              { bookingId: booking._id, providerId: oldProvider._id, status: { $in: ['pending', 'accepted', 'sent'] } },
              { $set: { status: 'cancelled', respondedAt: new Date(), response: 'admin_reassigned' } }
            );
          }
          await Provider.findByIdAndUpdate(oldProvider._id, { $set: { currentBookingId: null, isBusy: false, isAvailable: true } });
          oldProviderCancelled = true;
          console.log('✅ Old provider ' + oldProvider.name + ' cancelled');
        }
      } catch (e) { console.warn('⚠️ Old provider cancel: ' + e.message); }
    }

    // ── SUPERSEDE OTHER PENDING OFFERS ──
    if (Offer) {
      try {
        await Offer.updateMany(
          { bookingId: booking._id, status: { $in: ['pending', 'sent', 'dispatched', 'waiting'] } },
          { $set: { status: 'superseded', respondedAt: new Date() } }
        );
      } catch (e) {}
    }

    // ── RESET BOOKING → searching ──
    try {
      await Booking.findByIdAndUpdate(booking._id, {
        $set: { status: 'searching', providerId: newProvider._id, updatedAt: new Date() }
      });
      console.log('🔄 Status: ' + oldStatus + ' → searching');
    } catch (e) { console.warn('⚠️ Status reset: ' + e.message); }

    // ── CREATE OFFER ──
    const expiresAt = new Date(Date.now() + DISPATCH_TIMEOUT_MS);
    let offer = null;
    if (Offer) {
      try {
        offer = await Offer.create({
          bookingId: booking._id, providerId: newProvider._id,
          status: 'pending', source: 'manual_admin_force',
          expiresAt: expiresAt, adminNote: adminNote || 'Force re-dispatch'
        });
        console.log('📝 Offer: ' + offer._id);
      } catch (e) { console.warn('⚠️ Offer: ' + e.message); }
    }

    // ── CREATE DISPATCH JOB ──
    let dispatchJob = null;
    if (DispatchJob) {
      const tries = ['pending', 'active', 'dispatched', 'searching', 'sent', 'waiting'];
      for (let i = 0; i < tries.length; i++) {
        try {
          dispatchJob = await DispatchJob.create({
            bookingId: booking._id, providerId: newProvider._id,
            offerId: offer ? offer._id : null, status: tries[i],
            source: 'manual_admin_force', dispatchedAt: new Date(), expiresAt: expiresAt
          });
          break;
        } catch (e) {
          if (e.message && e.message.indexOf('not a valid enum') !== -1) continue;
          break;
        }
      }
    }

    // ── 🔥 SEND HYBRID ALARM FCM (EXACT MATCH with provider backend) ──
    console.log('📲 Sending HYBRID ALARM FCM to ' + newProvider.name + '...');
    console.log('   Format: notification + data + android.notification');
    console.log('   Channel: bookings_alarm | Sound: booking_alarm');
    console.log('   isBookingAlarm: true');

    const fcmResult = await sendHybridAlarmFCM(newProvider, booking);

    if (dispatchJob && DispatchJob) {
      try {
        await DispatchJob.findByIdAndUpdate(dispatchJob._id, {
          $set: { fcmMessageId: fcmResult.messageId || '', result: fcmResult.success ? 'sent' : 'fcm_failed' }
        });
      } catch (e) {}
    }

    // ── SOCKET ──
    emitToAdmins('manual-dispatch:sent', {
      bookingId: String(booking._id), providerId: String(newProvider._id),
      providerName: newProvider.name, fcmSent: fcmResult.success,
      oldProviderCancelled: oldProviderCancelled
    });

    // ── 30s TIMEOUT ──
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

    console.log('✅ DONE! FCM: ' + (fcmResult.success ? 'SENT ✅' : 'FAILED ❌ ' + fcmResult.error));
    console.log('='.repeat(60) + '\n');

    res.json({
      success: true,
      message: fcmResult.success
        ? '🔔 Hybrid alarm sent to ' + newProvider.name + (oldProviderCancelled ? ' (old provider cancelled)' : '')
        : 'FCM failed: ' + fcmResult.error,
      data: {
        offerId: offer ? String(offer._id) : null,
        bookingId: String(booking._id),
        newProvider: { id: String(newProvider._id), name: newProvider.name },
        oldProviderCancelled: oldProviderCancelled,
        fcmSent: fcmResult.success,
        fcmMethod: fcmResult.method || null,
        fcmError: fcmResult.success ? null : fcmResult.error,
        oldStatus: oldStatus, newStatus: 'searching',
        timeoutMs: DISPATCH_TIMEOUT_MS
      }
    });
  } catch (err) {
    console.error('❌ Error: ' + err.message);
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

    const sa = loadServiceAccount();

    res.json({
      success: true,
      firebaseStatus: fbStatus,
      serviceAccountFound: !!sa,
      serviceAccountProject: sa ? sa.project_id : 'none',
      fcmFormat: 'HYBRID ALARM (notification + data + android.notification)',
      channelId: 'bookings_alarm',
      sound: 'booking_alarm',
      isBookingAlarm: true,
      timestamp: new Date().toISOString()
    });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};