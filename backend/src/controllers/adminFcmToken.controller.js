// backend/src/controllers/adminFcmToken.controller.js
const { getAdminFcmTokenModel } = require('../models/AdminFcmToken');
const logger = require('../utils/logger');

exports.register = async (req, res) => {
  try {
    // Support both naming conventions (frontend compatibility)
    const fcmToken = req.body.fcmToken || req.body.token;
    const adminEmail = (req.body.adminEmail || req.body.email || req.admin?.email || '').toLowerCase().trim();
    const deviceInfo = req.body.deviceInfo || {};

    if (!fcmToken) {
      return res.status(400).json({ success: false, message: 'fcmToken required' });
    }
    if (!adminEmail) {
      return res.status(400).json({ success: false, message: 'adminEmail required' });
    }

    const AdminFcmToken = getAdminFcmTokenModel();
    const doc = await AdminFcmToken.findOneAndUpdate(
      { fcmToken },
      {
        $set: {
          adminEmail,
          fcmToken,
          deviceInfo: {
            platform: deviceInfo.platform || 'web',
            browser: deviceInfo.browser || '',
            userAgent: req.headers['user-agent'] || '',
          },
          isActive: true,
          lastUsedAt: new Date(),
          failureCount: 0,
          lastError: null,
          lastErrorAt: null,
        },
      },
      { upsert: true, new: true }
    );

    logger.info(`[AdminFCM] Token registered: ${adminEmail}`);
    res.json({ success: true, message: 'FCM token registered', data: { id: doc._id } });
  } catch (err) {
    logger.error(`[AdminFCM] Register error: ${err.message}`);
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.unregister = async (req, res) => {
  try {
    const fcmToken = req.body.fcmToken || req.body.token;
    if (!fcmToken) {
      return res.status(400).json({ success: false, message: 'fcmToken required' });
    }
    const AdminFcmToken = getAdminFcmTokenModel();
    await AdminFcmToken.updateOne({ fcmToken }, { $set: { isActive: false } });
    res.json({ success: true, message: 'FCM token unregistered' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.listMyTokens = async (req, res) => {
  try {
    const adminEmail = (req.admin?.email || req.query.email || '').toLowerCase();
    const AdminFcmToken = getAdminFcmTokenModel();
    const tokens = await AdminFcmToken.find({ adminEmail }).sort({ lastUsedAt: -1 }).lean();
    res.json({ success: true, data: { tokens, count: tokens.length } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};