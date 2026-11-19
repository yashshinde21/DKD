
import jwt from 'jsonwebtoken';
import {generateOTP, hashOTP, verifyOTP} from '../utils/otp.js';
import {sendOTPEmail} from '../config/email.js';

// Temporary OTP storage for prototype development
const otpStore = new Map();

const OTP_EXPIRY = 5 * 60 * 1000;
const RESEND_COOLDOWN = 60 * 1000;
const MAX_ATTEMPTS = 5;

// SEND OTP
export const sendOTP = async (req, res) => {
  try {
    const email = req.body.email?.trim().toLowerCase();

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email address is required.',
      });
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailPattern.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a valid email address.',
      });
    }

    const existing = otpStore.get(email);
    const now = Date.now();

    if (existing && now - existing.createdAt < RESEND_COOLDOWN) {
      return res.status(429).json({
        success: false,
        message: 'Please wait before requesting another OTP.',
      });
    }

    const otp = generateOTP();

    await sendOTPEmail(email, otp);

    otpStore.set(email, {
      hash: hashOTP(otp),
      expiresAt: now + OTP_EXPIRY,
      createdAt: now,
      attempts: 0,
    });

    return res.status(200).json({
      success: true,
      message: 'OTP sent successfully to your email.',
    });
  } catch (error) {
    console.error('Send OTP error:', error.message);

    return res.status(500).json({
      success: false,
      message: 'Unable to send OTP. Please try again.',
    });
  }
};

// VERIFY OTP
export const verifyEmailOTP = async (req, res) => {
  console.log('VERIFY OTP API HIT');
  console.log('Request body:', {
    email: req.body?.email,
    otpReceived: Boolean(req.body?.otp),
    otpLength: String(req.body?.otp || '').length,
  });

  try {
    const email = req.body.email?.trim().toLowerCase();
    const otp = String(req.body.otp || '').trim();

    if (!email || !/^\d{6}$/.test(otp)) {
      return res.status(400).json({
        success: false,
        message: 'Enter a valid email and six-digit OTP.',
      });
    }

    const record = otpStore.get(email);

    console.log('OTP record exists:', !!record);

if (record) {
  console.log('OTP expired:', Date.now() > record.expiresAt);
  console.log('Attempts:', record.attempts);
}

    if (!record) {
      return res.status(400).json({
        success: false,
        message: 'OTP not found. Please request a new OTP.',
      });
    }

    if (Date.now() > record.expiresAt) {
      otpStore.delete(email);

      return res.status(400).json({
        success: false,
        message: 'OTP expired. Please request a new OTP.',
      });
    }

    if (record.attempts >= MAX_ATTEMPTS) {
      otpStore.delete(email);

      return res.status(429).json({
        success: false,
        message: 'Maximum attempts reached. Request a new OTP.',
      });
    }

    const isValidOTP = verifyOTP(otp, record.hash);

console.log('OTP hash matched:', isValidOTP);

if (!isValidOTP) {
      record.attempts += 1;

      if (record.attempts >= MAX_ATTEMPTS) {
        otpStore.delete(email);
      }

      return res.status(400).json({
        success: false,
        message: 'Incorrect OTP. Please try again.',
        attemptsRemaining: Math.max(
          0,
          MAX_ATTEMPTS - record.attempts,
        ),
      });
    }

    // OTP is valid; remove it so it cannot be reused.
    otpStore.delete(email);

    const token = jwt.sign(
      {email},
      process.env.JWT_SECRET,
      {expiresIn: '7d'},
    );

    return res.status(200).json({
      success: true,
      message: 'Email verified successfully.',
      token,
      user: {
        email,
        isProfileComplete: false,
      },
    });
  } catch (error) {
  console.error('Verify OTP error:', error);

    return res.status(500).json({
      success: false,
      message: 'OTP verification failed. Please try again.',
    });
  }
};
