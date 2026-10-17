// src/middleware/authMiddleware.js
const jwt = require('jsonwebtoken');
const { getAdminModel, isDbConnected } = require('../config/database');

const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Access token required',
      });
    }

    const token = authHeader.replace('Bearer ', '').trim();

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access token required',
      });
    }

    const accessSecret = process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET || 'default-access-secret-change-me';
    
    let decoded;
    try {
      decoded = jwt.verify(token, accessSecret);
    } catch (err) {
      if (err.name === 'JsonWebTokenError') {
        return res.status(401).json({
          success: false,
          message: 'Invalid token',
        });
      }
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          message: 'Token expired',
        });
      }
      throw err;
    }

    // Support both token types
    if (decoded.type && decoded.type !== 'access') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token type',
      });
    }

    if (!isDbConnected()) {
      console.warn('⚠️ Database not connected - using token authentication only');
      const userData = { 
        _id: decoded.adminId || decoded.id,
        adminId: decoded.adminId || decoded.id,
        id: decoded.adminId || decoded.id,
        email: decoded.email,
        role: decoded.role || 'admin',
        name: decoded.name,
      };
      req.admin = userData;
      req.user = userData;
      return next();
    }

    try {
      const Admin = getAdminModel();
      const admin = await Admin.findById(decoded.adminId || decoded.id);
      
      if (!admin) {
        return res.status(401).json({
          success: false,
          message: 'Admin not found',
        });
      }
      
      if (!admin.isActive) {
        return res.status(401).json({
          success: false,
          message: 'Account is deactivated',
        });
      }

      const userData = { 
        _id: admin._id,
        adminId: admin._id,
        id: admin._id,
        email: admin.email,
        role: admin.role,
        name: admin.name,
        permissions: admin.permissions,
        isActive: admin.isActive,
      };
      
      req.admin = userData;
      req.user = userData;
      
      next();
    } catch (dbError) {
      console.warn('⚠️ Database query failed - using token data:', dbError.message);
      const userData = { 
        _id: decoded.adminId || decoded.id,
        adminId: decoded.adminId || decoded.id,
        id: decoded.adminId || decoded.id,
        email: decoded.email,
        role: decoded.role || 'admin',
        name: decoded.name,
      };
      req.admin = userData;
      req.user = userData;
      next();
    }
    
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(500).json({
      success: false,
      message: 'Authentication failed',
      error: error.message,
    });
  }
};

const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.admin && !req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }
    
    const userRole = req.admin?.role || req.user?.role;
    
    if (!roles.includes(userRole)) {
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions',
      });
    }
    
    next();
  };
};

module.exports = authMiddleware;
module.exports.requireRole = requireRole;