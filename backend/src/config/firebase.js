// backend/src/config/firebase.js
const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');
const logger = require('../utils/logger');

let providerFirebaseApp = null;
let adminWebFirebaseApp = null;

/**
 * Load service account credentials
 * Priority: Base64 env > Raw JSON env > File path
 */
function loadServiceAccount(type) {
  const prefix = type === 'provider' ? 'PROVIDER_FIREBASE' : 'ADMIN_FIREBASE';
  const fileName = type === 'provider'
    ? 'serviceproviderapp-firebase-adminsdk.json'
    : 'uwe-services-web-firebase-adminsdk.json';

  // ── Method 1: Base64 encoded env var (RECOMMENDED for Render) ──
  const base64Env = process.env[`${prefix}_SERVICE_ACCOUNT_BASE64`];
  if (base64Env) {
    try {
      const decoded = Buffer.from(base64Env, 'base64').toString('utf-8');
      const parsed = JSON.parse(decoded);
      logger.info(`✅ ${type} Firebase credentials loaded from ${prefix}_SERVICE_ACCOUNT_BASE64`);
      return parsed;
    } catch (err) {
      logger.error(`❌ Failed to parse ${prefix}_SERVICE_ACCOUNT_BASE64: ${err.message}`);
    }
  }

  // ── Method 2: Raw JSON string env var ──
  const jsonEnv = process.env[`${prefix}_SERVICE_ACCOUNT`];
  if (jsonEnv) {
    try {
      const parsed = JSON.parse(jsonEnv);
      logger.info(`✅ ${type} Firebase credentials loaded from ${prefix}_SERVICE_ACCOUNT`);
      return parsed;
    } catch (err) {
      logger.error(`❌ Failed to parse ${prefix}_SERVICE_ACCOUNT: ${err.message}`);
    }
  }

  // ── Method 3: File path (local development only) ──
  const filePath = path.join(__dirname, fileName);
  if (fs.existsSync(filePath)) {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const parsed = JSON.parse(content);
      logger.info(`✅ ${type} Firebase credentials loaded from file: ${fileName}`);
      return parsed;
    } catch (err) {
      logger.error(`❌ Failed to read ${fileName}: ${err.message}`);
    }
  }

  return null;
}

/**
 * Initialize both Firebase apps
 */
function initializeFirebase() {
  // ── Initialize Admin Web Firebase (for admin panel push) ──
  if (!adminWebFirebaseApp) {
    const adminServiceAccount = loadServiceAccount('admin');

    if (adminServiceAccount) {
      try {
        adminWebFirebaseApp = admin.initializeApp(
          { credential: admin.credential.cert(adminServiceAccount) },
          'admin-web'
        );
        logger.info(`🔥 Admin Web Firebase initialized: ${adminServiceAccount.project_id}`);
      } catch (err) {
        if (err.code === 'app/duplicate-app') {
          adminWebFirebaseApp = admin.app('admin-web');
          logger.info('🔥 Admin Web Firebase (reusing existing app)');
        } else {
          logger.error(`❌ Admin Web Firebase init failed: ${err.message}`);
        }
      }
    } else {
      logger.warn('⚠️  No Admin Web Firebase credentials found (file or env). Admin FCM disabled.');
      logger.warn('   Set ADMIN_FIREBASE_SERVICE_ACCOUNT_BASE64 env var on Render to enable.');
    }
  }

  // ── Initialize Provider Firebase (for sending to providers — optional) ──
  if (!providerFirebaseApp) {
    const providerServiceAccount = loadServiceAccount('provider');

    if (providerServiceAccount) {
      try {
        providerFirebaseApp = admin.initializeApp(
          { credential: admin.credential.cert(providerServiceAccount) },
          'provider'
        );
        logger.info(`🔥 Provider Firebase initialized: ${providerServiceAccount.project_id}`);
      } catch (err) {
        if (err.code === 'app/duplicate-app') {
          providerFirebaseApp = admin.app('provider');
          logger.info('🔥 Provider Firebase (reusing existing app)');
        } else {
          logger.error(`❌ Provider Firebase init failed: ${err.message}`);
        }
      }
    } else {
      logger.warn('⚠️  No Provider Firebase credentials found (file or env). Provider FCM disabled.');
    }
  }

  return { adminWebFirebaseApp, providerFirebaseApp };
}

