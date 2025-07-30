const jwt = require('jsonwebtoken')
const { secretsManager } = require('./secrets')

class JWTManager {
  constructor() {
    this.signingKey = null
    this.refreshKey = null
    this.accessTokenExpiry = '15m' // 15 minutes
    this.refreshTokenExpiry = '7d' // 7 days
  }

  /**
   * Initialize JWT keys from Secret Manager
   * @returns {Promise<void>}
   */
  async initialize() {
    try {
      if (this.signingKey && this.refreshKey) {
        return // Already initialized
      }

      console.log('[JWT] Initializing JWT keys from Secret Manager...')
      
      this.signingKey = await secretsManager.getJwtSigningKey()
      this.refreshKey = await secretsManager.getJwtRefreshKey()
      
      console.log('[JWT] JWT keys initialized successfully')
    } catch (error) {
      console.error('[JWT] Failed to initialize JWT keys:', error.message)
      
      // Fallback to environment variables for development
      if (process.env.NODE_ENV === 'development') {
        this.signingKey = process.env.JWT_SECRET || 'dev-secret-key'
        this.refreshKey = process.env.JWT_REFRESH_SECRET || 'dev-refresh-key'
        console.log('[JWT] Using development fallback keys')
      } else {
        throw error
      }
    }
  }

  /**
   * Generate access token
   * @param {Object} payload - Token payload (user data)
   * @param {string} expiresIn - Token expiry (optional)
   * @returns {Promise<string>} Access token
   */
  async generateAccessToken(payload, expiresIn = this.accessTokenExpiry) {
    await this.initialize()
    
    try {
      const tokenPayload = {
        ...payload,
        type: 'access',
        iat: Math.floor(Date.now() / 1000)
      }

      const token = jwt.sign(tokenPayload, this.signingKey, {
        expiresIn,
        issuer: 'firemni-asistent',
        audience: 'firemni-asistent-users'
      })

      console.log(`[JWT] Access token generated for user: ${payload.userId}`)
      return token
    } catch (error) {
      console.error('[JWT] Error generating access token:', error.message)
      throw new Error('Failed to generate access token')
    }
  }

  /**
   * Generate refresh token
   * @param {Object} payload - Token payload (user data)
   * @param {string} expiresIn - Token expiry (optional)
   * @returns {Promise<string>} Refresh token
   */
  async generateRefreshToken(payload, expiresIn = this.refreshTokenExpiry) {
    await this.initialize()
    
    try {
      const tokenPayload = {
        userId: payload.userId,
        email: payload.email,
        type: 'refresh',
        iat: Math.floor(Date.now() / 1000)
      }

      const token = jwt.sign(tokenPayload, this.refreshKey, {
        expiresIn,
        issuer: 'firemni-asistent',
        audience: 'firemni-asistent-users'
      })

      console.log(`[JWT] Refresh token generated for user: ${payload.userId}`)
      return token
    } catch (error) {
      console.error('[JWT] Error generating refresh token:', error.message)
      throw new Error('Failed to generate refresh token')
    }
  }

  /**
   * Generate both access and refresh tokens
   * @param {Object} payload - Token payload (user data)
   * @returns {Promise<Object>} Object with accessToken and refreshToken
   */
  async generateTokenPair(payload) {
    try {
      const [accessToken, refreshToken] = await Promise.all([
        this.generateAccessToken(payload),
        this.generateRefreshToken(payload)
      ])

      return {
        accessToken,
        refreshToken,
        expiresIn: this.accessTokenExpiry,
        tokenType: 'Bearer'
      }
    } catch (error) {
      console.error('[JWT] Error generating token pair:', error.message)
      throw error
    }
  }

