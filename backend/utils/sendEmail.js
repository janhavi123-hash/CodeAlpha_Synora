const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

const sendOTPEmail = async (toEmail, otp) => {
  try {
    await resend.emails.send({
      from: 'Synora <onboarding@resend.dev>',
      to: toEmail,
      subject: 'Synora — Password Reset Code',
      html: `
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