#!/usr/bin/env node

/**
 * Deployment Readiness Validator
 * 
 * Validates that all systems are ready for production deployment
 * by checking configuration, dependencies, and system state
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs-extra';
import pino from 'pino';
import moment from 'moment';
import chalk from 'chalk';
import { glob } from 'glob';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '../../..');

const logger = pino({
  name: 'deployment-validator',
  level: process.env.LOG_LEVEL || 'info'
});

/**
 * Deployment Readiness Checks
 */
class DeploymentValidator {
  constructor() {
    this.checks = [];
    this.results = {
      timestamp: moment().format('YYYY-MM-DD HH:mm:ss'),
      environment: process.env.TEST_ENV || 'staging',
      checks: [],
      summary: {
        total: 0,
        passed: 0,
        failed: 0,
        critical_failures: 0
      },
      ready: false
    };
  }

  addCheck(name, fn, critical = true) {
    this.checks.push({ name, fn, critical });
  }

  async runCheck(check) {
    logger.info(`Running check: ${check.name}`);
    const startTime = Date.now();
    
    try {
      const result = await check.fn();
      const duration = Date.now() - startTime;
      
      const checkResult = {
        name: check.name,
        success: result.success,
        critical: check.critical,
        duration,
        details: result.details || {},
        error: result.error || null
      };
      
      this.results.checks.push(checkResult);
      this.results.summary.total++;
      
      if (result.success) {
        this.results.summary.passed++;
        logger.info(chalk.green(`✅ ${check.name} - PASSED`));
      } else {
        this.results.summary.failed++;
        if (check.critical) {
          this.results.summary.critical_failures++;
        }
        logger.error(chalk.red(`❌ ${check.name} - FAILED: ${result.error}`));
      }
      
      return checkResult;
      
    } catch (error) {
      const duration = Date.now() - startTime;
      const checkResult = {
        name: check.name,
        success: false,
        critical: check.critical,
        duration,
        details: {},
        error: error.message
      };
      
      this.results.checks.push(checkResult);
      this.results.summary.total++;
      this.results.summary.failed++;
      
      if (check.critical) {
        this.results.summary.critical_failures++;
      }
      
      logger.error(chalk.red(`💥 ${check.name} - ERROR: ${error.message}`));
      return checkResult;
    }
  }

  async runAllChecks() {
    logger.info('Starting deployment readiness validation...');
    
    for (const check of this.checks) {
      await this.runCheck(check);
    }
    
    this.results.ready = this.results.summary.critical_failures === 0;
    
    return this.results;
  }

  async saveResults() {
    const resultsDir = join(projectRoot, 'tests/integration/results');
    await fs.ensureDir(resultsDir);
    
    const filename = `deployment-readiness-${moment().format('YYYY-MM-DD_HH-mm-ss')}.json`;
    const filepath = join(resultsDir, filename);
    
    await fs.writeJson(filepath, this.results, { spaces: 2 });
    logger.info(`Results saved to: ${filepath}`);
    
    return filepath;
  }
}

/**
 * Individual Readiness Checks
 */

