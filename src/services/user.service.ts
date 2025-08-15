import bcrypt from 'bcrypt';
import { UserRepository, UserFilters, UserCreateData, UserUpdateData } from '../repositories/user.repository';
import { 
  User, 
  CreateUserRequest, 
  UpdateUserRequest, 
  UserProfile,
  UserSearchFilters 
} from '../types/user.types';
import { UserRole, USER_ROLES, PAGINATION_DEFAULTS } from '../utils/constants';
import logger from '../utils/logger';

export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface UserServiceError {
  message: string;
  code: string;
  statusCode: number;
}

export class UserService {
  private userRepository: UserRepository;

  constructor() {
    this.userRepository = new UserRepository();
  }

  async createUser(userData: CreateUserRequest): Promise<User> {
    try {
      // Check if user already exists
      const existingUser = await this.userRepository.findByEmail(userData.email);
      if (existingUser) {
        throw this.createError('User with this email already exists', 'DUPLICATE_EMAIL', 409);
      }

      // Validate role
      if (!Object.values(USER_ROLES).includes(userData.role)) {
        throw this.createError('Invalid user role', 'INVALID_ROLE', 400);
      }

      // Hash password
      const saltRounds = 12;
      const passwordHash = await bcrypt.hash(userData.password, saltRounds);

      const createData: UserCreateData = {
        email: userData.email.toLowerCase().trim(),
        passwordHash,
        fullName: userData.fullName.trim(),
        phone: userData.phone?.trim(),
        role: userData.role,
        isActive: true,
        isVerified: false,
      };

      const user = await this.userRepository.create(createData);
      
      logger.info(`User created: ${user.id}`, { 
        email: user.email, 
        role: user.role 
      });

      return user;
    } catch (error) {
      logger.error('Error creating user:', error);
      if (error instanceof Error && 'statusCode' in error) {
        throw error;
      }
      throw this.createError('Failed to create user', 'CREATE_ERROR', 500);
    }
  }

  async getUserById(id: number): Promise<UserProfile | null> {
    try {
      const user = await this.userRepository.findById(id);
      if (!user) {
        return null;
      }

      return this.transformToUserProfile(user);
    } catch (error) {
      logger.error(`Error fetching user ${id}:`, error);
      throw this.createError('Failed to fetch user', 'FETCH_ERROR', 500);
    }
  }

  async getUserByEmail(email: string): Promise<User | null> {
    try {
      return await this.userRepository.findByEmail(email.toLowerCase().trim());
    } catch (error) {
      logger.error(`Error fetching user by email ${email}:`, error);
      throw this.createError('Failed to fetch user', 'FETCH_ERROR', 500);
    }
  }

