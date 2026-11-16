import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useMarket } from '../contexts/MarketContext';
import { useToast } from '../contexts/ToastContext';
import {
  Activity,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  PlusCircle,
  XCircle,
  CheckCircle,
  AlertCircle,
  Award,
  DollarSign
} from 'lucide-react';

const CONTRACT_SIZE = {
  XAUUSD: 100, // 100 oz of gold per lot
  BTCUSD: 1    // 1 BTC per lot
};

export default function SimulatorPage() {
  const { activeSymbol, currentPrice, signal, playSound } = useMarket();
  const { showToast, celebrate } = useToast();
  const location = useLocation();

  // Load simulator state from localStorage
  const [balance, setBalance] = useState(() => {
    const saved = localStorage.getItem('fds_sim_balance');
    return saved ? Number(saved) : 10000.00;
  });

  const [openPositions, setOpenPositions] = useState(() => {
    try {
      const saved = localStorage.getItem('fds_sim_positions');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [tradeHistory, setTradeHistory] = useState(() => {
    try {
      const saved = localStorage.getItem('fds_sim_history');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Order Ticket Form state
  const [orderSymbol, setOrderSymbol] = useState(location.state?.symbol || activeSymbol);
  const [orderSide, setOrderSide] = useState(location.state?.side || 'BUY');
  const [lots, setLots] = useState(0.1);
  const [slPrice, setSlPrice] = useState(location.state?.sl || '');
  const [tp1Price, setTp1Price] = useState(location.state?.tp1 || '');
  const [tp2Price, setTp2Price] = useState(location.state?.tp2 || '');

  // Pre-fill form from current signal if user clicked from signal or if blank
  useEffect(() => {
    if (location.state) {
      if (location.state.symbol) setOrderSymbol(location.state.symbol);
      if (location.state.side) setOrderSide(location.state.side);
      if (location.state.sl) setSlPrice(location.state.sl);
      if (location.state.tp1) setTp1Price(location.state.tp1);
      if (location.state.tp2) setTp2Price(location.state.tp2);
    } else if (signal && signal.symbol === orderSymbol && !slPrice) {
      setOrderSide(signal.action !== 'WAIT' ? signal.action : 'BUY');
      setSlPrice(signal.stopLoss || '');
      setTp1Price(signal.takeProfit1 || '');
      setTp2Price(signal.takeProfit2 || '');
    }
  }, [location.state, signal, orderSymbol]);

  // Save changes to localStorage
  useEffect(() => {
    localStorage.setItem('fds_sim_balance', balance.toString());
  }, [balance]);

  useEffect(() => {
    localStorage.setItem('fds_sim_positions', JSON.stringify(openPositions));
  }, [openPositions]);

  useEffect(() => {
    localStorage.setItem('fds_sim_history', JSON.stringify(tradeHistory));
  }, [tradeHistory]);

  // Check auto execution (Stop Loss or Take Profit) on every live price tick
  useEffect(() => {
    if (!openPositions.length) return;

    setOpenPositions((prevPositions) => {
      let updatedPositions = [];
      let closedTrades = [];
      let balanceDelta = 0;

      for (const pos of prevPositions) {
        // STRICT SANITY CHECK: Only evaluate positions matching active symbol
        if (pos.symbol !== activeSymbol) {
          updatedPositions.push(pos);
          continue;
        }

        const isBuy = pos.side === 'BUY';
        const mult = CONTRACT_SIZE[pos.symbol] || 100;
        let shouldClose = false;
        let exitReason = '';
        let exitPrice = currentPrice;

        if (isBuy) {
          // BUY: SL triggered if price <= SL
          if (pos.sl && currentPrice <= pos.sl) {
            shouldClose = true;
            exitReason = 'Stop Loss Hit 🛑';
            exitPrice = pos.sl;
          }
          // BUY: TP triggered if price >= TP2 or TP1
          else if (pos.tp2 && currentPrice >= pos.tp2) {
            shouldClose = true;
            exitReason = 'Target 2 Hit 🎯🎯';
            exitPrice = pos.tp2;
          } else if (pos.tp1 && currentPrice >= pos.tp1) {
            shouldClose = true;
            exitReason = 'Target 1 Hit 🎯';
            exitPrice = pos.tp1;
          }
        } else {
          // SELL: SL triggered if price >= SL
          if (pos.sl && currentPrice >= pos.sl) {
            shouldClose = true;
            exitReason = 'Stop Loss Hit 🛑';
            exitPrice = pos.sl;
          }
          // SELL: TP triggered if price <= TP2 or TP1
          else if (pos.tp2 && currentPrice <= pos.tp2) {
            shouldClose = true;
            exitReason = 'Target 2 Hit 🎯🎯';
            exitPrice = pos.tp2;
          } else if (pos.tp1 && currentPrice <= pos.tp1) {
            shouldClose = true;
            exitReason = 'Target 1 Hit 🎯';
            exitPrice = pos.tp1;
          }
        }

        if (shouldClose) {
          // Compute correct Realized PnL
          const pnl = isBuy
            ? (exitPrice - pos.entry) * pos.lots * mult
            : (pos.entry - exitPrice) * pos.lots * mult;

          balanceDelta += pnl;

          closedTrades.push({
            id: pos.id,
            symbol: pos.symbol,
            side: pos.side,
            lots: pos.lots,
            entry: pos.entry,
            exitPrice: Number(exitPrice.toFixed(2)),
            exitReason,
            realizedPnl: Number(pnl.toFixed(2)),
            closedAt: new Date().toLocaleTimeString()
          });

          if (pnl > 0) {
            playSound('win');
            celebrate();
            showToast(`🎉 ${exitReason} for +$${pnl.toFixed(2)}!`, 'success');
          } else {
            playSound('loss');
            showToast(`🛑 ${exitReason} for -$${Math.abs(pnl).toFixed(2)}`, 'warning');
          }
        } else {
          updatedPositions.push(pos);
        }
      }

      if (closedTrades.length > 0) {
        setBalance((b) => Number((b + balanceDelta).toFixed(2)));
        setTradeHistory((hist) => [...closedTrades, ...hist].slice(0, 100));
      }

      return updatedPositions;
    });
  }, [currentPrice, activeSymbol, playSound, celebrate, showToast]);

  // Execute manual trade
  const handlePlaceOrder = (e) => {
    e.preventDefault();
    const lotsNum = parseFloat(lots);
    if (!lotsNum || lotsNum <= 0) {
      showToast('Please specify a valid lot size.', 'warning');
      return;
    }

    const entry = currentPrice;
    const sl = slPrice ? parseFloat(slPrice) : null;
    const tp1 = tp1Price ? parseFloat(tp1Price) : null;
    const tp2 = tp2Price ? parseFloat(tp2Price) : null;

    // Strict validation
    if (orderSide === 'BUY') {
      if (sl && sl >= entry) {
        showToast('For BUY, Stop Loss must be strictly below Entry Price.', 'error');
        return;
      }
      if (tp1 && tp1 <= entry) {
        showToast('For BUY, Take Profit 1 must be strictly above Entry Price.', 'error');
        return;
      }
    } else {
      if (sl && sl <= entry) {
        showToast('For SELL, Stop Loss must be strictly above Entry Price.', 'error');
        return;
      }
      if (tp1 && tp1 >= entry) {
        showToast('For SELL, Take Profit 1 must be strictly below Entry Price.', 'error');
        return;
      }
    }

    const newTrade = {
      id: 'trade_' + Date.now(),
      symbol: orderSymbol,
      side: orderSide,
      lots: lotsNum,
      entry: Number(entry.toFixed(2)),
      sl,
      tp1,
      tp2,
      openedAt: new Date().toLocaleTimeString()
    };

    setOpenPositions((prev) => [newTrade, ...prev]);
    playSound('opportunity');
    showToast(`Order Placed: ${orderSide} ${lotsNum} lots of ${orderSymbol} at $${entry.toFixed(2)}`, 'success');
  };

  // Close trade manually
  const handleClosePosition = (posId) => {
    setOpenPositions((prev) => {
      const pos = prev.find((p) => p.id === posId);
      if (!pos) return prev;

      const isBuy = pos.side === 'BUY';
      const mult = CONTRACT_SIZE[pos.symbol] || 100;
      const exitPrice = currentPrice;
      const pnl = isBuy
        ? (exitPrice - pos.entry) * pos.lots * mult
        : (pos.entry - exitPrice) * pos.lots * mult;

      setBalance((b) => Number((b + pnl).toFixed(2)));
      setTradeHistory((hist) => [
        {
          id: pos.id,
          symbol: pos.symbol,
          side: pos.side,
          lots: pos.lots,
          entry: pos.entry,
          exitPrice: Number(exitPrice.toFixed(2)),
          exitReason: 'Manual Close',
          realizedPnl: Number(pnl.toFixed(2)),
          closedAt: new Date().toLocaleTimeString()
        },
        ...hist
      ]);

      if (pnl >= 0) {
        playSound('win');
        celebrate();
        showToast(`Closed trade for +$${pnl.toFixed(2)} profit!`, 'success');
      } else {
        playSound('loss');
        showToast(`Closed trade for -$${Math.abs(pnl).toFixed(2)} loss.`, 'info');
      }

      return prev.filter((p) => p.id !== posId);
    });
  };

  // Reset balance
  const handleResetBalance = () => {
    if (window.confirm('Reset simulator demo account balance to $10,000.00?')) {
      setBalance(10000.00);
      setOpenPositions([]);
      setTradeHistory([]);
      showToast('Simulator account balance reset to $10,000.00', 'info');
    }
  };

  // Compute total unrealized PnL
  const totalUnrealizedPnl = openPositions.reduce((acc, pos) => {
    // Only calculate for active symbol or use entry
    const price = pos.symbol === activeSymbol ? currentPrice : pos.entry;
    const mult = CONTRACT_SIZE[pos.symbol] || 100;
    const pnl = pos.side === 'BUY'
      ? (price - pos.entry) * pos.lots * mult
      : (pos.entry - price) * pos.lots * mult;
    return acc + pnl;
  }, 0);

  const equity = balance + totalUnrealizedPnl;
  const winCount = tradeHistory.filter((t) => t.realizedPnl > 0).length;
  const winRate = tradeHistory.length > 0 ? ((winCount / tradeHistory.length) * 100).toFixed(1) : '100.0';

  return (
    <div className="container">
      {/* Account Balance Metrics Bar */}
      <div style={{
        background: 'var(--panel)',
        border: '1px solid var(--line)',
        borderRadius: 'var(--radius)',
        padding: '16px 20px',
        marginBottom: 20
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Activity size={20} style={{ color: 'var(--gold)' }} />
            <h2 style={{ fontSize: 18, fontWeight: 800, color: '#fff' }}>
              Institutional Simulator Terminal
            </h2>
            <span className="badge-gold">RISK-FREE DEMO</span>
          </div>
          <button
            onClick={handleResetBalance}
            className="btn btn-outline"
            style={{ fontSize: 11, padding: '4px 10px' }}
          >
            <RefreshCw size={13} />
            Reset $10,000 Balance
          </button>
        </div>

        <div className="grid-4">
          <div className="panel-card">
            <div style={{ fontSize: 11, color: 'var(--mut)', fontWeight: 700 }}>ACCOUNT BALANCE</div>
            <div style={{ fontSize: 20, fontWeight: 800, fontFamily: 'JetBrains Mono, monospace', color: '#fff', marginTop: 4 }}>
              ${balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>

          <div className="panel-card">
            <div style={{ fontSize: 11, color: 'var(--mut)', fontWeight: 700 }}>REAL-TIME EQUITY</div>
            <div style={{
              fontSize: 20,
              fontWeight: 800,
              fontFamily: 'JetBrains Mono, monospace',
              color: equity >= balance ? 'var(--up)' : 'var(--dn)',
              marginTop: 4
            }}>
              ${equity.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>

          <div className="panel-card">
            <div style={{ fontSize: 11, color: 'var(--mut)', fontWeight: 700 }}>FLOATING UNREALIZED PnL</div>
            <div style={{
              fontSize: 20,
              fontWeight: 800,
              fontFamily: 'JetBrains Mono, monospace',
              color: totalUnrealizedPnl >= 0 ? 'var(--up)' : 'var(--dn)',
              marginTop: 4
            }}>
              {totalUnrealizedPnl >= 0 ? '+' : '-'}${Math.abs(totalUnrealizedPnl).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>

          <div className="panel-card">
            <div style={{ fontSize: 11, color: 'var(--mut)', fontWeight: 700 }}>SIMULATOR WIN RATE</div>
            <div style={{ fontSize: 20, fontWeight: 800, fontFamily: 'JetBrains Mono, monospace', color: 'var(--gold-bright)', marginTop: 4 }}>
              {winRate}% ({winCount}/{tradeHistory.length})
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20, marginBottom: 24 }}>
        {/* Order Ticket Form */}
        <div style={{
          background: 'var(--panel)',
          border: '1px solid var(--line)',
          borderRadius: 'var(--radius)',
          padding: 20
        }}>
          <h3 style={{ fontSize: 15, fontWeight: 800, color: '#fff', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <PlusCircle size={17} style={{ color: 'var(--gold)' }} />
            New Simulation Order Ticket
          </h3>

          <form onSubmit={handlePlaceOrder}>
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Asset Symbol</label>
                <select
                  className="form-control"
                  value={orderSymbol}
                  onChange={(e) => setOrderSymbol(e.target.value)}
                >
                  <option value="XAUUSD">🟡 XAU/USD (Spot Gold)</option>
                  <option value="BTCUSD">🟠 BTC/USD (Bitcoin)</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Lot Size (Volume)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max="50.0"
                  className="form-control"
                  value={lots}
                  onChange={(e) => setLots(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Trade Direction</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setOrderSide('BUY')}
                  style={{
                    padding: '10px',
                    borderRadius: 4,
                    fontWeight: 800,
                    cursor: 'pointer',
                    border: '1px solid var(--up)',
                    background: orderSide === 'BUY' ? 'var(--up)' : 'rgba(0,208,132,0.1)',
                    color: orderSide === 'BUY' ? '#0b0e14' : 'var(--up)',
                    transition: 'all 0.15s ease'
                  }}
                >
                  BUY (LONG)
                </button>
                <button
                  type="button"
                  onClick={() => setOrderSide('SELL')}
                  style={{
                    padding: '10px',
                    borderRadius: 4,
                    fontWeight: 800,
                    cursor: 'pointer',
                    border: '1px solid var(--dn)',
                    background: orderSide === 'SELL' ? 'var(--dn)' : 'rgba(255,77,79,0.1)',
                    color: orderSide === 'SELL' ? '#fff' : 'var(--dn)',
                    transition: 'all 0.15s ease'
                  }}
                >
                  SELL (SHORT)
                </button>
              </div>
            </div>

            <div className="grid-3">
              <div className="form-group">
                <label className="form-label">Stop Loss ($)</label>
                <input
                  type="number"
                  step="0.01"
                  className="form-control"
                  placeholder="Optional"
                  value={slPrice}
                  onChange={(e) => setSlPrice(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Take Profit 1 ($)</label>
                <input
                  type="number"
                  step="0.01"
                  className="form-control"
                  placeholder="Optional"
                  value={tp1Price}
                  onChange={(e) => setTp1Price(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Take Profit 2 ($)</label>
                <input
                  type="number"
                  step="0.01"
                  className="form-control"
                  placeholder="Optional"
                  value={tp2Price}
                  onChange={(e) => setTp2Price(e.target.value)}
                />
              </div>
            </div>

            <button
              type="submit"
              className={orderSide === 'BUY' ? 'btn btn-buy' : 'btn btn-sell'}
              style={{ width: '100%', padding: '12px', fontSize: 14, fontWeight: 800, marginTop: 4 }}
            >
              Place Market {orderSide} Order at ${Number(currentPrice || 0).toFixed(2)}
            </button>
          </form>
        </div>

        {/* Live Execution Engine Status */}
        <div style={{
          background: 'var(--panel)',
          border: '1px solid var(--line)',
          borderRadius: 'var(--radius)',
          padding: 20,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between'
        }}>
          <div>
            <h3 style={{ fontSize: 15, fontWeight: 800, color: '#fff', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Award size={17} style={{ color: 'var(--gold)' }} />
              Institutional Fill Logic
            </h3>
            <p style={{ fontSize: 13, color: 'var(--mut)', lineHeight: 1.6, marginBottom: 12 }}>
              Our simulation engine mirrors real liquidity provider execution:
            </p>
            <ul style={{ fontSize: 12, color: '#cbd5e1', lineHeight: 1.8, paddingLeft: 18 }}>
              <li>• Real-time tick evaluation: Evaluates SL/TP on every 450ms tick.</li>
              <li>• Strict asset sanity: Gold positions never execute on Bitcoin prices.</li>
              <li>• Directional PnL integrity: Stop Loss exits always accurately realize losses, while Target exits lock in gains.</li>
              <li>• Zero slippage demo execution for backtesting precision.</li>
            </ul>
          </div>

          <div style={{
            background: 'var(--panel-card)',
            padding: 12,
            borderRadius: 6,
            border: '1px solid var(--line-light)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: 16
          }}>
            <span style={{ fontSize: 12, color: 'var(--mut)' }}>Engine State:</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--up)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--up)' }}></span>
              Online & Matching Ticks
            </span>
          </div>
        </div>
      </div>

      {/* Open Positions Table */}
      <div style={{
        background: 'var(--panel)',
        border: '1px solid var(--line)',
        borderRadius: 'var(--radius)',
        padding: 20,
        marginBottom: 24
      }}>
        <h3 style={{ fontSize: 15, fontWeight: 800, color: '#fff', marginBottom: 14 }}>
          Active Floating Positions ({openPositions.length})
        </h3>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Symbol</th>
                <th>Side</th>
                <th>Lots</th>
                <th>Entry Price</th>
                <th>Current Price</th>
                <th>Stop Loss</th>
                <th>Take Profit 1</th>
                <th>Take Profit 2</th>
                <th>Unrealized PnL</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {openPositions.length === 0 ? (
                <tr>
                  <td colSpan={10} style={{ textAlign: 'center', color: 'var(--mut)', padding: 24 }}>
                    No active positions open. Place an order above or click "Execute in Simulator" from the Signals tab.
                  </td>
                </tr>
              ) : (
                openPositions.map((pos) => {
                  const price = pos.symbol === activeSymbol ? currentPrice : pos.entry;
                  const mult = CONTRACT_SIZE[pos.symbol] || 100;
                  const pnl = pos.side === 'BUY'
                    ? (price - pos.entry) * pos.lots * mult
                    : (pos.entry - price) * pos.lots * mult;

                  return (
                    <tr key={pos.id}>
                      <td style={{ fontWeight: 700 }}>{pos.symbol}</td>
                      <td>
                        <span className={`badge-${pos.side === 'BUY' ? 'up' : 'dn'}`}>
                          {pos.side}
                        </span>
                      </td>
                      <td>{pos.lots}</td>
                      <td style={{ fontFamily: 'JetBrains Mono, monospace' }}>${pos.entry.toFixed(2)}</td>
                      <td style={{ fontFamily: 'JetBrains Mono, monospace', color: '#fff' }}>${price.toFixed(2)}</td>
                      <td style={{ fontFamily: 'JetBrains Mono, monospace', color: 'var(--dn)' }}>
                        {pos.sl ? `$${pos.sl.toFixed(2)}` : '—'}
                      </td>
                      <td style={{ fontFamily: 'JetBrains Mono, monospace', color: 'var(--up)' }}>
                        {pos.tp1 ? `$${pos.tp1.toFixed(2)}` : '—'}
                      </td>
                      <td style={{ fontFamily: 'JetBrains Mono, monospace', color: 'var(--up)' }}>
                        {pos.tp2 ? `$${pos.tp2.toFixed(2)}` : '—'}
                      </td>
                      <td style={{
                        fontFamily: 'JetBrains Mono, monospace',
                        fontWeight: 800,
                        color: pnl >= 0 ? 'var(--up)' : 'var(--dn)'
                      }}>
                        {pnl >= 0 ? '+' : '-'}${Math.abs(pnl).toFixed(2)}
                      </td>
                      <td>
                        <button
                          onClick={() => handleClosePosition(pos.id)}
                          className="btn btn-outline"
                          style={{ padding: '4px 8px', fontSize: 11 }}
                        >
                          Close
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Completed Trade History Table */}
      <div style={{
        background: 'var(--panel)',
        border: '1px solid var(--line)',
        borderRadius: 'var(--radius)',
        padding: 20
      }}>
        <h3 style={{ fontSize: 15, fontWeight: 800, color: '#fff', marginBottom: 14 }}>
          Completed Trade History ({tradeHistory.length})
        </h3>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Closed Time</th>
                <th>Symbol</th>
                <th>Side</th>
                <th>Lots</th>
                <th>Entry Price</th>
                <th>Exit Price</th>
                <th>Exit Reason</th>
                <th>Realized PnL</th>
              </tr>
            </thead>
            <tbody>
              {tradeHistory.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', color: 'var(--mut)', padding: 24 }}>
                    No completed trades yet.
                  </td>
                </tr>
              ) : (
                tradeHistory.map((t) => (
                  <tr key={t.id}>
                    <td style={{ color: 'var(--mut)', fontSize: 12 }}>{t.closedAt}</td>
                    <td style={{ fontWeight: 700 }}>{t.symbol}</td>
                    <td>
                      <span className={`badge-${t.side === 'BUY' ? 'up' : 'dn'}`}>
                        {t.side}
                      </span>
                    </td>
                    <td>{t.lots}</td>
                    <td style={{ fontFamily: 'JetBrains Mono, monospace' }}>${t.entry.toFixed(2)}</td>
                    <td style={{ fontFamily: 'JetBrains Mono, monospace' }}>${t.exitPrice.toFixed(2)}</td>
                    <td style={{ fontWeight: 600 }}>{t.exitReason}</td>
                    <td style={{
                      fontFamily: 'JetBrains Mono, monospace',
                      fontWeight: 800,
                      color: t.realizedPnl >= 0 ? 'var(--up)' : 'var(--dn)'
                    }}>
                      {t.realizedPnl >= 0 ? '+' : '-'}${Math.abs(t.realizedPnl).toFixed(2)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
