const express = require('express');
const sgMail = require('@sendgrid/mail');
const Joi = require('joi');
const { authenticateToken } = require('../middleware');
const router = express.Router();

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// Validation schemas
const sendEmailSchema = Joi.object({
  to: Joi.string().email().required(),
  subject: Joi.string().min(1).max(200).required(),
  text: Joi.string().min(1).max(10000).optional(),
  html: Joi.string().min(1).max(50000).optional(),
  from: Joi.string().email().default('noreply@firemnipomocnik.com'),
  order_id: Joi.string().uuid().optional(),
  template_type: Joi.string().valid('order_confirmation', 'payment_confirmation', 'general').optional()
}).custom((value, helpers) => {
  if (!value.text && !value.html) {
    return helpers.error('custom.missingContent');
  }
  return value;
}, 'Text or HTML content validation').messages({
  'custom.missingContent': 'Either text or html content is required'
});

const orderConfirmationSchema = Joi.object({
  customer_email: Joi.string().email().required(),
  order_id: Joi.string().uuid().required(),
  order_number: Joi.string().required(),
  total_amount: Joi.number().positive().required(),
  currency: Joi.string().valid('CZK', 'EUR', 'USD').default('CZK'),
  items: Joi.array().items(Joi.object({
    product_name: Joi.string().required(),
    quantity: Joi.number().integer().positive().required(),
    unit_price: Joi.number().positive().required(),
    total_price: Joi.number().positive().required()
  })).min(1).required(),
  customer_name: Joi.string().optional()
});

// Send general email
router.post('/send', authenticateToken, async (req, res) => {
  try {
    const { error, value } = sendEmailSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email data',
        errors: error.details.map(d => d.message)
      });
    }

    const { to, subject, text, html, from, order_id, template_type } = value;

    console.log(`[Email] Sending ${template_type || 'general'} email to: ${to}`);

    const msg = {
      to: to,
      from: from,
      subject: subject,
      text: text,
      html: html,
      // Add tracking
      trackingSettings: {
        clickTracking: { enable: true },
        openTracking: { enable: true }
      },
      // Add metadata
      customArgs: {
        order_id: order_id || '',
        template_type: template_type || 'general',
        sent_by: 'api-gateway',
        sent_at: new Date().toISOString()
      }
    };

    const result = await sgMail.send(msg);
    console.log(`[Email] Email sent successfully. MessageID: ${result[0].headers['x-message-id']}`);

    res.json({
      success: true,
      message: 'Email sent successfully',
      data: {
        message_id: result[0].headers['x-message-id'],
        to: to,
        subject: subject,
        template_type: template_type,
        sent_at: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('[Email Error]', error);
    
    // Handle SendGrid specific errors
    if (error.response) {
      return res.status(400).json({
        success: false,
        message: 'Email delivery failed',
        error: error.response.body.errors || error.message
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to send email',
      error: error.message
    });
  }
});

// Send order confirmation email
router.post('/order-confirmation', authenticateToken, async (req, res) => {
  try {
    const { error, value } = orderConfirmationSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Invalid order confirmation data',
        errors: error.details.map(d => d.message)
      });
    }

    const { customer_email, order_id, order_number, total_amount, currency, items, customer_name } = value;

    console.log(`[Email] Sending order confirmation for: ${order_number}`);

    // Generate items list for email
    const itemsList = items.map(item => 
      `• ${item.product_name} - ${item.quantity}x ${item.unit_price} ${currency} = ${item.total_price} ${currency}`
    ).join('\n');

    const subject = `Potvrzení objednávky ${order_number} - Firemní Asistent`;
    
    const textContent = `
Vážený zákazníku${customer_name ? ` ${customer_name}` : ''},

děkujeme za Vaši objednávku!

DETAILY OBJEDNÁVKY:
Číslo objednávky: ${order_number}
ID objednávky: ${order_id}
Celková částka: ${total_amount} ${currency}

POLOŽKY:
${itemsList}

Vaše objednávka byla úspěšně přijata a bude zpracována v nejkratším možném čase.

S pozdravem,
Tým Firemní Asistent
    `.trim();

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Potvrzení objednávky</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
    <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #2c5aa0;">Potvrzení objednávky ${order_number}</h2>
        
        <p>Vážený zákazníku${customer_name ? ` <strong>${customer_name}</strong>` : ''},</p>
        
        <p>děkujeme za Vaši objednávku!</p>
        
        <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #2c5aa0;">Detaily objednávky:</h3>
            <p><strong>Číslo objednávky:</strong> ${order_number}</p>
            <p><strong>ID objednávky:</strong> ${order_id}</p>
            <p><strong>Celková částka:</strong> <span style="font-size: 1.2em; color: #28a745;"><strong>${total_amount} ${currency}</strong></span></p>
        </div>
        
        <h3 style="color: #2c5aa0;">Objednané položky:</h3>
        <ul style="list-style-type: none; padding: 0;">
            ${items.map(item => `
                <li style="background-color: #f8f9fa; margin: 5px 0; padding: 10px; border-radius: 3px;">
                    <strong>${item.product_name}</strong><br>
                    ${item.quantity}× ${item.unit_price} ${currency} = <strong>${item.total_price} ${currency}</strong>
                </li>
            `).join('')}
        </ul>
        
        <p style="margin-top: 30px;">Vaše objednávka byla úspěšně přijata a bude zpracována v nejkratším možném čase.</p>
        
        <hr style="border: 1px solid #eee; margin: 30px 0;">
        
        <p style="color: #666; font-size: 0.9em;">
            S pozdravem,<br>
            <strong>Tým Firemní Asistent</strong>
        </p>
    </div>
</body>
</html>
    `.trim();

    const msg = {
      to: customer_email,
      from: 'noreply@firemnipomocnik.com',
      subject: subject,
      text: textContent,
      html: htmlContent,
      trackingSettings: {
        clickTracking: { enable: true },
        openTracking: { enable: true }
      },
      customArgs: {
        order_id: order_id,
        order_number: order_number,
        template_type: 'order_confirmation',
        sent_by: 'api-gateway',
        sent_at: new Date().toISOString()
      }
    };

    const result = await sgMail.send(msg);
    console.log(`[Email] Order confirmation sent. MessageID: ${result[0].headers['x-message-id']}`);

    res.json({
      success: true,
      message: 'Order confirmation email sent successfully',
      data: {
        message_id: result[0].headers['x-message-id'],
        order_id: order_id,
        order_number: order_number,
        customer_email: customer_email,
        sent_at: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('[Order Confirmation Email Error]', error);
    
    if (error.response) {
      return res.status(400).json({
        success: false,
        message: 'Order confirmation email delivery failed',
        error: error.response.body.errors || error.message
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to send order confirmation email',
      error: error.message
    });
  }
});

// Get email status (placeholder - SendGrid doesn't provide simple status API)
router.get('/:message_id/status', authenticateToken, (req, res) => {
  const { message_id } = req.params;
  
  // Note: SendGrid doesn't provide a simple status check API
  // You would need to use their Event Webhook or Activity API
  res.json({
    success: true,
    message: 'Email status check not implemented',
    data: {
      message_id: message_id,
      note: 'Use SendGrid Activity API or Event Webhook for detailed status tracking'
    }
  });
});

module.exports = router;