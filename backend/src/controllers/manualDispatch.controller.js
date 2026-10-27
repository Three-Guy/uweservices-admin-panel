// backend/src/controllers/manualDispatch.controller.js
const mongoose = require('mongoose');
const path = require('path');
const firebaseAdmin = require('firebase-admin');

// ============================================================
// FIREBASE PROVIDER APP
// ============================================================
let providerApp = null;
let providerMessaging = null;

function loadServiceAccount() {
  const b64Val = process.env.PROVIDER_FIREBASE_SERVICE_ACCOUNT_BASE64;
  if (typeof b64Val === 'string' && b64Val.length > 100) {
    try {
      const json = Buffer.from(b64Val, 'base64').toString('utf8');
      const sa = JSON.parse(json);
      console.log('✅ SA loaded from env: PROVIDER_FIREBASE_SERVICE_ACCOUNT_BASE64');
      return sa;
    } catch (e) {
      console.error('❌ Failed parsing SA from env:', e.message);
    }
  }

  const jsonVal = process.env.PROVIDER_FIREBASE_SERVICE_ACCOUNT_JSON;
  if (typeof jsonVal === 'string' && jsonVal.length > 100) {
    try {
      return JSON.parse(jsonVal);
    } catch {}
  }

  try {
    const filePath = path.resolve(process.cwd(), 'src/config/serviceproviderapp-b7767-firebase-adminsdk.json');
    return require(filePath);
  } catch {}

  return null;
}

function getProviderMessaging() {
  if (providerMessaging) return providerMessaging;
  try {
    const sa = loadServiceAccount();
    if (!sa) return null;

    const existingApps = Array.isArray(firebaseAdmin.apps) ? firebaseAdmin.apps : [];
    const existing = existingApps.find(a => a && a.name === 'provider');
    if (existing) {
      providerApp = existing;
      providerMessaging = providerApp.messaging();
      return providerMessaging;
    }

    let credential = null;
    try {
      if (firebaseAdmin.credential && typeof firebaseAdmin.credential.cert === 'function') {
        credential = firebaseAdmin.credential.cert(sa);
      }
    } catch {}

    if (!credential) {
      try {
        const { cert } = require('firebase-admin/app');
        credential = cert(sa);
      } catch {}
    }

    if (!credential) return null;

    providerApp = firebaseAdmin.initializeApp({
      credential,
      projectId: sa.project_id,
    }, 'provider');

    providerMessaging = providerApp.messaging();
    console.log('✅ Provider Firebase initialized');
    return providerMessaging;
  } catch (err) {
    console.error('❌ getProviderMessaging:', err.message);
    return null;
  }
}

// ============================================================
// DB — scan ALL connections, ALL collections
// ============================================================
function getAllConnections() {
  const conns = [];
  try {
    const db = require('../config/database');
    const helpers = [
      'getAdminConnection',
      'getProviderConnection',
      'getUserConnection',
      'getBookingConnection',
      'getTrackingConnection',
    ];
    for (const h of helpers) {
      if (typeof db[h] === 'function') {
        try {
          const c = db[h]();
          if (c && c.readyState === 1 && !conns.includes(c)) conns.push(c);
        } catch {}
      }
    }
  } catch {}

  // Add all mongoose connections
  for (const c of mongoose.connections || []) {
    if (c && c.readyState === 1 && !conns.includes(c)) conns.push(c);
  }

  return conns;
}

// ============================================================
// STRING COERCE for FCM data
// ============================================================
function s(v) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (v instanceof Date) return v.toISOString();
  try { return JSON.stringify(v); } catch { return String(v); }
}

function stringifyAll(obj) {
  const out = {};
  for (const k of Object.keys(obj || {})) out[k] = s(obj[k]);
  return out;
}

