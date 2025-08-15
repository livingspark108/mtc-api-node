import { Router } from 'express';
import authRoutes from './auth.routes';
import userRoutes from './user.routes';
import clientRoutes from './client.routes';
import filingRoutes from './filing.routes';
import documentRoutes from './document.routes';
import paymentRoutes from './payment.routes';
import dashboardRoutes from './dashboard.routes';
import settingsRoutes from './settings.routes';
import onboardingRoutes from './onboarding.routes';

const router = Router();

// Mount auth routes
router.use('/auth', authRoutes);

// Mount user routes
router.use('/users', userRoutes);

// Mount client routes
router.use('/clients', clientRoutes);

// Mount filing routes
router.use('/filings', filingRoutes);

// Mount document routes
router.use('/documents', documentRoutes);

// Mount payment routes
router.use('/payments', paymentRoutes);

// Mount dashboard routes
router.use('/dashboard', dashboardRoutes);

// Mount settings routes
router.use('/settings', settingsRoutes);

// Mount onboarding routes
router.use('/onboarding', onboardingRoutes);
// router.use('/notifications', notificationRoutes);
// router.use('/settings', settingsRoutes);

export default router; 