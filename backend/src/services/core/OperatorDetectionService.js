/**
 * MSISDN to Operator Mapping Service
 * 
 * Central service for determining operator from MSISDN/ACR identifiers.
 * Supports all 26 SLA Digital operators with comprehensive country code mapping.
 */

const Logger = require('../utils/logger');

class OperatorDetectionService {
  
  /**
   * Determine operator from identifier (MSISDN or ACR)
   */
  static async determineOperator(identifier, campaign = null) {
    try {
      // ACR is 48 characters - typically Telenor
      if (identifier && identifier.length === 48) {
        return OperatorDetectionService.determineTelenorOperator(identifier, campaign);
      }
      
      // MSISDN-based operator detection
      const normalizedMSISDN = OperatorDetectionService.normalizeMSISDN(identifier);
      return OperatorDetectionService.detectFromMSISDN(normalizedMSISDN, campaign);
      
    } catch (error) {
      Logger.warn('Operator detection failed', {
        identifier: identifier ? identifier.substring(0, 6) + '***' : 'unknown',
        error: error.message
      });
      
      // Fallback to campaign-based detection
      return OperatorDetectionService.detectFromCampaign(campaign);
    }
  }
  
  /**
   * Normalize MSISDN format
   */
  static normalizeMSISDN(identifier) {
    if (!identifier) return '';
    
    let normalized = identifier.replace(/[\s\-\(\)]/g, '');
    
    // Add + prefix if missing
    if (!normalized.startsWith('+')) {
      normalized = '+' + normalized;
    }
    
    return normalized;
  }
  
  /**
   * Determine Telenor operator from ACR and campaign
   */
  static determineTelenorOperator(acr, campaign) {
    if (!campaign) return 'telenor-mm'; // Default to Myanmar
    
    const campaignLower = campaign.toLowerCase();
    
    // Campaign-based Telenor operator detection
    if (campaignLower.includes('denmark') || campaignLower.includes('dk')) return 'telenor-dk';
    if (campaignLower.includes('norway') || campaignLower.includes('no')) return 'telenor-no';
    if (campaignLower.includes('sweden') || campaignLower.includes('se')) return 'telenor-se';
    if (campaignLower.includes('serbia') || campaignLower.includes('rs')) return 'telenor-rs';
    if (campaignLower.includes('malaysia') || campaignLower.includes('digi')) return 'telenor-digi';
    if (campaignLower.includes('myanmar') || campaignLower.includes('mm')) return 'telenor-mm';
    
    return 'telenor-mm'; // Default ACR to Myanmar
  }
  
