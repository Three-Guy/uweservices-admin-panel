// backend/src/routes/directPush.routes.js
// Bulletproof route loader — tries every common auth middleware name

const express = require('express');
const router = express.Router();

console.log('[DirectPushRoutes] 🔧 Starting route registration...');

// ─── Load controller with detailed error logging ───
let ctrl;
try {
  ctrl = require('../controllers/directPush.controller');
  console.log('[DirectPushRoutes] ✅ Controller loaded');
  console.log('[DirectPushRoutes]    Methods available:', Object.keys(ctrl).join(', '));

  // Verify all required methods exist
  const required = ['sendDirectPush', 'previewCount', 'searchProviders', 'getHistory', 'getHistoryDetail', 'listFcmUsers', 'listFcmProviders'];
  const missing = required.filter(m => typeof ctrl[m] !== 'function');
  if (missing.length) {
    console.error('[DirectPushRoutes] ❌ MISSING controller methods:', missing.join(', '));
    throw new Error(`Controller missing methods: ${missing.join(', ')}`);
  }
} catch (err) {
  console.error('[DirectPushRoutes] ❌ Controller load FAILED:', err.message);
  console.error('[DirectPushRoutes] Stack:', err.stack);
  throw err; // Re-throw so server.js catch block logs it
}

// ─── Try to load auth middleware from any common location/name ───
let authMiddleware = null;
const authSearchPaths = [
  { path: '../middleware/auth', names: ['authenticate', 'authenticateAdmin', 'protect', 'verifyAdmin', 'requireAuth', 'isAuthenticated'] },
  { path: '../middleware/auth.middleware', names: ['authenticate', 'authenticateAdmin', 'protect', 'verifyAdmin', 'default'] },
  { path: '../middleware/authMiddleware', names: ['authenticate', 'authenticateAdmin', 'protect', 'default'] },
  { path: '../middleware/adminAuth', names: ['authenticate', 'authenticateAdmin', 'protect', 'default'] },
];

for (const { path, names } of authSearchPaths) {
  if (authMiddleware) break;
  try {
    const mod = require(path);
    console.log(`[DirectPushRoutes] 📂 Checking ${path}, exports:`, Object.keys(mod).join(', '));

    // Try each name
    for (const name of names) {
      if (typeof mod[name] === 'function') {
        authMiddleware = mod[name];
        console.log(`[DirectPushRoutes] ✅ Found auth middleware: ${path} → ${name}`);
        break;
      }
    }

    // Try if the module itself is a function (CommonJS default export)
    if (!authMiddleware && typeof mod === 'function') {
      authMiddleware = mod;
      console.log(`[DirectPushRoutes] ✅ Found auth middleware: ${path} (module.exports = function)`);
    }
  } catch (err) {
    // Silently skip — file doesn't exist
  }
}

// ─── Apply auth if found, otherwise run WITHOUT auth and warn ───
if (authMiddleware) {
  router.use(authMiddleware);
  console.log('[DirectPushRoutes] 🔐 Auth middleware applied to all routes');
} else {
  console.warn('[DirectPushRoutes] ⚠️⚠️⚠️ NO AUTH MIDDLEWARE FOUND — routes are UNPROTECTED!');
  console.warn('[DirectPushRoutes] Please manually add auth. Routes will still work for testing.');
}

// ─── Register all 7 routes ───
router.post('/send', ctrl.sendDirectPush);
router.post('/preview-count', ctrl.previewCount);
router.get('/search-providers', ctrl.searchProviders);
router.get('/fcm-users', ctrl.listFcmUsers);
router.get('/fcm-providers', ctrl.listFcmProviders);
router.get('/history', ctrl.getHistory);
router.get('/history/:id', ctrl.getHistoryDetail);

console.log('[DirectPushRoutes] ✅ All 7 routes registered:');
console.log('[DirectPushRoutes]    POST   /send');
console.log('[DirectPushRoutes]    POST   /preview-count');
console.log('[DirectPushRoutes]    GET    /search-providers');
console.log('[DirectPushRoutes]    GET    /fcm-users');
console.log('[DirectPushRoutes]    GET    /fcm-providers');
console.log('[DirectPushRoutes]    GET    /history');
console.log('[DirectPushRoutes]    GET    /history/:id');

module.exports = router;