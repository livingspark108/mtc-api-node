import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';
import { Client as ClientInterface, AddressInfo } from '../types/user.types';
import { CLIENT_STATUS } from '../utils/constants';

// Define the attributes for Client creation
interface ClientCreationAttributes extends Optional<ClientInterface, 'id' | 'createdAt' | 'updatedAt'> {}

// Client model class
class Client extends Model<ClientInterface, ClientCreationAttributes> implements ClientInterface {
  public id!: number;
  public userId!: number;
  public caId?: number;
  public panNumber!: string;
  public aadharNumber?: string;
  public dateOfBirth!: Date;
  public addressJson!: AddressInfo;
  public occupation?: string;
  public annualIncome?: number;
  public status!: 'active' | 'inactive' | 'suspended';
  public onboardingCompleted!: boolean;
  public profileJson?: Record<string, any>;

  // Timestamps
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  // Instance methods
  public getAddress(): AddressInfo {
    return this.addressJson;
  }

  public setAddress(address: AddressInfo): void {
    this.addressJson = address;
  }

  public getProfile(): Record<string, any> {
    return this.profileJson || {};
  }

  public setProfile(profile: Record<string, any>): void {
    this.profileJson = profile;
  }

  public isOnboardingComplete(): boolean {
    return this.onboardingCompleted && 
           !!this.panNumber && 
           !!this.dateOfBirth && 
           !!this.addressJson;
  }
}

// Initialize the model
Client.init(
  {
    id: {
      type: DataTypes.BIGINT,
      autoIncrement: true,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.BIGINT,
      allowNull: false,
      unique: true,
      field: 'user_id',
      references: {
        model: 'users',
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
    panNumber: {
      type: DataTypes.STRING(10),
      allowNull: false,
      unique: true,
      field: 'pan_number',
      validate: {
        is: /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, // PAN format validation
      },
    },
    aadharNumber: {
      type: DataTypes.STRING(12),
      allowNull: true,
      field: 'aadhar_number',
      validate: {
        is: /^\d{12}$/, // Aadhar format validation
      },
    },
    dateOfBirth: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      field: 'date_of_birth',
      validate: {
        isDate: true,
        isBefore: new Date().toISOString().split('T')[0], // Must be in the past
      },
    },
    addressJson: {
      type: DataTypes.JSON,
      allowNull: false,
      field: 'address_json',
      validate: {
        isValidAddress(value: any) {
          if (!value || typeof value !== 'object') {
            throw new Error('Address must be a valid object');
          }
          const required = ['street', 'city', 'state', 'pincode', 'country'];
          for (const field of required) {
            if (!value[field]) {
              throw new Error(`Address must include ${field}`);
            }
          }
        },
      },
    },
    occupation: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    annualIncome: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: true,
      field: 'annual_income',
      validate: {
        min: 0,
      },
    },
    status: {
      type: DataTypes.ENUM(...Object.values(CLIENT_STATUS)),
      allowNull: false,
      defaultValue: CLIENT_STATUS.ACTIVE,
    },
    onboardingCompleted: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'onboarding_completed',
    },
    profileJson: {
      type: DataTypes.JSON,
      allowNull: true,
      field: 'profile_json',
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
    tableName: 'clients',
    modelName: 'Client',
    timestamps: true,
    createdAt: 'createdAt',
    updatedAt: 'updatedAt',
    indexes: [
      {
        unique: true,
        fields: ['user_id'],
      },
      {
        unique: true,
        fields: ['pan_number'],
      },
      {
        fields: ['ca_id'],
      },
      {
        fields: ['status'],
      },
      {
        fields: ['onboarding_completed'],
      },
      {
        fields: ['created_at'],
      },
    ],
    hooks: {
      beforeCreate: (client: Client) => {
        // Convert PAN to uppercase
        if (client.panNumber) {
          client.panNumber = client.panNumber.toUpperCase();
        }
      },
      beforeUpdate: (client: Client) => {
        // Convert PAN to uppercase
        if (client.panNumber) {
          client.panNumber = client.panNumber.toUpperCase();
        }
        (client as any).updatedAt = new Date();
      },
    },
  }
);

export default Client; 