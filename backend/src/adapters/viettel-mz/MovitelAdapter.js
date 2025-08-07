/**
 * Movitel Mozambique (Viettel) Adapter
 * 
 * Implements SLA Digital API v2.2 for Movitel Mozambique
 * Documentation: https://docs.sla-alacrity.com/docs/mobile-operators
 * 
 * FEATURES per SLA docs:
 * - MZN currency support (Mozambican Metical)
 * - Portuguese language support
 * - Checkout flow only
 * - Standard subscription management
 */

const BaseAdapter = require('../base/BaseAdapter');
const Logger = require('../../utils/logger');
const { UnifiedError } = require('../../utils/errors');

class MovitelAdapter extends BaseAdapter {
  constructor(config) {
    super({
      ...config,
      operatorCode: 'viettel-mz',
      operatorName: 'Movitel Mozambique',
      country: 'Mozambique',
      currency: 'MZN',
      language: 'Portuguese',
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
          maxAmount: 5000, // MZN
          supportedFrequencies: ['daily', 'weekly', 'monthly'],
          requiresCheckout: true // Checkout flow only per docs
        }
      },
      msisdnNormalization: {
        countryCode: '+258',
        removeCountryCode: false,
        addPrefix: '258'
      }
    });
    
    Logger.info('Movitel Mozambique adapter initialized', {
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
      'Movitel uses checkout flow only. PIN generation not supported.');
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
    
    // Mozambican number validation (starts with +258 or 258)
    if (!normalizedMSISDN.startsWith('258')) {
      throw new UnifiedError('INVALID_MSISDN', 
        'Movitel requires Mozambican phone numbers starting with 258');
    }
    
    // For now, return eligible (actual eligibility would require API call)
    return {
      success: true,
      data: {
        eligible: true,
        msisdn: normalizedMSISDN,
        operator: 'Movitel Mozambique',
        currency: 'MZN'
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
      operatorCode: 'viettel-mz',
      msisdn: data.msisdn,
      amount: data.amount,
      currency: data.currency || 'MZN',
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
        userMessage: 'Por favor, recarregue sua conta e tente novamente' // Portuguese
      },
      'INVALID_MSISDN': {
        code: 'INVALID_MSISDN', 
        message: 'Invalid Mozambican phone number format',
        userMessage: 'Por favor, insira um número de telefone moçambicano válido' // Portuguese
      },
      'SUBSCRIPTION_EXISTS': {
        code: 'SUBSCRIPTION_EXISTS',
        message: 'Customer already has an active subscription',
        userMessage: 'Você já tem uma assinatura ativa para este serviço' // Portuguese
      },
      'SERVICE_NOT_AVAILABLE': {
        code: 'SERVICE_NOT_AVAILABLE',
        message: 'Service not available in this region',
        userMessage: 'Serviço não disponível na sua região' // Portuguese
      }
    };
    
    const errorCode = error.code || error.message || 'UNKNOWN_ERROR';
    const mappedError = errorMap[errorCode] || {
      code: 'OPERATOR_ERROR',
      message: error.message || 'Unknown operator error',
      userMessage: 'Serviço temporariamente indisponível. Tente novamente mais tarde.' // Portuguese
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
   * Normalize MSISDN for Mozambique
   */
  normalizeMSISDN(msisdn) {
    // Remove any non-digit characters except +
    let normalized = msisdn.replace(/[^\d+]/g, '');
    
    // Handle Mozambican country code
    if (normalized.startsWith('+258')) {
      normalized = normalized.substring(1); // Remove + but keep 258
    } else if (normalized.startsWith('0')) {
      normalized = '258' + normalized.substring(1); // Replace leading 0 with 258
    } else if (!normalized.startsWith('258')) {
      // If no country code, assume Mozambican local number
      normalized = '258' + normalized;
    }
    
    return normalized;
  }
  
  /**
   * Validate MSISDN for Mozambique
   */
  validateMSISDN(msisdn) {
    const normalized = this.normalizeMSISDN(msisdn);
    
    // Mozambican numbers: 258 + 9 digits = 12 digits total
    if (normalized.length !== 12) {
      return false;
    }
    
    // Must start with 258 (Mozambique country code)
    if (!normalized.startsWith('258')) {
      return false;
    }
    
    return true;
  }
  
  /**
   * Generate correlation ID for requests
   */
  generateCorrelator() {
    return `movitel-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
  
  /**
   * Get checkout URL for Movitel
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

module.exports = MovitelAdapter;