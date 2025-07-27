// Metrics Collector for Chaos Engineering
// Integrates with Google Cloud Monitoring and application metrics
import { Monitoring } from '@google-cloud/monitoring';
import axios from 'axios';
import pino from 'pino';

const logger = pino({ name: 'metrics-collector' });

/**
 * MetricsCollector handles metrics collection from various sources
 * 
 * Supports multiple metric sources:
 * - Google Cloud Monitoring (Stackdriver)
 * - Prometheus endpoints
 * - Application health endpoints
 * - Custom metric endpoints
 * - System resource metrics
 */
export class MetricsCollector {
  constructor() {
    this.monitoringClient = null;
    this.projectId = process.env.GOOGLE_CLOUD_PROJECT || 'firemni-asistent';
    this.metricsEndpoints = new Map();
    this.baselineMetrics = null;
    this.collectionInterval = null;
    this.metricsHistory = [];
  }

  /**
   * Initialize metrics collection
   */
  async initialize() {
    logger.info('Initializing metrics collector...');
    
    try {
      // Initialize Google Cloud Monitoring
      await this.initializeCloudMonitoring();
      
      // Discover application metrics endpoints
      await this.discoverMetricsEndpoints();
      
      // Validate metrics collection capabilities
      await this.validateMetricsCapabilities();
      
      logger.info('Metrics collector initialized successfully');
      
    } catch (error) {
      logger.error('Failed to initialize metrics collector:', error);
      throw error;
    }
  }

  /**
   * Initialize Google Cloud Monitoring client
   */
  async initializeCloudMonitoring() {
    try {
      this.monitoringClient = new Monitoring.MetricServiceClient();
      
      // Test connection
      const [project] = await this.monitoringClient.getProject({
        name: `projects/${this.projectId}`
      });
      
      logger.info('Google Cloud Monitoring initialized', {
        projectId: this.projectId,
        projectName: project.displayName
      });
      
    } catch (error) {
      logger.warn('Google Cloud Monitoring not available, using fallback metrics:', error.message);
      this.monitoringClient = null;
    }
  }

