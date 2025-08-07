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
      
      // Determine operator from identifier
      const operatorCode = await SLAPinController.determineOperator(identifier, campaign);
      
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
      
      // Map response to SLA Digital v2.2 format
      const slaResponse = SLAPinController.mapPinResponse(response, operatorCode, {
        identifier,
        campaign,
        merchant,
        template,
        language
      });
      
      Logger.info('SLA v2.2 PIN generated successfully', {
        endpoint: '/v2.2/pin',
        operatorCode,
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
   * Determine operator from identifier or campaign
   */
  static async determineOperator(identifier, campaign) {
    // ACR is 48 characters - typically Telenor
    if (identifier.length === 48) {
      // Default to Myanmar for ACR, but could be other Telenor countries
      if (campaign && campaign.toLowerCase().includes('denmark')) return 'telenor-dk';
      if (campaign && campaign.toLowerCase().includes('norway')) return 'telenor-no';
      if (campaign && campaign.toLowerCase().includes('sweden')) return 'telenor-se';
      if (campaign && campaign.toLowerCase().includes('serbia')) return 'telenor-rs';
      if (campaign && campaign.toLowerCase().includes('malaysia')) return 'telenor-digi';
      
      return 'telenor-mm'; // Default ACR to Myanmar
    }
    
    // MSISDN-based operator detection
    const operatorMappings = {
      // Kuwait operators
      '+965': { '5': 'zain-kw', '6': 'zain-kw', '9': 'ooredoo-kw', '5555': 'stc-kw' },
      
      // UAE operators  
      '+971': { '50': 'etisalat-ae', '52': 'etisalat-ae', '54': 'etisalat-ae', '56': 'etisalat-ae' },
      
      // Saudi Arabia operators
      '+966': { '50': 'zain-sa', '51': 'mobily-sa', '52': 'zain-sa', '53': 'mobily-sa', '54': 'zain-sa', '55': 'mobily-sa' },
      
      // Nigeria
      '+234': { '809': 'mobile-ng', '817': 'mobile-ng', '818': 'mobile-ng', '908': 'mobile-ng', '909': 'mobile-ng' },
      
      // Sri Lanka
      '+94': { '77': 'axiata-lk', '76': 'axiata-lk', '78': 'axiata-lk' },
      
      // Malaysia
      '+60': { '10': 'telenor-digi', '11': 'telenor-digi', '14': 'telenor-digi', '16': 'telenor-digi', '17': 'umobile-my', '18': 'umobile-my', '19': 'umobile-my' },
      
      // Myanmar
      '+95': { '9': 'telenor-mm' },
      
      // Denmark
      '+45': { '2': 'telenor-dk', '3': 'telenor-dk', '4': 'telenor-dk', '5': 'telenor-dk' },
      
      // Norway
      '+47': { '4': 'telenor-no', '9': 'telenor-no' },
      
      // Sweden
      '+46': { '70': 'telenor-se', '73': 'telenor-se', '76': 'telenor-se', '79': 'telenor-se' },
      
      // Serbia
      '+381': { '60': 'telenor-rs', '61': 'telenor-rs', '62': 'telenor-rs', '63': 'telenor-rs', '64': 'telenor-rs', '65': 'telenor-rs', '66': 'telenor-rs' },
      
      // UK (generic - would need more specific detection)
      '+44': { '7': 'voda-uk' }, // Default to Vodafone UK
      
      // Ireland
      '+353': { '83': 'three-ie', '85': 'three-ie', '86': 'three-ie', '87': 'vf-ie', '89': 'vf-ie' }
    };
    
    // Extract country code
    let normalizedMSISDN = identifier.replace(/[\s\-\(\)]/g, '');
    if (!normalizedMSISDN.startsWith('+')) {
      normalizedMSISDN = '+' + normalizedMSISDN;
    }
    
    for (const [countryCode, prefixMap] of Object.entries(operatorMappings)) {
      if (normalizedMSISDN.startsWith(countryCode)) {
        const remainingNumber = normalizedMSISDN.substring(countryCode.length);
        
        // Try different prefix lengths
        for (let len = 3; len >= 1; len--) {
          const prefix = remainingNumber.substring(0, len);
          if (prefixMap[prefix]) {
            return prefixMap[prefix];
          }
        }
        
        // Return first operator for country if no specific match
        return Object.values(prefixMap)[0];
      }
    }
    
    // Fallback based on campaign
    if (campaign) {
      const campaignLower = campaign.toLowerCase();
      if (campaignLower.includes('zain')) return 'zain-kw';
      if (campaignLower.includes('etisalat')) return 'etisalat-ae';
      if (campaignLower.includes('mobily')) return 'mobily-sa';
      if (campaignLower.includes('telenor')) return 'telenor-dk';
      if (campaignLower.includes('three')) return 'three-uk';
      if (campaignLower.includes('vodafone')) return 'voda-uk';
    }
    
    // Default fallback
    return 'zain-kw';
  }
  
  /**
   * Map PIN response to SLA Digital v2.2 format
   */
  static mapPinResponse(response, operatorCode, originalParams) {
    const data = response.data || response;
    
    return {
      pin_sent: true,
      message: 'PIN sent successfully',
      expires_in: 120, // 2 minutes per SLA Digital specification
      template: originalParams.template || 'subscription',
      language: originalParams.language || 'en',
      operator_code: operatorCode,
      
      // Additional fields that might be returned
      pin_length: SLAPinController.getPinLength(operatorCode),
      delivery_method: 'SMS',
      timestamp: new Date().toISOString(),
      
      // If fraud token was used (Etisalat UAE specific)
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
      'zain-kw': 5,      // Zain Kuwait uses 5-digit PIN
      'mobily-sa': 4,    // Mobily Saudi uses 4-digit PIN
      'etisalat-ae': 5,  // Etisalat UAE uses 5-digit PIN
      'telenor-digi': 6, // Telenor Digi Malaysia uses 6-digit PIN
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
      'zain-sa',      // Zain Saudi supports PIN
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
      'viettel-mz'    // Movitel Mozambique - checkout only
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