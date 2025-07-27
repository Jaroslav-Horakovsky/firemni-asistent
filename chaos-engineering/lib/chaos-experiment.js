// Base Chaos Engineering Experiment Framework
// Provides common infrastructure for chaos engineering experiments
import pino from 'pino';
import fs from 'fs-extra';
import path from 'path';

const logger = pino({ name: 'chaos-experiment' });

/**
 * Base class for all chaos engineering experiments
 * Provides common functionality for experiment lifecycle management
 */
export class ChaosExperiment {
  constructor(name, config = {}) {
    this.name = name;
    this.config = {
      description: config.description || 'Chaos engineering experiment',
      hypothesis: config.hypothesis || 'System should remain resilient under failure conditions',
      duration: config.duration || '5m',
      rollbackTimeout: config.rollbackTimeout || '1m',
      requiredServices: config.requiredServices || [],
      environment: config.environment || 'staging',
      dryRun: config.dryRun || false,
      ...config
    };
    
    this.startTime = null;
    this.endTime = null;
    this.results = null;
    this.status = 'initialized';
    this.rollbackTrigger = false;
    
    // Create results directory
    this.resultsDir = path.join(process.cwd(), 'results');
    fs.ensureDirSync(this.resultsDir);
  }

  /**
   * Run the complete experiment lifecycle
   */
  async run() {
    logger.info(`Starting chaos experiment: ${this.name}`, {
      environment: this.config.environment,
      hypothesis: this.config.hypothesis,
      dryRun: this.config.dryRun
    });
    
    this.startTime = new Date().toISOString();
    this.status = 'running';
    
    try {
      // Pre-experiment validation
      await this.preValidation();
      
      // Setup experiment environment
      await this.setup();
      
      // Execute experiment with monitoring
      this.results = await this.executeWithMonitoring();
      
      // Post-experiment validation
      await this.postValidation();
      
      this.status = 'completed';
      this.endTime = new Date().toISOString();
      
      logger.info(`Chaos experiment completed: ${this.name}`, {
        duration: this.getDuration(),
        status: this.status,
        resultSummary: this.getResultSummary()
      });
      
      return this.results;
      
    } catch (error) {
      this.status = 'failed';
      this.endTime = new Date().toISOString();
      
      logger.error(`Chaos experiment failed: ${this.name}`, {
        error: error.message,
        duration: this.getDuration()
      });
      
      // Ensure cleanup runs even on failure
      try {
        await this.cleanup();
      } catch (cleanupError) {
        logger.error('Cleanup failed:', cleanupError);
      }
      
      throw error;
      
    } finally {
      // Always attempt cleanup
      if (this.status !== 'failed') {
        await this.cleanup();
      }
      
      // Save experiment results
      await this.saveResults();
    }
  }

  /**
   * Execute experiment with continuous monitoring and rollback capability
   */
  async executeWithMonitoring() {
    const monitoringInterval = 5000; // 5 seconds
    let monitoringActive = true;
    
    // Start monitoring in background
    const monitoringPromise = this.startMonitoring(monitoringInterval);
    
    // Setup rollback trigger monitoring
    const rollbackPromise = this.monitorRollbackTriggers();
    
    try {
      // Execute the main experiment
      const experimentPromise = this.execute();
      
      // Wait for experiment completion or rollback trigger
      const result = await Promise.race([
        experimentPromise,
        rollbackPromise
      ]);
      
      monitoringActive = false;
      
      if (this.rollbackTrigger) {
        logger.warn(`Experiment ${this.name} triggered rollback`);
        await this.rollback();
        throw new Error('Experiment rolled back due to safety trigger');
      }
      
      return result;
      
    } finally {
      monitoringActive = false;
      await monitoringPromise.catch(() => {}); // Ignore monitoring errors
    }
  }

  /**
   * Start background monitoring during experiment
   */
  async startMonitoring(interval) {
    while (this.status === 'running') {
      try {
        await this.monitorSystemHealth();
        await this.sleep(interval);
      } catch (error) {
        logger.warn('Monitoring error:', error.message);
      }
    }
  }

