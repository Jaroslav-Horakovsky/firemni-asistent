const { database } = require('../utils/database')
const { OrderModel } = require('../models/order.model')
const { StatusManager } = require('./statusManager')

class OrderService {
  constructor() {
    this.db = database
  }

  /**
   * Create a new order with items
   * @param {Object} orderData - Order data
   * @param {string} createdBy - User ID who created the order
   * @returns {Promise<Object>} Created order with items
   */
  async createOrder(orderData, createdBy) {
    console.log('[OrderService] RELACE 15 DEBUG: Starting order creation')
    console.log('[OrderService] Order data:', JSON.stringify(orderData, null, 2))
    console.log('[OrderService] Created by:', createdBy)
    
    const client = await this.db.getClient()
    
    try {
      await client.query('BEGIN')
      console.log('[OrderService] Creating new order for customer:', orderData.customer_id)
      
      // 1. Generate order number
      console.log('[OrderService] RELACE 15 DEBUG: Generating order number')
      const orderNumber = await this.generateOrderNumber(client)
      console.log('[OrderService] RELACE 15 DEBUG: Order number generated:', orderNumber)
      
      // 2. Calculate totals
      console.log('[OrderService] RELACE 15 DEBUG: Calculating totals')
      const { subtotal, tax_amount, shipping_amount, total_amount } = this.calculateOrderTotals(orderData.items || [])
      console.log('[OrderService] RELACE 15 DEBUG: Totals calculated:', { subtotal, tax_amount, shipping_amount, total_amount })
      
      // 3. Create order
      console.log('[OrderService] RELACE 13 FIX: Using CORRECT column names!')
      const orderResult = await client.query(`
        INSERT INTO orders (
          order_number, customer_id, status, subtotal, tax_amount, 
          shipping_amount, discount_amount, total_amount, currency, 
          shipping_address_line1, shipping_address_line2, shipping_city, 
          shipping_postal_code, shipping_country,
          billing_address_line1, billing_address_line2, billing_city,
          billing_postal_code, billing_country,
          notes, created_by
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21
        ) RETURNING *
      `, [
        orderNumber,
        orderData.customer_id,
        'draft',
        subtotal,
        tax_amount,
        shipping_amount,
        orderData.discount_amount || 0,
        total_amount,
        orderData.currency || 'CZK',
        orderData.shipping_address?.line1 || null,
        orderData.shipping_address?.line2 || null,
        orderData.shipping_address?.city || null,
        orderData.shipping_address?.postal_code || null,
        orderData.shipping_address?.country || 'Czech Republic',
        orderData.billing_address?.line1 || orderData.shipping_address?.line1 || null,
        orderData.billing_address?.line2 || orderData.shipping_address?.line2 || null,
        orderData.billing_address?.city || orderData.shipping_address?.city || null,
        orderData.billing_address?.postal_code || orderData.shipping_address?.postal_code || null,
        orderData.billing_address?.country || orderData.shipping_address?.country || 'Czech Republic',
        orderData.notes || null,
        createdBy
      ])
      
      const order = orderResult.rows[0]
      
      // 4. Create order items
      const items = []
      if (orderData.items && orderData.items.length > 0) {
        for (const item of orderData.items) {
          const totalPrice = item.quantity * item.unit_price
          
          const itemResult = await client.query(`
            INSERT INTO order_items (
              order_id, product_name, product_description, product_sku,
              quantity, unit_price, total_price
            ) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *
          `, [
            order.id,
            item.product_name,
            item.product_description || null,
            item.product_sku || null,
            item.quantity,
            item.unit_price,
            totalPrice
          ])
          
          items.push(itemResult.rows[0])
        }
      }
      
      // 5. Create status history entry
      await client.query(`
        INSERT INTO order_status_history (order_id, previous_status, new_status, changed_by, change_reason)
        VALUES ($1, $2, $3, $4, $5)
      `, [order.id, null, 'draft', createdBy, 'Order created'])
      
      await client.query('COMMIT')
      
      console.log('[OrderService] Order created successfully:', orderNumber)
      return { ...order, items }
    } catch (error) {
      await client.query('ROLLBACK')
      console.error('[OrderService] Error creating order:', error.message)
      console.error('[OrderService] Full error:', error)
      console.error('[OrderService] Error stack:', error.stack)
      throw error
    } finally {
      client.release()
    }
  }

