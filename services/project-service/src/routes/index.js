const express = require('express')
const { projectController } = require('../controllers/project.controller')
const { assignmentController } = require('../controllers/assignment.controller')
const { taskController } = require('../controllers/task.controller')

const router = express.Router()

// API info endpoint
router.get('/', (req, res) => {
  res.json({
    service: 'project-service',
    version: '1.0.0',
    message: 'Project Service API - Complete project management system!',
    endpoints: {
      // Project endpoints
      'GET /projects': 'List projects with pagination and filters',
      'POST /projects': 'Create new project',
      'GET /projects/:id': 'Get project by ID',
      'PUT /projects/:id': 'Update project',
      'DELETE /projects/:id': 'Cancel project (soft delete)',
      'GET /projects/stats': 'Get project statistics',
      'GET /customers/:customerId/projects': 'Get projects by customer',
      
      // Assignment endpoints
      'GET /projects/:projectId/assignments': 'Get project team assignments',
      'POST /projects/:projectId/assignments': 'Assign employee to project',
      'GET /assignments/:id': 'Get assignment by ID',
      'PUT /assignments/:id': 'Update assignment',
      'DELETE /assignments/:id': 'Remove assignment',
      'GET /employees/:employeeId/assignments': 'Get employee assignments',
      
      // Task endpoints
      'GET /projects/:projectId/tasks': 'Get project tasks',
      'POST /projects/:projectId/tasks': 'Create new task',
      'GET /tasks/:id': 'Get task by ID with dependencies',
      'PUT /tasks/:id': 'Update task',
      'DELETE /tasks/:id': 'Delete task',
      'GET /tasks/:id/dependencies': 'Get task dependencies',
      'POST /tasks/:id/dependencies': 'Add task dependency',
      'DELETE /dependencies/:dependencyId': 'Remove task dependency',
      
      // Health check
      '/health': 'Health check endpoint'
    },
    status: 'RELACE 35 Complete - Full API Implementation Ready',
    controllers: {
      project: 'Complete CRUD operations with business logic',
      assignment: 'Team management with conflict detection',
      task: 'Task management with dependency tracking'
    },
    timestamp: new Date().toISOString()
  })
})

// ==========================================
// PROJECT ROUTES
// ==========================================

// Project statistics (must be before :id routes)
router.get('/projects/stats', projectController.getProjectStats.bind(projectController))

// Main project CRUD operations
router.get('/projects', projectController.getProjects.bind(projectController))
router.post('/projects', projectController.createProject.bind(projectController))
router.get('/projects/:id', projectController.getProject.bind(projectController))
router.put('/projects/:id', projectController.updateProject.bind(projectController))
router.delete('/projects/:id', projectController.deleteProject.bind(projectController))

// Projects by customer
router.get('/customers/:customerId/projects', projectController.getProjectsByCustomer.bind(projectController))

// ==========================================
// ASSIGNMENT ROUTES
// ==========================================

// Project assignments
router.get('/projects/:projectId/assignments', assignmentController.getAssignments.bind(assignmentController))
router.post('/projects/:projectId/assignments', assignmentController.createAssignment.bind(assignmentController))

// Individual assignment operations
router.get('/assignments/:id', assignmentController.getAssignment.bind(assignmentController))
router.put('/assignments/:id', assignmentController.updateAssignment.bind(assignmentController))
router.delete('/assignments/:id', assignmentController.removeAssignment.bind(assignmentController))

// Employee assignments across projects
router.get('/employees/:employeeId/assignments', assignmentController.getEmployeeAssignments.bind(assignmentController))

// ==========================================
// TASK ROUTES
// ==========================================

// Project tasks
router.get('/projects/:projectId/tasks', taskController.getTasks.bind(taskController))
router.post('/projects/:projectId/tasks', taskController.createTask.bind(taskController))

// Individual task operations
router.get('/tasks/:id', taskController.getTask.bind(taskController))
router.put('/tasks/:id', taskController.updateTask.bind(taskController))
router.delete('/tasks/:id', taskController.deleteTask.bind(taskController))

// Task dependencies
router.get('/tasks/:id/dependencies', taskController.getTaskDependencies.bind(taskController))
router.post('/tasks/:id/dependencies', taskController.addDependency.bind(taskController))
router.delete('/dependencies/:dependencyId', taskController.removeDependency.bind(taskController))

// ==========================================
// ERROR HANDLING MIDDLEWARE
// ==========================================

// 404 handler for undefined routes
router.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found',
    code: 'ROUTE_NOT_FOUND',
    message: `The requested route ${req.method} ${req.originalUrl} does not exist`,
    available_endpoints: {
      projects: [
        'GET /projects',
        'POST /projects', 
        'GET /projects/:id',
        'PUT /projects/:id',
        'DELETE /projects/:id'
      ],
      assignments: [
        'GET /projects/:projectId/assignments',
        'POST /projects/:projectId/assignments',
        'GET /assignments/:id',
        'PUT /assignments/:id',
        'DELETE /assignments/:id'
      ],
      tasks: [
        'GET /projects/:projectId/tasks',
        'POST /projects/:projectId/tasks',
        'GET /tasks/:id',
        'PUT /tasks/:id',
        'DELETE /tasks/:id'
      ]
    }
  })
})

// Global error handler
router.use((error, req, res, next) => {
  console.error('[Routes] Error:', error.message)
  console.error('[Routes] Stack:', error.stack)

  // Handle specific error types
  if (error.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      error: 'Validation Error',
      code: 'VALIDATION_ERROR',
      details: error.message
    })
  }

  if (error.code === '23503') { // PostgreSQL foreign key violation
    return res.status(400).json({
      success: false,
      error: 'Foreign key constraint violation',
      code: 'FOREIGN_KEY_VIOLATION',
      message: 'Referenced resource does not exist'
    })
  }

  if (error.code === '23505') { // PostgreSQL unique violation
    return res.status(409).json({
      success: false,
      error: 'Resource already exists',
      code: 'DUPLICATE_RESOURCE',
      message: 'A resource with these details already exists'
    })
  }

  // Default internal server error
  res.status(500).json({
    success: false,
    error: 'Internal Server Error',
    code: 'INTERNAL_SERVER_ERROR',
    message: 'An unexpected error occurred while processing your request'
  })
})

module.exports = router