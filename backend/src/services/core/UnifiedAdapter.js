/**
 * Unified Adapter
 * 
 * Central coordination layer that abstracts operator-specific implementations
 * and provides a unified interface for all SLA Digital operations.
 */

const { getInstance: getOperatorManager } = require('./OperatorManager');
const ResponseMapper = require('./ResponseMapper');
const ErrorTranslator = require('./ErrorTranslator');
const HeaderEnrichmentService = require('./HeaderEnrichmentService');
const Logger = require('../../utils/logger');
const { OperatorError, ValidationError } = require('../../utils/errors');
const AuditLog = require('../../models/AuditLog');

class UnifiedAdapter {
  constructor() {
    // 🔧 FIXED: Use singleton getInstance() instead of new OperatorManager()
    this.operatorManager = getOperatorManager();
    this.responseMapper = new ResponseMapper();
    this.errorTranslator = new ErrorTranslator();
    this.headerEnrichment = new HeaderEnrichmentService();
  }

  /**
   * Execute operation on specified operator
   * 
   * @param {string} operatorCode - Operator code (e.g., 'zain-kw', 'stc-sa')
   * @param {string} operation - Operation to execute (e.g., 'createSubscription', 'getStatus')
   * @param {Object} params - Operation parameters
   * @param {string} userId - User ID for audit logging
   * @param {Object} options - Additional options
   * @returns {Object} Unified response object
   */
  async executeOperation(operatorCode, operation, params, userId = null, options = {}) {
    const startTime = Date.now();
    const correlationId = options.correlationId || this.generateCorrelationId();
    
    Logger.info('Unified adapter executing operation', {
      operatorCode,
      operation,
      userId,
      correlationId,
      paramsCount: Object.keys(params || {}).length
    });

    try {
      // 1. Validate operation parameters
      this.validateOperation(operatorCode, operation, params);

      // 2. Check if operator is enabled
      const isEnabled = await this.operatorManager.isOperatorEnabled(operatorCode);
      if (!isEnabled) {
        throw new OperatorError(`Operator ${operatorCode} is currently disabled`);
      }

      // 3. Get operator adapter
      const adapter = this.operatorManager.getOperatorAdapter(operatorCode);
      if (!adapter) {
        throw new OperatorError(`No adapter available for operator ${operatorCode}`);
      }

      // 4. Enrich headers if needed
      let enrichedParams = { ...params };
      if (this.requiresHeaderEnrichment(operation)) {
        try {
          const enrichedHeaders = await this.headerEnrichment.enrichHeaders(
            operatorCode,
            params.msisdn
          );
          enrichedParams.enrichedHeaders = enrichedHeaders;
        } catch (enrichError) {
          Logger.warn('Header enrichment failed, continuing without enrichment', {
            operatorCode,
            operation,
            error: enrichError.message
          });
        }
      }

      // 5. Execute operation through adapter
      const rawResult = await this.executeAdapterOperation(
        adapter,
        operation,
        enrichedParams,
        correlationId
      );

      // 6. Map response to unified format
      const unifiedResponse = this.responseMapper.mapResponse(
        operatorCode,
        operation,
        rawResult
      );

      // 7. Log successful operation
      await this.logAuditEvent(
        userId,
        operatorCode,
        operation,
        enrichedParams,
        unifiedResponse,
        Date.now() - startTime,
        true,
        correlationId
      );

      Logger.info('Operation completed successfully', {
        operatorCode,
        operation,
        duration: Date.now() - startTime,
        correlationId
      });

      return {
        success: true,
        data: unifiedResponse,
        metadata: {
          operatorCode,
          operation,
          duration: Date.now() - startTime,
          correlationId,
          timestamp: new Date().toISOString()
        }
      };

    } catch (error) {
      // 8. Handle and translate errors
      const translatedError = this.errorTranslator.translateError(
        operatorCode,
        operation,
        error
      );

      // 9. Log failed operation
      await this.logAuditEvent(
        userId,
        operatorCode,
        operation,
        params,
        null,
        Date.now() - startTime,
        false,
        correlationId,
        translatedError
      );

      Logger.error('Operation failed', {
        operatorCode,
        operation,
        error: translatedError.message,
        originalError: error.message,
        duration: Date.now() - startTime,
        correlationId
      });

      throw translatedError;
    }
  }

