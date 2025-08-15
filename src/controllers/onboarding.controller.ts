import { Request, Response } from 'express';
import OnboardingService from '../services/onboarding.service';
import ResponseUtil from '../utils/response';
import { AppError } from '../middleware/error.middleware';
import logger from '../utils/logger';
import { 
  SaveStepDataRequest, 
  UpdateProgressRequest,
  OnboardingSteps,
  STEP_NAMES 
} from '../types/onboarding.types';

export class OnboardingController {
  private onboardingService: OnboardingService;

  constructor() {
    this.onboardingService = new OnboardingService();
  }

  /**
   * GET /api/onboarding - Get onboarding progress and data
   */
  getOnboardingData = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as any).user.id;
      const step = req.query.step ? parseInt(req.query.step as string) : undefined;

      if (step && (isNaN(step) || step < 1 || step > 7)) {
        ResponseUtil.error(res, 'Invalid step number', 400);
        return;
      }

      const data = await this.onboardingService.getOnboardingData(userId, step);

      logger.info(`Retrieved onboarding data for user ${userId}${step ? ` step ${step}` : ''}`);

      ResponseUtil.success(res, data, 'Onboarding data retrieved successfully');
    } catch (error) {
      logger.error('Error getting onboarding data:', error);
      if (error instanceof AppError) {
        ResponseUtil.error(res, error.message, error.statusCode);
      } else {
        ResponseUtil.error(res, 'Failed to retrieve onboarding data', 500);
      }
    }
  };

  /**
   * POST /api/onboarding - Save step data
   */
  saveStepData = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as any).user.id;
      const { step, stepName, data, markAsCompleted } = req.body;

      // Validate required fields
      if (!step || !stepName || !data) {
        ResponseUtil.error(res, 'Step, stepName, and data are required', 400);
        return;
      }

      // Validate step number
      if (isNaN(step) || step < 1 || step > 7) {
        ResponseUtil.error(res, 'Invalid step number', 400);
        return;
      }

      // Validate step name matches step number
      const expectedStepName = STEP_NAMES[step as OnboardingSteps];
      if (stepName !== expectedStepName) {
        ResponseUtil.error(res, `Step name should be "${expectedStepName}" for step ${step}`, 400);
        return;
      }

      const request: SaveStepDataRequest = {
        userId,
        step,
        stepName,
        data,
        markAsCompleted: markAsCompleted || false,
      };

      const result = await this.onboardingService.saveStepData(request);

      logger.info(`Saved step ${step} data for user ${userId}${markAsCompleted ? ' (marked as completed)' : ''}`);

      ResponseUtil.success(res, result, 'Onboarding data saved successfully');
    } catch (error) {
      logger.error('Error saving step data:', error);
      if (error instanceof AppError) {
        ResponseUtil.error(res, error.message, error.statusCode);
      } else {
        ResponseUtil.error(res, 'Failed to save step data', 500);
      }
    }
  };

  /**
   * PUT /api/onboarding - Update progress
   */
  updateProgress = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as any).user.id;
      const { currentStep, action, additionalData } = req.body;

      // Validate currentStep if provided
      if (currentStep && (isNaN(currentStep) || currentStep < 1 || currentStep > 7)) {
        ResponseUtil.error(res, 'Invalid current step number', 400);
        return;
      }

      // Validate action if provided
      const validActions = ['navigate', 'complete_payment', 'fail_payment', 'reset'];
      if (action && !validActions.includes(action)) {
        ResponseUtil.error(res, `Invalid action. Must be one of: ${validActions.join(', ')}`, 400);
        return;
      }

      const request: UpdateProgressRequest = {
        userId,
        currentStep,
        action,
        additionalData,
      };

      const result = await this.onboardingService.updateProgress(request);

      logger.info(`Updated progress for user ${userId}${action ? ` (action: ${action})` : ''}`);

      ResponseUtil.success(res, result, 'Progress updated successfully');
    } catch (error) {
      logger.error('Error updating progress:', error);
      if (error instanceof AppError) {
        ResponseUtil.error(res, error.message, error.statusCode);
      } else {
        ResponseUtil.error(res, 'Failed to update progress', 500);
      }
    }
  };

  /**
   * DELETE /api/onboarding - Reset onboarding data
   */
  resetOnboarding = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as any).user.id;
      const step = req.query.step ? parseInt(req.query.step as string) : undefined;

      if (step && (isNaN(step) || step < 1 || step > 7)) {
        ResponseUtil.error(res, 'Invalid step number', 400);
        return;
      }

      const result = await this.onboardingService.resetOnboarding(userId, step);

      logger.info(`Reset onboarding for user ${userId}${step ? ` step ${step}` : ' (all data)'}`);

      ResponseUtil.success(res, result, result.message);
    } catch (error) {
      logger.error('Error resetting onboarding:', error);
      if (error instanceof AppError) {
        ResponseUtil.error(res, error.message, error.statusCode);
      } else {
        ResponseUtil.error(res, 'Failed to reset onboarding', 500);
      }
    }
  };

  /**
   * GET /api/onboarding/files - Get files for a specific step
   */
  getStepFiles = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as any).user.id;
      const step = parseInt(req.query.step as string);

      if (isNaN(step) || step < 1 || step > 7) {
        ResponseUtil.error(res, 'Valid step number is required', 400);
        return;
      }

      const files = await this.onboardingService.getStepFiles(userId, step);

      logger.info(`Retrieved ${files.length} files for user ${userId} step ${step}`);

      ResponseUtil.success(res, files, 'Files retrieved successfully');
    } catch (error) {
      logger.error('Error getting step files:', error);
      if (error instanceof AppError) {
        ResponseUtil.error(res, error.message, error.statusCode);
      } else {
        ResponseUtil.error(res, 'Failed to retrieve files', 500);
      }
    }
  };

  /**
   * DELETE /api/onboarding/files/:fileId - Delete a specific file
   */
  deleteFile = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as any).user.id;
      const fileId = parseInt(req.params.fileId);

      if (isNaN(fileId)) {
        ResponseUtil.error(res, 'Invalid file ID', 400);
        return;
      }

      const result = await this.onboardingService.deleteFile(userId, fileId);

      logger.info(`Deleted file ${fileId} for user ${userId}`);

      ResponseUtil.success(res, result, result.message);
    } catch (error) {
      logger.error('Error deleting file:', error);
      if (error instanceof AppError) {
        ResponseUtil.error(res, error.message, error.statusCode);
      } else {
        ResponseUtil.error(res, 'Failed to delete file', 500);
      }
    }
  };

  /**
   * GET /api/onboarding/config - Get step configurations
   */
  getStepConfig = async (req: Request, res: Response): Promise<void> => {
    try {
      const step = req.query.step ? parseInt(req.query.step as string) : undefined;

      if (step) {
        if (isNaN(step) || step < 1 || step > 7) {
          ResponseUtil.error(res, 'Invalid step number', 400);
          return;
        }
        
        const config = this.onboardingService.getStepConfig(step);
        if (!config) {
          ResponseUtil.error(res, 'Step configuration not found', 404);
          return;
        }
        
        ResponseUtil.success(res, config, 'Step configuration retrieved successfully');
      } else {
        const allConfigs = this.onboardingService.getAllStepConfigs();
        ResponseUtil.success(res, allConfigs, 'All step configurations retrieved successfully');
      }
    } catch (error) {
      logger.error('Error getting step config:', error);
      ResponseUtil.error(res, 'Failed to retrieve step configuration', 500);
    }
  };

  /**
   * GET /api/onboarding/progress - Get completion percentage
   */
  getCompletionPercentage = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as any).user.id;
      const percentage = await this.onboardingService.getCompletionPercentage(userId);

      ResponseUtil.success(res, { completionPercentage: percentage }, 'Completion percentage retrieved successfully');
    } catch (error) {
      logger.error('Error getting completion percentage:', error);
      ResponseUtil.error(res, 'Failed to retrieve completion percentage', 500);
    }
  };

  /**
   * GET /api/onboarding/next-step - Get next accessible step
   */
  getNextAccessibleStep = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as any).user.id;
      const nextStep = await this.onboardingService.getNextAccessibleStep(userId);

      ResponseUtil.success(res, { 
        nextStep, 
        stepName: STEP_NAMES[nextStep as OnboardingSteps] 
      }, 'Next accessible step retrieved successfully');
    } catch (error) {
      logger.error('Error getting next accessible step:', error);
      ResponseUtil.error(res, 'Failed to retrieve next accessible step', 500);
    }
  };

  /**
   * POST /api/onboarding/files - Save file information after upload
   */
  saveFileInfo = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as any).user.id;
      const {
        step,
        fileType,
        originalName,
        filePath,
        fileSize,
        mimeType,
        metadata,
      } = req.body;

      // Validate required fields
      if (!step || !fileType || !originalName || !filePath || !fileSize || !mimeType) {
        ResponseUtil.error(res, 'Step, fileType, originalName, filePath, fileSize, and mimeType are required', 400);
        return;
      }

      // Validate step number
      if (isNaN(step) || step < 1 || step > 7) {
        ResponseUtil.error(res, 'Invalid step number', 400);
        return;
      }

      const fileInfo = await this.onboardingService.saveFileInfo({
        userId,
        step,
        fileType,
        originalName,
        filePath,
        fileSize,
        mimeType,
        metadata,
      });

      logger.info(`Saved file info for user ${userId} step ${step}: ${originalName}`);

      ResponseUtil.success(res, fileInfo, 'File information saved successfully');
    } catch (error) {
      logger.error('Error saving file info:', error);
      if (error instanceof AppError) {
        ResponseUtil.error(res, error.message, error.statusCode);
      } else {
        ResponseUtil.error(res, 'Failed to save file information', 500);
      }
    }
  };
}

export default OnboardingController; 