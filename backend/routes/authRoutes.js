
import express from 'express';
import rateLimit from 'express-rate-limit';

import {
  sendOTP,
  verifyEmailOTP,
} from '../controllers/authController.js';

import {
  saveCustomerProfile,
  getMyProfile,
} from '../controllers/customerController.js';

import {
  authenticateToken,
} from '../middleware/authMiddleware.js';

const router = express.Router();

const sendOTPLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many OTP requests. Please try again later.',
  },
});

const verifyOTPLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 15,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many verification requests. Please try later.',
  },
});

router.post('/send-otp', sendOTPLimiter, sendOTP);
router.post('/verify-otp', verifyOTPLimiter, verifyEmailOTP);

// Protected customer APIs
router.post('/customer/profile', authenticateToken, saveCustomerProfile);
router.get('/customer/me', authenticateToken, getMyProfile);

export default router;
