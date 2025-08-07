/**
 * OTP/PIN Controller
 * 
 * Handles OTP and PIN management for Direct Carrier Billing (DCB) authorization.
 * Critical component for subscriber verification in carrier billing flows.
 * 
 * Key Features:
 * - Generate PIN/OTP via SMS for subscriber verification
 * - Verify PIN for subscription authorization
 * - Check MSISDN eligibility for DCB services
 * - Operator-specific PIN handling (4-5 digits, language support)
 * - Security and fraud prevention measures
 */

const UnifiedAdapter = require('../services/core/UnifiedAdapter');
const Logger = require('../utils/logger');
const { ValidationError, OperatorError } = require('../utils/errors');
const { validationResult } = require('express-validator');

class OTPController {
  constructor() {
    this.unifiedAdapter = new UnifiedAdapter();
    
    // PIN configuration by operator (based on SLA Digital API specs)
    this.pinConfig = {
      'zain-kw': { length: 4, languages: ['en', 'ar'], expiry: 120 },
      'zain-sa': { length: 5, languages: ['en', 'ar'], expiry: 120 },
      'zain-bh': { length: 4, languages: ['en', 'ar'], expiry: 120 },
      'zain-iq': { length: 4, languages: ['en', 'ar'], expiry: 120 },
      'zain-jo': { length: 4, languages: ['en', 'ar'], expiry: 120 },
      'zain-sd': { length: 4, languages: ['en', 'ar'], expiry: 120 },
      'etisalat-ae': { length: 4, languages: ['en', 'ar'], expiry: 120 },
      'ooredoo-kw': { length: 4, languages: ['en', 'ar'], expiry: 120 },
      'stc-kw': { length: 4, languages: ['en', 'ar'], expiry: 120 },
      'telenor-dk': { length: 4, languages: ['en'], expiry: 120 },
      'telenor-digi': { length: 4, languages: ['en'], expiry: 120 },
      'telenor-mm': { length: 4, languages: ['en'], expiry: 120 },
      'telenor-no': { length: 4, languages: ['en'], expiry: 120 },
      'telenor-se': { length: 4, languages: ['en'], expiry: 120 },
      'telenor-rs': { length: 4, languages: ['en'], expiry: 120 },
      'voda-uk': { length: 4, languages: ['en'], expiry: 120 },
      'vf-ie': { length: 4, languages: ['en'], expiry: 120 },
      'three-uk': { length: 4, languages: ['en'], expiry: 120 },
      'three-ie': { length: 4, languages: ['en'], expiry: 120 },
      'o2-uk': { length: 4, languages: ['en'], expiry: 120 },
      'ee-uk': { length: 4, languages: ['en'], expiry: 120 },
      // Default configuration
      'default': { length: 4, languages: ['en'], expiry: 120 }
    };
  }

