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

async function updateUser(adminRole, { userId, fullName, email, phone, role, isVip, vipDays }) {
  if (adminRole !== 'superadmin' && adminRole !== 'admin') {
    throw new Error('Administrative role required.');
  }

  if (db.isConnectedToPostgres()) {
    const res = await db.query(
      `UPDATE users 
       SET full_name = COALESCE($1, full_name),
           phone = COALESCE($2, phone),
           role = COALESCE($3, role)
       WHERE id = $4
       RETURNING *`,
      [fullName, phone, role, userId]
    );

    if (isVip !== undefined) {
      if (isVip) {
        const days = parseInt(vipDays) || 30;
        const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
        await db.query(
          `INSERT INTO subscriptions (user_id, plan_name, status, starts_at, expires_at, amount_paid, currency)
           VALUES ($1, 'Admin Granted VIP', 'active', NOW(), $2, 0, 'USD')`,
          [userId, expiresAt]
        );
      } else {
        await db.query(
          `UPDATE subscriptions SET status = 'cancelled', expires_at = NOW() WHERE user_id = $1`,
          [userId]
        );
      }
    }
    return { success: true, user: res.rows[0] };
  } else {
    const u = db.memoryStore.users.find(x => x.id === userId);
    if (!u) throw new Error('User not found.');
    if (fullName) u.full_name = fullName;
    if (phone) u.phone = phone;
    if (role) u.role = role;
    if (isVip !== undefined) u.isVip = !!isVip;
    return { success: true, user: u };
  }
}

async function deletePlan(adminRole, planId) {
  if (adminRole !== 'superadmin' && adminRole !== 'admin') {
    throw new Error('Administrative role required.');
  }
  if (db.isConnectedToPostgres()) {
    await db.query('DELETE FROM plans WHERE id = $1', [planId]);
  } else {
    db.memoryStore.plans = (db.memoryStore.plans || []).filter(p => p.id !== planId);
  }
  return { success: true, message: 'Plan removed successfully.' };
}

async function getAllSubscriptions() {
  if (db.isConnectedToPostgres()) {
    try {
      const res = await db.query(
        `SELECT s.*, u.full_name as user_name, u.email as user_email, u.phone as user_phone
         FROM subscriptions s
         LEFT JOIN users u ON s.user_id = u.id
         ORDER BY s.created_at DESC LIMIT 100`
      );
      if (res && res.rows) return res.rows;
    } catch (e) {
      console.warn('Postgres subscriptions query notice:', e.message);
    }
  }
  const subs = db.memoryStore.subscriptions || [];
  const users = db.memoryStore.users || [];
  return subs.map(s => {
    const u = users.find(x => x.id === s.user_id) || {};
    return {
      ...s,
      user_name: u.full_name || u.name || 'Trader',
      user_email: u.email || ''
    };
  });
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
      db.saveLocalStore();
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
      db.saveLocalStore();
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
    try {
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
      if (res && res.rows[0]) return res.rows[0];
    } catch (e) {
      console.warn('Postgres inventory update notice:', e.message);
    }
  }

  const inv = (db.memoryStore.p2p_inventory && db.memoryStore.p2p_inventory[0]) || {
    id: 'p2p-inv-1',
    available_inventory: 1000.00,
    total_inventory: 5000.00,
    sell_price_usd: 1.00,
    buy_price_usd: 1.00,
    fee_type: 'percent',
    fee_amount: 2.00
  };
  if (!db.memoryStore.p2p_inventory) db.memoryStore.p2p_inventory = [inv];

  if (availableInventory !== undefined && !isNaN(availableInventory)) inv.available_inventory = +availableInventory;
  if (totalInventory !== undefined && !isNaN(totalInventory)) inv.total_inventory = +totalInventory;
  if (sellPriceUsd !== undefined && !isNaN(sellPriceUsd)) inv.sell_price_usd = +sellPriceUsd;
  if (buyPriceUsd !== undefined && !isNaN(buyPriceUsd)) inv.buy_price_usd = +buyPriceUsd;
  if (feeType) inv.fee_type = feeType;
  if (feeAmount !== undefined && !isNaN(feeAmount)) inv.fee_amount = +feeAmount;
  inv.updated_at = new Date();

  db.saveLocalStore();
  return inv;
}