  /**
   * Get order by ID with items
   * @param {string} orderId - Order ID
   * @returns {Promise<Object|null>} Order with items or null if not found
   */
  async getOrderById(orderId) {
    try {
      console.log('[OrderService] Fetching order by ID:', orderId)

      // Get order details
      const orderQuery = 'SELECT * FROM orders WHERE id = $1'
      const orderResult = await this.db.query(orderQuery, [orderId])

      if (orderResult.rows.length === 0) {
        console.log('[OrderService] Order not found:', orderId)
        return null
      }

      const order = orderResult.rows[0]

      // Get order items
      const itemsQuery = 'SELECT * FROM order_items WHERE order_id = $1 ORDER BY created_at'
      const itemsResult = await this.db.query(itemsQuery, [orderId])

      console.log('[OrderService] Order found:', order.order_number)
      return { ...order, items: itemsResult.rows }
    } catch (error) {
      console.error('[OrderService] Error fetching order by ID:', error.message)
      throw error
    }
  }

  /**
   * Get orders with pagination and filtering
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Paginated orders result
   */
  async getOrders(options = {}) {
    try {
      const {
        page = 1,
        limit = 20,
        customer_id = null,
        status = null,
        search = '',
        sortBy = 'created_at',
        sortOrder = 'desc'
      } = options

      console.log('[OrderService] Fetching orders with options:', options)

      const offset = (page - 1) * limit

      // Build WHERE clause
      const whereConditions = []
      const queryParams = []
      let paramIndex = 1

      // Customer filter
      if (customer_id) {
        whereConditions.push(`customer_id = $${paramIndex}`)
        queryParams.push(customer_id)
        paramIndex++
      }

      // Status filter
      if (status) {
        whereConditions.push(`status = $${paramIndex}`)
        queryParams.push(status)
        paramIndex++
      }

      // Search filter (order number, notes)
      if (search) {
        whereConditions.push(`(order_number ILIKE $${paramIndex} OR notes ILIKE $${paramIndex})`)
        queryParams.push(`%${search}%`)
        paramIndex++
      }

      const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : ''

      // Build ORDER BY clause
      const validSortFields = {
        'created_at': 'created_at',
        'updated_at': 'updated_at',
        'order_number': 'order_number',
        'status': 'status',
        'total_amount': 'total_amount'
      }
      const dbSortField = validSortFields[sortBy] || 'created_at'
      const orderClause = `ORDER BY ${dbSortField} ${sortOrder.toUpperCase()}`

      // Count total records
      const countQuery = `SELECT COUNT(*) FROM orders ${whereClause}`
      const countResult = await this.db.query(countQuery, queryParams.slice(0, paramIndex - 1))
      const totalRecords = parseInt(countResult.rows[0].count)

      // Fetch paginated results
      const dataQuery = `
        SELECT * FROM orders 
        ${whereClause}
        ${orderClause}
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `
      queryParams.push(limit, offset)

      const result = await this.db.query(dataQuery, queryParams)
      const orders = result.rows

      const totalPages = Math.ceil(totalRecords / limit)

      console.log(`[OrderService] Found ${orders.length} orders (page ${page}/${totalPages})`)

      return {
        orders,
        pagination: {
          currentPage: page,
          totalPages,
          totalRecords,
          hasNextPage: page < totalPages,
          hasPreviousPage: page > 1,
          limit
        }
      }
    } catch (error) {
      console.error('[OrderService] Error fetching orders:', error.message)
      throw error
    }
  }

