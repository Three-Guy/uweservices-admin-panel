// backend/src/routes/manualDispatch.routes.js
// ══════════════════════════════════════════════════════════════
//  MANUAL DISPATCH ROUTES
//  - Supports BOTH JWT auth (admin panel UI) AND x-admin-secret (scripts)
// ══════════════════════════════════════════════════════════════

const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/manualDispatch.controller');

/* ─── Flexible auth: JWT OR x-admin-secret ─── */
let authMiddleware;
try {
  authMiddleware = require('../middleware/authMiddleware');
} catch (e) {
  console.warn('[manualDispatch.routes] authMiddleware not available:', e.message);
  authMiddleware = (req, res, next) => next();
}

const ADMIN_SECRET = process.env.ADMIN_SECRET_KEY || 'uwe_admin_super_secret_2026';

function flexibleAuth(req, res, next) {
  // Allow x-admin-secret header to bypass JWT (for CLI / scripts / mobile dev)
  const providedSecret = req.headers['x-admin-secret'] || req.headers['x-admin-key'];
  if (providedSecret && String(providedSecret) === String(ADMIN_SECRET)) {
    req.admin = { role: 'admin', source: 'admin-secret' };
    req.user = req.admin;
    return next();
  }
  // Else fall back to JWT auth
  return authMiddleware(req, res, next);
}

/* ─── Routes ─── */

// List all online providers (filterable)
// Query: ?all=1 (include offline) | ?search=xxx | ?category=plumbing
router.get('/online-providers', flexibleAuth, ctrl.getOnlineProviders);

// List all dispatchable bookings
router.get('/dispatchable-bookings', flexibleAuth, ctrl.getDispatchableBookings);

// Admin sends manual dispatch
// Body: { bookingId, providerId, adminNote? }
router.post('/send', flexibleAuth, ctrl.sendManualDispatch);

// Poll offer status
router.get('/offer-status/:offerId', flexibleAuth, ctrl.getOfferStatus);

module.exports = router;