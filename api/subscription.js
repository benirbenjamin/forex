// Serverless Function: /api/subscription/*
const { getPlans, activateSubscription } = require('../lib/subscriptions');
const { getUsdToRwfRate } = require('../lib/currency');
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
      return res.status(200).json({
        success: true,
        plans,
        exchangeRate: rate
      });
    }

    // 2. Checkout / Unlock Plan
    if (action === 'checkout' && req.method === 'POST') {
      const user = getUserFromReq(req);
      if (!user) return res.status(401).json({ error: 'Authentication required to subscribe.' });

      let body = req.body;
      if (typeof body === 'string') { try { body = JSON.parse(body); } catch(e){} }
      const { planId, customDays, phone, paymentMethod, currency = 'USD' } = body || {};

      const plans = await getPlans();
      let plan = plans.find(p => p.id === planId || p.slug === planId);

      // Support custom days pricing ($20/30 days = $0.67/day)
      if (!plan && (customDays || (planId && planId.startsWith('custom_')))) {
        const days = Math.max(1, parseInt(customDays || planId.replace(/[^0-9]/g, '')) || 30);
        const priceUsd = Math.max(1.0, +(days * (20 / 30)).toFixed(2));
        plan = {
          id: `custom_${days}d`,
          slug: `custom_${days}d`,
          name: `Custom ${days} Days VIP Pass`,
          durationDays: days,
          priceUsd: priceUsd
        };
      }

      if (!plan) return res.status(404).json({ error: 'Selected subscription plan not found.' });

      const currencyRates = {
        USD: 1.0, RWF: 1450.0, KES: 130.0, UGX: 3720.0, TZS: 2600.0,
        NGN: 1620.0, GHS: 15.5, ZAR: 18.2, EUR: 0.92, GBP: 0.79
      };
      const curKey = (currency || 'USD').toUpperCase();
      const rate = currencyRates[curKey] || 1.0;
      const payableAmount = (plan.priceUsd * rate).toFixed(2);

      return res.status(200).json({
        success: true,
        message: `Payment request initialized for ${plan.name} (${payableAmount} ${curKey}). Please confirm the mobile money prompt or card authorization.`,
        plan,
        phone,
        currency: curKey,
        amount: payableAmount,
        paymentUrl: `https://checkout.flutterwave.com/pay/fds_${plan.slug}_${Date.now()}`
      });
    }

    // 3. Activate Subscription (POST /api/subscription?action=activate)
    if (action === 'activate' && req.method === 'POST') {
      const user = getUserFromReq(req);
      if (!user) return res.status(401).json({ error: 'Authentication required to activate.' });

      let body = req.body;
      if (typeof body === 'string') { try { body = JSON.parse(body); } catch(e){} }
      const { planId, planName, durationDays, amountPaid, currency = 'USD', paymentMethod = 'flutterwave', txRef } = body || {};

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
    return res.status(500).json({ error: err.message });
  }
};
