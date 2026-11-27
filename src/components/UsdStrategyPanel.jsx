import React, { useEffect, useState, useCallback } from 'react';

const TIMEFRAMES = ['15m', '1h', '4h', '1d'];

function usdColor(status) {
  if (status === 'STRONG') return 'var(--up)';
  if (status === 'WEAK') return 'var(--dn)';
  if (status === 'NEUTRAL') return 'var(--amber)';
  return 'var(--mut)';
}

function actionColor(action) {
  if (action === 'BUY') return 'var(--up)';
  if (action === 'SELL') return 'var(--dn)';
  return 'var(--amber)';
}

function Stat({ label, value, col, mono }) {
  return (
    <div style={{ background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 6, padding: '8px 10px' }}>
      <div style={{ fontSize: 10, color: 'var(--mut)', fontWeight: 700, textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 800, color: col || '#fff', fontFamily: mono ? 'JetBrains Mono, monospace' : 'inherit', marginTop: 2 }}>
        {value != null
          ? (mono ? value : '$' + Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 }))
          : '—'}
      </div>
    </div>
  );
}

function SignalCard({ s }) {
  const col = actionColor(s.action);
  return (
    <div style={{ background: 'var(--panel-card)', border: '1px solid var(--line)', borderRadius: 8, padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: '#fff' }}>
          {s.symbol === 'XAUUSD' ? 'GOLD — XAUUSD' : 'BITCOIN — BTCUSD'}
        </div>
        <span style={{ fontSize: 12, fontWeight: 800, color: '#0b0e14', background: col, padding: '3px 10px', borderRadius: 4 }}>{s.action}</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span style={{ fontSize: 22, fontWeight: 800, fontFamily: 'JetBrains Mono, monospace', color: '#fff' }}>
          {s.price != null ? '$' + Number(s.price).toLocaleString(undefined, { maximumFractionDigits: 2 }) : '—'}
        </span>
        {s.dataAvailable === false && <span style={{ fontSize: 11, color: 'var(--mut)' }}>data unavailable</span>}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <Stat label="Entry" value={s.entry} col="var(--gold-bright)" />
        <Stat label="Stop Loss" value={s.stopLoss} col="var(--dn)" />
        <Stat label="Take Profit" value={s.takeProfit} col="var(--up)" />
        <Stat label="R:R" value={s.riskReward} col="#fff" mono />
      </div>

      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--mut)', marginBottom: 4 }}>
          <span>Confidence</span>
          <span style={{ color: '#fff', fontWeight: 700 }}>{Math.round(s.confidence || 0)}%</span>
        </div>
        <div style={{ height: 6, borderRadius: 3, background: 'var(--line)', overflow: 'hidden' }}>
          <div style={{ width: (s.confidence || 0) + '%', height: '100%', background: col }} />
        </div>
      </div>

      <div style={{ fontSize: 11, color: 'var(--mut)', lineHeight: 1.5 }}>{s.explanation}</div>
    </div>
  );
}

function Placeholder({ name }) {
  return (
    <div style={{ background: 'var(--panel-card)', border: '1px solid var(--line)', borderRadius: 8, padding: 16, minHeight: 160, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--mut)', fontSize: 12 }}>
      Loading {name}…
    </div>
  );
}

export default function UsdStrategyPanel() {
  const [data, setData] = useState(null);
  const [timeframe, setTimeframe] = useState('15m');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async (tf) => {
    try {
      const res = await fetch(`/api/usd-strategy?timeframe=${encodeURIComponent(tf)}`);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const d = await res.json();
      if (d.error) throw new Error(d.error);
      setData(d);
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(timeframe);
    const id = setInterval(() => load(timeframe), 15000);
    return () => clearInterval(id);
  }, [timeframe, load]);

  const usd = data && data.usd;
  const usdStatus = usd ? usd.status : 'LOADING';
  const uCol = usdColor(usdStatus);

  return (
    <div style={{ background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 'var(--radius)', padding: 18, marginBottom: 24 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 800, color: '#fff' }}>💵 USD STRENGTH CORRELATION STRATEGY</div>
          <div style={{ fontSize: 11, color: 'var(--mut)' }}>Inverse USD vs Gold &amp; Bitcoin · SwiftEdge UK data</div>
        </div>
        <select
          value={timeframe}
          onChange={(e) => setTimeframe(e.target.value)}
          style={{ background: 'var(--panel-card)', border: '1px solid var(--line)', color: 'var(--gold-bright)', borderRadius: 4, padding: '6px 8px', fontSize: 12, fontWeight: 700 }}
        >
          {TIMEFRAMES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      {/* USD strength indicator */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, background: 'var(--panel-card)', border: '1px solid ' + uCol, borderRadius: 8, padding: '12px 14px', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 10, color: 'var(--mut)', fontWeight: 700, textTransform: 'uppercase' }}>USD Strength (DXY)</div>
          <div style={{ fontSize: 16, fontWeight: 800, color: uCol }}>{usdStatus}</div>
        </div>
        {usd && usd.dataAvailable && (
          <div style={{ fontSize: 11, color: 'var(--mut)', flex: 1, minWidth: 200 }}>
            {usd.ema20 != null && <span>EMA20 {usd.ema20} · </span>}
            {usd.ema50 != null && <span>EMA50 {usd.ema50} · </span>}
            {usd.rsi14 != null && <span>RSI {usd.rsi14} · </span>}
            {usd.macdHist != null && <span>MACD hist {usd.macdHist}</span>}
          </div>
        )}
        {usd && !usd.dataAvailable && (
          <div style={{ fontSize: 11, color: 'var(--mut)', flex: 1, minWidth: 200 }}>
            DXY feed unavailable — signals set to WAIT until USD strength can be determined.
          </div>
        )}
        <div style={{ fontSize: 10, color: 'var(--mut)', textAlign: 'right' }}>
          {data && data.lastUpdated ? <div>Updated {new Date(data.lastUpdated).toLocaleTimeString()}</div> : null}
          <div>{loading ? 'Refreshing…' : ''}{error ? ('Error: ' + error) : ''}</div>
        </div>
      </div>

      {/* Two independent signal cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(280px, 100%), 1fr))', gap: 14 }}>
        {data && data.XAUUSD ? <SignalCard s={data.XAUUSD} /> : <Placeholder name="GOLD — XAUUSD" />}
        {data && data.BTCUSD ? <SignalCard s={data.BTCUSD} /> : <Placeholder name="BITCOIN — BTCUSD" />}
      </div>

      {data && data.usd && data.usd.explanation && (
        <div style={{ fontSize: 11, color: 'var(--mut)', marginTop: 12 }}>{data.usd.explanation}</div>
      )}
    </div>
  );
}
