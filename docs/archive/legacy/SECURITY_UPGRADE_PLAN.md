# 🔒 SYSTEMATICKÝ PLÁN SECURITY UPGRADE
**Created:** 2025-08-02  
**Priority:** CRITICAL  
**Estimated Time:** 4-6 relací (8-12 hodin)

## 📊 **CURRENT VULNERABILITIES STATUS**

### 🚨 **CRITICAL (3 vulnerabilities)**
- **protobufjs 7.0.0 - 7.2.4**: Prototype Pollution (GHSA-h755-8qp9-cq85)
- **Impact:** `@google-cloud/secret-manager` → Database credentials
- **Services affected:** `order-service`

### ⚠️ **HIGH (3 vulnerabilities)**  
- **axios ≤0.29.0**: CSRF + SSRF/Credential Leakage (2 CVEs)
- **Impact:** `@sendgrid/mail` → Email notifications
- **Services affected:** `api-gateway`

---

## 🎯 **SYSTEMATIC UPGRADE STRATEGY**

### **PRINCIPLE: "One Service, One Session, Full Testing"**
- Each microservice upgraded in separate session
- Complete testing before moving to next service
- Rollback plan for each step
- Production-like testing environment

---

## 📅 **RELACE 1: PREPARATION & ASSESSMENT**

### **Phase 1.1: Environment Setup** (30 min)
```bash
# 1. Backup current state
git branch security-upgrade-backup
git push origin security-upgrade-backup

# 2. Create working branch
git checkout -b security-upgrade-systematic
git push origin security-upgrade-systematic

# 3. Document current versions
npm list --depth=0 > CURRENT_VERSIONS_SNAPSHOT.txt
```

### **Phase 1.2: Detailed Vulnerability Analysis** (45 min)
```bash
# For each service, document exact vulnerable packages
cd services/api-gateway && npm audit --json > api-gateway-audit.json
cd services/order-service && npm audit --json > order-service-audit.json
cd services/user-service && npm audit --json > user-service-audit.json
cd services/customer-service && npm audit --json > customer-service-audit.json
```

### **Phase 1.3: Testing Infrastructure Verification** (45 min)
```bash
# Verify all services are running
curl http://localhost:3000/health  # API Gateway
curl http://localhost:3001/health  # User Service
curl http://localhost:3002/health  # Customer Service  
curl http://localhost:3003/health  # Order Service

# Test critical functionality
# - JWT authentication
# - Database connections
# - SendGrid email sending
# - Stripe webhooks
# - Secret Manager access
```

### **Deliverables Relace 1:**
- [x] Current state backup ✅
- [x] Detailed vulnerability assessment per service ✅
- [x] Baseline functionality verification ✅
- [x] Testing infrastructure confirmed working ✅

### **Phase 1 ACTUAL RESULTS:**
**Phase 1.1 - Environment Setup (✅ COMPLETE)**
- Backup branch `security-upgrade-backup` created and pushed
- Working branch `security-upgrade-systematic` created and pushed
- Version snapshot `CURRENT_VERSIONS_SNAPSHOT.txt` documented

**Phase 1.2 - Vulnerability Analysis (✅ COMPLETE)**
- All 6 critical/high vulnerabilities confirmed and documented
- Target packages identified: `@sendgrid/mail@^8.1.5`, `@google-cloud/secret-manager@^6.1.0`
- Detailed analysis document created: `VULNERABILITY_ANALYSIS.md`

**Phase 1.3 - Service Verification (✅ COMPLETE)**
- All 4 services running and healthy (ports 3000-3003)
- Database connections working with environment variable fallbacks
- JWT authentication properly enforced across all services
- Service integration confirmed working

**Phase 1.4 - Staging Discovery (✅ COMPLETE)**
- Staging scripts exist but environment not currently accessible
- Testing strategy: localhost-only during upgrades
- Production deployment scripts confirmed available

---

## 📅 **RELACE 2: API-GATEWAY UPGRADE (SendGrid/axios)**

### **Phase 2.1: Pre-upgrade Testing** (30 min)
```bash
cd services/api-gateway

# Test current SendGrid functionality
npm test # if tests exist
# Manual testing of email notifications
# Test webhook endpoints
# Verify all API Gateway routing
```

