// Resilience Validator for Chaos Engineering
// Validates circuit breaker states and resilience patterns
import axios from 'axios';
import pino from 'pino';

const logger = pino({ name: 'resilience-validator' });

/**
 * ResilienceValidator handles validation of resilience patterns
 * 
 * Validates:
 * - Circuit breaker states (CLOSED, OPEN, HALF_OPEN)
 * - Retry patterns and backoff strategies
 * - Timeout configurations
 * - Fallback mechanisms
 * - Health check behaviors
 * - Service mesh resilience (if available)
 */
export class ResilienceValidator {
  constructor() {
    this.serviceEndpoints = new Map();
    this.circuitBreakerStates = new Map();
    this.healthCheckHistory = new Map();
    this.validationInterval = null;
  }

  /**
   * Initialize resilience validation
   */
  async initialize() {
    logger.info('Initializing resilience validator...');
    
    try {
      // Discover service endpoints
      await this.discoverServiceEndpoints();
      
      // Initialize circuit breaker monitoring
      await this.initializeCircuitBreakerMonitoring();
      
      // Validate resilience capabilities
      await this.validateResilienceCapabilities();
      
      logger.info('Resilience validator initialized successfully');
      
    } catch (error) {
      logger.error('Failed to initialize resilience validator:', error);
      throw error;
    }
  }

  /**
   * Discover service endpoints for resilience monitoring
   */
  async discoverServiceEndpoints() {
    const services = [
      'order-service',
      'billing-service',
      'inventory-service', 
      'notification-service',
      'user-service',
      'payment-service'
    ];
    
    for (const serviceName of services) {
      try {
        const serviceUrl = await this.discoverServiceUrl(serviceName);
        
        // Test resilience endpoints
        const resilienceEndpoints = await this.discoverResilienceEndpoints(serviceUrl);
        
        this.serviceEndpoints.set(serviceName, {
          baseUrl: serviceUrl,
          ...resilienceEndpoints,
          status: 'available'
        });
        
        logger.info(`Resilience endpoints discovered for ${serviceName}`, {
          baseUrl: serviceUrl,
          endpoints: Object.keys(resilienceEndpoints)
        });
        
      } catch (error) {
        logger.warn(`Could not discover resilience endpoints for ${serviceName}:`, error.message);
        this.serviceEndpoints.set(serviceName, {
          status: 'unavailable',
          error: error.message
        });
      }
    }
  }

  /**
   * Discover resilience-specific endpoints for a service
   */
  async discoverResilienceEndpoints(baseUrl) {
    const endpoints = {};
    
    // Common resilience endpoint patterns
    const endpointPatterns = [
      { name: 'circuitBreaker', path: '/internal/circuit-breaker' },
      { name: 'health', path: '/health' },
      { name: 'metrics', path: '/metrics' },
      { name: 'resilience', path: '/internal/resilience' },
      { name: 'actuator', path: '/actuator/circuitbreakers' }
    ];
    
    for (const pattern of endpointPatterns) {
      try {
        const url = `${baseUrl}${pattern.path}`;
        const response = await axios.get(url, { 
          timeout: 3000,
          headers: { 'X-Chaos-Engineering': 'true' }
        });
        
        if (response.status === 200) {
          endpoints[pattern.name] = url;
        }
        
      } catch (error) {
        // Endpoint not available, skip
      }
    }
    
    return endpoints;
  }

  /**
   * Initialize circuit breaker monitoring
   */
  async initializeCircuitBreakerMonitoring() {
    // Get initial circuit breaker states
    await this.updateCircuitBreakerStates();
    
    // Start periodic monitoring
    this.validationInterval = setInterval(async () => {
      try {
        await this.updateCircuitBreakerStates();
      } catch (error) {
        logger.warn('Failed to update circuit breaker states:', error.message);
      }
    }, 5000); // Update every 5 seconds
  }

