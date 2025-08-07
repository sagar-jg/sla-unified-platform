/**
 * Response Mapper
 * 
 * Maps operator-specific responses to unified format across ALL SLA Digital operators
 */

const Logger = require('../../utils/logger');
const { UnifiedError } = require('../../utils/errors');

class ResponseMapper {
  constructor() {
    this.operatorMappings = this.initializeMappings();
  }
  
  /**
   * Initialize operator-specific response mappings for ALL SLA Digital operators
   */
  initializeMappings() {
    return {
      // Zain operators
      'zain-kw': {
        subscriptionId: 'uuid',
        operatorSubscriptionId: 'uuid',
        status: (response) => this.mapZainStatus(response.status),
        amount: 'amount',
        currency: () => 'KWD',
        frequency: 'frequency',
        nextBillingDate: 'next_payment_timestamp',
        msisdn: 'msisdn',
        campaign: 'campaign',
        merchant: 'merchant',
        transactionId: 'transaction_id',
        checkoutUrl: 'checkout_url',
        eligible: 'eligible',
        eligibilityReason: 'eligibility_reason'
      },
      
      'zain-sa': {
        subscriptionId: 'subscription_uuid',
        operatorSubscriptionId: 'subscription_uuid',
        status: (response) => this.mapZainStatus(response.status),
        amount: 'charge_amount',
        currency: () => 'SAR',
        frequency: 'billing_frequency',
        nextBillingDate: 'next_charge_date',
        msisdn: 'msisdn',
        transactionId: 'transaction_ref'
      },
      
      'zain-bh': {
        subscriptionId: 'uuid',
        operatorSubscriptionId: 'uuid',
        status: (response) => this.mapZainStatus(response.status),
        amount: 'amount',
        currency: () => 'BHD',
        frequency: 'frequency',
        nextBillingDate: 'next_payment_timestamp',
        msisdn: 'msisdn',
        transactionId: 'transaction_id'
      },
      
      'zain-iq': {
        subscriptionId: 'uuid',
        operatorSubscriptionId: 'uuid',
        status: (response) => this.mapZainStatus(response.status),
        amount: 'amount',
        currency: () => 'IQD',
        frequency: 'frequency',
        nextBillingDate: 'next_payment_timestamp',
        msisdn: 'msisdn',
        checkoutUrl: 'checkout_url',
        checkoutRequired: () => true
      },
      
      'zain-jo': {
        subscriptionId: 'uuid',
        operatorSubscriptionId: 'uuid',
        status: (response) => this.mapZainStatus(response.status),
        amount: 'amount',
        currency: () => 'JOD',
        frequency: 'frequency',
        nextBillingDate: 'next_payment_timestamp',
        msisdn: 'msisdn',
        transactionId: 'transaction_id'
      },
      
      'zain-sd': {
        subscriptionId: 'uuid',
        operatorSubscriptionId: 'uuid',
        status: (response) => this.mapZainStatus(response.status),
        amount: 'amount',
        currency: () => 'SDG',
        frequency: 'frequency',
        nextBillingDate: 'next_payment_timestamp',
        msisdn: 'msisdn',
        checkoutUrl: 'checkout_url',
        checkoutRequired: () => true
      },
      
      // Etisalat operators
      'etisalat-ae': {
        subscriptionId: 'sub_id',
        operatorSubscriptionId: 'sub_id',
        status: (response) => this.mapEtisalatStatus(response.state || response.status),
        amount: 'price',
        currency: () => 'AED',
        frequency: 'cycle',
        nextBillingDate: 'next_bill_date',
        msisdn: 'msisdn',
        transactionId: 'transaction_id',
        checkoutUrl: 'checkout_url',
        checkoutRequired: () => true
      },
      
      // Ooredoo operators
      'ooredoo-kw': {
        subscriptionId: 'uuid',
        operatorSubscriptionId: 'uuid',
        status: (response) => this.mapGenericStatus(response.status),
        amount: 'amount',
        currency: () => 'KWD',
        frequency: 'frequency',
        nextBillingDate: 'next_payment_timestamp',
        msisdn: 'msisdn',
        transactionId: 'transaction_id',
        checkoutUrl: 'checkout_url'
      },
      
      // STC operators
      'stc-kw': {
        subscriptionId: 'uuid',
        operatorSubscriptionId: 'uuid',
        status: (response) => this.mapGenericStatus(response.status),
        amount: 'amount',
        currency: () => 'KWD',
        frequency: 'frequency',
        nextBillingDate: 'next_payment_timestamp',
        msisdn: 'msisdn',
        transactionId: 'transaction_id',
        checkoutUrl: 'checkout_url',
        checkoutRequired: () => true
      },
      
      // Telenor operators
      'telenor-dk': {
        subscriptionId: 'uuid',
        operatorSubscriptionId: 'uuid',
        status: (response) => this.mapGenericStatus(response.status),
        amount: 'amount',
        currency: () => 'DKK',
        frequency: 'frequency',
        nextBillingDate: 'next_payment_timestamp',
        msisdn: 'msisdn',
        checkoutUrl: 'checkout_url',
        checkoutRequired: () => true
      },
      
      'telenor-digi': {
        subscriptionId: 'uuid',
        operatorSubscriptionId: 'uuid',
        status: (response) => this.mapGenericStatus(response.status),
        amount: 'amount',
        currency: () => 'MYR',
        frequency: 'frequency',
        nextBillingDate: 'next_payment_timestamp',
        msisdn: 'msisdn',
        transactionId: 'transaction_id'
      },
      
      'telenor-mm': {
        subscriptionId: 'uuid',
        operatorSubscriptionId: 'uuid',
        status: (response) => this.mapGenericStatus(response.status),
        amount: 'amount',
        currency: () => 'MMK',
        frequency: 'frequency',
        nextBillingDate: 'next_payment_timestamp',
        msisdn: 'msisdn',
        checkoutUrl: 'checkout_url',
        checkoutRequired: () => true
      },
      
      'telenor-no': {
        subscriptionId: 'uuid',
        operatorSubscriptionId: 'uuid',
        status: (response) => this.mapGenericStatus(response.status),
        amount: 'amount',
        currency: () => 'NOK',
        frequency: 'frequency',
        nextBillingDate: 'next_payment_timestamp',
        msisdn: 'msisdn',
        checkoutUrl: 'checkout_url',
        checkoutRequired: () => true
      },
      
      'telenor-se': {
        subscriptionId: 'uuid',
        operatorSubscriptionId: 'uuid',
        status: (response) => this.mapGenericStatus(response.status),
        amount: 'amount',
        currency: () => 'SEK',
        frequency: 'frequency',
        nextBillingDate: 'next_payment_timestamp',
        msisdn: 'msisdn',
        checkoutUrl: 'checkout_url',
        checkoutRequired: () => true
      },
      
      'telenor-rs': {
        subscriptionId: 'uuid',
        operatorSubscriptionId: 'uuid',
        status: (response) => this.mapGenericStatus(response.status),
        amount: 'amount',
        currency: () => 'RSD',
        frequency: 'frequency',
        nextBillingDate: 'next_payment_timestamp',
        msisdn: 'msisdn',
        checkoutUrl: 'checkout_url',
        checkoutRequired: () => true
      },
      
      // Vodafone operators
      'voda-uk': {
        subscriptionId: 'uuid',
        operatorSubscriptionId: 'uuid',
        status: (response) => this.mapGenericStatus(response.status),
        amount: 'amount',
        currency: () => 'GBP',
        frequency: 'frequency',
        nextBillingDate: 'next_payment_timestamp',
        msisdn: 'msisdn',
        transactionId: 'transaction_id',
        checkoutUrl: 'checkout_url',
        checkoutRequired: () => true
      },
      
      'vf-ie': {
        subscriptionId: 'uuid',
        operatorSubscriptionId: 'uuid',
        status: (response) => this.mapGenericStatus(response.status),
        amount: 'amount',
        currency: () => 'EUR',
        frequency: 'frequency',
        nextBillingDate: 'next_payment_timestamp',
        msisdn: 'msisdn',
        transactionId: 'transaction_id'
      },
      
      // Three operators
      'three-uk': {
        subscriptionId: 'uuid',
        operatorSubscriptionId: 'uuid',
        status: (response) => this.mapGenericStatus(response.status),
        amount: 'amount',
        currency: () => 'GBP',
        frequency: 'frequency',
        nextBillingDate: 'next_payment_timestamp',
        msisdn: 'msisdn',
        checkoutUrl: 'checkout_url',
        checkoutRequired: () => true
      },
      
      'three-ie': {
        subscriptionId: 'uuid',
        operatorSubscriptionId: 'uuid',
        status: (response) => this.mapGenericStatus(response.status),
        amount: 'amount',
        currency: () => 'EUR',
        frequency: 'frequency',
        nextBillingDate: 'next_payment_timestamp',
        msisdn: 'msisdn',
        checkoutUrl: 'checkout_url',
        checkoutRequired: () => true
      },
      
      // Other operators
      'mobile-ng': {
        subscriptionId: 'uuid',
        operatorSubscriptionId: 'uuid',
        status: (response) => this.mapGenericStatus(response.status),
        amount: 'amount',
        currency: () => 'NGN',
        frequency: 'frequency',
        nextBillingDate: 'next_payment_timestamp',
        msisdn: 'msisdn',
        autoRenewal: 'auto_renewal',
        checkoutUrl: 'checkout_url',
        checkoutRequired: () => true
      },
      
      'axiata-lk': {
        subscriptionId: 'uuid',
        operatorSubscriptionId: 'uuid',
        status: (response) => this.mapGenericStatus(response.status),
        amount: 'amount',
        currency: () => 'LKR',
        frequency: 'frequency',
        nextBillingDate: 'next_payment_timestamp',
        msisdn: 'msisdn',
        checkoutUrl: 'checkout_url',
        checkoutRequired: () => true
      },
      
      'viettel-mz': {
        subscriptionId: 'uuid',
        operatorSubscriptionId: 'uuid',
        status: (response) => this.mapGenericStatus(response.status),
        amount: 'amount',
        currency: () => 'MZN',
        frequency: 'frequency',
        nextBillingDate: 'next_payment_timestamp',
        msisdn: 'msisdn',
        checkoutUrl: 'checkout_url',
        checkoutRequired: () => true
      },
      
      'umobile-my': {
        subscriptionId: 'uuid',
        operatorSubscriptionId: 'uuid',
        status: (response) => this.mapGenericStatus(response.status),
        amount: 'amount',
        currency: () => 'MYR',
        frequency: 'frequency',
        nextBillingDate: 'next_payment_timestamp',
        msisdn: 'msisdn',
        transactionId: 'transaction_id'
      },
      
      'o2-uk': {
        subscriptionId: 'uuid',
        operatorSubscriptionId: 'uuid',
        status: (response) => this.mapGenericStatus(response.status),
        amount: 'amount',
        currency: () => 'GBP',
        frequency: 'frequency',
        nextBillingDate: 'next_payment_timestamp',
        msisdn: 'msisdn',
        checkoutUrl: 'checkout_url',
        checkoutRequired: () => true
      },
      
      'ee-uk': {
        subscriptionId: 'uuid',
        operatorSubscriptionId: 'uuid',
        status: (response) => this.mapGenericStatus(response.status),
        amount: 'amount',
        currency: () => 'GBP',
        frequency: 'frequency',
        nextBillingDate: 'next_payment_timestamp',
        msisdn: 'msisdn',
        checkoutUrl: 'checkout_url',
        checkoutRequired: () => true
      }
    };
  }
  
