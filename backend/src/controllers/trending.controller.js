// backend/src/controllers/trending.controller.js
const mongoose = require('mongoose');
const trendingServiceSchema = require('../models/TrendingService');

// ==================== GET MODEL ====================
const getTrendingServiceModel = () => {
  const { getAdminConnection } = require('../config/database');
  const adminConnection = getAdminConnection();

  if (!adminConnection) {
    throw new Error('Admin database not connected');
  }

  if (adminConnection.models.TrendingService) {
    return adminConnection.models.TrendingService;
  }

  return adminConnection.model('TrendingService', trendingServiceSchema, 'trending_services');
};

// ==================== GET ALL TRENDING SERVICES ====================
exports.getTrendingServices = async (req, res) => {
  try {
    const TrendingService = getTrendingServiceModel();

    const {
      page = 1,
      limit = 20,
      search,
      isActive,
      categoryId,
      sortBy = 'sortOrder',
      sortOrder = 'asc',
    } = req.query;

    // Build query
    const query = {};

    if (isActive !== undefined) {
      query.isActive = isActive === 'true';
    }

    if (categoryId) {
      query.categoryId = categoryId;
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { categoryName: { $regex: search, $options: 'i' } },
        { serviceId: { $regex: search, $options: 'i' } },
      ];
    }

    // Build sort
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Execute query
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [services, total] = await Promise.all([
      TrendingService.find(query)
        .sort(sort)
        .limit(parseInt(limit))
        .skip(skip)
        .lean(),
      TrendingService.countDocuments(query),
    ]);

    console.log(`✅ Retrieved ${services.length} trending services`);

    res.json({
      success: true,
      data: services,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit)),
        hasNext: skip + services.length < total,
        hasPrev: parseInt(page) > 1,
      },
    });
  } catch (error) {
    console.error('❌ Error fetching trending services:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch trending services',
      error: error.message,
    });
  }
};

// ==================== GET BY ID ====================
exports.getTrendingServiceById = async (req, res) => {
  try {
    const TrendingService = getTrendingServiceModel();
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid trending service ID',
      });
    }

    const service = await TrendingService.findById(id).lean();

    if (!service) {
      return res.status(404).json({
        success: false,
        message: 'Trending service not found',
      });
    }

    res.json({
      success: true,
      data: service,
    });
  } catch (error) {
    console.error('❌ Error fetching trending service:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch trending service',
      error: error.message,
    });
  }
};

// ==================== CREATE ====================
exports.createTrendingService = async (req, res) => {
  try {
    console.log('\n📥 Create Trending Service Request');
    console.log('Body:', JSON.stringify(req.body, null, 2));

    const TrendingService = getTrendingServiceModel();

    const {
      serviceId,
      name,
      categoryId,
      categoryName,
      iconName,
      imageUrl,
      badge,
      bookingsToday,
      progress,
      sortOrder,
      isActive,
      autoSync,
      serviceSlug,
      service,
    } = req.body;

    // ==================== VALIDATION ====================
    const errors = [];

    if (!serviceId?.trim()) errors.push('Service ID is required');
    if (!name?.trim()) errors.push('Service name is required');
    if (!categoryId?.trim()) errors.push('Category ID is required');
    if (!categoryName?.trim()) errors.push('Category name is required');

    if (errors.length > 0) {
      console.log('❌ Validation errors:', errors);
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors,
      });
    }

    // Check for duplicate serviceId
    const existing = await TrendingService.findOne({
      serviceId: serviceId.trim(),
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        message: `A trending service with ID "${serviceId}" already exists`,
      });
    }

    // ==================== BUILD DATA ====================
    const trendingData = {
      serviceId: serviceId.trim(),
      name: name.trim(),
      categoryId: categoryId.trim(),
      categoryName: categoryName.trim(),
      iconName: iconName?.trim() || '📦',
      imageUrl: imageUrl || null,
      bookingsToday: Math.max(0, Number(bookingsToday) || 0),
      progress: Math.min(100, Math.max(0, Number(progress) || 0)),
      sortOrder: sortOrder !== undefined ? Number(sortOrder) : 0,
      isActive: isActive !== false,
      autoSync: Boolean(autoSync),
      createdBy: req.user?._id,
    };

    // Add badge if provided
    if (badge?.type) {
      trendingData.badge = {
        text: badge.text?.trim() || '',
        type: badge.type,
      };
    }

    // Add optional fields
    if (serviceSlug) trendingData.serviceSlug = serviceSlug.trim();
    if (service) trendingData.service = service;

    console.log('✅ Creating trending service:', trendingData);

    const trendingService = await TrendingService.create(trendingData);

    console.log('✅ Trending service created:', trendingService._id);

    res.status(201).json({
      success: true,
      message: 'Trending service created successfully',
      data: trendingService,
    });
  } catch (error) {
    console.error('❌ Error creating trending service:', error);

    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map((err) => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors,
      });
    }

    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'A trending service with this ID already exists',
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to create trending service',
      error: error.message,
    });
  }
};

