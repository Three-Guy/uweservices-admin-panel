// backend/src/routes/manualDispatch.routes.js
// ═══════════════════════════════════════════════════════════════
// MANUAL DISPATCH ROUTES
// Mounted at /api/v1/admin/manual-dispatch
// Supports JWT auth + x-admin-secret header
// ═══════════════════════════════════════════════════════════════

const express = require('express');
const router = express.Router();

const manualDispatchController = require('../controllers/manualDispatch.controller');

/* ─────────────────────────────────────────────
   AUTH MIDDLEWARE (JWT or admin-secret)
   ───────────────────────────────────────────── */
const ADMIN_SECRET = process.env.ADMIN_SECRET_KEY || 'uwe_admin_super_secret_2026';

function authMiddleware(req, res, next) {
  // Option 1: Admin secret header (bypass JWT)
  const secret = req.headers['x-admin-secret'];
  if (secret && secret === ADMIN_SECRET) {
    req.admin = { email: 'secret-admin', role: 'admin', fromSecret: true };
    return next();
  }

  // Option 2: JWT via existing authMiddleware
  try {
    const jwtAuth = require('../middleware/authMiddleware');
    const fn =
      jwtAuth.verifyAdmin ||
      jwtAuth.adminAuth ||
      jwtAuth.protect ||
      jwtAuth.authenticate ||
      jwtAuth;

    if (typeof fn === 'function') {
      return fn(req, res, next);
    }
  } catch (e) {
    console.warn('⚠️ [ManualDispatch] JWT middleware load failed:', e.message);
  }

  return res.status(401).json({
    success: false,
    message: 'Unauthorized — provide JWT token or x-admin-secret header',
  });
}

/* ─────────────────────────────────────────────
   ROUTES
   ───────────────────────────────────────────── */
router.get('/online-providers', authMiddleware, manualDispatchController.getOnlineProviders);
router.get('/dispatchable-bookings', authMiddleware, manualDispatchController.getDispatchableBookings);
router.post('/send', authMiddleware, manualDispatchController.send);
router.get('/offer-status/:offerId', authMiddleware, manualDispatchController.getOfferStatus);

module.exports = router;