// ═══════════════════════════════════════════════════════════════════════════
// 🚨 MANUAL DISPATCH CONTROLLER
// Admin manually sends booking to any provider with HYBRID ALARM FCM
// Raw MongoDB collection access — bypasses Mongoose model DB mismatch
// ═══════════════════════════════════════════════════════════════════════════

const mongoose = require('mongoose');
const admin = require('firebase-admin');
const { cert } = require('firebase-admin/app');

// ═══════════════════════════════════════════════════════════════
// 🔧 DB CONNECTIONS HELPER
// ═══════════════════════════════════════════════════════════════
function getAllConnections() {
  const connections = [];
  try {
    const dbConfig = require('../config/database');
    const dbNames = [
      'admin_panel',
      'provider_db',
      'user_db',
      'bookings_db',
      'tracking_db',
      'trackingprovider_db',
    ];
    for (const name of dbNames) {
      try {
        const getterName = `get${name.charAt(0).toUpperCase() + name.slice(1).replace(/_([a-z])/g, (_, c) => c.toUpperCase())}Connection`;
        if (typeof dbConfig[getterName] === 'function') {
          const conn = dbConfig[getterName]();
          if (conn?.db) connections.push({ name, conn });
        }
      } catch (e) {}
    }
  } catch (e) {}

  // Fallback: scan mongoose.connections
  if (connections.length === 0) {
    for (const conn of mongoose.connections) {
      if (conn?.db && conn?.name) {
        connections.push({ name: conn.name, conn });
      }
    }
  }

  // Also include default connection
  if (mongoose.connection?.db) {
    const exists = connections.some((c) => c.conn === mongoose.connection);
    if (!exists) {
      connections.push({ name: mongoose.connection.name || 'default', conn: mongoose.connection });
    }
  }

  return connections;
}

// ═══════════════════════════════════════════════════════════════
// 🔍 FIND IN ALL DBs (with sort + limit support)
// ═══════════════════════════════════════════════════════════════
async function findInAllDbs(collectionNames, query = {}, options = {}) {
  const connections = getAllConnections();
  const seen = new Set();
  const results = [];

  const sort = options.sort || { _id: -1 };
  const limit = options.limit || 500;

  for (const { name: dbName, conn } of connections) {
    if (!conn?.db) continue;
    for (const collName of collectionNames) {
      try {
        const coll = conn.db.collection(collName);
        const docs = await coll
          .find(query)
          .sort(sort)
          .limit(limit)
          .toArray();

        if (docs.length > 0) {
          console.log(`   ✓ Found ${docs.length} in ${dbName}.${collName}`);
          for (const doc of docs) {
            const key = String(doc._id);
            if (!seen.has(key)) {
              seen.add(key);
              results.push({ ...doc, _sourceDb: dbName, _sourceColl: collName });
            }
          }
        }
      } catch (e) {
        // collection doesn't exist in this db, skip
      }
    }
  }

  return results;
}

// ═══════════════════════════════════════════════════════════════
// 🔍 FIND ONE IN ALL DBs
// ═══════════════════════════════════════════════════════════════
async function findOneInAllDbs(collectionNames, query) {
  const connections = getAllConnections();
  for (const { name: dbName, conn } of connections) {
    if (!conn?.db) continue;
    for (const collName of collectionNames) {
      try {
        const coll = conn.db.collection(collName);
        const doc = await coll.findOne(query);
        if (doc) {
          console.log(`   ✓ Found doc in ${dbName}.${collName}`);
          return { doc, conn, collName, dbName };
        }
      } catch (e) {}
    }
  }
  return { doc: null, conn: null, collName: null, dbName: null };
}

// ═══════════════════════════════════════════════════════════════
// 💾 INSERT IN SPECIFIC DB
// ═══════════════════════════════════════════════════════════════
async function insertInDb(dbName, collName, document) {
  const connections = getAllConnections();
  const target = connections.find((c) => c.name === dbName);
  const conn = target?.conn || connections[0]?.conn;
  if (!conn?.db) throw new Error('No database connection available');
  try {
    const coll = conn.db.collection(collName);
    const result = await coll.insertOne(document);
    console.log(`   ✓ Inserted into ${target?.name || 'default'}.${collName}: ${result.insertedId}`);
    return result;
  } catch (e) {
    console.error(`❌ Insert failed in ${dbName}.${collName}:`, e.message);
    throw e;
  }
}

