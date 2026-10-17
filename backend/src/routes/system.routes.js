// src/routes/system.routes.js
const express = require('express');
const router = express.Router();

const layoutController = require('../controllers/layout.controller');
const trendingController = require('../controllers/trending.controller');
const { 
  getBannerModel, 
  getCategoryModel, 
  getServiceModel, 
  getSubserviceModel 
} = require('../config/database');

// ==================== LAYOUT ROUTES ====================

/**
 * Get home page layout configuration
 * Used by mobile app to render dynamic UI
 */
router.get('/layout', layoutController.getPublicLayout);

/**
 * Get all home page data in one request
 * Optimized for mobile app initial load
 */
router.get('/home-data', async (req, res) => {
  try {
    const { getLayoutConfigModel } = require('../config/database');
    const LayoutConfig = getLayoutConfigModel();
    const Banner = getBannerModel();
    const Category = getCategoryModel();
    const Service = getServiceModel();
    const { getTrendingServiceModel } = require('../controllers/trending.controller');
    const TrendingService = getTrendingServiceModel();

    // Get layout
    let layout = await LayoutConfig.findOne({ 
      page: 'home', 
      isActive: true,
      isPublished: true,
    });

    if (!layout) {
      layout = await LayoutConfig.createDefaultLayout('home');
    }

    const enabledSections = layout.getEnabledSections();

    // Fetch data based on enabled sections
    const data = {};

    // Check which data is needed
    const sectionTypes = enabledSections.map(s => s.type);

    // Banners
    if (sectionTypes.includes('banner_carousel') || sectionTypes.includes('promo_banner')) {
      const now = new Date();
      data.banners = await Banner.find({
        isActive: true,
        $or: [
          { 'schedule.isScheduled': false },
          {
            'schedule.isScheduled': true,
            'schedule.startDate': { $lte: now },
            $or: [
              { 'schedule.endDate': null },
              { 'schedule.endDate': { $gte: now } },
            ],
          },
        ],
      })
        .sort({ 'display.sortOrder': 1 })
        .limit(10)
        .lean()
        .then(banners => banners.map(b => ({
          id: b._id,
          title: b.title,
          description: b.description,
          imageUrl: b.image.url,
          action: b.action,
          overlay: b.display.overlay,
        })));
    }

    // Categories - Updated to include More Services card
    if (sectionTypes.includes('category_grid') || sectionTypes.includes('category_list')) {
      // Get regular active categories (not More Services section)
      const regularCategories = await Category.find({ 
        isActive: true,
        isMoreServicesSection: { $ne: true },
      })
        .sort({ sortOrder: 1 })
        .limit(3) // Only first 3 for grid
        .lean();

      // Get More Services section configuration
      const moreServicesSection = await Category.findOne({ 
        isMoreServicesSection: true,
        isActive: true,
      }).lean();

      // Count total categories for "More" badge
      const totalCategories = await Category.countDocuments({ 
        isActive: true,
        isMoreServicesSection: { $ne: true },
      });

      const hasMore = totalCategories > 3;

      // Transform categories
      const transformedCategories = regularCategories.map(c => ({
        id: c._id,
        categoryId: c.categoryId,
        name: c.name,
        icon: c.icon,
        imageUrl: c.image?.url,
        color: c.color,
        colorClass: c.colorClass,
        serviceCount: c.subservicesCount || c.servicesCount || 0,
        isMoreCard: false,
      }));

      // Add More Services card if there are more categories
      if (hasMore) {
        transformedCategories.push({
          id: 'more-services',
          categoryId: 'more-services',
          name: moreServicesSection?.moreServicesConfig?.displaySettings?.title || 'More Services',
          icon: moreServicesSection?.icon || '🔧',
          imageUrl: moreServicesSection?.image?.url || null,
          color: moreServicesSection?.color || '#6366F1',
          colorClass: moreServicesSection?.colorClass || 'bg-indigo-100',
          serviceCount: totalCategories - 3,
          isMoreCard: true,
          actionType: moreServicesSection?.moreServicesConfig?.action?.actionType || 'all_services',
        });
      }

      data.categories = transformedCategories;
    }

    // Trending Services
    if (sectionTypes.includes('trending_services')) {
      data.trendingServices = await TrendingService.find({ isActive: true })
        .sort({ sortOrder: 1 })
        .limit(5)
        .lean()
        .then(services => services.map(s => ({
          id: s._id,
          name: s.name,
          serviceSlug: s.serviceSlug,
          iconName: s.iconName,
          imageUrl: s.imageUrl,
          badge: s.badge,
          bookingsToday: s.bookingsToday,
          progress: s.progress,
        })));
    }

    // Popular/Featured Services
    if (sectionTypes.includes('popular_services') || sectionTypes.includes('featured_services')) {
      data.popularServices = await Service.find({ 
        isActive: true, 
        $or: [{ isPopular: true }, { isFeatured: true }],
      })
        .sort({ 'display.sortOrder': 1 })
        .limit(10)
        .populate('category', 'name categoryId')
        .lean()
        .then(services => services.map(s => ({
          id: s._id,
          serviceId: s.serviceId,
          name: s.name,
          subtitle: s.subtitle,
          imageUrl: s.images?.hero?.url || s.image,
          categoryName: s.category?.name || s.categoryName,
          rating: s.rating,
          pricing: s.pricing,
          isPopular: s.isPopular,
          isFeatured: s.isFeatured,
        })));
    }

    res.json({
      success: true,
      data: {
        layout: {
          page: layout.page,
          sections: enabledSections,
          settings: layout.settings,
          version: layout.version,
        },
        ...data,
      },
      meta: {
        generatedAt: new Date().toISOString(),
        cacheTTL: 300, // 5 minutes
      },
    });
  } catch (error) {
    console.error('Error fetching home data:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch home data',
      error: error.message,
    });
  }
});

