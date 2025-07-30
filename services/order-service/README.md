# Order Service - Foundation

## 🎯 Status: FOUNDATION READY FOR RELACE 12

Order management microservice for Firemní Asistent system.

## 📁 Current Structure

```
order-service/
├── src/
│   ├── controllers/     # (Empty - ready for RELACE 12)
│   ├── models/         # (Empty - ready for RELACE 12)
│   ├── routes/         # (Empty - ready for RELACE 12)
│   ├── services/       # (Empty - ready for RELACE 12)
│   ├── middleware/     # (Empty - ready for RELACE 12)
│   ├── utils/          # (Empty - ready for RELACE 12)
│   └── app.js          # ✅ Basic server with health check
├── package.json        # ✅ Dependencies configured
├── .env               # ✅ Environment variables ready
└── README.md          # ✅ This file
```

## 🚀 Quick Start (Foundation Test)

```bash
# Install dependencies (when ready for RELACE 12)
cd services/order-service
npm install

# Start development server (basic health check only)
npm run dev

# Test foundation
curl http://localhost:3003/health
```

## 🔧 Configuration

- **Port**: 3003
- **Database**: order_db (to be connected in RELACE 12)  
- **JWT**: Shared keys with user-service and customer-service
- **Environment**: Development mode ready

## 📋 RELACE 12 Implementation Plan

### 1. Database Schema Design
- Orders table with customer relationships
- Order items with product references
- Order status tracking
- Payment information

### 2. Core Features to Implement
- ✅ Order creation with customer validation
- ✅ Order status management (pending, confirmed, processing, shipped, delivered, cancelled)
- ✅ Order item management
- ✅ Order history and tracking
- ✅ Integration with customer-service

### 3. API Endpoints to Create
- `POST /orders` - Create new order
- `GET /orders` - List orders with pagination
- `GET /orders/:id` - Get specific order
- `PUT /orders/:id` - Update order
- `DELETE /orders/:id` - Cancel order  
- `GET /orders/customer/:customerId` - Get customer orders
- `PUT /orders/:id/status` - Update order status

### 4. Business Logic Requirements
- Validate customer exists before creating order
- Calculate order totals automatically
- Handle inventory checks (future integration)
- Order status workflow validation
- Audit trail for order changes

### 5. Integration Points
- **Customer Service**: Validate customer existence
- **User Service**: JWT authentication
- **Inventory Service**: Stock validation (future)
- **Billing Service**: Payment processing (future)

## 🏗️ Architecture Patterns to Follow

Based on successful patterns from user-service and customer-service:

### Database Connection
- Copy `src/utils/database.js` from customer-service
- Update connection string to use `DB_ORDER_SERVICE_URL`
- Implement connection pooling and health checks

### JWT Authentication  
- Copy `src/utils/jwt.js` from customer-service
- Copy `src/middleware/auth.middleware.js`
- Use same JWT audience: `firemni-asistent-users`

### Validation & Security
- Copy `src/middleware/validation.middleware.js`
- Implement Joi schemas for order validation
- Use same security patterns (helmet, rate limiting)

### API Structure
- Follow RESTful patterns from customer-service
- Implement proper error handling
- Add Swagger documentation
- Use consistent response formats

## 🔗 Service Integration

### API Gateway Routes (Ready)
```nginx
# Future route in nginx.conf
location /api/orders/ {
    proxy_pass http://order_service/orders/;
    # ... standard proxy headers
}
```

### Database Schema Preview
```sql
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL,
    order_number VARCHAR(50) UNIQUE NOT NULL,
    status order_status_enum DEFAULT 'pending',
    total_amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'CZK',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    -- Foreign key to customer-service (validation via API)
    CONSTRAINT positive_total CHECK (total_amount >= 0)
);

CREATE TABLE order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_name VARCHAR(255) NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price DECIMAL(10,2) NOT NULL CHECK (unit_price >= 0),
    total_price DECIMAL(10,2) NOT NULL CHECK (total_price >= 0),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

## 📊 Success Metrics for RELACE 12

- ✅ Order service starts on port 3003
- ✅ Database connection to order_db successful
- ✅ JWT integration with user-service working
- ✅ API Gateway routing to /api/orders/ functional
- ✅ Basic CRUD operations for orders working
- ✅ Customer-order relationship validation
- ✅ Order status workflow implementation
- ✅ Full integration testing with all services

## 🎯 Ready for RELACE 12 Implementation!

This foundation provides:
- ✅ Proper project structure
- ✅ Environment configuration  
- ✅ Basic Express server setup
- ✅ Health check endpoint
- ✅ Security middleware configured
- ✅ Package.json with all dependencies
- ✅ Clear implementation roadmap

**Next Step**: RELACE 12 will implement the full order management system following proven patterns from user-service and customer-service.