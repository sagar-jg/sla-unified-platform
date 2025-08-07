/**
 * Redis Configuration and Connection Manager
 * 
 * Manages Redis connection with reconnection logic, connection pooling,
 * and health monitoring for caching and session storage.
 * Uses the 'redis' package (v4+) which is already included in dependencies.
 */

const { createClient } = require('redis');
const Logger = require('../utils/logger');
const config = require('./index');

class RedisManager {
  constructor() {
    this.client = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
  }

  /**
   * Initialize Redis connection
   */
  async connect() {
    try {
      const redisConfig = {
        url: config.redis.url || 'redis://localhost:6379',
        database: config.redis.db || 0,
        password: config.redis.password || undefined,
        
        // Connection settings
        socket: {
          connectTimeout: 10000,
          commandTimeout: 5000,
          reconnectStrategy: (retries) => {
            if (retries > this.maxReconnectAttempts) {
              Logger.error('Redis max reconnection attempts reached');
              return false; // Stop retrying
            }
            
            const delay = Math.min(retries * 50, 2000);
            Logger.info(`Redis reconnection attempt ${retries}, delay: ${delay}ms`);
            return delay;
          }
        }
      };

      this.client = createClient(redisConfig);
      
      // Event handlers
      this.setupEventHandlers();
      
      // Attempt to connect
      await this.client.connect();
      
      Logger.info('Redis connection established successfully', {
        url: config.redis.url,
        database: config.redis.db
      });

      return this.client;
    } catch (error) {
      Logger.error('Failed to connect to Redis', {
        error: error.message,
        stack: error.stack
      });
      
      // Don't throw error - app should continue without Redis
      this.client = null;
      this.isConnected = false;
    }
  }

  /**
   * Setup Redis event handlers
   */
  setupEventHandlers() {
    if (!this.client) return;

    this.client.on('connect', () => {
      Logger.info('Redis client connected');
      this.isConnected = true;
      this.reconnectAttempts = 0;
    });

    this.client.on('ready', () => {
      Logger.info('Redis client ready to receive commands');
      this.isConnected = true;
    });

    this.client.on('error', (error) => {
      Logger.error('Redis connection error', {
        error: error.message,
        stack: error.stack
      });
      this.isConnected = false;
    });

    this.client.on('end', () => {
      Logger.warn('Redis connection closed');
      this.isConnected = false;
    });

    this.client.on('reconnecting', () => {
      this.reconnectAttempts++;
      Logger.info(`Redis reconnecting (attempt ${this.reconnectAttempts})`);
    });
  }

  /**
   * Check if Redis is connected and available
   */
  isAvailable() {
    return this.client && this.client.isOpen && this.isConnected;
  }

  /**
   * Get value from Redis
   */
  async get(key) {
    if (!this.isAvailable()) {
      Logger.debug('Redis not available, get operation skipped', { key });
      return null;
    }

    try {
      const value = await this.client.get(key);
      return value;
    } catch (error) {
      Logger.error('Redis GET error', {
        key,
        error: error.message
      });
      return null;
    }
  }

  /**
   * Set value in Redis
   */
  async set(key, value, ttlSeconds = null) {
    if (!this.isAvailable()) {
      Logger.debug('Redis not available, set operation skipped', { key });
      return false;
    }

    try {
      let result;
      if (ttlSeconds) {
        result = await this.client.setEx(key, ttlSeconds, value);
      } else {
        result = await this.client.set(key, value);
      }
      return result === 'OK';
    } catch (error) {
      Logger.error('Redis SET error', {
        key,
        error: error.message
      });
      return false;
    }
  }

  /**
   * Delete key from Redis
   */
  async del(key) {
    if (!this.isAvailable()) {
      Logger.debug('Redis not available, delete operation skipped', { key });
      return false;
    }

    try {
      const result = await this.client.del(key);
      return result > 0;
    } catch (error) {
      Logger.error('Redis DEL error', {
        key,
        error: error.message
      });
      return false;
    }
  }

  /**
   * Check if key exists in Redis
   */
  async exists(key) {
    if (!this.isAvailable()) {
      return false;
    }

    try {
      const result = await this.client.exists(key);
      return result === 1;
    } catch (error) {
      Logger.error('Redis EXISTS error', {
        key,
        error: error.message
      });
      return false;
    }
  }

