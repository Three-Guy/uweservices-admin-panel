// backend/src/routes/bulkEmailUpload.routes.js
const express = require('express');
const router = express.Router();

const authMiddleware = require('../middleware/authMiddleware');
const uploadMemory = require('../config/multerMemory');
const ctrl = require('../controllers/bulkEmailUpload.controller');

router.use(authMiddleware);

router.post('/preview', uploadMemory.single('file'), ctrl.previewUpload);
router.post('/send', uploadMemory.single('file'), ctrl.startBulkSend);
router.get('/jobs', ctrl.listJobs);
router.get('/jobs/:id', ctrl.getJob);
router.get('/jobs/:id/progress', ctrl.getJobProgress);

// Multer error handler specific to this router
router.use((err, req, res, next) => {
  if (err) {
    const msg = err.message || 'Upload error';
    const code = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    return res.status(code).json({ success: false, message: msg });
  }
  next();
});

module.exports = router;