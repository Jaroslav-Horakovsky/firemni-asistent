// Load environment variables first
require('dotenv').config()

const express = require('express')
const helmet = require('helmet')
const rateLimit = require('express-rate-limit')
const slowDown = require('express-slow-down')

// Import database and utilities
const { database } = require('./utils/database')
const { secretsManager } = require('./utils/secrets')
const { jwtManager } = require('./utils/jwt')

const app = express()
const PORT = process.env.PORT || 3005

// Security middleware
app.use(helmet())

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: {
    success: false,
    error: 'Too many requests from this IP, please try again later',
    code: 'RATE_LIMIT_EXCEEDED'
  }
})

// Speed limiting
const speedLimiter = slowDown({
  windowMs: 15 * 60 * 1000, // 15 minutes
  delayAfter: 50, // Allow 50 requests per windowMs without delay
  delayMs: () => 500 // Add 500ms delay per request after delayAfter
})

app.use(limiter)
app.use(speedLimiter)

// JSON parsing
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))

// Import routes
const routes = require('./routes')

// Use routes
app.use('/', routes)

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    console.log('[Server] Health check requested')
    
    // Check database connectivity
    const databaseHealthy = await database.healthCheck()
    
    // Check secrets manager
    let secretsHealthy = false
    try {
      await secretsManager.getSecret('DB_PROJECT_SERVICE_URL')
      secretsHealthy = true
    } catch (error) {
      console.warn('[Health] Secrets check failed:', error.message)
    }
    
    // Check JWT manager
    let jwtHealthy = false
    try {
      jwtHealthy = await jwtManager.healthCheck()
    } catch (error) {
      console.warn('[Health] JWT check failed:', error.message)
    }

    const healthStatus = {
      status: (databaseHealthy && secretsHealthy && jwtHealthy) ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      service: 'project-service',
      version: '1.0.0',
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      checks: {
        database: databaseHealthy,
        secrets: secretsHealthy,
        jwt: jwtHealthy
      },
      database_stats: database.getPoolStats()
    }

    const statusCode = healthStatus.status === 'healthy' ? 200 : 503
    console.log('[Server] Health check completed:', healthStatus.status)
    res.status(statusCode).json(healthStatus)
  } catch (error) {
    console.error('[Server] Health check failed:', error.message)
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      service: 'project-service',
      error: error.message
    })
  }
})


// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    code: 'NOT_FOUND',
    path: req.originalUrl,
    method: req.method
  })
})

// Global error handler
app.use((error, req, res, next) => {
  console.error('[Error]', error.stack)
  
  res.status(error.status || 500).json({
    success: false,
    error: error.message || 'Internal server error',
    code: error.code || 'INTERNAL_SERVER_ERROR',
    ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
  })
})

// Initialize database and start server
async function startServer() {
  try {
    console.log('[Server] Starting project-service...')
    console.log('[Server] Environment:', process.env.NODE_ENV || 'development')
    
    // Initialize database connection
    console.log('[Server] Connecting to database...')
    await database.connect()
    
    // Create database tables
    console.log('[Server] Creating database tables...')
    await database.createProjectTables()
    
    // Initialize JWT manager
    console.log('[Server] Initializing JWT manager...')
    await jwtManager.initialize()
    
    // Start HTTP server
    const server = app.listen(PORT, () => {
      console.log('[Server] Project service ready on port', PORT)
      console.log('[Server] Health check: http://localhost:' + PORT + '/health')
      console.log('[Server] Database: Connected with all tables created')
      console.log('[Server] RELACE 34: Project Service foundation complete!')
    })

    return server
  } catch (error) {
    console.error('[Server] Failed to start:', error.message)
    process.exit(1)
  }
}

// Start the server
const serverPromise = startServer()

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('[Server] SIGTERM received, shutting down gracefully')
  try {
    const server = await serverPromise
    server.close(async () => {
      await database.disconnect()
      console.log('[Server] Process terminated')
      process.exit(0)
    })
  } catch (error) {
    console.error('[Server] Error during shutdown:', error.message)
    process.exit(1)
  }
})

process.on('SIGINT', async () => {
  console.log('[Server] SIGINT received, shutting down gracefully')
  try {
    const server = await serverPromise
    server.close(async () => {
      await database.disconnect()
      console.log('[Server] Process terminated')
      process.exit(0)
    })
  } catch (error) {
    console.error('[Server] Error during shutdown:', error.message)
    process.exit(1)
  }
})

module.exports = app