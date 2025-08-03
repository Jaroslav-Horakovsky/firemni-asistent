const express = require('express')
const employeeRoutes = require('./employee.routes')

const router = express.Router()

// Mount employee routes
router.use('/employees', employeeRoutes)

// API info endpoint
router.get('/', (req, res) => {
  res.json({
    service: 'employee-service',
    version: '1.0.0',
    message: 'Employee Service API - Ready for workforce management!',
    endpoints: {
      '/employees': 'Employee management endpoints',
      '/employees/stats': 'Employee statistics',
      '/employees/department/:department': 'Department-specific employees',
      '/employees/skills': 'Skills-based employee search',
      '/health': 'Health check'
    },
    documentation: '/api-docs',
    timestamp: new Date().toISOString()
  })
})

module.exports = router