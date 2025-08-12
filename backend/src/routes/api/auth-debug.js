/**
 * Simplified Auth Routes - For 403 Debugging
 * 
 * This is a minimal version without dependencies to isolate 403 issues
 */

const express = require('express');
const router = express.Router();

console.log('🔧 [DEBUG] Simplified auth routes loading...');

// Test endpoint with no dependencies
router.get('/health', (req, res) => {
  console.log('🔧 [DEBUG] Auth health endpoint hit');
  res.json({
    success: true,
    status: 'healthy',
    message: 'Simplified auth routes working',
    timestamp: new Date().toISOString(),
    debug: {
      import_paths: 'working',
      route_registration: 'working',
      middleware: 'minimal'
    }
  });
});

// Simple info endpoint
router.get('/info', (req, res) => {
  console.log('🔧 [DEBUG] Auth info endpoint hit');
  res.json({
    success: true,
    data: {
      name: 'SLA Digital Platform Authentication (Debug Mode)',
      version: '1.0.0-debug',
      endpoints: {
        health: 'GET /api/auth/health',
        info: 'GET /api/auth/info',
        test_login: 'POST /api/auth/test-login'
      },
      status: 'debug_mode_active'
    }
  });
});

// Simple test login without database or JWT
router.post('/test-login', (req, res) => {
  console.log('🔧 [DEBUG] Test login endpoint hit');
  console.log('🔧 [DEBUG] Request body:', req.body);
  
  const { email, password } = req.body;
  
  if (!email || !password) {
    return res.status(400).json({
      success: false,
      message: 'Email and password required for testing'
    });
  }
  
  // Simulate successful login without database
  res.json({
    success: true,
    message: 'Test login successful (no actual authentication)',
    data: {
      test_user: {
        email: email,
        role: 'admin',
        name: 'Test User'
      },
      test_token: 'test-jwt-token-12345',
      note: 'This is a debug endpoint - no real authentication'
    }
  });
});

// Simple error test
router.get('/error-test', (req, res) => {
  console.log('🔧 [DEBUG] Error test endpoint hit');
  res.status(500).json({
    success: false,
    message: 'Intentional error for testing',
    debug: true
  });
});

// 404 test for unmatched routes within auth
router.use('*', (req, res) => {
  console.log('🔧 [DEBUG] Auth 404 handler hit for:', req.originalUrl);
  res.status(404).json({
    success: false,
    message: 'Auth endpoint not found',
    requested_path: req.originalUrl,
    available_endpoints: [
      '/api/auth/health',
      '/api/auth/info', 
      '/api/auth/test-login',
      '/api/auth/error-test'
    ]
  });
});

console.log('✅ [DEBUG] Simplified auth routes loaded successfully');

module.exports = router;