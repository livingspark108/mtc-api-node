import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import SettingsService from '../services/settings.service';
import ResponseUtil from '../utils/response';
import logger from '../utils/logger';

class SettingsController {
  private service: SettingsService;

  constructor() {
    this.service = new SettingsService();
  }

  /* =========== Notifications ========== */
  getNotificationSettings = async (_req: Request, res: Response) => {
    try {
      const settings = await this.service.getNotificationSettings();
      return ResponseUtil.success(res, settings, 'Notification settings retrieved');
    } catch (error) {
      logger.error('Error fetching notification settings:', error);
      return ResponseUtil.error(res, 'Failed to fetch settings', 500);
    }
  };

  updateNotificationSettings = async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return ResponseUtil.validationError(res, errors.array());
      }
      const updated = await this.service.updateNotificationSettings(req.body);
      return ResponseUtil.success(res, updated, 'Notification settings updated successfully');
    } catch (error) {
      logger.error('Error updating notification settings:', error);
      return ResponseUtil.error(res, 'Failed to update settings', 500);
    }
  };

  /* =========== Pricing Plans ========== */
  getPricingPlans = async (_req: Request, res: Response) => {
    try {
      const plans = await this.service.getPricingPlans();
      return ResponseUtil.success(res, plans, 'Pricing plans fetched');
    } catch (error) {
      logger.error('Error fetching pricing plans:', error);
      return ResponseUtil.error(res, 'Failed to fetch pricing plans', 500);
    }
  };

  createPricingPlan = async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return ResponseUtil.validationError(res, errors.array());
      }
      const newPlan = await this.service.createPricingPlan(req.body);
      return ResponseUtil.success(res, newPlan, 'Pricing plan created', 201);
    } catch (error: any) {
      logger.error('Error creating pricing plan:', error);
      return ResponseUtil.error(res, error.message || 'Failed to create pricing plan', 500);
    }
  };

  updatePricingPlan = async (req: Request, res: Response) => {
    try {
      const planId = parseInt(req.params.planId);
      if (isNaN(planId)) return ResponseUtil.error(res, 'Invalid plan ID', 400);
      const plan = await this.service.updatePricingPlan(planId, req.body);
      if (!plan) return ResponseUtil.error(res, 'Pricing plan not found', 404);
      return ResponseUtil.success(res, plan, 'Pricing plan updated');
    } catch (error) {
      logger.error('Error updating pricing plan:', error);
      return ResponseUtil.error(res, 'Failed to update pricing plan', 500);
    }
  };

  togglePricingPlanStatus = async (req: Request, res: Response) => {
    try {
      const planId = parseInt(req.params.planId);
      if (isNaN(planId)) return ResponseUtil.error(res, 'Invalid plan ID', 400);
      const { status } = req.body;
      const plan = await this.service.togglePricingPlanStatus(planId, status);
      if (!plan) return ResponseUtil.error(res, 'Pricing plan not found', 404);
      return ResponseUtil.success(res, plan, 'Pricing plan status updated');
    } catch (error) {
      logger.error('Error toggling pricing plan status:', error);
      return ResponseUtil.error(res, 'Failed to toggle status', 500);
    }
  };

  deletePricingPlan = async (req: Request, res: Response) => {
    try {
      const planId = parseInt(req.params.planId);
      if (isNaN(planId)) return ResponseUtil.error(res, 'Invalid plan ID', 400);
      await this.service.deletePricingPlan(planId);
      return ResponseUtil.success(res, null, 'Pricing plan deleted');
    } catch (error) {
      logger.error('Error deleting pricing plan:', error);
      return ResponseUtil.error(res, 'Failed to delete pricing plan', 500);
    }
  };

  /* =========== Tax Slabs ========== */
  getTaxSlabs = async (req: Request, res: Response) => {
    try {
      const regime = (req.query.regime as 'old' | 'new') || 'old';
      const slabs = await this.service.getTaxSlabs(regime);
      return ResponseUtil.success(res, { regime, slabs }, 'Tax slabs fetched');
    } catch (error) {
      logger.error('Error fetching tax slabs:', error);
      return ResponseUtil.error(res, 'Failed to fetch tax slabs', 500);
    }
  };

  createTaxSlab = async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return ResponseUtil.validationError(res, errors.array());
      }
      const slab = await this.service.createTaxSlab(req.body);
      return ResponseUtil.success(res, slab, 'Tax slab created', 201);
    } catch (error) {
      logger.error('Error creating tax slab:', error);
      return ResponseUtil.error(res, 'Failed to create tax slab', 500);
    }
  };

  updateTaxSlab = async (req: Request, res: Response) => {
    try {
      const slabId = parseInt(req.params.slabId);
      if (isNaN(slabId)) return ResponseUtil.error(res, 'Invalid slab ID', 400);
      const slab = await this.service.updateTaxSlab(slabId, req.body);
      if (!slab) return ResponseUtil.error(res, 'Tax slab not found', 404);
      return ResponseUtil.success(res, slab, 'Tax slab updated');
    } catch (error) {
      logger.error('Error updating tax slab:', error);
      return ResponseUtil.error(res, 'Failed to update tax slab', 500);
    }
  };

  deleteTaxSlab = async (req: Request, res: Response) => {
    try {
      const slabId = parseInt(req.params.slabId);
      if (isNaN(slabId)) return ResponseUtil.error(res, 'Invalid slab ID', 400);
      await this.service.deleteTaxSlab(slabId);
      return ResponseUtil.success(res, null, 'Tax slab deleted');
    } catch (error) {
      logger.error('Error deleting tax slab:', error);
      return ResponseUtil.error(res, 'Failed to delete tax slab', 500);
    }
  };

  /* =========== Admin Roles ========== */
  getAdminRoles = async (_req: Request, res: Response) => {
    try {
      const data = await this.service.getAdminRoles();
      return ResponseUtil.success(res, data, 'Admin roles fetched');
    } catch (error) {
      logger.error('Error fetching admin roles:', error);
      return ResponseUtil.error(res, 'Failed to fetch admin roles', 500);
    }
  };

  updateAdminRoles = async (req: Request, res: Response) => {
    try {
      const { superAdminEmail, supportAdminEmail } = req.body;
      if (!superAdminEmail || !supportAdminEmail) {
        return ResponseUtil.error(res, 'Both emails are required', 400);
      }
      const data = await this.service.updateAdminRoles(superAdminEmail, supportAdminEmail);
      return ResponseUtil.success(res, data, 'Admin roles updated');
    } catch (error) {
      logger.error('Error updating admin roles:', error);
      return ResponseUtil.error(res, 'Failed to update admin roles', 500);
    }
  };

  /* =========== Save All ========== */
  saveAllSettings = async (req: Request, res: Response) => {
    try {
      const summary = await this.service.saveAllSettings(req.body);
      return ResponseUtil.success(res, summary, 'All settings saved successfully');
    } catch (error) {
      logger.error('Error saving all settings:', error);
      return ResponseUtil.error(res, 'Failed to save settings', 500);
    }
  };
}

export default SettingsController; 