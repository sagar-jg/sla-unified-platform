/**
 * U Mobile Malaysia Adapter
 * 
 * Implements SLA Digital API v2.2 for U Mobile Malaysia
 * Documentation: https://docs.sla-alacrity.com/docs/mobile-operators
 * 
 * FEATURES per SLA docs:
 * - MYR currency support (Malaysian Ringgit)
 * - English language support
 * - Checkout and API flows supported
 * - 300 MYR max charge
 * - Monthly limit: RM150-RM300 (rate plan dependent)
 * - Daily limit: RM250
 */

const BaseAdapter = require('../base/BaseAdapter');
const Logger = require('../../utils/logger');
const { UnifiedError } = require('../../utils/errors');

class UMobileAdapter extends BaseAdapter {
  constructor(config) {
    super({
      ...config,
      operatorCode: 'umobile-my',
      operatorName: 'U Mobile Malaysia',
      country: 'Malaysia',
      currency: 'MYR',
      supportedFeatures: [
        'subscription_create',
        'subscription_status', 
        'subscription_delete',
        'checkout',
        'pin_api',
        'webhooks',
        'refunds',
        'sms'
      ],
      businessRules: {
        createSubscription: {
          maxAmount: 300, // MYR max charge per docs
          dailyLimit: 250, // RM250 daily limit
          monthlyLimit: 300, // RM150-RM300 monthly limit (using max)
          supportedFrequencies: ['daily', 'weekly', 'monthly']
        }
      },
      msisdnNormalization: {
        countryCode: '+60',
        removeCountryCode: false,
        addPrefix: '60'
      }
    });
    
    Logger.info('U Mobile Malaysia adapter initialized', {
      operatorCode: this.operatorCode,
      features: this.config.supportedFeatures
    });
  }
  
  /**
   * Create subscription (supports both checkout and API flows)
   */
  async createSubscription(params) {
    this.validateParams(params, ['msisdn', 'campaign', 'merchant', 'amount']);
    
    // Apply business rules including limits
    const validatedParams = this.applyBusinessRules('createSubscription', params);
    
    const requestParams = {
      msisdn: this.normalizeMSISDN(params.msisdn),
      campaign: params.campaign,
      merchant: params.merchant,
      amount: params.amount.toString(),
      frequency: params.frequency || 'monthly',
      correlator: params.correlator || this.generateCorrelator()
    };
    
    // Add optional parameters
    if (params.trial) {
      requestParams.trial = params.trial;
    }
    
    if (params.pin) {
      requestParams.pin = params.pin;
    }
    
    return this.executeWithLogging('createSubscription', requestParams, async () => {
      const response = await this.client.createSubscription(requestParams);
      return this.normalizeResponse(response);
    });
  }
  
  /**
   * Cancel subscription
   */
  async cancelSubscription(uuid) {
    this.validateParams({ uuid }, ['uuid']);
    
    return this.executeWithLogging('cancelSubscription', { uuid }, async () => {
      const response = await this.client.deleteSubscription({ uuid });
      return this.normalizeResponse(response);
    });
  }
  
  /**
   * Get subscription status
   */
  async getSubscriptionStatus(uuid) {
    this.validateParams({ uuid }, ['uuid']);
    
    return this.executeWithLogging('getSubscriptionStatus', { uuid }, async () => {
      const response = await this.client.getSubscriptionStatus({ uuid });
      return this.normalizeResponse(response);
    });
  }
  
  /**
   * Generate PIN (supported by U Mobile)
   */
  async generatePIN(msisdn, campaign) {
    this.validateParams({ msisdn, campaign }, ['msisdn', 'campaign']);
    
    const requestParams = {
      msisdn: this.normalizeMSISDN(msisdn),
      campaign,
      template: 'subscription'
    };
    
    return this.executeWithLogging('generatePIN', requestParams, async () => {
      const response = await this.client.generatePIN(requestParams);
      return this.normalizeResponse(response);
    });
  }
  
