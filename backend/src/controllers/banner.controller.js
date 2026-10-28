// src/controllers/banner.controller.js
const { getBannerModel } = require('../config/database');
const { deleteImage, extractPublicId, isVideoMime, isVideoUrl } = require('../config/cloudinary');

/**
 * Determine media type from file or URL
 */
const detectMediaType = (file, url) => {
  if (file && file.mimetype) {
    return isVideoMime(file.mimetype) ? 'video' : 'image';
  }
  if (url && isVideoUrl(url)) {
    return 'video';
  }
  return 'image';
};

/**
 * Get all banners with pagination and filters
 */
exports.getBanners = async (req, res) => {
  try {
    const Banner = getBannerModel();

    const {
      page = 1,
      limit = 20,
      search = '',
      isActive,
      position,
      mediaType,
      sortBy = 'display.sortOrder',
      sortOrder = 'asc',
    } = req.query;

    // Build query
    const query = {};

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }

    if (isActive !== undefined) {
      query.isActive = isActive === 'true';
    }

    if (position) {
      query['display.position'] = position;
    }

    if (mediaType) {
      query.mediaType = mediaType;
    }

    // Build sort
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Execute query
    const banners = await Banner.find(query)
      .sort(sort)
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit))
      .lean();

    const total = await Banner.countDocuments(query);

    res.json({
      success: true,
      data: banners,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit)),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
    });

  } catch (error) {
    console.error('Error fetching banners:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch banners',
      error: error.message,
    });
  }
};

/**
 * Get banner by ID
 */
exports.getBannerById = async (req, res) => {
  try {
    const Banner = getBannerModel();
    const { id } = req.params;

    const banner = await Banner.findById(id);

    if (!banner) {
      return res.status(404).json({
        success: false,
        message: 'Banner not found',
      });
    }

    res.json({
      success: true,
      data: banner,
    });

  } catch (error) {
    console.error('Error fetching banner:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch banner',
      error: error.message,
    });
  }
};

/**
 * Create new banner
 */
