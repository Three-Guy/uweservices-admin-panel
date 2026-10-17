// backend/src/routes/trendingRoutes.js
const express = require('express');
const router = express.Router();
const trendingController = require('../controllers/trending.controller');
const authMiddleware = require('../middleware/authMiddleware');

// ==================== AUTHENTICATED ROUTES ====================
router.use(authMiddleware);

// Stats (must be before /:id)
router.get('/stats', trendingController.getTrendingStats);

// CRUD
router.get('/', trendingController.getTrendingServices);
router.get('/:id', trendingController.getTrendingServiceById);
router.post('/', trendingController.createTrendingService);
router.put('/:id', trendingController.updateTrendingService);
router.delete('/:id', trendingController.deleteTrendingService);

// Actions
router.post('/reorder', trendingController.reorderTrendingServices);
router.post('/sync-stats', trendingController.syncTrendingStats);
router.patch('/:id/status', trendingController.toggleTrendingStatus);

module.exports = router;