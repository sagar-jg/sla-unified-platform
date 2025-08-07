/**
 * MO SMS (Mobile Originated SMS) Service - SLA Digital v2.2 Compliant
 * 
 * Handles MO SMS flows for operators that support it per SLA Digital documentation:
 * - Telenor Norway: MO SMS consent flow
 * - Vodafone Ireland: MO SMS subscription activation  
 * - UK operators via Fonix: MO SMS billing confirmation
 * - General keyword processing (STOP, HELP, INFO)
 */

const Logger = require('../../utils/logger');
const { UnifiedError } = require('../../utils/errors');

// Redis import with fallback handling
let redisManager = null;
try {
  const redisConfig = require('../../config/redis');
  redisManager = redisConfig.redisManager;
} catch (error) {
  Logger.warn('Redis not available, MO SMS caching will be limited', {
    error: error.message
  });
}

class MOSMSService {
  constructor() {
    // Standard MO SMS keywords per SLA Digital documentation
    this.keywords = {
      'STOP': {
        action: 'unsubscribe',
        description: 'Unsubscribe from all services',
        response: 'You have been unsubscribed. No more charges will apply.'
      },
      'HELP': {
        action: 'help_request',
        description: 'Request help information',
        response: 'For help, contact customer service or reply STOP to unsubscribe.'
      },
      'INFO': {
        action: 'information_request',
        description: 'Request service information',
        response: 'Service info: Premium SMS service. Reply STOP to unsubscribe.'
      },
      'START': {
        action: 'subscribe',
        description: 'Subscribe to service (operator specific)',
        response: 'Subscription activated. You will be charged as per service terms.'
      },
      'YES': {
        action: 'consent_confirm',
        description: 'Confirm subscription consent',
        response: 'Subscription confirmed. Charging will begin as per service terms.'
      },
      'NO': {
        action: 'consent_decline',
        description: 'Decline subscription consent',
        response: 'Subscription declined. No charges will apply.'
      }
    };
    
    // Operator-specific MO SMS configurations
    this.operatorConfigs = {
      'telenor-no': {
        supportsMOSMS: true,
        consentFlow: true,
        shortCodes: ['2090', '2070'],
        language: 'no',
        keywords: ['STOPP', 'HJELP', 'INFO', 'JA', 'NEI', 'START'] // Norwegian keywords
      },
      'vf-ie': {
        supportsMOSMS: true,
        subscriptionActivation: true,
        shortCodes: ['50202'],
        language: 'en',
        keywords: ['STOP', 'HELP', 'INFO', 'START', 'YES', 'NO']
      },
      'voda-uk': {
        supportsMOSMS: true,
        fonixIntegration: true,
        shortCodes: ['88088'],
        language: 'en',
        keywords: ['STOP', 'HELP', 'INFO'],
        unifiedUKFlow: true
      },
      'three-uk': {
        supportsMOSMS: true,
        fonixIntegration: true,
        shortCodes: ['88088'],
        language: 'en',
        keywords: ['STOP', 'HELP', 'INFO'],
        unifiedUKFlow: true
      },
      'o2-uk': {
        supportsMOSMS: true,
        fonixIntegration: true,
        shortCodes: ['88088'],
        language: 'en',
        keywords: ['STOP', 'HELP', 'INFO'],
        unifiedUKFlow: true
      },
      'ee-uk': {
        supportsMOSMS: true,
        fonixIntegration: true,
        shortCodes: ['88088'],
        language: 'en',
        keywords: ['STOP', 'HELP', 'INFO'],
        unifiedUKFlow: true
      }
    };
  }
  
