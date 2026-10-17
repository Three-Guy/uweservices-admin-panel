// src/controllers/subservice.controller.js
const { getSubserviceModel, getCategoryModel, getServiceModel } = require('../config/database');
const { cache } = require('../config/redis');
const ApiError = require('../utils/ApiError');
const logger = require('../utils/logger');
const mongoose = require('mongoose');

// Cache helper
const invalidateSubserviceCache = async (categoryId) => {
  try {
    await cache.delPattern('subservices:*');
    if (categoryId) {
      await cache.delPattern(`category:${categoryId}:*`);
    }
    await cache.delPattern('categories:*');
    await cache.delPattern('services:*');
    await cache.delPattern('home:*');
    await cache.delPattern('layout:*');
    logger.info('Subservice cache invalidated');
  } catch (error) {
    logger.error('Failed to invalidate cache:', error);
  }
};

// ==================== GET ALL SUBSERVICES ====================
exports.getAllSubservices = async (req, res, next) => {
  try {
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('📋 GET ALL SUBSERVICES');
    console.log('═══════════════════════════════════════════════════════════');

    const {
      page = 1,
      limit = 50,
      search,
      category,      // Added: Support for 'category' param from frontend
      categoryId,
      serviceId,
      isActive,
      isPopular,
      isFeatured,
      sortBy = 'sortOrder',
      sortOrder = 'asc',
    } = req.query;

    console.log('📦 Query params:', { category, categoryId, serviceId, isActive, search });

    const Subservice = getSubserviceModel();
    const Category = getCategoryModel();

    const query = {};

    // ==================== CATEGORY FILTER (ENHANCED) ====================
    // Support both 'category' and 'categoryId' params
    const categoryParam = category || categoryId;
    
    if (categoryParam && categoryParam !== 'all') {
      console.log('🔍 Filtering by category:', categoryParam);
      
      if (mongoose.Types.ObjectId.isValid(categoryParam)) {
        // It's a valid ObjectId - search by both category reference and categoryId string
        query.$or = [
          { category: new mongoose.Types.ObjectId(categoryParam) },
          { categoryId: categoryParam }
        ];
        console.log('   → Using ObjectId match + string match');
      } else {
        // It's a string categoryId like "bhabbdb"
        // First try to find the category document to get its ObjectId
        const categoryDoc = await Category.findOne({ categoryId: categoryParam });
        if (categoryDoc) {
          query.$or = [
            { category: categoryDoc._id },
            { categoryId: categoryParam }
          ];
          console.log('   → Found category doc, using both ObjectId and string match');
        } else {
          query.categoryId = categoryParam;
          console.log('   → Using string categoryId match only');
        }
      }
    }

    // Backward compatibility for serviceId filter
    if (serviceId && serviceId !== 'all' && !categoryParam) {
      if (mongoose.Types.ObjectId.isValid(serviceId)) {
        query.service = serviceId;
      } else {
        query.serviceId = serviceId;
      }
    }

    // Status filters
    if (isActive !== undefined && isActive !== 'all' && isActive !== '') {
      query.isActive = isActive === 'true';
    }

    if (isPopular !== undefined && isPopular !== 'all' && isPopular !== '') {
      query.isPopular = isPopular === 'true';
    }

    if (isFeatured !== undefined && isFeatured !== 'all' && isFeatured !== '') {
      query.isFeatured = isFeatured === 'true';
    }

    // Search
    if (search && search.trim()) {
      const searchQuery = [
        { name: { $regex: search.trim(), $options: 'i' } },
        { description: { $regex: search.trim(), $options: 'i' } },
        { subserviceId: { $regex: search.trim(), $options: 'i' } },
        { tags: { $in: [new RegExp(search.trim(), 'i')] } },
      ];
      
      if (query.$or) {
        // If we already have $or for category, we need to use $and
        query.$and = [
          { $or: query.$or },
          { $or: searchQuery }
        ];
        delete query.$or;
      } else {
        query.$or = searchQuery;
      }
    }

    console.log('📊 Final query:', JSON.stringify(query, null, 2));

    const total = await Subservice.countDocuments(query);

    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'asc' ? 1 : -1;

    const subservices = await Subservice.find(query)
      .populate('category', 'name categoryId icon color')
      .sort(sortOptions)
      .skip((parseInt(page) - 1) * parseInt(limit))
      .limit(parseInt(limit))
      .lean();

    const totalPages = Math.ceil(total / parseInt(limit));

    console.log(`✅ Found ${subservices.length} subservices (Total: ${total})`);
    if (subservices.length > 0 && subservices.length <= 10) {
      subservices.forEach((s, i) => console.log(`   ${i + 1}. ${s.name}`));
    }
    console.log('═══════════════════════════════════════════════════════════\n');

    // ==================== RESPONSE FORMAT ====================
    // Return in format that frontend expects: { success, data: [...], pagination }
    res.json({
      success: true,
      data: subservices,  // Direct array, not wrapped in { subservices: [...] }
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages,
        hasNext: parseInt(page) < totalPages,
        hasPrev: parseInt(page) > 1,
      },
    });
  } catch (error) {
    console.error('❌ Error fetching subservices:', error);
    next(error);
  }
};

