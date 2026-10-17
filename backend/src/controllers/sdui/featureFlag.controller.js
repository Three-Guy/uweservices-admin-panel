// src/controllers/sdui/featureFlag.controller.js
const FeatureFlag = require('../../models/FeatureFlag.model');
const logger = require('../../utils/logger');

// ==================== HELPER FUNCTIONS ====================
function isCurrentlyActive(flag) {
  if (!flag.enabled) return false;
  
  if (flag.schedule?.isScheduled) {
    const now = new Date();
    if (flag.schedule.startDate && now < new Date(flag.schedule.startDate)) {
      return false;
    }
    if (flag.schedule.endDate && now > new Date(flag.schedule.endDate)) {
      return false;
    }
  }
  
  return true;
}

function isSchedulePending(flag) {
  if (!flag.schedule?.isScheduled || !flag.schedule.startDate) return false;
  return new Date() < new Date(flag.schedule.startDate);
}

function isExpired(flag) {
  if (!flag.schedule?.isScheduled || !flag.schedule.endDate) return false;
  return new Date() > new Date(flag.schedule.endDate);
}

// ==================== GET ALL FEATURE FLAGS ====================
exports.getAllFeatureFlags = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      search = '',
      category = '',
      enabled = '',
      environment = '',
      tags = '',
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Build query
    const query = { isDeleted: { $ne: true } };

    // Search filter
    if (search) {
      query.$or = [
        { key: { $regex: search, $options: 'i' } },
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    // Category filter
    if (category) {
      query.category = category;
    }

    // Enabled filter
    if (enabled !== '') {
      query.enabled = enabled === 'true';
    }

    // Environment filter
    if (environment) {
      query.environment = { $in: [environment, 'all'] };
    }

    // Tags filter
    if (tags) {
      const tagArray = tags.split(',').map(t => t.trim().toLowerCase());
      query.tags = { $in: tagArray };
    }

    // Sort
    const sort = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

    // Execute query with pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const [flags, total] = await Promise.all([
      FeatureFlag.find(query)
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      FeatureFlag.countDocuments(query)
    ]);

    // Add computed fields
    const flagsWithStatus = flags.map(flag => ({
      ...flag,
      id: flag._id,
      isCurrentlyActive: isCurrentlyActive(flag),
      isSchedulePending: isSchedulePending(flag),
      isExpired: isExpired(flag)
    }));

    res.json({
      success: true,
      data: flagsWithStatus,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit)),
        hasNext: parseInt(page) < Math.ceil(total / parseInt(limit)),
        hasPrev: parseInt(page) > 1
      }
    });

  } catch (error) {
    logger.error('Error fetching feature flags:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch feature flags',
      error: error.message
    });
  }
};

// ==================== GET FEATURE FLAG BY ID ====================
exports.getFeatureFlagById = async (req, res) => {
  try {
    const { id } = req.params;

    const flag = await FeatureFlag.findOne({ 
      _id: id, 
      isDeleted: { $ne: true }
    }).lean();

    if (!flag) {
      return res.status(404).json({
        success: false,
        message: 'Feature flag not found'
      });
    }

    res.json({
      success: true,
      data: {
        ...flag,
        id: flag._id,
        isCurrentlyActive: isCurrentlyActive(flag),
        isSchedulePending: isSchedulePending(flag),
        isExpired: isExpired(flag)
      }
    });

  } catch (error) {
    logger.error('Error fetching feature flag:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch feature flag',
      error: error.message
    });
  }
};

// ==================== GET FEATURE FLAG BY KEY ====================
exports.getFeatureFlagByKey = async (req, res) => {
  try {
    const { key } = req.params;

    const flag = await FeatureFlag.findOne({ 
      key: key.toLowerCase(), 
      isDeleted: { $ne: true }
    }).lean();

    if (!flag) {
      return res.status(404).json({
        success: false,
        message: 'Feature flag not found'
      });
    }

    res.json({
      success: true,
      data: {
        ...flag,
        id: flag._id,
        isCurrentlyActive: isCurrentlyActive(flag)
      }
    });

  } catch (error) {
    logger.error('Error fetching feature flag by key:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch feature flag',
      error: error.message
    });
  }
};

