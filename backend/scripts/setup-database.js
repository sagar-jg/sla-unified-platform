/**
 * Database Setup and Test Script
 * 
 * This script tests the database connection and sets up the initial schema.
 * Run this script before starting the application for the first time.
 */

require('dotenv').config();
const { connectDatabase, checkDatabaseHealth, closeDatabase } = require('../src/database/connection');
const { initializeModels } = require('../src/models');
const Logger = require('../src/utils/logger');

async function setupDatabase() {
  try {
    Logger.info('=== SLA Digital Platform Database Setup ===');
    
    // Step 1: Test database connection
    Logger.info('Step 1: Testing database connection...');
    await connectDatabase();
    Logger.info('✅ Database connection established successfully');
    
    // Step 2: Check database health
    Logger.info('Step 2: Checking database health...');
    const health = await checkDatabaseHealth();
    Logger.info('Database health status:', health);
    
    if (!health.healthy) {
      throw new Error(`Database health check failed: ${health.error}`);
    }
    Logger.info('✅ Database health check passed');
    
    // Step 3: Initialize models
    Logger.info('Step 3: Initializing database models...');
    const models = initializeModels();
    Logger.info('✅ Database models initialized successfully');
    Logger.info(`Initialized ${Object.keys(models).length} models:`, Object.keys(models));
    
    // Step 4: Sync models (in development only)
    if (process.env.NODE_ENV === 'development') {
      Logger.info('Step 4: Synchronizing database schema (development mode)...');
      const { getDatabase } = require('../src/database/connection');
      const sequelize = getDatabase();
      
      // Use alter: true to update existing tables without dropping data
      await sequelize.sync({ alter: true });
      Logger.info('✅ Database schema synchronized successfully');
    } else {
      Logger.info('Step 4: Skipping schema sync (production mode - use migrations)');
    }
    
    Logger.info('=== Database Setup Complete ===');
    Logger.info('The application is ready to start!');
    
  } catch (error) {
    Logger.error('❌ Database setup failed:', {
      error: error.message,
      stack: error.stack
    });
    
    Logger.error('Setup failed. Please check the following:');
    Logger.error('1. PostgreSQL is running and accessible');
    Logger.error('2. Database credentials are correct in .env file');
    Logger.error('3. Database exists and user has proper permissions');
    Logger.error('4. All required environment variables are set');
    
    process.exit(1);
  } finally {
    await closeDatabase();
  }
}

// Run the setup if this script is executed directly
if (require.main === module) {
  setupDatabase();
}

module.exports = { setupDatabase };