// ==================== GET SUBSERVICES BY CATEGORY ====================
exports.getSubservicesByCategory = async (req, res, next) => {
  try {
    const { categoryId } = req.params;
    const { isActive, sortBy = 'sortOrder', sortOrder = 'asc', limit = 100 } = req.query;

    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('📋 GET SUBSERVICES BY CATEGORY');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📍 Category ID:', categoryId);
    console.log('📍 isActive filter:', isActive);

    if (!categoryId) {
      return res.status(400).json({
        success: false,
        message: 'Category ID is required',
        data: []
      });
    }

    const Subservice = getSubserviceModel();
    const Category = getCategoryModel();

    let query = {};

    // Build query to match both ObjectId and string categoryId
    if (mongoose.Types.ObjectId.isValid(categoryId)) {
      // It's a valid ObjectId
      console.log('🔍 Searching by ObjectId:', categoryId);
      query.$or = [
        { category: new mongoose.Types.ObjectId(categoryId) },
        { categoryId: categoryId }
      ];
    } else {
      // It's a string categoryId like "bhabbdb"
      console.log('🔍 Searching by string categoryId:', categoryId);
      
      // First, try to find the category document
      const categoryDoc = await Category.findOne({ categoryId: categoryId });
      
      if (categoryDoc) {
        console.log('   → Found category:', categoryDoc.name, '(ObjectId:', categoryDoc._id, ')');
        query.$or = [
          { category: categoryDoc._id },
          { categoryId: categoryId }
        ];
      } else {
        // Just search by string categoryId
        query.categoryId = categoryId;
      }
    }

    // Apply isActive filter
    if (isActive !== undefined && isActive !== '' && isActive !== 'all') {
      query.isActive = isActive === 'true';
    }

    console.log('📊 Query:', JSON.stringify(query, null, 2));

    // Build sort
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'asc' ? 1 : -1;

    const subservices = await Subservice.find(query)
      .populate('category', 'name categoryId icon color')
      .sort(sortOptions)
      .limit(parseInt(limit))
      .lean();

    console.log(`✅ Found ${subservices.length} subservices for category "${categoryId}"`);
    
    if (subservices.length > 0) {
      console.log('📦 Subservices:');
      subservices.forEach((s, i) => console.log(`   ${i + 1}. ${s.name} (${s._id})`));
    } else {
      console.log('⚠️  No subservices found for this category');
      
      // Debug: Show sample subservices to check data structure
      const sampleSubservices = await Subservice.find({}).limit(3).lean();
      if (sampleSubservices.length > 0) {
        console.log('\n🔍 Debug - Sample subservices in database:');
        sampleSubservices.forEach((s, i) => {
          console.log(`   ${i + 1}. ${s.name}`);
          console.log(`      - category (ObjectId): ${s.category}`);
          console.log(`      - categoryId (string): ${s.categoryId}`);
        });
      }
    }

    console.log('═══════════════════════════════════════════════════════════\n');

    // ==================== RESPONSE FORMAT ====================
    // Return in format that frontend expects: { success, data: [...] }
    res.json({
      success: true,
      data: subservices,  // Direct array, not { subservices: [...] }
      pagination: {
        page: 1,
        limit: parseInt(limit),
        total: subservices.length,
        totalPages: 1,
        hasNext: false,
        hasPrev: false,
      },
    });
  } catch (error) {
    console.error('❌ Error fetching subservices by category:', error);
    next(error);
  }
};

