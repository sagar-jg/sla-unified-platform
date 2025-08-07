'use strict';

/**
 * New Relic agent configuration.
 *
 * See lib/config/default.js in the agent distribution for a more complete
 * description of configuration variables and their potential values.
 */
exports.config = {
  /**
   * Array of application names.
   */
  app_name: [process.env.NEW_RELIC_APP_NAME || 'SLA Digital Unified Platform'],
  
  /**
   * Your New Relic license key.
   */
  license_key: process.env.NEW_RELIC_LICENSE_KEY,
  
  /**
   * Logging configuration
   */
  logging: {
    /**
     * Level at which to log. 'trace', 'debug', 'info', 'warn', 'error', 'fatal'
     */
    level: process.env.NEW_RELIC_LOG_LEVEL || 'info',
    
    /**
     * Where to put the log file -- if absent, logs to stdout
     */
    filepath: process.env.NEW_RELIC_LOG || 'stdout',
    
    /**
     * Whether to write to a log file
     */
    enabled: process.env.NEW_RELIC_ENABLED !== 'false'
  },
  
  /**
   * When true, all request headers except for those listed in attributes.exclude
   * will be captured for all traces, unless otherwise specified in a destination's
   * attributes include/exclude lists.
   */
  allow_all_headers: true,
  
  /**
   * Attributes configuration
   */
  attributes: {
    /**
     * Prefix of attributes to exclude from all destinations. Allows * as wildcard
     * at end.
     */
    exclude: [
      'request.headers.cookie',
      'request.headers.authorization',
      'request.headers.proxyAuthorization',
      'request.headers.setCookie*',
      'request.headers.x*',
      'response.headers.cookie',
      'response.headers.authorization',
      'response.headers.proxyAuthorization',
      'response.headers.setCookie*',
      'response.headers.x*'
    ]
  },
  
  /**
   * Transaction tracer configuration
   */
  transaction_tracer: {
    /**
     * Whether to enable transaction tracing
     */
    enabled: true,
    
    /**
     * Threshold in milliseconds. Transactions with durations above this
     * threshold are eligible for slow transaction traces
     */
    transaction_threshold: 'apdex_f',
    
    /**
     * Whether to capture request parameters
     */
    record_sql: 'obfuscated',
    
    /**
     * Threshold for explaining slow SQL queries
     */
    explain_threshold: 500,
    
    /**
     * Maximum number of slow SQL queries to capture per harvest cycle
     */
    max_explain_statements: 20
  },
  
  /**
   * Error collector configuration
   */
  error_collector: {
    /**
     * Whether to enable error collection
     */
    enabled: true,
    
    /**
     * List of HTTP error status codes to ignore
     */
    ignore_status_codes: [404],
    
    /**
     * Whether to capture request parameters on errors
     */
    capture_request_params: false,
    
    /**
     * Maximum number of errors to collect per harvest cycle
     */
    max_event_samples_stored: 100
  },
  
  /**
   * Browser monitoring configuration
   */
  browser_monitoring: {
    /**
     * Whether to enable browser monitoring
     */
    enable: false
  },
  
  /**
   * Application performance monitoring
   */
  application_logging: {
    /**
     * Whether to enable application logging
     */
    enabled: true,
    
    /**
     * Forwarding configuration
     */
    forwarding: {
      enabled: true,
      max_samples_stored: 10000
    },
    
    /**
     * Local log decoration
     */
    local_decorating: {
      enabled: true
    },
    
    /**
     * Metrics configuration
     */
    metrics: {
      enabled: true
    }
  },
  
  /**
   * Custom events configuration
   */
  custom_events: {
    /**
     * Whether to enable custom events
     */
    enabled: true,
    
    /**
     * Maximum number of custom events per harvest cycle
     */
    max_samples_stored: 30000
  },
  
  /**
   * Custom insights events configuration
   */
  custom_insights_events: {
    /**
     * Whether to enable custom insights events
     */
    enabled: true,
    
    /**
     * Maximum number of custom insights events per harvest cycle
     */
    max_samples_stored: 30000
  },
  
  /**
   * Distributed tracing configuration
   */
  distributed_tracing: {
    /**
     * Whether to enable distributed tracing
     */
    enabled: true
  },
  
  /**
   * Cross application tracing configuration (deprecated - use distributed tracing)
   */
  cross_application_tracer: {
    /**
     * Whether to enable cross application tracing
     */
    enabled: false
  },
  
  /**
   * High security mode (disables certain features for PCI compliance)
   */
  high_security: process.env.NODE_ENV === 'production',
  
  /**
   * Rules for naming or ignoring transactions
   */
  rules: {
    name: [
      // Health check endpoints
      { pattern: /\/health.*/, name: '/health/*' },
      
      // API versioning
      { pattern: /\/api\/v1\/operators.*/, name: '/api/v1/operators/*' },
      { pattern: /\/api\/v1\/subscriptions.*/, name: '/api/v1/subscriptions/*' },
      { pattern: /\/api\/v1\/billing.*/, name: '/api/v1/billing/*' },
      { pattern: /\/api\/v1\/otp.*/, name: '/api/v1/otp/*' },
      
      // Admin endpoints
      { pattern: /\/api\/admin.*/, name: '/api/admin/*' }
    ],
    
    ignore: [
      // Ignore health checks for cleaner metrics
      /\/health$/,
      /\/health\/ready$/,
      /\/health\/live$/
    ]
  },
  
  /**
   * Performance monitoring configuration
   */
  performance: {
    /**
     * Whether to capture function traces
     */
    capture_params: process.env.NODE_ENV !== 'production',
    
    /**
     * Maximum depth for capturing stack traces
     */
    max_stack_trace_lines: 50
  },
  
  /**
   * Shutdown configuration
   */
  shutdown: {
    /**
     * Timeout for graceful shutdown
     */
    timeout: 2500
  }
};

/**
 * Environment-specific overrides
 */
if (process.env.NODE_ENV === 'production') {
  // Production optimizations
  exports.config.logging.level = 'warn';
  exports.config.performance.capture_params = false;
  exports.config.transaction_tracer.record_sql = 'raw';
  exports.config.high_security = true;
} else if (process.env.NODE_ENV === 'development') {
  // Development debugging
  exports.config.logging.level = 'debug';
  exports.config.performance.capture_params = true;
  exports.config.transaction_tracer.record_sql = 'obfuscated';
  exports.config.high_security = false;
}

/**
 * Custom instrumentation for SLA Digital API calls
 */
exports.config.api = {
  /**
   * Custom attributes for better monitoring
   */
  custom_attributes_enabled: true,
  
  /**
   * Custom events for business metrics
   */  
  custom_events_enabled: true
};

// Disable New Relic if license key is not provided
if (!process.env.NEW_RELIC_LICENSE_KEY) {
  exports.config.agent_enabled = false;
  console.log('⚠️  New Relic disabled: No license key provided');
} else {
  exports.config.agent_enabled = process.env.NEW_RELIC_ENABLED !== 'false';
  console.log('📊 New Relic enabled for:', exports.config.app_name[0]);
}