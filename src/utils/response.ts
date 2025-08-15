import { Response } from 'express';

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message: string;
  timestamp: string;
  errors?: any[];
}

export interface PaginatedResponse<T = any> extends ApiResponse<T> {
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export class ResponseUtil {
  private static createResponse<T>(
    success: boolean,
    message: string,
    data?: T,
    errors?: any[]
  ): ApiResponse<T> {
    return {
      success,
      message,
      data,
      errors,
      timestamp: new Date().toISOString(),
    };
  }

  static success<T>(
    res: Response,
    data?: T,
    message: string = 'Operation successful',
    statusCode: number = 200
  ): Response {
    return res.status(statusCode).json(
      this.createResponse(true, message, data)
    );
  }

  static error(
    res: Response,
    message: string = 'Operation failed',
    statusCode: number = 500,
    errors?: any[]
  ): Response {
    return res.status(statusCode).json(
      this.createResponse(false, message, undefined, errors)
    );
  }

  static validationError(
    res: Response,
    errors: any[],
    message: string = 'Validation failed'
  ): Response {
    return res.status(400).json(
      this.createResponse(false, message, undefined, errors)
    );
  }

  static unauthorized(
    res: Response,
    message: string = 'Unauthorized access'
  ): Response {
    return res.status(401).json(
      this.createResponse(false, message)
    );
  }

  static forbidden(
    res: Response,
    message: string = 'Access forbidden'
  ): Response {
    return res.status(403).json(
      this.createResponse(false, message)
    );
  }

  static notFound(
    res: Response,
    message: string = 'Resource not found'
  ): Response {
    return res.status(404).json(
      this.createResponse(false, message)
    );
  }

  static conflict(
    res: Response,
    message: string = 'Resource conflict'
  ): Response {
    return res.status(409).json(
      this.createResponse(false, message)
    );
  }

  static paginated<T>(
    res: Response,
    data: T[],
    pagination: {
      page: number;
      limit: number;
      total: number;
    },
    message: string = 'Data retrieved successfully'
  ): Response {
    const totalPages = Math.ceil(pagination.total / pagination.limit);
    
    const response: PaginatedResponse<T[]> = {
      success: true,
      message,
      data,
      timestamp: new Date().toISOString(),
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total: pagination.total,
        totalPages,
        hasNext: pagination.page < totalPages,
        hasPrev: pagination.page > 1,
      },
    };

    return res.status(200).json(response);
  }
}

export default ResponseUtil; 