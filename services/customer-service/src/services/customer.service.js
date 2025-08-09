const { database } = require('../utils/database')
const { CustomerModel } = require('../models/customer.model')
const logger = require('../utils/logger')

class CustomerService {
  constructor() {
    this.db = database
  }

  /**
   * Create a new customer
   * @param {Object} customerData - Customer data
   * @returns {Promise<CustomerModel>} Created customer
   */
  async createCustomer(customerData) {
    try {
      logger.info('Creating new customer', {
        companyName: customerData.companyName,
        email: customerData.email
      })

      // Check if customer with email already exists
      const existingCustomer = await this.findByEmail(customerData.email)
      if (existingCustomer) {
        throw new Error('Customer with this email already exists')
      }

      const customer = new CustomerModel(customerData)
      const dbCustomer = customer.toDatabase()

      const insertQuery = `
        INSERT INTO customers (
          id, company_name, contact_person, email, phone, 
          address_line1, address_line2, city, postal_code, country,
          tax_id, vat_id, payment_terms, credit_limit, is_active, notes
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16
        ) RETURNING *
      `

      const values = [
        dbCustomer.id,
        dbCustomer.company_name,
        dbCustomer.contact_person,
        dbCustomer.email,
        dbCustomer.phone,
        dbCustomer.address_line1,
        dbCustomer.address_line2,
        dbCustomer.city,
        dbCustomer.postal_code,
        dbCustomer.country,
        dbCustomer.tax_id,
        dbCustomer.vat_id,
        dbCustomer.payment_terms,
        dbCustomer.credit_limit,
        dbCustomer.is_active,
        dbCustomer.notes
      ]

      const result = await this.db.query(insertQuery, values)
      const createdCustomer = CustomerModel.fromDatabase(result.rows[0])

      logger.info('Customer created successfully', {
        customerId: createdCustomer.id,
        companyName: createdCustomer.companyName
      })
      return createdCustomer
    } catch (error) {
      logger.error('Error creating customer', {
        error: error.message,
        companyName: customerData.companyName,
        email: customerData.email
      })
      throw error
    }
  }

  /**
   * Get customer by ID
   * @param {string} customerId - Customer ID
   * @returns {Promise<CustomerModel|null>} Customer or null if not found
   */
  async getCustomerById(customerId) {
    try {
      logger.info('Fetching customer by ID', { customerId })

      const query = 'SELECT * FROM customers WHERE id = $1'
      const result = await this.db.query(query, [customerId])

      if (result.rows.length === 0) {
        logger.info('Customer not found', { customerId })
        return null
      }

      const customer = CustomerModel.fromDatabase(result.rows[0])
      logger.info('Customer found', { 
        customerId,
        companyName: customer.companyName
      })
      return customer
    } catch (error) {
      logger.error('Error fetching customer by ID', {
        error: error.message,
        customerId
      })
      throw error
    }
  }

  /**
   * Get customer by email
   * @param {string} email - Customer email
   * @returns {Promise<CustomerModel|null>} Customer or null if not found
   */
  async findByEmail(email) {
    try {
      const query = 'SELECT * FROM customers WHERE email = $1'
      const result = await this.db.query(query, [email])

      if (result.rows.length === 0) {
        return null
      }

      return CustomerModel.fromDatabase(result.rows[0])
    } catch (error) {
      console.error('[CustomerService] Error finding customer by email:', error.message)
      throw error
    }
  }

