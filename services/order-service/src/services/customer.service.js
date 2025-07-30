class CustomerService {
  /**
   * Validate customer exists by calling customer-service API
   * @param {string} customerId - Customer ID to validate
   * @param {string} authHeader - Authorization header with Bearer token
   * @returns {Promise<Object|null>} Customer data or null if not found
   */
  static async validateCustomer(customerId, authHeader) {
    try {
      console.log('[CustomerService] Validating customer:', customerId)
      
      if (!customerId || !authHeader) {
        console.log('[CustomerService] Missing customerId or authHeader')
        return null
      }

      const response = await fetch(`http://localhost:3002/customers/${customerId}`, {
        method: 'GET',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        timeout: 5000 // 5 second timeout
      })

      if (response.ok) {
        const result = await response.json()
        console.log('[CustomerService] Customer validation successful:', result.data?.customer?.companyName || 'N/A')
        return result.data?.customer || null
      }

      if (response.status === 404) {
        console.log('[CustomerService] Customer not found:', customerId)
        return null
      }

      if (response.status === 401) {
        console.warn('[CustomerService] Unauthorized request to customer-service')
        throw new Error('Unauthorized: Invalid token')
      }

      console.warn('[CustomerService] Customer validation failed with status:', response.status)
      return null
    } catch (error) {
      console.error('[CustomerService] Error validating customer:', error.message)
      
      if (error.message.includes('Unauthorized')) {
        throw error // Re-throw auth errors
      }
      
      // For network errors, connection issues, etc., return null
      // Don't fail order creation due to temporary customer-service issues
      return null
    }
  }

  /**
   * Get customer details for order display
   * @param {string} customerId - Customer ID
   * @param {string} authHeader - Authorization header with Bearer token
   * @returns {Promise<Object|null>} Customer data or null if not found
   */
  static async getCustomerDetails(customerId, authHeader) {
    try {
      console.log('[CustomerService] Fetching customer details:', customerId)
      
      const response = await fetch(`http://localhost:3002/customers/${customerId}`, {
        method: 'GET',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        timeout: 5000
      })

      if (response.ok) {
        const result = await response.json()
        console.log('[CustomerService] Customer details retrieved:', result.data?.customer?.companyName || 'N/A')
        return result.data?.customer || null
      }

      console.log('[CustomerService] Customer details not found:', customerId)
      return null
    } catch (error) {
      console.error('[CustomerService] Error fetching customer details:', error.message)
      return null
    }
  }

  /**
   * Health check for customer-service connectivity
   * @returns {Promise<boolean>} True if customer-service is reachable
   */
  static async healthCheck() {
    try {
      const response = await fetch('http://localhost:3002/health', {
        method: 'GET',
        timeout: 3000
      })
      
      return response.ok
    } catch (error) {
      console.warn('[CustomerService] Health check failed:', error.message)
      return false
    }
  }
}

module.exports = {
  CustomerService
}