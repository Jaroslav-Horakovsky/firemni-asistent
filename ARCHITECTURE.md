# Architektura - Firemní Asistent

## Technologický Stack

### Backend
- **Jazyk**: Node.js 20+ s TypeScript
- **Framework**: Fastify (vysoký výkon, nativní TypeScript podpora)
- **GraphQL**: Apollo Server s Federation v2
- **ORM**: Prisma (typová bezpečnost, auto-generované typy)
- **Validace**: Zod (runtime typová validace)

### Cloud & Infrastructure
- **Cloud Provider**: Google Cloud Platform (GCP)
- **Deployment**: Cloud Run (serverless containers)
- **Database**: Google Cloud SQL for PostgreSQL 15+
- **Message Broker**: CloudAMQP (spravovaný RabbitMQ)
- **File Storage**: Google Cloud Storage
- **Monitoring**: Google Cloud Operations Suite

### Frontend
- **Desktop**: Electron + React + TypeScript
- **Mobile**: React Native + TypeScript
- **GraphQL Client**: Apollo Client s code generation

---

## Mikroslužbová Architektura

### Service Breakdown

#### 1. User Service (`user-service`)
**Odpovědnost**: Správa uživatelů, autentizace, autorizace
- **Port**: 3001
- **Database**: `user_service_db`
- **GraphQL Federation**: Definuje základní `User` typ
- **Key Operations**:
  - Registrace/přihlášení uživatelů
  - JWT token management
  - Role-based access control (RBAC)
  - Password reset

#### 2. Customer Service (`customer-service`)
**Odpovědность**: Správa zákazníků a klientů
- **Port**: 3002
- **Database**: `customer_service_db`
- **GraphQL Federation**: Definuje `Customer` typ
- **Key Operations**:
  - CRUD operace pro zákazníky
  - Správa kontaktních osob
  - GDPR compliance (souhlas management)

#### 3. Order Service (`order-service`)
**Odpovědnost**: Správa zakázek, jádro business logiky
- **Port**: 3003
- **Database**: `order_service_db`
- **GraphQL Federation**: Definuje `Order` typ, rozšiřuje `User` a `Customer`
- **Key Operations**:
  - Vytváření a správa zakázek
  - Přiřazování pracovníků
  - Evidence práce a materiálu
  - Výpočet nákladů

#### 4. Inventory Service (`inventory-service`)
**Odpovědnost**: Správa skladu a materiálu
- **Port**: 3004
- **Database**: `inventory_service_db`
- **GraphQL Federation**: Definuje `Material`, `Supplier` typy
- **Key Operations**:
  - Skladová evidence
  - Automatické objednávky (low stock alerts)
  - Správa dodavatelů

#### 5. Billing Service (`billing-service`)
**Odpovědnost**: Fakturace a platby
- **Port**: 3005
- **Database**: `billing_service_db`
- **GraphQL Federation**: Definuje `Invoice` typ
- **Key Operations**:
  - Automatické generování faktur
  - Export do PDF
  - Integration s účetními systémy
  - Payment tracking

#### 6. Notification Service (`notification-service`)
**Odpovědnost**: Komunikace a notifikace
- **Port**: 3006
- **Database**: `notification_service_db`
- **GraphQL Federation**: Definuje `Notification` typ
- **Key Operations**:
  - Email notifikace
  - In-app messages
  - SMS integrace (budoucnost)
  - Push notifications (mobile)

### API Gateway
- **Apollo Router**: Federuje GraphQL schema z všech služeb
- **Port**: 3000
- **Features**:
  - Schema composition
  - Query planning a execution
  - Authentication middleware
  - Rate limiting
  - Caching

---

## Database Design

### Database per Service Strategy

Každá mikroslužba má vlastní logicky oddělenou databázi v rámci jedné PostgreSQL instance:

```sql
-- Single PostgreSQL instance with multiple databases
CREATE DATABASE user_service_db;
CREATE DATABASE customer_service_db;
CREATE DATABASE order_service_db;
CREATE DATABASE inventory_service_db;
CREATE DATABASE billing_service_db;
CREATE DATABASE notification_service_db;
```

### Service-Specific Schemas

#### User Service Schema
```sql
-- users table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  first_name VARCHAR(255) NOT NULL,
  last_name VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'employee',
  hourly_rate DECIMAL(12,2),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

-- sessions/tokens table
CREATE TABLE user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT now()
);
```

