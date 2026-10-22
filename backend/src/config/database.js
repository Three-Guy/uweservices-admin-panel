// src/config/database.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// Force Google DNS for MongoDB Atlas
try {
  require('dns').setServers(['8.8.8.8', '8.8.4.4']);
} catch (e) {
  console.log('DNS servers already set');
}

// ===== CONNECTIONS =====
let adminConnection = null;
let providerConnection = null;
let userConnection = null;
let bookingConnection = null; // ✅ NEW
let isConnected = false;

// ===== CONNECTION OPTIONS =====
const connectionOptions = {
  serverSelectionTimeoutMS: 30000,
  socketTimeoutMS: 45000,
  family: 4,
  maxPoolSize: 10,
  minPoolSize: 2,
  retryWrites: true,
  w: 'majority',
};

// ===== HELPER: Parse MongoDB Atlas URI =====
const createDbUri = (originalUri, dbName) => {
  try {
    const url = new URL(originalUri);
    url.pathname = `/${dbName}`;
    return url.toString();
  } catch (error) {
    const parts = originalUri.split('?');
    const baseUri = parts[0];
    const queryParams = parts[1] || 'retryWrites=true&w=majority';
    const newUri = baseUri.replace(/\/[^\/]*$/, `/${dbName}`);
    return `${newUri}?${queryParams}`;
  }
};

// ===== CONNECT TO ADMIN_PANEL DATABASE =====
const connectAdminDB = async () => {
  try {
    const uri = process.env.MONGODB_URI;
    
    if (!uri) {
      throw new Error('MONGODB_URI not found in .env');
    }

    const adminDbUri = createDbUri(uri, 'admin_panel');
    
    console.log('\n' + '─'.repeat(60));
    console.log('🔌 Connecting to ADMIN_PANEL Database...');
    console.log('─'.repeat(60));
    console.log('Database: admin_panel');
    
    adminConnection = mongoose.createConnection(adminDbUri, connectionOptions);

    await new Promise((resolve, reject) => {
      adminConnection.on('connected', () => resolve());
      adminConnection.on('error', (err) => reject(err));
      setTimeout(() => {
        if (adminConnection.readyState !== 1) {
          reject(new Error('Admin DB connection timeout'));
        }
      }, 30000);
    });

    console.log('✓ Admin Panel DB Connected');
    console.log('✓ Database:', adminConnection.name || 'admin_panel');
    
    return adminConnection;
    
  } catch (error) {
    console.error('✗ Admin DB Connection Error:', error.message);
    throw error;
  }
};

// ===== CONNECT TO PROVIDER_DB DATABASE =====
const connectProviderDB = async () => {
  try {
    const uri = process.env.MONGODB_URI;
    
    if (!uri) {
      throw new Error('MONGODB_URI not found in .env');
    }

    const providerDbUri = createDbUri(uri, 'provider_db');

    console.log('\n' + '─'.repeat(60));
    console.log('🔌 Connecting to PROVIDER_DB Database...');
    console.log('─'.repeat(60));
    console.log('Database: provider_db');
    
    providerConnection = mongoose.createConnection(providerDbUri, connectionOptions);

    await new Promise((resolve, reject) => {
      providerConnection.on('connected', () => resolve());
      providerConnection.on('error', (err) => reject(err));
      setTimeout(() => {
        if (providerConnection.readyState !== 1) {
          reject(new Error('Provider DB connection timeout'));
        }
      }, 30000);
    });

    console.log('✓ Provider DB Connected');
    console.log('✓ Database:', providerConnection.name || 'provider_db');
    
    return providerConnection;
    
  } catch (error) {
    console.error('✗ Provider DB Connection Error:', error.message);
    throw error;
  }
};

// ===== CONNECT TO USER_DB DATABASE =====
const connectUserDB = async () => {
  try {
    const uri = process.env.MONGODB_URI;
    
    if (!uri) {
      throw new Error('MONGODB_URI not found in .env');
    }

    const userDbName = process.env.USER_DB_NAME || 'user_db';
    const userDbUri = createDbUri(uri, userDbName);

    console.log('\n' + '─'.repeat(60));
    console.log('🔌 Connecting to USER_DB Database...');
    console.log('─'.repeat(60));
    console.log('Database:', userDbName);
    
    userConnection = mongoose.createConnection(userDbUri, connectionOptions);

    await new Promise((resolve, reject) => {
      userConnection.on('connected', () => resolve());
      userConnection.on('error', (err) => reject(err));
      setTimeout(() => {
        if (userConnection.readyState !== 1) {
          reject(new Error('User DB connection timeout'));
        }
      }, 30000);
    });

    console.log('✓ User DB Connected');
    console.log('✓ Database:', userConnection.name || userDbName);
    
    return userConnection;
    
  } catch (error) {
    console.error('✗ User DB Connection Error:', error.message);
    throw error;
  }
};

// ===== CONNECT TO BOOKINGS_DB DATABASE ✅ NEW =====
const connectBookingDB = async () => {
  try {
    const uri = process.env.MONGODB_URI;
    
    if (!uri) {
      throw new Error('MONGODB_URI not found in .env');
    }

    const bookingDbName = process.env.BOOKING_DB_NAME || 'bookings_db';
    const bookingDbUri = createDbUri(uri, bookingDbName);

    console.log('\n' + '─'.repeat(60));
    console.log('🔌 Connecting to BOOKINGS_DB Database...');
    console.log('─'.repeat(60));
    console.log('Database:', bookingDbName);
    
    bookingConnection = mongoose.createConnection(bookingDbUri, connectionOptions);

    await new Promise((resolve, reject) => {
      bookingConnection.on('connected', () => resolve());
      bookingConnection.on('error', (err) => reject(err));
      setTimeout(() => {
        if (bookingConnection.readyState !== 1) {
          reject(new Error('Booking DB connection timeout'));
        }
      }, 30000);
    });

    console.log('✓ Booking DB Connected');
    console.log('✓ Database:', bookingConnection.name || bookingDbName);
    console.log('─'.repeat(60) + '\n');
    
    return bookingConnection;
    
  } catch (error) {
    console.error('✗ Booking DB Connection Error:', error.message);
    throw error;
  }
};

// ===== ADMIN SCHEMA =====
const createAdminSchema = () => {
  const adminSchema = new mongoose.Schema({
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [6, 'Password must be at least 6 characters']
    },
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
    },
    role: {
      type: String,
      enum: ['super_admin', 'admin', 'moderator'],
      default: 'admin',
    },
    permissions: [{
      type: String,
    }],
    isActive: {
      type: Boolean,
      default: true,
    },
    lastLogin: {
      type: Date,
    },
    refreshToken: {
      type: String,
    },
  }, {
    timestamps: true,
  });

  adminSchema.pre('save', async function(next) {
    if (!this.isModified('password')) {
      return next();
    }
    try {
      const salt = await bcrypt.genSalt(10);
      this.password = await bcrypt.hash(this.password, salt);
      next();
    } catch (error) {
      next(error);
    }
  });

  adminSchema.methods.comparePassword = async function(candidatePassword) {
    try {
      return await bcrypt.compare(candidatePassword, this.password);
    } catch (error) {
      console.error('Password comparison error:', error);
      return false;
    }
  };

  adminSchema.methods.toJSON = function() {
    const admin = this.toObject();
    delete admin.password;
    delete admin.refreshToken;
    delete admin.__v;
    return admin;
  };

  return adminSchema;
};

