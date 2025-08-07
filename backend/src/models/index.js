/**
 * Database Models Index
 * 
 * Initializes all Sequelize models and their associations
 */

const { getDatabase } = require('../database/connection');
const Logger = require('../utils/logger');

// Import all models
const OperatorModel = require('./Operator');
const SubscriptionModel = require('./Subscription');
const TransactionModel = require('./Transaction');
const WebhookModel = require('./Webhook');
const AuditLogModel = require('./AuditLog');
const UserModel = require('./User');
const SessionModel = require('./Session');

// Global models object to hold initialized models
let models = {};

/**
 * Initialize all models with database instance
 */
function initializeModels() {
  try {
    const sequelize = getDatabase();
    
    // Initialize models
    models = {
      Operator: OperatorModel.init(sequelize),
      Subscription: SubscriptionModel.init(sequelize),
      Transaction: TransactionModel.init(sequelize),
      Webhook: WebhookModel.init(sequelize),
      AuditLog: AuditLogModel.init(sequelize),
      User: UserModel.init(sequelize),
      Session: SessionModel.init(sequelize)
    };
    
    // Set up associations
    setupAssociations(models);
    
    Logger.info('Database models initialized successfully', {
      modelCount: Object.keys(models).length,
      models: Object.keys(models)
    });
    
    return models;
  } catch (error) {
    Logger.error('Failed to initialize models', {
      error: error.message,
      stack: error.stack
    });
    throw error;
  }
}

/**
 * Set up model associations
 */
function setupAssociations(models) {
  const { Operator, Subscription, Transaction, Webhook, AuditLog, User, Session } = models;
  
  // Operator associations
  Operator.hasMany(Subscription, {
    foreignKey: 'operatorId',
    as: 'subscriptions'
  });
  
  Operator.hasMany(Transaction, {
    foreignKey: 'operatorId',
    as: 'transactions'
  });
  
  Operator.hasMany(Webhook, {
    foreignKey: 'operatorId',
    as: 'webhooks'
  });
  
  // Subscription associations
  Subscription.belongsTo(Operator, {
    foreignKey: 'operatorId',
    as: 'operator'
  });
  
  Subscription.hasMany(Transaction, {
    foreignKey: 'subscriptionId',
    as: 'transactions'
  });
  
  Subscription.hasMany(Webhook, {
    foreignKey: 'subscriptionId',
    as: 'webhooks'
  });
  
  // Transaction associations
  Transaction.belongsTo(Operator, {
    foreignKey: 'operatorId',
    as: 'operator'
  });
  
  Transaction.belongsTo(Subscription, {
    foreignKey: 'subscriptionId',
    as: 'subscription'
  });
  
  // Webhook associations
  Webhook.belongsTo(Operator, {
    foreignKey: 'operatorId',
    as: 'operator'
  });
  
  Webhook.belongsTo(Subscription, {
    foreignKey: 'subscriptionId',
    as: 'subscription'
  });
  
  // User associations
  User.hasMany(Session, {
    foreignKey: 'userId',
    as: 'sessions'
  });
  
  User.hasMany(AuditLog, {
    foreignKey: 'userId',
    as: 'auditLogs'
  });
  
  // Session associations
  Session.belongsTo(User, {
    foreignKey: 'userId',
    as: 'user'
  });
  
  // Audit Log associations
  AuditLog.belongsTo(User, {
    foreignKey: 'userId',
    as: 'user'
  });
  
  AuditLog.belongsTo(Operator, {
    foreignKey: 'operatorId',
    as: 'operator'
  });
}

/**
 * Get initialized models (after models are initialized)
 */
function getModels() {
  if (Object.keys(models).length === 0) {
    throw new Error('Models not initialized. Call initializeModels() first.');
  }
  return models;
}

module.exports = {
  initializeModels,
  setupAssociations,
  getModels,
  // Export individual models for direct access
  get Operator() { return models.Operator; },
  get Subscription() { return models.Subscription; },
  get Transaction() { return models.Transaction; },
  get Webhook() { return models.Webhook; },
  get AuditLog() { return models.AuditLog; },
  get User() { return models.User; },
  get Session() { return models.Session; }
};
