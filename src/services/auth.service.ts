import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { UserRepository } from '../repositories/user.repository';
import config from '../config';
import { UserRole } from '../utils/constants';
import { AppError } from '../middleware/error.middleware';

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  fullName: string;
  phone?: string;
  role?: UserRole;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface TokenPayload {
  userId: number;
  email: string;
  role: UserRole;
  type: 'access' | 'refresh';
}

export class AuthService {
  private userRepository: UserRepository;

  constructor() {
    this.userRepository = new UserRepository();
  }

  async register(registerData: RegisterRequest): Promise<{ user: any; tokens: AuthTokens }> {
    const { email, password, fullName, phone, role = 'customer' } = registerData;

    // Check if user already exists
    const existingUser = await this.userRepository.findByEmail(email);
    if (existingUser) {
      throw new AppError('User with this email already exists', 409);
    }

    // Hash password
    const passwordHash = await this.hashPassword(password);

    // Create user
    const user = await this.userRepository.create({
      email,
      passwordHash,
      fullName,
      phone: phone || undefined,
      role,
      isActive: true,
      isVerified: false,
    });

    // Generate tokens
    const tokens = await this.generateTokens(user.id, user.email, user.role);

    // Update last login
    await this.userRepository.updateLastLogin(user.id);

    return {
      user: user.getPublicProfile(),
      tokens,
    };
  }

  async login(loginData: LoginRequest): Promise<{ user: any; tokens: AuthTokens }> {
    const { email, password } = loginData;

    // Find user by email
    const user = await this.userRepository.findByEmail(email);
    if (!user) {
      throw new AppError('Invalid email or password', 401);
    }

    // Check if user is active
    if (!user.isActive) {
      throw new AppError('Account is deactivated. Please contact support.', 401);
    }

    // Verify password
    const isPasswordValid = await this.verifyPassword(password, user.passwordHash);
    if (!isPasswordValid) {
      throw new AppError('Invalid email or password', 401);
    }

    // Generate tokens
    const tokens = await this.generateTokens(user.id, user.email, user.role);

    // Update last login
    await this.userRepository.updateLastLogin(user.id);

    return {
      user: user.getPublicProfile(),
      tokens,
    };
  }

  async refreshToken(refreshToken: string): Promise<AuthTokens> {
    try {
      // Verify refresh token
      const payload = jwt.verify(refreshToken, config.auth.jwtRefreshSecret) as TokenPayload;

      if (payload.type !== 'refresh') {
        throw new AppError('Invalid token type', 401);
      }

      // Check if user still exists and is active
      const user = await this.userRepository.findById(payload.userId);
      if (!user || !user.isActive) {
        throw new AppError('User not found or inactive', 401);
      }

      // Generate new tokens
      return await this.generateTokens(user.id, user.email, user.role);
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        throw new AppError('Invalid refresh token', 401);
      }
      throw error;
    }
  }

  async changePassword(userId: number, currentPassword: string, newPassword: string): Promise<void> {
    // Find user
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new AppError('User not found', 404);
    }

    // Verify current password
    const isCurrentPasswordValid = await this.verifyPassword(currentPassword, user.passwordHash);
    if (!isCurrentPasswordValid) {
      throw new AppError('Current password is incorrect', 400);
    }

    // Hash new password
    const newPasswordHash = await this.hashPassword(newPassword);

    // Update password
    await this.userRepository.updatePassword(userId, newPasswordHash);
  }

  async forgotPassword(email: string): Promise<string> {
    // Find user by email
    const user = await this.userRepository.findByEmail(email);
    if (!user) {
      // Don't reveal if email exists for security
      return 'If an account with this email exists, a password reset link has been sent.';
    }

    // Generate reset token
    const resetToken = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        type: 'reset_password',
      },
      config.auth.jwtSecret,
      { expiresIn: '1h' } as jwt.SignOptions
    );

    // TODO: Send email with reset token
    // await emailService.sendPasswordResetEmail(user.email, resetToken);

    return 'If an account with this email exists, a password reset link has been sent.';
  }

  async resetPassword(resetToken: string, newPassword: string): Promise<void> {
    try {
      // Verify reset token
      const payload = jwt.verify(resetToken, config.auth.jwtSecret) as any;

      if (payload.type !== 'reset_password') {
        throw new AppError('Invalid token type', 401);
      }

      // Check if user still exists
      const user = await this.userRepository.findById(payload.userId);
      if (!user) {
        throw new AppError('User not found', 404);
      }

      // Hash new password
      const newPasswordHash = await this.hashPassword(newPassword);

      // Update password
      await this.userRepository.updatePassword(user.id, newPasswordHash);
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        throw new AppError('Invalid or expired reset token', 401);
      }
      throw error;
    }
  }

  async verifyToken(token: string): Promise<TokenPayload> {
    try {
      const payload = jwt.verify(token, config.auth.jwtSecret) as TokenPayload;
      
      if (payload.type !== 'access') {
        throw new AppError('Invalid token type', 401);
      }

      // Check if user still exists and is active
      const user = await this.userRepository.findById(payload.userId);
      if (!user || !user.isActive) {
        throw new AppError('User not found or inactive', 401);
      }

      return payload;
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        throw new AppError('Invalid or expired token', 401);
      }
      throw error;
    }
  }

  async logout(refreshToken: string): Promise<void> {
    // TODO: Implement token blacklisting if needed
    // For now, we rely on token expiration
    try {
      jwt.verify(refreshToken, config.auth.jwtRefreshSecret);
      // Token is valid, in a real implementation you might want to blacklist it
    } catch (error) {
      // Token is already invalid, nothing to do
    }
  }

  private async hashPassword(password: string): Promise<string> {
    return await bcrypt.hash(password, config.auth.bcryptRounds);
  }

  private async verifyPassword(password: string, hash: string): Promise<boolean> {
    return await bcrypt.compare(password, hash);
  }

  private async generateTokens(userId: number, email: string, role: UserRole): Promise<AuthTokens> {
    const accessTokenPayload: TokenPayload = {
      userId,
      email,
      role,
      type: 'access',
    };

    const refreshTokenPayload: TokenPayload = {
      userId,
      email,
      role,
      type: 'refresh',
    };

    const accessToken = jwt.sign(
      accessTokenPayload, 
      config.auth.jwtSecret, 
      { expiresIn: config.auth.jwtExpiresIn } as jwt.SignOptions
    );

    const refreshToken = jwt.sign(
      refreshTokenPayload, 
      config.auth.jwtRefreshSecret, 
      { expiresIn: config.auth.jwtRefreshExpiresIn } as jwt.SignOptions
    );

    return {
      accessToken,
      refreshToken,
    };
  }

  async validatePasswordStrength(password: string): Promise<{ isValid: boolean; errors: string[] }> {
    const errors: string[] = [];

    if (password.length < 8) {
      errors.push('Password must be at least 8 characters long');
    }

    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }

    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }

    if (!/[0-9]/.test(password)) {
      errors.push('Password must contain at least one number');
    }

    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      errors.push('Password must contain at least one special character');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
} 