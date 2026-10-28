// src/config/cloudinary.js
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

console.log('📦 Cloudinary Configuration:');
console.log('   Cloud Name:', process.env.CLOUDINARY_CLOUD_NAME ? '✓ Set' : '✗ Not Set');
console.log('   API Key:', process.env.CLOUDINARY_API_KEY ? '✓ Set' : '✗ Not Set');

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
  'video/quicktime',    // .mov
  'video/x-msvideo',    // .avi
  'video/x-matroska',   // .mkv
];

const IMAGE_FORMATS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'];
const VIDEO_FORMATS = ['webm', 'mp4', 'ogg', 'mov', 'avi', 'mkv'];

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;   // 5MB
const MAX_VIDEO_SIZE = 50 * 1024 * 1024;  // 50MB

// Helper: check if file is video
const isVideoMime = (mimetype) => {
  if (!mimetype) return false;
  return mimetype.startsWith('video/') || VIDEO_MIME_TYPES.includes(mimetype);
};

// Helper: check if file is image
const isImageMime = (mimetype) => {
  if (!mimetype) return false;
  return mimetype.startsWith('image/') || IMAGE_MIME_TYPES.includes(mimetype);
};

// ==================== GENERIC STORAGE ====================
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    let folder = 'service-app/uploads';

    // Dynamic folder based on route
    if (req.baseUrl && req.baseUrl.includes('categories')) {
      folder = 'service-app/categories';
    } else if (req.baseUrl && req.baseUrl.includes('banners')) {
      folder = 'service-app/banners';
    } else if (req.baseUrl && req.baseUrl.includes('services')) {
      folder = 'service-app/services';
    }

    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const isVideo = isVideoMime(file.mimetype);

    const params = {
      folder: folder,
      resource_type: isVideo ? 'video' : 'image',
      allowed_formats: isVideo ? VIDEO_FORMATS : IMAGE_FORMATS,
      public_id: `${file.fieldname}-${uniqueSuffix}`,
    };

    // Only apply image transformations to images
    if (!isVideo) {
      params.transformation = [{ width: 1200, height: 1200, crop: 'limit', quality: 'auto' }];
    }

    return params;
  },
});

// Storage for banners (supports images AND videos)
const bannerStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const isVideo = isVideoMime(file.mimetype);

    const params = {
      folder: 'service-app/banners',
      resource_type: isVideo ? 'video' : 'image',
      allowed_formats: isVideo ? VIDEO_FORMATS : IMAGE_FORMATS,
      public_id: `banner-${uniqueSuffix}`,
    };

    if (!isVideo) {
      // Image transformation
      params.transformation = [{ width: 1200, height: 600, crop: 'limit', quality: 'auto' }];
    } else {
      // Video transformation - limit size and quality
      params.transformation = [
        { width: 1280, height: 720, crop: 'limit' },
        { quality: 'auto' },
      ];
    }

    return params;
  },
});

// Storage for categories (images only)
const categoryStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'service-app/categories',
    resource_type: 'image',
    allowed_formats: IMAGE_FORMATS,
    transformation: [{ width: 800, height: 800, crop: 'limit', quality: 'auto' }],
    public_id: (req, file) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      return `category-${uniqueSuffix}`;
    },
  },
});

// Storage for services (images only)
const serviceStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'service-app/services',
    resource_type: 'image',
    allowed_formats: IMAGE_FORMATS,
    transformation: [{ width: 1000, height: 1000, crop: 'limit', quality: 'auto' }],
    public_id: (req, file) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      return `service-${uniqueSuffix}`;
    },
  },
});

// ==================== FILE FILTERS ====================

// Image-only filter
const imageOnlyFilter = (req, file, cb) => {
  if (isImageMime(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPG, PNG, GIF, WebP and SVG images are allowed.'), false);
  }
};

// Image + Video filter (for banners)
const mediaFilter = (req, file, cb) => {
  if (isImageMime(file.mimetype) || isVideoMime(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new Error(
        'Invalid file type. Only images (JPG, PNG, GIF, WebP, SVG) and videos (WebM, MP4, OGG, MOV, AVI, MKV) are allowed.'
      ),
      false
    );
  }
};

// Generic file filter (backward compat - supports both now)
const fileFilter = mediaFilter;

// ==================== UPLOAD INSTANCES ====================

// Generic upload (images + videos)
const upload = multer({
  storage: storage,
  fileFilter: mediaFilter,
  limits: {
    fileSize: MAX_VIDEO_SIZE, // Allow up to 50MB (will accept smaller images too)
  },
});

// Banner upload (supports images AND videos up to 50MB)
const uploadBanner = multer({
  storage: bannerStorage,
  fileFilter: mediaFilter,
  limits: {
    fileSize: MAX_VIDEO_SIZE, // 50MB to allow videos
  },
});

// Category upload (images only, 5MB)
const uploadCategory = multer({
  storage: categoryStorage,
  fileFilter: imageOnlyFilter,
  limits: { fileSize: MAX_IMAGE_SIZE },
});

// Service upload (images only, 5MB)
const uploadService = multer({
  storage: serviceStorage,
  fileFilter: imageOnlyFilter,
  limits: { fileSize: MAX_IMAGE_SIZE },
});

// ==================== HELPER FUNCTIONS ====================

/**
 * Delete asset (image or video) from Cloudinary
 * @param {string} publicId - Public ID of the asset
 * @param {string} resourceType - 'image' or 'video' (default: 'image')
 */
const deleteImage = async (publicId, resourceType = 'image') => {
  try {
    if (!publicId) return;
    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType,
    });
    console.log(`🗑️ Deleted ${resourceType}:`, publicId, result);
    return result;
  } catch (error) {
    console.error(`❌ Error deleting ${resourceType}:`, error.message);
    // Try the other resource type as fallback
    if (resourceType === 'image') {
      try {
        const result = await cloudinary.uploader.destroy(publicId, {
          resource_type: 'video',
        });
        console.log('🗑️ Deleted video (fallback):', publicId, result);
        return result;
      } catch (e) {
        console.error('❌ Fallback delete also failed:', e.message);
      }
    }
    throw error;
  }
};

/**
 * Delete video from Cloudinary
 */
const deleteVideo = async (publicId) => {
  return deleteImage(publicId, 'video');
};

/**
 * Extract public_id from Cloudinary URL
 */
const extractPublicId = (url) => {
  try {
    if (!url) return null;
    const matches = url.match(/\/v\d+\/(.+)\.\w+$/);
    return matches ? matches[1] : null;
  } catch (error) {
    console.error('Error extracting public_id:', error);
    return null;
  }
};

/**
 * Detect if a URL points to a video based on extension
 */
const isVideoUrl = (url) => {
  if (!url || typeof url !== 'string') return false;
  const lower = url.toLowerCase().split('?')[0];
  return VIDEO_FORMATS.some((ext) => lower.endsWith(`.${ext}`));
};

/**
 * Get resource type from mimetype
 */
const getResourceType = (mimetype) => {
  return isVideoMime(mimetype) ? 'video' : 'image';
};

module.exports = {
  cloudinary,
  upload,
  uploadBanner,
  uploadCategory,
  uploadService,
  deleteImage,
  deleteVideo,
  extractPublicId,
  isVideoUrl,
  isVideoMime,
  isImageMime,
  getResourceType,
  IMAGE_MIME_TYPES,
  VIDEO_MIME_TYPES,
  IMAGE_FORMATS,
  VIDEO_FORMATS,
  MAX_IMAGE_SIZE,
  MAX_VIDEO_SIZE,
};