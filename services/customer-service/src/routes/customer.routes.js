const express = require('express')
const { customerController } = require('../controllers/customer.controller')
const { authenticateToken, requireRole } = require('../middleware/auth.middleware')

const router = express.Router()

/**
 * @swagger
 * components:
 *   schemas:
 *     Customer:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *           description: Unique customer identifier
 *         companyName:
 *           type: string
 *           description: Company name
 *           maxLength: 255
 *         contactPerson:
 *           type: string
 *           description: Primary contact person
 *           maxLength: 255
 *         email:
 *           type: string
 *           format: email
 *           description: Contact email address
 *           maxLength: 255
 *         phone:
 *           type: string
 *           description: Phone number
 *           maxLength: 50
 *         addressLine1:
 *           type: string
 *           description: Address line 1
 *           maxLength: 255
 *         addressLine2:
 *           type: string
 *           description: Address line 2
 *           maxLength: 255
 *         city:
 *           type: string
 *           description: City
 *           maxLength: 100
 *         postalCode:
 *           type: string
 *           description: Postal code
 *           maxLength: 20
 *         country:
 *           type: string
 *           description: Country
 *           default: Czech Republic
 *           maxLength: 100
 *         taxId:
 *           type: string
 *           description: Tax identification number
 *           maxLength: 50
 *         vatId:
 *           type: string
 *           description: VAT identification number
 *           maxLength: 50
 *         paymentTerms:
 *           type: integer
 *           description: Payment terms in days
 *           default: 14
 *           minimum: 0
 *           maximum: 365
 *         creditLimit:
 *           type: number
 *           format: decimal
 *           description: Credit limit
 *           default: 0.00
 *           minimum: 0
 *         isActive:
 *           type: boolean
 *           description: Whether customer is active
 *           default: true
 *         notes:
 *           type: string
 *           description: Additional notes
 *           maxLength: 5000
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: Creation timestamp
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: Last update timestamp
 *     
 *     CustomerInput:
 *       type: object
 *       required:
 *         - companyName
 *         - contactPerson
 *         - email
 *       properties:
 *         companyName:
 *           type: string
 *           minLength: 2
 *           maxLength: 255
 *         contactPerson:
 *           type: string
 *           minLength: 2
 *           maxLength: 255
 *         email:
 *           type: string
 *           format: email
 *           maxLength: 255
 *         phone:
 *           type: string
 *           maxLength: 50
 *         addressLine1:
 *           type: string
 *           maxLength: 255
 *         addressLine2:
 *           type: string
 *           maxLength: 255
 *         city:
 *           type: string
 *           maxLength: 100
 *         postalCode:
 *           type: string
 *           maxLength: 20
 *         country:
 *           type: string
 *           maxLength: 100
 *         taxId:
 *           type: string
 *           maxLength: 50
 *         vatId:
 *           type: string
 *           maxLength: 50
 *         paymentTerms:
 *           type: integer
 *           minimum: 0
 *           maximum: 365
 *         creditLimit:
 *           type: number
 *           format: decimal
 *           minimum: 0
 *         notes:
 *           type: string
 *           maxLength: 5000
 *
 *     CustomerList:
 *       type: object
 *       properties:
 *         customers:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/Customer'
 *         pagination:
 *           type: object
 *           properties:
 *             currentPage:
 *               type: integer
 *             totalPages:
 *               type: integer
 *             totalRecords:
 *               type: integer
 *             hasNextPage:
 *               type: boolean
 *             hasPreviousPage:
 *               type: boolean
 *             limit:
 *               type: integer
 *
 *     Error:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: false
 *         error:
 *           type: string
 *         code:
 *           type: string
 *         details:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               field:
 *                 type: string
 *               message:
 *                 type: string
 */

