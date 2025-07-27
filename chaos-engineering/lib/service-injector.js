// Service Injector for Chaos Engineering
// Injects controlled failures into microservices for resilience testing
import axios from 'axios';
import pino from 'pino';

const logger = pino({ name: 'service-injector' });

/**
 * ServiceInjector handles failure injection into microservices
 * 
 * Supports multiple failure types:
 * - timeout: Slow response simulation
 * - error: HTTP error status codes
 * - latency: Network latency injection
 * - partial: Partial service unavailability
 * - resource: Resource exhaustion simulation
 */
export class ServiceInjector {
  constructor() {
    this.activeInjections = new Map();
    this.injectionEndpoints = new Map();
    this.defaultConfig = {
      timeout: 30000,
      retries: 3,
      backoff: 1000
    };
  }

  /**
   * Setup injection points for services
   * @param {Array} endpoints - Array of service endpoints like 'service-name:/api/path'
   */
  async setupInjectionPoints(endpoints) {
    logger.info('Setting up service injection points...', { endpoints });
    
    for (const endpoint of endpoints) {
      const [serviceName, path] = endpoint.split(':');
      
      try {
        const injectionUrl = await this.discoverInjectionEndpoint(serviceName);
        this.injectionEndpoints.set(serviceName, {
          baseUrl: injectionUrl,
          targetPath: path,
          status: 'ready'
        });
        
        logger.info(`Injection point configured for ${serviceName}`, {
          service: serviceName,
          injectionUrl,
          targetPath: path
        });
        
      } catch (error) {
        logger.error(`Failed to setup injection for ${serviceName}:`, error);
        this.injectionEndpoints.set(serviceName, {
          status: 'failed',
          error: error.message
        });
      }
    }
  }

  /**
   * Inject failures into specified services
   * @param {Object} failureConfig - Configuration for failure injection
   */
  async injectFailures(failureConfig) {
    logger.info('Injecting failures into services...', { failureConfig });
    
    const injectionPromises = Object.entries(failureConfig).map(
      async ([serviceName, config]) => {
        try {
          await this.injectServiceFailure(serviceName, config);
          this.activeInjections.set(serviceName, {
            config,
            startTime: new Date().toISOString(),
            status: 'active'
          });
          
          logger.info(`Failure injection active for ${serviceName}`, { config });
          
        } catch (error) {
          logger.error(`Failed to inject failure for ${serviceName}:`, error);
          this.activeInjections.set(serviceName, {
            config,
            status: 'failed',
            error: error.message
          });
        }
      }
    );
    
    await Promise.allSettled(injectionPromises);
  }

  /**
   * Inject failure for a specific service
   */
  async injectServiceFailure(serviceName, config) {
    const endpoint = this.injectionEndpoints.get(serviceName);
    if (!endpoint || endpoint.status !== 'ready') {
      throw new Error(`Injection endpoint not ready for ${serviceName}`);
    }

    const injectionPayload = this.buildInjectionPayload(config);
    
    try {
      const response = await axios.post(
        `${endpoint.baseUrl}/chaos/inject`,
        {
          service: serviceName,
          targetPath: endpoint.targetPath,
          ...injectionPayload
        },
        {
          timeout: this.defaultConfig.timeout,
          headers: {
            'Content-Type': 'application/json',
            'X-Chaos-Engineering': 'true'
          }
        }
      );
      
      if (response.status !== 200) {
        throw new Error(`Injection API returned status ${response.status}`);
      }
      
      return response.data;
      
    } catch (error) {
      if (error.code === 'ECONNREFUSED') {
        // Fallback to environment variable injection for development
        return await this.injectViaEnvironment(serviceName, config);
      }
      throw error;
    }
  }