  /**
   * Execute operation through specific adapter
   */
  async executeAdapterOperation(adapter, operation, params, correlationId) {
    // Add correlation ID to params
    const adapterParams = {
      ...params,
      correlationId
    };

    switch (operation) {
      case 'createSubscription':
        return await adapter.createSubscription(adapterParams);
      
      case 'getSubscriptionStatus':
        return await adapter.getSubscriptionStatus(adapterParams);
      
      case 'cancelSubscription':
        return await adapter.cancelSubscription(adapterParams);
      
      case 'activateSubscription':
        return await adapter.activateSubscription(adapterParams);
      
      case 'suspendSubscription':
        return await adapter.suspendSubscription(adapterParams);
      
      case 'charge':
        return await adapter.createCharge(adapterParams);
      
      case 'refund':
        return await adapter.refund(adapterParams);
      
      case 'generatePIN':
        return await adapter.generatePIN(adapterParams);
      
      case 'verifyPIN':
        return await adapter.verifyPIN(adapterParams);
      
      case 'checkEligibility':
        return await adapter.checkEligibility(adapterParams);
      
      case 'sendSMS':
        return await adapter.sendSMS(adapterParams);
      
      case 'getBalance':
        return await adapter.getBalance(adapterParams);
      
      default:
        throw new ValidationError(`Unsupported operation: ${operation}`);
    }
  }

  /**
   * Validate operation parameters
   */
  validateOperation(operatorCode, operation, params) {
    if (!operatorCode) {
      throw new ValidationError('Operator code is required');
    }

    if (!operation) {
      throw new ValidationError('Operation is required');
    }

    if (!params || typeof params !== 'object') {
      throw new ValidationError('Parameters must be an object');
    }

    // Operation-specific validation
    switch (operation) {
      case 'createSubscription':
        this.validateSubscriptionParams(params);
        break;
      
      case 'getSubscriptionStatus':
      case 'cancelSubscription':
      case 'activateSubscription':
      case 'suspendSubscription':
        if (!params.uuid) {
          throw new ValidationError('Subscription UUID is required');
        }
        break;
      
      case 'charge':
      case 'refund':
        this.validateChargeParams(params);
        break;
      
      case 'generatePIN':
      case 'verifyPIN':
      case 'checkEligibility':
        if (!params.msisdn) {
          throw new ValidationError('MSISDN is required');
        }
        break;
    }
  }

  /**
   * Validate subscription parameters
   */
  validateSubscriptionParams(params) {
    const required = ['msisdn', 'campaign', 'merchant'];
    for (const field of required) {
      if (!params[field]) {
        throw new ValidationError(`${field} is required for subscription operations`);
      }
    }

    // MSISDN validation
    if (!/^\d{10,15}$/.test(params.msisdn)) {
      throw new ValidationError('Invalid MSISDN format');
    }
  }

  /**
   * Validate charge/refund parameters
   */
  validateChargeParams(params) {
    if (!params.msisdn) {
      throw new ValidationError('MSISDN is required');
    }
    if (!params.amount || params.amount <= 0) {
      throw new ValidationError('Valid amount is required');
    }
  }

  /**
   * Check if operation requires header enrichment
   */
  requiresHeaderEnrichment(operation) {
    const enrichmentOperations = [
      'createSubscription',
      'charge',
      'checkEligibility'
    ];
    return enrichmentOperations.includes(operation);
  }

