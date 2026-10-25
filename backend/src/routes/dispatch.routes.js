// src/routes/dispatch.routes.js
const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const ctrl = require('../controllers/dispatch.controller');

router.use(authMiddleware);

router.get('/stats', ctrl.getDispatchStats);
router.get('/active', ctrl.getActiveDispatches);
router.get('/no-provider-found', ctrl.getNoProviderBookings);
router.get('/eligible-providers/:id', ctrl.getEligibleProviders);
router.post('/trigger/:id', ctrl.triggerDispatch);
router.post('/reassign/:id', ctrl.reassignBooking);
router.post('/assign-manual/:id', ctrl.assignProviderManually);

module.exports = router;