  /**
   * Detect operator from MSISDN with comprehensive country code mapping
   */
  static detectFromMSISDN(normalizedMSISDN, campaign) {
    const operatorMappings = {
      // ===== MIDDLE EAST =====
      
      // Kuwait (+965)
      '+965': {
        '5': 'zain-kw',      // Zain Kuwait
        '6': 'zain-kw',      // Zain Kuwait  
        '9': 'ooredoo-kw',   // Ooredoo Kuwait
        '5555': 'stc-kw'     // STC Kuwait
      },
      
      // ✅ FIXED: Bahrain (+973) - WAS MISSING!
      '+973': {
        '3': 'zain-bh',      // Zain Bahrain
        '6': 'zain-bh',      // Zain Bahrain
        '1': 'zain-bh',      // Zain Bahrain
        '9': 'zain-bh'       // Default Bahrain to Zain
      },
      
      // UAE (+971)  
      '+971': {
        '50': 'etisalat-ae', // Etisalat UAE
        '52': 'etisalat-ae', // Etisalat UAE
        '54': 'etisalat-ae', // Etisalat UAE
        '56': 'etisalat-ae'  // Etisalat UAE
      },
      
      // Saudi Arabia (+966)
      '+966': {
        '50': 'zain-sa',     // Zain Saudi
        '51': 'mobily-sa',   // Mobily Saudi
        '52': 'zain-sa',     // Zain Saudi
        '53': 'mobily-sa',   // Mobily Saudi
        '54': 'zain-sa',     // Zain Saudi
        '55': 'mobily-sa',   // Mobily Saudi
        '56': 'zain-sa',     // Zain Saudi
        '57': 'mobily-sa',   // Mobily Saudi
        '58': 'zain-sa'      // Zain Saudi
      },
      
      // Iraq (+964)
      '+964': {
        '78': 'zain-iq',     // Zain Iraq
        '79': 'zain-iq'      // Zain Iraq
      },
      
      // Jordan (+962)
      '+962': {
        '77': 'zain-jo',     // Zain Jordan
        '78': 'zain-jo',     // Zain Jordan
        '79': 'zain-jo'      // Zain Jordan
      },
      
      // Sudan (+249)
      '+249': {
        '9': 'zain-sd',      // Zain Sudan
        '1': 'zain-sd'       // Zain Sudan
      },
      
      // ===== EUROPE =====
      
      // Denmark (+45)
      '+45': {
        '2': 'telenor-dk',   // Telenor Denmark
        '3': 'telenor-dk',   // Telenor Denmark
        '4': 'telenor-dk',   // Telenor Denmark
        '5': 'telenor-dk'    // Telenor Denmark
      },
      
      // Norway (+47)
      '+47': {
        '4': 'telenor-no',   // Telenor Norway
        '9': 'telenor-no'    // Telenor Norway
      },
      
      // Sweden (+46)
      '+46': {
        '70': 'telenor-se',  // Telenor Sweden
        '73': 'telenor-se',  // Telenor Sweden
        '76': 'telenor-se',  // Telenor Sweden
        '79': 'telenor-se'   // Telenor Sweden
      },
      
      // Serbia (+381)
      '+381': {
        '60': 'telenor-rs',  // Yettel Serbia
        '61': 'telenor-rs',  // Yettel Serbia
        '62': 'telenor-rs',  // Yettel Serbia
        '63': 'telenor-rs',  // Yettel Serbia
        '64': 'telenor-rs',  // Yettel Serbia
        '65': 'telenor-rs',  // Yettel Serbia
        '66': 'telenor-rs'   // Yettel Serbia
      },
      
      // UK (+44)
      '+44': {
        '771': 'voda-uk',    // Vodafone UK
        '772': 'voda-uk',    // Vodafone UK
        '781': 'three-uk',   // Three UK
        '782': 'three-uk',   // Three UK
        '741': 'o2-uk',      // O2 UK
        '742': 'o2-uk',      // O2 UK
        '751': 'ee-uk',      // EE UK
        '752': 'ee-uk'       // EE UK
      },
      
      // Ireland (+353)
      '+353': {
        '83': 'three-ie',    // Three Ireland
        '85': 'three-ie',    // Three Ireland
        '86': 'three-ie',    // Three Ireland
        '87': 'vf-ie',       // Vodafone Ireland
        '89': 'vf-ie'        // Vodafone Ireland
      },
      
      // ===== ASIA PACIFIC =====
      
      // Malaysia (+60)
      '+60': {
        '10': 'telenor-digi', // Telenor Digi Malaysia
        '11': 'telenor-digi', // Telenor Digi Malaysia
        '14': 'telenor-digi', // Telenor Digi Malaysia
        '16': 'telenor-digi', // Telenor Digi Malaysia
        '17': 'umobile-my',   // U Mobile Malaysia
        '18': 'umobile-my',   // U Mobile Malaysia
        '19': 'umobile-my'    // U Mobile Malaysia
      },
      
      // Myanmar (+95)
      '+95': {
        '9': 'telenor-mm'    // Telenor Myanmar
      },
      
      // Sri Lanka (+94)
      '+94': {
        '77': 'axiata-lk',   // Dialog Sri Lanka
        '76': 'axiata-lk',   // Dialog Sri Lanka
        '78': 'axiata-lk'    // Dialog Sri Lanka
      },
      
      // ===== AFRICA =====
      
      // Nigeria (+234)
      '+234': {
        '809': 'mobile-ng',  // 9mobile Nigeria
        '817': 'mobile-ng',  // 9mobile Nigeria
        '818': 'mobile-ng',  // 9mobile Nigeria
        '908': 'mobile-ng',  // 9mobile Nigeria
        '909': 'mobile-ng'   // 9mobile Nigeria
      },
      
      // Mozambique (+258)
      '+258': {
        '84': 'viettel-mz',  // Viettel Mozambique
        '85': 'viettel-mz'   // Viettel Mozambique
      }
    };
    
    // Find matching country code and operator
    for (const [countryCode, prefixMap] of Object.entries(operatorMappings)) {
      if (normalizedMSISDN.startsWith(countryCode)) {
        const remainingNumber = normalizedMSISDN.substring(countryCode.length);
        
        // Try different prefix lengths (3, 2, 1 digits)
        for (let len = 3; len >= 1; len--) {
          const prefix = remainingNumber.substring(0, len);
          if (prefixMap[prefix]) {
            Logger.debug('Operator detected from MSISDN', {
              countryCode,
              prefix,
              operator: prefixMap[prefix],
              msisdn: normalizedMSISDN.substring(0, 6) + '***'
            });
            return prefixMap[prefix];
          }
        }
        
        // Return first operator for country if no specific prefix match
        const defaultOperator = Object.values(prefixMap)[0];
        Logger.debug('Using default operator for country', {
          countryCode,
          operator: defaultOperator,
          msisdn: normalizedMSISDN.substring(0, 6) + '***'
        });
        return defaultOperator;
      }
    }
    
    // No country code match - try campaign-based detection
    return OperatorDetectionService.detectFromCampaign(campaign);
  }
  
