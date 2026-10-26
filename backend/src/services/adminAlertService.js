// backend/src/services/adminAlertService.js
const logger = require('../utils/logger');

// ── Safe model loading ──
let AdminNotification = null;
try {
  const notifModule = require('../models/AdminNotification');
  AdminNotification = typeof notifModule.getAdminNotificationModel === 'function'
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

// ── Firebase ──
let sendAdminFcmNotification = null;
let isAdminWebFirebaseReady = () => false;
try {
  const fb = require('../config/firebase');
  sendAdminFcmNotification = fb.sendAdminFcmNotification;
  isAdminWebFirebaseReady = fb.isAdminWebFirebaseReady;
} catch (err) {
  logger.warn('Firebase config not available: ' + err.message);
}

// ── Live Emitter ──
let setLiveIo = null;
try {
  setLiveIo = require('./liveEmitter').setLiveIo;
} catch (err) {
  logger.warn('liveEmitter not available: ' + err.message);
}

// ── Socket.IO ──
let io = null;

function setIo(socketIO) {
  io = socketIO;
  if (setLiveIo) {
    setLiveIo(socketIO);
    logger.info('✅ Socket.IO also attached to liveEmitter');
  }
  logger.info('✅ Socket.IO attached to adminAlertService');
}

const setSocketIO = setIo;

async function getActiveAdminFcmTokens() {
  if (!AdminFcmToken) return [];
  try {
    const tokens = await AdminFcmToken.find({ isActive: true }).select('fcmToken').lean();
    return tokens.map((t) => t.fcmToken).filter(Boolean);
  } catch (err) {
    logger.error('Failed to fetch admin FCM tokens: ' + err.message);
    return [];
  }
}

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
 * Create admin alert — handles multiple call signatures
 * 
 * Supports both:
 *   createAdminAlert('new_booking', { bookingId, ... })  ← preferred
 *   createAdminAlert({ type: 'new_booking', title: '...', message: '...' })  ← legacy
 */
async function createAdminAlert(typeOrObject, dataArg = {}, options = {}) {
  // ── Normalize arguments ──
  let type, data;

  if (typeof typeOrObject === 'object' && typeOrObject !== null) {
    // Legacy call style: createAdminAlert({ type, title, message, ... })
    type = typeOrObject.type || 'admin_alert';
    data = { ...typeOrObject };
    delete data.type;
  } else {
    // Preferred style: createAdminAlert('type', { data })
    type = String(typeOrObject || 'admin_alert');
    data = dataArg || {};
  }

  const alertData = {
    type: String(type),  // ✅ ALWAYS string
    title: data.title || getAlertTitle(type),
    message: data.message || getAlertMessage(type, data),
    data,
    isRead: false,
    priority: options.priority || data.priority || data.severity || 'normal',
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

  // ── 2. Socket.IO ──
  if (!options.skipSocket && io) {
    try {
      io.to('admins').emit('admin_alert', {
        ...alertData,
        _id: savedAlert?._id,
        timestamp: new Date().toISOString(),
      });

      io.to('admins').emit(String(type), {
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

  // ── 3. FCM Push ──
  if (!options.skipFcm && sendAdminFcmNotification && isAdminWebFirebaseReady()) {
    try {
      const tokens = await getActiveAdminFcmTokens();
      if (tokens.length > 0) {
        const result = await sendAdminFcmNotification(
          tokens,
          alertData.title,
          alertData.message,
          {
            type: String(type),
            bookingId: String(data.bookingId || ''),
            alertId: savedAlert?._id?.toString() || '',
            priority: String(alertData.priority),
          }
        );
        if (result.invalidTokens?.length > 0) {
          await cleanupInvalidTokens(result.invalidTokens);
        }
      } else {
        logger.warn('⚠️  No active admin FCM tokens — push skipped');
      }
    } catch (fcmErr) {
      logger.error('FCM push failed: ' + fcmErr.message);
    }
  } else if (!options.skipFcm && !isAdminWebFirebaseReady()) {
    logger.warn('⚠️  FCM disabled — push skipped (Socket.IO only)');
  }

  return savedAlert;
}

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

async function markAsRead(alertId) {
  if (!AdminNotification) return;
  try {
    await AdminNotification.findByIdAndUpdate(alertId, { isRead: true, readAt: new Date() });
  } catch (err) {
    logger.error('markAsRead failed: ' + err.message);
  }
}

async function markAllAsRead() {
  if (!AdminNotification) return;
  try {
    await AdminNotification.updateMany({ isRead: false }, { isRead: true, readAt: new Date() });
  } catch (err) {
    logger.error('markAllAsRead failed: ' + err.message);
  }
}

function getAlertTitle(type) {
  const titles = {
    new_booking: '🆕 New Booking Received',
    booking_assigned: '✅ Booking Assigned',
    no_provider_found: '⚠️ No Provider Found',
    dispatch_update: '🔄 Dispatch Update',
    dispatch_started: '🚀 Dispatch Started',
    dispatch_retry: '🔁 Dispatch Retry',
    dispatch_failed: '🚨 Dispatch Failed',
    provider_accepted: '✅ Provider Accepted',
    provider_rejected: '❌ Provider Rejected',
    booking_cancelled: '🚫 Booking Cancelled',
    booking_completed: '🎉 Booking Completed',
    booking_in_progress: '🔧 Service In Progress',
  };
  return titles[type] || '📢 Admin Alert';
}

function getAlertMessage(type, data) {
  switch (type) {
    case 'new_booking':
      return `${data.serviceName || 'Service'} booking — ₹${data.amount || 0}`;
    case 'booking_assigned':
      return `Assigned to ${data.providerName || 'provider'}`;
    case 'no_provider_found':
      return `No provider found for #${(data.bookingId || '').toString().slice(-6)}`;
    case 'dispatch_failed':
      return data.message || `Dispatch failed`;
    default:
      return data.message || 'New notification';
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