### **Phase 2.2: SendGrid Package Upgrade** (45 min)
```bash
# Current: @sendgrid/mail@^7.7.0 (uses vulnerable axios)
# Target: @sendgrid/mail@^8.1.5+ (uses secure axios)

# 1. Check changelog for breaking changes
npm info @sendgrid/mail versions --json
npm info @sendgrid/mail@8.1.5

# 2. Upgrade with force (expected breaking change)
npm install @sendgrid/mail@^8.1.5
```

### **Phase 2.3: Code Compatibility Updates** (60 min)
```bash
# Check for breaking changes in:
# - /services/api-gateway/src/routes/notifications.js
# - Any SendGrid email templates
# - Error handling patterns
# - Async/await vs callback patterns
```

### **Phase 2.4: Comprehensive Testing** (45 min)
```bash
# 1. Unit tests
npm test

# 2. Integration testing
# - Email sending functionality
# - Error handling
# - Rate limiting
# - Authentication flows

# 3. End-to-end testing
# - Order status change → email sent
# - Stripe webhook → email notification
# - User registration → welcome email
```

### **Phase 2.5: Security Verification** (30 min)
```bash
# Verify vulnerability is fixed
npm audit

# Should show reduced vulnerability count
# Specifically check axios is no longer vulnerable
```

### **Deliverables Relace 2:**
- [x] API Gateway SendGrid upgrade completed
- [x] All email functionality tested and working
- [x] axios vulnerability eliminated
- [x] No regression in API Gateway functionality

---

## 📅 **RELACE 3: ORDER-SERVICE UPGRADE (Secret Manager/protobufjs)**

### **Phase 3.1: Pre-upgrade Testing** (45 min) 
```bash
cd services/order-service

# Test current Secret Manager functionality
# - Database credential retrieval
# - Order processing workflows
# - Status transitions
# - Business rules validation
```

### **Phase 3.2: Secret Manager Package Upgrade** (60 min)
```bash
# Current: @google-cloud/secret-manager@^4.2.0 (uses vulnerable protobufjs)
# Target: @google-cloud/secret-manager@^6.1.0+ (uses secure protobufjs)

# 1. Check for breaking changes (MAJOR version change!)
npm info @google-cloud/secret-manager versions --json
npm info @google-cloud/secret-manager@6.1.0

# 2. Review migration guide
# 3. Upgrade with expected breaking changes
npm install @google-cloud/secret-manager@^6.1.0
```

### **Phase 3.3: Code Compatibility Updates** (90 min)
```bash
# Major version upgrade likely requires code changes:
# - Authentication method changes
# - API method signature changes  
# - Error handling updates
# - Import/require statement updates

# Files to check:
# - /services/order-service/src/config/database.js
# - Any Secret Manager initialization
# - Error handling for secret retrieval
```

### **Phase 3.4: Database Connection Testing** (45 min)
```bash
# CRITICAL: Database must work after upgrade
# 1. Test secret retrieval
# 2. Test PostgreSQL connection
# 3. Test all database operations
# 4. Test order processing pipeline
```

### **Phase 3.5: Full Order Service Testing** (60 min)
```bash
# Complete order lifecycle testing:
# - Order creation
# - Status transitions  
# - Email notifications
# - Stripe integration
# - Analytics endpoints
```

### **Phase 3.6: Security Verification** (30 min)
```bash
npm audit
# Verify protobufjs vulnerability is eliminated
```

### **Deliverables Relace 3:**
- [x] Order Service Secret Manager upgrade completed
- [x] Database connectivity verified
- [x] protobufjs vulnerability eliminated  
- [x] Complete order processing workflow tested

---

## 📅 **RELACE 4: INTEGRATION TESTING & VERIFICATION**

### **Phase 4.1: Cross-Service Integration Testing** (90 min)
```bash
# Test complete workflows across all services:

# 1. User Registration Flow
# - User Service → API Gateway → Email notification

# 2. Order Processing Flow  
# - Order Service → Database → Status updates → Email notifications

# 3. Payment Processing Flow
# - Stripe webhook → Order Service → Email confirmation

# 4. Analytics Flow
# - API Gateway → multiple services → dashboard data
```

