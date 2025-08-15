import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

export interface NotificationSettingAttributes {
  id: number;
  email_notifications: boolean;
  sms_notifications: boolean;
  push_notifications: boolean;
  weekly_reports: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface NotificationSettingCreationAttributes extends Optional<NotificationSettingAttributes, 'id' | 'created_at' | 'updated_at'> {}

class NotificationSetting extends Model<NotificationSettingAttributes, NotificationSettingCreationAttributes> implements NotificationSettingAttributes {
  public id!: number;
  public email_notifications!: boolean;
  public sms_notifications!: boolean;
  public push_notifications!: boolean;
  public weekly_reports!: boolean;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;
}

NotificationSetting.init(
  {
    id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      autoIncrement: true,
    },
    email_notifications: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    sms_notifications: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    push_notifications: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    weekly_reports: {
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
    modelName: 'NotificationSetting',
    tableName: 'notification_settings',
    timestamps: true,
    underscored: true,
  }
);

export default NotificationSetting; 