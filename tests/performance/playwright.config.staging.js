// Playwright Configuration for Staging Environment Performance Testing
import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';

// Load environment-specific variables
dotenv.config({ path: `.env.${process.env.TEST_ENV || 'staging'}` });

export default defineConfig({
  // Test Configuration
  testDir: './scenarios',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 4 : 2,
  
  // Reporting
  reporter: [
    ['html', { outputFolder: 'reports/html' }],
    ['json', { outputFile: 'reports/results.json' }],
    ['junit', { outputFile: 'reports/junit.xml' }],
    ['./reporters/performance-reporter.js']
  ],
  
  // Global Configuration
  use: {
    // Base URL for staging environment
    baseURL: process.env.TEST_BASE_URL || 'https://staging.firemni-asistent.cz',
    
    // Performance-optimized settings
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
    
    // Browser context options
    ignoreHTTPSErrors: false,
    acceptDownloads: true,
    
    // Performance monitoring
    actionTimeout: 30000,
    navigationTimeout: 60000,
    
    // Extra HTTP headers
    extraHTTPHeaders: {
      'Accept': 'application/json, */*',
      'Accept-Language': 'cs-CZ,cs;q=0.9,en;q=0.8',
      'User-Agent': 'Firemni-Asistent-Performance-Tests/1.0'
    }
  },

  // Test Projects - Different browsers and scenarios
  projects: [
    // Performance Testing - Core User Journeys
    {
      name: 'performance-chrome',
      use: { 
        ...devices['Desktop Chrome'],
        // Performance-specific settings
        launchOptions: {
          args: [
            '--enable-precise-memory-measurements',
            '--enable-heap-profiling',
            '--memory-pressure-off',
            '--max_old_space_size=4096'
          ]
        }
      },
      testMatch: /.*\.performance\.spec\.js/
    },
    
    // Load Testing - Concurrent User Simulation
    {
      name: 'load-testing-chrome',
      use: { 
        ...devices['Desktop Chrome'],
        // Reduced overhead for load testing
        video: 'off',
        screenshot: 'off',
        trace: 'off'
      },
      testMatch: /.*\.load\.spec\.js/
    },
    
    // Mobile Performance Testing
    {
      name: 'performance-mobile',
      use: {
        ...devices['Pixel 5'],
        // Mobile-specific performance settings
        launchOptions: {
          args: ['--enable-precise-memory-measurements']
        }
      },
      testMatch: /.*\.mobile\.spec\.js/
    },
    
    // API Performance Testing
    {
      name: 'api-performance',
      use: {
        // API testing without browser overhead
        headless: true,
        screenshot: 'off',
        video: 'off'
      },
      testMatch: /.*\.api\.spec\.js/
    }
  ],

  // Global Setup and Teardown
  globalSetup: require.resolve('./setup/global-setup.js'),
  globalTeardown: require.resolve('./setup/global-teardown.js'),
  
  // Performance Test Timeouts
  timeout: 180000, // 3 minutes per test
  expect: {
    timeout: 30000  // 30 seconds for assertions
  },
  
  // Output Directory
  outputDir: 'test-results/'
});