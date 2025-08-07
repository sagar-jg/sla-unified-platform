/**
 * Base Adapter Class
 * 
 * Abstract base class that all operator adapters must extend.
 * Provides common functionality and enforces the adapter interface.
 */

const SLADigitalClient = require('../../services/external/SLADigitalClient');
const Logger = require('../../utils/logger');
const { UnifiedError } = require('../../utils/errors');

class BaseAdapter {
  constructor(config) {
    if (new.target === BaseAdapter) {
      throw new TypeError('Cannot construct BaseAdapter instances directly');
    }
    
    this.config = config;
    this.operatorCode = config.operatorCode;
    this.client = new SLADigitalClient(config.credentials, config.environment);
    
    Logger.debug(`${this.operatorCode} adapter initialized`, {
      operatorCode: this.operatorCode,
      environment: config.environment
    });
  }
  
  /**
   * Abstract methods - must be implemented by each operator adapter
   */
  async createSubscription(params) {
    throw new Error(`createSubscription not implemented for ${this.operatorCode}`);
  }
  
  async cancelSubscription(uuid) {
    throw new Error(`cancelSubscription not implemented for ${this.operatorCode}`);
  }
  
  async getSubscriptionStatus(uuid) {
    throw new Error(`getSubscriptionStatus not implemented for ${this.operatorCode}`);
  }
  
  async generatePIN(msisdn, campaign) {
    throw new Error(`generatePIN not implemented for ${this.operatorCode}`);
  }
  
  async charge(uuid, amount) {
    throw new Error(`charge not implemented for ${this.operatorCode}`);
  }
  
  async refund(transactionId, amount) {
    throw new Error(`refund not implemented for ${this.operatorCode}`);
  }
  
  async checkEligibility(msisdn) {
    throw new Error(`checkEligibility not implemented for ${this.operatorCode}`);
  }
  
  /**
   * Common utility methods available to all adapters
   */
  
  /**
   * Validate MSISDN format for this operator
   */
  validateMSISDN(msisdn) {
    const regex = this.config.msisdnRegex || /^\+?[1-9]\d{1,14}$/;
    return regex.test(msisdn);
  }
  
  /**
   * Normalize phone number to operator format
   */
  normalizeMSISDN(msisdn) {
    // Remove any non-digit characters except +
    let normalized = msisdn.replace(/[^\d+]/g, '');
    
    // Apply operator-specific normalization rules
    if (this.config.msisdnNormalization) {
      const rules = this.config.msisdnNormalization;
      
      // Remove country code if specified
      if (rules.removeCountryCode && rules.countryCode) {
        const countryCode = rules.countryCode.replace('+', '');
        if (normalized.startsWith('+' + countryCode)) {
          normalized = normalized.substring(countryCode.length + 1);
        } else if (normalized.startsWith(countryCode)) {
          normalized = normalized.substring(countryCode.length);
        }
      }
      
      // Add prefix if specified
      if (rules.addPrefix && !normalized.startsWith(rules.addPrefix)) {
        normalized = rules.addPrefix + normalized;
      }
    }
    
    return normalized;
  }
  
  /**
   * Normalize API response to unified format
   */
  normalizeResponse(response) {
    try {
      const normalized = {
        success: response.success || false,
        data: this.mapResponseData(response),
        error: response.error ? this.mapError(response.error) : null,
        operatorResponse: this.config.includeRawResponse ? response : undefined,
        metadata: {
          operatorCode: this.operatorCode,
          timestamp: new Date().toISOString(),
          environment: this.config.environment,
          processingTime: response._processingTime || null
        }
      };
      
      Logger.debug(`Response normalized for ${this.operatorCode}`, {
        operatorCode: this.operatorCode,
        success: normalized.success,
        hasError: !!normalized.error
      });
      
      return normalized;
    } catch (error) {
      Logger.error(`Failed to normalize response for ${this.operatorCode}`, {
        operatorCode: this.operatorCode,
        error: error.message,
        stack: error.stack,
        originalResponse: response
      });
      
      throw new UnifiedError('RESPONSE_NORMALIZATION_ERROR', 
        `Failed to normalize response from ${this.operatorCode}`, error);
    }
  }
  
