const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

function cleanConnectionString(raw) {
  if (!raw) return null;
  return raw.replace(/([&?])channel_binding=[^&]*(&|$)/, '$1').replace(/[?&]$/, '');
}

let connectionString = cleanConnectionString(process.env.DATABASE_URL);

let pool = null;
let isConnectedToPostgres = false;

function initPool() {
  const connStr = cleanConnectionString(process.env.DATABASE_URL);
  if (!connStr) return;
  try {
    if (pool) {
      try { pool.end(); } catch (e) {}
    }
    pool = new Pool({
      connectionString: connStr,
      ssl: connStr.includes('localhost') ? false : { rejectUnauthorized: false },
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });
    isConnectedToPostgres = true;
  } catch (err) {
    console.error('Failed to initialize Postgres pool:', err.message);
    isConnectedToPostgres = false;
  }
}

if (connectionString) {
  initPool();
}

const fs = require('fs');
const path = require('path');
const LOCAL_DB_PATH = path.join(__dirname, '../data/local_db.json');

const superAdminHash = bcrypt.hashSync('1202!birthDATE', 10);
const adminHash = bcrypt.hashSync('Onlineboss1#$', 10);

const defaultAdmins = [
  {
    id: '00000000-0000-0000-0000-000000000001',
    full_name: 'Super Admin Beni',
    email: 'benirabok@gmail.com',
    phone: '+250780000001',
    password_hash: superAdminHash,
    role: 'superadmin',
    referral_code: 'super',
    email_verified: true,
    failed_login_attempts: 0,
    created_at: new Date()
  },
  {
    id: '00000000-0000-0000-0000-000000000002',
    full_name: 'Admin Omar Rukwaya',
    email: 'omarrukwaya@gmail.com',
    phone: '+250780000002',
    password_hash: adminHash,
    role: 'admin',
    referral_code: 'boss',
    email_verified: true,
    failed_login_attempts: 0,
    created_at: new Date()
  }
];

const defaultPlansList = [
  { id: '1', name: '1 Day Pass (24 Hours)', slug: '1-day', duration_days: 1, price_usd: 5, price_rwf: 6500 },
  { id: '2', name: '1 Week Access', slug: '1-week', duration_days: 7, price_usd: 25, price_rwf: 32500 },
  { id: '3', name: '1 Month Standard', slug: '1-month', duration_days: 30, price_usd: 70, price_rwf: 91000 },
  { id: '4', name: '3 Months Pro', slug: '3-months', duration_days: 90, price_usd: 180, price_rwf: 234000 },
  { id: '5', name: '6 Months Elite', slug: '6-months', duration_days: 320, price_usd: 320, price_rwf: 416000 },
  { id: '6', name: '1 Year VIP Institutional', slug: '1-year', duration_days: 365, price_usd: 550, price_rwf: 715000 }
];

// In-Memory Storage Fallback if DATABASE_URL is not set yet
const memoryStore = {
  users: [...defaultAdmins],
  devices: [],
  plans: [...defaultPlansList],
  subscriptions: [],
  payments: [],
  simulated_trades: [],
  p2p_inventory: [],
  p2p_payment_methods: [],
  p2p_admin_wallets: [],
  p2p_orders: [],
  p2p_chats: [],
  referrals: [],
  referral_earnings: [],
  referral_withdrawals: [],
  platform_settings: {},
  admin_notifications: []
};

function saveLocalStore() {
  if (!isConnectedToPostgres) {
    try {
      const dir = path.dirname(LOCAL_DB_PATH);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(LOCAL_DB_PATH, JSON.stringify(memoryStore, null, 2));
    } catch (e) {}
  }
}

