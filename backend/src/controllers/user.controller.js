const { getUserConnection } = require('../config/database');
const logger = require('../utils/logger');
const mongoose = require('mongoose');

// Helper to get the users collection
const getUserCollection = () => {
  const userConn = getUserConnection();
  if (!userConn) {
    throw new Error('User database not connected. Make sure USER_DB is configured.');
  }
  return userConn.db.collection('users');
};

// ===== GET ALL USERS =====
exports.getAllUsers = async (req, res, next) => {
  try {
    console.log('\n📋 Fetching all users...');
    console.log('Query params:', req.query);
    
    const {
      page = 1,
      limit = 20,
      search,
      isActive,
      gender,
      authProvider,
      isEmailVerified,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      startDate,
      endDate,
    } = req.query;

    const usersCollection = getUserCollection();

    // Build query
    const query = {
      deletedAt: null,
    };

    if (isActive !== undefined && isActive !== 'all') {
      query.isActive = isActive === 'true';
    }

    if (gender && gender !== 'all') {
      query.gender = gender;
    }

    if (authProvider && authProvider !== 'all') {
      query.authProvider = authProvider;
    }

    if (isEmailVerified !== undefined && isEmailVerified !== 'all') {
      query.isEmailVerified = isEmailVerified === 'true';
    }

    if (search && search.trim()) {
      query.$or = [
        { name: { $regex: search.trim(), $options: 'i' } },
        { email: { $regex: search.trim(), $options: 'i' } },
        { phone: { $regex: search.trim(), $options: 'i' } },
      ];
    }

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) {
        query.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        const endDateTime = new Date(endDate);
        endDateTime.setHours(23, 59, 59, 999);
        query.createdAt.$lte = endDateTime;
      }
    }

    console.log('📊 Query:', JSON.stringify(query, null, 2));

    const total = await usersCollection.countDocuments(query);
    console.log('📊 Total users matching query:', total);
    
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'asc' ? 1 : -1;

    const users = await usersCollection
      .find(query)
      .project({
        password: 0,
        resetPasswordOTP: 0,
        resetPasswordOTPExpiry: 0,
        __v: 0,
      })
      .sort(sortOptions)
      .skip((parseInt(page) - 1) * parseInt(limit))
      .limit(parseInt(limit))
      .toArray();

    console.log('📥 Fetched users:', users.length);

    const transformedUsers = users.map(user => ({
      id: user._id.toString(),
      _id: user._id.toString(),
      name: user.name || 'N/A',
      email: user.email || 'N/A',
      phone: user.phone || null,
      gender: user.gender || null,
      dateOfBirth: user.dateOfBirth || null,
      address: user.address || null,
      profilePicture: user.profilePicture || null,
      authProvider: user.authProvider || 'local',
      isEmailVerified: user.isEmailVerified || false,
      isActive: user.isActive !== false,
      role: user.role || 'user',
      lastLogin: user.lastLogin || null,
      createdAt: user.createdAt || new Date().toISOString(),
      updatedAt: user.updatedAt || new Date().toISOString(),
    }));

    const totalPages = Math.ceil(total / parseInt(limit));

    res.json({
      success: true,
      data: {
        users: transformedUsers,
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
    console.error('❌ Error fetching users:', error);
    logger.error('Error fetching users:', error);
    next(error);
  }
};

// ===== GET USER STATISTICS =====
exports.getUserStats = async (req, res, next) => {
  try {
    console.log('\n📊 Fetching user statistics...');
    
    const usersCollection = getUserCollection();

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const thisWeekStart = new Date(today);
    thisWeekStart.setDate(thisWeekStart.getDate() - thisWeekStart.getDay());

    const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);

    const [
      totalUsers,
      activeUsers,
      inactiveUsers,
      verifiedUsers,
      unverifiedUsers,
      todaySignups,
      weeklySignups,
      monthlySignups,
      genderStats,
      authProviderStats,
      deletedUsers,
    ] = await Promise.all([
      usersCollection.countDocuments({ deletedAt: null }),
      usersCollection.countDocuments({ isActive: true, deletedAt: null }),
      usersCollection.countDocuments({ isActive: false, deletedAt: null }),
      usersCollection.countDocuments({ isEmailVerified: true, deletedAt: null }),
      usersCollection.countDocuments({ isEmailVerified: false, deletedAt: null }),
      usersCollection.countDocuments({ createdAt: { $gte: today }, deletedAt: null }),
      usersCollection.countDocuments({ createdAt: { $gte: thisWeekStart }, deletedAt: null }),
      usersCollection.countDocuments({ createdAt: { $gte: thisMonthStart }, deletedAt: null }),
      usersCollection.aggregate([
        { $match: { deletedAt: null } },
        { $group: { _id: '$gender', count: { $sum: 1 } } },
      ]).toArray(),
      usersCollection.aggregate([
        { $match: { deletedAt: null } },
        { $group: { _id: '$authProvider', count: { $sum: 1 } } },
      ]).toArray(),
      usersCollection.countDocuments({ deletedAt: { $ne: null } }),
    ]);

    const genderDistribution = {};
    genderStats.forEach(stat => {
      genderDistribution[stat._id || 'Not Specified'] = stat.count;
    });

    const authProviderDistribution = {};
    authProviderStats.forEach(stat => {
      authProviderDistribution[stat._id || 'local'] = stat.count;
    });

    console.log('📊 User stats calculated:', {
      totalUsers,
      activeUsers,
      todaySignups,
      verifiedUsers,
    });

    res.json({
      success: true,
      data: {
        totalUsers,
        activeUsers,
        inactiveUsers,
        verifiedUsers,
        unverifiedUsers,
        todaySignups,
        weeklySignups,
        monthlySignups,
        deletedUsers,
        genderDistribution,
        authProviderDistribution,
      },
    });
  } catch (error) {
    console.error('❌ Error fetching user stats:', error);
    logger.error('Error fetching user stats:', error);
    next(error);
  }
};

