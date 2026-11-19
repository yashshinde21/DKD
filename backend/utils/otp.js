
import crypto from 'crypto';

export const generateOTP = () => {
  return crypto.randomInt(100000, 1000000).toString();
};

export const hashOTP = otp => {
  return crypto
    .createHmac('sha256', process.env.OTP_SECRET)
    .update(otp)
    .digest('hex');
};

export const verifyOTP = (otp, hashedOTP) => {
  const inputHash = Buffer.from(hashOTP(otp), 'hex');
  const storedHash = Buffer.from(hashedOTP, 'hex');

  return (
    inputHash.length === storedHash.length &&
    crypto.timingSafeEqual(inputHash, storedHash)
  );
};
