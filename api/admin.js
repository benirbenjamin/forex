// Serverless handler for /api/admin/* actions
const db = require('../lib/db');
const {
  getAdminNotifications,
  markNotificationRead,
  getAllUsers,
  deleteUser,
  getAllP2POrders,
  updateP2PInventory,
  updateP2PConfig,
  savePlan,
  getReferralWithdrawals,
  processReferralWithdrawal,
  savePlatformSetting,
  getPlatformSettings,
  addAdmin
} = require('../lib/admin');
const { getPlans } = require('../lib/subscriptions');
const { JWT_SECRET } = require('../lib/auth');
const jwt = require('jsonwebtoken');

function getAdminUser(req) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const email = (decoded.email || '').toLowerCase();
    if (decoded.role === 'admin' || decoded.role === 'superadmin' || email === 'benirabok@gmail.com' || email === 'omarrukwaya@gmail.com') {
      if (!decoded.role || (decoded.role !== 'admin' && decoded.role !== 'superadmin')) {
        decoded.role = 'superadmin';
      }
      return decoded;
    }
    return null;
  } catch (e) {
    return null;
  }
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const admin = getAdminUser(req);
  if (!admin) {
    return res.status(403).json({ error: 'Access denied. Administrative role required.' });
  }

  let action = req.query.action || null;
  const sub = req.query.sub || null;
  if (!action && req.url) {
    const parts = req.url.split('?')[0].split('/').filter(Boolean);
    action = parts[parts.indexOf('admin') + 1] || null;
  }

  try {
    // 1. Notifications (GET /api/admin/notifications)
    if (action === 'notifications' && req.method === 'GET') {
      const data = await getAdminNotifications();
      return res.status(200).json(data);
    }

    // 1b. Mark Notification Read (POST /api/admin/notifications/read)
    if (action === 'notifications' && sub === 'read' && req.method === 'POST') {
      let body = req.body;
      if (typeof body === 'string') { try { body = JSON.parse(body); } catch(e){} }
      await markNotificationRead(body ? body.notifId : 'all');
      return res.status(200).json({ success: true });
    }

    // 2. Users List (GET /api/admin/users)
    if (action === 'users' && req.method === 'GET') {
      const users = await getAllUsers();
      return res.status(200).json({ users });
    }

    // 2b. Delete User (DELETE /api/admin/users or /api/admin/users/:id)
    if (action === 'users' && req.method === 'DELETE') {
      const targetId = sub || req.query.id;
      const result = await deleteUser(admin.role, targetId);
      return res.status(200).json(result);
    }

    // 3. P2P Orders (GET /api/admin/p2p/orders)
    if (action === 'p2p' && req.method === 'GET') {
      const orders = await getAllP2POrders();
      return res.status(200).json({ orders });
    }

    // 4. Update P2P Config / Inventory (POST /api/admin/p2p/config or /api/admin/p2p/inventory)
    if (action === 'p2p' && (sub === 'config' || sub === 'inventory') && req.method === 'POST') {
      let body = req.body;
      if (typeof body === 'string') { try { body = JSON.parse(body); } catch(e){} }
      const result = await updateP2PInventory(body || {});
      return res.status(200).json({ success: true, inventory: result });
    }

    // 5. Subscription Plans (GET/POST /api/admin/plans)
    if (action === 'plans') {
      if (req.method === 'GET') {
        const plans = await getPlans();
        return res.status(200).json({ plans });
      }
      if (req.method === 'POST') {
        let body = req.body;
        if (typeof body === 'string') { try { body = JSON.parse(body); } catch(e){} }
        const result = await savePlan(body || {});
        return res.status(200).json({ success: true, plan: result });
      }
    }

    // 5b. Affiliate Commission Withdrawals (GET/POST /api/admin/withdrawals)
    if (action === 'withdrawals') {
      if (req.method === 'GET') {
        const list = await getReferralWithdrawals();
        return res.status(200).json({ withdrawals: list });
      }
      if (req.method === 'POST') {
        let body = req.body;
        if (typeof body === 'string') { try { body = JSON.parse(body); } catch(e){} }
        const result = await processReferralWithdrawal(admin.role, body || {});
        return res.status(200).json(result);
      }
    }

    // 6. Settings (POST /api/admin/settings)
    if (action === 'settings' && req.method === 'POST') {
      let body = req.body;
      if (typeof body === 'string') { try { body = JSON.parse(body); } catch(e){} }
      const result = await savePlatformSetting(admin.role, body.key, body.value);
      return res.status(200).json(result);
    }

    // 6b. Get Settings (GET /api/admin/settings)
    if (action === 'settings' && req.method === 'GET') {
      const settings = await getPlatformSettings(admin.role);
      return res.status(200).json({ success: true, settings });
    }

    // 7. Add Admin (POST /api/admin/add-admin)
    if (action === 'add-admin' && req.method === 'POST') {
      let body = req.body;
      if (typeof body === 'string') { try { body = JSON.parse(body); } catch(e){} }
      const newAdmin = await addAdmin(admin.role, body);
      return res.status(201).json({ success: true, admin: newAdmin });
    }

    return res.status(404).json({ error: 'Unknown admin action: ' + action });
  } catch (err) {
    return res.status(err.statusCode || 400).json({ error: err.message });
  }
};