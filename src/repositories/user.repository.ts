import { Op, WhereOptions } from 'sequelize';
import User from '../models/user.model';
import { UserRole } from '../utils/constants';

export interface UserFilters {
  role?: UserRole;
  isActive?: boolean;
  isVerified?: boolean;
  search?: string;
}

export interface UserCreateData {
  email: string;
  passwordHash: string;
  fullName: string;
  phone?: string | undefined;
  role: UserRole;
  isActive: boolean;
  isVerified: boolean;
  profileImageUrl?: string;
}

export interface UserUpdateData {
  fullName?: string;
  phone?: string;
  role?: UserRole;
  isActive?: boolean;
  isVerified?: boolean;
  profileImageUrl?: string;
  lastLoginAt?: Date;
}

export class UserRepository {
  async create(userData: UserCreateData): Promise<User> {
    return await User.create(userData);
  }

  async findById(id: number): Promise<User | null> {
    return await User.findByPk(id);
  }

  async findByEmail(email: string): Promise<User | null> {
    return await User.findOne({
      where: { email },
    });
  }

  async findAll(filters: UserFilters = {}, limit = 50, offset = 0): Promise<{ users: User[]; total: number }> {
    const whereClause: WhereOptions = {};

    if (filters.role) {
      whereClause['role'] = filters.role;
    }

    if (typeof filters.isActive === 'boolean') {
      whereClause['isActive'] = filters.isActive;
    }

    if (typeof filters.isVerified === 'boolean') {
      whereClause['isVerified'] = filters.isVerified;
    }

    if (filters.search) {
      (whereClause as any)[Op.or] = [
        { fullName: { [Op.like]: `%${filters.search}%` } },
        { email: { [Op.like]: `%${filters.search}%` } },
        { phone: { [Op.like]: `%${filters.search}%` } },
      ];
    }

    const { count, rows } = await User.findAndCountAll({
      where: whereClause,
      limit,
      offset,
      order: [['createdAt', 'DESC']],
    });

    return {
      users: rows,
      total: count,
    };
  }

  async update(id: number, updateData: UserUpdateData): Promise<User | null> {
    const [affectedRows] = await User.update(updateData, {
      where: { id },
    });

    if (affectedRows === 0) {
      return null;
    }

    return await this.findById(id);
  }

  async delete(id: number): Promise<boolean> {
    const deletedRows = await User.destroy({
      where: { id },
    });

    return deletedRows > 0;
  }

  async updatePassword(id: number, passwordHash: string): Promise<boolean> {
    const [affectedRows] = await User.update(
      { passwordHash },
      { where: { id } }
    );

    return affectedRows > 0;
  }

  async updateLastLogin(id: number): Promise<boolean> {
    const [affectedRows] = await User.update(
      { lastLoginAt: new Date() },
      { where: { id } }
    );

    return affectedRows > 0;
  }

  async countByRole(role: UserRole): Promise<number> {
    return await User.count({
      where: { role, isActive: true },
    });
  }

  async findActiveUsers(role?: UserRole): Promise<User[]> {
    const whereClause: WhereOptions = { isActive: true };
    
    if (role) {
      whereClause['role'] = role;
    }

    return await User.findAll({
      where: whereClause,
      order: [['fullName', 'ASC']],
    });
  }

  async findUnverifiedUsers(olderThanDays = 7): Promise<User[]> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    return await User.findAll({
      where: {
        isVerified: false,
        createdAt: {
          [Op.lt]: cutoffDate,
        },
      },
    });
  }

  async getTotalCount(): Promise<number> {
    return await User.count();
  }
} 