#!/usr/bin/env node

/**
 * Log Analysis Script for Firemní Asistent
 * Analyzes structured JSON logs for performance insights and error patterns
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

class LogAnalyzer {
  constructor() {
    this.entries = [];
    this.correlationMap = new Map();
    this.serviceStats = new Map();
    this.performanceStats = [];
    this.errorStats = [];
  }

  async analyzeLogs(source = 'docker') {
    console.log('🔍 Starting log analysis...\n');

    try {
      const logs = await this.getLogs(source);
      this.parseLogEntries(logs);
      this.analyzePerformance();
      this.analyzeErrors();
      this.analyzeCorrelations();
      this.generateReport();
    } catch (error) {
      console.error('❌ Error analyzing logs:', error.message);
      process.exit(1);
    }
  }

  async getLogs(source) {
    if (source === 'docker') {
      return this.getDockerLogs();
    } else if (source === 'file') {
      return this.getLogFile();
    }
    throw new Error('Unknown log source');
  }

  async getDockerLogs() {
    return new Promise((resolve, reject) => {
      const docker = spawn('docker-compose', [
        '-f', 'docker-compose.dev.yml',
        'logs', '--tail=1000'
      ]);

      let output = '';
      docker.stdout.on('data', (data) => {
        output += data.toString();
      });

      docker.stderr.on('data', (data) => {
        console.error('Docker logs error:', data.toString());
      });

      docker.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`Docker logs failed with code ${code}`));
        } else {
          resolve(output);
        }
      });
    });
  }

  getLogFile() {
    const logFile = process.argv[3] || './logs/app.log';
    if (!fs.existsSync(logFile)) {
      throw new Error(`Log file not found: ${logFile}`);
    }
    return fs.readFileSync(logFile, 'utf-8');
  }

  parseLogEntries(logs) {
    const lines = logs.split('\n').filter(line => line.trim());
    
    lines.forEach(line => {
      try {
        // Remove docker service prefix if present
        const cleanLine = line.replace(/^[a-zA-Z0-9_-]+\s*\|\s*/, '');
        
        // Try to parse as JSON
        const entry = JSON.parse(cleanLine);
        
        if (entry.time && entry.level !== undefined) {
          this.entries.push(entry);
          
          // Group by correlation ID
          if (entry.correlationId) {
            if (!this.correlationMap.has(entry.correlationId)) {
              this.correlationMap.set(entry.correlationId, []);
            }
            this.correlationMap.get(entry.correlationId).push(entry);
          }
          
          // Track service stats
          if (entry.service) {
            if (!this.serviceStats.has(entry.service)) {
              this.serviceStats.set(entry.service, {
                total: 0,
                errors: 0,
                warnings: 0,
                operations: []
              });
            }
            
            const stats = this.serviceStats.get(entry.service);
            stats.total++;
            
            if (entry.level >= 50) stats.errors++;
            if (entry.level >= 40 && entry.level < 50) stats.warnings++;
            if (entry.operationName) stats.operations.push(entry);
          }
        }
      } catch (e) {
        // Skip non-JSON lines
      }
    });

    console.log(`📊 Parsed ${this.entries.length} log entries`);
    console.log(`🔗 Found ${this.correlationMap.size} unique correlation IDs`);
    console.log(`🏢 Services found: ${Array.from(this.serviceStats.keys()).join(', ')}\n`);
  }

  analyzePerformance() {
    console.log('⚡ Performance Analysis:');
    console.log('━'.repeat(50));

    const operations = this.entries.filter(e => e.duration !== undefined);
    
    if (operations.length === 0) {
      console.log('No performance data found\n');
      return;
    }

    // Overall stats
    const durations = operations.map(op => op.duration);
    const avgDuration = durations.reduce((sum, d) => sum + d, 0) / durations.length;
    const p95Duration = this.percentile(durations, 0.95);
    const p99Duration = this.percentile(durations, 0.99);
    const maxDuration = Math.max(...durations);

    console.log(`📈 Operations analyzed: ${operations.length}`);
    console.log(`📊 Average duration: ${avgDuration.toFixed(2)}ms`);
    console.log(`📊 P95 duration: ${p95Duration.toFixed(2)}ms`);
    console.log(`📊 P99 duration: ${p99Duration.toFixed(2)}ms`);
    console.log(`📊 Max duration: ${maxDuration.toFixed(2)}ms\n`);

    // Slowest operations
    const slowest = operations
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 10);

    console.log('🐌 Top 10 Slowest Operations:');
    slowest.forEach((op, i) => {
      console.log(`${i + 1:2}. ${op.operationName || 'Unknown'}: ${op.duration}ms (${op.service || 'Unknown'})`);
    });

    // Operations by service
    console.log('\n📊 Performance by Service:');
    this.serviceStats.forEach((stats, service) => {
      const serviceOps = stats.operations.filter(op => op.duration);
      if (serviceOps.length > 0) {
        const serviceAvg = serviceOps.reduce((sum, op) => sum + op.duration, 0) / serviceOps.length;
        console.log(`${service}: ${serviceAvg.toFixed(2)}ms avg (${serviceOps.length} ops)`);
      }
    });
    console.log();
  }

  analyzeErrors() {
    console.log('🚨 Error Analysis:');
    console.log('━'.repeat(50));

    const errors = this.entries.filter(e => e.level >= 50);
    const warnings = this.entries.filter(e => e.level >= 40 && e.level < 50);

    console.log(`❌ Total errors: ${errors.length}`);
    console.log(`⚠️  Total warnings: ${warnings.length}`);

    if (errors.length === 0) {
      console.log('No errors found! 🎉\n');
      return;
    }

    // Error frequency by service
    const errorsByService = new Map();
    errors.forEach(error => {
      const service = error.service || 'Unknown';
      errorsByService.set(service, (errorsByService.get(service) || 0) + 1);
    });

    console.log('\n❌ Errors by Service:');
    Array.from(errorsByService.entries())
      .sort((a, b) => b[1] - a[1])
      .forEach(([service, count]) => {
        const total = this.serviceStats.get(service)?.total || count;
        const percentage = ((count / total) * 100).toFixed(2);
        console.log(`${service}: ${count} errors (${percentage}% error rate)`);
      });

    // Most common error messages
    const errorMessages = new Map();
    errors.forEach(error => {
      const msg = error.msg || error.message || 'Unknown error';
      const key = msg.substring(0, 100); // Truncate for grouping
      errorMessages.set(key, (errorMessages.get(key) || 0) + 1);
    });

    console.log('\n🔥 Most Common Errors:');
    Array.from(errorMessages.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .forEach(([msg, count]) => {
        console.log(`${count}x: ${msg}`);
      });

    console.log();
  }

  analyzeCorrelations() {
    console.log('🔗 Correlation Analysis:');
    console.log('━'.repeat(50));

    if (this.correlationMap.size === 0) {
      console.log('No correlation data found\n');
      return;
    }

    // Request flows (correlation chains)
    const requestFlows = Array.from(this.correlationMap.entries())
      .map(([correlationId, entries]) => {
        const services = [...new Set(entries.map(e => e.service).filter(Boolean))];
        const duration = this.calculateTotalDuration(entries);
        const hasErrors = entries.some(e => e.level >= 50);
        
        return {
          correlationId,
          services,
          entryCount: entries.length,
          duration,
          hasErrors,
          startTime: Math.min(...entries.map(e => new Date(e.time).getTime())),
          endTime: Math.max(...entries.map(e => new Date(e.time).getTime()))
        };
      })
      .sort((a, b) => b.duration - a.duration);

    console.log(`🔍 Analyzed ${requestFlows.length} request flows`);

    // Longest request flows
    console.log('\n⏱️  Longest Request Flows:');
    requestFlows.slice(0, 5).forEach((flow, i) => {
      const errorIndicator = flow.hasErrors ? '❌' : '✅';
      console.log(`${i + 1}. ${flow.correlationId.substring(0, 8)}... ${errorIndicator}`);
      console.log(`   Duration: ${flow.duration}ms | Services: ${flow.services.join(' → ')}`);
      console.log(`   Entries: ${flow.entryCount} | Span: ${flow.endTime - flow.startTime}ms`);
    });

    // Failed request flows
    const failedFlows = requestFlows.filter(f => f.hasErrors);
    if (failedFlows.length > 0) {
      console.log(`\n💥 Failed Request Flows (${failedFlows.length}):`);
      failedFlows.slice(0, 3).forEach(flow => {
        console.log(`• ${flow.correlationId.substring(0, 8)}... (${flow.services.join(' → ')})`);
      });
    }

    console.log();
  }

  calculateTotalDuration(entries) {
    const durations = entries
      .filter(e => e.duration !== undefined)
      .map(e => e.duration);
    
    return durations.length > 0 
      ? durations.reduce((sum, d) => sum + d, 0)
      : 0;
  }

  percentile(arr, p) {
    const sorted = [...arr].sort((a, b) => a - b);
    const index = Math.ceil(sorted.length * p) - 1;
    return sorted[index] || 0;
  }

  generateReport() {
    console.log('📋 Summary Report:');
    console.log('━'.repeat(50));

    const totalEntries = this.entries.length;
    const errorRate = (this.entries.filter(e => e.level >= 50).length / totalEntries * 100).toFixed(2);
    const servicesWithErrors = Array.from(this.serviceStats.entries())
      .filter(([, stats]) => stats.errors > 0)
      .length;

    console.log(`📊 Total log entries: ${totalEntries}`);
    console.log(`📊 Overall error rate: ${errorRate}%`);
    console.log(`📊 Services with errors: ${servicesWithErrors}/${this.serviceStats.size}`);
    console.log(`📊 Unique request flows: ${this.correlationMap.size}`);

    // Recommendations
    console.log('\n💡 Recommendations:');
    if (parseFloat(errorRate) > 5) {
      console.log('⚠️  High error rate detected - investigate error patterns');
    }
    
    const slowOperations = this.entries.filter(e => e.duration > 2000);
    if (slowOperations.length > 0) {
      console.log(`⚠️  ${slowOperations.length} operations took >2s - consider optimization`);
    }
    
    if (this.correlationMap.size === 0) {
      console.log('⚠️  No correlation IDs found - ensure proper request tracking');
    }

    console.log('\n✅ Analysis complete!');
  }
}

// Script execution
if (require.main === module) {
  const analyzer = new LogAnalyzer();
  const source = process.argv[2] || 'docker';
  
  analyzer.analyzeLogs(source).catch(error => {
    console.error('Script failed:', error.message);
    process.exit(1);
  });
}

module.exports = LogAnalyzer;