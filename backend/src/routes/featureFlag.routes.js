// src/routes/featureFlag.routes.js
const express = require('express');
const router = express.Router();
const featureFlagController = require('../controllers/featureFlag.controller');
const authMiddleware = require('../middleware/authMiddleware');

// Apply auth middleware to all routes
router.use(authMiddleware);

// ==================== STATS ====================
router.get('/stats', featureFlagController.getFeatureFlagStats);

// ==================== ACTIVE FLAGS (for mobile apps) ====================
router.get('/active', featureFlagController.getActiveFlags);

// ==================== CHECK FLAG (for mobile apps) ====================
router.get('/check/:key', featureFlagController.checkFeatureFlag);

// ==================== BULK OPERATIONS ====================
router.post('/bulk-toggle', featureFlagController.bulkToggleFeatureFlags);

// ==================== CRUD ====================
router.get('/', featureFlagController.getAllFeatureFlags);
router.get('/key/:key', featureFlagController.getFeatureFlagByKey);
router.get('/:id', featureFlagController.getFeatureFlagById);
router.get('/:id/history', featureFlagController.getFeatureFlagHistory);
router.post('/', featureFlagController.createFeatureFlag);
router.put('/:id', featureFlagController.updateFeatureFlag);
router.patch('/:id/toggle', featureFlagController.toggleFeatureFlag);
router.post('/:id/duplicate', featureFlagController.duplicateFeatureFlag);
router.delete('/:id', featureFlagController.deleteFeatureFlag);
router.patch('/:id/restore', featureFlagController.restoreFeatureFlag);

module.exports = router;