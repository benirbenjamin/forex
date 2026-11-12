// Authentication, Security, Device Fingerprinting & Lockout Management
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('./db');
const { sendVerificationEmail, sendPasswordResetEmail } = require('./email');

const JWT_SECRET = process.env.JWT_SECRET || 'forex_sniper_institutional_jwt_secret_2026';

// 5-character lowercase referral code excluding confusing characters (o, 0, l, 1, i)
const SAFE_REFERRAL_CHARS = '23456789abcdefghjkmnpqrstuvwxyz';

function generateReferralCode() {
  let code = '';
  for (let i = 0; i < 5; i++) {
    const idx = Math.floor(Math.random() * SAFE_REFERRAL_CHARS.length);
    code += SAFE_REFERRAL_CHARS[idx];
  }
  return code;
}

function generate6DigitCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Check live uniqueness for email and phone
async function checkUnique(email, phone) {
  const result = { emailExists: false, phoneExists: false };

  if (email) {
    const cleanEmail = email.trim().toLowerCase();
    if (db.isConnectedToPostgres()) {
      const res = await db.query('SELECT id FROM users WHERE LOWER(email) = $1 LIMIT 1', [cleanEmail]);
      result.emailExists = res.rowCount > 0;
    } else {
      result.emailExists = db.memoryStore.users.some(u => u.email.toLowerCase() === cleanEmail);
    }
  }

  if (phone) {
    const cleanPhone = phone.trim();
    if (db.isConnectedToPostgres()) {
      const res = await db.query('SELECT id FROM users WHERE phone = $1 LIMIT 1', [cleanPhone]);
      result.phoneExists = res.rowCount > 0;
    } else {
      result.phoneExists = db.memoryStore.users.some(u => u.phone === cleanPhone);
    }
  }

  return result;
}

// User Registration with Device Fingerprint Enforcement
async function registerUser({ fullName, email, phone, password, confirmPassword, deviceFingerprint, refCode, ipAddress, userAgent }) {
  if (!fullName || !email || !phone || !password) {
    throw new Error('All fields are required.');
  }

  if (password !== confirmPassword) {
    throw new Error('Passwords do not match.');
  }

  if (password.length < 6) {
    throw new Error('Password must be at least 6 characters long.');
  }

  const cleanEmail = email.trim().toLowerCase();
  const cleanPhone = phone.trim();

  // 1. Strict Device Fingerprint Check:
  // If another account was already registered on this device, block with exact message:
  // "Login to an account you already have." (Never disclose device was detected)
  if (deviceFingerprint) {
    let deviceMatch = false;
    if (db.isConnectedToPostgres()) {
      const devRes = await db.query('SELECT id, user_id FROM devices WHERE device_fingerprint = $1 LIMIT 1', [deviceFingerprint]);
      if (devRes.rowCount > 0) deviceMatch = true;
    } else {
      deviceMatch = db.memoryStore.devices.some(d => d.device_fingerprint === deviceFingerprint);
    }

    if (deviceMatch) {
      const err = new Error('Login to an account you already have.');
      err.statusCode = 400;
      throw err;
    }
  }

  // 2. Uniqueness check for email & phone
  const uniqueness = await checkUnique(cleanEmail, cleanPhone);
  if (uniqueness.emailExists) {
    const err = new Error('Email already exists. Please login or use another email.');
    err.statusCode = 400;
    throw err;
  }
  if (uniqueness.phoneExists) {
    const err = new Error('Phone number already exists. Please login or use another phone.');
    err.statusCode = 400;
    throw err;
  }

  // 3. Hash Password
  const passwordHash = await bcrypt.hash(password, 12);

  // 4. Unique 5-char lowercase referral code
  let referralCode = generateReferralCode();
  let codeUnique = false;
  while (!codeUnique) {
    if (db.isConnectedToPostgres()) {
      const cRes = await db.query('SELECT id FROM users WHERE referral_code = $1 LIMIT 1', [referralCode]);
      if (cRes.rowCount === 0) codeUnique = true;
      else referralCode = generateReferralCode();
    } else {
      if (!db.memoryStore.users.some(u => u.referral_code === referralCode)) codeUnique = true;
      else referralCode = generateReferralCode();
    }
  }

  // 5. Verification OTP Code (15 min expiry)
  const verificationCode = generate6DigitCode();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

  let newUser;
  if (db.isConnectedToPostgres()) {
    const insertRes = await db.query(
      `INSERT INTO users (full_name, email, phone, password_hash, role, referral_code, referred_by, email_verified, verification_code, verification_code_expires_at)
       VALUES ($1, $2, $3, $4, 'user', $5, $6, FALSE, $7, $8)
       RETURNING id, full_name, email, phone, role, referral_code, created_at`,
      [fullName.trim(), cleanEmail, cleanPhone, passwordHash, referralCode, refCode || null, verificationCode, expiresAt]
    );
    newUser = insertRes.rows[0];

    // Store device fingerprint
    if (deviceFingerprint) {
      await db.query(
        `INSERT INTO devices (user_id, device_fingerprint, user_agent, ip_address)
         VALUES ($1, $2, $3, $4)`,
        [newUser.id, deviceFingerprint, userAgent || '', ipAddress || '']
      );
    }

    // Assign 7-Day Free Trial Subscription
    const trialExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await db.query(
      `INSERT INTO subscriptions (user_id, plan_name, status, starts_at, expires_at, amount_paid, currency, payment_method)
       VALUES ($1, '7-Day Free Trial', 'trial', NOW(), $2, 0, 'USD', 'free_trial')`,
      [newUser.id, trialExpiry]
    );

    // If referee registered with valid code, record in referrals
    if (refCode) {
      const referrerRes = await db.query('SELECT id FROM users WHERE referral_code = $1 LIMIT 1', [refCode.trim().toLowerCase()]);
      if (referrerRes.rowCount > 0) {
        await db.query(
          `INSERT INTO referrals (referrer_id, referee_id, referral_code)
           VALUES ($1, $2, $3)`,
          [referrerRes.rows[0].id, newUser.id, refCode.trim().toLowerCase()]
        );
      }
    }
  } else {
    newUser = {
      id: 'usr-' + Date.now(),
      full_name: fullName.trim(),
      email: cleanEmail,
      phone: cleanPhone,
      password_hash: passwordHash,
      role: 'user',
      referral_code: referralCode,
      referred_by: refCode || null,
      email_verified: false,
      verification_code: verificationCode,
      verification_code_expires_at: expiresAt,
      failed_login_attempts: 0,
      created_at: new Date()
    };
    db.memoryStore.users.push(newUser);

    if (deviceFingerprint) {
      db.memoryStore.devices.push({
        id: 'dev-' + Date.now(),
        user_id: newUser.id,
        device_fingerprint: deviceFingerprint,
        user_agent: userAgent,
        ip_address: ipAddress,
        created_at: new Date()
      });
    }

    // Add trial subscription
    db.memoryStore.subscriptions.push({
      id: 'sub-' + Date.now(),
      user_id: newUser.id,
      plan_name: '7-Day Free Trial',
      status: 'trial',
      starts_at: new Date(),
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      amount_paid: 0,
      currency: 'USD',
      payment_method: 'free_trial'
    });
  }

  // Dispatch Verification Code
  await sendVerificationEmail(cleanEmail, verificationCode, fullName);

  return {
    user: newUser,
    message: 'Registration successful! Please check your email for the 6-digit verification code.'
  };
}

