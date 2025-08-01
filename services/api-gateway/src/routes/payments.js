const express = require('express');
const Stripe = require('stripe');
const Joi = require('joi');
const { authenticateToken } = require('../middleware');
const router = express.Router();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Validation schemas
const createPaymentIntentSchema = Joi.object({
  amount: Joi.number().integer().min(50).max(99999999).required(), // CZK, min 0.50, max 999,999.99
  currency: Joi.string().valid('czk', 'eur', 'usd').default('czk'),
  order_id: Joi.string().uuid().required(),
  customer_email: Joi.string().email().required(),
  description: Joi.string().max(500).optional()
});

const confirmPaymentSchema = Joi.object({
  payment_intent_id: Joi.string().required(),
  payment_method_id: Joi.string().optional()
});

// Create payment intent
router.post('/create-intent', authenticateToken, async (req, res) => {
  try {
    const { error, value } = createPaymentIntentSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Invalid payment data',
        errors: error.details.map(d => d.message)
      });
    }

    const { amount, currency, order_id, customer_email, description } = value;

    console.log(`[Payment] Creating payment intent for order ${order_id}: ${amount} ${currency.toUpperCase()}`);

    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount, // amount in smallest currency unit (haléře for CZK)
      currency: currency,
      payment_method_types: ['card'],
      metadata: {
        order_id: order_id,
        customer_email: customer_email,
        created_by: req.user.id || 'api-gateway'
      },
      description: description || `Payment for order ${order_id}`
    });

    console.log(`[Payment] Payment intent created: ${paymentIntent.id}`);

    res.json({
      success: true,
      message: 'Payment intent created successfully',
      data: {
        payment_intent_id: paymentIntent.id,
        client_secret: paymentIntent.client_secret,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
        status: paymentIntent.status,
        order_id: order_id
      }
    });

  } catch (error) {
    console.error('[Payment Error]', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create payment intent',
      error: error.message
    });
  }
});

// Confirm payment
router.post('/confirm', authenticateToken, async (req, res) => {
  try {
    const { error, value } = confirmPaymentSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Invalid confirmation data',
        errors: error.details.map(d => d.message)
      });
    }

    const { payment_intent_id, payment_method_id } = value;

    console.log(`[Payment] Confirming payment intent: ${payment_intent_id}`);

    const paymentIntent = await stripe.paymentIntents.confirm(payment_intent_id, {
      payment_method: payment_method_id,
      return_url: 'http://localhost:3000/payment/success' // Adjust as needed
    });

    console.log(`[Payment] Payment confirmed: ${paymentIntent.status}`);

    res.json({
      success: true,
      message: 'Payment confirmation processed',
      data: {
        payment_intent_id: paymentIntent.id,
        status: paymentIntent.status,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
        order_id: paymentIntent.metadata.order_id
      }
    });

  } catch (error) {
    console.error('[Payment Confirmation Error]', error);
    res.status(500).json({
      success: false,
      message: 'Failed to confirm payment',
      error: error.message
    });
  }
});

// Get payment status
router.get('/:payment_intent_id/status', authenticateToken, async (req, res) => {
  try {
    const { payment_intent_id } = req.params;

    console.log(`[Payment] Checking status for: ${payment_intent_id}`);

    const paymentIntent = await stripe.paymentIntents.retrieve(payment_intent_id);

    res.json({
      success: true,
      data: {
        payment_intent_id: paymentIntent.id,
        status: paymentIntent.status,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
        order_id: paymentIntent.metadata.order_id,
        created: new Date(paymentIntent.created * 1000),
        last_updated: new Date()
      }
    });

  } catch (error) {
    console.error('[Payment Status Error]', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get payment status',
      error: error.message
    });
  }
});

// List payments (for admin)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { limit = 10, starting_after } = req.query;

    console.log(`[Payment] Listing payments (limit: ${limit})`);

    const paymentIntents = await stripe.paymentIntents.list({
      limit: Math.min(limit, 100),
      starting_after: starting_after
    });

    res.json({
      success: true,
      data: paymentIntents.data.map(pi => ({
        payment_intent_id: pi.id,
        status: pi.status,
        amount: pi.amount,
        currency: pi.currency,
        order_id: pi.metadata.order_id,
        customer_email: pi.metadata.customer_email,
        created: new Date(pi.created * 1000)
      })),
      has_more: paymentIntents.has_more
    });

  } catch (error) {
    console.error('[Payment List Error]', error);
    res.status(500).json({
      success: false,
      message: 'Failed to list payments',
      error: error.message
    });
  }
});

module.exports = router;