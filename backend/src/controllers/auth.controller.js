const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { getAdminModel, getUserConnection } = require('../config/database');
const ApiError = require('../utils/ApiError');
const logger = require('../utils/logger');

// ===== GENERATE TOKENS =====
const generateTokens = (admin) => {
  const accessSecret = process.env.JWT_ACCESS_SECRET || 'default-access-secret-change-me';
  const refreshSecret = process.env.JWT_REFRESH_SECRET || 'default-refresh-secret-change-me';

  const accessToken = jwt.sign(
    { 
      adminId: admin._id.toString(),
      email: admin.email,
      role: admin.role,
      name: admin.name,
      type: 'access'
    },
    accessSecret,
    { expiresIn: process.env.JWT_ACCESS_EXPIRY || '24h' }
  );

  const refreshToken = jwt.sign(
    { 
      adminId: admin._id.toString(),
      email: admin.email,
      role: admin.role,
      name: admin.name,
      type: 'refresh'
    },
    refreshSecret,
    { expiresIn: process.env.JWT_REFRESH_EXPIRY || '7d' }
  );

  return { accessToken, refreshToken };
};

// ===== LOGIN =====
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    console.log('\n🔐 ===== LOGIN REQUEST =====');
    console.log('📧 Email:', email);

    // Validate input
    if (!email || !password) {
      console.log('❌ Missing credentials');
      throw ApiError.badRequest('Email and password are required');
    }

    // Get admin model
    const Admin = getAdminModel();
    console.log('✓ Admin model loaded');

    // Find admin by email
    const admin = await Admin.findOne({ 
      email: email.toLowerCase().trim() 
    }).select('+password');

    if (!admin) {
      console.log('❌ Admin not found:', email);
      throw ApiError.unauthorized('Invalid email or password');
    }

    console.log('✓ Admin found:', admin.email);

    // Check if admin is active
    if (!admin.isActive) {
      console.log('❌ Admin account inactive');
      throw ApiError.forbidden('Account is deactivated. Contact super admin.');
    }

    console.log('✓ Admin account is active');

    // Verify password using the model method
    const isPasswordValid = await admin.comparePassword(password);

    if (!isPasswordValid) {
      console.log('❌ Invalid password');
      throw ApiError.unauthorized('Invalid email or password');
    }

    console.log('✓ Password verified');

    // Generate tokens
    const { accessToken, refreshToken } = generateTokens(admin);
    console.log('✓ Tokens generated');

    // Update admin record with last login and refresh token
    await Admin.updateOne(
      { _id: admin._id },
      { 
        $set: { 
          lastLogin: new Date(),
          refreshToken: refreshToken,
        }
      }
    );
    console.log('✓ Last login updated');

    logger.info(`Admin logged in: ${admin.email}`);
    console.log('✅ Login successful for:', admin.email);

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        admin: {
          _id: admin._id.toString(),
          id: admin._id.toString(),
          email: admin.email,
          name: admin.name,
          role: admin.role,
          permissions: admin.permissions || [],
          isActive: admin.isActive,
          lastLogin: admin.lastLogin,
          createdAt: admin.createdAt,
        },
        tokens: {
          accessToken,
          refreshToken,
        }
      }
    });
  } catch (error) {
    console.error('❌ Login error:', error.message);
    logger.error('Login error:', error);
    next(error);
  }
};

