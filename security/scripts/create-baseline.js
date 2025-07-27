#!/usr/bin/env node

/**
 * Security Baseline Creation Script
 * Creates comprehensive security baseline from current scan results
 */

import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import chalk from 'chalk';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class SecurityBaselineCreator {
  constructor() {
    this.securityDir = path.resolve(__dirname, '..');
    this.resultsDir = path.join(this.securityDir, 'results');
    this.baselinesDir = path.join(this.securityDir, 'baselines');
    this.environment = process.env.TEST_ENV || 'dev';
    this.timestamp = new Date().toISOString();
  }

  async initialize() {
    console.log(chalk.blue('🔒 Security Baseline Creator'));
    console.log(chalk.gray(`Environment: ${this.environment}`));
    console.log(chalk.gray(`Timestamp: ${this.timestamp}`));
    console.log('');

    // Ensure directories exist
    await fs.ensureDir(this.baselinesDir);
    await fs.ensureDir(this.resultsDir);
  }

  async collectSecurityData() {
    console.log(chalk.blue('📊 Collecting security scan data...'));

    const baseline = {
      metadata: {
        timestamp: this.timestamp,
        environment: this.environment,
        version: '1.0.0',
        scanType: 'baseline-creation',
        creator: 'security-baseline-script'
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
        sast: await this.collectSASTData(),
        dependencies: await this.collectDependencyData(),
        dast: await this.collectDASTData()
      },
      configurations: {
        severityThreshold: process.env.VULNERABILITY_THRESHOLD || 'medium',
        scanPolicies: await this.collectScanPolicies(),
        excludedPaths: await this.getExcludedPaths()
      }
    };

    // Calculate totals
    this.calculateTotals(baseline);

    return baseline;
  }

  async collectSASTData() {
    const sastDir = path.join(this.resultsDir, 'sast');
    const sastData = {
      scanners: [],
      totalFindings: 0,
      files: []
    };

    try {
      if (await fs.pathExists(sastDir)) {
        const files = await fs.readdir(sastDir);
        
        for (const file of files) {
          const filePath = path.join(sastDir, file);
          const stats = await fs.stat(filePath);
          
          if (stats.isFile()) {
            sastData.files.push({
              scanner: this.detectScannerFromFile(file),
              filename: file,
              size: stats.size,
              modified: stats.mtime.toISOString(),
              findings: await this.analyzeSASTFile(filePath)
            });
          }
        }
      }
    } catch (error) {
      console.warn(chalk.yellow(`⚠️  Warning: Could not collect SAST data: ${error.message}`));
    }

    return sastData;
  }

  async collectDependencyData() {
    const depsDir = path.join(this.resultsDir, 'dependencies');
    const depsData = {
      scanners: [],
      totalVulnerabilities: 0,
      files: []
    };

    try {
      if (await fs.pathExists(depsDir)) {
        const files = await fs.readdir(depsDir);
        
        for (const file of files) {
          const filePath = path.join(depsDir, file);
          const stats = await fs.stat(filePath);
          
          if (stats.isFile()) {
            depsData.files.push({
              scanner: this.detectScannerFromFile(file),
              filename: file,
              size: stats.size,
              modified: stats.mtime.toISOString(),
              vulnerabilities: await this.analyzeDependencyFile(filePath)
            });
          }
        }
      }
    } catch (error) {
      console.warn(chalk.yellow(`⚠️  Warning: Could not collect dependency data: ${error.message}`));
    }

    return depsData;
  }

  async collectDASTData() {
    const dastDir = path.join(this.resultsDir, 'dast');
    const dastData = {
      scanners: [],
      totalAlerts: 0,
      files: []
    };

    try {
      if (await fs.pathExists(dastDir)) {
        const files = await fs.readdir(dastDir);
        
        for (const file of files) {
          const filePath = path.join(dastDir, file);
          const stats = await fs.stat(filePath);
          
          if (stats.isFile()) {
            dastData.files.push({
              scanner: this.detectScannerFromFile(file),
              filename: file,
              size: stats.size,
              modified: stats.mtime.toISOString(),
              alerts: await this.analyzeDASTFile(filePath)
            });
          }
        }
      }
    } catch (error) {
      console.warn(chalk.yellow(`⚠️  Warning: Could not collect DAST data: ${error.message}`));
    }

    return dastData;
  }

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

  calculateTotals(baseline) {
    // Calculate scanner totals
    baseline.scans.sast.files.forEach(file => {
      baseline.summary.byScanner[file.scanner.toLowerCase().replace(/\\s+/g, '')] += file.findings || 0;
      baseline.summary.byType.sast += file.findings || 0;
      baseline.summary.totalVulnerabilities += file.findings || 0;
    });

    baseline.scans.dependencies.files.forEach(file => {
      const scanner = file.scanner.toLowerCase().replace(/\\s+/g, '').replace('-', '');
      if (baseline.summary.byScanner[scanner] !== undefined) {
        baseline.summary.byScanner[scanner] += file.vulnerabilities || 0;
      }
      baseline.summary.byType.dependency += file.vulnerabilities || 0;
      baseline.summary.totalVulnerabilities += file.vulnerabilities || 0;
    });

    baseline.scans.dast.files.forEach(file => {
      baseline.summary.byScanner.owaspZap += file.alerts || 0;
      baseline.summary.byType.dast += file.alerts || 0;
      baseline.summary.totalVulnerabilities += file.alerts || 0;
    });

    console.log(chalk.green(`✅ Collected ${baseline.summary.totalVulnerabilities} total security findings`));
  }

  async collectScanPolicies() {
    const policies = {};
    
    try {
      // CodeQL policy
      const codeqlConfig = path.join(this.securityDir, '..', '.github', 'codeql', 'codeql-config.yml');
      if (await fs.pathExists(codeqlConfig)) {
        policies.codeql = 'Custom CodeQL configuration present';
      }

      // Semgrep rules
      const semgrepRules = path.join(this.securityDir, 'config', 'semgrep-rules.yml');
      if (await fs.pathExists(semgrepRules)) {
        policies.semgrep = 'Custom Semgrep rules present';
      }

      // ZAP config
      const zapConfig = path.join(this.securityDir, 'config', 'zap-config.json');
      if (await fs.pathExists(zapConfig)) {
        policies.owaspZap = 'Custom ZAP configuration present';
      }

      // Snyk config
      const snykConfig = path.join(this.securityDir, 'config', 'snyk-config.json');
      if (await fs.pathExists(snykConfig)) {
        policies.snyk = 'Custom Snyk configuration present';
      }
    } catch (error) {
      console.warn(chalk.yellow(`⚠️  Could not collect scan policies: ${error.message}`));
    }

    return policies;
  }

  async getExcludedPaths() {
    return [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/*.min.js',
      '**/coverage/**',
      '**/.next/**',
      '**/out/**'
    ];
  }

  async saveBaseline(baseline) {
    const timestamp = new Date().toISOString().split('T')[0].replace(/-/g, '');
    const baselineFilename = `baseline-${this.environment}-${timestamp}.json`;
    const baselinePath = path.join(this.baselinesDir, baselineFilename);
    
    console.log(chalk.blue('💾 Saving security baseline...'));
    
    // Save timestamped baseline
    await fs.writeFile(baselinePath, JSON.stringify(baseline, null, 2));
    console.log(chalk.green(`✅ Baseline saved: ${baselineFilename}`));
    
    // Create/update latest symlink
    const latestLink = path.join(this.baselinesDir, `latest-${this.environment}.json`);
    try {
      await fs.remove(latestLink);
      await fs.copy(baselinePath, latestLink);
      console.log(chalk.green(`✅ Latest baseline updated: latest-${this.environment}.json`));
    } catch (error) {
      console.warn(chalk.yellow(`⚠️  Could not create latest baseline link: ${error.message}`));
    }

    return baselinePath;
  }

  async generateSummaryReport(baseline) {
    console.log('');
    console.log(chalk.blue('📊 Security Baseline Summary'));
    console.log(chalk.gray('=' .repeat(50)));
    console.log(`Environment: ${chalk.cyan(baseline.metadata.environment)}`);
    console.log(`Timestamp: ${chalk.cyan(baseline.metadata.timestamp)}`);
    console.log(`Total Findings: ${chalk.yellow(baseline.summary.totalVulnerabilities)}`);
    console.log('');
    
    console.log(chalk.blue('By Type:'));
    console.log(`  SAST: ${chalk.cyan(baseline.summary.byType.sast)}`);
    console.log(`  Dependencies: ${chalk.cyan(baseline.summary.byType.dependency)}`);
    console.log(`  DAST: ${chalk.cyan(baseline.summary.byType.dast)}`);
    console.log('');
    
    console.log(chalk.blue('By Scanner:'));
    Object.entries(baseline.summary.byScanner).forEach(([scanner, count]) => {
      if (count > 0) {
        console.log(`  ${scanner}: ${chalk.cyan(count)}`);
      }
    });
    console.log('');
    
    if (baseline.summary.totalVulnerabilities === 0) {
      console.log(chalk.green('🎉 No security issues found - excellent security posture!'));
    } else {
      console.log(chalk.yellow(`⚠️  ${baseline.summary.totalVulnerabilities} security findings documented in baseline`));
    }
  }

  async run() {
    try {
      await this.initialize();
      
      const baseline = await this.collectSecurityData();
      const baselinePath = await this.saveBaseline(baseline);
      
      await this.generateSummaryReport(baseline);
      
      console.log('');
      console.log(chalk.green('✅ Security baseline creation completed successfully!'));
      console.log(chalk.gray(`Baseline file: ${baselinePath}`));
      
      return 0;
    } catch (error) {
      console.error('');
      console.error(chalk.red('❌ Security baseline creation failed:'));
      console.error(chalk.red(error.message));
      console.error(error.stack);
      return 1;
    }
  }
}

// Run the script
if (import.meta.url === `file://${process.argv[1]}`) {
  const creator = new SecurityBaselineCreator();
  process.exit(await creator.run());
}

export default SecurityBaselineCreator;