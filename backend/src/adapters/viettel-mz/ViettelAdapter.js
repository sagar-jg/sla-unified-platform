/**
 * Movitel Mozambique Adapter - SLA v2.2 COMPLIANT
 * 
 * Implements SLA Digital integration for Movitel (Viettel) Mozambique operator.
 * Features: MZN currency, Portuguese language, checkout flow
 */

const BaseAdapter = require('../base/BaseAdapter');
const { UnifiedError } = require('../../utils/errors');
const Logger = require('../../utils/logger');

class ViettelAdapter extends BaseAdapter {
  constructor(config) {
    super({
      ...config,
      operatorCode: 'viettel-mz', // ✅ CORRECT: Official SLA Digital code for Movitel Mozambique
      msisdnRegex: /^(\+258|258)?8[2-7]\d{7}$/, // Mozambican mobile numbers (8xxxxxxxx)
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
          maxAmount: 2000, // MZN - Mozambican market limits
          minAmount: 20, // Minimum charge in MZN
          requiresCheckout: true, // ✅ Checkout flow required per docs
          supportedFrequencies: ['daily', 'weekly', 'monthly']
        },
        charge: {
          maxAmount: 2000, // MZN
          minAmount: 20,
          supportsCurrency: ['MZN']
        }
      },
      countryCode: 'MZ',
      currency: 'MZN',
      timezone: 'Africa/Maputo',
      languages: ['pt'] // Portuguese support per SLA docs
    });
  }
  
  /**
   * Create subscription with Movitel Mozambique logic - SLA v2.2 COMPLIANT
   * ✅ CHECKOUT FLOW: Movitel requires checkout flow per documentation
   */
  async createSubscription(params) {
    return this.executeWithLogging('createSubscription', params, async () => {
      // Validate required parameters
      this.validateParams(params, ['msisdn', 'campaign', 'merchant']);
      
      // Apply Movitel business rules
      const validatedParams = this.applyBusinessRules('createSubscription', params);
      
      // Normalize MSISDN for Mozambique
      const msisdn = this.normalizeMSISDN(params.msisdn);
      
      // SLA v2.2 COMPLIANT: Prepare parameters for query string
      const payload = {
        msisdn,
        campaign: params.campaign,
        merchant: params.merchant,
        language: params.language || 'pt', // Default to Portuguese
        currency: 'MZN',
        operator_code: 'viettel-mz', // ✅ CORRECT: Official operator code
        country_code: 'MZ'
      };
      
      // Add optional parameters
      if (params.trialDays) {
        payload.trial = params.trialDays;
      }
      
      if (params.skipInitialCharge) {
        payload.charge = 'false';
      }
      
      // ✅ CHECKOUT FLOW: Movitel requires checkout flow per SLA docs
      if (!params.pin && !params.checkoutToken) {
        // Redirect to checkout for user consent
        const checkoutUrl = `${this.getEndpoint('checkout')}/purchase` +
          `?merchant=${params.merchant}&service=${params.campaign}` +
          `&redirect_url=${encodeURIComponent(params.redirectUrl || '')}&correlator=${params.correlator || ''}&lang=pt`;
        
        return {
          success: true,
          requiresCheckout: true,
          checkoutUrl,
          message: 'Customer needs to complete checkout flow for subscription (Portuguese)'
        };
      }
      
      // SLA v2.2 COMPLIANT: SLADigitalClient handles query string placement automatically
      const response = await this.client.post('/v2.2/subscription/create', payload);
      
      Logger.info('Movitel Mozambique subscription created', {
        operatorCode: this.operatorCode,
        msisdn: this.maskMSISDN(msisdn),
        currency: 'MZN',
        language: payload.language,
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
        language: 'pt', // Portuguese for Mozambique
        country_code: 'MZ',
        operator_code: 'viettel-mz'
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
        operator_code: 'viettel-mz'
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
        operator_code: 'viettel-mz'
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
        currency: 'MZN',
        operator_code: 'viettel-mz'
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
        operator_code: 'viettel-mz',
        country_code: 'MZ'
      });
      
      return response;
    });
  }
  
  /**
   * Send SMS with Portuguese language support - SLA v2.2 COMPLIANT
   */
  async sendSMS(msisdn, message, template = 'welcome') {
    return this.executeWithLogging('sendSMS', { msisdn, template }, async () => {
      this.validateParams({ msisdn, message }, ['msisdn', 'message']);
      
      const normalizedMSISDN = this.normalizeMSISDN(msisdn);
      
      const response = await this.client.post('/v2.2/sms', {
        msisdn: normalizedMSISDN,
        message,
        template,
        language: 'pt', // Portuguese for Mozambique
        operator_code: 'viettel-mz'
      });
      
      return response;
    });
  }
  
  /**
   * Map Movitel response data to unified format
   */
  mapResponseData(response) {
    const responseData = response.data || response;
    
    return {
      subscriptionId: responseData.uuid,
      operatorSubscriptionId: responseData.operator_subscription_id || responseData.uuid,
      status: this.mapStatus(responseData.status),
      amount: responseData.amount || responseData.charge_amount,
      currency: responseData.currency || 'MZN',
      frequency: responseData.frequency || 'monthly',
      nextBillingDate: responseData.next_payment_timestamp,
      msisdn: responseData.msisdn,
      campaign: responseData.campaign,
      merchant: responseData.merchant,
      transactionId: responseData.transaction_id,
      eligible: responseData.eligible,
      eligibilityReason: responseData.eligibility_reason,
      countryCode: 'MZ',
      operatorCode: 'viettel-mz',
      language: 'pt', // Portuguese language flag
      checkoutUrl: responseData.checkout_url,
      checkoutRequired: responseData.checkout_required || false
    };
  }
  
  /**
   * Map Movitel errors to unified format
   */
  mapError(error) {
    const errorMappings = {
      '2001': { code: 'INVALID_MSISDN', message: 'Invalid Mozambican phone number format' },
      '2015': { code: 'INSUFFICIENT_FUNDS', message: 'Insufficient balance' },
      '4001': { code: 'INVALID_PIN', message: 'Invalid PIN code' },
      '4002': { code: 'PIN_EXPIRED', message: 'PIN has expired, please request a new one' },
      '1003': { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests, please try again later' },
      'SUB_EXISTS': { code: 'SUBSCRIPTION_EXISTS', message: 'Subscription already exists' },
      'SUB_NOT_FOUND': { code: 'SUBSCRIPTION_NOT_FOUND', message: 'Subscription not found' },
      'CHECKOUT_REQUIRED': { code: 'CHECKOUT_REQUIRED', message: 'Customer must complete checkout flow' },
      'CONSENT_REQUIRED': { code: 'CONSENT_REQUIRED', message: 'Customer consent required' },
      'INELIGIBLE': { code: 'CUSTOMER_INELIGIBLE', message: 'Customer is not eligible for this service' },
      'LANGUAGE_NOT_SUPPORTED': { code: 'LANGUAGE_ERROR', message: 'Portuguese language required for Mozambique' }
    };
    
    const errorCode = error.code || error.category || 'UNKNOWN_ERROR';
    const mapping = errorMappings[errorCode];
    
    if (mapping) {
      return {
        code: mapping.code,
        message: mapping.message,
        originalCode: errorCode,
        originalMessage: error.message,
        operatorCode: 'viettel-mz'
      };
    }
    
    return {
      code: 'UNMAPPED_ERROR',
      message: error.message || 'Unknown error from Movitel Mozambique',
      originalCode: errorCode,
      originalMessage: error.message,
      operatorCode: 'viettel-mz'
    };
  }
  
  /**
   * Map Movitel status to unified status
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
      'PENDING_CHECKOUT': 'pending_checkout' // Movitel specific - awaiting customer checkout
    };
    
    return statusMappings[operatorStatus] || 'unknown';
  }
  
  /**
   * Normalize MSISDN for Mozambique
   */
  normalizeMSISDN(msisdn) {
    // Remove any non-digit characters except +
    let normalized = msisdn.replace(/[^\d+]/g, '');
    
    // Remove Mozambican country code if present
    if (normalized.startsWith('+258')) {
      normalized = normalized.substring(4);
    } else if (normalized.startsWith('258')) {
      normalized = normalized.substring(3);
    }
    
    // Ensure it's 9 digits starting with 8 (followed by 2-7)
    if (normalized.length === 9 && normalized.startsWith('8') && ['2','3','4','5','6','7'].includes(normalized[1])) {
      return normalized;
    }
    
    throw new UnifiedError('INVALID_MSISDN', 
      'Invalid Mozambican mobile number format. Must be 9 digits starting with 8 (82-87 range)');
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

module.exports = ViettelAdapter;