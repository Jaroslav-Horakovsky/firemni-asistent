# 🎯 RELACE 24: INVENTORY SERVICE - PLÁNOVÁNÍ A NÁVRH

**Status:** Planning Phase Required  
**Date:** 2025-08-02  
**Previous:** RELACE 23 - Final Security Cleanup Complete (0 vulnerabilities)  
**Current:** RELACE 24 - Strategic Planning & Architecture Design

---

## ⚠️ KRITICKÉ: ZAČÍNÁ PLÁNOVÁNÍM, NE IMPLEMENTACÍ!

### **POVINNÁ SEKVENCE PRO RELACI 24:**
```
RELACE 24 = PLÁNOVÁNÍ + ČÁSTEČNÁ IMPLEMENTACE

Phase 0: PLÁNOVÁNÍ (30-45 min) - POVINNÉ!
├── Prostudování ARCHITECTURE.md
├── Definice business logiky Inventory Service
├── Projednání workflow a integrace
├── Rozdělení do fází/případně více RELACÍ
└── Schválení přístupu

Phase 1: PRVNÍ IMPLEMENTAČNÍ FÁZE (zbytek času)
├── Pouze pokud je plán schválen
├── Základní struktura služby
└── Database schema a migrace
```

---

## 📋 RELACE 24 OBJECTIVES - AKTUALIZOVANÉ

### **Primary Goal: Strategic Planning + Foundation**
Naplánovat a zahájit implementaci Inventory Service s důrazem na **reálné business procesy** a **správnou architekturu**.

### **Phase Breakdown:**
**Phase 0: STRATEGIC PLANNING (KRITICKÉ!)**
- Probrání ARCHITECTURE.md pro kontext
- Definice přesné business logiky
- Workflow integrace s Order Service
- Rozhodnutí o rozdělení do více RELACÍ

**Phase 1: Foundation (pouze pokud Phase 0 dokončeno)**
- Service structure setup
- Database design
- Basic server configuration

---

## 🤖 AI INTEGRATION PRIORITY (KRITICKÉ!)

### **⚠️ STRATEGICKÁ ZMĚNA - AI NELZE ODLOŽIT:**
```
❌ PŮVODNÍ PLÁN: AI až v Phase 3 (budoucnost)
✅ NOVÝ PŘÍSTUP: AI integrace v Phase 2 (hned po Inventory)

DŮVOD: Market research jasně ukazuje, že AI je nutností pro 
konkurenceschopnost už v roce 2025, ne volbou do budoucna.
```

### **🎯 AI USE CASES PRO INVENTORY SERVICE:**
1. **Smart Inventory Forecasting** - AI predikce poptávky na základě history objednávek
2. **Automated Reorder Suggestions** - AI doporučení kdy a kolik objednat
3. **Cost Optimization** - AI analýza nákladů na skladování vs. objednávky
4. **Predictive Maintenance** - AI predikce údržby skladového vybavení

## 🤝 KLÍČOVÉ OTÁZKY K PROJEDNÁNÍ (Phase 0)

### **🔍 BUSINESS LOGIKA - MUSÍME SI UJASNIT:**

#### **1. Inventory Management Workflow**
```
❓ JAK PŘESNĚ MÁ FUNGOVAT V REÁLNÉM PROVOZU?

Scenarios k probrání:
- Nová zakázka → rezervace materiálu → jak dlouho držet rezervaci?
- Nedostatek materiálu → automatické upozornění → komu a jak?
- Dokončení zakázky → odpis materiálu → automaticky nebo manuálně?
- Nákup materiálu → jak se přidá do skladu → kdo to schvaluje?
- Vracení materiálu → vrácení do skladu → jak řešit poškozený materiál?
```

#### **2. Integrace s Order Service**
```
❓ PŘESNÝ WORKFLOW KOMUNIKACE:

Order Service ←→ Inventory Service:
- Kdy rezervovat materiál? (při vytvoření zakázky nebo potvrzení?)
- Co když není dostatek materiálu? (blokovat zakázku nebo upozornit?)
- Jak dlouho držet rezervaci? (do dokončení nebo do faktury?)
- Automatické odpisy nebo manuální potvrzení?
```

