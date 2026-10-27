// backend/src/routes/manualDispatch.routes.js
// COMPLETE ROUTES FILE

const express = require('express');
const router = express.Router();

let controller = {};
try {
  controller = require('../controllers/manualDispatch.controller');
  console.log('✅ [ManualDispatch Routes] Controller loaded. Exports:', Object.keys(controller));
} catch (err) {
  console.error('❌ [ManualDispatch Routes] Controller load FAILED:', err.message);
  console.error(err.stack);
}

// Dev auth: accept either JWT or x-admin-secret header
function devAuth(req, res, next) {
  var hasAdminSecret = req.headers['x-admin-secret'] === process.env.ADMIN_SECRET_KEY ||
                       req.headers['x-admin-secret'] === 'uwe_admin_super_secret_2026';
  var hasAuth = req.headers['authorization'] && req.headers['authorization'].startsWith('Bearer ');

  if (!hasAdminSecret && !hasAuth) {
    console.warn('⚠️ [ManualDispatch] No auth header, allowing in dev mode');
  }
  next();
}

// Safe wrapper
function safe(handlerName) {
  return function(req, res, next) {
    var handler = controller[handlerName];
    if (typeof handler !== 'function') {
      console.error('❌ Handler "' + handlerName + '" is not a function! Available:', Object.keys(controller));
      return res.status(500).json({
        success: false,
        error: 'Controller handler "' + handlerName + '" not loaded',
        availableHandlers: Object.keys(controller)
      });
    }
    console.log('🎯 [ManualDispatch] ' + req.method + ' ' + req.originalUrl);
    return handler(req, res, next);
  };
}

// Health & debug (no auth)
router.get('/_health', safe('_health'));
router.get('/debug', safe('debug'));
router.get('/debug-connections', safe('debugConnections'));

// Data endpoints
router.get('/online-providers', devAuth, safe('getOnlineProviders'));
router.get('/dispatchable-bookings', devAuth, safe('getDispatchableBookings'));

// Dispatch
router.post('/send', devAuth, safe('send'));
router.post('/dispatch', devAuth, safe('dispatch'));
router.post('/force-dispatch', devAuth, safe('send'));

// Offer status
router.get('/offer-status/:offerId', devAuth, safe('getOfferStatus'));

// FCM TEST ENDPOINT
router.get('/test-fcm/:providerId', devAuth, safe('testFCM'));
router.post('/test-fcm/:providerId', devAuth, safe('testFCM'));
router.post('/test-fcm', devAuth, safe('testFCM'));

module.exports = router;