const City = require('../models/City');
const Zone = require('../models/Zone');
const logger = require('../utils/logger');

/**
 * @desc    Get all cities with pagination and filters
 * @route   GET /api/v1/admin/cities
 * @access  Private/Admin
 */
exports.getCities = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search,
      isActive,
      state,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = req.query;

    // Build query
    const query = {};

    // Search filter
    if (search) {
      query.$or = [
        { cityName: { $regex: search, $options: 'i' } },
        { state: { $regex: search, $options: 'i' } },
      ];
    }

    // Status filter
    if (isActive !== undefined && isActive !== 'all') {
      query.isActive = isActive === 'true';
    }

    // State filter
    if (state && state !== 'all') {
      query.state = state;
    }

    // Calculate pagination
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Sort options
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'asc' ? 1 : -1;

    // Get total count
    const total = await City.countDocuments(query);

    // Get cities
    const cities = await City.find(query)
      .sort(sortOptions)
      .skip(skip)
      .limit(limitNum)
      .lean();

    // Get zones count for each city
    const citiesWithZonesCount = await Promise.all(
      cities.map(async (city) => {
        const zonesCount = await Zone.countDocuments({ 
          city: city._id, 
          isDeleted: { $ne: true } 
        });
        return {
          ...city,
          id: city._id.toString(),
          zonesCount,
        };
      })
    );

    // Calculate pagination info
    const totalPages = Math.ceil(total / limitNum);

    res.status(200).json({
      success: true,
      data: {
        cities: citiesWithZonesCount,
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
    logger.error('Error fetching cities:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch cities',
      error: error.message,
    });
  }
};

/**
 * @desc    Get city statistics
 * @route   GET /api/v1/admin/cities/stats
 * @access  Private/Admin
 */
exports.getCityStats = async (req, res) => {
  try {
    const [totalCities, activeCities, inactiveCities, totalZones] = await Promise.all([
      City.countDocuments(),
      City.countDocuments({ isActive: true }),
      City.countDocuments({ isActive: false }),
      Zone.countDocuments({ isDeleted: { $ne: true } }),
    ]);

    // Get cities with at least one zone
    const citiesWithZones = await Zone.distinct('city', { isDeleted: { $ne: true } });

    res.status(200).json({
      success: true,
      data: {
        totalCities,
        activeCities,
        inactiveCities,
        totalZones,
        citiesWithZones: citiesWithZones.length,
      },
    });
  } catch (error) {
    logger.error('Error fetching city stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch city statistics',
      error: error.message,
    });
  }
};

/**
 * @desc    Get all active cities (for dropdowns)
 * @route   GET /api/v1/admin/cities/active/list
 * @access  Private/Admin
 */
exports.getActiveCities = async (req, res) => {
  try {
    const cities = await City.find({ isActive: true })
      .select('cityName state country')
      .sort({ cityName: 1 })
      .lean();

    const citiesWithId = cities.map(city => ({
      ...city,
      id: city._id.toString(),
    }));

    res.status(200).json({
      success: true,
      data: {
        cities: citiesWithId,
      },
    });
  } catch (error) {
    logger.error('Error fetching active cities:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch active cities',
      error: error.message,
    });
  }
};

/**
 * @desc    Get city by ID
 * @route   GET /api/v1/admin/cities/:id
 * @access  Private/Admin
 */
exports.getCityById = async (req, res) => {
  try {
    const { id } = req.params;

    const city = await City.findById(id).lean();

    if (!city) {
      return res.status(404).json({
        success: false,
        message: 'City not found',
      });
    }

    // Get zones count
    const zonesCount = await Zone.countDocuments({ 
      city: city._id, 
      isDeleted: { $ne: true } 
    });

    res.status(200).json({
      success: true,
      data: {
        city: {
          ...city,
          id: city._id.toString(),
          zonesCount,
        },
      },
    });
  } catch (error) {
    logger.error('Error fetching city:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch city',
      error: error.message,
    });
  }
};

/**
 * @desc    Create new city
 * @route   POST /api/v1/admin/cities
 * @access  Private/Admin
 */
exports.createCity = async (req, res) => {
  try {
    const { cityName, state, country = 'India' } = req.body;

    // Validate required fields
    if (!cityName || !state) {
      return res.status(400).json({
        success: false,
        message: 'City name and state are required',
      });
    }

    // Check if city already exists in the same state
    const existingCity = await City.findOne({
      cityName: { $regex: new RegExp(`^${cityName.trim()}$`, 'i') },
      state: { $regex: new RegExp(`^${state.trim()}$`, 'i') },
    });

    if (existingCity) {
      return res.status(400).json({
        success: false,
        message: `City "${cityName}" already exists in ${state}`,
      });
    }

    // Create city
    const city = await City.create({
      cityName: cityName.trim(),
      state: state.trim(),
      country: country.trim(),
      createdBy: req.admin?._id,
    });

    logger.info(`City created: ${city.cityName}, ${city.state} by admin ${req.admin?.email}`);

    res.status(201).json({
      success: true,
      message: 'City created successfully',
      data: {
        city: {
          ...city.toObject(),
          id: city._id.toString(),
          zonesCount: 0,
        },
      },
    });
  } catch (error) {
    logger.error('Error creating city:', error);
    
    // Handle duplicate key error
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'City already exists in this state',
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to create city',
      error: error.message,
    });
  }
};

