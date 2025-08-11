/**
 * User Model - VERIFIED CLEAN VERSION
 * 
 * Single 'name' field, perfectly aligned with migration and seeder
 */

const { DataTypes, Model } = require('sequelize');
const bcrypt = require('bcryptjs');
const Logger = require('../utils/logger');

class User extends Model {
  /**
   * Initialize the User model
   */
  static init(sequelize) {
    return super.init({
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
      },
      
      name: {
        type: DataTypes.STRING(200),
        allowNull: false,
        comment: 'User full name'
      },
      
      email: {
        type: DataTypes.STRING(255),
        unique: true,
        allowNull: false,
        validate: {
          isEmail: true
        },
        comment: 'User email address (unique)'
      },
      
      password: {
        type: DataTypes.STRING(255),
        allowNull: false,
        comment: 'Hashed password'
      },
      
      role: {
        type: DataTypes.ENUM('admin', 'operator', 'viewer'),
        allowNull: false,
        defaultValue: 'viewer',
        comment: 'User role for authorization'
      },
      
      isActive: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        field: 'is_active',
        comment: 'Whether user account is active'
      },
      
      emailVerified: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        field: 'email_verified',
        comment: 'Whether email is verified'
      },
      
      emailVerifiedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'email_verified_at',
        comment: 'Email verification timestamp'
      },
      
      lastLoginAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'last_login_at',
        comment: 'Last login timestamp'
      },
      
      lastLoginIp: {
        type: DataTypes.INET,
        allowNull: true,
        field: 'last_login_ip',
        comment: 'Last login IP address'
      },
      
      passwordResetToken: {
        type: DataTypes.STRING(255),
        allowNull: true,
        field: 'password_reset_token',
        comment: 'Password reset token'
      },
      
      passwordResetExpires: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'password_reset_expires',
        comment: 'Password reset token expiry'
      },
      
      twoFactorEnabled: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        field: 'two_factor_enabled',
        comment: 'Whether 2FA is enabled'
      },
      
      twoFactorSecret: {
        type: DataTypes.STRING(255),
        allowNull: true,
        field: 'two_factor_secret',
        comment: 'Encrypted 2FA secret'
      },
      
      preferences: {
        type: DataTypes.JSONB,
        defaultValue: {},
        comment: 'User preferences and settings'
      },
      
      metadata: {
        type: DataTypes.JSONB,
        defaultValue: {},
        comment: 'Additional user metadata'
      }
    }, {
      sequelize,
      modelName: 'User',
      tableName: 'users',
      timestamps: true,
      
      // ✅ Explicit field mapping for timestamps
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      
      // ✅ Use underscored naming
      underscored: true,
      
      indexes: [
        {
          unique: true,
          fields: ['email']
        },
        {
          fields: ['role']
        },
        {
          fields: ['is_active']
        },
        {
          fields: ['email_verified']
        }
      ],
      
      // Add hooks for password hashing
      hooks: {
        beforeCreate: async (user) => {
          if (user.password) {
            user.password = await bcrypt.hash(user.password, 12);
          }
        },
        
        beforeUpdate: async (user) => {
          if (user.changed('password')) {
            user.password = await bcrypt.hash(user.password, 12);
          }
        }
      }
    });
  }
  
  /**
   * Validate password
   */
  async validatePassword(password) {
    try {
      return await bcrypt.compare(password, this.password);
    } catch (error) {
      Logger.error('Failed to validate password', {
        userId: this.id,
        error: error.message
      });
      return false;
    }
  }
  
  /**
   * Update last login
   */
  async updateLastLogin(ipAddress = null) {
    try {
      this.lastLoginAt = new Date();
      
      if (ipAddress) {
        this.lastLoginIp = ipAddress;
      }
      
      await this.save();
      
      Logger.info('User login updated', {
        userId: this.id,
        email: this.email,
        ipAddress
      });
      
      return true;
    } catch (error) {
      Logger.error('Failed to update last login', {
        userId: this.id,
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }
  
  /**
   * Verify email
   */
  async verifyEmail() {
    try {
      this.emailVerified = true;
      this.emailVerifiedAt = new Date();
      
      await this.save();
      
      Logger.info('User email verified', {
        userId: this.id,
        email: this.email
      });
      
      return true;
    } catch (error) {
      Logger.error('Failed to verify email', {
        userId: this.id,
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }
  
  /**
   * Get full name (for backward compatibility)
   */
  getFullName() {
    return this.name || '';
  }
  
  /**
   * Get first name from full name (computed property for backward compatibility)
   */
  get firstName() {
    return this.name ? this.name.split(' ')[0] : '';
  }
  
  /**
   * Get last name from full name (computed property for backward compatibility)
   */
  get lastName() {
    const names = this.name ? this.name.split(' ') : [];
    return names.length > 1 ? names.slice(1).join(' ') : '';
  }
  
  /**
   * Check if password reset token is valid
   */
  isPasswordResetTokenValid() {
    if (!this.passwordResetToken || !this.passwordResetExpires) {
      return false;
    }
    
    return new Date() < new Date(this.passwordResetExpires);
  }
  
  /**
   * Serialize for API response (exclude sensitive data)
   */
  toJSON() {
    const values = { ...this.dataValues };
    
    // Remove sensitive data
    delete values.password;
    delete values.passwordResetToken;
    delete values.twoFactorSecret;
    
    // Add computed fields for backward compatibility
    values.firstName = this.firstName;
    values.lastName = this.lastName;
    values.fullName = this.getFullName();
    
    return values;
  }
}

module.exports = User;