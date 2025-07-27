# Security Strategy - Firemní Asistent

## Security Overview

Bezpečnost je kritická pro business aplikaci handling firemních dat, zákazníků, faktur a finančních informací. Tato strategie implementuje defense-in-depth approach s důrazem na současné best practices.

---

## Authentication & Authorization

### JWT Token Strategy

#### Token Implementation
```typescript
// user-service/auth/jwt.ts
import jwt from 'jsonwebtoken';
import { Redis } from 'ioredis';

interface JWTPayload {
  userId: string;
  email: string;
  role: 'OWNER' | 'EMPLOYEE' | 'CONTRACTOR';
  permissions: string[];
  iat: number;
  exp: number;
  jti: string; // Token ID for revocation
}

export class JWTService {
  private redis: Redis;
  private accessTokenSecret: string;
  private refreshTokenSecret: string;

  constructor() {
    this.redis = new Redis(process.env.REDIS_URL);
    this.accessTokenSecret = process.env.JWT_ACCESS_SECRET;
    this.refreshTokenSecret = process.env.JWT_REFRESH_SECRET;
  }

  async generateTokens(user: User): Promise<{accessToken: string, refreshToken: string}> {
    const tokenId = generateUUID();
    
    const accessTokenPayload: JWTPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
      permissions: await this.getUserPermissions(user.role),
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (15 * 60), // 15 minutes
      jti: tokenId,
    };

    const refreshTokenPayload = {
      userId: user.id,
      jti: tokenId,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60), // 7 days
    };

    const accessToken = jwt.sign(accessTokenPayload, this.accessTokenSecret);
    const refreshToken = jwt.sign(refreshTokenPayload, this.refreshTokenSecret);

    // Store refresh token in Redis for revocation
    await this.redis.set(
      `refresh_token:${tokenId}`, 
      refreshToken, 
      'EX', 
      7 * 24 * 60 * 60
    );

    return { accessToken, refreshToken };
  }

  async verifyAccessToken(token: string): Promise<JWTPayload> {
    try {
      const payload = jwt.verify(token, this.accessTokenSecret) as JWTPayload;
      
      // Check if token is blacklisted
      const isBlacklisted = await this.redis.exists(`blacklist:${payload.jti}`);
      if (isBlacklisted) {
        throw new Error('Token has been revoked');
      }

      return payload;
    } catch (error) {
      throw new Error('Invalid or expired token');
    }
  }

  async revokeToken(tokenId: string): Promise<void> {
    // Add to blacklist
    await this.redis.set(`blacklist:${tokenId}`, '1', 'EX', 15 * 60);
    
    // Remove refresh token
    await this.redis.del(`refresh_token:${tokenId}`);
  }

  private async getUserPermissions(role: string): Promise<string[]> {
    const permissions = {
      OWNER: [
        'users:create', 'users:read', 'users:update', 'users:delete',
        'customers:create', 'customers:read', 'customers:update', 'customers:delete',
        'orders:create', 'orders:read', 'orders:update', 'orders:delete',
        'materials:create', 'materials:read', 'materials:update', 'materials:delete',
        'invoices:create', 'invoices:read', 'invoices:update', 'invoices:delete',
        'reports:read', 'settings:update'
      ],
      EMPLOYEE: [
        'orders:read', 'orders:update',
        'materials:read', 'materials:update',
        'workentries:create', 'workentries:read', 'workentries:update'
      ],
      CONTRACTOR: [
        'orders:read',
        'workentries:create', 'workentries:read',
        'invoices:read' // Only own invoices
      ]
    };

    return permissions[role] || [];
  }
}
```

### Role-Based Access Control (RBAC)

