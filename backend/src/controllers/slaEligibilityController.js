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
      
      // Determine operator
      const operatorCode = await SLAEligibilityController.determineOperator(identifier, campaign);
      
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
      
      // Map response to SLA Digital format
      const slaResponse = {
        eligible: response.data?.eligible !== false,
        reason: response.data?.eligibilityReason || 'Customer is eligible',
        operator_code: operatorCode,
        msisdn: identifier.length !== 48 ? identifier : undefined,
        acr: identifier.length === 48 ? identifier : undefined,
        timestamp: new Date().toISOString()
      };
      
      Logger.info('SLA v2.2 eligibility check completed', {
        endpoint: '/v2.2/eligibility',
        operatorCode,
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
  
  static async determineOperator(identifier, campaign) {
    // Reuse operator detection logic from PIN controller
    if (identifier.length === 48) return 'telenor-mm';
    if (identifier.startsWith('+965')) return 'zain-kw';
    if (identifier.startsWith('+971')) return 'etisalat-ae';
    if (identifier.startsWith('+966')) return 'zain-sa';
    return 'zain-kw'; // Default
  }
}

module.exports = SLAEligibilityController;