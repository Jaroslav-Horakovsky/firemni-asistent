# RELACE 12: ORDER-SERVICE IMPLEMENTATION - COMPLETE MICROSERVICE

## 🎯 **ÚVODNÍ STAV PRO RELACE 12**

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
- **Status**: Nginx plně funkční s routing
- **Routes**: `/api/users/*` → 3001, `/api/customers/*` → 3002
- **Ready**: `/api/orders/*` → 3003 (prepared, commented out)

#### 📦 **Order-Service Foundation - RELACE 11 ✅**
- **Status**: Foundation complete, ready for full implementation
- **Port**: 3003 allocated and configured
- **Structure**: All directories created
- **Config**: package.json, .env, basic app.js with health check

---

## 🎯 **RELACE 12 - ORDER-SERVICE GOALS**

### 📋 **PRIMARY OBJECTIVES:**

#### 1. **Database Schema & Connection** 🗄️
- **Database**: order_db connection and schema creation
- **Tables**: 
  - `orders` - Main order entity with customer reference
  - `order_items` - Line items with product details
  - `order_status_history` - Status change tracking
- **Indexes**: Performance optimization
- **Health Check**: Database connectivity validation

#### 2. **Core Business Logic Implementation** 💼
- **Order Creation**: Validate customer, calculate totals
- **Order Management**: Status updates, item modifications
- **Customer Integration**: Validate customer existence via customer-service
- **Business Rules**: Order workflow, status transitions
- **Data Validation**: Joi schemas for all inputs

#### 3. **Complete RESTful API** 🔌
- **CRUD Operations**: Create, Read, Update, Delete orders
- **Advanced Features**: Pagination, filtering, search
- **Customer Relations**: Get orders by customer
- **Status Management**: Update order status with validation
- **Error Handling**: Proper HTTP status codes and messages

#### 4. **Service Integration** 🔗
- **JWT Authentication**: Shared authentication with other services
- **Customer Validation**: API calls to customer-service
- **API Gateway**: Enable routing via nginx
- **Cross-Service Testing**: Full workflow validation

#### 5. **Production Readiness** 🚀
- **Security**: Rate limiting, input validation, SQL injection protection
- **Documentation**: Swagger API documentation
- **Testing**: Unit tests and integration tests
- **Monitoring**: Proper logging and health checks
- **Performance**: Query optimization and caching

---

## 🗄️ **DATABASE SCHEMA DESIGN**

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

## 🔌 **API ENDPOINTS TO IMPLEMENT**

### Core Order Management:
```javascript
POST   /orders                    // Create new order
GET    /orders                    // List orders (paginated, filterable)
GET    /orders/:id                // Get specific order with items
PUT    /orders/:id                // Update order
DELETE /orders/:id                // Cancel/delete order

// Order items
POST   /orders/:id/items          // Add item to order
PUT    /orders/:id/items/:itemId  // Update order item
DELETE /orders/:id/items/:itemId  // Remove order item

// Status management
PUT    /orders/:id/status         // Update order status
GET    /orders/:id/history        // Get status change history

// Customer relations
GET    /orders/customer/:customerId // Get customer orders

// Statistics and reporting
GET    /orders/stats              // Order statistics
GET    /orders/search             // Advanced search

// Health and utility
GET    /health                    // Service health check
GET    /                          // Service info
```

### Request/Response Examples:
```javascript
// POST /orders - Create Order
{
  "customer_id": "7d5fc01c-fdd6-4cf1-be9f-da5d573c0878",
  "items": [
    {
      "product_name": "Premium Widget",
      "product_description": "High-quality widget",
      "quantity": 2,
      "unit_price": 299.99
    }
  ],
  "shipping_address": {
    "line1": "123 Main St",
    "city": "Prague",
    "postal_code": "10000",
    "country": "Czech Republic"
  },
  "notes": "Please deliver before Friday"
}

// Response:
{
  "success": true,
  "message": "Order created successfully",
  "data": {
    "order": {
      "id": "uuid",
      "order_number": "ORD-2025-001",
      "customer_id": "7d5fc01c-fdd6-4cf1-be9f-da5d573c0878",
      "status": "draft",
      "total_amount": 599.98,
      "created_at": "2025-07-30T17:00:00Z"
    }
  }
}
```

---

## 🔧 **IMPLEMENTATION PATTERNS TO FOLLOW**