  /**
   * Monitor for conditions that should trigger rollback
   */
  async monitorRollbackTriggers() {
    const rollbackConditions = [
      this.checkCriticalServiceHealth.bind(this),
      this.checkErrorRateThreshold.bind(this),
      this.checkResponseTimeThreshold.bind(this),
      this.checkSystemResourceUsage.bind(this)
    ];
    
    while (this.status === 'running' && !this.rollbackTrigger) {
      try {
        for (const condition of rollbackConditions) {
          const shouldRollback = await condition();
          if (shouldRollback) {
            this.rollbackTrigger = true;
            logger.error(`Rollback triggered by: ${condition.name}`);
            return;
          }
        }
        
        await this.sleep(2000); // Check every 2 seconds
        
      } catch (error) {
        logger.warn('Rollback monitoring error:', error.message);
        await this.sleep(5000);
      }
    }
  }

  /**
   * Check if critical services are still healthy
   */
  async checkCriticalServiceHealth() {
    try {
      const healthChecks = await Promise.allSettled(
        this.config.requiredServices.map(service => this.checkServiceHealth(service))
      );
      
      const failures = healthChecks.filter(result => result.status === 'rejected').length;
      const failureRate = failures / healthChecks.length;
      
      // Trigger rollback if more than 50% of critical services are unhealthy
      return failureRate > 0.5;
      
    } catch (error) {
      logger.warn('Failed to check service health:', error.message);
      return false;
    }
  }

  /**
   * Check if system error rate exceeds critical threshold
   */
  async checkErrorRateThreshold() {
    try {
      const metrics = await this.getCurrentMetrics();
      const errorRate = metrics.errorRate || 0;
      
      // Trigger rollback if error rate exceeds 80%
      return errorRate > 80;
      
    } catch (error) {
      logger.warn('Failed to check error rate:', error.message);
      return false;
    }
  }

  /**
   * Check if response times exceed critical threshold
   */
  async checkResponseTimeThreshold() {
    try {
      const metrics = await this.getCurrentMetrics();
      const p99ResponseTime = metrics.p99ResponseTime || 0;
      
      // Trigger rollback if P99 response time exceeds 30 seconds
      return p99ResponseTime > 30000;
      
    } catch (error) {
      logger.warn('Failed to check response time:', error.message);
      return false;
    }
  }

  /**
   * Check if system resource usage is critical
   */
  async checkSystemResourceUsage() {
    try {
      const metrics = await this.getCurrentMetrics();
      const cpuUsage = metrics.cpuUsage || 0;
      const memoryUsage = metrics.memoryUsage || 0;
      
      // Trigger rollback if CPU > 95% or Memory > 90%
      return cpuUsage > 95 || memoryUsage > 90;
      
    } catch (error) {
      logger.warn('Failed to check resource usage:', error.message);
      return false;
    }
  }

  /**
   * Pre-experiment validation
   */
  async preValidation() {
    logger.info(`Running pre-experiment validation for ${this.name}...`);
    
    // Validate environment
    if (!['dev', 'staging'].includes(this.config.environment)) {
      throw new Error(`Chaos experiments not allowed in environment: ${this.config.environment}`);
    }
    
    // Validate required services are available
    if (this.config.requiredServices.length > 0) {
      const healthChecks = await Promise.allSettled(
        this.config.requiredServices.map(service => this.checkServiceHealth(service))
      );
      
      const unhealthyServices = healthChecks
        .filter(result => result.status === 'rejected')
        .map((result, index) => this.config.requiredServices[index]);
      
      if (unhealthyServices.length > 0) {
        throw new Error(`Pre-validation failed: unhealthy services - ${unhealthyServices.join(', ')}`);
      }
    }
    
    // Check if another experiment is running
    const runningExperiments = await this.getRunningExperiments();
    if (runningExperiments.length > 0) {
      throw new Error(`Another experiment is running: ${runningExperiments.join(', ')}`);
    }
    
    logger.info('Pre-experiment validation passed');
  }

  /**
   * Post-experiment validation
   */
  async postValidation() {
    logger.info(`Running post-experiment validation for ${this.name}...`);
    
    // Wait for system to stabilize
    await this.sleep(10000);
    
    // Verify all services recovered
    if (this.config.requiredServices.length > 0) {
      const healthChecks = await Promise.allSettled(
        this.config.requiredServices.map(service => this.checkServiceHealth(service))
      );
      
      const unhealthyServices = healthChecks
        .filter(result => result.status === 'rejected')
        .map((result, index) => this.config.requiredServices[index]);
      
      if (unhealthyServices.length > 0) {
        logger.warn(`Post-validation warning: services still unhealthy - ${unhealthyServices.join(', ')}`);
        // Don't fail the experiment, but log the warning
      }
    }
    
    logger.info('Post-experiment validation completed');
  }

