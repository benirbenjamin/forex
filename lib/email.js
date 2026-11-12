// Email Dispatcher (Supports SMTP with console logging fallback)
const nodemailer = require('nodemailer');

let transporter = null;

if (process.env.SMTP_USER && process.env.SMTP_PASS) {
  try {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_PORT === '465',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });
  } catch (e) {
    console.error('Failed to initialize SMTP transporter:', e.message);
  }
}

async function sendVerificationEmail(toEmail, code, fullName = 'Trader') {
  console.log(`\n📧 [EMAIL OTP DISPATCH] Verification Code for ${toEmail}: >>> ${code} <<<\n`);
  
  if (!transporter) {
    return { success: true, mode: 'console_logged', code };
  }

  const mailOptions = {
    from: process.env.SMTP_FROM || 'ForexDoubleSniper <noreply@forexdoublesniper.com>',
    to: toEmail,
    subject: `Your ForexDoubleSniper Verification Code: ${code}`,
    html: `
      <div style="font-family: Arial, sans-serif; background: #0b0e14; color: #f0f3f8; padding: 30px; border-radius: 8px;">
        <h2 style="color: #ffd700;">Welcome to ForexDoubleSniper, ${fullName}!</h2>
        <p>Please enter the following 6-digit verification code to activate your 7-day free trial:</p>
        <div style="background: #181d2a; padding: 18px; text-align: center; border-radius: 8px; font-size: 28px; font-weight: bold; letter-spacing: 6px; color: #ffd700; margin: 20px 0;">
          ${code}
        </div>
        <p style="color: #8b95a5; font-size: 13px;">This code will expire in 15 minutes. If you did not create this account, please ignore this email.</p>
      </div>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    return { success: true, mode: 'smtp_sent' };
  } catch (err) {
    console.error('SMTP send error:', err.message);
    return { success: true, mode: 'smtp_failed_fallback_console', code };
  }
}

async function sendPasswordResetEmail(toEmail, code) {
  console.log(`\n🔑 [PASSWORD RESET OTP] Reset Code for ${toEmail}: >>> ${code} <<<\n`);

  if (!transporter) {
    return { success: true, mode: 'console_logged', code };
  }

  const mailOptions = {
    from: process.env.SMTP_FROM || 'ForexDoubleSniper <noreply@forexdoublesniper.com>',
    to: toEmail,
    subject: `Password Reset Code: ${code} - ForexDoubleSniper`,
    html: `
      <div style="font-family: Arial, sans-serif; background: #0b0e14; color: #f0f3f8; padding: 30px; border-radius: 8px;">
        <h2 style="color: #ffd700;">Password Reset Request</h2>
        <p>We received a request to reset your password. Use the code below:</p>
        <div style="background: #181d2a; padding: 18px; text-align: center; border-radius: 8px; font-size: 28px; font-weight: bold; letter-spacing: 6px; color: #ffd700; margin: 20px 0;">
          ${code}
        </div>
        <p style="color: #8b95a5; font-size: 13px;">Valid for 15 minutes. Never share this code with anyone.</p>
      </div>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    return { success: true, mode: 'smtp_sent' };
  } catch (err) {
    console.error('SMTP reset error:', err.message);
    return { success: true, mode: 'smtp_failed_fallback_console', code };
  }
}

module.exports = {
  sendVerificationEmail,
  sendPasswordResetEmail
};
