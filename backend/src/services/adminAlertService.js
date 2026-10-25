// src/services/adminAlertService.js
const { getAdminNotificationModel } = require('../models/AdminNotification');
const { sendAdminAlert } = require('./fcmService');
const logger = require('../utils/logger');

let ioRef = null;

function setIo(io) {
  ioRef = io;
}

/**
 * Emit admin alert via Socket.IO + persist + optional FCM web push
 */
async function createAdminAlert({
  type,
  title,
  message,
  severity = 'info',
  bookingId = null,
  providerId = null,
  userId = null,
  data = {},
  actionUrl = null,
  actionLabel = null,
  adminFcmTokens = [],
}) {
  try {
    const Notification = getAdminNotificationModel();
    const notification = await Notification.create({
      type,
      title,
      message,
      severity,
      bookingId,
      providerId,
      userId,
      data,
      actionUrl,
      actionLabel,
    });

    // Socket.IO real-time delivery to all admins
    if (ioRef) {
      try {
        ioRef.to('admins').emit('admin:notification', {
          _id: notification._id,
          type,
          title,
          message,
          severity,
          bookingId,
          providerId,
          userId,
          data,
          actionUrl,
          actionLabel,
          createdAt: notification.createdAt,
        });
        notification.socketDelivered = true;
        await notification.save();
      } catch (e) {
        logger.warn(`Socket emit failed: ${e.message}`);
      }
    }

    // Optional FCM web push to registered admin devices
    if (adminFcmTokens && adminFcmTokens.length > 0) {
      try {
        const fcmRes = await sendAdminAlert({
          tokens: adminFcmTokens,
          title,
          body: message,
          data: { type, bookingId: bookingId || '', actionUrl: actionUrl || '', ...data },
        });
        if (fcmRes.success) {
          notification.fcmSent = true;
          notification.fcmMessageIds = fcmRes.messageIds || [];
          await notification.save();
        }
      } catch (e) {
        logger.warn(`Admin FCM failed: ${e.message}`);
      }
    }

    return notification;
  } catch (err) {
    logger.error(`createAdminAlert error: ${err.message}`);
    return null;
  }
}

/**
 * Emit arbitrary live event to admin panel (no persistence)
 */
function emitLive(eventName, payload) {
  if (!ioRef) return;
  try {
    ioRef.to('admins').emit(eventName, payload);
  } catch (e) {
    logger.warn(`emitLive(${eventName}) failed: ${e.message}`);
  }
}

module.exports = {
  setIo,
  createAdminAlert,
  emitLive,
};