// ============================================================
// RAW COLLECTION ACCESS — bypass Mongoose model issues
// ============================================================
async function findInAllDbs(collectionNames, query = {}, options = {}) {
  const results = [];
  const conns = getAllConnections();

  for (const conn of conns) {
    const db = conn.db;
    if (!db) continue;

    for (const collName of collectionNames) {
      try {
        const coll = db.collection(collName);
        let cursor = coll.find(query);
        if (options.sort) cursor = cursor.sort(options.sort);
        if (options.limit) cursor = cursor.limit(options.limit);
        const docs = await cursor.toArray();
        if (docs && docs.length > 0) {
          console.log(`   ✓ Found ${docs.length} in ${conn.name}.${collName}`);
          for (const d of docs) {
            if (!results.find(r => String(r._id) === String(d._id))) {
              results.push(d);
            }
          }
        }
      } catch (e) {
        // collection doesn't exist in this db — skip
      }
    }
  }

  return results;
}

async function findOneInAllDbs(collectionNames, query = {}) {
  const conns = getAllConnections();
  for (const conn of conns) {
    const db = conn.db;
    if (!db) continue;
    for (const collName of collectionNames) {
      try {
        const coll = db.collection(collName);
        const doc = await coll.findOne(query);
        if (doc) {
          console.log(`   ✓ Found doc in ${conn.name}.${collName}`);
          return { doc, conn, collName };
        }
      } catch {}
    }
  }
  return { doc: null };
}

async function insertInDb(dbName, collName, document) {
  const conns = getAllConnections();
  let targetConn = conns.find(c => c.name === dbName);
  if (!targetConn) targetConn = conns[0];
  if (!targetConn || !targetConn.db) return null;
  try {
    const coll = targetConn.db.collection(collName);
    const result = await coll.insertOne(document);
    return { ...document, _id: result.insertedId };
  } catch (e) {
    console.error(`❌ insert into ${dbName}.${collName}:`, e.message);
    return null;
  }
}

async function updateInAllDbs(collectionNames, query, update) {
  const conns = getAllConnections();
  let total = 0;
  for (const conn of conns) {
    for (const collName of collectionNames) {
      try {
        const coll = conn.db.collection(collName);
        const res = await coll.updateMany(query, update);
        total += res.modifiedCount || 0;
      } catch {}
    }
  }
  return total;
}