// ==================== CREATE FEATURE FLAG ====================
exports.createFeatureFlag = async (req, res) => {
  try {
    const {
      key,
      name,
      description,
      enabled = false,
      type = 'boolean',
      value = {},
      schedule = {},
      targeting = {},
      environment = 'all',
      category = 'feature',
      tags = [],
      dependencies = [],
      priority = 0
    } = req.body;

    // Validate required fields
    if (!key || !name) {
      return res.status(400).json({
        success: false,
        message: 'Key and name are required'
      });
    }

    // Check if key already exists
    const existingFlag = await FeatureFlag.findOne({ 
      key: key.toLowerCase(),
      isDeleted: { $ne: true }
    });

    if (existingFlag) {
      return res.status(400).json({
        success: false,
        message: 'Feature flag with this key already exists'
      });
    }

    // Create flag
    const flag = new FeatureFlag({
      key: key.toLowerCase().trim(),
      name: name.trim(),
      description: description || '',
      enabled,
      type,
      value: {
        percentage: value.percentage || 0,
        userIds: value.userIds || [],
        jsonValue: value.jsonValue || null
      },
      schedule: {
        isScheduled: schedule.isScheduled || false,
        startDate: schedule.startDate || null,
        endDate: schedule.endDate || null,
        timezone: schedule.timezone || 'UTC'
      },
      targeting: {
        platforms: targeting.platforms?.length > 0 ? targeting.platforms : ['all'],
        minAppVersion: targeting.minAppVersion || '',
        maxAppVersion: targeting.maxAppVersion || '',
        cities: targeting.cities || [],
        userSegments: targeting.userSegments?.length > 0 ? targeting.userSegments : ['all']
      },
      environment,
      category,
      tags: tags || [],
      dependencies: dependencies || [],
      priority,
      createdBy: req.admin?._id,
      history: [{
        action: 'created',
        performedBy: req.admin?._id,
        performedByName: req.admin?.name || 'System',
        performedAt: new Date(),
        notes: 'Feature flag created'
      }]
    });

    await flag.save();

    // Emit socket event
    const io = req.app.get('io');
    if (io) {
      io.to('admins').emit('featureFlag:created', {
        flag: flag.toJSON()
      });
    }

    logger.info(`Feature flag created: ${flag.key}`);

    res.status(201).json({
      success: true,
      message: 'Feature flag created successfully',
      data: {
        ...flag.toJSON(),
        id: flag._id
      }
    });

  } catch (error) {
    logger.error('Error creating feature flag:', error);
    
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Feature flag with this key already exists'
      });
    }
    
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: Object.values(error.errors).map(e => e.message)
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to create feature flag',
      error: error.message
    });
  }
};

// ==================== UPDATE FEATURE FLAG ====================
exports.updateFeatureFlag = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const flag = await FeatureFlag.findOne({ 
      _id: id, 
      isDeleted: { $ne: true }
    });

    if (!flag) {
      return res.status(404).json({
        success: false,
        message: 'Feature flag not found'
      });
    }

    // Store previous state for history
    const previousState = flag.toJSON();

    // Fields that can be updated
    const allowedUpdates = [
      'name', 'description', 'enabled', 'type', 'value',
      'schedule', 'targeting', 'environment', 'category',
      'tags', 'dependencies', 'priority'
    ];

    // Apply updates
    allowedUpdates.forEach(field => {
      if (updates[field] !== undefined) {
        if (field === 'value') {
          flag.value = {
            ...flag.value.toObject ? flag.value.toObject() : flag.value,
            ...updates.value
          };
        } else if (field === 'schedule') {
          flag.schedule = {
            ...flag.schedule.toObject ? flag.schedule.toObject() : flag.schedule,
            ...updates.schedule
          };
        } else if (field === 'targeting') {
          flag.targeting = {
            ...flag.targeting.toObject ? flag.targeting.toObject() : flag.targeting,
            ...updates.targeting
          };
        } else {
          flag[field] = updates[field];
        }
      }
    });

    // Track enabled/disabled changes specifically
    let historyAction = 'updated';
    if (updates.enabled !== undefined && updates.enabled !== previousState.enabled) {
      historyAction = updates.enabled ? 'enabled' : 'disabled';
    }

    // Add history entry
    flag.history.push({
      action: historyAction,
      performedBy: req.admin?._id,
      performedByName: req.admin?.name || 'System',
      performedAt: new Date(),
      previousValue: previousState,
      newValue: updates,
      notes: updates.notes || ''
    });

    flag.updatedBy = req.admin?._id;

    await flag.save();

    // Emit socket event
    const io = req.app.get('io');
    if (io) {
      io.to('admins').emit('featureFlag:updated', {
        flag: flag.toJSON()
      });
    }

    logger.info(`Feature flag updated: ${flag.key}`);

    res.json({
      success: true,
      message: 'Feature flag updated successfully',
      data: {
        ...flag.toJSON(),
        id: flag._id,
        isCurrentlyActive: isCurrentlyActive(flag.toJSON())
      }
    });

  } catch (error) {
    logger.error('Error updating feature flag:', error);
    
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: Object.values(error.errors).map(e => e.message)
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to update feature flag',
      error: error.message
    });
  }
};

