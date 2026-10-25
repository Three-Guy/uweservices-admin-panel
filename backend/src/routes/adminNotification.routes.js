// src/routes/adminNotification.routes.js
const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const ctrl = require('../controllers/adminNotification.controller');

router.use(authMiddleware);

router.get('/', ctrl.list);
router.get('/unread-count', ctrl.getUnreadCount);
router.patch('/mark-all-read', ctrl.markAllRead);
router.patch('/:id/read', ctrl.markRead);
router.delete('/:id', ctrl.delete);

module.exports = router;