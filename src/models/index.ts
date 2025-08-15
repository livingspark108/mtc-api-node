import User from './user.model';
import Client from './client.model';
import Filing from './filing.model';
import Document from './document.model';
import { Notification } from './notification.model';
import { Payment } from './payment.model';
import NotificationSetting from './notification_setting.model';
import PricingPlan from './pricing_plan.model';
import TaxSlab from './tax_slab.model';
import AdminRole from './admin_role.model';
import OnboardingProgress from './onboarding_progress.model';
import OnboardingData from './onboarding_data.model';
import OnboardingFiles from './onboarding_files.model';

// Define associations
const setupAssociations = () => {
  // User associations
  User.hasOne(Client, {
    foreignKey: 'userId',
    as: 'client',
    onDelete: 'CASCADE',
  });

  User.hasMany(Filing, {
    foreignKey: 'caId',
    as: 'assignedFilings',
    onDelete: 'SET NULL',
  });

  User.hasMany(Document, {
    foreignKey: 'uploadedBy',
    as: 'uploadedDocuments',
    onDelete: 'CASCADE',
  });

  User.hasMany(Document, {
    foreignKey: 'verifiedBy',
    as: 'verifiedDocuments',
    onDelete: 'SET NULL',
  });

  User.hasMany(Notification, {
    foreignKey: 'user_id',
    as: 'notifications',
    onDelete: 'CASCADE',
  });

  // Client associations
  Client.belongsTo(User, {
    foreignKey: 'userId',
    as: 'user',
    onDelete: 'CASCADE',
  });

  Client.belongsTo(User, {
    foreignKey: 'caId',
    as: 'assignedCA',
    onDelete: 'SET NULL',
  });

  Client.hasMany(Filing, {
    foreignKey: 'clientId',
    as: 'filings',
    onDelete: 'CASCADE',
  });

  Client.hasMany(Payment, {
    foreignKey: 'client_id',
    as: 'payments',
    onDelete: 'CASCADE',
  });

  // Filing associations
  Filing.belongsTo(Client, {
    foreignKey: 'clientId',
    as: 'client',
    onDelete: 'CASCADE',
  });

  Filing.belongsTo(User, {
    foreignKey: 'caId',
    as: 'assignedCA',
    onDelete: 'SET NULL',
  });

  Filing.hasMany(Document, {
    foreignKey: 'filingId',
    as: 'documents',
    onDelete: 'CASCADE',
  });

  Filing.hasMany(Payment, {
    foreignKey: 'filing_id',
    as: 'payments',
    onDelete: 'SET NULL',
  });

  // Document associations
  Document.belongsTo(Filing, {
    foreignKey: 'filingId',
    as: 'filing',
    onDelete: 'CASCADE',
  });

  Document.belongsTo(User, {
    foreignKey: 'uploadedBy',
    as: 'uploader',
    onDelete: 'CASCADE',
  });

  Document.belongsTo(User, {
    foreignKey: 'verifiedBy',
    as: 'verifier',
    onDelete: 'SET NULL',
  });

  // Notification associations
  Notification.belongsTo(User, {
    foreignKey: 'user_id',
    as: 'user',
    onDelete: 'CASCADE',
  });

  // Payment associations
  Payment.belongsTo(Client, {
    foreignKey: 'client_id',
    as: 'client',
    onDelete: 'CASCADE',
  });

  Payment.belongsTo(Filing, {
    foreignKey: 'filing_id',
    as: 'filing',
    onDelete: 'SET NULL',
  });

  // Onboarding associations
  OnboardingProgress.belongsTo(User, {
    foreignKey: 'userId',
    as: 'user',
    onDelete: 'CASCADE',
  });

  OnboardingData.belongsTo(User, {
    foreignKey: 'userId',
    as: 'user',
    onDelete: 'CASCADE',
  });

  OnboardingFiles.belongsTo(User, {
    foreignKey: 'userId',
    as: 'user',
    onDelete: 'CASCADE',
  });

  // User associations for onboarding
  User.hasOne(OnboardingProgress, {
    foreignKey: 'userId',
    as: 'onboardingProgress',
    onDelete: 'CASCADE',
  });

  User.hasMany(OnboardingData, {
    foreignKey: 'userId',
    as: 'onboardingData',
    onDelete: 'CASCADE',
  });

  User.hasMany(OnboardingFiles, {
    foreignKey: 'userId',
    as: 'onboardingFiles',
    onDelete: 'CASCADE',
  });
};

// Setup associations
setupAssociations();

// Export models
export {
  User,
  Client,
  Filing,
  Document,
  Notification,
  Payment,
  NotificationSetting,
  PricingPlan,
  TaxSlab,
  AdminRole,
  OnboardingProgress,
  OnboardingData,
  OnboardingFiles,
};

// Export associations setup function for testing
export { setupAssociations };

// Default export for convenience
export default {
  User,
  Client,
  Filing,
  Document,
  Notification,
  Payment,
  NotificationSetting,
  PricingPlan,
  TaxSlab,
  AdminRole,
  OnboardingProgress,
  OnboardingData,
  OnboardingFiles,
  setupAssociations,
}; 