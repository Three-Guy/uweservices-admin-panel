// backend/src/routes/checkoutRoutes.js
const express = require('express');
const router = express.Router();
const checkoutController = require('../controllers/checkoutController');
const authMiddleware = require('../middleware/authMiddleware');

// Debug middleware
router.use((req, res, next) => {
  console.log(`\n📍 Checkout Route: ${req.method} ${req.path}`);
  next();
});

// ==================== ADMIN ROUTES (Protected) ====================
// Get all settings
router.get('/settings', authMiddleware, checkoutController.getCheckoutSettings);

// Update all settings
router.put('/settings', authMiddleware, checkoutController.updateCheckoutSettings);
router.patch('/settings', authMiddleware, checkoutController.updateCheckoutSettings);

// Individual fee updates
router.patch('/settings/service-fee', authMiddleware, checkoutController.updateServiceFee);
router.patch('/settings/platform-fee', authMiddleware, checkoutController.updatePlatformFee);
router.patch('/settings/tax', authMiddleware, checkoutController.updateTax);

// Payment methods
router.patch('/settings/payment-methods', authMiddleware, checkoutController.updatePaymentMethods);
router.patch('/settings/payment-methods/:method/toggle', authMiddleware, checkoutController.togglePaymentMethod);

// ==================== PUBLIC ROUTES ====================
// Calculate price (can be used by mobile app)
router.post('/calculate', checkoutController.calculatePrice);

// Get enabled payment methods
router.get('/payment-methods', checkoutController.getPaymentMethods);

module.exports = router;