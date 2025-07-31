# ⚡ RELACE 16 QUICK SETUP GUIDE

## 🚀 **PRE-SESSION CHECKLIST (5 minut)**

### **1. Read Primary Context**
```bash
# MANDATORY - Read this first:
cat /home/horak/Projects/Firemní_Asistent/RELACE15_FINAL_SUCCESS.md
```

### **2. Verify Services Status**
```bash
# Check if all services are running:
lsof -i:3001 -i:3002 -i:3003 -i:8080

# If not running, start them individually:
cd /home/horak/Projects/Firemní_Asistent/services/user-service && node src/app.js &
cd /home/horak/Projects/Firemní_Asistent/services/customer-service && node src/app.js &
cd /home/horak/Projects/Firemní_Asistent/services/order-service && node src/app.js &
sleep 30

# Verify health:
curl http://localhost:3001/health && curl http://localhost:3002/health && curl http://localhost:3003/health
```

### **3. Quick Functionality Test**
```bash
# Test complete order workflow:
TOKEN=$(curl -s -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"testuser@example.com","password":"Zx9#K$m2pL8@nQ4vR"}' | jq -r '.data.accessToken')

curl -X POST http://localhost:3003/orders \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"customer_id":"7d5fc01c-fdd6-4cf1-be9f-da5d573c0878","items":[{"product_name":"Test Product","quantity":1,"unit_price":100.00}]}'

# Expected: {"success":true,"message":"Order created successfully"}
```

---

## 🎯 **RELACE 16 IMPLEMENTATION STEPS**

### **STEP 1: Stripe Test Account (10 minut)**
```bash
# 1. Go to: https://dashboard.stripe.com/register ✅ DONE
# 2. Create test account ✅ DONE (horakovsky@apimaster.cz)
# 3. Features enabled (31.7.2025): ✅ DONE
#    ☑️ Non-recurring payments, ☑️ Recurring payments
#    ☑️ Invoices, ☑️ Tax collection, ☑️ Fraud protection
#    ☑️ Identity verification, ☑️ Bank data access
# 4. Get test keys from: Dashboard → Developers → API Keys
# 5. Save keys:
#    Publishable key: pk_test_xxxx
#    Secret key: sk_test_xxxx

# 6. Test API connection:
curl -X POST https://api.stripe.com/v1/customers \
  -u sk_test_xxxx: \
  -d "email=test@example.com&name=Test Customer"
```

### **STEP 2: SendGrid Account (10 minut)**  
```bash
# 1. Go to: https://sendgrid.com/pricing/ → Start for free
# 2. Create account (100 emails/day free)
# 3. Create API key: Settings → API Keys → Create API Key
# 4. Save API key: SG.xxxxx

# 5. Test email sending:
curl -X POST "https://api.sendgrid.com/v3/mail/send" \
  -H "Authorization: Bearer SG.xxxxx" \
  -H "Content-Type: application/json" \
  -d '{
    "personalizations": [{"to": [{"email": "test@example.com"}]}],
    "from": {"email": "noreply@firemnipomocnik.com"},
    "subject": "Test Email from Firemní Asistent",
    "content": [{"type": "text/plain", "value": "This is a test email from your order system."}]
  }'
```

### **STEP 3: Environment Configuration (5 minut)**
```bash
# Add to .env files in each service:
echo "STRIPE_SECRET_KEY=sk_test_xxxx" >> services/order-service/.env
echo "STRIPE_PUBLISHABLE_KEY=pk_test_xxxx" >> services/order-service/.env
echo "SENDGRID_API_KEY=SG.xxxxx" >> services/notification-service/.env
```

### **STEP 4: API Gateway Implementation (30 minut)**
```bash
# Create unified API Gateway service
mkdir services/api-gateway
cd services/api-gateway

# Package.json setup
npm init -y
npm install express helmet cors express-rate-limit http-proxy-middleware jsonwebtoken

# Implement centralized routing:
# - localhost:3000/api/auth/* → user-service:3001
# - localhost:3000/api/customers/* → customer-service:3002
# - localhost:3000/api/orders/* → order-service:3003
# - localhost:3000/api/payments/* → NEW payment service
# - localhost:3000/api/notifications/* → NEW notification service
```

### **STEP 5: Payment Service Integration (20 minut)**
```bash
# Add payment endpoints to order-service:
# POST /payments/create-intent
# POST /payments/confirm
# GET /payments/:id/status

# Integration with order workflow:
# Order created → Payment intent → Payment confirmed → Order updated
```

### **STEP 6: Email Notification Integration (15 minut)**
```bash
# Add notification endpoints:
# POST /notifications/order-confirmation
# POST /notifications/payment-confirmation
# GET /notifications/:id/status

# Integration with order workflow:
# Order confirmed → Send confirmation email
# Payment received → Send receipt email
```

---

## 🧪 **TESTING CHECKLIST**

### **Integration Tests:**
```bash
# 1. Complete E-Commerce Flow:
curl -X POST localhost:3000/api/orders/ (create order)
curl -X POST localhost:3000/api/payments/create-intent (payment)
curl -X POST localhost:3000/api/payments/confirm (confirm payment)
curl -X POST localhost:3000/api/notifications/send (send email)

# 2. API Gateway Routing:
curl localhost:3000/api/auth/login → Should route to user-service
curl localhost:3000/api/customers/ → Should route to customer-service
curl localhost:3000/api/orders/ → Should route to order-service

# 3. External API Integration:
Stripe: Payment intent creation + confirmation
SendGrid: Email sending + delivery confirmation
```

---

## 📋 **SUCCESS CRITERIA**

### **✅ Must Achieve:**
- [ ] Stripe test account functional
- [ ] SendGrid email sending working
- [ ] API Gateway routing all services
- [ ] Payment intent creation working
- [ ] Order confirmation emails sending
- [ ] Complete workflow: Order → Payment → Email

### **🎖️ Nice to Have:**
- [ ] Error handling for external API failures
- [ ] Retry logic for failed operations
- [ ] Monitoring/logging for external APIs

---

## 🚨 **TROUBLESHOOTING**

### **Common Issues:**
```bash
# Services not starting:
ps aux | grep node
kill -9 <process_id>
npm run start:all

# Database connection issues:
Check Google Cloud SQL instance status
Verify connection strings in .env files

# External API errors:
Verify API keys are correct
Check API rate limits
Test with curl commands above
```

---

## 🎯 **POST-RELACE 16 VERIFICATION**

### **Final Test:**
```bash
# Complete e-commerce workflow:
1. Login user → Get JWT token
2. Create customer → Verify in database
3. Create order → Verify order created
4. Create payment intent → Verify Stripe response
5. Confirm payment → Verify payment status
6. Send confirmation email → Verify email delivered
7. Check order status → Should be "confirmed" + "paid"
```

**🏆 SUCCESS = Production-ready e-commerce platform s real payment a email integration!** 🚀