'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // 🔧 FIXED: Create ENUMs using raw SQL to avoid compatibility issues
    await queryInterface.sequelize.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_users_role') THEN
          CREATE TYPE enum_users_role AS ENUM(
            'admin', 'operator', 'viewer'
          );
        END IF;
      END $$;
    `);
    
    await queryInterface.sequelize.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_users_status') THEN
          CREATE TYPE enum_users_status AS ENUM(
            'active', 'inactive', 'suspended'
          );
        END IF;
      END $$;
    `);

    await queryInterface.createTable('users', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false
      },
      email: {
        type: Sequelize.STRING(255),
        allowNull: false,
        unique: true,
        validate: {
          isEmail: true
        },
        comment: 'User email address (unique)'
      },
      password: {
        type: Sequelize.STRING(255),
        allowNull: false,
        comment: 'Hashed password using bcryptjs'
      },
      name: {
        type: Sequelize.STRING(100),
        allowNull: false,
        comment: 'User full name'
      },
      role: {
        type: 'enum_users_role',
        allowNull: false,
        defaultValue: 'viewer',
        comment: 'User role for access control'
      },
      status: {
        type: 'enum_users_status',
        allowNull: false,
        defaultValue: 'active',
        comment: 'User account status'
      },
      lastLoginAt: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'Last successful login timestamp'
      },
      lastLoginIP: {
        type: Sequelize.INET,
        allowNull: true,
        comment: 'IP address of last login'
      },
      loginAttempts: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: 'Failed login attempts counter'
      },
      lockedUntil: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'Account locked until this timestamp'
      },
      emailVerified: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: 'Whether email address is verified'
      },
      emailVerificationToken: {
        type: Sequelize.STRING(255),
        allowNull: true,
        comment: 'Token for email verification'
      },
      passwordResetToken: {
        type: Sequelize.STRING(255),
        allowNull: true,
        comment: 'Token for password reset'
      },
      passwordResetExpires: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'Password reset token expiration'
      },
      preferences: {
        type: Sequelize.JSONB,
        allowNull: true,
        defaultValue: {},
        comment: 'User preferences and settings'
      },
      metadata: {
        type: Sequelize.JSONB,
        allowNull: true,
        defaultValue: {},
        comment: 'Additional user metadata'
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
    await queryInterface.addIndex('users', ['email'], {
      unique: true,
      name: 'users_email_unique'
    });
    
    await queryInterface.addIndex('users', ['role'], {
      name: 'users_role_idx'
    });
    
    await queryInterface.addIndex('users', ['status'], {
      name: 'users_status_idx'
    });
    
    await queryInterface.addIndex('users', ['lastLoginAt'], {
      name: 'users_last_login_idx'
    });

    await queryInterface.addIndex('users', ['emailVerificationToken'], {
      name: 'users_email_verification_token_idx'
    });

    await queryInterface.addIndex('users', ['passwordResetToken'], {
      name: 'users_password_reset_token_idx'
    });

    // Composite index for authentication queries
    await queryInterface.addIndex('users', ['email', 'status'], {
      name: 'users_email_status_idx'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('users');
    
    // 🔧 FIXED: Drop ENUMs using raw SQL
    await queryInterface.sequelize.query(`
      DROP TYPE IF EXISTS enum_users_role;
      DROP TYPE IF EXISTS enum_users_status;
    `);
  }
};
