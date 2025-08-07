/**
 * Subscription Service
 * 
 * Business logic layer for subscription management operations.
 * Handles database operations, status management, and business rules.
 */

const { initializeModels } = require('../../models');
const Logger = require('../../utils/logger');
const { ValidationError, BusinessLogicError } = require('../../utils/errors');
const { Op } = require('sequelize');

class SubscriptionService {
  constructor() {
    // Don't initialize models in constructor - use lazy initialization
    this.models = null;
    this._modelsInitialized = false;
  }

  /**
   * Lazy initialize database models when first needed
   */
  async ensureModelsInitialized() {
    if (!this._modelsInitialized) {
      try {
        this.models = initializeModels();
        this._modelsInitialized = true;
        Logger.debug('Models initialized in SubscriptionService');
      } catch (error) {
        Logger.error('Failed to initialize models in SubscriptionService', {
          error: error.message
        });
        throw new Error('Database models not available');
      }
    }
    return this.models;
  }

  /**
   * Create new subscription
   */
  async create(subscriptionData) {
    try {
      await this.ensureModelsInitialized();

      const {
        operatorCode,
        operatorSubscriptionId,
        msisdn,
        status,
        amount,
        currency,
        frequency,
        campaign,
        merchant,
        nextBillingDate,
        metadata = {},
        operatorData = {}
      } = subscriptionData;

      // Validate required fields
      if (!operatorCode || !msisdn || !campaign || !merchant) {
        throw new ValidationError('Missing required subscription fields');
      }

      // Check for duplicate subscription
      const existingSubscription = await this.models.Subscription.findOne({
        where: {
          msisdn,
          operatorCode,
          status: {
            [Op.notIn]: ['cancelled', 'deleted', 'removed']
          }
        }
      });

      if (existingSubscription) {
        throw new BusinessLogicError(
          'Active subscription already exists for this MSISDN and operator'
        );
      }

      // Get operator details
      const operator = await this.models.Operator.findOne({
        where: { code: operatorCode }
      });

      if (!operator) {
        throw new ValidationError(`Operator ${operatorCode} not found`);
      }

      // Create subscription
      const subscription = await this.models.Subscription.create({
        operatorId: operator.id,
        operatorCode,
        operatorSubscriptionId: operatorSubscriptionId || this.generateSubscriptionId(),
        msisdn,
        status: status || 'PENDING',
        amount: amount || 0,
        currency: currency || operator.currency,
        frequency: frequency || 'monthly',
        campaign,
        merchant,
        nextBillingDate,
        metadata: {
          ...metadata,
          operatorData,
          createdAt: new Date().toISOString()
        }
      });

      Logger.info('Subscription created', {
        subscriptionId: subscription.id,
        operatorCode,
        msisdn: this.maskMSISDN(msisdn),
        status: subscription.status
      });

      return subscription;
    } catch (error) {
      Logger.error('Failed to create subscription', {
        error: error.message,
        operatorCode: subscriptionData.operatorCode,
        msisdn: this.maskMSISDN(subscriptionData.msisdn)
      });
      throw error;
    }
  }

