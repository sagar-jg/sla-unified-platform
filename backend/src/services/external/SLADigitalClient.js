/**
 * SLA Digital API Client
 * 
 * Core service for all SLA Digital v2.2 API communications
 * Implements proper authentication, error handling, and SLA v2.2 compliance
 */

const axios = require('axios');
const crypto = require('crypto');
const Logger = require('../../utils/logger');
const { UnifiedError } = require('../../utils/errors');

class SLADigitalClient {
  constructor(credentials, environment = 'sandbox') {
    if (!credentials || !credentials.username || !credentials.password) {
      throw new UnifiedError('INVALID_CREDENTIALS', 'SLA Digital credentials required');
    }

    this.credentials = credentials;
    this.environment = environment;
    this.baseURL = 'https://api.sla-alacrity.com';
    
    // Create Base64 encoded auth header
    const auth = Buffer.from(`${credentials.username}:${credentials.password}`).toString('base64');
    
    // Create authenticated axios instance with SLA v2.2 compliance
    this.httpClient = axios.create({
      baseURL: this.baseURL,
      timeout: 30000,
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
        'User-Agent': 'SLA-Digital-Unified-Platform/1.0',
        'Accept': 'application/json'
      }
    });
    
    this.setupInterceptors();
    this.requestCount = 0;
  }
  
  setupInterceptors() {
    // Request interceptor with SLA v2.2 compliance logging
    this.httpClient.interceptors.request.use(
      (config) => {
        this.requestCount++;
        const correlator = this.generateCorrelator();
        
        Logger.debug('SLA Digital API Request', {
          correlator,
          url: config.url,
          method: config.method,
          params: this.sanitizeParams(config.params || {}),
          environment: this.environment,
          requestId: this.requestCount
        });
        
        // Add correlator for idempotency (SLA v2.2 requirement)
        if (config.params) {
          config.params.correlator = correlator;
        }
        
        return config;
      },
      (error) => Promise.reject(error)
    );
    
    // Response interceptor with proper error mapping
    this.httpClient.interceptors.response.use(
      (response) => {
        Logger.debug('SLA Digital API Response', {
          status: response.status,
          url: response.config.url,
          success: !response.data.error
        });
        
        return response.data;
      },
      (error) => {
        Logger.error('SLA Digital API Error', {
          url: error.config?.url,
          status: error.response?.status,
          code: error.response?.data?.error?.code,
          message: error.response?.data?.error?.message,
          environment: this.environment
        });
        
        throw this.mapError(error);
      }
    );
  }
  
  /**
   * SLA v2.2 Compliant POST Request
   * All parameters go in query string, empty body
   */
  async post(endpoint, params = {}) {
    try {
      // SLA v2.2 Requirement: All parameters in query string
      const queryString = new URLSearchParams(this.cleanParams(params)).toString();
      const url = `${endpoint}${queryString ? '?' + queryString : ''}`;
      
      // SLA v2.2 Requirement: Always POST with empty body
      const response = await this.httpClient.post(url, {});
      
      return this.normalizeResponse(response);
      
    } catch (error) {
      throw this.handleError(error);
    }
  }
  
  /**
   * Generate correlator for idempotency (SLA v2.2 requirement)
   */
  generateCorrelator() {
    return `unified-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  }
  
  /**
   * Clean parameters by removing undefined/null values
   */
  cleanParams(params) {
    const cleaned = {};
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null) {
        cleaned[key] = String(value);
      }
    }
    return cleaned;
  }
  
  /**
   * Sanitize parameters for logging (remove sensitive data)
   */
  sanitizeParams(params) {
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
   * Normalize SLA Digital response to unified format
   */
  normalizeResponse(response) {
    // Check if response has error (SLA Digital returns errors in success responses)
    if (response.error) {
      throw new UnifiedError(
        response.error.code || 'SLA_DIGITAL_ERROR',
        response.error.message || 'Unknown SLA Digital error',
        response.error
      );
    }
    
    return {
      success: true,
      data: response,
      timestamp: new Date().toISOString(),
      environment: this.environment
    };
  }
  
  /**
   * Map SLA Digital errors to unified error format
   */
  mapError(error) {
    if (error.response?.data?.error) {
      const slaError = error.response.data.error;
      return new UnifiedError(
        this.mapErrorCode(slaError.code),
        slaError.message || error.message,
        slaError
      );
    }
    
    if (error.code === 'ECONNREFUSED') {
      return new UnifiedError('CONNECTION_ERROR', 'Unable to connect to SLA Digital API');
    }
    
    if (error.code === 'ENOTFOUND') {
      return new UnifiedError('DNS_ERROR', 'SLA Digital API endpoint not found');
    }
    
    return new UnifiedError('NETWORK_ERROR', error.message || 'Unknown network error');
  }
  
  /**
   * Map SLA Digital error codes to unified codes
   */
  mapErrorCode(slaCode) {
    const errorMappings = {
      '1001': 'UNAUTHORIZED',
      '1002': 'FORBIDDEN',
      '1003': 'RATE_LIMIT_EXCEEDED',
      '2001': 'INVALID_MSISDN',
      '2002': 'INVALID_CAMPAIGN',
      '2003': 'INVALID_MERCHANT',
      '2015': 'INSUFFICIENT_FUNDS',
      '2032': 'SUBSCRIPTION_LIMIT_EXCEEDED',
      '4001': 'INVALID_PIN',
      '4002': 'PIN_EXPIRED',
      '4003': 'PIN_ATTEMPTS_EXCEEDED',
      'SUB_EXISTS': 'SUBSCRIPTION_EXISTS',
      'SUB_NOT_FOUND': 'SUBSCRIPTION_NOT_FOUND',
      'INELIGIBLE': 'CUSTOMER_INELIGIBLE'
    };
    
    return errorMappings[slaCode] || 'SLA_DIGITAL_ERROR';
  }
  
  /**
   * Handle and log errors consistently
   */
  handleError(error) {
    Logger.error('SLA Digital Client Error', {
      error: error.message,
      code: error.code,
      environment: this.environment,
      stack: error.stack
    });
    
    if (error instanceof UnifiedError) {
      return error;
    }
    
    return this.mapError(error);
  }
  
  /**
   * Health check for SLA Digital API connectivity
   */
  async healthCheck() {
    try {
      // Use a lightweight endpoint for health check
      const response = await this.httpClient.get('/');
      return {
        status: 'healthy',
        latency: Date.now(),
        environment: this.environment
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        environment: this.environment
      };
    }
  }
  
  /**
   * Get client statistics
   */
  getStats() {
    return {
      requestCount: this.requestCount,
      environment: this.environment,
      baseURL: this.baseURL,
      credentials: {
        username: this.credentials.username,
        hasPassword: !!this.credentials.password
      }
    };
  }
}

module.exports = SLADigitalClient;