### 1. **Copy Proven Architecture from Customer-Service:**
```bash
# Copy and adapt these files:
cp customer-service/src/utils/database.js order-service/src/utils/
cp customer-service/src/utils/jwt.js order-service/src/utils/
cp customer-service/src/middleware/auth.middleware.js order-service/src/middleware/
cp customer-service/src/middleware/validation.middleware.js order-service/src/middleware/

# Update connection strings and table names
# Maintain same security and error handling patterns
```

### 2. **Database Connection Pattern:**
```javascript
// src/utils/database.js - Update for order_db
const connectionString = await secretsManager.getDatabaseUrl('order_service')
// Keep same pooling, health check, and error handling
```

### 3. **JWT Authentication Pattern:**
```javascript
// Same JWT configuration as customer-service
audience: 'firemni-asistent-users'  // Compatible with user-service tokens
```

### 4. **Validation Patterns:**
```javascript
// src/middleware/validation.middleware.js
const createOrderSchema = Joi.object({
  customer_id: Joi.string().uuid().required(),
  items: Joi.array().items(orderItemSchema).min(1).required(),
  shipping_address: addressSchema,
  billing_address: addressSchema.optional(),
  notes: Joi.string().max(2000).optional()
})
```

---

## 🔗 **SERVICE INTEGRATION REQUIREMENTS**

### 1. **Customer Validation:**
```javascript
// Before creating order, validate customer exists
const customerResponse = await fetch(`http://localhost:3002/customers/${customer_id}`, {
  headers: { 'Authorization': `Bearer ${jwt_token}` }
})

