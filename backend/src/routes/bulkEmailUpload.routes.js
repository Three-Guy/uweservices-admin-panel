// backend/src/routes/bulkEmailUpload.routes.js
const express = require('express');
const router = express.Router();
const multer = require('multer');

console.log('[BulkEmailRoutes] 🔧 Loading...');

// Multer config — store file in memory
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const ext = file.originalname.toLowerCase();
    if (ext.endsWith('.csv') || ext.endsWith('.txt')) {
      cb(null, true);
    } else {
      cb(new Error('Only .csv and .txt files are allowed'));
    }
  }
});

// Load controller
let ctrl;
try {
  ctrl = require('../controllers/bulkEmailUpload.controller');
  console.log('[BulkEmailRoutes] ✅ Controller loaded');
  console.log('[BulkEmailRoutes]    Methods:', Object.keys(ctrl).join(', '));
} catch (err) {
  console.error('[BulkEmailRoutes] ❌ Controller load failed:', err.message);
  console.error('[BulkEmailRoutes] Stack:', err.stack);
  throw err;
}

// Load auth middleware — try multiple names
let authMiddleware = null;
const authPaths = [
  { path: '../middleware/auth', names: ['authenticate', 'authenticateAdmin', 'protect', 'verifyAdmin', 'requireAuth'] },
  { path: '../middleware/auth.middleware', names: ['authenticate', 'authenticateAdmin', 'protect'] },
  { path: '../middleware/authMiddleware', names: ['authenticate', 'authenticateAdmin', 'protect'] },
  { path: '../middleware/adminAuth', names: ['authenticate', 'authenticateAdmin', 'protect'] },
];

for (const { path, names } of authPaths) {
  if (authMiddleware) break;
  try {
    const mod = require(path);
    for (const name of names) {
      if (typeof mod[name] === 'function') {
        authMiddleware = mod[name];
        console.log(`[BulkEmailRoutes] ✅ Auth: ${path} → ${name}`);
        break;
      }
    }
    if (!authMiddleware && typeof mod === 'function') {
      authMiddleware = mod;
      console.log(`[BulkEmailRoutes] ✅ Auth: ${path} (default export)`);
    }
  } catch (e) {}
}

if (authMiddleware) {
  router.use(authMiddleware);
} else {
  console.warn('[BulkEmailRoutes] ⚠️ NO AUTH — routes unprotected!');
}

// Routes
router.post('/preview', upload.single('file'), ctrl.previewUpload);
router.post('/send', upload.single('file'), ctrl.startBulkSend);
router.get('/jobs', ctrl.listJobs);
router.get('/jobs/:id', ctrl.getJob);
router.get('/jobs/:id/progress', ctrl.getJobProgress);
router.post('/jobs/:id/cancel', ctrl.cancelJob);

console.log('[BulkEmailRoutes] ✅ All 6 routes registered');

module.exports = router;