import { Request, Response } from 'express';
import { UserRepository } from '../repositories/user.repository';
import { ClientRepository } from '../repositories/client.repository';
import { FilingRepository } from '../repositories/filing.repository';
import { DocumentRepository } from '../repositories/document.repository';
import { Payment } from '../models/payment.model';
import ResponseUtil from '../utils/response';
import logger from '../utils/logger';
import { AuthenticatedRequest } from '../types/auth.types';
import { USER_ROLES } from '../utils/constants';
import { Op } from 'sequelize';

export interface DashboardStats {
  totalUsers?: number;
  totalClients?: number;
  totalFilings?: number;
  totalDocuments?: number;
  totalRevenue?: number;
  pendingFilings?: number;
  completedFilings?: number;
  verifiedDocuments?: number;
  pendingDocuments?: number;
  recentActivity?: any[];
  monthlyStats?: any[];
  filingsByStatus?: Record<string, number>;
  documentsByType?: Record<string, number>;
  paymentsByMethod?: Record<string, number>;
}

export interface UserDashboardStats {
  myFilings?: number;
  pendingFilings?: number;
  completedFilings?: number;
  myDocuments?: number;
  verifiedDocuments?: number;
  pendingDocuments?: number;
  totalPayments?: number;
  recentActivity?: any[];
}

export interface CADashboardStats {
  assignedClients?: number;
  assignedFilings?: number;
  pendingFilings?: number;
  completedFilings?: number;
  documentsToVerify?: number;
  recentActivity?: any[];
  clientsByStatus?: Record<string, number>;
  filingsByMonth?: any[];
}

export class DashboardController {
  private userRepository: UserRepository;
  private clientRepository: ClientRepository;
  private filingRepository: FilingRepository;
  private documentRepository: DocumentRepository;

  constructor() {
    this.userRepository = new UserRepository();
    this.clientRepository = new ClientRepository();
    this.filingRepository = new FilingRepository();
    this.documentRepository = new DocumentRepository();
  }

  /**
   * @swagger
   * /api/dashboard/admin:
   *   get:
   *     summary: Get admin dashboard statistics
   *     tags: [Dashboard]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Admin dashboard data retrieved successfully
   *       401:
   *         description: Unauthorized
   *       403:
   *         description: Access denied - Admin only
   *       500:
   *         description: Internal server error
   */
  getAdminDashboard = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      if (req.user!.role !== USER_ROLES.ADMIN) {
        ResponseUtil.error(res, 'Access denied: Admin only', 403);
        return;
      }

      // Get all counts
      const [
        totalUsers,
        totalClients,
        totalFilings,
        totalDocuments,
        totalRevenue,
        recentFilings,
        recentDocuments,
        recentPayments
      ] = await Promise.all([
        this.userRepository.getTotalCount(),
        this.clientRepository.getTotalCount(),
        this.filingRepository.getTotalCount(),
        this.documentRepository.getTotalCount(),
        this.getTotalRevenue(),
        this.getRecentFilings(10),
        this.getRecentDocuments(10),
        this.getRecentPayments(10)
      ]);

      // Get status breakdowns
      const [
        filingsByStatus,
        documentsByType,
        paymentsByMethod,
        monthlyStats
      ] = await Promise.all([
        this.getFilingsByStatus(),
        this.getDocumentsByType(),
        this.getPaymentsByMethod(),
        this.getMonthlyStats()
      ]);

      const dashboardStats: DashboardStats = {
        totalUsers,
        totalClients,
        totalFilings,
        totalDocuments,
        totalRevenue,
        pendingFilings: filingsByStatus.pending || 0,
        completedFilings: filingsByStatus.completed || 0,
        verifiedDocuments: await this.getVerifiedDocumentsCount(),
        pendingDocuments: await this.getPendingDocumentsCount(),
        recentActivity: [
          ...recentFilings.map(f => ({ type: 'filing', data: f, timestamp: f.createdAt })),
          ...recentDocuments.map(d => ({ type: 'document', data: d, timestamp: d.createdAt })),
          ...recentPayments.map(p => ({ type: 'payment', data: p, timestamp: p.created_at }))
        ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 20),
        monthlyStats,
        filingsByStatus,
        documentsByType,
        paymentsByMethod,
      };

