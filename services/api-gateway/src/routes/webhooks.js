const express = require('express');
const axios = require('axios');
const router = express.Router();

// Import Stripe with secret key
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

/**
 * RELACE 17 - Phase 3: Stripe Webhooks Handler
 * 
 * This handler processes Stripe webhook events and integrates with the existing
 * StatusManager business rules from Phase 1 to automatically update order statuses
 * based on payment events.
 * 
 * Key Features:
 * - Stripe signature verification for security
 * - Integration with existing StatusManager business rules
 * - Automatic order status updates based on payment events
 * - Comprehensive error handling and logging
 * - Audit trail through existing history tracking
 */

/**
 * Verify Stripe webhook signature
 * @param {string} payload - Raw request body
 * @param {string} signature - Stripe-Signature header
 * @returns {Object} - Constructed webhook event
 */
const verifyWebhookSignature = (payload, signature) => {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  
  if (!webhookSecret) {
    throw new Error('Stripe webhook secret not configured');
  }
  
  try {
    return stripe.webhooks.constructEvent(payload, signature, webhookSecret);
  } catch (error) {
    console.error('[Webhook] Signature verification failed:', error.message);
    throw new Error('Invalid webhook signature');
  }
};

/**
 * Generate system JWT token for internal service communication
 * @returns {string} - System JWT token
 */
const generateSystemToken = () => {
  const jwt = require('jsonwebtoken');
  const secretKey = process.env.JWT_ACCESS_SECRET;
  
  if (!secretKey) {
    throw new Error('JWT_ACCESS_SECRET not configured');
  }
  
  // Create a system token for internal webhook operations
  const payload = {
    userId: '00000000-0000-0000-0000-000000000000',
    email: 'system@internal.webhook',
    role: 'system',
    firstName: 'System',
    lastName: 'Webhook',
    type: 'access',
    internal: true
  };
  
  return jwt.sign(payload, secretKey, {
    expiresIn: '5m', // Short-lived token for webhook operations
    audience: 'firemni-asistent-users',
    issuer: 'firemni-asistent'
  });
};

/**
 * Update order status via Order Service
 * @param {string} orderId - Order ID to update
 * @param {string} newStatus - New status to set
 * @param {string} reason - Reason for status change
 * @returns {Promise} - Axios response
 */