  /**
   * Map operator-specific response data to unified format
   * Must be implemented by each adapter
   */
  mapResponseData(response) {
    throw new Error(`mapResponseData not implemented for ${this.operatorCode}`);
  }
  
  /**
   * Map operator-specific errors to unified format
   * Must be implemented by each adapter
   */
  mapError(error) {
    throw new Error(`mapError not implemented for ${this.operatorCode}`);
  }
  
  /**
   * Map operator-specific status to unified status
   * Must be implemented by each adapter
   */
  mapStatus(operatorStatus) {
    throw new Error(`mapStatus not implemented for ${this.operatorCode}`);
  }
  
  /**
   * Execute API call with error handling and logging
   */
  async executeWithLogging(operation, params, apiCall) {
    const startTime = Date.now();
    
    try {
      Logger.info(`${this.operatorCode}: Starting ${operation}`, {
        operatorCode: this.operatorCode,
        operation,
        params: this.sanitizeParams(params)
      });
      
      const response = await apiCall();
      const duration = Date.now() - startTime;
      
      Logger.operatorAction(this.operatorCode, operation, 
        { success: true }, { duration, params: this.sanitizeParams(params) });
      
      return this.normalizeResponse(response);
      
    } catch (error) {
      const duration = Date.now() - startTime;
      
      Logger.operatorAction(this.operatorCode, operation, 
        { success: false, error: error.message }, 
        { duration, params: this.sanitizeParams(params) });
      
      // Convert to unified error
      if (!(error instanceof UnifiedError)) {
        const mappedError = this.mapError(error);
        throw new UnifiedError(
          mappedError.code || 'OPERATOR_ERROR',
          mappedError.message || error.message,
          error
        );
      }
      
      throw error;
    }
  }
  
  /**
   * Sanitize parameters for logging (remove sensitive data)
   */
  sanitizeParams(params) {
    if (!params || typeof params !== 'object') {
      return params;
    }
    
    const sensitiveFields = ['pin', 'password', 'token', 'secret', 'key'];
    const sanitized = { ...params };
    
    sensitiveFields.forEach(field => {
      if (sanitized[field]) {
        sanitized[field] = '***';
      }
    });
    
    return sanitized;
  }
  
  /**
   * Get configuration value with default
   */
  getConfig(key, defaultValue = null) {
    return this.config[key] !== undefined ? this.config[key] : defaultValue;
  }
  
  /**
   * Check if operator supports a specific feature
   */
  supportsFeature(feature) {
    return this.config.supportedFeatures?.includes(feature) || false;
  }
  
  /**
   * Get operator-specific endpoint
   */
  getEndpoint(action) {
    const endpoints = this.config.endpoints || {};
    return endpoints[action] || this.config.baseUrl;
  }
  
  /**
   * Validate required parameters for an operation
   */
  validateParams(params, requiredFields) {
    const missing = [];
    
    requiredFields.forEach(field => {
      if (!params[field]) {
        missing.push(field);
      }
    });
    
    if (missing.length > 0) {
      throw new UnifiedError('MISSING_PARAMETERS', 
        `Missing required parameters: ${missing.join(', ')}`);
    }
  }
  
  /**
   * Apply operator-specific business rules
   */
  applyBusinessRules(operation, params) {
    const rules = this.config.businessRules?.[operation] || {};
    
    // Check amount limits
    if (rules.maxAmount && params.amount > rules.maxAmount) {
      throw new UnifiedError('AMOUNT_LIMIT_EXCEEDED', 
        `Amount ${params.amount} exceeds maximum of ${rules.maxAmount}`);
    }
    
    if (rules.minAmount && params.amount < rules.minAmount) {
      throw new UnifiedError('AMOUNT_TOO_LOW', 
        `Amount ${params.amount} below minimum of ${rules.minAmount}`);
    }
    
    // Check frequency limits
    if (rules.maxSubscriptionsPerMSISDN && operation === 'createSubscription') {
      // This would require checking the database - implement in service layer
    }
    
    return params;
  }
}

module.exports = BaseAdapter;