/**
 * Mobily Saudi Arabia Adapter - SLA v2.2 COMPLIANT
 * 
 * Implements SLA Digital integration for Mobily (Saudi Arabia) operator.
 * FIXED: Correct operator code 'mobily-sa' per official SLA Digital documentation
 * Features: 4-digit PIN, Arabic/English support, SAR currency, dynamic SMS parameter
 */

const BaseAdapter = require('../base/BaseAdapter');
const { UnifiedError } = require('../../utils/errors');
const Logger = require('../../utils/logger');

class MobilySAAdapter extends BaseAdapter {
  constructor(config) {
    super({
      ...config,
      operatorCode: 'mobily-sa', // ✅ FIXED: Correct code per SLA Digital docs
      msisdnRegex: /^(\+966|966)?5\d{8}$/, // Saudi Arabia mobile numbers (5xxxxxxxx)
      endpoints: {
        checkout: 'https://api.sla-alacrity.com', // Standard checkout endpoint
        api: 'https://api.sla-alacrity.com'
      },
      supportedFeatures: [
        'subscription',
        'oneTimeCharge', 
        'pin',
        'refund',
        'eligibility',
        'sms',
        'dynamicSms', // ✅ NEW: Dynamic SMS parameter per SLA docs
        'fraudPrevention' // ✅ NEW: Fraud prevention token support
      ],
      businessRules: {
        createSubscription: {
          maxAmount: 200, // SAR - Higher limit for Saudi market
          minAmount: 1.0,
          maxSubscriptionsPerMSISDN: 5, // Multiple subscriptions allowed
          trialPeriodDays: 7, // 7-day trial period support
          requiresConsent: true // KSA regulatory compliance
        },
        charge: {
          maxAmount: 500, // SAR
          minAmount: 1.0,
          supportsCurrency: ['SAR'],
          requiresPreAuthorization: false
        },
        pin: {
          length: 4, // ✅ CONFIRMED: 4-digit PIN for Mobily per SLA docs
          expiryMinutes: 3, // 3-minute expiry
          maxAttempts: 3,
          supportedLanguages: ['ar', 'en']
        }
      },
      countryCode: 'SA',
      currency: 'SAR',
      timezone: 'Asia/Riyadh',
      languages: ['ar', 'en'] // Arabic and English support
    });
  }
  
  /**
   * Create subscription with Mobily SA specific logic - SLA v2.2 COMPLIANT
   */
  async createSubscription(params) {
    return this.executeWithLogging('createSubscription', params, async () => {
      // Validate required parameters
      this.validateParams(params, ['msisdn', 'pin', 'campaign', 'merchant']);
      
      // Apply Mobily SA business rules
      const validatedParams = this.applyBusinessRules('createSubscription', params);
      
      // Validate PIN format (4 digits for Mobily)
      if (!/^\d{4}$/.test(params.pin)) {
        throw new UnifiedError('INVALID_PIN_FORMAT', 
          'Mobily Saudi Arabia requires 4-digit PIN');
      }
      
      // Normalize MSISDN for KSA
      const msisdn = this.normalizeMSISDN(params.msisdn);
      
      // SLA v2.2 COMPLIANT: Prepare parameters for query string
      const payload = {
        msisdn,
        pin: params.pin,
        campaign: params.campaign,
        merchant: params.merchant,
        language: params.language || 'ar', // Default to Arabic for KSA
        currency: 'SAR',
        consent_timestamp: new Date().toISOString(), // KSA regulatory requirement
        operator_code: 'mobily-sa', // ✅ FIXED: Correct operator code
        country_code: 'SA'
      };
      
      // ✅ NEW: Add fraud_token if provided (per SLA docs for Mobily)
      if (params.fraudToken) {
        payload.fraud_token = params.fraudToken;
      }
      
      // Add optional parameters
      if (params.trialDays) {
        payload.trial = params.trialDays;
      }
      
      if (params.skipInitialCharge) {
        payload.charge = 'false';
      }
      
      // SLA v2.2 COMPLIANT: SLADigitalClient handles query string placement automatically
      const response = await this.client.post('/v2.2/subscription/create', payload);
      
      // Add Mobily-specific response processing
      if (response.data && response.data.uuid) {
        // Cache subscription details for faster retrieval
        await this.cacheSubscriptionData(response.data.uuid, response.data);
      }
      
      return response;
    });
  }
  
