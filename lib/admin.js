// Admin & Super Admin Management Module
// Protected roles:
// - Super Admin: benirabok@gmail.com (non-deletable, non-demotable; exclusive platform settings access)
// - Admin: omarrukwaya@gmail.com (non-deletable, non-demotable; full operational admin access)

const db = require('./db');
const bcrypt = require('bcryptjs');
const { touchAdminPresence } = require('./p2p');
const { getUsdToRwfRate, convertUsdToRwf } = require('./currency');

const PROTECTED_EMAILS = ['benirabok@gmail.com', 'omarrukwaya@gmail.com'];

// 1. Admin Notifications & Audio Alerts
async function getAdminNotifications() {
  touchAdminPresence();

  if (db.isConnectedToPostgres()) {
    const res = await db.query(
      `SELECT * FROM admin_notifications ORDER BY created_at DESC LIMIT 50`
    );
    const unreadCount = res.rows.filter(n => !n.is_read).length;
    return {
      notifications: res.rows,
      unreadCount,
      shouldPlaySound: unreadCount > 0
    };
  } else {
    const notifs = db.memoryStore.admin_notifications || [];
    const unreadCount = notifs.filter(n => !n.is_read).length;
    return {
      notifications: notifs,
      unreadCount,
      shouldPlaySound: unreadCount > 0
    };
  }
}

async function markNotificationRead(notifId) {
  if (db.isConnectedToPostgres()) {
    if (notifId === 'all') {
      await db.query('UPDATE admin_notifications SET is_read = TRUE WHERE is_read = FALSE');
    } else {
      await db.query('UPDATE admin_notifications SET is_read = TRUE WHERE id = $1', [notifId]);
    }
  } else {
    if (notifId === 'all') {
      db.memoryStore.admin_notifications.forEach(n => n.is_read = true);
    } else {
      const n = db.memoryStore.admin_notifications.find(x => x.id === notifId);
      if (n) n.is_read = true;
    }
  }
  return { success: true };
}

// 2. User Management (CRUD)
async function getAllUsers(search = '') {
  let queryText = `
    SELECT u.id, u.full_name, u.email, u.phone, u.role, u.referral_code, u.email_verified, 
           u.failed_login_attempts, u.lockout_until, u.created_at,
           (SELECT COUNT(*) FROM devices d WHERE d.user_id = u.id) as device_count,
           (SELECT COUNT(*) FROM referrals r WHERE r.referrer_id = u.id) as referral_count,
           (SELECT status FROM subscriptions s WHERE s.user_id = u.id AND s.expires_at > NOW() ORDER BY s.expires_at DESC LIMIT 1) as sub_status
    FROM users u
  `;

  if (search) {
    queryText += ` WHERE LOWER(u.full_name) LIKE LOWER($1) OR LOWER(u.email) LIKE LOWER($1) OR u.phone LIKE $1`;
  }
  queryText += ` ORDER BY u.created_at DESC LIMIT 100`;

  if (db.isConnectedToPostgres()) {
    const res = await db.query(queryText, search ? [`%${search}%`] : []);
    return res.rows.map(u => ({
      ...u,
      isProtected: PROTECTED_EMAILS.includes(u.email)
    }));
  } else {
    return db.memoryStore.users.map(u => ({
      id: u.id,
      full_name: u.full_name,
      email: u.email,
      phone: u.phone,
      role: u.role,
      referral_code: u.referral_code,
      email_verified: u.email_verified,
      created_at: u.created_at,
      device_count: 1,
      referral_count: 0,
      sub_status: 'active',
      isProtected: PROTECTED_EMAILS.includes(u.email)
    }));
  }
}

async function deleteUser(adminRole, userId) {
  let user;
  if (db.isConnectedToPostgres()) {
    const res = await db.query('SELECT * FROM users WHERE id = $1 LIMIT 1', [userId]);
    user = res.rows[0];
  } else {
    user = db.memoryStore.users.find(u => u.id === userId);
  }

  if (!user) throw new Error('User not found.');

  if (PROTECTED_EMAILS.includes(user.email)) {
    throw new Error('This administrative account is permanently protected and cannot be deleted.');
  }

  if (db.isConnectedToPostgres()) {
    await db.query('DELETE FROM users WHERE id = $1', [userId]);
  } else {
    db.memoryStore.users = db.memoryStore.users.filter(u => u.id !== userId);
  }

  return { success: true, message: `User ${user.email} deleted.` };
}

