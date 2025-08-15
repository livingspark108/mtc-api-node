import { Request, Response, NextFunction } from 'express';
import { JWTUtil } from '../utils/encryption';
import { AuthenticatedRequest, UserInfo } from '../types/auth.types';
import { User } from '../models';
import ResponseUtil from '../utils/response';
import logger from '../utils/logger';

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: UserInfo;
      accessToken?: string;
    }
  }
}

// Authentication middleware
export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Get token from Authorization header or cookies
    let token: string | undefined;
    
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    } else if (req.cookies?.accessToken) {
      token = req.cookies.accessToken;
    }

    if (!token) {
      ResponseUtil.unauthorized(res, 'Access token is required');
      return;
    }

    // Verify token
    let decoded;
    try {
      decoded = JWTUtil.verifyAccessToken(token);
    } catch (error) {
      ResponseUtil.unauthorized(res, 'Invalid or expired token');
      return;
    }

    // Get user from database
    const user = await User.findByPk(decoded.userId, {
      attributes: ['id', 'email', 'fullName', 'role', 'isActive', 'isVerified', 'profileImageUrl', 'lastLoginAt'],
    });

    if (!user) {
      ResponseUtil.unauthorized(res, 'User not found');
      return;
    }

    if (!user.isActive) {
      ResponseUtil.unauthorized(res, 'Account is deactivated');
      return;
    }

    // Attach user info to request
    req.user = {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      isActive: user.isActive,
      isVerified: user.isVerified,
      profileImageUrl: user.profileImageUrl,
      lastLoginAt: user.lastLoginAt,
    };
    req.accessToken = token;

    next();
  } catch (error) {
    logger.error('Authentication middleware error:', error);
    ResponseUtil.error(res, 'Authentication failed', 500);
  }
};

// Optional authentication middleware (doesn't fail if no token)
export const optionalAuthenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Get token from Authorization header or cookies
    let token: string | undefined;
    
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    } else if (req.cookies?.accessToken) {
      token = req.cookies.accessToken;
    }

    if (!token) {
      next();
      return;
    }

    // Verify token
    let decoded;
    try {
      decoded = JWTUtil.verifyAccessToken(token);
    } catch (error) {
      // Invalid token, but don't fail - just continue without user
      next();
      return;
    }

    // Get user from database
    const user = await User.findByPk(decoded.userId, {
      attributes: ['id', 'email', 'fullName', 'role', 'isActive', 'isVerified', 'profileImageUrl', 'lastLoginAt'],
    });

    if (user && user.isActive) {
      // Attach user info to request
      req.user = {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        isActive: user.isActive,
        isVerified: user.isVerified,
        profileImageUrl: user.profileImageUrl,
        lastLoginAt: user.lastLoginAt,
      };
      req.accessToken = token;
    }

    next();
  } catch (error) {
    logger.error('Optional authentication middleware error:', error);
    // Don't fail the request, just continue without user
    next();
  }
};

// Require email verification middleware
export const requireEmailVerification = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (!req.user) {
    ResponseUtil.unauthorized(res, 'Authentication required');
    return;
  }

  if (!req.user.isVerified) {
    ResponseUtil.forbidden(res, 'Email verification required');
    return;
  }

  next();
};

// Admin only middleware
export const requireAdmin = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (!req.user) {
    ResponseUtil.unauthorized(res, 'Authentication required');
    return;
  }

  if (req.user.role !== 'admin') {
    ResponseUtil.forbidden(res, 'Admin access required');
    return;
  }

  next();
};

// CA only middleware
export const requireCA = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (!req.user) {
    ResponseUtil.unauthorized(res, 'Authentication required');
    return;
  }

  if (req.user.role !== 'ca') {
    ResponseUtil.forbidden(res, 'CA access required');
    return;
  }

  next();
};

// Customer only middleware
export const requireCustomer = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (!req.user) {
    ResponseUtil.unauthorized(res, 'Authentication required');
    return;
  }

  if (req.user.role !== 'customer') {
    ResponseUtil.forbidden(res, 'Customer access required');
    return;
  }

  next();
};

// Multiple roles middleware
export const requireRoles = (allowedRoles: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      ResponseUtil.unauthorized(res, 'Authentication required');
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      ResponseUtil.forbidden(res, 'Insufficient permissions');
      return;
    }

    next();
  };
};

// Resource ownership middleware (for customers accessing their own data)
export const requireOwnership = (userIdField: string = 'userId') => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        ResponseUtil.unauthorized(res, 'Authentication required');
        return;
      }

      // Admin and CA can access any resource
      if (['admin', 'ca'].includes(req.user.role)) {
        next();
        return;
      }

      // For customers, check ownership
      const resourceUserId = req.params[userIdField] || req.body[userIdField];
      
      if (!resourceUserId) {
        ResponseUtil.forbidden(res, 'Resource access denied');
        return;
      }

      if (parseInt(resourceUserId) !== req.user.id) {
        ResponseUtil.forbidden(res, 'You can only access your own resources');
        return;
      }

      next();
    } catch (error) {
      logger.error('Ownership middleware error:', error);
      ResponseUtil.error(res, 'Authorization check failed', 500);
    }
  };
};

export default {
  authenticate,
  optionalAuthenticate,
  requireEmailVerification,
  requireAdmin,
  requireCA,
  requireCustomer,
  requireRoles,
  requireOwnership,
}; 