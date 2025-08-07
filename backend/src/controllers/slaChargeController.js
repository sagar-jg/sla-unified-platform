/**
 * SLA Digital v2.2 Charge Controller - COMPLIANT IMPLEMENTATION
 * 
 * Handles SLA Digital v2.2 billing operations using existing adapters.
 * Endpoints: /v2.2/charge
 * 
 * PHASE 2: Controllers Implementation
 */

const Logger = require('../utils/logger');
const { UnifiedError } = require('../utils/errors');
const { getInstance: getOperatorManager } = require('../services/core/OperatorManager');

class SLAChargeController {
  
  /**
   * POST /v2.2/charge
   * Processes one-time charge against existing subscription
   * 
   * Query Parameters: uuid, amount, currency, [description], [correlator]
   */
  static async charge(req, res) {
    try {
      const { 
        uuid, 
        amount, 
        currency, 
        description, 
        correlator 
      } = req.query;
      
      // Validate required parameters per SLA v2.2
      if (!uuid || !amount || !currency) {
        return res.status(200).json({
          error: {
            category: 'Request',
            code: '2001',
            message: 'Missing required parameters: uuid, amount, and currency are mandatory'
          }
        });
      }
      
      // Validate amount format
      const chargeAmount = parseFloat(amount);
      if (isNaN(chargeAmount) || chargeAmount <= 0) {
        return res.status(200).json({
          error: {
            category: 'Request',
            code: '2001',
            message: 'Invalid amount: must be a positive number'
          }
        });
      }
      
      // Validate currency format (ISO 4217)
      if (!/^[A-Z]{3}$/.test(currency)) {
        return res.status(200).json({
          error: {
            category: 'Request',
            code: '2001',
            message: 'Invalid currency: must be 3-letter ISO 4217 code (e.g., USD, EUR, KWD)'
          }
        });
      }
      
      // Find operator for this subscription
      const { adapter, operatorCode } = await SLAChargeController.findSubscriptionOperator(uuid);
      
      if (!adapter) {
        return res.status(200).json({
          error: {
            category: 'Request',
            code: '2052',
            message: 'Subscription not found or operator not available'
          }
        });
      }
      
      // Check if operator supports charging
      const operatorManager = getOperatorManager();
      const supportedOperators = operatorManager.getSupportedOperators();
      const operatorInfo = supportedOperators.find(op => op.code === operatorCode);
      
      // Some operators are checkout-only and don't support direct charging
      if (operatorInfo && operatorInfo.adapter === 'checkout_only') {
        return res.status(200).json({
          error: {
            category: 'Service',
            code: '5002',
            message: `Operator ${operatorCode} does not support direct charging - use checkout flow`
          }
        });
      }
      
      // Check if adapter has charge method
      if (!adapter.charge || typeof adapter.charge !== 'function') {
        return res.status(200).json({
          error: {
            category: 'Service',
            code: '5002',
            message: `Operator ${operatorCode} does not support one-time charging`
          }
        });
      }
      
      // Prepare parameters for adapter
      const adapterParams = {
        amount: chargeAmount,
        currency,
        description,
        correlator
      };
      
      // Call adapter to process charge
      const response = await adapter.charge(uuid, chargeAmount);
      
      // Map response to SLA Digital v2.2 format
      const slaResponse = SLAChargeController.mapChargeResponse(response, operatorCode, {
        uuid,
        amount: chargeAmount,
        currency,
        description,
        correlator
      });
      
      Logger.info('SLA v2.2 charge processed successfully', {
        endpoint: '/v2.2/charge',
        operatorCode,
        uuid,
        amount: chargeAmount,
        currency,
        transactionId: slaResponse.transaction_id
      });
      
      // SLA v2.2: Always return HTTP 200
      res.status(200).json(slaResponse);
      
    } catch (error) {
      Logger.error('SLA v2.2 charge processing failed', {
        endpoint: '/v2.2/charge',
        error: error.message,
        stack: error.stack,
        params: req.query
      });
      
      // Map error to SLA Digital format
      const slaError = SLAChargeController.mapError(error);
      res.status(200).json({ error: slaError });
    }
  }
  
  // ===== HELPER METHODS =====
  
  /**
   * Find which operator a subscription belongs to
   * (Reused from subscription controller)
   */
  static async findSubscriptionOperator(uuid) {
    const operatorManager = getOperatorManager();
    const supportedOperators = operatorManager.getSupportedOperators();
    
    for (const operator of supportedOperators) {
      try {
        const isEnabled = await operatorManager.isOperatorEnabled(operator.code);
        if (!isEnabled) continue;
        
        const adapter = operatorManager.getOperatorAdapter(operator.code);
        
        // Try to get subscription status to verify it exists
        const response = await adapter.getSubscriptionStatus(uuid);
        
        if (response && response.data && response.data.status !== 'DELETED') {
          return { adapter, operatorCode: operator.code };
        }
      } catch (error) {
        // Continue to next operator
        continue;
      }
    }
    
    return { adapter: null, operatorCode: null };
  }
  
