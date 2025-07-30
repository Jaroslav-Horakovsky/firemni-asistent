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
      
      // Get database URL from Secret Manager or environment fallback
      const databaseUrl = await secretsManager.getSecret('DB_ORDER_SERVICE_URL')
      
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
   * Create orders tables if they don't exist
   * @returns {Promise<void>}
   */
  async createOrderTables() {
    // Create enum type for order status
    const createEnumQuery = `
      DO $$ BEGIN
        CREATE TYPE order_status_enum AS ENUM (
          'draft',
          'pending', 
          'confirmed',
          'processing',
          'shipped',
          'delivered',
          'cancelled',
          'refunded'
        );
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `

    // Create orders table
    const createOrdersTableQuery = `
      CREATE TABLE IF NOT EXISTS orders (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        order_number VARCHAR(50) UNIQUE NOT NULL,
        customer_id UUID NOT NULL,
        status order_status_enum DEFAULT 'draft',
        
        -- Financial data
        subtotal DECIMAL(12,2) NOT NULL DEFAULT 0,
        tax_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
        shipping_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
        discount_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
        total_amount DECIMAL(12,2) NOT NULL,
        currency VARCHAR(3) DEFAULT 'CZK',
        
        -- Shipping information
        shipping_address_line1 VARCHAR(255),
        shipping_address_line2 VARCHAR(255),
        shipping_city VARCHAR(100),
        shipping_postal_code VARCHAR(20),
        shipping_country VARCHAR(100) DEFAULT 'Czech Republic',
        
        -- Billing information  
        billing_address_line1 VARCHAR(255),
        billing_address_line2 VARCHAR(255),
        billing_city VARCHAR(100),
        billing_postal_code VARCHAR(20),
        billing_country VARCHAR(100) DEFAULT 'Czech Republic',
        
        -- Metadata
        notes TEXT,
        internal_notes TEXT,
        expected_delivery_date DATE,
        
        -- Audit fields
        created_by UUID,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        
        -- Constraints
        CONSTRAINT positive_subtotal CHECK (subtotal >= 0),
        CONSTRAINT positive_total CHECK (total_amount >= 0),
        CONSTRAINT valid_currency CHECK (currency IN ('CZK', 'EUR', 'USD'))
      );
    `

    // Create order_items table
    const createOrderItemsTableQuery = `
      CREATE TABLE IF NOT EXISTS order_items (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        
        -- Product information (denormalized for history)
        product_id VARCHAR(100),
        product_name VARCHAR(255) NOT NULL,
        product_description TEXT,
        product_sku VARCHAR(100),
        
        -- Pricing
        quantity INTEGER NOT NULL,
        unit_price DECIMAL(10,2) NOT NULL,
        total_price DECIMAL(10,2) NOT NULL,
        
        -- Metadata
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        
        -- Constraints
        CONSTRAINT positive_quantity CHECK (quantity > 0),
        CONSTRAINT positive_unit_price CHECK (unit_price >= 0),
        CONSTRAINT positive_total_price CHECK (total_price >= 0),
        CONSTRAINT calculated_total CHECK (total_price = quantity * unit_price)
      );
    `

    // Create order_status_history table
    const createOrderStatusHistoryTableQuery = `
      CREATE TABLE IF NOT EXISTS order_status_history (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        previous_status order_status_enum,
        new_status order_status_enum NOT NULL,
        changed_by UUID,
        change_reason TEXT,
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `

    // Create indexes for performance
    const createIndexesQuery = `
      -- Orders indexes
      CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);
      CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
      CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
      CREATE INDEX IF NOT EXISTS idx_orders_order_number ON orders(order_number);

      -- Order items indexes  
      CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
      CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON order_items(product_id);

      -- Status history indexes
      CREATE INDEX IF NOT EXISTS idx_order_status_history_order_id ON order_status_history(order_id);
      CREATE INDEX IF NOT EXISTS idx_order_status_history_created_at ON order_status_history(created_at);
    `

    // Create updated_at trigger
    const createUpdatedAtTrigger = `
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $$ language 'plpgsql';

      DROP TRIGGER IF EXISTS update_orders_updated_at ON orders;
      CREATE TRIGGER update_orders_updated_at
        BEFORE UPDATE ON orders
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    `

    try {
      await this.query(createEnumQuery)
      await this.query(createOrdersTableQuery)
      await this.query(createOrderItemsTableQuery)
      await this.query(createOrderStatusHistoryTableQuery)
      await this.query(createIndexesQuery)
      await this.query(createUpdatedAtTrigger)
      console.log('[Database] Orders tables and indexes created successfully')
    } catch (error) {
      console.error('[Database] Error creating orders tables:', error.message)
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