/**
 * @desc    Update city
 * @route   PATCH /api/v1/admin/cities/:id
 * @access  Private/Admin
 */
exports.updateCity = async (req, res) => {
  try {
    const { id } = req.params;
    const { cityName, state, country } = req.body;

    // Find city
    const city = await City.findById(id);

    if (!city) {
      return res.status(404).json({
        success: false,
        message: 'City not found',
      });
    }

    // Check for duplicate if name or state is being changed
    if (cityName || state) {
      const newCityName = cityName?.trim() || city.cityName;
      const newState = state?.trim() || city.state;

      const duplicate = await City.findOne({
        _id: { $ne: id },
        cityName: { $regex: new RegExp(`^${newCityName}$`, 'i') },
        state: { $regex: new RegExp(`^${newState}$`, 'i') },
      });

      if (duplicate) {
        return res.status(400).json({
          success: false,
          message: `City "${newCityName}" already exists in ${newState}`,
        });
      }
    }

    // Update fields
    if (cityName) city.cityName = cityName.trim();
    if (state) city.state = state.trim();
    if (country) city.country = country.trim();
    city.updatedBy = req.admin?._id;

    await city.save();

    // Get zones count
    const zonesCount = await Zone.countDocuments({ 
      city: city._id, 
      isDeleted: { $ne: true } 
    });

    logger.info(`City updated: ${city.cityName} by admin ${req.admin?.email}`);

    res.status(200).json({
      success: true,
      message: 'City updated successfully',
      data: {
        city: {
          ...city.toObject(),
          id: city._id.toString(),
          zonesCount,
        },
      },
    });
  } catch (error) {
    logger.error('Error updating city:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update city',
      error: error.message,
    });
  }
};

/**
 * @desc    Toggle city status
 * @route   PATCH /api/v1/admin/cities/:id/status
 * @access  Private/Admin
 */
exports.toggleCityStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    const city = await City.findById(id);

    if (!city) {
      return res.status(404).json({
        success: false,
        message: 'City not found',
      });
    }

    city.isActive = isActive;
    city.updatedBy = req.admin?._id;
    await city.save();

    // If deactivating city, also deactivate all zones
    if (!isActive) {
      await Zone.updateMany(
        { city: city._id },
        { isActive: false, updatedBy: req.admin?._id }
      );
    }

    // Get zones count
    const zonesCount = await Zone.countDocuments({ 
      city: city._id, 
      isDeleted: { $ne: true } 
    });

    logger.info(`City ${isActive ? 'activated' : 'deactivated'}: ${city.cityName} by admin ${req.admin?.email}`);

    res.status(200).json({
      success: true,
      message: `City ${isActive ? 'activated' : 'deactivated'} successfully`,
      data: {
        city: {
          ...city.toObject(),
          id: city._id.toString(),
          zonesCount,
        },
      },
    });
  } catch (error) {
    logger.error('Error toggling city status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update city status',
      error: error.message,
    });
  }
};

/**
 * @desc    Delete city
 * @route   DELETE /api/v1/admin/cities/:id
 * @access  Private/Admin
 */
exports.deleteCity = async (req, res) => {
  try {
    const { id } = req.params;

    const city = await City.findById(id);

    if (!city) {
      return res.status(404).json({
        success: false,
        message: 'City not found',
      });
    }

    // Check if city has zones
    const zonesCount = await Zone.countDocuments({ 
      city: city._id, 
      isDeleted: { $ne: true } 
    });

    // Delete all zones in this city
    if (zonesCount > 0) {
      await Zone.updateMany(
        { city: city._id },
        { isDeleted: true, updatedBy: req.admin?._id }
      );
      logger.info(`${zonesCount} zones marked as deleted for city ${city.cityName}`);
    }

    // Delete city
    await City.findByIdAndDelete(id);

    logger.info(`City deleted: ${city.cityName} by admin ${req.admin?.email}`);

    res.status(200).json({
      success: true,
      message: 'City deleted successfully',
      data: {
        deletedZones: zonesCount,
      },
    });
  } catch (error) {
    logger.error('Error deleting city:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete city',
      error: error.message,
    });
  }
};