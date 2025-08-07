'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // 🔧 FIXED: Create ENUMs using raw SQL to avoid compatibility issues
    await queryInterface.sequelize.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_subscriptions_status') THEN
          CREATE TYPE enum_subscriptions_status AS ENUM(
            'ACTIVE', 'SUSPENDED', 'DELETED', 'REMOVED', 
            'TRIAL', 'GRACE', 'PENDING', 'CANCELLED'
          );
        END IF;
      END $$;
    `);
    
    await queryInterface.sequelize.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_subscriptions_frequency') THEN
          CREATE TYPE enum_subscriptions_frequency AS ENUM(
            'daily', 'weekly', 'fortnightly', 'monthly'
          );
        END IF;
      END $$;
    `);

    // 🔧 FIXED: Create table using string references to ENUMs instead of Sequelize.ENUM
    await queryInterface.createTable('subscriptions', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false
      },
      uuid: {
        type: Sequelize.STRING(100),
        allowNull: false,
        unique: true,
        comment: 'SLA Digital subscription UUID'
      },
      operatorId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'operators',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
        comment: 'Reference to the operator'
      },
      operatorCode: {
        type: Sequelize.STRING(50),
        allowNull: false,
        comment: 'Denormalized operator code for quick access'
      },
      msisdn: {
        type: Sequelize.STRING(20),
        allowNull: false,
        comment: 'Subscriber mobile number'
      },
      status: {
        type: 'enum_subscriptions_status',
        allowNull: false,
        defaultValue: 'PENDING',
        comment: 'Current subscription status'
      },
      frequency: {
        type: 'enum_subscriptions_frequency',
        allowNull: false,
        defaultValue: 'daily',
        comment: 'Billing frequency'
      },
      amount: {
        type: Sequelize.DECIMAL(10, 4),
        allowNull: false,
        comment: 'Subscription amount'
      },
      currency: {
        type: Sequelize.STRING(3),
        allowNull: false,
        comment: 'ISO 4217 currency code'
      },
      campaign: {
        type: Sequelize.STRING(100),
        allowNull: true,
        comment: 'SLA Digital campaign identifier'
      },
      merchant: {
        type: Sequelize.STRING(100),
        allowNull: true,
        comment: 'SLA Digital merchant identifier'
      },
      trialDays: {
        type: Sequelize.INTEGER,
        allowNull: true,
        comment: 'Number of trial days (if applicable)'
      },
      nextPaymentDate: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'Next scheduled payment date'
      },
      lastPaymentDate: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'Last successful payment date'
      },
      activatedAt: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'When subscription was activated'
      },
      suspendedAt: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'When subscription was suspended'
      },
      cancelledAt: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'When subscription was cancelled'
      },
      metadata: {
        type: Sequelize.JSONB,
        allowNull: true,
        defaultValue: {},
        comment: 'Additional subscription metadata'
      },
      slaResponse: {
        type: Sequelize.JSONB,
        allowNull: true,
        comment: 'Original SLA Digital API response'
      },
      errorDetails: {
        type: Sequelize.JSONB,
        allowNull: true,
        comment: 'Error details if subscription failed'
      },
      retryCount: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: 'Number of retry attempts'
      },
      lastRetryAt: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'Last retry attempt timestamp'
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW
      }
    });

    // Add indexes for performance
    await queryInterface.addIndex('subscriptions', ['uuid'], {
      unique: true,
      name: 'subscriptions_uuid_unique'
    });
    
    await queryInterface.addIndex('subscriptions', ['operatorId'], {
      name: 'subscriptions_operator_id_idx'
    });
    
    await queryInterface.addIndex('subscriptions', ['operatorCode'], {
      name: 'subscriptions_operator_code_idx'
    });
    
    await queryInterface.addIndex('subscriptions', ['msisdn'], {
      name: 'subscriptions_msisdn_idx'
    });
    
    await queryInterface.addIndex('subscriptions', ['status'], {
      name: 'subscriptions_status_idx'
    });
    
    await queryInterface.addIndex('subscriptions', ['nextPaymentDate'], {
      name: 'subscriptions_next_payment_idx'
    });

    await queryInterface.addIndex('subscriptions', ['createdAt'], {
      name: 'subscriptions_created_at_idx'
    });

    // Composite indexes for common queries
    await queryInterface.addIndex('subscriptions', ['operatorCode', 'status'], {
      name: 'subscriptions_operator_status_idx'
    });

    await queryInterface.addIndex('subscriptions', ['msisdn', 'operatorCode'], {
      name: 'subscriptions_msisdn_operator_idx'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('subscriptions');
    
    // 🔧 FIXED: Drop ENUMs using raw SQL
    await queryInterface.sequelize.query(`
      DROP TYPE IF EXISTS enum_subscriptions_status;
      DROP TYPE IF EXISTS enum_subscriptions_frequency;
    `);
  }
};
