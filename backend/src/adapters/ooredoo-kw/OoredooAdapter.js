/**
 * Ooredoo Kuwait Adapter - SLA v2.2 COMPLIANT
 * 
 * Implements SLA Digital integration specific to Ooredoo Kuwait operator.
 * Features: KWD currency, Arabic/English support, flexible PIN/Checkout
 * FIXED: Now fully SLA v2.2 compliant with query string parameters
 */

const BaseAdapter = require('../base/BaseAdapter');
const { UnifiedError } = require('../../utils/errors');
const Logger = require('../../utils/logger');

class OoredooAdapter extends BaseAdapter {
  constructor(config) {
    super({
      ...config,
      operatorCode: 'ooredoo-kw',
      msisdnRegex: /^(\+965|965)?[24]\d{7}$/, // Kuwait mobile numbers (Ooredoo prefix)
      endpoints: {
        api: 'https://api.sla-alacrity.com'
      },
      supportedFeatures: [
        'subscription',
        'oneTimeCharge',
        'pin',
        'checkout',
        'refund',
        'eligibility'
      ],
      businessRules: {
        createSubscription: {
          maxAmount: 30, // KWD
          minAmount: 0.1,
          maxSubscriptionsPerMSISDN: 2,
          subscriptionCooldown: 3 * 24 * 60 * 60 * 1000 // 3 days
        },
        charge: {
          maxAmount: 30, // KWD configurable per service
          minAmount: 0.1
        }
      }
    });
  }
  
  /**
   * Create subscription with Ooredoo Kuwait specific logic - SLA v2.2 COMPLIANT
   */
  async createSubscription(params) {
    return this.executeWithLogging('createSubscription', params, async () => {
      // Validate required parameters
      this.validateParams(params, ['msisdn', 'campaign', 'merchant']);
      
      // Apply business rules
      const validatedParams = this.applyBusinessRules('createSubscription', params);
      
      // Normalize MSISDN
      const msisdn = this.normalizeMSISDN(params.msisdn);
      
      // SLA v2.2 COMPLIANT: Prepare parameters for query string
      const payload = {
        msisdn,
        campaign: params.campaign,
        merchant: params.merchant,
        language: params.language || 'en',
        operator_code: 'ooredoo-kw',
        country_code: 'KW'
      };
      
      // Add optional parameters
      if (params.trialDays) {
        payload.trial = params.trialDays;
      }
      
      if (params.skipInitialCharge) {
        payload.charge = 'false';
      }
      
      // Add flow type
      payload.flow_type = params.flowType || 'checkout';
      
      // Add PIN if using PIN flow
      if (params.flowType === 'pin' && params.pin) {
        if (!/^\d{4}$/.test(params.pin)) {
          throw new UnifiedError('INVALID_PIN_FORMAT', 
            'Ooredoo Kuwait requires 4-digit PIN');
        }
        payload.pin = params.pin;
      }
      
      // SLA v2.2 COMPLIANT: SLADigitalClient handles query string placement automatically
      const response = await this.client.post('/v2.2/subscription/create', payload);
      
      return response;
    });
  }
  
  /**
   * Generate PIN with Ooredoo Kuwait specific settings - SLA v2.2 COMPLIANT
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
        language: 'ar', // Arabic for Kuwait
        operator_code: 'ooredoo-kw',
        country_code: 'KW'
        // NOTE: pin_length removed - SLA v2.2 handles this automatically per operator
      };
      
      // SLA v2.2 COMPLIANT: SLADigitalClient handles query string placement
      const response = await this.client.post('/v2.2/pin', payload);
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
        operator_code: 'ooredoo-kw'
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
        operator_code: 'ooredoo-kw'
      });
      
      return response;
    });
  }
  
  /**
   * Process one-time charge - SLA v2.2 COMPLIANT
   */
  async charge(uuid, amount) {
    return this.executeWithLogging('charge', { uuid, amount }, async () => {
      this.validateParams({ uuid, amount }, ['uuid', 'amount']);
      
      const validatedParams = this.applyBusinessRules('charge', { amount });
      
      // SLA v2.2 COMPLIANT: Parameters in query string via SLADigitalClient
      const response = await this.client.post('/v2.2/charge', {
        uuid,
        amount: validatedParams.amount,
        currency: 'KWD',
        operator_code: 'ooredoo-kw'
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
        currency: 'KWD',
        operator_code: 'ooredoo-kw'
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
        operator_code: 'ooredoo-kw',
        country_code: 'KW'
      });
      
      return response;
    });
  }
  
