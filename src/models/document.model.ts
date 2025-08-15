import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';
import { Document as DocumentInterface } from '../types/user.types';
import { DOCUMENT_TYPES } from '../utils/constants';

// Define the attributes for Document creation
interface DocumentCreationAttributes extends Optional<DocumentInterface, 'id' | 'createdAt' | 'updatedAt'> {}

// Document model class
class Document extends Model<DocumentInterface, DocumentCreationAttributes> implements DocumentInterface {
  public id!: number;
  public filingId!: number;
  public uploadedBy!: number;
  public documentType!: string;
  public fileName!: string;
  public fileSize!: number;
  public fileUrl!: string;
  public mimeType?: string;
  public isVerified!: boolean;
  public verifiedBy?: number;
  public verifiedAt?: Date;
  public metadataJson?: Record<string, any>;

  // Timestamps
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  // Instance methods
  public getMetadata(): Record<string, any> {
    return this.metadataJson || {};
  }

  public setMetadata(metadata: Record<string, any>): void {
    this.metadataJson = metadata;
  }

  public getFileExtension(): string {
    return this.fileName.split('.').pop()?.toLowerCase() || '';
  }

  public getFileSizeInMB(): number {
    return Math.round((this.fileSize / (1024 * 1024)) * 100) / 100;
  }

  public isImage(): boolean {
    const imageTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/gif'];
    return imageTypes.includes(this.mimeType || '');
  }

  public isPDF(): boolean {
    return this.mimeType === 'application/pdf';
  }

  public canBeVerified(): boolean {
    return !this.isVerified;
  }

  public verify(verifiedBy: number): void {
    this.isVerified = true;
    this.verifiedBy = verifiedBy;
    this.verifiedAt = new Date();
  }
}

// Initialize the model
Document.init(
  {
    id: {
      type: DataTypes.BIGINT,
      autoIncrement: true,
      primaryKey: true,
    },
    filingId: {
      type: DataTypes.BIGINT,
      allowNull: false,
      field: 'filing_id',
      references: {
        model: 'filings',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    },
    uploadedBy: {
      type: DataTypes.BIGINT,
      allowNull: false,
      field: 'uploaded_by',
      references: {
        model: 'users',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    },
    documentType: {
      type: DataTypes.ENUM(...Object.values(DOCUMENT_TYPES)),
      allowNull: false,
      field: 'document_type',
    },
    fileName: {
      type: DataTypes.STRING(255),
      allowNull: false,
      field: 'file_name',
    },
    fileSize: {
      type: DataTypes.BIGINT,
      allowNull: false,
      field: 'file_size',
      validate: {
        min: 1,
        max: 10 * 1024 * 1024, // 10MB max
      },
    },
    fileUrl: {
      type: DataTypes.STRING(500),
      allowNull: false,
      field: 'file_url',
    },
    mimeType: {
      type: DataTypes.STRING(100),
      allowNull: true,
      field: 'mime_type',
    },
    isVerified: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'is_verified',
    },
    verifiedBy: {
      type: DataTypes.BIGINT,
      allowNull: true,
      field: 'verified_by',
      references: {
        model: 'users',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    },
    verifiedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'verified_at',
    },
    metadataJson: {
      type: DataTypes.JSON,
      allowNull: true,
      field: 'metadata_json',
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: 'created_at',
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: 'updated_at',
    },
  },
  {
    sequelize,
    tableName: 'documents',
    modelName: 'Document',
    timestamps: true,
    createdAt: 'createdAt',
    updatedAt: 'updatedAt',
    indexes: [
      {
        fields: ['filing_id'],
      },
      {
        fields: ['uploaded_by'],
      },
      {
        fields: ['document_type'],
      },
      {
        fields: ['is_verified'],
      },
      {
        fields: ['verified_by'],
      },
      {
        fields: ['created_at'],
      },
    ],
    hooks: {
      beforeUpdate: (document: Document) => {
        (document as any).updatedAt = new Date();
      },
    },
  }
);

export default Document; 