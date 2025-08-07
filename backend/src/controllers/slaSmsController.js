/**
 * SLA Digital v2.2 SMS Controller - COMPLIANT IMPLEMENTATION
 * 
 * Handles SLA Digital v2.2 SMS sending using existing adapters.
 * Endpoints: /v2.2/sms
 * 
 * PHASE 2: Controllers Implementation
 */

const Logger = require('../utils/logger');
const { getInstance: getOperatorManager } = require('../services/core/OperatorManager');

class SLASmsController {
  
  /**
   * POST /v2.2/sms
   * Sends SMS to customer
   * 
   * Query Parameters: msisdn, message, [template], [language]
   */
  static async send(req, res) {
    try {
      const { 
        msisdn, 
        acr,
        message, 
        template, 
        language 
      } = req.query;
      
      const identifier = acr || msisdn;
      if (!identifier || !message) {
        return res.status(200).json({
          error: {
            category: 'Request',
            code: '2001',
            message: 'Missing required parameters: msisdn/acr and message are mandatory'
          }
        });
      }
      
      // Determine operator
      const operatorCode = identifier.startsWith('+965') ? 'zain-kw' : 'zain-kw';
      
      const operatorManager = getOperatorManager();
      const adapter = operatorManager.getOperatorAdapter(operatorCode);
      
      // Send SMS via adapter
      await adapter.sendSMS(identifier, message, template || 'welcome');
      
      const slaResponse = {
        message_sent: true,
        message: 'SMS sent successfully',
        template: template || 'welcome',
        language: language || 'en',
        timestamp: new Date().toISOString(),
        operator_code: operatorCode
      };
      
      Logger.info('SLA v2.2 SMS sent successfully', {
        endpoint: '/v2.2/sms',
        operatorCode,
        template
      });
      
      res.status(200).json(slaResponse);
      
    } catch (error) {
      Logger.error('SLA v2.2 SMS sending failed', {
        endpoint: '/v2.2/sms',
        error: error.message
      });
      
      res.status(200).json({
        error: {
          category: 'Service',
          code: '5003',
          message: error.message || 'SMS sending failed'
        }
      });
    }
  }
}

module.exports = SLASmsController;