// ==================== GET SUBSERVICES BY SERVICE ====================
exports.getSubservicesByService = async (req, res, next) => {
  try {
    const { serviceId } = req.params;
    const { isActive, sortBy = 'sortOrder', sortOrder = 'asc' } = req.query;

    console.log('\n📋 Fetching subservices for service:', serviceId);

    const Subservice = getSubserviceModel();

    let query = {};

    if (mongoose.Types.ObjectId.isValid(serviceId)) {
      query.$or = [
        { service: new mongoose.Types.ObjectId(serviceId) },
        { serviceId: serviceId }
      ];
    } else {
      query.serviceId = serviceId;
    }

    if (isActive !== undefined && isActive !== '' && isActive !== 'all') {
      query.isActive = isActive === 'true';
    }

    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'asc' ? 1 : -1;

    const subservices = await Subservice.find(query)
      .populate('category', 'name categoryId icon color')
      .sort(sortOptions)
      .lean();

    console.log(`✅ Found ${subservices.length} subservices for service "${serviceId}"`);

    // Return in format frontend expects
    res.json({
      success: true,
      data: subservices,
    });
  } catch (error) {
    console.error('❌ Error fetching subservices by service:', error);
    next(error);
  }
};

// ==================== GET SUBSERVICE BY ID ====================
exports.getSubserviceById = async (req, res, next) => {
  try {
    const { id } = req.params;
    console.log('\n📋 Fetching subservice by ID:', id);

    const Subservice = getSubserviceModel();

    let subservice = null;

    if (mongoose.Types.ObjectId.isValid(id)) {
      subservice = await Subservice.findById(id)
        .populate('category', 'name categoryId icon color')
        .lean();
    }

    if (!subservice) {
      subservice = await Subservice.findOne({ subserviceId: id })
        .populate('category', 'name categoryId icon color')
        .lean();
    }

    if (!subservice) {
      throw ApiError.notFound('Subservice not found');
    }

    res.json({
      success: true,
      data: subservice,
    });
  } catch (error) {
    console.error('❌ Error fetching subservice:', error);
    next(error);
  }
};

