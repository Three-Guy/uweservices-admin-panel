// src/controllers/service.controller.js
const { getServiceModel, getCategoryModel, getSubserviceModel } = require('../config/database');
const { cache } = require('../config/redis');
const ApiError = require('../utils/ApiError');
const logger = require('../utils/logger');
const mongoose = require('mongoose');

// Cache keys
const CACHE_KEYS = {
  ALL_SERVICES: 'services:all',
  ACTIVE_SERVICES: 'services:active',
  SERVICE_BY_ID: (id) => `service:${id}`,
  SERVICES_BY_CATEGORY: (catId) => `services:category:${catId}`,
};

// Cache TTL (seconds)
const CACHE_TTL = {
  SERVICES: 600, // 10 minutes
};

// Helper: Invalidate service cache
const invalidateServiceCache = async () => {
  try {
    await cache.delPattern('services:*');
    await cache.delPattern('service:*');
    await cache.delPattern('layout:*'); // Also invalidate layout cache
    await cache.delPattern('home:*');
    logger.info('Service cache invalidated');
  } catch (error) {
    logger.error('Failed to invalidate service cache:', error);
  }
};

// ==================== GET ALL SERVICES ====================
exports.getAllServices = async (req, res, next) => {
  try {
    console.log('\n📋 Fetching all services...');

    const {
      page = 1,
      limit = 50,
      search,
      category,
      isActive,
      isPopular,
      isFeatured,
      sortBy = 'display.sortOrder',
      sortOrder = 'asc',
    } = req.query;

    const Service = getServiceModel();
    const Category = getCategoryModel(); // ✅ ADD THIS LINE - Ensures Category model is registered

    // Build query
    const query = {};

    if (category && category !== 'all') {
      if (mongoose.Types.ObjectId.isValid(category)) {
        query.category = category;
      }
    }

    if (isActive !== undefined && isActive !== 'all') {
      query.isActive = isActive === 'true';
    }

    if (isPopular !== undefined && isPopular !== 'all') {
      query.isPopular = isPopular === 'true';
    }

    if (isFeatured !== undefined && isFeatured !== 'all') {
      query.isFeatured = isFeatured === 'true';
    }

    if (search && search.trim()) {
      query.$or = [
        { name: { $regex: search.trim(), $options: 'i' } },
        { serviceId: { $regex: search.trim(), $options: 'i' } },
        { description: { $regex: search.trim(), $options: 'i' } },
        { tags: { $in: [new RegExp(search.trim(), 'i')] } },
      ];
    }

    // Count total
    const total = await Service.countDocuments(query);
    console.log('📊 Total services:', total);

    // Sort options
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'asc' ? 1 : -1;

    // Fetch services with category populated
    const services = await Service.find(query)
      .populate('category', 'name categoryId icon color')
      .sort(sortOptions)
      .skip((parseInt(page) - 1) * parseInt(limit))
      .limit(parseInt(limit))
      .lean();

    console.log('📥 Fetched services:', services.length);

    const totalPages = Math.ceil(total / parseInt(limit));

    res.json({
      success: true,
      data: {
        services,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages,
          hasNext: parseInt(page) < totalPages,
          hasPrev: parseInt(page) > 1,
        },
      },
    });
  } catch (error) {
    console.error('❌ Error fetching services:', error);
    next(error);
  }
};

