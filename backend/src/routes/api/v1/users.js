/**
 * User Management Routes
 * 
 * Admin routes for managing platform users
 * Base URL: /api/v1/users
 */

const express = require('express');
const { body, query, param, validationResult } = require('express-validator');
const { User, Session, AuditLog } = require('../../models');
const { requireAdmin, requireOperatorAccess } = require('../../middleware/auth');
const { operatorActionLogger } = require('../../middleware/logging');
const Logger = require('../../utils/logger');

const router = express.Router();

/**
 * Validation middleware for error handling
 */
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array().map(error => ({
        field: error.path || error.param,
        message: error.msg,
        value: error.value
      }))
    });
  }
  
  next();
};

/**
 * GET /api/v1/users
 * @desc    List all users with filtering and pagination
 * @access  Admin
 * @query   { page?, limit?, role?, status?, search? }
 */
router.get('/',
  requireAdmin,
  [
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1-100'),
    query('role').optional().isIn(['admin', 'operator', 'viewer']).withMessage('Invalid role'),
    query('status').optional().isIn(['active', 'inactive']).withMessage('Status must be active or inactive'),
    query('search').optional().isLength({ min: 1 }).withMessage('Search term required')
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { 
        page = 1, 
        limit = 20, 
        role, 
        status, 
        search 
      } = req.query;
      
      const offset = (parseInt(page) - 1) * parseInt(limit);
      
      // Build where clause
      const where = {};
      
      if (role) {
        where.role = role;
      }
      
      if (status) {
        where.isActive = status === 'active';
      }
      
      if (search) {
        const { Op } = require('sequelize');
        where[Op.or] = [
          { firstName: { [Op.iLike]: `%${search}%` } },
          { lastName: { [Op.iLike]: `%${search}%` } },
          { email: { [Op.iLike]: `%${search}%` } }
        ];
      }
      
      // Get users with pagination
      const { count, rows: users } = await User.findAndCountAll({
        where,
        limit: parseInt(limit),
        offset,
        order: [['createdAt', 'DESC']],
        attributes: { exclude: ['password', 'passwordResetToken', 'twoFactorSecret'] }
      });
      
      Logger.info('Users list requested', {
        requestedBy: req.user.id,
        filters: { role, status, search },
        page: parseInt(page),
        limit: parseInt(limit),
        totalFound: count
      });
      
      res.json({
        success: true,
        message: 'Users retrieved successfully',
        data: {
          users: users.map(user => ({
            ...user.toJSON(),
            fullName: user.getFullName()
          })),
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: count,
            pages: Math.ceil(count / parseInt(limit))
          }
        }
      });
      
    } catch (error) {
      Logger.error('Failed to list users', {
        error: error.message,
        stack: error.stack,
        requestedBy: req.user?.id
      });
      
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve users',
        code: 'LIST_USERS_ERROR'
      });
    }
  }
);

/**
 * GET /api/v1/users/:userId
 * @desc    Get specific user details
 * @access  Admin
 */
router.get('/:userId',
  requireAdmin,
  [
    param('userId').isUUID().withMessage('Valid user ID required')
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { userId } = req.params;
      
      const user = await User.findByPk(userId, {
        attributes: { exclude: ['password', 'passwordResetToken', 'twoFactorSecret'] },
        include: [
          {
            model: Session,
            as: 'sessions',
            where: { active: true },
            required: false,
            attributes: ['id', 'ipAddress', 'userAgent', 'createdAt', 'expiresAt', 'lastActivity']
          }
        ]
      });
      
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found',
          code: 'USER_NOT_FOUND'
        });
      }
      
      Logger.info('User details requested', {
        requestedBy: req.user.id,
        targetUserId: userId
      });
      
      res.json({
        success: true,
        message: 'User details retrieved successfully',
        data: {
          user: {
            ...user.toJSON(),
            fullName: user.getFullName(),
            activeSessions: user.sessions?.length || 0
          }
        }
      });
      
    } catch (error) {
      Logger.error('Failed to get user details', {
        error: error.message,
        stack: error.stack,
        requestedBy: req.user?.id,
        targetUserId: req.params.userId
      });
      
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve user details',
        code: 'GET_USER_ERROR'
      });
    }
  }
);

