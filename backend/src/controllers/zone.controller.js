const Zone = require('../models/Zone');
const City = require('../models/City');
const logger = require('../utils/logger');
const { validatePolygon, isPointInPolygon } = require('../utils/geoUtils');

/**
 * @desc    Get all zones with pagination and filters
 * @route   GET /api/v1/admin/zones
 * @access  Private/Admin
 */
exports.getZones = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search,
      cityId,
      isActive,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = req.query;

    // Build query
    const query = { isDeleted: { $ne: true } };

    // Search filter
    if (search) {
      query.zoneName = { $regex: search, $options: 'i' };
    }

    // City filter
    if (cityId && cityId !== 'all') {
      query.city = cityId;
    }

    // Status filter
    if (isActive !== undefined && isActive !== 'all') {
      query.isActive = isActive === 'true';
    }

    // Calculate pagination
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Sort options
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'asc' ? 1 : -1;

    // Get total count
    const total = await Zone.countDocuments(query);

    // Get zones with city populated
    const zones = await Zone.find(query)
      .populate('city', 'cityName state country')
      .sort(sortOptions)
      .skip(skip)
      .limit(limitNum)
      .lean();

    // Format zones
    const formattedZones = zones.map(zone => ({
      ...zone,
      id: zone._id.toString(),
      cityId: zone.city?._id?.toString() || null,
    }));

    // Calculate pagination info
    const totalPages = Math.ceil(total / limitNum);

    res.status(200).json({
      success: true,
      data: {
        zones: formattedZones,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages,
          hasNext: pageNum < totalPages,
          hasPrev: pageNum > 1,
        },
      },
    });
  } catch (error) {
    logger.error('Error fetching zones:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch zones',
      error: error.message,
    });
  }
};

/**
 * @desc    Get zone statistics
 * @route   GET /api/v1/admin/zones/stats
 * @access  Private/Admin
 */
exports.getZoneStats = async (req, res) => {
  try {
    const [totalZones, activeZones, inactiveZones] = await Promise.all([
      Zone.countDocuments({ isDeleted: { $ne: true } }),
      Zone.countDocuments({ isDeleted: { $ne: true }, isActive: true }),
      Zone.countDocuments({ isDeleted: { $ne: true }, isActive: false }),
    ]);

    // Get zones per city
    const zonesPerCity = await Zone.aggregate([
      { $match: { isDeleted: { $ne: true } } },
      { $group: { _id: '$city', count: { $sum: 1 } } },
      {
        $lookup: {
          from: 'cities',
          localField: '_id',
          foreignField: '_id',
          as: 'cityInfo',
        },
      },
      { $unwind: '$cityInfo' },
      {
        $project: {
          cityName: '$cityInfo.cityName',
          count: 1,
        },
      },
    ]);

    const zonesPerCityMap = {};
    zonesPerCity.forEach(item => {
      zonesPerCityMap[item.cityName] = item.count;
    });

    res.status(200).json({
      success: true,
      data: {
        totalZones,
        activeZones,
        inactiveZones,
        zonesPerCity: zonesPerCityMap,
      },
    });
  } catch (error) {
    logger.error('Error fetching zone stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch zone statistics',
      error: error.message,
    });
  }
};

/**
 * @desc    Get zones by city
 * @route   GET /api/v1/admin/zones/city/:cityId
 * @access  Private/Admin
 */
exports.getZonesByCity = async (req, res) => {
  try {
    const { cityId } = req.params;

    const zones = await Zone.find({ 
      city: cityId, 
      isDeleted: { $ne: true } 
    })
      .populate('city', 'cityName state country')
      .sort({ zoneName: 1 })
      .lean();

    const formattedZones = zones.map(zone => ({
      ...zone,
      id: zone._id.toString(),
      cityId: zone.city?._id?.toString() || null,
    }));

    res.status(200).json({
      success: true,
      data: {
        zones: formattedZones,
      },
    });
  } catch (error) {
    logger.error('Error fetching zones by city:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch zones',
      error: error.message,
    });
  }
};

/**
 * @desc    Get zone by ID
 * @route   GET /api/v1/admin/zones/:id
 * @access  Private/Admin
 */
exports.getZoneById = async (req, res) => {
  try {
    const { id } = req.params;

    const zone = await Zone.findOne({ 
      _id: id, 
      isDeleted: { $ne: true } 
    })
      .populate('city', 'cityName state country')
      .lean();

    if (!zone) {
      return res.status(404).json({
        success: false,
        message: 'Zone not found',
      });
    }

    res.status(200).json({
      success: true,
      data: {
        zone: {
          ...zone,
          id: zone._id.toString(),
          cityId: zone.city?._id?.toString() || null,
        },
      },
    });
  } catch (error) {
    logger.error('Error fetching zone:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch zone',
      error: error.message,
    });
  }
};