if (!customerResponse.ok) {
  throw new Error('Customer not found or invalid')
}
```

### 2. **API Gateway Integration:**
Uncomment and enable in nginx.conf:
```nginx
# Uncomment this route in nginx.conf:
location /api/orders/ {
    proxy_pass http://order_service/orders/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

### 3. **Add to nginx upstream:**
```nginx
upstream order_service {
    server localhost:3003;
}
```

---

## 🧪 **TESTING STRATEGY**

### 1. **Database Tests:**
```bash
# Test order_db connection
curl http://localhost:3003/health
# Should show: database: true
```

### 2. **Integration Tests:**
```bash
# 1. Get JWT token from user-service
TOKEN=$(curl -X POST http://localhost:8080/api/users/auth/login ...)

# 2. Create order referencing existing customer
curl -X POST http://localhost:8080/api/orders/ \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"customer_id":"7d5fc01c-fdd6-4cf1-be9f-da5d573c0878",...}'

# 3. Verify customer relationship
curl http://localhost:8080/api/orders/customer/7d5fc01c-fdd6-4cf1-be9f-da5d573c0878
```

### 3. **Business Logic Tests:**
- Order total calculation accuracy
- Status transition validation
- Customer validation workflow
- Item management operations

---

## 📁 **EXPECTED FILE STRUCTURE AFTER RELACE 12**

```
order-service/
├── src/
│   ├── controllers/
│   │   ├── order.controller.js      # 🆕 Main order operations
│   │   └── orderItem.controller.js  # 🆕 Order item management
│   ├── models/
│   │   ├── order.model.js           # 🆕 Order data model
│   │   └── orderItem.model.js       # 🆕 Order item model
│   ├── routes/
│   │   ├── order.routes.js          # 🆕 Order API routes
│   │   └── index.js                 # 🆕 Route aggregation
│   ├── services/
│   │   ├── order.service.js         # 🆕 Business logic
│   │   ├── customer.service.js      # 🆕 Customer validation
│   │   └── notification.service.js  # 🆕 Future notifications
│   ├── middleware/
│   │   ├── auth.middleware.js       # 🔄 Copy from customer-service
│   │   └── validation.middleware.js # 🔄 Adapt validation schemas
│   ├── utils/
│   │   ├── database.js              # 🔄 Copy and adapt for order_db
│   │   ├── jwt.js                   # 🔄 Copy from customer-service
│   │   └── secrets.js               # 🔄 Copy secret manager utils
│   └── app.js                       # 🔄 Update with full routes
├── package.json                     # ✅ Already configured
├── .env                            # ✅ Already configured
└── README.md                       # 🔄 Update with implementation
```

---

## 🎯 **SUCCESS CRITERIA PRO RELACE 12**

### ✅ **Must-Have Achievements:**
1. **✅ Order-service starts on port 3003** with database connectivity
2. **✅ Database schema created** in order_db with proper indexes
3. **✅ JWT authentication working** with shared tokens from user-service
4. **✅ API Gateway routing** to `/api/orders/*` functional
5. **✅ Basic CRUD operations** for orders implemented and tested
6. **✅ Customer validation** via customer-service API working
7. **✅ Order status workflow** implemented with proper transitions
8. **✅ Integration testing** with all three services passing

### 🎯 **Nice-to-Have Achievements:**
9. **🎯 Advanced filtering and search** functionality
10. **🎯 Order statistics endpoints** for business intelligence
11. **🎯 Swagger documentation** complete
12. **🎯 Unit test coverage** > 80%
13. **🎯 Performance optimization** with sub-100ms response times

---

## ⚠️ **KNOWN CHALLENGES TO EXPECT**

### 1. **Database Schema Complexity**
- **Challenge**: Complex relationships between orders, items, and status history
- **Solution**: Carefully design foreign keys and constraints
- **Testing**: Validate cascade deletes and referential integrity

### 2. **Customer Service Integration**
- **Challenge**: Validating customer existence across services
- **Solution**: Implement proper error handling for customer-service failures
- **Testing**: Test with both valid and invalid customer IDs

### 3. **Order Status Workflow**
- **Challenge**: Ensuring valid status transitions
- **Solution**: Implement state machine pattern
- **Testing**: Test all valid and invalid status transitions

### 4. **Calculation Accuracy**
- **Challenge**: Accurate decimal calculations for money
- **Solution**: Use proper decimal handling, avoid floating point
- **Testing**: Test edge cases with rounding and currency conversion

---

## 📊 **PERFORMANCE TARGETS**

### Response Time Goals:
- **Order creation**: < 200ms
- **Order retrieval**: < 100ms
- **Order listing**: < 150ms
- **Customer orders**: < 200ms

### Resource Limits:
- **Memory usage**: < 100MB
- **Database connections**: < 20 per instance
- **Concurrent requests**: Handle 50+ without degradation

---

## 🚀 **START COMMANDS FOR RELACE 12**

### Development Setup:
```bash
# 1. Install dependencies
cd services/order-service
npm install

# 2. Start development server
npm run dev

# 3. Test basic health
curl http://localhost:3003/health

# 4. Enable API Gateway routing (after implementation)
# Uncomment order routes in nginx.conf and reload nginx
```

### Full System Test:
```bash
# All services running:
# Terminal 1: User service (3001)
# Terminal 2: Customer service (3002)  
# Terminal 3: Order service (3003)
# Terminal 4: API Gateway (8080) - nginx

# Test complete workflow:
curl http://localhost:8080/api/users/auth/login    # Get token
curl http://localhost:8080/api/customers/          # Verify customer exists
curl http://localhost:8080/api/orders/             # Create order
```

---

## 🎉 **MOTIVATION & CONTEXT**

### What RELACE 12 Achieves:
- **Complete Microservices Trio**: user + customer + order services
- **Full Business Workflow**: Authentication → Customer Management → Order Processing
- **Production Architecture**: Ready for real-world deployment
- **Integration Mastery**: All services working together seamlessly

### The Big Picture:
**RELACE 12 completes the core business functionality with order management.**
After this relace, we'll have a complete e-commerce foundation that can handle:
- User registration and authentication
- Customer relationship management  
- Order processing with full lifecycle

### Foundation for Future:
- RELACE 13+: Inventory management, billing, notifications
- Frontend integration: React app with full workflow
- Production deployment: Cloud Run with load balancing
- Business intelligence: Analytics and reporting

---

## 🎯 **IMMEDIATE NEXT ACTIONS PRO RELACE 12**

### Phase 1: **Database Setup (60 min)**
1. Copy database utility from customer-service
2. Create order_db schema with tables and indexes
3. Implement health check with database connectivity
4. Test database operations

### Phase 2: **Core API Implementation (120 min)**  
1. Implement order CRUD operations
2. Add order item management
3. Create customer validation service
4. Implement order status workflow

### Phase 3: **Integration & Testing (60 min)**
1. Enable API Gateway routing
2. Test full workflow with all services
3. Validate customer-order relationships
4. Performance testing and optimization

### Phase 4: **Production Readiness (60 min)**
1. Add comprehensive error handling
2. Implement input validation
3. Add API documentation
4. Final integration testing

---

🚀 **RELACE 12: LET'S BUILD THE COMPLETE ORDER MANAGEMENT SYSTEM!** 🎯

**Ready to transform the foundation into a fully functional order-service that completes our microservices architecture!**