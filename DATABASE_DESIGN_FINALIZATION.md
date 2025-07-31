# 🗄️ DATABASE DESIGN FINALIZATION - KRITICKÁ FÁZE

## 🎯 **ÚČEL TOHOTO DOKUMENTU**

**PŘED přechodem na frontend development MUSÍME:**
1. ✅ Dokončit všechny backend funkcionalitu (zbývající 15%)
2. 🔍 Kompletně přezkoumat database design
3. 🛠️ Implementovat změny pro budoucí flexibilitu  
4. ✅ Otestovat a validovat finální strukturu
5. 🔒 "Zamknout" database schéma pro production

**PROČ TO DĚLÁME TEĎKA:**
- Database změny v produkci = nightmare složitosti
- Frontend + Mobile + Backend musí být v synchronizaci
- Lepší strávit týden teďka než měsíc v produkci

---

## 📊 **SOUČASNÝ STAV DATABASE SCHEMAS**

### **USER_DB (✅ Stabilní - změny nepravděpodobné)**
```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    role VARCHAR(50) DEFAULT 'user',
    is_active BOOLEAN DEFAULT true,
    email_verified BOOLEAN DEFAULT false,
    last_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### **CUSTOMER_DB (⚠️ Potřebuje review)**
```sql
CREATE TABLE customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_name VARCHAR(255) NOT NULL,
    contact_person VARCHAR(255),
    email VARCHAR(255),
    phone VARCHAR(50),
    address_line1 VARCHAR(255),
    address_line2 VARCHAR(255),  
    city VARCHAR(100),
    postal_code VARCHAR(20),
    country VARCHAR(100) DEFAULT 'Czech Republic',
    tax_id VARCHAR(50),
    vat_id VARCHAR(50),
    payment_terms INTEGER DEFAULT 14,
    credit_limit DECIMAL(12,2) DEFAULT 0.00,
    is_active BOOLEAN DEFAULT true,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### **ORDER_DB (🚨 Kritický review - hlavní business logic)**
```sql
-- Orders table
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_number VARCHAR(50) UNIQUE NOT NULL,
    customer_id UUID NOT NULL REFERENCES customers(id),
    status order_status_enum DEFAULT 'draft',
    subtotal DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    tax_amount DECIMAL(12,2) DEFAULT 0.00,
    shipping_amount DECIMAL(12,2) DEFAULT 0.00,
    discount_amount DECIMAL(12,2) DEFAULT 0.00,
    total_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    currency VARCHAR(3) DEFAULT 'CZK',
    
    -- Addresses
    billing_address_line1 VARCHAR(255),
    billing_address_line2 VARCHAR(255),
    billing_city VARCHAR(100),
    billing_postal_code VARCHAR(20),
    billing_country VARCHAR(100),
    
    shipping_address_line1 VARCHAR(255),
    shipping_address_line2 VARCHAR(255),
    shipping_city VARCHAR(100),
    shipping_postal_code VARCHAR(20),
    shipping_country VARCHAR(100),
    
    -- Metadata
    notes TEXT,
    internal_notes TEXT,
    payment_method VARCHAR(50),
    payment_due_date DATE,
    
    -- Audit
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    CONSTRAINT positive_subtotal CHECK (subtotal >= 0),
    CONSTRAINT positive_total CHECK (total_amount >= 0),
    CONSTRAINT valid_currency CHECK (currency IN ('CZK', 'EUR', 'USD'))
);

-- Order items
CREATE TABLE order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_name VARCHAR(255) NOT NULL,
    product_description TEXT,
    product_sku VARCHAR(100),
    quantity INTEGER NOT NULL,
    unit_price DECIMAL(12,2) NOT NULL,
    total_price DECIMAL(12,2) NOT NULL,
    tax_rate DECIMAL(5,2) DEFAULT 0.00,
    
    -- Product metadata (future inventory integration)
    product_category VARCHAR(100),
    product_unit VARCHAR(20) DEFAULT 'pcs',
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints  
    CONSTRAINT positive_quantity CHECK (quantity > 0),
    CONSTRAINT positive_unit_price CHECK (unit_price >= 0),
    CONSTRAINT positive_total_price CHECK (total_price >= 0)
);

-- Order status history
CREATE TABLE order_status_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    old_status order_status_enum,
    new_status order_status_enum NOT NULL,
    changed_by UUID REFERENCES users(id),
    change_reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## 🔍 **BUSINESS REQUIREMENTS REVIEW**

### **KLÍČOVÉ OTÁZKY PRO DESIGN:**

#### **1. ORDERS & BUSINESS LOGIC:**
- [ ] **Podporujeme jen CZK nebo i EUR/USD?** → Ovlivní currency logic
- [ ] **Potřebujeme slevy na úrovni objednávky nebo itemu?** → Discount structure
- [ ] **Jak složité budou daně?** → Tax calculation complexity
- [ ] **Budou recurring objednávky?** → Subscription model
- [ ] **Potřebujeme approval workflow?** → Order approval process

#### **2. CUSTOMERS & CRM:**
- [ ] **Budou B2B i B2C zákazníci?** → Customer type differentiation
- [ ] **Potřebujeme customer hierarchy?** → Parent/child companies
- [ ] **Jaké kontakty per customer?** → Multiple contacts per company
- [ ] **Customer segments/categories?** → Marketing & pricing tiers
- [ ] **Customer history tracking?** → Interaction logs

#### **3. PRODUCTS & INVENTORY:**
- [ ] **Jak komplexní bude product catalog?** → Product variations, bundles
- [ ] **Sledování inventory?** → Stock levels, reservations
- [ ] **Product categories/hierarchies?** → Classification system
- [ ] **Digital vs physical products?** → Fulfillment differences
- [ ] **Product pricing tiers?** → Customer-specific pricing

#### **4. BUSINESS WORKFLOWS:**
- [ ] **Invoice generation process?** → Billing integration
- [ ] **Payment tracking?** → Payment status, partial payments
- [ ] **Shipping integration?** → Tracking numbers, carriers
- [ ] **Returns/refunds process?** → Reverse logistics
- [ ] **Reporting requirements?** → Analytics & KPIs

---

## 🛠️ **FLEXIBILITA & FUTURE-PROOFING STRATEGIES**

### **1. METADATA COLUMNS (Immediate Implementation):**
```sql
-- Přidat do všech hlavních tabulek:
ALTER TABLE customers ADD COLUMN metadata JSONB DEFAULT '{}';
ALTER TABLE orders ADD COLUMN metadata JSONB DEFAULT '{}';
ALTER TABLE order_items ADD COLUMN metadata JSONB DEFAULT '{}';
ALTER TABLE users ADD COLUMN metadata JSONB DEFAULT '{}';