  /**
   * Get current circuit breaker states for all services
   */
  async getCircuitBreakerStates() {
    await this.updateCircuitBreakerStates();
    
    const states = [];
    for (const [serviceName, state] of this.circuitBreakerStates) {
      states.push({
        service: serviceName,
        ...state
      });
    }
    
    return states;
  }

  /**
   * Update circuit breaker states from services
   */
  async updateCircuitBreakerStates() {
    const updatePromises = [];
    
    for (const [serviceName, endpoint] of this.serviceEndpoints) {
      if (endpoint.status === 'available') {
        updatePromises.push(
          this.getServiceCircuitBreakerState(serviceName)
            .then(state => {
              this.circuitBreakerStates.set(serviceName, {
                ...state,
                lastUpdated: new Date().toISOString()
              });
            })
            .catch(error => {
              logger.warn(`Failed to get circuit breaker state for ${serviceName}:`, error.message);
              this.circuitBreakerStates.set(serviceName, {
                state: 'UNKNOWN',
                error: error.message,
                lastUpdated: new Date().toISOString()
              });
            })
        );
      }
    }
    
    await Promise.allSettled(updatePromises);
  }

  /**
   * Get circuit breaker state for specific service
   */
  async getServiceCircuitBreakerState(serviceName) {
    const endpoint = this.serviceEndpoints.get(serviceName);
    if (!endpoint || endpoint.status !== 'available') {
      throw new Error(`Service endpoint not available: ${serviceName}`);
    }
    
    // Try multiple endpoint patterns
    const circuitBreakerEndpoints = [
      endpoint.circuitBreaker,
      endpoint.actuator,
      endpoint.resilience,
      `${endpoint.baseUrl}/internal/circuit-breaker`
    ].filter(Boolean);
    
    for (const cbEndpoint of circuitBreakerEndpoints) {
      try {
        const response = await axios.get(cbEndpoint, {
          timeout: 3000,
          headers: { 'X-Chaos-Engineering': 'true' }
        });
        
        return this.parseCircuitBreakerResponse(response.data);
        
      } catch (error) {
        continue; // Try next endpoint
      }
    }
    
    // Fallback: infer state from health and metrics
    return await this.inferCircuitBreakerState(serviceName);
  }

  /**
   * Parse circuit breaker response from different formats
   */
  parseCircuitBreakerResponse(data) {
    // Handle different response formats
    if (data.circuitBreakers) {
      // Spring Boot Actuator format
      const firstBreaker = Object.values(data.circuitBreakers)[0];
      return {
        state: firstBreaker.state || 'UNKNOWN',
        failureRate: firstBreaker.metrics?.failureRate || 0,
        calls: firstBreaker.metrics?.numberOfCalls || 0,
        successfulCalls: firstBreaker.metrics?.numberOfSuccessfulCalls || 0,
        failedCalls: firstBreaker.metrics?.numberOfFailedCalls || 0
      };
    }
    
    if (data.state) {
      // Custom format
      return {
        state: data.state,
        failureRate: data.failureRate || 0,
        calls: data.totalCalls || 0,
        successfulCalls: data.successfulCalls || 0,
        failedCalls: data.failedCalls || 0,
        lastFailureTime: data.lastFailureTime,
        nextAttempt: data.nextAttempt
      };
    }
    
    // Opossum circuit breaker format
    if (data.closed !== undefined || data.open !== undefined) {
      const state = data.open ? 'OPEN' : (data.halfOpen ? 'HALF_OPEN' : 'CLOSED');
      return {
        state,
        failureRate: data.stats?.failures / (data.stats?.failures + data.stats?.successes) * 100 || 0,
        calls: (data.stats?.failures || 0) + (data.stats?.successes || 0),
        successfulCalls: data.stats?.successes || 0,
        failedCalls: data.stats?.failures || 0,
        timeout: data.options?.timeout,
        resetTimeout: data.options?.resetTimeout
      };
    }
    
    return {
      state: 'UNKNOWN',
      error: 'Unrecognized circuit breaker format'
    };
  }