// ==================== CREATE SUBSERVICE ====================
exports.createSubservice = async (req, res, next) => {
  try {
    console.log('\n➕ Creating new subservice...');
    console.log('📦 Request body:', JSON.stringify(req.body, null, 2));

    const {
      name,
      categoryId,
      category,
      categoryName,
      subtitle,
      description,
      icon,
      colorClass,
      image,
      images,
      pricing,
      duration,
      display,
      includes,
      excludes,
      requirements,
      tags,
      isActive,
      isPopular,
      isFeatured,
      sortOrder,
    } = req.body;

    if (!name || !name.trim()) {
      throw ApiError.badRequest('Subservice name is required');
    }

    if (!category && !categoryId) {
      throw ApiError.badRequest('Category reference is required');
    }

    const Subservice = getSubserviceModel();
    const Category = getCategoryModel();

    let categoryDoc;
    if (category && mongoose.Types.ObjectId.isValid(category)) {
      categoryDoc = await Category.findById(category);
    } else if (categoryId) {
      categoryDoc = await Category.findOne({ categoryId }) || 
                    await Category.findById(categoryId);
    }

    if (!categoryDoc) {
      throw ApiError.notFound('Category not found');
    }

    console.log('✅ Found category:', categoryDoc.name, '(', categoryDoc.categoryId, ')');

    const nameSlug = name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
    
    const generatedSubserviceId = `${categoryDoc.categoryId}-${nameSlug}`;
    console.log('🔑 Generated subserviceId:', generatedSubserviceId);

    const existingSubservice = await Subservice.findOne({ subserviceId: generatedSubserviceId });
    if (existingSubservice) {
      throw ApiError.badRequest(`A subservice with similar name already exists in this category: "${existingSubservice.name}"`);
    }

    const pricingData = {
      price: pricing?.price || 0,
      originalPrice: pricing?.originalPrice || null,
      currency: pricing?.currency || 'INR',
      displayText: pricing?.displayText || '',
      priceType: pricing?.priceType || 'starting_from',
      unit: pricing?.unit || '',
    };

    if (!pricingData.displayText && pricingData.price) {
      const currencySymbols = { USD: '$', INR: '₹', EUR: '€', GBP: '£' };
      const symbol = currencySymbols[pricingData.currency] || '₹';
      switch (pricingData.priceType) {
        case 'fixed':
          pricingData.displayText = `${symbol}${pricingData.price}`;
          break;
        case 'hourly':
          pricingData.displayText = `${symbol}${pricingData.price}/hr`;
          break;
        case 'per_sqft':
          pricingData.displayText = `${symbol}${pricingData.price}/sqft`;
          break;
        case 'per_unit':
          pricingData.displayText = `${symbol}${pricingData.price}/unit`;
          break;
        default:
          pricingData.displayText = `${symbol}${pricingData.price} onwards`;
      }
    }

    const durationData = {
      minutes: duration?.minutes || 60,
      displayText: duration?.displayText || `${duration?.minutes || 60} mins`,
    };

    const displayData = {
      sortOrder: display?.sortOrder || sortOrder || 0,
      colorClass: display?.colorClass || colorClass || 'bg-blue-100',
      badge: {
        text: display?.badge?.text || (isPopular ? 'Popular' : (isFeatured ? 'Featured' : '')),
        type: display?.badge?.type || (isPopular ? 'warning' : (isFeatured ? 'info' : '')),
      },
    };

    const imagesData = images || {};
    if (image && !imagesData.hero?.url) {
      imagesData.hero = { url: image, publicId: null };
      imagesData.thumbnail = { url: image, publicId: null };
    }

    const subservice = new Subservice({
      subserviceId: generatedSubserviceId,
      name: name.trim(),
      subtitle: subtitle?.trim() || '',
      description: description?.trim() || '',
      category: categoryDoc._id,
      categoryId: categoryDoc.categoryId,
      categoryName: categoryName || categoryDoc.name,
      icon: icon || '🔧',
      colorClass: displayData.colorClass,
      image: image || imagesData.hero?.url || null,
      images: imagesData,
      pricing: pricingData,
      duration: durationData,
      display: displayData,
      includes: Array.isArray(includes) ? includes.filter(Boolean) : [],
      excludes: Array.isArray(excludes) ? excludes.filter(Boolean) : [],
      requirements: Array.isArray(requirements) ? requirements.filter(Boolean) : [],
      tags: Array.isArray(tags) ? tags.filter(Boolean) : [],
      isActive: isActive !== false,
      isPopular: isPopular || false,
      isFeatured: isFeatured || false,
      sortOrder: displayData.sortOrder,
      createdBy: req.admin?._id,
    });

    await subservice.save();
    console.log('✅ Subservice created:', subservice.subserviceId);

    await Category.findByIdAndUpdate(categoryDoc._id, { $inc: { subservicesCount: 1 } });

    await invalidateSubserviceCache(categoryDoc.categoryId);

    const io = req.app.get('io');
    if (io) {
      io.emit('subservice:created', { subservice });
    }

    logger.info(`Subservice created: ${subservice.subserviceId} by admin: ${req.admin?.email}`);

    await subservice.populate('category', 'name categoryId icon color');

    res.status(201).json({
      success: true,
      message: 'Subservice created successfully',
      data: subservice,
    });
  } catch (error) {
    console.error('❌ Error creating subservice:', error);
    next(error);
  }
};

