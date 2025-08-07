/**
 * Mobily Saudi Arabia Adapter - SLA v2.2 COMPLIANT
 * 
 * Implements SLA Digital integration specific to Mobily (Etisalat Saudi Arabia) operator.
 * Features: 4-digit PIN, Arabic/English support, SAR currency, KSA market business rules
 * FIXED: Now fully SLA v2.2 compliant with query string parameters
 * 
 * Note: Mobily is the second-largest mobile operator in Saudi Arabia
 */

const BaseAdapter = require('../base/BaseAdapter');
const { UnifiedError } = require('../../utils/errors');
const Logger = require('../../utils/logger');

class MobilyKSAAdapter extends BaseAdapter {
  constructor(config) {
    super({
      ...config,
      operatorCode: 'mobily-ksa',
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
        'headerEnrichment'
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
          length: 4, // 4-digit PIN for Mobily
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
   * Create subscription with Mobily KSA specific logic - SLA v2.2 COMPLIANT
   */
  async createSubscription(params) {
    return this.executeWithLogging('createSubscription', params, async () => {
      // Validate required parameters
      this.validateParams(params, ['msisdn', 'pin', 'campaign', 'merchant']);
      
      // Apply Mobily KSA business rules
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
        operator_code: 'mobily-ksa',
        country_code: 'SA'
      };
      
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
   * Generate PIN with Mobily KSA specific settings - SLA v2.2 COMPLIANT
   */
  async generatePIN(msisdn, campaign) {
    return this.executeWithLogging('generatePIN', { msisdn, campaign }, async () => {
      this.validateParams({ msisdn, campaign }, ['msisdn', 'campaign']);
      
      const normalizedMSISDN = this.normalizeMSISDN(msisdn);
      
      // SLA v2.2 COMPLIANT: Prepare parameters for query string
      const payload = {
        msisdn: normalizedMSISDN,
        campaign,
        merchant: this.config.credentials.merchant,
        template: 'subscription',
        language: 'ar', // Arabic for KSA
        country_code: 'SA',
        operator_code: 'mobily-ksa'
        // NOTE: pin_length removed - SLA v2.2 handles this automatically per operator
      };
      
      // SLA v2.2 COMPLIANT: SLADigitalClient handles query string placement
      const response = await this.client.post('/v2.2/pin', payload);
      
      // Log PIN generation for audit trail (without exposing PIN)
      Logger.info('PIN generated for Mobily KSA', {
        operatorCode: this.operatorCode,
        msisdn: this.maskMSISDN(normalizedMSISDN),
        campaign,
        language: payload.language
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
        operator_code: 'mobily-ksa'
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
        operator_code: 'mobily-ksa'
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
        operator_code: 'mobily-ksa'
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
        operator_code: 'mobily-ksa'
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
        operator_code: 'mobily-ksa',
        country_code: 'SA'
      });
      
      // Add Mobily-specific eligibility processing
      if (response.data && response.data.eligible === false) {
        Logger.info('Customer not eligible for Mobily services', {
          operatorCode: this.operatorCode,
          msisdn: this.maskMSISDN(normalizedMSISDN),
          reason: response.data.eligibility_reason
        });
      }
      
      return response;
    });
  }
  
  /**
   * Send SMS with Arabic/English template support - SLA v2.2 COMPLIANT
   */
  async sendSMS(msisdn, message, template = 'welcome') {
    return this.executeWithLogging('sendSMS', { msisdn, template }, async () => {
      this.validateParams({ msisdn, message }, ['msisdn', 'message']);
      
      const normalizedMSISDN = this.normalizeMSISDN(msisdn);
      
      // SLA v2.2 COMPLIANT: Parameters in query string via SLADigitalClient
      const response = await this.client.post('/v2.2/sms', {
        msisdn: normalizedMSISDN,
        message,
        template,
        language: 'ar', // Arabic for KSA
        operator_code: 'mobily-ksa'
      });
      
      return response;
    });
  }
  
  /**
   * Cache subscription data for performance
   */
  async cacheSubscriptionData(uuid, data) {
    try {
      const cacheKey = `mobily:subscription:${uuid}`;
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
      operatorCode: 'mobily-ksa'
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
      'SUB_LIMIT_REACHED': { code: 'SUBSCRIPTION_LIMIT', message: 'Maximum subscriptions reached for this number' },
      'CONSENT_REQUIRED': { code: 'CONSENT_REQUIRED', message: 'Customer consent required for KSA regulations' },
      'INELIGIBLE': { code: 'CUSTOMER_INELIGIBLE', message: 'Customer is not eligible for this service' }
    };
    
    const errorCode = error.code || error.category || 'UNKNOWN_ERROR';
    const mapping = errorMappings[errorCode];
    
    if (mapping) {
      return {
        code: mapping.code,
        message: mapping.message,
        originalCode: errorCode,
        originalMessage: error.message,
        operatorCode: 'mobily-ksa'
      };
    }
    
    return {
      code: 'UNMAPPED_ERROR',
      message: error.message || 'Unknown error from Mobily Saudi Arabia',
      originalCode: errorCode,
      originalMessage: error.message,
      operatorCode: 'mobily-ksa'
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
  
  /**
   * Apply Mobily KSA specific business rules
   */
  applyBusinessRules(operation, params) {
    const baseParams = super.applyBusinessRules(operation, params);
    
    if (operation === 'createSubscription') {
      // KSA regulatory compliance checks
      if (!params.consent_timestamp) {
        Logger.warn('Creating subscription without explicit consent timestamp', {
          operatorCode: this.operatorCode,
          msisdn: this.maskMSISDN(params.msisdn)
        });
      }
      
      // Multiple subscription handling for KSA market
      Logger.info('Mobily KSA allows multiple subscriptions per MSISDN', {
        operatorCode: this.operatorCode,
        maxSubscriptions: this.config.businessRules.createSubscription.maxSubscriptionsPerMSISDN
      });
    }
    
    return baseParams;
  }
}

module.exports = MobilyKSAAdapter;