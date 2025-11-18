import { createClient } from 'redis';
import { logger } from '../../logger.js';

let redisClient = null;
let redisPubClient = null;
let redisSubClient = null;

/**
 * Initialize Redis client
 */
export async function initRedis() {
  try {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

    // Main client for caching
    redisClient = createClient({
      url: redisUrl,
      socket: {
        reconnectStrategy: (retries) => {
          if (retries > 10) {
            logger.error('Redis reconnection attempts exhausted');
            return new Error('Redis connection failed');
          }
          return Math.min(retries * 100, 3000);
        },
      },
    });

    // Pub/Sub clients
    redisPubClient = redisClient.duplicate();
    redisSubClient = redisClient.duplicate();

    // Error handlers
    redisClient.on('error', (err) => {
      logger.error('Redis client error', { error: err.message });
    });

    redisPubClient.on('error', (err) => {
      logger.error('Redis pub client error', { error: err.message });
    });

    redisSubClient.on('error', (err) => {
      logger.error('Redis sub client error', { error: err.message });
    });

    // Connect all clients
    await Promise.all([redisClient.connect(), redisPubClient.connect(), redisSubClient.connect()]);

    logger.info('Redis connected successfully');
    console.log('✅ Redis connected');

    return { redisClient, redisPubClient, redisSubClient };
  } catch (err) {
    logger.error('Failed to connect to Redis', { error: err.message });
    console.error('❌ Redis connection failed:', err.message);
    throw err;
  }
}

/**
 * Get Redis client
 */
export function getRedisClient() {
  if (!redisClient) {
    throw new Error('Redis not initialized. Call initRedis() first.');
  }
  return redisClient;
}

/**
 * Get Pub/Sub clients
 */
export function getPubSubClients() {
  if (!redisPubClient || !redisSubClient) {
    throw new Error('Redis Pub/Sub not initialized. Call initRedis() first.');
  }
  return { pub: redisPubClient, sub: redisSubClient };
}

/**
 * Cache operations with TTL
 */
export class CacheManager {
  constructor() {
    this.defaultTTL = 3600; // 1 hour
  }

  /**
   * Get value from cache
   */
  async get(key) {
    try {
      const value = await redisClient.get(key);
      if (value) {
        logger.debug('Cache hit', { key });
        return JSON.parse(value);
      }
      logger.debug('Cache miss', { key });
      return null;
    } catch (err) {
      logger.error('Cache get error', { key, error: err.message });
      return null;
    }
  }

  /**
   * Set value in cache with TTL
   */
  async set(key, value, ttl = this.defaultTTL) {
    try {
      await redisClient.setEx(key, ttl, JSON.stringify(value));
      logger.debug('Cache set', { key, ttl });
    } catch (err) {
      logger.error('Cache set error', { key, error: err.message });
    }
  }

  /**
   * Delete from cache
   */
  async del(key) {
    try {
      await redisClient.del(key);
      logger.debug('Cache deleted', { key });
    } catch (err) {
      logger.error('Cache delete error', { key, error: err.message });
    }
  }

  /**
   * Delete multiple keys matching pattern
   */
  async delPattern(pattern) {
    try {
      const keys = await redisClient.keys(pattern);
      if (keys.length > 0) {
        await redisClient.del(keys);
        logger.debug('Cache pattern deleted', { pattern, count: keys.length });
      }
    } catch (err) {
      logger.error('Cache pattern delete error', { pattern, error: err.message });
    }
  }

  /**
   * Check if key exists
   */
  async exists(key) {
    try {
      return (await redisClient.exists(key)) === 1;
    } catch (err) {
      logger.error('Cache exists error', { key, error: err.message });
      return false;
    }
  }

  /**
   * Increment counter
   */
  async incr(key, ttl = this.defaultTTL) {
    try {
      const value = await redisClient.incr(key);
      await redisClient.expire(key, ttl);
      return value;
    } catch (err) {
      logger.error('Cache incr error', { key, error: err.message });
      return 0;
    }
  }
}

/**
 * Message Queue using Redis Pub/Sub
 */
export class MessageQueue {
  constructor() {
    this.handlers = new Map();
  }

  /**
   * Subscribe to a channel
   */
  async subscribe(channel, handler) {
    try {
      this.handlers.set(channel, handler);
      await redisSubClient.subscribe(channel, (message) => {
        try {
          const data = JSON.parse(message);
          handler(data);
        } catch (err) {
          logger.error('Message handler error', { channel, error: err.message });
        }
      });
      logger.info('Subscribed to channel', { channel });
    } catch (err) {
      logger.error('Subscribe error', { channel, error: err.message });
      throw err;
    }
  }

  /**
   * Unsubscribe from a channel
   */
  async unsubscribe(channel) {
    try {
      await redisSubClient.unsubscribe(channel);
      this.handlers.delete(channel);
      logger.info('Unsubscribed from channel', { channel });
    } catch (err) {
      logger.error('Unsubscribe error', { channel, error: err.message });
    }
  }

  /**
   * Publish message to a channel
   */
  async publish(channel, message) {
    try {
      await redisPubClient.publish(channel, JSON.stringify(message));
      logger.debug('Message published', { channel });
    } catch (err) {
      logger.error('Publish error', { channel, error: err.message });
    }
  }
}

/**
 * Close Redis connections
 */
export async function closeRedis() {
  try {
    if (redisClient) await redisClient.quit();
    if (redisPubClient) await redisPubClient.quit();
    if (redisSubClient) await redisSubClient.quit();
    logger.info('Redis connections closed');
    console.log('✅ Redis closed');
  } catch (err) {
    logger.error('Error closing Redis', { error: err.message });
  }
}
