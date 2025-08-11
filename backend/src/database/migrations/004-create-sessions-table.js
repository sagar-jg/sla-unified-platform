/**
 * Create Sessions Table Migration
 * 
 * Creates the sessions table needed for JWT session management
 */

'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      // Check if sessions table already exists
      const tableExists = await queryInterface.showAllTables();
      if (tableExists.includes('sessions')) {
        console.log('Sessions table already exists, skipping creation...');
        await transaction.rollback();
        return;
      }

      // Create sessions table
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
          onDelete: 'CASCADE'
        },
        token: {
          type: Sequelize.TEXT,
          allowNull: false,
          unique: true
        },
        expires_at: {
          type: Sequelize.DATE,
          allowNull: false
        },
        ip_address: {
          type: Sequelize.INET,
          allowNull: true
        },
        user_agent: {
          type: Sequelize.TEXT,
          allowNull: true
        },
        remember_me: {
          type: Sequelize.BOOLEAN,
          defaultValue: false
        },
        active: {
          type: Sequelize.BOOLEAN,
          defaultValue: true
        },
        revoked_at: {
          type: Sequelize.DATE,
          allowNull: true
        },
        last_activity: {
          type: Sequelize.DATE,
          allowNull: true
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
      }, { transaction });

      // Add indexes for performance
      await queryInterface.addIndex('sessions', ['user_id'], {
        name: 'sessions_user_id_index',
        transaction
      });

      await queryInterface.addIndex('sessions', ['token'], {
        unique: true,
        name: 'sessions_token_unique',
        transaction
      });

      await queryInterface.addIndex('sessions', ['active'], {
        name: 'sessions_active_index',
        transaction
      });

      await queryInterface.addIndex('sessions', ['expires_at'], {
        name: 'sessions_expires_at_index',
        transaction
      });

      await queryInterface.addIndex('sessions', ['user_id', 'active'], {
        name: 'sessions_user_active_index',
        transaction
      });

      await transaction.commit();
      console.log('✅ Sessions table created successfully with indexes!');
      
    } catch (error) {
      await transaction.rollback();
      console.error('❌ Sessions table creation failed:', error.message);
      throw error;
    }
  },

  down: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      // Remove indexes first
      const indexesToRemove = [
        'sessions_user_active_index',
        'sessions_expires_at_index', 
        'sessions_active_index',
        'sessions_token_unique',
        'sessions_user_id_index'
      ];

      for (const indexName of indexesToRemove) {
        try {
          await queryInterface.removeIndex('sessions', indexName, { transaction });
        } catch (error) {
          console.log(`Index ${indexName} might not exist, skipping...`);
        }
      }

      // Drop table
      await queryInterface.dropTable('sessions', { transaction });

      await transaction.commit();
      console.log('✅ Sessions table dropped successfully');
      
    } catch (error) {
      await transaction.rollback();
      console.error('❌ Sessions table removal failed:', error.message);
      throw error;
    }
  }
};