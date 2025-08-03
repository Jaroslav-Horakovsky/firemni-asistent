# 🔧 PRODUCTION ENVIRONMENT VARIABLES

**Document Status:** Production Ready  
**Last Updated:** 2025-08-02  
**Security Level:** Secure Configuration Required

---

## 📋 ENVIRONMENT VARIABLES OVERVIEW

### **Required for All Services**
```bash
# Application Environment
NODE_ENV=production
LOG_LEVEL=info

# JWT Authentication (SHARED SECRET)
JWT_SECRET=[SECURE_SECRET_REQUIRED]
JWT_ACCESS_TOKEN_EXPIRY=15m
JWT_REFRESH_TOKEN_EXPIRY=7d
```

---

## 🚀 SERVICE-SPECIFIC CONFIGURATION

### **API Gateway (Port 3000)**
```bash
# Service Configuration
API_GATEWAY_PORT=3000
SERVICE_NAME=api-gateway

# Authentication
JWT_SECRET=[SHARED_SECRET]

# SendGrid v8 Email Configuration (UPGRADED)
SENDGRID_API_KEY=[SENDGRID_API_KEY_REQUIRED]
FROM_EMAIL=noreply@yourdomain.com

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# CORS Configuration
ALLOWED_ORIGINS=https://yourdomain.com,https://app.yourdomain.com
```

### **User Service (Port 3001)**
```bash
# Service Configuration
USER_SERVICE_PORT=3001
SERVICE_NAME=user-service

# Database Connection
DATABASE_URL=postgresql://username:password@host:5432/users_db
DB_HOST=localhost
DB_PORT=5432
DB_NAME=users_db
DB_USER=[DATABASE_USER]
DB_PASSWORD=[DATABASE_PASSWORD]

# Authentication
JWT_SECRET=[SHARED_SECRET]

# Secret Manager v5 Configuration
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
GOOGLE_CLOUD_PROJECT=[GCP_PROJECT_ID]
```

### **Customer Service (Port 3002)**
```bash
# Service Configuration
CUSTOMER_SERVICE_PORT=3002
SERVICE_NAME=customer-service

# Database Connection
DATABASE_URL=postgresql://username:password@host:5432/customers_db
DB_HOST=localhost
DB_PORT=5432
DB_NAME=customers_db
DB_USER=[DATABASE_USER]
DB_PASSWORD=[DATABASE_PASSWORD]

# Authentication
JWT_SECRET=[SHARED_SECRET]

# Secret Manager v5 Configuration
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
GOOGLE_CLOUD_PROJECT=[GCP_PROJECT_ID]
```

### **Order Service (Port 3003)**
```bash
# Service Configuration
ORDER_SERVICE_PORT=3003
SERVICE_NAME=order-service

# Database Connection
DATABASE_URL=postgresql://username:password@host:5432/orders_db
DB_HOST=localhost
DB_PORT=5432
DB_NAME=orders_db
DB_USER=[DATABASE_USER]
DB_PASSWORD=[DATABASE_PASSWORD]

# Authentication
JWT_SECRET=[SHARED_SECRET]

# Secret Manager v6 Configuration (UPGRADED)
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
GOOGLE_CLOUD_PROJECT=[GCP_PROJECT_ID]

# Business Logic
ORDER_EXPIRY_DAYS=30
MAX_ORDER_ITEMS=50
```

---

## 🔐 SECRET MANAGEMENT

### **Google Cloud Secret Manager v6**
```bash
# Production Secrets (stored in Secret Manager)
DB_PASSWORD -> projects/[PROJECT]/secrets/db-password/versions/latest
JWT_SECRET -> projects/[PROJECT]/secrets/jwt-secret/versions/latest
SENDGRID_API_KEY -> projects/[PROJECT]/secrets/sendgrid-api-key/versions/latest

# Service Account Configuration
GOOGLE_APPLICATION_CREDENTIALS=/etc/secrets/service-account.json
GOOGLE_CLOUD_PROJECT=[YOUR_GCP_PROJECT_ID]
```

