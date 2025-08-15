import { Router } from 'express';
import OnboardingController from '../controllers/onboarding.controller';
import { authenticate } from '../middleware/auth.middleware';
import { handleValidationErrors } from '../middleware/validation.middleware';
import { body, query, param } from 'express-validator';

const router = Router();
const onboardingController = new OnboardingController();

// Validation rules
const saveStepDataValidation = [
  body('step')
    .isInt({ min: 1, max: 7 })
    .withMessage('Step must be a number between 1 and 7'),
  body('stepName')
    .notEmpty()
    .withMessage('Step name is required')
    .isLength({ max: 50 })
    .withMessage('Step name must not exceed 50 characters'),
  body('data')
    .isObject()
    .withMessage('Data must be an object'),
  body('markAsCompleted')
    .optional()
    .isBoolean()
    .withMessage('markAsCompleted must be a boolean'),
];

const updateProgressValidation = [
  body('currentStep')
    .optional()
    .isInt({ min: 1, max: 7 })
    .withMessage('Current step must be a number between 1 and 7'),
  body('action')
    .optional()
    .isIn(['navigate', 'complete_payment', 'fail_payment', 'reset'])
    .withMessage('Action must be one of: navigate, complete_payment, fail_payment, reset'),
  body('additionalData')
    .optional()
    .isObject()
    .withMessage('Additional data must be an object'),
];

const stepQueryValidation = [
  query('step')
    .optional()
    .isInt({ min: 1, max: 7 })
    .withMessage('Step must be a number between 1 and 7'),
];

const stepRequiredQueryValidation = [
  query('step')
    .notEmpty()
    .withMessage('Step is required')
    .isInt({ min: 1, max: 7 })
    .withMessage('Step must be a number between 1 and 7'),
];

const fileIdParamValidation = [
  param('fileId')
    .isInt({ min: 1 })
    .withMessage('File ID must be a positive integer'),
];

const saveFileInfoValidation = [
  body('step')
    .isInt({ min: 1, max: 7 })
    .withMessage('Step must be a number between 1 and 7'),
  body('fileType')
    .notEmpty()
    .withMessage('File type is required')
    .isLength({ max: 50 })
    .withMessage('File type must not exceed 50 characters'),
  body('originalName')
    .notEmpty()
    .withMessage('Original name is required')
    .isLength({ max: 255 })
    .withMessage('Original name must not exceed 255 characters'),
  body('filePath')
    .notEmpty()
    .withMessage('File path is required')
    .isLength({ max: 500 })
    .withMessage('File path must not exceed 500 characters'),
  body('fileSize')
    .isInt({ min: 1 })
    .withMessage('File size must be a positive integer'),
  body('mimeType')
    .notEmpty()
    .withMessage('MIME type is required')
    .isLength({ max: 100 })
    .withMessage('MIME type must not exceed 100 characters'),
  body('metadata')
    .optional()
    .isObject()
    .withMessage('Metadata must be an object'),
];

// All routes require authentication
router.use(authenticate);

/**
 * @swagger
 * tags:
 *   name: Onboarding
 *   description: Customer onboarding process endpoints
 */

/**
 * @swagger
 * /api/v1/onboarding:
 *   get:
 *     summary: Get onboarding progress and data
 *     description: Retrieve complete onboarding progress and data for the authenticated user
 *     tags: [Onboarding]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: step
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 7
 *         description: Specific step to retrieve (optional)
 *     responses:
 *       200:
 *         description: Onboarding data retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Onboarding data retrieved successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     progress:
 *                       type: object
 *                       properties:
 *                         userId:
 *                           type: string
 *                         currentStep:
 *                           type: integer
 *                         totalSteps:
 *                           type: integer
 *                         completedSteps:
 *                           type: array
 *                           items:
 *                             type: integer
 *                         lastUpdated:
 *                           type: string
 *                           format: date-time
 *                         isCompleted:
 *                           type: boolean
 *                         paymentStatus:
 *                           type: string
 *                           enum: [pending, completed, failed]
 *                         completionPercentage:
 *                           type: number
 *                     stepData:
 *                       type: object
 *                       properties:
 *                         userId:
 *                           type: string
 *                         step:
 *                           type: integer
 *                         stepName:
 *                           type: string
 *                         data:
 *                           type: object
 *                         completedAt:
 *                           type: string
 *                           format: date-time
 *                           nullable: true
 *                         updatedAt:
 *                           type: string
 *                           format: date-time
 *                     files:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: integer
 *                           fileName:
 *                             type: string
 *                           fileSize:
 *                             type: integer
 *                           mimeType:
 *                             type: string
 *                           uploadedAt:
 *                             type: string
 *                             format: date-time
 *       400:
 *         description: Invalid step number
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: User not found
 *       500:
 *         description: Internal server error
 */
router.get('/', stepQueryValidation, handleValidationErrors, onboardingController.getOnboardingData);

/**
 * @swagger
 * /api/v1/onboarding:
 *   post:
 *     summary: Save step data
 *     description: Save or update data for a specific onboarding step
 *     tags: [Onboarding]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - step
 *               - stepName
 *               - data
 *             properties:
 *               step:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 7
 *                 description: Step number
 *               stepName:
 *                 type: string
 *                 description: Step name identifier
 *               data:
 *                 type: object
 *                 description: Step data object
 *               markAsCompleted:
 *                 type: boolean
 *                 description: Mark step as completed
 *                 default: false
 *           example:
 *             step: 1
 *             stepName: "income-types"
 *             data:
 *               selectedIncomeTypes: ["salary", "business"]
 *             markAsCompleted: true
 *     responses:
 *       200:
 *         description: Step data saved successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Step not accessible
 *       404:
 *         description: User not found
 *       500:
 *         description: Internal server error
 */
