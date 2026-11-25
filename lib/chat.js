// Real-time Support Chat between User & Admin for P2P Orders
// Strictly Admin <-> User (No user-to-user communication)
// Supports attachments up to 5MB with error validation

const db = require('./db');
const { uploadToGoogleDrive } = require('./gdrive');
const { touchAdminPresence } = require('./p2p');

// Send a message in order chat
async function sendMessage({ orderId, senderId, senderRole, message, file }) {
  let attachmentUrl = null;
  let fileName = null;
  let fileSize = 0;

  if (senderRole === 'admin' || senderRole === 'superadmin') {
    touchAdminPresence();
  }

  // Handle optional file attachment (< 5MB)
  if (file) {
    if (file.size > 5 * 1024 * 1024) {
      throw new Error('Attachment exceeds 5MB limit. Please upload an image smaller than 5MB.');
    }

    const uploaded = await uploadToGoogleDrive(file.path, file.originalname, file.mimetype);
    attachmentUrl = uploaded.url;
    fileName = file.originalname;
    fileSize = file.size;
  }

  if (!message && !attachmentUrl) {
    throw new Error('Message or attachment is required.');
  }

  const baseMsg = {
    order_id: orderId,
    sender_id: senderId,
    sender_role: senderRole,
    message: message || '',
    attachment_url: attachmentUrl,
    file_name: fileName,
    file_size: fileSize
  };

  let chatMsg = null;

  if (db.isConnectedToPostgres()) {
    try {
      // p2p_chats.order_id is VARCHAR(120) so both real order UUIDs and
      // support thread IDs (e.g. 'support_general', 'support_<userId>') persist.
      const res = await db.query(
        `INSERT INTO p2p_chats (order_id, sender_id, sender_role, message, attachment_url, file_name, file_size)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [orderId, senderId, senderRole, baseMsg.message, attachmentUrl, fileName, fileSize]
      );
      chatMsg = res && res.rows && res.rows[0] ? res.rows[0] : null;
    } catch (e) {
      console.warn('p2p_chats insert failed, using in-memory fallback:', e.message);
      chatMsg = null;
    }

    // Best-effort: alert admin about a new trader message
    if (senderRole === 'user') {
      try {
        await db.query(
          `INSERT INTO admin_notifications (title, message, type, reference_id)
           VALUES ($1, $2, 'chat_message', $3)`,
          ['New Chat Message from Trader', `Trader sent a message on Order #${orderId}: "${(message || 'Attachment sent').slice(0, 50)}"`, orderId]
        );
      } catch (e) { /* non-fatal */ }
    }
  }

  // Fallback: if the DB insert failed (or we are in memory mode), store in the
  // in-memory layer so the message is NEVER lost and the next GET returns it.
  if (!chatMsg) {
    chatMsg = {
      id: 'chat-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8),
      ...baseMsg,
      created_at: new Date().toISOString()
    };
    if (!Array.isArray(db.memoryStore.p2p_chats)) db.memoryStore.p2p_chats = [];
    db.memoryStore.p2p_chats.push(chatMsg);
    try { if (typeof db.saveLocalStore === 'function') db.saveLocalStore(); } catch (e) {}
  }

  return chatMsg;
}

// Get messages for an order (merges DB + in-memory so nothing is ever lost)
async function getOrderMessages(orderId) {
  let dbRows = [];
  if (db.isConnectedToPostgres()) {
    try {
      const res = await db.query(
        `SELECT c.*, u.full_name as sender_name 
         FROM p2p_chats c
         LEFT JOIN users u ON c.sender_id = u.id
         WHERE c.order_id = $1 
         ORDER BY c.created_at ASC`,
        [orderId]
      );
      dbRows = (res && res.rows) ? res.rows : [];
    } catch (e) {
      console.warn('p2p_chats select failed, using in-memory:', e.message);
      dbRows = [];
    }
  }

  const memRows = (db.memoryStore.p2p_chats || []).filter(c => c.order_id === orderId);

  const seen = new Set();
  const merged = [];
  for (const m of [...dbRows, ...memRows]) {
    const key = m.id != null
      ? String(m.id)
      : `${m.created_at}|${m.sender_id}|${m.message}`;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(m);
  }
  merged.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  return merged;
}

// Get all chat threads for Admin Support Panel
async function getAllChatThreads() {
  if (db.isConnectedToPostgres()) {
    try {
      const res = await db.query(
        `SELECT DISTINCT ON (c.order_id)
           c.order_id as thread_id,
           c.order_id as "orderId",
           c.message as last_message,
           c.created_at as last_time,
           c.sender_role,
           u.full_name as trader_name,
           u.email as trader_email
         FROM p2p_chats c
         LEFT JOIN users u ON (c.sender_id = u.id)
         ORDER BY c.order_id, c.created_at DESC`
      );
      if (res && res.rows && res.rows.length) {
        return res.rows.map(r => ({ ...r, orderId: r.thread_id }));
      }
    } catch (e) {
      console.warn('Postgres chat threads query notice:', e.message);
    }
  }

  // Memory store fallback
  const map = new Map();
  const allChats = db.memoryStore.p2p_chats || [];
  for (const c of allChats) {
    const existing = map.get(c.order_id);
    if (!existing || new Date(c.created_at) > new Date(existing.last_time)) {
      const u = (db.memoryStore.users || []).find(usr => usr.id === c.sender_id) || {};
      map.set(c.order_id, {
        thread_id: c.order_id,
        orderId: c.order_id,
        last_message: c.message,
        last_time: c.created_at,
        sender_role: c.sender_role,
        trader_name: u.full_name || (c.sender_role === 'admin' ? 'Support' : 'Trader'),
        trader_email: u.email || ''
      });
    }
  }
  return Array.from(map.values()).sort((a, b) => new Date(b.last_time) - new Date(a.last_time));
}

module.exports = {
  sendMessage,
  getOrderMessages,
  getAllChatThreads
};
