const { database } = require('../utils/database')
const { ProjectModel } = require('../models/project.model')

class ProjectController {
  /**
   * Create a new project
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async createProject(req, res) {
    try {
      console.log('[ProjectController] Create project request:', req.body?.name)

      // Validate request data
      const { error, value } = ProjectModel.validateCreate(req.body)
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

      // Create project
      const query = `
        INSERT INTO projects (
          name, description, customer_id, order_id, status, 
          start_date, end_date, estimated_hours, budget_amount
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
      `
      
      const queryParams = [
        value.name,
        value.description || null,
        value.customer_id,
        value.order_id || null,
        value.status || 'planning',
        value.start_date || null,
        value.end_date || null,
        value.estimated_hours || null,
        value.budget_amount || null
      ]

      const result = await database.query(query, queryParams)
      const project = result.rows[0]

      res.status(201).json({
        success: true,
        message: 'Project created successfully',
        data: {
          project: {
            id: project.id,
            name: project.name,
            description: project.description,
            customer_id: project.customer_id,
            order_id: project.order_id,
            status: project.status,
            start_date: project.start_date,
            end_date: project.end_date,
            estimated_hours: project.estimated_hours ? parseInt(project.estimated_hours) : null,
            budget_amount: project.budget_amount ? parseFloat(project.budget_amount) : null,
            created_at: project.created_at,
            updated_at: project.updated_at
          }
        }
      })
    } catch (error) {
      console.error('[ProjectController] Create project error:', error.message)
      
      if (error.code === '23503') { // Foreign key violation
        return res.status(400).json({
          success: false,
          error: 'Invalid customer_id or order_id reference',
          code: 'FOREIGN_KEY_VIOLATION'
        })
      }

      res.status(500).json({
        success: false,
        error: 'Failed to create project',
        code: 'INTERNAL_SERVER_ERROR'
      })
    }
  }

  /**
   * Get project by ID
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async getProject(req, res) {
    try {
      console.log('[ProjectController] Get project request:', req.params.id)

      // Validate project ID
      const { error } = ProjectModel.validateId(req.params.id)
      if (error) {
        return res.status(400).json({
          success: false,
          error: 'Invalid project ID',
          code: 'VALIDATION_ERROR'
        })
      }

      const query = 'SELECT * FROM projects WHERE id = $1'
      const result = await database.query(query, [req.params.id])

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Project not found',
          code: 'PROJECT_NOT_FOUND'
        })
      }

      const project = result.rows[0]

      res.json({
        success: true,
        data: {
          project: {
            id: project.id,
            name: project.name,
            description: project.description,
            customer_id: project.customer_id,
            order_id: project.order_id,
            status: project.status,
            start_date: project.start_date,
            end_date: project.end_date,
            estimated_hours: project.estimated_hours ? parseInt(project.estimated_hours) : null,
            budget_amount: project.budget_amount ? parseFloat(project.budget_amount) : null,
            created_at: project.created_at,
            updated_at: project.updated_at
          }
        }
      })
    } catch (error) {
      console.error('[ProjectController] Get project error:', error.message)
      
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve project',
        code: 'INTERNAL_SERVER_ERROR'
      })
    }
  }

  /**
   * Get projects with pagination and filtering
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async getProjects(req, res) {
    try {
      console.log('[ProjectController] Get projects request:', req.query)

      // Validate query parameters
      const { error, value } = ProjectModel.validateQuery(req.query)
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

      // Build query with filters
      let whereClause = 'WHERE 1=1'
      const queryParams = []
      let paramIndex = 1

      // Status filter
      if (value.status) {
        whereClause += ` AND status = $${paramIndex}`
        queryParams.push(value.status)
        paramIndex++
      }

      // Customer filter
      if (value.customer_id) {
        whereClause += ` AND customer_id = $${paramIndex}`
        queryParams.push(value.customer_id)
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
      const countQuery = `SELECT COUNT(*) FROM projects ${whereClause}`
      const countResult = await database.query(countQuery, queryParams.slice(0, -2))
      const totalCount = parseInt(countResult.rows[0].count)

      // Main query
      const query = `
        SELECT * FROM projects 
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
          projects: result.rows.map(project => ({
            id: project.id,
            name: project.name,
            description: project.description,
            customer_id: project.customer_id,
            order_id: project.order_id,
            status: project.status,
            start_date: project.start_date,
            end_date: project.end_date,
            estimated_hours: project.estimated_hours ? parseInt(project.estimated_hours) : null,
            budget_amount: project.budget_amount ? parseFloat(project.budget_amount) : null,
            created_at: project.created_at,
            updated_at: project.updated_at
          })),
          pagination
        }
      })
    } catch (error) {
      console.error('[ProjectController] Get projects error:', error.message)
      
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve projects',
        code: 'INTERNAL_SERVER_ERROR'
      })
    }
  }

  /**
   * Update project
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async updateProject(req, res) {
    try {
      console.log('[ProjectController] Update project request:', req.params.id)

      // Validate project ID
      const { error: idError } = ProjectModel.validateId(req.params.id)
      if (idError) {
        return res.status(400).json({
          success: false,
          error: 'Invalid project ID',
          code: 'VALIDATION_ERROR'
        })
      }

      // Validate update data
      const { error, value } = ProjectModel.validateUpdate(req.body)
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
      const existingQuery = 'SELECT * FROM projects WHERE id = $1'
      const existingResult = await database.query(existingQuery, [req.params.id])
      
      if (existingResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Project not found',
          code: 'PROJECT_NOT_FOUND'
        })
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
        UPDATE projects 
        SET ${updateFields.join(', ')} 
        WHERE id = $${paramIndex}
        RETURNING *
      `

      const result = await database.query(updateQuery, updateParams)
      const updatedProject = result.rows[0]

      res.json({
        success: true,
        message: 'Project updated successfully',
        data: {
          project: {
            id: updatedProject.id,
            name: updatedProject.name,
            description: updatedProject.description,
            customer_id: updatedProject.customer_id,
            order_id: updatedProject.order_id,
            status: updatedProject.status,
            start_date: updatedProject.start_date,
            end_date: updatedProject.end_date,
            estimated_hours: updatedProject.estimated_hours ? parseInt(updatedProject.estimated_hours) : null,
            budget_amount: updatedProject.budget_amount ? parseFloat(updatedProject.budget_amount) : null,
            created_at: updatedProject.created_at,
            updated_at: updatedProject.updated_at
          }
        }
      })
    } catch (error) {
      console.error('[ProjectController] Update project error:', error.message)
      
      if (error.code === '23503') { // Foreign key violation
        return res.status(400).json({
          success: false,
          error: 'Invalid customer_id or order_id reference',
          code: 'FOREIGN_KEY_VIOLATION'
        })
      }
      
      res.status(500).json({
        success: false,
        error: 'Failed to update project',
        code: 'INTERNAL_SERVER_ERROR'
      })
    }
  }

  /**
   * Delete project (soft delete - set status to 'cancelled')
   * @param {Object} req - Express request object  
   * @param {Object} res - Express response object
   */
  async deleteProject(req, res) {
    try {
      console.log('[ProjectController] Delete project request:', req.params.id)

      // Validate project ID
      const { error } = ProjectModel.validateId(req.params.id)
      if (error) {
        return res.status(400).json({
          success: false,
          error: 'Invalid project ID',
          code: 'VALIDATION_ERROR'
        })
      }

      // Check if project exists and is not already cancelled
      const existingQuery = 'SELECT * FROM projects WHERE id = $1'
      const existingResult = await database.query(existingQuery, [req.params.id])
      
      if (existingResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Project not found',
          code: 'PROJECT_NOT_FOUND'
        })
      }

