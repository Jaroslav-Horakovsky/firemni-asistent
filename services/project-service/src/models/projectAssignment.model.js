const Joi = require('joi')

/**
 * ProjectAssignment Model - Team assignment data structure with validation
 */
class ProjectAssignment {
  constructor(data = {}) {
    this.id = data.id
    this.project_id = data.project_id
    this.employee_id = data.employee_id
    this.role = data.role
    this.allocation_percentage = data.allocation_percentage || 100
    this.start_date = data.start_date
    this.end_date = data.end_date
    this.created_at = data.created_at
  }

  /**
   * Validate assignment data
   * @returns {Object} Validation result
   */
  validate() {
    const errors = []

    // Required fields validation
    if (!this.project_id) {
      errors.push('Project ID is required')
    }

    if (!this.employee_id) {
      errors.push('Employee ID is required')
    }

    // Allocation percentage validation
    if (this.allocation_percentage !== undefined && 
        (this.allocation_percentage < 1 || this.allocation_percentage > 100)) {
      errors.push('Allocation percentage must be between 1 and 100')
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
   * Convert assignment to JSON representation
   * @returns {Object} Assignment as plain object
   */
  toJSON() {
    return {
      id: this.id,
      project_id: this.project_id,
      employee_id: this.employee_id,
      role: this.role,
      allocation_percentage: this.allocation_percentage,
      start_date: this.start_date,
      end_date: this.end_date,
      created_at: this.created_at
    }
  }

  /**
   * Create ProjectAssignment instance from database row
   * @param {Object} row - Database row
   * @returns {ProjectAssignment} Assignment instance
   */
  static fromDatabaseRow(row) {
    return new ProjectAssignment(row)
  }

  /**
   * Validate assignment creation data
   * @param {Object} data - Assignment data to validate
   * @returns {Object} Joi validation result
   */
  static validateCreate(data) {
    const schema = Joi.object({
      project_id: Joi.string().uuid().required()
        .messages({
          'string.uuid': 'Project ID must be a valid UUID',
          'any.required': 'Project ID is required'
        }),
      
      employee_id: Joi.string().uuid().required()
        .messages({
          'string.uuid': 'Employee ID must be a valid UUID',
          'any.required': 'Employee ID is required'
        }),
      
      role: Joi.string().max(100).optional().allow(null, ''),
      
      allocation_percentage: Joi.number().integer().min(1).max(100).default(100)
        .messages({
          'number.min': 'Allocation percentage must be at least 1',
          'number.max': 'Allocation percentage cannot exceed 100'
        }),
      
      start_date: Joi.date().optional().allow(null),
      
      end_date: Joi.date().optional().allow(null)
    })

    return schema.validate(data, { abortEarly: false })
  }

  /**
   * Validate assignment update data
   * @param {Object} data - Assignment data to validate
   * @returns {Object} Joi validation result
   */
  static validateUpdate(data) {
    const schema = Joi.object({
      role: Joi.string().max(100).optional().allow(null, ''),
      
      allocation_percentage: Joi.number().integer().min(1).max(100).optional()
        .messages({
          'number.min': 'Allocation percentage must be at least 1',
          'number.max': 'Allocation percentage cannot exceed 100'
        }),
      
      start_date: Joi.date().optional().allow(null),
      
      end_date: Joi.date().optional().allow(null)
    })

    return schema.validate(data, { abortEarly: false })
  }

  /**
   * Validate assignment ID
   * @param {string} id - Assignment ID to validate
   * @returns {Object} Joi validation result
   */
  static validateId(id) {
    const schema = Joi.string().uuid().required()
      .messages({
        'string.uuid': 'Assignment ID must be a valid UUID',
        'any.required': 'Assignment ID is required'
      })

    return schema.validate(id)
  }
}

// Create ProjectAssignmentModel alias for consistency
const ProjectAssignmentModel = ProjectAssignment

module.exports = {
  ProjectAssignment,
  ProjectAssignmentModel
}