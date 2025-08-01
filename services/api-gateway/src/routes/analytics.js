const express = require('express')
const axios = require('axios')
const { authenticateToken } = require('../middleware')

const router = express.Router()

// Service URLs from environment or defaults
const ORDER_SERVICE_URL = process.env.ORDER_SERVICE_URL || 'http://localhost:3003'
const CUSTOMER_SERVICE_URL = process.env.CUSTOMER_SERVICE_URL || 'http://localhost:3002'

/**
 * Business Intelligence & Analytics Routes - RELACE 17
 * Comprehensive dashboard and reporting endpoints
 */

/**
 * @swagger
 * /api/analytics/dashboard:
 *   get:
 *     summary: Get comprehensive dashboard metrics
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard metrics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     metrics:
 *                       type: object
 *                       properties:
 *                         totalRevenue:
 *                           type: number
 *                           description: Total revenue across all orders
 *                         totalOrders:
 *                           type: integer
 *                           description: Total number of orders
 *                         totalCustomers:
 *                           type: integer
 *                           description: Total number of customers
 *                         averageOrderValue:
 *                           type: number
 *                           description: Average order value
 *                         revenueGrowth:
 *                           type: number
 *                           description: Revenue growth percentage (30d vs 30d)
 *                         orderGrowth:
 *                           type: number
 *                           description: Order growth percentage (30d vs 30d)
 *                     ordersByStatus:
 *                       type: object
 *                       description: Order counts by status
 *                     revenueByPeriod:
 *                       type: object
 *                       description: Revenue breakdown by time periods
 *                     topCustomers:
 *                       type: array
 *                       description: Top customers by revenue
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get('/dashboard', authenticateToken, async (req, res) => {
  try {
    console.log('[Analytics] Dashboard metrics request from user:', req.user.userId)

    // Get order statistics
    const orderStatsResponse = await axios.get(`${ORDER_SERVICE_URL}/orders/stats`, {
      headers: { Authorization: req.headers.authorization }
    })

    // Get customer statistics
    const customerStatsResponse = await axios.get(`${CUSTOMER_SERVICE_URL}/customers/stats`, {
      headers: { Authorization: req.headers.authorization }
    })

    // Get recent orders for trend analysis
    const recentOrdersResponse = await axios.get(`${ORDER_SERVICE_URL}/orders?limit=50&sortBy=created_at&sortOrder=desc`, {
      headers: { Authorization: req.headers.authorization }
    })

    const orderStats = orderStatsResponse.data.data.statistics
    const customerStats = customerStatsResponse.data.data.statistics
    const recentOrders = recentOrdersResponse.data.data.orders

    // Calculate growth metrics (30d vs 30d comparison)
    const currentRevenue30d = calculateRevenueLast30Days(recentOrders)
    const previousRevenue30d = calculateRevenuePrevious30Days(recentOrders)
    const revenueGrowth = previousRevenue30d > 0 
      ? ((currentRevenue30d - previousRevenue30d) / previousRevenue30d) * 100 
      : 0

    const orderGrowth = orderStats.orders7d > 0 && orderStats.orders30d > 0
      ? ((orderStats.orders7d * 4.3 - orderStats.orders30d) / orderStats.orders30d) * 100
      : 0

    // Aggregate metrics
    const dashboardMetrics = {
      metrics: {
        totalRevenue: orderStats.totalRevenue,
        totalOrders: orderStats.totalOrders,
        totalCustomers: customerStats.totalCustomers || 0,
        averageOrderValue: orderStats.averageOrderValue,
        revenueGrowth: parseFloat(revenueGrowth.toFixed(2)),
        orderGrowth: parseFloat(orderGrowth.toFixed(2))
      },
      ordersByStatus: {
        draft: orderStats.draftOrders,
        pending: orderStats.pendingOrders,
        confirmed: orderStats.confirmedOrders,
        processing: orderStats.processingOrders,
        shipped: orderStats.shippedOrders,
        delivered: orderStats.deliveredOrders,
        cancelled: orderStats.cancelledOrders
      },
      revenueByPeriod: {
        last7Days: calculateRevenueLast7Days(recentOrders),
        last30Days: currentRevenue30d,
        last90Days: calculateRevenueLast90Days(recentOrders)
      },
      topCustomers: await getTopCustomers(req.headers.authorization, 5)
    }

    console.log('[Analytics] Dashboard metrics calculated successfully')
    res.json({
      success: true,
      data: dashboardMetrics
    })

  } catch (error) {
    console.error('[Analytics] Dashboard metrics error:', error.message)
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve dashboard metrics',
      code: 'ANALYTICS_ERROR'
    })
  }
})

/**
 * @swagger
 * /api/analytics/sales-report:
 *   get:
 *     summary: Get detailed sales report
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [daily, weekly, monthly]
 *           default: daily
 *         description: Report time period
 *       - in: query
 *         name: days
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 365
 *           default: 30
 *         description: Number of days to include
 *     responses:
 *       200:
 *         description: Sales report generated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     report:
 *                       type: object
 *                       properties:
 *                         period:
 *                           type: string
 *                         totalRevenue:
 *                           type: number
 *                         totalOrders:
 *                           type: integer
 *                         averageOrderValue:
 *                           type: number
 *                         data:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               date:
 *                                 type: string
 *                               revenue:
 *                                 type: number
 *                               orders:
 *                                 type: integer
 *                               averageOrderValue:
 *                                 type: number
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get('/sales-report', authenticateToken, async (req, res) => {
  try {
    const { period = 'daily', days = 30 } = req.query
    console.log(`[Analytics] Sales report request: ${period} for ${days} days`)

    // Get orders for the specified period (respecting Order Service limit of 100)
    const ordersResponse = await axios.get(`${ORDER_SERVICE_URL}/orders?limit=100&sortBy=created_at&sortOrder=desc`, {
      headers: { Authorization: req.headers.authorization }
    })

    const allOrders = ordersResponse.data.data.orders
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - parseInt(days))

    // Filter orders within the date range
    const filteredOrders = allOrders.filter(order => 
      new Date(order.created_at) >= cutoffDate
    )

    // Generate report data
    const reportData = generateSalesReportData(filteredOrders, period, parseInt(days))

    console.log(`[Analytics] Sales report generated for ${reportData.data.length} data points`)
    res.json({
      success: true,
      data: {
        report: reportData
      }
    })

  } catch (error) {
    console.error('[Analytics] Sales report error:', error.message)
    res.status(500).json({
      success: false,
      error: 'Failed to generate sales report',
      code: 'SALES_REPORT_ERROR'
    })
  }
})

/**
 * @swagger
 * /api/analytics/customer-insights:
 *   get:
 *     summary: Get customer analytics and insights
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Customer insights retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     insights:
 *                       type: object
 *                       properties:
 *                         totalCustomers:
 *                           type: integer
 *                         activeCustomers:
 *                           type: integer
 *                         newCustomers30d:
 *                           type: integer
 *                         averageCustomerValue:
 *                           type: number
 *                         customerRetentionRate:
 *                           type: number
 *                     topCustomers:
 *                       type: array
 *                       description: Top customers by revenue
 *                     customerSegmentation:
 *                       type: object
 *                       description: Customer segments by order value
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get('/customer-insights', authenticateToken, async (req, res) => {
  try {
    console.log('[Analytics] Customer insights request')

    // Get customer statistics
    const customerStatsResponse = await axios.get(`${CUSTOMER_SERVICE_URL}/customers/stats`, {
      headers: { Authorization: req.headers.authorization }
    })

    // Get all customers for analysis (respecting service limits)
    const customersResponse = await axios.get(`${CUSTOMER_SERVICE_URL}/customers?limit=100`, {
      headers: { Authorization: req.headers.authorization }
    })

    // Get all orders for customer analysis (respecting Order Service limit of 100)
    const ordersResponse = await axios.get(`${ORDER_SERVICE_URL}/orders?limit=100`, {
      headers: { Authorization: req.headers.authorization }
    })

    const customerStats = customerStatsResponse.data.data.statistics
    const customers = customersResponse.data.data.customers
    const orders = ordersResponse.data.data.orders

    // Calculate customer insights
    const insights = calculateCustomerInsights(customers, orders, customerStats)

    console.log('[Analytics] Customer insights calculated successfully')
    res.json({
      success: true,
      data: insights
    })

  } catch (error) {
    console.error('[Analytics] Customer insights error:', error.message)
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve customer insights',
      code: 'CUSTOMER_INSIGHTS_ERROR'
    })
  }
})

/**
 * @swagger
 * /api/analytics/performance-metrics:
 *   get:
 *     summary: Get business performance metrics
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Performance metrics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     metrics:
 *                       type: object
 *                       properties:
 *                         conversionRate:
 *                           type: number
 *                           description: Order conversion rate percentage
 *                         averageOrderProcessingTime:
 *                           type: number
 *                           description: Average time from draft to delivered (hours)
 *                         orderFulfillmentRate:
 *                           type: number
 *                           description: Percentage of orders successfully delivered
 *                         cancelationRate:
 *                           type: number
 *                           description: Percentage of orders cancelled
 *                         revenuePerCustomer:
 *                           type: number
 *                           description: Average revenue per customer
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get('/performance-metrics', authenticateToken, async (req, res) => {
  try {
    console.log('[Analytics] Performance metrics request')

    // Get order statistics
    const orderStatsResponse = await axios.get(`${ORDER_SERVICE_URL}/orders/stats`, {
      headers: { Authorization: req.headers.authorization }
    })

    // Get customer statistics
    const customerStatsResponse = await axios.get(`${CUSTOMER_SERVICE_URL}/customers/stats`, {
      headers: { Authorization: req.headers.authorization }
    })

    // Get recent orders for performance analysis (respecting Order Service limit of 100)
    const ordersResponse = await axios.get(`${ORDER_SERVICE_URL}/orders?limit=100&sortBy=created_at&sortOrder=desc`, {
      headers: { Authorization: req.headers.authorization }
    })

    const orderStats = orderStatsResponse.data.data.statistics
    const customerStats = customerStatsResponse.data.data.statistics
    const orders = ordersResponse.data.data.orders

    // Calculate performance metrics
    const performanceMetrics = calculatePerformanceMetrics(orderStats, customerStats, orders)

    console.log('[Analytics] Performance metrics calculated successfully')
    res.json({
      success: true,
      data: {
        metrics: performanceMetrics
      }
    })

  } catch (error) {
    console.error('[Analytics] Performance metrics error:', error.message)
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve performance metrics',
      code: 'PERFORMANCE_METRICS_ERROR'
    })
  }
})

// Helper Functions

/**
 * Calculate revenue for last N days
 */