#### Order Service Schema
```sql
-- orders table
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  customer_id UUID NOT NULL, -- Reference to Customer Service
  customer_name VARCHAR(255) NOT NULL, -- Denormalized for performance
  status VARCHAR(50) DEFAULT 'active',
  estimated_budget DECIMAL(12,2),
  actual_cost DECIMAL(12,2) DEFAULT 0,
  created_by_user_id UUID NOT NULL,
  created_at TIMESTAMP DEFAULT now(),
  completed_at TIMESTAMP
);

-- order_work_entries table
CREATE TABLE order_work_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  user_name VARCHAR(255) NOT NULL, -- Denormalized
  work_type VARCHAR(255) NOT NULL,
  hours_worked DECIMAL(8,2),
  hourly_rate DECIMAL(12,2) NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT now()
);

-- order_material_entries table
CREATE TABLE order_material_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  material_id UUID NOT NULL, -- Reference to Inventory Service
  material_name VARCHAR(255) NOT NULL, -- Denormalized
  quantity DECIMAL(12,2) NOT NULL,
  unit_cost DECIMAL(12,2) NOT NULL,
  total_cost DECIMAL(12,2) NOT NULL,
  added_by_user_id UUID NOT NULL,
  created_at TIMESTAMP DEFAULT now()
);
```

### Data Synchronization Strategy

#### Event-Driven Synchronization
Služby komunikují přes RabbitMQ exchanges a queues:

```typescript
// Event types
interface UserCreatedEvent {
  eventType: 'user.created';
  userId: string;
  name: string;
  email: string;
  role: string;
}

interface CustomerUpdatedEvent {
  eventType: 'customer.updated';
  customerId: string;
  name: string;
  billingAddress: string;
}

interface OrderCompletedEvent {
  eventType: 'order.completed';
  orderId: string;
  customerId: string;
  totalAmount: number;
  lineItems: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
  }>;
}
```

#### Denormalization Strategy
Kritické cross-service data jsou replikována lokálně:

- **Order Service** ukládá `customer_name` lokálně pro rychlé dotazy
- **Billing Service** ukládá kompletní order snapshot pro neměnnost faktur
- **Notification Service** ukládá user contact info pro offline resilience

---

## Communication Patterns

### Synchronous Communication
- **Client ↔ API Gateway**: GraphQL přes HTTPS
- **API Gateway ↔ Services**: GraphQL federation (HTTP)
- **Service ↔ Database**: Prisma ORM

### Asynchronous Communication
- **Service ↔ Service**: RabbitMQ (AMQP protocol)
- **Event Patterns**:
  - **Topic Exchange**: Pro broadcasting events (1 → N)
  - **Direct Exchange**: Pro targeted commands (1 → 1)
  - **Dead Letter Queues**: Pro error handling

### Message Flow Example
```
1. User completes order in UI
2. Order Service → Updates database → Publishes OrderCompleted event
3. Billing Service → Consumes event → Creates invoice → Publishes InvoiceCreated
4. Notification Service → Consumes InvoiceCreated → Sends email to customer
```

---

## Security Architecture

### Authentication & Authorization
- **JWT Tokens**: Issued by User Service, validated by API Gateway
- **Role-Based Access Control**: Owner, Employee, Contractor roles
- **Service-to-Service**: mTLS certificates (handled by Cloud Run)

### Data Protection
- **Encryption at Rest**: Google Cloud SQL automatic encryption
- **Encryption in Transit**: TLS 1.3 for all HTTP traffic
- **Secrets Management**: Google Secret Manager
- **API Security**: Rate limiting, input validation, SQL injection protection

---

## Deployment Architecture

### Cloud Run Services
Each microservice deployed as separate Cloud Run service:

```yaml
# Example: order-service deployment
apiVersion: serving.knative.dev/v1
kind: Service
metadata:
  name: order-service
  annotations:
    run.googleapis.com/ingress: all
spec:
  template:
    metadata:
      annotations:
        autoscaling.knative.dev/minScale: "1"
        autoscaling.knative.dev/maxScale: "100"
    spec:
      containers:
      - image: gcr.io/PROJECT_ID/order-service:latest
        ports:
        - containerPort: 3003
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: order-db-connection
              key: url
        - name: RABBITMQ_URL
          valueFrom:
            secretKeyRef:
              name: rabbitmq-connection
              key: url
        resources:
          limits:
            cpu: "1"
            memory: "512Mi"
```

