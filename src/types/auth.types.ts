import { Request } from 'express';
import { UserRole, TokenType } from '../utils/constants';

// User authentication interfaces
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

export interface AuthResponse {
  user: UserInfo;
  accessToken: string;
  refreshToken: string;
}

export interface UserInfo {
  id: number;
  email: string;
  fullName: string;
  role: UserRole;
  isActive: boolean;
  isVerified: boolean;
  profileImageUrl?: string;
  lastLoginAt?: Date;
}

// JWT payload interfaces
export interface JWTPayload {
  userId: number;
  email: string;
  role: UserRole;
  type: TokenType;
  iat?: number;
  exp?: number;
}

export interface AccessTokenPayload extends JWTPayload {
  type: 'access';
}

export interface RefreshTokenPayload extends JWTPayload {
  type: 'refresh';
}

// Password reset interfaces
export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  token: string;
  newPassword: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

// Email verification interfaces
export interface EmailVerificationRequest {
  token: string;
}

export interface ResendVerificationRequest {
  email: string;
}

// Extended Express Request with user info
export interface AuthenticatedRequest extends Request {
  user: UserInfo;
  accessToken?: string;
}

// Middleware interfaces
export interface AuthMiddlewareOptions {
  required?: boolean;
  roles?: UserRole[];
}

export interface RateLimitOptions {
  windowMs: number;
  maxRequests: number;
  message?: string;
  skipSuccessfulRequests?: boolean;
}

// Session interfaces
export interface UserSession {
  userId: number;
  sessionId: string;
  ipAddress: string;
  userAgent: string;
  createdAt: Date;
  expiresAt: Date;
}

// OAuth interfaces (for future implementation)
export interface OAuthProvider {
  name: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export interface OAuthUserInfo {
  id: string;
  email: string;
  name: string;
  picture?: string;
  provider: string;
}

// Two-factor authentication (for future implementation)
export interface TwoFactorAuthSetup {
  secret: string;
  qrCode: string;
  backupCodes: string[];
}

export interface TwoFactorAuthVerification {
  token: string;
  backupCode?: string;
}

// Security audit interfaces
export interface SecurityEvent {
  userId: number;
  eventType: 'login' | 'logout' | 'password_change' | 'failed_login' | 'account_locked';
  ipAddress: string;
  userAgent: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface LoginAttempt {
  email: string;
  ipAddress: string;
  userAgent: string;
  success: boolean;
  timestamp: Date;
  failureReason?: string;
} 