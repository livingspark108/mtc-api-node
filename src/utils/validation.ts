import { body, param, query } from 'express-validator';
import type { ValidationChain } from 'express-validator';
import { USER_ROLES, FILING_TYPES, FILING_STATUS, DOCUMENT_TYPES } from './constants';

// Common validation patterns
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^[6-9]\d{9}$/;
const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
const AADHAR_REGEX = /^\d{12}$/;
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

// Custom validators
export const customValidators = {
  // Email validation
  isValidEmail: (value: string): boolean => {
    return EMAIL_REGEX.test(value);
  },

  // Phone validation (Indian format)
  isValidPhone: (value: string): boolean => {
    return PHONE_REGEX.test(value);
  },

  // PAN validation
  isValidPAN: (value: string): boolean => {
    return PAN_REGEX.test(value.toUpperCase());
  },

  // Aadhar validation
  isValidAadhar: (value: string): boolean => {
    return AADHAR_REGEX.test(value);
  },

  // Strong password validation
  isStrongPassword: (value: string): boolean => {
    return PASSWORD_REGEX.test(value);
  },

  // Date validation (not in future)
  isValidPastDate: (value: string): boolean => {
    const date = new Date(value);
    return date <= new Date();
  },

  // Tax year validation (format: YYYY-YYYY)
  isValidTaxYear: (value: string): boolean => {
    const taxYearRegex = /^\d{4}-\d{4}$/;
    if (!taxYearRegex.test(value)) return false;
    
    const [startYear, endYear] = value.split('-').map(Number);
    if (!startYear || !endYear) return false;
    return endYear === startYear + 1;
  },

  // File type validation
  isValidFileType: (mimetype: string): boolean => {
    const allowedTypes = [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/jpg',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];
    return allowedTypes.includes(mimetype);
  },
};

// Common validation chains
export const validationChains = {
  // User validation
  userRegistration: [
    body('email')
      .isEmail()
      .normalizeEmail()
      .withMessage('Please provide a valid email address'),
    body('password')
      .custom(customValidators.isStrongPassword)
      .withMessage('Password must be at least 8 characters with uppercase, lowercase, number, and special character'),
    body('fullName')
      .isLength({ min: 2, max: 100 })
      .trim()
      .withMessage('Full name must be between 2 and 100 characters'),
    body('phone')
      .optional()
      .custom(customValidators.isValidPhone)
      .withMessage('Please provide a valid Indian phone number'),
    body('role')
      .optional()
      .isIn(Object.values(USER_ROLES))
      .withMessage('Invalid user role'),
  ],

  userLogin: [
    body('email')
      .isEmail()
      .normalizeEmail()
      .withMessage('Please provide a valid email address'),
    body('password')
      .notEmpty()
      .withMessage('Password is required'),
  ],

  // Client validation
  clientProfile: [
    body('panNumber')
      .custom(customValidators.isValidPAN)
      .withMessage('Please provide a valid PAN number'),
    body('aadharNumber')
      .optional()
      .custom(customValidators.isValidAadhar)
      .withMessage('Please provide a valid Aadhar number'),
    body('dateOfBirth')
      .isISO8601()
      .custom(customValidators.isValidPastDate)
      .withMessage('Please provide a valid date of birth'),
    body('occupation')
      .optional()
      .isLength({ min: 2, max: 100 })
      .trim()
      .withMessage('Occupation must be between 2 and 100 characters'),
    body('annualIncome')
      .optional()
      .isFloat({ min: 0 })
      .withMessage('Annual income must be a positive number'),
  ],

  // Filing validation
  filingCreation: [
    body('taxYear')
      .custom(customValidators.isValidTaxYear)
      .withMessage('Please provide a valid tax year (YYYY-YYYY format)'),
    body('filingType')
      .isIn(Object.values(FILING_TYPES))
      .withMessage('Invalid filing type'),
    body('dueDate')
      .optional()
      .isISO8601()
      .withMessage('Please provide a valid due date'),
  ],

  filingUpdate: [
    body('status')
      .optional()
      .isIn(Object.values(FILING_STATUS))
      .withMessage('Invalid filing status'),
    body('notes')
      .optional()
      .isLength({ max: 1000 })
      .trim()
      .withMessage('Notes cannot exceed 1000 characters'),
  ],

  // Document validation
  documentUpload: [
    body('documentType')
      .isIn(Object.values(DOCUMENT_TYPES))
      .withMessage('Invalid document type'),
    body('filingId')
      .isInt({ min: 1 })
      .withMessage('Valid filing ID is required'),
  ],

  // Payment validation
  paymentCreation: [
    body('amount')
      .isFloat({ min: 1 })
      .withMessage('Amount must be greater than 0'),
    body('currency')
      .optional()
      .isIn(['INR', 'USD'])
      .withMessage('Invalid currency'),
    body('paymentMethod')
      .isIn(['card', 'upi', 'netbanking', 'wallet'])
      .withMessage('Invalid payment method'),
  ],

  // Pagination validation
  pagination: [
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Page must be a positive integer'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100'),
  ],

  // ID parameter validation
  idParam: [
    param('id')
      .isInt({ min: 1 })
      .withMessage('Valid ID is required'),
  ],

  // Password change validation
  passwordChange: [
    body('currentPassword')
      .notEmpty()
      .withMessage('Current password is required'),
    body('newPassword')
      .custom(customValidators.isStrongPassword)
      .withMessage('New password must be at least 8 characters with uppercase, lowercase, number, and special character'),
    body('confirmPassword')
      .custom((value, { req }) => {
        if (value !== req.body.newPassword) {
          throw new Error('Password confirmation does not match');
        }
        return true;
      }),
  ],

  // Email verification
  emailVerification: [
    body('token')
      .isLength({ min: 10 })
      .withMessage('Valid verification token is required'),
  ],

  // Password reset
  passwordReset: [
    body('email')
      .isEmail()
      .normalizeEmail()
      .withMessage('Please provide a valid email address'),
  ],

  passwordResetConfirm: [
    body('token')
      .isLength({ min: 10 })
      .withMessage('Valid reset token is required'),
    body('newPassword')
      .custom(customValidators.isStrongPassword)
      .withMessage('Password must be at least 8 characters with uppercase, lowercase, number, and special character'),
  ],
};

// Validation helper functions
export const validationHelpers = {
  // Sanitize input
  sanitizeInput: (input: string): string => {
    return input.trim().replace(/[<>]/g, '');
  },

  // Validate file upload
  validateFileUpload: (file: Express.Multer.File): { valid: boolean; error?: string } => {
    if (!file) {
      return { valid: false, error: 'No file uploaded' };
    }

    if (file.size > 10 * 1024 * 1024) { // 10MB
      return { valid: false, error: 'File size exceeds 10MB limit' };
    }

    if (!customValidators.isValidFileType(file.mimetype)) {
      return { valid: false, error: 'Invalid file type' };
    }

    return { valid: true };
  },

  // Validate JSON structure
  validateJSON: (jsonString: string): { valid: boolean; data?: any; error?: string } => {
    try {
      const data = JSON.parse(jsonString);
      return { valid: true, data };
    } catch (error) {
      return { valid: false, error: 'Invalid JSON format' };
    }
  },

  // Validate date range
  validateDateRange: (startDate: string, endDate: string): boolean => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    return start <= end;
  },

  // Validate Indian postal code
  validatePincode: (pincode: string): boolean => {
    const pincodeRegex = /^[1-9][0-9]{5}$/;
    return pincodeRegex.test(pincode);
  },
};

export default validationChains; 