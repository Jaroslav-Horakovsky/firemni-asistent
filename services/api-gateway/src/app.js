const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const { createProxyMiddleware } = require('http-proxy-middleware');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const paymentRoutes = require('./routes/payments');
const notificationRoutes = require('./routes/notifications');
const analyticsRoutes = require('./routes/analytics');
const webhookRoutes = require('./routes/webhooks');
const { authenticateToken, errorHandler, requestLogger } = require('./middleware');
const logger = require('./utils/logger');

const app = express();
const PORT = process.env.PORT || 3000;

// Security and middleware
app.use(helmet());
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002', 'http://localhost:3003'],
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
app.use(limiter);

// Webhook routes (BEFORE express.json middleware for raw body parsing)
app.use('/api/webhooks', webhookRoutes);

// Conditional request parsing - only for local routes, not proxy routes
app.use((req, res, next) => {
  // Only parse JSON for local routes (auth, payments, notifications, analytics)
  if (req.path.startsWith('/api/auth') || 
      req.path.startsWith('/api/payments') || 
      req.path.startsWith('/api/notifications') || 
      req.path.startsWith('/api/analytics') ||
      req.path.startsWith('/api/webhooks')) {
    express.json({ limit: '10mb' })(req, res, next);
  } else {
    next();
  }
});

app.use((req, res, next) => {
  // Only parse urlencoded for local routes
  if (req.path.startsWith('/api/auth') || 
      req.path.startsWith('/api/payments') || 
      req.path.startsWith('/api/notifications') || 
      req.path.startsWith('/api/analytics')) {
    express.urlencoded({ extended: true, limit: '10mb' })(req, res, next);
  } else {
    next();
  }
});

// Logging middleware
app.use(requestLogger);

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'api-gateway',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// API Documentation
app.get('/docs', (req, res) => {
  res.json({
    name: 'Firemní Asistent API Gateway',
    version: '1.0.0',
    description: 'Unified API Gateway for all microservices',
    endpoints: {
      auth: '/api/auth/* -> user-service:3001',
      customers: '/api/customers/* -> customer-service:3002',
      orders: '/api/orders/* -> order-service:3003',
      employees: '/api/employees/* -> employee-service:3004',
      projects: '/api/projects/* -> project-service:3005',
      payments: '/api/payments/* -> payment processing',
      notifications: '/api/notifications/* -> email notifications',
      analytics: '/api/analytics/* -> business intelligence & reporting',
      webhooks: '/api/webhooks/* -> stripe webhook processing'
    },
    health: '/health',
    documentation: '/docs'
  });
});

// Authentication routes (handled locally)
app.use('/api/auth', authRoutes);

// New payment routes (handled locally with Stripe integration)
app.use('/api/payments', paymentRoutes);

// New notification routes (handled locally with SendGrid)
app.use('/api/notifications', notificationRoutes);

// New analytics routes (RELACE 17 - Business Intelligence)
app.use('/api/analytics', analyticsRoutes);

// Proxy routes to existing services
const createServiceProxy = (target, pathRewrite = {}) => {
  return createProxyMiddleware({
    target,
    changeOrigin: true,
    pathRewrite,
    timeout: 30000, // 30 seconds timeout
    proxyTimeout: 30000, // 30 seconds proxy timeout
    
    onProxyReq: (proxyReq, req, res) => {
      logger.debug('Proxy request initiated', {
        method: req.method,
        originalUrl: req.originalUrl,
        targetUrl: `${target}${req.url}`,
        headers: req.headers
      });
    },
    
    onProxyRes: (proxyRes, req, res) => {
      logger.debug('Proxy response received', {
        method: req.method,
        originalUrl: req.originalUrl,
        statusCode: proxyRes.statusCode,
        responseTime: new Date() - req.startTime
      });
    },
    
    onError: (err, req, res) => {
      logger.error('Proxy request failed', {
        method: req.method,
        originalUrl: req.originalUrl,
        error: err.message,
        target: target
      });
      
      if (!res.headersSent) {
        res.status(502).json({
          success: false,
          message: 'Service temporarily unavailable',
          error: 'PROXY_ERROR',
          details: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
      }
    }
  });
};

// Route to services
app.use('/api/users', authenticateToken, createServiceProxy(process.env.USER_SERVICE_URL, {
  '^/api/users': ''
}));

app.use('/api/customers', authenticateToken, createServiceProxy(process.env.CUSTOMER_SERVICE_URL, {
  '^/api/customers': ''
}));

app.use('/api/orders', authenticateToken, createServiceProxy(process.env.ORDER_SERVICE_URL, {
  '^/api/orders': ''
}));

app.use('/api/employees', authenticateToken, createServiceProxy(process.env.EMPLOYEE_SERVICE_URL, {
  '^/api/employees': ''
}));

app.use('/api/projects', authenticateToken, createServiceProxy(process.env.PROJECT_SERVICE_URL, {
  '^/api/projects': ''
}));

// Error handling
app.use(errorHandler);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint not found',
    path: req.originalUrl,
    method: req.method
  });
});

// Start server
app.listen(PORT, () => {
  logger.info('API Gateway started successfully', {
    port: PORT,
    environment: process.env.NODE_ENV || 'development',
    healthCheck: `http://localhost:${PORT}/health`,
    documentation: `http://localhost:${PORT}/docs`,
    services: {
      userService: process.env.USER_SERVICE_URL,
      customerService: process.env.CUSTOMER_SERVICE_URL,
      orderService: process.env.ORDER_SERVICE_URL,
      employeeService: process.env.EMPLOYEE_SERVICE_URL,
      projectService: process.env.PROJECT_SERVICE_URL
    },
    externalAPIs: ['Stripe', 'SendGrid']
  });
});

module.exports = app;