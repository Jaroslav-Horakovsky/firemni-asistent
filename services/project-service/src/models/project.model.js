const Joi = require('joi')

/**
 * Project Model - Complete project data structure with validation
 */
class Project {
  constructor(data = {}) {
    this.id = data.id
    this.name = data.name
    this.description = data.description
    this.customer_id = data.customer_id
    this.order_id = data.order_id
    this.status = data.status || 'planning'
    this.start_date = data.start_date
    this.end_date = data.end_date
    this.estimated_hours = data.estimated_hours
    this.budget_amount = data.budget_amount
    this.created_at = data.created_at
    this.updated_at = data.updated_at
  }

  /**
   * Validate project data
   * @returns {Object} Validation result
   */
  validate() {
    const errors = []

    // Required fields validation
    if (!this.name) {
      errors.push('Project name is required')
    }

    if (!this.customer_id) {
      errors.push('Customer ID is required')
    }

    // Status validation
    const validStatuses = ['planning', 'active', 'on-hold', 'completed', 'cancelled']
    if (this.status && !validStatuses.includes(this.status)) {
      errors.push('Invalid project status')
    }

    // Budget validation
    if (this.budget_amount !== undefined && this.budget_amount < 0) {
      errors.push('Budget amount must be greater than or equal to 0')
    }

    // Estimated hours validation
    if (this.estimated_hours !== undefined && this.estimated_hours < 0) {
      errors.push('Estimated hours must be greater than or equal to 0')
    }

    // Date validation
    if (this.start_date && this.end_date && new Date(this.start_date) > new Date(this.end_date)) {
      errors.push('Start date must be before end date')
    }

    return {
      isValid: errors.length === 0,
      errors
    }
  }

  /**
   * Convert project to JSON representation
   * @returns {Object} Project as plain object
   */
  toJSON() {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      customer_id: this.customer_id,
      order_id: this.order_id,
      status: this.status,
      start_date: this.start_date,
      end_date: this.end_date,
      estimated_hours: this.estimated_hours,
      budget_amount: this.budget_amount,
      created_at: this.created_at,
      updated_at: this.updated_at
    }
  }

  /**
   * Create Project instance from database row
   * @param {Object} row - Database row
   * @returns {Project} Project instance
   */
  static fromDatabaseRow(row) {
    return new Project(row)
  }

  /**
   * Get status label for UI
   * @returns {string} Human-readable status
   */
  getStatusLabel() {
    const statusLabels = {
      planning: 'Planning',
      active: 'Active',
      'on-hold': 'On Hold',
      completed: 'Completed',
      cancelled: 'Cancelled'
    }
    
    return statusLabels[this.status] || 'Unknown'
  }

  /**
   * Get status color for UI
   * @returns {string} Color code
   */
  getStatusColor() {
    const statusColors = {
      planning: '#17a2b8',    // Info blue
      active: '#28a745',      // Green
      'on-hold': '#ffc107',   // Yellow
      completed: '#6c757d',   // Gray
      cancelled: '#dc3545'    // Red
    }
    
    return statusColors[this.status] || '#6c757d'
  }

  /**
   * Validate project creation data
   * @param {Object} data - Project data to validate
   * @returns {Object} Joi validation result
   */
  static validateCreate(data) {
    const schema = Joi.object({
      name: Joi.string().min(1).max(255).required()
        .messages({
          'string.min': 'Project name cannot be empty',
          'string.max': 'Project name cannot exceed 255 characters',
          'any.required': 'Project name is required'
        }),
      
      description: Joi.string().max(5000).optional().allow(null, ''),
      
      customer_id: Joi.string().uuid().required()
        .messages({
          'string.uuid': 'Customer ID must be a valid UUID',
          'any.required': 'Customer ID is required'
        }),
      
      order_id: Joi.number().integer().positive().optional().allow(null)
        .messages({
          'number.positive': 'Order ID must be a positive number'
        }),
      
      status: Joi.string().valid('planning', 'active', 'on-hold', 'completed', 'cancelled').default('planning')
        .messages({
          'any.only': 'Status must be one of: planning, active, on-hold, completed, cancelled'
        }),
      
      start_date: Joi.date().optional().allow(null),
      
      end_date: Joi.date().optional().allow(null),
      
      estimated_hours: Joi.number().integer().min(0).optional().allow(null)
        .messages({
          'number.min': 'Estimated hours must be greater than or equal to 0'
        }),
      
      budget_amount: Joi.number().min(0).precision(2).optional().allow(null)
        .messages({
          'number.min': 'Budget amount must be greater than or equal to 0'
        })
    })

    return schema.validate(data, { abortEarly: false })
  }

  /**
   * Validate project update data
   * @param {Object} data - Project data to validate
   * @returns {Object} Joi validation result
   */
  static validateUpdate(data) {
    const schema = Joi.object({
      name: Joi.string().min(1).max(255).optional()
        .messages({
          'string.min': 'Project name cannot be empty',
          'string.max': 'Project name cannot exceed 255 characters'
        }),
      
      description: Joi.string().max(5000).optional().allow(null, ''),
      
      customer_id: Joi.string().uuid().optional()
        .messages({
          'string.uuid': 'Customer ID must be a valid UUID'
        }),
      
      order_id: Joi.number().integer().positive().optional().allow(null)
        .messages({
          'number.positive': 'Order ID must be a positive number'
        }),
      
      status: Joi.string().valid('planning', 'active', 'on-hold', 'completed', 'cancelled').optional()
        .messages({
          'any.only': 'Status must be one of: planning, active, on-hold, completed, cancelled'
        }),
      
      start_date: Joi.date().optional().allow(null),
      
      end_date: Joi.date().optional().allow(null),
      
      estimated_hours: Joi.number().integer().min(0).optional().allow(null)
        .messages({
          'number.min': 'Estimated hours must be greater than or equal to 0'
        }),
      
      budget_amount: Joi.number().min(0).precision(2).optional().allow(null)
        .messages({
          'number.min': 'Budget amount must be greater than or equal to 0'
        })
    })

    return schema.validate(data, { abortEarly: false })
  }

  /**
   * Validate project ID
   * @param {string} id - Project ID to validate
   * @returns {Object} Joi validation result
   */
  static validateId(id) {
    const schema = Joi.string().uuid().required()
      .messages({
        'string.uuid': 'Project ID must be a valid UUID',
        'any.required': 'Project ID is required'
      })

    return schema.validate(id)
  }

  /**
   * Validate query parameters for project listing
   * @param {Object} query - Query parameters to validate
   * @returns {Object} Joi validation result
   */
  static validateQuery(query) {
    const schema = Joi.object({
      page: Joi.number().integer().min(1).default(1),
      limit: Joi.number().integer().min(1).max(100).default(20),
      status: Joi.string().valid('planning', 'active', 'on-hold', 'completed', 'cancelled').optional(),
      customer_id: Joi.string().uuid().optional(),
      search: Joi.string().max(255).optional().allow(''),
      sortBy: Joi.string().valid(
        'created_at', 'updated_at', 'name', 'status', 'start_date', 'end_date', 'budget_amount'
      ).default('created_at'),
      sortOrder: Joi.string().valid('asc', 'desc').default('desc')
    })

    return schema.validate(query, { abortEarly: false })
  }
}

// Create ProjectModel alias for consistency with other services
const ProjectModel = Project

module.exports = {
  Project,
  ProjectModel
}