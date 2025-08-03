const { database } = require('../utils/database')

class ProjectService {
  /**
   * Check if project status transition is valid
   * @param {string} currentStatus - Current project status
   * @param {string} newStatus - New status to transition to
   * @returns {boolean} True if transition is valid
   */
  isValidStatusTransition(currentStatus, newStatus) {
    const validTransitions = {
      'planning': ['active', 'cancelled'],
      'active': ['on-hold', 'completed', 'cancelled'],
      'on-hold': ['active', 'cancelled'],
      'completed': [], // Completed projects cannot be changed
      'cancelled': [] // Cancelled projects cannot be changed
    }

    return validTransitions[currentStatus]?.includes(newStatus) || false
  }

  /**
   * Get project status workflow information
   * @param {string} status - Current project status
   * @returns {Object} Status workflow information
   */
  getStatusWorkflow(status) {
    const workflows = {
      'planning': {
        label: 'Planning',
        description: 'Project is being planned and prepared',
        color: '#17a2b8',
        allowedTransitions: ['active', 'cancelled'],
        canAddTasks: true,
        canAssignEmployees: true,
        canModify: true
      },
      'active': {
        label: 'Active',
        description: 'Project is actively being worked on',
        color: '#28a745',
        allowedTransitions: ['on-hold', 'completed', 'cancelled'],
        canAddTasks: true,
        canAssignEmployees: true,
        canModify: true
      },
      'on-hold': {
        label: 'On Hold',
        description: 'Project is temporarily paused',
        color: '#ffc107',
        allowedTransitions: ['active', 'cancelled'],
        canAddTasks: false,
        canAssignEmployees: false,
        canModify: true
      },
      'completed': {
        label: 'Completed',
        description: 'Project has been successfully completed',
        color: '#6c757d',
        allowedTransitions: [],
        canAddTasks: false,
        canAssignEmployees: false,
        canModify: false
      },
      'cancelled': {
        label: 'Cancelled',
        description: 'Project has been cancelled',
        color: '#dc3545',
        allowedTransitions: [],
        canAddTasks: false,
        canAssignEmployees: false,
        canModify: false
      }
    }

    return workflows[status] || workflows['planning']
  }

  /**
   * Check for assignment conflicts
   * @param {number} projectId - Project ID
   * @param {number} employeeId - Employee ID
   * @param {number} allocationPercentage - Allocation percentage
   * @param {Date} startDate - Assignment start date
   * @param {Date} endDate - Assignment end date
   * @returns {Promise<Object>} Conflict check result
   */
  async checkAssignmentConflict(projectId, employeeId, allocationPercentage, startDate = null, endDate = null) {
    try {
      // Get all active assignments for the employee
      const query = `
        SELECT 
          pa.project_id,
          pa.allocation_percentage,
          pa.start_date,
          pa.end_date,
          p.name as project_name,
          p.status as project_status
        FROM project_assignments pa
        JOIN projects p ON pa.project_id = p.id
        WHERE pa.employee_id = $1 
        AND p.status IN ('planning', 'active')
        AND pa.project_id != $2
      `
      
      const result = await database.query(query, [employeeId, projectId])
      
      let conflicts = []
      let totalAllocation = allocationPercentage

      for (const assignment of result.rows) {
        // Check for date overlap if dates are specified
        if (startDate && endDate && assignment.start_date && assignment.end_date) {
          const assignmentStart = new Date(assignment.start_date)
          const assignmentEnd = new Date(assignment.end_date)
          const newStart = new Date(startDate)
          const newEnd = new Date(endDate)

          // Check for overlap
          if (newStart <= assignmentEnd && newEnd >= assignmentStart) {
            totalAllocation += assignment.allocation_percentage
            conflicts.push({
              project_id: assignment.project_id,
              project_name: assignment.project_name,
              allocation_percentage: assignment.allocation_percentage,
              start_date: assignment.start_date,
              end_date: assignment.end_date,
              overlap_type: 'date_overlap'
            })
          }
        } else {
          // No specific dates, assume general conflict
          totalAllocation += assignment.allocation_percentage
          conflicts.push({
            project_id: assignment.project_id,
            project_name: assignment.project_name,
            allocation_percentage: assignment.allocation_percentage,
            overlap_type: 'allocation_conflict'
          })
        }
      }

      return {
        hasConflict: totalAllocation > 100,
        totalAllocation,
        conflicts,
        isOverallocated: totalAllocation > 100
      }
    } catch (error) {
      console.error('[ProjectService] Assignment conflict check error:', error.message)
      throw error
    }
  }

