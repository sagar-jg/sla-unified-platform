/**
 * Header Enrichment Service
 * 
 * Handles header enrichment parsing and validation for carrier billing.
 * Extracts subscriber information from enriched HTTP headers provided by operators.
 */

const Logger = require('../../utils/logger');
const { UnifiedError } = require('../../utils/errors');

class HeaderEnrichmentService {
  constructor() {
    // Map of header names to standardized fields
    this.headerMappings = {
      // Standard 3GPP headers
      'x-msisdn': 'msisdn',
      'x-wap-3gpp-msisdn': 'msisdn',
      'x-wap-profile': 'wapProfile',
      'x-wap-3gpp-imsi': 'imsi',
      'x-wap-3gpp-sgsn-mcc-mnc': 'networkCodes',
      'x-wap-3gpp-sgsn-address': 'gatewayIP',
      'x-wap-3gpp-rat-type': 'ratType',
      'x-wap-3gpp-user-class': 'userClass',
      'x-wap-3gpp-charging-id': 'chargingId',
      
      // Operator-specific headers
      'x-operator-msisdn': 'msisdn',
      'x-subscriber-id': 'subscriberId',
      'x-network-code': 'networkCode',
      'x-gateway-ip': 'gatewayIP',
      'x-user-agent-profile': 'userAgentProfile',
      
      // Zain specific headers
      'x-zain-msisdn': 'msisdn',
      'x-zain-subscriber': 'subscriberId',
      
      // Telenor specific headers
      'x-telenor-msisdn': 'msisdn',
      'x-telenor-acr': 'acr',
      
      // Vodafone specific headers
      'x-vodafone-msisdn': 'msisdn',
      'x-vf-subscriber': 'subscriberId',
      
      // Three specific headers
      'x-three-msisdn': 'msisdn',
      'x-hutchison-subscriber': 'subscriberId'
    };
  }
  
  /**
   * Parse enriched headers from HTTP request
   */
  parseEnrichedHeaders(headers) {
    try {
      const enrichedData = {
        msisdn: null,
        imsi: null,
        subscriberId: null,
        acr: null,
        networkCodes: null,
        networkCode: null,
        gatewayIP: null,
        ratType: null,
        userClass: null,
        chargingId: null,
        userAgentProfile: null,
        wapProfile: null,
        raw: {}
      };
      
      // Process all headers
      for (const [headerName, headerValue] of Object.entries(headers)) {
        const normalizedHeader = headerName.toLowerCase();
        const mappedField = this.headerMappings[normalizedHeader];
        
        if (mappedField && headerValue) {
          enrichedData[mappedField] = this.sanitizeHeaderValue(headerValue);
          enrichedData.raw[normalizedHeader] = headerValue;
        }
        
        // Also capture any x-* headers that might be operator-specific
        if (normalizedHeader.startsWith('x-') && !mappedField) {
          enrichedData.raw[normalizedHeader] = headerValue;
        }
      }
      
      // Post-process specific fields
      enrichedData.msisdn = this.normalizeMSISDN(enrichedData.msisdn);
      enrichedData.networkCodes = this.parseNetworkCodes(enrichedData.networkCodes);
      enrichedData.ratType = this.parseRatType(enrichedData.ratType);
      
      Logger.debug('Header enrichment parsed', {
        msisdnFound: !!enrichedData.msisdn,
        imsiFound: !!enrichedData.imsi,
        acrFound: !!enrichedData.acr,
        gatewayIP: enrichedData.gatewayIP,
        rawHeaderCount: Object.keys(enrichedData.raw).length
      });
      
      return enrichedData;
      
    } catch (error) {
      Logger.error('Failed to parse enriched headers', {
        error: error.message,
        stack: error.stack
      });
      
      throw new UnifiedError('HEADER_ENRICHMENT_ERROR', 
        'Failed to parse enriched headers', error);
    }
  }
  
  /**
   * Validate that sufficient enrichment data is present
   */
  validateEnrichment(enrichedData, operatorCode) {
    const validationRules = {
      // Zain operators require MSISDN for SDP
      'zain-kw': { required: ['msisdn'], optional: ['gatewayIP'] },
      'zain-sa': { required: ['msisdn'], optional: ['gatewayIP'] },
      'zain-bh': { required: ['msisdn'], optional: ['gatewayIP'] },
      'zain-jo': { required: ['msisdn'], optional: ['gatewayIP'] },
      'zain-iq': { required: ['msisdn'], optional: ['gatewayIP'] },
      'zain-sd': { required: ['msisdn'], optional: ['gatewayIP'] },
      
      // Telenor can use either MSISDN or ACR
      'telenor-dk': { oneOf: [['msisdn'], ['acr']], optional: ['networkCodes'] },
      'telenor-digi': { oneOf: [['msisdn'], ['acr']], optional: ['networkCodes'] },
      'telenor-mm': { oneOf: [['msisdn'], ['acr']], optional: ['networkCodes'] },
      'telenor-no': { oneOf: [['msisdn'], ['acr']], optional: ['networkCodes'] },
      'telenor-se': { oneOf: [['msisdn'], ['acr']], optional: ['networkCodes'] },
      'telenor-rs': { oneOf: [['msisdn'], ['acr']], optional: ['networkCodes'] },
      
      // UK operators prefer MSISDN
      'voda-uk': { required: ['msisdn'], optional: ['networkCodes', 'gatewayIP'] },
      'three-uk': { required: ['msisdn'], optional: ['networkCodes', 'gatewayIP'] },
      'o2-uk': { required: ['msisdn'], optional: ['networkCodes', 'gatewayIP'] },
      'ee-uk': { required: ['msisdn'], optional: ['networkCodes', 'gatewayIP'] },
      
      // Ireland operators
      'vf-ie': { required: ['msisdn'], optional: ['networkCodes'] },
      'three-ie': { required: ['msisdn'], optional: ['networkCodes'] },
      
      // Default validation
      'default': { oneOf: [['msisdn'], ['subscriberId'], ['acr']] }
    };
    
    const rules = validationRules[operatorCode] || validationRules.default;
    
    // Check required fields
    if (rules.required) {
      const missing = rules.required.filter(field => !enrichedData[field]);
      if (missing.length > 0) {
        throw new UnifiedError('INSUFFICIENT_ENRICHMENT', 
          `Required header enrichment fields missing: ${missing.join(', ')}`);
      }
    }
    
    // Check oneOf requirements (at least one group must be satisfied)
    if (rules.oneOf) {
      const satisfied = rules.oneOf.some(group => 
        group.every(field => enrichedData[field])
      );
      
      if (!satisfied) {
        const groupDescriptions = rules.oneOf.map(group => group.join(' and '));
        throw new UnifiedError('INSUFFICIENT_ENRICHMENT', 
          `At least one of the following field groups required: ${groupDescriptions.join(' OR ')}`);
      }
    }
    
    Logger.info('Header enrichment validation passed', {
      operatorCode,
      msisdnPresent: !!enrichedData.msisdn,
      acrPresent: !!enrichedData.acr,
      subscriberIdPresent: !!enrichedData.subscriberId
    });
    
    return true;
  }
  
