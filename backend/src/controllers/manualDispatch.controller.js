// backend/src/controllers/manualDispatch.controller.js
// 🚨 FORCE RE-DISPATCH: Cancel old provider → Reset booking → Send to new provider
const mongoose = require('mongoose');

const DISPATCH_TIMEOUT_MS = parseInt(process.env.MANUAL_DISPATCH_TIMEOUT_MS || '30000', 10);
const DISPATCHABLE_STATUSES = ['confirmed', 'searching', 'no_provider_found', 'pending', 'assigned', 'accepted', 'in_progress'];

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
// 🔥 FIREBASE INIT — BULLETPROOF
// ============================================================
let firebaseAdmin = null;
let firebaseReady = false;

async function initFirebase() {
  if (firebaseReady) return true;
  try { firebaseAdmin = require('firebase-admin'); } catch (e) { console.error('❌ firebase-admin not found'); return false; }
  if (!firebaseAdmin) return false;

  try {
    const apps = firebaseAdmin.apps;
    if (apps && Array.isArray(apps) && apps.length > 0) {
      firebaseReady = true;
      console.log('✅ Firebase already initialized');
      return true;
    }
  } catch (e) {}

  let serviceAccount = null;
  const envKeys = [
    'PROVIDER_FIREBASE_SERVICE_ACCOUNT_BASE64',
    'FIREBASE_SERVICE_ACCOUNT_BASE64',
    'FIREBASE_ADMIN_BASE64'
  ];

  for (let i = 0; i < envKeys.length; i++) {
    const key = envKeys[i];
    let val = null;
    try { val = process.env[key]; } catch (e) { continue; }
    if (!val || typeof val !== 'string') continue;
    val = val.trim();
    if (val.length < 10) continue;
    try {
      serviceAccount = JSON.parse(Buffer.from(val, 'base64').toString('utf8'));
      console.log('✅ Firebase creds from ' + key);
      break;
    } catch (e) {}
  }

  if (!serviceAccount) {
    const jsonKeys = ['PROVIDER_FIREBASE_SERVICE_ACCOUNT', 'FIREBASE_SERVICE_ACCOUNT'];
    for (let i = 0; i < jsonKeys.length; i++) {
      let val = null;
      try { val = process.env[jsonKeys[i]]; } catch (e) { continue; }
      if (!val || typeof val !== 'string' || val.trim().length < 10) continue;
      try { serviceAccount = JSON.parse(val.trim()); console.log('✅ Firebase creds from ' + jsonKeys[i]); break; } catch (e) {}
    }
  }

  if (!serviceAccount) {
    try {
      const path = require('path');
      const fs = require('fs');
      const fp = path.join(__dirname, '../config/serviceproviderapp-b7767-firebase-adminsdk.json');
      if (fs.existsSync(fp)) {
        serviceAccount = JSON.parse(fs.readFileSync(fp, 'utf8'));
        console.log('✅ Firebase creds from local config file');
      }
    } catch (e) {}
  }

  if (!serviceAccount) {
    console.error('❌ NO Firebase credentials found!');
    return false;
  }

  try {
    firebaseAdmin.initializeApp({ credential: firebaseAdmin.credential.cert(serviceAccount) });
    firebaseReady = true;
    console.log('✅ Firebase initialized!');
    return true;
  } catch (e) {
    if (e.message && e.message.indexOf('already exists') !== -1) {
      firebaseReady = true;
      return true;
    }
    console.error('❌ Firebase init failed: ' + e.message);
    return false;
  }
}