exports.createBanner = async (req, res) => {
  try {
    const Banner = getBannerModel();

    console.log('📤 Creating banner...');
    console.log('📦 Request body:', req.body);
    console.log('📎 File:', req.file ? `${req.file.filename} (${req.file.mimetype})` : 'No file');

    const {
      title,
      description,
      mediaType: mediaTypeInput,
      // Flat form fields for action
      actionType,
      actionTarget,
      serviceRef,
      categoryRef,
      promoCode,
      // Flat form fields for animation
      animationType,
      animationDuration,
      autoPlayDelay,
      // Flat form fields for schedule
      isScheduled,
      startDate,
      endDate,
      timezone,
      // Flat form fields for targeting
      cities,
      userSegments,
      platforms,
      // Flat form fields for display
      position,
      sortOrder,
      backgroundColor,
      overlayEnabled,
      overlayTitle,
      overlaySubtitle,
      overlayButtonText,
      overlayTextColor,
      // Status
      isActive,
      // JSON fields (if still sent as JSON strings)
      action,
      animation,
      schedule,
      targeting,
      display,
    } = req.body;

    // Validate required fields
    if (!title) {
      if (req.file?.filename) {
        const rt = req.file.mimetype && isVideoMime(req.file.mimetype) ? 'video' : 'image';
        await deleteImage(req.file.filename, rt).catch(console.error);
      }
      return res.status(400).json({
        success: false,
        message: 'Title is required',
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Banner image or video is required',
      });
    }

    // Detect media type
    const detectedMediaType = detectMediaType(req.file);
    const finalMediaType = mediaTypeInput || detectedMediaType;
    const isVideo = finalMediaType === 'video';

    console.log(`🎬 Media type: ${finalMediaType} (detected: ${detectedMediaType})`);

    // Auto-generate bannerId
    const timestamp = Date.now().toString(36);
    const titleSlug = title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .substring(0, 30);
    const bannerId = `${titleSlug}-${timestamp}`;

    console.log('🔑 Generated bannerId:', bannerId);

    // ✅ FIX: Parse action data properly from flat fields OR JSON
    let parsedAction = {};
    if (action) {
      try {
        parsedAction = JSON.parse(action);
      } catch (e) {
        parsedAction = {};
      }
    }

    // Priority: Use flat fields if provided, otherwise use parsed JSON
    parsedAction = {
      type: actionType || parsedAction.type || 'none',
      target: actionTarget || parsedAction.target || '',
      serviceRef: serviceRef || parsedAction.serviceRef || null,
      categoryRef: categoryRef || parsedAction.categoryRef || null,
      promoCode: promoCode || parsedAction.promoCode || '',
    };

    // Parse animation data
    let parsedAnimation = {};
    if (animation) {
      try {
        parsedAnimation = JSON.parse(animation);
      } catch (e) {
        parsedAnimation = {};
      }
    }
    parsedAnimation = {
      type: animationType || parsedAnimation.type || 'slide',
      duration: parseInt(animationDuration || parsedAnimation.duration || 500),
      autoPlayDelay: parseInt(autoPlayDelay || parsedAnimation.autoPlayDelay || 5000),
    };

    // Parse schedule data
    let parsedSchedule = {};
    if (schedule) {
      try {
        parsedSchedule = JSON.parse(schedule);
      } catch (e) {
        parsedSchedule = {};
      }
    }
    parsedSchedule = {
      isScheduled: (isScheduled === 'true' || isScheduled === true) || parsedSchedule.isScheduled || false,
      startDate: startDate || parsedSchedule.startDate || null,
      endDate: endDate || parsedSchedule.endDate || null,
      timezone: timezone || parsedSchedule.timezone || 'UTC',
    };

    // Parse targeting data
    let parsedTargeting = {};
    if (targeting) {
      try {
        parsedTargeting = JSON.parse(targeting);
      } catch (e) {
        parsedTargeting = {};
      }
    }

    // Handle cities, userSegments, platforms (can be arrays or comma-separated strings)
    const parseCitiesArray = (value) => {
      if (!value) return [];
      if (Array.isArray(value)) return value;
      if (typeof value === 'string') {
        try {
          return JSON.parse(value);
        } catch {
          return value.split(',').map(v => v.trim()).filter(Boolean);
        }
      }
      return [];
    };

    parsedTargeting = {
      cities: parseCitiesArray(cities || parsedTargeting.cities),
      userSegments: parseCitiesArray(userSegments || parsedTargeting.userSegments) || ['all'],
      platforms: parseCitiesArray(platforms || parsedTargeting.platforms) || ['all'],
    };

    // Parse display data
    let parsedDisplay = {};
    if (display) {
      try {
        parsedDisplay = JSON.parse(display);
      } catch (e) {
        parsedDisplay = {};
      }
    }
    parsedDisplay = {
      sortOrder: parseInt(sortOrder || parsedDisplay.sortOrder || 0),
      position: position || parsedDisplay.position || 'hero',
      backgroundColor: backgroundColor || parsedDisplay.backgroundColor || '#000000',
      overlay: {
        enabled: (overlayEnabled === 'true' || overlayEnabled === true) || parsedDisplay.overlay?.enabled || false,
        title: overlayTitle || parsedDisplay.overlay?.title || '',
        subtitle: overlaySubtitle || parsedDisplay.overlay?.subtitle || '',
        buttonText: overlayButtonText || parsedDisplay.overlay?.buttonText || '',
        textColor: overlayTextColor || parsedDisplay.overlay?.textColor || '#FFFFFF',
      },
    };

    // Create banner
    const banner = new Banner({
      bannerId,
      title,
      description: description || '',
      mediaType: finalMediaType,
      image: {
        url: req.file.path,
        publicId: req.file.filename,
        altText: title,
        resourceType: isVideo ? 'video' : 'image',
        mimeType: req.file.mimetype || null,
        size: req.file.size || null,
      },
      action: parsedAction,
      animation: parsedAnimation,
      schedule: parsedSchedule,
      targeting: parsedTargeting,
      display: parsedDisplay,
      isActive: req.body.isActive === 'false' ? false : true,
      createdBy: req.user?._id || req.admin?._id,
    });

    await banner.save();

    console.log('✅ Banner created:', banner.bannerId);
    console.log('🎬 Media type:', banner.mediaType);
    console.log('📋 Action saved:', banner.action);

    res.status(201).json({
      success: true,
      message: `Banner created successfully with ${finalMediaType}`,
      data: banner,
    });

  } catch (error) {
    console.error('Error creating banner:', error);

    // Delete uploaded file if banner creation fails
    if (req.file?.filename) {
      const rt = req.file.mimetype && isVideoMime(req.file.mimetype) ? 'video' : 'image';
      await deleteImage(req.file.filename, rt).catch(console.error);
    }

    res.status(500).json({
      success: false,
      message: 'Failed to create banner',
      error: error.message,
    });
  }
};