// ============================================================
// GET ONLINE PROVIDERS — scan EVERYTHING
// ============================================================
exports.getOnlineProviders = async (req, res) => {
  try {
    const includeAll = req.query.all === '1' || req.query.all === 'true';
    const search = (req.query.search || '').trim();
    const category = (req.query.category || '').trim();

    // Build query
    const q = {};
    if (!includeAll) {
      q.$or = [
        { isOnline: true },
        { online: true },
        { isAvailable: true },
        { status: 'online' },
        { status: 'active' },
      ];
    }
    if (search) {
      const rx = new RegExp(search, 'i');
      const searchOr = [
        { name: rx },
        { fullName: rx },
        { phone: rx },
        { email: rx },
        { providerId: rx },
      ];
      if (q.$or) {
        q.$and = [{ $or: q.$or }, { $or: searchOr }];
        delete q.$or;
      } else {
        q.$or = searchOr;
      }
    }
    if (category) {
      const catRx = new RegExp(category, 'i');
      const catOr = [
        { profession: catRx },
        { category: catRx },
        { categoryName: catRx },
        { 'category.name': catRx },
      ];
      if (q.$and) {
        q.$and.push({ $or: catOr });
      } else if (q.$or) {
        q.$and = [{ $or: q.$or }, { $or: catOr }];
        delete q.$or;
      } else {
        q.$or = catOr;
      }
    }

    console.log('🔍 [getOnlineProviders] Query:', JSON.stringify(q), 'includeAll:', includeAll);

    // Try all possible collection names across all DBs
    const collectionCandidates = ['providers', 'serviceproviders', 'provider', 'ServiceProviders'];
    let docs = await findInAllDbs(collectionCandidates, q, { limit: 500 });

    // If nothing found with filters, retry with just {}
    if (docs.length === 0 && !includeAll) {
      console.log('⚠️ No online providers found, retrying with ALL');
      docs = await findInAllDbs(collectionCandidates, {}, { limit: 500 });
    }

    // Normalize + enrich
    const providers = docs.map((p) => {
      const hasFcm = !!(p.fcmToken || p.deviceToken || p.pushToken);
      const isOnline = !!(p.isOnline || p.online || p.status === 'online' || p.status === 'active');
      const isAvailable = p.isAvailable !== false && !p.isBusy;
      return {
        providerId: p.providerId || String(p._id),
        _id: p._id,
        name: p.name || p.fullName || 'Unknown',
        phone: p.phone || p.phoneNumber || p.mobile || '',
        email: p.email || '',
        profession: p.profession || p.category || p.categoryName || '',
        categoryName: p.categoryName || p.category || p.profession || '',
        city: typeof p.city === 'string' ? p.city : (p.city?.name || ''),
        isAvailable: isAvailable,
        isAcceptingJobs: p.isAcceptingJobs !== false,
        isBusy: !!p.isBusy || !!p.currentBookingId,
        isOnline: isOnline,
        lastOnlineAt: p.lastOnlineAt || p.lastSeenAt || p.updatedAt,
        verificationStatus: p.verificationStatus || p.status || '',
        rating: typeof p.rating === 'number' ? p.rating : (p.averageRating || 0),
        completedJobs: p.completedJobs || p.totalJobs || 0,
        totalBookings: p.totalBookings || 0,
        profileImage: p.profileImage || p.avatar || '',
        hasFcmToken: hasFcm,
        fcmToken: p.fcmToken || p.deviceToken || p.pushToken || '',
        currentBookingId: p.currentBookingId || null,
      };
    });

    // Apply search/category filter in-memory as fallback
    let filtered = providers;
    if (search) {
      const rx = new RegExp(search, 'i');
      filtered = filtered.filter(p =>
        rx.test(p.name) || rx.test(p.phone) || rx.test(p.email) ||
        rx.test(p.providerId) || rx.test(p.city)
      );
    }
    if (category) {
      const catRx = new RegExp(category, 'i');
      filtered = filtered.filter(p =>
        catRx.test(p.profession) || catRx.test(p.categoryName)
      );
    }
    if (!includeAll) {
      filtered = filtered.filter(p => p.isOnline || p.isAvailable);
    }

    console.log(`📊 Returned ${filtered.length} providers (raw: ${providers.length})`);
    return res.json({ success: true, providers: filtered, raw: providers.length });
  } catch (err) {
    console.error('❌ getOnlineProviders:', err.message);
    console.error(err.stack);
    return res.status(500).json({ success: false, error: err.message, providers: [] });
  }
};

// ============================================================
// GET DISPATCHABLE BOOKINGS
// ============================================================
exports.getDispatchableBookings = async (req, res) => {
  try {
    const q = {
      status: { $nin: ['completed', 'cancelled', 'cancelled_by_user', 'cancelled_by_admin'] },
    };

    const docs = await findInAllDbs(['bookings', 'Booking'], q, {
      sort: { createdAt: -1 },
      limit: 200,
    });

    const bookings = docs.map((b) => ({
      _id: b._id,
      bookingId: b.bookingId || String(b._id).slice(-8),
      customerName: b.customerName || b.userName || b.user?.name || 'Customer',
      customerPhone: b.customerPhone || b.userPhone || b.user?.phone || '',
      serviceName: b.serviceName || b.service?.name || b.categoryName || 'Service',
      categoryName: b.categoryName || b.category?.name || '',
      address: typeof b.address === 'string' ? b.address : (b.address?.full || b.address?.street || ''),
      city: typeof b.city === 'string' ? b.city : (b.city?.name || b.address?.city || ''),
      totalAmount: b.totalAmount || b.amount || b.price || 0,
      status: b.status || 'pending',
      bookingType: b.bookingType || '',
      scheduledDate: b.scheduledDate || b.date || '',
      scheduledTime: b.scheduledTime || b.timeSlot || '',
      createdAt: b.createdAt,
      previousOfferCount: 0,
    }));

    console.log(`📊 Returned ${bookings.length} bookings`);
    return res.json({ success: true, bookings });
  } catch (err) {
    console.error('❌ getDispatchableBookings:', err.message);
    return res.status(500).json({ success: false, error: err.message, bookings: [] });
  }
};