// ==================== UPDATE ====================
exports.updateTrendingService = async (req, res) => {
  try {
    console.log('\n📝 Update Trending Service Request');
    console.log('ID:', req.params.id);
    console.log('Body:', JSON.stringify(req.body, null, 2));

    const TrendingService = getTrendingServiceModel();
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid trending service ID',
      });
    }

    const service = await TrendingService.findById(id);

    if (!service) {
      return res.status(404).json({
        success: false,
        message: 'Trending service not found',
      });
    }

    const {
      serviceId,
      name,
      categoryId,
      categoryName,
      iconName,
      imageUrl,
      badge,
      bookingsToday,
      progress,
      sortOrder,
      isActive,
      autoSync,
    } = req.body;

    // ==================== UPDATE FIELDS ====================
    if (serviceId !== undefined) service.serviceId = serviceId.trim();
    if (name !== undefined) service.name = name.trim();
    if (categoryId !== undefined) service.categoryId = categoryId.trim();
    if (categoryName !== undefined) service.categoryName = categoryName.trim();
    if (iconName !== undefined) service.iconName = iconName.trim();
    if (imageUrl !== undefined) service.imageUrl = imageUrl;
    
    if (badge !== undefined) {
      service.badge = {
        text: badge.text?.trim() || '',
        type: badge.type || '',
      };
    }
    
    if (bookingsToday !== undefined) {
      service.bookingsToday = Math.max(0, Number(bookingsToday));
    }
    
    if (progress !== undefined) {
      service.progress = Math.min(100, Math.max(0, Number(progress)));
    }
    
    if (sortOrder !== undefined) service.sortOrder = Number(sortOrder);
    if (isActive !== undefined) service.isActive = Boolean(isActive);
    if (autoSync !== undefined) service.autoSync = Boolean(autoSync);

    service.updatedBy = req.user?._id;

    await service.save();

    console.log('✅ Trending service updated successfully');

    res.json({
      success: true,
      message: 'Trending service updated successfully',
      data: service,
    });
  } catch (error) {
    console.error('❌ Error updating trending service:', error);

    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map((err) => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors,
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to update trending service',
      error: error.message,
    });
  }
};

// ==================== DELETE ====================
exports.deleteTrendingService = async (req, res) => {
  try {
    const TrendingService = getTrendingServiceModel();
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid trending service ID',
      });
    }

    const service = await TrendingService.findByIdAndDelete(id);

    if (!service) {
      return res.status(404).json({
        success: false,
        message: 'Trending service not found',
      });
    }

    console.log('✅ Trending service deleted:', id);

    res.json({
      success: true,
      message: 'Trending service deleted successfully',
    });
  } catch (error) {
    console.error('❌ Error deleting trending service:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete trending service',
      error: error.message,
    });
  }
};

// ==================== REORDER ====================
exports.reorderTrendingServices = async (req, res) => {
  try {
    const TrendingService = getTrendingServiceModel();
    const { items } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Items must be a non-empty array',
      });
    }

    const bulkOps = items.map((item) => ({
      updateOne: {
        filter: { _id: item.id },
        update: {
          $set: {
            sortOrder: item.sortOrder,
            updatedBy: req.user?._id,
          },
        },
      },
    }));

    const result = await TrendingService.bulkWrite(bulkOps);

    console.log(`✅ Reordered ${result.modifiedCount} trending services`);

    res.json({
      success: true,
      message: `Successfully reordered ${result.modifiedCount} trending services`,
      data: { modifiedCount: result.modifiedCount },
    });
  } catch (error) {
    console.error('❌ Error reordering trending services:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reorder trending services',
      error: error.message,
    });
  }
};

