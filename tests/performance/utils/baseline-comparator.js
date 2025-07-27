// Performance Baseline Comparator
// Handles creation, storage, and comparison of performance baselines for regression detection
import fs from 'fs-extra';
import path from 'path';
import pino from 'pino';
import _ from 'lodash';

const logger = pino({ name: 'baseline-comparator' });

export class BaselineComparator {
  constructor() {
    this.baselineDir = path.join(process.cwd(), 'baselines');
    this.environment = process.env.TEST_ENV || 'staging';
    this.regressionThreshold = parseFloat(process.env.PERFORMANCE_THRESHOLD || '15'); // 15% by default
    
    // Ensure baseline directory exists
    fs.ensureDirSync(this.baselineDir);
  }

  /**
   * Create or update performance baseline
   */
  async createBaseline(testName, metrics) {
    try {
      const baselineFile = this.getBaselineFilePath(testName);
      
      const baseline = {
        testName,
        environment: this.environment,
        createdAt: new Date().toISOString(),
        createdBy: process.env.GITHUB_ACTOR || 'local',
        commit: process.env.GITHUB_SHA || 'unknown',
        metrics: this.processMetricsForBaseline(metrics),
        metadata: {
          nodeVersion: process.version,
          playwrightVersion: this.getPlaywrightVersion(),
          testEnvironment: this.environment
        }
      };
      
      // Backup existing baseline if it exists  
      if (await fs.pathExists(baselineFile)) {
        const backupFile = `${baselineFile}.backup.${Date.now()}`;
        await fs.copy(baselineFile, backupFile);
        logger.info(`Existing baseline backed up to ${backupFile}`);
      }
      
      await fs.writeJson(baselineFile, baseline, { spaces: 2 });
      
      logger.info(`Performance baseline created for ${testName}`, {
        file: baselineFile,
        environment: this.environment,
        metricsCount: Object.keys(baseline.metrics).length
      });
      
      return baseline;
      
    } catch (error) {
      logger.error(`Failed to create baseline for ${testName}:`, error);
      throw error;
    }
  }

  /**
   * Compare current metrics against baseline
   */
  async compareAndReport(testName, currentMetrics) {
    try {
      const baselineFile = this.getBaselineFilePath(testName);
      
      // Check if baseline exists
      if (!await fs.pathExists(baselineFile)) {
        logger.warn(`No baseline found for ${testName}, creating new baseline`);
        return await this.createBaseline(testName, currentMetrics);
      }
      
      const baseline = await fs.readJson(baselineFile);
      const comparison = await this.performComparison(baseline.metrics, currentMetrics);
      
      // Generate comparison report
      const report = {
        testName,
        environment: this.environment,
        comparedAt: new Date().toISOString(),
        commit: process.env.GITHUB_SHA || 'unknown',
        baseline: {
          createdAt: baseline.createdAt,
          commit: baseline.commit
        },
        comparison,
        regressions: comparison.regressions,
        improvements: comparison.improvements,
        status: comparison.regressions.length > 0 ? 'REGRESSION_DETECTED' : 'PASS'
      };
      
      // Save comparison report
      await this.saveComparisonReport(testName, report);
      
      // Log results
      if (report.regressions.length > 0) {
        logger.error(`Performance regression detected in ${testName}:`, {
          regressionsCount: report.regressions.length,
          regressions: report.regressions.map(r => `${r.metric}: ${r.change}`)
        });
      } else {
        logger.info(`Performance comparison passed for ${testName}`, {
          improvementsCount: report.improvements.length
        });
      }
      
      return report;
      
    } catch (error) {
      logger.error(`Failed to compare performance for ${testName}:`, error);
      throw error;
    }
  }