// Check 1: Package Dependencies
async function checkPackageDependencies() {
  try {
    const packagePaths = [
      join(projectRoot, 'tests/performance/package.json'),
      join(projectRoot, 'chaos-engineering/package.json'),
      join(projectRoot, 'security/package.json'),
      join(projectRoot, 'tests/integration/package.json')
    ];
    
    const missingDependencies = [];
    
    for (const packagePath of packagePaths) {
      if (await fs.pathExists(packagePath)) {
        const packageJson = await fs.readJson(packagePath);
        const nodeModulesPath = join(dirname(packagePath), 'node_modules');
        
        if (!await fs.pathExists(nodeModulesPath)) {
          missingDependencies.push(packagePath);
        }
      }
    }
    
    return {
      success: missingDependencies.length === 0,
      details: {
        checked: packagePaths.length,
        missing: missingDependencies
      },
      error: missingDependencies.length > 0 ? 
        `Missing node_modules in: ${missingDependencies.join(', ')}` : null
    };
    
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

// Check 2: Configuration Files
async function checkConfigurationFiles() {
  try {
    const requiredConfigs = [
      join(projectRoot, 'tests/performance/playwright.config.staging.js'),
      join(projectRoot, '.github/workflows/ci.yml'),
      join(projectRoot, 'terraform'),
      join(projectRoot, 'ARCHITECTURE.md'),
      join(projectRoot, 'SECURITY.md')
    ];
    
    const missingConfigs = [];
    
    for (const configPath of requiredConfigs) {
      if (!await fs.pathExists(configPath)) {
        missingConfigs.push(configPath);
      }
    }
    
    return {
      success: missingConfigs.length === 0,
      details: {
        checked: requiredConfigs.length,
        missing: missingConfigs
      },
      error: missingConfigs.length > 0 ? 
        `Missing configuration files: ${missingConfigs.join(', ')}` : null
    };
    
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

// Check 3: Test Results Availability
async function checkTestResults() {
  try {
    const testResultPaths = [
      join(projectRoot, 'tests/performance/results'),
      join(projectRoot, 'chaos-engineering/results'),
      join(projectRoot, 'security/results'),
      join(projectRoot, 'tests/integration/results')
    ];
    
    let hasRecentResults = false;
    const resultDetails = {};
    
    for (const resultPath of testResultPaths) {
      await fs.ensureDir(resultPath);
      const files = await glob(join(resultPath, '*.json'));
      
      if (files.length > 0) {
        // Check if any results are from the last 24 hours
        const recentFiles = [];
        for (const file of files) {
          const stats = await fs.stat(file);
          if (moment(stats.mtime).isAfter(moment().subtract(24, 'hours'))) {
            recentFiles.push(file);
            hasRecentResults = true;
          }
        }
        resultDetails[resultPath] = { total: files.length, recent: recentFiles.length };
      } else {
        resultDetails[resultPath] = { total: 0, recent: 0 };
      }
    }
    
    return {
      success: true, // Non-critical, just informational
      details: {
        hasRecentResults,
        results: resultDetails
      },
      error: null
    };
    
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

// Check 4: Environment Variables
async function checkEnvironmentVariables() {
  try {
    const expectedEnvVars = [
      'NODE_ENV',
      'TEST_ENV'
    ];
    
    const missingVars = [];
    const presentVars = {};
    
    for (const envVar of expectedEnvVars) {
      if (process.env[envVar]) {
        presentVars[envVar] = process.env[envVar];
      } else {
        missingVars.push(envVar);
      }
    }
    
    return {
      success: missingVars.length === 0,
      details: {
        present: presentVars,
        missing: missingVars
      },
      error: missingVars.length > 0 ? 
        `Missing environment variables: ${missingVars.join(', ')}` : null
    };
    
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

// Check 5: System Resources
async function checkSystemResources() {
  try {
    const os = await import('os');
    
    const freeMemory = os.freemem();
    const totalMemory = os.totalmem();
    const memoryUsage = ((totalMemory - freeMemory) / totalMemory) * 100;
    
    const loadAverage = os.loadavg();
    const cpuCount = os.cpus().length;
    
    const memoryOk = memoryUsage < 90; // Less than 90% memory usage
    const loadOk = loadAverage[0] < cpuCount * 2; // Load average reasonable
    
    return {
      success: memoryOk && loadOk,
      details: {
        memory: {
          total: Math.round(totalMemory / 1024 / 1024 / 1024),
          free: Math.round(freeMemory / 1024 / 1024 / 1024),
          usagePercent: Math.round(memoryUsage)
        },
        cpu: {
          count: cpuCount,
          loadAverage: loadAverage.map(load => Math.round(load * 100) / 100)
        }
      },
      error: !memoryOk || !loadOk ? 
        `System resources under pressure - Memory: ${Math.round(memoryUsage)}%, Load: ${loadAverage[0].toFixed(2)}` : null
    };
    
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Main Validation Function
 */
async function main() {
  console.log(chalk.blue('🔍 Starting Deployment Readiness Validation'));
  console.log(chalk.blue('=' .repeat(50)));
  
  const validator = new DeploymentValidator();
  
  // Add all checks
  validator.addCheck('Package Dependencies', checkPackageDependencies, true);
  validator.addCheck('Configuration Files', checkConfigurationFiles, true);
  validator.addCheck('Test Results', checkTestResults, false);
  validator.addCheck('Environment Variables', checkEnvironmentVariables, true);
  validator.addCheck('System Resources', checkSystemResources, false);
  
  // Run all checks
  const results = await validator.runAllChecks();
  
  // Save results
  const resultsFile = await validator.saveResults();
  
  // Print summary
  console.log(chalk.blue('\n' + '='.repeat(50)));
  console.log(chalk.blue('DEPLOYMENT READINESS SUMMARY'));
  console.log(chalk.blue('='.repeat(50)));
  console.log(`Environment: ${results.environment}`);
  console.log(`Timestamp: ${results.timestamp}`);
  console.log(`Total Checks: ${results.summary.total}`);
  console.log(`Passed: ${chalk.green(results.summary.passed)}`);
  console.log(`Failed: ${chalk.red(results.summary.failed)}`);
  console.log(`Critical Failures: ${chalk.red(results.summary.critical_failures)}`);
  console.log(`Deployment Ready: ${results.ready ? chalk.green('YES') : chalk.red('NO')}`);
  
  if (!results.ready) {
    console.log(chalk.red('\nCRITICAL ISSUES:'));
    results.checks
      .filter(check => !check.success && check.critical)
      .forEach(check => {
        console.log(chalk.red(`  ❌ ${check.name}: ${check.error}`));
      });
  }
  
  console.log(chalk.blue(`\nResults saved to: ${resultsFile}`));
  console.log(chalk.blue('='.repeat(50) + '\n'));
  
  // Export results for integration
  process.stdout.write(JSON.stringify({
    ready: results.ready,
    summary: results.summary,
    resultsFile
  }));
  
  process.exit(results.ready ? 0 : 1);
}

// Execute if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    logger.error('Deployment validation failed:', error);
    process.exit(1);
  });
}

export { DeploymentValidator, main };