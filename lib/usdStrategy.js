// USD Strength Correlation Strategy
// Instruments: XAUUSD (Gold) and BTCUSD (Bitcoin) ONLY.
//
// Data sources (reusing the app's existing integration — nothing invented):
//  - SwiftEdge UK MCP (https://swiftedge.uk/mcp, tools/call -> get_market_snapshot)
//    for live price + institutional order flow per market ('gold' | 'btc').
//  - OHLC candle series for indicators come from the same real feeds the app
//    already uses (Binance klines). SwiftEdge's snapshot does not expose OHLC,
//    so we never fabricate candles — if OHLC is unavailable the asset is WAIT.
//  - DXY (US Dollar Index) is fetched from a real, explicitly-configured chart
//    source (Yahoo Finance DX-Y.NYB by default, override via DXY_CHART_URL).
//    If DXY cannot be fetched, USD status = "DATA UNAVAILABLE" and both
//    instruments return WAIT (we never pretend to compute USD strength).

const TIMEFRAMES = ['5m', '15m', '30m', '1h', '4h', '1d'];

// ---------- generic fetch helpers ----------
async function getJson(url, timeoutMs = 6000, headers) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const r = await fetch(url, { signal: controller.signal, headers });
    clearTimeout(id);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return await r.json();
  } catch (e) {
    clearTimeout(id);
    throw e;
  }
}

// Same SwiftEdge MCP call used elsewhere in the app.
async function swiftedgeSnapshot(market) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), 4000);
  try {
    const res = await fetch('https://swiftedge.uk/mcp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: Date.now(),
        method: 'tools/call',
        params: { name: 'get_market_snapshot', arguments: { market } }
      }),
      signal: controller.signal
    });
    clearTimeout(id);
    if (!res.ok) return null;
    const json = await res.json();
    if (json && json.result && json.result.content && json.result.content[0]) {
      const txt = json.result.content[0].text;
      return typeof txt === 'string' ? JSON.parse(txt) : txt;
    }
    return null;
  } catch (e) {
    clearTimeout(id);
    return null;
  }
}

const BINANCE_INTERVAL = { '5m': '5m', '15m': '15m', '30m': '30m', '1h': '1h', '4h': '4h', '1d': '1d' };

