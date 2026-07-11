const { OTP_EXPIRY_SECONDS } = require("./otpConfig");
const SibApiV3Sdk = require("sib-api-v3-sdk");

const client = SibApiV3Sdk.ApiClient.instance;

const apiKey = client.authentications["api-key"];
apiKey.apiKey = process.env.BREVO_API_KEY;

async function sendOTPEmail(email, otp) {
  try {
    const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();

    const result = await apiInstance.sendTransacEmail({
      sender: {
        email: "abhishekvermachirawa@gmail.com", // verified sender email
        name: "Expense Tracker",
      },
      to: [
        {
          email: email,
        },
      ],
      subject: "Your OTP Code",
      htmlContent: `
        <h2>Expense Tracker Login</h2>
        <p>Your OTP is:</p>
        <h1>${otp}</h1>
        <p>Valid for ${OTP_EXPIRY_SECONDS} seconds.</p>
      `,
    });

    console.log("Email sent:", result);
  } catch (error) {
    console.error("Error sending email:", error);
    throw error;
  }
}

module.exports = sendOTPEmail;