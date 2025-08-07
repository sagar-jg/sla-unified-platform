/**
 * Enhanced Logger with New Relic Integration
 * 
 * Provides structured logging with New Relic APM integration,
 * including operator-specific logging and performance tracking.
 */

const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const newrelic = require('newrelic');
const path = require('path');

// Create logs directory if it doesn't exist
const fs = require('fs');
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Custom format for structured logging
const customFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss.SSS'
  }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.printf((info) => {
    const { timestamp, level, message, ...meta } = info;
    
    const logEntry = {
      timestamp,
      level: level.toUpperCase(),
      message,
      service: 'sla-digital-unified-platform',
      version: process.env.APP_VERSION || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      pid: process.pid,
      ...meta
    };
    
    return JSON.stringify(logEntry);
  })
);

// Console format for development
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({
    format: 'HH:mm:ss'
  }),
  winston.format.printf((info) => {
    const { timestamp, level, message, ...meta } = info;
    const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
    return `${timestamp} [${level}]: ${message} ${metaStr}`;
  })
);

// Create Winston logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: customFormat,
  defaultMeta: {
    service: 'sla-digital-unified-platform',
    version: process.env.APP_VERSION || '1.0.0',
    environment: process.env.NODE_ENV || 'development'
  },
  transports: []
});

// Add console transport for development
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: consoleFormat
  }));
}

// Add file transports if enabled
if (process.env.LOG_FILE_ENABLED === 'true') {
  // Error log file
  logger.add(new DailyRotateFile({
    filename: path.join(logsDir, 'error-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    level: 'error',
    maxSize: '20m',
    maxFiles: '14d',
    format: customFormat
  }));
  
  // Combined log file
  logger.add(new DailyRotateFile({
    filename: path.join(logsDir, 'combined-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    maxSize: '20m',
    maxFiles: '14d',
    format: customFormat
  }));
  
  // Operator-specific log file
  logger.add(new DailyRotateFile({
    filename: path.join(logsDir, 'operators-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    maxSize: '20m',
    maxFiles: '14d',
    format: customFormat,
    level: 'info'
  }));
}

/**
 * Enhanced Logger class with New Relic integration
 */
class Logger {
  /**
   * Log info message
   */
  static info(message, meta = {}) {
    logger.info(message, meta);
    
    // Send custom event to New Relic
    if (process.env.NEW_RELIC_ENABLED !== 'false') {
      newrelic.recordCustomEvent('ApplicationLog', {
        level: 'INFO',
        message,
        ...meta
      });
    }
  }
  
  /**
   * Log error message
   */
  static error(message, meta = {}) {
    logger.error(message, meta);
    
    // Send error to New Relic
    if (process.env.NEW_RELIC_ENABLED !== 'false') {
      if (meta.error instanceof Error) {
        newrelic.noticeError(meta.error);
      }
      
      newrelic.recordCustomEvent('ApplicationLog', {
        level: 'ERROR',
        message,
        ...meta
      });
    }
  }
  
  /**
   * Log warning message
   */
  static warn(message, meta = {}) {
    logger.warn(message, meta);
    
    if (process.env.NEW_RELIC_ENABLED !== 'false') {
      newrelic.recordCustomEvent('ApplicationLog', {
        level: 'WARN',
        message,
        ...meta
      });
    }
  }
  
  /**
   * Log debug message
   */
  static debug(message, meta = {}) {
    logger.debug(message, meta);
    
    if (process.env.NEW_RELIC_ENABLED !== 'false') {
      newrelic.recordCustomEvent('ApplicationLog', {
        level: 'DEBUG',
        message,
        ...meta
      });
    }
  }
  
  /**
   * Log operator-specific actions
   */
  static operatorAction(operatorCode, action, result, meta = {}) {
    const logData = {
      operatorCode,
      action,
      success: result.success || false,
      duration: meta.duration,
      environment: process.env.NODE_ENV,
      ...meta
    };
    
    const message = `Operator ${operatorCode}: ${action} - ${result.success ? 'SUCCESS' : 'FAILED'}`;
    
    if (result.success) {
      logger.info(message, logData);
    } else {
      logger.error(message, logData);
    }
    
    // Send operator-specific event to New Relic
    if (process.env.NEW_RELIC_ENABLED !== 'false') {
      newrelic.recordCustomEvent('OperatorAction', logData);
    }
  }
  
  /**
   * Log API requests
   */
  static apiRequest(req, res, responseTime, meta = {}) {
    const logData = {
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      responseTime: `${responseTime}ms`,
      userAgent: req.get('User-Agent'),
      ip: req.ip || req.connection.remoteAddress,
      userId: req.user?.id,
      ...meta
    };
    
    const message = `${req.method} ${req.originalUrl} ${res.statusCode} - ${responseTime}ms`;
    
    if (res.statusCode >= 400) {
      logger.error(message, logData);
    } else {
      logger.info(message, logData);
    }
    
    // Send API request event to New Relic
    if (process.env.NEW_RELIC_ENABLED !== 'false') {
      newrelic.recordCustomEvent('APIRequest', logData);
    }
  }
  
  /**
   * Log database operations
   */
  static database(operation, table, result, meta = {}) {
    const logData = {
      operation,
      table,
      success: result.success || false,
      duration: meta.duration,
      rowsAffected: meta.rowsAffected,
      ...meta
    };
    
    const message = `Database ${operation} on ${table} - ${result.success ? 'SUCCESS' : 'FAILED'}`;
    
    if (result.success) {
      logger.debug(message, logData);
    } else {
      logger.error(message, logData);
    }
    
    // Send database event to New Relic
    if (process.env.NEW_RELIC_ENABLED !== 'false') {
      newrelic.recordCustomEvent('DatabaseOperation', logData);
    }
  }
  
  /**
   * Log webhook events
   */
  static webhook(operatorCode, event, payload, meta = {}) {
    const logData = {
      operatorCode,
      event,
      payloadSize: JSON.stringify(payload).length,
      timestamp: new Date().toISOString(),
      ...meta
    };
    
    const message = `Webhook received from ${operatorCode}: ${event}`;
    logger.info(message, logData);
    
    // Send webhook event to New Relic
    if (process.env.NEW_RELIC_ENABLED !== 'false') {
      newrelic.recordCustomEvent('WebhookReceived', logData);
    }
  }
  
  /**
   * Log performance metrics
   */
  static performance(operation, duration, meta = {}) {
    const logData = {
      operation,
      duration: `${duration}ms`,
      timestamp: new Date().toISOString(),
      ...meta
    };
    
    const message = `Performance: ${operation} completed in ${duration}ms`;
    
    if (duration > 5000) { // Log as warning if > 5 seconds
      logger.warn(message, logData);
    } else {
      logger.debug(message, logData);
    }
    
    // Send performance event to New Relic
    if (process.env.NEW_RELIC_ENABLED !== 'false') {
      newrelic.recordCustomEvent('PerformanceMetric', logData);
    }
  }
  
  /**
   * Log system health metrics
   */
  static health(component, status, meta = {}) {
    const logData = {
      component,
      status,
      timestamp: new Date().toISOString(),
      ...meta
    };
    
    const message = `Health check: ${component} is ${status}`;
    
    if (status === 'healthy') {
      logger.debug(message, logData);
    } else {
      logger.error(message, logData);
    }
    
    // Send health event to New Relic
    if (process.env.NEW_RELIC_ENABLED !== 'false') {
      newrelic.recordCustomEvent('HealthCheck', logData);
    }
  }
}

module.exports = Logger;