const SibApiV3Sdk = require('sib-api-v3-sdk');

const defaultClient = SibApiV3Sdk.ApiClient.instance;
const apiKey = defaultClient.authentications['api-key'];
apiKey.apiKey = process.env.BREVO_API_KEY;

const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();

const sendOTPEmail = async (toEmail, otp) => {
  try {
    await apiInstance.sendTransacEmail({
      sender: { email: 'janhavisonawane171@gmail.com', name: 'Synora' },
      to: [{ email: toEmail }],
      subject: 'Synora — Password Reset Code',
      htmlContent: `
        <div style="font-family: Arial, sans-serif; max-width: 400px; margin: auto;">
          <h2>Password Reset Request</h2>
          <p>Your verification code is:</p>
          <h1 style="letter-spacing: 4px;">${otp}</h1>
          <p>This code expires in 10 minutes. If you didn't request this, ignore this email.</p>
        </div>
      `,
    });
    console.log('OTP email sent successfully to', toEmail);
  } catch (err) {
    console.error('Failed to send OTP email:', err.message);
    throw err;
  }
};

module.exports = sendOTPEmail;