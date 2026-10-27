// backend/src/controllers/manualDispatch.controller.js
// FINAL FIX: Strict provider_db fetch + no_provider_found only bookings

const mongoose = require('mongoose');
const admin = require('firebase-admin');
let getMessagingModular = null;
try {
  const fbApp = require('firebase-admin/app');
  const fbMsg = require('firebase-admin/messaging');
  getMessagingModular = fbMsg.getMessaging;
} catch (e) {
  console.warn('[ManualDispatch] firebase-admin/messaging modular import failed:', e.message);
}

// ===== DB CONNECTION HELPER =====
function getDbByName(name) {
  try {
    const conns = mongoose.connections || [];
    for (let i = 0; i < conns.length; i++) {
      const c = conns[i];
      if (!c) continue;
      const dbName = (c.name || (c.db && c.db.databaseName) || '').toString();
      if (dbName === name) return c;
    }
    // fallback: default connection
    if (mongoose.connection && mongoose.connection.readyState === 1) {
      return mongoose.connection;
    }
    return null;
  } catch (e) {
    console.error('[ManualDispatch] getDbByName error:', e.message);
    return null;
  }
}

function getCollection(dbName, collName) {
  const conn = getDbByName(dbName);
  if (!conn) {
    console.error(`[ManualDispatch] ❌ DB not found: ${dbName}`);
    return null;
  }
  try {
    return conn.db.collection(collName);
  } catch (e) {
    console.error(`[ManualDispatch] ❌ Collection error ${dbName}.${collName}:`, e.message);
    return null;
  }
}

// ===== HELPERS =====
function toObjectId(id) {
  try {
    if (!id) return null;
    if (id instanceof mongoose.Types.ObjectId) return id;
    const s = String(id).trim();
    if (/^[0-9a-fA-F]{24}$/.test(s)) return new mongoose.Types.ObjectId(s);
    return null;
  } catch (e) {
    return null;
  }
}

function stringifyAll(obj) {
  const out = {};
  Object.keys(obj || {}).forEach(k => {
    const v = obj[k];
    if (v === null || v === undefined) {
      out[k] = '';
    } else if (typeof v === 'string') {
      out[k] = v;
    } else if (typeof v === 'number' || typeof v === 'boolean') {
      out[k] = String(v);
    } else {
      try {
        out[k] = JSON.stringify(v);
      } catch (e) {
        out[k] = '';
      }
    }
  });
  return out;
}

function _getMessagingFromApp(app) {
  // Try multiple ways because firebase-admin v12+ changed API
  try {
    if (admin && typeof admin.messaging === 'function') {
      return admin.messaging(app);
    }
  } catch (e) {
    console.warn('⚠️ admin.messaging(app) failed:', e.message);
  }
  try {
    if (getMessagingModular) return getMessagingModular(app);
  } catch (e) {
    console.warn('⚠️ getMessaging(app) failed:', e.message);
  }
  try {
    if (getMessagingModular) return getMessagingModular();
  } catch (e) {
    console.warn('⚠️ getMessaging() failed:', e.message);
  }
  try {
    if (admin && typeof admin.messaging === 'function') return admin.messaging();
  } catch (e) {
    console.warn('⚠️ admin.messaging() failed:', e.message);
  }
  return null;
}

function getProviderMessaging() {
  try {
    const apps = admin.apps || [];
    let providerApp = null;
    for (let i = 0; i < apps.length; i++) {
      const a = apps[i];
      if (!a) continue;
      const name = (a.name || '').toLowerCase();
      if (name.includes('provider')) {
        providerApp = a;
        break;
      }
    }
    if (!providerApp && apps.length > 0) {
      providerApp = apps[apps.length - 1]; // fallback last
    }
    if (!providerApp) {
      console.error('[ManualDispatch] ❌ No Firebase app found');
      return null;
    }
    return _getMessagingFromApp(providerApp);
  } catch (e) {
    console.error('[ManualDispatch] getProviderMessaging error:', e.message);
    return null;
  }
}

