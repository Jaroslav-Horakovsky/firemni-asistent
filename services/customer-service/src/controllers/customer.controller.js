const { customerService } = require('../services/customer.service')
const { CustomerModel } = require('../models/customer.model')

class CustomerController {
  /**
   * Create a new customer
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async createCustomer(req, res) {
    try {
      // Validate request data
      const { error, value } = CustomerModel.validateCreate(req.body)
      if (error) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details: error.details.map(detail => ({
            field: detail.path.join('.'),
            message: detail.message
          }))
        })
      }

      // Create customer
      const customer = await customerService.createCustomer(value)

      res.status(201).json({
        success: true,
        message: 'Customer created successfully',
        data: {
          customer: customer.toJSON()
        }
      })
    } catch (error) {
      console.error('[CustomerController] Error creating customer:', error.message)
      
      if (error.message.includes('already exists')) {
        return res.status(409).json({
          success: false,
          error: error.message,
          code: 'CUSTOMER_EXISTS'
        })
      }

      res.status(500).json({
        success: false,
        error: 'Failed to create customer',
        code: 'INTERNAL_SERVER_ERROR'
      })
    }
  }

  /**
   * Get customer by ID
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async getCustomer(req, res) {
    try {
      // Validate customer ID
      const { error } = CustomerModel.validateId(req.params.id)
      if (error) {
        return res.status(400).json({
          success: false,
          error: 'Invalid customer ID',
          code: 'VALIDATION_ERROR'
        })
      }

      const customer = await customerService.getCustomerById(req.params.id)

      if (!customer) {
        return res.status(404).json({
          success: false,
          error: 'Customer not found',
          code: 'CUSTOMER_NOT_FOUND'
        })
      }

      res.json({
        success: true,
        data: {
          customer: customer.toJSON()
        }
      })
    } catch (error) {
      console.error('[CustomerController] Error getting customer:', error.message)
      
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve customer',
        code: 'INTERNAL_SERVER_ERROR'
      })
    }
  }

  /**
   * Update customer
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async updateCustomer(req, res) {
    try {
      // Validate customer ID
      const { error: idError } = CustomerModel.validateId(req.params.id)
      if (idError) {
        return res.status(400).json({
          success: false,
          error: 'Invalid customer ID',
          code: 'VALIDATION_ERROR'
        })
      }

      // Validate request data
      const { error, value } = CustomerModel.validateUpdate(req.body)
      if (error) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details: error.details.map(detail => ({
            field: detail.path.join('.'),
            message: detail.message
          }))
        })
      }

      const customer = await customerService.updateCustomer(req.params.id, value)

      if (!customer) {
        return res.status(404).json({
          success: false,
          error: 'Customer not found',
          code: 'CUSTOMER_NOT_FOUND'
        })
      }

      res.json({
        success: true,
        message: 'Customer updated successfully',
        data: {
          customer: customer.toJSON()
        }
      })
    } catch (error) {
      console.error('[CustomerController] Error updating customer:', error.message)
      
      if (error.message.includes('already exists')) {
        return res.status(409).json({
          success: false,
          error: error.message,
          code: 'EMAIL_CONFLICT'
        })
      }

      res.status(500).json({
        success: false,
        error: 'Failed to update customer',
        code: 'INTERNAL_SERVER_ERROR'
      })
    }
  }

  /**
   * Delete customer (soft delete)
   * @param {Object} req - Express request object  
   * @param {Object} res - Express response object
   */
  async deleteCustomer(req, res) {
    try {
      // Validate customer ID
      const { error } = CustomerModel.validateId(req.params.id)
      if (error) {
        return res.status(400).json({
          success: false,
          error: 'Invalid customer ID',
          code: 'VALIDATION_ERROR'
        })
      }

      const deleted = await customerService.deleteCustomer(req.params.id)

      if (!deleted) {
        return res.status(404).json({
          success: false,
          error: 'Customer not found or already deleted',
          code: 'CUSTOMER_NOT_FOUND'
        })
      }

      res.json({
        success: true,
        message: 'Customer deleted successfully'
      })
    } catch (error) {
      console.error('[CustomerController] Error deleting customer:', error.message)
      
      res.status(500).json({
        success: false,
        error: 'Failed to delete customer',
        code: 'INTERNAL_SERVER_ERROR'
      })
    }
  }

  /**
   * Get customers with pagination and filtering
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async getCustomers(req, res) {
    try {
      // Validate query parameters
      const { error, value } = CustomerModel.validateQuery(req.query)
      if (error) {
        return res.status(400).json({
          success: false,
          error: 'Invalid query parameters',
          code: 'VALIDATION_ERROR',
          details: error.details.map(detail => ({
            field: detail.path.join('.'),
            message: detail.message
          }))
        })
      }

      const result = await customerService.getCustomers(value)

      res.json({
        success: true,
        data: {
          customers: result.customers.map(customer => customer.toJSON()),
          pagination: result.pagination
        }
      })
    } catch (error) {
      console.error('[CustomerController] Error getting customers:', error.message)
      
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve customers',
        code: 'INTERNAL_SERVER_ERROR'
      })
    }
  }

  /**
   * Get customer statistics
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async getCustomerStats(req, res) {
    try {
      const stats = await customerService.getCustomerStats()

      res.json({
        success: true,
        data: {
          statistics: stats
        }
      })
    } catch (error) {
      console.error('[CustomerController] Error getting customer stats:', error.message)
      
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve customer statistics',
        code: 'INTERNAL_SERVER_ERROR'
      })
    }
  }

  /**
   * Restore deleted customer
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async restoreCustomer(req, res) {
    try {
      // Validate customer ID
      const { error } = CustomerModel.validateId(req.params.id)
      if (error) {
        return res.status(400).json({
          success: false,
          error: 'Invalid customer ID',
          code: 'VALIDATION_ERROR'
        })
      }

      const restored = await customerService.restoreCustomer(req.params.id)

      if (!restored) {
        return res.status(404).json({
          success: false,
          error: 'Customer not found or already active',
          code: 'CUSTOMER_NOT_FOUND'
        })
      }

      res.json({
        success: true,
        message: 'Customer restored successfully'
      })
    } catch (error) {
      console.error('[CustomerController] Error restoring customer:', error.message)
      
      res.status(500).json({
        success: false,
        error: 'Failed to restore customer',
        code: 'INTERNAL_SERVER_ERROR'
      })
    }
  }
}

// Create singleton instance
const customerController = new CustomerController()

module.exports = {
  CustomerController,
  customerController
}