const { database } = require('../utils/database')
const { ProjectAssignmentModel } = require('../models/projectAssignment.model')
const { ProjectModel } = require('../models/project.model')

class AssignmentController {
  /**
   * Create a new project assignment
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async createAssignment(req, res) {
    try {
      console.log('[AssignmentController] Create assignment request:', req.params.projectId, req.body?.employee_id)

      // Validate project ID from params
      const projectId = req.params.projectId
      const { error: projectIdError } = ProjectModel.validateId(projectId)
      if (projectIdError) {
        return res.status(400).json({
          success: false,
          error: 'Invalid project ID format',
          code: 'VALIDATION_ERROR',
          details: projectIdError.details
        })
      }

      // Add project_id to request body for validation
      const assignmentData = { ...req.body, project_id: projectId }

      // Validate request data
      const { error, value } = ProjectAssignmentModel.validateCreate(assignmentData)
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
          error: 'Cannot assign employees to cancelled or completed projects',
          code: 'PROJECT_CLOSED'
        })
      }

      // Check if employee is already assigned to this project
      const existingQuery = 'SELECT id FROM project_assignments WHERE project_id = $1 AND employee_id = $2'
      const existingResult = await database.query(existingQuery, [projectId, value.employee_id])
      
      if (existingResult.rows.length > 0) {
        return res.status(400).json({
          success: false,
          error: 'Employee is already assigned to this project',
          code: 'EMPLOYEE_ALREADY_ASSIGNED'
        })
      }

      // Create assignment
      const query = `
        INSERT INTO project_assignments (
          project_id, employee_id, role, allocation_percentage, start_date, end_date
        ) VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `
      
      const queryParams = [
        projectId,
        value.employee_id,
        value.role || null,
        value.allocation_percentage || 100,
        value.start_date || null,
        value.end_date || null
      ]

      const result = await database.query(query, queryParams)
      const assignment = result.rows[0]

      res.status(201).json({
        success: true,
        message: 'Employee assigned to project successfully',
        data: {
          assignment: {
            id: assignment.id,
            project_id: assignment.project_id,
            employee_id: assignment.employee_id,
            role: assignment.role,
            allocation_percentage: assignment.allocation_percentage,
            start_date: assignment.start_date,
            end_date: assignment.end_date,
            created_at: assignment.created_at
          }
        }
      })
    } catch (error) {
      console.error('[AssignmentController] Create assignment error:', error.message)
      
      if (error.code === '23503') { // Foreign key violation
        return res.status(400).json({
          success: false,
          error: 'Invalid project_id or employee_id reference',
          code: 'FOREIGN_KEY_VIOLATION'
        })
      }

      res.status(500).json({
        success: false,
        error: 'Failed to create assignment',
        code: 'INTERNAL_SERVER_ERROR'
      })
    }
  }

  /**
   * Get project assignments (team members)
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async getAssignments(req, res) {
    try {
      console.log('[AssignmentController] Get assignments request:', req.params.projectId)

      // Validate project ID
      const projectId = req.params.projectId
      const { error: projectIdError } = ProjectModel.validateId(projectId)
      if (projectIdError) {
        return res.status(400).json({
          success: false,
          error: 'Invalid project ID format',
          code: 'VALIDATION_ERROR',
          details: projectIdError.details
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

      // Get assignments for the project
      const query = `
        SELECT * FROM project_assignments 
        WHERE project_id = $1 
        ORDER BY created_at ASC
      `
      
      const result = await database.query(query, [projectId])

      res.json({
        success: true,
        data: {
          project: {
            id: project.id,
            name: project.name
          },
          assignments: result.rows.map(assignment => ({
            id: assignment.id,
            project_id: assignment.project_id,
            employee_id: assignment.employee_id,
            role: assignment.role,
            allocation_percentage: assignment.allocation_percentage,
            start_date: assignment.start_date,
            end_date: assignment.end_date,
            created_at: assignment.created_at
          })),
          team_size: result.rows.length
        }
      })
    } catch (error) {
      console.error('[AssignmentController] Get assignments error:', error.message)
      
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve project assignments',
        code: 'INTERNAL_SERVER_ERROR'
      })
    }
  }

  /**
   * Get assignment by ID
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async getAssignment(req, res) {
    try {
      console.log('[AssignmentController] Get assignment request:', req.params.id)

      // Validate assignment ID
      const { error } = ProjectAssignmentModel.validateId(req.params.id)
      if (error) {
        return res.status(400).json({
          success: false,
          error: 'Invalid assignment ID',
          code: 'VALIDATION_ERROR'
        })
      }

      const query = 'SELECT * FROM project_assignments WHERE id = $1'
      const result = await database.query(query, [req.params.id])

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Assignment not found',
          code: 'ASSIGNMENT_NOT_FOUND'
        })
      }

      const assignment = result.rows[0]

      res.json({
        success: true,
        data: {
          assignment: {
            id: assignment.id,
            project_id: assignment.project_id,
            employee_id: assignment.employee_id,
            role: assignment.role,
            allocation_percentage: assignment.allocation_percentage,
            start_date: assignment.start_date,
            end_date: assignment.end_date,
            created_at: assignment.created_at
          }
        }
      })
    } catch (error) {
      console.error('[AssignmentController] Get assignment error:', error.message)
      
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve assignment',
        code: 'INTERNAL_SERVER_ERROR'
      })
    }
  }

  /**
   * Update assignment
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async updateAssignment(req, res) {
    try {
      console.log('[AssignmentController] Update assignment request:', req.params.id)

      // Validate assignment ID
      const { error: idError } = ProjectAssignmentModel.validateId(req.params.id)
      if (idError) {
        return res.status(400).json({
          success: false,
          error: 'Invalid assignment ID',
          code: 'VALIDATION_ERROR'
        })
      }

      // Validate update data
      const { error, value } = ProjectAssignmentModel.validateUpdate(req.body)
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

      // Check if assignment exists
      const existingQuery = 'SELECT * FROM project_assignments WHERE id = $1'
      const existingResult = await database.query(existingQuery, [req.params.id])
      
      if (existingResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Assignment not found',
          code: 'ASSIGNMENT_NOT_FOUND'
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

      updateParams.push(req.params.id)

      const updateQuery = `
        UPDATE project_assignments 
        SET ${updateFields.join(', ')} 
        WHERE id = $${paramIndex}
        RETURNING *
      `

      const result = await database.query(updateQuery, updateParams)
      const updatedAssignment = result.rows[0]

      res.json({
        success: true,
        message: 'Assignment updated successfully',
        data: {
          assignment: {
            id: updatedAssignment.id,
            project_id: updatedAssignment.project_id,
            employee_id: updatedAssignment.employee_id,
            role: updatedAssignment.role,
            allocation_percentage: updatedAssignment.allocation_percentage,
            start_date: updatedAssignment.start_date,
            end_date: updatedAssignment.end_date,
            created_at: updatedAssignment.created_at
          }
        }
      })
    } catch (error) {
      console.error('[AssignmentController] Update assignment error:', error.message)
      
      res.status(500).json({
        success: false,
        error: 'Failed to update assignment',
        code: 'INTERNAL_SERVER_ERROR'
      })
    }
  }

  /**
   * Remove assignment (delete)
   * @param {Object} req - Express request object  
   * @param {Object} res - Express response object
   */
  async removeAssignment(req, res) {
    try {
      console.log('[AssignmentController] Remove assignment request:', req.params.id)

      // Validate assignment ID
      const { error } = ProjectAssignmentModel.validateId(req.params.id)
      if (error) {
        return res.status(400).json({
          success: false,
          error: 'Invalid assignment ID',
          code: 'VALIDATION_ERROR'
        })
      }

      // Check if assignment exists
      const existingQuery = 'SELECT * FROM project_assignments WHERE id = $1'
      const existingResult = await database.query(existingQuery, [req.params.id])
      
      if (existingResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Assignment not found',
          code: 'ASSIGNMENT_NOT_FOUND'
        })
      }