  /**
   * Discover metrics endpoints for services
   */
  async discoverMetricsEndpoints() {
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
        const metricsUrl = `${serviceUrl}/metrics`;
        
        // Test metrics endpoint
        const response = await axios.get(metricsUrl, { 
          timeout: 5000,
          headers: { 'Accept': 'application/json, text/plain' }
        });
        
        this.metricsEndpoints.set(serviceName, {
          url: metricsUrl,
          format: this.detectMetricsFormat(response.headers['content-type'], response.data),
          status: 'available'
        });
        
        logger.info(`Metrics endpoint discovered for ${serviceName}`, { 
          url: metricsUrl,
          format: this.metricsEndpoints.get(serviceName).format
        });
        
      } catch (error) {
        logger.warn(`Metrics endpoint not available for ${serviceName}:`, error.message);
        this.metricsEndpoints.set(serviceName, {
          status: 'unavailable',
          error: error.message
        });
      }
    }
  }

  /**
   * Detect metrics format (Prometheus, JSON, custom)
   */
  detectMetricsFormat(contentType, data) {
    if (contentType && contentType.includes('text/plain')) {
      return 'prometheus';
    } else if (contentType && contentType.includes('application/json')) {
      return 'json';
    } else if (typeof data === 'string' && data.includes('# HELP')) {
      return 'prometheus';
    } else {
      return 'json';
    }
  }

  /**
   * Collect baseline metrics before experiment
   */
  async collectBaseline() {
    logger.info('Collecting baseline metrics...');
    
    const baseline = {
      timestamp: new Date().toISOString(),
      cloudMetrics: {},
      applicationMetrics: {},
      systemMetrics: {}
    };
    
    try {
      // Collect from all sources
      if (this.monitoringClient) {
        baseline.cloudMetrics = await this.collectCloudMonitoringBaseline();
      }
      
      baseline.applicationMetrics = await this.collectApplicationBaseline();
      baseline.systemMetrics = await this.collectSystemBaseline();
      
      this.baselineMetrics = baseline;
      logger.info('Baseline metrics collected', {
        cloudMetricsCount: Object.keys(baseline.cloudMetrics).length,
        applicationMetricsCount: Object.keys(baseline.applicationMetrics).length,
        systemMetricsCount: Object.keys(baseline.systemMetrics).length
      });
      
      return baseline;
      
    } catch (error) {
      logger.error('Failed to collect baseline metrics:', error);
      throw error;
    }
  }

  /**
   * Collect real-time metrics during experiment
   */
  async collectRealtime() {
    const metrics = {
      timestamp: new Date().toISOString(),
      cloudMetrics: {},
      applicationMetrics: {},
      systemMetrics: {},
      calculatedMetrics: {}
    };
    
    try {
      // Collect from all sources in parallel
      const [cloudMetrics, applicationMetrics, systemMetrics] = await Promise.allSettled([
        this.monitoringClient ? this.collectCloudMonitoringMetrics() : Promise.resolve({}),
        this.collectApplicationMetrics(),
        this.collectSystemMetrics()
      ]);
      
      if (cloudMetrics.status === 'fulfilled') {
        metrics.cloudMetrics = cloudMetrics.value;
      }
      
      if (applicationMetrics.status === 'fulfilled') {
        metrics.applicationMetrics = applicationMetrics.value;
      }
      
      if (systemMetrics.status === 'fulfilled') {
        metrics.systemMetrics = systemMetrics.value;
      }
      
      // Calculate derived metrics
      metrics.calculatedMetrics = this.calculateDerivedMetrics(metrics);
      
      // Store in history
      this.metricsHistory.push(metrics);
      
      // Keep only last 1000 data points
      if (this.metricsHistory.length > 1000) {
        this.metricsHistory = this.metricsHistory.slice(-1000);
      }
      
      return this.flattenMetrics(metrics);
      
    } catch (error) {
      logger.error('Failed to collect real-time metrics:', error);
      return { error: error.message, timestamp: metrics.timestamp };
    }
  }

  /**
   * Collect Google Cloud Monitoring baseline
   */
  async collectCloudMonitoringBaseline() {
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - 10 * 60 * 1000); // 10 minutes ago
    
    const metrics = {};
    
    // Core application metrics
    const metricTypes = [
      'compute.googleapis.com/instance/cpu/utilization',
      'compute.googleapis.com/instance/memory/utilization',
      'gae.googleapis.com/http/server/response_latencies',
      'gae.googleapis.com/http/server/request_count',
      'gae.googleapis.com/http/server/response_count'
    ];
    
    for (const metricType of metricTypes) {
      try {
        const request = {
          name: `projects/${this.projectId}`,
          filter: `metric.type="${metricType}"`,
          interval: {
            endTime: { seconds: Math.floor(endTime.getTime() / 1000) },
            startTime: { seconds: Math.floor(startTime.getTime() / 1000) }
          }
        };
        
        const [timeSeries] = await this.monitoringClient.listTimeSeries(request);
        
        if (timeSeries.length > 0) {
          metrics[metricType] = this.aggregateTimeSeries(timeSeries);
        }
        
      } catch (error) {
        logger.warn(`Failed to collect ${metricType}:`, error.message);
      }
    }
    
    return metrics;
  }

  /**
   * Collect current Google Cloud Monitoring metrics
   */
  async collectCloudMonitoringMetrics() {
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - 2 * 60 * 1000); // 2 minutes ago
    
    const metrics = {};
    
    // Core application metrics
    const metricTypes = [
      'compute.googleapis.com/instance/cpu/utilization',
      'compute.googleapis.com/instance/memory/utilization', 
      'gae.googleapis.com/http/server/response_latencies',
      'gae.googleapis.com/http/server/request_count',
      'gae.googleapis.com/http/server/response_count'
    ];
    
    const promises = metricTypes.map(async (metricType) => {
      try {
        const request = {
          name: `projects/${this.projectId}`,
          filter: `metric.type="${metricType}"`,
          interval: {
            endTime: { seconds: Math.floor(endTime.getTime() / 1000) },
            startTime: { seconds: Math.floor(startTime.getTime() / 1000) }
          }
        };
        
        const [timeSeries] = await this.monitoringClient.listTimeSeries(request);
        
        if (timeSeries.length > 0) {
          metrics[metricType] = this.aggregateTimeSeries(timeSeries);
        }
        
      } catch (error) {
        logger.warn(`Failed to collect ${metricType}:`, error.message);
      }
    });
    
    await Promise.allSettled(promises);
    return metrics;
  }

  /**
   * Collect application-specific metrics
   */
  async collectApplicationBaseline() {
    const metrics = {};
    
    for (const [serviceName, endpoint] of this.metricsEndpoints) {
      if (endpoint.status === 'available') {
        try {
          const serviceMetrics = await this.collectServiceMetrics(serviceName);
          metrics[serviceName] = serviceMetrics;
        } catch (error) {
          logger.warn(`Failed to collect baseline for ${serviceName}:`, error.message);
        }
      }
    }
    
    return metrics;
  }

  /**
   * Collect current application metrics
   */
  async collectApplicationMetrics() {
    const metrics = {};
    
    const promises = [];
    for (const [serviceName, endpoint] of this.metricsEndpoints) {
      if (endpoint.status === 'available') {
        promises.push(
          this.collectServiceMetrics(serviceName)
            .then(serviceMetrics => {
              metrics[serviceName] = serviceMetrics;
            })
            .catch(error => {
              logger.warn(`Failed to collect metrics for ${serviceName}:`, error.message);
              metrics[serviceName] = { error: error.message };
            })
        );
      }
    }
    
    await Promise.allSettled(promises);
    return metrics;
  }

  /**
   * Collect metrics from specific service
   */
  async collectServiceMetrics(serviceName) {
    const endpoint = this.metricsEndpoints.get(serviceName);
    if (!endpoint || endpoint.status !== 'available') {
      throw new Error(`Metrics endpoint not available for ${serviceName}`);
    }
    
    try {
      const response = await axios.get(endpoint.url, {
        timeout: 5000,
        headers: { 'Accept': 'application/json, text/plain' }
      });
      
      if (endpoint.format === 'prometheus') {
        return this.parsePrometheusMetrics(response.data);
      } else {
        return response.data;
      }
      
    } catch (error) {
      throw new Error(`Failed to collect metrics from ${serviceName}: ${error.message}`);
    }
  }

  /**
   * Parse Prometheus format metrics
   */
  parsePrometheusMetrics(metricsText) {
    const metrics = {};
    const lines = metricsText.split('\n');
    
    for (const line of lines) {
      if (line.startsWith('#') || line.trim() === '') {
        continue;
      }
      
      const spaceIndex = line.lastIndexOf(' ');
      if (spaceIndex === -1) continue;
      
      const metricName = line.substring(0, spaceIndex);
      const metricValue = parseFloat(line.substring(spaceIndex + 1));
      
      if (!isNaN(metricValue)) {
        metrics[metricName] = metricValue;
      }
    }
    
    return metrics;
  }

  /**
   * Collect system-level metrics
   */
  async collectSystemBaseline() {
    return await this.collectSystemMetrics();
  }

  /**
   * Collect current system metrics
   */
  async collectSystemMetrics() {
    const metrics = {
      timestamp: new Date().toISOString(),
      memory: await this.getMemoryMetrics(),
      cpu: await this.getCpuMetrics(),
      network: await this.getNetworkMetrics(),
      process: await this.getProcessMetrics()
    };
    
    return metrics;
  }

  /**
   * Get memory metrics
   */
  async getMemoryMetrics() {
    const memInfo = process.memoryUsage();
    return {
      heapUsed: memInfo.heapUsed,
      heapTotal: memInfo.heapTotal,
      external: memInfo.external,
      rss: memInfo.rss,
      usagePercent: (memInfo.heapUsed / memInfo.heapTotal) * 100
    };
  }

  /**
   * Get CPU metrics
   */
  async getCpuMetrics() {
    const cpuUsage = process.cpuUsage();
    return {
      user: cpuUsage.user,
      system: cpuUsage.system,
      total: cpuUsage.user + cpuUsage.system
    };
  }

  /**
   * Get network metrics (simplified)
   */
  async getNetworkMetrics() {
    return {
      activeConnections: 0, // Would need system-level access
      bytesReceived: 0,
      bytesSent: 0
    };
  }

  /**
   * Get process metrics
   */
  async getProcessMetrics() {
    return {
      uptime: process.uptime(),
      pid: process.pid,
      ppid: process.ppid,
      platform: process.platform,
      nodeVersion: process.version
    };
  }

  /**
   * Get order service specific metrics
   */
  async getOrderServiceMetrics() {
    try {
      const orderServiceUrl = await this.discoverServiceUrl('order-service');
      const response = await axios.get(`${orderServiceUrl}/internal/metrics`, {
        timeout: 5000,
        headers: { 'X-Chaos-Engineering': 'true' }
      });
      
      return response.data;
      
    } catch (error) {
      logger.warn('Could not collect order service metrics:', error.message);
      return {
        pendingBillingCount: 0,
        totalOrders: 0,
        errorRate: 0
      };
    }
  }

  /**
   * Calculate derived metrics
   */
  calculateDerivedMetrics(metrics) {
    const derived = {};
    
    try {
      // Calculate error rates from application metrics
      derived.errorRate = this.calculateErrorRate(metrics.applicationMetrics);
      
      // Calculate average response time
      derived.avgResponseTime = this.calculateAvgResponseTime(metrics.applicationMetrics);
      
      // Calculate throughput
      derived.throughput = this.calculateThroughput(metrics.applicationMetrics);
      
      // Calculate availability
      derived.availability = this.calculateAvailability(metrics.applicationMetrics);
      
      // Calculate resource utilization
      derived.resourceUtilization = this.calculateResourceUtilization(metrics.systemMetrics);
      
    } catch (error) {
      logger.warn('Failed to calculate derived metrics:', error.message);
    }
    
    return derived;
  }

  /**
   * Calculate error rate across services
   */
  calculateErrorRate(applicationMetrics) {
    let totalRequests = 0;
    let totalErrors = 0;
    
    for (const [serviceName, serviceMetrics] of Object.entries(applicationMetrics)) {
      if (serviceMetrics.error) continue;
      
      const requests = serviceMetrics.http_requests_total || 0;
      const errors = serviceMetrics.http_requests_errors_total || 0;
      
      totalRequests += requests;
      totalErrors += errors;
    }
    
    return totalRequests > 0 ? (totalErrors / totalRequests) * 100 : 0;
  }

  /**
   * Calculate average response time
   */
  calculateAvgResponseTime(applicationMetrics) {
    let totalDuration = 0;
    let serviceCount = 0;
    
    for (const [serviceName, serviceMetrics] of Object.entries(applicationMetrics)) {
      if (serviceMetrics.error) continue;
      
      const avgResponseTime = serviceMetrics.http_request_duration_ms_avg || 0;
      if (avgResponseTime > 0) {
        totalDuration += avgResponseTime;
        serviceCount++;
      }
    }
    
    return serviceCount > 0 ? totalDuration / serviceCount : 0;
  }

  /**
   * Calculate throughput (requests per second)
   */
  calculateThroughput(applicationMetrics) {
    let totalRps = 0;
    
    for (const [serviceName, serviceMetrics] of Object.entries(applicationMetrics)) {
      if (serviceMetrics.error) continue;
      
      const rps = serviceMetrics.http_requests_per_second || 0;
      totalRps += rps;
    }
    
    return totalRps;
  }

  /**
   * Calculate availability percentage
   */
  calculateAvailability(applicationMetrics) {
    let healthyServices = 0;
    let totalServices = 0;
    
    for (const [serviceName, serviceMetrics] of Object.entries(applicationMetrics)) {
      totalServices++;
      
      if (!serviceMetrics.error) {
        const uptime = serviceMetrics.up || 0;
        if (uptime === 1) {
          healthyServices++;
        }
      }
    }
    
    return totalServices > 0 ? (healthyServices / totalServices) * 100 : 0;
  }

  /**
   * Calculate resource utilization
   */
  calculateResourceUtilization(systemMetrics) {
    return {
      memory: systemMetrics.memory?.usagePercent || 0,
      cpu: 0, // Would need proper CPU calculation
      overall: systemMetrics.memory?.usagePercent || 0
    };
  }

  /**
   * Aggregate time series data
   */
  aggregateTimeSeries(timeSeries) {
    let sum = 0;
    let count = 0;
    let min = Infinity;
    let max = -Infinity;
    
    for (const series of timeSeries) {
      for (const point of series.points) {
        const value = point.value.doubleValue || point.value.int64Value || 0;
        sum += value;
        count++;
        min = Math.min(min, value);
        max = Math.max(max, value);
      }
    }
    
    return {
      avg: count > 0 ? sum / count : 0,
      min: min === Infinity ? 0 : min,
      max: max === -Infinity ? 0 : max,
      sum,
      count
    };
  }

  /**
   * Flatten nested metrics structure
   */
  flattenMetrics(metrics) {
    const flattened = {};
    
    const flatten = (obj, prefix = '') => {
      for (const [key, value] of Object.entries(obj)) {
        const newKey = prefix ? `${prefix}.${key}` : key;
        
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          flatten(value, newKey);
        } else {
          flattened[newKey] = value;
        }
      }
    };
    
    flatten(metrics);
    return flattened;
  }

  /**
   * Discover service URL
   */
  async discoverServiceUrl(serviceName) {
    // Try multiple discovery methods
    const urls = [
      `http://${serviceName}:8080`,
      `http://localhost:${this.getDefaultPort(serviceName)}`,
      `http://${serviceName}.default.svc.cluster.local:8080`
    ];
    
    for (const url of urls) {
      try {
        await axios.get(`${url}/health`, { timeout: 2000 });
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
      'notification-service': 8084,
      'user-service': 8085,
      'payment-service': 8086
    };
    
    return portMap[serviceName] || 8080;
  }

  /**
   * Validate metrics collection capabilities
   */
  async validateMetricsCapabilities() {
    const capabilities = {
      cloudMonitoring: !!this.monitoringClient,
      applicationMetrics: this.metricsEndpoints.size,
      systemMetrics: true,
      endpoints: {}
    };
    
    for (const [serviceName, endpoint] of this.metricsEndpoints) {
      capabilities.endpoints[serviceName] = endpoint.status;
    }
    
    logger.info('Metrics collection capabilities:', capabilities);
    return capabilities;
  }

  /**
   * Get metrics collection status
   */
  getCollectionStatus() {
    return {
      initialized: !!this.monitoringClient || this.metricsEndpoints.size > 0,
      cloudMonitoring: !!this.monitoringClient,
      endpointsConfigured: this.metricsEndpoints.size,
      historySize: this.metricsHistory.length,
      baselineCollected: !!this.baselineMetrics
    };
  }

  /**
   * Get metrics history for analysis
   */
  getMetricsHistory(limit = 100) {
    return this.metricsHistory.slice(-limit);
  }

  /**
   * Clean up resources
   */
  async cleanup() {
    if (this.collectionInterval) {
      clearInterval(this.collectionInterval);
      this.collectionInterval = null;
    }
    
    this.metricsHistory = [];
    logger.info('Metrics collector cleanup completed');
  }
}