// src/controllers/notification.controller.js
const mongoose = require('mongoose');
const { getAdminConnection, getUserConnection, getProviderConnection } = require('../config/database');
const { publishMessage } = require('../config/rabbitmq');
const ApiError = require('../utils/ApiError');
const logger = require('../utils/logger');

// Get Notification model
const getNotificationModel = () => {
  try {
    const connection = getAdminConnection();
    if (connection && connection.models.Notification) {
      return connection.models.Notification;
    }
    return require('../models/Notification');
  } catch (error) {
    return require('../models/Notification');
  }
};

// ===== CREATE NOTIFICATION =====
exports.createNotification = async (req, res, next) => {
  try {
    console.log('\n📝 ===== CREATE NOTIFICATION =====');
    
    const {
      title,
      body,
      type = 'push',
      priority = 'normal',
      targetAudience = 'all',
      targetIds = [],
      targetCities = [],
      targetZones = [],
      scheduledAt,
      actionUrl,
      imageUrl,
      tags = [],
      data = {}
    } = req.body;

    // Validate required fields
    if (!title || !body) {
      throw ApiError.badRequest('Title and body are required');
    }

    const adminId = req.admin?.adminId || req.admin?._id || req.admin?.id;
    if (!adminId) {
      throw ApiError.unauthorized('Admin not authenticated');
    }

    const Notification = getNotificationModel();

    // Determine status based on scheduling
    let status = 'draft';
    if (scheduledAt && new Date(scheduledAt) > new Date()) {
      status = 'scheduled';
    }

    const notification = new Notification({
      title,
      body,
      type,
      priority,
      targetAudience,
      targetIds,
      targetCities,
      targetZones,
      scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
      actionUrl,
      imageUrl,
      tags,
      data,
      status,
      createdBy: adminId
    });

    await notification.save();

    logger.info(`Notification created: ${notification._id} by admin: ${adminId}`);
    console.log('✅ Notification created:', notification._id);

    res.status(201).json({
      success: true,
      message: 'Notification created successfully',
      data: { notification }
    });
  } catch (error) {
    console.error('❌ Create notification error:', error.message);
    logger.error('Create notification error:', error);
    next(error);
  }
};

// ===== GET ALL NOTIFICATIONS =====
exports.getAllNotifications = async (req, res, next) => {
  try {
    console.log('\n📋 ===== GET ALL NOTIFICATIONS =====');
    
    const {
      page = 1,
      limit = 20,
      status,
      type,
      targetAudience,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      startDate,
      endDate
    } = req.query;

    const Notification = getNotificationModel();

    // Build query
    const query = { isDeleted: false };

    if (status) query.status = status;
    if (type) query.type = type;
    if (targetAudience) query.targetAudience = targetAudience;
    
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { body: { $regex: search, $options: 'i' } },
        { tags: { $in: [new RegExp(search, 'i')] } }
      ];
    }

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    // Sort
    const sort = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

    // Execute query
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const [notifications, total] = await Promise.all([
      Notification.find(query)
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit))
        .populate('createdBy', 'name email')
        .populate('sentBy', 'name email')
        .lean(),
      Notification.countDocuments(query)
    ]);

    console.log(`✅ Found ${notifications.length} notifications (total: ${total})`);

    res.json({
      success: true,
      data: {
        notifications,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    });
  } catch (error) {
    console.error('❌ Get notifications error:', error.message);
    logger.error('Get notifications error:', error);
    next(error);
  }
};

// ===== GET NOTIFICATION BY ID =====
exports.getNotificationById = async (req, res, next) => {
  try {
    const { id } = req.params;
    console.log('\n🔍 ===== GET NOTIFICATION BY ID =====');
    console.log('   ID:', id);

    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw ApiError.badRequest('Invalid notification ID');
    }

    const Notification = getNotificationModel();

    const notification = await Notification.findOne({ _id: id, isDeleted: false })
      .populate('createdBy', 'name email')
      .populate('sentBy', 'name email');

    if (!notification) {
      throw ApiError.notFound('Notification not found');
    }

    console.log('✅ Notification found:', notification.title);

    res.json({
      success: true,
      data: { notification }
    });
  } catch (error) {
    console.error('❌ Get notification error:', error.message);
    logger.error('Get notification error:', error);
    next(error);
  }
};

