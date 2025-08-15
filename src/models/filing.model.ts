import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';
import { Filing as FilingInterface } from '../types/user.types';
import { FILING_TYPES, FILING_STATUS, FILING_PRIORITY } from '../utils/constants';

// Define the attributes for Filing creation
interface FilingCreationAttributes extends Optional<FilingInterface, 'id' | 'createdAt' | 'updatedAt'> {}

// Filing model class
class Filing extends Model<FilingInterface, FilingCreationAttributes> implements FilingInterface {
  public id!: number;
  public clientId!: number;
  public caId?: number;
  public taxYear!: string;
  public filingType!: 'individual' | 'business' | 'capital_gains';
  public status!: 'draft' | 'in_progress' | 'under_review' | 'completed' | 'rejected';
  public priority!: 'low' | 'medium' | 'high' | 'urgent';
  public incomeSourcesJson?: Record<string, any>;
  public deductionsJson?: Record<string, any>;
  public summaryJson?: Record<string, any>;
  public notes?: string;
  public startedAt?: Date;
  public completedAt?: Date;
  public dueDate?: Date;

  // Timestamps
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  // Instance methods
  public getIncomeSources(): Record<string, any> {
    return this.incomeSourcesJson || {};
  }

  public setIncomeSources(sources: Record<string, any>): void {
    this.incomeSourcesJson = sources;
  }

  public getDeductions(): Record<string, any> {
    return this.deductionsJson || {};
  }

  public setDeductions(deductions: Record<string, any>): void {
    this.deductionsJson = deductions;
  }

  public getSummary(): Record<string, any> {
    return this.summaryJson || {};
  }

  public setSummary(summary: Record<string, any>): void {
    this.summaryJson = summary;
  }

  public isOverdue(): boolean {
    if (!this.dueDate) return false;
    return new Date() > this.dueDate && this.status !== 'completed';
  }

  public getDaysUntilDue(): number | null {
    if (!this.dueDate) return null;
    const today = new Date();
    const due = new Date(this.dueDate);
    const diffTime = due.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  public canBeModified(): boolean {
    return ['draft', 'in_progress'].includes(this.status);
  }
}

// Initialize the model
Filing.init(
  {
    id: {
      type: DataTypes.BIGINT,
      autoIncrement: true,
      primaryKey: true,
    },
    clientId: {
      type: DataTypes.BIGINT,
      allowNull: false,
      field: 'client_id',
      references: {
        model: 'clients',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    },
    caId: {
      type: DataTypes.BIGINT,
      allowNull: true,
      field: 'ca_id',
      references: {
        model: 'users',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    },
    taxYear: {
      type: DataTypes.STRING(9),
      allowNull: false,
      field: 'tax_year',
      validate: {
        is: /^\d{4}-\d{4}$/, // Format: YYYY-YYYY
        isValidTaxYear(value: string) {
          const [startYear, endYear] = value.split('-').map(Number);
          if (endYear !== startYear + 1) {
            throw new Error('Tax year must be consecutive years (e.g., 2023-2024)');
          }
        },
      },
    },
    filingType: {
      type: DataTypes.ENUM(...Object.values(FILING_TYPES)),
      allowNull: false,
      field: 'filing_type',
    },
    status: {
      type: DataTypes.ENUM(...Object.values(FILING_STATUS)),
      allowNull: false,
      defaultValue: FILING_STATUS.DRAFT,
    },
    priority: {
      type: DataTypes.ENUM(...Object.values(FILING_PRIORITY)),
      allowNull: false,
      defaultValue: FILING_PRIORITY.MEDIUM,
    },
    incomeSourcesJson: {
      type: DataTypes.JSON,
      allowNull: true,
      field: 'income_sources_json',
    },
    deductionsJson: {
      type: DataTypes.JSON,
      allowNull: true,
      field: 'deductions_json',
    },
    summaryJson: {
      type: DataTypes.JSON,
      allowNull: true,
      field: 'summary_json',
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    startedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'started_at',
    },
    completedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'completed_at',
    },
    dueDate: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'due_date',
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
    tableName: 'filings',
    modelName: 'Filing',
    timestamps: true,
    createdAt: 'createdAt',
    updatedAt: 'updatedAt',
    indexes: [
      {
        fields: ['client_id'],
      },
      {
        fields: ['ca_id'],
      },
      {
        fields: ['status'],
      },
      {
        fields: ['priority'],
      },
      {
        fields: ['filing_type'],
      },
      {
        fields: ['tax_year'],
      },
      {
        fields: ['due_date'],
      },
      {
        fields: ['created_at'],
      },
      {
        unique: true,
        fields: ['client_id', 'tax_year', 'filing_type'],
        name: 'unique_client_tax_year_type',
      },
    ],
    hooks: {
      beforeUpdate: (filing: Filing) => {
        // Set started_at when status changes from draft
        if (filing.changed('status') && filing.status === 'in_progress' && !filing.startedAt) {
          filing.startedAt = new Date();
        }
        
        // Set completed_at when status changes to completed
        if (filing.changed('status') && filing.status === 'completed' && !filing.completedAt) {
          filing.completedAt = new Date();
        }
        
        (filing as any).updatedAt = new Date();
      },
    },
  }
);

export default Filing; 