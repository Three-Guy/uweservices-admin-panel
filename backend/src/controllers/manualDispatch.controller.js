// backend/src/controllers/manualDispatch.controller.js
// 🚨 FORCE RE-DISPATCH with FIREBASE FIX (handles both old + new firebase-admin)
const mongoose = require('mongoose');

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
      dispatchedAt: Date, expiresAt: Date, result: String, fcmMessageId: String
    }, { strict: false, collection: 'dispatchjobs' }));
  } catch (e) { return null; }
}

// ============================================================
// 🔥 FIREBASE INIT — FIXES "credential is undefined" ERROR
//
// Problem: firebase-admin v12+ uses modular API
//   OLD: admin.credential.cert(sa)     ← undefined in v12+
//   NEW: cert(sa) from 'firebase-admin/app'
//
// This code tries ALL approaches automatically
// ============================================================
let firebaseMessaging = null;
let firebaseReady = false;

async function initFirebase() {
  if (firebaseReady && firebaseMessaging) return true;

  // ── STEP 1: Try to use EXISTING firebase-admin (from fcmService.js) ──
  try {
    const existingAdmin = require('firebase-admin');
    if (existingAdmin && existingAdmin.apps && Array.isArray(existingAdmin.apps) && existingAdmin.apps.length > 0) {
      console.log('✅ Using EXISTING Firebase app (already initialized by fcmService)');
      try {
        firebaseMessaging = existingAdmin.messaging();
        if (firebaseMessaging) {
          firebaseReady = true;
          console.log('✅ Firebase messaging ready from existing app!');
          return true;
        }
      } catch (e) {
        console.warn('⚠️ existing app messaging() failed: ' + e.message);
      }
    }
  } catch (e) {
    console.log('ℹ️ No existing firebase-admin found');
  }

  // ── STEP 2: Load credentials from env ──
  let serviceAccount = null;
  const envKeys = [
    'PROVIDER_FIREBASE_SERVICE_ACCOUNT_BASE64',
    'FIREBASE_SERVICE_ACCOUNT_BASE64',
    'FIREBASE_ADMIN_BASE64'
  ];

  for (let i = 0; i < envKeys.length; i++) {
    let val = null;
    try { val = process.env[envKeys[i]]; } catch (e) { continue; }
    if (!val || typeof val !== 'string') continue;
    val = val.trim();
    if (val.length < 10) continue;
    try {
      serviceAccount = JSON.parse(Buffer.from(val, 'base64').toString('utf8'));
      console.log('✅ Firebase creds loaded from ' + envKeys[i]);
      break;
    } catch (e) {
      console.warn('⚠️ ' + envKeys[i] + ' decode failed');
    }
  }

  if (!serviceAccount) {
    const jsonKeys = ['PROVIDER_FIREBASE_SERVICE_ACCOUNT', 'FIREBASE_SERVICE_ACCOUNT'];
    for (let i = 0; i < jsonKeys.length; i++) {
      let val = null;
      try { val = process.env[jsonKeys[i]]; } catch (e) { continue; }
      if (!val || typeof val !== 'string' || val.trim().length < 10) continue;
      try { serviceAccount = JSON.parse(val.trim()); console.log('✅ Creds from ' + jsonKeys[i]); break; } catch (e) {}
    }
  }

  if (!serviceAccount) {
    try {
      const path = require('path');
      const fs = require('fs');
      const fp = path.join(__dirname, '../config/serviceproviderapp-b7767-firebase-adminsdk.json');
      if (fs.existsSync(fp)) {
        serviceAccount = JSON.parse(fs.readFileSync(fp, 'utf8'));
        console.log('✅ Creds from local config file');
      }
    } catch (e) {}
  }

  if (!serviceAccount) {
    console.error('❌ NO Firebase credentials found!');
    return false;
  }

  // ── STEP 3: Initialize with MULTIPLE approaches ──
  let admin = null;
  try { admin = require('firebase-admin'); } catch (e) {
    console.error('❌ firebase-admin not installed');
    return false;
  }

  // Check again if already initialized (race condition)
  try {
    if (admin.apps && Array.isArray(admin.apps) && admin.apps.length > 0) {
      firebaseMessaging = admin.messaging();
      firebaseReady = true;
      console.log('✅ Firebase already initialized (race check)');
      return true;
    }
  } catch (e) {}

  // APPROACH A: admin.credential.cert() — firebase-admin v11 and below
  try {
    if (admin.credential && typeof admin.credential.cert === 'function') {
      console.log('🔄 Trying Approach A: admin.credential.cert()');
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
      firebaseMessaging = admin.messaging();
      firebaseReady = true;
      console.log('✅ Firebase initialized via Approach A!');
      return true;
    } else {
      console.log('⚠️ admin.credential.cert not available (v12+?)');
    }
  } catch (e) {
    console.warn('⚠️ Approach A failed: ' + e.message);
  }

  // APPROACH B: cert() from 'firebase-admin/app' — firebase-admin v12+
  try {
    console.log('🔄 Trying Approach B: cert() from firebase-admin/app');
    const appModule = require('firebase-admin/app');
    if (appModule && typeof appModule.cert === 'function') {
      appModule.initializeApp({
        credential: appModule.cert(serviceAccount)
      });
      firebaseMessaging = appModule.getMessaging();
      firebaseReady = true;
      console.log('✅ Firebase initialized via Approach B!');
      return true;
    }
  } catch (e) {
    console.warn('⚠️ Approach B failed: ' + e.message);
  }

  // APPROACH C: Use applicationDefault()
  try {
    console.log('🔄 Trying Approach C: applicationDefault()');
    if (admin.credential && typeof admin.credential.applicationDefault === 'function') {
      admin.initializeApp({
        credential: admin.credential.applicationDefault()
      });
      firebaseMessaging = admin.messaging();
      firebaseReady = true;
      console.log('✅ Firebase initialized via Approach C!');
      return true;
    }
  } catch (e) {
    console.warn('⚠️ Approach C failed: ' + e.message);
  }

  // APPROACH D: Direct serviceAccount object (some versions accept this)
  try {
    console.log('🔄 Trying Approach D: direct serviceAccount object');
    admin.initializeApp({
      credential: serviceAccount,
      projectId: serviceAccount.project_id
    });
    firebaseMessaging = admin.messaging();
    firebaseReady = true;
    console.log('✅ Firebase initialized via Approach D!');
    return true;
  } catch (e) {
    console.warn('⚠️ Approach D failed: ' + e.message);
  }

  // APPROACH E: Use existing fcmService.js as complete fallback
  try {
    console.log('🔄 Trying Approach E: use fcmService.js directly');
    const fcmService = require('../services/fcmService');
    if (fcmService && fcmService.sendBookingOfferToProvider) {
      console.log('✅ fcmService.js available — will use as fallback for sending');
      // Don't set firebaseReady — we'll use fcmService directly in send function
      return false;
    }
  } catch (e) {
    console.warn('⚠️ Approach E failed: ' + e.message);
  }

  console.error('❌ ALL Firebase init approaches failed!');
  return false;
}

