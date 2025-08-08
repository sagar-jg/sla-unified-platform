/**
 * SLA Digital v2.2 Eligibility Controller - COMPLIANT IMPLEMENTATION
 * 
 * Handles SLA Digital v2.2 customer eligibility checks using existing adapters.
 * Endpoints: /v2.2/eligibility
 * 
 * PHASE 2: Controllers Implementation
 */

const Logger = require('../utils/logger');
const { UnifiedError } = require('../utils/errors');
const { getInstance: getOperatorManager } = require('../services/core/OperatorManager');
const OperatorDetectionService = require('../services/core/OperatorDetectionService');

class SLAEligibilityController {
  
  /**
   * POST /v2.2/eligibility
   * Checks customer eligibility for service
   * 
   * Query Parameters: msisdn, campaign, merchant, [amount], [acr]
   */
  static async check(req, res) {
    try {
      const { 
        msisdn, 
        acr,
        campaign, 
        merchant, 
        amount,
        correlator
      } = req.query;
      
      // Validate required parameters
      if (!campaign || !merchant) {
        return res.status(200).json({
          error: {
            category: 'Request',
            code: '2001',
            message: 'Missing required parameters: campaign and merchant are mandatory'
          }
        });
      }
      
      // Validate identifier
      const identifier = acr || msisdn;
      if (!identifier) {
        return res.status(200).json({
          error: {
            category: 'Request',
            code: '2001',
            message: 'Missing required parameter: msisdn or acr is mandatory'
          }
        });
      }
      
      // ✅ FIXED: Use centralized operator detection service
      const operatorCode = await OperatorDetectionService.determineOperator(identifier, campaign);
      
      if (!operatorCode) {
        return res.status(200).json({
          error: {
            category: 'Request',
            code: '2001',
            message: 'Unable to determine operator from identifier'
          }
        });
      }
      
      // Get operator manager and adapter
      const operatorManager = getOperatorManager();
      const isEnabled = await operatorManager.isOperatorEnabled(operatorCode);
      
      if (!isEnabled) {
        return res.status(200).json({
          error: {
            category: 'Service',
            code: '5002',
            message: `Operator ${operatorCode} is currently unavailable`
          }
        });
      }
      
      const adapter = operatorManager.getOperatorAdapter(operatorCode);
      
      // Call adapter to check eligibility
      const response = await adapter.checkEligibility(identifier);
      
      // Get operator information for enhanced response
      const operatorInfo = OperatorDetectionService.getOperatorInfo(operatorCode);
      
      // Map response to SLA Digital format
      const slaResponse = {
        eligible: response.data?.eligible !== false,
        reason: response.data?.eligibilityReason || 'Customer is eligible',
        
        // Customer details
        msisdn: identifier.length !== 48 ? identifier : undefined,
        acr: identifier.length === 48 ? identifier : undefined,
        
        // Eligibility details
        max_amount: response.data?.maxAmount?.toString() || SLAEligibilityController.getMaxAmountForOperator(operatorCode),
        currency: operatorInfo.currency,
        daily_limit: response.data?.dailyLimit?.toString(),
        monthly_limit: response.data?.monthlyLimit?.toString(),
        
        // Restrictions
        existing_subscriptions: response.data?.existingSubscriptions || 0,
        subscription_limit_reached: response.data?.subscriptionLimitReached || false,
        
        // Metadata
        operator_code: operatorCode,
        timestamp: new Date().toISOString(),
        campaign
      };
      
      Logger.info('SLA v2.2 eligibility check completed', {
        endpoint: '/v2.2/eligibility',
        operatorCode,
        operatorName: operatorInfo.name,
        eligible: slaResponse.eligible,
        identifier: identifier ? identifier.substring(0, 6) + '***' : 'unknown'
      });
      
      res.status(200).json(slaResponse);
      
    } catch (error) {
      Logger.error('SLA v2.2 eligibility check failed', {
        endpoint: '/v2.2/eligibility',
        error: error.message,
        params: req.query
      });
      
      const slaError = {
        category: 'Server',
        code: '5001',
        message: error.message || 'Eligibility check failed'
      };
      
      res.status(200).json({ error: slaError });
    }
  }
  
  /**
   * Get maximum amount for operator
   */
  static getMaxAmountForOperator(operatorCode) {
    const maxAmountMapping = {
      'zain-kw': '30',       // KWD
      'zain-bh': '50',       // BHD ✅ FIXED
      'zain-sa': '30',       // SAR
      'zain-iq': '50',       // IQD
      'zain-jo': '20',       // JOD
      'zain-sd': '100',      // SDG
      'etisalat-ae': '365',  // AED
      'mobily-sa': '30',     // SAR
      'ooredoo-kw': '30',    // KWD
      'stc-kw': '30',        // KWD
      'telenor-dk': '5000',  // DKK
      'telenor-no': '5000',  // NOK
      'telenor-se': '5000',  // SEK
      'telenor-rs': '10000', // RSD
      'telenor-mm': '10000', // MMK
      'telenor-digi': '100', // MYR
      'umobile-my': '300',   // MYR
      'voda-uk': '50',       // GBP
      'three-uk': '50',      // GBP
      'o2-uk': '50',         // GBP
      'ee-uk': '50',         // GBP
      'three-ie': '50',      // EUR
      'vf-ie': '30',         // EUR
      'axiata-lk': '5000',   // LKR
      'mobile-ng': '10000',  // NGN
      'viettel-mz': '1000'   // MZN
    };
    
    return maxAmountMapping[operatorCode] || '100';
  }
}

module.exports = SLAEligibilityController;