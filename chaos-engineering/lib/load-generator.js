// Load Generator for Chaos Engineering
// Generates controlled load patterns for resilience testing
import axios from 'axios';
import pino from 'pino';

const logger = pino({ name: 'load-generator' });

/**
 * LoadGenerator creates various load patterns for testing
 * 
 * Supported patterns:
 * - steady: Consistent requests per second
 * - burst: Sudden spikes in traffic
 * - ramp: Gradual increase/decrease
 * - light: Low, background traffic
 * - stress: High load for stress testing
 * - spike: Periodic traffic spikes
 */
export class LoadGenerator {
  constructor(config = {}) {
    this.config = {
      pattern: config.pattern || 'steady',
      rps: config.rps || 10,
      duration: config.duration || 60000,
      baseUrl: config.baseUrl || 'http://localhost:8080',
      endpoints: config.endpoints || ['/api/orders', '/api/billing', '/api/inventory'],
      userScenarios: config.userScenarios || [],
      headers: config.headers || {},
      ...config
    };
    
    this.isRunning = false;
    this.activeRequests = new Set();
    this.stats = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      totalBytes: 0,
      responseTimes: [],
      errors: [],
      startTime: null,
      endTime: null
    };
    
    this.intervals = [];
    this.timeouts = [];
  }

  /**
   * Start load generation
   */
  async start() {
    if (this.isRunning) {
      throw new Error('Load generator is already running');
    }
    
    logger.info('Starting load generation...', {
      pattern: this.config.pattern,
      rps: this.config.rps,
      duration: this.config.duration
    });
    
    this.isRunning = true;
    this.stats.startTime = new Date().toISOString();
    
    try {
      // Discover service endpoints
      await this.discoverServiceEndpoints();
      
      // Generate load based on pattern
      await this.generateLoadPattern();
      
      // Wait for completion
      await this.waitForCompletion();
      
    } catch (error) {
      logger.error('Load generation failed:', error);
      throw error;
    }
  }

  /**
   * Stop load generation
   */
  async stop() {
    if (!this.isRunning) {
      return;
    }
    
    logger.info('Stopping load generation...');
    this.isRunning = false;
    
    // Clear all intervals and timeouts
    this.intervals.forEach(interval => clearInterval(interval));
    this.timeouts.forEach(timeout => clearTimeout(timeout));
    this.intervals = [];
    this.timeouts = [];
    
    // Wait for active requests to complete
    await this.waitForActiveRequests();
    
    this.stats.endTime = new Date().toISOString();
    logger.info('Load generation stopped', this.getStats());
  }

  /**
   * Generate load based on configured pattern
   */
  async generateLoadPattern() {
    switch (this.config.pattern) {
      case 'steady':
        await this.generateSteadyLoad();
        break;
      case 'burst':
        await this.generateBurstLoad();
        break;
      case 'ramp':
        await this.generateRampLoad();
        break;
      case 'light':
        await this.generateLightLoad();
        break;
      case 'stress':
        await this.generateStressLoad();
        break;
      case 'spike':
        await this.generateSpikeLoad();
        break;
      default:
        throw new Error(`Unsupported load pattern: ${this.config.pattern}`);
    }
  }

  /**
   * Generate steady load
   */
  async generateSteadyLoad() {
    const intervalMs = 1000 / this.config.rps;
    
    const interval = setInterval(async () => {
      if (!this.isRunning) return;
      
      try {
        await this.executeRequest();
      } catch (error) {
        logger.warn('Request failed during steady load:', error.message);
      }
    }, intervalMs);
    
    this.intervals.push(interval);
    
    // Stop after duration
    const timeout = setTimeout(() => {
      this.stop();
    }, this.config.duration);
    
    this.timeouts.push(timeout);
  }

  /**
   * Generate burst load
   */
  async generateBurstLoad() {
    const burstDuration = 5000; // 5 seconds
    const burstInterval = 30000; // Every 30 seconds
    const burstRps = this.config.rps * 3; // 3x normal load
    const normalRps = this.config.rps;
    
    let currentRps = normalRps;
    let currentInterval = null;
    
    const updateInterval = () => {
      if (currentInterval) {
        clearInterval(currentInterval);
      }
      
      const intervalMs = 1000 / currentRps;
      currentInterval = setInterval(async () => {
        if (!this.isRunning) return;
        
        try {
          await this.executeRequest();
        } catch (error) {
          logger.warn('Request failed during burst load:', error.message);
        }
      }, intervalMs);
      
      this.intervals.push(currentInterval);
    };
    
    // Start with normal load
    updateInterval();
    
    // Schedule bursts
    const burstTimeout = setInterval(() => {
      if (!this.isRunning) return;
      
      logger.info('Starting burst phase', { rps: burstRps });
      currentRps = burstRps;
      updateInterval();
      
      // Return to normal after burst duration
      setTimeout(() => {
        if (!this.isRunning) return;
        
        logger.info('Returning to normal load', { rps: normalRps });
        currentRps = normalRps;
        updateInterval();
      }, burstDuration);
      
    }, burstInterval);
    
    this.intervals.push(burstTimeout);
    
    // Stop after duration
    const stopTimeout = setTimeout(() => {
      this.stop();
    }, this.config.duration);
    
    this.timeouts.push(stopTimeout);
  }

  /**
   * Generate ramp load (gradual increase)
   */
  async generateRampLoad() {
    const startRps = this.config.rps * 0.1; // Start at 10% of target
    const endRps = this.config.rps;
    const rampSteps = 20;
    const stepDuration = this.config.duration / rampSteps;
    
    let currentRps = startRps;
    let currentInterval = null;
    
    const updateInterval = () => {
      if (currentInterval) {
        clearInterval(currentInterval);
      }
      
      const intervalMs = 1000 / currentRps;
      currentInterval = setInterval(async () => {
        if (!this.isRunning) return;
        
        try {
          await this.executeRequest();
        } catch (error) {
          logger.warn('Request failed during ramp load:', error.message);
        }
      }, intervalMs);
      
      this.intervals.push(currentInterval);
    };
    
    // Start with initial RPS
    updateInterval();
    
    // Gradually increase RPS
    const rampInterval = setInterval(() => {
      if (!this.isRunning) return;
      
      currentRps = Math.min(currentRps + (endRps - startRps) / rampSteps, endRps);
      logger.info('Ramping load', { currentRps });
      updateInterval();
      
      if (currentRps >= endRps) {
        clearInterval(rampInterval);
      }
    }, stepDuration);
    
    this.intervals.push(rampInterval);
    
    // Stop after duration
    const stopTimeout = setTimeout(() => {
      this.stop();
    }, this.config.duration);
    
    this.timeouts.push(stopTimeout);
  }

  /**
   * Generate light load
   */
  async generateLightLoad() {
    const lightRps = Math.max(1, this.config.rps * 0.1); // 10% of configured RPS, minimum 1
    const intervalMs = 1000 / lightRps;
    
    const interval = setInterval(async () => {
      if (!this.isRunning) return;
      
      try {
        await this.executeRequest();
      } catch (error) {
        logger.warn('Request failed during light load:', error.message);
      }
    }, intervalMs);
    
    this.intervals.push(interval);
    
    // Stop after duration
    const timeout = setTimeout(() => {
      this.stop();
    }, this.config.duration);
    
    this.timeouts.push(timeout);
  }

  /**
   * Generate stress load
   */
  async generateStressLoad() {
    const stressRps = this.config.rps * 2; // 2x normal load
    const concurrentRequests = 50; // High concurrency
    
    // Generate high concurrent load
    for (let i = 0; i < concurrentRequests; i++) {
      const stressInterval = setInterval(async () => {
        if (!this.isRunning) return;
        
        try {
          await this.executeRequest();
        } catch (error) {
          logger.warn('Request failed during stress load:', error.message);
        }
      }, 1000 / (stressRps / concurrentRequests));
      
      this.intervals.push(stressInterval);
    }
    
    // Stop after duration
    const timeout = setTimeout(() => {
      this.stop();
    }, this.config.duration);
    
    this.timeouts.push(timeout);
  }

  /**
   * Generate spike load
   */
  async generateSpikeLoad() {
    const normalRps = this.config.rps;
    const spikeRps = this.config.rps * 5; // 5x normal load
    const spikeDuration = 2000; // 2 seconds
    const spikeInterval = 20000; // Every 20 seconds
    
    let currentRps = normalRps;
    let currentInterval = null;
    
    const updateInterval = () => {
      if (currentInterval) {
        clearInterval(currentInterval);
      }
      
      const intervalMs = 1000 / currentRps;
      currentInterval = setInterval(async () => {
        if (!this.isRunning) return;
        
        try {
          await this.executeRequest();
        } catch (error) {
          logger.warn('Request failed during spike load:', error.message);
        }
      }, intervalMs);
      
      this.intervals.push(currentInterval);
    };
    
    // Start with normal load
    updateInterval();
    
    // Schedule spikes
    const spikeTimeout = setInterval(() => {
      if (!this.isRunning) return;
      
      logger.info('Starting spike phase', { rps: spikeRps });
      currentRps = spikeRps;
      updateInterval();
      
      // Return to normal after spike duration
      setTimeout(() => {
        if (!this.isRunning) return;
        
        logger.info('Returning to normal load', { rps: normalRps });
        currentRps = normalRps;
        updateInterval();
      }, spikeDuration);
      
    }, spikeInterval);
    
    this.intervals.push(spikeTimeout);
    
    // Stop after duration
    const stopTimeout = setTimeout(() => {
      this.stop();
    }, this.config.duration);
    
    this.timeouts.push(stopTimeout);
  }

  /**
   * Execute a single request
   */
  async executeRequest() {
    const requestId = Date.now() + Math.random();
    this.activeRequests.add(requestId);
    
    const startTime = Date.now();
    
    try {
      // Select endpoint and scenario
      const { endpoint, scenario } = this.selectEndpointAndScenario();
      
      // Prepare request
      const requestConfig = {
        method: scenario.method || 'GET',
        url: `${this.config.baseUrl}${endpoint}`,
        headers: {
          ...this.config.headers,
          'X-Chaos-Engineering': 'true',
          'User-Agent': 'ChaosEngineering-LoadGenerator/1.0'
        },
        timeout: scenario.timeout || 10000,
        data: scenario.data
      };
      
      // Execute request
      const response = await axios(requestConfig);
      
      const endTime = Date.now();
      const responseTime = endTime - startTime;
      
      // Record success
      this.stats.totalRequests++;
      this.stats.successfulRequests++;
      this.stats.responseTimes.push(responseTime);
      this.stats.totalBytes += JSON.stringify(response.data).length;
      
      logger.debug('Request successful', {
        endpoint,
        status: response.status,
        responseTime
      });
      
    } catch (error) {
      const endTime = Date.now();
      const responseTime = endTime - startTime;
      
      // Record failure
      this.stats.totalRequests++;
      this.stats.failedRequests++;
      this.stats.responseTimes.push(responseTime);
      this.stats.errors.push({
        timestamp: new Date().toISOString(),
        error: error.message,
        status: error.response?.status,
        responseTime
      });
      
      logger.debug('Request failed', {
        error: error.message,
        status: error.response?.status,
        responseTime
      });
      
    } finally {
      this.activeRequests.delete(requestId);
    }
  }

  /**
   * Select endpoint and scenario for request
   */
  selectEndpointAndScenario() {
    // If user scenarios are defined, use them
    if (this.config.userScenarios.length > 0) {
      const scenario = this.config.userScenarios[
        Math.floor(Math.random() * this.config.userScenarios.length)
      ];
      return {
        endpoint: scenario.endpoint,
        scenario
      };
    }
    
    // Otherwise use default endpoints
    const endpoint = this.config.endpoints[
      Math.floor(Math.random() * this.config.endpoints.length)
    ];
    
    return {
      endpoint,
      scenario: this.getDefaultScenario(endpoint)
    };
  }

  /**
   * Get default scenario for endpoint
   */
  getDefaultScenario(endpoint) {
    const scenarios = {
      '/api/orders': {
        method: 'POST',
        data: {
          customerId: `customer-${Math.floor(Math.random() * 1000)}`,
          items: [
            {
              productId: `product-${Math.floor(Math.random() * 100)}`,
              quantity: Math.floor(Math.random() * 5) + 1,
              price: Math.floor(Math.random() * 100) + 10
            }
          ]
        }
      },
      '/api/billing': {
        method: 'POST',
        data: {
          orderId: `order-${Math.floor(Math.random() * 1000)}`,
          amount: Math.floor(Math.random() * 500) + 50,
          customerId: `customer-${Math.floor(Math.random() * 1000)}`
        }
      },
      '/api/inventory': {
        method: 'GET'
      }
    };
    
    return scenarios[endpoint] || { method: 'GET' };
  }

  /**
   * Discover service endpoints
   */
  async discoverServiceEndpoints() {
    if (this.config.baseUrl !== 'http://localhost:8080') {
      return; // Custom base URL provided
    }
    
    const services = ['order-service', 'billing-service', 'inventory-service'];
    
    for (const serviceName of services) {
      try {
        const serviceUrl = await this.discoverServiceUrl(serviceName);
        
        // Update endpoints for this service
        const serviceEndpoints = this.config.endpoints.filter(ep => 
          ep.includes(serviceName.replace('-service', ''))
        );
        
        if (serviceEndpoints.length > 0) {
          this.config.baseUrl = serviceUrl;
          break;
        }
        
      } catch (error) {
        logger.debug(`Could not discover ${serviceName}:`, error.message);
      }
    }
  }

  /**
   * Discover service URL
   */
  async discoverServiceUrl(serviceName) {
    const urls = [
      `http://${serviceName}:8080`,
      `http://localhost:${this.getDefaultPort(serviceName)}`,
      `http://${serviceName}.default.svc.cluster.local:8080`
    ];
    
    for (const url of urls) {
      try {
        await axios.get(`${url}/health`, { timeout: 3000 });
        return url;
      } catch (error) {
        continue;
      }
    }
    
    throw new Error(`Could not discover URL for ${serviceName}`);
  }

  /**
   * Get default port for service
   */
  getDefaultPort(serviceName) {
    const portMap = {
      'order-service': 8081,
      'billing-service': 8082,
      'inventory-service': 8083,
      'notification-service': 8084
    };
    
    return portMap[serviceName] || 8080;
  }

  /**
   * Wait for load generation completion
   */
  async waitForCompletion() {
    return new Promise((resolve) => {
      const checkCompletion = () => {
        if (!this.isRunning) {
          resolve();
        } else {
          setTimeout(checkCompletion, 1000);
        }
      };
      
      checkCompletion();
    });
  }

  /**
   * Wait for active requests to complete
   */
  async waitForActiveRequests(maxWait = 30000) {
    const startTime = Date.now();
    
    while (this.activeRequests.size > 0 && Date.now() - startTime < maxWait) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    if (this.activeRequests.size > 0) {
      logger.warn(`${this.activeRequests.size} requests still active after timeout`);
    }
  }

  /**
   * Get load generation statistics
   */
  getStats() {
    const duration = this.stats.endTime 
      ? new Date(this.stats.endTime).getTime() - new Date(this.stats.startTime).getTime()
      : Date.now() - new Date(this.stats.startTime).getTime();
    
    const responseTimes = this.stats.responseTimes;
    const avgResponseTime = responseTimes.length > 0 
      ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length 
      : 0;
    
    const p95ResponseTime = responseTimes.length > 0
      ? this.calculatePercentile(responseTimes, 95)
      : 0;
    
    const p99ResponseTime = responseTimes.length > 0
      ? this.calculatePercentile(responseTimes, 99)
      : 0;
    
    return {
      pattern: this.config.pattern,
      duration: duration,
      totalRequests: this.stats.totalRequests,
      successfulRequests: this.stats.successfulRequests,
      failedRequests: this.stats.failedRequests,
      successRate: this.stats.totalRequests > 0 
        ? (this.stats.successfulRequests / this.stats.totalRequests) * 100 
        : 0,
      errorRate: this.stats.totalRequests > 0 
        ? (this.stats.failedRequests / this.stats.totalRequests) * 100 
        : 0,
      requestsPerSecond: duration > 0 ? (this.stats.totalRequests / duration) * 1000 : 0,
      avgResponseTime,
      p95ResponseTime,
      p99ResponseTime,
      totalBytes: this.stats.totalBytes,
      errorBreakdown: this.getErrorBreakdown()
    };
  }

  /**
   * Calculate percentile from array of values
   */
  calculatePercentile(values, percentile) {
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[index] || 0;
  }

  /**
   * Get error breakdown by type
   */
  getErrorBreakdown() {
    const breakdown = {};
    
    for (const error of this.stats.errors) {
      const key = error.status ? `HTTP_${error.status}` : 'NETWORK_ERROR';
      breakdown[key] = (breakdown[key] || 0) + 1;
    }
    
    return breakdown;
  }

  /**
   * Get current load generation status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      activeRequests: this.activeRequests.size,
      pattern: this.config.pattern,
      targetRps: this.config.rps,
      duration: this.config.duration,
      stats: this.getStats()
    };
  }
}