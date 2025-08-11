'use strict';

/**
 * Fix Users Table Schema
 * 
 * Ensures the users table schema matches the current seeder expectations
 * This migration addresses any schema mismatches between table and seeder
 */

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Get current table description to see what exists
    const tableInfo = await queryInterface.describeTable('users');
    
    console.log('🔍 Current users table columns:', Object.keys(tableInfo));
    
    // Drop and recreate the table with the correct schema
    await queryInterface.dropTable('users');
    console.log('🗑️  Dropped existing users table');
    
    // Create users table with complete authentication schema
    await queryInterface.createTable('users', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
      },
      name: {
        type: Sequelize.STRING(200),
        allowNull: false,
        comment: 'User full name'
      },
      email: {
        type: Sequelize.STRING(255),
        unique: true,
        allowNull: false,
        comment: 'User email address (unique)'
      },
      password: {
        type: Sequelize.STRING(255),
        allowNull: false,
        comment: 'Hashed password'
      },
      role: {
        type: Sequelize.ENUM('admin', 'operator', 'viewer'),
        allowNull: false,
        defaultValue: 'viewer',
        comment: 'User role for authorization'
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
        allowNull: false,
        comment: 'Whether user account is active'
      },
      email_verified: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        allowNull: false,
        comment: 'Whether email is verified'
      },
      email_verified_at: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'Email verification timestamp'
      },
      last_login_at: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'Last login timestamp'
      },
      last_login_ip: {
        type: Sequelize.INET,
        allowNull: true,
        comment: 'Last login IP address'
      },
      password_reset_token: {
        type: Sequelize.STRING(255),
        allowNull: true,
        comment: 'Password reset token'
      },
      password_reset_expires: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'Password reset token expiry'
      },
      two_factor_enabled: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        allowNull: false,
        comment: 'Whether 2FA is enabled'
      },
      two_factor_secret: {
        type: Sequelize.STRING(255),
        allowNull: true,
        comment: 'Encrypted 2FA secret'
      },
      preferences: {
        type: Sequelize.JSONB,
        defaultValue: {},
        allowNull: true,
        comment: 'User preferences and settings'
      },
      metadata: {
        type: Sequelize.JSONB,
        defaultValue: {},
        allowNull: true,
        comment: 'Additional user metadata'
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

    console.log('✅ Created users table with correct schema');

    // Add indexes for performance
    await queryInterface.addIndex('users', ['email'], {
      unique: true,
      name: 'users_email_unique'
    });

    await queryInterface.addIndex('users', ['role'], {
      name: 'users_role_index'
    });

    await queryInterface.addIndex('users', ['is_active'], {
      name: 'users_is_active_index'
    });

    await queryInterface.addIndex('users', ['email_verified'], {
      name: 'users_email_verified_index'
    });

    await queryInterface.addIndex('users', ['password_reset_token'], {
      name: 'users_password_reset_token_index'
    });

    console.log('✅ Added indexes to users table');
    console.log('');
    console.log('🎯 Users table schema fixed!');
    console.log('📝 Table now has single "name" field (not firstName/lastName)');
    console.log('🔧 All authentication fields are present');
    console.log('🚀 Ready for seeding!');
    console.log('');
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('users');
    console.log('❌ Users table dropped');
  }
};