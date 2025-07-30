const { orderService } = require('../services/order.service')
const { CustomerService } = require('../services/customer.service')
const { OrderModel } = require('../models/order.model')

class OrderController {
  /**
   * Create a new order
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async createOrder(req, res) {
    try {
      console.log('[OrderController] Create order request:', req.body?.customer_id)

      // Validate request data
      const { error, value } = OrderModel.validateCreate(req.body)
      if (error) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details: error.details.map(detail => ({
            field: detail.path.join('.'),
            message: detail.message
          }))
        })
      }

      // Validate customer exists via customer-service API
      console.log('[OrderController] Validating customer:', value.customer_id)
      const customerExists = await CustomerService.validateCustomer(
        value.customer_id, 
        req.headers.authorization
      )
      
      if (!customerExists) {
        return res.status(400).json({
          success: false,
          error: 'Customer not found or invalid',
          code: 'CUSTOMER_NOT_FOUND'
        })
      }

      // Create order with items
      const order = await orderService.createOrder(value, req.user.userId)

      res.status(201).json({
        success: true,
        message: 'Order created successfully',
        data: {
          order: {
            id: order.id,
            order_number: order.order_number,
            customer_id: order.customer_id,
            status: order.status,
            subtotal: parseFloat(order.subtotal),
            tax_amount: parseFloat(order.tax_amount),
            shipping_amount: parseFloat(order.shipping_amount),
            total_amount: parseFloat(order.total_amount),
            currency: order.currency,
            items: order.items?.map(item => ({
              id: item.id,
              product_name: item.product_name,
              product_description: item.product_description,
              product_sku: item.product_sku,
              quantity: item.quantity,
              unit_price: parseFloat(item.unit_price),
              total_price: parseFloat(item.total_price)
            })) || [],
            notes: order.notes,
            created_at: order.created_at,
            updated_at: order.updated_at
          }
        }
      })
    } catch (error) {
      console.error('[OrderController] Create order error:', error.message)
      
      if (error.message.includes('Unauthorized')) {
        return res.status(401).json({
          success: false,
          error: 'Unauthorized: Invalid token',
          code: 'UNAUTHORIZED'
        })
      }

      res.status(500).json({
        success: false,
        error: 'Failed to create order',
        code: 'INTERNAL_SERVER_ERROR'
      })
    }
  }

  /**
   * Get order by ID
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async getOrder(req, res) {
    try {
      console.log('[OrderController] Get order request:', req.params.id)

      // Validate order ID
      const { error } = OrderModel.validateId(req.params.id)
      if (error) {
        return res.status(400).json({
          success: false,
          error: 'Invalid order ID',
          code: 'VALIDATION_ERROR'
        })
      }

      const order = await orderService.getOrderById(req.params.id)

      if (!order) {
        return res.status(404).json({
          success: false,
          error: 'Order not found',
          code: 'ORDER_NOT_FOUND'
        })
      }

      res.json({
        success: true,
        data: {
          order: {
            id: order.id,
            order_number: order.order_number,
            customer_id: order.customer_id,
            status: order.status,
            subtotal: parseFloat(order.subtotal),
            tax_amount: parseFloat(order.tax_amount),
            shipping_amount: parseFloat(order.shipping_amount),
            total_amount: parseFloat(order.total_amount),
            currency: order.currency,
            shipping_address: {
              line1: order.shipping_address_line1,
              line2: order.shipping_address_line2,
              city: order.shipping_address_city,
              postal_code: order.shipping_address_postal_code,
              country: order.shipping_address_country
            },
            billing_address: {
              line1: order.billing_address_line1,
              line2: order.billing_address_line2,
              city: order.billing_address_city,
              postal_code: order.billing_address_postal_code,
              country: order.billing_address_country
            },
            items: order.items?.map(item => ({
              id: item.id,
              product_name: item.product_name,
              product_description: item.product_description,
              product_sku: item.product_sku,
              quantity: item.quantity,
              unit_price: parseFloat(item.unit_price),
              total_price: parseFloat(item.total_price)
            })) || [],
            notes: order.notes,
            created_at: order.created_at,
            updated_at: order.updated_at
          }
        }
      })
    } catch (error) {
      console.error('[OrderController] Get order error:', error.message)
      
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve order',
        code: 'INTERNAL_SERVER_ERROR'
      })
    }
  }

  /**
   * Get orders with pagination and filtering
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async getOrders(req, res) {
    try {
      console.log('[OrderController] Get orders request:', req.query)

      // Validate query parameters
      const { error, value } = OrderModel.validateQuery(req.query)
      if (error) {
        return res.status(400).json({
          success: false,
          error: 'Invalid query parameters',
          code: 'VALIDATION_ERROR',
          details: error.details.map(detail => ({
            field: detail.path.join('.'),
            message: detail.message
          }))
        })
      }

      const result = await orderService.getOrders(value)

      res.json({
        success: true,
        data: {
          orders: result.orders.map(order => ({
            id: order.id,
            order_number: order.order_number,
            customer_id: order.customer_id,
            status: order.status,
            subtotal: parseFloat(order.subtotal),
            tax_amount: parseFloat(order.tax_amount),
            shipping_amount: parseFloat(order.shipping_amount),
            total_amount: parseFloat(order.total_amount),
            currency: order.currency,
            notes: order.notes,
            created_at: order.created_at,
            updated_at: order.updated_at
          })),
          pagination: result.pagination
        }
      })
    } catch (error) {
      console.error('[OrderController] Get orders error:', error.message)
      
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve orders',
        code: 'INTERNAL_SERVER_ERROR'
      })
    }
  }

  /**
   * Update order status
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async updateOrderStatus(req, res) {
    try {
      console.log('[OrderController] Update order status request:', req.params.id, req.body.status)

      // Validate order ID
      const { error: idError } = OrderModel.validateId(req.params.id)
      if (idError) {
        return res.status(400).json({
          success: false,
          error: 'Invalid order ID',
          code: 'VALIDATION_ERROR'
        })
      }

      // Validate status update data
      const { error, value } = OrderModel.validateStatusUpdate(req.body)
      if (error) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details: error.details.map(detail => ({
            field: detail.path.join('.'),
            message: detail.message
          }))
        })
      }

      const updatedOrder = await orderService.updateOrderStatus(
        req.params.id,
        value.status,
        req.user.userId,
        value.reason
      )

      if (!updatedOrder) {
        return res.status(404).json({
          success: false,
          error: 'Order not found',
          code: 'ORDER_NOT_FOUND'
        })
      }

      res.json({
        success: true,
        message: 'Order status updated successfully',
        data: {
          order: {
            id: updatedOrder.id,
            order_number: updatedOrder.order_number,
            status: updatedOrder.status,
            updated_at: updatedOrder.updated_at
          }
        }
      })
    } catch (error) {
      console.error('[OrderController] Update order status error:', error.message)
      
      res.status(500).json({
        success: false,
        error: 'Failed to update order status',
        code: 'INTERNAL_SERVER_ERROR'
      })
    }
  }

  /**
   * Delete order (cancel order)
   * @param {Object} req - Express request object  
   * @param {Object} res - Express response object
   */
  async deleteOrder(req, res) {
    try {
      console.log('[OrderController] Delete order request:', req.params.id)

      // Validate order ID
      const { error } = OrderModel.validateId(req.params.id)
      if (error) {
        return res.status(400).json({
          success: false,
          error: 'Invalid order ID',
          code: 'VALIDATION_ERROR'
        })
      }

      const deleted = await orderService.deleteOrder(req.params.id, req.user.userId)

      if (!deleted) {
        return res.status(404).json({
          success: false,
          error: 'Order not found',
          code: 'ORDER_NOT_FOUND'
        })
      }

      res.json({
        success: true,
        message: 'Order cancelled successfully'
      })
    } catch (error) {
      console.error('[OrderController] Delete order error:', error.message)
      
      res.status(500).json({
        success: false,
        error: 'Failed to cancel order',
        code: 'INTERNAL_SERVER_ERROR'
      })
    }
  }

