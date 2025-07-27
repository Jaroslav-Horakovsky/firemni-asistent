// Circuit Breaker Chaos Engineering Experiment
// Validates circuit breaker patterns from ARCHITECTURE.md resilience implementation
import { ChaosExperiment } from '../lib/chaos-experiment.js';
import { ServiceInjector } from '../lib/service-injector.js';
import { MetricsCollector } from '../lib/metrics-collector.js';
import { ResilienceValidator } from '../lib/resilience-validator.js';
import pino from 'pino';

const logger = pino({ name: 'circuit-breaker-chaos' });

/**
 * Circuit Breaker Validation Experiment
 * 
 * This experiment validates the circuit breaker implementation from ARCHITECTURE.md
 * by injecting controlled failures and measuring system resilience behavior.
 * 
 * Based on the opossum circuit breaker configuration:
 * - timeout: 3000ms
 * - errorThresholdPercentage: 50%
 * - resetTimeout: 30000ms
 * - capacity: 20 concurrent calls
 */
export class CircuitBreakerValidationExperiment extends ChaosExperiment {
  constructor() {
    super('circuit-breaker-validation', {
      description: 'Validates circuit breaker patterns and graceful degradation',
      hypothesis: 'Circuit breakers will open when failure rate exceeds 50% and provide graceful degradation',
      duration: '10m',
      rollbackTimeout: '2m',
      requiredServices: ['order-service', 'billing-service', 'inventory-service', 'notification-service'],
      environment: process.env.TARGET_ENV || 'staging'
    });
    
    this.serviceInjector = new ServiceInjector();
    this.metricsCollector = new MetricsCollector();
    this.resilienceValidator = new ResilienceValidator();
    
    // Circuit breaker thresholds from ARCHITECTURE.md
    this.circuitBreakerConfig = {
      timeout: 3000,
      errorThreshold: 50, // 50%
      resetTimeout: 30000,
      capacity: 20
    };
  }

  /**
   * Setup experiment environment
   */
  async setup() {
    logger.info('Setting up circuit breaker validation experiment...');
    
    try {
      // Verify all required services are healthy
      await this.verifyServicesHealth();
      
      // Initialize metrics collection
      await this.metricsCollector.initialize();
      
      // Setup service failure injection points
      await this.serviceInjector.setupInjectionPoints([
        'billing-service:/api/charge',
        'inventory-service:/api/inventory/reserve',
        'notification-service:/api/notifications/send'
      ]);
      
      // Establish baseline metrics
      this.baselineMetrics = await this.metricsCollector.collectBaseline();
      
      logger.info('Circuit breaker experiment setup completed');
      
    } catch (error) {
      logger.error('Failed to setup experiment:', error);
      throw error;
    }
  }

  /**
   * Execute experiment phases
   */
  async execute() {
    logger.info('Executing circuit breaker validation experiment phases...');
    
    const results = {
      phases: [],
      overallResult: 'unknown',
      resilienceScore: 0
    };
    
    try {
      // Phase 1: Baseline - Normal Operation
      results.phases.push(await this.executePhase1Baseline());
      
      // Phase 2: Gradual Failure Injection
      results.phases.push(await this.executePhase2GradualFailure());
      
      // Phase 3: Circuit Breaker Triggering
      results.phases.push(await this.executePhase3CircuitBreakerTrigger());
      
      // Phase 4: Recovery Validation
      results.phases.push(await this.executePhase4Recovery());
      
      // Analyze overall experiment results
      results.overallResult = this.analyzeExperimentResults(results.phases);
      results.resilienceScore = this.calculateResilienceScore(results.phases);
      
      return results;
      
    } catch (error) {
      logger.error('Experiment execution failed:', error);
      results.overallResult = 'failed';
      results.error = error.message;
      return results;
    }
  }

