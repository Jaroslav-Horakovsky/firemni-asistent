# RELACE 7: Cloud SQL PostgreSQL & First Microservice Implementation

## 🎯 **AKTUÁLNÍ STAV - RELACE 7 ČÁSTEČNĚ DOKONČENA (29.7.2025)**

### ✅ **FÁZE 1 & 2 KOMPLETNĚ HOTOVÉ:**
- ✅ **Cloud SQL PostgreSQL instance** - `firemni-asistent-db` běží na IP: 34.89.140.144
- ✅ **6 databází vytvořeno** - user_db, customer_db, order_db, inventory_db, billing_db, notification_db
- ✅ **Secret Manager kompletně nakonfigurován** - 10 secrets vytvořeno (DB URLs, JWT keys, API placeholders)
- ✅ **Root password nastaven** - secure password vygenerován a nastaven

### 🚧 **ZBÝVÁ DOKONČIT V PŘÍŠTÍ RELACI:**
- 🎯 **FÁZE 3: User Service Implementation** - připraveno k okamžité implementaci
- 🎯 **FÁZE 4: Docker Compose Setup** - čeká na user-service
- 🎯 **Testing & Validation** - finální ověření funkčnosti

### ✅ **PREREQUISITIES HOTOVÉ:**
- ✅ **System restart** - PATH problémy vyřešeny
- ✅ **Docker Desktop** v28.3.2 s WSL2 integration  
- ✅ **gcloud authentication** - přihlášen jako horakovsky@apimaster.cz
- ✅ **GCP projekt** - firemni-asistent (823474921691) připravený
- ✅ **Service Account** - github-actions-deployer s oprávněními
- ✅ **Workload Identity Federation** - github-actions-pool nakonfigurovaný
- ✅ **Artifact Registry** - firemni-asistent v europe-west3
- ✅ **GCP APIs** - všechny potřebné aktivované

---

## 🗄️ **FÁZE 1: CLOUD SQL POSTGRESQL SETUP**

### Cíl: Vytvořit PostgreSQL instanci s 6 databázemi pro microservices

**Specifikace:**
- **Instance ID:** `firemni-asistent-db`
- **Database Version:** PostgreSQL 15  
- **Region:** `europe-west3` (Frankfurt)
- **Machine Type:** `db-f1-micro` (pro začátek)
- **Storage:** 10GB SSD s auto-resize

**Databáze struktura:**
```sql
-- 6 separate databases pro microservices
CREATE DATABASE user_db;
CREATE DATABASE customer_db;  
CREATE DATABASE order_db;
CREATE DATABASE inventory_db;
CREATE DATABASE billing_db;
CREATE DATABASE notification_db;
```

**Implementace příkazy:**
```bash
# 1. Vytvoření Cloud SQL instance
gcloud sql instances create firemni-asistent-db \
    --database-version=POSTGRES_15 \
    --region=europe-west3 \
    --tier=db-f1-micro \
    --storage-type=SSD \
    --storage-size=10GB \
    --storage-auto-increase

# 2. Nastavení root password
gcloud sql users set-password postgres \
    --instance=firemni-asistent-db \
    --password=[SECURE_PASSWORD]

# 3. Vytvoření databází
gcloud sql databases create user_db --instance=firemni-asistent-db
gcloud sql databases create customer_db --instance=firemni-asistent-db
gcloud sql databases create order_db --instance=firemni-asistent-db
gcloud sql databases create inventory_db --instance=firemni-asistent-db
gcloud sql databases create billing_db --instance=firemni-asistent-db
gcloud sql databases create notification_db --instance=firemni-asistent-db
```

---

## 🔐 **FÁZE 2: SECRET MANAGER SETUP**

### Cíl: Nakonfigurovat Secret Manager s credentials a keys

