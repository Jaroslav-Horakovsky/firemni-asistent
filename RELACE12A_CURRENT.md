# RELACE 12A: ORDER-SERVICE DATABASE & CORE IMPLEMENTATION

## 🎯 **ÚVODNÍ STAV PRO RELACE 12A**

### ✅ **CO MÁME 100% HOTOVÉ Z RELACE 11:**

#### 🔐 **User-Service (Port 3001) - RELACE 9 ✅**
- **Status**: 100% funkční, production-ready
- **Database**: user_db s real test user UUID: `b84024f3-6321-4956-9ef8-9f666d96069d`
- **Test Login**: email: `testuser@example.com`, password: `Zx9#K$m2pL8@nQ4vR`
- **JWT**: Generuje tokeny s audience `firemni-asistent-users`

#### 👥 **Customer-Service (Port 3002) - RELACE 10 ✅**
- **Status**: 100% funkční, production-ready
- **Database**: customer_db s 1 test zákazníkem ID: `7d5fc01c-fdd6-4cf1-be9f-da5d573c0878`
- **Features**: Complete CRUD + Statistics + Search/Filtering
- **JWT**: Akceptuje tokeny s audience `firemni-asistent-users`

#### 🚪 **API Gateway (Port 8080) - RELACE 11 ✅**
- **Status**: Nginx plně funkční s routing pro user + customer services
- **Routes**: `/api/users/*` → 3001, `/api/customers/*` → 3002
- **Ready**: `/api/orders/*` → 3003 (prepared, commented out)

#### 📦 **Order-Service Foundation - RELACE 11 ✅**
- **Status**: Foundation complete, ready for implementation
- **Port**: 3003 allocated and configured
- **Structure**: All directories created, package.json, .env, basic app.js

---

## 🎯 **RELACE 12A - OBJECTIVES (PHASE 1)**

### 📋 **PRIMARY GOALS FOR 12A:**

#### 1. **Database Schema & Connection** 🗄️ **[MAIN FOCUS]**
- **Database**: order_db connection and complete schema creation
- **Tables**: orders, order_items, order_status_history
- **Indexes**: Performance optimization
- **Health Check**: Database connectivity validation

#### 2. **Core Infrastructure Setup** 💼
- **Utils**: Copy and adapt database.js, jwt.js, secrets.js from customer-service
- **Middleware**: Copy auth and validation middleware
- **Basic Structure**: Prepare controllers, models, services directories

#### 3. **Basic Order Model & Health Check** 🔌
- **Order Model**: Basic order data structure
- **Health Endpoint**: Full health check with database validation
- **Foundation API**: Basic app.js with proper structure

#### 4. **Preparation for 12B** 🔗
- **Code Structure**: All files ready for API implementation
- **Database**: All tables created and tested
- **Dependencies**: All utilities working and tested

---

## 🗄️ **DATABASE SCHEMA DESIGN [CRITICAL FOR 12A]**

