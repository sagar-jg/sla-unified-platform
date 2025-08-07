/**
 * Axiata Dialog Sri Lanka Adapter - SLA v2.2 COMPLIANT
 * 
 * Implements SLA Digital integration for Dialog Axiata Sri Lanka operator.
 * Features: LKR currency, English support, checkout flow
 */

const BaseAdapter = require('../base/BaseAdapter');
const { UnifiedError } = require('../../utils/errors');
const Logger = require('../../utils/logger');

class AxiataAdapter extends BaseAdapter {
  constructor(config) {
    super({
      ...config,
      operatorCode: 'axiata-lk', // ✅ CORRECT: Official SLA Digital code for Dialog Sri Lanka
      msisdnRegex: /^(\+94|94)?7[0-9]\d{7}$/, // Sri Lankan mobile numbers (7xxxxxxxx)
      endpoints: {
        checkout: 'https://api.sla-alacrity.com', // Standard checkout endpoint
        api: 'https://api.sla-alacrity.com'
      },
      supportedFeatures: [
        'subscription',
        'checkout', // ✅ CONFIRMED: Checkout flow per SLA docs
        'sms',
        'eligibility',
        'refund'
      ],
      businessRules: {
        createSubscription: {
          maxAmount: 5000, // LKR - Sri Lankan market limits
          minAmount: 10, // Minimum charge in LKR
          requiresCheckout: true, // ✅ Checkout flow required per docs
          supportedFrequencies: ['daily', 'weekly', 'monthly']
        },
        charge: {
          maxAmount: 5000, // LKR
          minAmount: 10,
          supportsCurrency: ['LKR']
        }
      },
      countryCode: 'LK',
      currency: 'LKR',
      timezone: 'Asia/Colombo',
      languages: ['en'] // English support per SLA docs
    });
  }
  
  /**
   * Create subscription with Dialog Sri Lanka logic - SLA v2.2 COMPLIANT
   * ✅ CHECKOUT FLOW: Dialog requires checkout flow per documentation
   */
  async createSubscription(params) {
    return this.executeWithLogging('createSubscription', params, async () => {
      // Validate required parameters
      this.validateParams(params, ['msisdn', 'campaign', 'merchant']);
      
      // Apply Dialog business rules
      const validatedParams = this.applyBusinessRules('createSubscription', params);
      
      // Normalize MSISDN for Sri Lanka
      const msisdn = this.normalizeMSISDN(params.msisdn);
      
      // SLA v2.2 COMPLIANT: Prepare parameters for query string
      const payload = {
        msisdn,
        campaign: params.campaign,
        merchant: params.merchant,
        language: params.language || 'en',
        currency: 'LKR',
        operator_code: 'axiata-lk', // ✅ CORRECT: Official operator code
        country_code: 'LK'
      };
      
      // Add optional parameters
      if (params.trialDays) {
        payload.trial = params.trialDays;
      }
      
      if (params.skipInitialCharge) {
        payload.charge = 'false';
      }
      
      // ✅ CHECKOUT FLOW: Dialog requires checkout flow per SLA docs
      if (!params.pin && !params.checkoutToken) {
        // Redirect to checkout for user consent
        const checkoutUrl = `${this.getEndpoint('checkout')}/purchase` +
          `?merchant=${params.merchant}&service=${params.campaign}` +
          `&redirect_url=${encodeURIComponent(params.redirectUrl || '')}&correlator=${params.correlator || ''}`;
        
        return {
          success: true,
          requiresCheckout: true,
          checkoutUrl,
          message: 'Customer needs to complete checkout flow for subscription'
        };
      }
      
      // SLA v2.2 COMPLIANT: SLADigitalClient handles query string placement automatically
      const response = await this.client.post('/v2.2/subscription/create', payload);
      
      Logger.info('Dialog Sri Lanka subscription created', {
        operatorCode: this.operatorCode,
        msisdn: this.maskMSISDN(msisdn),
        currency: 'LKR',
        campaign: params.campaign
      });
      
      return response;
    });
  }
  