  /**
   * Update order status with validation
   * @param {string} orderId - Order ID
   * @param {string} newStatus - New status
   * @param {string} changedBy - User ID who changed the status
   * @param {string} reason - Reason for status change
   * @param {Object} context - Additional context for validation
   * @returns {Promise<Object|null>} Updated order or null if not found
   */
  async updateOrderStatus(orderId, newStatus, changedBy, reason = null, context = {}) {
    const client = await this.db.getClient()

    try {
      await client.query('BEGIN')
      console.log('[OrderService] Updating order status:', orderId, '->', newStatus)

      // Get current order
      const currentResult = await client.query('SELECT * FROM orders WHERE id = $1', [orderId])
      if (currentResult.rows.length === 0) {
        await client.query('ROLLBACK')
        return null
      }

      const currentOrder = currentResult.rows[0]
      const oldStatus = currentOrder.status

      // Validate status transition
      const transitionValidation = StatusManager.validateTransition(oldStatus, newStatus)
      if (!transitionValidation.isValid) {
        await client.query('ROLLBACK')
        throw new Error(`Invalid status transition: ${transitionValidation.error}`)
      }

      // Validate business rules
      const businessValidation = StatusManager.validateBusinessRules(currentOrder, newStatus, context)
      if (!businessValidation.isValid) {
        await client.query('ROLLBACK')
        throw new Error(`Business rule validation failed: ${businessValidation.errors.join(', ')}`)
      }

      // Update order status
      const updateResult = await client.query(`
        UPDATE orders 
        SET status = $1, updated_at = NOW()
        WHERE id = $2
        RETURNING *
      `, [newStatus, orderId])

      const updatedOrder = updateResult.rows[0]

      // Generate reason if not provided
      const changeReason = reason || StatusManager.generateAutomatedReason(oldStatus, newStatus, context)

      // Create status history entry
      await client.query(`
        INSERT INTO order_status_history (order_id, previous_status, new_status, changed_by, change_reason)
        VALUES ($1, $2, $3, $4, $5)
      `, [orderId, oldStatus, newStatus, changedBy, changeReason])

      await client.query('COMMIT')

      console.log('[OrderService] Order status updated successfully:', orderId)
      
      // Phase 4: Send email notification for status change (after successful commit)
      try {
        await this.sendStatusChangeNotification(updatedOrder, oldStatus, newStatus, changeReason, context)
      } catch (emailError) {
        console.error('[OrderService] Email notification failed (non-blocking):', emailError.message)
        // Don't fail the status update if email fails - it's already committed
      }

      return updatedOrder
    } catch (error) {
      await client.query('ROLLBACK')
      console.error('[OrderService] Error updating order status:', error.message)
      throw error
    } finally {
      client.release()
    }
  }

  /**
   * Delete order (soft delete by setting status to cancelled)
   * @param {string} orderId - Order ID
   * @param {string} deletedBy - User ID who deleted the order
   * @returns {Promise<boolean>} True if deleted, false if not found
   */
  async deleteOrder(orderId, deletedBy) {
    try {
      console.log('[OrderService] Soft deleting order:', orderId)

      const updatedOrder = await this.updateOrderStatus(orderId, 'cancelled', deletedBy, 'Order cancelled/deleted')
      
      return !!updatedOrder
    } catch (error) {
      console.error('[OrderService] Error deleting order:', error.message)
      throw error
    }
  }

  /**
   * Generate unique order number
   * @param {Object} client - Database client
   * @returns {Promise<string>} Generated order number
   */
  async generateOrderNumber(client = null) {
    try {
      const dbClient = client || this.db
      const year = new Date().getFullYear()
      
      const result = await dbClient.query(`
        SELECT COUNT(*) + 1 as next_number
        FROM orders 
        WHERE EXTRACT(YEAR FROM created_at) = $1
      `, [year])
      
      const nextNumber = result.rows[0].next_number
      const orderNumber = `ORD-${year}-${String(nextNumber).padStart(3, '0')}`
      
      console.log('[OrderService] Generated order number:', orderNumber)
      return orderNumber
    } catch (error) {
      console.error('[OrderService] Error generating order number:', error.message)
      throw error
    }
  }