/**
 * POST /api/v1/users
 * @desc    Create new user
 * @access  Admin
 * @body    { email, password, firstName, lastName, role }
 */
router.post('/',
  requireAdmin,
  operatorActionLogger('createUser'),
  [
    body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
    body('firstName').trim().isLength({ min: 1, max: 50 }).withMessage('First name required (1-50 chars)'),
    body('lastName').trim().isLength({ min: 1, max: 50 }).withMessage('Last name required (1-50 chars)'),
    body('role').isIn(['admin', 'operator', 'viewer']).withMessage('Invalid role'),
    body('emailVerified').optional().isBoolean().withMessage('Email verified must be boolean')
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { email, password, firstName, lastName, role, emailVerified = false } = req.body;
      
      // Check if user already exists
      const existingUser = await User.findOne({ 
        where: { email: email.toLowerCase() } 
      });
      
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'User with this email already exists',
          code: 'USER_EXISTS'
        });
      }
      
      // Create user
      const user = await User.create({
        email: email.toLowerCase(),
        password,
        firstName,
        lastName,
        role,
        emailVerified,
        isActive: true
      });
      
      Logger.info('User created by admin', {
        createdBy: req.user.id,
        newUserId: user.id,
        email: user.email,
        role: user.role
      });
      
      res.status(201).json({
        success: true,
        message: 'User created successfully',
        data: {
          user: {
            ...user.toJSON(),
            fullName: user.getFullName()
          }
        }
      });
      
    } catch (error) {
      Logger.error('Failed to create user', {
        error: error.message,
        stack: error.stack,
        requestedBy: req.user?.id,
        requestData: {
          email: req.body.email?.substring(0, 3) + '***',
          role: req.body.role
        }
      });
      
      res.status(500).json({
        success: false,
        message: 'Failed to create user',
        code: 'CREATE_USER_ERROR'
      });
    }
  }
);

/**
 * PUT /api/v1/users/:userId
 * @desc    Update user details
 * @access  Admin
 * @body    { firstName?, lastName?, role?, emailVerified?, isActive? }
 */
router.put('/:userId',
  requireAdmin,
  operatorActionLogger('updateUser'),
  [
    param('userId').isUUID().withMessage('Valid user ID required'),
    body('firstName').optional().trim().isLength({ min: 1, max: 50 }).withMessage('First name (1-50 chars)'),
    body('lastName').optional().trim().isLength({ min: 1, max: 50 }).withMessage('Last name (1-50 chars)'),
    body('role').optional().isIn(['admin', 'operator', 'viewer']).withMessage('Invalid role'),
    body('emailVerified').optional().isBoolean().withMessage('Email verified must be boolean'),
    body('isActive').optional().isBoolean().withMessage('Is active must be boolean')
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { userId } = req.params;
      const updates = req.body;
      
      // Don't allow updating own role or status
      if (userId === req.user.id && (updates.role || updates.isActive === false)) {
        return res.status(400).json({
          success: false,
          message: 'Cannot modify your own role or deactivate your own account',
          code: 'SELF_MODIFICATION_DENIED'
        });
      }
      
      const user = await User.findByPk(userId);
      
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found',
          code: 'USER_NOT_FOUND'
        });
      }
      
      // Update user
      await user.update(updates);
      
      Logger.info('User updated by admin', {
        updatedBy: req.user.id,
        targetUserId: userId,
        updates: Object.keys(updates)
      });
      
      res.json({
        success: true,
        message: 'User updated successfully',
        data: {
          user: {
            ...user.toJSON(),
            fullName: user.getFullName()
          }
        }
      });
      
    } catch (error) {
      Logger.error('Failed to update user', {
        error: error.message,
        stack: error.stack,
        requestedBy: req.user?.id,
        targetUserId: req.params.userId
      });
      
      res.status(500).json({
        success: false,
        message: 'Failed to update user',
        code: 'UPDATE_USER_ERROR'
      });
    }
  }
);

