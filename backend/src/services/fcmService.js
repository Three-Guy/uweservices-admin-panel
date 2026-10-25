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
async function sendBookingOfferToProvider({
  fcmToken,
  bookingId,
  serviceName,
  totalAmount,
  distance,
  latitude,
  longitude,
  address,
  scheduledDate,
  customerName,
  city,
  batchNumber = 1,
  timeoutMs = 15000,
  bookingType = 'instant',
}) {
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

  const body = `${serviceName} • ${distance ? distance.toFixed(1) + ' km' : 'Nearby'} • ${address || city || ''}`;

  const message = {
    token: fcmToken,
    notification: { title, body },
    data: {
      type: isScheduled ? 'booking_scheduled' : 'booking',
      bookingId: String(bookingId),
      serviceName: String(serviceName || ''),
      distance: String(distance ? distance.toFixed(2) : '0'),
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
        'apns-push-type': 'background',
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
    data: {
      ...data,
      click_action: '/bookings',
      timestamp: String(Date.now()),
    },
    webpush: {
      notification: {
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        tag: data.type || 'admin-alert',
        requireInteraction: true,
        actions: [
          { action: 'view', title: 'View' },
          { action: 'dismiss', title: 'Dismiss' },
        ],
      },
      fcmOptions: {
        link: data.link || '/bookings',
      },
    },
  };

  try {
    const response = await messaging.sendEachForMulticast(message);
    const successCount = response.successCount;
    const failCount = response.failureCount;

    if (failCount > 0) {
      logger.warn(`[FCM] Admin web push: ${successCount} sent, ${failCount} failed`);
      // Log individual failures for token cleanup
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
async function sendCancellationToProvider({ fcmToken, bookingId, reason }) {
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
      headers: { 'apns-priority': '10' },
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