  /**
   * Perform detailed comparison between baseline and current metrics
   */
  async performComparison(baselineMetrics, currentMetrics) {
    const comparison = {
      regressions: [],
      improvements: [],
      stable: [],
      missing: [],
      new: []
    };
    
    // Get all metric keys from both datasets
    const baselineKeys = Object.keys(baselineMetrics);
    const currentKeys = Object.keys(currentMetrics);
    const allKeys = _.union(baselineKeys, currentKeys);
    
    for (const key of allKeys) {
      const baselineValue = baselineMetrics[key];
      const currentValue = currentMetrics[key];
      
      // Handle missing metrics
      if (baselineValue !== undefined && currentValue === undefined) {
        comparison.missing.push({ metric: key, baselineValue });
        continue;
      }
      
      if (baselineValue === undefined && currentValue !== undefined) {
        comparison.new.push({ metric: key, currentValue });
        continue;
      }
      
      // Compare numerical metrics
      if (typeof baselineValue === 'number' && typeof currentValue === 'number') {
        const percentChange = ((currentValue - baselineValue) / baselineValue) * 100;
        const absoluteChange = currentValue - baselineValue;
        
        const metricComparison = {
          metric: key,
          baselineValue,
          currentValue,
          absoluteChange,
          percentChange: Math.round(percentChange * 100) / 100
        };
        
        // Determine if this is a regression, improvement, or stable
        if (this.isRegression(key, percentChange)) {
          comparison.regressions.push({
            ...metricComparison,
            severity: this.getRegressionSeverity(percentChange),
            threshold: this.regressionThreshold
          });
        } else if (this.isImprovement(key, percentChange)) {
          comparison.improvements.push(metricComparison);
        } else {
          comparison.stable.push(metricComparison);
        }
      }
      // Handle object/nested metrics
      else if (typeof baselineValue === 'object' && typeof currentValue === 'object') {
        const nestedComparison = await this.performComparison(baselineValue, currentValue);
        
        // Merge nested results with prefixed metric names
        nestedComparison.regressions.forEach(r => {
          comparison.regressions.push({
            ...r,
            metric: `${key}.${r.metric}`
          });
        });
        nestedComparison.improvements.forEach(i => {
          comparison.improvements.push({
            ...i,
            metric: `${key}.${i.metric}`
          });
        });
      }
    }
    
    return comparison;
  }

  /**
   * Determine if a metric change represents a regression
   */
  isRegression(metricName, percentChange) {
    // Define metrics where higher values are worse (regressions)
    const higherIsBad = [
      'responseTime', 'loadTime', 'duration', 'memory', 'cpu',
      'lcp', 'fid', 'cls', 'ttfb', 'fcp', 'tti',
      'networkLatency', 'databaseTime', 'errorCount'
    ];
    
    // Define metrics where lower values are worse (regressions)
    const lowerIsBad = [
      'throughput', 'requestsPerSecond', 'availability',
      'successRate', 'cacheHitRate'
    ];
    
    const metricLower = metricName.toLowerCase();
    
    if (higherIsBad.some(bad => metricLower.includes(bad))) {
      return percentChange > this.regressionThreshold;
    } else if (lowerIsBad.some(bad => metricLower.includes(bad))) {
      return percentChange < -this.regressionThreshold;
    }
    
    // Default: higher is considered regression
    return Math.abs(percentChange) > this.regressionThreshold;
  }

  /**
   * Determine if a metric change represents an improvement
   */
  isImprovement(metricName, percentChange) {
    const higherIsBad = [
      'responseTime', 'loadTime', 'duration', 'memory', 'cpu',
      'lcp', 'fid', 'cls', 'ttfb', 'fcp', 'tti',
      'networkLatency', 'databaseTime', 'errorCount'
    ];
    
    const lowerIsBad = [
      'throughput', 'requestsPerSecond', 'availability',
      'successRate', 'cacheHitRate'
    ];
    
    const metricLower = metricName.toLowerCase();
    
    if (higherIsBad.some(bad => metricLower.includes(bad))) {
      return percentChange < -5; // 5% improvement threshold
    } else if (lowerIsBad.some(bad => metricLower.includes(bad))) {
      return percentChange > 5;
    }
    
    return false;
  }

  /**
   * Get regression severity level
   */
  getRegressionSeverity(percentChange) {
    const absChange = Math.abs(percentChange);
    
    if (absChange > 50) return 'critical';
    if (absChange > 30) return 'high';
    if (absChange > 15) return 'medium';
    return 'low';
  }

  /**
   * Process metrics to ensure they're suitable for baseline storage
   */
  processMetricsForBaseline(metrics) {
    const processed = {};
    
    // Recursively process metrics, keeping only numeric and essential values
    const processValue = (value, key) => {
      if (typeof value === 'number') {
        return Math.round(value * 100) / 100; // Round to 2 decimal places
      } else if (typeof value === 'object' && value !== null) {
        const processedObj = {};
        for (const [subKey, subValue] of Object.entries(value)) {
          const processedSubValue = processValue(subValue, subKey);
          if (processedSubValue !== undefined) {
            processedObj[subKey] = processedSubValue;
          }
        }
        return Object.keys(processedObj).length > 0 ? processedObj : undefined;
      } else if (typeof value === 'string' && !isNaN(parseFloat(value))) {
        return parseFloat(value);
      }
      
      return undefined;
    };
    
    for (const [key, value] of Object.entries(metrics)) {
      const processedValue = processValue(value, key);
      if (processedValue !== undefined) {
        processed[key] = processedValue;
      }
    }
    
    return processed;
  }

