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

    // Hash the default admin password
    const hashedPassword = await bcrypt.hash('admin123!', 12);
    const now = new Date();

    // ✅ FIXED: Using 'name' field instead of first_name/last_name
    await queryInterface.bulkInsert('users', [
      {
        id: uuidv4(),
        name: 'System Administrator',    // ✅ FIXED: Single name field
        email: 'admin@sla-platform.com',
        password: hashedPassword,
        role: 'admin',
        is_active: true,
        email_verified: true,
        email_verified_at: now,
        last_login_at: null,
        last_login_ip: null,
        password_reset_token: null,
        password_reset_expires: null,
        two_factor_enabled: false,
        two_factor_secret: null,
        preferences: JSON.stringify({
          theme: 'dark',
          language: 'en',
          notifications: {
            email: true,
            browser: true,
            sms: false
          }
        }),
        metadata: JSON.stringify({
          description: 'Default admin user for SLA Digital Unified Platform',
          created_by: 'system',
          permissions: ['operator_management', 'system_admin', 'analytics_access']
        }),
        created_at: now,
        updated_at: now
      },
      {
        id: uuidv4(),
        name: 'Operator User',           // ✅ FIXED: Single name field
        email: 'operator@sla-platform.com',
        password: hashedPassword,
        role: 'operator',
        is_active: true,
        email_verified: true,
        email_verified_at: now,
        last_login_at: null,
        last_login_ip: null,
        password_reset_token: null,
        password_reset_expires: null,
        two_factor_enabled: false,
        two_factor_secret: null,
        preferences: JSON.stringify({
          theme: 'light',
          language: 'en'
        }),
        metadata: JSON.stringify({
          description: 'Demo operator user with subscription management access',
          created_by: 'admin',
          permissions: ['subscription_management', 'billing_operations']
        }),
        created_at: now,
        updated_at: now
      }
    ]);

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
    console.log('✅ Both users are active and email verified');
    console.log('🚀 Ready to use authentication system!');
    console.log('');
    console.log('🔒 SECURITY REMINDER:');
    console.log('   ⚠️  Change default passwords after first login!');
    console.log('   📝 Use: POST /api/auth/change-password');
    console.log('=============================================');
    console.log('');
  },

  down: async (queryInterface, Sequelize) => {
    // Remove the seeded users
    await queryInterface.bulkDelete('users', {
      email: {
        [Sequelize.Op.in]: ['admin@sla-platform.com', 'operator@sla-platform.com']
      }
    });

    console.log('❌ Demo users removed');
  }
};