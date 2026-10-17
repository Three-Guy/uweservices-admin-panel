const express = require('express');
const router = express.Router();
const userController = require('../controllers/user.controller');
const authMiddleware = require('../middleware/authMiddleware');

// Debug middleware for user routes only
router.use((req, res, next) => {
  console.log(`\n📍 User Route Hit: ${req.method} ${req.path}`);
  console.log('📦 Query:', req.query);
  if (req.body && Object.keys(req.body).length > 0) {
    console.log('📦 Body:', JSON.stringify(req.body, null, 2));
  }
  next();
});

// ✅ All user routes require authentication
router.use(authMiddleware);

// Get user statistics - MUST be before /:id route
router.get('/stats', userController.getUserStats);

// Export users to CSV data - MUST be before /:id route
router.get('/export/csv', userController.exportUsersCSV);

// ✅ NEW: Delete multiple users - MUST be before /:id route
router.post('/delete-multiple', userController.deleteMultipleUsers);

// Get all users with filters and pagination
router.get('/', userController.getAllUsers);

// Get user by ID
router.get('/:id', userController.getUserById);

// Update user
router.patch('/:id', userController.updateUser);

// Toggle user status (activate/deactivate)
router.patch('/:id/status', userController.toggleUserStatus);

// Restore deleted user
router.patch('/:id/restore', userController.restoreUser);

// Delete user (soft delete)
router.delete('/:id', userController.deleteUser);

module.exports = router;