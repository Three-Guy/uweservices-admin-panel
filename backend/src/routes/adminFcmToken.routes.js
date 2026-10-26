// backend/src/routes/adminFcmToken.routes.js
const express = require('express');
const router = express.Router();
const fcmController = require('../controllers/adminFcmToken.controller');

// ⚠️ NO auth middleware on register — called right after login
router.post('/register', fcmController.register);
router.post('/unregister', fcmController.unregister);
router.get('/tokens', fcmController.listMyTokens);
router.post('/test', fcmController.testPush);

module.exports = router;