  async getAllUsers(filters: UserSearchFilters = {}): Promise<PaginatedResult<UserProfile>> {
    try {
      const page = filters.page || PAGINATION_DEFAULTS.PAGE;
      const limit = Math.min(filters.limit || PAGINATION_DEFAULTS.LIMIT, PAGINATION_DEFAULTS.MAX_LIMIT);
      const offset = (page - 1) * limit;

      const userFilters: UserFilters = {
        role: filters.role,
        isActive: filters.isActive,
        isVerified: filters.isVerified,
        search: filters.search?.trim(),
      };

      const { users, total } = await this.userRepository.findAll(userFilters, limit, offset);

      const userProfiles = users.map(user => this.transformToUserProfile(user));

      return {
        data: userProfiles,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasNext: page < Math.ceil(total / limit),
          hasPrev: page > 1,
        },
      };
    } catch (error) {
      logger.error('Error fetching users:', error);
      throw this.createError('Failed to fetch users', 'FETCH_ERROR', 500);
    }
  }

  async updateUser(id: number, updateData: UpdateUserRequest): Promise<User | null> {
    try {
      const user = await this.userRepository.findById(id);
      if (!user) {
        throw this.createError('User not found', 'NOT_FOUND', 404);
      }

      const updateFields: UserUpdateData = {};

      if (updateData.fullName !== undefined) {
        updateFields.fullName = updateData.fullName.trim();
      }

      if (updateData.phone !== undefined) {
        updateFields.phone = updateData.phone?.trim();
      }

      if (updateData.profileImageUrl !== undefined) {
        updateFields.profileImageUrl = updateData.profileImageUrl;
      }

      if (updateData.isActive !== undefined) {
        updateFields.isActive = updateData.isActive;
      }

      if (updateData.isVerified !== undefined) {
        updateFields.isVerified = updateData.isVerified;
      }

      const updatedUser = await this.userRepository.update(id, updateFields);
      
      if (updatedUser) {
        logger.info(`User updated: ${id}`, { 
          changes: Object.keys(updateFields) 
        });
      }

      return updatedUser;
    } catch (error) {
      logger.error(`Error updating user ${id}:`, error);
      if (error instanceof Error && 'statusCode' in error) {
        throw error;
      }
      throw this.createError('Failed to update user', 'UPDATE_ERROR', 500);
    }
  }

  async deleteUser(id: number): Promise<boolean> {
    try {
      const user = await this.userRepository.findById(id);
      if (!user) {
        throw this.createError('User not found', 'NOT_FOUND', 404);
      }

      // Prevent deletion of admin users (business rule)
      if (user.role === USER_ROLES.ADMIN) {
        throw this.createError('Cannot delete admin users', 'FORBIDDEN_ACTION', 403);
      }

      const deleted = await this.userRepository.delete(id);
      
      if (deleted) {
        logger.info(`User deleted: ${id}`, { 
          email: user.email, 
          role: user.role 
        });
      }

      return deleted;
    } catch (error) {
      logger.error(`Error deleting user ${id}:`, error);
      if (error instanceof Error && 'statusCode' in error) {
        throw error;
      }
      throw this.createError('Failed to delete user', 'DELETE_ERROR', 500);
    }
  }

  async activateUser(id: number): Promise<User | null> {
    try {
      const user = await this.userRepository.findById(id);
      if (!user) {
        throw this.createError('User not found', 'NOT_FOUND', 404);
      }

      if (user.isActive) {
        throw this.createError('User is already active', 'ALREADY_ACTIVE', 400);
      }

      const updatedUser = await this.userRepository.update(id, { isActive: true });
      
      if (updatedUser) {
        logger.info(`User activated: ${id}`, { email: user.email });
      }

      return updatedUser;
    } catch (error) {
      logger.error(`Error activating user ${id}:`, error);
      if (error instanceof Error && 'statusCode' in error) {
        throw error;
      }
      throw this.createError('Failed to activate user', 'ACTIVATION_ERROR', 500);
    }
  }

  async deactivateUser(id: number): Promise<User | null> {
    try {
      const user = await this.userRepository.findById(id);
      if (!user) {
        throw this.createError('User not found', 'NOT_FOUND', 404);
      }

      if (!user.isActive) {
        throw this.createError('User is already inactive', 'ALREADY_INACTIVE', 400);
      }

      // Prevent deactivation of admin users (business rule)
      if (user.role === USER_ROLES.ADMIN) {
        throw this.createError('Cannot deactivate admin users', 'FORBIDDEN_ACTION', 403);
      }

      const updatedUser = await this.userRepository.update(id, { isActive: false });
      
      if (updatedUser) {
        logger.info(`User deactivated: ${id}`, { email: user.email });
      }

      return updatedUser;
    } catch (error) {
      logger.error(`Error deactivating user ${id}:`, error);
      if (error instanceof Error && 'statusCode' in error) {
        throw error;
      }
      throw this.createError('Failed to deactivate user', 'DEACTIVATION_ERROR', 500);
    }
  }

  async changeUserRole(id: number, newRole: UserRole): Promise<User | null> {
    try {
      const user = await this.userRepository.findById(id);
      if (!user) {
        throw this.createError('User not found', 'NOT_FOUND', 404);
      }

      if (!Object.values(USER_ROLES).includes(newRole)) {
        throw this.createError('Invalid user role', 'INVALID_ROLE', 400);
      }

      if (user.role === newRole) {
        throw this.createError(`User already has role: ${newRole}`, 'SAME_ROLE', 400);
      }

      // Business rule: Only admins can change roles (this should be enforced at controller level)
      // Additional business rules can be added here

      const updatedUser = await this.userRepository.update(id, { 
        role: newRole
      });
      
      if (updatedUser) {
        logger.info(`User role changed: ${id}`, { 
          email: user.email, 
          oldRole: user.role, 
          newRole 
        });
      }

      return updatedUser;
    } catch (error) {
      logger.error(`Error changing user role ${id}:`, error);
      if (error instanceof Error && 'statusCode' in error) {
        throw error;
      }
      throw this.createError('Failed to change user role', 'ROLE_CHANGE_ERROR', 500);
    }
  }

  async updatePassword(id: number, newPassword: string): Promise<boolean> {
    try {
      const user = await this.userRepository.findById(id);
      if (!user) {
        throw this.createError('User not found', 'NOT_FOUND', 404);
      }

      const saltRounds = 12;
      const passwordHash = await bcrypt.hash(newPassword, saltRounds);

      const updated = await this.userRepository.updatePassword(id, passwordHash);
      
      if (updated) {
        logger.info(`Password updated for user: ${id}`, { email: user.email });
      }

      return updated;
    } catch (error) {
      logger.error(`Error updating password for user ${id}:`, error);
      if (error instanceof Error && 'statusCode' in error) {
        throw error;
      }
      throw this.createError('Failed to update password', 'PASSWORD_UPDATE_ERROR', 500);
    }
  }

  async updateLastLogin(id: number): Promise<boolean> {
    try {
      return await this.userRepository.updateLastLogin(id);
    } catch (error) {
      logger.error(`Error updating last login for user ${id}:`, error);
      // Don't throw error for this operation as it's not critical
      return false;
    }
  }

  async getUserStats(): Promise<{ total: number; admins: number; cas: number; customers: number; }> {
    try {
      const [total, admins, cas, customers] = await Promise.all([
        this.userRepository.countByRole(USER_ROLES.ADMIN),
        this.userRepository.countByRole(USER_ROLES.ADMIN),
        this.userRepository.countByRole(USER_ROLES.CA),
        this.userRepository.countByRole(USER_ROLES.CUSTOMER),
      ]);

      return {
        total: admins + cas + customers,
        admins,
        cas,
        customers,
      };
    } catch (error) {
      logger.error('Error fetching user stats:', error);
      throw this.createError('Failed to fetch user statistics', 'STATS_ERROR', 500);
    }
  }

  async getActiveCAUsers(): Promise<User[]> {
    try {
      return await this.userRepository.findActiveUsers(USER_ROLES.CA);
    } catch (error) {
      logger.error('Error fetching active CA users:', error);
      throw this.createError('Failed to fetch CA users', 'FETCH_ERROR', 500);
    }
  }

  private transformToUserProfile(user: User): UserProfile {
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      phone: user.phone,
      role: user.role,
      isActive: user.isActive,
      isVerified: user.isVerified,
      profileImageUrl: user.profileImageUrl,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
      // Note: client, caProfile, and settings would be populated by separate services
      // when needed through dedicated endpoints
    };
  }

  private createError(message: string, code: string, statusCode: number): Error & UserServiceError {
    const error = new Error(message) as Error & UserServiceError;
    error.code = code;
    error.statusCode = statusCode;
    return error;
  }
}

export default UserService; 