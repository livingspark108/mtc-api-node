import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

export interface AdminRoleAttributes {
  id: number;
  email: string;
  role: string; // e.g., super_admin, support_admin, etc.
  permissions: string[]; // stored as JSON
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface AdminRoleCreationAttributes extends Optional<AdminRoleAttributes, 'id' | 'permissions' | 'is_active' | 'created_at' | 'updated_at'> {}

class AdminRole extends Model<AdminRoleAttributes, AdminRoleCreationAttributes> implements AdminRoleAttributes {
  public id!: number;
  public email!: string;
  public role!: string;
  public permissions!: string[];
  public is_active!: boolean;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;
}

AdminRole.init(
  {
    id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      autoIncrement: true,
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true,
      },
    },
    role: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    permissions: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: [],
    },
    is_active: {
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
    modelName: 'AdminRole',
    tableName: 'admin_roles',
    timestamps: true,
    underscored: true,
    indexes: [
      {
        fields: ['email'],
      },
      {
        fields: ['role'],
      },
    ],
  }
);

export default AdminRole; 