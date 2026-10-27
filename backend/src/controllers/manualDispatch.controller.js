// ═══════════════════════════════════════════════════════════════
// MANUAL DISPATCH CONTROLLER - FULL DATA ENRICHMENT + HYBRID FCM
// ═══════════════════════════════════════════════════════════════

const mongoose = require('mongoose');
const admin = require('firebase-admin');
const { cert: modularCert } = require('firebase-admin/app');
const {
  getAdminConnection,
  getProviderConnection,
  getUserConnection,
  getBookingConnection,
} = require('../config/database');

// ═══════════════════════════════════════════════════════════════
// 🔧 HELPERS
// ═══════════════════════════════════════════════════════════════

function stringifyAll(obj) {
  const out = {};
  for (const k in obj) {
    const v = obj[k];
    if (v === null || v === undefined) continue;
    if (typeof v === 'string') out[k] = v;
    else if (typeof v === 'number' || typeof v === 'boolean') out[k] = String(v);
    else if (typeof v === 'object') {
      try { out[k] = JSON.stringify(v); } catch { out[k] = String(v); }
    } else out[k] = String(v);
  }
  return out;
}

function safeStr(v, fallback = '') {
  if (v === null || v === undefined) return fallback;
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (typeof v === 'object') {
    if (v.cityName) return String(v.cityName);
    if (v.name) return String(v.name);
    if (v.fullName) return String(v.fullName);
    if (v.title) return String(v.title);
    if (v.label) return String(v.label);
    return '';
  }
  return fallback;
}

function toObjectId(id) {
  try {
    if (!id) return null;
    if (id instanceof mongoose.Types.ObjectId) return id;
    const s = String(id);
    if (/^[0-9a-fA-F]{24}$/.test(s)) return new mongoose.Types.ObjectId(s);
    return null;
  } catch { return null; }
}

// ═══════════════════════════════════════════════════════════════
// 🔥 FIREBASE INIT (Provider App)
// ═══════════════════════════════════════════════════════════════

let providerFirebaseApp = null;

