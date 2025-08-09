const UserModel = require('../models/user.model')
const { jwtManager } = require('../utils/jwt')
const { v4: uuidv4 } = require('uuid')
const logger = require('../utils/logger')

class AuthService {
  /**
   * Register a new user
   * @param {Object} userData - User registration data
   * @returns {Promise<Object>} Registration result with tokens
   */
  static async register(userData) {
    try {
      const { email, password, firstName, lastName, role = 'user' } = userData

      // Check if user already exists
      const existingUser = await UserModel.findByEmail(email)
      if (existingUser) {
        throw new Error('User with this email already exists')
      }

      // Create user
      const user = await UserModel.create({
        email,
        password,
        firstName,
        lastName,
        role
      })

      // Generate tokens
      const tokenPayload = {
        userId: user.id,
        email: user.email,
        role: user.role,
        firstName: user.first_name,
        lastName: user.last_name
      }

      const tokens = await jwtManager.generateTokenPair(tokenPayload)

      return {
        user: {
          id: user.id,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
          role: user.role,
          isActive: user.is_active,
          emailVerified: user.email_verified,
          createdAt: user.created_at
        },
        tokens
      }
    } catch (error) {
      logger.error('User registration failed', {
        error: error.message,
        email: userData.email,
        operation: 'register'
      })
      throw error
    }
  }

  /**
   * Login user
   * @param {Object} credentials - Login credentials
   * @returns {Promise<Object>} Login result with tokens
   */
  static async login(credentials) {
    try {
      const { email, password } = credentials

      // Find user with password hash
      const user = await UserModel.findByEmail(email, true)
      if (!user) {
        throw new Error('Invalid email or password')
      }

      // Check if user is active
      if (!user.is_active) {
        throw new Error('Account is deactivated')
      }

      // Check if user is locked
      if (UserModel.isUserLocked(user)) {
        const lockExpiry = new Date(user.locked_until)
        throw new Error(`Account is locked until ${lockExpiry.toISOString()}`)
      }

      // Verify password
      const isPasswordValid = await UserModel.verifyPassword(password, user.password_hash)
      
      if (!isPasswordValid) {
        // Record failed login attempt
        await UserModel.recordLoginAttempt(user.id, false)
        throw new Error('Invalid email or password')
      }

      // Record successful login
      await UserModel.recordLoginAttempt(user.id, true)

      // Generate tokens
      const tokenPayload = {
        userId: user.id,
        email: user.email,
        role: user.role,
        firstName: user.first_name,
        lastName: user.last_name
      }

      const tokens = await jwtManager.generateTokenPair(tokenPayload)

      return {
        user: {
          id: user.id,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
          role: user.role,
          isActive: user.is_active,
          emailVerified: user.email_verified,
          lastLogin: user.last_login
        },
        tokens
      }
    } catch (error) {
      logger.error('User login failed', {
        error: error.message,
        email: credentials.email,
        operation: 'login'
      })
      throw error
    }
  }

  /**
   * Refresh access token using refresh token
   * @param {string} refreshToken - Valid refresh token
   * @returns {Promise<Object>} New token pair
   */
  static async refreshToken(refreshToken) {
    try {
      // Verify refresh token
      const decoded = await jwtManager.verifyRefreshToken(refreshToken)

      // Get current user data
      const user = await UserModel.findById(decoded.userId)
      if (!user) {
        throw new Error('User not found')
      }

      if (!user.is_active) {
        throw new Error('Account is deactivated')
      }

      // Generate new token pair
      const tokenPayload = {
        userId: user.id,
        email: user.email,
        role: user.role,
        firstName: user.first_name,
        lastName: user.last_name
      }

      const tokens = await jwtManager.generateTokenPair(tokenPayload)

      return {
        user: {
          id: user.id,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
          role: user.role,
          isActive: user.is_active,
          emailVerified: user.email_verified
        },
        tokens
      }
    } catch (error) {
      logger.error('Token refresh failed', {
        error: error.message,
        operation: 'refreshToken'
      })
      throw error
    }
  }

  /**
   * Verify access token and return user info
   * @param {string} accessToken - JWT access token
   * @returns {Promise<Object>} User information
   */
  static async verifyToken(accessToken) {
    try {
      // Verify token
      const decoded = await jwtManager.verifyAccessToken(accessToken)

      // Get current user data (to check if still active)
      const user = await UserModel.findById(decoded.userId)
      if (!user) {
        throw new Error('User not found')
      }

      if (!user.is_active) {
        throw new Error('Account is deactivated')
      }

      return {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role,
        isActive: user.is_active,
        emailVerified: user.email_verified
      }
    } catch (error) {
      logger.error('Token verification failed', {
        error: error.message,
        operation: 'verifyToken'
      })
      throw error
    }
  }

