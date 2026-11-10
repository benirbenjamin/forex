// GET /api/signal  ->  live gold (XAU/USD) data, news tone and a BUY / SELL / WAIT decision.
// API keys stay on the server (Vercel environment variables), never in the browser.

const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
const sma = (arr, n) => arr.slice(-n).reduce((a, b) => a + b, 0) / Math.min(n, arr.length);

function atr(c, n = 14) {
  const tr = [];
  for (let i = 1; i < c.length; i++) {
    tr.push(Math.max(c[i].high - c[i].low, Math.abs(c[i].high - c[i - 1].close), Math.abs(c[i].low - c[i - 1].close)));
  }
  return sma(tr, n);
}

const rx = (list) => new RegExp('\\b(' + list.join('|') + ')\\b', 'i');
const BULL = rx(['rate cuts?', 'dovish', 'safe[- ]haven', 'weaker dollar', 'dollar (slips|falls|weakens|drops|slides)',
  'yields (fall|drop|slip|slide)', 'gold (rises|gains|climbs|jumps|surges|rallies|hits record|edges up)',
  'geopolitical', 'war', 'tensions', 'conflict', 'recession', 'central bank buying']);
const BEAR = rx(['rate hikes?', 'hawkish', 'stronger dollar', 'dollar (rises|gains|strengthens|jumps|climbs)',
  'yields (rise|climb|jump|surge)', 'gold (falls|drops|slips|slides|declines|retreats|edges down)',
  'profit[- ]taking', 'strong jobs', 'risk[- ]on']);

function headlineTone(h) {
  const b = BULL.test(h), s = BEAR.test(h);
  if (b && !s) return 1;
  if (s && !b) return -1;
  return 0;
}

async function getJson(url, opts) {
  const r = await fetch(url, opts);
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.json();
}

// Price source 1: OANDA (used when OANDA_TOKEN and OANDA_ACCOUNT_ID are set)
async function fromOanda() {
  const host = process.env.OANDA_HOST || 'https://api-fxtrade.oanda.com'; // practice: https://api-fxpractice.oanda.com
  const opts = { headers: { Authorization: 'Bearer ' + process.env.OANDA_TOKEN } };
  const base = `${host}/v3/accounts/${process.env.OANDA_ACCOUNT_ID}/instruments/XAU_USD/candles`;
  const [m, d] = await Promise.all([
    getJson(`${base}?granularity=M15&count=80&price=M`, opts),
    getJson(`${base}?granularity=D&count=3&price=M`, opts)
  ]);
  const candles = m.candles.map((c) => ({ high: +c.mid.h, low: +c.mid.l, close: +c.mid.c }));
  const days = d.candles.filter((c) => c.complete);
  const prev = +days[days.length - 1].mid.c;
  const price = candles[candles.length - 1].close;
  return { candles, price, changePct: ((price - prev) / prev) * 100 };
}

// Price source 2: Twelve Data (used when only TWELVEDATA_KEY is set)
async function fromTwelve() {
  const key = process.env.TWELVEDATA_KEY;
  const [ts, q] = await Promise.all([
    getJson(`https://api.twelvedata.com/time_series?symbol=XAU/USD&interval=15min&outputsize=80&apikey=${key}`),
    getJson(`https://api.twelvedata.com/quote?symbol=XAU/USD&apikey=${key}`)
  ]);
  if (ts.status === 'error' || !ts.values) throw new Error(ts.message || 'No candle data');
  if (q.status === 'error') throw new Error(q.message || 'No quote data');
  const candles = ts.values.slice().reverse().map((v) => ({ high: +v.high, low: +v.low, close: +v.close }));
  return { candles, price: +q.close || candles[candles.length - 1].close, changePct: +q.percent_change };
}

async function getSentiment(key) {
  if (!key) return null;
  try {
    const [a, b] = await Promise.all([
      getJson(`https://finnhub.io/api/v1/news?category=forex&token=${key}`),
      getJson(`https://finnhub.io/api/v1/news?category=general&token=${key}`)
    ]);
    const since = Date.now() / 1000 - 48 * 3600;
    const scored = [...a, ...b]
      .filter((n) => n.datetime >= since && n.headline)
      .map((n) => ({ headline: n.headline, url: n.url, source: n.source, tone: headlineTone(n.headline) }))
      .filter((n) => n.tone !== 0);
    if (scored.length < 3) return { score: null, label: 'Not enough news', count: scored.length, headlines: [] };
    const score = scored.reduce((s, n) => s + n.tone, 0) / scored.length;
    return {
      score,
      label: score > 0.15 ? 'Bullish' : score < -0.15 ? 'Bearish' : 'Neutral',
      count: scored.length,
      headlines: scored.slice(0, 4)
    };
  } catch (e) {
    return null;
  }
}

function decide(tech, day, sent) {
  // Weighted blend of trend, today's move and news tone. Weights re-balance if news is missing.
  let w = { tech: 0.5, day: 0.2, sent: 0.3 };
  let sentScore = sent && sent.score !== null ? sent.score : null;
  if (sentScore === null) w = { tech: 0.7, day: 0.3, sent: 0 };
  const composite = w.tech * tech + w.day * day + w.sent * (sentScore || 0);
  const decision = composite > 0.25 ? 'BUY' : composite < -0.25 ? 'SELL' : 'WAIT';
  return { composite, decision };
}

module.exports = async (req, res) => {
  const useOanda = !!(process.env.OANDA_TOKEN && process.env.OANDA_ACCOUNT_ID);
  if (!useOanda && !process.env.TWELVEDATA_KEY) {
    return res.status(500).json({ error: 'Add OANDA_TOKEN + OANDA_ACCOUNT_ID, or TWELVEDATA_KEY, in Vercel environment variables.' });
  }
  try {
    const [data, sent] = await Promise.all([
      useOanda ? fromOanda() : fromTwelve(),
      getSentiment(process.env.FINNHUB_KEY)
    ]);
    const { candles, price, changePct } = data;
    const closes = candles.map((c) => c.close);
    const fast = sma(closes, 10), slow = sma(closes, 30), a = atr(candles);

    const tech = clamp((fast - slow) / (2 * a), -1, 1);
    const day = clamp(changePct / 1, -1, 1);
    const { composite, decision } = decide(tech, day, sent);
    const dir = decision === 'SELL' ? -1 : 1;

    // OANDA has no small daily cap, so it can refresh faster. Twelve Data free needs 5 minutes.
    const ttl = useOanda ? 30 : 300;
    res.setHeader('Cache-Control', `s-maxage=${ttl}, stale-while-revalidate=${ttl}`);
    res.status(200).json({
      price, changePct, sma10: fast, sma30: slow, atr: a,
      trend: fast > slow ? 'Up' : 'Down',
      decision, composite,
      stop: decision === 'WAIT' ? null : price - dir * 1.5 * a,
      target: decision === 'WAIT' ? null : price + dir * 3 * a,
      sentiment: sent,
      updated: new Date().toISOString()
    });
  } catch (e) {
    res.status(502).json({ error: 'Live data unavailable: ' + e.message });
  }
};
