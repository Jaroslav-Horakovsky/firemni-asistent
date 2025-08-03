const Joi = require('joi')

/**
 * ProjectTask Model - Task data structure with validation
 */
class ProjectTask {
  constructor(data = {}) {
    this.id = data.id
    this.project_id = data.project_id
    this.name = data.name
    this.description = data.description
    this.assigned_employee_id = data.assigned_employee_id
    this.status = data.status || 'todo'
    this.priority = data.priority || 'medium'
    this.estimated_hours = data.estimated_hours
    this.start_date = data.start_date
    this.due_date = data.due_date
    this.completed_at = data.completed_at
    this.created_at = data.created_at
    this.updated_at = data.updated_at
  }

  /**
   * Validate task data
   * @returns {Object} Validation result
   */
  validate() {
    const errors = []

    // Required fields validation
    if (!this.project_id) {
      errors.push('Project ID is required')
    }

    if (!this.name) {
      errors.push('Task name is required')
    }

    // Status validation
    const validStatuses = ['todo', 'in_progress', 'completed']
    if (this.status && !validStatuses.includes(this.status)) {
      errors.push('Invalid task status')
    }

    // Priority validation
    const validPriorities = ['low', 'medium', 'high', 'critical']
    if (this.priority && !validPriorities.includes(this.priority)) {
      errors.push('Invalid task priority')
    }

    // Estimated hours validation
    if (this.estimated_hours !== undefined && this.estimated_hours < 0) {
      errors.push('Estimated hours must be greater than or equal to 0')
    }

    // Date validation
    if (this.start_date && this.due_date && new Date(this.start_date) > new Date(this.due_date)) {
      errors.push('Start date must be before due date')
    }

    return {
      isValid: errors.length === 0,
      errors
    }
  }

  /**
   * Convert task to JSON representation
   * @returns {Object} Task as plain object
   */
  toJSON() {
    return {
      id: this.id,
      project_id: this.project_id,
      name: this.name,
      description: this.description,
      assigned_employee_id: this.assigned_employee_id,
      status: this.status,
      priority: this.priority,
      estimated_hours: this.estimated_hours,
      start_date: this.start_date,
      due_date: this.due_date,
      completed_at: this.completed_at,
      created_at: this.created_at,
      updated_at: this.updated_at
    }
  }

  /**
   * Create ProjectTask instance from database row
   * @param {Object} row - Database row
   * @returns {ProjectTask} Task instance
   */
  static fromDatabaseRow(row) {
    return new ProjectTask(row)
  }

  /**
   * Get status label for UI
   * @returns {string} Human-readable status
   */
  getStatusLabel() {
    const statusLabels = {
      todo: 'To Do',
      in_progress: 'In Progress', 
      completed: 'Completed'
    }
    
    return statusLabels[this.status] || 'Unknown'
  }

  /**
   * Get status color for UI
   * @returns {string} Color code
   */
  getStatusColor() {
    const statusColors = {
      todo: '#6c757d',        // Gray
      in_progress: '#17a2b8', // Info blue
      completed: '#28a745'    // Green
    }
    
    return statusColors[this.status] || '#6c757d'
  }

  /**
   * Get priority label for UI
   * @returns {string} Human-readable priority
   */
  getPriorityLabel() {
    const priorityLabels = {
      low: 'Low',
      medium: 'Medium',
      high: 'High',
      critical: 'Critical'
    }
    
    return priorityLabels[this.priority] || 'Unknown'
  }

  /**
   * Get priority color for UI
   * @returns {string} Color code
   */
  getPriorityColor() {
    const priorityColors = {
      low: '#28a745',     // Green
      medium: '#ffc107',  // Yellow
      high: '#fd7e14',    // Orange
      critical: '#dc3545' // Red
    }
    
    return priorityColors[this.priority] || '#6c757d'
  }

