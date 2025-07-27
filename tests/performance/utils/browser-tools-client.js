// Browser-tools MCP Integration for Performance Testing
// Provides seamless integration with browser-tools MCP server for performance monitoring
import { spawn, exec } from 'child_process';
import { promisify } from 'util';
import axios from 'axios';
import pino from 'pino';

const execAsync = promisify(exec);
const logger = pino({ name: 'browser-tools-client' });

export class BrowserToolsClient {
  constructor() {
    this.serverUrl = 'http://localhost:3025';
    this.serverProcess = null;
    this.isMonitoring = false;
    this.performanceData = [];
  }

  /**
   * Ensure browser-tools server is running
   * Uses the centralized bt command for server management
   */
  async ensureServerRunning() {
    try {
      // Check if server is already running
      const isRunning = await this.checkServerStatus();
      if (isRunning) {
        logger.info('Browser-tools server is already running');
        return true;
      }

      logger.info('Starting browser-tools server...');
      
      // Use centralized bt start command
      const { stdout, stderr } = await execAsync('bt start');
      logger.info('Server start output:', { stdout, stderr });
      
      // Wait for server to be ready
      await this.waitForServerReady();
      
      logger.info('Browser-tools server started successfully');
      return true;
      
    } catch (error) {
      logger.error('Failed to start browser-tools server:', error);
      throw new Error(`Browser-tools server startup failed: ${error.message}`);
    }
  }

  /**
   * Check if browser-tools server is running
   */
  async checkServerStatus() {
    try {
      const { stdout } = await execAsync('bt status');
      return stdout.includes('running') || stdout.includes('active');
    } catch (error) {
      return false;
    }
  }

  /**
   * Wait for server to be ready to accept requests
   */
  async waitForServerReady(maxAttempts = 30, delayMs = 1000) {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const response = await axios.get(`${this.serverUrl}/health`, { timeout: 5000 });
        if (response.status === 200) {
          logger.info(`Server ready after ${attempt} attempts`);
          return true;
        }
      } catch (error) {
        if (attempt === maxAttempts) {
          throw new Error(`Server not ready after ${maxAttempts} attempts`);
        }
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
    return false;
  }

