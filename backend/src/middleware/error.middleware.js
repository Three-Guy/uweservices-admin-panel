// src/middleware/error.middleware.js
const logger = require('../utils/logger');

/**
 * Global Error Handler Middleware
 * Handles all errors thrown in the application
 */
const errorHandler = (err, req, res, next) => {
  // Log error details
  console.error('\n❌ Error Handler Caught:');
  console.error('   Message:', err.message);
  console.error('   Path:', req.path);
  console.error('   Method:', req.method);
  
  // Log full stack in development
  if (process.env.NODE_ENV === 'development') {
    console.error('   Stack:', err.stack);
  }

  // Log to file/service
  logger.error('Error:', {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    body: req.body,
    params: req.params,
    query: req.query,
    ip: req.ip,
    user: req.admin?.email || 'anonymous',
  });

  // ===== MONGOOSE VALIDATION ERROR =====
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map(e => e.message);
    return res.status(400).json({
      success: false,
      message: 'Validation Error',
      errors: messages,
    });
  }

  // ===== MONGOOSE DUPLICATE KEY ERROR =====
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    const value = err.keyValue[field];
    return res.status(409).json({
      success: false,
      message: `Duplicate value for field: ${field}`,
      field: field,
      value: value,
    });
  }

  // ===== MONGOOSE CAST ERROR (Invalid ObjectId) =====
  if (err.name === 'CastError') {
    return res.status(400).json({
      success: false,
      message: `Invalid ${err.path}: ${err.value}`,
      field: err.path,
    });
  }

  // ===== MONGOOSE DOCUMENT NOT FOUND =====
  if (err.name === 'DocumentNotFoundError') {
    return res.status(404).json({
      success: false,
      message: 'Document not found',
    });
  }

  // ===== JWT TOKEN ERRORS =====
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      message: 'Invalid token. Please login again.',
      code: 'INVALID_TOKEN',
    });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      message: 'Token expired. Please login again.',
      code: 'TOKEN_EXPIRED',
    });
  }

  if (err.name === 'NotBeforeError') {
    return res.status(401).json({
      success: false,
      message: 'Token not active yet.',
      code: 'TOKEN_NOT_ACTIVE',
    });
  }

  // ===== MULTER FILE UPLOAD ERRORS =====
  if (err.name === 'MulterError') {
    let message = 'File upload error';
    
    switch (err.code) {
      case 'LIMIT_FILE_SIZE':
        message = 'File too large. Maximum size allowed is 10MB';
        break;
      case 'LIMIT_FILE_COUNT':
        message = 'Too many files. Maximum 10 files allowed';
        break;
      case 'LIMIT_UNEXPECTED_FILE':
        message = 'Unexpected file field';
        break;
      case 'LIMIT_PART_COUNT':
        message = 'Too many parts';
        break;
      case 'LIMIT_FIELD_KEY':
        message = 'Field name too long';
        break;
      case 'LIMIT_FIELD_VALUE':
        message = 'Field value too long';
        break;
      case 'LIMIT_FIELD_COUNT':
        message = 'Too many fields';
        break;
      default:
        message = 'File upload error';
    }
    
    return res.status(400).json({
      success: false,
      message: message,
      code: err.code,
    });
  }

  // ===== SYNTAX ERROR (JSON Parse) =====
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({
      success: false,
      message: 'Invalid JSON in request body',
    });
  }

  // ===== CUSTOM API ERROR (from ApiError class) =====
  if (err.statusCode) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
      ...(err.errors && { errors: err.errors }),
    });
  }

  // ===== AXIOS/HTTP REQUEST ERRORS =====
  if (err.isAxiosError) {
    const status = err.response?.status || 500;
    const message = err.response?.data?.message || 'External service error';
    
    return res.status(status).json({
      success: false,
      message: message,
      service: err.config?.baseURL || 'external',
    });
  }

  // ===== REDIS ERRORS =====
  if (err.name === 'ReplyError' || err.name === 'AbortError') {
    logger.error('Redis error:', err);
    // Don't fail the request, just log
    // The application should continue without cache
  }

  // ===== RATE LIMIT ERROR =====
  if (err.status === 429) {
    return res.status(429).json({
      success: false,
      message: 'Too many requests. Please try again later.',
      retryAfter: err.retryAfter || 60,
    });
  }

  // ===== DEFAULT SERVER ERROR =====
  const statusCode = err.status || err.statusCode || 500;
  const message = process.env.NODE_ENV === 'production' 
    ? 'Internal server error' 
    : err.message || 'Something went wrong';

  res.status(statusCode).json({
    success: false,
    message: message,
    ...(process.env.NODE_ENV === 'development' && {
      error: err.message,
      stack: err.stack,
    }),
  });
};

module.exports = errorHandler;