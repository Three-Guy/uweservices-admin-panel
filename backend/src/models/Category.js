// src/models/Category.js
const mongoose = require('mongoose');

/**
 * Category Schema
 * Categories group related services together
 * Example: "Home Care", "Beauty & Wellness", "Repairs"
 */
const categorySchema = new mongoose.Schema({
  // Unique identifier for the category (URL-friendly)
  categoryId: {
    type: String,
    required: [true, 'Category ID is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^[a-z0-9-]+$/, 'Category ID can only contain lowercase letters, numbers, and hyphens'],
  },

  // Display name
  name: {
    type: String,
    required: [true, 'Category name is required'],
    trim: true,
    maxlength: [100, 'Category name cannot exceed 100 characters'],
  },

  // Description
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters'],
    default: '',
  },

  // Icon (emoji, icon name, or URL)
  icon: {
    type: String,
    default: '📦',
  },

  // Category image (Cloudinary URL)
  image: {
    url: { type: String, default: null },
    publicId: { type: String, default: null },
  },

  // Display color (hex code)
  color: {
    type: String,
    default: '#FF8C42',
    match: [/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, 'Invalid hex color'],
  },

  // Background color class (for styling)
  colorClass: {
    type: String,
    default: 'bg-orange-100',
  },

  // Sort order for display
  sortOrder: {
    type: Number,
    default: 0,
  },

  // Is this category active/visible?
  isActive: {
    type: Boolean,
    default: true,
  },

  // Is this a featured category? (shown on homepage)
  isFeatured: {
    type: Boolean,
    default: false,
  },

  // ==================== NEW: MORE SERVICES SECTION ====================
  
  // Is this the "More Services" special tile?
  isMoreServicesSection: {
    type: Boolean,
    default: false,
  },

  // Configuration for "More Services" section
  moreServicesConfig: {
    // What to show when user taps this tile
    action: {
      // FIX: Use 'actionType' instead of 'type' to avoid Mongoose reserved keyword conflict
      actionType: {
        type: String,
        enum: ['all_services', 'all_categories', 'specific_category', 'custom_screen', 'external_url'],
        default: 'all_services',
      },
      // Target category ID if actionType is 'specific_category'
      targetCategory: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category',
        default: null,
      },
      // Screen name if actionType is 'custom_screen'
      screenName: {
        type: String,
        default: '',
      },
      // URL if actionType is 'external_url'
      url: {
        type: String,
        default: '',
      },
    },

    // Display settings
    displaySettings: {
      // Title shown on the tile
      title: {
        type: String,
        default: 'More Services',
      },
      // Subtitle/description
      subtitle: {
        type: String,
        default: 'Explore all services',
      },
      // Show count badge (e.g., "50+ Services")
      showServiceCount: {
        type: Boolean,
        default: true,
      },
      // Custom badge text (overrides service count if provided)
      customBadge: {
        type: String,
        default: '',
      },
    },

    // Services to show in "More Services" view
    serviceFilters: {
      // Show all services or filtered
      showAllServices: {
        type: Boolean,
        default: true,
      },
      // Specific category IDs to include
      includeCategories: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category',
      }],
      // Specific category IDs to exclude
      excludeCategories: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category',
      }],
      // Only show popular services
      onlyPopular: {
        type: Boolean,
        default: false,
      },
      // Only show featured services
      onlyFeatured: {
        type: Boolean,
        default: false,
      },
      // Specific tags to filter by
      tags: [{
        type: String,
        lowercase: true,
      }],
    },

    // Layout for "More Services" screen
    layout: {
      // View type: grid, list, or grouped by category
      viewType: {
        type: String,
        enum: ['grid', 'list', 'grouped_by_category'],
        default: 'grid',
      },
      // Number of columns (for grid view)
      gridColumns: {
        type: Number,
        default: 2,
        min: 1,
        max: 4,
      },
      // Show search bar
      showSearch: {
        type: Boolean,
        default: true,
      },
      // Show category filter chips
      showCategoryFilters: {
        type: Boolean,
        default: true,
      },
      // Sort order: name, popular, price, etc.
      defaultSort: {
        type: String,
        enum: ['name', 'popular', 'price_low_high', 'price_high_low', 'newest'],
        default: 'name',
      },
    },
  },

  // Number of services in this category (cached count)
  servicesCount: {
    type: Number,
    default: 0,
  },

  // Cities where this category is available
  availableCities: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'City',
  }],

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
categorySchema.index({ categoryId: 1 }, { unique: true });
categorySchema.index({ isActive: 1 });
categorySchema.index({ isFeatured: 1 });
categorySchema.index({ isMoreServicesSection: 1 });
categorySchema.index({ sortOrder: 1 });
categorySchema.index({ name: 'text', description: 'text' });

// Virtual for services
categorySchema.virtual('services', {
  ref: 'Service',
  localField: '_id',
  foreignField: 'category',
});

// Pre-save middleware
categorySchema.pre('save', function(next) {
  // Auto-generate categoryId from name if not provided
  if (!this.categoryId && this.name) {
    this.categoryId = this.name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  }

  // Set default config for "More Services" section
  if (this.isMoreServicesSection && this.moreServicesConfig) {
    if (!this.moreServicesConfig.displaySettings) {
      this.moreServicesConfig.displaySettings = {};
    }
    if (!this.moreServicesConfig.displaySettings.title) {
      this.moreServicesConfig.displaySettings.title = 'More Services';
    }
    if (!this.moreServicesConfig.displaySettings.subtitle) {
      this.moreServicesConfig.displaySettings.subtitle = 'Explore all services';
    }
  }

  next();
});

// Transform for JSON output
categorySchema.methods.toJSON = function() {
  const category = this.toObject();
  category.id = category._id;
  delete category.__v;
  return category;
};

// Static method to ensure only one "More Services" section exists
categorySchema.statics.ensureSingleMoreServicesSection = async function(excludeId = null) {
  const query = { isMoreServicesSection: true };
  if (excludeId) {
    query._id = { $ne: excludeId };
  }
  
  const existingSection = await this.findOne(query);
  return existingSection;
};

module.exports = categorySchema;