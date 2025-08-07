/**
 * Generic SLA Digital Adapter
 * 
 * Fallback adapter for operators not covered by specific adapters.
 * Implements basic SLA Digital API functionality with configurable parameters.
 */

const BaseAdapter = require('../base/BaseAdapter');
const { UnifiedError } = require('../../utils/errors');
const Logger = require('../../utils/logger');

class GenericSLAdapter extends BaseAdapter {
  constructor(config) {
    // Default configuration for generic operator
    const defaultConfig = {
      operatorCode: config.operatorCode || 'generic',
      msisdnRegex: config.msisdnRegex || /^\d{8,15}$/, // Generic international format
      endpoints: {
        api: 'https://api.sla-alacrity.com',
        checkout: 'https://checkout.sla-alacrity.com'
      },
      supportedFeatures: config.supportedFeatures || [
        'subscription', 
        'oneTimeCharge', 
        'checkout', 
        'pin', 
        'refund', 
        'eligibility'
      ],
      businessRules: {
        createSubscription: {
          maxAmount: config.maxAmount || 1000,
          minAmount: config.minAmount || 1,
          maxSubscriptionsPerMSISDN: config.maxSubscriptionsPerMSISDN || 5
        },
        charge: {
          maxAmount: config.maxChargeAmount || config.maxAmount || 1000,
          minAmount: config.minAmount || 1
        }
      },
      currency: config.currency || 'USD',
      language: config.language || 'en',
      pinLength: config.pinLength || 4
    };
    
    super({
      ...defaultConfig,
      ...config
    });
    
    Logger.info(`Initialized Generic SLA Adapter for operator ${this.operatorCode}`, {
      operatorCode: this.operatorCode,
      currency: this.config.currency,
      language: this.config.language,
      supportedFeatures: this.config.supportedFeatures
    });
  }
  
  /**
   * Create subscription with generic SLA Digital logic
   */
  async createSubscription(params) {
    return this.executeWithLogging('createSubscription', params, async () => {
      this.validateParams(params, ['msisdn', 'campaign', 'merchant']);
      
      const validatedParams = this.applyBusinessRules('createSubscription', params);
      const msisdn = this.normalizeMSISDN(params.msisdn);
      
      const payload = {
        msisdn,
        campaign: params.campaign,
        merchant: params.merchant,
        language: params.language || this.config.language,
        trial: params.trialDays || null,
        charge: params.skipInitialCharge ? 'false' : 'true'
      };
      
      // Add PIN if provided and PIN is supported
      if (this.isFeatureSupported('pin') && params.pin) {
        if (!this.validatePIN(params.pin)) {
          throw new UnifiedError('INVALID_PIN_FORMAT', 
            `Invalid PIN format. Expected ${this.config.pinLength} digits`);
        }
        payload.pin = params.pin;
      }
      
      const response = await this.client.post('/v2.2/subscription/create', payload);
      
      // Add checkout URL if checkout is supported
      if (this.isFeatureSupported('checkout') && (!params.pin || response.checkout_required)) {
        response.checkout_url = `${this.getEndpoint('checkout')}/purchase?merchant=${params.merchant}&service=${params.campaign}`;
        response.checkout_required = true;
      }
      
      return response;
    });
  }
  
  /**
   * Generate PIN (if supported)
   */
  async generatePIN(msisdn, campaign) {
    if (!this.isFeatureSupported('pin')) {
      throw new UnifiedError('FEATURE_NOT_SUPPORTED', 
        `PIN generation not supported for operator ${this.operatorCode}`);
    }
    
    return this.executeWithLogging('generatePIN', { msisdn, campaign }, async () => {
      this.validateParams({ msisdn, campaign }, ['msisdn', 'campaign']);
      
      const normalizedMSISDN = this.normalizeMSISDN(msisdn);
      
      const payload = {
        msisdn: normalizedMSISDN,
        campaign,
        merchant: this.config.credentials.merchant,
        template: 'subscription',
        language: this.config.language,
        pin_length: this.config.pinLength
      };
      
      const response = await this.client.post('/v2.2/pin', payload);
      return response;
    });
  }
  
  /**
   * Cancel subscription
   */
  async cancelSubscription(uuid) {
    return this.executeWithLogging('cancelSubscription', { uuid }, async () => {
      this.validateParams({ uuid }, ['uuid']);
      
      const response = await this.client.post('/v2.2/subscription/delete', {
        uuid
      });
      
      return response;
    });
  }
  
