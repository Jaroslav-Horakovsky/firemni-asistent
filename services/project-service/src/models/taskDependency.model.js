const Joi = require('joi')

/**
 * TaskDependency Model - Task dependency data structure with validation
 */
class TaskDependency {
  constructor(data = {}) {
    this.id = data.id
    this.task_id = data.task_id
    this.depends_on_task_id = data.depends_on_task_id
    this.created_at = data.created_at
  }

  /**
   * Validate dependency data
   * @returns {Object} Validation result
   */
  validate() {
    const errors = []

    // Required fields validation
    if (!this.task_id) {
      errors.push('Task ID is required')
    }

    if (!this.depends_on_task_id) {
      errors.push('Depends on task ID is required')
    }

    // Self-dependency validation
    if (this.task_id === this.depends_on_task_id) {
      errors.push('Task cannot depend on itself')
    }

    return {
      isValid: errors.length === 0,
      errors
    }
  }

  /**
   * Convert dependency to JSON representation
   * @returns {Object} Dependency as plain object
   */
  toJSON() {
    return {
      id: this.id,
      task_id: this.task_id,
      depends_on_task_id: this.depends_on_task_id,
      created_at: this.created_at
    }
  }

  /**
   * Create TaskDependency instance from database row
   * @param {Object} row - Database row
   * @returns {TaskDependency} Dependency instance
   */
  static fromDatabaseRow(row) {
    return new TaskDependency(row)
  }

  /**
   * Validate dependency creation data
   * @param {Object} data - Dependency data to validate
   * @returns {Object} Joi validation result
   */
  static validateCreate(data) {
    const schema = Joi.object({
      task_id: Joi.number().integer().positive().required()
        .messages({
          'number.positive': 'Task ID must be a positive number',
          'any.required': 'Task ID is required'
        }),
      
      depends_on_task_id: Joi.number().integer().positive().required()
        .messages({
          'number.positive': 'Depends on task ID must be a positive number',
          'any.required': 'Depends on task ID is required'
        })
    }).custom((value, helpers) => {
      // Validate that task doesn't depend on itself
      if (value.task_id === value.depends_on_task_id) {
        return helpers.error('custom.selfDependency')
      }
      return value
    }).messages({
      'custom.selfDependency': 'Task cannot depend on itself'
    })

    return schema.validate(data, { abortEarly: false })
  }

  /**
   * Validate dependency ID
   * @param {string} id - Dependency ID to validate
   * @returns {Object} Joi validation result
   */
  static validateId(id) {
    const schema = Joi.number().integer().positive().required()
      .messages({
        'number.positive': 'Dependency ID must be a positive number',
        'any.required': 'Dependency ID is required'
      })

    return schema.validate(id)
  }

  /**
   * Validate task ID for dependency queries
   * @param {string} taskId - Task ID to validate
   * @returns {Object} Joi validation result
   */
  static validateTaskId(taskId) {
    const schema = Joi.number().integer().positive().required()
      .messages({
        'number.positive': 'Task ID must be a positive number',
        'any.required': 'Task ID is required'
      })

    return schema.validate(taskId)
  }
}

// Create TaskDependencyModel alias for consistency
const TaskDependencyModel = TaskDependency

module.exports = {
  TaskDependency,
  TaskDependencyModel
}