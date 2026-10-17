// src/controllers/system.controller.js
// PUBLIC APIs for Mobile App - NO AUTH REQUIRED

const { 
  getLayoutConfigModel, 
  getServiceModel, 
  getCategoryModel,
  getSubserviceModel,
  getBannerModel,
  getFeatureFlagModel,
} = require('../config/database');
const { cache } = require('../config/redis');
const logger = require('../utils/logger');

// Cache TTL
const CACHE_TTL = {
  LAYOUT: 300,      // 5 minutes
  HOME_DATA: 300,   // 5 minutes
  SERVICES: 600,    // 10 minutes
  BANNERS: 300,     // 5 minutes
  FLAGS: 60,        // 1 minute
};

// ==================== GET LAYOUT (Public) ====================
exports.getLayout = async (req, res, next) => {
  try {
    const { page = 'home' } = req.query;
    console.log('\n📱 [PUBLIC] Fetching layout for:', page);

    // Try cache
    const cacheKey = `layout:${page}`;
    const cached = await cache.get(cacheKey);
    if (cached) {
      console.log('📦 Cache HIT for layout:', page);
      return res.json({
        success: true,
        data: cached,
        fromCache: true,
      });
    }

    const LayoutConfig = getLayoutConfigModel();

    let layout = await LayoutConfig.findOne({ page, isActive: true })
      .select('-draft -publishHistory -createdBy -updatedBy')
      .lean();

    if (!layout) {
      layout = await LayoutConfig.createDefaultLayout(page);
      layout = layout.toObject();
    }

    // Get only enabled sections
    const enabledSections = layout.sections
      .filter(s => s.enabled)
      .sort((a, b) => a.order - b.order);

    const response = {
      page: layout.page,
      version: layout.version,
      settings: layout.settings,
      sections: enabledSections,
    };

    // Cache the result
    await cache.set(cacheKey, response, CACHE_TTL.LAYOUT);

    res.json({
      success: true,
      data: response,
    });
  } catch (error) {
    console.error('❌ Error fetching layout:', error);
    next(error);
  }
};

