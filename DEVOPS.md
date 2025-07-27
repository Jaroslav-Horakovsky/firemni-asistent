# DevOps Strategy - Firemní Asistent

## Overview
Tato strategie je navržena pro tým 2 lidí (developer + Claude Code CLI) s důrazem na jednoduchost, automatizace a reliability. Využívá Google Cloud Platform s Cloud Run pro minimální operační overhead.

---

## Cloud Infrastructure Setup

### Google Cloud Project Setup
```bash
# 1. Create GCP project
gcloud projects create firemni-asistent --name="Firemní Asistent"
gcloud config set project firemni-asistent

# 2. Enable required APIs
gcloud services enable \
  run.googleapis.com \
  sql-component.googleapis.com \
  sqladmin.googleapis.com \
  storage-component.googleapis.com \
  cloudbuild.googleapis.com \
  containerregistry.googleapis.com \
  cloudresourcemanager.googleapis.com \
  secretmanager.googleapis.com \
  monitoring.googleapis.com \
  logging.googleapis.com

# 3. Set default region
gcloud config set run/region europe-west1
gcloud config set compute/region europe-west1
```

### Database Setup (Google Cloud SQL)
```bash
# Create PostgreSQL instance
gcloud sql instances create firemni-asistent-db \
  --database-version=POSTGRES_15 \
  --tier=db-f1-micro \
  --region=europe-west1 \
  --storage-type=SSD \
  --storage-size=20GB \
  --storage-auto-increase \
  --backup-start-time=03:00 \
  --enable-bin-log \
  --retained-backups-count=7

# Set root password
gcloud sql users set-password postgres \
  --instance=firemni-asistent-db \
  --password=[GENERATED_SECURE_PASSWORD]

# Create databases for each service
gcloud sql databases create user_service_db --instance=firemni-asistent-db
gcloud sql databases create customer_service_db --instance=firemni-asistent-db
gcloud sql databases create order_service_db --instance=firemni-asistent-db
gcloud sql databases create inventory_service_db --instance=firemni-asistent-db
gcloud sql databases create billing_service_db --instance=firemni-asistent-db
gcloud sql databases create notification_service_db --instance=firemni-asistent-db
```

### Secret Management
```bash
# Store database connections in Secret Manager
gcloud secrets create user-service-db-url --data-file=user-db-connection.txt
gcloud secrets create customer-service-db-url --data-file=customer-db-connection.txt
gcloud secrets create order-service-db-url --data-file=order-db-connection.txt
gcloud secrets create inventory-service-db-url --data-file=inventory-db-connection.txt
gcloud secrets create billing-service-db-url --data-file=billing-db-connection.txt
gcloud secrets create notification-service-db-url --data-file=notification-db-connection.txt

# RabbitMQ connection (CloudAMQP)
gcloud secrets create rabbitmq-url --data-file=rabbitmq-connection.txt

# JWT secrets
gcloud secrets create jwt-secret --data-file=jwt-secret.txt
```

---

## Container Strategy

### Docker Configuration

#### Base Dockerfile Template
```dockerfile
# services/[service-name]/Dockerfile
FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --only=production && npm cache clean --force

# Build the source code
FROM base AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build
RUN npm run prisma:generate

# Production image
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nestjs

COPY --from=deps --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nodejs /app/dist ./dist
COPY --from=builder --chown=nestjs:nodejs /app/package.json ./package.json
COPY --from=builder --chown=nestjs:nodejs /app/prisma ./prisma

USER nestjs

EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

CMD ["node", "dist/main.js"]
```

#### Docker Compose for Local Development
```yaml
# docker-compose.dev.yml
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: dev_password
      POSTGRES_DB: firemni_asistent_dev
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./scripts/init-multiple-databases.sh:/docker-entrypoint-initdb.d/init-multiple-databases.sh
    environment:
      - POSTGRES_MULTIPLE_DATABASES=user_service_db,customer_service_db,order_service_db,inventory_service_db,billing_service_db,notification_service_db

  rabbitmq:
    image: rabbitmq:3-management-alpine
    environment:
      RABBITMQ_DEFAULT_USER: dev_user
      RABBITMQ_DEFAULT_PASS: dev_password
    ports:
      - "5672:5672"  # AMQP
      - "15672:15672"  # Management UI
    volumes:
      - rabbitmq_data:/var/lib/rabbitmq

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

volumes:
  postgres_data:
  rabbitmq_data:
  redis_data:
```

---

## CI/CD Pipeline

### GitHub Actions Workflow

#### Main CI/CD Pipeline
```yaml
# .github/workflows/deploy.yml
name: Deploy to Cloud Run

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

env:
  PROJECT_ID: firemni-asistent
  REGION: europe-west1
  REGISTRY: gcr.io

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: test_password
          POSTGRES_DB: test_db
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432

    strategy:
      matrix:
        service: [user-service, customer-service, order-service, inventory-service, billing-service, notification-service]

    steps:
    - name: Checkout code
      uses: actions/checkout@v4

    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '20'
        cache: 'npm'
        cache-dependency-path: services/${{ matrix.service }}/package-lock.json

    - name: Install dependencies
      working-directory: services/${{ matrix.service }}
      run: npm ci

    - name: Run linter
      working-directory: services/${{ matrix.service }}
      run: npm run lint

    - name: Run type check
      working-directory: services/${{ matrix.service }}
      run: npm run type-check

    - name: Generate Prisma client
      working-directory: services/${{ matrix.service }}
      run: npx prisma generate

    - name: Run database migrations
      working-directory: services/${{ matrix.service }}
      run: npx prisma migrate deploy
      env:
        DATABASE_URL: postgresql://postgres:test_password@localhost:5432/test_db

    - name: Run unit tests
      working-directory: services/${{ matrix.service }}
      run: npm run test
      env:
        DATABASE_URL: postgresql://postgres:test_password@localhost:5432/test_db

    - name: Run integration tests
      working-directory: services/${{ matrix.service }}
      run: npm run test:integration
      env:
        DATABASE_URL: postgresql://postgres:test_password@localhost:5432/test_db

  build-and-deploy:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    
    strategy:
      matrix:
        service: [user-service, customer-service, order-service, inventory-service, billing-service, notification-service]

    steps:
    - name: Checkout code
      uses: actions/checkout@v4

    - name: Setup Google Cloud CLI
      uses: google-github-actions/setup-gcloud@v1
      with:
        service_account_key: ${{ secrets.GCP_SA_KEY }}
        project_id: ${{ env.PROJECT_ID }}

    - name: Configure Docker for GCR
      run: gcloud auth configure-docker

    - name: Build Docker image
      working-directory: services/${{ matrix.service }}
      run: |
        docker build -t ${{ env.REGISTRY }}/${{ env.PROJECT_ID }}/${{ matrix.service }}:${{ github.sha }} .
        docker build -t ${{ env.REGISTRY }}/${{ env.PROJECT_ID }}/${{ matrix.service }}:latest .

    - name: Push Docker image
      run: |
        docker push ${{ env.REGISTRY }}/${{ env.PROJECT_ID }}/${{ matrix.service }}:${{ github.sha }}
        docker push ${{ env.REGISTRY }}/${{ env.PROJECT_ID }}/${{ matrix.service }}:latest

    - name: Deploy to Cloud Run
      run: |
        gcloud run deploy ${{ matrix.service }} \
          --image ${{ env.REGISTRY }}/${{ env.PROJECT_ID }}/${{ matrix.service }}:${{ github.sha }} \
          --region ${{ env.REGION }} \
          --platform managed \
          --allow-unauthenticated \
          --set-env-vars "NODE_ENV=production" \
          --set-secrets "DATABASE_URL=${{ matrix.service }}-db-url:latest" \
          --set-secrets "RABBITMQ_URL=rabbitmq-url:latest" \
          --set-secrets "JWT_SECRET=jwt-secret:latest" \
          --memory 512Mi \
          --cpu 1 \
          --min-instances 0 \
          --max-instances 10 \
          --timeout 300 \
          --concurrency 100

    - name: Update Traffic
      run: |
        gcloud run services update-traffic ${{ matrix.service }} \
          --to-latest \
          --region ${{ env.REGION }}

  deploy-gateway:
    needs: build-and-deploy
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'

    steps:
    - name: Checkout code
      uses: actions/checkout@v4

    - name: Setup Google Cloud CLI
      uses: google-github-actions/setup-gcloud@v1
      with:
        service_account_key: ${{ secrets.GCP_SA_KEY }}
        project_id: ${{ env.PROJECT_ID }}

    - name: Deploy API Gateway
      working-directory: gateway
      run: |
        docker build -t ${{ env.REGISTRY }}/${{ env.PROJECT_ID }}/api-gateway:${{ github.sha }} .
        docker push ${{ env.REGISTRY }}/${{ env.PROJECT_ID }}/api-gateway:${{ github.sha }}
        
        gcloud run deploy api-gateway \
          --image ${{ env.REGISTRY }}/${{ env.PROJECT_ID }}/api-gateway:${{ github.sha }} \
          --region ${{ env.REGION }} \
          --platform managed \
          --allow-unauthenticated \
          --set-env-vars "NODE_ENV=production" \
          --set-env-vars "USER_SERVICE_URL=https://user-service-hash-ew.a.run.app" \
          --set-env-vars "ORDER_SERVICE_URL=https://order-service-hash-ew.a.run.app" \
          --memory 1Gi \
          --cpu 2 \
          --min-instances 1 \
          --max-instances 50 \
          --timeout 60
```

### Database Migration Strategy
```yaml
# .github/workflows/migrate.yml
name: Database Migrations

on:
  workflow_dispatch:
    inputs:
      environment:
        description: 'Environment to migrate'
        required: true
        default: 'staging'
        type: choice
        options:
        - staging
        - production

jobs:
  migrate:
    runs-on: ubuntu-latest
    environment: ${{ github.event.inputs.environment }}
    
    strategy:
      matrix:
        service: [user-service, customer-service, order-service, inventory-service, billing-service, notification-service]

    steps:
    - uses: actions/checkout@v4
    
    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '20'

    - name: Install dependencies
      working-directory: services/${{ matrix.service }}
      run: npm ci

    - name: Setup Google Cloud CLI
      uses: google-github-actions/setup-gcloud@v1
      with:
        service_account_key: ${{ secrets.GCP_SA_KEY }}
        project_id: firemni-asistent

    - name: Run database migrations
      working-directory: services/${{ matrix.service }}
      run: |
        DATABASE_URL=$(gcloud secrets versions access latest --secret="${{ matrix.service }}-db-url")
        export DATABASE_URL
        npx prisma migrate deploy
        npx prisma generate
```

---

## Environment Management

### Environment Configuration

#### Development (.env.dev)
```bash
# Database
DATABASE_URL="postgresql://postgres:dev_password@localhost:5432/user_service_dev"

# Message Broker
RABBITMQ_URL="amqp://dev_user:dev_password@localhost:5672"

# Security
JWT_SECRET="dev_jwt_secret_very_long_and_secure"

# App Config
NODE_ENV="development"
PORT=3001
LOG_LEVEL="debug"

# External Services
REDIS_URL="redis://localhost:6379"
```

#### Staging (.env.staging)
```bash
# Database (Google Cloud SQL)
DATABASE_URL="postgresql://user:pass@/db?host=/cloudsql/project:region:instance"

# Message Broker (CloudAMQP)
RABBITMQ_URL="amqps://user:pass@broker.cloudamqp.com/vhost"

# Security
JWT_SECRET="${JWT_SECRET}" # From Secret Manager

# App Config
NODE_ENV="staging"
PORT=8080
LOG_LEVEL="info"

# External Services
REDIS_URL="${REDIS_URL}" # From Secret Manager
```

