import Razorpay from 'razorpay';
import crypto from 'crypto';
import { Payment, PaymentAttributes } from '../models/payment.model';
import { ClientRepository } from '../repositories/client.repository';
import { FilingRepository } from '../repositories/filing.repository';
import logger from '../utils/logger';
import { USER_ROLES } from '../utils/constants';

export interface PaymentCreateData {
  clientId: number;
  filingId?: number;
  amount: number;
  currency?: string;
  paymentMethod: 'card' | 'upi' | 'netbanking' | 'wallet';
  description?: string;
  customerEmail?: string;
  customerPhone?: string;
}

export interface PaymentVerificationData {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

export interface RefundData {
  paymentId: number;
  amount?: number; // Partial refund amount, full refund if not provided
  reason: string;
  notes?: Record<string, any>;
}

export interface PaymentStats {
  totalRevenue: number;
  totalTransactions: number;
  successfulTransactions: number;
  failedTransactions: number;
  refundedAmount: number;
  pendingAmount: number;
  revenueByMethod: Record<string, number>;
  transactionsByStatus: Record<string, number>;
}

export class PaymentService {
  private razorpay: Razorpay;
  private clientRepository: ClientRepository;
  private filingRepository: FilingRepository;

  constructor() {
    // Initialize Razorpay only if credentials are available
    const razorpayKeyId = process.env.RAZORPAY_KEY_ID;
    const razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET;
    
    if (!razorpayKeyId || !razorpayKeySecret) {
      console.warn('Razorpay credentials not found. Payment functionality will be limited.');
      // Initialize with dummy instance - will throw error if payment methods are called
      this.razorpay = null as any;
    } else {
      this.razorpay = new Razorpay({
        key_id: razorpayKeyId,
        key_secret: razorpayKeySecret,
      });
    }

    this.clientRepository = new ClientRepository();
    this.filingRepository = new FilingRepository();
  }

  private validateRazorpayInstance(): void {
    if (!this.razorpay) {
      throw new Error('Razorpay is not properly configured. Please check RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET environment variables.');
    }
  }

  async createPaymentOrder(data: PaymentCreateData): Promise<{ order: any; payment: Payment }> {
    try {
      // Validate Razorpay is properly configured
      this.validateRazorpayInstance();
      
      // Validate client exists
      const client = await this.clientRepository.findById(data.clientId);
      if (!client) {
        throw new Error('Client not found');
      }

      // Validate filing if provided
      if (data.filingId) {
        const filing = await this.filingRepository.findById(data.filingId);
        if (!filing) {
          throw new Error('Filing not found');
        }
        if (filing.clientId !== data.clientId) {
          throw new Error('Filing does not belong to the specified client');
        }
      }

      // Create Razorpay order
      const orderOptions = {
        amount: Math.round(data.amount * 100), // Convert to paise
        currency: data.currency || 'INR',
        receipt: `payment_${Date.now()}_${data.clientId}`,
        notes: {
          client_id: data.clientId.toString(),
          filing_id: data.filingId?.toString() || '',
          description: data.description || 'Tax filing service payment',
        },
      };

      const razorpayOrder = await this.razorpay.orders.create(orderOptions);

      // Create payment record
      const payment = await Payment.create({
        client_id: data.clientId,
        filing_id: data.filingId,
        amount: data.amount,
        currency: data.currency || 'INR',
        status: 'initiated',
        payment_method: data.paymentMethod,
        gateway_provider: 'razorpay',
        gateway_transaction_id: razorpayOrder.id,
        gateway_response_json: razorpayOrder,
        refund_amount: 0,
      });

      logger.info(`Payment order created: ${payment.id} for client ${data.clientId}`);

      return {
        order: {
          id: razorpayOrder.id,
          amount: razorpayOrder.amount,
          currency: razorpayOrder.currency,
          receipt: razorpayOrder.receipt,
          key: process.env.RAZORPAY_KEY_ID,
        },
        payment,
      };
    } catch (error) {
      logger.error('Error creating payment order:', error);
      throw error;
    }
  }

