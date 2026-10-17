// src/models/LayoutConfig.js
const mongoose = require('mongoose');

/**
 * Section Schema (embedded in LayoutConfig)
 * Defines each section/component on a page
 */
const sectionSchema = new mongoose.Schema({
  // Unique section identifier
  sectionId: {
    type: String,
    required: true,
  },

  // Section type (component to render)
  type: {
    type: String,
    required: true,
    enum: [
      'banner_carousel',
      'category_grid',
      'category_list',
      'service_grid',
      'service_list',
      'service_horizontal',
      'popular_services',
      'trending_services',
      'featured_services',
      'search_bar',
      'promo_banner',
      'quick_actions',
      'recent_bookings',
      'testimonials',
      'stats_card',
      'emergency_section',
      'custom_html',
      'spacer',
      'divider',
      // NEW: Additional section types
      'hero_banner',
      'flash_sale',
      'countdown_timer',
      'featured_providers',
      'nearby_providers',
      'recommended_services',
      'recently_viewed',
      'offers_carousel',
      'info_card',
      'social_proof',
    ],
  },

  // Is this section enabled?
  enabled: {
    type: Boolean,
    default: true,
  },

  // Display order
  order: {
    type: Number,
    required: true,
  },

  // Section title (optional)
  title: {
    type: String,
    default: '',
  },

  // Subtitle
  subtitle: {
    type: String,
    default: '',
  },

  // Show "View All" link
  showViewAll: {
    type: Boolean,
    default: false,
  },

  // "View All" target
  viewAllTarget: {
    type: String,
    default: '',
  },

  // Data source for dynamic content
  dataSource: {
    type: String,
    enum: [
      '', 
      'banners', 
      'categories', 
      'services', 
      'popular', 
      'trending', 
      'featured', 
      'recent', 
      'custom',
      // NEW: Additional data sources
      'trending_services',
      'popular_services',
      'featured_services',
      'recommended_services',
      'nearby_providers',
      'featured_providers',
      'offers',
      'flash_sales',
      'recently_viewed',
      'subservices',
      'emergency_services',
    ],
    default: '',
  },

  // Layout style
  layout: {
    style: {
      type: String,
      enum: [
        'grid', 
        'list', 
        'horizontal', 
        'carousel', 
        'masonry',
        // NEW: Additional layout styles
        'horizontal-scroll',
        'vertical-scroll',
        'default',
        'compact',
        'expanded',
        'card',
        'tile',
        'banner',
        'slider',
        'stack',
        'wrap',
        'flex',
      ],
      default: 'grid',
    },
    columns: {
      type: Number,
      default: 2,
      min: 1,
      max: 6,
    },
    rows: {
      type: Number,
      default: 2,
    },
    itemsToShow: {
      type: Number,
      default: 4,
    },
    spacing: {
      type: Number,
      default: 16,
    },
    showBorder: {
      type: Boolean,
      default: false,
    },
    roundedCorners: {
      type: Number,
      default: 12,
    },
    // NEW: Additional layout options
    aspectRatio: {
      type: String,
      default: '16:9',
    },
    autoScroll: {
      type: Boolean,
      default: false,
    },
    autoScrollInterval: {
      type: Number,
      default: 3000,
    },
    showIndicators: {
      type: Boolean,
      default: true,
    },
    showArrows: {
      type: Boolean,
      default: false,
    },
    snapToItem: {
      type: Boolean,
      default: true,
    },
    itemWidth: {
      type: Number,
      default: null,
    },
    itemHeight: {
      type: Number,
      default: null,
    },
  },

  // Styling
  style: {
    backgroundColor: { type: String, default: 'transparent' },
    paddingTop: { type: Number, default: 0 },
    paddingBottom: { type: Number, default: 0 },
    paddingHorizontal: { type: Number, default: 16 },
    marginTop: { type: Number, default: 0 },
    marginBottom: { type: Number, default: 24 },
    // NEW: Additional style options
    borderRadius: { type: Number, default: 0 },
    borderWidth: { type: Number, default: 0 },
    borderColor: { type: String, default: 'transparent' },
    shadowEnabled: { type: Boolean, default: false },
    shadowColor: { type: String, default: 'rgba(0,0,0,0.1)' },
    shadowOffset: { type: Number, default: 2 },
    shadowRadius: { type: Number, default: 4 },
  },

  // Card style for items
  cardStyle: {
    showImage: { type: Boolean, default: true },
    showTitle: { type: Boolean, default: true },
    showSubtitle: { type: Boolean, default: false },
    showPrice: { type: Boolean, default: false },
    showRating: { type: Boolean, default: false },
    showBadge: { type: Boolean, default: true },
    imageAspectRatio: { type: String, default: '16:9' },
    titleLines: { type: Number, default: 2 },
    // NEW: Additional card style options
    showDescription: { type: Boolean, default: false },
    descriptionLines: { type: Number, default: 2 },
    showButton: { type: Boolean, default: false },
    buttonText: { type: String, default: 'View' },
    showIcon: { type: Boolean, default: true },
    showDiscount: { type: Boolean, default: false },
    showAvailability: { type: Boolean, default: false },
    imagePosition: { 
      type: String, 
      enum: ['top', 'left', 'right', 'bottom', 'background'],
      default: 'top' 
    },
    cardBackground: { type: String, default: '#FFFFFF' },
    titleColor: { type: String, default: '#1F2937' },
    subtitleColor: { type: String, default: '#6B7280' },
    priceColor: { type: String, default: '#059669' },
  },

  // Filters for data
  filters: {
    categories: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Category' }],
    services: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Service' }],
    tags: [{ type: String }],
    cities: [{ type: mongoose.Schema.Types.ObjectId, ref: 'City' }],
    isPopular: { type: Boolean, default: null },
    isFeatured: { type: Boolean, default: null },
    // NEW: Additional filter options
    isEmergency: { type: Boolean, default: null },
    isTrending: { type: Boolean, default: null },
    minRating: { type: Number, default: null },
    maxPrice: { type: Number, default: null },
    minPrice: { type: Number, default: null },
    providers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Provider' }],
    sortBy: { 
      type: String, 
      enum: ['', 'name', 'price', 'rating', 'popularity', 'newest', 'discount'],
      default: '' 
    },
    sortOrder: { 
      type: String, 
      enum: ['', 'asc', 'desc'],
      default: '' 
    },
    limit: { type: Number, default: null },
  },

  // Custom data (for custom components)
  customData: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },

  // A/B Testing
  abTest: {
    enabled: { type: Boolean, default: false },
    variantId: { type: String, default: '' },
    // NEW: Additional A/B test options
    testName: { type: String, default: '' },
    trafficPercentage: { type: Number, default: 50 },
  },

  // Visibility conditions
  visibility: {
    // Show to authenticated users only
    requireAuth: { type: Boolean, default: false },
    // Show to new users only
    newUsersOnly: { type: Boolean, default: false },
    // Platform specific
    platforms: [{ 
      type: String, 
      enum: ['all', 'ios', 'android', 'web', 'mobile'] 
    }],
    // Minimum app version
    minAppVersion: { type: String, default: '' },
    // NEW: Additional visibility options
    maxAppVersion: { type: String, default: '' },
    startDate: { type: Date, default: null },
    endDate: { type: Date, default: null },
    userSegments: [{ type: String }],
    excludeUserSegments: [{ type: String }],
    geoLocations: [{ type: String }],
    languages: [{ type: String }],
    isScheduled: { type: Boolean, default: false },
  },

  // NEW: Actions configuration
actions: {
  onTap: {
    actionType: {  // ✅ Changed from 'type' to 'actionType'
      type: String, 
      enum: ['', 'navigate', 'deeplink', 'url', 'action', 'none'],
      default: '' 
    },
    target: { type: String, default: '' },
    params: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  onViewAll: {
    actionType: {  // ✅ Changed from 'type' to 'actionType'
      type: String, 
      enum: ['', 'navigate', 'deeplink', 'url', 'action', 'none'],
      default: '' 
    },
    target: { type: String, default: '' },
    params: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
},

// NEW: Animation configuration
animation: {
  enabled: { type: Boolean, default: false },
  animationType: {  // ✅ Changed from 'type' to 'animationType'
    type: String, 
    enum: ['', 'fade', 'slide', 'scale', 'bounce', 'none'],
    default: '' 
  },
  duration: { type: Number, default: 300 },
  delay: { type: Number, default: 0 },
},
}, { _id: true });

/**
 * LayoutConfig Schema
 * Defines the layout configuration for each page
 */
const layoutConfigSchema = new mongoose.Schema({
  // Page identifier
  page: {
    type: String,
    required: [true, 'Page identifier is required'],
    unique: true,
    lowercase: true,
    trim: true,
    enum: [
      'home', 
      'services', 
      'categories', 
      'profile', 
      'booking', 
      'search',
      // NEW: Additional pages
      'service_detail',
      'category_detail',
      'provider_detail',
      'checkout',
      'orders',
      'order_detail',
      'notifications',
      'favorites',
      'settings',
      'help',
      'offers',
      'rewards',
    ],
  },

  // Page display name
  pageName: {
    type: String,
    default: '',
  },

  // Page description
  description: {
    type: String,
    default: '',
  },

  // Sections array
  sections: [sectionSchema],

  // Page-level settings
  settings: {
    // Pull-to-refresh enabled
    pullToRefresh: { type: Boolean, default: true },
    // Show header
    showHeader: { type: Boolean, default: true },
    // Header style
    headerStyle: {
      type: String,
      enum: ['default', 'transparent', 'solid', 'gradient', 'minimal', 'hidden'],
      default: 'default',
    },
    // Background color
    backgroundColor: { type: String, default: '#FFFFFF' },
    // Dark mode background
    darkBackgroundColor: { type: String, default: '#111827' },
    // Status bar style
    statusBarStyle: {
      type: String,
      enum: ['default', 'light', 'dark'],
      default: 'default',
    },
    // NEW: Additional page settings
    showBottomNav: { type: Boolean, default: true },
    showFloatingButton: { type: Boolean, default: false },
    floatingButtonAction: { type: String, default: '' },
    showBackButton: { type: Boolean, default: true },
    headerTitle: { type: String, default: '' },
    headerLogo: { type: String, default: '' },
    enableSearch: { type: Boolean, default: false },
    searchPlaceholder: { type: String, default: 'Search...' },
    scrollBehavior: {
      type: String,
      enum: ['default', 'parallax', 'sticky', 'collapse'],
      default: 'default',
    },
    loadingStyle: {
      type: String,
      enum: ['spinner', 'skeleton', 'shimmer', 'none'],
      default: 'skeleton',
    },
    errorStyle: {
      type: String,
      enum: ['inline', 'fullscreen', 'toast', 'banner'],
      default: 'inline',
    },
    emptyStateImage: { type: String, default: '' },
    emptyStateTitle: { type: String, default: 'No data found' },
    emptyStateSubtitle: { type: String, default: '' },
  },

  // Is this layout active?
  isActive: {
    type: Boolean,
    default: true,
  },

  // Is this the published version?
  isPublished: {
    type: Boolean,
    default: false,
  },

  // Version number
  version: {
    type: Number,
    default: 1,
  },

  // Draft data (for preview)
  draft: {
    sections: [sectionSchema],
    settings: { type: mongoose.Schema.Types.Mixed },
    lastSavedAt: { type: Date },
  },

  // Publish history
  publishHistory: [{
    version: { type: Number },
    publishedAt: { type: Date },
    publishedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
    changes: { type: String },
  }],

  // NEW: A/B Test variants
  variants: [{
    variantId: { type: String },
    name: { type: String },
    sections: [sectionSchema],
    settings: { type: mongoose.Schema.Types.Mixed },
    trafficPercentage: { type: Number, default: 0 },
    isActive: { type: Boolean, default: false },
  }],

  // NEW: Scheduling
  schedule: {
    enabled: { type: Boolean, default: false },
    startDate: { type: Date, default: null },
    endDate: { type: Date, default: null },
    timezone: { type: String, default: 'UTC' },
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
  publishedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
  },
  publishedAt: {
    type: Date,
  },
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

// Indexes
layoutConfigSchema.index({ page: 1 }, { unique: true });
layoutConfigSchema.index({ isActive: 1 });
layoutConfigSchema.index({ isPublished: 1 });

// Pre-save: Auto-generate section IDs
layoutConfigSchema.pre('save', function(next) {
  if (this.sections && this.sections.length > 0) {
    this.sections.forEach((section, index) => {
      if (!section.sectionId) {
        section.sectionId = `${this.page}-section-${index + 1}-${Date.now().toString(36)}`;
      }
    });
  }

  // Also process draft sections
  if (this.draft && this.draft.sections && this.draft.sections.length > 0) {
    this.draft.sections.forEach((section, index) => {
      if (!section.sectionId) {
        section.sectionId = `${this.page}-draft-section-${index + 1}-${Date.now().toString(36)}`;
      }
    });
  }

  next();
});

// Method: Get enabled sections ordered
layoutConfigSchema.methods.getEnabledSections = function() {
  return this.sections
    .filter(section => section.enabled)
    .sort((a, b) => a.order - b.order);
};

// Method: Publish draft
layoutConfigSchema.methods.publishDraft = async function(adminId, changes = '') {
  if (this.draft && this.draft.sections) {
    // Increment version
    this.version += 1;
    
    // Copy draft to main sections
    this.sections = this.draft.sections;
    if (this.draft.settings) {
      this.settings = { ...this.settings, ...this.draft.settings };
    }
    
    // Add to publish history
    this.publishHistory.push({
      version: this.version,
      publishedAt: new Date(),
      publishedBy: adminId,
      changes: changes,
    });
    
    // Update publish info
    this.isPublished = true;
    this.publishedAt = new Date();
    this.publishedBy = adminId;
    
    // Clear draft
    this.draft = undefined;
    
    await this.save();
  }
  return this;
};

// Static: Get layout for a page
layoutConfigSchema.statics.getPageLayout = async function(page) {
  let layout = await this.findOne({ page, isActive: true });
  
  // If no layout exists, create default
  if (!layout) {
    layout = await this.createDefaultLayout(page);
  }
  
  return layout;
};

// Static: Create default layout for a page
layoutConfigSchema.statics.createDefaultLayout = async function(page) {
  const defaultSections = {
    home: [
      { 
        sectionId: 'home-banner', 
        type: 'banner_carousel', 
        enabled: true, 
        order: 1, 
        dataSource: 'banners', 
        title: '',
        layout: { style: 'carousel', itemsToShow: 1 },
      },
      { 
        sectionId: 'home-search', 
        type: 'search_bar', 
        enabled: true, 
        order: 2,
        layout: { style: 'default' },
      },
      { 
        sectionId: 'home-categories', 
        type: 'category_grid', 
        enabled: true, 
        order: 3, 
        title: 'Our Services', 
        layout: { style: 'grid', columns: 2, itemsToShow: 4 }, 
        showViewAll: true, 
        viewAllTarget: '/services',
        dataSource: 'categories',
      },
      { 
        sectionId: 'home-trending', 
        type: 'trending_services', 
        enabled: true, 
        order: 4, 
        title: 'Trending Now', 
        dataSource: 'trending_services', 
        layout: { style: 'horizontal-scroll', itemsToShow: 5 },
      },
      { 
        sectionId: 'home-emergency', 
        type: 'emergency_section', 
        enabled: true, 
        order: 5,
        layout: { style: 'default' },
      },
    ],
    services: [
      { 
        sectionId: 'services-search', 
        type: 'search_bar', 
        enabled: true, 
        order: 1,
        layout: { style: 'default' },
      },
      { 
        sectionId: 'services-list', 
        type: 'service_grid', 
        enabled: true, 
        order: 2, 
        dataSource: 'services', 
        layout: { style: 'grid', columns: 2 },
      },
    ],
    categories: [
      { 
        sectionId: 'categories-list', 
        type: 'category_list', 
        enabled: true, 
        order: 1, 
        dataSource: 'categories',
        layout: { style: 'list' },
      },
    ],
  };

  const sections = defaultSections[page] || [];
  
  return this.create({
    page,
    pageName: page.charAt(0).toUpperCase() + page.slice(1),
    sections,
    isActive: true,
    isPublished: true,
  });
};

// Method: Clone layout
layoutConfigSchema.methods.cloneLayout = async function(newPage) {
  const clonedData = this.toObject();
  delete clonedData._id;
  delete clonedData.id;
  clonedData.page = newPage;
  clonedData.pageName = newPage.charAt(0).toUpperCase() + newPage.slice(1);
  clonedData.isPublished = false;
  clonedData.version = 1;
  clonedData.publishHistory = [];
  clonedData.draft = undefined;

  // Regenerate section IDs
  clonedData.sections = clonedData.sections.map((section, index) => ({
    ...section,
    _id: undefined,
    sectionId: `${newPage}-section-${index + 1}-${Date.now().toString(36)}`,
  }));

  const LayoutConfig = this.constructor;
  return LayoutConfig.create(clonedData);
};

// Transform for JSON output
layoutConfigSchema.methods.toJSON = function() {
  const layout = this.toObject();
  layout.id = layout._id;
  delete layout.__v;
  return layout;
};

module.exports = layoutConfigSchema;