// ==================== TOGGLE FEATURE FLAG ====================
exports.toggleFeatureFlag = async (req, res) => {
  try {
    const { id } = req.params;
    const { enabled, notes = '' } = req.body;

    const flag = await FeatureFlag.findOne({ 
      _id: id, 
      isDeleted: { $ne: true }
    });

    if (!flag) {
      return res.status(404).json({
        success: false,
        message: 'Feature flag not found'
      });
    }

    const previousEnabled = flag.enabled;
    flag.enabled = enabled;

    // Add history entry
    flag.history.push({
      action: enabled ? 'enabled' : 'disabled',
      performedBy: req.admin?._id,
      performedByName: req.admin?.name || 'System',
      performedAt: new Date(),
      previousValue: { enabled: previousEnabled },
      newValue: { enabled },
      notes
    });

    flag.updatedBy = req.admin?._id;

    await flag.save();

    // Emit socket event
    const io = req.app.get('io');
    if (io) {
      io.to('admins').emit('featureFlag:toggled', {
        flagId: flag._id,
        key: flag.key,
        enabled: flag.enabled
      });
    }

    logger.info(`Feature flag ${enabled ? 'enabled' : 'disabled'}: ${flag.key}`);

    res.json({
      success: true,
      message: `Feature flag ${enabled ? 'enabled' : 'disabled'} successfully`,
      data: {
        ...flag.toJSON(),
        id: flag._id,
        isCurrentlyActive: isCurrentlyActive(flag.toJSON())
      }
    });

  } catch (error) {
    logger.error('Error toggling feature flag:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to toggle feature flag',
      error: error.message
    });
  }
};

// ==================== BULK TOGGLE FEATURE FLAGS ====================
exports.bulkToggleFeatureFlags = async (req, res) => {
  try {
    const { ids, enabled, notes = '' } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Flag IDs array is required'
      });
    }

    const result = await FeatureFlag.updateMany(
      { _id: { $in: ids }, isDeleted: { $ne: true } },
      {
        $set: { 
          enabled,
          updatedBy: req.admin?._id
        },
        $push: {
          history: {
            action: enabled ? 'enabled' : 'disabled',
            performedBy: req.admin?._id,
            performedByName: req.admin?.name || 'System',
            performedAt: new Date(),
            notes: notes || `Bulk ${enabled ? 'enable' : 'disable'}`
          }
        }
      }
    );

    // Emit socket event
    const io = req.app.get('io');
    if (io) {
      io.to('admins').emit('featureFlags:bulkToggled', {
        ids,
        enabled
      });
    }

    logger.info(`Bulk ${enabled ? 'enabled' : 'disabled'} ${result.modifiedCount} feature flags`);

    res.json({
      success: true,
      message: `${result.modifiedCount} feature flag(s) ${enabled ? 'enabled' : 'disabled'} successfully`,
      data: {
        modifiedCount: result.modifiedCount
      }
    });

  } catch (error) {
    logger.error('Error bulk toggling feature flags:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to bulk toggle feature flags',
      error: error.message
    });
  }
};