// 3. Plans CRUD
async function savePlan({ id, name, slug, durationDays, priceUsd, priceRwf, isActive }) {
  const rate = await getUsdToRwfRate();
  const calculatedRwf = priceRwf ? +priceRwf : convertUsdToRwf(+priceUsd, rate);

  if (id) {
    // Update
    if (db.isConnectedToPostgres()) {
      const res = await db.query(
        `UPDATE plans 
         SET name = $1, duration_days = $2, price_usd = $3, price_rwf = $4, is_active = $5 
         WHERE id = $6 RETURNING *`,
        [name, durationDays, priceUsd, calculatedRwf, isActive !== false, id]
      );
      return res.rows[0];
    } else {
      const p = db.memoryStore.plans.find(x => x.id === id);
      if (p) {
        p.name = name;
        p.duration_days = durationDays;
        p.price_usd = priceUsd;
        p.price_rwf = calculatedRwf;
        p.is_active = isActive !== false;
      }
      return p;
    }
  } else {
    // Create new
    const cleanSlug = slug || name.toLowerCase().replace(/[^a-z0-9]/g, '-');
    if (db.isConnectedToPostgres()) {
      const res = await db.query(
        `INSERT INTO plans (name, slug, duration_days, price_usd, price_rwf, is_active)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [name, cleanSlug, durationDays, priceUsd, calculatedRwf, isActive !== false]
      );
      return res.rows[0];
    } else {
      const newP = { id: 'plan-' + Date.now(), name, slug: cleanSlug, duration_days: durationDays, price_usd: priceUsd, price_rwf: calculatedRwf, is_active: true };
      db.memoryStore.plans.push(newP);
      return newP;
    }
  }
}

// 4. Manually Assign Subscription to User
async function adminGrantSubscription({ userId, planName, durationDays }) {
  const days = parseInt(durationDays) || 30;
  const startsAt = new Date();
  const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

  if (db.isConnectedToPostgres()) {
    const res = await db.query(
      `INSERT INTO subscriptions (user_id, plan_name, status, starts_at, expires_at, amount_paid, currency, payment_method)
       VALUES ($1, $2, 'active', $3, $4, 0, 'USD', 'admin_granted')
       RETURNING *`,
      [userId, planName || `Admin Granted (${days} Days)`, startsAt, expiresAt]
    );
    return res.rows[0];
  } else {
    const sub = {
      id: 'sub-admin-' + Date.now(),
      user_id: userId,
      plan_name: planName || `Admin Granted (${days} Days)`,
      status: 'active',
      starts_at: startsAt,
      expires_at: expiresAt,
      amount_paid: 0,
      currency: 'USD',
      payment_method: 'admin_granted'
    };
    db.memoryStore.subscriptions.push(sub);
    return sub;
  }
}

// 5. P2P Management (Inventory, Rates, Payment Methods, Wallets)
async function updateP2PInventory({ availableInventory, totalInventory, sellPriceUsd, buyPriceUsd, feeType, feeAmount }) {
  if (db.isConnectedToPostgres()) {
    const res = await db.query(
      `UPDATE p2p_inventory 
       SET available_inventory = COALESCE($1, available_inventory),
           total_inventory = COALESCE($2, total_inventory),
           sell_price_usd = COALESCE($3, sell_price_usd),
           buy_price_usd = COALESCE($4, buy_price_usd),
           fee_type = COALESCE($5, fee_type),
           fee_amount = COALESCE($6, fee_amount),
           updated_at = NOW()
       RETURNING *`,
      [availableInventory, totalInventory, sellPriceUsd, buyPriceUsd, feeType, feeAmount]
    );
    return res.rows[0];
  } else {
    const inv = db.memoryStore.p2p_inventory[0];
    if (availableInventory !== undefined) inv.available_inventory = +availableInventory;
    if (totalInventory !== undefined) inv.total_inventory = +totalInventory;
    if (sellPriceUsd !== undefined) inv.sell_price_usd = +sellPriceUsd;
    if (buyPriceUsd !== undefined) inv.buy_price_usd = +buyPriceUsd;
    if (feeType) inv.fee_type = feeType;
    if (feeAmount !== undefined) inv.fee_amount = +feeAmount;
    return inv;
  }
}

async function getAllP2POrders() {
  if (db.isConnectedToPostgres()) {
    const res = await db.query(
      `SELECT o.*, u.full_name as user_name, u.email as user_email, u.phone as user_phone
       FROM p2p_orders o
       LEFT JOIN users u ON o.user_id = u.id
       ORDER BY o.created_at DESC LIMIT 100`
    );
    return res.rows;
  } else {
    return db.memoryStore.p2p_orders;
  }
}

// 6. Platform Settings (Super Admin Only)
async function getPlatformSettings(adminRole) {
  if (adminRole !== 'superadmin') {
    throw new Error('Access restricted: Only Super Admin can view platform settings.');
  }

  let settings = {};
  if (db.isConnectedToPostgres()) {
    const res = await db.query('SELECT key, value FROM platform_settings');
    for (const r of res.rows) {
      settings[r.key] = r.value;
    }
  } else {
    settings = db.memoryStore.platform_settings;
  }

  // Mask sensitive secret keys
  return {
    ...settings,
    flutterwave_secret_key_preview: process.env.FLUTTERWAVE_SECRET_KEY ? '••••••••' + process.env.FLUTTERWAVE_SECRET_KEY.slice(-4) : 'Not configured',
    google_client_id_preview: process.env.GOOGLE_CLIENT_ID ? 'Configured' : 'Not configured'
  };
}

async function savePlatformSetting(adminRole, key, value) {
  if (adminRole !== 'superadmin') {
    throw new Error('Access restricted: Only Super Admin can update platform settings.');
  }

  if (db.isConnectedToPostgres()) {
    await db.query(
      `INSERT INTO platform_settings (key, value, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (key) DO UPDATE
       SET value = $2, updated_at = NOW()`,
      [key, JSON.stringify(value)]
    );
  } else {
    db.memoryStore.platform_settings[key] = value;
  }

  return { success: true, key, message: 'Setting saved permanently in database.' };
}

// 7. Add Sub-Admin
async function addAdmin(creatorRole, { fullName, email, phone, password, role = 'admin' }) {
  if (creatorRole !== 'superadmin' && creatorRole !== 'admin') {
    throw new Error('Only existing Admins or Super Admins can add new administrators.');
  }

  const cleanEmail = email.trim().toLowerCase();
  const passwordHash = await bcrypt.hash(password, 12);

  if (db.isConnectedToPostgres()) {
    const res = await db.query(
      `INSERT INTO users (full_name, email, phone, password_hash, role, referral_code, email_verified)
       VALUES ($1, $2, $3, $4, $5, $6, TRUE)
       ON CONFLICT (email) DO UPDATE
       SET role = $5, password_hash = $4
       RETURNING id, full_name, email, role`,
      [fullName, cleanEmail, phone, passwordHash, role, 'adm' + Math.floor(Math.random() * 900 + 100)]
    );
    return res.rows[0];
  } else {
    const newAdm = {
      id: 'adm-' + Date.now(),
      full_name: fullName,
      email: cleanEmail,
      phone,
      password_hash: passwordHash,
      role,
      referral_code: 'adm' + Math.floor(Math.random() * 900 + 100),
      email_verified: true,
      created_at: new Date()
    };
    db.memoryStore.users.push(newAdm);
    return newAdm;
  }
}

module.exports = {
  getAdminNotifications,
  markNotificationRead,
  getAllUsers,
  deleteUser,
  savePlan,
  adminGrantSubscription,
  updateP2PInventory,
  getAllP2POrders,
  getPlatformSettings,
  savePlatformSetting,
  addAdmin,
  PROTECTED_EMAILS
};
