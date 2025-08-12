// Load New Relic first (must be before other requires)
require('newrelic');

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
require('express-async-errors');

console.log('🚀 [DEBUG] Starting SLA Digital Platform with debug mode...');

// Import middleware
const { requestLogger, errorLogger } = require('./middleware/logging');
const { errorHandler } = require('./middleware/errorHandler');
const { authenticateToken } = require('./middleware/auth');

// 🔧 DEBUG: Import both regular and debug auth routes
const authRoutes = require('./routes/api/auth');
const authDebugRoutes = require('./routes/api/auth-debug'); // Simplified debug routes

// Import other routes
const healthRoutes = require('./routes/health');
const apiV1Routes = require('./routes/api/v1');
const adminRoutes = require('./routes/admin');

// Import SLA Digital v2.2 API routes
const slaV2Routes = require('./routes/api/v2.2');

// Import database connection and application initializer
const { connectDatabase } = require('./database/connection');
const ApplicationInitializer = require('./services/ApplicationInitializer');

// Create Express application
const app = express();

console.log('✅ [DEBUG] Express app created successfully');

// Trust proxy for rate limiting behind load balancers
app.set('trust proxy', 1);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  crossOriginEmbedderPolicy: false
}));

console.log('✅ [DEBUG] Security middleware loaded');

// CORS configuration
app.use(cors({
  origin: function (origin, callback) {
    console.log('🔧 [DEBUG] CORS origin check:', origin);
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = process.env.ALLOWED_ORIGINS ? 
      process.env.ALLOWED_ORIGINS.split(',') : 
      ['http://localhost:3000', 'http://localhost:3001'];
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.log('❌ [DEBUG] CORS blocked origin:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: true
}));

console.log('✅ [DEBUG] CORS middleware loaded');

// Compression and parsing middleware
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

console.log('✅ [DEBUG] Parsing middleware loaded');

// Rate limiting for unified platform API
const unifiedApiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 100 : 1000,
  message: {
    error: 'Too many requests from this IP, please try again later.',
    code: 'RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// 🔧 DEBUG: More lenient auth rate limiting for debugging
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes  
  max: 50, // More lenient for debugging
  message: {
    error: 'Too many authentication attempts, please try again later.',
    code: 'AUTH_RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    console.log('🔧 [DEBUG] Rate limiter check for:', req.path);
    return false; // Don't skip any requests, but log them
  }
});

// SLA Digital v2.2 API rate limiting
const slaApiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour window 
  max: process.env.NODE_ENV === 'production' ? 10000 : 50000,
  message: {
    error: {
      category: 'Authorization',
      code: '1003', 
      message: 'Rate limit exceeded'
    }
  },
  standardHeaders: false,
  legacyHeaders: false,
  skip: (req) => {
    return req.path === '/v2.2/' || req.path === '/v2.2/health';
  }
});

console.log('✅ [DEBUG] Rate limiters configured');

// Request logging middleware with debug
app.use((req, res, next) => {
  console.log(`🔧 [DEBUG] Incoming request: ${req.method} ${req.url}`);
  console.log(`🔧 [DEBUG] Headers:`, JSON.stringify(req.headers, null, 2));
  next();
});

app.use(requestLogger);

console.log('✅ [DEBUG] Request logging middleware loaded');

// Health check routes (no auth required)
app.use('/health', healthRoutes);
console.log('✅ [DEBUG] Health routes registered at /health');

// 🔧 DEBUG: Register BOTH auth routes for comparison
console.log('🔧 [DEBUG] Registering authentication routes...');

// Debug routes (simplified, no dependencies)
app.use('/api/auth-debug', authDebugRoutes);
console.log('✅ [DEBUG] Debug auth routes registered at /api/auth-debug/*');

// Regular auth routes (full functionality)
app.use('/api/auth', authLimiter, (req, res, next) => {
  console.log('🔧 [DEBUG] Auth middleware chain - before auth routes');
  next();
}, authRoutes);
console.log('✅ [DEBUG] Regular auth routes registered at /api/auth/*');

// Add a test route to verify basic routing works
app.get('/test-route', (req, res) => {
  console.log('🔧 [DEBUG] Test route hit');
  res.json({
    success: true,
    message: 'Basic routing works',
    timestamp: new Date().toISOString()
  });
});
console.log('✅ [DEBUG] Test route registered at /test-route');

// SLA Digital v2.2 API routes
console.log('🔧 [DEBUG] Registering SLA Digital v2.2 routes...');
app.use('/v2.2', slaApiLimiter, slaV2Routes);
console.log('✅ [DEBUG] SLA Digital v2.2 routes registered at /v2.2/*');

// Apply general rate limiting to other API routes
app.use('/api/', unifiedApiLimiter);

// Unified Platform API routes with JWT authentication
console.log('🔧 [DEBUG] Registering unified platform API routes...');
app.use('/api/v1', authenticateToken, apiV1Routes);
console.log('✅ [DEBUG] Unified platform API routes registered at /api/v1/*');

// Admin routes with JWT authentication  
console.log('🔧 [DEBUG] Registering admin routes...');
app.use('/api/admin', authenticateToken, adminRoutes);
console.log('✅ [DEBUG] Admin routes registered at /api/admin/*');

