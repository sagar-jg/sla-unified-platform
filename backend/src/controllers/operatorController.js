/**
 * Operator Controller
 * 
 * Handles operator management API endpoints (admin only)
 */

const { getInstance: getOperatorManager } = require('../services/core/OperatorManager');
const { Operator, AuditLog } = require('../models');
const { ValidationError } = require('../utils/errors');
const { asyncHandler } = require('../middleware/errorHandler');
const Logger = require('../utils/logger');

class OperatorController {
  constructor() {
    // 🔧 FIXED: Use singleton getInstance() instead of new OperatorManager()
    this.operatorManager = getOperatorManager();
  }
  
  /**
   * Get all operators
   */
  getAllOperators = asyncHandler(async (req, res) => {
    const operators = await this.operatorManager.getAllOperatorStatuses();
    
    res.json({
      success: true,
      data: operators,
      total: operators.length
    });
  });
  
  /**
   * Get specific operator details
   */
  getOperator = asyncHandler(async (req, res) => {
    const { code } = req.params;
    
    const operator = await Operator.findOne({
      where: { code },
      attributes: {
        exclude: ['credentials'] // Never expose credentials
      }
    });
    
    if (!operator) {
      return res.status(404).json({
        error: {
          code: 'OPERATOR_NOT_FOUND',
          message: `Operator ${code} not found`
        }
      });
    }
    
    res.json({
      success: true,
      data: operator
    });
  });
  
  /**
   * Enable operator
   */
  enableOperator = asyncHandler(async (req, res) => {
    const { code } = req.params;
    const { reason } = req.body;
    
    Logger.info('Enabling operator', {
      operatorCode: code,
      reason,
      userId: req.user.id,
      userEmail: req.user.email
    });
    
    const result = await this.operatorManager.enableOperator(code, req.user.id, reason);
    
    res.json({
      success: true,
      data: result,
      message: `Operator ${code} enabled successfully`
    });
  });
  
  /**
   * Disable operator
   */
  disableOperator = asyncHandler(async (req, res) => {
    const { code } = req.params;
    const { reason } = req.body;
    
    if (!reason) {
      throw new ValidationError('Reason is required to disable an operator');
    }
    
    Logger.info('Disabling operator', {
      operatorCode: code,
      reason,
      userId: req.user.id,
      userEmail: req.user.email
    });
    
    const result = await this.operatorManager.disableOperator(code, req.user.id, reason);
    
    res.json({
      success: true,
      data: result,
      message: `Operator ${code} disabled successfully`
    });
  });
  
  /**
   * Bulk enable operators
   */
  enableAllOperators = asyncHandler(async (req, res) => {
    const { reason, operatorCodes } = req.body;
    
    Logger.info('Bulk enabling operators', {
      operatorCodes: operatorCodes || 'all',
      reason,
      userId: req.user.id
    });
    
    let results = [];
    
    if (operatorCodes && Array.isArray(operatorCodes)) {
      // Enable specific operators
      for (const code of operatorCodes) {
        try {
          const result = await this.operatorManager.enableOperator(code, req.user.id, reason);
          results.push({ operatorCode: code, success: true, result });
        } catch (error) {
          results.push({ operatorCode: code, success: false, error: error.message });
        }
      }
    } else {
      // Enable all operators
      const operators = await Operator.findAll({ attributes: ['code'] });
      
      for (const operator of operators) {
        try {
          const result = await this.operatorManager.enableOperator(operator.code, req.user.id, reason);
          results.push({ operatorCode: operator.code, success: true, result });
        } catch (error) {
          results.push({ operatorCode: operator.code, success: false, error: error.message });
        }
      }
    }
    
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    
    res.json({
      success: true,
      data: {
        results,
        summary: {
          total: results.length,
          successful,
          failed
        }
      },
      message: `Bulk operation completed: ${successful} successful, ${failed} failed`
    });
  });
  
