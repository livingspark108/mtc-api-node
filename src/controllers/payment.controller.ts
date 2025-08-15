import { Request, Response } from 'express';
import PaymentService, { PaymentCreateData, PaymentVerificationData, RefundData } from '../services/payment.service';
import ResponseUtil from '../utils/response';
import logger from '../utils/logger';
import { AuthenticatedRequest } from '../types/auth.types';

export class PaymentController {
  private paymentService: PaymentService;

  constructor() {
    this.paymentService = new PaymentService();
  }

  /**
   * @swagger
   * /api/payments/create-order:
   *   post:
   *     summary: Create a payment order
   *     tags: [Payments]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - clientId
   *               - amount
   *               - paymentMethod
   *             properties:
   *               clientId:
   *                 type: integer
   *                 description: Client ID for the payment
   *               filingId:
   *                 type: integer
   *                 description: Optional filing ID
   *               amount:
   *                 type: number
   *                 minimum: 0.01
   *                 description: Payment amount
   *               currency:
   *                 type: string
   *                 default: INR
   *                 enum: [INR, USD, EUR]
   *                 description: Payment currency
   *               paymentMethod:
   *                 type: string
   *                 enum: [card, upi, netbanking, wallet]
   *                 description: Payment method
   *               description:
   *                 type: string
   *                 description: Payment description
   *               customerEmail:
   *                 type: string
   *                 format: email
   *                 description: Customer email
   *               customerPhone:
   *                 type: string
   *                 description: Customer phone number
   *     responses:
   *       201:
   *         description: Payment order created successfully
   *       400:
   *         description: Invalid request data
   *       401:
   *         description: Unauthorized
   *       500:
   *         description: Internal server error
   */
  createPaymentOrder = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const paymentData: PaymentCreateData = req.body;

      const result = await this.paymentService.createPaymentOrder(paymentData);

