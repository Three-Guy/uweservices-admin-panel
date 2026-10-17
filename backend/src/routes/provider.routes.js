const express = require('express');
const router = express.Router();
const providerController = require('../controllers/provider.controller');
const authMiddleware = require('../middleware/authMiddleware');

// All routes require authentication
router.use(authMiddleware);

// ==================== STATS & RECENT (Must be before /:id routes) ====================
// Get provider statistics
router.get('/stats', providerController.getProviderStats);

// Get recent providers
router.get('/recent', providerController.getRecentProviders);

// ==================== BULK OPERATIONS ====================
// Delete multiple providers
router.post('/delete-multiple', providerController.deleteMultipleProviders);

// ==================== CRUD OPERATIONS ====================
// Get all providers
router.get('/', providerController.getAllProviders);

// Get provider by ID
router.get('/:id', providerController.getProviderById);

// Update provider
router.patch('/:id', providerController.updateProvider);

// Toggle provider status (active/inactive)
router.patch('/:id/status', providerController.toggleProviderStatus);

// Block/Unblock provider
router.patch('/:id/block', providerController.blockProvider);

// Restore deleted provider
router.patch('/:id/restore', providerController.restoreProvider);

// Delete provider (soft delete by default, permanent with query param)
router.delete('/:id', providerController.deleteProvider);

module.exports = router;