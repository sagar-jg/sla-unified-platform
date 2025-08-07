/**
 * Enhanced Webhook Service
 * 
 * Handles SLA Digital webhook notifications with proper retry logic
 * ENHANCED: 4-hour retry intervals for 24 hours per SLA Digital v2.2 requirements
 */

const axios = require('axios');
const crypto = require('crypto');
const Logger = require('../../utils/logger');
const { UnifiedError } = require('../../utils/errors');

// Redis import with fallback handling
let redisManager = null;
try {
  const redisConfig = require('../../config/redis');
  redisManager = redisConfig.redisManager;
} catch (error) {
  Logger.warn('Redis not available, webhook queuing will be limited', {
    error: error.message
  });
}

class WebhookService {
  constructor() {
    // SLA Digital v2.2 retry configuration: 4-hour intervals for 24 hours
    this.retryIntervals = [
      4 * 60 * 60 * 1000,   // 4 hours
      8 * 60 * 60 * 1000,   // 8 hours (total: 4h)
      12 * 60 * 60 * 1000,  // 12 hours (total: 8h)
      16 * 60 * 60 * 1000,  // 16 hours (total: 12h)
      20 * 60 * 60 * 1000,  // 20 hours (total: 16h)
      24 * 60 * 60 * 1000   // 24 hours (total: 20h, final attempt)
    ];
    
    this.maxRetries = this.retryIntervals.length;
    this.timeouts = new Map(); // Store timeout handles for cleanup
  }
  
  /**
   * Process incoming webhook from SLA Digital
   */
  async processIncomingWebhook(req, res) {
    try {
      const webhookData = req.body;
      const signature = req.headers['x-sla-signature'];
      const timestamp = req.headers['x-sla-timestamp'];
      
      Logger.info('Processing incoming SLA Digital webhook', {
        signature: signature ? 'present' : 'missing',
        timestamp,
        hasData: !!webhookData
      });
      
      // Validate webhook signature (if configured)
      if (process.env.SLA_WEBHOOK_SECRET) {
        const isValid = this.validateWebhookSignature(
          JSON.stringify(webhookData),
          signature,
          timestamp
        );
        
        if (!isValid) {
          Logger.warn('Invalid webhook signature received');
          return res.status(401).json({ 
            error: 'Invalid signature',
            message: 'Webhook signature validation failed'
          });
        }
      }
      
      // Always respond 200/201 immediately to prevent SLA Digital retries
      res.status(200).json({ 
        received: true,
        timestamp: new Date().toISOString(),
        processed: true
      });
      
      // Process webhook asynchronously
      setImmediate(() => {
        this.handleWebhookNotification(webhookData);
      });
      
    } catch (error) {
      Logger.error('Error processing incoming webhook', {
        error: error.message,
        stack: error.stack
      });
      
      // Still respond 200 to prevent retries for processing errors
      res.status(200).json({
        received: true,
        error: 'Processing error, but received',
        timestamp: new Date().toISOString()
      });
    }
  }
  
  /**
   * Handle webhook notification based on type
   */
  async handleWebhookNotification(webhookData) {
    try {
      const { success, error: webhookError } = webhookData;
      
      if (success) {
        await this.handleSuccessNotification(success);
      } else if (webhookError) {
        await this.handleErrorNotification(webhookError);
      } else {
        Logger.warn('Unknown webhook notification format', {
          data: webhookData
        });
      }
      
    } catch (error) {
      Logger.error('Error handling webhook notification', {
        error: error.message,
        webhookData,
        stack: error.stack
      });
    }
  }
  
