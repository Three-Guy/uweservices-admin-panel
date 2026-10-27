// backend/src/routes/manualDispatch.routes.js
const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/manualDispatch.controller');

const ADMIN_SECRET = process.env.ADMIN_SECRET_KEY || 'uwe_admin_super_secret_2026';

function authMiddleware(req, res, next) {
  // ── Method 1: x-admin-secret header ──
  const secret = req.headers['x-admin-secret'] || req.headers['X-Admin-Secret'];
  if (secret && secret === ADMIN_SECRET) {
    req.admin = { email: 'secret-admin', role: 'admin', fromSecret: true };
    return next();
  }

  // ── Method 2: JWT Bearer token ──
  try {
    const jwtAuth = require('../middleware/authMiddleware');
    const fn =
      jwtAuth.verifyAdmin ||
      jwtAuth.adminAuth ||
      jwtAuth.protect ||
      jwtAuth.authenticate ||
      jwtAuth.default ||
      (typeof jwtAuth === 'function' ? jwtAuth : null);
    if (typeof fn === 'function') return fn(req, res, next);
  } catch (e) {
    console.warn('⚠️ JWT auth middleware load failed:', e.message);
  }

  // ── Method 3: alternative middleware paths ──
  try {
    const altAuth = require('../middleware/auth.middleware');
    const fn =
      altAuth.verifyAdmin ||
      altAuth.adminAuth ||
      altAuth.protect ||
      altAuth.authenticate ||
      altAuth.default ||
      (typeof altAuth === 'function' ? altAuth : null);
    if (typeof fn === 'function') return fn(req, res, next);
  } catch (e) {}

  return res.status(401).json({
    success: false,
    message: 'Unauthorized — send x-admin-secret header or Authorization: Bearer <jwt>'
  });
}

// ── Routes ──
router.get('/online-providers', authMiddleware, ctrl.getOnlineProviders);
router.get('/dispatchable-bookings', authMiddleware, ctrl.getDispatchableBookings);
router.post('/send', authMiddleware, ctrl.send);
router.get('/offer-status/:offerId', authMiddleware, ctrl.getOfferStatus);
router.get('/debug', authMiddleware, ctrl.debugConnections);

// ── Health check (no auth) ──
router.get('/_health', (req, res) => {
  res.json({ success: true, route: 'manual-dispatch', timestamp: new Date().toISOString() });
});

module.exports = router;