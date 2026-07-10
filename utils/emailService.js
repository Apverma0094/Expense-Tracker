const {
  OTP_EXPIRY_SECONDS,
} = require("./otpConfig");

const { Resend } = require("resend");
const resend = new Resend(process.env.RESEND_API_KEY);


await resend.emails.send({
  from: "onboarding@resend.dev",
  to: email,
  subject: "Your OTP Code",
  html: `
    <h2>Expense Tracker Login</h2>
    <p>Your OTP is:</p>
    <h1>${otp}</h1>
    <p>Valid for ${OTP_EXPIRY_SECONDS} seconds.</p>
  `,
});

module.exports = sendOTPEmail;