      ResponseUtil.success(res, dashboardStats, 'Admin dashboard data retrieved successfully');
    } catch (error) {
      logger.error('Error getting admin dashboard:', error);
      ResponseUtil.error(res, error instanceof Error ? error.message : 'Failed to get admin dashboard', 500);
    }
  };

  /**
   * @swagger
   * /api/dashboard/ca:
   *   get:
   *     summary: Get CA dashboard statistics
   *     tags: [Dashboard]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: CA dashboard data retrieved successfully
   *       401:
   *         description: Unauthorized
   *       403:
   *         description: Access denied - CA only
   *       500:
   *         description: Internal server error
   */
  getCADashboard = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      if (req.user!.role !== USER_ROLES.CA) {
        ResponseUtil.error(res, 'Access denied: CA only', 403);
        return;
      }

      const userId = req.user!.id;

      // Get CA-specific counts
      const [
        assignedClients,
        assignedFilings,
        pendingFilings,
        completedFilings,
        documentsToVerify,
        clientsByStatus,
        recentActivity
      ] = await Promise.all([
        this.getAssignedClientsCount(userId),
        this.getAssignedFilingsCount(userId),
        this.getPendingFilingsCount(userId),
        this.getCompletedFilingsCount(userId),
        this.getDocumentsToVerifyCount(userId),
        this.getClientsByStatus(userId),
        this.getCARecentActivity(userId)
      ]);

      // Get monthly filing stats for this CA
      const filingsByMonth = await this.getCAFilingsByMonth(userId);

      const dashboardStats: CADashboardStats = {
        assignedClients,
        assignedFilings,
        pendingFilings,
        completedFilings,
        documentsToVerify,
        recentActivity,
        clientsByStatus,
        filingsByMonth,
      };

      ResponseUtil.success(res, dashboardStats, 'CA dashboard data retrieved successfully');
    } catch (error) {
      logger.error('Error getting CA dashboard:', error);
      ResponseUtil.error(res, error instanceof Error ? error.message : 'Failed to get CA dashboard', 500);
    }
  };

  /**
   * @swagger
   * /api/dashboard/user:
   *   get:
   *     summary: Get user dashboard statistics
   *     tags: [Dashboard]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: User dashboard data retrieved successfully
   *       401:
   *         description: Unauthorized
   *       500:
   *         description: Internal server error
   */
  getUserDashboard = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      if (req.user!.role !== USER_ROLES.CUSTOMER) {
        ResponseUtil.error(res, 'Access denied: Customer only', 403);
        return;
      }

      const userId = req.user!.id;

      // Get user's clients
      const userClients = await this.clientRepository.findAll({ userId }, 50, 0);
      const clientIds = userClients.clients.map((c: any) => c.id);

      if (clientIds.length === 0) {
        // User has no clients yet
        const dashboardStats: UserDashboardStats = {
          myFilings: 0,
          pendingFilings: 0,
          completedFilings: 0,
          myDocuments: 0,
          verifiedDocuments: 0,
          pendingDocuments: 0,
          totalPayments: 0,
          recentActivity: [],
        };

        ResponseUtil.success(res, dashboardStats, 'User dashboard data retrieved successfully');
        return;
      }

      // Get user-specific counts
      const [
        myFilings,
        pendingFilings,
        completedFilings,
        myDocuments,
        verifiedDocuments,
        pendingDocuments,
        totalPayments,
        recentActivity
      ] = await Promise.all([
        this.getUserFilingsCount(clientIds),
        this.getUserPendingFilingsCount(clientIds),
        this.getUserCompletedFilingsCount(clientIds),
        this.getUserDocumentsCount(clientIds),
        this.getUserVerifiedDocumentsCount(clientIds),
        this.getUserPendingDocumentsCount(clientIds),
        this.getUserPaymentsCount(clientIds),
        this.getUserRecentActivity(clientIds)
      ]);

      const dashboardStats: UserDashboardStats = {
        myFilings,
        pendingFilings,
        completedFilings,
        myDocuments,
        verifiedDocuments,
        pendingDocuments,
        totalPayments,
        recentActivity,
      };

      ResponseUtil.success(res, dashboardStats, 'User dashboard data retrieved successfully');
    } catch (error) {
      logger.error('Error getting user dashboard:', error);
      ResponseUtil.error(res, error instanceof Error ? error.message : 'Failed to get user dashboard', 500);
    }
  };

  /**
   * @swagger
   * /api/dashboard/analytics/revenue:
   *   get:
   *     summary: Get revenue analytics (Admin only)
   *     tags: [Dashboard]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: period
   *         schema:
   *           type: string
   *           enum: [daily, weekly, monthly, yearly]
   *           default: monthly
   *         description: Analytics period
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
   *         description: Revenue analytics retrieved successfully
   *       401:
   *         description: Unauthorized
   *       403:
   *         description: Access denied - Admin only
   *       500:
   *         description: Internal server error
   */
  getRevenueAnalytics = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      if (req.user!.role !== USER_ROLES.ADMIN) {
        ResponseUtil.error(res, 'Access denied: Admin only', 403);
        return;
      }

      const { period = 'monthly', startDate, endDate } = req.query;

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
        // Default to last 12 months
        parsedEndDate = new Date();
        parsedStartDate = new Date();
        parsedStartDate.setMonth(parsedStartDate.getMonth() - 12);
      }

      const revenueData = await this.getRevenueAnalyticsByPeriod(
        period as string,
        parsedStartDate,
        parsedEndDate
      );

      ResponseUtil.success(res, revenueData, 'Revenue analytics retrieved successfully');
    } catch (error) {
      logger.error('Error getting revenue analytics:', error);
      ResponseUtil.error(res, error instanceof Error ? error.message : 'Failed to get revenue analytics', 500);
    }
  };

  /**
   * @swagger
   * /api/dashboard/analytics/filings:
   *   get:
   *     summary: Get filing analytics
   *     tags: [Dashboard]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: period
   *         schema:
   *           type: string
   *           enum: [daily, weekly, monthly, yearly]
   *           default: monthly
   *         description: Analytics period
   *     responses:
   *       200:
   *         description: Filing analytics retrieved successfully
   *       401:
   *         description: Unauthorized
   *       500:
   *         description: Internal server error
   */
  getFilingAnalytics = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { period = 'monthly' } = req.query;
      const userId = req.user!.id;
      const userRole = req.user!.role;

      const filingData = await this.getFilingAnalyticsByPeriod(
        period as string,
        userId,
        userRole
      );

      ResponseUtil.success(res, filingData, 'Filing analytics retrieved successfully');
    } catch (error) {
      logger.error('Error getting filing analytics:', error);
      ResponseUtil.error(res, error instanceof Error ? error.message : 'Failed to get filing analytics', 500);
    }
  };

  // Helper methods
  private async getTotalRevenue(): Promise<number> {
    const result = await Payment.sum('amount', {
      where: { status: 'success' }
    });
    return result || 0;
  }

  private async getRecentFilings(limit: number): Promise<any[]> {
    const filings = await this.filingRepository.findAll({ page: 1, limit });
    return filings.data;
  }

  private async getRecentDocuments(limit: number): Promise<any[]> {
    const documents = await this.documentRepository.findAll({}, { page: 1, limit });
    return documents.rows;
  }

  private async getRecentPayments(limit: number): Promise<any[]> {
    const payments = await Payment.findAll({
      order: [['created_at', 'DESC']],
      limit,
    });
    return payments;
  }

  private async getFilingsByStatus(): Promise<Record<string, number>> {
    const filings = await this.filingRepository.findAll({ page: 1, limit: 1000 });
    const statusCounts: Record<string, number> = {};
    
    filings.data.forEach((filing: any) => {
      statusCounts[filing.status] = (statusCounts[filing.status] || 0) + 1;
    });

    return statusCounts;
  }

  private async getDocumentsByType(): Promise<Record<string, number>> {
    const documents = await this.documentRepository.findAll({}, { page: 1, limit: 1000 });
    const typeCounts: Record<string, number> = {};
    
    documents.rows.forEach((doc: any) => {
      typeCounts[doc.documentType] = (typeCounts[doc.documentType] || 0) + 1;
    });

    return typeCounts;
  }

  private async getPaymentsByMethod(): Promise<Record<string, number>> {
    const payments = await Payment.findAll({
      where: { status: 'success' }
    });
    const methodCounts: Record<string, number> = {};
    
    payments.forEach((payment: any) => {
      methodCounts[payment.payment_method] = (methodCounts[payment.payment_method] || 0) + 1;
    });

    return methodCounts;
  }

  private async getVerifiedDocumentsCount(): Promise<number> {
    const documents = await this.documentRepository.findAll({ isVerified: true }, { page: 1, limit: 1 });
    return documents.count;
  }

  private async getPendingDocumentsCount(): Promise<number> {
    const documents = await this.documentRepository.findAll({ isVerified: false }, { page: 1, limit: 1 });
    return documents.count;
  }

  private async getMonthlyStats(): Promise<any[]> {
    const filings = await this.filingRepository.findAll({ page: 1, limit: 1000 });

    const monthlyStats: Record<string, number> = {};
    filings.data.forEach((filing: any) => {
      const month = filing.createdAt.toISOString().substring(0, 7);
      monthlyStats[month] = (monthlyStats[month] || 0) + 1;
    });

    return Object.entries(monthlyStats).map(([month, count]) => ({
      month,
      count,
    }));
  }

  // CA-specific helper methods
  private async getAssignedClientsCount(caId: number): Promise<number> {
    const clients = await this.clientRepository.findAll({ caId }, 1, 0);
    return clients.total;
  }

  private async getAssignedFilingsCount(caId: number): Promise<number> {
    const filings = await this.filingRepository.findAll({ assignedTo: caId, page: 1, limit: 1 });
    return filings.pagination.total;
  }

  private async getPendingFilingsCount(caId: number): Promise<number> {
    const filings = await this.filingRepository.findAll({
      assignedTo: caId,
      status: 'in_progress',
      page: 1,
      limit: 1
    });
    return filings.pagination.total;
  }

  private async getCompletedFilingsCount(caId: number): Promise<number> {
    const filings = await this.filingRepository.findAll({
      assignedTo: caId,
      status: 'completed',
      page: 1,
      limit: 1
    });
    return filings.pagination.total;
  }

  private async getDocumentsToVerifyCount(caId: number): Promise<number> {
    // Get unverified documents for filings assigned to this CA
    const assignedFilings = await this.filingRepository.findAll({ assignedTo: caId });
    const filingIds = assignedFilings.data.map((f: any) => f.id);
    
    if (filingIds.length === 0) return 0;

    const documents = await this.documentRepository.findAll(
      { isVerified: false },
      { page: 1, limit: 1000 }
    );
    
    // Filter by filing IDs (this would be better done with a join query)
    return documents.rows.filter((doc: any) => filingIds.includes(doc.filingId)).length;
  }

  private async getClientsByStatus(caId: number): Promise<Record<string, number>> {
    const clients = await this.clientRepository.findAll({ caId }, 1000, 0);
    const statusCounts: Record<string, number> = {};
    
    clients.clients.forEach((client: any) => {
      statusCounts[client.status] = (statusCounts[client.status] || 0) + 1;
    });

    return statusCounts;
  }

  private async getCARecentActivity(caId: number): Promise<any[]> {
    const [recentFilings, recentDocuments] = await Promise.all([
      this.filingRepository.findAll({ assignedTo: caId, page: 1, limit: 10 }),
      // Would need to join with filings to get CA's documents
      this.documentRepository.findAll({}, { page: 1, limit: 10 })
    ]);

    return [
      ...recentFilings.data.map((f: any) => ({ type: 'filing', data: f, timestamp: f.createdAt })),
      ...recentDocuments.rows.slice(0, 5).map((d: any) => ({ type: 'document', data: d, timestamp: d.createdAt }))
    ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  private async getCAFilingsByMonth(caId: number): Promise<any[]> {
    // This would require date grouping queries
    return [];
  }

  // User-specific helper methods
  private async getUserFilingsCount(clientIds: number[]): Promise<number> {
    if (clientIds.length === 0) return 0;
    
    let totalCount = 0;
    for (const clientId of clientIds) {
      const filings = await this.filingRepository.findAll({ customerId: clientId, page: 1, limit: 1 });
      totalCount += filings.pagination.total;
    }
    return totalCount;
  }

  private async getUserPendingFilingsCount(clientIds: number[]): Promise<number> {
    if (clientIds.length === 0) return 0;
    
    let totalCount = 0;
    for (const clientId of clientIds) {
      const filings = await this.filingRepository.findAll({
        customerId: clientId,
        status: 'in_progress',
        page: 1,
        limit: 1
      });
      totalCount += filings.pagination.total;
    }
    return totalCount;
  }

  private async getUserCompletedFilingsCount(clientIds: number[]): Promise<number> {
    if (clientIds.length === 0) return 0;
    
    let totalCount = 0;
    for (const clientId of clientIds) {
      const filings = await this.filingRepository.findAll({
        customerId: clientId,
        status: 'completed',
        page: 1,
        limit: 1
      });
      totalCount += filings.pagination.total;
    }
    return totalCount;
  }

  private async getUserDocumentsCount(clientIds: number[]): Promise<number> {
    if (clientIds.length === 0) return 0;
    
    // Get all filings for user's clients
    let totalCount = 0;
    for (const clientId of clientIds) {
      const filings = await this.filingRepository.findAll({ customerId: clientId });
      for (const filing of filings.data) {
        const documents = await this.documentRepository.findAll({ filingId: filing.id }, { page: 1, limit: 1 });
        totalCount += documents.count;
      }
    }
    return totalCount;
  }

  private async getUserVerifiedDocumentsCount(clientIds: number[]): Promise<number> {
    if (clientIds.length === 0) return 0;
    
    let totalCount = 0;
    for (const clientId of clientIds) {
      const filings = await this.filingRepository.findAll({ customerId: clientId });
      for (const filing of filings.data) {
        const documents = await this.documentRepository.findAll(
          { filingId: filing.id, isVerified: true },
          { page: 1, limit: 1 }
        );
        totalCount += documents.count;
      }
    }
    return totalCount;
  }

  private async getUserPendingDocumentsCount(clientIds: number[]): Promise<number> {
    if (clientIds.length === 0) return 0;
    
    let totalCount = 0;
    for (const clientId of clientIds) {
      const filings = await this.filingRepository.findAll({ customerId: clientId });
      for (const filing of filings.data) {
        const documents = await this.documentRepository.findAll(
          { filingId: filing.id, isVerified: false },
          { page: 1, limit: 1 }
        );
        totalCount += documents.count;
      }
    }
    return totalCount;
  }

  private async getUserPaymentsCount(clientIds: number[]): Promise<number> {
    if (clientIds.length === 0) return 0;
    
    const payments = await Payment.count({
      where: {
        client_id: { [Op.in]: clientIds }
      }
    });
    return payments;
  }

  private async getUserRecentActivity(clientIds: number[]): Promise<any[]> {
    if (clientIds.length === 0) return [];
    
    const [recentPayments] = await Promise.all([
      Payment.findAll({
        where: { client_id: { [Op.in]: clientIds } },
        order: [['created_at', 'DESC']],
        limit: 10
      })
    ]);

    return [
      ...recentPayments.map(p => ({ type: 'payment', data: p, timestamp: p.created_at }))
    ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  private async getRevenueAnalyticsByPeriod(
    period: string,
    startDate: Date,
    endDate: Date
  ): Promise<any> {
    // This would require complex date grouping queries
    // For now, return basic stats
    const totalRevenue = await Payment.sum('amount', {
      where: {
        status: 'success',
        created_at: { [Op.between]: [startDate, endDate] }
      }
    });

    const totalTransactions = await Payment.count({
      where: {
        status: 'success',
        created_at: { [Op.between]: [startDate, endDate] }
      }
    });

    return {
      period,
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
      totalRevenue: totalRevenue || 0,
      totalTransactions,
      periodData: [] // Would contain grouped data by period
    };
  }

  private async getFilingAnalyticsByPeriod(
    period: string,
    userId: number,
    userRole: string
  ): Promise<any> {
    let filings: any;
    
    if (userRole === USER_ROLES.ADMIN) {
      filings = await this.filingRepository.findAll({ page: 1, limit: 1000 });
    } else if (userRole === USER_ROLES.CA) {
      filings = await this.filingRepository.findAll({ assignedTo: userId, page: 1, limit: 1000 });
    } else {
      // Customer - get their client filings
      const userClients = await this.clientRepository.findAll({ userId }, 50, 0);
      const clientIds = userClients.clients.map((c: any) => c.id);
      
      let allFilings: any[] = [];
      for (const clientId of clientIds) {
        const clientFilings = await this.filingRepository.findAll({ customerId: clientId });
        allFilings = [...allFilings, ...clientFilings.data];
      }
      filings = { data: allFilings };
    }

    // Process filings by period
    const periodStats: Record<string, number> = {};
    filings.data.forEach((filing: any) => {
      let periodKey: string;
      const date = new Date(filing.createdAt);
      
      switch (period) {
        case 'daily':
          periodKey = date.toISOString().substring(0, 10);
          break;
        case 'weekly':
          const week = Math.ceil(date.getDate() / 7);
          periodKey = `${date.getFullYear()}-W${week}`;
          break;
        case 'monthly':
          periodKey = date.toISOString().substring(0, 7);
          break;
        case 'yearly':
          periodKey = date.getFullYear().toString();
          break;
        default:
          periodKey = date.toISOString().substring(0, 7);
      }
      
      periodStats[periodKey] = (periodStats[periodKey] || 0) + 1;
    });

    return {
      period,
      data: Object.entries(periodStats).map(([period, count]) => ({
        period,
        count,
      })),
      total: filings.data.length,
    };
  }
}

export default DashboardController; 