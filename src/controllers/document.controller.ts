import { Request, Response } from 'express';
import DocumentService, { DocumentCreateData, DocumentUpdateData, DocumentVerificationData } from '../services/document.service';
import ResponseUtil from '../utils/response';
import logger from '../utils/logger';
import { QueryOptions } from '../types/common.types';
import { AuthenticatedRequest } from '../types/auth.types';

export class DocumentController {
  private documentService: DocumentService;

  constructor() {
    this.documentService = new DocumentService();
  }

  /**
   * @swagger
   * /api/documents/upload:
   *   post:
   *     summary: Upload a document
   *     tags: [Documents]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         multipart/form-data:
   *           schema:
   *             type: object
   *             required:
   *               - document
   *               - filingId
   *               - documentType
   *             properties:
   *               document:
   *                 type: string
   *                 format: binary
   *                 description: Document file to upload
   *               filingId:
   *                 type: integer
   *                 description: ID of the filing this document belongs to
   *               documentType:
   *                 type: string
   *                 enum: [PAN_CARD, AADHAR_CARD, SALARY_SLIP, BANK_STATEMENT, ITR_FORM, INVESTMENT_PROOF, OTHER]
   *                 description: Type of document
   *               metadata:
   *                 type: string
   *                 description: Additional metadata as JSON string
   *     responses:
   *       201:
   *         description: Document uploaded successfully
   *       400:
   *         description: Invalid request or file upload error
   *       401:
   *         description: Unauthorized
   *       500:
   *         description: Internal server error
   */
  uploadDocument = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { filingId, documentType, metadata } = req.body;
      const file = req.file;

      if (!file) {
        ResponseUtil.error(res, 'No file uploaded', 400);
        return;
      }

      if (!filingId || !documentType) {
        ResponseUtil.error(res, 'Filing ID and document type are required', 400);
        return;
      }

      let metadataJson: Record<string, any> = {};
      if (metadata) {
        try {
          metadataJson = JSON.parse(metadata);
        } catch (error) {
          ResponseUtil.error(res, 'Invalid metadata JSON', 400);
          return;
        }
      }

      const documentData: DocumentCreateData = {
        filingId: parseInt(filingId),
        uploadedBy: req.user!.id,
        documentType,
        fileName: file.originalname,
        fileSize: file.size,
        fileUrl: file.path,
        mimeType: file.mimetype,
        metadataJson,
      };

      const document = await this.documentService.createDocument(documentData);