  /**
   * Map charge response to SLA Digital v2.2 format
   */
  static mapChargeResponse(response, operatorCode, originalParams) {
    const data = response.data || response;
    
    // Generate transaction ID if not provided
    const transactionId = data.transactionId || 
                         data.transaction_id || 
                         `tx_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    
    return {
      transaction_id: transactionId,
      uuid: originalParams.uuid,
      status: data.status?.toUpperCase() || 'CHARGED',
      amount: originalParams.amount.toString(),
      currency: originalParams.currency,
      description: originalParams.description || 'One-time charge',
      timestamp: new Date().toISOString(),
      operator_code: operatorCode,
      correlator: originalParams.correlator,
      
      // Additional SLA Digital fields
      subscription_status: data.subscriptionStatus || 'ACTIVE',
      balance: data.balance,
      next_payment_timestamp: data.nextBillingDate
    };
  }
  
  /**
   * Map errors to SLA Digital v2.2 format
   */
  static mapError(error) {
    const errorMappings = {
      'INSUFFICIENT_FUNDS': { category: 'Service', code: '2015' },
      'SUBSCRIPTION_NOT_FOUND': { category: 'Request', code: '2052' },
      'SUBSCRIPTION_SUSPENDED': { category: 'Service', code: '2016' },
      'SUBSCRIPTION_CANCELLED': { category: 'Service', code: '2017' },
      'AMOUNT_EXCEEDS_LIMIT': { category: 'Service', code: '2013' },
      'DAILY_LIMIT_EXCEEDED': { category: 'Service', code: '2014' },
      'MONTHLY_LIMIT_EXCEEDED': { category: 'Service', code: '2018' },
      'OPERATOR_DISABLED': { category: 'Service', code: '5002' },
      'FEATURE_NOT_SUPPORTED': { category: 'Service', code: '5002' },
      'INVALID_AMOUNT': { category: 'Request', code: '2001' },
      'INVALID_CURRENCY': { category: 'Request', code: '2001' },
      'CHARGING_NOT_AVAILABLE': { category: 'Service', code: '5002' }
    };
    
    const mapping = errorMappings[error.code] || { category: 'Server', code: '5001' };
    
    return {
      category: mapping.category,
      code: mapping.code,
      message: error.message || 'Charge processing failed'
    };
  }
  
  /**
   * Validate operator supports charging
   */
  static validateChargingSupport(operatorCode) {
    // Operators that support direct charging
    const chargingSupportedOperators = [
      'zain-kw',    // Zain Kuwait supports charging
      'telenor-digi', // Telenor Digi Malaysia supports charging
      'mobily-sa',   // Mobily Saudi Arabia supports charging
      'ooredoo-kw',  // Ooredoo Kuwait supports charging
      'stc-kw',      // STC Kuwait supports charging
      'umobile-my'   // U Mobile Malaysia supports charging
    ];
    
    // Checkout-only operators (no direct charging)
    const checkoutOnlyOperators = [
      'telenor-dk',  // Telenor Denmark - checkout only
      'telenor-no',  // Telenor Norway - checkout only  
      'telenor-se',  // Telenor Sweden - checkout only
      'telenor-rs',  // Telenor Serbia - checkout only
      'telenor-mm',  // Telenor Myanmar - checkout only
      'voda-uk',     // Vodafone UK - checkout only
      'three-uk',    // Three UK - checkout only
      'o2-uk',       // O2 UK - checkout only
      'ee-uk',       // EE UK - checkout only
      'three-ie',    // Three Ireland - checkout only
      'mobile-ng',   // 9mobile Nigeria - checkout only
      'axiata-lk',   // Dialog Sri Lanka - checkout only
      'viettel-mz'   // Movitel Mozambique - checkout only
    ];
    
    if (checkoutOnlyOperators.includes(operatorCode)) {
      return { supported: false, reason: 'Operator uses checkout flow only' };
    }
    
    if (chargingSupportedOperators.includes(operatorCode)) {
      return { supported: true };
    }
    
    // Default: assume supported but log warning
    Logger.warn(`Charging support unknown for operator ${operatorCode}`, {
      operatorCode,
      action: 'charge_validation'
    });
    
    return { supported: true, warning: 'Charging support not verified' };
  }
}

module.exports = SLAChargeController;