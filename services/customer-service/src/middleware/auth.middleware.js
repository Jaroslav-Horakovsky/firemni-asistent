const { jwtManager } = require('../utils/jwt')

/**
 * Middleware to authenticate JWT tokens
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization
    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : null

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Access token required',
        code: 'TOKEN_REQUIRED'
      })
    }

    try {
      const decoded = jwtManager.verifyAccessToken(token)
      req.user = decoded
      console.log(`[Auth] Authenticated user: ${decoded.userId}`)
      next()
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          error: 'Token expired',
          code: 'TOKEN_EXPIRED'
        })
      }

      if (error.name === 'JsonWebTokenError') {
        return res.status(401).json({
          success: false,
          error: 'Invalid token',
          code: 'INVALID_TOKEN'
        })
      }

      throw error
    }
  } catch (error) {
    console.error('[Auth] Authentication error:', error.message)
    res.status(500).json({
      success: false,
      error: 'Authentication failed',
      code: 'AUTH_ERROR'
    })
  }
}

/**
 * Middleware to check user roles
 * @param {Array<string>} allowedRoles - Array of allowed roles
 * @returns {Function} Express middleware function
 */
const requireRole = (allowedRoles) => {
  return (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required',
          code: 'AUTH_REQUIRED'
        })
      }

      const userRole = req.user.role
      if (!allowedRoles.includes(userRole)) {
        return res.status(403).json({
          success: false,
          error: 'Insufficient permissions',
          code: 'INSUFFICIENT_PERMISSIONS',
          required: allowedRoles,
          current: userRole
        })
      }

      console.log(`[Auth] Role check passed: ${userRole}`)
      next()
    } catch (error) {
      console.error('[Auth] Role check error:', error.message)
      res.status(500).json({
        success: false,
        error: 'Authorization failed',
        code: 'AUTH_ERROR'
      })
    }
  }
}

/**
 * Middleware for optional authentication (token not required)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization
    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : null

    if (!token) {
      req.user = null
      return next()
    }

    try {
      const decoded = jwtManager.verifyAccessToken(token)
      req.user = decoded
      console.log(`[Auth] Optional auth - user authenticated: ${decoded.userId}`)
    } catch (error) {
      // For optional auth, we don't fail on invalid tokens
      req.user = null
      console.log('[Auth] Optional auth - invalid token, proceeding as unauthenticated')
    }

    next()
  } catch (error) {
    console.error('[Auth] Optional authentication error:', error.message)
    // For optional auth, we don't fail on errors
    req.user = null
    next()
  }
}

module.exports = {
  authenticateToken,
  requireRole,
  optionalAuth
}