/**
 * Complete Authentication Controller (Zero Manual Steps)
 * 
 * Works with single 'name' field and provides full backward compatibility
 */

const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { validationResult } = require('express-validator');
const { User, Session } = require('../models');
const { generateToken, createSession, revokeSession } = require('../middleware/auth');
const Logger = require('../utils/logger');
const { ValidationError, AuthenticationError, NotFoundError } = require('../utils/errors');

class AuthControllerComplete {
  /**
   * User login
   */
  static async login(req, res) {
    try {
      const { email, password, rememberMe = false } = req.body;

      if (!email || !password) {
        return res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Email and password are required'
          }
        });
      }

      // Find user by email
      const user = await User.findOne({
        where: { 
          email: email.toLowerCase().trim(),
          isActive: true 
        }
      });

      if (!user || !(await user.validatePassword(password))) {
        Logger.warn('Failed login attempt', {
          email,
          ip: req.ip,
          userAgent: req.get('User-Agent')
        });
        
        return res.status(401).json({
          error: {
            code: 'INVALID_CREDENTIALS',
            message: 'Invalid email or password'
          }
        });
      }

      // Check email verification
      if (!user.emailVerified) {
        return res.status(401).json({
          error: {
            code: 'EMAIL_NOT_VERIFIED',
            message: 'Please verify your email address before logging in'
          }
        });
      }

      // Generate token with appropriate expiry
      const expiresIn = rememberMe ? '30d' : '24h';
      const token = generateToken(user, expiresIn);

      // Create session
      const session = await createSession(user, token, req, rememberMe);

      // Update last login
      await user.updateLastLogin(req.ip);

      Logger.info('User logged in successfully', {
        userId: user.id,
        email: user.email,
        role: user.role,
        rememberMe,
        ip: req.ip
      });

      res.json({
        success: true,
        message: 'Login successful',
        data: {
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            firstName: user.firstName,
            lastName: user.lastName,
            fullName: user.getFullName(),
            role: user.role,
            emailVerified: user.emailVerified,
            lastLoginAt: user.lastLoginAt
          },
          token,
          expiresIn,
          session: {
            id: session.id,
            expiresAt: session.expiresAt
          }
        }
      });

    } catch (error) {
      Logger.error('Login error', {
        error: error.message,
        stack: error.stack,
        email: req.body?.email,
        ip: req.ip
      });

      res.status(500).json({
        error: {
          code: 'LOGIN_ERROR',
          message: 'Login failed due to server error'
        }
      });
    }
  }

  /**
   * Create first admin user
   */
  static async createFirstAdmin(req, res) {
    try {
      // Check if any admin users exist
      const existingAdmin = await User.findOne({
        where: { role: 'admin' }
      });

      if (existingAdmin) {
        return res.status(400).json({
          error: {
            code: 'ADMIN_EXISTS',
            message: 'Admin user already exists. Registration disabled.'
          }
        });
      }

      const { email, password, firstName, lastName, name } = req.body;

      if (!email || !password) {
        return res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Email and password are required'
          }
        });
      }

      // Handle name field - accept either single name or firstName+lastName
      const fullName = name || `${firstName || ''} ${lastName || ''}`.trim();
      
      if (!fullName) {
        return res.status(400).json({
          error: {
            code: 'NAME_REQUIRED',
            message: 'Name is required (either name field or firstName/lastName)'
          }
        });
      }

      // Check if user with email exists
      const existingUser = await User.findOne({
        where: { email: email.toLowerCase().trim() }
      });

      if (existingUser) {
        return res.status(400).json({
          error: {
            code: 'EMAIL_EXISTS',
            message: 'User with this email already exists'
          }
        });
      }

      // Create first admin user (email pre-verified)
      const user = await User.create({
        email: email.toLowerCase().trim(),
        password,
        name: fullName,
        role: 'admin',
        emailVerified: true,
        emailVerifiedAt: new Date(),
        isActive: true
      });

      Logger.info('First admin user created', {
        userId: user.id,
        email: user.email,
        name: user.name,
        ip: req.ip
      });

      res.status(201).json({
        success: true,
        message: 'First admin user created successfully',
        data: {
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            firstName: user.firstName,
            lastName: user.lastName,
            role: user.role,
            emailVerified: user.emailVerified
          }
        }
      });

    } catch (error) {
      Logger.error('Create first admin error', {
        error: error.message,
        stack: error.stack,
        email: req.body?.email,
        ip: req.ip
      });

      res.status(500).json({
        error: {
          code: 'REGISTRATION_ERROR',
          message: 'Failed to create admin user'
        }
      });
    }
  }

  /**
   * Register new user (admin only)
   */
  static async register(req, res) {
    try {
      const { email, password, firstName, lastName, name, role = 'viewer' } = req.body;
      
      if (!email || !password) {
        return res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Email and password are required'
          }
        });
      }
      
      // Handle name field
      const fullName = name || `${firstName || ''} ${lastName || ''}`.trim();
      
      if (!fullName) {
        return res.status(400).json({
          error: {
            code: 'NAME_REQUIRED',
            message: 'Name is required (either name field or firstName/lastName)'
          }
        });
      }
      
      if (password.length < 8) {
        return res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Password must be at least 8 characters long'
          }
        });
      }
      
      if (!['admin', 'operator', 'viewer'].includes(role)) {
        return res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid role. Must be admin, operator, or viewer'
          }
        });
      }
      
      // Check if user already exists
      const existingUser = await User.findOne({ 
        where: { email: email.toLowerCase() } 
      });
      
      if (existingUser) {
        return res.status(400).json({
          error: {
            code: 'EMAIL_EXISTS',
            message: 'User with this email already exists'
          }
        });
      }
      
      // Create user (email not verified by default)
      const user = await User.create({
        email: email.toLowerCase(),
        password,
        name: fullName,
        role,
        emailVerified: false,
        isActive: true
      });
      
      Logger.info('New user registered', {
        userId: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        createdBy: req.user?.id || 'system',
        ip: req.ip
      });
      
      res.status(201).json({
        success: true,
        message: 'User registered successfully',
        data: {
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            firstName: user.firstName,
            lastName: user.lastName,
            fullName: user.getFullName(),
            role: user.role,
            emailVerified: user.emailVerified,
            isActive: user.isActive
          }
        }
      });
      
    } catch (error) {
      Logger.error('Registration error', {
        error: error.message,
        stack: error.stack,
        ip: req.ip
      });
      
      res.status(500).json({
        error: {
          code: 'REGISTRATION_ERROR',
          message: 'Internal server error during registration'
        }
      });
    }
  }

  /**
   * User logout
   */
  static async logout(req, res) {
    try {
      const token = req.token;

      if (token) {
        await revokeSession(token);
        
        Logger.info('User logged out', {
          userId: req.user?.id,
          email: req.user?.email,
          ip: req.ip
        });
      }

      res.json({
        success: true,
        message: 'Logout successful'
      });

    } catch (error) {
      Logger.error('Logout error', {
        error: error.message,
        stack: error.stack,
        userId: req.user?.id,
        ip: req.ip
      });

      res.status(500).json({
        error: {
          code: 'LOGOUT_ERROR',
          message: 'Logout failed'
        }
      });
    }
  }

  /**
   * Get current user info
   */
  static async me(req, res) {
    try {
      const user = req.user;

      res.json({
        success: true,
        data: {
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            firstName: user.firstName,
            lastName: user.lastName,
            fullName: user.getFullName(),
            role: user.role,
            emailVerified: user.emailVerified,
            emailVerifiedAt: user.emailVerifiedAt,
            lastLoginAt: user.lastLoginAt,
            lastLoginIp: user.lastLoginIp,
            twoFactorEnabled: user.twoFactorEnabled,
            isActive: user.isActive,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt
          },
          session: {
            id: req.session.id,
            expiresAt: req.session.expiresAt,
            ipAddress: req.session.ipAddress,
            userAgent: req.session.userAgent,
            createdAt: req.session.createdAt
          }
        }
      });

    } catch (error) {
      Logger.error('Get user info error', {
        error: error.message,
        stack: error.stack,
        userId: req.user?.id
      });

      res.status(500).json({
        error: {
          code: 'USER_INFO_ERROR',
          message: 'Failed to get user information'
        }
      });
    }
  }

  /**
   * Change password
   */
  static async changePassword(req, res) {
    try {
      const { currentPassword, newPassword } = req.body;

      if (!currentPassword || !newPassword) {
        return res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Current password and new password are required'
          }
        });
      }

      const user = req.user;

      // Verify current password
      if (!(await user.validatePassword(currentPassword))) {
        return res.status(400).json({
          error: {
            code: 'INVALID_CURRENT_PASSWORD',
            message: 'Current password is incorrect'
          }
        });
      }

      // Update password
      user.password = newPassword;
      await user.save();

      // Revoke all other sessions for security
      await Session.update(
        { active: false },
        { 
          where: { 
            userId: user.id,
            token: { [require('sequelize').Op.ne]: req.token }
          }
        }
      );

      Logger.info('Password changed successfully', {
        userId: user.id,
        email: user.email,
        ip: req.ip
      });

      res.json({
        success: true,
        message: 'Password changed successfully'
      });

    } catch (error) {
      Logger.error('Change password error', {
        error: error.message,
        stack: error.stack,
        userId: req.user?.id,
        ip: req.ip
      });

      res.status(500).json({
        error: {
          code: 'PASSWORD_CHANGE_ERROR',
          message: 'Failed to change password'
        }
      });
    }
  }

  /**
   * Token refresh
   */
  static async refresh(req, res) {
    try {
      const user = req.user;
      const oldToken = req.token;
      
      if (!user) {
        return res.status(401).json({
          error: {
            code: 'AUTHENTICATION_ERROR',
            message: 'User not authenticated'
          }
        });
      }
      
      // Generate new token
      const newToken = generateToken(user);
      
      // Revoke old session and create new one
      await revokeSession(oldToken);
      const newSession = await createSession(user, newToken, req);
      
      Logger.info('Token refreshed', {
        userId: user.id,
        email: user.email,
        ip: req.ip
      });
      
      res.json({
        success: true,
        message: 'Token refreshed successfully',
        data: {
          token: newToken,
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            firstName: user.firstName,
            lastName: user.lastName,
            fullName: user.getFullName(),
            role: user.role
          },
          session: {
            id: newSession.id,
            expiresAt: newSession.expiresAt
          }
        }
      });
      
    } catch (error) {
      Logger.error('Token refresh error', {
        error: error.message,
        userId: req.user?.id,
        ip: req.ip
      });
      
      res.status(500).json({
        error: {
          code: 'REFRESH_ERROR',
          message: 'Error refreshing token'
        }
      });
    }
  }

  /**
   * Get all active sessions for current user
   */
  static async getSessions(req, res) {
    try {
      const sessions = await Session.findAll({
        where: {
          userId: req.user.id,
          active: true
        },
        order: [['createdAt', 'DESC']]
      });

      res.json({
        success: true,
        data: {
          sessions: sessions.map(session => ({
            id: session.id,
            ipAddress: session.ipAddress,
            userAgent: session.userAgent,
            expiresAt: session.expiresAt,
            createdAt: session.createdAt,
            isCurrent: session.token === req.token
          }))
        }
      });

    } catch (error) {
      Logger.error('Get sessions error', {
        error: error.message,
        stack: error.stack,
        userId: req.user?.id
      });

      res.status(500).json({
        error: {
          code: 'GET_SESSIONS_ERROR',
          message: 'Failed to get sessions'
        }
      });
    }
  }
}

module.exports = AuthControllerComplete;