// ===== PROVIDER SCHEMA =====
const createProviderSchema = () => {
  const providerSchema = new mongoose.Schema({
    providerId: {
      type: String,
      unique: true,
    },
    name: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
    },
    phone: {
      type: String,
      required: true,
    },
    password: {
      type: String,
    },
    profession: {
      type: String,
    },
    profileImage: {
      type: String,
    },
    gender: {
      type: String,
      enum: ['male', 'female', 'other'],
    },
    dateOfBirth: {
      type: Date,
    },
    verificationStatus: {
      type: String,
      enum: ['pending', 'verified', 'approved', 'rejected', 'incomplete', 'submitted'],
      default: 'incomplete',
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isAvailable: {
      type: Boolean,
      default: false,
    },
    isOnline: {
      type: Boolean,
      default: false,
    },
    isAcceptingJobs: {
      type: Boolean,
      default: false,
    },
    serviceRadius: {
      type: Number,
      default: 10,
    },
    location: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point',
      },
      coordinates: {
        type: [Number],
        default: [0, 0],
      },
      address: String,
      city: String,
      state: String,
      pincode: String,
    },
    currentLocation: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point',
      },
      coordinates: {
        type: [Number],
        default: [0, 0],
      },
    },
    rating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },
    totalRatings: {
      type: Number,
      default: 0,
    },
    totalBookings: {
      type: Number,
      default: 0,
    },
    completedBookings: {
      type: Number,
      default: 0,
    },
    cancelledBookings: {
      type: Number,
      default: 0,
    },
    todayEarnings: {
      type: Number,
      default: 0,
    },
    totalEarnings: {
      type: Number,
      default: 0,
    },
    walletBalance: {
      type: Number,
      default: 0,
    },
    verifiedAt: Date,
    verifiedBy: mongoose.Schema.Types.ObjectId,
    verificationNotes: String,
    rejectedAt: Date,
    rejectedBy: mongoose.Schema.Types.ObjectId,
    rejectionReason: String,
    services: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Service',
    }],
    fcmToken: String,
    deviceInfo: {
      platform: String,
      version: String,
      deviceId: String,
    },
    lastActiveAt: Date,
    lastLocationUpdate: Date,
  }, {
    timestamps: true,
  });

  providerSchema.index({ location: '2dsphere' });
  providerSchema.index({ currentLocation: '2dsphere' });
  providerSchema.index({ email: 1 });
  providerSchema.index({ phone: 1 });
  providerSchema.index({ providerId: 1 });
  providerSchema.index({ verificationStatus: 1 });
  providerSchema.index({ isActive: 1 });

  return providerSchema;
};

// ===== VERIFICATION SCHEMA =====
const createVerificationSchema = () => {
  const verificationSchema = new mongoose.Schema({
    verificationId: {
      type: String,
      unique: true,
    },
    provider: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Provider',
      required: true,
    },
    documents: {
      selfie: {
        url: String,
        publicId: String,
        uploadedAt: Date,
        verified: Boolean,
      },
      aadhaarCard: {
        url: String,
        publicId: String,
        uploadedAt: Date,
        verified: Boolean,
        number: String,
      },
      panCard: {
        url: String,
        publicId: String,
        uploadedAt: Date,
        verified: Boolean,
        number: String,
      },
      drivingLicense: {
        url: String,
        publicId: String,
        uploadedAt: Date,
        verified: Boolean,
      },
      bankDetails: {
        accountNumber: String,
        ifscCode: String,
        bankName: String,
        accountHolderName: String,
        verified: Boolean,
      },
    },
    selfieImage: String,
    selfiePublicId: String,
    aadhaarImage: String,
    aadhaarPublicId: String,
    panCardImage: String,
    panCardPublicId: String,
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'submitted', 'under_review'],
      default: 'pending',
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
    },
    reviewedAt: Date,
    rejectionReason: String,
    notes: String,
    adminNotes: String,
    attempts: {
      type: Number,
      default: 1,
    },
    submittedAt: Date,
  }, {
    timestamps: true,
  });

  verificationSchema.index({ status: 1 });
  verificationSchema.index({ provider: 1 });
  verificationSchema.index({ verificationId: 1 });

  return verificationSchema;
};

