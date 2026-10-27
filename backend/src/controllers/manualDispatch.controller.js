// backend/src/controllers/manualDispatch.controller.js
// COMPLETE MANUAL DISPATCH CONTROLLER — FINAL VERSION
// Fix: Use mongoose.connections[] array (named connections) instead of mongoose.connection (default)

const mongoose = require('mongoose');
const path = require('path');

// ============================================================
// UTILITY HELPERS
// ============================================================

function stringifyAll(obj) {
  var result = {};
  for (var key in obj) {
    if (!obj.hasOwnProperty(key)) continue;
    var value = obj[key];
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
  var n = Number(val);
  return isNaN(n) ? 0 : n;
}

function toObjectId(id) {
  try {
    if (!id) return null;
    var str = typeof id === 'object' && id._id ? String(id._id) : String(id);
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
  var now = new Date();
  var d = new Date(date);
  var diffMs = now - d;
  var diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return diffMins + 'm ago';
  var diffHrs = Math.floor(diffMins / 60);
  if (diffHrs < 24) return diffHrs + 'h ago';
  var diffDays = Math.floor(diffHrs / 24);
  return diffDays + 'd ago';
}

// ============================================================
// FIREBASE — v12 safe messaging
// ============================================================

let _providerApp = null;
let _providerMessaging = null;

function _getMessagingFromApp(admin, app) {
  try {
    var m1 = admin.messaging(app);
    if (m1 && typeof m1.send === 'function') {
      console.log('✅ Messaging via admin.messaging(app)');
      return m1;
    }
  } catch (e) {
    console.log('⚠️ admin.messaging(app) failed: ' + e.message);
  }
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
    console.log('⚠️ getMessaging(app) failed: ' + e.message);
  }
  try {
    var getMessaging2 = require('firebase-admin/messaging').getMessaging;
    if (typeof getMessaging2 === 'function') {
      var m3 = getMessaging2();
      if (m3 && typeof m3.send === 'function') {
        console.log('✅ Messaging via getMessaging() default');
        return m3;
      }
    }
  } catch (e) {}
  try {
    var m4 = admin.messaging();
    if (m4 && typeof m4.send === 'function') {
      console.log('✅ Messaging via admin.messaging() default');
      return m4;
    }
  } catch (e) {}
  console.error('❌ ALL messaging methods failed!');
  return null;
}

function getProviderFirebaseApp() {
  if (_providerApp && _providerMessaging) {
    return { app: _providerApp, messaging: _providerMessaging };
  }

  var admin = require('firebase-admin');

  // Try to find any existing initialized Firebase app for provider project
  var existingApps = admin.apps || [];
  for (var i = 0; i < existingApps.length; i++) {
    var app = existingApps[i];
    if (!app) continue;
    try {
      var opts = app.options || {};
      if (opts.projectId === 'serviceproviderapp-b7767' ||
          app.name === 'manualDispatchProvider' ||
          app.name === 'provider' ||
          app.name === 'providerApp') {
        _providerApp = app;
        _providerMessaging = _getMessagingFromApp(admin, app);
        if (_providerMessaging) {
          console.log('♻️ Reusing existing Firebase app "' + app.name + '" (project: ' + opts.projectId + ')');
          return { app: _providerApp, messaging: _providerMessaging };
        }
      }
    } catch (e) {}
  }

  // Load service account
  var serviceAccount = null;
  var base64 = process.env.PROVIDER_FIREBASE_SERVICE_ACCOUNT_BASE64;

  if (base64) {
    try {
      var json = Buffer.from(base64, 'base64').toString('utf8');
      serviceAccount = JSON.parse(json);
      console.log('🔑 Provider service account loaded from BASE64, project: ' + serviceAccount.project_id);
    } catch (e) {
      console.error('❌ Failed to parse PROVIDER_FIREBASE_SERVICE_ACCOUNT_BASE64: ' + e.message);
    }
  }

  if (!serviceAccount) {
    var filePaths = [
      path.join(__dirname, '..', 'config', 'serviceproviderapp-b7767-firebase-adminsdk.json'),
      path.join(__dirname, '..', 'config', 'serviceAccountKey.json'),
      process.env.PROVIDER_FIREBASE_SERVICE_ACCOUNT_PATH
    ].filter(Boolean);

    for (var fi = 0; fi < filePaths.length; fi++) {
      try {
        serviceAccount = require(filePaths[fi]);
        console.log('🔑 Service account loaded from file: ' + filePaths[fi]);
        break;
      } catch (e) {}
    }
  }

  if (!serviceAccount) {
    throw new Error('No provider Firebase service account found.');
  }

  var credential = null;
  try {
    credential = admin.credential.cert(serviceAccount);
  } catch (e1) {
    try {
      var certFn = require('firebase-admin/app').cert;
      credential = certFn(serviceAccount);
    } catch (e2) {
      throw new Error('Cannot create Firebase credential: ' + e1.message + ' / ' + e2.message);
    }
  }

  _providerApp = admin.initializeApp({
    credential: credential,
    projectId: serviceAccount.project_id
  }, 'manualDispatchProvider');

  console.log('✅ Provider Firebase app initialized (manualDispatchProvider)');
  _providerMessaging = _getMessagingFromApp(admin, _providerApp);

  if (!_providerMessaging) {
    throw new Error('Firebase app initialized but could not get Messaging instance');
  }

  console.log('✅ Provider Firebase Messaging ready');
  return { app: _providerApp, messaging: _providerMessaging };
}

// ============================================================
// DATABASE — CRITICAL FIX
// Scan mongoose.connections[] array (named connections)
// NOT mongoose.connection (default/global) which is empty in this project
// ============================================================

function getAllConnections() {
  var result = [];
  try {
    var conns = mongoose.connections || [];
    for (var i = 0; i < conns.length; i++) {
      var c = conns[i];
      if (!c) continue;
      // readyState: 0=disconnected, 1=connected, 2=connecting, 3=disconnecting
      if (c.readyState === 1) {
        var dbName = c.name || (c.db && c.db.databaseName) || 'unknown_' + i;
        result.push({ conn: c, name: dbName });
      }
    }
  } catch (e) {
    console.error('❌ getAllConnections error: ' + e.message);
  }
  return result;
}

function getConnectionByName(targetName) {
  var all = getAllConnections();
  // Direct match first
  for (var i = 0; i < all.length; i++) {
    if (all[i].name === targetName) return all[i].conn;
  }
  // Case-insensitive match
  var lower = targetName.toLowerCase();
  for (var j = 0; j < all.length; j++) {
    if (all[j].name.toLowerCase() === lower) return all[j].conn;
  }
  // Partial match
  for (var k = 0; k < all.length; k++) {
    if (all[k].name.toLowerCase().indexOf(lower) !== -1 ||
        lower.indexOf(all[k].name.toLowerCase()) !== -1) {
      return all[k].conn;
    }
  }
  return null;
}

// Scan ALL connected databases for a collection — aggregated
async function findInAllDbsAggregated(collectionName, query, options) {
  query = query || {};
  options = options || {};
  var limit = options.limit || 1000;
  var sort = options.sort || { _id: -1 };

  var all = getAllConnections();
  if (all.length === 0) {
    console.log('   ❌ NO connected databases found! mongoose.connections.length=' + (mongoose.connections || []).length);
    return [];
  }

  console.log('   🔎 Scanning ' + all.length + ' DBs for "' + collectionName + '": [' + all.map(function(a) { return a.name; }).join(', ') + ']');

  var allDocs = [];
  var seenIds = {};

  for (var i = 0; i < all.length; i++) {
    var dbName = all[i].name;
    var conn = all[i].conn;
    try {
      var collection = conn.collection(collectionName);
      var count = await collection.countDocuments(query);
      if (count > 0) {
        var docs = await collection.find(query).sort(sort).limit(limit).toArray();
        console.log('   ✓ Found ' + docs.length + ' in ' + dbName + '.' + collectionName);
        for (var j = 0; j < docs.length; j++) {
          var idStr = String(docs[j]._id);
          if (!seenIds[idStr]) {
            seenIds[idStr] = true;
            docs[j]._sourceDb = dbName;
            allDocs.push(docs[j]);
          }
        }
      }
    } catch (e) {
      // Collection doesn't exist in this DB — silent skip
    }
  }
  return allDocs;
}

async function findOneInAllDbs(collectionName, query) {
  query = query || {};
  var all = getAllConnections();
  for (var i = 0; i < all.length; i++) {
    try {
      var collection = all[i].conn.collection(collectionName);
      var doc = await collection.findOne(query);
      if (doc) {
        return { doc: doc, dbName: all[i].name, collection: collection };
      }
    } catch (e) {}
  }
  return { doc: null, dbName: null, collection: null };
}

async function insertInAnyDb(collectionName, doc, preferredDbNames) {
  preferredDbNames = preferredDbNames || [];
  var all = getAllConnections();

  // Try preferred DBs first
  for (var pi = 0; pi < preferredDbNames.length; pi++) {
    var pref = preferredDbNames[pi];
    var conn = getConnectionByName(pref);
    if (conn) {
      try {
        var collection = conn.collection(collectionName);
        await collection.insertOne(doc);
        return { success: true, dbName: pref };
      } catch (e) {
        console.log('   ⚠️ Insert failed in preferred ' + pref + ': ' + e.message);
      }
    }
  }

  // Fallback: try any connected DB
  for (var i = 0; i < all.length; i++) {
    try {
      var col = all[i].conn.collection(collectionName);
      await col.insertOne(doc);
      return { success: true, dbName: all[i].name };
    } catch (e) {}
  }
  return { success: false, dbName: null };
}

async function updateInAllDbs(collectionName, query, update) {
  var all = getAllConnections();
  var total = 0;
  for (var i = 0; i < all.length; i++) {
    try {
      var collection = all[i].conn.collection(collectionName);
      var result = await collection.updateMany(query, update);
      total += result.modifiedCount || 0;
    } catch (e) {}
  }
  return total;
}

// ============================================================
// LOOKUP MAPS
// ============================================================

async function loadCategoriesMap() {
  var map = {};
  var all = getAllConnections();
  for (var i = 0; i < all.length; i++) {
    try {
      var docs = await all[i].conn.collection('categories').find({}).toArray();
      if (docs.length > 0) {
        console.log('   ✓ Found ' + docs.length + ' in ' + all[i].name + '.categories');
        for (var j = 0; j < docs.length; j++) {
          var id = String(docs[j]._id);
          if (!map[id]) {
            map[id] = safeStr(docs[j].name || docs[j].categoryName || docs[j].title || docs[j]);
          }
        }
      }
    } catch (e) {}
  }
  return map;
}

async function loadCitiesMap() {
  var map = {};
  var all = getAllConnections();
  for (var i = 0; i < all.length; i++) {
    try {
      var docs = await all[i].conn.collection('cities').find({}).toArray();
      if (docs.length > 0) {
        console.log('   ✓ Found ' + docs.length + ' in ' + all[i].name + '.cities');
        for (var j = 0; j < docs.length; j++) {
          var id = String(docs[j]._id);
          if (!map[id]) {
            map[id] = safeStr(docs[j].cityName || docs[j].name || docs[j].title || docs[j]);
          }
        }
      }
    } catch (e) {}
  }
  return map;
}

async function loadServicesMap() {
  var map = {};
  var all = getAllConnections();
  for (var i = 0; i < all.length; i++) {
    try {
      var docs = await all[i].conn.collection('services').find({}).toArray();
      if (docs.length > 0) {
        console.log('   ✓ Found ' + docs.length + ' in ' + all[i].name + '.services');
        for (var j = 0; j < docs.length; j++) {
          var id = String(docs[j]._id);
          if (!map[id]) {
            map[id] = {
              name: safeStr(docs[j].name || docs[j].serviceName || docs[j].title || docs[j]),
              icon: safeStr(docs[j].icon || docs[j].image || docs[j].imageUrl || ''),
              category: docs[j].category || docs[j].categoryId || null,
              price: safeNum(docs[j].price || docs[j].basePrice || docs[j].amount || 0)
            };
          }
        }
      }
    } catch (e) {}
  }
  return map;
}

async function loadUsersMap() {
  var map = {};
  var all = getAllConnections();
  for (var i = 0; i < all.length; i++) {
    try {
      var docs = await all[i].conn.collection('users').find({}).toArray();
      if (docs.length > 0) {
        console.log('   ✓ Found ' + docs.length + ' in ' + all[i].name + '.users');
        for (var j = 0; j < docs.length; j++) {
          var id = String(docs[j]._id);
          if (!map[id]) {
            map[id] = {
              name: safeStr(docs[j].name || docs[j].fullName || docs[j].firstName || docs[j].displayName || 'Customer'),
              phone: safeStr(docs[j].phone || docs[j].phoneNumber || docs[j].mobile || ''),
              email: safeStr(docs[j].email || '')
            };
          }
        }
      }
    } catch (e) {}
  }
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

    var providers = await findInAllDbsAggregated('providers', query, { limit: 500, sort: { _id: -1 } });

    if (providers.length === 0 && !includeAll) {
      console.log('⚠️ No providers with filter — retrying with empty query');
      providers = await findInAllDbsAggregated('providers', {}, { limit: 500, sort: { _id: -1 } });
    }

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
          var cid = typeof catField === 'object' ? String(catField._id || catField.categoryId || catField) : String(catField);
          categoryName = categoriesMap[cid] || safeStr(catField);
        }
      }

      var cityName = '';
      var cityField = p.city || p.cityId || p.serviceCity;
      if (cityField) {
        if (typeof cityField === 'object' && cityField.cityName) {
          cityName = cityField.cityName;
        } else {
          var ciId = typeof cityField === 'object' ? String(cityField._id || cityField) : String(cityField);
          cityName = citiesMap[ciId] || safeStr(cityField);
        }
      }

      var fcmToken = p.fcmToken || p.fcm_token || p.deviceToken || p.pushToken ||
                     (p.deviceInfo && (p.deviceInfo.fcmToken || p.deviceInfo.token)) || '';
      var isOnline = p.isOnline || p.online || p.isAvailable ||
                     p.status === 'online' || p.status === 'active' || false;
      var name = safeStr(p.name || p.fullName || p.firstName || p.businessName || 'Provider');
      var phone = safeStr(p.phone || p.phoneNumber || p.mobile || '');
      var email = safeStr(p.email || '');

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
        rating: safeNum(p.rating || p.averageRating || p.avgRating || 0),
        totalJobs: safeNum(p.totalJobs || p.completedJobs || p.jobsCompleted || p.totalBookings || 0),
        profileImage: safeStr(p.profileImage || p.avatar || p.photo || p.image || ''),
        createdAt: p.createdAt || (p._id.getTimestamp ? p._id.getTimestamp() : new Date()),
        timeAgo: timeAgo(p.createdAt || (p._id.getTimestamp ? p._id.getTimestamp() : new Date())),
        lastActive: p.lastActive || p.lastSeen || p.updatedAt || '',
        lastActiveAgo: timeAgo(p.lastActive || p.lastSeen || p.updatedAt || ''),
        _sourceDb: p._sourceDb || ''
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

    var allBookings = await findInAllDbsAggregated('bookings', {}, { limit: 500, sort: { _id: -1 } });

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
        createdAt: b.createdAt || (b._id.getTimestamp ? b._id.getTimestamp() : new Date()),
        timeAgo: timeAgo(b.createdAt || (b._id.getTimestamp ? b._id.getTimestamp() : new Date())),
        updatedAt: b.updatedAt || '',
        updatedAgo: timeAgo(b.updatedAt || ''),
        paymentMethod: safeStr(b.paymentMethod || b.paymentMode || b.paymentType || ''),
        paymentStatus: safeStr(b.paymentStatus || ''),
        otp: safeStr(b.otp || b.verificationCode || ''),
        _source: b._sourceDb || 'unknown'
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
            return ['searching', 'pending', 'confirmed', 'active', 'in_progress', 'accepted'].indexOf(b.status) !== -1;
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
// SEND MANUAL DISPATCH
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

    var providerOid = toObjectId(providerId);
    var providerResult = null;

    if (providerOid) {
      providerResult = await findOneInAllDbs('providers', { _id: providerOid });
    }
    if (!providerResult || !providerResult.doc) {
      return res.status(404).json({ success: false, error: 'Provider ' + providerId + ' not found' });
    }

    var provider = providerResult.doc;
    console.log('👤 Provider: ' + (provider.name || provider.fullName || 'Unknown') + ' (from ' + providerResult.dbName + ')');

    var fcmToken = provider.fcmToken || provider.fcm_token || provider.deviceToken || provider.pushToken ||
                   (provider.deviceInfo && (provider.deviceInfo.fcmToken || provider.deviceInfo.token)) || '';

    if (!fcmToken) {
      return res.status(400).json({
        success: false,
        error: 'Provider ' + (provider.name || providerId) + ' has no FCM token.'
      });
    }
    console.log('📱 FCM Token: ' + fcmToken.substring(0, 20) + '...');

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

    var offerResult = await insertInAnyDb('provideroffers', offerDoc, ['bookings_db', 'admin_panel']);
    if (offerResult.success) {
      console.log('   ✅ ProviderOffer created in ' + offerResult.dbName + ': ' + offerId);
    } else {
      console.log('   ⚠️ ProviderOffer insert failed in all DBs');
    }

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

      var dispResult = await insertInAnyDb('dispatchjobs', dispatchDoc, ['bookings_db', 'admin_panel']);
      if (dispResult.success) {
        console.log('   ✅ DispatchJob created in ' + dispResult.dbName + ': ' + dispatchJobId + ' (status: ' + statusOptions[si] + ')');
        dispatchInserted = true;
        break;
      }
    }

    var title = '🔔 New Booking! ₹' + totalAmount;
    var body = serviceName + ' • ₹' + totalAmount + ' • ' + (scheduledTime || 'ASAP') + '\n📍 ' + (address || cityName || 'Service Location');

    var fcmMessage = {
      token: fcmToken,
      notification: { title: title, body: body },
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

    var fcmResult = null;
    var fcmError = null;

    try {
      var firebase = getProviderFirebaseApp();
      var messaging = firebase.messaging;

      if (!messaging || typeof messaging.send !== 'function') {
        throw new Error('Firebase messaging invalid');
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

      try {
        await updateInAllDbs('provideroffers',
          { _id: offerId },
          { $set: { fcmSent: false, fcmError: fcmError, fcmFailedAt: new Date() } }
        );
      } catch (e) {}
    }

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
      }
    } catch (e) {}

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
        offerInserted: offerResult.success,
        dispatchInserted: dispatchInserted,
        message: fcmResult
          ? '✅ Dispatch sent! Provider will get Accept/Reject popup. Expires in 30s.'
          : '❌ FCM failed: ' + fcmError
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
// DEBUG — CRITICAL for diagnosing
// ============================================================