/**
 * @desc    Create new zone
 * @route   POST /api/v1/admin/zones
 * @access  Private/Admin
 */
exports.createZone = async (req, res) => {
  try {
    const { zoneName, cityId, polygonCoordinates } = req.body;

    // Validate required fields
    if (!zoneName || !cityId || !polygonCoordinates) {
      return res.status(400).json({
        success: false,
        message: 'Zone name, city, and polygon coordinates are required',
      });
    }

    // Validate city exists and is active
    const city = await City.findById(cityId);
    if (!city) {
      return res.status(404).json({
        success: false,
        message: 'City not found',
      });
    }

    if (!city.isActive) {
      return res.status(400).json({
        success: false,
        message: 'Cannot create zone for inactive city',
      });
    }

    // Validate polygon
    const polygonValidation = validatePolygon(polygonCoordinates);
    if (!polygonValidation.valid) {
      return res.status(400).json({
        success: false,
        message: polygonValidation.message,
      });
    }

    // Check if zone name already exists in this city
    const existingZone = await Zone.findOne({
      zoneName: { $regex: new RegExp(`^${zoneName.trim()}$`, 'i') },
      city: cityId,
      isDeleted: { $ne: true },
    });

    if (existingZone) {
      return res.status(400).json({
        success: false,
        message: `Zone "${zoneName}" already exists in ${city.cityName}`,
      });
    }

    // Create zone
    const zone = await Zone.create({
      zoneName: zoneName.trim(),
      city: cityId,
      polygonCoordinates,
      createdBy: req.admin?._id,
    });

    // Populate city info
    await zone.populate('city', 'cityName state country');

    logger.info(`Zone created: ${zone.zoneName} in ${city.cityName} by admin ${req.admin?.email}`);

    res.status(201).json({
      success: true,
      message: 'Zone created successfully',
      data: {
        zone: {
          ...zone.toObject(),
          id: zone._id.toString(),
          cityId: zone.city._id.toString(),
        },
      },
    });
  } catch (error) {
    logger.error('Error creating zone:', error);

    // Handle duplicate key error
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Zone already exists in this city',
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to create zone',
      error: error.message,
    });
  }
};

/**
 * @desc    Update zone
 * @route   PATCH /api/v1/admin/zones/:id
 * @access  Private/Admin
 */
exports.updateZone = async (req, res) => {
  try {
    const { id } = req.params;
    const { zoneName, cityId, polygonCoordinates } = req.body;

    // Find zone
    const zone = await Zone.findOne({ 
      _id: id, 
      isDeleted: { $ne: true } 
    });

    if (!zone) {
      return res.status(404).json({
        success: false,
        message: 'Zone not found',
      });
    }

    // Validate city if being changed
    if (cityId && cityId !== zone.city.toString()) {
      const city = await City.findById(cityId);
      if (!city) {
        return res.status(404).json({
          success: false,
          message: 'City not found',
        });
      }
      if (!city.isActive) {
        return res.status(400).json({
          success: false,
          message: 'Cannot assign zone to inactive city',
        });
      }
      zone.city = cityId;
    }

    // Validate polygon if being updated
    if (polygonCoordinates) {
      const polygonValidation = validatePolygon(polygonCoordinates);
      if (!polygonValidation.valid) {
        return res.status(400).json({
          success: false,
          message: polygonValidation.message,
        });
      }
      zone.polygonCoordinates = polygonCoordinates;
    }

    // Check for duplicate zone name if being changed
    if (zoneName && zoneName.trim() !== zone.zoneName) {
      const duplicate = await Zone.findOne({
        _id: { $ne: id },
        zoneName: { $regex: new RegExp(`^${zoneName.trim()}$`, 'i') },
        city: zone.city,
        isDeleted: { $ne: true },
      });

      if (duplicate) {
        return res.status(400).json({
          success: false,
          message: `Zone "${zoneName}" already exists in this city`,
        });
      }
      zone.zoneName = zoneName.trim();
    }

    zone.updatedBy = req.admin?._id;
    await zone.save();

    // Populate city info
    await zone.populate('city', 'cityName state country');

    logger.info(`Zone updated: ${zone.zoneName} by admin ${req.admin?.email}`);

    res.status(200).json({
      success: true,
      message: 'Zone updated successfully',
      data: {
        zone: {
          ...zone.toObject(),
          id: zone._id.toString(),
          cityId: zone.city._id.toString(),
        },
      },
    });
  } catch (error) {
    logger.error('Error updating zone:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update zone',
      error: error.message,
    });
  }
};