// ==================== UPDATE SUBSERVICE ====================
exports.updateSubservice = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    console.log('\n📝 Updating subservice:', id);
    console.log('📦 Updates received (first 500 chars):', JSON.stringify(updates).substring(0, 500));

    if (!id) {
      throw ApiError.badRequest('Subservice ID is required');
    }

    const Subservice = getSubserviceModel();

    let existingSubservice;
    if (mongoose.Types.ObjectId.isValid(id)) {
      existingSubservice = await Subservice.findById(id);
    }
    
    if (!existingSubservice) {
      existingSubservice = await Subservice.findOne({ subserviceId: id });
    }

    if (!existingSubservice) {
      console.log('❌ Subservice not found:', id);
      throw ApiError.notFound('Subservice not found');
    }

    console.log('✅ Found existing subservice:', existingSubservice.name);

    const updateData = {};

    // Simple fields
    if (updates.name !== undefined) updateData.name = updates.name.trim();
    if (updates.subtitle !== undefined) updateData.subtitle = updates.subtitle.trim();
    if (updates.description !== undefined) updateData.description = updates.description.trim();
    if (updates.icon !== undefined) updateData.icon = updates.icon;
    if (updates.colorClass !== undefined) updateData.colorClass = updates.colorClass;
    if (updates.image !== undefined) updateData.image = updates.image;
    if (updates.isActive !== undefined) updateData.isActive = updates.isActive;
    if (updates.isPopular !== undefined) updateData.isPopular = updates.isPopular;
    if (updates.isFeatured !== undefined) updateData.isFeatured = updates.isFeatured;
    if (updates.isNew !== undefined) updateData.isNew = updates.isNew;
    if (updates.sortOrder !== undefined) updateData.sortOrder = updates.sortOrder;

    // Arrays
    if (updates.includes !== undefined) {
      updateData.includes = Array.isArray(updates.includes) ? updates.includes.filter(Boolean) : [];
    }
    if (updates.excludes !== undefined) {
      updateData.excludes = Array.isArray(updates.excludes) ? updates.excludes.filter(Boolean) : [];
    }
    if (updates.requirements !== undefined) {
      updateData.requirements = Array.isArray(updates.requirements) ? updates.requirements.filter(Boolean) : [];
    }
    if (updates.tags !== undefined) {
      updateData.tags = Array.isArray(updates.tags) ? updates.tags.filter(Boolean) : [];
    }

    // Pricing
    if (updates.pricing) {
      const existingPricing = existingSubservice.pricing?.toObject ? 
        existingSubservice.pricing.toObject() : 
        existingSubservice.pricing || {};
      
      updateData.pricing = {
        price: updates.pricing.price !== undefined ? updates.pricing.price : existingPricing.price,
        originalPrice: updates.pricing.originalPrice !== undefined ? updates.pricing.originalPrice : existingPricing.originalPrice,
        currency: updates.pricing.currency || existingPricing.currency || 'INR',
        priceType: updates.pricing.priceType || existingPricing.priceType || 'starting_from',
        unit: updates.pricing.unit !== undefined ? updates.pricing.unit : existingPricing.unit,
        displayText: updates.pricing.displayText || '',
      };

      if (!updateData.pricing.displayText && updateData.pricing.price) {
        const currencySymbols = { USD: '$', INR: '₹', EUR: '€', GBP: '£' };
        const symbol = currencySymbols[updateData.pricing.currency] || '₹';
        const price = updateData.pricing.price;
        
        switch (updateData.pricing.priceType) {
          case 'fixed':
            updateData.pricing.displayText = `${symbol}${price}`;
            break;
          case 'hourly':
            updateData.pricing.displayText = `${symbol}${price}/hr`;
            break;
          case 'per_sqft':
            updateData.pricing.displayText = `${symbol}${price}/sqft`;
            break;
          case 'per_unit':
            updateData.pricing.displayText = `${symbol}${price}/unit`;
            break;
          default:
            updateData.pricing.displayText = `${symbol}${price} onwards`;
        }
      }
    }

    // Duration
    if (updates.duration) {
      const existingDuration = existingSubservice.duration?.toObject ? 
        existingSubservice.duration.toObject() : 
        existingSubservice.duration || {};
      
      updateData.duration = {
        minutes: updates.duration.minutes !== undefined ? updates.duration.minutes : existingDuration.minutes,
        displayText: updates.duration.displayText || existingDuration.displayText || `${updates.duration.minutes || existingDuration.minutes || 60} mins`,
      };
    }

    // Display
    if (updates.display || updates.colorClass || updates.sortOrder !== undefined || updates.isPopular !== undefined || updates.isFeatured !== undefined) {
      const existingDisplay = existingSubservice.display?.toObject ? 
        existingSubservice.display.toObject() : 
        existingSubservice.display || {};
      
      const isPopular = updates.isPopular !== undefined ? updates.isPopular : existingSubservice.isPopular;
      const isFeatured = updates.isFeatured !== undefined ? updates.isFeatured : existingSubservice.isFeatured;
      
      updateData.display = {
        sortOrder: updates.display?.sortOrder !== undefined ? updates.display.sortOrder : 
                   (updates.sortOrder !== undefined ? updates.sortOrder : existingDisplay.sortOrder),
        colorClass: updates.display?.colorClass || updates.colorClass || existingDisplay.colorClass || 'bg-blue-100',
        badge: {
          text: isPopular ? 'Popular' : (isFeatured ? 'Featured' : ''),
          type: isPopular ? 'warning' : (isFeatured ? 'info' : ''),
        },
      };
    }

    // Images
    if (updates.images) {
      const existingImages = existingSubservice.images?.toObject ? 
        existingSubservice.images.toObject() : 
        existingSubservice.images || {};
      
      updateData.images = {
        hero: updates.images.hero || existingImages.hero,
        thumbnail: updates.images.thumbnail || existingImages.thumbnail,
        gallery: updates.images.gallery || existingImages.gallery,
      };

      if (updateData.images.hero?.url) {
        updateData.image = updateData.images.hero.url;
      }
    }

    updateData.updatedBy = req.admin?._id;
    updateData.updatedAt = new Date();

    console.log('📦 Final update data (first 500 chars):', JSON.stringify(updateData).substring(0, 500));

    const subservice = await Subservice.findByIdAndUpdate(
      existingSubservice._id,
      { $set: updateData },
      { new: true, runValidators: true }
    ).populate('category', 'name categoryId icon color');

    if (!subservice) {
      throw ApiError.notFound('Subservice not found after update');
    }

    console.log('✅ Subservice updated successfully:', subservice.subserviceId);

    await invalidateSubserviceCache(subservice.categoryId);

    const io = req.app.get('io');
    if (io) {
      io.emit('subservice:updated', { subservice });
    }

    logger.info(`Subservice updated: ${subservice.subserviceId} by admin: ${req.admin?.email}`);

    res.json({
      success: true,
      message: 'Subservice updated successfully',
      data: subservice,
    });
  } catch (error) {
    console.error('❌ Error updating subservice:', error);
    next(error);
  }
};