#### **3. Uživatelské Role a Oprávnění**
```
❓ KDO MÁ PŘÍSTUP K ČEMU?

- Majitel: Vše
- Zaměstnanec: Může prohlížet, rezervovat?
- OSVČ: Může prohlížet své materiály?
- Kdo může upravovat zásoby?
- Kdo schvaluje nákupy?
```

---

## 🏗️ MOŽNÉ ROZDĚLENÍ DO VÍCE RELACÍ

### **VARIANTA A: Inventory Service v jedné RELACI (RELACE 24)**
```
✅ PRO: Rychlé dokončení
❌ PROTI: Vysoká komplexita, riziko chyb
```

### **VARIANTA B: Rozdělení do 2 RELACÍ + AI Foundation**
```
RELACE 24: Basic Inventory + AI-Ready Events
RELACE 25: AI Orchestration Service + Smart Inventory Features

✅ PRO: AI integrace od začátku, competitive advantage
❌ PROTI: Vyšší komplexita
```

### **VARIANTA C: Rozdělení do 3 RELACÍ s AI Postupnou Integrací**
```
RELACE 24: Core Inventory (AI-Ready architecture)
RELACE 25: AI Orchestration Service (základní AI funkce)
RELACE 26: Advanced AI Features (prediktivní analytics)

✅ PRO: Postupná AI integrace, minimize risk
❌ PROTI: Pomalejší AI deployment
```

---

## 🎯 DETAILED IMPLEMENTATION PLAN (PRELIMINARY)

### **Phase 1: Service Architecture & Database Design**
```bash
# Service Setup
- Create inventory-service directory structure
- Initialize package.json with dependencies
- Setup Express.js server with middleware
- Configure PostgreSQL connection
- Create database schema and migrations

# Database Design
- items table (id, name, description, category, unit)
- inventory table (item_id, quantity, location, last_updated)
- stock_movements table (item_id, type, quantity, reason, timestamp)
- suppliers table (id, name, contact_info)
- item_suppliers table (item_id, supplier_id, cost, delivery_time)
```

### **Phase 2: Core CRUD Operations & API Endpoints**
```bash
# Item Management
POST   /api/items              - Create new item
GET    /api/items              - List all items (paginated)
GET    /api/items/:id          - Get item details
PUT    /api/items/:id          - Update item
DELETE /api/items/:id          - Delete item

# Inventory Management  
GET    /api/inventory          - Get current stock levels
GET    /api/inventory/:item_id - Get item stock details
POST   /api/inventory/adjust   - Adjust stock levels
GET    /api/inventory/low      - Get low stock alerts

# Stock Movements
GET    /api/movements          - Get stock movement history
POST   /api/movements          - Record stock movement
GET    /api/movements/:item_id - Get item movement history

# Suppliers
POST   /api/suppliers          - Create supplier
GET    /api/suppliers          - List suppliers
PUT    /api/suppliers/:id      - Update supplier
DELETE /api/suppliers/:id      - Delete supplier
```

### **Phase 3: Integration with Order Service**
```bash
# Order Integration Endpoints
POST   /api/inventory/reserve    - Reserve items for order
POST   /api/inventory/commit     - Commit reserved items
POST   /api/inventory/release    - Release reserved items
GET    /api/inventory/available  - Check item availability

# Business Logic
- Automatic stock deduction on order completion
- Stock reservation system for pending orders
- Low stock notifications
- Reorder point calculations
```

### **Phase 4: Testing & Documentation**
```bash
# Testing
- Unit tests for all business logic
- Integration tests with database
- API endpoint testing
- Order service integration testing

# Documentation
- API documentation
- Database schema documentation
- Integration guide
- Deployment procedures
```

---

## 🗄️ DATABASE SCHEMA DESIGN

