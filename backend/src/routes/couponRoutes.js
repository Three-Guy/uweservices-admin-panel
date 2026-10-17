// backend/src/routes/couponRoutes.js
const express = require('express');
const router = express.Router();
const couponController = require('../controllers/couponController');
const authMiddleware = require('../middleware/authMiddleware');

// Debug middleware
router.use((req, res, next) => {
  console.log(`\n📍 Coupon Route: ${req.method} ${req.path}`);
  next();
});

// ==================== ADMIN ROUTES (Protected) ====================
// Stats
router.get('/stats', authMiddleware, couponController.getCouponStats);

// Usage history
router.get('/:id/usage', authMiddleware, couponController.getCouponUsageHistory);

// CRUD
router.get('/', authMiddleware, couponController.getAllCoupons);
router.get('/:id', authMiddleware, couponController.getCouponById);
router.post('/', authMiddleware, couponController.createCoupon);
router.put('/:id', authMiddleware, couponController.updateCoupon);
router.patch('/:id', authMiddleware, couponController.updateCoupon);
router.delete('/:id', authMiddleware, couponController.deleteCoupon);

// Status toggle
router.patch('/:id/status', authMiddleware, couponController.toggleCouponStatus);

// ==================== PUBLIC ROUTES ====================
// Validate coupon (can be used by mobile app)
router.post('/validate', couponController.validateCoupon);

module.exports = router;