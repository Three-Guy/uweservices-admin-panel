// backend/src/services/directPushSender.js
// Reusable FCM sender for Direct Push feature.
// Uses provider Firebase messaging (same as fcmService.js pattern).

const logger = require('../utils/logger');

let firebaseConfig = null;
try {
  firebaseConfig = require('../config/firebase');
} catch (e) {
  console.warn('[directPushSender] firebase config not loadable:', e.message);
}

/**
 * Get the provider messaging instance (fallback to admin web if provider missing).
 */
function getMessaging() {
  if (!firebaseConfig) {
    throw new Error('Firebase config not available');
  }

  // Try provider messaging first
  if (typeof firebaseConfig.getProviderMessaging === 'function') {
    try {
      const m = firebaseConfig.getProviderMessaging();
      if (m) return m;
    } catch (_) {}
  }

  // Fallback to admin web messaging
  if (typeof firebaseConfig.getAdminWebMessaging === 'function') {
    try {
      const m = firebaseConfig.getAdminWebMessaging();
      if (m) return m;
    } catch (_) {}
  }

  // Legacy fallback
  if (typeof firebaseConfig.getMessaging === 'function') {
    try {
      const m = firebaseConfig.getMessaging();
      if (m) return m;
    } catch (_) {}
  }

  throw new Error('No Firebase messaging instance available');
}

/**
 * Build the FCM message payload.
 */
function buildMessage({ title, body, imageUrl, clickAction, customData }) {
  const notification = {
    title: String(title || ''),
    body: String(body || ''),
  };
  if (imageUrl && typeof imageUrl === 'string' && imageUrl.trim()) {
    notification.imageUrl = imageUrl.trim();
  }

  // Normalize data payload — FCM requires all values to be strings
  const data = {};
  if (customData && typeof customData === 'object') {
    for (const [k, v] of Object.entries(customData)) {
      if (v === null || v === undefined) continue;
      data[String(k)] = typeof v === 'string' ? v : JSON.stringify(v);
    }
  }
  if (clickAction && typeof clickAction === 'string' && clickAction.trim()) {
    data.click_action = clickAction.trim();
    data.clickAction = clickAction.trim();
    data.url = clickAction.trim();
  }
  data.sentAt = new Date().toISOString();
  data.source = 'direct_push';

  const android = {
    priority: 'high',
    notification: {
      sound: 'default',
      channelId: 'default',
    },
  };
  if (imageUrl) android.notification.imageUrl = imageUrl;
  if (clickAction) android.notification.clickAction = clickAction;

  const apns = {
    headers: { 'apns-priority': '10' },
    payload: {
      aps: {
        alert: { title: notification.title, body: notification.body },
        sound: 'default',
        badge: 1,
      },
    },
  };
  if (imageUrl) {
    apns.fcmOptions = { imageUrl };
  }

  const webpush = {
    headers: { Urgency: 'high' },
    notification: {
      title: notification.title,
      body: notification.body,
      icon: imageUrl || undefined,
      requireInteraction: false,
    },
    fcmOptions: clickAction ? { link: clickAction } : undefined,
  };

  return { notification, data, android, apns, webpush };
}

/**
 * Normalize token list: dedupe, trim, filter empty strings.
 */
function normalizeTokens(tokens) {
  if (!Array.isArray(tokens)) tokens = [tokens];
  const seen = new Set();
  const result = [];
  for (const t of tokens) {
    if (!t || typeof t !== 'string') continue;
    const trimmed = t.trim();
    if (!trimmed) continue;
    if (seen.has(trimmed)) continue;
    seen.add(trimmed);
    result.push(trimmed);
  }
  return result;
}

/**
 * Send to a single token (uses .send()).
 */
async function sendToSingleToken(token, payload) {
  const messaging = getMessaging();
  const base = buildMessage(payload);
  const msg = { token, ...base };

  try {
    const messageId = await messaging.send(msg);
    return { success: true, messageId, token };
  } catch (err) {
    return {
      success: false,
      token,
      errorCode: err?.code || err?.errorInfo?.code || 'unknown',
      errorMessage: err?.message || String(err),
    };
  }
}

/**
 * Send to many tokens using sendEachForMulticast (max 500 per call).
 * Automatically batches larger lists.
 */
async function sendToManyTokens(tokens, payload, tokenMetaMap = new Map()) {
  const messaging = getMessaging();
  const base = buildMessage(payload);
  const normalized = normalizeTokens(tokens);

  const results = {
    total: normalized.length,
    success: 0,
    failure: 0,
    invalidTokens: 0,
    successes: [],
    failures: [],
  };

  if (normalized.length === 0) {
    return results;
  }

  const BATCH_SIZE = 500;
  for (let i = 0; i < normalized.length; i += BATCH_SIZE) {
    const batch = normalized.slice(i, i + BATCH_SIZE);
    const multicast = {
      tokens: batch,
      ...base,
    };

    let response;
    try {
      if (typeof messaging.sendEachForMulticast === 'function') {
        response = await messaging.sendEachForMulticast(multicast);
      } else if (typeof messaging.sendMulticast === 'function') {
        response = await messaging.sendMulticast(multicast);
      } else {
        // Fallback: send individually
        response = { responses: [], successCount: 0, failureCount: 0 };
        for (const t of batch) {
          const r = await sendToSingleToken(t, payload);
          if (r.success) {
            response.responses.push({ success: true, messageId: r.messageId });
            response.successCount++;
          } else {
            response.responses.push({
              success: false,
              error: { code: r.errorCode, message: r.errorMessage },
            });
            response.failureCount++;
          }
        }
      }
    } catch (err) {
      // Entire batch failed
      logger.error(`[directPushSender] batch send failed: ${err.message}`);
      for (const t of batch) {
        const meta = tokenMetaMap.get(t) || {};
        results.failure++;
        results.failures.push({
          token: t,
          tokenPreview: t.substring(0, 20) + '...',
          recipientId: meta.recipientId || null,
          recipientType: meta.recipientType || 'unknown',
          recipientLabel: meta.recipientLabel || '',
          errorCode: err?.code || 'batch_failure',
          errorMessage: err?.message || String(err),
        });
      }
      continue;
    }

    response.responses.forEach((resp, idx) => {
      const token = batch[idx];
      const meta = tokenMetaMap.get(token) || {};

      if (resp.success) {
        results.success++;
        results.successes.push({
          tokenPreview: token.substring(0, 20) + '...',
          recipientId: meta.recipientId || null,
          recipientType: meta.recipientType || 'unknown',
          recipientLabel: meta.recipientLabel || '',
          messageId: resp.messageId || '',
        });
      } else {
        results.failure++;
        const code = resp.error?.code || resp.error?.errorInfo?.code || 'unknown';
        const invalidCodes = [
          'messaging/invalid-registration-token',
          'messaging/registration-token-not-registered',
          'messaging/invalid-argument',
        ];
        if (invalidCodes.includes(code)) results.invalidTokens++;

        results.failures.push({
          token,
          tokenPreview: token.substring(0, 20) + '...',
          recipientId: meta.recipientId || null,
          recipientType: meta.recipientType || 'unknown',
          recipientLabel: meta.recipientLabel || '',
          errorCode: code,
          errorMessage: resp.error?.message || 'Unknown error',
        });
      }
    });
  }

  return results;
}

module.exports = {
  sendToSingleToken,
  sendToManyTokens,
  buildMessage,
  normalizeTokens,
  getMessaging,
};