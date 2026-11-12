// Live Currency Conversion (USD <-> RWF)
// Supports live public exchange rate API with cached fallback and Admin overrides

const db = require('./db');

let cachedRate = 1350.00;
let lastRateFetch = 0;

async function getUsdToRwfRate() {
  const now = Date.now();

  // Check if admin has set a custom rate in platform_settings
  try {
    if (db.isConnectedToPostgres()) {
      const res = await db.query("SELECT value FROM platform_settings WHERE key = 'usd_rwf_rate' LIMIT 1");
      if (res.rowCount > 0 && res.rows[0].value && res.rows[0].value.rate) {
        if (!res.rows[0].value.auto_update) {
          return +res.rows[0].value.rate;
        }
      }
    }
  } catch (e) {}

  // Cache hit within 1 hour
  if (now - lastRateFetch < 3600000 && cachedRate) {
    return cachedRate;
  }

  // Fetch live exchange rate from free open API
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch('https://open.er-api.com/v6/latest/USD', { signal: controller.signal });
    clearTimeout(timeout);
    if (res.ok) {
      const data = await res.json();
      if (data && data.rates && data.rates.RWF) {
        cachedRate = +data.rates.RWF.toFixed(2);
        lastRateFetch = now;
        return cachedRate;
      }
    }
  } catch (err) {
    // Fallback gracefully to default market rate
  }

  return cachedRate || 1350.00;
}

function convertUsdToRwf(usdAmount, rate) {
  return Math.round(usdAmount * (rate || cachedRate));
}

function convertRwfToUsd(rwfAmount, rate) {
  return +(rwfAmount / (rate || cachedRate)).toFixed(2);
}

module.exports = {
  getUsdToRwfRate,
  convertUsdToRwf,
  convertRwfToUsd
};
