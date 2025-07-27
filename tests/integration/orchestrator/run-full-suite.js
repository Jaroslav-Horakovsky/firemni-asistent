#!/usr/bin/env node

/**
 * End-to-End Integration Test Suite Orchestrator
 * 
 * Orchestrates Performance + Chaos + Security testing systems
 * for comprehensive production readiness validation
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { spawn } from 'child_process';
import fs from 'fs-extra';
import pino from 'pino';
import moment from 'moment';
import chalk from 'chalk';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '../../..');

// Configure logger
const logger = pino({
  name: 'integration-orchestrator',
  level: process.env.LOG_LEVEL || 'info',
  transport: {
    target: 'pino-pretty',
    options: { colorize: true }
  }
});

/**
 * Test Suite Configuration
 */
const TEST_SUITE_CONFIG = {
  name: 'Full Production Readiness Validation',
  version: '1.0.0',
  timestamp: moment().format('YYYY-MM-DD_HH-mm-ss'),
  environment: process.env.TEST_ENV || 'staging',
  phases: [
    {
      name: 'Security Baseline Validation',
      type: 'security',
      critical: true,
      timeout: 300000, // 5 minutes
      commands: [
        'npm run deps:npm-audit',
        'npm run validate'
      ]
    },
    {
      name: 'Performance Baseline Testing',
      type: 'performance', 
      critical: true,
      timeout: 600000, // 10 minutes
      commands: [
        'npm run baseline:create',
        'npm run test:staging'
      ]
    },
    {
      name: 'Chaos Engineering Validation',
      type: 'chaos',
      critical: true,
      timeout: 900000, // 15 minutes
      commands: [
        'npm run validate:staging'
      ]
    },
    {
      name: 'Integration Validation',
      type: 'integration',
      critical: true,
      timeout: 300000, // 5 minutes
      commands: [
        'node validators/deployment-readiness.js',
        'node validators/infrastructure-readiness.js'
      ]
    }
  ]
};

/**
 * Test Results Aggregator
 */
class TestResultsAggregator {
  constructor() {
    this.results = {
      suite: TEST_SUITE_CONFIG.name,
      timestamp: TEST_SUITE_CONFIG.timestamp,
      environment: TEST_SUITE_CONFIG.environment,
      phases: [],
      summary: {
        total: 0,
        passed: 0,
        failed: 0,
        critical_failures: 0,
        duration: 0
      }
    };
    this.startTime = Date.now();
  }

  addPhaseResult(phaseName, result) {
    this.results.phases.push({
      name: phaseName,
      ...result,
      timestamp: moment().format('YYYY-MM-DD HH:mm:ss')
    });
    
    this.results.summary.total++;
    if (result.success) {
      this.results.summary.passed++;
    } else {
      this.results.summary.failed++;
      if (result.critical) {
        this.results.summary.critical_failures++;
      }
    }
  }

  finalize() {
    this.results.summary.duration = Date.now() - this.startTime;
    this.results.success = this.results.summary.critical_failures === 0;
    return this.results;
  }

  async saveResults() {
    const resultsDir = join(projectRoot, 'tests/integration/results');
    await fs.ensureDir(resultsDir);
    
    const filename = `integration-test-results-${this.results.timestamp}.json`;
    const filepath = join(resultsDir, filename);
    
    await fs.writeJson(filepath, this.results, { spaces: 2 });
    logger.info(`Test results saved to: ${filepath}`);
    
    return filepath;
  }
}

/**
 * Command Executor
 */
async function executeCommand(command, cwd, timeout = 300000) {
  return new Promise((resolve, reject) => {
    logger.info(`Executing: ${command} in ${cwd}`);
    
    const child = spawn('npm', ['run', ...command.split(' ').slice(2)], {
      cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: true,
      timeout
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      const result = {
        command,
        exitCode: code,
        stdout,
        stderr,
        success: code === 0
      };
      
      if (code === 0) {
        logger.info(`✅ Command completed: ${command}`);
        resolve(result);
      } else {
        logger.error(`❌ Command failed: ${command} (exit code: ${code})`);
        resolve(result); // Don't reject, let orchestrator decide
      }
    });

    child.on('error', (error) => {
      logger.error(`💥 Command error: ${command}`, error);
      resolve({
        command,
        error: error.message,
        success: false
      });
    });

    // Handle timeout
    setTimeout(() => {
      child.kill('SIGTERM');
      resolve({
        command,
        error: 'Command timeout',
        success: false
      });
    }, timeout);
  });
}

/**
 * Phase Executor
 */
async function executePhase(phase, aggregator) {
  const phaseStartTime = Date.now();
  logger.info(chalk.blue(`🚀 Starting phase: ${phase.name}`));
  
  const phaseResult = {
    type: phase.type,
    critical: phase.critical,
    success: true,
    commands: [],
    duration: 0,
    error: null
  };
  
  try {
    // Determine working directory based on phase type
    let workingDir;
    switch (phase.type) {
      case 'security':
        workingDir = join(projectRoot, 'security');
        break;
      case 'performance':
        workingDir = join(projectRoot, 'tests/performance');
        break;
      case 'chaos':
        workingDir = join(projectRoot, 'chaos-engineering');
        break;
      case 'integration':
        workingDir = join(projectRoot, 'tests/integration');
        break;
      default:
        workingDir = projectRoot;
    }

    // Execute each command in the phase
    for (const command of phase.commands) {
      const commandResult = await executeCommand(command, workingDir, phase.timeout);
      phaseResult.commands.push(commandResult);
      
      if (!commandResult.success) {
        phaseResult.success = false;
        phaseResult.error = `Command failed: ${command}`;
        
        if (phase.critical) {
          logger.error(chalk.red(`💀 Critical phase failed: ${phase.name}`));
          break;
        }
      }
    }
    
  } catch (error) {
    phaseResult.success = false;
    phaseResult.error = error.message;
    logger.error(`Phase execution error: ${phase.name}`, error);
  }
  
  phaseResult.duration = Date.now() - phaseStartTime;
  aggregator.addPhaseResult(phase.name, phaseResult);
  
  const status = phaseResult.success ? '✅' : '❌';
  const duration = (phaseResult.duration / 1000).toFixed(2);
  logger.info(`${status} Phase completed: ${phase.name} (${duration}s)`);
  
  return phaseResult;
}

