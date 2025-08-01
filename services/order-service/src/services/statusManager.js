const { OrderModel } = require('../models/order.model')

/**
 * Order Status Manager - Business rules for status transitions
 * RELACE 17: Advanced Order Workflows
 */
class StatusManager {
  /**
   * Get valid status transitions
   * @returns {Object} Valid transitions map
   */
  static getValidTransitions() {
    return {
      'draft': ['pending', 'cancelled'],
      'pending': ['confirmed', 'cancelled'],
      'confirmed': ['processing', 'cancelled'],
      'processing': ['shipped', 'cancelled'],
      'shipped': ['delivered', 'cancelled'],
      'delivered': ['refunded'],
      'cancelled': [], // Terminal state
      'refunded': []   // Terminal state
    }
  }

  /**
   * Validate status transition
   * @param {string} currentStatus - Current order status
   * @param {string} newStatus - New status to transition to
   * @returns {Object} Validation result
   */
  static validateTransition(currentStatus, newStatus) {
    const validTransitions = this.getValidTransitions()
    
    if (!validTransitions[currentStatus]) {
      return {
        isValid: false,
        error: `Invalid current status: ${currentStatus}`
      }
    }

    if (!validTransitions[currentStatus].includes(newStatus)) {
      return {
        isValid: false,
        error: `Cannot transition from ${currentStatus} to ${newStatus}. Valid transitions: ${validTransitions[currentStatus].join(', ')}`
      }
    }

    return { isValid: true }
  }

  /**
   * Get business rules for status transitions
   * @param {string} currentStatus - Current status
   * @param {string} newStatus - New status
   * @returns {Object} Business rules
   */
  static getTransitionRules(currentStatus, newStatus) {
    const rules = {
      'draft->pending': {
        requiresPayment: false,
        requiresInventory: false,
        requiresShipping: false,
        description: 'Order submitted for review'
      },
      'pending->confirmed': {
        requiresPayment: true,
        requiresInventory: true,
        requiresShipping: false,
        description: 'Order confirmed and payment received'
      },
      'confirmed->processing': {
        requiresPayment: true,
        requiresInventory: true,
        requiresShipping: false,
        description: 'Order being prepared for shipment'
      },
      'processing->shipped': {
        requiresPayment: true,
        requiresInventory: true,
        requiresShipping: true,
        description: 'Order shipped to customer'
      },
      'shipped->delivered': {
        requiresPayment: true,
        requiresInventory: true,
        requiresShipping: true,
        description: 'Order delivered to customer'
      },
      'delivered->refunded': {
        requiresPayment: false,
        requiresInventory: false,
        requiresShipping: false,
        description: 'Order refunded to customer'
      }
    }

    const key = `${currentStatus}->${newStatus}`
    return rules[key] || {
      requiresPayment: false,
      requiresInventory: false,
      requiresShipping: false,
      description: `Status changed to ${newStatus}`
    }
  }

  /**
   * Get status transition metadata
   * @param {string} status - Status to get metadata for
   * @returns {Object} Status metadata
   */
  static getStatusMetadata(status) {
    const metadata = {
      'draft': {
        label: 'Draft',
        color: '#6c757d',
        icon: 'edit',
        description: 'Order is being prepared',
        customerVisible: false,
        canEdit: true,
        canCancel: true
      },
      'pending': {
        label: 'Pending',
        color: '#ffc107',
        icon: 'clock',
        description: 'Order awaiting confirmation',
        customerVisible: true,
        canEdit: false,
        canCancel: true
      },
      'confirmed': {
        label: 'Confirmed',
        color: '#17a2b8',
        icon: 'check-circle',
        description: 'Order confirmed and payment received',
        customerVisible: true,
        canEdit: false,
        canCancel: true
      },
      'processing': {
        label: 'Processing',
        color: '#007bff',
        icon: 'cog',
        description: 'Order being prepared for shipment',
        customerVisible: true,
        canEdit: false,
        canCancel: true
      },
      'shipped': {
        label: 'Shipped',
        color: '#fd7e14',
        icon: 'truck',
        description: 'Order has been shipped',
        customerVisible: true,
        canEdit: false,
        canCancel: false
      },
      'delivered': {
        label: 'Delivered',
        color: '#28a745',
        icon: 'check',
        description: 'Order has been delivered',
        customerVisible: true,
        canEdit: false,
        canCancel: false
      },
      'cancelled': {
        label: 'Cancelled',
        color: '#dc3545',
        icon: 'times-circle',
        description: 'Order has been cancelled',
        customerVisible: true,
        canEdit: false,
        canCancel: false
      },
      'refunded': {
        label: 'Refunded',
        color: '#6f42c1',
        icon: 'undo',
        description: 'Order has been refunded',
        customerVisible: true,
        canEdit: false,
        canCancel: false
      }
    }

    return metadata[status] || {
      label: 'Unknown',
      color: '#6c757d',
      icon: 'question',
      description: 'Unknown status',
      customerVisible: false,
      canEdit: false,
      canCancel: false
    }
  }

  /**
   * Get next available statuses for current status
   * @param {string} currentStatus - Current status
   * @returns {Array} Array of next possible statuses with metadata
   */
  static getNextStatuses(currentStatus) {
    const validTransitions = this.getValidTransitions()
    const nextStatuses = validTransitions[currentStatus] || []
    
    return nextStatuses.map(status => ({
      status,
      ...this.getStatusMetadata(status),
      rules: this.getTransitionRules(currentStatus, status)
    }))
  }

  /**
   * Validate business rules for status transition
   * @param {Object} order - Order object
   * @param {string} newStatus - New status
   * @param {Object} context - Additional context (payment, inventory, etc.)
   * @returns {Object} Validation result
   */
  static validateBusinessRules(order, newStatus, context = {}) {
    const rules = this.getTransitionRules(order.status, newStatus)
    const errors = []

    // Check payment requirement
    if (rules.requiresPayment && !context.paymentConfirmed) {
      errors.push('Payment confirmation required for this status change')
    }

    // Check inventory requirement
    if (rules.requiresInventory && !context.inventoryReserved) {
      errors.push('Inventory must be reserved before proceeding')
    }

    // Check shipping requirement
    if (rules.requiresShipping && !context.shippingArranged) {
      errors.push('Shipping must be arranged before marking as shipped')
    }

    // Additional business validations
    if (newStatus === 'confirmed' && order.total_amount <= 0) {
      errors.push('Cannot confirm order with zero total amount')
    }

    if (newStatus === 'shipped' && !context.trackingNumber) {
      errors.push('Tracking number required when marking order as shipped')
    }

    return {
      isValid: errors.length === 0,
      errors,
      rules
    }
  }

  /**
   * Generate automated status change reason
   * @param {string} currentStatus - Current status
   * @param {string} newStatus - New status
   * @param {Object} context - Additional context
   * @returns {string} Generated reason
   */
  static generateAutomatedReason(currentStatus, newStatus, context = {}) {
    const rules = this.getTransitionRules(currentStatus, newStatus)
    let reason = rules.description

    // Add context-specific information
    if (context.paymentId) {
      reason += ` (Payment ID: ${context.paymentId})`
    }
    
    if (context.trackingNumber) {
      reason += ` (Tracking: ${context.trackingNumber})`
    }

    if (context.automatedBy) {
      reason += ` - Automated by ${context.automatedBy}`
    }

    return reason
  }
}

module.exports = {
  StatusManager
}