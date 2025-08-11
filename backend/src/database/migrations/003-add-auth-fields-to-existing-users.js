/**
 * Add Authentication Fields to Existing Users Table
 * 
 * This migration adds auth fields to your existing users table with 'name' field
 */

'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      // Check if table exists
      const tableExists = await queryInterface.showAllTables();
      if (!tableExists.includes('users')) {
        console.log('Users table does not exist, skipping migration...');
        await transaction.rollback();
        return;
      }

      // Get current table description
      const tableDescription = await queryInterface.describeTable('users');
      
      // Add missing authentication fields if they don't exist
      const fieldsToAdd = [
        {
          column: 'password',
          definition: {
            type: Sequelize.STRING(255),
            allowNull: true, // Allow null initially, we'll update this
          }
        },
        {
          column: 'role',
          definition: {
            type: Sequelize.ENUM('admin', 'operator', 'viewer'),
            allowNull: false,
            defaultValue: 'viewer'
          }
        },
        {
          column: 'is_active',
          definition: {
            type: Sequelize.BOOLEAN,
            defaultValue: true,
            allowNull: false
          }
        },
        {
          column: 'email_verified',
          definition: {
            type: Sequelize.BOOLEAN,
            defaultValue: false,
            allowNull: false
          }
        },
        {
          column: 'email_verified_at',
          definition: {
            type: Sequelize.DATE,
            allowNull: true
          }
        },
        {
          column: 'last_login_at',
          definition: {
            type: Sequelize.DATE,
            allowNull: true
          }
        },
        {
          column: 'last_login_ip',
          definition: {
            type: Sequelize.INET,
            allowNull: true
          }
        },
        {
          column: 'password_reset_token',
          definition: {
            type: Sequelize.STRING(255),
            allowNull: true
          }
        },
        {
          column: 'password_reset_expires',
          definition: {
            type: Sequelize.DATE,
            allowNull: true
          }
        },
        {
          column: 'two_factor_enabled',
          definition: {
            type: Sequelize.BOOLEAN,
            defaultValue: false,
            allowNull: false
          }
        },
        {
          column: 'two_factor_secret',
          definition: {
            type: Sequelize.STRING(255),
            allowNull: true
          }
        },
        {
          column: 'preferences',
          definition: {
            type: Sequelize.JSONB,
            defaultValue: {},
            allowNull: true
          }
        },
        {
          column: 'metadata',
          definition: {
            type: Sequelize.JSONB,
            defaultValue: {},
            allowNull: true
          }
        }
      ];

      // Add fields that don't exist
      for (const field of fieldsToAdd) {
        if (!tableDescription[field.column]) {
          console.log(`Adding column: ${field.column}`);
          await queryInterface.addColumn('users', field.column, field.definition, { transaction });
        } else {
          console.log(`Column ${field.column} already exists, skipping...`);
        }
      }

      // Ensure timestamps exist
      if (!tableDescription.created_at) {
        await queryInterface.addColumn('users', 'created_at', {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW
        }, { transaction });
      }
      
      if (!tableDescription.updated_at) {
        await queryInterface.addColumn('users', 'updated_at', {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW
        }, { transaction });
      }

      // Make sure email is properly set up
      if (tableDescription.email && !tableDescription.email.unique) {
        console.log('Adding unique constraint to email...');
        await queryInterface.addIndex('users', ['email'], {
          unique: true,
          name: 'users_email_unique',
          transaction
        });
      }

      // Add other useful indexes
      const indexesToAdd = [
        { fields: ['role'], name: 'users_role_index' },
        { fields: ['is_active'], name: 'users_is_active_index' },
        { fields: ['email_verified'], name: 'users_email_verified_index' }
      ];

      for (const index of indexesToAdd) {
        try {
          await queryInterface.addIndex('users', index.fields, {
            name: index.name,
            transaction
          });
        } catch (error) {
          console.log(`Index ${index.name} might already exist, skipping...`);
        }
      }

      await transaction.commit();
      console.log('✅ Authentication fields added to users table successfully!');
      
    } catch (error) {
      await transaction.rollback();
      console.error('❌ Migration failed:', error.message);
      throw error;
    }
  },

  down: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      // Remove added authentication columns
      const columnsToRemove = [
        'password', 'role', 'is_active', 'email_verified', 'email_verified_at',
        'last_login_at', 'last_login_ip', 'password_reset_token', 'password_reset_expires',
        'two_factor_enabled', 'two_factor_secret', 'preferences', 'metadata'
      ];

      for (const column of columnsToRemove) {
        try {
          await queryInterface.removeColumn('users', column, { transaction });
        } catch (error) {
          console.log(`Column ${column} might not exist, skipping...`);
        }
      }

      await transaction.commit();
      console.log('✅ Authentication fields removed from users table');
      
    } catch (error) {
      await transaction.rollback();
      console.error('❌ Rollback failed:', error.message);
      throw error;
    }
  }
};