import { DocumentRepository, DocumentFilters } from '../repositories/document.repository';
import { UserRepository } from '../repositories/user.repository';
import { FilingRepository } from '../repositories/filing.repository';
import Document from '../models/document.model';
import { QueryOptions } from '../types/common.types';
import { USER_ROLES, DOCUMENT_TYPES } from '../utils/constants';
import logger from '../utils/logger';
import { deleteFromS3, deleteLocalFile, getS3SignedUrl } from '../middleware/upload.middleware';

export interface DocumentCreateData {
  filingId: number;
  uploadedBy: number;
  documentType: string;
  fileName: string;
  fileSize: number;
  fileUrl: string;
  mimeType?: string;
  metadataJson?: Record<string, any>;
}

export interface DocumentUpdateData {
  documentType?: string;
  fileName?: string;
  metadataJson?: Record<string, any>;
}

export interface DocumentVerificationData {
  isVerified: boolean;
  verifiedBy: number;
  verificationNotes?: string;
}

export interface DocumentStats {
  totalDocuments: number;
  verifiedDocuments: number;
  pendingVerification: number;
  documentsByType: Record<string, number>;
  recentUploads: number;
  totalFileSize: number;
}

export class DocumentService {
  private documentRepository: DocumentRepository;
  private userRepository: UserRepository;
  private filingRepository: FilingRepository;

  constructor() {
    this.documentRepository = new DocumentRepository();
    this.userRepository = new UserRepository();
    this.filingRepository = new FilingRepository();
  }

  async createDocument(data: DocumentCreateData): Promise<Document> {
    try {
      // Validate filing exists and user has access
      const filing = await this.filingRepository.findById(data.filingId);
      if (!filing) {
        throw new Error('Filing not found');
      }

      // Validate user exists
      const user = await this.userRepository.findById(data.uploadedBy);
      if (!user) {
        throw new Error('User not found');
      }

      // Check if user has permission to upload to this filing
      if (user.role === USER_ROLES.CUSTOMER && filing.clientId !== user.id) {
        throw new Error('You can only upload documents to your own filings');
      }

      if (user.role === USER_ROLES.CA && filing.caId !== user.id) {
        throw new Error('You can only upload documents to assigned filings');
      }

      // Validate document type
      if (!Object.values(DOCUMENT_TYPES).includes(data.documentType as any)) {
        throw new Error('Invalid document type');
      }

      // Create document
      const document = await this.documentRepository.create(data);
      
      logger.info(`Document created: ${document.id} by user ${data.uploadedBy}`);
      return document;
    } catch (error) {
      logger.error('Error creating document:', error);
      throw error;
    }
  }

  async getDocumentById(id: number, userId: number, userRole: string): Promise<Document | null> {
    try {
      const document = await this.documentRepository.findById(id);
      
      if (!document) {
        return null;
      }

      // Check access permissions
      await this.checkDocumentAccess(document, userId, userRole);
      
      return document;
    } catch (error) {
      logger.error('Error getting document:', error);
      throw error;
    }
  }

  async getDocuments(
    filters: DocumentFilters,
    options: QueryOptions,
    userId: number,
    userRole: string
  ): Promise<{ rows: Document[]; count: number }> {
    try {
      // Apply role-based filtering
      const roleFilters = await this.applyRoleBasedFilters(filters, userId, userRole);
      
      return await this.documentRepository.findAll(roleFilters, options);
    } catch (error) {
      logger.error('Error getting documents:', error);
      throw error;
    }
  }

  async updateDocument(
    id: number,
    data: DocumentUpdateData,
    userId: number,
    userRole: string
  ): Promise<Document | null> {
    try {
      const document = await this.documentRepository.findById(id);
      
      if (!document) {
        throw new Error('Document not found');
      }

      // Check access permissions
      await this.checkDocumentAccess(document, userId, userRole);

      // Only allow updates by the uploader or admin
      if (document.uploadedBy !== userId && userRole !== USER_ROLES.ADMIN) {
        throw new Error('You can only update your own documents');
      }

      const [updatedCount, updatedDocuments] = await this.documentRepository.update(id, data);
      
      if (updatedCount === 0) {
        throw new Error('Failed to update document');
      }

      logger.info(`Document updated: ${id} by user ${userId}`);
      return updatedDocuments[0] || null;
    } catch (error) {
      logger.error('Error updating document:', error);
      throw error;
    }
  }