  /**
   * Generate PIN/OTP for subscriber verification
   * POST /api/v1/otp/generate
   */
  async generatePIN(req, res) {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation failed',
          details: errors.array()
        });
      }

      const {
        operatorCode,
        msisdn,
        campaign,
        merchant,
        template = 'subscription',
        language = 'en',
        fraudToken,
        metadata = {}
      } = req.body;

      // Validate required fields
      if (!operatorCode || !msisdn || !campaign || !merchant) {
        return res.status(400).json({
          error: 'Missing required fields',
          required: ['operatorCode', 'msisdn', 'campaign', 'merchant']
        });
      }

      // Validate MSISDN format
      if (!/^\d{8,15}$/.test(msisdn)) {
        return res.status(400).json({
          error: 'Invalid MSISDN format',
          message: 'MSISDN must be 8-15 digits'
        });
      }

      // Get operator PIN configuration
      const config = this.pinConfig[operatorCode] || this.pinConfig.default;
      
      // Validate language support
      if (!config.languages.includes(language)) {
        return res.status(400).json({
          error: 'Unsupported language',
          supported: config.languages,
          provided: language
        });
      }

      Logger.info('Generating PIN for DCB verification', {
        operatorCode,
        msisdn: this.maskMSISDN(msisdn),
        campaign,
        template,
        language,
        userId: req.user?.id
      });

      // Generate PIN through unified adapter
      const result = await this.unifiedAdapter.executeOperation(
        operatorCode,
        'generatePIN',
        {
          msisdn,
          campaign,
          merchant,
          template,
          language,
          fraudToken,
          metadata: {
            ...metadata,
            requestSource: 'api',
            userAgent: req.get('User-Agent'),
            ipAddress: req.ip
          }
        },
        req.user?.id,
        {
          correlationId: req.correlationId
        }
      );

      Logger.operatorAction(operatorCode, 'generatePIN', result, {
        msisdn: this.maskMSISDN(msisdn),
        template,
        language,
        userId: req.user?.id
      });

      res.status(200).json({
        success: true,
        data: {
          pinGenerated: true,
          expirySeconds: config.expiry,
          smsLanguage: language,
          operatorCode,
          ...(result.data?.trackingId && { trackingId: result.data.trackingId })
        },
        message: 'PIN generated and sent via SMS',
        correlationId: req.correlationId
      });

    } catch (error) {
      Logger.error('Failed to generate PIN', {
        operatorCode: req.body.operatorCode,
        msisdn: req.body.msisdn ? this.maskMSISDN(req.body.msisdn) : undefined,
        error: error.message,
        userId: req.user?.id,
        correlationId: req.correlationId
      });

      if (error instanceof ValidationError) {
        return res.status(400).json({
          error: 'Validation Error',
          message: error.message,
          correlationId: req.correlationId
        });
      }

      if (error instanceof OperatorError) {
        return res.status(422).json({
          error: 'Operator Error', 
          message: error.message,
          operatorCode: req.body.operatorCode,
          correlationId: req.correlationId
        });
      }

      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to generate PIN',
        correlationId: req.correlationId
      });
    }
  }

  /**
   * Verify PIN/OTP entered by subscriber
   * POST /api/v1/otp/verify
   */
  async verifyPIN(req, res) {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation failed',
          details: errors.array()
        });
      }

      const {
        operatorCode,
        msisdn,
        pin,
        campaign,
        merchant,
        metadata = {}
      } = req.body;

      // Validate required fields
      if (!operatorCode || !msisdn || !pin || !campaign || !merchant) {
        return res.status(400).json({
          error: 'Missing required fields',
          required: ['operatorCode', 'msisdn', 'pin', 'campaign', 'merchant']
        });
      }

      // Validate PIN format
      const config = this.pinConfig[operatorCode] || this.pinConfig.default;
      if (pin.length !== config.length) {
        return res.status(400).json({
          error: 'Invalid PIN format',
          message: `PIN must be ${config.length} digits for ${operatorCode}`
        });
      }

      if (!/^\d+$/.test(pin)) {
        return res.status(400).json({
          error: 'Invalid PIN format',
          message: 'PIN must contain only digits'
        });
      }

      Logger.info('Verifying PIN for DCB authorization', {
        operatorCode,
        msisdn: this.maskMSISDN(msisdn),
        pinLength: pin.length,
        campaign,
        userId: req.user?.id
      });

      // Verify PIN through unified adapter
      const result = await this.unifiedAdapter.executeOperation(
        operatorCode,
        'verifyPIN',
        {
          msisdn,
          pin,
          campaign,
          merchant,
          metadata: {
            ...metadata,
            requestSource: 'api',
            userAgent: req.get('User-Agent'),
            ipAddress: req.ip
          }
        },
        req.user?.id,
        {
          correlationId: req.correlationId
        }
      );

      Logger.operatorAction(operatorCode, 'verifyPIN', result, {
        msisdn: this.maskMSISDN(msisdn),
        pinValid: result.success,
        userId: req.user?.id
      });

      res.status(200).json({
        success: true,
        data: {
          pinValid: result.success,
          verified: result.success,
          operatorCode,
          msisdn: this.maskMSISDN(msisdn),
          ...(result.data?.authorizationToken && { 
            authorizationToken: result.data.authorizationToken 
          })
        },
        message: result.success ? 'PIN verified successfully' : 'PIN verification failed',
        correlationId: req.correlationId
      });

    } catch (error) {
      Logger.error('Failed to verify PIN', {
        operatorCode: req.body.operatorCode,
        msisdn: req.body.msisdn ? this.maskMSISDN(req.body.msisdn) : undefined,
        error: error.message,
        userId: req.user?.id,
        correlationId: req.correlationId
      });

      if (error instanceof ValidationError) {
        return res.status(400).json({
          error: 'Validation Error',
          message: error.message,
          correlationId: req.correlationId
        });
      }

      if (error instanceof OperatorError) {
        return res.status(422).json({
          error: 'PIN Verification Failed',
          message: error.message,
          operatorCode: req.body.operatorCode,
          correlationId: req.correlationId
        });
      }

      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to verify PIN',
        correlationId: req.correlationId
      });
    }
  }

  /**
   * Check MSISDN eligibility for DCB services
   * POST /api/v1/otp/eligibility
   */
  async checkEligibility(req, res) {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation failed',
          details: errors.array()
        });
      }

      const {
        operatorCode,
        msisdn,
        campaign,
        merchant,
        metadata = {}
      } = req.body;

      // Validate required fields
      if (!operatorCode || !msisdn) {
        return res.status(400).json({
          error: 'Missing required fields',
          required: ['operatorCode', 'msisdn']
        });
      }

      // Validate MSISDN format
      if (!/^\d{8,15}$/.test(msisdn)) {
        return res.status(400).json({
          error: 'Invalid MSISDN format',
          message: 'MSISDN must be 8-15 digits'
        });
      }

      Logger.info('Checking MSISDN eligibility for DCB', {
        operatorCode,
        msisdn: this.maskMSISDN(msisdn),
        campaign,
        userId: req.user?.id
      });

      // Check eligibility through unified adapter
      const result = await this.unifiedAdapter.executeOperation(
        operatorCode,
        'checkEligibility',
        {
          msisdn,
          campaign,
          merchant,
          metadata: {
            ...metadata,
            requestSource: 'api',
            userAgent: req.get('User-Agent'),
            ipAddress: req.ip
          }
        },
        req.user?.id,
        {
          correlationId: req.correlationId
        }
      );

      Logger.operatorAction(operatorCode, 'checkEligibility', result, {
        msisdn: this.maskMSISDN(msisdn),
        eligible: result.data?.eligible,
        userId: req.user?.id
      });

      res.status(200).json({
        success: true,
        data: {
          eligible: result.data?.eligible || false,
          operatorCode,
          msisdn: this.maskMSISDN(msisdn),
          eligibilityReason: result.data?.eligibilityReason,
          maxChargeAmount: result.data?.maxChargeAmount,
          currency: result.data?.currency,
          restrictions: result.data?.restrictions || []
        },
        message: result.data?.eligible ? 'MSISDN is eligible for DCB' : 'MSISDN is not eligible for DCB',
        correlationId: req.correlationId
      });

    } catch (error) {
      Logger.error('Failed to check eligibility', {
        operatorCode: req.body.operatorCode,
        msisdn: req.body.msisdn ? this.maskMSISDN(req.body.msisdn) : undefined,
        error: error.message,
        userId: req.user?.id,
        correlationId: req.correlationId
      });

      if (error instanceof ValidationError) {
        return res.status(400).json({
          error: 'Validation Error',
          message: error.message,
          correlationId: req.correlationId
        });
      }

      if (error instanceof OperatorError) {
        return res.status(422).json({
          error: 'Operator Error',
          message: error.message,
          operatorCode: req.body.operatorCode,
          correlationId: req.correlationId
        });
      }

      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to check eligibility',
        correlationId: req.correlationId
      });
    }
  }

  /**
   * Get PIN configuration for operator
   */
  getPINConfig(operatorCode) {
    return this.pinConfig[operatorCode] || this.pinConfig.default;
  }

  /**
   * Mask MSISDN for logging/response (security measure)
   */
  maskMSISDN(msisdn) {
    if (!msisdn || msisdn.length < 4) {
      return '***';
    }
    return msisdn.substring(0, 3) + '***' + msisdn.substring(msisdn.length - 2);
  }

  /**
   * Validate operator supports requested language
   */
  validateLanguageSupport(operatorCode, language) {
    const config = this.pinConfig[operatorCode] || this.pinConfig.default;
    return config.languages.includes(language);
  }

  /**
   * Get supported languages for operator
   */
  getSupportedLanguages(operatorCode) {
    const config = this.pinConfig[operatorCode] || this.pinConfig.default;
    return config.languages;
  }
}

module.exports = new OTPController();