// ============================================================
// 📲 DATA-ONLY FCM SENDER
// ============================================================
async function sendDataOnlyFCM(token, dataPayload) {
  if (!token || typeof token !== 'string' || token.length < 10) {
    return { success: false, error: 'No valid FCM token' };
  }
  const ready = await initFirebase();
  if (!ready || !firebaseAdmin) return { success: false, error: 'Firebase not initialized' };

  const message = {
    token: token,
    data: dataPayload,
    android: { priority: 'high', ttl: 60 },
    apns: {
      headers: { 'apns-priority': '10', 'apns-push-type': 'background' },
      payload: { aps: { 'content-available': 1, sound: 'default', badge: 1 } }
    }
  };

  try {
    const messageId = await firebaseAdmin.messaging().send(message);
    console.log('✅ FCM SENT! ID: ' + messageId + ' → ' + token.substring(0, 20) + '...');
    return { success: true, messageId: messageId };
  } catch (err) {
    const msg = err && err.message ? err.message : String(err);
    console.error('❌ FCM FAILED: ' + msg);
    return { success: false, error: msg };
  }
}

// ============================================================
// 📲 SEND CANCELLATION TO OLD PROVIDER
// ============================================================
async function sendCancellationFCM(oldProvider, bookingId) {
  if (!oldProvider || !oldProvider.fcmToken || typeof oldProvider.fcmToken !== 'string' || oldProvider.fcmToken.length < 10) {
    console.log('⚠️ Old provider has no FCM token, skipping cancellation');
    return;
  }

  console.log('📲 Sending CANCELLATION to old provider: ' + oldProvider.name);

  const cancelPayload = {
    type: 'booking_cancelled',
    click_action: 'FLUTTER_NOTIFICATION_CLICK',
    channelId: 'booking_requests',
    bookingId: String(bookingId),
    booking_id: String(bookingId),
    reason: 'admin_reassigned',
    title: 'Booking Cancelled',
    body: 'This booking has been reassigned by admin',
    sound: 'default',
    priority: 'high',
    source: 'manual_admin',
    showPopup: 'false'
  };

  try {
    await sendDataOnlyFCM(oldProvider.fcmToken, cancelPayload);
    console.log('✅ Cancellation sent to ' + oldProvider.name);
  } catch (e) {
    console.warn('⚠️ Cancellation FCM failed: ' + e.message);
  }
}

