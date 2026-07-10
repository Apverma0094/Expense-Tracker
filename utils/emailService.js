const {
  OTP_EXPIRY_SECONDS,
} = require("./otpConfig");

const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

async function sendOTPEmail(email, otp) {
  try {
    console.log("EMAIL_USER:", process.env.EMAIL_USER);
console.log("Starting email send...");
    await transporter.sendMail({
      from: process.env.EMAIL_USER,

      to: email,

      subject: "Your OTP Code",

      html: `
        <h2>Expense Tracker Login</h2>
        <p>Your OTP is:</p>
        <h1>${otp}</h1>
        <p>Valid for ${OTP_EXPIRY_SECONDS} seconds.</p>
      `,
    });

  } catch (error) {
    console.error(
      "Error sending email:",
      error
    );

    throw error;
  }
}

module.exports = sendOTPEmail;
