const express = require('express');
const router = express.Router();
const zoneController = require('../controllers/zone.controller');
const authMiddleware = require('../middleware/authMiddleware');

// Debug middleware
router.use((req, res, next) => {
  console.log(`\n📍 Zone Route Hit: ${req.method} ${req.path}`);
  next();
});

// All routes require authentication
router.use(authMiddleware);

// Statistics route (must be before :id route)
router.get('/stats', zoneController.getZoneStats);

// Detect zone from coordinates (must be before :id route)
router.get('/detect', zoneController.detectZone);

// Get zones by city (must be before :id route)
router.get('/city/:cityId', zoneController.getZonesByCity);

// CRUD routes
router.get('/', zoneController.getZones);
router.post('/', zoneController.createZone);
router.get('/:id', zoneController.getZoneById);
router.patch('/:id', zoneController.updateZone);
router.patch('/:id/status', zoneController.toggleZoneStatus);
router.delete('/:id', zoneController.deleteZone);

// Get providers in a zone
router.get('/:id/providers', zoneController.getZoneProviders);

module.exports = router;