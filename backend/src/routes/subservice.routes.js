// src/routes/subservice.routes.js
const express = require('express');
const router = express.Router();
const subserviceController = require('../controllers/subservice.controller');
const authMiddleware = require('../middleware/authMiddleware');

// Debug middleware
router.use((req, res, next) => {
  console.log(`\n📍 Subservice Route Hit: ${req.method} ${req.path}`);
  console.log('📦 Params:', req.params);
  console.log('📦 Query:', req.query);
  if (req.body && Object.keys(req.body).length > 0) {
    console.log('📦 Body (first 500 chars):', JSON.stringify(req.body).substring(0, 500));
  }
  next();
});

// All routes require authentication
router.use(authMiddleware);

// ==================== STATS (Must be first - specific route) ====================
router.get('/stats', subserviceController.getSubserviceStats);

// ==================== BULK OPERATIONS (Must be before /:id routes) ====================
router.post('/reorder', subserviceController.reorderSubservices);
router.post('/bulk-update', subserviceController.bulkUpdateSubservices);

// ==================== BY CATEGORY (specific route before /:id) ====================
router.get('/category/:categoryId', subserviceController.getSubservicesByCategory);

// ==================== BY SERVICE (specific route before /:id) ====================
router.get('/service/:serviceId', subserviceController.getSubservicesByService);

// ==================== LIST ALL (Must be before /:id) ====================
router.get('/', subserviceController.getAllSubservices);

// ==================== CREATE (Must be before /:id) ====================
router.post('/', subserviceController.createSubservice);

// ==================== SPECIFIC ID ROUTES (Must come BEFORE generic /:id route) ====================

// Toggle status - MUST be before /:id
router.patch('/:id/status', subserviceController.toggleSubserviceStatus);

// Toggle field - MUST be before /:id
router.patch('/:id/toggle', subserviceController.toggleSubserviceField);

// ==================== GENERIC ID ROUTES (Must be LAST) ====================

// Get by ID
router.get('/:id', subserviceController.getSubserviceById);

// Update - Both PUT and PATCH
router.put('/:id', subserviceController.updateSubservice);
router.patch('/:id', subserviceController.updateSubservice);

// Delete
router.delete('/:id', subserviceController.deleteSubservice);

module.exports = router;