/**
 * Subscription Controller
 * 
 * Handles all subscription-related API endpoints
 */

const UnifiedAdapter = require('../services/core/UnifiedAdapter');
const SubscriptionService = require('../services/business/SubscriptionService');
const { ValidationError } = require('../utils/errors');
const { asyncHandler } = require('../middleware/errorHandler');
const Logger = require('../utils/logger');

class SubscriptionController {
  constructor() {
    this.unifiedAdapter = new UnifiedAdapter();
    this.subscriptionService = new SubscriptionService();
  }
  
  /**
   * Create new subscription
   */
  createSubscription = asyncHandler(async (req, res) => {
    const { operatorCode, msisdn, pin, campaign, merchant, trialDays, skipInitialCharge } = req.body;
    
    // Validate required parameters
    if (!operatorCode || !msisdn || !pin || !campaign || !merchant) {
      throw new ValidationError('Missing required parameters: operatorCode, msisdn, pin, campaign, merchant');
    }
    
    Logger.info('Creating subscription', {
      operatorCode,
      msisdn: this.maskMSISDN(msisdn),
      campaign,
      merchant,
      userId: req.user.id,
      correlationId: req.correlationId
    });
    
    // Execute through unified adapter
    const result = await this.unifiedAdapter.executeOperation(
      operatorCode,
      'createSubscription',
      { msisdn, pin, campaign, merchant, trialDays, skipInitialCharge },
      req.user.id
    );
    
    // Store subscription in database
    const subscription = await this.subscriptionService.create({
      operatorCode,
      operatorSubscriptionId: result.data.subscriptionId,
      msisdn,
      status: result.data.status,
      amount: result.data.amount,
      currency: result.data.currency,
      frequency: result.data.frequency || 'monthly',
      campaign,
      merchant,
      nextBillingDate: result.data.nextBillingDate,
      metadata: {
        createdVia: 'api',
        userAgent: req.get('User-Agent'),
        ipAddress: req.ip,
        correlationId: req.correlationId
      },
      operatorData: result.data
    });
    
    res.status(201).json({
      success: true,
      data: {
        subscriptionId: subscription.id,
        operatorSubscriptionId: result.data.subscriptionId,
        status: result.data.status,
        amount: result.data.amount,
        currency: result.data.currency,
        frequency: result.data.frequency,
        nextBillingDate: result.data.nextBillingDate,
        checkoutUrl: result.data.checkoutUrl,
        checkoutRequired: result.data.checkoutRequired
      },
      metadata: result.metadata
    });
  });
  
  /**
   * Get subscription details
   */
  getSubscription = asyncHandler(async (req, res) => {
    const { id } = req.params;
    
    const subscription = await this.subscriptionService.getById(id);
    
    if (!subscription) {
      return res.status(404).json({
        error: {
          code: 'SUBSCRIPTION_NOT_FOUND',
          message: 'Subscription not found'
        }
      });
    }
    
    // Get latest status from operator if needed
    let operatorStatus = null;
    try {
      const statusResult = await this.unifiedAdapter.executeOperation(
        subscription.operator.code,
        'getSubscriptionStatus',
        { uuid: subscription.operatorSubscriptionId },
        req.user.id
      );
      operatorStatus = statusResult.data;
    } catch (error) {
      Logger.warn('Failed to get operator status', {
        subscriptionId: id,
        error: error.message
      });
    }
    
    res.json({
      success: true,
      data: {
        id: subscription.id,
        operatorCode: subscription.operator?.code,
        operatorName: subscription.operator?.name,
        operatorSubscriptionId: subscription.operatorSubscriptionId,
        msisdn: subscription.msisdn,
        status: subscription.status,
        operatorStatus: operatorStatus?.status,
        amount: subscription.amount,
        currency: subscription.currency,
        frequency: subscription.frequency,
        nextBillingDate: subscription.nextBillingDate,
        lastBillingDate: subscription.lastBillingDate,
        totalCharges: subscription.totalCharges,
        totalRefunds: subscription.totalRefunds,
        successfulCharges: subscription.successfulCharges,
        failedCharges: subscription.failedCharges,
        createdAt: subscription.createdAt,
        activatedAt: subscription.activatedAt,
        metadata: subscription.metadata
      }
    });
  });
  
