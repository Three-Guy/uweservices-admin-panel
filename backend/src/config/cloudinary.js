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
    
    return {
      folder: folder,
      allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
      transformation: [{ width: 1200, height: 1200, crop: 'limit', quality: 'auto' }],
      public_id: `${file.fieldname}-${uniqueSuffix}`,
    };
  },
});

// Storage for banners
const bannerStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'service-app/banners',
    allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
    transformation: [{ width: 1200, height: 600, crop: 'limit', quality: 'auto' }],
    public_id: (req, file) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      return `banner-${uniqueSuffix}`;
    },
  },
});

// Storage for categories
const categoryStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'service-app/categories',
    allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
    transformation: [{ width: 800, height: 800, crop: 'limit', quality: 'auto' }],
    public_id: (req, file) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      return `category-${uniqueSuffix}`;
    },
  },
});

// Storage for services
const serviceStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'service-app/services',
    allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
    transformation: [{ width: 1000, height: 1000, crop: 'limit', quality: 'auto' }],
    public_id: (req, file) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      return `service-${uniqueSuffix}`;
    },
  },
});

// Generic file filter
const fileFilter = (req, file, cb) => {
  const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
  
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPG, PNG, GIF and WebP are allowed.'), false);
  }
};

// Generic upload instance
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
});

// Specific upload instances
const uploadBanner = multer({
  storage: bannerStorage,
  fileFilter: fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
});

const uploadCategory = multer({
  storage: categoryStorage,
  fileFilter: fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
});

const uploadService = multer({
  storage: serviceStorage,
  fileFilter: fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
});

// Helper function to delete image from Cloudinary
const deleteImage = async (publicId) => {
  try {
    if (!publicId) return;
    const result = await cloudinary.uploader.destroy(publicId);
    console.log('🗑️ Deleted image:', publicId, result);
    return result;
  } catch (error) {
    console.error('❌ Error deleting image:', error.message);
    throw error;
  }
};

// Helper function to extract public_id from Cloudinary URL
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

module.exports = {
  cloudinary,
  upload,
  uploadBanner,
  uploadCategory,
  uploadService,
  deleteImage,
  extractPublicId,
};