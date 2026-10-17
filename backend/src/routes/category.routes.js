// src/routes/category.routes.js
const express = require('express');
const router = express.Router();
const categoryController = require('../controllers/category.controller');
const authMiddleware = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/authMiddleware');
const { upload } = require('../config/cloudinary');

// All routes require authentication
router.use(authMiddleware);

// ==================== CATEGORY ROUTES ====================

// Get all categories
router.get('/', categoryController.getCategories);

// Get category stats
router.get('/stats', categoryController.getCategoryStats);

// 🆕 NEW: Get category grid (3 + More Services)
router.get('/grid', categoryController.getCategoryGrid);

// 🆕 NEW: Get all categories with subservices
router.get('/all-with-subservices', categoryController.getAllCategoriesWithSubservices);

// Get "More Services" configuration
router.get('/more-services-config', categoryController.getMoreServicesConfig);

// Update "More Services" configuration (PUT - must be before /:id routes)
router.put(
  '/more-services-config',
  requireRole('admin', 'super_admin'),
  categoryController.updateMoreServicesConfig
);

// Reorder categories (POST - must be before /:id routes)
router.post(
  '/reorder',
  requireRole('admin', 'super_admin'),
  categoryController.reorderCategories
);

// Create category (with image upload)
router.post(
  '/',
  requireRole('admin', 'super_admin'),
  upload.single('image'),
  categoryController.createCategory
);

// Get category by ID (place after specific routes to avoid conflicts)
router.get('/:id', categoryController.getCategoryById);

// Update category (with optional image upload)
router.put(
  '/:id',
  requireRole('admin', 'super_admin'),
  upload.single('image'),
  categoryController.updateCategory
);

// Update services count
router.patch(
  '/:id/services-count',
  requireRole('admin', 'super_admin'),
  categoryController.updateServicesCount
);

// Delete category
router.delete(
  '/:id',
  requireRole('admin', 'super_admin'),
  categoryController.deleteCategory
);

module.exports = router;