// ===== REFRESH TOKEN =====
exports.refreshToken = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;

    console.log('\n🔄 ===== REFRESH TOKEN REQUEST =====');

    if (!refreshToken) {
      throw ApiError.badRequest('Refresh token is required');
    }

    const refreshSecret = process.env.JWT_REFRESH_SECRET || 'default-refresh-secret-change-me';

    // Verify refresh token
    let decoded;
    try {
      decoded = jwt.verify(refreshToken, refreshSecret);
      console.log('✓ Refresh token verified for:', decoded.email);
    } catch (error) {
      console.log('❌ Invalid refresh token');
      if (error.name === 'TokenExpiredError') {
        throw ApiError.unauthorized('Refresh token expired');
      }
      throw ApiError.unauthorized('Invalid refresh token');
    }

    if (decoded.type !== 'refresh') {
      throw ApiError.unauthorized('Invalid token type');
    }

    const Admin = getAdminModel();

    // Find admin
    const admin = await Admin.findById(decoded.adminId);

    if (!admin) {
      console.log('❌ Admin not found');
      throw ApiError.unauthorized('Admin not found');
    }

    if (!admin.isActive) {
      console.log('❌ Admin account inactive');
      throw ApiError.forbidden('Account is deactivated');
    }

    // Verify stored refresh token matches (optional security check)
    if (admin.refreshToken && admin.refreshToken !== refreshToken) {
      console.log('⚠️ Refresh token mismatch');
      throw ApiError.unauthorized('Invalid refresh token');
    }

    // Generate new tokens
    const tokens = generateTokens(admin);

    // Update refresh token in database
    await Admin.updateOne(
      { _id: admin._id },
      { $set: { refreshToken: tokens.refreshToken } }
    );

    logger.info(`Tokens refreshed: ${admin.email}`);
    console.log('✅ Tokens refreshed for:', admin.email);

    res.json({
      success: true,
      message: 'Tokens refreshed successfully',
      data: {
        tokens,
      }
    });
  } catch (error) {
    console.error('❌ Refresh token error:', error.message);
    logger.error('Refresh token error:', error);
    next(error);
  }
};

// ===== GET CURRENT ADMIN =====
exports.getCurrentAdmin = async (req, res, next) => {
  try {
    console.log('\n👤 ===== GET CURRENT ADMIN REQUEST =====');
    
    const adminId = req.admin?.adminId || req.admin?._id || req.admin?.id;
    console.log('   Admin ID:', adminId);

    if (!adminId) {
      throw ApiError.unauthorized('Admin not authenticated');
    }

    const Admin = getAdminModel();

    const admin = await Admin.findById(adminId).select('-password -refreshToken');

    if (!admin) {
      console.log('❌ Admin not found');
      throw ApiError.notFound('Admin not found');
    }

    console.log('✅ Admin data retrieved:', admin.email);

    res.json({
      success: true,
      data: {
        admin: {
          _id: admin._id.toString(),
          id: admin._id.toString(),
          email: admin.email,
          name: admin.name,
          role: admin.role,
          permissions: admin.permissions || [],
          isActive: admin.isActive,
          lastLogin: admin.lastLogin,
          createdAt: admin.createdAt,
          updatedAt: admin.updatedAt,
        }
      }
    });
  } catch (error) {
    console.error('❌ Get current admin error:', error.message);
    logger.error('Get current admin error:', error);
    next(error);
  }
};