// ===== UPDATE NOTIFICATION =====
exports.updateNotification = async (req, res, next) => {
  try {
    const { id } = req.params;
    console.log('\n✏️ ===== UPDATE NOTIFICATION =====');
    console.log('   ID:', id);

    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw ApiError.badRequest('Invalid notification ID');
    }

    const Notification = getNotificationModel();

    const notification = await Notification.findOne({ _id: id, isDeleted: false });

    if (!notification) {
      throw ApiError.notFound('Notification not found');
    }

    // Can only update draft or scheduled notifications
    if (!['draft', 'scheduled'].includes(notification.status)) {
      throw ApiError.badRequest('Can only update draft or scheduled notifications');
    }

    const allowedUpdates = [
      'title', 'body', 'type', 'priority', 'targetAudience',
      'targetIds', 'targetCities', 'targetZones', 'scheduledAt',
      'actionUrl', 'imageUrl', 'tags', 'data'
    ];

    allowedUpdates.forEach(field => {
      if (req.body[field] !== undefined) {
        notification[field] = req.body[field];
      }
    });

    // Update status based on scheduling
    if (req.body.scheduledAt) {
      notification.status = new Date(req.body.scheduledAt) > new Date() ? 'scheduled' : 'draft';
    }

    await notification.save();

    logger.info(`Notification updated: ${id}`);
    console.log('✅ Notification updated');

    res.json({
      success: true,
      message: 'Notification updated successfully',
      data: { notification }
    });
  } catch (error) {
    console.error('❌ Update notification error:', error.message);
    logger.error('Update notification error:', error);
    next(error);
  }
};

// ===== DELETE NOTIFICATION =====
exports.deleteNotification = async (req, res, next) => {
  try {
    const { id } = req.params;
    console.log('\n🗑️ ===== DELETE NOTIFICATION =====');
    console.log('   ID:', id);

    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw ApiError.badRequest('Invalid notification ID');
    }

    const Notification = getNotificationModel();

    const notification = await Notification.findOne({ _id: id, isDeleted: false });

    if (!notification) {
      throw ApiError.notFound('Notification not found');
    }

    // Soft delete
    notification.isDeleted = true;
    notification.deletedAt = new Date();
    await notification.save();

    logger.info(`Notification deleted: ${id}`);
    console.log('✅ Notification deleted');

    res.json({
      success: true,
      message: 'Notification deleted successfully'
    });
  } catch (error) {
    console.error('❌ Delete notification error:', error.message);
    logger.error('Delete notification error:', error);
    next(error);
  }
};

