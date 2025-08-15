import { Router } from 'express';
import { body, param, query } from 'express-validator';
import UserController from '../controllers/user.controller';

const userController = new UserController();
import { authenticate, requireAdmin } from '../middleware/auth.middleware';

const router = Router();

// Validation rules
const createUserValidation = [
  body('email')
    .isEmail()
    .withMessage('Please provide a valid email')
    .normalizeEmail(),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number'),
  body('fullName')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Full name must be between 2 and 100 characters'),
  body('phone')
    .optional()
    .isMobilePhone('any')
    .withMessage('Please provide a valid phone number'),
  body('role')
    .isIn(['admin', 'ca', 'customer'])
    .withMessage('Role must be admin, ca, or customer'),
];

const updateUserValidation = [
  param('id').isInt({ gt: 0 }).withMessage('Invalid user ID'),
  body('fullName')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Full name must be between 2 and 100 characters'),
  body('phone')
    .optional()
    .isMobilePhone('any')
    .withMessage('Please provide a valid phone number'),
  body('profileImageUrl')
    .optional()
    .isURL()
    .withMessage('Please provide a valid image URL'),
  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be a boolean'),
  body('isVerified')
    .optional()
    .isBoolean()
    .withMessage('isVerified must be a boolean'),
];

const changeRoleValidation = [
  param('id').isInt({ gt: 0 }).withMessage('Invalid user ID'),
  body('role')
    .isIn(['admin', 'ca', 'customer'])
    .withMessage('Role must be admin, ca, or customer'),
];

const getUserValidation = [
  param('id').isInt({ gt: 0 }).withMessage('Invalid user ID'),
];

const queryValidation = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  query('role')
    .optional()
    .isIn(['admin', 'ca', 'customer'])
    .withMessage('Role must be admin, ca, or customer'),
  query('search')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Search term must be between 1 and 100 characters'),
];

// Routes

/**
 * @swagger
 * tags:
 *   name: Users
 *   description: User management endpoints (Admin only)
 */

/**
 * @swagger
 * /api/v1/users:
 *   get:
 *     summary: Get all users
 *     description: Retrieve a paginated list of all users. Admin access required.
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 10
 *         description: Number of items per page
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *           enum: [admin, ca, customer]
 *         description: Filter users by role
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *           maxLength: 100
 *         description: Search term for user name or email
 *     responses:
 *       200:
 *         description: Users retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/PaginatedResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/User'
 *       401:
 *         description: Unauthorized - Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Forbidden - Admin access required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get(
  '/',
  authenticate,
  requireAdmin,
  queryValidation,
  userController.getAllUsers
);

// GET /api/v1/users/:id - Get user by ID (Admin only)
router.get(
  '/:id',
  authenticate,
  requireAdmin,
  getUserValidation,
  userController.getUserById
);

/**
 * @swagger
 * /api/v1/users:
 *   post:
 *     summary: Create a new user
 *     description: Create a new user account. Admin access required.
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateUserRequest'
 *           example:
 *             email: "john.doe@example.com"
 *             password: "SecurePass123"
 *             fullName: "John Doe"
 *             phone: "+1234567890"
 *             role: "customer"
 *     responses:
 *       201:
 *         description: User created successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/User'
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Forbidden - Admin access required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       409:
 *         description: User with email already exists
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post(
  '/',
  authenticate,
  requireAdmin,
  createUserValidation,
  userController.createUser
);

// PATCH /api/v1/users/:id - Update user (Admin only)
router.patch(
  '/:id',
  authenticate,
  requireAdmin,
  updateUserValidation,
  userController.updateUser
);

// DELETE /api/v1/users/:id - Delete user (Admin only)
router.delete(
  '/:id',
  authenticate,
  requireAdmin,
  getUserValidation,
  userController.deleteUser
);

// PATCH /api/v1/users/:id/activate - Activate user (Admin only)
router.patch(
  '/:id/activate',
  authenticate,
  requireAdmin,
  getUserValidation,
  userController.activateUser
);

// PATCH /api/v1/users/:id/deactivate - Deactivate user (Admin only)
router.patch(
  '/:id/deactivate',
  authenticate,
  requireAdmin,
  getUserValidation,
  userController.deactivateUser
);

// PATCH /api/v1/users/:id/role - Change user role (Admin only)
router.patch(
  '/:id/role',
  authenticate,
  requireAdmin,
  changeRoleValidation,
  userController.changeUserRole
);

export default router; 