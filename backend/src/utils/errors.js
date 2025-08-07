/**
 * Unified Error Classes
 * 
 * Standard error types used throughout the platform for consistent error handling
 */

/**
 * Base unified error class
 */
class UnifiedError extends Error {
  constructor(code, message, originalError = null) {
    super(message);
    this.name = 'UnifiedError';
    this.code = code;
    this.originalError = originalError;
    this.timestamp = new Date().toISOString();
    
    // Capture stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, UnifiedError);
    }
  }
  
  /**
   * Convert to JSON for API responses
   */
  toJSON() {
    return {
      error: {
        code: this.code,
        message: this.message,
        timestamp: this.timestamp,
        originalError: this.originalError ? {
          message: this.originalError.message,
          code: this.originalError.code
        } : null
      }
    };
  }
}

/**
 * Operator-specific errors
 */
class OperatorError extends UnifiedError {
  constructor(operatorCode, code, message, originalError = null) {
    super(code, message, originalError);
    this.name = 'OperatorError';
    this.operatorCode = operatorCode;
  }
}

/**
 * Validation errors
 */
class ValidationError extends UnifiedError {
  constructor(message, field = null, value = null) {
    super('VALIDATION_ERROR', message);
    this.name = 'ValidationError';
    this.field = field;
    this.value = value;
  }
}

/**
 * Authentication errors
 */
class AuthenticationError extends UnifiedError {
  constructor(message = 'Authentication failed') {
    super('AUTHENTICATION_FAILED', message);
    this.name = 'AuthenticationError';
  }
}

/**
 * Authorization errors
 */
class AuthorizationError extends UnifiedError {
  constructor(message = 'Insufficient permissions') {
    super('AUTHORIZATION_FAILED', message);
    this.name = 'AuthorizationError';
  }
}

/**
 * Operator disabled error
 */
class OperatorDisabledError extends UnifiedError {
  constructor(operatorCode, reason = null) {
    const message = `Operator ${operatorCode} is currently disabled${reason ? ': ' + reason : ''}`;
    super('OPERATOR_DISABLED', message);
    this.name = 'OperatorDisabledError';
    this.operatorCode = operatorCode;
    this.reason = reason;
  }
}

/**
 * Operator not found error
 */
class OperatorNotFoundError extends UnifiedError {
  constructor(operatorCode) {
    super('OPERATOR_NOT_FOUND', `Operator ${operatorCode} not found`);
    this.name = 'OperatorNotFoundError';
    this.operatorCode = operatorCode;
  }
}

/**
 * Rate limit exceeded error
 */
class RateLimitError extends UnifiedError {
  constructor(limit, window, retryAfter = null) {
    super('RATE_LIMIT_EXCEEDED', `Rate limit exceeded: ${limit} requests per ${window}s`);
    this.name = 'RateLimitError';
    this.limit = limit;
    this.window = window;
    this.retryAfter = retryAfter;
  }
}

/**
 * Configuration error
 */
class ConfigurationError extends UnifiedError {
  constructor(message, component = null) {
    super('CONFIGURATION_ERROR', message);
    this.name = 'ConfigurationError';
    this.component = component;
  }
}

/**
 * Database error
 */
class DatabaseError extends UnifiedError {
  constructor(message, operation = null, table = null) {
    super('DATABASE_ERROR', message);
    this.name = 'DatabaseError';
    this.operation = operation;
    this.table = table;
  }
}

/**
 * External service error
 */
class ExternalServiceError extends UnifiedError {
  constructor(service, message, statusCode = null) {
    super('EXTERNAL_SERVICE_ERROR', `${service}: ${message}`);
    this.name = 'ExternalServiceError';
    this.service = service;
    this.statusCode = statusCode;
  }
}

/**
 * Error factory for creating appropriate error types
 */
class ErrorFactory {
  static create(type, ...args) {
    const errorTypes = {
      'UNIFIED': UnifiedError,
      'OPERATOR': OperatorError,
      'VALIDATION': ValidationError,
      'AUTHENTICATION': AuthenticationError,
      'AUTHORIZATION': AuthorizationError,
      'OPERATOR_DISABLED': OperatorDisabledError,
      'OPERATOR_NOT_FOUND': OperatorNotFoundError,
      'RATE_LIMIT': RateLimitError,
      'CONFIGURATION': ConfigurationError,
      'DATABASE': DatabaseError,
      'EXTERNAL_SERVICE': ExternalServiceError
    };
    
    const ErrorClass = errorTypes[type] || UnifiedError;
    return new ErrorClass(...args);
  }
  
  /**
   * Create error from HTTP response
   */
  static fromHttpResponse(response, service = 'Unknown') {
    const statusCode = response.status || response.statusCode;
    const message = response.data?.message || response.message || 'HTTP request failed';
    
    if (statusCode === 401) {
      return new AuthenticationError(message);
    } else if (statusCode === 403) {
      return new AuthorizationError(message);
    } else if (statusCode === 429) {
      const retryAfter = response.headers?.['retry-after'];
      return new RateLimitError(0, 0, retryAfter);
    } else {
      return new ExternalServiceError(service, message, statusCode);
    }
  }
  
  /**
   * Check if error is retryable
   */
  static isRetryable(error) {
    const retryableCodes = [
      'RATE_LIMIT_EXCEEDED',
      'SERVICE_UNAVAILABLE',
      'TIMEOUT',
      'CONNECTION_ERROR',
      'EXTERNAL_SERVICE_ERROR'
    ];
    
    return retryableCodes.includes(error.code) || 
           (error.statusCode >= 500 && error.statusCode < 600);
  }
  
  /**
   * Get error severity level
   */
  static getSeverity(error) {
    const criticalCodes = [
      'DATABASE_ERROR',
      'CONFIGURATION_ERROR',
      'AUTHENTICATION_FAILED'
    ];
    
    const warningCodes = [
      'RATE_LIMIT_EXCEEDED',
      'VALIDATION_ERROR',
      'OPERATOR_DISABLED'
    ];
    
    if (criticalCodes.includes(error.code)) {
      return 'critical';
    } else if (warningCodes.includes(error.code)) {
      return 'warning';
    } else {
      return 'error';
    }
  }
}

module.exports = {
  UnifiedError,
  OperatorError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  OperatorDisabledError,
  OperatorNotFoundError,
  RateLimitError,
  ConfigurationError,
  DatabaseError,
  ExternalServiceError,
  ErrorFactory
};