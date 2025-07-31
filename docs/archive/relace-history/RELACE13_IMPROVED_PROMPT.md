# 🎯 RELACE 13 - COMPLETE CONTEXT TRANSFER PROMPT

## 📖 **CRITICAL READING ORDER (MUST READ ALL):**

### **1. STRATEGIC CONTEXT (NEW - Read First!):**
```bash
/home/horak/Projects/Firemní_Asistent/DATABASE_DESIGN_FINALIZATION.md
# ↑ NEW: Database strategy před frontend development - CRITICAL!

/home/horak/Projects/Firemní_Asistent/BUSINESS_REQUIREMENTS_SESSION.md  
# ↑ NEW: Business requirements gathering - MUST-HAVE před schema freeze

/home/horak/Projects/Firemní_Asistent/RELACE13_CONTEXT.md
# ↑ Technical context, debugging strategy, immediate objectives

/home/horak/Projects/Firemní_Asistent/RELACE12B_CURRENT.md
# ↑ Previous work, current architecture status
```

### **2. ORDER-SERVICE DEBUGGING (Primary Task):**
```bash
/home/horak/Projects/Firemní_Asistent/order-service/src/services/order.service.js
# ↑ OrderService.createOrder() - main debugging target

/home/horak/Projects/Firemní_Asistent/order-service/src/controllers/order.controller.js
# ↑ API handlers, error handling

/home/horak/Projects/Firemní_Asistent/order-service/src/services/customer.service.js
# ↑ Customer validation integration

/home/horak/Projects/Firemní_Asistent/order-service/src/utils/database.js
# ↑ Database transactions, connection management

/home/horak/Projects/Firemní_Asistent/order-service/src/models/order.model.js
# ↑ Data validation, business logic
```

---

## 🎯 **EXPANDED RELACE 13 OBJECTIVES:**

### **🚨 PRIMARY (Must Complete):**
1. **DEBUG & FIX Order Creation** - Main blocker for functional e-commerce
2. **Complete Integration Testing** - Full workflow validation
3. **Database Design Review** - Initial assessment per DATABASE_DESIGN_FINALIZATION.md
4. **Business Requirements Scoping** - Identify missing requirements per BUSINESS_REQUIREMENTS_SESSION.md

### **🔧 SECONDARY (If Time Allows):**
5. **Error Handling Enhancement** - Proper error messages
6. **Performance Validation** - Response time checks
7. **Future-Proofing Planning** - Begin flexibility implementation

---

## 🚨 **CRITICAL CONTEXT UPDATE:**

### **SCOPE EXPANSION:**
**PŮVODNÍ SCOPE:** 15% backend completion → frontend
**NOVÝ SCOPE:** 35% backend completion → business review → database finalization → frontend

**WHY:** Po discussion s majitelem - lepší investovat čas teďka než řešit database migrations v produkci.

### **NEW STRATEGIC PRIORITY:**
Database změny v produkci = nightmare complexity. Musíme finalizovat database design PŘED frontend development.

---

## 🔍 **IMMEDIATE DEBUGGING PROTOCOL:**

### **1. Health Check (Verify Current State):**
```bash
curl http://localhost:3001/health  # User-service
curl http://localhost:3002/health  # Customer-service  
curl http://localhost:3003/health  # Order-service
curl http://localhost:8080/gateway/status  # API Gateway
```

### **2. Reproduce Order Creation Failure:**
```bash
# Get JWT token:
TOKEN=$(curl -s -X POST http://localhost:8080/api/users/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"testuser@example.com","password":"Zx9#K$m2pL8@nQ4vR"}' \
  | jq -r '.data.accessToken')

# Verify customer exists:
curl -s -H "Authorization: Bearer $TOKEN" \
  http://localhost:8080/api/customers/7d5fc01c-fdd6-4cf1-be9f-da5d573c0878

# Attempt order creation (EXPECTED TO FAIL):
curl -X POST http://localhost:8080/api/orders/ \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"customer_id":"7d5fc01c-fdd6-4cf1-be9f-da5d573c0878","items":[{"product_name":"Debug Test","quantity":1,"unit_price":100.00}]}'
```

### **3. Investigation Focus:**
- **WHERE:** OrderService.createOrder() method likely failing
- **WHY:** Possibly database transaction, customer validation, or business logic
- **HOW:** Systematic debugging through order-service codebase

---

## 🎯 **SUCCESS CRITERIA (UPDATED):**

