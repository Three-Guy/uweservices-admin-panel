// src/services/fcmService.js
const {
  getProviderMessaging,
  getAdminWebMessaging,
  isProviderFirebaseReady,
  isAdminWebFirebaseReady,
} = require('../config/firebase');

let logger;
try {
  logger = require('../utils/logger');
} catch {
  logger = { info: console.log, warn: console.warn, error: console.error, debug: console.debug };
}

// ══════════════════════════════════════════════════════════════
//  1. SEND BOOKING OFFER TO PROVIDER (via serviceproviderapp FCM)
// ══════════════════════════════════════════════════════════════
async function sendBookingOfferToProvider(providerOrOpts, bookingOrNull, extra = {}) {
  // Backwards-compat: dispatchService calls as (provider, booking, extra)
  //                   notification scripts may call as ({ fcmToken, bookingId, ... })
  let fcmToken, bookingId, serviceName, totalAmount, distance,
      latitude, longitude, address, scheduledDate, customerName, city,
      batchNumber, timeoutMs, bookingType;

  if (providerOrOpts && typeof providerOrOpts === 'object' && providerOrOpts.fcmToken && !bookingOrNull) {
    // Old opts-object signature
    const o = providerOrOpts;
    fcmToken = o.fcmToken;
    bookingId = o.bookingId;
    serviceName = o.serviceName;
    totalAmount = o.totalAmount;
    distance = o.distance;
    latitude = o.latitude;
    longitude = o.longitude;
    address = o.address;
    scheduledDate = o.scheduledDate;
    customerName = o.customerName;
    city = o.city;
    batchNumber = o.batchNumber || 1;
    timeoutMs = o.timeoutMs || 15000;
    bookingType = o.bookingType || 'instant';
  } else {
    // (provider, booking, extra) signature — the one dispatchService uses
    const provider = providerOrOpts || {};
    const booking = bookingOrNull || {};
    fcmToken = provider.fcmToken;
    bookingId = booking.bookingId || String(booking._id);
    serviceName = booking.serviceName;
    totalAmount = booking.totalAmount;
    distance = extra.distanceKm != null ? extra.distanceKm : provider._distanceKm;
    const loc = booking.customerLocation || {};
    const coords = loc.coordinates || [];
    longitude = coords[0];
    latitude = coords[1];
    address = booking.address;
    scheduledDate = booking.scheduledDate;
    customerName = booking.customerName;
    city = booking.city?.cityName;
    batchNumber = extra.batchNumber || 1;
    timeoutMs = extra.timeoutMs || 15000;
    bookingType = booking.bookingType || 'instant';
  }

  if (!isProviderFirebaseReady()) {
    logger.warn('[FCM] Provider Firebase not ready — skipping provider push');
    return { success: false, error: 'Provider Firebase not initialized' };
  }

  if (!fcmToken) {
    return { success: false, error: 'No FCM token' };
  }

  const messaging = getProviderMessaging();
  if (!messaging) return { success: false, error: 'Messaging unavailable' };

  const isScheduled = bookingType === 'scheduled';
  const title = isScheduled
    ? `📅 Scheduled Booking! ₹${totalAmount || 0}`
    : `🔔 New Booking! ₹${totalAmount || 0}`;

  const body = `${serviceName || 'Service'} • ${distance ? Number(distance).toFixed(1) + ' km' : 'Nearby'} • ${address || city || ''}`;

  const message = {
    token: fcmToken,
    notification: { title, body },
    data: {
      type: isScheduled ? 'booking_scheduled' : 'booking',
      bookingId: String(bookingId),
      serviceName: String(serviceName || ''),
      distance: String(distance ? Number(distance).toFixed(2) : '0'),
      latitude: String(latitude || ''),
      longitude: String(longitude || ''),
      address: String(address || ''),
      totalAmount: String(totalAmount || 0),
      scheduledDate: String(scheduledDate || ''),
      customerName: String(customerName || ''),
      city: String(city || ''),
      batchNumber: String(batchNumber),
      timeout: String(timeoutMs),
      priority: 'high',
      isExclusive: 'true',
      expiresAt: String(Date.now() + timeoutMs),
    },
    android: {
      priority: 'high',
      ttl: timeoutMs,
      notification: {
        channelId: 'booking_requests',
        priority: 'max',
        sound: 'default',
        clickAction: 'FLUTTER_NOTIFICATION_CLICK',
      },
    },
    apns: {
      headers: {
        'apns-priority': '10',
        'apns-push-type': 'alert',
      },
      payload: {
        aps: {
          'content-available': 1,
          'mutable-content': 1,
          sound: 'default',
          alert: { title, body },
        },
      },
    },
  };

  try {
    const response = await messaging.send(message);
    logger.info(`[FCM] ✅ Provider push sent → ${bookingId} → ${response}`);
    return { success: true, messageId: response };
  } catch (error) {
    const code = error?.code || error?.errorInfo?.code || 'unknown';
    logger.error(`[FCM] ❌ Provider push failed → ${bookingId}: ${code} — ${error.message}`);
    return { success: false, error: code, message: error.message };
  }
}

