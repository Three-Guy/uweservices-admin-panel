// backend/src/controllers/manualDispatch.controller.js
// COMPLETE MANUAL DISPATCH CONTROLLER
// Firebase fix: uses getMessaging(app) instead of app.messaging()

const mongoose = require('mongoose');
const path = require('path');

// ============================================================
// UTILITY HELPERS
// ============================================================

function stringifyAll(obj) {
  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value === null || value === undefined) {
      result[key] = '';
    } else if (typeof value === 'object') {
      result[key] = JSON.stringify(value);
    } else {
      result[key] = String(value);
    }
  }
  return result;
}

function safeStr(val) {
  if (!val) return '';
  if (typeof val === 'string') return val;
  if (typeof val === 'object') {
    return val.cityName || val.name || val.fullName || val.title || val.label ||
           val.categoryName || val.serviceName || val.firstName ||
           JSON.stringify(val);
  }
  return String(val);
}

function safeNum(val) {
  if (!val) return 0;
  const n = Number(val);
  return isNaN(n) ? 0 : n;
}

function toObjectId(id) {
  try {
    if (!id) return null;
    const str = typeof id === 'object' && id._id ? String(id._id) : String(id);
    if (/^[0-9a-fA-F]{24}$/.test(str)) {
      return new mongoose.Types.ObjectId(str);
    }
    return null;
  } catch (e) {
    return null;
  }
}

function timeAgo(date) {
  if (!date) return '';
  const now = new Date();
  const d = new Date(date);
  const diffMs = now - d;
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return diffMins + 'm ago';
  const diffHrs = Math.floor(diffMins / 60);
  if (diffHrs < 24) return diffHrs + 'h ago';
  const diffDays = Math.floor(diffHrs / 24);
  return diffDays + 'd ago';
}

// ============================================================
// FIREBASE — CRITICAL FIX SECTION
// ============================================================
// Problem: firebase-admin v12+ does NOT have app.messaging()
// Solution: use getMessaging(app) from 'firebase-admin/messaging'
//           OR admin.messaging(app) — both work, app.messaging() does NOT

let _providerApp = null;
let _providerMessaging = null;

function getProviderFirebaseApp() {
  // If already initialized and messaging is ready, return cached
  if (_providerApp && _providerMessaging) {
    return { app: _providerApp, messaging: _providerMessaging };
  }

  const admin = require('firebase-admin');

  // Check if app with our name already exists
  const existingApps = admin.apps || [];
  const found = existingApps.find(function(a) {
    return a && a.name === 'manualDispatchProvider';
  });

  if (found) {
    _providerApp = found;
    // Get messaging from existing app — DO NOT use found.messaging()
    if (!_providerMessaging) {
      _providerMessaging = _getMessagingFromApp(admin, found);
    }
    if (_providerMessaging) {
      console.log('♻️ Reusing existing Firebase app + messaging');
      return { app: _providerApp, messaging: _providerMessaging };
    }
  }

  // Load service account
  var serviceAccount = null;
  var base64 = process.env.PROVIDER_FIREBASE_SERVICE_ACCOUNT_BASE64;

  if (base64) {
    try {
      var json = Buffer.from(base64, 'base64').toString('utf8');
      serviceAccount = JSON.parse(json);
      console.log('🔑 Provider service account loaded from BASE64, project:', serviceAccount.project_id);
    } catch (e) {
      console.error('❌ Failed to parse PROVIDER_FIREBASE_SERVICE_ACCOUNT_BASE64:', e.message);
    }
  }

  if (!serviceAccount) {
    var filePaths = [
      path.join(__dirname, '..', 'config', 'serviceproviderapp-b7767-firebase-adminsdk.json'),
      path.join(__dirname, '..', 'config', 'serviceAccountKey.json'),
      process.env.PROVIDER_FIREBASE_SERVICE_ACCOUNT_PATH
    ].filter(Boolean);

    for (var i = 0; i < filePaths.length; i++) {
      try {
        serviceAccount = require(filePaths[i]);
        console.log('🔑 Provider service account loaded from file:', filePaths[i]);
        break;
      } catch (e) {
        // continue to next path
      }
    }
  }

  if (!serviceAccount) {
    throw new Error('No provider Firebase service account found. Set PROVIDER_FIREBASE_SERVICE_ACCOUNT_BASE64 env var.');
  }

  // Create credential — try multiple methods
  var credential = null;
  try {
    credential = admin.credential.cert(serviceAccount);
    console.log('✅ Credential created via admin.credential.cert()');
  } catch (e1) {
    try {
      var certFn = require('firebase-admin/app').cert;
      credential = certFn(serviceAccount);
      console.log('✅ Credential created via modular cert()');
    } catch (e2) {
      throw new Error('Cannot create Firebase credential: ' + e1.message + ' / ' + e2.message);
    }
  }

  // Initialize app
  _providerApp = admin.initializeApp({
    credential: credential,
    projectId: serviceAccount.project_id
  }, 'manualDispatchProvider');

  console.log('✅ Provider Firebase app initialized (manualDispatchProvider)');

  // Get messaging — THIS IS THE CRITICAL FIX
  _providerMessaging = _getMessagingFromApp(admin, _providerApp);

  if (!_providerMessaging) {
    throw new Error('Firebase app initialized but could not get Messaging instance');
  }

  console.log('✅ Provider Firebase Messaging ready');
  return { app: _providerApp, messaging: _providerMessaging };
}

