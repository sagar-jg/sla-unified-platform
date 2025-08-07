/**
 * SLA Digital v2.2 Error Mapper - COMPLIANT IMPLEMENTATION
 * 
 * Maps unified platform errors to exact SLA Digital v2.2 error format.
 * Implements complete error code mapping per SLA Digital specification.
 * 
 * PHASE 4: Response Format & Error Mapping
 */

const Logger = require('../../utils/logger');

class SLAErrorMapper {
  
  /**
   * Map unified error to SLA Digital v2.2 error format
   * SLA Digital uses specific error categories and codes
   */
  static mapError(error, operatorCode = null, context = {}) {
    try {
      // Get base error mapping
      const errorMapping = SLAErrorMapper.getErrorMapping(error.code || error.message, operatorCode);
      
      // Enhanced error with context
      const mappedError = {
        category: errorMapping.category,
        code: errorMapping.code,
        message: SLAErrorMapper.enhanceErrorMessage(errorMapping.message, error, context)
      };
      
      // Log error mapping for debugging
      Logger.debug('SLA v2.2 error mapped', {
        originalError: error.code || error.message,
        mappedCategory: mappedError.category,
        mappedCode: mappedError.code,
        operatorCode,
        endpoint: context.endpoint
      });
      
      return mappedError;
      
    } catch (mappingError) {
      Logger.error('Error mapping failed', {
        originalError: error,
        mappingError: mappingError.message,
        operatorCode
      });
      
      // Fallback error
      return {
        category: 'Server',
        code: '5001',
        message: 'An unexpected error occurred'
      };
    }
  }
  
