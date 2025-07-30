const bcrypt = require('bcryptjs')
const { database } = require('../utils/database')
const { v4: uuidv4 } = require('uuid')

class UserModel {
  /**
   * Create a new user
   * @param {Object} userData - User data
   * @returns {Promise<Object>} Created user (without password)
   */
  static async create(userData) {
    const { email, password, firstName, lastName, role = 'user' } = userData
    
    try {
      // Hash password
      const passwordHash = await bcrypt.hash(password, 12)
      
      const query = `
        INSERT INTO users (
          id, email, password_hash, first_name, last_name, role,
          is_active, email_verified
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id, email, first_name, last_name, role, is_active, 
                  email_verified, created_at, updated_at
      `
      
      const values = [
        uuidv4(),
        email.toLowerCase().trim(),
        passwordHash,
        firstName.trim(),
        lastName.trim(),
        role,
        true,
        false
      ]
      
      const result = await database.query(query, values)
      return result.rows[0]
    } catch (error) {
      if (error.code === '23505') { // Unique constraint violation
        throw new Error('User with this email already exists')
      }
      throw error
    }
  }

  /**
   * Find user by email
   * @param {string} email - User email
   * @param {boolean} includePassword - Include password hash in result
   * @returns {Promise<Object|null>} User object or null
   */
  static async findByEmail(email, includePassword = false) {
    try {
      const fields = includePassword 
        ? 'id, email, password_hash, first_name, last_name, role, is_active, email_verified, last_login, failed_login_attempts, locked_until, created_at, updated_at'
        : 'id, email, first_name, last_name, role, is_active, email_verified, last_login, failed_login_attempts, locked_until, created_at, updated_at'
      
      const query = `SELECT ${fields} FROM users WHERE email = $1`
      const result = await database.query(query, [email.toLowerCase().trim()])
      
      return result.rows[0] || null
    } catch (error) {
      throw error
    }
  }

  /**
   * Find user by ID
   * @param {string} userId - User ID
   * @param {boolean} includePassword - Include password hash in result
   * @returns {Promise<Object|null>} User object or null
   */
  static async findById(userId, includePassword = false) {
    try {
      const fields = includePassword 
        ? 'id, email, password_hash, first_name, last_name, role, is_active, email_verified, last_login, failed_login_attempts, locked_until, created_at, updated_at'
        : 'id, email, first_name, last_name, role, is_active, email_verified, last_login, failed_login_attempts, locked_until, created_at, updated_at'
      
      const query = `SELECT ${fields} FROM users WHERE id = $1`
      const result = await database.query(query, [userId])
      
      return result.rows[0] || null
    } catch (error) {
      throw error
    }
  }

  /**
   * Update user by ID
   * @param {string} userId - User ID
   * @param {Object} updates - Fields to update
   * @returns {Promise<Object>} Updated user
   */
  static async updateById(userId, updates) {
    try {
      const allowedFields = [
        'first_name', 'last_name', 'email', 'role', 'is_active', 
        'email_verified', 'last_login', 'failed_login_attempts', 'locked_until'
      ]
      
      const updateFields = []
      const values = []
      let valueIndex = 1

      for (const [key, value] of Object.entries(updates)) {
        if (allowedFields.includes(key)) {
          updateFields.push(`${key} = $${valueIndex}`)
          values.push(value)
          valueIndex++
        }
      }

      if (updateFields.length === 0) {
        throw new Error('No valid fields to update')
      }

      values.push(userId)
      
      const query = `
        UPDATE users 
        SET ${updateFields.join(', ')}
        WHERE id = $${valueIndex}
        RETURNING id, email, first_name, last_name, role, is_active, 
                  email_verified, last_login, failed_login_attempts, 
                  locked_until, created_at, updated_at
      `
      
      const result = await database.query(query, values)
      return result.rows[0]
    } catch (error) {
      throw error
    }
  }

  /**
   * Verify user password
   * @param {string} password - Plain text password
   * @param {string} passwordHash - Hashed password from database
   * @returns {Promise<boolean>} True if password matches
   */
  static async verifyPassword(password, passwordHash) {
    try {
      return await bcrypt.compare(password, passwordHash)
    } catch (error) {
      throw error
    }
  }