  async verifyPayment(verificationData: PaymentVerificationData): Promise<Payment> {
    try {
      // Validate Razorpay is properly configured
      this.validateRazorpayInstance();
      
      // Find payment by order ID
      const payment = await Payment.findByGatewayTransactionId(verificationData.razorpay_order_id);
      if (!payment) {
        throw new Error('Payment not found');
      }

      // Verify signature
      const isValidSignature = this.verifyRazorpaySignature(
        verificationData.razorpay_order_id,
        verificationData.razorpay_payment_id,
        verificationData.razorpay_signature
      );

      if (!isValidSignature) {
        // Update payment status to failed
        await Payment.updatePaymentStatus(payment.id, 'failed', {
          error: 'Invalid signature',
          verification_data: verificationData,
        });
        throw new Error('Payment verification failed: Invalid signature');
      }

      // Get payment details from Razorpay
      const razorpayPayment = await this.razorpay.payments.fetch(verificationData.razorpay_payment_id);

      // Update payment status
      await Payment.updatePaymentStatus(payment.id, 'success', {
        razorpay_payment: razorpayPayment,
        verification_data: verificationData,
      });

      // Get updated payment
      const updatedPayment = await Payment.findByPk(payment.id);
      if (!updatedPayment) {
        throw new Error('Failed to retrieve updated payment');
      }

      logger.info(`Payment verified successfully: ${payment.id}`);
      return updatedPayment;
    } catch (error) {
      logger.error('Error verifying payment:', error);
      throw error;
    }
  }

  async handleWebhook(webhookBody: any, webhookSignature: string): Promise<void> {
    try {
      // Verify webhook signature
      const isValidWebhook = this.verifyWebhookSignature(webhookBody, webhookSignature);
      if (!isValidWebhook) {
        throw new Error('Invalid webhook signature');
      }

      const { event, payload } = webhookBody;

      switch (event) {
        case 'payment.captured':
          await this.handlePaymentCaptured(payload.payment.entity);
          break;
        case 'payment.failed':
          await this.handlePaymentFailed(payload.payment.entity);
          break;
        case 'refund.created':
          await this.handleRefundCreated(payload.refund.entity);
          break;
        case 'refund.processed':
          await this.handleRefundProcessed(payload.refund.entity);
          break;
        default:
          logger.info(`Unhandled webhook event: ${event}`);
      }
    } catch (error) {
      logger.error('Error handling webhook:', error);
      throw error;
    }
  }

  async processRefund(refundData: RefundData): Promise<Payment> {
    try {
      // Validate Razorpay is properly configured
      this.validateRazorpayInstance();
      
      // Find payment
      const payment = await Payment.findByPk(refundData.paymentId);
      if (!payment) {
        throw new Error('Payment not found');
      }

      if (payment.status !== 'success') {
        throw new Error('Only successful payments can be refunded');
      }

      // Calculate refund amount
      const refundAmount = refundData.amount || payment.amount;
      if (refundAmount > payment.amount) {
        throw new Error('Refund amount cannot exceed payment amount');
      }

      if (payment.refund_amount + refundAmount > payment.amount) {
        throw new Error('Total refund amount cannot exceed payment amount');
      }

      // Create refund with Razorpay
      const refundOptions: any = {
        amount: Math.round(refundAmount * 100), // Convert to paise
        notes: {
          reason: refundData.reason,
          ...refundData.notes,
        },
      };

      // Get the payment ID from gateway response
      const razorpayPaymentId = payment.gateway_response_json?.razorpay_payment?.id ||
                               payment.gateway_response_json?.verification_data?.razorpay_payment_id;

      if (!razorpayPaymentId) {
        throw new Error('Razorpay payment ID not found');
      }

      const razorpayRefund = await this.razorpay.payments.refund(razorpayPaymentId, refundOptions);

      // Update payment record
      const newRefundAmount = payment.refund_amount + refundAmount;
      const newStatus = newRefundAmount >= payment.amount ? 'refunded' : 'success';

      await Payment.update(
        {
          status: newStatus,
          refund_amount: newRefundAmount,
          refund_reason: refundData.reason,
          gateway_response_json: {
            ...payment.gateway_response_json,
            refunds: [...(payment.gateway_response_json?.refunds || []), razorpayRefund],
          },
        },
        { where: { id: payment.id } }
      );

      // Get updated payment
      const updatedPayment = await Payment.findByPk(payment.id);
      if (!updatedPayment) {
        throw new Error('Failed to retrieve updated payment');
      }

      logger.info(`Refund processed: ${refundAmount} for payment ${payment.id}`);
      return updatedPayment;
    } catch (error) {
      logger.error('Error processing refund:', error);
      throw error;
    }
  }