  /**
   * Calculate order totals
   * @param {Array} items - Order items
   * @returns {Object} Calculated totals
   */
  calculateOrderTotals(items) {
    const subtotal = items.reduce((sum, item) => {
      return sum + (item.quantity * item.unit_price)
    }, 0)

    // TODO: Implement proper tax calculation based on customer location/tax rules
    const tax_amount = 0

    // TODO: Implement proper shipping calculation based on location/weight/etc
    const shipping_amount = 0

    const total_amount = subtotal + tax_amount + shipping_amount

    return {
      subtotal: parseFloat(subtotal.toFixed(2)),
      tax_amount: parseFloat(tax_amount.toFixed(2)),
      shipping_amount: parseFloat(shipping_amount.toFixed(2)),
      total_amount: parseFloat(total_amount.toFixed(2))
    }
  }

  /**
   * Get order statistics
   * @returns {Promise<Object>} Order statistics
   */
  async getOrderStats() {
    try {
      console.log('[OrderService] Fetching order statistics')

      const statsQuery = `
        SELECT 
          COUNT(*) as total_orders,
          COUNT(*) FILTER (WHERE status = 'draft') as draft_orders,
          COUNT(*) FILTER (WHERE status = 'pending') as pending_orders,
          COUNT(*) FILTER (WHERE status = 'confirmed') as confirmed_orders,
          COUNT(*) FILTER (WHERE status = 'processing') as processing_orders,
          COUNT(*) FILTER (WHERE status = 'shipped') as shipped_orders,
          COUNT(*) FILTER (WHERE status = 'delivered') as delivered_orders,
          COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled_orders,
          COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE - INTERVAL '30 days') as orders_30d,
          COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE - INTERVAL '7 days') as orders_7d,
          COALESCE(SUM(total_amount), 0) as total_revenue,
          COALESCE(AVG(total_amount), 0) as average_order_value
        FROM orders
      `

      const result = await this.db.query(statsQuery)
      const stats = result.rows[0]

      console.log('[OrderService] Order statistics retrieved')
      return {
        totalOrders: parseInt(stats.total_orders),
        draftOrders: parseInt(stats.draft_orders),
        pendingOrders: parseInt(stats.pending_orders),
        confirmedOrders: parseInt(stats.confirmed_orders),
        processingOrders: parseInt(stats.processing_orders),
        shippedOrders: parseInt(stats.shipped_orders),
        deliveredOrders: parseInt(stats.delivered_orders),
        cancelledOrders: parseInt(stats.cancelled_orders),
        orders30d: parseInt(stats.orders_30d),
        orders7d: parseInt(stats.orders_7d),
        totalRevenue: parseFloat(stats.total_revenue),
        averageOrderValue: parseFloat(stats.average_order_value)
      }
    } catch (error) {
      console.error('[OrderService] Error fetching order statistics:', error.message)
      throw error
    }
  }

  /**
   * Get order status history
   * @param {string} orderId - Order ID
   * @returns {Promise<Array|null>} Status history or null if order not found
   */
  async getOrderHistory(orderId) {
    try {
      console.log('[OrderService] Fetching order history:', orderId)

      // First check if order exists
      const orderCheck = await this.db.query('SELECT id FROM orders WHERE id = $1', [orderId])
      if (orderCheck.rows.length === 0) {
        console.log('[OrderService] Order not found for history:', orderId)
        return null
      }

      // Get status history
      const historyQuery = `
        SELECT 
          id, order_id, previous_status, new_status, 
          changed_by, change_reason, notes, created_at
        FROM order_status_history 
        WHERE order_id = $1 
        ORDER BY created_at ASC
      `

      const result = await this.db.query(historyQuery, [orderId])
      console.log(`[OrderService] Found ${result.rows.length} history entries for order:`, orderId)
      
      return result.rows
    } catch (error) {
      console.error('[OrderService] Error fetching order history:', error.message)
      throw error
    }
  }

