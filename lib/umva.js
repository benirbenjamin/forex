// UMVA Pay Crypto Payment Gateway Integration
// Docs: POST https://umva.net/api/server-api-payment/initiate-crypto
// Merchant keys are stored in the database (platform_settings "umva") via the
// admin dashboard, with environment variables as a fallback.

const db = require('./db');

const UMVA_BASE = 'https://umva.net';

async function getUmvaSettings() {
  let settings = {};
  try {
    if (db.isConnectedToPostgres()) {
      const res = await db.query("SELECT value FROM platform_settings WHERE key = 'umva' LIMIT 1");
      if (res.rows[0] && res.rows[0].value) {
        let v = res.rows[0].value;
        if (typeof v === 'string') { try { v = JSON.parse(v); } catch (e) {} }
        settings = v || {};
      }
    } else if (db.memoryStore && db.memoryStore.platform_settings && db.memoryStore.platform_settings.umva) {
      settings = db.memoryStore.platform_settings.umva || {};
    }
  } catch (e) {
    // fall through to env
  }

  const publicKey = settings.publicKey || process.env.UMVA_PUBLIC_KEY || process.env.UMVA_PAY_PUBLIC_KEY || '';
  const secretKey = settings.secretKey || process.env.UMVA_SECRET_KEY || '';
  return { publicKey, secretKey, enabled: !!publicKey };
}

// Create a dedicated receiving address / crypto charge
async function initiateCryptoCharge({
  amount,
  cryptoCoin = 'USDT.TRC20',
  fiatCurrency = 'USD',
  identifier,
  ipnUrl,
  successUrl,
  cancelUrl,
  acceptPercentage = 100
}) {
  const { publicKey } = await getUmvaSettings();
  if (!publicKey) {
    const err = new Error('UMVA Pay is not configured. Set the UMVA public key in the admin Platform Settings.');
    err.statusCode = 400;
    throw err;
  }

  const payload = {
    public_key: publicKey,
    amount: Number(amount),
    crypto_coin: cryptoCoin,
    fiat_currency: fiatCurrency,
    ipn_url: ipnUrl,
    success_url: successUrl,
    cancel_url: cancelUrl,
    identifier,
    accept_percentage: acceptPercentage
  };

  let res;
  try {
    res = await fetch(`${UMVA_BASE}/api/server-api-payment/initiate-crypto`, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  } catch (e) {
    const err = new Error('Could not reach UMVA Pay: ' + e.message);
    err.statusCode = 502;
    throw err;
  }

  const data = await res.json().catch(() => null);
  if (!res.ok || !data || data.status === 'error' || !data.data) {
    const err = new Error(
      (data && (data.message || data.error)) || `UMVA Pay returned HTTP ${res.status}`
    );
    err.statusCode = 502;
    throw err;
  }

  return data.data;
}

module.exports = { getUmvaSettings, initiateCryptoCharge };