  /**
   * Validate task creation data
   * @param {Object} data - Task data to validate
   * @returns {Object} Joi validation result
   */
  static validateCreate(data) {
    const schema = Joi.object({
      project_id: Joi.number().integer().positive().required()
        .messages({
          'number.positive': 'Project ID must be a positive number',
          'any.required': 'Project ID is required'
        }),
      
      name: Joi.string().min(1).max(255).required()
        .messages({
          'string.min': 'Task name cannot be empty',
          'string.max': 'Task name cannot exceed 255 characters',
          'any.required': 'Task name is required'
        }),
      
      description: Joi.string().max(5000).optional().allow(null, ''),
      
      assigned_employee_id: Joi.number().integer().positive().optional().allow(null)
        .messages({
          'number.positive': 'Employee ID must be a positive number'
        }),
      
      status: Joi.string().valid('todo', 'in_progress', 'completed').default('todo')
        .messages({
          'any.only': 'Status must be one of: todo, in_progress, completed'
        }),
      
      priority: Joi.string().valid('low', 'medium', 'high', 'critical').default('medium')
        .messages({
          'any.only': 'Priority must be one of: low, medium, high, critical'
        }),
      
      estimated_hours: Joi.number().integer().min(0).optional().allow(null)
        .messages({
          'number.min': 'Estimated hours must be greater than or equal to 0'
        }),
      
      start_date: Joi.date().optional().allow(null),
      
      due_date: Joi.date().optional().allow(null)
    })

    return schema.validate(data, { abortEarly: false })
  }

  /**
   * Validate task update data
   * @param {Object} data - Task data to validate
   * @returns {Object} Joi validation result
   */
  static validateUpdate(data) {
    const schema = Joi.object({
      name: Joi.string().min(1).max(255).optional()
        .messages({
          'string.min': 'Task name cannot be empty',
          'string.max': 'Task name cannot exceed 255 characters'
        }),
      
      description: Joi.string().max(5000).optional().allow(null, ''),
      
      assigned_employee_id: Joi.number().integer().positive().optional().allow(null)
        .messages({
          'number.positive': 'Employee ID must be a positive number'
        }),
      
      status: Joi.string().valid('todo', 'in_progress', 'completed').optional()
        .messages({
          'any.only': 'Status must be one of: todo, in_progress, completed'
        }),
      
      priority: Joi.string().valid('low', 'medium', 'high', 'critical').optional()
        .messages({
          'any.only': 'Priority must be one of: low, medium, high, critical'
        }),
      
      estimated_hours: Joi.number().integer().min(0).optional().allow(null)
        .messages({
          'number.min': 'Estimated hours must be greater than or equal to 0'
        }),
      
      start_date: Joi.date().optional().allow(null),
      
      due_date: Joi.date().optional().allow(null),
      
      completed_at: Joi.date().optional().allow(null)
    })

    return schema.validate(data, { abortEarly: false })
  }

  /**
   * Validate task ID
   * @param {string} id - Task ID to validate
   * @returns {Object} Joi validation result
   */
  static validateId(id) {
    const schema = Joi.number().integer().positive().required()
      .messages({
        'number.positive': 'Task ID must be a positive number',
        'any.required': 'Task ID is required'
      })

    return schema.validate(id)
  }

  /**
   * Validate query parameters for task listing
   * @param {Object} query - Query parameters to validate
   * @returns {Object} Joi validation result
   */
  static validateQuery(query) {
    const schema = Joi.object({
      page: Joi.number().integer().min(1).default(1),
      limit: Joi.number().integer().min(1).max(100).default(20),
      project_id: Joi.number().integer().positive().optional(),
      status: Joi.string().valid('todo', 'in_progress', 'completed').optional(),
      priority: Joi.string().valid('low', 'medium', 'high', 'critical').optional(),
      assigned_employee_id: Joi.number().integer().positive().optional(),
      search: Joi.string().max(255).optional().allow(''),
      sortBy: Joi.string().valid(
        'created_at', 'updated_at', 'name', 'status', 'priority', 'due_date', 'start_date'
      ).default('created_at'),
      sortOrder: Joi.string().valid('asc', 'desc').default('desc')
    })

    return schema.validate(query, { abortEarly: false })
  }
}

// Create ProjectTaskModel alias for consistency
const ProjectTaskModel = ProjectTask

module.exports = {
  ProjectTask,
  ProjectTaskModel
}