  /**
   * Update customer
   * @param {string} customerId - Customer ID
   * @param {Object} updateData - Data to update
   * @returns {Promise<CustomerModel|null>} Updated customer or null if not found
   */
  async updateCustomer(customerId, updateData) {
    try {
      console.log('[CustomerService] Updating customer:', customerId)

      // Check if customer exists
      const existingCustomer = await this.getCustomerById(customerId)
      if (!existingCustomer) {
        return null
      }

      // Check if email is being changed and doesn't conflict
      if (updateData.email && updateData.email !== existingCustomer.email) {
        const emailConflict = await this.findByEmail(updateData.email)
        if (emailConflict) {
          throw new Error('Another customer with this email already exists')
        }
      }

      // Build dynamic update query
      const updateFields = []
      const values = []
      let paramIndex = 1

      Object.keys(updateData).forEach(key => {
        if (updateData[key] !== undefined) {
          // Convert camelCase to snake_case for database
          const dbField = this.camelToSnake(key)
          updateFields.push(`${dbField} = $${paramIndex}`)
          values.push(updateData[key])
          paramIndex++
        }
      })

      if (updateFields.length === 0) {
        console.log('[CustomerService] No fields to update')
        return existingCustomer
      }

      // Add updated_at
      updateFields.push(`updated_at = NOW()`)

      const query = `
        UPDATE customers 
        SET ${updateFields.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING *
      `
      values.push(customerId)

      const result = await this.db.query(query, values)
      const updatedCustomer = CustomerModel.fromDatabase(result.rows[0])

      console.log('[CustomerService] Customer updated successfully:', updatedCustomer.companyName)
      return updatedCustomer
    } catch (error) {
      console.error('[CustomerService] Error updating customer:', error.message)
      throw error
    }
  }

  /**
   * Delete customer (soft delete by setting is_active to false)
   * @param {string} customerId - Customer ID
   * @returns {Promise<boolean>} True if deleted, false if not found
   */
  async deleteCustomer(customerId) {
    try {
      console.log('[CustomerService] Soft deleting customer:', customerId)

      const query = `
        UPDATE customers 
        SET is_active = false, updated_at = NOW()
        WHERE id = $1 AND is_active = true
        RETURNING id
      `

      const result = await this.db.query(query, [customerId])

      if (result.rows.length === 0) {
        console.log('[CustomerService] Customer not found or already deleted:', customerId)
        return false
      }

      console.log('[CustomerService] Customer deleted successfully:', customerId)
      return true
    } catch (error) {
      console.error('[CustomerService] Error deleting customer:', error.message)
      throw error
    }
  }

  /**
   * Get customers with pagination and filtering
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Paginated customers result
   */
  async getCustomers(options = {}) {
    try {
      const {
        page = 1,
        limit = 20,
        search = '',
        isActive = true,
        sortBy = 'createdAt',
        sortOrder = 'desc'
      } = options

      console.log('[CustomerService] Fetching customers with options:', options)

      const offset = (page - 1) * limit

      // Build WHERE clause
      const whereConditions = []
      const queryParams = []
      let paramIndex = 1

      // Active filter
      if (isActive !== undefined) {
        whereConditions.push(`is_active = $${paramIndex}`)
        queryParams.push(isActive)
        paramIndex++
      }

      // Search filter
      if (search) {
        const searchFields = CustomerModel.getSearchableFields()
        const searchConditions = searchFields.map(field => 
          `${field} ILIKE $${paramIndex}`
        ).join(' OR ')
        whereConditions.push(`(${searchConditions})`)
        queryParams.push(`%${search}%`)
        paramIndex++
      }

      const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : ''

      // Build ORDER BY clause
      const sortableFields = CustomerModel.getSortableFields()
      const dbSortField = sortableFields[sortBy] || 'created_at'
      const orderClause = `ORDER BY ${dbSortField} ${sortOrder.toUpperCase()}`

      // Count total records
      const countQuery = `SELECT COUNT(*) FROM customers ${whereClause}`
      const countResult = await this.db.query(countQuery, queryParams.slice(0, paramIndex - 1))
      const totalRecords = parseInt(countResult.rows[0].count)

      // Fetch paginated results
      const dataQuery = `
        SELECT * FROM customers 
        ${whereClause}
        ${orderClause}
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `
      queryParams.push(limit, offset)

      const result = await this.db.query(dataQuery, queryParams)
      const customers = result.rows.map(row => CustomerModel.fromDatabase(row))

      const totalPages = Math.ceil(totalRecords / limit)

      console.log(`[CustomerService] Found ${customers.length} customers (page ${page}/${totalPages})`)

      return {
        customers,
        pagination: {
          currentPage: page,
          totalPages,
          totalRecords,
          hasNextPage: page < totalPages,
          hasPreviousPage: page > 1,
          limit
        }
      }
    } catch (error) {
      console.error('[CustomerService] Error fetching customers:', error.message)
      throw error
    }
  }

