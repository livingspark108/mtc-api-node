import { Transaction } from 'sequelize';
import sequelize from '../config/database';
import OnboardingProgress from '../models/onboarding_progress.model';
import OnboardingData from '../models/onboarding_data.model';
import OnboardingFiles from '../models/onboarding_files.model';
import User from '../models/user.model';
import { AppError } from '../middleware/error.middleware';
import logger from '../utils/logger';
import {
  OnboardingProgressResponse,
  OnboardingStepResponse,
  OnboardingFileInfo,
  OnboardingApiResponse,
  SaveStepDataRequest,
  UpdateProgressRequest,
  StepValidationResult,
  OnboardingSteps,
  STEP_NAMES,
  STEP_CONFIGS,
  PaymentStatus,
} from '../types/onboarding.types';

export class OnboardingService {
  /**
   * Get complete onboarding progress and data for a user
   */
  async getOnboardingData(userId: string, step?: number): Promise<OnboardingApiResponse> {
    try {
      // Verify user exists
      const user = await User.findByPk(userId);
      if (!user) {
        throw new AppError('User not found', 404);
      }

      // Get or create progress record
      let progress = await OnboardingProgress.findByPk(userId);
      if (!progress) {
        progress = await OnboardingProgress.create({ userId });
      }

      // Get step data
      let stepData: OnboardingStepResponse | undefined;
      let allStepsData: OnboardingStepResponse[] = [];

      if (step) {
        const data = await OnboardingData.findOne({
          where: { userId, step },
        });
        if (data) {
          stepData = this.formatStepData(data);
        }
      } else {
        const allData = await OnboardingData.findAll({
          where: { userId },
          order: [['step', 'ASC']],
        });
        allStepsData = allData.map(data => this.formatStepData(data));
      }

      // Get files
      const files = await OnboardingFiles.findAll({
        where: { userId },
        order: [['uploadedAt', 'DESC']],
      });

      const response: OnboardingApiResponse = {
        progress: this.formatProgressData(progress),
        stepData,
        allStepsData: allStepsData.length > 0 ? allStepsData : undefined,
        files: files.map(file => this.formatFileInfo(file)),
        stepConfig: step ? STEP_CONFIGS[step] : undefined,
      };

      return response;
    } catch (error) {
      logger.error('Error getting onboarding data:', error);
      throw error;
    }
  }

  /**
   * Save step data and update progress
   */
  async saveStepData(request: SaveStepDataRequest): Promise<OnboardingApiResponse> {
    const transaction = await sequelize.transaction();
    
    try {
      const { userId, step, stepName, data, markAsCompleted = false } = request;

      // Validate step
      if (step < 1 || step > 7) {
        throw new AppError('Invalid step number', 400);
      }

      // Validate user exists
      const user = await User.findByPk(userId);
      if (!user) {
        throw new AppError('User not found', 404);
      }

      // Validate step access
      const progress = await OnboardingProgress.findByPk(userId);
      if (progress && !progress.canAccessStep(step)) {
        throw new AppError('Step not accessible. Complete previous steps first.', 403);
      }

      // Validate step data
      const validationResult = await this.validateStepData(step, data);
      if (!validationResult.isValid) {
        throw new AppError(`Validation failed: ${validationResult.errors.join(', ')}`, 400);
      }

      // Save or update step data
      const [stepData, created] = await OnboardingData.upsert({
        userId,
        step,
        stepName,
        data,
        completedAt: markAsCompleted ? new Date() : null,
      }, {
        transaction,
      });

      // Update progress
      let progressRecord = await OnboardingProgress.findByPk(userId);
      if (!progressRecord) {
        progressRecord = await OnboardingProgress.create({ userId }, { transaction });
      }

      if (markAsCompleted) {
        progressRecord.addCompletedStep(step);
      }

      // Update current step if moving forward
      if (step > progressRecord.currentStep) {
        progressRecord.currentStep = step;
      }

      // Check if all steps are completed
      progressRecord.isCompleted = progressRecord.completedSteps.length === progressRecord.totalSteps;
      
      progressRecord.lastUpdated = new Date();
      await progressRecord.save({ transaction });

      await transaction.commit();

      // Return updated data
      return await this.getOnboardingData(userId, step);
    } catch (error) {
      await transaction.rollback();
      logger.error('Error saving step data:', error);
      throw error;
    }
  }

