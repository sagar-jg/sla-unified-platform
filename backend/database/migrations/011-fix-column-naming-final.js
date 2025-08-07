'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    console.log('🔧 Starting comprehensive column naming fixes...');
    
    try {
      // ===== OPERATORS TABLE FIXES =====
      console.log('📋 Checking operators table...');
      const operatorsTable = await queryInterface.describeTable('operators');
      console.log('Current operators columns:', Object.keys(operatorsTable).sort());
      
      // Fix operators table columns
      const operatorColumnMappings = [
        { from: 'healthScore', to: 'health_score' },
        { from: 'lastHealthCheck', to: 'last_health_check' },
        { from: 'lastModifiedBy', to: 'last_modified_by' },
        { from: 'lastModifiedAt', to: 'last_modified_at' },
        { from: 'disableReason', to: 'disable_reason' },
        { from: 'createdAt', to: 'created_at' },
        { from: 'updatedAt', to: 'updated_at' },
        { from: 'deletedAt', to: 'deleted_at' }
      ];
      
      for (const mapping of operatorColumnMappings) {
        if (operatorsTable[mapping.from] && !operatorsTable[mapping.to]) {
          console.log(`🔄 Renaming operators.${mapping.from} → ${mapping.to}`);
          await queryInterface.renameColumn('operators', mapping.from, mapping.to);
        } else if (operatorsTable[mapping.to]) {
          console.log(`✅ operators.${mapping.to} already exists`);
        }
      }
      
      // Add missing columns to operators
      const operatorsTableAfter = await queryInterface.describeTable('operators');
      
      if (!operatorsTableAfter.last_modified_by) {
        console.log('➕ Adding last_modified_by to operators');
        await queryInterface.addColumn('operators', 'last_modified_by', {
          type: Sequelize.UUID,
          allowNull: true
        });
      }
      
      if (!operatorsTableAfter.last_modified_at) {
        console.log('➕ Adding last_modified_at to operators');
        await queryInterface.addColumn('operators', 'last_modified_at', {
          type: Sequelize.DATE,
          allowNull: true,
          defaultValue: Sequelize.NOW
        });
      }
      
      if (!operatorsTableAfter.disable_reason) {
        console.log('➕ Adding disable_reason to operators');
        await queryInterface.addColumn('operators', 'disable_reason', {
          type: Sequelize.TEXT,
          allowNull: true
        });
      }
      
      if (!operatorsTableAfter.deleted_at) {
        console.log('➕ Adding deleted_at to operators');
        await queryInterface.addColumn('operators', 'deleted_at', {
          type: Sequelize.DATE,
          allowNull: true
        });
      }
      
      // ===== SUBSCRIPTIONS TABLE FIXES =====
      console.log('📋 Checking subscriptions table...');
      const subscriptionsTable = await queryInterface.describeTable('subscriptions');
      console.log('Current subscriptions columns:', Object.keys(subscriptionsTable).sort());
      
      const subscriptionColumnMappings = [
        { from: 'operatorId', to: 'operator_id' },
        { from: 'operatorSubscriptionId', to: 'operator_subscription_id' },
        { from: 'nextPaymentAt', to: 'next_payment_at' },
        { from: 'lastPaymentAt', to: 'last_payment_at' },
        { from: 'trialEndsAt', to: 'trial_ends_at' },
        { from: 'cancelledAt', to: 'cancelled_at' },
        { from: 'pausedAt', to: 'paused_at' },
        { from: 'pauseReason', to: 'pause_reason' },
        { from: 'totalPaid', to: 'total_paid' },
        { from: 'failedPayments', to: 'failed_payments' },
        { from: 'lastErrorCode', to: 'last_error_code' },
        { from: 'lastErrorMessage', to: 'last_error_message' },
        { from: 'createdAt', to: 'created_at' },
        { from: 'updatedAt', to: 'updated_at' },
        { from: 'deletedAt', to: 'deleted_at' }
      ];
      
      for (const mapping of subscriptionColumnMappings) {
        if (subscriptionsTable[mapping.from] && !subscriptionsTable[mapping.to]) {
          console.log(`🔄 Renaming subscriptions.${mapping.from} → ${mapping.to}`);
          await queryInterface.renameColumn('subscriptions', mapping.from, mapping.to);
        } else if (subscriptionsTable[mapping.to]) {
          console.log(`✅ subscriptions.${mapping.to} already exists`);
        }
      }
      
      // ===== TRANSACTIONS TABLE FIXES =====
      console.log('📋 Checking transactions table...');
      const transactionsTable = await queryInterface.describeTable('transactions');
      console.log('Current transactions columns:', Object.keys(transactionsTable).sort());
      
      const transactionColumnMappings = [
        { from: 'subscriptionId', to: 'subscription_id' },
        { from: 'operatorId', to: 'operator_id' },
        { from: 'operatorTransactionId', to: 'operator_transaction_id' },
        { from: 'operatorReference', to: 'operator_reference' },
        { from: 'billingCycle', to: 'billing_cycle' },
        { from: 'transactionDate', to: 'transaction_date' },
        { from: 'processedAt', to: 'processed_at' },
        { from: 'failureCode', to: 'failure_code' },
        { from: 'failureMessage', to: 'failure_message' },
        { from: 'retryCount', to: 'retry_count' },
        { from: 'lastRetryAt', to: 'last_retry_at' },
        { from: 'webhookSent', to: 'webhook_sent' },
        { from: 'webhookResponse', to: 'webhook_response' },
        { from: 'createdAt', to: 'created_at' },
        { from: 'updatedAt', to: 'updated_at' }
      ];
      
      for (const mapping of transactionColumnMappings) {
        if (transactionsTable[mapping.from] && !transactionsTable[mapping.to]) {
          console.log(`🔄 Renaming transactions.${mapping.from} → ${mapping.to}`);
          await queryInterface.renameColumn('transactions', mapping.from, mapping.to);
        } else if (transactionsTable[mapping.to]) {
          console.log(`✅ transactions.${mapping.to} already exists`);
        }
      }
      
      // ===== WEBHOOKS TABLE FIXES =====
      console.log('📋 Checking webhooks table...');
      const webhooksTable = await queryInterface.describeTable('webhooks');
      console.log('Current webhooks columns:', Object.keys(webhooksTable).sort());
      
      const webhookColumnMappings = [
        { from: 'subscriptionId', to: 'subscription_id' },
        { from: 'transactionId', to: 'transaction_id' },
        { from: 'operatorId', to: 'operator_id' },
        { from: 'eventType', to: 'event_type' },
        { from: 'eventData', to: 'event_data' },
        { from: 'targetUrl', to: 'target_url' },
        { from: 'httpMethod', to: 'http_method' },
        { from: 'httpHeaders', to: 'http_headers' },
        { from: 'httpStatus', to: 'http_status' },
        { from: 'responseBody', to: 'response_body' },
        { from: 'responseHeaders', to: 'response_headers' },
        { from: 'responseTime', to: 'response_time' },
        { from: 'retryCount', to: 'retry_count' },
        { from: 'maxRetries', to: 'max_retries' },
        { from: 'nextRetryAt', to: 'next_retry_at' },
        { from: 'lastAttemptAt', to: 'last_attempt_at' },
        { from: 'errorMessage', to: 'error_message' },
        { from: 'createdAt', to: 'created_at' },
        { from: 'updatedAt', to: 'updated_at' }
      ];
      
      for (const mapping of webhookColumnMappings) {
        if (webhooksTable[mapping.from] && !webhooksTable[mapping.to]) {
          console.log(`🔄 Renaming webhooks.${mapping.from} → ${mapping.to}`);
          await queryInterface.renameColumn('webhooks', mapping.from, mapping.to);
        } else if (webhooksTable[mapping.to]) {
          console.log(`✅ webhooks.${mapping.to} already exists`);
        }
      }
      
      // ===== USERS TABLE FIXES =====
      console.log('📋 Checking users table...');
      const usersTable = await queryInterface.describeTable('users');
      console.log('Current users columns:', Object.keys(usersTable).sort());
      
      const userColumnMappings = [
        { from: 'firstName', to: 'first_name' },
        { from: 'lastName', to: 'last_name' },
        { from: 'isActive', to: 'is_active' },
        { from: 'emailVerified', to: 'email_verified' },
        { from: 'emailVerifiedAt', to: 'email_verified_at' },
        { from: 'lastLoginAt', to: 'last_login_at' },
        { from: 'lastLoginIp', to: 'last_login_ip' },
        { from: 'passwordResetToken', to: 'password_reset_token' },
        { from: 'passwordResetExpires', to: 'password_reset_expires' },
        { from: 'twoFactorEnabled', to: 'two_factor_enabled' },
        { from: 'twoFactorSecret', to: 'two_factor_secret' },
        { from: 'createdAt', to: 'created_at' },
        { from: 'updatedAt', to: 'updated_at' }
      ];
      
      for (const mapping of userColumnMappings) {
        if (usersTable[mapping.from] && !usersTable[mapping.to]) {
          console.log(`🔄 Renaming users.${mapping.from} → ${mapping.to}`);
          await queryInterface.renameColumn('users', mapping.from, mapping.to);
        } else if (usersTable[mapping.to]) {
          console.log(`✅ users.${mapping.to} already exists`);
        }
      }
      
      // ===== SESSIONS TABLE FIXES =====
      console.log('📋 Checking sessions table...');
      const sessionsTable = await queryInterface.describeTable('sessions');
      console.log('Current sessions columns:', Object.keys(sessionsTable).sort());
      
      const sessionColumnMappings = [
        { from: 'userId', to: 'user_id' },
        { from: 'ipAddress', to: 'ip_address' },
        { from: 'userAgent', to: 'user_agent' },
        { from: 'expiresAt', to: 'expires_at' },
        { from: 'lastUsedAt', to: 'last_used_at' },
        { from: 'createdAt', to: 'created_at' },
        { from: 'updatedAt', to: 'updated_at' }
      ];
      
      for (const mapping of sessionColumnMappings) {
        if (sessionsTable[mapping.from] && !sessionsTable[mapping.to]) {
          console.log(`🔄 Renaming sessions.${mapping.from} → ${mapping.to}`);
          await queryInterface.renameColumn('sessions', mapping.from, mapping.to);
        } else if (sessionsTable[mapping.to]) {
          console.log(`✅ sessions.${mapping.to} already exists`);
        }
      }
      
      // ===== AUDIT_LOGS TABLE FIXES =====
      console.log('📋 Checking audit_logs table...');
      const auditLogsTable = await queryInterface.describeTable('audit_logs');
      console.log('Current audit_logs columns:', Object.keys(auditLogsTable).sort());
      
      const auditLogColumnMappings = [
        { from: 'userId', to: 'user_id' },
        { from: 'entityType', to: 'entity_type' },
        { from: 'entityId', to: 'entity_id' },
        { from: 'operationType', to: 'operation_type' },
        { from: 'oldValues', to: 'old_values' },
        { from: 'newValues', to: 'new_values' },
        { from: 'ipAddress', to: 'ip_address' },
        { from: 'userAgent', to: 'user_agent' },
        { from: 'sessionId', to: 'session_id' },
        { from: 'operatorId', to: 'operator_id' },
        { from: 'subscriptionId', to: 'subscription_id' },
        { from: 'transactionId', to: 'transaction_id' },
        { from: 'operationStatus', to: 'operation_status' },
        { from: 'errorMessage', to: 'error_message' },
        { from: 'processingTime', to: 'processing_time' },
        { from: 'createdAt', to: 'created_at' },
        { from: 'updatedAt', to: 'updated_at' }
      ];
      
      for (const mapping of auditLogColumnMappings) {
        if (auditLogsTable[mapping.from] && !auditLogsTable[mapping.to]) {
          console.log(`🔄 Renaming audit_logs.${mapping.from} → ${mapping.to}`);
          await queryInterface.renameColumn('audit_logs', mapping.from, mapping.to);
        } else if (auditLogsTable[mapping.to]) {
          console.log(`✅ audit_logs.${mapping.to} already exists`);
        }
      }
      
      console.log('✅ All column naming fixes completed successfully!');
      
    } catch (error) {
      console.error('❌ Error during column naming fixes:', error);
      throw error;
    }
  },

  down: async (queryInterface, Sequelize) => {
    console.log('🔄 Reverting column naming fixes...');
    
    // This is a complex rollback, but essentially we'd reverse all the renames
    // For safety, we'll just log that this rollback is not implemented
    // since the renames should be the correct state
    
    console.log('⚠️  Manual rollback required - contact development team');
    console.log('   This migration corrects column naming to match Sequelize conventions');
    console.log('   Reverting could break the application');
    
    // If really needed, reverse each rename operation from the up() method
    // But this should generally not be necessary as these are bug fixes
  }
};