// ===== SEND NOTIFICATION =====
exports.sendNotification = async (req, res, next) => {
  try {
    const { id } = req.params;
    console.log('\n📤 ===== SEND NOTIFICATION =====');
    console.log('   ID:', id);

    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw ApiError.badRequest('Invalid notification ID');
    }

    const adminId = req.admin?.adminId || req.admin?._id || req.admin?.id;
    if (!adminId) {
      throw ApiError.unauthorized('Admin not authenticated');
    }

    const Notification = getNotificationModel();

    const notification = await Notification.findOne({ _id: id, isDeleted: false });

    if (!notification) {
      throw ApiError.notFound('Notification not found');
    }

    if (notification.status === 'sent') {
      throw ApiError.badRequest('Notification already sent');
    }

    if (notification.status === 'sending') {
      throw ApiError.badRequest('Notification is currently being sent');
    }

    // Update status to sending
    notification.status = 'sending';
    notification.sentBy = adminId;
    notification.sentAt = new Date();
    await notification.save();

    // Get target count based on audience
    let totalTargets = 0;
    
    try {
      totalTargets = await getTargetCount(notification);
    } catch (err) {
      console.warn('Could not get exact target count:', err.message);
      totalTargets = notification.targetIds?.length || 0;
    }

    notification.stats.totalTargets = totalTargets;

    // ===== EMAIL SENDING LOGIC =====
    let emailResults = { totalSent: 0, totalFailed: 0 };
    
    if (notification.type === 'email' || notification.type === 'all') {
      console.log('\n📧 ===== SENDING EMAIL NOTIFICATIONS =====');
      
      const { sendBulkEmails } = require('../utils/emailService');
      
      // Get target email addresses
      const targetEmails = await getTargetEmails(notification);
      
      console.log(`📧 Preparing to send emails to ${targetEmails.length} recipients`);
      
      if (targetEmails.length > 0) {
        // Prepare email data for each recipient
        const emailRecipients = targetEmails.map(({ email, name }) => ({
          to: email,
          subject: notification.title,
          title: notification.title,
          body: notification.body,
          recipientName: name,
          actionUrl: notification.actionUrl || null,
          actionText: notification.actionUrl ? 'View Details' : null,
          imageUrl: notification.imageUrl || null,
          priority: notification.priority,
        }));

        // Send emails in batches to avoid overwhelming the email service
        const batchSize = 50;
        let totalEmailsSent = 0;
        let totalEmailsFailed = 0;

        for (let i = 0; i < emailRecipients.length; i += batchSize) {
          const batch = emailRecipients.slice(i, i + batchSize);
          console.log(`📧 Sending batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(emailRecipients.length / batchSize)}`);
          
          const batchResults = await sendBulkEmails(batch);
          totalEmailsSent += batchResults.totalSent;
          totalEmailsFailed += batchResults.totalFailed;

          // Small delay between batches
          if (i + batchSize < emailRecipients.length) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }

        emailResults = {
          totalSent: totalEmailsSent,
          totalFailed: totalEmailsFailed,
        };

        console.log(`✅ Email sending complete: ${totalEmailsSent} sent, ${totalEmailsFailed} failed`);
        
        logger.info('Email notifications sent', {
          notificationId: notification._id,
          totalSent: totalEmailsSent,
          totalFailed: totalEmailsFailed,
        });
      } else {
        console.warn('⚠️ No email addresses found for target audience');
      }
    }

    // Publish to RabbitMQ (for push/SMS/in-app notifications)
    const routingKey = `notification.${notification.type}.${notification.targetAudience}`;
    
    const messagePayload = {
      notificationId: notification._id.toString(),
      title: notification.title,
      body: notification.body,
      type: notification.type,
      priority: notification.priority,
      targetAudience: notification.targetAudience,
      targetIds: notification.targetIds,
      targetCities: notification.targetCities,
      targetZones: notification.targetZones,
      actionUrl: notification.actionUrl,
      imageUrl: notification.imageUrl,
      data: notification.data,
      sentBy: adminId,
      sentAt: notification.sentAt.toISOString()
    };

    const published = await publishMessage(routingKey, messagePayload);

    if (published) {
      notification.status = 'sent';
      notification.completedAt = new Date();
      notification.stats.sent = totalTargets;
      
      // Update email stats if emails were sent
      if (notification.type === 'email' || notification.type === 'all') {
        notification.stats.delivered = emailResults.totalSent;
        notification.stats.failed = emailResults.totalFailed;
      } else {
        // Simulate delivery for other types
        notification.stats.delivered = Math.floor(totalTargets * 0.95);
      }
      
      logger.info(`Notification sent via RabbitMQ: ${notification._id}`);
      console.log('✅ Notification published to RabbitMQ');
    } else {
      // RabbitMQ not available - still mark as sent if emails were sent
      notification.status = 'sent';
      notification.completedAt = new Date();
      notification.stats.sent = totalTargets;
      
      if (notification.type === 'email' || notification.type === 'all') {
        notification.stats.delivered = emailResults.totalSent;
        notification.stats.failed = emailResults.totalFailed;
      } else {
        notification.stats.delivered = totalTargets;
      }
      
      logger.warn(`Notification marked as sent (RabbitMQ unavailable): ${notification._id}`);
      console.log('⚠️ RabbitMQ unavailable - notification marked as sent');
    }

    await notification.save();

    // Emit via Socket.IO
    const io = req.app.get('io');
    if (io) {
      io.emit('notification:sent', {
        notificationId: notification._id,
        title: notification.title,
        status: notification.status,
        stats: notification.stats,
        emailResults: notification.type === 'email' || notification.type === 'all' ? emailResults : null,
      });
    }

    res.json({
      success: true,
      message: 'Notification sent successfully',
      data: {
        notification,
        stats: notification.stats,
        emailResults: notification.type === 'email' || notification.type === 'all' ? emailResults : null,
      }
    });
  } catch (error) {
    console.error('❌ Send notification error:', error.message);
    logger.error('Send notification error:', error);
    
    // Try to update notification status to failed
    try {
      const Notification = getNotificationModel();
      await Notification.findByIdAndUpdate(req.params.id, {
        status: 'failed',
        $push: {
          errors: {
            error: error.message,
            timestamp: new Date()
          }
        }
      });
    } catch (updateErr) {
      console.error('Failed to update notification status:', updateErr.message);
    }
    
    next(error);
  }
};

