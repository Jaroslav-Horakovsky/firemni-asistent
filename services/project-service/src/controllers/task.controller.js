const { database } = require('../utils/database')
const { ProjectTaskModel } = require('../models/projectTask.model')
const { TaskDependencyModel } = require('../models/taskDependency.model')

class TaskController {
  /**
   * Create a new project task
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async createTask(req, res) {
    try {
      console.log('[TaskController] Create task request:', req.params.projectId, req.body?.name)

      // Validate project ID from params
      const projectId = parseInt(req.params.projectId)
      if (isNaN(projectId) || projectId <= 0) {
        return res.status(400).json({
          success: false,
          error: 'Invalid project ID',
          code: 'VALIDATION_ERROR'
        })
      }

      // Add project_id to request body for validation
      const taskData = { ...req.body, project_id: projectId }

      // Validate request data
      const { error, value } = ProjectTaskModel.validateCreate(taskData)
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

      // Check if project exists
      const projectQuery = 'SELECT id, status FROM projects WHERE id = $1'
      const projectResult = await database.query(projectQuery, [projectId])
      
      if (projectResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Project not found',
          code: 'PROJECT_NOT_FOUND'
        })
      }

      const project = projectResult.rows[0]
      if (project.status === 'cancelled' || project.status === 'completed') {
        return res.status(400).json({
          success: false,
          error: 'Cannot create tasks for cancelled or completed projects',
          code: 'PROJECT_CLOSED'
        })
      }

      // If employee is assigned, verify they are assigned to the project
      if (value.assigned_employee_id) {
        const assignmentQuery = `
          SELECT id FROM project_assignments 
          WHERE project_id = $1 AND employee_id = $2
        `
        const assignmentResult = await database.query(assignmentQuery, [projectId, value.assigned_employee_id])
        
        if (assignmentResult.rows.length === 0) {
          return res.status(400).json({
            success: false,
            error: 'Employee must be assigned to the project before being assigned tasks',
            code: 'EMPLOYEE_NOT_ASSIGNED_TO_PROJECT'
          })
        }
      }

      // Create task
      const query = `
        INSERT INTO project_tasks (
          project_id, name, description, assigned_employee_id, status, 
          priority, estimated_hours, start_date, due_date
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
      `
      
      const queryParams = [
        projectId,
        value.name,
        value.description || null,
        value.assigned_employee_id || null,
        value.status || 'todo',
        value.priority || 'medium',
        value.estimated_hours || null,
        value.start_date || null,
        value.due_date || null
      ]

      const result = await database.query(query, queryParams)
      const task = result.rows[0]

      res.status(201).json({
        success: true,
        message: 'Task created successfully',
        data: {
          task: {
            id: task.id,
            project_id: task.project_id,
            name: task.name,
            description: task.description,
            assigned_employee_id: task.assigned_employee_id,
            status: task.status,
            priority: task.priority,
            estimated_hours: task.estimated_hours ? parseInt(task.estimated_hours) : null,
            start_date: task.start_date,
            due_date: task.due_date,
            completed_at: task.completed_at,
            created_at: task.created_at,
            updated_at: task.updated_at
          }
        }
      })
    } catch (error) {
      console.error('[TaskController] Create task error:', error.message)
      
      if (error.code === '23503') { // Foreign key violation
        return res.status(400).json({
          success: false,
          error: 'Invalid project_id or assigned_employee_id reference',
          code: 'FOREIGN_KEY_VIOLATION'
        })
      }

      res.status(500).json({
        success: false,
        error: 'Failed to create task',
        code: 'INTERNAL_SERVER_ERROR'
      })
    }
  }

  /**
   * Get project tasks
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async getTasks(req, res) {
    try {
      console.log('[TaskController] Get tasks request:', req.params.projectId)

      // Validate project ID
      const projectId = parseInt(req.params.projectId)
      if (isNaN(projectId) || projectId <= 0) {
        return res.status(400).json({
          success: false,
          error: 'Invalid project ID',
          code: 'VALIDATION_ERROR'
        })
      }

      // Validate query parameters
      const { error, value } = ProjectTaskModel.validateQuery({ ...req.query, project_id: projectId })
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

      // Check if project exists
      const projectQuery = 'SELECT id, name FROM projects WHERE id = $1'
      const projectResult = await database.query(projectQuery, [projectId])
      
      if (projectResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Project not found',
          code: 'PROJECT_NOT_FOUND'
        })
      }

      const project = projectResult.rows[0]

      // Build query with filters
      let whereClause = 'WHERE project_id = $1'
      const queryParams = [projectId]
      let paramIndex = 2

      // Status filter
      if (value.status) {
        whereClause += ` AND status = $${paramIndex}`
        queryParams.push(value.status)
        paramIndex++
      }

      // Priority filter
      if (value.priority) {
        whereClause += ` AND priority = $${paramIndex}`
        queryParams.push(value.priority)
        paramIndex++
      }

      // Employee filter
      if (value.assigned_employee_id) {
        whereClause += ` AND assigned_employee_id = $${paramIndex}`
        queryParams.push(value.assigned_employee_id)
        paramIndex++
      }

      // Search filter (name or description)
      if (value.search) {
        whereClause += ` AND (name ILIKE $${paramIndex} OR description ILIKE $${paramIndex})`
        queryParams.push(`%${value.search}%`)
        paramIndex++
      }

      // Sorting
      const orderClause = `ORDER BY ${value.sortBy} ${value.sortOrder.toUpperCase()}`

      // Pagination
      const offset = (value.page - 1) * value.limit
      const limitClause = `LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`
      queryParams.push(value.limit, offset)

      // Count query for pagination
      const countQuery = `SELECT COUNT(*) FROM project_tasks ${whereClause}`
      const countResult = await database.query(countQuery, queryParams.slice(0, -2))
      const totalCount = parseInt(countResult.rows[0].count)

      // Main query
      const query = `
        SELECT * FROM project_tasks 
        ${whereClause} 
        ${orderClause} 
        ${limitClause}
      `
      
      const result = await database.query(query, queryParams)

      const pagination = {
        page: value.page,
        limit: value.limit,
        total: totalCount,
        pages: Math.ceil(totalCount / value.limit),
        hasNext: value.page < Math.ceil(totalCount / value.limit),
        hasPrev: value.page > 1
      }

      res.json({
        success: true,
        data: {
          project: {
            id: project.id,
            name: project.name
          },
          tasks: result.rows.map(task => ({
            id: task.id,
            project_id: task.project_id,
            name: task.name,
            description: task.description,
            assigned_employee_id: task.assigned_employee_id,
            status: task.status,
            priority: task.priority,
            estimated_hours: task.estimated_hours ? parseInt(task.estimated_hours) : null,
            start_date: task.start_date,
            due_date: task.due_date,
            completed_at: task.completed_at,
            created_at: task.created_at,
            updated_at: task.updated_at
          })),
          pagination
        }
      })
    } catch (error) {
      console.error('[TaskController] Get tasks error:', error.message)
      
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve project tasks',
        code: 'INTERNAL_SERVER_ERROR'
      })
    }
  }

  /**
   * Get task by ID
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async getTask(req, res) {
    try {
      console.log('[TaskController] Get task request:', req.params.id)

      // Validate task ID
      const { error } = ProjectTaskModel.validateId(req.params.id)
      if (error) {
        return res.status(400).json({
          success: false,
          error: 'Invalid task ID',
          code: 'VALIDATION_ERROR'
        })
      }

      // Get task with dependencies
      const taskQuery = 'SELECT * FROM project_tasks WHERE id = $1'
      const taskResult = await database.query(taskQuery, [req.params.id])

      if (taskResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Task not found',
          code: 'TASK_NOT_FOUND'
        })
      }

      const task = taskResult.rows[0]

      // Get task dependencies
      const dependenciesQuery = `
        SELECT td.*, pt.name as dependency_name, pt.status as dependency_status
        FROM task_dependencies td
        JOIN project_tasks pt ON td.depends_on_task_id = pt.id
        WHERE td.task_id = $1
      `
      const dependenciesResult = await database.query(dependenciesQuery, [req.params.id])

      // Get tasks that depend on this task
      const dependentsQuery = `
        SELECT td.*, pt.name as dependent_name, pt.status as dependent_status
        FROM task_dependencies td
        JOIN project_tasks pt ON td.task_id = pt.id
        WHERE td.depends_on_task_id = $1
      `
      const dependentsResult = await database.query(dependentsQuery, [req.params.id])

      res.json({
        success: true,
        data: {
          task: {
            id: task.id,
            project_id: task.project_id,
            name: task.name,
            description: task.description,
            assigned_employee_id: task.assigned_employee_id,
            status: task.status,
            priority: task.priority,
            estimated_hours: task.estimated_hours ? parseInt(task.estimated_hours) : null,
            start_date: task.start_date,
            due_date: task.due_date,
            completed_at: task.completed_at,
            created_at: task.created_at,
            updated_at: task.updated_at
          },
          dependencies: dependenciesResult.rows.map(dep => ({
            id: dep.id,
            depends_on_task_id: dep.depends_on_task_id,
            dependency_name: dep.dependency_name,
            dependency_status: dep.dependency_status,
            created_at: dep.created_at
          })),
          dependents: dependentsResult.rows.map(dep => ({
            id: dep.id,
            task_id: dep.task_id,
            dependent_name: dep.dependent_name,
            dependent_status: dep.dependent_status,
            created_at: dep.created_at
          }))
        }
      })
    } catch (error) {
      console.error('[TaskController] Get task error:', error.message)
      
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve task',
        code: 'INTERNAL_SERVER_ERROR'
      })
    }
  }

  /**
   * Update task
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async updateTask(req, res) {
    try {
      console.log('[TaskController] Update task request:', req.params.id)

      // Validate task ID
      const { error: idError } = ProjectTaskModel.validateId(req.params.id)
      if (idError) {
        return res.status(400).json({
          success: false,
          error: 'Invalid task ID',
          code: 'VALIDATION_ERROR'
        })
      }

      // Validate update data
      const { error, value } = ProjectTaskModel.validateUpdate(req.body)
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

      // Check if task exists
      const existingQuery = 'SELECT * FROM project_tasks WHERE id = $1'
      const existingResult = await database.query(existingQuery, [req.params.id])
      
      if (existingResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Task not found',
          code: 'TASK_NOT_FOUND'
        })
      }

      const task = existingResult.rows[0]

      // If employee is being assigned, verify they are assigned to the project
      if (value.assigned_employee_id && value.assigned_employee_id !== task.assigned_employee_id) {
        const assignmentQuery = `
          SELECT id FROM project_assignments 
          WHERE project_id = $1 AND employee_id = $2
        `
        const assignmentResult = await database.query(assignmentQuery, [task.project_id, value.assigned_employee_id])
        
        if (assignmentResult.rows.length === 0) {
          return res.status(400).json({
            success: false,
            error: 'Employee must be assigned to the project before being assigned tasks',
            code: 'EMPLOYEE_NOT_ASSIGNED_TO_PROJECT'
          })
        }
      }

      // If status is being changed to completed, set completed_at
      if (value.status === 'completed' && task.status !== 'completed') {
        value.completed_at = new Date()
      }

      // If status is being changed from completed, clear completed_at
      if (value.status && value.status !== 'completed' && task.status === 'completed') {
        value.completed_at = null
      }

      // Build update query dynamically
      const updateFields = []
      const updateParams = []
      let paramIndex = 1

      Object.keys(value).forEach(key => {
        if (value[key] !== undefined) {
          updateFields.push(`${key} = $${paramIndex}`)
          updateParams.push(value[key])
          paramIndex++
        }
      })

      if (updateFields.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'No valid fields to update',
          code: 'VALIDATION_ERROR'
        })
      }

      // Add updated_at timestamp
      updateFields.push(`updated_at = NOW()`)
      updateParams.push(req.params.id)

      const updateQuery = `
        UPDATE project_tasks 
        SET ${updateFields.join(', ')} 
        WHERE id = $${paramIndex}
        RETURNING *
      `

      const result = await database.query(updateQuery, updateParams)
      const updatedTask = result.rows[0]

      res.json({
        success: true,
        message: 'Task updated successfully',
        data: {
          task: {
            id: updatedTask.id,
            project_id: updatedTask.project_id,
            name: updatedTask.name,
            description: updatedTask.description,
            assigned_employee_id: updatedTask.assigned_employee_id,
            status: updatedTask.status,
            priority: updatedTask.priority,
            estimated_hours: updatedTask.estimated_hours ? parseInt(updatedTask.estimated_hours) : null,
            start_date: updatedTask.start_date,
            due_date: updatedTask.due_date,
            completed_at: updatedTask.completed_at,
            created_at: updatedTask.created_at,
            updated_at: updatedTask.updated_at
          }
        }
      })
    } catch (error) {
      console.error('[TaskController] Update task error:', error.message)
      
      res.status(500).json({
        success: false,
        error: 'Failed to update task',
        code: 'INTERNAL_SERVER_ERROR'
      })
    }
  }

  /**
   * Delete task
   * @param {Object} req - Express request object  
   * @param {Object} res - Express response object
   */
  async deleteTask(req, res) {
    try {
      console.log('[TaskController] Delete task request:', req.params.id)

      // Validate task ID
      const { error } = ProjectTaskModel.validateId(req.params.id)
      if (error) {
        return res.status(400).json({
          success: false,
          error: 'Invalid task ID',
          code: 'VALIDATION_ERROR'
        })
      }

      // Check if task exists
      const existingQuery = 'SELECT * FROM project_tasks WHERE id = $1'
      const existingResult = await database.query(existingQuery, [req.params.id])
      
      if (existingResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Task not found',
          code: 'TASK_NOT_FOUND'
        })
      }

