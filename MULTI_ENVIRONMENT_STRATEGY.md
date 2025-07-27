# Multi-Environment Strategy - Firemní Asistent

## 🎯 Overview

Kompletní multi-environment deployment strategie pro **Firemní Asistent** s automated promotion pipeline implementovaná v **RELACE 2C**. Poskytuje bezpečnou a škálovatelnou cestu od development přes staging až do production s automated testing a manual approval gates.

## 📋 Environment Isolation Strategy

### Environment Architecture

```
Development ──→ Staging ──→ Production
     ↓             ↓            ↓
   Testing     Integration   Manual
              Performance   Approval
```

## 🌍 Environment Configurations

### Development Environment (`dev`)
- **Purpose**: Rychlá iterace a debugging
- **Domain**: `dev.firemni-asistent.cz`
- **Project**: `firemni-asistent-dev`
- **Auto-deploy**: ✅ Push na `develop` branch
- **Resource allocation**: Minimální (cost optimization)
- **Features**: Debug logging, experimental features enabled

**Key Characteristics:**
- Min instances: 0 (scale to zero)
- Max instances: 3
- CPU: 0.5-1 cores
- Memory: 256Mi-512Mi
- Database: `db-f1-micro`
- SSL: Optional (allow HTTP)
- Monitoring: Debug level logging

### Staging Environment (`staging`)
- **Purpose**: Pre-production testing a validation
- **Domain**: `staging.firemni-asistent.cz`
- **Project**: `firemni-asistent-staging`
- **Auto-deploy**: ✅ Push na `staging` branch
- **Resource allocation**: Production-like
- **Features**: Full integration testing, canary deployments

**Key Characteristics:**
- Min instances: 1 (always-on)
- Max instances: 8
- CPU: 1-2 cores
- Memory: 512Mi-1Gi
- Database: `db-g1-small`
- SSL: Enforced
- Monitoring: INFO level logging
- Testing: Load testing, E2E testing, security scanning

### Production Environment (`prod`)
- **Purpose**: Live production workloads
- **Domain**: `firemni-asistent.cz`
- **Project**: `firemni-asistent-prod`
- **Auto-deploy**: ❌ Manual approval required
- **Resource allocation**: High-availability
- **Features**: Blue-green deployment, disaster recovery

**Key Characteristics:**
- Min instances: 3 (high availability)
- Max instances: 20
- CPU: 2-4 cores
- Memory: 1Gi-2Gi
- Database: `db-n1-standard-2` with regional HA
- SSL: Enforced with modern ciphers
- Monitoring: WARN level logging
- Security: WAF, DDoS protection, compliance

## 🚀 Automated Promotion Pipeline

### GitHub Actions Workflow

**File**: `.github/workflows/multi-environment-deployment.yml`

#### Pipeline Stages

1. **Environment Detection** 🎯
   - Detects target environment from branch
   - Sets deployment parameters
   - Determines auto-deploy vs manual approval

2. **Code Quality & Security** 🔍
   - Linting and type checking
   - Unit tests with coverage
   - Security dependency scan
   - SAST security analysis

3. **Terraform Validation** ✅
   - Format checking
   - Configuration validation
   - Plan dry-run across all environments

4. **Environment Deployment** 🚀
   - **Development**: Auto-deploy with smoke tests
   - **Staging**: Canary deployment with integration tests
   - **Production**: Blue-green with manual approval

#### Deployment Strategies by Environment

```yaml
Development:
  Strategy: Direct deployment
  Testing: Smoke tests
  Rollback: Immediate
  
Staging:
  Strategy: Canary (10% → 100%)
  Testing: Integration + Performance + E2E
  Rollback: Automated on failure
  
Production:
  Strategy: Blue-Green
  Testing: Health checks + Monitoring
  Rollback: Manual control
  Approval: Required
```

## 🛠️ Management Tools

### 1. Deployment Script (`scripts/terraform/deploy.sh`)

**Usage:**
```bash
# Development deployment
./scripts/terraform/deploy.sh dev apply

# Staging with custom variables
./scripts/terraform/deploy.sh staging apply --var-file=custom.tfvars

# Production planning (manual approval required)
./scripts/terraform/deploy.sh prod plan

# Workspace management
./scripts/terraform/deploy.sh dev workspace list
```

**Features:**
- Environment-specific safety checks
- Terraform workspace management
- Automated project selection
- Production deployment safeguards

### 2. Environment Manager (`scripts/terraform/environment-manager.sh`)

**Usage:**
```bash
# Status overview
./scripts/terraform/environment-manager.sh status

# Health checking
./scripts/terraform/environment-manager.sh health --environment=staging

# Promotion pipeline
./scripts/terraform/environment-manager.sh promote dev staging
./scripts/terraform/environment-manager.sh promote staging prod

# Environment comparison
./scripts/terraform/environment-manager.sh compare dev prod
```

