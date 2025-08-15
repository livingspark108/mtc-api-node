import { Op } from 'sequelize';
import Document from '../models/document.model';
import { User, Filing } from '../models';
import { QueryOptions } from '../types/common.types';

export interface DocumentFilters {
  filingId?: number;
  uploadedBy?: number;
  documentType?: string;
  isVerified?: boolean;
  verifiedBy?: number;
}

export class DocumentRepository {
  async create(data: any): Promise<Document> {
    return Document.create(data);
  }

  async findById(id: number): Promise<Document | null> {
    return Document.findByPk(id, {
      include: [
        {
          model: Filing,
          as: 'filing',
        },
        {
          model: User,
          as: 'uploader',
          attributes: ['id', 'full_name', 'email'],
        },
        {
          model: User,
          as: 'verifier',
          attributes: ['id', 'full_name', 'email'],
        },
      ],
    });
  }

  async findAll(
    filters: DocumentFilters = {},
    options: QueryOptions = { page: 1, limit: 10 }
  ): Promise<{ rows: Document[]; count: number }> {
    const whereClause: any = {};

    if (filters.filingId) {
      whereClause.filingId = filters.filingId;
    }

    if (filters.uploadedBy) {
      whereClause.uploadedBy = filters.uploadedBy;
    }

    if (filters.documentType) {
      whereClause.documentType = filters.documentType;
    }

    if (filters.isVerified !== undefined) {
      whereClause.isVerified = filters.isVerified;
    }

    if (filters.verifiedBy) {
      whereClause.verifiedBy = filters.verifiedBy;
    }

    const page = options.page || 1;
    const limit = options.limit || 10;
    const offset = (page - 1) * limit;

    return Document.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: Filing,
          as: 'filing',
        },
        {
          model: User,
          as: 'uploader',
          attributes: ['id', 'full_name', 'email'],
        },
        {
          model: User,
          as: 'verifier',
          attributes: ['id', 'full_name', 'email'],
        },
      ],
      order: [['createdAt', 'DESC']],
      limit,
      offset,
    });
  }

  async update(id: number, data: any): Promise<[number, Document[]]> {
    return Document.update(data, {
      where: { id },
      returning: true,
    });
  }

  async delete(id: number): Promise<number> {
    return Document.destroy({
      where: { id },
    });
  }

  async findByFilingId(filingId: number): Promise<Document[]> {
    return Document.findAll({
      where: { filingId },
      include: [
        {
          model: User,
          as: 'uploader',
          attributes: ['id', 'full_name', 'email'],
        },
        {
          model: User,
          as: 'verifier',
          attributes: ['id', 'full_name', 'email'],
        },
      ],
      order: [['createdAt', 'DESC']],
    });
  }

  async verifyDocument(id: number, verifiedBy: number): Promise<[number, Document[]]> {
    return Document.update(
      {
        isVerified: true,
        verifiedBy,
        verifiedAt: new Date(),
      },
      {
        where: { id },
        returning: true,
      }
    );
  }

  async searchDocuments(searchTerm: string, options?: QueryOptions): Promise<{ rows: Document[]; count: number }> {
    const whereClause = {
      [Op.or]: [
        { fileName: { [Op.like]: `%${searchTerm}%` } },
        { documentType: { [Op.like]: `%${searchTerm}%` } },
      ],
    };

    const page = options?.page || 1;
    const limit = options?.limit || 10;
    const offset = (page - 1) * limit;

    return Document.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: Filing,
          as: 'filing',
        },
        {
          model: User,
          as: 'uploader',
          attributes: ['id', 'full_name', 'email'],
        },
      ],
      order: [['createdAt', 'DESC']],
      limit,
      offset,
    });
  }

  async getDocumentsByType(documentType: string, filingId?: number): Promise<Document[]> {
    const whereClause: any = { documentType };
    
    if (filingId) {
      whereClause.filingId = filingId;
    }

    return Document.findAll({
      where: whereClause,
      include: [
        {
          model: Filing,
          as: 'filing',
        },
        {
          model: User,
          as: 'uploader',
          attributes: ['id', 'full_name', 'email'],
        },
      ],
      order: [['createdAt', 'DESC']],
    });
  }

  async getUnverifiedDocuments(): Promise<Document[]> {
    return Document.findAll({
      where: { isVerified: false },
      include: [
        {
          model: Filing,
          as: 'filing',
        },
        {
          model: User,
          as: 'uploader',
          attributes: ['id', 'full_name', 'email'],
        },
      ],
      order: [['createdAt', 'ASC']],
    });
  }

  async getTotalCount(): Promise<number> {
    return await Document.count();
  }
}

export default new DocumentRepository(); 