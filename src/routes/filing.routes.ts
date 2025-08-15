import { Router } from 'express';
import { FilingController } from '../controllers/filing.controller';
import { authenticate, requireRoles } from '../middleware/auth.middleware';
import { handleValidationErrors } from '../middleware/validation.middleware';
import { validationChains } from '../utils/validation';
import { USER_ROLES } from '../utils/constants';

const router = Router();
const filingController = new FilingController();

// Apply authentication middleware to all routes
router.use(authenticate);

/**
 * @swagger
 * /api/v1/filings:
 *   get:
 *     summary: Get all filings with filtering and pagination
 *     tags: [Filings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
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
 *         name: clientId
 *         schema:
 *           type: integer
 *         description: Filter by client ID
 *       - in: query
 *         name: caId
 *         schema:
 *           type: integer
 *         description: Filter by CA ID
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [draft, in_progress, under_review, completed, rejected]
 *         description: Filter by filing status
 *       - in: query
 *         name: filingType
 *         schema:
 *           type: string
 *           enum: [individual, business, capital_gains]
 *         description: Filter by filing type
 *       - in: query
 *         name: priority
 *         schema:
 *           type: string
 *           enum: [low, medium, high, urgent]
 *         description: Filter by priority
 *       - in: query
 *         name: taxYear
 *         schema:
 *           type: string
 *         description: Filter by tax year (YYYY-YYYY)
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search in tax year, notes, client name, or PAN
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           default: createdAt
 *         description: Sort field
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *         description: Sort order
 *       - in: query
 *         name: dueDateFrom
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter by due date from
 *       - in: query
 *         name: dueDateTo
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter by due date to
 *     responses:
 *       200:
 *         description: Filings retrieved successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.get('/', 
  requireRoles([USER_ROLES.ADMIN, USER_ROLES.CA]), 
  filingController.getAllFilings.bind(filingController)
);

/**
 * @swagger
 * /api/v1/filings/{id}:
 *   get:
 *     summary: Get filing by ID
 *     tags: [Filings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Filing ID
 *     responses:
 *       200:
 *         description: Filing retrieved successfully
 *       404:
 *         description: Filing not found
 */
router.get('/:id', 
  requireRoles([USER_ROLES.ADMIN, USER_ROLES.CA, USER_ROLES.CUSTOMER]), 
  validationChains.idParam,
  handleValidationErrors,
  filingController.getFilingById.bind(filingController)
);

/**
 * @swagger
 * /api/v1/filings/client/{clientId}:
 *   get:
 *     summary: Get filings by client ID
 *     tags: [Filings]
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
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Limit number of results
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [draft, in_progress, under_review, completed, rejected]
 *         description: Filter by status
 *     responses:
 *       200:
 *         description: Client filings retrieved successfully
 *       404:
 *         description: Client not found
 */
router.get('/client/:clientId', 
  requireRoles([USER_ROLES.ADMIN, USER_ROLES.CA, USER_ROLES.CUSTOMER]), 
  filingController.getFilingsByClientId.bind(filingController)
);

/**
 * @swagger
 * /api/v1/filings/ca/{caId}:
 *   get:
 *     summary: Get filings by CA ID
 *     tags: [Filings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: caId
 *         required: true
 *         schema:
 *           type: integer
 *         description: CA ID
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Limit number of results
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [draft, in_progress, under_review, completed, rejected]
 *         description: Filter by status
 *     responses:
 *       200:
 *         description: CA filings retrieved successfully
 *       404:
 *         description: CA not found
 */
router.get('/ca/:caId', 
  requireRoles([USER_ROLES.ADMIN, USER_ROLES.CA]), 
  filingController.getFilingsByCAId.bind(filingController)
);

/**
 * @swagger
 * /api/v1/filings:
 *   post:
 *     summary: Create new filing
 *     tags: [Filings]
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
 *               - taxYear
 *               - filingType
 *             properties:
 *               clientId:
 *                 type: integer
 *               taxYear:
 *                 type: string
 *                 pattern: ^\d{4}-\d{4}$
 *                 example: "2023-2024"
 *               filingType:
 *                 type: string
 *                 enum: [individual, business, capital_gains]
 *               priority:
 *                 type: string
 *                 enum: [low, medium, high, urgent]
 *                 default: medium
 *               dueDate:
 *                 type: string
 *                 format: date
 *               notes:
 *                 type: string
 *     responses:
 *       201:
 *         description: Filing created successfully
 *       400:
 *         description: Validation error
 *       409:
 *         description: Filing already exists
 */
router.post('/', 
  requireRoles([USER_ROLES.ADMIN, USER_ROLES.CA, USER_ROLES.CUSTOMER]), 
  validationChains.filingCreation,
  handleValidationErrors,
  filingController.createFiling.bind(filingController)
);

/**
 * @swagger
 * /api/v1/filings/{id}:
 *   patch:
 *     summary: Update filing
 *     tags: [Filings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Filing ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [draft, in_progress, under_review, completed, rejected]
 *               priority:
 *                 type: string
 *                 enum: [low, medium, high, urgent]
 *               incomeSourcesJson:
 *                 type: object
 *               deductionsJson:
 *                 type: object
 *               summaryJson:
 *                 type: object
 *               notes:
 *                 type: string
 *               dueDate:
 *                 type: string
 *                 format: date
 *     responses:
 *       200:
 *         description: Filing updated successfully
 *       404:
 *         description: Filing not found
 */