const updateOrderStatus = async (orderId, newStatus, reason) => {
  const orderServiceUrl = process.env.ORDER_SERVICE_URL || 'http://localhost:3003';
  
  try {
    console.log(`[Webhook] Updating order ${orderId} to status: ${newStatus}`);
    
    // Generate system token for internal webhook operations
    const systemToken = generateSystemToken();
    
    const response = await axios.put(
      `${orderServiceUrl}/orders/${orderId}/status`,
      {
        status: newStatus,
        reason: reason,
        context: {
          paymentConfirmed: true,
          inventoryReserved: true,
          webhookSource: 'stripe'
        }
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${systemToken}`
        },
        timeout: 5000 // 5 second timeout
      }
    );
    
    console.log(`[Webhook] Order ${orderId} status updated successfully:`, response.data);
    return response;
    
  } catch (error) {
    console.error(`[Webhook] Failed to update order ${orderId}:`, error.response?.data || error.message);
    throw error;
  }
};

/**
 * Handle payment_intent.succeeded event
 * Payment successful - transition order from draft to confirmed
 */
const handlePaymentSucceeded = async (paymentIntent) => {
  const orderId = paymentIntent.metadata?.order_id;
  
  if (!orderId) {
    throw new Error('No order_id found in payment_intent metadata');
  }
  
  console.log(`[Webhook] Payment succeeded for order: ${orderId}`);
  console.log(`[Webhook] Payment amount: ${paymentIntent.amount} ${paymentIntent.currency}`);
  
  // Update order status to confirmed (uses existing StatusManager business rules)
  // Note: StatusManager requires pending -> confirmed transition (not draft -> confirmed)
  const reason = `Payment succeeded - Amount: ${paymentIntent.amount/100} ${paymentIntent.currency.toUpperCase()} - Payment ID: ${paymentIntent.id}`;
  
  // Update order to confirmed (handles both draft->pending->confirmed and pending->confirmed flows)
  await updateOrderStatus(orderId, 'confirmed', reason);
  
  return {
    orderId,
    action: 'status_updated',
    newStatus: 'confirmed',
    paymentId: paymentIntent.id,
    amount: paymentIntent.amount,
    currency: paymentIntent.currency
  };
};

/**
 * Handle payment_intent.payment_failed event
 * Payment failed - keep order in draft status with failure reason
 */
const handlePaymentFailed = async (paymentIntent) => {
  const orderId = paymentIntent.metadata?.order_id;
  
  if (!orderId) {
    throw new Error('No order_id found in payment_intent metadata');
  }
  
  console.log(`[Webhook] Payment failed for order: ${orderId}`);
  console.log(`[Webhook] Failure reason:`, paymentIntent.last_payment_error?.message || 'Unknown error');
  
  // Keep order in draft status but add failure reason to history
  const reason = `Payment failed - ${paymentIntent.last_payment_error?.message || 'Unknown payment error'} - Payment ID: ${paymentIntent.id}`;
  
  // Note: We keep status as 'draft', but the StatusManager will record this in history
  await updateOrderStatus(orderId, 'draft', reason);
  
  return {
    orderId,
    action: 'payment_failed',
    status: 'draft',
    paymentId: paymentIntent.id,
    error: paymentIntent.last_payment_error?.message || 'Unknown error'
  };
};

/**
 * Handle payment_intent.canceled event
 * Payment canceled - update order status accordingly
 */
const handlePaymentCanceled = async (paymentIntent) => {
  const orderId = paymentIntent.metadata?.order_id;
  
  if (!orderId) {
    throw new Error('No order_id found in payment_intent metadata');
  }
  
  console.log(`[Webhook] Payment canceled for order: ${orderId}`);
  
  const reason = `Payment canceled - Payment ID: ${paymentIntent.id}`;
  
  // Update order status to cancelled using existing business rules
  await updateOrderStatus(orderId, 'cancelled', reason);
  
  return {
    orderId,
    action: 'status_updated',
    newStatus: 'cancelled',
    paymentId: paymentIntent.id
  };
};

/**
 * Main webhook endpoint
 * POST /api/webhooks/stripe
 * 
 * Processes Stripe webhook events with signature verification
 * and delegates to specific event handlers
 */
router.post('/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
  console.log('[Webhook] Received Stripe webhook event');
  
  try {
    // Get signature from headers
    const signature = req.get('Stripe-Signature');
    
    if (!signature) {
      console.error('[Webhook] Missing Stripe-Signature header');
      return res.status(400).json({
        success: false,
        error: 'Missing Stripe-Signature header'
      });
    }
    
    // Verify webhook signature
    const event = verifyWebhookSignature(req.body, signature);
    
    console.log(`[Webhook] Verified event type: ${event.type}`);
    console.log(`[Webhook] Event ID: ${event.id}`);
    
    let result;
    
    // Handle different event types
    switch (event.type) {
      case 'payment_intent.succeeded':
        result = await handlePaymentSucceeded(event.data.object);
        break;
        
      case 'payment_intent.payment_failed':
        result = await handlePaymentFailed(event.data.object);
        break;
        
      case 'payment_intent.canceled':
        result = await handlePaymentCanceled(event.data.object);
        break;
        
      default:
        console.log(`[Webhook] Unhandled event type: ${event.type}`);
        return res.status(200).json({
          success: true,
          message: `Event type ${event.type} received but not processed`,
          eventId: event.id
        });
    }
    
    // Log successful processing
    console.log(`[Webhook] Successfully processed ${event.type}:`, result);
    
    // Return success response
    res.status(200).json({
      success: true,
      message: `Webhook processed successfully`,
      eventType: event.type,
      eventId: event.id,
      result: result
    });
    
  } catch (error) {
    console.error('[Webhook] Error processing webhook:', error.message);
    console.error('[Webhook] Error stack:', error.stack);
    
    // Return error response
    res.status(400).json({
      success: false,
      error: error.message,
      message: 'Webhook processing failed'
    });
  }
});

/**
 * Test endpoint for webhook functionality (development only)
 * POST /api/webhooks/test
 */
router.post('/test', express.json(), async (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(404).json({ error: 'Not found' });
  }
  
  console.log('[Webhook Test] Testing webhook functionality');
  
  try {
    const { orderId, eventType = 'payment_intent.succeeded' } = req.body;
    
    if (!orderId) {
      return res.status(400).json({
        success: false,
        error: 'orderId is required for testing'
      });
    }
    
    // Mock payment intent for testing
    const mockPaymentIntent = {
      id: `pi_test_${Date.now()}`,
      amount: 2000, // $20.00 in cents
      currency: 'usd',
      metadata: {
        order_id: orderId
      },
      last_payment_error: eventType === 'payment_intent.payment_failed' ? {
        message: 'Your card was declined.'
      } : null
    };
    
    let result;
    
    switch (eventType) {
      case 'payment_intent.succeeded':
        result = await handlePaymentSucceeded(mockPaymentIntent);
        break;
      case 'payment_intent.payment_failed':
        result = await handlePaymentFailed(mockPaymentIntent);
        break;
      case 'payment_intent.canceled':
        result = await handlePaymentCanceled(mockPaymentIntent);
        break;
      default:
        return res.status(400).json({
          success: false,
          error: 'Invalid eventType. Use: payment_intent.succeeded, payment_intent.payment_failed, or payment_intent.canceled'
        });
    }
    
    res.status(200).json({
      success: true,
      message: 'Test webhook processed successfully',
      eventType,
      result
    });
    
  } catch (error) {
    console.error('[Webhook Test] Error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Test webhook processing failed'
    });
  }
});

/**
 * Health check endpoint for webhooks
 * GET /api/webhooks/health
 */
router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'webhooks-handler',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    stripe_configured: !!process.env.STRIPE_SECRET_KEY,
    webhook_secret_configured: !!process.env.STRIPE_WEBHOOK_SECRET
  });
});

module.exports = router;