'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // 🔧 FIXED: Create ENUMs using raw SQL to avoid compatibility issues
    await queryInterface.sequelize.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_audit_logs_category') THEN
          CREATE TYPE enum_audit_logs_category AS ENUM(
            'auth', 'operator', 'subscription', 'transaction',
            'webhook', 'admin', 'api', 'system'
          );
        END IF;
      END $$;
    `);
    
    await queryInterface.sequelize.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_audit_logs_risk_level') THEN
          CREATE TYPE enum_audit_logs_risk_level AS ENUM(
            'low', 'medium', 'high', 'critical'
          );
        END IF;
      END $$;
    `);

    await queryInterface.createTable('audit_logs', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false
      },
      user_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      category: {
        type: 'enum_audit_logs_category',
        allowNull: false,
      },
      action: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },
      resource_type: {
        type: Sequelize.STRING(50),
        allowNull: true,
      },
      resource_id: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      operator_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'operators',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      http_method: {
        type: Sequelize.STRING(10),
        allowNull: true,
      },
      http_path: {
        type: Sequelize.STRING(500),
        allowNull: true,
      },
      http_status: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      user_agent: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      client_ip: {
        type: Sequelize.STRING(45),
        allowNull: true,
      },
      request_data: {
        type: Sequelize.JSONB,
        allowNull: true,
      },
      response_data: {
        type: Sequelize.JSONB,
        allowNull: true,
      },
      old_values: {
        type: Sequelize.JSONB,
        allowNull: true,
      },
      new_values: {
        type: Sequelize.JSONB,
        allowNull: true,
      },
      processing_time_ms: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      risk_level: {
        type: 'enum_audit_logs_risk_level',
        allowNull: false,
        defaultValue: 'low',
      },
      success: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      error_message: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      error_code: {
        type: Sequelize.STRING(50),
        allowNull: true,
      },
      metadata: {
        type: Sequelize.JSONB,
        defaultValue: {},
      },
      session_id: {
        type: Sequelize.UUID,
        allowNull: true,
      },
      correlation_id: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      timestamp: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
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
      }
    });

    // Add indexes
    await queryInterface.addIndex('audit_logs', ['user_id'], {
      name: 'audit_logs_user_id_idx'
    });
    
    await queryInterface.addIndex('audit_logs', ['operator_id'], {
      name: 'audit_logs_operator_id_idx'
    });
    
    await queryInterface.addIndex('audit_logs', ['category'], {
      name: 'audit_logs_category_idx'
    });
    
    await queryInterface.addIndex('audit_logs', ['action'], {
      name: 'audit_logs_action_idx'
    });
    
    await queryInterface.addIndex('audit_logs', ['resource_type'], {
      name: 'audit_logs_resource_type_idx'
    });
    
    await queryInterface.addIndex('audit_logs', ['resource_id'], {
      name: 'audit_logs_resource_id_idx'
    });
    
    await queryInterface.addIndex('audit_logs', ['timestamp'], {
      name: 'audit_logs_timestamp_idx'
    });
    
    await queryInterface.addIndex('audit_logs', ['risk_level'], {
      name: 'audit_logs_risk_level_idx'
    });
    
    await queryInterface.addIndex('audit_logs', ['success'], {
      name: 'audit_logs_success_idx'
    });
    
    await queryInterface.addIndex('audit_logs', ['client_ip'], {
      name: 'audit_logs_client_ip_idx'
    });
    
    await queryInterface.addIndex('audit_logs', ['session_id'], {
      name: 'audit_logs_session_id_idx'
    });
    
    await queryInterface.addIndex('audit_logs', ['correlation_id'], {
      name: 'audit_logs_correlation_id_idx'
    });
    
    await queryInterface.addIndex('audit_logs', ['http_status'], {
      name: 'audit_logs_http_status_idx'
    });

    // Composite indexes for common queries
    await queryInterface.addIndex('audit_logs', ['category', 'action'], {
      name: 'audit_logs_category_action_idx'
    });
    
    await queryInterface.addIndex('audit_logs', ['user_id', 'timestamp'], {
      name: 'audit_logs_user_timestamp_idx'
    });
    
    await queryInterface.addIndex('audit_logs', ['operator_id', 'timestamp'], {
      name: 'audit_logs_operator_timestamp_idx'
    });
    
    await queryInterface.addIndex('audit_logs', ['resource_type', 'resource_id'], {
      name: 'audit_logs_resource_idx'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('audit_logs');
    
    // 🔧 FIXED: Drop ENUMs using raw SQL
    await queryInterface.sequelize.query(`
      DROP TYPE IF EXISTS enum_audit_logs_category;
      DROP TYPE IF EXISTS enum_audit_logs_risk_level;
    `);
  }
};
