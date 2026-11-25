// Serverless handler for /api/p2p/* actions
const fs = require('fs');
const path = require('path');
const os = require('os');
const {
  getP2PInfo,
  createBuyOrder,
  createSellOrder,
  uploadAndVerifyScreenshot,
  confirmUserSentPayment,
  submitDisputeClaim,
  getAdminPresence
} = require('../lib/p2p');
const { sendMessage, getOrderMessages, getAllChatThreads } = require('../lib/chat');
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

    // 4. Upload & Verify Proof (POST /api/p2p/upload-proof)
    if (action === 'upload-proof' && req.method === 'POST') {
      const user = getUserFromReq(req);
      if (!user) return res.status(401).json({ error: 'Please log in to upload proof.' });
      let body = req.body;
      if (typeof body === 'string') { try { body = JSON.parse(body); } catch(e){} }
      const { orderId, imageBase64, filename, mimeType } = body || {};
      if (!orderId) return res.status(400).json({ error: 'Order ID is required.' });
      if (!imageBase64) return res.status(400).json({ error: 'Screenshot image data is required.' });

      const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(cleanBase64, 'base64');
      const tempPath = path.join(os.tmpdir(), `receipt_${orderId}_${Date.now()}.png`);
      fs.writeFileSync(tempPath, buffer);

      try {
        const result = await uploadAndVerifyScreenshot(
          orderId,
          user.id,
          tempPath,
          filename || 'receipt.png',
          mimeType || 'image/png',
          buffer.length
        );
        return res.status(200).json(result);
      } finally {
        try { if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath); } catch(e){}
      }
    }

    // 5. Confirm Sent (POST /api/p2p/confirm-sent)
    if ((action === 'confirm-sent' || action === 'confirm-payment') && req.method === 'POST') {
      const user = getUserFromReq(req);
      if (!user) return res.status(401).json({ error: 'Please log in.' });
      let body = req.body;
      if (typeof body === 'string') { try { body = JSON.parse(body); } catch(e){} }
      const { orderId } = body || {};
      const result = await confirmUserSentPayment(orderId, user.id);
      return res.status(200).json(result);
    }

    // 6. Dispute (POST /api/p2p/dispute)
    if (action === 'dispute' && req.method === 'POST') {
      const user = getUserFromReq(req);
      if (!user) return res.status(401).json({ error: 'Please log in.' });
      let body = req.body;
      if (typeof body === 'string') { try { body = JSON.parse(body); } catch(e){} }
      const { orderId, disputeTxId, disputeHash, disputeReason } = body || {};
      const result = await submitDisputeClaim(orderId, user.id, {
        disputeTxId: disputeTxId || 'MANUAL-CLAIM',
        disputeHash: disputeHash || 'MANUAL-HASH',
        disputeReason: disputeReason || 'User reported dispute'
      });
      return res.status(200).json(result);
    }

    // 4. All Chat Threads for Admin Panel (GET /api/p2p/threads)
    if ((action === 'threads' || action === 'chat-threads') && req.method === 'GET') {
      const user = getUserFromReq(req);
      if (!user || (user.role !== 'admin' && user.role !== 'superadmin')) {
        return res.status(403).json({ error: 'Admin access required.' });
      }
      const threads = await getAllChatThreads();
      return res.status(200).json({ threads });
    }

    // 5. Chat Messages (GET /api/p2p/chat/:orderId or GET /api/p2p?action=chat&orderId=...)
    if (action === 'chat' && req.method === 'GET') {
      const user = getUserFromReq(req);
      if (!user) return res.status(401).json({ error: 'Unauthorized: login required.' });
      const orderId = req.query.orderId || req.url.split('/').pop().split('?')[0];
      const messages = await getOrderMessages(orderId);
      return res.status(200).json({ messages });
    }

    // 6. Send Chat Message (POST /api/p2p/chat/:orderId)
    if (action === 'chat' && req.method === 'POST') {
      const user = getUserFromReq(req);
      if (!user) return res.status(401).json({ error: 'Unauthorized: login required.' });
      const orderId = req.query.orderId || req.url.split('/').pop().split('?')[0];
      let body = req.body;
      if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch(e) { body = { message: body }; }
      }
      const text = (body && body.message) ? body.message : '';
      const msg = await sendMessage({
        orderId,
        senderId: user.id,
        senderRole: user.role || 'user',
        message: text
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