// ===== GET USER BY ID =====
exports.getUserById = async (req, res, next) => {
  try {
    const { id } = req.params;
    console.log('\n📋 Fetching user by ID:', id);
    
    const usersCollection = getUserCollection();

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID format',
      });
    }

    const user = await usersCollection.findOne(
      { _id: new mongoose.Types.ObjectId(id) },
      { 
        projection: { 
          password: 0, 
          resetPasswordOTP: 0, 
          resetPasswordOTPExpiry: 0,
          __v: 0,
        } 
      }
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    const transformedUser = {
      id: user._id.toString(),
      _id: user._id.toString(),
      name: user.name,
      email: user.email,
      phone: user.phone,
      gender: user.gender,
      dateOfBirth: user.dateOfBirth,
      address: user.address,
      profilePicture: user.profilePicture,
      authProvider: user.authProvider,
      isEmailVerified: user.isEmailVerified,
      isActive: user.isActive,
      role: user.role,
      lastLogin: user.lastLogin,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      deletedAt: user.deletedAt,
    };

    console.log('✅ User found:', user.email);

    res.json({
      success: true,
      data: {
        user: transformedUser,
      },
    });
  } catch (error) {
    console.error('❌ Error fetching user:', error);
    next(error);
  }
};

// ===== UPDATE USER =====
exports.updateUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    console.log('\n📝 Updating user:', id);
    console.log('Updates:', updates);

    const usersCollection = getUserCollection();

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID format',
      });
    }

    const protectedFields = ['_id', 'email', 'password', 'googleId', 'resetPasswordOTP', 'resetPasswordOTPExpiry', 'createdAt'];
    protectedFields.forEach(field => delete updates[field]);

    const allowedFields = ['name', 'phone', 'gender', 'dateOfBirth', 'address', 'profilePicture', 'isActive', 'isEmailVerified', 'role'];
    const sanitizedUpdates = {};
    
    for (const key of allowedFields) {
      if (updates[key] !== undefined) {
        sanitizedUpdates[key] = updates[key];
      }
    }

    if (Object.keys(sanitizedUpdates).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid fields to update',
      });
    }

    sanitizedUpdates.updatedAt = new Date();

    const result = await usersCollection.updateOne(
      { _id: new mongoose.Types.ObjectId(id) },
      { $set: sanitizedUpdates }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    const user = await usersCollection.findOne(
      { _id: new mongoose.Types.ObjectId(id) },
      { 
        projection: { 
          password: 0, 
          resetPasswordOTP: 0, 
          resetPasswordOTPExpiry: 0 
        } 
      }
    );

    logger.info(`User updated: ${id}`, { updates: Object.keys(sanitizedUpdates) });

    console.log('✅ User updated successfully');

    res.json({
      success: true,
      message: 'User updated successfully',
      data: {
        user: {
          id: user._id.toString(),
          ...user,
        },
      },
    });
  } catch (error) {
    console.error('❌ Error updating user:', error);
    next(error);
  }
};