  /**
   * Validate task dependency and check for cycles
   * @param {number} taskId - Task ID
   * @param {number} dependsOnTaskId - Task to depend on
   * @returns {Promise<Object>} Validation result
   */
  async validateTaskDependency(taskId, dependsOnTaskId) {
    try {
      // Check if tasks exist and belong to the same project
      const tasksQuery = `
        SELECT id, project_id, name, status FROM project_tasks 
        WHERE id IN ($1, $2)
      `
      const tasksResult = await database.query(tasksQuery, [taskId, dependsOnTaskId])
      
      if (tasksResult.rows.length !== 2) {
        return {
          isValid: false,
          error: 'One or both tasks not found'
        }
      }

      const [task1, task2] = tasksResult.rows
      const task = task1.id === taskId ? task1 : task2
      const dependencyTask = task1.id === dependsOnTaskId ? task1 : task2

      if (task.project_id !== dependencyTask.project_id) {
        return {
          isValid: false,
          error: 'Tasks must belong to the same project'
        }
      }

      // Check for circular dependencies using recursive query
      const circularCheckQuery = `
        WITH RECURSIVE dependency_chain AS (
          -- Base case: direct dependencies
          SELECT task_id, depends_on_task_id, 1 as depth
          FROM task_dependencies
          WHERE task_id = $1
          
          UNION ALL
          
          -- Recursive case: follow the chain
          SELECT td.task_id, td.depends_on_task_id, dc.depth + 1
          FROM task_dependencies td
          JOIN dependency_chain dc ON td.task_id = dc.depends_on_task_id
          WHERE dc.depth < 10 -- Prevent infinite loops
        )
        SELECT * FROM dependency_chain WHERE depends_on_task_id = $2
      `
      
      const circularResult = await database.query(circularCheckQuery, [dependsOnTaskId, taskId])
      
      if (circularResult.rows.length > 0) {
        return {
          isValid: false,
          error: 'Creating this dependency would cause a circular dependency',
          circularPath: circularResult.rows
        }
      }

      // Check if dependency already exists
      const existingQuery = `
        SELECT id FROM task_dependencies 
        WHERE task_id = $1 AND depends_on_task_id = $2
      `
      const existingResult = await database.query(existingQuery, [taskId, dependsOnTaskId])
      
      if (existingResult.rows.length > 0) {
        return {
          isValid: false,
          error: 'Dependency already exists'
        }
      }

      return {
        isValid: true,
        task: {
          id: task.id,
          name: task.name,
          status: task.status
        },
        dependencyTask: {
          id: dependencyTask.id,
          name: dependencyTask.name,
          status: dependencyTask.status
        }
      }
    } catch (error) {
      console.error('[ProjectService] Task dependency validation error:', error.message)
      throw error
    }
  }

  /**
   * Get project health metrics
   * @param {number} projectId - Project ID
   * @returns {Promise<Object>} Project health metrics
   */
  async getProjectHealth(projectId) {
    try {
      // Get project basic info
      const projectQuery = 'SELECT * FROM projects WHERE id = $1'
      const projectResult = await database.query(projectQuery, [projectId])
      
      if (projectResult.rows.length === 0) {
        throw new Error('Project not found')
      }

      const project = projectResult.rows[0]

      // Get team size
      const teamQuery = 'SELECT COUNT(*) as team_size FROM project_assignments WHERE project_id = $1'
      const teamResult = await database.query(teamQuery, [projectId])
      const teamSize = parseInt(teamResult.rows[0].team_size)

      // Get task statistics
      const tasksQuery = `
        SELECT 
          COUNT(*) as total_tasks,
          COUNT(CASE WHEN status = 'todo' THEN 1 END) as todo_tasks,
          COUNT(CASE WHEN status = 'in_progress' THEN 1 END) as in_progress_tasks,
          COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_tasks,
          SUM(estimated_hours) as total_estimated_hours,
          COUNT(CASE WHEN due_date < NOW() AND status != 'completed' THEN 1 END) as overdue_tasks
        FROM project_tasks 
        WHERE project_id = $1
      `
      const tasksResult = await database.query(tasksQuery, [projectId])
      const taskStats = tasksResult.rows[0]

      // Calculate progress
      const totalTasks = parseInt(taskStats.total_tasks)
      const completedTasks = parseInt(taskStats.completed_tasks)
      const progressPercentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0

      // Calculate health score (0-100)
      let healthScore = 100

      // Deduct points for overdue tasks
      const overdueTasks = parseInt(taskStats.overdue_tasks)
      if (overdueTasks > 0) {
        healthScore -= Math.min(overdueTasks * 10, 40) // Max 40 points deduction
      }

      // Deduct points for low progress if project is active
      if (project.status === 'active' && progressPercentage < 25) {
        healthScore -= 20
      }

      // Deduct points for no team assigned
      if (teamSize === 0 && project.status !== 'planning') {
        healthScore -= 15
      }

      // Deduct points for budget overruns (simplified check)
      // This would need timesheet integration for accurate calculation

      // Determine health status
      let healthStatus = 'excellent'
      if (healthScore < 50) healthStatus = 'critical'
      else if (healthScore < 70) healthStatus = 'poor'
      else if (healthScore < 85) healthStatus = 'good'

      return {
        project_id: projectId,
        project_name: project.name,
        project_status: project.status,
        health_score: Math.max(healthScore, 0),
        health_status: healthStatus,
        metrics: {
          team_size: teamSize,
          total_tasks: totalTasks,
          completed_tasks: completedTasks,
          progress_percentage: progressPercentage,
          overdue_tasks: overdueTasks,
          total_estimated_hours: taskStats.total_estimated_hours ? parseInt(taskStats.total_estimated_hours) : 0
        },
        recommendations: this.generateHealthRecommendations(healthScore, {
          teamSize,
          overdueTasks,
          progressPercentage,
          projectStatus: project.status
        })
      }
    } catch (error) {
      console.error('[ProjectService] Project health calculation error:', error.message)
      throw error
    }
  }

