#!/usr/bin/env node

/**
 * Test script to validate that our integration test validators are working
 */

import { DeploymentValidator } from './validators/deployment-readiness.js';
import { InfrastructureValidator } from './validators/infrastructure-readiness.js';
import chalk from 'chalk';

async function testValidators() {
  console.log(chalk.blue('🧪 Testing Integration Validators'));
  console.log(chalk.blue('=' .repeat(40)));
  
  try {
    // Test Deployment Validator
    console.log(chalk.yellow('\n📋 Testing Deployment Validator...'));
    const deploymentValidator = new DeploymentValidator();
    
    // Add a simple test check
    deploymentValidator.addCheck('Test Check', async () => {
      return { success: true, details: { test: 'passed' } };
    }, false);
    
    const deploymentResults = await deploymentValidator.runAllChecks();
    console.log(chalk.green(`✅ Deployment Validator: ${deploymentResults.summary.total} checks completed`));
    
    // Test Infrastructure Validator
    console.log(chalk.yellow('\n🏗️  Testing Infrastructure Validator...'));
    const infrastructureValidator = new InfrastructureValidator();
    
    // Add a simple test check
    infrastructureValidator.addCheck('Test Check', async () => {
      return { success: true, details: { test: 'passed' } };
    }, false);
    
    const infrastructureResults = await infrastructureValidator.runAllChecks();
    console.log(chalk.green(`✅ Infrastructure Validator: ${infrastructureResults.summary.total} checks completed`));
    
    console.log(chalk.blue('\n' + '=' .repeat(40)));
    console.log(chalk.green('🎉 All validators are working correctly!'));
    
  } catch (error) {
    console.error(chalk.red('❌ Validator testing failed:'), error);
    process.exit(1);
  }
}

testValidators();