// ===== USER SCHEMA (Matches User Backend) =====
const createUserSchema = () => {
  const userSchema = new mongoose.Schema({
    name: {
      type: String,
      required: [true, 'Please provide a name'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Please provide an email'],
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      select: false,
    },
    phone: {
      type: String,
      default: null,
    },
    profilePicture: {
      type: String,
      default: null,
    },
    gender: {
      type: String,
      enum: ['Male', 'Female', 'Other', null],
      default: null,
    },
    dateOfBirth: {
      type: Date,
      default: null,
    },
    address: {
      type: String,
      default: null,
    },
    authProvider: {
      type: String,
      enum: ['local', 'email', 'google', 'firebase', 'apple'],
      default: 'local',
    },
    googleId: {
      type: String,
      sparse: true,
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    role: {
      type: String,
      enum: ['user', 'admin', 'provider'],
      default: 'user',
    },
    resetPasswordOTP: {
      type: String,
      default: null,
    },
    resetPasswordOTPExpiry: {
      type: Date,
      default: null,
    },
    lastLogin: {
      type: Date,
      default: null,
    },
    passwordChangedAt: {
      type: Date,
      default: null,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
  }, {
    timestamps: true,
  });

  userSchema.index({ email: 1 }, { unique: true });
  userSchema.index({ googleId: 1 }, { unique: true, sparse: true });
  userSchema.index({ createdAt: -1 });
  userSchema.index({ phone: 1 });
  userSchema.index({ isActive: 1 });

  return userSchema;
};

// ===== BOOKING SCHEMA ✅ NEW (strict: false to preserve all 60+ fields) =====
const createBookingSchema = () => {
  const bookingSchema = new mongoose.Schema({}, {
    strict: false,
    timestamps: true,
    collection: 'bookings',
    minimize: false,
  });

  bookingSchema.methods.toJSON = function() {
    const booking = this.toObject();
    booking.id = booking._id;
    return booking;
  };

  return bookingSchema;
};

// ============================================================================
// ===== SERVER-DRIVEN UI SCHEMAS =============================================
// ============================================================================

// ===== CATEGORY SCHEMA =====
const createCategorySchema = () => {
  const categorySchema = new mongoose.Schema({
    categoryId: {
      type: String,
      required: [true, 'Category ID is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[a-z0-9-]+$/, 'Category ID can only contain lowercase letters, numbers, and hyphens'],
    },
    name: {
      type: String,
      required: [true, 'Category name is required'],
      trim: true,
      maxlength: [100, 'Category name cannot exceed 100 characters'],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, 'Description cannot exceed 500 characters'],
      default: '',
    },
    icon: {
      type: String,
      default: '📦',
    },
    image: {
      url: { type: String, default: null },
      publicId: { type: String, default: null },
    },
    color: {
      type: String,
      default: '#FF8C42',
      match: [/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, 'Invalid hex color'],
    },
    colorClass: {
      type: String,
      default: 'bg-orange-100',
    },
    action: {
      actionType: {
        type: String,
        enum: ['none', 'services', 'category_detail', 'url', 'screen', 'deeplink', 'promo'],
        default: 'services',
      },
      targetUrl: {
        type: String,
        default: '',
      },
      screenName: {
        type: String,
        default: '',
      },
      deeplink: {
        type: String,
        default: '',
      },
      targetCategory: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category',
        default: null,
      },
      targetService: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Service',
        default: null,
      },
      promoCode: {
        type: String,
        default: '',
      },
      params: {
        type: mongoose.Schema.Types.Mixed,
        default: {},
      },
      openInExternalBrowser: {
        type: Boolean,
        default: false,
      },
    },
    sortOrder: {
      type: Number,
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isFeatured: {
      type: Boolean,
      default: false,
    },
    isMoreServicesSection: {
      type: Boolean,
      default: false,
    },
    moreServicesConfig: {
      action: {
        actionType: {
          type: String,
          enum: ['all_services', 'all_categories', 'specific_category', 'custom_screen', 'external_url'],
          default: 'all_services',
        },
        targetCategory: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Category',
          default: null,
        },
        screenName: {
          type: String,
          default: '',
        },
        url: {
          type: String,
          default: '',
        },
      },
      displaySettings: {
        title: {
          type: String,
          default: 'More Services',
        },
        subtitle: {
          type: String,
          default: 'Explore all services',
        },
        showServiceCount: {
          type: Boolean,
          default: true,
        },
        customBadge: {
          type: String,
          default: '',
        },
      },
      serviceFilters: {
        showAllServices: {
          type: Boolean,
          default: true,
        },
        includeCategories: [{
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Category',
        }],
        excludeCategories: [{
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Category',
        }],
        onlyPopular: {
          type: Boolean,
          default: false,
        },
        onlyFeatured: {
          type: Boolean,
          default: false,
        },
        tags: [{
          type: String,
          lowercase: true,
        }],
      },
      layout: {
        viewType: {
          type: String,
          enum: ['grid', 'list', 'grouped_by_category'],
          default: 'grid',
        },
        gridColumns: {
          type: Number,
          default: 2,
          min: 1,
          max: 4,
        },
        showSearch: {
          type: Boolean,
          default: true,
        },
        showCategoryFilters: {
          type: Boolean,
          default: true,
        },
        defaultSort: {
          type: String,
          enum: ['name', 'popular', 'price_low_high', 'price_high_low', 'newest'],
          default: 'name',
        },
      },
    },
    subservicesCount: {
      type: Number,
      default: 0,
    },
    availableCities: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'City',
    }],
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

  categorySchema.index({ categoryId: 1 }, { unique: true });
  categorySchema.index({ isActive: 1 });
  categorySchema.index({ isFeatured: 1 });
  categorySchema.index({ isMoreServicesSection: 1 });
  categorySchema.index({ sortOrder: 1 });
  categorySchema.index({ name: 'text', description: 'text' });

  categorySchema.virtual('services', {
    ref: 'Service',
    localField: '_id',
    foreignField: 'category',
  });

  categorySchema.pre('save', function(next) {
    if (!this.categoryId && this.name) {
      this.categoryId = this.name
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .trim();
    }

    if (!this.action || !this.action.actionType) {
      this.action = {
        actionType: 'services',
        targetUrl: '',
        screenName: '',
        deeplink: '',
        targetCategory: null,
        targetService: null,
        promoCode: '',
        params: {},
        openInExternalBrowser: false,
      };
    }

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

  categorySchema.methods.toJSON = function() {
    const category = this.toObject();
    category.id = category._id;
    delete category.__v;
    return category;
  };

  categorySchema.statics.ensureSingleMoreServicesSection = async function(excludeId = null) {
    const query = { isMoreServicesSection: true };
    if (excludeId) {
      query._id = { $ne: excludeId };
    }
    
    const existingSection = await this.findOne(query);
    return existingSection;
  };

  return categorySchema;
};

// ===== SERVICE SCHEMA =====
const createServiceSchema = () => {
  const serviceSchema = new mongoose.Schema({
    serviceId: {
      type: String,
      required: [true, 'Service ID is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[a-z0-9-]+$/, 'Service ID can only contain lowercase letters, numbers, and hyphens'],
    },
    name: {
      type: String,
      required: [true, 'Service name is required'],
      trim: true,
      maxlength: [100, 'Service name cannot exceed 100 characters'],
    },
    subtitle: {
      type: String,
      trim: true,
      maxlength: [200, 'Subtitle cannot exceed 200 characters'],
      default: '',
    },
    description: {
      type: String,
      trim: true,
      maxlength: [2000, 'Description cannot exceed 2000 characters'],
      default: '',
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      required: [true, 'Category is required'],
    },
    categoryName: {
      type: String,
      trim: true,
    },
    icon: {
      type: String,
      default: '🔧',
    },
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
    image: {
      type: String,
      default: null,
    },
    pricing: {
      basePrice: {
        type: Number,
        default: 0,
        min: [0, 'Price cannot be negative'],
      },
      currency: {
        type: String,
        default: 'USD',
        enum: ['USD', 'INR', 'EUR', 'GBP'],
      },
      displayText: {
        type: String,
        default: '',
      },
      priceType: {
        type: String,
        enum: ['fixed', 'starting_from', 'hourly', 'per_unit', 'custom'],
        default: 'starting_from',
      },
    },
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
    metrics: {
      responseTime: {
        type: String,
        default: '30 mins',
      },
      completionRate: {
        type: Number,
        default: 95,
        min: 0,
        max: 100,
      },
      totalBookings: {
        type: Number,
        default: 0,
      },
      todayBookings: {
        type: Number,
        default: 0,
      },
    },
    display: {
      colorClass: {
        type: String,
        default: 'bg-blue-100',
      },
      badge: {
        text: { type: String, default: '' },
        badgeType: { type: String, enum: ['', 'success', 'warning', 'info', 'danger'], default: '' },
      },
      sortOrder: {
        type: Number,
        default: 0,
      },
    },
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
      timeSlots: [{
        day: { type: String, enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] },
        startTime: { type: String },
        endTime: { type: String },
        isAvailable: { type: Boolean, default: true },
      }],
    },
    seo: {
      metaTitle: { type: String, maxlength: 70 },
      metaDescription: { type: String, maxlength: 160 },
      keywords: [{ type: String }],
    },
    tags: [{
      type: String,
      lowercase: true,
      trim: true,
    }],
    subservicesCount: {
      type: Number,
      default: 0,
    },
    providersCount: {
      type: Number,
      default: 0,
    },
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

  serviceSchema.index({ serviceId: 1 }, { unique: true });
  serviceSchema.index({ category: 1 });
  serviceSchema.index({ isActive: 1 });
  serviceSchema.index({ isPopular: 1 });
  serviceSchema.index({ isFeatured: 1 });
  serviceSchema.index({ 'display.sortOrder': 1 });
  serviceSchema.index({ 'availability.cities': 1 });
  serviceSchema.index({ tags: 1 });
  serviceSchema.index({ name: 'text', description: 'text', tags: 'text' });

  serviceSchema.pre('save', function(next) {
    if (!this.serviceId && this.name) {
      this.serviceId = this.name
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .trim();
    }
    if (this.images?.hero?.url && !this.image) {
      this.image = this.images.hero.url;
    }
    next();
  });

  serviceSchema.methods.toJSON = function() {
    const service = this.toObject();
    service.id = service._id;
    delete service.__v;
    return service;
  };

  serviceSchema.statics.updateSubservicesCount = async function(serviceId) {
    const Subservice = this.model('Subservice');
    const count = await Subservice.countDocuments({ service: serviceId, isActive: true });
    await this.updateOne({ _id: serviceId }, { subservicesCount: count });
    return count;
  };

  return serviceSchema;
};

// ===== SUBSERVICE SCHEMA =====
const createSubserviceSchema = () => {
  const subserviceSchema = new mongoose.Schema({
    subserviceId: {
      type: String,
      required: [true, 'Subservice ID is required'],
      unique: true,
      lowercase: true,
      trim: true,
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      required: [true, 'Category reference is required'],
    },
    categoryId: {
      type: String,
      required: true,
    },
    service: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Service',
      default: null,
    },
    serviceId: {
      type: String,
      default: '',
    },
    name: {
      type: String,
      required: [true, 'Subservice name is required'],
      trim: true,
      maxlength: [150, 'Name cannot exceed 150 characters'],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, 'Description cannot exceed 500 characters'],
      default: '',
    },
    icon: {
      type: String,
      default: '🔧',
    },
    colorClass: {
      type: String,
      default: 'bg-blue-100',
    },
    pricing: {
      price: {
        type: Number,
        required: [true, 'Price is required'],
        min: [0, 'Price cannot be negative'],
      },
      originalPrice: {
        type: Number,
        default: null,
      },
      currency: {
        type: String,
        default: 'INR',
        enum: ['USD', 'INR', 'EUR', 'GBP'],
      },
      displayText: {
        type: String,
        default: '',
      },
      priceType: {
        type: String,
        enum: ['fixed', 'starting_from', 'hourly', 'per_sqft', 'custom'],
        default: 'starting_from',
      },
      unit: {
        type: String,
        default: '',
      },
    },
    duration: {
      minutes: {
        type: Number,
        default: 60,
      },
      displayText: {
        type: String,
        default: '60 mins',
      },
    },
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
    isActive: {
      type: Boolean,
      default: true,
    },
    isPopular: {
      type: Boolean,
      default: false,
    },
    sortOrder: {
      type: Number,
      default: 0,
    },
    includes: [{
      type: String,
      trim: true,
    }],
    excludes: [{
      type: String,
      trim: true,
    }],
    requirements: [{
      type: String,
      trim: true,
    }],
    images: [{
      url: { type: String },
      publicId: { type: String },
    }],
    availability: {
      cities: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'City',
      }],
      zones: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Zone',
      }],
    },
    bookingCount: {
      type: Number,
      default: 0,
    },
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

  subserviceSchema.index({ subserviceId: 1 }, { unique: true });
  subserviceSchema.index({ category: 1 });
  subserviceSchema.index({ categoryId: 1 });
  subserviceSchema.index({ service: 1 });
  subserviceSchema.index({ serviceId: 1 });
  subserviceSchema.index({ isActive: 1 });
  subserviceSchema.index({ isPopular: 1 });
  subserviceSchema.index({ sortOrder: 1 });
  subserviceSchema.index({ 'pricing.price': 1 });
  subserviceSchema.index({ name: 'text', description: 'text' });

  subserviceSchema.pre('save', async function(next) {
    if (!this.subserviceId && this.name && this.categoryId) {
      const nameSlug = this.name
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .trim();
      this.subserviceId = `${this.categoryId}-${nameSlug}`;
    }
    
    if (this.pricing.price && !this.pricing.displayText) {
      const currencySymbols = { USD: '$', INR: '₹', EUR: '€', GBP: '£' };
      const symbol = currencySymbols[this.pricing.currency] || '₹';
      if (this.pricing.priceType === 'fixed') {
        this.pricing.displayText = `${symbol}${this.pricing.price}`;
      } else {
        this.pricing.displayText = `${symbol}${this.pricing.price} onwards`;
      }
    }
    next();
  });

  subserviceSchema.methods.toJSON = function() {
    const subservice = this.toObject();
    subservice.id = subservice._id;
    subservice.price = subservice.pricing?.displayText || `₹${subservice.pricing?.price} onwards`;
    delete subservice.__v;
    return subservice;
  };

  return subserviceSchema;
};

