/**
 * Application Initializer - Ensures proper startup sequence
 * 
 * Centralized service for initializing all application components
 * in the correct order with proper error handling.
 */

const Logger = require('../utils/logger');
const { getInstance: getOperatorManager } = require('./core/OperatorManager');

class ApplicationInitializer {
  /**
   * Initialize all application services in proper order
   */
  static async initialize() {
    try {
      Logger.info('🚀 Starting application initialization...');
      
      // Step 1: Initialize OperatorManager singleton
      const operatorManager = getOperatorManager();
      await operatorManager.initialize();
      
      // Step 2: Add any other service initialization here
      // Example: await initializeOtherServices();
      
      Logger.info('✅ Application initialization completed successfully');
      return true;
      
    } catch (error) {
      Logger.error('❌ Application initialization failed', {
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }
  
  /**
   * Cleanup all application resources
   */
  static async cleanup() {
    try {
      Logger.info('🧹 Starting application cleanup...');
      
      // Cleanup OperatorManager
      const operatorManager = getOperatorManager();
      await operatorManager.cleanup();
      
      // Add cleanup for other services here
      // Example: await cleanupOtherServices();
      
      Logger.info('✅ Application cleanup completed successfully');
      
    } catch (error) {
      Logger.error('❌ Application cleanup failed', {
        error: error.message,
        stack: error.stack
      });
      // Don't throw during cleanup - log and continue
    }
  }
  
  /**
   * Get initialization status
   */
  static getStatus() {
    const { getSingletonStatus } = require('./core/OperatorManager');
    
    return {
      timestamp: new Date().toISOString(),
      operatorManager: getSingletonStatus(),
      // Add status for other services here
    };
  }
  
  /**
   * Health check for all services
   */
  static async healthCheck() {
    try {
      const status = this.getStatus();
      
      return {
        healthy: true,
        services: {
          operatorManager: {
            initialized: status.operatorManager.isInitialized,
            healthMonitoring: status.operatorManager.healthMonitoringActive,
            operatorCount: status.operatorManager.operatorCount
          }
          // Add health checks for other services
        },
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      Logger.error('Health check failed', {
        error: error.message
      });
      
      return {
        healthy: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }
}

module.exports = ApplicationInitializer;