// ==================== TOGGLE STATUS ====================
exports.toggleSubserviceStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    console.log('\n🔄 Toggling subservice status:', id, '→ isActive:', isActive);

    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw ApiError.badRequest('Invalid subservice ID');
    }

    const Subservice = getSubserviceModel();
    const Category = getCategoryModel();

    const subservice = await Subservice.findByIdAndUpdate(
      id,
      { 
        $set: { 
          isActive: isActive,
          updatedBy: req.admin?._id,
          updatedAt: new Date(),
        } 
      },
      { new: true }
    ).populate('category', 'name categoryId icon color');

    if (!subservice) {
      throw ApiError.notFound('Subservice not found');
    }

    if (subservice.category) {
      const catId = subservice.category._id || subservice.category;
      const activeCount = await Subservice.countDocuments({
        category: catId,
        isActive: true,
      });
      await Category.findByIdAndUpdate(catId, { subservicesCount: activeCount });
    }

    await invalidateSubserviceCache(subservice.categoryId);

    const io = req.app.get('io');
    if (io) {
      io.emit('subservice:updated', { subservice });
    }

    logger.info(`Subservice status toggled: ${subservice.subserviceId} → ${isActive ? 'active' : 'inactive'}`);

    res.json({
      success: true,
      message: `Subservice ${isActive ? 'activated' : 'deactivated'} successfully`,
      data: subservice,
    });
  } catch (error) {
    console.error('❌ Error toggling status:', error);
    next(error);
  }
};

