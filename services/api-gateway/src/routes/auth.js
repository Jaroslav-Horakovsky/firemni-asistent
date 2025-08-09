const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const router = express.Router();

// Proxy authentication requests to user-service
const authProxy = createProxyMiddleware({
  target: process.env.USER_SERVICE_URL + '/auth',
  changeOrigin: true,
  timeout: 30000, // 30 seconds timeout
  proxyTimeout: 30000, // 30 seconds proxy timeout
  onError: (err, req, res) => {
    console.error(`[Auth Proxy Error] ${req.method} ${req.originalUrl} -> ${err.message}`);
    
    if (!res.headersSent) {
      res.status(502).json({
        success: false,
        message: 'Authentication service temporarily unavailable',
        error: 'AUTH_SERVICE_ERROR',
        details: process.env.NODE_ENV === 'development' ? err.message : undefined
      });
    }
  },
  onProxyReq: (proxyReq, req, res) => {
    console.log(`[Auth Proxy] ${req.method} ${req.originalUrl} -> ${process.env.USER_SERVICE_URL}${req.url}`);
    console.log(`[Auth Proxy Debug] req.url: "${req.url}", req.path: "${req.path}"`);
  },
  onProxyRes: (proxyRes, req, res) => {
    console.log(`[Auth Proxy Response] ${req.method} ${req.originalUrl} -> ${proxyRes.statusCode}`);
  }
});

// Debug middleware to see what the router receives
router.use('/', (req, res, next) => {
  console.log(`[Auth Router Debug] Received: ${req.method} ${req.originalUrl}, router gets: ${req.url}, path: ${req.path}`);
  next();
});

// Route all auth requests to user-service
router.use('/', authProxy);

module.exports = router;