#### Permission Middleware
```typescript
// shared/middleware/auth.ts
import { GraphQLError } from 'graphql';
import { JWTService } from '../auth/jwt';

export interface AuthContext {
  user?: {
    id: string;
    email: string;
    role: string;
    permissions: string[];
  };
  isAuthenticated: boolean;
}

export class AuthMiddleware {
  private jwtService: JWTService;

  constructor() {
    this.jwtService = new JWTService();
  }

  async authenticate(authHeader?: string): Promise<AuthContext> {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return { isAuthenticated: false };
    }

    const token = authHeader.substring(7);

    try {
      const payload = await this.jwtService.verifyAccessToken(token);
      
      return {
        user: {
          id: payload.userId,
          email: payload.email,
          role: payload.role,
          permissions: payload.permissions,
        },
        isAuthenticated: true,
      };
    } catch (error) {
      return { isAuthenticated: false };
    }
  }

  requireAuth(context: AuthContext): void {
    if (!context.isAuthenticated) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHENTICATED' }
      });
    }
  }

  requirePermission(context: AuthContext, permission: string): void {
    this.requireAuth(context);
    
    if (!context.user?.permissions.includes(permission)) {
      throw new GraphQLError('Insufficient permissions', {
        extensions: { 
          code: 'FORBIDDEN',
          requiredPermission: permission 
        }
      });
    }
  }

  requireOwnerOrSelf(context: AuthContext, resourceUserId: string): void {
    this.requireAuth(context);
    
    const isOwner = context.user?.role === 'OWNER';
    const isSelf = context.user?.id === resourceUserId;
    
    if (!isOwner && !isSelf) {
      throw new GraphQLError('Access denied', {
        extensions: { code: 'FORBIDDEN' }
      });
    }
  }
}
```

#### GraphQL Directive for Authorization
```typescript
// shared/directives/auth.ts
import { GraphQLSchema } from 'graphql';
import { mapSchema, getDirective, MapperKind } from '@graphql-tools/utils';
import { AuthMiddleware } from '../middleware/auth';

const authMiddleware = new AuthMiddleware();

export function authDirectiveTransformer(schema: GraphQLSchema): GraphQLSchema {
  return mapSchema(schema, {
    [MapperKind.OBJECT_FIELD]: (fieldConfig) => {
      const authDirective = getDirective(schema, fieldConfig, 'auth')?.[0];
      
      if (authDirective) {
        const { requires } = authDirective;
        const { resolve = defaultFieldResolver } = fieldConfig;
        
        fieldConfig.resolve = async function (source, args, context, info) {
          if (requires === 'USER') {
            authMiddleware.requireAuth(context);
          } else if (requires) {
            authMiddleware.requirePermission(context, requires);
          }
          
          return resolve(source, args, context, info);
        };
      }
      
      return fieldConfig;
    },
  });
}

// Usage in schema:
// type Query {
//   orders: [Order!]! @auth(requires: "orders:read")
//   me: User! @auth(requires: "USER")
// }
```

---

## Data Protection

### Encryption Strategy

#### Database Encryption
```typescript
// shared/encryption/database.ts
import crypto from 'crypto';

export class DatabaseEncryption {
  private encryptionKey: Buffer;

  constructor() {
    // Key should be stored in Google Secret Manager
    this.encryptionKey = Buffer.from(process.env.DATABASE_ENCRYPTION_KEY, 'hex');
  }

  // Encrypt sensitive fields (e.g., notes, personal data)
  encrypt(text: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher('aes-256-gcm', this.encryptionKey);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    // Format: iv:authTag:encryptedData
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  }

  decrypt(encryptedText: string): string {
    const [ivHex, authTagHex, encrypted] = encryptedText.split(':');
    
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const decipher = crypto.createDecipher('aes-256-gcm', this.encryptionKey);
    
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }
}

// Prisma middleware for automatic encryption
export function createEncryptionMiddleware(encryptor: DatabaseEncryption) {
  return async (params: any, next: any) => {
    // Fields to encrypt
    const encryptedFields = ['notes', 'description', 'personalData'];
    
    // Encrypt on write
    if (params.action === 'create' || params.action === 'update') {
      for (const field of encryptedFields) {
        if (params.args.data[field]) {
          params.args.data[field] = encryptor.encrypt(params.args.data[field]);
        }
      }
    }
    
    const result = await next(params);
    
    // Decrypt on read
    if (params.action === 'findMany' || params.action === 'findFirst' || params.action === 'findUnique') {
      const decryptResult = (obj: any) => {
        for (const field of encryptedFields) {
          if (obj[field]) {
            obj[field] = encryptor.decrypt(obj[field]);
          }
        }
        return obj;
      };
      
      if (Array.isArray(result)) {
        return result.map(decryptResult);
      } else if (result) {
        return decryptResult(result);
      }
    }
    
    return result;
  };
}
```

