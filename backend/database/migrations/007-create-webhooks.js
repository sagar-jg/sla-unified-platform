'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // 🔧 FIXED: Create ENUMs using raw SQL to avoid compatibility issues
    await queryInterface.sequelize.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_webhooks_event_type') THEN
          CREATE TYPE enum_webhooks_event_type AS ENUM(
            'subscription_created', 'subscription_activated', 
            'subscription_cancelled', 'subscription_suspended',
            'subscription_renewed', 'charge_success', 'charge_failed',
            'refund_processed', 'transaction_updated', 'pin_generated',
            'pin_verified', 'eligibility_checked'
          );
        END IF;
      END $$;
    `);
    
    await queryInterface.sequelize.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_webhooks_status') THEN
          CREATE TYPE enum_webhooks_status AS ENUM(
            'received', 'processing', 'processed', 
            'failed', 'retrying', 'ignored'
          );
        END IF;
      END $$;
    `);

    await queryInterface.createTable('webhooks', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false
      },
      event_type: {
        type: 'enum_webhooks_event_type',
        allowNull: false,
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
      },
      payload: {
        type: Sequelize.JSONB,
        allowNull: false,
      },
      headers: {
        type: Sequelize.JSONB,
        allowNull: true,
      },
      status: {
        type: 'enum_webhooks_status',
        allowNull: false,
        defaultValue: 'received',
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
      failed_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      error_message: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      error_stack: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      processing_results: {
        type: Sequelize.JSONB,
        allowNull: true,
      },
      source_ip: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      signature_valid: {
        type: Sequelize.BOOLEAN,
        allowNull: true,
      },
      is_duplicate: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      duplicate_of: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'webhooks',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      metadata: {
        type: Sequelize.JSONB,
        defaultValue: {},
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
    await queryInterface.addIndex('webhooks', ['event_type'], {
      name: 'webhooks_event_type_idx'
    });
    
    await queryInterface.addIndex('webhooks', ['operator_id'], {
      name: 'webhooks_operator_id_idx'
    });
    
    await queryInterface.addIndex('webhooks', ['subscription_id'], {
      name: 'webhooks_subscription_id_idx'
    });
    
    await queryInterface.addIndex('webhooks', ['status'], {
      name: 'webhooks_status_idx'
    });
    
    await queryInterface.addIndex('webhooks', ['created_at'], {
      name: 'webhooks_created_at_idx'
    });
    
    await queryInterface.addIndex('webhooks', ['processed_at'], {
      name: 'webhooks_processed_at_idx'
    });
    
    await queryInterface.addIndex('webhooks', ['next_retry_at'], {
      name: 'webhooks_next_retry_at_idx'
    });
    
    await queryInterface.addIndex('webhooks', ['is_duplicate'], {
      name: 'webhooks_is_duplicate_idx'
    });
    
    await queryInterface.addIndex('webhooks', ['source_ip'], {
      name: 'webhooks_source_ip_idx'
    });

    // Composite index for duplicate detection
    await queryInterface.addIndex('webhooks', ['event_type', 'operator_id', 'payload'], {
      name: 'webhook_duplicate_check'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('webhooks');
    
    // 🔧 FIXED: Drop ENUMs using raw SQL
    await queryInterface.sequelize.query(`
      DROP TYPE IF EXISTS enum_webhooks_event_type;
      DROP TYPE IF EXISTS enum_webhooks_status;
    `);
  }
};
