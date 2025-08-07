/**
 * Billing Controller
 * 
 * Handles billing operations including charges, refunds, and transaction management
 * for the SLA Digital unified platform.
 */

const UnifiedAdapter = require('../services/core/UnifiedAdapter');
const Logger = require('../utils/logger');
const { ValidationError, OperatorError } = require('../utils/errors');
const { validationResult } = require('express-validator');

class BillingController {
  constructor() {
    this.unifiedAdapter = new UnifiedAdapter();
  }

  /**
   * Process one-time charge
   */
  async processCharge(req, res) {
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
        amount,
        currency,
        description,
        metadata = {}
      } = req.body;

      // Validate required fields
      if (!operatorCode || !msisdn || !amount) {
        return res.status(400).json({
          error: 'Missing required fields',
          required: ['operatorCode', 'msisdn', 'amount']
        });
      }

      // Validate amount
      if (typeof amount !== 'number' || amount <= 0) {
        return res.status(400).json({
          error: 'Invalid amount',
          message: 'Amount must be a positive number'
        });
      }

      // Process charge through unified adapter
      const result = await this.unifiedAdapter.executeOperation(
        operatorCode,
        'charge',
        {
          msisdn,
          amount,
          currency,
          description,
          metadata
        },
        req.user?.id,
        {
          correlationId: req.correlationId
        }
      );

      Logger.operatorAction(operatorCode, 'charge', result, {
        msisdn: this.maskMSISDN(msisdn),
        amount,
        currency,
        userId: req.user?.id
      });

      res.status(200).json({
        success: true,
        data: result.data,
        message: 'Charge processed successfully',
        correlationId: req.correlationId
      });

    } catch (error) {
      Logger.error('Failed to process charge', {
        operatorCode: req.body.operatorCode,
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
          correlationId: req.correlationId
        });
      }

      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to process charge',
        correlationId: req.correlationId
      });
    }
  }

  /**
   * Process refund
   */
  async processRefund(req, res) {
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
        transactionId,
        amount,
        reason,
        metadata = {}
      } = req.body;

      // Validate required fields
      if (!operatorCode || !transactionId) {
        return res.status(400).json({
          error: 'Missing required fields',
          required: ['operatorCode', 'transactionId']
        });
      }

      // Process refund through unified adapter
      const result = await this.unifiedAdapter.executeOperation(
        operatorCode,
        'refund',
        {
          transactionId,
          amount,
          reason,
          metadata
        },
        req.user?.id,
        {
          correlationId: req.correlationId
        }
      );

      Logger.operatorAction(operatorCode, 'refund', result, {
        transactionId,
        amount,
        reason,
        userId: req.user?.id
      });

      res.status(200).json({
        success: true,
        data: result.data,
        message: 'Refund processed successfully',
        correlationId: req.correlationId
      });

    } catch (error) {
      Logger.error('Failed to process refund', {
        operatorCode: req.body.operatorCode,
        transactionId: req.body.transactionId,
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
          correlationId: req.correlationId
        });
      }

      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to process refund',
        correlationId: req.correlationId
      });
    }
  }

  /**
   * Get transaction history
   */
  async getTransactions(req, res) {
    try {
      const {
        operatorCode,
        msisdn,
        startDate,
        endDate,
        status,
        type,
        page = 1,
        limit = 50
      } = req.query;

      // Build filters
      const filters = {};
      
      if (operatorCode) filters.operatorCode = operatorCode;
      if (msisdn) filters.msisdn = msisdn;
      if (status) filters.status = status;
      if (type) filters.type = type;
      if (startDate) filters.startDate = startDate;
      if (endDate) filters.endDate = endDate;

      // For now, return mock data since we don't have the transaction service implemented
      const mockTransactions = {
        data: [
          {
            id: 'txn_123456',
            operatorCode: operatorCode || 'zain-kw',
            msisdn: msisdn ? this.maskMSISDN(msisdn) : '965***890',
            type: 'charge',
            status: 'success',
            amount: 5.00,
            currency: 'KWD',
            description: 'Subscription charge',
            timestamp: new Date().toISOString()
          }
        ],
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: 1,
          pages: 1
        }
      };

      Logger.info('Transaction history retrieved', {
        filters,
        count: mockTransactions.data.length,
        userId: req.user?.id
      });

      res.status(200).json({
        success: true,
        ...mockTransactions
      });

    } catch (error) {
      Logger.error('Failed to get transactions', {
        error: error.message,
        userId: req.user?.id
      });

      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to retrieve transactions'
      });
    }
  }

  /**
   * Get specific transaction details
   */
  async getTransaction(req, res) {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({
          error: 'Transaction ID is required'
        });
      }

      // For now, return mock data since we don't have the transaction service implemented
      const mockTransaction = {
        id: id,
        operatorCode: 'zain-kw',
        msisdn: '965***890',
        type: 'charge',
        status: 'success',
        amount: 5.00,
        currency: 'KWD',
        description: 'Subscription charge',
        timestamp: new Date().toISOString(),
        details: {
          subscriptionId: 'sub_123456',
          campaign: 'test-campaign',
          merchant: 'test-merchant'
        },
        operatorResponse: {
          transactionId: 'op_txn_789',
          operatorStatus: 'CHARGED',
          processingTime: '1234ms'
        }
      };

      Logger.info('Transaction details retrieved', {
        transactionId: id,
        userId: req.user?.id
      });

      res.status(200).json({
        success: true,
        data: mockTransaction
      });

    } catch (error) {
      Logger.error('Failed to get transaction details', {
        transactionId: req.params.id,
        error: error.message,
        userId: req.user?.id
      });

      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to retrieve transaction details'
      });
    }
  }

  /**
   * Mask MSISDN for logging/response
   */
  maskMSISDN(msisdn) {
    if (!msisdn || msisdn.length < 4) {
      return '***';
    }
    return msisdn.substring(0, 3) + '***' + msisdn.substring(msisdn.length - 2);
  }
}

module.exports = new BillingController();