  /**
   * Handle successful transaction notification
   */
  async handleSuccessNotification(successData) {
    try {
      const { uuid, mode, transaction, subscription } = successData;
      
      Logger.info('Processing successful transaction webhook', {
        uuid,
        mode,
        transactionStatus: transaction?.status,
        subscriptionStatus: subscription?.status
      });
      
      // Import models dynamically to avoid circular dependencies
      const { getModels } = require('../../models');
      const { Subscription, Transaction } = getModels();
      
      // Update subscription status if present
      if (uuid && subscription) {
        const sub = await Subscription.findOne({ where: { uuid } });
        if (sub) {
          await sub.update({
            status: this.mapSLAStatusToUnified(subscription.status),
            lastUpdated: new Date(),
            operatorData: subscription
          });
          
          Logger.info('Subscription updated via webhook', {
            uuid,
            newStatus: subscription.status
          });
        }
      }
      
      // Create or update transaction record
      if (transaction) {
        const transactionData = {
          uuid: transaction.uuid || uuid,
          subscriptionUuid: uuid,
          status: this.mapSLAStatusToUnified(transaction.status),
          amount: transaction.amount,
          currency: transaction.currency,
          operatorCode: transaction.operator_code,
          transactionId: transaction.transaction_id,
          processedAt: new Date(),
          webhookData: successData
        };
        
        await Transaction.upsert(transactionData);
        
        Logger.info('Transaction updated via webhook', {
          transactionId: transaction.transaction_id,
          status: transaction.status
        });
      }
      
      // Handle specific transaction statuses
      switch (transaction?.status) {
        case 'CHARGED':
          await this.handleSuccessfulPayment(uuid, transaction);
          break;
        case 'INSUFFICIENT_FUNDS':
          await this.handleInsufficientFunds(uuid, transaction);
          break;
        case 'GRACE':
          await this.handleGracePeriod(uuid, transaction);
          break;
        default:
          Logger.debug('Unhandled transaction status', {
            status: transaction?.status,
            uuid
          });
      }
      
    } catch (error) {
      Logger.error('Error processing success notification', {
        error: error.message,
        successData,
        stack: error.stack
      });
    }
  }
  
  /**
   * Handle error notification
   */
  async handleErrorNotification(errorData) {
    try {
      const { uuid, error_code, message, correlation_id } = errorData;
      
      Logger.warn('Processing error webhook notification', {
        uuid,
        errorCode: error_code,
        message,
        correlationId: correlation_id
      });
      
      // Import models dynamically
      const { getModels } = require('../../models');
      const { Subscription, ErrorLog } = getModels();
      
      // Log error for debugging
      await ErrorLog.create({
        subscriptionUuid: uuid,
        errorCode: error_code,
        errorMessage: message,
        correlationId: correlation_id,
        source: 'webhook',
        webhookData: errorData,
        createdAt: new Date()
      });
      
      // Update subscription if error is subscription-related
      if (uuid) {
        const sub = await Subscription.findOne({ where: { uuid } });
        if (sub) {
          // Handle specific error codes
          switch (error_code) {
            case 'INSUFFICIENT_FUNDS':
              await sub.update({ 
                status: 'suspended',
                lastUpdated: new Date(),
                suspendReason: 'insufficient_funds'
              });
              break;
            case 'CUSTOMER_INELIGIBLE':
              await sub.update({ 
                status: 'cancelled',
                lastUpdated: new Date(),
                cancelReason: 'ineligible'
              });
              break;
            default:
              Logger.debug('Unhandled error code', {
                errorCode: error_code,
                uuid
              });
          }
        }
      }
      
    } catch (error) {
      Logger.error('Error processing error notification', {
        error: error.message,
        errorData,
        stack: error.stack
      });
    }
  }
  
