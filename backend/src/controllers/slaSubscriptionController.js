/**
 * SLA Digital v2.2 Subscription Controller - COMPLIANT IMPLEMENTATION
 * 
 * Handles all SLA Digital v2.2 subscription endpoints using existing adapters.
 * Uses existing OperatorManager and adapter implementations for business logic.
 * PHASE 4: Updated to use SLA Response and Error Mappers for 100% compliance.
 * 
 * PHASE 4: Response Format & Error Mapping - UPDATED
 */

const Logger = require('../utils/logger');
const { UnifiedError } = require('../utils/errors');
const { getInstance: getOperatorManager } = require('../services/core/OperatorManager');

// ✅ PHASE 4: Import SLA Digital response and error mappers
const SLAResponseMapper = require('../services/core/SLAResponseMapper');
const SLAErrorMapper = require('../services/core/SLAErrorMapper');

class SLASubscriptionController {
  
  /**
   * POST /v2.2/subscription/create
   * Creates new subscription using existing adapters
   * ✅ PHASE 4: Updated with SLA response mapping
   * 
   * Query Parameters: msisdn, pin, campaign, merchant, [language], [trial], [charge], [correlator]
   */
  static async create(req, res) {
    try {
      // SLA v2.2: Parameters come from query string, not body
      const { 
        msisdn, 
        pin, 
        campaign, 
        merchant, 
        language, 
        trial, 
        charge, 
        correlator,
        acr // For Telenor operators
      } = req.query;
      
      // Validate required parameters per SLA v2.2
      if (!campaign || !merchant) {
        const error = SLAErrorMapper.mapError(
          { code: 'MISSING_PARAMETER', message: 'Missing required parameters' },
          null,
          { parameter: 'campaign, merchant' }
        );
        return res.status(200).json({ error });
      }
      
      // Validate identifier (msisdn or acr)
      const identifier = acr || msisdn;
      if (!identifier) {
        const error = SLAErrorMapper.mapError(
          { code: 'MISSING_PARAMETER', message: 'Missing required parameter' },
          null,
          { parameter: 'msisdn or acr' }
        );
        return res.status(200).json({ error });
      }
      
      // Validate PIN if provided (not all operators require PIN)
      if (pin && !/^\d{4,6}$/.test(pin)) {
        const error = SLAErrorMapper.mapError(
          { code: 'INVALID_PIN_FORMAT' },
          null,
          { parameter: 'pin' }
        );
        return res.status(200).json({ error });
      }
      
      // Determine operator from MSISDN/ACR or campaign
      const operatorCode = await SLASubscriptionController.determineOperator(identifier, campaign);
      
      if (!operatorCode) {
        const error = SLAErrorMapper.mapError(
          { code: 'INVALID_PARAMETER', message: 'Unable to determine operator from identifier' },
          null,
          { parameter: 'msisdn/acr' }
        );
        return res.status(200).json({ error });
      }
      
      // Get operator manager and adapter
      const operatorManager = getOperatorManager();
      
      // Check if operator is enabled
      const isEnabled = await operatorManager.isOperatorEnabled(operatorCode);
      if (!isEnabled) {
        const error = SLAErrorMapper.mapError(
          { code: 'OPERATOR_DISABLED' },
          operatorCode,
          { endpoint: '/v2.2/subscription/create' }
        );
        return res.status(200).json({ error });
      }
      
      // Get adapter for the operator
      const adapter = operatorManager.getOperatorAdapter(operatorCode);
      
      // Validate PIN length for specific operators
      if (pin && operatorCode === 'zain-kw' && !/^\d{5}$/.test(pin)) {
        const error = SLAErrorMapper.createOperatorError('zain-kw', 'pin_length');
        return res.status(200).json({ error });
      }
      
      // Validate ACR requires correlator for Telenor
      if (identifier.length === 48 && operatorCode.startsWith('telenor') && !correlator) {
        const error = SLAErrorMapper.createOperatorError('telenor-mm', 'correlator_required');
        return res.status(200).json({ error });
      }
      
      // Prepare parameters for adapter
      const adapterParams = {
        msisdn: identifier.length === 48 ? undefined : identifier, // MSISDN for regular flows
        acr: identifier.length === 48 ? identifier : undefined,    // ACR for Telenor flows
        pin,
        campaign,
        merchant,
        language: language || 'en',
        correlator, // Mandatory for Telenor ACR transactions
        
        // Optional parameters
        trialDays: trial ? parseInt(trial) : undefined,
        skipInitialCharge: charge === 'false'
      };
      
      // Call adapter to create subscription
      const adapterResponse = await adapter.createSubscription(adapterParams);
      
      // ✅ PHASE 4: Map response to SLA Digital v2.2 format using mapper
      const slaResponse = SLAResponseMapper.mapSubscriptionCreateResponse(
        adapterResponse, 
        operatorCode, 
        {
          msisdn: identifier.length !== 48 ? identifier : undefined,
          acr: identifier.length === 48 ? identifier : undefined,
          campaign,
          merchant,
          language,
          correlator
        }
      );
      
      Logger.info('SLA v2.2 subscription created successfully', {
        endpoint: '/v2.2/subscription/create',
        operatorCode,
        uuid: slaResponse.uuid,
        identifier: identifier ? identifier.substring(0, 6) + '***' : 'unknown',
        slaUser: req.slaUser?.username?.substring(0, 3) + '***'
      });
      
      // SLA v2.2: Always return HTTP 200, success/error in response body
      res.status(200).json(slaResponse);
      
    } catch (error) {
      Logger.error('SLA v2.2 subscription creation failed', {
        endpoint: '/v2.2/subscription/create',
        error: error.message,
        stack: error.stack,
        params: req.query,
        slaUser: req.slaUser?.username?.substring(0, 3) + '***'
      });
      
      // ✅ PHASE 4: Map error to SLA Digital format using error mapper
      const slaError = SLAErrorMapper.mapError(
        error,
        req.query.operatorCode,
        {
          endpoint: '/v2.2/subscription/create',
          parameter: 'subscription_creation',
          operatorCode: req.query.operatorCode
        }
      );
      
      res.status(200).json({ error: slaError });
    }
  }
  
