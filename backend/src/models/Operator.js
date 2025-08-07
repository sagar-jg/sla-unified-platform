/**
 * Operator Model
 * 
 * Represents telecom operators (Zain, Mobily, Etisalat, etc.) with their
 * configurations, credentials, and operational status.
 */

const { DataTypes, Model } = require('sequelize');
const CryptoJS = require('crypto-js');
const Logger = require('../utils/logger');

class Operator extends Model {
  /**
   * Initialize the Operator model
   */
  static init(sequelize) {
    return super.init({
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
      },
      
      code: {
        type: DataTypes.STRING(50),
        unique: true,
        allowNull: false,
        comment: 'Unique operator code (e.g., zain-kw, mobily, etisalat-ae)'
      },
      
      name: {
        type: DataTypes.STRING(255),
        allowNull: false,
        comment: 'Display name of the operator'
      },
      
      country: {
        type: DataTypes.STRING(2),
        allowNull: false,
        comment: 'ISO country code (KW, SA, AE, etc.)'
      },
      
      enabled: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        comment: 'Whether the operator is currently enabled'
      },
      
      config: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: {},
        comment: 'Operator-specific configuration (endpoints, rules, etc.)'
      },
      
      credentials: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: {},
        comment: 'Encrypted API credentials'
      },
      
      environment: {
        type: DataTypes.ENUM('sandbox', 'production', 'preproduction'),
        defaultValue: 'sandbox',
        comment: 'Current environment for this operator'
      },
      
      priority: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        comment: 'Operator priority for routing (higher = preferred)'
      },
      
      status: {
        type: DataTypes.ENUM('active', 'inactive', 'maintenance', 'deprecated'),
        defaultValue: 'active',
        comment: 'Operational status of the operator'
      },
      
      healthScore: {
        type: DataTypes.DECIMAL(3, 2),
        defaultValue: 1.00,
        field: 'health_score',
        comment: 'Health score based on success rate (0.00 - 1.00)'
      },
      
      lastHealthCheck: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'last_health_check',
        comment: 'Timestamp of last health check'
      },
      
      metadata: {
        type: DataTypes.JSONB,
        defaultValue: {},
        comment: 'Additional operator metadata'
      },
      
      // Audit fields
      lastModifiedBy: {
        type: DataTypes.UUID,
        allowNull: true,
        field: 'last_modified_by',
        comment: 'User ID who last modified this operator'
      },
      
      lastModifiedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'last_modified_at',
        defaultValue: DataTypes.NOW
      },
      
      disableReason: {
        type: DataTypes.TEXT,
        allowNull: true,
        field: 'disable_reason',
        comment: 'Reason for disabling the operator'
      }
    }, {
      sequelize,
      modelName: 'Operator',
      tableName: 'operators',
      timestamps: true,
      paranoid: true, // Soft delete
      
      // ✅ FIX: Explicit field mapping for timestamps
      createdAt: 'created_at',
      updatedAt: 'updated_at', 
      deletedAt: 'deleted_at',
      
      // ✅ FIX: Use underscored naming
      underscored: true,
      
      indexes: [
        {
          unique: true,
          fields: ['code']
        },
        {
          fields: ['enabled']
        },
        {
          fields: ['status']
        },
        {
          fields: ['country']
        },
        {
          fields: ['environment']
        }
      ],
      
      // Add hooks for encryption
      hooks: {
        beforeSave: (instance) => {
          if (instance.changed('credentials')) {
            instance.credentials = Operator.encryptCredentials(instance.credentials);
          }
        },
        
        afterFind: (instances) => {
          if (!instances) return;
          
          const processInstance = (instance) => {
            if (instance && instance.credentials) {
              instance.credentials = Operator.decryptCredentials(instance.credentials);
            }
          };
          
          if (Array.isArray(instances)) {
            instances.forEach(processInstance);
          } else {
            processInstance(instances);
          }
        }
      }
    });
  }
  
  /**
   * Encrypt credentials
   */
  static encryptCredentials(credentials) {
    try {
      const key = process.env.ENCRYPTION_KEY;
      if (!key) {
        throw new Error('ENCRYPTION_KEY not found in environment variables');
      }
      
      const encrypted = CryptoJS.AES.encrypt(JSON.stringify(credentials), key).toString();
      return { encrypted: true, data: encrypted };
    } catch (error) {
      Logger.error('Failed to encrypt operator credentials', {
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }
  
  /**
   * Decrypt credentials
   */
  static decryptCredentials(encryptedCredentials) {
    try {
      if (!encryptedCredentials || !encryptedCredentials.encrypted) {
        return encryptedCredentials; // Already decrypted or not encrypted
      }
      
      const key = process.env.ENCRYPTION_KEY;
      if (!key) {
        throw new Error('ENCRYPTION_KEY not found in environment variables');
      }
      
      const decrypted = CryptoJS.AES.decrypt(encryptedCredentials.data, key);
      return JSON.parse(decrypted.toString(CryptoJS.enc.Utf8));
    } catch (error) {
      Logger.error('Failed to decrypt operator credentials', {
        error: error.message,
        stack: error.stack
      });
      // Return empty object if decryption fails
      return {};
    }
  }
  
  /**
   * Enable operator
   */
  async enable(userId, reason = null) {
    try {
      this.enabled = true;
      this.lastModifiedBy = userId;
      this.lastModifiedAt = new Date();
      this.disableReason = null;
      
      if (reason) {
        this.metadata = {
          ...this.metadata,
          enableReason: reason,
          enabledAt: new Date().toISOString()
        };
      }
      
      await this.save();
      
      Logger.info(`Operator ${this.code} enabled`, {
        operatorCode: this.code,
        userId,
        reason
      });
      
      return true;
    } catch (error) {
      Logger.error(`Failed to enable operator ${this.code}`, {
        operatorCode: this.code,
        userId,
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }
  
  /**
   * Disable operator
   */
  async disable(userId, reason) {
    try {
      this.enabled = false;
      this.lastModifiedBy = userId;
      this.lastModifiedAt = new Date();
      this.disableReason = reason;
      
      this.metadata = {
        ...this.metadata,
        disabledAt: new Date().toISOString()
      };
      
      await this.save();
      
      Logger.info(`Operator ${this.code} disabled`, {
        operatorCode: this.code,
        userId,
        reason
      });
      
      return true;
    } catch (error) {
      Logger.error(`Failed to disable operator ${this.code}`, {
        operatorCode: this.code,
        userId,
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }
  
  /**
   * Update health score
   */
  async updateHealthScore(score) {
    try {
      this.healthScore = Math.max(0, Math.min(1, score)); // Clamp between 0 and 1
      this.lastHealthCheck = new Date();
      
      await this.save();
      
      Logger.debug(`Health score updated for operator ${this.code}`, {
        operatorCode: this.code,
        healthScore: this.healthScore
      });
      
      return true;
    } catch (error) {
      Logger.error(`Failed to update health score for operator ${this.code}`, {
        operatorCode: this.code,
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }
  
  /**
   * Check if operator is operational
   */
  isOperational() {
    return this.enabled && 
           this.status === 'active' && 
           this.healthScore > 0.5;
  }
  
  /**
   * Get configuration value
   */
  getConfig(key, defaultValue = null) {
    return this.config[key] || defaultValue;
  }
  
  /**
   * Set configuration value
   */
  async setConfig(key, value) {
    this.config = {
      ...this.config,
      [key]: value
    };
    
    this.changed('config', true); // Mark as changed for JSONB
    await this.save();
  }
  
  /**
   * Get credential value
   */
  getCredential(key) {
    return this.credentials[key];
  }
  
  /**
   * Serialize for API response (exclude sensitive data)
   */
  toJSON() {
    const values = { ...this.dataValues };
    
    // Remove sensitive data
    delete values.credentials;
    
    return values;
  }
}

module.exports = Operator;
