const {
  OTP_EXPIRY_SECONDS,
} = require("./otpConfig");

function generateOTP() {
  const otp = Math.floor(
    100000 + Math.random() * 900000
  ).toString();

  return {
    otp,
    expiresAt: new Date(Date.now() + OTP_EXPIRY_SECONDS * 1000),
  };
}

module.exports = generateOTP;