// ============================================================
// 📲 SEND FCM — tries direct first, then fcmService fallback
// ============================================================
async function sendFCMToProvider(provider, booking, offerId, expiresAt) {
  const token = provider.fcmToken;
  if (!token || typeof token !== 'string' || token.length < 10) {
    return { success: false, error: 'No valid FCM token' };
  }

  const bookingId = String(booking._id);
  const serviceName = booking.serviceName || booking.categoryName || 'Service';
  const amount = String(booking.totalAmount || 0);
  const address = booking.address || '';
  const customerName = booking.customerName || booking.customerPhone || 'Customer';
  const customerPhone = booking.customerPhone || '';
  const categoryName = booking.categoryName || '';

  // DATA-ONLY payload (no notification field — triggers popup in app)
  const dataPayload = {
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
    title: 'New Booking Request!',
    body: serviceName + ' - Rs.' + amount + ' - ' + address.substring(0, 40),
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
  };

  // ── TRY 1: Direct Firebase messaging ──
  const ready = await initFirebase();
  if (ready && firebaseMessaging) {
    try {
      const message = {
        token: token,
        data: dataPayload,
        android: { priority: 'high', ttl: 60 },
        apns: {
          headers: { 'apns-priority': '10', 'apns-push-type': 'background' },
          payload: { aps: { 'content-available': 1, sound: 'default', badge: 1 } }
        }
      };
      const messageId = await firebaseMessaging.send(message);
      console.log('✅ DIRECT FCM SENT! ID: ' + messageId);
      return { success: true, messageId: messageId, method: 'direct' };
    } catch (e) {
      console.warn('⚠️ Direct FCM failed: ' + e.message);
    }
  }

  // ── TRY 2: Use fcmService.js (existing backend service) ──
  console.log('🔄 Falling back to fcmService.js...');
  try {
    const fcmService = require('../services/fcmService');
    if (fcmService && typeof fcmService.sendBookingOfferToProvider === 'function') {
      const result = await fcmService.sendBookingOfferToProvider(provider, booking, {
        offerId: offerId,
        expiresAt: expiresAt,
        timeoutMs: DISPATCH_TIMEOUT_MS,
        source: 'manual_admin',
        adminNote: 'Force dispatch'
      });
      if (result && result.success) {
        console.log('✅ FCM sent via fcmService.js!');
        return { success: true, messageId: result.messageId || 'fcmService', method: 'fcmService' };
      } else {
        console.warn('⚠️ fcmService returned failure: ' + JSON.stringify(result));
      }
    }
  } catch (e) {
    console.warn('⚠️ fcmService fallback error: ' + e.message);
  }

  // ── TRY 3: Use admin.messaging() from fresh require ──
  console.log('🔄 Trying fresh firebase-admin require...');
  try {
    const freshAdmin = require('firebase-admin');
    if (freshAdmin && freshAdmin.apps && Array.isArray(freshAdmin.apps) && freshAdmin.apps.length > 0) {
      const msg = freshAdmin.messaging();
      const messageId = await msg.send({
        token: token,
        data: dataPayload,
        android: { priority: 'high', ttl: 60 }
      });
      console.log('✅ FCM sent via fresh require! ID: ' + messageId);
      return { success: true, messageId: messageId, method: 'fresh_require' };
    }
  } catch (e) {
    console.warn('⚠️ Fresh require failed: ' + e.message);
  }

  return { success: false, error: 'All FCM methods failed' };
}

