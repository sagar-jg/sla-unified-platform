/**
 * Subscription Model
 * 
 * Represents customer subscriptions across all operators with unified status tracking
 */

const { DataTypes, Model } = require('sequelize');
const Logger = require('../utils/logger');

class Subscription extends Model {
  /**
   * Initialize the Subscription model
   */
  static init(sequelize) {
    return super.init({
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
      },
      
      operatorId: {
        type: DataTypes.UUID,
        allowNull: false,
        field: 'operator_id',
        references: {
          model: 'operators',
          key: 'id'
        },
        comment: 'Reference to the operator handling this subscription'
      },
      
      operatorSubscriptionId: {
        type: DataTypes.STRING(255),
        allowNull: false,
        field: 'operator_subscription_id',
        comment: 'Subscription ID from the operator system'
      },
      
      msisdn: {
        type: DataTypes.STRING(20),
        allowNull: false,
        comment: 'Customer phone number'
      },
      
      status: {
        type: DataTypes.ENUM('active', 'suspended', 'cancelled', 'trial', 'grace', 'expired'),
        allowNull: false,
        defaultValue: 'active',
        comment: 'Unified subscription status'
      },
      
      operatorStatus: {
        type: DataTypes.STRING(50),
        allowNull: true,
        field: 'operator_status',
        comment: 'Original status from operator system'
      },
      
      amount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        comment: 'Subscription amount'
      },
      
      currency: {
        type: DataTypes.STRING(3),
        allowNull: false,
        comment: 'Currency code (ISO 4217)'
      },
      
      frequency: {
        type: DataTypes.ENUM('daily', 'weekly', 'fortnightly', 'monthly'),
        allowNull: false,
        comment: 'Billing frequency'
      },
      
      campaign: {
        type: DataTypes.STRING(255),
        allowNull: true,
        comment: 'Campaign identifier from operator'
      },
      
      merchant: {
        type: DataTypes.STRING(255),
        allowNull: true,
        comment: 'Merchant identifier from operator'
      },
      
      nextPaymentAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'next_payment_at',
        comment: 'Next scheduled billing date'
      },
      
      lastPaymentAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'last_payment_at',
        comment: 'Last successful billing date'
      },
      
      trialEndsAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'trial_ends_at',
        comment: 'Trial period end date'
      },
      
      activatedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'activated_at',
        comment: 'Subscription activation timestamp'
      },
      
      cancelledAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'cancelled_at',
        comment: 'Subscription cancellation timestamp'
      },
      
      pausedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'paused_at',
        comment: 'Subscription pause timestamp'
      },
      
      pauseReason: {
        type: DataTypes.TEXT,
        allowNull: true,
        field: 'pause_reason',
        comment: 'Reason for pausing subscription'
      },
      
      totalPaid: {
        type: DataTypes.DECIMAL(12, 2),
        defaultValue: 0.00,
        field: 'total_paid',
        comment: 'Total amount paid for this subscription'
      },
      
      failedPayments: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        field: 'failed_payments',
        comment: 'Number of failed payment attempts'
      },
      
      lastErrorCode: {
        type: DataTypes.STRING(50),
        allowNull: true,
        field: 'last_error_code',
        comment: 'Last error code from failed payment'
      },
      
      lastErrorMessage: {
        type: DataTypes.TEXT,
        allowNull: true,
        field: 'last_error_message',
        comment: 'Last error message from failed payment'
      },
      
      metadata: {
        type: DataTypes.JSONB,
        defaultValue: {},
        comment: 'Additional subscription metadata'
      }
    }, {
      sequelize,
      modelName: 'Subscription',
      tableName: 'subscriptions',
      timestamps: true,
      paranoid: true, // Soft delete
      
      // ✅ FIX: Explicit field mapping for timestamps
      createdAt: 'created_at',
      updatedAt: 'updated_at', 
      deletedAt: 'deleted_at',
      
      // ✅ FIX: Use underscored naming
      underscored: true,
      
      indexes: [
        {
          unique: true,
          fields: ['operator_id', 'operator_subscription_id']
        },
        {
          fields: ['msisdn']
        },
        {
          fields: ['status']
        },
        {
          fields: ['next_payment_at']
        },
        {
          fields: ['created_at']
        },
        {
          fields: ['operator_id', 'status']
        }
      ]
    });
  }
  
  /**
   * Update subscription status
   */
  async updateStatus(newStatus, operatorStatus = null, metadata = {}) {
    try {
      const oldStatus = this.status;
      this.status = newStatus;
      
      if (operatorStatus) {
        this.operatorStatus = operatorStatus;
      }
      
      // Update timestamp fields based on status
      const now = new Date();
      switch (newStatus) {
        case 'active':
          if (oldStatus !== 'active') {
            this.activatedAt = now;
          }
          break;
        case 'cancelled':
          this.cancelledAt = now;
          break;
        case 'suspended':
          this.pausedAt = now;
          break;
      }
      
      // Update metadata
      this.metadata = {
        ...this.metadata,
        ...metadata,
        lastStatusChange: {
          from: oldStatus,
          to: newStatus,
          timestamp: now.toISOString()
        }
      };
      
      await this.save();
      
      Logger.info(`Subscription status updated`, {
        subscriptionId: this.id,
        operatorSubscriptionId: this.operatorSubscriptionId,
        msisdn: this.msisdn,
        oldStatus,
        newStatus,
        operatorStatus
      });
      
      return true;
    } catch (error) {
      Logger.error('Failed to update subscription status', {
        subscriptionId: this.id,
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }
  
  /**
   * Record successful charge
   */
  async recordCharge(amount, transactionId, metadata = {}) {
    try {
      this.totalPaid = parseFloat(this.totalPaid) + parseFloat(amount);
      this.lastPaymentAt = new Date();
      
      // Calculate next billing date
      this.calculateNextPaymentDate();
      
      // Update metadata
      this.metadata = {
        ...this.metadata,
        lastCharge: {
          amount,
          transactionId,
          timestamp: new Date().toISOString(),
          ...metadata
        }
      };
      
      await this.save();
      
      Logger.info(`Charge recorded for subscription`, {
        subscriptionId: this.id,
        amount,
        transactionId,
        totalPaid: this.totalPaid
      });
      
      return true;
    } catch (error) {
      Logger.error('Failed to record charge', {
        subscriptionId: this.id,
        amount,
        transactionId,
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }
  
  /**
   * Record failed charge
   */
  async recordFailedCharge(errorCode, errorMessage, metadata = {}) {
    try {
      this.failedPayments += 1;
      this.lastErrorCode = errorCode;
      this.lastErrorMessage = errorMessage;
      
      // Update metadata
      this.metadata = {
        ...this.metadata,
        lastFailedCharge: {
          errorCode,
          errorMessage,
          timestamp: new Date().toISOString(),
          consecutiveFailures: this.failedPayments,
          ...metadata
        }
      };
      
      // Auto-suspend after too many failures
      if (this.failedPayments >= 3 && this.status === 'active') {
        await this.updateStatus('suspended', null, {
          suspensionReason: 'Multiple failed charges',
          failedChargeCount: this.failedPayments
        });
      }
      
      await this.save();
      
      Logger.warn(`Failed charge recorded for subscription`, {
        subscriptionId: this.id,
        errorCode,
        errorMessage,
        failedPayments: this.failedPayments
      });
      
      return true;
    } catch (error) {
      Logger.error('Failed to record failed charge', {
        subscriptionId: this.id,
        errorCode,
        errorMessage,
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }
  
  /**
   * Calculate next payment date based on frequency
   */
  calculateNextPaymentDate() {
    if (!this.lastPaymentAt) {
      this.lastPaymentAt = new Date();
    }
    
    const lastPayment = new Date(this.lastPaymentAt);
    
    switch (this.frequency) {
      case 'daily':
        this.nextPaymentAt = new Date(lastPayment.getTime() + 24 * 60 * 60 * 1000);
        break;
      case 'weekly':
        this.nextPaymentAt = new Date(lastPayment.getTime() + 7 * 24 * 60 * 60 * 1000);
        break;
      case 'fortnightly':
        this.nextPaymentAt = new Date(lastPayment.getTime() + 14 * 24 * 60 * 60 * 1000);
        break;
      case 'monthly':
        this.nextPaymentAt = new Date(lastPayment.getFullYear(), lastPayment.getMonth() + 1, lastPayment.getDate());
        break;
      default:
        this.nextPaymentAt = new Date(lastPayment.getTime() + 30 * 24 * 60 * 60 * 1000);
    }
  }
  
  /**
   * Check if subscription is due for billing
   */
  isDueForBilling() {
    if (!this.nextPaymentAt) {
      return false;
    }
    
    return new Date() >= new Date(this.nextPaymentAt);
  }
  
  /**
   * Check if subscription is in trial
   */
  isInTrial() {
    if (!this.trialEndsAt) {
      return false;
    }
    
    return new Date() < new Date(this.trialEndsAt);
  }
  
  /**
   * Get subscription age in days
   */
  getAgeInDays() {
    const now = new Date();
    const created = new Date(this.createdAt);
    return Math.floor((now - created) / (1000 * 60 * 60 * 24));
  }
  
  /**
   * Calculate success rate
   */
  getSuccessRate() {
    const totalAttempts = this.successfulCharges + this.failedPayments;
    if (totalAttempts === 0) {
      return 1.0;
    }
    return this.successfulCharges / totalAttempts;
  }
}

module.exports = Subscription;
