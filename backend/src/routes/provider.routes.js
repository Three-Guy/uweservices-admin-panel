const express = require('express');
const router = express.Router();
const providerController = require('../controllers/provider.controller');
const authMiddleware = require('../middleware/authMiddleware');

// All routes require authentication
router.use(authMiddleware);

// ==================== STATS & RECENT (Must be before /:id routes) ====================
router.get('/stats', providerController.getProviderStats);
router.get('/recent', providerController.getRecentProviders);

// ==================== BULK OPERATIONS ====================
router.post('/delete-multiple', providerController.deleteMultipleProviders);

// ==================== CRUD OPERATIONS ====================
router.get('/', providerController.getAllProviders);
router.get('/:id', providerController.getProviderById);
router.patch('/:id', providerController.updateProvider);

// ==================== STATUS CONTROLS ====================
router.patch('/:id/status', providerController.toggleProviderStatus);
router.patch('/:id/availability', providerController.updateAvailability);
router.patch('/:id/verification', providerController.updateVerification);
router.patch('/:id/payment-lock', providerController.updatePaymentLock);
router.patch('/:id/block', providerController.blockProvider);
router.patch('/:id/restore', providerController.restoreProvider);

// ==================== DELETE ====================
router.delete('/:id', providerController.deleteProvider);

module.exports = router;