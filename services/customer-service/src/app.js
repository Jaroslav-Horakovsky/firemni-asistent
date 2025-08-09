// Load environment variables first
require('dotenv').config()

const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const compression = require('compression')
const morgan = require('morgan')
const cookieParser = require('cookie-parser')
const rateLimit = require('express-rate-limit')
const slowDown = require('express-slow-down')
const swaggerJsdoc = require('swagger-jsdoc')
const swaggerUi = require('swagger-ui-express')
require('express-async-errors')

// Import utilities
const { database } = require('./utils/database')
const { secretsManager } = require('./utils/secrets')
const { jwtManager } = require('./utils/jwt')
const logger = require('./utils/logger')

// Import routes
const customerRoutes = require('./routes/customer.routes')

// Create Express app
const app = express()

// Trust proxy for accurate IP addresses in production
app.set('trust proxy', 1)

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
      scriptSrc: ["'self'"]
    }
  },
  crossOriginEmbedderPolicy: false
}))

// CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, etc.)
    if (!origin) return callback(null, true)
    
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:3001', 
      'http://localhost:3002',
      'http://localhost:8080',
      'https://firemni-asistent.com',
      'https://app.firemni-asistent.com'
    ]
    
    if (process.env.NODE_ENV === 'development') {
      allowedOrigins.push('http://localhost:5173') // Vite dev server
      allowedOrigins.push('http://localhost:4200') // Angular dev server
    }
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true)
    } else {
      callback(new Error('Not allowed by CORS'))
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['X-Total-Count', 'X-Page-Count']
}

app.use(cors(corsOptions))

// Body parsing middleware
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))
app.use(cookieParser())

// Compression middleware
app.use(compression())

// Logging middleware
const morganFormat = process.env.NODE_ENV === 'production' ? 'combined' : 'dev'
app.use(morgan(morganFormat))

// Rate limiting middleware
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    success: false,
    error: 'Too many requests from this IP, please try again later',
    code: 'RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting for health checks
    return req.path === '/health' || req.path === '/ready'
  }
})

// Apply rate limiting to all requests
app.use(limiter)

// Speed limiting for sensitive endpoints
const apiSpeedLimiter = slowDown({
  windowMs: 15 * 60 * 1000, // 15 minutes
  delayAfter: 10, // Allow 10 requests per windowMs without delay
  delayMs: () => 200, // Add 200ms delay per request after delayAfter
  maxDelayMs: 5000 // Maximum delay of 5 seconds
})

// Apply speed limiting to API endpoints
app.use('/customers', apiSpeedLimiter)

// Swagger configuration
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Firemní Asistent - Customer Service API',
      version: '1.0.0',
      description: 'Customer management microservice with CRUD operations',
      contact: {
        name: 'Firemní Asistent Team',
        email: 'support@firemni-asistent.com'
      }
    },
    servers: [
      {
        url: process.env.NODE_ENV === 'production' 
          ? 'https://api.firemni-asistent.com/customer-service'
          : 'http://localhost:3002',
        description: process.env.NODE_ENV === 'production' ? 'Production server' : 'Development server'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        }
      }
    },
    security: [{
      bearerAuth: []
    }],
    tags: [
      {
        name: 'Customers',
        description: 'Customer management operations'
      }
    ]
  },
  apis: ['./src/routes/*.js']
}

const swaggerSpec = swaggerJsdoc(swaggerOptions)

// Swagger UI
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'Customer Service API Documentation'
}))

// API routes
app.use('/customers', customerRoutes)

// Health check endpoints
app.get('/health', async (req, res) => {
  try {
    const healthChecks = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'customer-service',
      version: process.env.npm_package_version || '1.0.0',
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      checks: {
        database: await database.healthCheck(),
        secrets: await secretsManager.healthCheck(),
        jwt: await jwtManager.healthCheck()
      }
    }

    // Service is healthy if critical components (database, JWT) are working
    // Secrets check is non-critical in development environment
    const criticalChecks = {
      database: healthChecks.checks.database,
      jwt: healthChecks.checks.jwt
    }
    
    const isHealthy = Object.values(criticalChecks).every(check => check === true)
    
    res.status(isHealthy ? 200 : 503).json(healthChecks)
  } catch (error) {
    logger.error('Health check failed', {
      error: error.message,
      endpoint: '/health',
      service: 'customer-service'
    })
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      service: 'customer-service',
      error: error.message
    })
  }
})

