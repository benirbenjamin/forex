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

  let chatMsg;
  if (db.isConnectedToPostgres()) {
    const res = await db.query(
      `INSERT INTO p2p_chats (order_id, sender_id, sender_role, message, attachment_url, file_name, file_size)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [orderId, senderId, senderRole, message || '', attachmentUrl, fileName, fileSize]
    );
    chatMsg = res.rows[0];

    // If user sent, alert admin
    if (senderRole === 'user') {
      await db.query(
        `INSERT INTO admin_notifications (title, message, type, reference_id)
         VALUES ($1, $2, 'chat_message', $3)`,
        ['New Chat Message from Trader', `Trader sent a message on Order #${orderId}: "${(message || 'Attachment sent').slice(0, 50)}"`, orderId]
      );
    }
  } else {
    chatMsg = {
      id: 'chat-' + Date.now(),
      order_id: orderId,
      sender_id: senderId,
      sender_role: senderRole,
      message: message || '',
      attachment_url: attachmentUrl,
      file_name: fileName,
      file_size: fileSize,
      created_at: new Date()
    };
    db.memoryStore.p2p_chats.push(chatMsg);
  }

  return chatMsg;
}

// Get messages for an order
async function getOrderMessages(orderId) {
  if (db.isConnectedToPostgres()) {
    const res = await db.query(
      `SELECT c.*, u.full_name as sender_name 
       FROM p2p_chats c
       LEFT JOIN users u ON c.sender_id = u.id
       WHERE c.order_id = $1 
       ORDER BY c.created_at ASC`,
      [orderId]
    );
    return res.rows;
  } else {
    return db.memoryStore.p2p_chats.filter(c => c.order_id === orderId);
  }
}

module.exports = {
  sendMessage,
  getOrderMessages
};
