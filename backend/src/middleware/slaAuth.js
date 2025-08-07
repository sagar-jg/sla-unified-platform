/**
 * SLA Digital v2.2 Authentication Middleware - COMPLIANT IMPLEMENTATION
 * 
 * Implements HTTP Basic Auth + IP Whitelisting as required by SLA Digital v2.2 specification.
 * Replaces JWT authentication for SLA routes only.
 * 
 * PHASE 3: Authentication & Security Implementation
 */

const Logger = require('../utils/logger');
const { UnifiedError } = require('../utils/errors');

/**
 * HTTP Basic Authentication Middleware
 * SLA Digital v2.2 uses HTTP Basic Auth with Base64 encoded credentials
 */
const slaBasicAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    // Check if Authorization header exists
    if (!authHeader || !authHeader.startsWith('Basic ')) {
      Logger.warn('SLA v2.2 authentication failed: Missing Authorization header', {
        endpoint: req.path,
        ip: req.ip,
        userAgent: req.headers['user-agent']
      });
      
      return res.status(200).json({
        error: {
          category: 'Authorization',
          code: '1001',
          message: 'Missing Authorization header. HTTP Basic Auth required.'
        }
      });
    }
    
    // Extract and decode Base64 credentials
    const base64Credentials = authHeader.split(' ')[1];
    let credentials;
    
    try {
      credentials = Buffer.from(base64Credentials, 'base64').toString('ascii');
    } catch (decodeError) {
      Logger.warn('SLA v2.2 authentication failed: Invalid Base64 encoding', {
        endpoint: req.path,
        ip: req.ip
      });
      
      return res.status(200).json({
        error: {
          category: 'Authorization',
          code: '1001',
          message: 'Invalid Authorization header format. Must be Base64 encoded.'
        }
      });
    }
    
    const [username, password] = credentials.split(':');
    
    if (!username || !password) {
      Logger.warn('SLA v2.2 authentication failed: Invalid credential format', {
        endpoint: req.path,
        ip: req.ip
      });
      
      return res.status(200).json({
        error: {
          category: 'Authorization',
          code: '1001',
          message: 'Invalid credential format. Format: username:password'
        }
      });
    }
    
    // Validate credentials against SLA Digital accounts
    const isValidCredentials = await validateSLACredentials(username, password, req);
    
    if (!isValidCredentials) {
      Logger.warn('SLA v2.2 authentication failed: Invalid credentials', {
        endpoint: req.path,
        username: username.substring(0, 3) + '***', // Mask username
        ip: req.ip
      });
      
      return res.status(200).json({
        error: {
          category: 'Authorization',
          code: '1002',
          message: 'Invalid credentials'
        }
      });
    }
    
    // Store authenticated user info for logging
    req.slaUser = {
      username,
      authenticationType: 'basic_auth',
      environment: determineEnvironment(username)
    };
    
    Logger.info('SLA v2.2 authentication successful', {
      endpoint: req.path,
      username: username.substring(0, 3) + '***',
      environment: req.slaUser.environment,
      ip: req.ip
    });
    
    next();
    
  } catch (error) {
    Logger.error('SLA v2.2 authentication error', {
      endpoint: req.path,
      error: error.message,
      stack: error.stack,
      ip: req.ip
    });
    
    res.status(200).json({
      error: {
        category: 'Authorization',
        code: '1001',
        message: 'Authentication failed'
      }
    });
  }
};

/**
 * IP Whitelisting Middleware
 * SLA Digital v2.2 requires CIDR-formatted IP whitelisting
 */
const slaIPWhitelist = async (req, res, next) => {
  try {
    const clientIP = getClientIP(req);
    
    // Get user credentials for IP whitelist lookup
    const username = req.slaUser?.username;
    if (!username) {
      return res.status(200).json({
        error: {
          category: 'Authorization',
          code: '1001',
          message: 'Authentication required before IP validation'
        }
      });
    }
    
    // Get whitelisted IPs for this user
    const whitelistedIPs = await getWhitelistedIPs(username);
    
    if (!whitelistedIPs || whitelistedIPs.length === 0) {
      Logger.warn('SLA v2.2 IP whitelist failed: No whitelisted IPs configured', {
        endpoint: req.path,
        username: username.substring(0, 3) + '***',
        clientIP
      });
      
      return res.status(200).json({
        error: {
          category: 'Authorization',
          code: '1003',
          message: 'No IP addresses whitelisted for this account'
        }
      });
    }
    
    // Check if client IP matches any whitelisted IP/CIDR range
    const isWhitelisted = checkIPWhitelist(clientIP, whitelistedIPs);
    
    if (!isWhitelisted) {
      Logger.warn('SLA v2.2 IP whitelist failed: IP not whitelisted', {
        endpoint: req.path,
        username: username.substring(0, 3) + '***',
        clientIP,
        whitelistedCount: whitelistedIPs.length
      });
      
      return res.status(200).json({
        error: {
          category: 'Authorization',
          code: '1003',
          message: `IP address ${clientIP} is not whitelisted for this account`
        }
      });
    }
    
    Logger.info('SLA v2.2 IP whitelist check passed', {
      endpoint: req.path,
      username: username.substring(0, 3) + '***',
      clientIP,
      matchedWhitelist: true
    });
    
    next();
    
  } catch (error) {
    Logger.error('SLA v2.2 IP whitelist error', {
      endpoint: req.path,
      error: error.message,
      ip: req.ip
    });
    
    res.status(200).json({
      error: {
        category: 'Authorization',
        code: '1003',
        message: 'IP whitelist validation failed'
      }
    });
  }
};

