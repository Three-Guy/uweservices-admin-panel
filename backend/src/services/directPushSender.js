// backend/src/services/directPushSender.js
// 🚀 Direct Push Sender — multi-project retry with full error capture
// Tries ALL available Firebase projects until one succeeds

const firebaseConfig = require('../config/firebase');

/**
 * Get ALL available Firebase Messaging instances.
 * Order matters: user app first (most tokens belong there),
 * then provider, then admin web.
 */
function getAllMessagingInstances() {
  const instances = [];

  // 🆕 User app FIRST — user tokens belong to myapp-9d672
  try {
    if (typeof firebaseConfig.getUserMessaging === 'function' && firebaseConfig.isUserFirebaseReady && firebaseConfig.isUserFirebaseReady()) {
      const msg = firebaseConfig.getUserMessaging();
      if (msg && typeof msg.send === 'function') {
        instances.push({ name: 'userMessaging', messaging: msg });
      }
    }
  } catch (e) {
    console.warn(`[DirectPushSender] ⚠️ userMessaging unavailable: ${e.message}`);
  }

  // Provider app
  try {
    if (typeof firebaseConfig.getProviderMessaging === 'function' && firebaseConfig.isProviderFirebaseReady()) {
      const msg = firebaseConfig.getProviderMessaging();
      if (msg && typeof msg.send === 'function') {
        if (!instances.some(i => i.messaging === msg)) {
          instances.push({ name: 'providerMessaging', messaging: msg });
        }
      }
    }
  } catch (e) {
    console.warn(`[DirectPushSender] ⚠️ providerMessaging unavailable: ${e.message}`);
  }

  // Admin web app
  try {
    if (typeof firebaseConfig.getAdminWebMessaging === 'function' && firebaseConfig.isAdminWebFirebaseReady()) {
      const msg = firebaseConfig.getAdminWebMessaging();
      if (msg && typeof msg.send === 'function') {
        if (!instances.some(i => i.messaging === msg)) {
          instances.push({ name: 'adminWebMessaging', messaging: msg });
        }
      }
    }
  } catch (e) {
    console.warn(`[DirectPushSender] ⚠️ adminWebMessaging unavailable: ${e.message}`);
  }

  // Fallback: scan all admin SDK apps
  try {
    const admin = require('firebase-admin');
    if (admin.apps && admin.apps.length > 0) {
      for (const app of admin.apps) {
        if (!app) continue;
        const name = `admin-app-${app.name}`;
        if (instances.some(i => i.name === name)) continue;
        try {
          const msg = app.messaging();
          if (msg && typeof msg.send === 'function') {
            if (!instances.some(i => i.messaging === msg)) {
              instances.push({ name, messaging: msg });
            }
          }
        } catch (e) {}
      }
    }
  } catch (e) {}

  console.log(`[DirectPushSender] 📋 ${instances.length} messaging instance(s): ${instances.map(i => i.name).join(', ')}`);
  return instances;
}

/**
 * Get best single messaging instance (legacy compat)
 */
function getMessaging() {
  const all = getAllMessagingInstances();
  if (all.length === 0) {
    throw new Error('No Firebase Messaging instance available');
  }
  return { messaging: all[0].messaging, source: all[0].name };
}

/**
 * Normalize tokens
 */
function normalizeTokens(tokens) {
  if (!Array.isArray(tokens)) tokens = [tokens];
  const clean = [];
  const seen = new Set();
  for (const t of tokens) {
    if (!t || typeof t !== 'string') continue;
    const trimmed = t.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    clean.push(trimmed);
  }
  return clean;
}

/**
 * Stringify data payload values (FCM requirement)
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
 * Build FCM message
 */