// ===== BANNER SCHEMA =====
const createBannerSchema = () => {
  const bannerSchema = new mongoose.Schema({
    bannerId: {
      type: String,
      required: [true, 'Banner ID is required'],
      unique: true,
      lowercase: true,
      trim: true,
    },
    title: {
      type: String,
      required: [true, 'Banner title is required'],
      trim: true,
      maxlength: [200, 'Title cannot exceed 200 characters'],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, 'Description cannot exceed 500 characters'],
      default: '',
    },
    image: {
      url: {
        type: String,
        required: [true, 'Banner image URL is required'],
      },
      publicId: {
        type: String,
        default: null,
      },
      darkModeUrl: {
        type: String,
        default: null,
      },
      altText: {
        type: String,
        default: '',
      },
    },
    mobileImage: {
      url: { type: String, default: null },
      publicId: { type: String, default: null },
    },
    action: {
      type: {
        type: String,
        enum: ['none', 'service', 'category', 'url', 'screen', 'promo'],
        default: 'none',
      },
      target: {
        type: String,
        default: '',
      },
      serviceRef: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Service',
      },
      categoryRef: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category',
      },
      promoCode: {
        type: String,
        default: '',
      },
    },
    animation: {
      type: {
        type: String,
        enum: ['none', 'fade', 'slide', 'zoom', 'flip'],
        default: 'slide',
      },
      duration: {
        type: Number,
        default: 500,
      },
      autoPlayDelay: {
        type: Number,
        default: 5000,
      },
    },
    schedule: {
      isScheduled: {
        type: Boolean,
        default: false,
      },
      startDate: {
        type: Date,
        default: null,
      },
      endDate: {
        type: Date,
        default: null,
      },
      timezone: {
        type: String,
        default: 'UTC',
      },
    },
    targeting: {
      cities: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'City',
      }],
      userSegments: [{
        type: String,
        enum: ['all', 'new_users', 'returning_users', 'premium_users'],
      }],
      platforms: [{
        type: String,
        enum: ['all', 'ios', 'android', 'web'],
      }],
    },
    display: {
      sortOrder: {
        type: Number,
        default: 0,
      },
      position: {
        type: String,
        enum: ['hero', 'middle', 'bottom', 'popup'],
        default: 'hero',
      },
      backgroundColor: {
        type: String,
        default: '#000000',
      },
      overlay: {
        enabled: { type: Boolean, default: false },
        title: { type: String, default: '' },
        subtitle: { type: String, default: '' },
        buttonText: { type: String, default: '' },
        textColor: { type: String, default: '#FFFFFF' },
      },
    },
    isActive: {
      type: Boolean,
      default: true,
    },
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
    campaign: {
      name: { type: String, default: '' },
      source: { type: String, default: '' },
    },
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

  bannerSchema.index({ bannerId: 1 }, { unique: true });
  bannerSchema.index({ isActive: 1 });
  bannerSchema.index({ 'display.sortOrder': 1 });
  bannerSchema.index({ 'display.position': 1 });
  bannerSchema.index({ 'schedule.startDate': 1, 'schedule.endDate': 1 });
  bannerSchema.index({ 'targeting.cities': 1 });

  bannerSchema.virtual('isScheduledToShow').get(function() {
    if (!this.schedule.isScheduled) return true;
    const now = new Date();
    const start = this.schedule.startDate;
    const end = this.schedule.endDate;
    if (start && now < start) return false;
    if (end && now > end) return false;
    return true;
  });

  bannerSchema.pre('save', function(next) {
    if (!this.bannerId && this.title) {
      const timestamp = Date.now().toString(36);
      const titleSlug = this.title
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .substring(0, 30);
      this.bannerId = `${titleSlug}-${timestamp}`;
    }
    if (this.analytics.impressions > 0) {
      this.analytics.ctr = (this.analytics.clicks / this.analytics.impressions) * 100;
    }
    next();
  });

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

  bannerSchema.methods.toJSON = function() {
    const banner = this.toObject();
    banner.id = banner._id;
    delete banner.__v;
    return banner;
  };

  return bannerSchema;
};

