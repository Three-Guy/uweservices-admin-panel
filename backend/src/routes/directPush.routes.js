// backend/src/routes/directPush.routes.js
const express = require('express');
const router = express.Router();

const authMiddleware = require('../middleware/authMiddleware');
const ctrl = require('../controllers/directPush.controller');

router.use(authMiddleware);

router.post('/send', ctrl.sendDirectPush);
router.get('/preview-count', ctrl.previewCount);
router.get('/search-providers', ctrl.searchProviders);
router.get('/history', ctrl.getHistory);
router.get('/history/:id', ctrl.getHistoryDetail);

module.exports = router;