// ==================== BANNER ROUTES ====================

/**
 * Get active banners
 */
router.get('/banners', async (req, res) => {
  try {
    const Banner = getBannerModel();
    const { position = 'hero', limit = 10 } = req.query;
    
    const banners = await Banner.getActiveBanners({ position, limit: parseInt(limit) });

    res.json({
      success: true,
      data: banners.map(b => ({
        id: b._id,
        title: b.title,
        description: b.description,
        imageUrl: b.image.url,
        mobileImageUrl: b.mobileImage?.url,
        action: b.action,
        overlay: b.display?.overlay,
        animation: b.animation,
      })),
    });
  } catch (error) {
    console.error('Error fetching banners:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch banners',
      error: error.message,
    });
  }
});

// ==================== CATEGORY ROUTES ====================

/**
 * Get category grid for mobile app (3 categories + More Services)
 * PUBLIC ENDPOINT - No auth required
 */
router.get('/categories/grid', async (req, res) => {
  try {
    const Category = getCategoryModel();

    console.log('📱 [PUBLIC] Fetching category grid...');

    // Get first 3 active categories (excluding More Services section)
    const categories = await Category.find({ 
      isActive: true,
      isMoreServicesSection: { $ne: true },
    })
      .select('_id categoryId name icon image color colorClass sortOrder subservicesCount servicesCount')
      .sort({ sortOrder: 1 })
      .limit(3)
      .lean();

    // Get More Services section configuration
    const moreServicesSection = await Category.findOne({ 
      isMoreServicesSection: true,
      isActive: true,
    })
      .select('name icon image color colorClass moreServicesConfig')
      .lean();

    // Count total active categories (excluding More Services)
    const totalCategories = await Category.countDocuments({ 
      isActive: true,
      isMoreServicesSection: { $ne: true },
    });

    const hasMore = totalCategories > 3;

    // Build response
    const gridCategories = categories.map(cat => ({
      id: cat._id.toString(),
      categoryId: cat.categoryId,
      name: cat.name,
      icon: cat.icon,
      imageUrl: cat.image?.url || null,
      color: cat.color,
      colorClass: cat.colorClass,
      serviceCount: cat.subservicesCount || cat.servicesCount || 0,
      isMoreCard: false,
    }));

    // Add More Services card if there are more categories
    if (hasMore) {
      const moreConfig = moreServicesSection?.moreServicesConfig;
      gridCategories.push({
        id: 'more-services',
        categoryId: 'more-services',
        name: moreConfig?.displaySettings?.title || moreServicesSection?.name || 'More Services',
        icon: moreServicesSection?.icon || '🔧',
        imageUrl: moreServicesSection?.image?.url || null,
        color: moreConfig?.displaySettings?.color || moreServicesSection?.color || '#6366F1',
        colorClass: moreConfig?.displaySettings?.colorClass || moreServicesSection?.colorClass || 'bg-indigo-100',
        isMoreCard: true,
        serviceCount: totalCategories - 3,
        actionType: moreConfig?.action?.actionType || 'all_services',
        config: moreConfig || {},
      });
    }

    console.log(`✅ Returning ${gridCategories.length} categories for grid`);

    res.json({
      success: true,
      data: {
        categories: gridCategories,
        hasMore,
        totalCategories,
        displayedCategories: categories.length,
      },
    });
  } catch (error) {
    console.error('❌ Error fetching category grid:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch category grid',
      error: error.message,
    });
  }
});