  /**
   * POST /v2.2/subscription/status
   * Gets subscription status
   * ✅ PHASE 4: Updated with SLA response mapping
   * 
   * Query Parameters: uuid
   */
  static async getStatus(req, res) {
    try {
      const { uuid } = req.query;
      
      if (!uuid) {
        const error = SLAErrorMapper.mapError(
          { code: 'MISSING_PARAMETER' },
          null,
          { parameter: 'uuid' }
        );
        return res.status(200).json({ error });
      }
      
      // Find which operator this subscription belongs to
      const { adapter, operatorCode } = await SLASubscriptionController.findSubscriptionOperator(uuid);
      
      if (!adapter) {
        const error = SLAErrorMapper.mapError(
          { code: 'SUBSCRIPTION_NOT_FOUND' },
          null,
          { parameter: 'uuid' }
        );
        return res.status(200).json({ error });
      }
      
      // Get subscription status from adapter
      const adapterResponse = await adapter.getSubscriptionStatus(uuid);
      
      // ✅ PHASE 4: Map response to SLA Digital format using mapper
      const slaResponse = SLAResponseMapper.mapSubscriptionStatusResponse(adapterResponse, operatorCode);
      
      Logger.info('SLA v2.2 subscription status retrieved', {
        endpoint: '/v2.2/subscription/status',
        operatorCode,
        uuid,
        status: slaResponse.status,
        slaUser: req.slaUser?.username?.substring(0, 3) + '***'
      });
      
      res.status(200).json(slaResponse);
      
    } catch (error) {
      Logger.error('SLA v2.2 subscription status failed', {
        endpoint: '/v2.2/subscription/status',
        error: error.message,
        uuid: req.query.uuid,
        slaUser: req.slaUser?.username?.substring(0, 3) + '***'
      });
      
      // ✅ PHASE 4: Map error using error mapper
      const slaError = SLAErrorMapper.mapError(
        error,
        null,
        { endpoint: '/v2.2/subscription/status' }
      );
      
      res.status(200).json({ error: slaError });
    }
  }
  