/**
 * Check if Admin Web Firebase is ready
 */
function isAdminWebFirebaseReady() {
  return adminWebFirebaseApp !== null;
}

/**
 * Check if Provider Firebase is ready
 */
function isProviderFirebaseReady() {
  return providerFirebaseApp !== null;
}

/**
 * Get Admin Web Firebase app
 */
function getAdminWebFirebase() {
  if (!adminWebFirebaseApp) {
    initializeFirebase();
  }
  return adminWebFirebaseApp;
}

/**
 * Get Provider Firebase app
 */
function getProviderFirebase() {
  if (!providerFirebaseApp) {
    initializeFirebase();
  }
  return providerFirebaseApp;
}

/**
 * Send FCM push notification to admin browsers
 * 
 * @param {string[]} tokens - Array of FCM tokens
 * @param {string} title - Notification title
 * @param {string} body - Notification body
 * @param {object} data - Custom data payload
 * @returns {Promise<{success: number, failed: number, invalidTokens: string[]}>}
 */
async function sendAdminFcmNotification(tokens, title, body, data = {}) {
  if (!adminWebFirebaseApp) {
    logger.warn('⚠️  Admin Web Firebase not initialized — skipping push');
    return { success: 0, failed: 0, invalidTokens: [], reason: 'not_initialized' };
  }

  if (!tokens || tokens.length === 0) {
    return { success: 0, failed: 0, invalidTokens: [], reason: 'no_tokens' };
  }

  const results = { success: 0, failed: 0, invalidTokens: [] };

  // Convert data values to strings (FCM requirement)
  const stringData = {};
  for (const [key, value] of Object.entries(data)) {
    stringData[key] = String(value || '');
  }

  // Send to each token individually for better error tracking
  for (const token of tokens) {
    try {
      const message = {
        token,
        notification: { title, body },
        data: {
          ...stringData,
          click_action: '/dispatch',
          timestamp: new Date().toISOString(),
        },
        webpush: {
          notification: {
            icon: '/vite.svg',
            badge: '/vite.svg',
            tag: stringData.type || 'admin-alert',
            requireInteraction: true,
            vibrate: [200, 100, 200],
          },
          fcmOptions: {
            link: '/dispatch',
          },
        },
      };

      await adminWebFirebaseApp.messaging().send(message);
      results.success++;
    } catch (err) {
      results.failed++;

      // Mark invalid tokens for cleanup
      if (
        err.code === 'messaging/registration-token-not-registered' ||
        err.code === 'messaging/invalid-argument' ||
        err.code === 'messaging/invalid-registration-token'
      ) {
        results.invalidTokens.push(token);
      }

      logger.warn(`FCM send failed [${token.substring(0, 15)}...]: ${err.code || err.message}`);
    }
  }

  logger.info(`📤 FCM Push Result: ${results.success} sent, ${results.failed} failed, ${results.invalidTokens.length} invalid`);
  return results;
}

/**
 * Send FCM to provider (uses provider Firebase project)
 */
async function sendProviderFcmNotification(token, title, body, data = {}) {
  if (!providerFirebaseApp) {
    return { success: false, reason: 'not_initialized' };
  }

  try {
    const stringData = {};
    for (const [key, value] of Object.entries(data)) {
      stringData[key] = String(value || '');
    }

    const message = {
      token,
      notification: { title, body },
      data: stringData,
      android: {
        priority: 'high',
        notification: { sound: 'default', channelId: 'bookings' },
      },
      apns: {
        payload: { aps: { sound: 'default', badge: 1 } },
      },
    };

    await providerFirebaseApp.messaging().send(message);
    return { success: true };
  } catch (err) {
    logger.warn(`Provider FCM failed: ${err.code || err.message}`);
    return { success: false, error: err.message };
  }
}

module.exports = {
  initializeFirebase,
  isAdminWebFirebaseReady,
  isProviderFirebaseReady,
  getAdminWebFirebase,
  getProviderFirebase,
  sendAdminFcmNotification,
  sendProviderFcmNotification,
};