const Joi = require('joi')

/**
 * Employee Model - Complete employee data structure with validation for RELACE 31
 */
class Employee {
  constructor(data = {}) {
    this.id = data.id
    this.employee_number = data.employee_number
    this.user_id = data.user_id
    
    // Personal information
    this.first_name = data.first_name
    this.last_name = data.last_name
    this.email = data.email
    this.phone = data.phone
    
    // Employment information
    this.position = data.position
    this.department = data.department
    this.employment_type = data.employment_type || 'full_time'
    this.hourly_rate = data.hourly_rate
    this.hire_date = data.hire_date
    this.is_active = data.is_active !== undefined ? data.is_active : true
    
    // Skills and notes
    this.skills = data.skills || []
    this.notes = data.notes
    
    // Audit fields
    this.created_at = data.created_at
    this.updated_at = data.updated_at
  }

  /**
   * Validate employee data
   * @returns {Object} Validation result
   */
  validate() {
    const errors = []

    // Required fields validation
    if (!this.employee_number) {
      errors.push('Employee number is required')
    }

    if (!this.first_name) {
      errors.push('First name is required')
    }

    if (!this.last_name) {
      errors.push('Last name is required')
    }

    if (!this.email) {
      errors.push('Email is required')
    }

    // Email format validation
    const emailRegex = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/
    if (this.email && !emailRegex.test(this.email)) {
      errors.push('Invalid email format')
    }

    // Employment type validation
    const validEmploymentTypes = ['full_time', 'part_time', 'contractor', 'external']
    if (this.employment_type && !validEmploymentTypes.includes(this.employment_type)) {
      errors.push('Invalid employment type')
    }

    // Hourly rate validation
    if (this.hourly_rate !== undefined && this.hourly_rate < 0) {
      errors.push('Hourly rate must be greater than or equal to 0')
    }

    return {
      isValid: errors.length === 0,
      errors
    }
  }

  /**
   * Convert employee to JSON representation
   * @returns {Object} Employee as plain object
   */
  toJSON() {
    return {
      id: this.id,
      employee_number: this.employee_number,
      user_id: this.user_id,
      
      // Personal information
      first_name: this.first_name,
      last_name: this.last_name,
      full_name: this.first_name && this.last_name ? `${this.first_name} ${this.last_name}` : null,
      email: this.email,
      phone: this.phone,
      
      // Employment information
      position: this.position,
      department: this.department,
      employment_type: this.employment_type,
      hourly_rate: this.hourly_rate,
      hire_date: this.hire_date,
      is_active: this.is_active,
      
      // Skills and notes
      skills: this.skills,
      notes: this.notes,
      
      // Audit fields
      created_at: this.created_at,
      updated_at: this.updated_at
    }
  }

  /**
   * Create Employee instance from database row
   * @param {Object} row - Database row
   * @returns {Employee} Employee instance
   */
  static fromDatabaseRow(row) {
    return new Employee(row)
  }

  /**
   * Get employment type label for UI
   * @returns {string} Human-readable employment type
   */
  getEmploymentTypeLabel() {
    const employmentTypeLabels = {
      full_time: 'Full Time',
      part_time: 'Part Time',
      contractor: 'Contractor',
      external: 'External'
    }
    
    return employmentTypeLabels[this.employment_type] || 'Unknown'
  }

  /**
   * Get employment type color for UI
   * @returns {string} Color code
   */
  getEmploymentTypeColor() {
    const employmentTypeColors = {
      full_time: '#28a745',   // Green
      part_time: '#17a2b8',   // Info blue
      contractor: '#ffc107',  // Yellow
      external: '#fd7e14'     // Orange
    }
    
    return employmentTypeColors[this.employment_type] || '#6c757d'
  }

