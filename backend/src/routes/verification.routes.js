const express = require('express');
const router = express.Router();
const verificationController = require('../controllers/verification.controller');
const authMiddleware = require('../middleware/authMiddleware');

// Debug middleware
router.use((req, res, next) => {
  console.log(`\n📍 Verification Route: ${req.method} ${req.path}`);
  next();
});

// Auth required for all routes
router.use(authMiddleware);

// Debug
router.get('/debug', verificationController.debugVerifications);

// Stats
router.get('/stats', verificationController.getVerificationStats);

// List
router.get('/', verificationController.getAllVerifications);
router.get('/pending', verificationController.getPendingVerifications);

// Bulk actions (MUST be before /:id routes)
router.post('/bulk/approve', verificationController.bulkApprove);
router.post('/bulk/reject', verificationController.bulkReject);

// By provider
router.get('/provider/:providerId', verificationController.getVerificationsByProvider);

// Single verification
router.get('/:id', verificationController.getVerificationById);
router.post('/:id/approve', verificationController.approveVerification);
router.post('/:id/reject', verificationController.rejectVerification);
router.post('/:id/resubmit', verificationController.requestResubmission);
router.post('/:id/review', verificationController.markUnderReview);
router.delete('/:id', verificationController.deleteVerification);

module.exports = router;