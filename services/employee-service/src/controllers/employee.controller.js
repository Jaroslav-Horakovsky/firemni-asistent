const { employeeService } = require('../services/employee.service')
const { EmployeeModel } = require('../models/employee.model')

class EmployeeController {
  /**
   * Create a new employee
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async createEmployee(req, res) {
    try {
      console.log('[EmployeeController] Create employee request:', req.body?.email)

      // Validate request data
      const { error, value } = EmployeeModel.validateCreate(req.body)
      if (error) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details: error.details.map(detail => ({
            field: detail.path.join('.'),
            message: detail.message
          }))
        })
      }

      // Check if employee with same email or employee_number already exists
      const existingEmployee = await employeeService.checkEmployeeExists(
        value.email,
        value.employee_number
      )

      if (existingEmployee) {
        return res.status(400).json({
          success: false,
          error: existingEmployee.field === 'email' 
            ? 'Employee with this email already exists'
            : 'Employee with this employee number already exists',
          code: 'EMPLOYEE_EXISTS'
        })
      }

      // Create employee
      const employee = await employeeService.createEmployee(value, req.user.userId)

      res.status(201).json({
        success: true,
        message: 'Employee created successfully',
        data: {
          employee: {
            id: employee.id,
            employee_number: employee.employee_number,
            user_id: employee.user_id,
            first_name: employee.first_name,
            last_name: employee.last_name,
            email: employee.email,
            phone: employee.phone,
            position: employee.position,
            department: employee.department,
            employment_type: employee.employment_type,
            hourly_rate: employee.hourly_rate ? parseFloat(employee.hourly_rate) : null,
            hire_date: employee.hire_date,
            is_active: employee.is_active,
            skills: employee.skills,
            notes: employee.notes,
            created_at: employee.created_at,
            updated_at: employee.updated_at
          }
        }
      })
    } catch (error) {
      console.error('[EmployeeController] Create employee error:', error.message)
      
      if (error.message.includes('Unauthorized')) {
        return res.status(401).json({
          success: false,
          error: 'Unauthorized: Invalid token',
          code: 'UNAUTHORIZED'
        })
      }

      res.status(500).json({
        success: false,
        error: 'Failed to create employee',
        code: 'INTERNAL_SERVER_ERROR'
      })
    }
  }

  /**
   * Get employee by ID
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async getEmployee(req, res) {
    try {
      console.log('[EmployeeController] Get employee request:', req.params.id)

      // Validate employee ID
      const { error } = EmployeeModel.validateId(req.params.id)
      if (error) {
        return res.status(400).json({
          success: false,
          error: 'Invalid employee ID',
          code: 'VALIDATION_ERROR'
        })
      }

      const employee = await employeeService.getEmployeeById(req.params.id)

      if (!employee) {
        return res.status(404).json({
          success: false,
          error: 'Employee not found',
          code: 'EMPLOYEE_NOT_FOUND'
        })
      }

      res.json({
        success: true,
        data: {
          employee: {
            id: employee.id,
            employee_number: employee.employee_number,
            user_id: employee.user_id,
            first_name: employee.first_name,
            last_name: employee.last_name,
            email: employee.email,
            phone: employee.phone,
            position: employee.position,
            department: employee.department,
            employment_type: employee.employment_type,
            hourly_rate: employee.hourly_rate ? parseFloat(employee.hourly_rate) : null,
            hire_date: employee.hire_date,
            is_active: employee.is_active,
            skills: employee.skills,
            notes: employee.notes,
            created_at: employee.created_at,
            updated_at: employee.updated_at
          }
        }
      })
    } catch (error) {
      console.error('[EmployeeController] Get employee error:', error.message)
      
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve employee',
        code: 'INTERNAL_SERVER_ERROR'
      })
    }
  }

  /**
   * Get employees with pagination and filtering
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async getEmployees(req, res) {
    try {
      console.log('[EmployeeController] Get employees request:', req.query)

      // Validate query parameters
      const { error, value } = EmployeeModel.validateQuery(req.query)
      if (error) {
        return res.status(400).json({
          success: false,
          error: 'Invalid query parameters',
          code: 'VALIDATION_ERROR',
          details: error.details.map(detail => ({
            field: detail.path.join('.'),
            message: detail.message
          }))
        })
      }

      const result = await employeeService.getEmployees(value)

      res.json({
        success: true,
        data: {
          employees: result.employees.map(employee => ({
            id: employee.id,
            employee_number: employee.employee_number,
            user_id: employee.user_id,
            first_name: employee.first_name,
            last_name: employee.last_name,
            email: employee.email,
            phone: employee.phone,
            position: employee.position,
            department: employee.department,
            employment_type: employee.employment_type,
            hourly_rate: employee.hourly_rate ? parseFloat(employee.hourly_rate) : null,
            hire_date: employee.hire_date,
            is_active: employee.is_active,
            skills: employee.skills,
            notes: employee.notes,
            created_at: employee.created_at,
            updated_at: employee.updated_at
          })),
          pagination: result.pagination
        }
      })
    } catch (error) {
      console.error('[EmployeeController] Get employees error:', error.message)
      
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve employees',
        code: 'INTERNAL_SERVER_ERROR'
      })
    }
  }

  /**
   * Update employee
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async updateEmployee(req, res) {
    try {
      console.log('[EmployeeController] Update employee request:', req.params.id)

      // Validate employee ID
      const { error: idError } = EmployeeModel.validateId(req.params.id)
      if (idError) {
        return res.status(400).json({
          success: false,
          error: 'Invalid employee ID',
          code: 'VALIDATION_ERROR'
        })
      }

      // Validate update data
      const { error, value } = EmployeeModel.validateUpdate(req.body)
      if (error) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details: error.details.map(detail => ({
            field: detail.path.join('.'),
            message: detail.message
          }))
        })
      }

      // Check if employee exists
      const existingEmployee = await employeeService.getEmployeeById(req.params.id)
      if (!existingEmployee) {
        return res.status(404).json({
          success: false,
          error: 'Employee not found',
          code: 'EMPLOYEE_NOT_FOUND'
        })
      }

      // Check for email/employee_number conflicts if being updated
      if (value.email || value.employee_number) {
        const conflict = await employeeService.checkEmployeeExists(
          value.email || existingEmployee.email,
          value.employee_number || existingEmployee.employee_number,
          req.params.id // exclude current employee from check
        )

        if (conflict) {
          return res.status(400).json({
            success: false,
            error: conflict.field === 'email' 
              ? 'Employee with this email already exists'
              : 'Employee with this employee number already exists',
            code: 'EMPLOYEE_EXISTS'
          })
        }
      }

      const updatedEmployee = await employeeService.updateEmployee(
        req.params.id,
        value,
        req.user.userId
      )

      res.json({
        success: true,
        message: 'Employee updated successfully',
        data: {
          employee: {
            id: updatedEmployee.id,
            employee_number: updatedEmployee.employee_number,
            user_id: updatedEmployee.user_id,
            first_name: updatedEmployee.first_name,
            last_name: updatedEmployee.last_name,
            email: updatedEmployee.email,
            phone: updatedEmployee.phone,
            position: updatedEmployee.position,
            department: updatedEmployee.department,
            employment_type: updatedEmployee.employment_type,
            hourly_rate: updatedEmployee.hourly_rate ? parseFloat(updatedEmployee.hourly_rate) : null,
            hire_date: updatedEmployee.hire_date,
            is_active: updatedEmployee.is_active,
            skills: updatedEmployee.skills,
            notes: updatedEmployee.notes,
            created_at: updatedEmployee.created_at,
            updated_at: updatedEmployee.updated_at
          }
        }
      })
    } catch (error) {
      console.error('[EmployeeController] Update employee error:', error.message)
      
      res.status(500).json({
        success: false,
        error: 'Failed to update employee',
        code: 'INTERNAL_SERVER_ERROR'
      })
    }
  }

  /**
   * Delete employee (soft delete - set is_active = false)
   * @param {Object} req - Express request object  
   * @param {Object} res - Express response object
   */
  async deleteEmployee(req, res) {
    try {
      console.log('[EmployeeController] Delete employee request:', req.params.id)

      // Validate employee ID
      const { error } = EmployeeModel.validateId(req.params.id)
      if (error) {
        return res.status(400).json({
          success: false,
          error: 'Invalid employee ID',
          code: 'VALIDATION_ERROR'
        })
      }

      const deleted = await employeeService.deleteEmployee(req.params.id, req.user.userId)

      if (!deleted) {
        return res.status(404).json({
          success: false,
          error: 'Employee not found',
          code: 'EMPLOYEE_NOT_FOUND'
        })
      }

      res.json({
        success: true,
        message: 'Employee deactivated successfully'
      })
    } catch (error) {
      console.error('[EmployeeController] Delete employee error:', error.message)
      
      res.status(500).json({
        success: false,
        error: 'Failed to deactivate employee',
        code: 'INTERNAL_SERVER_ERROR'
      })
    }
  }