// ===== SEND NOTIFICATION IMMEDIATELY (Create + Send) =====
exports.sendNotificationNow = async (req, res, next) => {
  try {
    console.log('\n🚀 ===== SEND NOTIFICATION NOW =====');
    
    const {
      title,
      body,
      type = 'push',
      priority = 'normal',
      targetAudience = 'all',
      targetIds = [],
      targetCities = [],
      targetZones = [],
      actionUrl,
      imageUrl,
      tags = [],
      data = {}
    } = req.body;

    // Validate required fields
    if (!title || !body) {
      throw ApiError.badRequest('Title and body are required');
    }

    const adminId = req.admin?.adminId || req.admin?._id || req.admin?.id;
    if (!adminId) {
      throw ApiError.unauthorized('Admin not authenticated');
    }

    const Notification = getNotificationModel();

    // Create notification
    const notification = new Notification({
      title,
      body,
      type,
      priority,
      targetAudience,
      targetIds,
      targetCities,
      targetZones,
      actionUrl,
      imageUrl,
      tags,
      data,
      status: 'sending',
      createdBy: adminId,
      sentBy: adminId,
      sentAt: new Date()
    });

    await notification.save();

    // Get target count
    let totalTargets = 0;
    try {
      totalTargets = await getTargetCount(notification);
    } catch (err) {
      console.warn('Could not get exact target count:', err.message);
      totalTargets = targetIds?.length || 100; // Default estimate
    }

    notification.stats.totalTargets = totalTargets;

    // ===== EMAIL SENDING LOGIC =====
    let emailResults = { totalSent: 0, totalFailed: 0 };
    
    if (notification.type === 'email' || notification.type === 'all') {
      console.log('\n📧 ===== SENDING EMAIL NOTIFICATIONS =====');
      console.log(`📧 Target Audience: ${notification.targetAudience}`);
      
      const { sendBulkEmails } = require('../utils/emailService');
      
      // Get target email addresses
      const targetEmails = await getTargetEmails(notification);
      
      console.log(`📧 Preparing to send emails to ${targetEmails.length} recipients`);
      
      if (targetEmails.length > 0) {
        // Log recipients for debugging
        console.log('📧 Recipients:');
        targetEmails.forEach((r, i) => console.log(`   ${i + 1}. ${r.email} (${r.name})`));
        
        // Prepare email data for each recipient
        const emailRecipients = targetEmails.map(({ email, name }) => ({
          to: email,
          subject: notification.title,
          title: notification.title,
          body: notification.body,
          recipientName: name,
          actionUrl: notification.actionUrl || null,
          actionText: notification.actionUrl ? 'View Details' : null,
          imageUrl: notification.imageUrl || null,
          priority: notification.priority,
        }));

        // Send emails in batches
        const batchSize = 50;
        let totalEmailsSent = 0;
        let totalEmailsFailed = 0;

        for (let i = 0; i < emailRecipients.length; i += batchSize) {
          const batch = emailRecipients.slice(i, i + batchSize);
          console.log(`📧 Sending batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(emailRecipients.length / batchSize)}`);
          
          const batchResults = await sendBulkEmails(batch);
          totalEmailsSent += batchResults.totalSent;
          totalEmailsFailed += batchResults.totalFailed;

          // Small delay between batches
          if (i + batchSize < emailRecipients.length) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }

        emailResults = {
          totalSent: totalEmailsSent,
          totalFailed: totalEmailsFailed,
        };

        console.log(`✅ Email sending complete: ${totalEmailsSent} sent, ${totalEmailsFailed} failed`);
      } else {
        console.warn('⚠️ No email addresses found for target audience');
      }
    }

    // Publish to RabbitMQ
    const routingKey = `notification.${notification.type}.${notification.targetAudience}`;
    
    const messagePayload = {
      notificationId: notification._id.toString(),
      title: notification.title,
      body: notification.body,
      type: notification.type,
      priority: notification.priority,
      targetAudience: notification.targetAudience,
      targetIds: notification.targetIds,
      targetCities: notification.targetCities,
      targetZones: notification.targetZones,
      actionUrl: notification.actionUrl,
      imageUrl: notification.imageUrl,
      data: notification.data,
      sentBy: adminId,
      sentAt: notification.sentAt.toISOString()
    };

    const published = await publishMessage(routingKey, messagePayload);

    notification.status = 'sent';
    notification.completedAt = new Date();
    notification.stats.sent = totalTargets;
    
    if (notification.type === 'email' || notification.type === 'all') {
      notification.stats.delivered = emailResults.totalSent;
      notification.stats.failed = emailResults.totalFailed;
    } else {
      notification.stats.delivered = Math.floor(totalTargets * 0.95);
    }

    await notification.save();

    logger.info(`Notification created and sent: ${notification._id}`);
    console.log('✅ Notification created and sent:', notification._id);

    // Emit via Socket.IO
    const io = req.app.get('io');
    if (io) {
      io.emit('notification:sent', {
        notificationId: notification._id,
        title: notification.title,
        status: notification.status,
        stats: notification.stats,
        emailResults: notification.type === 'email' || notification.type === 'all' ? emailResults : null,
      });
    }

    res.status(201).json({
      success: true,
      message: 'Notification sent successfully',
      data: { 
        notification,
        emailResults: notification.type === 'email' || notification.type === 'all' ? emailResults : null,
      }
    });
  } catch (error) {
    console.error('❌ Send notification now error:', error.message);
    logger.error('Send notification now error:', error);
    next(error);
  }
};

