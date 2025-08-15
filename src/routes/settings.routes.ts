import { Router } from 'express';
import { body } from 'express-validator';
import SettingsController from '../controllers/settings.controller';
import { authenticate, requireAdmin } from '../middleware/auth.middleware';

const router = Router();
const controller = new SettingsController();

// Apply authentication & admin requirement for all routes
router.use(authenticate, requireAdmin);

/* ===== Notifications ===== */
router.get('/notifications', controller.getNotificationSettings);
router.put('/notifications',
  body('email_notifications').optional().isBoolean(),
  body('sms_notifications').optional().isBoolean(),
  body('push_notifications').optional().isBoolean(),
  body('weekly_reports').optional().isBoolean(),
  controller.updateNotificationSettings
);

/* ===== Pricing Plans ===== */
router.get('/pricing-plans', controller.getPricingPlans);
router.post('/pricing-plans',
  body('name').isString().isLength({ min: 2, max: 50 }),
  body('price').isFloat({ min: 0 }),
  body('features').isString().isLength({ max: 500 }),
  body('status').isBoolean(),
  controller.createPricingPlan
);
router.put('/pricing-plans/:planId', controller.updatePricingPlan);
router.patch('/pricing-plans/:planId/status', body('status').isBoolean(), controller.togglePricingPlanStatus);
router.delete('/pricing-plans/:planId', controller.deletePricingPlan);

/* ===== Tax Slabs ===== */
router.get('/tax-slabs', controller.getTaxSlabs);
router.post('/tax-slabs',
  body('regime').isIn(['old','new']),
  body('min_income').isInt({ min: 0 }),
  body('max_income').optional({ nullable: true }).isInt({ min: 0 }),
  body('tax_rate_percent').isFloat({ min: 0, max: 100 }),
  body('surcharge_percent').isFloat({ min: 0, max: 100 }),
  controller.createTaxSlab
);
router.put('/tax-slabs/:slabId', controller.updateTaxSlab);
router.delete('/tax-slabs/:slabId', controller.deleteTaxSlab);

/* ===== Admin Roles ===== */
router.get('/admin-roles', controller.getAdminRoles);
router.put('/admin-roles',
  body('superAdminEmail').isEmail(),
  body('supportAdminEmail').isEmail(),
  controller.updateAdminRoles
);

/* ===== Save All ===== */
router.post('/save-all', controller.saveAllSettings);

export default router; 