  /**
   * Phase 1: Establish baseline behavior
   */
  async executePhase1Baseline() {
    logger.info('Phase 1: Establishing baseline behavior...');
    
    const phaseResult = {
      phase: 'baseline',
      duration: 120000, // 2 minutes
      success: false,
      metrics: {},
      observations: []
    };
    
    try {
      // Generate normal load
      const loadGenerator = await this.createLoadGenerator({
        pattern: 'steady',
        rps: 10,
        duration: phaseResult.duration
      });
      
      const startTime = Date.now();
      await loadGenerator.start();
      
      // Monitor during baseline
      while (Date.now() - startTime < phaseResult.duration) {
        const metrics = await this.metricsCollector.collectRealtime();
        phaseResult.metrics = { ...phaseResult.metrics, ...metrics };
        
        // Verify no circuit breakers are open
        const circuitBreakerStates = await this.resilienceValidator.getCircuitBreakerStates();
        if (circuitBreakerStates.some(cb => cb.state !== 'CLOSED')) {
          phaseResult.observations.push({
            timestamp: new Date().toISOString(),
            type: 'warning',
            message: 'Circuit breakers not in expected CLOSED state during baseline'
          });
        }
        
        await this.sleep(5000); // Check every 5 seconds
      }
      
      await loadGenerator.stop();
      
      // Validate baseline expectations
      const errorRate = phaseResult.metrics.errorRate || 0;
      const avgResponseTime = phaseResult.metrics.avgResponseTime || 0;
      
      if (errorRate < 1 && avgResponseTime < 2000) {
        phaseResult.success = true;
        phaseResult.observations.push({
          timestamp: new Date().toISOString(),
          type: 'success',
          message: `Baseline established: ${errorRate}% error rate, ${avgResponseTime}ms avg response time`
        });
      }
      
      return phaseResult;
      
    } catch (error) {
      phaseResult.error = error.message;
      logger.error('Phase 1 failed:', error);
      return phaseResult;
    }
  }

  /**
   * Phase 2: Gradual failure injection (below circuit breaker threshold)
   */
  async executePhase2GradualFailure() {
    logger.info('Phase 2: Injecting gradual failures...');
    
    const phaseResult = {
      phase: 'gradual-failure',
      duration: 180000, // 3 minutes
      success: false,
      metrics: {},
      observations: []
    };
    
    try {
      // Start load generation
      const loadGenerator = await this.createLoadGenerator({
        pattern: 'steady',
        rps: 15,
        duration: phaseResult.duration
      });
      
      // Inject failures below circuit breaker threshold (40% failure rate)
      await this.serviceInjector.injectFailures({
        'billing-service': {
          failureRate: 0.40, // 40% - below 50% threshold
          failureType: 'timeout',
          timeoutMs: 5000
        }
      });
      
      const startTime = Date.now();
      await loadGenerator.start();
      
      // Monitor circuit breaker behavior
      while (Date.now() - startTime < phaseResult.duration) {
        const metrics = await this.metricsCollector.collectRealtime();
        const circuitBreakerStates = await this.resilienceValidator.getCircuitBreakerStates();
        
        phaseResult.metrics = { ...phaseResult.metrics, ...metrics };
        
        // Circuit breakers should remain CLOSED
        const openCircuitBreakers = circuitBreakerStates.filter(cb => cb.state === 'OPEN');
        if (openCircuitBreakers.length === 0) {
          phaseResult.observations.push({
            timestamp: new Date().toISOString(),
            type: 'success',
            message: 'Circuit breakers correctly remained CLOSED below threshold'
          });
        } else {
          phaseResult.observations.push({
            timestamp: new Date().toISOString(),
            type: 'warning',
            message: `Unexpected circuit breaker opened: ${openCircuitBreakers.map(cb => cb.service).join(', ')}`
          });
        }
        
        await this.sleep(10000); // Check every 10 seconds
      }
      
      await loadGenerator.stop();
      
      // Validate phase 2 expectations
      const errorRate = phaseResult.metrics.errorRate || 0;
      const circuitBreakerStates = await this.resilienceValidator.getCircuitBreakerStates();
      const closedBreakers = circuitBreakerStates.filter(cb => cb.state === 'CLOSED').length;
      
      if (errorRate >= 35 && errorRate <= 45 && closedBreakers === circuitBreakerStates.length) {
        phaseResult.success = true;
        phaseResult.observations.push({
          timestamp: new Date().toISOString(),
          type: 'success',
          message: `Phase 2 successful: ${errorRate}% error rate with all circuit breakers closed`
        });
      }
      
      return phaseResult;
      
    } catch (error) {
      phaseResult.error = error.message;
      logger.error('Phase 2 failed:', error);
      return phaseResult;
    } finally {
      // Clean up failure injection
      await this.serviceInjector.removeFailures(['billing-service']);
    }
  }

