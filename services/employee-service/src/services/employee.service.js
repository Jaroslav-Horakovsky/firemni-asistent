const { database } = require('../utils/database')
const { EmployeeModel } = require('../models/employee.model')

class EmployeeService {
  constructor() {
    this.db = database
  }

  /**
   * Create a new employee
   * @param {Object} employeeData - Employee data
   * @param {string} createdBy - User ID who created the employee
   * @returns {Promise<Object>} Created employee
   */
  async createEmployee(employeeData, createdBy) {
    console.log('[EmployeeService] Creating new employee:', employeeData.email)
    
    try {
      const result = await this.db.query(`
        INSERT INTO employees (
          employee_number, user_id, first_name, last_name, email, phone,
          position, department, employment_type, hourly_rate, hire_date,
          is_active, skills, notes
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14
        ) RETURNING *
      `, [
        employeeData.employee_number,
        employeeData.user_id || null,
        employeeData.first_name,
        employeeData.last_name,
        employeeData.email,
        employeeData.phone || null,
        employeeData.position || null,
        employeeData.department || null,
        employeeData.employment_type || 'full_time',
        employeeData.hourly_rate || null,
        employeeData.hire_date || null,
        employeeData.is_active !== undefined ? employeeData.is_active : true,
        JSON.stringify(employeeData.skills || []),
        employeeData.notes || null
      ])

      const employee = result.rows[0]
      console.log('[EmployeeService] Employee created successfully:', employee.id)
      return employee
    } catch (error) {
      console.error('[EmployeeService] Error creating employee:', error.message)
      throw error
    }
  }

  /**
   * Get employee by ID
   * @param {string} employeeId - Employee ID
   * @returns {Promise<Object|null>} Employee or null if not found
   */
  async getEmployeeById(employeeId) {
    console.log('[EmployeeService] Fetching employee by ID:', employeeId)
    
    try {
      const result = await this.db.query(`
        SELECT * FROM employees 
        WHERE id = $1
      `, [employeeId])

      const employee = result.rows.length > 0 ? result.rows[0] : null
      
      if (employee) {
        console.log('[EmployeeService] Employee found:', employee.email)
      } else {
        console.log('[EmployeeService] Employee not found:', employeeId)
      }

      return employee
    } catch (error) {
      console.error('[EmployeeService] Error fetching employee:', error.message)
      throw error
    }
  }

  /**
   * Get employees with pagination and filtering
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Employees with pagination info
   */
  async getEmployees(options = {}) {
    const {
      page = 1,
      limit = 20,
      department,
      employment_type,
      is_active,
      search,
      sortBy = 'created_at',
      sortOrder = 'desc'
    } = options

    console.log('[EmployeeService] Fetching employees with options:', options)

    try {
      const offset = (page - 1) * limit
      const whereConditions = []
      const queryParams = []
      let paramIndex = 1

      // Add filters
      if (department) {
        whereConditions.push(`department = $${paramIndex}`)
        queryParams.push(department)
        paramIndex++
      }

      if (employment_type) {
        whereConditions.push(`employment_type = $${paramIndex}`)
        queryParams.push(employment_type)
        paramIndex++
      }

      if (is_active !== undefined) {
        whereConditions.push(`is_active = $${paramIndex}`)
        queryParams.push(is_active)
        paramIndex++
      }

      if (search) {
        whereConditions.push(`(
          first_name ILIKE $${paramIndex} OR 
          last_name ILIKE $${paramIndex} OR 
          email ILIKE $${paramIndex} OR 
          employee_number ILIKE $${paramIndex} OR
          position ILIKE $${paramIndex}
        )`)
        queryParams.push(`%${search}%`)
        paramIndex++
      }

      const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : ''

      // Build ORDER BY clause
      const validSortFields = {
        'created_at': 'created_at',
        'updated_at': 'updated_at',
        'employee_number': 'employee_number',
        'first_name': 'first_name',
        'last_name': 'last_name',
        'email': 'email',
        'department': 'department',
        'employment_type': 'employment_type',
        'hire_date': 'hire_date'
      }
      const dbSortField = validSortFields[sortBy] || 'created_at'
      const orderClause = `ORDER BY ${dbSortField} ${sortOrder.toUpperCase()}`

      // Count total records
      const countQuery = `SELECT COUNT(*) FROM employees ${whereClause}`
      const countResult = await this.db.query(countQuery, queryParams.slice(0, paramIndex - 1))
      const totalRecords = parseInt(countResult.rows[0].count)

      // Fetch paginated results
      const dataQuery = `
        SELECT * FROM employees 
        ${whereClause}
        ${orderClause}
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `
      queryParams.push(limit, offset)

      const result = await this.db.query(dataQuery, queryParams)
      const employees = result.rows

      const totalPages = Math.ceil(totalRecords / limit)

      console.log(`[EmployeeService] Found ${employees.length} employees (page ${page}/${totalPages})`)

      return {
        employees,
        pagination: {
          currentPage: page,
          totalPages,
          totalRecords,
          hasNextPage: page < totalPages,
          hasPreviousPage: page > 1,
          limit
        }
      }
    } catch (error) {
      console.error('[EmployeeService] Error fetching employees:', error.message)
      throw error
    }
  }

