const { Pool } = require('pg')
const { secretsManager } = require('./secrets')

class DatabaseManager {
  constructor() {
    this.pool = null
    this.isConnected = false
    this.connectionAttempts = 0
    this.maxRetries = 5
    this.retryDelay = 2000
  }

  /**
   * Initialize database connection pool
   * @returns {Promise<void>}
   */
  async connect() {
    try {
      if (this.pool && this.isConnected) {
        console.log('[Database] Already connected')
        return
      }

      console.log('[Database] Connecting to PostgreSQL...')
      
      // Get database URL from Secret Manager
      const databaseUrl = await secretsManager.getDatabaseUrl('customer')
      
      // Create connection pool
      this.pool = new Pool({
        connectionString: databaseUrl,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
        max: 20, // Maximum number of connections
        min: 5,  // Minimum number of connections
        idleTimeoutMillis: 30000, // Close idle connections after 30 seconds
        connectionTimeoutMillis: 10000, // Wait 10 seconds for connection
        acquireTimeoutMillis: 60000, // Wait 60 seconds for connection from pool
        statementTimeout: 30000, // Query timeout 30 seconds
        query_timeout: 30000,
        allowExitOnIdle: false
      })

      // Test connection
      const client = await this.pool.connect()
      const result = await client.query('SELECT NOW()')
      client.release()

      this.isConnected = true
      this.connectionAttempts = 0
      
      console.log('[Database] Successfully connected to PostgreSQL')
      console.log(`[Database] Connection test result: ${result.rows[0].now}`)
      
      // Set up error handlers
      this.pool.on('error', (err) => {
        console.error('[Database] Pool error:', err.message)
        this.isConnected = false
      })

      this.pool.on('connect', () => {
        console.log('[Database] New client connected')
      })

      this.pool.on('remove', () => {
        console.log('[Database] Client removed from pool')
      })

    } catch (error) {
      console.error('[Database] Connection failed:', error.message)
      this.isConnected = false
      
      if (this.connectionAttempts < this.maxRetries) {
        this.connectionAttempts++
        console.log(`[Database] Retrying connection (${this.connectionAttempts}/${this.maxRetries}) in ${this.retryDelay}ms...`)
        
        await this.delay(this.retryDelay)
        return this.connect()
      }
      
      throw new Error(`Database connection failed after ${this.maxRetries} attempts: ${error.message}`)
    }
  }

  /**
   * Execute a query
   * @param {string} text - SQL query text
   * @param {Array} params - Query parameters
   * @returns {Promise<Object>} Query result
   */
  async query(text, params = []) {
    if (!this.pool || !this.isConnected) {
      throw new Error('Database not connected. Call connect() first.')
    }

    try {
      const start = Date.now()
      const result = await this.pool.query(text, params)
      const duration = Date.now() - start
      
      console.log(`[Database] Query executed in ${duration}ms`)
      return result
    } catch (error) {
      console.error('[Database] Query failed:', error.message)
      console.error('[Database] Query text:', text)
      console.error('[Database] Query params:', params)
      throw error
    }
  }

  /**
   * Get a client from the pool for transactions
   * @returns {Promise<Object>} Database client
   */
  async getClient() {
    if (!this.pool || !this.isConnected) {
      throw new Error('Database not connected. Call connect() first.')
    }

    return await this.pool.connect()
  }

  /**
   * Execute queries in a transaction
   * @param {Function} callback - Function containing queries to execute
   * @returns {Promise<any>} Result of callback
   */
  async transaction(callback) {
    const client = await this.getClient()
    
    try {
      await client.query('BEGIN')
      const result = await callback(client)
      await client.query('COMMIT')
      return result
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  }

  /**
   * Create customers table if it doesn't exist
   * @returns {Promise<void>}
   */
  async createCustomersTable() {
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS customers (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        company_name VARCHAR(255) NOT NULL,
        contact_person VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        phone VARCHAR(50),
        address_line1 VARCHAR(255),
        address_line2 VARCHAR(255),
        city VARCHAR(100),
        postal_code VARCHAR(20),
        country VARCHAR(100) DEFAULT 'Czech Republic',
        tax_id VARCHAR(50),
        vat_id VARCHAR(50),
        payment_terms INTEGER DEFAULT 14,
        credit_limit DECIMAL(12,2) DEFAULT 0.00,
        is_active BOOLEAN NOT NULL DEFAULT true,
        notes TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `

    const createIndexesQuery = `
      CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);
      CREATE INDEX IF NOT EXISTS idx_customers_company_name ON customers(company_name);
      CREATE INDEX IF NOT EXISTS idx_customers_is_active ON customers(is_active);
      CREATE INDEX IF NOT EXISTS idx_customers_created_at ON customers(created_at);
      CREATE INDEX IF NOT EXISTS idx_customers_tax_id ON customers(tax_id);
    `

    const createUpdatedAtTrigger = `
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $$ language 'plpgsql';

      DROP TRIGGER IF EXISTS update_customers_updated_at ON customers;
      CREATE TRIGGER update_customers_updated_at
        BEFORE UPDATE ON customers
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    `

    try {
      await this.query(createTableQuery)
      await this.query(createIndexesQuery)
      await this.query(createUpdatedAtTrigger)
      console.log('[Database] Customers table and indexes created successfully')
    } catch (error) {
      console.error('[Database] Error creating customers table:', error.message)
      throw error
    }
  }

  /**
   * Health check for database connection
   * @returns {Promise<boolean>} True if healthy
   */
  async healthCheck() {
    try {
      if (!this.pool || !this.isConnected) {
        return false
      }

      const result = await this.query('SELECT 1 as health_check')
      return result.rows.length > 0 && result.rows[0].health_check === 1
    } catch (error) {
      console.error('[Database] Health check failed:', error.message)
      return false
    }
  }

  /**
   * Get connection pool stats
   * @returns {Object} Pool statistics
   */
  getPoolStats() {
    if (!this.pool) {
      return { error: 'Pool not initialized' }
    }

    return {
      totalCount: this.pool.totalCount,
      idleCount: this.pool.idleCount,
      waitingCount: this.pool.waitingCount,
      isConnected: this.isConnected
    }
  }

  /**
   * Close all database connections
   * @returns {Promise<void>}
   */
  async disconnect() {
    if (this.pool) {
      await this.pool.end()
      this.pool = null
      this.isConnected = false
      console.log('[Database] Disconnected from PostgreSQL')
    }
  }

  /**
   * Utility function for delays
   * @param {number} ms - Milliseconds to delay
   * @returns {Promise<void>}
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

// Create singleton instance
const database = new DatabaseManager()

module.exports = {
  DatabaseManager,
  database
}