  /**
   * Detect operator from campaign name as fallback
   */
  static detectFromCampaign(campaign) {
    if (!campaign) return 'zain-bh'; // Default to Zain Bahrain
    
    const campaignLower = campaign.toLowerCase();
    
    // Zain operators
    if (campaignLower.includes('zain')) {
      if (campaignLower.includes('kuwait') || campaignLower.includes('kw')) return 'zain-kw';
      if (campaignLower.includes('bahrain') || campaignLower.includes('bh')) return 'zain-bh';
      if (campaignLower.includes('saudi') || campaignLower.includes('sa')) return 'zain-sa';
      if (campaignLower.includes('iraq') || campaignLower.includes('iq')) return 'zain-iq';
      if (campaignLower.includes('jordan') || campaignLower.includes('jo')) return 'zain-jo';
      if (campaignLower.includes('sudan') || campaignLower.includes('sd')) return 'zain-sd';
      return 'zain-bh'; // Default Zain to Bahrain
    }
    
    // Other operators
    if (campaignLower.includes('etisalat')) return 'etisalat-ae';
    if (campaignLower.includes('mobily')) return 'mobily-sa';
    if (campaignLower.includes('ooredoo')) return 'ooredoo-kw';
    if (campaignLower.includes('stc')) return 'stc-kw';
    if (campaignLower.includes('telenor')) return 'telenor-mm';
    if (campaignLower.includes('three')) return 'three-uk';
    if (campaignLower.includes('vodafone')) return 'voda-uk';
    if (campaignLower.includes('umobile')) return 'umobile-my';
    if (campaignLower.includes('axiata') || campaignLower.includes('dialog')) return 'axiata-lk';
    if (campaignLower.includes('mobile') || campaignLower.includes('9mobile')) return 'mobile-ng';
    if (campaignLower.includes('viettel') || campaignLower.includes('movitel')) return 'viettel-mz';
    
    // Default fallback to Zain Bahrain (most commonly tested)
    Logger.debug('Using default operator fallback', {
      campaign,
      defaultOperator: 'zain-bh'
    });
    
    return 'zain-bh';
  }
  
