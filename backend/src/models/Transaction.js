/**
 * Transaction Model
 * 
 * Represents individual billing transactions across all operators
 */

const { DataTypes, Model } = require('sequelize');
const Logger = require('../utils/logger');

class Transaction extends Model {
  /**
   * Initialize the Transaction model
   */
  static init(sequelize) {
    return super.init({
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
      },
      
      subscriptionId: {
        type: DataTypes.UUID,
        allowNull: false,
        field: 'subscription_id',
        references: {
          model: 'subscriptions',
          key: 'id'
        },
        comment: 'Reference to the subscription'
      },
      
      operatorId: {
        type: DataTypes.UUID,
        allowNull: false,
        field: 'operator_id',
        references: {
          model: 'operators',
          key: 'id'
        },
        comment: 'Reference to the operator'
      },
      
      operatorTransactionId: {
        type: DataTypes.STRING(255),
        allowNull: true,
        field: 'operator_transaction_id',
        comment: 'Transaction ID from operator system'
      },
      
      operatorReference: {
        type: DataTypes.STRING(255),
        allowNull: true,
        field: 'operator_reference',
        comment: 'Operator reference number'
      },
      
      type: {
        type: DataTypes.ENUM('charge', 'refund', 'retry'),
        allowNull: false,
        comment: 'Transaction type'
      },
      
      status: {
        type: DataTypes.ENUM('pending', 'completed', 'failed', 'cancelled', 'processing'),
        allowNull: false,
        defaultValue: 'pending',
        comment: 'Transaction status'
      },
      
      amount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        comment: 'Transaction amount'
      },
      
      currency: {
        type: DataTypes.STRING(3),
        allowNull: false,
        comment: 'Currency code (ISO 4217)'
      },
      
      billingCycle: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: 'billing_cycle',
        comment: 'Billing cycle number'
      },
      
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Transaction description'
      },
      
      transactionDate: {
        type: DataTypes.DATE,
        allowNull: false,
        field: 'transaction_date',
        defaultValue: DataTypes.NOW,
        comment: 'Date when transaction was initiated'
      },
      
      processedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'processed_at',
        comment: 'Date when transaction was processed'
      },
      
      failureCode: {
        type: DataTypes.STRING(50),
        allowNull: true,
        field: 'failure_code',
        comment: 'Error code if transaction failed'
      },
      
      failureMessage: {
        type: DataTypes.TEXT,
        allowNull: true,
        field: 'failure_message',
        comment: 'Error message if transaction failed'
      },
      
      retryCount: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        field: 'retry_count',
        comment: 'Number of retry attempts'
      },
      
      lastRetryAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'last_retry_at',
        comment: 'Last retry timestamp'
      },
      
      webhookSent: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        field: 'webhook_sent',
        comment: 'Whether webhook was sent for this transaction'
      },
      
      webhookResponse: {
        type: DataTypes.JSONB,
        allowNull: true,
        field: 'webhook_response',
        comment: 'Response from webhook endpoint'
      },
      
      metadata: {
        type: DataTypes.JSONB,
        defaultValue: {},
        comment: 'Additional transaction metadata'
      },
      
      operatorData: {
        type: DataTypes.JSONB,
        defaultValue: {},
        field: 'operator_data',
        comment: 'Raw data from operator system'
      }
    }, {
      sequelize,
      modelName: 'Transaction',
      tableName: 'transactions',
      timestamps: true,
      
      // ✅ FIX: Explicit field mapping for timestamps
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      
      // ✅ FIX: Use underscored naming
      underscored: true,
      
      indexes: [
        {
          fields: ['subscription_id']
        },
        {
          fields: ['operator_id']
        },
        {
          fields: ['status']
        },
        {
          fields: ['type']
        },
        {
          fields: ['transaction_date']
        },
        {
          fields: ['operator_transaction_id']
        },
        {
          unique: true,
          fields: ['operator_id', 'operator_transaction_id'],
          where: {
            operator_transaction_id: {
              [require('sequelize').Op.ne]: null
            }
          }
        }
      ]
    });
  }
  
  /**
   * Mark transaction as completed
   */
  async markCompleted(operatorTransactionId = null, metadata = {}) {
    try {
      this.status = 'completed';
      this.processedAt = new Date();
      
      if (operatorTransactionId) {
        this.operatorTransactionId = operatorTransactionId;
      }
      
      this.metadata = {
        ...this.metadata,
        ...metadata,
        completedAt: new Date().toISOString()
      };
      
      await this.save();
      
      Logger.info(`Transaction marked as completed`, {
        transactionId: this.id,
        operatorTransactionId: this.operatorTransactionId,
        amount: this.amount,
        currency: this.currency
      });
      
      return true;
    } catch (error) {
      Logger.error('Failed to mark transaction as completed', {
        transactionId: this.id,
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }
  
  /**
   * Mark transaction as failed
   */
  async markFailed(failureCode, failureMessage, metadata = {}) {
    try {
      this.status = 'failed';
      this.processedAt = new Date();
      this.failureCode = failureCode;
      this.failureMessage = failureMessage;
      
      this.metadata = {
        ...this.metadata,
        ...metadata,
        failedAt: new Date().toISOString()
      };
      
      await this.save();
      
      Logger.error(`Transaction marked as failed`, {
        transactionId: this.id,
        operatorTransactionId: this.operatorTransactionId,
        failureCode,
        failureMessage,
        amount: this.amount,
        currency: this.currency
      });
      
      return true;
    } catch (error) {
      Logger.error('Failed to mark transaction as failed', {
        transactionId: this.id,
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }
  
  /**
   * Increment retry count
   */
  async incrementRetry(metadata = {}) {
    try {
      this.retryCount += 1;
      this.lastRetryAt = new Date();
      
      this.metadata = {
        ...this.metadata,
        ...metadata,
        retries: [
          ...(this.metadata.retries || []),
          {
            attempt: this.retryCount,
            timestamp: new Date().toISOString()
          }
        ]
      };
      
      await this.save();
      
      Logger.info(`Transaction retry incremented`, {
        transactionId: this.id,
        retryCount: this.retryCount
      });
      
      return true;
    } catch (error) {
      Logger.error('Failed to increment transaction retry', {
        transactionId: this.id,
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }
  
  /**
   * Mark webhook as sent
   */
  async markWebhookSent(response = null) {
    try {
      this.webhookSent = true;
      
      if (response) {
        this.webhookResponse = response;
      }
      
      await this.save();
      
      Logger.debug(`Transaction webhook marked as sent`, {
        transactionId: this.id,
        responseStatus: response?.status || 'unknown'
      });
      
      return true;
    } catch (error) {
      Logger.error('Failed to mark webhook as sent', {
        transactionId: this.id,
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }
  
  /**
   * Check if transaction can be retried
   */
  canRetry(maxRetries = 3) {
    return this.status === 'failed' && this.retryCount < maxRetries;
  }
  
  /**
   * Get transaction age in minutes
   */
  getAgeInMinutes() {
    const now = new Date();
    const created = new Date(this.createdAt);
    return Math.floor((now - created) / (1000 * 60));
  }
  
  /**
   * Check if transaction is stale (over 24 hours old and still pending)
   */
  isStale() {
    return this.status === 'pending' && this.getAgeInMinutes() > 1440; // 24 hours
  }
}

module.exports = Transaction;