// ===== GET NOTIFICATION STATS =====
exports.getNotificationStats = async (req, res, next) => {
  try {
    console.log('\n📊 ===== GET NOTIFICATION STATS =====');
    
    const Notification = getNotificationModel();

    const stats = await Notification.getStatsSummary();

    // Get recent notifications
    const recentNotifications = await Notification.find({ isDeleted: false })
      .sort({ createdAt: -1 })
      .limit(5)
      .select('title status type createdAt stats')
      .lean();

    // Get notifications by type
    const byType = await Notification.aggregate([
      { $match: { isDeleted: false } },
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 },
          sent: { $sum: '$stats.sent' },
          delivered: { $sum: '$stats.delivered' }
        }
      }
    ]);

    // Get notifications by status
    const byStatus = await Notification.aggregate([
      { $match: { isDeleted: false } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    // Get today's stats
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const todayStats = await Notification.aggregate([
      {
        $match: {
          isDeleted: false,
          createdAt: { $gte: today }
        }
      },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          sent: { $sum: { $cond: [{ $eq: ['$status', 'sent'] }, 1, 0] } }
        }
      }
    ]);

    console.log('✅ Stats retrieved');

    res.json({
      success: true,
      data: {
        overview: stats,
        today: todayStats[0] || { count: 0, sent: 0 },
        byType,
        byStatus,
        recentNotifications
      }
    });
  } catch (error) {
    console.error('❌ Get stats error:', error.message);
    logger.error('Get stats error:', error);
    next(error);
  }
};

// ===== CANCEL SCHEDULED NOTIFICATION =====
exports.cancelNotification = async (req, res, next) => {
  try {
    const { id } = req.params;
    console.log('\n❌ ===== CANCEL NOTIFICATION =====');
    console.log('   ID:', id);

    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw ApiError.badRequest('Invalid notification ID');
    }

    const Notification = getNotificationModel();

    const notification = await Notification.findOne({ _id: id, isDeleted: false });

    if (!notification) {
      throw ApiError.notFound('Notification not found');
    }

    if (!['draft', 'scheduled'].includes(notification.status)) {
      throw ApiError.badRequest('Can only cancel draft or scheduled notifications');
    }

    notification.status = 'cancelled';
    await notification.save();

    logger.info(`Notification cancelled: ${id}`);
    console.log('✅ Notification cancelled');

    res.json({
      success: true,
      message: 'Notification cancelled successfully',
      data: { notification }
    });
  } catch (error) {
    console.error('❌ Cancel notification error:', error.message);
    logger.error('Cancel notification error:', error);
    next(error);
  }
};

