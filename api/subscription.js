// Serverless Function: /api/subscription/*
// Payments are collected exclusively via UMVA Pay (crypto gateway).
const { getPlans, activateSubscription, checkUserSubscription } = require('../lib/subscriptions');
const { getUsdToRwfRate } = require('../lib/currency');
const { initiateCryptoCharge } = require('../lib/umva');
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

function buildBaseUrl(req) {
  const host = (req.headers['x-forwarded-host'] || req.headers['host'] || 'localhost:3000').split(',')[0].trim();
  const proto = (req.headers['x-forwarded-proto'] || 'https').split(',')[0].trim();
  return `${proto}://${host}`;
}

// Resolve a plan (or custom-days plan) from plans list.
function resolvePlan(plans, planId, customDays) {
  let plan = plans.find(p => p.id === planId || p.slug === planId);
  if (!plan && (customDays || (planId && String(planId).startsWith('custom_')))) {
    const days = Math.max(1, parseInt(customDays || String(planId).replace(/[^0-9]/g, '')) || 30);
    const priceUsd = Math.max(1.0, +(days * (20 / 30)).toFixed(2));
    plan = {
      id: `custom_${days}d`,
      slug: `custom_${days}d`,
      name: `Custom ${days} Days VIP Pass`,
      durationDays: days,
      duration_days: days,
      priceUsd,
      price_usd: priceUsd
    };
  }
  return plan;
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  let action = req.query.action || null;
  if (!action && req.url) {
    const parts = req.url.split('?')[0].split('/').filter(Boolean);
    action = parts[parts.indexOf('subscription') + 1] || null;
  }

  try {
    // 1. Get Live Subscription Plans
    if (!action || action === 'plans') {
      const plans = await getPlans();
      const rate = await getUsdToRwfRate();
      return res.status(200).json({ success: true, plans, exchangeRate: rate });
    }

    // 2. Checkout — create a UMVA Pay crypto charge
    if (action === 'checkout' && req.method === 'POST') {
      const user = getUserFromReq(req);
      if (!user) return res.status(401).json({ error: 'Authentication required to subscribe.' });

      let body = req.body;
      if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) {} }
      const { planId, customDays, cryptoCoin } = body || {};

      const plans = await getPlans();
      const plan = resolvePlan(plans, planId, customDays);
      if (!plan) return res.status(404).json({ error: 'Selected subscription plan not found.' });

      const priceUsd = Number(plan.priceUsd || plan.price_usd || 20);
      const planKey = plan.slug || plan.id || `custom_${customDays || 30}d`;
      // identifier is parsed again in the IPN webhook (format: FDS~planKey~userId~ts)
      const identifier = `FDS~${planKey}~${user.id}~${Date.now()}`;

      const base = buildBaseUrl(req);
      const charge = await initiateCryptoCharge({
        amount: priceUsd,
        cryptoCoin: cryptoCoin || 'USDT.TRC20',
        fiatCurrency: 'USD',
        identifier,
        ipnUrl: `${base}/api/subscription?action=umva-ipn`,
        successUrl: `${base}/subscriptions?umva=success`,
        cancelUrl: `${base}/subscriptions?umva=cancel`
      });

      return res.status(200).json({
        success: true,
        message: `Send exactly the crypto amount to the address below to activate ${plan.name}.`,
        plan: { ...plan, priceUsd },
        identifier,
        walletAddress: charge.wallet_address,
        cryptoAmount: charge.crypto_amount,
        cryptoCoin: charge.crypto_coin,
        network: charge.network,
        trx: charge.trx
      });
    }

    // 3. UMVA Pay IPN webhook (public — called by UMVA on confirmation)
    if (action === 'umva-ipn') {
      let body = req.body;
      if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
      body = body || {};

      const identifier =
        body.identifier || body.order_id || body.orderId || body.reference ||
        (body.data && body.data.identifier) || '';
      const statusRaw = String(
        body.status || body.payment_status || (body.data && body.data.status) || ''
      ).toLowerCase();
      const paid =
        ['success', 'successful', 'confirmed', 'completed', 'paid', 'finished'].includes(statusRaw) ||
        body.confirmed === true || (body.data && body.data.confirmed === true);

      // Not one of our identifier formats -> acknowledge and ignore.
      if (!identifier || String(identifier).indexOf('FDS~') !== 0) {
        return res.status(200).json({ received: true });
      }

      const parts = String(identifier).split('~');
      const planKey = parts[1];
      const userId = parts[2];
      if (!userId) return res.status(200).json({ received: true });
      if (!paid) return res.status(200).json({ received: true, pending: true });

      const plans = await getPlans();
      let plan = plans.find(p => p.slug === planKey || p.id === planKey);
      let days = plan ? (plan.duration_days || plan.durationDays || 30) : 30;
      let priceUsd = plan ? Number(plan.price_usd || plan.priceUsd || 20) : 20;
      let planName = plan ? plan.name : `${days} Days VIP Access`;
      if (!plan && String(planKey).startsWith('custom_')) {
        days = Math.max(1, parseInt(String(planKey).replace(/[^0-9]/g, '')) || 30);
        priceUsd = Math.max(1.0, +(days * (20 / 30)).toFixed(2));
        planName = `Custom ${days} Days VIP Pass`;
      }

      await activateSubscription(userId, {
        planId: planKey || 'vip_standard',
        planName,
        durationDays: days,
        amountPaid: priceUsd,
        currency: 'USD',
        paymentMethod: 'umva',
        txRef: identifier
      });

      return res.status(200).json({ success: true, message: 'Subscription activated via UMVA Pay.' });
    }

    // 4. Status — poll whether the UMVA payment activated the subscription
    if (action === 'status') {
      const user = getUserFromReq(req);
      if (!user) return res.status(401).json({ error: 'Authentication required.' });
      const status = await checkUserSubscription(user.id);
      return res.status(200).json(status);
    }

    // 5. Activate (kept for compatibility; admin/manual grants use this)
    if (action === 'activate' && req.method === 'POST') {
      const user = getUserFromReq(req);
      if (!user) return res.status(401).json({ error: 'Authentication required to activate.' });

      let body = req.body;
      if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) {} }
      const { planId, planName, durationDays, amountPaid, currency = 'USD', paymentMethod = 'umva', txRef } = body || {};

      const days = parseInt(durationDays) || 30;
      const activatedSub = await activateSubscription(user.id, {
        planId: planId || 'vip_standard',
        planName: planName || `${days} Days VIP Access`,
        durationDays: days,
        amountPaid: parseFloat(amountPaid) || 20.0,
        currency,
        paymentMethod,
        txRef
      });

      return res.status(200).json({
        success: true,
        message: 'VIP Subscription successfully activated!',
        subscription: activatedSub
      });
    }

    return res.status(404).json({ error: 'Unknown subscription action.' });
  } catch (err) {
    return res.status(err.statusCode || 500).json({ error: err.message });
  }
};
