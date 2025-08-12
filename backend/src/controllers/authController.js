/**
 * Authentication Controller - FIXED VERSION
 * 
 * Handles user authentication, registration, and session management
 * Fixed field mapping issues between controller and User model
 */

const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { User, Session } = require('../models');
const { generateToken, createSession, revokeSession } = require('../middleware/auth');
const Logger = require('../utils/logger');
const { AuthenticationError, ValidationError } = require('../utils/errors');

class AuthController {
  /**
   * POST /api/auth/login
   * Authenticate user and create session
   */
  static async login(req, res) {
    try {
      const { email, password, rememberMe } = req.body;
      
      // Validate input
      if (!email || !password) {
        throw new ValidationError('Email and password are required');
      }
      
      // Find user
      const user = await User.findOne({ 
        where: { 
          email: email.toLowerCase(),
          isActive: true 
        } 
      });
      
      if (!user) {
        Logger.warn('Login attempt with non-existent email', {
          email: email.substring(0, 3) + '***',
          ip: req.ip,
          userAgent: req.get('User-Agent')
        });
        
        throw new AuthenticationError('Invalid email or password');
      }
      
      // Validate password
      const isValidPassword = await user.validatePassword(password);
      
      if (!isValidPassword) {
        Logger.warn('Login attempt with invalid password', {
          userId: user.id,
          email: email.substring(0, 3) + '***',
          ip: req.ip,
          userAgent: req.get('User-Agent')
        });
        
        throw new AuthenticationError('Invalid email or password');
      }
      
      // Generate JWT token
      const tokenExpiry = rememberMe ? '30d' : '24h';
      const token = generateToken(user, tokenExpiry);
      
      // Create session
      const session = await createSession(user, token, req);
      
      // Update user last login
      await user.updateLastLogin(req.ip);
      
      Logger.info('User logged in successfully', {
        userId: user.id,
        email: user.email,
        role: user.role,
        ip: req.ip,
        rememberMe: !!rememberMe
      });
      
      res.json({
        success: true,
        message: 'Login successful',
        data: {
          token,
          user: {
            id: user.id,
            email: user.email,
            name: user.name, // 🔧 FIX: Use name field
            firstName: user.firstName, // 🔧 FIX: Use computed getter
            lastName: user.lastName,   // 🔧 FIX: Use computed getter
            role: user.role,
            fullName: user.getFullName(),
            emailVerified: user.emailVerified,
            lastLoginAt: user.lastLoginAt
          },
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
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });
      
      if (error instanceof AuthenticationError || error instanceof ValidationError) {
        return res.status(error.statusCode || 401).json({
          success: false,
          message: error.message,
          code: error.code
        });
      }
      
      res.status(500).json({
        success: false,
        message: 'Internal server error during login',
        code: 'LOGIN_ERROR'
      });
    }
  }
  
  /**
   * POST /api/auth/register
   * Register new user (admin only or first user)
   */
  static async register(req, res) {
    try {
      const { email, password, firstName, lastName, name, role = 'viewer' } = req.body;
      
      // 🔧 FIX: Handle both name formats for backward compatibility
      let fullName = name;
      if (!fullName && firstName && lastName) {
        fullName = `${firstName} ${lastName}`;
      }
      if (!fullName && firstName) {
        fullName = firstName;
      }
      
      // Validate input
      if (!email || !password || !fullName) {
        throw new ValidationError('Email, password, and name are required');
      }
      
      if (password.length < 8) {
        throw new ValidationError('Password must be at least 8 characters long');
      }
      
      if (!['admin', 'operator', 'viewer'].includes(role)) {
        throw new ValidationError('Invalid role. Must be admin, operator, or viewer');
      }
      
      // Check if user already exists
      const existingUser = await User.findOne({ 
        where: { email: email.toLowerCase() } 
      });
      
      if (existingUser) {
        throw new ValidationError('User with this email already exists');
      }
      
      // Create user with single name field
      const user = await User.create({
        email: email.toLowerCase(),
        password,
        name: fullName.trim(), // 🔧 FIX: Use single name field
        role,
        emailVerified: false,
        isActive: true
      });
      
      Logger.info('New user registered', {
        userId: user.id,
        email: user.email,
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
            name: user.name,           // 🔧 FIX: Use name field
            firstName: user.firstName, // 🔧 FIX: Use computed getter
            lastName: user.lastName,   // 🔧 FIX: Use computed getter
            role: user.role,
            fullName: user.getFullName(),
            emailVerified: user.emailVerified,
            isActive: user.isActive
          }
        }
      });
      
    } catch (error) {
      Logger.error('Registration error', {
        error: error.message,
        stack: error.stack,
        ip: req.ip,
        requestData: {
          email: req.body.email?.substring(0, 3) + '***',
          role: req.body.role
        }
      });
      
      if (error instanceof ValidationError) {
        return res.status(400).json({
          success: false,
          message: error.message,
          code: 'VALIDATION_ERROR'
        });
      }
      
      res.status(500).json({
        success: false,
        message: 'Internal server error during registration',
        code: 'REGISTRATION_ERROR'
      });
    }
  }
  
  /**
   * POST /api/auth/logout
   * Logout user and revoke session
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
        userId: req.user?.id,
        ip: req.ip
      });
      
      res.status(500).json({
        success: false,
        message: 'Error during logout',
        code: 'LOGOUT_ERROR'
      });
    }
  }
  
  /**
   * GET /api/auth/me
   * Get current user information
   */
  static async me(req, res) {
    try {
      const user = req.user;
      
      if (!user) {
        throw new AuthenticationError('User not authenticated');
      }
      
      res.json({
        success: true,
        data: {
          user: {
            id: user.id,
            email: user.email,
            name: user.name,           // 🔧 FIX: Use name field
            firstName: user.firstName, // 🔧 FIX: Use computed getter
            lastName: user.lastName,   // 🔧 FIX: Use computed getter
            role: user.role,
            fullName: user.getFullName(),
            emailVerified: user.emailVerified,
            isActive: user.isActive,
            lastLoginAt: user.lastLoginAt,
            twoFactorEnabled: user.twoFactorEnabled,
            preferences: user.preferences,
            createdAt: user.createdAt
          }
        }
      });
      
    } catch (error) {
      Logger.error('Get user info error', {
        error: error.message,
        userId: req.user?.id
      });
      
      if (error instanceof AuthenticationError) {
        return res.status(401).json({
          success: false,
          message: error.message,
          code: 'AUTHENTICATION_ERROR'
        });
      }
      
      res.status(500).json({
        success: false,
        message: 'Error retrieving user information',
        code: 'USER_INFO_ERROR'
      });
    }
  }
  
  /**
   * POST /api/auth/refresh
   * Refresh JWT token
   */
  static async refresh(req, res) {
    try {
      const user = req.user;
      const oldToken = req.token;
      
      if (!user) {
        throw new AuthenticationError('User not authenticated');
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
            name: user.name,           // 🔧 FIX: Use name field
            firstName: user.firstName, // 🔧 FIX: Use computed getter
            lastName: user.lastName,   // 🔧 FIX: Use computed getter
            role: user.role,
            fullName: user.getFullName()
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
      
      if (error instanceof AuthenticationError) {
        return res.status(401).json({
          success: false,
          message: error.message,
          code: 'AUTHENTICATION_ERROR'
        });
      }
      
      res.status(500).json({
        success: false,
        message: 'Error refreshing token',
        code: 'REFRESH_ERROR'
      });
    }
  }
  
  /**
   * POST /api/auth/change-password
   * Change user password
   */
  static async changePassword(req, res) {
    try {
      const { currentPassword, newPassword } = req.body;
      const user = req.user;
      
      if (!currentPassword || !newPassword) {
        throw new ValidationError('Current password and new password are required');
      }
      
      if (newPassword.length < 8) {
        throw new ValidationError('New password must be at least 8 characters long');
      }
      
      // Validate current password
      const isValidPassword = await user.validatePassword(currentPassword);
      
      if (!isValidPassword) {
        throw new AuthenticationError('Current password is incorrect');
      }
      
      // Update password
      user.password = newPassword;
      await user.save();
      
      Logger.info('Password changed', {
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
        userId: req.user?.id,
        ip: req.ip
      });
      
      if (error instanceof ValidationError || error instanceof AuthenticationError) {
        return res.status(error.statusCode || 400).json({
          success: false,
          message: error.message,
          code: error.code
        });
      }
      
      res.status(500).json({
        success: false,
        message: 'Error changing password',
        code: 'CHANGE_PASSWORD_ERROR'
      });
    }
  }
  
  /**
   * GET /api/auth/sessions
   * Get user's active sessions
   */
  static async getSessions(req, res) {
    try {
      const user = req.user;
      
      const sessions = await Session.findAll({
        where: {
          userId: user.id,
          active: true
        },
        order: [['createdAt', 'DESC']],
        attributes: ['id', 'ipAddress', 'userAgent', 'createdAt', 'expiresAt', 'lastActivity']
      });
      
      res.json({
        success: true,
        data: {
          sessions: sessions.map(session => ({
            id: session.id,
            ipAddress: session.ipAddress,
            userAgent: session.userAgent,
            createdAt: session.createdAt,
            expiresAt: session.expiresAt,
            lastActivity: session.lastActivity,
            isCurrent: session.token === req.token
          }))
        }
      });
      
    } catch (error) {
      Logger.error('Get sessions error', {
        error: error.message,
        userId: req.user?.id
      });
      
      res.status(500).json({
        success: false,
        message: 'Error retrieving sessions',
        code: 'GET_SESSIONS_ERROR'
      });
    }
  }
  
  /**
   * DELETE /api/auth/sessions/:sessionId
   * Revoke specific session
   */
  static async revokeSessionById(req, res) {
    try {
      const { sessionId } = req.params;
      const user = req.user;
      
      const session = await Session.findOne({
        where: {
          id: sessionId,
          userId: user.id,
          active: true
        }
      });
      
      if (!session) {
        return res.status(404).json({
          success: false,
          message: 'Session not found',
          code: 'SESSION_NOT_FOUND'
        });
      }
      
      await session.revoke();
      
      Logger.info('Session revoked', {
        userId: user.id,
        sessionId,
        ip: req.ip
      });
      
      res.json({
        success: true,
        message: 'Session revoked successfully'
      });
      
    } catch (error) {
      Logger.error('Revoke session error', {
        error: error.message,
        userId: req.user?.id,
        sessionId: req.params.sessionId
      });
      
      res.status(500).json({
        success: false,
        message: 'Error revoking session',
        code: 'REVOKE_SESSION_ERROR'
      });
    }
  }
}

module.exports = AuthController;