// Readiness check endpoint
app.get('/ready', async (req, res) => {
  try {
    // Check if service is ready to accept requests
    const isReady = database.isConnected && 
                   await database.healthCheck() &&
                   await secretsManager.healthCheck()

    if (isReady) {
      res.status(200).json({
        status: 'ready',
        timestamp: new Date().toISOString(),
        service: 'customer-service'
      })
    } else {
      res.status(503).json({
        status: 'not ready',
        timestamp: new Date().toISOString(),
        service: 'customer-service'
      })
    }
  } catch (error) {
    logger.error('Readiness check failed', {
      error: error.message,
      endpoint: '/ready',
      service: 'customer-service'
    })
    res.status(503).json({
      status: 'not ready',
      timestamp: new Date().toISOString(),
      service: 'customer-service',
      error: error.message
    })
  }
})

// Metrics endpoint (basic)
app.get('/metrics', (req, res) => {
  const memoryUsage = process.memoryUsage()
  const cpuUsage = process.cpuUsage()
  
  res.json({
    timestamp: new Date().toISOString(),
    service: 'customer-service',
    memory: {
      rss: Math.round(memoryUsage.rss / 1024 / 1024) + ' MB',
      heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024) + ' MB',
      heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024) + ' MB',
      external: Math.round(memoryUsage.external / 1024 / 1024) + ' MB'
    },
    cpu: {
      user: cpuUsage.user,
      system: cpuUsage.system
    },
    uptime: process.uptime(),
    database: database.getPoolStats()
  })
})

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    service: 'customer-service',
    version: process.env.npm_package_version || '1.0.0',
    status: 'running',
    timestamp: new Date().toISOString(),
    documentation: '/docs',
    health: '/health',
    readiness: '/ready'
  })
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

  // Validation errors
  if (error.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      code: 'VALIDATION_ERROR',
      details: error.details
    })
  }

  // JWT errors
  if (error.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      error: 'Invalid token',
      code: 'INVALID_TOKEN'
    })
  }

  if (error.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      error: 'Token expired',
      code: 'TOKEN_EXPIRED'
    })
  }

  // Database errors
  if (error.code === '23505') {
    return res.status(409).json({
      success: false,
      error: 'Resource already exists',
      code: 'DUPLICATE_RESOURCE'
    })
  }

  if (error.code === '23503') {
    return res.status(400).json({
      success: false,
      error: 'Referenced resource not found',
      code: 'FOREIGN_KEY_VIOLATION'
    })
  }

  // CORS errors
  if (error.message === 'Not allowed by CORS') {
    return res.status(403).json({
      success: false,
      error: 'CORS policy violation',
      code: 'CORS_ERROR'
    })
  }

  // Default server error
  res.status(500).json({
    success: false,
    error: process.env.NODE_ENV === 'production' 
      ? 'Internal server error' 
      : error.message,
    code: 'INTERNAL_SERVER_ERROR',
    ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
  })
})

// Initialize and start server
async function startServer() {
  try {
    const PORT = process.env.PORT || 3002
    
    logger.info('Starting customer-service', {
      port: PORT,
      environment: process.env.NODE_ENV || 'development'
    })
    
    // Initialize database connection
    logger.info('Connecting to database')
    await database.connect()
    
    // Create customers table if it doesn't exist
    logger.info('Creating database tables')
    await database.createCustomersTable()
    
    // Initialize JWT keys
    logger.info('Initializing JWT keys')
    await jwtManager.initialize()
    
    // Start HTTP server
    const server = app.listen(PORT, () => {
      logger.info('Customer service started successfully', {
        port: PORT,
        environment: process.env.NODE_ENV || 'development',
        documentation: `http://localhost:${PORT}/docs`,
        healthCheck: `http://localhost:${PORT}/health`
      })
    })

    // Graceful shutdown
    process.on('SIGTERM', async () => {
      logger.info('Received SIGTERM, shutting down gracefully')
      
      server.close(async () => {
        logger.info('HTTP server closed')
        
        try {
          await database.disconnect()
          logger.info('Database disconnected')
        } catch (error) {
          logger.error('Error disconnecting database', { error: error.message })
        }
        
        process.exit(0)
      })
    })

    process.on('SIGINT', async () => {
      logger.info('Received SIGINT, shutting down gracefully')
      
      server.close(async () => {
        logger.info('HTTP server closed')
        
        try {
          await database.disconnect()
          logger.info('Database disconnected')
        } catch (error) {
          logger.error('Error disconnecting database', { error: error.message })
        }
        
        process.exit(0)
      })
    })

  } catch (error) {
    logger.error('Failed to start server', {
      error: error.message,
      stack: error.stack
    })
    process.exit(1)
  }
}

// Start server if this file is run directly
if (require.main === module) {
  startServer()
}

module.exports = app