  async deleteDocument(id: number, userId: number, userRole: string): Promise<boolean> {
    try {
      const document = await this.documentRepository.findById(id);
      
      if (!document) {
        throw new Error('Document not found');
      }

      // Check access permissions
      await this.checkDocumentAccess(document, userId, userRole);

      // Only allow deletion by the uploader or admin
      if (document.uploadedBy !== userId && userRole !== USER_ROLES.ADMIN) {
        throw new Error('You can only delete your own documents');
      }

      // Delete file from storage
      try {
        if (process.env.STORAGE_TYPE === 's3') {
          await deleteFromS3(document.fileUrl);
        } else {
          deleteLocalFile(document.fileUrl);
        }
      } catch (fileError) {
        logger.warn('Failed to delete file from storage:', fileError);
        // Continue with database deletion even if file deletion fails
      }

      const deletedCount = await this.documentRepository.delete(id);
      
      if (deletedCount === 0) {
        throw new Error('Failed to delete document');
      }

      logger.info(`Document deleted: ${id} by user ${userId}`);
      return true;
    } catch (error) {
      logger.error('Error deleting document:', error);
      throw error;
    }
  }

  async verifyDocument(
    id: number,
    verificationData: DocumentVerificationData,
    userId: number,
    userRole: string
  ): Promise<Document | null> {
    try {
      // Only CA and Admin can verify documents
      if (![USER_ROLES.CA, USER_ROLES.ADMIN].includes(userRole as any)) {
        throw new Error('Only CA and Admin can verify documents');
      }

      const document = await this.documentRepository.findById(id);
      
      if (!document) {
        throw new Error('Document not found');
      }

      // Check if document can be verified
      if (!document.canBeVerified()) {
        throw new Error('Document is already verified');
      }

      // For CA role, check if they are assigned to the filing
      if (userRole === USER_ROLES.CA) {
        const filing = await this.filingRepository.findById(document.filingId);
        if (!filing || filing.caId !== userId) {
          throw new Error('You can only verify documents for assigned filings');
        }
      }

      // Update verification status
      const updateData = {
        isVerified: verificationData.isVerified,
        verifiedBy: verificationData.isVerified ? userId : null,
        verifiedAt: verificationData.isVerified ? new Date() : null,
        metadataJson: {
          ...document.getMetadata(),
          verificationNotes: verificationData.verificationNotes,
          verificationDate: new Date().toISOString(),
        },
      };

      const [updatedCount, updatedDocuments] = await this.documentRepository.update(id, updateData);
      
      if (updatedCount === 0) {
        throw new Error('Failed to update document verification');
      }

      logger.info(`Document ${verificationData.isVerified ? 'verified' : 'rejected'}: ${id} by user ${userId}`);
      return updatedDocuments[0] || null;
    } catch (error) {
      logger.error('Error verifying document:', error);
      throw error;
    }
  }

  async getDocumentsByFiling(
    filingId: number,
    userId: number,
    userRole: string
  ): Promise<Document[]> {
    try {
      // Check if user has access to the filing
      const filing = await this.filingRepository.findById(filingId);
      if (!filing) {
        throw new Error('Filing not found');
      }

      // Check access based on role
      if (userRole === USER_ROLES.CUSTOMER && filing.clientId !== userId) {
        throw new Error('You can only view documents for your own filings');
      }

      if (userRole === USER_ROLES.CA && filing.caId !== userId) {
        throw new Error('You can only view documents for assigned filings');
      }

      return await this.documentRepository.findByFilingId(filingId);
    } catch (error) {
      logger.error('Error getting documents by filing:', error);
      throw error;
    }
  }

  async searchDocuments(
    searchTerm: string,
    options: QueryOptions,
    userId: number,
    userRole: string
  ): Promise<{ rows: Document[]; count: number }> {
    try {
      const results = await this.documentRepository.searchDocuments(searchTerm, options);
      
      // Filter results based on user permissions
      const filteredRows = [];
      for (const document of results.rows) {
        try {
          await this.checkDocumentAccess(document, userId, userRole);
          filteredRows.push(document);
        } catch {
          // Skip documents user doesn't have access to
        }
      }

      return {
        rows: filteredRows,
        count: filteredRows.length,
      };
    } catch (error) {
      logger.error('Error searching documents:', error);
      throw error;
    }
  }

  async getDocumentsByType(
    documentType: string,
    filingId?: number,
    userId?: number,
    userRole?: string
  ): Promise<Document[]> {
    try {
      const documents = await this.documentRepository.getDocumentsByType(documentType, filingId);
      
      // If user info provided, filter by access
      if (userId && userRole) {
        const filteredDocuments = [];
        for (const document of documents) {
          try {
            await this.checkDocumentAccess(document, userId, userRole);
            filteredDocuments.push(document);
          } catch {
            // Skip documents user doesn't have access to
          }
        }
        return filteredDocuments;
      }

      return documents;
    } catch (error) {
      logger.error('Error getting documents by type:', error);
      throw error;
    }
  }