// ============================================================
// HYBRID ALARM FCM
// ============================================================
async function sendHybridAlarmFCM(fcmToken, booking, provider) {
  console.log('📲 Sending HYBRID ALARM FCM...');
  const messaging = getProviderMessaging();
  if (!messaging) return { success: false, error: 'messaging not initialized' };

  const bookingId = String(booking._id);
  const serviceName = booking.serviceName || booking.service?.name || booking.categoryName || 'Service';
  const customerName = booking.customerName || booking.user?.name || booking.userName || 'Customer';
  const totalAmount = Number(booking.totalAmount || booking.amount || booking.price || 0);
  const baseAmount = Number(booking.baseAmount || booking.servicePrice || totalAmount);
  const address = booking.address?.full || booking.address?.street || booking.address || 'Address not available';
  const city = booking.address?.city || booking.city || '';
  const scheduledTime = booking.scheduledTime || booking.timeSlot || '';
  const scheduledDate = booking.scheduledDate || booking.date || '';

  const title = `🔔 New Booking! ₹${totalAmount}`;
  const body = `${serviceName} • ₹${totalAmount} • ${scheduledTime}\n📍 ${String(address).substring(0, 80)}`;

  const dataPayload = stringifyAll({
    type: 'booking_request',
    bookingId, bookingObjectId: bookingId,
    actionUrl: `/booking-detail?bookingId=${bookingId}`,
    serviceName, serviceIcon: '🔧',
    categoryName: booking.categoryName || serviceName,
    customerName, totalAmount, baseAmount,
    servicePrice: baseAmount, priceDisplay: `₹${totalAmount}`,
    scheduledTime, scheduledDate, address, city,
    priority: 'high', channelId: 'bookings_alarm',
    category: 'booking_request', clickAction: 'OPEN_BOOKING',
    timeout: 30, expiresAt: Date.now() + 30000,
    isExclusive: 'true', source: 'manual_admin',
    _isBookingAlarm: 'true', _source: 'fcm', _sentAt: Date.now(),
    sound: 'booking_alarm', title, body,
  });

  const message = {
    token: fcmToken,
    notification: { title, body },
    data: dataPayload,
    android: {
      priority: 'high', ttl: 120000, collapseKey: `booking_${bookingId}`,
      notification: {
        channelId: 'bookings_alarm', sound: 'booking_alarm',
        priority: 'max', visibility: 'public',
        defaultSound: false, defaultVibrateTimings: false,
        vibrateTimingsMillis: [0, 1000, 500, 1000, 500, 1000],
        notificationPriority: 'PRIORITY_MAX', color: '#EF4444',
        title, body,
      },
    },
    apns: {
      headers: { 'apns-priority': '10', 'apns-expiration': String(Math.floor(Date.now() / 1000) + 120) },
      payload: { aps: { sound: 'booking_alarm.caf', 'interruption-level': 'time-sensitive', alert: { title, body } } },
    },
  };

  try {
    const response = await messaging.send(message);
    console.log('✅ HYBRID ALARM FCM SENT! messageId:', response);
    return { success: true, messageId: response };
  } catch (err) {
    console.error('❌ FCM send() failed:', err.message);
    return { success: false, error: err.message, code: err.code };
  }
}

