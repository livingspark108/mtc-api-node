import { DataTypes, Model, Optional, Op } from 'sequelize';
import sequelize from '../config/database';

export interface PaymentAttributes {
  id: number;
  client_id: number;
  filing_id?: number;
  amount: number;
  currency: string;
  status: 'initiated' | 'pending' | 'success' | 'failed' | 'refunded';
  payment_method: 'card' | 'upi' | 'netbanking' | 'wallet';
  gateway_provider?: string;
  gateway_transaction_id?: string;
  gateway_response_json?: any;
  receipt_url?: string;
  refund_amount: number;
  refund_reason?: string;
  created_at: Date;
  updated_at: Date;
}

export interface PaymentCreationAttributes extends Optional<PaymentAttributes, 'id' | 'filing_id' | 'currency' | 'status' | 'gateway_provider' | 'gateway_transaction_id' | 'gateway_response_json' | 'receipt_url' | 'refund_amount' | 'refund_reason' | 'created_at' | 'updated_at'> {}

export class Payment extends Model<PaymentAttributes, PaymentCreationAttributes> implements PaymentAttributes {
  public id!: number;
  public client_id!: number;
  public filing_id?: number;
  public amount!: number;
  public currency!: string;
  public status!: 'initiated' | 'pending' | 'success' | 'failed' | 'refunded';
  public payment_method!: 'card' | 'upi' | 'netbanking' | 'wallet';
  public gateway_provider?: string;
  public gateway_transaction_id?: string;
  public gateway_response_json?: any;
  public receipt_url?: string;
  public refund_amount!: number;
  public refund_reason?: string;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;

  // Static methods
  static async findByClientId(clientId: number, options?: { limit?: number; offset?: number; status?: string }) {
    const whereClause: any = { client_id: clientId };
    
    if (options?.status) {
      whereClause.status = options.status;
    }

    return this.findAll({
      where: whereClause,
      order: [['created_at', 'DESC']],
      limit: options?.limit || 50,
      offset: options?.offset || 0,
    });
  }

  static async findByFilingId(filingId: number) {
    return this.findAll({
      where: { filing_id: filingId },
      order: [['created_at', 'DESC']],
    });
  }

  static async findByGatewayTransactionId(gatewayTransactionId: string) {
    return this.findOne({
      where: { gateway_transaction_id: gatewayTransactionId },
    });
  }

  static async updatePaymentStatus(paymentId: number, status: PaymentAttributes['status'], gatewayResponse?: any) {
    const updateData: any = { status };
    
    if (gatewayResponse) {
      updateData.gateway_response_json = gatewayResponse;
    }

    return this.update(updateData, {
      where: { id: paymentId },
    });
  }

  static async processRefund(paymentId: number, refundAmount: number, reason: string) {
    return this.update(
      {
        status: 'refunded',
        refund_amount: refundAmount,
        refund_reason: reason,
      },
      {
        where: { id: paymentId },
      }
    );
  }

  static async getTotalRevenue(startDate?: Date, endDate?: Date) {
    const whereClause: any = { status: 'success' };
    
    if (startDate && endDate) {
      whereClause.created_at = {
        [Op.between]: [startDate, endDate],
      };
    }

    const result = await this.sum('amount', {
      where: whereClause,
    });

    return result || 0;
  }

  static async getRevenueByPeriod(period: 'daily' | 'weekly' | 'monthly', startDate: Date, endDate: Date) {
    // This would need raw SQL for proper date grouping
    // Implementation depends on specific requirements
    return this.findAll({
      where: {
        status: 'success',
        created_at: {
          [Op.between]: [startDate, endDate],
        },
      },
      order: [['created_at', 'ASC']],
    });
  }
}

Payment.init(
  {
    id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      autoIncrement: true,
    },
    client_id: {
      type: DataTypes.BIGINT,
      allowNull: false,
      references: {
        model: 'clients',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    },
    filing_id: {
      type: DataTypes.BIGINT,
      allowNull: true,
      references: {
        model: 'filings',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    },
    amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      validate: {
        min: 0.01,
        isDecimal: true,
      },
    },
    currency: {
      type: DataTypes.STRING(3),
      allowNull: false,
      defaultValue: 'INR',
      validate: {
        isIn: [['INR', 'USD', 'EUR']],
      },
    },
    status: {
      type: DataTypes.ENUM('initiated', 'pending', 'success', 'failed', 'refunded'),
      allowNull: false,
      defaultValue: 'initiated',
    },
    payment_method: {
      type: DataTypes.ENUM('card', 'upi', 'netbanking', 'wallet'),
      allowNull: false,
    },
    gateway_provider: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    gateway_transaction_id: {
      type: DataTypes.STRING(255),
      allowNull: true,
      unique: true,
    },
    gateway_response_json: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    receipt_url: {
      type: DataTypes.STRING(500),
      allowNull: true,
      validate: {
        isUrl: true,
      },
    },
    refund_amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: 0,
        isDecimal: true,
      },
    },
    refund_reason: {
      type: DataTypes.TEXT,
      allowNull: true,
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
    modelName: 'Payment',
    tableName: 'payments',
    timestamps: true,
    underscored: true,
    indexes: [
      {
        fields: ['client_id'],
      },
      {
        fields: ['filing_id'],
      },
      {
        fields: ['status'],
      },
      {
        fields: ['gateway_transaction_id'],
        unique: true,
      },
      {
        fields: ['created_at'],
      },
      {
        fields: ['status', 'created_at'],
      },
    ],
  }
); 