// Helper: Get messaging from app — tries ALL known methods
// NEVER calls app.messaging() — that does not exist in firebase-admin v12+
function _getMessagingFromApp(admin, app) {
  // Method 1: admin.messaging(app) — works in v11 and v12
  try {
    var m1 = admin.messaging(app);
    if (m1 && typeof m1.send === 'function') {
      console.log('✅ Messaging via admin.messaging(app)');
      return m1;
    }
  } catch (e) {
    console.log('⚠️ admin.messaging(app) failed:', e.message);
  }

  // Method 2: getMessaging(app) from firebase-admin/messaging — v12+ modular
  try {
    var getMessaging = require('firebase-admin/messaging').getMessaging;
    if (typeof getMessaging === 'function') {
      var m2 = getMessaging(app);
      if (m2 && typeof m2.send === 'function') {
        console.log('✅ Messaging via getMessaging(app)');
        return m2;
      }
    }
  } catch (e) {
    console.log('⚠️ getMessaging(app) failed:', e.message);
  }

  // Method 3: getMessaging() without app arg (uses default app)
  try {
    var getMessaging2 = require('firebase-admin/messaging').getMessaging;
    if (typeof getMessaging2 === 'function') {
      var m3 = getMessaging2();
      if (m3 && typeof m3.send === 'function') {
        console.log('✅ Messaging via getMessaging() default');
        return m3;
      }
    }
  } catch (e) {
    console.log('⚠️ getMessaging() default failed:', e.message);
  }

  // Method 4: admin.messaging() without app arg (uses default app)
  try {
    var m4 = admin.messaging();
    if (m4 && typeof m4.send === 'function') {
      console.log('✅ Messaging via admin.messaging() default');
      return m4;
    }
  } catch (e) {
    console.log('⚠️ admin.messaging() default failed:', e.message);
  }

  console.error('❌ ALL messaging methods failed!');
  return null;
}

// ============================================================
// DATABASE HELPERS
// ============================================================

function getConnection(dbName) {
  var conn = mongoose.connection;
  if (!conn || conn.readyState !== 1) {
    throw new Error('Mongoose not connected');
  }
  if (dbName === 'admin_panel') return conn;
  return conn.useDb(dbName, { useCache: true });
}

async function findInAllDbs(collectionName, query, options) {
  query = query || {};
  options = options || {};
  var dbs = ['admin_panel', 'provider_db', 'user_db', 'bookings_db'];
  var limit = options.limit || 1000;
  var sort = options.sort || { _id: -1 };

  for (var i = 0; i < dbs.length; i++) {
    try {
      var conn = getConnection(dbs[i]);
      var collection = conn.collection(collectionName);
      var count = await collection.countDocuments(query);
      if (count > 0) {
        var docs = await collection.find(query).sort(sort).limit(limit).toArray();
        console.log('   ✓ Found ' + docs.length + ' in ' + dbs[i] + '.' + collectionName);
        return { docs: docs, dbName: dbs[i], collection: collection };
      }
    } catch (e) {
      continue;
    }
  }
  return { docs: [], dbName: null, collection: null };
}

async function findOneInAllDbs(collectionName, query) {
  query = query || {};
  var dbs = ['admin_panel', 'provider_db', 'user_db', 'bookings_db'];

  for (var i = 0; i < dbs.length; i++) {
    try {
      var conn = getConnection(dbs[i]);
      var collection = conn.collection(collectionName);
      var doc = await collection.findOne(query);
      if (doc) {
        return { doc: doc, dbName: dbs[i], collection: collection };
      }
    } catch (e) {
      continue;
    }
  }
  return { doc: null, dbName: null, collection: null };
}

async function insertInDb(dbName, collectionName, doc) {
  var conn = getConnection(dbName);
  var collection = conn.collection(collectionName);
  return await collection.insertOne(doc);
}

async function updateInAllDbs(collectionName, query, update) {
  var dbs = ['admin_panel', 'provider_db', 'user_db', 'bookings_db'];
  var total = 0;
  for (var i = 0; i < dbs.length; i++) {
    try {
      var conn = getConnection(dbs[i]);
      var collection = conn.collection(collectionName);
      var result = await collection.updateMany(query, update);
      total += result.modifiedCount || 0;
    } catch (e) {
      continue;
    }
  }
  return total;
}

// ============================================================
// LOOKUP MAPS
// ============================================================

async function loadCategoriesMap() {
  var map = {};
  try {
    var conn = getConnection('admin_panel');
    var docs = await conn.collection('categories').find({}).toArray();
    console.log('   ✓ Found ' + docs.length + ' in admin_panel.categories');
    for (var i = 0; i < docs.length; i++) {
      map[String(docs[i]._id)] = safeStr(docs[i].name || docs[i].categoryName || docs[i].title || docs[i]);
    }
  } catch (e) {}
  try {
    var conn2 = getConnection('user_db');
    var docs2 = await conn2.collection('categories').find({}).toArray();
    console.log('   ✓ Found ' + docs2.length + ' in user_db.categories');
    for (var j = 0; j < docs2.length; j++) {
      if (!map[String(docs2[j]._id)]) {
        map[String(docs2[j]._id)] = safeStr(docs2[j].name || docs2[j].categoryName || docs2[j].title || docs2[j]);
      }
    }
  } catch (e) {}
  return map;
}

async function loadCitiesMap() {
  var map = {};
  try {
    var conn = getConnection('admin_panel');
    var docs = await conn.collection('cities').find({}).toArray();
    console.log('   ✓ Found ' + docs.length + ' in admin_panel.cities');
    for (var i = 0; i < docs.length; i++) {
      map[String(docs[i]._id)] = safeStr(docs[i].cityName || docs[i].name || docs[i].title || docs[i]);
    }
  } catch (e) {}
  try {
    var conn2 = getConnection('provider_db');
    var docs2 = await conn2.collection('cities').find({}).toArray();
    if (docs2.length > 0) {
      console.log('   ✓ Found ' + docs2.length + ' in provider_db.cities');
      for (var j = 0; j < docs2.length; j++) {
        if (!map[String(docs2[j]._id)]) {
          map[String(docs2[j]._id)] = safeStr(docs2[j].cityName || docs2[j].name || docs2[j].title || docs2[j]);
        }
      }
    }
  } catch (e) {}
  return map;
}