  /**
   * Update progress (navigation, payment status, etc.)
   */
  async updateProgress(request: UpdateProgressRequest): Promise<OnboardingProgressResponse> {
    const transaction = await sequelize.transaction();
    
    try {
      const { userId, currentStep, action, additionalData } = request;

      // Get or create progress record
      let progress = await OnboardingProgress.findByPk(userId);
      if (!progress) {
        progress = await OnboardingProgress.create({ userId }, { transaction });
      }

      // Handle different actions
      switch (action) {
        case 'navigate':
          if (currentStep && currentStep >= 1 && currentStep <= 7) {
            if (progress.canAccessStep(currentStep)) {
              progress.currentStep = currentStep;
            } else {
              throw new AppError('Cannot navigate to this step. Complete previous steps first.', 403);
            }
          }
          break;

        case 'complete_payment':
          progress.paymentStatus = PaymentStatus.COMPLETED;
          progress.addCompletedStep(7); // Mark payment step as completed
          progress.isCompleted = true;
          break;

        case 'fail_payment':
          progress.paymentStatus = PaymentStatus.FAILED;
          progress.removeCompletedStep(7); // Remove payment step completion
          progress.isCompleted = false;
          break;

        case 'reset':
          // Reset progress but keep saved data
          progress.currentStep = 1;
          progress.completedSteps = [];
          progress.isCompleted = false;
          progress.paymentStatus = PaymentStatus.PENDING;
          break;

        default:
          if (currentStep) {
            progress.currentStep = currentStep;
          }
      }

      progress.lastUpdated = new Date();
      await progress.save({ transaction });

      await transaction.commit();

      return this.formatProgressData(progress);
    } catch (error) {
      await transaction.rollback();
      logger.error('Error updating progress:', error);
      throw error;
    }
  }

  /**
   * Reset onboarding progress and data
   */
  async resetOnboarding(userId: string, step?: number): Promise<{ success: boolean; message: string }> {
    const transaction = await sequelize.transaction();
    
    try {
      if (step) {
        // Reset specific step
        await OnboardingData.destroy({
          where: { userId, step },
          transaction,
        });

        // Remove from completed steps
        const progress = await OnboardingProgress.findByPk(userId);
        if (progress) {
          progress.removeCompletedStep(step);
          progress.lastUpdated = new Date();
          await progress.save({ transaction });
        }

        await transaction.commit();
        return { success: true, message: `Step ${step} reset successfully` };
      } else {
        // Reset all progress and data
        await OnboardingData.destroy({
          where: { userId },
          transaction,
        });

        await OnboardingFiles.destroy({
          where: { userId },
          transaction,
        });

        await OnboardingProgress.destroy({
          where: { userId },
          transaction,
        });

        await transaction.commit();
        return { success: true, message: 'All onboarding data reset successfully' };
      }
    } catch (error) {
      await transaction.rollback();
      logger.error('Error resetting onboarding:', error);
      throw error;
    }
  }

  /**
   * Save uploaded file information
   */
  async saveFileInfo(fileInfo: {
    userId: string;
    step: number;
    fileType: string;
    originalName: string;
    filePath: string;
    fileSize: number;
    mimeType: string;
    metadata?: any;
  }): Promise<OnboardingFileInfo> {
    try {
      const file = await OnboardingFiles.create(fileInfo);
      return this.formatFileInfo(file);
    } catch (error) {
      logger.error('Error saving file info:', error);
      throw error;
    }
  }

  /**
   * Get files for a specific step
   */
  async getStepFiles(userId: string, step: number): Promise<OnboardingFileInfo[]> {
    try {
      const files = await OnboardingFiles.findAll({
        where: { userId, step },
        order: [['uploadedAt', 'DESC']],
      });

      return files.map(file => this.formatFileInfo(file));
    } catch (error) {
      logger.error('Error getting step files:', error);
      throw error;
    }
  }

