// backend/src/config/firebase.js
const path = require('path');
const fs = require('fs');

let admin;
try {
  admin = require('firebase-admin');
} catch (err) {
  console.warn('⚠️  firebase-admin not installed. FCM features disabled.');
  admin = null;
}

let providerApp = null;
let adminWebApp = null;

// ─── Helper: load credentials from file OR env var ───
function loadCredentials(jsonFileName, envVarName) {
  // 1. Try local JSON file
  const filePath = path.join(__dirname, jsonFileName);
  if (fs.existsSync(filePath)) {
    try {
      const raw = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(raw);
    } catch (e) {
      console.warn(`⚠️  Could not parse ${jsonFileName}: ${e.message}`);
    }
  }

  // 2. Try environment variable (for Render / production)
  const envVal = process.env[envVarName];
  if (envVal) {
    try {
      return JSON.parse(envVal);
    } catch (e) {
      console.warn(`⚠️  Could not parse env var ${envVarName}: ${e.message}`);
    }
  }

  return null;
}

// ─── Initialize Firebase Apps ───
function initializeFirebase() {
  if (!admin) {
    console.warn('⚠️  Skipping Firebase init — firebase-admin not available');
    return;
  }

  // Provider FCM (sends to provider phones)
  const providerCreds = loadCredentials(
    'serviceproviderapp-b7767-firebase-adminsdk.json',
    'FIREBASE_PROVIDER_CREDENTIALS'
  );

  if (providerCreds) {
    try {
      providerApp = admin.initializeApp(
        { credential: admin.credential.cert(providerCreds) },
        'providerApp'
      );
      console.log('✅ Firebase Provider App initialized');
    } catch (e) {
      console.warn('⚠️  Provider Firebase init failed:', e.message);
    }
  } else {
    console.warn('⚠️  No Provider Firebase credentials found (file or env). Provider FCM disabled.');
  }

  // Admin Web FCM (sends to admin browsers)
  const adminWebCreds = loadCredentials(
    'uwe-services-web-firebase-adminsdk.json',
    'FIREBASE_ADMIN_WEB_CREDENTIALS'
  );

  if (adminWebCreds) {
    try {
      adminWebApp = admin.initializeApp(
        { credential: admin.credential.cert(adminWebCreds) },
        'adminWebApp'
      );
      console.log('✅ Firebase Admin Web App initialized');
    } catch (e) {
      console.warn('⚠️  Admin Web Firebase init failed:', e.message);
    }
  } else {
    console.warn('⚠️  No Admin Web Firebase credentials found (file or env). Admin FCM disabled.');
  }
}

// ─── Exported helpers ───
function getProviderMessaging() {
  if (!admin || !providerApp) return null;
  return admin.messaging(providerApp);
}

function getAdminWebMessaging() {
  if (!admin || !adminWebApp) return null;
  return admin.messaging(adminWebApp);
}

function isProviderFirebaseReady() {
  return !!(admin && providerApp);
}

function isAdminWebFirebaseReady() {
  return !!(admin && adminWebApp);
}

// Legacy compat (old code that uses getMessaging / isFirebaseReady)
function getMessaging() {
  return getProviderMessaging();
}

function isFirebaseReady() {
  return isProviderFirebaseReady();
}

module.exports = {
  initializeFirebase,
  getProviderMessaging,
  getAdminWebMessaging,
  isProviderFirebaseReady,
  isAdminWebFirebaseReady,
  getMessaging,
  isFirebaseReady,
};