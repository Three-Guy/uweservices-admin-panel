// src/routes/service.routes.js
const express = require('express');
const router = express.Router();
const serviceController = require('../controllers/service.controller');
const authMiddleware = require('../middleware/authMiddleware');

// Debug middleware
router.use((req, res, next) => {
  console.log(`\n📍 Service Route Hit: ${req.method} ${req.path}`);
  console.log('📦 Query:', req.query);
  if (req.body && Object.keys(req.body).length > 0) {
    console.log('📦 Body:', JSON.stringify(req.body, null, 2));
  }
  next();
});

// All routes require authentication
router.use(authMiddleware);

// ==================== STATS (Must be before /:id routes) ====================
router.get('/stats', serviceController.getServiceStats);

// ==================== BULK OPERATIONS ====================
router.post('/reorder', serviceController.reorderServices);
router.post('/bulk-update', serviceController.bulkUpdateServices);

// ==================== BY CATEGORY ====================
router.get('/category/:categoryId', serviceController.getServicesByCategory);

// ==================== CRUD OPERATIONS ====================
// Get all services
router.get('/', serviceController.getAllServices);

// Create new service
router.post('/', serviceController.createService);

// Get service by ID
router.get('/:id', serviceController.getServiceById);

// Update service
router.patch('/:id', serviceController.updateService);

// Toggle service status
router.patch('/:id/status', serviceController.toggleServiceStatus);

// Delete service
router.delete('/:id', serviceController.deleteService);

module.exports = router;