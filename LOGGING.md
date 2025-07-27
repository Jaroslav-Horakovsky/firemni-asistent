# Logging Strategy - Firemní Asistent

## Overview
Komplexní logging strategie navržená pro efektivní debugging a monitoring mikroslužeb během development i production. Zaměřuje se na structured logging, correlation tracking a seamless developer experience.

---

## Technology Stack

### Core Logging Libraries
```bash
# Primary logging
npm install pino
npm install --save-dev pino-pretty

# Correlation tracking
npm install @sentry/node @sentry/profiling-node

# Development tools
npm install --save-dev pino-dev-tools
```

### Logging Architecture
- **Primary Logger**: `pino` (highest performance, structured JSON)
- **Development Format**: `pino-pretty` (human-readable colored output)
- **Correlation Tracking**: AsyncLocalStorage (Node.js native)
- **Error Tracking**: Sentry integration
- **Log Aggregation**: Google Cloud Logging (native Cloud Run integration)

---

## Implementation

### 1. Centralized Logger Configuration

```typescript
// shared/logger/index.ts
import pino from 'pino';
import { randomUUID } from 'crypto';
import { als } from './async-local-storage';

const isProduction = process.env.NODE_ENV === 'production';
const isDevelopment = process.env.NODE_ENV === 'development';

// Configuration for development pretty printing
const transport = isDevelopment ? {
  target: 'pino-pretty',
  options: {
    colorize: true,
    translateTime: 'SYS:yyyy-mm-dd HH:MM:ss.l',
    ignore: 'pid,hostname',
    messageFormat: '[{service}] {msg}',
    customColors: 'info:blue,warn:yellow,error:red,debug:green,trace:magenta',
    levelFirst: true,
    singleLine: false,
  },
} : undefined;

const logger = pino({
  level: process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug'),
  timestamp: pino.stdTimeFunctions.isoTime,
  transport,
  
  // Automatic context enrichment
  mixin() {
    const store = als.getStore();
    return {
      correlationId: store?.get('correlationId'),
      userId: store?.get('userId'),
      operationName: store?.get('operationName'),
    };
  },
  
  // Base properties for all logs
  base: {
    service: process.env.SERVICE_NAME || 'unknown-service',
    version: process.env.SERVICE_VERSION || '1.0.0',
    environment: process.env.NODE_ENV,
    // Cloud Run specific context
    revision: process.env.K_REVISION,
    instanceId: process.env.K_SERVICE,
  },

  // Serializers for better error logging
  serializers: {
    err: pino.stdSerializers.err,
    error: pino.stdSerializers.err,
    req: pino.stdSerializers.req,
    res: pino.stdSerializers.res,
  },
});

// Enhanced error logging with Sentry integration
if (isProduction && process.env.SENTRY_DSN) {
  const Sentry = require('@sentry/node');
  
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV,
    release: process.env.SERVICE_VERSION,
  });

  // Override error method to send to Sentry
  const originalError = logger.error.bind(logger);
  logger.error = (obj: any, msg?: string, ...args: any[]) => {
    // Send to Sentry if it's an actual error
    if (obj instanceof Error) {
      Sentry.captureException(obj);
    } else if (obj?.err instanceof Error) {
      Sentry.captureException(obj.err);
    } else if (obj?.error instanceof Error) {
      Sentry.captureException(obj.error);
    }
    
    return originalError(obj, msg, ...args);
  };
}

export default logger;
```

### 2. Async Local Storage for Context

```typescript
// shared/logger/async-local-storage.ts
import { AsyncLocalStorage } from 'async_hooks';

export type LogContext = Map<string, any>;

export const als = new AsyncLocalStorage<LogContext>();

// Helper functions for context management
export function getCorrelationId(): string | undefined {
  return als.getStore()?.get('correlationId');
}

export function getUserId(): string | undefined {
  return als.getStore()?.get('userId');
}

export function setContext(key: string, value: any): void {
  const store = als.getStore();
  if (store) {
    store.set(key, value);
  }
}

export function addContext(context: Record<string, any>): void {
  const store = als.getStore();
  if (store) {
    Object.entries(context).forEach(([key, value]) => {
      store.set(key, value);
    });
  }
}

// Helper to create child context
export function runWithContext<T>(
  context: Record<string, any>,
  fn: () => T
): T {
  const store = new Map(als.getStore());
  Object.entries(context).forEach(([key, value]) => {
    store.set(key, value);
  });
  
  return als.run(store, fn);
}
```

### 3. Correlation ID Middleware