// ==================== SYNC STATS ====================
exports.syncTrendingStats = async (req, res) => {
  try {
    const TrendingService = getTrendingServiceModel();

    const autoSyncServices = await TrendingService.find({
      isActive: true,
      autoSync: true,
    });

    if (autoSyncServices.length === 0) {
      return res.json({
        success: true,
        message: 'No auto-sync trending services found',
        data: { synced: 0 },
      });
    }

    // TODO: Replace with actual booking data
    // For now, simulate random data
    const updates = autoSyncServices.map(async (service) => {
      const bookingsToday = Math.floor(Math.random() * 150) + 10;
      const maxBookings = 200;
      const progress = Math.min(Math.round((bookingsToday / maxBookings) * 100), 100);

      return TrendingService.findByIdAndUpdate(service._id, {
        bookingsToday,
        progress,
        updatedBy: req.user?._id,
      });
    });

    await Promise.all(updates);

    console.log(`✅ Synced ${autoSyncServices.length} trending services`);

    res.json({
      success: true,
      message: `Synced stats for ${autoSyncServices.length} trending services`,
      data: { synced: autoSyncServices.length },
    });
  } catch (error) {
    console.error('❌ Error syncing trending stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to sync trending stats',
      error: error.message,
    });
  }
};

// ==================== TOGGLE STATUS ====================
exports.toggleTrendingStatus = async (req, res) => {
  try {
    const TrendingService = getTrendingServiceModel();
    const { id } = req.params;
    const { isActive } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid trending service ID',
      });
    }

    const service = await TrendingService.findByIdAndUpdate(
      id,
      {
        isActive: Boolean(isActive),
        updatedBy: req.user?._id,
      },
      { new: true }
    );

    if (!service) {
      return res.status(404).json({
        success: false,
        message: 'Trending service not found',
      });
    }

    console.log(`✅ Toggled trending service status: ${id} -> ${isActive}`);

    res.json({
      success: true,
      message: `Trending service ${isActive ? 'activated' : 'deactivated'} successfully`,
      data: service,
    });
  } catch (error) {
    console.error('❌ Error toggling trending status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to toggle trending status',
      error: error.message,
    });
  }
};

// ==================== GET STATS ====================
exports.getTrendingStats = async (req, res) => {
  try {
    const TrendingService = getTrendingServiceModel();

    const [
      totalTrending,
      activeTrending,
      inactiveTrending,
      autoSyncEnabled,
      services,
    ] = await Promise.all([
      TrendingService.countDocuments(),
      TrendingService.countDocuments({ isActive: true }),
      TrendingService.countDocuments({ isActive: false }),
      TrendingService.countDocuments({ autoSync: true }),
      TrendingService.find({ isActive: true }).lean(),
    ]);

    const totalBookingsToday = services.reduce((sum, s) => sum + (s.bookingsToday || 0), 0);
    const avgProgress =
      services.length > 0
        ? Math.round(services.reduce((sum, s) => sum + (s.progress || 0), 0) / services.length)
        : 0;

    // Category distribution
    const categoryDistribution = {};
    services.forEach((s) => {
      if (s.categoryName) {
        categoryDistribution[s.categoryName] = (categoryDistribution[s.categoryName] || 0) + 1;
      }
    });

    res.json({
      success: true,
      data: {
        totalTrending,
        activeTrending,
        inactiveTrending,
        autoSyncEnabled,
        totalBookingsToday,
        avgProgress,
        categoryDistribution,
      },
    });
  } catch (error) {
    console.error('❌ Error fetching trending stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch trending stats',
      error: error.message,
    });
  }
};

// ==================== PUBLIC API ====================
exports.getPublicTrendingServices = async (req, res) => {
  try {
    const TrendingService = getTrendingServiceModel();
    const { limit = 5 } = req.query;

    const services = await TrendingService.find({ isActive: true })
      .sort({ sortOrder: 1 })
      .limit(parseInt(limit))
      .select('-createdBy -updatedBy -__v')
      .lean();

    res.json({
      success: true,
      data: services,
    });
  } catch (error) {
    console.error('❌ Error fetching public trending services:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch trending services',
      error: error.message,
    });
  }
};

module.exports.getTrendingServiceModel = getTrendingServiceModel;