/**
 * @desc    Toggle zone status
 * @route   PATCH /api/v1/admin/zones/:id/status
 * @access  Private/Admin
 */
exports.toggleZoneStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    const zone = await Zone.findOne({ 
      _id: id, 
      isDeleted: { $ne: true } 
    });

    if (!zone) {
      return res.status(404).json({
        success: false,
        message: 'Zone not found',
      });
    }

    // Check if city is active when activating zone
    if (isActive) {
      const city = await City.findById(zone.city);
      if (!city?.isActive) {
        return res.status(400).json({
          success: false,
          message: 'Cannot activate zone for inactive city',
        });
      }
    }

    zone.isActive = isActive;
    zone.updatedBy = req.admin?._id;
    await zone.save();

    // Populate city info
    await zone.populate('city', 'cityName state country');

    logger.info(`Zone ${isActive ? 'activated' : 'deactivated'}: ${zone.zoneName} by admin ${req.admin?.email}`);

    res.status(200).json({
      success: true,
      message: `Zone ${isActive ? 'activated' : 'deactivated'} successfully`,
      data: {
        zone: {
          ...zone.toObject(),
          id: zone._id.toString(),
          cityId: zone.city._id.toString(),
        },
      },
    });
  } catch (error) {
    logger.error('Error toggling zone status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update zone status',
      error: error.message,
    });
  }
};

/**
 * @desc    Delete zone (soft delete)
 * @route   DELETE /api/v1/admin/zones/:id
 * @access  Private/Admin
 */
exports.deleteZone = async (req, res) => {
  try {
    const { id } = req.params;

    const zone = await Zone.findOne({ 
      _id: id, 
      isDeleted: { $ne: true } 
    });

    if (!zone) {
      return res.status(404).json({
        success: false,
        message: 'Zone not found',
      });
    }

    // Soft delete
    zone.isDeleted = true;
    zone.isActive = false;
    zone.updatedBy = req.admin?._id;
    await zone.save();

    logger.info(`Zone deleted: ${zone.zoneName} by admin ${req.admin?.email}`);

    res.status(200).json({
      success: true,
      message: 'Zone deleted successfully',
    });
  } catch (error) {
    logger.error('Error deleting zone:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete zone',
      error: error.message,
    });
  }
};

/**
 * @desc    Detect zone from coordinates
 * @route   GET /api/v1/admin/zones/detect
 * @access  Private/Admin
 */
exports.detectZone = async (req, res) => {
  try {
    const { lat, lng } = req.query;

    if (!lat || !lng) {
      return res.status(400).json({
        success: false,
        message: 'Latitude and longitude are required',
      });
    }

    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);

    if (isNaN(latitude) || isNaN(longitude)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid coordinates',
      });
    }

    // Find zone containing the point
    const zone = await Zone.findZoneContainingPoint(latitude, longitude);

    if (!zone) {
      return res.status(200).json({
        success: true,
        data: {
          found: false,
          message: 'No zone found for the given coordinates',
        },
      });
    }

    res.status(200).json({
      success: true,
      data: {
        found: true,
        zone: {
          ...zone.toObject(),
          id: zone._id.toString(),
          cityId: zone.city?._id?.toString() || null,
        },
        city: zone.city ? {
          ...zone.city.toObject(),
          id: zone.city._id.toString(),
        } : null,
      },
    });
  } catch (error) {
    logger.error('Error detecting zone:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to detect zone',
      error: error.message,
    });
  }
};

/**
 * @desc    Get providers in a zone
 * @route   GET /api/v1/admin/zones/:id/providers
 * @access  Private/Admin
 */
exports.getZoneProviders = async (req, res) => {
  try {
    const { id } = req.params;

    const zone = await Zone.findOne({ 
      _id: id, 
      isDeleted: { $ne: true } 
    });

    if (!zone) {
      return res.status(404).json({
        success: false,
        message: 'Zone not found',
      });
    }

    // TODO: When provider model is updated with zone_id, fetch providers here
    // For now, return empty array
    const providers = [];

    res.status(200).json({
      success: true,
      data: {
        zone: {
          id: zone._id.toString(),
          zoneName: zone.zoneName,
        },
        providers,
        total: providers.length,
      },
    });
  } catch (error) {
    logger.error('Error fetching zone providers:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch providers',
      error: error.message,
    });
  }
};