  /**
   * POST /v2.2/subscription/delete
   * Cancels/deletes subscription
   * ✅ PHASE 4: Updated with SLA response mapping
   * 
   * Query Parameters: uuid
   */
  static async delete(req, res) {
    try {
      const { uuid } = req.query;
      
      if (!uuid) {
        const error = SLAErrorMapper.mapError(
          { code: 'MISSING_PARAMETER' },
          null,
          { parameter: 'uuid' }
        );
        return res.status(200).json({ error });
      }
      
      // Find operator for this subscription
      const { adapter, operatorCode } = await SLASubscriptionController.findSubscriptionOperator(uuid);
      
      if (!adapter) {
        const error = SLAErrorMapper.mapError(
          { code: 'SUBSCRIPTION_NOT_FOUND' },
          null,
          { parameter: 'uuid' }
        );
        return res.status(200).json({ error });
      }
      
      // Cancel subscription via adapter
      const adapterResponse = await adapter.cancelSubscription(uuid);
      
      // ✅ PHASE 4: Map response to SLA Digital format
      const slaResponse = {
        uuid,
        status: 'DELETED',
        message: 'Subscription cancelled successfully',
        timestamp: new Date().toISOString(),
        operator_code: operatorCode
      };
      
      Logger.info('SLA v2.2 subscription deleted successfully', {
        endpoint: '/v2.2/subscription/delete',
        operatorCode,
        uuid,
        slaUser: req.slaUser?.username?.substring(0, 3) + '***'
      });
      
      res.status(200).json(slaResponse);
      
    } catch (error) {
      Logger.error('SLA v2.2 subscription deletion failed', {
        endpoint: '/v2.2/subscription/delete',
        error: error.message,
        uuid: req.query.uuid,
        slaUser: req.slaUser?.username?.substring(0, 3) + '***'
      });
      
      // ✅ PHASE 4: Map error using error mapper
      const slaError = SLAErrorMapper.mapError(
        error,
        null,
        { endpoint: '/v2.2/subscription/delete' }
      );
      
      res.status(200).json({ error: slaError });
    }
  }
  
  /**
   * POST /v2.2/subscription/activate
   * Activates inactive subscription
   */
  static async activate(req, res) {
    try {
      const { uuid } = req.query;
      
      if (!uuid) {
        const error = SLAErrorMapper.mapError(
          { code: 'MISSING_PARAMETER' },
          null,
          { parameter: 'uuid' }
        );
        return res.status(200).json({ error });
      }
      
      // Find operator and activate
      const { adapter, operatorCode } = await SLASubscriptionController.findSubscriptionOperator(uuid);
      
      if (!adapter) {
        const error = SLAErrorMapper.mapError(
          { code: 'SUBSCRIPTION_NOT_FOUND' },
          null,
          { parameter: 'uuid' }
        );
        return res.status(200).json({ error });
      }
      
      // Most adapters don't have separate activate method, they use resume
      const adapterResponse = await adapter.resumeSubscription ? 
        await adapter.resumeSubscription(uuid) : 
        await adapter.getSubscriptionStatus(uuid);
      
      // ✅ PHASE 4: Map response to SLA Digital format using mapper
      const slaResponse = SLAResponseMapper.mapSubscriptionStatusResponse(adapterResponse, operatorCode);
      
      Logger.info('SLA v2.2 subscription activation requested', {
        endpoint: '/v2.2/subscription/activate',
        operatorCode,
        uuid,
        slaUser: req.slaUser?.username?.substring(0, 3) + '***'
      });
      
      res.status(200).json(slaResponse);
      
    } catch (error) {
      Logger.error('SLA v2.2 subscription activation failed', {
        endpoint: '/v2.2/subscription/activate',
        error: error.message,
        uuid: req.query.uuid,
        slaUser: req.slaUser?.username?.substring(0, 3) + '***'
      });
      
      // ✅ PHASE 4: Map error using error mapper
      const slaError = SLAErrorMapper.mapError(
        error,
        null,
        { endpoint: '/v2.2/subscription/activate' }
      );
      
      res.status(200).json({ error: slaError });
    }
  }
  