router.patch('/:id', 
  requireRoles([USER_ROLES.ADMIN, USER_ROLES.CA, USER_ROLES.CUSTOMER]), 
  validationChains.idParam,
  validationChains.filingUpdate,
  handleValidationErrors,
  filingController.updateFiling.bind(filingController)
);

/**
 * @swagger
 * /api/v1/filings/{id}/status:
 *   patch:
 *     summary: Update filing status
 *     tags: [Filings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Filing ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [draft, in_progress, under_review, completed, rejected]
 *               notes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Filing status updated successfully
 *       404:
 *         description: Filing not found
 */
router.patch('/:id/status', 
  requireRoles([USER_ROLES.ADMIN, USER_ROLES.CA]), 
  validationChains.idParam,
  handleValidationErrors,
  filingController.updateFilingStatus.bind(filingController)
);

/**
 * @swagger
 * /api/v1/filings/{id}/assign-ca:
 *   post:
 *     summary: Assign CA to filing
 *     tags: [Filings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Filing ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - caId
 *             properties:
 *               caId:
 *                 type: integer
 *     responses:
 *       200:
 *         description: CA assigned successfully
 *       404:
 *         description: Filing or CA not found
 */
router.post('/:id/assign-ca', 
  requireRoles([USER_ROLES.ADMIN]), 
  validationChains.idParam,
  handleValidationErrors,
  filingController.assignCA.bind(filingController)
);

/**
 * @swagger
 * /api/v1/filings/{id}/unassign-ca:
 *   post:
 *     summary: Unassign CA from filing
 *     tags: [Filings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Filing ID
 *     responses:
 *       200:
 *         description: CA unassigned successfully
 *       404:
 *         description: Filing not found
 */
router.post('/:id/unassign-ca', 
  requireRoles([USER_ROLES.ADMIN]), 
  validationChains.idParam,
  handleValidationErrors,
  filingController.unassignCA.bind(filingController)
);

/**
 * @swagger
 * /api/v1/filings/{id}/submit:
 *   post:
 *     summary: Submit filing for review
 *     tags: [Filings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Filing ID
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               notes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Filing submitted successfully
 *       404:
 *         description: Filing not found
 */
router.post('/:id/submit', 
  requireRoles([USER_ROLES.ADMIN, USER_ROLES.CA, USER_ROLES.CUSTOMER]), 
  validationChains.idParam,
  handleValidationErrors,
  filingController.submitFiling.bind(filingController)
);

/**
 * @swagger
 * /api/v1/filings/{id}/approve:
 *   post:
 *     summary: Approve filing (CA only)
 *     tags: [Filings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Filing ID
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               notes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Filing approved successfully
 *       404:
 *         description: Filing not found
 */
router.post('/:id/approve', 
  requireRoles([USER_ROLES.ADMIN, USER_ROLES.CA]), 
  validationChains.idParam,
  handleValidationErrors,
  filingController.approveFiling.bind(filingController)
);

/**
 * @swagger
 * /api/v1/filings/{id}/reject:
 *   post:
 *     summary: Reject filing with reason (CA only)
 *     tags: [Filings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Filing ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - reason
 *             properties:
 *               reason:
 *                 type: string
 *     responses:
 *       200:
 *         description: Filing rejected
 *       404:
 *         description: Filing not found
 */
router.post('/:id/reject', 
  requireRoles([USER_ROLES.ADMIN, USER_ROLES.CA]), 
  validationChains.idParam,
  handleValidationErrors,
  filingController.rejectFiling.bind(filingController)
);

/**
 * @swagger
 * /api/v1/filings/{id}:
 *   delete:
 *     summary: Delete filing (draft only)
 *     tags: [Filings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Filing ID
 *     responses:
 *       200:
 *         description: Filing deleted successfully
 *       404:
 *         description: Filing not found
 */
router.delete('/:id', 
  requireRoles([USER_ROLES.ADMIN, USER_ROLES.CUSTOMER]), 
  validationChains.idParam,
  handleValidationErrors,
  filingController.deleteFiling.bind(filingController)
);

/**
 * @swagger
 * /api/v1/filings/stats:
 *   get:
 *     summary: Get filing statistics
 *     tags: [Filings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: clientId
 *         schema:
 *           type: integer
 *         description: Filter by client ID
 *       - in: query
 *         name: caId
 *         schema:
 *           type: integer
 *         description: Filter by CA ID
 *       - in: query
 *         name: taxYear
 *         schema:
 *           type: string
 *         description: Filter by tax year
 *     responses:
 *       200:
 *         description: Filing statistics retrieved successfully
 */
router.get('/stats', 
  requireRoles([USER_ROLES.ADMIN, USER_ROLES.CA]), 
  filingController.getFilingStats.bind(filingController)
);

/**
 * @swagger
 * /api/v1/filings/deadlines:
 *   get:
 *     summary: Get upcoming deadlines
 *     tags: [Filings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: days
 *         schema:
 *           type: integer
 *           default: 30
 *         description: Number of days to look ahead
 *       - in: query
 *         name: caId
 *         schema:
 *           type: integer
 *         description: Filter by CA ID
 *       - in: query
 *         name: clientId
 *         schema:
 *           type: integer
 *         description: Filter by client ID
 *     responses:
 *       200:
 *         description: Upcoming deadlines retrieved successfully
 */
router.get('/deadlines', 
  requireRoles([USER_ROLES.ADMIN, USER_ROLES.CA, USER_ROLES.CUSTOMER]), 
  filingController.getUpcomingDeadlines.bind(filingController)
);

export default router; 