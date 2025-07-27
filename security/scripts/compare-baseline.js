#!/usr/bin/env node

/**
 * Security Baseline Comparison Script
 * Compares current security scan results against established baseline
 */

import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import chalk from 'chalk';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class SecurityBaselineComparator {
  constructor() {
    this.securityDir = path.resolve(__dirname, '..');
    this.resultsDir = path.join(this.securityDir, 'results');
    this.baselinesDir = path.join(this.securityDir, 'baselines');
    this.reportsDir = path.join(this.securityDir, 'reports');
    this.environment = process.env.TEST_ENV || 'dev';
    this.threshold = parseInt(process.env.PERFORMANCE_THRESHOLD) || 15;
    this.timestamp = new Date().toISOString();
  }

  async initialize() {
    console.log(chalk.blue('🔍 Security Baseline Comparator'));
    console.log(chalk.gray(`Environment: ${this.environment}`));
    console.log(chalk.gray(`Regression Threshold: ${this.threshold}%`));
    console.log(chalk.gray(`Timestamp: ${this.timestamp}`));
    console.log('');

    await fs.ensureDir(this.reportsDir);
  }

  async loadBaseline() {
    const baselinePath = path.join(this.baselinesDir, `latest-${this.environment}.json`);
    
    if (!await fs.pathExists(baselinePath)) {
      throw new Error(`No baseline found for environment '${this.environment}'. Run baseline:create first.`);
    }

    console.log(chalk.blue('📋 Loading security baseline...'));
    const baseline = await fs.readJSON(baselinePath);
    console.log(chalk.green(`✅ Loaded baseline from ${baseline.metadata.timestamp}`));
    
    return baseline;
  }

  async loadCurrentResults() {
    console.log(chalk.blue('📊 Loading current security scan results...'));
    
    const current = {
      metadata: {
        timestamp: this.timestamp,
        environment: this.environment,
        scanType: 'comparison'
      },
      summary: {
        totalVulnerabilities: 0,
        bySeverity: {
          critical: 0,
          high: 0,
          medium: 0,
          low: 0
        },
        byType: {
          sast: 0,
          dependency: 0,
          dast: 0
        },
        byScanner: {
          codeql: 0,
          semgrep: 0,
          npmAudit: 0,
          snyk: 0,
          owaspZap: 0
        }
      },
      scans: {
        sast: await this.collectCurrentSASTData(),
        dependencies: await this.collectCurrentDependencyData(),
        dast: await this.collectCurrentDASTData()
      }
    };

    this.calculateCurrentTotals(current);
    console.log(chalk.green(`✅ Current results: ${current.summary.totalVulnerabilities} total findings`));
    
    return current;
  }

  async collectCurrentSASTData() {
    const sastDir = path.join(this.resultsDir, 'sast');
    const sastData = { totalFindings: 0, files: [] };

    try {
      if (await fs.pathExists(sastDir)) {
        const files = await fs.readdir(sastDir);
        
        for (const file of files) {
          const filePath = path.join(sastDir, file);
          if ((await fs.stat(filePath)).isFile()) {
            const findings = await this.analyzeSASTFile(filePath);
            sastData.files.push({
              scanner: this.detectScannerFromFile(file),
              filename: file,
              findings
            });
            sastData.totalFindings += findings;
          }
        }
      }
    } catch (error) {
      console.warn(chalk.yellow(`⚠️  Warning: Could not collect current SAST data: ${error.message}`));
    }

    return sastData;
  }

  async collectCurrentDependencyData() {
    const depsDir = path.join(this.resultsDir, 'dependencies');
    const depsData = { totalVulnerabilities: 0, files: [] };

    try {
      if (await fs.pathExists(depsDir)) {
        const files = await fs.readdir(depsDir);
        
        for (const file of files) {
          const filePath = path.join(depsDir, file);
          if ((await fs.stat(filePath)).isFile()) {
            const vulnerabilities = await this.analyzeDependencyFile(filePath);
            depsData.files.push({
              scanner: this.detectScannerFromFile(file),
              filename: file,
              vulnerabilities
            });
            depsData.totalVulnerabilities += vulnerabilities;
          }
        }
      }
    } catch (error) {
      console.warn(chalk.yellow(`⚠️  Warning: Could not collect current dependency data: ${error.message}`));
    }

    return depsData;
  }

  async collectCurrentDASTData() {
    const dastDir = path.join(this.resultsDir, 'dast');
    const dastData = { totalAlerts: 0, files: [] };

    try {
      if (await fs.pathExists(dastDir)) {
        const files = await fs.readdir(dastDir);
        
        for (const file of files) {
          const filePath = path.join(dastDir, file);
          if ((await fs.stat(filePath)).isFile()) {
            const alerts = await this.analyzeDASTFile(filePath);
            dastData.files.push({
              scanner: this.detectScannerFromFile(file),
              filename: file,
              alerts
            });
            dastData.totalAlerts += alerts;
          }
        }
      }
    } catch (error) {
      console.warn(chalk.yellow(`⚠️  Warning: Could not collect current DAST data: ${error.message}`));
    }

    return dastData;
  }

  calculateCurrentTotals(current) {
    // Calculate totals similar to baseline creation
    current.scans.sast.files.forEach(file => {
      const scanner = file.scanner.toLowerCase().replace(/\\s+/g, '');
      if (current.summary.byScanner[scanner] !== undefined) {
        current.summary.byScanner[scanner] += file.findings || 0;
      }
      current.summary.byType.sast += file.findings || 0;
      current.summary.totalVulnerabilities += file.findings || 0;
    });

    current.scans.dependencies.files.forEach(file => {
      const scanner = file.scanner.toLowerCase().replace(/\\s+/g, '').replace('-', '');
      if (current.summary.byScanner[scanner] !== undefined) {
        current.summary.byScanner[scanner] += file.vulnerabilities || 0;
      }
      current.summary.byType.dependency += file.vulnerabilities || 0;
      current.summary.totalVulnerabilities += file.vulnerabilities || 0;
    });

    current.scans.dast.files.forEach(file => {
      current.summary.byScanner.owaspZap += file.alerts || 0;
      current.summary.byType.dast += file.alerts || 0;
      current.summary.totalVulnerabilities += file.alerts || 0;
    });
  }

  async compareResults(baseline, current) {
    console.log(chalk.blue('🔄 Comparing results against baseline...'));

    const comparison = {
      metadata: {
        timestamp: this.timestamp,
        environment: this.environment,
        baselineTimestamp: baseline.metadata.timestamp,
        currentTimestamp: current.metadata.timestamp
      },
      summary: {
        baseline: {
          totalVulnerabilities: baseline.summary.totalVulnerabilities,
          byType: { ...baseline.summary.byType },
          byScanner: { ...baseline.summary.byScanner }
        },
        current: {
          totalVulnerabilities: current.summary.totalVulnerabilities,
          byType: { ...current.summary.byType },
          byScanner: { ...current.summary.byScanner }
        },
        changes: {
          totalChange: current.summary.totalVulnerabilities - baseline.summary.totalVulnerabilities,
          newVulnerabilities: Math.max(0, current.summary.totalVulnerabilities - baseline.summary.totalVulnerabilities),
          resolvedVulnerabilities: Math.max(0, baseline.summary.totalVulnerabilities - current.summary.totalVulnerabilities),
          percentageChange: this.calculatePercentageChange(
            baseline.summary.totalVulnerabilities,
            current.summary.totalVulnerabilities
          )
        }
      },
      detailed: {
        byType: this.compareByType(baseline, current),
        byScanner: this.compareByScanner(baseline, current)
      },
      status: 'UNKNOWN',
      regressions: [],
      improvements: []
    };

    // Determine overall status
    this.determineStatus(comparison);
    
    // Identify regressions and improvements
    this.identifyChanges(comparison);

    return comparison;
  }

  calculatePercentageChange(baseline, current) {
    if (baseline === 0) {
      return current > 0 ? 100 : 0;
    }
    return ((current - baseline) / baseline) * 100;
  }

  compareByType(baseline, current) {
    const comparison = {};
    
    ['sast', 'dependency', 'dast'].forEach(type => {
      const baselineValue = baseline.summary.byType[type] || 0;
      const currentValue = current.summary.byType[type] || 0;
      
      comparison[type] = {
        baseline: baselineValue,
        current: currentValue,
        change: currentValue - baselineValue,
        percentageChange: this.calculatePercentageChange(baselineValue, currentValue)
      };
    });
    
    return comparison;
  }

  compareByScanner(baseline, current) {
    const comparison = {};
    const scanners = new Set([
      ...Object.keys(baseline.summary.byScanner),
      ...Object.keys(current.summary.byScanner)
    ]);
    
    scanners.forEach(scanner => {
      const baselineValue = baseline.summary.byScanner[scanner] || 0;
      const currentValue = current.summary.byScanner[scanner] || 0;
      
      comparison[scanner] = {
        baseline: baselineValue,
        current: currentValue,
        change: currentValue - baselineValue,
        percentageChange: this.calculatePercentageChange(baselineValue, currentValue)
      };
    });
    
    return comparison;
  }

  determineStatus(comparison) {
    const totalChange = comparison.summary.changes.totalChange;
    const percentageChange = comparison.summary.changes.percentageChange;
    
    if (totalChange > 0 && percentageChange > this.threshold) {
      comparison.status = 'REGRESSION';
    } else if (totalChange > 0) {
      comparison.status = 'MINOR_INCREASE';
    } else if (totalChange < 0) {
      comparison.status = 'IMPROVEMENT';
    } else {
      comparison.status = 'NO_CHANGE';
    }
  }

  identifyChanges(comparison) {
    // Check for regressions by type
    Object.entries(comparison.detailed.byType).forEach(([type, data]) => {
      if (data.change > 0 && data.percentageChange > this.threshold) {
        comparison.regressions.push({
          category: 'type',
          name: type,
          change: data.change,
          percentageChange: data.percentageChange,
          severity: data.percentageChange > 50 ? 'high' : 'medium'
        });
      } else if (data.change < 0) {
        comparison.improvements.push({
          category: 'type',
          name: type,
          change: Math.abs(data.change),
          percentageChange: Math.abs(data.percentageChange)
        });
      }
    });

    // Check for regressions by scanner
    Object.entries(comparison.detailed.byScanner).forEach(([scanner, data]) => {
      if (data.change > 0 && data.percentageChange > this.threshold) {
        comparison.regressions.push({
          category: 'scanner',
          name: scanner,
          change: data.change,
          percentageChange: data.percentageChange,
          severity: data.percentageChange > 50 ? 'high' : 'medium'
        });
      } else if (data.change < 0) {
        comparison.improvements.push({
          category: 'scanner',
          name: scanner,
          change: Math.abs(data.change),
          percentageChange: Math.abs(data.percentageChange)
        });
      }
    });
  }

  async saveComparison(comparison) {
    const comparisonPath = path.join(this.reportsDir, 'baseline-comparison.json');
    await fs.writeFile(comparisonPath, JSON.stringify(comparison, null, 2));
    console.log(chalk.green(`✅ Comparison saved: ${comparisonPath}`));
    return comparisonPath;
  }

  async generateComparisonReport(comparison) {
    console.log('');
    console.log(chalk.blue('📊 Security Baseline Comparison Report'));
    console.log(chalk.gray('=' .repeat(50)));
    console.log(`Environment: ${chalk.cyan(comparison.metadata.environment)}`);
    console.log(`Status: ${this.getStatusColor(comparison.status)}`);
    console.log('');
    
    console.log(chalk.blue('Summary:'));
    console.log(`  Baseline: ${chalk.cyan(comparison.summary.baseline.totalVulnerabilities)} vulnerabilities`);
    console.log(`  Current:  ${chalk.cyan(comparison.summary.current.totalVulnerabilities)} vulnerabilities`);
    console.log(`  Change:   ${this.getChangeColor(comparison.summary.changes.totalChange)}`);
    console.log(`  Percentage: ${this.getPercentageColor(comparison.summary.changes.percentageChange)}`);
    console.log('');

    if (comparison.regressions.length > 0) {
      console.log(chalk.red('🔺 Security Regressions:'));
      comparison.regressions.forEach(regression => {
        console.log(`  ${regression.category}/${regression.name}: +${regression.change} (${regression.percentageChange.toFixed(1)}%)`);
      });
      console.log('');
    }

    if (comparison.improvements.length > 0) {
      console.log(chalk.green('🔽 Security Improvements:'));
      comparison.improvements.forEach(improvement => {
        console.log(`  ${improvement.category}/${improvement.name}: -${improvement.change} (${improvement.percentageChange.toFixed(1)}%)`);
      });
      console.log('');
    }

    // Generate status message
    switch (comparison.status) {
      case 'REGRESSION':
        console.log(chalk.red('❌ Security regression detected! Review and fix before deployment.'));
        break;
      case 'MINOR_INCREASE':
        console.log(chalk.yellow('⚠️  Minor security increase detected. Review recommended.'));
        break;
      case 'IMPROVEMENT':
        console.log(chalk.green('✅ Security posture improved!'));
        break;
      case 'NO_CHANGE':
        console.log(chalk.blue('ℹ️  No security changes detected.'));
        break;
    }

    return comparison.status === 'REGRESSION';
  }

  getStatusColor(status) {
    switch (status) {
      case 'REGRESSION': return chalk.red(status);
      case 'MINOR_INCREASE': return chalk.yellow(status);
      case 'IMPROVEMENT': return chalk.green(status);
      case 'NO_CHANGE': return chalk.blue(status);
      default: return chalk.gray(status);
    }
  }

  getChangeColor(change) {
    if (change > 0) return chalk.red(`+${change}`);
    if (change < 0) return chalk.green(`${change}`);
    return chalk.blue('0');
  }

  getPercentageColor(percentage) {
    const formatted = `${percentage >= 0 ? '+' : ''}${percentage.toFixed(1)}%`;
    if (percentage > this.threshold) return chalk.red(formatted);
    if (percentage > 0) return chalk.yellow(formatted);
    if (percentage < 0) return chalk.green(formatted);
    return chalk.blue(formatted);
  }

  // Helper methods (reused from baseline creation)
  detectScannerFromFile(filename) {
    if (filename.includes('codeql')) return 'CodeQL';
    if (filename.includes('semgrep')) return 'Semgrep';
    if (filename.includes('npm-audit')) return 'NPM Audit';
    if (filename.includes('snyk')) return 'Snyk';
    if (filename.includes('zap')) return 'OWASP ZAP';
    return 'Unknown';
  }

  async analyzeSASTFile(filePath) {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      
      if (filePath.endsWith('.sarif')) {
        const sarif = JSON.parse(content);
        return this.countSARIFFindings(sarif);
      } else if (filePath.endsWith('.json')) {
        const data = JSON.parse(content);
        return this.countJSONFindings(data);
      }
    } catch (error) {
      console.warn(chalk.yellow(`⚠️  Could not analyze SAST file ${filePath}: ${error.message}`));
    }
    
    return 0;
  }

  async analyzeDependencyFile(filePath) {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      const data = JSON.parse(content);
      
      if (filePath.includes('npm-audit')) {
        return this.countNPMAuditVulns(data);
      } else if (filePath.includes('snyk')) {
        return this.countSnykVulns(data);
      }
    } catch (error) {
      console.warn(chalk.yellow(`⚠️  Could not analyze dependency file ${filePath}: ${error.message}`));
    }
    
    return 0;
  }

  async analyzeDASTFile(filePath) {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      
      if (filePath.endsWith('.json')) {
        const data = JSON.parse(content);
        return this.countZAPAlerts(data);
      }
    } catch (error) {
      console.warn(chalk.yellow(`⚠️  Could not analyze DAST file ${filePath}: ${error.message}`));
    }
    
    return 0;
  }

  countSARIFFindings(sarif) {
    let count = 0;
    if (sarif.runs) {
      sarif.runs.forEach(run => {
        if (run.results) {
          count += run.results.length;
        }
      });
    }
    return count;
  }

  countJSONFindings(data) {
    if (data.results && Array.isArray(data.results)) {
      return data.results.length;
    }
    if (data.findings && Array.isArray(data.findings)) {
      return data.findings.length;
    }
    return 0;
  }

  countNPMAuditVulns(data) {
    if (data.vulnerabilities) {
      return Object.keys(data.vulnerabilities).length;
    }
    if (data.metadata && data.metadata.vulnerabilities) {
      return data.metadata.vulnerabilities.total || 0;
    }
    return 0;
  }

  countSnykVulns(data) {
    if (data.vulnerabilities && Array.isArray(data.vulnerabilities)) {
      return data.vulnerabilities.length;
    }
    if (data.uniqueCount) {
      return data.uniqueCount;
    }
    return 0;
  }

  countZAPAlerts(data) {
    if (data.site && data.site[0] && data.site[0].alerts) {
      return data.site[0].alerts.length;
    }
    if (Array.isArray(data)) {
      return data.length;
    }
    return 0;
  }

  async run() {
    try {
      await this.initialize();
      
      const baseline = await this.loadBaseline();
      const current = await this.loadCurrentResults();
      const comparison = await this.compareResults(baseline, current);
      
      await this.saveComparison(comparison);
      const hasRegression = await this.generateComparisonReport(comparison);
      
      console.log('');
      console.log(chalk.green('✅ Security baseline comparison completed!'));
      
      // Exit with error code if regression detected
      return hasRegression ? 1 : 0;
    } catch (error) {
      console.error('');
      console.error(chalk.red('❌ Security baseline comparison failed:'));
      console.error(chalk.red(error.message));
      console.error(error.stack);
      return 1;
    }
  }
}

// Run the script
if (import.meta.url === `file://${process.argv[1]}`) {
  const comparator = new SecurityBaselineComparator();
  process.exit(await comparator.run());
}

export default SecurityBaselineComparator;