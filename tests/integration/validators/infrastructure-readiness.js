#!/usr/bin/env node

/**
 * Infrastructure Readiness Validator
 * 
 * Validates that infrastructure components are ready for production deployment
 * including monitoring, logging, networking, and service dependencies
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs-extra';
import pino from 'pino';
import moment from 'moment';
import chalk from 'chalk';
import axios from 'axios';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '../../..');

const logger = pino({
  name: 'infrastructure-validator',
  level: process.env.LOG_LEVEL || 'info',
  transport: {
    target: 'pino-pretty',
    options: { colorize: true }
  }
});

/**
 * Infrastructure Readiness Checks
 */
class InfrastructureValidator {
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
    logger.info(`Running infrastructure check: ${check.name}`);
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
    logger.info('Starting infrastructure readiness validation...');
    
    for (const check of this.checks) {
      await this.runCheck(check);
    }
    
    this.results.ready = this.results.summary.critical_failures === 0;
    
    return this.results;
  }

  async saveResults() {
    const resultsDir = join(projectRoot, 'tests/integration/results');
    await fs.ensureDir(resultsDir);
    
    const filename = `infrastructure-readiness-${moment().format('YYYY-MM-DD_HH-mm-ss')}.json`;
    const filepath = join(resultsDir, filename);
    
    await fs.writeJson(filepath, this.results, { spaces: 2 });
    logger.info(`Results saved to: ${filepath}`);
    
    return filepath;
  }
}

/**
 * Infrastructure Readiness Checks
 */

