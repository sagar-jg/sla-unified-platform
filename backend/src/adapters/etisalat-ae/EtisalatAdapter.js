/**
 * Etisalat UAE Adapter - SLA v2.2 COMPLIANT
 * 
 * Implements SLA Digital integration specific to Etisalat UAE operator.
 * Features: AED currency, Arabic/English support, high spend limits, fraud_token support
 * FIXED: Now fully SLA v2.2 compliant with query string parameters
 */

const BaseAdapter = require('../base/BaseAdapter');
const { UnifiedError } = require('../../utils/errors');
const Logger = require('../../utils/logger');
const crypto = require('crypto');

class EtisalatAdapter extends BaseAdapter {
  constructor(config) {
    super({
      ...config,
      operatorCode: 'etisalat-ae',
      msisdnRegex: /^(\+971|971)?5[0-9]\d{7}$/, // UAE mobile numbers
      endpoints: {
        api: 'https://api.sla-alacrity.com',
        checkout: 'https://checkout.sla-alacrity.com' // Standard checkout for Etisalat
      },
      supportedFeatures: [
        'subscription',
        'oneTimeCharge',
        'pin',
        'checkout',
        'refund',
        'eligibility',
        'fraudToken' // fraud_token support
      ],
      businessRules: {
        createSubscription: {
          maxAmount: 365, // AED
          minAmount: 1,
          maxSubscriptionsPerMSISDN: 3, // Higher limit for UAE
          subscriptionCooldown: 24 * 60 * 60 * 1000 // 1 day
        },
        charge: {
          maxAmount: 365, // AED
          minAmount: 1,
          monthlyLimit: {
            postpaid: 200, // AED/Month
            prepaid: 1000  // AED/Month
          }
        },
        pin: {
          length: 4, // 4-digit PIN for Etisalat UAE
          expiryMinutes: 2, // 2-minute expiry
          maxAttempts: 3,
          requiresFraudToken: true, // fraud token required
          supportedLanguages: ['ar', 'en']
        }
      }
    });
  }
  
  /**
   * Generate fraud token for PIN API calls - SLA v2.2 COMPLIANT
   * Fraud token helps prevent PIN generation abuse and enhances security
   */
  generateFraudToken(msisdn, timestamp = null) {
    try {
      const ts = timestamp || Date.now();
      const secretKey = this.config.credentials.fraudTokenSecret || 'default-secret';
      
      // Create a hash based on MSISDN, timestamp, and secret
      const data = `${msisdn}:${ts}:${secretKey}`;
      const token = crypto.createHash('sha256').update(data).digest('hex').substring(0, 16);
      
      Logger.debug('Generated fraud token for Etisalat UAE', {
        operatorCode: this.operatorCode,
        msisdn: this.maskMSISDN(msisdn),
        timestamp: ts
      });
      
      return {
        token,
        timestamp: ts,
        expires_at: ts + (2 * 60 * 1000) // 2 minutes expiry
      };
    } catch (error) {
      Logger.error('Failed to generate fraud token', {
        operatorCode: this.operatorCode,
        error: error.message
      });
      throw new UnifiedError('FRAUD_TOKEN_GENERATION_FAILED', 
        'Failed to generate fraud protection token');
    }
  }
  
  /**
   * Generate PIN with fraud_token support - SLA v2.2 COMPLIANT
   */
  async generatePIN(msisdn, campaign) {
    return this.executeWithLogging('generatePIN', { msisdn, campaign }, async () => {
      this.validateParams({ msisdn, campaign }, ['msisdn', 'campaign']);
      
      const normalizedMSISDN = this.normalizeMSISDN(msisdn);
      
      // Generate fraud token for PIN request
      const fraudToken = this.generateFraudToken(normalizedMSISDN);
      
      // SLA v2.2 COMPLIANT: Prepare parameters for query string
      const payload = {
        msisdn: normalizedMSISDN,
        campaign,
        merchant: this.config.credentials.merchant,
        template: 'subscription',
        language: 'en', // English for UAE
        fraud_token: fraudToken.token, // fraud token for security
        operator_code: 'etisalat-ae',
        country_code: 'AE'
      };
      
      // SLA v2.2 COMPLIANT: SLADigitalClient handles query string placement
      const response = await this.client.post('/v2.2/pin', payload);
      
      // Add fraud token info to response for tracking
      if (response.data) {
        response.data.fraud_token_expires = fraudToken.expires_at;
      }
      
      Logger.info('PIN generated for Etisalat UAE with fraud protection', {
        operatorCode: this.operatorCode,
        msisdn: this.maskMSISDN(normalizedMSISDN),
        campaign,
        fraudTokenExpires: new Date(fraudToken.expires_at).toISOString()
      });
      
      return response;
    });
  }
  