  /**
   * Process incoming MO SMS per SLA Digital v2.2 specification
   */
  async processMOSMS(operatorCode, msisdn, messageText, shortCode, timestamp = null) {
    try {
      Logger.info('Processing MO SMS', {
        operatorCode,
        msisdn: this.maskMSISDN(msisdn),
        messageText,
        shortCode
      });
      
      // Validate operator supports MO SMS
      const operatorConfig = this.operatorConfigs[operatorCode];
      if (!operatorConfig || !operatorConfig.supportsMOSMS) {
        throw new UnifiedError('MO_SMS_NOT_SUPPORTED', 
          `MO SMS not supported for operator ${operatorCode}`);
      }
      
      // Validate short code
      if (!operatorConfig.shortCodes.includes(shortCode)) {
        throw new UnifiedError('INVALID_SHORT_CODE', 
          `Invalid short code ${shortCode} for operator ${operatorCode}`);
      }
      
      // Parse and process the message
      const processedMessage = await this.parseMessage(operatorCode, messageText, operatorConfig);
      
      // Handle the action based on keyword
      const result = await this.handleMOSMSAction(
        operatorCode, 
        msisdn, 
        processedMessage, 
        shortCode, 
        operatorConfig
      );
      
      // Store MO SMS record for audit trail
      await this.storeMOSMSRecord({
        operatorCode,
        msisdn,
        messageText,
        shortCode,
        action: processedMessage.action,
        timestamp: timestamp || new Date().toISOString(),
        response: result.response,
        processed: true
      });
      
      Logger.info('MO SMS processed successfully', {
        operatorCode,
        msisdn: this.maskMSISDN(msisdn),
        action: processedMessage.action,
        shortCode
      });
      
      return result;
      
    } catch (error) {
      Logger.error('Error processing MO SMS', {
        operatorCode,
        msisdn: this.maskMSISDN(msisdn),
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }
  
  /**
   * Parse MO SMS message and determine action
   */
  async parseMessage(operatorCode, messageText, operatorConfig) {
    const normalizedMessage = messageText.toUpperCase().trim();
    
    // Check operator-specific keywords first
    if (operatorCode === 'telenor-no') {
      // Norwegian keyword mapping
      const norwegianKeywords = {
        'STOPP': 'STOP',
        'HJELP': 'HELP', 
        'INFO': 'INFO',
        'JA': 'YES',
        'NEI': 'NO',
        'START': 'START'
      };
      
      const englishKeyword = norwegianKeywords[normalizedMessage];
      if (englishKeyword && this.keywords[englishKeyword]) {
        return {
          originalMessage: messageText,
          keyword: englishKeyword,
          action: this.keywords[englishKeyword].action,
          description: this.keywords[englishKeyword].description,
          language: 'no'
        };
      }
    }
    
    // Standard English keywords
    if (this.keywords[normalizedMessage]) {
      return {
        originalMessage: messageText,
        keyword: normalizedMessage,
        action: this.keywords[normalizedMessage].action,
        description: this.keywords[normalizedMessage].description,
        language: operatorConfig.language
      };
    }
    
    // Unknown keyword
    return {
      originalMessage: messageText,
      keyword: 'UNKNOWN',
      action: 'unknown_keyword',
      description: 'Unknown keyword received',
      language: operatorConfig.language
    };
  }
  
  /**
   * Handle MO SMS action based on keyword and operator
   */
  async handleMOSMSAction(operatorCode, msisdn, processedMessage, shortCode, operatorConfig) {
    const { action, keyword, language } = processedMessage;
    
    switch (action) {
      case 'unsubscribe':
        return await this.handleUnsubscribe(operatorCode, msisdn, shortCode, language);
        
      case 'help_request':
        return await this.handleHelpRequest(operatorCode, msisdn, shortCode, language);
        
      case 'information_request':
        return await this.handleInfoRequest(operatorCode, msisdn, shortCode, language);
        
      case 'subscribe':
        return await this.handleSubscribe(operatorCode, msisdn, shortCode, language);
        
      case 'consent_confirm':
        return await this.handleConsentConfirm(operatorCode, msisdn, shortCode, language);
        
      case 'consent_decline':
        return await this.handleConsentDecline(operatorCode, msisdn, shortCode, language);
        
      case 'unknown_keyword':
      default:
        return await this.handleUnknownKeyword(operatorCode, msisdn, shortCode, language);
    }
  }
  
  /**
   * Handle STOP/STOPP keyword - Unsubscribe from all services
   */
  async handleUnsubscribe(operatorCode, msisdn, shortCode, language) {
    try {
      // Import models dynamically to avoid circular dependencies
      const { getModels } = require('../../models');
      const { Subscription } = getModels();
      
      // Find and cancel all active subscriptions for this MSISDN
      const activeSubscriptions = await Subscription.findAll({
        where: { 
          msisdn,
          operatorCode,
          status: ['active', 'trial', 'grace']
        }
      });
      
      // Cancel each subscription
      const cancelPromises = activeSubscriptions.map(sub => 
        sub.update({ 
          status: 'cancelled',
          cancelReason: 'mo_sms_unsubscribe',
          cancelledAt: new Date()
        })
      );
      
      await Promise.all(cancelPromises);
      
      const responseMessages = {
        'en': 'You have been unsubscribed from all services. No further charges will apply.',
        'no': 'Du er nå avmeldt fra alle tjenester. Ingen flere kostnader vil påløpe.'
      };
      
      Logger.info('MO SMS unsubscribe processed', {
        operatorCode,
        msisdn: this.maskMSISDN(msisdn),
        cancelledSubscriptions: activeSubscriptions.length
      });
      
      return {
        action: 'unsubscribe',
        success: true,
        cancelledSubscriptions: activeSubscriptions.length,
        response: responseMessages[language] || responseMessages['en'],
        shouldSendSMS: true
      };
      
    } catch (error) {
      Logger.error('Error processing unsubscribe', {
        operatorCode,
        msisdn: this.maskMSISDN(msisdn),
        error: error.message
      });
      
      return {
        action: 'unsubscribe',
        success: false,
        error: 'Failed to process unsubscribe request',
        response: 'Error processing your request. Please try again or contact customer service.',
        shouldSendSMS: true
      };
    }
  }
  
  /**
   * Handle HELP/HJELP keyword - Provide help information
   */
  async handleHelpRequest(operatorCode, msisdn, shortCode, language) {
    const responseMessages = {
      'en': `Help: You are subscribed to premium services. Charges apply. Reply STOP to unsubscribe or contact customer service for more help.`,
      'no': `Hjelp: Du er abonnent på premium-tjenester. Kostnader påløper. Svar STOPP for å avslutte eller kontakt kundeservice for mer hjelp.`
    };
    
    return {
      action: 'help_request',
      success: true,
      response: responseMessages[language] || responseMessages['en'],
      shouldSendSMS: true
    };
  }
  
  /**
   * Handle INFO keyword - Provide service information
   */
  async handleInfoRequest(operatorCode, msisdn, shortCode, language) {
    const responseMessages = {
      'en': `Service Info: Premium SMS service. Charges apply as per service terms. Reply STOP to unsubscribe.`,
      'no': `Tjeneste Info: Premium SMS-tjeneste. Kostnader påløper i henhold til tjenestevilkår. Svar STOPP for å avslutte.`
    };
    
    return {
      action: 'information_request',
      success: true,
      response: responseMessages[language] || responseMessages['en'],
      shouldSendSMS: true
    };
  }
  
  /**
   * Handle START keyword - Subscribe to service (operator specific)
   */
  async handleSubscribe(operatorCode, msisdn, shortCode, language) {
    // This would trigger subscription flow - implementation depends on operator
    const responseMessages = {
      'en': `Subscription request received. You will receive a confirmation message shortly.`,
      'no': `Abonnementforespørsel mottatt. Du vil motta en bekreftelse snart.`
    };
    
    Logger.info('MO SMS subscription request', {
      operatorCode,
      msisdn: this.maskMSISDN(msisdn),
      shortCode
    });
    
    return {
      action: 'subscribe',
      success: true,
      response: responseMessages[language] || responseMessages['en'],
      shouldSendSMS: true,
      requiresFollowUp: true
    };
  }
  
  /**
   * Handle YES/JA keyword - Confirm consent (Telenor Norway specific)
   */
  async handleConsentConfirm(operatorCode, msisdn, shortCode, language) {
    if (operatorCode !== 'telenor-no') {
      return await this.handleUnknownKeyword(operatorCode, msisdn, shortCode, language);
    }
    
    const responseMessages = {
      'en': `Subscription confirmed. Charging will begin as per service terms.`,
      'no': `Abonnement bekreftet. Fakturering vil starte i henhold til tjenestevilkår.`
    };
    
    return {
      action: 'consent_confirm',
      success: true,
      response: responseMessages[language] || responseMessages['en'],
      shouldSendSMS: true,
      consentGiven: true
    };
  }
  
  /**
   * Handle NO/NEI keyword - Decline consent (Telenor Norway specific)
   */
  async handleConsentDecline(operatorCode, msisdn, shortCode, language) {
    if (operatorCode !== 'telenor-no') {
      return await this.handleUnknownKeyword(operatorCode, msisdn, shortCode, language);
    }
    
    const responseMessages = {
      'en': `Subscription declined. No charges will apply.`,
      'no': `Abonnement avslått. Ingen kostnader vil påløpe.`
    };
    
    return {
      action: 'consent_decline',
      success: true,
      response: responseMessages[language] || responseMessages['en'],
      shouldSendSMS: true,
      consentGiven: false
    };
  }
  
  /**
   * Handle unknown keyword
   */
  async handleUnknownKeyword(operatorCode, msisdn, shortCode, language) {
    const responseMessages = {
      'en': `Unknown command. Reply HELP for assistance or STOP to unsubscribe.`,
      'no': `Ukjent kommando. Svar HJELP for assistanse eller STOPP for å avslutte.`
    };
    
    return {
      action: 'unknown_keyword',
      success: false,
      response: responseMessages[language] || responseMessages['en'],
      shouldSendSMS: true
    };
  }
  
  /**
   * Store MO SMS record for audit trail
   */
  async storeMOSMSRecord(record) {
    try {
      // Store in Redis for fast access (24 hour TTL)
      if (redisManager) {
        const key = `mo_sms:${record.operatorCode}:${record.msisdn}:${Date.now()}`;
        await redisManager.setex(key, 86400, JSON.stringify(record));
      }
      
      // Store in database for permanent audit trail
      const { getModels } = require('../../models');
      const { MOSMSLog } = getModels();
      
      if (MOSMSLog) {
        await MOSMSLog.create(record);
      }
      
    } catch (error) {
      Logger.warn('Failed to store MO SMS record', {
        operatorCode: record.operatorCode,
        error: error.message
      });
    }
  }
  
  /**
   * Get MO SMS statistics for operator
   */
  async getMOSMSStatistics(operatorCode, timeframe = '24h') {
    try {
      const { getModels } = require('../../models');
      const { MOSMSLog } = getModels();
      
      if (!MOSMSLog) {
        return { error: 'MO SMS logging not available' };
      }
      
      const timeframMap = {
        '1h': 1,
        '24h': 24,
        '7d': 24 * 7,
        '30d': 24 * 30
      };
      
      const hours = timeframMap[timeframe] || 24;
      const since = new Date(Date.now() - (hours * 60 * 60 * 1000));
      
      const records = await MOSMSLog.findAll({
        where: {
          operatorCode,
          timestamp: {
            [require('sequelize').Op.gte]: since
          }
        }
      });
      
      // Group by action
      const actionCounts = {};
      records.forEach(record => {
        actionCounts[record.action] = (actionCounts[record.action] || 0) + 1;
      });
      
      return {
        operatorCode,
        timeframe,
        totalMessages: records.length,
        actionBreakdown: actionCounts,
        period: {
          from: since.toISOString(),
          to: new Date().toISOString()
        }
      };
      
    } catch (error) {
      Logger.error('Error getting MO SMS statistics', {
        operatorCode,
        error: error.message
      });
      return { error: 'Failed to get statistics' };
    }
  }
  
  /**
   * Check if operator supports MO SMS
   */
  supportsMOSMS(operatorCode) {
    const config = this.operatorConfigs[operatorCode];
    return config && config.supportsMOSMS;
  }
  
  /**
   * Get supported keywords for operator
   */
  getSupportedKeywords(operatorCode) {
    const config = this.operatorConfigs[operatorCode];
    if (!config || !config.supportsMOSMS) {
      return [];
    }
    
    return config.keywords || [];
  }
  
  /**
   * Mask MSISDN for logging (privacy protection)
   */
  maskMSISDN(msisdn) {
    if (msisdn.length >= 6) {
      return msisdn.substring(0, 3) + '***' + msisdn.substring(msisdn.length - 2);
    }
    return '***';
  }
  
  /**
   * Get MO SMS service statistics
   */
  getServiceStatistics() {
    const supportedOperators = Object.keys(this.operatorConfigs).filter(
      op => this.operatorConfigs[op].supportsMOSMS
    );
    
    return {
      supportedOperators: supportedOperators.length,
      operatorsList: supportedOperators,
      totalKeywords: Object.keys(this.keywords).length,
      keywordsList: Object.keys(this.keywords),
      consentFlowSupport: supportedOperators.filter(
        op => this.operatorConfigs[op].consentFlow
      ).length,
      fonixIntegrationSupport: supportedOperators.filter(
        op => this.operatorConfigs[op].fonixIntegration
      ).length
    };
  }
}

// Export singleton instance
module.exports = new MOSMSService();