  /**
   * Get error mapping based on error code/message
   * Complete SLA Digital v2.2 error code specification
   */
  static getErrorMapping(errorCodeOrMessage, operatorCode) {
    const errorMappings = {
      
      // ===== AUTHORIZATION ERRORS (1001-1003) =====
      'MISSING_AUTH_HEADER': { category: 'Authorization', code: '1001', message: 'Missing Authorization header. HTTP Basic Auth required.' },
      'INVALID_AUTH_FORMAT': { category: 'Authorization', code: '1001', message: 'Invalid Authorization header format. Must be Base64 encoded.' },
      'INVALID_CREDENTIALS': { category: 'Authorization', code: '1002', message: 'Invalid credentials' },
      'AUTHENTICATION_FAILED': { category: 'Authorization', code: '1002', message: 'Authentication failed' },
      'RATE_LIMIT_EXCEEDED': { category: 'Authorization', code: '1003', message: 'Rate limit exceeded' },
      'IP_NOT_WHITELISTED': { category: 'Authorization', code: '1003', message: 'IP address not whitelisted for this account' },
      
      // ===== REQUEST ERRORS (2001-2052) =====
      'MISSING_PARAMETER': { category: 'Request', code: '2001', message: 'Missing required parameter' },
      'INVALID_PARAMETER': { category: 'Request', code: '2001', message: 'Invalid parameter format' },
      'INVALID_MSISDN': { category: 'Request', code: '2001', message: 'Invalid MSISDN format' },
      'INVALID_AMOUNT': { category: 'Request', code: '2001', message: 'Invalid amount: must be a positive number' },
      'INVALID_CURRENCY': { category: 'Request', code: '2001', message: 'Invalid currency: must be 3-letter ISO 4217 code' },
      'PARAMETER_IN_BODY': { category: 'Request', code: '2001', message: 'Parameters must be passed in URL query string, not request body' },
      
      // Specific parameter errors
      'DAILY_LIMIT_EXCEEDED': { category: 'Service', code: '2014', message: 'Daily spending limit exceeded' },
      'INSUFFICIENT_FUNDS': { category: 'Service', code: '2015', message: 'Insufficient balance to complete transaction' },
      'SUBSCRIPTION_SUSPENDED': { category: 'Service', code: '2016', message: 'Subscription is suspended' },
      'SUBSCRIPTION_CANCELLED': { category: 'Service', code: '2017', message: 'Subscription has been cancelled' },
      'MONTHLY_LIMIT_EXCEEDED': { category: 'Service', code: '2018', message: 'Monthly spending limit exceeded' },
      
      // Subscription specific errors
      'WEEKLY_SUBSCRIPTION_LIMIT': { category: 'Service', code: '2032', message: 'Weekly subscription limit exceeded' },
      'SUBSCRIPTION_EXISTS': { category: 'Service', code: '2032', message: 'Customer already has an active subscription' },
      'MAX_SUBSCRIPTIONS_REACHED': { category: 'Service', code: '2033', message: 'Maximum number of subscriptions reached' },
      
      // Not found errors
      'SUBSCRIPTION_NOT_FOUND': { category: 'Request', code: '2052', message: 'Subscription not found' },
      'TRANSACTION_NOT_FOUND': { category: 'Request', code: '2052', message: 'Transaction not found' },
      
      // ===== PIN API ERRORS (3001-3004) =====
      'INVALID_ACR': { category: 'Request', code: '3001', message: 'Invalid ACR format: must be 48 alphanumeric characters' },
      'MISSING_CORRELATOR': { category: 'Request', code: '3002', message: 'Correlator field is mandatory for Telenor ACR transactions' },
      'PIN_GENERATION_FAILED': { category: 'Service', code: '3003', message: 'PIN generation failed' },
      'SMS_DELIVERY_FAILED': { category: 'Service', code: '3004', message: 'SMS delivery failed' },
      
      // ===== PIN ERRORS (4001-4006) =====
      'INVALID_PIN': { category: 'Request', code: '4001', message: 'Invalid PIN code' },
      'INVALID_PIN_FORMAT': { category: 'Request', code: '4001', message: 'Invalid PIN format: must be 4-6 digits' },
      'PIN_EXPIRED': { category: 'Request', code: '4002', message: 'PIN has expired' },
      'PIN_ATTEMPTS_EXCEEDED': { category: 'Request', code: '4003', message: 'Maximum PIN attempts exceeded' },
      'FRAUD_TOKEN_INVALID': { category: 'Security', code: '4003', message: 'Invalid fraud token' },
      
      // ===== SERVICE ERRORS (5001-5005) =====
      'UNKNOWN_ERROR': { category: 'Server', code: '5001', message: 'Internal server error' },
      'OPERATOR_DISABLED': { category: 'Service', code: '5002', message: 'Operator is currently unavailable' },
      'OPERATOR_NOT_FOUND': { category: 'Service', code: '5002', message: 'Operator not supported' },
      'FEATURE_NOT_SUPPORTED': { category: 'Service', code: '5002', message: 'Feature not supported by this operator' },
      'CHARGING_NOT_AVAILABLE': { category: 'Service', code: '5002', message: 'Direct charging not available - use checkout flow' },
      'PIN_NOT_SUPPORTED': { category: 'Service', code: '5002', message: 'PIN generation not supported - use checkout flow' },
      'REFUND_NOT_SUPPORTED': { category: 'Service', code: '5002', message: 'Refunds not supported by this operator' },
      
      'SMS_SENDING_FAILED': { category: 'Service', code: '5003', message: 'SMS sending failed' },
      'REFUND_PROCESSING_FAILED': { category: 'Service', code: '5004', message: 'Refund processing failed' },
      'SANDBOX_ERROR': { category: 'Service', code: '5005', message: 'Sandbox operation failed' },
      
      // ===== OPERATOR-SPECIFIC ERRORS =====
      
      // Zain Kuwait specific
      'ZAIN_KW_SDP_ERROR': { category: 'Service', code: '2032', message: 'SDP integration error - please try again' },
      'ZAIN_KW_CIVIL_ID_REQUIRED': { category: 'Request', code: '2001', message: 'Civil ID required for Zain Kuwait' },
      
      // Telenor specific
      'TELENOR_ACR_INVALID': { category: 'Request', code: '3001', message: 'Invalid ACR format for Telenor network' },
      'TELENOR_CORRELATOR_MISSING': { category: 'Request', code: '3002', message: 'Correlator mandatory for Telenor ACR transactions' },
      
      // Etisalat UAE specific
      'ETISALAT_FRAUD_TOKEN_REQUIRED': { category: 'Security', code: '4003', message: 'Fraud token required for PIN generation' },
      
      // UK operators specific
      'UK_FONIX_ERROR': { category: 'Service', code: '5002', message: 'Fonix checkout integration error' },
      'UK_UNIFIED_FLOW_ERROR': { category: 'Service', code: '5002', message: 'UK unified flow error' },
      
      // Eligibility specific
      'CUSTOMER_INELIGIBLE': { category: 'Service', code: '2015', message: 'Customer is not eligible for this service' },
      'BARRED_CUSTOMER': { category: 'Service', code: '2015', message: 'Customer is barred from services' },
      'PREPAID_INSUFFICIENT': { category: 'Service', code: '2015', message: 'Insufficient prepaid balance' },
      
      // Network specific
      'NETWORK_TIMEOUT': { category: 'Service', code: '5001', message: 'Network timeout - please try again' },
      'NETWORK_ERROR': { category: 'Service', code: '5001', message: 'Network communication error' },
      'DOWNSTREAM_ERROR': { category: 'Service', code: '5001', message: 'Downstream system error' }
    };
    
    // Try exact match first
    let mapping = errorMappings[errorCodeOrMessage];
    
    if (!mapping) {
      // Try partial matches for common error patterns
      const errorStr = errorCodeOrMessage?.toLowerCase() || '';
      
      if (errorStr.includes('auth') || errorStr.includes('credential')) {
        mapping = errorMappings['AUTHENTICATION_FAILED'];
      } else if (errorStr.includes('pin') && errorStr.includes('invalid')) {
        mapping = errorMappings['INVALID_PIN'];
      } else if (errorStr.includes('pin') && errorStr.includes('expired')) {
        mapping = errorMappings['PIN_EXPIRED'];
      } else if (errorStr.includes('msisdn') || errorStr.includes('phone')) {
        mapping = errorMappings['INVALID_MSISDN'];
      } else if (errorStr.includes('amount')) {
        mapping = errorMappings['INVALID_AMOUNT'];
      } else if (errorStr.includes('limit')) {
        mapping = errorMappings['DAILY_LIMIT_EXCEEDED'];
      } else if (errorStr.includes('subscription') && errorStr.includes('not found')) {
        mapping = errorMappings['SUBSCRIPTION_NOT_FOUND'];
      } else if (errorStr.includes('subscription') && errorStr.includes('exist')) {
        mapping = errorMappings['SUBSCRIPTION_EXISTS'];
      } else if (errorStr.includes('operator') && errorStr.includes('disabled')) {
        mapping = errorMappings['OPERATOR_DISABLED'];
      } else if (errorStr.includes('timeout')) {
        mapping = errorMappings['NETWORK_TIMEOUT'];
      } else if (errorStr.includes('network')) {
        mapping = errorMappings['NETWORK_ERROR'];
      }
    }
    
    // Default fallback
    return mapping || errorMappings['UNKNOWN_ERROR'];
  }
  