  /**
   * Create subscription with Etisalat UAE specific logic - SLA v2.2 COMPLIANT
   */
  async createSubscription(params) {
    return this.executeWithLogging('createSubscription', params, async () => {
      // Validate required parameters
      this.validateParams(params, ['msisdn', 'pin', 'campaign', 'merchant']);
      
      // Apply business rules
      const validatedParams = this.applyBusinessRules('createSubscription', params);
      
      // Validate PIN format (4 digits for Etisalat UAE)
      if (!/^\d{4}$/.test(params.pin)) {
        throw new UnifiedError('INVALID_PIN_FORMAT', 
          'Etisalat UAE requires 4-digit PIN');
      }
      
      // Normalize MSISDN
      const msisdn = this.normalizeMSISDN(params.msisdn);
      
      // SLA v2.2 COMPLIANT: Prepare parameters for query string
      const payload = {
        msisdn,
        pin: params.pin,
        campaign: params.campaign,
        merchant: params.merchant,
        language: params.language || 'en', // Default to English
        customer_type: params.customerType || 'prepaid', // postpaid/prepaid
        operator_code: 'etisalat-ae',
        country_code: 'AE'
      };
      
      // Add optional parameters
      if (params.trialDays) {
        payload.trial = params.trialDays;
      }
      
      if (params.skipInitialCharge) {
        payload.charge = 'false';
      }
      
      // SLA v2.2 COMPLIANT: SLADigitalClient handles query string placement
      const response = await this.client.post('/v2.2/subscription/create', payload);
      
      return response;
    });
  }
  
  /**
   * Cancel subscription - SLA v2.2 COMPLIANT
   */
  async cancelSubscription(uuid) {
    return this.executeWithLogging('cancelSubscription', { uuid }, async () => {
      this.validateParams({ uuid }, ['uuid']);
      
      // SLA v2.2 COMPLIANT: Parameters in query string via SLADigitalClient
      const response = await this.client.post('/v2.2/subscription/delete', {
        uuid,
        operator_code: 'etisalat-ae'
      });
      
      return response;
    });
  }
  
  /**
   * Get subscription status - SLA v2.2 COMPLIANT
   */
  async getSubscriptionStatus(uuid) {
    return this.executeWithLogging('getSubscriptionStatus', { uuid }, async () => {
      this.validateParams({ uuid }, ['uuid']);
      
      // SLA v2.2 COMPLIANT: Parameters in query string via SLADigitalClient
      const response = await this.client.post('/v2.2/subscription/status', {
        uuid,
        operator_code: 'etisalat-ae'
      });
      
      return response;
    });
  }
  
  /**
   * Process one-time charge - SLA v2.2 COMPLIANT
   */
  async charge(uuid, amount, customerType = 'prepaid') {
    return this.executeWithLogging('charge', { uuid, amount, customerType }, async () => {
      this.validateParams({ uuid, amount }, ['uuid', 'amount']);
      
      // Apply customer type specific limits
      const limits = this.config.businessRules.charge.monthlyLimit;
      const maxAmount = limits[customerType] || limits.prepaid;
      
      if (amount > maxAmount) {
        throw new UnifiedError('AMOUNT_LIMIT_EXCEEDED', 
          `Amount ${amount} exceeds ${customerType} limit of ${maxAmount} AED`);
      }
      
      // SLA v2.2 COMPLIANT: Parameters in query string via SLADigitalClient
      const response = await this.client.post('/v2.2/charge', {
        uuid,
        amount,
        customer_type: customerType,
        currency: 'AED',
        operator_code: 'etisalat-ae'
      });
      
      return response;
    });
  }
  
  /**
   * Process refund - SLA v2.2 COMPLIANT
   */
  async refund(transactionId, amount) {
    return this.executeWithLogging('refund', { transactionId, amount }, async () => {
      this.validateParams({ transactionId, amount }, ['transactionId', 'amount']);
      
      // SLA v2.2 COMPLIANT: Parameters in query string via SLADigitalClient
      const response = await this.client.post('/v2.2/refund', {
        transaction_id: transactionId,
        amount,
        currency: 'AED',
        operator_code: 'etisalat-ae'
      });
      
      return response;
    });
  }
  
  /**
   * Check customer eligibility - SLA v2.2 COMPLIANT
   */
  async checkEligibility(msisdn) {
    return this.executeWithLogging('checkEligibility', { msisdn }, async () => {
      this.validateParams({ msisdn }, ['msisdn']);
      
      const normalizedMSISDN = this.normalizeMSISDN(msisdn);
      
      // SLA v2.2 COMPLIANT: Parameters in query string via SLADigitalClient
      const response = await this.client.post('/v2.2/eligibility', {
        msisdn: normalizedMSISDN,
        operator_code: 'etisalat-ae',
        country_code: 'AE'
      });
      
      return response;
    });
  }
  
  /**
   * Mask MSISDN for logging (privacy protection)
   */
  maskMSISDN(msisdn) {
    if (msisdn && msisdn.length >= 6) {
      return msisdn.substring(0, 3) + '***' + msisdn.substring(msisdn.length - 2);
    }
    return '***';
  }
  
