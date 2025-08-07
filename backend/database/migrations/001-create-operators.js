'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('operators', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false
      },
      code: {
        type: Sequelize.STRING(50),
        allowNull: false,
        unique: true,
        comment: 'Unique operator code (e.g., zain-kw, etisalat-ae)'
      },
      name: {
        type: Sequelize.STRING(100),
        allowNull: false,
        comment: 'Human-readable operator name'
      },
      country: {
        type: Sequelize.STRING(2),
        allowNull: false,
        comment: 'ISO 3166-1 alpha-2 country code'
      },
      enabled: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        comment: 'Whether the operator is currently enabled'
      },
      config: {
        type: Sequelize.JSONB,
        allowNull: false,
        defaultValue: {},
        comment: 'Operator-specific configuration (endpoints, limits, etc.)'
      },
      credentials: {
        type: Sequelize.JSONB,
        allowNull: false,
        defaultValue: {},
        comment: 'Encrypted operator credentials'
      },
      environment: {
        type: Sequelize.ENUM('sandbox', 'preproduction', 'production'),
        allowNull: false,
        defaultValue: 'sandbox',
        comment: 'Current environment for this operator'
      },
      priority: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: 'Priority for operator selection (higher = preferred)'
      },
      status: {
        type: Sequelize.ENUM('active', 'inactive', 'maintenance', 'deprecated'),
        allowNull: false,
        defaultValue: 'active',
        comment: 'Current operational status'
      },
      health_score: {
        type: Sequelize.DECIMAL(3, 2),
        allowNull: false,
        defaultValue: 1.00,
        validate: {
          min: 0.00,
          max: 1.00
        },
        comment: 'Health score from 0.00 to 1.00 based on recent performance'
      },
      last_health_check: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'Timestamp of last successful health check'
      },
      last_modified_by: {
        type: Sequelize.STRING(100),
        allowNull: true,
        comment: 'User who last modified the operator'
      },
      last_modified_at: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'Timestamp when operator was last modified'
      },
      disable_reason: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Reason for disable if enabled=false'
      },
      disabled_by: {
        type: Sequelize.STRING(100),
        allowNull: true,
        comment: 'User who disabled the operator'
      },
      disabled_at: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'Timestamp when operator was disabled'
      },
      metadata: {
        type: Sequelize.JSONB,
        allowNull: true,
        defaultValue: {},
        comment: 'Additional metadata for analytics and reporting'
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
        allowNull: true
      }
    });

    // Add indexes for performance
    await queryInterface.addIndex('operators', ['code'], {
      unique: true,
      name: 'operators_code_unique'
    });
    
    await queryInterface.addIndex('operators', ['country'], {
      name: 'operators_country_idx'
    });
    
    await queryInterface.addIndex('operators', ['enabled', 'status'], {
      name: 'operators_enabled_status_idx'
    });
    
    await queryInterface.addIndex('operators', ['health_score'], {
      name: 'operators_health_score_idx'
    });

    await queryInterface.addIndex('operators', ['priority'], {
      name: 'operators_priority_idx'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('operators');
  }
};
