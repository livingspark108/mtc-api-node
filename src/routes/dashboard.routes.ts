import { Router } from 'express';
import DashboardController from '../controllers/dashboard.controller';
import { authenticate, requireRoles } from '../middleware/auth.middleware';
import { handleValidationErrors } from '../middleware/validation.middleware';
import { query } from 'express-validator';
import { USER_ROLES } from '../utils/constants';

const router = Router();
const dashboardController = new DashboardController();

// Validation rules
const analyticsValidation = [
  query('period')
    .optional()
    .isIn(['daily', 'weekly', 'monthly', 'yearly'])
    .withMessage('Period must be daily, weekly, monthly, or yearly'),
  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('Start date must be in ISO 8601 format (YYYY-MM-DD)'),
  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('End date must be in ISO 8601 format (YYYY-MM-DD)'),
];

/**
 * @swagger
 * components:
 *   schemas:
 *     DashboardStats:
 *       type: object
 *       properties:
 *         totalUsers:
 *           type: integer
 *           description: Total number of users
 *         totalClients:
 *           type: integer
 *           description: Total number of clients
 *         totalFilings:
 *           type: integer
 *           description: Total number of filings
 *         totalDocuments:
 *           type: integer
 *           description: Total number of documents
 *         totalRevenue:
 *           type: number
 *           description: Total revenue
 *         pendingFilings:
 *           type: integer
 *           description: Number of pending filings
 *         completedFilings:
 *           type: integer
 *           description: Number of completed filings
 *         verifiedDocuments:
 *           type: integer
 *           description: Number of verified documents
 *         pendingDocuments:
 *           type: integer
 *           description: Number of pending documents
 *         recentActivity:
 *           type: array
 *           items:
 *             type: object
 *           description: Recent activity items
 *         monthlyStats:
 *           type: array
 *           items:
 *             type: object
 *           description: Monthly statistics
 *         filingsByStatus:
 *           type: object
 *           description: Filing count by status
 *         documentsByType:
 *           type: object
 *           description: Document count by type
 *         paymentsByMethod:
 *           type: object
 *           description: Payment count by method
 *     UserDashboardStats:
 *       type: object
 *       properties:
 *         myFilings:
 *           type: integer
 *           description: User's total filings
 *         pendingFilings:
 *           type: integer
 *           description: User's pending filings
 *         completedFilings:
 *           type: integer
 *           description: User's completed filings
 *         myDocuments:
 *           type: integer
 *           description: User's total documents
 *         verifiedDocuments:
 *           type: integer
 *           description: User's verified documents
 *         pendingDocuments:
 *           type: integer
 *           description: User's pending documents
 *         totalPayments:
 *           type: integer
 *           description: User's total payments
 *         recentActivity:
 *           type: array
 *           items:
 *             type: object
 *           description: User's recent activity
 *     CADashboardStats:
 *       type: object
 *       properties:
 *         assignedClients:
 *           type: integer
 *           description: Number of assigned clients
 *         assignedFilings:
 *           type: integer
 *           description: Number of assigned filings
 *         pendingFilings:
 *           type: integer
 *           description: Number of pending filings
 *         completedFilings:
 *           type: integer
 *           description: Number of completed filings
 *         documentsToVerify:
 *           type: integer
 *           description: Number of documents to verify
 *         recentActivity:
 *           type: array
 *           items:
 *             type: object
 *           description: Recent activity
 *         clientsByStatus:
 *           type: object
 *           description: Client count by status
 *         filingsByMonth:
 *           type: array
 *           items:
 *             type: object
 *           description: Filing statistics by month
 */

// Role-specific dashboard routes
router.get('/admin',
  authenticate,
  requireRoles([USER_ROLES.ADMIN]),
  dashboardController.getAdminDashboard.bind(dashboardController) as any
);

router.get('/ca',
  authenticate,
  requireRoles([USER_ROLES.CA]),
  dashboardController.getCADashboard.bind(dashboardController) as any
);

router.get('/user',
  authenticate,
  requireRoles([USER_ROLES.CUSTOMER]),
  dashboardController.getUserDashboard.bind(dashboardController) as any
);

// Analytics routes
router.get('/analytics/revenue',
  authenticate,
  requireRoles([USER_ROLES.ADMIN]),
  analyticsValidation,
  handleValidationErrors,
  dashboardController.getRevenueAnalytics.bind(dashboardController) as any
);

router.get('/analytics/filings',
  authenticate,
  analyticsValidation,
  handleValidationErrors,
  dashboardController.getFilingAnalytics.bind(dashboardController) as any
);

export default router; 