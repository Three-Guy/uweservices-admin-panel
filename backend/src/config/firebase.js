// backend/src/config/firebase.js
const admin = require('firebase-admin');

let adminWebApp = null;
let providerApp = null;

/**
 * Find cert() function — works for firebase-admin v10, v11, v12, v13, v14+
 */
function getCertFunction() {
  if (typeof admin.cert === 'function') {
    return admin.cert.bind(admin);
  }
  if (admin.credential && typeof admin.credential.cert === 'function') {
    return admin.credential.cert.bind(admin.credential);
  }
  try {
    const appModule = require('firebase-admin/app');
    if (typeof appModule.cert === 'function') return appModule.cert;
  } catch (e) {}
  return null;
}

function getInitializeAppFunction() {
  try {
    const appModule = require('firebase-admin/app');
    if (typeof appModule.initializeApp === 'function') {
      return {
        initializeApp: appModule.initializeApp,
        getApp: appModule.getApp,
      };
    }
  } catch (e) {}
  return {
    initializeApp: admin.initializeApp.bind(admin),
    getApp: admin.getApp ? admin.getApp.bind(admin) : (admin.app ? admin.app.bind(admin) : null),
  };
}

function parseServiceAccount(raw) {
  if (!raw) return null;
  try {
    if (typeof raw === 'object') return raw;
    const parsed = JSON.parse(raw);
    if (parsed && parsed.type === 'service_account') return parsed;
    if (typeof parsed === 'string') return JSON.parse(parsed);
    return parsed;
  } catch (e) {
    console.error('❌ Failed to parse service account JSON:', e.message);
    return null;
  }
}

function decodeBase64ServiceAccount(base64Str) {
  if (!base64Str) return null;
  try {
    let cleaned = base64Str.trim();
    if ((cleaned.startsWith('"') && cleaned.endsWith('"')) ||
        (cleaned.startsWith("'") && cleaned.endsWith("'"))) {
      cleaned = cleaned.slice(1, -1);
    }
    cleaned = cleaned.replace(/\s+/g, '').trim();
    const jsonStr = Buffer.from(cleaned, 'base64').toString('utf8');
    return parseServiceAccount(jsonStr);
  } catch (e) {
    console.error('❌ Failed to decode base64 service account:', e.message);
    return null;
  }
}

function loadServiceAccountFromEnv(envKey) {
  const raw = process.env[envKey];
  if (!raw) return null;
  const trimmed = raw.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('"{')) {
    console.info(`✅ Loading Firebase credentials from ${envKey} (raw JSON)`);
    let cleaned = trimmed;
    if (cleaned.startsWith('"') && cleaned.endsWith('"')) cleaned = cleaned.slice(1, -1);
    return parseServiceAccount(cleaned);
  }
  console.info(`✅ Loading Firebase credentials from ${envKey} (base64)`);
  return decodeBase64ServiceAccount(trimmed);
}

function loadServiceAccountFromFile(filePath) {
  try {
    const path = require('path');
    const fs = require('fs');
    const fullPath = path.resolve(__dirname, filePath);
    if (!fs.existsSync(fullPath)) return null;
    const raw = fs.readFileSync(fullPath, 'utf8');
    console.info(`✅ Loading Firebase credentials from file: ${filePath}`);
    return parseServiceAccount(raw);
  } catch (e) {
    console.error(`❌ Failed to load Firebase file ${filePath}:`, e.message);
    return null;
  }
}

