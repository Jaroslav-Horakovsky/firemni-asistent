const AuthService = require('../services/auth.service')
const { validationResult } = require('express-validator')

class AuthController {
  /**
   * Register a new user
   * POST /auth/register
   */
  static async register(req, res) {
    try {
      // Check validation errors
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details: errors.array()
        })
      }

      const { email, password, firstName, lastName, role } = req.body

      // Register user
      const result = await AuthService.register({
        email,
        password,
        firstName,
        lastName,
        role
      })

      // Set refresh token as httpOnly cookie
      res.cookie('refreshToken', result.tokens.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
      })

      res.status(201).json({
        success: true,
        message: 'User registered successfully',
        data: {
          user: result.user,
          accessToken: result.tokens.accessToken,
          expiresIn: result.tokens.expiresIn,
          tokenType: result.tokens.tokenType
        }
      })
    } catch (error) {
      console.error('[AuthController] Register error:', error.message)
      
      let statusCode = 500
      let errorCode = 'REGISTRATION_FAILED'
      
      if (error.message === 'User with this email already exists') {
        statusCode = 409
        errorCode = 'EMAIL_ALREADY_EXISTS'
      }

      res.status(statusCode).json({
        success: false,
        error: error.message,
        code: errorCode
      })
    }
  }

  /**
   * Login user
   * POST /auth/login
   */
  static async login(req, res) {
    try {
      // Check validation errors
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details: errors.array()
        })
      }

      const { email, password } = req.body

      // Login user
      const result = await AuthService.login({ email, password })

      // Set refresh token as httpOnly cookie
      res.cookie('refreshToken', result.tokens.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
      })

      res.status(200).json({
        success: true,
        message: 'Login successful',
        data: {
          user: result.user,
          accessToken: result.tokens.accessToken,
          expiresIn: result.tokens.expiresIn,
          tokenType: result.tokens.tokenType
        }
      })
    } catch (error) {
      console.error('[AuthController] Login error:', error.message)
      
      let statusCode = 500
      let errorCode = 'LOGIN_FAILED'
      
      if (error.message.includes('Invalid email or password')) {
        statusCode = 401
        errorCode = 'INVALID_CREDENTIALS'
      } else if (error.message.includes('Account is deactivated')) {
        statusCode = 401
        errorCode = 'ACCOUNT_DEACTIVATED'
      } else if (error.message.includes('Account is locked')) {
        statusCode = 401
        errorCode = 'ACCOUNT_LOCKED'
      }

      res.status(statusCode).json({
        success: false,
        error: error.message,
        code: errorCode
      })
    }
  }

  /**
   * Refresh access token
   * POST /auth/refresh
   */
  static async refreshToken(req, res) {
    try {
      // Get refresh token from cookie or body
      const refreshToken = req.cookies.refreshToken || req.body.refreshToken

      if (!refreshToken) {
        return res.status(400).json({
          success: false,
          error: 'Refresh token required',
          code: 'REFRESH_TOKEN_MISSING'
        })
      }

      // Refresh tokens
      const result = await AuthService.refreshToken(refreshToken)

      // Set new refresh token as httpOnly cookie
      res.cookie('refreshToken', result.tokens.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
      })

      res.status(200).json({
        success: true,
        message: 'Token refreshed successfully',
        data: {
          user: result.user,
          accessToken: result.tokens.accessToken,
          expiresIn: result.tokens.expiresIn,
          tokenType: result.tokens.tokenType
        }
      })
    } catch (error) {
      console.error('[AuthController] Token refresh error:', error.message)
      
      let statusCode = 500
      let errorCode = 'TOKEN_REFRESH_FAILED'
      
      if (error.message.includes('Invalid') || error.message.includes('expired')) {
        statusCode = 401
        errorCode = 'INVALID_REFRESH_TOKEN'
      }

      res.status(statusCode).json({
        success: false,
        error: error.message,
        code: errorCode
      })
    }
  }

  /**
   * Logout user
   * POST /auth/logout
   */
  static async logout(req, res) {
    try {
      // Clear refresh token cookie
      res.clearCookie('refreshToken')

      res.status(200).json({
        success: true,
        message: 'Logout successful'
      })
    } catch (error) {
      console.error('[AuthController] Logout error:', error.message)
      
      res.status(500).json({
        success: false,
        error: 'Logout failed',
        code: 'LOGOUT_FAILED'
      })
    }
  }

  /**
   * Get current user profile
   * GET /auth/me
   */
  static async getProfile(req, res) {
    try {
      const userId = req.user.id

      const profile = await AuthService.getProfile(userId)

      res.status(200).json({
        success: true,
        data: { user: profile }
      })
    } catch (error) {
      console.error('[AuthController] Get profile error:', error.message)
      
      res.status(500).json({
        success: false,
        error: 'Failed to get profile',
        code: 'PROFILE_FETCH_FAILED'
      })
    }
  }

  /**
   * Update current user profile
   * PUT /auth/me
   */
  static async updateProfile(req, res) {
    try {
      // Check validation errors
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details: errors.array()
        })
      }

      const userId = req.user.id
      const updates = req.body

      const updatedProfile = await AuthService.updateProfile(userId, updates)

      res.status(200).json({
        success: true,
        message: 'Profile updated successfully',
        data: { user: updatedProfile }
      })
    } catch (error) {
      console.error('[AuthController] Update profile error:', error.message)
      
      let statusCode = 500
      let errorCode = 'PROFILE_UPDATE_FAILED'
      
      if (error.message.includes('No valid fields')) {
        statusCode = 400
        errorCode = 'NO_VALID_FIELDS'
      }

      res.status(statusCode).json({
        success: false,
        error: error.message,
        code: errorCode
      })
    }
  }

  /**
   * Change password
   * POST /auth/change-password
   */
  static async changePassword(req, res) {
    try {
      // Check validation errors
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details: errors.array()
        })
      }

      const userId = req.user.id
      const { currentPassword, newPassword } = req.body

      await AuthService.changePassword(userId, currentPassword, newPassword)

      res.status(200).json({
        success: true,
        message: 'Password changed successfully'
      })
    } catch (error) {
      console.error('[AuthController] Change password error:', error.message)
      
      let statusCode = 500
      let errorCode = 'PASSWORD_CHANGE_FAILED'
      
      if (error.message.includes('Current password is incorrect')) {
        statusCode = 400
        errorCode = 'INVALID_CURRENT_PASSWORD'
      }

      res.status(statusCode).json({
        success: false,
        error: error.message,
        code: errorCode
      })
    }
  }

  /**
   * Request password reset
   * POST /auth/forgot-password
   */
  static async forgotPassword(req, res) {
    try {
      // Check validation errors
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details: errors.array()
        })
      }

      const { email } = req.body

      const resetToken = await AuthService.requestPasswordReset(email)

      // In production, don't return the token - send via email instead
      res.status(200).json({
        success: true,
        message: 'Password reset instructions sent to your email',
        ...(process.env.NODE_ENV === 'development' && { resetToken })
      })
    } catch (error) {
      console.error('[AuthController] Forgot password error:', error.message)
      
      res.status(500).json({
        success: false,
        error: 'Failed to process password reset request',
        code: 'PASSWORD_RESET_REQUEST_FAILED'
      })
    }
  }

  /**
   * Reset password using reset token
   * POST /auth/reset-password
   */
  static async resetPassword(req, res) {
    try {
      // Check validation errors
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details: errors.array()
        })
      }

      const { resetToken, newPassword } = req.body

      await AuthService.resetPassword(resetToken, newPassword)

      res.status(200).json({
        success: true,
        message: 'Password reset successfully'
      })
    } catch (error) {
      console.error('[AuthController] Reset password error:', error.message)
      
      let statusCode = 500
      let errorCode = 'PASSWORD_RESET_FAILED'
      
      if (error.message.includes('Invalid or expired')) {
        statusCode = 400
        errorCode = 'INVALID_RESET_TOKEN'
      }

      res.status(statusCode).json({
        success: false,
        error: error.message,
        code: errorCode
      })
    }
  }

  /**
   * Verify access token
   * POST /auth/verify
   */
  static async verifyToken(req, res) {
    try {
      // Token is already verified by middleware, just return user info
      res.status(200).json({
        success: true,
        message: 'Token is valid',
        data: { user: req.user }
      })
    } catch (error) {
      console.error('[AuthController] Verify token error:', error.message)
      
      res.status(500).json({
        success: false,
        error: 'Token verification failed',
        code: 'TOKEN_VERIFICATION_FAILED'
      })
    }
  }
}

module.exports = AuthController