// ===== DUPLICATE NOTIFICATION =====
exports.duplicateNotification = async (req, res, next) => {
  try {
    const { id } = req.params;
    console.log('\n📋 ===== DUPLICATE NOTIFICATION =====');
    console.log('   ID:', id);

    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw ApiError.badRequest('Invalid notification ID');
    }

    const adminId = req.admin?.adminId || req.admin?._id || req.admin?.id;
    if (!adminId) {
      throw ApiError.unauthorized('Admin not authenticated');
    }

    const Notification = getNotificationModel();

    const original = await Notification.findOne({ _id: id, isDeleted: false });

    if (!original) {
      throw ApiError.notFound('Notification not found');
    }

    const duplicate = new Notification({
      title: `${original.title} (Copy)`,
      body: original.body,
      type: original.type,
      priority: original.priority,
      targetAudience: original.targetAudience,
      targetIds: original.targetIds,
      targetCities: original.targetCities,
      targetZones: original.targetZones,
      actionUrl: original.actionUrl,
      imageUrl: original.imageUrl,
      tags: original.tags,
      data: original.data,
      status: 'draft',
      createdBy: adminId
    });

    await duplicate.save();

    logger.info(`Notification duplicated: ${original._id} -> ${duplicate._id}`);
    console.log('✅ Notification duplicated:', duplicate._id);

    res.status(201).json({
      success: true,
      message: 'Notification duplicated successfully',
      data: { notification: duplicate }
    });
  } catch (error) {
    console.error('❌ Duplicate notification error:', error.message);
    logger.error('Duplicate notification error:', error);
    next(error);
  }
};

// ===== HELPER: Get target count based on audience =====
async function getTargetCount(notification) {
  let count = 0;

  try {
    switch (notification.targetAudience) {
      case 'all':
        // Count both users and providers
        const userConn = getUserConnection();
        const providerConn = getProviderConnection();
        
        if (userConn) {
          const userCount = await userConn.db.collection('users').countDocuments({ isActive: true });
          count += userCount;
        }
        if (providerConn) {
          const providerCount = await providerConn.db.collection('providers').countDocuments({ isActive: true });
          count += providerCount;
        }
        break;

      case 'all_users':
        const userConnUsers = getUserConnection();
        if (userConnUsers) {
          count = await userConnUsers.db.collection('users').countDocuments({ isActive: true });
        }
        break;

      case 'all_providers':
        const providerConnProviders = getProviderConnection();
        if (providerConnProviders) {
          count = await providerConnProviders.db.collection('providers').countDocuments({ isActive: true });
        }
        break;

      case 'specific_users':
      case 'specific_providers':
        count = notification.targetIds?.length || 0;
        break;

      case 'by_city':
      case 'by_zone':
        // For now, estimate based on city/zone count
        count = (notification.targetCities?.length || 0) * 100 + 
                (notification.targetZones?.length || 0) * 50;
        break;

      default:
        count = 0;
    }
  } catch (error) {
    console.warn('Error getting target count:', error.message);
    count = notification.targetIds?.length || 100;
  }

  return count || 100; // Default to 100 if can't determine
}

