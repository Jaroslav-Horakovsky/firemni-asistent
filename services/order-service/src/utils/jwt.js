const jwt = require('jsonwebtoken')
const { secretsManager } = require('./secrets')

class JWTManager {
  constructor() {
    this.signingKey = null
    this.refreshKey = null
    this.initialized = false
  }

  /**
   * Initialize JWT keys from Secret Manager
   * @returns {Promise<void>}
   */
  async initialize() {
    try {
      console.log('[JWT] Initializing JWT keys from Secret Manager...')
      
      this.signingKey = await secretsManager.getJwtSigningKey()
      this.refreshKey = await secretsManager.getJwtRefreshKey()
      
      this.initialized = true
      console.log('[JWT] JWT keys initialized successfully')
    } catch (error) {
      console.error('[JWT] Failed to initialize JWT keys:', error.message)
      throw new Error('JWT initialization failed')
    }
  }

  /**
   * Generate access token
   * @param {Object} payload - Token payload
   * @param {string} expiresIn - Token expiration (default: 15m)
   * @returns {string} JWT token
   */
  generateAccessToken(payload, expiresIn = '15m') {
    if (!this.initialized || !this.signingKey) {
      throw new Error('JWT manager not initialized')
    }

    try {
      const token = jwt.sign(payload, this.signingKey, {
        expiresIn,
        issuer: 'firemni-asistent',
        audience: 'firemni-asistent-users'
      })

      console.log('[JWT] Access token generated successfully')
      return token
    } catch (error) {
      console.error('[JWT] Error generating access token:', error.message)
      throw new Error('Token generation failed')
    }
  }

  /**
   * Generate refresh token
   * @param {Object} payload - Token payload
   * @param {string} expiresIn - Token expiration (default: 7d)
   * @returns {string} JWT refresh token
   */
  generateRefreshToken(payload, expiresIn = '7d') {
    if (!this.initialized || !this.refreshKey) {
      throw new Error('JWT manager not initialized')
    }

    try {
      const token = jwt.sign(payload, this.refreshKey, {
        expiresIn,
        issuer: 'firemni-asistent',
        audience: 'firemni-asistent-users'
      })

      console.log('[JWT] Refresh token generated successfully')
      return token
    } catch (error) {
      console.error('[JWT] Error generating refresh token:', error.message)
      throw new Error('Refresh token generation failed')
    }
  }

  /**
   * Verify access token
   * @param {string} token - JWT token to verify
   * @returns {Object} Decoded token payload
   */
  verifyAccessToken(token) {
    if (!this.initialized || !this.signingKey) {
      throw new Error('JWT manager not initialized')
    }

    try {
      const decoded = jwt.verify(token, this.signingKey, {
        issuer: 'firemni-asistent',
        audience: 'firemni-asistent-users'
      })

      console.log('[JWT] Access token verified successfully')
      return decoded
    } catch (error) {
      console.error('[JWT] Error verifying access token:', error.message)
      throw error // Re-throw to preserve original error type
    }
  }

  /**
   * Verify refresh token
   * @param {string} token - JWT refresh token to verify
   * @returns {Object} Decoded token payload
   */
  verifyRefreshToken(token) {
    if (!this.initialized || !this.refreshKey) {
      throw new Error('JWT manager not initialized')
    }

    try {
      const decoded = jwt.verify(token, this.refreshKey, {
        issuer: 'firemni-asistent',
        audience: 'firemni-asistent-users'
      })

      console.log('[JWT] Refresh token verified successfully')
      return decoded
    } catch (error) {
      console.error('[JWT] Error verifying refresh token:', error.message)
      throw error // Re-throw to preserve original error type
    }
  }

  /**
   * Decode token without verification (for inspection)
   * @param {string} token - JWT token to decode
   * @returns {Object} Decoded token
   */
  decodeToken(token) {
    try {
      return jwt.decode(token, { complete: true })
    } catch (error) {
      console.error('[JWT] Error decoding token:', error.message)
      throw new Error('Token decode failed')
    }
  }

  /**
   * Generate token pair (access + refresh)
   * @param {Object} payload - Token payload
   * @returns {Object} Object containing access and refresh tokens
   */
  generateTokenPair(payload) {
    const accessToken = this.generateAccessToken(payload)
    const refreshToken = this.generateRefreshToken({ userId: payload.userId })

    return {
      accessToken,
      refreshToken,
      expiresIn: '15m',
      tokenType: 'Bearer'
    }
  }

  /**
   * Health check for JWT functionality
   * @returns {Promise<boolean>} True if healthy
   */
  async healthCheck() {
    try {
      if (!this.initialized) {
        return false
      }

      // Test token generation and verification
      const testPayload = { test: true, userId: 'health-check' }
      const token = this.generateAccessToken(testPayload, '1m')
      const decoded = this.verifyAccessToken(token)

      return decoded.test === true && decoded.userId === 'health-check'
    } catch (error) {
      console.error('[JWT] Health check failed:', error.message)
      return false
    }
  }

  /**
   * Get JWT manager status
   * @returns {Object} Status information
   */
  getStatus() {
    return {
      initialized: this.initialized,
      hasSigningKey: !!this.signingKey,
      hasRefreshKey: !!this.refreshKey
    }
  }
}

// Create singleton instance
const jwtManager = new JWTManager()

module.exports = {
  JWTManager,
  jwtManager
}