// Real OHLC series (same feed the app already uses). Returns [] on failure.
async function binanceKlines(symbol, timeframe, limit = 160) {
  const iv = BINANCE_INTERVAL[timeframe] || '15m';
  const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${iv}&limit=${limit}`;
  const data = await getJson(url, 6000);
  if (!Array.isArray(data)) return [];
  return data
    .map(k => ({ time: k[0], open: +k[1], high: +k[2], low: +k[3], close: +k[4], vol: +k[5] }))
    .filter(c => isFinite(c.close) && c.close > 0);
}

const YAHOO_INTERVAL = { '5m': '5m', '15m': '15m', '30m': '30m', '1h': '60m', '4h': '60m', '1d': '1d' };

function parseYahooCandles(j) {
  const r = j && j.chart && j.chart.result && j.chart.result[0];
  if (!r) return [];
  const ts = r.timestamp || [];
  const q = r.indicators && r.indicators.quote && r.indicators.quote[0];
  if (!q) return [];
  const out = [];
  for (let i = 0; i < ts.length; i++) {
    const close = +(q.close ? q.close[i] : NaN);
    if (isFinite(close) && close > 0) {
      out.push({
        time: ts[i] * 1000,
        open: +(q.open ? q.open[i] : close) || close,
        high: +(q.high ? q.high[i] : close) || close,
        low: +(q.low ? q.low[i] : close) || close,
        close
      });
    }
  }
  return out;
}

// DXY candle series from a real, explicitly-configured source.
async function fetchDxyCandles(timeframe) {
  const symbol = process.env.DXY_YAHOO_SYMBOL || 'DX-Y.NYB';
  const iv = YAHOO_INTERVAL[timeframe] || '15m';
  const range = timeframe === '1d' ? '1y' : '5d';
  const urls = [
    process.env.DXY_CHART_URL || null,
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=${iv}&range=${range}`,
    `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=${iv}&range=${range}`
  ].filter(Boolean);

  for (const url of urls) {
    try {
      const j = await getJson(url, 6000, { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' });
      const candles = parseYahooCandles(j);
      if (candles.length >= 30) {
        return { candles, source: `DXY (${symbol}) via Yahoo Finance` };
      }
    } catch (e) {
      // try next source
    }
  }
  return { candles: [], source: null };
}

// ---------- indicators ----------
function emaArray(values, period) {
  const out = new Array(values.length).fill(null);
  if (values.length < period) return out;
  const k = 2 / (period + 1);
  let prev = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
  out[period - 1] = prev;
  for (let i = period; i < values.length; i++) {
    prev = values[i] * k + prev * (1 - k);
    out[i] = prev;
  }
  return out;
}

function emaLast(values, period) {
  const a = emaArray(values, period);
  return a.length ? a[a.length - 1] : null;
}

function rsi(values, period = 14) {
  if (values.length < period + 1) return null;
  let gains = 0, losses = 0;
  for (let i = 1; i <= period; i++) {
    const d = values[i] - values[i - 1];
    if (d >= 0) gains += d; else losses -= d;
  }
  let ag = gains / period, al = losses / period;
  for (let i = period + 1; i < values.length; i++) {
    const d = values[i] - values[i - 1];
    if (d >= 0) { ag = (ag * (period - 1) + d) / period; al = (al * (period - 1)) / period; }
    else { ag = (ag * (period - 1)) / period; al = (al * (period - 1) - d) / period; }
  }
  if (al === 0) return 100;
  return 100 - (100 / (1 + ag / al));
}

function macdInfo(closes, fast = 12, slow = 26, signal = 9) {
  if (closes.length < slow + 1) return null;
  const eF = emaArray(closes, fast);
  const eS = emaArray(closes, slow);
  const line = closes.map((_, i) => (eF[i] != null && eS[i] != null ? eF[i] - eS[i] : null));
  const validLine = line.filter(v => v != null);
  const sigArr = emaArray(validLine, signal);
  const last = closes.length - 1;
  if (line[last] == null) return null;
  const macd = line[last];
  const sig = sigArr.length ? sigArr[sigArr.length - 1] : null;
  return { macd, signal: sig, hist: sig != null ? macd - sig : macd };
}

function atr(candles, period = 14) {
  if (!candles || candles.length < 2) return null;
  const trs = [];
  for (let i = 1; i < candles.length; i++) {
    trs.push(Math.max(
      candles[i].high - candles[i].low,
      Math.abs(candles[i].high - candles[i - 1].close),
      Math.abs(candles[i].low - candles[i - 1].close)
    ));
  }
  if (!trs.length) return null;
  const n = Math.min(period, trs.length);
  return trs.slice(-n).reduce((a, b) => a + b, 0) / n;
}

function classifyStructure(candles) {
  const n = candles.length;
  if (n < 12) return 'range';
  const seg = Math.floor(n / 6);
  if (seg < 1) return 'range';
  const lows = candles.map(c => c.low);
  const highs = candles.map(c => c.high);
  const recentLow = Math.min(...lows.slice(-seg));
  const priorLow = Math.min(...lows.slice(-2 * seg, -seg));
  const recentHigh = Math.max(...highs.slice(-seg));
  const priorHigh = Math.max(...highs.slice(-2 * seg, -seg));
  if (recentHigh > priorHigh && recentLow > priorLow) return 'uptrend';
  if (recentHigh < priorHigh && recentLow < priorLow) return 'downtrend';
  return 'range';
}

const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));

