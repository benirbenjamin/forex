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
      const { planId, phone, paymentMethod } = body || {};

      const plans = await getPlans();
      const plan = plans.find(p => p.id === planId || p.slug === planId);
      if (!plan) return res.status(404).json({ error: 'Selected subscription plan not found.' });

      return res.status(200).json({
        success: true,
        message: `Payment request initialized for ${plan.name}. Please confirm the prompt sent to your mobile phone.`,
        plan,
        phone
      });
    }

    return res.status(404).json({ error: 'Unknown subscription action.' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
