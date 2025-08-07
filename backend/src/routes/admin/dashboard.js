/**
 * Admin Dashboard Routes
 * 
 * /api/admin/dashboard - Dashboard analytics and metrics
 */

const express = require('express');
const dashboardController = require('../../controllers/dashboardController');
const { requireAdmin } = require('../../middleware/auth');

const router = express.Router();

/**
 * @route   GET /api/admin/dashboard/stats
 * @desc    Get dashboard statistics
 * @access  Private (admin only)
 */
router.get('/stats', 
  requireAdmin,
  dashboardController.getDashboardStats
);

/**
 * @route   GET /api/admin/dashboard/metrics
 * @desc    Get platform metrics
 * @access  Private (admin only)
 */
router.get('/metrics', 
  requireAdmin,
  dashboardController.getPlatformMetrics
);

/**
 * @route   GET /api/admin/dashboard/health
 * @desc    Get system health status
 * @access  Private (admin only)
 */
router.get('/health', 
  requireAdmin,
  dashboardController.getSystemHealth
);

/**
 * @route   GET /api/admin/dashboard/operators
 * @desc    Get operator dashboard data
 * @access  Private (admin only)
 */
router.get('/operators', 
  requireAdmin,
  dashboardController.getOperatorDashboard
);

/**
 * @route   GET /api/admin/dashboard/recent-activity
 * @desc    Get recent platform activity
 * @access  Private (admin only)
 */
router.get('/recent-activity', 
  requireAdmin,
  dashboardController.getRecentActivity
);

module.exports = router;