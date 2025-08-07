/**
 * Error Translator
 * 
 * Translates operator-specific errors to unified error codes and messages
 */

const Logger = require('../../utils/logger');
const { UnifiedError } = require('../../utils/errors');

class ErrorTranslator {
  constructor() {
    this.errorMappings = this.initializeErrorMappings();
  }
  
  /**
   * Initialize operator-specific error mappings
   */
  initializeErrorMappings() {
    return {
      'zain-kw': {
        '2001': { code: 'INVALID_MSISDN', message: 'Invalid Kuwait mobile number format' },
        '2015': { code: 'INSUFFICIENT_FUNDS', message: 'Insufficient balance to complete transaction' },
        '4001': { code: 'INVALID_PIN', message: 'Invalid PIN code' },
        '4002': { code: 'PIN_EXPIRED', message: 'PIN has expired, please request a new one' },
        '4003': { code: 'PIN_ATTEMPTS_EXCEEDED', message: 'Maximum PIN attempts exceeded' },
        '1003': { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests, please try again later' },
        'SUB_EXISTS': { code: 'SUBSCRIPTION_EXISTS', message: 'Customer already has an active subscription' },
        'SUB_NOT_FOUND': { code: 'SUBSCRIPTION_NOT_FOUND', message: 'Subscription not found' },
        'INELIGIBLE': { code: 'CUSTOMER_INELIGIBLE', message: 'Customer is not eligible for this service' },
        'AUTH_FAILED': { code: 'AUTHENTICATION_FAILED', message: 'Authentication failed' },
        'CHECKOUT_REQUIRED': { code: 'CHECKOUT_REQUIRED', message: 'Customer must complete checkout process' }
      },
      
      'zain-ksa': {
        '2001': { code: 'INVALID_MSISDN', message: 'Invalid Saudi mobile number format' },
        '2015': { code: 'INSUFFICIENT_FUNDS', message: 'Insufficient balance' },
        '4001': { code: 'INVALID_PIN', message: 'Invalid PIN code' },
        'SUB_EXISTS': { code: 'SUBSCRIPTION_EXISTS', message: 'Subscription already exists' },
        'AUTH_FAIL': { code: 'AUTHENTICATION_FAILED', message: 'Authentication failed' },
        'BLACKLISTED': { code: 'CUSTOMER_BLACKLISTED', message: 'Customer is blacklisted' }
      },
      
      'mobily': {
        'INVALID_NUMBER': { code: 'INVALID_MSISDN', message: 'Invalid mobile number' },
        'INSUFFICIENT_BALANCE': { code: 'INSUFFICIENT_FUNDS', message: 'Insufficient account balance' },
        'PIN_INVALID': { code: 'INVALID_PIN', message: 'Invalid PIN provided' },
        'PIN_EXPIRED': { code: 'PIN_EXPIRED', message: 'PIN has expired' },
        'DUPLICATE_SUB': { code: 'SUBSCRIPTION_EXISTS', message: 'Duplicate subscription' },
        'AUTH_ERROR': { code: 'AUTHENTICATION_FAILED', message: 'Authentication error' },
        'SERVICE_UNAVAILABLE': { code: 'SERVICE_UNAVAILABLE', message: 'Service temporarily unavailable' }
      },
      
      'etisalat-ae': {
        'E001': { code: 'INVALID_MSISDN', message: 'Invalid UAE mobile number' },
        'E002': { code: 'INSUFFICIENT_FUNDS', message: 'Insufficient credit' },
        'E003': { code: 'INVALID_PIN', message: 'Invalid PIN' },
        'E004': { code: 'SUBSCRIPTION_EXISTS', message: 'Active subscription exists' },
        'E005': { code: 'CUSTOMER_INELIGIBLE', message: 'Customer not eligible' },
        'AUTH_FAIL': { code: 'AUTHENTICATION_FAILED', message: 'Authentication failed' }
      },
      
      'ooredoo-kw': {
        '2001': { code: 'INVALID_MSISDN', message: 'Invalid Kuwait mobile number' },
        '2015': { code: 'INSUFFICIENT_FUNDS', message: 'Insufficient balance' },
        '4001': { code: 'INVALID_PIN', message: 'Invalid PIN' },
        'SUB_EXISTS': { code: 'SUBSCRIPTION_EXISTS', message: 'Subscription exists' },
        'INELIGIBLE': { code: 'CUSTOMER_INELIGIBLE', message: 'Customer ineligible' }
      }
    };
  }
  
  /**
   * Translate operator-specific error to unified format
   */
  translate(operatorCode, error) {
    try {
      const mapping = this.errorMappings[operatorCode];
      
      if (!mapping) {
        Logger.warn(`No error mapping found for operator: ${operatorCode}`);
        return this.createGenericError(error, operatorCode);
      }
      
      // Extract error code from various error formats
      const errorCode = this.extractErrorCode(error);
      const errorMapping = mapping[errorCode];
      
      if (errorMapping) {
        const translatedError = new UnifiedError(
          errorMapping.code,
          errorMapping.message,
          error
        );
        
        // Add original error information
        translatedError.originalError = {
          code: errorCode,
          message: error.message,
          operatorCode
        };
        
        Logger.debug(`Error translated for ${operatorCode}`, {
          operatorCode,
          originalCode: errorCode,
          unifiedCode: errorMapping.code
        });
        
        return translatedError;
      }
      
      // If no specific mapping found, create generic error
      return this.createGenericError(error, operatorCode, errorCode);
      
    } catch (translationError) {
      Logger.error(`Failed to translate error for ${operatorCode}`, {
        operatorCode,
        originalError: error.message,
        translationError: translationError.message
      });
      
      return this.createGenericError(error, operatorCode);
    }
  }
  
  /**
   * Extract error code from different error formats
   */
  extractErrorCode(error) {
    // Try different properties that might contain the error code
    return error.code || 
           error.errorCode || 
           error.category || 
           error.type || 
           error.status || 
           'UNKNOWN_ERROR';
  }
  
  /**
   * Create generic unified error when no mapping exists
   */
  createGenericError(originalError, operatorCode, errorCode = null) {
    const unifiedError = new UnifiedError(
      'UNMAPPED_ERROR',
      originalError.message || 'Unknown error from operator',
      originalError
    );
    
    unifiedError.originalError = {
      code: errorCode || 'UNKNOWN',
      message: originalError.message,
      operatorCode
    };
    
    Logger.warn(`Generic error created for unmapped error`, {
      operatorCode,
      originalCode: errorCode,
      originalMessage: originalError.message
    });
    
    return unifiedError;
  }
  
  /**
   * Add error mapping for specific operator
   */
  addErrorMapping(operatorCode, errorCode, mapping) {
    if (!this.errorMappings[operatorCode]) {
      this.errorMappings[operatorCode] = {};
    }
    
    this.errorMappings[operatorCode][errorCode] = mapping;
    
    Logger.info(`Added error mapping for ${operatorCode}`, {
      operatorCode,
      errorCode,
      unifiedCode: mapping.code
    });
  }
  
  /**
   * Get all error mappings for debugging
   */
  getAllMappings() {
    return this.errorMappings;
  }
  
  /**
   * Get error statistics
   */
  getErrorStats(errors) {
    const stats = {
      total: errors.length,
      byUnifiedCode: {},
      byOperator: {},
      mappedCount: 0,
      unmappedCount: 0
    };
    
    errors.forEach(error => {
      // Count by unified code
      const unifiedCode = error.code || 'UNKNOWN';
      stats.byUnifiedCode[unifiedCode] = (stats.byUnifiedCode[unifiedCode] || 0) + 1;
      
      // Count by operator
      const operatorCode = error.originalError?.operatorCode || 'unknown';
      stats.byOperator[operatorCode] = (stats.byOperator[operatorCode] || 0) + 1;
      
      // Count mapped vs unmapped
      if (error.code === 'UNMAPPED_ERROR') {
        stats.unmappedCount++;
      } else {
        stats.mappedCount++;
      }
    });
    
    return stats;
  }
  
  /**
   * Validate error mappings for completeness
   */
  validateMappings() {
    const validationResults = {
      valid: true,
      issues: [],
      coverage: {}
    };
    
    Object.entries(this.errorMappings).forEach(([operatorCode, mappings]) => {
      const operatorIssues = [];
      
      // Check for required unified error codes
      const requiredCodes = [
        'INVALID_MSISDN',
        'INSUFFICIENT_FUNDS', 
        'INVALID_PIN',
        'SUBSCRIPTION_EXISTS',
        'AUTHENTICATION_FAILED'
      ];
      
      const mappedUnifiedCodes = Object.values(mappings).map(m => m.code);
      
      requiredCodes.forEach(requiredCode => {
        if (!mappedUnifiedCodes.includes(requiredCode)) {
          operatorIssues.push(`Missing mapping for required code: ${requiredCode}`);
        }
      });
      
      validationResults.coverage[operatorCode] = {
        totalMappings: Object.keys(mappings).length,
        requiredCoverage: requiredCodes.filter(code => mappedUnifiedCodes.includes(code)).length,
        requiredTotal: requiredCodes.length,
        issues: operatorIssues
      };
      
      if (operatorIssues.length > 0) {
        validationResults.valid = false;
        validationResults.issues.push(...operatorIssues.map(issue => `${operatorCode}: ${issue}`));
      }
    });
    
    return validationResults;
  }
}

module.exports = ErrorTranslator;