  /**
   * Get orders for a specific customer
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async getCustomerOrders(req, res) {
    try {
      console.log('[OrderController] Get customer orders request:', req.params.customerId)

      // Validate customer ID
      const { error: idError } = OrderModel.validateId(req.params.customerId)
      if (idError) {
        return res.status(400).json({
          success: false,
          error: 'Invalid customer ID',
          code: 'VALIDATION_ERROR'
        })
      }

      // Validate query parameters
      const { error, value } = OrderModel.validateQuery(req.query)
      if (error) {
        return res.status(400).json({
          success: false,
          error: 'Invalid query parameters',
          code: 'VALIDATION_ERROR',
          details: error.details.map(detail => ({
            field: detail.path.join('.'),
            message: detail.message
          }))
        })
      }

      // Add customer_id filter
      const queryOptions = { ...value, customer_id: req.params.customerId }
      const result = await orderService.getOrders(queryOptions)

      res.json({
        success: true,
        data: {
          customer_id: req.params.customerId,
          orders: result.orders.map(order => ({
            id: order.id,
            order_number: order.order_number,
            status: order.status,
            total_amount: parseFloat(order.total_amount),
            currency: order.currency,
            created_at: order.created_at,
            updated_at: order.updated_at
          })),
          pagination: result.pagination
        }
      })
    } catch (error) {
      console.error('[OrderController] Get customer orders error:', error.message)
      
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve customer orders',
        code: 'INTERNAL_SERVER_ERROR'
      })
    }
  }

  /**
   * Get order statistics
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async getOrderStats(req, res) {
    try {
      console.log('[OrderController] Get order stats request')

      const stats = await orderService.getOrderStats()

      res.json({
        success: true,
        data: {
          statistics: stats
        }
      })
    } catch (error) {
      console.error('[OrderController] Get order stats error:', error.message)
      
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve order statistics',
        code: 'INTERNAL_SERVER_ERROR'
      })
    }
  }
}

// Create singleton instance
const orderController = new OrderController()

module.exports = {
  OrderController,
  orderController
}