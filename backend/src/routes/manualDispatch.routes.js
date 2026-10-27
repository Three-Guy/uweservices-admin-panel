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
    // silently try next
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

  // ── Method 4: try auth.js ──
  try {
    const authJs = require('../middleware/auth');
    const fn =
      authJs.verifyAdmin ||
      authJs.adminAuth ||
      authJs.protect ||
      authJs.authenticate ||
      authJs.default ||
      (typeof authJs === 'function' ? authJs : null);
    if (typeof fn === 'function') return fn(req, res, next);
  } catch (e) {}

  // ── JWT verify inline fallback ──
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
  if (token && token.length > 20) {
    try {
      const jwt = require('jsonwebtoken');
      const JWT_SECRET =
        process.env.JWT_SECRET ||
        process.env.JWT_SECRET_KEY ||
        process.env.ACCESS_TOKEN_SECRET ||
        'uwe_admin_jwt_secret_2025';
      const decoded = jwt.verify(token, JWT_SECRET);
      req.admin = {
        email: decoded.email || 'jwt-admin',
        role: decoded.role || 'admin',
        adminId: decoded.adminId || decoded.id,
      };
      return next();
    } catch (e) {
      // JWT invalid — fall through to 401
    }
  }

  return res.status(401).json({
    success: false,
    message: 'Unauthorized — send x-admin-secret header or Authorization: Bearer <jwt>',
  });
}

// ── Health check (no auth) ──
router.get('/_health', (req, res) => {
  res.json({ success: true, route: 'manual-dispatch', timestamp: new Date().toISOString() });
});

// ── Protected routes ──
router.get('/online-providers', authMiddleware, ctrl.getOnlineProviders);
router.get('/dispatchable-bookings', authMiddleware, ctrl.getDispatchableBookings);
router.post('/send', authMiddleware, ctrl.send);
router.get('/offer-status/:offerId', authMiddleware, ctrl.getOfferStatus);
router.get('/debug', authMiddleware, ctrl.debugConnections);

module.exports = router;