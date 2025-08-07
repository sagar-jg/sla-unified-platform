/**
 * Operator Routes - FIXED: Complete implementation with business logic
 * 
 * API endpoints for operator management and operations
 * Now includes full CRUD operations and integration with OperatorManager
 */

const express = require('express');
const router = express.Router();
const Logger = require('../../../utils/logger');
const { UnifiedError } = require('../../../utils/errors');

// Import OperatorManager singleton
const { getInstance: getOperatorManager } = require('../../../services/core/OperatorManager');

const operatorController = {
  /**
   * GET /api/v1/operators - List all operators with status
   */
  async listOperators(req, res) {
    try {
      const operatorManager = getOperatorManager();
      
      // Get all operator statuses from database
      const operators = await operatorManager.getAllOperatorStatuses();
      
      // Get supported operators from documentation
      const supportedOperators = operatorManager.getSupportedOperators();
      
      // Get statistics
      const statistics = operatorManager.getOperatorStatistics();
      
      Logger.info('Operators list requested', {
        totalOperators: operators.length,
        enabledOperators: statistics.enabled,
        userId: req.user?.id
      });
      
      res.json({
        success: true,
        message: 'Operators retrieved successfully',
        data: {
          operators,
          supportedOperators,
          statistics
        },
        metadata: {
          total: operators.length,
          enabled: statistics.enabled,
          disabled: statistics.disabled,
          compliance: 'SLA Digital v2.2 Documentation Aligned'
        }
      });
      
    } catch (error) {
      Logger.error('Failed to list operators', {
        error: error.message,
        stack: error.stack,
        userId: req.user?.id
      });
      
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve operators',
        error: error.message
      });
    }
  },

  /**
   * GET /api/v1/operators/:code - Get specific operator details
   */
  async getOperator(req, res) {
    try {
      const { code } = req.params;
      const operatorManager = getOperatorManager();
      
      // Check if operator exists in supported list
      const supportedOperators = operatorManager.getSupportedOperators();
      const operatorInfo = supportedOperators.find(op => op.code === code);
      
      if (!operatorInfo) {
        return res.status(404).json({
          success: false,
          message: `Operator ${code} not found in SLA Digital documentation`,
          availableOperators: supportedOperators.map(op => op.code)
        });
      }
      
      // Get operator status from database
      const operators = await operatorManager.getAllOperatorStatuses();
      const operatorStatus = operators.find(op => op.code === code);
      
      // Check if operator adapter is available
      let adapterAvailable = false;
      let adapterError = null;
      
      try {
        const adapter = operatorManager.getOperatorAdapter(code);
        adapterAvailable = !!adapter;
      } catch (error) {
        adapterError = error.message;
      }
      
      Logger.info('Operator details requested', {
        operatorCode: code,
        adapterAvailable,
        userId: req.user?.id
      });
      
      res.json({
        success: true,
        message: `Operator ${code} details retrieved successfully`,
        data: {
          ...operatorInfo,
          status: operatorStatus,
          adapterAvailable,
          adapterError
        }
      });
      
    } catch (error) {
      Logger.error('Failed to get operator details', {
        operatorCode: req.params.code,
        error: error.message,
        stack: error.stack,
        userId: req.user?.id
      });
      
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve operator details',
        error: error.message
      });
    }
  },
  
  /**
   * POST /api/v1/operators/:code/enable - Enable operator
   */
  async enableOperator(req, res) {
    try {
      const { code } = req.params;
      const { reason } = req.body;
      const userId = req.user?.id;
      
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required to enable operators'
        });
      }
      
      const operatorManager = getOperatorManager();
      
      const result = await operatorManager.enableOperator(code, userId, reason);
      
      Logger.info('Operator enabled successfully', {
        operatorCode: code,
        userId,
        reason
      });
      
      res.json(result);
      
    } catch (error) {
      Logger.error('Failed to enable operator', {
        operatorCode: req.params.code,
        error: error.message,
        stack: error.stack,
        userId: req.user?.id
      });
      
      const statusCode = error instanceof UnifiedError ? 400 : 500;
      
      res.status(statusCode).json({
        success: false,
        message: 'Failed to enable operator',
        error: error.message
      });
    }
  },
  
  /**
   * POST /api/v1/operators/:code/disable - Disable operator
   */
  async disableOperator(req, res) {
    try {
      const { code } = req.params;
      const { reason } = req.body;
      const userId = req.user?.id;
      
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required to disable operators'
        });
      }
      
      if (!reason) {
        return res.status(400).json({
          success: false,
          message: 'Reason is required to disable an operator'
        });
      }
      
      const operatorManager = getOperatorManager();
      
      const result = await operatorManager.disableOperator(code, userId, reason);
      
      Logger.info('Operator disabled successfully', {
        operatorCode: code,
        userId,
        reason
      });
      
      res.json(result);
      
    } catch (error) {
      Logger.error('Failed to disable operator', {
        operatorCode: req.params.code,
        error: error.message,
        stack: error.stack,
        userId: req.user?.id
      });
      
      const statusCode = error instanceof UnifiedError ? 400 : 500;
      
      res.status(statusCode).json({
        success: false,
        message: 'Failed to disable operator',
        error: error.message
      });
    }
  },
  
  /**
   * GET /api/v1/operators/:code/status - Check operator enable/disable status
   */
  async getOperatorStatus(req, res) {
    try {
      const { code } = req.params;
      const operatorManager = getOperatorManager();
      
      const isEnabled = await operatorManager.isOperatorEnabled(code);
      
      res.json({
        success: true,
        data: {
          operatorCode: code,
          enabled: isEnabled,
          timestamp: new Date().toISOString()
        }
      });
      
    } catch (error) {
      Logger.error('Failed to get operator status', {
        operatorCode: req.params.code,
        error: error.message,
        userId: req.user?.id
      });
      
      res.status(500).json({
        success: false,
        message: 'Failed to get operator status',
        error: error.message
      });
    }
  },
  
  /**
   * GET /api/v1/operators/statistics - Get operator statistics and compliance info
   */
  async getStatistics(req, res) {
    try {
      const operatorManager = getOperatorManager();
      
      const statistics = operatorManager.getOperatorStatistics();
      const supportedOperators = operatorManager.getSupportedOperators();
      
      // Additional compliance information
      const complianceInfo = {
        totalDocumentedOperators: supportedOperators.length,
        implementedOperators: supportedOperators.filter(op => op.status !== 'needs_implementation').length,
        missingOperators: supportedOperators.filter(op => op.status === 'needs_implementation'),
        compliancePercentage: Math.round((supportedOperators.filter(op => op.status !== 'needs_implementation').length / supportedOperators.length) * 100)
      };
      
      res.json({
        success: true,
        message: 'Operator statistics retrieved successfully',
        data: {
          statistics,
          compliance: complianceInfo,
          lastUpdated: new Date().toISOString()
        }
      });
      
    } catch (error) {
      Logger.error('Failed to get operator statistics', {
        error: error.message,
        userId: req.user?.id
      });
      
      res.status(500).json({
        success: false,
        message: 'Failed to get operator statistics',
        error: error.message
      });
    }
  }
};

// Define routes with proper HTTP methods
router.get('/', operatorController.listOperators);
router.get('/statistics', operatorController.getStatistics);
router.get('/:code', operatorController.getOperator);
router.get('/:code/status', operatorController.getOperatorStatus);
router.post('/:code/enable', operatorController.enableOperator);
router.post('/:code/disable', operatorController.disableOperator);

module.exports = router;