/**
 * Axiata Dialog Sri Lanka Adapter
 * 
 * Implements SLA Digital API v2.2 for Axiata Dialog Sri Lanka
 * Documentation: https://docs.sla-alacrity.com/docs/mobile-operators
 * 
 * FEATURES per SLA docs:
 * - LKR currency support
 * - English language support
 * - Checkout flow only
 * - Standard subscription management
 */

const BaseAdapter = require('../base/BaseAdapter');
const Logger = require('../../utils/logger');
const { UnifiedError } = require('../../utils/errors');

class AxiataDialogAdapter extends BaseAdapter {
  constructor(config) {
    super({
      ...config,
      operatorCode: 'axiata-lk',
      operatorName: 'Axiata Dialog Sri Lanka',
      country: 'Sri Lanka',
      currency: 'LKR',
      supportedFeatures: [
        'subscription_create',
        'subscription_status', 
        'subscription_delete',
        'checkout',
        'webhooks',
        'refunds'
      ],
      businessRules: {
        createSubscription: {
          maxAmount: 5000, // LKR
          supportedFrequencies: ['daily', 'weekly', 'monthly'],
          requiresCheckout: true // Checkout flow only per docs
        }
      },
      msisdnNormalization: {
        countryCode: '+94',
        removeCountryCode: false,
        addPrefix: '94'
      }
    });
    
    Logger.info('Axiata Dialog Sri Lanka adapter initialized', {
      operatorCode: this.operatorCode,
      features: this.config.supportedFeatures
    });
  }
  
  /**
   * Create subscription via checkout flow
   */
  async createSubscription(params) {
    this.validateParams(params, ['msisdn', 'campaign', 'merchant', 'amount']);
    
    // Apply business rules
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
      'Axiata Dialog uses checkout flow only. PIN generation not supported.');
  }
  
  /**
   * One-time charge
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
   * Check eligibility
   */
  async checkEligibility(msisdn) {
    this.validateParams({ msisdn }, ['msisdn']);
    
    const normalizedMSISDN = this.normalizeMSISDN(msisdn);
    
    // Sri Lankan number validation (starts with +94 or 94)
    if (!normalizedMSISDN.startsWith('94')) {
      throw new UnifiedError('INVALID_MSISDN', 
        'Axiata Dialog requires Sri Lankan phone numbers starting with 94');
    }
    
    // For now, return eligible (actual eligibility would require API call)
    return {
      success: true,
      data: {
        eligible: true,
        msisdn: normalizedMSISDN,
        operator: 'Axiata Dialog Sri Lanka',
        currency: 'LKR'
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
      operatorCode: 'axiata-lk',
      msisdn: data.msisdn,
      amount: data.amount,
      currency: data.currency || 'LKR',
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
        message: 'Invalid Sri Lankan phone number format',
        userMessage: 'Please enter a valid Sri Lankan phone number'
      },
      'SUBSCRIPTION_EXISTS': {
        code: 'SUBSCRIPTION_EXISTS',
        message: 'Customer already has an active subscription',
        userMessage: 'You already have an active subscription for this service'
      },
      'SERVICE_NOT_AVAILABLE': {
        code: 'SERVICE_NOT_AVAILABLE',
        message: 'Service not available for this customer',
        userMessage: 'This service is not available for your account type'
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
   * Normalize MSISDN for Sri Lanka
   */
  normalizeMSISDN(msisdn) {
    // Remove any non-digit characters except +
    let normalized = msisdn.replace(/[^\d+]/g, '');
    
    // Handle Sri Lankan country code
    if (normalized.startsWith('+94')) {
      normalized = normalized.substring(1); // Remove + but keep 94
    } else if (normalized.startsWith('0')) {
      normalized = '94' + normalized.substring(1); // Replace leading 0 with 94
    } else if (!normalized.startsWith('94')) {
      // If no country code, assume Sri Lankan local number
      normalized = '94' + normalized;
    }
    
    return normalized;
  }
  
  /**
   * Validate MSISDN for Sri Lanka
   */
  validateMSISDN(msisdn) {
    const normalized = this.normalizeMSISDN(msisdn);
    
    // Sri Lankan numbers: 94 + 9 digits = 11 digits total
    if (normalized.length !== 11) {
      return false;
    }
    
    // Must start with 94 (Sri Lanka country code)
    if (!normalized.startsWith('94')) {
      return false;
    }
    
    return true;
  }
  
  /**
   * Generate correlation ID for requests
   */
  generateCorrelator() {
    return `dialog-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
  
  /**
   * Get checkout URL for Axiata Dialog
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
}

module.exports = AxiataDialogAdapter;