#### Production (.env.prod)
```bash
# Same as staging, but different instances and stricter security
```

### 🚀 Intelligent Business-Metrics-Based Cloud Run Scaling

Pokročilé auto-scaling založené na business metrics namísto pouze CPU/memory pro optimální handling business peak loads (Black Friday, konec měsíce, inventory rushes).

#### Business-Aware Autoscaling Strategy

```typescript
// infrastructure/business-scaling/business-metrics-collector.ts
import { GoogleCloudMetricExporter } from '@opentelemetry/exporter-google-cloud-monitoring';
import { MeterProvider } from '@opentelemetry/sdk-metrics';

export class BusinessMetricsCollector {
  private readonly metricExporter: GoogleCloudMetricExporter;
  private readonly meterProvider: MeterProvider;
  
  constructor() {
    this.metricExporter = new GoogleCloudMetricExporter({
      projectId: process.env.GOOGLE_CLOUD_PROJECT,
      prefix: 'custom.firemni_asistent/',
    });
    
    this.meterProvider = new MeterProvider({
      readers: [this.metricExporter],
    });
  }

  // Business KPI metrics for intelligent scaling
  public readonly businessScalingMetrics = {
    // Order Service - scale based on order velocity and complexity
    orderVelocity: this.meterProvider.getMeter('order-service').createUpDownCounter('order_velocity_per_minute', {
      description: 'Order creation rate for scaling decisions',
      unit: 'orders/min'
    }),
    
    orderComplexity: this.meterProvider.getMeter('order-service').createHistogram('order_complexity_score', {
      description: 'Order processing complexity (items count, custom configs)',
      boundaries: [1, 3, 5, 10, 20, 50]
    }),
    
    // User Service - scale based on authentication load and user activity
    activeUserSessions: this.meterProvider.getMeter('user-service').createUpDownCounter('active_user_sessions', {
      description: 'Currently active user sessions for capacity planning'
    }),
    
    authenticationLoad: this.meterProvider.getMeter('user-service').createCounter('authentication_requests_per_minute', {
      description: 'Authentication requests rate for scaling'
    }),
    
    // Inventory Service - scale based on stock check intensity
    stockCheckVelocity: this.meterProvider.getMeter('inventory-service').createCounter('stock_checks_per_minute', {
      description: 'Stock availability check rate'
    }),
    
    lowStockItemsCount: this.meterProvider.getMeter('inventory-service').createUpDownCounter('low_stock_items_active', {
      description: 'Number of items currently low in stock (higher checking frequency)'
    }),
    
    // Billing Service - scale based on billing complexity and volume
    billingJobQueue: this.meterProvider.getMeter('billing-service').createUpDownCounter('billing_jobs_pending', {
      description: 'Pending billing jobs requiring processing'
    }),
    
    invoiceComplexity: this.meterProvider.getMeter('billing-service').createHistogram('invoice_complexity_score', {
      description: 'Invoice generation complexity (line items, calculations)',
      boundaries: [1, 5, 10, 25, 50, 100]
    })
  };

  // Emit business metrics for scaling decisions
  async emitOrderMetrics(orderData: {
    orderCount: number;
    avgComplexity: number;
    peakVelocity: number;
  }) {
    this.businessScalingMetrics.orderVelocity.add(orderData.orderCount);
    this.businessScalingMetrics.orderComplexity.record(orderData.avgComplexity);
    
    // Custom metric for BigQuery integration
    await this.emitCustomMetric('business/order_processing_load', {
      value: orderData.peakVelocity,
      labels: {
        complexity_tier: orderData.avgComplexity > 10 ? 'high' : 'normal',
        scaling_signal: orderData.peakVelocity > 50 ? 'scale_up' : 'normal'
      }
    });
  }

  async emitUserActivityMetrics(userData: {
    activeSessions: number;
    authRate: number;
    peakConcurrency: number;
  }) {
    this.businessScalingMetrics.activeUserSessions.add(userData.activeSessions);
    this.businessScalingMetrics.authenticationLoad.add(userData.authRate);
    
    await this.emitCustomMetric('business/user_activity_load', {
      value: userData.peakConcurrency,
      labels: {
        load_tier: userData.peakConcurrency > 100 ? 'high' : 'normal',
        auth_intensity: userData.authRate > 20 ? 'high' : 'normal'
      }
    });
  }

  async emitInventoryMetrics(inventoryData: {
    stockCheckRate: number;
    lowStockItems: number;
    criticalStockItems: number;
  }) {
    this.businessScalingMetrics.stockCheckVelocity.add(inventoryData.stockCheckRate);
    this.businessScalingMetrics.lowStockItemsCount.add(inventoryData.lowStockItems);
    
    await this.emitCustomMetric('business/inventory_pressure', {
      value: inventoryData.criticalStockItems,
      labels: {
        stock_situation: inventoryData.criticalStockItems > 10 ? 'critical' : 'normal',
        check_intensity: inventoryData.stockCheckRate > 100 ? 'high' : 'normal'
      }
    });
  }
  
  private async emitCustomMetric(metricName: string, data: { value: number; labels: Record<string, string> }) {
    // Emit to Google Cloud Monitoring for autoscaling policies
    const metric = {
      type: `custom.googleapis.com/${metricName}`,
      labels: data.labels,
    };
    
    const timeSeries = {
      metric,
      resource: {
        type: 'global',
        labels: {
          project_id: process.env.GOOGLE_CLOUD_PROJECT,
        },
      },
      points: [{
        interval: {
          endTime: { seconds: Date.now() / 1000 },
        },
        value: { doubleValue: data.value },
      }],
    };
    
    // Send to Google Cloud Monitoring
    // Implementation would use @google-cloud/monitoring client
  }
}

// Usage in each service
export class OrderServiceScalingIntegration {
  private readonly metricsCollector = new BusinessMetricsCollector();
  
  async trackOrderProcessing(orderId: string, orderData: any) {
    const startTime = Date.now();
    
    try {
      const result = await this.processOrder(orderId, orderData);
      
      const complexity = this.calculateOrderComplexity(orderData);
      const processingTime = Date.now() - startTime;
      
      // Emit metrics for scaling decision
      await this.metricsCollector.emitOrderMetrics({
        orderCount: 1,
        avgComplexity: complexity,
        peakVelocity: await this.getCurrentOrderVelocity()
      });
      
      return result;
    } catch (error) {
      // Emit error metrics that also influence scaling
      await this.metricsCollector.emitCustomMetric('business/order_processing_errors', {
        value: 1,
        labels: { error_type: error.name, scaling_impact: 'increase_capacity' }
      });
      throw error;
    }
  }
  
  private calculateOrderComplexity(orderData: any): number {
    // Business logic to calculate order complexity score
    let complexity = orderData.items?.length || 1;
    complexity += orderData.customConfigurations?.length * 2 || 0;
    complexity += orderData.specialInstructions ? 3 : 0;
    return complexity;
  }
  
  private async getCurrentOrderVelocity(): Promise<number> {
    // Query recent order velocity from database/cache
    // Used for real-time scaling decisions
    return 25; // orders per minute
  }
}
```

#### Enhanced Cloud Run Configuration with Business Metrics

```yaml
# cloud-run-config-business-scaling.yaml
apiVersion: serving.knative.dev/v1
kind: Service
metadata:
  name: SERVICE_NAME
  annotations:
    run.googleapis.com/ingress: all
    run.googleapis.com/execution-environment: gen2
    # Business-aware scaling annotations
    autoscaling.knative.dev/class: "hpa.autoscaling.knative.dev"
    autoscaling.knative.dev/metric: "custom.googleapis.com/business/SERVICE_LOAD_METRIC"
spec:
  template:
    metadata:
      annotations:
        # Dynamic scaling based on business metrics
        autoscaling.knative.dev/minScale: "1"  # Always ready for business load
        autoscaling.knative.dev/maxScale: "50" # Support high business peaks
        autoscaling.knative.dev/target: "70"   # Scale when 70% business capacity
        # Business-specific scaling policies
        autoscaling.knative.dev/scaleDownDelay: "5m"   # Longer scale-down for business continuity
        autoscaling.knative.dev/scaleUpDelay: "30s"    # Fast scale-up for business peaks
        # Advanced resource management
        run.googleapis.com/cpu-throttling: "false"     # No throttling during business peaks
        run.googleapis.com/execution-environment: gen2
        run.googleapis.com/vpc-access-connector: projects/PROJECT_ID/locations/REGION/connectors/CONNECTOR_NAME
    spec:
      serviceAccountName: SERVICE_ACCOUNT_EMAIL
      containers:
      - image: gcr.io/PROJECT_ID/SERVICE_NAME:TAG
        ports:
        - name: http1
          containerPort: 8080
        env:
        - name: NODE_ENV
          value: "production"
        - name: PORT
          value: "8080"
        - name: BUSINESS_METRICS_ENABLED
          value: "true"
        - name: SCALING_MODE
          value: "business_aware"
        resources:
          limits:
            cpu: "2000m"      # Higher limits for business peak handling
            memory: "1Gi"     # More memory for complex business operations
          requests:
            cpu: "200m"       # Higher baseline for business readiness
            memory: "512Mi"
        # Enhanced health checks for business readiness
        livenessProbe:
          httpGet:
            path: /live        # Updated to /live endpoint
            port: 8080
          initialDelaySeconds: 10
          periodSeconds: 30
          timeoutSeconds: 10
          failureThreshold: 3
        readinessProbe:
          httpGet:
            path: /ready       # Updated to /ready endpoint
            port: 8080
          initialDelaySeconds: 5
          periodSeconds: 10
          timeoutSeconds: 5
          failureThreshold: 2
```

#### Google Cloud Monitoring Business Scaling Policies

```bash
# Create business-aware autoscaling policies
gcloud compute instance-groups managed set-autoscaling order-service-group \
  --max-num-replicas=50 \
  --min-num-replicas=2 \
  --target-cpu-utilization=0.6 \
  --custom-metric-utilization metric=custom.googleapis.com/business/order_processing_load,target-utilization-value=70 \
  --scale-based-on-cpu=false \
  --scale-based-on-load-balancing=false

# User Service - Auth load based scaling
gcloud compute instance-groups managed set-autoscaling user-service-group \
  --max-num-replicas=30 \
  --min-num-replicas=2 \
  --custom-metric-utilization metric=custom.googleapis.com/business/user_activity_load,target-utilization-value=80

# Inventory Service - Stock pressure based scaling  
gcloud compute instance-groups managed set-autoscaling inventory-service-group \
  --max-num-replicas=20 \
  --min-num-replicas=1 \
  --custom-metric-utilization metric=custom.googleapis.com/business/inventory_pressure,target-utilization-value=60

# Billing Service - Job queue based scaling
gcloud compute instance-groups managed set-autoscaling billing-service-group \
  --max-num-replicas=15 \
  --min-num-replicas=1 \
  --custom-metric-utilization metric=custom.googleapis.com/business/billing_jobs_pending,target-utilization-value=10
```

#### BigQuery Integration for Advanced Business Analytics

