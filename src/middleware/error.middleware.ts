import { Request, Response, NextFunction } from 'express';
import { ValidationError, DatabaseError, ConnectionError } from 'sequelize';
import ResponseUtil from '../utils/response';
import logger from '../utils/logger';
import config from '../config';

// Custom error class
export class AppError extends Error {
  public statusCode: number;
  public isOperational: boolean;
  public code?: string;

  constructor(message: string, statusCode: number = 500, isOperational: boolean = true, code?: string) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.code = code;

    // Capture stack trace
    Error.captureStackTrace(this, this.constructor);
  }
}

// Error types
export class BadRequestError extends AppError {
  constructor(message: string = 'Bad Request', code?: string) {
    super(message, 400, true, code);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized', code?: string) {
    super(message, 401, true, code);
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = 'Forbidden', code?: string) {
    super(message, 403, true, code);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = 'Not Found', code?: string) {
    super(message, 404, true, code);
  }
}

export class ConflictError extends AppError {
  constructor(message: string = 'Conflict', code?: string) {
    super(message, 409, true, code);
  }
}

export class UnprocessableEntityError extends AppError {
  constructor(message: string = 'Unprocessable Entity', code?: string) {
    super(message, 422, true, code);
  }
}

export class TooManyRequestsError extends AppError {
  constructor(message: string = 'Too Many Requests', code?: string) {
    super(message, 429, true, code);
  }
}

export class InternalServerError extends AppError {
  constructor(message: string = 'Internal Server Error', code?: string) {
    super(message, 500, true, code);
  }
}

// Handle different types of errors
const handleSequelizeValidationError = (error: ValidationError): AppError => {
  const errors = error.errors.map(err => ({
    field: err.path || 'unknown',
    message: err.message,
    value: err.value,
  }));

  return new UnprocessableEntityError('Validation failed', 'VALIDATION_ERROR');
};

const handleSequelizeDatabaseError = (error: DatabaseError): AppError => {
  logger.error('Database error:', error);

  // Handle specific database errors
  if (error.name === 'SequelizeUniqueConstraintError') {
    return new ConflictError('Resource already exists', 'DUPLICATE_RESOURCE');
  }

  if (error.name === 'SequelizeForeignKeyConstraintError') {
    return new BadRequestError('Invalid reference to related resource', 'INVALID_REFERENCE');
  }

  if (error.name === 'SequelizeConnectionError') {
    return new InternalServerError('Database connection failed', 'DATABASE_CONNECTION_ERROR');
  }

  return new InternalServerError('Database operation failed', 'DATABASE_ERROR');
};

const handleSequelizeConnectionError = (error: ConnectionError): AppError => {
  logger.error('Database connection error:', error);
  return new InternalServerError('Database connection failed', 'DATABASE_CONNECTION_ERROR');
};

const handleJWTError = (error: Error): AppError => {
  if (error.name === 'JsonWebTokenError') {
    return new UnauthorizedError('Invalid token', 'INVALID_TOKEN');
  }

  if (error.name === 'TokenExpiredError') {
    return new UnauthorizedError('Token expired', 'TOKEN_EXPIRED');
  }

  return new UnauthorizedError('Authentication failed', 'AUTH_ERROR');
};

const handleMulterError = (error: any): AppError => {
  if (error.code === 'LIMIT_FILE_SIZE') {
    return new BadRequestError('File size too large', 'FILE_SIZE_LIMIT');
  }

  if (error.code === 'LIMIT_FILE_COUNT') {
    return new BadRequestError('Too many files', 'FILE_COUNT_LIMIT');
  }

  if (error.code === 'LIMIT_UNEXPECTED_FILE') {
    return new BadRequestError('Unexpected file field', 'UNEXPECTED_FILE');
  }

  return new BadRequestError('File upload error', 'FILE_UPLOAD_ERROR');
};

// Convert operational errors to AppError
const convertToAppError = (error: any): AppError => {
  // If it's already an AppError, return as is
  if (error instanceof AppError) {
    return error;
  }

  // Handle Sequelize errors
  if (error instanceof ValidationError) {
    return handleSequelizeValidationError(error);
  }

  if (error instanceof DatabaseError) {
    return handleSequelizeDatabaseError(error);
  }

  if (error instanceof ConnectionError) {
    return handleSequelizeConnectionError(error);
  }

  // Handle JWT errors
  if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
    return handleJWTError(error);
  }

  // Handle Multer errors
  if (error.code && error.code.startsWith('LIMIT_')) {
    return handleMulterError(error);
  }

  // Handle validation errors from express-validator
  if (error.array && typeof error.array === 'function') {
    return new UnprocessableEntityError('Validation failed', 'VALIDATION_ERROR');
  }

  // Handle syntax errors
  if (error instanceof SyntaxError && error.message.includes('JSON')) {
    return new BadRequestError('Invalid JSON format', 'INVALID_JSON');
  }

  // Default to internal server error
  logger.error('Unhandled error:', error);
  return new InternalServerError('Something went wrong', 'INTERNAL_ERROR');
};

// Global error handling middleware
export const errorHandler = (
  error: any,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const appError = convertToAppError(error);

  // Log error details
  logger.error('Error occurred:', {
    message: appError.message,
    statusCode: appError.statusCode,
    code: appError.code,
    stack: appError.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    userId: req.user?.id,
  });

  // Prepare error response
  const errorResponse: any = {
    success: false,
    message: appError.message,
    timestamp: new Date().toISOString(),
  };

  // Add error code if available
  if (appError.code) {
    errorResponse.code = appError.code;
  }

  // Add stack trace in development
  if (config.app.env === 'development') {
    errorResponse.stack = appError.stack;
  }

  // Send error response
  res.status(appError.statusCode).json(errorResponse);
};

// 404 handler for undefined routes
export const notFoundHandler = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const error = new NotFoundError(`Route ${req.originalUrl} not found`);
  next(error);
};

// Async error wrapper
export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// Unhandled promise rejection handler
export const handleUnhandledRejection = () => {
  process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
    logger.error('Unhandled Promise Rejection:', {
      reason: reason?.message || reason,
      stack: reason?.stack,
    });

    // Graceful shutdown
    process.exit(1);
  });
};

// Uncaught exception handler
export const handleUncaughtException = () => {
  process.on('uncaughtException', (error: Error) => {
    logger.error('Uncaught Exception:', {
      message: error.message,
      stack: error.stack,
    });

    // Graceful shutdown
    process.exit(1);
  });
};

export default {
  AppError,
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  UnprocessableEntityError,
  TooManyRequestsError,
  InternalServerError,
  errorHandler,
  notFoundHandler,
  asyncHandler,
  handleUnhandledRejection,
  handleUncaughtException,
}; 