// Check 1: Terraform Configuration
async function checkTerraformConfiguration() {
  try {
    const terraformDir = join(projectRoot, 'terraform');
    
    if (!await fs.pathExists(terraformDir)) {
      return {
        success: false,
        error: 'Terraform configuration directory not found'
      };
    }
    
    const requiredFiles = [
      'main.tf',
      'variables.tf',
      'outputs.tf',
      'provider.tf'
    ];
    
    const missingFiles = [];
    const presentFiles = [];
    
    for (const file of requiredFiles) {
      const filePath = join(terraformDir, file);
      if (await fs.pathExists(filePath)) {
        presentFiles.push(file);
      } else {
        missingFiles.push(file);
      }
    }
    
    return {
      success: missingFiles.length === 0,
      details: {
        present: presentFiles,
        missing: missingFiles,
        terraformDir
      },
      error: missingFiles.length > 0 ? 
        `Missing Terraform files: ${missingFiles.join(', ')}` : null
    };
    
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

// Check 2: Docker Configuration
async function checkDockerConfiguration() {
  try {
    const dockerFiles = [
      join(projectRoot, 'Dockerfile'),
      join(projectRoot, 'docker-compose.yml'),
      join(projectRoot, '.dockerignore')
    ];
    
    const foundFiles = [];
    
    for (const dockerFile of dockerFiles) {
      if (await fs.pathExists(dockerFile)) {
        foundFiles.push(dockerFile);
      }
    }
    
    return {
      success: foundFiles.length > 0, // At least one Docker config found
      details: {
        found: foundFiles,
        total: dockerFiles.length
      },
      error: foundFiles.length === 0 ? 
        'No Docker configuration files found' : null
    };
    
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

// Check 3: GitHub Actions CI/CD
async function checkGitHubActions() {
  try {
    const workflowsDir = join(projectRoot, '.github/workflows');
    
    if (!await fs.pathExists(workflowsDir)) {
      return {
        success: false,
        error: 'GitHub Actions workflows directory not found'
      };
    }
    
    const workflows = await fs.readdir(workflowsDir);
    const yamlWorkflows = workflows.filter(file => file.endsWith('.yml') || file.endsWith('.yaml'));
    
    const workflowDetails = [];
    
    for (const workflow of yamlWorkflows) {
      const workflowPath = join(workflowsDir, workflow);
      const content = await fs.readFile(workflowPath, 'utf8');
      
      // Basic validation - check for key sections
      const hasOn = content.includes('on:');
      const hasJobs = content.includes('jobs:');
      const hasSteps = content.includes('steps:');
      
      workflowDetails.push({
        name: workflow,
        valid: hasOn && hasJobs && hasSteps,
        sections: { on: hasOn, jobs: hasJobs, steps: hasSteps }
      });
    }
    
    const validWorkflows = workflowDetails.filter(w => w.valid);
    
    return {
      success: validWorkflows.length > 0,
      details: {
        total: yamlWorkflows.length,
        valid: validWorkflows.length,
        workflows: workflowDetails
      },
      error: validWorkflows.length === 0 ? 
        'No valid GitHub Actions workflows found' : null
    };
    
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

// Check 4: Monitoring Configuration
async function checkMonitoringConfiguration() {
  try {
    const monitoringFiles = [
      join(projectRoot, 'docker-compose.monitoring.yml'),
      join(projectRoot, 'monitoring/prometheus.yml'),
      join(projectRoot, 'monitoring/grafana'),
      join(projectRoot, 'terraform/monitoring.tf')
    ];
    
    const foundFiles = [];
    
    for (const file of monitoringFiles) {
      if (await fs.pathExists(file)) {
        foundFiles.push(file);
      }
    }
    
    // Check for application-level monitoring config
    const appConfigFiles = [
      join(projectRoot, 'package.json'),
      join(projectRoot, 'LOGGING.md'),
      join(projectRoot, 'DEVOPS.md')
    ];
    
    let hasMonitoringConfig = false;
    
    for (const configFile of appConfigFiles) {
      if (await fs.pathExists(configFile)) {
        const content = await fs.readFile(configFile, 'utf8');
        if (content.includes('monitoring') || content.includes('metrics') || content.includes('telemetry')) {
          hasMonitoringConfig = true;
          break;
        }
      }
    }
    
    return {
      success: foundFiles.length > 0 || hasMonitoringConfig,
      details: {
        infrastructureFiles: foundFiles,
        hasAppConfig: hasMonitoringConfig
      },
      error: foundFiles.length === 0 && !hasMonitoringConfig ? 
        'No monitoring configuration found' : null
    };
    
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

// Check 5: Security Configuration
async function checkSecurityConfiguration() {
  try {
    const securityFiles = [
      join(projectRoot, 'SECURITY.md'),
      join(projectRoot, 'security'),
      join(projectRoot, '.github/workflows'),
      join(projectRoot, 'terraform/security.tf')
    ];
    
    const foundFiles = [];
    
    for (const file of securityFiles) {
      if (await fs.pathExists(file)) {
        foundFiles.push(file);
      }
    }
    
    // Check for security-related npm scripts
    const packageJsonPath = join(projectRoot, 'package.json');
    let hasSecurityScripts = false;
    
    if (await fs.pathExists(packageJsonPath)) {
      const packageJson = await fs.readJson(packageJsonPath);
      if (packageJson.scripts) {
        const scripts = Object.keys(packageJson.scripts);
        hasSecurityScripts = scripts.some(script => 
          script.includes('security') || 
          script.includes('audit') || 
          script.includes('scan')
        );
      }
    }
    
    return {
      success: foundFiles.length > 0 || hasSecurityScripts,
      details: {
        configFiles: foundFiles,
        hasSecurityScripts
      },
      error: foundFiles.length === 0 && !hasSecurityScripts ? 
        'No security configuration found' : null
    };
    
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

// Check 6: Network Connectivity
async function checkNetworkConnectivity() {
  try {
    const testEndpoints = [
      'https://api.github.com',
      'https://registry.npmjs.org',
      'https://google.com'
    ];
    
    const connectivityResults = [];
    
    for (const endpoint of testEndpoints) {
      try {
        const startTime = Date.now();
        const response = await axios.get(endpoint, { 
          timeout: 5000,
          validateStatus: () => true // Accept any status code
        });
        const responseTime = Date.now() - startTime;
        
        connectivityResults.push({
          endpoint,
          success: response.status < 500,
          status: response.status,
          responseTime
        });
        
      } catch (error) {
        connectivityResults.push({
          endpoint,
          success: false,
          error: error.code || error.message,
          responseTime: null
        });
      }
    }
    
    const successfulConnections = connectivityResults.filter(r => r.success);
    
    return {
      success: successfulConnections.length >= Math.ceil(testEndpoints.length / 2),
      details: {
        total: testEndpoints.length,
        successful: successfulConnections.length,
        results: connectivityResults
      },
      error: successfulConnections.length < Math.ceil(testEndpoints.length / 2) ? 
        'Insufficient network connectivity' : null
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
  console.log(chalk.blue('🏗️  Starting Infrastructure Readiness Validation'));
  console.log(chalk.blue('=' .repeat(55)));
  
  const validator = new InfrastructureValidator();
  
  // Add all checks
  validator.addCheck('Terraform Configuration', checkTerraformConfiguration, true);
  validator.addCheck('Docker Configuration', checkDockerConfiguration, false);
  validator.addCheck('GitHub Actions CI/CD', checkGitHubActions, true);
  validator.addCheck('Monitoring Configuration', checkMonitoringConfiguration, false);
  validator.addCheck('Security Configuration', checkSecurityConfiguration, true);
  validator.addCheck('Network Connectivity', checkNetworkConnectivity, false);
  
  // Run all checks
  const results = await validator.runAllChecks();
  
  // Save results
  const resultsFile = await validator.saveResults();
  
  // Print summary
  console.log(chalk.blue('\n' + '='.repeat(55)));
  console.log(chalk.blue('INFRASTRUCTURE READINESS SUMMARY'));
  console.log(chalk.blue('='.repeat(55)));
  console.log(`Environment: ${results.environment}`);
  console.log(`Timestamp: ${results.timestamp}`);
  console.log(`Total Checks: ${results.summary.total}`);
  console.log(`Passed: ${chalk.green(results.summary.passed)}`);
  console.log(`Failed: ${chalk.red(results.summary.failed)}`);
  console.log(`Critical Failures: ${chalk.red(results.summary.critical_failures)}`);
  console.log(`Infrastructure Ready: ${results.ready ? chalk.green('YES') : chalk.red('NO')}`);
  
  if (!results.ready) {
    console.log(chalk.red('\nCRITICAL INFRASTRUCTURE ISSUES:'));
    results.checks
      .filter(check => !check.success && check.critical)
      .forEach(check => {
        console.log(chalk.red(`  ❌ ${check.name}: ${check.error}`));
      });
  }
  
  const warnings = results.checks.filter(check => !check.success && !check.critical);
  if (warnings.length > 0) {
    console.log(chalk.yellow('\nWARNINGS (Non-Critical):'));
    warnings.forEach(check => {
      console.log(chalk.yellow(`  ⚠️  ${check.name}: ${check.error}`));
    });
  }
  
  console.log(chalk.blue(`\nResults saved to: ${resultsFile}`));
  console.log(chalk.blue('='.repeat(55) + '\n'));
  
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
    logger.error('Infrastructure validation failed:', error);
    process.exit(1);
  });
}

export { InfrastructureValidator, main };