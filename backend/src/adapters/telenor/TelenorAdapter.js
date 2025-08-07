/**
 * Telenor Multi-Country Adapter - SLA v2.2 COMPLIANT
 * 
 * Implements SLA Digital integration for multiple Telenor operators.
 * Supports: Denmark (DKK), Digi Malaysia (MYR), Myanmar (MMK), Norway (NOK), Sweden (SEK), Serbia (RSD)
 * FIXED: Now fully SLA v2.2 compliant with query string parameters
 * ENHANCED: ACR support for 48-character identifiers
 */

const BaseAdapter = require('../base/BaseAdapter');
const { UnifiedError } = require('../../utils/errors');
const Logger = require('../../utils/logger');

class TelenorAdapter extends BaseAdapter {
  constructor(config) {
    // Country-specific configurations
    const countryConfigs = {
      'telenor-dk': {
        country: 'Denmark',
        currency: 'DKK',
        language: 'da',
        msisdnRegex: /^(\+45|45)?[2-9]\d{7}$/,
        maxAmount: 5000,
        monthlyLimit: 2500,
        dailyLimit: 750,
        checkoutOnly: true,
        acrSupported: true // ACR support for Denmark
      },
      'telenor-digi': {
        country: 'Malaysia',
        currency: 'MYR',
        language: 'en',
        msisdnRegex: /^(\+60|60)?1[0-46-9]\d{7,8}$/,
        maxAmount: 100,
        monthlyLimit: 300,
        subscriptionLimit: 'one_per_week',
        checkoutOnly: false,
        pinSupported: true,
        acrSupported: true // ACR support for Malaysia
      },
      'telenor-mm': {
        country: 'Myanmar',
        currency: 'MMK',
        language: 'my',
        alternativeLanguage: 'en',
        msisdnRegex: /^(\+95|95)?9[0-9]\d{7,8}$/,
        maxAmount: 10000,
        checkoutOnly: true,
        acrSupported: true // ACR support for Myanmar
      },
      'telenor-no': {
        country: 'Norway',
        currency: 'NOK',
        language: 'no',
        msisdnRegex: /^(\+47|47)?[49]\d{7}$/,
        maxAmount: 5000,
        monthlyLimit: 5000,
        checkoutOnly: true,
        acrSupported: true, // ACR support for Norway
        moSmsSupported: true // MO SMS subscription support
      },
      'telenor-se': {
        country: 'Sweden',
        currency: 'SEK',
        language: 'sv',
        msisdnRegex: /^(\+46|46)?7[0-9]\d{7}$/,
        maxAmount: 5000,
        checkoutOnly: true,
        acrSupported: true // ACR support for Sweden
      },
      'telenor-rs': {
        country: 'Serbia',
        currency: 'RSD',
        language: 'sr',
        alternativeLanguage: 'en',
        msisdnRegex: /^(\+381|381)?6[0-9]\d{6,7}$/,
        maxAmount: 960,
        dailyLimit: 2400,
        monthlyLimit: 4800,
        checkoutOnly: true,
        acrSupported: true // ACR support for Serbia
      }
    };
    
    const operatorCode = config.operatorCode || 'telenor-dk';
    const countryConfig = countryConfigs[operatorCode];
    
    if (!countryConfig) {
      throw new Error(`Unsupported Telenor operator: ${operatorCode}`);
    }
    
    super({
      ...config,
      operatorCode,
      msisdnRegex: countryConfig.msisdnRegex,
      endpoints: {
        api: 'https://api.sla-alacrity.com',
        checkout: 'https://checkout.sla-alacrity.com'
      },
      supportedFeatures: [
        ...(countryConfig.checkoutOnly ? 
          ['subscription', 'checkout', 'eligibility'] :
          ['subscription', 'oneTimeCharge', 'checkout', 'pin', 'refund', 'eligibility']),
        ...(countryConfig.acrSupported ? ['acr'] : []),
        ...(countryConfig.moSmsSupported ? ['moSms'] : [])
      ],
      businessRules: {
        createSubscription: {
          maxAmount: countryConfig.maxAmount,
          minAmount: 1,
          maxSubscriptionsPerMSISDN: countryConfig.subscriptionLimit === 'one_per_week' ? 1 : null,
          subscriptionCooldown: countryConfig.subscriptionLimit === 'one_per_week' ? 7 * 24 * 60 * 60 * 1000 : null
        },
        charge: {
          maxAmount: countryConfig.maxAmount,
          minAmount: 1,
          dailyLimit: countryConfig.dailyLimit,
          monthlyLimit: countryConfig.monthlyLimit
        }
      },
      countryConfig
    });
  }
  