// ==================== GET SERVICE STATS ====================
exports.getServiceStats = async (req, res, next) => {
  try {
    console.log('\n📊 Fetching service statistics...');

    const Service = getServiceModel();
    const Subservice = getSubserviceModel();

    const [
      totalServices,
      activeServices,
      inactiveServices,
      popularServices,
      featuredServices,
      totalSubservices,
    ] = await Promise.all([
      Service.countDocuments({}),
      Service.countDocuments({ isActive: true }),
      Service.countDocuments({ isActive: false }),
      Service.countDocuments({ isPopular: true }),
      Service.countDocuments({ isFeatured: true }),
      Subservice.countDocuments({ isActive: true }),
    ]);

    // Category distribution
    const categoryDistribution = await Service.aggregate([
      { $match: { isActive: true } },
      {
        $lookup: {
          from: 'categories',
          localField: 'category',
          foreignField: '_id',
          as: 'categoryInfo',
        },
      },
      { $unwind: { path: '$categoryInfo', preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: '$categoryInfo.name',
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
    ]);

    const stats = {
      totalServices,
      activeServices,
      inactiveServices,
      popularServices,
      featuredServices,
      totalSubservices,
      categoryDistribution: categoryDistribution.reduce((acc, item) => {
        acc[item._id || 'Uncategorized'] = item.count;
        return acc;
      }, {}),
    };

    console.log('✅ Service stats:', stats);

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error('❌ Error fetching service stats:', error);
    next(error);
  }
};

// ==================== GET SERVICE BY ID ====================
exports.getServiceById = async (req, res, next) => {
  try {
    const { id } = req.params;
    console.log('\n📋 Fetching service by ID:', id);

    const Service = getServiceModel();
    const Category = getCategoryModel(); // ✅ ADD THIS LINE
    const Subservice = getSubserviceModel();

    let service = null;

    // Try ObjectId first
    if (mongoose.Types.ObjectId.isValid(id)) {
      service = await Service.findById(id)
        .populate('category', 'name categoryId icon color')
        .lean();
    }

    // Try serviceId
    if (!service) {
      service = await Service.findOne({ serviceId: id })
        .populate('category', 'name categoryId icon color')
        .lean();
    }

    if (!service) {
      throw ApiError.notFound('Service not found');
    }

    // Get subservices
    const subservices = await Subservice.find({ 
      service: service._id, 
      isActive: true 
    })
      .sort({ sortOrder: 1 })
      .lean();

    res.json({
      success: true,
      data: {
        service: {
          ...service,
          subservices,
          subservicesCount: subservices.length,
        },
      },
    });
  } catch (error) {
    console.error('❌ Error fetching service:', error);
    next(error);
  }
};

// ==================== CREATE SERVICE ====================
exports.createService = async (req, res, next) => {
  try {
    console.log('\n➕ Creating new service...');
    console.log('📦 Body:', req.body);

    const {
      name,
      serviceId,
      subtitle,
      description,
      category,
      icon,
      image,
      images,
      pricing,
      display,
      tags,
      isActive,
      isPopular,
      isFeatured,
    } = req.body;

    if (!name) {
      throw ApiError.badRequest('Service name is required');
    }

    if (!category) {
      throw ApiError.badRequest('Category is required');
    }

    const Service = getServiceModel();
    const Category = getCategoryModel();

    // Verify category exists
    const categoryDoc = await Category.findById(category);
    if (!categoryDoc) {
      throw ApiError.notFound('Category not found');
    }

    // Check for duplicate
    const generatedServiceId = serviceId || name.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-');
    const existingService = await Service.findOne({ serviceId: generatedServiceId });

    if (existingService) {
      throw ApiError.conflict('Service with this ID already exists');
    }

    // Create service
    const service = new Service({
      name,
      serviceId: generatedServiceId,
      subtitle: subtitle || '',
      description: description || '',
      category,
      categoryName: categoryDoc.name,
      icon: icon || '🔧',
      image,
      images: images || {},
      pricing: pricing || { basePrice: 0, currency: 'USD', priceType: 'starting_from' },
      display: display || { sortOrder: 0, colorClass: 'bg-blue-100' },
      tags: tags || [],
      isActive: isActive !== false,
      isPopular: isPopular || false,
      isFeatured: isFeatured || false,
      createdBy: req.admin?._id,
    });

    await service.save();

    // Update category service count
    await Category.findByIdAndUpdate(category, { $inc: { servicesCount: 1 } });

    // Invalidate cache
    await invalidateServiceCache();

    // Emit socket event
    const io = req.app.get('io');
    if (io) {
      io.emit('service:created', { service });
    }

    logger.info(`Service created: ${service.serviceId} by admin: ${req.admin?.email}`);

    res.status(201).json({
      success: true,
      message: 'Service created successfully',
      data: { service },
    });
  } catch (error) {
    console.error('❌ Error creating service:', error);
    next(error);
  }
};

// ==================== UPDATE SERVICE ====================
exports.updateService = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    console.log('\n📝 Updating service:', id);

    const Service = getServiceModel();
    const Category = getCategoryModel();

    // Remove protected fields
    delete updates._id;
    delete updates.createdAt;
    delete updates.createdBy;

    // If category is being updated, update categoryName
    if (updates.category) {
      const categoryDoc = await Category.findById(updates.category);
      if (categoryDoc) {
        updates.categoryName = categoryDoc.name;
      }
    }

    updates.updatedBy = req.admin?._id;

    let service = null;

    if (mongoose.Types.ObjectId.isValid(id)) {
      service = await Service.findByIdAndUpdate(
        id,
        { $set: updates },
        { new: true, runValidators: true }
      ).populate('category', 'name categoryId icon');
    }

    if (!service) {
      service = await Service.findOneAndUpdate(
        { serviceId: id },
        { $set: updates },
        { new: true, runValidators: true }
      ).populate('category', 'name categoryId icon');
    }

    if (!service) {
      throw ApiError.notFound('Service not found');
    }

    // Invalidate cache
    await invalidateServiceCache();

    // Emit socket event
    const io = req.app.get('io');
    if (io) {
      io.emit('service:updated', { service });
    }

    logger.info(`Service updated: ${service.serviceId} by admin: ${req.admin?.email}`);

    res.json({
      success: true,
      message: 'Service updated successfully',
      data: { service },
    });
  } catch (error) {
    console.error('❌ Error updating service:', error);
    next(error);
  }
};