  /**
   * One-time charge
   */
  async charge(uuid, amount) {
    this.validateParams({ uuid, amount }, ['uuid', 'amount']);
    
    // Check limits
    if (amount > 300) {
      throw new UnifiedError('AMOUNT_LIMIT_EXCEEDED', 
        'U Mobile Malaysia maximum charge is RM300');
    }
    
    return this.executeWithLogging('charge', { uuid, amount }, async () => {
      const response = await this.client.charge({ uuid, amount: amount.toString() });
      return this.normalizeResponse(response);
    });
  }
  
  /**
   * Refund transaction
   */
  async refund(transactionId, amount) {
    this.validateParams({ transactionId, amount }, ['transactionId', 'amount']);
    
    return this.executeWithLogging('refund', { transactionId, amount }, async () => {
      const response = await this.client.refund({ 
        transaction_id: transactionId, 
        amount: amount.toString() 
      });
      return this.normalizeResponse(response);
    });
  }
  
  /**
   * Check eligibility
   */
  async checkEligibility(msisdn) {
    this.validateParams({ msisdn }, ['msisdn']);
    
    const normalizedMSISDN = this.normalizeMSISDN(msisdn);
    
    // Malaysian number validation (starts with +60 or 60)
    if (!normalizedMSISDN.startsWith('60')) {
      throw new UnifiedError('INVALID_MSISDN', 
        'U Mobile requires Malaysian phone numbers starting with 60');
    }
    
    // For now, return eligible (actual eligibility would require API call)
    return {
      success: true,
      data: {
        eligible: true,
        msisdn: normalizedMSISDN,
        operator: 'U Mobile Malaysia',
        currency: 'MYR',
        limits: {
          maxAmount: 300,
          dailyLimit: 250,
          monthlyLimit: 300
        }
      }
    };
  }
  
  /**
   * Send SMS
   */
  async sendSMS(params) {
    this.validateParams(params, ['msisdn', 'message']);
    
    const requestParams = {
      msisdn: this.normalizeMSISDN(params.msisdn),
      message: params.message,
      correlator: params.correlator || this.generateCorrelator()
    };
    
    return this.executeWithLogging('sendSMS', requestParams, async () => {
      const response = await this.client.sendSMS(requestParams);
      return this.normalizeResponse(response);
    });
  }
  
  /**
   * Map operator response data to unified format
   */
  mapResponseData(response) {
    if (!response || !response.success) {
      return null;
    }
    
    const data = response.success;
    
    return {
      uuid: data.uuid,
      operatorCode: 'umobile-my',
      msisdn: data.msisdn,
      amount: data.amount,
      currency: data.currency || 'MYR',
      frequency: data.frequency,
      status: this.mapStatus(data.transaction?.status),
      nextPayment: data.next_payment_timestamp,
      transaction: data.transaction ? {
        id: data.transaction.transaction_id || data.transaction.bill_id,
        status: data.transaction.status,
        timestamp: data.transaction.timestamp,
        billId: data.transaction.bill_id
      } : null
    };
  }
  