  /**
   * Set TTL for key
   */
  async expire(key, ttlSeconds) {
    if (!this.isAvailable()) {
      return false;
    }

    try {
      const result = await this.client.expire(key, ttlSeconds);
      return result === 1;
    } catch (error) {
      Logger.error('Redis EXPIRE error', {
        key,
        ttlSeconds,
        error: error.message
      });
      return false;
    }
  }

  /**
   * Get multiple keys
   */
  async mget(keys) {
    if (!this.isAvailable() || !Array.isArray(keys) || keys.length === 0) {
      return [];
    }

    try {
      const values = await this.client.mGet(keys);
      return values;
    } catch (error) {
      Logger.error('Redis MGET error', {
        keys,
        error: error.message
      });
      return [];
    }
  }

  /**
   * Set multiple key-value pairs
   */
  async mset(keyValuePairs) {
    if (!this.isAvailable() || !keyValuePairs || Object.keys(keyValuePairs).length === 0) {
      return false;
    }

    try {
      const result = await this.client.mSet(keyValuePairs);
      return result === 'OK';
    } catch (error) {
      Logger.error('Redis MSET error', {
        keyValuePairs,
        error: error.message
      });
      return false;
    }
  }

  /**
   * Increment value by 1
   */
  async incr(key) {
    if (!this.isAvailable()) {
      return null;
    }

    try {
      const result = await this.client.incr(key);
      return result;
    } catch (error) {
      Logger.error('Redis INCR error', {
        key,
        error: error.message
      });
      return null;
    }
  }

  /**
   * Increment value by specified amount
   */
  async incrBy(key, increment) {
    if (!this.isAvailable()) {
      return null;
    }

    try {
      const result = await this.client.incrBy(key, increment);
      return result;
    } catch (error) {
      Logger.error('Redis INCRBY error', {
        key,
        increment,
        error: error.message
      });
      return null;
    }
  }

  /**
   * Get keys matching pattern
   */
  async keys(pattern) {
    if (!this.isAvailable()) {
      return [];
    }

    try {
      const keys = await this.client.keys(pattern);
      return keys;
    } catch (error) {
      Logger.error('Redis KEYS error', {
        pattern,
        error: error.message
      });
      return [];
    }
  }

  /**
   * Get Redis client info for health checks
   */
  async getInfo() {
    if (!this.isAvailable()) {
      return {
        connected: false,
        error: 'Redis client not available'
      };
    }

    try {
      const info = await this.client.info();
      
      return {
        connected: this.isConnected,
        isOpen: this.client.isOpen,
        info: info
      };
    } catch (error) {
      Logger.error('Failed to get Redis info', {
        error: error.message
      });
      
      return {
        connected: false,
        error: error.message
      };
    }
  }

  /**
   * Ping Redis server
   */
  async ping() {
    if (!this.isAvailable()) {
      return false;
    }

    try {
      const result = await this.client.ping();
      return result === 'PONG';
    } catch (error) {
      Logger.error('Redis PING error', {
        error: error.message
      });
      return false;
    }
  }

  /**
   * Flush all Redis data (use with caution)
   */
  async flushAll() {
    if (!this.isAvailable()) {
      return false;
    }

    try {
      const result = await this.client.flushAll();
      Logger.warn('Redis FLUSHALL executed - all data cleared');
      return result === 'OK';
    } catch (error) {
      Logger.error('Redis FLUSHALL error', {
        error: error.message
      });
      return false;
    }
  }

  /**
   * Close Redis connection
   */
  async disconnect() {
    if (this.client) {
      try {
        await this.client.quit();
        Logger.info('Redis connection closed gracefully');
      } catch (error) {
        Logger.error('Error closing Redis connection', {
          error: error.message
        });
        
        // Force close if graceful close fails
        await this.client.disconnect();
      }
      
      this.client = null;
      this.isConnected = false;
    }
  }
}

// Create singleton instance
const redisManager = new RedisManager();

// Auto-connect on first import (but handle gracefully if Redis is not available)
if (config.redis.url && config.app.environment !== 'test') {
  redisManager.connect().catch((error) => {
    Logger.warn('Redis auto-connect failed - continuing without Redis', {
      error: error.message
    });
  });
}

module.exports = {
  redisManager,
  RedisManager
};