  /**
   * Verify access token
   * @param {string} token - JWT token to verify
   * @returns {Promise<Object>} Decoded token payload
   */
  async verifyAccessToken(token) {
    await this.initialize()
    
    try {
      const decoded = jwt.verify(token, this.signingKey, {
        issuer: 'firemni-asistent',
        audience: 'firemni-asistent-users'
      })

      if (decoded.type !== 'access') {
        throw new Error('Invalid token type')
      }

      return decoded
    } catch (error) {
      if (error.name === 'JsonWebTokenError') {
        throw new Error('Invalid token')
      } else if (error.name === 'TokenExpiredError') {
        throw new Error('Token expired')
      } else if (error.name === 'NotBeforeError') {
        throw new Error('Token not active')
      } else {
        console.error('[JWT] Token verification error:', error.message)
        throw new Error('Token verification failed')
      }
    }
  }

  /**
   * Verify refresh token
   * @param {string} token - JWT refresh token to verify
   * @returns {Promise<Object>} Decoded token payload
   */
  async verifyRefreshToken(token) {
    await this.initialize()
    
    try {
      const decoded = jwt.verify(token, this.refreshKey, {
        issuer: 'firemni-asistent',
        audience: 'firemni-asistent-users'
      })

      if (decoded.type !== 'refresh') {
        throw new Error('Invalid token type')
      }

      return decoded
    } catch (error) {
      if (error.name === 'JsonWebTokenError') {
        throw new Error('Invalid refresh token')
      } else if (error.name === 'TokenExpiredError') {
        throw new Error('Refresh token expired')
      } else if (error.name === 'NotBeforeError') {
        throw new Error('Refresh token not active')
      } else {
        console.error('[JWT] Refresh token verification error:', error.message)
        throw new Error('Refresh token verification failed')
      }
    }
  }

  /**
   * Decode token without verification (for debugging)
   * @param {string} token - JWT token to decode
   * @returns {Object} Decoded token
   */
  decodeToken(token) {
    try {
      return jwt.decode(token, { complete: true })
    } catch (error) {
      console.error('[JWT] Error decoding token:', error.message)
      return null
    }
  }

  /**
   * Check if token is expired
   * @param {string} token - JWT token to check
   * @returns {boolean} True if expired
   */
  isTokenExpired(token) {
    try {
      const decoded = jwt.decode(token)
      if (!decoded || !decoded.exp) {
        return true
      }
      
      return Date.now() >= decoded.exp * 1000
    } catch (error) {
      return true
    }
  }

  /**
   * Get token expiry time
   * @param {string} token - JWT token
   * @returns {Date|null} Expiry date or null if invalid
   */
  getTokenExpiry(token) {
    try {
      const decoded = jwt.decode(token)
      if (!decoded || !decoded.exp) {
        return null
      }
      
      return new Date(decoded.exp * 1000)
    } catch (error) {
      return null
    }
  }

  /**
   * Extract user info from token
   * @param {string} token - JWT token
   * @returns {Object|null} User info or null if invalid
   */
  extractUserInfo(token) {
    try {
      const decoded = jwt.decode(token)
      if (!decoded) {
        return null
      }

      return {
        userId: decoded.userId,
        email: decoded.email,
        role: decoded.role,
        firstName: decoded.firstName,
        lastName: decoded.lastName
      }
    } catch (error) {
      console.error('[JWT] Error extracting user info:', error.message)
      return null
    }
  }

  /**
   * Health check for JWT functionality
   * @returns {Promise<boolean>} True if healthy
   */
  async healthCheck() {
    try {
      await this.initialize()
      
      // Test token generation and verification
      const testPayload = {
        userId: 'test-user-id',
        email: 'test@example.com',
        role: 'user'
      }

      const token = await this.generateAccessToken(testPayload, '1m')
      const decoded = await this.verifyAccessToken(token)
      
      return decoded.userId === testPayload.userId
    } catch (error) {
      console.error('[JWT] Health check failed:', error.message)
      return false
    }
  }
}

// Create singleton instance
const jwtManager = new JWTManager()

module.exports = {
  JWTManager,
  jwtManager
}