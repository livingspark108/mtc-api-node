import { Router } from 'express';
import PaymentController from '../controllers/payment.controller';
import { authenticate, requireRoles } from '../middleware/auth.middleware';
import { handleValidationErrors } from '../middleware/validation.middleware';
import { body, param, query } from 'express-validator';
import { USER_ROLES } from '../utils/constants';

const router = Router();
const paymentController = new PaymentController();

// Validation rules
const createPaymentOrderValidation = [
  body('clientId')
    .isInt({ min: 1 })
    .withMessage('Client ID must be a positive integer'),
  body('filingId')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Filing ID must be a positive integer'),
  body('amount')
    .isFloat({ min: 0.01 })
    .withMessage('Amount must be greater than 0'),
  body('currency')
    .optional()
    .isIn(['INR', 'USD', 'EUR'])
    .withMessage('Currency must be INR, USD, or EUR'),
  body('paymentMethod')
    .isIn(['card', 'upi', 'netbanking', 'wallet'])
    .withMessage('Invalid payment method'),
  body('description')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Description cannot exceed 500 characters'),
  body('customerEmail')
    .optional()
    .isEmail()
    .withMessage('Invalid email format'),
  body('customerPhone')
    .optional()
    .isMobilePhone('any')
    .withMessage('Invalid phone number'),
];

const verifyPaymentValidation = [
  body('razorpay_payment_id')
    .notEmpty()
    .withMessage('Razorpay payment ID is required'),
  body('razorpay_order_id')
    .notEmpty()
    .withMessage('Razorpay order ID is required'),
  body('razorpay_signature')
    .notEmpty()
    .withMessage('Razorpay signature is required'),
];

const refundValidation = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Payment ID must be a positive integer'),
  body('amount')
    .optional()
    .isFloat({ min: 0.01 })
    .withMessage('Refund amount must be greater than 0'),
  body('reason')
    .notEmpty()
    .isLength({ min: 5, max: 500 })
    .withMessage('Reason must be between 5 and 500 characters'),
  body('notes')
    .optional()
    .isObject()
    .withMessage('Notes must be an object'),
];

const paymentIdValidation = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Payment ID must be a positive integer'),
];

const clientIdValidation = [
  param('clientId')
    .isInt({ min: 1 })
    .withMessage('Client ID must be a positive integer'),
];

const filingIdValidation = [
  param('filingId')
    .isInt({ min: 1 })
    .withMessage('Filing ID must be a positive integer'),
];

const paginationValidation = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  query('status')
    .optional()
    .isIn(['initiated', 'pending', 'success', 'failed', 'refunded'])
    .withMessage('Invalid payment status'),
];

const statsValidation = [
  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('Start date must be in ISO 8601 format (YYYY-MM-DD)'),
  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('End date must be in ISO 8601 format (YYYY-MM-DD)'),
];

const revenueValidation = [
  query('period')
    .optional()
    .isIn(['daily', 'weekly', 'monthly'])
    .withMessage('Period must be daily, weekly, or monthly'),
  ...statsValidation,
];

/**
 * @swagger
 * components:
 *   schemas:
 *     Payment:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           description: Payment ID
 *         client_id:
 *           type: integer
 *           description: Client ID
 *         filing_id:
 *           type: integer
 *           nullable: true
 *           description: Filing ID (optional)
 *         amount:
 *           type: number
 *           format: decimal
 *           description: Payment amount
 *         currency:
 *           type: string
 *           enum: [INR, USD, EUR]
 *           description: Payment currency
 *         status:
 *           type: string
 *           enum: [initiated, pending, success, failed, refunded]
 *           description: Payment status
 *         payment_method:
 *           type: string
 *           enum: [card, upi, netbanking, wallet]
 *           description: Payment method
 *         gateway_provider:
 *           type: string
 *           description: Payment gateway provider
 *         gateway_transaction_id:
 *           type: string
 *           description: Gateway transaction ID
 *         gateway_response_json:
 *           type: object
 *           description: Gateway response data
 *         receipt_url:
 *           type: string
 *           nullable: true
 *           description: Receipt URL
 *         refund_amount:
 *           type: number
 *           format: decimal
 *           description: Refunded amount
 *         refund_reason:
 *           type: string
 *           nullable: true
 *           description: Refund reason
 *         created_at:
 *           type: string
 *           format: date-time
 *           description: Creation timestamp
 *         updated_at:
 *           type: string
 *           format: date-time
 *           description: Last update timestamp
 *     PaymentStats:
 *       type: object
 *       properties:
 *         totalRevenue:
 *           type: number
 *           description: Total revenue
 *         totalTransactions:
 *           type: integer
 *           description: Total number of transactions
 *         successfulTransactions:
 *           type: integer
 *           description: Number of successful transactions
 *         failedTransactions:
 *           type: integer
 *           description: Number of failed transactions
 *         refundedAmount:
 *           type: number
 *           description: Total refunded amount
 *         pendingAmount:
 *           type: number
 *           description: Total pending amount
 *         revenueByMethod:
 *           type: object
 *           description: Revenue breakdown by payment method
 *         transactionsByStatus:
 *           type: object
 *           description: Transaction count by status
 */

// Payment creation and verification routes
router.post('/create-order',
  authenticate,
  createPaymentOrderValidation,
  handleValidationErrors,
  paymentController.createPaymentOrder.bind(paymentController) as any
);

router.post('/verify',
  authenticate,
  verifyPaymentValidation,
  handleValidationErrors,
  paymentController.verifyPayment.bind(paymentController) as any
);

// Webhook route (no authentication required)
router.post('/webhook',
  paymentController.handleWebhook.bind(paymentController)
);

// Payment retrieval routes
router.get('/stats',
  authenticate,
  statsValidation,
  handleValidationErrors,
  paymentController.getPaymentStats.bind(paymentController) as any
);

router.get('/revenue',
  authenticate,
  requireRoles([USER_ROLES.ADMIN]),
  revenueValidation,
  handleValidationErrors,
  paymentController.getRevenueData.bind(paymentController) as any
);

router.get('/client/:clientId',
  authenticate,
  clientIdValidation,
  paginationValidation,
  handleValidationErrors,
  paymentController.getPaymentsByClient.bind(paymentController) as any
);

router.get('/filing/:filingId',
  authenticate,
  filingIdValidation,
  handleValidationErrors,
  paymentController.getPaymentsByFiling.bind(paymentController) as any
);

router.get('/:id',
  authenticate,
  paymentIdValidation,
  handleValidationErrors,
  paymentController.getPaymentById.bind(paymentController) as any
);

// Refund routes (Admin only)
router.post('/:id/refund',
  authenticate,
  requireRoles([USER_ROLES.ADMIN]),
  refundValidation,
  handleValidationErrors,
  paymentController.processRefund.bind(paymentController) as any
);

export default router; 