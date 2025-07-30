const express = require('express')
const orderRoutes = require('./order.routes')

const router = express.Router()

// Mount order routes
router.use('/orders', orderRoutes)

// API info endpoint
router.get('/', (req, res) => {
  res.json({
    service: 'order-service',
    version: '1.0.0',
    message: 'Order Service API - Ready for business!',
    endpoints: {
      '/orders': 'Order management endpoints',
      '/orders/stats': 'Order statistics',
      '/orders/customer/:customerId': 'Customer-specific orders',
      '/health': 'Health check'
    },
    documentation: '/api-docs',
    timestamp: new Date().toISOString()
  })
})

module.exports = router