// ===== LAYOUT CONFIG SCHEMA =====
const createLayoutConfigSchema = () => {
  const sectionSchema = new mongoose.Schema({
    sectionId: {
      type: String,
      required: true,
    },
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
      ],
    },
    enabled: {
      type: Boolean,
      default: true,
    },
    order: {
      type: Number,
      required: true,
    },
    title: {
      type: String,
      default: '',
    },
    subtitle: {
      type: String,
      default: '',
    },
    showViewAll: {
      type: Boolean,
      default: false,
    },
    viewAllTarget: {
      type: String,
      default: '',
    },
    dataSource: {
      type: String,
      enum: ['', 'banners', 'categories', 'services', 'popular', 'trending', 'featured', 'recent', 'custom'],
      default: '',
    },
    layout: {
      style: {
        type: String,
        enum: ['grid', 'list', 'horizontal', 'carousel', 'masonry'],
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
    },
    style: {
      backgroundColor: { type: String, default: 'transparent' },
      paddingTop: { type: Number, default: 0 },
      paddingBottom: { type: Number, default: 0 },
      paddingHorizontal: { type: Number, default: 16 },
      marginTop: { type: Number, default: 0 },
      marginBottom: { type: Number, default: 24 },
    },
    cardStyle: {
      showImage: { type: Boolean, default: true },
      showTitle: { type: Boolean, default: true },
      showSubtitle: { type: Boolean, default: false },
      showPrice: { type: Boolean, default: false },
      showRating: { type: Boolean, default: false },
      showBadge: { type: Boolean, default: true },
      imageAspectRatio: { type: String, default: '16:9' },
      titleLines: { type: Number, default: 2 },
    },
    filters: {
      categories: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Category' }],
      services: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Service' }],
      tags: [{ type: String }],
      cities: [{ type: mongoose.Schema.Types.ObjectId, ref: 'City' }],
      isPopular: { type: Boolean, default: null },
      isFeatured: { type: Boolean, default: null },
    },
    customData: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    abTest: {
      enabled: { type: Boolean, default: false },
      variantId: { type: String, default: '' },
    },
    visibility: {
      requireAuth: { type: Boolean, default: false },
      newUsersOnly: { type: Boolean, default: false },
      platforms: [{ type: String, enum: ['all', 'ios', 'android', 'web'] }],
      minAppVersion: { type: String, default: '' },
    },
  }, { _id: true });

  const layoutConfigSchema = new mongoose.Schema({
    page: {
      type: String,
      required: [true, 'Page identifier is required'],
      unique: true,
      lowercase: true,
      trim: true,
      enum: ['home', 'services', 'categories', 'profile', 'booking', 'search'],
    },
    pageName: {
      type: String,
      default: '',
    },
    description: {
      type: String,
      default: '',
    },
    sections: [sectionSchema],
    settings: {
      pullToRefresh: { type: Boolean, default: true },
      showHeader: { type: Boolean, default: true },
      headerStyle: {
        type: String,
        enum: ['default', 'transparent', 'solid', 'gradient'],
        default: 'default',
      },
      backgroundColor: { type: String, default: '#FFFFFF' },
      darkBackgroundColor: { type: String, default: '#111827' },
      statusBarStyle: {
        type: String,
        enum: ['default', 'light', 'dark'],
        default: 'default',
      },
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isPublished: {
      type: Boolean,
      default: false,
    },
    version: {
      type: Number,
      default: 1,
    },
    draft: {
      sections: [sectionSchema],
      settings: { type: mongoose.Schema.Types.Mixed },
      lastSavedAt: { type: Date },
    },
    publishHistory: [{
      version: { type: Number },
      publishedAt: { type: Date },
      publishedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
      changes: { type: String },
    }],
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

  layoutConfigSchema.index({ page: 1 }, { unique: true });
  layoutConfigSchema.index({ isActive: 1 });
  layoutConfigSchema.index({ isPublished: 1 });

  layoutConfigSchema.pre('save', function(next) {
    if (this.sections && this.sections.length > 0) {
      this.sections.forEach((section, index) => {
        if (!section.sectionId) {
          section.sectionId = `${this.page}-section-${index + 1}-${Date.now().toString(36)}`;
        }
      });
    }
    next();
  });

  layoutConfigSchema.methods.getEnabledSections = function() {
    return this.sections
      .filter(section => section.enabled)
      .sort((a, b) => a.order - b.order);
  };

  layoutConfigSchema.methods.publishDraft = async function(adminId, changes = '') {
    if (this.draft && this.draft.sections) {
      this.version += 1;
      this.sections = this.draft.sections;
      if (this.draft.settings) {
        this.settings = { ...this.settings, ...this.draft.settings };
      }
      this.publishHistory.push({
        version: this.version,
        publishedAt: new Date(),
        publishedBy: adminId,
        changes: changes,
      });
      this.isPublished = true;
      this.publishedAt = new Date();
      this.publishedBy = adminId;
      this.draft = undefined;
      await this.save();
    }
    return this;
  };

  layoutConfigSchema.statics.getPageLayout = async function(page) {
    let layout = await this.findOne({ page, isActive: true });
    if (!layout) {
      layout = await this.createDefaultLayout(page);
    }
    return layout;
  };

  layoutConfigSchema.statics.createDefaultLayout = async function(page) {
    const defaultSections = {
      home: [
        { sectionId: 'home-banner', type: 'banner_carousel', enabled: true, order: 1, dataSource: 'banners', title: '' },
        { sectionId: 'home-search', type: 'search_bar', enabled: true, order: 2 },
        { sectionId: 'home-categories', type: 'category_grid', enabled: true, order: 3, title: 'Our Services', layout: { columns: 2, itemsToShow: 4 }, showViewAll: true, viewAllTarget: '/services' },
        { sectionId: 'home-trending', type: 'trending_services', enabled: true, order: 4, title: 'Trending Now', dataSource: 'trending', layout: { style: 'horizontal', itemsToShow: 5 } },
        { sectionId: 'home-emergency', type: 'emergency_section', enabled: true, order: 5 },
      ],
      services: [
        { sectionId: 'services-search', type: 'search_bar', enabled: true, order: 1 },
        { sectionId: 'services-list', type: 'service_grid', enabled: true, order: 2, dataSource: 'services', layout: { columns: 2 } },
      ],
      categories: [
        { sectionId: 'categories-list', type: 'category_list', enabled: true, order: 1, dataSource: 'categories' },
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

  layoutConfigSchema.methods.toJSON = function() {
    const layout = this.toObject();
    layout.id = layout._id;
    delete layout.__v;
    return layout;
  };

  return layoutConfigSchema;
};

// ===== FEATURE FLAG SCHEMA =====
const createFeatureFlagSchema = () => {
  const featureFlagSchema = new mongoose.Schema({
    key: {
      type: String,
      required: [true, 'Feature key is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[a-z0-9_]+$/, 'Key can only contain lowercase letters, numbers, and underscores'],
    },
    name: {
      type: String,
      required: [true, 'Feature name is required'],
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    enabled: {
      type: Boolean,
      default: false,
    },
    type: {
      type: String,
      enum: ['boolean', 'percentage', 'user_list', 'date_range'],
      default: 'boolean',
    },
    value: {
      percentage: {
        type: Number,
        default: 0,
        min: 0,
        max: 100,
      },
      userIds: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      }],
      jsonValue: {
        type: mongoose.Schema.Types.Mixed,
        default: null,
      },
    },
    schedule: {
      isScheduled: {
        type: Boolean,
        default: false,
      },
      startDate: {
        type: Date,
        default: null,
      },
      endDate: {
        type: Date,
        default: null,
      },
    },
    targeting: {
      platforms: [{
        type: String,
        enum: ['all', 'ios', 'android', 'web'],
      }],
      minAppVersion: {
        type: String,
        default: '',
      },
      maxAppVersion: {
        type: String,
        default: '',
      },
      cities: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'City',
      }],
      userSegments: [{
        type: String,
        enum: ['all', 'new_users', 'returning_users', 'premium_users'],
      }],
    },
    environment: {
      type: String,
      enum: ['all', 'development', 'staging', 'production'],
      default: 'all',
    },
    category: {
      type: String,
      enum: ['ui', 'feature', 'experiment', 'promotion', 'maintenance', 'other'],
      default: 'feature',
    },
    tags: [{
      type: String,
      lowercase: true,
    }],
    dependencies: [{
      type: String,
    }],
    overrides: [{
      condition: { type: String },
      value: { type: Boolean },
      priority: { type: Number, default: 0 },
    }],
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
    },
    history: [{
      action: { type: String, enum: ['created', 'enabled', 'disabled', 'updated'] },
      performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
      performedAt: { type: Date, default: Date.now },
      previousValue: { type: Boolean },
      newValue: { type: Boolean },
      notes: { type: String },
    }],
  }, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  });

  featureFlagSchema.index({ key: 1 }, { unique: true });
  featureFlagSchema.index({ enabled: 1 });
  featureFlagSchema.index({ category: 1 });
  featureFlagSchema.index({ tags: 1 });
  featureFlagSchema.index({ environment: 1 });

  featureFlagSchema.virtual('isCurrentlyActive').get(function() {
    if (!this.enabled) return false;
    if (this.schedule.isScheduled) {
      const now = new Date();
      if (this.schedule.startDate && now < this.schedule.startDate) return false;
      if (this.schedule.endDate && now > this.schedule.endDate) return false;
    }
    return true;
  });

  featureFlagSchema.pre('save', function(next) {
    if (this.isModified('enabled') && !this.isNew) {
      this.history.push({
        action: this.enabled ? 'enabled' : 'disabled',
        performedBy: this.updatedBy,
        performedAt: new Date(),
        previousValue: !this.enabled,
        newValue: this.enabled,
      });
    }
    next();
  });

  featureFlagSchema.statics.isEnabled = async function(key, context = {}) {
    const { userId, platform, appVersion, cityId } = context;
    const flag = await this.findOne({ key });
    if (!flag) return false;
    if (!flag.enabled) return false;
    if (flag.schedule.isScheduled) {
      const now = new Date();
      if (flag.schedule.startDate && now < flag.schedule.startDate) return false;
      if (flag.schedule.endDate && now > flag.schedule.endDate) return false;
    }
    if (flag.type === 'percentage' && flag.value.percentage < 100) {
      if (userId) {
        const hash = userId.toString().split('').reduce((a, b) => {
          a = ((a << 5) - a) + b.charCodeAt(0);
          return a & a;
        }, 0);
        const userPercentage = Math.abs(hash) % 100;
        if (userPercentage >= flag.value.percentage) return false;
      }
    }
    if (flag.type === 'user_list' && flag.value.userIds.length > 0) {
      if (!userId || !flag.value.userIds.includes(userId)) return false;
    }
    if (flag.targeting.platforms.length > 0 && !flag.targeting.platforms.includes('all')) {
      if (!platform || !flag.targeting.platforms.includes(platform)) return false;
    }
    if (flag.targeting.cities.length > 0) {
      if (!cityId || !flag.targeting.cities.includes(cityId)) return false;
    }
    return true;
  };

  featureFlagSchema.statics.getAllFlags = async function(context = {}) {
    const flags = await this.find({ enabled: true }).lean();
    const result = {};
    for (const flag of flags) {
      result[flag.key] = await this.isEnabled(flag.key, context);
    }
    return result;
  };

  featureFlagSchema.methods.toJSON = function() {
    const flag = this.toObject();
    flag.id = flag._id;
    delete flag.__v;
    return flag;
  };

  return featureFlagSchema;
};

// ============================================================================
// ===== CHECKOUT SCHEMAS (NEW) ==============================================
// ============================================================================

// ===== COUPON SCHEMA =====
const createCouponSchema = () => {
  const couponSchema = new mongoose.Schema({
    code: {
      type: String,
      required: [true, 'Coupon code is required'],
      unique: true,
      uppercase: true,
      trim: true,
      minlength: [3, 'Coupon code must be at least 3 characters'],
      maxlength: [20, 'Coupon code cannot exceed 20 characters'],
    },
    name: {
      type: String,
      required: [true, 'Coupon name is required'],
      trim: true,
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, 'Description cannot exceed 500 characters'],
      default: '',
    },
    discountType: {
      type: String,
      enum: ['percentage', 'fixed'],
      required: [true, 'Discount type is required'],
    },
    discountValue: {
      type: Number,
      required: [true, 'Discount value is required'],
      min: [0, 'Discount value cannot be negative'],
    },
    maxDiscountAmount: {
      type: Number,
      default: null,
      min: [0, 'Max discount amount cannot be negative'],
    },
    minOrderValue: {
      type: Number,
      default: 0,
      min: [0, 'Minimum order value cannot be negative'],
    },
    validFrom: {
      type: Date,
      required: [true, 'Valid from date is required'],
      default: Date.now,
    },
    validUntil: {
      type: Date,
      required: [true, 'Valid until date is required'],
    },
    usageLimit: {
      totalUses: {
        type: Number,
        default: null,
        min: [0, 'Total uses cannot be negative'],
      },
      perUser: {
        type: Number,
        default: 1,
        min: [1, 'Per user limit must be at least 1'],
      },
    },
    currentUsageCount: {
      type: Number,
      default: 0,
    },
    usedBy: [{
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
      usedAt: {
        type: Date,
        default: Date.now,
      },
      orderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Booking',
      },
      discountApplied: {
        type: Number,
      },
    }],
    applicableFor: {
      type: String,
      enum: ['all', 'new_users', 'specific_users', 'first_booking'],
      default: 'all',
    },
    specificUsers: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    }],
    applicableServices: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Service',
    }],
    applicableCategories: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
    }],
    isActive: {
      type: Boolean,
      default: true,
    },
    isAutoApply: {
      type: Boolean,
      default: false,
    },
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
  couponSchema.index({ code: 1 }, { unique: true });
  couponSchema.index({ isActive: 1 });
  couponSchema.index({ validFrom: 1, validUntil: 1 });

  // Virtuals
  couponSchema.virtual('isExpired').get(function() {
    return new Date() > this.validUntil;
  });

  couponSchema.virtual('isValid').get(function() {
    const now = new Date();
    return this.isActive && now >= this.validFrom && now <= this.validUntil;
  });

  // Methods
  couponSchema.methods.canBeUsedBy = function(userId) {
    if (!this.isActive) return { valid: false, reason: 'Coupon is inactive' };
    
    const now = new Date();
    if (now < this.validFrom || now > this.validUntil) {
      return { valid: false, reason: 'Coupon is expired or not yet valid' };
    }

    if (this.usageLimit.totalUses && this.currentUsageCount >= this.usageLimit.totalUses) {
      return { valid: false, reason: 'Coupon usage limit reached' };
    }

    if (userId) {
      const userUsage = this.usedBy.filter(u => u.user && u.user.toString() === userId.toString()).length;
      if (userUsage >= this.usageLimit.perUser) {
        return { valid: false, reason: 'You have already used this coupon maximum times' };
      }
    }

    return { valid: true };
  };

  couponSchema.methods.calculateDiscount = function(orderAmount) {
    if (orderAmount < this.minOrderValue) {
      return {
        applicable: false,
        reason: `Minimum order value of ₹${this.minOrderValue} required`,
        discount: 0,
      };
    }

    let discount = 0;
    
    if (this.discountType === 'percentage') {
      discount = (orderAmount * this.discountValue) / 100;
      if (this.maxDiscountAmount && discount > this.maxDiscountAmount) {
        discount = this.maxDiscountAmount;
      }
    } else {
      discount = this.discountValue;
    }

    discount = Math.min(discount, orderAmount);

    return {
      applicable: true,
      discount: Math.round(discount * 100) / 100,
      finalAmount: Math.round((orderAmount - discount) * 100) / 100,
    };
  };

  // Statics
  couponSchema.statics.validateCoupon = async function(code, userId, orderAmount) {
    const coupon = await this.findOne({ 
      code: code.toUpperCase(), 
      isActive: true 
    });

    if (!coupon) {
      return { valid: false, message: 'Invalid coupon code' };
    }

    const canUse = coupon.canBeUsedBy(userId);
    if (!canUse.valid) {
      return { valid: false, message: canUse.reason };
    }

    const discountInfo = coupon.calculateDiscount(orderAmount);
    if (!discountInfo.applicable) {
      return { valid: false, message: discountInfo.reason };
    }

    return {
      valid: true,
      coupon: coupon,
      discount: discountInfo.discount,
      finalAmount: discountInfo.finalAmount,
    };
  };

  // Pre-save hook
  couponSchema.pre('save', function(next) {
    if (this.code) {
      this.code = this.code.toUpperCase().trim();
    }
    if (this.validFrom && this.validUntil && this.validFrom >= this.validUntil) {
      return next(new Error('Valid until date must be after valid from date'));
    }
    if (this.discountType === 'percentage' && this.discountValue > 100) {
      return next(new Error('Percentage discount cannot exceed 100%'));
    }
    next();
  });

  return couponSchema;
};

