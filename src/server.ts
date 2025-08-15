import { Server } from 'http';
import app from './app';
import config from './config';
import logger from './utils/logger';
import { testConnection, syncDatabase } from './config/database';
import { testRedisConnection } from './config/redis';

let server: Server | undefined;

// Start server function
const startServer = async (): Promise<void> => {
  try {
    console.log( process.env['NODE_ENV'] )
    console.log('Initializing MCT Backend Server...');
    logger.info('Starting MCT Backend Server...');

    // Test database connection (skip if not available)
    try {
      await testConnection();
      logger.info('Database connection successful');

      // Sync database in development
      if (config.app.env === 'development') {
        await syncDatabase(false);
        logger.info('Database schema synchronized');
      }
    } catch (error) {
      logger.warn('Database connection failed (continuing without database):', error);
    }

    // Test Redis connection (optional)
    try {
      logger.info('Testing Redis connection...');
      await testRedisConnection();
      logger.info('Redis connection successful');
    } catch (error) {
      logger.warn('Redis connection failed (continuing without Redis):', error);
    }

    // Start HTTP server
    server = app.listen(config.app.port, () => {
      logger.info(`🚀 Server running on port ${config.app.port}`);
      logger.info(`📝 Environment: ${config.app.env}`);
      logger.info(`🔗 API URL: http://localhost:${config.app.port}/api/v1`);
      logger.info(`💚 Health Check: http://localhost:${config.app.port}/health`);
      
      if (config.app.env === 'development') {
        logger.info(`🎯 Frontend Origin: ${config.app.frontendOrigin}`);
      }
    });

    // Handle server errors
    server.on('error', (error: any) => {
      if (error.syscall !== 'listen') {
        throw error;
      }

      const bind = typeof config.app.port === 'string'
        ? 'Pipe ' + config.app.port
        : 'Port ' + config.app.port;

      switch (error.code) {
        case 'EACCES':
          logger.error(`${bind} requires elevated privileges`);
          process.exit(1);
          break;
        case 'EADDRINUSE':
          logger.error(`${bind} is already in use`);
          process.exit(1);
          break;
        default:
          throw error;
      }
    });

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Start the server
startServer();

export default server; 