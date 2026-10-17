// src/models/Service.js
const mongoose = require('mongoose');

/**
 * Service Schema
 * Main service offerings (Cleaning, Plumbing, Electrical, etc.)
 * Each service can have multiple subservices
 */
const serviceSchema = new mongoose.Schema({
  // Unique identifier (URL-friendly)
  serviceId: {
    type: String,
    required: [true, 'Service ID is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^[a-z0-9-]+$/, 'Service ID can only contain lowercase letters, numbers, and hyphens'],
  },

  // Display name
  name: {
    type: String,
    required: [true, 'Service name is required'],
    trim: true,
    maxlength: [100, 'Service name cannot exceed 100 characters'],
  },

  // Subtitle/tagline
  subtitle: {
    type: String,
    trim: true,
    maxlength: [200, 'Subtitle cannot exceed 200 characters'],
    default: '',
  },

  // Full description
  description: {
    type: String,
    trim: true,
    maxlength: [2000, 'Description cannot exceed 2000 characters'],
    default: '',
  },

  // Category reference
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: [true, 'Category is required'],
  },

  // Category name (denormalized for performance)
  categoryName: {
    type: String,
    trim: true,
  },

  // Icon (emoji or icon name)
  icon: {
    type: String,
    default: '🔧',
  },

  // Service images
  images: {
    // Main hero image
    hero: {
      url: { type: String, default: null },
      publicId: { type: String, default: null },
    },
    // Thumbnail/card image
    thumbnail: {
      url: { type: String, default: null },
      publicId: { type: String, default: null },
    },
    // Gallery images
    gallery: [{
      url: { type: String },
      publicId: { type: String },
      caption: { type: String },
      sortOrder: { type: Number, default: 0 },
    }],
  },

  // Legacy image field (for backward compatibility)
  image: {
    type: String,
    default: null,
  },

  // Pricing info
  pricing: {
    // Starting price
    basePrice: {
      type: Number,
      default: 0,
      min: [0, 'Price cannot be negative'],
    },
    // Currency
    currency: {
      type: String,
      default: 'USD',
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
      enum: ['fixed', 'starting_from', 'hourly', 'per_unit', 'custom'],
      default: 'starting_from',
    },
  },

  // Rating information
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

  // Service metrics
  metrics: {
    // Average response time
    responseTime: {
      type: String,
      default: '30 mins',
    },
    // Completion rate
    completionRate: {
      type: Number,
      default: 95,
      min: 0,
      max: 100,
    },
    // Total bookings
    totalBookings: {
      type: Number,
      default: 0,
    },
    // Today's bookings (for trending)
    todayBookings: {
      type: Number,
      default: 0,
    },
  },

  // Display settings
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

  // Visibility & Status
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

  // Availability
  availability: {
    // Is this service available?
    isAvailable: {
      type: Boolean,
      default: true,
    },
    // Available cities
    cities: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'City',
    }],
    // Available zones within cities
    zones: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Zone',
    }],
    // Time slots (if applicable)
    timeSlots: [{
      day: { type: String, enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] },
      startTime: { type: String },
      endTime: { type: String },
      isAvailable: { type: Boolean, default: true },
    }],
  },

  // SEO & Meta
  seo: {
    metaTitle: { type: String, maxlength: 70 },
    metaDescription: { type: String, maxlength: 160 },
    keywords: [{ type: String }],
  },

  // Tags for filtering
  tags: [{
    type: String,
    lowercase: true,
    trim: true,
  }],

  // Subservices count (cached)
  subservicesCount: {
    type: Number,
    default: 0,
  },

  // Providers count (cached)
  providersCount: {
    type: Number,
    default: 0,
  },

  // Metadata
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

// Indexes
serviceSchema.index({ serviceId: 1 }, { unique: true });
serviceSchema.index({ category: 1 });
serviceSchema.index({ isActive: 1 });
serviceSchema.index({ isPopular: 1 });
serviceSchema.index({ isFeatured: 1 });
serviceSchema.index({ 'display.sortOrder': 1 });
serviceSchema.index({ 'availability.cities': 1 });
serviceSchema.index({ tags: 1 });
serviceSchema.index({ name: 'text', description: 'text', tags: 'text' });

// Virtual for subservices
serviceSchema.virtual('subservices', {
  ref: 'Subservice',
  localField: '_id',
  foreignField: 'service',
});

// Pre-save middleware
serviceSchema.pre('save', function(next) {
  // Auto-generate serviceId from name if not provided
  if (!this.serviceId && this.name) {
    this.serviceId = this.name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  }

  // Set legacy image field from hero image
  if (this.images?.hero?.url && !this.image) {
    this.image = this.images.hero.url;
  }

  next();
});

// Transform for JSON output
serviceSchema.methods.toJSON = function() {
  const service = this.toObject();
  service.id = service._id;
  delete service.__v;
  return service;
};

// Static method to update subservices count
serviceSchema.statics.updateSubservicesCount = async function(serviceId) {
  const Subservice = this.model('Subservice');
  const count = await Subservice.countDocuments({ service: serviceId, isActive: true });
  await this.updateOne({ _id: serviceId }, { subservicesCount: count });
  return count;
};

module.exports = serviceSchema;