### CI/CD Pipeline
- **Source**: GitHub repository
- **Build**: GitHub Actions
- **Registry**: Google Container Registry (GCR)
- **Deploy**: Cloud Run automatic deployments

---

## Resilience Patterns

### Circuit Breaker Implementation

Každá mikroslužba implementuje circuit breaker pattern pro všechna síťová volání k jiným službám a externím závislostem. Používáme `opossum` library pro Node.js s následující konfigurací:

```typescript
import CircuitBreaker from 'opossum';
import { Logger } from './logger';

// Circuit breaker konfigurace pro inter-service komunikaci
const circuitOptions: CircuitBreaker.Options = {
  timeout: 3000,                     // 3s timeout pro service calls
  errorThresholdPercentage: 50,      // Otevři okruh při 50% failure rate
  resetTimeout: 30000,               // 30s cooldown před testovacím requestem
  capacity: 20,                      // Max 20 souběžných volání (bulkhead)
  rollingCountTimeout: 60000,        // 60s sliding window pro statistiky
  rollingCountBuckets: 10            // 10 buckets pro precizní statistiky
};

// Příklad: Circuit breaker pro BillingService volání z OrderService
export class BillingServiceClient {
  private circuit: CircuitBreaker;
  private logger: Logger = new Logger('BillingServiceClient');

  constructor() {
    // Vytvoření circuit breakeru pro charge operaci
    this.circuit = new CircuitBreaker(this.performCharge, circuitOptions);
    
    // Fallback strategie pro billing selhání
    this.circuit.fallback(this.chargeFallback);
    
    // Monitoring events
    this.circuit.on('open', () => {
      this.logger.warn('Circuit breaker OPEN - BillingService unavailable');
    });
    
    this.circuit.on('halfOpen', () => {
      this.logger.info('Circuit breaker HALF-OPEN - Testing BillingService');
    });
    
    this.circuit.on('close', () => {
      this.logger.info('Circuit breaker CLOSED - BillingService recovered');
    });
    
    this.circuit.on('fallback', (orderId) => {
      this.logger.warn(`Billing fallback executed for order ${orderId}`);
    });
  }

  // Původní funkce obalená circuit breakerem
  private performCharge = async (orderId: string, amount: number) => {
    const response = await fetch(`${process.env.BILLING_SERVICE_URL}/charge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId, amount })
    });
    
    if (!response.ok) {
      throw new Error(`Billing service error: ${response.status}`);
    }
    
    return response.json();
  };

  // Graceful degradation fallback
  private chargeFallback = async (orderId: string, amount: number) => {
    // Uložit objednávku se stavem PENDING_BILLING
    this.logger.warn(`Billing unavailable for order ${orderId}, queuing for retry`);
    
    // Poslat zprávu do RabbitMQ retry queue
    await this.queueBillingRetry(orderId, amount);
    
    return {
      success: false,
      status: 'PENDING_BILLING',
      transactionId: null,
      retryQueued: true
    };
  };

  // Veřejná metoda pro použití v aplikaci
  async chargeOrder(orderId: string, amount: number) {
    return this.circuit.fire(orderId, amount);
  }

  private async queueBillingRetry(orderId: string, amount: number) {
    // RabbitMQ publikace pro pozdější zpracování
    const retryMessage = {
      orderId,
      amount,
      timestamp: new Date().toISOString(),
      retryCount: 0
    };
    
    await this.rabbitmq.publish('billing.retry', retryMessage);
  }
}
```

### Service-Specific Circuit Breaker Strategies

#### Order Service → Billing Service
- **Failure Mode**: Billing service nedostupná nebo pomalá
- **Graceful Degradation**: Objednávka označena `PENDING_BILLING`, retry přes RabbitMQ
- **Business Impact**: Uživatel dostane potvrzení objednávky, faktura se vytvoří později

#### Order Service → Inventory Service
- **Failure Mode**: Skladové dotazy selhávají
- **Graceful Degradation**: Použít cached inventory data nebo povolit objednávku s varováním
- **Business Impact**: Objednávka pokračuje s oznámením o ověření dostupnosti

#### All Services → Notification Service
- **Failure Mode**: Email/SMS notifikace nefungují
- **Graceful Degradation**: Fire-and-forget pattern s retry queue
- **Business Impact**: Core funkcionalita nepřerušena, notifikace doručeny později

### Comprehensive Health Checks

Nahrazujeme basic `/health` endpoint dvěma specializovanými endpointy pro Cloud Run:

```typescript
// Liveness Probe - je proces naživu?
app.get('/live', (req, res) => {
  // Žádné externí závislosti - pouze server status
  res.status(200).json({
    status: 'UP',
    timestamp: new Date().toISOString(),
    service: process.env.SERVICE_NAME
  });
});