function cleanAddress(addr) {
  if (!addr) return '';
  if (typeof addr === 'string') {
    // Strip JSON leaks
    let s = addr.replace(/\{"cityId"[^}]*\}/g, '').trim();
    s = s.replace(/,\s*,/g, ',').replace(/^,|,$/g, '').trim();
    return s;
  }
  if (typeof addr === 'object') {
    const parts = [];
    if (addr.houseNo) parts.push(addr.houseNo);
    if (addr.street) parts.push(addr.street);
    if (addr.area) parts.push(addr.area);
    if (addr.landmark) parts.push(addr.landmark);
    if (addr.city && typeof addr.city === 'string') parts.push(addr.city);
    if (addr.state && typeof addr.state === 'string') parts.push(addr.state);
    if (addr.pincode) parts.push(addr.pincode);
    return parts.filter(Boolean).join(', ');
  }
  return '';
}

// ===== HEALTH & DEBUG =====
exports.health = async (req, res) => {
  res.json({ ok: true, service: 'manual-dispatch', ts: new Date().toISOString() });
};

exports.debugConnections = async (req, res) => {
  try {
    const conns = (mongoose.connections || []).map(c => ({
      name: c.name || (c.db && c.db.databaseName) || 'unknown',
      readyState: c.readyState,
      collections: c.collections ? Object.keys(c.collections) : []
    }));
    res.json({ ok: true, connections: conns, defaultReadyState: mongoose.connection ? mongoose.connection.readyState : -1 });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
};

exports.debug = async (req, res) => {
  try {
    const providersColl = getCollection('provider_db', 'providers');
    const bookingsColl = getCollection('bookings_db', 'bookings');
    const providersCount = providersColl ? await providersColl.countDocuments({}) : -1;
    const bookingsCount = bookingsColl ? await bookingsColl.countDocuments({}) : -1;
    const noProviderCount = bookingsColl ? await bookingsColl.countDocuments({ status: 'no_provider_found' }) : -1;
    res.json({
      ok: true,
      providers: providersCount,
      bookings: bookingsCount,
      noProviderBookings: noProviderCount
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
};

// ===== GET ONLINE PROVIDERS =====
exports.getOnlineProviders = async (req, res) => {
  try {
    const includeAll = req.query.all === '1' || req.query.all === 'true';
    const search = (req.query.search || '').toString().trim();
    const category = (req.query.category || '').toString().trim();

    const providersColl = getCollection('provider_db', 'providers');
    if (!providersColl) {
      return res.status(500).json({ success: false, message: 'provider_db.providers not available' });
    }

    // STRICT online query (no isApproved)
    const onlineQuery = includeAll ? {} : {
      $or: [
        { isOnline: true },
        { online: true },
        { isAvailable: true },
        { status: 'online' },
        { availability: 'online' }
      ]
    };

    const andClauses = [onlineQuery];

    if (search) {
      const rx = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      andClauses.push({
        $or: [
          { name: rx }, { fullName: rx }, { firstName: rx }, { lastName: rx },
          { phone: rx }, { phoneNumber: rx }, { mobile: rx },
          { 'city.name': rx }, { cityName: rx }, { city: rx }
        ]
      });
    }

    if (category) {
      const rx = new RegExp(category.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      andClauses.push({
        $or: [
          { category: rx },
          { categoryName: rx },
          { 'category.name': rx },
          { primaryCategory: rx }
        ]
      });
    }

    const finalQuery = andClauses.length > 1 ? { $and: andClauses } : onlineQuery;

    const rawProviders = await providersColl.find(finalQuery).limit(500).toArray();

    // Fetch lookup maps from admin_panel DB
    const categoriesColl = getCollection('admin_panel', 'categories');
    const citiesColl = getCollection('admin_panel', 'cities');

    const categoriesMap = new Map();
    const citiesMap = new Map();

    if (categoriesColl) {
      try {
        const cats = await categoriesColl.find({}).limit(500).toArray();
        cats.forEach(c => {
          if (c._id) categoriesMap.set(String(c._id), c.name || c.title || '');
        });
      } catch (e) {
        console.warn('[ManualDispatch] categories fetch failed:', e.message);
      }
    }

    if (citiesColl) {
      try {
        const cities = await citiesColl.find({}).limit(1000).toArray();
        cities.forEach(c => {
          if (c._id) citiesMap.set(String(c._id), c.name || c.cityName || '');
        });
      } catch (e) {
        console.warn('[ManualDispatch] cities fetch failed:', e.message);
      }
    }

    // Enrich providers with REAL data from provider_db
    const enriched = rawProviders.map(p => {
      // Name: try multiple fields
      const name = p.name || p.fullName ||
        [p.firstName, p.lastName].filter(Boolean).join(' ').trim() ||
        p.businessName || p.shopName || 'Unknown';

      // Phone
      const phone = p.phone || p.phoneNumber || p.mobile || p.contactNumber || '';

      // Category: resolve ObjectId → name
      let catName = '';
      if (p.category) {
        if (typeof p.category === 'string') {
          catName = categoriesMap.get(p.category) || p.category;
        } else if (typeof p.category === 'object' && p.category.name) {
          catName = p.category.name;
        } else if (p.category._id) {
          catName = categoriesMap.get(String(p.category._id)) || '';
        }
      }
      if (!catName) catName = p.categoryName || p.primaryCategory || '';
      // Fallback: scan services array
      if (!catName && Array.isArray(p.services) && p.services.length > 0) {
        const firstSvc = p.services[0];
        if (firstSvc && firstSvc.categoryName) catName = firstSvc.categoryName;
      }

      // City: resolve ObjectId → name
      let cityName = '';
      if (p.city) {
        if (typeof p.city === 'string') {
          cityName = citiesMap.get(p.city) || p.city;
        } else if (typeof p.city === 'object' && p.city.name) {
          cityName = p.city.name;
        } else if (p.city._id) {
          cityName = citiesMap.get(String(p.city._id)) || '';
        }
      }
      if (!cityName) cityName = p.cityName || p.workingCity || '';
      // Fallback: address.city
      if (!cityName && p.address) {
        if (typeof p.address === 'object' && p.address.city) {
          cityName = typeof p.address.city === 'string' ? p.address.city : '';
        }
      }

      // Online status (STRICT boolean)
      const isOnline = !!(
        p.isOnline === true ||
        p.online === true ||
        p.isAvailable === true ||
        p.status === 'online' ||
        p.availability === 'online'
      );

      // FCM token
      const fcmToken = p.fcmToken || p.fcm_token || p.deviceToken || p.pushToken || '';

      // Join date
      const joinDate = p.createdAt || p.joinedAt || p.registeredAt || null;

      // Last active
      const lastActive = p.lastActive || p.lastSeen || p.lastOnlineAt || p.updatedAt || null;

      return {
        _id: p._id,
        id: p._id,
        name: name,
        phone: phone,
        category: catName,
        categoryName: catName,
        city: cityName,
        cityName: cityName,
        isOnline: isOnline,
        hasFCM: !!(fcmToken && fcmToken.length > 20),
        fcmTokenLength: fcmToken ? fcmToken.length : 0,
        isApproved: p.isApproved === true,
        isVerified: p.isVerified === true,
        status: p.status || '',
        createdAt: joinDate,
        joinedAt: joinDate,
        lastActive: lastActive,
        rating: p.rating || p.averageRating || 0,
        totalJobs: p.totalJobs || p.completedBookings || 0
      };
    });

    // Sort recent-first
    enriched.sort((a, b) => {
      const da = new Date(a.createdAt || 0).getTime();
      const db = new Date(b.createdAt || 0).getTime();
      return db - da;
    });

    res.json({
      success: true,
      data: {
        providers: enriched,
        total: enriched.length,
        includeAll: includeAll
      }
    });
  } catch (e) {
    console.error('[ManualDispatch] getOnlineProviders error:', e);
    res.status(500).json({ success: false, message: e.message });
  }
};

// ===== GET DISPATCHABLE BOOKINGS (ONLY no_provider_found) =====
exports.getDispatchableBookings = async (req, res) => {
  try {
    const search = (req.query.search || '').toString().trim();
    const statusFilter = (req.query.status || '').toString().trim();

    const bookingsColl = getCollection('bookings_db', 'bookings');
    if (!bookingsColl) {
      return res.status(500).json({ success: false, message: 'bookings_db.bookings not available' });
    }

    // ===== DEFAULT: only no_provider_found + searching =====
    // These are the ONLY dispatchable bookings (admin needs to manually assign)
    let query;
    if (statusFilter && statusFilter !== 'all') {
      query = { status: statusFilter };
    } else {
      query = {
        status: { $in: ['no_provider_found', 'searching', 'pending'] }
      };
    }

    if (search) {
      const rx = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      query = {
        $and: [
          query,
          {
            $or: [
              { bookingId: rx },
              { bookingNumber: rx },
              { 'customer.name': rx },
              { customerName: rx },
              { 'service.name': rx },
              { serviceName: rx }
            ]
          }
        ]
      };
    }

    const rawBookings = await bookingsColl
      .find(query)
      .sort({ createdAt: -1 })
      .limit(500)
      .toArray();

    // Fetch lookup maps
    const servicesColl = getCollection('admin_panel', 'services');
    const subServicesColl = getCollection('admin_panel', 'subservices');
    const categoriesColl = getCollection('admin_panel', 'categories');
    const citiesColl = getCollection('admin_panel', 'cities');
    const usersColl = getCollection('user_db', 'users');

    const servicesMap = new Map();
    const subServicesMap = new Map();
    const categoriesMap = new Map();
    const citiesMap = new Map();
    const usersMap = new Map();

    if (servicesColl) {
      try {
        const svcs = await servicesColl.find({}).limit(1000).toArray();
        svcs.forEach(s => {
          if (s._id) servicesMap.set(String(s._id), { name: s.name || s.title || '', icon: s.icon || '' });
        });
      } catch (e) { console.warn('services fetch:', e.message); }
    }

    if (subServicesColl) {
      try {
        const subs = await subServicesColl.find({}).limit(2000).toArray();
        subs.forEach(s => {
          if (s._id) subServicesMap.set(String(s._id), { name: s.name || s.title || '', icon: s.icon || '' });
        });
      } catch (e) { console.warn('subservices fetch:', e.message); }
    }

    if (categoriesColl) {
      try {
        const cats = await categoriesColl.find({}).limit(500).toArray();
        cats.forEach(c => {
          if (c._id) categoriesMap.set(String(c._id), c.name || c.title || '');
        });
      } catch (e) { console.warn('categories fetch:', e.message); }
    }

    if (citiesColl) {
      try {
        const cities = await citiesColl.find({}).limit(1000).toArray();
        cities.forEach(c => {
          if (c._id) citiesMap.set(String(c._id), c.name || '');
        });
      } catch (e) { console.warn('cities fetch:', e.message); }
    }

    if (usersColl) {
      try {
        // Only fetch users referenced in bookings
        const userIds = rawBookings
          .map(b => b.userId || b.user || (b.customer && b.customer._id))
          .filter(Boolean)
          .map(id => toObjectId(id))
          .filter(Boolean);
        if (userIds.length > 0) {
          const users = await usersColl.find({ _id: { $in: userIds } }).toArray();
          users.forEach(u => {
            if (u._id) usersMap.set(String(u._id), {
              name: u.name || u.fullName || [u.firstName, u.lastName].filter(Boolean).join(' ').trim() || '',
              phone: u.phone || u.phoneNumber || u.mobile || ''
            });
          });
        }
      } catch (e) { console.warn('users fetch:', e.message); }
    }

    // Enrich bookings
    const enriched = rawBookings.map(b => {
      // Service name
      let svcName = '';
      let svcIcon = '';
      if (b.subServiceId) {
        const sub = subServicesMap.get(String(b.subServiceId));
        if (sub) { svcName = sub.name; svcIcon = sub.icon; }
      }
      if (!svcName && b.serviceId) {
        const svc = servicesMap.get(String(b.serviceId));
        if (svc) { svcName = svc.name; svcIcon = svc.icon; }
      }
      if (!svcName) svcName = b.serviceName || b.service_name || (b.service && b.service.name) || 'Service';

      // Category
      let catName = '';
      if (b.categoryId) catName = categoriesMap.get(String(b.categoryId)) || '';
      if (!catName) catName = b.categoryName || (b.category && b.category.name) || '';

      // City
      let cityName = '';
      if (b.cityId) cityName = citiesMap.get(String(b.cityId)) || '';
      if (!cityName) cityName = b.cityName || (b.city && typeof b.city === 'string' ? b.city : (b.city && b.city.name) || '');

      // Customer name/phone
      let custName = '';
      let custPhone = '';
      const uid = b.userId || b.user || (b.customer && b.customer._id);
      if (uid) {
        const u = usersMap.get(String(uid));
        if (u) { custName = u.name; custPhone = u.phone; }
      }
      if (!custName) custName = b.customerName || (b.customer && b.customer.name) || b.userName || '';
      if (!custPhone) custPhone = b.customerPhone || (b.customer && b.customer.phone) || b.userPhone || '';

      // Address
      const address = cleanAddress(b.address || b.customerAddress || b.serviceAddress || '');

      // Amount
      const amount = b.totalAmount || b.amount || b.total || b.price || 0;

      return {
        _id: b._id,
        id: b._id,
        bookingId: b.bookingId || b.bookingNumber || String(b._id),
        bookingNumber: b.bookingNumber || b.bookingId || '',
        status: b.status || 'unknown',
        serviceName: svcName,
        serviceIcon: svcIcon,
        categoryName: catName,
        cityName: cityName,
        customerName: custName,
        customerPhone: custPhone,
        address: address,
        totalAmount: amount,
        amount: amount,
        scheduledTime: b.scheduledTime || b.scheduledAt || '',
        scheduledDate: b.scheduledDate || '',
        providerId: b.providerId || b.provider || null,
        providerName: b.providerName || '',
        createdAt: b.createdAt || b.updatedAt || null
      };
    });

    res.json({
      success: true,
      data: {
        bookings: enriched,
        total: enriched.length
      }
    });
  } catch (e) {
    console.error('[ManualDispatch] getDispatchableBookings error:', e);
    res.status(500).json({ success: false, message: e.message });
  }
};

// ===== DISPATCH TO PROVIDER =====
exports.dispatch = async (req, res) => {
  const startTime = Date.now();
  try {
    const bookingId = req.body.bookingId;
    const providerId = req.body.providerId;
    const adminNote = req.body.adminNote || '';

    if (!bookingId || !providerId) {
      return res.status(400).json({ success: false, message: 'bookingId and providerId required' });
    }

    const bookingObjId = toObjectId(bookingId);
    const providerObjId = toObjectId(providerId);

    if (!bookingObjId || !providerObjId) {
      return res.status(400).json({ success: false, message: 'Invalid bookingId or providerId' });
    }

    console.log(`🚀 [DISPATCH] booking=${bookingId} → provider=${providerId}`);

    const bookingsColl = getCollection('bookings_db', 'bookings');
    const providersColl = getCollection('provider_db', 'providers');
    const offersColl = getCollection('bookings_db', 'provideroffers');
    const dispatchJobsColl = getCollection('bookings_db', 'dispatchjobs');

    if (!bookingsColl || !providersColl || !offersColl) {
      return res.status(500).json({ success: false, message: 'DB collections not available' });
    }

    // Fetch booking
    const booking = await bookingsColl.findOne({ _id: bookingObjId });
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }
    console.log(`📋 Booking found: status=${booking.status}`);

    // Fetch provider
    const provider = await providersColl.findOne({ _id: providerObjId });
    if (!provider) {
      return res.status(404).json({ success: false, message: 'Provider not found' });
    }
    const providerName = provider.name || provider.fullName ||
      [provider.firstName, provider.lastName].filter(Boolean).join(' ').trim() || 'Provider';
    console.log(`👤 Provider: ${providerName}`);

    const fcmToken = provider.fcmToken || provider.fcm_token || provider.deviceToken || provider.pushToken || '';
    if (!fcmToken) {
      return res.status(400).json({ success: false, message: 'Provider has no FCM token' });
    }
    console.log(`📱 FCM Token: ${fcmToken.substring(0, 20)}...`);

    // Cancel existing offers
    try {
      const cancelResult = await offersColl.updateMany(
        { bookingId: bookingObjId, status: { $in: ['pending', 'sent'] } },
        { $set: { status: 'cancelled', cancelledAt: new Date(), cancelReason: 'admin_reassign' } }
      );
      console.log(`   ❌ Cancelled ${cancelResult.modifiedCount} existing offers`);
    } catch (e) {
      console.warn('   ⚠️ Cancel offers failed:', e.message);
    }

    // Reset booking status
    try {
      await bookingsColl.updateOne(
        { _id: bookingObjId },
        { $set: { status: 'searching', updatedAt: new Date() }, $unset: { providerId: '', provider: '' } }
      );
      console.log(`   🔄 Booking status reset to searching`);
    } catch (e) {
      console.warn('   ⚠️ Reset booking failed:', e.message);
    }

    // Create ProviderOffer
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 30 * 1000);
    const offerDoc = {
      bookingId: bookingObjId,
      providerId: providerObjId,
      status: 'pending',
      sentAt: now,
      expiresAt: expiresAt,
      source: 'manual_admin',
      adminNote: adminNote,
      createdAt: now,
      updatedAt: now
    };
    const offerResult = await offersColl.insertOne(offerDoc);
    const offerId = offerResult.insertedId;
    console.log(`   ✅ ProviderOffer created: ${offerId}`);

    // Create DispatchJob (try multiple status values)
    let dispatchJobId = null;
    if (dispatchJobsColl) {
      const tryStatuses = ['pending', 'active', 'dispatched', 'searching', 'sent', 'waiting'];
      for (const st of tryStatuses) {
        try {
          const jobDoc = {
            bookingId: bookingObjId,
            providerId: providerObjId,
            offerId: offerId,
            status: st,
            source: 'manual_admin',
            createdAt: now,
            updatedAt: now
          };
          const jobResult = await dispatchJobsColl.insertOne(jobDoc);
          dispatchJobId = jobResult.insertedId;
          console.log(`   ✅ DispatchJob created: ${dispatchJobId} (status: ${st})`);
          break;
        } catch (e) {
          if (!/validation/i.test(e.message)) throw e;
        }
      }
    }

    // Build FCM message
    const amount = booking.totalAmount || booking.amount || 0;
    const svcName = booking.serviceName || 'Service';
    const custName = booking.customerName || 'Customer';
    const addr = cleanAddress(booking.address || '');
    const title = `🔔 New Booking! ₹${Number(amount).toFixed(0)}`;
    const body = `${svcName} • ₹${Number(amount).toFixed(0)}\n📍 ${addr || 'Address'}`;

    const messaging = getProviderMessaging();
    if (!messaging) {
      return res.status(500).json({
        success: false,
        message: 'FCM messaging not available',
        offerId: String(offerId)
      });
    }

    const fcmMessage = {
      token: fcmToken,
      notification: { title, body },
      data: stringifyAll({
        type: 'booking_request',
        bookingId: booking.bookingId || String(booking._id),
        bookingObjectId: String(booking._id),
        offerId: String(offerId),
        actionUrl: `/booking-detail?bookingId=${booking.bookingId || booking._id}`,
        serviceName: svcName,
        customerName: custName,
        totalAmount: String(amount),
        priceDisplay: `₹${Number(amount).toFixed(0)}`,
        address: addr,
        priority: 'high',
        channelId: 'bookings_alarm',
        category: 'booking_request',
        clickAction: 'OPEN_BOOKING',
        timeout: '30',
        expiresAt: String(expiresAt.getTime()),
        isExclusive: 'true',
        source: 'manual_admin',
        _isBookingAlarm: 'true',
        _source: 'fcm',
        _sentAt: String(Date.now()),
        sound: 'booking_alarm',
        title: title,
        body: body
      }),
      android: {
        priority: 'high',
        ttl: 120000,
        collapseKey: 'booking_' + String(booking._id),
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
          body: body
        }
      },
      apns: {
        headers: {
          'apns-priority': '10',
          'apns-expiration': String(Math.floor(expiresAt.getTime() / 1000))
        },
        payload: {
          aps: {
            sound: 'booking_alarm.caf',
            'interruption-level': 'time-sensitive',
            alert: { title, body }
          }
        }
      }
    };

    console.log(`📤 Sending HYBRID ALARM FCM...`);
    let fcmMessageId = null;
    let fcmError = null;
    try {
      fcmMessageId = await messaging.send(fcmMessage);
      console.log(`✅ FCM SENT! messageId: ${fcmMessageId}`);
    } catch (e) {
      fcmError = e.message;
      console.error(`❌ FCM FAILED:`, e.message);
    }

    // Update offer with FCM result
    try {
      await offersColl.updateOne(
        { _id: offerId },
        { $set: { fcmMessageId: fcmMessageId, fcmError: fcmError, fcmSentAt: new Date() } }
      );
    } catch (e) {}

    // Socket emit
    try {
      const io = req.app.get('io');
      if (io) {
        io.to('admins').emit('manual-dispatch:sent', {
          bookingId: String(booking._id),
          providerId: String(provider._id),
          offerId: String(offerId),
          success: !!fcmMessageId
        });
      }
    } catch (e) {}

    const duration = Date.now() - startTime;
    console.log(`🏁 [DISPATCH COMPLETE] success=${!!fcmMessageId} duration=${duration}ms`);

    res.json({
      success: !!fcmMessageId,
      data: {
        offerId: String(offerId),
        dispatchJobId: dispatchJobId ? String(dispatchJobId) : null,
        bookingId: String(booking._id),
        providerId: String(provider._id),
        providerName: providerName,
        fcmMessageId: fcmMessageId,
        fcmError: fcmError,
        expiresAt: expiresAt.toISOString(),
        duration: duration
      }
    });
  } catch (e) {
    console.error('[ManualDispatch] dispatch error:', e);
    res.status(500).json({ success: false, message: e.message });
  }
};

// ===== OFFER STATUS =====
exports.getOfferStatus = async (req, res) => {
  try {
    const offerId = toObjectId(req.params.offerId);
    if (!offerId) return res.status(400).json({ success: false, message: 'Invalid offerId' });

    const offersColl = getCollection('bookings_db', 'provideroffers');
    const bookingsColl = getCollection('bookings_db', 'bookings');
    if (!offersColl) return res.status(500).json({ success: false, message: 'offers DB not available' });

    const offer = await offersColl.findOne({ _id: offerId });
    if (!offer) return res.status(404).json({ success: false, message: 'Offer not found' });

    let status = offer.status || 'pending';

    // Auto-expire
    if (status === 'pending' && offer.expiresAt && new Date() > new Date(offer.expiresAt)) {
      status = 'expired';
      try {
        await offersColl.updateOne({ _id: offerId }, { $set: { status: 'expired' } });
      } catch (e) {}
    }

    // Check booking accept
    if (status === 'pending' && bookingsColl && offer.bookingId) {
      const booking = await bookingsColl.findOne({ _id: offer.bookingId });
      if (booking && booking.providerId && String(booking.providerId) === String(offer.providerId)) {
        if (['accepted', 'arrived', 'in_progress', 'completed'].includes(booking.status)) {
          status = 'accepted';
          try {
            await offersColl.updateOne({ _id: offerId }, { $set: { status: 'accepted' } });
          } catch (e) {}
        }
      }
    }

    res.json({
      success: true,
      status: status,
      data: { status: status, offer: { ...offer, status: status } },
      offer: { ...offer, status: status }
    });
  } catch (e) {
    console.error('[ManualDispatch] getOfferStatus error:', e);
    res.status(500).json({ success: false, message: e.message });
  }
};

// ===== TEST FCM =====
exports.testFCM = async (req, res) => {
  try {
    const providerId = req.params.providerId || req.body.providerId;
    const providerObjId = toObjectId(providerId);
    if (!providerObjId) return res.status(400).json({ success: false, message: 'Invalid providerId' });

    const providersColl = getCollection('provider_db', 'providers');
    if (!providersColl) return res.status(500).json({ success: false, message: 'provider DB not available' });

    const provider = await providersColl.findOne({ _id: providerObjId });
    if (!provider) return res.status(404).json({ success: false, message: 'Provider not found' });

    const name = provider.name || provider.fullName || 'Provider';
    const fcmToken = provider.fcmToken || provider.fcm_token || provider.deviceToken || provider.pushToken || '';
    const isOnline = !!(provider.isOnline || provider.online || provider.isAvailable);
    const lastActive = provider.lastActive || provider.lastSeen || provider.updatedAt;

    if (!fcmToken) {
      return res.json({
        success: false,
        data: {
          providerId: String(provider._id),
          providerName: name,
          fcmTokenPrefix: '',
          fcmTokenLength: 0,
          isOnline,
          lastActive,
          fcmError: 'No FCM token',
          tips: ['Provider has no FCM token', 'Ask provider to logout + login again']
        }
      });
    }

    const messaging = getProviderMessaging();
    if (!messaging) {
      return res.status(500).json({ success: false, message: 'FCM messaging not available' });
    }

    const title = '🧪 Test FCM';
    const body = `Test notification from admin for ${name}`;
    const now = Date.now();

    const fcmMessage = {
      token: fcmToken,
      notification: { title, body },
      data: stringifyAll({
        type: 'test_fcm',
        title,
        body,
        _source: 'admin_test',
        _sentAt: String(now)
      }),
      android: {
        priority: 'high',
        notification: {
          channelId: 'bookings_alarm',
          sound: 'booking_alarm',
          priority: 'max',
          title,
          body
        }
      },
      apns: {
        headers: { 'apns-priority': '10' },
        payload: { aps: { sound: 'default', alert: { title, body } } }
      }
    };

    let fcmMessageId = null;
    let fcmError = null;
    try {
      fcmMessageId = await messaging.send(fcmMessage);
    } catch (e) {
      fcmError = e.message;
    }

    res.json({
      success: !!fcmMessageId,
      data: {
        providerId: String(provider._id),
        providerName: name,
        fcmTokenPrefix: fcmToken.substring(0, 20) + '...',
        fcmTokenLength: fcmToken.length,
        isOnline,
        lastActive,
        fcmMessageId,
        fcmError,
        tips: [
          fcmToken.length < 100 ? '⚠️ Token seems short/invalid (valid tokens are 140+ chars)' : '✅ Token length OK',
          !isOnline ? '⚠️ Provider is OFFLINE - app may not receive' : '✅ Provider is online',
          'If messageId appears but phone no popup: battery optimization or notification permission issue',
          'Ask provider to logout + login to refresh FCM token'
        ]
      }
    });
  } catch (e) {
    console.error('[ManualDispatch] testFCM error:', e);
    res.status(500).json({ success: false, message: e.message });
  }
};