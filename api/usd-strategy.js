// Serverless Function: GET /api/usd-strategy?timeframe=15m
// USD Strength Correlation Strategy for XAUUSD & BTCUSD (SwiftEdge UK data).
const { getUsdStrategySignals } = require('../lib/usdStrategy');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const timeframe = (req.query && req.query.timeframe) || '15m';
    const data = await getUsdStrategySignals(timeframe);
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: 'USD strategy error: ' + err.message });
  }
};