/**
 * @swagger
 * /customers:
 *   get:
 *     summary: Get customers with pagination and filtering
 *     tags: [Customers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: Number of customers per page
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *           maxLength: 255
 *         description: Search term (searches company name, contact person, email, etc.)
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
 *         description: Filter by active status
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [companyName, contactPerson, email, createdAt, updatedAt]
 *           default: createdAt
 *         description: Field to sort by
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *         description: Sort order
 *     responses:
 *       200:
 *         description: Customers retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/CustomerList'
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get('/', authenticateToken, customerController.getCustomers)

/**
 * @swagger
 * /customers/stats:
 *   get:
 *     summary: Get customer statistics
 *     tags: [Customers]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Customer statistics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     statistics:
 *                       type: object
 *                       properties:
 *                         totalCustomers:
 *                           type: integer
 *                         activeCustomers:
 *                           type: integer
 *                         inactiveCustomers:
 *                           type: integer
 *                         newCustomers30d:
 *                           type: integer
 *                         newCustomers7d:
 *                           type: integer
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get('/stats', authenticateToken, customerController.getCustomerStats)

/**
 * @swagger
 * /customers:
 *   post:
 *     summary: Create a new customer
 *     tags: [Customers]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CustomerInput'
 *     responses:
 *       201:
 *         description: Customer created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Customer created successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     customer:
 *                       $ref: '#/components/schemas/Customer'
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized
 *       409:
 *         description: Customer already exists
 *       500:
 *         description: Internal server error
 */
router.post('/', authenticateToken, customerController.createCustomer)

/**
 * @swagger
 * /customers/{id}:
 *   get:
 *     summary: Get customer by ID
 *     tags: [Customers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Customer ID
 *     responses:
 *       200:
 *         description: Customer retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     customer:
 *                       $ref: '#/components/schemas/Customer'
 *       400:
 *         description: Invalid customer ID
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Customer not found
 *       500:
 *         description: Internal server error
 */
router.get('/:id', authenticateToken, customerController.getCustomer)

/**
 * @swagger
 * /customers/{id}:
 *   put:
 *     summary: Update customer
 *     tags: [Customers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Customer ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               companyName:
 *                 type: string
 *                 minLength: 2
 *                 maxLength: 255
 *               contactPerson:
 *                 type: string
 *                 minLength: 2
 *                 maxLength: 255
 *               email:
 *                 type: string
 *                 format: email
 *                 maxLength: 255
 *               phone:
 *                 type: string
 *                 maxLength: 50
 *               addressLine1:
 *                 type: string
 *                 maxLength: 255
 *               addressLine2:
 *                 type: string
 *                 maxLength: 255
 *               city:
 *                 type: string
 *                 maxLength: 100
 *               postalCode:
 *                 type: string
 *                 maxLength: 20
 *               country:
 *                 type: string
 *                 maxLength: 100
 *               taxId:
 *                 type: string
 *                 maxLength: 50
 *               vatId:
 *                 type: string
 *                 maxLength: 50
 *               paymentTerms:
 *                 type: integer
 *                 minimum: 0
 *                 maximum: 365
 *               creditLimit:
 *                 type: number
 *                 format: decimal
 *                 minimum: 0
 *               isActive:
 *                 type: boolean
 *               notes:
 *                 type: string
 *                 maxLength: 5000
 *     responses:
 *       200:
 *         description: Customer updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Customer updated successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     customer:
 *                       $ref: '#/components/schemas/Customer'
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Customer not found
 *       409:
 *         description: Email conflict
 *       500:
 *         description: Internal server error
 */
router.put('/:id', authenticateToken, customerController.updateCustomer)

/**
 * @swagger
 * /customers/{id}:
 *   delete:
 *     summary: Delete customer (soft delete)
 *     tags: [Customers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Customer ID
 *     responses:
 *       200:
 *         description: Customer deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Customer deleted successfully
 *       400:
 *         description: Invalid customer ID
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Customer not found
 *       500:
 *         description: Internal server error
 */
router.delete('/:id', authenticateToken, customerController.deleteCustomer)

/**
 * @swagger
 * /customers/{id}/restore:
 *   post:
 *     summary: Restore deleted customer
 *     tags: [Customers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Customer ID
 *     responses:
 *       200:
 *         description: Customer restored successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Customer restored successfully
 *       400:
 *         description: Invalid customer ID
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Customer not found
 *       500:
 *         description: Internal server error
 */
router.post('/:id/restore', authenticateToken, requireRole(['admin']), customerController.restoreCustomer)

module.exports = router