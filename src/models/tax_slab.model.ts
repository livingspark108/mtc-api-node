import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

export interface TaxSlabAttributes {
  id: number;
  regime: 'old' | 'new';
  min_income: number;
  max_income?: number | null;
  tax_rate_percent: number;
  surcharge_percent: number;
  created_at: Date;
  updated_at: Date;
}

export interface TaxSlabCreationAttributes extends Optional<TaxSlabAttributes, 'id' | 'max_income' | 'created_at' | 'updated_at'> {}

class TaxSlab extends Model<TaxSlabAttributes, TaxSlabCreationAttributes> implements TaxSlabAttributes {
  public id!: number;
  public regime!: 'old' | 'new';
  public min_income!: number;
  public max_income?: number | null;
  public tax_rate_percent!: number;
  public surcharge_percent!: number;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;
}

TaxSlab.init(
  {
    id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      autoIncrement: true,
    },
    regime: {
      type: DataTypes.ENUM('old', 'new'),
      allowNull: false,
      defaultValue: 'old',
    },
    min_income: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        min: 0,
      },
    },
    max_income: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    tax_rate_percent: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: false,
      validate: {
        min: 0,
        max: 100,
      },
    },
    surcharge_percent: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: false,
      validate: {
        min: 0,
        max: 100,
      },
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
    modelName: 'TaxSlab',
    tableName: 'tax_slabs',
    timestamps: true,
    underscored: true,
    indexes: [
      {
        fields: ['regime'],
      },
      {
        fields: ['min_income'],
      },
    ],
  }
);

export default TaxSlab; 