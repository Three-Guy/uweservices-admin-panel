// backend/src/routes/providerOffer.routes.js
const express = require('express');
const router = express.Router();
const providerOfferController = require('../controllers/providerOffer.controller');

// ── Safe handler wrapper (prevents crash if controller fn missing) ──
const safeHandler = (fn, name) => {
  if (typeof fn !== 'function') {
    console.warn(`⚠️  providerOffer controller function missing: ${name}`);
    return (req, res) => {
      res.status(501).json({
        success: false,
        message: `Handler not implemented: ${name}`,
      });
    };
  }
  return fn;
};

// ──────────────────────────────────────────
// Provider Offer Routes
// ──────────────────────────────────────────

// GET all offers (with filters: status, bookingId, providerId)
router.get(
  '/',
  safeHandler(providerOfferController.getAllOffers, 'getAllOffers')
);

// GET offers for a specific booking
router.get(
  '/booking/:bookingId',
  safeHandler(providerOfferController.getOffersByBooking, 'getOffersByBooking')
);

// GET offers for a specific provider
router.get(
  '/provider/:providerId',
  safeHandler(providerOfferController.getOffersByProvider, 'getOffersByProvider')
);

// GET provider performance stats (last 30 days)
router.get(
  '/provider/:providerId/performance',
  safeHandler(providerOfferController.getProviderPerformance, 'getProviderPerformance')
);

module.exports = router;