function calculateRevenueLast30Days(orders) {
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  
  return orders
    .filter(order => new Date(order.created_at) >= thirtyDaysAgo)
    .reduce((sum, order) => sum + parseFloat(order.total_amount), 0)
}

function calculateRevenuePrevious30Days(orders) {
  const sixtyDaysAgo = new Date()
  sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60)
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  
  return orders
    .filter(order => {
      const orderDate = new Date(order.created_at)
      return orderDate >= sixtyDaysAgo && orderDate < thirtyDaysAgo
    })
    .reduce((sum, order) => sum + parseFloat(order.total_amount), 0)
}

function calculateRevenueLast7Days(orders) {
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
  
  return orders
    .filter(order => new Date(order.created_at) >= sevenDaysAgo)
    .reduce((sum, order) => sum + parseFloat(order.total_amount), 0)
}

function calculateRevenueLast90Days(orders) {
  const ninetyDaysAgo = new Date()
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)
  
  return orders
    .filter(order => new Date(order.created_at) >= ninetyDaysAgo)
    .reduce((sum, order) => sum + parseFloat(order.total_amount), 0)
}

/**
 * Get top customers by revenue
 */
async function getTopCustomers(authorization, limit = 5) {
  try {
    // This would need to be implemented with proper customer-order aggregation
    // For now, returning mock data structure
    return [
      { customer_id: 'customer1', name: 'Top Customer 1', totalRevenue: 5000, orderCount: 10 },
      { customer_id: 'customer2', name: 'Top Customer 2', totalRevenue: 3500, orderCount: 8 },
      { customer_id: 'customer3', name: 'Top Customer 3', totalRevenue: 2800, orderCount: 6 }
    ].slice(0, limit)
  } catch (error) {
    console.error('[Analytics] Error getting top customers:', error.message)
    return []
  }
}