  /**
   * Get subscription status
   */
  async getSubscriptionStatus(uuid) {
    return this.executeWithLogging('getSubscriptionStatus', { uuid }, async () => {
      this.validateParams({ uuid }, ['uuid']);
      
      const response = await this.client.post('/v2.2/subscription/status', {
        uuid
      });
      
      return response;
    });
  }
  
  /**
   * Process one-time charge (if supported)
   */
  async charge(uuid, amount) {
    if (!this.isFeatureSupported('oneTimeCharge')) {
      throw new UnifiedError('FEATURE_NOT_SUPPORTED', 
        `Direct charging not supported for operator ${this.operatorCode}`);
    }
    
    return this.executeWithLogging('charge', { uuid, amount }, async () => {
      this.validateParams({ uuid, amount }, ['uuid', 'amount']);
      
      const validatedParams = this.applyBusinessRules('charge', { amount });
      
      const response = await this.client.post('/v2.2/charge', {
        uuid,
        amount: validatedParams.amount
      });
      
      return response;
    });
  }
  
  /**
   * Process refund (if supported)
   */
  async refund(transactionId, amount) {
    if (!this.isFeatureSupported('refund')) {
      throw new UnifiedError('FEATURE_NOT_SUPPORTED', 
        `Refunds not supported for operator ${this.operatorCode}`);
    }
    
    return this.executeWithLogging('refund', { transactionId, amount }, async () => {
      this.validateParams({ transactionId, amount }, ['transactionId', 'amount']);
      
      const response = await this.client.post('/v2.2/refund', {
        transaction_id: transactionId,
        amount
      });
      
      return response;
    });
  }
  
  /**
   * Check customer eligibility
   */
  async checkEligibility(msisdn) {
    return this.executeWithLogging('checkEligibility', { msisdn }, async () => {
      this.validateParams({ msisdn }, ['msisdn']);
      
      const normalizedMSISDN = this.normalizeMSISDN(msisdn);
      
      const response = await this.client.post('/v2.2/eligibility', {
        msisdn: normalizedMSISDN
      });
      
      return response;
    });
  }
  
  /**
   * Send SMS (if supported)
   */
  async sendSMS(msisdn, message, template = 'generic') {
    if (!this.isFeatureSupported('sms')) {
      throw new UnifiedError('FEATURE_NOT_SUPPORTED', 
        `SMS sending not supported for operator ${this.operatorCode}`);
    }
    
    return this.executeWithLogging('sendSMS', { msisdn, message, template }, async () => {
      this.validateParams({ msisdn, message }, ['msisdn', 'message']);
      
      const normalizedMSISDN = this.normalizeMSISDN(msisdn);
      
      const payload = {
        msisdn: normalizedMSISDN,
        message,
        template,
        language: this.config.language
      };
      
      const response = await this.client.post('/v2.2/sms', payload);
      return response;
    });
  }
  
  /**
   * Map generic response data to unified format
   */
  mapResponseData(response) {
    return {
      subscriptionId: response.uuid || response.subscription_id,
      operatorSubscriptionId: response.operator_subscription_id || response.uuid,
      status: this.mapStatus(response.status),
      amount: response.amount || response.charge_amount,
      currency: response.currency || this.config.currency,
      frequency: response.frequency || response.billing_frequency || 'monthly',
      nextBillingDate: response.next_payment_timestamp || response.next_billing_date,
      checkoutUrl: response.checkout_url,
      checkoutRequired: response.checkout_required || false,
      msisdn: response.msisdn,
      campaign: response.campaign || response.service_id,
      merchant: response.merchant || response.partner_id,
      transactionId: response.transaction_id || response.txn_id,
      eligible: response.eligible,
      eligibilityReason: response.eligibility_reason || response.ineligible_reason,
      operatorCode: this.operatorCode,
      pinRequired: response.pin_required || false,
      trialPeriod: response.trial_period,
      createdAt: response.created_at || response.timestamp,
      lastModified: response.last_modified || response.updated_at
    };
  }
  
