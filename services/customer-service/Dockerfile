# Multi-stage Dockerfile for Node.js customer-service
# Stage 1: Build stage
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Install build dependencies
RUN apk add --no-cache python3 make g++

# Copy package files
COPY package*.json ./

# Install all dependencies (including devDependencies for build)
RUN npm install --silent

# Stage 2: Production stage
FROM node:18-alpine AS production

# Install security updates and remove unnecessary packages
RUN apk update && apk upgrade && apk add --no-cache dumb-init

# Create app user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Copy production dependencies from builder stage
COPY --from=builder /app/node_modules ./node_modules

# Copy application source code
COPY --chown=nodejs:nodejs src/ ./src/

# Create logs directory
RUN mkdir -p /app/logs && chown -R nodejs:nodejs /app/logs

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3002

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3002/health', (res) => { \
    process.exit(res.statusCode === 200 ? 0 : 1); \
  }).on('error', () => process.exit(1));"

# Expose port
EXPOSE 3002

# Switch to non-root user
USER nodejs

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["node", "src/app.js"]

# Labels for metadata
LABEL maintainer="Firemní Asistent Team <support@firemni-asistent.com>"
LABEL version="1.0.0"
LABEL description="Customer management microservice"
LABEL org.opencontainers.image.source="https://github.com/horakovsky/firemni-asistent"
LABEL org.opencontainers.image.title="customer-service"
LABEL org.opencontainers.image.description="Customer management microservice"
LABEL org.opencontainers.image.version="1.0.0"