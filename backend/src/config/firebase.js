// backend/src/config/firebase.js
const admin = require('firebase-admin');

let adminWebApp = null;
let providerApp = null;

function parseServiceAccount(raw) {
  if (!raw) return null;
  try {
    // If already an object, return it
    if (typeof raw === 'object') return raw;
    // Try parsing as JSON string
    const parsed = JSON.parse(raw);
    if (parsed && parsed.type === 'service_account') return parsed;
    // Maybe it's a JSON string wrapped in quotes
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
    const cleaned = base64Str.replace(/\s+/g, '').trim();
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

  // Check if it looks like base64 (no curly braces)
  const trimmed = raw.trim();
  if (!trimmed.startsWith('{')) {
    console.info(`✅ Loading Firebase credentials from ${envKey} (base64)`);
    return decodeBase64ServiceAccount(trimmed);
  }

  // Otherwise treat as raw JSON
  console.info(`✅ Loading Firebase credentials from ${envKey} (raw JSON)`);
  return parseServiceAccount(trimmed);
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
  // ─── ADMIN WEB FIREBASE (uwe-services-web) ───
  let adminServiceAccount =
    loadServiceAccountFromEnv('ADMIN_FIREBASE_SERVICE_ACCOUNT_BASE64') ||
    loadServiceAccountFromEnv('ADMIN_FIREBASE_SERVICE_ACCOUNT_JSON') ||
    loadServiceAccountFromFile('../uwe-services-web-firebase-adminsdk.json') ||
    loadServiceAccountFromFile('./uwe-services-web-firebase-adminsdk.json');

  if (adminServiceAccount && adminServiceAccount.project_id) {
    try {
      // Make sure firebase-admin credential module is available
      if (!admin.credential || typeof admin.credential.cert !== 'function') {
        console.error('❌ firebase-admin credential.cert is not available. Check firebase-admin installation.');
        console.error('   admin keys:', Object.keys(admin));
      } else {
        adminWebApp = admin.initializeApp(
          {
            credential: admin.credential.cert(adminServiceAccount),
          },
          'adminWeb'
        );
        console.info(`✅ Admin Web Firebase initialized (project: ${adminServiceAccount.project_id})`);
      }
    } catch (e) {
      if (e.code === 'app/duplicate-app') {
        adminWebApp = admin.app('adminWeb');
        console.info('✅ Admin Web Firebase already initialized');
      } else {
        console.error('❌ Admin Web Firebase init failed:', e.message);
      }
    }
  } else {
    console.warn('⚠️  No Admin Web Firebase credentials found. Admin FCM disabled.');
    if (adminServiceAccount) {
      console.warn('   Credentials loaded but missing project_id. Keys:', Object.keys(adminServiceAccount));
    }
  }

  // ─── PROVIDER FIREBASE (serviceproviderapp-b7767) ───
  let providerServiceAccount =
    loadServiceAccountFromEnv('PROVIDER_FIREBASE_SERVICE_ACCOUNT_BASE64') ||
    loadServiceAccountFromEnv('PROVIDER_FIREBASE_SERVICE_ACCOUNT_JSON') ||
    loadServiceAccountFromFile('../serviceproviderapp-firebase-adminsdk.json') ||
    loadServiceAccountFromFile('./serviceproviderapp-firebase-adminsdk.json');

  if (providerServiceAccount && providerServiceAccount.project_id) {
    try {
      if (admin.credential && typeof admin.credential.cert === 'function') {
        providerApp = admin.initializeApp(
          {
            credential: admin.credential.cert(providerServiceAccount),
          },
          'providerApp'
        );
        console.info(`✅ Provider Firebase initialized (project: ${providerServiceAccount.project_id})`);
      }
    } catch (e) {
      if (e.code === 'app/duplicate-app') {
        providerApp = admin.app('providerApp');
      } else {
        console.error('❌ Provider Firebase init failed:', e.message);
      }
    }
  } else {
    console.warn('⚠️  No Provider Firebase credentials found. Provider FCM disabled.');
  }
}

function isAdminWebFirebaseReady() {
  return !!adminWebApp;
}

function isProviderFirebaseReady() {
  return !!providerApp;
}

async function sendAdminFcmNotification(token, title, body, data = {}) {
  if (!adminWebApp) {
    console.warn('⚠️ Admin FCM not ready, skipping push');
    return { success: false, error: 'Admin Firebase not initialized' };
  }
  try {
    const messaging = admin.messaging(adminWebApp);
    const message = {
      token,
      notification: { title, body },
      data: Object.fromEntries(
        Object.entries(data).map(([k, v]) => [k, String(v)])
      ),
      webpush: {
        notification: {
          icon: '/logo192.png',
          badge: '/badge72.png',
          tag: data.bookingId || 'admin-alert',
        },
      },
    };
    const response = await messaging.send(message);
    return { success: true, messageId: response };
  } catch (e) {
    console.error('❌ Admin FCM send failed:', e.message);
    return { success: false, error: e.message };
  }
}

async function sendProviderFcmNotification(token, title, body, data = {}) {
  if (!providerApp) {
    console.warn('⚠️ Provider FCM not ready, skipping push');
    return { success: false, error: 'Provider Firebase not initialized' };
  }
  try {
    const messaging = admin.messaging(providerApp);
    const message = {
      token,
      notification: { title, body },
      data: Object.fromEntries(
        Object.entries(data).map(([k, v]) => [k, String(v)])
      ),
    };
    const response = await messaging.send(message);
    return { success: true, messageId: response };
  } catch (e) {
    console.error('❌ Provider FCM send failed:', e.message);
    return { success: false, error: e.message };
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
};