async function sendCancellationFCM(fcmToken, bookingId, reason) {
  const messaging = getProviderMessaging();
  if (!messaging) return { success: false };
  try {
    await messaging.send({
      token: fcmToken,
      data: stringifyAll({
        type: 'booking_cancelled_by_admin',
        bookingId: String(bookingId),
        reason: reason || 'Admin re-assigned',
        _source: 'fcm', _sentAt: Date.now(),
      }),
      android: { priority: 'high' },
    });
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

// ============================================================
// SEND / FORCE RE-DISPATCH
// ============================================================
exports.send = async (req, res) => {
  console.log('\n============================================================');
  console.log('📨 FORCE RE-DISPATCH');
  console.log('📦 Body:', JSON.stringify(req.body));
  console.log('============================================================');

  try {
    const { bookingId, providerId, adminNote } = req.body || {};
    if (!bookingId || !providerId) {
      return res.status(400).json({ success: false, error: 'bookingId and providerId required' });
    }

    // Find booking
    const bookingQuery = mongoose.Types.ObjectId.isValid(bookingId)
      ? { $or: [{ _id: new mongoose.Types.ObjectId(bookingId) }, { bookingId }] }
      : { bookingId };
    const { doc: booking } = await findOneInAllDbs(['bookings', 'Booking'], bookingQuery);
    if (!booking) {
      return res.status(404).json({ success: false, error: 'Booking not found' });
    }

    // Find provider — try by _id, providerId, phone
    let providerQuery;
    if (mongoose.Types.ObjectId.isValid(providerId)) {
      providerQuery = {
        $or: [
          { _id: new mongoose.Types.ObjectId(providerId) },
          { providerId },
        ],
      };
    } else {
      providerQuery = {
        $or: [
          { providerId },
          { phone: providerId },
          { email: providerId },
        ],
      };
    }
    const { doc: provider } = await findOneInAllDbs(
      ['providers', 'serviceproviders', 'provider'],
      providerQuery
    );
    if (!provider) {
      return res.status(404).json({ success: false, error: 'Provider not found' });
    }

    const fcmToken = provider.fcmToken || provider.deviceToken || provider.pushToken || '';
    console.log(`📋 Booking: ${booking._id} | Status: ${booking.status}`);
    console.log(`🎯 Target: ${provider.name} | FCM: ${fcmToken ? fcmToken.substring(0, 15) + '...' : 'MISSING'}`);

    if (!fcmToken) {
      return res.status(400).json({ success: false, error: 'Target provider has no FCM token' });
    }

    // Cancel old provider
    const oldProviderId = booking.providerId || booking.assignedProvider || booking.provider;
    if (oldProviderId && String(oldProviderId) !== String(provider._id)) {
      try {
        const { doc: oldProvider } = await findOneInAllDbs(
          ['providers', 'serviceproviders'],
          { $or: [{ _id: oldProviderId }, { providerId: oldProviderId }] }
        );
        if (oldProvider && oldProvider.fcmToken) {
          await sendCancellationFCM(oldProvider.fcmToken, bookingId, 'Admin re-assigned');
        }
      } catch {}
    }

    // Supersede offers
    const supersededCount = await updateInAllDbs(
      ['provideroffers', 'ProviderOffer'],
      { bookingId: booking._id, status: { $in: ['pending', 'sent', 'active'] } },
      { $set: { status: 'superseded', supersededAt: new Date() } }
    );
    console.log(`🔄 Superseded ${supersededCount} old offers`);

    // Reset booking
    await updateInAllDbs(
      ['bookings'],
      { _id: booking._id },
      {
        $set: {
          status: 'searching',
          dispatchMode: 'manual_admin',
          lastManualDispatchAt: new Date(),
        },
        $unset: { providerId: '', assignedProvider: '', provider: '' },
      }
    );

    // Create offer
    const expiresAt = new Date(Date.now() + 30 * 1000);
    const offerDoc = {
      bookingId: booking._id,
      providerId: provider._id,
      providerCode: provider.providerId,
      providerName: provider.name,
      status: 'pending',
      source: 'manual_admin',
      adminNote: adminNote || '',
      expiresAt,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    let offer = await insertInDb('bookings_db', 'provideroffers', offerDoc);
    if (!offer) offer = await insertInDb('admin_panel', 'provideroffers', offerDoc);
    if (offer) console.log(`📝 Offer: ${offer._id}`);

    // Create dispatch job (try multiple statuses)
    const jobStatuses = ['pending', 'active', 'dispatched', 'searching', 'sent', 'waiting'];
    let job = null;
    for (const st of jobStatuses) {
      const jobDoc = {
        bookingId: booking._id,
        providerId: provider._id,
        status: st,
        source: 'manual_admin',
        expiresAt,
        createdAt: new Date(),
      };
      job = await insertInDb('bookings_db', 'dispatchjobs', jobDoc) ||
            await insertInDb('admin_panel', 'dispatchjobs', jobDoc);
      if (job) {
        console.log(`📝 DispatchJob status=${st}`);
        break;
      }
    }

    // Send FCM
    const fcmResult = await sendHybridAlarmFCM(fcmToken, booking, provider);

    // Socket emit
    try {
      const io = req.app.get('io');
      if (io) {
        const payload = {
          offerId: offer?._id,
          bookingId: booking._id,
          providerId: provider._id,
          providerName: provider.name,
          fcm: fcmResult,
        };
        const room = io.sockets.adapter.rooms.get('admins');
        console.log(`📡 [LiveEmitter] Emitting to room "admins" (${room ? room.size : 0} sockets)`);
        io.to('admins').emit('manual-dispatch:sent', payload);
        io.emit('manual-dispatch:sent', payload);
      }
    } catch (e) {
      console.error('⚠️ Socket emit:', e.message);
    }

    // 30s timeout
    if (offer) {
      setTimeout(async () => {
        try {
          const { doc: current } = await findOneInAllDbs(
            ['provideroffers'],
            { _id: offer._id }
          );
          if (current && current.status === 'pending') {
            await updateInAllDbs(
              ['provideroffers'],
              { _id: offer._id },
              { $set: { status: 'timeout', timedOutAt: new Date() } }
            );
            await updateInAllDbs(
              ['bookings'],
              { _id: booking._id, status: 'searching' },
              { $set: { status: 'no_provider_found' } }
            );
            console.log(`⏰ Offer ${offer._id} TIMEOUT`);
            try {
              const io = req.app.get('io');
              if (io) io.emit('manual-dispatch:timeout', { offerId: offer._id, bookingId: booking._id });
            } catch {}
          }
        } catch (e) {
          console.error('⚠️ Timeout handler:', e.message);
        }
      }, 30 * 1000);
    }

    console.log(`✅ FCM: ${fcmResult.success ? 'SENT ' + fcmResult.messageId : 'FAILED ' + fcmResult.error}`);
    console.log('============================================================\n');

    return res.json({
      success: true,
      offerId: offer?._id,
      offer: offer ? {
        _id: offer._id,
        bookingId: booking._id,
        providerId: provider._id,
        providerName: provider.name,
        expiresAt,
      } : null,
      fcm: fcmResult,
    });
  } catch (err) {
    console.error('❌ send fatal:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

// ============================================================
// OFFER STATUS POLL
// ============================================================
exports.getOfferStatus = async (req, res) => {
  try {
    const { offerId } = req.params;
    const query = mongoose.Types.ObjectId.isValid(offerId)
      ? { _id: new mongoose.Types.ObjectId(offerId) }
      : { _id: offerId };
    const { doc: offer } = await findOneInAllDbs(['provideroffers'], query);
    return res.json({ success: true, offer: offer || null });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

// ============================================================
// DEBUG
// ============================================================
async function debugHandler(req, res) {
  const conns = getAllConnections();
  const info = {
    env: {
      hasProviderFcmB64: !!process.env.PROVIDER_FIREBASE_SERVICE_ACCOUNT_BASE64,
      adminSecretSet: !!process.env.ADMIN_SECRET_KEY,
    },
    firebase: {
      appsCount: Array.isArray(firebaseAdmin.apps) ? firebaseAdmin.apps.length : 0,
      appNames: Array.isArray(firebaseAdmin.apps) ? firebaseAdmin.apps.map(a => a && a.name) : [],
    },
    db: {
      connections: await Promise.all(conns.map(async (c) => {
        let collections = [];
        try {
          const list = await c.db.listCollections().toArray();
          collections = list.map(x => x.name);
        } catch {}
        return { name: c.name, readyState: c.readyState, collections };
      })),
    },
    messagingInit: !!getProviderMessaging(),
  };

  // Count providers in each possible location
  info.providerCounts = {};
  for (const conn of conns) {
    for (const coll of ['providers', 'serviceproviders', 'provider']) {
      try {
        const c = await conn.db.collection(coll).countDocuments();
        if (c > 0) info.providerCounts[`${conn.name}.${coll}`] = c;
      } catch {}
    }
  }

  return res.json(info);
}
exports.debug = debugHandler;
exports.debugConnections = debugHandler;

exports._health = async (req, res) => {
  return res.json({ ok: true, time: new Date().toISOString() });
};