  /**
   * Build injection payload based on failure type
   */
  buildInjectionPayload(config) {
    const payload = {
      duration: config.duration || 300000, // 5 minutes default
      enabled: true
    };

    switch (config.failureType) {
      case 'timeout':
        payload.timeoutConfig = {
          enabled: true,
          delayMs: config.timeoutMs || 5000,
          failureRate: config.failureRate || 1.0
        };
        break;

      case 'error':
        payload.errorConfig = {
          enabled: true,
          statusCode: config.statusCode || 500,
          failureRate: config.failureRate || 1.0,
          errorMessage: config.errorMessage || 'Chaos Engineering Induced Error'
        };
        break;

      case 'latency':
        payload.latencyConfig = {
          enabled: true,
          minDelayMs: config.minDelayMs || 1000,
          maxDelayMs: config.maxDelayMs || 5000,
          failureRate: config.failureRate || 1.0
        };
        break;

      case 'partial':
        payload.partialConfig = {
          enabled: true,
          unavailabilityRate: config.unavailabilityRate || 0.5,
          statusCode: config.statusCode || 503
        };
        break;

      case 'resource':
        payload.resourceConfig = {
          enabled: true,
          memoryExhaustion: config.memoryExhaustion || false,
          cpuExhaustion: config.cpuExhaustion || false,
          diskExhaustion: config.diskExhaustion || false,
          failureRate: config.failureRate || 1.0
        };
        break;

      default:
        throw new Error(`Unsupported failure type: ${config.failureType}`);
    }

    return payload;
  }

  /**
   * Fallback injection via environment variables (for development)
   */
  async injectViaEnvironment(serviceName, config) {
    logger.warn(`Using environment variable fallback for ${serviceName}`);
    
    const envPrefix = `CHAOS_${serviceName.toUpperCase().replace('-', '_')}`;
    
    // Set environment variables that services can read
    process.env[`${envPrefix}_FAILURE_RATE`] = String(config.failureRate || 0);
    process.env[`${envPrefix}_FAILURE_TYPE`] = config.failureType || 'error';
    process.env[`${envPrefix}_TIMEOUT_MS`] = String(config.timeoutMs || 5000);
    process.env[`${envPrefix}_STATUS_CODE`] = String(config.statusCode || 500);
    process.env[`${envPrefix}_ENABLED`] = 'true';
    
    // Send signal to service if possible
    try {
      const serviceUrl = await this.getServiceUrl(serviceName);
      await axios.post(`${serviceUrl}/internal/chaos/reload`, {}, {
        timeout: 5000,
        headers: { 'X-Chaos-Engineering': 'true' }
      });
    } catch (error) {
      logger.warn(`Could not signal ${serviceName} to reload chaos config:`, error.message);
    }
    
    return { method: 'environment', status: 'injected' };
  }

  /**
   * Remove failures from specified services
   * @param {Array} serviceNames - Names of services to clean up
   */
  async removeFailures(serviceNames) {
    logger.info('Removing failures from services...', { serviceNames });
    
    const cleanupPromises = serviceNames.map(async (serviceName) => {
      try {
        await this.removeServiceFailure(serviceName);
        this.activeInjections.delete(serviceName);
        logger.info(`Failure injection removed for ${serviceName}`);
        
      } catch (error) {
        logger.error(`Failed to remove failure for ${serviceName}:`, error);
      }
    });
    
    await Promise.allSettled(cleanupPromises);
  }

  /**
   * Remove all active failure injections
   */
  async removeAllFailures() {
    const activeServices = Array.from(this.activeInjections.keys());
    if (activeServices.length > 0) {
      await this.removeFailures(activeServices);
    }
  }

  /**
   * Remove failure injection for specific service
   */
  async removeServiceFailure(serviceName) {
    const endpoint = this.injectionEndpoints.get(serviceName);
    
    if (endpoint && endpoint.status === 'ready') {
      try {
        await axios.delete(`${endpoint.baseUrl}/chaos/inject`, {
          data: { service: serviceName },
          timeout: this.defaultConfig.timeout,
          headers: { 'X-Chaos-Engineering': 'true' }
        });
      } catch (error) {
        if (error.code === 'ECONNREFUSED') {
          // Fallback to environment cleanup
          await this.cleanupEnvironmentInjection(serviceName);
        } else {
          throw error;
        }
      }
    } else {
      // Cleanup environment variables
      await this.cleanupEnvironmentInjection(serviceName);
    }
  }