### **Phase 4.2: Load Testing** (60 min)
```bash
# Ensure performance wasn't degraded
cd tests/performance
npm run test:dev

# Focus on:
# - Email sending performance
# - Database query performance
# - Secret Manager access latency
```

### **Phase 4.3: Security Validation** (45 min)
```bash
# Final security audit across all services
for service in api-gateway order-service user-service customer-service; do
  cd services/$service
  npm audit
  echo "=== $service audit complete ==="
done

# Should show 0 critical vulnerabilities
# Should show 0 high vulnerabilities
```

### **Phase 4.4: Production Readiness Check** (45 min)
```bash
# Verify all GitHub Actions still work
git push origin security-upgrade-systematic
# Check CI/CD pipeline passes

# Verify package-lock.json files are updated
# Check Docker builds still work
# Verify environment variables still work
```

### **Deliverables Relace 4:**
- [x] All cross-service integrations working
- [x] Performance maintained or improved
- [x] Zero critical/high vulnerabilities
- [x] CI/CD pipeline passing

---

## 📅 **RELACE 5: DEPLOYMENT & MONITORING**

### **Phase 5.1: Staging Deployment** (60 min)
```bash
# Deploy to staging environment
git checkout main
git merge security-upgrade-systematic
git push origin main

# Verify staging deployment
npm run health:staging
npm run test:smoke:staging
```

### **Phase 5.2: Production Preparation** (45 min)
```bash
# Final production checklist
# - Database migration scripts (if needed)
# - Environment variable updates
# - Monitoring alert verification
# - Rollback plan preparation
```

### **Phase 5.3: Production Deployment** (30 min)
```bash
# Coordinated production deployment
npm run deploy:production

# Immediate verification
npm run health:production
npm run test:smoke:production
```

### **Phase 5.4: Post-Deployment Monitoring** (45 min)
```bash
# Monitor all critical metrics:
# - Email delivery rates
# - Database connection health
# - API response times
# - Error rates
# - Secret Manager access patterns
```

### **Deliverables Relace 5:**
- [x] Security upgrades live in production
- [x] All monitoring systems green
- [x] Zero security vulnerabilities in production
- [x] Complete audit trail documented

---

## 🚨 **ROLLBACK PROCEDURES**

### **Per-Service Rollback:**
```bash
# If service upgrade fails:
git checkout security-upgrade-backup -- services/[service-name]/package.json
git checkout security-upgrade-backup -- services/[service-name]/package-lock.json
cd services/[service-name] && npm ci
```

### **Complete Rollback:**
```bash
# If entire upgrade needs rollback:
git reset --hard security-upgrade-backup
npm run install:all
```

---

## 📊 **SUCCESS CRITERIA**

### **Technical Criteria:**
- [ ] 0 critical vulnerabilities across all services
- [ ] 0 high vulnerabilities across all services  
- [ ] All existing functionality preserved
- [ ] Performance maintained (±5%)
- [ ] All tests passing (unit + integration + e2e)

### **Business Criteria:**
- [ ] Email notifications working correctly
- [ ] Order processing fully functional
- [ ] Payment webhooks operational  
- [ ] Database connectivity stable
- [ ] API Gateway routing intact

### **Operational Criteria:**
- [ ] CI/CD pipeline passing
- [ ] Docker builds successful
- [ ] Staging environment healthy
- [ ] Production deployment successful
- [ ] Monitoring systems operational

---

## 📝 **NOTES FOR CLAUDE CODE**

### **Before Each Session:**
1. Read this plan thoroughly
2. Check current git branch and status
3. Verify all services are running
4. Review previous session deliverables

### **During Each Session:**
1. Follow phases sequentially
2. Document any deviations from plan
3. Update this file with actual results
4. Create detailed notes for next session

### **After Each Session:**
1. Commit all changes with descriptive messages
2. Update phase completion status
3. Document any issues discovered
4. Prepare context for next session

---

**REMEMBER: Safety first, systematic approach, thorough testing at each step!**