// ==================== DELETE FEATURE FLAG ====================
exports.deleteFeatureFlag = async (req, res) => {
  try {
    const { id } = req.params;
    const { permanent = 'false' } = req.query;

    const flag = await FeatureFlag.findOne({ _id: id });

    if (!flag) {
      return res.status(404).json({
        success: false,
        message: 'Feature flag not found'
      });
    }

    if (permanent === 'true') {
      // Permanent delete
      await FeatureFlag.deleteOne({ _id: id });
      logger.info(`Feature flag permanently deleted: ${flag.key}`);
    } else {
      // Soft delete
      flag.isDeleted = true;
      flag.deletedAt = new Date();
      flag.enabled = false;
      flag.history.push({
        action: 'deleted',
        performedBy: req.admin?._id,
        performedByName: req.admin?.name || 'System',
        performedAt: new Date(),
        notes: 'Feature flag deleted'
      });
      await flag.save();
      logger.info(`Feature flag soft deleted: ${flag.key}`);
    }

    // Emit socket event
    const io = req.app.get('io');
    if (io) {
      io.to('admins').emit('featureFlag:deleted', {
        flagId: id,
        key: flag.key,
        permanent: permanent === 'true'
      });
    }

    res.json({
      success: true,
      message: permanent === 'true' 
        ? 'Feature flag permanently deleted' 
        : 'Feature flag deleted successfully'
    });

  } catch (error) {
    logger.error('Error deleting feature flag:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete feature flag',
      error: error.message
    });
  }
};

// ==================== RESTORE FEATURE FLAG ====================
exports.restoreFeatureFlag = async (req, res) => {
  try {
    const { id } = req.params;

    const flag = await FeatureFlag.findOne({ 
      _id: id, 
      isDeleted: true 
    });

    if (!flag) {
      return res.status(404).json({
        success: false,
        message: 'Deleted feature flag not found'
      });
    }

    flag.isDeleted = false;
    flag.deletedAt = null;
    flag.history.push({
      action: 'restored',
      performedBy: req.admin?._id,
      performedByName: req.admin?.name || 'System',
      performedAt: new Date(),
      notes: 'Feature flag restored'
    });

    await flag.save();

    logger.info(`Feature flag restored: ${flag.key}`);

    res.json({
      success: true,
      message: 'Feature flag restored successfully',
      data: {
        ...flag.toJSON(),
        id: flag._id
      }
    });

  } catch (error) {
    logger.error('Error restoring feature flag:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to restore feature flag',
      error: error.message
    });
  }
};

// ==================== GET FEATURE FLAG STATS ====================
exports.getFeatureFlagStats = async (req, res) => {
  try {
    const baseQuery = { isDeleted: { $ne: true } };

    const [
      totalFlags,
      enabledFlags,
      disabledFlags,
      scheduledFlags,
      categoryStats,
      environmentStats,
      typeStats
    ] = await Promise.all([
      FeatureFlag.countDocuments(baseQuery),
      FeatureFlag.countDocuments({ ...baseQuery, enabled: true }),
      FeatureFlag.countDocuments({ ...baseQuery, enabled: false }),
      FeatureFlag.countDocuments({ 
        ...baseQuery,
        'schedule.isScheduled': true 
      }),
      FeatureFlag.aggregate([
        { $match: baseQuery },
        { $group: { _id: '$category', count: { $sum: 1 } } }
      ]),
      FeatureFlag.aggregate([
        { $match: baseQuery },
        { $group: { _id: '$environment', count: { $sum: 1 } } }
      ]),
      FeatureFlag.aggregate([
        { $match: baseQuery },
        { $group: { _id: '$type', count: { $sum: 1 } } }
      ])
    ]);

    // Format distributions
    const categoryDistribution = {};
    categoryStats.forEach(item => {
      if (item._id) categoryDistribution[item._id] = item.count;
    });

    const environmentDistribution = {};
    environmentStats.forEach(item => {
      if (item._id) environmentDistribution[item._id] = item.count;
    });

    const typeDistribution = {};
    typeStats.forEach(item => {
      if (item._id) typeDistribution[item._id] = item.count;
    });

    res.json({
      success: true,
      data: {
        totalFlags,
        enabledFlags,
        disabledFlags,
        scheduledFlags,
        categoryDistribution,
        environmentDistribution,
        typeDistribution
      }
    });

  } catch (error) {
    logger.error('Error fetching feature flag stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch feature flag stats',
      error: error.message
    });
  }
};