### PII (Personally Identifiable Information) Handling

#### Data Classification
```typescript
// shared/data-classification.ts
export enum DataClassification {
  PUBLIC = 'public',
  INTERNAL = 'internal', 
  CONFIDENTIAL = 'confidential',
  RESTRICTED = 'restricted'
}

export interface PIIField {
  field: string;
  classification: DataClassification;
  retention: number; // days
  encryptionRequired: boolean;
}

export const dataClassificationMap: Record<string, PIIField> = {
  // Customer data
  'customer.email': {
    field: 'email',
    classification: DataClassification.CONFIDENTIAL,
    retention: 2555, // 7 years
    encryptionRequired: true
  },
  'customer.phone': {
    field: 'phone',
    classification: DataClassification.CONFIDENTIAL,
    retention: 2555,
    encryptionRequired: true
  },
  'customer.address': {
    field: 'address',
    classification: DataClassification.CONFIDENTIAL,
    retention: 2555,
    encryptionRequired: true
  },
  
  // Employee data
  'user.personalData': {
    field: 'personalData',
    classification: DataClassification.RESTRICTED,
    retention: 2555,
    encryptionRequired: true
  },
  
  // Financial data
  'invoice.bankAccount': {
    field: 'bankAccount',
    classification: DataClassification.RESTRICTED,
    retention: 3650, // 10 years (legal requirement)
    encryptionRequired: true
  }
};
```

---

## Input Validation & Sanitization

### Comprehensive Input Validation
```typescript
// shared/validation/schemas.ts
import { z } from 'zod';

// Password requirements
export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, 
    'Password must contain uppercase, lowercase, number and special character');

// Email validation
export const emailSchema = z
  .string()
  .email('Invalid email format')
  .max(255, 'Email too long');

// Czech IČO validation
export const icoSchema = z
  .string()
  .regex(/^\d{8}$/, 'IČO must be 8 digits')
  .refine((ico) => {
    // Czech IČO checksum validation
    const digits = ico.split('').map(Number);
    const weights = [8, 7, 6, 5, 4, 3, 2];
    const sum = digits.slice(0, 7).reduce((acc, digit, i) => acc + digit * weights[i], 0);
    const remainder = sum % 11;
    const checkDigit = remainder < 2 ? remainder : 11 - remainder;
    return checkDigit === digits[7];
  }, 'Invalid IČO checksum');

// Money validation
export const moneySchema = z
  .number()
  .min(0, 'Amount cannot be negative')
  .max(999999999.99, 'Amount too large')
  .refine((val) => Number.isFinite(val), 'Amount must be a valid number');

// GraphQL input validation
export function validateInput<T>(schema: z.ZodSchema<T>, input: unknown): T {
  const result = schema.safeParse(input);
  
  if (!result.success) {
    const errorMessages = result.error.errors.map(err => 
      `${err.path.join('.')}: ${err.message}`
    ).join(', ');
    
    throw new GraphQLError(`Validation error: ${errorMessages}`, {
      extensions: { 
        code: 'VALIDATION_ERROR',
        details: result.error.errors 
      }
    });
  }
  
  return result.data;
}
```

### SQL Injection Prevention
```typescript
// Prisma provides built-in SQL injection protection
// But for raw queries, use prepared statements:

export async function safeRawQuery(
  prisma: PrismaClient, 
  query: string, 
  params: any[]
) {
  // Validate that query doesn't contain dynamic SQL construction
  if (query.includes('${') || query.includes('${')) {
    throw new Error('Dynamic SQL construction not allowed');
  }
  
  // Use Prisma's safe raw query with parameters
  return prisma.$queryRaw`${query}`.bind(null, ...params);
}
```

---

## API Security