  async getPaymentById(id: number, userId: number, userRole: string): Promise<Payment | null> {
    try {
      const payment = await Payment.findByPk(id);
      if (!payment) {
        return null;
      }

      // Check access permissions
      await this.checkPaymentAccess(payment, userId, userRole);
      return payment;
    } catch (error) {
      logger.error('Error getting payment:', error);
      throw error;
    }
  }

  async getPaymentsByClient(
    clientId: number,
    options: { page?: number; limit?: number; status?: string },
    userId: number,
    userRole: string
  ): Promise<Payment[]> {
    try {
      // Check if user has access to client
      if (userRole === USER_ROLES.CUSTOMER) {
        const client = await this.clientRepository.findById(clientId);
        if (!client || client.userId !== userId) {
          throw new Error('Access denied: You can only view your own payments');
        }
      }

      const payments = await Payment.findByClientId(clientId, options);
      return payments;
    } catch (error) {
      logger.error('Error getting payments by client:', error);
      throw error;
    }
  }

  async getPaymentsByFiling(
    filingId: number,
    userId: number,
    userRole: string
  ): Promise<Payment[]> {
    try {
      // Check access to filing
      const filing = await this.filingRepository.findById(filingId);
      if (!filing) {
        throw new Error('Filing not found');
      }

      if (userRole === USER_ROLES.CUSTOMER && filing.clientId !== userId) {
        throw new Error('Access denied: You can only view payments for your own filings');
      }

      if (userRole === USER_ROLES.CA && filing.caId !== userId) {
        throw new Error('Access denied: You can only view payments for assigned filings');
      }

      const payments = await Payment.findByFilingId(filingId);
      return payments;
    } catch (error) {
      logger.error('Error getting payments by filing:', error);
      throw error;
    }
  }

  async getPaymentStats(
    userId: number,
    userRole: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<PaymentStats> {
    try {
      // Get all payments based on user role
      let payments: Payment[] = [];

      if (userRole === USER_ROLES.ADMIN) {
        // Admin can see all payments
        payments = await Payment.findAll({
          where: startDate && endDate ? {
            created_at: { [require('sequelize').Op.between]: [startDate, endDate] }
          } : {},
        });
      } else if (userRole === USER_ROLES.CA) {
        // CA can see payments for their assigned filings
        const assignedFilings = await this.filingRepository.findAll({ caId: userId });
        const filingIds = assignedFilings.data.map((f: any) => f.id);
        
        payments = await Payment.findAll({
          where: {
            filing_id: { [require('sequelize').Op.in]: filingIds },
            ...(startDate && endDate ? {
              created_at: { [require('sequelize').Op.between]: [startDate, endDate] }
            } : {}),
          },
        });
      } else {
        // Customer can see their own payments
        const clientIds = await this.clientRepository.findAll({ userId }, 50, 0).then(result => 
          result.clients.map((c: any) => c.id)
        );
        
        payments = await Payment.findAll({
          where: {
            client_id: { [require('sequelize').Op.in]: clientIds },
            ...(startDate && endDate ? {
              created_at: { [require('sequelize').Op.between]: [startDate, endDate] }
            } : {}),
          },
        });
      }

      // Calculate statistics
      const stats: PaymentStats = {
        totalRevenue: 0,
        totalTransactions: payments.length,
        successfulTransactions: 0,
        failedTransactions: 0,
        refundedAmount: 0,
        pendingAmount: 0,
        revenueByMethod: {},
        transactionsByStatus: {},
      };

      payments.forEach(payment => {
        // Revenue calculation
        if (payment.status === 'success') {
          stats.totalRevenue += payment.amount - payment.refund_amount;
          stats.successfulTransactions++;
        }

        // Status counts
        stats.transactionsByStatus[payment.status] = 
          (stats.transactionsByStatus[payment.status] || 0) + 1;

        // Failed transactions
        if (payment.status === 'failed') {
          stats.failedTransactions++;
        }

        // Pending amount
        if (payment.status === 'pending' || payment.status === 'initiated') {
          stats.pendingAmount += payment.amount;
        }

        // Refunded amount
        stats.refundedAmount += payment.refund_amount;

        // Revenue by method
        if (payment.status === 'success') {
          stats.revenueByMethod[payment.payment_method] = 
            (stats.revenueByMethod[payment.payment_method] || 0) + 
            (payment.amount - payment.refund_amount);
        }
      });

      return stats;
    } catch (error) {
      logger.error('Error getting payment stats:', error);
      throw error;
    }
  }

  private verifyRazorpaySignature(orderId: string, paymentId: string, signature: string): boolean {
    try {
      const expectedSignature = crypto
        .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || '')
        .update(`${orderId}|${paymentId}`)
        .digest('hex');

      return expectedSignature === signature;
    } catch (error) {
      logger.error('Error verifying Razorpay signature:', error);
      return false;
    }
  }

