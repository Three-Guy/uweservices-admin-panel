// backend/src/controllers/adminFcmToken.controller.js
const logger = require('../utils/logger');

// Safe model loading
let AdminFcmToken = null;
try {
  AdminFcmToken = require('../models/AdminFcmToken');
} catch (err) {
  logger.error('AdminFcmToken model not available: ' + err.message);
}

/**
 * Register admin FCM token
 * POST /api/v1/admin/fcm/register
 * 
 * Body: { fcmToken || token, adminEmail || email, deviceInfo, userAgent }
 * 
 * NOTE: No auth middleware — called right after login when token is ready
 */
exports.register = async (req, res) => {
  try {
    if (!AdminFcmToken) {
      return res.status(503).json({
        success: false,
        message: 'FCM token storage not available',
      });
    }

    // Accept both field name variants (frontend compatibility)
    const fcmToken = req.body.fcmToken || req.body.token;
    const adminEmail = (
      req.body.adminEmail ||
      req.body.email ||
      req.admin?.email ||
      'unknown@admin.com'
    ).toLowerCase().trim();
    const deviceInfo = req.body.deviceInfo || 'web-browser';
    const userAgent = req.headers['user-agent'] || '';

    if (!fcmToken || typeof fcmToken !== 'string' || fcmToken.length < 20) {
      return res.status(400).json({
        success: false,
        message: 'Valid FCM token is required',
      });
    }

    // Upsert: if token exists, reactivate it; otherwise create new
    const existing = await AdminFcmToken.findOne({ fcmToken });

    if (existing) {
      existing.adminEmail = adminEmail;
      existing.deviceInfo = deviceInfo;
      existing.userAgent = userAgent;
      existing.isActive = true;
      existing.lastUsedAt = new Date();
      existing.failureCount = 0;
      await existing.save();

      logger.info(`📱 FCM token reactivated for admin: ${adminEmail}`);

      return res.json({
        success: true,
        message: 'FCM token updated successfully',
        data: { tokenId: existing._id, isNew: false },
      });
    }

    const newToken = await AdminFcmToken.create({
      adminEmail,
      fcmToken,
      deviceInfo,
      userAgent,
      isActive: true,
    });

    logger.info(`✅ FCM token registered for admin: ${adminEmail}`);

    return res.json({
      success: true,
      message: 'FCM token registered successfully',
      data: { tokenId: newToken._id, isNew: true },
    });
  } catch (err) {
    logger.error('FCM register failed: ' + err.message);
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

/**
 * Unregister admin FCM token
 * POST /api/v1/admin/fcm/unregister
 */
exports.unregister = async (req, res) => {
  try {
    if (!AdminFcmToken) {
      return res.status(503).json({ success: false, message: 'Not available' });
    }

    const fcmToken = req.body.fcmToken || req.body.token;

    if (!fcmToken) {
      return res.status(400).json({ success: false, message: 'Token required' });
    }

    await AdminFcmToken.findOneAndUpdate(
      { fcmToken },
      { isActive: false }
    );

    logger.info('🔕 FCM token unregistered');

    return res.json({ success: true, message: 'Token unregistered' });
  } catch (err) {
    logger.error('FCM unregister failed: ' + err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * List all my active FCM tokens
 * GET /api/v1/admin/fcm/tokens?email=...
 */
exports.listMyTokens = async (req, res) => {
  try {
    if (!AdminFcmToken) {
      return res.json({ success: true, data: [] });
    }

    const email = (req.admin?.email || req.query.email || '').toLowerCase().trim();

    const filter = { isActive: true };
    if (email) filter.adminEmail = email;

    const tokens = await AdminFcmToken.find(filter)
      .select('-fcmToken')
      .sort({ lastUsedAt: -1 })
      .lean();

    return res.json({ success: true, data: tokens, count: tokens.length });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * Admin test endpoint — send test push to self
 * POST /api/v1/admin/fcm/test
 */
exports.testPush = async (req, res) => {
  try {
    if (!AdminFcmToken) {
      return res.status(503).json({ success: false, message: 'FCM not available' });
    }

    const email = (req.body.email || req.admin?.email || '').toLowerCase().trim();

    const tokens = await AdminFcmToken.find({
      adminEmail: email,
      isActive: true,
    }).select('fcmToken').lean();

    if (tokens.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No active FCM tokens found for this admin',
      });
    }

    // Send test notification
    const { sendAdminFcmNotification } = require('../config/firebase');
    const tokenStrings = tokens.map((t) => t.fcmToken);

    const result = await sendAdminFcmNotification(
      tokenStrings,
      '🧪 Test Notification',
      'This is a test push notification from admin panel',
      { type: 'test', timestamp: new Date().toISOString() }
    );

    return res.json({
      success: true,
      message: 'Test notification sent',
      data: result,
    });
  } catch (err) {
    logger.error('Test push failed: ' + err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
};