/**
 * Logging Middleware
 * 
 * Request/response logging with correlation IDs
 */

const { v4: uuidv4 } = require('uuid');
const Logger = require('../utils/logger');

/**
 * Request logging middleware
 */
const requestLogger = (req, res, next) => {
  // Generate correlation ID for request tracking
  const correlationId = req.get('X-Correlation-ID') || uuidv4();
  req.correlationId = correlationId;
  
  // Set correlation ID header in response
  res.setHeader('X-Correlation-ID', correlationId);
  
  // Record start time
  const startTime = Date.now();
  
  // Log request
  Logger.info('Incoming request', {
    correlationId,
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    contentType: req.get('Content-Type'),
    contentLength: req.get('Content-Length'),
    userId: req.user?.id,
    query: Object.keys(req.query).length > 0 ? req.query : undefined
  });
  
  // Capture response
  const originalSend = res.send;
  res.send = function(body) {
    const responseTime = Date.now() - startTime;
    
    // Log response
    Logger.apiRequest(req, res, responseTime, {
      correlationId,
      responseSize: body ? Buffer.byteLength(body, 'utf8') : 0
    });
    
    // Call original send
    originalSend.call(this, body);
  };
  
  next();
};

/**
 * Error logging middleware
 */
const errorLogger = (err, req, res, next) => {
  Logger.error('Request error', {
    error: err.message,
    stack: err.stack,
    correlationId: req.correlationId,
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    userId: req.user?.id,
    body: sanitizeParams(req.body)
  });
  
  next(err);
};

/**
 * Operator action logging middleware
 */
const operatorActionLogger = (action) => {
  return (req, res, next) => {
    const startTime = Date.now();
    
    // Override res.json to capture operator responses
    const originalJson = res.json;
    res.json = function(body) {
      const responseTime = Date.now() - startTime;
      const operatorCode = req.params.operatorCode || req.body.operatorCode;
      
      if (operatorCode) {
        Logger.operatorAction(operatorCode, action, {
          success: res.statusCode < 400,
          statusCode: res.statusCode
        }, {
          duration: responseTime,
          correlationId: req.correlationId,
          userId: req.user?.id,
          params: sanitizeParams(req.body)
        });
      }
      
      originalJson.call(this, body);
    };
    
    next();
  };
};

/**
 * Performance monitoring middleware
 */
const performanceLogger = (threshold = 1000) => {
  return (req, res, next) => {
    const startTime = Date.now();
    
    res.on('finish', () => {
      const responseTime = Date.now() - startTime;
      
      if (responseTime > threshold) {
        Logger.performance(`Slow request: ${req.method} ${req.originalUrl}`, responseTime, {
          correlationId: req.correlationId,
          method: req.method,
          url: req.originalUrl,
          statusCode: res.statusCode,
          userId: req.user?.id,
          threshold
        });
      }
    });
    
    next();
  };
};

/**
 * Database query logging middleware
 */
const queryLogger = (operation, table) => {
  return (req, res, next) => {
    const startTime = Date.now();
    
    res.on('finish', () => {
      const responseTime = Date.now() - startTime;
      
      Logger.database(operation, table, {
        success: res.statusCode < 400
      }, {
        duration: responseTime,
        correlationId: req.correlationId,
        userId: req.user?.id
      });
    });
    
    next();
  };
};

/**
 * Request body sanitizer (remove sensitive data from logs)
 */
function sanitizeParams(params) {
  if (!params || typeof params !== 'object') {
    return params;
  }
  
  const sensitiveFields = ['pin', 'password', 'token', 'secret', 'key', 'authorization'];
  const sanitized = { ...params };
  
  sensitiveFields.forEach(field => {
    Object.keys(sanitized).forEach(key => {
      if (key.toLowerCase().includes(field)) {
        sanitized[key] = '***';
      }
    });
  });
  
  // Mask MSISDN for privacy
  if (sanitized.msisdn) {
    const msisdn = sanitized.msisdn;
    if (msisdn.length > 4) {
      sanitized.msisdn = msisdn.substring(0, 3) + '***' + msisdn.substring(msisdn.length - 2);
    } else {
      sanitized.msisdn = '***';
    }
  }
  
  return sanitized;
}

/**
 * Create contextual logger for specific operation
 */
const createContextLogger = (context) => {
  return {
    info: (message, meta = {}) => Logger.info(message, { ...context, ...meta }),
    error: (message, meta = {}) => Logger.error(message, { ...context, ...meta }),
    warn: (message, meta = {}) => Logger.warn(message, { ...context, ...meta }),
    debug: (message, meta = {}) => Logger.debug(message, { ...context, ...meta })
  };
};

module.exports = {
  requestLogger,
  errorLogger,
  operatorActionLogger,
  performanceLogger,
  queryLogger,
  createContextLogger,
  sanitizeParams
};