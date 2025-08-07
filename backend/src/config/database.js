/**
 * Database Configuration
 * 
 * Sequelize configuration for PostgreSQL database across all environments.
 * Supports both DATABASE_URL and individual config parameters.
 */

require('dotenv').config();

const config = {
  development: {
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME || 'sla_platform_dev',
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    dialect: 'postgres',
    
    // Connection pooling
    pool: {
      max: parseInt(process.env.DB_POOL_MAX) || 5,
      min: parseInt(process.env.DB_POOL_MIN) || 0,
      acquire: parseInt(process.env.DB_POOL_ACQUIRE) || 30000,
      idle: parseInt(process.env.DB_POOL_IDLE) || 10000,
    },
    
    // Logging
    logging: process.env.NODE_ENV === 'development' ? console.log : false,
    
    // Timezone
    timezone: '+00:00',
    
    // Define settings
    define: {
      timestamps: true,
      underscored: true,
      underscoredAll: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      deletedAt: 'deleted_at',
      paranoid: true,
    },
    
    // Query settings
    query: {
      nest: true,
      raw: false,
    },
    
    // 🔧 FIXED: PostgreSQL-specific options to handle enum compatibility
    dialectOptions: {
      ssl: false,
      // Fix for "result.rows is not iterable" enum error
      prependSearchPath: true,
      supportBigNumbers: true,
      bigNumberStrings: true,
      // Enum handling fix
      typeCast: false,
    },
    
    // 🔧 FIXED: Additional Sequelize options for PostgreSQL compatibility
    standardConformingStrings: true,
    native: false, // Disable native pg for better compatibility
    omitNull: true,
    
    // 🔧 FIXED: Disable automatic enum sync to prevent errors
    sync: {
      force: false,
      alter: false,
    },
  },
  
  test: {
    username: process.env.DB_TEST_USERNAME || 'postgres',
    password: process.env.DB_TEST_PASSWORD || 'postgres',
    database: process.env.DB_TEST_NAME || 'sla_platform_test',
    host: process.env.DB_TEST_HOST || 'localhost',
    port: process.env.DB_TEST_PORT || 5432,
    dialect: 'postgres',
    
    // Connection pooling (smaller for tests)
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000,
    },
    
    // Disable logging in tests
    logging: false,
    
    // Timezone
    timezone: '+00:00',
    
    // Define settings
    define: {
      timestamps: true,
      underscored: true,
      underscoredAll: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      deletedAt: 'deleted_at',
      paranoid: true,
    },
    
    // Query settings
    query: {
      nest: true,
      raw: false,
    },
    
    // 🔧 FIXED: PostgreSQL-specific options for test environment
    dialectOptions: {
      ssl: false,
      prependSearchPath: true,
      supportBigNumbers: true,
      bigNumberStrings: true,
      typeCast: false,
    },
    
    standardConformingStrings: true,
    native: false,
    omitNull: true,
    
    sync: {
      force: false,
      alter: false,
    },
  },
  
  production: {
    // Use DATABASE_URL in production (common for cloud deployments)
    use_env_variable: 'DATABASE_URL',
    
    dialect: 'postgres',
    
    // Production connection pooling
    pool: {
      max: parseInt(process.env.DB_POOL_MAX) || 20,
      min: parseInt(process.env.DB_POOL_MIN) || 5,
      acquire: parseInt(process.env.DB_POOL_ACQUIRE) || 60000,
      idle: parseInt(process.env.DB_POOL_IDLE) || 10000,
    },
    
    // Disable logging in production (use structured logging instead)
    logging: false,
    
    // Timezone
    timezone: '+00:00',
    
    // Define settings
    define: {
      timestamps: true,
      underscored: true,
      underscoredAll: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      deletedAt: 'deleted_at',
      paranoid: true,
    },
    
    // Query settings
    query: {
      nest: true,
      raw: false,
    },
    
    // 🔧 FIXED: PostgreSQL-specific options for production
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false, // For cloud databases like Azure/AWS
      },
      statement_timeout: 30000, // 30 seconds
      idle_in_transaction_session_timeout: 60000, // 1 minute
      prependSearchPath: true,
      supportBigNumbers: true,
      bigNumberStrings: true,
      typeCast: false,
    },
    
    standardConformingStrings: true,
    native: false,
    omitNull: true,
    
    // Production-specific settings
    retry: {
      max: 3,
      timeout: 60000,
    },
    
    // Benchmark queries in production (for monitoring)
    benchmark: true,
    
    // Additional production settings
    transactionType: 'IMMEDIATE',
    isolationLevel: 'READ_COMMITTED',
    
    sync: {
      force: false,
      alter: false,
    },
  },
  
  staging: {
    // Use DATABASE_URL in staging (similar to production)
    use_env_variable: 'DATABASE_URL',
    
    dialect: 'postgres',
    
    // Staging connection pooling (between dev and prod)
    pool: {
      max: parseInt(process.env.DB_POOL_MAX) || 10,
      min: parseInt(process.env.DB_POOL_MIN) || 2,
      acquire: parseInt(process.env.DB_POOL_ACQUIRE) || 30000,
      idle: parseInt(process.env.DB_POOL_IDLE) || 10000,
    },
    
    // Limited logging in staging
    logging: process.env.DB_LOGGING === 'true' ? console.log : false,
    
    // Timezone
    timezone: '+00:00',
    
    // Define settings
    define: {
      timestamps: true,
      underscored: true,
      underscoredAll: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      deletedAt: 'deleted_at',
      paranoid: true,
    },
    
    // Query settings
    query: {
      nest: true,
      raw: false,
    },
    
    // 🔧 FIXED: PostgreSQL-specific options for staging
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false,
      },
      prependSearchPath: true,
      supportBigNumbers: true,
      bigNumberStrings: true,
      typeCast: false,
    },
    
    standardConformingStrings: true,
    native: false,
    omitNull: true,
    
    sync: {
      force: false,
      alter: false,
    },
  }
};

// If DATABASE_URL is provided but no use_env_variable is set, parse it
if (process.env.DATABASE_URL && !config[process.env.NODE_ENV || 'development'].use_env_variable) {
  const url = require('url').parse(process.env.DATABASE_URL);
  const auth = url.auth ? url.auth.split(':') : [];
  
  const environment = process.env.NODE_ENV || 'development';
  config[environment] = {
    ...config[environment],
    username: auth[0],
    password: auth[1],
    database: url.pathname ? url.pathname.slice(1) : null,
    host: url.hostname,
    port: url.port,
  };
}

module.exports = config;
