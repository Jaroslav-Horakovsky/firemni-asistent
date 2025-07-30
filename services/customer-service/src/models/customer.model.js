const Joi = require('joi')
const { v4: uuidv4 } = require('uuid')

/**
 * Customer validation schemas
 */
const customerValidation = {
  create: Joi.object({
    companyName: Joi.string().min(2).max(255).required().messages({
      'string.empty': 'Company name is required',
      'string.min': 'Company name must be at least 2 characters long',
      'string.max': 'Company name cannot exceed 255 characters'
    }),
    contactPerson: Joi.string().min(2).max(255).required().messages({
      'string.empty': 'Contact person is required',
      'string.min': 'Contact person must be at least 2 characters long',
      'string.max': 'Contact person cannot exceed 255 characters'
    }),
    email: Joi.string().email().max(255).required().messages({
      'string.email': 'Please provide a valid email address',
      'string.empty': 'Email is required',
      'string.max': 'Email cannot exceed 255 characters'
    }),
    phone: Joi.string().max(50).optional().allow('').messages({
      'string.max': 'Phone number cannot exceed 50 characters'
    }),
    addressLine1: Joi.string().max(255).optional().allow('').messages({
      'string.max': 'Address line 1 cannot exceed 255 characters'
    }),
    addressLine2: Joi.string().max(255).optional().allow('').messages({
      'string.max': 'Address line 2 cannot exceed 255 characters'
    }),
    city: Joi.string().max(100).optional().allow('').messages({
      'string.max': 'City cannot exceed 100 characters'
    }),
    postalCode: Joi.string().max(20).optional().allow('').messages({
      'string.max': 'Postal code cannot exceed 20 characters'
    }),
    country: Joi.string().max(100).default('Czech Republic').messages({
      'string.max': 'Country cannot exceed 100 characters'
    }),
    taxId: Joi.string().max(50).optional().allow('').messages({
      'string.max': 'Tax ID cannot exceed 50 characters'
    }),
    vatId: Joi.string().max(50).optional().allow('').messages({
      'string.max': 'VAT ID cannot exceed 50 characters'
    }),
    paymentTerms: Joi.number().integer().min(0).max(365).default(14).messages({
      'number.base': 'Payment terms must be a number',
      'number.integer': 'Payment terms must be a whole number',
      'number.min': 'Payment terms cannot be negative',
      'number.max': 'Payment terms cannot exceed 365 days'
    }),
    creditLimit: Joi.number().precision(2).min(0).default(0.00).messages({
      'number.base': 'Credit limit must be a number',
      'number.min': 'Credit limit cannot be negative'
    }),
    notes: Joi.string().max(5000).optional().allow('').messages({
      'string.max': 'Notes cannot exceed 5000 characters'
    })
  }),

  update: Joi.object({
    companyName: Joi.string().min(2).max(255).optional().messages({
      'string.min': 'Company name must be at least 2 characters long',
      'string.max': 'Company name cannot exceed 255 characters'
    }),
    contactPerson: Joi.string().min(2).max(255).optional().messages({
      'string.min': 'Contact person must be at least 2 characters long',
      'string.max': 'Contact person cannot exceed 255 characters'
    }),
    email: Joi.string().email().max(255).optional().messages({
      'string.email': 'Please provide a valid email address',
      'string.max': 'Email cannot exceed 255 characters'
    }),
    phone: Joi.string().max(50).optional().allow('').messages({
      'string.max': 'Phone number cannot exceed 50 characters'
    }),
    addressLine1: Joi.string().max(255).optional().allow('').messages({
      'string.max': 'Address line 1 cannot exceed 255 characters'
    }),
    addressLine2: Joi.string().max(255).optional().allow('').messages({
      'string.max': 'Address line 2 cannot exceed 255 characters'
    }),
    city: Joi.string().max(100).optional().allow('').messages({
      'string.max': 'City cannot exceed 100 characters'
    }),
    postalCode: Joi.string().max(20).optional().allow('').messages({
      'string.max': 'Postal code cannot exceed 20 characters'
    }),
    country: Joi.string().max(100).optional().messages({
      'string.max': 'Country cannot exceed 100 characters'
    }),
    taxId: Joi.string().max(50).optional().allow('').messages({
      'string.max': 'Tax ID cannot exceed 50 characters'
    }),
    vatId: Joi.string().max(50).optional().allow('').messages({
      'string.max': 'VAT ID cannot exceed 50 characters'
    }),
    paymentTerms: Joi.number().integer().min(0).max(365).optional().messages({
      'number.base': 'Payment terms must be a number',
      'number.integer': 'Payment terms must be a whole number',
      'number.min': 'Payment terms cannot be negative',
      'number.max': 'Payment terms cannot exceed 365 days'
    }),
    creditLimit: Joi.number().precision(2).min(0).optional().messages({
      'number.base': 'Credit limit must be a number',
      'number.min': 'Credit limit cannot be negative'
    }),
    isActive: Joi.boolean().optional(),
    notes: Joi.string().max(5000).optional().allow('').messages({
      'string.max': 'Notes cannot exceed 5000 characters'
    })
  }),

  query: Joi.object({
    page: Joi.number().integer().min(1).default(1).messages({
      'number.base': 'Page must be a number',
      'number.integer': 'Page must be a whole number',
      'number.min': 'Page must be at least 1'
    }),
    limit: Joi.number().integer().min(1).max(100).default(20).messages({
      'number.base': 'Limit must be a number',
      'number.integer': 'Limit must be a whole number',
      'number.min': 'Limit must be at least 1',
      'number.max': 'Limit cannot exceed 100'
    }),
    search: Joi.string().max(255).optional().allow('').messages({
      'string.max': 'Search term cannot exceed 255 characters'
    }),
    isActive: Joi.boolean().optional(),
    sortBy: Joi.string().valid('companyName', 'contactPerson', 'email', 'createdAt', 'updatedAt').default('createdAt').messages({
      'any.only': 'Sort by must be one of: companyName, contactPerson, email, createdAt, updatedAt'
    }),
    sortOrder: Joi.string().valid('asc', 'desc').default('desc').messages({
      'any.only': 'Sort order must be either asc or desc'
    })
  }),

  id: Joi.string().uuid().required().messages({
    'string.guid': 'Please provide a valid customer ID',
    'string.empty': 'Customer ID is required'
  })
}

