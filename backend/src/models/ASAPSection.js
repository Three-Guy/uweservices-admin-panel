// src/models/ASAPSection.js
const mongoose = require('mongoose');

/**
 * ASAP Item Schema - Each selectable service in the ASAP section
 */
const asapItemSchema = new mongoose.Schema({
  // Reference to the actual subservice
  subservice: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Subservice',
    required: true,
  },
  // Custom display name (e.g., "Emergency Plumbing" instead of "Plumbing Service")
  customName: {
    type: String,
    trim: true,
    default: '',
  },
  // Custom description for ASAP context
  customDescription: {
    type: String,
    trim: true,
    default: '',
  },
  // Custom icon (Material Icons name or emoji)
  customIcon: {
    type: String,
    default: '',
  },
  // Custom image for this ASAP item
  customImage: {
    url: { type: String, default: null },
    publicId: { type: String, default: null },
  },
  // Custom price display text (e.g., "₹199 onwards")
  customPriceText: {
    type: String,
    default: '',
  },
  // Custom duration text (e.g., "13 mins arrival")
  customDurationText: {
    type: String,
    default: '',
  },
  // Navigation route when tapped
  navigationRoute: {
    type: String,
    default: '',
  },
  // Button/Card background color
  buttonColor: {
    type: String,
    default: 'rgba(255,255,255,0.1)',
  },
  // Icon color
  iconColor: {
    type: String,
    default: '#FF8C42',
  },
  // Sort order within section
  sortOrder: {
    type: Number,
    default: 0,
  },
  // Is this item active?
  isActive: {
    type: Boolean,
    default: true,
  },
}, { _id: true });

/**
 * ASAP Section Schema - The main "Need a Service Provider ASAP?" section
 */
