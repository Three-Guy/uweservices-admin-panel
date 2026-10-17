// src/models/Subservice.js
const mongoose = require('mongoose');

/**
 * Subservice Schema
 * Individual service items within a category
 * Example: "AC Gas Refill" under "Home Services" category
 */
const subserviceSchema = new mongoose.Schema({
  // Unique identifier
  subserviceId: {
    type: String,
    required: [true, 'Subservice ID is required'],
    unique: true,
    lowercase: true,
    trim: true,
  },

  // ==================== CATEGORY REFERENCE (PRIMARY) ====================
  // Category reference
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: [true, 'Category reference is required'],
  },

  // Category ID (denormalized for queries)
  categoryId: {
    type: String,
    required: true,
  },

  // Category name (denormalized for performance)
  categoryName: {
    type: String,
    trim: true,
  },

  // ==================== SERVICE REFERENCE (OPTIONAL - BACKWARD COMPATIBILITY) ====================
  // Parent service reference (optional now)
  service: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Service',
    default: null,
  },

  // Service ID (denormalized for queries)
  serviceId: {
    type: String,
    default: '',
  },

  // ==================== BASIC INFO ====================
  // Display name
  name: {
    type: String,
    required: [true, 'Subservice name is required'],
    trim: true,
    maxlength: [150, 'Name cannot exceed 150 characters'],
  },

  // Subtitle/tagline
  subtitle: {
    type: String,
    trim: true,
    maxlength: [200, 'Subtitle cannot exceed 200 characters'],
    default: '',
  },

  // Short description
  description: {
    type: String,
    trim: true,
    maxlength: [2000, 'Description cannot exceed 2000 characters'],
    default: '',
  },

  // Icon (emoji)
  icon: {
    type: String,
    default: '🔧',
  },

  // Color class for styling
  colorClass: {
    type: String,
    default: 'bg-blue-100',
  },

  // ==================== IMAGES ====================
  // Main image (legacy)
  image: {
    type: String,
    default: null,
  },

  // Structured images
  images: {
    hero: {
      url: { type: String, default: null },
      publicId: { type: String, default: null },
    },
    thumbnail: {
      url: { type: String, default: null },
      publicId: { type: String, default: null },
    },
    gallery: [{
      url: { type: String },
      publicId: { type: String },
      caption: { type: String },
      sortOrder: { type: Number, default: 0 },
    }],
  },

  // ==================== PRICING ====================
  pricing: {
    // Base price
    price: {
      type: Number,
      required: [true, 'Price is required'],
      min: [0, 'Price cannot be negative'],
    },
    // Original price (for discounts)
    originalPrice: {
      type: Number,
      default: null,
    },
    // Currency
    currency: {
      type: String,
      default: 'INR',
      enum: ['USD', 'INR', 'EUR', 'GBP'],
    },
    // Price display text (e.g., "$20 onwards")
    displayText: {
      type: String,
      default: '',
    },
    // Price type
    priceType: {
      type: String,
      enum: ['fixed', 'starting_from', 'hourly', 'per_sqft', 'per_unit', 'custom'],
      default: 'starting_from',
    },
    // Unit (e.g., "per hour", "per sqft")
    unit: {
      type: String,
      default: '',
    },
  },

  // ==================== DURATION ====================
  duration: {
    // Estimated duration in minutes
    minutes: {
      type: Number,
      default: 60,
    },
    // Display text (e.g., "60 mins", "1-2 hours")
    displayText: {
      type: String,
      default: '60 mins',
    },
  },

  // ==================== RATING ====================
  rating: {
    average: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },
    count: {
      type: Number,
      default: 0,
    },
  },

  // ==================== DISPLAY SETTINGS ====================
  display: {
    // Color class for backgrounds
    colorClass: {
      type: String,
      default: 'bg-blue-100',
    },
    // Badge text (e.g., "Popular", "New", "Hot Offer")
    badge: {
      text: { type: String, default: '' },
      type: { type: String, enum: ['', 'success', 'warning', 'info', 'danger'], default: '' },
    },
    // Sort order
    sortOrder: {
      type: Number,
      default: 0,
    },
  },

  // ==================== STATUS FLAGS ====================
  isActive: {
    type: Boolean,
    default: true,
  },
  isPopular: {
    type: Boolean,
    default: false,
  },
  isFeatured: {
    type: Boolean,
    default: false,
  },
  isNew: {
    type: Boolean,
    default: false,
  },

  // Legacy sortOrder (use display.sortOrder preferably)
  sortOrder: {
    type: Number,
    default: 0,
  },

  // ==================== SERVICE DETAILS ====================
  // What's included
  includes: [{
    type: String,
    trim: true,
  }],

  // What's excluded
  excludes: [{
    type: String,
    trim: true,
  }],

  // Requirements/Prerequisites
  requirements: [{
    type: String,
    trim: true,
  }],

  // Tags for filtering
  tags: [{
    type: String,
    lowercase: true,
    trim: true,
  }],

  // ==================== AVAILABILITY ====================
  availability: {
    isAvailable: {
      type: Boolean,
      default: true,
    },
    cities: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'City',
    }],
    zones: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Zone',
    }],
  },

  // Booking count (for trending/popularity)
  bookingCount: {
    type: Number,
    default: 0,
  },

  // ==================== SEO ====================
  seo: {
    metaTitle: { type: String, maxlength: 70 },
    metaDescription: { type: String, maxlength: 160 },
    keywords: [{ type: String }],
  },

  // ==================== METADATA ====================
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
  },
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

