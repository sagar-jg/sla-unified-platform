/**
 * Health Check Routes
 * 
 * System health monitoring endpoints
 */

const express = require('express');
const { checkDatabaseHealth } = require('../database/connection');
const { redisManager } = require('../config/redis');
const Logger = require('../utils/logger');

const router = express.Router();

/**
 * @route   GET /health
 * @desc    Basic health check
 * @access  Public
 */
router.get('/', async (req, res) => {
  try {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: process.env.APP_VERSION || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      uptime: process.uptime(),
      memory: process.memoryUsage()
    };
    
    res.json(health);
  } catch (error) {
    Logger.error('Health check failed', {
      error: error.message,
      stack: error.stack
    });
    
    res.status(500).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * @route   GET /health/detailed
 * @desc    Detailed health check with dependencies
 * @access  Public
 */
router.get('/detailed', async (req, res) => {
  const startTime = Date.now();
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.APP_VERSION || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    uptime: process.uptime(),
    responseTime: 0,
    dependencies: {}
  };
  
  let overallHealthy = true;
  
  try {
    // Check database
    try {
      const dbHealth = await checkDatabaseHealth();
      health.dependencies.database = {
        status: dbHealth.healthy ? 'healthy' : 'unhealthy',
        ...dbHealth
      };
      if (!dbHealth.healthy) overallHealthy = false;
    } catch (error) {
      health.dependencies.database = {
        status: 'unhealthy',
        error: error.message
      };
      overallHealthy = false;
    }
    
    // Check Redis
    try {
      await redisManager.set('health_check', 'ok', 10);
      const redisTest = await redisManager.get('health_check');
      health.dependencies.redis = {
        status: redisTest === 'ok' ? 'healthy' : 'unhealthy',
        connected: true
      };
    } catch (error) {
      health.dependencies.redis = {
        status: 'unhealthy',
        error: error.message,
        connected: false
      };
      overallHealthy = false;
    }
    
    // System resources
    const memUsage = process.memoryUsage();
    health.system = {
      memory: {
        used: Math.round(memUsage.heapUsed / 1024 / 1024),
        total: Math.round(memUsage.heapTotal / 1024 / 1024),
        external: Math.round(memUsage.external / 1024 / 1024),
        unit: 'MB'
      },
      cpu: {
        usage: process.cpuUsage()
      },
      nodeVersion: process.version,
      platform: process.platform,
      pid: process.pid
    };
    
    health.status = overallHealthy ? 'healthy' : 'degraded';
    health.responseTime = Date.now() - startTime;
    
    const statusCode = overallHealthy ? 200 : 503;
    res.status(statusCode).json(health);
    
  } catch (error) {
    Logger.error('Detailed health check failed', {
      error: error.message,
      stack: error.stack
    });
    
    res.status(500).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString(),
      responseTime: Date.now() - startTime
    });
  }
});

/**
 * @route   GET /health/ready
 * @desc    Kubernetes readiness probe
 * @access  Public
 */
router.get('/ready', async (req, res) => {
  try {
    // Quick database connectivity check
    const dbHealth = await checkDatabaseHealth();
    
    if (dbHealth.healthy) {
      res.status(200).json({
        status: 'ready',
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(503).json({
        status: 'not ready',
        reason: 'Database not accessible',
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    res.status(503).json({
      status: 'not ready',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * @route   GET /health/live
 * @desc    Kubernetes liveness probe
 * @access  Public
 */
router.get('/live', (req, res) => {
  res.status(200).json({
    status: 'alive',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

module.exports = router;