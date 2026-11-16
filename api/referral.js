// Serverless Function: /api/referrals/*
const db = require('../lib/db');
const { JWT_SECRET } = require('../lib/auth');
const jwt = require('jsonwebtoken');

function getUserFromReq(req) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return null;
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (e) {
    return null;
  }
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const user = getUserFromReq(req);
  if (!user) return res.status(401).json({ error: 'Authentication required.' });

  let action = req.query.action || null;
  if (!action && req.url) {
    const parts = req.url.split('?')[0].split('/').filter(Boolean);
    action = parts[parts.indexOf('referrals') + 1] || null;
  }

  try {
    // 1. Submit Withdrawal Request
    if (action === 'withdraw' && req.method === 'POST') {
      let body = req.body;
      if (typeof body === 'string') { try { body = JSON.parse(body); } catch(e){} }
      const { amount, method, destinationAccount } = body || {};

      const reqAmount = parseFloat(amount);
      if (!reqAmount || reqAmount <= 0) {
        return res.status(400).json({ error: 'Please enter a valid withdrawal amount.' });
      }

      if (!destinationAccount || destinationAccount.trim().length < 5) {
        return res.status(400).json({ error: 'Valid mobile number or TRC20 wallet address is required.' });
      }

      const fee = +(reqAmount * 0.02).toFixed(2); // 2% gateway processing fee
      const netAmount = +(reqAmount - fee).toFixed(2);

      const withdrawal = {
        id: 'wdr-' + Date.now(),
        user_id: user.id,
        user_email: user.email,
        amount: reqAmount,
        fee_applied: fee,
        net_amount: netAmount,
        method: method || 'momo_rwanda',
        destination_account: destinationAccount.trim(),
        status: 'pending_confirmation',
        created_at: new Date()
      };

      if (!db.memoryStore.referral_withdrawals) db.memoryStore.referral_withdrawals = [];
      db.memoryStore.referral_withdrawals.unshift(withdrawal);

      // Create Admin Notification
      if (!db.memoryStore.admin_notifications) db.memoryStore.admin_notifications = [];
      db.memoryStore.admin_notifications.unshift({
        id: 'notif-wdr-' + Date.now(),
        title: 'New Commission Withdrawal Request',
        message: `${user.email} requested withdrawal of $${reqAmount} via ${method || 'MoMo'}.`,
        type: 'referral_withdrawal',
        reference_id: withdrawal.id,
        is_read: false,
        created_at: new Date()
      });

      db.saveLocalStore();

      return res.status(201).json({
        success: true,
        message: `Withdrawal request for $${reqAmount} submitted successfully. Net payout: $${netAmount} after fee.`,
        withdrawal
      });
    }

    // 2. Get User's Withdrawals
    if (action === 'my-withdrawals' && req.method === 'GET') {
      const all = db.memoryStore.referral_withdrawals || [];
      const userList = all.filter(w => w.user_id === user.id);
      return res.status(200).json({ withdrawals: userList });
    }

    return res.status(404).json({ error: 'Unknown referrals action.' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
