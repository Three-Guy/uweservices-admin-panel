// src/models/Banner.js
const mongoose = require('mongoose');

/**
 * Banner Schema
 * Promotional banners for homepage carousel
 * Supports scheduling and targeting
 */
const bannerSchema = new mongoose.Schema({
  // Unique identifier
  bannerId: {
    type: String,
    required: [true, 'Banner ID is required'],
    unique: true,
    lowercase: true,
    trim: true,
  },

  // Banner title (for admin reference)
  title: {
    type: String,
    required: [true, 'Banner title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters'],
  },

  // Description (optional, for admin)
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters'],
    default: '',
  },

  // Banner image
  image: {
    url: {
      type: String,
      required: [true, 'Banner image URL is required'],
    },
    publicId: {
      type: String,
      default: null,
    },
    // Image for dark mode
    darkModeUrl: {
      type: String,
      default: null,
    },
    // Alt text for accessibility
    altText: {
      type: String,
      default: '',
    },
  },

  // Mobile-specific image (different aspect ratio)
  mobileImage: {
    url: { type: String, default: null },
    publicId: { type: String, default: null },
  },

  // Click action
  action: {
    // Action type
    type: {
      type: String,
      enum: ['none', 'service', 'category', 'url', 'screen', 'promo'],
      default: 'none',
    },
    // Target value (service ID, URL, screen name, etc.)
    target: {
      type: String,
      default: '',
    },
    // Reference to service (if action type is 'service')
    serviceRef: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Service',
    },
    // Reference to category (if action type is 'category')
    categoryRef: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
    },
    // Promo code (if action type is 'promo')
    promoCode: {
      type: String,
      default: '',
    },
  },

  // Animation settings
  animation: {
    // Animation type for carousel
    type: {
      type: String,
      enum: ['none', 'fade', 'slide', 'zoom', 'flip'],
      default: 'slide',
    },
    // Animation duration in ms
    duration: {
      type: Number,
      default: 500,
    },
    // Auto-play delay in ms
    autoPlayDelay: {
      type: Number,
      default: 5000,
    },
  },

  // Scheduling
  schedule: {
    // Is scheduling enabled?
    isScheduled: {
      type: Boolean,
      default: false,
    },
    // Start date/time
    startDate: {
      type: Date,
      default: null,
    },
    // End date/time
    endDate: {
      type: Date,
      default: null,
    },
    // Timezone
    timezone: {
      type: String,
      default: 'UTC',
    },
  },

  // Targeting
  targeting: {
    // Target cities
    cities: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'City',
    }],
    // Target user segments
    userSegments: [{
      type: String,
      enum: ['all', 'new_users', 'returning_users', 'premium_users'],
    }],
    // Platform targeting
    platforms: [{
      type: String,
      enum: ['all', 'ios', 'android', 'web'],
    }],
  },

  // Display settings
  display: {
    // Sort order in carousel
    sortOrder: {
      type: Number,
      default: 0,
    },
    // Position in homepage
    position: {
      type: String,
      enum: ['hero', 'middle', 'bottom', 'popup'],
      default: 'hero',
    },
    // Background color (fallback)
    backgroundColor: {
      type: String,
      default: '#000000',
    },
    // Text overlay
    overlay: {
      enabled: { type: Boolean, default: false },
      title: { type: String, default: '' },
      subtitle: { type: String, default: '' },
      buttonText: { type: String, default: '' },
      textColor: { type: String, default: '#FFFFFF' },
    },
  },

  // Status
  isActive: {
    type: Boolean,
    default: true,
  },

  // Analytics
  analytics: {
    impressions: {
      type: Number,
      default: 0,
    },
    clicks: {
      type: Number,
      default: 0,
    },
    ctr: {
      type: Number,
      default: 0,
    },
  },

  // Campaign info (optional)
  campaign: {
    name: { type: String, default: '' },
    source: { type: String, default: '' },
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
bannerSchema.index({ bannerId: 1 }, { unique: true });
bannerSchema.index({ isActive: 1 });
bannerSchema.index({ 'display.sortOrder': 1 });
bannerSchema.index({ 'display.position': 1 });
bannerSchema.index({ 'schedule.startDate': 1, 'schedule.endDate': 1 });
bannerSchema.index({ 'targeting.cities': 1 });

// Virtual: Check if banner is currently scheduled to show
bannerSchema.virtual('isScheduledToShow').get(function() {
  if (!this.schedule.isScheduled) return true;
  
  const now = new Date();
  const start = this.schedule.startDate;
  const end = this.schedule.endDate;
  
  if (start && now < start) return false;
  if (end && now > end) return false;
  
  return true;
});

// Pre-save middleware
bannerSchema.pre('save', function(next) {
  // Auto-generate bannerId
  if (!this.bannerId && this.title) {
    const timestamp = Date.now().toString(36);
    const titleSlug = this.title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .substring(0, 30);
    this.bannerId = `${titleSlug}-${timestamp}`;
  }

  // Calculate CTR
  if (this.analytics.impressions > 0) {
    this.analytics.ctr = (this.analytics.clicks / this.analytics.impressions) * 100;
  }

  next();
});

// Static: Get active banners for display
bannerSchema.statics.getActiveBanners = async function(options = {}) {
  const { position = 'hero', cityId = null, limit = 10 } = options;
  const now = new Date();

  const query = {
    isActive: true,
    'display.position': position,
    $or: [
      { 'schedule.isScheduled': false },
      {
        'schedule.isScheduled': true,
        'schedule.startDate': { $lte: now },
        $or: [
          { 'schedule.endDate': null },
          { 'schedule.endDate': { $gte: now } },
        ],
      },
    ],
  };

  if (cityId) {
    query.$or.push(
      { 'targeting.cities': { $size: 0 } },
      { 'targeting.cities': cityId }
    );
  }

  return this.find(query)
    .sort({ 'display.sortOrder': 1 })
    .limit(limit)
    .lean();
};

// Transform for JSON output
bannerSchema.methods.toJSON = function() {
  const banner = this.toObject();
  banner.id = banner._id;
  delete banner.__v;
  return banner;
};

module.exports = bannerSchema;