/**
 * Generate sales report data by period
 */
function generateSalesReportData(orders, period, days) {
  const reportData = []
  const totalRevenue = orders.reduce((sum, order) => sum + parseFloat(order.total_amount), 0)
  const totalOrders = orders.length
  const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0

  // Group orders by period
  const groupedData = groupOrdersByPeriod(orders, period, days)
  
  for (const [dateKey, periodOrders] of Object.entries(groupedData)) {
    const periodRevenue = periodOrders.reduce((sum, order) => sum + parseFloat(order.total_amount), 0)
    const periodOrderCount = periodOrders.length
    const periodAov = periodOrderCount > 0 ? periodRevenue / periodOrderCount : 0

    reportData.push({
      date: dateKey,
      revenue: parseFloat(periodRevenue.toFixed(2)),
      orders: periodOrderCount,
      averageOrderValue: parseFloat(periodAov.toFixed(2))
    })
  }

  return {
    period,
    totalRevenue: parseFloat(totalRevenue.toFixed(2)),
    totalOrders,
    averageOrderValue: parseFloat(averageOrderValue.toFixed(2)),
    data: reportData.sort((a, b) => new Date(a.date) - new Date(b.date))
  }
}

/**
 * Group orders by time period
 */
function groupOrdersByPeriod(orders, period, days) {
  const grouped = {}
  
  orders.forEach(order => {
    const orderDate = new Date(order.created_at)
    let dateKey
    
    switch (period) {
      case 'daily':
        dateKey = orderDate.toISOString().split('T')[0]
        break
      case 'weekly':
        const weekStart = new Date(orderDate)
        weekStart.setDate(orderDate.getDate() - orderDate.getDay())
        dateKey = weekStart.toISOString().split('T')[0]
        break
      case 'monthly':
        dateKey = `${orderDate.getFullYear()}-${String(orderDate.getMonth() + 1).padStart(2, '0')}`
        break
      default:
        dateKey = orderDate.toISOString().split('T')[0]
    }
    
    if (!grouped[dateKey]) {
      grouped[dateKey] = []
    }
    grouped[dateKey].push(order)
  })
  
  return grouped
}