// ============================================================
// 📲 SEND BOOKING REQUEST TO NEW PROVIDER
// ============================================================
async function sendBookingFCM(newProvider, booking, offerId, expiresAt) {
  const bookingId = String(booking._id);
  const serviceName = booking.serviceName || booking.categoryName || 'Service';
  const amount = String(booking.totalAmount || 0);
  const address = booking.address || '';
  const customerName = booking.customerName || booking.customerPhone || 'Customer';
  const customerPhone = booking.customerPhone || '';
  const categoryName = booking.categoryName || '';

  const payload = {
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

  return await sendDataOnlyFCM(newProvider.fcmToken, payload);
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
// GET DISPATCHABLE BOOKINGS — NOW INCLUDES ASSIGNED/ACCEPTED TOO
// ============================================================
exports.getDispatchableBookings = async (req, res) => {
  try {
    const Booking = getBookingModel();
    if (!Booking) return res.status(500).json({ success: false, message: 'Booking model unavailable' });

    // Include ALL active bookings — even assigned ones (for force re-dispatch)
    const allStatuses = ['confirmed', 'searching', 'no_provider_found', 'pending', 'assigned', 'accepted', 'in_progress'];
    const bookings = await Booking.find({ status: { $in: allStatuses } }).sort({ createdAt: -1 }).limit(200).lean();
    const normalized = bookings.map(normalizeBooking).filter(Boolean);
    console.log('📊 Returned ' + normalized.length + ' bookings (including assigned)');
    res.json({ success: true, count: normalized.length, bookings: normalized });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// ============================================================
// 🚨 FORCE RE-DISPATCH — THE MAIN FLOW
//
// Step 1: Find booking (ANY status — even assigned/accepted)
// Step 2: Find NEW provider (admin selected)
// Step 3: Check if booking has OLD provider assigned
// Step 4: If yes → Cancel old provider's offer + Send cancellation FCM
// Step 5: Cancel ALL pending offers for this booking
// Step 6: Reset booking status → "searching"
// Step 7: Create NEW offer for new provider
// Step 8: Send DATA-ONLY FCM to NEW provider
// Step 9: Set 30s timeout
// ============================================================
exports.send = async (req, res) => {
  console.log('\n============================================================');
  console.log('📨 POST /api/v1/admin/manual-dispatch/send (FORCE RE-DISPATCH)');
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

    // ── STEP 1: FIND BOOKING (any status) ──
    let booking = null;
    if (mongoose.Types.ObjectId.isValid(bookingId)) booking = await Booking.findById(bookingId);
    if (!booking) booking = await Booking.findOne({ $or: [{ bookingId: bookingId }, { orderId: bookingId }] });
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

    const oldStatus = booking.status;
    const oldProviderId = booking.providerId;
    console.log('📋 Booking: ' + booking._id + ' | Status: ' + oldStatus + ' | Old Provider: ' + (oldProviderId || 'none'));

    // ── STEP 2: FIND NEW PROVIDER (admin selected) ──
    let newProvider = null;
    if (mongoose.Types.ObjectId.isValid(providerId)) newProvider = await Provider.findById(providerId);
    if (!newProvider) newProvider = await Provider.findOne({ providerId: providerId });
    if (!newProvider) return res.status(404).json({ success: false, message: 'Provider not found: ' + providerId });

    console.log('🎯 NEW Provider: ' + newProvider.name + ' (' + newProvider.phone + ') | ID: ' + newProvider._id);

    if (!newProvider.fcmToken || typeof newProvider.fcmToken !== 'string' || newProvider.fcmToken.length < 10) {
      return res.status(400).json({ success: false, message: 'Provider ' + newProvider.name + ' has no FCM token' });
    }

    // ── STEP 3: CHECK IF OLD PROVIDER EXISTS ──
    let oldProvider = null;
    if (oldProviderId) {
      try {
        oldProvider = await Provider.findById(oldProviderId);
        if (oldProvider) {
          console.log('⚠️ OLD Provider found: ' + oldProvider.name + ' (' + oldProvider.phone + ')');
        }
      } catch (e) {
        console.warn('⚠️ Could not find old provider: ' + e.message);
      }
    }

    // ── STEP 4: CANCEL OLD PROVIDER (if different from new) ──
    let oldProviderCancelled = false;
    if (oldProvider && String(oldProvider._id) !== String(newProvider._id)) {
      console.log('🔄 Reassigning from ' + oldProvider.name + ' → ' + newProvider.name);

      // 4a: Send cancellation FCM to old provider
      await sendCancellationFCM(oldProvider, booking._id);

      // 4b: Cancel old provider's offers
      if (Offer) {
        try {
          const cancelResult = await Offer.updateMany(
            { bookingId: booking._id, providerId: oldProvider._id, status: { $in: ['pending', 'accepted', 'sent', 'dispatched'] } },
            { $set: { status: 'cancelled', respondedAt: new Date(), response: 'admin_reassigned_to_' + newProvider.name } }
          );
          console.log('🔄 Cancelled ' + (cancelResult.modifiedCount || 0) + ' offers from old provider');
        } catch (e) { console.warn('⚠️ Offer cancel failed: ' + e.message); }
      }

      // 4c: Clear old provider's currentBookingId
      try {
        await Provider.findByIdAndUpdate(oldProvider._id, {
          $set: { currentBookingId: null, isBusy: false, isAvailable: true }
        });
        console.log('🔄 Cleared old provider currentBookingId');
      } catch (e) {}

      oldProviderCancelled = true;
    }

    // ── STEP 5: CANCEL ALL OTHER PENDING OFFERS ──
    if (Offer) {
      try {
        const supResult = await Offer.updateMany(
          { bookingId: booking._id, status: { $in: ['pending', 'sent', 'dispatched', 'waiting'] } },
          { $set: { status: 'superseded', respondedAt: new Date(), response: 'superseded_by_force_dispatch' } }
        );
        console.log('🔄 Superseded ' + (supResult.modifiedCount || 0) + ' other pending offers');
      } catch (e) {}
    }

    // ── STEP 6: RESET BOOKING STATUS → "searching" ──
    try {
      await Booking.findByIdAndUpdate(booking._id, {
        $set: {
          status: 'searching',
          providerId: newProvider._id,
          updatedAt: new Date()
        }
      });
      console.log('🔄 Booking status: ' + oldStatus + ' → searching (provider → ' + newProvider.name + ')');
    } catch (e) { console.warn('⚠️ Status reset failed: ' + e.message); }

    // ── STEP 7: CREATE NEW OFFER ──
    const expiresAt = new Date(Date.now() + DISPATCH_TIMEOUT_MS);
    let offer = null;
    if (Offer) {
      try {
        offer = await Offer.create({
          bookingId: booking._id,
          providerId: newProvider._id,
          status: 'pending',
          source: 'manual_admin_force',
          expiresAt: expiresAt,
          adminNote: adminNote || 'Force re-dispatch by admin'
        });
        console.log('📝 NEW Offer: ' + offer._id);
      } catch (e) { console.warn('⚠️ Offer create failed: ' + e.message); }
    }

    // ── STEP 8: CREATE DISPATCH JOB ──
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
          console.log('📝 DispatchJob status=' + tries[i]);
          break;
        } catch (e) {
          if (e.message && e.message.indexOf('not a valid enum') !== -1) continue;
          break;
        }
      }
    }

    // ── STEP 9: SEND DATA-ONLY FCM TO NEW PROVIDER ──
    console.log('📲 Sending DATA-ONLY FCM to ' + newProvider.name + '...');
    console.log('   Token: ' + newProvider.fcmToken.substring(0, 20) + '...');
    console.log('   Format: data-only (popup trigger)');

    const fcmResult = await sendBookingFCM(newProvider, booking, offer ? offer._id : 'manual', expiresAt);

    // Update dispatch job
    if (dispatchJob && DispatchJob) {
      try {
        await DispatchJob.findByIdAndUpdate(dispatchJob._id, {
          $set: { fcmMessageId: fcmResult.messageId || '', result: fcmResult.success ? 'sent' : 'fcm_failed' }
        });
      } catch (e) {}
    }

    // ── SOCKET EMIT ──
    emitToAdmins('manual-dispatch:sent', {
      bookingId: String(booking._id),
      oldProviderId: oldProvider ? String(oldProvider._id) : null,
      oldProviderName: oldProvider ? oldProvider.name : null,
      newProviderId: String(newProvider._id),
      newProviderName: newProvider.name,
      fcmSent: fcmResult.success,
      oldProviderCancelled: oldProviderCancelled,
      oldStatus: oldStatus,
      newStatus: 'searching'
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

    // ── RESPONSE ──
    console.log('✅ FORCE RE-DISPATCH COMPLETE!');
    console.log('   Old: ' + (oldProvider ? oldProvider.name : 'none') + ' → New: ' + newProvider.name);
    console.log('   FCM: ' + (fcmResult.success ? 'SENT ✅' : 'FAILED ❌ ' + fcmResult.error));
    console.log('============================================================\n');

    res.json({
      success: true,
      message: fcmResult.success
        ? '🔔 Force dispatched to ' + newProvider.name + (oldProviderCancelled ? ' (cancelled ' + (oldProvider ? oldProvider.name : 'old') + ')' : '')
        : 'FCM failed: ' + fcmResult.error,
      data: {
        offerId: offer ? String(offer._id) : null,
        bookingId: String(booking._id),
        oldProvider: oldProvider ? { id: String(oldProvider._id), name: oldProvider.name, cancelled: oldProviderCancelled } : null,
        newProvider: { id: String(newProvider._id), name: newProvider.name, phone: newProvider.phone },
        fcmSent: fcmResult.success,
        fcmError: fcmResult.success ? null : fcmResult.error,
        oldStatus: oldStatus,
        newStatus: 'searching',
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