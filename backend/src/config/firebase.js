// src/config/firebase.js
const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

// ── Logger (safe fallback if your logger isn't ready yet) ──
let logger;
try {
  logger = require('../utils/logger');
} catch {
  logger = {
    info: (...args) => console.log(...args),
    warn: (...args) => console.warn(...args),
    error: (...args) => console.error(...args),
  };
}

// ── State ──
let providerApp = null;   // serviceproviderapp-b7767 → provider phone FCM
let adminWebApp = null;   // uwe-services-web → admin browser FCM

let providerReady = false;
let adminWebReady = false;

// ══════════════════════════════════════════════════════════════
//  1. PROVIDER FCM  (serviceproviderapp-b7767)
//     Used to send booking offer notifications to provider phones
// ══════════════════════════════════════════════════════════════
function initializeProviderFirebase() {
  if (providerReady) return providerApp;

  try {
    const serviceAccountPath = process.env.FIREBASE_PROVIDER_SERVICE_ACCOUNT_PATH
      ? path.resolve(process.cwd(), process.env.FIREBASE_PROVIDER_SERVICE_ACCOUNT_PATH)
      : path.resolve(__dirname, 'serviceproviderapp-b7767-firebase-adminsdk.json');

    if (!fs.existsSync(serviceAccountPath)) {
      logger.warn(`⚠️  Provider Firebase service account NOT found at: ${serviceAccountPath}`);
      logger.warn('⚠️  Provider FCM (booking offers to phones) will be DISABLED');
      return null;
    }

    const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

    // Check if app with this name already exists (prevents duplicate init on hot-reload)
    const existingApp = admin.apps.find(a => a.name === 'providerApp');
    if (existingApp) {
      providerApp = existingApp;
      providerReady = true;
      return providerApp;
    }

    providerApp = admin.initializeApp(
      {
        credential: admin.credential.cert(serviceAccount),
        projectId: serviceAccount.project_id || 'serviceproviderapp-b7767',
      },
      'providerApp'  // Named instance
    );

    providerReady = true;
    logger.info(`✅ Provider Firebase initialized → project: ${serviceAccount.project_id}`);
    return providerApp;
  } catch (error) {
    logger.error('❌ Provider Firebase init failed:', error.message);
    return null;
  }
}

// ══════════════════════════════════════════════════════════════
//  2. ADMIN WEB FCM  (uwe-services-web)
//     Used to send push notifications to admin panel browsers
// ══════════════════════════════════════════════════════════════
function initializeAdminWebFirebase() {
  if (adminWebReady) return adminWebApp;

  try {
    const serviceAccountPath = process.env.FIREBASE_ADMIN_WEB_SERVICE_ACCOUNT_PATH
      ? path.resolve(process.cwd(), process.env.FIREBASE_ADMIN_WEB_SERVICE_ACCOUNT_PATH)
      : path.resolve(__dirname, 'uwe-services-web-firebase-adminsdk.json');

    if (!fs.existsSync(serviceAccountPath)) {
      logger.warn(`⚠️  Admin Web Firebase service account NOT found at: ${serviceAccountPath}`);
      logger.warn('⚠️  Admin web push FCM will be DISABLED (Socket.IO still works)');
      return null;
    }

    const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

    const existingApp = admin.apps.find(a => a.name === 'adminWebApp');
    if (existingApp) {
      adminWebApp = existingApp;
      adminWebReady = true;
      return adminWebApp;
    }

    adminWebApp = admin.initializeApp(
      {
        credential: admin.credential.cert(serviceAccount),
        projectId: serviceAccount.project_id || 'uwe-services-web',
      },
      'adminWebApp'  // Named instance
    );

    adminWebReady = true;
    logger.info(`✅ Admin Web Firebase initialized → project: ${serviceAccount.project_id}`);
    return adminWebApp;
  } catch (error) {
    logger.error('❌ Admin Web Firebase init failed:', error.message);
    return null;
  }
}

// ══════════════════════════════════════════════════════════════
//  MASTER INIT — Call once at server startup
// ══════════════════════════════════════════════════════════════
function initializeFirebase() {
  logger.info('🔥 Initializing Firebase (dual-project mode)...');
  initializeProviderFirebase();
  initializeAdminWebFirebase();

  logger.info('─────────────────────────────────────');
  logger.info(`  Provider FCM (phones):  ${providerReady ? '✅ READY' : '❌ DISABLED'}`);
  logger.info(`  Admin Web FCM (browser): ${adminWebReady ? '✅ READY' : '❌ DISABLED'}`);
  logger.info('─────────────────────────────────────');

  return providerApp || adminWebApp || null;
}

// ══════════════════════════════════════════════════════════════
//  GETTERS
// ══════════════════════════════════════════════════════════════

/** Get the firebase-admin module itself */
function getFirebaseAdmin() {
  return admin;
}

/** Is the provider FCM ready? (for sending to provider phones) */
function isProviderFirebaseReady() {
  if (!providerReady) initializeProviderFirebase();
  return providerReady && providerApp !== null;
}

/** Is the admin web FCM ready? (for sending to admin browsers) */
function isAdminWebFirebaseReady() {
  if (!adminWebReady) initializeAdminWebFirebase();
  return adminWebReady && adminWebApp !== null;
}

/** Legacy compat — returns true if ANY Firebase is ready */
function isFirebaseReady() {
  return isProviderFirebaseReady() || isAdminWebFirebaseReady();
}

/** Get messaging instance for PROVIDER FCM (sending to phones) */
function getProviderMessaging() {
  if (!isProviderFirebaseReady()) return null;
  try {
    return admin.messaging(providerApp);
  } catch (e) {
    logger.error('Failed to get provider messaging:', e.message);
    return null;
  }
}

/** Get messaging instance for ADMIN WEB FCM (sending to browsers) */
function getAdminWebMessaging() {
  if (!isAdminWebFirebaseReady()) return null;
  try {
    return admin.messaging(adminWebApp);
  } catch (e) {
    logger.error('Failed to get admin web messaging:', e.message);
    return null;
  }
}

/** Legacy compat — returns provider messaging */
function getMessaging() {
  return getProviderMessaging();
}

module.exports = {
  // Master init
  initializeFirebase,

  // Provider FCM (phones)
  initializeProviderFirebase,
  isProviderFirebaseReady,
  getProviderMessaging,

  // Admin Web FCM (browsers)
  initializeAdminWebFirebase,
  isAdminWebFirebaseReady,
  getAdminWebMessaging,

  // Legacy compat
  getFirebaseAdmin,
  isFirebaseReady,
  getMessaging,
  admin,
};