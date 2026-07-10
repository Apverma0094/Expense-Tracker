const {
  OTP_EXPIRY_SECONDS,
} = require("./otpConfig");

const { Resend } = require("resend");

const resend = new Resend(process.env.RESEND_API_KEY);

async function sendOTPEmail(email, otp) {
  try {
    console.log("Sending OTP to:", email);

    const result = await resend.emails.send({
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

    console.log("Resend Result:", result);

  } catch (error) {
    console.error("Error sending email:", error);
    throw error;
  }
}

module.exports = sendOTPEmail;