### Orders Table:
```sql
CREATE TYPE order_status_enum AS ENUM (
    'draft',
    'pending', 
    'confirmed',
    'processing',
    'shipped',
    'delivered',
    'cancelled',
    'refunded'
);

CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_number VARCHAR(50) UNIQUE NOT NULL,
    customer_id UUID NOT NULL, -- Reference to customer-service
    status order_status_enum DEFAULT 'draft',
    
    -- Financial data
    subtotal DECIMAL(12,2) NOT NULL DEFAULT 0,
    tax_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
    shipping_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
    discount_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
    total_amount DECIMAL(12,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'CZK',
    
    -- Shipping information
    shipping_address_line1 VARCHAR(255),
    shipping_address_line2 VARCHAR(255),
    shipping_city VARCHAR(100),
    shipping_postal_code VARCHAR(20),
    shipping_country VARCHAR(100) DEFAULT 'Czech Republic',
    
    -- Billing information  
    billing_address_line1 VARCHAR(255),
    billing_address_line2 VARCHAR(255),
    billing_city VARCHAR(100),
    billing_postal_code VARCHAR(20),
    billing_country VARCHAR(100) DEFAULT 'Czech Republic',
    
    -- Metadata
    notes TEXT,
    internal_notes TEXT,
    expected_delivery_date DATE,
    
    -- Audit fields
    created_by UUID, -- User who created the order
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT positive_subtotal CHECK (subtotal >= 0),
    CONSTRAINT positive_total CHECK (total_amount >= 0),
    CONSTRAINT valid_currency CHECK (currency IN ('CZK', 'EUR', 'USD'))
);

CREATE TABLE order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    
    -- Product information (denormalized for history)
    product_id VARCHAR(100), -- Future reference to inventory-service
    product_name VARCHAR(255) NOT NULL,
    product_description TEXT,
    product_sku VARCHAR(100),
    
    -- Pricing
    quantity INTEGER NOT NULL,
    unit_price DECIMAL(10,2) NOT NULL,
    total_price DECIMAL(10,2) NOT NULL,
    
    -- Metadata
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT positive_quantity CHECK (quantity > 0),
    CONSTRAINT positive_unit_price CHECK (unit_price >= 0),
    CONSTRAINT positive_total_price CHECK (total_price >= 0),
    CONSTRAINT calculated_total CHECK (total_price = quantity * unit_price)
);

CREATE TABLE order_status_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    previous_status order_status_enum,
    new_status order_status_enum NOT NULL,
    changed_by UUID, -- User who changed the status
    change_reason TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Indexes for Performance:
```sql
-- Orders indexes
CREATE INDEX idx_orders_customer_id ON orders(customer_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created_at ON orders(created_at);
CREATE INDEX idx_orders_order_number ON orders(order_number);

-- Order items indexes  
CREATE INDEX idx_order_items_order_id ON order_items(order_id);
CREATE INDEX idx_order_items_product_id ON order_items(product_id);

-- Status history indexes
CREATE INDEX idx_order_status_history_order_id ON order_status_history(order_id);
CREATE INDEX idx_order_status_history_created_at ON order_status_history(created_at);
```

---

## 🔧 **IMPLEMENTATION PATTERNS TO FOLLOW [12A FOCUS]**

### 1. **Copy Proven Architecture from Customer-Service:**
```bash
# EXACTLY THESE FILES TO COPY AND ADAPT IN 12A:
cp services/customer-service/src/utils/database.js services/order-service/src/utils/
cp services/customer-service/src/utils/jwt.js services/order-service/src/utils/
cp services/customer-service/src/utils/secrets.js services/order-service/src/utils/
cp services/customer-service/src/middleware/auth.middleware.js services/order-service/src/middleware/
cp services/customer-service/src/middleware/validation.middleware.js services/order-service/src/middleware/

# Update connection strings and table names
# Maintain same security and error handling patterns
```

### 2. **Database Connection Pattern [CRITICAL FOR 12A]:**
```javascript
// src/utils/database.js - Update for order_db
const connectionString = await secretsManager.getDatabaseUrl('order_service')
// Keep same pooling, health check, and error handling

// MUST TEST: Database connectivity and table creation
// MUST VERIFY: All constraints and indexes working
```

### 3. **JWT Authentication Pattern:**
```javascript
// Same JWT configuration as customer-service
audience: 'firemni-asistent-users'  // Compatible with user-service tokens
```

### 4. **Basic Order Model [12A DELIVERABLE]:**
```javascript
// src/models/order.model.js - Basic structure
class Order {
  constructor(data) {
    this.id = data.id
    this.order_number = data.order_number
    this.customer_id = data.customer_id
    this.status = data.status || 'draft'
    this.total_amount = data.total_amount
    // ... other fields
  }
  
  // Basic validation methods
  validate() {
    // Validation logic
  }
}
```

---

## 🧪 **TESTING STRATEGY FOR 12A**

### 1. **Database Connection Tests:**
```bash
# MUST PASS in 12A:
cd services/order-service
npm install
npm run dev

# Test basic health check
curl http://localhost:3003/health
# Should show: database: true, secrets: true, jwt: true
```

### 2. **Database Schema Tests:**
```bash
# Connect to order_db and verify:
# 1. All tables created
# 2. All indexes exist
# 3. Constraints working
# 4. Sample data insert/select works
```

### 3. **Integration Compatibility Tests:**
```bash
# Verify existing services still work:
curl http://localhost:3001/health  # user-service
curl http://localhost:3002/health  # customer-service
curl http://localhost:8080/        # API Gateway

# JWT compatibility test:
TOKEN=$(curl -s -X POST http://localhost:3001/auth/login -d '{"email":"testuser@example.com","password":"Zx9#K$m2pL8@nQ4vR"}')
# Verify token can be validated by order-service JWT utils
```

---

## 📁 **EXPECTED FILE STRUCTURE AFTER RELACE 12A**

```
order-service/
├── src/
│   ├── controllers/
│   │   └── [empty - ready for 12B]
│   ├── models/
│   │   └── order.model.js           # 🆕 Basic order data model
│   ├── routes/
│   │   └── [empty - ready for 12B]
│   ├── services/
│   │   └── [empty - ready for 12B]
│   ├── middleware/
│   │   ├── auth.middleware.js       # 🔄 Copy from customer-service
│   │   └── validation.middleware.js # 🔄 Copy from customer-service
│   ├── utils/
│   │   ├── database.js              # 🔄 Copy and adapt for order_db
│   │   ├── jwt.js                   # 🔄 Copy from customer-service
│   │   └── secrets.js               # 🔄 Copy secret manager utils
│   └── app.js                       # 🔄 Update with database health check
├── package.json                     # ✅ Already configured
├── .env                            # ✅ Already configured
└── README.md                       # 🔄 Update with 12A progress
```

---

## 🎯 **SUCCESS CRITERIA PRO RELACE 12A**

### ✅ **Must-Have Achievements for 12A:**
1. **✅ Order-service starts on port 3003** with full database connectivity
2. **✅ Database schema created** in order_db with all tables and indexes
3. **✅ JWT authentication working** with shared tokens (compatibility tested)
4. **✅ All utility files copied** and adapted from customer-service
5. **✅ Health check endpoint** returns database: true, secrets: true, jwt: true
6. **✅ Basic order model** implemented and tested
7. **✅ Development environment** fully prepared for 12B API implementation
8. **✅ Existing services** still working (no regression)

### 🔄 **12A Deliverables Summary:**
- **Database**: order_db with complete schema and indexes
- **Infrastructure**: All utils, middleware, and basic models ready
- **Health Check**: Full connectivity validation working
- **Compatibility**: JWT and service integration verified
- **Foundation**: Complete structure ready for 12B API implementation

---

## ⚠️ **KNOWN CHALLENGES FOR 12A**

### 1. **Database Schema Complexity**
- **Challenge**: Complex relationships and constraints
- **Solution**: Test each table creation individually
- **Validation**: Run constraint tests with sample data

### 2. **Environment Configuration**
- **Challenge**: order_db connection string configuration
- **Solution**: Copy exact patterns from customer-service
- **Testing**: Verify Secret Manager fallback works

### 3. **JWT Compatibility**
- **Challenge**: Ensuring token compatibility across services
- **Solution**: Use exact same audience and keys as customer-service
- **Testing**: Cross-service token validation

---

## 📊 **PERFORMANCE TARGETS FOR 12A**

### Response Time Goals:
- **Health check**: < 70ms (same as other services)
- **Database queries**: < 50ms
- **Service startup**: < 5 seconds

### Resource Limits:
- **Memory usage**: < 60MB (basic service without API)
- **Database connections**: < 5 connections (health check only)

---

## 🚀 **DEVELOPMENT PLAN FOR 12A (180 min total)**

### Phase 1: **Infrastructure Setup (60 min)**
1. Copy utility files from customer-service
2. Adapt database.js for order_db connection
3. Update JWT and secrets configuration
4. Test basic service startup

### Phase 2: **Database Implementation (90 min)**
1. Create complete database schema
2. Add all indexes and constraints
3. Test database connectivity and operations
4. Implement health check with database validation

### Phase 3: **Structure Preparation (30 min)**
1. Create basic order model
2. Prepare directory structure for 12B
3. Update app.js with proper health check
4. Final testing and validation

---

## 🎯 **TRANSITION TO RELACE 12B**

### 📋 **What 12A Completes:**
- ✅ **Database**: Complete schema with all tables and indexes
- ✅ **Infrastructure**: All utility files and middleware ready
- ✅ **Health Check**: Full service health validation
- ✅ **Foundation**: Order-service fully prepared for API implementation

### 📋 **What 12B Will Implement:**
- 🔄 **API Endpoints**: Complete RESTful API for orders
- 🔄 **Customer Integration**: API calls to customer-service
- 🔄 **Business Logic**: Order creation, status management
- 🔄 **API Gateway**: Enable nginx routing to order-service
- 🔄 **Integration Testing**: Full workflow with all services

### 🔗 **Context Transfer to 12B:**
After 12A completion, order-service will have:
- Database fully operational with complete schema
- All infrastructure code ready and tested
- Health check returning database: true
- JWT authentication compatible with other services
- Complete foundation ready for immediate API implementation

---

## 🎉 **RELACE 12A - FOUNDATION & DATABASE IMPLEMENTATION**

**Goal**: Create solid database foundation and infrastructure for order-service

**Success Metric**: Order-service starts on port 3003 with database: true health check

**Preparation for 12B**: Complete API implementation on top of solid database foundation

---

🚀 **RELACE 12A: BUILD THE DATABASE FOUNDATION FOR ORDER-SERVICE!** 🎯

**Focus**: Database schema, infrastructure setup, and health validation - preparing perfect foundation for 12B API implementation!