// ===== LOGOUT =====
exports.logout = async (req, res, next) => {
  try {
    console.log('\n🚪 ===== LOGOUT REQUEST =====');
    
    const adminId = req.admin?.adminId || req.admin?._id || req.admin?.id;
    console.log('   Admin ID:', adminId);

    if (!adminId) {
      throw ApiError.unauthorized('Admin not authenticated');
    }

    const Admin = getAdminModel();

    // Clear refresh token from database
    await Admin.updateOne(
      { _id: adminId },
      { $set: { refreshToken: null } }
    );

    logger.info(`Admin logged out: ${req.admin.email || adminId}`);
    console.log('✅ Logout successful');

    res.json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (error) {
    console.error('❌ Logout error:', error.message);
    logger.error('Logout error:', error);
    next(error);
  }
};

// ===== VERIFY TOKEN =====
exports.verifyToken = async (req, res, next) => {
  try {
    console.log('\n🔍 ===== VERIFY TOKEN REQUEST =====');
    
    const { token } = req.body;

    if (!token) {
      throw ApiError.badRequest('Token is required');
    }

    const accessSecret = process.env.JWT_ACCESS_SECRET || 'default-access-secret-change-me';
    
    let decoded;
    try {
      decoded = jwt.verify(token, accessSecret);
    } catch (error) {
      console.log('❌ Invalid token');
      if (error.name === 'TokenExpiredError') {
        throw ApiError.unauthorized('Token expired');
      }
      throw ApiError.unauthorized('Invalid token');
    }

    if (decoded.type !== 'access') {
      throw ApiError.unauthorized('Invalid token type');
    }

    console.log('✅ Token verified for:', decoded.email);

    res.json({
      success: true,
      message: 'Token is valid',
      data: {
        adminId: decoded.adminId,
        email: decoded.email,
        role: decoded.role,
        name: decoded.name,
      },
    });
  } catch (error) {
    console.error('❌ Verify token error:', error.message);
    next(error);
  }
};

// ===== DELETE USER (Soft Delete or Permanent Delete) =====
exports.deleteUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { permanent } = req.query;

    console.log('\n🗑️ ===== DELETE USER REQUEST =====');
    console.log('   User ID:', id);
    console.log('   Permanent:', permanent);

    const userConnection = getUserConnection();
    
    if (!userConnection) {
      throw ApiError.serviceUnavailable('User database not connected');
    }

    const usersCollection = userConnection.db.collection('users');

    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw ApiError.badRequest('Invalid user ID format');
    }

    // Check if user exists first
    const existingUser = await usersCollection.findOne({ 
      _id: new mongoose.Types.ObjectId(id) 
    });

    if (!existingUser) {
      console.log('❌ User not found');
      throw ApiError.notFound('User not found');
    }

    console.log('   User found:', existingUser.email);

    if (permanent === 'true' || permanent === true) {
      // ===== PERMANENT DELETE - Remove from database completely =====
      console.log('   Performing PERMANENT DELETE...');
      
      const result = await usersCollection.deleteOne({ 
        _id: new mongoose.Types.ObjectId(id) 
      });

      if (result.deletedCount === 0) {
        throw ApiError.internal('Failed to delete user');
      }

      logger.info(`User PERMANENTLY DELETED: ${id} (${existingUser.email}) by admin: ${req.admin?.email || req.admin?.adminId}`);
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
        throw ApiError.internal('Failed to delete user');
      }

      logger.info(`User SOFT DELETED: ${id} (${existingUser.email}) by admin: ${req.admin?.email || req.admin?.adminId}`);
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
    console.error('❌ Error deleting user:', error.message);
    logger.error('Error deleting user:', error);
    next(error);
  }
};

// ===== DELETE MULTIPLE USERS =====
exports.deleteMultipleUsers = async (req, res, next) => {
  try {
    const { userIds, permanent } = req.body;

    console.log('\n🗑️ ===== DELETE MULTIPLE USERS REQUEST =====');
    console.log('   User IDs:', userIds?.length || 0, 'users');
    console.log('   Permanent:', permanent);

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      throw ApiError.badRequest('userIds array is required and must not be empty');
    }

    const userConnection = getUserConnection();
    
    if (!userConnection) {
      throw ApiError.serviceUnavailable('User database not connected');
    }

    const usersCollection = userConnection.db.collection('users');

    // Convert string IDs to ObjectIds and validate
    const objectIds = userIds
      .filter(id => mongoose.Types.ObjectId.isValid(id))
      .map(id => new mongoose.Types.ObjectId(id));

    if (objectIds.length === 0) {
      throw ApiError.badRequest('No valid user IDs provided');
    }

    console.log('   Valid IDs:', objectIds.length);

    let result;

    if (permanent === true || permanent === 'true') {
      // ===== PERMANENT DELETE =====
      console.log('   Performing PERMANENT DELETE...');
      
      result = await usersCollection.deleteMany({ 
        _id: { $in: objectIds } 
      });

      logger.info(`${result.deletedCount} users PERMANENTLY DELETED by admin: ${req.admin?.email || req.admin?.adminId}`);
      console.log(`✅ ${result.deletedCount} users permanently deleted`);

      res.json({
        success: true,
        message: `${result.deletedCount} user(s) permanently deleted from database`,
        data: {
          deletedCount: result.deletedCount,
          requestedCount: objectIds.length,
        }
      });
    } else {
      // ===== SOFT DELETE =====
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

      logger.info(`${result.modifiedCount} users SOFT DELETED by admin: ${req.admin?.email || req.admin?.adminId}`);
      console.log(`✅ ${result.modifiedCount} users soft deleted`);

      res.json({
        success: true,
        message: `${result.modifiedCount} user(s) deleted successfully (can be restored)`,
        data: {
          deletedCount: result.modifiedCount,
          requestedCount: objectIds.length,
        }
      });
    }
  } catch (error) {
    console.error('❌ Error deleting multiple users:', error.message);
    logger.error('Error deleting multiple users:', error);
    next(error);
  }
};