### **Secret Naming Convention**
```bash
# Pattern: [service]-[environment]-[secret-type]
user-service-prod-db-password
api-gateway-prod-sendgrid-key
shared-prod-jwt-secret
order-service-prod-db-password
customer-service-prod-db-password
```

---

## 🗄️ DATABASE CONFIGURATION

### **PostgreSQL Connection Settings**
```bash
# Production Database Configuration
DB_HOST=your-production-db-host.com
DB_PORT=5432
DB_SSL=true
DB_POOL_MIN=2
DB_POOL_MAX=10
DB_TIMEOUT=30000
DB_IDLE_TIMEOUT=600000

# Connection URLs (for services using DATABASE_URL)
USER_DB_URL=postgresql://[USER]:[PASSWORD]@[HOST]:5432/users_production
CUSTOMER_DB_URL=postgresql://[USER]:[PASSWORD]@[HOST]:5432/customers_production
ORDER_DB_URL=postgresql://[USER]:[PASSWORD]@[HOST]:5432/orders_production
```

### **Connection Pool Settings**
```bash
# Recommended production settings
PGPOOL_MIN_SIZE=2
PGPOOL_MAX_SIZE=10
PGPOOL_IDLE_TIMEOUT=600000
PGPOOL_CONNECTION_TIMEOUT=30000
```

---

## 📧 EMAIL CONFIGURATION (SendGrid v8)

### **SendGrid Settings**
```bash
# SendGrid API Configuration (UPGRADED to v8)
SENDGRID_API_KEY=[YOUR_SENDGRID_API_KEY]
FROM_EMAIL=noreply@yourdomain.com
FROM_NAME="Firemní Asistent"

# Email Templates
WELCOME_TEMPLATE_ID=d-[TEMPLATE_ID]
ORDER_CONFIRMATION_TEMPLATE_ID=d-[TEMPLATE_ID]
ORDER_STATUS_UPDATE_TEMPLATE_ID=d-[TEMPLATE_ID]

# Email Configuration
EMAIL_QUEUE_ENABLED=true
EMAIL_RETRY_ATTEMPTS=3
EMAIL_RETRY_DELAY=5000
```

---

## 🔒 SECURITY CONFIGURATION

### **Security Headers & Settings**
```bash
# Security Configuration
HELMET_ENABLED=true
CORS_ENABLED=true
RATE_LIMITING_ENABLED=true

# Helmet Configuration
CSP_ENABLED=true
HSTS_ENABLED=true
NOSNIFF_ENABLED=true

# CORS Settings
CORS_ORIGIN=https://yourdomain.com
CORS_CREDENTIALS=true
CORS_METHODS=GET,POST,PUT,DELETE,OPTIONS
```

### **Rate Limiting**
```bash
# Rate Limiting Configuration
RATE_LIMIT_WINDOW_MS=900000  # 15 minutes
RATE_LIMIT_MAX_REQUESTS=100
RATE_LIMIT_SKIP_SUCCESSFUL_REQUESTS=false
RATE_LIMIT_HEADERS=true
```

---

## 🏥 HEALTH CHECK CONFIGURATION

### **Health Check Settings**
```bash
# Health Check Configuration
HEALTH_CHECK_ENABLED=true
HEALTH_CHECK_TIMEOUT=5000
DB_HEALTH_CHECK_ENABLED=true
EXTERNAL_API_HEALTH_CHECK_ENABLED=true

# Health Check Endpoints
HEALTH_ENDPOINT=/health
READY_ENDPOINT=/ready
LIVE_ENDPOINT=/live
```

---

## 📊 MONITORING & LOGGING

### **Logging Configuration**
```bash
# Logging Settings
LOG_LEVEL=info
LOG_FORMAT=json
LOG_TIMESTAMP=true

# Application Monitoring
APM_ENABLED=true
METRICS_ENABLED=true
TRACING_ENABLED=true

# Google Cloud Monitoring
MONITORING_PROJECT_ID=[GCP_PROJECT_ID]
MONITORING_ENABLED=true
```

