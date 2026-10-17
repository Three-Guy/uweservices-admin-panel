// src/config/redis.js
const Redis = require('ioredis');
const logger = require('../utils/logger');

let redisClient = null;
let isConnected = false;
let connectionAttempted = false;
let retryCount = 0;
const MAX_RETRIES = 3;

// Redis configuration
const REDIS_CONFIG = {
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
  db: process.env.REDIS_DB || 0,
  retryStrategy: (times) => {
    retryCount = times;
    
    // Stop retrying after MAX_RETRIES
    if (times > MAX_RETRIES) {
      console.log(`\n❌ Failed to connect to Redis: Reached the max retries per request limit (which is ${MAX_RETRIES}). Refer to "maxRetriesPerRequest" option for details.\n`);
      console.warn('⚠️ Redis is optional - server will run without caching');
      console.warn('To install Redis:');
      console.warn('  - Windows: https://redis.io/docs/getting-started/installation/install-redis-on-windows/');
      console.warn('  - Mac: brew install redis');
      console.warn('  - Linux: sudo apt install redis-server');
      console.warn('  - Docker: docker run -d -p 6379:6379 redis:alpine\n');
      
      // Return null to stop retrying
      return null;
    }
    
    // Exponential backoff
    const delay = Math.min(times * 500, 2000);
    return delay;
  },
  maxRetriesPerRequest: MAX_RETRIES,
  enableReadyCheck: true,
  lazyConnect: false,
  reconnectOnError: (err) => {
    // Only reconnect on specific errors
    const targetError = 'READONLY';
    if (err.message.includes(targetError)) {
      return true;
    }
    return false;
  },
  enableOfflineQueue: false, // Don't queue commands when offline
};

/**
 * Connect to Redis
 */
const connectRedis = async () => {
  // Prevent multiple connection attempts
  if (connectionAttempted) {
    return redisClient;
  }
  connectionAttempted = true;

  try {
    console.log('\n🔌 Connecting to Redis...');
    console.log(`   Host: ${REDIS_CONFIG.host}:${REDIS_CONFIG.port}`);
    
    redisClient = new Redis(REDIS_CONFIG);

    // Connection success
    redisClient.on('connect', () => {
      console.log('✓ Redis connecting...');
    });

    redisClient.on('ready', () => {
      isConnected = true;
      retryCount = 0; // Reset retry count on successful connection
      console.log('✅ Redis Connected Successfully');
      logger.info('Redis connection established');
    });

    // Connection error
    redisClient.on('error', (err) => {
      // Only log if not already shown in retry strategy
      if (retryCount <= MAX_RETRIES) {
        console.error('❌ Redis Error:', err.message);
        logger.error('Redis connection error:', err);
      }
      isConnected = false;
    });

    // Connection closed
    redisClient.on('close', () => {
      if (isConnected) {
        // Only log if it was previously connected
        console.warn('⚠️ Redis connection closed');
        logger.warn('Redis connection closed');
      }
      isConnected = false;
    });

    // Reconnecting
    redisClient.on('reconnecting', () => {
      if (retryCount <= MAX_RETRIES) {
        console.log('🔄 Redis reconnecting...');
      }
    });

    // End - when connection is permanently closed
    redisClient.on('end', () => {
      isConnected = false;
      if (retryCount > MAX_RETRIES) {
        // Stop the spam by removing all listeners
        redisClient.removeAllListeners();
      }
    });

    // Try to ping Redis
    try {
      await redisClient.ping();
      return redisClient;
    } catch (pingError) {
      // If ping fails, Redis is not available
      logger.warn('Redis not available - running without cache');
      return null;
    }
    
  } catch (error) {
    console.error('❌ Failed to connect to Redis:', error.message);
    console.warn('\n⚠️ Redis is optional - server will run without caching');
    console.warn('To install Redis:');
    console.warn('  - Windows: https://redis.io/docs/getting-started/installation/install-redis-on-windows/');
    console.warn('  - Mac: brew install redis');
    console.warn('  - Linux: sudo apt install redis-server');
    console.warn('  - Docker: docker run -d -p 6379:6379 redis:alpine\n');
    
    logger.warn('Redis not available - running without cache');
    return null;
  }
};

/**
 * Get Redis client
 */
const getRedisClient = () => {
  return redisClient;
};

/**
 * Check if Redis is connected
 */
const isRedisConnected = () => {
  return isConnected && redisClient !== null;
};

/**
 * Cache helper functions
 */
const cache = {
  /**
   * Get cached data
   */
  get: async (key) => {
    if (!isRedisConnected()) return null;
    
    try {
      const data = await redisClient.get(key);
      if (data) {
        logger.info(`Cache HIT: ${key}`);
        return JSON.parse(data);
      }
      logger.info(`Cache MISS: ${key}`);
      return null;
    } catch (error) {
      logger.error(`Cache GET error for key ${key}:`, error);
      return null;
    }
  },

  /**
   * Set cached data with TTL (seconds)
   */
  set: async (key, value, ttl = 300) => {
    if (!isRedisConnected()) return false;
    
    try {
      const serialized = JSON.stringify(value);
      if (ttl) {
        await redisClient.setex(key, ttl, serialized);
      } else {
        await redisClient.set(key, serialized);
      }
      logger.info(`Cache SET: ${key} (TTL: ${ttl}s)`);
      return true;
    } catch (error) {
      logger.error(`Cache SET error for key ${key}:`, error);
      return false;
    }
  },

  /**
   * Delete cached data
   */
  del: async (key) => {
    if (!isRedisConnected()) return false;
    
    try {
      await redisClient.del(key);
      logger.info(`Cache DEL: ${key}`);
      return true;
    } catch (error) {
      logger.error(`Cache DEL error for key ${key}:`, error);
      return false;
    }
  },

  /**
   * Delete multiple keys by pattern
   */
  delPattern: async (pattern) => {
    if (!isRedisConnected()) return false;
    
    try {
      const keys = await redisClient.keys(pattern);
      if (keys.length > 0) {
        await redisClient.del(...keys);
        logger.info(`Cache DEL Pattern: ${pattern} (${keys.length} keys)`);
      }
      return true;
    } catch (error) {
      logger.error(`Cache DEL Pattern error for ${pattern}:`, error);
      return false;
    }
  },

  /**
   * Clear all cache
   */
  flush: async () => {
    if (!isRedisConnected()) return false;
    
    try {
      await redisClient.flushdb();
      logger.warn('Cache FLUSHED - All keys deleted');
      return true;
    } catch (error) {
      logger.error('Cache FLUSH error:', error);
      return false;
    }
  },
};

/**
 * Close Redis connection
 */
const closeRedis = async () => {
  if (redisClient) {
    try {
      // Remove all listeners to prevent reconnection attempts
      redisClient.removeAllListeners();
      await redisClient.quit();
      console.log('✓ Redis connection closed');
      logger.info('Redis connection closed gracefully');
    } catch (error) {
      // Force disconnect if quit fails
      redisClient.disconnect();
    }
  }
};

module.exports = {
  connectRedis,
  getRedisClient,
  isRedisConnected,
  cache,
  closeRedis,
};