// ===== RESTORE DELETED USER =====
exports.restoreUser = async (req, res, next) => {
  try {
    const { id } = req.params;

    console.log('\n♻️ ===== RESTORE USER REQUEST =====');
    console.log('   User ID:', id);

    const userConnection = getUserConnection();
    
    if (!userConnection) {
      throw ApiError.serviceUnavailable('User database not connected');
    }

    const usersCollection = userConnection.db.collection('users');

    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw ApiError.badRequest('Invalid user ID format');
    }

    // Check if user exists and is deleted
    const existingUser = await usersCollection.findOne({ 
      _id: new mongoose.Types.ObjectId(id),
      deletedAt: { $ne: null }
    });

    if (!existingUser) {
      console.log('❌ User not found or not deleted');
      throw ApiError.notFound('User not found or not deleted');
    }

    console.log('   User found:', existingUser.email);

    // Restore user
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
      throw ApiError.internal('Failed to restore user');
    }

    logger.info(`User RESTORED: ${id} (${existingUser.email}) by admin: ${req.admin?.email || req.admin?.adminId}`);
    console.log('✅ User restored successfully');

    res.json({
      success: true,
      message: 'User restored successfully',
      data: {
        restoredUser: {
          id: existingUser._id.toString(),
          email: existingUser.email,
          name: existingUser.name,
        }
      }
    });
  } catch (error) {
    console.error('❌ Error restoring user:', error.message);
    logger.error('Error restoring user:', error);
    next(error);
  }
};

// ===== CHANGE PASSWORD =====
exports.changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    console.log('\n🔑 ===== CHANGE PASSWORD REQUEST =====');
    console.log('   Admin ID:', req.admin?.adminId);

    if (!currentPassword || !newPassword) {
      throw ApiError.badRequest('Current password and new password are required');
    }

    if (newPassword.length < 6) {
      throw ApiError.badRequest('New password must be at least 6 characters long');
    }

    const Admin = getAdminModel();

    const admin = await Admin.findById(req.admin.adminId).select('+password');

    if (!admin) {
      throw ApiError.notFound('Admin not found');
    }

    // Verify current password
    const isPasswordValid = await admin.comparePassword(currentPassword);

    if (!isPasswordValid) {
      console.log('❌ Current password invalid');
      throw ApiError.unauthorized('Current password is incorrect');
    }

    // Update password (will be hashed by pre-save hook)
    admin.password = newPassword;
    await admin.save();

    logger.info(`Password changed for admin: ${admin.email}`);
    console.log('✅ Password changed successfully');

    res.json({
      success: true,
      message: 'Password changed successfully',
    });
  } catch (error) {
    console.error('❌ Change password error:', error.message);
    logger.error('Change password error:', error);
    next(error);
  }
};