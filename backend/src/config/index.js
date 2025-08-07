/**
 * Application Configuration
 * 
 * Centralized configuration management for the SLA Digital unified platform.
 * All environment variables are defined here with sensible defaults.
 */

require('dotenv').config();

const config = {
  // Application settings
  app: {
    name: 'SLA Digital Unified Platform',
    version: process.env.APP_VERSION || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.PORT) || 3001,
    host: process.env.HOST || '0.0.0.0',
    baseUrl: process.env.BASE_URL || `http://localhost:${parseInt(process.env.PORT) || 3001}`,
  },

  // CORS configuration
  cors: {
    origin: process.env.ALLOWED_ORIGINS 
      ? process.env.ALLOWED_ORIGINS.split(',').map(url => url.trim())
      : ['http://localhost:3000', 'http://localhost:3001'],
    credentials: true,
    optionsSuccessStatus: 200,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  },

  // Database configuration
  database: {
    url: process.env.DATABASE_URL,
    pool: {
      min: parseInt(process.env.DB_POOL_MIN) || 2,
      max: parseInt(process.env.DB_POOL_MAX) || 10,
      acquire: parseInt(process.env.DB_POOL_ACQUIRE) || 30000,
      idle: parseInt(process.env.DB_POOL_IDLE) || 10000,
    },
  },

  // Redis configuration
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    password: process.env.REDIS_PASSWORD || '',
    db: parseInt(process.env.REDIS_DB) || 0,
    retryDelayOnFailover: 100,
    maxRetriesPerRequest: 3,
  },

  // Cache TTL settings (in seconds)
  cache: {
    operators: parseInt(process.env.CACHE_TTL_OPERATORS) || 300,
    subscriptions: parseInt(process.env.CACHE_TTL_SUBSCRIPTIONS) || 60,
    health: parseInt(process.env.CACHE_TTL_HEALTH) || 300,
  },

  // SLA Digital API configuration
  slaApi: {
    baseUrl: process.env.SLA_API_BASE_URL || 'https://api.sla-alacrity.com',
    username: process.env.SLA_API_USERNAME,
    password: process.env.SLA_API_PASSWORD,
    whitelistedIps: process.env.SLA_API_WHITELISTED_IPS 
      ? process.env.SLA_API_WHITELISTED_IPS.split(',').map(ip => ip.trim())
      : [],
    defaultEnvironment: process.env.SLA_DEFAULT_ENVIRONMENT || 'sandbox',
    timeout: parseInt(process.env.OPERATOR_REQUEST_TIMEOUT) || 30000,
    connectionTimeout: parseInt(process.env.OPERATOR_CONNECTION_TIMEOUT) || 10000,
    maxRetries: parseInt(process.env.OPERATOR_MAX_RETRIES) || 3,
    retryDelay: parseInt(process.env.OPERATOR_RETRY_DELAY) || 1000,
  },

  // Authentication & JWT
  auth: {
    jwtSecret: process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production',
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '24h',
    jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
    encryptionKey: process.env.ENCRYPTION_KEY || 'your-32-character-encryption-key!!',
    bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS) || 12,
    sessionTimeout: process.env.SESSION_TIMEOUT || '24h',
    maxLoginAttempts: parseInt(process.env.MAX_LOGIN_ATTEMPTS) || 5,
    accountLockTime: process.env.ACCOUNT_LOCK_TIME || '15m',
  },

  // Logging configuration
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    format: process.env.LOG_FORMAT || 'json',
    requests: process.env.LOG_REQUESTS === 'true',
    maxSize: process.env.LOG_FILE_MAX_SIZE || '20m',
    maxFiles: process.env.LOG_FILE_MAX_FILES || '14d',
  },

  // New Relic monitoring
  newRelic: {
    enabled: process.env.NEW_RELIC_ENABLED === 'true',
    licenseKey: process.env.NEW_RELIC_LICENSE_KEY,
    appName: process.env.NEW_RELIC_APP_NAME || 'SLA Digital Unified Platform',
    logLevel: process.env.NEW_RELIC_LOG_LEVEL || 'info',
  },

  // Health monitoring
  health: {
    checkInterval: parseInt(process.env.HEALTH_CHECK_INTERVAL) || 5,
    scoreWarning: parseFloat(process.env.HEALTH_SCORE_WARNING) || 0.7,
    scoreCritical: parseFloat(process.env.HEALTH_SCORE_CRITICAL) || 0.5,
    timeout: parseInt(process.env.HEALTH_CHECK_TIMEOUT) || 30000,
  },

  // Rate limiting
  rateLimit: {
    window: parseInt(process.env.RATE_LIMIT_WINDOW) || 900000, // 15 minutes
    max: parseInt(process.env.RATE_LIMIT_MAX) || 100,
    api: {
      max: parseInt(process.env.RATE_LIMIT_API_MAX) || 1000,
    },
    admin: {
      max: parseInt(process.env.RATE_LIMIT_ADMIN_MAX) || 200,
    },
  },

  // Webhook settings
  webhooks: {
    timeout: parseInt(process.env.WEBHOOK_TIMEOUT) || 10000,
    retryAttempts: parseInt(process.env.WEBHOOK_RETRY_ATTEMPTS) || 3,
    retryInterval: process.env.WEBHOOK_RETRY_INTERVAL || '4h',
  },

  // Azure configuration (for production)
  azure: {
    clientId: process.env.AZURE_CLIENT_ID,
    clientSecret: process.env.AZURE_CLIENT_SECRET,
    tenantId: process.env.AZURE_TENANT_ID,
    keyVaultUrl: process.env.AZURE_KEY_VAULT_URL,
    insightsKey: process.env.AZURE_INSIGHTS_INSTRUMENTATION_KEY,
  },

  // Development settings
  development: {
    debug: process.env.DEBUG === 'true',
    mockSlaApi: process.env.MOCK_SLA_API === 'true',
    autoSeed: process.env.AUTO_SEED === 'true',
    enableApiDocs: process.env.ENABLE_API_DOCS !== 'false',
  },

  // Security settings
  security: {
    enableHelmet: true,
    enableCompression: true,
    trustProxy: process.env.NODE_ENV === 'production',
  },
};

// Validation for required environment variables in production
if (config.app.environment === 'production') {
  const requiredEnvVars = [
    'DATABASE_URL',
    'JWT_SECRET',
    'ENCRYPTION_KEY',
    'SLA_API_USERNAME',
    'SLA_API_PASSWORD',
  ];

  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    throw new Error(`Missing required environment variables in production: ${missingVars.join(', ')}`);
  }
}

module.exports = config;