/**
 * Get all categories with their subservices
 * Used by "All Services" screen in mobile app
 * PUBLIC ENDPOINT - No auth required
 */
router.get('/categories/all', async (req, res) => {
  try {
    const Category = getCategoryModel();
    const Subservice = getSubserviceModel();

    console.log('📱 [PUBLIC] Fetching all categories with subservices...');

    const { 
      search = '', 
      sortBy = 'sortOrder', 
      sortOrder = 'asc',
      includeEmpty = 'false',
    } = req.query;

    // Build query
    const query = {
      isActive: true,
      isMoreServicesSection: { $ne: true },
    };

    // Search filter
    if (search && search.trim()) {
      query.$or = [
        { name: { $regex: search.trim(), $options: 'i' } },
        { description: { $regex: search.trim(), $options: 'i' } },
      ];
    }

    // Build sort
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Get all active categories
    const categories = await Category.find(query)
      .select('_id categoryId name description icon image color colorClass subservicesCount servicesCount')
      .sort(sort)
      .lean();

    console.log(`📦 Found ${categories.length} categories`);

    // Get subservices for each category
    const categoriesWithSubservices = await Promise.all(
      categories.map(async (category) => {
        // Build subservice query
        const subserviceQuery = {
          category: category._id,
          isActive: true,
        };

        // If searching, also search in subservices
        if (search && search.trim()) {
          subserviceQuery.$or = [
            { name: { $regex: search.trim(), $options: 'i' } },
            { description: { $regex: search.trim(), $options: 'i' } },
          ];
        }

        const subservices = await Subservice.find(subserviceQuery)
          .select('_id subserviceId name description icon image pricing duration rating isPopular isFeatured sortOrder')
          .sort({ sortOrder: 1, isPopular: -1 })
          .lean();

        return {
          id: category._id.toString(),
          categoryId: category.categoryId,
          name: category.name,
          description: category.description || '',
          icon: category.icon,
          imageUrl: category.image?.url || null,
          color: category.color,
          colorClass: category.colorClass,
          subservicesCount: subservices.length,
          subservices: subservices.map(sub => ({
            id: sub._id.toString(),
            subserviceId: sub.subserviceId,
            name: sub.name,
            description: sub.description || '',
            icon: sub.icon,
            imageUrl: sub.image || sub.images?.hero?.url || sub.images?.thumbnail?.url || null,
            price: sub.pricing?.displayText || `₹${sub.pricing?.price || 0} onwards`,
            priceValue: sub.pricing?.price || 0,
            originalPrice: sub.pricing?.originalPrice || null,
            duration: sub.duration?.displayText || `${sub.duration?.minutes || 60} mins`,
            durationMinutes: sub.duration?.minutes || 60,
            rating: sub.rating?.average || 0,
            ratingCount: sub.rating?.count || 0,
            isPopular: sub.isPopular || false,
            isFeatured: sub.isFeatured || false,
          })),
        };
      })
    );

    // Filter out empty categories if not requested
    let finalCategories = categoriesWithSubservices;
    if (includeEmpty !== 'true') {
      finalCategories = categoriesWithSubservices.filter(cat => cat.subservices.length > 0);
    }

    // Calculate totals
    const totalCategories = finalCategories.length;
    const totalSubservices = finalCategories.reduce((sum, cat) => sum + cat.subservices.length, 0);

    console.log(`✅ Returning ${totalCategories} categories with ${totalSubservices} subservices`);

    res.json({
      success: true,
      data: {
        categories: finalCategories,
        totalCategories,
        totalSubservices,
      },
    });
  } catch (error) {
    console.error('❌ Error fetching categories with subservices:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch categories',
      error: error.message,
    });
  }
});