### **Items Table**
```sql
CREATE TABLE items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100),
    unit VARCHAR(50) NOT NULL, -- pcs, kg, m, l, etc.
    sku VARCHAR(100) UNIQUE,
    barcode VARCHAR(50),
    min_stock INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### **Inventory Table**
```sql
CREATE TABLE inventory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id UUID REFERENCES items(id) ON DELETE CASCADE,
    quantity DECIMAL(10,3) NOT NULL DEFAULT 0,
    reserved_quantity DECIMAL(10,3) DEFAULT 0,
    location VARCHAR(100),
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(item_id, location)
);
```

### **Stock Movements Table**
```sql
CREATE TABLE stock_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id UUID REFERENCES items(id) ON DELETE CASCADE,
    movement_type VARCHAR(20) NOT NULL, -- IN, OUT, ADJUST, RESERVE, RELEASE
    quantity DECIMAL(10,3) NOT NULL,
    reason VARCHAR(255),
    reference_id UUID, -- order_id, supplier_id, etc.
    reference_type VARCHAR(50), -- order, purchase, adjustment
    created_by UUID, -- user_id
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### **Suppliers Table**
```sql
CREATE TABLE suppliers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    contact_person VARCHAR(255),
    email VARCHAR(255),
    phone VARCHAR(50),
    address TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### **Item Suppliers Table**
```sql
CREATE TABLE item_suppliers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id UUID REFERENCES items(id) ON DELETE CASCADE,
    supplier_id UUID REFERENCES suppliers(id) ON DELETE CASCADE,
    supplier_sku VARCHAR(100),
    cost DECIMAL(10,2),
    delivery_time_days INTEGER,
    is_preferred BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(item_id, supplier_id)
);
```

---

## 🔗 ORDER SERVICE INTEGRATION

### **Integration Points**
```javascript
// Order Service calls Inventory Service
1. Check availability: GET /api/inventory/available
2. Reserve items: POST /api/inventory/reserve
3. Commit reservation: POST /api/inventory/commit
4. Release reservation: POST /api/inventory/release

