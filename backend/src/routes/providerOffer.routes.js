// src/routes/providerOffer.routes.js
const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const ctrl = require('../controllers/providerOffer.controller');

router.use(authMiddleware);

router.get('/', ctrl.getAllOffers);
router.get('/booking/:bookingId', ctrl.getOffersByBooking);
router.get('/provider/:providerId', ctrl.getOffersByProvider);
router.get('/provider/:providerId/performance', ctrl.getProviderPerformance);

module.exports = router;