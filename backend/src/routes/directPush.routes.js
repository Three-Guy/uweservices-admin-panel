// backend/src/routes/directPush.routes.js
const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/directPush.controller');
const { authenticate } = require('../middleware/auth');

// All routes require admin auth
router.use(authenticate);

// Send push notification
router.post('/send', ctrl.sendDirectPush);

// Preview recipient count
router.post('/preview-count', ctrl.previewCount);

// Search providers for autocomplete
router.get('/search-providers', ctrl.searchProviders);

// Browse FCM token holders
router.get('/fcm-users', ctrl.listFcmUsers);
router.get('/fcm-providers', ctrl.listFcmProviders);

// History
router.get('/history', ctrl.getHistory);
router.get('/history/:id', ctrl.getHistoryDetail);

module.exports = router;