  /**
   * Enhance error message with context
   */
  static enhanceErrorMessage(baseMessage, originalError, context) {
    try {
      let enhancedMessage = baseMessage;
      
      // Add operator context if available
      if (context.operatorCode) {
        const operatorNames = {
          'zain-kw': 'Zain Kuwait',
          'zain-sa': 'Zain Saudi Arabia',
          'etisalat-ae': 'Etisalat UAE',
          'mobily-sa': 'Mobily Saudi Arabia',
          'telenor-mm': 'Telenor Myanmar',
          'telenor-dk': 'Telenor Denmark',
          // ... add more as needed
        };
        
        const operatorName = operatorNames[context.operatorCode];
        if (operatorName && baseMessage.includes('operator')) {
          enhancedMessage = enhancedMessage.replace('this operator', operatorName);
        }
      }
      
      // Add parameter context for validation errors
      if (context.parameter && baseMessage.includes('parameter')) {
        enhancedMessage = enhancedMessage.replace('parameter', `parameter: ${context.parameter}`);
      }
      
      // Add PIN length context
      if (context.operatorCode && baseMessage.includes('PIN')) {
        const pinLengths = {
          'zain-kw': '5-digit',
          'mobily-sa': '4-digit',
          'telenor-digi': '6-digit'
        };
        
        const pinLength = pinLengths[context.operatorCode];
        if (pinLength) {
          enhancedMessage = enhancedMessage.replace('4-6 digits', pinLength);
        }
      }
      
      // Add amount context for limit errors
      if (context.amount && baseMessage.includes('limit')) {
        enhancedMessage += ` (attempted: ${context.amount})`;
      }
      
      // Add currency context
      if (context.currency && baseMessage.includes('currency')) {
        enhancedMessage += ` Expected format: ${context.currency}`;
      }
      
      return enhancedMessage;
      
    } catch (enhancementError) {
      Logger.warn('Error message enhancement failed', {
        baseMessage,
        error: enhancementError.message
      });
      return baseMessage;
    }
  }
  