/**
 * Get active categories (simple list)
 */
router.get('/categories', async (req, res) => {
  try {
    const Category = getCategoryModel();
    const { featured, limit = 50 } = req.query;

    const query = { 
      isActive: true,
      isMoreServicesSection: { $ne: true },
    };
    if (featured === 'true') {
      query.isFeatured = true;
    }

    const categories = await Category.find(query)
      .sort({ sortOrder: 1 })
      .limit(parseInt(limit))
      .lean();

    res.json({
      success: true,
      data: categories.map(c => ({
        id: c._id,
        categoryId: c.categoryId,
        name: c.name,
        description: c.description,
        icon: c.icon,
        imageUrl: c.image?.url,
        color: c.color,
        colorClass: c.colorClass,
        servicesCount: c.subservicesCount || c.servicesCount || 0,
        isFeatured: c.isFeatured,
      })),
    });
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch categories',
      error: error.message,
    });
  }
});

/**
 * Get single category by ID or categoryId
 */
router.get('/categories/:id', async (req, res) => {
  try {
    const Category = getCategoryModel();
    const Subservice = getSubserviceModel();
    const { id } = req.params;

    let category;

    // Try to find by MongoDB ID first
    if (id.match(/^[0-9a-fA-F]{24}$/)) {
      category = await Category.findById(id).lean();
    }

    // If not found, try by categoryId slug
    if (!category) {
      category = await Category.findOne({ categoryId: id }).lean();
    }

    if (!category || !category.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Category not found',
      });
    }

    // Get subservices for this category
    const subservices = await Subservice.find({ 
      category: category._id, 
      isActive: true,
    })
      .sort({ sortOrder: 1 })
      .lean();

    res.json({
      success: true,
      data: {
        id: category._id,
        categoryId: category.categoryId,
        name: category.name,
        description: category.description,
        icon: category.icon,
        imageUrl: category.image?.url,
        color: category.color,
        colorClass: category.colorClass,
        subservicesCount: subservices.length,
        subservices: subservices.map(sub => ({
          id: sub._id,
          subserviceId: sub.subserviceId,
          name: sub.name,
          description: sub.description,
          icon: sub.icon,
          imageUrl: sub.image || null,
          price: sub.pricing?.displayText || `₹${sub.pricing?.price || 0} onwards`,
          duration: sub.duration?.displayText || `${sub.duration?.minutes || 60} mins`,
          rating: sub.rating?.average || 0,
          ratingCount: sub.rating?.count || 0,
          isPopular: sub.isPopular || false,
          includes: sub.includes || [],
          excludes: sub.excludes || [],
          requirements: sub.requirements || [],
        })),
      },
    });
  } catch (error) {
    console.error('Error fetching category:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch category',
      error: error.message,
    });
  }
});

// ==================== SUBSERVICE ROUTES ====================

/**
 * Get subservices by category
 */
router.get('/categories/:categoryId/subservices', async (req, res) => {
  try {
    const Category = getCategoryModel();
    const Subservice = getSubserviceModel();
    const { categoryId } = req.params;
    const { popular, featured, limit = 50 } = req.query;

    // Find category
    let category;
    if (categoryId.match(/^[0-9a-fA-F]{24}$/)) {
      category = await Category.findById(categoryId).lean();
    }
    if (!category) {
      category = await Category.findOne({ categoryId }).lean();
    }

    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found',
      });
    }

    // Build query
    const query = {
      category: category._id,
      isActive: true,
    };

    if (popular === 'true') {
      query.isPopular = true;
    }
    if (featured === 'true') {
      query.isFeatured = true;
    }

    const subservices = await Subservice.find(query)
      .sort({ sortOrder: 1 })
      .limit(parseInt(limit))
      .lean();

    res.json({
      success: true,
      data: {
        category: {
          id: category._id,
          categoryId: category.categoryId,
          name: category.name,
          icon: category.icon,
          color: category.color,
        },
        subservices: subservices.map(sub => ({
          id: sub._id,
          subserviceId: sub.subserviceId,
          name: sub.name,
          description: sub.description,
          icon: sub.icon,
          imageUrl: sub.image || null,
          pricing: sub.pricing,
          duration: sub.duration,
          rating: sub.rating,
          isPopular: sub.isPopular,
          isFeatured: sub.isFeatured,
          includes: sub.includes,
          excludes: sub.excludes,
          requirements: sub.requirements,
        })),
        total: subservices.length,
      },
    });
  } catch (error) {
    console.error('Error fetching subservices:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch subservices',
      error: error.message,
    });
  }
});

