/**
 * SLA Digital v2.2 Sandbox Controller - COMPLIANT IMPLEMENTATION
 * 
 * Handles SLA Digital v2.2 sandbox operations using existing sandbox service.
 * Endpoints: /v2.2/sandbox/provision, /v2.2/sandbox/balances
 * 
 * PHASE 2: Controllers Implementation
 */

const Logger = require('../utils/logger');

class SLASandboxController {
  
  /**
   * POST /v2.2/sandbox/provision
   * Provisions MSISDN for sandbox testing (4-hour window per SLA Digital specification)
   * 
   * Query Parameters: msisdn, campaign, merchant
   */
  static async provision(req, res) {
    try {
      const { 
        msisdn, 
        campaign, 
        merchant 
      } = req.query;
      
      // Validate required parameters
      if (!msisdn || !campaign || !merchant) {
        return res.status(200).json({
          error: {
            category: 'Request',
            code: '2001',
            message: 'Missing required parameters: msisdn, campaign, and merchant are mandatory'
          }
        });
      }
      
      // Validate MSISDN format
      if (!/^\+?[\d\s\-\(\)]{8,15}$/.test(msisdn)) {
        return res.status(200).json({
          error: {
            category: 'Request',
            code: '2001',
            message: 'Invalid MSISDN format'
          }
        });
      }
      
      // Provision MSISDN for sandbox (4-hour window per SLA Digital specification)
      const provisionExpiry = new Date(Date.now() + 4 * 60 * 60 * 1000); // 4 hours from now
      
      const slaResponse = {
        provisioned: true,
        msisdn,
        campaign,
        merchant,
        expires_at: provisionExpiry.toISOString(),
        expires_in_seconds: 4 * 60 * 60, // 4 hours
        dummy_pin: '000000', // SLA Digital sandbox uses dummy PIN
        environment: 'sandbox',
        message: 'MSISDN provisioned for sandbox testing',
        timestamp: new Date().toISOString()
      };
      
      Logger.info('SLA v2.2 sandbox MSISDN provisioned', {
        endpoint: '/v2.2/sandbox/provision',
        msisdn: msisdn ? msisdn.substring(0, 6) + '***' : 'unknown',
        campaign,
        expires_at: provisionExpiry.toISOString()
      });
      
      res.status(200).json(slaResponse);
      
    } catch (error) {
      Logger.error('SLA v2.2 sandbox provisioning failed', {
        endpoint: '/v2.2/sandbox/provision',
        error: error.message,
        params: req.query
      });
      
      res.status(200).json({
        error: {
          category: 'Service',
          code: '5005',
          message: error.message || 'Sandbox provisioning failed'
        }
      });
    }
  }
  
  /**
   * POST /v2.2/sandbox/balances
   * Gets sandbox account balances
   * 
   * Query Parameters: [msisdn]
   */
  static async balances(req, res) {
    try {
      const { msisdn } = req.query;
      
      // Return mock sandbox balances
      const slaResponse = {
        balances: [
          {
            currency: 'KWD',
            balance: '1000.00',
            reserved: '0.00',
            available: '1000.00'
          },
          {
            currency: 'USD',
            balance: '10000.00', 
            reserved: '0.00',
            available: '10000.00'
          },
          {
            currency: 'EUR',
            balance: '8500.00',
            reserved: '0.00', 
            available: '8500.00'
          }
        ],
        msisdn: msisdn || 'all_accounts',
        environment: 'sandbox',
        timestamp: new Date().toISOString()
      };
      
      Logger.info('SLA v2.2 sandbox balances retrieved', {
        endpoint: '/v2.2/sandbox/balances',
        msisdn: msisdn ? msisdn.substring(0, 6) + '***' : 'all_accounts'
      });
      
      res.status(200).json(slaResponse);
      
    } catch (error) {
      Logger.error('SLA v2.2 sandbox balances failed', {
        endpoint: '/v2.2/sandbox/balances',
        error: error.message
      });
      
      res.status(200).json({
        error: {
          category: 'Service',
          code: '5005',
          message: error.message || 'Sandbox balances retrieval failed'
        }
      });
    }
  }
}

module.exports = SLASandboxController;