// ---------- USD strength (DXY) ----------
function classifyUsd(dxyCandles, source) {
  if (!dxyCandles || dxyCandles.length < 55) {
    return {
      status: 'DATA UNAVAILABLE',
      dataAvailable: false,
      dataSource: source || 'Unavailable',
      price: null, ema20: null, ema50: null, rsi14: null, macdHist: null,
      explanation: 'DXY data is unavailable, so USD strength cannot be assessed. No directional bias is applied.'
    };
  }

  const closes = dxyCandles.map(c => c.close);
  const price = closes[closes.length - 1];
  const e20 = emaLast(closes, 20);
  const e50 = emaLast(closes, 50);
  const r = rsi(closes, 14);
  const m = macdInfo(closes);
  const macdHist = m ? m.hist : null;

  const upTrend = e20 != null && e50 != null && e20 > e50 && price > e20;
  const downTrend = e20 != null && e50 != null && e20 < e50 && price < e20;
  const macroUp = macdHist != null && macdHist > 0 && r != null && r >= 50;
  const macroDown = macdHist != null && macdHist < 0 && r != null && r <= 50;

  let status = 'NEUTRAL';
  if (upTrend && macroUp) status = 'STRONG';
  else if (downTrend && macroDown) status = 'WEAK';

  const bits = [];
  bits.push(`DXY ${price.toFixed(3)}`);
  if (e20 != null && e50 != null) bits.push(`EMA20 ${e20.toFixed(3)} ${e20 > e50 ? '>' : '<'} EMA50 ${e50.toFixed(3)}`);
  if (r != null) bits.push(`RSI14 ${r.toFixed(1)}`);
  if (macdHist != null) bits.push(`MACD hist ${macdHist >= 0 ? '+' : ''}${macdHist.toFixed(3)}`);

  let explanation;
  if (status === 'STRONG') explanation = 'USD is STRONG: DXY uptrend with EMA20 above EMA50 and bullish momentum — bearish tilt for Gold & Bitcoin.';
  else if (status === 'WEAK') explanation = 'USD is WEAK: DXY downtrend with EMA20 below EMA50 and bearish momentum — bullish tilt for Gold & Bitcoin.';
  else explanation = 'USD is NEUTRAL: DXY indicators conflict / market consolidating — no clear USD bias.';

  return {
    status,
    dataAvailable: true,
    dataSource: source || 'DXY',
    price: +price.toFixed(3),
    ema20: e20 != null ? +e20.toFixed(3) : null,
    ema50: e50 != null ? +e50.toFixed(3) : null,
    rsi14: r != null ? +r.toFixed(1) : null,
    macdHist: macdHist != null ? +macdHist.toFixed(3) : null,
    explanation: explanation + ' [' + bits.join(' · ') + ']'
  };
}