/**
 * Update banner
 */
exports.updateBanner = async (req, res) => {
  try {
    const Banner = getBannerModel();
    const { id } = req.params;

    console.log('📤 Updating banner:', id);
    console.log('📦 Request body:', req.body);
    console.log('📎 File:', req.file ? `${req.file.filename} (${req.file.mimetype})` : 'No file');

    const banner = await Banner.findById(id);

    if (!banner) {
      if (req.file?.filename) {
        const rt = req.file.mimetype && isVideoMime(req.file.mimetype) ? 'video' : 'image';
        await deleteImage(req.file.filename, rt).catch(console.error);
      }
      return res.status(404).json({
        success: false,
        message: 'Banner not found',
      });
    }

    const {
      title,
      description,
      mediaType: mediaTypeInput,
      // Flat form fields for action
      actionType,
      actionTarget,
      serviceRef,
      categoryRef,
      promoCode,
      // Flat form fields for animation
      animationType,
      animationDuration,
      autoPlayDelay,
      // Flat form fields for schedule
      isScheduled,
      startDate,
      endDate,
      timezone,
      // Flat form fields for targeting
      cities,
      userSegments,
      platforms,
      // Flat form fields for display
      position,
      sortOrder,
      backgroundColor,
      overlayEnabled,
      overlayTitle,
      overlaySubtitle,
      overlayButtonText,
      overlayTextColor,
      // Status
      isActive,
      // JSON fields (if still sent as JSON strings)
      action,
      animation,
      schedule,
      targeting,
      display,
    } = req.body;

    // ✅ FIX: Parse action data properly from flat fields OR JSON
    let parsedAction = { ...banner.action };
    if (action) {
      try {
        parsedAction = { ...parsedAction, ...JSON.parse(action) };
      } catch (e) {
        // Keep existing action if JSON parse fails
      }
    }

    // Update with flat fields if provided
    if (actionType !== undefined) parsedAction.type = actionType;
    if (actionTarget !== undefined) parsedAction.target = actionTarget;
    if (serviceRef !== undefined) parsedAction.serviceRef = serviceRef;
    if (categoryRef !== undefined) parsedAction.categoryRef = categoryRef;
    if (promoCode !== undefined) parsedAction.promoCode = promoCode;

    // Parse animation data
    let parsedAnimation = { ...banner.animation };
    if (animation) {
      try {
        parsedAnimation = { ...parsedAnimation, ...JSON.parse(animation) };
      } catch (e) {
        // Keep existing animation
      }
    }
    if (animationType !== undefined) parsedAnimation.type = animationType;
    if (animationDuration !== undefined) parsedAnimation.duration = parseInt(animationDuration);
    if (autoPlayDelay !== undefined) parsedAnimation.autoPlayDelay = parseInt(autoPlayDelay);

    // Parse schedule data
    let parsedSchedule = { ...banner.schedule };
    if (schedule) {
      try {
        parsedSchedule = { ...parsedSchedule, ...JSON.parse(schedule) };
      } catch (e) {
        // Keep existing schedule
      }
    }
    if (isScheduled !== undefined) parsedSchedule.isScheduled = isScheduled === 'true' || isScheduled === true;
    if (startDate !== undefined) parsedSchedule.startDate = startDate;
    if (endDate !== undefined) parsedSchedule.endDate = endDate;
    if (timezone !== undefined) parsedSchedule.timezone = timezone;

    // Parse targeting data
    let parsedTargeting = { ...banner.targeting };
    if (targeting) {
      try {
        parsedTargeting = { ...parsedTargeting, ...JSON.parse(targeting) };
      } catch (e) {
        // Keep existing targeting
      }
    }

    const parseCitiesArray = (value) => {
      if (!value) return undefined;
      if (Array.isArray(value)) return value;
      if (typeof value === 'string') {
        try {
          return JSON.parse(value);
        } catch {
          return value.split(',').map(v => v.trim()).filter(Boolean);
        }
      }
      return undefined;
    };

    const citiesArray = parseCitiesArray(cities);
    const userSegmentsArray = parseCitiesArray(userSegments);
    const platformsArray = parseCitiesArray(platforms);

    if (citiesArray !== undefined) parsedTargeting.cities = citiesArray;
    if (userSegmentsArray !== undefined) parsedTargeting.userSegments = userSegmentsArray;
    if (platformsArray !== undefined) parsedTargeting.platforms = platformsArray;

    // Parse display data
    let parsedDisplay = { ...banner.display };
    if (display) {
      try {
        parsedDisplay = { ...parsedDisplay, ...JSON.parse(display) };
      } catch (e) {
        // Keep existing display
      }
    }
    if (position !== undefined) parsedDisplay.position = position;
    if (sortOrder !== undefined) parsedDisplay.sortOrder = parseInt(sortOrder);
    if (backgroundColor !== undefined) parsedDisplay.backgroundColor = backgroundColor;

    if (!parsedDisplay.overlay) parsedDisplay.overlay = {};
    if (overlayEnabled !== undefined) parsedDisplay.overlay.enabled = overlayEnabled === 'true' || overlayEnabled === true;
    if (overlayTitle !== undefined) parsedDisplay.overlay.title = overlayTitle;
    if (overlaySubtitle !== undefined) parsedDisplay.overlay.subtitle = overlaySubtitle;
    if (overlayButtonText !== undefined) parsedDisplay.overlay.buttonText = overlayButtonText;
    if (overlayTextColor !== undefined) parsedDisplay.overlay.textColor = overlayTextColor;

    // Handle media file update
    if (req.file) {
      const detectedMediaType = detectMediaType(req.file);
      const finalMediaType = mediaTypeInput || detectedMediaType;
      const isVideo = finalMediaType === 'video';

      console.log(`🎬 New media type: ${finalMediaType}`);

      // Delete old media (use its stored resourceType or fallback to mediaType)
      if (banner.image?.publicId) {
        const oldResourceType = banner.image.resourceType ||
          (banner.mediaType === 'video' ? 'video' : 'image');
        await deleteImage(banner.image.publicId, oldResourceType).catch(console.error);
      }

      banner.mediaType = finalMediaType;
      banner.image.url = req.file.path;
      banner.image.publicId = req.file.filename;
      banner.image.resourceType = isVideo ? 'video' : 'image';
      banner.image.mimeType = req.file.mimetype || null;
      banner.image.size = req.file.size || null;
    } else if (mediaTypeInput && !req.file) {
      // Allow updating mediaType without a new file (edge case)
      banner.mediaType = mediaTypeInput;
    }

    // Update fields
    if (title !== undefined) {
      banner.title = title;
      banner.image.altText = title;
    }
    if (description !== undefined) banner.description = description;

    banner.action = parsedAction;
    banner.animation = parsedAnimation;
    banner.schedule = parsedSchedule;
    banner.targeting = parsedTargeting;
    banner.display = parsedDisplay;

    if (isActive !== undefined) banner.isActive = isActive === 'true' || isActive === true;
    banner.updatedBy = req.user?._id || req.admin?._id;

    await banner.save();

    console.log('✅ Banner updated:', banner.bannerId);
    console.log('🎬 Media type:', banner.mediaType);
    console.log('📋 Action saved:', banner.action);

    res.json({
      success: true,
      message: 'Banner updated successfully',
      data: banner,
    });

  } catch (error) {
    console.error('Error updating banner:', error);

    // Delete uploaded file if update fails
    if (req.file?.filename) {
      const rt = req.file.mimetype && isVideoMime(req.file.mimetype) ? 'video' : 'image';
      await deleteImage(req.file.filename, rt).catch(console.error);
    }

    res.status(500).json({
      success: false,
      message: 'Failed to update banner',
      error: error.message,
    });
  }
};