---

## 🚀 DEPLOYMENT CONFIGURATION

### **Container/Cloud Run Settings**
```bash
# Container Configuration
PORT=8080  # Cloud Run default
TIMEOUT=300
MAX_INSTANCES=100
MIN_INSTANCES=1
CPU=1
MEMORY=512Mi

# Cloud Run Specific
CLOUD_RUN_SERVICE_NAME=[SERVICE_NAME]
CLOUD_RUN_REGION=us-central1
CLOUD_RUN_ALLOW_UNAUTHENTICATED=false
```

### **Build & Deployment**
```bash
# Build Configuration
BUILD_ENV=production
OPTIMIZE=true
MINIFY=true
SOURCE_MAPS=false

# Deployment Configuration
DEPLOYMENT_STRATEGY=rolling
ROLLBACK_ENABLED=true
BLUE_GREEN_ENABLED=false
```

---

## ✅ ENVIRONMENT VALIDATION CHECKLIST

### **Pre-Deployment Validation**
```bash
# Critical Environment Variables Check
[ ] JWT_SECRET is set and secure (minimum 32 characters)
[ ] Database credentials are configured via Secret Manager
[ ] SendGrid API key is valid and configured
[ ] Google Cloud credentials are properly mounted
[ ] All service ports are correctly configured
[ ] CORS origins match production domains
[ ] Rate limiting is appropriately configured
[ ] SSL/TLS is enabled for all external connections
```

### **Security Validation**
```bash
# Security Environment Check
[ ] No hardcoded secrets in environment variables
[ ] All secrets stored in Google Cloud Secret Manager
[ ] Service account has minimum required permissions
[ ] Database connections use SSL
[ ] HTTPS is enforced for all external communications
[ ] Security headers are properly configured
[ ] Authentication is required for all protected endpoints
```

### **Service Integration Validation**
```bash
# Service Communication Check
[ ] All services can communicate with each other
[ ] Database connections are working for all services
[ ] JWT tokens are properly shared across services
[ ] Health check endpoints are responding
[ ] External API integrations are functional
[ ] Email service is operational
[ ] Monitoring and logging are capturing data
```

---

## 🚨 TROUBLESHOOTING ENVIRONMENT ISSUES

### **Common Configuration Problems**

#### **1. Secret Manager Access Issues**
```bash
# Check service account permissions
gcloud projects add-iam-policy-binding [PROJECT_ID] \
  --member="serviceAccount:[SA_EMAIL]" \
  --role="roles/secretmanager.secretAccessor"

# Test secret access
gcloud secrets access-versions --secret=[SECRET_NAME] latest
```

#### **2. Database Connection Problems**
```bash
# Verify database connectivity
psql $DATABASE_URL -c "SELECT 1;"

# Check connection pool settings
# Ensure PGPOOL_MAX_SIZE is appropriate for load
```

#### **3. SendGrid Email Issues**
```bash
# Test SendGrid API key
curl -X POST https://api.sendgrid.com/v3/mail/send \
  -H "Authorization: Bearer $SENDGRID_API_KEY" \
  -H "Content-Type: application/json"
```

#### **4. JWT Authentication Problems**
```bash
# Verify JWT secret consistency across services
# All services must use the same JWT_SECRET
# Check secret length (minimum 32 characters recommended)
```

---

## 📞 SUPPORT & ESCALATION

### **Environment Configuration Support**
- **DevOps Team:** [Contact Information]
- **Security Team:** [Contact Information]  
- **Database Admin:** [Contact Information]
- **Cloud Infrastructure:** [Contact Information]

### **Emergency Configuration Recovery**
- **Backup Secrets Location:** [Location/Documentation]
- **Recovery Procedures:** [Reference Documentation]
- **Rollback Configuration:** [Previous Environment Backup]

---

*Production Environment Variables Configuration | Security Upgrade Project | Version 1.0*