/**
 * AuditLog Model
 * 
 * Comprehensive audit logging for all system operations with detailed tracking
 */

const { DataTypes, Model } = require('sequelize');
const Logger = require('../utils/logger');

class AuditLog extends Model {
  /**
   * Initialize the AuditLog model
   */
  static init(sequelize) {
    return super.init({
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
      },
      
      userId: {
        type: DataTypes.UUID,
        allowNull: true,
        field: 'user_id',
        references: {
          model: 'users',
          key: 'id'
        },
        comment: 'User who performed the action (null for system actions)'
      },
      
      entityType: {
        type: DataTypes.ENUM('operator', 'subscription', 'transaction', 'webhook', 'user', 'session', 'system'),
        allowNull: false,
        field: 'entity_type',
        comment: 'Type of entity being audited'
      },
      
      entityId: {
        type: DataTypes.UUID,
        allowNull: true,
        field: 'entity_id',
        comment: 'ID of the entity being audited'
      },
      
      operationType: {
        type: DataTypes.ENUM('create', 'read', 'update', 'delete', 'enable', 'disable', 'login', 'logout', 'api_call'),
        allowNull: false,
        field: 'operation_type',
        comment: 'Type of operation performed'
      },
      
      description: {
        type: DataTypes.TEXT,
        allowNull: false,
        comment: 'Human-readable description of the action'
      },
      
      oldValues: {
        type: DataTypes.JSONB,
        allowNull: true,
        field: 'old_values',
        comment: 'Previous values (for updates)'
      },
      
      newValues: {
        type: DataTypes.JSONB,
        allowNull: true,
        field: 'new_values',
        comment: 'New values (for creates/updates)'
      },
      
      ipAddress: {
        type: DataTypes.INET,
        allowNull: true,
        field: 'ip_address',
        comment: 'IP address of the request'
      },
      
      userAgent: {
        type: DataTypes.TEXT,
        allowNull: true,
        field: 'user_agent',
        comment: 'User agent string'
      },
      
      sessionId: {
        type: DataTypes.UUID,
        allowNull: true,
        field: 'session_id',
        references: {
          model: 'sessions',
          key: 'id'
        },
        comment: 'Session ID (if applicable)'
      },
      
      operatorId: {
        type: DataTypes.UUID,
        allowNull: true,
        field: 'operator_id',
        references: {
          model: 'operators',
          key: 'id'
        },
        comment: 'Related operator (if applicable)'
      },
      
      subscriptionId: {
        type: DataTypes.UUID,
        allowNull: true,
        field: 'subscription_id',
        references: {
          model: 'subscriptions',
          key: 'id'
        },
        comment: 'Related subscription (if applicable)'
      },
      
      transactionId: {
        type: DataTypes.UUID,
        allowNull: true,
        field: 'transaction_id',
        references: {
          model: 'transactions',
          key: 'id'
        },
        comment: 'Related transaction (if applicable)'
      },
      
      operationStatus: {
        type: DataTypes.ENUM('success', 'failure', 'partial'),
        allowNull: false,
        defaultValue: 'success',
        field: 'operation_status',
        comment: 'Success/failure status of the operation'
      },
      
      errorMessage: {
        type: DataTypes.TEXT,
        allowNull: true,
        field: 'error_message',
        comment: 'Error message (if operation failed)'
      },
      
      processingTime: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: 'processing_time',
        comment: 'Processing time in milliseconds'
      },
      
      severity: {
        type: DataTypes.ENUM('info', 'warning', 'error', 'critical'),
        allowNull: false,
        defaultValue: 'info',
        comment: 'Severity level of the audit event'
      },
      
      category: {
        type: DataTypes.ENUM('authentication', 'authorization', 'data_change', 'system_config', 'billing', 'api'),
        allowNull: false,
        defaultValue: 'data_change',
        comment: 'Category of the audit event'
      },
      
      tags: {
        type: DataTypes.ARRAY(DataTypes.STRING),
        allowNull: true,
        comment: 'Tags for categorization and filtering'
      },
      
      metadata: {
        type: DataTypes.JSONB,
        defaultValue: {},
        comment: 'Additional metadata for the audit event'
      },
      
      correlationId: {
        type: DataTypes.UUID,
        allowNull: true,
        field: 'correlation_id',
        comment: 'Correlation ID for tracking related operations'
      }
    }, {
      sequelize,
      modelName: 'AuditLog',
      tableName: 'audit_logs',
      timestamps: true,
      
      // ✅ FIX: Explicit field mapping for timestamps
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      
      // ✅ FIX: Use underscored naming
      underscored: true,
      
      indexes: [
        {
          fields: ['user_id']
        },
        {
          fields: ['entity_type']
        },
        {
          fields: ['entity_id']
        },
        {
          fields: ['operation_type']
        },
        {
          fields: ['operation_status']
        },
        {
          fields: ['severity']
        },
        {
          fields: ['category']
        },
        {
          fields: ['created_at']
        },
        {
          fields: ['operator_id']
        },
        {
          fields: ['subscription_id']
        },
        {
          fields: ['transaction_id']
        },
        {
          fields: ['correlation_id']
        },
        // Composite indexes for common queries
        {
          fields: ['entity_type', 'entity_id', 'created_at']
        },
        {
          fields: ['user_id', 'created_at']
        },
        {
          fields: ['operation_status', 'severity', 'created_at']
        }
      ]
    });
  }
  
  /**
   * Create audit log entry
   */
  static async createAuditLog(data) {
    try {
      const auditLog = await this.create({
        ...data,
        createdAt: new Date()
      });
      
      Logger.debug('Audit log entry created', {
        auditId: auditLog.id,
        entityType: data.entityType,
        operationType: data.operationType,
        operationStatus: data.operationStatus
      });
      
      return auditLog;
    } catch (error) {
      Logger.error('Failed to create audit log entry', {
        error: error.message,
        data,
        stack: error.stack
      });
      // Don't throw here - audit logging failures shouldn't break the main operation
      return null;
    }
  }
  
  /**
   * Log operator action
   */
  static async logOperatorAction(userId, operatorId, operationType, description, oldValues = null, newValues = null, metadata = {}) {
    return await this.createAuditLog({
      userId,
      entityType: 'operator',
      entityId: operatorId,
      operationType,
      description,
      oldValues,
      newValues,
      operatorId,
      category: 'system_config',
      metadata
    });
  }
  
  /**
   * Log subscription event
   */
  static async logSubscriptionEvent(subscriptionId, operatorId, operationType, description, oldValues = null, newValues = null, metadata = {}) {
    return await this.createAuditLog({
      entityType: 'subscription',
      entityId: subscriptionId,
      operationType,
      description,
      oldValues,
      newValues,
      operatorId,
      subscriptionId,
      category: 'billing',
      metadata
    });
  }
  
  /**
   * Log transaction event
   */
  static async logTransactionEvent(transactionId, subscriptionId, operatorId, operationType, description, status = 'success', metadata = {}) {
    return await this.createAuditLog({
      entityType: 'transaction',
      entityId: transactionId,
      operationType,
      description,
      operationStatus: status,
      operatorId,
      subscriptionId,
      transactionId,
      category: 'billing',
      severity: status === 'failure' ? 'error' : 'info',
      metadata
    });
  }
  
  /**
   * Log user authentication
   */
  static async logAuthentication(userId, operationType, ipAddress, userAgent, status = 'success', errorMessage = null, sessionId = null) {
    return await this.createAuditLog({
      userId,
      entityType: 'user',
      entityId: userId,
      operationType,
      description: `User ${operationType}`,
      operationStatus: status,
      errorMessage,
      ipAddress,
      userAgent,
      sessionId,
      category: 'authentication',
      severity: status === 'failure' ? 'warning' : 'info'
    });
  }
  
  /**
   * Log API call
   */
  static async logApiCall(operatorId, endpoint, method, statusCode, processingTime, userId = null, metadata = {}) {
    const status = statusCode >= 200 && statusCode < 400 ? 'success' : 'failure';
    
    return await this.createAuditLog({
      userId,
      entityType: 'system',
      operationType: 'api_call',
      description: `${method} ${endpoint}`,
      operationStatus: status,
      operatorId,
      processingTime,
      category: 'api',
      severity: status === 'failure' ? 'error' : 'info',
      metadata: {
        ...metadata,
        endpoint,
        method,
        statusCode
      }
    });
  }
  
  /**
   * Get audit trail for entity
   */
  static async getAuditTrail(entityType, entityId, options = {}) {
    const { limit = 50, offset = 0, operationType } = options;
    
    const whereClause = { entityType, entityId };
    if (operationType) {
      whereClause.operationType = operationType;
    }
    
    return await this.findAll({
      where: whereClause,
      order: [['created_at', 'DESC']],
      limit,
      offset,
      include: [
        {
          model: this.sequelize.models.User,
          as: 'user',
          attributes: ['id', 'email', 'firstName', 'lastName']
        }
      ]
    });
  }
  
  /**
   * Get security events
   */
  static async getSecurityEvents(startDate, endDate, severity = null) {
    const whereClause = {
      category: ['authentication', 'authorization'],
      created_at: {
        [this.sequelize.Op.between]: [startDate, endDate]
      }
    };
    
    if (severity) {
      whereClause.severity = severity;
    }
    
    return await this.findAll({
      where: whereClause,
      order: [['created_at', 'DESC']],
      limit: 1000
    });
  }
  
  /**
   * Get operation statistics
   */
  static async getOperationStats(startDate, endDate, entityType = null) {
    const whereClause = {
      created_at: {
        [this.sequelize.Op.between]: [startDate, endDate]
      }
    };
    
    if (entityType) {
      whereClause.entityType = entityType;
    }
    
    return await this.findAll({
      attributes: [
        'entity_type',
        'operation_type',
        'operation_status',
        [this.sequelize.fn('COUNT', this.sequelize.col('id')), 'count'],
        [this.sequelize.fn('AVG', this.sequelize.col('processing_time')), 'avg_processing_time']
      ],
      where: whereClause,
      group: ['entity_type', 'operation_type', 'operation_status'],
      raw: true
    });
  }
}

module.exports = AuditLog;