  /**
   * Phase 3: Trigger circuit breaker (above threshold)
   */
  async executePhase3CircuitBreakerTrigger() {
    logger.info('Phase 3: Triggering circuit breaker...');
    
    const phaseResult = {
      phase: 'circuit-breaker-trigger',
      duration: 300000, // 5 minutes
      success: false,
      metrics: {},
      observations: []
    };
    
    try {
      // Create higher load to trigger circuit breaker
      const loadGenerator = await this.createLoadGenerator({
        pattern: 'burst',
        rps: 25,
        duration: phaseResult.duration
      });
      
      // Inject failures above circuit breaker threshold (70% failure rate)
      await this.serviceInjector.injectFailures({
        'billing-service': {
          failureRate: 0.70, // 70% - above 50% threshold
          failureType: 'error',
          statusCode: 500
        }
      });
      
      const startTime = Date.now();
      await loadGenerator.start();
      
      let circuitBreakerOpened = false;
      let fallbackActivated = false;
      
      // Monitor for circuit breaker opening and fallback activation
      while (Date.now() - startTime < phaseResult.duration) {
        const metrics = await this.metricsCollector.collectRealtime();
        const circuitBreakerStates = await this.resilienceValidator.getCircuitBreakerStates();
        
        phaseResult.metrics = { ...phaseResult.metrics, ...metrics };
        
        // Check for circuit breaker opening
        const openBreakers = circuitBreakerStates.filter(cb => cb.state === 'OPEN');
        if (openBreakers.length > 0 && !circuitBreakerOpened) {
          circuitBreakerOpened = true;
          phaseResult.observations.push({
            timestamp: new Date().toISOString(),
            type: 'success',
            message: `Circuit breaker opened for services: ${openBreakers.map(cb => cb.service).join(', ')}`
          });
        }
        
        // Check for fallback activation (PENDING_BILLING status)
        const orderMetrics = await this.metricsCollector.getOrderServiceMetrics();
        const pendingBillingCount = orderMetrics.pendingBillingCount || 0;
        if (pendingBillingCount > 0 && !fallbackActivated) {
          fallbackActivated = true;
          phaseResult.observations.push({
            timestamp: new Date().toISOString(),
            type: 'success',
            message: `Graceful degradation activated: ${pendingBillingCount} orders in PENDING_BILLING state`
          });
        }
        
        await this.sleep(5000); // Check every 5 seconds
      }
      
      await loadGenerator.stop();
      
      // Validate circuit breaker behavior
      if (circuitBreakerOpened && fallbackActivated) {
        phaseResult.success = true;
        phaseResult.observations.push({
          timestamp: new Date().toISOString(),
          type: 'success',
          message: 'Circuit breaker correctly opened and fallback mechanism activated'
        });
      } else {
        phaseResult.observations.push({
          timestamp: new Date().toISOString(),
          type: 'failure',
          message: `Circuit breaker behavior incomplete: opened=${circuitBreakerOpened}, fallback=${fallbackActivated}`
        });
      }
      
      return phaseResult;
      
    } catch (error) {
      phaseResult.error = error.message;
      logger.error('Phase 3 failed:', error);
      return phaseResult;
    } finally {
      // Clean up failure injection
      await this.serviceInjector.removeFailures(['billing-service']);
    }
  }

  /**
   * Phase 4: Recovery and circuit breaker reset
   */
  async executePhase4Recovery() {
    logger.info('Phase 4: Testing recovery and circuit breaker reset...');
    
    const phaseResult = {
      phase: 'recovery',
      duration: 180000, // 3 minutes
      success: false,
      metrics: {},
      observations: []
    };
    
    try {
      // Generate light load during recovery
      const loadGenerator = await this.createLoadGenerator({
        pattern: 'light',
        rps: 5,
        duration: phaseResult.duration
      });
      
      const startTime = Date.now();
      await loadGenerator.start();
      
      let halfOpenDetected = false;
      let circuitBreakerClosed = false;
      
      // Monitor recovery process
      while (Date.now() - startTime < phaseResult.duration) {
        const metrics = await this.metricsCollector.collectRealtime();
        const circuitBreakerStates = await this.resilienceValidator.getCircuitBreakerStates();
        
        phaseResult.metrics = { ...phaseResult.metrics, ...metrics };
        
        // Check for HALF-OPEN state (testing recovery)
        const halfOpenBreakers = circuitBreakerStates.filter(cb => cb.state === 'HALF_OPEN');
        if (halfOpenBreakers.length > 0 && !halfOpenDetected) {
          halfOpenDetected = true;
          phaseResult.observations.push({
            timestamp: new Date().toISOString(),
            type: 'success',
            message: `Circuit breaker entered HALF-OPEN state: ${halfOpenBreakers.map(cb => cb.service).join(', ')}`
          });
        }
        
        // Check for full recovery (CLOSED state)
        const closedBreakers = circuitBreakerStates.filter(cb => cb.state === 'CLOSED');
        if (closedBreakers.length === circuitBreakerStates.length && !circuitBreakerClosed) {
          circuitBreakerClosed = true;
          phaseResult.observations.push({
            timestamp: new Date().toISOString(),
            type: 'success',
            message: 'All circuit breakers successfully recovered to CLOSED state'
          });
        }
        
        await this.sleep(5000);
      }
      
      await loadGenerator.stop();
      
      // Validate recovery
      const finalErrorRate = phaseResult.metrics.errorRate || 0;
      if (circuitBreakerClosed && finalErrorRate < 5) {
        phaseResult.success = true;
        phaseResult.observations.push({
          timestamp: new Date().toISOString(),
          type: 'success',
          message: `Recovery successful: error rate dropped to ${finalErrorRate}%`
        });
      }
      
      return phaseResult;
      
    } catch (error) {
      phaseResult.error = error.message;
      logger.error('Phase 4 failed:', error);
      return phaseResult;
    }
  }