// ===== TOGGLE USER STATUS =====
exports.toggleUserStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    console.log('\n🔄 Toggling user status:', id, '-> isActive:', isActive);

    if (typeof isActive !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'isActive must be a boolean value',
      });
    }

    const usersCollection = getUserCollection();

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID format',
      });
    }

    const result = await usersCollection.updateOne(
      { _id: new mongoose.Types.ObjectId(id) },
      { 
        $set: { 
          isActive: isActive,
          updatedAt: new Date(),
        } 
      }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    const user = await usersCollection.findOne(
      { _id: new mongoose.Types.ObjectId(id) },
      { projection: { password: 0 } }
    );

    logger.info(`User status updated: ${id} - isActive: ${isActive}`);

    console.log(`✅ User ${isActive ? 'activated' : 'deactivated'} successfully`);

    res.json({
      success: true,
      message: `User ${isActive ? 'activated' : 'deactivated'} successfully`,
      data: {
        user: {
          id: user._id.toString(),
          ...user,
        },
      },
    });
  } catch (error) {
    console.error('❌ Error toggling user status:', error);
    next(error);
  }
};

// ===== DELETE USER (Soft Delete or Permanent Delete) =====
exports.deleteUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { permanent } = req.query;

    console.log('\n🗑️ Delete User Request:');
    console.log('   User ID:', id);
    console.log('   Permanent:', permanent);

    const usersCollection = getUserCollection();

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID format',
      });
    }

    // Check if user exists first
    const existingUser = await usersCollection.findOne({ 
      _id: new mongoose.Types.ObjectId(id) 
    });

    if (!existingUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    console.log('   User found:', existingUser.email);

    if (permanent === 'true') {
      // ===== PERMANENT DELETE - Remove from database completely =====
      console.log('   Performing PERMANENT DELETE...');
      
      const result = await usersCollection.deleteOne({ 
        _id: new mongoose.Types.ObjectId(id) 
      });

      if (result.deletedCount === 0) {
        return res.status(500).json({
          success: false,
          message: 'Failed to delete user',
        });
      }

      logger.info(`User PERMANENTLY DELETED: ${id} (${existingUser.email})`);
      console.log('✅ User permanently deleted from database');

      res.json({
        success: true,
        message: 'User permanently deleted from database',
        data: {
          deletedUser: {
            id: existingUser._id.toString(),
            email: existingUser.email,
            name: existingUser.name,
          }
        }
      });
    } else {
      // ===== SOFT DELETE - Just mark as deleted =====
      console.log('   Performing SOFT DELETE...');
      
      const result = await usersCollection.updateOne(
        { _id: new mongoose.Types.ObjectId(id) },
        { 
          $set: { 
            deletedAt: new Date(),
            isActive: false,
            updatedAt: new Date(),
          } 
        }
      );

      if (result.matchedCount === 0) {
        return res.status(500).json({
          success: false,
          message: 'Failed to delete user',
        });
      }

      logger.info(`User SOFT DELETED: ${id} (${existingUser.email})`);
      console.log('✅ User soft deleted (marked as deleted)');

      res.json({
        success: true,
        message: 'User deleted successfully (can be restored)',
        data: {
          deletedUser: {
            id: existingUser._id.toString(),
            email: existingUser.email,
            name: existingUser.name,
          }
        }
      });
    }
  } catch (error) {
    console.error('❌ Error deleting user:', error);
    logger.error('Error deleting user:', error);
    next(error);
  }
};