async function loadServicesMap() {
  var map = {};
  try {
    var conn = getConnection('admin_panel');
    var docs = await conn.collection('services').find({}).toArray();
    console.log('   ✓ Found ' + docs.length + ' in admin_panel.services');
    for (var i = 0; i < docs.length; i++) {
      map[String(docs[i]._id)] = {
        name: safeStr(docs[i].name || docs[i].serviceName || docs[i].title || docs[i]),
        icon: safeStr(docs[i].icon || docs[i].image || docs[i].imageUrl || ''),
        category: docs[i].category || docs[i].categoryId || null,
        price: safeNum(docs[i].price || docs[i].basePrice || docs[i].amount || 0)
      };
    }
  } catch (e) {}
  try {
    var conn2 = getConnection('user_db');
    var docs2 = await conn2.collection('services').find({}).toArray();
    console.log('   ✓ Found ' + docs2.length + ' in user_db.services');
    for (var j = 0; j < docs2.length; j++) {
      if (!map[String(docs2[j]._id)]) {
        map[String(docs2[j]._id)] = {
          name: safeStr(docs2[j].name || docs2[j].serviceName || docs2[j].title || docs2[j]),
          icon: safeStr(docs2[j].icon || docs2[j].image || docs2[j].imageUrl || ''),
          category: docs2[j].category || docs2[j].categoryId || null,
          price: safeNum(docs2[j].price || docs2[j].basePrice || docs2[j].amount || 0)
        };
      }
    }
  } catch (e) {}
  return map;
}

async function loadUsersMap() {
  var map = {};
  try {
    var conn = getConnection('user_db');
    var docs = await conn.collection('users').find({}).toArray();
    console.log('   ✓ Found ' + docs.length + ' in user_db.users');
    for (var i = 0; i < docs.length; i++) {
      map[String(docs[i]._id)] = {
        name: safeStr(docs[i].name || docs[i].fullName || docs[i].firstName || docs[i].displayName || 'Customer'),
        phone: safeStr(docs[i].phone || docs[i].phoneNumber || docs[i].mobile || ''),
        email: safeStr(docs[i].email || '')
      };
    }
  } catch (e) {}
  return map;
}

// ============================================================
// FORMAT ADDRESS
// ============================================================

function formatAddress(booking) {
  if (booking.fullAddress && typeof booking.fullAddress === 'string') return booking.fullAddress;
  if (booking.formattedAddress && typeof booking.formattedAddress === 'string') return booking.formattedAddress;

  var addr = booking.address || booking.serviceAddress || booking.location || {};
  if (typeof addr === 'string') return addr;

  if (typeof addr === 'object') {
    if (addr.fullAddress) return String(addr.fullAddress);
    if (addr.formattedAddress) return String(addr.formattedAddress);
    if (addr.full) return String(addr.full);

    var parts = [];
    if (addr.flatNo || addr.flat || addr.houseNo || addr.house)
      parts.push(String(addr.flatNo || addr.flat || addr.houseNo || addr.house));
    if (addr.building || addr.buildingName || addr.apartment)
      parts.push(String(addr.building || addr.buildingName || addr.apartment));
    if (addr.street || addr.streetName || addr.road)
      parts.push(String(addr.street || addr.streetName || addr.road));
    if (addr.area || addr.locality || addr.sector || addr.neighborhood)
      parts.push(String(addr.area || addr.locality || addr.sector || addr.neighborhood));
    if (addr.landmark) parts.push(String(addr.landmark));
    if (addr.city || addr.cityName) parts.push(String(addr.city || addr.cityName));
    if (addr.state) parts.push(String(addr.state));
    if (addr.pincode || addr.zipCode || addr.postalCode || addr.pin)
      parts.push(String(addr.pincode || addr.zipCode || addr.postalCode || addr.pin));

    if (parts.length > 0) return parts.join(', ');
    if (addr.address && typeof addr.address === 'string') return addr.address;

    if (addr.coordinates || addr.lat || addr.latitude) {
      var lat = addr.lat || addr.latitude || (addr.coordinates && addr.coordinates[1]) || '';
      var lng = addr.lng || addr.longitude || (addr.coordinates && addr.coordinates[0]) || '';
      if (lat && lng) return '📍 ' + lat + ', ' + lng;
    }
  }
  return '';
}

// ============================================================
// GET ONLINE PROVIDERS
// ============================================================