  /**
   * Validate employee creation data
   * @param {Object} data - Employee data to validate
   * @returns {Object} Joi validation result
   */
  static validateCreate(data) {
    const schema = Joi.object({
      employee_number: Joi.string().min(1).max(50).required()
        .messages({
          'string.min': 'Employee number cannot be empty',
          'string.max': 'Employee number cannot exceed 50 characters',
          'any.required': 'Employee number is required'
        }),
      
      user_id: Joi.string().uuid().optional().allow(null)
        .messages({
          'string.uuid': 'User ID must be a valid UUID'
        }),
      
      first_name: Joi.string().min(1).max(100).required()
        .messages({
          'string.min': 'First name cannot be empty',
          'string.max': 'First name cannot exceed 100 characters',
          'any.required': 'First name is required'
        }),
      
      last_name: Joi.string().min(1).max(100).required()
        .messages({
          'string.min': 'Last name cannot be empty',
          'string.max': 'Last name cannot exceed 100 characters',
          'any.required': 'Last name is required'
        }),
      
      email: Joi.string().email().max(255).required()
        .messages({
          'string.email': 'Email must be a valid email address',
          'string.max': 'Email cannot exceed 255 characters',
          'any.required': 'Email is required'
        }),
      
      phone: Joi.string().max(50).optional().allow(null, ''),
      
      position: Joi.string().max(100).optional().allow(null, ''),
      
      department: Joi.string().max(100).optional().allow(null, ''),
      
      employment_type: Joi.string().valid('full_time', 'part_time', 'contractor', 'external').default('full_time')
        .messages({
          'any.only': 'Employment type must be one of: full_time, part_time, contractor, external'
        }),
      
      hourly_rate: Joi.number().min(0).precision(2).optional().allow(null)
        .messages({
          'number.min': 'Hourly rate must be greater than or equal to 0'
        }),
      
      hire_date: Joi.date().optional().allow(null),
      
      is_active: Joi.boolean().default(true),
      
      skills: Joi.array().items(Joi.string()).optional().default([]),
      
      notes: Joi.string().max(5000).optional().allow(null, '')
    })

    return schema.validate(data, { abortEarly: false })
  }

  /**
   * Validate employee update data
   * @param {Object} data - Employee data to validate
   * @returns {Object} Joi validation result
   */
  static validateUpdate(data) {
    const schema = Joi.object({
      employee_number: Joi.string().min(1).max(50).optional()
        .messages({
          'string.min': 'Employee number cannot be empty',
          'string.max': 'Employee number cannot exceed 50 characters'
        }),
      
      user_id: Joi.string().uuid().optional().allow(null)
        .messages({
          'string.uuid': 'User ID must be a valid UUID'
        }),
      
      first_name: Joi.string().min(1).max(100).optional()
        .messages({
          'string.min': 'First name cannot be empty',
          'string.max': 'First name cannot exceed 100 characters'
        }),
      
      last_name: Joi.string().min(1).max(100).optional()
        .messages({
          'string.min': 'Last name cannot be empty',
          'string.max': 'Last name cannot exceed 100 characters'
        }),
      
      email: Joi.string().email().max(255).optional()
        .messages({
          'string.email': 'Email must be a valid email address',
          'string.max': 'Email cannot exceed 255 characters'
        }),
      
      phone: Joi.string().max(50).optional().allow(null, ''),
      
      position: Joi.string().max(100).optional().allow(null, ''),
      
      department: Joi.string().max(100).optional().allow(null, ''),
      
      employment_type: Joi.string().valid('full_time', 'part_time', 'contractor', 'external').optional()
        .messages({
          'any.only': 'Employment type must be one of: full_time, part_time, contractor, external'
        }),
      
      hourly_rate: Joi.number().min(0).precision(2).optional().allow(null)
        .messages({
          'number.min': 'Hourly rate must be greater than or equal to 0'
        }),
      
      hire_date: Joi.date().optional().allow(null),
      
      is_active: Joi.boolean().optional(),
      
      skills: Joi.array().items(Joi.string()).optional(),
      
      notes: Joi.string().max(5000).optional().allow(null, '')
    })

    return schema.validate(data, { abortEarly: false })
  }

  /**
   * Validate employee ID
   * @param {string} id - Employee ID to validate
   * @returns {Object} Joi validation result
   */
  static validateId(id) {
    const schema = Joi.string().uuid().required()
      .messages({
        'string.uuid': 'Employee ID must be a valid UUID',
        'any.required': 'Employee ID is required'
      })

    return schema.validate(id)
  }

  /**
   * Validate query parameters for employee listing
   * @param {Object} query - Query parameters to validate
   * @returns {Object} Joi validation result
   */
  static validateQuery(query) {
    const schema = Joi.object({
      page: Joi.number().integer().min(1).default(1),
      limit: Joi.number().integer().min(1).max(100).default(20),
      department: Joi.string().max(100).optional(),
      employment_type: Joi.string().valid('full_time', 'part_time', 'contractor', 'external').optional(),
      is_active: Joi.boolean().optional(),
      search: Joi.string().max(255).optional().allow(''),
      sortBy: Joi.string().valid(
        'created_at', 'updated_at', 'employee_number', 'first_name', 'last_name', 
        'email', 'department', 'employment_type', 'hire_date'
      ).default('created_at'),
      sortOrder: Joi.string().valid('asc', 'desc').default('desc')
    })

    return schema.validate(query, { abortEarly: false })
  }
}

// Create EmployeeModel alias for consistency with other services
const EmployeeModel = Employee

module.exports = {
  Employee,
  EmployeeModel
}