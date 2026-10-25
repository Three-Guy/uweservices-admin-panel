// src/controllers/adminNotification.controller.js
const { getAdminNotificationModel } = require('../models/AdminNotification');
const logger = require('../utils/logger');

exports.list = async (req, res) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const skip = (page - 1) * limit;
    const { isRead, type, severity } = req.query;
    const filter = {};
    if (isRead === 'true') filter.isRead = true;
    if (isRead === 'false') filter.isRead = false;
    if (type) filter.type = type;
    if (severity) filter.severity = severity;

    const Notification = getAdminNotificationModel();
    const [notifications, total, unread] = await Promise.all([
      Notification.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Notification.countDocuments(filter),
      Notification.countDocuments({ isRead: false }),
    ]);
    res.json({
      success: true,
      data: {
        notifications,
        unreadCount: unread,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasNext: skip + notifications.length < total,
          hasPrev: page > 1,
        },
      },
    });
  } catch (err) {
    logger.error(`notifications list: ${err.message}`);
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.markRead = async (req, res) => {
  try {
    const { id } = req.params;
    const Notification = getAdminNotificationModel();
    const n = await Notification.findByIdAndUpdate(
      id,
      { $set: { isRead: true, readAt: new Date(), readBy: req.admin?.email || 'admin' } },
      { new: true }
    );
    res.json({ success: true, data: { notification: n } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.markAllRead = async (req, res) => {
  try {
    const Notification = getAdminNotificationModel();
    const result = await Notification.updateMany(
      { isRead: false },
      { $set: { isRead: true, readAt: new Date(), readBy: req.admin?.email || 'admin' } }
    );
    res.json({ success: true, data: { modified: result.modifiedCount } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.delete = async (req, res) => {
  try {
    const { id } = req.params;
    const Notification = getAdminNotificationModel();
    await Notification.findByIdAndDelete(id);
    res.json({ success: true, message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getUnreadCount = async (req, res) => {
  try {
    const Notification = getAdminNotificationModel();
    const count = await Notification.countDocuments({ isRead: false });
    res.json({ success: true, data: { count } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};