import { Request, Response } from 'express';
import { AuthService, LoginRequest, RegisterRequest } from '../services/auth.service';
import ResponseUtil from '../utils/response';
import { AppError } from '../middleware/error.middleware';
import logger from '../utils/logger';
import crypto from 'crypto';

export class AuthController {
  private authService: AuthService;

  constructor() {
    this.authService = new AuthService();
  }

  register = async (req: Request, res: Response): Promise<void> => {
    try {
      const registerData: RegisterRequest = req.body;

      // Validate password strength
      const passwordValidation = await this.authService.validatePasswordStrength(registerData.password);
      if (!passwordValidation.isValid) {
        ResponseUtil.error(res, 'Password does not meet requirements', 400, passwordValidation.errors);
        return;
      }

      const result = await this.authService.register(registerData);

      // Set HTTP-only cookies for tokens
      res.cookie('accessToken', result.tokens.accessToken, {
        httpOnly: true,
        secure: process.env['NODE_ENV'] === 'production',
        sameSite: 'strict',
        maxAge: 15 * 60 * 1000, // 15 minutes
      });

      res.cookie('refreshToken', result.tokens.refreshToken, {
        httpOnly: true,
        secure: process.env['NODE_ENV'] === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      });

      logger.info(`User registered successfully: ${result.user.email}`);

      ResponseUtil.success(res, {
        user: result.user,
        tokens: result.tokens,
      }, 'Registration successful', 201);
    } catch (error) {
      logger.error('Registration error:', error);
      if (error instanceof AppError) {
        ResponseUtil.error(res, error.message, error.statusCode);
      } else {
        ResponseUtil.error(res, 'Registration failed', 500);
      }
    }
  };

  login = async (req: Request, res: Response): Promise<void> => {
    try {
      
      const loginData: LoginRequest = req.body;
      console.log('loginData', loginData);
      const result = await this.authService.login(loginData);
      console.log('result', result);

      // Set HTTP-only cookies for tokens
      res.cookie('accessToken', result.tokens.accessToken, {
        httpOnly: true,
        secure: process.env['NODE_ENV'] === 'production',
        sameSite: 'strict',
        maxAge: 15 * 60 * 1000, // 15 minutes
      });

      res.cookie('refreshToken', result.tokens.refreshToken, {
        httpOnly: true,
        secure: process.env['NODE_ENV'] === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      });

      logger.info(`User logged in successfully: ${result.user.email}`);

      ResponseUtil.success(res, {
        user: result.user,
        tokens: result.tokens,
      }, 'Login successful');
    } catch (error) {
      logger.error('Login error:', error);
      if (error instanceof AppError) {
        ResponseUtil.error(res, error.message, error.statusCode);
      } else {
        ResponseUtil.error(res, 'Login failed', 500);
      }
    }
  };

  refreshToken = async (req: Request, res: Response): Promise<void> => {
    try {
      const refreshToken = req.cookies['refreshToken'] || req.body.refreshToken;

      if (!refreshToken) {
        ResponseUtil.error(res, 'Refresh token not provided', 401);
        return;
      }

      const tokens = await this.authService.refreshToken(refreshToken);

      // Set new HTTP-only cookies
      res.cookie('accessToken', tokens.accessToken, {
        httpOnly: true,
        secure: process.env['NODE_ENV'] === 'production',
        sameSite: 'strict',
        maxAge: 15 * 60 * 1000, // 15 minutes
      });

      res.cookie('refreshToken', tokens.refreshToken, {
        httpOnly: true,
        secure: process.env['NODE_ENV'] === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      });

      ResponseUtil.success(res, { tokens }, 'Token refreshed successfully');
    } catch (error) {
      logger.error('Token refresh error:', error);
      if (error instanceof AppError) {
        ResponseUtil.error(res, error.message, error.statusCode);
      } else {
        ResponseUtil.error(res, 'Token refresh failed', 500);
      }
    }
  };

  logout = async (req: Request, res: Response): Promise<void> => {
    try {
      const refreshToken = req.cookies['refreshToken'];

      if (refreshToken) {
        await this.authService.logout(refreshToken);
      }

      // Clear cookies
      res.clearCookie('accessToken');
      res.clearCookie('refreshToken');

      ResponseUtil.success(res, null, 'Logout successful');
    } catch (error) {
      logger.error('Logout error:', error);
      ResponseUtil.error(res, 'Logout failed', 500);
    }
  };

  changePassword = async (req: Request, res: Response): Promise<void> => {
    try {
      const { currentPassword, newPassword } = req.body;
      const userId = (req as any).user.userId;

      // Validate new password strength
      const passwordValidation = await this.authService.validatePasswordStrength(newPassword);
      if (!passwordValidation.isValid) {
        ResponseUtil.error(res, 'New password does not meet requirements', 400, passwordValidation.errors);
        return;
      }

      await this.authService.changePassword(userId, currentPassword, newPassword);

      logger.info(`Password changed successfully for user ID: ${userId}`);

      ResponseUtil.success(res, null, 'Password changed successfully');
    } catch (error) {
      logger.error('Change password error:', error);
      if (error instanceof AppError) {
        ResponseUtil.error(res, error.message, error.statusCode);
      } else {
        ResponseUtil.error(res, 'Password change failed', 500);
      }
    }
  };

  forgotPassword = async (req: Request, res: Response): Promise<void> => {
    try {
      const { email } = req.body;
      const message = await this.authService.forgotPassword(email);

      ResponseUtil.success(res, null, message);
    } catch (error) {
      logger.error('Forgot password error:', error);
      ResponseUtil.error(res, 'Password reset request failed', 500);
    }
  };

  resetPassword = async (req: Request, res: Response): Promise<void> => {
    try {
      const { token, newPassword } = req.body;

      // Validate new password strength
      const passwordValidation = await this.authService.validatePasswordStrength(newPassword);
      if (!passwordValidation.isValid) {
        ResponseUtil.error(res, 'New password does not meet requirements', 400, passwordValidation.errors);
        return;
      }

      await this.authService.resetPassword(token, newPassword);

      ResponseUtil.success(res, null, 'Password reset successful');
    } catch (error) {
      logger.error('Reset password error:', error);
      if (error instanceof AppError) {
        ResponseUtil.error(res, error.message, error.statusCode);
      } else {
        ResponseUtil.error(res, 'Password reset failed', 500);
      }
    }
  };

  verifyToken = async (req: Request, res: Response): Promise<void> => {
    try {
      const token = req.headers.authorization?.replace('Bearer ', '') || req.cookies['accessToken'];

      if (!token) {
        ResponseUtil.error(res, 'Token not provided', 401);
        return;
      }

      const payload = await this.authService.verifyToken(token);

      ResponseUtil.success(res, { payload }, 'Token is valid');
    } catch (error) {
      logger.error('Token verification error:', error);
      if (error instanceof AppError) {
        ResponseUtil.error(res, error.message, error.statusCode);
      } else {
        ResponseUtil.error(res, 'Token verification failed', 500);
      }
    }
  };

  getProfile = async (req: Request, res: Response): Promise<void> => {
    try {
      console.log('req', req);
      const userId = (req as any).user.id;
      console.log('userId', userId);
      const userRepository = new (await import('../repositories/user.repository')).UserRepository();
      const user = await userRepository.findById(userId);

      if (!user) {
        ResponseUtil.error(res, 'User not found', 404);
        return;
      }

      ResponseUtil.success(res, { user: user.getPublicProfile() }, 'Profile retrieved successfully');
    } catch (error) {
      logger.error('Get profile error:', error);
      ResponseUtil.error(res, 'Failed to retrieve profile', 500);
    }
  };
} 