router.post('/', saveStepDataValidation, handleValidationErrors, onboardingController.saveStepData);

/**
 * @swagger
 * /api/v1/onboarding:
 *   put:
 *     summary: Update progress
 *     description: Update onboarding progress (navigation, payment status, etc.)
 *     tags: [Onboarding]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               currentStep:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 7
 *                 description: Current step number
 *               action:
 *                 type: string
 *                 enum: [navigate, complete_payment, fail_payment, reset]
 *                 description: Action to perform
 *               additionalData:
 *                 type: object
 *                 description: Additional data for the action
 *           example:
 *             currentStep: 3
 *             action: "navigate"
 *     responses:
 *       200:
 *         description: Progress updated successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Action not allowed
 *       500:
 *         description: Internal server error
 */
router.put('/', updateProgressValidation, handleValidationErrors, onboardingController.updateProgress);

/**
 * @swagger
 * /api/v1/onboarding:
 *   delete:
 *     summary: Reset onboarding data
 *     description: Reset onboarding progress and data for a specific step or all steps
 *     tags: [Onboarding]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: step
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 7
 *         description: Specific step to reset (optional, resets all if not provided)
 *     responses:
 *       200:
 *         description: Onboarding data reset successfully
 *       400:
 *         description: Invalid step number
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.delete('/', stepQueryValidation, handleValidationErrors, onboardingController.resetOnboarding);

/**
 * @swagger
 * /api/v1/onboarding/files:
 *   get:
 *     summary: Get files for a specific step
 *     description: Retrieve all files uploaded for a specific onboarding step
 *     tags: [Onboarding]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: step
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 7
 *         description: Step number to get files for
 *     responses:
 *       200:
 *         description: Files retrieved successfully
 *       400:
 *         description: Invalid or missing step number
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get('/files', stepRequiredQueryValidation, handleValidationErrors, onboardingController.getStepFiles);

/**
 * @swagger
 * /api/v1/onboarding/files:
 *   post:
 *     summary: Save file information
 *     description: Save file information after upload
 *     tags: [Onboarding]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - step
 *               - fileType
 *               - originalName
 *               - filePath
 *               - fileSize
 *               - mimeType
 *             properties:
 *               step:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 7
 *               fileType:
 *                 type: string
 *                 maxLength: 50
 *               originalName:
 *                 type: string
 *                 maxLength: 255
 *               filePath:
 *                 type: string
 *                 maxLength: 500
 *               fileSize:
 *                 type: integer
 *                 minimum: 1
 *               mimeType:
 *                 type: string
 *                 maxLength: 100
 *               metadata:
 *                 type: object
 *           example:
 *             step: 2
 *             fileType: "form16"
 *             originalName: "form16_2024.pdf"
 *             filePath: "/uploads/user123/form16_2024.pdf"
 *             fileSize: 1024000
 *             mimeType: "application/pdf"
 *             metadata: { uploadSource: "web" }
 *     responses:
 *       200:
 *         description: File information saved successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.post('/files', saveFileInfoValidation, handleValidationErrors, onboardingController.saveFileInfo);

/**
 * @swagger
 * /api/v1/onboarding/files/{fileId}:
 *   delete:
 *     summary: Delete a specific file
 *     description: Delete a file from the onboarding process
 *     tags: [Onboarding]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: fileId
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: File ID to delete
 *     responses:
 *       200:
 *         description: File deleted successfully
 *       400:
 *         description: Invalid file ID
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: File not found
 *       500:
 *         description: Internal server error
 */
router.delete('/files/:fileId', fileIdParamValidation, handleValidationErrors, onboardingController.deleteFile);

/**
 * @swagger
 * /api/v1/onboarding/config:
 *   get:
 *     summary: Get step configurations
 *     description: Get configuration for a specific step or all steps
 *     tags: [Onboarding]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: step
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 7
 *         description: Specific step to get config for (optional)
 *     responses:
 *       200:
 *         description: Configuration retrieved successfully
 *       400:
 *         description: Invalid step number
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Step configuration not found
 *       500:
 *         description: Internal server error
 */
router.get('/config', stepQueryValidation, handleValidationErrors, onboardingController.getStepConfig);

/**
 * @swagger
 * /api/v1/onboarding/progress:
 *   get:
 *     summary: Get completion percentage
 *     description: Get the current completion percentage for the user's onboarding
 *     tags: [Onboarding]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Completion percentage retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Completion percentage retrieved successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     completionPercentage:
 *                       type: number
 *                       example: 42.86
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get('/progress', onboardingController.getCompletionPercentage);

/**
 * @swagger
 * /api/v1/onboarding/next-step:
 *   get:
 *     summary: Get next accessible step
 *     description: Get the next step that the user can access
 *     tags: [Onboarding]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Next accessible step retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Next accessible step retrieved successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     nextStep:
 *                       type: integer
 *                       example: 3
 *                     stepName:
 *                       type: string
 *                       example: "income-details"
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get('/next-step', onboardingController.getNextAccessibleStep);

export default router; 