**Secrets k vytvoření:**
```yaml
# Database connection strings
DB_USER_SERVICE_URL: "postgresql://postgres:[password]@[ip]:5432/user_db"
DB_CUSTOMER_SERVICE_URL: "postgresql://postgres:[password]@[ip]:5432/customer_db"
DB_ORDER_SERVICE_URL: "postgresql://postgres:[password]@[ip]:5432/order_db"
DB_INVENTORY_SERVICE_URL: "postgresql://postgres:[password]@[ip]:5432/inventory_db"
DB_BILLING_SERVICE_URL: "postgresql://postgres:[password]@[ip]:5432/billing_db"
DB_NOTIFICATION_SERVICE_URL: "postgresql://postgres:[password]@[ip]:5432/notification_db"

# Authentication keys
JWT_SIGNING_KEY: "[generated-256-bit-key]"
JWT_REFRESH_KEY: "[generated-256-bit-key]"

# External APIs (placeholders)
SENDGRID_API_KEY: "[placeholder]"  
STRIPE_SECRET_KEY: "[placeholder]"
```

**Implementace příkazy:**
```bash
# Vytvoření secrets
gcloud secrets create DB_USER_SERVICE_URL --data-file=-
gcloud secrets create JWT_SIGNING_KEY --data-file=-
# ... další secrets
```

---

## 🐳 **FÁZE 3: USER-SERVICE IMPLEMENTATION**

### Cíl: První funkční microservice s authentication

**Struktura:**
```
services/user-service/
├── src/
│   ├── app.js                 // Express app setup
│   ├── controllers/
│   │   ├── auth.controller.js // Login, register, token refresh
│   │   └── user.controller.js // User profile management
│   ├── models/
│   │   └── user.model.js      // PostgreSQL user model
│   ├── middleware/
│   │   ├── auth.middleware.js // JWT verification
│   │   └── validation.middleware.js // Input validation
│   ├── routes/
│   │   ├── auth.routes.js     // /auth/* endpoints
│   │   └── user.routes.js     // /users/* endpoints
│   ├── services/
│   │   ├── auth.service.js    // Authentication business logic
│   │   └── user.service.js    // User management logic
│   └── utils/
│       ├── database.js        // PostgreSQL connection
│       ├── secrets.js         // Secret Manager integration  
│       └── jwt.js            // JWT token utilities
├── Dockerfile                 // Multi-stage Docker build
├── package.json              // Dependencies & scripts
└── .env.example              // Environment variables template
```

**Key Features:**
- JWT Authentication s refresh tokens
- PostgreSQL integration s connection pooling
- Input validation s joi/express-validator
- Error handling s structured logging
- Health checks pro monitoring
- OpenAPI documentation s Swagger

---

## 🔧 **FÁZE 4: DOCKER COMPOSE SETUP**

### Cíl: Local development environment

**docker-compose.dev.yml:**
```yaml
version: '3.8'
services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: firemni_asistent_dev
      POSTGRES_USER: dev_user
      POSTGRES_PASSWORD: dev_password
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  user-service:
    build: ./services/user-service
    ports:
      - "3001:3001"  
    environment:
      NODE_ENV: development
      DATABASE_URL: postgresql://dev_user:dev_password@postgres:5432/firemni_asistent_dev
      JWT_SECRET: dev_jwt_secret
    depends_on:
      - postgres
    volumes:
      - ./services/user-service:/app
      - /app/node_modules

volumes:
  postgres_data:
```

---

## 📋 **IMPLEMENTAČNÍ CHECKLIST**

### 🔥 **PRIORITA 1: Cloud SQL** ✅ **HOTOVO**
- [x] Spustit `gcloud sql instances create` příkaz ✅
- [x] Ověřit že instance běží v GCP Console ✅
- [x] Vytvořit 6 databází pomocí gcloud ✅
- [x] Instance: `firemni-asistent-db` (PostgreSQL 15) na IP: 34.89.140.144 ✅
- [x] Databáze: user_db, customer_db, order_db, inventory_db, billing_db, notification_db ✅

### 🔐 **PRIORITA 2: Secret Manager** ✅ **HOTOVO**  
- [x] Vygenerovat secure passwords a JWT keys ✅
- [x] Vytvořit secrets pro všechny database URLs ✅
- [x] Vytvořit secrets pro authentication keys ✅
- [x] 10 secrets vytvořeno: 6x DB URLs, 2x JWT keys, 2x placeholder API keys ✅

