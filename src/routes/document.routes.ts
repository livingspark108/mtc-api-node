import { Router } from 'express';
import DocumentController from '../controllers/document.controller';
import { authenticate, requireRoles } from '../middleware/auth.middleware';
import { uploadDocument, uploadMultipleDocuments, validateDocumentType } from '../middleware/upload.middleware';
import { handleValidationErrors } from '../middleware/validation.middleware';
import { body, param, query } from 'express-validator';
import { USER_ROLES } from '../utils/constants';

const router = Router();
const documentController = new DocumentController();

// Validation rules
const uploadValidation = [
  body('filingId')
    .isInt({ min: 1 })
    .withMessage('Filing ID must be a positive integer'),
  body('documentType')
    .notEmpty()
    .withMessage('Document type is required'),
  validateDocumentType,
];

const multipleUploadValidation = [
  body('filingId')
    .isInt({ min: 1 })
    .withMessage('Filing ID must be a positive integer'),
  body('documentTypes')
    .notEmpty()
    .withMessage('Document types are required')
    .custom((value) => {
      try {
        const types = JSON.parse(value);
        if (!Array.isArray(types)) {
          throw new Error('Document types must be an array');
        }
        return true;
      } catch {
        throw new Error('Invalid document types JSON');
      }
    }),
];

const documentIdValidation = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Document ID must be a positive integer'),
];

const filingIdValidation = [
  param('filingId')
    .isInt({ min: 1 })
    .withMessage('Filing ID must be a positive integer'),
];

const updateDocumentValidation = [
  ...documentIdValidation,
  body('documentType')
    .optional()
    .notEmpty()
    .withMessage('Document type cannot be empty'),
  body('fileName')
    .optional()
    .isLength({ min: 1, max: 255 })
    .withMessage('File name must be between 1 and 255 characters'),
  body('metadataJson')
    .optional()
    .isObject()
    .withMessage('Metadata must be an object'),
];

const verifyDocumentValidation = [
  ...documentIdValidation,
  body('isVerified')
    .isBoolean()
    .withMessage('isVerified must be a boolean'),
  body('verificationNotes')
    .optional()
    .isLength({ max: 1000 })
    .withMessage('Verification notes cannot exceed 1000 characters'),
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
];

const searchValidation = [
  ...paginationValidation,
  query('q')
    .notEmpty()
    .isLength({ min: 2 })
    .withMessage('Search term must be at least 2 characters'),
];

/**
 * @swagger
 * components:
 *   schemas:
 *     Document:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           description: Document ID
 *         filingId:
 *           type: integer
 *           description: Filing ID this document belongs to
 *         uploadedBy:
 *           type: integer
 *           description: User ID who uploaded the document
 *         documentType:
 *           type: string
 *           enum: [PAN_CARD, AADHAR_CARD, SALARY_SLIP, BANK_STATEMENT, ITR_FORM, INVESTMENT_PROOF, OTHER]
 *           description: Type of document
 *         fileName:
 *           type: string
 *           description: Original file name
 *         fileSize:
 *           type: integer
 *           description: File size in bytes
 *         fileUrl:
 *           type: string
 *           description: File storage URL
 *         mimeType:
 *           type: string
 *           description: MIME type of the file
 *         isVerified:
 *           type: boolean
 *           description: Whether document is verified
 *         verifiedBy:
 *           type: integer
 *           nullable: true
 *           description: User ID who verified the document
 *         verifiedAt:
 *           type: string
 *           format: date-time
 *           nullable: true
 *           description: Verification timestamp
 *         metadataJson:
 *           type: object
 *           nullable: true
 *           description: Additional document metadata
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: Creation timestamp
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: Last update timestamp
 *     DocumentStats:
 *       type: object
 *       properties:
 *         totalDocuments:
 *           type: integer
 *           description: Total number of documents
 *         verifiedDocuments:
 *           type: integer
 *           description: Number of verified documents
 *         pendingVerification:
 *           type: integer
 *           description: Number of documents pending verification
 *         documentsByType:
 *           type: object
 *           description: Count of documents by type
 *         recentUploads:
 *           type: integer
 *           description: Number of documents uploaded in last 24 hours
 *         totalFileSize:
 *           type: integer
 *           description: Total file size in bytes
 */

// Document upload routes
router.post('/upload',
  authenticate,
  uploadDocument('document'),
  uploadValidation,
  handleValidationErrors,
  documentController.uploadDocument as any
);

router.post('/upload-multiple',
  authenticate,
  uploadMultipleDocuments('documents', 5),
  multipleUploadValidation,
  handleValidationErrors,
  documentController.uploadMultipleDocuments as any
);

// Document CRUD routes
router.get('/',
  authenticate,
  paginationValidation,
  handleValidationErrors,
  documentController.getDocuments as any
);

router.get('/search',
  authenticate,
  searchValidation,
  handleValidationErrors,
  documentController.searchDocuments as any
);

router.get('/unverified',
  authenticate,
  requireRoles([USER_ROLES.CA, USER_ROLES.ADMIN]),
  documentController.getUnverifiedDocuments as any
);

router.get('/stats',
  authenticate,
  documentController.getDocumentStats as any
);

router.get('/filing/:filingId',
  authenticate,
  filingIdValidation,
  handleValidationErrors,
  documentController.getDocumentsByFiling as any
);

router.get('/:id',
  authenticate,
  documentIdValidation,
  handleValidationErrors,
  documentController.getDocumentById as any
);

router.get('/:id/download',
  authenticate,
  documentIdValidation,
  handleValidationErrors,
  documentController.getDocumentDownloadUrl as any
);

router.put('/:id',
  authenticate,
  updateDocumentValidation,
  handleValidationErrors,
  documentController.updateDocument as any
);

router.delete('/:id',
  authenticate,
  documentIdValidation,
  handleValidationErrors,
  documentController.deleteDocument as any
);

// Document verification routes (CA/Admin only)
router.post('/:id/verify',
  authenticate,
  requireRoles([USER_ROLES.CA, USER_ROLES.ADMIN]),
  verifyDocumentValidation,
  handleValidationErrors,
  documentController.verifyDocument as any
);

export default router; 