```typescript
// shared/middleware/correlation.ts
import { FastifyRequest, FastifyReply, HookHandlerDoneFunction } from 'fastify';
import { randomUUID } from 'crypto';
import { als, LogContext } from '../logger/async-local-storage';
import logger from '../logger';

export function correlationMiddleware(
  request: FastifyRequest,
  reply: FastifyReply,
  done: HookHandlerDoneFunction
) {
  // Extract or generate correlation ID
  const correlationId = 
    request.headers['x-correlation-id'] as string || 
    request.headers['x-request-id'] as string ||
    randomUUID();

  // Set response header
  reply.header('x-correlation-id', correlationId);

  // Create context store
  const store: LogContext = new Map();
  store.set('correlationId', correlationId);
  store.set('requestId', correlationId);
  store.set('method', request.method);
  store.set('url', request.url);
  store.set('userAgent', request.headers['user-agent']);
  store.set('ip', request.ip);

  // Extract user ID from JWT if available
  if (request.user?.id) {
    store.set('userId', request.user.id);
    store.set('userRole', request.user.role);
  }

  // Run request in context
  als.run(store, () => {
    logger.debug({
      method: request.method,
      url: request.url,
      userAgent: request.headers['user-agent'],
      ip: request.ip,
    }, 'Request started');

    done();
  });
}

// Request completion logging
export function requestLoggingMiddleware(
  request: FastifyRequest,
  reply: FastifyReply,
  done: HookHandlerDoneFunction
) {
  const startTime = Date.now();

  reply.addHook('onSend', async (request, reply, payload) => {
    const duration = Date.now() - startTime;
    const statusCode = reply.statusCode;
    
    const logLevel = statusCode >= 500 ? 'error' : 
                    statusCode >= 400 ? 'warn' : 'info';

    logger[logLevel]({
      method: request.method,
      url: request.url,
      statusCode,
      duration,
      contentLength: payload?.length || 0,
    }, `Request completed`);

    return payload;
  });

  done();
}
```

### 4. GraphQL Logging Integration

```typescript
// gateway/plugins/logging.ts
import { ApolloServerPlugin } from '@apollo/server';
import logger from '../../shared/logger';
import { setContext, addContext } from '../../shared/logger/async-local-storage';

export const loggingPlugin: ApolloServerPlugin = {
  async requestDidStart(requestContext) {
    const startTime = Date.now();
    const operationName = requestContext.request.operationName || 'unknown';
    
    // Add GraphQL context to logging context
    setContext('operationName', operationName);
    setContext('operationType', getOperationType(requestContext.request.query));
    
    logger.debug({
      operationName,
      query: requestContext.request.query,
      variables: requestContext.request.variables,
    }, 'GraphQL operation started');

    return {
      async willSendResponse(requestContext) {
        const duration = Date.now() - startTime;
        const hasErrors = requestContext.response.errors && 
                         requestContext.response.errors.length > 0;

        const logLevel = hasErrors ? 'error' : 'info';
        
        logger[logLevel]({
          operationName,
          duration,
          errors: requestContext.response.errors?.map(err => ({
            message: err.message,
            path: err.path,
            extensions: err.extensions,
          })),
        }, 'GraphQL operation completed');
      },

      async didEncounterErrors(requestContext) {
        requestContext.errors.forEach(error => {
          logger.error({
            operationName,
            error: error.message,
            path: error.path,
            locations: error.locations,
            extensions: error.extensions,
          }, 'GraphQL error occurred');
        });
      },
    };
  },
};

function getOperationType(query: string | undefined): string {
  if (!query) return 'unknown';
  const trimmed = query.trim();
  if (trimmed.startsWith('mutation')) return 'mutation';
  if (trimmed.startsWith('subscription')) return 'subscription';
  return 'query';
}
```

### 5. Database Logging with Prisma

```typescript
// shared/database/logging.ts
import { PrismaClient } from '@prisma/client';
import logger from '../logger';
import { setContext } from '../logger/async-local-storage';

export function createPrismaWithLogging(): PrismaClient {
  const prisma = new PrismaClient({
    log: [
      { emit: 'event', level: 'query' },
      { emit: 'event', level: 'error' },
      { emit: 'event', level: 'info' },
      { emit: 'event', level: 'warn' },
    ],
  });

  // Query logging
  prisma.$on('query', (e) => {
    logger.debug({
      query: e.query,
      params: e.params,
      duration: e.duration,
      target: e.target,
    }, 'Database query executed');
  });

  // Error logging
  prisma.$on('error', (e) => {
    logger.error({
      message: e.message,
      target: e.target,
    }, 'Database error occurred');
  });

  // Performance monitoring middleware
  prisma.$use(async (params, next) => {
    const start = Date.now();
    const operation = `${params.model}.${params.action}`;
    
    setContext('dbOperation', operation);
    
    try {
      const result = await next(params);
      const duration = Date.now() - start;
      
      logger.debug({
        operation,
        duration,
        args: params.args,
      }, 'Database operation completed');
      
      return result;
    } catch (error) {
      const duration = Date.now() - start;
      
      logger.error({
        operation,
        duration,
        error: error.message,
        args: params.args,
      }, 'Database operation failed');
      
      throw error;
    }
  });

  return prisma;
}
```