      const project = existingResult.rows[0]
      if (project.status === 'cancelled') {
        return res.status(400).json({
          success: false,
          error: 'Project is already cancelled',
          code: 'PROJECT_ALREADY_CANCELLED'
        })
      }

      // Soft delete by setting status to cancelled
      const deleteQuery = `
        UPDATE projects 
        SET status = 'cancelled', updated_at = NOW() 
        WHERE id = $1
        RETURNING *
      `
      
      const result = await database.query(deleteQuery, [req.params.id])

      res.json({
        success: true,
        message: 'Project cancelled successfully',
        data: {
          project: {
            id: result.rows[0].id,
            name: result.rows[0].name,
            status: result.rows[0].status,
            updated_at: result.rows[0].updated_at
          }
        }
      })
    } catch (error) {
      console.error('[ProjectController] Delete project error:', error.message)
      
      res.status(500).json({
        success: false,
        error: 'Failed to cancel project',
        code: 'INTERNAL_SERVER_ERROR'
      })
    }
  }

  /**
   * Get projects by customer
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async getProjectsByCustomer(req, res) {
    try {
      console.log('[ProjectController] Get projects by customer request:', req.params.customerId)

      // Validate customer ID
      const customerId = parseInt(req.params.customerId)
      if (isNaN(customerId) || customerId <= 0) {
        return res.status(400).json({
          success: false,
          error: 'Invalid customer ID',
          code: 'VALIDATION_ERROR'
        })
      }

      // Validate query parameters
      const { error, value } = ProjectModel.validateQuery(req.query)
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

      // Build query
      let whereClause = 'WHERE customer_id = $1'
      const queryParams = [customerId]
      let paramIndex = 2

      // Additional filters
      if (value.status) {
        whereClause += ` AND status = $${paramIndex}`
        queryParams.push(value.status)
        paramIndex++
      }

      if (value.search) {
        whereClause += ` AND (name ILIKE $${paramIndex} OR description ILIKE $${paramIndex})`
        queryParams.push(`%${value.search}%`)
        paramIndex++
      }

      // Sorting and pagination
      const orderClause = `ORDER BY ${value.sortBy} ${value.sortOrder.toUpperCase()}`
      const offset = (value.page - 1) * value.limit
      const limitClause = `LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`
      queryParams.push(value.limit, offset)

      // Count query
      const countQuery = `SELECT COUNT(*) FROM projects ${whereClause}`
      const countResult = await database.query(countQuery, queryParams.slice(0, -2))
      const totalCount = parseInt(countResult.rows[0].count)

      // Main query
      const query = `
        SELECT * FROM projects 
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
          customer_id: customerId,
          projects: result.rows.map(project => ({
            id: project.id,
            name: project.name,
            description: project.description,
            status: project.status,
            start_date: project.start_date,
            end_date: project.end_date,
            budget_amount: project.budget_amount ? parseFloat(project.budget_amount) : null,
            created_at: project.created_at
          })),
          pagination
        }
      })
    } catch (error) {
      console.error('[ProjectController] Get projects by customer error:', error.message)
      
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve customer projects',
        code: 'INTERNAL_SERVER_ERROR'
      })
    }
  }

  /**
   * Get project statistics
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async getProjectStats(req, res) {
    try {
      console.log('[ProjectController] Get project stats request')

      const statsQuery = `
        SELECT 
          COUNT(*) as total_projects,
          COUNT(CASE WHEN status = 'planning' THEN 1 END) as planning_count,
          COUNT(CASE WHEN status = 'active' THEN 1 END) as active_count,
          COUNT(CASE WHEN status = 'on-hold' THEN 1 END) as on_hold_count,
          COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_count,
          COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_count,
          AVG(budget_amount) as avg_budget,
          SUM(budget_amount) as total_budget,
          AVG(estimated_hours) as avg_estimated_hours,
          SUM(estimated_hours) as total_estimated_hours
        FROM projects
      `

      const result = await database.query(statsQuery)
      const stats = result.rows[0]

      res.json({
        success: true,
        data: {
          statistics: {
            total_projects: parseInt(stats.total_projects),
            status_breakdown: {
              planning: parseInt(stats.planning_count),
              active: parseInt(stats.active_count),
              on_hold: parseInt(stats.on_hold_count),
              completed: parseInt(stats.completed_count),
              cancelled: parseInt(stats.cancelled_count)
            },
            budget: {
              average: stats.avg_budget ? parseFloat(stats.avg_budget) : 0,
              total: stats.total_budget ? parseFloat(stats.total_budget) : 0
            },
            estimated_hours: {
              average: stats.avg_estimated_hours ? parseFloat(stats.avg_estimated_hours) : 0,
              total: stats.total_estimated_hours ? parseFloat(stats.total_estimated_hours) : 0
            }
          }
        }
      })
    } catch (error) {
      console.error('[ProjectController] Get project stats error:', error.message)
      
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve project statistics',
        code: 'INTERNAL_SERVER_ERROR'
      })
    }
  }
}

// Create singleton instance
const projectController = new ProjectController()

module.exports = {
  ProjectController,
  projectController
}