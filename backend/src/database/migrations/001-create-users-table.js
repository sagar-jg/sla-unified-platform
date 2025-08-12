'use strict';

/**
 * Create Users Table - Fresh Start
 * 
 * This migration creates the users table that perfectly matches the User.js model
 */

module.exports = {
  up: async (queryInterface, Sequelize) => {
    console.log('🚀 Creating users table (matches User.js model exactly)...');
    
    // Create users table with exact schema from User.js model
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

    // Add indexes exactly as defined in User.js model
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

    console.log('✅ Users table created successfully');
    console.log('📋 Schema perfectly matches User.js model:');
    console.log('   • name (STRING) → model.name');
    console.log('   • is_active (BOOLEAN) → model.isActive');
    console.log('   • email_verified (BOOLEAN) → model.emailVerified');
    console.log('   • two_factor_enabled (BOOLEAN) → model.twoFactorEnabled');
    console.log('   • preferences (JSONB) → model.preferences');
    console.log('   • metadata (JSONB) → model.metadata');
    console.log('   • created_at/updated_at → model timestamps');
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('users');
    console.log('❌ Users table dropped');
  }
};