  /**
   * Map Etisalat UAE response data to unified format
   */
  mapResponseData(response) {
    // Handle the new response structure with data wrapper
    const responseData = response.data || response;
    
    return {
      subscriptionId: responseData.sub_id || responseData.uuid,
      operatorSubscriptionId: responseData.sub_id || responseData.uuid,
      status: this.mapStatus(responseData.state || responseData.status),
      amount: responseData.price || responseData.amount,
      currency: 'AED',
      frequency: responseData.cycle || responseData.frequency || 'monthly',
      nextBillingDate: responseData.next_bill_date || responseData.next_payment_timestamp,
      msisdn: responseData.msisdn,
      campaign: responseData.campaign,
      merchant: responseData.merchant,
      transactionId: responseData.transaction_id,
      eligible: responseData.eligible,
      eligibilityReason: responseData.eligibility_reason,
      customerType: responseData.customer_type,
      fraudTokenExpires: responseData.fraud_token_expires, // fraud token expiry
      countryCode: 'AE',
      operatorCode: 'etisalat-ae'
    };
  }
  
  /**
   * Map Etisalat UAE errors to unified format - Enhanced with fraud token errors
   */
  mapError(error) {
    const errorMappings = {
      'E001': { code: 'INVALID_MSISDN', message: 'Invalid UAE mobile number' },
      'E002': { code: 'INSUFFICIENT_FUNDS', message: 'Insufficient credit' },
      'E003': { code: 'INVALID_PIN', message: 'Invalid or expired 4-digit PIN' },
      'E004': { code: 'SUBSCRIPTION_EXISTS', message: 'Active subscription exists' },
      'E005': { code: 'CUSTOMER_INELIGIBLE', message: 'Customer not eligible' },
      'E006': { code: 'MONTHLY_LIMIT_EXCEEDED', message: 'Monthly spending limit exceeded' },
      'E007': { code: 'POSTPAID_ONLY', message: 'Service available for postpaid customers only' },
      'E008': { code: 'FRAUD_TOKEN_INVALID', message: 'Invalid or expired fraud token' },
      'E009': { code: 'FRAUD_TOKEN_MISSING', message: 'Fraud token required for PIN generation' },
      'AUTH_FAIL': { code: 'AUTHENTICATION_FAILED', message: 'Authentication failed' },
      'RATE_LIMIT': { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests' },
      'FRAUD_TOKEN_GENERATION_FAILED': { code: 'FRAUD_TOKEN_ERROR', message: 'Failed to generate fraud protection token' }
    };
    
    const errorCode = error.code || error.category || 'UNKNOWN_ERROR';
    const mapping = errorMappings[errorCode];
    
    if (mapping) {
      return {
        code: mapping.code,
        message: mapping.message,
        originalCode: errorCode,
        originalMessage: error.message,
        operatorCode: 'etisalat-ae'
      };
    }
    
    return {
      code: 'UNMAPPED_ERROR',
      message: error.message || 'Unknown error from Etisalat UAE',
      originalCode: errorCode,
      originalMessage: error.message,
      operatorCode: 'etisalat-ae'
    };
  }
  
  /**
   * Map Etisalat UAE status to unified status
   */
  mapStatus(operatorStatus) {
    const statusMappings = {
      'ACTIVE': 'active',
      'CHARGED': 'active', // Alternative success status
      'SUCCESS': 'active', // Alternative success status
      'PAUSED': 'suspended',
      'SUSPENDED': 'suspended',
      'TERMINATED': 'cancelled',
      'DELETED': 'cancelled',
      'TRIAL': 'trial',
      'EXPIRED': 'expired',
      'GRACE': 'grace'
    };
    
    return statusMappings[operatorStatus] || 'unknown';
  }
  
  /**
   * Override MSISDN normalization for UAE
   */
  normalizeMSISDN(msisdn) {
    // Remove any non-digit characters except +
    let normalized = msisdn.replace(/[^\d+]/g, '');
    
    // Remove UAE country code if present
    if (normalized.startsWith('+971')) {
      normalized = normalized.substring(4);
    } else if (normalized.startsWith('971')) {
      normalized = normalized.substring(3);
    }
    
    // Ensure it's 9 digits starting with 5
    if (normalized.length === 9 && normalized.startsWith('5')) {
      return normalized;
    }
    
    throw new UnifiedError('INVALID_MSISDN', 
      'Invalid UAE mobile number format. Must be 9 digits starting with 5');
  }
  
  /**
   * Apply Etisalat UAE specific business rules
   */
  applyBusinessRules(operation, params) {
    const baseParams = super.applyBusinessRules(operation, params);
    
    if (operation === 'createSubscription') {
      // UAE regulatory compliance checks
      Logger.info('Etisalat UAE allows multiple subscriptions with 24h cooldown', {
        operatorCode: this.operatorCode,
        maxSubscriptions: this.config.businessRules.createSubscription.maxSubscriptionsPerMSISDN
      });
    }
    
    return baseParams;
  }
}

module.exports = EtisalatAdapter;