// ============================================================
// 📲 SEND CANCELLATION TO OLD PROVIDER
// ============================================================
async function sendCancellationFCM(oldProvider, bookingId) {
  if (!oldProvider || !oldProvider.fcmToken || typeof oldProvider.fcmToken !== 'string' || oldProvider.fcmToken.length < 10) return;
  console.log('📲 Sending CANCELLATION to ' + oldProvider.name);
  try {
    const ready = await initFirebase();
    if (ready && firebaseMessaging) {
      await firebaseMessaging.send({
        token: oldProvider.fcmToken,
        data: {
          type: 'booking_cancelled',
          click_action: 'FLUTTER_NOTIFICATION_CLICK',
          channelId: 'booking_requests',
          bookingId: String(bookingId),
          booking_id: String(bookingId),
          reason: 'admin_reassigned',
          title: 'Booking Cancelled',
          body: 'Reassigned by admin',
          sound: 'default',
          showPopup: 'false'
        },
        android: { priority: 'high', ttl: 30 }
      });
      console.log('✅ Cancellation sent to ' + oldProvider.name);
    }
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
// GET DISPATCHABLE BOOKINGS
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
// 🚨 FORCE RE-DISPATCH
// ============================================================
exports.send = async (req, res) => {
  console.log('\n============================================================');
  console.log('📨 FORCE RE-DISPATCH');
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

    const oldStatus = booking.status;
    const oldProviderId = booking.providerId;

    // FIND NEW PROVIDER
    let newProvider = null;
    if (mongoose.Types.ObjectId.isValid(providerId)) newProvider = await Provider.findById(providerId);
    if (!newProvider) newProvider = await Provider.findOne({ providerId: providerId });
    if (!newProvider) return res.status(404).json({ success: false, message: 'Provider not found' });

    console.log('📋 Booking: ' + booking._id + ' | Status: ' + oldStatus);
    console.log('🎯 Target: ' + newProvider.name + ' (' + newProvider.phone + ')');

    if (!newProvider.fcmToken || typeof newProvider.fcmToken !== 'string' || newProvider.fcmToken.length < 10) {
      return res.status(400).json({ success: false, message: 'Provider has no FCM token' });
    }

    // CANCEL OLD PROVIDER
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
        }
      } catch (e) { console.warn('⚠️ Old provider cancel: ' + e.message); }
    }

    // SUPERSEDE OTHER OFFERS
    if (Offer) {
      try {
        await Offer.updateMany(
          { bookingId: booking._id, status: { $in: ['pending', 'sent', 'dispatched', 'waiting'] } },
          { $set: { status: 'superseded', respondedAt: new Date() } }
        );
      } catch (e) {}
    }

    // RESET BOOKING
    try {
      await Booking.findByIdAndUpdate(booking._id, {
        $set: { status: 'searching', providerId: newProvider._id, updatedAt: new Date() }
      });
      console.log('🔄 Status: ' + oldStatus + ' → searching');
    } catch (e) {}

    // CREATE OFFER
    const expiresAt = new Date(Date.now() + DISPATCH_TIMEOUT_MS);
    let offer = null;
    if (Offer) {
      try {
        offer = await Offer.create({
          bookingId: booking._id, providerId: newProvider._id,
          status: 'pending', source: 'manual_admin_force',
          expiresAt: expiresAt, adminNote: adminNote || ''
        });
        console.log('📝 Offer: ' + offer._id);
      } catch (e) { console.warn('⚠️ Offer: ' + e.message); }
    }

    // CREATE DISPATCH JOB
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

    // 🔥 SEND FCM (with all fallbacks)
    console.log('📲 Sending DATA-ONLY FCM to ' + newProvider.name + '...');
    const fcmResult = await sendFCMToProvider(newProvider, booking, offer ? offer._id : 'manual', expiresAt);

    if (dispatchJob && DispatchJob) {
      try {
        await DispatchJob.findByIdAndUpdate(dispatchJob._id, {
          $set: { fcmMessageId: fcmResult.messageId || '', result: fcmResult.success ? 'sent' : 'fcm_failed' }
        });
      } catch (e) {}
    }

    // SOCKET
    emitToAdmins('manual-dispatch:sent', {
      bookingId: String(booking._id), providerId: String(newProvider._id),
      providerName: newProvider.name, fcmSent: fcmResult.success
    });

    // TIMEOUT
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
          }
        } catch (e) {}
      }, DISPATCH_TIMEOUT_MS + 2000);
    }

    console.log('✅ DONE! FCM: ' + (fcmResult.success ? 'SENT ✅ (' + fcmResult.method + ')' : 'FAILED ❌ ' + fcmResult.error));
    console.log('============================================================\n');

    res.json({
      success: true,
      message: fcmResult.success ? 'FCM sent via ' + fcmResult.method : 'FCM failed: ' + fcmResult.error,
      data: {
        offerId: offer ? String(offer._id) : null,
        bookingId: String(booking._id),
        providerName: newProvider.name,
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
    let fbDetails = '';
    try {
      const a = require('firebase-admin');
      const apps = a && a.apps ? a.apps : [];
      fbStatus = apps.length > 0 ? 'initialized (' + apps.length + ' apps)' : 'no apps';
      fbDetails = 'credential exists: ' + !!(a && a.credential) + ', cert exists: ' + !!(a && a.credential && a.credential.cert);
    } catch (e) { fbStatus = 'not installed'; }

    const envCheck = {};
    const keys = ['PROVIDER_FIREBASE_SERVICE_ACCOUNT_BASE64', 'FIREBASE_SERVICE_ACCOUNT_BASE64'];
    for (let i = 0; i < keys.length; i++) {
      const v = process.env[keys[i]];
      envCheck[keys[i]] = !!(v && typeof v === 'string' && v.trim().length > 50);
    }

    // Check fcmService availability
    let fcmServiceAvailable = false;
    try {
      const fcm = require('../services/fcmService');
      fcmServiceAvailable = !!(fcm && fcm.sendBookingOfferToProvider);
    } catch (e) {}

    res.json({
      success: true, firebaseStatus: fbStatus, firebaseDetails: fbDetails,
      envVars: envCheck, fcmServiceAvailable: fcmServiceAvailable,
      fcmFormat: 'DATA-ONLY', timestamp: new Date().toISOString()
    });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};