  /**
   * Cleanup environment variable injection
   */
  async cleanupEnvironmentInjection(serviceName) {
    const envPrefix = `CHAOS_${serviceName.toUpperCase().replace('-', '_')}`;
    
    delete process.env[`${envPrefix}_FAILURE_RATE`];
    delete process.env[`${envPrefix}_FAILURE_TYPE`];
    delete process.env[`${envPrefix}_TIMEOUT_MS`];
    delete process.env[`${envPrefix}_STATUS_CODE`];
    delete process.env[`${envPrefix}_ENABLED`];
    
    // Signal service to reload
    try {
      const serviceUrl = await this.getServiceUrl(serviceName);
      await axios.post(`${serviceUrl}/internal/chaos/reload`, {}, {
        timeout: 5000,
        headers: { 'X-Chaos-Engineering': 'true' }
      });
    } catch (error) {
      logger.warn(`Could not signal ${serviceName} to reload chaos config:`, error.message);
    }
  }

  /**
   * Discover injection endpoint for service
   */
  async discoverInjectionEndpoint(serviceName) {
    // Try multiple discovery methods
    const discoveryMethods = [
      () => this.discoverViaKubernetes(serviceName),
      () => this.discoverViaConsul(serviceName),
      () => this.discoverViaEnvironment(serviceName),
      () => this.discoverViaDefault(serviceName)
    ];
    
    for (const method of discoveryMethods) {
      try {
        const endpoint = await method();
        if (endpoint) {
          return endpoint;
        }
      } catch (error) {
        logger.debug(`Discovery method failed for ${serviceName}:`, error.message);
      }
    }
    
    throw new Error(`Could not discover injection endpoint for ${serviceName}`);
  }

  /**
   * Discover service via Kubernetes service discovery
   */
  async discoverViaKubernetes(serviceName) {
    const kubernetesUrl = `http://${serviceName}.default.svc.cluster.local`;
    try {
      await axios.get(`${kubernetesUrl}/health`, { timeout: 5000 });
      return kubernetesUrl;
    } catch (error) {
      return null;
    }
  }

  /**
   * Discover service via Consul
   */
  async discoverViaConsul(serviceName) {
    try {
      const consulUrl = process.env.CONSUL_URL || 'http://localhost:8500';
      const response = await axios.get(
        `${consulUrl}/v1/catalog/service/${serviceName}`,
        { timeout: 5000 }
      );
      
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
   * Discover service via environment variables
   */
  async discoverViaEnvironment(serviceName) {
    const envKey = `${serviceName.toUpperCase().replace('-', '_')}_URL`;
    return process.env[envKey] || null;
  }

  /**
   * Discover service via default patterns
   */
  async discoverViaDefault(serviceName) {
    const defaultPatterns = [
      `http://${serviceName}:8080`,
      `http://localhost:${this.getDefaultPort(serviceName)}`,
      `http://${serviceName}.local:8080`
    ];
    
    for (const url of defaultPatterns) {
      try {
        await axios.get(`${url}/health`, { timeout: 2000 });
        return url;
      } catch (error) {
        continue;
      }
    }
    
    return null;
  }

  /**
   * Get service URL for communication
   */
  async getServiceUrl(serviceName) {
    const endpoint = this.injectionEndpoints.get(serviceName);
    if (endpoint && endpoint.baseUrl) {
      return endpoint.baseUrl;
    }
    
    return await this.discoverInjectionEndpoint(serviceName);
  }

  /**
   * Get default port for known services
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
   * Get status of all active injections
   */
  getInjectionStatus() {
    const status = {
      activeInjections: this.activeInjections.size,
      configuredEndpoints: this.injectionEndpoints.size,
      injections: {}
    };
    
    for (const [serviceName, injection] of this.activeInjections) {
      status.injections[serviceName] = {
        ...injection,
        duration: Date.now() - new Date(injection.startTime).getTime()
      };
    }
    
    return status;
  }

  /**
   * Validate injection capabilities
   */
  async validateInjectionCapabilities() {
    const results = {
      endpointsReachable: 0,
      endpointsConfigured: this.injectionEndpoints.size,
      capabilities: {}
    };
    
    for (const [serviceName, endpoint] of this.injectionEndpoints) {
      try {
        if (endpoint.status === 'ready') {
          const response = await axios.get(
            `${endpoint.baseUrl}/chaos/capabilities`,
            { timeout: 5000, headers: { 'X-Chaos-Engineering': 'true' } }
          );
          
          results.endpointsReachable++;
          results.capabilities[serviceName] = response.data;
        }
      } catch (error) {
        results.capabilities[serviceName] = { 
          error: error.message,
          fallback: 'environment'
        };
      }
    }
    
    return results;
  }
}