**Features:**
- Comprehensive status monitoring
- Automated promotion workflows
- Environment health checking
- Configuration comparison
- Resource cleanup

## 📂 Directory Structure

```
terraform/
├── environments/           # Environment-specific configurations
│   ├── dev/
│   │   ├── backend.tf     # GCS backend for dev
│   │   ├── main.tf        # Module orchestration
│   │   ├── variables.tf   # Input variables
│   │   └── terraform.tfvars # Environment values
│   ├── staging/
│   │   ├── backend.tf     # GCS backend for staging
│   │   ├── main.tf        # Module orchestration
│   │   ├── variables.tf   # Input variables
│   │   └── terraform.tfvars # Environment values
│   └── prod/
│       ├── backend.tf     # Encrypted GCS backend
│       ├── main.tf        # Module orchestration
│       ├── variables.tf   # Input variables
│       └── terraform.tfvars # Environment values
├── modules/               # Shared Terraform modules
│   ├── secrets/          # Secret Manager integration
│   ├── registry/         # Artifact Registry
│   ├── iam/             # Identity and Access Management
│   ├── storage/         # Cloud Storage
│   ├── cloud-run/       # Cloud Run services
│   ├── load-balancer/   # Global Load Balancer
│   ├── monitoring/      # OpenTelemetry monitoring
│   └── databases/       # Cloud SQL databases
└── scripts/
    └── terraform/
        ├── deploy.sh           # Deployment automation
        └── environment-manager.sh # Environment management
```

## 🔐 Security & Compliance

### Environment Isolation

1. **Project Separation**
   - Separate GCP projects per environment
   - Isolated IAM policies and service accounts
   - Network-level segregation

2. **Secret Management**
   - Environment-specific Secret Manager instances
   - Separate encryption keys per environment
   - Automated secret rotation

3. **Access Control**
   - Role-based access control (RBAC)
   - Multi-factor authentication (MFA) for production
   - Audit logging for all environments

### Compliance Features

- **GDPR Compliance**: Data residency in EU, retention policies
- **SOC2 Compliance**: Audit trails, access controls, monitoring
- **Security Scanning**: SAST, DAST, dependency vulnerability scanning
- **Encryption**: At-rest and in-transit encryption for all environments

## 📊 Monitoring & Observability

### Per-Environment Monitoring

**Development:**
- Debug-level logging
- 100% trace sampling
- Basic metrics collection
- No alerting (cost optimization)

**Staging:**
- INFO-level logging
- 10% trace sampling
- Full metrics with alerting
- Performance monitoring
- Synthetic monitoring

**Production:**
- WARN-level logging
- 1% trace sampling
- Comprehensive SLA monitoring
- Business metrics tracking
- 24/7 alerting with PagerDuty integration

### Business Metrics Integration

- **Order Velocity**: Tracking order processing rates
- **User Activity**: Active user monitoring
- **Inventory Pressure**: Stock level monitoring
- **Revenue Metrics**: Real-time business KPI tracking

## 🚦 Deployment Gates & Quality Assurance

### Development Gates
- ✅ Code linting passes
- ✅ Unit tests pass
- ✅ Basic smoke tests pass

### Staging Gates
- ✅ All development gates
- ✅ Integration tests pass
- ✅ Performance tests meet thresholds
- ✅ Security scans clean
- ✅ 80% test coverage minimum
- ✅ Canary deployment healthy

### Production Gates
- ✅ All staging gates
- ✅ Staging environment stable for 24+ hours
- ✅ Manual approval from tech lead
- ✅ Business stakeholder approval
- ✅ Change management process completed
- ✅ 90% test coverage minimum
- ✅ Blue-green deployment validation

## 📈 Performance & Scaling

### Auto-Scaling Configuration

**Development:**
```yaml
Min Instances: 0 (cost optimization)
Max Instances: 3
CPU Target: 70%
Memory Target: 80%
```

**Staging:**
```yaml
Min Instances: 1 (consistent testing)
Max Instances: 8
CPU Target: 60%
Memory Target: 70%
```

**Production:**
```yaml
Min Instances: 3 (high availability)
Max Instances: 20
CPU Target: 50%
Memory Target: 60%
Business Metrics: Enabled
```

### Business-Metrics-Based Scaling

Production environment využívá pokročilé business-metrics-based scaling implementované v **DEVOPS.md**:

- **Order Velocity Scaling**: Proactive scaling před anticipated traffic
- **User Activity Scaling**: Scaling based on active user patterns
- **Inventory Pressure Scaling**: Scaling during high-demand periods
- **Predictive Scaling**: ML-based traffic prediction a pre-scaling

## 🔄 Disaster Recovery

### Backup Strategy

**Development:**
- No automatic backups (cost optimization)
- Infrastructure as Code recovery

**Staging:**
- Daily database backups (7-day retention)
- Weekly full environment snapshots