      const task = existingResult.rows[0]

      // Check if task has dependencies that would be broken
      const dependentsQuery = 'SELECT COUNT(*) as count FROM task_dependencies WHERE depends_on_task_id = $1'
      const dependentsResult = await database.query(dependentsQuery, [req.params.id])
      const dependentsCount = parseInt(dependentsResult.rows[0].count)

      if (dependentsCount > 0) {
        return res.status(400).json({
          success: false,
          error: `Cannot delete task: ${dependentsCount} other tasks depend on this task`,
          code: 'TASK_HAS_DEPENDENTS'
        })
      }

      // Use transaction to delete task and its dependencies
      await database.transaction(async (client) => {
        // Delete task dependencies
        await client.query('DELETE FROM task_dependencies WHERE task_id = $1', [req.params.id])
        
        // Delete task
        await client.query('DELETE FROM project_tasks WHERE id = $1', [req.params.id])
      })

      res.json({
        success: true,
        message: 'Task deleted successfully',
        data: {
          deleted_task: {
            id: task.id,
            name: task.name,
            project_id: task.project_id,
            status: task.status
          }
        }
      })
    } catch (error) {
      console.error('[TaskController] Delete task error:', error.message)
      
      res.status(500).json({
        success: false,
        error: 'Failed to delete task',
        code: 'INTERNAL_SERVER_ERROR'
      })
    }
  }

  /**
   * Add task dependency
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async addDependency(req, res) {
    try {
      console.log('[TaskController] Add dependency request:', req.params.id, req.body?.depends_on_task_id)

      // Validate task ID
      const { error: idError } = ProjectTaskModel.validateId(req.params.id)
      if (idError) {
        return res.status(400).json({
          success: false,
          error: 'Invalid task ID',
          code: 'VALIDATION_ERROR'
        })
      }

      // Add task_id to request body for validation
      const dependencyData = { ...req.body, task_id: parseInt(req.params.id) }

      // Validate dependency data
      const { error, value } = TaskDependencyModel.validateCreate(dependencyData)
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

      // Check if both tasks exist and belong to the same project
      const tasksQuery = `
        SELECT id, project_id, name FROM project_tasks 
        WHERE id IN ($1, $2)
      `
      const tasksResult = await database.query(tasksQuery, [value.task_id, value.depends_on_task_id])
      
      if (tasksResult.rows.length !== 2) {
        return res.status(404).json({
          success: false,
          error: 'One or both tasks not found',
          code: 'TASK_NOT_FOUND'
        })
      }

      const [task1, task2] = tasksResult.rows
      if (task1.project_id !== task2.project_id) {
        return res.status(400).json({
          success: false,
          error: 'Tasks must belong to the same project',
          code: 'TASKS_DIFFERENT_PROJECTS'
        })
      }

      // Check if dependency already exists
      const existingQuery = `
        SELECT id FROM task_dependencies 
        WHERE task_id = $1 AND depends_on_task_id = $2
      `
      const existingResult = await database.query(existingQuery, [value.task_id, value.depends_on_task_id])
      
      if (existingResult.rows.length > 0) {
        return res.status(400).json({
          success: false,
          error: 'Dependency already exists',
          code: 'DEPENDENCY_EXISTS'
        })
      }

      // Check for circular dependencies (simple check - could be more comprehensive)
      const circularQuery = `
        SELECT id FROM task_dependencies 
        WHERE task_id = $2 AND depends_on_task_id = $1
      `
      const circularResult = await database.query(circularQuery, [value.task_id, value.depends_on_task_id])
      
      if (circularResult.rows.length > 0) {
        return res.status(400).json({
          success: false,
          error: 'Cannot create circular dependency',
          code: 'CIRCULAR_DEPENDENCY'
        })
      }

      // Create dependency
      const query = `
        INSERT INTO task_dependencies (task_id, depends_on_task_id)
        VALUES ($1, $2)
        RETURNING *
      `
      
      const result = await database.query(query, [value.task_id, value.depends_on_task_id])
      const dependency = result.rows[0]

      res.status(201).json({
        success: true,
        message: 'Task dependency created successfully',
        data: {
          dependency: {
            id: dependency.id,
            task_id: dependency.task_id,
            depends_on_task_id: dependency.depends_on_task_id,
            created_at: dependency.created_at
          }
        }
      })
    } catch (error) {
      console.error('[TaskController] Add dependency error:', error.message)
      
      if (error.code === '23503') { // Foreign key violation
        return res.status(400).json({
          success: false,
          error: 'Invalid task ID reference',
          code: 'FOREIGN_KEY_VIOLATION'
        })
      }

      res.status(500).json({
        success: false,
        error: 'Failed to create task dependency',
        code: 'INTERNAL_SERVER_ERROR'
      })
    }
  }

  /**
   * Remove task dependency
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async removeDependency(req, res) {
    try {
      console.log('[TaskController] Remove dependency request:', req.params.dependencyId)

      // Validate dependency ID
      const { error } = TaskDependencyModel.validateId(req.params.dependencyId)
      if (error) {
        return res.status(400).json({
          success: false,
          error: 'Invalid dependency ID',
          code: 'VALIDATION_ERROR'
        })
      }

      // Check if dependency exists
      const existingQuery = 'SELECT * FROM task_dependencies WHERE id = $1'
      const existingResult = await database.query(existingQuery, [req.params.dependencyId])
      
      if (existingResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Dependency not found',
          code: 'DEPENDENCY_NOT_FOUND'
        })
      }

      const dependency = existingResult.rows[0]

      // Delete dependency
      const deleteQuery = 'DELETE FROM task_dependencies WHERE id = $1 RETURNING *'
      const result = await database.query(deleteQuery, [req.params.dependencyId])

      res.json({
        success: true,
        message: 'Task dependency removed successfully',
        data: {
          removed_dependency: {
            id: result.rows[0].id,
            task_id: result.rows[0].task_id,
            depends_on_task_id: result.rows[0].depends_on_task_id
          }
        }
      })
    } catch (error) {
      console.error('[TaskController] Remove dependency error:', error.message)
      
      res.status(500).json({
        success: false,
        error: 'Failed to remove task dependency',
        code: 'INTERNAL_SERVER_ERROR'
      })
    }
  }

  /**
   * Get task dependencies
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async getTaskDependencies(req, res) {
    try {
      console.log('[TaskController] Get task dependencies request:', req.params.id)

      // Validate task ID
      const { error } = ProjectTaskModel.validateId(req.params.id)
      if (error) {
        return res.status(400).json({
          success: false,
          error: 'Invalid task ID',
          code: 'VALIDATION_ERROR'
        })
      }

      // Check if task exists
      const taskQuery = 'SELECT id, name FROM project_tasks WHERE id = $1'
      const taskResult = await database.query(taskQuery, [req.params.id])
      
      if (taskResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Task not found',
          code: 'TASK_NOT_FOUND'
        })
      }

      const task = taskResult.rows[0]

      // Get dependencies (tasks this task depends on)
      const dependenciesQuery = `
        SELECT td.*, pt.name as dependency_name, pt.status as dependency_status, pt.priority as dependency_priority
        FROM task_dependencies td
        JOIN project_tasks pt ON td.depends_on_task_id = pt.id
        WHERE td.task_id = $1
        ORDER BY pt.priority DESC, pt.created_at ASC
      `
      const dependenciesResult = await database.query(dependenciesQuery, [req.params.id])

      // Get dependents (tasks that depend on this task)
      const dependentsQuery = `
        SELECT td.*, pt.name as dependent_name, pt.status as dependent_status, pt.priority as dependent_priority
        FROM task_dependencies td
        JOIN project_tasks pt ON td.task_id = pt.id
        WHERE td.depends_on_task_id = $1
        ORDER BY pt.priority DESC, pt.created_at ASC
      `
      const dependentsResult = await database.query(dependentsQuery, [req.params.id])

      res.json({
        success: true,
        data: {
          task: {
            id: task.id,
            name: task.name
          },
          dependencies: dependenciesResult.rows.map(dep => ({
            id: dep.id,
            depends_on_task_id: dep.depends_on_task_id,
            dependency_name: dep.dependency_name,
            dependency_status: dep.dependency_status,
            dependency_priority: dep.dependency_priority,
            created_at: dep.created_at
          })),
          dependents: dependentsResult.rows.map(dep => ({
            id: dep.id,
            task_id: dep.task_id,
            dependent_name: dep.dependent_name,
            dependent_status: dep.dependent_status,
            dependent_priority: dep.dependent_priority,
            created_at: dep.created_at
          })),
          summary: {
            dependencies_count: dependenciesResult.rows.length,
            dependents_count: dependentsResult.rows.length,
            blocked_by: dependenciesResult.rows.filter(d => d.dependency_status !== 'completed').length,
            blocking: dependentsResult.rows.filter(d => d.dependent_status === 'todo').length
          }
        }
      })
    } catch (error) {
      console.error('[TaskController] Get task dependencies error:', error.message)
      
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve task dependencies',
        code: 'INTERNAL_SERVER_ERROR'
      })
    }
  }
}

// Create singleton instance
const taskController = new TaskController()

module.exports = {
  TaskController,
  taskController
}