  /**
   * Log audit event
   */
  async logAuditEvent(userId, operatorCode, operation, params, response, duration, success, correlationId, error = null) {
    try {
      await AuditLog.logAction({
        userId,
        category: 'operator',
        action: operation,
        resourceType: 'subscription',
        resourceId: params.uuid || params.msisdn,
        operatorId: null, // Will be resolved by operator code
        description: `${operation} operation on ${operatorCode}`,
        requestData: this.sanitizeParams(params),
        responseData: success ? this.sanitizeResponse(response) : null,
        processingTimeMs: duration,
        success,
        errorMessage: error?.message,
        errorCode: error?.code,
        correlationId,
        metadata: {
          operatorCode,
          operation,
          enrichmentUsed: !!params.enrichedHeaders
        }
      });
    } catch (auditError) {
      Logger.error('Failed to log audit event', {
        error: auditError.message,
        operatorCode,
        operation,
        correlationId
      });
    }
  }

  /**
   * Sanitize parameters for logging
   */
  sanitizeParams(params) {
    const sanitized = { ...params };
    
    // Remove sensitive data
    if (sanitized.pin) {
      sanitized.pin = '****';
    }
    if (sanitized.msisdn) {
      sanitized.msisdn = this.maskMSISDN(sanitized.msisdn);
    }
    if (sanitized.enrichedHeaders) {
      sanitized.enrichedHeaders = '[REDACTED]';
    }
    
    return sanitized;
  }

  /**
   * Sanitize response for logging
   */
  sanitizeResponse(response) {
    const sanitized = { ...response };
    
    // Remove sensitive response data
    if (sanitized.pin) {
      sanitized.pin = '****';
    }
    
    return sanitized;
  }

  /**
   * Mask MSISDN for logging
   */
  maskMSISDN(msisdn) {
    if (!msisdn || msisdn.length < 4) {
      return '***';
    }
    return msisdn.substring(0, 3) + '***' + msisdn.substring(msisdn.length - 2);
  }

  /**
   * Generate correlation ID for request tracking
   */
  generateCorrelationId() {
    const timestamp = Date.now().toString();
    const random = Math.random().toString(36).substring(2, 8);
    return `ua-${timestamp}-${random}`;
  }

  /**
   * Get supported operations for an operator
   */
  async getSupportedOperations(operatorCode) {
    try {
      const isEnabled = await this.operatorManager.isOperatorEnabled(operatorCode);
      if (!isEnabled) {
        throw new ValidationError(`Operator ${operatorCode} not found or disabled`);
      }

      const adapter = this.operatorManager.getOperatorAdapter(operatorCode);
      if (!adapter) {
        throw new OperatorError(`No adapter available for operator ${operatorCode}`);
      }

      // Return list of supported operations based on adapter capabilities
      return {
        subscription: {
          create: typeof adapter.createSubscription === 'function',
          status: typeof adapter.getSubscriptionStatus === 'function',
          cancel: typeof adapter.cancelSubscription === 'function',
          activate: typeof adapter.activateSubscription === 'function',
          suspend: typeof adapter.suspendSubscription === 'function'
        },
        billing: {
          charge: typeof adapter.createCharge === 'function',
          refund: typeof adapter.refund === 'function'
        },
        verification: {
          pin: typeof adapter.generatePIN === 'function',
          eligibility: typeof adapter.checkEligibility === 'function'
        },
        communication: {
          sms: typeof adapter.sendSMS === 'function'
        },
        account: {
          balance: typeof adapter.getBalance === 'function'
        }
      };
    } catch (error) {
      Logger.error('Failed to get supported operations', {
        operatorCode,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Health check for unified adapter
   */
  async healthCheck() {
    try {
      const operatorStatuses = await this.operatorManager.getAllOperatorStatuses();
      const enabledOperators = operatorStatuses.filter(op => op.enabled);
      
      return {
        healthy: true,
        operatorCount: operatorStatuses.length,
        enabledCount: enabledOperators.length,
        enabledOperators: enabledOperators.map(op => op.code),
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      Logger.error('Unified adapter health check failed', {
        error: error.message
      });
      
      return {
        healthy: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }
}

module.exports = UnifiedAdapter;