/**
 * Zain Kuwait Adapter - SLA v2.2 COMPLIANT
 * 
 * Implements SLA Digital integration specific to Zain Kuwait operator.
 * Features: 4-digit PIN, special checkout endpoint, Arabic/English support, SDP status mapping
 * FIXED: Now fully SLA v2.2 compliant with query string parameters and correct 4-digit PIN
 */

const BaseAdapter = require('../base/BaseAdapter');
const { UnifiedError } = require('../../utils/errors');
const Logger = require('../../utils/logger');

class ZainKuwaitAdapter extends BaseAdapter {
  constructor(config) {
    super({
      ...config,
      operatorCode: 'zain-kw',
      msisdnRegex: /^(\+965|965)?[569]\d{7}$/, // Kuwait mobile numbers
      endpoints: {
        // CORRECTED: Use special Zain Kuwait checkout endpoint
        checkout: 'https://msisdn.sla-alacrity.com',
        api: 'https://api.sla-alacrity.com'
      },
      supportedFeatures: [
        'subscription',
        'oneTimeCharge', 
        'pin',
        'checkout',
        'refund',
        'eligibility',
        'sdp', // SDP flow support
        'moSms' // MO SMS support
      ],
      businessRules: {
        createSubscription: {
          maxAmount: 30, // KWD
          minAmount: 0.1,
          maxSubscriptionsPerMSISDN: 1,
          subscriptionCooldown: 7 * 24 * 60 * 60 * 1000, // 1 week
          weeklyLimit: 1 // One subscription per week per customer
        },
        charge: {
          maxAmount: 365, // KWD
          minAmount: 0.1
        }
      }
    });
  }
  