// ═══════════════════════════════════════════════════════════════
// 🔄 UPDATE IN ALL DBs
// ═══════════════════════════════════════════════════════════════
async function updateInAllDbs(collectionNames, query, update) {
  const connections = getAllConnections();
  let totalModified = 0;
  for (const { name: dbName, conn } of connections) {
    if (!conn?.db) continue;
    for (const collName of collectionNames) {
      try {
        const coll = conn.db.collection(collName);
        const result = await coll.updateMany(query, update);
        if (result.modifiedCount > 0) {
          console.log(`   ✓ Updated ${result.modifiedCount} in ${dbName}.${collName}`);
          totalModified += result.modifiedCount;
        }
      } catch (e) {}
    }
  }
  return totalModified;
}

// ═══════════════════════════════════════════════════════════════
// 🔥 FIREBASE PROVIDER APP (for sending FCM to providers)
// ═══════════════════════════════════════════════════════════════
let providerApp = null;

function getProviderFirebaseApp() {
  if (providerApp) return providerApp;

  try {
    const existing = admin.apps.find((a) => a?.name === 'provider');
    if (existing) {
      providerApp = existing;
      return providerApp;
    }
  } catch (e) {}

  try {
    let serviceAccount = null;
    const base64 =
      process.env.PROVIDER_FIREBASE_SERVICE_ACCOUNT_BASE64 ||
      process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;

    if (base64) {
      console.log('✅ Loading Firebase credentials from PROVIDER_FIREBASE_SERVICE_ACCOUNT_BASE64 (base64)');
      const jsonStr = Buffer.from(base64, 'base64').toString('utf-8');
      serviceAccount = JSON.parse(jsonStr);
    } else {
      const path = process.env.PROVIDER_FIREBASE_SERVICE_ACCOUNT_PATH;
      if (path) {
        serviceAccount = require(path);
      }
    }

    if (!serviceAccount) {
      throw new Error('No Firebase service account found');
    }

    // Try two approaches — admin.credential first, then modular cert()
    let credential;
    try {
      credential = admin.credential.cert(serviceAccount);
    } catch (e) {
      credential = cert(serviceAccount);
    }

    providerApp = admin.initializeApp(
      {
        credential,
        projectId: serviceAccount.project_id,
      },
      'provider'
    );

    console.log(`✅ Provider Firebase initialized (project: ${serviceAccount.project_id})`);
    return providerApp;
  } catch (err) {
    console.error('❌ Provider Firebase init failed:', err.message);
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════
// 🛠️ STRINGIFY ALL (FCM data must be string-only)
// ═══════════════════════════════════════════════════════════════
function stringifyAll(obj) {
  const out = {};
  for (const key in obj) {
    const val = obj[key];
    if (val === null || val === undefined) {
      out[key] = '';
    } else if (typeof val === 'object') {
      out[key] = JSON.stringify(val);
    } else {
      out[key] = String(val);
    }
  }
  return out;
}

// ═══════════════════════════════════════════════════════════════
// 📡 GET ONLINE PROVIDERS (sorted by recent — newest first)
// ═══════════════════════════════════════════════════════════════
exports.getOnlineProviders = async (req, res) => {
  try {
    const { all, search, category } = req.query;
    const includeAll = all === '1' || all === 'true';

    // Build base query
    let query = {};
    if (!includeAll) {
      query = {
        $or: [
          { isOnline: true },
          { online: true },
          { isAvailable: true },
          { status: 'online' },
          { status: 'active' },
        ],
      };
    }

    // Category filter (only non-empty string)
    if (category && typeof category === 'string' && category.trim().length > 0) {
      const catRegex = new RegExp(category.trim(), 'i');
      const catFilter = {
        $or: [
          { profession: catRegex },
          { category: catRegex },
          { categoryName: catRegex },
          { 'category.name': catRegex },
        ],
      };
      query = includeAll ? catFilter : { $and: [query, catFilter] };
    }

    console.log(
      `🔍 [getOnlineProviders] Query:`,
      JSON.stringify(query),
      'includeAll:',
      includeAll
    );

    // ✅ SORT BY RECENT: createdAt DESC first
    const providers = await findInAllDbs(
      ['providers', 'serviceproviders', 'provider'],
      query,
      {
        sort: { createdAt: -1, updatedAt: -1, lastSeen: -1, _id: -1 },
        limit: 500,
      }
    );

    // Fallback: if 0 results with filter, retry empty
    let finalProviders = providers;
    if (!includeAll && providers.length === 0) {
      console.log('⚠️ No online providers found, retrying with empty query...');
      finalProviders = await findInAllDbs(
        ['providers', 'serviceproviders', 'provider'],
        {},
        {
          sort: { createdAt: -1, updatedAt: -1, _id: -1 },
          limit: 500,
        }
      );
    }

    // Search filter (in-memory)
    let filtered = finalProviders;
    if (search && typeof search === 'string' && search.trim().length > 0) {
      const s = search.trim().toLowerCase();
      filtered = finalProviders.filter((p) => {
        const name = (p.name || p.fullName || p.providerName || '').toLowerCase();
        const phone = (p.phone || p.mobile || p.phoneNumber || '').toLowerCase();
        const email = (p.email || '').toLowerCase();
        const pid = (p.providerId || p.providerCode || p.id || '').toString().toLowerCase();
        const prof = (p.profession || p.category || p.categoryName || '').toLowerCase();
        return (
          name.includes(s) ||
          phone.includes(s) ||
          email.includes(s) ||
          pid.includes(s) ||
          prof.includes(s)
        );
      });
    }

    // ✅ RE-SORT in-memory (safety net — handles missing createdAt)
    filtered.sort((a, b) => {
      const aTime = new Date(a.createdAt || a.updatedAt || a.lastSeen || 0).getTime();
      const bTime = new Date(b.createdAt || b.updatedAt || b.lastSeen || 0).getTime();
      return bTime - aTime; // DESC = newest first
    });

    // Format response
    const formatted = filtered.map((p) => ({
      _id: p._id,
      id: p._id,
      providerId: p.providerId || p.providerCode || p._id,
      name: p.name || p.fullName || p.providerName || 'Unknown',
      phone: p.phone || p.mobile || p.phoneNumber || '',
      email: p.email || '',
      profession: p.profession || p.category || p.categoryName || '',
      category: p.category || p.profession || '',
      city: p.city || p.address?.city || '',
      isOnline: !!(p.isOnline || p.online || p.isAvailable || p.status === 'online'),
      isApproved: !!(p.isApproved || p.approved || p.status === 'approved'),
      rating: p.rating || p.avgRating || 0,
      totalJobs: p.totalJobs || p.completedJobs || 0,
      fcmToken: p.fcmToken || p.fcm_token || '',
      hasToken: !!(p.fcmToken || p.fcm_token),
      createdAt: p.createdAt || null,
      updatedAt: p.updatedAt || null,
      lastSeen: p.lastSeen || null,
    }));

    console.log(`📊 Returned ${formatted.length} providers (recent-first)`);

    return res.json({
      success: true,
      count: formatted.length,
      providers: formatted,
      data: { providers: formatted },
    });
  } catch (err) {
    console.error('❌ [getOnlineProviders] Error:', err);
    return res.status(500).json({
      success: false,
      message: err.message || 'Failed to fetch online providers',
      providers: [],
    });
  }
};

// ═══════════════════════════════════════════════════════════════
// 📡 GET DISPATCHABLE BOOKINGS (sorted by recent — newest first)
// ═══════════════════════════════════════════════════════════════
exports.getDispatchableBookings = async (req, res) => {
  try {
    const { search, status, limit } = req.query;
    const maxLimit = Math.min(parseInt(limit) || 300, 500);

    // ✅ SORT BY RECENT first
    const bookings = await findInAllDbs(
      ['bookings', 'Booking'],
      {},
      {
        sort: { createdAt: -1, updatedAt: -1, scheduledDate: -1, _id: -1 },
        limit: maxLimit * 2, // extra for dedup
      }
    );

    // Status filter
    let filtered = bookings;
    if (status && typeof status === 'string' && status.trim().length > 0) {
      const s = status.trim().toLowerCase();
      filtered = bookings.filter((b) => (b.status || '').toLowerCase() === s);
    }

    // Search filter
    if (search && typeof search === 'string' && search.trim().length > 0) {
      const q = search.trim().toLowerCase();
      filtered = filtered.filter((b) => {
        const bid = (b.bookingId || b._id || '').toString().toLowerCase();
        const customer = (b.customerName || b.userName || b.user?.name || '').toLowerCase();
        const service = (b.serviceName || b.service?.name || '').toLowerCase();
        const phone = (b.customerPhone || b.phone || b.user?.phone || '').toLowerCase();
        return bid.includes(q) || customer.includes(q) || service.includes(q) || phone.includes(q);
      });
    }

    // ✅ RE-SORT in-memory (safety)
    filtered.sort((a, b) => {
      const aTime = new Date(a.createdAt || a.updatedAt || a.scheduledDate || 0).getTime();
      const bTime = new Date(b.createdAt || b.updatedAt || b.scheduledDate || 0).getTime();
      return bTime - aTime;
    });

    // Limit final
    filtered = filtered.slice(0, maxLimit);

    // Format
    const formatted = filtered.map((b) => ({
      _id: b._id,
      id: b._id,
      bookingId: b.bookingId || b._id,
      serviceName: b.serviceName || b.service?.name || 'Service',
      serviceIcon: b.serviceIcon || '🔧',
      categoryName: b.categoryName || b.category?.name || '',
      customerName: b.customerName || b.userName || b.user?.name || 'Customer',
      customerPhone: b.customerPhone || b.phone || b.user?.phone || '',
      customerId: b.customerId || b.userId || b.user?._id || '',
      address: b.address || b.serviceAddress || '',
      city: b.city || '',
      totalAmount: b.totalAmount || b.price || b.amount || 0,
      baseAmount: b.baseAmount || b.servicePrice || b.price || 0,
      servicePrice: b.servicePrice || b.price || 0,
      priceDisplay: b.priceDisplay || `₹${b.totalAmount || b.price || 0}`,
      scheduledDate: b.scheduledDate || b.date || b.createdAt,
      scheduledTime: b.scheduledTime || b.time || '',
      status: b.status || 'pending',
      assignedProvider: b.assignedProvider || b.providerId || null,
      assignedProviderName: b.assignedProviderName || b.providerName || '',
      createdAt: b.createdAt || null,
      updatedAt: b.updatedAt || null,
      isAssigned: !!(b.assignedProvider || b.providerId),
      isActive: ['pending', 'searching', 'assigned', 'accepted', 'in_progress'].includes(
        (b.status || '').toLowerCase()
      ),
    }));

    console.log(`📊 Returned ${formatted.length} bookings (recent-first)`);

    return res.json({
      success: true,
      count: formatted.length,
      bookings: formatted,
      data: { bookings: formatted },
    });
  } catch (err) {
    console.error('❌ [getDispatchableBookings] Error:', err);
    return res.status(500).json({
      success: false,
      message: err.message || 'Failed to fetch bookings',
      bookings: [],
    });
  }
};

// ═══════════════════════════════════════════════════════════════
// 🚀 SEND MANUAL DISPATCH (FORCE RE-DISPATCH)
// ═══════════════════════════════════════════════════════════════
exports.sendManualDispatch = async (req, res) => {
  const startTime = Date.now();
  try {
    const { bookingId, providerId, adminNote } = req.body;

    console.log('\n' + '='.repeat(60));
    console.log('📨 FORCE RE-DISPATCH');
    console.log('📦 Body:', JSON.stringify(req.body));
    console.log('='.repeat(60));

    if (!bookingId || !providerId) {
      return res.status(400).json({
        success: false,
        message: 'bookingId aur providerId dono required hain',
      });
    }

    // ───────────────────────────────────────────────────────
    // 1. FIND BOOKING
    // ───────────────────────────────────────────────────────
    const bookingQuery = mongoose.Types.ObjectId.isValid(bookingId)
      ? { $or: [{ _id: new mongoose.Types.ObjectId(bookingId) }, { bookingId: bookingId }] }
      : { bookingId: bookingId };

    const bookingResult = await findOneInAllDbs(['bookings', 'Booking'], bookingQuery);
    const booking = bookingResult.doc;

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    // ───────────────────────────────────────────────────────
    // 2. FIND PROVIDER
    // ───────────────────────────────────────────────────────
    const providerQuery = mongoose.Types.ObjectId.isValid(providerId)
      ? {
          $or: [
            { _id: new mongoose.Types.ObjectId(providerId) },
            { providerId: providerId },
            { providerCode: providerId },
          ],
        }
      : { $or: [{ providerId: providerId }, { providerCode: providerId }] };

    const providerResult = await findOneInAllDbs(
      ['providers', 'serviceproviders', 'provider'],
      providerQuery
    );
    const provider = providerResult.doc;

    if (!provider) {
      return res.status(404).json({ success: false, message: 'Provider not found' });
    }

    const fcmToken = provider.fcmToken || provider.fcm_token;
    if (!fcmToken) {
      return res.status(400).json({
        success: false,
        message: 'Provider ke paas FCM token nahi hai — notification nahi ja sakti',
      });
    }

    // ───────────────────────────────────────────────────────
    // 3. CANCEL OLD PROVIDER OFFER (if any)
    // ───────────────────────────────────────────────────────
    const oldProviderId = booking.assignedProvider || booking.providerId;
    if (oldProviderId && String(oldProviderId) !== String(provider._id)) {
      console.log(`🔄 Cancelling old provider: ${oldProviderId}`);

      // Mark old offers as cancelled
      await updateInAllDbs(
        ['provideroffers', 'ProviderOffer'],
        {
          bookingId: booking._id,
          providerId: oldProviderId,
          status: { $in: ['pending', 'sent', 'waiting'] },
        },
        {
          $set: {
            status: 'cancelled',
            cancelledAt: new Date(),
            cancelReason: 'admin_force_redispatch',
          },
        }
      );

      // Send cancellation FCM to old provider
      try {
        const oldProviderResult = await findOneInAllDbs(
          ['providers', 'serviceproviders', 'provider'],
          mongoose.Types.ObjectId.isValid(oldProviderId)
            ? { _id: new mongoose.Types.ObjectId(oldProviderId) }
            : { providerId: oldProviderId }
        );
        const oldProvider = oldProviderResult.doc;
        if (oldProvider?.fcmToken) {
          const app = getProviderFirebaseApp();
          if (app) {
            await admin.messaging(app).send({
              token: oldProvider.fcmToken,
              data: stringifyAll({
                type: 'booking_cancelled',
                bookingId: String(booking._id),
                reason: 'admin_reassigned',
                _source: 'fcm',
                _sentAt: Date.now(),
              }),
              android: { priority: 'high' },
            });
            console.log('✅ Cancellation FCM sent to old provider');
          }
        }
      } catch (e) {
        console.warn('⚠️ Old provider cancel FCM failed:', e.message);
      }
    }

    // ───────────────────────────────────────────────────────
    // 4. RESET BOOKING TO SEARCHING
    // ───────────────────────────────────────────────────────
    await updateInAllDbs(
      ['bookings', 'Booking'],
      { _id: booking._id },
      {
        $set: {
          status: 'searching',
          assignedProvider: null,
          providerId: null,
          assignedProviderName: null,
          providerName: null,
          updatedAt: new Date(),
        },
      }
    );

    // ───────────────────────────────────────────────────────
    // 5. CREATE PROVIDER OFFER
    // ───────────────────────────────────────────────────────
    const offerId = new mongoose.Types.ObjectId();
    const expiresAt = new Date(Date.now() + 30 * 1000);

    const offerDoc = {
      _id: offerId,
      bookingId: booking._id,
      providerId: provider._id,
      providerCode: provider.providerId || provider.providerCode,
      status: 'pending',
      source: 'manual_admin',
      adminNote: adminNote || '',
      sentAt: new Date(),
      expiresAt: expiresAt,
      timeout: 30,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    try {
      await insertInDb('bookings_db', 'provideroffers', offerDoc);
    } catch (e) {
      try {
        await insertInDb('admin_panel', 'provideroffers', offerDoc);
      } catch (e2) {
        console.warn('⚠️ Offer insert failed in both DBs:', e2.message);
      }
    }

    // ───────────────────────────────────────────────────────
    // 6. CREATE DISPATCH JOB (try multiple status enums)
    // ───────────────────────────────────────────────────────
    const jobDoc = {
      bookingId: booking._id,
      providerId: provider._id,
      offerId: offerId,
      source: 'manual_admin',
      adminNote: adminNote || '',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const statusCandidates = ['pending', 'active', 'dispatched', 'searching', 'sent', 'waiting'];
    for (const st of statusCandidates) {
      try {
        await insertInDb('admin_panel', 'dispatchjobs', { ...jobDoc, status: st });
        break;
      } catch (e) {
        if (st === statusCandidates[statusCandidates.length - 1]) {
          console.warn('⚠️ DispatchJob insert failed all statuses:', e.message);
        }
      }
    }

    // ───────────────────────────────────────────────────────
    // 7. SEND HYBRID ALARM FCM TO NEW PROVIDER
    // ───────────────────────────────────────────────────────
    const app = getProviderFirebaseApp();
    if (!app) {
      return res.status(500).json({
        success: false,
        message: 'Firebase not initialized',
      });
    }

    const serviceName = booking.serviceName || booking.service?.name || 'Service';
    const totalAmount = booking.totalAmount || booking.price || booking.amount || 0;
    const baseAmount = booking.baseAmount || booking.servicePrice || totalAmount;
    const customerName = booking.customerName || booking.userName || booking.user?.name || 'Customer';
    const address = booking.address || booking.serviceAddress || '';
    const city = booking.city || '';
    const scheduledTime = booking.scheduledTime || booking.time || 'ASAP';
    const scheduledDate = booking.scheduledDate || booking.date || new Date().toISOString();
    const priceDisplay = booking.priceDisplay || `₹${totalAmount}`;

    const title = `🔔 New Booking! ₹${totalAmount}`;
    const body = `${serviceName} • ${priceDisplay} • ${scheduledTime}\n📍 ${address}`;

    const fcmMessage = {
      token: fcmToken,
      notification: {
        title: title,
        body: body,
      },
      data: stringifyAll({
        type: 'booking_request',
        bookingId: String(booking._id),
        bookingObjectId: String(booking._id),
        actionUrl: `/booking-detail?bookingId=${booking._id}`,
        serviceName: serviceName,
        serviceIcon: '🔧',
        categoryName: booking.categoryName || booking.category?.name || '',
        customerName: customerName,
        totalAmount: totalAmount,
        baseAmount: baseAmount,
        servicePrice: baseAmount,
        priceDisplay: priceDisplay,
        scheduledTime: scheduledTime,
        scheduledDate: scheduledDate,
        address: address,
        city: city,
        priority: 'high',
        channelId: 'bookings_alarm',
        category: 'booking_request',
        clickAction: 'OPEN_BOOKING',
        timeout: 30,
        expiresAt: expiresAt.getTime(),
        isExclusive: 'true',
        source: 'manual_admin',
        _isBookingAlarm: 'true',
        _source: 'fcm',
        _sentAt: Date.now(),
        sound: 'booking_alarm',
        title: title,
        body: body,
      }),
      android: {
        priority: 'high',
        ttl: 120000,
        collapseKey: `booking_${booking._id}`,
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
          title: title,
          body: body,
        },
      },
      apns: {
        headers: {
          'apns-priority': '10',
          'apns-expiration': String(Math.floor(expiresAt.getTime() / 1000)),
        },
        payload: {
          aps: {
            sound: 'booking_alarm.caf',
            'interruption-level': 'time-sensitive',
            alert: {
              title: title,
              body: body,
            },
          },
        },
      },
    };

    let fcmResult = null;
    try {
      fcmResult = await admin.messaging(app).send(fcmMessage);
      console.log('✅ HYBRID ALARM FCM sent:', fcmResult);
    } catch (fcmErr) {
      console.error('❌ FCM FAILED:', fcmErr.message);
      return res.status(500).json({
        success: false,
        message: `FCM failed: ${fcmErr.message}`,
        offerId: offerId,
      });
    }

    // ───────────────────────────────────────────────────────
    // 8. SOCKET EMIT (if available)
    // ───────────────────────────────────────────────────────
    try {
      const io = req.app.get('io');
      if (io) {
        io.emit('dispatch:manual', {
          offerId: String(offerId),
          bookingId: String(booking._id),
          providerId: String(provider._id),
          providerName: provider.name || provider.fullName,
          expiresAt: expiresAt,
        });
      }
    } catch (e) {}

    const elapsed = Date.now() - startTime;
    console.log(`✅ Manual dispatch complete in ${elapsed}ms`);

    return res.json({
      success: true,
      message: 'Provider ko notification bhej di gayi',
      offerId: String(offerId),
      bookingId: String(booking._id),
      providerId: String(provider._id),
      providerName: provider.name || provider.fullName,
      expiresAt: expiresAt,
      fcmMessageId: fcmResult,
      elapsed: `${elapsed}ms`,
    });
  } catch (err) {
    console.error('❌ [sendManualDispatch] Error:', err);
    return res.status(500).json({
      success: false,
      message: err.message || 'Dispatch failed',
    });
  }
};

// ═══════════════════════════════════════════════════════════════
// 📊 GET OFFER STATUS
// ═══════════════════════════════════════════════════════════════
exports.getOfferStatus = async (req, res) => {
  try {
    const { offerId } = req.params;
    const query = mongoose.Types.ObjectId.isValid(offerId)
      ? { _id: new mongoose.Types.ObjectId(offerId) }
      : { _id: offerId };

    const result = await findOneInAllDbs(['provideroffers', 'ProviderOffer'], query);
    if (!result.doc) {
      return res.status(404).json({ success: false, message: 'Offer not found' });
    }

    const offer = result.doc;
    const now = Date.now();
    const expiresAt = new Date(offer.expiresAt).getTime();
    const remainingSec = Math.max(0, Math.floor((expiresAt - now) / 1000));

    return res.json({
      success: true,
      offer: {
        _id: offer._id,
        status: offer.status,
        bookingId: offer.bookingId,
        providerId: offer.providerId,
        sentAt: offer.sentAt,
        expiresAt: offer.expiresAt,
        remainingSec: remainingSec,
        acceptedAt: offer.acceptedAt,
        rejectedAt: offer.rejectedAt,
        cancelledAt: offer.cancelledAt,
      },
    });
  } catch (err) {
    console.error('❌ [getOfferStatus] Error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ═══════════════════════════════════════════════════════════════
// 🩺 DEBUG — Shows where providers/bookings live
// ═══════════════════════════════════════════════════════════════
async function debugHandler(req, res) {
  try {
    const connections = getAllConnections();
    const providerCounts = {};
    const bookingCounts = {};

    for (const { name: dbName, conn } of connections) {
      if (!conn?.db) continue;
      for (const collName of ['providers', 'serviceproviders', 'provider']) {
        try {
          const count = await conn.db.collection(collName).countDocuments();
          if (count > 0) providerCounts[`${dbName}.${collName}`] = count;
        } catch (e) {}
      }
      for (const collName of ['bookings', 'Booking']) {
        try {
          const count = await conn.db.collection(collName).countDocuments();
          if (count > 0) bookingCounts[`${dbName}.${collName}`] = count;
        } catch (e) {}
      }
    }

    return res.json({
      success: true,
      connections: connections.map((c) => ({ name: c.name, hasDb: !!c.conn?.db })),
      providerCounts,
      bookingCounts,
      env: {
        hasFirebaseBase64: !!process.env.PROVIDER_FIREBASE_SERVICE_ACCOUNT_BASE64,
        hasAdminSecret: !!process.env.ADMIN_SECRET_KEY,
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

exports.debug = debugHandler;
exports.debugConnections = debugHandler;

// ═══════════════════════════════════════════════════════════════
// 🏥 HEALTH CHECK
// ═══════════════════════════════════════════════════════════════
exports._health = (req, res) => {
  return res.json({
    success: true,
    service: 'manual-dispatch',
    timestamp: new Date().toISOString(),
  });
};