```typescript
// infrastructure/business-scaling/bigquery-analytics.ts
import { BigQuery } from '@google-cloud/bigquery';

export class BusinessScalingAnalytics {
  private readonly bigquery = new BigQuery();
  private readonly dataset = this.bigquery.dataset('business_scaling_analytics');

  // Analyze historical patterns for predictive scaling
  async analyzePeakPatterns(): Promise<ScalingRecommendations> {
    const query = `
      SELECT 
        service_name,
        EXTRACT(HOUR FROM timestamp) as hour_of_day,
        EXTRACT(DAYOFWEEK FROM timestamp) as day_of_week,
        AVG(business_load_score) as avg_load,
        MAX(business_load_score) as peak_load,
        STDDEV(business_load_score) as load_variance
      FROM \`${this.dataset.id}.business_metrics_hourly\`
      WHERE timestamp >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 30 DAY)
      GROUP BY service_name, hour_of_day, day_of_week
      HAVING avg_load > 50  -- Only significant load periods
      ORDER BY service_name, day_of_week, hour_of_day
    `;
    
    const [rows] = await this.bigquery.query(query);
    
    return this.generateScalingRecommendations(rows);
  }

  // Predict upcoming scaling needs based on business calendar
  async predictBusinessPeaks(lookAheadDays: number = 7): Promise<PredictedScalingEvents[]> {
    const query = `
      WITH business_calendar AS (
        SELECT 
          date,
          is_month_end,
          is_black_friday,
          is_holiday_season,
          expected_load_multiplier
        FROM \`${this.dataset.id}.business_calendar\`
        WHERE date BETWEEN CURRENT_DATE() AND DATE_ADD(CURRENT_DATE(), INTERVAL ${lookAheadDays} DAY)
      ),
      historical_patterns AS (
        SELECT 
          service_name,
          EXTRACT(DAYOFWEEK FROM timestamp) as day_of_week,
          AVG(CASE WHEN business_context.is_month_end THEN business_load_score END) as month_end_avg,
          AVG(CASE WHEN business_context.is_holiday_season THEN business_load_score END) as holiday_avg,
          AVG(business_load_score) as normal_avg
        FROM \`${this.dataset.id}.business_metrics_hourly\`
        WHERE timestamp >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 90 DAY)
        GROUP BY service_name, day_of_week
      )
      SELECT 
        bc.date,
        hp.service_name,
        CASE 
          WHEN bc.is_month_end THEN hp.month_end_avg * bc.expected_load_multiplier
          WHEN bc.is_holiday_season THEN hp.holiday_avg * bc.expected_load_multiplier
          ELSE hp.normal_avg * bc.expected_load_multiplier
        END as predicted_load,
        bc.expected_load_multiplier
      FROM business_calendar bc
      CROSS JOIN historical_patterns hp
      WHERE hp.day_of_week = EXTRACT(DAYOFWEEK FROM bc.date)
      ORDER BY bc.date, hp.service_name
    `;
    
    const [rows] = await this.bigquery.query(query);
    return this.formatPredictions(rows);
  }

  private generateScalingRecommendations(analysisData: any[]): ScalingRecommendations {
    const recommendations: ScalingRecommendations = {
      services: {},
      globalInsights: {
        peakHours: [],
        seasonalPatterns: [],
        capacityGaps: []
      }
    };

    for (const row of analysisData) {
      if (!recommendations.services[row.service_name]) {
        recommendations.services[row.service_name] = {
          recommendedMinInstances: 1,
          recommendedMaxInstances: 10,
          peakSchedule: [],
          scalingTriggers: []
        };
      }

      const service = recommendations.services[row.service_name];
      
      // Calculate recommended capacity based on historical peaks
      const recommendedMax = Math.ceil(row.peak_load / 70); // Target 70% utilization
      service.recommendedMaxInstances = Math.max(service.recommendedMaxInstances, recommendedMax);
      
      // Identify consistent peak hours
      if (row.avg_load > 80) {
        service.peakSchedule.push({
          dayOfWeek: row.day_of_week,
          hour: row.hour_of_day,
          expectedLoad: row.avg_load
        });
      }
    }

    return recommendations;
  }
}

interface ScalingRecommendations {
  services: Record<string, {
    recommendedMinInstances: number;
    recommendedMaxInstances: number;
    peakSchedule: Array<{ dayOfWeek: number; hour: number; expectedLoad: number }>;
    scalingTriggers: string[];
  }>;
  globalInsights: {
    peakHours: number[];
    seasonalPatterns: string[];
    capacityGaps: string[];
  };
}

interface PredictedScalingEvents {
  date: string;
  serviceName: string;
  predictedLoad: number;
  recommendedInstances: number;
  scalingReason: string;
}
```

#### Proactive Business Scaling Automation

```typescript
// infrastructure/business-scaling/proactive-scaler.ts
export class ProactiveBusinessScaler {
  private readonly analytics = new BusinessScalingAnalytics();
  private readonly gcpCompute = new compute.InstanceGroupManagersClient();

  // Run daily to adjust scaling parameters based on business predictions
  async optimizeScalingForBusinessEvents(): Promise<void> {
    const predictions = await this.analytics.predictBusinessPeaks(7);
    
    for (const prediction of predictions) {
      if (prediction.predictedLoad > 80) {
        await this.preScaleService(prediction);
      }
    }
  }

  private async preScaleService(prediction: PredictedScalingEvents): Promise<void> {
    const scalingConfig = {
      serviceName: prediction.serviceName,
      targetDate: prediction.date,
      minInstances: Math.max(2, Math.ceil(prediction.recommendedInstances * 0.7)),
      maxInstances: Math.ceil(prediction.recommendedInstances * 1.3)
    };

    logger.info({
      message: 'Proactive business scaling scheduled',
      ...scalingConfig,
      reason: prediction.scalingReason,
      predictedLoad: prediction.predictedLoad
    });

    // Schedule scaling adjustment via Cloud Scheduler
    await this.scheduleScalingAdjustment(scalingConfig);
  }

  private async scheduleScalingAdjustment(config: any): Promise<void> {
    // Implementation would use Cloud Scheduler to adjust autoscaling policies
    // before predicted business peaks
  }
}
```

---

## Monitoring & Observability

### 🎯 Service Level Objectives (SLO) Strategy

Každá mikroslužba má specifické SLA/SLO cíle založené na business criticality a uživatelském dopadu:

| Service | Availability SLO | Latency SLO (p95) | Error Budget | Criticality |
|---------|------------------|-------------------|--------------|-------------|
| `user-service` | 99.9% (43.2min/month) | < 200ms | 0.1% | 🔴 Vysoká |
| `billing-service` | 99.9% (43.2min/month) | < 400ms | 0.1% | 🔴 Vysoká |
| `order-service` | 99.5% (3.6h/month) | < 500ms | 0.5% | 🟡 Střední |
| `inventory-service` | 99.8% (1.44h/month) | < 300ms | 0.2% | 🟡 Střední |
| `customer-service` | 99.5% (3.6h/month) | < 300ms | 0.5% | 🟢 Nízká |
| `notification-service` | 99.0% (7.2h/month) | < 1000ms | 1.0% | 🟢 Nízká |

#### Google Cloud Monitoring SLO Configuration
```yaml
# Service Level Objectives per service
# Configure via: Monitoring → Services → Create SLI/SLO

# Example: User Service SLO
displayName: "User Service - Availability"
serviceLevelObjective:
  displayName: "99.9% Availability"
  serviceLevelIndicator:
    requestBased:
      goodTotalRatio:
        goodServiceFilter: |
          resource.type="cloud_run_revision"
          resource.labels.service_name="user-service"
          protoPayload.httpRequest.status<500
        totalServiceFilter: |
          resource.type="cloud_run_revision"
          resource.labels.service_name="user-service"
  goal: 0.999
  rollingPeriod: "2592000s" # 30 days

# Latency SLO for User Service
displayName: "User Service - Latency"
serviceLevelObjective:
  displayName: "95% requests < 200ms"
  serviceLevelIndicator:
    requestBased:
      distributionCut:
        distributionFilter: |
          resource.type="cloud_run_revision"
          resource.labels.service_name="user-service"
          protoPayload.httpRequest.latency!=null
        range:
          max: 0.2  # 200ms
  goal: 0.95
  rollingPeriod: "2592000s"
```

### 📊 Custom Business Metrics Strategy

Přechod z Prometheus na OpenTelemetry pro nativní Google Cloud Monitoring integraci:

```typescript
// shared/telemetry.ts
import { NodeSDK } from '@opentelemetry/auto-instrumentations-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { MeterProvider } from '@opentelemetry/sdk-metrics';
import { GoogleCloudMetricExporter } from '@opentelemetry/exporter-google-cloud-monitoring';

// Initialize OpenTelemetry with Google Cloud
const sdk = new NodeSDK({
  resource: new Resource({
    [SemanticResourceAttributes.SERVICE_NAME]: process.env.SERVICE_NAME,
    [SemanticResourceAttributes.SERVICE_VERSION]: process.env.SERVICE_VERSION,
  }),
  instrumentations: [getNodeAutoInstrumentations()],
});

// Metrics setup
const metricExporter = new GoogleCloudMetricExporter({
  projectId: process.env.GOOGLE_CLOUD_PROJECT,
});

const meterProvider = new MeterProvider({
  resource: sdk.resource,
  readers: [metricExporter],
});

const meter = meterProvider.getMeter(process.env.SERVICE_NAME);

// Business-specific metrics per service
export const businessMetrics = {
  // User Service metrics
  userRegistrations: meter.createCounter('user_registrations_total', {
    description: 'Total successful user registrations',
  }),
  loginAttempts: meter.createCounter('login_attempts_total', {
    description: 'Total login attempts by status',
  }),
  
  // Order Service metrics
  ordersCreated: meter.createCounter('orders_created_total', {
    description: 'Total orders created',
  }),
  orderCompletionTime: meter.createHistogram('order_completion_duration_seconds', {
    description: 'Time to complete orders',
    boundaries: [60, 300, 900, 3600, 86400], // 1min to 1day
  }),
  
  // Billing Service metrics
  invoicesGenerated: meter.createCounter('invoices_generated_total', {
    description: 'Total invoices generated by status',
  }),
  invoiceAmount: meter.createHistogram('invoice_amount_czk', {
    description: 'Invoice amounts in CZK',
    boundaries: [1000, 5000, 10000, 50000, 100000],
  }),
  
  // Inventory Service metrics
  stockLevels: meter.createUpDownCounter('stock_levels_current', {
    description: 'Current stock levels by material',
  }),
  lowStockAlerts: meter.createCounter('low_stock_alerts_total', {
    description: 'Low stock alert triggers',
  }),
};

sdk.start();
```

### 🚨 Proactive Alerting Strategy

P0-P3 severity level alerting s automated escalation pro 2-person tým:

#### P0 - Critical (Immediate Response - 0-5 minutes)
```yaml
# Service completely down
displayName: "P0 - Service Down"
conditions:
  - displayName: "Service unavailable for 2+ minutes"
    conditionThreshold:
      filter: |
        resource.type="cloud_run_revision"
        protoPayload.httpRequest.status>=500
      comparison: COMPARISON_GREATER_THAN
      thresholdValue: 0.5  # 50% error rate
      duration: "120s"
notificationChannels:
  - EMAIL_IMMEDIATE
  - SMS_BOTH_DEVS
  - SLACK_EMERGENCY
```

#### P1 - High (Response within 15 minutes)
```yaml
# SLO burn rate too high
displayName: "P1 - High Error Rate"
conditions:
  - displayName: "Error rate > 5% for 5 minutes"
    conditionThreshold:
      filter: |
        resource.type="cloud_run_revision"
        jsonPayload.level>=50
      comparison: COMPARISON_GREATER_THAN
      thresholdValue: 0.05
      duration: "300s"