// ==================== GET HOME DATA (Public) ====================
exports.getHomeData = async (req, res, next) => {
  try {
    console.log('\n📱 [PUBLIC] Fetching home data...');

    const { cityId } = req.query;

    // Try cache
    const cacheKey = `home:data:${cityId || 'all'}`;
    const cached = await cache.get(cacheKey);
    if (cached) {
      console.log('📦 Cache HIT for home data');
      return res.json({
        success: true,
        data: cached,
        fromCache: true,
      });
    }

    const Banner = getBannerModel();
    const Category = getCategoryModel();
    const Service = getServiceModel();

    const now = new Date();

    // Fetch all data in parallel
    const [banners, categories, services, popularServices, trendingServices] = await Promise.all([
      // Active banners
      Banner.find({
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
        .select('bannerId title image mobileImage action animation display')
        .sort({ 'display.sortOrder': 1 })
        .limit(10)
        .lean(),

      // Active categories
      Category.find({ isActive: true })
        .select('categoryId name icon color colorClass image sortOrder')
        .sort({ sortOrder: 1 })
        .lean(),

      // Featured services
      Service.find({ isActive: true, isFeatured: true })
        .select('serviceId name subtitle icon image images category categoryName pricing display')
        .populate('category', 'name categoryId icon')
        .sort({ 'display.sortOrder': 1 })
        .limit(6)
        .lean(),

      // Popular services
      Service.find({ isActive: true, isPopular: true })
        .select('serviceId name subtitle icon image images category categoryName pricing display metrics')
        .populate('category', 'name categoryId icon')
        .sort({ 'metrics.totalBookings': -1 })
        .limit(6)
        .lean(),

      // Trending (by today's bookings)
      Service.find({ isActive: true })
        .select('serviceId name icon image display metrics')
        .sort({ 'metrics.todayBookings': -1 })
        .limit(5)
        .lean(),
    ]);

    const response = {
      banners: banners.map(b => ({
        id: b._id,
        bannerId: b.bannerId,
        title: b.title,
        imageUrl: b.image?.url,
        mobileImageUrl: b.mobileImage?.url || b.image?.url,
        action: b.action,
        animation: b.animation,
      })),
      categories: categories.map(c => ({
        id: c._id,
        categoryId: c.categoryId,
        name: c.name,
        icon: c.icon,
        color: c.color,
        colorClass: c.colorClass,
        imageUrl: c.image?.url,
      })),
      featuredServices: services.map(s => ({
        id: s._id,
        serviceId: s.serviceId,
        name: s.name,
        subtitle: s.subtitle,
        icon: s.icon,
        imageUrl: s.images?.thumbnail?.url || s.images?.hero?.url || s.image,
        category: s.category?.name || s.categoryName,
        categoryId: s.category?.categoryId,
        pricing: s.pricing,
      })),
      popularServices: popularServices.map(s => ({
        id: s._id,
        serviceId: s.serviceId,
        name: s.name,
        icon: s.icon,
        imageUrl: s.images?.thumbnail?.url || s.image,
        totalBookings: s.metrics?.totalBookings || 0,
      })),
      trendingServices: trendingServices.map(s => ({
        id: s._id,
        serviceId: s.serviceId,
        name: s.name,
        icon: s.icon,
        todayBookings: s.metrics?.todayBookings || 0,
      })),
    };

    // Cache the result
    await cache.set(cacheKey, response, CACHE_TTL.HOME_DATA);

    res.json({
      success: true,
      data: response,
    });
  } catch (error) {
    console.error('❌ Error fetching home data:', error);
    next(error);
  }
};

// ==================== GET SERVICES (Public) ====================
exports.getServices = async (req, res, next) => {
  try {
    console.log('\n📱 [PUBLIC] Fetching services...');

    const { category, cityId } = req.query;

    const cacheKey = `services:public:${category || 'all'}:${cityId || 'all'}`;
    const cached = await cache.get(cacheKey);
    if (cached) {
      return res.json({
        success: true,
        data: cached,
        fromCache: true,
      });
    }

    const Service = getServiceModel();

    const query = { isActive: true };

    if (category) {
      const Category = getCategoryModel();
      const cat = await Category.findOne({ categoryId: category });
      if (cat) {
        query.category = cat._id;
      }
    }

    const services = await Service.find(query)
      .select('serviceId name subtitle icon image images category categoryName pricing display rating')
      .populate('category', 'name categoryId icon color')
      .sort({ 'display.sortOrder': 1 })
      .lean();

    const response = services.map(s => ({
      id: s._id,
      serviceId: s.serviceId,
      name: s.name,
      subtitle: s.subtitle,
      icon: s.icon,
      imageUrl: s.images?.thumbnail?.url || s.images?.hero?.url || s.image,
      heroImageUrl: s.images?.hero?.url || s.image,
      category: s.category?.name || s.categoryName,
      categoryId: s.category?.categoryId,
      categoryColor: s.category?.color,
      pricing: {
        displayText: s.pricing?.displayText || `$${s.pricing?.basePrice || 0} onwards`,
        basePrice: s.pricing?.basePrice,
      },
      rating: s.rating?.average || 0,
      colorClass: s.display?.colorClass || 'bg-blue-100',
    }));

    await cache.set(cacheKey, response, CACHE_TTL.SERVICES);

    res.json({
      success: true,
      data: { services: response },
    });
  } catch (error) {
    next(error);
  }
};

// ==================== GET SERVICE DETAIL (Public) ====================
exports.getServiceDetail = async (req, res, next) => {
  try {
    const { serviceId } = req.params;
    console.log('\n📱 [PUBLIC] Fetching service detail:', serviceId);

    const cacheKey = `service:detail:${serviceId}`;
    const cached = await cache.get(cacheKey);
    if (cached) {
      return res.json({
        success: true,
        data: cached,
        fromCache: true,
      });
    }

    const Service = getServiceModel();
    const Subservice = getSubserviceModel();

    const service = await Service.findOne({ serviceId, isActive: true })
      .populate('category', 'name categoryId icon color')
      .lean();

    if (!service) {
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
      .sort({ sortOrder: 1, isPopular: -1 })
      .lean();

    const response = {
      service: {
        id: service._id,
        serviceId: service.serviceId,
        name: service.name,
        subtitle: service.subtitle,
        description: service.description,
        icon: service.icon,
        heroImage: service.images?.hero?.url || service.image,
        category: service.category?.name || service.categoryName,
        rating: service.rating,
        metrics: service.metrics,
      },
      subservices: subservices.map(sub => ({
        id: sub._id,
        subserviceId: sub.subserviceId,
        name: sub.name,
        description: sub.description,
        icon: sub.icon,
        colorClass: sub.colorClass,
        price: sub.pricing?.displayText || `$${sub.pricing?.price} onwards`,
        priceValue: sub.pricing?.price,
        duration: sub.duration?.displayText,
        isPopular: sub.isPopular,
        includes: sub.includes,
      })),
    };

    await cache.set(cacheKey, response, CACHE_TTL.SERVICES);

    res.json({
      success: true,
      data: response,
    });
  } catch (error) {
    next(error);
  }
};

// ==================== GET CATEGORIES (Public) ====================
exports.getCategories = async (req, res, next) => {
  try {
    console.log('\n📱 [PUBLIC] Fetching categories...');

    const cacheKey = 'categories:public';
    const cached = await cache.get(cacheKey);
    if (cached) {
      return res.json({
        success: true,
        data: cached,
        fromCache: true,
      });
    }

    const Category = getCategoryModel();

    const categories = await Category.find({ isActive: true })
      .select('categoryId name description icon color colorClass image sortOrder servicesCount')
      .sort({ sortOrder: 1 })
      .lean();

    const response = categories.map(c => ({
      id: c._id,
      categoryId: c.categoryId,
      name: c.name,
      description: c.description,
      icon: c.icon,
      color: c.color,
      colorClass: c.colorClass,
      imageUrl: c.image?.url,
      servicesCount: c.servicesCount || 0,
    }));

    await cache.set(cacheKey, response, CACHE_TTL.SERVICES);

    res.json({
      success: true,
      data: { categories: response },
    });
  } catch (error) {
    next(error);
  }
};

// ==================== GET FEATURE FLAGS (Public) ====================
exports.getFeatureFlags = async (req, res, next) => {
  try {
    console.log('\n📱 [PUBLIC] Fetching feature flags...');

    const { platform, appVersion, userId } = req.query;

    const cacheKey = `flags:public:${platform || 'all'}`;
    const cached = await cache.get(cacheKey);
    if (cached) {
      return res.json({
        success: true,
        data: cached,
        fromCache: true,
      });
    }

    const FeatureFlag = getFeatureFlagModel();

    const now = new Date();

    // Get all enabled flags
    const flags = await FeatureFlag.find({
      enabled: true,
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
      .select('key name type value')
      .lean();

    // Convert to key-value map
    const flagsMap = {};
    flags.forEach(flag => {
      if (flag.type === 'boolean') {
        flagsMap[flag.key] = true;
      } else if (flag.type === 'percentage') {
        // For percentage, client should handle rollout
        flagsMap[flag.key] = {
          enabled: true,
          percentage: flag.value?.percentage || 100,
        };
      } else {
        flagsMap[flag.key] = flag.value?.jsonValue || true;
      }
    });

    await cache.set(cacheKey, flagsMap, CACHE_TTL.FLAGS);

    res.json({
      success: true,
      data: { flags: flagsMap },
    });
  } catch (error) {
    next(error);
  }
};

// ==================== GET BANNERS (Public) ====================
exports.getBanners = async (req, res, next) => {
  try {
    console.log('\n📱 [PUBLIC] Fetching banners...');

    const { position = 'hero', cityId } = req.query;

    const cacheKey = `banners:public:${position}:${cityId || 'all'}`;
    const cached = await cache.get(cacheKey);
    if (cached) {
      return res.json({
        success: true,
        data: cached,
        fromCache: true,
      });
    }

    const Banner = getBannerModel();

    const now = new Date();

    const banners = await Banner.find({
      isActive: true,
      'display.position': position,
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
      .select('bannerId title image mobileImage action animation display')
      .sort({ 'display.sortOrder': 1 })
      .limit(10)
      .lean();

    const response = banners.map(b => ({
      id: b._id,
      bannerId: b.bannerId,
      title: b.title,
      imageUrl: b.image?.url,
      mobileImageUrl: b.mobileImage?.url || b.image?.url,
      action: b.action,
      animation: b.animation,
      backgroundColor: b.display?.backgroundColor,
    }));

    await cache.set(cacheKey, response, CACHE_TTL.BANNERS);

    res.json({
      success: true,
      data: { banners: response },
    });
  } catch (error) {
    next(error);
  }
};

// ==================== SEARCH (Public) ====================
exports.search = async (req, res, next) => {
  try {
    const { q, limit = 10 } = req.query;
    console.log('\n📱 [PUBLIC] Search:', q);

    if (!q || q.trim().length < 2) {
      return res.json({
        success: true,
        data: { services: [], categories: [] },
      });
    }

    const Service = getServiceModel();
    const Category = getCategoryModel();

    const searchRegex = new RegExp(q.trim(), 'i');

    const [services, categories] = await Promise.all([
      Service.find({
        isActive: true,
        $or: [
          { name: searchRegex },
          { tags: searchRegex },
          { description: searchRegex },
        ],
      })
        .select('serviceId name icon image')
        .limit(parseInt(limit))
        .lean(),

      Category.find({
        isActive: true,
        $or: [
          { name: searchRegex },
          { description: searchRegex },
        ],
      })
        .select('categoryId name icon')
        .limit(5)
        .lean(),
    ]);

    res.json({
      success: true,
      data: {
        services: services.map(s => ({
          id: s._id,
          serviceId: s.serviceId,
          name: s.name,
          icon: s.icon,
          type: 'service',
        })),
        categories: categories.map(c => ({
          id: c._id,
          categoryId: c.categoryId,
          name: c.name,
          icon: c.icon,
          type: 'category',
        })),
      },
    });
  } catch (error) {
    next(error);
  }
};