/**
 * Zain Multi-Country Adapter - SLA v2.2 COMPLIANT
 * 
 * Implements SLA Digital integration for multiple Zain operators.
 * Supports: Bahrain (BHD), Iraq (IQD), Jordan (JOD), Sudan (SDG)
 * FIXED: Now fully SLA v2.2 compliant with query string parameters
 */

const BaseAdapter = require('../base/BaseAdapter');
const { UnifiedError } = require('../../utils/errors');
const Logger = require('../../utils/logger');

class ZainMultiAdapter extends BaseAdapter {
  constructor(config) {
    // Country-specific configurations
    const countryConfigs = {
      'zain-bh': {
        country: 'Bahrain',
        countryCode: 'BH',
        currency: 'BHD',
        language: 'ar',
        msisdnRegex: /^(\+973|973)?[36]\d{7}$/,
        maxAmount: 30,
        monthlyLimit: {
          postpaid: 30
        },
        pinSupported: true
      },
      'zain-iq': {
        country: 'Iraq',
        countryCode: 'IQ',
        currency: 'IQD',
        language: 'ar',
        msisdnRegex: /^(\+964|964)?7[89]\d{8}$/,
        maxAmount: 88000,
        monthlyLimit: 88000,
        checkoutOnly: true
      },
      'zain-jo': {
        country: 'Jordan',
        countryCode: 'JO',
        currency: 'JOD',
        language: 'ar',
        msisdnRegex: /^(\+962|962)?7[789]\d{7}$/,
        maxAmount: 30,
        pinSupported: true
      },
      'zain-sd': {
        country: 'Sudan',
        countryCode: 'SD',
        currency: 'SDG',
        language: 'ar',
        msisdnRegex: /^(\+249|249)?9[0-9]\d{7}$/,
        maxAmount: 30,
        checkoutOnly: true
      }
    };
    
    const operatorCode = config.operatorCode || 'zain-bh';
    const countryConfig = countryConfigs[operatorCode];
    
    if (!countryConfig) {
      throw new Error(`Unsupported Zain operator: ${operatorCode}`);
    }
    
    super({
      ...config,
      operatorCode,
      msisdnRegex: countryConfig.msisdnRegex,
      endpoints: {
        api: 'https://api.sla-alacrity.com'
      },
      supportedFeatures: countryConfig.checkoutOnly ? 
        ['subscription', 'checkout', 'eligibility'] :
        ['subscription', 'oneTimeCharge', 'checkout', 'pin', 'refund', 'eligibility'],
      businessRules: {
        createSubscription: {
          maxAmount: countryConfig.maxAmount,
          minAmount: 1,
          maxSubscriptionsPerMSISDN: 1,
          subscriptionCooldown: 7 * 24 * 60 * 60 * 1000 // 1 week
        },
        charge: {
          maxAmount: countryConfig.maxAmount,
          minAmount: 1,
          monthlyLimit: countryConfig.monthlyLimit
        }
      },
      countryConfig
    });
  }
  
  /**
   * Create subscription with Zain country-specific logic - SLA v2.2 COMPLIANT
   */
  async createSubscription(params) {
    return this.executeWithLogging('createSubscription', params, async () => {
      this.validateParams(params, ['msisdn', 'campaign', 'merchant']);
      
      const validatedParams = this.applyBusinessRules('createSubscription', params);
      const msisdn = this.normalizeMSISDN(params.msisdn);
      
      // SLA v2.2 COMPLIANT: Prepare parameters for query string
      const payload = {
        msisdn,
        campaign: params.campaign,
        merchant: params.merchant,
        language: params.language || this.config.countryConfig.language,
        operator_code: this.operatorCode,
        country_code: this.config.countryConfig.countryCode
      };
      
      // Add optional parameters
      if (params.trialDays) {
        payload.trial = params.trialDays;
      }
      
      if (params.skipInitialCharge) {
        payload.charge = 'false';
      }
      
      // Add PIN if using PIN flow (Bahrain and Jordan)
      if (this.config.countryConfig.pinSupported && params.pin) {
        if (!/^\d{4,5}$/.test(params.pin)) {
          throw new UnifiedError('INVALID_PIN_FORMAT', 
            `Zain ${this.config.countryConfig.country} requires 4-5 digit PIN`);
        }
        payload.pin = params.pin;
      }
      
      // SLA v2.2 COMPLIANT: SLADigitalClient handles query string placement automatically
      const response = await this.client.post('/v2.2/subscription/create', payload);
      
      return response;
    });
  }
  