### **✅ TECHNICAL SUCCESS:**
```bash
# This MUST work by end of session:
curl -X POST http://localhost:8080/api/orders/ \
  -H "Authorization: Bearer [VALID_JWT]" \
  -H "Content-Type: application/json" \
  -d '{"customer_id":"7d5fc01c-fdd6-4cf1-be9f-da5d573c0878","items":[{"product_name":"RELACE 13 SUCCESS","quantity":1,"unit_price":100.00}]}'

# Expected response:
{"success":true,"message":"Order created successfully","data":{"order":{"id":"uuid","order_number":"ORD-2025-001",...}}}
```

### **📋 STRATEGIC SUCCESS:**
- [ ] Order creation workflow 100% functional
- [ ] Database design review initiated  
- [ ] Business requirements gaps identified
- [ ] Next phase planning completed
- [ ] Documentation updated for handoff

---

## 📊 **CURRENT ARCHITECTURE STATUS:**

### **SERVICES STATUS:**
```
✅ User-Service (3001): Authentication, JWT working
✅ Customer-Service (3002): CRUD, validation working  
⚠️ Order-Service (3003): GET works, POST fails
✅ API Gateway (8080): Routing functional for all services
```

### **TECHNICAL DEBT:**
- Order creation bug (blocking e-commerce functionality)
- Nginx landing page empty (minor UX issue)
- Database design needs business validation
- Missing business requirements documentation

---

## 🗄️ **DATABASE DESIGN CONSIDERATIONS:**

### **CURRENT PROBLEMS TO ASSESS:**
1. **Are current schemas sufficient for business needs?**
2. **Do we need metadata JSONB columns for flexibility?**
3. **Is pricing/tax logic complete enough?**
4. **Are all business workflows covered?**
5. **What future-proofing is needed?**

### **DECISION FRAMEWORK:**
- Fix immediate bugs first
- Then assess schema completeness  
- Plan business requirements session
- Implement flexibility features
- Validate before frontend development

---

## 🚀 **EXECUTION PLAN:**

### **PHASE 1: IMMEDIATE (30-60 min):**
1. Read all strategic documents
2. Debug order creation failure
3. Fix identified root cause
4. Validate complete workflow works

### **PHASE 2: ASSESSMENT (30-45 min):**
1. Review database design per finalization doc
2. Identify business requirements gaps
3. Plan next phase approach
4. Document findings and recommendations

### **PHASE 3: DOCUMENTATION (15 min):**
1. Update project status
2. Create action items for next sessions
3. Prepare business requirements session agenda

---

## ⚠️ **CRITICAL REMINDERS:**

### **DON'T MISS:**
- **NEW DOCUMENTS** obsahují critical strategic planning
- **Database design** is now in focus, not just bug fixing
- **Business requirements** gathering is planned
- **Scope expanded** but timeline flexible

### **MAINTAIN FOCUS:**
- Fix order creation FIRST (immediate business value)
- Then strategic planning (long-term business value)
- Quality over speed (better to get it right)

---

## 📋 **EXECUTION CHECKLIST:**

```
[ ] Read DATABASE_DESIGN_FINALIZATION.md - Strategic context
[ ] Read BUSINESS_REQUIREMENTS_SESSION.md - Planning context  
[ ] Read RELACE13_CONTEXT.md - Technical context
[ ] Read RELACE12B_CURRENT.md - Historical context
[ ] Health check all services - Current state
[ ] Reproduce order creation failure - Problem confirmation
[ ] Debug order-service codebase - Root cause analysis
[ ] Fix identified issues - Problem resolution
[ ] Test complete workflow - Solution validation
[ ] Review database design - Strategic assessment
[ ] Plan business requirements session - Next phase prep
[ ] Document session results - Knowledge transfer
```

**START HERE:** DATABASE_DESIGN_FINALIZATION.md → Debug order creation → Strategic planning → Success! 🎯

---

## 🎉 **FINAL CONTEXT:**

**WHERE WE ARE:** 85% functional microservices with order creation blocker + strategic database planning phase

**WHAT WE'RE DOING:** Fix immediate blocker + begin production readiness preparation  

**WHY IT MATTERS:** Database changes in production = exponential complexity. Better to invest time now.

**SUCCESS DEFINITION:** Working e-commerce workflow + clear path to production-ready database design

**CRITICAL:** This session bridges tactical debugging with strategic planning - both are essential! 🚀