#!/usr/bin/env node

/**
 * Comprehensive 403 Debug Script
 * Systematically identifies the root cause of 403 errors
 */

const path = require('path');

console.log('🔍 Comprehensive 403 Debug Analysis');
console.log('=====================================\n');

// Test 1: Basic Node.js imports
console.log('1️⃣  Testing basic imports...');
try {
  const express = require('express');
  console.log('   ✅ Express available');
  
  const app = express();
  console.log('   ✅ Express app can be created');
  
  // Test basic route
  app.get('/test', (req, res) => res.json({ test: 'ok' }));
  console.log('   ✅ Basic route registration works');
  
} catch (error) {
  console.log('   ❌ Basic Express setup failed:', error.message);
}

// Test 2: Project file structure
console.log('\n2️⃣  Testing project file structure...');
const fs = require('fs');

const criticalFiles = [
  'backend/src/app.js',
  'backend/src/controllers/authController.js',
  'backend/src/routes/api/auth.js',
  'backend/src/middleware/auth.js',
  'backend/src/utils/logger.js',
  'backend/src/models/User.js',
  'package.json'
];

for (const file of criticalFiles) {
  try {
    if (fs.existsSync(file)) {
      console.log(`   ✅ ${file} exists`);
    } else {
      console.log(`   ❌ ${file} missing`);
    }
  } catch (error) {
    console.log(`   ❌ Error checking ${file}:`, error.message);
  }
}

// Test 3: Import chain analysis
console.log('\n3️⃣  Testing import chain...');

const importTests = [
  {
    name: 'Logger',
    path: './backend/src/utils/logger.js',
    test: () => require('./backend/src/utils/logger')
  },
  {
    name: 'Errors',
    path: './backend/src/utils/errors.js', 
    test: () => require('./backend/src/utils/errors')
  },
  {
    name: 'AuthController',
    path: './backend/src/controllers/authController.js',
    test: () => require('./backend/src/controllers/authController')
  },
  {
    name: 'Auth Middleware', 
    path: './backend/src/middleware/auth.js',
    test: () => require('./backend/src/middleware/auth')
  },
  {
    name: 'Auth Routes',
    path: './backend/src/routes/api/auth.js',
    test: () => require('./backend/src/routes/api/auth')
  }
];

let importIssues = [];

for (const test of importTests) {
  try {
    console.log(`   Testing: ${test.name}`);
    const module = test.test();
    console.log(`   ✅ ${test.name} - OK`);
  } catch (error) {
    console.log(`   ❌ ${test.name} - Failed: ${error.message}`);
    importIssues.push({
      name: test.name,
      error: error.message,
      path: test.path
    });
  }
}

// Test 4: Create minimal auth route test
console.log('\n4️⃣  Testing minimal auth route...');

try {
  const express = require('express');
  const app = express();
  
  app.use(express.json());
  
  // Create minimal auth route without dependencies
  const testRouter = express.Router();
  
  testRouter.get('/health', (req, res) => {
    res.json({
      success: true,
      message: 'Minimal auth route works',
      timestamp: new Date().toISOString()
    });
  });
  
  testRouter.post('/test-login', (req, res) => {
    res.json({
      success: true,
      message: 'Minimal login route works',
      body: req.body
    });
  });
  
  app.use('/api/auth', testRouter);
  
  console.log('   ✅ Minimal auth routes created successfully');
  
  // Start test server on different port
  const server = app.listen(3001, () => {
    console.log('   ✅ Test server started on port 3001');
    
    // Test the minimal routes
    setTimeout(async () => {
      try {
        const axios = require('axios');
        
        console.log('\n   Testing minimal routes:');
        
        // Test health
        const healthResponse = await axios.get('http://localhost:3001/api/auth/health');
        console.log('   ✅ Minimal health route works:', healthResponse.status);
        
        // Test login
        const loginResponse = await axios.post('http://localhost:3001/api/auth/test-login', {
          test: 'data'
        });
        console.log('   ✅ Minimal login route works:', loginResponse.status);
        
        server.close();
        
        console.log('\n📊 Minimal Route Test: SUCCESS');
        console.log('   This proves Express routing works. Issue is in the full app setup.');
        
      } catch (error) {
        console.log('   ❌ Minimal route test failed:', error.message);
        server.close();
      }
    }, 100);
    
  });
  
} catch (error) {
  console.log('   ❌ Minimal route test setup failed:', error.message);
}

// Test 5: Analyze package.json dependencies
console.log('\n5️⃣  Checking dependencies...');

try {
  const packageJson = require('./package.json');
  
  const requiredDeps = [
    'express',
    'express-validator', 
    'bcryptjs',
    'jsonwebtoken',
    'sequelize',
    'pg',
    'cors',
    'helmet'
  ];
  
  const missing = [];
  const installed = [];
  
  for (const dep of requiredDeps) {
    if (packageJson.dependencies && packageJson.dependencies[dep]) {
      installed.push(dep);
      console.log(`   ✅ ${dep} - installed`);
    } else {
      missing.push(dep);
      console.log(`   ❌ ${dep} - missing`);
    }
  }
  
  if (missing.length > 0) {
    console.log(`\n   🔧 Missing dependencies: ${missing.join(', ')}`);
    console.log(`   Run: npm install ${missing.join(' ')}`);
  }
  
} catch (error) {
  console.log('   ❌ Could not read package.json:', error.message);
}

// Summary and recommendations
setTimeout(() => {
  console.log('\n📋 Debug Summary & Next Steps:');
  console.log('===============================');
  
  if (importIssues.length > 0) {
    console.log('\n🚨 Import Issues Found:');
    importIssues.forEach((issue, i) => {
      console.log(`   ${i+1}. ${issue.name}: ${issue.error}`);
    });
    
    console.log('\n🔧 Recommended fixes:');
    console.log('   1. Fix import issues above');
    console.log('   2. Run: npm install');
    console.log('   3. Check file paths and naming');
  } else {
    console.log('\n✅ All imports working correctly');
    console.log('\n🔧 Since imports work but 403 persists, check:');
    console.log('   1. Middleware conflicts in app.js');
    console.log('   2. Rate limiting configuration');
    console.log('   3. CORS settings');
    console.log('   4. Route registration order');
    console.log('   5. Database connection issues');
  }
  
  console.log('\n🧪 Next debugging steps:');
  console.log('   1. node debug-comprehensive.js');
  console.log('   2. Check server logs when starting');
  console.log('   3. Test: curl -v http://localhost:3000/api/auth/health');
  console.log('   4. Add console.log to app.js to trace route registration');
  
  process.exit(0);
}, 2000);