// Integration Flow
Order Created → Reserve Items → (Order Confirmed) → Commit Items
Order Cancelled → Release Reserved Items
```

### **API Gateway Routes**
```javascript
// Add to API Gateway routing
app.use('/api/inventory', createProxyMiddleware({
    target: 'http://localhost:3004',
    changeOrigin: true,
    pathRewrite: {
        '^/api/inventory': '/api'
    }
}));
```

---

## 🚀 SERVICE CONFIGURATION

### **Port Assignment**
- **Inventory Service:** Port 3004
- **Current Services:**
  - API Gateway: 3000
  - User Service: 3001  
  - Customer Service: 3002
  - Order Service: 3003

### **Environment Variables**
```bash
# Inventory Service
INVENTORY_SERVICE_PORT=3004
SERVICE_NAME=inventory-service
DATABASE_URL=postgresql://username:password@host:5432/inventory_db
JWT_SECRET=[SHARED_SECRET]
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
GOOGLE_CLOUD_PROJECT=[GCP_PROJECT_ID]
```

### **Dependencies**
```json
{
  "dependencies": {
    "express": "^4.19.2",
    "pg": "^8.11.5",
    "bcryptjs": "^2.4.3",
    "jsonwebtoken": "^9.0.2",
    "joi": "^17.12.2",
    "@google-cloud/secret-manager": "^6.1.0",
    "helmet": "^7.1.0",
    "cors": "^2.8.5",
    "morgan": "^1.10.0"
  },
  "devDependencies": {
    "nodemon": "^3.1.10",
    "jest": "^29.7.0",
    "supertest": "^6.3.4"
  }
}
```

---

## ✅ SUCCESS CRITERIA

### **Phase 1 Complete (25%)**
- [x] Service structure created
- [x] Database schema implemented
- [x] Basic server running on port 3004
- [x] Database connection established

### **Phase 2 Complete (65%)**
- [x] All CRUD endpoints implemented
- [x] Input validation working
- [x] Authentication middleware integrated
- [x] Error handling implemented

### **Phase 3 Complete (90%)**
- [x] Order service integration working
- [x] Stock reservation system operational
- [x] API Gateway routing configured
- [x] Cross-service communication tested

### **Phase 4 Complete (100%)**
- [x] Unit tests passing
- [x] Integration tests passing
- [x] Documentation complete
- [x] Service deployment ready

---

## 🔄 CONTINUATION CONTEXT

### **Current Project State**
- **Services Operational:** User (3001), Customer (3002), Order (3003), API Gateway (3000)
- **Security Status:** 0 vulnerabilities (RELACE 20-23 complete)
- **Documentation:** Organized and current
- **Next Service:** Inventory Service (Port 3004)

### **Development Approach**
1. **Incremental Development:** Build and test each phase completely
2. **Integration Testing:** Ensure seamless integration with existing services
3. **Zero Downtime:** Maintain operational services during development
4. **Documentation:** Document as we build, not at the end

### **Key Technical Considerations**
- **Database:** New PostgreSQL database for inventory service
- **Authentication:** Shared JWT secret across all services
- **API Design:** RESTful endpoints consistent with existing services
- **Error Handling:** Standardized error responses
- **Logging:** Consistent logging strategy

---

## 📋 STRUCTURED DECISION FRAMEWORK PRO RELACI 24

### **POVINNÉ KROKY V Phase 0 (PLÁNOVÁNÍ):**

#### **1. ARCHITECTURE REVIEW (10 min)**
```bash
# Prostudovat současnou architekturu
- Přečíst ARCHITECTURE.md
- Pochopit současné služby a jejich komunikaci
- Identifikovat místo Inventory Service v architektuře
```

#### **2. BUSINESS REQUIREMENTS WORKSHOP (20 min)**
```bash
# Projednat každý scenario:
- Real-world workflow zakázky s materiálem
- Uživatelské role a jejich potřeby
- Automatizace vs manuální procesy
- Integration points s Order Service
```

#### **3. IMPLEMENTATION STRATEGY DECISION (10 min)**
```bash
# Rozhodnout o přístupu:
- Jedna RELACE vs více RELACÍ?
- Které funkce jsou MUST-HAVE vs NICE-TO-HAVE?
- Prioritizace features podle business hodnoty
```

#### **4. DETAILED PLAN APPROVAL (5 min)**
```bash
# Finalizovat plán:
- Schválit Phase 1 implementaci
- Definovat success criteria
- Připravit next session tasks (pokud nutné)
```

---

## 🎯 IMMEDIATE NEXT STEPS (RELACE 24 Start)

### **⚠️ POVINNÉ: ZAČNI TÍMTO!**

```
1. PROSTUDUJ ARCHITECTURE.md
   - Pochopit současný systém
   - Identifikovat integration points

2. PROJEDNEJ BUSINESS LOGIKA
   - Scenarios a workflow
   - User roles a permissions
   - Automation vs manual processes

3. ROZHODNI O PŘÍSTUPU
   - Jedna nebo více RELACÍ?
   - Priority funkcí

4. TEPRVE POTOM IMPLEMENTACE
   - Pouze pokud je plán jasný a schválený
```

---

## 🔄 CONTINUATION CONTEXT - AKTUALIZOVANÝ

### **Změna Přístupu:**
- **Předchozí:** Přímá implementace
- **Nový:** Plánování → Implementace
- **Důvod:** Složitost business logiky vyžaduje pečlivé naplánování

### **Success Criteria Pro RELACI 24:**
```
✅ Phase 0 Complete: 
   - Business logika jasně definována
   - Integration workflow schválen
   - Implementation strategy rozhodnuta

✅ Phase 1 Complete (pokud čas dovolí):
   - Service structure created
   - Database schema designed
   - Basic endpoints working
```

---

*RELACE 24: PLÁNOVÁNÍ PRVNÍ! | Strategic Planning & Foundation | Post-Security Upgrade*