      ResponseUtil.success(res, document, 'Document uploaded successfully', 201);
    } catch (error) {
      logger.error('Error uploading document:', error);
      ResponseUtil.error(res, error instanceof Error ? error.message : 'Failed to upload document', 500);
    }
  };

  /**
   * @swagger
   * /api/documents/upload-multiple:
   *   post:
   *     summary: Upload multiple documents
   *     tags: [Documents]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         multipart/form-data:
   *           schema:
   *             type: object
   *             required:
   *               - documents
   *               - filingId
   *               - documentTypes
   *             properties:
   *               documents:
   *                 type: array
   *                 items:
   *                   type: string
   *                   format: binary
   *                 description: Document files to upload
   *               filingId:
   *                 type: integer
   *                 description: ID of the filing these documents belong to
   *               documentTypes:
   *                 type: string
   *                 description: JSON array of document types corresponding to each file
   *     responses:
   *       201:
   *         description: Documents uploaded successfully
   *       400:
   *         description: Invalid request or file upload error
   *       401:
   *         description: Unauthorized
   *       500:
   *         description: Internal server error
   */
  uploadMultipleDocuments = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { filingId, documentTypes } = req.body;
      const files = req.files as Express.Multer.File[];

      if (!files || files.length === 0) {
        ResponseUtil.error(res, 'No files uploaded', 400);
        return;
      }

      if (!filingId || !documentTypes) {
        ResponseUtil.error(res, 'Filing ID and document types are required', 400);
        return;
      }

      let parsedDocumentTypes: string[];
      try {
        parsedDocumentTypes = JSON.parse(documentTypes);
      } catch (error) {
        ResponseUtil.error(res, 'Invalid document types JSON', 400);
        return;
      }

      if (files.length !== parsedDocumentTypes.length) {
        ResponseUtil.error(res, 'Number of files must match number of document types', 400);
        return;
      }

      const uploadPromises = files.map(async (file, index) => {
        const documentData: DocumentCreateData = {
          filingId: parseInt(filingId),
          uploadedBy: req.user!.id,
          documentType: parsedDocumentTypes[index],
          fileName: file.originalname,
          fileSize: file.size,
          fileUrl: file.path,
          mimeType: file.mimetype,
        };

        return await this.documentService.createDocument(documentData);
      });

      const documents = await Promise.all(uploadPromises);

      ResponseUtil.success(res, documents, 'Documents uploaded successfully', 201);
    } catch (error) {
      logger.error('Error uploading multiple documents:', error);
      ResponseUtil.error(res, error instanceof Error ? error.message : 'Failed to upload documents', 500);
    }
  };

  /**
   * @swagger
   * /api/documents:
   *   get:
   *     summary: Get documents with filtering and pagination
   *     tags: [Documents]
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
   *         name: filingId
   *         schema:
   *           type: integer
   *         description: Filter by filing ID
   *       - in: query
   *         name: documentType
   *         schema:
   *           type: string
   *         description: Filter by document type
   *       - in: query
   *         name: isVerified
   *         schema:
   *           type: boolean
   *         description: Filter by verification status
   *     responses:
   *       200:
   *         description: Documents retrieved successfully
   *       401:
   *         description: Unauthorized
   *       500:
   *         description: Internal server error
   */
  getDocuments = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { page = 1, limit = 10, filingId, documentType, isVerified } = req.query;

      const options: QueryOptions = {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
      };

      const filters: any = {};
      if (filingId) filters.filingId = parseInt(filingId as string);
      if (documentType) filters.documentType = documentType as string;
      if (isVerified !== undefined) filters.isVerified = isVerified === 'true';

      const result = await this.documentService.getDocuments(
        filters,
        options,
        req.user!.id,
        req.user!.role
      );

      ResponseUtil.success(res, result, 'Documents retrieved successfully');
    } catch (error) {
      logger.error('Error getting documents:', error);
      ResponseUtil.error(res, error instanceof Error ? error.message : 'Failed to get documents', 500);
    }
  };

  /**
   * @swagger
   * /api/documents/{id}:
   *   get:
   *     summary: Get document by ID
   *     tags: [Documents]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   *         description: Document ID
   *     responses:
   *       200:
   *         description: Document retrieved successfully
   *       404:
   *         description: Document not found
   *       401:
   *         description: Unauthorized
   *       403:
   *         description: Access denied
   *       500:
   *         description: Internal server error
   */
  getDocumentById = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;

      const document = await this.documentService.getDocumentById(
        parseInt(id),
        req.user!.id,
        req.user!.role
      );

      if (!document) {
        ResponseUtil.error(res, 'Document not found', 404);
        return;
      }

      ResponseUtil.success(res, document, 'Document retrieved successfully');
    } catch (error) {
      logger.error('Error getting document:', error);
      const statusCode = error instanceof Error && error.message.includes('access') ? 403 : 500;
      ResponseUtil.error(res, error instanceof Error ? error.message : 'Failed to get document', statusCode);
    }
  };

  /**
   * @swagger
   * /api/documents/{id}:
   *   put:
   *     summary: Update document
   *     tags: [Documents]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   *         description: Document ID
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               documentType:
   *                 type: string
   *                 enum: [PAN_CARD, AADHAR_CARD, SALARY_SLIP, BANK_STATEMENT, ITR_FORM, INVESTMENT_PROOF, OTHER]
   *               fileName:
   *                 type: string
   *               metadataJson:
   *                 type: object
   *     responses:
   *       200:
   *         description: Document updated successfully
   *       404:
   *         description: Document not found
   *       401:
   *         description: Unauthorized
   *       403:
   *         description: Access denied
   *       500:
   *         description: Internal server error
   */
  updateDocument = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const updateData: DocumentUpdateData = req.body;

      const document = await this.documentService.updateDocument(
        parseInt(id),
        updateData,
        req.user!.id,
        req.user!.role
      );

      if (!document) {
        ResponseUtil.error(res, 'Document not found or update failed', 404);
        return;
      }

      ResponseUtil.success(res, document, 'Document updated successfully');
    } catch (error) {
      logger.error('Error updating document:', error);
      const statusCode = error instanceof Error && error.message.includes('access') ? 403 : 500;
      ResponseUtil.error(res, error instanceof Error ? error.message : 'Failed to update document', statusCode);
    }
  };

  /**
   * @swagger
   * /api/documents/{id}:
   *   delete:
   *     summary: Delete document
   *     tags: [Documents]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   *         description: Document ID
   *     responses:
   *       200:
   *         description: Document deleted successfully
   *       404:
   *         description: Document not found
   *       401:
   *         description: Unauthorized
   *       403:
   *         description: Access denied
   *       500:
   *         description: Internal server error
   */
  deleteDocument = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;

      const deleted = await this.documentService.deleteDocument(
        parseInt(id),
        req.user!.id,
        req.user!.role
      );

      if (!deleted) {
        ResponseUtil.error(res, 'Document not found or deletion failed', 404);
        return;
      }

      ResponseUtil.success(res, null, 'Document deleted successfully');
    } catch (error) {
      logger.error('Error deleting document:', error);
      const statusCode = error instanceof Error && error.message.includes('access') ? 403 : 500;
      ResponseUtil.error(res, error instanceof Error ? error.message : 'Failed to delete document', statusCode);
    }
  };

  /**
   * @swagger
   * /api/documents/{id}/verify:
   *   post:
   *     summary: Verify or reject a document (CA/Admin only)
   *     tags: [Documents]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   *         description: Document ID
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - isVerified
   *             properties:
   *               isVerified:
   *                 type: boolean
   *                 description: Whether to verify or reject the document
   *               verificationNotes:
   *                 type: string
   *                 description: Optional notes about the verification
   *     responses:
   *       200:
   *         description: Document verification updated successfully
   *       404:
   *         description: Document not found
   *       401:
   *         description: Unauthorized
   *       403:
   *         description: Access denied
   *       500:
   *         description: Internal server error
   */
  verifyDocument = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const verificationData: DocumentVerificationData = {
        ...req.body,
        verifiedBy: req.user!.id,
      };

      const document = await this.documentService.verifyDocument(
        parseInt(id),
        verificationData,
        req.user!.id,
        req.user!.role
      );

      if (!document) {
        ResponseUtil.error(res, 'Document not found or verification failed', 404);
        return;
      }

      const action = verificationData.isVerified ? 'verified' : 'rejected';
      ResponseUtil.success(res, document, `Document ${action} successfully`);
    } catch (error) {
      logger.error('Error verifying document:', error);
      const statusCode = error instanceof Error && error.message.includes('access') ? 403 : 500;
      ResponseUtil.error(res, error instanceof Error ? error.message : 'Failed to verify document', statusCode);
    }
  };

  /**
   * @swagger
   * /api/documents/filing/{filingId}:
   *   get:
   *     summary: Get all documents for a specific filing
   *     tags: [Documents]
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
   *         description: Documents retrieved successfully
   *       404:
   *         description: Filing not found
   *       401:
   *         description: Unauthorized
   *       403:
   *         description: Access denied
   *       500:
   *         description: Internal server error
   */
  getDocumentsByFiling = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { filingId } = req.params;

      const documents = await this.documentService.getDocumentsByFiling(
        parseInt(filingId),
        req.user!.id,
        req.user!.role
      );

      ResponseUtil.success(res, documents, 'Documents retrieved successfully');
    } catch (error) {
      logger.error('Error getting documents by filing:', error);
      const statusCode = error instanceof Error && error.message.includes('access') ? 403 : 500;
      ResponseUtil.error(res, error instanceof Error ? error.message : 'Failed to get documents', statusCode);
    }
  };

  /**
   * @swagger
   * /api/documents/search:
   *   get:
   *     summary: Search documents
   *     tags: [Documents]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: q
   *         required: true
   *         schema:
   *           type: string
   *         description: Search term
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
   *     responses:
   *       200:
   *         description: Search results retrieved successfully
   *       400:
   *         description: Search term is required
   *       401:
   *         description: Unauthorized
   *       500:
   *         description: Internal server error
   */
  searchDocuments = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { q: searchTerm, page = 1, limit = 10 } = req.query;

      if (!searchTerm) {
        ResponseUtil.error(res, 'Search term is required', 400);
        return;
      }

      const options: QueryOptions = {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
      };

      const result = await this.documentService.searchDocuments(
        searchTerm as string,
        options,
        req.user!.id,
        req.user!.role
      );

      ResponseUtil.success(res, result, 'Search results retrieved successfully');
    } catch (error) {
      logger.error('Error searching documents:', error);
      ResponseUtil.error(res, error instanceof Error ? error.message : 'Failed to search documents', 500);
    }
  };

  /**
   * @swagger
   * /api/documents/unverified:
   *   get:
   *     summary: Get unverified documents (CA/Admin only)
   *     tags: [Documents]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Unverified documents retrieved successfully
   *       401:
   *         description: Unauthorized
   *       403:
   *         description: Access denied
   *       500:
   *         description: Internal server error
   */
  getUnverifiedDocuments = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const documents = await this.documentService.getUnverifiedDocuments(
        req.user!.id,
        req.user!.role
      );

      ResponseUtil.success(res, documents, 'Unverified documents retrieved successfully');
    } catch (error) {
      logger.error('Error getting unverified documents:', error);
      const statusCode = error instanceof Error && error.message.includes('access') ? 403 : 500;
      ResponseUtil.error(res, error instanceof Error ? error.message : 'Failed to get unverified documents', statusCode);
    }
  };

  /**
   * @swagger
   * /api/documents/stats:
   *   get:
   *     summary: Get document statistics
   *     tags: [Documents]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Document statistics retrieved successfully
   *       401:
   *         description: Unauthorized
   *       500:
   *         description: Internal server error
   */
  getDocumentStats = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const stats = await this.documentService.getDocumentStats(
        req.user!.id,
        req.user!.role
      );

      ResponseUtil.success(res, stats, 'Document statistics retrieved successfully');
    } catch (error) {
      logger.error('Error getting document stats:', error);
      ResponseUtil.error(res, error instanceof Error ? error.message : 'Failed to get document statistics', 500);
    }
  };

  /**
   * @swagger
   * /api/documents/{id}/download:
   *   get:
   *     summary: Get document download URL
   *     tags: [Documents]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   *         description: Document ID
   *     responses:
   *       200:
   *         description: Download URL generated successfully
   *       404:
   *         description: Document not found
   *       401:
   *         description: Unauthorized
   *       403:
   *         description: Access denied
   *       500:
   *         description: Internal server error
   */
  getDocumentDownloadUrl = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;

      const downloadUrl = await this.documentService.getDocumentAccessUrl(
        parseInt(id),
        req.user!.id,
        req.user!.role
      );

      ResponseUtil.success(res, { downloadUrl }, 'Download URL generated successfully');
    } catch (error) {
      logger.error('Error getting document download URL:', error);
      const statusCode = error instanceof Error && error.message.includes('access') ? 403 : 500;
      ResponseUtil.error(res, error instanceof Error ? error.message : 'Failed to get download URL', statusCode);
    }
  };
}

export default DocumentController; 