  /**
   * Update employee
   * @param {string} employeeId - Employee ID
   * @param {Object} updateData - Data to update
   * @param {string} updatedBy - User ID who updated the employee
   * @returns {Promise<Object|null>} Updated employee or null if not found
   */
  async updateEmployee(employeeId, updateData, updatedBy) {
    console.log('[EmployeeService] Updating employee:', employeeId)
    
    try {
      // Build dynamic update query
      const updateFields = []
      const queryParams = []
      let paramIndex = 1

      // Add fields to update
      if (updateData.employee_number !== undefined) {
        updateFields.push(`employee_number = $${paramIndex}`)
        queryParams.push(updateData.employee_number)
        paramIndex++
      }

      if (updateData.user_id !== undefined) {
        updateFields.push(`user_id = $${paramIndex}`)
        queryParams.push(updateData.user_id)
        paramIndex++
      }

      if (updateData.first_name !== undefined) {
        updateFields.push(`first_name = $${paramIndex}`)
        queryParams.push(updateData.first_name)
        paramIndex++
      }

      if (updateData.last_name !== undefined) {
        updateFields.push(`last_name = $${paramIndex}`)
        queryParams.push(updateData.last_name)
        paramIndex++
      }

      if (updateData.email !== undefined) {
        updateFields.push(`email = $${paramIndex}`)
        queryParams.push(updateData.email)
        paramIndex++
      }

      if (updateData.phone !== undefined) {
        updateFields.push(`phone = $${paramIndex}`)
        queryParams.push(updateData.phone)
        paramIndex++
      }

      if (updateData.position !== undefined) {
        updateFields.push(`position = $${paramIndex}`)
        queryParams.push(updateData.position)
        paramIndex++
      }

      if (updateData.department !== undefined) {
        updateFields.push(`department = $${paramIndex}`)
        queryParams.push(updateData.department)
        paramIndex++
      }

      if (updateData.employment_type !== undefined) {
        updateFields.push(`employment_type = $${paramIndex}`)
        queryParams.push(updateData.employment_type)
        paramIndex++
      }

      if (updateData.hourly_rate !== undefined) {
        updateFields.push(`hourly_rate = $${paramIndex}`)
        queryParams.push(updateData.hourly_rate)
        paramIndex++
      }

      if (updateData.hire_date !== undefined) {
        updateFields.push(`hire_date = $${paramIndex}`)
        queryParams.push(updateData.hire_date)
        paramIndex++
      }

      if (updateData.is_active !== undefined) {
        updateFields.push(`is_active = $${paramIndex}`)
        queryParams.push(updateData.is_active)
        paramIndex++
      }

      if (updateData.skills !== undefined) {
        updateFields.push(`skills = $${paramIndex}`)
        queryParams.push(JSON.stringify(updateData.skills))
        paramIndex++
      }

      if (updateData.notes !== undefined) {
        updateFields.push(`notes = $${paramIndex}`)
        queryParams.push(updateData.notes)
        paramIndex++
      }

      if (updateFields.length === 0) {
        throw new Error('No fields to update')
      }

      // Add employee ID parameter
      queryParams.push(employeeId)

      const result = await this.db.query(`
        UPDATE employees 
        SET ${updateFields.join(', ')}, updated_at = NOW()
        WHERE id = $${paramIndex}
        RETURNING *
      `, queryParams)

      const employee = result.rows.length > 0 ? result.rows[0] : null
      
      if (employee) {
        console.log('[EmployeeService] Employee updated successfully:', employee.id)
      } else {
        console.log('[EmployeeService] Employee not found for update:', employeeId)
      }

      return employee
    } catch (error) {
      console.error('[EmployeeService] Error updating employee:', error.message)
      throw error
    }
  }

