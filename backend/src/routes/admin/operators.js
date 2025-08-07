/**
 * Admin Operator Routes
 * 
 * /api/admin/operators - Operator management endpoints (admin only)
 */

const express = require('express');
const operatorController = require('../../controllers/operatorController');
const { requireAdmin } = require('../../middleware/auth');
const { operatorActionLogger } = require('../../middleware/logging');

const router = express.Router();

/**
 * @route   GET /api/admin/operators
 * @desc    Get all operators
 * @access  Private (admin only)
 */
router.get('/', 
  requireAdmin,
  operatorController.getAllOperators
);

/**
 * @route   GET /api/admin/operators/:code
 * @desc    Get specific operator details
 * @access  Private (admin only)
 */
router.get('/:code', 
  requireAdmin,
  operatorController.getOperator
);

/**
 * @route   PUT /api/admin/operators/:code/enable
 * @desc    Enable operator
 * @access  Private (admin only)
 */
router.put('/:code/enable', 
  requireAdmin,
  operatorActionLogger('enableOperator'),
  operatorController.enableOperator
);

/**
 * @route   PUT /api/admin/operators/:code/disable
 * @desc    Disable operator
 * @access  Private (admin only)
 */
router.put('/:code/disable', 
  requireAdmin,
  operatorActionLogger('disableOperator'),
  operatorController.disableOperator
);

/**
 * @route   POST /api/admin/operators/bulk/enable
 * @desc    Bulk enable operators
 * @access  Private (admin only)
 */
router.post('/bulk/enable', 
  requireAdmin,
  operatorActionLogger('bulkEnableOperators'),
  operatorController.enableAllOperators
);

/**
 * @route   GET /api/admin/operators/:code/stats
 * @desc    Get operator statistics
 * @access  Private (admin only)
 */
router.get('/:code/stats', 
  requireAdmin,
  operatorController.getOperatorStats
);

/**
 * @route   POST /api/admin/operators/:code/test
 * @desc    Test operator connectivity
 * @access  Private (admin only)
 */
router.post('/:code/test', 
  requireAdmin,
  operatorActionLogger('testOperator'),
  operatorController.testOperator
);

/**
 * @route   GET /api/admin/operators/:code/audit
 * @desc    Get operator audit logs
 * @access  Private (admin only)
 */
router.get('/:code/audit', 
  requireAdmin,
  operatorController.getOperatorAuditLogs
);

module.exports = router;