  /**
   * Generate PIN with Mobily SA specific settings - SLA v2.2 COMPLIANT
   * ✅ NEW: Support for fraud_token per SLA documentation
   */
  async generatePIN(msisdn, campaign, options = {}) {
    return this.executeWithLogging('generatePIN', { msisdn, campaign }, async () => {
      this.validateParams({ msisdn, campaign }, ['msisdn', 'campaign']);
      
      const normalizedMSISDN = this.normalizeMSISDN(msisdn);
      
      // SLA v2.2 COMPLIANT: Prepare parameters for query string
      const payload = {
        msisdn: normalizedMSISDN,
        campaign,
        merchant: this.config.credentials.merchant,
        template: 'subscription',
        language: options.language || 'ar', // Arabic for KSA
        country_code: 'SA',
        operator_code: 'mobily-sa' // ✅ FIXED: Correct operator code
      };
      
      // ✅ NEW: Add fraud_token if provided (per SLA docs for Mobily fraud prevention)
      if (options.fraudToken) {
        payload.fraud_token = options.fraudToken;
      }
      
      // SLA v2.2 COMPLIANT: SLADigitalClient handles query string placement
      const response = await this.client.post('/v2.2/pin', payload);
      
      // Log PIN generation for audit trail (without exposing PIN)
      Logger.info('PIN generated for Mobily SA', {
        operatorCode: this.operatorCode,
        msisdn: this.maskMSISDN(normalizedMSISDN),
        campaign,
        language: payload.language,
        hasFraudToken: !!options.fraudToken
      });
      
      return response;
    });
  }
  
