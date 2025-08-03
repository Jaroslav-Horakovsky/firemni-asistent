const express = require('express')
const { employeeController } = require('../controllers/employee.controller')
const { authenticateToken } = require('../middleware/auth.middleware')

const router = express.Router()

/**
 * @swagger
 * components:
 *   schemas:
 *     Employee:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *           description: Unique employee identifier
 *         employee_number:
 *           type: string
 *           description: Human-readable employee number (e.g., EMP-001)
 *         user_id:
 *           type: string
 *           format: uuid
 *           description: User ID reference (logical reference)
 *         first_name:
 *           type: string
 *           description: Employee first name
 *         last_name:
 *           type: string
 *           description: Employee last name
 *         email:
 *           type: string
 *           format: email
 *           description: Employee email address
 *         phone:
 *           type: string
 *           description: Employee phone number
 *         position:
 *           type: string
 *           description: Job position (e.g., "Technik", "Elektrikář", "Manager")
 *         department:
 *           type: string
 *           description: Department (e.g., "IT", "Stavba", "Elektro")
 *         employment_type:
 *           type: string
 *           enum: [full_time, part_time, contractor, external]
 *           description: Type of employment
 *         hourly_rate:
 *           type: number
 *           format: decimal
 *           description: Hourly rate in CZK
 *         hire_date:
 *           type: string
 *           format: date
 *           description: Date of hire
 *         is_active:
 *           type: boolean
 *           description: Whether employee is currently active
 *         skills:
 *           type: array
 *           items:
 *             type: string
 *           description: Array of skills (e.g., ["elektrika", "it", "stavba"])
 *         notes:
 *           type: string
 *           description: Additional notes about the employee
 *         created_at:
 *           type: string
 *           format: date-time
 *         updated_at:
 *           type: string
 *           format: date-time
 *
 *     EmployeeInput:
 *       type: object
 *       required:
 *         - employee_number
 *         - first_name
 *         - last_name
 *         - email
 *       properties:
 *         employee_number:
 *           type: string
 *           description: Unique employee number
 *         user_id:
 *           type: string
 *           format: uuid
 *           description: Optional user ID reference
 *         first_name:
 *           type: string
 *           minLength: 1
 *           maxLength: 100
 *         last_name:
 *           type: string
 *           minLength: 1
 *           maxLength: 100
 *         email:
 *           type: string
 *           format: email
 *           maxLength: 255
 *         phone:
 *           type: string
 *           maxLength: 50
 *         position:
 *           type: string
 *           maxLength: 100
 *         department:
 *           type: string
 *           maxLength: 100
 *         employment_type:
 *           type: string
 *           enum: [full_time, part_time, contractor, external]
 *           default: full_time
 *         hourly_rate:
 *           type: number
 *           format: decimal
 *           minimum: 0
 *         hire_date:
 *           type: string
 *           format: date
 *         is_active:
 *           type: boolean
 *           default: true
 *         skills:
 *           type: array
 *           items:
 *             type: string
 *         notes:
 *           type: string
 *           maxLength: 5000
 */

/**
 * @swagger
 * /employees:
 *   get:
 *     summary: Get employees with pagination and filtering
 *     tags: [Employees]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *       - in: query
 *         name: department
 *         schema:
 *           type: string
 *         description: Filter by department
 *       - in: query
 *         name: employment_type
 *         schema:
 *           type: string
 *           enum: [full_time, part_time, contractor, external]
 *         description: Filter by employment type
 *       - in: query
 *         name: is_active
 *         schema:
 *           type: boolean
 *         description: Filter by active status
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *           maxLength: 255
 *         description: Search in name, email, or employee number
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [created_at, updated_at, first_name, last_name, employee_number, hire_date]
 *           default: created_at
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *     responses:
 *       200:
 *         description: Employees retrieved successfully
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get('/', authenticateToken, employeeController.getEmployees)

/**
 * @swagger
 * /employees/stats:
 *   get:
 *     summary: Get employee statistics
 *     tags: [Employees]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Employee statistics retrieved successfully
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get('/stats', authenticateToken, employeeController.getEmployeeStats)

/**
 * @swagger
 * /employees:
 *   post:
 *     summary: Create a new employee
 *     tags: [Employees]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/EmployeeInput'
 *           example:
 *             employee_number: "EMP-001"
 *             first_name: "Jan"
 *             last_name: "Novák"
 *             email: "jan.novak@company.com"
 *             phone: "+420 123 456 789"
 *             position: "Elektrikář"
 *             department: "Elektro"
 *             employment_type: "full_time"
 *             hourly_rate: 450.00
 *             hire_date: "2025-01-01"
 *             skills: ["elektrika", "průmyslové instalace"]
 *             notes: "Zkušený elektrikář s certifikáty"
 *     responses:
 *       201:
 *         description: Employee created successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       409:
 *         description: Employee number or email already exists
 *       500:
 *         description: Internal server error
 */
router.post('/', authenticateToken, employeeController.createEmployee)

/**
 * @swagger
 * /employees/{id}:
 *   get:
 *     summary: Get employee by ID
 *     tags: [Employees]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Employee retrieved successfully
 *       400:
 *         description: Invalid employee ID
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Employee not found
 *       500:
 *         description: Internal server error
 */
router.get('/:id', authenticateToken, employeeController.getEmployee)

/**
 * @swagger
 * /employees/{id}:
 *   put:
 *     summary: Update employee
 *     tags: [Employees]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/EmployeeInput'
 *     responses:
 *       200:
 *         description: Employee updated successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Employee not found
 *       409:
 *         description: Email already exists for another employee
 *       500:
 *         description: Internal server error
 */
router.put('/:id', authenticateToken, employeeController.updateEmployee)

/**
 * @swagger
 * /employees/{id}:
 *   delete:
 *     summary: Delete employee (soft delete - sets is_active to false)
 *     tags: [Employees]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Employee deactivated successfully
 *       400:
 *         description: Invalid employee ID
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Employee not found
 *       500:
 *         description: Internal server error
 */
router.delete('/:id', authenticateToken, employeeController.deleteEmployee)

/**
 * @swagger
 * /employees/department/{department}:
 *   get:
 *     summary: Get employees by department
 *     tags: [Employees]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: department
 *         required: true
 *         schema:
 *           type: string
 *         description: Department name
 *       - in: query
 *         name: is_active
 *         schema:
 *           type: boolean
 *           default: true
 *         description: Filter by active status
 *     responses:
 *       200:
 *         description: Department employees retrieved successfully
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get('/department/:department', authenticateToken, employeeController.getEmployeesByDepartment)

module.exports = router