  /**
   * Map Ooredoo Kuwait response data to unified format
   */
  mapResponseData(response) {
    // Handle the new response structure with data wrapper
    const responseData = response.data || response;
    
    return {
      subscriptionId: responseData.uuid,
      operatorSubscriptionId: responseData.uuid,
      status: this.mapStatus(responseData.status),
      amount: responseData.amount || responseData.charge_amount,
      currency: responseData.currency || 'KWD',
      frequency: responseData.frequency || 'monthly',
      nextBillingDate: responseData.next_payment_timestamp,
      msisdn: responseData.msisdn,
      campaign: responseData.campaign,
      merchant: responseData.merchant,
      transactionId: responseData.transaction_id,
      eligible: responseData.eligible,
      eligibilityReason: responseData.eligibility_reason,
      flowType: responseData.flow_type,
      operatorCode: 'ooredoo-kw',
      countryCode: 'KW'
    };
  }
  
  /**
   * Map Ooredoo Kuwait errors to unified format
   */
  mapError(error) {
    const errorMappings = {
      '2001': { code: 'INVALID_MSISDN', message: 'Invalid Kuwait mobile number format (Ooredoo)' },
      '2015': { code: 'INSUFFICIENT_FUNDS', message: 'Insufficient balance' },
      '4001': { code: 'INVALID_PIN', message: 'Invalid 4-digit PIN code' },
      '4002': { code: 'PIN_EXPIRED', message: 'PIN has expired, please request a new 4-digit PIN' },
      '1003': { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests, please try again later' },
      'SUB_EXISTS': { code: 'SUBSCRIPTION_EXISTS', message: 'Customer already has an active subscription' },
      'SUB_NOT_FOUND': { code: 'SUBSCRIPTION_NOT_FOUND', message: 'Subscription not found' },
      'INELIGIBLE': { code: 'CUSTOMER_INELIGIBLE', message: 'Customer is not eligible' },
      'FLOW_NOT_SUPPORTED': { code: 'FLOW_NOT_SUPPORTED', message: 'Requested flow not supported for this service' },
      'AUTH_FAILED': { code: 'AUTHENTICATION_FAILED', message: 'Authentication failed' }
    };
    
    const errorCode = error.code || error.category || 'UNKNOWN_ERROR';
    const mapping = errorMappings[errorCode];
    
    if (mapping) {
      return {
        code: mapping.code,
        message: mapping.message,
        originalCode: errorCode,
        originalMessage: error.message,
        operatorCode: 'ooredoo-kw'
      };
    }
    
    return {
      code: 'UNMAPPED_ERROR',
      message: error.message || 'Unknown error from Ooredoo Kuwait',
      originalCode: errorCode,
      originalMessage: error.message,
      operatorCode: 'ooredoo-kw'
    };
  }
  
  /**
   * Map Ooredoo Kuwait status to unified status
   */
  mapStatus(operatorStatus) {
    const statusMappings = {
      'ACTIVE': 'active',
      'SUSPENDED': 'suspended',
      'CANCELLED': 'cancelled',
      'DELETED': 'cancelled',
      'REMOVED': 'cancelled',
      'TRIAL': 'trial',
      'EXPIRED': 'expired',
      'GRACE': 'grace'
    };
    
    return statusMappings[operatorStatus] || 'unknown';
  }
  
  /**
   * Override MSISDN normalization for Ooredoo Kuwait
   */
  normalizeMSISDN(msisdn) {
    // Remove any non-digit characters except +
    let normalized = msisdn.replace(/[^\d+]/g, '');
    
    // Remove Kuwait country code if present
    if (normalized.startsWith('+965')) {
      normalized = normalized.substring(4);
    } else if (normalized.startsWith('965')) {
      normalized = normalized.substring(3);
    }
    
    // Ensure it's 8 digits starting with 2 or 4 (Ooredoo prefixes)
    if (normalized.length === 8 && /^[24]/.test(normalized)) {
      return normalized;
    }
    
    throw new UnifiedError('INVALID_MSISDN', 
      'Invalid Ooredoo Kuwait mobile number format. Must be 8 digits starting with 2 or 4');
  }
  
  /**
   * Mask MSISDN for logging privacy
   */
  maskMSISDN(msisdn) {
    if (msisdn && msisdn.length >= 6) {
      return msisdn.substring(0, 3) + '***' + msisdn.substring(msisdn.length - 2);
    }
    return '***';
  }
}

module.exports = OoredooAdapter;