  /**
   * Update user password
   * @param {string} userId - User ID
   * @param {string} newPassword - New plain text password
   * @returns {Promise<boolean>} True if successful
   */
  static async updatePassword(userId, newPassword) {
    try {
      const passwordHash = await bcrypt.hash(newPassword, 12)
      
      const query = `
        UPDATE users 
        SET password_hash = $1, password_reset_token = NULL, password_reset_expires = NULL
        WHERE id = $2
      `
      
      const result = await database.query(query, [passwordHash, userId])
      return result.rowCount > 0
    } catch (error) {
      throw error
    }
  }

  /**
   * Record login attempt
   * @param {string} userId - User ID
   * @param {boolean} successful - Whether login was successful
   * @returns {Promise<void>}
   */
  static async recordLoginAttempt(userId, successful) {
    try {
      if (successful) {
        // Reset failed attempts and update last login
        const query = `
          UPDATE users 
          SET last_login = NOW(), failed_login_attempts = 0, locked_until = NULL
          WHERE id = $1
        `
        await database.query(query, [userId])
      } else {
        // Increment failed attempts
        const query = `
          UPDATE users 
          SET failed_login_attempts = failed_login_attempts + 1,
              locked_until = CASE 
                WHEN failed_login_attempts + 1 >= 5 
                THEN NOW() + INTERVAL '15 minutes'
                ELSE locked_until
              END
          WHERE id = $1
        `
        await database.query(query, [userId])
      }
    } catch (error) {
      throw error
    }
  }

  /**
   * Check if user is locked due to failed login attempts
   * @param {Object} user - User object
   * @returns {boolean} True if user is locked
   */
  static isUserLocked(user) {
    if (!user.locked_until) {
      return false
    }
    
    return new Date(user.locked_until) > new Date()
  }

  /**
   * Get all users with pagination
   * @param {Object} options - Query options (page, limit, role, active)
   * @returns {Promise<Object>} Users list with pagination info
   */
  static async findAll(options = {}) {
    try {
      const { page = 1, limit = 10, role, active } = options
      const offset = (page - 1) * limit
      
      let whereClause = ''
      const values = []
      let valueIndex = 1

      const conditions = []
      
      if (role) {
        conditions.push(`role = $${valueIndex}`)
        values.push(role)
        valueIndex++
      }
      
      if (active !== undefined) {
        conditions.push(`is_active = $${valueIndex}`)
        values.push(active)
        valueIndex++
      }
      
      if (conditions.length > 0) {
        whereClause = `WHERE ${conditions.join(' AND ')}`
      }

      // Get total count
      const countQuery = `SELECT COUNT(*) FROM users ${whereClause}`
      const countResult = await database.query(countQuery, values)
      const total = parseInt(countResult.rows[0].count)

      // Get users
      values.push(limit, offset)
      const usersQuery = `
        SELECT id, email, first_name, last_name, role, is_active, 
               email_verified, last_login, created_at, updated_at
        FROM users 
        ${whereClause}
        ORDER BY created_at DESC
        LIMIT $${valueIndex} OFFSET $${valueIndex + 1}
      `
      
      const usersResult = await database.query(usersQuery, values)
      
      return {
        users: usersResult.rows,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit)
        }
      }
    } catch (error) {
      throw error
    }
  }

  /**
   * Delete user by ID (soft delete by setting is_active = false)
   * @param {string} userId - User ID
   * @returns {Promise<boolean>} True if successful
   */
  static async deleteById(userId) {
    try {
      const query = `UPDATE users SET is_active = false WHERE id = $1`
      const result = await database.query(query, [userId])
      return result.rowCount > 0
    } catch (error) {
      throw error
    }
  }

  /**
   * Count users by role
   * @returns {Promise<Object>} User counts by role
   */
  static async getUserStats() {
    try {
      const query = `
        SELECT 
          role,
          COUNT(*) as count,
          COUNT(CASE WHEN is_active = true THEN 1 END) as active_count,
          COUNT(CASE WHEN email_verified = true THEN 1 END) as verified_count
        FROM users 
        GROUP BY role
        ORDER BY role
      `
      
      const result = await database.query(query)
      return result.rows
    } catch (error) {
      throw error
    }
  }
}

module.exports = UserModel