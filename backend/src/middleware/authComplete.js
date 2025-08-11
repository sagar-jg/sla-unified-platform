/**
 * Complete Authentication Middleware (Zero Manual Steps)
 * 
 * Fixed generateToken and createSession functions with all auth features
 */

const jwt = require('jsonwebtoken');
const { User, Session } = require('../models');
const Logger = require('../utils/logger');
const { AuthenticationError, AuthorizationError } = require('../utils/errors');

/**
 * Main authentication middleware
 */
const authenticateToken = async (req, res, next) => {
  try {
    const token = extractToken(req);
    
    if (!token) {
      throw new AuthenticationError('No authentication token provided');
    }
    
    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Check if session exists and is active
    const session = await Session.findOne({
      where: {
        token,
        active: true
      },
      include: [{
        model: User,
        as: 'user',
        where: { isActive: true }  // ✅ FIXED: Use isActive instead of status
      }]
    });
    
    if (!session || session.isExpired()) {
      throw new AuthenticationError('Invalid or expired token');
    }
    
    // Attach user and session to request
    req.user = session.user;
    req.session = session;
    req.token = token;
    
    Logger.debug('User authenticated successfully', {
      userId: req.user.id,
      email: req.user.email,
      role: req.user.role
    });
    
    next();
    
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      Logger.warn('Invalid JWT token', {
        error: error.message,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });
      return res.status(401).json({
        error: {
          code: 'INVALID_TOKEN',
          message: 'Invalid authentication token'
        }
      });
    }
    
    if (error instanceof AuthenticationError) {
      Logger.warn('Authentication failed', {
        error: error.message,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });
      return res.status(401).json(error.toJSON());
    }
    
    Logger.error('Authentication middleware error', {
      error: error.message,
      stack: error.stack,
      ip: req.ip
    });
    
    return res.status(500).json({
      error: {
        code: 'AUTHENTICATION_ERROR',
        message: 'Authentication system error'
      }
    });
  }
};

/**
 * Role-based authorization middleware
 */
const authorize = (requiredRoles) => {
  return (req, res, next) => {
    try {
      if (!req.user) {
        throw new AuthenticationError('User not authenticated');
      }
      
      const userRole = req.user.role;
      const rolesArray = Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles];
      
      if (!rolesArray.includes(userRole)) {
        throw new AuthorizationError(`Insufficient permissions. Required: ${rolesArray.join(' or ')}, Found: ${userRole}`);
      }
      
      Logger.debug('User authorized successfully', {
        userId: req.user.id,
        userRole,
        requiredRoles: rolesArray
      });
      
      next();
      
    } catch (error) {
      if (error instanceof AuthorizationError) {
        Logger.warn('Authorization failed', {
          userId: req.user?.id,
          userRole: req.user?.role,
          requiredRoles,
          error: error.message
        });
        return res.status(403).json(error.toJSON());
      }
      
      Logger.error('Authorization middleware error', {
        error: error.message,
        stack: error.stack,
        userId: req.user?.id
      });
      
      return res.status(500).json({
        error: {
          code: 'AUTHORIZATION_ERROR',
          message: 'Authorization system error'
        }
      });
    }
  };
};

/**
 * Admin-only authorization middleware
 */
const requireAdmin = authorize(['admin']);

/**
 * Admin or operator authorization middleware
 */
const requireOperatorAccess = authorize(['admin', 'operator']);

/**
 * Optional authentication (doesn't fail if no token)
 */
const optionalAuth = async (req, res, next) => {
  try {
    const token = extractToken(req);
    
    if (!token) {
      return next();
    }
    
    // Try to authenticate, but don't fail if token is invalid
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const session = await Session.findOne({
      where: {
        token,
        active: true
      },
      include: [{
        model: User,
        as: 'user',
        where: { isActive: true }  // ✅ FIXED: Use isActive instead of status
      }]
    });
    
    if (session && !session.isExpired()) {
      req.user = session.user;
      req.session = session;
      req.token = token;
    }
    
    next();
    
  } catch (error) {
    // Log the error but continue without authentication
    Logger.debug('Optional authentication failed', {
      error: error.message,
      ip: req.ip
    });
    next();
  }
};

/**
 * Extract token from request headers or query params
 */
function extractToken(req) {
  const authHeader = req.get('Authorization');
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  
  // Fallback to query parameter (less secure, for development only)
  if (process.env.NODE_ENV === 'development' && req.query.token) {
    return req.query.token;
  }
  
  return null;
}

/**
 * Generate JWT token for user
 * ✅ FIXED: Now accepts expiresIn parameter
 */
const generateToken = (user, expiresIn = '24h') => {
  const payload = {
    userId: user.id,
    email: user.email,
    role: user.role,
    iat: Math.floor(Date.now() / 1000)
  };
  
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: expiresIn || process.env.JWT_EXPIRES_IN || '24h'
  });
};

/**
 * Create session in database
 * ✅ FIXED: Now accepts rememberMe parameter
 */
const createSession = async (user, token, req, rememberMe = false) => {
  const expiresAt = new Date();
  
  // Set expiration based on remember me preference
  if (rememberMe) {
    expiresAt.setDate(expiresAt.getDate() + 30); // 30 days
  } else {
    expiresAt.setHours(expiresAt.getHours() + 24); // 24 hours
  }
  
  const session = await Session.create({
    userId: user.id,
    token,
    expiresAt,
    ipAddress: req.ip,
    userAgent: req.get('User-Agent'),
    rememberMe: rememberMe || false
  });
  
  return session;
};

/**
 * Revoke session
 */
const revokeSession = async (token) => {
  const session = await Session.findOne({ where: { token } });
  
  if (session) {
    await session.revoke();
    return true;
  }
  
  return false;
};

module.exports = {
  authenticateToken,
  authenticate: authenticateToken,
  authorize,
  requireAdmin,
  requireOperatorAccess,
  optionalAuth,
  generateToken,
  createSession,
  revokeSession
};