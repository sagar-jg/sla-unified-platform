'use strict';

/**
 * EMERGENCY SAFE SEEDER - Works with ANY table structure
 * 
 * This seeder detects your current table structure and only uses columns that exist
 */

const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    try {
      // Check if any admin users already exist
      const existingAdmins = await queryInterface.sequelize.query(
        "SELECT id FROM users WHERE role = 'admin' LIMIT 1",
        { type: Sequelize.QueryTypes.SELECT }
      );

      if (existingAdmins.length > 0) {
        console.log('✅ Admin user already exists, skipping seeder...');
        return;
      }

      // Get actual table structure
      console.log('🔍 Detecting current users table structure...');
      const tableInfo = await queryInterface.describeTable('users');
      const columns = Object.keys(tableInfo);
      console.log('📋 Available columns:', columns.join(', '));

      const hashedPassword = await bcrypt.hash('admin123!', 12);
      const now = new Date();

      // Start with minimal required fields that should exist
      const adminUser = {
        id: uuidv4(),
        email: 'admin@sla-platform.com',
        password: hashedPassword,
        role: 'admin'
      };

      const operatorUser = {
        id: uuidv4(),
        email: 'operator@sla-platform.com', 
        password: hashedPassword,
        role: 'operator'
      };

      // Add timestamps if they exist
      if (columns.includes('created_at') || columns.includes('createdAt')) {
        const timestampField = columns.includes('created_at') ? 'created_at' : 'createdAt';
        adminUser[timestampField] = now;
        operatorUser[timestampField] = now;
      }

      if (columns.includes('updated_at') || columns.includes('updatedAt')) {
        const timestampField = columns.includes('updated_at') ? 'updated_at' : 'updatedAt';
        adminUser[timestampField] = now;
        operatorUser[timestampField] = now;
      }

      // Add name field variations
      if (columns.includes('name')) {
        adminUser.name = 'System Administrator';
        operatorUser.name = 'Operator User';
      } else if (columns.includes('firstName') && columns.includes('lastName')) {
        adminUser.firstName = 'System';
        adminUser.lastName = 'Administrator';
        operatorUser.firstName = 'Operator';
        operatorUser.lastName = 'User';
      } else if (columns.includes('first_name') && columns.includes('last_name')) {
        adminUser.first_name = 'System';
        adminUser.last_name = 'Administrator';
        operatorUser.first_name = 'Operator';
        operatorUser.last_name = 'User';
      }

      // Add status/active field variations
      if (columns.includes('is_active')) {
        adminUser.is_active = true;
        operatorUser.is_active = true;
      } else if (columns.includes('isActive')) {
        adminUser.isActive = true;
        operatorUser.isActive = true;
      } else if (columns.includes('status')) {
        adminUser.status = 'active';
        operatorUser.status = 'active';
      }

      // Add email verification fields if they exist
      if (columns.includes('email_verified')) {
        adminUser.email_verified = true;
        operatorUser.email_verified = true;
      }
      if (columns.includes('emailVerified')) {
        adminUser.emailVerified = true;
        operatorUser.emailVerified = true;
      }
      if (columns.includes('email_verified_at')) {
        adminUser.email_verified_at = now;
        operatorUser.email_verified_at = now;
      }

      // Add other optional fields if they exist
      const optionalFields = [
        'last_login_at', 'lastLoginAt', 'last_login_ip', 'lastLoginIp',
        'password_reset_token', 'passwordResetToken', 'password_reset_expires', 'passwordResetExpires',
        'two_factor_enabled', 'twoFactorEnabled', 'two_factor_secret', 'twoFactorSecret'
      ];

      optionalFields.forEach(field => {
        if (columns.includes(field)) {
          adminUser[field] = null;
          operatorUser[field] = null;
        }
      });

      // Set two factor to false if the field exists
      if (columns.includes('two_factor_enabled')) {
        adminUser.two_factor_enabled = false;
        operatorUser.two_factor_enabled = false;
      }
      if (columns.includes('twoFactorEnabled')) {
        adminUser.twoFactorEnabled = false;
        operatorUser.twoFactorEnabled = false;
      }

      // Add JSON fields if they exist
      if (columns.includes('metadata')) {
        adminUser.metadata = JSON.stringify({
          description: 'Default admin user for SLA Digital Unified Platform',
          created_by: 'system',
          permissions: ['operator_management', 'system_admin', 'analytics_access']
        });
        operatorUser.metadata = JSON.stringify({
          description: 'Demo operator user with subscription management access',
          created_by: 'admin',
          permissions: ['subscription_management', 'billing_operations']
        });
      }

      if (columns.includes('preferences')) {
        adminUser.preferences = JSON.stringify({
          theme: 'dark',
          language: 'en'
        });
        operatorUser.preferences = JSON.stringify({
          theme: 'light',
          language: 'en'
        });
      }

      const users = [adminUser, operatorUser];
      
      console.log('👤 Creating users with detected schema...');
      console.log('📝 Admin user fields:', Object.keys(adminUser));
      
      await queryInterface.bulkInsert('users', users);

      console.log('');
      console.log('🎉 ===== DEMO USERS CREATED SUCCESSFULLY =====');
      console.log('👤 Admin User:');
      console.log('   📧 Email: admin@sla-platform.com');
      console.log('   🔐 Password: admin123!');
      console.log('   👑 Role: admin');
      console.log('');
      console.log('👤 Operator User:');
      console.log('   📧 Email: operator@sla-platform.com');
      console.log('   🔐 Password: admin123!');
      console.log('   🔧 Role: operator');
      console.log('');
      console.log('✅ Users created with adaptive schema approach');
      console.log('🚀 Ready to use authentication system!');
      console.log('');

    } catch (error) {
      console.error('❌ Error creating users:', error.message);
      throw error;
    }
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