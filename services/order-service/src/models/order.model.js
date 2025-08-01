const Joi = require('joi')

/**
 * Order Model - Complete order data structure with validation for RELACE 12B
 */
class Order {
  constructor(data = {}) {
    this.id = data.id
    this.order_number = data.order_number
    this.customer_id = data.customer_id
    this.status = data.status || 'draft'
    
    // Financial data
    this.subtotal = data.subtotal || 0
    this.tax_amount = data.tax_amount || 0
    this.shipping_amount = data.shipping_amount || 0
    this.discount_amount = data.discount_amount || 0
    this.total_amount = data.total_amount || 0
    this.currency = data.currency || 'CZK'
    
    // Shipping information
    this.shipping_address_line1 = data.shipping_address_line1
    this.shipping_address_line2 = data.shipping_address_line2
    this.shipping_city = data.shipping_city
    this.shipping_postal_code = data.shipping_postal_code
    this.shipping_country = data.shipping_country || 'Czech Republic'
    
    // Billing information
    this.billing_address_line1 = data.billing_address_line1
    this.billing_address_line2 = data.billing_address_line2
    this.billing_city = data.billing_city
    this.billing_postal_code = data.billing_postal_code
    this.billing_country = data.billing_country || 'Czech Republic'
    
    // Metadata
    this.notes = data.notes
    this.internal_notes = data.internal_notes
    this.expected_delivery_date = data.expected_delivery_date
    
    // Audit fields
    this.created_by = data.created_by
    this.created_at = data.created_at
    this.updated_at = data.updated_at
    
    // Order items (will be added in RELACE 12B)
    this.items = data.items || []
  }

  /**
   * Validate order data
   * @returns {Object} Validation result
   */
  validate() {
    const errors = []

    // Required fields validation
    if (!this.customer_id) {
      errors.push('Customer ID is required')
    }

    if (!this.total_amount || this.total_amount < 0) {
      errors.push('Total amount must be greater than or equal to 0')
    }

    if (this.subtotal < 0) {
      errors.push('Subtotal must be greater than or equal to 0')
    }

    // Currency validation
    const validCurrencies = ['CZK', 'EUR', 'USD']
    if (this.currency && !validCurrencies.includes(this.currency)) {
      errors.push('Currency must be one of: CZK, EUR, USD')
    }

    // Status validation
    const validStatuses = [
      'draft', 'pending', 'confirmed', 'processing', 
      'shipped', 'delivered', 'cancelled', 'refunded'
    ]
    if (this.status && !validStatuses.includes(this.status)) {
      errors.push('Invalid order status')
    }

    return {
      isValid: errors.length === 0,
      errors
    }
  }

  /**
   * Convert order to JSON representation
   * @returns {Object} Order as plain object
   */
  toJSON() {
    return {
      id: this.id,
      order_number: this.order_number,
      customer_id: this.customer_id,
      status: this.status,
      
      // Financial data
      subtotal: this.subtotal,
      tax_amount: this.tax_amount,
      shipping_amount: this.shipping_amount,
      discount_amount: this.discount_amount,
      total_amount: this.total_amount,
      currency: this.currency,
      
      // Shipping information
      shipping_address: {
        line1: this.shipping_address_line1,
        line2: this.shipping_address_line2,
        city: this.shipping_city,
        postal_code: this.shipping_postal_code,
        country: this.shipping_country
      },
      
      // Billing information
      billing_address: {
        line1: this.billing_address_line1,
        line2: this.billing_address_line2,
        city: this.billing_city,
        postal_code: this.billing_postal_code,
        country: this.billing_country
      },
      
      // Metadata
      notes: this.notes,
      internal_notes: this.internal_notes,
      expected_delivery_date: this.expected_delivery_date,
      
      // Audit fields
      created_by: this.created_by,
      created_at: this.created_at,
      updated_at: this.updated_at,
      
      // Items
      items: this.items
    }
  }

  /**
   * Create Order instance from database row
   * @param {Object} row - Database row
   * @returns {Order} Order instance
   */
  static fromDatabaseRow(row) {
    return new Order(row)
  }

  /**
   * Get order status color for UI
   * @returns {string} Color code
   */
  getStatusColor() {
    const statusColors = {
      draft: '#6c757d',      // Gray
      pending: '#ffc107',    // Yellow
      confirmed: '#17a2b8',  // Info blue
      processing: '#007bff', // Primary blue
      shipped: '#fd7e14',    // Orange
      delivered: '#28a745',  // Green
      cancelled: '#dc3545',  // Red
      refunded: '#6f42c1'    // Purple
    }
    
    return statusColors[this.status] || '#6c757d'
  }

