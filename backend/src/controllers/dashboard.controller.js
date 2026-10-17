const { getProviderConnection, getUserConnection } = require('../config/database');
const logger = require('../utils/logger');

// Get dashboard stats
exports.getStats = async (req, res, next) => {
  try {
    console.log('\n📊 Fetching dashboard stats...');
    
    const providerConn = getProviderConnection();
    const userConn = getUserConnection();
    
    const providersCollection = providerConn.db.collection('providers');
    const verificationsCollection = providerConn.db.collection('provider_verifications');
    
    // Get today's date for user stats
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Provider queries
    const [
      totalProviders,
      activeProviders,
      pendingVerifications,
      approvedProviders,
      rejectedVerifications,
    ] = await Promise.all([
      providersCollection.countDocuments(),
      providersCollection.countDocuments({ isActive: true }),
      verificationsCollection.countDocuments({ status: { $in: ['pending', 'submitted', 'under_review'] } }),
      providersCollection.countDocuments({ verificationStatus: { $in: ['approved', 'verified'] } }),
      verificationsCollection.countDocuments({ status: 'rejected' }),
    ]);

    // User queries (if user connection exists)
    let totalUsers = 0;
    let activeUsers = 0;
    let todaySignups = 0;
    let verifiedUsers = 0;

    if (userConn) {
      try {
        const usersCollection = userConn.db.collection('users');
        
        [totalUsers, activeUsers, todaySignups, verifiedUsers] = await Promise.all([
          usersCollection.countDocuments({ deletedAt: null }),
          usersCollection.countDocuments({ isActive: true, deletedAt: null }),
          usersCollection.countDocuments({ createdAt: { $gte: today }, deletedAt: null }),
          usersCollection.countDocuments({ isEmailVerified: true, deletedAt: null }),
        ]);
      } catch (userError) {
        console.log('⚠️ Could not fetch user stats:', userError.message);
      }
    }

    console.log('📊 Dashboard stats:', {
      totalProviders,
      activeProviders,
      pendingVerifications,
      approvedProviders,
      rejectedVerifications,
      totalUsers,
      activeUsers,
      todaySignups,
      verifiedUsers,
    });

    res.json({
      success: true,
      data: {
        // Provider stats
        totalProviders,
        activeProviders,
        pendingVerifications,
        approvedProviders,
        rejectedVerifications,
        // User stats
        totalUsers,
        activeUsers,
        todaySignups,
        verifiedUsers,
      },
    });
  } catch (error) {
    console.error('❌ Error fetching dashboard stats:', error);
    logger.error('Error fetching dashboard stats:', error);
    next(error);
  }
};