  /**
   * Map generic errors to unified format
   */
  mapError(error) {
    const genericErrorMappings = {
      '1001': { code: 'UNAUTHORIZED', message: 'Unauthorized request' },
      '1002': { code: 'FORBIDDEN', message: 'Forbidden access' },
      '1003': { code: 'RATE_LIMIT_EXCEEDED', message: 'Rate limit exceeded' },
      '2001': { code: 'INVALID_MSISDN', message: 'Invalid mobile number format' },
      '2002': { code: 'INVALID_CAMPAIGN', message: 'Invalid campaign ID' },
      '2003': { code: 'INVALID_MERCHANT', message: 'Invalid merchant ID' },
      '2015': { code: 'INSUFFICIENT_FUNDS', message: 'Insufficient account balance' },
      '4001': { code: 'INVALID_PIN', message: 'Invalid PIN code' },
      '4002': { code: 'PIN_EXPIRED', message: 'PIN has expired' },
      '4003': { code: 'PIN_ATTEMPTS_EXCEEDED', message: 'Maximum PIN attempts exceeded' },
      'SUB_EXISTS': { code: 'SUBSCRIPTION_EXISTS', message: 'Active subscription already exists' },
      'SUB_NOT_FOUND': { code: 'SUBSCRIPTION_NOT_FOUND', message: 'Subscription not found' },
      'INELIGIBLE': { code: 'CUSTOMER_INELIGIBLE', message: 'Customer not eligible for service' },
      'BLACKLISTED': { code: 'CUSTOMER_BLACKLISTED', message: 'Customer is blacklisted' },
      'SERVICE_UNAVAILABLE': { code: 'SERVICE_UNAVAILABLE', message: 'Service temporarily unavailable' },
      'NETWORK_ERROR': { code: 'NETWORK_ERROR', message: 'Network connectivity error' },
      'TIMEOUT': { code: 'REQUEST_TIMEOUT', message: 'Request timed out' }
    };
    
    const errorCode = error.code || error.category || error.error_code || 'UNKNOWN_ERROR';
    const mapping = genericErrorMappings[errorCode];
    
    if (mapping) {
      return {
        code: mapping.code,
        message: mapping.message,
        originalCode: errorCode,
        originalMessage: error.message || error.description,
        operatorCode: this.operatorCode
      };
    }
    
    return {
      code: 'UNMAPPED_ERROR',
      message: error.message || error.description || 'Unknown error occurred',
      originalCode: errorCode,
      originalMessage: error.message || error.description,
      operatorCode: this.operatorCode
    };
  }
  
  /**
   * Map generic status to unified status
   */
  mapStatus(operatorStatus) {
    if (!operatorStatus) return 'unknown';
    
    const statusMappings = {
      'ACTIVE': 'active',
      'SUSPENDED': 'suspended',
      'PAUSED': 'suspended', 
      'TRIAL': 'trial',
      'DELETED': 'cancelled',
      'REMOVED': 'cancelled',
      'CANCELLED': 'cancelled',
      'GRACE': 'grace',
      'EXPIRED': 'expired',
      'PENDING': 'pending',
      'PROCESSING': 'processing',
      'FAILED': 'failed',
      'SUCCESS': 'active', // Some operators use SUCCESS instead of ACTIVE
      'CHARGED': 'active'
    };
    
    const normalizedStatus = operatorStatus.toString().toUpperCase();
    return statusMappings[normalizedStatus] || 'unknown';
  }
  
  /**
   * Generic MSISDN normalization
   */
  normalizeMSISDN(msisdn) {
    // Remove any non-digit characters except +
    let normalized = msisdn.replace(/[^\d+]/g, '');
    
    // Remove leading + if present
    if (normalized.startsWith('+')) {
      normalized = normalized.substring(1);
    }
    
    // Validate against configured regex
    if (!this.config.msisdnRegex.test(normalized)) {
      throw new UnifiedError('INVALID_MSISDN', 
        `Invalid mobile number format for operator ${this.operatorCode}`);
    }
    
    return normalized;
  }
  
  /**
   * Validate PIN format
   */
  validatePIN(pin) {
    if (!pin) return false;
    
    const pinRegex = new RegExp(`^\\d{${this.config.pinLength}}$`);
    return pinRegex.test(pin);
  }
  
  /**
   * Check if feature is supported
   */
  isFeatureSupported(feature) {
    return this.config.supportedFeatures.includes(feature);
  }
  
  /**
   * Get supported features list
   */
  getSupportedFeatures() {
    return [...this.config.supportedFeatures];
  }
  
  /**
   * Update operator configuration
   */
  updateConfiguration(newConfig) {
    Object.assign(this.config, newConfig);
    
    Logger.info(`Configuration updated for operator ${this.operatorCode}`, {
      operatorCode: this.operatorCode,
      updatedFields: Object.keys(newConfig)
    });
  }
}

module.exports = GenericSLAdapter;