  /**
   * Map response from specific operator to unified format
   */
  mapResponse(operatorCode, rawResponse) {
    try {
      const mapping = this.operatorMappings[operatorCode];
      
      if (!mapping) {
        Logger.warn(`No response mapping found for operator: ${operatorCode}`);
        return this.createGenericMapping(rawResponse, operatorCode);
      }
      
      const mappedData = {};
      
      // Apply field mappings
      for (const [unifiedField, operatorMapping] of Object.entries(mapping)) {
        try {
          if (typeof operatorMapping === 'function') {
            mappedData[unifiedField] = operatorMapping(rawResponse);
          } else if (typeof operatorMapping === 'string') {
            mappedData[unifiedField] = this.getNestedValue(rawResponse, operatorMapping);
          } else {
            mappedData[unifiedField] = operatorMapping;
          }
        } catch (error) {
          Logger.debug(`Failed to map field ${unifiedField} for ${operatorCode}`, {
            operatorCode,
            field: unifiedField,
            error: error.message
          });
          mappedData[unifiedField] = null;
        }
      }
      
      // Add operator-specific metadata
      mappedData.operatorCode = operatorCode;
      mappedData.country = this.getOperatorCountry(operatorCode);
      mappedData.operatorName = this.getOperatorName(operatorCode);
      
      // Clean up null/undefined values
      Object.keys(mappedData).forEach(key => {
        if (mappedData[key] === null || mappedData[key] === undefined) {
          delete mappedData[key];
        }
      });
      
      const result = {
        data: mappedData,
        metadata: {
          operatorCode,
          mappingVersion: '2.0',
          timestamp: new Date().toISOString(),
          hasRawResponse: !!rawResponse
        }
      };
      
      Logger.debug(`Response mapped successfully for ${operatorCode}`, {
        operatorCode,
        mappedFields: Object.keys(mappedData).length
      });
      
      return result;
      
    } catch (error) {
      Logger.error(`Failed to map response for ${operatorCode}`, {
        operatorCode,
        error: error.message,
        stack: error.stack,
        rawResponse: this.sanitizeResponse(rawResponse)
      });
      
      throw new UnifiedError('RESPONSE_MAPPING_ERROR', 
        `Failed to map response for ${operatorCode}: ${error.message}`);
    }
  }
  
