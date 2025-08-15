import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import ResponseUtil from '../utils/response';
import logger from '../utils/logger';
import UserService from '../services/user.service';
import { UserSearchFilters, CreateUserRequest, UpdateUserRequest } from '../types/user.types';
import { UserRole } from '../utils/constants';

export class UserController {
  private userService: UserService;

  constructor() {
    this.userService = new UserService();
  }

  async getAllUsers(req: Request, res: Response): Promise<Response> {
    try {
      const filters: UserSearchFilters = {
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 10,
        role: req.query.role as UserRole,
        isActive: req.query.isActive === 'true' ? true : req.query.isActive === 'false' ? false : undefined,
        isVerified: req.query.isVerified === 'true' ? true : req.query.isVerified === 'false' ? false : undefined,
        search: req.query.search as string,
        sortBy: req.query.sortBy as string || 'createdAt',
        sortOrder: (req.query.sortOrder as 'asc' | 'desc') || 'desc',
      };

      const result = await this.userService.getAllUsers(filters);

      return ResponseUtil.paginated(res, result.data, result.pagination);
    } catch (error: any) {
      logger.error('Error fetching users:', error);
      if (error.statusCode) {
        return ResponseUtil.error(res, error.message, error.statusCode);
      }
      return ResponseUtil.error(res, 'Failed to fetch users', 500);
    }
  }

  async getUserById(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      const userId = parseInt(id);

      if (!userId || isNaN(userId)) {
        return ResponseUtil.error(res, 'Invalid user ID', 400);
      }

      const user = await this.userService.getUserById(userId);

      if (!user) {
        return ResponseUtil.error(res, 'User not found', 404);
      }

      return ResponseUtil.success(res, user, 'User retrieved successfully');
    } catch (error: any) {
      logger.error(`Error fetching user ${req.params.id}:`, error);
      if (error.statusCode) {
        return ResponseUtil.error(res, error.message, error.statusCode);
      }
      return ResponseUtil.error(res, 'Failed to fetch user', 500);
    }
  }

  async createUser(req: Request, res: Response): Promise<Response> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return ResponseUtil.validationError(res, errors.array());
      }

      const userData: CreateUserRequest = {
        email: req.body.email,
        password: req.body.password,
        fullName: req.body.fullName,
        phone: req.body.phone,
        role: req.body.role || 'customer',
      };

      const newUser = await this.userService.createUser(userData);

      // Remove sensitive data from response
      const { passwordHash, ...userResponse } = newUser as any;

      return ResponseUtil.success(res, userResponse, 'User created successfully', 201);
    } catch (error: any) {
      logger.error('Error creating user:', error);
      if (error.statusCode) {
        return ResponseUtil.error(res, error.message, error.statusCode);
      }
      return ResponseUtil.error(res, 'Failed to create user', 500);
    }
  }

  async updateUser(req: Request, res: Response): Promise<Response> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return ResponseUtil.validationError(res, errors.array());
      }

      const { id } = req.params;
      const userId = parseInt(id);

      if (!userId || isNaN(userId)) {
        return ResponseUtil.error(res, 'Invalid user ID', 400);
      }

      const updateData: UpdateUserRequest = {
        fullName: req.body.fullName,
        phone: req.body.phone,
        profileImageUrl: req.body.profileImageUrl,
        isActive: req.body.isActive,
        isVerified: req.body.isVerified,
      };

      const updatedUser = await this.userService.updateUser(userId, updateData);

      if (!updatedUser) {
        return ResponseUtil.error(res, 'User not found', 404);
      }

      // Remove sensitive data from response
      const { passwordHash, ...userResponse } = updatedUser as any;

      return ResponseUtil.success(res, userResponse, 'User updated successfully');
    } catch (error: any) {
      logger.error(`Error updating user ${req.params.id}:`, error);
      if (error.statusCode) {
        return ResponseUtil.error(res, error.message, error.statusCode);
      }
      return ResponseUtil.error(res, 'Failed to update user', 500);
    }
  }

  async deleteUser(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      const userId = parseInt(id);

      if (!userId || isNaN(userId)) {
        return ResponseUtil.error(res, 'Invalid user ID', 400);
      }

      const deleted = await this.userService.deleteUser(userId);

      if (!deleted) {
        return ResponseUtil.error(res, 'User not found', 404);
      }

      return ResponseUtil.success(res, null, 'User deleted successfully');
    } catch (error: any) {
      logger.error(`Error deleting user ${req.params.id}:`, error);
      if (error.statusCode) {
        return ResponseUtil.error(res, error.message, error.statusCode);
      }
      return ResponseUtil.error(res, 'Failed to delete user', 500);
    }
  }

  async activateUser(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      const userId = parseInt(id);

      if (!userId || isNaN(userId)) {
        return ResponseUtil.error(res, 'Invalid user ID', 400);
      }

      const user = await this.userService.activateUser(userId);

      if (!user) {
        return ResponseUtil.error(res, 'User not found', 404);
      }

      // Remove sensitive data from response
      const { passwordHash, ...userResponse } = user as any;

      return ResponseUtil.success(res, userResponse, 'User activated successfully');
    } catch (error: any) {
      logger.error(`Error activating user ${req.params.id}:`, error);
      if (error.statusCode) {
        return ResponseUtil.error(res, error.message, error.statusCode);
      }
      return ResponseUtil.error(res, 'Failed to activate user', 500);
    }
  }

  async deactivateUser(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      const userId = parseInt(id);

      if (!userId || isNaN(userId)) {
        return ResponseUtil.error(res, 'Invalid user ID', 400);
      }

      const user = await this.userService.deactivateUser(userId);

      if (!user) {
        return ResponseUtil.error(res, 'User not found', 404);
      }

      // Remove sensitive data from response
      const { passwordHash, ...userResponse } = user as any;

      return ResponseUtil.success(res, userResponse, 'User deactivated successfully');
    } catch (error: any) {
      logger.error(`Error deactivating user ${req.params.id}:`, error);
      if (error.statusCode) {
        return ResponseUtil.error(res, error.message, error.statusCode);
      }
      return ResponseUtil.error(res, 'Failed to deactivate user', 500);
    }
  }

  async changeUserRole(req: Request, res: Response): Promise<Response> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return ResponseUtil.validationError(res, errors.array());
      }

      const { id } = req.params;
      const { role } = req.body;
      const userId = parseInt(id);

      if (!userId || isNaN(userId)) {
        return ResponseUtil.error(res, 'Invalid user ID', 400);
      }

      const user = await this.userService.changeUserRole(userId, role as UserRole);

      if (!user) {
        return ResponseUtil.error(res, 'User not found', 404);
      }

      // Remove sensitive data from response
      const { passwordHash, ...userResponse } = user as any;

      return ResponseUtil.success(res, userResponse, 'User role updated successfully');
    } catch (error: any) {
      logger.error(`Error changing user role ${req.params.id}:`, error);
      if (error.statusCode) {
        return ResponseUtil.error(res, error.message, error.statusCode);
      }
      return ResponseUtil.error(res, 'Failed to change user role', 500);
    }
  }
}

export default UserController; 