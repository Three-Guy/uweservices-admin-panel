// backend/src/routes/manualDispatch.routes.js
const express = require('express');
const router = express.Router();

var controller;
try {
  controller = require('../controllers/manualDispatch.controller');
  console.log('✅ ManualDispatch controller loaded. Exports:', Object.keys(controller));
} catch (err) {
  console.error('❌ Failed to load manualDispatch.controller:', err.message);
  controller = {};
}

function safe(handlerName) {
  return function(req, res, next) {
    console.log('🎯 [ManualDispatch] ' + req.method + ' ' + req.originalUrl);
    var handler = controller[handlerName];
    if (typeof handler !== 'function') {
      console.error('❌ Handler "' + handlerName + '" not found. Available: ' + Object.keys(controller));
      return res.status(500).json({
        success: false,
        error: 'Handler "' + handlerName + '" not found',
        available: Object.keys(controller)
      });
    }
    return Promise.resolve(handler(req, res, next)).catch(function(err) {
      console.error('❌ Handler "' + handlerName + '" threw:', err);
      res.status(500).json({ success: false, error: err.message, stack: err.stack });
    });
  };
}

function devAuth(req, res, next) {
  var adminSecret = req.headers['x-admin-secret'] || req.headers['X-Admin-Secret'];
  var authHeader = req.headers.authorization;

  if (adminSecret === (process.env.ADMIN_SECRET_KEY || 'uwe_admin_super_secret_2026')) {
    req.adminAuth = 'secret_key';
    return next();
  }
  if (authHeader && authHeader.startsWith('Bearer ')) {
    req.adminAuth = 'jwt';
    return next();
  }
  console.log('⚠️ [ManualDispatch] No auth header — allowing in dev mode');
  req.adminAuth = 'dev_mode';
  return next();
}

router.get('/_health', safe('_health'));
router.get('/debug', devAuth, safe('debug'));
router.get('/debug-connections', devAuth, safe('debugConnections'));
router.get('/online-providers', devAuth, safe('getOnlineProviders'));
router.get('/dispatchable-bookings', devAuth, safe('getDispatchableBookings'));
router.post('/send', devAuth, safe('send'));
router.post('/dispatch', devAuth, safe('send'));
router.post('/force-dispatch', devAuth, safe('send'));
router.get('/offer-status/:offerId', devAuth, safe('getOfferStatus'));

module.exports = router;