/**
 * Get single subservice by ID
 */
router.get('/subservices/:id', async (req, res) => {
  try {
    const Category = getCategoryModel();
    const Subservice = getSubserviceModel();
    const { id } = req.params;

    let subservice;

    // Try to find by MongoDB ID first
    if (id.match(/^[0-9a-fA-F]{24}$/)) {
      subservice = await Subservice.findById(id)
        .populate('category', 'name categoryId icon color')
        .lean();
    }

    // If not found, try by subserviceId slug
    if (!subservice) {
      subservice = await Subservice.findOne({ subserviceId: id })
        .populate('category', 'name categoryId icon color')
        .lean();
    }

    if (!subservice || !subservice.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Subservice not found',
      });
    }

    res.json({
      success: true,
      data: {
        id: subservice._id,
        subserviceId: subservice.subserviceId,
        name: subservice.name,
        description: subservice.description,
        icon: subservice.icon,
        imageUrl: subservice.image || subservice.images?.hero?.url || null,
        images: subservice.images,
        category: subservice.category,
        pricing: {
          price: subservice.pricing?.price || 0,
          originalPrice: subservice.pricing?.originalPrice || null,
          currency: subservice.pricing?.currency || 'INR',
          displayText: subservice.pricing?.displayText || `₹${subservice.pricing?.price || 0}`,
          priceType: subservice.pricing?.priceType || 'starting_from',
          unit: subservice.pricing?.unit || '',
        },
        duration: {
          minutes: subservice.duration?.minutes || 60,
          displayText: subservice.duration?.displayText || `${subservice.duration?.minutes || 60} mins`,
        },
        rating: {
          average: subservice.rating?.average || 0,
          count: subservice.rating?.count || 0,
        },
        includes: subservice.includes || [],
        excludes: subservice.excludes || [],
        requirements: subservice.requirements || [],
        isPopular: subservice.isPopular || false,
        isFeatured: subservice.isFeatured || false,
        tags: subservice.tags || [],
      },
    });
  } catch (error) {
    console.error('Error fetching subservice:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch subservice',
      error: error.message,
    });
  }
});

// ==================== TRENDING ROUTES ====================

/**
 * Get trending services
 */
router.get('/trending', trendingController.getPublicTrendingServices);

// ==================== SERVICE ROUTES ====================

/**
 * Get services
 */
router.get('/services', async (req, res) => {
  try {
    const Service = getServiceModel();
    const { 
      category, 
      featured, 
      popular, 
      limit = 20,
      page = 1,
      search,
    } = req.query;

    const query = { isActive: true };
    
    if (category) query.category = category;
    if (featured === 'true') query.isFeatured = true;
    if (popular === 'true') query.isPopular = true;
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { tags: { $in: [new RegExp(search, 'i')] } },
      ];
    }

    const services = await Service.find(query)
      .populate('category', 'name categoryId color')
      .sort({ 'display.sortOrder': 1, createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit))
      .lean();

    const total = await Service.countDocuments(query);

    res.json({
      success: true,
      data: services.map(s => ({
        id: s._id,
        serviceId: s.serviceId,
        name: s.name,
        subtitle: s.subtitle,
        description: s.description,
        imageUrl: s.images?.hero?.url || s.image,
        thumbnailUrl: s.images?.thumbnail?.url,
        category: s.category,
        icon: s.icon,
        pricing: s.pricing,
        rating: s.rating,
        metrics: s.metrics,
        display: s.display,
        isPopular: s.isPopular,
        isFeatured: s.isFeatured,
        tags: s.tags,
      })),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error('Error fetching services:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch services',
      error: error.message,
    });
  }
});

/**
 * Get service by ID or slug
 */
