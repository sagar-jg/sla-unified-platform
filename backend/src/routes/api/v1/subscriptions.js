/**
 * Subscription API Routes
 * 
 * /api/v1/subscriptions - Subscription management endpoints
 */

const express = require('express');
const subscriptionController = require('../../../controllers/subscriptionController');
const { operatorActionLogger } = require('../../../middleware/logging');
const { requireOperatorAccess } = require('../../../middleware/auth');

const router = express.Router();

/**
 * @route   POST /api/v1/subscriptions
 * @desc    Create new subscription
 * @access  Private (operator+)
 */
router.post('/', 
  requireOperatorAccess,
  operatorActionLogger('createSubscription'),
  subscriptionController.createSubscription
);

/**
 * @route   GET /api/v1/subscriptions
 * @desc    List subscriptions with filtering
 * @access  Private (operator+)
 */
router.get('/', 
  requireOperatorAccess,
  subscriptionController.listSubscriptions
);

/**
 * @route   GET /api/v1/subscriptions/:id
 * @desc    Get subscription details
 * @access  Private (operator+)
 */
router.get('/:id', 
  requireOperatorAccess,
  subscriptionController.getSubscription
);

/**
 * @route   DELETE /api/v1/subscriptions/:id
 * @desc    Cancel subscription
 * @access  Private (operator+)
 */
router.delete('/:id', 
  requireOperatorAccess,
  operatorActionLogger('cancelSubscription'),
  subscriptionController.cancelSubscription
);

/**
 * @route   GET /api/v1/subscriptions/:id/status
 * @desc    Get real-time subscription status
 * @access  Private (operator+)
 */
router.get('/:id/status', 
  requireOperatorAccess,
  operatorActionLogger('getSubscriptionStatus'),
  subscriptionController.getSubscriptionStatus
);

/**
 * @route   GET /api/v1/subscriptions/:id/transactions
 * @desc    Get subscription transaction history
 * @access  Private (operator+)
 */
router.get('/:id/transactions', 
  requireOperatorAccess,
  subscriptionController.getSubscriptionTransactions
);

module.exports = router;