  /**
   * Change user password
   * @param {string} userId - User ID
   * @param {string} currentPassword - Current password
   * @param {string} newPassword - New password
   * @returns {Promise<boolean>} Success status
   */
  static async changePassword(userId, currentPassword, newPassword) {
    try {
      // Get user with password hash
      const user = await UserModel.findById(userId, true)
      if (!user) {
        throw new Error('User not found')
      }

      // Verify current password
      const isCurrentPasswordValid = await UserModel.verifyPassword(currentPassword, user.password_hash)
      if (!isCurrentPasswordValid) {
        throw new Error('Current password is incorrect')
      }

      // Update password
      const success = await UserModel.updatePassword(userId, newPassword)
      
      if (success) {
        logger.info('User password changed successfully', {
          userId,
          operation: 'changePassword'
        })
      }

      return success
    } catch (error) {
      logger.error('Password change failed', {
        error: error.message,
        userId: userData.userId,
        operation: 'changePassword'
      })
      throw error
    }
  }

  /**
   * Request password reset (generate reset token)
   * @param {string} email - User email
   * @returns {Promise<string>} Reset token (in real app, send via email)
   */
  static async requestPasswordReset(email) {
    try {
      const user = await UserModel.findByEmail(email)
      if (!user) {
        // Don't reveal if email exists or not
        logger.warn('Password reset requested for non-existent email', {
          email,
          operation: 'forgotPassword'
        })
        return 'reset-requested' // Generic response
      }

      // Generate reset token
      const resetToken = uuidv4()
      const resetExpires = new Date(Date.now() + 15 * 60 * 1000) // 15 minutes

      // Update user with reset token
      await UserModel.updateById(user.id, {
        password_reset_token: resetToken,
        password_reset_expires: resetExpires
      })

      logger.info('Password reset token generated', {
        userId: user.id,
        operation: 'forgotPassword'
      })
      
      // In real app, send email with reset link
      // For now, return token for testing
      return resetToken
    } catch (error) {
      logger.error('Password reset request failed', {
        error: error.message,
        email: requestData.email,
        operation: 'forgotPassword'
      })
      throw error
    }
  }

  /**
   * Reset password using reset token
   * @param {string} resetToken - Password reset token
   * @param {string} newPassword - New password
   * @returns {Promise<boolean>} Success status
   */
  static async resetPassword(resetToken, newPassword) {
    try {
      // Find user by reset token
      const query = `
        SELECT id, password_reset_expires 
        FROM users 
        WHERE password_reset_token = $1 AND password_reset_expires > NOW()
      `
      
      const result = await database.query(query, [resetToken])
      
      if (result.rows.length === 0) {
        throw new Error('Invalid or expired reset token')
      }

      const userId = result.rows[0].id

      // Update password and clear reset token
      const success = await UserModel.updatePassword(userId, newPassword)
      
      if (success) {
        logger.info('Password reset completed successfully', {
          userId,
          operation: 'resetPassword'
        })
      }

      return success
    } catch (error) {
      logger.error('Password reset failed', {
        error: error.message,
        operation: 'resetPassword'
      })
      throw error
    }
  }

  /**
   * Get user profile
   * @param {string} userId - User ID
   * @returns {Promise<Object>} User profile
   */
  static async getProfile(userId) {
    try {
      const user = await UserModel.findById(userId)
      if (!user) {
        throw new Error('User not found')
      }

      return {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role,
        isActive: user.is_active,
        emailVerified: user.email_verified,
        lastLogin: user.last_login,
        createdAt: user.created_at,
        updatedAt: user.updated_at
      }
    } catch (error) {
      logger.error('Get user profile failed', {
        error: error.message,
        userId,
        operation: 'getProfile'
      })
      throw error
    }
  }

  /**
   * Update user profile
   * @param {string} userId - User ID
   * @param {Object} updates - Profile updates
   * @returns {Promise<Object>} Updated user profile
   */
  static async updateProfile(userId, updates) {
    try {
      const allowedUpdates = ['first_name', 'last_name', 'email']
      const filteredUpdates = {}

      for (const [key, value] of Object.entries(updates)) {
        if (allowedUpdates.includes(key)) {
          filteredUpdates[key] = value
        }
      }

      if (Object.keys(filteredUpdates).length === 0) {
        throw new Error('No valid fields to update')
      }

      const updatedUser = await UserModel.updateById(userId, filteredUpdates)
      
      return {
        id: updatedUser.id,
        email: updatedUser.email,
        firstName: updatedUser.first_name,
        lastName: updatedUser.last_name,
        role: updatedUser.role,
        isActive: updatedUser.is_active,
        emailVerified: updatedUser.email_verified,
        updatedAt: updatedUser.updated_at
      }
    } catch (error) {
      logger.error('Update user profile failed', {
        error: error.message,
        userId,
        operation: 'updateProfile'
      })
      throw error
    }
  }
}

module.exports = AuthService