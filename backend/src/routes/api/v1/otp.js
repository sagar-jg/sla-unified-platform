/**
 * OTP/PIN API Routes
 * 
 * /api/v1/otp - OTP and PIN management endpoints
 */

const express = require('express');
const otpController = require('../../../controllers/otpController');
const { operatorActionLogger } = require('../../../middleware/logging');
const { requireOperatorAccess } = require('../../../middleware/auth');

const router = express.Router();

/**
 * @route   POST /api/v1/otp/generate
 * @desc    Generate PIN/OTP
 * @access  Private (operator+)
 */
router.post('/generate', 
  requireOperatorAccess,
  operatorActionLogger('generatePIN'),
  otpController.generatePIN
);

/**
 * @route   POST /api/v1/otp/verify
 * @desc    Verify PIN/OTP
 * @access  Private (operator+)
 */
router.post('/verify', 
  requireOperatorAccess,
  operatorActionLogger('verifyPIN'),
  otpController.verifyPIN
);

/**
 * @route   POST /api/v1/otp/eligibility
 * @desc    Check customer eligibility
 * @access  Private (operator+)
 */
router.post('/eligibility', 
  requireOperatorAccess,
  operatorActionLogger('checkEligibility'),
  otpController.checkEligibility
);

module.exports = router;