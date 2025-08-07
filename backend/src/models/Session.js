/**
 * Session Model
 * 
 * Represents user authentication sessions with JWT tracking
 */

const { DataTypes, Model } = require('sequelize');
const Logger = require('../utils/logger');

class Session extends Model {
  /**
   * Initialize the Session model
   */
  static init(sequelize) {
    return super.init({
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
      },
      
      userId: {
        type: DataTypes.UUID,
        allowNull: false,
        field: 'user_id',
        references: {
          model: 'users',
          key: 'id'
        },
        comment: 'Reference to the user'
      },
      
      token: {
        type: DataTypes.TEXT,
        allowNull: false,
        comment: 'JWT token'
      },
      
      ipAddress: {
        type: DataTypes.INET,
        allowNull: true,
        field: 'ip_address',
        comment: 'IP address of the session'
      },
      
      userAgent: {
        type: DataTypes.TEXT,
        allowNull: true,
        field: 'user_agent',
        comment: 'User agent string'
      },
      
      isActive: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        field: 'is_active',
        comment: 'Whether session is active'
      },
      
      expiresAt: {
        type: DataTypes.DATE,
        allowNull: false,
        field: 'expires_at',
        comment: 'Session expiry timestamp'
      },
      
      lastUsedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'last_used_at',
        comment: 'Last time session was used'
      },
      
      metadata: {
        type: DataTypes.JSONB,
        defaultValue: {},
        comment: 'Additional session metadata'
      }
    }, {
      sequelize,
      modelName: 'Session',
      tableName: 'sessions',
      timestamps: true,
      
      // ✅ FIX: Explicit field mapping for timestamps
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      
      // ✅ FIX: Use underscored naming
      underscored: true,
      
      indexes: [
        {
          fields: ['user_id']
        },
        {
          fields: ['token']
        },
        {
          fields: ['expires_at']
        },
        {
          fields: ['is_active']
        }
      ]
    });
  }
  
  /**
   * Update last used timestamp
   */
  async updateLastUsed() {
    try {
      this.lastUsedAt = new Date();
      await this.save();
      
      return true;
    } catch (error) {
      Logger.error('Failed to update session last used', {
        sessionId: this.id,
        error: error.message
      });
      throw error;
    }
  }
  
  /**
   * Invalidate session
   */
  async invalidate() {
    try {
      this.isActive = false;
      await this.save();
      
      Logger.info('Session invalidated', {
        sessionId: this.id,
        userId: this.userId
      });
      
      return true;
    } catch (error) {
      Logger.error('Failed to invalidate session', {
        sessionId: this.id,
        error: error.message
      });
      throw error;
    }
  }
  
  /**
   * Check if session is expired
   */
  isExpired() {
    return new Date() > new Date(this.expiresAt);
  }
  
  /**
   * Check if session is valid
   */
  isValid() {
    return this.isActive && !this.isExpired();
  }
}

module.exports = Session;
