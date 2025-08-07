/**
 * Error Handler Middleware
 * 
 * Global error handling for Express application
 */

const Logger = require('../utils/logger');
const { 
  UnifiedError, 
  ValidationError, 
  AuthenticationError, 
  AuthorizationError,
  OperatorDisabledError,
  RateLimitError,
  ErrorFactory
} = require('../utils/errors');

/**
 * Global error handler middleware
 */
const errorHandler = (error, req, res, next) => {
  // If response already sent, delegate to default Express error handler
  if (res.headersSent) {
    return next(error);
  }
  
  // Log the error
  const errorContext = {
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    userId: req.user?.id,
    correlationId: req.correlationId
  };
  
  if (error instanceof UnifiedError) {
    Logger.error(`${error.name}: ${error.message}`, {
      ...errorContext,
      errorCode: error.code,
      originalError: error.originalError?.message
    });
  } else {
    Logger.error(`Unhandled error: ${error.message}`, {
      ...errorContext,
      error: error.message,
      stack: error.stack
    });
  }
  
  // Handle different error types
  if (error instanceof ValidationError) {
    return res.status(400).json({
      error: {
        code: error.code,
        message: error.message,
        field: error.field,
        value: error.value
      }
    });
  }
  
  if (error instanceof AuthenticationError) {
    return res.status(401).json({
      error: {
        code: error.code,
        message: error.message
      }
    });
  }
  
  if (error instanceof AuthorizationError) {
    return res.status(403).json({
      error: {
        code: error.code,
        message: error.message
      }
    });
  }
  
  if (error instanceof OperatorDisabledError) {
    return res.status(503).json({
      error: {
        code: error.code,
        message: error.message,
        operatorCode: error.operatorCode,
        reason: error.reason
      }
    });
  }
  
  if (error instanceof RateLimitError) {
    const headers = {};
    if (error.retryAfter) {
      headers['Retry-After'] = error.retryAfter;
    }
    
    return res.status(429).set(headers).json({
      error: {
        code: error.code,
        message: error.message,
        limit: error.limit,
        window: error.window,
        retryAfter: error.retryAfter
      }
    });
  }
  
  if (error instanceof UnifiedError) {
    const statusCode = getStatusCodeForError(error.code);
    return res.status(statusCode).json(error.toJSON());
  }
  
  // Handle Sequelize validation errors
  if (error.name === 'SequelizeValidationError') {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Data validation failed',
        details: error.errors.map(err => ({
          field: err.path,
          message: err.message,
          value: err.value
        }))
      }
    });
  }
  
  // Handle Sequelize unique constraint errors
  if (error.name === 'SequelizeUniqueConstraintError') {
    return res.status(409).json({
      error: {
        code: 'DUPLICATE_ENTRY',
        message: 'Record already exists',
        field: error.errors[0]?.path
      }
    });
  }
  
  // Handle Sequelize foreign key constraint errors
  if (error.name === 'SequelizeForeignKeyConstraintError') {
    return res.status(400).json({
      error: {
        code: 'INVALID_REFERENCE',
        message: 'Referenced record does not exist',
        field: error.fields
      }
    });
  }
  
  // Handle JSON parsing errors
  if (error instanceof SyntaxError && error.status === 400 && 'body' in error) {
    return res.status(400).json({
      error: {
        code: 'INVALID_JSON',
        message: 'Invalid JSON in request body'
      }
    });
  }
  
  // Default error response
  const statusCode = error.statusCode || error.status || 500;
  const isProduction = process.env.NODE_ENV === 'production';
  
  return res.status(statusCode).json({
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: isProduction ? 'An internal server error occurred' : error.message,
      ...(isProduction ? {} : { stack: error.stack })
    }
  });
};

/**
 * 404 Not Found handler
 */
const notFoundHandler = (req, res) => {
  Logger.warn('Route not found', {
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });
  
  res.status(404).json({
    error: {
      code: 'ROUTE_NOT_FOUND',
      message: `Route ${req.method} ${req.originalUrl} not found`
    }
  });
};

/**
 * Get appropriate HTTP status code for error code
 */
function getStatusCodeForError(errorCode) {
  const statusMap = {
    // 400 Bad Request
    'VALIDATION_ERROR': 400,
    'INVALID_PARAMETERS': 400,
    'INVALID_MSISDN': 400,
    'INVALID_PIN': 400,
    'MISSING_PARAMETERS': 400,
    
    // 401 Unauthorized
    'AUTHENTICATION_FAILED': 401,
    'INVALID_TOKEN': 401,
    'TOKEN_EXPIRED': 401,
    
    // 403 Forbidden
    'AUTHORIZATION_FAILED': 403,
    'INSUFFICIENT_PERMISSIONS': 403,
    
    // 404 Not Found
    'OPERATOR_NOT_FOUND': 404,
    'SUBSCRIPTION_NOT_FOUND': 404,
    'RESOURCE_NOT_FOUND': 404,
    
    // 409 Conflict
    'SUBSCRIPTION_EXISTS': 409,
    'DUPLICATE_ENTRY': 409,
    
    // 422 Unprocessable Entity
    'CUSTOMER_INELIGIBLE': 422,
    'INSUFFICIENT_FUNDS': 422,
    'PIN_EXPIRED': 422,
    
    // 429 Too Many Requests
    'RATE_LIMIT_EXCEEDED': 429,
    
    // 503 Service Unavailable
    'OPERATOR_DISABLED': 503,
    'SERVICE_UNAVAILABLE': 503,
    'MAINTENANCE_MODE': 503,
    
    // 502 Bad Gateway
    'EXTERNAL_SERVICE_ERROR': 502,
    'OPERATOR_ERROR': 502,
    
    // 500 Internal Server Error (default)
    'INTERNAL_SERVER_ERROR': 500
  };
  
  return statusMap[errorCode] || 500;
}

/**
 * Async error wrapper
 */
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Error response formatter
 */
const formatErrorResponse = (error, includeStack = false) => {
  const response = {
    error: {
      code: error.code || 'UNKNOWN_ERROR',
      message: error.message,
      timestamp: new Date().toISOString()
    }
  };
  
  if (error.originalError) {
    response.error.originalError = {
      message: error.originalError.message,
      code: error.originalError.code
    };
  }
  
  if (includeStack && error.stack) {
    response.error.stack = error.stack;
  }
  
  return response;
};

/**
 * Create standardized error response
 */
const createErrorResponse = (code, message, statusCode = null) => {
  const error = new UnifiedError(code, message);
  const httpStatusCode = statusCode || getStatusCodeForError(code);
  
  return {
    statusCode: httpStatusCode,
    body: formatErrorResponse(error)
  };
};

module.exports = {
  errorHandler,
  notFoundHandler,
  asyncHandler,
  formatErrorResponse,
  createErrorResponse,
  getStatusCodeForError
};