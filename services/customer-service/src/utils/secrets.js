const { SecretManagerServiceClient } = require('@google-cloud/secret-manager')

class SecretsManager {
  constructor() {
    this.client = new SecretManagerServiceClient()
    this.projectId = process.env.GOOGLE_CLOUD_PROJECT || 'firemni-asistent'
    this.cache = new Map()
    this.cacheExpiry = 5 * 60 * 1000 // 5 minutes cache
  }

  /**
   * Get secret value from Google Secret Manager with caching
   * @param {string} secretName - Name of the secret
   * @returns {Promise<string>} Secret value
   */
  async getSecret(secretName) {
    try {
      // Check cache first
      const cacheKey = secretName
      const cached = this.cache.get(cacheKey)
      
      if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
        console.log(`[SecretsManager] Using cached value for ${secretName}`)
        return cached.value
      }

      // Fetch from Secret Manager
      const name = `projects/${this.projectId}/secrets/${secretName}/versions/latest`
      console.log(`[SecretsManager] Fetching secret: ${name}`)
      
      const [version] = await this.client.accessSecretVersion({ name })
      const payload = version.payload.data.toString()

      // Cache the result
      this.cache.set(cacheKey, {
        value: payload,
        timestamp: Date.now()
      })

      console.log(`[SecretsManager] Successfully retrieved ${secretName}`)
      return payload
    } catch (error) {
      console.error(`[SecretsManager] Error retrieving secret ${secretName}:`, error.message)
      
      // For development, try environment variables as fallback
      if (process.env.NODE_ENV === 'development') {
        const envValue = process.env[secretName]
        if (envValue) {
          console.log(`[SecretsManager] Using environment variable fallback for ${secretName}`)
          return envValue
        }
      }
      
      throw new Error(`Failed to retrieve secret: ${secretName}`)
    }
  }

  /**
   * Get multiple secrets at once
   * @param {string[]} secretNames - Array of secret names
   * @returns {Promise<Object>} Object with secret names as keys and values
   */
  async getSecrets(secretNames) {
    try {
      const promises = secretNames.map(async (name) => ({
        name,
        value: await this.getSecret(name)
      }))

      const results = await Promise.all(promises)
      
      return results.reduce((acc, { name, value }) => {
        acc[name] = value
        return acc
      }, {})
    } catch (error) {
      console.error('[SecretsManager] Error retrieving multiple secrets:', error.message)
      throw error
    }
  }

  /**
   * Get database URL for specific service
   * @param {string} serviceName - Name of the service (user, customer, order, etc.)
   * @returns {Promise<string>} Database connection URL
   */
  async getDatabaseUrl(serviceName) {
    const secretName = `DB_${serviceName.toUpperCase()}_SERVICE_URL`
    return await this.getSecret(secretName)
  }

  /**
   * Get JWT signing key
   * @returns {Promise<string>} JWT signing key
   */
  async getJwtSigningKey() {
    return await this.getSecret('JWT_SIGNING_KEY')
  }

  /**
   * Get JWT refresh key
   * @returns {Promise<string>} JWT refresh key
   */
  async getJwtRefreshKey() {
    return await this.getSecret('JWT_REFRESH_KEY')
  }

  /**
   * Get external API key
   * @param {string} service - Service name (sendgrid, stripe, etc.)
   * @returns {Promise<string>} API key
   */
  async getApiKey(service) {
    const secretName = `${service.toUpperCase()}_API_KEY`
    return await this.getSecret(secretName)
  }

  /**
   * Clear cache (useful for testing or forced refresh)
   */
  clearCache() {
    this.cache.clear()
    console.log('[SecretsManager] Cache cleared')
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
      expiryTime: this.cacheExpiry
    }
  }

  /**
   * Health check for Secret Manager connectivity
   * @returns {Promise<boolean>} True if healthy
   */
  async healthCheck() {
    try {
      // Try to access a known secret
      await this.getSecret('JWT_SIGNING_KEY')
      return true
    } catch (error) {
      console.error('[SecretsManager] Health check failed:', error.message)
      return false
    }
  }
}

// Create singleton instance
const secretsManager = new SecretsManager()

module.exports = {
  SecretsManager,
  secretsManager
}