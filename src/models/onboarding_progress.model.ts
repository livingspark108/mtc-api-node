import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

interface OnboardingProgressAttributes {
  userId: string;
  currentStep: number;
  totalSteps: number;
  completedSteps: number[];
  lastUpdated: Date;
  isCompleted: boolean;
  paymentStatus: 'pending' | 'completed' | 'failed';
  createdAt: Date;
  updatedAt: Date;
}

interface OnboardingProgressCreationAttributes 
  extends Optional<OnboardingProgressAttributes, 'currentStep' | 'totalSteps' | 'completedSteps' | 'lastUpdated' | 'isCompleted' | 'paymentStatus' | 'createdAt' | 'updatedAt'> {}

class OnboardingProgress extends Model<OnboardingProgressAttributes, OnboardingProgressCreationAttributes> 
  implements OnboardingProgressAttributes {
  public userId!: string;
  public currentStep!: number;
  public totalSteps!: number;
  public completedSteps!: number[];
  public lastUpdated!: Date;
  public isCompleted!: boolean;
  public paymentStatus!: 'pending' | 'completed' | 'failed';
  public createdAt!: Date;
  public updatedAt!: Date;

  // Helper methods
  public isStepCompleted(step: number): boolean {
    return this.completedSteps.includes(step);
  }

  public getCompletionPercentage(): number {
    return Math.round((this.completedSteps.length / this.totalSteps) * 100);
  }

  public canAccessStep(step: number): boolean {
    if (step <= 1) return true;
    return this.completedSteps.includes(step - 1);
  }

  public addCompletedStep(step: number): void {
    if (!this.completedSteps.includes(step)) {
      this.completedSteps.push(step);
      this.completedSteps.sort((a, b) => a - b);
    }
  }

  public removeCompletedStep(step: number): void {
    this.completedSteps = this.completedSteps.filter(s => s !== step);
  }
}

OnboardingProgress.init(
  {
    userId: {
      type: DataTypes.STRING(50),
      primaryKey: true,
      allowNull: false,
    },
    currentStep: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
      validate: {
        min: 1,
        max: 7,
      },
    },
    totalSteps: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 7,
    },
    completedSteps: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: '[]',
      get() {
        const value = this.getDataValue('completedSteps');
        if (typeof value === 'string') {
          try {
            const parsed = JSON.parse(value);
            return Array.isArray(parsed) ? parsed : [];
          } catch (e) {
            return [];
          }
        }
        return value || [];
      },
      set(value: number[]) {
        this.setDataValue('completedSteps', JSON.stringify(value || []) as any);
      }
    },
    lastUpdated: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    isCompleted: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    paymentStatus: {
      type: DataTypes.ENUM('pending', 'completed', 'failed'),
      allowNull: false,
      defaultValue: 'pending',
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
    modelName: 'OnboardingProgress',
    tableName: 'onboarding_progress',
    timestamps: true,
    indexes: [
      {
        fields: ['userId'],
        unique: true,
      },
      {
        fields: ['currentStep'],
      },
      {
        fields: ['isCompleted'],
      },
      {
        fields: ['paymentStatus'],
      },
    ],
  }
);

export default OnboardingProgress; 