```

#### P2 - Medium (Response within 2 hours)
```yaml
# Performance degradation
displayName: "P2 - Performance Degradation"
conditions:
  - displayName: "P95 latency > 2x SLO target"
    conditionThreshold:
      filter: |
        resource.type="cloud_run_revision"
        protoPayload.httpRequest.latency>1.0  # 2x worst SLO target
      comparison: COMPARISON_GREATER_THAN
      thresholdValue: 0.1  # 10% of requests
      duration: "600s"
```

#### P3 - Low (Response within 24 hours)
```yaml
# Trend monitoring
displayName: "P3 - Capacity Planning"
conditions:
  - displayName: "Sustained high load trending up"
    conditionThreshold:
      filter: |
        resource.type="cloud_run_revision"
        metric.type="run.googleapis.com/container/cpu/utilizations"
      comparison: COMPARISON_GREATER_THAN
      thresholdValue: 0.8  # 80% CPU
      duration: "3600s"    # 1 hour
```

### 🔗 Cross-Service Correlation & Transaction Tracking

```typescript
// shared/correlation.ts
import { trace, context } from '@opentelemetry/api';
import { randomUUID } from 'crypto';

export class CorrelationService {
  static generateCorrelationId(): string {
    return randomUUID();
  }
  
  static getCurrentCorrelationId(): string {
    const span = trace.getActiveSpan();
    return span?.spanContext().traceId || 'unknown';
  }
  
  static async trackBusinessTransaction<T>(
    transactionType: string,
    correlationId: string,
    operation: () => Promise<T>
  ): Promise<T> {
    const startTime = Date.now();
    
    try {
      const result = await operation();
      
      // Log successful transaction
      logger.info({
        message: 'Business transaction completed',
        transactionType,
        correlationId,
        duration: Date.now() - startTime,
        status: 'success'
      });
      
      // Emit business metric
      businessMetrics.businessTransactions.add(1, {
        transaction_type: transactionType,
        status: 'success'
      });
      
      return result;
    } catch (error) {
      // Log failed transaction
      logger.error({
        message: 'Business transaction failed',
        transactionType,
        correlationId,
        duration: Date.now() - startTime,
        status: 'error',
        error: error.message
      });
      
      businessMetrics.businessTransactions.add(1, {
        transaction_type: transactionType,
        status: 'error'
      });
      
      throw error;
    }
  }
}

// Usage example in Order Service
export async function completeOrder(orderId: string) {
  const correlationId = CorrelationService.generateCorrelationId();
  
  return CorrelationService.trackBusinessTransaction(
    'order_completion',
    correlationId,
    async () => {
      // 1. Update order status
      await updateOrderStatus(orderId, 'completed');
      
      // 2. Publish OrderCompleted event with correlation ID
      await publishEvent('order.completed', {
        orderId,
        correlationId,
        timestamp: new Date().toISOString()
      });
      
      return { orderId, correlationId };
    }
  );
}
```

### 🔄 RabbitMQ/CloudAMQP Monitoring

Critical pro asynchronní processing monitoring:

```typescript
// shared/rabbitmq-monitoring.ts
import { businessMetrics } from './telemetry';

export class RabbitMQMonitoring {
  private static readonly CLOUDAMQP_API_BASE = process.env.CLOUDAMQP_API_URL;
  
  static async checkQueueHealth(): Promise<boolean> {
    try {
      const response = await fetch(`${this.CLOUDAMQP_API_BASE}/api/queues`);
      const queues = await response.json();
      
      let hasIssues = false;
      
      for (const queue of queues) {
        // Monitor queue depth
        businessMetrics.queueDepth.record(queue.messages, {
          queue_name: queue.name,
        });
        
        // Alert on high queue depth
        if (queue.messages > 100) {
          logger.warn({
            message: 'High queue depth detected',
            queueName: queue.name,
            messageCount: queue.messages
          });
          hasIssues = true;
        }
        
        // Critical: Monitor Dead Letter Queue
        if (queue.name.includes('dlq') && queue.messages > 0) {
          logger.error({
            message: 'Messages in Dead Letter Queue detected',
            queueName: queue.name,
            messageCount: queue.messages,
            severity: 'P0'
          });
          
          businessMetrics.dlqMessages.add(queue.messages, {
            queue_name: queue.name,
          });
          
          hasIssues = true;
        }
      }
      
      return !hasIssues;
    } catch (error) {
      logger.error({
        message: 'Failed to check RabbitMQ health',
        error: error.message
      });
      return false;
    }
  }
}

// Add to health check
export async function registerHealthChecks(
  fastify: FastifyInstance,
  prisma: PrismaClient
) {
  fastify.get('/health', async (request, reply) => {
    const status: HealthStatus = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      checks: {
        database: 'ok',
        rabbitmq: 'ok',
        memory: {
          used: process.memoryUsage().heapUsed,
          total: process.memoryUsage().heapTotal,
          percentage: (process.memoryUsage().heapUsed / process.memoryUsage().heapTotal) * 100
        }
      }
    };

    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch (error) {
      status.checks.database = 'error';
      status.status = 'error';
    }

    // NEW: Check RabbitMQ health including DLQ monitoring
    const rabbitmqHealthy = await RabbitMQMonitoring.checkQueueHealth();
    if (!rabbitmqHealthy) {
      status.checks.rabbitmq = 'error';
      status.status = 'error';
    }
    
    reply.code(status.status === 'ok' ? 200 : 503).send(status);
  });
}
```

### 💰 Cost-Optimized Monitoring

```bash
# Log exclusion filters pro cost control
gcloud logging sinks create exclude-health-checks \
  bigquery.googleapis.com/projects/PROJECT_ID/datasets/logs_dataset \
  --log-filter='NOT (jsonPayload.url="/health" AND jsonPayload.statusCode=200)'

# Exclude noisy debug logs in production
gcloud logging sinks create exclude-debug-prod \
  storage.googleapis.com/firemni-asistent-logs \
  --log-filter='NOT (jsonPayload.level<30 AND jsonPayload.environment="production")'

# Archive old logs to cheaper storage
gcloud logging sinks create archive-old-logs \
  storage.googleapis.com/firemni-asistent-archive \
  --log-filter='timestamp<"2024-01-01T00:00:00Z"'
```

### 🧠 Advanced Self-Repair Capabilities with ML-Based Pattern Detection

Inteligentní automated response system s machine learning pro failure pattern detection a proactive issue resolution před eskalací na engineering team.

#### Machine Learning Failure Pattern Analysis

```typescript
// infrastructure/self-repair/ml-failure-detector.ts
import { BigQuery } from '@google-cloud/bigquery';
import { AutoMLPredictionServiceClient } from '@google-cloud/automl';

export class MLFailurePatternDetector {
  private readonly bigquery = new BigQuery();
  private readonly autoMLClient = new AutoMLPredictionServiceClient();
  private readonly predictionModelPath = `projects/${process.env.GOOGLE_CLOUD_PROJECT}/locations/europe-west1/models/failure-prediction-model`;

  // Analyze historical failure patterns to predict upcoming issues
  async analyzeFailurePatterns(serviceName: string, timeWindowHours: number = 24): Promise<FailurePrediction> {
    const historicalData = await this.getHistoricalFailureData(serviceName, timeWindowHours);
    const currentMetrics = await this.getCurrentServiceMetrics(serviceName);
    
    // ML model prediction for failure probability
    const failureProbability = await this.predictFailureProbability({
      ...currentMetrics,
      historicalContext: historicalData
    });
    
    return {
      serviceName,
      failureProbability,
      predictedIssues: await this.identifyLikelyIssues(historicalData, currentMetrics),
      recommendedActions: await this.generatePreventiveActions(failureProbability, serviceName),
      confidence: failureProbability.confidence,
      timeToFailure: failureProbability.estimatedTimeHours
    };
  }

  private async getHistoricalFailureData(serviceName: string, hours: number): Promise<HistoricalFailureData> {
    const query = `
      WITH failure_events AS (
        SELECT 
          timestamp,
          jsonPayload.level as log_level,
          jsonPayload.error_type,
          jsonPayload.error_message,
          jsonPayload.service_health_score,
          jsonPayload.cpu_utilization,
          jsonPayload.memory_utilization,
          jsonPayload.request_rate,
          jsonPayload.error_rate,
          jsonPayload.response_time_p95,
          LEAD(timestamp) OVER (ORDER BY timestamp) as next_event_time
        FROM \`${process.env.GOOGLE_CLOUD_PROJECT}.service_logs.${serviceName}_logs\`
        WHERE 
          timestamp >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL ${hours} HOUR)
          AND jsonPayload.level >= 50  -- Error and above
      ),
      failure_patterns AS (
        SELECT 
          error_type,
          COUNT(*) as occurrence_count,
          AVG(service_health_score) as avg_health_score,
          AVG(cpu_utilization) as avg_cpu,
          AVG(memory_utilization) as avg_memory,
          AVG(request_rate) as avg_request_rate,
          AVG(error_rate) as avg_error_rate,
          AVG(response_time_p95) as avg_response_time,
          STDDEV(response_time_p95) as response_time_variance,
          ARRAY_AGG(STRUCT(timestamp, error_message) ORDER BY timestamp DESC LIMIT 5) as recent_examples
        FROM failure_events
        GROUP BY error_type
        HAVING COUNT(*) >= 3  -- Only patterns with multiple occurrences
      )
      SELECT 
        error_type,
        occurrence_count,
        avg_health_score,
        avg_cpu,
        avg_memory,
        avg_request_rate,
        avg_error_rate,
        avg_response_time,
        response_time_variance,
        recent_examples,
        -- Calculate failure velocity (failures per hour)
        occurrence_count / ${hours} as failure_velocity,
        -- Identify if this is an escalating pattern
        CASE 
          WHEN response_time_variance > avg_response_time * 0.5 THEN 'escalating'
          WHEN occurrence_count > 10 THEN 'frequent'
          ELSE 'stable'
        END as pattern_type
      FROM failure_patterns
      ORDER BY occurrence_count DESC, failure_velocity DESC
    `;

    const [rows] = await this.bigquery.query(query);
    return this.processHistoricalData(rows);
  }

  private async predictFailureProbability(inputData: ServiceMetricsSnapshot): Promise<FailureProbabilityPrediction> {
    // Prepare feature vector for ML model
    const features = this.prepareFeatureVector(inputData);
    
    try {
      // Call AutoML prediction model
      const [response] = await this.autoMLClient.predict({
        name: this.predictionModelPath,
        payload: {
          row: {
            values: features
          }
        }
      });

      const prediction = response.payload[0];
      
      return {
        failureProbability: prediction.classification.score,
        confidence: prediction.classification.confidence,
        estimatedTimeHours: this.calculateTimeToFailure(prediction.classification.score),
        contributingFactors: this.identifyContributingFactors(features, prediction)
      };
    } catch (error) {
      logger.warn({
        message: 'ML failure prediction unavailable, using heuristic fallback',
        serviceName: inputData.serviceName,
        error: error.message
      });
      
      // Fallback to heuristic-based prediction
      return this.heuristicFailurePrediction(inputData);
    }
  }

  private prepareFeatureVector(data: ServiceMetricsSnapshot): number[] {
    return [
      data.currentCpuUtilization,
      data.currentMemoryUtilization,
      data.currentRequestRate,
      data.currentErrorRate,
      data.currentResponseTime,
      data.queueDepth || 0,
      data.databaseConnectionPoolUtilization || 0,
      data.historicalContext.failureVelocity,
      data.historicalContext.avgHealthScore,
      data.circuitBreakerOpenCount || 0,
      data.consecutiveFailures || 0,
      data.timeSinceLastRestart || 0
    ];
  }