### 6. Performance Measurement Utilities

```typescript
// shared/logger/performance.ts
import logger from './index';
import { setContext, addContext } from './async-local-storage';

export async function measureAsync<T>(
  operationName: string,
  context: Record<string, any> = {},
  fn: () => Promise<T>
): Promise<T> {
  const startTime = Date.now();
  const operationId = `${operationName}-${Date.now()}`;
  
  addContext({ 
    operationName, 
    operationId,
    ...context 
  });
  
  logger.debug({
    operationName,
    operationId,
    ...context,
  }, `Starting operation: ${operationName}`);

  try {
    const result = await fn();
    const duration = Date.now() - startTime;
    
    logger.info({
      operationName,
      operationId,
      duration,
      success: true,
      ...context,
    }, `Operation completed: ${operationName}`);
    
    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    
    logger.error({
      operationName,
      operationId,
      duration,
      success: false,
      error: error.message,
      stack: error.stack,
      ...context,
    }, `Operation failed: ${operationName}`);
    
    throw error;
  }
}

export function measureSync<T>(
  operationName: string,
  context: Record<string, any> = {},
  fn: () => T
): T {
  const startTime = Date.now();
  const operationId = `${operationName}-${Date.now()}`;
  
  addContext({ 
    operationName, 
    operationId,
    ...context 
  });
  
  logger.debug({
    operationName,
    operationId,
    ...context,
  }, `Starting operation: ${operationName}`);

  try {
    const result = fn();
    const duration = Date.now() - startTime;
    
    logger.info({
      operationName,
      operationId,
      duration,
      success: true,
      ...context,
    }, `Operation completed: ${operationName}`);
    
    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    
    logger.error({
      operationName,
      operationId,
      duration,
      success: false,
      error: error.message,
      stack: error.stack,
      ...context,
    }, `Operation failed: ${operationName}`);
    
    throw error;
  }
}

// Decorator for class methods
export function logMethod(operationName?: string) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    const methodName = operationName || `${target.constructor.name}.${propertyKey}`;

    descriptor.value = async function (...args: any[]) {
      return measureAsync(
        methodName,
        { className: target.constructor.name, methodName: propertyKey },
        () => originalMethod.apply(this, args)
      );
    };

    return descriptor;
  };
}
```

### 7. Service-Specific Logger Setup

```typescript
// services/user-service/src/logger.ts
import baseLogger from '../../../shared/logger';

// Create service-specific logger with additional context
const logger = baseLogger.child({
  service: 'user-service',
  component: 'user-management',
});

export default logger;

// Usage example in resolvers
export class UserResolver {
  @logMethod('UserResolver.createUser')
  async createUser(input: CreateUserInput): Promise<User> {
    logger.info({ input }, 'Creating new user');
    
    const user = await measureAsync(
      'database.createUser',
      { email: input.email },
      () => this.userService.create(input)
    );
    
    logger.info({ userId: user.id }, 'User created successfully');
    return user;
  }
}
```

---

## Development Tools

### 1. Log Viewing During Development

```bash
# Start all services with pretty logging
npm run dev

# Or start specific service with debug logs
LOG_LEVEL=debug npm run dev:user-service

# Filter logs by correlation ID
npm run dev | grep "correlationId.*abc-123"

# Follow logs from all services
docker-compose logs -f --tail=50

# Watch logs with filtering
docker-compose logs -f user-service | pino-pretty
```

### 2. Log Analysis Scripts

```typescript
// scripts/log-analysis.ts
import { readFileSync } from 'fs';
import { resolve } from 'path';

interface LogEntry {
  time: string;
  level: number;
  msg: string;
  correlationId?: string;
  service?: string;
  duration?: number;
  [key: string]: any;
}

export function analyzeLogFile(filePath: string) {
  const content = readFileSync(resolve(filePath), 'utf-8');
  const lines = content.split('\n').filter(line => line.trim());
  
  const entries: LogEntry[] = lines
    .map(line => {
      try {
        return JSON.parse(line) as LogEntry;
      } catch {
        return null;
      }
    })
    .filter(Boolean);

  // Group by correlation ID
  const byCorrelation = new Map<string, LogEntry[]>();
  entries.forEach(entry => {
    if (entry.correlationId) {
      if (!byCorrelation.has(entry.correlationId)) {
        byCorrelation.set(entry.correlationId, []);
      }
      byCorrelation.get(entry.correlationId)!.push(entry);
    }
  });

  // Analyze performance
  const performanceEntries = entries.filter(e => e.duration !== undefined);
  const avgDuration = performanceEntries.reduce((sum, e) => sum + e.duration!, 0) / performanceEntries.length;

  console.log('Log Analysis Results:');
  console.log(`Total entries: ${entries.length}`);
  console.log(`Unique correlation IDs: ${byCorrelation.size}`);
  console.log(`Average operation duration: ${avgDuration.toFixed(2)}ms`);
  
  // Show slowest operations
  const slowest = performanceEntries
    .sort((a, b) => b.duration! - a.duration!)
    .slice(0, 10);
    
  console.log('\nSlowest operations:');
  slowest.forEach(entry => {
    console.log(`${entry.operationName}: ${entry.duration}ms`);
  });
}
```

