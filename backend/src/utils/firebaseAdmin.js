// backend/src/utils/firebaseAdmin.js
const admin = require('firebase-admin');
const logger = require('./logger');

let adminApp = null;
let isInitialized = false;

/**
 * Initialize Firebase Admin SDK
 * 
 * Supports 3 methods (in priority order):
 * 1. FIREBASE_SERVICE_ACCOUNT_BASE64 env var (best for Render/Vercel)
 * 2. FIREBASE_SERVICE_ACCOUNT env var (raw JSON string)
 * 3. File path: src/config/uwe-services-web-firebase-adminsdk.json
 */
function initializeFirebaseAdmin() {
  if (isInitialized) return adminApp;

  try {
    // Check if already initialized by another module
    if (admin.apps.length > 0) {
      adminApp = admin.app();
      isInitialized = true;
      logger.info('✅ Firebase Admin already initialized');
      return adminApp;
    }

    let serviceAccount = null;

    // ── Method 1: Base64 encoded (RECOMMENDED for Render) ──
    if (process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
      try {
        const decoded = Buffer.from(
          process.env.FIREBASE_SERVICE_ACCOUNT_BASE64,
          'base64'
        ).toString('utf-8');
        serviceAccount = JSON.parse(decoded);
        logger.info('✅ Firebase credentials loaded from FIREBASE_SERVICE_ACCOUNT_BASE64');
      } catch (parseErr) {
        logger.error('❌ Failed to parse FIREBASE_SERVICE_ACCOUNT_BASE64: ' + parseErr.message);
      }
    }

    // ── Method 2: Raw JSON string env var ──
    if (!serviceAccount && process.env.FIREBASE_SERVICE_ACCOUNT) {
      try {
        serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
        logger.info('✅ Firebase credentials loaded from FIREBASE_SERVICE_ACCOUNT');
      } catch (parseErr) {
        logger.error('❌ Failed to parse FIREBASE_SERVICE_ACCOUNT: ' + parseErr.message);
      }
    }

    // ── Method 3: File path (local development) ──
    if (!serviceAccount) {
      const path = require('path');
      const fs = require('fs');
      const filePath = path.join(
        __dirname,
        '..',
        'config',
        'uwe-services-web-firebase-adminsdk.json'
      );

      if (fs.existsSync(filePath)) {
        serviceAccount = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        logger.info('✅ Firebase credentials loaded from file');
      }
    }

    // ── Initialize ──
    if (serviceAccount) {
      adminApp = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
      isInitialized = true;
      logger.info('🔥 Firebase Admin SDK initialized successfully for project: ' + serviceAccount.project_id);
    } else {
      logger.warn('⚠️  No Firebase credentials found. Admin FCM push notifications DISABLED.');
      logger.warn('   To enable: Set FIREBASE_SERVICE_ACCOUNT_BASE64 env variable on Render.');
      logger.warn('   Steps: base64 encode your service account JSON → paste in Render env vars.');
    }

    return adminApp;
  } catch (err) {
    logger.error('❌ Firebase Admin initialization failed: ' + err.message);
    return null;
  }
}

/**
 * Send FCM push notification to admin browsers
 */
async function sendAdminPushNotification(tokens, title, body, data = {}) {
  if (!isInitialized || !adminApp) {
    logger.warn('⚠️  FCM not initialized — skipping push notification');
    return { success: false, reason: 'fcm_not_initialized' };
  }

  if (!tokens || tokens.length === 0) {
    return { success: false, reason: 'no_tokens' };
  }

  const message = {
    notification: {
      title,
      body,
    },
    data: {
      ...data,
      click_action: '/dispatch',
    },
    webpush: {
      notification: {
        icon: '/vite.svg',
        badge: '/vite.svg',
        tag: data.type || 'admin-alert',
        requireInteraction: true,
      },
    },
  };

  const results = { success: 0, failed: 0, invalidTokens: [] };

  // Send to each token individually (better error handling)
  for (const token of tokens) {
    try {
      await admin.messaging().send({
        token,
        ...message,
      });
      results.success++;
    } catch (err) {
      results.failed++;

      // Track invalid tokens for cleanup
      if (
        err.code === 'messaging/registration-token-not-registered' ||
        err.code === 'messaging/invalid-argument' ||
        err.code === 'messaging/invalid-registration-token'
      ) {
        results.invalidTokens.push(token);
      }

      logger.warn(`FCM send failed for token ${token.substring(0, 20)}...: ${err.code || err.message}`);
    }
  }

  logger.info(`📤 FCM Push: ${results.success} sent, ${results.failed} failed`);
  return results;
}

/**
 * Check if FCM is available
 */
function isFcmAvailable() {
  return isInitialized && adminApp !== null;
}

module.exports = {
  initializeFirebaseAdmin,
  sendAdminPushNotification,
  isFcmAvailable,
  getAdminApp: () => adminApp,
};