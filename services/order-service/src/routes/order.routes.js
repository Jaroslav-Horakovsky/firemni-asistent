const express = require('express')
const { orderController } = require('../controllers/order.controller')
const { authenticateToken } = require('../middleware/auth.middleware')

const router = express.Router()

/**
 * @swagger
 * components:
 *   schemas:
 *     Order:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *           description: Unique order identifier
 *         order_number:
 *           type: string
 *           description: Human-readable order number (e.g., ORD-2025-001)
 *         customer_id:
 *           type: string
 *           format: uuid
 *           description: Customer ID who placed the order
 *         status:
 *           type: string
 *           enum: [draft, pending, confirmed, processing, shipped, delivered, cancelled, refunded]
 *           description: Current order status
 *         subtotal:
 *           type: number
 *           format: decimal
 *           description: Subtotal amount before tax and shipping
 *         tax_amount:
 *           type: number
 *           format: decimal
 *           description: Tax amount
 *         shipping_amount:
 *           type: number
 *           format: decimal
 *           description: Shipping cost
 *         total_amount:
 *           type: number
 *           format: decimal
 *           description: Total order amount
 *         currency:
 *           type: string
 *           enum: [CZK, EUR, USD]
 *           default: CZK
 *           description: Order currency
 *         items:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/OrderItem'
 *         shipping_address:
 *           $ref: '#/components/schemas/Address'
 *         billing_address:
 *           $ref: '#/components/schemas/Address'
 *         notes:
 *           type: string
 *           description: Customer notes
 *         created_at:
 *           type: string
 *           format: date-time
 *         updated_at:
 *           type: string
 *           format: date-time
 *     
 *     OrderItem:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         product_name:
 *           type: string
 *           description: Product name
 *         product_description:
 *           type: string
 *           description: Product description
 *         product_sku:
 *           type: string
 *           description: Product SKU/code
 *         quantity:
 *           type: integer
 *           minimum: 1
 *           description: Quantity ordered
 *         unit_price:
 *           type: number
 *           format: decimal
 *           description: Price per unit
 *         total_price:
 *           type: number
 *           format: decimal
 *           description: Total price for this item
 *
 *     Address:
 *       type: object
 *       properties:
 *         line1:
 *           type: string
 *           description: Address line 1
 *         line2:
 *           type: string
 *           description: Address line 2
 *         city:
 *           type: string
 *           description: City
 *         postal_code:
 *           type: string
 *           description: Postal code
 *         country:
 *           type: string
 *           description: Country
 *
 *     OrderInput:
 *       type: object
 *       required:
 *         - customer_id
 *         - items
 *       properties:
 *         customer_id:
 *           type: string
 *           format: uuid
 *           description: Customer ID (must exist in customer-service)
 *         items:
 *           type: array
 *           minItems: 1
 *           items:
 *             type: object
 *             required:
 *               - product_name
 *               - quantity
 *               - unit_price
 *             properties:
 *               product_name:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 255
 *               product_description:
 *                 type: string
 *                 maxLength: 1000
 *               product_sku:
 *                 type: string
 *                 maxLength: 100
 *               quantity:
 *                 type: integer
 *                 minimum: 1
 *               unit_price:
 *                 type: number
 *                 format: decimal
 *                 minimum: 0
 *         currency:
 *           type: string
 *           enum: [CZK, EUR, USD]
 *           default: CZK
 *         shipping_address:
 *           $ref: '#/components/schemas/Address'
 *         billing_address:
 *           $ref: '#/components/schemas/Address'
 *         notes:
 *           type: string
 *           maxLength: 5000
 */

/**
 * @swagger
 * /orders:
 *   get:
 *     summary: Get orders with pagination and filtering
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *       - in: query
 *         name: customer_id
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filter by customer ID
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [draft, pending, confirmed, processing, shipped, delivered, cancelled, refunded]
 *         description: Filter by order status
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *           maxLength: 255
 *         description: Search in order number or notes
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [created_at, updated_at, order_number, status, total_amount]
 *           default: created_at
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *     responses:
 *       200:
 *         description: Orders retrieved successfully
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
 *                     orders:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Order'
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         currentPage:
 *                           type: integer
 *                         totalPages:
 *                           type: integer
 *                         totalRecords:
 *                           type: integer
 *                         hasNextPage:
 *                           type: boolean
 *                         hasPreviousPage:
 *                           type: boolean
 *                         limit:
 *                           type: integer
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get('/', authenticateToken, orderController.getOrders)

/**
 * @swagger
 * /orders/stats:
 *   get:
 *     summary: Get order statistics
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Order statistics retrieved successfully
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
 *                     statistics:
 *                       type: object
 *                       properties:
 *                         totalOrders:
 *                           type: integer
 *                         draftOrders:
 *                           type: integer
 *                         pendingOrders:
 *                           type: integer
 *                         confirmedOrders:
 *                           type: integer
 *                         deliveredOrders:
 *                           type: integer
 *                         cancelledOrders:
 *                           type: integer
 *                         orders30d:
 *                           type: integer
 *                         orders7d:
 *                           type: integer
 *                         totalRevenue:
 *                           type: number
 *                         averageOrderValue:
 *                           type: number
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get('/stats', authenticateToken, orderController.getOrderStats)

/**
 * @swagger
 * /orders:
 *   post:
 *     summary: Create a new order
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/OrderInput'
 *           example:
 *             customer_id: "7d5fc01c-fdd6-4cf1-be9f-da5d573c0878"
 *             items:
 *               - product_name: "Premium Widget"
 *                 product_description: "High-quality widget for professional use"
 *                 quantity: 2
 *                 unit_price: 299.99
 *               - product_name: "Standard Widget"
 *                 quantity: 1
 *                 unit_price: 149.99
 *             shipping_address:
 *               line1: "123 Main Street"
 *               city: "Prague"
 *               postal_code: "10000"
 *               country: "Czech Republic"
 *             notes: "Please deliver before Friday"
 *     responses:
 *       201:
 *         description: Order created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Order created successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     order:
 *                       $ref: '#/components/schemas/Order'
 *       400:
 *         description: Validation error or customer not found
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.post('/', authenticateToken, orderController.createOrder)

/**
 * @swagger
 * /orders/{id}:
 *   get:
 *     summary: Get order by ID
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Order retrieved successfully
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
 *                     order:
 *                       $ref: '#/components/schemas/Order'
 *       400:
 *         description: Invalid order ID
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Order not found
 *       500:
 *         description: Internal server error
 */