  /**
   * Delete a file
   */
  async deleteFile(userId: string, fileId: number): Promise<{ success: boolean; message: string }> {
    try {
      const file = await OnboardingFiles.findOne({
        where: { id: fileId, userId },
      });

      if (!file) {
        throw new AppError('File not found', 404);
      }

      await file.destroy();
      return { success: true, message: 'File deleted successfully' };
    } catch (error) {
      logger.error('Error deleting file:', error);
      throw error;
    }
  }

  /**
   * Validate step data
   */
  private async validateStepData(step: number, data: any): Promise<StepValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    const config = STEP_CONFIGS[step];
    if (!config) {
      errors.push('Invalid step configuration');
      return { isValid: false, errors, warnings };
    }

    // Validate required fields
    for (const field of config.requiredFields) {
      if (!data[field] || (Array.isArray(data[field]) && data[field].length === 0)) {
        errors.push(`${field} is required`);
      }
    }

    // Step-specific validation
    switch (step) {
      case OnboardingSteps.INCOME_TYPES:
        if (!data.selectedIncomeTypes || !Array.isArray(data.selectedIncomeTypes) || data.selectedIncomeTypes.length === 0) {
          errors.push('At least one income type must be selected');
        }
        break;

      case OnboardingSteps.PAYMENT:
        if (!data.selectedPackageId || !data.amount) {
          errors.push('Package selection and amount are required');
        }
        break;

      // Add more validation as needed
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Format progress data for API response
   */
  private formatProgressData(progress: OnboardingProgress): OnboardingProgressResponse {
    return {
      userId: progress.userId,
      currentStep: progress.currentStep,
      totalSteps: progress.totalSteps,
      completedSteps: progress.completedSteps,
      lastUpdated: progress.lastUpdated.toISOString(),
      isCompleted: progress.isCompleted,
      paymentStatus: progress.paymentStatus,
      completionPercentage: progress.getCompletionPercentage(),
    };
  }

  /**
   * Format step data for API response
   */
  private formatStepData(data: OnboardingData): OnboardingStepResponse {
    return {
      userId: data.userId,
      step: data.step,
      stepName: data.stepName,
      data: data.data,
      completedAt: data.completedAt ? data.completedAt.toISOString() : null,
      updatedAt: data.updatedAt.toISOString(),
    };
  }

  /**
   * Format file info for API response
   */
  private formatFileInfo(file: OnboardingFiles): OnboardingFileInfo {
    return {
      id: file.id,
      fileName: file.originalName,
      originalName: file.originalName,
      fileSize: file.fileSize,
      mimeType: file.mimeType,
      uploadedAt: file.uploadedAt.toISOString(),
      filePath: file.filePath,
      fileType: file.fileType,
      metadata: file.metadata,
    };
  }

  /**
   * Get step configuration
   */
  getStepConfig(step: number) {
    return STEP_CONFIGS[step] || null;
  }

  /**
   * Get all step configurations
   */
  getAllStepConfigs() {
    return STEP_CONFIGS;
  }

  /**
   * Calculate completion percentage
   */
  async getCompletionPercentage(userId: string): Promise<number> {
    try {
      const progress = await OnboardingProgress.findByPk(userId);
      if (!progress) {
        return 0;
      }
      return progress.getCompletionPercentage();
    } catch (error) {
      logger.error('Error calculating completion percentage:', error);
      return 0;
    }
  }

  /**
   * Get next accessible step
   */
  async getNextAccessibleStep(userId: string): Promise<number> {
    try {
      const progress = await OnboardingProgress.findByPk(userId);
      if (!progress) {
        return 1;
      }

      for (let step = 1; step <= progress.totalSteps; step++) {
        if (!progress.isStepCompleted(step)) {
          return step;
        }
      }

      return progress.totalSteps; // All steps completed
    } catch (error) {
      logger.error('Error getting next accessible step:', error);
      return 1;
    }
  }
}

export default OnboardingService; 