  private async identifyLikelyIssues(historical: HistoricalFailureData, current: ServiceMetricsSnapshot): Promise<PredictedIssue[]> {
    const issues: PredictedIssue[] = [];

    // Pattern-based issue identification
    for (const pattern of historical.patterns) {
      const similarity = this.calculatePatternSimilarity(pattern, current);
      
      if (similarity > 0.7) {  // High similarity threshold
        issues.push({
          issueType: pattern.errorType,
          probability: similarity,
          description: `Historical pattern suggests ${pattern.errorType} failure likely`,
          evidencePoints: [
            `Similar CPU pattern: ${current.currentCpuUtilization}% vs historical ${pattern.avgCpu}%`,
            `Similar error rate: ${current.currentErrorRate}% vs historical ${pattern.avgErrorRate}%`,
            `Pattern occurred ${pattern.occurrenceCount} times in last ${24} hours`
          ],
          recommendedPreventiveActions: this.getPreventiveActionsForPattern(pattern.errorType)
        });
      }
    }

    // Resource exhaustion prediction
    if (current.currentMemoryUtilization > 80 && historical.memoryTrend > 5) {
      issues.push({
        issueType: 'memory_exhaustion',
        probability: 0.85,
        description: 'Memory utilization trending upward, OOM failure likely within 2 hours',
        evidencePoints: [
          `Current memory: ${current.currentMemoryUtilization}%`,
          `Memory trend: +${historical.memoryTrend}% per hour`,
          `Historical OOM failures: ${historical.oomFailureCount}`
        ],
        recommendedPreventiveActions: ['scale_up', 'garbage_collection', 'memory_optimization']
      });
    }

    return issues.sort((a, b) => b.probability - a.probability);
  }

  private calculatePatternSimilarity(pattern: FailurePattern, current: ServiceMetricsSnapshot): number {
    // Calculate weighted similarity score
    const cpuSimilarity = 1 - Math.abs(pattern.avgCpu - current.currentCpuUtilization) / 100;
    const memorySimilarity = 1 - Math.abs(pattern.avgMemory - current.currentMemoryUtilization) / 100;
    const errorRateSimilarity = 1 - Math.abs(pattern.avgErrorRate - current.currentErrorRate) / 100;
    const responseTimeSimilarity = 1 - Math.abs(pattern.avgResponseTime - current.currentResponseTime) / pattern.avgResponseTime;

    // Weighted average with higher weight on error indicators
    return (cpuSimilarity * 0.2 + memorySimilarity * 0.2 + errorRateSimilarity * 0.4 + responseTimeSimilarity * 0.2);
  }
}

// Enhanced AutomatedResponseService with ML integration
export class AdvancedAutomatedResponseService {
  private readonly mlDetector = new MLFailurePatternDetector();
  private readonly responseHistory = new Map<string, ResponseHistory>();
  
  async handlePredictiveFailurePrevention(serviceName: string): Promise<void> {
    logger.info({
      message: 'Running predictive failure analysis',
      serviceName,
      action: 'preventive_analysis'
    });

    try {
      const prediction = await this.mlDetector.analyzeFailurePatterns(serviceName);
      
      if (prediction.failureProbability > 0.7) {
        await this.executePreventiveActions(serviceName, prediction);
      } else if (prediction.failureProbability > 0.4) {
        await this.implementPreventiveMeasures(serviceName, prediction);
      }
      
      // Store prediction for learning
      await this.storePredictionForLearning(serviceName, prediction);
      
    } catch (error) {
      logger.error({
        message: 'Predictive failure analysis failed',
        serviceName,
        error: error.message
      });
    }
  }

  private async executePreventiveActions(serviceName: string, prediction: FailurePrediction): Promise<void> {
    logger.warn({
      message: 'High failure probability detected - executing preventive actions',
      serviceName,
      failureProbability: prediction.failureProbability,
      predictedIssues: prediction.predictedIssues.map(i => i.issueType)
    });

    const actions = prediction.recommendedActions;
    
    for (const action of actions) {
      try {
        await this.executeAction(serviceName, action, prediction);
        
        await this.sendSlackNotification(
          `🔮 Preventive action executed for ${serviceName}: ${action.type} (${Math.round(prediction.failureProbability * 100)}% failure probability)`
        );
        
      } catch (error) {
        logger.error({
          message: 'Preventive action failed',
          serviceName,
          action: action.type,
          error: error.message
        });
      }
    }
  }

  private async executeAction(serviceName: string, action: PreventiveAction, prediction: FailurePrediction): Promise<void> {
    switch (action.type) {
      case 'scale_up':
        await this.scaleService(serviceName, {
          minInstances: action.parameters.targetInstances,
          reason: `Preventive scaling - ${Math.round(prediction.failureProbability * 100)}% failure probability`
        });
        break;

      case 'restart_unhealthy_instances':
        await this.restartUnhealthyInstances(serviceName, action.parameters);
        break;

      case 'clear_caches':
        await this.clearServiceCaches(serviceName);
        break;

      case 'adjust_circuit_breakers':
        await this.adjustCircuitBreakerThresholds(serviceName, action.parameters);
        break;

      case 'optimize_database_connections':
        await this.optimizeDatabaseConnections(serviceName, action.parameters);
        break;

      case 'enable_debug_logging':
        await this.enableTemporaryDebugLogging(serviceName, action.parameters.durationMinutes);
        break;

      case 'graceful_degradation':
        await this.enableGracefulDegradation(serviceName, action.parameters.features);
        break;

      default:
        logger.warn({
          message: 'Unknown preventive action type',
          serviceName,
          actionType: action.type
        });
    }
  }

  // Enhanced failure handling with learning
  static async handleIntelligentServiceDown(serviceName: string) {
    const responseService = new AdvancedAutomatedResponseService();
    const startTime = Date.now();
    
    logger.error({
      message: 'Intelligent service down handler triggered',
      serviceName,
      action: 'intelligent_recovery',
      timestamp: new Date().toISOString()
    });

    try {
      // 1. Analyze failure context using ML
      const failureContext = await responseService.analyzeFailureContext(serviceName);
      
      // 2. Select optimal recovery strategy based on context
      const recoveryStrategy = await responseService.selectRecoveryStrategy(serviceName, failureContext);
      
      // 3. Execute recovery with monitoring
      const recoveryResult = await responseService.executeIntelligentRecovery(serviceName, recoveryStrategy);
      
      if (recoveryResult.success) {
        const recoveryTime = Date.now() - startTime;
        
        await responseService.sendSlackNotification(
          `✅ Intelligent recovery successful for ${serviceName} in ${recoveryTime}ms using ${recoveryStrategy.type}`
        );
        
        // Learn from successful recovery
        await responseService.recordSuccessfulRecovery(serviceName, recoveryStrategy, recoveryTime);
        
      } else {
        await responseService.escalateWithContext(serviceName, failureContext, recoveryResult);
      }
      
    } catch (error) {
      logger.error({
        message: 'Intelligent recovery failed',
        serviceName,
        error: error.message,
        recoveryTime: Date.now() - startTime
      });
      
      await responseService.escalateToHumans(serviceName, 'intelligent_recovery_failed', error);
    }
  }

  private async analyzeFailureContext(serviceName: string): Promise<FailureContext> {
    // Gather comprehensive failure context
    const [
      recentLogs,
      systemMetrics,
      dependencyHealth,
      circuitBreakerStates,
      deploymentHistory
    ] = await Promise.all([
      this.getRecentErrorLogs(serviceName, 300), // Last 5 minutes
      this.getSystemMetrics(serviceName),
      this.checkDependencyHealth(serviceName),
      this.getCircuitBreakerStates(serviceName),
      this.getRecentDeployments(serviceName, 3600000) // Last hour
    ]);

    return {
      serviceName,
      failureType: this.classifyFailureType(recentLogs, systemMetrics),
      recentChanges: deploymentHistory.length > 0,
      dependencyIssues: dependencyHealth.unhealthyServices,
      resourceExhaustion: this.detectResourceExhaustion(systemMetrics),
      circuitBreakerTriggered: circuitBreakerStates.some(cb => cb.state === 'OPEN'),
      errorPatterns: this.identifyErrorPatterns(recentLogs),
      timestamp: new Date().toISOString()
    };
  }

  private async selectRecoveryStrategy(serviceName: string, context: FailureContext): Promise<RecoveryStrategy> {
    // ML-based strategy selection
    const historicalSuccessRates = await this.getHistoricalRecoverySuccessRates(serviceName, context.failureType);
    
    const strategies = [
      {
        type: 'simple_restart',
        probability: historicalSuccessRates.simple_restart || 0.6,
        estimatedTime: 30000, // 30 seconds
        riskLevel: 'low'
      },
      {
        type: 'rolling_restart',
        probability: historicalSuccessRates.rolling_restart || 0.8,
        estimatedTime: 120000, // 2 minutes
        riskLevel: 'medium'
      },
      {
        type: 'scale_and_restart',
        probability: historicalSuccessRates.scale_and_restart || 0.9,
        estimatedTime: 180000, // 3 minutes
        riskLevel: 'low'
      },
      {
        type: 'rollback_deployment',
        probability: context.recentChanges ? 0.95 : 0.1,
        estimatedTime: 300000, // 5 minutes
        riskLevel: 'high'
      }
    ];

    // Select strategy with highest success probability, considering time constraints
    return strategies
      .filter(s => s.riskLevel !== 'high' || context.recentChanges)
      .sort((a, b) => b.probability - a.probability)[0];
  }
}

// Supporting interfaces and types
interface FailurePrediction {
  serviceName: string;
  failureProbability: number;
  predictedIssues: PredictedIssue[];
  recommendedActions: PreventiveAction[];
  confidence: number;
  timeToFailure: number;
}

interface PredictedIssue {
  issueType: string;
  probability: number;
  description: string;
  evidencePoints: string[];
  recommendedPreventiveActions: string[];
}

interface PreventiveAction {
  type: string;
  priority: number;
  parameters: Record<string, any>;
  estimatedImpact: number;
}

interface FailureContext {
  serviceName: string;
  failureType: string;
  recentChanges: boolean;
  dependencyIssues: string[];
  resourceExhaustion: boolean;
  circuitBreakerTriggered: boolean;
  errorPatterns: string[];
  timestamp: string;
}

interface RecoveryStrategy {
  type: string;
  probability: number;
  estimatedTime: number;
  riskLevel: string;
}
```

#### Continuous Learning System

```typescript
// infrastructure/self-repair/learning-system.ts
export class ContinuousLearningSystem {
  private readonly bigquery = new BigQuery();
  
  // Learn from recovery outcomes to improve future responses
  async recordRecoveryOutcome(outcome: RecoveryOutcome): Promise<void> {
    const learningData = {
      serviceName: outcome.serviceName,
      failureType: outcome.failureContext.failureType,
      recoveryStrategy: outcome.strategy.type,
      success: outcome.success,
      recoveryTimeMs: outcome.recoveryTimeMs,
      failureContext: JSON.stringify(outcome.failureContext),
      timestamp: new Date().toISOString()
    };

    // Store in BigQuery for ML model training
    await this.bigquery
      .dataset('self_repair_learning')
      .table('recovery_outcomes')
      .insert([learningData]);

    // Update success rate cache
    await this.updateSuccessRateCache(outcome);
  }

  // Retrain ML model weekly with new data
  async retrainFailurePredictionModel(): Promise<void> {
    logger.info({
      message: 'Starting ML model retraining',
      action: 'model_retrain'
    });

    const trainingData = await this.prepareTrainingData();
    
    if (trainingData.length < 100) {
      logger.warn({
        message: 'Insufficient training data for model update',
        dataPoints: trainingData.length
      });
      return;
    }

    // Trigger AutoML model training
    await this.triggerAutoMLTraining(trainingData);
  }