/**
 * Production Readiness Assessment
 */
function assessProductionReadiness(results) {
  const assessment = {
    ready: true,
    confidence: 'high',
    blockers: [],
    warnings: [],
    recommendations: []
  };
  
  // Check for critical failures
  if (results.summary.critical_failures > 0) {
    assessment.ready = false;
    assessment.confidence = 'low';
    assessment.blockers.push('Critical test failures detected');
  }
  
  // Check individual phases
  results.phases.forEach(phase => {
    if (!phase.success && phase.critical) {
      assessment.blockers.push(`${phase.type} validation failed`);
    } else if (!phase.success) {
      assessment.warnings.push(`${phase.type} tests had issues (non-critical)`);
    }
  });
  
  // Adjust confidence based on warnings
  if (assessment.warnings.length > 0) {
    assessment.confidence = assessment.confidence === 'high' ? 'medium' : 'low';
  }
  
  // Generate recommendations
  if (assessment.blockers.length === 0 && assessment.warnings.length === 0) {
    assessment.recommendations.push('System is ready for production deployment');
  } else {
    assessment.recommendations.push('Review and fix identified issues before deployment');
    assessment.recommendations.push('Consider running tests again after fixes');
  }
  
  return assessment;
}

/**
 * Main Orchestrator
 */
async function main() {
  const startTime = Date.now();
  logger.info(chalk.green(`🎬 Starting Full Production Readiness Suite`));
  logger.info(`Environment: ${TEST_SUITE_CONFIG.environment}`);
  logger.info(`Timestamp: ${TEST_SUITE_CONFIG.timestamp}`);
  
  const aggregator = new TestResultsAggregator();
  let allPhasesSuccess = true;
  
  try {
    // Execute each phase
    for (const phase of TEST_SUITE_CONFIG.phases) {
      const phaseResult = await executePhase(phase, aggregator);
      
      if (!phaseResult.success && phase.critical) {
        allPhasesSuccess = false;
        logger.error(chalk.red(`🛑 Critical phase failed, stopping execution`));
        break;
      }
    }
    
    // Finalize results
    const finalResults = aggregator.finalize();
    const assessment = assessProductionReadiness(finalResults);
    finalResults.assessment = assessment;
    
    // Save results
    const resultsFile = await aggregator.saveResults();
    
    // Print summary
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(chalk.blue('\n' + '='.repeat(60)));
    console.log(chalk.blue('PRODUCTION READINESS VALIDATION COMPLETE'));
    console.log(chalk.blue('='.repeat(60)));
    console.log(`Total Duration: ${duration}s`);
    console.log(`Phases: ${finalResults.summary.total}`);
    console.log(`Passed: ${chalk.green(finalResults.summary.passed)}`);
    console.log(`Failed: ${chalk.red(finalResults.summary.failed)}`);
    console.log(`Critical Failures: ${chalk.red(finalResults.summary.critical_failures)}`);
    
    console.log(chalk.blue('\nPRODUCTION READINESS ASSESSMENT:'));
    console.log(`Ready: ${assessment.ready ? chalk.green('YES') : chalk.red('NO')}`);
    console.log(`Confidence: ${chalk.yellow(assessment.confidence.toUpperCase())}`);
    
    if (assessment.blockers.length > 0) {
      console.log(chalk.red('\nBLOCKERS:'));
      assessment.blockers.forEach(blocker => console.log(chalk.red(`  ❌ ${blocker}`)));
    }
    
    if (assessment.warnings.length > 0) {
      console.log(chalk.yellow('\nWARNINGS:'));
      assessment.warnings.forEach(warning => console.log(chalk.yellow(`  ⚠️  ${warning}`)));
    }
    
    console.log(chalk.blue('\nRECOMMENDATIONS:'));
    assessment.recommendations.forEach(rec => console.log(chalk.blue(`  💡 ${rec}`)));
    
    console.log(chalk.blue(`\nResults saved to: ${resultsFile}`));
    console.log(chalk.blue('='.repeat(60) + '\n'));
    
    // Exit with appropriate code
    process.exit(finalResults.success ? 0 : 1);
    
  } catch (error) {
    logger.error('Orchestrator failed:', error);
    process.exit(1);
  }
}

// Handle process signals
process.on('SIGINT', () => {
  logger.info('Received SIGINT, shutting down gracefully...');
  process.exit(1);
});

process.on('SIGTERM', () => {
  logger.info('Received SIGTERM, shutting down gracefully...');
  process.exit(1);
});

// Start orchestrator
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    logger.error('Unhandled error:', error);
    process.exit(1);
  });
}

export { main, executePhase, TestResultsAggregator };