function initializeFirebase() {
  const certFn = getCertFunction();
  const { initializeApp, getApp } = getInitializeAppFunction();

  if (!certFn) {
    console.error('❌ Cannot find Firebase cert() function.');
    console.error('   firebase-admin version:', admin.SDK_VERSION || 'unknown');
    console.error('   Available admin keys:', Object.keys(admin));
    return;
  }

  if (typeof initializeApp !== 'function') {
    console.error('❌ Cannot find Firebase initializeApp() function.');
    return;
  }

  console.info(`✅ Firebase SDK ready — version: ${admin.SDK_VERSION || 'unknown'}`);

  // ─── ADMIN WEB FIREBASE ───
  let adminServiceAccount =
    loadServiceAccountFromEnv('ADMIN_FIREBASE_SERVICE_ACCOUNT_BASE64') ||
    loadServiceAccountFromEnv('ADMIN_FIREBASE_SERVICE_ACCOUNT_JSON') ||
    loadServiceAccountFromEnv('FIREBASE_SERVICE_ACCOUNT_BASE64') ||
    loadServiceAccountFromEnv('FIREBASE_SERVICE_ACCOUNT') ||
    loadServiceAccountFromFile('../uwe-services-web-firebase-adminsdk.json') ||
    loadServiceAccountFromFile('./uwe-services-web-firebase-adminsdk.json') ||
    loadServiceAccountFromFile('../../src/config/uwe-services-web-firebase-adminsdk.json');

  if (adminServiceAccount && adminServiceAccount.project_id) {
    try {
      adminWebApp = initializeApp(
        { credential: certFn(adminServiceAccount) },
        'adminWeb'
      );
      console.info(`✅ Admin Web Firebase initialized (project: ${adminServiceAccount.project_id})`);
    } catch (e) {
      if (e.code === 'app/duplicate-app' && getApp) {
        try {
          adminWebApp = getApp('adminWeb');
          console.info('✅ Admin Web Firebase already initialized (reused)');
        } catch {}
      } else {
        console.error('❌ Admin Web Firebase init failed:', e.message);
        console.error('   Stack:', e.stack);
      }
    }
  } else {
    console.warn('⚠️  No Admin Web Firebase credentials found. Admin FCM disabled.');
    if (adminServiceAccount) {
      console.warn('   Loaded but missing project_id. Keys:', Object.keys(adminServiceAccount));
    }
  }

  // ─── PROVIDER FIREBASE ───
  let providerServiceAccount =
    loadServiceAccountFromEnv('PROVIDER_FIREBASE_SERVICE_ACCOUNT_BASE64') ||
    loadServiceAccountFromEnv('PROVIDER_FIREBASE_SERVICE_ACCOUNT_JSON') ||
    loadServiceAccountFromFile('../serviceproviderapp-firebase-adminsdk.json') ||
    loadServiceAccountFromFile('./serviceproviderapp-firebase-adminsdk.json');

  if (providerServiceAccount && providerServiceAccount.project_id) {
    try {
      providerApp = initializeApp(
        { credential: certFn(providerServiceAccount) },
        'providerApp'
      );
      console.info(`✅ Provider Firebase initialized (project: ${providerServiceAccount.project_id})`);
    } catch (e) {
      if (e.code === 'app/duplicate-app' && getApp) {
        try { providerApp = getApp('providerApp'); } catch {}
      } else {
        console.error('❌ Provider Firebase init failed:', e.message);
      }
    }
  } else {
    console.warn('⚠️  No Provider Firebase credentials found. Provider FCM disabled.');
  }
}

function isAdminWebFirebaseReady() { return !!adminWebApp; }
function isProviderFirebaseReady() { return !!providerApp; }

function getAdminWebMessaging() {
  if (!adminWebApp) return null;
  try {
    const { getMessaging } = require('firebase-admin/messaging');
    return getMessaging(adminWebApp);
  } catch (e) {
    return admin.messaging(adminWebApp);
  }
}

function getProviderMessaging() {
  if (!providerApp) return null;
  try {
    const { getMessaging } = require('firebase-admin/messaging');
    return getMessaging(providerApp);
  } catch (e) {
    return admin.messaging(providerApp);
  }
}

/**
 * ✅ Send FCM notification to admin web client
 * 
 * SIGNATURE: sendAdminFcmNotification(token, title, body, data)
 * 
 * Includes:
 *   - notification: shows in system tray on mobile + desktop
 *   - webpush: customizes browser notification appearance
 *   - android: high priority for immediate delivery on Android
 *   - apns: high priority for immediate delivery on iOS
 *   - data: custom payload for SW handling
 */
