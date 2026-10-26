// backend/src/models/AdminNotification.js
const mongoose = require('mongoose');

const adminNotificationSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      required: true,
      default: 'admin_alert',
      // ✅ Pre-validate hook ensures string conversion
    },
    title: {
      type: String,
      required: true,
      default: 'Admin Alert',
    },
    message: {
      type: String,
      default: '',
    },
    data: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    priority: {
      type: String,
      enum: ['low', 'normal', 'high', 'critical', 'error', 'warning', 'info'],
      default: 'normal',
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },
    readAt: {
      type: Date,
      default: null,
    },
    adminEmail: {
      type: String,
      default: null,
      index: true,
    },
  },
  {
    timestamps: true,
    collection: 'adminnotifications',
    strict: false,  // ✅ Allow extra fields
  }
);

// ✅ Pre-validate: force type to always be a string
adminNotificationSchema.pre('validate', function (next) {
  if (this.type && typeof this.type !== 'string') {
    if (typeof this.type === 'object' && this.type.type) {
      // If type is an object with a nested type field, extract it
      const nested = this.type;
      this.type = String(nested.type || 'admin_alert');
      if (!this.title && nested.title) this.title = nested.title;
      if (!this.message && nested.message) this.message = nested.message;
      if (!this.data) this.data = nested;
    } else {
      this.type = String(this.type);
    }
  }
  if (!this.type) this.type = 'admin_alert';
  next();
});

adminNotificationSchema.index({ createdAt: -1 });
adminNotificationSchema.index({ type: 1, isRead: 1 });

function getAdminNotificationModel() {
  try {
    const { getAdminConnection } = require('../config/database');
    const adminConn = getAdminConnection();
    if (adminConn && adminConn.readyState === 1) {
      if (adminConn.models.AdminNotification) {
        return adminConn.models.AdminNotification;
      }
      return adminConn.model('AdminNotification', adminNotificationSchema);
    }
  } catch (err) {
    // Fallback
  }

  if (mongoose.models.AdminNotification) {
    return mongoose.models.AdminNotification;
  }
  return mongoose.model('AdminNotification', adminNotificationSchema);
}

const AdminNotification = getAdminNotificationModel();

module.exports = AdminNotification;
module.exports.getAdminNotificationModel = getAdminNotificationModel;
module.exports.schema = adminNotificationSchema;