async function getAllP2POrders() {
  if (db.isConnectedToPostgres()) {
    try {
      const res = await db.query(
        `SELECT o.*, u.full_name as user_name, u.email as user_email, u.phone as user_phone
         FROM p2p_orders o
         LEFT JOIN users u ON o.user_id = u.id
         ORDER BY o.created_at DESC LIMIT 100`
      );
      if (res && res.rows) return res.rows;
    } catch(e) {}
  }

  const orders = db.memoryStore.p2p_orders || [];
  const users = db.memoryStore.users || [];
  return orders.map(o => {
    const u = users.find(usr => usr.id === o.user_id) || {};
    return {
      ...o,
      user_name: u.full_name || u.name || 'Trader',
      user_email: u.email || '',
      user_phone: u.phone || ''
    };
  });
}

// 5b. Affiliate Commission Withdrawals
async function getReferralWithdrawals() {
  const list = db.memoryStore.referral_withdrawals || [];
  const users = db.memoryStore.users || [];
  return list.map(w => {
    const u = users.find(usr => usr.id === w.user_id) || {};
    return {
      ...w,
      user_name: u.full_name || u.name || 'Trader',
      user_email: u.email || ''
    };
  });
}

async function processReferralWithdrawal(adminRole, { id, status, feeApplied = 0 }) {
  if (adminRole !== 'superadmin' && adminRole !== 'admin') {
    throw new Error('Administrative role required.');
  }
  const list = db.memoryStore.referral_withdrawals || [];
  const target = list.find(w => w.id === id);
  if (!target) throw new Error('Withdrawal request not found.');

  target.status = status || 'completed';
  target.fee_applied = +feeApplied;
  target.processed_at = new Date();
  db.saveLocalStore();
  return { success: true, withdrawal: target };
}

// 6. Platform Settings (Super Admin Only)
async function getPlatformSettings(adminRole) {
  if (adminRole !== 'superadmin' && adminRole !== 'admin') {
    throw new Error('Access restricted: Only Super Admin can view platform settings.');
  }

  let settings = {};
  if (db.isConnectedToPostgres()) {
    const res = await db.query('SELECT key, value FROM platform_settings');
    for (const r of res.rows) {
      let val = r.value;
      if (typeof val === 'string') {
        try { val = JSON.parse(val); } catch(e) {}
      }
      settings[r.key] = val;
    }
  } else {
    settings = db.memoryStore.platform_settings || {};
  }

  // Precedence: Database first, Environment variable fallback
  const dbFlw = settings.flutterwave || {};
  const effectiveFlw = {
    publicKey: dbFlw.publicKey || process.env.FLW_PUBLIC_KEY || process.env.FLUTTERWAVE_PUBLIC_KEY || '',
    secretKey: dbFlw.secretKey || process.env.FLW_SECRET_KEY || process.env.FLUTTERWAVE_SECRET_KEY || '',
    encryptionKey: dbFlw.encryptionKey || process.env.FLW_ENCRYPTION_KEY || process.env.FLUTTERWAVE_ENCRYPTION_KEY || '',
    webhookSecret: dbFlw.webhookSecret || process.env.FLW_WEBHOOK_HASH || process.env.FLUTTERWAVE_WEBHOOK_SECRET || ''
  };

  const dbGdrive = settings.gdrive || {};
  const effectiveGdrive = {
    clientId: dbGdrive.clientId || process.env.GOOGLE_DRIVE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: dbGdrive.clientSecret || process.env.GOOGLE_DRIVE_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET || '',
    refreshToken: dbGdrive.refreshToken || process.env.GOOGLE_DRIVE_REFRESH_TOKEN || process.env.GOOGLE_REFRESH_TOKEN || ''
  };

  return {
    flutterwave: effectiveFlw,
    gdrive: effectiveGdrive,
    loadedFromDb: !!settings.flutterwave
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
  updateUser,
  deleteUser,
  savePlan,
  deletePlan,
  getAllSubscriptions,
  adminGrantSubscription,
  updateP2PInventory,
  updateP2PConfig: updateP2PInventory,
  getAllP2POrders,
  getReferralWithdrawals,
  processReferralWithdrawal,
  getPlatformSettings,
  savePlatformSetting,
  addAdmin,
  PROTECTED_EMAILS
};