### 3. Docker Compose Logging Configuration

```yaml
# docker-compose.dev.yml
version: '3.8'

services:
  user-service:
    build: ./services/user-service
    environment:
      - NODE_ENV=development
      - LOG_LEVEL=debug
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"

  order-service:
    build: ./services/order-service
    environment:
      - NODE_ENV=development
      - LOG_LEVEL=debug
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"

  # Log aggregator for development
  fluentd:
    image: fluent/fluentd:v1.16-1
    volumes:
      - ./infrastructure/fluentd:/fluentd/etc
      - logs_data:/var/log
    ports:
      - "24224:24224"
    depends_on:
      - elasticsearch

volumes:
  logs_data:
```

---

## Production Configuration

### 1. Google Cloud Logging Integration

```typescript
// shared/logger/cloud-logging.ts
import { LoggingWinston } from '@google-cloud/logging-winston';
import winston from 'winston';

// Only in production, add Google Cloud Logging transport
if (process.env.NODE_ENV === 'production') {
  const loggingWinston = new LoggingWinston({
    projectId: process.env.GOOGLE_CLOUD_PROJECT,
    keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
    logName: 'firemni-asistent-logs',
  });

  // Create winston logger that forwards to Cloud Logging
  const cloudLogger = winston.createLogger({
    level: 'info',
    format: winston.format.json(),
    transports: [loggingWinston],
  });

  // Export for use in critical scenarios
  export { cloudLogger };
}
```

### 2. Log Queries for Cloud Console

```bash
# Find all logs for specific correlation ID
resource.type="cloud_run_revision"
jsonPayload.correlationId="abc-123-def"

# Find slow database operations
resource.type="cloud_run_revision"
jsonPayload.operationName:"database"
jsonPayload.duration>1000

# Find errors in specific service
resource.type="cloud_run_revision"
resource.labels.service_name="user-service"
severity>=ERROR

# Find authentication failures
resource.type="cloud_run_revision"
jsonPayload.operationName="authentication"
jsonPayload.success=false
```

---

## Monitoring & Alerting

### 1. Key Metrics to Track

```typescript
// shared/logger/metrics.ts
import logger from './index';

export class LogMetrics {
  private static errorCount = new Map<string, number>();
  private static requestCount = new Map<string, number>();

  static incrementError(service: string) {
    const current = this.errorCount.get(service) || 0;
    this.errorCount.set(service, current + 1);
    
    logger.info({
      metric: 'error_count',
      service,
      count: current + 1,
    }, 'Error count incremented');
  }

  static incrementRequest(service: string) {
    const current = this.requestCount.get(service) || 0;
    this.requestCount.set(service, current + 1);
  }

  static logMetrics() {
    logger.info({
      metric: 'service_metrics',
      errors: Object.fromEntries(this.errorCount),
      requests: Object.fromEntries(this.requestCount),
    }, 'Service metrics report');
  }
}

// Report metrics every minute
setInterval(() => {
  LogMetrics.logMetrics();
}, 60000);
```

### 2. Centralized Log Aggregation Strategy