  /**
   * Get next valid statuses for an order
   * @param {string} orderId - Order ID
   * @returns {Promise<Object|null>} Next statuses info or null if order not found
   */
  async getNextValidStatuses(orderId) {
    try {
      console.log('[OrderService] Getting next valid statuses for order:', orderId)

      // Get current order status
      const orderResult = await this.db.query('SELECT id, status FROM orders WHERE id = $1', [orderId])
      if (orderResult.rows.length === 0) {
        console.log('[OrderService] Order not found for status check:', orderId)
        return null
      }

      const currentOrder = orderResult.rows[0]
      const currentStatus = currentOrder.status

      // Get next possible statuses
      const nextStatuses = StatusManager.getNextStatuses(currentStatus)

      console.log(`[OrderService] Found ${nextStatuses.length} next statuses for order ${orderId} (current: ${currentStatus})`)
      
      return {
        currentStatus,
        nextStatuses
      }
    } catch (error) {
      console.error('[OrderService] Error getting next valid statuses:', error.message)
      throw error
    }
  }

  /**
   * Send status change notification email
   * @param {Object} order - Updated order object
   * @param {string} oldStatus - Previous status
   * @param {string} newStatus - New status
   * @param {string} changeReason - Reason for change
   * @param {Object} context - Additional context
   * @returns {Promise<void>}
   */
  async sendStatusChangeNotification(order, oldStatus, newStatus, changeReason, context = {}) {
    try {
      console.log(`[OrderService] Sending status change notification: ${order.order_number} ${oldStatus} → ${newStatus}`)

      // Only send notifications for customer-visible status changes
      const statusMetadata = StatusManager.getStatusMetadata(newStatus)
      if (!statusMetadata.customerVisible) {
        console.log('[OrderService] Skipping notification - status not customer visible:', newStatus)
        return
      }

      // Get customer information via Customer Service API
      const CUSTOMER_SERVICE_URL = process.env.CUSTOMER_SERVICE_URL || 'http://localhost:3002'
      
      const customerResponse = await fetch(`${CUSTOMER_SERVICE_URL}/customers/${order.customer_id}`, {
        method: 'GET',
        headers: { 
          'User-Agent': 'OrderService/1.0.0',
          'Accept': 'application/json'
        },
        signal: AbortSignal.timeout(5000)
      })
      
      if (!customerResponse.ok) {
        throw new Error(`Customer service responded with ${customerResponse.status}`)
      }
      
      const customerData = await customerResponse.json()

      if (!customerData.success || !customerData.data) {
        console.error('[OrderService] Customer not found for email notification:', order.customer_id)
        return
      }

      const customer = customerData.data
      const customerName = `${customer.first_name || ''} ${customer.last_name || ''}`.trim()

      // Prepare notification data
      const notificationData = {
        order_id: order.id,
        order_number: order.order_number,
        old_status: oldStatus,
        new_status: newStatus,
        customer_email: customer.email,
        customer_name: customerName || null,
        reason: changeReason,
        automated: context.automated || false,
        webhook_triggered: context.webhookSource === 'stripe' || false
      }

      // Call API Gateway notification endpoint
      const API_GATEWAY_URL = process.env.API_GATEWAY_URL || 'http://localhost:3000'
      
      const response = await fetch(`${API_GATEWAY_URL}/api/notifications/status-change`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'OrderService/1.0.0',
          'Accept': 'application/json'
        },
        body: JSON.stringify(notificationData),
        signal: AbortSignal.timeout(5000)
      })

      if (!response.ok) {
        throw new Error(`API Gateway responded with ${response.status}`)
      }

      const responseData = await response.json()
      
      if (responseData.success) {
        console.log(`[OrderService] Status change email sent successfully for order ${order.order_number}. MessageID: ${responseData.data.message_id}`)
      } else {
        console.error('[OrderService] Email notification API returned failure:', responseData)
      }

    } catch (error) {
      console.error('[OrderService] Failed to send status change notification:', error.message)
      // Re-throw to be caught by the calling code
      throw error
    }
  }
}

// Create singleton instance
const orderService = new OrderService()

module.exports = {
  OrderService,
  orderService
}