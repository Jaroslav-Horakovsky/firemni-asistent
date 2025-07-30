const { jwtManager } = require('../utils/jwt')
const UserModel = require('../models/user.model')

/**
 * Extract token from request headers
 * @param {Object} req - Express request object
 * @returns {string|null} JWT token or null
 */
const extractToken = (req) => {
  const authHeader = req.headers.authorization
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7) // Remove 'Bearer ' prefix
  }
  
  // Also check cookies for token (for web apps)
  if (req.cookies && req.cookies.accessToken) {
    return req.cookies.accessToken
  }
  
  return null
}

/**
 * Middleware to authenticate JWT token
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Next middleware function
 */
const authenticateToken = async (req, res, next) => {
  try {
    const token = extractToken(req)
    
    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Access token required',
        code: 'TOKEN_MISSING'
      })
    }

    // Verify token
    const decoded = await jwtManager.verifyAccessToken(token)
    
    // Get current user data to ensure user still exists and is active
    const user = await UserModel.findById(decoded.userId)
    
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'User not found',
        code: 'USER_NOT_FOUND'
      })
    }

    if (!user.is_active) {
      return res.status(401).json({
        success: false,
        error: 'Account is deactivated',
        code: 'ACCOUNT_DEACTIVATED'
      })
    }

    // Check if user is locked
    if (UserModel.isUserLocked(user)) {
      return res.status(401).json({
        success: false,
        error: 'Account is temporarily locked',
        code: 'ACCOUNT_LOCKED'
      })
    }

    // Add user info to request object
    req.user = {
      id: user.id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      role: user.role,
      isActive: user.is_active,
      emailVerified: user.email_verified
    }

    next()
  } catch (error) {
    console.error('[AuthMiddleware] Token authentication error:', error.message)
    
    let errorCode = 'TOKEN_INVALID'
    let statusCode = 401
    
    if (error.message === 'Token expired') {
      errorCode = 'TOKEN_EXPIRED'
    } else if (error.message === 'Invalid token') {
      errorCode = 'TOKEN_INVALID'
    }

    return res.status(statusCode).json({
      success: false,
      error: error.message,
      code: errorCode
    })
  }
}

/**
 * Middleware to authenticate optional JWT token (doesn't fail if no token)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Next middleware function
 */
const authenticateOptional = async (req, res, next) => {
  try {
    const token = extractToken(req)
    
    if (!token) {
      // No token provided, continue without user info
      req.user = null
      return next()
    }

    // Verify token
    const decoded = await jwtManager.verifyAccessToken(token)
    
    // Get current user data
    const user = await UserModel.findById(decoded.userId)
    
    if (user && user.is_active && !UserModel.isUserLocked(user)) {
      req.user = {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role,
        isActive: user.is_active,
        emailVerified: user.email_verified
      }
    } else {
      req.user = null
    }

    next()
  } catch (error) {
    // Token invalid, continue without user info
    req.user = null
    next()
  }
}

/**
 * Middleware to check if user has required role
 * @param {string|Array} requiredRoles - Required role(s)
 * @returns {Function} Middleware function
 */
const requireRole = (requiredRoles) => {
  const roles = Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles]
  
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'AUTH_REQUIRED'
      })
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions',
        code: 'INSUFFICIENT_PERMISSIONS',
        required: roles,
        current: req.user.role
      })
    }

    next()
  }
}

/**
 * Middleware to check if user is admin
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Next middleware function
 */
const requireAdmin = requireRole('admin')

/**
 * Middleware to check if user owns the resource or is admin
 * @param {string} userIdParam - Parameter name containing user ID (default: 'userId')
 * @returns {Function} Middleware function
 */
const requireOwnershipOrAdmin = (userIdParam = 'userId') => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'AUTH_REQUIRED'
      })
    }

    const targetUserId = req.params[userIdParam]
    
    // Admin can access any resource
    if (req.user.role === 'admin') {
      return next()
    }

    // User can only access their own resources
    if (req.user.id !== targetUserId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied to this resource',
        code: 'ACCESS_DENIED'
      })
    }

    next()
  }
}

/**
 * Middleware to check if email is verified
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Next middleware function
 */
const requireEmailVerified = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required',
      code: 'AUTH_REQUIRED'
    })
  }

  if (!req.user.emailVerified) {
    return res.status(403).json({
      success: false,
      error: 'Email verification required',
      code: 'EMAIL_NOT_VERIFIED'
    })
  }

  next()
}

/**
 * Middleware to validate refresh token
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Next middleware function
 */
const validateRefreshToken = async (req, res, next) => {
  try {
    const { refreshToken } = req.body
    
    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        error: 'Refresh token required',
        code: 'REFRESH_TOKEN_MISSING'
      })
    }

    // Verify refresh token
    const decoded = await jwtManager.verifyRefreshToken(refreshToken)
    
    // Add decoded token to request
    req.decodedRefreshToken = decoded
    
    next()
  } catch (error) {
    console.error('[AuthMiddleware] Refresh token validation error:', error.message)
    
    let errorCode = 'REFRESH_TOKEN_INVALID'
    
    if (error.message === 'Refresh token expired') {
      errorCode = 'REFRESH_TOKEN_EXPIRED'
    }

    return res.status(401).json({
      success: false,
      error: error.message,
      code: errorCode
    })
  }
}

module.exports = {
  authenticateToken,
  authenticateOptional,
  requireRole,
  requireAdmin,
  requireOwnershipOrAdmin,
  requireEmailVerified,
  validateRefreshToken,
  extractToken
}