// ==================== TOGGLE SERVICE STATUS ====================
exports.toggleServiceStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    console.log('\n🔄 Toggling service status:', id);

    const Service = getServiceModel();

    const service = await Service.findByIdAndUpdate(
      id,
      { 
        $set: { 
          isActive,
          updatedBy: req.admin?._id,
        } 
      },
      { new: true }
    );

    if (!service) {
      throw ApiError.notFound('Service not found');
    }

    await invalidateServiceCache();

    const io = req.app.get('io');
    if (io) {
      io.emit('service:updated', { service });
    }

    res.json({
      success: true,
      message: `Service ${isActive ? 'activated' : 'deactivated'} successfully`,
      data: { service },
    });
  } catch (error) {
    next(error);
  }
};

// ==================== DELETE SERVICE ====================
exports.deleteService = async (req, res, next) => {
  try {
    const { id } = req.params;

    console.log('\n🗑️ Deleting service:', id);

    const Service = getServiceModel();
    const Subservice = getSubserviceModel();
    const Category = getCategoryModel();

    const service = await Service.findById(id);

    if (!service) {
      throw ApiError.notFound('Service not found');
    }

    // Delete all subservices
    await Subservice.deleteMany({ service: id });

    // Update category count
    if (service.category) {
      await Category.findByIdAndUpdate(service.category, { $inc: { servicesCount: -1 } });
    }

    // Delete service
    await Service.findByIdAndDelete(id);

    await invalidateServiceCache();

    const io = req.app.get('io');
    if (io) {
      io.emit('service:deleted', { serviceId: id });
    }

    logger.info(`Service deleted: ${service.serviceId} by admin: ${req.admin?.email}`);

    res.json({
      success: true,
      message: 'Service and all subservices deleted successfully',
    });
  } catch (error) {
    console.error('❌ Error deleting service:', error);
    next(error);
  }
};

// ==================== GET SERVICES BY CATEGORY ====================
exports.getServicesByCategory = async (req, res, next) => {
  try {
    const { categoryId } = req.params;
    
    console.log('\n📋 Fetching services by category:', categoryId);

    const Service = getServiceModel();

    let query = {};
    
    if (mongoose.Types.ObjectId.isValid(categoryId)) {
      query.category = categoryId;
    } else {
      // Find category by categoryId string first
      const Category = getCategoryModel();
      const category = await Category.findOne({ categoryId });
      if (category) {
        query.category = category._id;
      } else {
        return res.json({
          success: true,
          data: { services: [] },
        });
      }
    }

    query.isActive = true;

    const services = await Service.find(query)
      .sort({ 'display.sortOrder': 1 })
      .lean();

    res.json({
      success: true,
      data: { services },
    });
  } catch (error) {
    next(error);
  }
};

// ==================== REORDER SERVICES ====================
exports.reorderServices = async (req, res, next) => {
  try {
    const { services } = req.body;

    console.log('\n🔀 Reordering services...');

    if (!Array.isArray(services) || services.length === 0) {
      throw ApiError.badRequest('Services array is required');
    }

    const Service = getServiceModel();

    const updatePromises = services.map(({ id, sortOrder }) =>
      Service.findByIdAndUpdate(id, { 'display.sortOrder': sortOrder })
    );

    await Promise.all(updatePromises);

    await invalidateServiceCache();

    const io = req.app.get('io');
    if (io) {
      io.emit('services:reordered', { services });
    }

    res.json({
      success: true,
      message: 'Services reordered successfully',
    });
  } catch (error) {
    next(error);
  }
};

// ==================== BULK UPDATE SERVICES ====================
exports.bulkUpdateServices = async (req, res, next) => {
  try {
    const { serviceIds, updates } = req.body;

    console.log('\n📝 Bulk updating services:', serviceIds?.length);

    if (!Array.isArray(serviceIds) || serviceIds.length === 0) {
      throw ApiError.badRequest('Service IDs array is required');
    }

    const Service = getServiceModel();

    const result = await Service.updateMany(
      { _id: { $in: serviceIds } },
      { $set: { ...updates, updatedBy: req.admin?._id } }
    );

    await invalidateServiceCache();

    res.json({
      success: true,
      message: `${result.modifiedCount} services updated`,
      data: { modifiedCount: result.modifiedCount },
    });
  } catch (error) {
    next(error);
  }
};