#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const services = [
  'order-service',
  'employee-service', 
  'project-service'
];

const oldQueryMethod = `  async query(text, params = []) {
    if (!this.pool || !this.isConnected) {
      throw new Error('Database not connected. Call connect() first.')
    }

    try {
      const start = Date.now()
      const result = await this.pool.query(text, params)
      const duration = Date.now() - start
      
      console.log(\`[Database] Query executed in \${duration}ms\`)
      return result
    } catch (error) {
      console.error('[Database] Query failed:', error.message)
      console.error('[Database] Query text:', text)
      console.error('[Database] Query params:', params)
      throw error
    }
  }`;

const newQueryMethod = `  async query(text, params = [], retryCount = 0) {
    if (!this.pool || !this.isConnected) {
      console.log('[Database] Not connected, attempting to connect...')
      await this.connect()
    }

    try {
      const start = Date.now()
      const result = await this.pool.query(text, params)
      const duration = Date.now() - start
      
      console.log(\`[Database] Query executed in \${duration}ms\`)
      return result
    } catch (error) {
      console.error('[Database] Query failed:', error.message)
      console.error('[Database] Query text:', text)
      console.error('[Database] Query params:', params)
      
      // Check if it's a connection error and we can retry
      const isConnectionError = error.code === 'ECONNREFUSED' || 
                               error.code === 'ENOTFOUND' || 
                               error.code === 'ETIMEDOUT' ||
                               error.message.includes('Connection terminated') ||
                               error.message.includes('connection is not open') ||
                               error.message.includes('Client has encountered a connection error')
      
      if (isConnectionError && retryCount < 2) {
        console.log(\`[Database] Connection error detected, attempting reconnection (retry \${retryCount + 1}/2)\`)
        
        // Reset connection state
        this.isConnected = false
        this.connectionAttempts = 0
        
        // Wait before retry with exponential backoff
        const delay = Math.min(1000 * Math.pow(2, retryCount), 5000)
        await this.delay(delay)
        
        try {
          await this.connect()
          return this.query(text, params, retryCount + 1)
        } catch (reconnectError) {
          console.error('[Database] Reconnection failed:', reconnectError.message)
        }
      }
      
      throw error
    }
  }`;

services.forEach(service => {
  const filePath = path.join(__dirname, 'services', service, 'src', 'utils', 'database.js');
  
  if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, 'utf8');
    
    if (content.includes(oldQueryMethod)) {
      content = content.replace(oldQueryMethod, newQueryMethod);
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`✅ Updated ${service}/src/utils/database.js`);
    } else {
      console.log(`⚠️  ${service}/src/utils/database.js - pattern not found or already updated`);
    }
  } else {
    console.log(`❌ ${service}/src/utils/database.js not found`);
  }
});

console.log('Database resilience update completed!');