/**
 * Database Connection Manager
 * 
 * Manages PostgreSQL connection using Sequelize ORM with connection pooling,
 * automatic reconnection, and health monitoring.
 */

const { Sequelize } = require('sequelize');
const Logger = require('../utils/logger');
const config = require('../config/database');

const environment = process.env.NODE_ENV || 'development';
const dbConfig = config[environment];

let sequelize = null;
let modelsInitialized = false;

/**
 * Create Sequelize instance
 */
function createSequelizeInstance() {
  try {
    if (dbConfig.use_env_variable) {
      // Production: use DATABASE_URL environment variable
      sequelize = new Sequelize(process.env[dbConfig.use_env_variable], dbConfig);
    } else {
      // Development/Test: use individual config values
      sequelize = new Sequelize(
        dbConfig.database,
        dbConfig.username,
        dbConfig.password,
        dbConfig
      );
    }
    
    Logger.info('Sequelize instance created', {
      environment,
      database: dbConfig.database || 'from_url',
      host: dbConfig.host || 'from_url',
      dialect: dbConfig.dialect
    });
    
    return sequelize;
  } catch (error) {
    Logger.error('Failed to create Sequelize instance', {
      error: error.message,
      environment,
      stack: error.stack
    });
    throw error;
  }
}

/**
 * Initialize database models
 */
function initializeModels() {
  if (modelsInitialized) {
    return;
  }

  try {
    const { initializeModels } = require('../models');
    initializeModels();
    modelsInitialized = true;
    
    Logger.info('Database models initialized successfully');
  } catch (error) {
    Logger.error('Failed to initialize models', {
      error: error.message,
      stack: error.stack
    });
    throw error;
  }
}

/**
 * Connect to database
 */
async function connectDatabase() {
  try {
    if (!sequelize) {
      sequelize = createSequelizeInstance();
    }
    
    // Test the connection
    await sequelize.authenticate();
    
    Logger.info('Database connection established successfully', {
      environment,
      database: sequelize.getDatabaseName()
    });
    
    // Initialize models after successful connection
    initializeModels();
    
    // 🔧 FIXED: Skip auto-sync in development to avoid enum issues
    // Manual database migrations should be used instead of auto-sync
    if (environment === 'development' && process.env.DB_AUTO_SYNC === 'true') {
      try {
        // Only sync if explicitly requested via environment variable
        await sequelize.sync({ alter: false, force: false });
        Logger.info('Database models synchronized');
      } catch (syncError) {
        Logger.warn('Database sync failed, continuing without sync', {
          error: syncError.message,
          suggestion: 'Run database migrations manually or check enum definitions'
        });
        // Continue without sync - models are still initialized
      }
    } else {
      Logger.info('Database sync skipped - using existing schema', {
        note: 'Set DB_AUTO_SYNC=true to enable auto-sync (not recommended for production)'
      });
    }
    
    return sequelize;
  } catch (error) {
    Logger.error('Unable to connect to the database', {
      error: error.message,
      environment,
      stack: error.stack
    });
    throw error;
  }
}

/**
 * Get database instance
 */
function getDatabase() {
  if (!sequelize) {
    throw new Error('Database not initialized. Call connectDatabase() first.');
  }
  return sequelize;
}

/**
 * Close database connection
 */
async function closeDatabase() {
  if (sequelize) {
    await sequelize.close();
    sequelize = null;
    modelsInitialized = false;
    Logger.info('Database connection closed');
  }
}

/**
 * Check database health
 */
async function checkDatabaseHealth() {
  try {
    if (!sequelize) {
      return { healthy: false, error: 'Database not initialized' };
    }
    
    // Simple query to test connection
    await sequelize.query('SELECT 1');
    
    return {
      healthy: true,
      database: sequelize.getDatabaseName(),
      connectionCount: sequelize.connectionManager.pool.size,
      environment
    };
  } catch (error) {
    Logger.error('Database health check failed', {
      error: error.message,
      stack: error.stack
    });
    
    return {
      healthy: false,
      error: error.message
    };
  }
}

/**
 * Get database statistics
 */
async function getDatabaseStats() {
  try {
    if (!sequelize) {
      throw new Error('Database not initialized');
    }
    
    const pool = sequelize.connectionManager.pool;
    
    return {
      totalConnections: pool.size,
      idleConnections: pool.available,
      pendingRequests: pool.pending,
      database: sequelize.getDatabaseName(),
      dialect: sequelize.getDialect(),
      version: await sequelize.databaseVersion()
    };
  } catch (error) {
    Logger.error('Failed to get database stats', {
      error: error.message,
      stack: error.stack
    });
    throw error;
  }
}

/**
 * Check if models are initialized
 */
function areModelsInitialized() {
  return modelsInitialized;
}

/**
 * Manually sync database (for development/testing)
 */
async function syncDatabase(options = {}) {
  try {
    if (!sequelize) {
      throw new Error('Database not initialized');
    }
    
    const syncOptions = {
      alter: false,
      force: false,
      ...options
    };
    
    Logger.info('Starting manual database sync...', { options: syncOptions });
    
    await sequelize.sync(syncOptions);
    
    Logger.info('Database sync completed successfully');
    return true;
    
  } catch (error) {
    Logger.error('Database sync failed', {
      error: error.message,
      stack: error.stack
    });
    throw error;
  }
}

module.exports = {
  connectDatabase,
  getDatabase,
  closeDatabase,
  checkDatabaseHealth,
  getDatabaseStats,
  areModelsInitialized,
  syncDatabase
};
