const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');

// JWT Authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Access token required',
      error: 'MISSING_TOKEN'
    });
  }

  jwt.verify(token, process.env.JWT_SECRET, {
    issuer: 'firemni-asistent',
    audience: 'firemni-asistent-users'
  }, (err, user) => {
    if (err) {
      logger.error('JWT token verification failed', { 
        error: err.message, 
        userAgent: req.get('User-Agent'),
        ip: req.ip,
        endpoint: req.originalUrl
      });
      return res.status(403).json({
        success: false,
        message: 'Invalid or expired token',
        error: 'INVALID_TOKEN'
      });
    }
    
    // Verify token type is 'access'
    if (user.type !== 'access') {
      return res.status(403).json({
        success: false,
        message: 'Invalid token type',
        error: 'INVALID_TOKEN_TYPE'
      });
    }
    
    req.user = user;
    next();
  });
};

// HTTP request logging middleware  
const requestLogger = (req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    const logData = {
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    };
    
    if (res.statusCode >= 400) {
      logger.error('HTTP request error', logData);
    } else {
      logger.info('HTTP request completed', logData);
    }
  });
  next();
};

// Error handling middleware
const errorHandler = (err, req, res, next) => {
  logger.error('Unhandled application error', {
    error: err.message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });
  
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.stack : 'INTERNAL_ERROR'
  });
};

module.exports = {
  authenticateToken,
  requestLogger,
  errorHandler
};