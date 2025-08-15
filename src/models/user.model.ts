import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';
import { User as UserInterface } from '../types/user.types';
import { USER_ROLES } from '../utils/constants';

// Define the attributes for User creation
interface UserCreationAttributes extends Optional<UserInterface, 'id' | 'createdAt' | 'updatedAt'> {}

// User model class
class User extends Model<UserInterface, UserCreationAttributes> implements UserInterface {
  public id!: number;
  public email!: string;
  public passwordHash!: string;
  public fullName!: string;
  public phone?: string;
  public role!: 'admin' | 'ca' | 'customer';
  public isActive!: boolean;
  public isVerified!: boolean;
  public profileImageUrl?: string;
  public lastLoginAt?: Date;

  // Timestamps
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  // Instance methods
  public toJSON(): Partial<UserInterface> {
    const values = Object.assign({}, this.get()) as any;
    delete values.passwordHash; // Never expose password hash
    return values;
  }

  public getPublicProfile(): Partial<UserInterface> {
    return {
      id: this.id,
      email: this.email,
      fullName: this.fullName,
      role: this.role,
      isActive: this.isActive,
      isVerified: this.isVerified,
      profileImageUrl: this.profileImageUrl,
      lastLoginAt: this.lastLoginAt,
      createdAt: this.createdAt,
    };
  }
}

// Initialize the model
User.init(
  {
    id: {
      type: DataTypes.BIGINT,
      autoIncrement: true,
      primaryKey: true,
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true,
      },
    },
    passwordHash: {
      type: DataTypes.STRING(255),
      allowNull: false,
      field: 'password_hash',
    },
    fullName: {
      type: DataTypes.STRING(255),
      allowNull: false,
      field: 'full_name',
      validate: {
        len: [2, 255],
      },
    },
    phone: {
      type: DataTypes.STRING(20),
      allowNull: true,
      validate: {
        is: /^[6-9]\d{9}$/, // Indian phone number format
      },
    },
    role: {
      type: DataTypes.ENUM(...Object.values(USER_ROLES)),
      allowNull: false,
      defaultValue: USER_ROLES.CUSTOMER,
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      field: 'is_active',
    },
    isVerified: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'is_verified',
    },
    profileImageUrl: {
      type: DataTypes.STRING(500),
      allowNull: true,
      field: 'profile_image_url',
    },
    lastLoginAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'last_login_at',
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
    tableName: 'users',
    modelName: 'User',
    timestamps: true,
    createdAt: 'createdAt',
    updatedAt: 'updatedAt',
    indexes: [
      {
        unique: true,
        fields: ['email'],
      },
      {
        fields: ['role'],
      },
      {
        fields: ['is_active'],
      },
      {
        fields: ['is_verified'],
      },
      {
        fields: ['created_at'],
      },
    ],
    hooks: {
      beforeUpdate: (user: User) => {
        (user as any).updatedAt = new Date();
      },
    },
  }
);

export default User; 