function loadLocalStore() {
  try {
    if (fs.existsSync(LOCAL_DB_PATH)) {
      const parsed = JSON.parse(fs.readFileSync(LOCAL_DB_PATH, 'utf8'));
      if (parsed && typeof parsed === 'object') {
        for (const k of Object.keys(parsed)) {
          if (Array.isArray(parsed[k])) {
            memoryStore[k] = parsed[k];
          } else if (parsed[k] && typeof parsed[k] === 'object') {
            memoryStore[k] = Object.assign(memoryStore[k] || {}, parsed[k]);
          }
        }
        // Ensure default admins always exist
        for (const da of defaultAdmins) {
          if (!memoryStore.users.some(u => u.email.toLowerCase() === da.email.toLowerCase())) {
            memoryStore.users.push(da);
          }
        }
      }
    }
  } catch (e) {}
}

loadLocalStore();

let initDbPromise = null;
function ensureDatabaseInitialized() {
  if (!initDbPromise) {
    initDbPromise = initDatabase()
      .then(() => seedAdminsOnStartup())
      .catch(err => {
        console.warn('Auto database init notice:', err.message);
        return seedDefaultDataInMemory().then(() => seedAdminsOnStartup());
      });
  }
  return initDbPromise;
}

// Auto-seed admins on startup asynchronously
setTimeout(() => {
  seedAdminsOnStartup().catch(() => {});
}, 50);

// Generic query wrapper that supports both Neon PostgreSQL and memory fallback
async function query(text, params = []) {
  if (!pool && process.env.DATABASE_URL) {
    initPool();
  }

  if (pool && isConnectedToPostgres) {
    try {
      const res = await pool.query(text, params);
      return res;
    } catch (err) {
      console.warn('Database query warning/fallback:', err.message, text);
      // If table doesn't exist yet or connection timed out, fallback to memory
      return executeInMemoryQuery(text, params);
    }
  }
  
  // Minimal fallback query parser for in-memory store during initial setup
  return executeInMemoryQuery(text, params);
}

function executeInMemoryQuery(text, params) {
  const clean = text.trim();
  const lower = clean.toLowerCase();

  if (lower.startsWith('select')) {
    // Basic table router for memory store
    for (const table of Object.keys(memoryStore)) {
      if (lower.includes(`from ${table}`) || lower.includes(`from "${table}"`)) {
        let rows = memoryStore[table];
        return { rows: Array.isArray(rows) ? [...rows] : [], rowCount: rows.length || 0 };
      }
    }
    return { rows: [], rowCount: 0 };
  }

  return { rows: [], rowCount: 1 };
}

