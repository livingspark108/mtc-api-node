import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import swaggerUi from 'swagger-ui-express';
import swaggerSpecs from './config/swagger';

import config from './config';
import logger from './utils/logger';
import ResponseUtil from './utils/response';
import { errorHandler, notFoundHandler } from './middleware/error.middleware';
import { testConnection } from './config/database';
import { testRedisConnection } from './config/redis';

// Import models to ensure they are initialized
import './models';

// Import routes
import routes from './routes';

// Create Express application
const app: Application = express();

// Trust proxy for rate limiting and IP detection
app.set('trust proxy', 1);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

// CORS configuration
app.use(cors({
  origin: config.app.frontendOrigin,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}));

// Compression middleware
app.use(compression());

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Cookie parser
app.use(cookieParser());

// Logging middleware
if (config.app.env !== 'test') {
  app.use(morgan('combined', {
    stream: {
      write: (message: string) => {
        logger.info(message.trim());
      },
    },
  }));
}

// Rate limiting
const generalLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxRequests,
  message: {
    success: false,
    message: 'Too many requests, please try again later',
    timestamp: new Date().toISOString(),
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 hour it is temporary for testing purpose only 15 minutes need to change it to 15 minutes
  max: 50, // 5 attempts per window it is temporary for testing purpose only 5 attempts per window need to change it to 50 attempts per window
  message: {
    success: false,
    message: 'Too many authentication attempts, please try again later',
    timestamp: new Date().toISOString(),
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply rate limiting
app.use('/api/', generalLimiter);
app.use('/api/v1/auth/', authLimiter);

// Health check endpoint
app.get('/health', async (_req: Request, res: Response) => {
  try {
    // Test database connection
    let databaseStatus = 'healthy';
    try {
      await testConnection();
    } catch (error) {
      databaseStatus = 'unhealthy';
      logger.warn('Database health check failed:', error);
    }
    
    // Test Redis connection (optional, don't fail if Redis is down)
    let redisStatus = 'healthy';
    try {
      await testRedisConnection();
    } catch (error) {
      redisStatus = 'unhealthy';
      logger.warn('Redis health check failed:', error);
    }

    const healthData = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: config.app.env,
      version: process.env['npm_package_version'] || '1.0.0',
      services: {
        database: databaseStatus,
        redis: redisStatus,
      },
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
      },
    };

    ResponseUtil.success(res, healthData, 'System is healthy');
  } catch (error) {
    logger.error('Health check failed:', error);
    ResponseUtil.error(res, 'System is unhealthy', 503);
  }
});

// API version info
app.get('/api', (_req: Request, res: Response) => {
  ResponseUtil.success(res, {
    name: 'MCT Backend API',
    version: config.app.apiVersion,
    environment: config.app.env,
    timestamp: new Date().toISOString(),
    endpoints: {
      health: '/health',
      docs: '/api/docs',
      v1: '/api/v1',
    },
  }, 'API information');
});

// API Documentation
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpecs, {
  explorer: true,
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'MCT Backend API Documentation',
}));

// API v1 routes
app.get('/api/v1', (_req: Request, res: Response) => {
  ResponseUtil.success(res, {
    version: 'v1',
    endpoints: {
      auth: '/api/v1/auth',
      users: '/api/v1/users',
      clients: '/api/v1/clients',
      filings: '/api/v1/filings',
      documents: '/api/v1/documents',
      notifications: '/api/v1/notifications',
      payments: '/api/v1/payments',
      settings: '/api/v1/settings',
      dashboard: '/api/v1/dashboard',
    },
  }, 'API v1 endpoints');
});

// Mount API routes
app.use('/api/v1', routes);

// 404 handler for undefined routes
app.use(notFoundHandler);

// Global error handler (must be last)
app.use(errorHandler);

export default app; 