/**
 * Customer model class
 */
class CustomerModel {
  constructor(data = {}) {
    this.id = data.id || uuidv4()
    this.companyName = data.companyName || data.company_name
    this.contactPerson = data.contactPerson || data.contact_person
    this.email = data.email
    this.phone = data.phone
    this.addressLine1 = data.addressLine1 || data.address_line1
    this.addressLine2 = data.addressLine2 || data.address_line2
    this.city = data.city
    this.postalCode = data.postalCode || data.postal_code
    this.country = data.country || 'Czech Republic'
    this.taxId = data.taxId || data.tax_id
    this.vatId = data.vatId || data.vat_id
    this.paymentTerms = data.paymentTerms || data.payment_terms || 14
    this.creditLimit = data.creditLimit || data.credit_limit || 0.00
    this.isActive = data.isActive !== undefined ? data.isActive : (data.is_active !== undefined ? data.is_active : true)
    this.notes = data.notes
    this.createdAt = data.createdAt || data.created_at
    this.updatedAt = data.updatedAt || data.updated_at
  }

  /**
   * Convert model to database format (snake_case)
   * @returns {Object} Database format object
   */
  toDatabase() {
    return {
      id: this.id,
      company_name: this.companyName,
      contact_person: this.contactPerson,
      email: this.email,
      phone: this.phone || null,
      address_line1: this.addressLine1 || null,
      address_line2: this.addressLine2 || null,
      city: this.city || null,
      postal_code: this.postalCode || null,
      country: this.country,
      tax_id: this.taxId || null,
      vat_id: this.vatId || null,
      payment_terms: this.paymentTerms,
      credit_limit: this.creditLimit,
      is_active: this.isActive,
      notes: this.notes || null
    }
  }

  /**
   * Convert model to API response format (camelCase)
   * @returns {Object} API response format object
   */
  toJSON() {
    return {
      id: this.id,
      companyName: this.companyName,
      contactPerson: this.contactPerson,
      email: this.email,
      phone: this.phone,
      addressLine1: this.addressLine1,
      addressLine2: this.addressLine2,
      city: this.city,
      postalCode: this.postalCode,
      country: this.country,
      taxId: this.taxId,
      vatId: this.vatId,
      paymentTerms: this.paymentTerms,
      creditLimit: parseFloat(this.creditLimit || 0),
      isActive: this.isActive,
      notes: this.notes,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    }
  }

  /**
   * Validate customer data for creation
   * @param {Object} data - Customer data to validate
   * @returns {Object} Validation result
   */
  static validateCreate(data) {
    return customerValidation.create.validate(data, { abortEarly: false })
  }

  /**
   * Validate customer data for update
   * @param {Object} data - Customer data to validate
   * @returns {Object} Validation result
   */
  static validateUpdate(data) {
    return customerValidation.update.validate(data, { abortEarly: false })
  }

  /**
   * Validate query parameters
   * @param {Object} query - Query parameters to validate
   * @returns {Object} Validation result
   */
  static validateQuery(query) {
    return customerValidation.query.validate(query, { abortEarly: false })
  }

  /**
   * Validate customer ID
   * @param {string} id - Customer ID to validate
   * @returns {Object} Validation result
   */
  static validateId(id) {
    return customerValidation.id.validate(id)
  }

  /**
   * Create customer from database row
   * @param {Object} row - Database row
   * @returns {CustomerModel} Customer model instance
   */
  static fromDatabase(row) {
    return new CustomerModel(row)
  }

  /**
   * Get searchable fields for full-text search
   * @returns {Array<string>} Array of searchable field names
   */
  static getSearchableFields() {
    return ['company_name', 'contact_person', 'email', 'phone', 'city', 'tax_id', 'vat_id']
  }

  /**
   * Get sortable fields
   * @returns {Array<string>} Array of sortable field names
   */
  static getSortableFields() {
    return {
      companyName: 'company_name',
      contactPerson: 'contact_person', 
      email: 'email',
      createdAt: 'created_at',
      updatedAt: 'updated_at'
    }
  }
}

module.exports = {
  CustomerModel,
  customerValidation
}