/**
 * Calculate customer insights from customer and order data
 */
function calculateCustomerInsights(customers, orders, customerStats) {
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  
  const newCustomers30d = customers.filter(customer => 
    new Date(customer.created_at) >= thirtyDaysAgo
  ).length

  // Group orders by customer
  const customerOrders = {}
  orders.forEach(order => {
    if (!customerOrders[order.customer_id]) {
      customerOrders[order.customer_id] = []
    }
    customerOrders[order.customer_id].push(order)
  })

  // Calculate customer values
  const customerValues = Object.entries(customerOrders).map(([customerId, customerOrderList]) => {
    const totalValue = customerOrderList.reduce((sum, order) => sum + parseFloat(order.total_amount), 0)
    return { customerId, totalValue, orderCount: customerOrderList.length }
  })

  const totalCustomerValue = customerValues.reduce((sum, cv) => sum + cv.totalValue, 0)
  const averageCustomerValue = customerValues.length > 0 ? totalCustomerValue / customerValues.length : 0

  // Customer segmentation by order value
  const segmentation = {
    high: customerValues.filter(cv => cv.totalValue >= 1000).length,
    medium: customerValues.filter(cv => cv.totalValue >= 500 && cv.totalValue < 1000).length,
    low: customerValues.filter(cv => cv.totalValue < 500).length
  }

  return {
    insights: {
      totalCustomers: customerStats.totalCustomers || customers.length,
      activeCustomers: Object.keys(customerOrders).length,
      newCustomers30d,
      averageCustomerValue: parseFloat(averageCustomerValue.toFixed(2)),
      customerRetentionRate: calculateRetentionRate(customerOrders)
    },
    topCustomers: customerValues
      .sort((a, b) => b.totalValue - a.totalValue)
      .slice(0, 10)
      .map(cv => ({
        customer_id: cv.customerId,
        totalRevenue: cv.totalValue,
        orderCount: cv.orderCount
      })),
    customerSegmentation: segmentation
  }
}

/**
 * Calculate customer retention rate
 */
function calculateRetentionRate(customerOrders) {
  const customersWithMultipleOrders = Object.values(customerOrders)
    .filter(orders => orders.length > 1).length
  
  const totalCustomers = Object.keys(customerOrders).length
  
  return totalCustomers > 0 ? parseFloat(((customersWithMultipleOrders / totalCustomers) * 100).toFixed(2)) : 0
}

/**
 * Calculate performance metrics
 */
function calculatePerformanceMetrics(orderStats, customerStats, orders) {
  const totalOrders = orderStats.totalOrders
  const deliveredOrders = orderStats.deliveredOrders
  const cancelledOrders = orderStats.cancelledOrders
  const totalCustomers = customerStats.totalCustomers || 1

  // Calculate rates
  const conversionRate = totalOrders > 0 ? ((deliveredOrders / totalOrders) * 100) : 0
  const fulfillmentRate = totalOrders > 0 ? ((deliveredOrders / totalOrders) * 100) : 0
  const cancelationRate = totalOrders > 0 ? ((cancelledOrders / totalOrders) * 100) : 0
  const revenuePerCustomer = orderStats.totalRevenue / totalCustomers

  // Calculate average processing time (mock calculation)
  const averageProcessingTime = 48 // hours - would need order status history for real calculation

  return {
    conversionRate: parseFloat(conversionRate.toFixed(2)),
    averageOrderProcessingTime: averageProcessingTime,
    orderFulfillmentRate: parseFloat(fulfillmentRate.toFixed(2)),
    cancelationRate: parseFloat(cancelationRate.toFixed(2)),
    revenuePerCustomer: parseFloat(revenuePerCustomer.toFixed(2))
  }
}

module.exports = router