// src/routes/layout.routes.js
const express = require('express');
const router = express.Router();
const layoutController = require('../controllers/layout.controller');
const authMiddleware = require('../middleware/authMiddleware');

// All routes require authentication
router.use(authMiddleware);

// Get all layouts
router.get('/', layoutController.getLayouts);

// Get layout by page name
router.get('/page/:page', layoutController.getLayoutByPage);

// Create new layout
router.post('/', layoutController.createLayout);

// Update layout
router.put('/:id', layoutController.updateLayout);

// Update layout sections
router.put('/:id/sections', layoutController.updateSections);

// Reorder sections
router.put('/:id/sections/reorder', layoutController.reorderSections);

// Toggle section
router.patch('/:id/sections/:sectionId/toggle', layoutController.toggleSection);

// Update section config
router.patch('/:id/sections/:sectionId', layoutController.updateSectionConfig);

// Add section
router.post('/:id/sections', layoutController.addSection);

// Delete section
router.delete('/:id/sections/:sectionId', layoutController.deleteSection);

// Save draft
router.post('/:id/draft', layoutController.saveDraft);

// Publish layout
router.post('/:id/publish', layoutController.publishLayout);

// Delete layout
router.delete('/:id', layoutController.deleteLayout);

module.exports = router;