```typescript
// infrastructure/log-aggregation/aggregator.ts
import { BigQuery } from '@google-cloud/bigquery';
import { PubSub } from '@google-cloud/pubsub';
import logger from '../../shared/logger';

interface LogAggregationMetrics {
  service: string;
  timestamp: Date;
  logLevel: string;
  errorRate: number;
  avgResponseTime: number;
  requestCount: number;
  uniqueUsers: number;
}

export class LogAggregationService {
  private bigquery: BigQuery;
  private pubsub: PubSub;
  private readonly DATASET_ID = 'firemni_asistent_logs';
  private readonly TABLE_ID = 'aggregated_metrics';

  constructor() {
    this.bigquery = new BigQuery({
      projectId: process.env.GOOGLE_CLOUD_PROJECT,
    });
    this.pubsub = new PubSub({
      projectId: process.env.GOOGLE_CLOUD_PROJECT,
    });
  }

  // Real-time log streaming and aggregation
  async setupLogStreaming(): Promise<void> {
    // Create BigQuery sink for log aggregation
    const sinkQuery = `
      CREATE OR REPLACE TABLE \`${process.env.GOOGLE_CLOUD_PROJECT}.${this.DATASET_ID}.${this.TABLE_ID}\`
      PARTITION BY DATE(timestamp)
      CLUSTER BY service, log_level
      AS
      SELECT
        jsonPayload.service as service,
        TIMESTAMP_TRUNC(timestamp, MINUTE) as timestamp,
        severity as log_level,
        COUNT(*) as log_count,
        COUNTIF(severity = 'ERROR') / COUNT(*) as error_rate,
        AVG(CAST(jsonPayload.duration as FLOAT64)) as avg_response_time,
        COUNT(DISTINCT jsonPayload.correlationId) as unique_requests,
        COUNT(DISTINCT jsonPayload.userId) as unique_users
      FROM
        \`${process.env.GOOGLE_CLOUD_PROJECT}.logging_dataset.cloud_run_logs\`
      WHERE
        resource.type = 'cloud_run_revision'
        AND timestamp >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 5 MINUTE)
      GROUP BY
        service, timestamp, log_level
    `;

    await this.bigquery.query(sinkQuery);
    logger.info('Log aggregation BigQuery sink created');
  }

  // Automated log correlation across services
  async correlateServiceLogs(correlationId: string): Promise<LogCorrelation[]> {
    const query = `
      SELECT
        jsonPayload.service,
        jsonPayload.operationName,
        timestamp,
        severity,
        jsonPayload.duration,
        jsonPayload.msg,
        jsonPayload.error
      FROM
        \`${process.env.GOOGLE_CLOUD_PROJECT}.logging_dataset.cloud_run_logs\`
      WHERE
        jsonPayload.correlationId = @correlationId
      ORDER BY timestamp ASC
    `;

    const options = {
      query,
      params: { correlationId },
    };

    const [rows] = await this.bigquery.query(options);
    return rows.map(row => ({
      service: row.service,
      operationName: row.operationName,
      timestamp: row.timestamp,
      severity: row.severity,
      duration: row.duration,
      message: row.msg,
      error: row.error,
    }));
  }

  // Real-time anomaly detection
  async detectAnomalies(): Promise<LogAnomaly[]> {
    const anomalyQuery = `
      WITH recent_metrics AS (
        SELECT
          service,
          TIMESTAMP_TRUNC(timestamp, MINUTE) as minute,
          COUNT(*) as log_count,
          COUNTIF(severity = 'ERROR') / COUNT(*) as error_rate,
          AVG(CAST(jsonPayload.duration as FLOAT64)) as avg_response_time
        FROM
          \`${process.env.GOOGLE_CLOUD_PROJECT}.logging_dataset.cloud_run_logs\`
        WHERE
          timestamp >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 30 MINUTE)
          AND resource.type = 'cloud_run_revision'
        GROUP BY service, minute
      ),
      baseline_metrics AS (
        SELECT
          service,
          AVG(error_rate) as baseline_error_rate,
          STDDEV(error_rate) as error_rate_stddev,
          AVG(avg_response_time) as baseline_response_time,
          STDDEV(avg_response_time) as response_time_stddev
        FROM recent_metrics
        WHERE minute <= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 10 MINUTE)
        GROUP BY service
      ),
      current_metrics AS (
        SELECT
          service,
          AVG(error_rate) as current_error_rate,
          AVG(avg_response_time) as current_response_time
        FROM recent_metrics
        WHERE minute > TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 5 MINUTE)
        GROUP BY service
      )
      SELECT
        c.service,
        c.current_error_rate,
        b.baseline_error_rate,
        c.current_response_time,
        b.baseline_response_time,
        CASE
          WHEN c.current_error_rate > b.baseline_error_rate + (2 * b.error_rate_stddev) THEN 'HIGH_ERROR_RATE'
          WHEN c.current_response_time > b.baseline_response_time + (2 * b.response_time_stddev) THEN 'HIGH_LATENCY'
          ELSE 'NORMAL'
        END as anomaly_type
      FROM current_metrics c
      JOIN baseline_metrics b ON c.service = b.service
      WHERE
        c.current_error_rate > b.baseline_error_rate + (2 * b.error_rate_stddev)
        OR c.current_response_time > b.baseline_response_time + (2 * b.response_time_stddev)
    `;

    const [rows] = await this.bigquery.query(anomalyQuery);
    return rows.map(row => ({
      service: row.service,
      anomalyType: row.anomaly_type,
      currentErrorRate: row.current_error_rate,
      baselineErrorRate: row.baseline_error_rate,
      currentResponseTime: row.current_response_time,
      baselineResponseTime: row.baseline_response_time,
      severity: this.calculateAnomalySeverity(row),
    }));
  }

  private calculateAnomalySeverity(anomaly: any): 'P0' | 'P1' | 'P2' | 'P3' {
    // P0: Critical services with severe anomalies
    if (['user-service', 'billing-service'].includes(anomaly.service)) {
      if (anomaly.current_error_rate > 0.1 || anomaly.current_response_time > 2000) {
        return 'P0';
      }
    }
    
    // P1: High error rates or latency
    if (anomaly.current_error_rate > 0.05 || anomaly.current_response_time > 1000) {
      return 'P1';
    }
    
    // P2: Moderate issues
    if (anomaly.current_error_rate > 0.02 || anomaly.current_response_time > 500) {
      return 'P2';
    }
    
    return 'P3';
  }
}

