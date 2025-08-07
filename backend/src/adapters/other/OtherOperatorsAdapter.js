/**
 * Other Operators Adapter - SLA v2.2 COMPLIANT
 * 
 * Implements SLA Digital integration for miscellaneous operators not covered by dedicated adapters.
 * Supports: 9mobile Nigeria, Axiata Dialog Sri Lanka, Movitel Mozambique, U Mobile Malaysia, O2 UK, EE UK
 * FIXED: Now fully SLA v2.2 compliant with query string parameters
 */

const BaseAdapter = require('../base/BaseAdapter');
const { UnifiedError } = require('../../utils/errors');
const Logger = require('../../utils/logger');

class OtherOperatorsAdapter extends BaseAdapter {
  constructor(config) {
    // Country-specific configurations
    const operatorConfigs = {
      'mobile-ng': {
        name: '9mobile Nigeria',
        country: 'Nigeria',
        countryCode: 'NG',
        currency: 'NGN',
        language: 'en',
        msisdnRegex: /^(\+234|234)?[789][01]\d{8}$/,
        checkoutOnly: true,
        autoRenewalSupported: true, // Special feature for 9mobile
        features: ['subscription', 'checkout', 'eligibility']
      },
      'axiata-lk': {
        name: 'Axiata Dialog Sri Lanka',
        country: 'Sri Lanka',
        countryCode: 'LK',
        currency: 'LKR',
        language: 'en',
        msisdnRegex: /^(\+94|94)?7[0-9]\d{7}$/,
        checkoutOnly: true,
        features: ['subscription', 'checkout', 'eligibility']
      },
      'viettel-mz': {
        name: 'Movitel Mozambique',
        country: 'Mozambique',
        countryCode: 'MZ',
        currency: 'MZN',
        language: 'pt',
        msisdnRegex: /^(\+258|258)?8[2-7]\d{7}$/,
        checkoutOnly: true,
        features: ['subscription', 'checkout', 'eligibility']
      },
      'umobile-my': {
        name: 'U Mobile Malaysia',
        country: 'Malaysia',
        countryCode: 'MY',
        currency: 'MYR',
        language: 'en',
        msisdnRegex: /^(\+60|60)?1[0-46-9]\d{7,8}$/,
        maxAmount: 300,
        monthlyLimit: 300,
        dailyLimit: 250,
        checkoutOnly: false,
        pinSupported: true,
        features: ['subscription', 'oneTimeCharge', 'checkout', 'pin', 'refund', 'eligibility']
      },
      'o2-uk': {
        name: 'O2 UK',
        country: 'United Kingdom',
        countryCode: 'GB',
        currency: 'GBP',
        language: 'en',
        msisdnRegex: /^(\+44|44)?7[0-9]\d{8}$/,
        maxAmount: 240,
        monthlyLimit: 240, // Aggregated across all services
        checkoutOnly: true,
        features: ['subscription', 'checkout', 'eligibility']
      },
      'ee-uk': {
        name: 'EE UK',
        country: 'United Kingdom',
        countryCode: 'GB',
        currency: 'GBP',
        language: 'en',
        msisdnRegex: /^(\+44|44)?7[0-9]\d{8}$/,
        maxAmount: 240,
        monthlyLimit: 240, // Aggregated across all services
        checkoutOnly: true,
        features: ['subscription', 'checkout', 'eligibility']
      }
    };
    
    const operatorCode = config.operatorCode;
    const operatorConfig = operatorConfigs[operatorCode];
    
    if (!operatorConfig) {
      throw new Error(`Unsupported operator: ${operatorCode}`);
    }
    
    super({
      ...config,
      operatorCode,
      msisdnRegex: operatorConfig.msisdnRegex,
      endpoints: {
        api: 'https://api.sla-alacrity.com',
        checkout: operatorCode.includes('uk') ? 'https://checkout.fonix.com' : 'https://checkout.sla-alacrity.com'
      },
      supportedFeatures: operatorConfig.features,
      businessRules: {
        createSubscription: {
          maxAmount: operatorConfig.maxAmount || 1000000, // Default high limit if not specified
          minAmount: 1,
          maxSubscriptionsPerMSISDN: 1
        },
        charge: {
          maxAmount: operatorConfig.maxAmount || 1000000,
          minAmount: 1,
          dailyLimit: operatorConfig.dailyLimit,
          monthlyLimit: operatorConfig.monthlyLimit
        }
      },
      operatorConfig
    });
  }
  