/**
 * Delete banner
 */
exports.deleteBanner = async (req, res) => {
  try {
    const Banner = getBannerModel();
    const { id } = req.params;

    const banner = await Banner.findById(id);

    if (!banner) {
      return res.status(404).json({
        success: false,
        message: 'Banner not found',
      });
    }

    // Delete main media from Cloudinary (use correct resource_type)
    if (banner.image?.publicId) {
      const resourceType = banner.image.resourceType ||
        (banner.mediaType === 'video' ? 'video' : 'image');
      await deleteImage(banner.image.publicId, resourceType).catch(console.error);
    }

    // Delete mobile image if exists
    if (banner.mobileImage?.publicId) {
      const mobileResourceType = banner.mobileImage.resourceType || 'image';
      await deleteImage(banner.mobileImage.publicId, mobileResourceType).catch(console.error);
    }

    await banner.deleteOne();

    console.log('🗑️ Banner deleted:', banner.bannerId);

    res.json({
      success: true,
      message: 'Banner deleted successfully',
    });

  } catch (error) {
    console.error('Error deleting banner:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete banner',
      error: error.message,
    });
  }
};

/**
 * Reorder banners
 */
exports.reorderBanners = async (req, res) => {
  try {
    const Banner = getBannerModel();
    const { banners } = req.body;

    if (!Array.isArray(banners)) {
      return res.status(400).json({
        success: false,
        message: 'Banners must be an array',
      });
    }

    console.log('🔄 Reordering banners...');

    // Update sort order for each banner
    const updatePromises = banners.map((item) =>
      Banner.findByIdAndUpdate(item.id, {
        'display.sortOrder': item.sortOrder,
        updatedBy: req.user?._id || req.admin?._id,
      })
    );

    await Promise.all(updatePromises);

    console.log('✅ Banners reordered');

    res.json({
      success: true,
      message: 'Banners reordered successfully',
    });

  } catch (error) {
    console.error('Error reordering banners:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reorder banners',
      error: error.message,
    });
  }
};

