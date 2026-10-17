// src/routes/sdui.routes.js
const express = require('express');
const router = express.Router();

// Controllers
const bannerController = require('../controllers/banner.controller');
const categoryController = require('../controllers/category.controller');
const serviceController = require('../controllers/service.controller');
const subserviceController = require('../controllers/subservice.controller');
const layoutController = require('../controllers/layout.controller');
const trendingController = require('../controllers/trending.controller');
const featureFlagController = require('../controllers/featureFlag.controller');

// Middleware
const authMiddleware = require('../middleware/authMiddleware');
const { upload } = require('../config/cloudinary');

// Apply authentication middleware to all SDUI routes
router.use(authMiddleware);

// ==================== BANNER ROUTES ====================
router.get('/banners', bannerController.getBanners);
router.get('/banners/stats', bannerController.getBannerStats);
router.get('/banners/:id', bannerController.getBannerById);
router.post('/banners', upload.single('image'), bannerController.createBanner);
router.put('/banners/:id', upload.single('image'), bannerController.updateBanner);
router.delete('/banners/:id', bannerController.deleteBanner);
router.post('/banners/reorder', bannerController.reorderBanners);

// ==================== CATEGORY ROUTES ====================
router.get('/categories', categoryController.getCategories);
router.get('/categories/stats', categoryController.getCategoryStats);
router.get('/categories/:id', categoryController.getCategoryById);
router.post('/categories', upload.single('image'), categoryController.createCategory);
router.put('/categories/:id', upload.single('image'), categoryController.updateCategory);
router.delete('/categories/:id', categoryController.deleteCategory);
router.post('/categories/reorder', categoryController.reorderCategories);
router.patch('/categories/:id/update-count', categoryController.updateServicesCount);

// ==================== SERVICE ROUTES ====================
router.get('/services', serviceController.getAllServices);
router.get('/services/stats', serviceController.getServiceStats);
router.get('/services/category/:categoryId', serviceController.getServicesByCategory);
router.get('/services/:id', serviceController.getServiceById);
router.post('/services', serviceController.createService);
router.put('/services/:id', serviceController.updateService);
router.patch('/services/:id', serviceController.updateService);  // ✅ ADD THIS
router.patch('/services/:id/status', serviceController.toggleServiceStatus);
router.delete('/services/:id', serviceController.deleteService);
router.post('/services/reorder', serviceController.reorderServices);
router.post('/services/bulk-update', serviceController.bulkUpdateServices);

// ==================== SUBSERVICE ROUTES ====================
// Stats - Must be BEFORE /:id routes
router.get('/subservices/stats', subserviceController.getSubserviceStats);

// Bulk operations - Must be BEFORE /:id routes
router.post('/subservices/reorder', subserviceController.reorderSubservices);
router.post('/subservices/bulk-update', subserviceController.bulkUpdateSubservices);

// By category - Must be BEFORE /:id routes
router.get('/subservices/category/:categoryId', subserviceController.getSubservicesByCategory);

// By service (backward compatibility) - Must be BEFORE /:id routes
router.get('/subservices/service/:serviceId', subserviceController.getSubservicesByService);

// List all
router.get('/subservices', subserviceController.getAllSubservices);

// Create
router.post('/subservices', subserviceController.createSubservice);

// ✅ IMPORTANT: Specific :id routes MUST come BEFORE generic :id routes
// Toggle status
router.patch('/subservices/:id/status', subserviceController.toggleSubserviceStatus);

// Toggle any field (isPopular, isFeatured, etc.)
router.patch('/subservices/:id/toggle', subserviceController.toggleSubserviceField);

// ✅ Generic :id routes MUST come LAST
// Get by ID
router.get('/subservices/:id', subserviceController.getSubserviceById);

// Update - Both PUT and PATCH
router.put('/subservices/:id', subserviceController.updateSubservice);
router.patch('/subservices/:id', subserviceController.updateSubservice);  // ✅ THIS WAS MISSING!

// Delete
router.delete('/subservices/:id', subserviceController.deleteSubservice);

// ==================== LAYOUT ROUTES ====================
router.get('/layouts', layoutController.getLayouts);
router.get('/layouts/:page', layoutController.getLayoutByPage);
router.post('/layouts', layoutController.createLayout);
router.put('/layouts/:id', layoutController.updateLayout);
router.patch('/layouts/:id/sections', layoutController.updateSections);
router.post('/layouts/:id/sections/reorder', layoutController.reorderSections);
router.post('/layouts/:id/sections', layoutController.addSection);
router.patch('/layouts/:id/sections/:sectionId', layoutController.updateSectionConfig);
router.patch('/layouts/:id/sections/:sectionId/toggle', layoutController.toggleSection);
router.delete('/layouts/:id/sections/:sectionId', layoutController.deleteSection);
router.post('/layouts/:id/draft', layoutController.saveDraft);
router.post('/layouts/:id/publish', layoutController.publishLayout);
router.delete('/layouts/:id', layoutController.deleteLayout);

// ==================== TRENDING ROUTES ====================
router.get('/trending', trendingController.getTrendingServices);
router.get('/trending/:id', trendingController.getTrendingServiceById);
router.post('/trending', trendingController.createTrendingService);
router.put('/trending/:id', trendingController.updateTrendingService);
router.delete('/trending/:id', trendingController.deleteTrendingService);
router.post('/trending/reorder', trendingController.reorderTrendingServices);
router.post('/trending/sync', trendingController.syncTrendingStats);

// ==================== FEATURE FLAG ROUTES ====================
router.get('/feature-flags', featureFlagController.getAllFeatureFlags);
router.get('/feature-flags/stats', featureFlagController.getFeatureFlagStats);
router.get('/feature-flags/active', featureFlagController.getActiveFlags);
router.get('/feature-flags/check/:key', featureFlagController.checkFeatureFlag);
router.get('/feature-flags/key/:key', featureFlagController.getFeatureFlagByKey);
router.get('/feature-flags/:id', featureFlagController.getFeatureFlagById);
router.get('/feature-flags/:id/history', featureFlagController.getFeatureFlagHistory);
router.post('/feature-flags', featureFlagController.createFeatureFlag);
router.put('/feature-flags/:id', featureFlagController.updateFeatureFlag);
router.patch('/feature-flags/:id/toggle', featureFlagController.toggleFeatureFlag);
router.post('/feature-flags/bulk-toggle', featureFlagController.bulkToggleFeatureFlags);
router.post('/feature-flags/:id/duplicate', featureFlagController.duplicateFeatureFlag);
router.delete('/feature-flags/:id', featureFlagController.deleteFeatureFlag);
router.patch('/feature-flags/:id/restore', featureFlagController.restoreFeatureFlag);

module.exports = router;