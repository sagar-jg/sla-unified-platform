/**
 * Zain KSA Adapter - SLA v2.2 COMPLIANT
 * 
 * Implements SLA Digital integration specific to Zain Saudi Arabia operator.
 * Features: SAR currency, Arabic/English support, SDP flow with specific requirements
 * FIXED: Now fully SLA v2.2 compliant with query string parameters
 */

const BaseAdapter = require('../base/BaseAdapter');
const { UnifiedError } = require('../../utils/errors');
const Logger = require('../../utils/logger');

class ZainKSAAdapter extends BaseAdapter {
  constructor(config) {
    super({
      ...config,
      operatorCode: 'zain-ksa',
      msisdnRegex: /^(\+966|966)?5[0-9]\d{7}$/, // Saudi mobile numbers
      endpoints: {
        // CORRECTED: Use special Zain checkout endpoint for KSA too
        checkout: 'https://msisdn.sla-alacrity.com',
        api: 'https://api.sla-alacrity.com'
      },
      supportedFeatures: [
        'subscription',
        'oneTimeCharge', 
        'pin', // PIN API with charge amount
        'checkout',
        'refund',
        'eligibility',
        'sdp' // SDP flow support
      ],
      businessRules: {
        createSubscription: {
          maxAmount: 30, // SAR
          minAmount: 1,
          maxSubscriptionsPerMSISDN: 1,
          subscriptionCooldown: 7 * 24 * 60 * 60 * 1000, // 1 week
          // Note: No recurring notifications for KSA per documentation
          noRecurringNotifications: true
        },
        charge: {
          maxAmount: 30, // SAR monthly limit
          minAmount: 1
        }
      }
    });
  }
  
  /**
   * Create subscription with Zain KSA specific logic - SLA v2.2 COMPLIANT
   */
  async createSubscription(params) {
    return this.executeWithLogging('createSubscription', params, async () => {
      // Validate required parameters
      this.validateParams(params, ['msisdn', 'campaign', 'merchant']);
      
      // Apply business rules
      const validatedParams = this.applyBusinessRules('createSubscription', params);
      
      // Normalize MSISDN
      const msisdn = this.normalizeMSISDN(params.msisdn);
      
      // SLA v2.2 COMPLIANT: Prepare parameters for query string
      const payload = {
        msisdn,
        campaign: params.campaign,
        merchant: params.merchant,
        language: params.language || 'ar', // Default to Arabic
        operator_code: 'zain-ksa',
        country_code: 'SA'
      };
      
      // Add optional parameters
      if (params.trialDays) {
        payload.trial = params.trialDays;
      }
      
      if (params.skipInitialCharge) {
        payload.charge = 'false';
      }
      
      // Add PIN if provided (required for some KSA flows)
      if (params.pin) {
        if (!/^\d{4,6}$/.test(params.pin)) {
          throw new UnifiedError('INVALID_PIN_FORMAT', 
            'Zain KSA requires 4-6 digit PIN');
        }
        payload.pin = params.pin;
      }
      
      // SLA v2.2 COMPLIANT: SLADigitalClient handles query string placement automatically
      const response = await this.client.post('/v2.2/subscription/create', payload);
      
      // Add checkout URL if subscription requires user confirmation
      if (response.data && response.data.checkout_required) {
        response.data.checkout_url = `${this.getEndpoint('checkout')}/zain-ksa/${response.data.uuid}`;
      }
      
      return response;
    });
  }
  
