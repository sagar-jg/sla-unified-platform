/**
 * 9mobile Nigeria Adapter - SLA v2.2 COMPLIANT
 * 
 * Implements SLA Digital integration for 9mobile Nigeria operator.
 * FEATURE: auto-renewal parameter support per SLA Digital documentation
 * Features: NGN currency, English support, auto-renewal selection in consent pages
 */

const BaseAdapter = require('../base/BaseAdapter');
const { UnifiedError } = require('../../utils/errors');
const Logger = require('../../utils/logger');

class NineMobileAdapter extends BaseAdapter {
  constructor(config) {
    super({
      ...config,
      operatorCode: 'mobile-ng', // ✅ CORRECT: Official SLA Digital code for 9mobile Nigeria
      msisdnRegex: /^(\+234|234)?[789]\d{9}$/, // Nigerian mobile numbers
      endpoints: {
        checkout: 'https://api.sla-alacrity.com',
        api: 'https://api.sla-alacrity.com'
      },
      supportedFeatures: [
        'subscription',
        'checkout',
        'autoRenewalSelection', // ✅ UNIQUE: 9mobile specific auto-renewal feature per SLA docs
        'sms',
        'eligibility',
        'refund'
      ],
      businessRules: {
        createSubscription: {
          maxAmount: 10000, // NGN
          minAmount: 50,
          autoRenewalSupported: true, // ✅ FEATURE: auto-renewal parameter per docs
          requiresCheckout: true
        },
        charge: {
          maxAmount: 10000,
          minAmount: 50,
          supportsCurrency: ['NGN']
        }
      },
      countryCode: 'NG',
      currency: 'NGN',
      timezone: 'Africa/Lagos',
      languages: ['en']
    });
  }
  
  /**
   * Create subscription with 9mobile auto-renewal logic - SLA v2.2 COMPLIANT
   */
  async createSubscription(params) {
    return this.executeWithLogging('createSubscription', params, async () => {
      this.validateParams(params, ['msisdn', 'campaign', 'merchant']);
      
      const msisdn = this.normalizeMSISDN(params.msisdn);
      
      const payload = {
        msisdn,
        campaign: params.campaign,
        merchant: params.merchant,
        language: params.language || 'en',
        currency: 'NGN',
        operator_code: 'mobile-ng',
        country_code: 'NG'
      };
      
      // ✅ FEATURE: Add auto_renewal parameter per SLA docs
      if (params.autoRenewal !== undefined) {
        payload.auto_renewal = params.autoRenewal;
      }
      
      if (params.trialDays) {
        payload.trial = params.trialDays;
      }
      
      const response = await this.client.post('/v2.2/subscription/create', payload);
      
      Logger.info('9mobile subscription created with auto-renewal preference', {
        operatorCode: this.operatorCode,
        msisdn: this.maskMSISDN(msisdn),
        autoRenewal: payload.auto_renewal
      });
      
      return response;
    });
  }
  
  async generatePIN(msisdn, campaign) {
    return this.executeWithLogging('generatePIN', { msisdn, campaign }, async () => {
      this.validateParams({ msisdn, campaign }, ['msisdn', 'campaign']);
      
      const normalizedMSISDN = this.normalizeMSISDN(msisdn);
      
      const payload = {
        msisdn: normalizedMSISDN,
        campaign,
        merchant: this.config.credentials.merchant,
        template: 'subscription',
        language: 'en',
        country_code: 'NG',
        operator_code: 'mobile-ng'
      };
      
      const response = await this.client.post('/v2.2/pin', payload);
      return response;
    });
  }
  
  async cancelSubscription(uuid) {
    return this.executeWithLogging('cancelSubscription', { uuid }, async () => {
      this.validateParams({ uuid }, ['uuid']);
      
      const response = await this.client.post('/v2.2/subscription/delete', {
        uuid,
        operator_code: 'mobile-ng'
      });
      
      return response;
    });
  }
  
  async getSubscriptionStatus(uuid) {
    return this.executeWithLogging('getSubscriptionStatus', { uuid }, async () => {
      this.validateParams({ uuid }, ['uuid']);
      
      const response = await this.client.post('/v2.2/subscription/status', {
        uuid,
        operator_code: 'mobile-ng'
      });
      
      return response;
    });
  }
  
  async checkEligibility(msisdn) {
    return this.executeWithLogging('checkEligibility', { msisdn }, async () => {
      this.validateParams({ msisdn }, ['msisdn']);
      
      const normalizedMSISDN = this.normalizeMSISDN(msisdn);
      
      const response = await this.client.post('/v2.2/eligibility', {
        msisdn: normalizedMSISDN,
        operator_code: 'mobile-ng',
        country_code: 'NG'
      });
      
      return response;
    });
  }
  
  mapResponseData(response) {
    const responseData = response.data || response;
    
    return {
      subscriptionId: responseData.uuid,
      status: this.mapStatus(responseData.status),
      amount: responseData.amount,
      currency: responseData.currency || 'NGN',
      frequency: responseData.frequency || 'monthly',
      nextBillingDate: responseData.next_payment_timestamp,
      msisdn: responseData.msisdn,
      campaign: responseData.campaign,
      merchant: responseData.merchant,
      transactionId: responseData.transaction_id,
      autoRenewal: responseData.auto_renewal, // ✅ FEATURE: auto_renewal info
      countryCode: 'NG',
      operatorCode: 'mobile-ng'
    };
  }
  
  mapError(error) {
    const errorMappings = {
      '2001': { code: 'INVALID_MSISDN', message: 'Invalid Nigerian phone number format' },
      '2015': { code: 'INSUFFICIENT_FUNDS', message: 'Insufficient balance' },
      '4001': { code: 'INVALID_PIN', message: 'Invalid PIN code' },
      'INELIGIBLE': { code: 'CUSTOMER_INELIGIBLE', message: 'Customer not eligible' }
    };
    
    const errorCode = error.code || error.category || 'UNKNOWN_ERROR';
    const mapping = errorMappings[errorCode];
    
    if (mapping) {
      return {
        code: mapping.code,
        message: mapping.message,
        originalCode: errorCode,
        originalMessage: error.message,
        operatorCode: 'mobile-ng'
      };
    }
    
    return {
      code: 'UNMAPPED_ERROR',
      message: error.message || 'Unknown error from 9mobile Nigeria',
      operatorCode: 'mobile-ng'
    };
  }
  
  mapStatus(operatorStatus) {
    const statusMappings = {
      'CHARGED': 'active',
      'ACTIVE': 'active',
      'SUCCESS': 'active',
      'SUSPENDED': 'suspended',
      'TRIAL': 'trial',
      'DELETED': 'cancelled',
      'REMOVED': 'cancelled'
    };
    
    return statusMappings[operatorStatus] || 'unknown';
  }
  
  normalizeMSISDN(msisdn) {
    let normalized = msisdn.replace(/[^\d+]/g, '');
    
    if (normalized.startsWith('+234')) {
      normalized = normalized.substring(4);
    } else if (normalized.startsWith('234')) {
      normalized = normalized.substring(3);
    }
    
    if (normalized.length === 10 && ['7', '8', '9'].includes(normalized[0])) {
      return normalized;
    }
    
    throw new UnifiedError('INVALID_MSISDN', 
      'Invalid Nigerian mobile number format. Must be 10 digits starting with 7, 8, or 9');
  }
  
  maskMSISDN(msisdn) {
    if (msisdn && msisdn.length >= 6) {
      return msisdn.substring(0, 3) + '***' + msisdn.substring(msisdn.length - 2);
    }
    return '***';
  }
}

module.exports = NineMobileAdapter;