### Rate Limiting
```typescript
// shared/middleware/rate-limit.ts
import { Redis } from 'ioredis';
import { GraphQLError } from 'graphql';

export class RateLimiter {
  private redis: Redis;

  constructor() {
    this.redis = new Redis(process.env.REDIS_URL);
  }

  async checkRateLimit(
    identifier: string, 
    windowMs: number = 60000, // 1 minute
    maxRequests: number = 100
  ): Promise<void> {
    const key = `rate_limit:${identifier}`;
    const current = await this.redis.incr(key);
    
    if (current === 1) {
      await this.redis.expire(key, Math.ceil(windowMs / 1000));
    }
    
    if (current > maxRequests) {
      const ttl = await this.redis.ttl(key);
      
      throw new GraphQLError('Rate limit exceeded', {
        extensions: {
          code: 'RATE_LIMITED',
          retryAfter: ttl
        }
      });
    }
  }

  // Different limits for different operations
  async checkOperationRateLimit(
    userId: string,
    operation: string,
    context: any
  ): Promise<void> {
    const limits = {
      'login': { window: 900000, max: 5 }, // 5 attempts per 15 minutes
      'register': { window: 3600000, max: 3 }, // 3 per hour
      'createOrder': { window: 60000, max: 10 }, // 10 per minute
      'sendNotification': { window: 60000, max: 20 }, // 20 per minute
      'uploadFile': { window: 300000, max: 5 }, // 5 per 5 minutes
    };

    const limit = limits[operation];
    if (limit) {
      const identifier = `${userId}:${operation}`;
      await this.checkRateLimit(identifier, limit.window, limit.max);
    }
  }
}

// GraphQL middleware
export function createRateLimitMiddleware() {
  const rateLimiter = new RateLimiter();
  
  return {
    requestDidStart() {
      return {
        async didResolveOperation({ request, context }) {
          const operationName = request.operationName || 'unknown';
          const userId = context.user?.id || context.ip;
          
          await rateLimiter.checkOperationRateLimit(
            userId, 
            operationName, 
            context
          );
        }
      };
    }
  };
}
```

### Query Analysis & DoS Protection
```typescript
// shared/security/query-analysis.ts
import { GraphQLError } from 'graphql';
import { ValidationContext, visit } from 'graphql';

export function createQueryDepthAnalyzer(maxDepth: number = 10) {
  return (context: ValidationContext) => {
    let depth = 0;
    let maxDepthReached = 0;

    return {
      enter(node: any) {
        if (node.kind === 'Field') {
          depth++;
          maxDepthReached = Math.max(maxDepthReached, depth);
          
          if (maxDepthReached > maxDepth) {
            context.reportError(
              new GraphQLError(
                `Query depth of ${maxDepthReached} exceeds maximum depth of ${maxDepth}`,
                { extensions: { code: 'QUERY_TOO_DEEP' } }
              )
            );
          }
        }
      },
      leave(node: any) {
        if (node.kind === 'Field') {
          depth--;
        }
      }
    };
  };
}

export function createQueryTimeoutMiddleware(timeoutMs: number = 30000) {
  return {
    requestDidStart() {
      return {
        willSendResponse(requestContext: any) {
          // Set timeout for query execution
          const timeout = setTimeout(() => {
            throw new GraphQLError('Query timeout', {
              extensions: { code: 'QUERY_TIMEOUT' }
            });
          }, timeoutMs);

          // Clear timeout when response is sent
          requestContext.response.http?.on('finish', () => {
            clearTimeout(timeout);
          });
        }
      };
    }
  };
}
```

---

## Audit Logging

