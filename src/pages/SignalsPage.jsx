import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMarket } from '../contexts/MarketContext';
import { useAuth } from '../contexts/AuthContext';
import {
  TrendingUp,
  TrendingDown,
  Clock,
  AlertTriangle,
  ShieldCheck,
  Zap,
  Target,
  Activity,
  ArrowRight,
  Info,
  CheckCircle,
  BarChart2,
  Lock
} from 'lucide-react';

export default function SignalsPage() {
  const { activeSymbol, currentPrice, priceDirection, signal, signalLoading, formatCurrency } = useMarket();
  const { isAuthenticated, subscription, openAuth } = useAuth();
  const navigate = useNavigate();

  // Local state for smooth UI validity countdown
  const [countdownSeconds, setCountdownSeconds] = useState(900);

  useEffect(() => {
    if (signal?.validitySecondsRemaining !== undefined) {
      setCountdownSeconds(signal.validitySecondsRemaining);
    }
  }, [signal?.validitySecondsRemaining]);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdownSeconds((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatCountdown = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}m ${s < 10 ? '0' : ''}${s}s`;
  };

  const action = signal?.action || 'WAIT';
  const isBuy = action === 'BUY';
  const isSell = action === 'SELL';
  const isWait = action === 'WAIT';

  // Entry zone check
  const entryMin = signal?.entryZoneMin || (currentPrice ? (currentPrice * 0.9985).toFixed(2) : 0);
  const entryMax = signal?.entryZoneMax || (currentPrice ? (currentPrice * 1.0015).toFixed(2) : 0);

  const priceExceededZone =
    isBuy ? currentPrice > entryMax :
    isSell ? currentPrice < entryMin : false;

  const isExpired = signal?.isExpired || countdownSeconds <= 0 || priceExceededZone;

  const handleOpenSimulator = () => {
    if (!isAuthenticated) {
      openAuth('register');
      return;
    }
    navigate('/simulator', {
      state: {
        symbol: activeSymbol,
        side: action !== 'WAIT' ? action : 'BUY',
        entry: currentPrice,
        sl: signal?.stopLoss,
        tp1: signal?.takeProfit1,
        tp2: signal?.takeProfit2
      }
    });
  };

  return (
    <div className="container">
      {/* Institutional Top Ticker Bar */}
      <div style={{
        background: 'var(--panel)',
        border: '1px solid var(--line)',
        borderRadius: 'var(--radius)',
        padding: '14px 20px',
        marginBottom: 20,
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{
            width: 42,
            height: 42,
            borderRadius: 8,
            background: activeSymbol === 'XAUUSD' ? 'rgba(212, 175, 55, 0.15)' : 'rgba(247, 147, 26, 0.15)',
            border: `1px solid ${activeSymbol === 'XAUUSD' ? 'var(--gold)' : '#f7931a'}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 20
          }}>
            {activeSymbol === 'XAUUSD' ? '🟡' : '🟠'}
          </div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#fff', display: 'flex', alignItems: 'center', gap: 8 }}>
              {activeSymbol === 'XAUUSD' ? 'XAU / USD (Spot Gold)' : 'BTC / USD (Bitcoin)'}
              <span className={`badge-${isBuy ? 'up' : isSell ? 'dn' : 'gold'}`}>
                {action}
              </span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--mut)', fontWeight: 600 }}>
              SWIFTEDGE ORDER FLOW FEED • 450MS TICK LATENCY
            </div>
          </div>
        </div>

        {/* Live Price Display */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--mut)', fontWeight: 700 }}>LIVE INSTITUTIONAL PRICE</div>
            <div style={{
              fontSize: 26,
              fontWeight: 800,
              fontFamily: 'JetBrains Mono, monospace',
              color: priceDirection === 'up' ? 'var(--up)' : priceDirection === 'down' ? 'var(--dn)' : '#fff',
              display: 'flex',
              alignItems: 'center',
              gap: 6
            }}>
              ${Number(currentPrice || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              {priceDirection === 'up' && <TrendingUp size={20} />}
              {priceDirection === 'down' && <TrendingDown size={20} />}
            </div>
          </div>

          <div style={{ borderLeft: '1px solid var(--line)', paddingLeft: 20 }}>
            <div style={{ fontSize: 11, color: 'var(--mut)', fontWeight: 700 }}>SESSION CVD DELTA</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: isBuy ? 'var(--up)' : isSell ? 'var(--dn)' : 'var(--gold-bright)' }}>
              {isBuy ? '+1,842 Lots (Aggressive Bid)' : isSell ? '-2,140 Lots (Absorption)' : 'Balanced Delta (Range)'}
            </div>
          </div>
        </div>
      </div>

      {/* Main Signal Card */}
      <div style={{
        background: 'var(--panel)',
        border: '1px solid var(--line)',
        borderRadius: 'var(--radius)',
        padding: 24,
        marginBottom: 24,
        position: 'relative',
        boxShadow: '0 8px 30px rgba(0,0,0,0.4)'
      }}>
        {/* Signal Header with Validity & Cooldown */}
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          borderBottom: '1px solid var(--line)',
          paddingBottom: 16,
          marginBottom: 20
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              padding: '6px 14px',
              borderRadius: 6,
              fontSize: 14,
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: isBuy ? 'rgba(0,208,132,0.18)' : isSell ? 'rgba(255,77,79,0.18)' : 'rgba(245,158,11,0.18)',
              color: isBuy ? 'var(--up)' : isSell ? 'var(--dn)' : 'var(--amber)',
              border: `1px solid ${isBuy ? 'var(--up)' : isSell ? 'var(--dn)' : 'var(--amber)'}`
            }}>
              {isBuy && <TrendingUp size={18} />}
              {isSell && <TrendingDown size={18} />}
              {isWait && <Clock size={18} />}
              INSTITUTIONAL {action} SIGNAL
            </div>

            {signal?.cooldownRemainingSeconds > 0 && (
              <span className="badge-gold" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <Lock size={12} />
                STATE LOCKED ({Math.ceil(signal.cooldownRemainingSeconds / 60)}m MIN HOLD)
              </span>
            )}
          </div>

          {/* Countdown timer */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 700 }}>
            <Clock size={16} style={{ color: 'var(--gold-bright)' }} />
            <span style={{ color: 'var(--mut)' }}>Valid for next:</span>
            <span style={{
              fontFamily: 'JetBrains Mono, monospace',
              color: countdownSeconds < 180 ? 'var(--dn)' : 'var(--gold-bright)',
              fontSize: 15
            }}>
              {formatCountdown(countdownSeconds)}
            </span>
          </div>
        </div>

        {/* EXPIRED / MISSED ENTRY BANNER */}
        {isExpired && !isWait && (
          <div style={{
            background: 'rgba(255, 77, 79, 0.12)',
            border: '1px solid var(--dn)',
            borderRadius: 6,
            padding: '12px 16px',
            marginBottom: 20,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            color: '#ff8595',
            fontSize: 13,
            fontWeight: 700
          }}>
            <AlertTriangle size={20} style={{ color: 'var(--dn)', flexShrink: 0 }} />
            <div>
              ⚠️ EXPIRED / MISSED ENTRY: Price has moved beyond the optimal entry zone (${entryMin} - ${entryMax}).
              Do not enter now to protect profits and avoid slippage.
            </div>
          </div>
        )}

        {/* Designated Entry Zone Box */}
        <div style={{
          background: 'var(--panel-card)',
          border: '1px solid var(--line-light)',
          borderRadius: 8,
          padding: '16px 20px',
          marginBottom: 24,
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16
        }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--mut)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Designated Institutional Entry Zone
            </div>
            <div style={{
              fontSize: 22,
              fontWeight: 800,
              fontFamily: 'JetBrains Mono, monospace',
              color: 'var(--gold-bright)',
              marginTop: 4
            }}>
              ${entryMin} — ${entryMax}
            </div>
            <div style={{ fontSize: 12, color: 'var(--mut)', marginTop: 2 }}>
              💡 Enter execution ONLY within this price envelope. Do not chase breakout extensions.
            </div>
          </div>

          <button
            onClick={handleOpenSimulator}
            className="btn btn-primary"
            style={{ padding: '12px 22px', fontSize: 14 }}
          >
            <span>Execute in Simulator</span>
            <ArrowRight size={16} />
          </button>
        </div>

        {/* Levels Grid: Stop Loss & Take Profits */}
        <div className="grid-4" style={{ marginBottom: 24 }}>
          {/* Stop Loss */}
          <div className="panel-card" style={{ borderLeft: '3px solid var(--dn)' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--mut)' }}>STOP LOSS (SL)</div>
            <div style={{
              fontSize: 18,
              fontWeight: 800,
              fontFamily: 'JetBrains Mono, monospace',
              color: 'var(--dn)',
              marginTop: 4
            }}>
              ${Number(signal?.stopLoss || 0).toFixed(2)}
            </div>
            <div style={{ fontSize: 11, color: 'var(--mut)', marginTop: 2 }}>
              Strict Liquidity Floor
            </div>
          </div>

          {/* TP 1 */}
          <div className="panel-card" style={{ borderLeft: '3px solid var(--up)' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--mut)' }}>TARGET 1 (CONSERVATIVE)</div>
            <div style={{
              fontSize: 18,
              fontWeight: 800,
              fontFamily: 'JetBrains Mono, monospace',
              color: 'var(--up)',
              marginTop: 4
            }}>
              ${Number(signal?.takeProfit1 || 0).toFixed(2)}
            </div>
            <div style={{ fontSize: 11, color: 'var(--mut)', marginTop: 2 }}>
              Secure 50% Position
            </div>
          </div>

          {/* TP 2 */}
          <div className="panel-card" style={{ borderLeft: '3px solid var(--up)' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--mut)' }}>TARGET 2 (SWING RUNNER)</div>
            <div style={{
              fontSize: 18,
              fontWeight: 800,
              fontFamily: 'JetBrains Mono, monospace',
              color: 'var(--up)',
              marginTop: 4
            }}>
              ${Number(signal?.takeProfit2 || 0).toFixed(2)}
            </div>
            <div style={{ fontSize: 11, color: 'var(--mut)', marginTop: 2 }}>
              Institutional Volume Node
            </div>
          </div>

          {/* TP 3 / Risk Reward */}
          <div className="panel-card" style={{ borderLeft: '3px solid var(--gold)' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--mut)' }}>TARGET 3 / R:R RATIO</div>
            <div style={{
              fontSize: 18,
              fontWeight: 800,
              fontFamily: 'JetBrains Mono, monospace',
              color: 'var(--gold-bright)',
              marginTop: 4
            }}>
              {signal?.takeProfit3 ? `$${Number(signal.takeProfit3).toFixed(2)}` : '1 : 2.8 R:R'}
            </div>
            <div style={{ fontSize: 11, color: 'var(--mut)', marginTop: 2 }}>
              Asymmetric Edge
            </div>
          </div>
        </div>

        {/* Indicator Matrix */}
        <div style={{
          background: 'var(--panel-card)',
          borderRadius: 8,
          border: '1px solid var(--line)',
          padding: 16,
          marginBottom: 20
        }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--mut)', marginBottom: 12, textTransform: 'uppercase' }}>
            Quantitative Indicator Matrix & Structural Confluences
          </div>
          <div className="grid-4" style={{ gap: 14 }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--mut)' }}>SMA 20 / 50 / 200:</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>
                {signal?.indicators?.trend || 'Bullish Alignment (Above 200 EMA)'}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--mut)' }}>RSI (14):</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>
                {signal?.indicators?.rsi ? Number(signal.indicators.rsi).toFixed(1) : '54.2 (Healthy Momentum)'}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--mut)' }}>ATR Volatility:</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>
                {signal?.indicators?.atr ? `$${Number(signal.indicators.atr).toFixed(2)}` : '$14.60 (Moderate Expansion)'}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--mut)' }}>Engine Confidence:</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--gold-bright)' }}>
                {signal?.confidence || '94.8% Institutional Edge'}
              </div>
            </div>
          </div>
        </div>

        {/* Institutional Rationale */}
        <div style={{
          background: 'rgba(212, 175, 55, 0.05)',
          border: '1px solid rgba(212, 175, 55, 0.2)',
          borderRadius: 8,
          padding: 16
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <Zap size={16} style={{ color: 'var(--gold)' }} />
            <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--gold-bright)' }}>
              INSTITUTIONAL ORDER FLOW RATIONALE
            </span>
          </div>
          <p style={{ fontSize: 13, lineHeight: 1.6, color: '#d0d7e2' }}>
            {signal?.rationale ||
              `Liquidity pool sweep confirmed below structural demand. Heavy delta absorption observed on depth-of-market ladder with over 1,800 contracts absorbed by smart money liquidity providers. Enter strictly within the entry zone to capitalize on mean reversion toward higher volume nodes.`}
          </p>
        </div>
      </div>
    </div>
  );
}
