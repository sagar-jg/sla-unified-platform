/**
 * 9mobile Nigeria Adapter
 * 
 * Implements SLA Digital API v2.2 for 9mobile Nigeria with auto-renewal parameter support
 * Documentation: https://docs.sla-alacrity.com/docs/9mobile-nigeria
 * 
 * SPECIAL FEATURES per SLA docs:
 * - auto-renewal parameter: user can select recurring or non-recurring subscription
 * - NGN currency support
 * - English language support  
 * - Checkout flow only
 */

const BaseAdapter = require('../base/BaseAdapter');
const Logger = require('../../utils/logger');
const { UnifiedError } = require('../../utils/errors');

class NineMobileNigeriaAdapter extends BaseAdapter {
  constructor(config) {
    super({
      ...config,
      operatorCode: 'mobile-ng',
      operatorName: '9mobile Nigeria',
      country: 'Nigeria',
      currency: 'NGN',
      supportedFeatures: [
        'subscription_create',
        'subscription_status', 
        'subscription_delete',
        'checkout',
        'webhooks',
        'auto_renewal_selection' // Special feature per SLA docs
      ],
      businessRules: {
        createSubscription: {
          maxAmount: 1000, // NGN
          supportedFrequencies: ['daily', 'weekly', 'monthly'],
          requiresCheckout: true // Checkout flow only per docs
        }
      }
    });
    
    Logger.info('9mobile Nigeria adapter initialized', {
      operatorCode: this.operatorCode,
      features: this.config.supportedFeatures
    });
  }
  
  /**
   * Create subscription with auto-renewal parameter support
   * Special feature: auto-renewal parameter as per SLA documentation
   */
  async createSubscription(params) {
    this.validateParams(params, ['msisdn', 'campaign', 'merchant', 'amount']);
    
    // Apply business rules
    const validatedParams = this.applyBusinessRules('createSubscription', params);
    
    // 9mobile special parameter: auto-renewal (per SLA docs)
    const requestParams = {
      msisdn: this.normalizeMSISDN(params.msisdn),
      campaign: params.campaign,
      merchant: params.merchant,
      amount: params.amount.toString(),
      frequency: params.frequency || 'monthly',
      correlator: params.correlator || this.generateCorrelator(),
      auto_renewal: params.autoRenewal !== false // Default to true unless explicitly set to false
    };
    
    // Add optional parameters
    if (params.trial) {
      requestParams.trial = params.trial;
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
   * Generate PIN (not supported - redirects to checkout)
   */
  async generatePIN(msisdn, campaign) {
    throw new UnifiedError('FEATURE_NOT_SUPPORTED', 
      '9mobile Nigeria uses checkout flow only. PIN generation not supported.');
  }
  
  /**
   * One-time charge (not typically used - checkout flow preferred)
   */
  async charge(uuid, amount) {
    this.validateParams({ uuid, amount }, ['uuid', 'amount']);
    
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
   * Check eligibility (basic check)
   */
  async checkEligibility(msisdn) {
    this.validateParams({ msisdn }, ['msisdn']);
    
    // Basic validation for 9mobile Nigeria
    const normalizedMSISDN = this.normalizeMSISDN(msisdn);
    
    // 9mobile Nigeria number validation (starts with +234)
    if (!normalizedMSISDN.startsWith('234')) {
      throw new UnifiedError('INVALID_MSISDN', 
        '9mobile Nigeria requires Nigerian phone numbers starting with 234');
    }
    
    // For now, return eligible (actual eligibility would require API call)
    return {
      success: true,
      data: {
        eligible: true,
        msisdn: normalizedMSISDN,
        operator: '9mobile Nigeria',
        currency: 'NGN'
      }
    };
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
      operatorCode: 'mobile-ng',
      msisdn: data.msisdn,
      amount: data.amount,
      currency: data.currency || 'NGN',
      frequency: data.frequency,
      status: this.mapStatus(data.transaction?.status),
      autoRenewal: data.auto_renewal, // Special 9mobile parameter
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
        message: 'Invalid Nigerian phone number format',
        userMessage: 'Please enter a valid Nigerian phone number'
      },
      'SUBSCRIPTION_EXISTS': {
        code: 'SUBSCRIPTION_EXISTS',
        message: 'Customer already has an active subscription',
        userMessage: 'You already have an active subscription for this service'
      },
      'RATE_LIMIT_EXCEEDED': {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many subscription attempts',
        userMessage: 'Please wait before trying again'
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
   * Normalize MSISDN for 9mobile Nigeria
   */
  normalizeMSISDN(msisdn) {
    // Remove any non-digit characters except +
    let normalized = msisdn.replace(/[^\d+]/g, '');
    
    // Handle Nigerian country code
    if (normalized.startsWith('+234')) {
      normalized = normalized.substring(1); // Remove + but keep 234
    } else if (normalized.startsWith('0')) {
      normalized = '234' + normalized.substring(1); // Replace leading 0 with 234
    } else if (!normalized.startsWith('234')) {
      // If no country code, assume Nigerian local number
      normalized = '234' + normalized;
    }
    
    return normalized;
  }
  
  /**
   * Validate MSISDN for 9mobile Nigeria
   */
  validateMSISDN(msisdn) {
    const normalized = this.normalizeMSISDN(msisdn);
    
    // Nigerian numbers: 234 + 10 digits = 13 digits total
    if (normalized.length !== 13) {
      return false;
    }
    
    // Must start with 234 (Nigeria country code)
    if (!normalized.startsWith('234')) {
      return false;
    }
    
    return true;
  }
  
  /**
   * Generate correlation ID for requests
   */
  generateCorrelator() {
    return `9mobile-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
  
  /**
   * Get checkout URL for 9mobile Nigeria
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
    
    // Add auto-renewal preference if specified
    if (params.autoRenewal !== undefined) {
      queryParams.append('auto_renewal', params.autoRenewal.toString());
    }
    
    return `${baseUrl}?${queryParams.toString()}`;
  }
}

module.exports = NineMobileNigeriaAdapter;