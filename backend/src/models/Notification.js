// src/models/Notification.js
const mongoose = require('mongoose');
const { getAdminConnection } = require('../config/database');

const notificationSchema = new mongoose.Schema({
  // Basic Info
  title: {
    type: String,
    required: [true, 'Notification title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters']
  },
  body: {
    type: String,
    required: [true, 'Notification body is required'],
    trim: true,
    maxlength: [1000, 'Body cannot exceed 1000 characters']
  },
  
  // Notification Type
  type: {
    type: String,
    enum: ['push', 'sms', 'email', 'in_app', 'all'],
    default: 'push',
    required: true
  },
  
  // Priority
  priority: {
    type: String,
    enum: ['low', 'normal', 'high', 'urgent'],
    default: 'normal'
  },
  
  // Target Audience
  targetAudience: {
    type: String,
    enum: ['all', 'all_users', 'all_providers', 'specific_users', 'specific_providers', 'by_city', 'by_zone'],
    default: 'all',
    required: true
  },
  
  // Specific Targets (if targetAudience is specific_*)
  targetIds: [{
    type: String
  }],
  
  // City/Zone targeting
  targetCities: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'City'
  }],
  targetZones: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Zone'
  }],
  
  // Status
  status: {
    type: String,
    enum: ['draft', 'scheduled', 'sending', 'sent', 'partially_sent', 'failed', 'cancelled'],
    default: 'draft'
  },
  
  // Scheduling
  scheduledAt: {
    type: Date,
    default: null
  },
  sentAt: {
    type: Date,
    default: null
  },
  completedAt: {
    type: Date,
    default: null
  },
  
  // Admin who created/sent
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
    required: true
  },
  sentBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin'
  },
  
  // Statistics
  stats: {
    totalTargets: { type: Number, default: 0 },
    sent: { type: Number, default: 0 },
    delivered: { type: Number, default: 0 },
    read: { type: Number, default: 0 },
    clicked: { type: Number, default: 0 },
    failed: { type: Number, default: 0 }
  },
  
  // Additional Data
  data: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  
  // Action URL (for clickable notifications)
  actionUrl: {
    type: String,
    trim: true
  },
  
  // Image URL (for rich notifications)
  imageUrl: {
    type: String,
    trim: true
  },
  
  // Tags for filtering
  tags: [{
    type: String,
    trim: true
  }],
  
  // Error tracking
  errors: [{
    userId: String,
    error: String,
    timestamp: { type: Date, default: Date.now }
  }],
  
  // RabbitMQ tracking
  rabbitMQMessageId: {
    type: String
  },
  
  // Soft delete
  isDeleted: {
    type: Boolean,
    default: false
  },
  deletedAt: {
    type: Date
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
notificationSchema.index({ status: 1, createdAt: -1 });
notificationSchema.index({ targetAudience: 1 });
notificationSchema.index({ type: 1 });
notificationSchema.index({ scheduledAt: 1 }, { sparse: true });
notificationSchema.index({ createdBy: 1 });
notificationSchema.index({ isDeleted: 1 });
notificationSchema.index({ tags: 1 });

// Virtual for delivery rate
notificationSchema.virtual('deliveryRate').get(function() {
  if (this.stats.sent === 0) return 0;
  return Math.round((this.stats.delivered / this.stats.sent) * 100);
});

// Virtual for read rate
notificationSchema.virtual('readRate').get(function() {
  if (this.stats.delivered === 0) return 0;
  return Math.round((this.stats.read / this.stats.delivered) * 100);
});

// Pre-save hook
notificationSchema.pre('save', function(next) {
  // Auto-set sentAt when status changes to 'sending' or 'sent'
  if (this.isModified('status')) {
    if (this.status === 'sending' && !this.sentAt) {
      this.sentAt = new Date();
    }
    if (this.status === 'sent' && !this.completedAt) {
      this.completedAt = new Date();
    }
  }
  next();
});

// Instance method to mark as sent
notificationSchema.methods.markAsSent = async function(stats = {}) {
  this.status = 'sent';
  this.completedAt = new Date();
  if (stats) {
    this.stats = { ...this.stats, ...stats };
  }
  return this.save();
};

// Instance method to mark as failed
notificationSchema.methods.markAsFailed = async function(errorMessage) {
  this.status = 'failed';
  this.errors.push({
    error: errorMessage,
    timestamp: new Date()
  });
  return this.save();
};

// Static method to get stats summary
notificationSchema.statics.getStatsSummary = async function() {
  const stats = await this.aggregate([
    { $match: { isDeleted: false } },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        sent: { $sum: { $cond: [{ $eq: ['$status', 'sent'] }, 1, 0] } },
        draft: { $sum: { $cond: [{ $eq: ['$status', 'draft'] }, 1, 0] } },
        scheduled: { $sum: { $cond: [{ $eq: ['$status', 'scheduled'] }, 1, 0] } },
        failed: { $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] } },
        totalSent: { $sum: '$stats.sent' },
        totalDelivered: { $sum: '$stats.delivered' },
        totalRead: { $sum: '$stats.read' },
        totalClicked: { $sum: '$stats.clicked' }
      }
    }
  ]);

  return stats[0] || {
    total: 0,
    sent: 0,
    draft: 0,
    scheduled: 0,
    failed: 0,
    totalSent: 0,
    totalDelivered: 0,
    totalRead: 0,
    totalClicked: 0
  };
};

// Static method to get notifications by type
notificationSchema.statics.getByType = async function(type, options = {}) {
  const { page = 1, limit = 10 } = options;
  
  return this.find({ type, isDeleted: false })
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .populate('createdBy', 'name email')
    .populate('sentBy', 'name email');
};

// Create model with admin connection
let Notification;
try {
  const connection = getAdminConnection();
  Notification = connection ? connection.model('Notification', notificationSchema) : mongoose.model('Notification', notificationSchema);
} catch (error) {
  Notification = mongoose.model('Notification', notificationSchema);
}

module.exports = Notification;