-- Indexy pro rychlé JSONB queries:
CREATE INDEX idx_customers_metadata ON customers USING GIN (metadata);
CREATE INDEX idx_orders_metadata ON orders USING GIN (metadata);
```

**Výhoda:** Můžeme přidávat nová pole bez database migration!
```javascript
// Místo ALTER TABLE:
customer.metadata = { priority: 'high', segment: 'enterprise', tags: ['vip'] }
```

### **2. AUDIT TRAIL SYSTEM:**
```sql
-- Universal audit table pro všechny změny:
CREATE TABLE audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_name VARCHAR(100) NOT NULL,
    record_id UUID NOT NULL,
    action VARCHAR(20) NOT NULL, -- INSERT, UPDATE, DELETE
    old_values JSONB,
    new_values JSONB,
    changed_by UUID REFERENCES users(id),
    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Pro rychlé vyhledávání:
    INDEX idx_audit_table_record (table_name, record_id),
    INDEX idx_audit_changed_by (changed_by),
    INDEX idx_audit_changed_at (changed_at)
);
```

### **3. VERSIONING SYSTEM:**
```sql
-- Pro kritické entity (orders, customers):
ALTER TABLE orders ADD COLUMN version INTEGER DEFAULT 1;
ALTER TABLE customers ADD COLUMN version INTEGER DEFAULT 1;

-- Version history table:
CREATE TABLE entity_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID NOT NULL,
    version INTEGER NOT NULL,
    data JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(entity_type, entity_id, version)
);
```

### **4. CONFIGURATION SYSTEM:**
```sql
-- Pro business rules které se můžou měnit:
CREATE TABLE system_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    config_key VARCHAR(100) UNIQUE NOT NULL,
    config_value JSONB NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Příklady:
INSERT INTO system_config (config_key, config_value, description) VALUES
('tax_rates', '{"standard": 21, "reduced": 15}', 'DPH sazby'),
('currencies', '["CZK", "EUR", "USD"]', 'Podporované měny'),
('order_statuses', '["draft", "pending", "confirmed", "processing", "shipped", "delivered", "cancelled"]', 'Stavy objednávek'),
('payment_methods', '["bank_transfer", "card", "cash", "invoice"]', 'Způsoby platby');
```

---

## 📋 **AKČNÍ PLÁN - DATABASE FINALIZATION**

### **FÁZE 1: DOKONČENÍ SOUČASNÉ FUNKCIONALITY (1 týden)**
- [ ] **Opravit order creation bug** (Relace 13 priorita)
- [ ] **Kompletní backend testing** všech CRUD operací
- [ ] **Performance testing** databázových operací
- [ ] **Security audit** všech API endpoints

### **FÁZE 2: BUSINESS REQUIREMENTS GATHERING (2-3 dny)**
- [ ] **Projít business otázky** výše s vámi (majitelem)
- [ ] **Definovat missing requirements** pro production
- [ ] **Prioritizovat features** podle důležitosti
- [ ] **Dokumentovat business rules** pro implementaci

### **FÁZE 3: DATABASE ENHANCEMENT (3-4 dny)**
- [ ] **Implementovat metadata columns** pro flexibilitu
- [ ] **Přidat audit trail system** pro tracking změn
- [ ] **Setup configuration system** pro business rules
- [ ] **Enhance indexy** pro performance
- [ ] **Add foreign key constraints** kde chybí

### **FÁZE 4: MIGRATION SYSTEM SETUP (2 dny)**
- [ ] **Install migration tools** (Knex.js nebo Sequelize)
- [ ] **Create baseline migrations** pro současný stav
- [ ] **Setup migration scripts** pro development/production
- [ ] **Document migration process** pro tým

### **FÁZE 5: FINAL VALIDATION (2 dny)**
- [ ] **Load testing** s reálnými objemy dat
- [ ] **Business logic validation** se všemi workflows
- [ ] **Backup/restore testing** pro disaster recovery
- [ ] **Documentation update** pro production readiness

---

## 🔒 **SCHEMA FREEZE CRITERIA**

**DATABASE SCHÉMA SMÍME "ZAMKNOUT" TEPRVE KDYŽ:**

### ✅ **TECHNICAL CRITERIA:**
- [ ] Všechny backend API endpoints fungují 100%
- [ ] Performance je pod 200ms pro 95% queries
- [ ] Všechny foreign key constraints správně nastavené
- [ ] Indexy pokrývají všechny často používané queries
- [ ] Backup/restore process otestován

### ✅ **BUSINESS CRITERIA:**  
- [ ] Všechny core business workflows implementované
- [ ] Tax calculation logic odpovídá požadavkům
- [ ] Order status transitions pokrývají všechny scénáře
- [ ] Customer management má všechny potřebné fieldy
- [ ] Reporting requirements jsou splněné

### ✅ **FUTURE-PROOFING CRITERIA:**
- [ ] Metadata columns pro flexibilitu přidané
- [ ] Audit trail system implementovaný
- [ ] Configuration system pro business rules
- [ ] Migration system připravený
- [ ] Versioning strategy definovaná

---

## 🚨 **WARNING SIGNS - NESCHVÁLIT FREEZE POKUD:**

- ❌ Jakýkoliv core workflow nefunguje
- ❌ Performance problémy (>500ms response times)
- ❌ Chybí kritické business fieldy
- ❌ Database design neodpovídá business processům
- ❌ Žádný migration strategy
- ❌ Nejasné business requirements

---

## 🎯 **SUCCESS METRICS PRO SCHEMA FREEZE**

```
📊 MUSÍME DOSÁHNOUT:
├── 🚀 API Response Times: <200ms (95th percentile)
├── 🧪 Test Coverage: >90% pro business logic
├── 🔍 Business Validation: 100% core workflows
├── 📋 Documentation: Complete API + database docs
├── 🛡️ Security: All endpoints properly secured
├── 🔄 Migration: Automated migration system ready
└── 💾 Backup: Disaster recovery plan tested
```

---

## 📝 **NEXT STEPS - IMMEDIATE ACTIONS**

### **1. RELACE 13 (Immediate - tento týden):**
- Opravit order creation bug
- Complete backend functionality testing

### **2. BUSINESS REQUIREMENTS SESSION (příští týden):**
- Projít všechny business otázky v tomto dokumentu
- Definovat missing requirements
- Prioritizovat features pro MVP

### **3. DATABASE ENHANCEMENT (týden poté):**
- Implementovat flexibilitu features
- Setup migration system  
- Final performance optimization

### **4. SCHEMA FREEZE DECISION (3 týdny od teď):**
- GO/NO-GO rozhodnutí pro frontend development
- Kompletní business & technical validation
- Production readiness assessment

---

**🎯 ZÁVĚR: Investice 2-3 týdnů teďka = ušetření 2-3 měsíců problémů v produkci!**

**Toto je jedna z nejdůležitějších fází celého projektu. Lepší být opatrný teďka než řešit problémy později.** 🛡️