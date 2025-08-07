/**
 * Admin Routes Index
 * 
 * Main router for admin endpoints
 */

const express = require('express');
const operatorsRouter = require('./operators');
const dashboardRouter = require('./dashboard');

const router = express.Router();

// Mount sub-routers
router.use('/operators', operatorsRouter);
router.use('/dashboard', dashboardRouter);

// Admin API info
router.get('/', (req, res) => {
  res.json({
    name: 'SLA Digital Unified Platform - Admin API',
    version: '1.0.0',
    description: 'Administrative endpoints for operator management',
    user: {
      id: req.user.id,
      email: req.user.email,
      role: req.user.role,
      name: req.user.getFullName()
    },
    endpoints: {
      operators: '/api/admin/operators',
      dashboard: '/api/admin/dashboard'
    },
    timestamp: new Date().toISOString()
  });
});

module.exports = router;