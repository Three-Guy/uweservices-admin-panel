// backend/src/routes/dispatch.routes.js
const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/dispatch.controller');

// Stats + listing
router.get('/stats', ctrl.getStats);
router.get('/active', ctrl.getActiveDispatches);
router.get('/no-provider-found', ctrl.getNoProviderBookings);
router.get('/unassigned', ctrl.getUnassignedBookings);

// Eligibility
router.get('/eligible-providers/:bookingId', ctrl.getEligibleProviders);
router.get('/eligible-providers-debug/:bookingId', ctrl.getEligibleProvidersDebug);

// Actions
router.post('/trigger/:bookingId', ctrl.triggerDispatch);
router.post('/reassign/:bookingId', ctrl.reassignBooking);
router.post('/auto-redispatch/:bookingId', ctrl.autoRedispatch);
router.post('/assign-manual/:bookingId', ctrl.assignProviderManually);

module.exports = router;