  /**
   * Parse ACR (Authentication Context Class Reference)
   * ACR is 48 characters where first 30 uniquely identify the customer
   */
  parseACR(acrString) {
    if (!acrString || typeof acrString !== 'string') {
      throw new UnifiedError('INVALID_ACR', 'ACR string is required and must be a string');
    }
    
    if (acrString.length !== 48) {
      throw new UnifiedError('INVALID_ACR_LENGTH', 
        `ACR must be exactly 48 characters, received ${acrString.length}`);
    }
    
    return {
      customerId: acrString.substring(0, 30), // First 30 chars uniquely identify customer
      variableSuffix: acrString.substring(30), // Last 18 can change
      fullACR: acrString
    };
  }
  
  /**
   * Normalize identifier - supports both MSISDN and ACR
   */
  normalizeIdentifier(identifier) {
    if (!identifier) {
      throw new UnifiedError('INVALID_IDENTIFIER', 'Identifier is required');
    }
    
    // Check if it's an ACR (48 characters)
    if (identifier.length === 48) {
      if (this.config.countryConfig.acrSupported) {
        const acr = this.parseACR(identifier);
        Logger.debug(`Using ACR for Telenor ${this.config.countryConfig.country}`, {
          customerId: acr.customerId,
          operatorCode: this.operatorCode
        });
        return acr.fullACR;
      } else {
        throw new UnifiedError('ACR_NOT_SUPPORTED', 
          `ACR not supported for Telenor ${this.config.countryConfig.country}`);
      }
    }
    
    // Otherwise treat as MSISDN
    return this.normalizeMSISDN(identifier);
  }
  
  /**
   * Create subscription with Telenor country-specific logic + ACR support - SLA v2.2 COMPLIANT
   */
  async createSubscription(params) {
    return this.executeWithLogging('createSubscription', params, async () => {
      // Support both msisdn and acr parameters
      const identifier = params.acr || params.msisdn;
      this.validateParams({ identifier, campaign: params.campaign, merchant: params.merchant }, 
        ['identifier', 'campaign', 'merchant']);
      
      const validatedParams = this.applyBusinessRules('createSubscription', params);
      const normalizedIdentifier = this.normalizeIdentifier(identifier);
      
      // SLA v2.2 COMPLIANT: Prepare parameters for query string
      const payload = {
        campaign: params.campaign,
        merchant: params.merchant,
        language: params.language || this.config.countryConfig.language,
        operator_code: this.operatorCode,
        country_code: this.getCountryCode()
      };
      
      // Add ACR or MSISDN based on what we're using
      if (identifier.length === 48) {
        payload.acr = normalizedIdentifier;
        // Correlator field is mandatory for Telenor when using ACR
        if (!params.correlator) {
          throw new UnifiedError('MISSING_CORRELATOR', 
            'Correlator field is mandatory for Telenor ACR transactions');
        }
        payload.correlator = params.correlator;
      } else {
        payload.msisdn = normalizedIdentifier;
      }
      
      // Add optional parameters
      if (params.trialDays) {
        payload.trial = params.trialDays;
      }
      
      if (params.skipInitialCharge) {
        payload.charge = 'false';
      }
      
      // Add PIN if using PIN flow (Digi Malaysia only)
      if (this.config.countryConfig.pinSupported && params.pin) {
        if (!/^\d{4,6}$/.test(params.pin)) {
          throw new UnifiedError('INVALID_PIN_FORMAT', 
            `Telenor ${this.config.countryConfig.country} requires 4-6 digit PIN`);
        }
        payload.pin = params.pin;
      }
      
      // SLA v2.2 COMPLIANT: SLADigitalClient handles query string placement
      const response = await this.client.post('/v2.2/subscription/create', payload);
      
      // Add checkout URL for checkout-only operators
      if (this.config.countryConfig.checkoutOnly && response.data) {
        response.data.checkout_url = `${this.getEndpoint('checkout')}/telenor/${this.operatorCode}/${response.data.uuid}`;
        response.data.checkout_required = true;
      }
      
      return response;
    });
  }
  
  /**
   * Generate PIN (Digi Malaysia only) - SLA v2.2 COMPLIANT
   */
  async generatePIN(identifier, campaign) {
    if (!this.config.countryConfig.pinSupported) {
      throw new UnifiedError('FEATURE_NOT_SUPPORTED', 
        `PIN generation not available for Telenor ${this.config.countryConfig.country}`);
    }
    
    return this.executeWithLogging('generatePIN', { identifier, campaign }, async () => {
      this.validateParams({ identifier, campaign }, ['identifier', 'campaign']);
      
      const normalizedIdentifier = this.normalizeIdentifier(identifier);
      
      // SLA v2.2 COMPLIANT: Prepare parameters for query string
      const payload = {
        campaign,
        merchant: this.config.credentials.merchant,
        template: 'subscription',
        language: this.config.countryConfig.language,
        operator_code: this.operatorCode,
        country_code: this.getCountryCode()
      };
      
      // Add ACR or MSISDN
      if (identifier.length === 48) {
        payload.acr = normalizedIdentifier;
      } else {
        payload.msisdn = normalizedIdentifier;
      }
      
      // SLA v2.2 COMPLIANT: SLADigitalClient handles query string placement
      const response = await this.client.post('/v2.2/pin', payload);
      return response;
    });
  }
  