  /**
   * Start performance monitoring for a page
   */
  async startMonitoring(page) {
    try {
      if (this.isMonitoring) {
        logger.warn('Monitoring already in progress');
        return;
      }

      // Clear existing logs
      await this.clearLogs();
      
      // Initialize page monitoring
      await page.evaluate(() => {
        // Custom performance marks for detailed tracking
        if (window.performance) {
          window.performance.mark('monitoring-start');
        }
        
        // Setup performance observer for real-time metrics
        if (window.PerformanceObserver) {
          const observer = new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
              // Store performance entries for later collection
              if (!window.__performanceEntries) {
                window.__performanceEntries = [];
              }
              window.__performanceEntries.push({
                name: entry.name,
                entryType: entry.entryType,
                startTime: entry.startTime,
                duration: entry.duration,
                timestamp: Date.now()
              });
            }
          });
          observer.observe({ entryTypes: ['navigation', 'resource', 'measure', 'mark'] });
        }
      });

      this.isMonitoring = true;
      this.performanceData = [];
      
      logger.info('Performance monitoring started');
      
    } catch (error) {
      logger.error('Failed to start monitoring:', error);
      throw error;
    }
  }

  /**
   * Stop performance monitoring
   */
  async stopMonitoring() {
    if (!this.isMonitoring) {
      logger.warn('No monitoring in progress');
      return;
    }

    this.isMonitoring = false;
    logger.info('Performance monitoring stopped');
  }

  /**
   * Get performance metrics from browser-tools
   */
  async getPerformanceMetrics() {
    try {
      const metrics = {};

      // Get console logs for performance-related messages
      const consoleLogs = await this.getConsoleLogs();
      metrics.consoleLogs = consoleLogs.filter(log => 
        log.includes('performance') || 
        log.includes('timing') || 
        log.includes('duration')
      );

      // Get network performance data
      const networkLogs = await this.getNetworkLogs();
      metrics.networkMetrics = this.analyzeNetworkPerformance(networkLogs);

      // Run performance audit
      const performanceAudit = await this.runPerformanceAudit();
      metrics.lighthouseMetrics = performanceAudit;

      // Get current timestamp for correlation
      metrics.timestamp = new Date().toISOString();
      metrics.collectionTime = Date.now();

      this.performanceData.push(metrics);
      
      return metrics;
      
    } catch (error) {
      logger.error('Failed to collect performance metrics:', error);
      return {
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Get console logs via browser-tools MCP
   */
  async getConsoleLogs() {
    try {
      const response = await axios.get(`${this.serverUrl}/api/console/logs`);
      return response.data || [];
    } catch (error) {
      logger.warn('Failed to get console logs:', error.message);
      return [];
    }
  }

  /**
   * Get network logs via browser-tools MCP
   */
  async getNetworkLogs() {
    try {
      const response = await axios.get(`${this.serverUrl}/api/network/logs`);
      return response.data || [];
    } catch (error) {
      logger.warn('Failed to get network logs:', error.message);
      return [];
    }
  }

  /**
   * Run performance audit via browser-tools MCP
   */
  async runPerformanceAudit() {
    try {
      const response = await axios.post(`${this.serverUrl}/api/audit/performance`);
      return response.data || {};
    } catch (error) {
      logger.warn('Failed to run performance audit:', error.message);
      return {};
    }
  }

  /**
   * Clear all logs in browser-tools
   */
  async clearLogs() {
    try {
      await axios.post(`${this.serverUrl}/api/logs/clear`);
      logger.debug('Browser-tools logs cleared');
    } catch (error) {
      logger.warn('Failed to clear logs:', error.message);
    }
  }

  /**
   * Take screenshot via browser-tools
   */
  async takeScreenshot() {
    try {
      const response = await axios.post(`${this.serverUrl}/api/screenshot`);
      return response.data;
    } catch (error) {
      logger.warn('Failed to take screenshot:', error.message);
      return null;
    }
  }

  /**
   * Analyze network performance from logs
   */
  analyzeNetworkPerformance(networkLogs) {
    if (!Array.isArray(networkLogs) || networkLogs.length === 0) {
      return {
        totalRequests: 0,
        averageResponseTime: 0,
        slowestRequest: null,
        fastestRequest: null,
        errorCount: 0
      };
    }

    const requests = networkLogs.filter(log => log.responseTime !== undefined);
    
    if (requests.length === 0) {
      return {
        totalRequests: networkLogs.length,
        averageResponseTime: 0,
        slowestRequest: null,
        fastestRequest: null,
        errorCount: networkLogs.filter(log => log.status >= 400).length
      };
    }

    const responseTimes = requests.map(req => req.responseTime);
    const averageResponseTime = responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length;
    
    const sortedRequests = requests.sort((a, b) => a.responseTime - b.responseTime);
    
    return {
      totalRequests: networkLogs.length,
      averageResponseTime: Math.round(averageResponseTime),
      slowestRequest: sortedRequests[sortedRequests.length - 1],
      fastestRequest: sortedRequests[0],
      errorCount: networkLogs.filter(log => log.status >= 400).length,
      p95ResponseTime: this.calculatePercentile(responseTimes, 95),
      p99ResponseTime: this.calculatePercentile(responseTimes, 99)
    };
  }

  /**
   * Calculate percentile from array of numbers
   */
  calculatePercentile(values, percentile) {
    if (values.length === 0) return 0;
    
    const sorted = values.sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }

  /**
   * Get all collected performance data
   */
  getAllPerformanceData() {
    return this.performanceData;
  }

  /**
   * Export performance data to file
   */
  async exportPerformanceData(filepath) {
    try {
      const fs = await import('fs-extra');
      await fs.writeJson(filepath, {
        metadata: {
          exportTime: new Date().toISOString(),
          totalDataPoints: this.performanceData.length,
          testEnvironment: process.env.TEST_ENV || 'unknown'
        },
        performanceData: this.performanceData
      }, { spaces: 2 });
      
      logger.info(`Performance data exported to ${filepath}`);
      
    } catch (error) {
      logger.error('Failed to export performance data:', error);
      throw error;
    }
  }

  /**
   * Cleanup and stop server if needed
   */
  async cleanup() {
    try {
      if (this.isMonitoring) {
        await this.stopMonitoring();
      }
      
      // Optional: Stop server (usually keep running for multiple tests)
      // await execAsync('bt stop');
      
      logger.info('Browser-tools client cleanup completed');
      
    } catch (error) {
      logger.error('Cleanup failed:', error);
    }
  }
}