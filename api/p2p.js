// Serverless handler for /api/p2p/* actions
const {
  getP2PInfo,
  createBuyOrder,
  createSellOrder,
  getAdminPresence
} = require('../lib/p2p');
const { sendMessage, getOrderMessages } = require('../lib/chat');
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

  let action = req.query.action;
  if (!action) {
    const parts = req.url.split('?')[0].split('/');
    action = parts[parts.length - 1];
  }

  try {
    // 1. Get P2P Info (GET /api/p2p/info)
    if (action === 'info' && req.method === 'GET') {
      const info = await getP2PInfo();
      return res.status(200).json(info);
    }

    // 2. Buy USDT (POST /api/p2p/buy)
    if (action === 'buy' && req.method === 'POST') {
      const user = getUserFromReq(req);
      if (!user) return res.status(401).json({ error: 'Please log in to place a P2P order.' });
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const result = await createBuyOrder(user.id, body);
      return res.status(201).json(result);
    }

    // 3. Sell USDT (POST /api/p2p/sell)
    if (action === 'sell' && req.method === 'POST') {
      const user = getUserFromReq(req);
      if (!user) return res.status(401).json({ error: 'Please log in to place a P2P order.' });
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const result = await createSellOrder(user.id, body);
      return res.status(201).json(result);
    }

    // 4. Chat Messages (GET /api/p2p/chat/:orderId or GET /api/p2p?action=chat&orderId=...)
    if (action === 'chat' && req.method === 'GET') {
      const user = getUserFromReq(req);
      if (!user) return res.status(401).json({ error: 'Unauthorized: login required.' });
      const orderId = req.query.orderId || req.url.split('/').pop().split('?')[0];
      const messages = await getOrderMessages(orderId);
      return res.status(200).json({ messages });
    }

    // 5. Send Chat Message (POST /api/p2p/chat/:orderId)
    if (action === 'chat' && req.method === 'POST') {
      const user = getUserFromReq(req);
      if (!user) return res.status(401).json({ error: 'Unauthorized: login required.' });
      const orderId = req.query.orderId || req.url.split('/').pop().split('?')[0];
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const msg = await sendMessage({
        orderId,
        senderId: user.id,
        senderRole: user.role || 'user',
        message: body.message || ''
      });
      return res.status(201).json({ success: true, message: msg });
    }

    // Default: return P2P info
    const info = await getP2PInfo();
    return res.status(200).json(info);
  } catch (err) {
    const status = err.statusCode || 400;
    return res.status(status).json({ error: err.message });
  }
};