  /**
   * Map operator error to unified format
   */
  mapError(error) {
    const errorMap = {
      'INSUFFICIENT_FUNDS': {
        code: 'INSUFFICIENT_FUNDS',
        message: 'Customer has insufficient account balance',
        userMessage: 'Please top up your account and try again'
      },
      'INVALID_MSISDN': {
        code: 'INVALID_MSISDN', 
        message: 'Invalid Malaysian phone number format',
        userMessage: 'Please enter a valid Malaysian phone number'
      },
      'SUBSCRIPTION_EXISTS': {
        code: 'SUBSCRIPTION_EXISTS',
        message: 'Customer already has an active subscription',
        userMessage: 'You already have an active subscription for this service'
      },
      'DAILY_LIMIT_EXCEEDED': {
        code: 'DAILY_LIMIT_EXCEEDED',
        message: 'Daily spending limit of RM250 exceeded',
        userMessage: 'You have reached your daily spending limit of RM250'
      },
      'MONTHLY_LIMIT_EXCEEDED': {
        code: 'MONTHLY_LIMIT_EXCEEDED',
        message: 'Monthly spending limit exceeded',
        userMessage: 'You have reached your monthly spending limit'
      },
      'AMOUNT_LIMIT_EXCEEDED': {
        code: 'AMOUNT_LIMIT_EXCEEDED',
        message: 'Maximum charge limit of RM300 exceeded',
        userMessage: 'Maximum charge amount is RM300'
      }
    };
    
    const errorCode = error.code || error.message || 'UNKNOWN_ERROR';
    const mappedError = errorMap[errorCode] || {
      code: 'OPERATOR_ERROR',
      message: error.message || 'Unknown operator error',
      userMessage: 'Service temporarily unavailable. Please try again later.'
    };
    
    return {
      ...mappedError,
      originalError: error
    };
  }
  
  /**
   * Map operator status to unified status
   */
  mapStatus(operatorStatus) {
    const statusMap = {
      'CHARGED': 'active',
      'SUCCESS': 'active', 
      'TRIAL': 'trial',
      'SUSPENDED': 'suspended',
      'DELETED': 'cancelled',
      'REMOVED': 'cancelled',
      'FAILED': 'failed',
      'INSUFFICIENT_FUNDS': 'suspended'
    };
    
    return statusMap[operatorStatus] || 'unknown';
  }
  
  /**
   * Normalize MSISDN for Malaysia
   */
  normalizeMSISDN(msisdn) {
    // Remove any non-digit characters except +
    let normalized = msisdn.replace(/[^\d+]/g, '');
    
    // Handle Malaysian country code
    if (normalized.startsWith('+60')) {
      normalized = normalized.substring(1); // Remove + but keep 60
    } else if (normalized.startsWith('0')) {
      normalized = '60' + normalized.substring(1); // Replace leading 0 with 60
    } else if (!normalized.startsWith('60')) {
      // If no country code, assume Malaysian local number
      normalized = '60' + normalized;
    }
    
    return normalized;
  }
  
  /**
   * Validate MSISDN for Malaysia
   */
  validateMSISDN(msisdn) {
    const normalized = this.normalizeMSISDN(msisdn);
    
    // Malaysian numbers: 60 + 8-9 digits = 10-11 digits total
    if (normalized.length < 10 || normalized.length > 11) {
      return false;
    }
    
    // Must start with 60 (Malaysia country code)
    if (!normalized.startsWith('60')) {
      return false;
    }
    
    return true;
  }
  
  /**
   * Generate correlation ID for requests
   */
  generateCorrelator() {
    return `umobile-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
  
  /**
   * Get checkout URL for U Mobile Malaysia
   */
  getCheckoutUrl(params) {
    const baseUrl = this.config.checkoutUrl || 'https://checkout.sla-alacrity.com';
    const queryParams = new URLSearchParams({
      merchant: params.merchant,
      service: params.campaign,
      redirect_url: params.redirectUrl,
      correlator: params.correlator || this.generateCorrelator(),
      msisdn: this.normalizeMSISDN(params.msisdn)
    });
    
    return `${baseUrl}?${queryParams.toString()}`;
  }
  
  /**
   * Apply business rules with U Mobile specific limits
   */
  applyBusinessRules(operation, params) {
    const baseParams = super.applyBusinessRules(operation, params);
    
    if (operation === 'createSubscription' && params.amount) {
      // Check U Mobile specific limits
      if (params.amount > 300) {
        throw new UnifiedError('AMOUNT_LIMIT_EXCEEDED', 
          'U Mobile Malaysia maximum charge is RM300');
      }
      
      // Note: Daily and monthly limits would require checking transaction history
      // This would be implemented in the service layer with database queries
    }
    
    return baseParams;
  }
}

module.exports = UMobileAdapter;