import NotificationSetting, { NotificationSettingAttributes } from '../models/notification_setting.model';
import PricingPlan, { PricingPlanAttributes } from '../models/pricing_plan.model';
import TaxSlab, { TaxSlabAttributes } from '../models/tax_slab.model';
import AdminRole from '../models/admin_role.model';
import sequelize from '../config/database';

export interface SaveAllSettingsPayload {
  notifications: Partial<NotificationSettingAttributes>;
  pricingPlans: Partial<PricingPlanAttributes>[];
  taxSlabs: (Partial<TaxSlabAttributes> & { regime: 'old' | 'new' })[];
  adminRoles: {
    superAdminEmail: string;
    supportAdminEmail: string;
  };
}

class SettingsService {
  /* ===================== Notifications ====================== */
  async getNotificationSettings() {
    const [settings] = await NotificationSetting.findOrCreate({
      where: { id: 1 },
      defaults: {
        email_notifications: true,
        sms_notifications: false,
        push_notifications: true,
        weekly_reports: true,
      },
    });
    return settings;
  }

  async updateNotificationSettings(data: Partial<NotificationSettingAttributes>) {
    const settings = await this.getNotificationSettings();
    return settings.update(data);
  }

  /* ===================== Pricing Plans ====================== */
  async getPricingPlans() {
    return PricingPlan.findAll({ order: [['created_at', 'ASC']] });
  }

  async createPricingPlan(data: Omit<PricingPlanAttributes, 'id' | 'created_at' | 'updated_at'>) {
    return PricingPlan.create(data as any);
  }

  async updatePricingPlan(planId: number, data: Partial<PricingPlanAttributes>) {
    const plan = await PricingPlan.findByPk(planId);
    if (!plan) return null;
    return plan.update(data);
  }

  async togglePricingPlanStatus(planId: number, status: boolean) {
    const plan = await PricingPlan.findByPk(planId);
    if (!plan) return null;
    return plan.update({ status });
  }

  async deletePricingPlan(planId: number) {
    return PricingPlan.destroy({ where: { id: planId } });
  }

  /* ===================== Tax Slabs ====================== */
  async getTaxSlabs(regime: 'old' | 'new' = 'old') {
    return TaxSlab.findAll({ where: { regime }, order: [['min_income', 'ASC']] });
  }

  async createTaxSlab(data: Omit<TaxSlabAttributes, 'id' | 'created_at' | 'updated_at'>) {
    return TaxSlab.create(data as any);
  }

  async updateTaxSlab(slabId: number, data: Partial<TaxSlabAttributes>) {
    const slab = await TaxSlab.findByPk(slabId);
    if (!slab) return null;
    return slab.update(data);
  }

  async deleteTaxSlab(slabId: number) {
    return TaxSlab.destroy({ where: { id: slabId } });
  }

  /* ===================== Admin Roles ====================== */
  async getAdminRoles() {
    const roles = await AdminRole.findAll({ where: { is_active: true } });
    const superAdmin = roles.find((r) => r.role === 'super_admin');
    const supportAdmin = roles.find((r) => r.role === 'support_admin');

    return {
      superAdminEmail: superAdmin?.email || null,
      supportAdminEmail: supportAdmin?.email || null,
      roles,
    };
  }

  async updateAdminRoles(superAdminEmail: string, supportAdminEmail: string) {
    // Upsert super admin
    await AdminRole.upsert({
      email: superAdminEmail,
      role: 'super_admin',
      permissions: ['all'],
      is_active: true,
    });

    // Upsert support admin
    await AdminRole.upsert({
      email: supportAdminEmail,
      role: 'support_admin',
      permissions: ['read_users', 'manage_tickets', 'view_reports'],
      is_active: true,
    });

    return this.getAdminRoles();
  }

  /* ===================== Save All ====================== */
  async saveAllSettings(payload: SaveAllSettingsPayload) {
    return sequelize.transaction(async (t) => {
      // Notifications
      if (payload.notifications) {
        await this.updateNotificationSettings(payload.notifications);
      }

      // Pricing plans
      if (payload.pricingPlans) {
        // Upsert each plan. For simplicity, use bulkCreate with updateOnDuplicate
        await PricingPlan.bulkCreate(payload.pricingPlans as any, {
          updateOnDuplicate: ['name', 'price', 'features', 'status', 'updated_at'],
          transaction: t,
        });
      }

      // Tax slabs
      if (payload.taxSlabs) {
        await TaxSlab.bulkCreate(payload.taxSlabs as any, {
          updateOnDuplicate: ['regime', 'min_income', 'max_income', 'tax_rate_percent', 'surcharge_percent', 'updated_at'],
          transaction: t,
        });
      }

      // Admin roles
      if (payload.adminRoles) {
        await this.updateAdminRoles(payload.adminRoles.superAdminEmail, payload.adminRoles.supportAdminEmail);
      }

      return {
        notifications: 'updated',
        pricingPlans: `${payload.pricingPlans?.length ?? 0} plans updated`,
        taxSlabs: `${payload.taxSlabs?.length ?? 0} slabs updated`,
        adminRoles: 'updated',
      };
    });
  }
}

export default SettingsService; 