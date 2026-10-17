// src/models/FeatureFlag.model.js
const mongoose = require('mongoose');

const featureFlagSchema = new mongoose.Schema({
  // Unique identifier
  key: {
    type: String,
    required: [true, 'Feature flag key is required'],
    unique: true,
    trim: true,
    lowercase: true
  },
  
  // Display name
  name: {
    type: String,
    required: [true, 'Feature flag name is required'],
    trim: true,
    maxlength: [100, 'Name cannot exceed 100 characters']
  },
  
  // Description
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters'],
    default: ''
  },
  
  // Flag enabled/disabled
  enabled: {
    type: Boolean,
    default: false
  },
  
  // Flag type
  type: {
    type: String,
    enum: ['boolean', 'percentage', 'user_list', 'date_range', 'json'],
    default: 'boolean'
  },
  
  // Value based on type
  value: {
    percentage: {
      type: Number,
      min: 0,
      max: 100,
      default: 0
    },
    userIds: [{
      type: String,
      trim: true
    }],
    jsonValue: {
      type: mongoose.Schema.Types.Mixed,
      default: null
    }
  },
  
  // Schedule settings
  schedule: {
    isScheduled: {
      type: Boolean,
      default: false
    },
    startDate: {
      type: Date,
      default: null
    },
    endDate: {
      type: Date,
      default: null
    },
    timezone: {
      type: String,
      default: 'UTC'
    }
  },
  
  // Targeting rules
  targeting: {
    platforms: [{
      type: String,
      enum: ['all', 'ios', 'android', 'web'],
      default: 'all'
    }],
    minAppVersion: {
      type: String,
      default: ''
    },
    maxAppVersion: {
      type: String,
      default: ''
    },
    cities: [{
      type: String,
      trim: true
    }],
    userSegments: [{
      type: String,
      enum: ['all', 'new_users', 'returning_users', 'premium_users', 'free_users'],
      default: 'all'
    }]
  },
  
  // Environment
  environment: {
    type: String,
    enum: ['development', 'staging', 'production', 'all'],
    default: 'all'
  },
  
  // Category for organization
  category: {
    type: String,
    enum: ['feature', 'experiment', 'ops', 'release', 'ui', 'backend', 'other'],
    default: 'feature'
  },
  
  // Tags for filtering
  tags: [{
    type: String,
    trim: true,
    lowercase: true
  }],
  
  // Dependencies on other flags
  dependencies: [{
    type: String,
    trim: true
  }],
  
  // Priority (higher = more important)
  priority: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  
  // Change history
  history: [{
    action: {
      type: String,
      enum: ['created', 'enabled', 'disabled', 'updated', 'deleted', 'restored'],
      required: true
    },
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin'
    },
    performedByName: {
      type: String,
      default: 'System'
    },
    performedAt: {
      type: Date,
      default: Date.now
    },
    previousValue: {
      type: mongoose.Schema.Types.Mixed
    },
    newValue: {
      type: mongoose.Schema.Types.Mixed
    },
    notes: {
      type: String,
      default: ''
    }
  }],
  
  // Metadata
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin'
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin'
  },
  
  // Soft delete
  isDeleted: {
    type: Boolean,
    default: false
  },
  deletedAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
featureFlagSchema.index({ key: 1 }, { unique: true });
featureFlagSchema.index({ enabled: 1 });
featureFlagSchema.index({ category: 1 });
featureFlagSchema.index({ environment: 1 });
featureFlagSchema.index({ tags: 1 });
featureFlagSchema.index({ isDeleted: 1 });
featureFlagSchema.index({ createdAt: -1 });

// Virtual for id
featureFlagSchema.virtual('id').get(function() {
  return this._id.toHexString();
});

// Pre-save middleware
featureFlagSchema.pre('save', function(next) {
  // Ensure tags are unique and lowercase
  if (this.tags) {
    this.tags = [...new Set(this.tags.map(t => t.toLowerCase().trim()).filter(Boolean))];
  }
  
  // Ensure platforms are valid
  if (!this.targeting.platforms || this.targeting.platforms.length === 0) {
    this.targeting.platforms = ['all'];
  }
  
  // Ensure userSegments are valid
  if (!this.targeting.userSegments || this.targeting.userSegments.length === 0) {
    this.targeting.userSegments = ['all'];
  }
  
  next();
});

const FeatureFlag = mongoose.model('FeatureFlag', featureFlagSchema);

module.exports = FeatureFlag;