// backend/src/services/directPushSender.js
// 🚀 Direct Push Sender — multi-strategy FCM delivery with full error capture

const firebaseConfig = require('../config/firebase');

/**
 * Get the best available Firebase Messaging instance.
 * Tries in order: Provider → AdminWeb → default admin SDK
 */
function getMessaging() {
  const strategies = [
    { name: 'providerMessaging', fn: 'getProviderMessaging' },
    { name: 'adminWebMessaging', fn: 'getAdminWebMessaging' },
    { name: 'defaultMessaging', fn: 'getMessaging' },
  ];

  for (const s of strategies) {
    try {
      if (typeof firebaseConfig[s.fn] === 'function') {
        const msg = firebaseConfig[s.fn]();
        if (msg && typeof msg.send === 'function') {
          console.log(`[DirectPushSender] ✅ Using ${s.name}`);
          return { messaging: msg, source: s.name };
        }
      }
    } catch (e) {
      console.warn(`[DirectPushSender] ⚠️ ${s.name} unavailable: ${e.message}`);
    }
  }

  // Last-resort: direct admin SDK
  try {
    const admin = require('firebase-admin');
    if (admin.apps && admin.apps.length > 0) {
      const msg = admin.messaging();
      if (msg && typeof msg.send === 'function') {
        console.log('[DirectPushSender] ✅ Using firebase-admin default app');
        return { messaging: msg, source: 'admin-default' };
      }
    }
  } catch (e) {
    console.error('[DirectPushSender] ❌ firebase-admin fallback failed:', e.message);
  }

  throw new Error('No Firebase Messaging instance available. Check firebase initialization.');
}

/**
 * Normalize an array of tokens: trim, dedupe, filter non-strings/empty
 */
function normalizeTokens(tokens) {
  if (!Array.isArray(tokens)) tokens = [tokens];
  const clean = [];
  const seen = new Set();
  for (const t of tokens) {
    if (!t || typeof t !== 'string') continue;
    const trimmed = t.trim();
    if (!trimmed) continue;
    if (seen.has(trimmed)) continue;
    seen.add(trimmed);
    clean.push(trimmed);
  }
  return clean;
}

/**
 * Convert all data payload values to strings (FCM requirement)
 */
function stringifyData(data) {
  if (!data || typeof data !== 'object') return {};
  const out = {};
  for (const [k, v] of Object.entries(data)) {
    if (v === null || v === undefined) continue;
    if (typeof v === 'string') out[k] = v;
    else if (typeof v === 'number' || typeof v === 'boolean') out[k] = String(v);
    else {
      try { out[k] = JSON.stringify(v); } catch { out[k] = String(v); }
    }
  }
  return out;
}

/**
 * Build the FCM message payload for a single token
 */
function buildMessage({ token, title, body, imageUrl, clickAction, customData }) {
  const dataPayload = stringifyData({
    ...(customData || {}),
    ...(clickAction ? { click_action: clickAction, actionUrl: clickAction } : {}),
    sentAt: new Date().toISOString(),
    source: 'admin-direct-push',
  });

  const message = {
    token,
    notification: {
      title: String(title || ''),
      body: String(body || ''),
      ...(imageUrl ? { imageUrl: String(imageUrl) } : {}),
    },
    data: dataPayload,
    android: {
      priority: 'high',
      notification: {
        channelId: 'default',
        sound: 'default',
        priority: 'high',
        ...(imageUrl ? { imageUrl: String(imageUrl) } : {}),
        ...(clickAction ? { clickAction: 'FLUTTER_NOTIFICATION_CLICK' } : {}),
      },
    },
    apns: {
      headers: { 'apns-priority': '10' },
      payload: {
        aps: {
          alert: {
            title: String(title || ''),
            body: String(body || ''),
          },
          sound: 'default',
          badge: 1,
          'mutable-content': 1,
          'content-available': 1,
        },
      },
      ...(imageUrl ? { fcm_options: { image: String(imageUrl) } } : {}),
    },
    webpush: {
      headers: { Urgency: 'high' },
      notification: {
        title: String(title || ''),
        body: String(body || ''),
        ...(imageUrl ? { icon: String(imageUrl), image: String(imageUrl) } : {}),
        ...(clickAction ? { click_action: clickAction } : {}),
      },
      ...(clickAction ? { fcmOptions: { link: clickAction } } : {}),
    },
  };

  return message;
}

/**
 * Check if an error means the token is invalid/unregistered
 */
function isInvalidTokenError(err) {
  if (!err) return false;
  const code = err.code || err.errorInfo?.code || '';
  const msg = (err.message || '').toLowerCase();
  return (
    code === 'messaging/invalid-registration-token' ||
    code === 'messaging/registration-token-not-registered' ||
    code === 'messaging/invalid-argument' ||
    msg.includes('invalid registration') ||
    msg.includes('not registered') ||
    msg.includes('invalid-registration-token') ||
    msg.includes('registration-token-not-registered') ||
    msg.includes('requested entity was not found')
  );
}