**Production:**
- Hourly database backups (30-day retention)
- Cross-region replication
- Point-in-time recovery capability
- Infrastructure backup to secondary region

### Recovery Targets

- **RTO (Recovery Time Objective)**: 4 hours
- **RPO (Recovery Point Objective)**: 1 hour
- **Multi-region failover**: Manual (with automation scripts ready)

## 🎮 Operation Procedures

### Daily Operations

1. **Morning Check** (Automated)
   ```bash
   ./scripts/terraform/environment-manager.sh status
   ./scripts/terraform/environment-manager.sh health
   ```

2. **Development Deployment**
   ```bash
   # Push to develop branch triggers automatic deployment
   git push origin develop
   ```

3. **Staging Promotion**
   ```bash
   # Push to staging branch or manual promotion
   ./scripts/terraform/environment-manager.sh promote dev staging
   ```

4. **Production Deployment** (Manual)
   ```bash
   # Requires manual approval and validation
   ./scripts/terraform/environment-manager.sh promote staging prod
   ```

### Emergency Procedures

1. **Emergency Rollback**
   ```bash
   # Immediate rollback to previous stable version
   ./scripts/terraform/deploy.sh prod apply --auto-approve --target=module.cloud_run
   ```

2. **Circuit Breaker Override**
   ```bash
   # Emergency circuit breaker bypass (temporary)
   gcloud run services update-env-vars SERVICE_NAME --set-env-vars CIRCUIT_BREAKER_DISABLED=true
   ```

3. **Emergency Scale-up**
   ```bash
   # Immediate capacity increase
   gcloud run services update SERVICE_NAME --min-instances=10 --max-instances=50
   ```

## 📚 Integration s Existing Architecture

### Resilience Patterns Integration

Multi-environment strategy je plně integrována s resilience patterns z **ARCHITECTURE.md**:

- **Circuit Breakers**: Konzistentní konfigurace napříč environments s environment-specific thresholds
- **Health Checks**: `/live` a `/ready` endpoints pro všechny environments
- **Graceful Degradation**: Fallback strategies přizpůsobené pro každé environment

### DevOps Integration

Napojení na advanced automation z **DEVOPS.md**:

- **Business Metrics Scaling**: Aktivní pouze v production
- **ML-based Monitoring**: Postupné zavedení dev → staging → prod
- **OpenTelemetry**: Konzistentní monitoring stack napříč všemi environments

## ✅ Success Metrics

### Deployment Success Rate
- **Target**: >99% successful deployments
- **Current**: Baseline establishment in progress

### Lead Time
- **Development**: <10 minutes (code to deployment)
- **Staging**: <30 minutes (including testing)
- **Production**: <2 hours (including approvals)

### Mean Time to Recovery (MTTR)
- **Development**: <5 minutes
- **Staging**: <15 minutes  
- **Production**: <1 hour

### Environment Availability
- **Development**: >95% (cost-optimized)
- **Staging**: >99% (testing reliability)
- **Production**: >99.9% (SLA requirement)

## 🔮 Future Enhancements

### Planned Improvements

1. **Chaos Engineering Integration** (RELACE 2C Priority #3)
   - Controlled failure injection testing
   - Automated resilience validation
   - Circuit breaker stress testing

2. **Advanced Security Scanning** (RELACE 2C Priority #4)
   - SAST/DAST integration in pipeline
   - Automated vulnerability patching
   - Compliance automation

3. **GitOps Enhancement**
   - ArgoCD integration for declarative deployments
   - Config drift detection
   - Automated remediation

4. **Multi-Cloud Strategy**
   - AWS backup region setup
   - Cross-cloud disaster recovery
   - Vendor lock-in mitigation

---

## 📊 RELACE 2C - Completion Summary

**STATUS**: **✅ 100% DOKONČENO** - Multi-Environment Strategy implementována

### 🎯 Dokončené Komponenty:

1. **✅ Environment Isolation** - Dev/Staging/Production separation
2. **✅ Terraform Workspaces** - Infrastructure as Code pro všechny environments  
3. **✅ Automated Promotion Pipeline** - GitHub Actions workflow s quality gates
4. **✅ Environment-Specific Configurations** - Tailored settings pro každé environment
5. **✅ Management Tooling** - Comprehensive scripts pro easy operations
6. **✅ Security & Compliance** - Environment-specific security controls

### 📈 Business Value Delivered:
- **Safe Deployments**: Automated testing a validation na každé úrovni
- **Faster Time-to-Market**: Streamlined promotion process
- **Risk Mitigation**: Production safeguards a manual approval gates
- **Operational Excellence**: Comprehensive tooling pro day-to-day operations
- **Scalability**: Infrastructure ready pro growth across all environments

**VÝSLEDEK**: Production-ready multi-environment infrastructure s complete automation pipeline připravená pro enterprise-scale deployment!

---

*Dokumentace vytvořena: 2025-07-27 | Status: RELACE 2C DOKONČENO*