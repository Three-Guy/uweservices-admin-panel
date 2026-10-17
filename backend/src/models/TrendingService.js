// backend/src/models/TrendingService.js
const mongoose = require('mongoose');

const trendingServiceSchema = new mongoose.Schema(
  {
    // ==================== IDENTIFIERS ====================
    serviceId: {
      type: String,
      required: [true, 'Service ID is required'],
      unique: true,
      trim: true,
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
    },
    serviceSlug: {
      type: String,
      trim: true,
      index: true,
    },

    // ==================== CATEGORY REFERENCE ====================
    categoryId: {
      type: String,
      required: [true, 'Category ID is required'],
      trim: true,
      index: true,
    },
    categoryName: {
      type: String,
      required: [true, 'Category name is required'],
      trim: true,
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
    },

    // ==================== SERVICE REFERENCE (OPTIONAL) ====================
    service: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Service',
    },

    // ==================== DISPLAY ====================
    iconName: {
      type: String,
      required: true,
      default: '📦',
      trim: true,
    },
    imageUrl: {
      type: String,
      default: null,
    },

    // ==================== BADGE ====================
    badge: {
      text: {
        type: String,
        default: '',
        trim: true,
      },
      type: {
        type: String,
        enum: [
          '',
          'HOT',
          'NEW',
          'POPULAR',
          'TRENDING',
          'BEST_SELLER',
          'LIMITED',
          'success',
          'warning',
          'info',
          'error',
          'default',
        ],
        default: '',
      },
    },

    // ==================== METRICS ====================
    bookingsToday: {
      type: Number,
      default: 0,
      min: 0,
    },
    progress: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },

    // ==================== ORDERING & STATUS ====================
    sortOrder: {
      type: Number,
      default: 0,
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    autoSync: {
      type: Boolean,
      default: false,
    },

    // ==================== AUDIT FIELDS ====================
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ==================== INDEXES ====================
trendingServiceSchema.index({ isActive: 1, sortOrder: 1 });
trendingServiceSchema.index({ categoryId: 1, isActive: 1 });
trendingServiceSchema.index({ serviceId: 1 }, { unique: true });

// ==================== PRE-SAVE HOOK ====================
trendingServiceSchema.pre('save', function (next) {
  // Auto-generate serviceSlug if not provided
  if (!this.serviceSlug && this.serviceId) {
    this.serviceSlug = this.serviceId
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }

  // Ensure progress is within bounds
  if (this.progress < 0) this.progress = 0;
  if (this.progress > 100) this.progress = 100;

  // Ensure bookingsToday is not negative
  if (this.bookingsToday < 0) this.bookingsToday = 0;

  next();
});

// ==================== METHODS ====================
trendingServiceSchema.methods.toJSON = function () {
  const obj = this.toObject();
  obj.id = obj._id;
  delete obj.__v;
  return obj;
};

// ==================== STATIC METHODS ====================
trendingServiceSchema.statics.getActiveServices = function (limit = 10) {
  return this.find({ isActive: true })
    .sort({ sortOrder: 1 })
    .limit(limit)
    .lean();
};

trendingServiceSchema.statics.syncFromBookings = async function () {
  // This will be implemented when booking system is ready
  console.log('📊 Syncing trending services from bookings...');

  return { synced: 0 };
};

module.exports = trendingServiceSchema;