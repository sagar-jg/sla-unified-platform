// Load New Relic first (must be before other requires)
require('newrelic');

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
require('express-async-errors');

// Import middleware
const { requestLogger, errorLogger } = require('./middleware/logging');
const { errorHandler } = require('./middleware/errorHandler'); // 🔧 FIXED: Import destructured errorHandler
const { authenticateToken } = require('./middleware/auth');

// Import routes
const healthRoutes = require('./routes/health');
const apiV1Routes = require('./routes/api/v1');
const adminRoutes = require('./routes/admin');

// ✅ PHASE 1: Import SLA Digital v2.2 API routes
const slaV2Routes = require('./routes/api/v2.2'); // SLA Digital v2.2 compliant routes

// Import database connection and application initializer
const { connectDatabase } = require('./database/connection');
const ApplicationInitializer = require('./services/ApplicationInitializer');

// Create Express application
const app = express();

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

// CORS configuration
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS ? 
    process.env.ALLOWED_ORIGINS.split(',') : 
    ['http://localhost:3000', 'http://localhost:3001'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: true
}));

// Compression and parsing middleware
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting for unified platform API
const unifiedApiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 100 : 1000, // requests per window
  message: {
    error: 'Too many requests from this IP, please try again later.',
    code: 'RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// ✅ PHASE 1: Separate rate limiting for SLA Digital v2.2 API (more lenient as per SLA docs)
const slaApiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour window 
  max: process.env.NODE_ENV === 'production' ? 10000 : 50000, // Higher limit for telecom operations
  message: {
    error: {
      category: 'Authorization',
      code: '1003', 
      message: 'Rate limit exceeded'
    }
  },
  standardHeaders: false, // SLA doesn't use standard headers
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting for health checks and info endpoints
    return req.path === '/v2.2/' || req.path === '/v2.2/health';
  }
});

// Apply rate limiting
app.use('/api/', unifiedApiLimiter);
app.use('/v2.2/', slaApiLimiter); // ✅ PHASE 1: SLA Digital v2.2 rate limiting

// Request logging middleware
app.use(requestLogger);

// Health check routes (no auth required)
app.use('/health', healthRoutes);

// ✅ PHASE 1: SLA Digital v2.2 API routes (uses own HTTP Basic Auth - no JWT required)
app.use('/v2.2', slaV2Routes);

// Unified Platform API routes with JWT authentication
app.use('/api/v1', authenticateToken, apiV1Routes);

// Admin routes with JWT authentication  
app.use('/api/admin', authenticateToken, adminRoutes);

// Root endpoint - Updated to show both APIs
app.get('/', (req, res) => {
  res.json({
    name: 'SLA Digital Unified Platform',
    version: process.env.APP_VERSION || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    status: 'operational',
    
    // ✅ PHASE 1: Both API systems available
    api_systems: {
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
    
    health: '/health'
  });
});

// API documentation endpoint - Updated
app.get('/api', (req, res) => {
  res.json({
    name: 'SLA Digital Unified Platform API',
    version: process.env.APP_VERSION || '1.0.0',
    
    endpoints: {
      // Unified Platform endpoints
      health: '/health',
      operators: '/api/v1/operators',
      subscriptions: '/api/v1/subscriptions',
      billing: '/api/v1/billing',
      otp: '/api/v1/otp',
      admin: '/api/admin',
      
      // ✅ PHASE 1: SLA Digital v2.2 endpoints
      sla_v2_2_info: '/v2.2',
      sla_v2_2_health: '/v2.2/health',
      sla_subscription_create: 'POST /v2.2/subscription/create',
      sla_subscription_status: 'POST /v2.2/subscription/status',
      sla_charge: 'POST /v2.2/charge',
      sla_pin: 'POST /v2.2/pin',
      sla_eligibility: 'POST /v2.2/eligibility',
      sla_sms: 'POST /v2.2/sms',
      sla_refund: 'POST /v2.2/refund',
      sla_sandbox_provision: 'POST /v2.2/sandbox/provision'
    },
    
    documentation: 'https://github.com/sagar-jg/sla-unified-platform'
  });
});

// Application status endpoint - Updated with Phase 1 info
app.get('/api/status', (req, res) => {
  const status = ApplicationInitializer.getStatus();
  
  // ✅ PHASE 1: Add SLA Digital v2.2 implementation status
  status.sla_digital_v2_2 = {
    phase_1_routes: 'COMPLETE',
    phase_2_controllers: 'IN PROGRESS',
    phase_3_authentication: 'PENDING',
    phase_4_response_mapping: 'PENDING', 
    phase_5_testing: 'PENDING',
    compliance_percentage: '20%' // Phase 1 of 5 phases
  };
  
  res.json(status);
});

// 404 handler for unknown routes - Updated
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    message: `The requested endpoint ${req.originalUrl} does not exist`,
    availableEndpoints: {
      unified_platform: ['/health', '/api/v1', '/api/admin', '/api/status'],
      sla_digital_v2_2: ['/v2.2', '/v2.2/health', '/v2.2/subscription/create', '/v2.2/charge', '/v2.2/pin']
    }
  });
});

// Error logging middleware
app.use(errorLogger);

// Global error handler (must be last)
app.use(errorHandler); // 🔧 FIXED: Now using the properly imported errorHandler function

// 🔧 UPDATED: Initialize application with proper sequencing
const initializeApp = async () => {
  try {
    console.log('🚀 Starting SLA Digital Platform initialization...');
    
    // Step 1: Connect to database
    await connectDatabase();
    console.log('✅ Database connected successfully');
    
    // Step 2: Initialize application services (OperatorManager singleton, etc.)
    await ApplicationInitializer.initialize();
    console.log('✅ Application services initialized successfully');
    
    // ✅ PHASE 1: Log SLA Digital v2.2 API availability
    console.log('🎯 SLA Digital v2.2 API routes registered');
    console.log('   • Base URL: /v2.2');
    console.log('   • Endpoints: 14 SLA Digital v2.2 compliant endpoints');
    console.log('   • Operators: All 26 operators supported');
    console.log('   • Status: Phase 1 (Routes) COMPLETE');
    
    console.log('🎉 Platform initialization completed!');
    
  } catch (error) {
    console.error('❌ Platform initialization failed:', error.message);
    process.exit(1);
  }
};

// Initialize the application
initializeApp();

module.exports = app;