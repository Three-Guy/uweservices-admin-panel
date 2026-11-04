// backend/src/config/multerMemory.js
// Separate in-memory multer instance for CSV/TXT uploads.
// Does NOT touch existing Cloudinary multer config.

const multer = require('multer');
const path = require('path');

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const allowedExts = ['.csv', '.txt'];
  const allowedMimes = [
    'text/csv',
    'text/plain',
    'application/csv',
    'application/vnd.ms-excel',
    'application/octet-stream',
  ];

  const ext = path.extname(file.originalname || '').toLowerCase();
  const mime = (file.mimetype || '').toLowerCase();

  if (allowedExts.includes(ext) || allowedMimes.includes(mime)) {
    return cb(null, true);
  }

  cb(new Error('Only .csv or .txt files are allowed'));
};

const uploadMemory = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB
    files: 1,
  },
});

module.exports = uploadMemory;
module.exports.uploadMemory = uploadMemory;
module.exports.default = uploadMemory;