// ==================== TOGGLE FIELD ====================
exports.toggleSubserviceField = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { field, value } = req.body;

    console.log('\n🔄 Toggling subservice field:', id, '→', field, ':', value);

    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw ApiError.badRequest('Invalid subservice ID');
    }

    const allowedFields = ['isActive', 'isPopular', 'isFeatured', 'isNew'];
    if (!allowedFields.includes(field)) {
      throw ApiError.badRequest(`Invalid field: ${field}. Allowed: ${allowedFields.join(', ')}`);
    }

    const Subservice = getSubserviceModel();
    const Category = getCategoryModel();

    const existingSubservice = await Subservice.findById(id);
    if (!existingSubservice) {
      throw ApiError.notFound('Subservice not found');
    }

    const updateObj = {
      [field]: value,
      updatedBy: req.admin?._id,
      updatedAt: new Date(),
    };

    if (field === 'isPopular' || field === 'isFeatured') {
      const isPopular = field === 'isPopular' ? value : existingSubservice.isPopular;
      const isFeatured = field === 'isFeatured' ? value : existingSubservice.isFeatured;
      
      updateObj['display.badge'] = {
        text: isPopular ? 'Popular' : (isFeatured ? 'Featured' : ''),
        type: isPopular ? 'warning' : (isFeatured ? 'info' : ''),
      };
    }

    const subservice = await Subservice.findByIdAndUpdate(
      id,
      { $set: updateObj },
      { new: true }
    ).populate('category', 'name categoryId icon color');

    if (!subservice) {
      throw ApiError.notFound('Subservice not found');
    }

    if (field === 'isActive' && subservice.category) {
      const catId = subservice.category._id || subservice.category;
      const activeCount = await Subservice.countDocuments({
        category: catId,
        isActive: true,
      });
      await Category.findByIdAndUpdate(catId, { subservicesCount: activeCount });
    }

    await invalidateSubserviceCache(subservice.categoryId);

    const io = req.app.get('io');
    if (io) {
      io.emit('subservice:updated', { subservice });
    }

    console.log(`✅ Subservice ${field} updated to ${value}`);

    res.json({
      success: true,
      message: `Subservice ${field} updated successfully`,
      data: subservice,
    });
  } catch (error) {
    console.error('❌ Error toggling field:', error);
    next(error);
  }
};

// ==================== BULK UPDATE ====================
exports.bulkUpdateSubservices = async (req, res, next) => {
  try {
    const { subserviceIds, updates } = req.body;

    console.log('\n📝 Bulk updating subservices:', subserviceIds?.length);

    if (!Array.isArray(subserviceIds) || subserviceIds.length === 0) {
      throw ApiError.badRequest('Subservice IDs array is required');
    }

    const Subservice = getSubserviceModel();

    const allowedFields = ['isActive', 'isPopular', 'isFeatured', 'isNew'];
    const sanitizedUpdates = {};
    
    Object.keys(updates || {}).forEach(key => {
      if (allowedFields.includes(key)) {
        sanitizedUpdates[key] = updates[key];
      }
    });

    sanitizedUpdates.updatedBy = req.admin?._id;
    sanitizedUpdates.updatedAt = new Date();

    const result = await Subservice.updateMany(
      { _id: { $in: subserviceIds } },
      { $set: sanitizedUpdates }
    );

    await invalidateSubserviceCache('all');

    const io = req.app.get('io');
    if (io) {
      io.emit('subservices:bulkUpdated', { subserviceIds, updates: sanitizedUpdates });
    }

    res.json({
      success: true,
      message: `${result.modifiedCount} subservices updated`,
      data: { modifiedCount: result.modifiedCount },
    });
  } catch (error) {
    console.error('❌ Error bulk updating:', error);
    next(error);
  }
};