  /**
   * Rollback experiment changes
   */
  async rollback() {
    logger.warn(`Rolling back experiment: ${this.name}`);
    
    try {
      // Override in specific experiments
      await this.performRollback();
      
      // Wait for rollback to take effect
      const rollbackTimeout = this.parseTimeout(this.config.rollbackTimeout);
      await this.sleep(rollbackTimeout);
      
      logger.info(`Rollback completed for experiment: ${this.name}`);
      
    } catch (error) {
      logger.error(`Rollback failed for experiment ${this.name}:`, error);
      throw error;
    }
  }

  /**
   * Save experiment results to file system
   */
  async saveResults() {
    const resultFile = path.join(
      this.resultsDir,
      `${this.name}-${Date.now()}.json`
    );
    
    const experimentData = {
      name: this.name,
      config: this.config,
      startTime: this.startTime,
      endTime: this.endTime,
      duration: this.getDuration(),
      status: this.status,
      results: this.results,
      metadata: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        environment: process.env.NODE_ENV
      }
    };
    
    await fs.writeJson(resultFile, experimentData, { spaces: 2 });
    
    logger.info(`Experiment results saved to ${resultFile}`);
  }

  /**
   * Get experiment duration in milliseconds
   */
  getDuration() {
    if (!this.startTime || !this.endTime) {
      return 0;
    }
    return new Date(this.endTime).getTime() - new Date(this.startTime).getTime();
  }

  /**
   * Get summary of experiment results
   */
  getResultSummary() {
    if (!this.results) {
      return 'No results available';
    }
    
    return {
      status: this.status,
      phasesCompleted: this.results.phases?.length || 0,
      resilienceScore: this.results.resilienceScore || 0,
      overallResult: this.results.overallResult || 'unknown'
    };
  }

  /**
   * Parse timeout string to milliseconds
   */
  parseTimeout(timeoutStr) {
    const match = timeoutStr.match(/^(\d+)([smh])$/);
    if (!match) {
      throw new Error(`Invalid timeout format: ${timeoutStr}`);
    }
    
    const value = parseInt(match[1]);
    const unit = match[2];
    
    switch (unit) {
      case 's': return value * 1000;
      case 'm': return value * 60 * 1000;
      case 'h': return value * 60 * 60 * 1000;
      default: throw new Error(`Unknown timeout unit: ${unit}`);
    }
  }

  /**
   * Utility sleep function
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // =====================================
  // ABSTRACT METHODS - Override in subclasses
  // =====================================

  /**
   * Setup experiment environment
   * Override in specific experiments
   */
  async setup() {
    throw new Error('setup() must be implemented by experiment subclass');
  }

  /**
   * Execute experiment phases
   * Override in specific experiments
   */
  async execute() {
    throw new Error('execute() must be implemented by experiment subclass');
  }

  /**
   * Cleanup experiment
   * Override in specific experiments
   */
  async cleanup() {
    throw new Error('cleanup() must be implemented by experiment subclass');
  }

  /**
   * Perform experiment rollback
   * Override in specific experiments
   */
  async performRollback() {
    // Default implementation - call cleanup
    await this.cleanup();
  }

  /**
   * Check health of a specific service
   * Override to implement service-specific health checks
   */
  async checkServiceHealth(service) {
    throw new Error('checkServiceHealth() must be implemented by experiment subclass');
  }

  /**
   * Get current system metrics
   * Override to implement metrics collection
   */
  async getCurrentMetrics() {
    throw new Error('getCurrentMetrics() must be implemented by experiment subclass');
  }

  /**
   * Monitor system health during experiment
   * Override to implement monitoring logic
   */
  async monitorSystemHealth() {
    // Default implementation - log current status
    logger.debug(`Monitoring experiment: ${this.name}, status: ${this.status}`);
  }

  /**
   * Get list of currently running experiments
   * Override to implement experiment discovery
   */
  async getRunningExperiments() {
    // Default implementation - return empty array
    return [];
  }
}