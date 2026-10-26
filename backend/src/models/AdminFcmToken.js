// backend/src/models/AdminFcmToken.js
const mongoose = require('mongoose');
const logger = require('../utils/logger');

const adminFcmTokenSchema = new mongoose.Schema(
  {
    adminEmail: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      index: true,
    },
    fcmToken: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    deviceInfo: {
      type: String,
      default: 'unknown',
    },
    userAgent: {
      type: String,
      default: '',
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    lastUsedAt: {
      type: Date,
      default: Date.now,
    },
    failureCount: {
      type: Number,
      default: 0,
    },
    registeredAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    collection: 'adminfcmtokens',
  }
);

// Compound index for fast lookups
adminFcmTokenSchema.index({ adminEmail: 1, isActive: 1 });
adminFcmTokenSchema.index({ isActive: 1, lastUsedAt: -1 });

// Auto-deactivate on too many failures
adminFcmTokenSchema.pre('save', function (next) {
  if (this.failureCount >= 5 && this.isActive) {
    this.isActive = false;
    logger.warn(`FCM token auto-deactivated due to failures: ${this.adminEmail}`);
  }
  next();
});

/**
 * Get model from admin_panel database connection
 * Supports both default connection and multi-db setup
 */
function getAdminFcmTokenModel() {
  try {
    // Try to use admin_panel specific connection
    const { getAdminConnection } = require('../config/database');
    const adminConn = getAdminConnection();

    if (adminConn && adminConn.readyState === 1) {
      // Check if model already registered on this connection
      if (adminConn.models.AdminFcmToken) {
        return adminConn.models.AdminFcmToken;
      }
      return adminConn.model('AdminFcmToken', adminFcmTokenSchema);
    }
  } catch (err) {
    // Fallback to default connection
  }

  // Fallback: use default mongoose connection
  if (mongoose.models.AdminFcmToken) {
    return mongoose.models.AdminFcmToken;
  }
  return mongoose.model('AdminFcmToken', adminFcmTokenSchema);
}

// Export both model instance AND factory function
const AdminFcmToken = getAdminFcmTokenModel();

module.exports = AdminFcmToken;
module.exports.getAdminFcmTokenModel = getAdminFcmTokenModel;
module.exports.schema = adminFcmTokenSchema;