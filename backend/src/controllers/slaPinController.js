/**
 * SLA Digital v2.2 PIN Controller - COMPLIANT IMPLEMENTATION
 * 
 * Handles SLA Digital v2.2 PIN/OTP generation using existing adapters.
 * Endpoints: /v2.2/pin
 * 
 * PHASE 2: Controllers Implementation
 */

const Logger = require('../utils/logger');
const { UnifiedError } = require('../utils/errors');
const { getInstance: getOperatorManager } = require('../services/core/OperatorManager');
const OperatorDetectionService = require('../services/core/OperatorDetectionService');

class SLAPinController {
  
  /**
   * POST /v2.2/pin
   * Generates OTP/PIN for verification
   * 
   * Query Parameters: msisdn, campaign, merchant, [template], [language], [amount], [fraud_token]
   */
  static async generate(req, res) {
    try {
      const { 
        msisdn, 
        acr,         // For Telenor operators
        campaign, 
        merchant, 
        template, 
        language, 
        amount,
        fraud_token,
        correlator   // Mandatory for Telenor ACR transactions
      } = req.query;
      
      // Validate required parameters per SLA v2.2
      if (!campaign || !merchant) {
        return res.status(200).json({
          error: {
            category: 'Request',
            code: '2001',
            message: 'Missing required parameters: campaign and merchant are mandatory'
          }
        });
      }
      
      // Validate identifier (msisdn or acr)
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
      
      // Validate MSISDN format (if not ACR)
      if (identifier.length !== 48 && !/^\+?[\d\s\-\(\)]{8,15}$/.test(identifier)) {
        return res.status(200).json({
          error: {
            category: 'Request',
            code: '2001',
            message: 'Invalid MSISDN format'
          }
        });
      }
      
      // Validate ACR format (if ACR)
      if (identifier.length === 48 && !/^[a-zA-Z0-9]{48}$/.test(identifier)) {
        return res.status(200).json({
          error: {
            category: 'Request',
            code: '3001',
            message: 'Invalid ACR format: must be 48 alphanumeric characters'
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
      
      // Check if operator is enabled
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
      
      // Get adapter for the operator
      const adapter = operatorManager.getOperatorAdapter(operatorCode);
      
      // Check if operator supports PIN generation
      if (!adapter.generatePIN || typeof adapter.generatePIN !== 'function') {
        return res.status(200).json({
          error: {
            category: 'Service',
            code: '5002',
            message: `Operator ${operatorCode} does not support PIN generation - use checkout flow`
          }
        });
      }
      
      // Validate ACR requires correlator for Telenor
      if (identifier.length === 48 && operatorCode.startsWith('telenor') && !correlator) {
        return res.status(200).json({
          error: {
            category: 'Request',
            code: '3002',
            message: 'Correlator field is mandatory for Telenor ACR transactions'
          }
        });
      }
      
      // Prepare parameters for adapter
      const adapterParams = {
        msisdn: identifier.length === 48 ? undefined : identifier,
        acr: identifier.length === 48 ? identifier : undefined,
        campaign,
        merchant,
        template: template || 'subscription',
        language: language || 'en',
        amount: amount ? parseFloat(amount) : undefined,
        fraud_token,
        correlator
      };
      
      // Call adapter to generate PIN
      const response = await adapter.generatePIN(identifier, campaign, adapterParams);
      
      // Get operator information for enhanced response
      const operatorInfo = OperatorDetectionService.getOperatorInfo(operatorCode);
      
      // Map response to SLA Digital v2.2 format
      const slaResponse = SLAPinController.mapPinResponse(response, operatorCode, operatorInfo, {
        identifier,
        campaign,
        merchant,
        template,
        language,
        correlator,
        fraud_token
      });
      
      Logger.info('SLA v2.2 PIN generated successfully', {
        endpoint: '/v2.2/pin',
        operatorCode,
        operatorName: operatorInfo.name,
        identifier: identifier ? identifier.substring(0, 6) + '***' : 'unknown',
        campaign,
        template
      });
      
      // SLA v2.2: Always return HTTP 200
      res.status(200).json(slaResponse);
      
    } catch (error) {
      Logger.error('SLA v2.2 PIN generation failed', {
        endpoint: '/v2.2/pin',
        error: error.message,
        stack: error.stack,
        params: req.query
      });
      
      // Map error to SLA Digital format
      const slaError = SLAPinController.mapError(error);
      res.status(200).json({ error: slaError });
    }
  }
  
  // ===== HELPER METHODS =====
  
  /**
   * Map PIN response to SLA Digital v2.2 format
   */
  static mapPinResponse(response, operatorCode, operatorInfo, originalParams) {
    return {
      pin_sent: true,
      message: 'PIN sent successfully',
      expires_in: 120, // 2 minutes per SLA Digital specification
      
      // PIN details
      pin_length: SLAPinController.getPinLength(operatorCode),
      delivery_method: 'SMS',
      template: originalParams.template || 'subscription',
      language: originalParams.language || 'en',
      
      // Timestamps
      timestamp: new Date().toISOString(),
      expires_at: new Date(Date.now() + 120 * 1000).toISOString(),
      
      // Operator information
      operator_code: operatorCode,
      operator_name: operatorInfo.name,
      currency: operatorInfo.currency,
      
      // Security features
      fraud_token_used: !!originalParams.fraud_token,
      
      // For ACR transactions (Telenor)
      correlator: originalParams.correlator,
      acr: originalParams.identifier?.length === 48 ? originalParams.identifier : undefined,
      msisdn: originalParams.identifier?.length !== 48 ? originalParams.identifier : undefined
    };
  }
  
  /**
   * Get PIN length for operator
   */
  static getPinLength(operatorCode) {
    const pinLengths = {
      'zain-kw': 5,        // Zain Kuwait uses 5-digit PIN
      'zain-bh': 5,        // Zain Bahrain uses 5-digit PIN ✅ FIXED
      'zain-sa': 5,        // Zain Saudi uses 5-digit PIN
      'zain-iq': 5,        // Zain Iraq uses 5-digit PIN
      'zain-jo': 5,        // Zain Jordan uses 5-digit PIN
      'zain-sd': 5,        // Zain Sudan uses 5-digit PIN
      'mobily-sa': 4,      // Mobily Saudi uses 4-digit PIN
      'etisalat-ae': 5,    // Etisalat UAE uses 5-digit PIN
      'ooredoo-kw': 5,     // Ooredoo Kuwait uses 5-digit PIN
      'stc-kw': 5,         // STC Kuwait uses 5-digit PIN
      'telenor-digi': 6,   // Telenor Digi Malaysia uses 6-digit PIN
      'umobile-my': 5,     // U Mobile Malaysia uses 5-digit PIN
      'vf-ie': 5           // Vodafone Ireland uses 5-digit PIN
    };
    
    return pinLengths[operatorCode] || 5; // Default to 5 digits
  }
  
  /**
   * Map errors to SLA Digital v2.2 format
   */
  static mapError(error) {
    const errorMappings = {
      'INVALID_MSISDN': { category: 'Request', code: '2001' },
      'INVALID_ACR': { category: 'Request', code: '3001' },
      'MISSING_CORRELATOR': { category: 'Request', code: '3002' },
      'PIN_GENERATION_FAILED': { category: 'Service', code: '3003' },
      'SMS_DELIVERY_FAILED': { category: 'Service', code: '3004' },
      'OPERATOR_DISABLED': { category: 'Service', code: '5002' },
      'FEATURE_NOT_SUPPORTED': { category: 'Service', code: '5002' },
      'RATE_LIMIT_EXCEEDED': { category: 'Authorization', code: '1003' },
      'FRAUD_TOKEN_INVALID': { category: 'Security', code: '4003' }
    };
    
    const mapping = errorMappings[error.code] || { category: 'Server', code: '5001' };
    
    return {
      category: mapping.category,
      code: mapping.code,
      message: error.message || 'PIN generation failed'
    };
  }
  
  /**
   * Validate operator supports PIN generation
   */
  static validatePinSupport(operatorCode) {
    // Operators that support PIN generation (direct API flow)
    const pinSupportedOperators = [
      'zain-kw',      // Zain Kuwait supports PIN
      'zain-bh',      // Zain Bahrain supports PIN ✅ FIXED
      'zain-sa',      // Zain Saudi supports PIN
      'zain-iq',      // Zain Iraq supports PIN
      'zain-jo',      // Zain Jordan supports PIN
      'zain-sd',      // Zain Sudan supports PIN
      'mobily-sa',    // Mobily Saudi supports PIN
      'etisalat-ae',  // Etisalat UAE supports PIN
      'ooredoo-kw',   // Ooredoo Kuwait supports PIN
      'stc-kw',       // STC Kuwait supports PIN
      'telenor-digi', // Telenor Digi Malaysia supports PIN
      'umobile-my',   // U Mobile Malaysia supports PIN
      'vf-ie'         // Vodafone Ireland supports PIN
    ];
    
    // Checkout-only operators (no PIN API)
    const checkoutOnlyOperators = [
      'telenor-dk',   // Denmark - checkout only
      'telenor-no',   // Norway - checkout only
      'telenor-se',   // Sweden - checkout only
      'telenor-rs',   // Serbia - checkout only
      'telenor-mm',   // Myanmar - checkout only
      'voda-uk',      // Vodafone UK - checkout only
      'three-uk',     // Three UK - checkout only
      'three-ie',     // Three Ireland - checkout only
      'o2-uk',        // O2 UK - checkout only
      'ee-uk',        // EE UK - checkout only
      'mobile-ng',    // 9mobile Nigeria - checkout only
      'axiata-lk',    // Dialog Sri Lanka - checkout only
      'viettel-mz'    // Viettel Mozambique - checkout only
    ];
    
    if (checkoutOnlyOperators.includes(operatorCode)) {
      return { supported: false, reason: 'Operator uses checkout flow only' };
    }
    
    if (pinSupportedOperators.includes(operatorCode)) {
      return { supported: true };
    }
    
    return { supported: false, reason: 'PIN support not available' };
  }
}

module.exports = SLAPinController;