/**
 * DELETE /api/v1/users/:userId
 * @desc    Deactivate user account
 * @access  Admin
 */
router.delete('/:userId',
  requireAdmin,
  operatorActionLogger('deactivateUser'),
  [
    param('userId').isUUID().withMessage('Valid user ID required')
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { userId } = req.params;
      
      // Don't allow deactivating own account
      if (userId === req.user.id) {
        return res.status(400).json({
          success: false,
          message: 'Cannot deactivate your own account',
          code: 'SELF_DEACTIVATION_DENIED'
        });
      }
      
      const user = await User.findByPk(userId);
      
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found',
          code: 'USER_NOT_FOUND'
        });
      }
      
      // Deactivate user and revoke sessions
      await user.deactivate();
      
      // Revoke all user sessions
      await Session.update(
        { active: false },
        { where: { userId } }
      );
      
      Logger.info('User deactivated by admin', {
        deactivatedBy: req.user.id,
        targetUserId: userId,
        targetEmail: user.email
      });
      
      res.json({
        success: true,
        message: 'User deactivated successfully',
        data: {
          user: {
            ...user.toJSON(),
            fullName: user.getFullName()
          }
        }
      });
      
    } catch (error) {
      Logger.error('Failed to deactivate user', {
        error: error.message,
        stack: error.stack,
        requestedBy: req.user?.id,
        targetUserId: req.params.userId
      });
      
      res.status(500).json({
        success: false,
        message: 'Failed to deactivate user',
        code: 'DEACTIVATE_USER_ERROR'
      });
    }
  }
);

/**
 * POST /api/v1/users/:userId/activate
 * @desc    Reactivate user account
 * @access  Admin
 */
router.post('/:userId/activate',
  requireAdmin,
  operatorActionLogger('activateUser'),
  [
    param('userId').isUUID().withMessage('Valid user ID required')
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { userId } = req.params;
      
      const user = await User.findByPk(userId);
      
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found',
          code: 'USER_NOT_FOUND'
        });
      }
      
      await user.activate();
      
      Logger.info('User activated by admin', {
        activatedBy: req.user.id,
        targetUserId: userId,
        targetEmail: user.email
      });
      
      res.json({
        success: true,
        message: 'User activated successfully',
        data: {
          user: {
            ...user.toJSON(),
            fullName: user.getFullName()
          }
        }
      });
      
    } catch (error) {
      Logger.error('Failed to activate user', {
        error: error.message,
        stack: error.stack,
        requestedBy: req.user?.id,
        targetUserId: req.params.userId
      });
      
      res.status(500).json({
        success: false,
        message: 'Failed to activate user',
        code: 'ACTIVATE_USER_ERROR'
      });
    }
  }
);

/**
 * GET /api/v1/users/statistics
 * @desc    Get user statistics
 * @access  Admin
 */
router.get('/statistics',
  requireOperatorAccess,
  async (req, res) => {
    try {
      const { Op } = require('sequelize');
      const now = new Date();
      const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);
      
      const stats = {
        total_users: await User.count(),
        active_users: await User.count({ where: { isActive: true } }),
        inactive_users: await User.count({ where: { isActive: false } }),
        verified_users: await User.count({ where: { emailVerified: true } }),
        recent_users: await User.count({ 
          where: { 
            createdAt: { [Op.gte]: thirtyDaysAgo } 
          } 
        }),
        active_sessions: await Session.count({ where: { active: true } }),
        roles: {
          admin: await User.count({ where: { role: 'admin', isActive: true } }),
          operator: await User.count({ where: { role: 'operator', isActive: true } }),
          viewer: await User.count({ where: { role: 'viewer', isActive: true } })
        }
      };
      
      res.json({
        success: true,
        message: 'User statistics retrieved successfully',
        data: {
          statistics: stats,
          timestamp: new Date().toISOString()
        }
      });
      
    } catch (error) {
      Logger.error('Failed to get user statistics', {
        error: error.message,
        stack: error.stack,
        requestedBy: req.user?.id
      });
      
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve user statistics',
        code: 'USER_STATS_ERROR'
      });
    }
  }
);

module.exports = router;