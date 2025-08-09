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
const logger = require('./utils/logger')

const app = express()
const PORT = process.env.PORT || 3003

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
      await secretsManager.getSecret('DB_ORDER_SERVICE_URL')
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

    // Service is operational if critical components (database, JWT) are working
    // Secrets check is non-critical in development environment
    const isOperational = databaseHealthy && jwtHealthy
    
    const healthStatus = {
      status: isOperational ? (secretsHealthy ? 'healthy' : 'degraded') : 'unhealthy',
      timestamp: new Date().toISOString(),
      service: 'order-service',
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

    // Return 200 if service is operational (healthy or degraded), 503 only if unhealthy
    const statusCode = isOperational ? 200 : 503
    console.log('[Server] Health check completed:', healthStatus.status)
    res.status(statusCode).json(healthStatus)
  } catch (error) {
    logger.error('Health check failed', {
      error: error.message,
      endpoint: '/health',
      service: 'order-service'
    })
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      service: 'order-service',
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
  logger.error('Global error handler', {
    error: error.message,
    stack: error.stack,
    endpoint: req.originalUrl,
    method: req.method,
    userAgent: req.get('User-Agent'),
    ip: req.ip
  })
  
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
    logger.info('Starting order-service', {
      port: PORT,
      environment: process.env.NODE_ENV || 'development'
    })
    
    // Initialize database connection
    logger.info('Connecting to database')
    await database.connect()
    
    // Create database tables
    logger.info('Creating database tables')
    await database.createOrderTables()
    
    // Initialize JWT manager
    logger.info('Initializing JWT manager')
    await jwtManager.initialize()
    
    // Start HTTP server
    const server = app.listen(PORT, () => {
      logger.info('Order service started successfully', {
        port: PORT,
        environment: process.env.NODE_ENV || 'development',
        healthCheck: `http://localhost:${PORT}/health`,
        status: 'Database connected with all tables created'
      })
    })

    return server
  } catch (error) {
    logger.error('Failed to start server', {
      error: error.message,
      stack: error.stack
    })
    process.exit(1)
  }
}

// Start the server
const serverPromise = startServer()

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully')
  try {
    const server = await serverPromise
    server.close(async () => {
      await database.disconnect()
      logger.info('Process terminated')
      process.exit(0)
    })
  } catch (error) {
    logger.error('Error during shutdown', { error: error.message })
    process.exit(1)
  }
})

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully')
  try {
    const server = await serverPromise
    server.close(async () => {
      await database.disconnect()
      logger.info('Process terminated')
      process.exit(0)
    })
  } catch (error) {
    logger.error('Error during shutdown', { error: error.message })
    process.exit(1)
  }
})

module.exports = app