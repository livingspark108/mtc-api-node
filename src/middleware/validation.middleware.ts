import { Request, Response, NextFunction } from 'express';
import { validationResult, ValidationChain } from 'express-validator';
import ResponseUtil from '../utils/response';
import logger from '../utils/logger';

// Validation middleware that checks for validation errors
export const handleValidationErrors = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const formattedErrors = errors.array().map(error => ({
      field: error.type === 'field' ? (error as any).path : 'unknown',
      message: error.msg,
      value: error.type === 'field' ? (error as any).value : undefined,
    }));

    logger.warn('Validation errors:', {
      url: req.url,
      method: req.method,
      errors: formattedErrors,
    });

    ResponseUtil.validationError(res, formattedErrors);
    return;
  }

  next();
};

// Wrapper function to combine validation chains with error handling
export const validate = (validations: ValidationChain[]) => {
  return [
    ...validations,
    handleValidationErrors,
  ];
};

// Sanitize request body middleware
export const sanitizeBody = (fields: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      if (req.body && typeof req.body === 'object') {
        fields.forEach(field => {
          if (req.body[field] && typeof req.body[field] === 'string') {
            // Basic sanitization - trim whitespace and remove dangerous characters
            req.body[field] = req.body[field]
              .trim()
              .replace(/[<>]/g, '') // Remove < and > to prevent XSS
              .replace(/\0/g, ''); // Remove null bytes
          }
        });
      }
      next();
    } catch (error) {
      logger.error('Sanitization middleware error:', error);
      ResponseUtil.error(res, 'Request sanitization failed', 500);
    }
  };
};

// File validation middleware
export const validateFileUpload = (options: {
  maxSize?: number;
  allowedTypes?: string[];
  required?: boolean;
}) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const file = req.file;
      const { maxSize = 10 * 1024 * 1024, allowedTypes = [], required = true } = options;

      // Check if file is required
      if (required && !file) {
        ResponseUtil.validationError(res, [
          { field: 'file', message: 'File upload is required' }
        ]);
        return;
      }

      // If file is not required and not provided, continue
      if (!required && !file) {
        next();
        return;
      }

      if (file) {
        // Check file size
        if (file.size > maxSize) {
          ResponseUtil.validationError(res, [
            { 
              field: 'file', 
              message: `File size exceeds ${Math.round(maxSize / (1024 * 1024))}MB limit`,
              value: `${Math.round(file.size / (1024 * 1024))}MB`
            }
          ]);
          return;
        }

        // Check file type
        if (allowedTypes.length > 0 && !allowedTypes.includes(file.mimetype)) {
          ResponseUtil.validationError(res, [
            { 
              field: 'file', 
              message: `File type not allowed. Allowed types: ${allowedTypes.join(', ')}`,
              value: file.mimetype
            }
          ]);
          return;
        }

        // Check for potentially dangerous file extensions
        const dangerousExtensions = ['.exe', '.bat', '.cmd', '.scr', '.pif', '.js', '.vbs'];
        const fileExtension = file.originalname.toLowerCase().substring(file.originalname.lastIndexOf('.'));
        
        if (dangerousExtensions.includes(fileExtension)) {
          ResponseUtil.validationError(res, [
            { 
              field: 'file', 
              message: 'File type not allowed for security reasons',
              value: fileExtension
            }
          ]);
          return;
        }
      }

      next();
    } catch (error) {
      logger.error('File validation middleware error:', error);
      ResponseUtil.error(res, 'File validation failed', 500);
    }
  };
};

// JSON validation middleware
export const validateJSON = (field: string) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const value = req.body[field];
      
      if (value !== undefined && value !== null) {
        if (typeof value === 'string') {
          try {
            req.body[field] = JSON.parse(value);
          } catch (error) {
            ResponseUtil.validationError(res, [
              { 
                field, 
                message: 'Invalid JSON format',
                value: value.substring(0, 100) + (value.length > 100 ? '...' : '')
              }
            ]);
            return;
          }
        } else if (typeof value === 'object') {
          // Already parsed, validate it's valid JSON by stringifying and parsing
          try {
            JSON.stringify(value);
          } catch (error) {
            ResponseUtil.validationError(res, [
              { field, message: 'Invalid JSON structure' }
            ]);
            return;
          }
        }
      }

      next();
    } catch (error) {
      logger.error('JSON validation middleware error:', error);
      ResponseUtil.error(res, 'JSON validation failed', 500);
    }
  };
};

// Pagination validation middleware
export const validatePagination = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;

    // Validate page
    if (page < 1) {
      ResponseUtil.validationError(res, [
        { field: 'page', message: 'Page must be greater than 0', value: page }
      ]);
      return;
    }

    // Validate limit
    if (limit < 1 || limit > 100) {
      ResponseUtil.validationError(res, [
        { field: 'limit', message: 'Limit must be between 1 and 100', value: limit }
      ]);
      return;
    }

    // Add validated values to request
    req.query.page = page.toString();
    req.query.limit = limit.toString();

    next();
  } catch (error) {
    logger.error('Pagination validation middleware error:', error);
    ResponseUtil.error(res, 'Pagination validation failed', 500);
  }
};

// Request size validation middleware
export const validateRequestSize = (maxSize: number = 1024 * 1024) => { // 1MB default
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const contentLength = parseInt(req.headers['content-length'] || '0');
      
      if (contentLength > maxSize) {
        ResponseUtil.validationError(res, [
          { 
            field: 'request', 
            message: `Request size exceeds ${Math.round(maxSize / 1024)}KB limit`,
            value: `${Math.round(contentLength / 1024)}KB`
          }
        ]);
        return;
      }

      next();
    } catch (error) {
      logger.error('Request size validation middleware error:', error);
      ResponseUtil.error(res, 'Request size validation failed', 500);
    }
  };
};

// Custom validation middleware factory
export const customValidation = (
  validator: (req: Request) => { valid: boolean; errors: any[] }
) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const result = validator(req);
      
      if (!result.valid) {
        ResponseUtil.validationError(res, result.errors);
        return;
      }

      next();
    } catch (error) {
      logger.error('Custom validation middleware error:', error);
      ResponseUtil.error(res, 'Validation failed', 500);
    }
  };
};

export default {
  handleValidationErrors,
  validate,
  sanitizeBody,
  validateFileUpload,
  validateJSON,
  validatePagination,
  validateRequestSize,
  customValidation,
}; 