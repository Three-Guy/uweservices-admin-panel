const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const authMiddleware = require('../middleware/authMiddleware');

// Debug middleware
router.use((req, res, next) => {
  console.log(`\n📍 Auth Route Hit: ${req.method} ${req.path}`);
  console.log('📦 Body:', JSON.stringify(req.body, null, 2));
  next();
});

// Public routes (NO authentication required)
router.post('/login', authController.login);
router.post('/refresh-token', authController.refreshToken);

// Protected routes (authentication required)
router.get('/me', authMiddleware, authController.getCurrentAdmin);
router.post('/logout', authMiddleware, authController.logout);

module.exports = router;