// Readiness Probe - je služba připravena přijímat traffic?
app.get('/ready', async (req, res) => {
  const checks = {
    database: await checkDatabaseConnection(),
    rabbitmq: await checkRabbitMQConnection(),
    circuit_breakers: await checkCircuitBreakerStatus(),
    memory_usage: process.memoryUsage().heapUsed / process.memoryUsage().heapTotal
  };
  
  const isReady = 
    checks.database === true &&
    checks.rabbitmq === true &&
    checks.memory_usage < 0.9; // Méně než 90% heap usage
  
  res.status(isReady ? 200 : 503).json({
    status: isReady ? 'READY' : 'NOT_READY',
    checks,
    timestamp: new Date().toISOString()
  });
});

// Helper funkce pro circuit breaker status
async function checkCircuitBreakerStatus() {
  const circuits = CircuitBreakerRegistry.getAllCircuits();
  const openCircuits = circuits.filter(c => c.opened).length;
  
  return {
    total_circuits: circuits.length,
    open_circuits: openCircuits,
    healthy: openCircuits === 0
  };
}
```

### Timeout a Retry Policies

```typescript
// Timeout konfigurace podle typu operace
const TIMEOUTS = {
  CRITICAL_SYNC: 2000,      // Synchronní user-facing operace
  BACKGROUND_SYNC: 5000,    // Background synchronní operace  
  ASYNC_PROCESSING: 10000,  // Asynchronní zpracování
  EXTERNAL_API: 8000        // Externí API volání
};

// Retry konfigurace s exponential backoff
import retry from 'async-retry';

export async function retryableServiceCall<T>(
  operation: () => Promise<T>,
  options: {
    retries?: number;
    factor?: number;
    minTimeout?: number;
    maxTimeout?: number;
  } = {}
): Promise<T> {
  const defaultOptions = {
    retries: 3,
    factor: 2,
    minTimeout: 100,
    maxTimeout: 2000,
    randomize: true, // Jitter proti thundering herd
    ...options
  };
  
  return retry(async (bail) => {
    try {
      return await operation();
    } catch (error: any) {
      // Neopakovat 4xx chyby (client error)
      if (error.status >= 400 && error.status < 500) {
        bail(error);
        return;
      }
      
      // Opakovat 5xx a network errors
      throw error;
    }
  }, defaultOptions);
}
```

### Bulkhead Pattern a Resource Isolation

```typescript
// Connection pool konfigurace pro každou službu
const databaseConfig = {
  max: 10,                    // Max 10 databázových připojení
  min: 2,                     // Min 2 připojení vždy aktivní
  acquire: 30000,             // 30s timeout pro získání připojení
  idle: 10000,                // 10s idle timeout
  evict: 1000,                // Test idle connections každou sekundu
  handleDisconnects: true
};

// RabbitMQ connection pool
const rabbitMQConfig = {
  connectionOptions: {
    heartbeatIntervalInSeconds: 5,
    reconnectTimeInSeconds: 10
  },
  channelMax: 100,            // Max 100 channels per connection
  publisherConfirms: true,
  prefetch: 10               // Max 10 unacked messages per consumer
};

// Thread pool isolation pro CPU-intensive operace
const WorkerThreadsPool = {
  maxWorkers: Math.min(4, os.cpus().length),
  maxQueue: 50,
  timeout: 30000
};
```

### Monitoring a Alerting Integration

```typescript
// Prometheus metriky pro circuit breakers
import client from 'prom-client';

