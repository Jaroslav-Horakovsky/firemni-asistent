const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const router = express.Router();

// Proxy authentication requests to user-service
const authProxy = createProxyMiddleware({
  target: process.env.USER_SERVICE_URL,
  changeOrigin: true,
  pathRewrite: {
    '^/api/auth': '/auth'
  },
  onError: (err, req, res) => {
    console.error(`[Auth Proxy Error] ${err.message}`);
    res.status(502).json({
      success: false,
      message: 'Authentication service temporarily unavailable',
      error: 'AUTH_SERVICE_ERROR'
    });
  },
  onProxyReq: (proxyReq, req, res) => {
    console.log(`[Auth Proxy] ${req.method} ${req.originalUrl} -> ${process.env.USER_SERVICE_URL}/auth${req.url}`);
  }
});

// Route all auth requests to user-service
router.use('/', authProxy);

module.exports = router;