  /**
   * Get subscription by ID
   */
  async getById(subscriptionId) {
    try {
      await this.ensureModelsInitialized();

      const subscription = await this.models.Subscription.findOne({
        where: { id: subscriptionId },
        include: [
          {
            model: this.models.Operator,
            as: 'operator',
            attributes: ['id', 'code', 'name', 'country', 'currency']
          }
        ]
      });

      if (!subscription) {
        return null;
      }

      // Calculate aggregated stats
      const stats = await this.calculateSubscriptionStats(subscriptionId);
      
      return {
        ...subscription.toJSON(),
        ...stats
      };
    } catch (error) {
      Logger.error('Failed to get subscription', {
        subscriptionId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Update subscription status
   */
  async updateStatus(subscriptionId, status, operatorStatus = null, metadata = {}) {
    try {
      await this.ensureModelsInitialized();

      const subscription = await this.models.Subscription.findByPk(subscriptionId);
      
      if (!subscription) {
        throw new ValidationError('Subscription not found');
      }

      const previousStatus = subscription.status;
      
      // Update subscription
      await subscription.update({
        status,
        operatorStatus,
        metadata: {
          ...subscription.metadata,
          ...metadata,
          statusHistory: [
            ...(subscription.metadata.statusHistory || []),
            {
              from: previousStatus,
              to: status,
              timestamp: new Date().toISOString(),
              operatorStatus
            }
          ]
        },
        ...(status === 'ACTIVE' && !subscription.activatedAt && { activatedAt: new Date() }),
        ...(status === 'SUSPENDED' && { suspendedAt: new Date() }),
        ...(status === 'CANCELLED' && { cancelledAt: new Date() })
      });

      Logger.info('Subscription status updated', {
        subscriptionId,
        from: previousStatus,
        to: status,
        operatorStatus
      });

      return subscription;
    } catch (error) {
      Logger.error('Failed to update subscription status', {
        subscriptionId,
        status,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * List subscriptions with filtering and pagination
   */
  async list(options = {}) {
    try {
      await this.ensureModelsInitialized();

      const {
        filters = {},
        pagination = { page: 1, limit: 50 },
        sorting = { field: 'createdAt', order: 'DESC' }
      } = options;

      // Build where clause
      const whereClause = {};
      
      if (filters.operatorCode) {
        whereClause.operatorCode = filters.operatorCode;
      }
      
      if (filters.status) {
        whereClause.status = filters.status;
      }
      
      if (filters.msisdn) {
        whereClause.msisdn = filters.msisdn;
      }

      if (filters.dateFrom) {
        whereClause.createdAt = {
          [Op.gte]: new Date(filters.dateFrom)
        };
      }

      if (filters.dateTo) {
        whereClause.createdAt = {
          ...whereClause.createdAt,
          [Op.lte]: new Date(filters.dateTo)
        };
      }

      // Execute query with pagination
      const { count, rows } = await this.models.Subscription.findAndCountAll({
        where: whereClause,
        include: [
          {
            model: this.models.Operator,
            as: 'operator',
            attributes: ['id', 'code', 'name', 'country', 'currency']
          }
        ],
        limit: pagination.limit,
        offset: (pagination.page - 1) * pagination.limit,
        order: [[sorting.field, sorting.order]]
      });

      return {
        data: rows,
        total: count,
        page: pagination.page,
        pages: Math.ceil(count / pagination.limit)
      };
    } catch (error) {
      Logger.error('Failed to list subscriptions', {
        error: error.message,
        filters
      });
      throw error;
    }
  }

  /**
   * Get subscription transactions
   */
  async getTransactions(subscriptionId, pagination = { page: 1, limit: 20 }) {
    try {
      await this.ensureModelsInitialized();

      const subscription = await this.models.Subscription.findByPk(subscriptionId);
      
      if (!subscription) {
        throw new ValidationError('Subscription not found');
      }

      const { count, rows } = await this.models.Transaction.findAndCountAll({
        where: { subscriptionId },
        limit: pagination.limit,
        offset: (pagination.page - 1) * pagination.limit,
        order: [['createdAt', 'DESC']]
      });

      return {
        data: rows,
        total: count
      };
    } catch (error) {
      Logger.error('Failed to get subscription transactions', {
        subscriptionId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Calculate subscription statistics
   */
  async calculateSubscriptionStats(subscriptionId) {
    try {
      await this.ensureModelsInitialized();

      const transactions = await this.models.Transaction.findAll({
        where: { subscriptionId },
        attributes: [
          'type',
          'status',
          'amount',
          'currency'
        ]
      });

      const stats = {
        totalCharges: 0,
        totalRefunds: 0,
        successfulCharges: 0,
        failedCharges: 0,
        pendingCharges: 0,
        lastBillingDate: null
      };

      for (const transaction of transactions) {
        if (transaction.type === 'charge' || transaction.type === 'subscription') {
          if (transaction.status === 'success') {
            stats.totalCharges += parseFloat(transaction.amount);
            stats.successfulCharges += 1;
            
            // Update last billing date
            if (!stats.lastBillingDate || transaction.createdAt > stats.lastBillingDate) {
              stats.lastBillingDate = transaction.createdAt;
            }
          } else if (transaction.status === 'failed') {
            stats.failedCharges += 1;
          } else if (transaction.status === 'pending' || transaction.status === 'processing') {
            stats.pendingCharges += 1;
          }
        } else if (transaction.type === 'refund' && transaction.status === 'success') {
          stats.totalRefunds += parseFloat(transaction.amount);
        }
      }

      return stats;
    } catch (error) {
      Logger.error('Failed to calculate subscription stats', {
        subscriptionId,
        error: error.message
      });
      return {
        totalCharges: 0,
        totalRefunds: 0,
        successfulCharges: 0,
        failedCharges: 0,
        pendingCharges: 0,
        lastBillingDate: null
      };
    }
  }

  /**
   * Find subscriptions by MSISDN
   */
  async findByMSISDN(msisdn, operatorCode = null) {
    try {
      await this.ensureModelsInitialized();

      const whereClause = { msisdn };
      
      if (operatorCode) {
        whereClause.operatorCode = operatorCode;
      }

      const subscriptions = await this.models.Subscription.findAll({
        where: whereClause,
        include: [
          {
            model: this.models.Operator,
            as: 'operator',
            attributes: ['id', 'code', 'name', 'country']
          }
        ],
        order: [['createdAt', 'DESC']]
      });

      return subscriptions;
    } catch (error) {
      Logger.error('Failed to find subscriptions by MSISDN', {
        msisdn: this.maskMSISDN(msisdn),
        operatorCode,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get subscription health statistics
   */
  async getHealthStats() {
    try {
      await this.ensureModelsInitialized();

      const stats = await this.models.Subscription.findAll({
        attributes: [
          'status',
          [this.models.Subscription.sequelize.fn('COUNT', this.models.Subscription.sequelize.col('id')), 'count']
        ],
        group: ['status'],
        raw: true
      });

      const healthStats = {
        total: 0,
        active: 0,
        suspended: 0,
        cancelled: 0,
        pending: 0,
        other: 0
      };

      for (const stat of stats) {
        const count = parseInt(stat.count);
        healthStats.total += count;
        
        switch (stat.status) {
          case 'ACTIVE':
            healthStats.active = count;
            break;
          case 'SUSPENDED':
            healthStats.suspended = count;
            break;
          case 'CANCELLED':
          case 'DELETED':
          case 'REMOVED':
            healthStats.cancelled += count;
            break;
          case 'PENDING':
            healthStats.pending = count;
            break;
          default:
            healthStats.other += count;
        }
      }

      return healthStats;
    } catch (error) {
      Logger.error('Failed to get subscription health stats', {
        error: error.message
      });
      return {
        total: 0,
        active: 0,
        suspended: 0,
        cancelled: 0,
        pending: 0,
        other: 0,
        error: error.message
      };
    }
  }

  /**
   * Generate unique subscription ID
   */
  generateSubscriptionId() {
    const timestamp = Date.now().toString();
    const random = Math.random().toString(36).substring(2, 8);
    return `sub_${timestamp}_${random}`;
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
   * Validate subscription data
   */
  validateSubscriptionData(data) {
    const required = ['msisdn', 'operatorCode', 'campaign', 'merchant'];
    
    for (const field of required) {
      if (!data[field]) {
        throw new ValidationError(`${field} is required`);
      }
    }

    // MSISDN validation
    if (!/^\d{10,15}$/.test(data.msisdn)) {
      throw new ValidationError('Invalid MSISDN format');
    }

    // Amount validation
    if (data.amount !== undefined && (typeof data.amount !== 'number' || data.amount < 0)) {
      throw new ValidationError('Amount must be a positive number');
    }

    return true;
  }
}

module.exports = SubscriptionService;