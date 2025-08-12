'use strict';

/**
 * Create Sessions Table - Fresh Start
 * 
 * This migration creates the sessions table for JWT session management
 */

module.exports = {
  up: async (queryInterface, Sequelize) => {
    console.log('🚀 Creating sessions table for JWT session management...');
    
    await queryInterface.createTable('sessions', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
      },
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
        comment: 'Reference to user'
      },
      token_id: {
        type: Sequelize.STRING(255),
        allowNull: false,
        unique: true,
        comment: 'Unique token identifier'
      },
      ip_address: {
        type: Sequelize.INET,
        allowNull: true,
        comment: 'IP address of session'
      },
      user_agent: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'User agent string'
      },
      expires_at: {
        type: Sequelize.DATE,
        allowNull: false,
        comment: 'Session expiration time'
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
        allowNull: false,
        comment: 'Whether session is active'
      },
      metadata: {
        type: Sequelize.JSONB,
        defaultValue: {},
        allowNull: true,
        comment: 'Additional session metadata'
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

    // Add indexes for performance
    await queryInterface.addIndex('sessions', ['user_id'], {
      name: 'sessions_user_id_index'
    });

    await queryInterface.addIndex('sessions', ['token_id'], {
      unique: true,
      name: 'sessions_token_id_unique'
    });

    await queryInterface.addIndex('sessions', ['expires_at'], {
      name: 'sessions_expires_at_index'
    });

    await queryInterface.addIndex('sessions', ['is_active'], {
      name: 'sessions_is_active_index'
    });

    console.log('✅ Sessions table created successfully');
    console.log('📋 Session management ready for JWT authentication');
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('sessions');
    console.log('❌ Sessions table dropped');
  }
};