router.get('/:id', authenticateToken, orderController.getOrder)

/**
 * @swagger
 * /orders/{id}/status:
 *   put:
 *     summary: Update order status
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [draft, pending, confirmed, processing, shipped, delivered, cancelled, refunded]
 *               reason:
 *                 type: string
 *                 maxLength: 500
 *                 description: Reason for status change
 *           example:
 *             status: "confirmed"
 *             reason: "Payment received and validated"
 *     responses:
 *       200:
 *         description: Order status updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Order status updated successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     order:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                         order_number:
 *                           type: string
 *                         status:
 *                           type: string
 *                         updated_at:
 *                           type: string
 *                           format: date-time
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Order not found
 *       500:
 *         description: Internal server error
 */
router.put('/:id/status', authenticateToken, orderController.updateOrderStatus)

/**
 * @swagger
 * /orders/{id}:
 *   delete:
 *     summary: Cancel/delete order
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Order cancelled successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Order cancelled successfully
 *       400:
 *         description: Invalid order ID
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Order not found
 *       500:
 *         description: Internal server error
 */
router.delete('/:id', authenticateToken, orderController.deleteOrder)

/**
 * @swagger
 * /orders/{id}/history:
 *   get:
 *     summary: Get order status history
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Order ID
 *     responses:
 *       200:
 *         description: Order history retrieved successfully
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
 *                     order_id:
 *                       type: string
 *                       format: uuid
 *                     history:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                           previous_status:
 *                             type: string
 *                           new_status:
 *                             type: string
 *                           changed_by:
 *                             type: string
 *                           change_reason:
 *                             type: string
 *                           notes:
 *                             type: string
 *                           created_at:
 *                             type: string
 *                             format: date-time
 *       400:
 *         description: Invalid order ID
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Order not found
 *       500:
 *         description: Internal server error
 */
router.get('/:id/history', authenticateToken, orderController.getOrderHistory)

/**
 * @swagger
 * /orders/{id}/next-statuses:
 *   get:
 *     summary: Get next valid statuses for order
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Order ID
 *     responses:
 *       200:
 *         description: Next statuses retrieved successfully
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
 *                     order_id:
 *                       type: string
 *                       format: uuid
 *                     current_status:
 *                       type: string
 *                       example: confirmed
 *                     next_statuses:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           status:
 *                             type: string
 *                           label:
 *                             type: string
 *                           color:
 *                             type: string
 *                           description:
 *                             type: string
 *                           rules:
 *                             type: object
 *                             properties:
 *                               requiresPayment:
 *                                 type: boolean
 *                               requiresInventory:
 *                                 type: boolean
 *                               requiresShipping:
 *                                 type: boolean
 *                               description:
 *                                 type: string
 *       400:
 *         description: Invalid order ID
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Order not found
 *       500:
 *         description: Internal server error
 */
router.get('/:id/next-statuses', authenticateToken, orderController.getOrderNextStatuses)

/**
 * @swagger
 * /orders/customer/{customerId}:
 *   get:
 *     summary: Get orders for a specific customer
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: customerId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Customer ID
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [draft, pending, confirmed, processing, shipped, delivered, cancelled, refunded]
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [created_at, updated_at, order_number, status, total_amount]
 *           default: created_at
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *     responses:
 *       200:
 *         description: Customer orders retrieved successfully
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
 *                     customer_id:
 *                       type: string
 *                       format: uuid
 *                     orders:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                           order_number:
 *                             type: string
 *                           status:
 *                             type: string
 *                           total_amount:
 *                             type: number
 *                           currency:
 *                             type: string
 *                           created_at:
 *                             type: string
 *                             format: date-time
 *                           updated_at:
 *                             type: string
 *                             format: date-time
 *                     pagination:
 *                       type: object
 *       400:
 *         description: Invalid customer ID
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get('/customer/:customerId', authenticateToken, orderController.getCustomerOrders)

module.exports = router