  /**
   * Generate health recommendations based on metrics
   * @private
   */
  generateHealthRecommendations(healthScore, metrics) {
    const recommendations = []

    if (metrics.overdueTasks > 0) {
      recommendations.push({
        type: 'urgent',
        message: `${metrics.overdueTasks} tasks are overdue. Review task assignments and deadlines.`
      })
    }

    if (metrics.teamSize === 0 && metrics.projectStatus !== 'planning') {
      recommendations.push({
        type: 'warning',
        message: 'No team members assigned to this project. Assign employees to start work.'
      })
    }

    if (metrics.progressPercentage < 25 && metrics.projectStatus === 'active') {
      recommendations.push({
        type: 'info',
        message: 'Project progress is low. Consider reviewing task breakdown and assignments.'
      })
    }

    if (recommendations.length === 0) {
      recommendations.push({
        type: 'success',
        message: 'Project is healthy and on track.'
      })
    }

    return recommendations
  }

  /**
   * Get aggregated project data for dashboards
   * @param {Object} filters - Optional filters
   * @returns {Promise<Object>} Aggregated project data
   */
  async getProjectAggregates(filters = {}) {
    try {
      let whereClause = 'WHERE 1=1'
      const queryParams = []
      let paramIndex = 1

      // Apply filters
      if (filters.customer_id) {
        whereClause += ` AND customer_id = $${paramIndex}`
        queryParams.push(filters.customer_id)
        paramIndex++
      }

      if (filters.status) {
        whereClause += ` AND status = $${paramIndex}`
        queryParams.push(filters.status)
        paramIndex++
      }

      if (filters.start_date) {
        whereClause += ` AND created_at >= $${paramIndex}`
        queryParams.push(filters.start_date)
        paramIndex++
      }

      if (filters.end_date) {
        whereClause += ` AND created_at <= $${paramIndex}`
        queryParams.push(filters.end_date)
        paramIndex++
      }

      const aggregateQuery = `
        SELECT 
          COUNT(*) as total_projects,
          COUNT(CASE WHEN status = 'planning' THEN 1 END) as planning_projects,
          COUNT(CASE WHEN status = 'active' THEN 1 END) as active_projects,
          COUNT(CASE WHEN status = 'on-hold' THEN 1 END) as on_hold_projects,
          COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_projects,
          COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_projects,
          AVG(budget_amount) as avg_budget,
          SUM(budget_amount) as total_budget,
          AVG(estimated_hours) as avg_estimated_hours,
          SUM(estimated_hours) as total_estimated_hours
        FROM projects ${whereClause}
      `

      const result = await database.query(aggregateQuery, queryParams)
      const stats = result.rows[0]

      return {
        summary: {
          total_projects: parseInt(stats.total_projects),
          active_projects: parseInt(stats.active_projects),
          completed_projects: parseInt(stats.completed_projects)
        },
        status_breakdown: {
          planning: parseInt(stats.planning_projects),
          active: parseInt(stats.active_projects),
          on_hold: parseInt(stats.on_hold_projects),
          completed: parseInt(stats.completed_projects),
          cancelled: parseInt(stats.cancelled_projects)
        },
        financial: {
          total_budget: stats.total_budget ? parseFloat(stats.total_budget) : 0,
          average_budget: stats.avg_budget ? parseFloat(stats.avg_budget) : 0
        },
        time_estimates: {
          total_estimated_hours: stats.total_estimated_hours ? parseInt(stats.total_estimated_hours) : 0,
          average_estimated_hours: stats.avg_estimated_hours ? parseFloat(stats.avg_estimated_hours) : 0
        }
      }
    } catch (error) {
      console.error('[ProjectService] Project aggregates error:', error.message)
      throw error
    }
  }
}

// Create singleton instance
const projectService = new ProjectService()

module.exports = {
  ProjectService,
  projectService
}