  private async prepareTrainingData(): Promise<any[]> {
    const query = `
      SELECT 
        ro.service_name,
        ro.failure_type,
        ro.recovery_strategy,
        ro.success,
        ro.recovery_time_ms,
        JSON_EXTRACT_SCALAR(ro.failure_context, '$.resourceExhaustion') as resource_exhaustion,
        JSON_EXTRACT_SCALAR(ro.failure_context, '$.dependencyIssues') as dependency_issues,
        JSON_EXTRACT_SCALAR(ro.failure_context, '$.recentChanges') as recent_changes,
        -- Add system metrics at time of failure
        sm.cpu_utilization,
        sm.memory_utilization,
        sm.error_rate,
        sm.response_time_p95
      FROM \`${process.env.GOOGLE_CLOUD_PROJECT}.self_repair_learning.recovery_outcomes\` ro
      LEFT JOIN \`${process.env.GOOGLE_CLOUD_PROJECT}.service_metrics.system_metrics\` sm
        ON ro.service_name = sm.service_name 
        AND TIMESTAMP_DIFF(sm.timestamp, TIMESTAMP(ro.timestamp), SECOND) BETWEEN -300 AND 0
      WHERE ro.timestamp >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 30 DAY)
      ORDER BY ro.timestamp DESC
    `;

    const [rows] = await this.bigquery.query(query);
    return rows;
  }
}
```

### 🌐 Advanced Load Balancing Strategy with Health-Aware Traffic Routing

Inteligentní traffic routing optimalizující distribution na základě service health, circuit breaker states a real-time performance metrics pro optimal user experience.

#### Health-Aware Load Balancer Implementation

```typescript
// infrastructure/load-balancing/health-aware-balancer.ts
import { CircuitBreakerService } from '../resilience/circuit-breaker';

export class HealthAwareLoadBalancer {
  private readonly circuitBreakerService = new CircuitBreakerService();
  private readonly serviceInstances = new Map<string, ServiceInstance[]>();
  private readonly healthScores = new Map<string, HealthScore>();
  
  // Intelligent routing based on comprehensive health assessment
  async routeRequest(serviceName: string, request: any): Promise<ServiceInstance> {
    const availableInstances = await this.getHealthyInstances(serviceName);
    
    if (availableInstances.length === 0) {
      throw new Error(`No healthy instances available for ${serviceName}`);
    }
    
    // Calculate routing weights based on multiple factors
    const routingDecision = await this.calculateOptimalRouting(availableInstances, request);
    
    logger.info({
      message: 'Intelligent routing decision made',
      serviceName,
      selectedInstance: routingDecision.instance.id,
      routingScore: routingDecision.score,
      availableInstances: availableInstances.length,
      routingFactors: routingDecision.factors
    });
    
    return routingDecision.instance;
  }

  private async getHealthyInstances(serviceName: string): Promise<ServiceInstance[]> {
    const allInstances = this.serviceInstances.get(serviceName) || [];
    const healthyInstances: ServiceInstance[] = [];
    
    for (const instance of allInstances) {
      const healthAssessment = await this.assessInstanceHealth(instance);
      
      if (healthAssessment.isHealthy) {
        healthyInstances.push({
          ...instance,
          healthScore: healthAssessment.score,
          lastHealthCheck: new Date().toISOString()
        });
      }
    }
    
    return healthyInstances.sort((a, b) => b.healthScore - a.healthScore);
  }

  private async assessInstanceHealth(instance: ServiceInstance): Promise<HealthAssessment> {
    const assessmentFactors = await Promise.all([
      this.checkLivenessEndpoint(instance),
      this.checkReadinessEndpoint(instance),
      this.checkCircuitBreakerStatus(instance),
      this.checkPerformanceMetrics(instance),
      this.checkResourceUtilization(instance)
    ]);

    const [liveness, readiness, circuitBreaker, performance, resources] = assessmentFactors;
    
    // Weighted health score calculation
    const healthScore = (
      liveness.score * 0.3 +           // 30% - Basic service availability
      readiness.score * 0.25 +         // 25% - Service readiness for requests
      circuitBreaker.score * 0.2 +     // 20% - Circuit breaker health
      performance.score * 0.15 +       // 15% - Performance metrics
      resources.score * 0.1            // 10% - Resource utilization
    );

    const isHealthy = (
      liveness.healthy &&
      readiness.healthy &&
      circuitBreaker.healthy &&
      healthScore > 0.7  // Minimum health threshold
    );

    return {
      isHealthy,
      score: healthScore,
      factors: {
        liveness: liveness.score,
        readiness: readiness.score,
        circuitBreaker: circuitBreaker.score,
        performance: performance.score,
        resources: resources.score
      },
      lastChecked: new Date().toISOString()
    };
  }

  private async checkLivenessEndpoint(instance: ServiceInstance): Promise<HealthFactor> {
    try {
      const response = await fetch(`${instance.baseUrl}/live`, {
        method: 'GET',
        timeout: 5000,
        headers: { 'X-Health-Check': 'load-balancer' }
      });

      return {
        healthy: response.ok,
        score: response.ok ? 1.0 : 0.0,
        responseTime: Date.now() - instance.lastRequestTime,
        details: response.ok ? 'Service alive' : `HTTP ${response.status}`
      };
    } catch (error) {
      return {
        healthy: false,
        score: 0.0,
        responseTime: 5000,
        details: `Liveness check failed: ${error.message}`
      };
    }
  }

  private async checkReadinessEndpoint(instance: ServiceInstance): Promise<HealthFactor> {
    try {
      const response = await fetch(`${instance.baseUrl}/ready`, {
        method: 'GET',
        timeout: 3000,
        headers: { 'X-Health-Check': 'load-balancer' }
      });

      if (response.ok) {
        const readinessData = await response.json();
        
        // Enhanced readiness assessment based on response content
        const readinessScore = this.calculateReadinessScore(readinessData);
        
        return {
          healthy: readinessScore > 0.8,
          score: readinessScore,
          responseTime: Date.now() - instance.lastRequestTime,
          details: `Readiness score: ${readinessScore}`
        };
      } else {
        return {
          healthy: false,
          score: 0.0,
          responseTime: 3000,
          details: `Readiness check failed: HTTP ${response.status}`
        };
      }
    } catch (error) {
      return {
        healthy: false,
        score: 0.0,
        responseTime: 3000,
        details: `Readiness check error: ${error.message}`
      };
    }
  }

  private calculateReadinessScore(readinessData: any): number {
    let score = 1.0;
    
    // Reduce score based on various readiness factors
    if (readinessData.checks?.database === 'error') score -= 0.3;
    if (readinessData.checks?.rabbitmq === 'error') score -= 0.2;
    if (readinessData.checks?.memory?.percentage > 90) score -= 0.2;
    if (readinessData.responseTimeMs > 1000) score -= 0.1;
    if (readinessData.pendingRequests > 50) score -= 0.2;
    
    return Math.max(0, score);
  }

  private async checkCircuitBreakerStatus(instance: ServiceInstance): Promise<HealthFactor> {
    const circuitBreakerStates = await this.circuitBreakerService.getServiceStates(instance.serviceName);
    
    let openBreakers = 0;
    let totalBreakers = 0;
    
    for (const [dependency, state] of Object.entries(circuitBreakerStates)) {
      totalBreakers++;
      if (state.state === 'OPEN') {
        openBreakers++;
      }
    }
    
    const healthyBreakersRatio = totalBreakers > 0 ? (totalBreakers - openBreakers) / totalBreakers : 1.0;
    
    return {
      healthy: openBreakers === 0,
      score: healthyBreakersRatio,
      responseTime: 0,
      details: `Circuit breakers: ${openBreakers}/${totalBreakers} open`
    };
  }

  private async calculateOptimalRouting(instances: ServiceInstance[], request: any): Promise<RoutingDecision> {
    const routingCandidates = await Promise.all(
      instances.map(async (instance) => {
        const routingScore = await this.calculateRoutingScore(instance, request);
        return { instance, score: routingScore.score, factors: routingScore.factors };
      })
    );

    // Sort by routing score (higher is better)
    routingCandidates.sort((a, b) => b.score - a.score);
    
    // Apply weighted random selection among top candidates for load distribution
    const topCandidates = routingCandidates.slice(0, Math.min(3, routingCandidates.length));
    const selectedCandidate = this.weightedRandomSelection(topCandidates);
    
    return selectedCandidate;
  }

  private async calculateRoutingScore(instance: ServiceInstance, request: any): Promise<RoutingScore> {
    const factors = {
      healthScore: instance.healthScore || 0.5,
      responseTime: await this.getAverageResponseTime(instance),
      currentLoad: await this.getCurrentLoadScore(instance),
      geographicAffinity: this.calculateGeographicAffinity(instance, request),
      specialization: this.calculateSpecializationScore(instance, request)
    };

    // Weighted routing score calculation
    const score = (
      factors.healthScore * 0.4 +        // 40% - Instance health
      (1 - factors.responseTime) * 0.25 + // 25% - Response time (lower is better)
      (1 - factors.currentLoad) * 0.2 +   // 20% - Current load (lower is better)
      factors.geographicAffinity * 0.1 +  // 10% - Geographic proximity
      factors.specialization * 0.05       // 5% - Request specialization
    );

    return { score, factors };
  }

  private async getCurrentLoadScore(instance: ServiceInstance): Promise<number> {
    // Get current request count and response times
    const currentMetrics = await this.getInstanceMetrics(instance);
    
    const loadFactors = {
      activeRequests: Math.min(currentMetrics.activeRequests / 100, 1.0), // Normalize to 0-1
      cpuUtilization: currentMetrics.cpuUtilization / 100,
      memoryUtilization: currentMetrics.memoryUtilization / 100,
      queueDepth: Math.min(currentMetrics.queueDepth / 50, 1.0)
    };

    // Combined load score (higher means more loaded)
    return (loadFactors.activeRequests * 0.4 + 
            loadFactors.cpuUtilization * 0.3 + 
            loadFactors.memoryUtilization * 0.2 + 
            loadFactors.queueDepth * 0.1);
  }

  private weightedRandomSelection(candidates: RoutingCandidate[]): RoutingDecision {
    const totalWeight = candidates.reduce((sum, candidate) => sum + candidate.score, 0);
    const randomValue = Math.random() * totalWeight;
    
    let currentWeight = 0;
    for (const candidate of candidates) {
      currentWeight += candidate.score;
      if (randomValue <= currentWeight) {
        return candidate;
      }
    }
    
    // Fallback to highest scoring candidate
    return candidates[0];
  }
}

// Usage integration with API Gateway
export class IntelligentAPIGateway {
  private readonly loadBalancer = new HealthAwareLoadBalancer();
  private readonly requestTracker = new Map<string, RequestMetrics>();

  async routeRequest(serviceName: string, request: Request): Promise<Response> {
    const startTime = Date.now();
    const requestId = this.generateRequestId();
    
    try {
      // Get optimal service instance
      const targetInstance = await this.loadBalancer.routeRequest(serviceName, {
        ...request,
        requestId,
        clientRegion: this.extractClientRegion(request)
      });

      // Forward request to selected instance
      const response = await this.forwardRequest(targetInstance, request, requestId);
      
      // Track successful routing
      await this.trackRequestSuccess(serviceName, targetInstance, Date.now() - startTime);
      
      return response;
      
    } catch (error) {
      // Handle routing failure with fallback
      logger.error({
        message: 'Request routing failed',
        serviceName,
        requestId,
        error: error.message,
        duration: Date.now() - startTime
      });
      
      return await this.handleRoutingFailure(serviceName, request, error);
    }
  }

