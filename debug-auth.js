#!/usr/bin/env node

/**
 * Authentication Debug Script
 * Tests the authentication system after fixing the 403 error
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:3000';

class AuthDebugger {
  constructor() {
    this.results = {
      serverHealth: false,
      authHealth: false,
      loginSuccess: false,
      profileAccess: false,
      errors: []
    };
  }

  async debug() {
    console.log('🔍 SLA Digital Platform - Authentication Debug After Fix');
    console.log('=========================================================\n');

    await this.testServerHealth();
    await this.testAuthHealth();
    await this.testLogin();
    await this.testProtectedRoute();
    
    this.printSummary();
  }

  async testServerHealth() {
    console.log('1️⃣  Testing server health...');
    
    try {
      const response = await axios.get(`${BASE_URL}/health`, {
        timeout: 5000
      });
      
      console.log('   ✅ Server is running');
      console.log(`      Status: ${response.status}`);
      console.log(`      Response: ${JSON.stringify(response.data, null, 2)}`);
      this.results.serverHealth = true;
      
    } catch (error) {
      console.log('   ❌ Server health check failed:', error.message);
      this.results.errors.push('Server health: ' + error.message);
    }
    
    console.log('');
  }

  async testAuthHealth() {
    console.log('2️⃣  Testing authentication health...');
    
    try {
      const response = await axios.get(`${BASE_URL}/api/auth/health`, {
        timeout: 5000
      });
      
      console.log('   ✅ Authentication system operational');
      console.log(`      Status: ${response.status}`);
      console.log(`      Response: ${JSON.stringify(response.data, null, 2)}`);
      this.results.authHealth = true;
      
    } catch (error) {
      console.log('   ❌ Auth health check failed:', error.message);
      if (error.response) {
        console.log(`      Status: ${error.response.status}`);
        console.log(`      Data: ${JSON.stringify(error.response.data, null, 2)}`);
      }
      this.results.errors.push('Auth health: ' + error.message);
    }
    
    console.log('');
  }

  async testLogin() {
    console.log('3️⃣  Testing login with admin credentials...');
    
    try {
      const response = await axios.post(`${BASE_URL}/api/auth/login`, {
        email: 'admin@sla-platform.com',
        password: 'admin123!'
      }, {
        timeout: 5000,
        validateStatus: function (status) {
          return status < 500; // Don't throw error for 4xx responses
        }
      });
      
      if (response.status === 200 && response.data.success) {
        console.log('   ✅ Login successful!');
        console.log(`      Token received: ${response.data.data.token.substring(0, 30)}...`);
        console.log(`      User: ${response.data.data.user.name} (${response.data.data.user.role})`);
        this.results.loginSuccess = true;
        this.token = response.data.data.token;
      } else {
        console.log('   ❌ Login failed:');
        console.log(`      Status: ${response.status}`);
        console.log(`      Response: ${JSON.stringify(response.data, null, 2)}`);
        this.results.errors.push(`Login failed: ${response.status} - ${response.data.message || 'Unknown error'}`);
      }
      
    } catch (error) {
      console.log('   ❌ Login request failed:', error.message);
      if (error.response) {
        console.log(`      Status: ${error.response.status}`);
        console.log(`      Data: ${JSON.stringify(error.response.data, null, 2)}`);
      }
      this.results.errors.push('Login request: ' + error.message);
    }
    
    console.log('');
  }

  async testProtectedRoute() {
    console.log('4️⃣  Testing protected route access...');
    
    if (!this.token) {
      console.log('   ⏭️  Skipping (no token from login)');
      console.log('');
      return;
    }
    
    try {
      const response = await axios.get(`${BASE_URL}/api/auth/me`, {
        headers: {
          'Authorization': `Bearer ${this.token}`
        },
        timeout: 5000
      });
      
      if (response.status === 200 && response.data.success) {
        console.log('   ✅ Protected route access successful!');
        console.log(`      User profile: ${response.data.data.user.name}`);
        console.log(`      Email: ${response.data.data.user.email}`);
        console.log(`      Role: ${response.data.data.user.role}`);
        this.results.profileAccess = true;
      } else {
        console.log('   ❌ Protected route access failed');
        console.log(`      Status: ${response.status}`);
        console.log(`      Response: ${JSON.stringify(response.data, null, 2)}`);
      }
      
    } catch (error) {
      console.log('   ❌ Protected route request failed:', error.message);
      if (error.response) {
        console.log(`      Status: ${error.response.status}`);
        console.log(`      Data: ${JSON.stringify(error.response.data, null, 2)}`);
      }
      this.results.errors.push('Protected route: ' + error.message);
    }
    
    console.log('');
  }

  printSummary() {
    console.log('📊 Debug Summary:');
    console.log('=================');
    
    const checkMark = (condition) => condition ? '✅' : '❌';
    
    console.log(`${checkMark(this.results.serverHealth)} Server Health`);
    console.log(`${checkMark(this.results.authHealth)} Authentication Health`);
    console.log(`${checkMark(this.results.loginSuccess)} Login Success`);
    console.log(`${checkMark(this.results.profileAccess)} Protected Route Access`);
    
    if (this.results.errors.length > 0) {
      console.log('\n🚨 Errors Found:');
      this.results.errors.forEach((error, index) => {
        console.log(`   ${index + 1}. ${error}`);
      });
    }
    
    if (this.results.loginSuccess && this.results.profileAccess) {
      console.log('\n🎉 Authentication system is fully operational!');
      console.log('🔧 The 403 error has been successfully resolved!');
      
      console.log('\n📋 Available endpoints:');
      console.log('   • POST /api/auth/login - User login');
      console.log('   • POST /api/auth/register - User registration');
      console.log('   • GET /api/auth/me - Get user profile');
      console.log('   • POST /api/auth/logout - User logout');
      console.log('   • GET /api/auth/health - Auth system health');
      
    } else {
      console.log('\n🔧 Next Steps:');
      
      if (!this.results.serverHealth) {
        console.log('   • Start the server: npm start or node server.js');
        console.log('   • Check if port 3000 is available');
      }
      
      if (!this.results.authHealth) {
        console.log('   • Check if auth routes are properly imported');
        console.log('   • Verify database connection');
        console.log('   • Check middleware configuration');
      }
      
      if (!this.results.loginSuccess) {
        console.log('   • Verify admin user exists in database');
        console.log('   • Check password hashing in seeder');
        console.log('   • Run database seeders: npm run seed');
      }
    }
    
    console.log('\n🧪 Manual Test Commands:');
    console.log('# Test login:');
    console.log(`curl -X POST ${BASE_URL}/api/auth/login \\`);
    console.log(`  -H 'Content-Type: application/json' \\`);
    console.log(`  -d '{"email":"admin@sla-platform.com","password":"admin123!"}'`);
    
    console.log('\n# Test health:');
    console.log(`curl ${BASE_URL}/api/auth/health`);
  }
}

// Check if server URL is provided as argument
const serverUrl = process.argv[2];
if (serverUrl) {
  BASE_URL = serverUrl;
  console.log(`Using custom server URL: ${BASE_URL}`);
}

// Run the debugger
const debugger = new AuthDebugger();
debugger.debug().catch(error => {
  console.error('❌ Debug script failed:', error);
  process.exit(1);
});