  private verifyWebhookSignature(body: any, signature: string): boolean {
    try {
      const expectedSignature = crypto
        .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET || '')
        .update(JSON.stringify(body))
        .digest('hex');

      return expectedSignature === signature;
    } catch (error) {
      logger.error('Error verifying webhook signature:', error);
      return false;
    }
  }

  private async handlePaymentCaptured(paymentEntity: any): Promise<void> {
    try {
      const payment = await Payment.findByGatewayTransactionId(paymentEntity.order_id);
      if (payment) {
        await Payment.updatePaymentStatus(payment.id, 'success', { captured_payment: paymentEntity });
        logger.info(`Payment captured via webhook: ${payment.id}`);
      }
    } catch (error) {
      logger.error('Error handling payment captured webhook:', error);
    }
  }

  private async handlePaymentFailed(paymentEntity: any): Promise<void> {
    try {
      const payment = await Payment.findByGatewayTransactionId(paymentEntity.order_id);
      if (payment) {
        await Payment.updatePaymentStatus(payment.id, 'failed', { failed_payment: paymentEntity });
        logger.info(`Payment failed via webhook: ${payment.id}`);
      }
    } catch (error) {
      logger.error('Error handling payment failed webhook:', error);
    }
  }

  private async handleRefundCreated(refundEntity: any): Promise<void> {
    try {
      // Find payment by payment ID
      const payments = await Payment.findAll({
        where: {
          gateway_response_json: {
            razorpay_payment: {
              id: refundEntity.payment_id
            }
          }
        }
      });

      if (payments.length > 0) {
        const payment = payments[0];
        logger.info(`Refund created via webhook for payment: ${payment.id}`);
      }
    } catch (error) {
      logger.error('Error handling refund created webhook:', error);
    }
  }

  private async handleRefundProcessed(refundEntity: any): Promise<void> {
    try {
      // Similar to handleRefundCreated but for processed refunds
      logger.info(`Refund processed via webhook: ${refundEntity.id}`);
    } catch (error) {
      logger.error('Error handling refund processed webhook:', error);
    }
  }

  private async checkPaymentAccess(payment: Payment, userId: number, userRole: string): Promise<void> {
    if (userRole === USER_ROLES.ADMIN) {
      return; // Admin has access to all payments
    }

    // Get client to check ownership
    const client = await this.clientRepository.findById(payment.client_id);
    if (!client) {
      throw new Error('Associated client not found');
    }

    if (userRole === USER_ROLES.CUSTOMER && client.userId !== userId) {
      throw new Error('Access denied: You can only view your own payments');
    }

    if (userRole === USER_ROLES.CA && payment.filing_id) {
      const filing = await this.filingRepository.findById(payment.filing_id);
      if (!filing || filing.caId !== userId) {
        throw new Error('Access denied: You can only view payments for assigned filings');
      }
    }
  }
}

export default PaymentService; 