// ===== DELETE MULTIPLE USERS (Soft Delete or Permanent Delete) =====
exports.deleteMultipleUsers = async (req, res, next) => {
  try {
    const { userIds, permanent } = req.body;

    console.log('\n🗑️ Delete Multiple Users Request:');
    console.log('   User IDs:', userIds);
    console.log('   Permanent:', permanent);

    // Validate input
    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'userIds array is required and cannot be empty',
      });
    }

    const usersCollection = getUserCollection();

    // Convert string IDs to ObjectIds, filtering out invalid ones
    const objectIds = userIds
      .filter(id => mongoose.Types.ObjectId.isValid(id))
      .map(id => new mongoose.Types.ObjectId(id));

    if (objectIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid user IDs provided',
      });
    }

    console.log(`   Valid IDs: ${objectIds.length} of ${userIds.length}`);

    // Get users before deletion for logging
    const usersToDelete = await usersCollection
      .find({ _id: { $in: objectIds } })
      .project({ email: 1, name: 1 })
      .toArray();

    if (usersToDelete.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No users found with the provided IDs',
      });
    }

    console.log(`   Users found: ${usersToDelete.length}`);

    let result;
    let deletedCount;

    if (permanent === true) {
      // ===== PERMANENT DELETE - Remove from database completely =====
      console.log('   Performing PERMANENT DELETE...');
      
      result = await usersCollection.deleteMany({ 
        _id: { $in: objectIds } 
      });

      deletedCount = result.deletedCount;

      logger.info(`${deletedCount} users PERMANENTLY DELETED`, {
        userIds: usersToDelete.map(u => u._id.toString()),
        emails: usersToDelete.map(u => u.email),
      });

      console.log(`✅ ${deletedCount} users permanently deleted from database`);

      res.json({
        success: true,
        message: `${deletedCount} user(s) permanently deleted from database`,
        data: {
          deletedCount,
          deletedUsers: usersToDelete.map(u => ({
            id: u._id.toString(),
            email: u.email,
            name: u.name,
          })),
        },
      });
    } else {
      // ===== SOFT DELETE - Just mark as deleted =====
      console.log('   Performing SOFT DELETE...');
      
      result = await usersCollection.updateMany(
        { _id: { $in: objectIds } },
        { 
          $set: { 
            deletedAt: new Date(),
            isActive: false,
            updatedAt: new Date(),
          } 
        }
      );

      deletedCount = result.modifiedCount;

      logger.info(`${deletedCount} users SOFT DELETED`, {
        userIds: usersToDelete.map(u => u._id.toString()),
        emails: usersToDelete.map(u => u.email),
      });

      console.log(`✅ ${deletedCount} users soft deleted (marked as deleted)`);

      res.json({
        success: true,
        message: `${deletedCount} user(s) deleted successfully (can be restored)`,
        data: {
          deletedCount,
          deletedUsers: usersToDelete.map(u => ({
            id: u._id.toString(),
            email: u.email,
            name: u.name,
          })),
        },
      });
    }
  } catch (error) {
    console.error('❌ Error deleting multiple users:', error);
    logger.error('Error deleting multiple users:', error);
    next(error);
  }
};

// ===== RESTORE USER =====
exports.restoreUser = async (req, res, next) => {
  try {
    const { id } = req.params;

    console.log('\n♻️ Restoring user:', id);

    const usersCollection = getUserCollection();

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID format',
      });
    }

    const result = await usersCollection.updateOne(
      { _id: new mongoose.Types.ObjectId(id) },
      { 
        $set: { 
          deletedAt: null,
          isActive: true,
          updatedAt: new Date(),
        } 
      }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    const user = await usersCollection.findOne(
      { _id: new mongoose.Types.ObjectId(id) },
      { projection: { password: 0 } }
    );

    logger.info(`User restored: ${id}`);

    console.log('✅ User restored successfully');

    res.json({
      success: true,
      message: 'User restored successfully',
      data: {
        user: {
          id: user._id.toString(),
          ...user,
        },
      },
    });
  } catch (error) {
    console.error('❌ Error restoring user:', error);
    next(error);
  }
};

// ===== EXPORT USERS TO CSV =====
exports.exportUsersCSV = async (req, res, next) => {
  try {
    console.log('\n📤 Exporting users to CSV...');
    
    const { isActive, startDate, endDate } = req.query;

    const usersCollection = getUserCollection();

    const query = { deletedAt: null };

    if (isActive !== undefined && isActive !== 'all') {
      query.isActive = isActive === 'true';
    }

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) {
        const endDateTime = new Date(endDate);
        endDateTime.setHours(23, 59, 59, 999);
        query.createdAt.$lte = endDateTime;
      }
    }

    const users = await usersCollection
      .find(query)
      .project({
        name: 1,
        email: 1,
        phone: 1,
        gender: 1,
        dateOfBirth: 1,
        address: 1,
        authProvider: 1,
        isEmailVerified: 1,
        isActive: 1,
        createdAt: 1,
        lastLogin: 1,
      })
      .sort({ createdAt: -1 })
      .toArray();

    console.log(`📥 Found ${users.length} users for export`);

    res.json({
      success: true,
      data: {
        users: users.map(u => ({
          id: u._id.toString(),
          name: u.name || '',
          email: u.email || '',
          phone: u.phone || '',
          gender: u.gender || '',
          dateOfBirth: u.dateOfBirth ? new Date(u.dateOfBirth).toISOString().split('T')[0] : '',
          address: u.address || '',
          authProvider: u.authProvider || 'local',
          isEmailVerified: u.isEmailVerified ? 'Yes' : 'No',
          isActive: u.isActive ? 'Active' : 'Inactive',
          createdAt: u.createdAt ? new Date(u.createdAt).toISOString() : '',
          lastLogin: u.lastLogin ? new Date(u.lastLogin).toISOString() : 'Never',
        })),
        total: users.length,
      },
    });
  } catch (error) {
    console.error('❌ Error exporting users:', error);
    next(error);
  }
};