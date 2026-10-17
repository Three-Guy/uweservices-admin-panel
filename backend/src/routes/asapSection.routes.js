// src/routes/asapSection.routes.js
const express = require('express');
const router = express.Router();
const asapSectionController = require('../controllers/asapSection.controller');

// Middleware
const authMiddleware = require('../middleware/authMiddleware');

// Debug middleware
router.use((req, res, next) => {
  console.log(`\n📨 ASAP Section: ${req.method} ${req.path}`);
  if (req.body && Object.keys(req.body).length > 0) {
    console.log('📦 Body:', JSON.stringify(req.body, null, 2));
  }
  next();
});

// ==================== PUBLIC ROUTES (For Mobile App) ====================
// Get active ASAP sections for app
router.get('/app/active', asapSectionController.getActiveSectionsForApp);

// ==================== ADMIN ROUTES ====================
router.use(authMiddleware);

// Seed default section (for initial setup)
router.post('/seed', asapSectionController.seedDefaultSection);

// Get all categories for selection
router.get('/categories', asapSectionController.getAllCategories);

// Get subservices by category (MUST be before /:id routes)
router.get('/subservices/category/:categoryId', asapSectionController.getSubservicesByCategory);

// Get available subservices for a section (MUST be before /:id routes)
router.get('/:id/available-subservices', asapSectionController.getAvailableSubservices);

// CRUD operations
router.get('/', asapSectionController.getAllASAPSections);
router.post('/', asapSectionController.createASAPSection);
router.get('/:id', asapSectionController.getASAPSectionById);
router.put('/:id', asapSectionController.updateASAPSection); // ✅ LINE 38 - Check this function exists
router.delete('/:id', asapSectionController.deleteASAPSection);

// Clone section
router.post('/:id/clone', asapSectionController.cloneASAPSection);

// Item management
router.post('/:id/items', asapSectionController.addItemToSection);
router.put('/:id/items/bulk', asapSectionController.bulkUpdateItems);
router.put('/:id/items/reorder', asapSectionController.reorderSectionItems);
router.put('/:id/items/:itemId', asapSectionController.updateSectionItem);
router.delete('/:id/items/:itemId', asapSectionController.removeItemFromSection);

module.exports = router;