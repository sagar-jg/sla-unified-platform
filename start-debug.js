#!/usr/bin/env node

/**
 * Debug Server Startup Script
 * Use this to start the server in debug mode and test 403 issues
 */

console.log('🔍 SLA Digital Platform - Debug Mode Startup');
console.log('=============================================\n');

// Step 1: Test environment and dependencies
console.log('1️⃣  Checking environment...');

try {
  const packageJson = require('./package.json');
  console.log(`   ✅ Project: ${packageJson.name}`);
  console.log(`   ✅ Version: ${packageJson.version}`);
} catch (error) {
  console.log('   ❌ Could not read package.json');
}

// Step 2: Test basic imports
console.log('\n2️⃣  Testing basic imports...');

try {
  const express = require('express');
  console.log('   ✅ Express available');
  
  const cors = require('cors');
  console.log('   ✅ CORS available');
  
  const helmet = require('helmet');
  console.log('   ✅ Helmet available');
  
} catch (error) {
  console.log('   ❌ Import failed:', error.message);
  console.log('   Run: npm install');
  process.exit(1);
}

// Step 3: Start debug server
console.log('\n3️⃣  Starting debug server...');

try {
  // Use the debug version of app.js
  const app = require('./backend/src/app-debug');
  
  const PORT = process.env.PORT || 3000;
  
  const server = app.listen(PORT, () => {
    console.log(`\n🚀 Debug server started successfully!`);
    console.log(`📍 Server running on port ${PORT}`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    
    console.log(`\n📋 Debug Testing Checklist:`);
    console.log('============================');
    
    console.log('\n🔧 Step 1: Test basic server health');
    console.log(`   curl http://localhost:${PORT}/health`);
    console.log(`   curl http://localhost:${PORT}/test-route`);
    
    console.log('\n🔧 Step 2: Test simplified auth routes (no dependencies)');
    console.log(`   curl http://localhost:${PORT}/api/auth-debug/health`);
    console.log(`   curl http://localhost:${PORT}/api/auth-debug/info`);
    
    console.log('\n🔧 Step 3: Test simplified auth login (no database)');
    console.log(`   curl -X POST http://localhost:${PORT}/api/auth-debug/test-login \\`);
    console.log(`     -H 'Content-Type: application/json' \\`);
    console.log(`     -d '{"email":"test@test.com","password":"test123"}'`);
    
    console.log('\n🔧 Step 4: Test full auth routes (with dependencies)');
    console.log(`   curl http://localhost:${PORT}/api/auth/health`);
    console.log(`   curl -X POST http://localhost:${PORT}/api/auth/login \\`);
    console.log(`     -H 'Content-Type: application/json' \\`);
    console.log(`     -d '{"email":"admin@sla-platform.com","password":"admin123!"}'`);
    
    console.log('\n📊 Debug Analysis:');
    console.log('==================');
    console.log('If auth-debug routes work but regular auth routes give 403:');
    console.log('   → Issue is with dependencies (database, middleware, imports)');
    console.log('If both give 403:');
    console.log('   → Issue is with basic routing or Express setup');
    console.log('If all routes give 403:');
    console.log('   → Issue is with server setup, CORS, or rate limiting');
    
    console.log('\n🔍 Monitor server logs above for debug output');
    console.log('✋ Press Ctrl+C to stop the debug server');
  });
  
  // Graceful shutdown
  process.on('SIGTERM', () => {
    console.log('\n🛑 SIGTERM received, shutting down gracefully...');
    server.close(() => {
      console.log('✅ Debug server stopped');
      process.exit(0);
    });
  });

  process.on('SIGINT', () => {
    console.log('\n🛑 SIGINT received, shutting down gracefully...');
    server.close(() => {
      console.log('✅ Debug server stopped');
      process.exit(0);
    });
  });

} catch (error) {
  console.log('   ❌ Server startup failed:', error.message);
  console.log('\n🔧 Troubleshooting:');
  console.log('   1. Check if port 3000 is already in use');
  console.log('   2. Run: npm install');
  console.log('   3. Check file paths and imports');
  console.log('   4. Review error details above');
  
  console.error('\n📋 Full error details:');
  console.error(error);
  
  process.exit(1);
}