  private async handleRoutingFailure(serviceName: string, request: Request, error: Error): Promise<Response> {
    // Implement graceful degradation based on service criticality
    const fallbackStrategies = {
      'user-service': () => this.returnCachedUserData(request),
      'order-service': () => this.queueOrderForLaterProcessing(request),
      'inventory-service': () => this.returnEstimatedStock(request),
      'billing-service': () => this.deferBillingOperation(request),
      'notification-service': () => this.queueNotification(request)
    };

    const fallbackHandler = fallbackStrategies[serviceName];
    if (fallbackHandler) {
      logger.info({
        message: 'Executing fallback strategy',
        serviceName,
        strategy: 'graceful_degradation'
      });
      
      return await fallbackHandler();
    }

    // Default error response
    return new Response(JSON.stringify({
      error: 'Service temporarily unavailable',
      serviceName,
      requestId: this.generateRequestId(),
      retryAfter: 30
    }), {
      status: 503,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': '30'
      }
    });
  }
}

// Supporting types and interfaces
interface ServiceInstance {
  id: string;
  serviceName: string;
  baseUrl: string;
  healthScore?: number;
  lastHealthCheck?: string;
  lastRequestTime?: number;
  region?: string;
  specializations?: string[];
}

interface HealthAssessment {
  isHealthy: boolean;
  score: number;
  factors: {
    liveness: number;
    readiness: number;
    circuitBreaker: number;
    performance: number;
    resources: number;
  };
  lastChecked: string;
}

interface HealthFactor {
  healthy: boolean;
  score: number;
  responseTime: number;
  details: string;
}

interface RoutingScore {
  score: number;
  factors: {
    healthScore: number;
    responseTime: number;
    currentLoad: number;
    geographicAffinity: number;
    specialization: number;
  };
}

interface RoutingCandidate {
  instance: ServiceInstance;
  score: number;
  factors: any;
}

interface RoutingDecision extends RoutingCandidate {}
```

#### Google Cloud Load Balancer Configuration

```yaml
# infrastructure/load-balancing/cloud-lb-config.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: health-aware-lb-config
data:
  # Advanced Cloud Load Balancer configuration
  backend-config.yml: |
    apiVersion: cloud.google.com/v1
    kind: BackendConfig
    metadata:
      name: health-aware-backend-config
    spec:
      healthCheck:
        checkIntervalSec: 10
        timeoutSec: 5
        healthyThreshold: 1
        unhealthyThreshold: 3
        type: HTTP
        requestPath: /ready  # Use enhanced readiness endpoint
        port: 8080
      
      # Connection draining for graceful shutdowns
      connectionDraining:
        drainingTimeoutSec: 60
      
      # Session affinity for stateful requests
      sessionAffinity:
        affinityType: "CLIENT_IP"
        affinityCookieTtlSec: 3600
      
      # Custom health check with business logic
      customHealthCheck:
        checkIntervalSec: 15
        healthyThreshold: 2
        unhealthyThreshold: 2
        requestPath: /health/business
        responseContentMatch: "business_ready:true"
      
      # Load balancing algorithm
      loadBalancingScheme: "EXTERNAL"
      balancingMode: "UTILIZATION"
      maxUtilization: 0.8  # Scale when 80% utilized
      
      # Circuit breaker integration
      outlierDetection:
        consecutiveErrors: 5
        interval: 30s
        baseEjectionTime: 30s
        maxEjectionPercent: 50
        minHealthPercent: 50

---
apiVersion: networking.gke.io/v1
kind: ManagedCertificate
metadata:
  name: firemni-asistent-ssl-cert
spec:
  domains:
    - api.firemni-asistent.com
    - "*.firemni-asistent.com"

---
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: intelligent-load-balancer
  annotations:
    kubernetes.io/ingress.global-static-ip-name: "firemni-asistent-ip"
    networking.gke.io/managed-certificates: "firemni-asistent-ssl-cert"
    cloud.google.com/backend-config: '{"default": "health-aware-backend-config"}'
    # Advanced routing rules
    nginx.ingress.kubernetes.io/configuration-snippet: |
      # Health-aware routing decisions
      set $backend_pool "default";
      
      # Route based on service health scores
      if ($http_x_service_health_score < "0.7") {
        set $backend_pool "degraded";
      }
      
      # Geographic routing optimization
      if ($geoip_country_code = "CZ") {
        set $backend_pool "prague";
      }
      
      # Business priority routing
      if ($http_x_business_priority = "high") {
        set $backend_pool "premium";
      }
      
      # Circuit breaker aware routing
      if ($http_x_circuit_breaker_state = "OPEN") {
        return 503 '{"error": "Service temporarily unavailable", "retry_after": 30}';
      }