  /**
   * Get operator information from code
   */
  static getOperatorInfo(operatorCode) {
    const operatorInfo = {
      'zain-kw': { name: 'Zain Kuwait', country: 'Kuwait', currency: 'KWD', countryCode: '+965' },
      'zain-bh': { name: 'Zain Bahrain', country: 'Bahrain', currency: 'BHD', countryCode: '+973' },
      'zain-sa': { name: 'Zain Saudi Arabia', country: 'Saudi Arabia', currency: 'SAR', countryCode: '+966' },
      'zain-iq': { name: 'Zain Iraq', country: 'Iraq', currency: 'IQD', countryCode: '+964' },
      'zain-jo': { name: 'Zain Jordan', country: 'Jordan', currency: 'JOD', countryCode: '+962' },
      'zain-sd': { name: 'Zain Sudan', country: 'Sudan', currency: 'SDG', countryCode: '+249' },
      'etisalat-ae': { name: 'Etisalat UAE', country: 'UAE', currency: 'AED', countryCode: '+971' },
      'mobily-sa': { name: 'Mobily Saudi Arabia', country: 'Saudi Arabia', currency: 'SAR', countryCode: '+966' },
      'ooredoo-kw': { name: 'Ooredoo Kuwait', country: 'Kuwait', currency: 'KWD', countryCode: '+965' },
      'stc-kw': { name: 'STC Kuwait', country: 'Kuwait', currency: 'KWD', countryCode: '+965' },
      'telenor-dk': { name: 'Telenor Denmark', country: 'Denmark', currency: 'DKK', countryCode: '+45' },
      'telenor-no': { name: 'Telenor Norway', country: 'Norway', currency: 'NOK', countryCode: '+47' },
      'telenor-se': { name: 'Telenor Sweden', country: 'Sweden', currency: 'SEK', countryCode: '+46' },
      'telenor-rs': { name: 'Yettel Serbia', country: 'Serbia', currency: 'RSD', countryCode: '+381' },
      'telenor-mm': { name: 'Telenor Myanmar', country: 'Myanmar', currency: 'MMK', countryCode: '+95' },
      'telenor-digi': { name: 'Telenor Digi Malaysia', country: 'Malaysia', currency: 'MYR', countryCode: '+60' },
      'umobile-my': { name: 'U Mobile Malaysia', country: 'Malaysia', currency: 'MYR', countryCode: '+60' },
      'voda-uk': { name: 'Vodafone UK', country: 'United Kingdom', currency: 'GBP', countryCode: '+44' },
      'three-uk': { name: 'Three UK', country: 'United Kingdom', currency: 'GBP', countryCode: '+44' },
      'o2-uk': { name: 'O2 UK', country: 'United Kingdom', currency: 'GBP', countryCode: '+44' },
      'ee-uk': { name: 'EE UK', country: 'United Kingdom', currency: 'GBP', countryCode: '+44' },
      'three-ie': { name: 'Three Ireland', country: 'Ireland', currency: 'EUR', countryCode: '+353' },
      'vf-ie': { name: 'Vodafone Ireland', country: 'Ireland', currency: 'EUR', countryCode: '+353' },
      'axiata-lk': { name: 'Dialog Sri Lanka', country: 'Sri Lanka', currency: 'LKR', countryCode: '+94' },
      'mobile-ng': { name: '9mobile Nigeria', country: 'Nigeria', currency: 'NGN', countryCode: '+234' },
      'viettel-mz': { name: 'Viettel Mozambique', country: 'Mozambique', currency: 'MZN', countryCode: '+258' }
    };
    
    return operatorInfo[operatorCode] || { 
      name: 'Unknown Operator', 
      country: 'Unknown', 
      currency: 'USD', 
      countryCode: '+1' 
    };
  }
}

module.exports = OperatorDetectionService;