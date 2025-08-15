import { Router } from 'express';
import { ClientController } from '../controllers/client.controller';
import { authenticate, requireRoles } from '../middleware/auth.middleware';
import { handleValidationErrors } from '../middleware/validation.middleware';
import { validationChains } from '../utils/validation';
import { USER_ROLES } from '../utils/constants';

const router = Router();
const clientController = new ClientController();

// Apply authentication middleware to all routes
router.use(authenticate);

/**
 * @swagger
 * /api/v1/clients:
 *   get:
 *     summary: Get all clients with filtering and pagination
 *     tags: [Clients]
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
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, inactive, suspended]
 *         description: Filter by client status
 *       - in: query
 *         name: caId
 *         schema:
 *           type: integer
 *         description: Filter by assigned CA ID
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by name, email, or PAN
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
 *     responses:
 *       200:
 *         description: Clients retrieved successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.get('/', 
  requireRoles([USER_ROLES.ADMIN, USER_ROLES.CA]), 
  clientController.getAllClients.bind(clientController)
);

/**
 * @swagger
 * /api/v1/clients/{id}:
 *   get:
 *     summary: Get client by ID
 *     tags: [Clients]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Client ID
 *     responses:
 *       200:
 *         description: Client retrieved successfully
 *       404:
 *         description: Client not found
 */
router.get('/:id', 
  requireRoles([USER_ROLES.ADMIN, USER_ROLES.CA, USER_ROLES.CUSTOMER]), 
  clientController.getClientById.bind(clientController)
);

/**
 * @swagger
 * /api/v1/clients/user/{userId}:
 *   get:
 *     summary: Get client by user ID
 *     tags: [Clients]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *         description: User ID
 *     responses:
 *       200:
 *         description: Client profile retrieved successfully
 *       404:
 *         description: Client profile not found
 */
router.get('/user/:userId', 
  requireRoles([USER_ROLES.ADMIN, USER_ROLES.CA, USER_ROLES.CUSTOMER]), 
  clientController.getClientByUserId.bind(clientController)
);

/**
 * @swagger
 * /api/v1/clients/pan/{panNumber}:
 *   get:
 *     summary: Get client by PAN number
 *     tags: [Clients]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: panNumber
 *         required: true
 *         schema:
 *           type: string
 *         description: PAN number
 *     responses:
 *       200:
 *         description: Client retrieved successfully
 *       404:
 *         description: Client not found
 */
router.get('/pan/:panNumber', 
  requireRoles([USER_ROLES.ADMIN, USER_ROLES.CA]), 
  clientController.getClientByPanNumber.bind(clientController)
);

/**
 * @swagger
 * /api/v1/clients:
 *   post:
 *     summary: Create new client profile
 *     tags: [Clients]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *               - panNumber
 *             properties:
 *               userId:
 *                 type: integer
 *               panNumber:
 *                 type: string
 *               aadharNumber:
 *                 type: string
 *               dateOfBirth:
 *                 type: string
 *                 format: date
 *               address:
 *                 type: object
 *               occupation:
 *                 type: string
 *               annualIncome:
 *                 type: number
 *     responses:
 *       201:
 *         description: Client profile created successfully
 *       400:
 *         description: Validation error
 *       409:
 *         description: Client already exists
 */
router.post('/', 
  requireRoles([USER_ROLES.ADMIN, USER_ROLES.CUSTOMER]), 
  validationChains.clientProfile,
  handleValidationErrors,
  clientController.createClient.bind(clientController)
);

/**
 * @swagger
 * /api/v1/clients/{id}:
 *   patch:
 *     summary: Update client profile
 *     tags: [Clients]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Client ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               caId:
 *                 type: integer
 *               aadharNumber:
 *                 type: string
 *               dateOfBirth:
 *                 type: string
 *                 format: date
 *               address:
 *                 type: object
 *               occupation:
 *                 type: string
 *               annualIncome:
 *                 type: number
 *               status:
 *                 type: string
 *                 enum: [active, inactive, suspended]
 *               onboardingCompleted:
 *                 type: boolean
 *               profileJson:
 *                 type: object
 *     responses:
 *       200:
 *         description: Client updated successfully
 *       404:
 *         description: Client not found
 */
router.patch('/:id', 
  requireRoles([USER_ROLES.ADMIN, USER_ROLES.CA, USER_ROLES.CUSTOMER]), 
  validationChains.idParam,
  handleValidationErrors,
  clientController.updateClient.bind(clientController)
);

/**
 * @swagger
 * /api/v1/clients/{id}:
 *   delete:
 *     summary: Delete client profile
 *     tags: [Clients]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Client ID
 *     responses:
 *       200:
 *         description: Client deleted successfully
 *       404:
 *         description: Client not found
 */
router.delete('/:id', 
  requireRoles([USER_ROLES.ADMIN]), 
  clientController.deleteClient.bind(clientController)
);

/**
 * @swagger
 * /api/v1/clients/{id}/assign-ca:
 *   post:
 *     summary: Assign CA to client
 *     tags: [Clients]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Client ID
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
 *         description: Client or CA not found
 */
router.post('/:id/assign-ca', 
  requireRoles([USER_ROLES.ADMIN]), 
  validationChains.idParam,
  handleValidationErrors,
  clientController.assignCA.bind(clientController)
);

/**
 * @swagger
 * /api/v1/clients/{id}/unassign-ca:
 *   post:
 *     summary: Unassign CA from client
 *     tags: [Clients]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Client ID
 *     responses:
 *       200:
 *         description: CA unassigned successfully
 *       404:
 *         description: Client not found
 */
router.post('/:id/unassign-ca', 
  requireRoles([USER_ROLES.ADMIN]), 
  clientController.unassignCA.bind(clientController)
);

/**
 * @swagger
 * /api/v1/clients/ca/{caId}:
 *   get:
 *     summary: Get clients assigned to a CA
 *     tags: [Clients]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: caId
 *         required: true
 *         schema:
 *           type: integer
 *         description: CA ID
 *     responses:
 *       200:
 *         description: Clients retrieved successfully
 *       404:
 *         description: CA not found
 */
router.get('/ca/:caId', 
  requireRoles([USER_ROLES.ADMIN, USER_ROLES.CA]), 
  clientController.getClientsByCA.bind(clientController)
);

/**
 * @swagger
 * /api/v1/clients/{id}/complete-onboarding:
 *   post:
 *     summary: Complete client onboarding
 *     tags: [Clients]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Client ID
 *     responses:
 *       200:
 *         description: Onboarding completed successfully
 *       404:
 *         description: Client not found
 */
router.post('/:id/complete-onboarding', 
  requireRoles([USER_ROLES.ADMIN, USER_ROLES.CUSTOMER]), 
  clientController.completeOnboarding.bind(clientController)
);

/**
 * @swagger
 * /api/v1/clients/{id}/stats:
 *   get:
 *     summary: Get client statistics
 *     tags: [Clients]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Client ID
 *     responses:
 *       200:
 *         description: Client statistics retrieved successfully
 *       404:
 *         description: Client not found
 */
router.get('/:id/stats', 
  requireRoles([USER_ROLES.ADMIN, USER_ROLES.CA, USER_ROLES.CUSTOMER]), 
  clientController.getClientStats.bind(clientController)
);

export default router;