function buildMessage({ token, title, body, imageUrl, clickAction, customData }) {
  const dataPayload = stringifyData({
    ...(customData || {}),
    ...(clickAction ? { click_action: clickAction, actionUrl: clickAction } : {}),
    sentAt: new Date().toISOString(),
    source: 'admin-direct-push',
  });

  return {
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
          alert: { title: String(title || ''), body: String(body || '') },
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
}

/**
 * Check if error means invalid/unregistered token
 */
function isInvalidTokenError(err) {
  if (!err) return false;
  const code = err.code || err.errorInfo?.code || '';
  const msg = (err.message || '').toLowerCase();
  return (
    code === 'messaging/invalid-registration-token' ||
    code === 'messaging/registration-token-not-registered' ||
    code === 'messaging/invalid-argument' ||
    msg.includes('not registered') ||
    msg.includes('notregistered') ||
    msg.includes('invalid registration') ||
    msg.includes('requested entity was not found')
  );
}

/**
 * Extract error details
 */
function extractErrorDetails(err) {
  if (!err) return { code: 'unknown', message: 'Unknown error' };
  return {
    code: err.code || err.errorInfo?.code || 'unknown',
    message: err.message || err.errorInfo?.message || String(err),
    details: err.errorInfo || null,
  };
}

/**
 * 🚀 Send to single token — tries ALL Firebase projects!
 */
async function sendToSingleToken(token, { title, body, imageUrl, clickAction, customData }) {
  const cleanToken = (token || '').trim();
  if (!cleanToken) {
    return { success: false, token: '', error: { code: 'empty-token', message: 'Token is empty' } };
  }

  const allInstances = getAllMessagingInstances();
  if (allInstances.length === 0) {
    return {
      success: false,
      token: cleanToken,
      error: { code: 'messaging-unavailable', message: 'No Firebase Messaging instance available' },
    };
  }

  const message = buildMessage({ token: cleanToken, title, body, imageUrl, clickAction, customData });

  console.log(`[DirectPushSender] 📤 Sending to: ${cleanToken.substring(0, 30)}...`);
  console.log(`[DirectPushSender] 📦 Title: "${title}", Body: "${body}"`);
  console.log(`[DirectPushSender] 🔄 Trying ${allInstances.length} project(s): ${allInstances.map(i => i.name).join(' → ')}`);

  const errors = [];

  for (const inst of allInstances) {
    console.log(`[DirectPushSender] 🔍 Trying ${inst.name}...`);
    try {
      const messageId = await inst.messaging.send(message);
      console.log(`[DirectPushSender] ✅ SUCCESS via ${inst.name}! messageId: ${messageId}`);
      return { success: true, token: cleanToken, messageId, firebaseProject: inst.name };
    } catch (err) {
      const details = extractErrorDetails(err);
      const invalid = isInvalidTokenError(err);
      console.error(`[DirectPushSender] ❌ ${inst.name} failed: ${details.code} — ${details.message}`);
      errors.push({ project: inst.name, ...details, invalidToken: invalid });
      continue;
    }
  }

  const lastError = errors[errors.length - 1] || { code: 'unknown', message: 'All failed' };
  console.error(`[DirectPushSender] ❌ ALL ${allInstances.length} projects failed!`);

  return {
    success: false,
    token: cleanToken,
    error: {
      ...lastError,
      allErrors: errors,
      message: `Failed on all ${allInstances.length} projects. Last: ${lastError.message}`,
    },
    invalidToken: errors.every(e => e.invalidToken),
  };
}

/**
 * Send to multiple tokens
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

  if (clean.length === 0) return result;

  const allInstances = getAllMessagingInstances();
  if (allInstances.length === 0) {
    for (const t of clean) {
      result.failureCount++;
      result.failures.push({ token: t, error: { code: 'messaging-unavailable', message: 'No Firebase instance' } });
    }
    return result;
  }

  const BATCH = 500;
  console.log(`[DirectPushSender] 📤 Bulk: ${clean.length} tokens, ${allInstances.length} project(s)`);

  for (let i = 0; i < clean.length; i += BATCH) {
    const batchTokens = clean.slice(i, i + BATCH);
    const messages = batchTokens.map(token => buildMessage({ token, ...payload }));
    let batchDone = false;

    for (const inst of allInstances) {
      if (batchDone) break;
      console.log(`[DirectPushSender] 🔍 Batch ${Math.floor(i / BATCH) + 1} via ${inst.name}...`);

      try {
        let response;
        if (typeof inst.messaging.sendEach === 'function') {
          response = await inst.messaging.sendEach(messages);
        } else if (typeof inst.messaging.sendAll === 'function') {
          response = await inst.messaging.sendAll(messages);
        } else {
          response = { responses: [] };
          for (const m of messages) {
            try {
              const id = await inst.messaging.send(m);
              response.responses.push({ success: true, messageId: id });
            } catch (e) {
              response.responses.push({ success: false, error: e });
            }
          }
        }

        let successes = 0;
        response.responses.forEach((r, idx) => {
          const token = batchTokens[idx];
          if (r.success) {
            result.successCount++;
            result.successes.push({ token, messageId: r.messageId, firebaseProject: inst.name });
            successes++;
          } else {
            const details = extractErrorDetails(r.error);
            const invalid = isInvalidTokenError(r.error);
            if (invalid) result.invalidTokenCount++;
            result.failureCount++;
            result.failures.push({ token, error: details, invalidToken: invalid });
          }
        });

        console.log(`[DirectPushSender] ${inst.name}: ${successes}/${batchTokens.length} succeeded`);
        if (successes > 0) batchDone = true;
      } catch (err) {
        console.error(`[DirectPushSender] ❌ ${inst.name} batch error:`, err.message);
        continue;
      }
    }

    if (!batchDone) {
      for (const t of batchTokens) {
        if (!result.successes.some(s => s.token === t) && !result.failures.some(f => f.token === t)) {
          result.failureCount++;
          result.failures.push({ token: t, error: { code: 'all-projects-failed', message: 'All projects failed' } });
        }
      }
    }
  }

  console.log(`[DirectPushSender] ✅ Final: ${result.successCount} ok, ${result.failureCount} fail, ${result.invalidTokenCount} invalid`);
  return result;
}

module.exports = {
  sendToSingleToken,
  sendToManyTokens,
  buildMessage,
  normalizeTokens,
  getMessaging,
  getAllMessagingInstances,
  isInvalidTokenError,
  extractErrorDetails,
};