/**
 * Get banner stats
 */
exports.getBannerStats = async (req, res) => {
  try {
    const Banner = getBannerModel();

    const [
      totalBanners,
      activeBanners,
      scheduledBanners,
      videoBanners,
      imageBanners,
      positionStats,
    ] = await Promise.all([
      Banner.countDocuments(),
      Banner.countDocuments({ isActive: true }),
      Banner.countDocuments({ 'schedule.isScheduled': true }),
      Banner.countDocuments({ mediaType: 'video' }),
      Banner.countDocuments({ $or: [{ mediaType: 'image' }, { mediaType: { $exists: false } }] }),
      Banner.aggregate([
        {
          $group: {
            _id: '$display.position',
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

    const positionDistribution = {};
    positionStats.forEach((stat) => {
      positionDistribution[stat._id] = stat.count;
    });

    // Check for expired banners
    const now = new Date();
    const expiredBanners = await Banner.countDocuments({
      'schedule.isScheduled': true,
      'schedule.endDate': { $lt: now },
    });

    res.json({
      success: true,
      data: {
        totalBanners,
        activeBanners,
        inactiveBanners: totalBanners - activeBanners,
        scheduledBanners,
        expiredBanners,
        videoBanners,
        imageBanners,
        positionDistribution,
        mediaDistribution: {
          image: imageBanners,
          video: videoBanners,
        },
      },
    });

  } catch (error) {
    console.error('Error fetching banner stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch banner stats',
      error: error.message,
    });
  }
};