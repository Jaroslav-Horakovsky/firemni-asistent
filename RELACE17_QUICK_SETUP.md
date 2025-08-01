# ⚡ RELACE 17: QUICK SETUP & VERIFICATION GUIDE

## 🚀 **IMMEDIATE START CHECKLIST**

### **1. VERIFY ENVIRONMENT (2 minutes)**
```bash
# Check if services are running
curl http://localhost:3000/health && echo " ✅ API Gateway"
curl http://localhost:3001/health && echo " ✅ User Service"  
curl http://localhost:3002/health && echo " ✅ Customer Service"
curl http://localhost:3003/health && echo " ✅ Order Service"
```

### **2. START SERVICES IF NEEDED (3 minutes)**
```bash
# If any service is down, start them in this order:
cd /home/horak/Projects/Firemní_Asistent/services/user-service && node src/app.js &
cd /home/horak/Projects/Firemní_Asistent/services/customer-service && node src/app.js &
cd /home/horak/Projects/Firemní_Asistent/services/order-service && node src/app.js &
cd /home/horak/Projects/Firemní_Asistent/services/api-gateway && node src/app.js &

# Wait 30 seconds then verify again
sleep 30
curl http://localhost:3000/health
```

### **3. VERIFY EXTERNAL APIS (1 minute)**
```bash
# Test Stripe integration
curl -X POST http://localhost:3000/api/payments/create-intent \
  -H "Authorization: Bearer $(curl -s -X POST http://localhost:3001/auth/login -H "Content-Type: application/json" -d '{"email":"testuser@example.com","password":"Zx9#K$m2pL8@nQ4vR"}' | jq -r '.data.accessToken')" \
  -H "Content-Type: application/json" \
  -d '{"amount": 1000, "currency": "czk", "order_id": "'$(uuidgen)'", "customer_email": "test@example.com"}'

# Should return: payment_intent created successfully
```

---

## 📋 **RELACE 17 DEVELOPMENT WORKFLOW**

### **Development Pattern:**
1. **Design API** → 2. **Implement Backend** → 3. **Test Integration** → 4. **Verify E2E**

### **Key Directories:**
```bash
# Order Service Extensions
/home/horak/Projects/Firemní_Asistent/services/order-service/src/
├── routes/status.js          # New: Order status management
├── routes/analytics.js       # New: Order analytics  
├── services/statusManager.js # New: Status validation logic
└── services/analytics.js     # New: Analytics calculations

# API Gateway Extensions  
/home/horak/Projects/Firemní_Asistent/services/api-gateway/src/routes/
├── analytics.js              # New: Business intelligence API
├── webhooks.js               # New: Stripe webhook handling
└── notifications.js          # Extend: Enhanced email templates
```

---

## 🎯 **RELACE 17 IMPLEMENTATION SEQUENCE**

### **PHASE 1: Order Status Workflows (30 min)**

#### **Step 1: Database Schema Extensions (10 min)**
```sql
-- Connect to order_db and add:
ALTER TABLE orders ADD COLUMN IF NOT EXISTS status_updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS status_notes TEXT;

-- Create status validation trigger
CREATE OR REPLACE FUNCTION validate_order_status_transition()
RETURNS TRIGGER AS $$
BEGIN
  -- Add status transition validation logic
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_order_status_history_order_id ON order_status_history(order_id);
```

#### **Step 2: Status Management API (15 min)**
```bash
# Implement in order-service:
PUT /api/orders/:id/status     # Update order status with validation
GET /api/orders/:id/history    # Get complete status history  
GET /api/orders/status/:status # Get orders by status

# Status workflow endpoints:
POST /api/orders/:id/confirm   # draft → confirmed
POST /api/orders/:id/process   # confirmed → processing  
POST /api/orders/:id/ship      # processing → shipped
POST /api/orders/:id/deliver   # shipped → delivered
```

#### **Step 3: Integration Testing (5 min)**
```bash
# Test complete status workflow
curl -X POST http://localhost:3000/api/orders/:id/confirm
curl -X POST http://localhost:3000/api/orders/:id/process
curl -X GET http://localhost:3000/api/orders/:id/history
```

### **PHASE 2: Business Analytics (45 min)**

#### **Step 1: Analytics Database Views (15 min)**
```sql
-- Create analytics views in order_db
CREATE OR REPLACE VIEW order_analytics AS
SELECT 
  DATE_TRUNC('day', created_at) as date,
  COUNT(*) as order_count,
  SUM(total_amount) as total_revenue,
  AVG(total_amount) as avg_order_value
FROM orders 
GROUP BY DATE_TRUNC('day', created_at);

-- Revenue by status view
CREATE OR REPLACE VIEW revenue_by_status AS
SELECT status, COUNT(*) as count, SUM(total_amount) as revenue
FROM orders GROUP BY status;
```

