// backend/src/controllers/manualDispatch.controller.js
const mongoose = require('mongoose');
const path = require('path');
const firebaseAdmin = require('firebase-admin');

// ============================================================
// FIREBASE PROVIDER APP (named app to avoid conflict)
// ============================================================
let providerApp = null;
let providerMessaging = null;

function loadServiceAccount() {
  // Try env BASE64 first
  const b64Key = 'PROVIDER_FIREBASE_SERVICE_ACCOUNT_BASE64';
  const b64Val = process.env[b64Key];
  if (typeof b64Val === 'string' && b64Val.length > 100) {
    try {
      const json = Buffer.from(b64Val, 'base64').toString('utf8');
      const sa = JSON.parse(json);
      console.log('✅ SA loaded from env:', b64Key);
      return sa;
    } catch (e) {
      console.error('❌ Failed parsing SA from env:', e.message);
    }
  }

  // Try JSON env
  const jsonKey = 'PROVIDER_FIREBASE_SERVICE_ACCOUNT_JSON';
  const jsonVal = process.env[jsonKey];
  if (typeof jsonVal === 'string' && jsonVal.length > 100) {
    try {
      const sa = JSON.parse(jsonVal);
      console.log('✅ SA loaded from env:', jsonKey);
      return sa;
    } catch (e) {
      console.error('❌ Failed parsing SA JSON env:', e.message);
    }
  }

  // Try file
  try {
    const filePath = path.resolve(process.cwd(), 'src/config/serviceproviderapp-b7767-firebase-adminsdk.json');
    const sa = require(filePath);
    console.log('✅ SA loaded from file:', filePath);
    return sa;
  } catch (e) {
    console.error('❌ No service account file:', e.message);
  }

  return null;
}

function getProviderMessaging() {
  if (providerMessaging) return providerMessaging;

  try {
    const sa = loadServiceAccount();
    if (!sa) {
      console.error('❌ No service account available');
      return null;
    }

    console.log(`🔄 Initializing Firebase for provider (project: ${sa.project_id})...`);

    // Check if named app already exists
    const existingApps = Array.isArray(firebaseAdmin.apps) ? firebaseAdmin.apps : [];
    const existing = existingApps.find(a => a && a.name === 'provider');
    if (existing) {
      providerApp = existing;
      providerMessaging = providerApp.messaging();
      console.log('✅ Reusing existing provider app');
      return providerMessaging;
    }

    // Approach 1: admin.credential.cert
    let credential = null;
    try {
      if (firebaseAdmin.credential && typeof firebaseAdmin.credential.cert === 'function') {
        credential = firebaseAdmin.credential.cert(sa);
        console.log('✅ Approach 1 SUCCESS: admin.credential.cert');
      } else {
        console.log('⚠️ admin.credential.cert not available');
      }
    } catch (e1) {
      console.log('⚠️ Approach 1 failed:', e1.message);
    }

    // Approach 2: modular cert
    if (!credential) {
      try {
        console.log('🔄 Approach 2: modular cert() from firebase-admin/app');
        const { cert } = require('firebase-admin/app');
        credential = cert(sa);
        console.log('✅ Approach 2 SUCCESS');
      } catch (e2) {
        console.log('⚠️ Approach 2 failed:', e2.message);
      }
    }

    if (!credential) {
      console.error('❌ Could not create credential');
      return null;
    }

    providerApp = firebaseAdmin.initializeApp({
      credential,
      projectId: sa.project_id,
    }, 'provider');

    providerMessaging = providerApp.messaging();
    console.log('✅ Provider Firebase initialized');
    return providerMessaging;
  } catch (err) {
    console.error('❌ getProviderMessaging FATAL:', err.message);
    console.error(err.stack);
    return null;
  }
}

// ============================================================
// DB CONNECTIONS
// ============================================================
function getConn(name) {
  const conns = mongoose.connections || [];
  for (const c of conns) {
    if (c && c.name === name) return c;
  }
  return mongoose.connection;
}

function getModel(connName, modelName, schemaDef) {
  const conn = getConn(connName);
  if (!conn) return null;
  if (conn.models && conn.models[modelName]) return conn.models[modelName];
  const schema = new mongoose.Schema(schemaDef || {}, { strict: false, timestamps: true });
  return conn.model(modelName, schema);
}

