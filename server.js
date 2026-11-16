require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const http = require('http');
const fs = require('fs');
const multer = require('multer');

const db = require('./lib/db');
const { getSignal, getAllSignals } = require('./lib/signals');
const {
  checkUnique,
  registerUser,
  verifyEmail,
  resendVerificationCode,
  loginUser,
  forgotPassword,
  resetPassword,
  authenticateToken,
  optionalAuthenticateToken,
  requireRole
} = require('./lib/auth');
const {
  evaluateOpenTradesForUser,
  placeTrade,
  closeTrade,
  getTradeHistory
} = require('./lib/simulator');
const {
  getPlans,
  checkUserSubscription,
  getUserPaymentHistory,
  activateSubscription
} = require('./lib/subscriptions');
const {
  initializePayment,
  verifyFlutterwavePayment
} = require('./lib/flutterwave');
const {
  getUserReferralStats,
  requestWithdrawal
} = require('./lib/referrals');
const {
  getP2PInfo,
  createBuyOrder,
  uploadAndVerifyScreenshot,
  confirmUserSentPayment,
  adminConfirmPaymentReceived,
  adminConfirmCryptoSent,
  submitDisputeClaim,
  createSellOrder
} = require('./lib/p2p');
const { sendMessage, getOrderMessages } = require('./lib/chat');
const {
  getAdminNotifications,
  markNotificationRead,
  getAllUsers,
  deleteUser,
  savePlan,
  adminGrantSubscription,
  updateP2PInventory,
  getAllP2POrders,
  getPlatformSettings,
  savePlatformSetting,
  addAdmin
} = require('./lib/admin');
const { getUsdToRwfRate } = require('./lib/currency');

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 3000;

// Setup Multer for secure file uploads (< 5MB)
const uploadDir = path.join(__dirname, 'public/uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `file_${Date.now()}_${Math.random().toString(36).substring(2, 7)}${ext}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve built React assets if dist exists, otherwise fall back to public
const distDir = path.join(__dirname, 'dist');
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
}
app.use(express.static(path.join(__dirname, 'public')));

// Specific Route Aliases
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/admin.html'));
});

app.get('/app', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/app.html'));
});

// ==========================================
// 1. FOREX SIGNALS & MULTI-PAIR API
// ==========================================
app.get('/api/signal', async (req, res) => {
  try {
    const symbol = req.query.symbol || 'XAUUSD';
    const sig = await getSignal(symbol);
    res.json(sig);
  } catch (err) {
    res.status(502).json({ error: 'Signal feed error: ' + err.message });
  }
});

app.get('/api/signals/all', async (req, res) => {
  try {
    const all = await getAllSignals();
    res.json(all);
  } catch (err) {
    res.status(502).json({ error: 'Multi-pair feed error: ' + err.message });
  }
});

app.get('/api/currency/rate', async (req, res) => {
  try {
    const rate = await getUsdToRwfRate();
    res.json({ usd_rwf: rate, timestamp: new Date().toISOString() });
  } catch (err) {
    res.json({ usd_rwf: 1350.00 });
  }
});

// ==========================================
// 2. AUTHENTICATION & DEVICE FINGERPRINTING
// ==========================================
app.get('/api/auth/check-unique', async (req, res) => {
  try {
    const { email, phone } = req.query;
    const uniqueness = await checkUnique(email, phone);
    res.json(uniqueness);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/register', async (req, res) => {
  try {
    const ipAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];
    const result = await registerUser({
      ...req.body,
      ipAddress,
      userAgent
    });
    res.status(201).json(result);
  } catch (err) {
    res.status(err.statusCode || 400).json({ error: err.message });
  }
});