#### **Step 2: Analytics API Implementation (20 min)**
```bash
# Implement analytics endpoints in API Gateway:
GET /api/analytics/dashboard    # Key metrics overview
GET /api/analytics/revenue      # Revenue reports
GET /api/analytics/orders       # Order analytics
GET /api/analytics/customers    # Customer insights
```

#### **Step 3: Dashboard Data Testing (10 min)**
```bash
# Test analytics endpoints
curl http://localhost:3000/api/analytics/dashboard
curl http://localhost:3000/api/analytics/revenue?period=week
curl http://localhost:3000/api/analytics/orders?status=confirmed
```

### **PHASE 3: Payment Webhooks (30 min)**

#### **Step 1: Webhook Endpoint (15 min)**
```bash
# Implement in API Gateway:
POST /api/webhooks/stripe      # Handle Stripe payment confirmations
PUT /api/payments/:id/status   # Update payment status

# Payment history tracking:
GET /api/payments/:id/history  # Complete payment audit trail
POST /api/payments/:id/refund  # Process refunds
```

#### **Step 2: Payment Database Extensions (10 min)**
```sql
-- Add payment tracking tables
CREATE TABLE IF NOT EXISTS payment_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id),
  stripe_payment_intent_id VARCHAR(255),
  amount INTEGER NOT NULL,
  currency VARCHAR(3) DEFAULT 'czk',
  status VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### **Step 3: Integration Testing (5 min)**
```bash
# Test webhook simulation
curl -X POST http://localhost:3000/api/webhooks/stripe \
  -H "Content-Type: application/json" \
  -d '{"type": "payment_intent.succeeded", "data": {"object": {"id": "pi_test"}}}'
```

### **PHASE 4: Enhanced Notifications (15 min)**

#### **Step 1: Email Templates (10 min)**
```bash
# Extend SendGrid integration with status-based emails:
- Order Confirmed: Professional confirmation template
- Order Processing: Processing started notification  
- Order Shipped: Shipping details with tracking
- Order Delivered: Delivery confirmation
```

#### **Step 2: Automated Triggers (5 min)**
```bash
# Connect status changes to email notifications:
Status Change → Automatic Email → Customer Notification
Admin Events → Internal Notifications → Admin Alerts
```

---

## 🧪 **COMPLETE E2E TESTING SEQUENCE**

### **Full Workflow Test:**
```bash
# 1. Create customer and order
curl -X POST http://localhost:3000/api/customers \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"firstName":"Test","lastName":"Customer","email":"test@example.com"}'

# 2. Create order  
curl -X POST http://localhost:3000/api/orders \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"customer_id":"uuid","items":[{"product_name":"Test Product","quantity":1,"unit_price":99.99}]}'

# 3. Create payment intent
curl -X POST http://localhost:3000/api/payments/create-intent \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"amount":9999,"currency":"czk","order_id":"uuid","customer_email":"test@example.com"}'

# 4. Update order status  
curl -X POST http://localhost:3000/api/orders/uuid/confirm

# 5. Check analytics
curl http://localhost:3000/api/analytics/dashboard

# 6. Verify email notifications sent
```

---

## 📊 **SUCCESS VERIFICATION**

### **All Features Working:**
```bash
✅ Order Status Workflows: All transitions working
✅ Business Analytics: Dashboard showing real data
✅ Payment Webhooks: Stripe integration complete
✅ Enhanced Notifications: Automated emails working
✅ Admin Features: Business intelligence accessible
```

### **Performance Targets:**
- Order status updates: <100ms
- Analytics queries: <300ms  
- Payment webhooks: <200ms
- Email delivery: <2 seconds
- Dashboard load: <500ms

---

## 🚨 **TROUBLESHOOTING QUICK FIXES**

### **Common Issues:**
```bash
# Services not responding
→ Restart services in order: user → customer → order → api-gateway

# Database connection errors  
→ Check PostgreSQL connectivity: curl http://localhost:300X/health

# External API errors
→ Verify API keys in /services/api-gateway/.env

# JWT token expired
→ Re-authenticate: POST /api/auth/login

# Email delivery failures
→ Check SendGrid API key and sender verification
```

---

## 🎯 **READY TO IMPLEMENT**

**Foundation**: ✅ All services operational
**Database**: ✅ PostgreSQL connections stable  
**External APIs**: ✅ Stripe + SendGrid working
**Authentication**: ✅ JWT validation active

**🚀 LET'S BUILD ADVANCED BUSINESS FEATURES IN RELACE 17!** ✨

---

*Quick Setup Guide for RELACE 17 | Generated: 2025-08-01 10:45 CET*