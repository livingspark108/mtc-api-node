import swaggerJSDoc from 'swagger-jsdoc';
import config from './index';

const options: swaggerJSDoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'MCT Backend API',
      version: '1.0.0',
      description: 'Complete backend system for the My Tax Club (MCT) platform - a comprehensive tax filing and consultation platform.',
      contact: {
        name: 'MCT Team',
        email: 'support@mytaxclub.com',
      },
      license: {
        name: 'ISC',
      },
    },
    servers: [
      {
        url: `http://localhost:${config.app.port}`,
        description: 'Development server',
      },
      {
        url: `http://localhost:${config.app.port}`,
        description: 'Production server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT token for authentication',
        },
        cookieAuth: {
          type: 'apiKey',
          in: 'cookie',
          name: 'accessToken',
          description: 'JWT token in HTTP-only cookie',
        },
      },
      schemas: {
        ApiResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              description: 'Indicates if the request was successful',
            },
            message: {
              type: 'string',
              description: 'Human-readable message about the operation',
            },
            data: {
              description: 'The response data (varies by endpoint)',
            },
            timestamp: {
              type: 'string',
              format: 'date-time',
              description: 'ISO timestamp of the response',
            },
            errors: {
              type: 'array',
              items: {
                type: 'object',
              },
              description: 'Array of error details (if any)',
            },
          },
        },
        PaginatedResponse: {
          allOf: [
            { $ref: '#/components/schemas/ApiResponse' },
            {
              type: 'object',
              properties: {
                pagination: {
                  type: 'object',
                  properties: {
                    page: {
                      type: 'integer',
                      description: 'Current page number',
                    },
                    limit: {
                      type: 'integer',
                      description: 'Number of items per page',
                    },
                    total: {
                      type: 'integer',
                      description: 'Total number of items',
                    },
                    totalPages: {
                      type: 'integer',
                      description: 'Total number of pages',
                    },
                    hasNext: {
                      type: 'boolean',
                      description: 'Whether there is a next page',
                    },
                    hasPrev: {
                      type: 'boolean',
                      description: 'Whether there is a previous page',
                    },
                  },
                },
              },
            },
          ],
        },
        User: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              description: 'Unique user identifier',
            },
            email: {
              type: 'string',
              format: 'email',
              description: 'User email address',
            },
            fullName: {
              type: 'string',
              description: 'User full name',
            },
            phone: {
              type: 'string',
              description: 'User phone number',
              nullable: true,
            },
            role: {
              type: 'string',
              enum: ['admin', 'ca', 'customer'],
              description: 'User role in the system',
            },
            isActive: {
              type: 'boolean',
              description: 'Whether the user account is active',
            },
            isVerified: {
              type: 'boolean',
              description: 'Whether the user email is verified',
            },
            profileImageUrl: {
              type: 'string',
              format: 'uri',
              description: 'URL to user profile image',
              nullable: true,
            },
            lastLoginAt: {
              type: 'string',
              format: 'date-time',
              description: 'Last login timestamp',
              nullable: true,
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'Account creation timestamp',
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
              description: 'Last update timestamp',
            },
          },
        },
        CreateUserRequest: {
          type: 'object',
          required: ['email', 'password', 'fullName', 'role'],
          properties: {
            email: {
              type: 'string',
              format: 'email',
              description: 'User email address',
            },
            password: {
              type: 'string',
              minLength: 8,
              description: 'User password (min 8 characters, must contain uppercase, lowercase, and number)',
            },
            fullName: {
              type: 'string',
              minLength: 2,
              maxLength: 100,
              description: 'User full name',
            },
            phone: {
              type: 'string',
              description: 'User phone number',
            },
            role: {
              type: 'string',
              enum: ['admin', 'ca', 'customer'],
              description: 'User role in the system',
            },
          },
        },
        UpdateUserRequest: {
          type: 'object',
          properties: {
            fullName: {
              type: 'string',
              minLength: 2,
              maxLength: 100,
              description: 'User full name',
            },
            phone: {
              type: 'string',
              description: 'User phone number',
            },
            profileImageUrl: {
              type: 'string',
              format: 'uri',
              description: 'URL to user profile image',
            },
            isActive: {
              type: 'boolean',
              description: 'Whether the user account is active',
            },
            isVerified: {
              type: 'boolean',
              description: 'Whether the user email is verified',
            },
          },
        },
        LoginRequest: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: {
              type: 'string',
              format: 'email',
              description: 'User email address',
            },
            password: {
              type: 'string',
              description: 'User password',
            },
          },
        },
        AuthResponse: {
          type: 'object',
          properties: {
            user: {
              $ref: '#/components/schemas/User',
            },
            accessToken: {
              type: 'string',
              description: 'JWT access token',
            },
            refreshToken: {
              type: 'string',
              description: 'JWT refresh token',
            },
            expiresIn: {
              type: 'integer',
              description: 'Token expiration time in seconds',
            },
          },
        },
        ErrorResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: false,
            },
            message: {
              type: 'string',
              description: 'Error message',
            },
            timestamp: {
              type: 'string',
              format: 'date-time',
            },
            errors: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  field: {
                    type: 'string',
                    description: 'Field that caused the error',
                  },
                  message: {
                    type: 'string',
                    description: 'Error message for the field',
                  },
                },
              },
            },
          },
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
      {
        cookieAuth: [],
      },
    ],
  },
  apis: [
    './src/routes/*.ts',
    './src/controllers/*.ts',
  ],
};

const specs = swaggerJSDoc(options);
export default specs; 