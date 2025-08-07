/**
 * Three Multi-Country Adapter - SLA v2.2 COMPLIANT
 * 
 * Implements SLA Digital integration for Three operators.
 * Supports: UK (GBP), Ireland (EUR)
 * FIXED: Now fully SLA v2.2 compliant with query string parameters
 */

const BaseAdapter = require('../base/BaseAdapter');
const { UnifiedError } = require('../../utils/errors');
const Logger = require('../../utils/logger');

class ThreeAdapter extends BaseAdapter {
  constructor(config) {
    // Country-specific configurations
    const countryConfigs = {
      'three-uk': {
        country: 'United Kingdom',
        currency: 'GBP',
        language: 'en',
        msisdnRegex: /^(\+44|44)?7[0-9]\d{8}$/,
        maxAmount: 240, // Monthly limit aggregated across all services
        checkoutOnly: true
      },
      'three-ie': {
        country: 'Ireland',
        currency: 'EUR',
        language: 'en',
        msisdnRegex: /^(\+353|353)?8[356789]\d{7}$/,
        maxAmount: 50,
        monthlyLimit: 150,
        checkoutOnly: true
      }
    };
    
    const operatorCode = config.operatorCode || 'three-uk';
    const countryConfig = countryConfigs[operatorCode];
    
    if (!countryConfig) {
      throw new Error(`Unsupported Three operator: ${operatorCode}`);
    }
    
    super({
      ...config,
      operatorCode,
      msisdnRegex: countryConfig.msisdnRegex,
      endpoints: {
        checkout: 'https://checkout.sla-alacrity.com',
        api: 'https://api.sla-alacrity.com'
      },
      supportedFeatures: ['subscription', 'checkout', 'refund', 'eligibility'],
      businessRules: {
        createSubscription: {
          maxAmount: countryConfig.maxAmount,
          minAmount: 1,
          maxSubscriptionsPerMSISDN: 1,
          subscriptionCooldown: 24 * 60 * 60 * 1000 // 1 day
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
   * Create subscription with Three country-specific logic - SLA v2.2 COMPLIANT
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
      
      // SLA v2.2 COMPLIANT: SLADigitalClient handles query string placement
      const response = await this.client.post('/v2.2/subscription/create', payload);
      
      // Add checkout URL
      if (response.data && (response.data.checkout_required || this.config.countryConfig.checkoutOnly)) {
        response.data.checkout_url = `${this.getEndpoint('checkout')}/${this.operatorCode}/${response.data.uuid}`;
        response.data.checkout_required = true;
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
   * Charge not supported - Three uses checkout flow only
   */
  async charge(uuid, amount) {
    throw new UnifiedError('FEATURE_NOT_SUPPORTED', 
      `Direct charging not available for Three ${this.config.countryConfig.country} - use checkout flow`);
  }
  
  /**
   * PIN generation not supported - Three uses checkout flow only
   */
  async generatePIN(msisdn, campaign) {
    throw new UnifiedError('FEATURE_NOT_SUPPORTED', 
      `PIN generation not available for Three ${this.config.countryConfig.country} - use checkout flow`);
  }
  
  /**
   * Get country code for current Three operator
   */
  getCountryCode() {
    const countryCodes = {
      'three-uk': 'GB',
      'three-ie': 'IE'
    };
    
    return countryCodes[this.operatorCode] || 'XX';
  }
  
  /**
   * Map Three response data to unified format
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
      checkoutRequired: responseData.checkout_required || true,
      msisdn: responseData.msisdn,
      campaign: responseData.campaign,
      merchant: responseData.merchant,
      transactionId: responseData.transaction_id,
      eligible: responseData.eligible,
      eligibilityReason: responseData.eligibility_reason,
      country: this.config.countryConfig.country,
      operatorCode: this.operatorCode
    };
  }
  
  /**
   * Map Three errors to unified format
   */
  mapError(error) {
    const errorMappings = {
      'INVALID_MSISDN': { code: 'INVALID_MSISDN', message: `Invalid ${this.config.countryConfig.country} mobile number` },
      'INSUFFICIENT_FUNDS': { code: 'INSUFFICIENT_FUNDS', message: 'Insufficient balance' },
      'MONTHLY_LIMIT': { code: 'MONTHLY_LIMIT_EXCEEDED', message: 'Monthly spending limit exceeded' },
      'AGGREGATED_LIMIT': { code: 'AGGREGATED_LIMIT_EXCEEDED', message: 'Monthly limit across all services exceeded' },
      'SUB_EXISTS': { code: 'SUBSCRIPTION_EXISTS', message: 'Subscription already exists' },
      'SUB_NOT_FOUND': { code: 'SUBSCRIPTION_NOT_FOUND', message: 'Subscription not found' },
      'INELIGIBLE': { code: 'CUSTOMER_INELIGIBLE', message: 'Customer is not eligible' },
      'CHECKOUT_REQUIRED': { code: 'CHECKOUT_REQUIRED', message: 'Customer must complete checkout process' },
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
      message: error.message || `Unknown error from Three ${this.config.countryConfig.country}`,
      originalCode: errorCode,
      originalMessage: error.message,
      operatorCode: this.operatorCode
    };
  }
  
  /**
   * Map Three status to unified status
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
    if (this.operatorCode === 'three-uk') {
      if (normalized.startsWith('+44')) {
        normalized = normalized.substring(3);
      } else if (normalized.startsWith('44')) {
        normalized = normalized.substring(2);
      }
    } else if (this.operatorCode === 'three-ie') {
      if (normalized.startsWith('+353')) {
        normalized = normalized.substring(4);
      } else if (normalized.startsWith('353')) {
        normalized = normalized.substring(3);
      }
    }
    
    // Validate format - handle regex properly
    const msisdnPattern = config.msisdnRegex.source.replace(/^\^\(.*?\)/, '^');
    const cleanRegex = new RegExp(msisdnPattern);
    
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

module.exports = ThreeAdapter;