  /**
   * Delete employee (soft delete - set is_active = false)
   * @param {string} employeeId - Employee ID
   * @param {string} deletedBy - User ID who deleted the employee
   * @returns {Promise<boolean>} True if deleted, false if not found
   */
  async deleteEmployee(employeeId, deletedBy) {
    console.log('[EmployeeService] Soft deleting employee:', employeeId)
    
    try {
      const result = await this.db.query(`
        UPDATE employees 
        SET is_active = false, updated_at = NOW()
        WHERE id = $1 AND is_active = true
        RETURNING *
      `, [employeeId])

      const deleted = result.rows.length > 0
      
      if (deleted) {
        console.log('[EmployeeService] Employee soft deleted successfully:', employeeId)
      } else {
        console.log('[EmployeeService] Employee not found or already inactive:', employeeId)
      }

      return deleted
    } catch (error) {
      console.error('[EmployeeService] Error deleting employee:', error.message)
      throw error
    }
  }

  /**
   * Check if employee exists with given email or employee_number
   * @param {string} email - Employee email
   * @param {string} employeeNumber - Employee number
   * @param {string} excludeId - Employee ID to exclude from check (for updates)
   * @returns {Promise<Object|null>} Conflict info or null if no conflict
   */
  async checkEmployeeExists(email, employeeNumber, excludeId = null) {
    console.log('[EmployeeService] Checking employee existence:', email, employeeNumber)
    
    try {
      let query = `
        SELECT id, email, employee_number 
        FROM employees 
        WHERE (email = $1 OR employee_number = $2)
      `
      const params = [email, employeeNumber]

      if (excludeId) {
        query += ` AND id != $3`
        params.push(excludeId)
      }

      const result = await this.db.query(query, params)

      if (result.rows.length > 0) {
        const existing = result.rows[0]
        
        if (existing.email === email) {
          return { field: 'email', employee: existing }
        } else if (existing.employee_number === employeeNumber) {
          return { field: 'employee_number', employee: existing }
        }
      }

      return null
    } catch (error) {
      console.error('[EmployeeService] Error checking employee existence:', error.message)
      throw error
    }
  }

  /**
   * Get employee statistics
   * @returns {Promise<Object>} Employee statistics
   */
  async getEmployeeStats() {
    console.log('[EmployeeService] Fetching employee statistics')
    
    try {
      const result = await this.db.query(`
        SELECT 
          COUNT(*) as total_employees,
          COUNT(*) FILTER (WHERE is_active = true) as active_employees,
          COUNT(*) FILTER (WHERE is_active = false) as inactive_employees,
          COUNT(*) FILTER (WHERE employment_type = 'full_time') as full_time_employees,
          COUNT(*) FILTER (WHERE employment_type = 'part_time') as part_time_employees,
          COUNT(*) FILTER (WHERE employment_type = 'contractor') as contractor_employees,
          COUNT(*) FILTER (WHERE employment_type = 'external') as external_employees,
          COUNT(DISTINCT department) FILTER (WHERE department IS NOT NULL) as departments_count,
          AVG(hourly_rate) FILTER (WHERE hourly_rate IS NOT NULL) as average_hourly_rate,
          MIN(hire_date) FILTER (WHERE hire_date IS NOT NULL) as earliest_hire_date,
          MAX(hire_date) FILTER (WHERE hire_date IS NOT NULL) as latest_hire_date
        FROM employees
      `)

      const departmentResult = await this.db.query(`
        SELECT 
          department,
          COUNT(*) as employee_count,
          COUNT(*) FILTER (WHERE is_active = true) as active_count
        FROM employees 
        WHERE department IS NOT NULL
        GROUP BY department
        ORDER BY employee_count DESC
      `)

      const stats = result.rows[0]
      stats.departments = departmentResult.rows

      // Convert string counts to integers
      Object.keys(stats).forEach(key => {
        if (key.includes('count') || key.includes('employees')) {
          stats[key] = parseInt(stats[key]) || 0
        }
      })

      // Format average hourly rate
      if (stats.average_hourly_rate) {
        stats.average_hourly_rate = parseFloat(stats.average_hourly_rate)
      }

      console.log('[EmployeeService] Employee statistics calculated')
      return stats
    } catch (error) {
      console.error('[EmployeeService] Error fetching employee statistics:', error.message)
      throw error
    }
  }
}

// Create singleton instance
const employeeService = new EmployeeService()

module.exports = {
  EmployeeService,
  employeeService
}