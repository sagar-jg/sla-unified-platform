/**
 * Authentication Routes
 * 
 * Routes for user authentication, registration, and session management
 * Base URL: /api/auth
 */

const express = require('express');
const { body, validationResult } = require('express-validator');
const AuthController = require('../controllers/authController');
const { authenticateToken, optionalAuth, requireAdmin } = require('../middleware/auth');
const Logger = require('../utils/logger');

const router = express.Router();

/**
 * Validation middleware for error handling
 */
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    Logger.warn('Validation errors in auth request', {
      errors: errors.array(),
      endpoint: req.path,
      ip: req.ip
    });
    
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array().map(error => ({
        field: error.path || error.param,
        message: error.msg,
        value: error.value
      })),
      code: 'VALIDATION_ERROR'
    });
  }
  
  next();
};

/**
 * Validation rules for user registration
 */
const registrationValidation = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email is required'),
  
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'),
  
  body('firstName')
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('First name is required and must be between 1-50 characters'),
  
  body('lastName')
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Last name is required and must be between 1-50 characters'),
  
  body('role')
    .optional()
    .isIn(['admin', 'operator', 'viewer'])
    .withMessage('Role must be admin, operator, or viewer')
];

/**
 * Validation rules for login
 */
const loginValidation = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email is required'),
  
  body('password')
    .notEmpty()
    .withMessage('Password is required'),
  
  body('rememberMe')
    .optional()
    .isBoolean()
    .withMessage('Remember me must be a boolean value')
];

/**
 * Validation rules for password change
 */
const passwordChangeValidation = [
  body('currentPassword')
    .notEmpty()
    .withMessage('Current password is required'),
  
  body('newPassword')
    .isLength({ min: 8 })
    .withMessage('New password must be at least 8 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('New password must contain at least one uppercase letter, one lowercase letter, one number, and one special character')
];

// ===== PUBLIC AUTHENTICATION ROUTES (NO AUTH REQUIRED) =====

/**
 * POST /api/auth/login
 * @desc    Login user and create session
 * @access  Public
 * @body    { email, password, rememberMe? }
 */
router.post('/login', 
  loginValidation,
  handleValidationErrors,
  AuthController.login
);

/**
 * POST /api/auth/register
 * @desc    Register new user (admin only in most cases)
 * @access  Public (for first admin) / Admin (for additional users)
 * @body    { email, password, firstName, lastName, role? }
 */
router.post('/register',
  registrationValidation,
  handleValidationErrors,
  optionalAuth, // Allow optional auth to check if admin
  async (req, res, next) => {
    try {
      // Check if this is the first user (no admin exists)
      const { User } = require('../models');
      const adminCount = await User.count({ where: { role: 'admin', isActive: true } });
      
      // If no admin exists, allow registration
      // Otherwise, require admin authentication
      if (adminCount > 0 && (!req.user || req.user.role !== 'admin')) {
        return res.status(403).json({
          success: false,
          message: 'Admin privileges required to register new users',
          code: 'ADMIN_REQUIRED'
        });
      }
      
      next();
    } catch (error) {
      Logger.error('Error checking admin count for registration', {
        error: error.message,
        ip: req.ip
      });
      
      res.status(500).json({
        success: false,
        message: 'Error processing registration',
        code: 'REGISTRATION_CHECK_ERROR'
      });
    }
  },
  AuthController.register
);

/**
 * GET /api/auth/info
 * @desc    Get authentication system information
 * @access  Public
 */
router.get('/info', (req, res) => {
  res.json({
    success: true,
    data: {
      name: 'SLA Digital Platform Authentication',
      version: '1.0.0',
      features: {
        jwt_auth: true,
        session_management: true,
        role_based_access: true,
        password_requirements: {
          min_length: 8,
          requires_uppercase: true,
          requires_lowercase: true,
          requires_number: true,
          requires_special_char: true
        }
      },
      endpoints: {
        login: 'POST /api/auth/login',
        register: 'POST /api/auth/register',
        logout: 'POST /api/auth/logout',
        me: 'GET /api/auth/me',
        refresh: 'POST /api/auth/refresh',
        change_password: 'POST /api/auth/change-password',
        sessions: 'GET /api/auth/sessions'
      },
      roles: ['admin', 'operator', 'viewer']
    }
  });
});

// ===== PROTECTED AUTHENTICATION ROUTES (REQUIRE AUTH) =====

/**
 * POST /api/auth/logout
 * @desc    Logout user and revoke session
 * @access  Private
 */
router.post('/logout',
  authenticateToken,
  AuthController.logout
);

/**
 * GET /api/auth/me
 * @desc    Get current user information
 * @access  Private
 */
router.get('/me',
  authenticateToken,
  AuthController.me
);

/**
 * POST /api/auth/refresh
 * @desc    Refresh JWT token
 * @access  Private
 */
router.post('/refresh',
  authenticateToken,
  AuthController.refresh
);

/**
 * POST /api/auth/change-password
 * @desc    Change user password
 * @access  Private
 * @body    { currentPassword, newPassword }
 */
router.post('/change-password',
  authenticateToken,
  passwordChangeValidation,
  handleValidationErrors,
  AuthController.changePassword
);

/**
 * GET /api/auth/sessions
 * @desc    Get user's active sessions
 * @access  Private
 */
router.get('/sessions',
  authenticateToken,
  AuthController.getSessions
);

/**
 * DELETE /api/auth/sessions/:sessionId
 * @desc    Revoke specific session
 * @access  Private
 */
router.delete('/sessions/:sessionId',
  authenticateToken,
  AuthController.revokeSessionById
);

// ===== HEALTH CHECK AND STATISTICS =====

/**
 * GET /api/auth/health
 * @desc    Authentication system health check
 * @access  Public
 */
router.get('/health', async (req, res) => {
  try {
    const { User, Session } = require('../models');
    
    // Get basic statistics
    const stats = {
      total_users: await User.count(),
      active_users: await User.count({ where: { isActive: true } }),
      verified_users: await User.count({ where: { emailVerified: true } }),
      active_sessions: await Session.count({ where: { active: true } }),
      roles: {
        admin: await User.count({ where: { role: 'admin', isActive: true } }),
        operator: await User.count({ where: { role: 'operator', isActive: true } }),
        viewer: await User.count({ where: { role: 'viewer', isActive: true } })
      }
    };
    
    res.json({
      success: true,
      status: 'healthy',
      timestamp: new Date().toISOString(),
      data: {
        auth_system: 'operational',
        jwt_validation: 'working',
        session_management: 'working',
        password_hashing: 'working',
        statistics: stats
      }
    });
    
  } catch (error) {
    Logger.error('Auth health check error', {
      error: error.message,
      stack: error.stack
    });
    
    res.status(500).json({
      success: false,
      status: 'unhealthy',
      message: 'Authentication system health check failed',
      timestamp: new Date().toISOString()
    });
  }
});

// ===== ERROR HANDLING =====

/**
 * Global error handler for auth routes
 */
router.use((error, req, res, next) => {
  Logger.error('Authentication route error', {
    error: error.message,
    stack: error.stack,
    endpoint: req.path,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });
  
  res.status(500).json({
    success: false,
    message: 'Authentication system error',
    code: 'AUTH_SYSTEM_ERROR',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;