// Verify Email with 6-Digit Code
async function verifyEmail(email, code) {
  const cleanEmail = email.trim().toLowerCase();
  const cleanCode = code.trim();

  let user;
  if (db.isConnectedToPostgres()) {
    const res = await db.query('SELECT * FROM users WHERE LOWER(email) = $1 LIMIT 1', [cleanEmail]);
    user = res.rows[0];
  } else {
    user = db.memoryStore.users.find(u => u.email.toLowerCase() === cleanEmail);
  }

  if (!user) throw new Error('User not found.');
  if (user.email_verified) return { message: 'Email already verified.' };

  if (user.verification_code !== cleanCode) {
    throw new Error('Invalid verification code.');
  }

  if (new Date() > new Date(user.verification_code_expires_at)) {
    throw new Error('Verification code has expired. Please request a new one.');
  }

  if (db.isConnectedToPostgres()) {
    await db.query('UPDATE users SET email_verified = TRUE, verification_code = NULL WHERE id = $1', [user.id]);
  } else {
    user.email_verified = true;
    user.verification_code = null;
  }

  // Generate JWT for immediate login upon verification
  const token = jwt.sign(
    { id: user.id, email: user.email, role: user.role, fullName: user.full_name },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

  return {
    verified: true,
    token,
    user: { id: user.id, email: user.email, role: user.role, fullName: user.full_name }
  };
}

// User Login with 3-Attempt Lockout for 1 Hour
async function loginUser({ email, password, deviceFingerprint }) {
  if (!email || !password) {
    throw new Error('Email and password are required.');
  }

  const cleanEmail = email.trim().toLowerCase();
  let user;

  if (db.isConnectedToPostgres()) {
    const res = await db.query('SELECT * FROM users WHERE LOWER(email) = $1 LIMIT 1', [cleanEmail]);
    user = res.rows[0];
  } else {
    user = db.memoryStore.users.find(u => u.email.toLowerCase() === cleanEmail);
  }

  if (!user) {
    throw new Error('Invalid email or password.');
  }

  // Check 1-Hour Lockout Status
  const now = new Date();
  if (user.lockout_until && new Date(user.lockout_until) > now) {
    const remainingMinutes = Math.ceil((new Date(user.lockout_until) - now) / 60000);
    const err = new Error(`Account locked due to 3 failed attempts. Please wait ${remainingMinutes} minute(s) before trying again.`);
    err.statusCode = 429;
    throw err;
  }

  // Verify password hash
  const isMatch = await bcrypt.compare(password, user.password_hash);

  if (!isMatch) {
    const attempts = (user.failed_login_attempts || 0) + 1;
    let lockoutTime = null;

    if (attempts >= 3) {
      lockoutTime = new Date(Date.now() + 60 * 60 * 1000); // 1 hour lockout
    }

    if (db.isConnectedToPostgres()) {
      await db.query(
        'UPDATE users SET failed_login_attempts = $1, lockout_until = $2 WHERE id = $3',
        [attempts, lockoutTime, user.id]
      );
    } else {
      user.failed_login_attempts = attempts;
      user.lockout_until = lockoutTime;
    }

    if (attempts >= 3) {
      const err = new Error('Password entered incorrectly 3 times. Your account is locked for 1 hour.');
      err.statusCode = 429;
      throw err;
    } else {
      const remaining = 3 - attempts;
      const err = new Error(`Invalid credentials. You have ${remaining} attempt(s) remaining before a 1-hour account lockout.`);
      err.statusCode = 401;
      throw err;
    }
  }

  // Successful login -> Reset lockout & failed attempts
  if (db.isConnectedToPostgres()) {
    await db.query('UPDATE users SET failed_login_attempts = 0, lockout_until = NULL WHERE id = $1', [user.id]);
  } else {
    user.failed_login_attempts = 0;
    user.lockout_until = null;
  }

  const token = jwt.sign(
    { id: user.id, email: user.email, role: user.role, fullName: user.full_name },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

  return {
    token,
    user: {
      id: user.id,
      fullName: user.full_name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      referralCode: user.referral_code,
      emailVerified: user.email_verified
    }
  };
}

// Request Password Reset Code
async function forgotPassword(email) {
  const cleanEmail = email.trim().toLowerCase();
  let user;

  if (db.isConnectedToPostgres()) {
    const res = await db.query('SELECT * FROM users WHERE LOWER(email) = $1 LIMIT 1', [cleanEmail]);
    user = res.rows[0];
  } else {
    user = db.memoryStore.users.find(u => u.email.toLowerCase() === cleanEmail);
  }

  if (!user) {
    // Return generic success to prevent email enumeration
    return { message: 'If an account exists with that email, a password reset code has been sent.' };
  }

  const resetCode = generate6DigitCode();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

  if (db.isConnectedToPostgres()) {
    await db.query('UPDATE users SET verification_code = $1, verification_code_expires_at = $2 WHERE id = $3', [resetCode, expiresAt, user.id]);
  } else {
    user.verification_code = resetCode;
    user.verification_code_expires_at = expiresAt;
  }

  await sendPasswordResetEmail(cleanEmail, resetCode);
  return { message: 'A 6-digit reset code has been sent to your email.' };
}

// Reset Password with Code
async function resetPassword(email, code, newPassword) {
  if (!newPassword || newPassword.length < 6) {
    throw new Error('New password must be at least 6 characters.');
  }

  const cleanEmail = email.trim().toLowerCase();
  const cleanCode = code.trim();

  let user;
  if (db.isConnectedToPostgres()) {
    const res = await db.query('SELECT * FROM users WHERE LOWER(email) = $1 LIMIT 1', [cleanEmail]);
    user = res.rows[0];
  } else {
    user = db.memoryStore.users.find(u => u.email.toLowerCase() === cleanEmail);
  }

  if (!user) throw new Error('Invalid request.');
  if (user.verification_code !== cleanCode) throw new Error('Invalid reset code.');
  if (new Date() > new Date(user.verification_code_expires_at)) throw new Error('Reset code has expired.');

  const passwordHash = await bcrypt.hash(newPassword, 12);

  if (db.isConnectedToPostgres()) {
    await db.query(
      'UPDATE users SET password_hash = $1, verification_code = NULL, failed_login_attempts = 0, lockout_until = NULL WHERE id = $2',
      [passwordHash, user.id]
    );
  } else {
    user.password_hash = passwordHash;
    user.verification_code = null;
    user.failed_login_attempts = 0;
    user.lockout_until = null;
  }

  return { message: 'Password has been successfully reset! You can now log in.' };
}

// Middleware: Authenticate Token
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required.' });
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) return res.status(403).json({ error: 'Invalid or expired token.' });
    req.user = decoded;
    next();
  });
}

// Middleware: Optional Authenticate (allows guest preview or authenticated user)
function optionalAuthenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    req.user = null;
    return next();
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    req.user = err ? null : decoded;
    next();
  });
}

// Middleware: Require Roles (e.g. 'admin', 'superadmin')
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required.' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Access denied: insufficient administrative privileges.' });
    }
    next();
  };
}

module.exports = {
  checkUnique,
  registerUser,
  verifyEmail,
  loginUser,
  forgotPassword,
  resetPassword,
  authenticateToken,
  optionalAuthenticateToken,
  requireRole,
  JWT_SECRET
};
