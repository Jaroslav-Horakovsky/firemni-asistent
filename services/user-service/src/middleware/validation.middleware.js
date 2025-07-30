const { body, param, query } = require('express-validator')

/**
 * Validation rules for user registration
 */
const validateRegistration = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email is required')
    .isLength({ max: 255 })
    .withMessage('Email must be less than 255 characters'),
  
  body('password')
    .isLength({ min: 8, max: 128 })
    .withMessage('Password must be between 8 and 128 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('Password must contain at least one lowercase letter, one uppercase letter, one number, and one special character'),
  
  body('firstName')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('First name is required and must be less than 100 characters')
    .matches(/^[a-zA-ZÀ-ÿ\s\-'\.]+$/)
    .withMessage('First name can only contain letters, spaces, hyphens, apostrophes, and dots'),
  
  body('lastName')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Last name is required and must be less than 100 characters')
    .matches(/^[a-zA-ZÀ-ÿ\s\-'\.]+$/)
    .withMessage('Last name can only contain letters, spaces, hyphens, apostrophes, and dots'),
  
  body('role')
    .optional()
    .isIn(['user', 'admin', 'manager'])
    .withMessage('Role must be one of: user, admin, manager')
]

/**
 * Validation rules for user login
 */
const validateLogin = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email is required'),
  
  body('password')
    .isLength({ min: 1 })
    .withMessage('Password is required')
]

/**
 * Validation rules for password change
 */
const validatePasswordChange = [
  body('currentPassword')
    .isLength({ min: 1 })
    .withMessage('Current password is required'),
  
  body('newPassword')
    .isLength({ min: 8, max: 128 })
    .withMessage('New password must be between 8 and 128 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('New password must contain at least one lowercase letter, one uppercase letter, one number, and one special character'),
  
  body('confirmPassword')
    .custom((value, { req }) => {
      if (value !== req.body.newPassword) {
        throw new Error('Password confirmation does not match new password')
      }
      return true
    })
]

/**
 * Validation rules for forgot password
 */
const validateForgotPassword = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email is required')
]

/**
 * Validation rules for password reset
 */
const validatePasswordReset = [
  body('resetToken')
    .isUUID()
    .withMessage('Valid reset token is required'),
  
  body('newPassword')
    .isLength({ min: 8, max: 128 })
    .withMessage('New password must be between 8 and 128 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('New password must contain at least one lowercase letter, one uppercase letter, one number, and one special character'),
  
  body('confirmPassword')
    .custom((value, { req }) => {
      if (value !== req.body.newPassword) {
        throw new Error('Password confirmation does not match new password')
      }
      return true
    })
]

/**
 * Validation rules for profile update
 */
const validateProfileUpdate = [
  body('firstName')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('First name must be between 1 and 100 characters')
    .matches(/^[a-zA-ZÀ-ÿ\s\-'\.]+$/)
    .withMessage('First name can only contain letters, spaces, hyphens, apostrophes, and dots'),
  
  body('lastName')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Last name must be between 1 and 100 characters')
    .matches(/^[a-zA-ZÀ-ÿ\s\-'\.]+$/)
    .withMessage('Last name can only contain letters, spaces, hyphens, apostrophes, and dots'),
  
  body('email')
    .optional()
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email is required')
    .isLength({ max: 255 })
    .withMessage('Email must be less than 255 characters')
]

/**
 * Validation rules for user ID parameter
 */
const validateUserId = [
  param('userId')
    .isUUID()
    .withMessage('Valid user ID is required')
]

/**
 * Validation rules for pagination query parameters
 */
const validatePagination = [
  query('page')
    .optional()
    .isInt({ min: 1, max: 1000 })
    .withMessage('Page must be a positive integer (max 1000)')
    .toInt(),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be a positive integer (max 100)')
    .toInt(),
  
  query('role')
    .optional()
    .isIn(['user', 'admin', 'manager'])
    .withMessage('Role must be one of: user, admin, manager'),
  
  query('active')
    .optional()
    .isBoolean()
    .withMessage('Active must be a boolean value')
    .toBoolean()
]

/**
 * Validation rules for email parameter
 */
const validateEmail = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email is required')
]

/**
 * Validation rules for refresh token
 */
const validateRefreshToken = [
  body('refreshToken')
    .optional()
    .isJWT()
    .withMessage('Valid refresh token is required')
]

/**
 * Custom validation middleware for checking password strength
 */
const checkPasswordStrength = (req, res, next) => {
  const password = req.body.password || req.body.newPassword
  
  if (!password) {
    return next()
  }

  const strengthChecks = {
    minLength: password.length >= 8,
    hasLowercase: /[a-z]/.test(password),
    hasUppercase: /[A-Z]/.test(password),
    hasNumber: /\d/.test(password),
    hasSpecialChar: /[@$!%*?&]/.test(password),
    maxLength: password.length <= 128
  }

  const strength = Object.values(strengthChecks).filter(Boolean).length
  
  // Add password strength info to request
  req.passwordStrength = {
    score: strength,
    checks: strengthChecks,
    isStrong: strength >= 5
  }

  next()
}

/**
 * Middleware to sanitize user input
 */
const sanitizeInput = (req, res, next) => {
  // Trim whitespace from string fields
  const stringFields = ['firstName', 'lastName', 'email', 'currentPassword', 'newPassword', 'password']
  
  stringFields.forEach(field => {
    if (req.body[field] && typeof req.body[field] === 'string') {
      req.body[field] = req.body[field].trim()
    }
  })

  // Convert email to lowercase
  if (req.body.email) {
    req.body.email = req.body.email.toLowerCase()
  }

  next()
}

/**
 * Middleware to check for common weak passwords
 */
const checkWeakPasswords = (req, res, next) => {
  const password = req.body.password || req.body.newPassword
  
  if (!password) {
    return next()
  }

  const commonPasswords = [
    'password', '123456', '123456789', 'qwerty', 'abc123',
    'password123', 'admin', 'letmein', 'welcome', 'monkey'
  ]

  const isWeak = commonPasswords.some(weak => 
    password.toLowerCase().includes(weak.toLowerCase())
  )

  if (isWeak) {
    return res.status(400).json({
      success: false,
      error: 'Password is too common and weak',
      code: 'WEAK_PASSWORD'
    })
  }

  next()
}

/**
 * Rate limiting validation middleware
 */
const validateRateLimit = (req, res, next) => {
  // Add rate limiting info to request for logging
  req.rateLimitInfo = {
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    endpoint: req.originalUrl,
    method: req.method
  }

  next()
}

module.exports = {
  validateRegistration,
  validateLogin,
  validatePasswordChange,
  validateForgotPassword,
  validatePasswordReset,
  validateProfileUpdate,
  validateUserId,
  validatePagination,
  validateEmail,
  validateRefreshToken,
  checkPasswordStrength,
  sanitizeInput,
  checkWeakPasswords,
  validateRateLimit
}