  /**
   * Infer circuit breaker state from health and metrics
   */
  async inferCircuitBreakerState(serviceName) {
    const endpoint = this.serviceEndpoints.get(serviceName);
    
    try {
      // Check health endpoint
      const healthResponse = await axios.get(endpoint.health || `${endpoint.baseUrl}/health`, {
        timeout: 3000
      });
      
      if (healthResponse.status === 200) {
        // Get metrics if available
        if (endpoint.metrics) {
          const metricsResponse = await axios.get(endpoint.metrics, {
            timeout: 3000,
            headers: { 'Accept': 'application/json, text/plain' }
          });
          
          const errorRate = this.extractErrorRateFromMetrics(metricsResponse.data);
          
          // Infer state based on error rate
          if (errorRate > 50) {
            return {
              state: 'OPEN',
              failureRate: errorRate,
              inferred: true
            };
          } else if (errorRate > 30) {
            return {
              state: 'HALF_OPEN',
              failureRate: errorRate,
              inferred: true
            };
          } else {
            return {
              state: 'CLOSED',
              failureRate: errorRate,
              inferred: true
            };
          }
        }
        
        return {
          state: 'CLOSED',
          inferred: true
        };
        
      } else {
        return {
          state: 'OPEN',
          inferred: true
        };
      }
      
    } catch (error) {
      return {
        state: 'OPEN',
        error: error.message,
        inferred: true
      };
    }
  }

  /**
   * Extract error rate from metrics data
   */
  extractErrorRateFromMetrics(metricsData) {
    if (typeof metricsData === 'string') {
      // Prometheus format
      const lines = metricsData.split('\n');
      let totalRequests = 0;
      let errorRequests = 0;
      
      for (const line of lines) {
        if (line.includes('http_requests_total')) {
          const value = parseFloat(line.split(' ').pop());
          if (!isNaN(value)) {
            totalRequests += value;
          }
        }
        if (line.includes('http_requests_total') && line.includes('status="5')) {
          const value = parseFloat(line.split(' ').pop());
          if (!isNaN(value)) {
            errorRequests += value;
          }
        }
      }
      
      return totalRequests > 0 ? (errorRequests / totalRequests) * 100 : 0;
    }
    
    if (typeof metricsData === 'object') {
      // JSON format
      const totalRequests = metricsData.http_requests_total || 0;
      const errorRequests = metricsData.http_requests_errors_total || 0;
      
      return totalRequests > 0 ? (errorRequests / totalRequests) * 100 : 0;
    }
    
    return 0;
  }

  /**
   * Check service health
   */
  async checkServiceHealth(serviceName) {
    const endpoint = this.serviceEndpoints.get(serviceName);
    if (!endpoint || endpoint.status !== 'available') {
      throw new Error(`Service endpoint not available: ${serviceName}`);
    }
    
    try {
      const healthUrl = endpoint.health || `${endpoint.baseUrl}/health`;
      const response = await axios.get(healthUrl, {
        timeout: 5000,
        headers: { 'X-Chaos-Engineering': 'true' }
      });
      
      const healthData = {
        service: serviceName,
        status: response.status === 200 ? 'healthy' : 'unhealthy',
        responseTime: response.headers['x-response-time'] || 'unknown',
        timestamp: new Date().toISOString(),
        details: response.data
      };
      
      // Store in history
      if (!this.healthCheckHistory.has(serviceName)) {
        this.healthCheckHistory.set(serviceName, []);
      }
      
      const history = this.healthCheckHistory.get(serviceName);
      history.push(healthData);
      
      // Keep only last 100 health checks
      if (history.length > 100) {
        history.splice(0, history.length - 100);
      }
      
      return healthData;
      
    } catch (error) {
      const healthData = {
        service: serviceName,
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString()
      };
      
      if (!this.healthCheckHistory.has(serviceName)) {
        this.healthCheckHistory.set(serviceName, []);
      }
      
      this.healthCheckHistory.get(serviceName).push(healthData);
      
      throw error;
    }
  }

