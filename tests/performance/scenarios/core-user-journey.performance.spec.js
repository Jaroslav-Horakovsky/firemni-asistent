// Core User Journey Performance Tests
// Tests critical business workflows for performance regression detection
import { test, expect } from '@playwright/test';
import { PerformanceMonitor } from '../utils/performance-monitor.js';
import { BrowserToolsClient } from '../utils/browser-tools-client.js';
import { BaselineComparator } from '../utils/baseline-comparator.js';

test.describe('Core User Journey Performance', () => {
  let performanceMonitor;
  let browserTools;
  let baselineComparator;
  
  test.beforeAll(async () => {
    performanceMonitor = new PerformanceMonitor();
    browserTools = new BrowserToolsClient();
    baselineComparator = new BaselineComparator();
    
    // Start browser-tools server if not running
    await browserTools.ensureServerRunning();
  });

  test.beforeEach(async ({ page }) => {
    // Initialize performance monitoring
    await performanceMonitor.initializePage(page);
    
    // Start browser-tools monitoring
    await browserTools.startMonitoring(page);
    
    // Clear any existing performance metrics
    await page.evaluate(() => {
      if (window.performance) {
        window.performance.clearMarks();
        window.performance.clearMeasures();
      }
    });
  });

  test.afterEach(async ({ page }) => {
    // Collect performance metrics
    const metrics = await performanceMonitor.collectMetrics(page);
    const browserMetrics = await browserTools.getPerformanceMetrics();
    
    // Compare against baseline
    await baselineComparator.compareAndReport('core-user-journey', {
      ...metrics,
      ...browserMetrics
    });
    
    // Stop monitoring
    await browserTools.stopMonitoring();
  });

  test('User Login → Dashboard Load Performance', async ({ page }) => {
    // Start performance measurement
    await performanceMonitor.startMeasurement('login-dashboard-flow');
    
    // Step 1: Navigate to login page
    const navigationStart = Date.now();
    await page.goto('/login');
    const navigationEnd = Date.now();
    
    // Measure page load performance
    const pageLoadMetrics = await page.evaluate(() => {
      const perfEntry = performance.getEntriesByType('navigation')[0];
      return {
        domContentLoaded: perfEntry.domContentLoadedEventEnd - perfEntry.domContentLoadedEventStart,
        loadComplete: perfEntry.loadEventEnd - perfEntry.loadEventStart,
        firstPaint: performance.getEntriesByName('first-paint')[0]?.startTime,
        firstContentfulPaint: performance.getEntriesByName('first-contentful-paint')[0]?.startTime
      };
    });
    
    // Assert page load performance
    expect(pageLoadMetrics.domContentLoaded).toBeLessThan(2000); // < 2s DOM load
    expect(navigationEnd - navigationStart).toBeLessThan(3000);   // < 3s navigation
    
    // Step 2: Perform login
    const loginStart = Date.now();
    await page.fill('[data-testid="email-input"]', process.env.TEST_USER_EMAIL);
    await page.fill('[data-testid="password-input"]', process.env.TEST_USER_PASSWORD);
    
    // Measure login API call performance
    const loginResponsePromise = page.waitForResponse(response => 
      response.url().includes('/api/auth/login') && response.status() === 200
    );
    
    await page.click('[data-testid="login-button"]');
    const loginResponse = await loginResponsePromise;
    const loginEnd = Date.now();
    
    // Assert login performance
    const loginDuration = loginEnd - loginStart;
    expect(loginDuration).toBeLessThan(5000); // < 5s login flow
    
    // Log login API performance
    const loginApiTime = await loginResponse.finished();
    console.log(`Login API response time: ${loginApiTime}ms`);
    
    // Step 3: Dashboard load after login
    const dashboardStart = Date.now();
    await page.waitForURL('/dashboard');
    await page.waitForSelector('[data-testid="dashboard-content"]', { state: 'visible' });
    const dashboardEnd = Date.now();
    
    // Measure dashboard-specific metrics
    const dashboardMetrics = await page.evaluate(() => {
      // Custom performance marks for dashboard
      const marks = performance.getEntriesByType('mark');
      const measures = performance.getEntriesByType('measure');
      
      return {
        marksCount: marks.length,
        measuresCount: measures.length,
        resourcesLoaded: performance.getEntriesByType('resource').length
      };
    });
    
    // Assert dashboard load performance
    const dashboardLoadTime = dashboardEnd - dashboardStart;
    expect(dashboardLoadTime).toBeLessThan(3000); // < 3s dashboard load
    expect(dashboardMetrics.resourcesLoaded).toBeGreaterThan(0);
    
    // Step 4: Collect Web Vitals
    const webVitals = await page.evaluate(() => {
      return new Promise((resolve) => {
        const vitals = {};
        
        // Largest Contentful Paint
        new PerformanceObserver((entryList) => {
          const entries = entryList.getEntries();
          const lastEntry = entries[entries.length - 1];
          vitals.lcp = lastEntry.startTime;
        }).observe({ entryTypes: ['largest-contentful-paint'] });
        
        // First Input Delay (if available)
        new PerformanceObserver((entryList) => {
          const firstInput = entryList.getEntries()[0];
          if (firstInput) {
            vitals.fid = firstInput.processingStart - firstInput.startTime;
          }
        }).observe({ entryTypes: ['first-input'] });
        
        // Cumulative Layout Shift
        let clsValue = 0;
        new PerformanceObserver((entryList) => {
          for (const entry of entryList.getEntries()) {
            if (!entry.hadRecentInput) {
              clsValue += entry.value;
            }
          }
          vitals.cls = clsValue;
        }).observe({ entryTypes: ['layout-shift'] });
        
        // Return metrics after short delay to collect data
        setTimeout(() => resolve(vitals), 1000);
      });
    });
    
    // Assert Web Vitals performance
    if (webVitals.lcp) expect(webVitals.lcp).toBeLessThan(2500);  // < 2.5s LCP
    if (webVitals.fid) expect(webVitals.fid).toBeLessThan(100);   // < 100ms FID
    if (webVitals.cls) expect(webVitals.cls).toBeLessThan(0.1);   // < 0.1 CLS
    
    // End performance measurement
    await performanceMonitor.endMeasurement('login-dashboard-flow');
    
    // Log comprehensive results
    console.log('Login → Dashboard Performance Results:', {
      navigation: `${navigationEnd - navigationStart}ms`,
      login: `${loginDuration}ms`,
      dashboardLoad: `${dashboardLoadTime}ms`,
      webVitals,
      pageLoadMetrics
    });
  });

  test('Order Creation Workflow Performance', async ({ page }) => {
    // Prerequisites: Login first
    await page.goto('/login');
    await page.fill('[data-testid="email-input"]', process.env.TEST_USER_EMAIL);
    await page.fill('[data-testid="password-input"]', process.env.TEST_USER_PASSWORD);
    await page.click('[data-testid="login-button"]');
    await page.waitForURL('/dashboard');
    
    // Start order creation performance measurement
    await performanceMonitor.startMeasurement('order-creation-workflow');
    
    // Step 1: Navigate to Orders page
    const ordersNavStart = Date.now();
    await page.click('[data-testid="nav-orders"]');
    await page.waitForURL('/orders');
    await page.waitForSelector('[data-testid="orders-list"]', { state: 'visible' });
    const ordersNavEnd = Date.now();
    
    expect(ordersNavEnd - ordersNavStart).toBeLessThan(2000); // < 2s navigation
    
    // Step 2: Open new order form
    const formOpenStart = Date.now();
    await page.click('[data-testid="new-order-button"]');
    await page.waitForSelector('[data-testid="order-form"]', { state: 'visible' });
    const formOpenEnd = Date.now();
    
    expect(formOpenEnd - formOpenStart).toBeLessThan(1000); // < 1s form load
    
    // Step 3: Fill order form with performance monitoring
    const formFillStart = Date.now();
    
    // Customer selection (async dropdown with search)
    await page.fill('[data-testid="customer-search"]', 'Test Customer');
    const customerSearchResponse = page.waitForResponse(response => 
      response.url().includes('/api/customers/search')
    );
    await customerSearchResponse;
    await page.click('[data-testid="customer-option-0"]');
    
    // Order details
    await page.fill('[data-testid="order-title"]', 'Performance Test Order');
    await page.fill('[data-testid="order-description"]', 'Automated performance testing order');
    await page.fill('[data-testid="estimated-budget"]', '50000');
    
    const formFillEnd = Date.now();
    expect(formFillEnd - formFillStart).toBeLessThan(3000); // < 3s form filling
    
    // Step 4: Submit order and measure API performance
    const submitStart = Date.now();
    
    const orderCreateResponse = page.waitForResponse(response => 
      response.url().includes('/api/orders') && response.request().method() === 'POST'
    );
    
    await page.click('[data-testid="submit-order"]');
    const createResponse = await orderCreateResponse;
    const submitEnd = Date.now();
    
    // Assert order creation performance
    const orderCreationTime = submitEnd - submitStart;
    expect(orderCreationTime).toBeLessThan(5000);  // < 5s order creation
    expect(createResponse.status()).toBe(201);
    
    // Step 5: Verify order appears in list
    await page.waitForURL('/orders');
    await page.waitForSelector('[data-testid="order-item-0"]', { state: 'visible' });
    
    // Measure list refresh performance
    const listRefreshMetrics = await page.evaluate(() => {
      const resourceEntries = performance.getEntriesByType('resource');
      const apiCalls = resourceEntries.filter(entry => entry.name.includes('/api/orders'));
      return {
        totalApiCalls: apiCalls.length,
        avgApiResponseTime: apiCalls.reduce((sum, call) => sum + call.duration, 0) / apiCalls.length
      };
    });
    
    expect(listRefreshMetrics.avgApiResponseTime).toBeLessThan(1000); // < 1s avg API response
    
    await performanceMonitor.endMeasurement('order-creation-workflow');
    
    console.log('Order Creation Performance Results:', {
      ordersNavigation: `${ordersNavEnd - ordersNavStart}ms`,
      formOpen: `${formOpenEnd - formOpenStart}ms`,
      formFill: `${formFillEnd - formFillStart}ms`,
      orderCreation: `${orderCreationTime}ms`,
      listRefresh: listRefreshMetrics
    });
  });

  test('Inventory Search and Update Performance', async ({ page }) => {
    // Prerequisites: Login
    await page.goto('/login');
    await page.fill('[data-testid="email-input"]', process.env.TEST_USER_EMAIL);
    await page.fill('[data-testid="password-input"]', process.env.TEST_USER_PASSWORD);
    await page.click('[data-testid="login-button"]');
    await page.waitForURL('/dashboard');
    
    await performanceMonitor.startMeasurement('inventory-operations');
    
    // Step 1: Navigate to inventory
    await page.click('[data-testid="nav-inventory"]');
    await page.waitForURL('/inventory');
    
    // Step 2: Test search performance with various query lengths
    const searchQueries = ['te', 'test', 'test material', 'test material for performance'];
    const searchResults = [];
    
    for (const query of searchQueries) {
      const searchStart = Date.now();
      
      await page.fill('[data-testid="inventory-search"]', '');
      await page.fill('[data-testid="inventory-search"]', query);
      
      // Wait for search API response
      const searchResponse = await page.waitForResponse(response => 
        response.url().includes('/api/inventory/search')
      );
      
      const searchEnd = Date.now();
      const searchTime = searchEnd - searchStart;
      
      searchResults.push({
        query,
        queryLength: query.length,
        responseTime: searchTime,
        statusCode: searchResponse.status()
      });
      
      // Assert search performance scales reasonably
      expect(searchTime).toBeLessThan(2000); // < 2s search response
      expect(searchResponse.status()).toBe(200);
    }
    
    // Analyze search performance scaling
    const avgSearchTime = searchResults.reduce((sum, result) => sum + result.responseTime, 0) / searchResults.length;
    expect(avgSearchTime).toBeLessThan(1500); // < 1.5s average search time
    
    // Step 3: Test inventory update performance
    await page.click('[data-testid="inventory-item-0"]');
    await page.waitForSelector('[data-testid="inventory-detail"]', { state: 'visible' });
    
    const updateStart = Date.now();
    await page.fill('[data-testid="quantity-input"]', '150');
    
    const updateResponse = page.waitForResponse(response => 
      response.url().includes('/api/inventory') && response.request().method() === 'PUT'
    );
    
    await page.click('[data-testid="update-inventory"]');
    await updateResponse;
    const updateEnd = Date.now();
    
    const updateTime = updateEnd - updateStart;
    expect(updateTime).toBeLessThan(3000); // < 3s inventory update
    
    await performanceMonitor.endMeasurement('inventory-operations');
    
    console.log('Inventory Performance Results:', {
      searchResults,
      averageSearchTime: `${avgSearchTime}ms`,
      inventoryUpdate: `${updateTime}ms`
    });
  });
});