async function getOnlineProviders(req, res) {
  try {
    var includeAll = req.query.all === '1' || req.query.all === 'true';
    var searchTerm = req.query.search || '';
    var categoryFilter = req.query.category || '';

    var query = {};
    if (!includeAll) {
      query = {
        $or: [
          { isOnline: true },
          { online: true },
          { isAvailable: true },
          { status: 'online' },
          { status: 'active' },
          { isApproved: true }
        ]
      };
    }

    console.log('🔍 [getOnlineProviders] Query: ' + JSON.stringify(query) + ' includeAll: ' + includeAll);

    var maps = await Promise.all([loadCategoriesMap(), loadCitiesMap()]);
    var categoriesMap = maps[0];
    var citiesMap = maps[1];

    var result = await findInAllDbs('providers', query, { limit: 500, sort: { _id: -1 } });
    var providers = result.docs;

    var enriched = providers.map(function(p) {
      var categoryName = '';
      var catField = p.category || p.categoryId || p.categories;
      if (catField) {
        if (Array.isArray(catField)) {
          var names = catField.map(function(c) {
            var id = typeof c === 'object' ? String(c._id || c.categoryId || c) : String(c);
            return categoriesMap[id] || safeStr(c);
          }).filter(Boolean);
          categoryName = names.join(', ');
        } else {
          var id = typeof catField === 'object' ? String(catField._id || catField.categoryId || catField) : String(catField);
          categoryName = categoriesMap[id] || safeStr(catField);
        }
      }

      var cityName = '';
      var cityField = p.city || p.cityId || p.serviceCity;
      if (cityField) {
        if (typeof cityField === 'object' && cityField.cityName) {
          cityName = cityField.cityName;
        } else {
          var cid = typeof cityField === 'object' ? String(cityField._id || cityField) : String(cityField);
          cityName = citiesMap[cid] || safeStr(cityField);
        }
      }

      var fcmToken = p.fcmToken || p.fcm_token || p.deviceToken || p.pushToken ||
                     (p.deviceInfo && (p.deviceInfo.fcmToken || p.deviceInfo.token)) || '';
      var isOnline = p.isOnline || p.online || p.isAvailable ||
                     p.status === 'online' || p.status === 'active' || false;
      var name = safeStr(p.name || p.fullName || p.firstName || p.businessName || 'Provider');
      var phone = safeStr(p.phone || p.phoneNumber || p.mobile || '');
      var email = safeStr(p.email || '');
      var rating = safeNum(p.rating || p.averageRating || p.avgRating || 0);
      var totalJobs = safeNum(p.totalJobs || p.completedJobs || p.jobsCompleted || p.totalBookings || 0);

      return {
        _id: String(p._id),
        name: name,
        phone: phone,
        email: email,
        category: categoryName,
        categoryId: String(catField && typeof catField === 'object' ? (catField._id || catField) : (catField || '')),
        city: cityName,
        cityId: String(cityField && typeof cityField === 'object' ? (cityField._id || cityField) : (cityField || '')),
        isOnline: isOnline,
        isApproved: p.isApproved || p.approved || false,
        isVerified: p.isVerified || p.verified || false,
        hasFCM: !!fcmToken,
        fcmToken: fcmToken,
        rating: rating,
        totalJobs: totalJobs,
        profileImage: safeStr(p.profileImage || p.avatar || p.photo || p.image || ''),
        createdAt: p.createdAt || p._id.getTimestamp(),
        timeAgo: timeAgo(p.createdAt || p._id.getTimestamp()),
        lastActive: p.lastActive || p.lastSeen || p.updatedAt || '',
        lastActiveAgo: timeAgo(p.lastActive || p.lastSeen || p.updatedAt || '')
      };
    });

    var filtered = enriched;
    if (searchTerm) {
      var term = searchTerm.toLowerCase();
      filtered = filtered.filter(function(p) {
        return p.name.toLowerCase().includes(term) ||
               p.phone.toLowerCase().includes(term) ||
               p.email.toLowerCase().includes(term) ||
               p.category.toLowerCase().includes(term) ||
               p.city.toLowerCase().includes(term);
      });
    }

    if (categoryFilter) {
      var catLower = categoryFilter.toLowerCase();
      filtered = filtered.filter(function(p) {
        return p.category.toLowerCase().includes(catLower) || p.categoryId === categoryFilter;
      });
    }

    filtered.sort(function(a, b) {
      return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
    });

    console.log('📊 Returned ' + filtered.length + ' providers (enriched, recent-first)');

    res.json({
      success: true,
      data: {
        providers: filtered,
        total: filtered.length,
        allCategories: Array.from(new Set(enriched.map(function(p) { return p.category; }).filter(Boolean))).sort(),
        stats: {
          total: enriched.length,
          online: enriched.filter(function(p) { return p.isOnline; }).length,
          withFCM: enriched.filter(function(p) { return p.hasFCM; }).length,
          approved: enriched.filter(function(p) { return p.isApproved; }).length
        }
      }
    });
  } catch (error) {
    console.error('❌ getOnlineProviders error:', error);
    res.status(500).json({ success: false, error: error.message, stack: error.stack });
  }
}

// ============================================================
// GET DISPATCHABLE BOOKINGS
// ============================================================