  /**
   * Validate timeout configurations
   */
  async validateTimeoutConfigurations() {
    const timeouts = {};
    
    for (const [serviceName, endpoint] of this.serviceEndpoints) {
      if (endpoint.status === 'available') {
        try {
          const configUrl = `${endpoint.baseUrl}/internal/config/timeouts`;
          const response = await axios.get(configUrl, {
            timeout: 3000,
            headers: { 'X-Chaos-Engineering': 'true' }
          });
          
          timeouts[serviceName] = response.data;
          
        } catch (error) {
          timeouts[serviceName] = {
            error: 'Configuration not available',
            default: true
          };
        }
      }
    }
    
    return timeouts;
  }

  /**
   * Validate retry patterns
   */
  async validateRetryPatterns() {
    const retryConfigs = {};
    
    for (const [serviceName, endpoint] of this.serviceEndpoints) {
      if (endpoint.status === 'available') {
        try {
          const configUrl = `${endpoint.baseUrl}/internal/config/retry`;
          const response = await axios.get(configUrl, {
            timeout: 3000,
            headers: { 'X-Chaos-Engineering': 'true' }
          });
          
          retryConfigs[serviceName] = response.data;
          
        } catch (error) {
          retryConfigs[serviceName] = {
            error: 'Configuration not available',
            inferred: await this.inferRetryConfiguration(serviceName)
          };
        }
      }
    }
    
    return retryConfigs;
  }

  /**
   * Infer retry configuration from behavior
   */
  async inferRetryConfiguration(serviceName) {
    // This would require observing actual retry behavior
    return {
      maxRetries: 3,
      backoffStrategy: 'exponential',
      initialDelay: 1000,
      maxDelay: 30000,
      inferred: true
    };
  }

  /**
   * Validate fallback mechanisms
   */
  async validateFallbackMechanisms() {
    const fallbacks = {};
    
    for (const [serviceName, endpoint] of this.serviceEndpoints) {
      if (endpoint.status === 'available') {
        try {
          const fallbackUrl = `${endpoint.baseUrl}/internal/fallback`;
          const response = await axios.get(fallbackUrl, {
            timeout: 3000,
            headers: { 'X-Chaos-Engineering': 'true' }
          });
          
          fallbacks[serviceName] = {
            configured: true,
            ...response.data
          };
          
        } catch (error) {
          fallbacks[serviceName] = {
            configured: false,
            error: error.message
          };
        }
      }
    }
    
    return fallbacks;
  }

  /**
   * Validate service mesh resilience (Istio, Linkerd, etc.)
   */
  async validateServiceMeshResilience() {
    const meshConfig = {
      detected: false,
      type: 'unknown',
      features: []
    };
    
    try {
      // Try to detect Istio
      const istioResponse = await axios.get('http://istio-pilot.istio-system:8080/debug/config_dump', {
        timeout: 3000
      });
      
      if (istioResponse.status === 200) {
        meshConfig.detected = true;
        meshConfig.type = 'istio';
        meshConfig.features = ['circuit-breaking', 'retries', 'timeouts', 'load-balancing'];
      }
      
    } catch (error) {
      // Try to detect Linkerd
      try {
        const linkerdResponse = await axios.get('http://linkerd-controller-api.linkerd:8085/api/v1/version', {
          timeout: 3000
        });
        
        if (linkerdResponse.status === 200) {
          meshConfig.detected = true;
          meshConfig.type = 'linkerd';
          meshConfig.features = ['circuit-breaking', 'retries', 'load-balancing'];
        }
        
      } catch (linkerdError) {
        // No service mesh detected
      }
    }
    
    return meshConfig;
  }

  /**
   * Discover service URL using multiple methods
   */
  async discoverServiceUrl(serviceName) {
    const discoveryMethods = [
      () => this.tryKubernetesDiscovery(serviceName),
      () => this.tryConsulDiscovery(serviceName),
      () => this.tryEnvironmentDiscovery(serviceName),
      () => this.tryDefaultDiscovery(serviceName)
    ];
    
    for (const method of discoveryMethods) {
      try {
        const url = await method();
        if (url) {
          return url;
        }
      } catch (error) {
        continue;
      }
    }
    
    throw new Error(`Could not discover URL for service: ${serviceName}`);
  }