      const assignment = existingResult.rows[0]

      // Check if project is closed (completed or cancelled)
      const projectQuery = 'SELECT status FROM projects WHERE id = $1'
      const projectResult = await database.query(projectQuery, [assignment.project_id])
      
      if (projectResult.rows.length > 0) {
        const projectStatus = projectResult.rows[0].status
        if (projectStatus === 'completed' || projectStatus === 'cancelled') {
          return res.status(400).json({
            success: false,
            error: 'Cannot remove assignments from completed or cancelled projects',
            code: 'PROJECT_CLOSED'
          })
        }
      }

      // Check if employee has tasks assigned in this project
      const tasksQuery = `
        SELECT COUNT(*) as task_count 
        FROM project_tasks 
        WHERE project_id = $1 AND assigned_employee_id = $2 AND status NOT IN ('completed', 'cancelled')
      `
      const tasksResult = await database.query(tasksQuery, [assignment.project_id, assignment.employee_id])
      const activeTasks = parseInt(tasksResult.rows[0].task_count)

      if (activeTasks > 0) {
        return res.status(400).json({
          success: false,
          error: `Cannot remove assignment: employee has ${activeTasks} active tasks in this project`,
          code: 'EMPLOYEE_HAS_ACTIVE_TASKS'
        })
      }