interface LogCorrelation {
  service: string;
  operationName: string;
  timestamp: Date;
  severity: string;
  duration?: number;
  message: string;
  error?: string;
}

interface LogAnomaly {
  service: string;
  anomalyType: 'HIGH_ERROR_RATE' | 'HIGH_LATENCY' | 'NORMAL';
  currentErrorRate: number;
  baselineErrorRate: number;
  currentResponseTime: number;
  baselineResponseTime: number;
  severity: 'P0' | 'P1' | 'P2' | 'P3';
}
```

### 3. Automated Anomaly Detection Engine

```typescript
// infrastructure/log-aggregation/anomaly-detector.ts
import logger from '../../shared/logger';
import { LogAggregationService } from './aggregator';

export class AnomalyDetectionEngine {
  private aggregationService: LogAggregationService;
  private readonly CHECK_INTERVAL = 60000; // 1 minute
  private detectionTimer?: NodeJS.Timeout;

  constructor() {
    this.aggregationService = new LogAggregationService();
  }

  // Start continuous anomaly monitoring
  startMonitoring(): void {
    logger.info('Starting automated anomaly detection');
    
    this.detectionTimer = setInterval(async () => {
      try {
        await this.runAnomalyDetection();
      } catch (error) {
        logger.error({ error: error.message }, 'Anomaly detection failed');
      }
    }, this.CHECK_INTERVAL);
  }

  stopMonitoring(): void {
    if (this.detectionTimer) {
      clearInterval(this.detectionTimer);
      this.detectionTimer = undefined;
    }
    logger.info('Stopped automated anomaly detection');
  }

  private async runAnomalyDetection(): Promise<void> {
    const anomalies = await this.aggregationService.detectAnomalies();
    
    for (const anomaly of anomalies) {
      await this.handleAnomaly(anomaly);
    }

    if (anomalies.length > 0) {
      logger.warn({
        anomaliesDetected: anomalies.length,
        services: anomalies.map(a => a.service),
      }, 'Anomalies detected in log patterns');
    }
  }

  private async handleAnomaly(anomaly: LogAnomaly): Promise<void> {
    const logEntry = {
      service: anomaly.service,
      anomalyType: anomaly.anomalyType,
      severity: anomaly.severity,
      currentErrorRate: anomaly.currentErrorRate,
      baselineErrorRate: anomaly.baselineErrorRate,
      currentResponseTime: anomaly.currentResponseTime,
      baselineResponseTime: anomaly.baselineResponseTime,
    };

    switch (anomaly.severity) {
      case 'P0':
        logger.error(logEntry, `P0 CRITICAL: Severe anomaly detected in ${anomaly.service}`);
        await this.triggerCriticalAlert(anomaly);
        break;
      
      case 'P1':
        logger.error(logEntry, `P1 HIGH: Significant anomaly detected in ${anomaly.service}`);
        await this.triggerHighAlert(anomaly);
        break;
      
      case 'P2':
        logger.warn(logEntry, `P2 MEDIUM: Moderate anomaly detected in ${anomaly.service}`);
        await this.triggerMediumAlert(anomaly);
        break;
      
      case 'P3':
        logger.info(logEntry, `P3 LOW: Minor anomaly detected in ${anomaly.service}`);
        break;
    }
  }

  private async triggerCriticalAlert(anomaly: LogAnomaly): Promise<void> {
    // Immediate notifications for P0
    await Promise.all([
      this.sendSlackEmergency(anomaly),
      this.sendSMSAlert(anomaly),
      this.sendEmailAlert(anomaly),
      this.createPagerDutyIncident(anomaly),
    ]);
  }

  private async triggerHighAlert(anomaly: LogAnomaly): Promise<void> {
    // Quick notifications for P1
    await Promise.all([
      this.sendSlackAlert(anomaly),
      this.sendEmailAlert(anomaly),
    ]);
  }

  private async triggerMediumAlert(anomaly: LogAnomaly): Promise<void> {
    // Standard notifications for P2
    await this.sendSlackAlert(anomaly);
  }