const asapSectionSchema = new mongoose.Schema({
  // Unique identifier for the section
  sectionId: {
    type: String,
    required: [true, 'Section ID is required'],
    unique: true,
    lowercase: true,
    trim: true,
  },
  // Internal name for admin reference
  name: {
    type: String,
    required: [true, 'Section name is required'],
    trim: true,
    maxlength: [100, 'Name cannot exceed 100 characters'],
  },
  
  // ==================== DISPLAY CONTENT ====================
  // Main title (e.g., "Need a Service Provider ASAP?")
  title: {
    type: String,
    required: [true, 'Title is required'],
    trim: true,
    default: 'Need a Service Provider ASAP?',
  },
  // Subtitle with arrival time (e.g., "Arrival Within 13 mins")
  subtitle: {
    type: String,
    trim: true,
    default: 'Arrival Within 13 mins',
  },
  // Highlighted text in subtitle
  highlightText: {
    type: String,
    trim: true,
    default: 'Arrival Within 13 mins',
  },
  // Full description
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters'],
    default: '',
  },
  // Section icon/emoji
  icon: {
    type: String,
    default: '⚡',
  },
  
  // ==================== ITEMS (SERVICES) ====================
  // The subservices shown in this section (usually 2)
  items: [asapItemSchema],
  
  // Maximum items allowed in this section
  maxItems: {
    type: Number,
    default: 2,
    min: 1,
    max: 6,
  },
  
  // Category filter - only show subservices from these categories
  allowedCategories: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
  }],

  // ==================== STYLING ====================
  styling: {
    // Card background color (dark theme)
    cardBackgroundColor: {
      type: String,
      default: '#1a1a2e', // Dark card color
    },
    // Card border radius
    cardBorderRadius: {
      type: Number,
      default: 32,
    },
    // Card padding
    cardPadding: {
      type: Number,
      default: 32,
    },
    // Title color
    titleColor: {
      type: String,
      default: '#ffffff',
    },
    // Title font size
    titleFontSize: {
      type: Number,
      default: 24,
    },
    // Subtitle color
    subtitleColor: {
      type: String,
      default: 'rgba(255,255,255,0.6)',
    },
    // Highlight color (for arrival time)
    highlightColor: {
      type: String,
      default: '#FF8C42',
    },
    // Glow effects
    glowEffects: {
      enabled: { type: Boolean, default: true },
      topLeftColor: { type: String, default: 'rgba(255, 140, 66, 0.3)' },
      bottomRightColor: { type: String, default: 'rgba(45, 107, 223, 0.3)' },
    },
    // Button styling
    buttonStyle: {
      backgroundColor: { type: String, default: 'rgba(255,255,255,0.1)' },
      borderRadius: { type: Number, default: 16 },
      borderColor: { type: String, default: 'rgba(255,255,255,0.1)' },
      textColor: { type: String, default: '#ffffff' },
    },
  },

  // ==================== ARRIVAL TIME SETTINGS ====================
  arrivalTime: {
    // Estimated arrival in minutes
    minutes: {
      type: Number,
      default: 13,
      min: 1,
      max: 120,
    },
    // Display format text (use {time} as placeholder)
    displayFormat: {
      type: String,
      default: 'Arrival Within {time} mins',
    },
    // Show arrival time badge?
    showBadge: {
      type: Boolean,
      default: true,
    },
  },

  // ==================== DISPLAY SETTINGS ====================
  displaySettings: {
    // Show timer countdown?
    showTimer: {
      type: Boolean,
      default: true,
    },
    // Timer duration in minutes
    timerMinutes: {
      type: Number,
      default: 30,
      min: 5,
      max: 120,
    },
    // Timer text
    timerText: {
      type: String,
      default: 'Book within {time} for fastest service',
    },
    // Badge settings
    badge: {
      text: { type: String, default: 'ASAP' },
      color: { type: String, default: '#EF4444' },
      backgroundColor: { type: String, default: '#FEE2E2' },
    },
    // Section background color
    backgroundColor: {
      type: String,
      default: '#FFF7ED',
    },
    // Layout type
    layout: {
      type: String,
      enum: ['grid', 'list', 'horizontal', 'carousel', 'row'],
      default: 'row',
    },
    // Grid columns
    gridColumns: {
      type: Number,
      default: 2,
      min: 1,
      max: 4,
    },
    // Show "View All" button
    showViewAll: {
      type: Boolean,
      default: false,
    },
    // "View All" navigation target
    viewAllTarget: {
      type: String,
      default: '/asap-services',
    },
    // Max items to show
    maxItemsToShow: {
      type: Number,
      default: 2,
    },
    // Card style options
    cardStyle: {
      showImage: { type: Boolean, default: false },
      showPrice: { type: Boolean, default: false },
      showDuration: { type: Boolean, default: false },
      showRating: { type: Boolean, default: false },
      showBadge: { type: Boolean, default: false },
      showIcon: { type: Boolean, default: true },
      imageAspectRatio: { type: String, default: '1:1' },
    },
  },

  // ==================== PRICING MODIFIER ====================
  pricingModifier: {
    // Apply special ASAP pricing?
    enabled: {
      type: Boolean,
      default: false,
    },
    // Modifier type
    type: {
      type: String,
      enum: ['percentage', 'fixed'],
      default: 'percentage',
    },
    // Modifier value
    value: {
      type: Number,
      default: 0,
    },
    // Display text for the modifier
    displayText: {
      type: String,
      default: '',
    },
  },

  // ==================== TARGETING ====================
  targeting: {
    // Target specific cities
    cities: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'City',
    }],
    // Target platforms
    platforms: [{
      type: String,
      enum: ['all', 'ios', 'android', 'web'],
      default: 'all',
    }],
    // User segments
    userSegments: [{
      type: String,
      enum: ['all', 'new_users', 'returning_users', 'premium_users'],
      default: 'all',
    }],
    // Minimum app version required
    minAppVersion: {
      type: String,
      default: '',
    },
  },

  // ==================== SCHEDULE ====================
  schedule: {
    // Is scheduling enabled?
    isScheduled: {
      type: Boolean,
      default: false,
    },
    // Start date
    startDate: {
      type: Date,
      default: null,
    },
    // End date
    endDate: {
      type: Date,
      default: null,
    },
    // Time-based availability
    timeBasedAvailability: {
      enabled: { type: Boolean, default: false },
      startTime: { type: String, default: '00:00' },
      endTime: { type: String, default: '23:59' },
      timezone: { type: String, default: 'Asia/Kolkata' },
    },
    // Available days
    availableDays: [{
      type: String,
      enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
    }],
  },

  // ==================== POSITION & ORDERING ====================
  // Position in the home screen
  position: {
    type: String,
    enum: ['top', 'after_banner', 'after_categories', 'middle', 'bottom'],
    default: 'after_banner',
  },
  // Sort order among other sections
  sortOrder: {
    type: Number,
    default: 0,
  },

  // ==================== STATUS ====================
  isActive: {
    type: Boolean,
    default: true,
  },

  // ==================== ANALYTICS ====================
  analytics: {
    impressions: { type: Number, default: 0 },
    clicks: { type: Number, default: 0 },
    conversions: { type: Number, default: 0 },
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
asapSectionSchema.index({ sectionId: 1 }, { unique: true });
asapSectionSchema.index({ isActive: 1 });
asapSectionSchema.index({ sortOrder: 1 });
asapSectionSchema.index({ position: 1 });

// ==================== VIRTUALS ====================
asapSectionSchema.virtual('activeItemsCount').get(function() {
  return this.items ? this.items.filter(item => item.isActive).length : 0;
});

// Format arrival time text
asapSectionSchema.virtual('formattedArrivalTime').get(function() {
  const format = this.arrivalTime?.displayFormat || 'Arrival Within {time} mins';
  return format.replace('{time}', this.arrivalTime?.minutes || 13);
});

// ==================== PRE-SAVE MIDDLEWARE ====================
asapSectionSchema.pre('save', function(next) {
  // Auto-generate sectionId from name if not provided
  if (!this.sectionId && this.name) {
    const timestamp = Date.now().toString(36);
    const nameSlug = this.name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
    
    // Ensure sectionId is unique by adding timestamp
    this.sectionId = `${nameSlug}-${timestamp}`;
    
    console.log(`✅ Auto-generated sectionId: ${this.sectionId}`);
  }

  // Ensure sectionId exists (fallback)
  if (!this.sectionId) {
    this.sectionId = `asap-section-${Date.now().toString(36)}`;
    console.log(`⚠️ Fallback sectionId generated: ${this.sectionId}`);
  }

  // Update subtitle with arrival time if provided
  if (this.arrivalTime?.minutes && this.arrivalTime?.displayFormat) {
    this.highlightText = this.arrivalTime.displayFormat.replace('{time}', this.arrivalTime.minutes);
  }

  // Set default highlightText if not provided
  if (!this.highlightText && this.arrivalTime?.minutes) {
    this.highlightText = `Arrival Within ${this.arrivalTime.minutes} mins`;
  }

  next();
});

// ==================== METHODS ====================
// Check if section is currently visible
asapSectionSchema.methods.isCurrentlyVisible = function() {
  if (!this.isActive) return false;
  
  const now = new Date();

  // Check schedule
  if (this.schedule.isScheduled) {
    if (this.schedule.startDate && now < this.schedule.startDate) return false;
    if (this.schedule.endDate && now > this.schedule.endDate) return false;
  }

  // Check time-based availability
  if (this.schedule.timeBasedAvailability?.enabled) {
    const currentTime = now.toLocaleTimeString('en-US', { 
      hour12: false, 
      timeZone: this.schedule.timeBasedAvailability.timezone || 'Asia/Kolkata' 
    });
    const startTime = this.schedule.timeBasedAvailability.startTime;
    const endTime = this.schedule.timeBasedAvailability.endTime;
    
    if (currentTime < startTime || currentTime > endTime) return false;
  }

  // Check day availability
  if (this.schedule.availableDays && this.schedule.availableDays.length > 0) {
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const currentDay = days[now.getDay()];
    if (!this.schedule.availableDays.includes(currentDay)) return false;
  }

  return true;
};

// ==================== STATICS ====================
// Get active sections for mobile app
asapSectionSchema.statics.getActiveSections = async function(options = {}) {
  const { cityId, platform = 'all' } = options;

  const query = {
    isActive: true,
  };

  // Platform targeting
  if (platform !== 'all') {
    query['$or'] = [
      { 'targeting.platforms': 'all' },
      { 'targeting.platforms': platform },
      { 'targeting.platforms': { $size: 0 } },
    ];
  }

  // City targeting
  if (cityId) {
    query['$or'] = [
      ...(query['$or'] || []),
      { 'targeting.cities': { $size: 0 } },
      { 'targeting.cities': cityId },
    ];
  }

  const sections = await this.find(query)
    .populate({
      path: 'items.subservice',
      select: 'name description icon image pricing duration rating isActive categoryId',
      populate: {
        path: 'category',
        select: 'name categoryId icon',
      },
    })
    .populate('allowedCategories', 'name categoryId icon')
    .sort({ sortOrder: 1 })
    .lean();

  // Filter out items where subservice is inactive or null
  return sections.map(section => ({
    ...section,
    items: section.items
      .filter(item => item.isActive && item.subservice && item.subservice.isActive)
      .slice(0, section.displaySettings?.maxItemsToShow || 2),
  }));
};

// ==================== JSON TRANSFORM ====================
asapSectionSchema.methods.toJSON = function() {
  const section = this.toObject();
  section.id = section._id;
  delete section.__v;
  return section;
};

module.exports = asapSectionSchema;