async function sendAdminFcmNotification(token, title, body, data = {}) {
  if (!adminWebApp) {
    console.error('❌ [FCM] Admin Firebase not initialized');
    return { success: false, error: 'Admin Firebase not initialized' };
  }
  if (!token || typeof token !== 'string') {
    console.error('❌ [FCM] Invalid token:', typeof token);
    return { success: false, error: 'Invalid token (must be string)' };
  }

  // Ensure title and body are strings (NOT objects!)
  const safeTitle = typeof title === 'string' ? title : String(title || 'UWE Admin');
  const safeBody = typeof body === 'string' ? body : String(body || 'New notification');

  // Ensure all data values are strings (FCM requirement)
  const safeData = {};
  if (data && typeof data === 'object') {
    for (const [k, v] of Object.entries(data)) {
      safeData[k] = String(v == null ? '' : v);
    }
  }

  try {
    const messaging = getAdminWebMessaging();
    if (!messaging) {
      console.error('❌ [FCM] Admin messaging unavailable');
      return { success: false, error: 'Admin messaging unavailable' };
    }

    const message = {
      token,

      // ✅ notification field — triggers system tray on mobile + desktop
      notification: {
        title: safeTitle,
        body: safeBody,
        icon: '/favicon.ico',
      },

      // ✅ data field — for custom handling in SW
      data: safeData,

      // ✅ webpush — browser-specific notification customization
      webpush: {
        headers: {
          Urgency: 'high',
          TTL: '86400',
        },
        notification: {
          icon: '/favicon.ico',
          badge: '/favicon.ico',
          tag: safeData.bookingId || safeData.type || 'admin-alert',
          requireInteraction: true,
          renotify: true,
          silent: false,
          vibrate: [200, 100, 200],
          actions: [
            { action: 'view', title: 'View Booking' },
            { action: 'dismiss', title: 'Dismiss' },
          ],
        },
        fcmOptions: {
          link: safeData.actionUrl || '/',
        },
      },

      // ✅ android — high priority for immediate delivery
      android: {
        priority: 'high',
        ttl: 86400,
        notification: {
          title: safeTitle,
          body: safeBody,
          icon: 'ic_notification',
          color: '#1e40af',
          sound: 'default',
          clickAction: 'FLUTTER_NOTIFICATION_CLICK',
          channelId: 'admin_bookings',
          priority: 'max',
          defaultSound: true,
          defaultVibrateTimings: true,
        },
      },

      // ✅ apns — high priority for iOS
      apns: {
        headers: {
          'apns-priority': '10',
          'apns-push-type': 'alert',
        },
        payload: {
          aps: {
            alert: {
              title: safeTitle,
              body: safeBody,
            },
            sound: 'default',
            badge: 1,
            contentAvailable: true,
            mutableContent: true,
          },
        },
      },
    };

    console.log(`📱 [FCM] Sending to ${token.substring(0, 20)}... title: "${safeTitle}"`);
    const response = await messaging.send(message);
    console.log(`✅ [FCM] Sent successfully: ${response}`);
    return { success: true, messageId: response };
  } catch (e) {
    console.error(`❌ [FCM] Send failed for ${token.substring(0, 20)}...:`, e.message);
    console.error(`   Error code: ${e.code || 'unknown'}`);

    // If token is invalid, mark it for cleanup
    if (e.code === 'messaging/invalid-registration-token' ||
        e.code === 'messaging/registration-token-not-registered') {
      console.warn(`⚠️ [FCM] Token is invalid, should be removed from DB`);
      try {
        const AdminFcmToken = require('../models/AdminFcmToken');
        await AdminFcmToken.findOneAndUpdate(
          { fcmToken: token },
          { isActive: false, lastError: e.message, lastErrorAt: new Date() }
        );
        console.log(`✅ [FCM] Invalid token deactivated in DB`);
      } catch (cleanupErr) {
        console.error(`❌ [FCM] Token cleanup failed:`, cleanupErr.message);
      }
    }

    return { success: false, error: e.code || e.message };
  }
}

async function sendProviderFcmNotification(token, title, body, data = {}) {
  if (!providerApp) return { success: false, error: 'Provider Firebase not initialized' };
  if (!token || typeof token !== 'string') {
    return { success: false, error: 'Invalid token (must be string)' };
  }

  const safeTitle = typeof title === 'string' ? title : String(title || 'UWE Provider');
  const safeBody = typeof body === 'string' ? body : String(body || 'New notification');
  const safeData = {};
  if (data && typeof data === 'object') {
    for (const [k, v] of Object.entries(data)) {
      safeData[k] = String(v == null ? '' : v);
    }
  }

  try {
    const messaging = getProviderMessaging();
    if (!messaging) return { success: false, error: 'Provider messaging unavailable' };

    const message = {
      token,
      notification: { title: safeTitle, body: safeBody },
      data: safeData,
      android: {
        priority: 'high',
        notification: {
          title: safeTitle,
          body: safeBody,
          sound: 'default',
          channelId: 'provider_bookings',
          priority: 'max',
        },
      },
      apns: {
        headers: { 'apns-priority': '10' },
        payload: {
          aps: {
            alert: { title: safeTitle, body: safeBody },
            sound: 'default',
            badge: 1,
          },
        },
      },
    };

    const response = await messaging.send(message);
    return { success: true, messageId: response };
  } catch (e) {
    console.error('❌ Provider FCM send failed:', e.message);
    return { success: false, error: e.code || e.message };
  }
}

module.exports = {
  initializeFirebase,
  isAdminWebFirebaseReady,
  isProviderFirebaseReady,
  sendAdminFcmNotification,
  sendProviderFcmNotification,
  getAdminApp: () => adminWebApp,
  getProviderApp: () => providerApp,
  getAdminWebMessaging,
  getProviderMessaging,
};