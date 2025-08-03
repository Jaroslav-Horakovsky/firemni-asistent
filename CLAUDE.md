# Firemní Asistent - Project Memory

## 🎯 PROJECT VISION - FIREMNÍ ASISTENT

### **CO STAVÍME**
Kompletní **enterprise business management platformu** pro české firmy. Není to jen e-shop nebo CRM - je to all-in-one řešení pro řízení celého businessu.

### **STAKEHOLDERS & WORKFLOW**
1. **Majitel/Management** → Řídí business, přiřazuje úkoly, kontroluje pokrok, fakturuje
2. **Zaměstnanci** → Plní úkoly, zapisují hodiny, reportují pokrok, fotí práci
3. **Externí pracovníci** → Externí kapacity na konkrétní projekty
4. **Zákazníci** → Objednávají služby/produkty, sledují pokrok

### **COMPLETE BUSINESS FLOW**
```
Zákazník → Objednávka → Management schválí → Vytvoří projekt
→ Přiřadí tým (zaměstnanci + externisté) → Pracují na úkolech
→ Zapisují hodiny + materiál + fotky → Management sleduje pokrok
→ Fakturuje zákazníka → Zákazník platí → Projekt uzavřen
```

## ✅ CURRENT IMPLEMENTATION STATUS

### **COMPLETED** (RELACE 1-25):
- ✅ **User Service** (users table) - autentizace, správa uživatelů
- ✅ **Customer Service** (customers table) - správa zákazníků/firem  
- ✅ **Order Service** (orders, order_items, order_status_history) - objednávky a workflow
- ✅ **API Gateway** - centrální routing a komunikace
- ✅ **Mikroslužbová architektura** s oddělenými Google Cloud databázemi

### **MISSING - CRITICAL FOR BUSINESS**:
- ✅ **Employee Service** - zaměstnanci, externí pracovníci, skillsets (COMPLETE - RELACE 33)
- ❌ **Project Service** - projekty, přiřazení týmů, task management
- ❌ **Timesheet Service** - zápis hodin, materiálu, fotodokumentace
- ❌ **Inventory Service** - skladové zásoby, produktové katalogy

### **STRATEGIC IMPLEMENTATION ORDER**
Po RELACE 25 analýze zjištěno že **Employee/Project systém je kritičtější než Inventory**:
1. ✅ **Employee Service** - foundational pro work management (COMPLETE - RELACE 33)
2. **Project Service** - navazuje na Employee, umožní project management (NEXT PRIORITY)
3. **Timesheet Service** - dokončí work tracking workflow  
4. **Inventory Service** - doplní material/product tracking

## 🏗️ ARCHITECTURE

### **Current Architecture - 5 SERVICES OPERATIONAL**
```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│ API Gateway │    │ User Service│    │   Customer  │    │   Order     │    │  Employee   │
│   (3000)    │    │   (3001)    │    │  Service    │    │  Service    │    │  Service    │
│  ✅ HEALTHY │    │  ✅ HEALTHY │    │   (3002)    │    │   (3003)    │    │   (3004)    │
│   Docker    │    │   Docker    │    │  ✅ HEALTHY │    │ ✅ DEGRADED │    │ ✅ DEGRADED │
└─────────────┘    └─────────────┘    │   Docker    │    │   Docker    │    │   Docker    │
                                      └─────────────┘    └─────────────┘    └─────────────┘
                                                              * working         ✅ COMPLETE

┌─────────────────────────────────────────────────────────────────────┐
│                     PostgreSQL Database (5432)                     │
│                           HEALTHY                                   │
└─────────────────────────────────────────────────────────────────────┘
```

### **Technology Stack**
- **Backend**: Node.js 20+ + Express.js + REST API
- **Database**: PostgreSQL per service on Google Cloud
- **Authentication**: JWT-based multi-service integration
- **Infrastructure**: Docker development environment
- **Communication**: HTTP/Axios between services

### **Database Architecture**
- **Mikroslužby zachovat** - dobře fungují, škálovatelné
- **Každá služba vlastní databáze** na Google Cloud PostgreSQL
- **Komunikace přes HTTP API** - ne database FK, ale logické vztahy
- **Development bypass** - DATABASE_URL místo Secret Manager (rychlejší)

## 🚧 CURRENT SESSION CONTEXT (RELACE 34 COMPLETE ✅)

### **RELACE 34 COMPLETION STATUS - PROJECT SERVICE FOUNDATION COMPLETE ✅**

**STRATEGIC 5-RELACE PLAN PROGRESS:**
- ✅ **RELACE 34**: Service Structure & Database Schema (Foundation) - COMPLETE
- 🚧 **RELACE 35**: Controllers & Business Logic (API Implementation) - NEXT  
- ⏳ **RELACE 36**: Docker Integration (Containerization)
- ⏳ **RELACE 37**: API Gateway Integration (Service Integration)
- ⏳ **RELACE 38**: Employee Integration & Testing (6-Service Architecture)