async function initDatabase() {
  console.log('🔄 Initializing database schema...');
  
  if (!pool || !isConnectedToPostgres) {
    console.warn('⚠️ No DATABASE_URL provided. Running with in-memory persistence layer. Provide DATABASE_URL for Neon PostgreSQL.');
    await seedDefaultDataInMemory();
    return;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Enable UUID extension
    await client.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`);

    // 1. Users Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        full_name VARCHAR(150) NOT NULL,
        email VARCHAR(150) UNIQUE NOT NULL,
        phone VARCHAR(50) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(30) DEFAULT 'user', -- 'user', 'admin', 'superadmin'
        referral_code VARCHAR(20) UNIQUE NOT NULL,
        referred_by VARCHAR(20),
        email_verified BOOLEAN DEFAULT FALSE,
        verification_code VARCHAR(10),
        verification_code_expires_at TIMESTAMPTZ,
        failed_login_attempts INT DEFAULT 0,
        lockout_until TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // 2. Devices Table (Strict fingerprinting: 1 account creation per device)
    await client.query(`
      CREATE TABLE IF NOT EXISTS devices (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        device_fingerprint VARCHAR(255) NOT NULL,
        user_agent TEXT,
        ip_address VARCHAR(100),
        first_seen_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_devices_fingerprint ON devices(device_fingerprint);
    `);

    // 3. Subscription Plans
    await client.query(`
      CREATE TABLE IF NOT EXISTS plans (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name VARCHAR(100) NOT NULL,
        slug VARCHAR(50) UNIQUE NOT NULL,
        duration_days INT NOT NULL,
        price_usd NUMERIC(10,2) NOT NULL,
        price_rwf NUMERIC(12,2) NOT NULL,
        features JSONB DEFAULT '[]',
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // 4. Subscriptions Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS subscriptions (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        plan_id UUID REFERENCES plans(id) ON DELETE SET NULL,
        plan_name VARCHAR(100) NOT NULL,
        status VARCHAR(30) DEFAULT 'trial', -- 'trial', 'active', 'expired', 'cancelled'
        starts_at TIMESTAMPTZ DEFAULT NOW(),
        expires_at TIMESTAMPTZ NOT NULL,
        amount_paid NUMERIC(10,2) DEFAULT 0,
        currency VARCHAR(10) DEFAULT 'USD',
        payment_method VARCHAR(50) DEFAULT 'free_trial',
        flutterwave_tx_ref VARCHAR(100),
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON subscriptions(user_id);
    `);

    // 5. Payments Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS payments (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        subscription_id UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
        flutterwave_tx_ref VARCHAR(100) UNIQUE,
        flutterwave_id VARCHAR(100),
        amount NUMERIC(12,2) NOT NULL,
        currency VARCHAR(10) NOT NULL,
        status VARCHAR(30) DEFAULT 'pending', -- 'pending', 'successful', 'failed', 'cancelled'
        payment_method VARCHAR(50) NOT NULL, -- 'flutterwave', 'manual'
        manual_sender_phone VARCHAR(50),
        manual_transaction_ref VARCHAR(100),
        proof_file_url TEXT,
        admin_confirmed_by UUID REFERENCES users(id) ON DELETE SET NULL,
        admin_notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // 6. Simulated Trades Table (Auto TP1, TP2, SL tracking)
    await client.query(`
      CREATE TABLE IF NOT EXISTS simulated_trades (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        symbol VARCHAR(20) NOT NULL, -- 'XAUUSD', 'GBPUSD', 'GBPJPY'
        side VARCHAR(10) NOT NULL,   -- 'BUY', 'SELL'
        lot_size NUMERIC(8,2) NOT NULL,
        entry_price NUMERIC(14,5) NOT NULL,
        sl_price NUMERIC(14,5),
        tp1_price NUMERIC(14,5),
        tp2_price NUMERIC(14,5),
        exit_price NUMERIC(14,5),
        pnl NUMERIC(12,2) DEFAULT 0,
        pnl_pips NUMERIC(10,2) DEFAULT 0,
        status VARCHAR(20) DEFAULT 'open', -- 'open', 'tp1', 'tp2', 'sl', 'closed'
        close_reason VARCHAR(100),
        opened_at TIMESTAMPTZ DEFAULT NOW(),
        closed_at TIMESTAMPTZ
      );
      CREATE INDEX IF NOT EXISTS idx_sim_trades_user ON simulated_trades(user_id);
      CREATE INDEX IF NOT EXISTS idx_sim_trades_status ON simulated_trades(status);
    `);

    // 7. P2P Crypto Inventory & Settings
    await client.query(`
      CREATE TABLE IF NOT EXISTS p2p_inventory (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        crypto_symbol VARCHAR(20) DEFAULT 'USDT',
        total_inventory NUMERIC(14,2) DEFAULT 1000.00,
        available_inventory NUMERIC(14,2) DEFAULT 1000.00,
        sell_price_usd NUMERIC(10,4) DEFAULT 1.00,
        buy_price_usd NUMERIC(10,4) DEFAULT 1.00,
        exchange_rate_rwf NUMERIC(10,2) DEFAULT 1350.00,
        fee_type VARCHAR(20) DEFAULT 'percent', -- 'percent', 'flat'
        fee_amount NUMERIC(10,2) DEFAULT 2.00,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // 8. P2P Payment Methods (Admin accounts for receiving fiat)
    await client.query(`
      CREATE TABLE IF NOT EXISTS p2p_payment_methods (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        provider_type VARCHAR(30) NOT NULL, -- 'momo', 'bank', 'airtel'
        provider_name VARCHAR(100) NOT NULL,
        account_name VARCHAR(150) NOT NULL,
        account_number VARCHAR(100) NOT NULL,
        instructions TEXT,
        is_active BOOLEAN DEFAULT TRUE,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // 9. P2P Admin Crypto Wallets (For receiving crypto on P2P Sell)
    await client.query(`
      CREATE TABLE IF NOT EXISTS p2p_admin_wallets (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        network VARCHAR(50) DEFAULT 'TRC20',
        address VARCHAR(150) NOT NULL,
        label VARCHAR(100) DEFAULT 'Admin TRC20 Wallet',
        is_active BOOLEAN DEFAULT TRUE,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // 10. P2P Orders Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS p2p_orders (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        order_type VARCHAR(20) NOT NULL, -- 'buy', 'sell'
        crypto_symbol VARCHAR(20) DEFAULT 'USDT',
        crypto_amount NUMERIC(14,4) NOT NULL,
        price_per_unit NUMERIC(12,4) NOT NULL,
        fee_amount NUMERIC(12,4) DEFAULT 0,
        total_fiat NUMERIC(14,2) NOT NULL,
        fiat_currency VARCHAR(10) DEFAULT 'USD',
        user_wallet_address VARCHAR(150),
        status VARCHAR(40) DEFAULT 'pending_payment',
        -- Status flow: 'pending_payment' -> 'payment_sent' -> 'payment_received' -> 'crypto_released' -> 'completed' or 'disputed'
        proof_screenshot_url TEXT,
        proof_analysis_result JSONB,
        proof_analysis_status VARCHAR(30), -- 'verified', 'rejected'
        admin_proof_url TEXT,
        dispute_tx_id VARCHAR(150),
        dispute_hash VARCHAR(150),
        dispute_reason TEXT,
        admin_notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_p2p_orders_user ON p2p_orders(user_id);
      CREATE INDEX IF NOT EXISTS idx_p2p_orders_status ON p2p_orders(status);
    `);

    // 11. P2P Support Chat Messages
    await client.query(`
      CREATE TABLE IF NOT EXISTS p2p_chats (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        order_id UUID REFERENCES p2p_orders(id) ON DELETE CASCADE,
        sender_id UUID REFERENCES users(id) ON DELETE CASCADE,
        sender_role VARCHAR(30) NOT NULL, -- 'user', 'admin'
        message TEXT,
        attachment_url TEXT,
        file_name VARCHAR(255),
        file_size INT,
        is_read BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_p2p_chats_order ON p2p_chats(order_id);
    `);

    // 12. Referrals & Earnings
    await client.query(`
      CREATE TABLE IF NOT EXISTS referrals (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        referrer_id UUID REFERENCES users(id) ON DELETE CASCADE,
        referee_id UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE,
        referral_code VARCHAR(20) NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS referral_earnings (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        referrer_id UUID REFERENCES users(id) ON DELETE CASCADE,
        referee_id UUID REFERENCES users(id) ON DELETE CASCADE,
        subscription_id UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
        commission_percent NUMERIC(5,2) DEFAULT 10.00,
        amount_usd NUMERIC(10,2) NOT NULL,
        amount_rwf NUMERIC(12,2) NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS referral_withdrawals (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        amount_requested NUMERIC(10,2) NOT NULL,
        fee_amount NUMERIC(10,2) DEFAULT 0,
        net_amount NUMERIC(10,2) NOT NULL,
        currency VARCHAR(10) DEFAULT 'USD',
        payment_details TEXT NOT NULL,
        status VARCHAR(30) DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
        admin_proof_url TEXT,
        admin_notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        processed_at TIMESTAMPTZ
      );
    `);

    // 13. Platform Settings (survives redeploys)
    await client.query(`
      CREATE TABLE IF NOT EXISTS platform_settings (
        key VARCHAR(100) PRIMARY KEY,
        value JSONB NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // 14. Admin Notifications (With continuous audio alerts)
    await client.query(`
      CREATE TABLE IF NOT EXISTS admin_notifications (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        title VARCHAR(200) NOT NULL,
        message TEXT NOT NULL,
        type VARCHAR(50) NOT NULL, -- 'p2p_order', 'p2p_screenshot', 'dispute', 'manual_payment', 'withdrawal'
        reference_id UUID,
        is_read BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_notifications_unread ON admin_notifications(is_read);
    `);

    // SEED INITIAL MANDATORY ADMINS (Non-deletable)
    // 1. Super Admin: benirabok@gmail.com with password '1202!birthDATE'
    const superAdminPasswordHash = await bcrypt.hash('1202!birthDATE', 12);
    await client.query(`
      INSERT INTO users (full_name, email, phone, password_hash, role, referral_code, email_verified)
      VALUES ($1, $2, $3, $4, 'superadmin', 'super', TRUE)
      ON CONFLICT (email) DO UPDATE
      SET password_hash = $4, role = 'superadmin', email_verified = TRUE;
    `, ['Super Admin Beni', 'benirabok@gmail.com', '+250780000001', superAdminPasswordHash]);

    // 2. Admin: omarrukwaya@gmail.com with password 'Onlineboss1#$'
    const adminPasswordHash = await bcrypt.hash('Onlineboss1#$', 12);
    await client.query(`
      INSERT INTO users (full_name, email, phone, password_hash, role, referral_code, email_verified)
      VALUES ($1, $2, $3, $4, 'admin', 'boss', TRUE)
      ON CONFLICT (email) DO UPDATE
      SET password_hash = $4, role = 'admin', email_verified = TRUE;
    `, ['Admin Omar Rukwaya', 'omarrukwaya@gmail.com', '+250780000002', adminPasswordHash]);

    // SEED DEFAULT SUBSCRIPTION PLANS
    const defaultPlans = [
      { name: '1 Day Pass (24 Hours)', slug: '1-day', duration_days: 1, price_usd: 5.00, price_rwf: 6500 },
      { name: '1 Week Access', slug: '1-week', duration_days: 7, price_usd: 25.00, price_rwf: 32500 },
      { name: '1 Month Standard', slug: '1-month', duration_days: 30, price_usd: 70.00, price_rwf: 91000 },
      { name: '3 Months Pro', slug: '3-months', duration_days: 90, price_usd: 180.00, price_rwf: 234000 },
      { name: '6 Months Elite', slug: '6-months', duration_days: 180, price_usd: 320.00, price_rwf: 416000 },
      { name: '1 Year VIP Institutional', slug: '1-year', duration_days: 365, price_usd: 550.00, price_rwf: 715000 }
    ];

    for (const p of defaultPlans) {
      await client.query(`
        INSERT INTO plans (name, slug, duration_days, price_usd, price_rwf)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (slug) DO NOTHING;
      `, [p.name, p.slug, p.duration_days, p.price_usd, p.price_rwf]);
    }

    // SEED DEFAULT P2P INVENTORY
    const invCheck = await client.query('SELECT id FROM p2p_inventory LIMIT 1;');
    if (invCheck.rowCount === 0) {
      await client.query(`
        INSERT INTO p2p_inventory (crypto_symbol, total_inventory, available_inventory, sell_price_usd, buy_price_usd, exchange_rate_rwf, fee_type, fee_amount)
        VALUES ('USDT', 1000.00, 1000.00, 1.00, 1.00, 1350.00, 'percent', 2.00);
      `);
    }

    // SEED DEFAULT P2P PAYMENT METHOD
    const pmCheck = await client.query('SELECT id FROM p2p_payment_methods LIMIT 1;');
    if (pmCheck.rowCount === 0) {
      await client.query(`
        INSERT INTO p2p_payment_methods (provider_type, provider_name, account_name, account_number, instructions)
        VALUES 
        ('momo', 'MTN Mobile Money Rwanda', 'Forex Double Sniper Ltd', '0788123456', 'Dial *182*1*1*0788123456*Amount# and save the SMS receipt screenshot.'),
        ('bank', 'Bank of Kigali (BK)', 'Forex Double Sniper Ltd', '00040-06912345-89', 'Transfer exact amount with reference your email or phone.');
      `);
    }

    // SEED DEFAULT ADMIN WALLET
    const walletCheck = await client.query('SELECT id FROM p2p_admin_wallets LIMIT 1;');
    if (walletCheck.rowCount === 0) {
      await client.query(`
        INSERT INTO p2p_admin_wallets (network, address, label)
        VALUES ('TRC20', 'TYDzsYUE286846286TT123498877TRC20ADMIN', 'Admin Primary USDT TRC20 Receiving Wallet');
      `);
    }

    // SEED PLATFORM SETTINGS
    const settings = [
      { key: 'referral_commission_pct', value: { percent: 10 } },
      { key: 'withdrawal_fee', value: { type: 'percent', amount: 2 } },
      { key: 'usd_rwf_rate', value: { rate: 1350.00, auto_update: true } },
      { key: 'storage_config', value: { provider: 'google_drive', folder_id: process.env.GOOGLE_DRIVE_FOLDER_ID || '' } }
    ];

    for (const s of settings) {
      await client.query(`
        INSERT INTO platform_settings (key, value)
        VALUES ($1, $2)
        ON CONFLICT (key) DO NOTHING;
      `, [s.key, s.value]);
    }

    await client.query('COMMIT');
    console.log('✅ Neon PostgreSQL database initialized & seeded successfully.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Database migration error:', err);
    throw err;
  } finally {
    client.release();
  }
}

async function seedDefaultDataInMemory() {
  loadLocalStore();
  const superAdminPasswordHash = await bcrypt.hash('1202!birthDATE', 10);
  const adminPasswordHash = await bcrypt.hash('Onlineboss1#$', 10);
  
  const adminsToEnsure = [
    {
      id: '00000000-0000-0000-0000-000000000001',
      full_name: 'Super Admin Beni',
      email: 'benirabok@gmail.com',
      phone: '+250780000001',
      password_hash: superAdminPasswordHash,
      role: 'superadmin',
      referral_code: 'super',
      email_verified: true,
      failed_login_attempts: 0,
      created_at: new Date()
    },
    {
      id: '00000000-0000-0000-0000-000000000002',
      full_name: 'Admin Omar Rukwaya',
      email: 'omarrukwaya@gmail.com',
      phone: '+250780000002',
      password_hash: adminPasswordHash,
      role: 'admin',
      referral_code: 'boss',
      email_verified: true,
      failed_login_attempts: 0,
      created_at: new Date()
    }
  ];

  for (const adm of adminsToEnsure) {
    const existing = memoryStore.users.find(u => u.email.toLowerCase() === adm.email.toLowerCase());
    if (existing) {
      existing.role = adm.role;
      existing.password_hash = adm.password_hash;
      existing.email_verified = true;
      existing.failed_login_attempts = 0;
      existing.lockout_until = null;
    } else {
      memoryStore.users.push(adm);
    }
  }
  saveLocalStore();

  memoryStore.plans = [
    { id: '1', name: '1 Day Pass (24 Hours)', slug: '1-day', duration_days: 1, price_usd: 5, price_rwf: 6500 },
    { id: '2', name: '1 Week Access', slug: '1-week', duration_days: 7, price_usd: 25, price_rwf: 32500 },
    { id: '3', name: '1 Month Standard', slug: '1-month', duration_days: 30, price_usd: 70, price_rwf: 91000 },
    { id: '4', name: '3 Months Pro', slug: '3-months', duration_days: 90, price_usd: 180, price_rwf: 234000 },
    { id: '5', name: '6 Months Elite', slug: '6-months', duration_days: 320, price_usd: 320, price_rwf: 416000 },
    { id: '6', name: '1 Year VIP Institutional', slug: '1-year', duration_days: 365, price_usd: 550, price_rwf: 715000 }
  ];

  memoryStore.p2p_inventory = [
    {
      id: 'inv-1',
      crypto_symbol: 'USDT',
      total_inventory: 1000,
      available_inventory: 1000,
      sell_price_usd: 1.00,
      buy_price_usd: 1.00,
      exchange_rate_rwf: 1350,
      fee_type: 'percent',
      fee_amount: 2.0
    }
  ];

  memoryStore.p2p_payment_methods = [
    {
      id: 'pm-1',
      provider_type: 'momo',
      provider_name: 'MTN Mobile Money Rwanda',
      account_name: 'Forex Double Sniper Ltd',
      account_number: '0788123456',
      instructions: 'Dial *182*1*1*0788123456*Amount# and upload receipt.',
      is_active: true
    }
  ];

  memoryStore.p2p_admin_wallets = [
    {
      id: 'w-1',
      network: 'TRC20',
      address: 'TYDzsYUE286846286TT123498877TRC20ADMIN',
      label: 'Admin Primary USDT TRC20 Receiving Wallet',
      is_active: true
    }
  ];
  console.log('✅ In-memory database store seeded.');
}

async function seedAdminsOnStartup() {
  const superAdminHash = await bcrypt.hash('1202!birthDATE', 12);
  const adminHash = await bcrypt.hash('Onlineboss1#$', 12);

  const admins = [
    { email: 'benirabok@gmail.com', name: 'Super Admin Beni', role: 'superadmin', hash: superAdminHash, phone: '+250780000001', ref: 'super' },
    { email: 'omarrukwaya@gmail.com', name: 'Admin Omar Rukwaya', role: 'admin', hash: adminHash, phone: '+250780000002', ref: 'boss' }
  ];

  for (const adm of admins) {
    const memIdx = memoryStore.users.findIndex(u => u.email.toLowerCase() === adm.email);
    const memUser = {
      id: adm.role === 'superadmin' ? '00000000-0000-0000-0000-000000000001' : '00000000-0000-0000-0000-000000000002',
      full_name: adm.name,
      name: adm.name,
      email: adm.email,
      phone: adm.phone,
      password_hash: adm.hash,
      role: adm.role,
      referral_code: adm.ref,
      email_verified: true,
      failed_login_attempts: 0,
      created_at: new Date()
    };
    if (memIdx >= 0) {
      memoryStore.users[memIdx] = Object.assign(memoryStore.users[memIdx], memUser);
    } else {
      memoryStore.users.push(memUser);
    }
  }
  saveLocalStore();

  if (isConnectedToPostgres && pool) {
    for (const adm of admins) {
      try {
        const existing = await pool.query('SELECT * FROM users WHERE LOWER(email) = $1 LIMIT 1', [adm.email]);
        if (existing.rowCount > 0) {
          try {
            await pool.query(
              'UPDATE users SET password_hash = $1, role = $2, email_verified = TRUE, failed_login_attempts = 0, lockout_until = NULL WHERE LOWER(email) = $3',
              [adm.hash, adm.role, adm.email]
            );
          } catch (e1) {
            await pool.query(
              'UPDATE users SET password = $1, role = $2 WHERE LOWER(email) = $3',
              [adm.hash, adm.role, adm.email]
            ).catch(() => {});
          }
        } else {
          try {
            await pool.query(
              `INSERT INTO users (full_name, email, phone, password_hash, role, referral_code, email_verified)
               VALUES ($1, $2, $3, $4, $5, $6, TRUE)`,
              [adm.name, adm.email, adm.phone, adm.hash, adm.role, adm.ref]
            );
          } catch (e2) {
            try {
              await pool.query(
                `INSERT INTO users (name, email, password_hash, role)
                 VALUES ($1, $2, $3, $4)`,
                [adm.name, adm.email, adm.hash, adm.role]
              );
            } catch (e3) {
              await pool.query(
                `INSERT INTO users (email, password, role)
                 VALUES ($1, $2, $3)`,
                [adm.email, adm.hash, adm.role]
              ).catch(() => {});
            }
          }
        }
      } catch (err) {
        console.error(`Auto-seed admin notice for ${adm.email}:`, err.message);
      }
    }
  }
}

module.exports = {
  query,
  pool,
  initDatabase,
  ensureDatabaseInitialized,
  seedAdminsOnStartup,
  saveLocalStore,
  loadLocalStore,
  memoryStore,
  isConnectedToPostgres: () => isConnectedToPostgres
};