  /**
   * ✅ NEW: Send SMS with dynamic_sms parameter support per SLA documentation
   * This allows inserting custom text into Mobily's customer care portal
   */
  async sendSMS(msisdn, message, options = {}) {
    return this.executeWithLogging('sendSMS', { msisdn, message }, async () => {
      this.validateParams({ msisdn, message }, ['msisdn', 'message']);
      
      const normalizedMSISDN = this.normalizeMSISDN(msisdn);
      
      // SLA v2.2 COMPLIANT: Prepare parameters for query string
      const payload = {
        msisdn: normalizedMSISDN,
        text: message,
        campaign: options.campaign || this.config.defaultCampaign,
        merchant: this.config.credentials.merchant,
        correlator: options.correlator || this.generateCorrelator(),
        language: options.language || 'ar', // Arabic for KSA
        operator_code: 'mobily-sa' // ✅ FIXED: Correct operator code
      };
      
      // ✅ NEW: Add dynamic_sms parameter per SLA Mobily documentation
      // This inserts the text into operator's customer care portal for SMS delivery
      if (options.dynamicSms !== undefined) {
        payload.dynamic_sms = options.dynamicSms;
      }
      
      // SLA v2.2 COMPLIANT: SLADigitalClient handles query string placement
      const response = await this.client.post('/v2.2/sms', payload);
      
      Logger.info('SMS sent via Mobily SA', {
        operatorCode: this.operatorCode,
        msisdn: this.maskMSISDN(normalizedMSISDN),
        dynamicSms: payload.dynamic_sms,
        correlator: payload.correlator
      });
      
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
        operator_code: 'mobily-sa' // ✅ FIXED: Correct operator code
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
        operator_code: 'mobily-sa' // ✅ FIXED: Correct operator code
      });
      
      return response;
    });
  }
  
  /**
   * Process one-time charge with KSA-specific handling - SLA v2.2 COMPLIANT
   */
  async charge(uuid, amount) {
    return this.executeWithLogging('charge', { uuid, amount }, async () => {
      this.validateParams({ uuid, amount }, ['uuid', 'amount']);
      
      // Apply Mobily charge limits
      const validatedParams = this.applyBusinessRules('charge', { amount });
      
      // SLA v2.2 COMPLIANT: Parameters in query string via SLADigitalClient
      const response = await this.client.post('/v2.2/charge', {
        uuid,
        amount: validatedParams.amount,
        currency: 'SAR',
        operator_code: 'mobily-sa' // ✅ FIXED: Correct operator code
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
        currency: 'SAR',
        operator_code: 'mobily-sa' // ✅ FIXED: Correct operator code
      });
      
      return response;
    });
  }
  
  /**
   * Check customer eligibility with Mobily-specific logic - SLA v2.2 COMPLIANT
   */
  async checkEligibility(msisdn) {
    return this.executeWithLogging('checkEligibility', { msisdn }, async () => {
      this.validateParams({ msisdn }, ['msisdn']);
      
      const normalizedMSISDN = this.normalizeMSISDN(msisdn);
      
      // SLA v2.2 COMPLIANT: Parameters in query string via SLADigitalClient
      const response = await this.client.post('/v2.2/eligibility', {
        msisdn: normalizedMSISDN,
        operator_code: 'mobily-sa', // ✅ FIXED: Correct operator code
        country_code: 'SA'
      });
      
      return response;
    });
  }
  
  /**
   * Generate correlator for tracking
   */
  generateCorrelator() {
    return `mobily-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
  
  /**
   * Cache subscription data for performance
   */
  async cacheSubscriptionData(uuid, data) {
    try {
      const cacheKey = `mobily-sa:subscription:${uuid}`;
      const ttl = 300; // 5 minutes
      
      // Use Redis if available, otherwise skip caching
      if (this.redis) {
        await this.redis.setex(cacheKey, ttl, JSON.stringify(data));
      }
    } catch (error) {
      Logger.warn('Failed to cache subscription data', {
        operatorCode: this.operatorCode,
        uuid,
        error: error.message
      });
    }
  }
  
  /**
   * Map Mobily response data to unified format
   */
  mapResponseData(response) {
    // Handle the new response structure with data wrapper
    const responseData = response.data || response;
    
    return {
      subscriptionId: responseData.uuid,
      operatorSubscriptionId: responseData.operator_subscription_id || responseData.uuid,
      status: this.mapStatus(responseData.status),
      amount: responseData.amount || responseData.charge_amount,
      currency: responseData.currency || 'SAR',
      frequency: responseData.frequency || 'monthly',
      nextBillingDate: responseData.next_payment_timestamp,
      msisdn: responseData.msisdn,
      campaign: responseData.campaign,
      merchant: responseData.merchant,
      transactionId: responseData.transaction_id,
      eligible: responseData.eligible,
      eligibilityReason: responseData.eligibility_reason,
      countryCode: 'SA',
      operatorCode: 'mobily-sa', // ✅ FIXED: Correct operator code
      dynamicSmsSupported: true // ✅ Feature flag
    };
  }
  
  /**
   * Map Mobily errors to unified format
   */
  mapError(error) {
    const errorMappings = {
      '2001': { code: 'INVALID_MSISDN', message: 'Invalid Saudi Arabia phone number format' },
      '2015': { code: 'INSUFFICIENT_FUNDS', message: 'Insufficient balance to complete transaction' },
      '2033': { code: 'KSA_REGULATORY_BLOCK', message: 'Transaction blocked due to KSA regulatory requirements' },
      '4001': { code: 'INVALID_PIN', message: 'Invalid or expired 4-digit PIN' },
      '4002': { code: 'PIN_EXPIRED', message: 'PIN has expired, please request a new 4-digit PIN' },
      '1003': { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests, please try again later' },
      '8001': { code: 'SMS_SENDING_FAILED', message: 'SMS sending failed' },
      'SUB_LIMIT_REACHED': { code: 'SUBSCRIPTION_LIMIT', message: 'Maximum subscriptions reached for this number' },
      'CONSENT_REQUIRED': { code: 'CONSENT_REQUIRED', message: 'Customer consent required for KSA regulations' },
      'INELIGIBLE': { code: 'CUSTOMER_INELIGIBLE', message: 'Customer is not eligible for this service' },
      'FRAUD_DETECTED': { code: 'FRAUD_DETECTED', message: 'Fraud detected, transaction blocked' }
    };
    
    const errorCode = error.code || error.category || 'UNKNOWN_ERROR';
    const mapping = errorMappings[errorCode];
    
    if (mapping) {
      return {
        code: mapping.code,
        message: mapping.message,
        originalCode: errorCode,
        originalMessage: error.message,
        operatorCode: 'mobily-sa' // ✅ FIXED: Correct operator code
      };
    }
    
    return {
      code: 'UNMAPPED_ERROR',
      message: error.message || 'Unknown error from Mobily Saudi Arabia',
      originalCode: errorCode,
      originalMessage: error.message,
      operatorCode: 'mobily-sa' // ✅ FIXED: Correct operator code
    };
  }
  
  /**
   * Map Mobily status to unified status
   */
  mapStatus(operatorStatus) {
    const statusMappings = {
      'CHARGED': 'active',
      'ACTIVE': 'active',
      'SUCCESS': 'active', // Alternative success status
      'SUSPENDED': 'suspended',
      'TRIAL': 'trial',
      'DELETED': 'cancelled',
      'REMOVED': 'cancelled',
      'GRACE': 'grace',
      'EXPIRED': 'expired',
      'PENDING_CONSENT': 'pending_consent' // KSA-specific status
    };
    
    return statusMappings[operatorStatus] || 'unknown';
  }
  
  /**
   * Normalize MSISDN for Saudi Arabia
   */
  normalizeMSISDN(msisdn) {
    // Remove any non-digit characters except +
    let normalized = msisdn.replace(/[^\d+]/g, '');
    
    // Remove Saudi Arabia country code if present
    if (normalized.startsWith('+966')) {
      normalized = normalized.substring(4);
    } else if (normalized.startsWith('966')) {
      normalized = normalized.substring(3);
    }
    
    // Ensure it starts with 5 and is 9 digits total
    if (normalized.length === 9 && normalized.startsWith('5')) {
      return normalized;
    }
    
    throw new UnifiedError('INVALID_MSISDN', 
      'Invalid Saudi Arabia mobile number format. Must be 9 digits starting with 5');
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
}

module.exports = MobilySAAdapter;