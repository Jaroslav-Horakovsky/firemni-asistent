# Firemní Asistent - Enterprise Business Management Platform

> **All-in-one řešení pro řízení celého businessu - od zaměstnanců po projekty a fakturaci**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen.svg)](https://nodejs.org/)
[![Express.js](https://img.shields.io/badge/Express.js-REST%20API-green.svg)](https://expressjs.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Google%20Cloud-blue.svg)](https://cloud.google.com/sql)
[![Security](https://img.shields.io/badge/Security-0%20Vulnerabilities-green.svg)](./docs/SECURITY_UPGRADE_COMPLETE_REPORT.md)
[![System Status](https://img.shields.io/badge/System-4%20Services%20Operational-brightgreen.svg)](#-současný-stav-systému)

## 🎯 **Vize Projektu**

Kompletní **enterprise business management platforma** pro české firmy. Není to jen e-shop nebo CRM - je to all-in-one řešení pro řízení celého businessu od zaměstnanců přes projekty až po fakturaci.

### **Complete Business Flow**
```
Zákazník → Objednávka → Management schválí → Vytvoří projekt
→ Přiřadí tým (zaměstnanci + externisté) → Pracují na úkolech
→ Zapisují hodiny + materiál + fotky → Management sleduje pokrok
→ Fakturuje zákazníka → Zákazník platí → Projekt uzavřen
```

### **Klíčové Vlastnosti**
- 👥 **Employee Management** - Zaměstnanci, externisté, skillsets, sazby
- 📋 **Project Management** - Úkoly, týmy, time tracking, foto dokumentace  
- 📊 **Complete Workflow** - Od objednávky přes práci po fakturaci
- 🔐 **Enterprise Security** - JWT, mikroslužby, audit logging
- 🚀 **Cloud-native** - PostgreSQL na Google Cloud Platform
- ⚡ **WSL Development** - Optimalizované pro Windows WSL prostředí

---

## 🏗️ **Architektura**

### **Technologický Stack**
```
Frontend:  React + TypeScript + Apollo Client
Desktop:   Electron + React
Mobile:    React Native + TypeScript
Backend:   Node.js + Express.js + REST API
Database:  PostgreSQL (Google Cloud SQL)
Cloud:     Google Cloud Platform
Security:  JWT Authentication, Helmet, Rate Limiting
```

## 🏢 **Současný Stav Systému**

### **Mikroslužby - OPERAČNÍ (4/4)**
| Služba | Port | Status | Databáze | Odpovědnost |
|--------|------|--------|----------|-------------|
| **API Gateway** | 3000 | ✅ HEALTHY | N/A | HTTP routing, CORS, auth middleware |
| **User Service** | 3001 | ✅ HEALTHY | user_db | JWT autentizace, uživatelé, RBAC |
| **Customer Service** | 3002 | ✅ HEALTHY | customer_db | CRUD zákazníci, validation API |
| **Order Service** | 3003 | ⚠️ DEGRADED* | order_db | Complete order workflow + items |

*Order Service = degraded je správné chování (secrets check fail v development)

### **🎯 STRATEGICKÝ ROADMAP (Updated RELACE 27)**
**PRIORITY ZMĚNA: Employee-first approach**

#### **Fáze 1: Employee & Project Management** 🚧 **CURRENT**
- **RELACE 27**: ✅ Employee Service - zaměstnanci, externisté, skillsets
- **RELACE 28**: 📋 Project Service - projekty, přiřazení týmů, task management  
- **RELACE 29**: ⏱️ Timesheet Service - zápis hodin, materiálu, fotodokumentace

#### **Fáze 2: Inventory & Analytics** 🔮 **FUTURE**
- **RELACE 30**: 📦 Inventory Service - skladové zásoby, produktové katalogy
- **RELACE 31**: 📊 Advanced Analytics - reporting, business intelligence
- **RELACE 32**: 🤖 AI Integration - smart recommendations, automation

### **🏗️ COMPLETED FOUNDATION (RELACE 1-26)**
- ✅ **Mikroslužby Architecture** - 4 služby s HTTP komunikací
- ✅ **Database Design** - PostgreSQL per service na Google Cloud  
- ✅ **Security Upgrade** - 0 vulnerabilities (SendGrid v8, Secret Manager v6)
- ✅ **WSL Development** - Stabilní prostředí s recovery postupy
- ✅ **Business Core** - User → Customer → Order workflow kompletní

---

## 📚 **Dokumentace**

| Dokument | Popis |
|----------|-------|
| [**ARCHITECTURE.md**](./ARCHITECTURE.md) | Detailní architektura mikroslužeb a databázový design |
| [**DEVOPS.md**](./DEVOPS.md) | CI/CD, deployment, monitoring strategie |
| [**GRAPHQL_API.md**](./GRAPHQL_API.md) | GraphQL schémata, federation, query examples |
| [**LOGGING.md**](./LOGGING.md) | Comprehensive logging strategie, debugging a observability |
| [**SECURITY.md**](./SECURITY.md) | Bezpečnostní opatření, autentizace, audit |
| [**SCHEMA.md**](./SCHEMA.md) | Databázové schéma a struktura |
| [**Vize_AI_Asistent.md**](./Vize_AI_Asistent.md) | Dlouhodobá vize s AI integrací |
| [**SECURITY_UPGRADE_COMPLETE_REPORT.md**](./SECURITY_UPGRADE_COMPLETE_REPORT.md) | Kompletní bezpečnostní upgrade (6→0 vulnerabilities) |
| [**PRODUCTION_DEPLOYMENT_CHECKLIST.md**](./PRODUCTION_DEPLOYMENT_CHECKLIST.md) | Produkční deployment checklist a postupy |

---

## 🚀 **Quick Start**

### **Prerequisite**
```bash
# Required software
node >= 20.0.0
npm >= 10.0.0
docker >= 24.0.0
docker-compose >= 2.0.0
```

### **1. Clone Repository**
```bash
git clone https://github.com/your-org/firemni-asistent.git
cd firemni-asistent
```

### **2. Setup Environment**
```bash
# Install dependencies for all services
npm install

# Start Docker development environment  
docker-compose -f docker-compose.dev.yml up -d
```

### **3. WSL Environment (Windows)**
```bash
# Ensure WSL Docker integration is working
docker version
systemctl --user start docker-desktop

# If WSL issues occur, see docs/archive/troubleshooting/WSL_RESTART_RECOVERY_SOLUTION.md
```

### **4. Start Development**
```bash
# Start all services in development mode
npm run dev

# Or start individual services
npm run dev:user-service     # Port 3001
npm run dev:customer-service # Port 3002  
npm run dev:order-service    # Port 3003
npm run dev:api-gateway      # Port 3000
```

### **5. Verify Setup**
```bash
# Health check all services
curl http://localhost:3000/health  # API Gateway
curl http://localhost:3001/health  # User Service
curl http://localhost:3002/health  # Customer Service
curl http://localhost:3003/health  # Order Service (expect degraded = OK)
```

### **6. Access Applications**
- **API Gateway**: http://localhost:3000/health
- **Service Endpoints**: http://localhost:3000/api/{service}/health
- **Database**: Direct Google Cloud connections via DATABASE_URL

---

## 📁 **Project Structure**

```
firemni-asistent/
├── 📁 services/                    # Mikroslužby
│   ├── 📁 user-service/            # Správa uživatelů
│   ├── 📁 customer-service/        # Správa zákazníků  
│   ├── 📁 order-service/           # Správa zakázek
│   ├── 📁 inventory-service/       # Správa skladu
│   ├── 📁 billing-service/         # Fakturace
│   └── 📁 notification-service/    # Notifikace
├── 📁 gateway/                     # Apollo Federation Gateway
├── 📁 clients/                     # Klientské aplikace
│   ├── 📁 desktop/                 # Electron app
│   ├── 📁 mobile/                  # React Native app
│   └── 📁 web/                     # Web client
├── 📁 shared/                      # Sdílené knihovny
│   ├── 📁 types/                   # TypeScript definice
│   ├── 📁 utils/                   # Utility funkce
│   └── 📁 constants/               # Konstanty
├── 📁 infrastructure/              # Deployment configs
│   ├── 📁 docker/                  # Docker konfigurace
│   ├── 📁 k8s/                     # Kubernetes manifesty
│   └── 📁 terraform/               # Infrastructure as Code
├── 📁 docs/                        # Dokumentace
└── 📁 scripts/                     # Build & deployment scripty
```

---

## 🔧 **Development**

### **Available Scripts**
```bash
# Development
npm run dev                    # Start all services
npm run dev:services          # Start only backend services
npm run dev:gateway           # Start only API gateway

# Database
npm run db:migrate            # Run migrations
npm run db:generate           # Generate Prisma client
npm run db:seed               # Seed development data
npm run db:reset              # Reset and reseed database

# Testing  
npm run test                  # Run all tests
npm run test:unit             # Unit tests only
npm run test:integration      # Integration tests
npm run test:e2e              # End-to-end tests

# Build & Deploy
npm run build                 # Build all services
npm run build:docker          # Build Docker images
npm run deploy:staging        # Deploy to staging
npm run deploy:production     # Deploy to production

# Code Quality
npm run lint                  # ESLint check
npm run lint:fix              # Fix ESLint issues
npm run type-check            # TypeScript check
npm run format                # Prettier formatting
```

### **Environment Variables**
```bash
# Database
DATABASE_URL="postgresql://user:pass@localhost:5432/db"

# Message Broker
RABBITMQ_URL="amqp://user:pass@localhost:5672"

# Security
JWT_ACCESS_SECRET="your-jwt-access-secret"
JWT_REFRESH_SECRET="your-jwt-refresh-secret"

# External Services
REDIS_URL="redis://localhost:6379"
GOOGLE_CLOUD_PROJECT="your-gcp-project"

# Application
NODE_ENV="development"
LOG_LEVEL="debug"
```

---

## 🧪 **Testing Strategy**

### **Test Types**
- **Unit Tests**: Jest + Supertest pro jednotlivé funkce
- **Integration Tests**: Testování databázových operací a API endpoints
- **E2E Tests**: Cypress pro kompletní user workflows
- **Contract Tests**: Pact pro service-to-service komunikaci

### **Test Commands**
```bash
# Run specific test suites
npm run test:user-service      # Test User Service
npm run test:order-service     # Test Order Service
npm run test:graphql          # Test GraphQL federation

# Coverage reports
npm run test:coverage         # Generate coverage reports
npm run test:coverage:view    # View coverage in browser
```

---

## 🚀 **Deployment**

### **Staging Environment**
```bash
# Deploy to staging
npm run deploy:staging

# Check deployment status
npm run status:staging

# View logs
npm run logs:staging
```

### **Production Deployment**
```bash
# Deploy to production (requires approval)
npm run deploy:production

# Rollback if needed
npm run rollback:production

# Health check
npm run health:production
```

### **Infrastructure**
Aplikace běží na **Google Cloud Platform** využívající:
- **Cloud Run**: Serverless container deployment
- **Cloud SQL**: Managed PostgreSQL
- **Cloud Storage**: File storage
- **Secret Manager**: Secrets management
- **Cloud Monitoring**: Logging & monitoring

---

## 📊 **Monitoring & Observability**

### **Key Metrics**
- Response time < 500ms (P95)
- Uptime > 99.9%
- Error rate < 0.1%
- Database connection pool utilization

### **Dashboards**
- **Application Performance**: Grafana dashboard
- **Business Metrics**: Custom dashboard pro KPIs
- **Infrastructure**: Google Cloud Monitoring
- **Security**: Audit logs a security events

### **Alerting**
```bash
# Setup alerts
npm run setup:alerts

# Test alert systems
npm run test:alerts
```

---

## 🔐 **Security**

### **Security Measures**
- ✅ **Authentication**: JWT tokens s refresh mechanism
- ✅ **Authorization**: Role-based access control (RBAC)
- ✅ **Data Protection**: Encryption at rest and in transit
- ✅ **Input Validation**: Comprehensive Zod schemas
- ✅ **Rate Limiting**: Redis-based rate limiting
- ✅ **Audit Logging**: All security events logged
- ✅ **GDPR Compliance**: Data retention a privacy controls
- ✅ **Package Security**: 0 critical/high vulnerabilities (SendGrid v8, Secret Manager v6)
- ✅ **Vulnerability Management**: Systematic security upgrade methodology

### **Security Scans**
```bash
# Run security audit
npm run security:audit

# Dependency vulnerability check
npm run security:deps

# Docker image scanning
npm run security:images
```

---

## 📈 **Performance**

### **Optimization Features**
- **GraphQL Federation**: Efficient cross-service queries
- **DataLoader**: N+1 query elimination
- **Redis Caching**: Query result caching
- **Database Indexing**: Optimized query performance
- **Connection Pooling**: Efficient database connections

### **Performance Testing**
```bash
# Load testing
npm run perf:load

# Stress testing  
npm run perf:stress

# Memory leak detection
npm run perf:memory
```

---

## 🤝 **Contributing**

### **Development Workflow**
1. Fork repository
2. Create feature branch: `git checkout -b feature/amazing-feature`
3. Make changes with tests
4. Run quality checks: `npm run quality:check`
5. Commit: `git commit -m 'Add amazing feature'`
6. Push: `git push origin feature/amazing-feature`
7. Create Pull Request

### **Code Standards**
- **TypeScript**: Strict mode enabled
- **ESLint**: Airbnb configuration
- **Prettier**: Code formatting
- **Husky**: Pre-commit hooks
- **Conventional Commits**: Commit message format

### **Pull Request Checklist**
- [ ] Tests pass (`npm run test`)
- [ ] Code linted (`npm run lint`)
- [ ] Type checking passes (`npm run type-check`)  
- [ ] Documentation updated
- [ ] Security review completed
- [ ] Performance impact assessed

---

## 🗺️ **Roadmap**

### **Phase 1: Core System** ✅
- [x] Mikroslužby architecture
- [x] Basic CRUD operations
- [x] Authentication & authorization
- [x] Desktop application

### **Phase 2: AI-Ready Foundation + Intelligence** 🚧 **PRIORITA**
- [x] Security upgrade (0 vulnerabilities)
- [ ] **AI Orchestration Service** - Centrální AI integrace
- [ ] **Smart Inventory Service** - AI-powered forecasting
- [ ] **Intelligent Billing** - AI-assisted invoice generation
- [ ] **Predictive Analytics** - Cost prediction & insights
- [ ] Advanced reporting with AI queries

### **Phase 3: Advanced AI Features** 🔮
- [ ] Voice-controlled assistant
- [ ] Automated task scheduling
- [ ] Natural language queries
- [ ] Advanced predictive maintenance

---

## 📞 **Support**

### **Getting Help**
- 📖 **Documentation**: Check docs/ folder
- 🐛 **Bug Reports**: Create GitHub issue
- 💡 **Feature Requests**: GitHub discussions
- 📧 **Email**: support@firemni-asistent.cz

### **Development Team**
- **Architecture**: Lead Developer
- **DevOps**: Cloud Engineer  
- **Security**: Security Specialist
- **UI/UX**: Design Team

---

## 📜 **License**

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 **Acknowledgments**

- **Apollo GraphQL** - Federation framework
- **Prisma** - Database toolkit
- **Fastify** - Web framework
- **Google Cloud** - Cloud platform
- **Open Source Community** - Various libraries and tools

---

<div align="center">

**[⬆ Back to Top](#firemní-asistent---comprehensive-business-management-system)**

Made with ❤️ by the Firemní Asistent Team

</div>