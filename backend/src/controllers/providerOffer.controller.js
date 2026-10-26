// backend/src/models/AdminFcmToken.js
const mongoose = require('mongoose');
const { getAdminConnection } = require('../config/database');

const adminFcmTokenSchema = new mongoose.Schema(
  {
    adminEmail: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    fcmToken: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    deviceInfo: {
      platform: { type: String, default: 'web' },
      browser: { type: String, default: '' },
      userAgent: { type: String, default: '' },
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
    lastErrorAt: { type: Date, default: null },
    lastError: { type: String, default: null },
    failureCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

adminFcmTokenSchema.index({ adminEmail: 1, isActive: 1 });

let AdminFcmTokenModel = null;

function getAdminFcmTokenModel() {
  if (AdminFcmTokenModel) return AdminFcmTokenModel;
  const conn = getAdminConnection();
  if (!conn) throw new Error('Admin DB connection not ready');
  AdminFcmTokenModel =
    conn.models.AdminFcmToken ||
    conn.model('AdminFcmToken', adminFcmTokenSchema, 'adminfcmtokens');
  return AdminFcmTokenModel;
}

module.exports = { getAdminFcmTokenModel, adminFcmTokenSchema };