### 🐳 **PRIORITA 3: User Service** 🚧 **PŘIPRAVENO K IMPLEMENTACI**
- [ ] Vytvořit základní Express.js strukturu
- [ ] Implementovat PostgreSQL connection s Secret Manager
- [ ] Vytvořit authentication endpoints (register, login)
- [ ] Implementovat JWT middleware
- [ ] Přidat health check endpoints
- [ ] **Poznámka**: Struktura podle specifikace níže, Secret Manager připraven

### 🔧 **PRIORITA 4: Docker Setup** 🚧 **ČEKÁ NA USER-SERVICE**
- [ ] Vytvořit Dockerfile pro user-service
- [ ] Vytvořit docker-compose.dev.yml
- [ ] Otestovat local development setup
- [ ] Ověřit že vše funguje together

---

## 🎯 **ÚSPĚŠNÁ KRITÉRIA RELACE 7**

### ✅ **MUSÍ BÝT SPLNĚNO:**
1. Cloud SQL PostgreSQL instance běží s 6 databázemi
2. Secret Manager obsahuje všechny potřebné credentials  
3. user-service funguje locally s Docker Compose
4. Authentication flow: register, login, token refresh funguje
5. Database integration: users table, CRUD operations
6. Health check endpoints odpovídají

### 🚀 **BONUSOVÉ CÍLE:**
- API documentation s Swagger/OpenAPI
- Input validation s comprehensive error handling
- Logging integration s structured logs
- Performance monitoring hooks

---

## 🛠️ **TECH STACK POTVRZENÍ**

**Backend:** Node.js + Express.js  
**Database:** PostgreSQL (Cloud SQL)  
**Authentication:** JWT  
**Password Hashing:** bcryptjs  
**Validation:** joi  
**Container:** Docker + Docker Compose  
**Cloud:** Google Cloud Platform  
**Development:** VSCode + WSL2 + Ubuntu  

---

## 🔥 **KRITICKÉ INFORMACE PRO POKRAČOVÁNÍ**

### 📊 **SOUČASNÝ STAV INFRASTRUKTURY:**
```yaml
Cloud SQL Instance:
  - Name: firemni-asistent-db
  - Type: PostgreSQL 15
  - IP: 34.89.140.144
  - Status: RUNNABLE ✅
  - Root Password: [SECURE_PASSWORD_SET] (viz CREDENTIALS_LOCAL.md)

Databáze (6 kusů):
  - user_db ✅
  - customer_db ✅  
  - order_db ✅
  - inventory_db ✅
  - billing_db ✅
  - notification_db ✅

Secret Manager (10 secrets):
  - DB_USER_SERVICE_URL ✅
  - DB_CUSTOMER_SERVICE_URL ✅
  - DB_ORDER_SERVICE_URL ✅
  - DB_INVENTORY_SERVICE_URL ✅
  - DB_BILLING_SERVICE_URL ✅
  - DB_NOTIFICATION_SERVICE_URL ✅
  - JWT_SIGNING_KEY ✅
  - JWT_REFRESH_KEY ✅
  - SENDGRID_API_KEY (placeholder) ✅
  - STRIPE_SECRET_KEY (placeholder) ✅
```

### 🎯 **OKAMŽITÝ NEXT STEP PRO PŘÍŠTÍ RELACI:**
1. **Vytvořit user-service strukturu** podle specifikace níže
2. **Implementovat Secret Manager integration** pro database přístup
3. **Základní Express.js app** s PostgreSQL connectionem
4. **Authentication endpoints** - register, login, JWT
5. **Docker Compose** pro local development

### 🛠️ **PŘIPRAVENÉ NÁSTROJE:**
- Docker Desktop v28.3.2 běží s WSL2 ✅
- gcloud SDK 532.0.0 authenticated ✅
- GCP projekt: firemni-asistent připraven ✅
- Všechny prerequisities z RELACE 6 hotové ✅

**🚀 READY TO CONTINUE: User-service implementation může začít okamžitě!** 🎯