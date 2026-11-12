// Subscription Plans & Billing Management
const db = require('./db');
const { getUsdToRwfRate, convertUsdToRwf } = require('./currency');

// Get all active plans with live USD and RWF prices
async function getPlans() {
  const rate = await getUsdToRwfRate();

  let plans = [];
  if (db.isConnectedToPostgres()) {
    const res = await db.query('SELECT * FROM plans WHERE is_active = TRUE ORDER BY duration_days ASC');
    plans = res.rows;
  } else {
    plans = db.memoryStore.plans.filter(p => p.is_active !== false);
  }

  return plans.map(p => ({
    id: p.id,
    name: p.name,
    slug: p.slug,
    durationDays: p.duration_days,
    priceUsd: +p.price_usd,
    priceRwf: +p.price_rwf || convertUsdToRwf(+p.price_usd, rate),
    exchangeRate: rate
  }));
}

// Check user subscription / trial status
async function checkUserSubscription(userId) {
  if (!userId) {
    return { hasAccess: false, status: 'guest', message: 'Sign in to access live signals.' };
  }

  let sub;
  if (db.isConnectedToPostgres()) {
    const res = await db.query(
      `SELECT * FROM subscriptions 
       WHERE user_id = $1 AND status IN ('active', 'trial') AND expires_at > NOW() 
       ORDER BY expires_at DESC LIMIT 1`,
      [userId]
    );
    sub = res.rows[0];
  } else {
    sub = db.memoryStore.subscriptions
      .filter(s => s.user_id === userId && (s.status === 'active' || s.status === 'trial') && new Date(s.expires_at) > new Date())
      .sort((a, b) => new Date(b.expires_at) - new Date(a.expires_at))[0];
  }

  if (!sub) {
    return {
      hasAccess: false,
      status: 'expired',
      message: 'Your 7-day trial or subscription has expired. Please subscribe to continue accessing real-time signals.'
    };
  }

  const now = new Date();
  const expiresAt = new Date(sub.expires_at);
  const diffMs = expiresAt - now;
  const remainingHours = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60)));
  const remainingDays = Math.max(0, Math.floor(remainingHours / 24));

  return {
    hasAccess: true,
    status: sub.status,
    planName: sub.plan_name,
    startsAt: sub.starts_at,
    expiresAt: sub.expires_at,
    remainingDays,
    remainingHours,
    isTrial: sub.status === 'trial'
  };
}

// Activate or Extend Subscription
async function activateSubscription(userId, { planId, planName, durationDays, amountPaid, currency, paymentMethod, txRef, paymentId }) {
  const startsAt = new Date();
  const expiresAt = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000);

  let subscription;
  if (db.isConnectedToPostgres()) {
    const res = await db.query(
      `INSERT INTO subscriptions (user_id, plan_id, plan_name, status, starts_at, expires_at, amount_paid, currency, payment_method, flutterwave_tx_ref)
       VALUES ($1, $2, $3, 'active', $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [userId, planId || null, planName, startsAt, expiresAt, amountPaid, currency || 'USD', paymentMethod, txRef || null]
    );
    subscription = res.rows[0];
  } else {
    subscription = {
      id: 'sub-' + Date.now(),
      user_id: userId,
      plan_id: planId,
      plan_name: planName,
      status: 'active',
      starts_at: startsAt,
      expires_at: expiresAt,
      amount_paid: amountPaid,
      currency: currency || 'USD',
      payment_method: paymentMethod,
      flutterwave_tx_ref: txRef
    };
    db.memoryStore.subscriptions.push(subscription);
  }

  // Trigger referral commission for referrer
  await processReferralCommission(userId, subscription.id, amountPaid, currency);

  return subscription;
}

// Calculate and award 10% (default) commission to referrer
async function processReferralCommission(refereeId, subscriptionId, amountPaid, currency) {
  let referrerId = null;
  let commissionPct = 10.0;

  // Fetch commission % from platform_settings
  try {
    if (db.isConnectedToPostgres()) {
      const setRes = await db.query("SELECT value FROM platform_settings WHERE key = 'referral_commission_pct' LIMIT 1");
      if (setRes.rowCount > 0 && setRes.rows[0].value && setRes.rows[0].value.percent) {
        commissionPct = +setRes.rows[0].value.percent;
      }
    }
  } catch (e) {}

  // Find referrer
  if (db.isConnectedToPostgres()) {
    const refRes = await db.query('SELECT referrer_id FROM referrals WHERE referee_id = $1 LIMIT 1', [refereeId]);
    if (refRes.rowCount > 0) {
      referrerId = refRes.rows[0].referrer_id;
    }
  } else {
    const r = db.memoryStore.referrals.find(x => x.referee_id === refereeId);
    if (r) referrerId = r.referrer_id;
  }

  if (!referrerId) return;

  const rate = await getUsdToRwfRate();
  let amountUsd = 0;
  let amountRwf = 0;

  if (currency === 'RWF') {
    amountRwf = +(amountPaid * (commissionPct / 100)).toFixed(2);
    amountUsd = +(amountRwf / rate).toFixed(2);
  } else {
    amountUsd = +(amountPaid * (commissionPct / 100)).toFixed(2);
    amountRwf = +(amountUsd * rate).toFixed(2);
  }

  if (db.isConnectedToPostgres()) {
    await db.query(
      `INSERT INTO referral_earnings (referrer_id, referee_id, subscription_id, commission_percent, amount_usd, amount_rwf)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [referrerId, refereeId, subscriptionId, commissionPct, amountUsd, amountRwf]
    );

    // Notify referrer
    await db.query(
      `INSERT INTO admin_notifications (title, message, type, reference_id)
       VALUES ($1, $2, 'referral_commission', $3)`,
      ['Referral Commission Earned', `You earned $${amountUsd} (${amountRwf} RWF) from a referral subscription activation!`, referrerId]
    );
  } else {
    db.memoryStore.referral_earnings.push({
      id: 'earn-' + Date.now(),
      referrer_id: referrerId,
      referee_id: refereeId,
      subscription_id: subscriptionId,
      commission_percent: commissionPct,
      amount_usd: amountUsd,
      amount_rwf: amountRwf,
      created_at: new Date()
    });
  }

  console.log(`💰 [REFERRAL COMMISSION] Referrer ${referrerId} awarded $${amountUsd} (${amountRwf} RWF)`);
}

// User Payment History
async function getUserPaymentHistory(userId) {
  if (db.isConnectedToPostgres()) {
    const res = await db.query(
      `SELECT p.*, s.plan_name 
       FROM payments p 
       LEFT JOIN subscriptions s ON p.subscription_id = s.id 
       WHERE p.user_id = $1 
       ORDER BY p.created_at DESC`,
      [userId]
    );
    return res.rows;
  } else {
    return db.memoryStore.payments.filter(p => p.user_id === userId);
  }
}

module.exports = {
  getPlans,
  checkUserSubscription,
  activateSubscription,
  getUserPaymentHistory,
  processReferralCommission
};
