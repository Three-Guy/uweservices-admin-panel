// src/models/AdminNotification.js
const mongoose = require('mongoose');
const { getAdminConnection } = require('../config/database');

const adminNotificationSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: [
        'new_booking',
        'booking_assigned',
        'booking_rejected',
        'booking_cancelled',
        'booking_completed',
        'no_provider_found',
        'dispatch_failed',
        'provider_timeout',
        'reassignment',
        'payment_received',
        'manual_alert',
        'system',
      ],
      required: true,
      index: true,
    },
    title: { type: String, required: true },
    message: { type: String, required: true },
    severity: {
      type: String,
      enum: ['info', 'success', 'warning', 'error', 'critical'],
      default: 'info',
      index: true,
    },

    // Relations
    bookingId: { type: String, default: null, index: true },
    providerId: { type: String, default: null, index: true },
    userId: { type: String, default: null, index: true },

    // Payload
    data: { type: mongoose.Schema.Types.Mixed, default: {} },

    // State
    isRead: { type: Boolean, default: false, index: true },
    readAt: { type: Date, default: null },
    readBy: { type: String, default: null },

    // Delivery tracking
    socketDelivered: { type: Boolean, default: false },
    fcmSent: { type: Boolean, default: false },
    fcmMessageIds: { type: [String], default: [] },

    // Action link
    actionUrl: { type: String, default: null },
    actionLabel: { type: String, default: null },

    expiresAt: { type: Date, default: null },
  },
  { timestamps: true }
);

adminNotificationSchema.index({ createdAt: -1 });
adminNotificationSchema.index({ isRead: 1, createdAt: -1 });

let AdminNotificationModel = null;

function getAdminNotificationModel() {
  if (AdminNotificationModel) return AdminNotificationModel;
  const conn = getAdminConnection();
  if (!conn) throw new Error('Admin DB connection not ready');
  AdminNotificationModel =
    conn.models.AdminNotification ||
    conn.model('AdminNotification', adminNotificationSchema, 'adminnotifications');
  return AdminNotificationModel;
}

module.exports = { getAdminNotificationModel, adminNotificationSchema };