// ===== CHECKOUT SETTINGS SCHEMA =====
const createCheckoutSettingsSchema = () => {
  const checkoutSettingsSchema = new mongoose.Schema({
    serviceFee: {
      type: { type: String, enum: ['fixed', 'percentage'], default: 'fixed' },
      value: { type: Number, default: 2, min: 0 },
      maxAmount: { type: Number, default: null },
    },
    platformFee: {
      type: { type: String, enum: ['fixed', 'percentage'], default: 'fixed' },
      value: { type: Number, default: 0, min: 0 },
      maxAmount: { type: Number, default: null },
    },
    tax: {
      type: { type: String, enum: ['fixed', 'percentage'], default: 'percentage' },
      value: { type: Number, default: 18, min: 0 },
      name: { type: String, default: 'GST' },
    },
    paymentMethods: {
      payAfterService: {
        enabled: { type: Boolean, default: true },
        label: { type: String, default: 'Pay After Service' },
        description: { type: String, default: 'Cash or QR on completion' },
        icon: { type: String, default: 'clock' },
        sortOrder: { type: Number, default: 1 },
      },
      googlePay: {
        enabled: { type: Boolean, default: true },
        label: { type: String, default: 'Google Pay' },
        description: { type: String, default: 'Fast & secure UPI' },
        icon: { type: String, default: 'gpay' },
        sortOrder: { type: Number, default: 2 },
      },
      phonePe: {
        enabled: { type: Boolean, default: true },
        label: { type: String, default: 'PhonePe' },
        description: { type: String, default: 'UPI payment' },
        icon: { type: String, default: 'phonepe' },
        sortOrder: { type: Number, default: 3 },
      },
      paytm: {
        enabled: { type: Boolean, default: true },
        label: { type: String, default: 'Paytm' },
        description: { type: String, default: 'Paytm UPI & Wallet' },
        icon: { type: String, default: 'paytm' },
        sortOrder: { type: Number, default: 4 },
      },
      amazonPay: {
        enabled: { type: Boolean, default: false },
        label: { type: String, default: 'Amazon Pay' },
        description: { type: String, default: 'Pay with Amazon' },
        icon: { type: String, default: 'amazon' },
        sortOrder: { type: Number, default: 5 },
      },
      card: {
        enabled: { type: Boolean, default: true },
        label: { type: String, default: 'Credit/Debit Card' },
        description: { type: String, default: 'Visa, Mastercard, RuPay' },
        icon: { type: String, default: 'card' },
        sortOrder: { type: Number, default: 6 },
      },
      netBanking: {
        enabled: { type: Boolean, default: true },
        label: { type: String, default: 'Net Banking' },
        description: { type: String, default: 'All major banks supported' },
        icon: { type: String, default: 'bank' },
        sortOrder: { type: Number, default: 7 },
      },
      wallet: {
        enabled: { type: Boolean, default: false },
        label: { type: String, default: 'App Wallet' },
        description: { type: String, default: 'Pay using wallet balance' },
        icon: { type: String, default: 'wallet' },
        sortOrder: { type: Number, default: 8 },
      },
      cashOnDelivery: {
        enabled: { type: Boolean, default: true },
        label: { type: String, default: 'Cash on Delivery' },
        description: { type: String, default: 'Pay cash when service is delivered' },
        icon: { type: String, default: 'cash' },
        sortOrder: { type: Number, default: 9 },
      },
      newUpi: {
        enabled: { type: Boolean, default: true },
        label: { type: String, default: 'Add New UPI' },
        description: { type: String, default: 'Link another UPI ID' },
        icon: { type: String, default: 'plus' },
        sortOrder: { type: Number, default: 10 },
      },
    },
    defaultDiscount: {
      enabled: { type: Boolean, default: false },
      percentage: { type: Number, default: 15, min: 0, max: 100 },
    },
    currency: { type: String, default: 'INR', enum: ['USD', 'INR', 'EUR', 'GBP'] },
    currencySymbol: { type: String, default: '₹' },
    minOrderValue: { type: Number, default: 0, min: 0 },
    isActive: { type: Boolean, default: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
  }, {
    timestamps: true,
  });

  // Methods
  checkoutSettingsSchema.methods.calculateFees = function(basePrice) {
    let serviceFee = 0;
    let platformFee = 0;
    let tax = 0;

    if (this.serviceFee.type === 'fixed') {
      serviceFee = this.serviceFee.value;
    } else {
      serviceFee = (basePrice * this.serviceFee.value) / 100;
      if (this.serviceFee.maxAmount && serviceFee > this.serviceFee.maxAmount) {
        serviceFee = this.serviceFee.maxAmount;
      }
    }

    if (this.platformFee.type === 'fixed') {
      platformFee = this.platformFee.value;
    } else {
      platformFee = (basePrice * this.platformFee.value) / 100;
      if (this.platformFee.maxAmount && platformFee > this.platformFee.maxAmount) {
        platformFee = this.platformFee.maxAmount;
      }
    }

    const subtotal = basePrice + serviceFee + platformFee;
    if (this.tax.type === 'fixed') {
      tax = this.tax.value;
    } else {
      tax = (subtotal * this.tax.value) / 100;
    }

    const total = subtotal + tax;

    return {
      basePrice: Math.round(basePrice * 100) / 100,
      serviceFee: Math.round(serviceFee * 100) / 100,
      platformFee: Math.round(platformFee * 100) / 100,
      subtotal: Math.round(subtotal * 100) / 100,
      tax: Math.round(tax * 100) / 100,
      total: Math.round(total * 100) / 100,
    };
  };

  // Statics
  checkoutSettingsSchema.statics.getActiveSettings = async function() {
    let settings = await this.findOne({ isActive: true });
    if (!settings) {
      settings = await this.create({ isActive: true });
    }
    return settings;
  };

  return checkoutSettingsSchema;
};

// ============================================================================
// ===== MODEL GETTERS ========================================================
// ============================================================================

// ===== EXISTING MODEL GETTERS =====
const getAdminModel = () => {
  if (!adminConnection) {
    throw new Error('Admin database not connected. Call connectDB() first.');
  }
  if (adminConnection.models.Admin) {
    return adminConnection.models.Admin;
  }
  return adminConnection.model('Admin', createAdminSchema());
};

const getProviderModel = () => {
  if (!providerConnection) {
    throw new Error('Provider database not connected. Call connectDB() first.');
  }
  if (providerConnection.models.Provider) {
    return providerConnection.models.Provider;
  }
  return providerConnection.model('Provider', createProviderSchema());
};

const getVerificationModel = () => {
  if (!providerConnection) {
    throw new Error('Provider database not connected. Call connectDB() first.');
  }
  if (providerConnection.models.Verification) {
    return providerConnection.models.Verification;
  }
  const schema = createVerificationSchema();
  return providerConnection.model('Verification', schema, 'verifications');
};

const getUserModel = () => {
  if (!userConnection) {
    throw new Error('User database not connected. Call connectDB() first.');
  }
  if (userConnection.models.User) {
    return userConnection.models.User;
  }
  return userConnection.model('User', createUserSchema(), 'users');
};

// ===== BOOKING MODEL GETTER ✅ NEW =====
const getBookingModel = () => {
  if (!bookingConnection) {
    throw new Error('Booking database not connected. Call connectDB() first.');
  }
  if (bookingConnection.models.Booking) {
    return bookingConnection.models.Booking;
  }
  return bookingConnection.model('Booking', createBookingSchema(), 'bookings');
};

// ===== SERVER-DRIVEN UI MODEL GETTERS =====
const getCategoryModel = () => {
  if (!adminConnection) {
    throw new Error('Admin database not connected. Call connectDB() first.');
  }
  if (adminConnection.models.Category) {
    return adminConnection.models.Category;
  }
  return adminConnection.model('Category', createCategorySchema(), 'categories');
};

const getServiceModel = () => {
  if (!adminConnection) {
    throw new Error('Admin database not connected. Call connectDB() first.');
  }
  if (adminConnection.models.Service) {
    return adminConnection.models.Service;
  }
  return adminConnection.model('Service', createServiceSchema(), 'services');
};

const getSubserviceModel = () => {
  if (!adminConnection) {
    throw new Error('Admin database not connected. Call connectDB() first.');
  }
  if (adminConnection.models.Subservice) {
    return adminConnection.models.Subservice;
  }
  return adminConnection.model('Subservice', createSubserviceSchema(), 'subservices');
};

const getBannerModel = () => {
  if (!adminConnection) {
    throw new Error('Admin database not connected. Call connectDB() first.');
  }
  if (adminConnection.models.Banner) {
    return adminConnection.models.Banner;
  }
  return adminConnection.model('Banner', createBannerSchema(), 'banners');
};

const getLayoutConfigModel = () => {
  if (!adminConnection) {
    throw new Error('Admin database not connected. Call connectDB() first.');
  }
  if (adminConnection.models.LayoutConfig) {
    return adminConnection.models.LayoutConfig;
  }
  return adminConnection.model('LayoutConfig', createLayoutConfigSchema(), 'layout_configs');
};

const getFeatureFlagModel = () => {
  if (!adminConnection) {
    throw new Error('Admin database not connected. Call connectDB() first.');
  }
  if (adminConnection.models.FeatureFlag) {
    return adminConnection.models.FeatureFlag;
  }
  return adminConnection.model('FeatureFlag', createFeatureFlagSchema(), 'feature_flags');
};

// ===== ASAP SECTION MODEL GETTER =====
const getASAPSectionModel = () => {
  if (!adminConnection) {
    throw new Error('Admin database not connected. Call connectDB() first.');
  }
  
  if (!adminConnection.models.Subservice) {
    adminConnection.model('Subservice', createSubserviceSchema(), 'subservices');
  }
  
  if (!adminConnection.models.Category) {
    adminConnection.model('Category', createCategorySchema(), 'categories');
  }
  
  if (adminConnection.models.ASAPSection) {
    return adminConnection.models.ASAPSection;
  }
  
  const asapSectionSchema = require('../models/ASAPSection');
  return adminConnection.model('ASAPSection', asapSectionSchema, 'asap_sections');
};

// ===== CHECKOUT MODEL GETTERS (NEW) =====
const getCouponModel = () => {
  if (!adminConnection) {
    throw new Error('Admin database not connected. Call connectDB() first.');
  }
  if (adminConnection.models.Coupon) {
    return adminConnection.models.Coupon;
  }
  return adminConnection.model('Coupon', createCouponSchema(), 'coupons');
};

const getCheckoutSettingsModel = () => {
  if (!adminConnection) {
    throw new Error('Admin database not connected. Call connectDB() first.');
  }
  if (adminConnection.models.CheckoutSettings) {
    return adminConnection.models.CheckoutSettings;
  }
  return adminConnection.model('CheckoutSettings', createCheckoutSettingsSchema(), 'checkout_settings');
};

// ===== SEED DEFAULT ADMIN =====
const seedDefaultAdmin = async () => {
  try {
    if (!adminConnection || adminConnection.readyState !== 1) {
      console.warn('⚠️ Admin connection not ready for seeding');
      return null;
    }

    const Admin = getAdminModel();
    
    const adminEmail = (process.env.ADMIN_EMAIL || 'admin@admin.com').toLowerCase().trim();
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
    const adminName = process.env.ADMIN_NAME || 'Super Admin';

    const adminCount = await Admin.countDocuments();
    console.log(`📊 Current admin count: ${adminCount}`);

    const existingAdmin = await Admin.findOne({ email: adminEmail });

    if (existingAdmin) {
      console.log('✓ Default admin already exists:', adminEmail);
      return existingAdmin;
    }

    console.log('\n🔄 Creating default admin...');
    
    const admin = new Admin({
      name: adminName,
      email: adminEmail,
      password: adminPassword,
      role: 'super_admin',
      permissions: [
        'manage_providers',
        'manage_users',
        'manage_bookings',
        'manage_verifications',
        'manage_payments',
        'manage_settings',
        'view_analytics',
        'manage_admins',
        'manage_services',
        'manage_categories',
        'manage_banners',
        'manage_layout',
        'manage_features',
      ],
      isActive: true,
    });

    await admin.save();

    console.log('\n' + '═'.repeat(55));
    console.log('║ ✅ DEFAULT ADMIN CREATED SUCCESSFULLY!              ║');
    console.log('═'.repeat(55));
    console.log('║  📧 Email:    ' + adminEmail.padEnd(39) + '║');
    console.log('║  🔑 Password: ' + adminPassword.padEnd(39) + '║');
    console.log('║  👤 Name:     ' + adminName.padEnd(39) + '║');
    console.log('║  🎭 Role:     super_admin                           ║');
    console.log('═'.repeat(55) + '\n');

    return admin;

  } catch (error) {
    if (error.code === 11000) {
      console.log('⚠️ Admin already exists (duplicate key)');
      return null;
    }
    console.error('⚠️ Admin seed warning:', error.message);
    return null;
  }
};

// ===== MAIN CONNECTION FUNCTION =====
const connectDB = async () => {
  try {
    console.log('\n' + '═'.repeat(60));
    console.log('🚀 Initializing Multi-Database Connections...');
    console.log('═'.repeat(60));
    
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI environment variable is not set');
    }
    
    console.log('\n📋 Environment Check:');
    console.log('   MONGODB_URI: ✓ Set');
    console.log('   JWT_ACCESS_SECRET:', process.env.JWT_ACCESS_SECRET ? '✓ Set' : '✗ Using default');
    console.log('   ADMIN_EMAIL:', process.env.ADMIN_EMAIL || 'admin@admin.com');

    await connectAdminDB();
    await connectProviderDB();
    await connectUserDB();
    await connectBookingDB(); // ✅ NEW
    
    isConnected = true;

    await seedDefaultAdmin();

    // List collections in all databases for debugging
    try {
      console.log('\n📦 Collections in admin_panel:');
      const adminCollections = await adminConnection.db.listCollections().toArray();
      adminCollections.forEach(col => console.log(`   - ${col.name}`));

      console.log('\n📦 Collections in provider_db:');
      const providerCollections = await providerConnection.db.listCollections().toArray();
      providerCollections.forEach(col => console.log(`   - ${col.name}`));

      console.log('\n📦 Collections in user_db:');
      const userCollections = await userConnection.db.listCollections().toArray();
      userCollections.forEach(col => console.log(`   - ${col.name}`));

      // ✅ NEW
      console.log('\n📦 Collections in bookings_db:');
      const bookingCollections = await bookingConnection.db.listCollections().toArray();
      bookingCollections.forEach(col => console.log(`   - ${col.name}`));
    } catch (e) {
      console.log('Could not list collections');
    }

    console.log('\n✅ All Database Connections Established Successfully!\n');

    // Error handlers
    adminConnection.on('error', (err) => {
      console.error('❌ Admin DB Error:', err.message);
      isConnected = false;
    });

    adminConnection.on('disconnected', () => {
      console.warn('⚠️ Admin DB Disconnected');
      isConnected = false;
    });

    providerConnection.on('error', (err) => {
      console.error('❌ Provider DB Error:', err.message);
    });

    providerConnection.on('disconnected', () => {
      console.warn('⚠️ Provider DB Disconnected');
    });

    userConnection.on('error', (err) => {
      console.error('❌ User DB Error:', err.message);
    });

    userConnection.on('disconnected', () => {
      console.warn('⚠️ User DB Disconnected');
    });

    // ✅ NEW
    bookingConnection.on('error', (err) => {
      console.error('❌ Booking DB Error:', err.message);
    });

    bookingConnection.on('disconnected', () => {
      console.warn('⚠️ Booking DB Disconnected');
    });

    return { adminConnection, providerConnection, userConnection, bookingConnection };
    
  } catch (error) {
    console.error('\n' + '═'.repeat(60));
    console.error('✗ Database Connection Failed:', error.message);
    console.error('═'.repeat(60));
    process.exit(1);
  }
};