// ==================== GET FEATURE FLAG HISTORY ====================
exports.getFeatureFlagHistory = async (req, res) => {
  try {
    const { id } = req.params;
    const { limit = 50 } = req.query;

    const flag = await FeatureFlag.findOne({ _id: id })
      .select('key name history')
      .lean();

    if (!flag) {
      return res.status(404).json({
        success: false,
        message: 'Feature flag not found'
      });
    }

    // Sort history by date descending and limit
    const history = (flag.history || [])
      .sort((a, b) => new Date(b.performedAt) - new Date(a.performedAt))
      .slice(0, parseInt(limit));

    res.json({
      success: true,
      data: {
        key: flag.key,
        name: flag.name,
        history
      }
    });

  } catch (error) {
    logger.error('Error fetching feature flag history:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch feature flag history',
      error: error.message
    });
  }
};

// ==================== CHECK FEATURE FLAG (for mobile/web apps) ====================
exports.checkFeatureFlag = async (req, res) => {
  try {
    const { key } = req.params;
    const context = req.query; // platform, appVersion, city, userId, userSegment

    const flag = await FeatureFlag.findOne({ 
      key: key.toLowerCase(), 
      isDeleted: { $ne: true }
    });

    if (!flag) {
      return res.json({
        success: true,
        data: {
          key,
          enabled: false,
          reason: 'not_found'
        }
      });
    }

    const isActive = isCurrentlyActive(flag.toJSON());

    res.json({
      success: true,
      data: {
        key: flag.key,
        enabled: isActive,
        type: flag.type,
        value: flag.type === 'json' ? flag.value.jsonValue : null,
        reason: !isActive ? 'inactive' : 'active'
      }
    });

  } catch (error) {
    logger.error('Error checking feature flag:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check feature flag',
      error: error.message
    });
  }
};

// ==================== GET ALL ACTIVE FLAGS (for mobile/web apps) ====================
exports.getActiveFlags = async (req, res) => {
  try {
    const flags = await FeatureFlag.find({ 
      enabled: true, 
      isDeleted: { $ne: true }
    }).lean();

    const activeFlags = flags
      .filter(flag => isCurrentlyActive(flag))
      .map(flag => ({
        key: flag.key,
        type: flag.type,
        value: flag.type === 'json' ? flag.value?.jsonValue : null
      }));

    res.json({
      success: true,
      data: activeFlags
    });

  } catch (error) {
    logger.error('Error fetching active flags:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch active flags',
      error: error.message
    });
  }
};

// ==================== DUPLICATE FEATURE FLAG ====================
exports.duplicateFeatureFlag = async (req, res) => {
  try {
    const { id } = req.params;
    const { newKey, newName } = req.body;

    const originalFlag = await FeatureFlag.findOne({ 
      _id: id, 
      isDeleted: { $ne: true }
    });

    if (!originalFlag) {
      return res.status(404).json({
        success: false,
        message: 'Feature flag not found'
      });
    }

    // Generate new key
    const duplicateKey = (newKey || `${originalFlag.key}_copy`).toLowerCase().trim();

    // Check if new key already exists
    const existingFlag = await FeatureFlag.findOne({ 
      key: duplicateKey,
      isDeleted: { $ne: true }
    });

    if (existingFlag) {
      return res.status(400).json({
        success: false,
        message: 'Feature flag with this key already exists'
      });
    }

    // Create duplicate
    const duplicateData = originalFlag.toJSON();
    delete duplicateData._id;
    delete duplicateData.id;
    delete duplicateData.createdAt;
    delete duplicateData.updatedAt;
    delete duplicateData.history;
    delete duplicateData.__v;

    const duplicate = new FeatureFlag({
      ...duplicateData,
      key: duplicateKey,
      name: newName || `${originalFlag.name} (Copy)`,
      enabled: false, // Duplicates start disabled
      createdBy: req.admin?._id,
      history: [{
        action: 'created',
        performedBy: req.admin?._id,
        performedByName: req.admin?.name || 'System',
        performedAt: new Date(),
        notes: `Duplicated from ${originalFlag.key}`
      }]
    });

    await duplicate.save();

    logger.info(`Feature flag duplicated: ${originalFlag.key} -> ${duplicate.key}`);

    res.status(201).json({
      success: true,
      message: 'Feature flag duplicated successfully',
      data: {
        ...duplicate.toJSON(),
        id: duplicate._id
      }
    });

  } catch (error) {
    logger.error('Error duplicating feature flag:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to duplicate feature flag',
      error: error.message
    });
  }
};