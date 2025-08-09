#!/usr/bin/env node
const axios = require('axios');
const { performance } = require('perf_hooks');

async function benchmarkService(name, url, requests = 10) {
    console.log(`\n=== ${name} Performance Benchmark ===`);
    console.log(`URL: ${url}`);
    console.log(`Requests: ${requests}`);
    
    const times = [];
    let successCount = 0;
    let errorCount = 0;
    
    for (let i = 0; i < requests; i++) {
        try {
            const start = performance.now();
            const response = await axios.get(url, { timeout: 5000 });
            const end = performance.now();
            
            const responseTime = end - start;
            times.push(responseTime);
            successCount++;
            
            if (i === 0) {
                console.log(`First response: ${JSON.stringify(response.data).substring(0, 100)}...`);
            }
        } catch (error) {
            errorCount++;
            console.log(`Request ${i + 1} failed:`, error.message);
        }
    }
    
    if (times.length > 0) {
        const avg = times.reduce((a, b) => a + b, 0) / times.length;
        const min = Math.min(...times);
        const max = Math.max(...times);
        const median = times.sort((a, b) => a - b)[Math.floor(times.length / 2)];
        
        console.log(`Results:`);
        console.log(`  Success: ${successCount}/${requests} requests`);
        console.log(`  Errors: ${errorCount} requests`);
        console.log(`  Average: ${avg.toFixed(2)}ms`);
        console.log(`  Median: ${median.toFixed(2)}ms`);
        console.log(`  Min: ${min.toFixed(2)}ms`);
        console.log(`  Max: ${max.toFixed(2)}ms`);
        
        return {
            service: name,
            url,
            requests,
            successCount,
            errorCount,
            avgTime: avg,
            medianTime: median,
            minTime: min,
            maxTime: max
        };
    } else {
        console.log(`All requests failed!`);
        return { service: name, url, error: 'All requests failed' };
    }
}

async function runComprehensiveBenchmark() {
    console.log('🚀 COMPREHENSIVE PERFORMANCE BENCHMARK - RELACE 46');
    console.log('===============================================');
    
    const services = [
        { name: 'API Gateway', url: 'http://localhost:3000/health' },
        { name: 'User Service', url: 'http://localhost:3001/health' },
        { name: 'Customer Service', url: 'http://localhost:3002/health' },
        { name: 'Order Service', url: 'http://localhost:3003/health' },
        { name: 'Employee Service', url: 'http://localhost:3004/health' },
        { name: 'Project Service', url: 'http://localhost:3005/health' }
    ];
    
    const results = [];
    
    for (const service of services) {
        const result = await benchmarkService(service.name, service.url, 20);
        results.push(result);
        
        // Small delay between service tests
        await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    console.log('\n📊 PERFORMANCE SUMMARY');
    console.log('=====================');
    results.filter(r => !r.error).forEach(result => {
        console.log(`${result.service}: ${result.avgTime.toFixed(2)}ms avg (${result.successCount}/${result.requests} success)`);
    });
    
    return results;
}

async function loadTest(url, concurrent = 5, totalRequests = 50) {
    console.log(`\n🔥 LOAD TEST: ${url}`);
    console.log(`Concurrent: ${concurrent}, Total: ${totalRequests}`);
    
    const startTime = performance.now();
    const promises = [];
    const results = [];
    
    for (let i = 0; i < totalRequests; i++) {
        const promise = axios.get(url, { timeout: 10000 })
            .then(response => {
                results.push({ success: true, time: performance.now() });
            })
            .catch(error => {
                results.push({ success: false, error: error.message, time: performance.now() });
            });
        
        promises.push(promise);
        
        // Control concurrency
        if (promises.length >= concurrent) {
            await Promise.all(promises);
            promises.length = 0;
        }
    }
    
    if (promises.length > 0) {
        await Promise.all(promises);
    }
    
    const endTime = performance.now();
    const totalTime = endTime - startTime;
    const successCount = results.filter(r => r.success).length;
    const errorCount = results.length - successCount;
    
    console.log(`Load test completed in ${totalTime.toFixed(2)}ms`);
    console.log(`Success: ${successCount}/${totalRequests}`);
    console.log(`Errors: ${errorCount}`);
    console.log(`Requests per second: ${(totalRequests / (totalTime / 1000)).toFixed(2)}`);
    
    return {
        totalTime,
        successCount,
        errorCount,
        rps: totalRequests / (totalTime / 1000)
    };
}

async function main() {
    try {
        // Individual service performance
        await runComprehensiveBenchmark();
        
        // Load testing critical services
        console.log('\n🔥 LOAD TESTING PHASE');
        console.log('====================');
        
        await loadTest('http://localhost:3000/health', 10, 100); // API Gateway
        await loadTest('http://localhost:3005/health', 5, 50);   // Project Service
        
    } catch (error) {
        console.error('Benchmark failed:', error);
    }
}

if (require.main === module) {
    main();
}