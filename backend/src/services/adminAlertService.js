// backend/src/services/adminAlertService.js
const logger = require('../utils/logger');

// ── Safe model loading ──
let AdminNotification = null;
try {
  const notifModule = require('../models/AdminNotification');
  AdminNotification = notifModule.getAdminNotificationModel
    ? notifModule.getAdminNotificationModel()
    : notifModule;
} catch (err) {
  logger.warn('AdminNotification model not available: ' + err.message);
}

let AdminFcmToken = null;
try {
  AdminFcmToken = require('../models/AdminFcmToken');
} catch (err) {
  logger.warn('AdminFcmToken model not available: ' + err.message);
}

// ── Firebase (safe import) ──
let sendAdminFcmNotification = null;
let isAdminWebFirebaseReady = () => false;
try {
  const fb = require('../config/firebase');
  sendAdminFcmNotification = fb.sendAdminFcmNotification;
  isAdminWebFirebaseReady = fb.isAdminWebFirebaseReady;
} catch (err) {
  logger.warn('Firebase config not available: ' + err.message);
}

// ── Socket.IO instance (set from server.js) ──
let io = null;

/**
 * Set Socket.IO instance
 */
function setIo(socketIO) {
  io = socketIO;
  logger.info('✅ Socket.IO attached to adminAlertService');
}

// Backward compat alias
const setSocketIO = setIo;

/**
 * Get all active admin FCM tokens
 */
async function getActiveAdminFcmTokens() {
  if (!AdminFcmToken) return [];

  try {
    const tokens = await AdminFcmToken.find({ isActive: true })
      .select('fcmToken')
      .lean();
    return tokens.map((t) => t.fcmToken).filter(Boolean);
  } catch (err) {
    logger.error('Failed to fetch admin FCM tokens: ' + err.message);
    return [];
  }
}

/**
 * Cleanup invalid FCM tokens
 */
async function cleanupInvalidTokens(invalidTokens) {
  if (!AdminFcmToken || !invalidTokens || invalidTokens.length === 0) return;

  try {
    await AdminFcmToken.updateMany(
      { fcmToken: { $in: invalidTokens } },
      { $set: { isActive: false }, $inc: { failureCount: 1 } }
    );
    logger.info(`🧹 Cleaned up ${invalidTokens.length} invalid FCM tokens`);
  } catch (err) {
    logger.error('Failed to cleanup invalid tokens: ' + err.message);
  }
}

/**
 * Create admin alert
 * Flow: Save to DB → Emit Socket.IO → Send FCM Push
 * 
 * @param {string} type - Alert type (new_booking, booking_assigned, no_provider_found, etc.)
 * @param {object} data - Alert data payload
 * @param {object} options - { skipFcm, skipSocket, skipDb, priority }
 */
async function createAdminAlert(type, data = {}, options = {}) {
  const alertData = {
    type,
    title: data.title || getAlertTitle(type),
    message: data.message || getAlertMessage(type, data),
    data,
    isRead: false,
    priority: options.priority || data.priority || 'normal',
    createdAt: new Date(),
  };

  let savedAlert = null;

  // ── 1. Save to Database ──
  if (!options.skipDb && AdminNotification) {
    try {
      savedAlert = await AdminNotification.create(alertData);
      logger.info(`📝 Admin alert saved: ${type} — ${alertData.title}`);
    } catch (dbErr) {
      logger.error('Failed to save admin alert: ' + dbErr.message);
    }
  }

  // ── 2. Socket.IO Real-time Emit ──
  if (!options.skipSocket && io) {
    try {
      // Generic admin_alert event
      io.to('admins').emit('admin_alert', {
        ...alertData,
        _id: savedAlert?._id,
        timestamp: new Date().toISOString(),
      });

      // Specific event name for dispatch monitor
      io.to('admins').emit(type, {
        ...data,
        title: alertData.title,
        message: alertData.message,
        timestamp: new Date().toISOString(),
      });

      logger.info(`🔔 Socket.IO emitted: ${type}`);
    } catch (socketErr) {
      logger.warn('Socket emit failed: ' + socketErr.message);
    }
  }

  // ── 3. FCM Push Notification ──
  if (!options.skipFcm && sendAdminFcmNotification && isAdminWebFirebaseReady()) {
    try {
      const tokens = await getActiveAdminFcmTokens();

      if (tokens.length > 0) {
        const result = await sendAdminFcmNotification(
          tokens,
          alertData.title,
          alertData.message,
          {
            type,
            bookingId: data.bookingId || '',
            alertId: savedAlert?._id?.toString() || '',
            priority: alertData.priority,
          }
        );

        // Auto-cleanup invalid tokens
        if (result.invalidTokens && result.invalidTokens.length > 0) {
          await cleanupInvalidTokens(result.invalidTokens);
        }
      } else {
        logger.warn('⚠️  No active admin FCM tokens — push skipped');
        logger.warn('   Admin must login and allow browser notifications');
      }
    } catch (fcmErr) {
      logger.error('FCM push failed: ' + fcmErr.message);
    }
  } else if (!options.skipFcm && !isAdminWebFirebaseReady()) {
    logger.warn('⚠️  FCM disabled — push skipped (Socket.IO only)');
  }

  return savedAlert;
}