  /**
   * Get operator statistics
   */
  getOperatorStats = asyncHandler(async (req, res) => {
    const { code } = req.params;
    const { timeRange = '24h' } = req.query;
    
    const operator = await Operator.findOne({ where: { code } });
    
    if (!operator) {
      return res.status(404).json({
        error: {
          code: 'OPERATOR_NOT_FOUND',
          message: `Operator ${code} not found`
        }
      });
    }
    
    // Get operator statistics
    const stats = this.operatorManager.getOperatorStatistics();
    
    res.json({
      success: true,
      data: {
        operator: {
          code: operator.code,
          name: operator.name,
          enabled: operator.enabled,
          healthScore: operator.healthScore,
          lastHealthCheck: operator.lastHealthCheck
        },
        statistics: stats,
        timeRange
      }
    });
  });
  
  /**
   * Test operator connectivity
   */
  testOperator = asyncHandler(async (req, res) => {
    const { code } = req.params;
    const { testMSISDN } = req.body;
    
    Logger.info('Testing operator connectivity', {
      operatorCode: code,
      testMSISDN: testMSISDN ? this.maskMSISDN(testMSISDN) : 'default',
      userId: req.user.id
    });
    
    const operator = await Operator.findOne({ where: { code } });
    
    if (!operator) {
      return res.status(404).json({
        error: {
          code: 'OPERATOR_NOT_FOUND',
          message: `Operator ${code} not found`
        }
      });
    }
    
    const msisdn = testMSISDN || operator.config.healthCheckMSISDN || '1234567890';
    
    try {
      const startTime = Date.now();
      
      // Test connectivity by checking if operator is enabled and getting adapter
      const isEnabled = await this.operatorManager.isOperatorEnabled(code);
      if (!isEnabled) {
        throw new Error('Operator is disabled');
      }
      
      const adapter = this.operatorManager.getOperatorAdapter(code);
      
      // Test eligibility check as a connectivity test
      await adapter.checkEligibility(msisdn);
      
      const responseTime = Date.now() - startTime;
      
      res.json({
        success: true,
        data: {
          operatorCode: code,
          connectivity: 'healthy',
          responseTime: `${responseTime}ms`,
          timestamp: new Date().toISOString()
        },
        message: 'Operator connectivity test successful'
      });
      
    } catch (error) {
      Logger.error('Operator connectivity test failed', {
        operatorCode: code,
        error: error.message,
        userId: req.user.id
      });
      
      res.status(502).json({
        success: false,
        data: {
          operatorCode: code,
          connectivity: 'unhealthy',
          error: error.message,
          timestamp: new Date().toISOString()
        },
        message: 'Operator connectivity test failed'
      });
    }
  });
  
  /**
   * Get operator audit logs
   */
  getOperatorAuditLogs = asyncHandler(async (req, res) => {
    const { code } = req.params;
    const { page = 1, limit = 50, action } = req.query;
    
    const operator = await Operator.findOne({ where: { code } });
    
    if (!operator) {
      return res.status(404).json({
        error: {
          code: 'OPERATOR_NOT_FOUND',
          message: `Operator ${code} not found`
        }
      });
    }
    
    const whereClause = { operatorId: operator.id };
    if (action) {
      whereClause.action = action;
    }
    
    const { count, rows: auditLogs } = await AuditLog.findAndCountAll({
      where: whereClause,
      include: [{
        model: require('../models').User,
        as: 'user',
        attributes: ['id', 'email', 'firstName', 'lastName']
      }],
      order: [['createdAt', 'DESC']],
      limit: Math.min(parseInt(limit), 100),
      offset: (parseInt(page) - 1) * parseInt(limit)
    });
    
    res.json({
      success: true,
      data: auditLogs.map(log => ({
        id: log.id,
        action: log.action,
        resourceType: log.resourceType,
        resourceId: log.resourceId,
        oldValues: log.oldValues,
        newValues: log.newValues,
        metadata: log.metadata,
        user: log.user ? {
          id: log.user.id,
          email: log.user.email,
          name: log.user.getFullName()
        } : null,
        createdAt: log.createdAt
      })),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count,
        pages: Math.ceil(count / parseInt(limit))
      }
    });
  });
  
  /**
   * Mask MSISDN for privacy
   */
  maskMSISDN(msisdn) {
    if (!msisdn || msisdn.length < 4) {
      return '***';
    }
    return msisdn.substring(0, 3) + '***' + msisdn.substring(msisdn.length - 2);
  }
}

module.exports = new OperatorController();