  /**
   * Get customer statistics
   * @returns {Promise<Object>} Customer statistics
   */
  async getCustomerStats() {
    try {
      console.log('[CustomerService] Fetching customer statistics')

      const statsQuery = `
        SELECT 
          COUNT(*) as total_customers,
          COUNT(*) FILTER (WHERE is_active = true) as active_customers,
          COUNT(*) FILTER (WHERE is_active = false) as inactive_customers,
          COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE - INTERVAL '30 days') as new_customers_30d,
          COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE - INTERVAL '7 days') as new_customers_7d
        FROM customers
      `

      const result = await this.db.query(statsQuery)
      const stats = result.rows[0]

      console.log('[CustomerService] Customer statistics retrieved')
      return {
        totalCustomers: parseInt(stats.total_customers),
        activeCustomers: parseInt(stats.active_customers),
        inactiveCustomers: parseInt(stats.inactive_customers),
        newCustomers30d: parseInt(stats.new_customers_30d),
        newCustomers7d: parseInt(stats.new_customers_7d)
      }
    } catch (error) {
      console.error('[CustomerService] Error fetching customer statistics:', error.message)
      throw error
    }
  }

  /**
   * Convert camelCase to snake_case
   * @param {string} str - String to convert
   * @returns {string} Converted string
   */
  camelToSnake(str) {
    return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`)
  }

  /**
   * Restore deleted customer
   * @param {string} customerId - Customer ID
   * @returns {Promise<boolean>} True if restored, false if not found
   */
  async restoreCustomer(customerId) {
    try {
      console.log('[CustomerService] Restoring customer:', customerId)

      const query = `
        UPDATE customers 
        SET is_active = true, updated_at = NOW()
        WHERE id = $1 AND is_active = false
        RETURNING id
      `

      const result = await this.db.query(query, [customerId])

      if (result.rows.length === 0) {
        console.log('[CustomerService] Customer not found or already active:', customerId)
        return false
      }

      console.log('[CustomerService] Customer restored successfully:', customerId)
      return true
    } catch (error) {
      console.error('[CustomerService] Error restoring customer:', error.message)
      throw error
    }
  }

  /**
   * Get customer statistics
   * @returns {Promise<Object>} Customer statistics
   */
  async getCustomerStats() {
    try {
      console.log('[CustomerService] Fetching customer statistics')

      const statsQuery = `
        SELECT 
          COUNT(*) as total_customers,
          COUNT(*) FILTER (WHERE is_active = true) as active_customers,
          COUNT(*) FILTER (WHERE is_active = false) as inactive_customers,
          COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE - INTERVAL '30 days') as customers_30d,
          COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE - INTERVAL '7 days') as customers_7d,
          COALESCE(AVG(credit_limit), 0) as average_credit_limit
        FROM customers
      `

      const result = await this.db.query(statsQuery)
      const stats = result.rows[0]

      console.log('[CustomerService] Customer statistics retrieved')
      return {
        totalCustomers: parseInt(stats.total_customers),
        activeCustomers: parseInt(stats.active_customers),
        inactiveCustomers: parseInt(stats.inactive_customers),
        customers30d: parseInt(stats.customers_30d),
        customers7d: parseInt(stats.customers_7d),
        averageCreditLimit: parseFloat(stats.average_credit_limit)
      }
    } catch (error) {
      console.error('[CustomerService] Error fetching customer statistics:', error.message)
      throw error
    }
  }
}

// Create singleton instance
const customerService = new CustomerService()

module.exports = {
  CustomerService,
  customerService
}