  async getUnverifiedDocuments(userId: number, userRole: string): Promise<Document[]> {
    try {
      // Only CA and Admin can view unverified documents
      if (![USER_ROLES.CA, USER_ROLES.ADMIN].includes(userRole as any)) {
        throw new Error('Only CA and Admin can view unverified documents');
      }

      const documents = await this.documentRepository.getUnverifiedDocuments();
      
      // For CA, filter by assigned filings
      if (userRole === USER_ROLES.CA) {
        const filteredDocuments = [];
        for (const document of documents) {
          const filing = await this.filingRepository.findById(document.filingId);
          if (filing && filing.caId === userId) {
            filteredDocuments.push(document);
          }
        }
        return filteredDocuments;
      }

      return documents;
    } catch (error) {
      logger.error('Error getting unverified documents:', error);
      throw error;
    }
  }

  async getDocumentStats(userId: number, userRole: string): Promise<DocumentStats> {
    try {
      let filters: DocumentFilters = {};

      // Apply role-based filtering
      if (userRole === USER_ROLES.CUSTOMER) {
        filters.uploadedBy = userId;
      } else if (userRole === USER_ROLES.CA) {
        // Get filings assigned to this CA
        const assignedFilings = await this.filingRepository.findAll({ assignedTo: userId });
        const filingIds = assignedFilings.data.map((f: any) => f.id);
        // This would need to be implemented in repository
        // For now, we'll get all documents and filter
      }

      const allDocuments = await this.documentRepository.findAll(filters, { page: 1, limit: 1000 });
      const documents = allDocuments.rows;

      const stats: DocumentStats = {
        totalDocuments: documents.length,
        verifiedDocuments: documents.filter(d => d.isVerified).length,
        pendingVerification: documents.filter(d => !d.isVerified).length,
        documentsByType: {},
        recentUploads: documents.filter(d => {
          const dayAgo = new Date();
          dayAgo.setDate(dayAgo.getDate() - 1);
          return d.createdAt > dayAgo;
        }).length,
        totalFileSize: documents.reduce((sum, d) => sum + d.fileSize, 0),
      };

      // Count by document type
      for (const doc of documents) {
        stats.documentsByType[doc.documentType] = (stats.documentsByType[doc.documentType] || 0) + 1;
      }

      return stats;
    } catch (error) {
      logger.error('Error getting document stats:', error);
      throw error;
    }
  }

  async getDocumentAccessUrl(id: number, userId: number, userRole: string): Promise<string> {
    try {
      const document = await this.documentRepository.findById(id);
      
      if (!document) {
        throw new Error('Document not found');
      }

      // Check access permissions
      await this.checkDocumentAccess(document, userId, userRole);

      // If using S3, generate signed URL
      if (process.env.STORAGE_TYPE === 's3') {
        return await getS3SignedUrl(document.fileUrl, 3600); // 1 hour expiry
      }

      // For local files, return the file URL (will be served by middleware)
      return document.fileUrl;
    } catch (error) {
      logger.error('Error getting document access URL:', error);
      throw error;
    }
  }

  private async checkDocumentAccess(document: Document, userId: number, userRole: string): Promise<void> {
    // Admin has access to all documents
    if (userRole === USER_ROLES.ADMIN) {
      return;
    }

    // Get the filing to check permissions
    const filing = await this.filingRepository.findById(document.filingId);
    if (!filing) {
      throw new Error('Associated filing not found');
    }

    // Customer can only access their own documents
    if (userRole === USER_ROLES.CUSTOMER) {
      if (filing.clientId !== userId) {
        throw new Error('You can only access documents from your own filings');
      }
    }

    // CA can access documents from assigned filings
    if (userRole === USER_ROLES.CA) {
      if (filing.caId !== userId) {
        throw new Error('You can only access documents from assigned filings');
      }
    }
  }

  private async applyRoleBasedFilters(
    filters: DocumentFilters,
    userId: number,
    userRole: string
  ): Promise<DocumentFilters> {
    const roleFilters = { ...filters };

    if (userRole === USER_ROLES.CUSTOMER) {
      roleFilters.uploadedBy = userId;
    } else if (userRole === USER_ROLES.CA) {
      // For CA, we need to filter by filings they are assigned to
      // This would require a more complex query joining with filings table
      // For now, we'll handle this in the service layer
    }

    return roleFilters;
  }
}

export default DocumentService; 