function getProviderFirebaseApp() {
  if (providerFirebaseApp) return providerFirebaseApp;

  try {
    try {
      providerFirebaseApp = admin.app('provider');
      return providerFirebaseApp;
    } catch {}

    const b64 = process.env.PROVIDER_FIREBASE_SERVICE_ACCOUNT_BASE64;
    if (!b64) {
      console.error('❌ PROVIDER_FIREBASE_SERVICE_ACCOUNT_BASE64 not set');
      return null;
    }
    const json = Buffer.from(b64, 'base64').toString('utf8');
    const serviceAccount = JSON.parse(json);

    let credential;
    try {
      credential = admin.credential.cert(serviceAccount);
    } catch {
      credential = modularCert(serviceAccount);
    }

    providerFirebaseApp = admin.initializeApp({ credential }, 'provider');
    console.log('✅ Provider Firebase initialized (manualDispatch)');
    return providerFirebaseApp;
  } catch (err) {
    console.error('❌ Provider Firebase init failed:', err.message);
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════
// 🔍 MULTI-DB FINDERS
// ═══════════════════════════════════════════════════════════════

async function findInAllDbs(collectionNames, query = {}, options = {}) {
  const { sort = { createdAt: -1, _id: -1 }, limit = 500 } = options;
  const results = [];
  const seen = new Set();
  const connections = [
    { name: 'admin_panel', conn: getAdminConnection() },
    { name: 'provider_db', conn: getProviderConnection() },
    { name: 'user_db', conn: getUserConnection() },
    { name: 'bookings_db', conn: getBookingConnection() },
  ];

  for (const { name: dbName, conn } of connections) {
    if (!conn || !conn.db) continue;
    for (const collName of collectionNames) {
      try {
        const coll = conn.db.collection(collName);
        const docs = await coll.find(query).sort(sort).limit(limit).toArray();
        if (docs.length > 0) {
          console.log(`   ✓ Found ${docs.length} in ${dbName}.${collName}`);
          for (const d of docs) {
            const id = String(d._id);
            if (!seen.has(id)) {
              seen.add(id);
              d.__sourceDb = dbName;
              d.__sourceColl = collName;
              results.push(d);
            }
          }
        }
      } catch {}
    }
  }
  return results;
}

async function findOneInAllDbs(collectionNames, query) {
  const connections = [
    { name: 'admin_panel', conn: getAdminConnection() },
    { name: 'provider_db', conn: getProviderConnection() },
    { name: 'user_db', conn: getUserConnection() },
    { name: 'bookings_db', conn: getBookingConnection() },
  ];
  for (const { name: dbName, conn } of connections) {
    if (!conn || !conn.db) continue;
    for (const collName of collectionNames) {
      try {
        const coll = conn.db.collection(collName);
        const doc = await coll.findOne(query);
        if (doc) {
          doc.__sourceDb = dbName;
          doc.__sourceColl = collName;
          return doc;
        }
      } catch {}
    }
  }
  return null;
}

async function insertInDb(dbGetter, collName, doc) {
  try {
    const conn = dbGetter();
    if (!conn || !conn.db) return null;
    const result = await conn.db.collection(collName).insertOne(doc);
    return result.insertedId;
  } catch (err) {
    console.error(`❌ Insert failed ${collName}:`, err.message);
    return null;
  }
}

async function updateInAllDbs(collectionNames, filter, update) {
  const connections = [
    getAdminConnection(), getProviderConnection(),
    getUserConnection(), getBookingConnection(),
  ];
  let updated = 0;
  for (const conn of connections) {
    if (!conn || !conn.db) continue;
    for (const collName of collectionNames) {
      try {
        const r = await conn.db.collection(collName).updateOne(filter, update);
        if (r.modifiedCount > 0) updated++;
      } catch {}
    }
  }
  return updated;
}

// ═══════════════════════════════════════════════════════════════
// 📚 LOOKUP CACHES — load once per request for enrichment
// ═══════════════════════════════════════════════════════════════

async function loadCategoriesMap() {
  const cats = await findInAllDbs(['categories'], {}, { sort: { _id: 1 }, limit: 500 });
  const map = {};
  for (const c of cats) {
    map[String(c._id)] = c.name || c.categoryName || c.title || '';
  }
  return map;
}

async function loadCitiesMap() {
  const cities = await findInAllDbs(['cities'], {}, { sort: { _id: 1 }, limit: 500 });
  const map = {};
  for (const c of cities) {
    map[String(c._id)] = c.cityName || c.name || '';
    if (c.cityId) map[String(c.cityId)] = c.cityName || c.name || '';
  }
  return map;
}

async function loadServicesMap() {
  const services = await findInAllDbs(['services'], {}, { sort: { _id: 1 }, limit: 500 });
  const map = {};
  for (const s of services) {
    map[String(s._id)] = {
      name: s.name || s.serviceName || s.title || '',
      price: s.price || s.basePrice || s.amount || 0,
      icon: s.icon || '🔧',
      categoryName: s.categoryName || '',
    };
  }
  return map;
}

async function loadUsersMap() {
  const users = await findInAllDbs(['users'], {}, { sort: { _id: 1 }, limit: 1000 });
  const map = {};
  for (const u of users) {
    map[String(u._id)] = {
      name: u.name || u.fullName || u.firstName || 'Customer',
      phone: u.phone || u.phoneNumber || u.mobile || '',
      email: u.email || '',
    };
  }
  return map;
}

// ═══════════════════════════════════════════════════════════════
// 🎯 GET ONLINE PROVIDERS - FULLY ENRICHED
// ═══════════════════════════════════════════════════════════════

exports.getOnlineProviders = async (req, res) => {
  try {
    const includeAll = req.query.all === '1' || req.query.all === 'true';
    const search = req.query.search || '';
    const categoryFilter = req.query.category || '';

    let query = {};
    if (!includeAll) {
      query = {
        $or: [
          { isOnline: true }, { online: true },
          { isAvailable: true }, { status: 'online' },
          { status: 'active' }, { isApproved: true },
        ],
      };
    }

    console.log(`🔍 [getOnlineProviders] Query:`, JSON.stringify(query), 'includeAll:', includeAll);

    const [rawProviders, categoriesMap, citiesMap] = await Promise.all([
      findInAllDbs(['providers'], query, { sort: { createdAt: -1, _id: -1 }, limit: 500 }),
      loadCategoriesMap(),
      loadCitiesMap(),
    ]);

    // ENRICH each provider
    const enriched = rawProviders.map(p => {
      // Category resolution
      let categoryName = '';
      if (p.category) {
        if (typeof p.category === 'string') {
          categoryName = categoriesMap[p.category] || p.category;
        } else if (typeof p.category === 'object') {
          categoryName = p.category.name || p.category.categoryName || categoriesMap[String(p.category._id)] || '';
        }
      }
      if (!categoryName) categoryName = p.categoryName || p.profession || p.serviceCategory || '';

      // City resolution
      let cityName = '';
      if (p.city) {
        if (typeof p.city === 'string') {
          cityName = citiesMap[p.city] || p.city;
        } else if (typeof p.city === 'object') {
          cityName = p.city.cityName || p.city.name || citiesMap[String(p.city._id || p.city.cityId)] || '';
        }
      }
      if (!cityName) cityName = p.cityName || '';

      return {
        _id: String(p._id),
        name: p.name || p.fullName || p.firstName || 'Unnamed',
        fullName: p.fullName || p.name || '',
        phone: p.phone || p.phoneNumber || p.mobile || '',
        phoneNumber: p.phoneNumber || p.phone || '',
        email: p.email || '',
        isOnline: Boolean(p.isOnline || p.online || p.status === 'online'),
        isAvailable: Boolean(p.isAvailable),
        isApproved: Boolean(p.isApproved),
        fcmToken: p.fcmToken || p.fcm_token || '',
        hasFcm: Boolean(p.fcmToken || p.fcm_token),
        category: categoryName,
        categoryName: categoryName,
        city: cityName,
        cityName: cityName,
        rating: p.rating || 0,
        totalJobs: p.totalJobs || p.completedJobs || 0,
        createdAt: p.createdAt || null,
        lastSeen: p.lastSeen || p.lastActive || null,
        __sourceDb: p.__sourceDb,
      };
    });

    // Apply filters
    let filtered = enriched;
    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.phone.toLowerCase().includes(q) ||
        p.email.toLowerCase().includes(q)
      );
    }
    if (categoryFilter) {
      const q = categoryFilter.toLowerCase();
      filtered = filtered.filter(p => p.category.toLowerCase().includes(q));
    }

    // Final sort recent-first
    filtered.sort((a, b) => {
      const ta = new Date(a.createdAt || a.lastSeen || 0).getTime();
      const tb = new Date(b.createdAt || b.lastSeen || 0).getTime();
      return tb - ta;
    });

    console.log(`📊 Returned ${filtered.length} providers (enriched, recent-first)`);
    return res.json({ success: true, data: { providers: filtered, count: filtered.length } });
  } catch (err) {
    console.error('❌ getOnlineProviders error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ═══════════════════════════════════════════════════════════════
// 📦 GET DISPATCHABLE BOOKINGS - FULLY ENRICHED
// ═══════════════════════════════════════════════════════════════

exports.getDispatchableBookings = async (req, res) => {
  try {
    const [rawBookings, usersMap, servicesMap, categoriesMap, citiesMap] = await Promise.all([
      findInAllDbs(['bookings'], {}, { sort: { createdAt: -1, _id: -1 }, limit: 300 }),
      loadUsersMap(),
      loadServicesMap(),
      loadCategoriesMap(),
      loadCitiesMap(),
    ]);

    const enriched = rawBookings.map(b => {
      // Customer resolution
      let customerName = '';
      let customerPhone = '';
      const userId = b.userId || b.user || b.customerId;
      if (userId && typeof userId === 'string' && usersMap[userId]) {
        customerName = usersMap[userId].name;
        customerPhone = usersMap[userId].phone;
      } else if (userId && typeof userId === 'object') {
        customerName = userId.name || userId.fullName || '';
        customerPhone = userId.phone || userId.phoneNumber || '';
        const uid = String(userId._id || userId.id);
        if (!customerName && usersMap[uid]) {
          customerName = usersMap[uid].name;
          customerPhone = usersMap[uid].phone;
        }
      }
      if (!customerName) customerName = b.customerName || b.userName || b.name || 'Unknown';
      if (!customerPhone) customerPhone = b.customerPhone || b.userPhone || b.phone || '-';

      // Service resolution
      let serviceName = '';
      let serviceIcon = '🔧';
      let servicePrice = 0;
      const serviceId = b.serviceId || b.service;
      if (serviceId && typeof serviceId === 'string' && servicesMap[serviceId]) {
        serviceName = servicesMap[serviceId].name;
        serviceIcon = servicesMap[serviceId].icon;
        servicePrice = servicesMap[serviceId].price;
      } else if (serviceId && typeof serviceId === 'object') {
        serviceName = serviceId.name || serviceId.serviceName || serviceId.title || '';
        serviceIcon = serviceId.icon || '🔧';
        servicePrice = serviceId.price || 0;
      }
      if (!serviceName) serviceName = b.serviceName || b.service_name || b.title || 'Service';

      // Category
      let categoryName = '';
      if (b.category) {
        if (typeof b.category === 'string') categoryName = categoriesMap[b.category] || b.category;
        else categoryName = b.category.name || b.category.categoryName || '';
      }
      if (!categoryName) categoryName = b.categoryName || b.serviceCategory || '';

      // Address
      let address = '';
      let cityName = '';
      if (b.address) {
        if (typeof b.address === 'string') address = b.address;
        else {
          address = [b.address.flatNo, b.address.street, b.address.area, b.address.landmark,
            b.address.city?.cityName || b.address.city, b.address.state, b.address.pincode]
            .filter(x => x && typeof x === 'string').join(', ');
          cityName = b.address.city?.cityName || (typeof b.address.city === 'string' ? b.address.city : '');
        }
      }
      if (!address) address = b.fullAddress || b.customerAddress || '-';

      if (!cityName && b.city) {
        if (typeof b.city === 'string') cityName = citiesMap[b.city] || b.city;
        else cityName = b.city.cityName || b.city.name || '';
      }

      // Assigned provider
      let assignedProviderName = '';
      let assignedProviderId = '';
      const assigned = b.assignedProvider || b.provider || b.providerId;
      if (assigned) {
        if (typeof assigned === 'string') { assignedProviderId = assigned; }
        else if (typeof assigned === 'object') {
          assignedProviderId = String(assigned._id || assigned.id || '');
          assignedProviderName = assigned.name || assigned.fullName || '';
        }
      }

      // Amount
      const totalAmount = Number(b.totalAmount || b.amount || b.price || b.total || servicePrice || 0);

      return {
        _id: String(b._id),
        bookingId: b.bookingId || b.orderId || String(b._id).slice(-8).toUpperCase(),
        customerName,
        customerPhone,
        userId: typeof userId === 'object' ? String(userId._id || userId.id || '') : String(userId || ''),
        serviceName,
        serviceIcon,
        serviceId: typeof serviceId === 'object' ? String(serviceId._id || '') : String(serviceId || ''),
        categoryName,
        totalAmount,
        amount: totalAmount,
        address,
        city: cityName,
        status: b.status || 'pending',
        assignedProvider: assignedProviderId ? { _id: assignedProviderId, name: assignedProviderName } : null,
        scheduledDate: b.scheduledDate || b.date || null,
        scheduledTime: b.scheduledTime || b.time || '',
        createdAt: b.createdAt || null,
        __sourceDb: b.__sourceDb,
      };
    });

    console.log(`📊 Returned ${enriched.length} bookings (enriched, recent-first)`);
    return res.json({ success: true, data: { bookings: enriched, count: enriched.length } });
  } catch (err) {
    console.error('❌ getDispatchableBookings error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ═══════════════════════════════════════════════════════════════
// 🚀 SEND DISPATCH - HYBRID ALARM FCM + FULL FORCE RE-DISPATCH
// ═══════════════════════════════════════════════════════════════

exports.send = async (req, res) => {
  try {
    const { bookingId, providerId, adminNote } = req.body;
    if (!bookingId || !providerId) {
      return res.status(400).json({ success: false, message: 'bookingId & providerId required' });
    }

    console.log(`🚀 [DISPATCH] booking=${bookingId} → provider=${providerId}`);

    // 1. Fetch booking + provider
    const bookingOid = toObjectId(bookingId);
    const providerOid = toObjectId(providerId);

    const booking = await findOneInAllDbs(['bookings'], {
      $or: [{ _id: bookingOid }, { bookingId: bookingId }].filter(x => x._id || x.bookingId),
    });
    if (!booking) {
      return res.status(404).json({ success: false, message: `Booking ${bookingId} not found` });
    }

    const provider = await findOneInAllDbs(['providers'], {
      _id: providerOid || bookingId,
    });
    if (!provider) {
      return res.status(404).json({ success: false, message: `Provider ${providerId} not found` });
    }

    if (!provider.fcmToken && !provider.fcm_token) {
      return res.status(400).json({
        success: false,
        message: `Provider ${provider.name || providerId} has no FCM token registered. Phone pe app login karna hoga.`,
      });
    }

    const fcmToken = provider.fcmToken || provider.fcm_token;

    // 2. Cancel any existing active offer for this booking
    console.log(`🔄 Cancelling existing offers for booking ${bookingId}...`);
    await updateInAllDbs(
      ['provideroffers'],
      { bookingId: String(booking._id), status: { $in: ['pending', 'sent', 'waiting'] } },
      { $set: { status: 'cancelled', cancelledBy: 'admin_manual_dispatch', cancelledAt: new Date() } }
    );

    // Reset booking to searching
    await updateInAllDbs(
      ['bookings'],
      { _id: booking._id },
      { $set: { status: 'searching', assignedProvider: null, updatedAt: new Date() } }
    );

    // 3. Enrich booking data for FCM
    const [usersMap, servicesMap, categoriesMap, citiesMap] = await Promise.all([
      loadUsersMap(), loadServicesMap(), loadCategoriesMap(), loadCitiesMap(),
    ]);

    const userId = String(booking.userId || booking.user || booking.customerId || '');
    const userInfo = usersMap[userId] || { name: 'Customer', phone: '' };
    const customerName = userInfo.name || booking.customerName || 'Customer';

    const serviceId = String(booking.serviceId || booking.service || '');
    const svcInfo = servicesMap[serviceId] || {};
    const serviceName = svcInfo.name || booking.serviceName || 'Service';
    const serviceIcon = svcInfo.icon || '🔧';
    const servicePrice = Number(booking.totalAmount || booking.amount || svcInfo.price || 0);

    let categoryName = '';
    if (booking.category) {
      if (typeof booking.category === 'string') categoryName = categoriesMap[booking.category] || booking.category;
      else categoryName = booking.category.name || '';
    }

    // Address string
    let addressStr = '';
    if (booking.address) {
      if (typeof booking.address === 'string') addressStr = booking.address;
      else {
        addressStr = [booking.address.flatNo, booking.address.street, booking.address.area,
          booking.address.landmark, booking.address.city?.cityName || booking.address.city,
          booking.address.state, booking.address.pincode]
          .filter(x => x && typeof x === 'string').join(', ');
      }
    }
    if (!addressStr) addressStr = 'Address not available';

    const scheduledTime = booking.scheduledTime || booking.time || '';
    const scheduledDate = booking.scheduledDate || booking.date || '';
    const totalAmount = servicePrice;
    const priceDisplay = `₹${totalAmount}`;

    // 4. Create new offer
    const offerId = new mongoose.Types.ObjectId();
    const expiresAt = Date.now() + 30000; // 30s

    const offerDoc = {
      _id: offerId,
      bookingId: String(booking._id),
      providerId: String(provider._id),
      providerName: provider.name || provider.fullName || '',
      status: 'pending',
      source: 'manual_admin',
      adminNote: adminNote || '',
      expiresAt: new Date(expiresAt),
      createdAt: new Date(),
    };
    await insertInDb(getBookingConnection, 'provideroffers', offerDoc);
    await insertInDb(getAdminConnection, 'provideroffers', offerDoc);

    // 5. Create dispatch job
    const dispatchDoc = {
      bookingId: String(booking._id),
      providerId: String(provider._id),
      status: 'pending',
      source: 'manual_admin',
      offerId: String(offerId),
      createdAt: new Date(),
    };
    const dispatchStatuses = ['pending', 'active', 'dispatched', 'searching', 'sent', 'waiting'];
    for (const st of dispatchStatuses) {
      try {
        dispatchDoc.status = st;
        await insertInDb(getAdminConnection, 'dispatchjobs', dispatchDoc);
        break;
      } catch {}
    }

    // 6. Send HYBRID ALARM FCM
    const title = `🔔 New Booking! ${priceDisplay}`;
    const body = `${serviceName} • ${priceDisplay} • ${scheduledTime || 'ASAP'}\n📍 ${addressStr}`;

    const fcmData = stringifyAll({
      type: 'booking_request',
      bookingId: String(booking._id),
      bookingObjectId: String(booking._id),
      offerId: String(offerId),
      actionUrl: `/booking-detail?bookingId=${String(booking._id)}`,
      serviceName,
      serviceIcon,
      categoryName,
      customerName,
      totalAmount,
      baseAmount: totalAmount,
      servicePrice: totalAmount,
      priceDisplay,
      scheduledTime,
      scheduledDate,
      address: addressStr,
      city: '',
      priority: 'high',
      channelId: 'bookings_alarm',
      category: 'booking_request',
      clickAction: 'OPEN_BOOKING',
      timeout: 30,
      expiresAt,
      isExclusive: 'true',
      source: 'manual_admin',
      _isBookingAlarm: 'true',
      _source: 'fcm',
      _sentAt: Date.now(),
      sound: 'booking_alarm',
      title,
      body,
    });

    const message = {
      token: fcmToken,
      notification: { title, body },
      data: fcmData,
      android: {
        priority: 'high',
        ttl: 120000,
        collapseKey: `booking_${String(booking._id)}`,
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
          title,
          body,
        },
      },
      apns: {
        headers: {
          'apns-priority': '10',
          'apns-expiration': String(Math.floor(expiresAt / 1000)),
        },
        payload: {
          aps: {
            sound: 'booking_alarm.caf',
            'interruption-level': 'time-sensitive',
            alert: { title, body },
          },
        },
      },
    };

    let fcmSent = false;
    let fcmError = '';
    try {
      const app = getProviderFirebaseApp();
      if (!app) throw new Error('Provider Firebase not initialized');
      const resp = await app.messaging().send(message);
      console.log(`✅ FCM SENT: ${resp}`);
      fcmSent = true;
    } catch (err) {
      console.error(`❌ FCM FAILED: ${err.message}`);
      fcmError = err.message;
    }

    // 7. Socket emit
    try {
      const io = req.app.get('io');
      if (io) {
        io.to('admins').emit('manual-dispatch:sent', {
          offerId: String(offerId),
          bookingId: String(booking._id),
          providerId: String(provider._id),
          providerName: provider.name,
          fcmSent,
          expiresAt,
        });
      }
    } catch {}

    return res.json({
      success: true,
      message: fcmSent ? '✅ Dispatch sent — FCM delivered' : `⚠️ Dispatch created but FCM failed: ${fcmError}`,
      data: {
        offerId: String(offerId),
        bookingId: String(booking._id),
        providerId: String(provider._id),
        providerName: provider.name,
        fcmSent,
        fcmError,
        expiresAt,
      },
    });
  } catch (err) {
    console.error('❌ send dispatch error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

// Aliases
exports.sendManualDispatch = exports.send;
exports.dispatch = exports.send;

// ═══════════════════════════════════════════════════════════════
// 📊 OFFER STATUS
// ═══════════════════════════════════════════════════════════════

exports.getOfferStatus = async (req, res) => {
  try {
    const { offerId } = req.params;
    const oid = toObjectId(offerId);
    const offer = await findOneInAllDbs(['provideroffers'], { _id: oid });
    if (!offer) {
      return res.status(404).json({ success: false, message: 'Offer not found' });
    }
    const now = Date.now();
    const expired = offer.expiresAt && new Date(offer.expiresAt).getTime() < now;
    let status = offer.status || 'pending';
    if (status === 'pending' && expired) status = 'expired';
    return res.json({
      success: true,
      data: { offerId, status, expiresAt: offer.expiresAt, providerId: offer.providerId },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ═══════════════════════════════════════════════════════════════
// 🔧 DEBUG + HEALTH
// ═══════════════════════════════════════════════════════════════

exports.debug = async (req, res) => {
  try {
    const providers = await findInAllDbs(['providers'], {}, { limit: 10 });
    const bookings = await findInAllDbs(['bookings'], {}, { limit: 10 });
    const categories = await loadCategoriesMap();
    const cities = await loadCitiesMap();
    const services = await loadServicesMap();
    const users = await loadUsersMap();
    return res.json({
      success: true,
      data: {
        providerCount: providers.length,
        bookingCount: bookings.length,
        categoriesLoaded: Object.keys(categories).length,
        citiesLoaded: Object.keys(cities).length,
        servicesLoaded: Object.keys(services).length,
        usersLoaded: Object.keys(users).length,
        sampleProvider: providers[0] || null,
        sampleBooking: bookings[0] || null,
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.debugConnections = exports.debug;

exports._health = async (req, res) => {
  return res.json({
    success: true,
    message: 'Manual Dispatch controller is alive',
    controllerExports: Object.keys(exports),
    timestamp: new Date().toISOString(),
  });
};