async function debug(req, res) {
  try {
    var all = getAllConnections();

    var connectionsInfo = all.map(function(c) {
      return {
        name: c.name,
        readyState: c.conn.readyState,
        host: c.conn.host,
        port: c.conn.port
      };
    });

    var dbTests = {};
    for (var i = 0; i < all.length; i++) {
      var dbName = all[i].name;
      dbTests[dbName] = {};
      var cols = ['providers', 'bookings', 'users', 'categories', 'cities', 'services', 'provideroffers', 'dispatchjobs'];
      for (var j = 0; j < cols.length; j++) {
        try {
          var count = await all[i].conn.collection(cols[j]).countDocuments();
          if (count > 0) dbTests[dbName][cols[j]] = count;
        } catch (e) {}
      }
    }

    var maps = await Promise.all([
      loadCategoriesMap(), loadCitiesMap(), loadServicesMap(), loadUsersMap()
    ]);

    var firebaseStatus = 'not tested';
    try {
      var fb = getProviderFirebaseApp();
      firebaseStatus = fb.messaging && typeof fb.messaging.send === 'function'
        ? 'messaging ready ✅'
        : 'messaging INVALID ❌';
    } catch (e) {
      firebaseStatus = 'error: ' + e.message;
    }

    var provResult = await findInAllDbsAggregated('providers', {}, { limit: 2 });
    var bookResult = await findInAllDbsAggregated('bookings', {}, { limit: 2 });

    res.json({
      success: true,
      data: {
        mongooseVersion: mongoose.version,
        mongooseConnectionsCount: (mongoose.connections || []).length,
        connectedDbsCount: all.length,
        connectionsInfo: connectionsInfo,
        defaultConnectionReadyState: mongoose.connection.readyState,
        dbTests: dbTests,
        categoriesLoaded: Object.keys(maps[0]).length,
        citiesLoaded: Object.keys(maps[1]).length,
        servicesLoaded: Object.keys(maps[2]).length,
        usersLoaded: Object.keys(maps[3]).length,
        firebaseStatus: firebaseStatus,
        sampleProvidersFound: provResult.length,
        sampleBookingsFound: bookResult.length,
        sampleProviders: provResult.map(function(p) {
          return {
            _id: String(p._id),
            name: p.name || p.fullName,
            sourceDb: p._sourceDb,
            fcmToken: p.fcmToken ? 'YES' : 'NO'
          };
        }),
        sampleBookings: bookResult.map(function(b) {
          return {
            _id: String(b._id),
            status: b.status,
            sourceDb: b._sourceDb
          };
        }),
        envVars: {
          PROVIDER_FIREBASE_BASE64: process.env.PROVIDER_FIREBASE_SERVICE_ACCOUNT_BASE64 ? 'SET' : 'NOT SET',
          ADMIN_SECRET: process.env.ADMIN_SECRET_KEY ? 'SET' : 'NOT SET',
          MONGODB_URI: process.env.MONGODB_URI ? 'SET' : 'NOT SET'
        }
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message, stack: error.stack });
  }
}

async function debugConnections(req, res) {
  try {
    var all = getAllConnections();
    var results = {
      mongooseConnectionsArrayLength: (mongoose.connections || []).length,
      connectedDbs: all.length,
      dbs: {}
    };

    var collections = ['providers', 'bookings', 'categories', 'cities', 'services', 'users', 'provideroffers', 'dispatchjobs'];

    for (var i = 0; i < all.length; i++) {
      results.dbs[all[i].name] = {
        readyState: all[i].conn.readyState,
        host: all[i].conn.host
      };
      for (var j = 0; j < collections.length; j++) {
        try {
          var count = await all[i].conn.collection(collections[j]).countDocuments();
          results.dbs[all[i].name][collections[j]] = count;
        } catch (e) {}
      }
    }
    res.json({ success: true, data: results });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

function _health(req, res) {
  var all = getAllConnections();
  res.json({
    success: true,
    message: 'Manual Dispatch controller healthy',
    timestamp: new Date().toISOString(),
    connectedDbs: all.map(function(a) { return a.name; }),
    exports: Object.keys(module.exports)
  });
}

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