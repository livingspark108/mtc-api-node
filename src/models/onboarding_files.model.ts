import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

interface OnboardingFilesAttributes {
  id: number;
  userId: string;
  step: number;
  fileType: string;
  originalName: string;
  filePath: string;
  fileSize: number;
  mimeType: string;
  metadata: any;
  uploadedAt: Date;
}

interface OnboardingFilesCreationAttributes 
  extends Optional<OnboardingFilesAttributes, 'id' | 'metadata' | 'uploadedAt'> {}

class OnboardingFiles extends Model<OnboardingFilesAttributes, OnboardingFilesCreationAttributes> 
  implements OnboardingFilesAttributes {
  public id!: number;
  public userId!: string;
  public step!: number;
  public fileType!: string;
  public originalName!: string;
  public filePath!: string;
  public fileSize!: number;
  public mimeType!: string;
  public metadata!: any;
  public uploadedAt!: Date;

  // Helper methods
  public getFileSizeInMB(): number {
    return Math.round((this.fileSize / (1024 * 1024)) * 100) / 100;
  }

  public isImage(): boolean {
    return this.mimeType.startsWith('image/');
  }

  public isPDF(): boolean {
    return this.mimeType === 'application/pdf';
  }

  public getFileExtension(): string {
    return this.originalName.split('.').pop()?.toLowerCase() || '';
  }
}

OnboardingFiles.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    userId: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    step: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        min: 1,
        max: 7,
      },
    },
    fileType: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    originalName: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    filePath: {
      type: DataTypes.STRING(500),
      allowNull: false,
    },
    fileSize: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    mimeType: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    metadata: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    uploadedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    modelName: 'OnboardingFiles',
    tableName: 'onboarding_files',
    timestamps: false,
    indexes: [
      {
        fields: ['userId'],
      },
      {
        fields: ['step'],
      },
      {
        fields: ['fileType'],
      },
      {
        fields: ['userId', 'step'],
      },
      {
        fields: ['uploadedAt'],
      },
    ],
  }
);

export default OnboardingFiles; 