spec:
  rules:
  - host: api.firemni-asistent.com
    http:
      paths:
      - path: /users/*
        pathType: Prefix
        backend:
          service:
            name: user-service
            port:
              number: 80
      - path: /orders/*
        pathType: Prefix
        backend:
          service:
            name: order-service
            port:
              number: 80
      - path: /inventory/*
        pathType: Prefix
        backend:
          service:
            name: inventory-service
            port:
              number: 80
      - path: /billing/*
        pathType: Prefix
        backend:
          service:
            name: billing-service
            port:
              number: 80
      - path: /customers/*
        pathType: Prefix
        backend:
          service:
            name: customer-service
            port:
              number: 80
      - path: /notifications/*
        pathType: Prefix
        backend:
          service:
            name: notification-service
            port:
              number: 80
```

#### Integration with Circuit Breaker System

```typescript
// infrastructure/load-balancing/circuit-breaker-integration.ts
export class CircuitBreakerAwareRouting {
  private readonly circuitBreakerService = new CircuitBreakerService();
  
  // Modify routing decisions based on circuit breaker states
  async adjustRoutingForCircuitBreakers(serviceName: string, instances: ServiceInstance[]): Promise<ServiceInstance[]> {
    const availableInstances: ServiceInstance[] = [];
    
    for (const instance of instances) {
      const circuitBreakerStates = await this.circuitBreakerService.getServiceStates(instance.serviceName);
      
      // Calculate circuit breaker health impact
      const circuitBreakerScore = this.calculateCircuitBreakerScore(circuitBreakerStates);
      
      if (circuitBreakerScore > 0.3) { // Minimum circuit breaker health threshold
        availableInstances.push({
          ...instance,
          circuitBreakerScore,
          adjustedHealthScore: (instance.healthScore || 0.5) * circuitBreakerScore
        });
      } else {
        logger.warn({
          message: 'Instance excluded due to circuit breaker state',
          instanceId: instance.id,
          serviceName: instance.serviceName,
          circuitBreakerScore
        });
      }
    }
    
    return availableInstances.sort((a, b) => b.adjustedHealthScore - a.adjustedHealthScore);
  }

  private calculateCircuitBreakerScore(states: Record<string, CircuitBreakerState>): number {
    const stateEntries = Object.entries(states);
    if (stateEntries.length === 0) return 1.0;
    
    let totalScore = 0;
    for (const [dependency, state] of stateEntries) {
      switch (state.state) {
        case 'CLOSED':
          totalScore += 1.0;
          break;
        case 'HALF_OPEN':
          totalScore += 0.7;
          break;
        case 'OPEN':
          totalScore += 0.0;
          break;
      }
    }
    
    return totalScore / stateEntries.length;
  }

  // Proactive circuit breaker management
  async manageCircuitBreakersBasedOnLoad(serviceName: string, currentLoad: number): Promise<void> {
    if (currentLoad > 0.9) {
      // High load - be more aggressive with circuit breakers
      await this.circuitBreakerService.adjustThresholds(serviceName, {
        failureThreshold: 3,     // Reduced from default 5
        timeout: 30000,          // Reduced from default 60000
        resetTimeout: 120000     // Increased recovery time
      });
      
      logger.info({
        message: 'Circuit breaker thresholds adjusted for high load',
        serviceName,
        currentLoad,
        action: 'aggressive_protection'
      });
    } else if (currentLoad < 0.3) {
      // Low load - be more lenient with circuit breakers
      await this.circuitBreakerService.adjustThresholds(serviceName, {
        failureThreshold: 8,     // Increased tolerance
        timeout: 60000,          // Default timeout
        resetTimeout: 60000      // Faster recovery
      });
    }
  }
}
```

#### Monitoring and Analytics for Load Balancing

```typescript
// infrastructure/load-balancing/lb-analytics.ts
export class LoadBalancingAnalytics {
  private readonly bigquery = new BigQuery();
  
  // Track routing decisions for optimization
  async trackRoutingDecision(decision: {
    serviceName: string;
    selectedInstanceId: string;
    alternativeInstances: string[];
    routingScore: number;
    responseTime: number;
    success: boolean;
    timestamp: string;
  }): Promise<void> {
    await this.bigquery
      .dataset('load_balancing_analytics')
      .table('routing_decisions')
      .insert([{
        ...decision,
        hour_of_day: new Date().getHours(),
        day_of_week: new Date().getDay()
      }]);
  }

  // Analyze routing effectiveness and suggest optimizations
  async analyzeRoutingEffectiveness(): Promise<RoutingOptimizationRecommendations> {
    const query = `
      WITH routing_performance AS (
        SELECT 
          service_name,
          selected_instance_id,
          AVG(response_time) as avg_response_time,
          AVG(routing_score) as avg_routing_score,
          COUNT(*) as request_count,
          AVG(CASE WHEN success THEN 1.0 ELSE 0.0 END) as success_rate,
          STDDEV(response_time) as response_time_variance
        FROM \`${process.env.GOOGLE_CLOUD_PROJECT}.load_balancing_analytics.routing_decisions\`
        WHERE timestamp >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 24 HOUR)
        GROUP BY service_name, selected_instance_id
      ),
      instance_rankings AS (
        SELECT 
          service_name,
          selected_instance_id,
          avg_response_time,
          success_rate,
          request_count,
          -- Calculate efficiency score
          (success_rate * 0.6 + (1 - avg_response_time/1000) * 0.4) as efficiency_score,
          ROW_NUMBER() OVER (PARTITION BY service_name ORDER BY success_rate DESC, avg_response_time ASC) as performance_rank
        FROM routing_performance
        WHERE request_count >= 10  -- Minimum sample size
      )
      SELECT 
        service_name,
        selected_instance_id,
        avg_response_time,
        success_rate,
        efficiency_score,
        performance_rank,
        CASE 
          WHEN performance_rank = 1 THEN 'optimal'
          WHEN performance_rank <= 3 THEN 'good'
          WHEN success_rate < 0.95 THEN 'problematic'
          ELSE 'acceptable'
        END as instance_category
      FROM instance_rankings
      ORDER BY service_name, performance_rank
    `;

    const [rows] = await this.bigquery.query(query);
    return this.generateOptimizationRecommendations(rows);
  }

  private generateOptimizationRecommendations(analysisData: any[]): RoutingOptimizationRecommendations {
    const recommendations: RoutingOptimizationRecommendations = {
      serviceRecommendations: {},
      globalInsights: []
    };

    // Group by service
    const serviceGroups = analysisData.reduce((groups, row) => {
      if (!groups[row.service_name]) {
        groups[row.service_name] = [];
      }
      groups[row.service_name].push(row);
      return groups;
    }, {});

    for (const [serviceName, instances] of Object.entries(serviceGroups)) {
      const problematicInstances = instances.filter(i => i.instance_category === 'problematic');
      const optimalInstances = instances.filter(i => i.instance_category === 'optimal');

      recommendations.serviceRecommendations[serviceName] = {
        actions: [],
        insights: []
      };

      if (problematicInstances.length > 0) {
        recommendations.serviceRecommendations[serviceName].actions.push({
          type: 'investigate_instances',
          priority: 'high',
          instances: problematicInstances.map(i => i.selected_instance_id),
          reason: 'Low success rate or high response times detected'
        });
      }

      if (optimalInstances.length > 0) {
        recommendations.serviceRecommendations[serviceName].actions.push({
          type: 'increase_traffic_weight',
          priority: 'medium',
          instances: optimalInstances.map(i => i.selected_instance_id),
          reason: 'Consistently high performance'
        });
      }
    }

    return recommendations;
  }
}

interface RoutingOptimizationRecommendations {
  serviceRecommendations: Record<string, {
    actions: Array<{
      type: string;
      priority: string;
      instances: string[];
      reason: string;
    }>;
    insights: string[];
  }>;
  globalInsights: string[];
}
```

### Logging Configuration
```typescript
// shared/logger.ts
import winston from 'winston';
import { LoggingWinston } from '@google-cloud/logging-winston';

const loggingWinston = new LoggingWinston({
  projectId: process.env.GOOGLE_CLOUD_PROJECT,
  keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
});

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { 
    service: process.env.SERVICE_NAME,
    version: process.env.SERVICE_VERSION 
  },
  transports: [
    process.env.NODE_ENV === 'production' 
      ? loggingWinston 
      : new winston.transports.Console({
          format: winston.format.simple()
        })
  ],
});
```

### Health Check Implementation
```typescript
// shared/health-check.ts
import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';

interface HealthStatus {
  status: 'ok' | 'error';
  timestamp: string;
  uptime: number;
  checks: {
    database: 'ok' | 'error';
    rabbitmq: 'ok' | 'error';
    memory: {
      used: number;
      total: number;
      percentage: number;
    };
  };
}

export async function registerHealthChecks(
  fastify: FastifyInstance,
  prisma: PrismaClient
) {
  // Basic health check
  fastify.get('/health', async (request, reply) => {
    const status: HealthStatus = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      checks: {
        database: 'ok',
        rabbitmq: 'ok',
        memory: {
          used: process.memoryUsage().heapUsed,
          total: process.memoryUsage().heapTotal,
          percentage: (process.memoryUsage().heapUsed / process.memoryUsage().heapTotal) * 100
        }
      }
    };

    try {
      // Check database connection
      await prisma.$queryRaw`SELECT 1`;
    } catch (error) {
      status.checks.database = 'error';
      status.status = 'error';
    }

    // Check RabbitMQ connection would go here
    
    reply.code(status.status === 'ok' ? 200 : 503).send(status);
  });

  // Readiness check (used by Cloud Run)
  fastify.get('/health/ready', async (request, reply) => {
    // More thorough checks for readiness
    reply.send({ status: 'ready' });
  });
}
```

### Metrics Collection
```typescript
// shared/metrics.ts
import promClient from 'prom-client';

// Create metrics registry
export const register = new promClient.Registry();

// Default metrics (CPU, memory, etc.)
promClient.collectDefaultMetrics({ register });

// Custom business metrics
export const httpRequestDuration = new promClient.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 0.5, 1, 2, 5, 10]
});

export const businessOperationCounter = new promClient.Counter({
  name: 'business_operations_total',
  help: 'Total number of business operations',
  labelNames: ['operation_type', 'status']
});

register.registerMetric(httpRequestDuration);
register.registerMetric(businessOperationCounter);

// Metrics endpoint
export function setupMetricsEndpoint(fastify: FastifyInstance) {
  fastify.get('/metrics', async (request, reply) => {
    reply.type(register.contentType);
    return register.metrics();
  });
}
```

---

## Backup & Recovery Strategy

### Database Backup
```bash
# Automated daily backups (configured in Cloud SQL)
gcloud sql instances patch firemni-asistent-db \
  --backup-start-time=03:00 \
  --retained-backups-count=14 \
  --retained-transaction-log-days=7

# Manual backup script
#!/bin/bash
# scripts/backup-database.sh
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
gcloud sql export sql firemni-asistent-db \
  gs://firemni-asistent-backups/manual-backup-${TIMESTAMP}.sql \
  --database=user_service_db,customer_service_db,order_service_db,inventory_service_db,billing_service_db,notification_service_db
```

### Disaster Recovery Plan
1. **Database Recovery**: Restore from Cloud SQL backup
2. **Service Recovery**: Redeploy from latest Git tag
3. **Data Recovery**: Restore from Google Cloud Storage backups
4. **RTO Target**: < 4 hours
5. **RPO Target**: < 24 hours

---

## Security Measures

### Service Account Configuration
```bash
# Create service account for Cloud Run services
gcloud iam service-accounts create firemni-asistent-services \
  --display-name="Firemni Asistent Services"

# Grant minimal required permissions
gcloud projects add-iam-policy-binding firemni-asistent \
  --member="serviceAccount:firemni-asistent-services@firemni-asistent.iam.gserviceaccount.com" \
  --role="roles/cloudsql.client"

gcloud projects add-iam-policy-binding firemni-asistent \
  --member="serviceAccount:firemni-asistent-services@firemni-asistent.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

### Network Security
```bash
# Create VPC connector for private communication
gcloud compute networks vpc-access connectors create firemni-asistent-connector \
  --region=europe-west1 \
  --subnet=default \
  --subnet-project=firemni-asistent \
  --min-instances=2 \
  --max-instances=10
```

---

## Logging and Monitoring Strategy

Naše logging strategie je navržena pro efektivní debugging a monitoring napříč všemi prostředími. Využívá strukturované JSON logy automaticky zpracovávané Google Cloud Operations Suite. Pro detailní průvodce formáty logů, úrovně a best practices viz [LOGGING.md](./LOGGING.md).

### Configuration in CI/CD Pipeline

Environment variables řídí výstup logů a musí být konfigurovány v CI/CD pipeline a deployment configurations:

```yaml
# Logging environment variables in GitHub Actions
- name: Deploy to Cloud Run
  run: |
    gcloud run deploy ${{ matrix.service }} \
      --image ${{ env.REGISTRY }}/${{ env.PROJECT_ID }}/${{ matrix.service }}:${{ github.sha }} \
      --set-env-vars "NODE_ENV=production" \
      --set-env-vars "LOG_LEVEL=info" \
      --set-env-vars "SERVICE_NAME=${{ matrix.service }}" \
      --set-env-vars "SERVICE_VERSION=${{ github.sha }}" \
      --set-secrets "SENTRY_DSN=sentry-dsn:latest"
```

**Log Level Configuration:**
- **Development**: `LOG_LEVEL=debug` - detailní tracing pro debugging
- **Staging**: `LOG_LEVEL=info` - standardní operační logy
- **Production**: `LOG_LEVEL=info` - balance mezi insight a performance

### Log Management in Cloud Run

Cloud Run služby jsou nativně integrovány s Cloud Logging. Všechny logy zapisované na `stdout`/`stderr` jsou automaticky sbírány, parsovány a dostupné pro vyhledávání.

**Klíčové vlastnosti:**
- **Automatické parsování**: JSON formát umožňuje Cloud Logging parsovat payload do searchable fields
- **Log Explorer**: Použijte [Logs Explorer](https://console.cloud.google.com/logs/viewer) pro viewing, searching a filtering
- **Correlation tracking**: Sledujte requesty napříč mikroslužbami pomocí `correlationId`

**Příklad dotazu v Log Explorer:**
```bash
# Najít všechny error logy pro specifickou transakci
jsonPayload.level>=50
jsonPayload.correlationId="xyz-abc-123"

# Sledovat performance konkrétní operace
jsonPayload.operationName="OrderService.createOrder"
jsonPayload.duration>1000

# Monitrovat konkrétní službu
resource.labels.service_name="user-service"
jsonPayload.level>=40
```

### Log-Based Metrics and Alerting

Využíváme Log-Based Metrics v Cloud Monitoring pro proaktivní monitoring:

```yaml
# Example: High Error Rate Alert
alertPolicy:
  displayName: "High Error Rate - Firemní Asistent"
  conditions:
    - displayName: "Error rate > 5% in 5 minutes"
      conditionThreshold:
        filter: |
          resource.type="cloud_run_revision"
          jsonPayload.level>=50
          jsonPayload.service=~"user-service|order-service|billing-service"
        comparison: COMPARISON_GREATER_THAN
        thresholdValue: 0.05
        duration: "300s"
        
  notificationChannels:
    - projects/firemni-asistent/notificationChannels/EMAIL_CHANNEL
    - projects/firemni-asistent/notificationChannels/SLACK_CHANNEL
```

**Doporučené alerty:**
1. **High Error Rate**: >5% errors in 5 minutes
2. **Slow Operations**: Operations >2s duration
3. **Failed Authentication**: >10 failed logins in 1 minute
4. **Database Issues**: Connection errors or slow queries
5. **Service Unavailability**: Health check failures

### Cost Optimization

Cloud Logging má associated costs. Implementujeme log exclusion filters pro high-volume, low-value logy:

```bash
# Exclude health check logs
gcloud logging sinks create exclude-health-checks \
  bigquery.googleapis.com/projects/PROJECT_ID/datasets/DATASET_ID \
  --log-filter='NOT (jsonPayload.url="/health" AND jsonPayload.statusCode=200)'

# Exclude debug logs in production
gcloud logging sinks create exclude-debug-prod \
  bigquery.googleapis.com/projects/PROJECT_ID/datasets/DATASET_ID \
  --log-filter='NOT (jsonPayload.level<30 AND jsonPayload.environment="production")'
```

### Development Log Tools

```bash
# Local development log viewing
npm run logs              # All services
npm run logs:user         # Specific service
npm run logs:errors       # Only errors
npm run logs:grep "ORDER" # Search in logs

# Docker compose log management
docker-compose logs -f --tail=100 user-service
docker-compose logs --since="1h" | grep "ERROR"

# Log analysis
npm run logs:analyze      # Performance analysis
npm run logs:correlate    # Correlation ID tracking
```

### Monitoring Dashboard Setup

```typescript
// infrastructure/monitoring/dashboard-config.ts
export const loggingDashboard = {
  displayName: 'Firemní Asistent - Application Logs',
  widgets: [
    {
      title: 'Error Rate by Service',
      xyChart: {
        dataSets: [
          {
            timeSeriesQuery: {
              timeSeriesFilter: {
                filter: 'resource.type="cloud_run_revision" jsonPayload.level>=50',
                aggregation: {
                  alignmentPeriod: '60s',
                  perSeriesAligner: 'ALIGN_RATE',
                  crossSeriesReducer: 'REDUCE_SUM',
                  groupByFields: ['jsonPayload.service']
                }
              }
            }
          }
        ]
      }
    },
    {
      title: 'Response Time P95',
      xyChart: {
        dataSets: [
          {
            timeSeriesQuery: {
              timeSeriesFilter: {
                filter: 'resource.type="cloud_run_revision" jsonPayload.duration!=null',
                aggregation: {
                  alignmentPeriod: '60s',
                  perSeriesAligner: 'ALIGN_DELTA',
                  crossSeriesReducer: 'REDUCE_PERCENTILE_95',
                  groupByFields: ['jsonPayload.service']
                }
              }
            }
          }
        ]
      }
    }
  ]
};
```

---

Tato DevOps strategie poskytuje robustní, automatizovaný a škálovatelný základ pro development a deployment Firemní Asistent aplikace s minimální operační zátěží a comprehensive observability.