  /**
   * Generate PIN (Bahrain and Jordan only) - SLA v2.2 COMPLIANT
   */
  async generatePIN(msisdn, campaign) {
    if (!this.config.countryConfig.pinSupported) {
      throw new UnifiedError('FEATURE_NOT_SUPPORTED', 
        `PIN generation not available for Zain ${this.config.countryConfig.country}`);
    }
    
    return this.executeWithLogging('generatePIN', { msisdn, campaign }, async () => {
      this.validateParams({ msisdn, campaign }, ['msisdn', 'campaign']);
      
      const normalizedMSISDN = this.normalizeMSISDN(msisdn);
      
      // SLA v2.2 COMPLIANT: Prepare parameters for query string
      const payload = {
        msisdn: normalizedMSISDN,
        campaign,
        merchant: this.config.credentials.merchant,
        template: 'subscription',
        language: this.config.countryConfig.language,
        operator_code: this.operatorCode,
        country_code: this.config.countryConfig.countryCode
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
        operator_code: this.operatorCode
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
        operator_code: this.operatorCode
      });
      
      return response;
    });
  }
  
  /**
   * Process one-time charge - SLA v2.2 COMPLIANT
   */
  async charge(uuid, amount) {
    if (this.config.countryConfig.checkoutOnly) {
      throw new UnifiedError('FEATURE_NOT_SUPPORTED', 
        `Direct charging not available for Zain ${this.config.countryConfig.country} - use checkout flow`);
    }
    
    return this.executeWithLogging('charge', { uuid, amount }, async () => {
      this.validateParams({ uuid, amount }, ['uuid', 'amount']);
      
      const validatedParams = this.applyBusinessRules('charge', { amount });
      
      // SLA v2.2 COMPLIANT: Parameters in query string via SLADigitalClient
      const response = await this.client.post('/v2.2/charge', {
        uuid,
        amount: validatedParams.amount,
        currency: this.config.countryConfig.currency,
        operator_code: this.operatorCode
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
        currency: this.config.countryConfig.currency,
        operator_code: this.operatorCode
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
        operator_code: this.operatorCode,
        country_code: this.config.countryConfig.countryCode
      });
      
      return response;
    });
  }
  
  /**
   * Map Zain response data to unified format
   */
  mapResponseData(response) {
    // Handle the new response structure with data wrapper
    const responseData = response.data || response;
    
    return {
      subscriptionId: responseData.uuid,
      operatorSubscriptionId: responseData.uuid,
      status: this.mapStatus(responseData.status),
      amount: responseData.amount || responseData.charge_amount,
      currency: this.config.countryConfig.currency,
      frequency: responseData.frequency || 'monthly',
      nextBillingDate: responseData.next_payment_timestamp,
      msisdn: responseData.msisdn,
      campaign: responseData.campaign,
      merchant: responseData.merchant,
      transactionId: responseData.transaction_id,
      eligible: responseData.eligible,
      eligibilityReason: responseData.eligibility_reason,
      country: this.config.countryConfig.country,
      operatorCode: this.operatorCode,
      countryCode: this.config.countryConfig.countryCode
    };
  }
  
  /**
   * Map Zain errors to unified format
   */
  mapError(error) {
    const errorMappings = {
      '2001': { code: 'INVALID_MSISDN', message: `Invalid ${this.config.countryConfig.country} mobile number` },
      '2015': { code: 'INSUFFICIENT_FUNDS', message: 'Insufficient balance' },
      '4001': { code: 'INVALID_PIN', message: 'Invalid PIN code' },
      '4002': { code: 'PIN_EXPIRED', message: 'PIN has expired' },
      '1003': { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests, please try again later' },
      'SUB_EXISTS': { code: 'SUBSCRIPTION_EXISTS', message: 'Subscription already exists' },
      'SUB_NOT_FOUND': { code: 'SUBSCRIPTION_NOT_FOUND', message: 'Subscription not found' },
      'INELIGIBLE': { code: 'CUSTOMER_INELIGIBLE', message: 'Customer is not eligible' },
      'MONTHLY_LIMIT': { code: 'MONTHLY_LIMIT_EXCEEDED', message: 'Monthly spending limit exceeded' },
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
        operatorCode: this.operatorCode
      };
    }
    
    return {
      code: 'UNMAPPED_ERROR',
      message: error.message || `Unknown error from Zain ${this.config.countryConfig.country}`,
      originalCode: errorCode,
      originalMessage: error.message,
      operatorCode: this.operatorCode
    };
  }
  
  /**
   * Map Zain status to unified status
   */
  mapStatus(operatorStatus) {
    const statusMappings = {
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
   * Country-specific MSISDN normalization
   */
  normalizeMSISDN(msisdn) {
    let normalized = msisdn.replace(/[^\d+]/g, '');
    const config = this.config.countryConfig;
    
    // Remove country codes based on operator
    const countryCodes = {
      'zain-bh': ['+973', '973'],
      'zain-iq': ['+964', '964'],
      'zain-jo': ['+962', '962'],
      'zain-sd': ['+249', '249']
    };
    
    const codes = countryCodes[this.operatorCode] || [];
    for (const code of codes) {
      if (normalized.startsWith(code)) {
        normalized = normalized.substring(code.length);
        break;
      }
    }
    
    // Validate format
    if (!config.msisdnRegex.test(normalized)) {
      throw new UnifiedError('INVALID_MSISDN', 
        `Invalid ${config.country} mobile number format`);
    }
    
    return normalized;
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

module.exports = ZainMultiAdapter;