### **RELACE 34 ACHIEVEMENTS - PROJECT SERVICE FOUNDATION 100% COMPLETE ✅**
**FOUNDATION PHASE (100% COMPLETE):**
- ✅ **Project Service directory structure** - Complete service template created
- ✅ **Database schema implemented** - 4 tables with comprehensive indexes created
- ✅ **Model layer complete** - Project, Assignment, Task, Dependency models with Joi validation
- ✅ **Service structure ready** - Express.js app on port 3005 with health checks
- ✅ **Database integration** - PostgreSQL connection via DATABASE_URL working
- ✅ **Template patterns copied** - Employee Service patterns successfully replicated
- ✅ **Package configuration** - project-service package.json updated and functional

### **Service Health Status - 5 SERVICES OPERATIONAL + PROJECT FOUNDATION**
| Service | Port | Status | Database | JWT | Docker | API Gateway |
|---------|------|--------|----------|-----|--------|-------------|
| API Gateway | 3000 | ✅ HEALTHY | N/A | ✅ | ✅ | ✅ |
| User Service | 3001 | ✅ HEALTHY | ✅ | ✅ | ✅ | ✅ |
| Customer Service | 3002 | ✅ HEALTHY | ✅ | ✅ | ✅ | ✅ |
| Order Service | 3003 | ✅ DEGRADED* | ✅ | ✅ | ✅ | ✅ |
| Employee Service | 3004 | ✅ DEGRADED* | ✅ | ✅ | ✅ | ✅ |
| Project Service | 3005 | 🚧 FOUNDATION** | ✅ | ✅ | ⏳ R36 | ⏳ R37 |

*Degraded = Working perfectly, secrets check fails intentionally in development (correct behavior)
**Foundation = Structure, models, database complete - controllers needed in RELACE 35

### **🔍 DATABASE_URL vs GOOGLE CLOUD - COMPLETE CONTEXT (RELACE 28 ANALYSIS)**

**CHRONOLOGIE PROBLÉMU:**
1. **RELACE 20-23: Security Upgrade ÚSPĚŠNÝ** ✅
   - `@google-cloud/secret-manager@4.2.2` → `@google-cloud/secret-manager@6.1.0`
   - 6 critical/high vulnerabilities eliminated 
   - Google Cloud Secret Manager v6.1.0 fungoval perfektně

2. **RELACE 25: WSL Restart Incident**
   - WSL restart cleared environment variables
   - Google Cloud authentication selhalo pro všechny services
   - Kompletní service outage

3. **RELACE 25: Emergency Solution**
   - Quick fix: přechod na DATABASE_URL místo řešení Google Cloud auth
   - `export DATABASE_URL="postgresql://dev_user:dev_password@localhost:5432/firemni_asistent_dev"`
   - Development strategy: ALWAYS use DATABASE_URL (bypass Secret Manager)

**AKTUÁLNÍ DATABÁZOVÁ STRATEGIE:**
- **Development**: DATABASE_URL na lokální PostgreSQL (záměrně)
- **Production**: Google Cloud Secret Manager v6.1.0 (ready)
- **Order Service "degraded"**: Expected behavior - Secret Manager check failuje záměrně v development
- **.env soubory**: Stále obsahují Google Cloud URLs ale services používají DATABASE_URL fallback

**KRITICKÉ POZOROVÁNÍ:**
- Knihovna @google-cloud/secret-manager v6.1.0 JE OK a funguje správně
- "Problém" nebyl s knihovnou ale s WSL/environment infrastructure
- Rozhodli jsme se pro DATABASE_URL jako permanent development solution místo řešení Google Cloud setup
- Services jsou PLNĚ FUNKČNÍ s tímto setupem

## 🔗 API GATEWAY ROUTING ARCHITECTURE (CRITICAL FOR NEW SERVICES)

### **DUAL ROUTING PATTERNS:**

#### **Pattern 1: Local Routes (No JWT Required)**
```javascript
// Handled directly by API Gateway (services/api-gateway/src/app.js):
app.use('/api/auth', authRoutes);        // → Proxy to user-service:3001/auth
app.use('/api/payments', paymentRoutes); // → Local Stripe integration  
app.use('/api/notifications', notificationRoutes); // → Local SendGrid
app.use('/api/analytics', analyticsRoutes); // → Local business intelligence
```

#### **Pattern 2: Microservice Proxy Routes (JWT Required)**
```javascript
// Proxied to services WITH authenticateToken middleware:
app.use('/api/users', authenticateToken, createServiceProxy(USER_SERVICE_URL));
app.use('/api/customers', authenticateToken, createServiceProxy(CUSTOMER_SERVICE_URL));
app.use('/api/orders', authenticateToken, createServiceProxy(ORDER_SERVICE_URL));
app.use('/api/employees', authenticateToken, createServiceProxy(EMPLOYEE_SERVICE_URL)); // ✅ IMPLEMENTED
```