      // Delete assignment
      const deleteQuery = 'DELETE FROM project_assignments WHERE id = $1 RETURNING *'
      const result = await database.query(deleteQuery, [req.params.id])

      res.json({
        success: true,
        message: 'Assignment removed successfully',
        data: {
          removed_assignment: {
            id: result.rows[0].id,
            project_id: result.rows[0].project_id,
            employee_id: result.rows[0].employee_id,
            role: result.rows[0].role
          }
        }
      })
    } catch (error) {
      console.error('[AssignmentController] Remove assignment error:', error.message)
      
      res.status(500).json({
        success: false,
        error: 'Failed to remove assignment',
        code: 'INTERNAL_SERVER_ERROR'
      })
    }
  }

  /**
   * Get employee assignments across all projects
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async getEmployeeAssignments(req, res) {
    try {
      console.log('[AssignmentController] Get employee assignments request:', req.params.employeeId)

      // Validate employee ID (should be UUID)
      const employeeId = req.params.employeeId
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      if (!uuidRegex.test(employeeId)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid employee ID format (must be UUID)',
          code: 'VALIDATION_ERROR'
        })
      }

      // Get assignments with project details
      const query = `
        SELECT 
          pa.*,
          p.name as project_name,
          p.status as project_status,
          p.start_date as project_start_date,
          p.end_date as project_end_date
        FROM project_assignments pa
        JOIN projects p ON pa.project_id = p.id
        WHERE pa.employee_id = $1
        ORDER BY p.created_at DESC
      `
      
      const result = await database.query(query, [employeeId])

      // Calculate workload summary
      const activeAssignments = result.rows.filter(a => 
        a.project_status === 'active' || a.project_status === 'planning'
      )
      const totalAllocation = activeAssignments.reduce((sum, a) => sum + a.allocation_percentage, 0)

      res.json({
        success: true,
        data: {
          employee_id: employeeId,
          assignments: result.rows.map(assignment => ({
            id: assignment.id,
            project_id: assignment.project_id,
            project_name: assignment.project_name,
            project_status: assignment.project_status,
            role: assignment.role,
            allocation_percentage: assignment.allocation_percentage,
            start_date: assignment.start_date,
            end_date: assignment.end_date,
            project_start_date: assignment.project_start_date,
            project_end_date: assignment.project_end_date,
            created_at: assignment.created_at
          })),
          workload_summary: {
            total_projects: result.rows.length,
            active_projects: activeAssignments.length,
            total_allocation_percentage: totalAllocation,
            is_overallocated: totalAllocation > 100
          }
        }
      })
    } catch (error) {
      console.error('[AssignmentController] Get employee assignments error:', error.message)
      
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve employee assignments',
        code: 'INTERNAL_SERVER_ERROR'
      })
    }
  }
}

// Create singleton instance
const assignmentController = new AssignmentController()

module.exports = {
  AssignmentController,
  assignmentController
}