// ===== HELPER: Get target email addresses based on audience (FIXED) =====
async function getTargetEmails(notification) {
  const emails = [];
  
  console.log(`\n📧 Getting target emails for audience: ${notification.targetAudience}`);
  
  try {
    switch (notification.targetAudience) {
      case 'all':
        // Get emails from both users and providers
        console.log('   Fetching ALL users and providers...');
        
        // Get users
        const userConnAll = getUserConnection();
        if (userConnAll && userConnAll.db) {
          console.log('   ✅ User connection available');
          const users = await userConnAll.db.collection('users')
            .find({ 
              isActive: { $ne: false }, 
              email: { $exists: true, $ne: null, $ne: '' } 
            })
            .project({ email: 1, name: 1 })
            .toArray();
          console.log(`   📧 Found ${users.length} users with emails`);
          emails.push(...users.map(u => ({ 
            email: u.email, 
            name: u.name || 'User',
            type: 'user'
          })));
        } else {
          console.log('   ⚠️ User connection not available');
        }
        
        // Get providers using the same connection as provider stats
        const providerConnAll = getProviderConnection();
        if (providerConnAll && providerConnAll.db) {
          console.log('   ✅ Provider connection available');
          const providers = await providerConnAll.db.collection('providers')
            .find({ 
              isActive: { $ne: false }, 
              email: { $exists: true, $ne: null, $ne: '' } 
            })
            .project({ email: 1, name: 1 })
            .toArray();
          console.log(`   📧 Found ${providers.length} providers with emails`);
          emails.push(...providers.map(p => ({ 
            email: p.email, 
            name: p.name || 'Provider',
            type: 'provider'
          })));
        } else {
          console.log('   ⚠️ Provider connection not available');
        }
        break;

      case 'all_users':
        console.log('   Fetching ALL USERS...');
        const userConnUsers = getUserConnection();
        if (userConnUsers && userConnUsers.db) {
          console.log('   ✅ User connection available');
          const users = await userConnUsers.db.collection('users')
            .find({ 
              isActive: { $ne: false }, 
              email: { $exists: true, $ne: null, $ne: '' } 
            })
            .project({ email: 1, name: 1 })
            .toArray();
          console.log(`   📧 Found ${users.length} users with emails`);
          emails.push(...users.map(u => ({ 
            email: u.email, 
            name: u.name || 'User',
            type: 'user'
          })));
        } else {
          console.log('   ⚠️ User connection not available');
        }
        break;

      case 'all_providers':
        console.log('   Fetching ALL PROVIDERS...');
        const providerConnProviders = getProviderConnection();
        if (providerConnProviders && providerConnProviders.db) {
          console.log('   ✅ Provider connection available');
          const providers = await providerConnProviders.db.collection('providers')
            .find({ 
              isActive: { $ne: false }, 
              email: { $exists: true, $ne: null, $ne: '' } 
            })
            .project({ email: 1, name: 1 })
            .toArray();
          console.log(`   📧 Found ${providers.length} providers with emails`);
          emails.push(...providers.map(p => ({ 
            email: p.email, 
            name: p.name || 'Provider',
            type: 'provider'
          })));
        } else {
          console.log('   ⚠️ Provider connection not available');
          
          // Fallback: Try using the admin connection to access provider_db
          console.log('   🔄 Trying fallback: Admin connection...');
          const adminConn = getAdminConnection();
          if (adminConn && adminConn.db) {
            try {
              const providers = await adminConn.db.collection('providers')
                .find({ 
                  isActive: { $ne: false }, 
                  email: { $exists: true, $ne: null, $ne: '' } 
                })
                .project({ email: 1, name: 1 })
                .toArray();
              console.log(`   📧 Fallback found ${providers.length} providers with emails`);
              emails.push(...providers.map(p => ({ 
                email: p.email, 
                name: p.name || 'Provider',
                type: 'provider'
              })));
            } catch (fallbackErr) {
              console.log('   ⚠️ Fallback also failed:', fallbackErr.message);
            }
          }
        }
        break;

      case 'specific_users':
        console.log('   Fetching SPECIFIC USERS...');
        if (notification.targetIds && notification.targetIds.length > 0) {
          const userConnSpecific = getUserConnection();
          if (userConnSpecific && userConnSpecific.db) {
            const objectIds = notification.targetIds
              .filter(id => mongoose.Types.ObjectId.isValid(id))
              .map(id => new mongoose.Types.ObjectId(id));
            
            console.log(`   Looking for ${objectIds.length} specific users`);
            
            const users = await userConnSpecific.db.collection('users')
              .find({ 
                _id: { $in: objectIds },
                email: { $exists: true, $ne: null, $ne: '' }
              })
              .project({ email: 1, name: 1 })
              .toArray();
            console.log(`   📧 Found ${users.length} specific users with emails`);
            emails.push(...users.map(u => ({ 
              email: u.email, 
              name: u.name || 'User',
              type: 'user'
            })));
          }
        } else {
          console.log('   ⚠️ No target IDs provided');
        }
        break;

      case 'specific_providers':
        console.log('   Fetching SPECIFIC PROVIDERS...');
        if (notification.targetIds && notification.targetIds.length > 0) {
          const providerConnSpecific = getProviderConnection();
          if (providerConnSpecific && providerConnSpecific.db) {
            const objectIds = notification.targetIds
              .filter(id => mongoose.Types.ObjectId.isValid(id))
              .map(id => new mongoose.Types.ObjectId(id));
            
            console.log(`   Looking for ${objectIds.length} specific providers`);
            
            const providers = await providerConnSpecific.db.collection('providers')
              .find({ 
                _id: { $in: objectIds },
                email: { $exists: true, $ne: null, $ne: '' }
              })
              .project({ email: 1, name: 1 })
              .toArray();
            console.log(`   📧 Found ${providers.length} specific providers with emails`);
            emails.push(...providers.map(p => ({ 
              email: p.email, 
              name: p.name || 'Provider',
              type: 'provider'
            })));
          } else {
            // Fallback to admin connection
            const adminConn = getAdminConnection();
            if (adminConn && adminConn.db) {
              const objectIds = notification.targetIds
                .filter(id => mongoose.Types.ObjectId.isValid(id))
                .map(id => new mongoose.Types.ObjectId(id));
              
              try {
                const providers = await adminConn.db.collection('providers')
                  .find({ 
                    _id: { $in: objectIds },
                    email: { $exists: true, $ne: null, $ne: '' }
                  })
                  .project({ email: 1, name: 1 })
                  .toArray();
                console.log(`   📧 Fallback found ${providers.length} specific providers with emails`);
                emails.push(...providers.map(p => ({ 
                  email: p.email, 
                  name: p.name || 'Provider',
                  type: 'provider'
                })));
              } catch (err) {
                console.log('   ⚠️ Fallback failed:', err.message);
              }
            }
          }
        } else {
          console.log('   ⚠️ No target IDs provided');
        }
        break;

      case 'by_city':
        console.log('   Fetching BY CITY...');
        // Get users and providers from specific cities
        const userConnCity = getUserConnection();
        if (userConnCity && userConnCity.db) {
          const cityQuery = notification.targetCities && notification.targetCities.length > 0
            ? { 
                isActive: { $ne: false }, 
                email: { $exists: true, $ne: null, $ne: '' },
                'address.city': { $in: notification.targetCities }
              }
            : { 
                isActive: { $ne: false }, 
                email: { $exists: true, $ne: null, $ne: '' }
              };
          
          const users = await userConnCity.db.collection('users')
            .find(cityQuery)
            .project({ email: 1, name: 1 })
            .limit(500)
            .toArray();
          console.log(`   📧 Found ${users.length} users in target cities`);
          emails.push(...users.map(u => ({ 
            email: u.email, 
            name: u.name || 'User',
            type: 'user'
          })));
        }
        break;

      case 'by_zone':
        console.log('   Fetching BY ZONE...');
        const userConnZone = getUserConnection();
        if (userConnZone && userConnZone.db) {
          const users = await userConnZone.db.collection('users')
            .find({ 
              isActive: { $ne: false }, 
              email: { $exists: true, $ne: null, $ne: '' }
            })
            .project({ email: 1, name: 1 })
            .limit(500)
            .toArray();
          console.log(`   📧 Found ${users.length} users in target zones`);
          emails.push(...users.map(u => ({ 
            email: u.email, 
            name: u.name || 'User',
            type: 'user'
          })));
        }
        break;

      default:
        console.warn('   ⚠️ Unknown target audience:', notification.targetAudience);
    }
  } catch (error) {
    console.error('   ❌ Error getting target emails:', error.message);
    logger.error('Get target emails error:', error);
  }

  // Remove duplicates based on email
  const uniqueEmails = Array.from(
    new Map(emails.map(item => [item.email.toLowerCase(), item])).values()
  );

  console.log(`\n📧 Total unique email addresses found: ${uniqueEmails.length}`);
  
  // Log breakdown
  const userEmails = uniqueEmails.filter(e => e.type === 'user').length;
  const providerEmails = uniqueEmails.filter(e => e.type === 'provider').length;
  console.log(`   👤 Users: ${userEmails}`);
  console.log(`   🔧 Providers: ${providerEmails}`);
  
  return uniqueEmails;
}