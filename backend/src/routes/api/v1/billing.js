/**
 * Billing API Routes
 * 
 * /api/v1/billing - Billing and transaction endpoints
 */

const express = require('express');
const billingController = require('../../../controllers/billingController');
const { operatorActionLogger } = require('../../../middleware/logging');
const { requireOperatorAccess } = require('../../../middleware/auth');

const router = express.Router();

/**
 * @route   POST /api/v1/billing/charge
 * @desc    Process one-time charge
 * @access  Private (operator+)
 */
router.post('/charge', 
  requireOperatorAccess,
  operatorActionLogger('charge'),
  billingController.processCharge
);

/**
 * @route   POST /api/v1/billing/refund
 * @desc    Process refund
 * @access  Private (operator+)
 */
router.post('/refund', 
  requireOperatorAccess,
  operatorActionLogger('refund'),
  billingController.processRefund
);

/**
 * @route   GET /api/v1/billing/transactions
 * @desc    Get transaction history
 * @access  Private (operator+)
 */
router.get('/transactions', 
  requireOperatorAccess,
  billingController.getTransactions
);

/**
 * @route   GET /api/v1/billing/transactions/:id
 * @desc    Get transaction details
 * @access  Private (operator+)
 */
router.get('/transactions/:id', 
  requireOperatorAccess,
  billingController.getTransaction
);

module.exports = router;