### Comprehensive Audit Trail
```typescript
// shared/audit/logger.ts
export interface AuditEvent {
  id: string;
  timestamp: Date;
  userId?: string;
  userEmail?: string;
  action: string;
  resource: string;
  resourceId?: string;
  ipAddress: string;
  userAgent: string;
  metadata?: Record<string, any>;
  sensitive: boolean;
}

export class AuditLogger {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  async log(event: Omit<AuditEvent, 'id' | 'timestamp'>): Promise<void> {
    const auditEvent: AuditEvent = {
      id: generateUUID(),
      timestamp: new Date(),
      ...event
    };

    // Store in database
    await this.prisma.auditLog.create({
      data: auditEvent
    });

    // For sensitive operations, also log to external system
    if (event.sensitive) {
      await this.logToExternalSystem(auditEvent);
    }
  }

  private async logToExternalSystem(event: AuditEvent): Promise<void> {
    // Send to Google Cloud Logging or external SIEM
    console.log('AUDIT:', JSON.stringify(event));
  }
}

// GraphQL middleware for automatic audit logging
export function createAuditMiddleware(auditLogger: AuditLogger) {
  return {
    requestDidStart() {
      return {
        async didResolveOperation({ request, context }) {
          const sensitiveOperations = [
            'login', 'logout', 'register',
            'createUser', 'updateUser', 'deleteUser',
            'createCustomer', 'updateCustomer', 'deleteCustomer',
            'generateInvoice', 'updateInvoiceStatus',
            'completeOrder', 'deleteOrder'
          ];

          const operation = request.operationName || 'unknown';
          const isSensitive = sensitiveOperations.includes(operation);

          await auditLogger.log({
            userId: context.user?.id,
            userEmail: context.user?.email,
            action: `graphql.${operation}`,
            resource: 'graphql_api',
            ipAddress: context.req.ip,
            userAgent: context.req.headers['user-agent'] || '',
            metadata: {
              query: request.query,
              variables: request.variables
            },
            sensitive: isSensitive
          });
        }
      };
    }
  };
}
```

---

## Security Headers & CORS

### Security Headers Configuration
```typescript
// shared/middleware/security-headers.ts
import { FastifyInstance } from 'fastify';

export async function registerSecurityHeaders(fastify: FastifyInstance) {
  await fastify.register(require('@fastify/helmet'), {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https:"],
        scriptSrc: ["'self'", "https://js.stripe.com"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'", "https://api.stripe.com"],
        fontSrc: ["'self'", "https:", "data:"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: false, // Needed for some GraphQL clients
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true
    }
  });

  // Custom security headers
  fastify.addHook('onSend', async (request, reply) => {
    reply.header('X-Frame-Options', 'DENY');
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('Referrer-Policy', 'strict-origin-when-cross-origin');
    reply.header('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  });
}
```

### CORS Configuration
```typescript
// shared/middleware/cors.ts
export const corsOptions = {
  origin: (origin: string, callback: Function) => {
    const allowedOrigins = [
      'https://app.firemni-asistent.cz',
      'https://staging.firemni-asistent.cz',
      ...(process.env.NODE_ENV === 'development' ? [
        'http://localhost:3000',
        'http://localhost:3001',
        'http://localhost:8080'
      ] : [])
    ];

    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Correlation-ID',
    'Apollo-Require-Preflight'
  ],
  maxAge: 86400 // 24 hours
};
```

---

## Secrets Management

### Google Secret Manager Integration
```typescript
// shared/secrets/manager.ts
import { SecretManagerServiceClient } from '@google-cloud/secret-manager';

export class SecretsManager {
  private client: SecretManagerServiceClient;
  private projectId: string;

  constructor() {
    this.client = new SecretManagerServiceClient();
    this.projectId = process.env.GOOGLE_CLOUD_PROJECT || 'firemni-asistent';
  }

  async getSecret(secretName: string, version: string = 'latest'): Promise<string> {
    const name = `projects/${this.projectId}/secrets/${secretName}/versions/${version}`;
    
    try {
      const [response] = await this.client.accessSecretVersion({ name });
      const secretValue = response.payload?.data?.toString();
      
      if (!secretValue) {
        throw new Error(`Secret ${secretName} is empty`);
      }
      
      return secretValue;
    } catch (error) {
      throw new Error(`Failed to get secret ${secretName}: ${error.message}`);
    }
  }

  async createSecret(secretName: string, secretValue: string): Promise<void> {
    const parent = `projects/${this.projectId}`;
    
    // Create secret
    await this.client.createSecret({
      parent,
      secretId: secretName,
      secret: {
        replication: {
          automatic: {}
        }
      }
    });

    // Add secret version
    await this.client.addSecretVersion({
      parent: `${parent}/secrets/${secretName}`,
      payload: {
        data: Buffer.from(secretValue)
      }
    });
  }
}

// Environment configuration with secrets
export async function loadConfiguration(): Promise<Config> {
  const secretsManager = new SecretsManager();
  
  const config = {
    database: {
      url: await secretsManager.getSecret('database-url'),
    },
    jwt: {
      accessSecret: await secretsManager.getSecret('jwt-access-secret'),
      refreshSecret: await secretsManager.getSecret('jwt-refresh-secret'),
    },
    rabbitmq: {
      url: await secretsManager.getSecret('rabbitmq-url'),
    },
    encryption: {
      key: await secretsManager.getSecret('database-encryption-key'),
    }
  };

  return config;
}
```