  /**
   * Create generic mapping for unknown operators
   */
  createGenericMapping(rawResponse, operatorCode = 'unknown') {
    return {
      data: {
        ...rawResponse,
        operatorCode,
        mappingType: 'generic'
      },
      metadata: {
        operatorCode,
        mappingVersion: 'generic',
        timestamp: new Date().toISOString(),
        note: 'Generic mapping applied - operator-specific mapping not available'
      }
    };
  }
  
  /**
   * Get nested value from object using dot notation
   */
  getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => {
      return current && current[key] !== undefined ? current[key] : null;
    }, obj);
  }
  
  /**
   * Status mapping functions for different operator groups
   */
  mapZainStatus(status) {
    const statusMap = {
      'ACTIVE': 'active',
      'SUSPENDED': 'suspended',
      'TRIAL': 'trial',
      'DELETED': 'cancelled',
      'REMOVED': 'cancelled',
      'GRACE': 'grace',
      'EXPIRED': 'expired',
      'SUCCESS': 'active' // Zain KSA specific
    };
    return statusMap[status] || 'unknown';
  }
  
  mapEtisalatStatus(status) {
    const statusMap = {
      'ACTIVE': 'active',
      'PAUSED': 'suspended',
      'SUSPENDED': 'suspended',
      'TERMINATED': 'cancelled',
      'CANCELLED': 'cancelled',
      'TRIAL': 'trial',
      'EXPIRED': 'expired'
    };
    return statusMap[status] || 'unknown';
  }
  
  mapGenericStatus(status) {
    if (!status) return 'unknown';
    
    const statusMap = {
      'ACTIVE': 'active',
      'SUSPENDED': 'suspended',
      'PAUSED': 'suspended',
      'TRIAL': 'trial',
      'DELETED': 'cancelled',
      'REMOVED': 'cancelled',
      'CANCELLED': 'cancelled',
      'GRACE': 'grace',
      'EXPIRED': 'expired',
      'PENDING': 'pending',
      'PROCESSING': 'processing',
      'FAILED': 'failed',
      'SUCCESS': 'active',
      'CHARGED': 'active'
    };
    
    return statusMap[status.toString().toUpperCase()] || 'unknown';
  }
  
  /**
   * Get operator country by code
   */
  getOperatorCountry(operatorCode) {
    const countryMap = {
      'zain-kw': 'Kuwait',
      'zain-sa': 'Saudi Arabia',
      'zain-bh': 'Bahrain',
      'zain-iq': 'Iraq',
      'zain-jo': 'Jordan',
      'zain-sd': 'Sudan',
      'etisalat-ae': 'UAE',
      'ooredoo-kw': 'Kuwait',
      'stc-kw': 'Kuwait',
      'telenor-dk': 'Denmark',
      'telenor-digi': 'Malaysia',
      'telenor-mm': 'Myanmar',
      'telenor-no': 'Norway',
      'telenor-se': 'Sweden',
      'telenor-rs': 'Serbia',
      'voda-uk': 'United Kingdom',
      'vf-ie': 'Ireland',
      'three-uk': 'United Kingdom',
      'three-ie': 'Ireland',
      'mobile-ng': 'Nigeria',
      'axiata-lk': 'Sri Lanka',
      'viettel-mz': 'Mozambique',
      'umobile-my': 'Malaysia',
      'o2-uk': 'United Kingdom',
      'ee-uk': 'United Kingdom'
    };
    
    return countryMap[operatorCode] || 'Unknown';
  }
  
  /**
   * Get operator name by code
   */
  getOperatorName(operatorCode) {
    const nameMap = {
      'zain-kw': 'Zain Kuwait',
      'zain-sa': 'Zain Saudi Arabia',
      'zain-bh': 'Zain Bahrain',
      'zain-iq': 'Zain Iraq',
      'zain-jo': 'Zain Jordan',
      'zain-sd': 'Zain Sudan',
      'etisalat-ae': 'Etisalat UAE',
      'ooredoo-kw': 'Ooredoo Kuwait',
      'stc-kw': 'STC Kuwait',
      'telenor-dk': 'Telenor Denmark',
      'telenor-digi': 'Telenor Digi Malaysia',
      'telenor-mm': 'Telenor Myanmar',
      'telenor-no': 'Telenor Norway',
      'telenor-se': 'Telenor Sweden',
      'telenor-rs': 'Yettel Serbia',
      'voda-uk': 'Vodafone UK',
      'vf-ie': 'Vodafone Ireland',
      'three-uk': 'Three UK',
      'three-ie': 'Three Ireland',
      'mobile-ng': '9mobile Nigeria',
      'axiata-lk': 'Axiata Dialog Sri Lanka',
      'viettel-mz': 'Movitel Mozambique',
      'umobile-my': 'U Mobile Malaysia',
      'o2-uk': 'O2 UK',
      'ee-uk': 'EE UK'
    };
    
    return nameMap[operatorCode] || operatorCode;
  }
  
  /**
   * Sanitize response for logging (remove sensitive data)
   */
  sanitizeResponse(response) {
    if (!response || typeof response !== 'object') {
      return response;
    }
    
    const sensitiveFields = ['pin', 'password', 'token', 'secret', 'key', 'credential'];
    const sanitized = JSON.parse(JSON.stringify(response));
    
    const sanitizeObject = (obj) => {
      if (!obj || typeof obj !== 'object') return obj;
      
      Object.keys(obj).forEach(key => {
        if (sensitiveFields.some(field => key.toLowerCase().includes(field))) {
          obj[key] = '***';
        } else if (typeof obj[key] === 'object') {
          sanitizeObject(obj[key]);
        }
      });
    };
    
    sanitizeObject(sanitized);
    return sanitized;
  }
  
  /**
   * Add new operator mapping
   */
  addOperatorMapping(operatorCode, mapping) {
    this.operatorMappings[operatorCode] = mapping;
    Logger.info(`Added response mapping for operator: ${operatorCode}`);
  }
  
  /**
   * Update existing operator mapping
   */
  updateOperatorMapping(operatorCode, mapping) {
    if (this.operatorMappings[operatorCode]) {
      this.operatorMappings[operatorCode] = {
        ...this.operatorMappings[operatorCode],
        ...mapping
      };
      Logger.info(`Updated response mapping for operator: ${operatorCode}`);
    } else {
      this.addOperatorMapping(operatorCode, mapping);
    }
  }
  
  /**
   * Remove operator mapping
   */
  removeOperatorMapping(operatorCode) {
    if (this.operatorMappings[operatorCode]) {
      delete this.operatorMappings[operatorCode];
      Logger.info(`Removed response mapping for operator: ${operatorCode}`);
    }
  }
  
  /**
   * Get available operators with mappings
   */
  getAvailableOperators() {
    return Object.keys(this.operatorMappings).sort();
  }
  
  /**
   * Get mapping statistics
   */
  getMappingStatistics() {
    const operators = this.getAvailableOperators();
    const stats = {
      totalOperators: operators.length,
      byGroup: {
        zain: operators.filter(op => op.startsWith('zain-')).length,
        telenor: operators.filter(op => op.startsWith('telenor-')).length,
        vodafone: operators.filter(op => op.startsWith('voda-') || op.startsWith('vf-')).length,
        three: operators.filter(op => op.startsWith('three-')).length,
        other: operators.filter(op => 
          !op.startsWith('zain-') && 
          !op.startsWith('telenor-') && 
          !op.startsWith('voda-') && 
          !op.startsWith('vf-') && 
          !op.startsWith('three-')
        ).length
      },
      lastUpdated: new Date().toISOString()
    };
    
    return stats;
  }
}

module.exports = ResponseMapper;