  /**
   * Create subscription with operator-specific logic - SLA v2.2 COMPLIANT
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
        language: params.language || this.config.operatorConfig.language,
        operator_code: this.operatorCode,
        country_code: this.config.operatorConfig.countryCode
      };
      
      // Add optional parameters
      if (params.trialDays) {
        payload.trial = params.trialDays;
      }
      
      if (params.skipInitialCharge) {
        payload.charge = 'false';
      }
      
      // Add PIN if using PIN flow (U Mobile Malaysia only)
      if (this.config.operatorConfig.pinSupported && params.pin) {
        if (!/^\d{4,6}$/.test(params.pin)) {
          throw new UnifiedError('INVALID_PIN_FORMAT', 
            `${this.config.operatorConfig.name} requires 4-6 digit PIN`);
        }
        payload.pin = params.pin;
      }
      
      // Add auto-renewal preference for 9mobile
      if (this.operatorCode === 'mobile-ng' && this.config.operatorConfig.autoRenewalSupported) {
        payload.auto_renewal = params.autoRenewal !== false; // Default to true
      }
      
      // SLA v2.2 COMPLIANT: SLADigitalClient handles query string placement automatically
      const response = await this.client.post('/v2.2/subscription/create', payload);
      
      // Add checkout URL for checkout-only operators
      if (this.config.operatorConfig.checkoutOnly && response.data) {
        if (this.operatorCode.includes('uk')) {
          response.data.checkout_url = `${this.getEndpoint('checkout')}/purchase?merchant=${params.merchant}&service=${params.campaign}`;
        } else {
          response.data.checkout_url = `${this.getEndpoint('checkout')}/purchase?merchant=${params.merchant}&service=${params.campaign}`;
        }
        response.data.checkout_required = true;
      }
      
      return response;
    });
  }
  
  /**
   * Generate PIN (U Mobile Malaysia only) - SLA v2.2 COMPLIANT
   */
  async generatePIN(msisdn, campaign) {
    if (!this.config.operatorConfig.pinSupported) {
      throw new UnifiedError('FEATURE_NOT_SUPPORTED', 
        `PIN generation not available for ${this.config.operatorConfig.name}`);
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
        language: this.config.operatorConfig.language,
        operator_code: this.operatorCode,
        country_code: this.config.operatorConfig.countryCode
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
   * Process one-time charge (U Mobile Malaysia only) - SLA v2.2 COMPLIANT
   */
  async charge(uuid, amount) {
    if (this.config.operatorConfig.checkoutOnly) {
      throw new UnifiedError('FEATURE_NOT_SUPPORTED', 
        `Direct charging not available for ${this.config.operatorConfig.name} - use checkout flow`);
    }
    
    return this.executeWithLogging('charge', { uuid, amount }, async () => {
      this.validateParams({ uuid, amount }, ['uuid', 'amount']);
      
      const validatedParams = this.applyBusinessRules('charge', { amount });
      
      // SLA v2.2 COMPLIANT: Parameters in query string via SLADigitalClient
      const response = await this.client.post('/v2.2/charge', {
        uuid,
        amount: validatedParams.amount,
        currency: this.config.operatorConfig.currency,
        operator_code: this.operatorCode
      });
      
      return response;
    });
  }
  
  /**
   * Process refund (U Mobile Malaysia only) - SLA v2.2 COMPLIANT
   */
  async refund(transactionId, amount) {
    if (this.config.operatorConfig.checkoutOnly) {
      throw new UnifiedError('FEATURE_NOT_SUPPORTED', 
        `Refunds not available for ${this.config.operatorConfig.name}`);
    }
    
    return this.executeWithLogging('refund', { transactionId, amount }, async () => {
      this.validateParams({ transactionId, amount }, ['transactionId', 'amount']);
      
      // SLA v2.2 COMPLIANT: Parameters in query string via SLADigitalClient
      const response = await this.client.post('/v2.2/refund', {
        transaction_id: transactionId,
        amount,
        currency: this.config.operatorConfig.currency,
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
        country_code: this.config.operatorConfig.countryCode
      });
      
      return response;
    });
  }
  
  /**
   * Map operator response data to unified format
   */
  mapResponseData(response) {
    // Handle the new response structure with data wrapper
    const responseData = response.data || response;
    
    const baseResponse = {
      subscriptionId: responseData.uuid,
      operatorSubscriptionId: responseData.uuid,
      status: this.mapStatus(responseData.status),
      amount: responseData.amount || responseData.charge_amount,
      currency: this.config.operatorConfig.currency,
      frequency: responseData.frequency || 'monthly',
      nextBillingDate: responseData.next_payment_timestamp,
      checkoutUrl: responseData.checkout_url,
      checkoutRequired: responseData.checkout_required || this.config.operatorConfig.checkoutOnly,
      msisdn: responseData.msisdn,
      campaign: responseData.campaign,
      merchant: responseData.merchant,
      transactionId: responseData.transaction_id,
      eligible: responseData.eligible,
      eligibilityReason: responseData.eligibility_reason,
      country: this.config.operatorConfig.country,
      operatorName: this.config.operatorConfig.name,
      operatorCode: this.operatorCode,
      countryCode: this.config.operatorConfig.countryCode
    };
    
    // Add auto-renewal information for 9mobile
    if (this.operatorCode === 'mobile-ng' && responseData.auto_renewal !== undefined) {
      baseResponse.autoRenewal = responseData.auto_renewal;
    }
    
    return baseResponse;
  }
  
  /**
   * Map operator errors to unified format
   */
  mapError(error) {
    const errorMappings = {
      '2001': { code: 'INVALID_MSISDN', message: `Invalid ${this.config.operatorConfig.country} mobile number` },
      '2015': { code: 'INSUFFICIENT_FUNDS', message: 'Insufficient balance' },
      '4001': { code: 'INVALID_PIN', message: 'Invalid PIN code' },
      '4002': { code: 'PIN_EXPIRED', message: 'PIN has expired' },
      '1003': { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests, please try again later' },
      'SUB_EXISTS': { code: 'SUBSCRIPTION_EXISTS', message: 'Subscription already exists' },
      'SUB_NOT_FOUND': { code: 'SUBSCRIPTION_NOT_FOUND', message: 'Subscription not found' },
      'INELIGIBLE': { code: 'CUSTOMER_INELIGIBLE', message: 'Customer is not eligible' },
      'DAILY_LIMIT': { code: 'DAILY_LIMIT_EXCEEDED', message: 'Daily spending limit exceeded' },
      'MONTHLY_LIMIT': { code: 'MONTHLY_LIMIT_EXCEEDED', message: 'Monthly spending limit exceeded' },
      'AUTH_FAILED': { code: 'AUTHENTICATION_FAILED', message: 'Authentication failed' },
      'BLACKLISTED': { code: 'CUSTOMER_BLACKLISTED', message: 'Customer is blacklisted' }
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
      message: error.message || `Unknown error from ${this.config.operatorConfig.name}`,
      originalCode: errorCode,
      originalMessage: error.message,
      operatorCode: this.operatorCode
    };
  }
  
  /**
   * Map operator status to unified status
   */
  mapStatus(operatorStatus) {
    const statusMappings = {
      'ACTIVE': 'active',
      'SUSPENDED': 'suspended',
      'TRIAL': 'trial',
      'DELETED': 'cancelled',
      'REMOVED': 'cancelled',
      'GRACE': 'grace',
      'EXPIRED': 'expired',
      'PENDING': 'pending'
    };
    
    return statusMappings[operatorStatus] || 'unknown';
  }
  
  /**
   * Operator-specific MSISDN normalization
   */
  normalizeMSISDN(msisdn) {
    let normalized = msisdn.replace(/[^\d+]/g, '');
    const config = this.config.operatorConfig;
    
    // Remove country codes based on operator
    const countryCodes = {
      'mobile-ng': ['+234', '234'],
      'axiata-lk': ['+94', '94'],
      'viettel-mz': ['+258', '258'],
      'umobile-my': ['+60', '60'],
      'o2-uk': ['+44', '44'],
      'ee-uk': ['+44', '44']
    };
    
    const codes = countryCodes[this.operatorCode] || [];
    for (const code of codes) {
      if (normalized.startsWith(code)) {
        normalized = normalized.substring(code.length);
        break;
      }
    }
    
    // Validate format
    if (!normalized.match(config.msisdnRegex.source.replace(/^\^|\$$/g, ''))) {
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

module.exports = OtherOperatorsAdapter;