  /**
   * Generate PIN - SLA v2.2 COMPLIANT (if PIN flow used)
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
        language: 'en', // English for Sri Lanka
        country_code: 'LK',
        operator_code: 'axiata-lk'
      };
      
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
      
      const response = await this.client.post('/v2.2/subscription/delete', {
        uuid,
        operator_code: 'axiata-lk'
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
      
      const response = await this.client.post('/v2.2/subscription/status', {
        uuid,
        operator_code: 'axiata-lk'
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
      
      const response = await this.client.post('/v2.2/refund', {
        transaction_id: transactionId,
        amount,
        currency: 'LKR',
        operator_code: 'axiata-lk'
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
      
      const response = await this.client.post('/v2.2/eligibility', {
        msisdn: normalizedMSISDN,
        operator_code: 'axiata-lk',
        country_code: 'LK'
      });
      
      return response;
    });
  }
  
  /**
   * Send SMS - SLA v2.2 COMPLIANT
   */
  async sendSMS(msisdn, message, template = 'welcome') {
    return this.executeWithLogging('sendSMS', { msisdn, template }, async () => {
      this.validateParams({ msisdn, message }, ['msisdn', 'message']);
      
      const normalizedMSISDN = this.normalizeMSISDN(msisdn);
      
      const response = await this.client.post('/v2.2/sms', {
        msisdn: normalizedMSISDN,
        message,
        template,
        language: 'en',
        operator_code: 'axiata-lk'
      });
      
      return response;
    });
  }
  
  /**
   * Map Dialog response data to unified format
   */
  mapResponseData(response) {
    const responseData = response.data || response;
    
    return {
      subscriptionId: responseData.uuid,
      operatorSubscriptionId: responseData.operator_subscription_id || responseData.uuid,
      status: this.mapStatus(responseData.status),
      amount: responseData.amount || responseData.charge_amount,
      currency: responseData.currency || 'LKR',
      frequency: responseData.frequency || 'monthly',
      nextBillingDate: responseData.next_payment_timestamp,
      msisdn: responseData.msisdn,
      campaign: responseData.campaign,
      merchant: responseData.merchant,
      transactionId: responseData.transaction_id,
      eligible: responseData.eligible,
      eligibilityReason: responseData.eligibility_reason,
      countryCode: 'LK',
      operatorCode: 'axiata-lk',
      checkoutUrl: responseData.checkout_url,
      checkoutRequired: responseData.checkout_required || false
    };
  }
  
  /**
   * Map Dialog errors to unified format
   */
  mapError(error) {
    const errorMappings = {
      '2001': { code: 'INVALID_MSISDN', message: 'Invalid Sri Lankan phone number format' },
      '2015': { code: 'INSUFFICIENT_FUNDS', message: 'Insufficient balance' },
      '4001': { code: 'INVALID_PIN', message: 'Invalid PIN code' },
      '4002': { code: 'PIN_EXPIRED', message: 'PIN has expired, please request a new one' },
      '1003': { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests, please try again later' },
      'SUB_EXISTS': { code: 'SUBSCRIPTION_EXISTS', message: 'Subscription already exists' },
      'SUB_NOT_FOUND': { code: 'SUBSCRIPTION_NOT_FOUND', message: 'Subscription not found' },
      'CHECKOUT_REQUIRED': { code: 'CHECKOUT_REQUIRED', message: 'Customer must complete checkout flow' },
      'CONSENT_REQUIRED': { code: 'CONSENT_REQUIRED', message: 'Customer consent required' },
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
        operatorCode: 'axiata-lk'
      };
    }
    
    return {
      code: 'UNMAPPED_ERROR',
      message: error.message || 'Unknown error from Dialog Sri Lanka',
      originalCode: errorCode,
      originalMessage: error.message,
      operatorCode: 'axiata-lk'
    };
  }
  
  /**
   * Map Dialog status to unified status
   */
  mapStatus(operatorStatus) {
    const statusMappings = {
      'CHARGED': 'active',
      'ACTIVE': 'active',
      'SUCCESS': 'active',
      'SUSPENDED': 'suspended',
      'TRIAL': 'trial',
      'DELETED': 'cancelled',
      'REMOVED': 'cancelled',
      'GRACE': 'grace',
      'EXPIRED': 'expired',
      'PENDING_CHECKOUT': 'pending_checkout' // Dialog specific - awaiting customer checkout
    };
    
    return statusMappings[operatorStatus] || 'unknown';
  }
  
  /**
   * Normalize MSISDN for Sri Lanka
   */
  normalizeMSISDN(msisdn) {
    // Remove any non-digit characters except +
    let normalized = msisdn.replace(/[^\d+]/g, '');
    
    // Remove Sri Lankan country code if present
    if (normalized.startsWith('+94')) {
      normalized = normalized.substring(3);
    } else if (normalized.startsWith('94')) {
      normalized = normalized.substring(2);
    }
    
    // Ensure it's 9 digits starting with 7
    if (normalized.length === 9 && normalized.startsWith('7')) {
      return normalized;
    }
    
    throw new UnifiedError('INVALID_MSISDN', 
      'Invalid Sri Lankan mobile number format. Must be 9 digits starting with 7');
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

module.exports = AxiataAdapter;