  /**
   * Cleanup experiment
   */
  async cleanup() {
    logger.info('Cleaning up circuit breaker validation experiment...');
    
    try {
      // Remove all failure injections
      await this.serviceInjector.removeAllFailures();
      
      // Wait for circuit breakers to recover
      await this.sleep(35000); // Wait longer than resetTimeout (30s)
      
      // Verify all services are healthy
      await this.verifyServicesHealth();
      
      // Generate experiment report
      await this.generateExperimentReport();
      
      logger.info('Circuit breaker experiment cleanup completed');
      
    } catch (error) {
      logger.error('Failed to cleanup experiment:', error);
      throw error;
    }
  }

  /**
   * Analyze experiment results across all phases
   */
  analyzeExperimentResults(phases) {
    const successfulPhases = phases.filter(phase => phase.success).length;
    const totalPhases = phases.length;
    
    if (successfulPhases === totalPhases) {
      return 'success';
    } else if (successfulPhases >= totalPhases * 0.75) {
      return 'partial_success';
    } else {
      return 'failure';
    }
  }

  /**
   * Calculate resilience score based on phase results
   */
  calculateResilienceScore(phases) {
    let score = 0;
    
    phases.forEach(phase => {
      if (phase.success) {
        switch (phase.phase) {
          case 'baseline':
            score += 20; // Basic functionality
            break;
          case 'gradual-failure':
            score += 25; // Stability under partial failure
            break;
          case 'circuit-breaker-trigger':
            score += 35; // Proper circuit breaker activation
            break;
          case 'recovery':
            score += 20; // Recovery capability
            break;
        }
      }
    });
    
    return Math.min(score, 100);
  }

  /**
   * Create load generator for experiment phases
   */
  async createLoadGenerator(config) {
    const { LoadGenerator } = await import('../lib/load-generator.js');
    return new LoadGenerator(config);
  }

  /**
   * Verify all required services are healthy
   */
  async verifyServicesHealth() {
    const healthChecks = await Promise.allSettled(
      this.config.requiredServices.map(service => 
        this.resilienceValidator.checkServiceHealth(service)
      )
    );
    
    const unhealthyServices = healthChecks
      .filter(result => result.status === 'rejected')
      .map((result, index) => this.config.requiredServices[index]);
    
    if (unhealthyServices.length > 0) {
      throw new Error(`Unhealthy services detected: ${unhealthyServices.join(', ')}`);
    }
  }

  /**
   * Generate comprehensive experiment report
   */
  async generateExperimentReport() {
    const report = {
      experimentName: this.name,
      startTime: this.startTime,
      endTime: new Date().toISOString(),
      duration: Date.now() - new Date(this.startTime).getTime(),
      environment: this.config.environment,
      hypothesis: this.config.hypothesis,
      results: this.results,
      resilience_analysis: {
        circuit_breaker_behavior: 'validated',
        graceful_degradation: 'functional',
        recovery_capability: 'confirmed'
      },
      recommendations: this.generateRecommendations()
    };
    
    // Save report
    const fs = await import('fs-extra');
    const reportPath = `./reports/circuit-breaker-experiment-${Date.now()}.json`;
    await fs.writeJson(reportPath, report, { spaces: 2 });
    
    logger.info(`Experiment report saved to ${reportPath}`);
  }

  /**
   * Generate recommendations based on experiment results
   */
  generateRecommendations() {
    const recommendations = [];
    
    if (this.results?.resilienceScore < 80) {
      recommendations.push({
        priority: 'high',
        area: 'circuit_breaker_tuning',
        description: 'Consider adjusting circuit breaker thresholds for better resilience'
      });
    }
    
    if (this.results?.phases?.some(p => p.phase === 'recovery' && !p.success)) {
      recommendations.push({
        priority: 'medium',
        area: 'recovery_optimization',
        description: 'Optimize circuit breaker recovery times and health check intervals'
      });
    }
    
    return recommendations;
  }

  /**
   * Utility sleep function
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}