// ===== GRACEFUL SHUTDOWN =====
const gracefulShutdown = async (signal) => {
  try {
    console.log(`\n${signal} received. Closing database connections...`);
    
    if (adminConnection) {
      await adminConnection.close();
      console.log('✓ Admin DB connection closed');
    }
    
    if (providerConnection) {
      await providerConnection.close();
      console.log('✓ Provider DB connection closed');
    }

    if (userConnection) {
      await userConnection.close();
      console.log('✓ User DB connection closed');
    }

    // ✅ NEW
    if (bookingConnection) {
      await bookingConnection.close();
      console.log('✓ Booking DB connection closed');
    }
    
    isConnected = false;
    console.log('✓ All connections closed gracefully');
    process.exit(0);
  } catch (err) {
    console.error('Error during shutdown:', err);
    process.exit(1);
  }
};

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// ===== EXPORTS =====
module.exports = connectDB;

// Connection getters
module.exports.getAdminConnection = () => adminConnection;
module.exports.getProviderConnection = () => providerConnection;
module.exports.getUserConnection = () => userConnection;
module.exports.getBookingConnection = () => bookingConnection; // ✅ NEW

// Existing model getters
module.exports.getAdminModel = getAdminModel;
module.exports.getProviderModel = getProviderModel;
module.exports.getVerificationModel = getVerificationModel;
module.exports.getUserModel = getUserModel;
module.exports.getBookingModel = getBookingModel; // ✅ NEW

// Server-Driven UI model getters
module.exports.getCategoryModel = getCategoryModel;
module.exports.getServiceModel = getServiceModel;
module.exports.getSubserviceModel = getSubserviceModel;
module.exports.getBannerModel = getBannerModel;
module.exports.getLayoutConfigModel = getLayoutConfigModel;
module.exports.getFeatureFlagModel = getFeatureFlagModel;
module.exports.getASAPSectionModel = getASAPSectionModel;

// ✅ Checkout model getters (NEW)
module.exports.getCouponModel = getCouponModel;
module.exports.getCheckoutSettingsModel = getCheckoutSettingsModel;

// Utility functions
module.exports.isDbConnected = () => isConnected;
module.exports.seedDefaultAdmin = seedDefaultAdmin;