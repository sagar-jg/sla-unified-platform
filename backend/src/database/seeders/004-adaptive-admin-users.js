'use strict';

const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Check if any admin users already exist
    const existingAdmins = await queryInterface.sequelize.query(
      "SELECT id FROM users WHERE role = 'admin' LIMIT 1",
      { type: Sequelize.QueryTypes.SELECT }
    );

    if (existingAdmins.length > 0) {
      console.log('✅ Admin user already exists, skipping seeder...');
      return;
    }

    // Get current table structure to see what columns exist
    console.log('🔍 Detecting current users table structure...');
    const tableInfo = await queryInterface.describeTable('users');
    const columns = Object.keys(tableInfo);
    console.log('📋 Available columns:', columns);

    const hashedPassword = await bcrypt.hash('admin123!', 12);
    const now = new Date();

    // Base user data that should work with any schema
    const baseUserData = {
      id: uuidv4(),
      email: 'admin@sla-platform.com',
      password: hashedPassword,
      role: 'admin',
      created_at: now,
      updated_at: now
    };

    const baseOperatorData = {
      id: uuidv4(),
      email: 'operator@sla-platform.com',
      password: hashedPassword,
      role: 'operator',
      created_at: now,
      updated_at: now
    };

    // Add fields based on what exists in the table
    if (columns.includes('name')) {
      baseUserData.name = 'System Administrator';
      baseOperatorData.name = 'Operator User';
    } else {
      // Fallback to firstName/lastName if name doesn't exist
      if (columns.includes('firstName') || columns.includes('first_name')) {
        baseUserData.firstName = 'System';
        baseUserData.lastName = 'Administrator';
        baseOperatorData.firstName = 'Operator';
        baseOperatorData.lastName = 'User';
      }
    }

    // Add optional fields if they exist
    if (columns.includes('is_active')) {
      baseUserData.is_active = true;
      baseOperatorData.is_active = true;
    }

    if (columns.includes('status')) {
      baseUserData.status = 'active';
      baseOperatorData.status = 'active';
    }

    if (columns.includes('email_verified')) {
      baseUserData.email_verified = true;
      baseOperatorData.email_verified = true;
    }

    if (columns.includes('email_verified_at')) {
      baseUserData.email_verified_at = now;
      baseOperatorData.email_verified_at = now;
    }

    if (columns.includes('last_login_at')) {
      baseUserData.last_login_at = null;
      baseOperatorData.last_login_at = null;
    }

    if (columns.includes('last_login_ip')) {
      baseUserData.last_login_ip = null;
      baseOperatorData.last_login_ip = null;
    }

    if (columns.includes('password_reset_token')) {
      baseUserData.password_reset_token = null;
      baseOperatorData.password_reset_token = null;
    }

    if (columns.includes('password_reset_expires')) {
      baseUserData.password_reset_expires = null;
      baseOperatorData.password_reset_expires = null;
    }

    if (columns.includes('two_factor_enabled')) {
      baseUserData.two_factor_enabled = false;
      baseOperatorData.two_factor_enabled = false;
    }

    if (columns.includes('two_factor_secret')) {
      baseUserData.two_factor_secret = null;
      baseOperatorData.two_factor_secret = null;
    }

    if (columns.includes('preferences')) {
      baseUserData.preferences = JSON.stringify({
        theme: 'dark',
        language: 'en',
        notifications: {
          email: true,
          browser: true,
          sms: false
        }
      });
      baseOperatorData.preferences = JSON.stringify({
        theme: 'light',
        language: 'en',
        notifications: {
          email: true,
          browser: false,
          sms: false
        }
      });
    }

    if (columns.includes('metadata')) {
      baseUserData.metadata = JSON.stringify({
        description: 'Default admin user for SLA Digital Unified Platform',
        created_by: 'system',
        permissions: ['operator_management', 'system_admin', 'analytics_access']
      });
      baseOperatorData.metadata = JSON.stringify({
        description: 'Demo operator user with subscription management access',
        created_by: 'admin',
        permissions: ['subscription_management', 'billing_operations']
      });
    }

    const users = [baseUserData, baseOperatorData];
    
    console.log('👤 Creating users with detected schema...');
    console.log('📝 Admin user fields:', Object.keys(baseUserData));
    
    await queryInterface.bulkInsert('users', users);

    console.log('');
    console.log('🎉 ===== DEMO USERS CREATED SUCCESSFULLY =====');
    console.log('👤 Admin User:');
    console.log('   📧 Email: admin@sla-platform.com');
    console.log('   🔐 Password: admin123!');
    console.log('   👑 Role: admin');
    console.log('   📛 Name:', baseUserData.name || `${baseUserData.firstName || 'System'} ${baseUserData.lastName || 'Administrator'}`);
    console.log('');
    console.log('👤 Operator User:');
    console.log('   📧 Email: operator@sla-platform.com');
    console.log('   🔐 Password: admin123!');
    console.log('   🔧 Role: operator');
    console.log('   📛 Name:', baseOperatorData.name || `${baseOperatorData.firstName || 'Operator'} ${baseOperatorData.lastName || 'User'}`);
    console.log('');
    console.log('✅ Users created with schema-adaptive approach');
    console.log('🚀 Ready to use authentication system!');
    console.log('');
  },
  
  down: async (queryInterface, Sequelize) => {
    await queryInterface.bulkDelete('users', {
      email: {
        [Sequelize.Op.in]: ['admin@sla-platform.com', 'operator@sla-platform.com']
      }
    });
    
    console.log('❌ Demo users removed');
  }
};