const circuitBreakerState = new client.Gauge({
  name: 'circuit_breaker_state',
  help: 'Circuit breaker state (0=closed, 1=open, 2=half-open)',
  labelNames: ['service', 'target']
});

const circuitBreakerFallbacks = new client.Counter({
  name: 'circuit_breaker_fallbacks_total',
  help: 'Total number of circuit breaker fallbacks',
  labelNames: ['service', 'target', 'reason']
});

const requestDuration = new client.Histogram({
  name: 'service_request_duration_seconds',
  help: 'Request duration in seconds',
  labelNames: ['service', 'target', 'status'],
  buckets: [0.1, 0.3, 0.5, 0.7, 1.0, 3.0, 5.0, 7.0, 10.0]
});

// Export metrik pro každý circuit breaker
circuit.on('open', () => {
  circuitBreakerState.set({ service: 'order-service', target: 'billing' }, 1);
});

circuit.on('close', () => {
  circuitBreakerState.set({ service: 'order-service', target: 'billing' }, 0);
});

circuit.on('fallback', (reason) => {
  circuitBreakerFallbacks.inc({ 
    service: 'order-service', 
    target: 'billing', 
    reason: reason || 'unknown' 
  });
});
```

### Emergency Procedures

#### Circuit Breaker Override
```typescript
// Manuální ovládání pro emergency situations
class CircuitBreakerRegistry {
  static forceOpen(serviceName: string, target: string) {
    const circuit = this.getCircuit(serviceName, target);
    circuit.open();
    Logger.warn(`Manually opened circuit ${serviceName}->${target}`);
  }
  
  static forceClose(serviceName: string, target: string) {
    const circuit = this.getCircuit(serviceName, target);
    circuit.close();
    Logger.warn(`Manually closed circuit ${serviceName}->${target}`);
  }
}
```

---

## Monitoring & Observability

### Metrics Collection
- **Application Metrics**: Prometheus client in each service
- **Custom Business Metrics**: Order completion rate, invoice generation time
- **Infrastructure Metrics**: Cloud Run built-in metrics

### Logging Strategy
- **Structured Logging**: JSON format with correlation IDs
- **Log Aggregation**: Google Cloud Logging
- **Log Levels**: ERROR, WARN, INFO, DEBUG

### Distributed Tracing
- **OpenTelemetry**: Auto-instrumentation for HTTP and database calls
- **Trace Backend**: Google Cloud Trace
- **Correlation**: Trace ID propagation through GraphQL federation

### Health Checks
```typescript
// Health check endpoint for each service
app.get('/health', async (req, res) => {
  const checks = {
    database: await checkDatabaseConnection(),
    rabbitmq: await checkRabbitMQConnection(),
    timestamp: new Date().toISOString()
  };
  
  const isHealthy = Object.values(checks).every(check => 
    typeof check === 'boolean' ? check : true
  );
  
  res.status(isHealthy ? 200 : 503).json(checks);
});
```

---

## Development Workflow

### Local Development
```bash
# Start all services locally with Docker Compose
docker-compose up -d postgres rabbitmq
npm run dev:user-service
npm run dev:order-service
npm run dev:gateway
```

### Testing Strategy
- **Unit Tests**: Jest + supertest for each service
- **Integration Tests**: Test database interactions
- **E2E Tests**: Test complete GraphQL workflows
- **Contract Tests**: Ensure service communication compatibility

### Code Generation
```bash
# Generate Prisma client from schema
npx prisma generate

# Generate GraphQL types from federation schema
npm run codegen

# Generate API documentation
npm run docs:generate
```

---

## Scalování a Performance

### Horizontal Scaling
- **Cloud Run**: Automatic scaling based on request volume
- **Database**: Read replicas for read-heavy operations
- **RabbitMQ**: Clustered setup pro high availability

### Caching Strategy
- **API Gateway**: GraphQL query result caching
- **Database**: Prisma query result caching
- **Redis**: Session storage a frequently accessed data

### Performance Monitoring
- **Key Metrics**: Response time, throughput, error rate
- **Alerting**: Google Cloud Monitoring alerts
- **SLA Targets**: 99.9% uptime, <500ms response time

---

Tato architektura poskytuje robustní, škálovatelný a udržitelný základ pro Firemní Asistent aplikaci při minimalizaci operační složitosti pro small team development.