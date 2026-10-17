// src/routes/notification.routes.js
const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notification.controller');
const authMiddleware = require('../middleware/authMiddleware');

// Debug middleware
router.use((req, res, next) => {
  console.log(`\n📍 Notification Route: ${req.method} ${req.path}`);
  next();
});

// All routes require authentication
router.use(authMiddleware);

// ===== CRUD ROUTES =====

// GET /api/v1/admin/notifications/stats - Get notification statistics
router.get('/stats', notificationController.getNotificationStats);

// GET /api/v1/admin/notifications - Get all notifications
router.get('/', notificationController.getAllNotifications);

// POST /api/v1/admin/notifications - Create a new notification
router.post('/', notificationController.createNotification);

// POST /api/v1/admin/notifications/send-now - Create and send immediately
router.post('/send-now', notificationController.sendNotificationNow);

// GET /api/v1/admin/notifications/:id - Get notification by ID
router.get('/:id', notificationController.getNotificationById);

// PUT /api/v1/admin/notifications/:id - Update notification
router.put('/:id', notificationController.updateNotification);

// DELETE /api/v1/admin/notifications/:id - Delete notification
router.delete('/:id', notificationController.deleteNotification);

// ===== ACTION ROUTES =====

// POST /api/v1/admin/notifications/:id/send - Send a notification
router.post('/:id/send', notificationController.sendNotification);

// POST /api/v1/admin/notifications/:id/cancel - Cancel a scheduled notification
router.post('/:id/cancel', notificationController.cancelNotification);

// POST /api/v1/admin/notifications/:id/duplicate - Duplicate a notification
router.post('/:id/duplicate', notificationController.duplicateNotification);

module.exports = router;