  /**
   * Send outgoing webhook to merchant with retry logic
   */
  async sendWebhook(url, data, options = {}) {
    const webhookId = options.webhookId || this.generateWebhookId();
    const attempt = options.attempt || 1;
    
    try {
      Logger.info('Sending webhook', {
        webhookId,
        url,
        attempt,
        maxRetries: this.maxRetries
      });
      
      const response = await axios.post(url, data, {
        timeout: options.timeout || 30000, // 30 second timeout
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-ID': webhookId,
          'X-Attempt': attempt,
          'User-Agent': 'SLA-Digital-Platform/1.0',
          ...options.headers
        }
      });
      
      // Success if status is 200 or 201
      if ([200, 201].includes(response.status)) {
        Logger.info('Webhook delivered successfully', {
          webhookId,
          url,
          attempt,
          statusCode: response.status
        });
        
        // Clean up any pending retries
        this.clearRetryTimeout(webhookId);
        
        return {
          success: true,
          statusCode: response.status,
          attempt,
          webhookId
        };
      } else {
        throw new Error(`Unexpected status code: ${response.status}`);
      }
      
    } catch (error) {
      Logger.warn('Webhook delivery failed', {
        webhookId,
        url,
        attempt,
        error: error.message,
        maxRetries: this.maxRetries
      });
      
      // Schedule retry if we haven't exceeded max attempts
      if (attempt <= this.maxRetries) {
        await this.scheduleWebhookRetry(url, data, webhookId, attempt);
        return {
          success: false,
          scheduled_retry: true,
          attempt,
          next_attempt: attempt + 1,
          webhookId
        };
      } else {
        Logger.error('Webhook delivery failed permanently', {
          webhookId,
          url,
          totalAttempts: attempt,
          finalError: error.message
        });
        
        return {
          success: false,
          failed_permanently: true,
          totalAttempts: attempt,
          webhookId
        };
      }
    }
  }
  
  /**
   * Schedule webhook retry using SLA Digital v2.2 intervals
   */
  async scheduleWebhookRetry(url, data, webhookId, currentAttempt) {
    const nextAttempt = currentAttempt + 1;
    
    if (nextAttempt > this.maxRetries) {
      Logger.warn('Maximum retry attempts reached', { webhookId, currentAttempt });
      return;
    }
    
    const delayIndex = currentAttempt - 1; // Array is 0-indexed
    const delay = this.retryIntervals[delayIndex] || this.retryIntervals[this.retryIntervals.length - 1];
    
    Logger.info('Scheduling webhook retry', {
      webhookId,
      currentAttempt,
      nextAttempt,
      delayHours: delay / (60 * 60 * 1000),
      scheduledFor: new Date(Date.now() + delay).toISOString()
    });
    
    // Store webhook retry info in Redis (if available) for persistence
    if (redisManager) {
      const retryData = {
        url,
        data,
        webhookId,
        attempt: nextAttempt,
        scheduledFor: Date.now() + delay,
        originalScheduledTime: Date.now()
      };
      
      await redisManager.setex(
        `webhook:retry:${webhookId}`,
        Math.ceil(delay / 1000) + 3600, // TTL with 1 hour buffer
        JSON.stringify(retryData)
      );
    }
    
    // Schedule the retry
    const timeoutHandle = setTimeout(async () => {
      Logger.info('Executing scheduled webhook retry', {
        webhookId,
        attempt: nextAttempt
      });
      
      // Remove from Redis storage
      if (redisManager) {
        await redisManager.del(`webhook:retry:${webhookId}`);
      }
      
      // Execute retry
      await this.sendWebhook(url, data, {
        webhookId,
        attempt: nextAttempt
      });
      
      // Clean up timeout handle
      this.timeouts.delete(webhookId);
    }, delay);
    
    // Store timeout handle for potential cleanup
    this.timeouts.set(webhookId, timeoutHandle);
  }
  
  /**
   * Clear retry timeout
   */
  clearRetryTimeout(webhookId) {
    const timeoutHandle = this.timeouts.get(webhookId);
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
      this.timeouts.delete(webhookId);
      Logger.debug('Cleared retry timeout', { webhookId });
    }
  }
  
  /**
   * Restore pending webhooks from Redis on startup
   */
  async restorePendingWebhooks() {
    if (!redisManager) {
      Logger.debug('Redis not available, skipping webhook restoration');
      return;
    }
    
    try {
      const keys = await redisManager.keys('webhook:retry:*');
      
      Logger.info('Restoring pending webhooks', { count: keys.length });
      
      for (const key of keys) {
        const retryDataJson = await redisManager.get(key);
        if (retryDataJson) {
          const retryData = JSON.parse(retryDataJson);
          const { webhookId, scheduledFor, url, data, attempt } = retryData;
          
          const now = Date.now();
          const delay = scheduledFor - now;
          
          if (delay > 0) {
            // Reschedule the webhook
            Logger.info('Rescheduling restored webhook', {
              webhookId,
              remainingDelayMinutes: Math.ceil(delay / (60 * 1000))
            });
            
            await this.scheduleWebhookRetry(url, data, webhookId, attempt - 1);
          } else {
            // Execute immediately if scheduled time has passed
            Logger.info('Executing overdue webhook immediately', { webhookId });
            
            await this.sendWebhook(url, data, {
              webhookId,
              attempt
            });
          }
        }
        
        // Clean up the Redis key
        await redisManager.del(key);
      }
      
    } catch (error) {
      Logger.error('Error restoring pending webhooks', {
        error: error.message,
        stack: error.stack
      });
    }
  }
  
  /**
   * Validate webhook signature from SLA Digital
   */
  validateWebhookSignature(payload, signature, timestamp) {
    if (!signature || !timestamp) {
      return false;
    }
    
    try {
      const secret = process.env.SLA_WEBHOOK_SECRET;
      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(timestamp + payload)
        .digest('hex');
      
      return signature === expectedSignature;
    } catch (error) {
      Logger.error('Error validating webhook signature', {
        error: error.message
      });
      return false;
    }
  }
  
  /**
   * Generate unique webhook ID
   */
  generateWebhookId() {
    return 'wh_' + crypto.randomBytes(16).toString('hex');
  }
  
  /**
   * Map SLA Digital status to unified status
   */
  mapSLAStatusToUnified(slaStatus) {
    const statusMappings = {
      'ACTIVE': 'active',
      'CHARGED': 'active',
      'SUCCESS': 'active',
      'SUSPENDED': 'suspended',
      'TRIAL': 'trial',
      'DELETED': 'cancelled',
      'REMOVED': 'cancelled',
      'GRACE': 'grace',
      'EXPIRED': 'expired'
    };
    
    return statusMappings[slaStatus] || 'unknown';
  }
  
  /**
   * Handle successful payment
   */
  async handleSuccessfulPayment(uuid, transaction) {
    Logger.info('Handling successful payment', {
      uuid,
      transactionId: transaction.transaction_id,
      amount: transaction.amount
    });
    
    // Implement business logic for successful payments
    // e.g., send confirmation email, update customer balance, etc.
  }
  
  /**
   * Handle insufficient funds
   */
  async handleInsufficientFunds(uuid, transaction) {
    Logger.info('Handling insufficient funds', {
      uuid,
      transactionId: transaction.transaction_id
    });
    
    // Implement business logic for insufficient funds
    // e.g., suspend subscription, send notification, etc.
  }
  
  /**
   * Handle grace period
   */
  async handleGracePeriod(uuid, transaction) {
    Logger.info('Handling grace period', {
      uuid,
      transactionId: transaction.transaction_id
    });
    
    // Implement business logic for grace period
    // e.g., schedule retry, send reminder, etc.
  }
  
  /**
   * Get webhook statistics
   */
  getWebhookStatistics() {
    return {
      pendingRetries: this.timeouts.size,
      maxRetries: this.maxRetries,
      retryIntervals: this.retryIntervals.map(interval => ({
        hours: interval / (60 * 60 * 1000),
        milliseconds: interval
      })),
      totalRetryDuration: '24 hours'
    };
  }
  
  /**
   * Cleanup timeouts on shutdown
   */
  cleanup() {
    Logger.info('Cleaning up webhook service', {
      pendingTimeouts: this.timeouts.size
    });
    
    // Clear all pending timeouts
    for (const [webhookId, timeoutHandle] of this.timeouts) {
      clearTimeout(timeoutHandle);
      Logger.debug('Cleared timeout on shutdown', { webhookId });
    }
    
    this.timeouts.clear();
  }
}

// Export singleton instance
module.exports = new WebhookService();