  /**
   * Check customer eligibility - SLA v2.2 COMPLIANT
   */
  async checkEligibility(identifier) {
    return this.executeWithLogging('checkEligibility', { identifier }, async () => {
      this.validateParams({ identifier }, ['identifier']);
      
      const normalizedIdentifier = this.normalizeIdentifier(identifier);
      
      // SLA v2.2 COMPLIANT: Prepare parameters for query string
      const payload = {
        operator_code: this.operatorCode,
        country_code: this.getCountryCode()
      };
      
      // Add ACR or MSISDN
      if (identifier.length === 48) {
        payload.acr = normalizedIdentifier;
      } else {
        payload.msisdn = normalizedIdentifier;
      }
      
      // SLA v2.2 COMPLIANT: SLADigitalClient handles query string placement
      const response = await this.client.post('/v2.2/eligibility', payload);
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
   * Process one-time charge (Digi Malaysia only) - SLA v2.2 COMPLIANT
   */
  async charge(uuid, amount) {
    if (this.config.countryConfig.checkoutOnly) {
      throw new UnifiedError('FEATURE_NOT_SUPPORTED', 
        `Direct charging not available for Telenor ${this.config.countryConfig.country} - use checkout flow`);
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
   * Process refund (Digi Malaysia only) - SLA v2.2 COMPLIANT
   */
  async refund(transactionId, amount) {
    if (this.config.countryConfig.checkoutOnly) {
      throw new UnifiedError('FEATURE_NOT_SUPPORTED', 
        `Refunds not available for Telenor ${this.config.countryConfig.country}`);
    }
    
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
   * Get country code for the current Telenor operator
   */
  getCountryCode() {
    const countryCodes = {
      'telenor-dk': 'DK',
      'telenor-digi': 'MY',
      'telenor-mm': 'MM',
      'telenor-no': 'NO',
      'telenor-se': 'SE',
      'telenor-rs': 'RS'
    };
    
    return countryCodes[this.operatorCode] || 'XX';
  }
  
  /**
   * Map Telenor response data to unified format - Enhanced with ACR data
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
      // Include both MSISDN and ACR if present
      msisdn: responseData.msisdn,
      acr: responseData.acr,
      customerId: responseData.acr ? this.parseACR(responseData.acr).customerId : null,
      campaign: responseData.campaign,
      merchant: responseData.merchant,
      transactionId: responseData.transaction_id,
      correlator: responseData.correlator, // Important for ACR transactions
      eligible: responseData.eligible,
      eligibilityReason: responseData.eligibility_reason,
      country: this.config.countryConfig.country,
      operatorCode: this.operatorCode,
      autoRenewal: responseData.auto_renewal !== false
    };
  }
  
  /**
   * Map Telenor errors to unified format - Enhanced with ACR errors
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
      'WEEKLY_LIMIT': { code: 'WEEKLY_SUBSCRIPTION_LIMIT', message: 'Weekly subscription limit reached' },
      'AUTH_FAILED': { code: 'AUTHENTICATION_FAILED', message: 'Authentication failed' },
      // ACR-specific errors
      'INVALID_ACR': { code: 'INVALID_ACR', message: 'Invalid ACR format' },
      'MISSING_CORRELATOR': { code: 'MISSING_CORRELATOR', message: 'Correlator field is mandatory for ACR transactions' },
      'ACR_NOT_SUPPORTED': { code: 'ACR_NOT_SUPPORTED', message: 'ACR not supported for this operator' }
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
      message: error.message || `Unknown error from Telenor ${this.config.countryConfig.country}`,
      originalCode: errorCode,
      originalMessage: error.message,
      operatorCode: this.operatorCode
    };
  }
  
  /**
   * Map Telenor status to unified status
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
      'telenor-dk': ['+45', '45'],
      'telenor-digi': ['+60', '60'],
      'telenor-mm': ['+95', '95'],
      'telenor-no': ['+47', '47'],
      'telenor-se': ['+46', '46'],
      'telenor-rs': ['+381', '381']
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
   * Mask identifier for logging privacy (works for both MSISDN and ACR)
   */
  maskIdentifier(identifier) {
    if (!identifier) return '***';
    
    if (identifier.length === 48) {
      // ACR: Show first 3 and last 3 characters
      return identifier.substring(0, 3) + '***' + identifier.substring(identifier.length - 3);
    } else if (identifier.length >= 6) {
      // MSISDN: Show first 3 and last 2 characters
      return identifier.substring(0, 3) + '***' + identifier.substring(identifier.length - 2);
    }
    
    return '***';
  }
}

module.exports = TelenorAdapter;