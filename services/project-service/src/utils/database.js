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
      
      // Get database URL (prioritizes DATABASE_URL in development)
      const databaseUrl = await secretsManager.getDatabaseUrl('project')
      
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
  async query(text, params = [], retryCount = 0) {
    if (!this.pool || !this.isConnected) {
      console.log('[Database] Not connected, attempting to connect...')
      await this.connect()
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
      
      // Check if it's a connection error and we can retry
      const isConnectionError = error.code === 'ECONNREFUSED' || 
                               error.code === 'ENOTFOUND' || 
                               error.code === 'ETIMEDOUT' ||
                               error.message.includes('Connection terminated') ||
                               error.message.includes('connection is not open') ||
                               error.message.includes('Client has encountered a connection error')
      
      if (isConnectionError && retryCount < 2) {
        console.log(`[Database] Connection error detected, attempting reconnection (retry ${retryCount + 1}/2)`)
        
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
   * Create project tables indexes and triggers
   * @returns {Promise<void>}
   */
  async createProjectTables() {
    // Note: Project tables were already created via direct SQL
    // This method verifies they exist and creates indexes
    
    // Create indexes for performance
    const createIndexesQuery = `
      -- Projects indexes
      CREATE INDEX IF NOT EXISTS idx_projects_customer_id ON projects(customer_id);
      CREATE INDEX IF NOT EXISTS idx_projects_order_id ON projects(order_id) WHERE order_id IS NOT NULL;
      CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
      CREATE INDEX IF NOT EXISTS idx_projects_created_at ON projects(created_at);
      CREATE INDEX IF NOT EXISTS idx_projects_start_date ON projects(start_date) WHERE start_date IS NOT NULL;
      CREATE INDEX IF NOT EXISTS idx_projects_end_date ON projects(end_date) WHERE end_date IS NOT NULL;
      
      -- Project assignments indexes
      CREATE INDEX IF NOT EXISTS idx_project_assignments_project_id ON project_assignments(project_id);
      CREATE INDEX IF NOT EXISTS idx_project_assignments_employee_id ON project_assignments(employee_id);
      CREATE INDEX IF NOT EXISTS idx_project_assignments_created_at ON project_assignments(created_at);
      
      -- Project tasks indexes
      CREATE INDEX IF NOT EXISTS idx_project_tasks_project_id ON project_tasks(project_id);
      CREATE INDEX IF NOT EXISTS idx_project_tasks_assigned_employee_id ON project_tasks(assigned_employee_id) WHERE assigned_employee_id IS NOT NULL;
      CREATE INDEX IF NOT EXISTS idx_project_tasks_status ON project_tasks(status);
      CREATE INDEX IF NOT EXISTS idx_project_tasks_priority ON project_tasks(priority);
      CREATE INDEX IF NOT EXISTS idx_project_tasks_due_date ON project_tasks(due_date) WHERE due_date IS NOT NULL;
      CREATE INDEX IF NOT EXISTS idx_project_tasks_created_at ON project_tasks(created_at);
      
      -- Note: task_dependencies table removed in UUID migration
    `
    
    // Create updated_at trigger for projects and tasks
    const createUpdatedAtTrigger = `
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $$ language 'plpgsql';
      
      DROP TRIGGER IF EXISTS update_projects_updated_at ON projects;
      CREATE TRIGGER update_projects_updated_at
        BEFORE UPDATE ON projects
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
        
      DROP TRIGGER IF EXISTS update_project_tasks_updated_at ON project_tasks;
      CREATE TRIGGER update_project_tasks_updated_at
        BEFORE UPDATE ON project_tasks
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    `
    
    try {
      await this.query(createIndexesQuery)
      await this.query(createUpdatedAtTrigger)
      console.log('[Database] Project tables indexes and triggers created successfully')
    } catch (error) {
      console.error('[Database] Error creating project table indexes:', error.message)
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