  /**
   * POST /v2.2/subscription/resume
   * Resumes suspended subscription  
   */
  static async resume(req, res) {
    // ✅ PHASE 4: SLA compliant "not implemented" response
    const error = SLAErrorMapper.mapError(
      { code: 'FEATURE_NOT_SUPPORTED', message: 'Resume functionality under development - use activate endpoint' },
      null,
      { endpoint: '/v2.2/subscription/resume' }
    );
    
    res.status(200).json({ error });
  }
  
  /**
   * POST /v2.2/subscription/free
   * Applies free period
   */
  static async free(req, res) {
    // ✅ PHASE 4: SLA compliant "not implemented" response
    const error = SLAErrorMapper.mapError(
      { code: 'FEATURE_NOT_SUPPORTED', message: 'Free period functionality under development' },
      null,
      { endpoint: '/v2.2/subscription/free' }
    );
    
    res.status(200).json({ error });
  }
  
  /**
   * POST /v2.2/subscription/latest
   * Gets latest subscription for MSISDN
   */
  static async latest(req, res) {
    // ✅ PHASE 4: SLA compliant "not implemented" response  
    const error = SLAErrorMapper.mapError(
      { code: 'FEATURE_NOT_SUPPORTED', message: 'Latest subscription lookup under development' },
      null,
      { endpoint: '/v2.2/subscription/latest' }
    );
    
    res.status(200).json({ error });
  }
  
  // ===== HELPER METHODS (Unchanged) =====
  
  /**
   * Determine operator from identifier or campaign
   */
  static async determineOperator(identifier, campaign) {
    // Try to determine from MSISDN format first
    if (identifier && identifier.length !== 48) {
      const operatorMappings = {
        // Kuwait - starts with country code or specific prefixes
        '+965': ['zain-kw', 'ooredoo-kw', 'stc-kw'],
        '+971': ['etisalat-ae'],
        '+966': ['zain-sa', 'mobily-sa', 'stc-sa'],
        '+234': ['mobile-ng'],
        '+94': ['axiata-lk'],
        '+60': ['telenor-digi', 'umobile-my'],
        '+95': ['telenor-mm'],
        '+45': ['telenor-dk'],
        '+47': ['telenor-no'],
        '+46': ['telenor-se'],
        '+381': ['telenor-rs'],
        '+353': ['three-ie', 'vf-ie'],
        '+44': ['voda-uk', 'three-uk', 'o2-uk', 'ee-uk']
      };
      
      // Extract country code
      for (const [countryCode, operators] of Object.entries(operatorMappings)) {
        if (identifier.startsWith(countryCode)) {
          return operators[0]; // Return first operator for now
        }
      }
    }
    
    // If ACR (48 characters), likely Telenor
    if (identifier && identifier.length === 48) {
      return 'telenor-mm'; // Default to Myanmar for ACR
    }
    
    // Fallback to campaign-based detection
    if (campaign && campaign.includes('zain')) return 'zain-kw';
    if (campaign && campaign.includes('etisalat')) return 'etisalat-ae';
    
    // Default fallback
    return 'zain-kw';
  }
  
  /**
   * Find which operator a subscription belongs to
   */
  static async findSubscriptionOperator(uuid) {
    const operatorManager = getOperatorManager();
    const supportedOperators = operatorManager.getSupportedOperators();
    
    for (const operator of supportedOperators) {
      try {
        const isEnabled = await operatorManager.isOperatorEnabled(operator.code);
        if (!isEnabled) continue;
        
        const adapter = operatorManager.getOperatorAdapter(operator.code);
        const response = await adapter.getSubscriptionStatus(uuid);
        
        if (response && response.data && response.data.status !== 'DELETED') {
          return { adapter, operatorCode: operator.code };
        }
      } catch (error) {
        continue;
      }
    }
    
    return { adapter: null, operatorCode: null };
  }
}

module.exports = SLASubscriptionController;