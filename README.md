# Firemní Asistent - Comprehensive Business Management System

> **Inteligentní řešení pro správu zakázek, evidence práce a automatickou fakturaci**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)
[![GraphQL](https://img.shields.io/badge/GraphQL-Federation%20v2-e10098.svg)](https://www.apollographql.com/docs/federation/)

## 🎯 **Přehled Projektu**

Firemní Asistent je moderní, škálovatelná business aplikace navržená pro komplexní správu firemních procesů. Systém automatizuje evidenci práce, správu materiálu, výpočet nákladů a generování faktur s důrazem na efektivitu a přesnost.

### **Klíčové Vlastnosti**
- 📋 **Komplexní správa zakázek** - Od vytvoření po fakturaci
- 👥 **Multi-role systém** - Majitel, Zaměstnanci, OSVČ
- 📊 **Real-time analýzy** - Náklady, ziskovost, výkonnost
- 🤖 **Automatická fakturace** - Event-driven generování faktur
- 📱 **Cross-platform klienti** - Desktop (Electron) + Mobile (React Native)
- 🔐 **Enterprise security** - JWT, RBAC, audit logging
- 🚀 **Cloud-native** - Mikroslužby na Google Cloud Platform

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

### **Mikroslužby - SOUČASNÝ STAV**
| Služba | Port | Status | Odpovědnost |
|--------|------|--------|-------------|
| **User Service** | 3001 | ✅ FUNKČNÍ | JWT autentizace, uživatelé, RBAC |
| **Customer Service** | 3002 | ✅ FUNKČNÍ | CRUD zákazníci, validation API |
| **Order Service** | 3003 | ✅ FUNKČNÍ | Complete order workflow + items |
| **API Gateway** | 8080 | ✅ FUNKČNÍ | Nginx routing, CORS, auth |

### **🎯 DEVELOPMENT PROGRESS**
- **RELACE 15**: ✅ Complete microservices architecture (85% implemented)
- **RELACE 16**: 🚀 Infrastructure Foundation (External APIs, Payment, Email)
- **RELACE 17**: 📋 Business Features (Advanced workflows)
- **RELACE 18**: 📊 Analytics & Reporting
- **RELACE 19**: 🚀 Production Deployment

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
# Copy environment templates
cp .env.example .env.local

# Install dependencies for all services
npm run install:all

# Setup local databases
docker-compose up -d postgres rabbitmq redis
```

### **3. Database Setup**
```bash
# Run migrations for all services
npm run db:migrate

# Seed development data
npm run db:seed
```

### **4. Start Development**
```bash
# Start all services in development mode
npm run dev

# Or start individual services
npm run dev:user-service
npm run dev:order-service
npm run dev:gateway
```

### **5. Access Applications**
- **API Gateway**: http://localhost:3000/graphql
- **GraphQL Playground**: http://localhost:3000
- **Database Admin**: http://localhost:8080 (Adminer)
- **RabbitMQ Management**: http://localhost:15672

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

### **Phase 2: Advanced Features** 🚧
- [ ] Mobile application
- [ ] Advanced reporting
- [ ] Integration APIs
- [ ] File management

### **Phase 3: AI Intelligence** 🔮
- [ ] Intelligent cost prediction
- [ ] Voice-controlled assistant
- [ ] Automated task scheduling
- [ ] Predictive analytics

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