// src/config/multer.js
const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('./cloudinary');

// Cloudinary storage configuration
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
    }

    return {
      folder: `admin-panel/${folder}`,
      allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'],
      transformation: [
        { width: 1200, height: 1200, crop: 'limit' }, // Max dimensions
        { quality: 'auto' },
        { fetch_format: 'auto' },
      ],
      public_id: `${Date.now()}-${file.originalname.split('.')[0]}`,
    };
  },
});

// File filter to accept only images
const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/svg+xml',
  ];

  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new Error(
        `Invalid file type. Only ${allowedMimeTypes.join(', ')} are allowed.`
      ),
      false
    );
  }
};

// Multer upload instance
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max file size
  },
});

module.exports = upload;