// ---------- per-asset analysis ----------
function analyzeAsset(symbol, candles, snap, usd, timeframe) {
  const hasCandles = Array.isArray(candles) && candles.length >= 55;
  const snapPrice = snap && snap.price_usd != null && isFinite(+snap.price_usd) && +snap.price_usd > 0 ? +snap.price_usd : null;
  const price = snapPrice != null ? snapPrice : (hasCandles ? candles[candles.length - 1].close : null);

  const base = {
    symbol,
    name: symbol === 'XAUUSD' ? 'Gold (XAU/USD)' : 'Bitcoin (BTC/USD)',
    timeframe,
    price: price != null ? +price.toFixed(2) : null,
    usdStatus: usd.status,
    action: 'WAIT',
    entry: null, stopLoss: null, takeProfit: null, riskReward: null,
    confidence: 0
  };

  if (!hasCandles || price == null) {
    return {
      ...base,
      dataAvailable: false,
      explanation: 'Insufficient market data (OHLC) to compute indicators — WAIT. No price is fabricated.'
    };
  }

  const closes = candles.map(c => c.close);
  const e20 = emaLast(closes, 20);
  const e50 = emaLast(closes, 50);
  const r = rsi(closes, 14);
  const m = macdInfo(closes);
  const macdHist = m ? m.hist : null;
  const a = atr(candles, 14) || price * 0.005;

  const lookback = Math.min(30, candles.length);
  const recent = candles.slice(-lookback);
  const support = Math.min(...recent.map(c => c.low));
  const resistance = Math.max(...recent.map(c => c.high));
  const structure = classifyStructure(candles);
  const volatilityPct = price > 0 ? (a / price) * 100 : 0;

  // Independent asset bias
  const aboveEma = e20 != null ? price > e20 : null;
  const emaUp = e20 != null && e50 != null ? e20 > e50 : null;
  let bull = 0, bear = 0;
  if (emaUp === true) bull++; else if (emaUp === false) bear++;
  if (aboveEma === true) bull++; else if (aboveEma === false) bear++;
  if (macdHist != null) { if (macdHist > 0) bull++; else if (macdHist < 0) bear++; }
  if (r != null) { if (r > 55) bull++; else if (r < 45) bear++; }
  if (structure === 'uptrend') bull++; else if (structure === 'downtrend') bear++;
  const assetBias = bull > bear + 1 ? 'bullish' : (bear > bull + 1 ? 'bearish' : 'neutral');

  const indBits = [];
  if (e20 != null && e50 != null) indBits.push(`EMA20 ${e20.toFixed(2)} ${e20 > e50 ? '>' : '<'} EMA50 ${e50.toFixed(2)}`);
  if (r != null) indBits.push(`RSI14 ${r.toFixed(1)}`);
  if (macdHist != null) indBits.push(`MACD hist ${macdHist >= 0 ? '+' : ''}${macdHist.toFixed(2)}`);
  indBits.push(`structure ${structure}`);
  indBits.push(`S/R ${support.toFixed(2)}/${resistance.toFixed(2)}`);
  indBits.push(`ATR ${a.toFixed(2)} (${volatilityPct.toFixed(2)}%)`);

  // Desired direction from USD (inverse correlation)
  let desired = 'WAIT';
  if (usd.status === 'STRONG') desired = 'SELL';
  else if (usd.status === 'WEAK') desired = 'BUY';

  // Require independent asset confirmation — accuracy first.
  let action = 'WAIT';
  let reason = '';
  let confirmed = false;

  if (desired === 'WAIT') {
    reason = `USD ${usd.status}. Standing aside until USD strength gives a clear direction.`;
  } else if (desired === 'SELL') {
    if (assetBias === 'bearish') { action = 'SELL'; confirmed = true; reason = 'USD strong (SELL) and the asset confirms bearish structure/momentum.'; }
    else if (assetBias === 'bullish') { reason = 'USD strong (SELL) but the asset is bullish — contradiction, reducing edge and standing aside.'; }
    else { reason = 'USD strong (SELL) but the asset has no clear confirmation — WAIT.'; }
  } else if (desired === 'BUY') {
    if (assetBias === 'bullish') { action = 'BUY'; confirmed = true; reason = 'USD weak (BUY) and the asset confirms bullish structure/momentum.'; }
    else if (assetBias === 'bearish') { reason = 'USD weak (BUY) but the asset is bearish — contradiction, reducing edge and standing aside.'; }
    else { reason = 'USD weak (BUY) but the asset has no clear confirmation — WAIT.'; }
  }

  let entry = null, stopLoss = null, takeProfit = null, riskReward = null, confidence = 0;

  if (confirmed) {
    const alignment = Math.abs(bull - bear);
    confidence = clamp(60 + alignment * 6, 60, 92);
    entry = +price.toFixed(2);
    const slDist = 1.5 * a;
    const tpDist = 2.25 * a; // ~1.5R
    if (action === 'BUY') {
      stopLoss = +(entry - slDist).toFixed(2);
      takeProfit = +(entry + tpDist).toFixed(2);
    } else {
      stopLoss = +(entry + slDist).toFixed(2);
      takeProfit = +(entry - tpDist).toFixed(2);
    }
    riskReward = +(tpDist / slDist).toFixed(2);
  } else {
    confidence = clamp(40 + Math.abs(bull - bear) * 3, 30, 58);
  }

  const explanation = `${reason} Asset: ${indBits.join(' · ')}. USD: ${usd.status}.`;

  return {
    ...base,
    action,
    dataAvailable: true,
    entry, stopLoss, takeProfit, riskReward, confidence,
    indicators: {
      ema20: e20 != null ? +e20.toFixed(2) : null,
      ema50: e50 != null ? +e50.toFixed(2) : null,
      rsi14: r != null ? +r.toFixed(1) : null,
      macdHist: macdHist != null ? +macdHist.toFixed(2) : null,
      support: +support.toFixed(2),
      resistance: +resistance.toFixed(2),
      atr: +a.toFixed(2),
      volatilityPct: +volatilityPct.toFixed(2),
      structure
    },
    assetBias,
    explanation
  };
}

