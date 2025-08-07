/**
 * Dashboard Controller
 * 
 * Handles dashboard analytics and metrics (admin only)
 */

const { getInstance: getOperatorManager } = require('../services/core/OperatorManager');
const { Operator, AuditLog } = require('../models');
const { asyncHandler } = require('../middleware/errorHandler');
const Logger = require('../utils/logger');

class DashboardController {
  constructor() {
    // 🔧 FIXED: Use singleton getInstance() instead of new OperatorManager()
    this.operatorManager = getOperatorManager();
  }
  
  /**
   * Get dashboard statistics
   */
  getDashboardStats = asyncHandler(async (req, res) => {
    try {
      // Get operator statistics
      const operatorStats = this.operatorManager.getOperatorStatistics();
      
      // Get transaction stats (dummy data for now - will be replaced with real DB queries)
      const transactionStats = {
        total: 15420,
        successful: 14256,
        failed: 1164,
        pending: 0,
        revenue: "125,430.50",
        successRate: 92.45,
        last24h: {
          total: 1250,
          successful: 1156,
          failed: 94
        }
      };
      
      // Get system health
      const systemHealth = {
        systemStatus: operatorStats.healthy > operatorStats.unhealthy ? 'healthy' : 'degraded',
        uptime: '99.8%',
        responseTime: 245,
        lastUpdate: new Date().toISOString()
      };
      
      res.json({
        success: true,
        data: {
          operators: operatorStats,
          transactions: transactionStats,
          health: systemHealth
        }
      });
      
    } catch (error) {
      Logger.error('Failed to get dashboard stats', {
        error: error.message,
        stack: error.stack,
        userId: req.user?.id
      });
      throw error;
    }
  });
  
  /**
   * Get platform metrics
   */
  getPlatformMetrics = asyncHandler(async (req, res) => {
    const { timeRange = '24h' } = req.query;
    
    // This would be replaced with real metrics from your monitoring system
    const metrics = {
      apiRequests: {
        total: 45230,
        successful: 44121,
        failed: 1109,
        averageResponseTime: 245
      },
      operatorHealth: {
        healthy: 18,
        unhealthy: 2,
        maintenance: 1,
        offline: 3
      },
      revenue: {
        today: "8,450.30",
        thisWeek: "52,340.80",
        thisMonth: "245,670.90",
        currency: "USD"
      },
      timeRange
    };
    
    res.json({
      success: true,
      data: metrics
    });
  });
  
  /**
   * Get system health status
   */
  getSystemHealth = asyncHandler(async (req, res) => {
    try {
      const operatorStats = this.operatorManager.getOperatorStatistics();
      
      const healthStatus = {
        overall: operatorStats.healthy > operatorStats.unhealthy ? 'healthy' : 'degraded',
        components: {
          database: 'healthy',
          redis: 'healthy',
          operators: operatorStats.healthy > operatorStats.unhealthy ? 'healthy' : 'degraded',
          api: 'healthy'
        },
        uptime: {
          percentage: 99.8,
          duration: '45d 12h 30m'
        },
        performance: {
          averageResponseTime: 245,
          requestsPerSecond: 125,
          errorRate: 0.02
        },
        lastUpdate: new Date().toISOString()
      };
      
      res.json({
        success: true,
        data: healthStatus
      });
      
    } catch (error) {
      Logger.error('Failed to get system health', {
        error: error.message,
        userId: req.user?.id
      });
      throw error;
    }
  });
  
  /**
   * Get operator dashboard data
   */
  getOperatorDashboard = asyncHandler(async (req, res) => {
    try {
      const operators = await this.operatorManager.getAllOperatorStatuses();
      const supportedOperators = this.operatorManager.getSupportedOperators();
      const stats = this.operatorManager.getOperatorStatistics();
      
      // Merge supported operators with current status
      const operatorData = supportedOperators.map(supported => {
        const current = operators.find(op => op.code === supported.code);
        return {
          ...supported,
          enabled: current?.enabled || false,
          healthScore: current?.healthScore || 0,
          lastHealthCheck: current?.lastHealthCheck || null,
          lastModified: current?.lastModified || null,
          disableReason: current?.disableReason || null,
          isOperational: current?.isOperational || false
        };
      });
      
      res.json({
        success: true,
        data: {
          operators: operatorData,
          statistics: stats,
          lastUpdate: new Date().toISOString()
        }
      });
      
    } catch (error) {
      Logger.error('Failed to get operator dashboard', {
        error: error.message,
        userId: req.user?.id
      });
      throw error;
    }
  });
  
  /**
   * Get recent platform activity
   */
  getRecentActivity = asyncHandler(async (req, res) => {
    const { limit = 20 } = req.query;
    
    try {
      const auditLogs = await AuditLog.findAll({
        include: [{
          model: require('../models').User,
          as: 'user',
          attributes: ['id', 'email', 'firstName', 'lastName']
        }],
        order: [['createdAt', 'DESC']],
        limit: Math.min(parseInt(limit), 50)
      });
      
      const activities = auditLogs.map(log => ({
        id: log.id,
        action: log.action,
        description: this.formatActivityDescription(log),
        user: log.user ? {
          id: log.user.id,
          email: log.user.email,
          name: log.user.getFullName()
        } : null,
        timestamp: log.createdAt,
        metadata: log.metadata
      }));
      
      res.json({
        success: true,
        data: activities
      });
      
    } catch (error) {
      Logger.error('Failed to get recent activity', {
        error: error.message,
        userId: req.user?.id
      });
      throw error;
    }
  });
  
  /**
   * Format activity description for display
   */
  formatActivityDescription(log) {
    const actions = {
      'OPERATOR_ENABLED': `Enabled operator ${log.resourceId}`,
      'OPERATOR_DISABLED': `Disabled operator ${log.resourceId}`,
      'SUBSCRIPTION_CREATED': `Created subscription ${log.resourceId}`,
      'SUBSCRIPTION_CANCELLED': `Cancelled subscription ${log.resourceId}`,
      'TRANSACTION_PROCESSED': `Processed transaction ${log.resourceId}`,
      'USER_LOGIN': 'User logged in',
      'USER_LOGOUT': 'User logged out'
    };
    
    return actions[log.action] || `${log.action} on ${log.resourceType} ${log.resourceId}`;
  }
}

module.exports = new DashboardController();