  /**
   * Create subscription with Zain Kuwait specific logic - SLA v2.2 COMPLIANT
   */
  async createSubscription(params) {
    return this.executeWithLogging('createSubscription', params, async () => {
      // Validate required parameters
      this.validateParams(params, ['msisdn', 'pin', 'campaign', 'merchant']);
      
      // Apply business rules including weekly subscription limit
      const validatedParams = this.applyBusinessRules('createSubscription', params);
      
      // FIXED: Validate PIN format (4 digits for Zain Kuwait per official SLA Digital documentation)
      if (!/^\d{4}$/.test(params.pin)) {
        throw new UnifiedError('INVALID_PIN_FORMAT', 
          'Zain Kuwait requires 4-digit PIN per official SLA Digital documentation');
      }
      
      // Normalize MSISDN
      const msisdn = this.normalizeMSISDN(params.msisdn);
      
      // SLA v2.2 COMPLIANT: Prepare parameters for query string
      const payload = {
        msisdn,
        pin: params.pin,
        campaign: params.campaign,
        merchant: params.merchant,
        language: params.language || 'ar', // Default to Arabic for Kuwait
        operator_code: 'zain-kw',
        country_code: 'KW'
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
      
      // Add checkout URL if subscription requires user confirmation
      if (response.data && response.data.checkout_required) {
        response.data.checkout_url = `${this.getEndpoint('checkout')}/zain-kw/${response.data.uuid}`;
      }
      
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
        operator_code: 'zain-kw'
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
        operator_code: 'zain-kw'
      });
      
      return response;
    });
  }
  
  /**
   * Generate PIN with Zain Kuwait specific settings - SLA v2.2 COMPLIANT
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
        operator_code: 'zain-kw',
        country_code: 'KW'
        // NOTE: pin_length removed - SLA v2.2 handles this automatically per operator
      };
      
      // SLA v2.2 COMPLIANT: SLADigitalClient handles query string placement
      const response = await this.client.post('/v2.2/pin', payload);
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
        operator_code: 'zain-kw'
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
        operator_code: 'zain-kw'
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
        operator_code: 'zain-kw',
        country_code: 'KW'
      });
      
      return response;
    });
  }
  
  /**
   * Send SMS message (welcome, confirmation, etc.) - SLA v2.2 COMPLIANT
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
        language: 'ar',
        operator_code: 'zain-kw'
      });
      
      return response;
    });
  }
  
  /**
   * Map Zain Kuwait response data to unified format
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
      checkoutUrl: responseData.checkout_url,
      checkoutRequired: responseData.checkout_required || false,
      msisdn: responseData.msisdn,
      campaign: responseData.campaign,
      merchant: responseData.merchant,
      transactionId: responseData.transaction_id,
      eligible: responseData.eligible,
      eligibilityReason: responseData.eligibility_reason,
      operatorCode: 'zain-kw',
      countryCode: 'KW'
    };
  }
  
  /**
   * Map Zain Kuwait errors to unified format - Enhanced with specific error codes
   */
  mapError(error) {
    const errorMappings = {
      '2001': { code: 'INVALID_MSISDN', message: 'Invalid phone number format for Kuwait' },
      '2015': { code: 'INSUFFICIENT_FUNDS', message: 'Insufficient balance to complete transaction' },
      '2032': { code: 'WEEKLY_SUBSCRIPTION_LIMIT', message: 'Customer can subscribe only once per week' }, // Zain KW specific
      '4001': { code: 'INVALID_PIN', message: 'Invalid or expired 4-digit PIN' }, // FIXED: Updated to 4-digit
      '4002': { code: 'PIN_EXPIRED', message: 'PIN has expired, please request a new 4-digit PIN' }, // FIXED: Updated to 4-digit
      '1003': { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests, please try again later' },
      'SUB_EXISTS': { code: 'SUBSCRIPTION_EXISTS', message: 'Customer already has an active subscription' },
      'SUB_NOT_FOUND': { code: 'SUBSCRIPTION_NOT_FOUND', message: 'Subscription not found' },
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
        operatorCode: 'zain-kw'
      };
    }
    
    return {
      code: 'UNMAPPED_ERROR',
      message: error.message || 'Unknown error from Zain Kuwait',
      originalCode: errorCode,
      originalMessage: error.message,
      operatorCode: 'zain-kw'
    };
  }
  
  /**
   * Map Zain Kuwait status to unified status - CORRECTED with SDP mapping
   */
  mapStatus(operatorStatus) {
    const statusMappings = {
      // SDP-specific mappings for Zain Kuwait
      'SUCCESS': 'active',    // CORRECTED: SDP returns SUCCESS instead of CHARGED
      'CHARGED': 'active',    // Keep for backward compatibility
      'ACTIVE': 'active',
      'SUSPENDED': 'suspended', 
      'TRIAL': 'trial',
      'DELETED': 'cancelled',
      'REMOVED': 'cancelled',
      'GRACE': 'grace',
      'EXPIRED': 'expired'
    };
    
    return statusMappings[operatorStatus] || 'unknown';
  }
  
  /**
   * Override MSISDN normalization for Kuwait
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
    
    // Ensure it's 8 digits
    if (normalized.length === 8 && /^[569]/.test(normalized)) {
      return normalized;
    }
    
    throw new UnifiedError('INVALID_MSISDN', 
      'Invalid Kuwait mobile number format. Must be 8 digits starting with 5, 6, or 9');
  }
  
  /**
   * Apply Zain Kuwait specific business rules
   */
  applyBusinessRules(operation, params) {
    const baseParams = super.applyBusinessRules(operation, params);
    
    // Zain Kuwait specific weekly subscription limit
    if (operation === 'createSubscription') {
      // This would need to be checked at the service layer with database lookup
      // The adapter just defines the rule, enforcement happens in SubscriptionService
      Logger.info('Zain Kuwait weekly subscription limit will be enforced by service layer', {
        operatorCode: this.operatorCode,
        msisdn: params.msisdn ? this.maskMSISDN(params.msisdn) : 'unknown'
      });
    }
    
    return baseParams;
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

module.exports = ZainKuwaitAdapter;