  /**
   * Cancel subscription
   */
  cancelSubscription = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { reason } = req.body;
    
    const subscription = await this.subscriptionService.getById(id);
    
    if (!subscription) {
      return res.status(404).json({
        error: {
          code: 'SUBSCRIPTION_NOT_FOUND',
          message: 'Subscription not found'
        }
      });
    }
    
    if (subscription.status === 'cancelled') {
      return res.status(400).json({
        error: {
          code: 'SUBSCRIPTION_ALREADY_CANCELLED',
          message: 'Subscription is already cancelled'
        }
      });
    }
    
    Logger.info('Cancelling subscription', {
      subscriptionId: id,
      operatorCode: subscription.operator.code,
      reason,
      userId: req.user.id
    });
    
    // Cancel with operator
    const result = await this.unifiedAdapter.executeOperation(
      subscription.operator.code,
      'cancelSubscription',
      { uuid: subscription.operatorSubscriptionId },
      req.user.id
    );
    
    // Update subscription status
    await subscription.updateStatus('cancelled', result.data.status, {
      cancellationReason: reason,
      cancelledBy: req.user.id,
      cancelledVia: 'api'
    });
    
    res.json({
      success: true,
      data: {
        subscriptionId: id,
        status: 'cancelled',
        cancelledAt: new Date().toISOString(),
        reason
      },
      metadata: result.metadata
    });
  });
  
  /**
   * Get subscription status
   */
  getSubscriptionStatus = asyncHandler(async (req, res) => {
    const { id } = req.params;
    
    const subscription = await this.subscriptionService.getById(id);
    
    if (!subscription) {
      return res.status(404).json({
        error: {
          code: 'SUBSCRIPTION_NOT_FOUND',
          message: 'Subscription not found'
        }
      });
    }
    
    // Get real-time status from operator
    const result = await this.unifiedAdapter.executeOperation(
      subscription.operator.code,
      'getSubscriptionStatus',
      { uuid: subscription.operatorSubscriptionId },
      req.user.id
    );
    
    // Update local status if it has changed
    if (result.data.status !== subscription.status) {
      await subscription.updateStatus(result.data.status, result.data.operatorStatus);
    }
    
    res.json({
      success: true,
      data: {
        subscriptionId: id,
        status: result.data.status,
        operatorStatus: result.data.operatorStatus,
        amount: result.data.amount,
        currency: result.data.currency,
        nextBillingDate: result.data.nextBillingDate,
        lastUpdated: new Date().toISOString()
      },
      metadata: result.metadata
    });
  });
  
  /**
   * List subscriptions with filtering
   */
  listSubscriptions = asyncHandler(async (req, res) => {
    const {
      operatorCode,
      status,
      msisdn,
      page = 1,
      limit = 50,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;
    
    const filters = {};
    if (operatorCode) filters.operatorCode = operatorCode;
    if (status) filters.status = status;
    if (msisdn) filters.msisdn = msisdn;
    
    const result = await this.subscriptionService.list({
      filters,
      pagination: {
        page: parseInt(page),
        limit: Math.min(parseInt(limit), 100) // Max 100 per page
      },
      sorting: {
        field: sortBy,
        order: sortOrder.toUpperCase()
      }
    });
    
    res.json({
      success: true,
      data: result.data,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: result.total,
        pages: Math.ceil(result.total / parseInt(limit))
      }
    });
  });
  
  /**
   * Get subscription transactions
   */
  getSubscriptionTransactions = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { page = 1, limit = 20 } = req.query;
    
    const subscription = await this.subscriptionService.getById(id);
    
    if (!subscription) {
      return res.status(404).json({
        error: {
          code: 'SUBSCRIPTION_NOT_FOUND',
          message: 'Subscription not found'
        }
      });
    }
    
    const transactions = await this.subscriptionService.getTransactions(id, {
      page: parseInt(page),
      limit: Math.min(parseInt(limit), 50)
    });
    
    res.json({
      success: true,
      data: transactions.data,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: transactions.total,
        pages: Math.ceil(transactions.total / parseInt(limit))
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

module.exports = new SubscriptionController();