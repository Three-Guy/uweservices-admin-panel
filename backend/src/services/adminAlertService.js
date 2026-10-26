// backend/src/services/adminAlertService.js
const liveEmitter = require('./liveEmitter');
const logger = require('../utils/logger');

let AdminNotification = null;
let AdminFcmToken = null;

function getModels() {
  if (!AdminNotification) {
    try {
      AdminNotification = require('../models/AdminNotification');
      if (AdminNotification.getAdminNotificationModel) {
        AdminNotification = AdminNotification.getAdminNotificationModel();
      }
    } catch (e) {
      logger.error('Failed to load AdminNotification model: ' + e.message);
    }
  }
  if (!AdminFcmToken) {
    try {
      AdminFcmToken = require('../models/AdminFcmToken');
      AdminFcmToken = AdminFcmToken?.default || AdminFcmToken?.AdminFcmToken || AdminFcmToken;
    } catch (e) {
      logger.error('Failed to load AdminFcmToken model: ' + e.message);
    }
  }
  return { AdminNotification, AdminFcmToken };
}

let ioRef = null;
function setIo(io) {
  ioRef = io;
  liveEmitter.setLiveIo(io);
  logger.info('✅ Socket.IO attached to adminAlertService');
}

/* ─── BACKEND DEDUPE CACHE — blocks same alert within 10s ─── */
const recentAlerts = new Map();
function isDuplicateAlert(key) {
  const now = Date.now();
  const last = recentAlerts.get(key);

  // Clean old entries
  if (recentAlerts.size > 200) {
    for (const [k, t] of recentAlerts.entries()) {
      if (now - t > 60_000) recentAlerts.delete(k);
    }
  }

  if (last && now - last < 10_000) return true;
  recentAlerts.set(key, now);
  return false;
}

/**
 * createAdminAlert — accepts BOTH signatures:
 *   createAdminAlert('type_string', { ... })
 *   createAdminAlert({ type, title, message, ... })
 */
async function createAdminAlert(typeOrObject, dataArg = {}, options = {}) {
  try {
    let type, data;
    if (typeof typeOrObject === 'object' && typeOrObject !== null) {
      type = typeOrObject.type || 'admin_alert';
      data = { ...typeOrObject };
      delete data.type;
    } else {
      type = String(typeOrObject || 'admin_alert');
      data = dataArg || {};
    }
    type = String(type);

    const title = data.title || 'Admin Alert';
    const message = data.message || '';
    const severity = data.severity || 'info';
    const bookingId = data.bookingId || null;
    const providerId = data.providerId || null;
    const actionUrl = data.actionUrl || null;
    const extraData = data.data || {};

    // 🛡️ DEDUPE at backend level
    const dedupeKey = `${type}::${bookingId || title}::${message}`;
    if (isDuplicateAlert(dedupeKey)) {
      logger.info(`🚫 Duplicate admin alert blocked: ${type} / ${bookingId || title}`);
      return { success: true, type, deduped: true };
    }

    const { AdminNotification, AdminFcmToken } = getModels();

    // Save to DB
    let savedDoc = null;
    if (AdminNotification) {
      try {
        savedDoc = await AdminNotification.create({
          type,
          title,
          message,
          severity,
          bookingId,
          providerId,
          actionUrl,
          data: extraData,
          read: false,
          createdAt: new Date(),
        });
        logger.info(`📝 Admin alert saved: ${type} — ${title}`);
      } catch (e) {
        logger.error(`Failed to save admin alert: ${e.message}`);
      }
    }

    // ✅ EMIT ONLY ONCE — single canonical event
    try {
      const payload = {
        _id: savedDoc?._id,
        type,
        title,
        message,
        severity,
        bookingId,
        providerId,
        actionUrl,
        data: extraData,
        createdAt: savedDoc?.createdAt || new Date(),
      };
      liveEmitter.emitLive('admin:notification', payload);
      logger.info(`🔔 Socket.IO emitted: admin:notification (${type})`);
    } catch (e) {
      logger.error(`Socket emit failed: ${e.message}`);
    }

    // FCM push
    try {
      const { isAdminWebFirebaseReady, sendAdminFcmNotification } = require('../config/firebase');
      if (!isAdminWebFirebaseReady()) {
        logger.warn('⚠️  FCM disabled — push skipped (Socket.IO only)');
      } else if (AdminFcmToken) {
        const tokens = await AdminFcmToken.find({ isActive: true }).lean();
        logger.info(`[FCM] Found ${tokens.length} active admin token(s)`);

        if (tokens.length > 0) {
          await Promise.all(
            tokens.map(async (t) => {
              if (!t.fcmToken) {
                logger.warn(`[FCM] Token doc ${t._id} has no fcmToken field — skipping`);
                return;
              }

              const res = await sendAdminFcmNotification(
                t.fcmToken,
                title,
                message,
                {
                  type,
                  bookingId: bookingId || '',
                  providerId: providerId || '',
                  actionUrl: actionUrl || '',
                }
              );

              if (!res.success) {
                await AdminFcmToken.findByIdAndUpdate(t._id, {
                  $inc: { failureCount: 1 },
                  $set: { lastError: res.error, lastErrorAt: new Date() },
                }).catch(() => {});

                const updated = await AdminFcmToken.findById(t._id).lean();
                if (updated && updated.failureCount >= 5) {
                  await AdminFcmToken.findByIdAndUpdate(t._id, {
                    $set: { isActive: false },
                  }).catch(() => {});
                  logger.warn(`[FCM] Deactivated token after 5 failures: ${t.fcmToken.substring(0, 20)}...`);
                }
              } else {
                await AdminFcmToken.findByIdAndUpdate(t._id, {
                  $set: {
                    failureCount: 0,
                    lastSuccessAt: new Date(),
                    lastError: null,
                    lastErrorAt: null,
                  },
                }).catch(() => {});
              }
            })
          );
          logger.info(`📬 FCM push attempted for ${tokens.length} admin device(s)`);
        }
      }
    } catch (e) {
      logger.error(`FCM push failed: ${e.message}`);
      logger.error(e.stack);
    }

    return { success: true, type };
  } catch (e) {
    logger.error(`createAdminAlert fatal error: ${e.message}`);
    return { success: false, error: e.message };
  }
}

// Backward compat
function emitLive(event, data = {}, room = 'admins') {
  return liveEmitter.emitLive(event, data, room);
}

module.exports = {
  createAdminAlert,
  setIo,
  emitLive,
  getIo: () => ioRef,
};