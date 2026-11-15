// Serverless handler for /api/auth/* actions
const db = require('../lib/db');
const {
  checkUnique,
  registerUser,
  verifyEmail,
  resendVerificationCode,
  loginUser,
  forgotPassword,
  resetPassword,
  JWT_SECRET
} = require('../lib/auth');
const jwt = require('jsonwebtoken');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // Ensure DB / in-memory store is initialized with a safe timeout to prevent gateway timeout
    try {
      await Promise.race([
        db.ensureDatabaseInitialized(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('DB init timeout')), 3000))
      ]);
    } catch (dbInitErr) {
      console.warn('DB initialization deferred:', dbInitErr.message);
    }

    // Determine action from query or url path
    let action = (req.query && req.query.action) ? req.query.action : null;
    if (!action && req.url) {
      const parts = req.url.split('?')[0].split('/');
      action = parts[parts.length - 1];
    }
    // 1. Check uniqueness (GET /api/auth/check-unique)
    if (action === 'check-unique' && req.method === 'GET') {
      const { email, phone } = req.query;
      const uniqueness = await checkUnique(email, phone);
      return res.status(200).json(uniqueness);
    }

    // 2. Register (POST /api/auth/register)
    if (action === 'register' && req.method === 'POST') {
      const ipAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
      const userAgent = req.headers['user-agent'];
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const result = await registerUser({
        ...body,
        ipAddress,
        userAgent
      });
      return res.status(201).json(result);
    }

    // 3. Verify Email OTP (POST /api/auth/verify-email)
    if (action === 'verify-email' && req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const { email, code } = body;
      const result = await verifyEmail(email, code);
      return res.status(200).json(result);
    }

    // 3b. Resend Email OTP (POST /api/auth/resend-code)
    if ((action === 'resend-code' || action === 'resend-verification') && req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const result = await resendVerificationCode(body.email);
      return res.status(200).json(result);
    }

    // 4. Login (POST /api/auth/login)
    if (action === 'login' && req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const result = await loginUser(body);
      return res.status(200).json(result);
    }

    // 5. Check Token / Me (GET /api/auth/me)
    if (action === 'me' && req.method === 'GET') {
      const authHeader = req.headers['authorization'];
      const token = authHeader && authHeader.split(' ')[1];
      if (!token) {
        return res.status(401).json({ error: 'Unauthorized: No token provided' });
      }
      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        return res.status(200).json({ user: decoded });
      } catch (err) {
        return res.status(401).json({ error: 'Unauthorized: Invalid or expired token' });
      }
    }

    // 6. Forgot Password (POST /api/auth/forgot-password)
    if (action === 'forgot-password' && req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const result = await forgotPassword(body.email);
      return res.status(200).json(result);
    }

    // 7. Reset Password (POST /api/auth/reset-password)
    if (action === 'reset-password' && req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const { email, code, newPassword } = body;
      const result = await resetPassword(email, code, newPassword);
      return res.status(200).json(result);
    }

    return res.status(404).json({ error: 'Unknown auth action: ' + action });
  } catch (err) {
    const status = err.statusCode || 400;
    return res.status(status).json({
      error: err.message,
      unverified: !!err.unverified,
      email: err.email || null
    });
  }
};
