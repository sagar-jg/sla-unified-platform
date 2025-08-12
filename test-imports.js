#!/usr/bin/env node

/**
 * Quick Import Test Script
 * Tests that all imports are working correctly after fixing the auth routes
 */

console.log('🔍 Testing import paths after auth routes fix...\n');

const path = require('path');

// Test individual imports
const tests = [
  {
    name: 'AuthController',
    path: '../backend/src/controllers/authController.js',
    test: () => require('../backend/src/controllers/authController')
  },
  {
    name: 'User Model',
    path: '../backend/src/models/User.js', 
    test: () => require('../backend/src/models/User')
  },
  {
    name: 'Auth Middleware',
    path: '../backend/src/middleware/auth.js',
    test: () => require('../backend/src/middleware/auth')
  },
  {
    name: 'Logger Utility',
    path: '../backend/src/utils/logger.js',
    test: () => require('../backend/src/utils/logger')
  },
  {
    name: 'Errors Utility',
    path: '../backend/src/utils/errors.js',
    test: () => require('../backend/src/utils/errors')
  },
  {
    name: 'Auth Routes',
    path: '../backend/src/routes/api/auth.js',
    test: () => require('../backend/src/routes/api/auth')
  }
];

let passed = 0;
let failed = 0;

for (const test of tests) {
  try {
    console.log(`Testing: ${test.name}`);
    const module = test.test();
    console.log(`   ✅ ${test.name} - Import successful`);
    
    // Log some basic info about the module
    if (typeof module === 'function') {
      console.log(`      Type: Function/Class`);
    } else if (typeof module === 'object' && module !== null) {
      const keys = Object.keys(module);
      console.log(`      Type: Object with ${keys.length} properties`);
      if (keys.length > 0) {
        console.log(`      Properties: ${keys.slice(0, 3).join(', ')}${keys.length > 3 ? '...' : ''}`);
      }
    }
    
    passed++;
  } catch (error) {
    console.log(`   ❌ ${test.name} - Import failed:`);
    console.log(`      Error: ${error.message}`);
    console.log(`      Path: ${test.path}`);
    failed++;
  }
  console.log('');
}

// Summary
console.log('📊 Import Test Results:');
console.log('=======================');
console.log(`✅ Passed: ${passed}`);
console.log(`❌ Failed: ${failed}`);
console.log(`📊 Success Rate: ${Math.round((passed / (passed + failed)) * 100)}%`);

if (failed === 0) {
  console.log('\n🎉 All imports are working correctly!');
  console.log('✅ The auth routes import path fix has resolved the issue.');
  console.log('\n🚀 Ready to start the server:');
  console.log('   npm start');
  console.log('   # or');
  console.log('   node backend/src/server.js');
} else {
  console.log('\n🔧 Some imports are still failing.');
  console.log('📋 Next steps:');
  console.log('   1. Check the failed import paths');
  console.log('   2. Ensure all required files exist');  
  console.log('   3. Verify dependencies are installed: npm install');
}

console.log('\n🧪 After fixing imports, test authentication:');
console.log('   node debug-auth.js');
console.log('   # or manually:');
console.log('   curl -X POST http://localhost:3000/api/auth/health');