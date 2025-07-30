const { database } = require('../utils/database')
const { OrderModel } = require('../models/order.model')

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
    const client = await this.db.getClient()
    
    try {
      await client.query('BEGIN')
      console.log('[OrderService] Creating new order for customer:', orderData.customer_id)
      
      // 1. Generate order number
      const orderNumber = await this.generateOrderNumber(client)
      
      // 2. Calculate totals
      const { subtotal, tax_amount, shipping_amount, total_amount } = this.calculateOrderTotals(orderData.items || [])
      
      // 3. Create order
      const orderResult = await client.query(`
        INSERT INTO orders (
          order_number, customer_id, status, subtotal, tax_amount, 
          shipping_amount, total_amount, currency, 
          shipping_address_line1, shipping_address_line2, shipping_address_city, 
          shipping_address_postal_code, shipping_address_country,
          billing_address_line1, billing_address_line2, billing_address_city,
          billing_address_postal_code, billing_address_country,
          notes, created_by
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20
        ) RETURNING *
      `, [
        orderNumber,
        orderData.customer_id,
        'draft',
        subtotal,
        tax_amount,
        shipping_amount,
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
        INSERT INTO order_status_history (order_id, old_status, new_status, changed_by, change_reason)
        VALUES ($1, $2, $3, $4, $5)
      `, [order.id, null, 'draft', createdBy, 'Order created'])
      
      await client.query('COMMIT')
      
      console.log('[OrderService] Order created successfully:', orderNumber)
      return { ...order, items }
    } catch (error) {
      await client.query('ROLLBACK')
      console.error('[OrderService] Error creating order:', error.message)
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
   * Update order status
   * @param {string} orderId - Order ID
   * @param {string} newStatus - New status
   * @param {string} changedBy - User ID who changed the status
   * @param {string} reason - Reason for status change
   * @returns {Promise<Object|null>} Updated order or null if not found
   */
  async updateOrderStatus(orderId, newStatus, changedBy, reason = null) {
    const client = await this.db.getClient()

    try {
      await client.query('BEGIN')
      console.log('[OrderService] Updating order status:', orderId, '->', newStatus)

      // Get current order status
      const currentResult = await client.query('SELECT id, status FROM orders WHERE id = $1', [orderId])
      if (currentResult.rows.length === 0) {
        await client.query('ROLLBACK')
        return null
      }

      const currentOrder = currentResult.rows[0]
      const oldStatus = currentOrder.status

      // Update order status
      const updateResult = await client.query(`
        UPDATE orders 
        SET status = $1, updated_at = NOW()
        WHERE id = $2
        RETURNING *
      `, [newStatus, orderId])

      const updatedOrder = updateResult.rows[0]

      // Create status history entry
      await client.query(`
        INSERT INTO order_status_history (order_id, old_status, new_status, changed_by, change_reason)
        VALUES ($1, $2, $3, $4, $5)
      `, [orderId, oldStatus, newStatus, changedBy, reason || `Status changed to ${newStatus}`])

      await client.query('COMMIT')

      console.log('[OrderService] Order status updated successfully:', orderId)
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
}

// Create singleton instance
const orderService = new OrderService()

module.exports = {
  OrderService,
  orderService
}