/**
 * Get unread alert count
 */
async function getUnreadCount(adminEmail = null) {
  if (!AdminNotification) return 0;

  try {
    const filter = { isRead: false };
    if (adminEmail) filter.adminEmail = adminEmail;
    return await AdminNotification.countDocuments(filter);
  } catch (err) {
    return 0;
  }
}

/**
 * Mark alert as read
 */
async function markAsRead(alertId) {
  if (!AdminNotification) return;

  try {
    await AdminNotification.findByIdAndUpdate(alertId, {
      isRead: true,
      readAt: new Date(),
    });
  } catch (err) {
    logger.error('markAsRead failed: ' + err.message);
  }
}

/**
 * Mark all alerts as read
 */
async function markAllAsRead() {
  if (!AdminNotification) return;

  try {
    await AdminNotification.updateMany(
      { isRead: false },
      { isRead: true, readAt: new Date() }
    );
  } catch (err) {
    logger.error('markAllAsRead failed: ' + err.message);
  }
}

// ── Alert title helpers ──
function getAlertTitle(type) {
  const titles = {
    new_booking: '🆕 New Booking Received',
    booking_assigned: '✅ Booking Assigned',
    no_provider_found: '⚠️ No Provider Found',
    dispatch_update: '🔄 Dispatch Update',
    dispatch_started: '🚀 Dispatch Started',
    dispatch_retry: '🔁 Dispatch Retry',
    provider_accepted: '✅ Provider Accepted',
    provider_rejected: '❌ Provider Rejected',
    booking_cancelled: '🚫 Booking Cancelled',
    booking_completed: '🎉 Booking Completed',
    booking_in_progress: '🔧 Service In Progress',
  };
  return titles[type] || '📢 Admin Alert';
}

// ── Alert message helpers ──
function getAlertMessage(type, data) {
  switch (type) {
    case 'new_booking':
      return `${data.serviceName || 'Service'} booking from ${data.userName || 'customer'} — ₹${data.amount || 0}`;
    case 'booking_assigned':
      return `Assigned to ${data.providerName || 'provider'} (${data.distance ? data.distance + ' km' : 'nearby'})`;
    case 'no_provider_found':
      return `No provider accepted booking #${(data.bookingId || '').toString().slice(-6)} after ${data.attempts || 1} attempts`;
    case 'dispatch_update':
      return `Status: ${data.status || 'updated'} for booking #${(data.bookingId || '').toString().slice(-6)}`;
    case 'dispatch_started':
      return `Searching for providers for ${data.serviceName || 'booking'}`;
    case 'dispatch_retry':
      return `Retrying dispatch for booking #${(data.bookingId || '').toString().slice(-6)}`;
    case 'provider_accepted':
      return `${data.providerName || 'Provider'} accepted the booking`;
    case 'provider_rejected':
      return `${data.providerName || 'Provider'} rejected the booking`;
    case 'booking_cancelled':
      return `Booking #${(data.bookingId || '').toString().slice(-6)} cancelled by ${data.cancelledBy || 'user'}`;
    case 'booking_completed':
      return `Booking #${(data.bookingId || '').toString().slice(-6)} completed successfully`;
    default:
      return data.message || 'New admin notification';
  }
}

module.exports = {
  createAdminAlert,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  setIo,
  setSocketIO,
  getActiveAdminFcmTokens,
  cleanupInvalidTokens,
};