async function getDispatchableBookings(req, res) {
  try {
    var maps = await Promise.all([
      loadCategoriesMap(), loadCitiesMap(), loadServicesMap(), loadUsersMap()
    ]);
    var categoriesMap = maps[0];
    var citiesMap = maps[1];
    var servicesMap = maps[2];
    var usersMap = maps[3];

    var allBookings = [];

    try {
      var conn1 = getConnection('user_db');
      var docs1 = await conn1.collection('bookings').find({}).sort({ _id: -1 }).limit(500).toArray();
      console.log('   ✓ Found ' + docs1.length + ' in user_db.bookings');
      for (var i = 0; i < docs1.length; i++) {
        docs1[i]._source = 'user_db';
        allBookings.push(docs1[i]);
      }
    } catch (e) {}

    try {
      var conn2 = getConnection('bookings_db');
      var docs2 = await conn2.collection('bookings').find({}).sort({ _id: -1 }).limit(500).toArray();
      console.log('   ✓ Found ' + docs2.length + ' in bookings_db.bookings');
      for (var j = 0; j < docs2.length; j++) {
        var exists = allBookings.find(function(b) { return String(b._id) === String(docs2[j]._id); });
        if (!exists) {
          docs2[j]._source = 'bookings_db';
          allBookings.push(docs2[j]);
        }
      }
    } catch (e) {}

    var enriched = allBookings.map(function(b) {
      var customerName = 'Customer';
      var customerPhone = '';
      var customerEmail = '';

      var userId = b.userId || b.customerId || b.user || b.customer;
      if (userId) {
        var uid = typeof userId === 'object' ? String(userId._id || userId) : String(userId);
        var userInfo = usersMap[uid];
        if (userInfo) {
          customerName = userInfo.name || 'Customer';
          customerPhone = userInfo.phone || '';
          customerEmail = userInfo.email || '';
        }
      }
      if (b.customerName) customerName = safeStr(b.customerName);
      if (b.userName) customerName = safeStr(b.userName);
      if (b.customer && typeof b.customer === 'object' && b.customer.name) customerName = safeStr(b.customer.name);
      if (b.customerPhone || b.customerMobile) customerPhone = safeStr(b.customerPhone || b.customerMobile);

      var serviceName = '';
      var serviceIcon = '';
      var servicePrice = 0;
      var categoryName = '';

      var serviceId = b.serviceId || b.service || b.serviceType;
      if (serviceId) {
        var sid = typeof serviceId === 'object' ? String(serviceId._id || serviceId) : String(serviceId);
        var svcInfo = servicesMap[sid];
        if (svcInfo) {
          serviceName = svcInfo.name || '';
          serviceIcon = svcInfo.icon || '';
          servicePrice = svcInfo.price || 0;
          if (svcInfo.category) {
            var catId = typeof svcInfo.category === 'object' ? String(svcInfo.category._id || svcInfo.category) : String(svcInfo.category);
            categoryName = categoriesMap[catId] || '';
          }
        }
      }
      if (b.serviceName) serviceName = safeStr(b.serviceName);
      if (b.service && typeof b.service === 'object' && b.service.name) serviceName = safeStr(b.service.name);

      if (!categoryName) {
        var catField = b.category || b.categoryId || b.serviceCategory;
        if (catField) {
          var cfId = typeof catField === 'object' ? String(catField._id || catField) : String(catField);
          categoryName = categoriesMap[cfId] || safeStr(catField);
        }
      }

      var address = formatAddress(b);

      var cityName = '';
      var cityField = b.city || b.cityId || b.serviceCity ||
                      (b.address && typeof b.address === 'object' && (b.address.city || b.address.cityName));
      if (cityField) {
        if (typeof cityField === 'object' && cityField.cityName) {
          cityName = cityField.cityName;
        } else {
          var ciId = typeof cityField === 'object' ? String(cityField._id || cityField) : String(cityField);
          cityName = citiesMap[ciId] || safeStr(cityField);
        }
      }

      var totalAmount = safeNum(b.totalAmount || b.amount || b.total || b.price || b.finalAmount || b.servicePrice || servicePrice);
      var baseAmount = safeNum(b.baseAmount || b.basePrice || b.subtotal || totalAmount);
      var status = safeStr(b.status || b.bookingStatus || 'unknown');

      var assignedProviderName = '';
      var assignedProviderId = '';
      var provField = b.providerId || b.provider || b.assignedProvider || b.acceptedProvider;
      if (provField) {
        assignedProviderId = typeof provField === 'object' ? String(provField._id || provField) : String(provField);
        if (typeof provField === 'object' && (provField.name || provField.fullName)) {
          assignedProviderName = safeStr(provField.name || provField.fullName);
        }
      }

      var scheduledDate = b.scheduledDate || b.date || b.bookingDate || b.serviceDate || '';
      var scheduledTime = b.scheduledTime || b.time || b.bookingTime || b.serviceTime || b.timeSlot || '';

      return {
        _id: String(b._id),
        bookingId: String(b.bookingId || b._id),
        customerName: customerName,
        customerPhone: customerPhone,
        customerEmail: customerEmail,
        serviceName: serviceName || 'Service',
        serviceIcon: serviceIcon,
        servicePrice: servicePrice,
        categoryName: categoryName || '',
        address: address,
        city: cityName,
        totalAmount: totalAmount,
        baseAmount: baseAmount,
        status: status,
        assignedProviderId: assignedProviderId,
        assignedProviderName: assignedProviderName,
        scheduledDate: scheduledDate ? String(scheduledDate) : '',
        scheduledTime: scheduledTime ? String(scheduledTime) : '',
        createdAt: b.createdAt || b._id.getTimestamp(),
        timeAgo: timeAgo(b.createdAt || b._id.getTimestamp()),
        updatedAt: b.updatedAt || '',
        updatedAgo: timeAgo(b.updatedAt || ''),
        paymentMethod: safeStr(b.paymentMethod || b.paymentMode || b.paymentType || ''),
        paymentStatus: safeStr(b.paymentStatus || ''),
        otp: safeStr(b.otp || b.verificationCode || ''),
        _source: b._source || 'unknown'
      };
    });

    enriched.sort(function(a, b) {
      return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
    });

    var limited = enriched.slice(0, 300);
    console.log('📊 Returned ' + limited.length + ' bookings (enriched, recent-first)');

    res.json({
      success: true,
      data: {
        bookings: limited,
        total: limited.length,
        stats: {
          total: enriched.length,
          active: enriched.filter(function(b) {
            return ['searching', 'pending', 'confirmed', 'active', 'in_progress', 'accepted'].includes(b.status);
          }).length,
          unassigned: enriched.filter(function(b) { return !b.assignedProviderId; }).length,
          completed: enriched.filter(function(b) { return b.status === 'completed'; }).length,
          cancelled: enriched.filter(function(b) { return b.status === 'cancelled'; }).length
        }
      }
    });
  } catch (error) {
    console.error('❌ getDispatchableBookings error:', error);
    res.status(500).json({ success: false, error: error.message, stack: error.stack });
  }
}

// ============================================================
// SEND MANUAL DISPATCH — THE MAIN FUNCTION
// ============================================================

