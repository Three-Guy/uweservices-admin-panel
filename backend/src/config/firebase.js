// backend/src/config/firebase.js
const admin = require('firebase-admin');

let adminWebApp = null;
let providerApp = null;

/**
 * Find cert() function — works for firebase-admin v10, v11, v12+
 */
function getCertFunction() {
  // v12+ style: admin.cert directly
  if (typeof admin.cert === 'function') {
    return admin.cert.bind(admin);
  }
  // v11 and below: admin.credential.cert
  if (admin.credential && typeof admin.credential.cert === 'function') {
    return admin.credential.cert.bind(admin.credential);
  }
  // Try named import
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
    loadServiceAccountFromFile('../uwe-services-web-firebase-adminsdk.json') ||
    loadServiceAccountFromFile('./uwe-services-web-firebase-adminsdk.json');

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

async function sendAdminFcmNotification(token, title, body, data = {}) {
  if (!adminWebApp) return { success: false, error: 'Admin Firebase not initialized' };
  try {
    let messaging;
    try {
      const { getMessaging } = require('firebase-admin/messaging');
      messaging = getMessaging(adminWebApp);
    } catch (e) {
      messaging = admin.messaging(adminWebApp);
    }
    const message = {
      token,
      notification: { title, body },
      data: Object.fromEntries(
        Object.entries(data || {}).map(([k, v]) => [k, String(v == null ? '' : v)])
      ),
      webpush: {
        notification: {
          icon: '/logo192.png',
          badge: '/badge72.png',
          tag: (data && data.bookingId) || 'admin-alert',
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
  if (!providerApp) return { success: false, error: 'Provider Firebase not initialized' };
  try {
    let messaging;
    try {
      const { getMessaging } = require('firebase-admin/messaging');
      messaging = getMessaging(providerApp);
    } catch (e) {
      messaging = admin.messaging(providerApp);
    }
    const message = {
      token,
      notification: { title, body },
      data: Object.fromEntries(
        Object.entries(data || {}).map(([k, v]) => [k, String(v == null ? '' : v)])
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