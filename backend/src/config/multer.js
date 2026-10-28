// src/config/multer.js
const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const { cloudinary } = require('./cloudinary');

// ==================== CONSTANTS ====================
const IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
];

const VIDEO_MIME_TYPES = [
  'video/webm',
  'video/mp4',
  'video/ogg',
  'video/quicktime',
  'video/x-msvideo',
  'video/x-matroska',
];

const IMAGE_FORMATS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'];
const VIDEO_FORMATS = ['webm', 'mp4', 'ogg', 'mov', 'avi', 'mkv'];

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;    // 5MB
const MAX_VIDEO_SIZE = 50 * 1024 * 1024;   // 50MB

const isVideoMime = (m) => !!m && (m.startsWith('video/') || VIDEO_MIME_TYPES.includes(m));
const isImageMime = (m) => !!m && (m.startsWith('image/') || IMAGE_MIME_TYPES.includes(m));

// Cloudinary storage configuration (supports images + videos)
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    // Determine folder based on file field name or default
    let folder = 'uploads';

    if (file.fieldname === 'image') {
      folder = 'images';
    } else if (file.fieldname === 'logo') {
      folder = 'logos';
    } else if (file.fieldname === 'banner') {
      folder = 'banners';
    } else if (file.fieldname === 'avatar') {
      folder = 'avatars';
    } else if (file.fieldname === 'video') {
      folder = 'videos';
    }

    const isVideo = isVideoMime(file.mimetype);

    const params = {
      folder: `admin-panel/${folder}`,
      resource_type: isVideo ? 'video' : 'image',
      allowed_formats: isVideo ? VIDEO_FORMATS : IMAGE_FORMATS,
      public_id: `${Date.now()}-${file.originalname.split('.')[0]}`,
    };

    if (!isVideo) {
      params.transformation = [
        { width: 1200, height: 1200, crop: 'limit' },
        { quality: 'auto' },
        { fetch_format: 'auto' },
      ];
    } else {
      params.transformation = [
        { width: 1280, height: 720, crop: 'limit' },
        { quality: 'auto' },
      ];
    }

    return params;
  },
});

// File filter to accept images AND videos
const fileFilter = (req, file, cb) => {
  if (isImageMime(file.mimetype) || isVideoMime(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new Error(
        `Invalid file type: ${file.mimetype}. Allowed images: ${IMAGE_MIME_TYPES.join(', ')}. Allowed videos: ${VIDEO_MIME_TYPES.join(', ')}.`
      ),
      false
    );
  }
};

// Image-only filter
const imageOnlyFilter = (req, file, cb) => {
  if (isImageMime(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Invalid file type. Only ${IMAGE_MIME_TYPES.join(', ')} are allowed.`), false);
  }
};

// Multer upload instance (default: supports both images + videos up to 50MB)
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: MAX_VIDEO_SIZE, // 50MB to accommodate video uploads
  },
});

// Export as function wrapper for backward compat (so `upload.single(...)` works)
module.exports = upload;

// Also expose named exports
module.exports.upload = upload;
module.exports.imageOnlyFilter = imageOnlyFilter;
module.exports.mediaFilter = fileFilter;
module.exports.MAX_IMAGE_SIZE = MAX_IMAGE_SIZE;
module.exports.MAX_VIDEO_SIZE = MAX_VIDEO_SIZE;