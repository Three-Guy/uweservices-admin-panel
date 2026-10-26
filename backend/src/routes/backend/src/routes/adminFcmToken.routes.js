// backend/src/routes/adminFcmToken.routes.js
const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/adminFcmToken.controller');
// NOTE: NO auth middleware on /register — because token registration happens
// right after login, and we need it to work even if auth header is temporarily missing

router.post('/register', ctrl.register);
router.post('/unregister', ctrl.unregister);
router.get('/my-tokens', ctrl.listMyTokens);

module.exports = router;