      ResponseUtil.success(res, result, 'Payment order created successfully', 201);
    } catch (error) {
      logger.error('Error creating payment order:', error);
      ResponseUtil.error(res, error instanceof Error ? error.message : 'Failed to create payment order', 500);
    }
  };

  /**
   * @swagger
   * /api/payments/verify:
   *   post:
   *     summary: Verify a payment
   *     tags: [Payments]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - razorpay_payment_id
   *               - razorpay_order_id
   *               - razorpay_signature
   *             properties:
   *               razorpay_payment_id:
   *                 type: string
   *                 description: Razorpay payment ID
   *               razorpay_order_id:
   *                 type: string
   *                 description: Razorpay order ID
   *               razorpay_signature:
   *                 type: string
   *                 description: Razorpay signature for verification
   *     responses:
   *       200:
   *         description: Payment verified successfully
   *       400:
   *         description: Invalid verification data
   *       401:
   *         description: Unauthorized
   *       500:
   *         description: Internal server error
   */
  verifyPayment = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const verificationData: PaymentVerificationData = req.body;

      const payment = await this.paymentService.verifyPayment(verificationData);

      ResponseUtil.success(res, payment, 'Payment verified successfully');
    } catch (error) {
      logger.error('Error verifying payment:', error);
      ResponseUtil.error(res, error instanceof Error ? error.message : 'Payment verification failed', 400);
    }
  };

  /**
   * @swagger
   * /api/payments/webhook:
   *   post:
   *     summary: Handle Razorpay webhooks
   *     tags: [Payments]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             description: Razorpay webhook payload
   *     responses:
   *       200:
   *         description: Webhook processed successfully
   *       400:
   *         description: Invalid webhook data
   *       500:
   *         description: Internal server error
   */
  handleWebhook = async (req: Request, res: Response): Promise<void> => {
    try {
      const webhookSignature = req.headers['x-razorpay-signature'] as string;
      const webhookBody = req.body;

      if (!webhookSignature) {
        ResponseUtil.error(res, 'Missing webhook signature', 400);
        return;
      }

      await this.paymentService.handleWebhook(webhookBody, webhookSignature);

      ResponseUtil.success(res, null, 'Webhook processed successfully');
    } catch (error) {
      logger.error('Error handling webhook:', error);
      ResponseUtil.error(res, error instanceof Error ? error.message : 'Webhook processing failed', 500);
    }
  };

  /**
   * @swagger
   * /api/payments/{id}:
   *   get:
   *     summary: Get payment by ID
   *     tags: [Payments]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   *         description: Payment ID
   *     responses:
   *       200:
   *         description: Payment retrieved successfully
   *       404:
   *         description: Payment not found
   *       401:
   *         description: Unauthorized
   *       403:
   *         description: Access denied
   *       500:
   *         description: Internal server error
   */
  getPaymentById = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;

      const payment = await this.paymentService.getPaymentById(
        parseInt(id),
        req.user!.id,
        req.user!.role
      );

      if (!payment) {
        ResponseUtil.error(res, 'Payment not found', 404);
        return;
      }

      ResponseUtil.success(res, payment, 'Payment retrieved successfully');
    } catch (error) {
      logger.error('Error getting payment:', error);
      const statusCode = error instanceof Error && error.message.includes('Access denied') ? 403 : 500;
      ResponseUtil.error(res, error instanceof Error ? error.message : 'Failed to get payment', statusCode);
    }
  };

  /**
   * @swagger
   * /api/payments/client/{clientId}:
   *   get:
   *     summary: Get payments by client ID
   *     tags: [Payments]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: clientId
   *         required: true
   *         schema:
   *           type: integer
   *         description: Client ID
   *       - in: query
   *         name: page
   *         schema:
   *           type: integer
   *           default: 1
   *         description: Page number
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *           default: 10
   *         description: Number of items per page
   *       - in: query
   *         name: status
   *         schema:
   *           type: string
   *           enum: [initiated, pending, success, failed, refunded]
   *         description: Filter by payment status
   *     responses:
   *       200:
   *         description: Payments retrieved successfully
   *       401:
   *         description: Unauthorized
   *       403:
   *         description: Access denied
   *       500:
   *         description: Internal server error
   */
  getPaymentsByClient = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { clientId } = req.params;
      const { page = 1, limit = 10, status } = req.query;

      const options = {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        status: status as string,
      };

      const payments = await this.paymentService.getPaymentsByClient(
        parseInt(clientId),
        options,
        req.user!.id,
        req.user!.role
      );

      ResponseUtil.success(res, payments, 'Payments retrieved successfully');
    } catch (error) {
      logger.error('Error getting payments by client:', error);
      const statusCode = error instanceof Error && error.message.includes('Access denied') ? 403 : 500;
      ResponseUtil.error(res, error instanceof Error ? error.message : 'Failed to get payments', statusCode);
    }
  };

  /**
   * @swagger
   * /api/payments/filing/{filingId}:
   *   get:
   *     summary: Get payments by filing ID
   *     tags: [Payments]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: filingId
   *         required: true
   *         schema:
   *           type: integer
   *         description: Filing ID
   *     responses:
   *       200:
   *         description: Payments retrieved successfully
   *       401:
   *         description: Unauthorized
   *       403:
   *         description: Access denied
   *       500:
   *         description: Internal server error
   */
  getPaymentsByFiling = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { filingId } = req.params;

      const payments = await this.paymentService.getPaymentsByFiling(
        parseInt(filingId),
        req.user!.id,
        req.user!.role
      );

      ResponseUtil.success(res, payments, 'Payments retrieved successfully');
    } catch (error) {
      logger.error('Error getting payments by filing:', error);
      const statusCode = error instanceof Error && error.message.includes('Access denied') ? 403 : 500;
      ResponseUtil.error(res, error instanceof Error ? error.message : 'Failed to get payments', statusCode);
    }
  };

  /**
   * @swagger
   * /api/payments/{id}/refund:
   *   post:
   *     summary: Process a refund (Admin only)
   *     tags: [Payments]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   *         description: Payment ID
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - reason
   *             properties:
   *               amount:
   *                 type: number
   *                 minimum: 0.01
   *                 description: Refund amount (full refund if not provided)
   *               reason:
   *                 type: string
   *                 description: Reason for refund
   *               notes:
   *                 type: object
   *                 description: Additional notes
   *     responses:
   *       200:
   *         description: Refund processed successfully
   *       400:
   *         description: Invalid refund data
   *       401:
   *         description: Unauthorized
   *       403:
   *         description: Access denied
   *       500:
   *         description: Internal server error
   */
  processRefund = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { amount, reason, notes } = req.body;

      const refundData: RefundData = {
        paymentId: parseInt(id),
        amount,
        reason,
        notes,
      };

      const payment = await this.paymentService.processRefund(refundData);

      ResponseUtil.success(res, payment, 'Refund processed successfully');
    } catch (error) {
      logger.error('Error processing refund:', error);
      ResponseUtil.error(res, error instanceof Error ? error.message : 'Failed to process refund', 500);
    }
  };

  /**
   * @swagger
   * /api/payments/stats:
   *   get:
   *     summary: Get payment statistics
   *     tags: [Payments]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: startDate
   *         schema:
   *           type: string
   *           format: date
   *         description: Start date for statistics (YYYY-MM-DD)
   *       - in: query
   *         name: endDate
   *         schema:
   *           type: string
   *           format: date
   *         description: End date for statistics (YYYY-MM-DD)
   *     responses:
   *       200:
   *         description: Payment statistics retrieved successfully
   *       400:
   *         description: Invalid date format
   *       401:
   *         description: Unauthorized
   *       500:
   *         description: Internal server error
   */
  getPaymentStats = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { startDate, endDate } = req.query;

      let parsedStartDate: Date | undefined;
      let parsedEndDate: Date | undefined;

      if (startDate) {
        parsedStartDate = new Date(startDate as string);
        if (isNaN(parsedStartDate.getTime())) {
          ResponseUtil.error(res, 'Invalid start date format', 400);
          return;
        }
      }

      if (endDate) {
        parsedEndDate = new Date(endDate as string);
        if (isNaN(parsedEndDate.getTime())) {
          ResponseUtil.error(res, 'Invalid end date format', 400);
          return;
        }
      }

      const stats = await this.paymentService.getPaymentStats(
        req.user!.id,
        req.user!.role,
        parsedStartDate,
        parsedEndDate
      );

      ResponseUtil.success(res, stats, 'Payment statistics retrieved successfully');
    } catch (error) {
      logger.error('Error getting payment stats:', error);
      ResponseUtil.error(res, error instanceof Error ? error.message : 'Failed to get payment statistics', 500);
    }
  };

  /**
   * @swagger
   * /api/payments/revenue:
   *   get:
   *     summary: Get revenue data (Admin only)
   *     tags: [Payments]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: period
   *         schema:
   *           type: string
   *           enum: [daily, weekly, monthly]
   *           default: monthly
   *         description: Revenue period grouping
   *       - in: query
   *         name: startDate
   *         schema:
   *           type: string
   *           format: date
   *         description: Start date (YYYY-MM-DD)
   *       - in: query
   *         name: endDate
   *         schema:
   *           type: string
   *           format: date
   *         description: End date (YYYY-MM-DD)
   *     responses:
   *       200:
   *         description: Revenue data retrieved successfully
   *       400:
   *         description: Invalid parameters
   *       401:
   *         description: Unauthorized
   *       403:
   *         description: Access denied
   *       500:
   *         description: Internal server error
   */
  getRevenueData = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { period = 'monthly', startDate, endDate } = req.query;

      // Only admin can access revenue data
      if (req.user!.role !== 'admin') {
        ResponseUtil.error(res, 'Access denied: Admin only', 403);
        return;
      }

      let parsedStartDate: Date;
      let parsedEndDate: Date;

      if (startDate && endDate) {
        parsedStartDate = new Date(startDate as string);
        parsedEndDate = new Date(endDate as string);

        if (isNaN(parsedStartDate.getTime()) || isNaN(parsedEndDate.getTime())) {
          ResponseUtil.error(res, 'Invalid date format', 400);
          return;
        }
      } else {
        // Default to last 30 days
        parsedEndDate = new Date();
        parsedStartDate = new Date();
        parsedStartDate.setDate(parsedStartDate.getDate() - 30);
      }

      const stats = await this.paymentService.getPaymentStats(
        req.user!.id,
        req.user!.role,
        parsedStartDate,
        parsedEndDate
      );

      // Format response for revenue data
      const revenueData = {
        totalRevenue: stats.totalRevenue,
        period: period as string,
        startDate: parsedStartDate.toISOString().split('T')[0],
        endDate: parsedEndDate.toISOString().split('T')[0],
        revenueByMethod: stats.revenueByMethod,
        transactionStats: {
          total: stats.totalTransactions,
          successful: stats.successfulTransactions,
          failed: stats.failedTransactions,
          successRate: stats.totalTransactions > 0 ? 
            ((stats.successfulTransactions / stats.totalTransactions) * 100).toFixed(2) + '%' : '0%',
        },
        refundStats: {
          totalRefunded: stats.refundedAmount,
          refundRate: stats.totalRevenue > 0 ? 
            ((stats.refundedAmount / (stats.totalRevenue + stats.refundedAmount)) * 100).toFixed(2) + '%' : '0%',
        },
      };

      ResponseUtil.success(res, revenueData, 'Revenue data retrieved successfully');
    } catch (error) {
      logger.error('Error getting revenue data:', error);
      ResponseUtil.error(res, error instanceof Error ? error.message : 'Failed to get revenue data', 500);
    }
  };
}

export default PaymentController;