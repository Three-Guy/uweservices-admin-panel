const { getProviderConnection } = require('../config/database');
const ApiError = require('../utils/ApiError');
const logger = require('../utils/logger');
const mongoose = require('mongoose');

// Helper to get the providers collection
const getProviderCollection = () => {
  const providerConn = getProviderConnection();
  return providerConn.db.collection('providers');
};

// ==================== GET PROVIDER STATS (NEW) ====================
exports.getProviderStats = async (req, res, next) => {
  try {
    console.log('\n📊 Fetching provider statistics...');
    
    const providersCollection = getProviderCollection();

    // Get all counts in parallel for better performance
    const [
      totalProviders,
      activeProviders,
      inactiveProviders,
      pendingVerifications,
      approvedProviders,
      rejectedProviders,
      blockedProviders,
      availableProviders,
      todayProviders,
    ] = await Promise.all([
      providersCollection.countDocuments({}),
      providersCollection.countDocuments({ isActive: true }),
      providersCollection.countDocuments({ isActive: false }),
      providersCollection.countDocuments({ verificationStatus: 'pending' }),
      providersCollection.countDocuments({ 
        $or: [
          { verificationStatus: 'approved' },
          { verificationStatus: 'verified' }
        ]
      }),
      providersCollection.countDocuments({ verificationStatus: 'rejected' }),
      providersCollection.countDocuments({ isBlocked: true }),
      providersCollection.countDocuments({ isAvailable: true, isActive: true }),
      providersCollection.countDocuments({
        createdAt: {
          $gte: new Date(new Date().setHours(0, 0, 0, 0)),
        },
      }),
    ]);

    // Get profession distribution
    const professionDistribution = await providersCollection.aggregate([
      { $match: { profession: { $exists: true, $ne: null } } },
      { $group: { _id: '$profession', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]).toArray();

    // Get weekly signups (last 7 days)
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weeklySignups = await providersCollection.countDocuments({
      createdAt: { $gte: weekAgo },
    });

    // Get monthly signups (last 30 days)
    const monthAgo = new Date();
    monthAgo.setDate(monthAgo.getDate() - 30);
    const monthlySignups = await providersCollection.countDocuments({
      createdAt: { $gte: monthAgo },
    });

    // Calculate total earnings
    const earningsResult = await providersCollection.aggregate([
      {
        $group: {
          _id: null,
          totalEarnings: { $sum: '$totalEarnings' },
          todayEarnings: { $sum: '$todayEarnings' },
          avgRating: { $avg: '$rating' },
        },
      },
    ]).toArray();

    const earnings = earningsResult[0] || { totalEarnings: 0, todayEarnings: 0, avgRating: 0 };

    const stats = {
      totalProviders,
      activeProviders,
      inactiveProviders,
      pendingVerifications,
      approvedProviders,
      rejectedProviders,
      blockedProviders,
      availableProviders,
      todaySignups: todayProviders,
      weeklySignups,
      monthlySignups,
      totalEarnings: earnings.totalEarnings || 0,
      todayEarnings: earnings.todayEarnings || 0,
      avgRating: parseFloat((earnings.avgRating || 0).toFixed(2)),
      professionDistribution: professionDistribution.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {}),
    };

    console.log('✅ Provider stats:', stats);

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error('❌ Error fetching provider stats:', error);
    logger.error('Error fetching provider stats:', error);
    next(error);
  }
};

// ==================== GET RECENT PROVIDERS (NEW) ====================
exports.getRecentProviders = async (req, res, next) => {
  try {
    console.log('\n📋 Fetching recent providers...');
    
    const { limit = 5 } = req.query;
    const providersCollection = getProviderCollection();

    const providers = await providersCollection
      .find({})
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .toArray();

    const recentProviders = providers.map(p => ({
      id: p._id.toString(),
      _id: p._id.toString(),
      providerId: p.providerId || p._id.toString(),
      name: p.name,
      email: p.email,
      phone: p.phone,
      profession: p.profession || 'General',
      profileImage: p.profileImage || p.profilePhoto,
      verificationStatus: p.verificationStatus || 'pending',
      isActive: p.isActive !== false,
      isBlocked: p.isBlocked || false,
      rating: p.rating || 0,
      createdAt: p.createdAt,
    }));

    console.log('✅ Recent providers fetched:', recentProviders.length);

    res.json({
      success: true,
      data: {
        providers: recentProviders,
      },
    });
  } catch (error) {
    console.error('❌ Error fetching recent providers:', error);
    logger.error('Error fetching recent providers:', error);
    next(error);
  }
};

// ==================== GET ALL PROVIDERS ====================
exports.getAllProviders = async (req, res, next) => {
  try {
    console.log('\n📋 Fetching all providers...');
    
    const {
      page = 1,
      limit = 20,
      verificationStatus,
      isActive,
      isBlocked,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      profession,
    } = req.query;

    const providersCollection = getProviderCollection();

    // Build query
    const query = {};

    if (verificationStatus && verificationStatus !== 'all') {
      query.verificationStatus = verificationStatus;
    }

    if (isActive !== undefined && isActive !== 'all') {
      query.isActive = isActive === 'true';
    }

    if (isBlocked !== undefined && isBlocked !== 'all') {
      query.isBlocked = isBlocked === 'true';
    }

    if (profession && profession !== 'all') {
      query.profession = profession;
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
        { providerId: { $regex: search, $options: 'i' } },
        { profession: { $regex: search, $options: 'i' } },
      ];
    }

    // Count total
    const total = await providersCollection.countDocuments(query);
    console.log('📊 Total providers:', total);
    
    // Sort options
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'asc' ? 1 : -1;

    // Fetch providers
    const providers = await providersCollection
      .find(query)
      .sort(sortOptions)
      .skip((parseInt(page) - 1) * parseInt(limit))
      .limit(parseInt(limit))
      .toArray();

    console.log('📥 Fetched providers:', providers.length);

    // Transform providers
    const transformedProviders = providers.map(p => ({
      _id: p._id,
      providerId: p.providerId || p._id.toString(),
      name: p.name,
      email: p.email,
      phone: p.phone,
      profession: p.profession || p.service || 'N/A',
      profileImage: p.profileImage || p.profilePhoto,
      gender: p.gender,
      verificationStatus: p.verificationStatus || 'pending',
      isActive: p.isActive !== false,
      isBlocked: p.isBlocked || false,
      isAvailable: p.isAvailable || false,
      isOnline: p.isOnline || false,
      isAcceptingJobs: p.isAcceptingJobs || false,
      isVerified: p.isVerified || false,
      serviceRadius: p.serviceRadius || 10,
      location: p.location || { coordinates: [0, 0] },
      rating: p.rating || 0,
      totalRatings: p.totalRatings || 0,
      totalBookings: p.totalBookings || 0,
      completedBookings: p.completedBookings || 0,
      cancelledBookings: p.cancelledBookings || 0,
      todayEarnings: p.todayEarnings || 0,
      totalEarnings: p.totalEarnings || 0,
      blockedAt: p.blockedAt,
      blockedBy: p.blockedBy,
      blockReason: p.blockReason,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    }));

    const totalPages = Math.ceil(total / parseInt(limit));

    res.json({
      success: true,
      data: {
        providers: transformedProviders,
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
    console.error('Error fetching providers:', error);
    logger.error('Error fetching providers:', error);
    next(error);
  }
};

// ==================== GET PROVIDER BY ID ====================
exports.getProviderById = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const providersCollection = getProviderCollection();

    let provider = null;
    
    if (mongoose.Types.ObjectId.isValid(id)) {
      provider = await providersCollection.findOne({ 
        _id: new mongoose.Types.ObjectId(id) 
      });
    }
    
    if (!provider) {
      provider = await providersCollection.findOne({ providerId: id });
    }

    if (!provider) {
      throw ApiError.notFound('Provider not found');
    }

    // Transform provider data
    const transformedProvider = {
      _id: provider._id,
      providerId: provider.providerId || provider._id.toString(),
      name: provider.name,
      email: provider.email,
      phone: provider.phone,
      profession: provider.profession || 'N/A',
      profileImage: provider.profileImage || provider.profilePhoto,
      gender: provider.gender,
      dateOfBirth: provider.dateOfBirth,
      verificationStatus: provider.verificationStatus || 'pending',
      isActive: provider.isActive !== false,
      isBlocked: provider.isBlocked || false,
      isAvailable: provider.isAvailable || false,
      isOnline: provider.isOnline || false,
      isAcceptingJobs: provider.isAcceptingJobs || false,
      isVerified: provider.isVerified || false,
      serviceRadius: provider.serviceRadius || 10,
      location: provider.location || { coordinates: [0, 0] },
      rating: provider.rating || 0,
      totalRatings: provider.totalRatings || 0,
      totalBookings: provider.totalBookings || 0,
      completedBookings: provider.completedBookings || 0,
      cancelledBookings: provider.cancelledBookings || 0,
      todayEarnings: provider.todayEarnings || 0,
      totalEarnings: provider.totalEarnings || 0,
      walletBalance: provider.walletBalance || 0,
      blockedAt: provider.blockedAt,
      blockedBy: provider.blockedBy,
      blockReason: provider.blockReason,
      verifiedAt: provider.verifiedAt,
      verifiedBy: provider.verifiedBy,
      verificationNotes: provider.verificationNotes,
      rejectedAt: provider.rejectedAt,
      rejectedBy: provider.rejectedBy,
      rejectionReason: provider.rejectionReason,
      lastActiveAt: provider.lastActiveAt,
      createdAt: provider.createdAt,
      updatedAt: provider.updatedAt,
    };

    res.json({
      success: true,
      data: {
        provider: transformedProvider,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ==================== TOGGLE PROVIDER STATUS ====================
exports.toggleProviderStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    const providersCollection = getProviderCollection();

    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw ApiError.badRequest('Invalid provider ID');
    }

    const result = await providersCollection.updateOne(
      { _id: new mongoose.Types.ObjectId(id) },
      { 
        $set: { 
          isActive: isActive,
          updatedAt: new Date(),
        } 
      }
    );

    if (result.matchedCount === 0) {
      throw ApiError.notFound('Provider not found');
    }

    const provider = await providersCollection.findOne({ 
      _id: new mongoose.Types.ObjectId(id) 
    });

    logger.info(`Provider status updated: ${id} - isActive: ${isActive}`);

    res.json({
      success: true,
      message: `Provider ${isActive ? 'activated' : 'deactivated'} successfully`,
      data: {
        provider,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ==================== BLOCK/UNBLOCK PROVIDER (NEW) ====================
exports.blockProvider = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { isBlocked, reason } = req.body;
    const adminId = req.admin?._id || req.admin?.id;

    console.log(`\n🚫 ${isBlocked ? 'Blocking' : 'Unblocking'} provider: ${id}`);

    const providersCollection = getProviderCollection();

    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw ApiError.badRequest('Invalid provider ID');
    }

    // Check if provider exists
    const existingProvider = await providersCollection.findOne({ 
      _id: new mongoose.Types.ObjectId(id) 
    });

    if (!existingProvider) {
      throw ApiError.notFound('Provider not found');
    }

    const updateData = {
      isBlocked: isBlocked,
      updatedAt: new Date(),
    };

    if (isBlocked) {
      updateData.blockedAt = new Date();
      updateData.blockedBy = adminId;
      updateData.blockReason = reason || 'No reason provided';
      updateData.isActive = false; // Also deactivate when blocking
      updateData.isAvailable = false;
      updateData.isOnline = false;
      updateData.isAcceptingJobs = false;
    } else {
      updateData.blockedAt = null;
      updateData.blockedBy = null;
      updateData.blockReason = null;
      // Don't automatically reactivate - admin should do that separately
    }

    const result = await providersCollection.updateOne(
      { _id: new mongoose.Types.ObjectId(id) },
      { $set: updateData }
    );

    if (result.matchedCount === 0) {
      throw ApiError.notFound('Provider not found');
    }

    const provider = await providersCollection.findOne({ 
      _id: new mongoose.Types.ObjectId(id) 
    });

    logger.info(`Provider ${isBlocked ? 'blocked' : 'unblocked'}: ${id} by admin: ${adminId}`);

    res.json({
      success: true,
      message: `Provider ${isBlocked ? 'blocked' : 'unblocked'} successfully`,
      data: {
        provider: {
          _id: provider._id,
          providerId: provider.providerId || provider._id.toString(),
          name: provider.name,
          email: provider.email,
          isBlocked: provider.isBlocked,
          isActive: provider.isActive,
          blockReason: provider.blockReason,
          blockedAt: provider.blockedAt,
        },
      },
    });
  } catch (error) {
    console.error('❌ Error blocking provider:', error);
    next(error);
  }
};

// ==================== UPDATE PROVIDER ====================
exports.updateProvider = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const providersCollection = getProviderCollection();

    // Remove protected fields
    delete updates._id;
    delete updates.providerId;
    delete updates.createdAt;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw ApiError.badRequest('Invalid provider ID');
    }

    updates.updatedAt = new Date();

    const result = await providersCollection.updateOne(
      { _id: new mongoose.Types.ObjectId(id) },
      { $set: updates }
    );

    if (result.matchedCount === 0) {
      throw ApiError.notFound('Provider not found');
    }

    const provider = await providersCollection.findOne({ 
      _id: new mongoose.Types.ObjectId(id) 
    });

    logger.info(`Provider updated: ${id}`);

    res.json({
      success: true,
      message: 'Provider updated successfully',
      data: {
        provider,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ==================== DELETE PROVIDER ====================
exports.deleteProvider = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { permanent = false } = req.query;
    const adminId = req.admin?._id || req.admin?.id;

    console.log(`\n🗑️ Deleting provider: ${id} | Permanent: ${permanent}`);

    const providersCollection = getProviderCollection();

    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw ApiError.badRequest('Invalid provider ID');
    }

    // Check if provider exists
    const existingProvider = await providersCollection.findOne({ 
      _id: new mongoose.Types.ObjectId(id) 
    });

    if (!existingProvider) {
      throw ApiError.notFound('Provider not found');
    }

    if (permanent === 'true' || permanent === true) {
      // Permanent delete
      const result = await providersCollection.deleteOne({ 
        _id: new mongoose.Types.ObjectId(id) 
      });

      if (result.deletedCount === 0) {
        throw ApiError.notFound('Provider not found');
      }

      logger.info(`Provider permanently deleted: ${id} by admin: ${adminId}`);

      res.json({
        success: true,
        message: 'Provider permanently deleted',
        data: {
          deletedProvider: {
            _id: existingProvider._id,
            providerId: existingProvider.providerId,
            name: existingProvider.name,
            email: existingProvider.email,
          },
        },
      });
    } else {
      // Soft delete - mark as deleted but keep record
      const result = await providersCollection.updateOne(
        { _id: new mongoose.Types.ObjectId(id) },
        { 
          $set: {
            isDeleted: true,
            deletedAt: new Date(),
            deletedBy: adminId,
            isActive: false,
            isAvailable: false,
            isOnline: false,
            isAcceptingJobs: false,
            updatedAt: new Date(),
          }
        }
      );

      if (result.matchedCount === 0) {
        throw ApiError.notFound('Provider not found');
      }

      logger.info(`Provider soft deleted: ${id} by admin: ${adminId}`);

      res.json({
        success: true,
        message: 'Provider deleted successfully (can be restored)',
        data: {
          deletedProvider: {
            _id: existingProvider._id,
            providerId: existingProvider.providerId,
            name: existingProvider.name,
            email: existingProvider.email,
          },
        },
      });
    }
  } catch (error) {
    console.error('❌ Error deleting provider:', error);
    next(error);
  }
};

// ==================== RESTORE DELETED PROVIDER (NEW) ====================
exports.restoreProvider = async (req, res, next) => {
  try {
    const { id } = req.params;
    const adminId = req.admin?._id || req.admin?.id;

    console.log(`\n♻️ Restoring provider: ${id}`);

    const providersCollection = getProviderCollection();

    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw ApiError.badRequest('Invalid provider ID');
    }

    const result = await providersCollection.updateOne(
      { _id: new mongoose.Types.ObjectId(id), isDeleted: true },
      { 
        $set: {
          isDeleted: false,
          deletedAt: null,
          deletedBy: null,
          restoredAt: new Date(),
          restoredBy: adminId,
          updatedAt: new Date(),
        }
      }
    );

    if (result.matchedCount === 0) {
      throw ApiError.notFound('Deleted provider not found');
    }

    const provider = await providersCollection.findOne({ 
      _id: new mongoose.Types.ObjectId(id) 
    });

    logger.info(`Provider restored: ${id} by admin: ${adminId}`);

    res.json({
      success: true,
      message: 'Provider restored successfully',
      data: {
        provider: {
          _id: provider._id,
          providerId: provider.providerId || provider._id.toString(),
          name: provider.name,
          email: provider.email,
          isActive: provider.isActive,
          isDeleted: provider.isDeleted,
        },
      },
    });
  } catch (error) {
    console.error('❌ Error restoring provider:', error);
    next(error);
  }
};

// ==================== DELETE MULTIPLE PROVIDERS (NEW) ====================
exports.deleteMultipleProviders = async (req, res, next) => {
  try {
    const { providerIds, permanent = false } = req.body;
    const adminId = req.admin?._id || req.admin?.id;

    console.log(`\n🗑️ Deleting multiple providers: ${providerIds?.length} | Permanent: ${permanent}`);

    if (!providerIds || !Array.isArray(providerIds) || providerIds.length === 0) {
      throw ApiError.badRequest('Provider IDs array is required');
    }

    const providersCollection = getProviderCollection();

    const objectIds = providerIds
      .filter(id => mongoose.Types.ObjectId.isValid(id))
      .map(id => new mongoose.Types.ObjectId(id));

    if (objectIds.length === 0) {
      throw ApiError.badRequest('No valid provider IDs provided');
    }

    let result;

    if (permanent) {
      result = await providersCollection.deleteMany({
        _id: { $in: objectIds }
      });

      logger.info(`${result.deletedCount} providers permanently deleted by admin: ${adminId}`);

      res.json({
        success: true,
        message: `${result.deletedCount} providers permanently deleted`,
        data: {
          deletedCount: result.deletedCount,
        },
      });
    } else {
      result = await providersCollection.updateMany(
        { _id: { $in: objectIds } },
        {
          $set: {
            isDeleted: true,
            deletedAt: new Date(),
            deletedBy: adminId,
            isActive: false,
            isAvailable: false,
            isOnline: false,
            isAcceptingJobs: false,
            updatedAt: new Date(),
          }
        }
      );

      logger.info(`${result.modifiedCount} providers soft deleted by admin: ${adminId}`);

      res.json({
        success: true,
        message: `${result.modifiedCount} providers deleted (can be restored)`,
        data: {
          deletedCount: result.modifiedCount,
        },
      });
    }
  } catch (error) {
    console.error('❌ Error deleting multiple providers:', error);
    next(error);
  }
};