// ==================== INDEXES ====================
subserviceSchema.index({ subserviceId: 1 }, { unique: true });
subserviceSchema.index({ category: 1 });
subserviceSchema.index({ categoryId: 1 });
subserviceSchema.index({ service: 1 });
subserviceSchema.index({ serviceId: 1 });
subserviceSchema.index({ isActive: 1 });
subserviceSchema.index({ isPopular: 1 });
subserviceSchema.index({ isFeatured: 1 });
subserviceSchema.index({ sortOrder: 1 });
subserviceSchema.index({ 'display.sortOrder': 1 });
subserviceSchema.index({ 'pricing.price': 1 });
subserviceSchema.index({ name: 'text', description: 'text', tags: 'text' });

// ==================== PRE-SAVE MIDDLEWARE ====================
subserviceSchema.pre('save', async function(next) {
  // Auto-generate subserviceId
  if (!this.subserviceId && this.name && this.categoryId) {
    const nameSlug = this.name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
    this.subserviceId = `${this.categoryId}-${nameSlug}`;
  }

  // Generate price display text
  if (this.pricing.price && !this.pricing.displayText) {
    const currencySymbols = { USD: '$', INR: '₹', EUR: '€', GBP: '£' };
    const symbol = currencySymbols[this.pricing.currency] || '₹';

    if (this.pricing.priceType === 'fixed') {
      this.pricing.displayText = `${symbol}${this.pricing.price}`;
    } else if (this.pricing.priceType === 'hourly') {
      this.pricing.displayText = `${symbol}${this.pricing.price}/hr`;
    } else if (this.pricing.priceType === 'per_sqft') {
      this.pricing.displayText = `${symbol}${this.pricing.price}/sqft`;
    } else if (this.pricing.priceType === 'per_unit') {
      this.pricing.displayText = `${symbol}${this.pricing.price}/unit`;
    } else {
      this.pricing.displayText = `${symbol}${this.pricing.price} onwards`;
    }
  }

  // Sync colorClass to display.colorClass
  if (this.colorClass && !this.display?.colorClass) {
    this.display = this.display || {};
    this.display.colorClass = this.colorClass;
  }

  // Sync sortOrder to display.sortOrder
  if (this.sortOrder !== undefined && this.display) {
    this.display.sortOrder = this.sortOrder;
  }

  // Set legacy image from hero image
  if (this.images?.hero?.url && !this.image) {
    this.image = this.images.hero.url;
  }

  next();
});

// ==================== POST-SAVE: UPDATE COUNTS ====================
subserviceSchema.post('save', async function() {
  try {
    // Update category subservices count
    if (this.category) {
      const Category = this.model('Category');
      const count = await this.model('Subservice').countDocuments({ 
        category: this.category, 
        isActive: true 
      });
      await Category.updateOne({ _id: this.category }, { subservicesCount: count });
    }

    // Update service subservices count (if linked)
    if (this.service) {
      const Service = this.model('Service');
      const count = await this.model('Subservice').countDocuments({ 
        service: this.service, 
        isActive: true 
      });
      await Service.updateOne({ _id: this.service }, { subservicesCount: count });
    }
  } catch (error) {
    console.error('Error updating counts:', error);
  }
});

// ==================== POST-REMOVE: UPDATE COUNTS ====================
subserviceSchema.post('remove', async function() {
  try {
    if (this.category) {
      const Category = this.model('Category');
      const count = await this.model('Subservice').countDocuments({ 
        category: this.category, 
        isActive: true 
      });
      await Category.updateOne({ _id: this.category }, { subservicesCount: count });
    }

    if (this.service) {
      const Service = this.model('Service');
      const count = await this.model('Subservice').countDocuments({ 
        service: this.service, 
        isActive: true 
      });
      await Service.updateOne({ _id: this.service }, { subservicesCount: count });
    }
  } catch (error) {
    console.error('Error updating counts:', error);
  }
});

// ==================== JSON TRANSFORM ====================
subserviceSchema.methods.toJSON = function() {
  const subservice = this.toObject();
  subservice.id = subservice._id;

  // Flatten pricing for mobile app compatibility
  subservice.price = subservice.pricing?.displayText || `₹${subservice.pricing?.price} onwards`;

  delete subservice.__v;
  return subservice;
};

module.exports = subserviceSchema;