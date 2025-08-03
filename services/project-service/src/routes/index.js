const express = require('express')

const router = express.Router()

// API info endpoint
router.get('/', (req, res) => {
  res.json({
    service: 'project-service',
    version: '1.0.0',
    message: 'Project Service API - Ready for project management!',
    endpoints: {
      '/projects': 'Project management endpoints (RELACE 35)',
      '/projects/:id/assignments': 'Team assignment endpoints (RELACE 35)',
      '/projects/:id/tasks': 'Task management endpoints (RELACE 35)',
      '/health': 'Health check'
    },
    status: 'RELACE 34 Foundation Complete - Controllers coming in RELACE 35',
    timestamp: new Date().toISOString()
  })
})

module.exports = router