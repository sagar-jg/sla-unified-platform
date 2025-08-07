/**
 * Webhook Model
 * 
 * Manages webhook notifications from SLA Digital platform
 */

const { DataTypes, Model } = require('sequelize');
const Logger = require('../utils/logger');

class Webhook extends Model {
  /**
   * Initialize the Webhook model
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
        allowNull: true,
        field: 'subscription_id',
        references: {
          model: 'subscriptions',
          key: 'id'
        },
        comment: 'Associated subscription (if applicable)'
      },
      
      transactionId: {
        type: DataTypes.UUID,
        allowNull: true,
        field: 'transaction_id',
        references: {
          model: 'transactions',
          key: 'id'
        },
        comment: 'Associated transaction (if applicable)'
      },
      
      operatorId: {
        type: DataTypes.UUID,
        allowNull: false,
        field: 'operator_id',
        references: {
          model: 'operators',
          key: 'id'
        },
        comment: 'Associated operator'
      },
      
      eventType: {
        type: DataTypes.ENUM(
          'subscription_created',
          'subscription_activated', 
          'subscription_cancelled',
          'subscription_suspended',
          'subscription_renewed',
          'charge_success',
          'charge_failed',
          'refund_processed',
          'transaction_updated',
          'pin_generated',
          'pin_verified',
          'eligibility_checked'
        ),
        allowNull: false,
        field: 'event_type',
        comment: 'Webhook event type'
      },
      
      eventData: {
        type: DataTypes.JSONB,
        allowNull: false,
        field: 'event_data',
        comment: 'Event payload data'
      },
      
      targetUrl: {
        type: DataTypes.STRING(2048),
        allowNull: false,
        field: 'target_url',
        comment: 'Destination URL for webhook'
      },
      
      httpMethod: {
        type: DataTypes.ENUM('POST', 'PUT', 'PATCH'),
        defaultValue: 'POST',
        field: 'http_method',
        comment: 'HTTP method for webhook'
      },
      
      httpHeaders: {
        type: DataTypes.JSONB,
        allowNull: true,
        field: 'http_headers',
        comment: 'HTTP headers to send'
      },
      
      status: {
        type: DataTypes.ENUM('pending', 'sent', 'failed', 'retrying'),
        defaultValue: 'pending',
        comment: 'Webhook delivery status'
      },
      
      httpStatus: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: 'http_status',
        comment: 'HTTP response status code'
      },
      
      responseBody: {
        type: DataTypes.TEXT,
        allowNull: true,
        field: 'response_body',
        comment: 'HTTP response body'
      },
      
      responseHeaders: {
        type: DataTypes.JSONB,
        allowNull: true,
        field: 'response_headers',
        comment: 'HTTP response headers'
      },
      
      responseTime: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: 'response_time',
        comment: 'Response time in milliseconds'
      },
      
      retryCount: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        field: 'retry_count',
        comment: 'Number of retry attempts'
      },
      
      maxRetries: {
        type: DataTypes.INTEGER,
        defaultValue: 5,
        field: 'max_retries',
        comment: 'Maximum retry attempts'
      },
      
      nextRetryAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'next_retry_at',
        comment: 'Next retry timestamp'
      },
      
      lastAttemptAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'last_attempt_at',
        comment: 'Last delivery attempt timestamp'
      },
      
      errorMessage: {
        type: DataTypes.TEXT,
        allowNull: true,
        field: 'error_message',
        comment: 'Error message if delivery failed'
      },
      
      metadata: {
        type: DataTypes.JSONB,
        defaultValue: {},
        comment: 'Additional webhook metadata'
      }
    }, {
      sequelize,
      modelName: 'Webhook',
      tableName: 'webhooks',
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
          fields: ['transaction_id']
        },
        {
          fields: ['operator_id']
        },
        {
          fields: ['event_type']
        },
        {
          fields: ['status']
        },
        {
          fields: ['next_retry_at']
        },
        {
          fields: ['created_at']
        }
      ]
    });
  }
  
  /**
   * Mark webhook as sent
   */
  async markAsSent(httpStatus, responseBody, responseHeaders, responseTime) {
    try {
      this.status = 'sent';
      this.httpStatus = httpStatus;
      this.responseBody = responseBody;
      this.responseHeaders = responseHeaders;
      this.responseTime = responseTime;
      this.lastAttemptAt = new Date();
      
      await this.save();
      
      Logger.info('Webhook marked as sent', {
        webhookId: this.id,
        eventType: this.eventType,
        httpStatus,
        responseTime
      });
      
      return true;
    } catch (error) {
      Logger.error('Failed to mark webhook as sent', {
        webhookId: this.id,
        error: error.message
      });
      throw error;
    }
  }
  
  /**
   * Mark webhook as failed
   */
  async markAsFailed(errorMessage, httpStatus = null) {
    try {
      this.status = 'failed';
      this.errorMessage = errorMessage;
      this.lastAttemptAt = new Date();
      
      if (httpStatus) {
        this.httpStatus = httpStatus;
      }
      
      await this.save();
      
      Logger.error('Webhook marked as failed', {
        webhookId: this.id,
        eventType: this.eventType,
        errorMessage
      });
      
      return true;
    } catch (error) {
      Logger.error('Failed to mark webhook as failed', {
        webhookId: this.id,
        error: error.message
      });
      throw error;
    }
  }
  
  /**
   * Schedule retry
   */
  async scheduleRetry() {
    try {
      if (this.retryCount >= this.maxRetries) {
        return await this.markAsFailed('Maximum retries exceeded');
      }
      
      this.status = 'retrying';
      this.retryCount += 1;
      
      // Exponential backoff: 1, 2, 4, 8, 16 minutes
      const delayMinutes = Math.pow(2, this.retryCount - 1);
      this.nextRetryAt = new Date(Date.now() + delayMinutes * 60 * 1000);
      
      await this.save();
      
      Logger.info('Webhook retry scheduled', {
        webhookId: this.id,
        retryCount: this.retryCount,
        nextRetryAt: this.nextRetryAt
      });
      
      return true;
    } catch (error) {
      Logger.error('Failed to schedule webhook retry', {
        webhookId: this.id,
        error: error.message
      });
      throw error;
    }
  }
  
  /**
   * Check if webhook should be retried
   */
  shouldRetry() {
    return this.status === 'retrying' && 
           this.nextRetryAt && 
           new Date() >= new Date(this.nextRetryAt) &&
           this.retryCount < this.maxRetries;
  }
  
  /**
   * Get webhook age in minutes
   */
  getAgeInMinutes() {
    const now = new Date();
    const created = new Date(this.createdAt);
    return Math.floor((now - created) / (1000 * 60));
  }
}

module.exports = Webhook;
