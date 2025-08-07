#!/usr/bin/env node

/**
 * SLA Digital Unified Platform Server
 * Production-ready server startup with comprehensive error handling
 */

const app = require('./app');
const { createServer } = require('http');

// Load environment variables
require('dotenv').config();

// Server configuration
const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || '0.0.0.0';
const NODE_ENV = process.env.NODE_ENV || 'development';

// Create HTTP server
const server = createServer(app);

// Server startup function
const startServer = async () => {
  try {
    // Start listening
    server.listen(PORT, HOST, () => {
      console.log('\n🚀 SLA Digital Unified Platform Server Started!');
      console.log('================================================');
      console.log(`📡 Server running on: http://${HOST}:${PORT}`);
      console.log(`🌍 Environment: ${NODE_ENV}`);
      console.log(`📅 Started at: ${new Date().toISOString()}`);
      console.log(`💻 Process ID: ${process.pid}`);
      console.log(`📋 Node Version: ${process.version}`);
      console.log('================================================');
      console.log('\n📋 Available Endpoints:');
      console.log(`   🔍 Health Check: http://${HOST}:${PORT}/health`);
      console.log(`   📊 API v1: http://${HOST}:${PORT}/api/v1`);
      console.log(`   🛠️  Admin: http://${HOST}:${PORT}/api/admin`);
      console.log(`   📖 Documentation: http://${HOST}:${PORT}/api`);
      console.log(`   📈 Status: http://${HOST}:${PORT}/api/status`);
      console.log('\n✅ Server ready to accept connections!\n');
      
      // Log New Relic status
      if (process.env.NEW_RELIC_LICENSE_KEY) {
        console.log('📊 New Relic APM: Enabled');
      } else {
        console.log('⚠️  New Relic APM: Disabled (no license key)');
      }
    });

    // Server event handlers
    server.on('error', onError);
    server.on('listening', onListening);

  } catch (error) {
    console.error('❌ Failed to start server:', error.message);
    process.exit(1);
  }
};

/**
 * Event listener for HTTP server "error" event
 */
function onError(error) {
  if (error.syscall !== 'listen') {
    throw error;
  }

  const bind = typeof PORT === 'string' ? 'Pipe ' + PORT : 'Port ' + PORT;

  // Handle specific listen errors with friendly messages
  switch (error.code) {
    case 'EACCES':
      console.error(`❌ ${bind} requires elevated privileges`);
      process.exit(1);
      break;
    case 'EADDRINUSE':
      console.error(`❌ ${bind} is already in use`);
      process.exit(1);
      break;
    default:
      throw error;
  }
}

/**
 * Event listener for HTTP server "listening" event
 */
function onListening() {
  const addr = server.address();
  const bind = typeof addr === 'string' ? 'pipe ' + addr : 'port ' + addr.port;
  console.log(`🎧 Server listening on ${bind}`);
}

// 🔧 UPDATED: Graceful shutdown handling with ApplicationInitializer cleanup
const gracefulShutdown = (signal) => {
  console.log(`\n⚠️  Received ${signal}. Starting graceful shutdown...`);
  
  server.close(async (err) => {
    if (err) {
      console.error('❌ Error during server shutdown:', err);
      process.exit(1);
    }
    
    console.log('🔄 HTTP server stopped');
    
    try {
      // Step 1: Cleanup application services (OperatorManager, etc.)
      const ApplicationInitializer = require('./services/ApplicationInitializer');
      await ApplicationInitializer.cleanup();
      console.log('🔄 Application services cleaned up');
      
      // Step 2: Close database connections
      const { closeDatabase } = require('./database/connection');
      await closeDatabase();
      console.log('🔄 Database connections closed');
      
      console.log('✅ Graceful shutdown completed successfully');
      process.exit(0);
      
    } catch (error) {
      console.error('❌ Error during shutdown cleanup:', error.message);
      process.exit(1);
    }
  });
  
  // Force shutdown after 30 seconds
  setTimeout(() => {
    console.error('❌ Forced shutdown after 30s timeout');
    process.exit(1);
  }, 30000);
};

// Process event handlers
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  console.error('Stack trace:', error.stack);
  
  // Log to New Relic if available
  if (typeof newrelic !== 'undefined') {
    newrelic.noticeError(error);
  }
  
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  
  // Log to New Relic if available
  if (typeof newrelic !== 'undefined') {
    newrelic.noticeError(reason);
  }
  
  process.exit(1);
});

// Memory usage monitoring in development
if (NODE_ENV === 'development') {
  setInterval(() => {
    const used = process.memoryUsage();
    const messages = [];
    
    for (let key in used) {
      messages.push(`${key}: ${Math.round(used[key] / 1024 / 1024 * 100) / 100} MB`);
    }
    
    console.log('💾 Memory Usage:', messages.join(', '));
  }, 60000); // Every minute
}

// Start the server
startServer();

module.exports = server;