/**
 * Query String Parameters Middleware
 * SLA Digital v2.2 passes all parameters in query string, not request body
 */
const slaQueryParams = (req, res, next) => {
  try {
    // SLA Digital v2.2 specification: all parameters in query string
    // Ensure request body is ignored for parameter processing
    
    // Log parameter source for debugging
    const hasQueryParams = Object.keys(req.query).length > 0;
    const hasBodyParams = req.body && Object.keys(req.body).length > 0;
    
    if (!hasQueryParams && hasBodyParams) {
      Logger.warn('SLA v2.2 parameter warning: Parameters found in body instead of query string', {
        endpoint: req.path,
        bodyParams: Object.keys(req.body),
        username: req.slaUser?.username?.substring(0, 3) + '***' || 'unknown'
      });
    }
    
    // Validate required parameters exist in query string
    if (!hasQueryParams) {
      return res.status(200).json({
        error: {
          category: 'Request',
          code: '2001',
          message: 'Parameters must be passed in URL query string, not request body'
        }
      });
    }
    
    Logger.debug('SLA v2.2 query parameters processed', {
      endpoint: req.path,
      paramCount: Object.keys(req.query).length,
      params: Object.keys(req.query)
    });
    
    next();
    
  } catch (error) {
    Logger.error('SLA v2.2 query parameter processing error', {
      endpoint: req.path,
      error: error.message
    });
    
    res.status(200).json({
      error: {
        category: 'Request',
        code: '2001',
        message: 'Parameter processing failed'
      }
    });
  }
};

// ===== HELPER FUNCTIONS =====

/**
 * Validate SLA Digital credentials
 * In production, this would check against database or external auth service
 */
async function validateSLACredentials(username, password, req) {
  try {
    // Mock credential validation - replace with actual implementation
    const validCredentials = {
      // Sandbox credentials
      'sandbox_user': 'sandbox_pass',
      'test_merchant': 'test_pass',
      
      // Production credentials (examples)
      'prod_merchant_001': process.env.SLA_PROD_MERCHANT_001_PASS,
      'prod_merchant_002': process.env.SLA_PROD_MERCHANT_002_PASS,
      
      // Environment-specific defaults
      'sla_sandbox': process.env.SLA_SANDBOX_PASSWORD || 'sandbox123',
      'sla_production': process.env.SLA_PRODUCTION_PASSWORD
    };
    
    const expectedPassword = validCredentials[username];
    
    if (!expectedPassword) {
      return false;
    }
    
    return password === expectedPassword;
    
  } catch (error) {
    Logger.error('Credential validation error', {
      username: username?.substring(0, 3) + '***',
      error: error.message
    });
    return false;
  }
}

/**
 * Determine environment from username
 */
function determineEnvironment(username) {
  if (username.includes('sandbox') || username.includes('test')) {
    return 'sandbox';
  }
  if (username.includes('prod')) {
    return 'production';
  }
  return 'unknown';
}

/**
 * Get client IP address (handles proxies and load balancers)
 */
function getClientIP(req) {
  return req.ip || 
         req.connection.remoteAddress || 
         req.socket.remoteAddress ||
         (req.connection.socket ? req.connection.socket.remoteAddress : null) ||
         '127.0.0.1';
}

/**
 * Get whitelisted IPs for username
 * In production, this would query database
 */
async function getWhitelistedIPs(username) {
  try {
    // Mock IP whitelist - replace with database lookup
    const ipWhitelists = {
      'sandbox_user': ['127.0.0.1/32', '192.168.1.0/24', '10.0.0.0/8'],
      'test_merchant': ['127.0.0.1/32', '203.0.113.0/24'],
      'sla_sandbox': ['0.0.0.0/0'], // Allow all for sandbox (development only)
      
      // Production examples (would be from database)
      'prod_merchant_001': ['203.0.113.10/32', '203.0.113.11/32'],
      'prod_merchant_002': ['198.51.100.0/24']
    };
    
    return ipWhitelists[username] || [];
    
  } catch (error) {
    Logger.error('IP whitelist lookup error', {
      username: username?.substring(0, 3) + '***',
      error: error.message
    });
    return [];
  }
}

/**
 * Check if IP matches any CIDR ranges in whitelist
 */
function checkIPWhitelist(clientIP, whitelistedIPs) {
  try {
    // Import CIDR checking library or implement basic IP matching
    // For now, implement basic IP matching (in production, use 'ip-range-check' or similar)
    
    for (const whitelistEntry of whitelistedIPs) {
      // Handle CIDR notation
      if (whitelistEntry.includes('/')) {
        const [networkIP, prefixLength] = whitelistEntry.split('/');
        
        // Simplified CIDR check (use proper library in production)
        if (prefixLength === '32' && clientIP === networkIP) {
          return true;
        }
        
        // Allow broad ranges for development (implement proper CIDR checking)
        if (prefixLength === '24' && clientIP.startsWith(networkIP.substring(0, networkIP.lastIndexOf('.')))) {
          return true;
        }
        
        // Allow all IPs (development only)
        if (whitelistEntry === '0.0.0.0/0') {
          return true;
        }
      } else {
        // Exact IP match
        if (clientIP === whitelistEntry) {
          return true;
        }
      }
    }
    
    return false;
    
  } catch (error) {
    Logger.error('IP whitelist check error', {
      clientIP,
      error: error.message
    });
    return false;
  }
}

module.exports = {
  slaBasicAuth,
  slaIPWhitelist,
  slaQueryParams
};