// ============================================================
// STRING COERCE — Firebase data MUST be all strings
// ============================================================
function s(v) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (v instanceof Date) return v.toISOString();
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

function stringifyAll(obj) {
  const out = {};
  for (const k of Object.keys(obj || {})) {
    out[k] = s(obj[k]);
  }
  return out;
}

// ============================================================
// HYBRID ALARM FCM — matches provider backend exactly
// ============================================================
async function sendHybridAlarmFCM(fcmToken, booking, provider) {
  console.log('📲 Sending HYBRID ALARM FCM...');
  console.log('📲 getProviderMessaging()...');

  const messaging = getProviderMessaging();
  if (!messaging) {
    return { success: false, error: 'messaging not initialized' };
  }

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

  // ALL data values MUST be strings
  const dataPayload = stringifyAll({
    type: 'booking_request',
    bookingId: bookingId,
    bookingObjectId: bookingId,
    actionUrl: `/booking-detail?bookingId=${bookingId}`,
    serviceName: serviceName,
    serviceIcon: '🔧',
    categoryName: booking.categoryName || serviceName,
    customerName: customerName,
    totalAmount: totalAmount,
    baseAmount: baseAmount,
    servicePrice: baseAmount,
    priceDisplay: `₹${totalAmount}`,
    scheduledTime: scheduledTime,
    scheduledDate: scheduledDate,
    address: address,
    city: city,
    priority: 'high',
    channelId: 'bookings_alarm',
    category: 'booking_request',
    clickAction: 'OPEN_BOOKING',
    timeout: 30,
    expiresAt: Date.now() + 30000,
    isExclusive: 'true',
    source: 'manual_admin',
    _isBookingAlarm: 'true',
    _source: 'fcm',
    _sentAt: Date.now(),
    sound: 'booking_alarm',
    title: title,
    body: body,
  });

  const message = {
    token: fcmToken,
    notification: {
      title: title,
      body: body,
    },
    data: dataPayload,
    android: {
      priority: 'high',
      ttl: 120000,
      collapseKey: `booking_${bookingId}`,
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
        'apns-expiration': String(Math.floor(Date.now() / 1000) + 120),
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

  try {
    console.log('📲 Sending FCM via messaging.send()...');
    console.log('📲 Payload data keys:', Object.keys(dataPayload).join(', '));
    const response = await messaging.send(message);
    console.log('✅ HYBRID ALARM FCM SENT! messageId:', response);
    return { success: true, messageId: response };
  } catch (err) {
    console.error('❌ FCM send() failed:', err.message);
    console.error('❌ Error code:', err.code);
    if (err.errorInfo) console.error('❌ ErrorInfo:', JSON.stringify(err.errorInfo));
    return { success: false, error: err.message, code: err.code };
  }
}

// ============================================================
// CANCEL OLD PROVIDER FCM (silent data-only)
// ============================================================
async function sendCancellationFCM(fcmToken, bookingId, reason) {
  const messaging = getProviderMessaging();
  if (!messaging) return { success: false };

  const message = {
    token: fcmToken,
    data: stringifyAll({
      type: 'booking_cancelled_by_admin',
      bookingId: String(bookingId),
      reason: reason || 'Admin re-assigned',
      _source: 'fcm',
      _sentAt: Date.now(),
    }),
    android: { priority: 'high' },
  };

  try {
    const res = await messaging.send(message);
    console.log('✅ Cancellation FCM sent:', res);
    return { success: true };
  } catch (e) {
    console.error('⚠️ Cancellation FCM failed:', e.message);
    return { success: false, error: e.message };
  }
}

// ============================================================
// MODELS
// ============================================================
function Bookings() {
  return getModel('bookings_db', 'Booking', {}) || getModel('user_db', 'Booking', {});
}
function Providers() {
  return getModel('admin_panel', 'Provider', {}) || getModel('provider_db', 'Provider', {});
}
function ProviderOffers() {
  return getModel('bookings_db', 'ProviderOffer', {}) || getModel('admin_panel', 'ProviderOffer', {});
}
function DispatchJobs() {
  return getModel('bookings_db', 'DispatchJob', {}) || getModel('admin_panel', 'DispatchJob', {});
}

// ============================================================
// GET ONLINE PROVIDERS
// ============================================================
exports.getOnlineProviders = async (req, res) => {
  try {
    const Provider = Providers();
    if (!Provider) return res.json({ success: true, providers: [] });

    const includeAll = req.query.all === '1' || req.query.all === 'true';
    const search = (req.query.search || '').trim();
    const category = (req.query.category || '').trim();

    const q = {};
    if (!includeAll) {
      q.$or = [
        { isOnline: true },
        { online: true },
        { isAvailable: true },
      ];
    }
    if (search) {
      const rx = new RegExp(search, 'i');
      q.$and = [{ $or: [{ name: rx }, { phone: rx }, { email: rx }, { providerId: rx }] }];
    }
    if (category) {
      q.$and = (q.$and || []).concat([{ $or: [{ profession: new RegExp(category, 'i') }, { category: new RegExp(category, 'i') }] }]);
    }

    const docs = await Provider.find(q).limit(500).lean();
    console.log(`📊 Returned ${docs.length} providers`);
    return res.json({ success: true, providers: docs });
  } catch (err) {
    console.error('❌ getOnlineProviders:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

// ============================================================
// GET DISPATCHABLE BOOKINGS
// ============================================================
exports.getDispatchableBookings = async (req, res) => {
  try {
    const Booking = Bookings();
    if (!Booking) return res.json({ success: true, bookings: [] });

    const docs = await Booking.find({
      status: { $nin: ['completed', 'cancelled', 'cancelled_by_user'] },
    })
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();

    console.log(`📊 Returned ${docs.length} bookings`);
    return res.json({ success: true, bookings: docs });
  } catch (err) {
    console.error('❌ getDispatchableBookings:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

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

    const Booking = Bookings();
    const Provider = Providers();
    const Offer = ProviderOffers();
    const Job = DispatchJobs();

    // Find booking
    let booking = null;
    try {
      booking = await Booking.findById(bookingId).lean();
    } catch {
      booking = await Booking.findOne({ _id: bookingId }).lean();
    }
    if (!booking) {
      return res.status(404).json({ success: false, error: 'Booking not found' });
    }

    // Find provider — try multiple identifiers
    let provider = null;
    try {
      if (mongoose.Types.ObjectId.isValid(providerId)) {
        provider = await Provider.findById(providerId).lean();
      }
    } catch {}
    if (!provider) {
      provider = await Provider.findOne({
        $or: [{ providerId }, { phone: providerId }, { email: providerId }],
      }).lean();
    }
    if (!provider) {
      return res.status(404).json({ success: false, error: 'Provider not found' });
    }

    const fcmToken = provider.fcmToken || provider.deviceToken || provider.token || '';
    console.log(`📋 Booking: ${booking._id} | Status: ${booking.status}`);
    console.log(`🎯 Target: ${provider.name || provider.providerId} | FCM token: ${fcmToken ? fcmToken.substring(0, 15) + '...' : 'MISSING'}`);

    if (!fcmToken) {
      return res.status(400).json({ success: false, error: 'Target provider has no FCM token' });
    }

    // Cancel old provider if assigned
    const oldProviderId = booking.providerId || booking.assignedProvider || booking.provider;
    if (oldProviderId && String(oldProviderId) !== String(provider._id)) {
      try {
        const oldProvider = await Provider.findOne({
          $or: [{ _id: oldProviderId }, { providerId: oldProviderId }],
        }).lean();
        if (oldProvider && oldProvider.fcmToken) {
          await sendCancellationFCM(oldProvider.fcmToken, bookingId, 'Admin re-assigned to another provider');
        }
      } catch (e) {
        console.error('⚠️ Could not cancel old provider:', e.message);
      }
    }

    // Supersede existing offers
    try {
      await Offer.updateMany(
        { bookingId: booking._id, status: { $in: ['pending', 'sent', 'active'] } },
        { $set: { status: 'superseded', supersededAt: new Date() } }
      );
      console.log('🔄 Superseded old offers');
    } catch (e) {
      console.error('⚠️ Supersede failed:', e.message);
    }

    // Reset booking to searching
    try {
      await Booking.updateOne(
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
    } catch (e) {
      console.error('⚠️ Booking reset failed:', e.message);
    }

    // Create new offer
    const expiresAt = new Date(Date.now() + 30 * 1000);
    const offer = await Offer.create({
      bookingId: booking._id,
      providerId: provider._id,
      providerCode: provider.providerId,
      status: 'pending',
      source: 'manual_admin',
      adminNote: adminNote || '',
      expiresAt,
      createdAt: new Date(),
    });
    console.log(`📝 Offer: ${offer._id}`);

    // Create dispatch job
    const jobStatuses = ['pending', 'active', 'dispatched', 'searching', 'sent', 'waiting'];
    let job = null;
    for (const st of jobStatuses) {
      try {
        job = await Job.create({
          bookingId: booking._id,
          providerId: provider._id,
          status: st,
          source: 'manual_admin',
          expiresAt,
          createdAt: new Date(),
        });
        console.log(`📝 DispatchJob status=${st}`);
        break;
      } catch (e) {
        // try next
      }
    }

    // Send FCM
    const fcmResult = await sendHybridAlarmFCM(fcmToken, booking, provider);

    // Socket emit
    try {
      const io = req.app.get('io');
      if (io) {
        const payload = {
          offerId: offer._id,
          bookingId: booking._id,
          providerId: provider._id,
          providerName: provider.name,
          fcm: fcmResult,
        };
        const room = io.sockets.adapter.rooms.get('admins');
        const n = room ? room.size : 0;
        console.log(`📡 [LiveEmitter] Emitting "manual-dispatch:sent" to room "admins" (${n} sockets)`);
        io.to('admins').emit('manual-dispatch:sent', payload);
        const total = io.sockets.sockets.size;
        console.log(`📡 [LiveEmitter] Emitting "manual-dispatch:sent" GLOBALLY (${total} total sockets)`);
        io.emit('manual-dispatch:sent', payload);
      }
    } catch (e) {
      console.error('⚠️ Socket emit failed:', e.message);
    }

    // Setup 30s timeout
    setTimeout(async () => {
      try {
        const current = await Offer.findById(offer._id).lean();
        if (current && current.status === 'pending') {
          await Offer.updateOne({ _id: offer._id }, { $set: { status: 'timeout', timedOutAt: new Date() } });
          if (job) {
            await Job.updateOne({ _id: job._id }, { $set: { status: 'timeout' } });
          }
          await Booking.updateOne(
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
        console.error('⚠️ Timeout handler failed:', e.message);
      }
    }, 30 * 1000);

    console.log(`✅ FCM: ${fcmResult.success ? 'SENT ✅ ' + fcmResult.messageId : 'FAILED ❌ ' + fcmResult.error}`);
    console.log('============================================================\n');

    return res.json({
      success: true,
      offer: {
        _id: offer._id,
        bookingId: booking._id,
        providerId: provider._id,
        expiresAt,
      },
      fcm: fcmResult,
    });
  } catch (err) {
    console.error('❌ send fatal:', err);
    console.error(err.stack);
    return res.status(500).json({ success: false, error: err.message });
  }
};

// ============================================================
// OFFER STATUS POLL
// ============================================================
exports.getOfferStatus = async (req, res) => {
  try {
    const { offerId } = req.params;
    const Offer = ProviderOffers();
    if (!Offer) return res.json({ success: true, offer: null });

    const offer = await Offer.findById(offerId).lean();
    if (!offer) return res.json({ success: true, offer: null });

    return res.json({ success: true, offer });
  } catch (err) {
    console.error('❌ getOfferStatus:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

// ============================================================
// DEBUG
// ============================================================
exports.debug = async (req, res) => {
  const info = {
    env: {
      hasB64: !!process.env.PROVIDER_FIREBASE_SERVICE_ACCOUNT_BASE64,
      hasJSON: !!process.env.PROVIDER_FIREBASE_SERVICE_ACCOUNT_JSON,
    },
    firebase: {
      appsCount: Array.isArray(firebaseAdmin.apps) ? firebaseAdmin.apps.length : 0,
      appNames: Array.isArray(firebaseAdmin.apps) ? firebaseAdmin.apps.map(a => a && a.name) : [],
      hasCredentialCert: !!(firebaseAdmin.credential && firebaseAdmin.credential.cert),
    },
    db: {
      connections: mongoose.connections.map(c => ({ name: c.name, readyState: c.readyState })),
    },
  };

  // Try to init
  const messaging = getProviderMessaging();
  info.messagingInitialized = !!messaging;

  return res.json(info);
};

// ============================================================
// HEALTH
// ============================================================
exports._health = async (req, res) => {
  return res.json({ ok: true, time: new Date().toISOString() });
};