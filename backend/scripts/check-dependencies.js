/**
 * Dependency Check Script
 * 
 * Verifies all required dependencies are available before starting the application.
 * This script can be run to check for missing modules or configuration issues.
 */

require('dotenv').config();
const Logger = require('../src/utils/logger');

/**
 * Check core dependencies
 */
async function checkCoreDependencies() {
  const dependencies = [
    // Configuration
    { name: 'Database Config', path: '../src/config/database' },
    { name: 'Application Config', path: '../src/config/index' },
    { name: 'Redis Config', path: '../src/config/redis' },
    
    // Core Services
    { name: 'UnifiedAdapter', path: '../src/services/core/UnifiedAdapter' },
    { name: 'OperatorManager', path: '../src/services/core/OperatorManager' },
    { name: 'ResponseMapper', path: '../src/services/core/ResponseMapper' },
    { name: 'ErrorTranslator', path: '../src/services/core/ErrorTranslator' },
    
    // Business Services
    { name: 'SubscriptionService', path: '../src/services/business/SubscriptionService' },
    
    // Middleware
    { name: 'Error Handler', path: '../src/middleware/errorHandler' },
    { name: 'Auth Middleware', path: '../src/middleware/auth' },
    
    // Models
    { name: 'Models Index', path: '../src/models/index' },
    
    // Database Connection
    { name: 'Database Connection', path: '../src/database/connection' },
    
    // Utils
    { name: 'Logger', path: '../src/utils/logger' },
    { name: 'Errors', path: '../src/utils/errors' }
  ];
  
  const results = {
    passed: 0,
    failed: 0,
    errors: []
  };
  
  for (const dep of dependencies) {
    try {
      require(dep.path);
      Logger.info(`✅ ${dep.name} - OK`);
      results.passed++;
    } catch (error) {
      Logger.error(`❌ ${dep.name} - FAILED: ${error.message}`);
      results.failed++;
      results.errors.push({
        name: dep.name,
        path: dep.path,
        error: error.message
      });
    }
  }
  
  return results;
}

/**
 * Check environment configuration
 */
function checkEnvironmentConfig() {
  const requiredEnvVars = [
    'NODE_ENV',
    'PORT',
    'DB_USERNAME',
    'DB_PASSWORD',
    'DB_NAME',
    'JWT_SECRET',
    'ENCRYPTION_KEY'
  ];
  
  const results = {
    passed: 0,
    failed: 0,
    missing: []
  };
  
  for (const envVar of requiredEnvVars) {
    if (process.env[envVar]) {
      Logger.info(`✅ ${envVar} - Set`);
      results.passed++;
    } else {
      Logger.warn(`⚠️  ${envVar} - Not set`);
      results.failed++;
      results.missing.push(envVar);
    }
  }
  
  return results;
}

/**
 * Check database connectivity
 */
async function checkDatabaseConnectivity() {
  try {
    const { connectDatabase, checkDatabaseHealth, closeDatabase } = require('../src/database/connection');
    
    Logger.info('Testing database connection...');
    await connectDatabase();
    
    const health = await checkDatabaseHealth();
    if (health.healthy) {
      Logger.info('✅ Database connection - OK');
      await closeDatabase();
      return { success: true };
    } else {
      Logger.error(`❌ Database health check failed: ${health.error}`);
      return { success: false, error: health.error };
    }
  } catch (error) {
    Logger.error(`❌ Database connection failed: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Check Redis connectivity (optional)
 */
async function checkRedisConnectivity() {
  try {
    const { redisManager } = require('../src/config/redis');
    
    Logger.info('Testing Redis connection...');
    
    // Test basic Redis operations
    await redisManager.set('dependency_check', 'ok', 10);
    const result = await redisManager.get('dependency_check');
    
    if (result === 'ok') {
      Logger.info('✅ Redis connection - OK');
      return { success: true };
    } else {
      Logger.warn('⚠️  Redis connection - Failed (continuing without Redis)');
      return { success: false, optional: true };
    }
  } catch (error) {
    Logger.warn(`⚠️  Redis connection failed: ${error.message} (continuing without Redis)`);
    return { success: false, optional: true, error: error.message };
  }
}

/**
 * Main dependency check function
 */
async function runDependencyCheck() {
  try {
    Logger.info('🔍 Running dependency check...');
    Logger.info('=====================================');
    
    // Check core dependencies
    Logger.info('1. Checking core dependencies...');
    const coreResults = await checkCoreDependencies();
    
    Logger.info('=====================================');
    
    // Check environment configuration
    Logger.info('2. Checking environment configuration...');
    const envResults = checkEnvironmentConfig();
    
    Logger.info('=====================================');
    
    // Check database connectivity
    Logger.info('3. Checking database connectivity...');
    const dbResults = await checkDatabaseConnectivity();
    
    Logger.info('=====================================');
    
    // Check Redis connectivity (optional)
    Logger.info('4. Checking Redis connectivity...');
    const redisResults = await checkRedisConnectivity();
    
    Logger.info('=====================================');
    
    // Summary
    Logger.info('📊 DEPENDENCY CHECK SUMMARY');
    Logger.info('=====================================');
    Logger.info(`Core Dependencies: ${coreResults.passed}✅ / ${coreResults.failed}❌`);
    Logger.info(`Environment Vars: ${envResults.passed}✅ / ${envResults.failed}⚠️`);
    Logger.info(`Database: ${dbResults.success ? '✅' : '❌'}`);
    Logger.info(`Redis: ${redisResults.success ? '✅' : (redisResults.optional ? '⚠️' : '❌')}`);
    
    const overallSuccess = coreResults.failed === 0 && dbResults.success;
    
    if (overallSuccess) {
      Logger.info('🎉 All critical dependencies are satisfied!');
      Logger.info('✅ The application should start without errors.');
      process.exit(0);
    } else {
      Logger.error('❌ Critical dependencies are missing or failed!');
      
      if (coreResults.errors.length > 0) {
        Logger.error('Missing dependencies:');
        coreResults.errors.forEach(error => {
          Logger.error(`  - ${error.name}: ${error.error}`);
        });
      }
      
      if (envResults.missing.length > 0) {
        Logger.error('Missing environment variables:');
        envResults.missing.forEach(envVar => {
          Logger.error(`  - ${envVar}`);
        });
      }
      
      if (!dbResults.success) {
        Logger.error(`Database connection failed: ${dbResults.error}`);
      }
      
      Logger.error('Please resolve these issues before starting the application.');
      process.exit(1);
    }
    
  } catch (error) {
    Logger.error('Dependency check failed:', error);
    process.exit(1);
  }
}

// Run the check if this script is executed directly
if (require.main === module) {
  runDependencyCheck();
}

module.exports = {
  runDependencyCheck,
  checkCoreDependencies,
  checkEnvironmentConfig,
  checkDatabaseConnectivity,
  checkRedisConnectivity
};