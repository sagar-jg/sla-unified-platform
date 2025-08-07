/**
 * STC Kuwait Adapter - SLA v2.2 COMPLIANT
 * 
 * Implements SLA Digital integration specific to STC Kuwait operator.
 * Features: KWD currency, Arabic/English support, monthly limits
 * FIXED: Now fully SLA v2.2 compliant with query string parameters
 */

const BaseAdapter = require('../base/BaseAdapter');
const { UnifiedError } = require('../../utils/errors');
const Logger = require('../../utils/logger');

class STCKuwaitAdapter extends BaseAdapter {
  constructor(config) {
    super({
      ...config,
      operatorCode: 'stc-kw',
      msisdnRegex: /^(\+965|965)?[3]\d{7}$/, // Kuwait mobile numbers (STC prefix)
      endpoints: {
        checkout: 'https://checkout.sla-alacrity.com',
        api: 'https://api.sla-alacrity.com'
      },
      supportedFeatures: [
        'subscription',
        'oneTimeCharge',
        'checkout',
        'refund',
        'eligibility'
      ],
      businessRules: {
        createSubscription: {
          maxAmount: 20, // KWD
          minAmount: 0.1,
          maxSubscriptionsPerMSISDN: 1,
          subscriptionCooldown: 7 * 24 * 60 * 60 * 1000 // 1 week
        },
        charge: {
          maxAmount: 20, // KWD
          minAmount: 0.1,
          monthlyLimit: {
            postpaid: 20, // KD/month
            prepaid: 90   // KD/month
          }
        }
      }
    });
  }
  
  /**
   * Create subscription with STC Kuwait specific logic - SLA v2.2 COMPLIANT
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
        language: params.language || 'ar', // Default to Arabic
        customer_type: params.customerType || 'prepaid',
        operator_code: 'stc-kw',
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
        response.data.checkout_url = `${this.getEndpoint('checkout')}/stc-kw/${response.data.uuid}`;
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
        operator_code: 'stc-kw'
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
        operator_code: 'stc-kw'
      });
      
      return response;
    });
  }
  
  /**
   * Process one-time charge with customer type validation - SLA v2.2 COMPLIANT
   */
  async charge(uuid, amount, customerType = 'prepaid') {
    return this.executeWithLogging('charge', { uuid, amount, customerType }, async () => {
      this.validateParams({ uuid, amount }, ['uuid', 'amount']);
      
      // Apply customer type specific limits
      const limits = this.config.businessRules.charge.monthlyLimit;
      const maxAmount = limits[customerType] || limits.prepaid;
      
      if (amount > maxAmount) {
        throw new UnifiedError('AMOUNT_LIMIT_EXCEEDED', 
          `Amount ${amount} exceeds ${customerType} monthly limit of ${maxAmount} KWD`);
      }
      
      // SLA v2.2 COMPLIANT: Parameters in query string via SLADigitalClient
      const response = await this.client.post('/v2.2/charge', {
        uuid,
        amount,
        currency: 'KWD',
        customer_type: customerType,
        operator_code: 'stc-kw'
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
        operator_code: 'stc-kw'
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
        operator_code: 'stc-kw',
        country_code: 'KW'
      });
      
      return response;
    });
  }
  
  /**
   * Map STC Kuwait response data to unified format
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
      customerType: responseData.customer_type,
      operatorCode: 'stc-kw',
      countryCode: 'KW'
    };
  }
  
  /**
   * Map STC Kuwait errors to unified format
   */
  mapError(error) {
    const errorMappings = {
      '2001': { code: 'INVALID_MSISDN', message: 'Invalid Kuwait mobile number format (STC)' },
      '2015': { code: 'INSUFFICIENT_FUNDS', message: 'Insufficient balance' },
      '4001': { code: 'INVALID_PIN', message: 'Invalid PIN code' },
      '1003': { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests, please try again later' },
      'SUB_EXISTS': { code: 'SUBSCRIPTION_EXISTS', message: 'Customer already has an active subscription' },
      'SUB_NOT_FOUND': { code: 'SUBSCRIPTION_NOT_FOUND', message: 'Subscription not found' },
      'INELIGIBLE': { code: 'CUSTOMER_INELIGIBLE', message: 'Customer is not eligible' },
      'MONTHLY_LIMIT_EXCEEDED': { code: 'MONTHLY_LIMIT_EXCEEDED', message: 'Monthly spending limit exceeded' },
      'POSTPAID_LIMIT': { code: 'POSTPAID_LIMIT_EXCEEDED', message: 'Postpaid monthly limit of 20 KWD exceeded' },
      'PREPAID_LIMIT': { code: 'PREPAID_LIMIT_EXCEEDED', message: 'Prepaid monthly limit of 90 KWD exceeded' },
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
        operatorCode: 'stc-kw'
      };
    }
    
    return {
      code: 'UNMAPPED_ERROR',
      message: error.message || 'Unknown error from STC Kuwait',
      originalCode: errorCode,
      originalMessage: error.message,
      operatorCode: 'stc-kw'
    };
  }
  
  /**
   * Map STC Kuwait status to unified status
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
   * Override MSISDN normalization for STC Kuwait
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
    
    // Ensure it's 8 digits starting with 3 (STC prefix)
    if (normalized.length === 8 && normalized.startsWith('3')) {
      return normalized;
    }
    
    throw new UnifiedError('INVALID_MSISDN', 
      'Invalid STC Kuwait mobile number format. Must be 8 digits starting with 3');
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

module.exports = STCKuwaitAdapter;