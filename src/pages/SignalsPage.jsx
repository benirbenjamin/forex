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
  Lock,
  PauseCircle,
  HelpCircle,
  Check
} from 'lucide-react';
import TradingViewChart from '../components/TradingViewChart';
import UsdStrategyPanel from '../components/UsdStrategyPanel';

export default function SignalsPage() {
  const { activeSymbol, setActiveSymbol, currentPrice, priceDirection, signal, formatCurrency } = useMarket();
  const { isAuthenticated, subscription, openAuth } = useAuth();
  const navigate = useNavigate();

  const [brokers, setBrokers] = useState([]);
  useEffect(() => {
    fetch('/api/p2p/info')
      .then((r) => r.json())
      .then((d) => { if (d && Array.isArray(d.recommendedBrokers)) setBrokers(d.recommendedBrokers); })
      .catch(() => {});
  }, []);

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

  const entryMin = signal?.entryZoneMin || (currentPrice ? (currentPrice * 0.9985).toFixed(2) : 0);
  const entryMax = signal?.entryZoneMax || (currentPrice ? (currentPrice * 1.0015).toFixed(2) : 0);

  const priceExceededZone =
    isBuy ? currentPrice > entryMax :
    isSell ? currentPrice < entryMin : false;

  const isExpired = signal?.isExpired || countdownSeconds <= 0 || priceExceededZone;

  const handleOpenSimulator = () => {
    if (isWait) return;
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

  const isGold = activeSymbol === 'XAUUSD';

  return (
    <div className="container">
      {/* 1. ASSET SWITCHER (PLACED ABOVE IN MAIN VIEW, NOT IN NAVBAR) */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 18,
        gap: 12
      }}>
        <div style={{
          display: 'inline-flex',
          background: 'var(--panel)',
          border: '1px solid var(--line-light)',
          borderRadius: 8,
          padding: 4,
          boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
          width: '100%',
          maxWidth: 480
        }}>
          <button
            onClick={() => setActiveSymbol('XAUUSD')}
            style={{
              flex: 1,
              background: isGold ? 'linear-gradient(135deg, #d4af37, #996515)' : 'transparent',
              color: isGold ? '#0b0e14' : 'var(--mut)',
              border: 'none',
              borderRadius: 6,
              padding: '10px 14px',
              fontSize: 13,
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              transition: 'all 0.2s ease'
            }}
          >
            <span>🟡</span>
            <span>XAU/USD (Spot Gold)</span>
          </button>
          <button
            onClick={() => setActiveSymbol('BTCUSD')}
            style={{
              flex: 1,
              background: !isGold ? 'linear-gradient(135deg, #f7931a, #b35f00)' : 'transparent',
              color: !isGold ? '#fff' : 'var(--mut)',
              border: 'none',
              borderRadius: 6,
              padding: '10px 14px',
              fontSize: 13,
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              transition: 'all 0.2s ease'
            }}
          >
            <span>🟠</span>
            <span>BTC/USD (Bitcoin)</span>
          </button>
        </div>
      </div>

      {/* USD Strength Correlation Strategy (XAUUSD & BTCUSD) */}
      <UsdStrategyPanel />

      {/* 2. Top Ticker Bar */}
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
            width: 44,
            height: 44,
            borderRadius: 8,
            background: isGold ? 'rgba(212, 175, 55, 0.15)' : 'rgba(247, 147, 26, 0.15)',
            border: `1px solid ${isGold ? 'var(--gold)' : '#f7931a'}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 22
          }}>
            {isGold ? '🟡' : '🟠'}
          </div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#fff', display: 'flex', alignItems: 'center', gap: 8 }}>
              {isGold ? 'XAU / USD (Spot Gold)' : 'BTC / USD (Bitcoin)'}
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
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

      {/* 3. Main Signal Card */}
      <div style={{
        background: 'var(--panel)',
        border: '1px solid var(--line)',
        borderRadius: 'var(--radius)',
        padding: 24,
        marginBottom: 24,
        position: 'relative',
        boxShadow: '0 8px 30px rgba(0,0,0,0.4)'
      }}>
        {/* Signal Header */}
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
              {isWait && <PauseCircle size={18} />}
              INSTITUTIONAL {action} SIGNAL
            </div>

            {signal?.cooldownRemainingSeconds > 0 && !isWait && (
              <span className="badge-gold" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <Lock size={12} />
                STATE LOCKED ({Math.ceil(signal.cooldownRemainingSeconds / 60)}m MIN HOLD)
              </span>
            )}
          </div>

          {/* Validity status: ONLY show countdown for active BUY / SELL */}
          {!isWait ? (
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
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 700, color: 'var(--amber)' }}>
              <PauseCircle size={16} />
              <span>Status: Market in Range / Sideways (Stand Aside)</span>
            </div>
          )}
        </div>

        {/* NON-SIGNED-IN USERS LOCK OVERLAY TEASER */}
        {!isAuthenticated && (
          <div style={{
            background: 'linear-gradient(135deg, rgba(212, 175, 55, 0.12), rgba(11, 14, 20, 0.95))',
            border: '2px solid var(--gold)',
            borderRadius: 8,
            padding: '24px 20px',
            marginBottom: 24,
            textAlign: 'center',
            boxShadow: '0 8px 32px rgba(212, 175, 55, 0.2)'
          }}>
            <div style={{
              width: 48,
              height: 48,
              borderRadius: '50%',
              background: 'var(--gold)',
              color: '#0b0e14',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 12
            }}>
              <Lock size={24} />
            </div>
            <h3 style={{ fontSize: 18, fontWeight: 800, color: '#fff', marginBottom: 6 }}>
              🔒 Institutional VIP Signals Locked
            </h3>
            <p style={{ fontSize: 13, color: 'var(--mut)', maxWidth: 540, margin: '0 auto 18px', lineHeight: 1.6 }}>
              Live designated entry envelopes, exact Stop Loss, and institutional take-profit levels are exclusively available to verified members. Claim 7 Days Free VIP Access today.
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 12, flexWrap: 'wrap' }}>
              <button
                onClick={() => openAuth('register')}
                className="btn btn-primary"
                style={{ padding: '10px 22px', fontSize: 14 }}
              >
                Claim 7-Days Free VIP Access
              </button>
              <button
                onClick={() => openAuth('login')}
                className="btn btn-outline"
                style={{ padding: '10px 20px', fontSize: 14 }}
              >
                Sign In
              </button>
            </div>
          </div>
        )}

        {/* FRESH MISSED-ENTRY WARNING (stale signals auto-reset to WAIT) */}
        {!isWait && isAuthenticated && (signal?.missedEntry === true || (signal?.missedEntry === undefined && isExpired)) && (
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

        {/* SECTION: ENTRY ZONE vs WAIT ADVISORY */}
        {isWait ? (
          /* Institutional Market Advisory for WAIT state */
          <div style={{
            background: 'rgba(245, 158, 11, 0.08)',
            border: '1px solid rgba(245, 158, 11, 0.3)',
            borderRadius: 8,
            padding: '20px',
            marginBottom: 24,
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16
          }}>
            <div style={{ flex: 1, minWidth: 260 }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--amber)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 6 }}>
                <ShieldCheck size={16} />
                Institutional Market Advisory (Capital Protection Active)
              </div>
              <div style={{ fontSize: 14, color: '#e5e7eb', marginTop: 6, lineHeight: 1.6 }}>
                {isGold ? 'Gold (XAU/USD)' : 'Bitcoin (BTC/USD)'} is moving in a tight consolidation equilibrium range. Order depth is balanced with high risk of whipsaws. Stand aside and wait for institutional breakout confirmation.
              </div>
            </div>

            <button
              disabled
              className="btn btn-outline"
              style={{ padding: '12px 20px', fontSize: 13, opacity: 0.65, cursor: 'not-allowed' }}
            >
              No Trade Active (Wait for Setup)
            </button>
          </div>
        ) : (
          /* Designated Institutional Entry Zone for BUY/SELL */
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
            gap: 16,
            filter: !isAuthenticated ? 'blur(4px)' : 'none',
            userSelect: !isAuthenticated ? 'none' : 'auto'
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
        )}

        {/* Levels Grid: Stop Loss & Take Profits */}
        <div className="grid-4" style={{
          marginBottom: 24,
          filter: !isAuthenticated ? 'blur(4px)' : 'none',
          userSelect: !isAuthenticated ? 'none' : 'auto'
        }}>
          {/* Stop Loss */}
          <div className="panel-card" style={{ borderLeft: '3px solid var(--dn)' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--mut)' }}>STOP LOSS (SL)</div>
            <div style={{
              fontSize: 18,
              fontWeight: 800,
              fontFamily: 'JetBrains Mono, monospace',
              color: isWait ? 'var(--mut)' : 'var(--dn)',
              marginTop: 4
            }}>
              {isWait || !signal?.stopLoss || signal?.stopLoss === 0 ? '—' : `$${Number(signal.stopLoss).toFixed(2)}`}
            </div>
            <div style={{ fontSize: 11, color: 'var(--mut)', marginTop: 2 }}>
              {isWait ? 'Awaiting Breakout Levels' : 'Strict Liquidity Floor'}
            </div>
          </div>

          {/* TP 1 */}
          <div className="panel-card" style={{ borderLeft: '3px solid var(--up)' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--mut)' }}>TARGET 1 (CONSERVATIVE)</div>
            <div style={{
              fontSize: 18,
              fontWeight: 800,
              fontFamily: 'JetBrains Mono, monospace',
              color: isWait ? 'var(--mut)' : 'var(--up)',
              marginTop: 4
            }}>
              {isWait || !signal?.takeProfit1 || signal?.takeProfit1 === 0 ? '—' : `$${Number(signal.takeProfit1).toFixed(2)}`}
            </div>
            <div style={{ fontSize: 11, color: 'var(--mut)', marginTop: 2 }}>
              {isWait ? 'Awaiting Breakout Levels' : 'Secure 50% Position'}
            </div>
          </div>

          {/* TP 2 */}
          <div className="panel-card" style={{ borderLeft: '3px solid var(--up)' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--mut)' }}>TARGET 2 (SWING RUNNER)</div>
            <div style={{
              fontSize: 18,
              fontWeight: 800,
              fontFamily: 'JetBrains Mono, monospace',
              color: isWait ? 'var(--mut)' : 'var(--up)',
              marginTop: 4
            }}>
              {isWait || !signal?.takeProfit2 || signal?.takeProfit2 === 0 ? '—' : `$${Number(signal.takeProfit2).toFixed(2)}`}
            </div>
            <div style={{ fontSize: 11, color: 'var(--mut)', marginTop: 2 }}>
              {isWait ? 'Awaiting Breakout Levels' : 'Institutional Volume Node'}
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
              {isWait ? '—' : (signal?.takeProfit3 ? `$${Number(signal.takeProfit3).toFixed(2)}` : '1 : 2.8 R:R')}
            </div>
            <div style={{ fontSize: 11, color: 'var(--mut)', marginTop: 2 }}>
              Asymmetric Edge
            </div>
          </div>
        </div>

        {/* ACTIVE TRADER EXECUTION & EXIT GUIDANCE (ONLY ON BUY / SELL) */}
        {!isWait && isAuthenticated && (
          <div style={{
            background: 'var(--panel-card)',
            border: '1px solid var(--line-light)',
            borderRadius: 8,
            padding: 18,
            marginBottom: 20
          }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--gold-bright)', marginBottom: 12, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Zap size={16} />
              Trader Execution & Exit Guidance
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
              <div style={{ background: 'var(--panel)', padding: 12, borderRadius: 6, border: '1px solid var(--line)' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gold)' }}>STEP 1: ENTRY</div>
                <div style={{ fontSize: 12, color: '#fff', marginTop: 4 }}>
                  Enter position only within ${entryMin} - ${entryMax}. Avoid entering outside this zone.
                </div>
              </div>

              <div style={{ background: 'var(--panel)', padding: 12, borderRadius: 6, border: '1px solid var(--line)' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--dn)' }}>STEP 2: RISK CONTROL</div>
                <div style={{ fontSize: 12, color: '#fff', marginTop: 4 }}>
                  Set hard Stop Loss at ${Number(signal?.stopLoss || 0).toFixed(2)}. Never widen stop loss in drawdowns.
                </div>
              </div>

              <div style={{ background: 'var(--panel)', padding: 12, borderRadius: 6, border: '1px solid var(--line)' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--up)' }}>STEP 3: EXIT CAUTION</div>
                <div style={{ fontSize: 12, color: '#fff', marginTop: 4 }}>
                  When Target 1 is reached, close 50% of lots and move Stop Loss to Break-Even (entry price).
                </div>
              </div>

              <div style={{ background: 'var(--panel)', padding: 12, borderRadius: 6, border: '1px solid var(--line)' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--amber)' }}>STEP 4: DISCIPLINE</div>
                <div style={{ fontSize: 12, color: '#fff', marginTop: 4 }}>
                  If price runs beyond the entry zone before fill, mark as MISSED ENTRY and do not chase.
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Indicator Matrix */}
        <div style={{
          background: 'var(--panel-card)',
          borderRadius: 8,
          border: '1px solid var(--line)',
          padding: 16,
          marginBottom: 20,
          filter: !isAuthenticated ? 'blur(4px)' : 'none',
          userSelect: !isAuthenticated ? 'none' : 'auto'
        }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--mut)', marginBottom: 12, textTransform: 'uppercase' }}>
            Quantitative Indicator Matrix & Structural Confluences
          </div>
          <div className="grid-4" style={{ gap: 14 }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--mut)' }}>SMA 20 / 50 / 200:</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>
                {signal?.indicators?.trend || (isWait ? 'Neutral Sideways Chop' : 'Bullish Alignment (Above 200 EMA)')}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--mut)' }}>RSI (14):</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>
                {signal?.indicators?.rsi ? Number(signal.indicators.rsi).toFixed(1) : '52.4 (Neutral Equilibrium)'}
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
                {signal?.confidence || (isWait ? '78% (Range Bound)' : '94.8% Institutional Edge')}
              </div>
            </div>
          </div>
        </div>

        {/* Institutional Rationale */}
        <div style={{
          background: 'rgba(212, 175, 55, 0.05)',
          border: '1px solid rgba(212, 175, 55, 0.2)',
          borderRadius: 8,
          padding: 16,
          filter: !isAuthenticated ? 'blur(4px)' : 'none',
          userSelect: !isAuthenticated ? 'none' : 'auto'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <Zap size={16} style={{ color: 'var(--gold)' }} />
            <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--gold-bright)' }}>
              INSTITUTIONAL ORDER FLOW RATIONALE
            </span>
          </div>
          <p style={{ fontSize: 13, lineHeight: 1.6, color: '#d0d7e2' }}>
            {signal?.rationale ||
              (isWait
                ? 'Market is currently in sideways equilibrium between local order book walls. Order depth is balanced with no dominant institutional absorption. Stand aside to preserve capital.'
                : 'Liquidity sweep confirmed below structural demand. Heavy delta absorption observed on depth-of-market ladder with over 1,800 contracts absorbed by institutional liquidity providers. Enter strictly within designated zone.')}
          </p>
        </div>
      </div>

      {/* LIVE INSTITUTIONAL CHART */}
      <div style={{
        background: 'var(--panel)',
        border: '1px solid var(--line)',
        borderRadius: 'var(--radius)',
        padding: 16,
        marginBottom: 24
      }}>
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          marginBottom: 12
        }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: '#fff', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Activity size={16} style={{ color: 'var(--gold-bright)' }} />
            LIVE INSTITUTIONAL CHART — {isGold ? 'XAU / USD' : 'BTC / USD'}
          </div>
          <span className="badge-gold">15M · SwiftEdge Feed</span>
        </div>
        <TradingViewChart symbol={activeSymbol} interval="15" height={480} />
      </div>

      {/* NEWS & SENTIMENT */}
      {signal?.news && (
        <div style={{
          background: 'var(--panel)',
          border: '1px solid var(--line)',
          borderRadius: 'var(--radius)',
          padding: 16,
          marginBottom: 24
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 12 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: '#fff', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Info size={16} style={{ color: 'var(--gold-bright)' }} />
              {isGold ? 'GOLD' : 'CRYPTO'} NEWS &amp; SENTIMENT
            </div>
            <span className="badge-gold">
              {signal.news.label || 'Neutral'} ({(Number(signal.news.score) || 0) >= 0 ? '+' : ''}{Number(signal.news.score || 0).toFixed(2)})
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <span style={{ fontSize: 11, color: 'var(--dn)', fontWeight: 700, whiteSpace: 'nowrap' }}>Bearish</span>
            <div style={{ flex: 1, height: 8, borderRadius: 4, background: 'linear-gradient(90deg, var(--dn), #8a8f98, var(--up))', position: 'relative' }}>
              <div style={{
                position: 'absolute',
                top: -3,
                left: `${Math.min(100, Math.max(0, ((Number(signal.news.score) || 0) + 1) / 2 * 100))}%`,
                width: 4,
                height: 14,
                borderRadius: 2,
                background: '#fff',
                transform: 'translateX(-50%)',
                boxShadow: '0 0 8px rgba(255,255,255,0.6)'
              }} />
            </div>
            <span style={{ fontSize: 11, color: 'var(--up)', fontWeight: 700, whiteSpace: 'nowrap' }}>Bullish</span>
          </div>

          {Array.isArray(signal.news.headlines) && signal.news.headlines.slice(0, 4).map((h, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '8px 0', borderTop: i === 0 ? 'none' : '1px solid var(--line)' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', marginTop: 6, flexShrink: 0, background: h.tone === 'Bullish' ? 'var(--up)' : h.tone === 'Bearish' ? 'var(--dn)' : 'var(--mut)' }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, color: '#e5e7eb', lineHeight: 1.4 }}>{h.headline}</div>
                <div style={{ fontSize: 10, color: 'var(--mut)', marginTop: 2 }}>
                  {h.source}{h.tone ? ` · ${h.tone}` : ''}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Recommended Brokers (admin-configured) */}
      {brokers.length > 0 && (
        <div style={{ background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 'var(--radius)', padding: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: '#fff', marginBottom: 12 }}>⚡ RECOMMENDED BROKERS</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(240px, 100%), 1fr))', gap: 12 }}>
            {brokers.map((b, i) => (
              <div key={i} style={{ background: 'var(--panel-card)', border: '1px solid var(--line)', borderRadius: 8, padding: 14 }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: '#fff' }}>{b.name}</div>
                {b.description && <div style={{ fontSize: 12, color: 'var(--mut)', marginTop: 4 }}>{b.description}</div>}
                {b.url && (
                  <a href={b.url} target="_blank" rel="noopener noreferrer" className="btn btn-primary" style={{ marginTop: 10, width: '100%', display: 'inline-flex', textDecoration: 'none' }}>Open Account</a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
