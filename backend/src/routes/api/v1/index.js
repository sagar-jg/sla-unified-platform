/**
 * API v1 Routes Index
 * 
 * Main router for all API version 1 endpoints
 */

const express = require('express');
const router = express.Router();

// Import all route modules
const operatorsRouter = require('./operators');
const subscriptionsRouter = require('./subscriptions');
const billingRouter = require('./billing');
const otpRouter = require('./otp');

// Mount sub-routers
router.use('/operators', operatorsRouter);
router.use('/subscriptions', subscriptionsRouter);
router.use('/billing', billingRouter);
router.use('/otp', otpRouter);

// Webhooks route (if exists, graceful fallback)
try {
  const webhooksRouter = require('./webhooks');
  router.use('/webhooks', webhooksRouter);
} catch (error) {
  console.warn('Webhooks route not found, skipping...');
  // Create placeholder webhook endpoint
  router.post('/webhooks/:operatorCode', (req, res) => {
    res.json({
      success: true,
      message: 'Webhook endpoint - implementation needed',
      operatorCode: req.params.operatorCode,
      received: true
    });
  });
}

// API info endpoint
router.get('/', (req, res) => {
  res.json({
    name: 'SLA Digital Unified Platform API',
    version: '1.0.0',
    description: 'Unified API for telecom operator integration',
    sla_compliance: 'v2.2',
    endpoints: {
      operators: '/api/v1/operators',
      subscriptions: '/api/v1/subscriptions',
      billing: '/api/v1/billing',
      otp: '/api/v1/otp',
      webhooks: '/api/v1/webhooks'
    },
    documentation: '/api/docs',
    timestamp: new Date().toISOString(),
    status: 'operational'
  });
});

// Health check for v1 API
router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    version: 'v1',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    routes: ['operators', 'subscriptions', 'billing', 'otp', 'webhooks']
  });
});

module.exports = router;