---

## Security Monitoring

### Security Event Detection
```typescript
// shared/security/monitoring.ts
export class SecurityMonitor {
  private auditLogger: AuditLogger;

  constructor(auditLogger: AuditLogger) {
    this.auditLogger = auditLogger;
  }

  async detectSuspiciousActivity(context: any): Promise<void> {
    const checks = [
      this.detectBruteForce,
      this.detectUnusualAccess,
      this.detectPrivilegeEscalation,
      this.detectMassDataAccess
    ];

    for (const check of checks) {
      await check.call(this, context);
    }
  }

  private async detectBruteForce(context: any): Promise<void> {
    if (context.operation === 'login' && context.error) {
      const key = `failed_login:${context.ip}`;
      const redis = new Redis(process.env.REDIS_URL);
      
      const attempts = await redis.incr(key);
      if (attempts === 1) {
        await redis.expire(key, 900); // 15 minutes
      }

      if (attempts >= 5) {
        await this.auditLogger.log({
          userId: context.user?.id,
          action: 'security.brute_force_detected',
          resource: 'authentication',
          ipAddress: context.ip,
          userAgent: context.userAgent,
          metadata: { attempts },
          sensitive: true
        });

        // Temporary IP ban
        await redis.set(`banned_ip:${context.ip}`, '1', 'EX', 3600);
      }
    }
  }

  private async detectUnusualAccess(context: any): Promise<void> {
    if (context.user) {
      // Check for access from new location/device
      const deviceFingerprint = this.generateDeviceFingerprint(context);
      const key = `known_devices:${context.user.id}`;
      const redis = new Redis(process.env.REDIS_URL);
      
      const knownDevices = await redis.smembers(key);
      
      if (!knownDevices.includes(deviceFingerprint)) {
        // New device detected
        await this.auditLogger.log({
          userId: context.user.id,
          action: 'security.new_device_access',
          resource: 'authentication',
          ipAddress: context.ip,
          userAgent: context.userAgent,
          metadata: { deviceFingerprint },
          sensitive: true
        });

        // Add to known devices
        await redis.sadd(key, deviceFingerprint);
        await redis.expire(key, 86400 * 30); // 30 days
      }
    }
  }

  private generateDeviceFingerprint(context: any): string {
    const crypto = require('crypto');
    const fingerprint = `${context.userAgent}:${context.ip}`;
    return crypto.createHash('sha256').update(fingerprint).digest('hex');
  }
}
```

### Vulnerability Scanning
```bash
#!/bin/bash
# scripts/security-scan.sh

echo "🔍 Running security scans..."

# NPM audit for known vulnerabilities
echo "📦 Checking npm packages..."
npm audit --audit-level=moderate

# Docker image scanning
echo "🐳 Scanning Docker images..."
docker run --rm -v /var/run/docker.sock:/var/run/docker.sock \
  -v $PWD:/app aquasec/trivy image \
  gcr.io/firemni-asistent/user-service:latest

# OWASP dependency check
echo "🛡️ Running OWASP dependency check..."
dependency-check.sh --project "Firemni Asistent" --scan ./

# Static code analysis
echo "🔍 Running static analysis..."
npx eslint --ext .ts,.js . --format json > eslint-results.json

# Check for secrets in code
echo "🔐 Checking for secrets..."
truffleHog --regex --entropy=False .

echo "✅ Security scan completed"
```

Tato bezpečnostní strategie poskytuje vícevrstevnou obranu (defense-in-depth) s důrazem na současné best practices a compliance s GDPR pro handling osobních údajů.