// src/routes/banner.routes.js
const express = require('express');
const router = express.Router();
const bannerController = require('../controllers/banner.controller');
const { uploadBanner } = require('../config/cloudinary');
const authMiddleware = require('../middleware/authMiddleware');

// All routes require authentication
router.use(authMiddleware);

// Get all banners
router.get('/', bannerController.getBanners);

// Get banner statistics
router.get('/stats', bannerController.getBannerStats);

// Get banner by ID
router.get('/:id', bannerController.getBannerById);

// Create new banner (with image OR video upload - up to 50MB)
router.post('/', uploadBanner.single('image'), bannerController.createBanner);

// Update banner (with optional image/video update)
router.put('/:id', uploadBanner.single('image'), bannerController.updateBanner);

// Delete banner
router.delete('/:id', bannerController.deleteBanner);

// Reorder banners
router.post('/reorder', bannerController.reorderBanners);

module.exports = router;