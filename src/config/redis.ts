import Redis from 'ioredis';
import config from './index';
import logger from '../utils/logger';

// Redis configuration
const redisConfig: any = {
  host: config.redis.host,
  port: config.redis.port,
  db: config.redis.db,
  retryDelayOnFailover: 100,
  enableReadyCheck: false,
  maxRetriesPerRequest: null,
  lazyConnect: true,
};

// Only add password if it exists
if (config.redis.password) {
  redisConfig.password = config.redis.password;
}

// Create Redis instance
const redis = new Redis(redisConfig);

// Redis event handlers
redis.on('connect', () => {
  logger.info('Redis connected successfully');
});

redis.on('ready', () => {
  logger.info('Redis is ready to accept commands');
});

redis.on('error', (error) => {
  logger.error('Redis connection error:', error);
});

redis.on('close', () => {
  logger.warn('Redis connection closed');
});

redis.on('reconnecting', (delay: number) => {
  logger.info(`Redis reconnecting in ${delay}ms`);
});

redis.on('end', () => {
  logger.warn('Redis connection ended');
});

// Test Redis connection
export const testRedisConnection = async (): Promise<void> => {
  try {
    await redis.ping();
    logger.info('Redis ping successful');
  } catch (error) {
    logger.error('Redis ping failed:', error);
    throw error;
  }
};

// Close Redis connection
export const closeRedisConnection = async (): Promise<void> => {
  try {
    await redis.quit();
    logger.info('Redis connection closed gracefully');
  } catch (error) {
    logger.error('Error closing Redis connection:', error);
    throw error;
  }
};

// Redis utility functions
export const setCache = async (key: string, value: any, ttl?: number): Promise<void> => {
  try {
    const serializedValue = JSON.stringify(value);
    if (ttl) {
      await redis.setex(key, ttl, serializedValue);
    } else {
      await redis.set(key, serializedValue);
    }
  } catch (error) {
    logger.error('Redis set error:', error);
    throw error;
  }
};

export const getCache = async (key: string): Promise<any> => {
  try {
    const value = await redis.get(key);
    return value ? JSON.parse(value) : null;
  } catch (error) {
    logger.error('Redis get error:', error);
    return null;
  }
};

export const deleteCache = async (key: string): Promise<void> => {
  try {
    await redis.del(key);
  } catch (error) {
    logger.error('Redis delete error:', error);
    throw error;
  }
};

export const clearCache = async (pattern?: string): Promise<void> => {
  try {
    if (pattern) {
      const keys = await redis.keys(pattern);
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } else {
      await redis.flushdb();
    }
  } catch (error) {
    logger.error('Redis clear error:', error);
    throw error;
  }
};

export default redis; 