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

// Status change notification endpoint - for StatusManager hooks
router.post('/status-change', async (req, res) => {
  try {
    console.log('[Status Change Notification] Request received:', req.body);

    const statusNotificationSchema = Joi.object({
      order_id: Joi.string().uuid().required(),
      order_number: Joi.string().required(),
      old_status: Joi.string().required(),
      new_status: Joi.string().required(),
      customer_email: Joi.string().email().required(),
      customer_name: Joi.string().optional(),
      reason: Joi.string().optional(),
      automated: Joi.boolean().default(false),
      webhook_triggered: Joi.boolean().default(false)
    });

    const { error, value } = statusNotificationSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status change notification data',
        errors: error.details.map(d => d.message)
      });
    }

    const { order_id, order_number, old_status, new_status, customer_email, customer_name, reason, automated, webhook_triggered } = value;

    // Status change email templates
    const getStatusChangeEmail = (status, orderData) => {
      const templates = {
        confirmed: {
          subject: `Objednávka ${orderData.order_number} byla potvrzena - Firemní Asistent`,
          text: `Vážený zákazníku${orderData.customer_name ? ` ${orderData.customer_name}` : ''},\n\nVaše objednávka ${orderData.order_number} byla úspěšně potvrzena${orderData.webhook_triggered ? ' a platba byla přijata' : ''}.\n\nObjednávka bude nyní zpracována a připravena k odeslání.\n\nS pozdravem,\nTým Firemní Asistent`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <h2 style="color: #28a745;">✅ Objednávka potvrzena</h2>
              <p>Vážený zákazníku${orderData.customer_name ? ` <strong>${orderData.customer_name}</strong>` : ''},</p>
              <p>Vaše objednávka <strong>${orderData.order_number}</strong> byla úspěšně potvrzena${orderData.webhook_triggered ? ' a platba byla přijata' : ''}.</p>
              <div style="background-color: #d4edda; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #28a745;">
                <p style="margin: 0;"><strong>Status:</strong> Potvrzena</p>
                <p style="margin: 5px 0 0 0;"><strong>Objednávka:</strong> ${orderData.order_number}</p>
              </div>
              <p>Objednávka bude nyní zpracována a připravena k odeslání.</p>
              <hr style="margin: 30px 0; border: 1px solid #eee;">
              <p style="color: #666; font-size: 0.9em;">S pozdravem,<br><strong>Tým Firemní Asistent</strong></p>
            </div>`
        },
        processing: {
          subject: `Objednávka ${orderData.order_number} se zpracovává - Firemní Asistent`,
          text: `Vážený zákazníku${orderData.customer_name ? ` ${orderData.customer_name}` : ''},\n\nVaše objednávka ${orderData.order_number} se nyní zpracovává.\n\n${orderData.reason ? `Poznámka: ${orderData.reason}\n\n` : ''}Budeme Vás informovat o dalším postupu.\n\nS pozdravem,\nTým Firemní Asistent`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <h2 style="color: #17a2b8;">🔄 Objednávka se zpracovává</h2>
              <p>Vážený zákazníku${orderData.customer_name ? ` <strong>${orderData.customer_name}</strong>` : ''},</p>
              <p>Vaše objednávka <strong>${orderData.order_number}</strong> se nyní zpracovává.</p>
              ${orderData.reason ? `<div style="background-color: #d1ecf1; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #17a2b8;"><p style="margin: 0;"><strong>Poznámka:</strong> ${orderData.reason}</p></div>` : ''}
              <p>Budeme Vás informovat o dalším postupu.</p>
              <hr style="margin: 30px 0; border: 1px solid #eee;">
              <p style="color: #666; font-size: 0.9em;">S pozdravem,<br><strong>Tým Firemní Asistent</strong></p>
            </div>`
        },
        shipped: {
          subject: `Objednávka ${orderData.order_number} byla odeslána - Firemní Asistent`,
          text: `Vážený zákazníku${orderData.customer_name ? ` ${orderData.customer_name}` : ''},\n\nVaše objednávka ${orderData.order_number} byla odeslána!\n\n${orderData.reason ? `Poznámka: ${orderData.reason}\n\n` : ''}Sledování zásilky bude brzy k dispozici.\n\nS pozdravem,\nTým Firemní Asistent`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <h2 style="color: #fd7e14;">📦 Objednávka odeslána</h2>
              <p>Vážený zákazníku${orderData.customer_name ? ` <strong>${orderData.customer_name}</strong>` : ''},</p>
              <p>Vaše objednávka <strong>${orderData.order_number}</strong> byla odeslána!</p>
              ${orderData.reason ? `<div style="background-color: #fff3cd; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #fd7e14;"><p style="margin: 0;"><strong>Poznámka:</strong> ${orderData.reason}</p></div>` : ''}
              <p>Sledování zásilky bude brzy k dispozici.</p>
              <hr style="margin: 30px 0; border: 1px solid #eee;">
              <p style="color: #666; font-size: 0.9em;">S pozdravem,<br><strong>Tým Firemní Asistent</strong></p>
            </div>`
        },
        delivered: {
          subject: `Objednávka ${orderData.order_number} byla doručena - Firemní Asistent`,
          text: `Vážený zákazníku${orderData.customer_name ? ` ${orderData.customer_name}` : ''},\n\nVaše objednávka ${orderData.order_number} byla úspěšně doručena!\n\nDěkujeme za důvěru a těšíme se na další spolupráci.\n\nS pozdravem,\nTým Firemní Asistent`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <h2 style="color: #28a745;">🎉 Objednávka doručena</h2>
              <p>Vážený zákazníku${orderData.customer_name ? ` <strong>${orderData.customer_name}</strong>` : ''},</p>
              <p>Vaše objednávka <strong>${orderData.order_number}</strong> byla úspěšně doručena!</p>
              <div style="background-color: #d4edda; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #28a745;">
                <p style="margin: 0;">✅ <strong>Status:</strong> Doručeno</p>
              </div>
              <p>Děkujeme za důvěru a těšíme se na další spolupráci.</p>
              <hr style="margin: 30px 0; border: 1px solid #eee;">
              <p style="color: #666; font-size: 0.9em;">S pozdravem,<br><strong>Tým Firemní Asistent</strong></p>
            </div>`
        },
        cancelled: {
          subject: `Objednávka ${orderData.order_number} byla zrušena - Firemní Asistent`,
          text: `Vážený zákazníku${orderData.customer_name ? ` ${orderData.customer_name}` : ''},\n\nVaše objednávka ${orderData.order_number} byla zrušena.\n\n${orderData.reason ? `Důvod: ${orderData.reason}\n\n` : ''}V případě dotazů nás neváhejte kontaktovat.\n\nS pozdravem,\nTým Firemní Asistent`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <h2 style="color: #dc3545;">❌ Objednávka zrušena</h2>
              <p>Vážený zákazníku${orderData.customer_name ? ` <strong>${orderData.customer_name}</strong>` : ''},</p>
              <p>Vaše objednávka <strong>${orderData.order_number}</strong> byla zrušena.</p>
              ${orderData.reason ? `<div style="background-color: #f8d7da; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #dc3545;"><p style="margin: 0;"><strong>Důvod:</strong> ${orderData.reason}</p></div>` : ''}
              <p>V případě dotazů nás neváhejte kontaktovat.</p>
              <hr style="margin: 30px 0; border: 1px solid #eee;">
              <p style="color: #666; font-size: 0.9em;">S pozdravem,<br><strong>Tým Firemní Asistent</strong></p>
            </div>`
        }
      };

      return templates[status] || {
        subject: `Aktualizace objednávky ${orderData.order_number} - Firemní Asistent`,
        text: `Vážený zákazníku${orderData.customer_name ? ` ${orderData.customer_name}` : ''},\n\nStav Vaší objednávky ${orderData.order_number} byl změněn z "${orderData.old_status}" na "${orderData.new_status}".\n\n${orderData.reason ? `Poznámka: ${orderData.reason}\n\n` : ''}S pozdravem,\nTým Firemní Asistent`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #6c757d;">📋 Aktualizace objednávky</h2>
            <p>Vážený zákazníku${orderData.customer_name ? ` <strong>${orderData.customer_name}</strong>` : ''},</p>
            <p>Stav Vaší objednávky <strong>${orderData.order_number}</strong> byl aktualizován.</p>
            <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <p style="margin: 0;"><strong>Předchozí stav:</strong> ${orderData.old_status}</p>
              <p style="margin: 5px 0 0 0;"><strong>Nový stav:</strong> ${orderData.new_status}</p>
            </div>
            ${orderData.reason ? `<div style="background-color: #e2e3e5; padding: 15px; border-radius: 5px; margin: 20px 0;"><p style="margin: 0;"><strong>Poznámka:</strong> ${orderData.reason}</p></div>` : ''}
            <hr style="margin: 30px 0; border: 1px solid #eee;">
            <p style="color: #666; font-size: 0.9em;">S pozdravem,<br><strong>Tým Firemní Asistent</strong></p>
          </div>`
      };
    };

    const emailTemplate = getStatusChangeEmail(new_status, value);

    // Send status change email
    const msg = {
      to: customer_email,
      from: 'noreply@firemnipomocnik.com',
      subject: emailTemplate.subject,
      text: emailTemplate.text,
      html: emailTemplate.html,
      trackingSettings: {
        clickTracking: { enable: true },
        openTracking: { enable: true }
      },
      customArgs: {
        order_id: order_id,
        order_number: order_number,
        template_type: 'status_change',
        old_status: old_status,
        new_status: new_status,
        automated: automated.toString(),
        webhook_triggered: webhook_triggered.toString(),
        sent_by: 'status-manager',
        sent_at: new Date().toISOString()
      }
    };

    const result = await sgMail.send(msg);
    console.log(`[Status Change Email] Sent for order ${order_number}: ${old_status} → ${new_status}. MessageID: ${result[0].headers['x-message-id']}`);

    res.json({
      success: true,
      message: 'Status change notification sent successfully',
      data: {
        message_id: result[0].headers['x-message-id'],
        order_id: order_id,
        order_number: order_number,
        status_change: `${old_status} → ${new_status}`,
        customer_email: customer_email,
        automated: automated,
        webhook_triggered: webhook_triggered,
        sent_at: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('[Status Change Email Error]', error);
    
    if (error.response) {
      return res.status(400).json({
        success: false,
        message: 'Status change email delivery failed',
        error: error.response.body.errors || error.message
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to send status change notification',
      error: error.message
    });
  }
});

// Test endpoint for development
router.post('/test', async (req, res) => {
  try {
    console.log('[Email Test] Test notification request:', req.body);

    const testSchema = Joi.object({
      type: Joi.string().valid('order_confirmed', 'status_change', 'payment_success').default('status_change'),
      orderId: Joi.string().uuid().optional().default('050fc089-353f-4911-86a6-61ac3c92396a'),
      email: Joi.string().email().optional().default('testuser@example.com')
    });

    const { error, value } = testSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Invalid test data',
        errors: error.details.map(d => d.message)
      });
    }

    const { type, orderId, email } = value;

    // Test status change notification
    if (type === 'status_change' || type === 'order_confirmed') {
      const testNotification = {
        order_id: orderId,
        order_number: 'ORD-2025-004',
        old_status: 'pending',
        new_status: type === 'order_confirmed' ? 'confirmed' : 'processing',
        customer_email: email,
        customer_name: 'Test User',
        reason: 'Test email notification system',
        automated: false,
        webhook_triggered: type === 'order_confirmed'
      };

      // Call status-change endpoint internally
      const statusChangeResponse = await new Promise((resolve, reject) => {
        const req = { body: testNotification };
        const res = {
          json: (data) => resolve(data),
          status: (code) => ({ json: (data) => reject({ status: code, ...data }) })
        };

        // Call the status-change handler directly
        router.stack.find(layer => layer.route && layer.route.path === '/status-change')
          .route.stack[0].handle(req, res);
      });

      return res.json({
        success: true,
        message: `Test ${type} email sent successfully`,
        data: statusChangeResponse.data
      });
    }

    res.json({
      success: true,
      message: 'Test endpoint working',
      data: { type, orderId, email }
    });

  } catch (error) {
    console.error('[Email Test Error]', error);
    res.status(500).json({
      success: false,
      message: 'Test email failed',
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