  /**
   * Generate PIN with charge amount - KSA specific requirement - SLA v2.2 COMPLIANT
   */
  async generatePIN(msisdn, campaign, chargeAmount) {
    return this.executeWithLogging('generatePIN', { msisdn, campaign, chargeAmount }, async () => {
      this.validateParams({ msisdn, campaign }, ['msisdn', 'campaign']);
      
      const normalizedMSISDN = this.normalizeMSISDN(msisdn);
      
      // SLA v2.2 COMPLIANT: Prepare parameters for query string
      const payload = {
        msisdn: normalizedMSISDN,
        campaign,
        merchant: this.config.credentials.merchant,
        template: 'subscription',
        language: 'ar', // Arabic for KSA
        operator_code: 'zain-ksa',
        country_code: 'SA'
      };
      
      // CORRECTED: Include charge amount for KSA PIN API as per documentation
      if (chargeAmount) {
        payload.amount = chargeAmount;
      }
      
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
        operator_code: 'zain-ksa'
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
        operator_code: 'zain-ksa'
      });
      
      return response;
    });
  }
  
  /**
   * Process one-time charge - SLA v2.2 COMPLIANT
   */
  async charge(uuid, amount) {
    return this.executeWithLogging('charge', { uuid, amount }, async () => {
      this.validateParams({ uuid, amount }, ['uuid', 'amount']);
      
      const validatedParams = this.applyBusinessRules('charge', { amount });
      
      // SLA v2.2 COMPLIANT: Parameters in query string via SLADigitalClient
      const response = await this.client.post('/v2.2/charge', {
        uuid,
        amount: validatedParams.amount,
        currency: 'SAR',
        operator_code: 'zain-ksa'
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
        currency: 'SAR',
        operator_code: 'zain-ksa'
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
        operator_code: 'zain-ksa',
        country_code: 'SA'
      });
      
      return response;
    });
  }
  
  /**
   * Map Zain KSA response data to unified format
   * Note: Billing attributes may not be returned in KSA API responses
   */
  mapResponseData(response) {
    // Handle the new response structure with data wrapper
    const responseData = response.data || response;
    
    return {
      subscriptionId: responseData.subscription_uuid || responseData.uuid,
      operatorSubscriptionId: responseData.subscription_uuid || responseData.uuid,
      status: this.mapStatus(responseData.status),
      // CORRECTED: Handle missing billing data for KSA
      amount: responseData.charge_amount || responseData.amount || null,
      currency: responseData.currency || 'SAR',
      frequency: responseData.billing_frequency || responseData.frequency || 'monthly',
      nextBillingDate: responseData.next_charge_date || responseData.next_payment_timestamp || null,
      msisdn: responseData.msisdn,
      campaign: responseData.campaign,
      merchant: responseData.merchant,
      transactionId: responseData.transaction_ref || responseData.transaction_id,
      eligible: responseData.eligible,
      eligibilityReason: responseData.eligibility_reason,
      // KSA-specific flags
      noRecurringNotifications: true,
      checkoutUrl: responseData.checkout_url,
      checkoutRequired: responseData.checkout_required || false,
      operatorCode: 'zain-ksa',
      countryCode: 'SA'
    };
  }
  
  /**
   * Map Zain KSA errors to unified format
   */
  mapError(error) {
    const errorMappings = {
      '2001': { code: 'INVALID_MSISDN', message: 'Invalid Saudi mobile number format' },
      '2015': { code: 'INSUFFICIENT_FUNDS', message: 'Insufficient balance' },
      '4001': { code: 'INVALID_PIN', message: 'Invalid PIN code' },
      '4002': { code: 'PIN_EXPIRED', message: 'PIN has expired, please request a new one' },
      '1003': { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests, please try again later' },
      'SUB_EXISTS': { code: 'SUBSCRIPTION_EXISTS', message: 'Subscription already exists' },
      'SUB_NOT_FOUND': { code: 'SUBSCRIPTION_NOT_FOUND', message: 'Subscription not found' },
      'INELIGIBLE': { code: 'CUSTOMER_INELIGIBLE', message: 'Customer is not eligible for this service' },
      'AUTH_FAIL': { code: 'AUTHENTICATION_FAILED', message: 'Authentication failed' },
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
        operatorCode: 'zain-ksa'
      };
    }
    
    return {
      code: 'UNMAPPED_ERROR',
      message: error.message || 'Unknown error from Zain KSA',
      originalCode: errorCode,
      originalMessage: error.message,
      operatorCode: 'zain-ksa'
    };
  }
  
  /**
   * Map Zain KSA status to unified status - CORRECTED with SDP mapping
   */
  mapStatus(operatorStatus) {
    const statusMappings = {
      // SDP-specific mappings for Zain KSA 
      'SUCCESS': 'active',    // CORRECTED: SDP returns SUCCESS instead of CHARGED
      'CHARGED': 'active',    // Keep for backward compatibility
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
   * Override MSISDN normalization for Saudi Arabia
   */
  normalizeMSISDN(msisdn) {
    // Remove any non-digit characters except +
    let normalized = msisdn.replace(/[^\d+]/g, '');
    
    // Remove Saudi country code if present
    if (normalized.startsWith('+966')) {
      normalized = normalized.substring(4);
    } else if (normalized.startsWith('966')) {
      normalized = normalized.substring(3);
    }
    
    // Ensure it's 9 digits starting with 5
    if (normalized.length === 9 && normalized.startsWith('5')) {
      return normalized;
    }
    
    throw new UnifiedError('INVALID_MSISDN', 
      'Invalid Saudi mobile number format. Must be 9 digits starting with 5');
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

module.exports = ZainKSAAdapter;