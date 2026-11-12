// GET /api/signal -> live gold (XAU/USD), GBP/USD, GBP/JPY signals & analysis
const { getSignal, getAllSignals } = require('../lib/signals');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const symbol = req.query.symbol || 'XAUUSD';
    if (symbol.toLowerCase() === 'all') {
      const all = await getAllSignals();
      return res.status(200).json(all);
    }

    const signal = await getSignal(symbol);
    res.setHeader('Cache-Control', 's-maxage=5, stale-while-revalidate=10');
    return res.status(200).json(signal);
  } catch (err) {
    return res.status(502).json({
      error: 'Live signal error: ' + err.message,
      detail: 'Please check connection or try again.'
    });
  }
};