  /**
   * Save comparison report
   */
  async saveComparisonReport(testName, report) {
    const reportDir = path.join(process.cwd(), 'reports');
    await fs.ensureDir(reportDir);
    
    const reportFile = path.join(reportDir, `${testName}-comparison-${Date.now()}.json`);
    await fs.writeJson(reportFile, report, { spaces: 2 });
    
    // Also save latest report
    const latestReportFile = path.join(reportDir, `${testName}-latest.json`);
    await fs.writeJson(latestReportFile, report, { spaces: 2 });
    
    logger.info(`Comparison report saved to ${reportFile}`);
  }

  /**
   * Get baseline file path for a test
   */
  getBaselineFilePath(testName) {
    return path.join(this.baselineDir, `${testName}-${this.environment}.json`);
  }

  /**
   * Get Playwright version for metadata
   */
  getPlaywrightVersion() {
    try {
      const pkg = fs.readJsonSync(path.join(process.cwd(), 'package.json'));
      return pkg.dependencies['@playwright/test'] || 'unknown';
    } catch {
      return 'unknown';
    }
  }

  /**
   * Generate summary report across all test comparisons
   */
  async generateSummaryReport() {
    try {
      const reportDir = path.join(process.cwd(), 'reports');
      const reportFiles = await fs.readdir(reportDir);
      const latestReports = reportFiles.filter(file => file.endsWith('-latest.json'));
      
      const summary = {
        generatedAt: new Date().toISOString(),
        environment: this.environment,
        totalTests: latestReports.length,
        totalRegressions: 0,
        totalImprovements: 0,
        tests: []
      };
      
      for (const reportFile of latestReports) {
        const report = await fs.readJson(path.join(reportDir, reportFile));
        summary.totalRegressions += report.regressions.length;
        summary.totalImprovements += report.improvements.length;
        
        summary.tests.push({
          testName: report.testName,
          status: report.status,
          regressionsCount: report.regressions.length,
          improvementsCount: report.improvements.length,
          comparedAt: report.comparedAt
        });
      }
      
      const summaryFile = path.join(reportDir, 'performance-summary.json');
      await fs.writeJson(summaryFile, summary, { spaces: 2 });
      
      logger.info('Performance summary report generated', {
        totalTests: summary.totalTests,
        totalRegressions: summary.totalRegressions,
        totalImprovements: summary.totalImprovements
      });
      
      return summary;
      
    } catch (error) {
      logger.error('Failed to generate summary report:', error);
      throw error;
    }
  }

  /**
   * Clean up old baselines and reports
   */
  async cleanup(maxAge = 30) { // 30 days default
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - maxAge);
      
      // Clean backup baselines
      const baselineFiles = await fs.readdir(this.baselineDir);
      const backupFiles = baselineFiles.filter(file => file.includes('.backup.'));
      
      for (const backupFile of backupFiles) {
        const filePath = path.join(this.baselineDir, backupFile);
        const stats = await fs.stat(filePath);
        
        if (stats.mtime < cutoffDate) {
          await fs.remove(filePath);
          logger.info(`Removed old backup baseline: ${backupFile}`);
        }
      }
      
      // Clean old comparison reports
      const reportDir = path.join(process.cwd(), 'reports');
      if (await fs.pathExists(reportDir)) {
        const reportFiles = await fs.readdir(reportDir);
        const timestampedReports = reportFiles.filter(file => 
          file.includes('-comparison-') && !file.endsWith('-latest.json')
        );
        
        for (const reportFile of timestampedReports) {
          const filePath = path.join(reportDir, reportFile);
          const stats = await fs.stat(filePath);
          
          if (stats.mtime < cutoffDate) {
            await fs.remove(filePath);
            logger.info(`Removed old comparison report: ${reportFile}`);
          }
        }
      }
      
      logger.info(`Cleanup completed, removed files older than ${maxAge} days`);
      
    } catch (error) {
      logger.error('Cleanup failed:', error);
    }
  }
}