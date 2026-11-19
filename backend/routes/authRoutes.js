
import express from 'express';
import rateLimit from 'express-rate-limit';

import {
  sendOTP,
  verifyEmailOTP,
} from '../controllers/authController.js';

const router = express.Router();

// Limit OTP requests per IP address
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

// Limit OTP verification attempts per IP
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

export default router;
