'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // 🔧 FIXED: Create ENUMs using raw SQL to avoid compatibility issues
    await queryInterface.sequelize.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_sessions_status') THEN
          CREATE TYPE enum_sessions_status AS ENUM(
            'active', 'expired', 'revoked'
          );
        END IF;
      END $$;
    `);

    await queryInterface.createTable('sessions', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false
      },
      userId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
        comment: 'Reference to the user'
      },
      token: {
        type: Sequelize.TEXT,
        allowNull: false,
        unique: true,
        comment: 'JWT token or session identifier'
      },
      refreshToken: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Refresh token for extending session'
      },
      ipAddress: {
        type: Sequelize.INET,
        allowNull: true,
        comment: 'IP address of the session'
      },
      userAgent: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'User agent string'
      },
      deviceInfo: {
        type: Sequelize.JSONB,
        allowNull: true,
        defaultValue: {},
        comment: 'Device information and fingerprinting'
      },
      status: {
        type: 'enum_sessions_status',
        allowNull: false,
        defaultValue: 'active',
        comment: 'Session status'
      },
      expiresAt: {
        type: Sequelize.DATE,
        allowNull: false,
        comment: 'When the session expires'
      },
      lastActivityAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
        comment: 'Last activity timestamp'
      },
      revokedAt: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'When the session was revoked'
      },
      revokedBy: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
        comment: 'User who revoked the session'
      },
      revokedReason: {
        type: Sequelize.STRING(255),
        allowNull: true,
        comment: 'Reason for session revocation'
      },
      metadata: {
        type: Sequelize.JSONB,
        allowNull: true,
        defaultValue: {},
        comment: 'Additional session metadata'
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

    // Add indexes for performance and security
    await queryInterface.addIndex('sessions', ['token'], {
      unique: true,
      name: 'sessions_token_unique'
    });
    
    await queryInterface.addIndex('sessions', ['userId'], {
      name: 'sessions_user_id_idx'
    });
    
    await queryInterface.addIndex('sessions', ['status'], {
      name: 'sessions_status_idx'
    });
    
    await queryInterface.addIndex('sessions', ['expiresAt'], {
      name: 'sessions_expires_at_idx'
    });

    await queryInterface.addIndex('sessions', ['lastActivityAt'], {
      name: 'sessions_last_activity_idx'
    });

    await queryInterface.addIndex('sessions', ['ipAddress'], {
      name: 'sessions_ip_address_idx'
    });

    // Composite indexes for common queries
    await queryInterface.addIndex('sessions', ['userId', 'status'], {
      name: 'sessions_user_status_idx'
    });

    await queryInterface.addIndex('sessions', ['status', 'expiresAt'], {
      name: 'sessions_status_expires_idx'
    });

    // Partial index for active sessions only (more efficient)
    await queryInterface.addIndex('sessions', ['userId', 'expiresAt'], {
      where: {
        status: 'active'
      },
      name: 'sessions_active_user_expires_idx'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('sessions');
    
    // 🔧 FIXED: Drop ENUMs using raw SQL
    await queryInterface.sequelize.query(`
      DROP TYPE IF EXISTS enum_sessions_status;
    `);
  }
};
