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

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 100 : 1000, // requests per window
  message: {
    error: 'Too many requests from this IP, please try again later.',
    code: 'RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

// Request logging middleware
app.use(requestLogger);

// Health check routes (no auth required)
app.use('/health', healthRoutes);

// API routes with authentication
app.use('/api/v1', authenticateToken, apiV1Routes);

// Admin routes with authentication
app.use('/api/admin', authenticateToken, adminRoutes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'SLA Digital Unified Platform API',
    version: process.env.APP_VERSION || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    status: 'operational',
    documentation: '/api/docs',
    health: '/health'
  });
});

// API documentation endpoint
app.get('/api', (req, res) => {
  res.json({
    name: 'SLA Digital Unified Platform API',
    version: process.env.APP_VERSION || '1.0.0',
    endpoints: {
      health: '/health',
      operators: '/api/v1/operators',
      subscriptions: '/api/v1/subscriptions',
      billing: '/api/v1/billing',
      otp: '/api/v1/otp',
      admin: '/api/admin'
    },
    documentation: 'https://github.com/sagar-jg/sla-digital-unified-platform'
  });
});

// Application status endpoint
app.get('/api/status', (req, res) => {
  const status = ApplicationInitializer.getStatus();
  res.json(status);
});

// 404 handler for unknown routes
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    message: `The requested endpoint ${req.originalUrl} does not exist`,
    availableEndpoints: ['/health', '/api/v1', '/api/admin', '/api/status']
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
    
    console.log('🎉 Platform initialization completed!');
    
  } catch (error) {
    console.error('❌ Platform initialization failed:', error.message);
    process.exit(1);
  }
};

// Initialize the application
initializeApp();

module.exports = app;