### **EMPLOYEE SERVICE ROUTING IMPLEMENTATION:**
```javascript
// ✅ IMPLEMENTED in API Gateway (services/api-gateway/src/app.js):
app.use('/api/employees', authenticateToken, createServiceProxy(process.env.EMPLOYEE_SERVICE_URL, {
  '^/api/employees': ''
}));

// ✅ Environment variable configured:
EMPLOYEE_SERVICE_URL=http://employee-service:3004  // Docker (ACTIVE)
EMPLOYEE_SERVICE_URL=http://localhost:3004         // Local development (fallback)

// ✅ WORKING: JWT authentication protects all /api/employees/* endpoints
// ✅ TESTED: curl http://localhost:3000/api/employees/health returns JWT required message
```

## 💻 DEVELOPMENT COMMANDS

### **Service Management**
```bash
# Start all services
npm run dev

# Individual services
npm run dev:user-service     # Port 3001
npm run dev:customer-service # Port 3002  
npm run dev:order-service    # Port 3003
npm run dev:api-gateway      # Port 3000
npm run dev:employee-service # Port 3004 ✅ IMPLEMENTED

# Health checks (All ✅ WORKING)
curl http://localhost:3000/health  # API Gateway - healthy
curl http://localhost:3001/health  # User Service - healthy
curl http://localhost:3002/health  # Customer Service - healthy
curl http://localhost:3003/health  # Order Service - degraded (working)
curl http://localhost:3004/health  # Employee Service - degraded (working)

# API Gateway routing tests ✅ WORKING
curl http://localhost:3000/api/employees/health  # Returns JWT required (correct)
```

### **Database Operations**
```bash
# AKTUÁLNÍ DEVELOPMENT STRATEGY: Lokální PostgreSQL přes DATABASE_URL
# Services používají: postgresql://dev_user:dev_password@localhost:5432/firemni_asistent_dev

# Lokální databáze connection (aktuálně používaná)
docker exec firemni-asistent-postgres-dev psql -U postgres -d firemni_asistent_dev

# Google Cloud connections (.env fallback - nepoužívané v development)
# PGPASSWORD=oEbfxBOVbUh806GZj9Wa4xehKXkodEWxB4SzP80k4Vk= psql -h 34.89.140.144 -U postgres -d user_db
# PGPASSWORD=oEbfxBOVbUh806GZj9Wa4xehKXkodEWxB4SzP80k4Vk= psql -h 34.89.140.144 -U postgres -d customer_db  
# PGPASSWORD=oEbfxBOVbUh806GZj9Wa4xehKXkodEWxB4SzP80k4Vk= psql -h 34.89.140.144 -U postgres -d order_db
```

### **Development Workflow**
1. **Service Creation**: Copy patterns from existing services
2. **Database Integration**: Use established DATABASE_URL pattern
3. **Authentication**: Integrate JWT middleware from existing services
4. **API Gateway**: Add routing for new service endpoints
5. **Testing**: Health checks and integration validation
6. **Documentation**: Update architecture and API documentation

## 📋 PROJECT STANDARDS

### **Code Patterns**
- Use existing service templates (order-service as reference)
- Follow established JWT authentication patterns
- Implement health checks for all services
- Use direct DATABASE_URL connections in development
- HTTP/Axios for inter-service communication

### **Quality Assurance Process**
1. **Health Checks**: All endpoints must respond with proper status
2. **Integration Testing**: Service-to-service communication verified
3. **Security Validation**: JWT authentication and input validation
4. **Performance Testing**: Database queries and API response times
5. **Recovery Testing**: WSL restart and service recovery procedures

## 📚 Key Documentation Files

### **Essential Project Files**
- `ARCHITECTURE.md` - Complete system architecture and service specifications
- `CURRENT_PROJECT_STATUS.md` - Real-time project status and health metrics
- `RELACE27_CONTINUATION_PROMPT.md` - Current session context and next steps
- `WSL_RESTART_RECOVERY_SOLUTION.md` - Recovery procedures for development environment
- `SECURITY_UPGRADE_COMPLETE_REPORT.md` - Security compliance and vulnerability resolution

### **Implementation Guides**
- Service patterns in `/services/` directories
- Database schemas and migration scripts
- Authentication middleware implementations
- Docker configurations and development optimization

## 🎯 BUSINESS VALUE PRIORITY

1. **Project Management** (Employee+Project+Timesheet) - hlavní business pain point
2. **Inventory Management** - doplňková funkcionalita pro material tracking
3. **Advanced Features** - reporting, analytics, mobilní apps

---

**🎯 PROJECT CURRENT STATE: 5 services operational, Employee Service 100% complete, Project Service foundation complete, ready for RELACE 35 controllers**

*Last Updated: 2025-08-03 | RELACE 34 Complete - Project Service Foundation 100% Complete, Ready for Controllers Implementation*