'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // 🔧 FIXED: Create ENUMs using raw SQL to avoid compatibility issues
    await queryInterface.sequelize.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_transactions_type') THEN
          CREATE TYPE enum_transactions_type AS ENUM(
            'charge', 'subscription', 'refund', 'reversal'
          );
        END IF;
      END $$;
    `);
    
    await queryInterface.sequelize.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_transactions_status') THEN
          CREATE TYPE enum_transactions_status AS ENUM(
            'pending', 'processing', 'success', 'failed', 
            'insufficient_funds', 'cancelled', 'expired', 
            'refunded', 'partially_refunded'
          );
        END IF;
      END $$;
    `);

    await queryInterface.createTable('transactions', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false
      },
      transaction_id: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true,
        comment: 'SLA Digital transaction identifier'
      },
      subscription_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'subscriptions',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
        comment: 'Associated subscription (null for one-off charges)'
      },
      operator_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'operators',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
        comment: 'Associated operator'
      },
      type: {
        type: 'enum_transactions_type',
        allowNull: false,
        defaultValue: 'charge',
      },
      status: {
        type: 'enum_transactions_status',
        allowNull: false,
        defaultValue: 'pending',
      },
      msisdn: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      amount: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
      },
      currency: {
        type: Sequelize.STRING(3),
        allowNull: false,
      },
      gross_amount: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
      },
      net_amount: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
      },
      operator_share: {
        type: Sequelize.DECIMAL(5, 2),
        allowNull: true,
      },
      description: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      external_ref: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      correlator: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      attempt_count: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 1,
      },
      next_retry_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      processed_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      completed_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      failed_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      error_code: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      error_message: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      api_response: {
        type: Sequelize.JSONB,
        allowNull: true,
      },
      metadata: {
        type: Sequelize.JSONB,
        defaultValue: {},
      },
      webhook_delivered: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      webhook_delivered_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW
      },
      deleted_at: {
        type: Sequelize.DATE,
        allowNull: true,
      }
    });

    // Add indexes
    await queryInterface.addIndex('transactions', ['transaction_id'], {
      unique: true,
      name: 'transactions_transaction_id_unique'
    });
    
    await queryInterface.addIndex('transactions', ['subscription_id'], {
      name: 'transactions_subscription_id_idx'
    });
    
    await queryInterface.addIndex('transactions', ['operator_id'], {
      name: 'transactions_operator_id_idx'
    });
    
    await queryInterface.addIndex('transactions', ['msisdn'], {
      name: 'transactions_msisdn_idx'
    });
    
    await queryInterface.addIndex('transactions', ['status'], {
      name: 'transactions_status_idx'
    });
    
    await queryInterface.addIndex('transactions', ['type'], {
      name: 'transactions_type_idx'
    });
    
    await queryInterface.addIndex('transactions', ['correlator'], {
      name: 'transactions_correlator_idx'
    });
    
    await queryInterface.addIndex('transactions', ['external_ref'], {
      name: 'transactions_external_ref_idx'
    });
    
    await queryInterface.addIndex('transactions', ['created_at'], {
      name: 'transactions_created_at_idx'
    });
    
    await queryInterface.addIndex('transactions', ['processed_at'], {
      name: 'transactions_processed_at_idx'
    });
    
    await queryInterface.addIndex('transactions', ['next_retry_at'], {
      name: 'transactions_next_retry_at_idx'
    });
    
    await queryInterface.addIndex('transactions', ['webhook_delivered'], {
      name: 'transactions_webhook_delivered_idx'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('transactions');
    
    // 🔧 FIXED: Drop ENUMs using raw SQL
    await queryInterface.sequelize.query(`
      DROP TYPE IF EXISTS enum_transactions_type;
      DROP TYPE IF EXISTS enum_transactions_status;
    `);
  }
};