// ---------- dedupe + history ----------
const history = []; // newest first, bounded
const lastEmitted = {}; // symbol -> { action, at }

function recordSignal(sig) {
  const now = Date.now();
  let isNew = false;
  if (sig.action === 'BUY' || sig.action === 'SELL') {
    const prev = lastEmitted[sig.symbol];
    if (!prev || prev.action !== sig.action) {
      isNew = true;
      lastEmitted[sig.symbol] = { action: sig.action, at: now };
      history.unshift({
        id: `${sig.symbol}-${now}`,
        symbol: sig.symbol,
        action: sig.action,
        price: sig.price,
        entry: sig.entry,
        stopLoss: sig.stopLoss,
        takeProfit: sig.takeProfit,
        confidence: sig.confidence,
        usdStatus: sig.usdStatus,
        timeframe: sig.timeframe,
        time: new Date(now).toISOString(),
        outcome: 'open'
      });
      if (history.length > 200) history.pop();
    }
  }
  return { ...sig, isNewSignal: isNew };
}

// Mark open signals won/lost when current price crosses TP/SL.
function updateOutcomes(prices) {
  for (const h of history) {
    if (h.outcome !== 'open') continue;
    const p = prices[h.symbol];
    if (p == null) continue;
    if (h.action === 'BUY') {
      if (p <= h.stopLoss) { h.outcome = 'lost'; h.closedAt = new Date().toISOString(); }
      else if (p >= h.takeProfit) { h.outcome = 'won'; h.closedAt = new Date().toISOString(); }
    } else if (h.action === 'SELL') {
      if (p >= h.stopLoss) { h.outcome = 'lost'; h.closedAt = new Date().toISOString(); }
      else if (p <= h.takeProfit) { h.outcome = 'won'; h.closedAt = new Date().toISOString(); }
    }
  }
}

// ---------- orchestration ----------
async function getUsdStrategySignals(timeframe = '15m') {
  const tf = TIMEFRAMES.includes(timeframe) ? timeframe : '15m';

  const [goldCandles, btcCandles, dxyRes, goldSnap, btcSnap] = await Promise.all([
    binanceKlines('PAXGUSDT', tf, 160).catch(() => []),
    binanceKlines('BTCUSDT', tf, 160).catch(() => []),
    fetchDxyCandles(tf).catch(() => ({ candles: [], source: null })),
    swiftedgeSnapshot('gold').catch(() => null),
    swiftedgeSnapshot('btc').catch(() => null)
  ]);

  const usd = classifyUsd(dxyRes.candles, dxyRes.source);

  const gold = recordSignal(analyzeAsset('XAUUSD', goldCandles, goldSnap, usd, tf));
  const btc = recordSignal(analyzeAsset('BTCUSD', btcCandles, btcSnap, usd, tf));

  updateOutcomes({ XAUUSD: gold.price, BTCUSD: btc.price });

  return {
    strategy: 'USD Strength Correlation',
    timeframe: tf,
    usd,
    XAUUSD: gold,
    BTCUSD: btc,
    history: history.slice(0, 20),
    lastUpdated: new Date().toISOString(),
    dataSources: {
      assets: 'SwiftEdge UK (live price/flow) + Binance OHLC',
      usd: usd.dataSource || 'Unavailable'
    }
  };
}

module.exports = {
  getUsdStrategySignals,
  // exported for testing / potential reuse
  classifyUsd,
  analyzeAsset
};
