const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const sendOTPEmail = async (toEmail, otp) => {
  await transporter.sendMail({
    from: `"Synora" <${process.env.EMAIL_USER}>`,
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
};

module.exports = sendOTPEmail;