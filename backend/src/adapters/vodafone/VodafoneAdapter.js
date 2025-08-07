/**
 * Vodafone Multi-Country Adapter - SLA v2.2 COMPLIANT
 * 
 * Implements SLA Digital integration for Vodafone operators.
 * Supports: UK (GBP), Ireland (EUR)
 * FIXED: Now fully SLA v2.2 compliant with query string parameters
 * ENHANCED: UK unified flow with Fonix endpoint
 */

const BaseAdapter = require('../base/BaseAdapter');
const { UnifiedError } = require('../../utils/errors');
const Logger = require('../../utils/logger');

class VodafoneAdapter extends BaseAdapter {
  constructor(config) {
    // Country-specific configurations
    const countryConfigs = {
      'voda-uk': {
        country: 'United Kingdom',
        currency: 'GBP',
        language: 'en',
        msisdnRegex: /^(\+44|44)?7[0-9]\d{8}$/,
        maxAmount: 240, // Monthly limit aggregated across all services
        checkoutOnly: true,
        // UK uses Fonix checkout for unified flow
        checkoutEndpoint: 'https://checkout.fonix.com',
        unifiedUKFlow: true // Single landing page for all UK operators
      },
      'vf-ie': {
        country: 'Ireland',
        currency: 'EUR',
        language: 'en',
        msisdnRegex: /^(\+353|353)?8[356789]\d{7}$/,
        maxAmount: 30,
        dailyLimit: 30,
        monthlyLimit: 60,
        pinSupported: true,
        moSmsSupported: true, // MO SMS subscription support
        checkoutEndpoint: 'https://checkout.sla-alacrity.com'
      }
    };
    
    const operatorCode = config.operatorCode || 'voda-uk';
    const countryConfig = countryConfigs[operatorCode];
    
    if (!countryConfig) {
      throw new Error(`Unsupported Vodafone operator: ${operatorCode}`);
    }
    
    super({
      ...config,
      operatorCode,
      msisdnRegex: countryConfig.msisdnRegex,
      endpoints: {
        api: 'https://api.sla-alacrity.com',
        checkout: countryConfig.checkoutEndpoint
      },
      supportedFeatures: [
        ...(countryConfig.checkoutOnly ? 
          ['subscription', 'checkout', 'eligibility'] :
          ['subscription', 'oneTimeCharge', 'checkout', 'pin', 'refund', 'eligibility']),
        ...(countryConfig.moSmsSupported ? ['moSms'] : [])
      ],
      businessRules: {
        createSubscription: {
          maxAmount: countryConfig.maxAmount,
          minAmount: 1,
          maxSubscriptionsPerMSISDN: 2,
          subscriptionCooldown: 24 * 60 * 60 * 1000 // 1 day
        },
        charge: {
          maxAmount: countryConfig.maxAmount,
          minAmount: 1,
          monthlyLimit: countryConfig.monthlyLimit,
          dailyLimit: countryConfig.dailyLimit
        }
      },
      countryConfig
    });
  }
  