router.get('/services/:id', async (req, res) => {
  try {
    const Service = getServiceModel();
    const Subservice = getSubserviceModel();
    const { id } = req.params;

    let service;
    
    // Try to find by MongoDB ID first
    if (id.match(/^[0-9a-fA-F]{24}$/)) {
      service = await Service.findById(id).populate('category', 'name categoryId color');
    }
    
    // If not found, try by serviceId slug
    if (!service) {
      service = await Service.findOne({ serviceId: id }).populate('category', 'name categoryId color');
    }

    if (!service || !service.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Service not found',
      });
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
        id: service._id,
        serviceId: service.serviceId,
        name: service.name,
        subtitle: service.subtitle,
        description: service.description,
        images: service.images,
        category: service.category,
        icon: service.icon,
        pricing: service.pricing,
        rating: service.rating,
        metrics: service.metrics,
        display: service.display,
        tags: service.tags,
        availability: service.availability,
        seo: service.seo,
        subservices: subservices.map(sub => ({
          id: sub._id,
          subserviceId: sub.subserviceId,
          name: sub.name,
          description: sub.description,
          icon: sub.icon,
          pricing: sub.pricing,
          duration: sub.duration,
          rating: sub.rating,
          includes: sub.includes,
          excludes: sub.excludes,
          requirements: sub.requirements,
        })),
      },
    });
  } catch (error) {
    console.error('Error fetching service:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch service',
      error: error.message,
    });
  }
});

// ==================== SEARCH ROUTES ====================

/**
 * Search services and categories
 */
router.get('/search', async (req, res) => {
  try {
    const Category = getCategoryModel();
    const Subservice = getSubserviceModel();
    const { q, limit = 10, type } = req.query;

    if (!q) {
      return res.status(400).json({
        success: false,
        message: 'Search query is required',
      });
    }

    const searchRegex = new RegExp(q, 'i');
    const results = {
      categories: [],
      subservices: [],
    };

    // Search categories (unless type is specified as 'subservices')
    if (!type || type === 'categories' || type === 'all') {
      const categories = await Category.find({
        isActive: true,
        isMoreServicesSection: { $ne: true },
        $or: [
          { name: searchRegex },
          { description: searchRegex },
        ],
      })
        .limit(parseInt(limit))
        .lean();

      results.categories = categories.map(c => ({
        id: c._id,
        categoryId: c.categoryId,
        name: c.name,
        icon: c.icon,
        imageUrl: c.image?.url,
        color: c.color,
        type: 'category',
      }));
    }

    // Search subservices (unless type is specified as 'categories')
    if (!type || type === 'subservices' || type === 'all') {
      const subservices = await Subservice.find({
        isActive: true,
        $or: [
          { name: searchRegex },
          { description: searchRegex },
          { tags: searchRegex },
        ],
      })
        .populate('category', 'name categoryId')
        .limit(parseInt(limit))
        .lean();

      results.subservices = subservices.map(s => ({
        id: s._id,
        subserviceId: s.subserviceId,
        name: s.name,
        description: s.description,
        categoryName: s.category?.name,
        categoryId: s.category?.categoryId,
        icon: s.icon,
        imageUrl: s.image,
        price: s.pricing?.displayText,
        type: 'subservice',
      }));
    }

    res.json({
      success: true,
      data: results,
      meta: {
        query: q,
        totalResults: results.categories.length + results.subservices.length,
      },
    });
  } catch (error) {
    console.error('Error searching:', error);
    res.status(500).json({
      success: false,
      message: 'Search failed',
      error: error.message,
    });
  }
});

// ==================== HEALTH CHECK ====================

/**
 * Health check for SDUI system
 */
router.get('/health', async (req, res) => {
  try {
    const { getLayoutConfigModel, getBannerModel, getCategoryModel, getSubserviceModel } = require('../config/database');
    
    const LayoutConfig = getLayoutConfigModel();
    const Banner = getBannerModel();
    const Category = getCategoryModel();
    const Subservice = getSubserviceModel();

    const [layoutCount, bannerCount, categoryCount, subserviceCount] = await Promise.all([
      LayoutConfig.countDocuments({ isActive: true }),
      Banner.countDocuments({ isActive: true }),
      Category.countDocuments({ isActive: true, isMoreServicesSection: { $ne: true } }),
      Subservice.countDocuments({ isActive: true }),
    ]);

    res.json({
      success: true,
      status: 'healthy',
      data: {
        layouts: layoutCount,
        banners: bannerCount,
        categories: categoryCount,
        subservices: subserviceCount,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      status: 'unhealthy',
      error: error.message,
    });
  }
});

module.exports = router;