import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

export interface PricingPlanAttributes {
  id: number;
  name: string;
  price: number; // Store as numeric value without currency symbol
  features: string;
  status: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface PricingPlanCreationAttributes extends Optional<PricingPlanAttributes, 'id' | 'created_at' | 'updated_at'> {}

class PricingPlan extends Model<PricingPlanAttributes, PricingPlanCreationAttributes> implements PricingPlanAttributes {
  public id!: number;
  public name!: string;
  public price!: number;
  public features!: string;
  public status!: boolean;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;
}

PricingPlan.init(
  {
    id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      autoIncrement: true,
    },
    name: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
      validate: {
        len: [2, 50],
      },
    },
    price: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      validate: {
        min: 0,
      },
    },
    features: {
      type: DataTypes.STRING(500),
      allowNull: false,
      validate: {
        len: [1, 500],
      },
    },
    status: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    modelName: 'PricingPlan',
    tableName: 'pricing_plans',
    timestamps: true,
    underscored: true,
  }
);

export default PricingPlan; 