// Root endpoint with debug info
app.get('/', (req, res) => {
  console.log('🔧 [DEBUG] Root endpoint hit');
  res.json({
    name: 'SLA Digital Unified Platform (Debug Mode)',
    version: process.env.APP_VERSION || '1.0.0-debug',
    environment: process.env.NODE_ENV || 'development',
    status: 'operational',
    debug_mode: true,
    
    api_systems: {
      authentication: {
        description: 'JWT-based authentication system',
        base_url: '/api/auth',
        debug_url: '/api/auth-debug',
        authentication: 'None (for login/register), JWT Token (for protected routes)',
        features: ['Login', 'Registration', 'JWT Tokens', 'Session Management'],
        endpoints: {
          login: 'POST /api/auth/login',
          debug_login: 'POST /api/auth-debug/test-login',
          register: 'POST /api/auth/register', 
          logout: 'POST /api/auth/logout',
          profile: 'GET /api/auth/me',
          health: 'GET /api/auth/health',
          debug_health: 'GET /api/auth-debug/health'
        },
        status: 'DEBUG_MODE'
      },
      unified_platform: {
        description: 'Unified telecom management platform',
        base_url: '/api/v1',
        authentication: 'JWT Token',
        features: ['Operator Management', 'Analytics', 'Dashboard', 'Multi-tenant'],
        documentation: '/api/v1'
      },
      sla_digital_v2_2: {
        description: 'SLA Digital v2.2 compliant API',
        base_url: '/v2.2',
        authentication: 'HTTP Basic Auth + IP Whitelisting',
        features: ['Direct Carrier Billing', 'Subscription Management', 'PIN/OTP', 'Eligibility'],
        documentation: '/v2.2',
        compliance: '100%'
      }
    },
    
    debug_endpoints: {
      test_route: '/test-route',
      health: '/health',
      auth_debug_health: '/api/auth-debug/health',
      auth_debug_info: '/api/auth-debug/info'
    }
  });
});

// Debug endpoint list
app.get('/debug/routes', (req, res) => {
  console.log('🔧 [DEBUG] Debug routes endpoint hit');
  res.json({
    success: true,
    message: 'Available routes for debugging',
    routes: {
      basic: [
        'GET /',
        'GET /test-route',
        'GET /health',
        'GET /debug/routes'
      ],
      auth_debug: [
        'GET /api/auth-debug/health',
        'GET /api/auth-debug/info',
        'POST /api/auth-debug/test-login'
      ],
      auth_regular: [
        'GET /api/auth/health',
        'POST /api/auth/login',
        'POST /api/auth/register'
      ]
    }
  });
});

// 404 handler for unknown routes with debug info
app.use('*', (req, res) => {
  console.log(`🔧 [DEBUG] 404 handler hit for: ${req.method} ${req.originalUrl}`);
  res.status(404).json({
    error: 'Endpoint not found',
    method: req.method,
    requested_path: req.originalUrl,
    message: `The requested endpoint ${req.originalUrl} does not exist`,
    debug_mode: true,
    availableEndpoints: {
      debug: ['/test-route', '/debug/routes', '/api/auth-debug/health'],
      authentication: ['/api/auth/health', '/api/auth-debug/health', '/api/auth/login'],
      unified_platform: ['/health', '/api/v1', '/api/admin', '/api/status'],
      sla_digital_v2_2: ['/v2.2', '/v2.2/health', '/v2.2/subscription/create']
    }
  });
});

// Error logging middleware
app.use(errorLogger);

// Global error handler (must be last)
app.use((error, req, res, next) => {
  console.log('🔧 [DEBUG] Global error handler hit:', error.message);
  errorHandler(error, req, res, next);
});

// Initialize application with debug logging
const initializeApp = async () => {
  try {
    console.log('🚀 [DEBUG] Starting platform initialization...');
    
    // Step 1: Connect to database
    try {
      await connectDatabase();
      console.log('✅ [DEBUG] Database connected successfully');
    } catch (dbError) {
      console.log('⚠️ [DEBUG] Database connection failed, continuing without DB:', dbError.message);
    }
    
    // Step 2: Initialize application services
    try {
      await ApplicationInitializer.initialize();
      console.log('✅ [DEBUG] Application services initialized successfully');
    } catch (initError) {
      console.log('⚠️ [DEBUG] Service initialization failed, continuing:', initError.message);
    }
    
    // Step 3: Log all registered routes
    console.log('📋 [DEBUG] Route Registration Summary:');
    console.log('   ✅ Test Route: /test-route');
    console.log('   ✅ Health Check: /health');
    console.log('   ✅ Debug Auth: /api/auth-debug/* (simplified, no dependencies)');
    console.log('   ✅ Regular Auth: /api/auth/* (full functionality)');
    console.log('   ✅ Unified Platform: /api/v1/* (JWT protected)');
    console.log('   ✅ Admin Panel: /api/admin/* (JWT protected)');
    console.log('   ✅ SLA Digital v2.2: /v2.2/* (HTTP Basic Auth)');
    console.log('   ✅ Debug Routes: /debug/routes');
    
    console.log('🎉 [DEBUG] Platform initialization completed!');
    console.log('🔧 [DEBUG] Use /api/auth-debug/* endpoints for 403 debugging');
    
  } catch (error) {
    console.error('❌ [DEBUG] Platform initialization failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
};

// Initialize the application
initializeApp();

module.exports = app;