  /**
   * Get human-readable status
   * @returns {string} Human-readable status
   */
  getStatusLabel() {
    const statusLabels = {
      draft: 'Draft',
      pending: 'Pending',
      confirmed: 'Confirmed',
      processing: 'Processing',
      shipped: 'Shipped',
      delivered: 'Delivered',
      cancelled: 'Cancelled',
      refunded: 'Refunded'
    }
    
    return statusLabels[this.status] || 'Unknown'
  }

  /**
   * Validate order creation data
   * @param {Object} data - Order data to validate
   * @returns {Object} Joi validation result
   */
  static validateCreate(data) {
    const schema = Joi.object({
      customer_id: Joi.string().uuid().required()
        .messages({
          'string.uuid': 'Customer ID must be a valid UUID',
          'any.required': 'Customer ID is required'
        }),
      
      items: Joi.array().items(
        Joi.object({
          product_name: Joi.string().min(1).max(255).required()
            .messages({
              'string.min': 'Product name cannot be empty',
              'string.max': 'Product name cannot exceed 255 characters',
              'any.required': 'Product name is required'
            }),
          product_description: Joi.string().max(1000).optional().allow(null, ''),
          product_sku: Joi.string().max(100).optional().allow(null, ''),
          quantity: Joi.number().integer().min(1).required()
            .messages({
              'number.min': 'Quantity must be at least 1',
              'any.required': 'Quantity is required'
            }),
          unit_price: Joi.number().min(0).precision(2).required()
            .messages({
              'number.min': 'Unit price must be greater than or equal to 0',
              'any.required': 'Unit price is required'
            })
        })
      ).min(1).required()
        .messages({
          'array.min': 'At least one item is required',
          'any.required': 'Items are required'
        }),

      currency: Joi.string().valid('CZK', 'EUR', 'USD').default('CZK'),

      shipping_address: Joi.object({
        line1: Joi.string().max(255).optional().allow(null, ''),
        line2: Joi.string().max(255).optional().allow(null, ''),
        city: Joi.string().max(100).optional().allow(null, ''),
        postal_code: Joi.string().max(20).optional().allow(null, ''),
        country: Joi.string().max(100).default('Czech Republic')
      }).optional(),

      billing_address: Joi.object({
        line1: Joi.string().max(255).optional().allow(null, ''),
        line2: Joi.string().max(255).optional().allow(null, ''),
        city: Joi.string().max(100).optional().allow(null, ''),
        postal_code: Joi.string().max(20).optional().allow(null, ''),
        country: Joi.string().max(100).default('Czech Republic')
      }).optional(),

      notes: Joi.string().max(5000).optional().allow(null, '')
    })

    return schema.validate(data, { abortEarly: false })
  }

  /**
   * Validate order ID
   * @param {string} id - Order ID to validate
   * @returns {Object} Joi validation result
   */
  static validateId(id) {
    const schema = Joi.string().uuid().required()
      .messages({
        'string.uuid': 'Order ID must be a valid UUID',
        'any.required': 'Order ID is required'
      })

    return schema.validate(id)
  }

  /**
   * Validate query parameters for order listing
   * @param {Object} query - Query parameters to validate
   * @returns {Object} Joi validation result
   */
  static validateQuery(query) {
    const schema = Joi.object({
      page: Joi.number().integer().min(1).default(1),
      limit: Joi.number().integer().min(1).max(100).default(20),
      customer_id: Joi.string().uuid().optional(),
      status: Joi.string().valid(
        'draft', 'pending', 'confirmed', 'processing', 
        'shipped', 'delivered', 'cancelled', 'refunded'
      ).optional(),
      search: Joi.string().max(255).optional().allow(''),
      sortBy: Joi.string().valid(
        'created_at', 'updated_at', 'order_number', 'status', 'total_amount'
      ).default('created_at'),
      sortOrder: Joi.string().valid('asc', 'desc').default('desc')
    })

    return schema.validate(query, { abortEarly: false })
  }

  /**
   * Validate order status update data
   * @param {Object} data - Status update data to validate
   * @returns {Object} Joi validation result
   */
  static validateStatusUpdate(data) {
    const schema = Joi.object({
      status: Joi.string().valid(
        'draft', 'pending', 'confirmed', 'processing', 
        'shipped', 'delivered', 'cancelled', 'refunded'
      ).required()
        .messages({
          'any.only': 'Status must be one of: draft, pending, confirmed, processing, shipped, delivered, cancelled, refunded',
          'any.required': 'Status is required'
        }),
      reason: Joi.string().max(500).optional().allow(null, ''),
      context: Joi.object({
        paymentConfirmed: Joi.boolean().optional(),
        inventoryReserved: Joi.boolean().optional(),
        shippingArranged: Joi.boolean().optional(),
        trackingNumber: Joi.string().optional(),
        webhookSource: Joi.string().optional()
      }).optional()
    })

    return schema.validate(data, { abortEarly: false })
  }
}

// Create OrderModel alias for consistency with customer-service
const OrderModel = Order

module.exports = {
  Order,
  OrderModel
}