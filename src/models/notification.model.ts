import { DataTypes, Model, Optional, Op } from 'sequelize';
import sequelize from '../config/database';

export interface NotificationAttributes {
  id: number;
  user_id: number;
  title: string;
  body: string;
  type: 'info' | 'warning' | 'success' | 'error';
  category: 'filing' | 'payment' | 'document' | 'system';
  is_read: boolean;
  action_url?: string;
  metadata_json?: any;
  expires_at?: Date;
  created_at: Date;
  updated_at: Date;
}

export interface NotificationCreationAttributes extends Optional<NotificationAttributes, 'id' | 'is_read' | 'action_url' | 'metadata_json' | 'expires_at' | 'created_at' | 'updated_at'> {}

export class Notification extends Model<NotificationAttributes, NotificationCreationAttributes> implements NotificationAttributes {
  public id!: number;
  public user_id!: number;
  public title!: string;
  public body!: string;
  public type!: 'info' | 'warning' | 'success' | 'error';
  public category!: 'filing' | 'payment' | 'document' | 'system';
  public is_read!: boolean;
  public action_url?: string;
  public metadata_json?: any;
  public expires_at?: Date;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;

  // Static methods
  static async findByUserId(userId: number, options?: { limit?: number; offset?: number; unreadOnly?: boolean }) {
    const whereClause: any = { user_id: userId };
    
    if (options?.unreadOnly) {
      whereClause.is_read = false;
    }

    return this.findAll({
      where: whereClause,
      order: [['created_at', 'DESC']],
      limit: options?.limit || 50,
      offset: options?.offset || 0,
    });
  }

  static async markAsRead(notificationIds: number[], userId: number) {
    return this.update(
      { is_read: true },
      {
        where: {
          id: notificationIds,
          user_id: userId,
        },
      }
    );
  }

  static async markAllAsRead(userId: number) {
    return this.update(
      { is_read: true },
      {
        where: {
          user_id: userId,
          is_read: false,
        },
      }
    );
  }

  static async getUnreadCount(userId: number): Promise<number> {
    return this.count({
      where: {
        user_id: userId,
        is_read: false,
      },
    });
  }

  static async createNotification(data: NotificationCreationAttributes) {
    return this.create(data);
  }

  static async deleteExpired() {
    return this.destroy({
      where: {
        expires_at: {
          [Op.lt]: new Date(),
        },
      },
    });
  }
}

Notification.init(
  {
    id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      autoIncrement: true,
    },
    user_id: {
      type: DataTypes.BIGINT,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    },
    title: {
      type: DataTypes.STRING(255),
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [1, 255],
      },
    },
    body: {
      type: DataTypes.TEXT,
      allowNull: false,
      validate: {
        notEmpty: true,
      },
    },
    type: {
      type: DataTypes.ENUM('info', 'warning', 'success', 'error'),
      allowNull: false,
      defaultValue: 'info',
    },
    category: {
      type: DataTypes.ENUM('filing', 'payment', 'document', 'system'),
      allowNull: false,
    },
    is_read: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    action_url: {
      type: DataTypes.STRING(500),
      allowNull: true,
      validate: {
        isUrl: true,
      },
    },
    metadata_json: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    expires_at: {
      type: DataTypes.DATE,
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
    modelName: 'Notification',
    tableName: 'notifications',
    timestamps: true,
    underscored: true,
    indexes: [
      {
        fields: ['user_id'],
      },
      {
        fields: ['user_id', 'is_read'],
      },
      {
        fields: ['category'],
      },
      {
        fields: ['created_at'],
      },
      {
        fields: ['expires_at'],
      },
    ],
  }
); 