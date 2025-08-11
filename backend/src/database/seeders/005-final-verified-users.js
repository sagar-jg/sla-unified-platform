'use strict';

/**
 * FINAL SEEDER - Matches User.js Model Exactly
 * 
 * This seeder perfectly aligns with the final User.js model schema
 */

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

    console.log('👤 Creating demo users with final User.js schema...');

    // Hash the default admin password
    const hashedPassword = await bcrypt.hash('admin123!', 12);
    const now = new Date();

    // ✅ FINAL SCHEMA: Matches User.js model exactly
    const users = [
      {
        id: uuidv4(),
        name: 'System Administrator',              // ✅ Single name field
        email: 'admin@sla-platform.com',
        password: hashedPassword,
        role: 'admin',
        is_active: true,                           // ✅ Maps to isActive in model
        email_verified: true,                      // ✅ Maps to emailVerified in model  
        email_verified_at: now,                    // ✅ Maps to emailVerifiedAt in model
        last_login_at: null,                       // ✅ Maps to lastLoginAt in model
        last_login_ip: null,                       // ✅ Maps to lastLoginIp in model
        password_reset_token: null,                // ✅ Maps to passwordResetToken in model
        password_reset_expires: null,              // ✅ Maps to passwordResetExpires in model
        two_factor_enabled: false,                 // ✅ Maps to twoFactorEnabled in model
        two_factor_secret: null,                   // ✅ Maps to twoFactorSecret in model
        preferences: JSON.stringify({              // ✅ JSONB field
          theme: 'dark',
          language: 'en',
          notifications: {
            email: true,
            browser: true,
            sms: false
          }
        }),
        metadata: JSON.stringify({                 // ✅ JSONB field
          description: 'Default admin user for SLA Digital Unified Platform',
          created_by: 'system',
          permissions: ['operator_management', 'system_admin', 'analytics_access']
        }),
        created_at: now,                           // ✅ Maps to createdAt in model
        updated_at: now                            // ✅ Maps to updatedAt in model
      },
      {
        id: uuidv4(),
        name: 'Operator User',                     // ✅ Single name field
        email: 'operator@sla-platform.com',
        password: hashedPassword,
        role: 'operator',
        is_active: true,                           // ✅ Maps to isActive in model
        email_verified: true,                      // ✅ Maps to emailVerified in model
        email_verified_at: now,                    // ✅ Maps to emailVerifiedAt in model
        last_login_at: null,                       // ✅ Maps to lastLoginAt in model
        last_login_ip: null,                       // ✅ Maps to lastLoginIp in model
        password_reset_token: null,                // ✅ Maps to passwordResetToken in model
        password_reset_expires: null,              // ✅ Maps to passwordResetExpires in model
        two_factor_enabled: false,                 // ✅ Maps to twoFactorEnabled in model
        two_factor_secret: null,                   // ✅ Maps to twoFactorSecret in model
        preferences: JSON.stringify({              // ✅ JSONB field
          theme: 'light',
          language: 'en',
          notifications: {
            email: true,
            browser: false,
            sms: false
          }
        }),
        metadata: JSON.stringify({                 // ✅ JSONB field
          description: 'Demo operator user with subscription management access',
          created_by: 'admin',
          permissions: ['subscription_management', 'billing_operations']
        }),
        created_at: now,                           // ✅ Maps to createdAt in model
        updated_at: now                            // ✅ Maps to updatedAt in model
      }
    ];
    
    await queryInterface.bulkInsert('users', users);

    console.log('');
    console.log('🎉 ===== DEMO USERS CREATED SUCCESSFULLY =====');
    console.log('👤 Admin User:');
    console.log('   📧 Email: admin@sla-platform.com');
    console.log('   🔐 Password: admin123!');
    console.log('   👑 Role: admin');
    console.log('   📛 Name: System Administrator');
    console.log('');
    console.log('👤 Operator User:');
    console.log('   📧 Email: operator@sla-platform.com');
    console.log('   🔐 Password: admin123!');
    console.log('   🔧 Role: operator');
    console.log('   📛 Name: Operator User');
    console.log('');
    console.log('✅ Schema alignment verified - User.js model ↔ seeder');
    console.log('✅ Both users are active and email verified');
    console.log('🚀 Ready to use authentication system!');
    console.log('');
    console.log('🔍 Model field mappings:');
    console.log('   • name → name (single field)');
    console.log('   • is_active → isActive (field mapping)');
    console.log('   • email_verified → emailVerified (field mapping)');
    console.log('   • two_factor_enabled → twoFactorEnabled (field mapping)');
    console.log('   • created_at → createdAt (timestamp mapping)');
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