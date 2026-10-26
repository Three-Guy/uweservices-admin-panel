// src/services/adminAlertService.js
const { getAdminNotificationModel } = require('../models/AdminNotification');
const { getAdminFcmTokenModel } = require('../models/AdminFcmToken');
const { sendAdminAlert } = require('./fcmService');
const logger = require('../utils/logger');

let ioRef = null;

function setIo(io) {
  ioRef = io;
  logger.info('[AdminAlert] Socket.IO instance registered');
}

/**
 * Fetch all active admin FCM tokens from DB
 */
async function getAllActiveAdminTokens() {
  try {
    const AdminFcmToken = getAdminFcmTokenModel();
    const tokens = await AdminFcmToken.find({ isActive: true }).select('fcmToken').lean();
    return tokens.map((t) => t.fcmToken).filter(Boolean);
  } catch (err) {
    logger.warn(`[AdminAlert] Could not fetch admin tokens: ${err.message}`);
    return [];
  }
}

/**
 * Deactivate invalid tokens based on FCM response errors
 */
async function cleanupInvalidTokens(tokens, responses) {
  try {
    const AdminFcmToken = getAdminFcmTokenModel();
    const toDeactivate = [];

    responses.forEach((resp, idx) => {
      if (!resp.success) {
        const code = resp.error?.code || '';
        if (
          code === 'messaging/registration-token-not-registered' ||
          code === 'messaging/invalid-registration-token' ||
          code === 'messaging/invalid-argument'
        ) {
          toDeactivate.push(tokens[idx]);
        }
      }
    });

    if (toDeactivate.length > 0) {
      await AdminFcmToken.updateMany(
        { fcmToken: { $in: toDeactivate } },
        {
          $set: { isActive: false, lastErrorAt: new Date() },
          $inc: { failureCount: 1 },
        }
      );
      logger.info(`[AdminAlert] Deactivated ${toDeactivate.length} invalid tokens`);
    }
  } catch (err) {
    logger.warn(`[AdminAlert] Token cleanup error: ${err.message}`);
  }
}

/**
 * Create admin alert → persist → socket emit → FCM push
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
  skipFcm = false,
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

    // 1. Socket.IO realtime delivery (bell + sound in open admin tabs)
    if (ioRef) {
      try {
        const payload = {
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
          isRead: false,
        };
        ioRef.to('admins').emit('admin:notification', payload);
        notification.socketDelivered = true;
        await notification.save();
        logger.debug(`[AdminAlert] Socket emitted: ${type} → ${title}`);
      } catch (e) {
        logger.warn(`[AdminAlert] Socket emit failed: ${e.message}`);
      }
    }

    // 2. FCM Web Push (for closed tabs / different browsers)
    if (!skipFcm) {
      try {
        const tokens = await getAllActiveAdminTokens();
        if (tokens.length > 0) {
          const fcmRes = await sendAdminAlert({
            tokens,
            title,
            body: message,
            data: {
              type: String(type || ''),
              bookingId: String(bookingId || ''),
              providerId: String(providerId || ''),
              actionUrl: String(actionUrl || '/notifications'),
              severity: String(severity),
              notificationId: String(notification._id),
            },
          });

          if (fcmRes.success) {
            notification.fcmSent = true;
            notification.fcmMessageIds = (fcmRes.responses || [])
              .filter((r) => r.success)
              .map((r) => r.messageId || '');
            await notification.save();
            logger.info(
              `[AdminAlert] FCM sent → ${fcmRes.successCount}/${tokens.length} devices for "${title}"`
            );
          }

          // Cleanup bad tokens
          if (fcmRes.responses) {
            await cleanupInvalidTokens(tokens, fcmRes.responses);
          }
        } else {
          logger.debug(`[AdminAlert] No active admin FCM tokens registered`);
        }
      } catch (e) {
        logger.warn(`[AdminAlert] FCM push failed: ${e.message}`);
      }
    }

    return notification;
  } catch (err) {
    logger.error(`[AdminAlert] createAdminAlert error: ${err.message}`);
    logger.error(err.stack);
    return null;
  }
}

/**
 * Emit arbitrary live event to admin panel (no persistence, no FCM)
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
  getAllActiveAdminTokens,
};