  /**
   * Get employees by department
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async getEmployeesByDepartment(req, res) {
    try {
      console.log('[EmployeeController] Get employees by department request:', req.params.department)

      // Validate query parameters
      const { error, value } = EmployeeModel.validateQuery(req.query)
      if (error) {
        return res.status(400).json({
          success: false,
          error: 'Invalid query parameters',
          code: 'VALIDATION_ERROR',
          details: error.details.map(detail => ({
            field: detail.path.join('.'),
            message: detail.message
          }))
        })
      }

      // Add department filter
      const queryOptions = { ...value, department: req.params.department }
      const result = await employeeService.getEmployees(queryOptions)

      res.json({
        success: true,
        data: {
          department: req.params.department,
          employees: result.employees.map(employee => ({
            id: employee.id,
            employee_number: employee.employee_number,
            first_name: employee.first_name,
            last_name: employee.last_name,
            email: employee.email,
            position: employee.position,
            employment_type: employee.employment_type,
            is_active: employee.is_active,
            created_at: employee.created_at
          })),
          pagination: result.pagination
        }
      })
    } catch (error) {
      console.error('[EmployeeController] Get employees by department error:', error.message)
      
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve department employees',
        code: 'INTERNAL_SERVER_ERROR'
      })
    }
  }

  /**
   * Get employee statistics
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async getEmployeeStats(req, res) {
    try {
      console.log('[EmployeeController] Get employee stats request')

      const stats = await employeeService.getEmployeeStats()

      res.json({
        success: true,
        data: {
          statistics: stats
        }
      })
    } catch (error) {
      console.error('[EmployeeController] Get employee stats error:', error.message)
      
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve employee statistics',
        code: 'INTERNAL_SERVER_ERROR'
      })
    }
  }
}

// Create singleton instance
const employeeController = new EmployeeController()

module.exports = {
  EmployeeController,
  employeeController
}