async function send(req, res) {
  try {
    var bookingId = req.body.bookingId;
    var providerId = req.body.providerId;
    var adminNote = req.body.adminNote || '';

    if (!bookingId || !providerId) {
      return res.status(400).json({ success: false, error: 'bookingId and providerId are required' });
    }

    console.log('🚀 [DISPATCH] booking=' + bookingId + ' → provider=' + providerId);

    // 1. Find booking
    var bookingOid = toObjectId(bookingId);
    var bookingResult = null;

    if (bookingOid) {
      bookingResult = await findOneInAllDbs('bookings', { _id: bookingOid });
    }
    if (!bookingResult || !bookingResult.doc) {
      bookingResult = await findOneInAllDbs('bookings', { bookingId: bookingId });
    }
    if (!bookingResult || !bookingResult.doc) {
      return res.status(404).json({ success: false, error: 'Booking ' + bookingId + ' not found in any database' });
    }

    var booking = bookingResult.doc;
    var bookingCollection = bookingResult.collection;
    console.log('📋 Booking found in ' + bookingResult.dbName + ': status=' + booking.status);

    // 2. Find provider
    var providerOid = toObjectId(providerId);
    var providerResult = null;

    if (providerOid) {
      providerResult = await findOneInAllDbs('providers', { _id: providerOid });
    }
    if (!providerResult || !providerResult.doc) {
      return res.status(404).json({ success: false, error: 'Provider ' + providerId + ' not found' });
    }

    var provider = providerResult.doc;
    console.log('👤 Provider: ' + (provider.name || provider.fullName || 'Unknown'));

    // 3. Get FCM token
    var fcmToken = provider.fcmToken || provider.fcm_token || provider.deviceToken || provider.pushToken ||
                   (provider.deviceInfo && (provider.deviceInfo.fcmToken || provider.deviceInfo.token)) || '';

    if (!fcmToken) {
      return res.status(400).json({
        success: false,
        error: 'Provider ' + (provider.name || providerId) + ' has no FCM token.'
      });
    }
    console.log('📱 FCM Token: ' + fcmToken.substring(0, 20) + '...');

    // 4. Cancel existing offers
    console.log('🔄 Cancelling existing offers for booking ' + bookingId + '...');
    var cancelledOffers = await updateInAllDbs('provideroffers',
      {
        $or: [
          { bookingId: bookingId },
          { bookingId: bookingOid },
          { booking: bookingId },
          { booking: bookingOid }
        ],
        status: { $in: ['pending', 'sent', 'waiting', 'active', 'dispatched'] }
      },
      {
        $set: {
          status: 'cancelled',
          cancelledAt: new Date(),
          cancelReason: 'admin_manual_redispatch',
          adminNote: adminNote || 'Re-dispatched by admin'
        }
      }
    );
    console.log('   ❌ Cancelled ' + cancelledOffers + ' existing offers');

    // 5. Reset booking status
    try {
      await bookingCollection.updateOne(
        { _id: booking._id },
        {
          $set: {
            status: 'searching',
            updatedAt: new Date(),
            adminRedispatched: true,
            adminRedispatchedAt: new Date(),
            previousProvider: booking.providerId || booking.provider || null,
            providerId: null,
            provider: null,
            assignedProvider: null,
            acceptedProvider: null
          }
        }
      );
      console.log('   🔄 Booking status reset to searching');
    } catch (e) {
      console.log('   ⚠️ Could not reset booking status: ' + e.message);
    }

    // 6. Enrich data for FCM
    var maps = await Promise.all([
      loadCategoriesMap(), loadCitiesMap(), loadServicesMap(), loadUsersMap()
    ]);
    var categoriesMap = maps[0];
    var citiesMap = maps[1];
    var servicesMap = maps[2];
    var usersMap = maps[3];

    var customerName = 'Customer';
    var userId = booking.userId || booking.customerId || booking.user || booking.customer;
    if (userId) {
      var uid = typeof userId === 'object' ? String(userId._id || userId) : String(userId);
      var userInfo = usersMap[uid];
      if (userInfo) customerName = userInfo.name || 'Customer';
    }
    if (booking.customerName) customerName = safeStr(booking.customerName);

    var serviceName = 'Service';
    var serviceIcon = '';
    var servicePrice = 0;
    var categoryName = '';
    var serviceId = booking.serviceId || booking.service || booking.serviceType;
    if (serviceId) {
      var sid = typeof serviceId === 'object' ? String(serviceId._id || serviceId) : String(serviceId);
      var svcInfo = servicesMap[sid];
      if (svcInfo) {
        serviceName = svcInfo.name || 'Service';
        serviceIcon = svcInfo.icon || '';
        servicePrice = svcInfo.price || 0;
        if (svcInfo.category) {
          var catId = typeof svcInfo.category === 'object' ? String(svcInfo.category._id || svcInfo.category) : String(svcInfo.category);
          categoryName = categoriesMap[catId] || '';
        }
      }
    }
    if (booking.serviceName) serviceName = safeStr(booking.serviceName);

    if (!categoryName) {
      var catField = booking.category || booking.categoryId;
      if (catField) {
        var cfId = typeof catField === 'object' ? String(catField._id || catField) : String(catField);
        categoryName = categoriesMap[cfId] || safeStr(catField);
      }
    }

    var address = formatAddress(booking);
    var totalAmount = safeNum(booking.totalAmount || booking.amount || booking.total || booking.price || servicePrice);
    var baseAmount = safeNum(booking.baseAmount || booking.basePrice || totalAmount);
    var scheduledDate = booking.scheduledDate || booking.date || booking.bookingDate || '';
    var scheduledTime = booking.scheduledTime || booking.time || booking.bookingTime || booking.timeSlot || '';

    var cityName = '';
    var cityField = booking.city || booking.cityId ||
                    (booking.address && typeof booking.address === 'object' && (booking.address.city || booking.address.cityName));
    if (cityField) {
      var ciId = typeof cityField === 'object' ? String(cityField._id || cityField) : String(cityField);
      cityName = citiesMap[ciId] || safeStr(cityField);
    }

    // 7. Create ProviderOffer
    var offerId = new mongoose.Types.ObjectId();
    var now = new Date();
    var expiresAt = new Date(now.getTime() + 30000);

    var offerDoc = {
      _id: offerId,
      bookingId: bookingOid || bookingId,
      providerId: providerOid || providerId,
      status: 'pending',
      source: 'manual_admin',
      adminNote: adminNote,
      createdAt: now,
      updatedAt: now,
      expiresAt: expiresAt,
      sentAt: now,
      fcmSent: false,
      fcmError: null,
      timeout: 30
    };

    var offerInserted = false;
    var dbOptions = ['bookings_db', 'admin_panel'];
    for (var di = 0; di < dbOptions.length; di++) {
      try {
        await insertInDb(dbOptions[di], 'provideroffers', offerDoc);
        console.log('   ✅ ProviderOffer created in ' + dbOptions[di] + ': ' + offerId);
        offerInserted = true;
        break;
      } catch (e) {
        console.log('   ⚠️ Failed to insert offer in ' + dbOptions[di] + ': ' + e.message);
      }
    }

    // 8. Create DispatchJob
    var dispatchJobId = new mongoose.Types.ObjectId();
    var statusOptions = ['pending', 'active', 'dispatched', 'searching', 'sent', 'waiting'];
    var dispatchInserted = false;

    for (var si = 0; si < statusOptions.length; si++) {
      var dispatchDoc = {
        _id: dispatchJobId,
        bookingId: bookingOid || bookingId,
        providerId: providerOid || providerId,
        offerId: offerId,
        status: statusOptions[si],
        source: 'manual_admin',
        adminNote: adminNote,
        createdAt: now,
        updatedAt: now,
        expiresAt: expiresAt,
        attempts: 1,
        maxAttempts: 1,
        currentProviderIndex: 0,
        timeout: 30
      };

      for (var dj = 0; dj < dbOptions.length; dj++) {
        try {
          await insertInDb(dbOptions[dj], 'dispatchjobs', dispatchDoc);
          console.log('   ✅ DispatchJob created in ' + dbOptions[dj] + ': ' + dispatchJobId + ' (status: ' + statusOptions[si] + ')');
          dispatchInserted = true;
          break;
        } catch (e) {
          continue;
        }
      }
      if (dispatchInserted) break;
    }

    // 9. SEND HYBRID ALARM FCM — THE CRITICAL PART
    var title = '🔔 New Booking! ₹' + totalAmount;
    var body = serviceName + ' • ₹' + totalAmount + ' • ' + (scheduledTime || 'ASAP') + '\n📍 ' + (address || cityName || 'Service Location');

    var fcmMessage = {
      token: fcmToken,
      notification: {
        title: title,
        body: body
      },
      data: stringifyAll({
        type: 'booking_request',
        bookingId: String(bookingOid || bookingId),
        bookingObjectId: String(bookingOid || bookingId),
        offerId: String(offerId),
        actionUrl: '/booking-detail?bookingId=' + (bookingOid || bookingId),
        serviceName: serviceName,
        serviceIcon: serviceIcon,
        categoryName: categoryName,
        customerName: customerName,
        totalAmount: totalAmount,
        baseAmount: baseAmount,
        servicePrice: servicePrice,
        priceDisplay: '₹' + totalAmount,
        scheduledTime: scheduledTime ? String(scheduledTime) : '',
        scheduledDate: scheduledDate ? String(scheduledDate) : '',
        address: address,
        city: cityName,
        priority: 'high',
        channelId: 'bookings_alarm',
        category: 'booking_request',
        clickAction: 'OPEN_BOOKING',
        timeout: 30,
        expiresAt: expiresAt.toISOString(),
        isExclusive: 'true',
        source: 'manual_admin',
        _isBookingAlarm: 'true',
        _source: 'fcm',
        _sentAt: Date.now(),
        sound: 'booking_alarm',
        title: title,
        body: body
      }),
      android: {
        priority: 'high',
        ttl: 120000,
        collapseKey: 'booking_' + (bookingOid || bookingId),
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
            alert: { title: title, body: body }
          }
        }
      }
    };

    console.log('📤 Sending HYBRID ALARM FCM...');
    console.log('   Token: ' + fcmToken.substring(0, 30) + '...');
    console.log('   Title: ' + title);

    var fcmResult = null;
    var fcmError = null;

    try {
      // THIS IS THE FIX — getProviderFirebaseApp now returns { app, messaging }
      // where messaging is obtained via getMessaging(app) NOT app.messaging()
      var firebase = getProviderFirebaseApp();
      var messaging = firebase.messaging;

      if (!messaging || typeof messaging.send !== 'function') {
        throw new Error('Firebase messaging object is invalid. messaging=' + typeof messaging + ', send=' + typeof (messaging && messaging.send));
      }

      console.log('   ✅ messaging.send is a function, sending now...');
      fcmResult = await messaging.send(fcmMessage);
      console.log('✅ FCM SENT! messageId: ' + fcmResult);

      try {
        await updateInAllDbs('provideroffers',
          { _id: offerId },
          { $set: { fcmSent: true, fcmMessageId: fcmResult, fcmSentAt: new Date() } }
        );
      } catch (e) {}

    } catch (err) {
      fcmError = err.message || String(err);
      console.error('❌ FCM FAILED: ' + fcmError);

      if (fcmError.includes('not-found') || fcmError.includes('UNREGISTERED') || fcmError.includes('invalid-registration-token')) {
        console.log('   ⚠️ FCM token is invalid/expired.');
      }

      try {
        await updateInAllDbs('provideroffers',
          { _id: offerId },
          { $set: { fcmSent: false, fcmError: fcmError, fcmFailedAt: new Date() } }
        );
      } catch (e) {}
    }

    // 10. Socket emit
    try {
      var io = req.app.get('io');
      if (io) {
        io.to('admins').emit('manual-dispatch:sent', {
          bookingId: String(bookingOid || bookingId),
          providerId: String(providerOid || providerId),
          providerName: safeStr(provider.name || provider.fullName || 'Provider'),
          offerId: String(offerId),
          fcmSent: !!fcmResult,
          fcmError: fcmError,
          timestamp: now.toISOString()
        });
        io.to('admins').emit('dispatch:update', {
          type: 'manual_dispatch',
          bookingId: String(bookingOid || bookingId),
          providerId: String(providerOid || providerId),
          status: fcmResult ? 'sent' : 'fcm_failed'
        });
        console.log('📡 Socket events emitted to admins room');
      }
    } catch (e) {
      console.log('   ⚠️ Socket emit failed: ' + e.message);
    }

    // 11. Response
    res.json({
      success: !!fcmResult,
      data: {
        offerId: String(offerId),
        dispatchJobId: String(dispatchJobId),
        bookingId: String(bookingOid || bookingId),
        providerId: String(providerOid || providerId),
        providerName: safeStr(provider.name || provider.fullName || 'Provider'),
        customerName: customerName,
        serviceName: serviceName,
        totalAmount: totalAmount,
        address: address,
        fcmSent: !!fcmResult,
        fcmMessageId: fcmResult || null,
        fcmError: fcmError,
        expiresAt: expiresAt.toISOString(),
        timeout: 30,
        cancelledPreviousOffers: cancelledOffers,
        offerInserted: offerInserted,
        dispatchInserted: dispatchInserted,
        message: fcmResult
          ? '✅ Dispatch sent! Provider will get Accept/Reject popup. Expires in 30s.'
          : '❌ FCM failed: ' + fcmError + '. Offer created but notification not delivered.'
      }
    });

    console.log('🏁 [DISPATCH COMPLETE] success=' + !!fcmResult);

  } catch (error) {
    console.error('❌ send error:', error);
    res.status(500).json({ success: false, error: error.message, stack: error.stack });
  }
}