  /**
   * Try Kubernetes service discovery
   */
  async tryKubernetesDiscovery(serviceName) {
    const kubernetesUrl = `http://${serviceName}.default.svc.cluster.local:8080`;
    try {
      await axios.get(`${kubernetesUrl}/health`, { timeout: 3000 });
      return kubernetesUrl;
    } catch (error) {
      return null;
    }
  }

  /**
   * Try Consul service discovery
   */
  async tryConsulDiscovery(serviceName) {
    try {
      const consulUrl = process.env.CONSUL_URL || 'http://localhost:8500';
      const response = await axios.get(`${consulUrl}/v1/catalog/service/${serviceName}`, {
        timeout: 3000
      });
      
      if (response.data.length > 0) {
        const service = response.data[0];
        return `http://${service.ServiceAddress}:${service.ServicePort}`;
      }
      
      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Try environment variable discovery
   */
  async tryEnvironmentDiscovery(serviceName) {
    const envKey = `${serviceName.toUpperCase().replace('-', '_')}_URL`;
    return process.env[envKey] || null;
  }

  /**
   * Try default port discovery
   */
  async tryDefaultDiscovery(serviceName) {
    const defaultPort = this.getDefaultPort(serviceName);
    const urls = [
      `http://${serviceName}:8080`,
      `http://localhost:${defaultPort}`,
      `http://${serviceName}.local:8080`
    ];
    
    for (const url of urls) {
      try {
        await axios.get(`${url}/health`, { timeout: 3000 });
        return url;
      } catch (error) {
        continue;
      }
    }
    
    return null;
  }

  /**
   * Get default port for service
   */
  getDefaultPort(serviceName) {
    const portMap = {
      'order-service': 8081,
      'billing-service': 8082,
      'inventory-service': 8083,
      'notification-service': 8084,
      'user-service': 8085,
      'payment-service': 8086
    };
    
    return portMap[serviceName] || 8080;
  }

  /**
   * Validate overall resilience capabilities
   */
  async validateResilienceCapabilities() {
    const capabilities = {
      servicesDiscovered: this.serviceEndpoints.size,
      circuitBreakersDetected: 0,
      healthEndpointsAvailable: 0,
      metricsEndpointsAvailable: 0,
      resilienceEndpointsAvailable: 0,
      serviceMesh: await this.validateServiceMeshResilience()
    };
    
    for (const [serviceName, endpoint] of this.serviceEndpoints) {
      if (endpoint.status === 'available') {
        if (endpoint.circuitBreaker || endpoint.actuator || endpoint.resilience) {
          capabilities.circuitBreakersDetected++;
        }
        if (endpoint.health) {
          capabilities.healthEndpointsAvailable++;
        }
        if (endpoint.metrics) {
          capabilities.metricsEndpointsAvailable++;
        }
        if (endpoint.resilience) {
          capabilities.resilienceEndpointsAvailable++;
        }
      }
    }
    
    logger.info('Resilience validation capabilities:', capabilities);
    return capabilities;
  }

  /**
   * Get health check history for service
   */
  getHealthCheckHistory(serviceName, limit = 50) {
    const history = this.healthCheckHistory.get(serviceName) || [];
    return history.slice(-limit);
  }

  /**
   * Get resilience validation status
   */
  getValidationStatus() {
    return {
      initialized: this.serviceEndpoints.size > 0,
      servicesMonitored: this.serviceEndpoints.size,
      circuitBreakerStates: this.circuitBreakerStates.size,
      monitoringActive: !!this.validationInterval,
      lastUpdate: new Date().toISOString()
    };
  }

  /**
   * Clean up resources
   */
  async cleanup() {
    if (this.validationInterval) {
      clearInterval(this.validationInterval);
      this.validationInterval = null;
    }
    
    this.circuitBreakerStates.clear();
    this.healthCheckHistory.clear();
    
    logger.info('Resilience validator cleanup completed');
  }
}