  private async sendSlackEmergency(anomaly: LogAnomaly): Promise<void> {
    const webhook = process.env.SLACK_EMERGENCY_WEBHOOK;
    if (!webhook) return;

    const message = {
      text: `🚨 P0 CRITICAL ANOMALY DETECTED`,
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*🚨 P0 CRITICAL ANOMALY*\n*Service:* ${anomaly.service}\n*Type:* ${anomaly.anomalyType}\n*Error Rate:* ${(anomaly.currentErrorRate * 100).toFixed(2)}% (baseline: ${(anomaly.baselineErrorRate * 100).toFixed(2)}%)\n*Response Time:* ${anomaly.currentResponseTime?.toFixed(0)}ms (baseline: ${anomaly.baselineResponseTime?.toFixed(0)}ms)`
          }
        },
        {
          type: "actions",
          elements: [
            {
              type: "button",
              text: { type: "plain_text", text: "View Logs" },
              url: `https://console.cloud.google.com/logs/query;query=resource.type%3D%22cloud_run_revision%22%0Aresource.labels.service_name%3D%22${anomaly.service}%22?project=${process.env.GOOGLE_CLOUD_PROJECT}`
            },
            {
              type: "button",
              text: { type: "plain_text", text: "View Monitoring" },
              style: "primary",
              url: `https://console.cloud.google.com/monitoring/services?project=${process.env.GOOGLE_CLOUD_PROJECT}`
            }
          ]
        }
      ]
    };

    await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message),
    });
  }

  private async sendSlackAlert(anomaly: LogAnomaly): Promise<void> {
    // Implementation for standard Slack alerts
  }

  private async sendSMSAlert(anomaly: LogAnomaly): Promise<void> {
    // Implementation for SMS alerts (Twilio, etc.)
  }

  private async sendEmailAlert(anomaly: LogAnomaly): Promise<void> {
    // Implementation for email alerts
  }

  private async createPagerDutyIncident(anomaly: LogAnomaly): Promise<void> {
    // Implementation for PagerDuty incident creation
  }
}

// Auto-start anomaly detection in production
if (process.env.NODE_ENV === 'production') {
  const detector = new AnomalyDetectionEngine();
  detector.startMonitoring();
  
  // Graceful shutdown
  process.on('SIGTERM', () => {
    detector.stopMonitoring();
  });
}
```

### 4. Advanced Log Analytics Dashboard

```sql
-- BigQuery queries for log analytics dashboard
-- infrastructure/log-aggregation/analytics-queries.sql

-- Service Health Overview (last 24 hours)
WITH service_metrics AS (
  SELECT
    jsonPayload.service,
    COUNT(*) as total_logs,
    COUNTIF(severity >= 'ERROR') as error_count,
    COUNTIF(severity >= 'ERROR') / COUNT(*) as error_rate,
    AVG(CAST(jsonPayload.duration as FLOAT64)) as avg_response_time,
    APPROX_QUANTILES(CAST(jsonPayload.duration as FLOAT64), 100)[OFFSET(95)] as p95_response_time,
    COUNT(DISTINCT jsonPayload.correlationId) as unique_requests,
    COUNT(DISTINCT jsonPayload.userId) as unique_users
  FROM
    `${PROJECT_ID}.logging_dataset.cloud_run_logs`
  WHERE
    timestamp >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 24 HOUR)
    AND resource.type = 'cloud_run_revision'
    AND jsonPayload.service IS NOT NULL
  GROUP BY jsonPayload.service
)
SELECT
  service,
  total_logs,
  error_count,
  ROUND(error_rate * 100, 2) as error_rate_percent,
  ROUND(avg_response_time, 0) as avg_response_time_ms,
  ROUND(p95_response_time, 0) as p95_response_time_ms,
  unique_requests,
  unique_users,
  -- SLO compliance calculation
  CASE
    WHEN service IN ('user-service', 'billing-service') AND error_rate <= 0.001 THEN 'SLO_MET'
    WHEN service IN ('order-service', 'customer-service') AND error_rate <= 0.005 THEN 'SLO_MET'
    WHEN service = 'inventory-service' AND error_rate <= 0.002 THEN 'SLO_MET'
    WHEN service = 'notification-service' AND error_rate <= 0.01 THEN 'SLO_MET'
    ELSE 'SLO_BREACH'
  END as slo_status
FROM service_metrics
ORDER BY error_rate DESC;

-- Error Pattern Analysis
SELECT
  jsonPayload.service,
  jsonPayload.operationName,
  jsonPayload.error,
  COUNT(*) as error_count,
  COUNT(DISTINCT jsonPayload.correlationId) as affected_requests,
  MIN(timestamp) as first_occurrence,
  MAX(timestamp) as last_occurrence,
  -- Common error signatures
  ARRAY_AGG(DISTINCT jsonPayload.userId IGNORE NULLS LIMIT 10) as affected_users
FROM
  `${PROJECT_ID}.logging_dataset.cloud_run_logs`
WHERE
  timestamp >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 6 HOUR)
  AND severity >= 'ERROR'
  AND jsonPayload.error IS NOT NULL
GROUP BY
  jsonPayload.service, jsonPayload.operationName, jsonPayload.error
HAVING error_count >= 5
ORDER BY error_count DESC
LIMIT 20;

