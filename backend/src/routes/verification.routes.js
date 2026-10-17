const express = require('express');
const router = express.Router();
const verificationController = require('../controllers/verification.controller');
const authMiddleware = require('../middleware/authMiddleware');

// Debug middleware
router.use((req, res, next) => {
  console.log(`\n📍 Verification Route: ${req.method} ${req.path}`);
  next();
});

// All routes require authentication
router.use(authMiddleware);

// Debug endpoint
router.get('/debug', verificationController.debugVerifications);

// Get verification stats
router.get('/stats', verificationController.getVerificationStats);

// Get all verifications
router.get('/', verificationController.getAllVerifications);

// Get pending verifications
router.get('/pending', verificationController.getPendingVerifications);

// Get verification by ID
router.get('/:id', verificationController.getVerificationById);

// Approve verification
router.post('/:id/approve', verificationController.approveVerification);

// Reject verification
router.post('/:id/reject', verificationController.rejectVerification);

module.exports = router;