// ══════════════════════════════════════════════════════════════
//  2. SEND ALERT TO ADMIN BROWSER (via uwe-services-web FCM)
// ══════════════════════════════════════════════════════════════
async function sendAdminAlert({ tokens, title, body, data = {} }) {
  if (!isAdminWebFirebaseReady()) {
    logger.debug('[FCM] Admin Web Firebase not ready — skipping admin web push');
    return { success: false, error: 'Admin Web Firebase not initialized' };
  }

  const validTokens = (tokens || []).filter(Boolean);
  if (validTokens.length === 0) {
    return { success: false, error: 'No admin FCM tokens registered' };
  }

  const messaging = getAdminWebMessaging();
  if (!messaging) return { success: false, error: 'Messaging unavailable' };

  const message = {
    tokens: validTokens,
    notification: {
      title: title || '🔔 Admin Alert',
      body: body || '',
    },
    data: Object.fromEntries(
      Object.entries({
        ...data,
        click_action: data.actionUrl || '/bookings',
        timestamp: String(Date.now()),
      }).map(([k, v]) => [k, String(v == null ? '' : v)])
    ),
    webpush: {
      notification: {
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        tag: data.type || 'admin-alert',
        requireInteraction: true,
      },
      fcmOptions: {
        link: data.actionUrl || '/bookings',
      },
    },
  };

  try {
    const response = await messaging.sendEachForMulticast(message);
    const successCount = response.successCount;
    const failCount = response.failureCount;

    if (failCount > 0) {
      logger.warn(`[FCM] Admin web push: ${successCount} sent, ${failCount} failed`);
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          logger.debug(`[FCM] Failed token: ${validTokens[idx].substring(0, 20)}... → ${resp.error?.code}`);
        }
      });
    } else {
      logger.info(`[FCM] ✅ Admin web push sent to ${successCount} devices`);
    }

    return {
      success: successCount > 0,
      successCount,
      failCount,
      responses: response.responses,
    };
  } catch (error) {
    logger.error(`[FCM] ❌ Admin web push failed: ${error.message}`);
    return { success: false, error: error.code || 'unknown', message: error.message };
  }
}

// ══════════════════════════════════════════════════════════════
//  3. SEND CANCELLATION TO PROVIDER (silent data push)
// ══════════════════════════════════════════════════════════════
async function sendCancellationToProvider(providerOrToken, bookingOrId, reason) {
  // Accept both (providerObj, booking, reason) and ({ fcmToken, bookingId, reason })
  let fcmToken, bookingId;
  if (providerOrToken && typeof providerOrToken === 'object' && providerOrToken.fcmToken) {
    fcmToken = providerOrToken.fcmToken;
    bookingId = (bookingOrId && (bookingOrId.bookingId || String(bookingOrId._id))) || '';
  } else if (providerOrToken && typeof providerOrToken === 'object' && providerOrToken.providerId) {
    // Legacy: just providerId passed — nothing to send to
    return { success: false, error: 'Need provider.fcmToken, not providerId' };
  } else {
    fcmToken = String(providerOrToken || '');
    bookingId = String(bookingOrId || '');
  }

  if (!isProviderFirebaseReady() || !fcmToken) {
    return { success: false, error: 'Not available' };
  }

  const messaging = getProviderMessaging();
  if (!messaging) return { success: false, error: 'Messaging unavailable' };

  const message = {
    token: fcmToken,
    data: {
      type: 'booking_cancelled',
      bookingId: String(bookingId),
      reason: String(reason || 'Reassigned'),
      timestamp: String(Date.now()),
    },
    android: {
      priority: 'high',
      ttl: 10000,
    },
    apns: {
      headers: { 'apns-priority': '10', 'apns-push-type': 'background' },
      payload: { aps: { 'content-available': 1 } },
    },
  };

  try {
    const response = await messaging.send(message);
    logger.info(`[FCM] ✅ Cancellation sent → ${bookingId}`);
    return { success: true, messageId: response };
  } catch (error) {
    logger.error(`[FCM] ❌ Cancellation failed → ${bookingId}: ${error.message}`);
    return { success: false, error: error.code || 'unknown' };
  }
}

module.exports = {
  sendBookingOfferToProvider,
  sendAdminAlert,
  sendCancellationToProvider,
};