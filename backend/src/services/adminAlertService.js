// src/services/adminAlertService.js
const AdminNotification = require('../models/AdminNotification');
const logger = require('../utils/logger');

let _io = null;

function setIo(io) {
  _io = io;
  console.log('✅ [AdminAlert] io instance set');
}

function getIo() {
  return _io;
}

// Dedupe: prevent same alert within 10 seconds
const recentAlerts = new Map();

function isDuplicateAlert(type, bookingId) {
  const key = `${type}:${bookingId || 'none'}`;
  const now = Date.now();
  const last = recentAlerts.get(key);
  if (last && (now - last) < 10000) {
    return true;
  }
  recentAlerts.set(key, now);
  // Cleanup old entries
  if (recentAlerts.size > 200) {
    for (const [k, t] of recentAlerts) {
      if (now - t > 30000) recentAlerts.delete(k);
    }
  }
  return false;
}

async function createAdminAlert(optionsOrType, titleOrUndefined, messageOrUndefined, severityOrUndefined) {
  try {
    let type, title, message, severity, bookingId, providerId, data;

    // Support both call signatures
    if (typeof optionsOrType === 'object' && optionsOrType !== null) {
      type = optionsOrType.type || 'info';
      title = optionsOrType.title || 'Notification';
      message = optionsOrType.message || '';
      severity = optionsOrType.severity || 'info';
      bookingId = optionsOrType.bookingId || null;
      providerId = optionsOrType.providerId || null;
      data = optionsOrType.data || optionsOrType;
    } else {
      type = optionsOrType;
      title = titleOrUndefined || 'Notification';
      message = messageOrUndefined || '';
      severity = severityOrUndefined || 'info';
      bookingId = null;
      providerId = null;
      data = {};
    }

    // Skip "no_provider_found" — user explicitly asked to remove these
    if (type === 'no_provider_found' || type === 'no_provider') {
      return null;
    }

    // Dedupe check
    if (isDuplicateAlert(type, bookingId)) {
      console.log(`⏭️ [AdminAlert] Duplicate skipped: ${type} / ${bookingId}`);
      return null;
    }

    console.log(`\n📝 [AdminAlert] Creating alert: ${type} — ${title}`);

    // Save to database
    const notification = new AdminNotification({
      type,
      title,
      message,
      severity,
      bookingId,
      providerId,
      data,
      isRead: false,
    });

    await notification.save();
    console.log(`✅ [AdminAlert] Saved to DB: ${notification._id}`);

    // Build socket payload
    const payload = {
      _id: String(notification._id),
      id: String(notification._id),
      type,
      title,
      message,
      severity,
      bookingId: bookingId ? String(bookingId) : null,
      timestamp: new Date().toISOString(),
      createdAt: notification.createdAt || new Date().toISOString(),
      data,
    };

    // Emit via socket
    const io = getIo();
    if (io) {
      try {
        const adminRoom = io.sockets.adapter.rooms.get('admins');
        const roomCount = adminRoom ? adminRoom.size : 0;
        const totalCount = io.engine.clientsCount || 0;

        console.log(`📡 [AdminAlert] Emitting to 'admins' room (${roomCount} sockets, ${totalCount} total)`);

        io.to('admins').emit('admin:notification', payload);
        io.emit('admin:notification', payload); // Global fallback

        console.log(`✅ [AdminAlert] Socket emit complete`);
      } catch (e) {
        console.error('❌ [AdminAlert] Socket emit error:', e.message);
      }
    } else {
      console.error('❌ [AdminAlert] io is NULL — trying liveEmitter fallback');
      try {
        const liveEmitter = require('./liveEmitter');
        if (typeof liveEmitter.emitLive === 'function') {
          liveEmitter.emitLive('admin:notification', payload, 'admins');
        }
      } catch (e) {
        console.error('❌ [AdminAlert] liveEmitter fallback also failed:', e.message);
      }
    }

    // Send FCM push
    try {
      const AdminFcmToken = require('../models/AdminFcmToken');
      const activeTokens = await AdminFcmToken.find({ isActive: true }).lean();
      console.log(`📱 [AdminAlert] Found ${activeTokens.length} active FCM tokens`);

      if (activeTokens.length > 0) {
        const { sendAdminFcmNotification } = require('../config/firebase');
        if (typeof sendAdminFcmNotification === 'function') {
          for (const t of activeTokens) {
            try {
              const token = t.fcmToken || t.token;
              if (!token) continue;
              await sendAdminFcmNotification(token, {
                title,
                body: message,
                data: { type, bookingId: bookingId || '' },
              });
              console.log(`✅ [AdminAlert] FCM sent to ${token.substring(0, 20)}...`);
            } catch (fcmErr) {
              console.error(`❌ [AdminAlert] FCM error:`, fcmErr.message);
            }
          }
        }
      }
    } catch (e) {
      console.error('❌ [AdminAlert] FCM error:', e.message);
    }

    return notification;
  } catch (err) {
    console.error('❌ [AdminAlert] createAdminAlert error:', err.message);
    console.error(err.stack);
    return null;
  }
}

async function getUnreadCount(adminId) {
  try {
    return await AdminNotification.countDocuments({ isRead: false });
  } catch (e) {
    return 0;
  }
}

async function markAsRead(notificationId) {
  try {
    return await AdminNotification.findByIdAndUpdate(
      notificationId,
      { isRead: true, readAt: new Date() },
      { new: true }
    );
  } catch (e) {
    return null;
  }
}

module.exports = {
  setIo,
  getIo,
  createAdminAlert,
  getUnreadCount,
  markAsRead,
};