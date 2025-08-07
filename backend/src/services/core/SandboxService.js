/**
 * SLA Digital Sandbox Service
 * 
 * Handles sandbox environment operations including MSISDN provisioning
 * ENHANCED: 4-hour MSISDN provisioning window per SLA Digital v2.2 requirements
 */

const axios = require('axios');
const Logger = require('../../utils/logger');
const { UnifiedError } = require('../../utils/errors');

// Redis import with fallback handling
let redisManager = null;
try {
  const redisConfig = require('../../config/redis');
  redisManager = redisConfig.redisManager;
} catch (error) {
  Logger.warn('Redis not available, sandbox caching will be limited', {
    error: error.message
  });
}

class SandboxService {
  constructor() {
    this.baseURL = 'https://api.sla-alacrity.com';
    this.provisionDuration = 4 * 60 * 60; // 4 hours in seconds
    this.dummyPIN = '000000'; // Standard sandbox PIN
    this.activeProvisions = new Map(); // In-memory tracking
  }
  
  /**
   * Provision MSISDN in sandbox environment for 4-hour testing window
   */
  async provisionSandboxMSISDN(msisdn, campaign, merchant, operatorCode = null) {
    try {
      Logger.info('Provisioning sandbox MSISDN', {
        msisdn: this.maskMSISDN(msisdn),
        campaign,
        operatorCode,
        duration: `${this.provisionDuration / 3600} hours`
      });
      
      // Check if MSISDN is already provisioned
      const existing = await this.getSandboxProvision(msisdn);
      if (existing && !existing.expired) {
        Logger.info('MSISDN already provisioned', {
          msisdn: this.maskMSISDN(msisdn),
          expiresAt: existing.expiresAt
        });
        return existing;
      }
      
      // Create provision payload
      const payload = {
        msisdn,
        campaign,
        merchant,
        duration: this.provisionDuration, // 4 hours in seconds
        operator_code: operatorCode,
        environment: 'sandbox'
      };
      
      // Call SLA Digital sandbox provision endpoint
      const response = await this.makeAPICall('/v2.2/sandbox/provision', payload);
      
      const provisionData = {
        msisdn,
        campaign,
        merchant,
        operatorCode,
        provisionedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + (this.provisionDuration * 1000)).toISOString(),
        duration: this.provisionDuration,
        dummyPIN: this.dummyPIN,
        status: 'active',
        uuid: response.uuid || this.generateProvisionId(),
        response: response
      };
      
      // Cache provision data
      await this.cacheProvision(msisdn, provisionData);
      
      // Track in memory
      this.activeProvisions.set(msisdn, provisionData);
      
      // Schedule cleanup after 4 hours
      this.scheduleCleanup(msisdn, this.provisionDuration * 1000);
      
      Logger.info('Sandbox MSISDN provisioned successfully', {
        msisdn: this.maskMSISDN(msisdn),
        uuid: provisionData.uuid,
        expiresAt: provisionData.expiresAt
      });
      
      return provisionData;
      
    } catch (error) {
      Logger.error('Failed to provision sandbox MSISDN', {
        msisdn: this.maskMSISDN(msisdn),
        campaign,
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }
  
  /**
   * Get sandbox provision info for MSISDN
   */
  async getSandboxProvision(msisdn) {
    try {
      // Check in-memory cache first
      const memoryProvision = this.activeProvisions.get(msisdn);
      if (memoryProvision) {
        const isExpired = new Date() > new Date(memoryProvision.expiresAt);
        return { ...memoryProvision, expired: isExpired };
      }
      
      // Check Redis cache
      if (redisManager) {
        const cacheKey = `sandbox:provision:${msisdn}`;
        const cachedData = await redisManager.get(cacheKey);
        
        if (cachedData) {
          const provisionData = JSON.parse(cachedData);
          const isExpired = new Date() > new Date(provisionData.expiresAt);
          
          // Update in-memory cache
          if (!isExpired) {
            this.activeProvisions.set(msisdn, provisionData);
          }
          
          return { ...provisionData, expired: isExpired };
        }
      }
      
      return null;
      
    } catch (error) {
      Logger.error('Error getting sandbox provision', {
        msisdn: this.maskMSISDN(msisdn),
        error: error.message
      });
      return null;
    }
  }
  
  /**
   * Check if MSISDN is provisioned and active
   */
  async isProvisionedAndActive(msisdn) {
    const provision = await this.getSandboxProvision(msisdn);
    return provision && !provision.expired;
  }
  
  /**
   * Get sandbox balances for testing
   */
  async getSandboxBalances(campaign, merchant) {
    try {
      Logger.debug('Getting sandbox balances', { campaign });
      
      const payload = {
        campaign,
        merchant,
        environment: 'sandbox'
      };
      
      const response = await this.makeAPICall('/v2.2/sandbox/balances', payload);
      
      return {
        balances: response.balances || {},
        currency: response.currency || 'USD',
        environment: 'sandbox',
        lastUpdated: new Date().toISOString()
      };
      
    } catch (error) {
      Logger.error('Failed to get sandbox balances', {
        campaign,
        error: error.message
      });
      throw error;
    }
  }
  
  /**
   * Create sandbox subscription (uses dummy PIN automatically)
   */
  async createSandboxSubscription(params) {
    try {
      const { msisdn, campaign, merchant, operatorCode } = params;
      
      Logger.info('Creating sandbox subscription', {
        msisdn: this.maskMSISDN(msisdn),
        campaign,
        operatorCode
      });
      
      // Ensure MSISDN is provisioned
      const provision = await this.getSandboxProvision(msisdn);
      if (!provision || provision.expired) {
        throw new UnifiedError('MSISDN_NOT_PROVISIONED', 
          'MSISDN must be provisioned in sandbox first. Provision expires after 4 hours.');
      }
      
      // Use dummy PIN for sandbox
      const subscriptionData = {
        ...params,
        pin: this.dummyPIN, // Always use dummy PIN in sandbox
        environment: 'sandbox'
      };
      
      const response = await this.makeAPICall('/v2.2/subscription/create', subscriptionData);
      
      Logger.info('Sandbox subscription created', {
        msisdn: this.maskMSISDN(msisdn),
        uuid: response.uuid,
        status: response.status
      });
      
      return response;
      
    } catch (error) {
      Logger.error('Failed to create sandbox subscription', {
        msisdn: this.maskMSISDN(params.msisdn),
        error: error.message
      });
      throw error;
    }
  }
  
  /**
   * Test sandbox PIN generation (always returns dummy PIN)
   */
  async generateSandboxPIN(msisdn, campaign, merchant) {
    try {
      Logger.info('Generating sandbox PIN', {
        msisdn: this.maskMSISDN(msisdn),
        campaign
      });
      
      // Check if provisioned
      const isProvisioned = await this.isProvisionedAndActive(msisdn);
      if (!isProvisioned) {
        throw new UnifiedError('MSISDN_NOT_PROVISIONED', 
          'MSISDN must be provisioned in sandbox first');
      }
      
      const payload = {
        msisdn,
        campaign,
        merchant,
        template: 'subscription',
        environment: 'sandbox'
      };
      
      const response = await this.makeAPICall('/v2.2/pin', payload);
      
      // Override with dummy PIN for sandbox
      const sandboxResponse = {
        ...response,
        pin_sent: true,
        dummy_pin: this.dummyPIN,
        message: 'Use dummy PIN 000000 for all sandbox operations',
        environment: 'sandbox'
      };
      
      Logger.info('Sandbox PIN generated (dummy)', {
        msisdn: this.maskMSISDN(msisdn),
        dummyPIN: this.dummyPIN
      });
      
      return sandboxResponse;
      
    } catch (error) {
      Logger.error('Failed to generate sandbox PIN', {
        msisdn: this.maskMSISDN(msisdn),
        error: error.message
      });
      throw error;
    }
  }
  
  /**
   * Reset sandbox environment
   */
  async resetSandbox(campaign, merchant) {
    try {
      Logger.info('Resetting sandbox environment', { campaign });
      
      const payload = {
        campaign,
        merchant,
        environment: 'sandbox',
        action: 'reset'
      };
      
      const response = await this.makeAPICall('/v2.2/sandbox/reset', payload);
      
      // Clear local caches
      this.activeProvisions.clear();
      
      // Clear Redis cache
      if (redisManager) {
        const keys = await redisManager.keys('sandbox:provision:*');
        if (keys.length > 0) {
          await redisManager.del(...keys);
        }
      }
      
      Logger.info('Sandbox environment reset successfully', {
        campaign,
        clearedProvisions: response.cleared_provisions || 0
      });
      
      return response;
      
    } catch (error) {
      Logger.error('Failed to reset sandbox', {
        campaign,
        error: error.message
      });
      throw error;
    }
  }
  
  /**
   * Cache provision data
   */
  async cacheProvision(msisdn, provisionData) {
    if (redisManager) {
      const cacheKey = `sandbox:provision:${msisdn}`;
      const ttl = this.provisionDuration + 300; // 5 minute buffer
      
      try {
        await redisManager.setex(cacheKey, ttl, JSON.stringify(provisionData));
        Logger.debug('Cached sandbox provision', { msisdn: this.maskMSISDN(msisdn) });
      } catch (error) {
        Logger.warn('Failed to cache sandbox provision', {
          msisdn: this.maskMSISDN(msisdn),
          error: error.message
        });
      }
    }
  }
  
  /**
   * Schedule cleanup after 4-hour expiry
   */
  scheduleCleanup(msisdn, delayMs) {
    setTimeout(async () => {
      try {
        Logger.info('Cleaning up expired sandbox provision', {
          msisdn: this.maskMSISDN(msisdn)
        });
        
        // Remove from in-memory cache
        this.activeProvisions.delete(msisdn);
        
        // Remove from Redis cache
        if (redisManager) {
          await redisManager.del(`sandbox:provision:${msisdn}`);
        }
        
      } catch (error) {
        Logger.error('Error cleaning up sandbox provision', {
          msisdn: this.maskMSISDN(msisdn),
          error: error.message
        });
      }
    }, delayMs);
  }
  
  /**
   * Make authenticated API call to SLA Digital
   */
  async makeAPICall(endpoint, data) {
    try {
      // Get credentials (assuming they're set in environment)
      const auth = Buffer.from(
        `${process.env.SLA_API_USERNAME}:${process.env.SLA_API_PASSWORD}`
      ).toString('base64');
      
      const response = await axios.post(
        `${this.baseURL}${endpoint}`,
        data,
        {
          headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/json',
            'User-Agent': 'SLA-Digital-Platform-Sandbox/1.0'
          },
          timeout: 30000 // 30 second timeout
        }
      );
      
      return response.data;
      
    } catch (error) {
      if (error.response) {
        Logger.error('SLA Digital API error', {
          endpoint,
          status: error.response.status,
          data: error.response.data
        });
        throw new UnifiedError('SLA_API_ERROR', 
          error.response.data?.message || 'SLA Digital API error');
      } else {
        Logger.error('Network error calling SLA Digital', {
          endpoint,
          error: error.message
        });
        throw new UnifiedError('NETWORK_ERROR', 
          'Failed to connect to SLA Digital API');
      }
    }
  }
  
  /**
   * Generate provision ID
   */
  generateProvisionId() {
    return 'sbx_' + Math.random().toString(36).substring(2, 15);
  }
  
  /**
   * Mask MSISDN for logging
   */
  maskMSISDN(msisdn) {
    if (msisdn.length >= 6) {
      return msisdn.substring(0, 3) + '***' + msisdn.substring(msisdn.length - 2);
    }
    return '***';
  }
  
  /**
   * Get sandbox statistics
   */
  getSandboxStatistics() {
    const activeCount = Array.from(this.activeProvisions.values())
      .filter(p => new Date() < new Date(p.expiresAt)).length;
    
    const expiredCount = this.activeProvisions.size - activeCount;
    
    return {
      activeProvisions: activeCount,
      expiredProvisions: expiredCount,
      totalProvisions: this.activeProvisions.size,
      provisionDuration: `${this.provisionDuration / 3600} hours`,
      dummyPIN: this.dummyPIN,
      environment: 'sandbox'
    };
  }
  
  /**
   * List active provisions
   */
  listActiveProvisions() {
    return Array.from(this.activeProvisions.entries())
      .map(([msisdn, provision]) => ({
        msisdn: this.maskMSISDN(msisdn),
        provisionedAt: provision.provisionedAt,
        expiresAt: provision.expiresAt,
        expired: new Date() > new Date(provision.expiresAt),
        campaign: provision.campaign,
        operatorCode: provision.operatorCode,
        uuid: provision.uuid
      }))
      .sort((a, b) => new Date(b.provisionedAt) - new Date(a.provisionedAt));
  }
  
  /**
   * Cleanup on shutdown
   */
  cleanup() {
    Logger.info('Cleaning up sandbox service', {
      activeProvisions: this.activeProvisions.size
    });
    
    this.activeProvisions.clear();
  }
}

// Export singleton instance
module.exports = new SandboxService();