// ==================== DELETE ====================
exports.deleteSubservice = async (req, res, next) => {
  try {
    const { id } = req.params;

    console.log('\n🗑️ Deleting subservice:', id);

    const Subservice = getSubserviceModel();
    const Category = getCategoryModel();

    let subservice;
    if (mongoose.Types.ObjectId.isValid(id)) {
      subservice = await Subservice.findById(id);
    }
    
    if (!subservice) {
      subservice = await Subservice.findOne({ subserviceId: id });
    }

    if (!subservice) {
      throw ApiError.notFound('Subservice not found');
    }

    const categoryId = subservice.categoryId;
    const categoryObjectId = subservice.category;

    await Subservice.findByIdAndDelete(subservice._id);

    if (categoryObjectId) {
      const activeCount = await Subservice.countDocuments({
        category: categoryObjectId,
        isActive: true,
      });
      await Category.findByIdAndUpdate(categoryObjectId, { subservicesCount: activeCount });
    }

    await invalidateSubserviceCache(categoryId);

    const io = req.app.get('io');
    if (io) {
      io.emit('subservice:deleted', { subserviceId: id });
    }

    logger.info(`Subservice deleted: ${subservice.subserviceId} by admin: ${req.admin?.email}`);

    res.json({
      success: true,
      message: 'Subservice deleted successfully',
    });
  } catch (error) {
    console.error('❌ Error deleting subservice:', error);
    next(error);
  }
};

// ==================== REORDER ====================
exports.reorderSubservices = async (req, res, next) => {
  try {
    const { subservices } = req.body;

    console.log('\n🔀 Reordering subservices...');

    if (!Array.isArray(subservices) || subservices.length === 0) {
      throw ApiError.badRequest('Subservices array is required');
    }

    const Subservice = getSubserviceModel();

    const updatePromises = subservices.map(({ id, sortOrder }) =>
      Subservice.findByIdAndUpdate(id, { 
        sortOrder, 
        'display.sortOrder': sortOrder,
        updatedBy: req.admin?._id,
        updatedAt: new Date(),
      })
    );

    await Promise.all(updatePromises);

    await invalidateSubserviceCache('all');

    const io = req.app.get('io');
    if (io) {
      io.emit('subservices:reordered', { subservices });
    }

    res.json({
      success: true,
      message: 'Subservices reordered successfully',
    });
  } catch (error) {
    console.error('❌ Error reordering subservices:', error);
    next(error);
  }
};

// ==================== STATS ====================
exports.getSubserviceStats = async (req, res, next) => {
  try {
    console.log('\n📊 Fetching subservice statistics...');

    const Subservice = getSubserviceModel();

    const [
      totalSubservices,
      activeSubservices,
      popularSubservices,
      featuredSubservices,
    ] = await Promise.all([
      Subservice.countDocuments({}),
      Subservice.countDocuments({ isActive: true }),
      Subservice.countDocuments({ isPopular: true }),
      Subservice.countDocuments({ isFeatured: true }),
    ]);

    const categoryDistribution = await Subservice.aggregate([
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
      totalSubservices,
      activeSubservices,
      inactiveSubservices: totalSubservices - activeSubservices,
      popularSubservices,
      featuredSubservices,
      categoryDistribution: categoryDistribution.reduce((acc, item) => {
        acc[item._id || 'Uncategorized'] = item.count;
        return acc;
      }, {}),
    };

    console.log('✅ Subservice stats:', stats);

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error('❌ Error fetching subservice stats:', error);
    next(error);
  }
};