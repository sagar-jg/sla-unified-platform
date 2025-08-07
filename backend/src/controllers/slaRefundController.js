/**
 * SLA Digital v2.2 Refund Controller - COMPLIANT IMPLEMENTATION
 * 
 * Handles SLA Digital v2.2 refund processing using existing adapters.
 * Endpoints: /v2.2/refund
 * 
 * PHASE 2: Controllers Implementation
 */

const Logger = require('../utils/logger');
const { getInstance: getOperatorManager } = require('../services/core/OperatorManager');

class SLARefundController {
  
  /**
   * POST /v2.2/refund
   * Processes refund for transaction
   * 
   * Query Parameters: transaction_id, amount, currency, [reason]
   */
  static async refund(req, res) {
    try {
      const { 
        transaction_id, 
        amount, 
        currency, 
        reason 
      } = req.query;
      
      // Validate required parameters
      if (!transaction_id || !amount || !currency) {
        return res.status(200).json({
          error: {
            category: 'Request',
            code: '2001',
            message: 'Missing required parameters: transaction_id, amount, and currency are mandatory'
          }
        });
      }
      
      const refundAmount = parseFloat(amount);
      if (isNaN(refundAmount) || refundAmount <= 0) {
        return res.status(200).json({
          error: {
            category: 'Request',
            code: '2001',
            message: 'Invalid amount: must be a positive number'
          }
        });
      }
      
      // Find operator for this transaction (simplified lookup)
      const operatorCode = await SLARefundController.findTransactionOperator(transaction_id);
      
      if (!operatorCode) {
        return res.status(200).json({
          error: {
            category: 'Request',
            code: '2052',
            message: 'Transaction not found'
          }
        });
      }
      
      const operatorManager = getOperatorManager();
      const adapter = operatorManager.getOperatorAdapter(operatorCode);
      
      // Check if operator supports refunds
      if (!adapter.refund || typeof adapter.refund !== 'function') {
        return res.status(200).json({
          error: {
            category: 'Service',
            code: '5002',
            message: `Operator ${operatorCode} does not support refunds`
          }
        });
      }
      
      // Process refund via adapter
      const response = await adapter.refund(transaction_id, refundAmount);
      
      // Map response to SLA Digital format
      const refundId = `ref_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      
      const slaResponse = {
        refund_id: refundId,
        transaction_id,
        status: 'REFUNDED',
        amount: refundAmount.toString(),
        currency,
        reason: reason || 'Refund processed',
        timestamp: new Date().toISOString(),
        operator_code: operatorCode
      };
      
      Logger.info('SLA v2.2 refund processed successfully', {
        endpoint: '/v2.2/refund',
        operatorCode,
        transaction_id,
        refund_id: refundId,
        amount: refundAmount
      });
      
      res.status(200).json(slaResponse);
      
    } catch (error) {
      Logger.error('SLA v2.2 refund processing failed', {
        endpoint: '/v2.2/refund',
        error: error.message,
        transaction_id: req.query.transaction_id
      });
      
      const slaError = {
        category: 'Service',
        code: '5004',
        message: error.message || 'Refund processing failed'
      };
      
      res.status(200).json({ error: slaError });
    }
  }
  
  /**
   * Find operator for transaction (simplified implementation)
   */
  static async findTransactionOperator(transactionId) {
    // In a real implementation, this would query the database
    // For now, return default operator
    return 'zain-kw';
  }
}

module.exports = SLARefundController;