  /**
   * Check if request has header enrichment
   */
  hasHeaderEnrichment(headers) {
    const enrichmentHeaders = Object.keys(headers).filter(header => {
      const normalized = header.toLowerCase();
      return this.headerMappings[normalized] || normalized.startsWith('x-');
    });
    
    return enrichmentHeaders.length > 0;
  }
  
  /**
   * Get subscriber identifier from enriched data
   */
  getSubscriberIdentifier(enrichedData) {
    // Priority: MSISDN > ACR > Subscriber ID
    return enrichedData.msisdn || enrichedData.acr || enrichedData.subscriberId;
  }
  
  /**
   * Sanitize header value
   */
  sanitizeHeaderValue(value) {
    if (typeof value !== 'string') return value;
    
    // Remove control characters and trim
    return value.replace(/[\x00-\x1F\x7F]/g, '').trim();
  }
  
  /**
   * Normalize MSISDN from header enrichment
   */
  normalizeMSISDN(msisdn) {
    if (!msisdn) return null;
    
    // Remove any non-digit characters except +
    let normalized = msisdn.replace(/[^\d+]/g, '');
    
    // Basic validation - should be at least 8 digits
    if (normalized.length < 8) {
      Logger.warn('Invalid MSISDN in header enrichment', { msisdn: '***' });
      return null;
    }
    
    return normalized;
  }
  
  /**
   * Parse network codes (MCC-MNC)
   */
  parseNetworkCodes(networkCodes) {
    if (!networkCodes) return null;
    
    // Format: MCC-MNC (e.g., "424-02" for UAE Etisalat)
    const match = networkCodes.match(/^(\d{3})-?(\d{2,3})$/);
    if (match) {
      return {
        mcc: match[1], // Mobile Country Code
        mnc: match[2], // Mobile Network Code
        combined: `${match[1]}-${match[2]}`
      };
    }
    
    return { raw: networkCodes };
  }
  
  /**
   * Parse RAT (Radio Access Technology) type
   */
  parseRatType(ratType) {
    if (!ratType) return null;
    
    const ratMappings = {
      '1': '2G/GSM',
      '2': '3G/UMTS',
      '3': '2G/GSM with GPRS',
      '4': '2G/GSM with EDGE',
      '5': '3G/UMTS with HSDPA',
      '6': '3G/UMTS with HSUPA',
      '7': '3G/UMTS with HSDPA and HSUPA',
      '8': '4G/LTE',
      '9': '5G/NR'
    };
    
    return {
      code: ratType,
      description: ratMappings[ratType] || 'Unknown',
      raw: ratType
    };
  }
  
  /**
   * Create header enrichment middleware
   */
  createMiddleware() {
    return (req, res, next) => {
      try {
        // Check if request has header enrichment
        if (this.hasHeaderEnrichment(req.headers)) {
          const enrichedData = this.parseEnrichedHeaders(req.headers);
          
          // Add to request object
          req.headerEnrichment = enrichedData;
          req.subscriberIdentified = !!this.getSubscriberIdentifier(enrichedData);
          
          // Add convenience methods
          req.getSubscriberIdentifier = () => this.getSubscriberIdentifier(enrichedData);
          req.validateEnrichment = (operatorCode) => this.validateEnrichment(enrichedData, operatorCode);
          
          Logger.debug('Header enrichment detected and parsed', {
            subscriberIdentified: req.subscriberIdentified,
            identifier: req.subscriberIdentified ? '***' : null,
            method: req.method,
            url: req.originalUrl
          });
        } else {
          req.headerEnrichment = null;
          req.subscriberIdentified = false;
        }
        
        next();
        
      } catch (error) {
        Logger.error('Header enrichment middleware error', {
          error: error.message,
          url: req.originalUrl,
          method: req.method
        });
        
        // Don't fail the request, just mark as no enrichment
        req.headerEnrichment = null;
        req.subscriberIdentified = false;
        next();
      }
    };
  }
}

module.exports = HeaderEnrichmentService;