  /**
   * Create subscription with Vodafone country-specific logic - SLA v2.2 COMPLIANT
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
        language: this.config.countryConfig.language,
        operator_code: this.operatorCode,
        country_code: this.getCountryCode()
      };
      
      // Add optional parameters
      if (params.trialDays) {
        payload.trial = params.trialDays;
      }
      
      if (params.skipInitialCharge) {
        payload.charge = 'false';
      }
      
      // Add PIN if using PIN flow (Ireland only)
      if (this.config.countryConfig.pinSupported && params.pin) {
        if (!/^\d{4}$/.test(params.pin)) {
          throw new UnifiedError('INVALID_PIN_FORMAT', 
            'Vodafone requires 4-digit PIN');
        }
        payload.pin = params.pin;
      }
      
      // SLA v2.2 COMPLIANT: SLADigitalClient handles query string placement
      const response = await this.client.post('/v2.2/subscription/create', payload);
      
      // Add checkout URL with correct endpoint
      if (response.data && (response.data.checkout_required || this.config.countryConfig.checkoutOnly)) {
        if (this.config.countryConfig.unifiedUKFlow) {
          // UK unified flow - single service ID handles all operators
          response.data.checkout_url = `${this.getEndpoint('checkout')}/uk/${response.data.uuid}`;
        } else {
          response.data.checkout_url = `${this.getEndpoint('checkout')}/vodafone/${this.operatorCode}/${response.data.uuid}`;
        }
        response.data.checkout_required = true;
      }
      
      return response;
    });
  }
  
  /**
   * Generate PIN (Ireland only) - SLA v2.2 COMPLIANT
   */
  async generatePIN(msisdn, campaign) {
    if (!this.config.countryConfig.pinSupported) {
      throw new UnifiedError('FEATURE_NOT_SUPPORTED', 
        `PIN generation not available for Vodafone ${this.config.countryConfig.country}`);
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
        language: 'en',
        operator_code: this.operatorCode,
        country_code: this.getCountryCode()
      };
      
      // SLA v2.2 COMPLIANT: SLADigitalClient handles query string placement
      const response = await this.client.post('/v2.2/pin', payload);
      return response;
    });
  }
  
  /**
   * Send SMS message (Ireland only) - SLA v2.2 COMPLIANT
   */
  async sendSMS(msisdn, message, template = 'welcome') {
    if (!this.config.countryConfig.moSmsSupported) {
      throw new UnifiedError('FEATURE_NOT_SUPPORTED', 
        `SMS not supported for Vodafone ${this.config.countryConfig.country}`);
    }
    
    return this.executeWithLogging('sendSMS', { msisdn, template }, async () => {
      this.validateParams({ msisdn, message }, ['msisdn', 'message']);
      
      const normalizedMSISDN = this.normalizeMSISDN(msisdn);
      
      // SLA v2.2 COMPLIANT: Parameters in query string via SLADigitalClient
      const response = await this.client.post('/v2.2/sms', {
        msisdn: normalizedMSISDN,
        message,
        template,
        language: 'en',
        operator_code: this.operatorCode
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
   * Process one-time charge with daily/monthly limits - SLA v2.2 COMPLIANT
   */
  async charge(uuid, amount) {
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
        country_code: this.getCountryCode()
      });
      
      return response;
    });
  }
  
  /**
   * Get country code for current Vodafone operator
   */
  getCountryCode() {
    const countryCodes = {
      'voda-uk': 'GB',
      'vf-ie': 'IE'
    };
    
    return countryCodes[this.operatorCode] || 'XX';
  }
  
  /**
   * Map Vodafone response data to unified format
   */
  mapResponseData(response) {
    // Handle the new response structure with data wrapper
    const responseData = response.data || response;
    
    return {
      subscriptionId: responseData.uuid,
      operatorSubscriptionId: responseData.uuid,
      status: this.mapStatus(responseData.status),
      amount: responseData.amount,
      currency: this.config.countryConfig.currency,
      frequency: responseData.frequency || 'monthly',
      nextBillingDate: responseData.next_payment_timestamp,
      checkoutUrl: responseData.checkout_url,
      checkoutRequired: responseData.checkout_required || this.config.countryConfig.checkoutOnly,
      msisdn: responseData.msisdn,
      campaign: responseData.campaign,
      merchant: responseData.merchant,
      transactionId: responseData.transaction_id,
      eligible: responseData.eligible,
      eligibilityReason: responseData.eligibility_reason,
      country: this.config.countryConfig.country,
      operatorCode: this.operatorCode,
      unifiedFlow: this.config.countryConfig.unifiedUKFlow || false
    };
  }
  
  /**
   * Map Vodafone errors to unified format
   */
  mapError(error) {
    const errorMappings = {
      '2001': { code: 'INVALID_MSISDN', message: `Invalid ${this.config.countryConfig.country} mobile number` },
      '2015': { code: 'INSUFFICIENT_FUNDS', message: 'Insufficient balance' },
      '4001': { code: 'INVALID_PIN', message: 'Invalid PIN code' },
      '4002': { code: 'PIN_EXPIRED', message: 'PIN has expired' },
      'SUB_EXISTS': { code: 'SUBSCRIPTION_EXISTS', message: 'Subscription already exists' },
      'SUB_NOT_FOUND': { code: 'SUBSCRIPTION_NOT_FOUND', message: 'Subscription not found' },
      'INELIGIBLE': { code: 'CUSTOMER_INELIGIBLE', message: 'Customer is not eligible' },
      'DAILY_LIMIT': { code: 'DAILY_LIMIT_EXCEEDED', message: 'Daily spending limit exceeded' },
      'MONTHLY_LIMIT': { code: 'MONTHLY_LIMIT_EXCEEDED', message: 'Monthly spending limit exceeded' },
      'AGGREGATED_LIMIT': { code: 'AGGREGATED_LIMIT_EXCEEDED', message: '£240 monthly limit across all services exceeded' },
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
      message: error.message || `Unknown error from Vodafone ${this.config.countryConfig.country}`,
      originalCode: errorCode,
      originalMessage: error.message,
      operatorCode: this.operatorCode
    };
  }
  
  /**
   * Map Vodafone status to unified status
   */
  mapStatus(operatorStatus) {
    const statusMappings = {
      'ACTIVE': 'active',
      'SUSPENDED': 'suspended',
      'CANCELLED': 'cancelled',
      'TRIAL': 'trial',
      'EXPIRED': 'expired',
      'GRACE': 'grace'
    };
    
    return statusMappings[operatorStatus] || 'unknown';
  }
  
  /**
   * Country-specific MSISDN normalization
   */
  normalizeMSISDN(msisdn) {
    let normalized = msisdn.replace(/[^\d+]/g, '');
    const config = this.config.countryConfig;
    
    // Remove country codes
    if (this.operatorCode === 'voda-uk') {
      if (normalized.startsWith('+44')) {
        normalized = normalized.substring(3);
      } else if (normalized.startsWith('44')) {
        normalized = normalized.substring(2);
      }
    } else if (this.operatorCode === 'vf-ie') {
      if (normalized.startsWith('+353')) {
        normalized = normalized.substring(4);
      } else if (normalized.startsWith('353')) {
        normalized = normalized.substring(3);
      }
    }
    
    // Validate format - create a clean regex without the country code part
    const cleanRegex = new RegExp(config.msisdnRegex.source.replace(/^\^.*?\)/, '^'));
    if (!cleanRegex.test(normalized)) {
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

module.exports = VodafoneAdapter;