app.post('/api/auth/verify-email', async (req, res) => {
  try {
    const { email, code } = req.body;
    const result = await verifyEmail(email, code);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post(['/api/auth/resend-code', '/api/auth/resend-verification'], async (req, res) => {
  try {
    const { email } = req.body;
    const result = await resendVerificationCode(email);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const result = await loginUser(req.body);
    res.json(result);
  } catch (err) {
    res.status(err.statusCode || 401).json({
      error: err.message,
      unverified: !!err.unverified,
      email: err.email || null
    });
  }
});

app.post('/api/auth/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    const result = await forgotPassword(email);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/auth/reset-password', async (req, res) => {
  try {
    const { email, code, newPassword } = req.body;
    const result = await resetPassword(email, code, newPassword);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/auth/me', authenticateToken, async (req, res) => {
  res.json({ user: req.user });
});

// ==========================================
// 3. REALISTIC TRADING SIMULATOR & AUTO TP/SL
// ==========================================
app.post('/api/simulator/order', authenticateToken, async (req, res) => {
  try {
    const trade = await placeTrade(req.user.id, req.body);
    res.status(201).json({ success: true, trade, message: 'Simulated position opened!' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/simulator/positions', authenticateToken, async (req, res) => {
  try {
    const positions = await evaluateOpenTradesForUser(req.user.id);
    res.json({ positions });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/simulator/close', authenticateToken, async (req, res) => {
  try {
    const { tradeId } = req.body;
    const trade = await closeTrade(req.user.id, tradeId);
    res.json({ success: true, trade, message: 'Position closed at market price.' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/simulator/history', authenticateToken, async (req, res) => {
  try {
    const data = await getTradeHistory(req.user.id);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 4. SUBSCRIPTIONS, PAYWALL & FLUTTERWAVE
// ==========================================
app.get('/api/subscriptions/plans', async (req, res) => {
  try {
    const plans = await getPlans();
    res.json({ plans });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/subscriptions/status', optionalAuthenticateToken, async (req, res) => {
  try {
    if (!req.user) {
      return res.json({ hasAccess: false, status: 'guest', message: 'Sign in to access VIP signals.' });
    }
    const status = await checkUserSubscription(req.user.id);
    res.json(status);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/payments/flutterwave/initialize', authenticateToken, async (req, res) => {
  try {
    const { planId, currency, phone } = req.body;
    const plans = await getPlans();
    const plan = plans.find(p => p.id === planId || p.slug === planId);
    if (!plan) throw new Error('Selected plan not found.');

    const curr = (currency || 'USD').toUpperCase();
    const amount = curr === 'RWF' ? plan.priceRwf : plan.priceUsd;

    const result = await initializePayment({
      userId: req.user.id,
      plan,
      amount,
      currency: curr,
      email: req.user.email,
      phone: phone || req.user.phone || '+250780000000',
      fullName: req.user.fullName || 'Trader',
      redirectUrl: `${req.protocol}://${req.get('host')}/app?payment=verify`
    });

    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/payments/flutterwave/verify', async (req, res) => {
  try {
    const { transaction_id, tx_ref } = req.query;
    if (!transaction_id) throw new Error('Transaction ID is required.');

    const verification = await verifyFlutterwavePayment(transaction_id, tx_ref);
    res.json(verification);
  } catch (err) {
    res.status(400).json({ error: err.message, accessGranted: false });
  }
});

app.post('/api/payments/manual/submit', authenticateToken, upload.single('receipt'), async (req, res) => {
  try {
    const { planId, amount, currency, senderPhone, transactionRef } = req.body;
    const proofFile = req.file ? `/uploads/${req.file.filename}` : null;

    if (db.isConnectedToPostgres()) {
      const payRes = await db.query(
        `INSERT INTO payments (user_id, amount, currency, status, payment_method, manual_sender_phone, manual_transaction_ref, proof_file_url)
         VALUES ($1, $2, $3, 'pending', 'manual', $4, $5, $6)
         RETURNING id`,
        [req.user.id, amount, currency || 'USD', senderPhone, transactionRef, proofFile]
      );

      // Alert Admin
      await db.query(
        `INSERT INTO admin_notifications (title, message, type, reference_id)
         VALUES ($1, $2, 'manual_payment', $3)`,
        ['New Manual Payment Submitted', `Trader submitted manual payment of ${amount} ${currency}. Ref: ${transactionRef}`, payRes.rows[0].id]
      );
    }

    res.json({ success: true, message: 'Payment submitted for admin confirmation.' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/payments/history', authenticateToken, async (req, res) => {
  try {
    const history = await getUserPaymentHistory(req.user.id);
    res.json({ history });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 5. REFERRALS & WITHDRAWALS
// ==========================================
app.get('/api/referrals/stats', authenticateToken, async (req, res) => {
  try {
    const stats = await getUserReferralStats(req.user.id);
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/referrals/withdraw', authenticateToken, async (req, res) => {
  try {
    const result = await requestWithdrawal(req.user.id, req.body);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ==========================================
// 6. CRYPTO P2P BUY / SELL & SUPPORT CHAT
// ==========================================
app.get('/api/p2p/info', async (req, res) => {
  try {
    const info = await getP2PInfo();
    res.json(info);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/p2p/buy', authenticateToken, async (req, res) => {
  try {
    const result = await createBuyOrder(req.user.id, req.body);
    res.status(201).json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/p2p/upload-proof', authenticateToken, upload.single('screenshot'), async (req, res) => {
  try {
    if (!req.file) throw new Error('Please select an image file to upload.');
    const { orderId } = req.body;
    if (!orderId) throw new Error('Order ID is required.');

    const result = await uploadAndVerifyScreenshot(
      orderId,
      req.user.id,
      req.file.path,
      req.file.originalname,
      req.file.mimetype,
      req.file.size
    );

    res.json(result);
  } catch (err) {
    res.status(err.statusCode || 400).json({ error: err.message, analysis: err.analysis });
  }
});

app.post('/api/p2p/confirm-sent', authenticateToken, async (req, res) => {
  try {
    const { orderId } = req.body;
    const result = await confirmUserSentPayment(orderId, req.user.id);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/p2p/sell', authenticateToken, async (req, res) => {
  try {
    const result = await createSellOrder(req.user.id, req.body);
    res.status(201).json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/p2p/dispute', authenticateToken, async (req, res) => {
  try {
    const { orderId, disputeTxId, disputeHash, disputeReason } = req.body;
    const result = await submitDisputeClaim(orderId, req.user.id, { disputeTxId, disputeHash, disputeReason });
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/p2p/orders', authenticateToken, async (req, res) => {
  try {
    let orders = [];
    if (db.isConnectedToPostgres()) {
      const oRes = await db.query('SELECT * FROM p2p_orders WHERE user_id = $1 ORDER BY created_at DESC', [req.user.id]);
      orders = oRes.rows;
    } else {
      orders = db.memoryStore.p2p_orders.filter(o => o.user_id === req.user.id);
    }
    res.json({ orders });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// P2P Support Chat Endpoints
app.get('/api/p2p/chat/:orderId', authenticateToken, async (req, res) => {
  try {
    const messages = await getOrderMessages(req.params.orderId);
    res.json({ messages });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/p2p/chat/:orderId', authenticateToken, upload.single('attachment'), async (req, res) => {
  try {
    const msg = await sendMessage({
      orderId: req.params.orderId,
      senderId: req.user.id,
      senderRole: req.user.role || 'user',
      message: req.body.message,
      file: req.file
    });
    res.status(201).json({ success: true, message: msg });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ==========================================
// 7. ADMIN & SUPER ADMIN PORTAL API
// ==========================================
app.get('/api/admin/notifications', authenticateToken, requireRole('admin', 'superadmin'), async (req, res) => {
  try {
    const data = await getAdminNotifications();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/notifications/read', authenticateToken, requireRole('admin', 'superadmin'), async (req, res) => {
  try {
    const { notifId } = req.body;
    const result = await markNotificationRead(notifId || 'all');
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/users', authenticateToken, requireRole('admin', 'superadmin'), async (req, res) => {
  try {
    const users = await getAllUsers(req.query.search);
    res.json({ users });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/admin/users/:id', authenticateToken, requireRole('admin', 'superadmin'), async (req, res) => {
  try {
    const result = await deleteUser(req.user.role, req.params.id);
    res.json(result);
  } catch (err) {
    res.status(403).json({ error: err.message });
  }
});

app.post('/api/admin/plans', authenticateToken, requireRole('admin', 'superadmin'), async (req, res) => {
  try {
    const plan = await savePlan(req.body);
    res.json({ success: true, plan });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/admin/subscriptions/grant', authenticateToken, requireRole('admin', 'superadmin'), async (req, res) => {
  try {
    const sub = await adminGrantSubscription(req.body);
    res.json({ success: true, subscription: sub });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/admin/p2p/orders', authenticateToken, requireRole('admin', 'superadmin'), async (req, res) => {
  try {
    const orders = await getAllP2POrders();
    res.json({ orders });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/p2p/confirm-payment', authenticateToken, requireRole('admin', 'superadmin'), async (req, res) => {
  try {
    const { orderId } = req.body;
    const result = await adminConfirmPaymentReceived(orderId, req.user.id);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/admin/p2p/release-crypto', authenticateToken, requireRole('admin', 'superadmin'), upload.single('adminProof'), async (req, res) => {
  try {
    const { orderId, txHash } = req.body;
    const adminProofUrl = req.file ? `/uploads/${req.file.filename}` : null;
    const result = await adminConfirmCryptoSent(orderId, req.user.id, txHash, adminProofUrl);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/admin/p2p/inventory', authenticateToken, requireRole('admin', 'superadmin'), async (req, res) => {
  try {
    const inv = await updateP2PInventory(req.body);
    res.json({ success: true, inventory: inv });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/admin/settings', authenticateToken, requireRole('superadmin'), async (req, res) => {
  try {
    const settings = await getPlatformSettings(req.user.role);
    res.json({ settings });
  } catch (err) {
    res.status(403).json({ error: err.message });
  }
});

app.post('/api/admin/settings', authenticateToken, requireRole('superadmin'), async (req, res) => {
  try {
    const { key, value } = req.body;
    const result = await savePlatformSetting(req.user.role, key, value);
    res.json(result);
  } catch (err) {
    res.status(403).json({ error: err.message });
  }
});

app.post('/api/admin/add-admin', authenticateToken, requireRole('admin', 'superadmin'), async (req, res) => {
  try {
    const newAdmin = await addAdmin(req.user.role, req.body);
    res.status(201).json({ success: true, admin: newAdmin });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// SPA Catch-all (serve React SPA index.html for client-side routing)
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  const distIndex = path.join(__dirname, 'dist/index.html');
  if (fs.existsSync(distIndex)) {
    return res.sendFile(distIndex);
  }
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Boot Database & Launch Server
async function startServer() {
  try {
    await db.initDatabase();
    await db.seedAdminsOnStartup();
    console.log('✅ Mandatory admins verified & seeded in database on startup.');
  } catch (e) {
    console.error('Database initialization encountered an error:', e.message);
    try {
      await db.seedAdminsOnStartup();
    } catch (se) {}
  }

  server.listen(PORT, () => {
    console.log(`\n======================================================`);
    console.log(`🚀 ForexDoubleSniper Platform Running on Port ${PORT}`);
    console.log(`🌐 Public Landing & App: http://localhost:${PORT}`);
    console.log(`🔐 Dedicated Admin Portal: http://localhost:${PORT}/admin`);
    console.log(`======================================================\n`);
  });
}

startServer();

module.exports = app;
