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
const { authenticateToken, errorHandler, logger } = require('./middleware');

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

// Request parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging middleware
app.use(logger);

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
    onError: (err, req, res) => {
      console.error(`[Proxy Error] ${err.message}`);
      res.status(502).json({
        success: false,
        message: 'Service temporarily unavailable',
        error: 'PROXY_ERROR'
      });
    },
    onProxyReq: (proxyReq, req, res) => {
      console.log(`[Proxy] ${req.method} ${req.originalUrl} -> ${target}${req.url}`);
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
  console.log(`[API Gateway] Starting on port ${PORT}`);
  console.log(`[API Gateway] Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`[API Gateway] Health check: http://localhost:${PORT}/health`);
  console.log(`[API Gateway] Documentation: http://localhost:${PORT}/docs`);
  console.log(`[API Gateway] Services:`);
  console.log(`  - User Service: ${process.env.USER_SERVICE_URL}`);
  console.log(`  - Customer Service: ${process.env.CUSTOMER_SERVICE_URL}`);
  console.log(`  - Order Service: ${process.env.ORDER_SERVICE_URL}`);
  console.log(`[API Gateway] External APIs: Stripe ✓, SendGrid ✓`);
});

module.exports = app;