/**
 * Extract a clean, detailed error payload from a Firebase error
 */
function extractErrorDetails(err) {
  if (!err) return { code: 'unknown', message: 'Unknown error' };
  return {
    code: err.code || err.errorInfo?.code || 'unknown',
    message: err.message || err.errorInfo?.message || String(err),
    details: err.errorInfo || null,
    stack: process.env.NODE_ENV !== 'production' ? err.stack : undefined,
  };
}

/**
 * Send to a single token — returns { success, messageId?, error? }
 */
async function sendToSingleToken(token, { title, body, imageUrl, clickAction, customData }) {
  const cleanToken = (token || '').trim();
  if (!cleanToken) {
    return { success: false, token: '', error: { code: 'empty-token', message: 'Token is empty' } };
  }

  let messaging;
  try {
    const result = getMessaging();
    messaging = result.messaging;
  } catch (e) {
    console.error('[DirectPushSender] ❌ No messaging available:', e.message);
    return {
      success: false,
      token: cleanToken,
      error: { code: 'messaging-unavailable', message: e.message },
    };
  }

  const message = buildMessage({
    token: cleanToken,
    title, body, imageUrl, clickAction, customData,
  });

  console.log(`[DirectPushSender] 📤 Sending to token: ${cleanToken.substring(0, 30)}...`);
  console.log(`[DirectPushSender] 📦 Payload:`, JSON.stringify({
    title, body, imageUrl: imageUrl || null, clickAction: clickAction || null,
  }));

  try {
    const messageId = await messaging.send(message);
    console.log(`[DirectPushSender] ✅ SUCCESS — messageId: ${messageId}`);
    return { success: true, token: cleanToken, messageId };
  } catch (err) {
    const details = extractErrorDetails(err);
    const invalid = isInvalidTokenError(err);
    console.error(`[DirectPushSender] ❌ FAILED (invalid=${invalid}):`, JSON.stringify(details, null, 2));
    return {
      success: false,
      token: cleanToken,
      error: details,
      invalidToken: invalid,
    };
  }
}

/**
 * Send to multiple tokens — processes in batches of 500 using sendEach
 */
async function sendToManyTokens(tokens, payload) {
  const clean = normalizeTokens(tokens);
  const result = {
    total: clean.length,
    successCount: 0,
    failureCount: 0,
    invalidTokenCount: 0,
    successes: [],
    failures: [],
  };

  if (clean.length === 0) {
    console.warn('[DirectPushSender] ⚠️  No valid tokens to send to');
    return result;
  }

  let messaging;
  try {
    const r = getMessaging();
    messaging = r.messaging;
  } catch (e) {
    console.error('[DirectPushSender] ❌ Messaging unavailable:', e.message);
    for (const t of clean) {
      result.failureCount++;
      result.failures.push({
        token: t,
        error: { code: 'messaging-unavailable', message: e.message },
      });
    }
    return result;
  }

  const BATCH = 500;
  console.log(`[DirectPushSender] 📤 Bulk send to ${clean.length} tokens in ${Math.ceil(clean.length / BATCH)} batches`);

  for (let i = 0; i < clean.length; i += BATCH) {
    const batchTokens = clean.slice(i, i + BATCH);
    const messages = batchTokens.map(token => buildMessage({ token, ...payload }));

    try {
      // Try sendEach first (modern)
      let response;
      if (typeof messaging.sendEach === 'function') {
        response = await messaging.sendEach(messages);
      } else if (typeof messaging.sendAll === 'function') {
        response = await messaging.sendAll(messages);
      } else {
        // Fallback: send one-by-one
        response = { responses: [] };
        for (const m of messages) {
          try {
            const id = await messaging.send(m);
            response.responses.push({ success: true, messageId: id });
          } catch (e) {
            response.responses.push({ success: false, error: e });
          }
        }
      }

      response.responses.forEach((r, idx) => {
        const token = batchTokens[idx];
        if (r.success) {
          result.successCount++;
          result.successes.push({ token, messageId: r.messageId });
        } else {
          const details = extractErrorDetails(r.error);
          const invalid = isInvalidTokenError(r.error);
          if (invalid) result.invalidTokenCount++;
          result.failureCount++;
          result.failures.push({ token, error: details, invalidToken: invalid });
        }
      });

      console.log(`[DirectPushSender] Batch ${Math.floor(i / BATCH) + 1}: ${response.responses.filter(r => r.success).length}/${batchTokens.length} succeeded`);
    } catch (err) {
      console.error('[DirectPushSender] ❌ Batch send threw:', err.message);
      for (const t of batchTokens) {
        result.failureCount++;
        result.failures.push({ token: t, error: extractErrorDetails(err) });
      }
    }
  }

  console.log(`[DirectPushSender] ✅ Final: ${result.successCount} success, ${result.failureCount} failed, ${result.invalidTokenCount} invalid`);
  return result;
}

module.exports = {
  sendToSingleToken,
  sendToManyTokens,
  buildMessage,
  normalizeTokens,
  getMessaging,
  isInvalidTokenError,
  extractErrorDetails,
};