-- Cross-Service Transaction Analysis
WITH transaction_flows AS (
  SELECT
    jsonPayload.correlationId,
    ARRAY_AGG(
      STRUCT(
        jsonPayload.service as service,
        jsonPayload.operationName as operation,
        timestamp,
        CAST(jsonPayload.duration as FLOAT64) as duration,
        severity
      ) 
      ORDER BY timestamp ASC
    ) as flow_steps,
    MIN(timestamp) as transaction_start,
    MAX(timestamp) as transaction_end,
    TIMESTAMP_DIFF(MAX(timestamp), MIN(timestamp), MILLISECOND) as total_duration,
    COUNTIF(severity >= 'ERROR') as error_count
  FROM
    `${PROJECT_ID}.logging_dataset.cloud_run_logs`
  WHERE
    timestamp >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 2 HOUR)
    AND jsonPayload.correlationId IS NOT NULL
    AND jsonPayload.service IS NOT NULL
  GROUP BY jsonPayload.correlationId
  HAVING ARRAY_LENGTH(flow_steps) >= 2  -- Multi-service transactions only
)
SELECT
  correlationId,
  flow_steps,
  total_duration,
  error_count,
  CASE
    WHEN total_duration > 5000 THEN 'SLOW'
    WHEN error_count > 0 THEN 'FAILED'
    ELSE 'SUCCESS'
  END as transaction_status
FROM transaction_flows
WHERE total_duration > 1000 OR error_count > 0
ORDER BY total_duration DESC
LIMIT 50;
```

### 5. Alert Conditions with Machine Learning

```yaml
# infrastructure/monitoring/ml-based-alerts.yaml
alertPolicy:
  displayName: "ML-Based Anomaly Detection"
  conditions:
    - displayName: "Anomalous Error Rate Pattern"
      conditionThreshold:
        filter: |
          resource.type="cloud_run_revision"
          jsonPayload.anomaly_detected=true
          jsonPayload.anomaly_type="HIGH_ERROR_RATE"
        comparison: COMPARISON_GREATER_THAN
        thresholdValue: 0
        duration: "60s"
        
    - displayName: "Unusual Response Time Pattern"
      conditionThreshold:
        filter: |
          resource.type="cloud_run_revision"
          jsonPayload.anomaly_detected=true
          jsonPayload.anomaly_type="HIGH_LATENCY"
        comparison: COMPARISON_GREATER_THAN
        thresholdValue: 0
        duration: "120s"

    - displayName: "Cross-Service Transaction Failures"
      conditionThreshold:
        filter: |
          resource.type="cloud_run_revision"
          jsonPayload.transaction_status="FAILED"
          jsonPayload.services_involved>=2
        comparison: COMPARISON_GREATER_THAN
        thresholdValue: 5  # 5 failed cross-service transactions
        duration: "300s"

  alertStrategy:
    autoClose: "1800s"  # Auto-close after 30 minutes if resolved
    
  notificationChannels:
    - projects/PROJECT_ID/notificationChannels/EMAIL_CRITICAL
    - projects/PROJECT_ID/notificationChannels/SLACK_ALERTS
    - projects/PROJECT_ID/notificationChannels/SMS_ONCALL
```

---

## Usage Examples

### 1. Basic Service Logging

```typescript
// services/order-service/src/resolvers/order.resolver.ts
import logger from '../logger';
import { measureAsync } from '../../../shared/logger/performance';

export class OrderResolver {
  async createOrder(input: CreateOrderInput): Promise<Order> {
    logger.info({ customerId: input.customerId }, 'Creating new order');
    
    const order = await measureAsync(
      'OrderService.createOrder',
      { customerId: input.customerId, estimatedBudget: input.estimatedBudget },
      async () => {
        // Validate customer exists
        const customer = await this.customerService.findById(input.customerId);
        if (!customer) {
          logger.warn({ customerId: input.customerId }, 'Customer not found');
          throw new Error('Customer not found');
        }
        
        // Create order
        const order = await this.orderService.create({
          ...input,
          status: 'ACTIVE',
          createdById: this.currentUser.id,
        });
        
        logger.info({ orderId: order.id }, 'Order created successfully');
        return order;
      }
    );
    
    return order;
  }
}
```

### 2. Business Event Logging

```typescript
// services/billing-service/src/events/order-completed.handler.ts
import logger from '../logger';

export class OrderCompletedHandler {
  async handle(event: OrderCompletedEvent): Promise<void> {
    logger.info({
      eventType: event.type,
      orderId: event.orderId,
      totalAmount: event.totalAmount,
    }, 'Processing order completed event');
    
    try {
      const invoice = await measureAsync(
        'BillingService.generateInvoice',
        { orderId: event.orderId },
        () => this.invoiceService.generateFromOrder(event)
      );
      
      logger.info({
        orderId: event.orderId,
        invoiceId: invoice.id,
        amount: invoice.total,
      }, 'Invoice generated successfully');
      
    } catch (error) {
      logger.error({
        orderId: event.orderId,
        error: error.message,
      }, 'Failed to generate invoice');
      throw error;
    }
  }
}
```

Tato logging strategie poskytuje komplexní observability pro debugging, performance monitoring a production troubleshooting při zachování developer-friendly experience.