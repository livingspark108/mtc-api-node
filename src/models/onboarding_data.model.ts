import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

interface OnboardingDataAttributes {
  id: number;
  userId: string;
  step: number;
  stepName: string;
  data: any;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

interface OnboardingDataCreationAttributes 
  extends Optional<OnboardingDataAttributes, 'id' | 'completedAt' | 'createdAt' | 'updatedAt'> {}

class OnboardingData extends Model<OnboardingDataAttributes, OnboardingDataCreationAttributes> 
  implements OnboardingDataAttributes {
  public id!: number;
  public userId!: string;
  public step!: number;
  public stepName!: string;
  public data!: any;
  public completedAt!: Date | null;
  public createdAt!: Date;
  public updatedAt!: Date;

  // Helper methods
  public isStepCompleted(): boolean {
    return this.completedAt !== null;
  }

  public markAsCompleted(): void {
    this.completedAt = new Date();
  }

  public markAsIncomplete(): void {
    this.completedAt = null;
  }
}

OnboardingData.init(
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
    stepName: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    data: {
      type: DataTypes.JSON,
      allowNull: false,
    },
    completedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    modelName: 'OnboardingData',
    tableName: 'onboarding_data',
    timestamps: true,
    indexes: [
      {
        fields: ['userId', 'step'],
        unique: true,
      },
      {
        fields: ['userId'],
      },
      {
        fields: ['step'],
      },
      {
        fields: ['stepName'],
      },
      {
        fields: ['completedAt'],
      },
    ],
  }
);

export default OnboardingData; 