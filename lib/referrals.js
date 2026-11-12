// Referral Program & Manual Withdrawal Management
const db = require('./db');
const { getUsdToRwfRate } = require('./currency');

// Get user referral statistics & earnings balance
async function getUserReferralStats(userId) {
  let user;
  if (db.isConnectedToPostgres()) {
    const uRes = await db.query('SELECT referral_code FROM users WHERE id = $1 LIMIT 1', [userId]);
    user = uRes.rows[0];
  } else {
    user = db.memoryStore.users.find(u => u.id === userId);
  }

  if (!user) throw new Error('User not found.');

  let totalReferred = 0;
  let totalEarningsUsd = 0;
  let totalWithdrawnUsd = 0;
  let pendingWithdrawalUsd = 0;
  let earningsHistory = [];
  let withdrawals = [];

  if (db.isConnectedToPostgres()) {
    // Total count of referred users
    const countRes = await db.query('SELECT COUNT(*) as count FROM referrals WHERE referrer_id = $1', [userId]);
    totalReferred = parseInt(countRes.rows[0].count) || 0;

    // Total earnings
    const earnRes = await db.query(
      `SELECT re.*, u.full_name as referee_name, s.plan_name 
       FROM referral_earnings re
       LEFT JOIN users u ON re.referee_id = u.id
       LEFT JOIN subscriptions s ON re.subscription_id = s.id
       WHERE re.referrer_id = $1
       ORDER BY re.created_at DESC`,
      [userId]
    );
    earningsHistory = earnRes.rows;
    totalEarningsUsd = earningsHistory.reduce((acc, row) => acc + (+row.amount_usd || 0), 0);

    // Withdrawals
    const withRes = await db.query(
      `SELECT * FROM referral_withdrawals WHERE user_id = $1 ORDER BY created_at DESC`,
      [userId]
    );
    withdrawals = withRes.rows;

    totalWithdrawnUsd = withdrawals
      .filter(w => w.status === 'approved')
      .reduce((acc, w) => acc + (+w.amount_requested || 0), 0);

    pendingWithdrawalUsd = withdrawals
      .filter(w => w.status === 'pending')
      .reduce((acc, w) => acc + (+w.amount_requested || 0), 0);
  } else {
    const refs = db.memoryStore.referrals.filter(r => r.referrer_id === userId);
    totalReferred = refs.length;

    earningsHistory = db.memoryStore.referral_earnings.filter(e => e.referrer_id === userId);
    totalEarningsUsd = earningsHistory.reduce((acc, e) => acc + (+e.amount_usd || 0), 0);

    withdrawals = db.memoryStore.referral_withdrawals.filter(w => w.user_id === userId);
    totalWithdrawnUsd = withdrawals.filter(w => w.status === 'approved').reduce((acc, w) => acc + (+w.amount_requested || 0), 0);
    pendingWithdrawalUsd = withdrawals.filter(w => w.status === 'pending').reduce((acc, w) => acc + (+w.amount_requested || 0), 0);
  }

  const availableBalanceUsd = +(totalEarningsUsd - totalWithdrawnUsd - pendingWithdrawalUsd).toFixed(2);
  const rate = await getUsdToRwfRate();
  const availableBalanceRwf = Math.round(availableBalanceUsd * rate);

  // Fetch admin configured withdrawal fee
  let feeConfig = { type: 'percent', amount: 2.0 };
  try {
    if (db.isConnectedToPostgres()) {
      const fRes = await db.query("SELECT value FROM platform_settings WHERE key = 'withdrawal_fee' LIMIT 1");
      if (fRes.rowCount > 0 && fRes.rows[0].value) feeConfig = fRes.rows[0].value;
    }
  } catch (e) {}

  return {
    referralCode: user.referral_code,
    referralLink: `https://forexdoublesniper.com/?ref=${user.referral_code}`,
    totalReferred,
    totalEarningsUsd: +totalEarningsUsd.toFixed(2),
    totalWithdrawnUsd: +totalWithdrawnUsd.toFixed(2),
    pendingWithdrawalUsd: +pendingWithdrawalUsd.toFixed(2),
    availableBalanceUsd,
    availableBalanceRwf,
    exchangeRateRwf: rate,
    feeConfig,
    earningsHistory,
    withdrawals
  };
}

// Submit Manual Withdrawal Request
async function requestWithdrawal(userId, { amountUsd, paymentMethod, paymentDetails }) {
  const stats = await getUserReferralStats(userId);
  const requested = parseFloat(amountUsd);

  if (!requested || requested <= 0) {
    throw new Error('Please enter a valid withdrawal amount.');
  }

  if (requested > stats.availableBalanceUsd) {
    throw new Error(`Insufficient available balance. You have $${stats.availableBalanceUsd} available.`);
  }

  // Calculate fee (percent or flat)
  const feeType = stats.feeConfig.type || 'percent';
  const feeVal = stats.feeConfig.amount || 2.0;
  let feeAmount = 0;

  if (feeType === 'flat') {
    feeAmount = Math.min(requested, feeVal);
  } else {
    feeAmount = +(requested * (feeVal / 100)).toFixed(2);
  }

  const netAmount = +(requested - feeAmount).toFixed(2);

  let newReq;
  if (db.isConnectedToPostgres()) {
    const res = await db.query(
      `INSERT INTO referral_withdrawals (user_id, amount_requested, fee_amount, net_amount, currency, payment_details, status)
       VALUES ($1, $2, $3, $4, 'USD', $5, 'pending')
       RETURNING *`,
      [userId, requested, feeAmount, netAmount, paymentDetails]
    );
    newReq = res.rows[0];

    // Alert Admin
    await db.query(
      `INSERT INTO admin_notifications (title, message, type, reference_id)
       VALUES ($1, $2, 'withdrawal', $3)`,
      ['New Referral Withdrawal Request', `User requested $${requested} (Net payout: $${netAmount}). Payment details: ${paymentDetails}`, newReq.id]
    );
  } else {
    newReq = {
      id: 'with-' + Date.now(),
      user_id: userId,
      amount_requested: requested,
      fee_amount: feeAmount,
      net_amount: netAmount,
      currency: 'USD',
      payment_details: paymentDetails,
      status: 'pending',
      created_at: new Date()
    };
    db.memoryStore.referral_withdrawals.unshift(newReq);
  }

  return {
    withdrawal: newReq,
    message: `Withdrawal request submitted! You will receive $${netAmount} after deducting $${feeAmount} fee.`
  };
}

module.exports = {
  getUserReferralStats,
  requestWithdrawal
};