// ============================================================
// GET OFFER STATUS
// ============================================================

async function getOfferStatus(req, res) {
  try {
    var offerId = req.params.offerId;
    if (!offerId) {
      return res.status(400).json({ success: false, error: 'offerId required' });
    }

    var oid = toObjectId(offerId);
    var result = null;

    if (oid) {
      result = await findOneInAllDbs('provideroffers', { _id: oid });
    }
    if (!result || !result.doc) {
      result = await findOneInAllDbs('provideroffers', { offerId: offerId });
    }
    if (!result || !result.doc) {
      return res.status(404).json({ success: false, error: 'Offer ' + offerId + ' not found' });
    }

    var offer = result.doc;
    var expired = false;
    if (offer.expiresAt && new Date(offer.expiresAt) < new Date()) {
      expired = true;
      if (offer.status === 'pending' || offer.status === 'sent' || offer.status === 'waiting') {
        try {
          await result.collection.updateOne(
            { _id: offer._id },
            { $set: { status: 'expired', expiredAt: new Date() } }
          );
          offer.status = 'expired';
        } catch (e) {}
      }
    }

    res.json({
      success: true,
      data: {
        offerId: String(offer._id),
        bookingId: String(offer.bookingId || ''),
        providerId: String(offer.providerId || ''),
        status: offer.status,
        expired: expired,
        fcmSent: offer.fcmSent || false,
        fcmError: offer.fcmError || null,
        createdAt: offer.createdAt,
        expiresAt: offer.expiresAt,
        respondedAt: offer.respondedAt || offer.acceptedAt || offer.rejectedAt || null,
        timeAgo: timeAgo(offer.createdAt),
        dbSource: result.dbName
      }
    });
  } catch (error) {
    console.error('❌ getOfferStatus error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

// ============================================================
// DEBUG
// ============================================================

async function debug(req, res) {
  try {
    var maps = await Promise.all([
      loadCategoriesMap(), loadCitiesMap(), loadServicesMap(), loadUsersMap()
    ]);

    var firebaseStatus = 'not tested';
    try {
      var fb = getProviderFirebaseApp();
      firebaseStatus = fb.messaging && typeof fb.messaging.send === 'function'
        ? 'messaging ready ✅'
        : 'messaging INVALID ❌ (type: ' + typeof fb.messaging + ')';
    } catch (e) {
      firebaseStatus = 'error: ' + e.message;
    }

    var provResult = await findInAllDbs('providers', {}, { limit: 2 });
    var sampleProviders = provResult.docs.map(function(p) {
      var catField = p.category || p.categoryId || p.categories;
      var catResolved = '';
      if (catField) {
        if (Array.isArray(catField)) {
          catResolved = catField.map(function(c) {
            var id = typeof c === 'object' ? String(c._id || c) : String(c);
            return maps[0][id] || '[unmapped:' + id + ']';
          }).join(', ');
        } else {
          var id = typeof catField === 'object' ? String(catField._id || catField) : String(catField);
          catResolved = maps[0][id] || '[unmapped:' + id + ']';
        }
      }
      var cityField = p.city || p.cityId;
      var cityResolved = '';
      if (cityField) {
        var cid = typeof cityField === 'object' ? String(cityField._id || cityField) : String(cityField);
        cityResolved = maps[1][cid] || '[unmapped:' + cid + ']';
      }
      return {
        _id: String(p._id),
        name: p.name,
        categoryRaw: catField,
        categoryResolved: catResolved,
        cityRaw: cityField,
        cityResolved: cityResolved,
        fcmToken: p.fcmToken ? String(p.fcmToken).substring(0, 20) + '...' : 'NONE'
      };
    });

    res.json({
      success: true,
      data: {
        categoriesLoaded: Object.keys(maps[0]).length,
        citiesLoaded: Object.keys(maps[1]).length,
        servicesLoaded: Object.keys(maps[2]).length,
        usersLoaded: Object.keys(maps[3]).length,
        firebaseStatus: firebaseStatus,
        sampleCategories: Object.entries(maps[0]).slice(0, 5).map(function(e) { return { id: e[0], name: e[1] }; }),
        sampleCities: Object.entries(maps[1]).slice(0, 5).map(function(e) { return { id: e[0], name: e[1] }; }),
        sampleProviders: sampleProviders,
        envVars: {
          PROVIDER_FIREBASE_BASE64: process.env.PROVIDER_FIREBASE_SERVICE_ACCOUNT_BASE64 ? 'SET' : 'NOT SET',
          ADMIN_SECRET: process.env.ADMIN_SECRET_KEY ? 'SET' : 'NOT SET'
        }
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message, stack: error.stack });
  }
}

async function debugConnections(req, res) {
  try {
    var results = {};
    var dbs = ['admin_panel', 'provider_db', 'user_db', 'bookings_db'];
    var collections = ['providers', 'bookings', 'categories', 'cities', 'services', 'users', 'provideroffers', 'dispatchjobs'];

    for (var i = 0; i < dbs.length; i++) {
      results[dbs[i]] = {};
      for (var j = 0; j < collections.length; j++) {
        try {
          var conn = getConnection(dbs[i]);
          var count = await conn.collection(collections[j]).countDocuments();
          if (count > 0) results[dbs[i]][collections[j]] = count;
        } catch (e) {}
      }
    }
    res.json({ success: true, data: results });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

function _health(req, res) {
  res.json({
    success: true,
    message: 'Manual Dispatch controller healthy',
    timestamp: new Date().toISOString(),
    exports: Object.keys(module.exports)
  });
}

// ============================================================
// EXPORTS
// ============================================================

module.exports = {
  getOnlineProviders: getOnlineProviders,
  getDispatchableBookings: getDispatchableBookings,
  send: send,
  sendManualDispatch: send,
  dispatch: send,
  getOfferStatus: getOfferStatus,
  debug: debug,
  debugConnections: debugConnections,
  _health: _health
};