  /**
   * Create operator-specific error
   */
  static createOperatorError(operatorCode, errorType, customMessage = null) {
    const operatorErrors = {
      'zain-kw': {
        'pin_length': {
          category: 'Request',
          code: '4001',
          message: customMessage || 'Zain Kuwait requires 5-digit PIN per SLA Digital documentation'
        },
        'sdp_error': {
          category: 'Service',
          code: '2032',
          message: customMessage || 'SDP integration error - please try again'
        }
      },
      
      'telenor-mm': {
        'acr_required': {
          category: 'Request',
          code: '3001',
          message: customMessage || 'ACR (48-character identifier) required for Telenor Myanmar'
        },
        'correlator_required': {
          category: 'Request',
          code: '3002',
          message: customMessage || 'Correlator field mandatory for Telenor ACR transactions'
        }
      },
      
      'etisalat-ae': {
        'fraud_token': {
          category: 'Security',
          code: '4003',
          message: customMessage || 'Fraud token required for Etisalat UAE PIN generation'
        }
      }
    };
    
    const operatorErrorMap = operatorErrors[operatorCode];
    if (operatorErrorMap && operatorErrorMap[errorType]) {
      return operatorErrorMap[errorType];
    }
    
    // Fallback
    return {
      category: 'Service',
      code: '5002',
      message: customMessage || `Operator ${operatorCode} specific error`
    };
  }
  
  /**
   * Validate error response format
   */
  static validateErrorFormat(errorResponse) {
    const requiredFields = ['category', 'code', 'message'];
    const validCategories = ['Authorization', 'Request', 'Service', 'Server', 'Security'];
    
    // Check required fields
    for (const field of requiredFields) {
      if (!errorResponse[field]) {
        return { valid: false, reason: `Missing required field: ${field}` };
      }
    }
    
    // Check category is valid
    if (!validCategories.includes(errorResponse.category)) {
      return { valid: false, reason: `Invalid category: ${errorResponse.category}` };
    }
    
    // Check code format (should be 4 digits)
    if (!/^\d{4}$/.test(errorResponse.code)) {
      return { valid: false, reason: `Invalid code format: ${errorResponse.code}` };
    }
    
    return { valid: true };
  }
  
  /**
   * Get all supported error codes for documentation
   */
  static getSupportedErrorCodes() {
    return {
      categories: {
        'Authorization': {
          description: 'Authentication and authorization errors',
          codes: {
            '1001': 'Missing or invalid Authorization header',
            '1002': 'Invalid credentials',
            '1003': 'Rate limit exceeded or IP not whitelisted'
          }
        },
        'Request': {
          description: 'Request validation errors',
          codes: {
            '2001': 'Missing or invalid parameters',
            '2014': 'Daily spending limit exceeded',
            '2015': 'Insufficient funds or customer ineligible',
            '2016': 'Subscription suspended',
            '2017': 'Subscription cancelled',
            '2018': 'Monthly spending limit exceeded',
            '2032': 'Subscription limit reached',
            '2052': 'Resource not found',
            '3001': 'Invalid ACR format',
            '3002': 'Missing correlator for ACR',
            '4001': 'Invalid PIN format',
            '4002': 'PIN expired',
            '4003': 'PIN attempts exceeded or fraud token invalid'
          }
        },
        'Service': {
          description: 'Service and operator errors',
          codes: {
            '5002': 'Operator unavailable or feature not supported',
            '5003': 'SMS sending failed',
            '5004': 'Refund processing failed',
            '5005': 'Sandbox operation failed'
          }
        },
        'Server': {
          description: 'Internal server errors',
          codes: {
            '5001': 'Internal server error'
          }
        },
        'Security': {
          description: 'Security-related errors',
          codes: {
            '4003': 'Fraud token validation failed'
          }
        }
      }
    };
  }
}

module.exports = SLAErrorMapper;