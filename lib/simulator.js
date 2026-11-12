// Realistic Trading Simulation Engine
// Handles: Order placement, live tick evaluation, auto-close on TP1, TP2, and SL hit, manual close, and performance analytics

const db = require('./db');
const { getSignal } = require('./signals');

// Calculate PnL for given symbol, side, lot size, entry, and exit
function calculatePnL(symbol, side, lotSize, entryPrice, currentPrice) {
  const normSymbol = symbol.toUpperCase().replace('/', '');
  const dir = side.toUpperCase() === 'BUY' ? 1 : -1;
  const priceDiff = (currentPrice - entryPrice) * dir;

  let dollarPnL = 0;
  let pips = 0;

  if (normSymbol === 'XAUUSD') {
    // 1 standard lot = 100 oz. $1 move per oz = $100 per lot
    dollarPnL = priceDiff * (lotSize * 100);
    pips = priceDiff * 10;
  } else if (normSymbol === 'GBPUSD') {
    // 1 standard lot = 100,000 units. 0.0001 (1 pip) = $10 per lot
    dollarPnL = priceDiff * (lotSize * 100000);
    pips = priceDiff * 10000;
  } else if (normSymbol === 'GBPJPY') {
    // 1 standard lot = 100,000 units. 0.01 (1 pip) = approx $6.50 - $7.00 per lot (assuming USDJPY ~ 150)
    dollarPnL = (priceDiff / 153.8) * (lotSize * 100000);
    pips = priceDiff * 100;
  } else {
    dollarPnL = priceDiff * (lotSize * 100);
    pips = priceDiff * 10;
  }

  return {
    dollarPnL: +dollarPnL.toFixed(2),
    pips: +pips.toFixed(1)
  };
}

// Check open trades against current live market price and auto-close when TP1, TP2, or SL is hit
async function evaluateOpenTradesForUser(userId) {
  // Query open trades
  let openTrades = [];
  if (db.isConnectedToPostgres()) {
    const res = await db.query(
      `SELECT * FROM simulated_trades WHERE user_id = $1 AND status = 'open' ORDER BY opened_at ASC`,
      [userId]
    );
    openTrades = res.rows;
  } else {
    openTrades = db.memoryStore.simulated_trades.filter(t => t.user_id === userId && t.status === 'open');
  }

  if (!openTrades.length) return [];

  // Group by symbol to fetch signals once
  const symbols = [...new Set(openTrades.map(t => t.symbol))];
  const signalsMap = {};
  for (const sym of symbols) {
    signalsMap[sym] = await getSignal(sym);
  }

  const updatedTrades = [];

  for (const trade of openTrades) {
    const sig = signalsMap[trade.symbol];
    if (!sig) continue;

    const currentPrice = sig.price;
    const entry = +trade.entry_price;
    const sl = trade.sl_price ? +trade.sl_price : null;
    const tp1 = trade.tp1_price ? +trade.tp1_price : null;
    const tp2 = trade.tp2_price ? +trade.tp2_price : null;
    const isBuy = trade.side.toUpperCase() === 'BUY';

    let shouldClose = false;
    let closeStatus = 'open';
    let closeReason = '';
    let exitPrice = currentPrice;

    if (isBuy) {
      if (tp2 && currentPrice >= tp2) {
        shouldClose = true;
        closeStatus = 'tp2';
        closeReason = 'Take Profit 2 Hit 🎯🎯';
        exitPrice = tp2;
      } else if (tp1 && currentPrice >= tp1) {
        shouldClose = true;
        closeStatus = 'tp1';
        closeReason = 'Take Profit 1 Hit 🎯';
        exitPrice = tp1;
      } else if (sl && currentPrice <= sl) {
        shouldClose = true;
        closeStatus = 'sl';
        closeReason = 'Stop Loss Hit 🛑';
        exitPrice = sl;
      }
    } else {
      // SELL position
      if (tp2 && currentPrice <= tp2) {
        shouldClose = true;
        closeStatus = 'tp2';
        closeReason = 'Take Profit 2 Hit 🎯🎯';
        exitPrice = tp2;
      } else if (tp1 && currentPrice <= tp1) {
        shouldClose = true;
        closeStatus = 'tp1';
        closeReason = 'Take Profit 1 Hit 🎯';
        exitPrice = tp1;
      } else if (sl && currentPrice >= sl) {
        shouldClose = true;
        closeStatus = 'sl';
        closeReason = 'Stop Loss Hit 🛑';
        exitPrice = sl;
      }
    }

    const { dollarPnL, pips } = calculatePnL(trade.symbol, trade.side, +trade.lot_size, entry, exitPrice);

    if (shouldClose) {
      if (db.isConnectedToPostgres()) {
        await db.query(
          `UPDATE simulated_trades 
           SET status = $1, exit_price = $2, pnl = $3, pnl_pips = $4, close_reason = $5, closed_at = NOW() 
           WHERE id = $6`,
          [closeStatus, exitPrice, dollarPnL, pips, closeReason, trade.id]
        );
      } else {
        trade.status = closeStatus;
        trade.exit_price = exitPrice;
        trade.pnl = dollarPnL;
        trade.pnl_pips = pips;
        trade.close_reason = closeReason;
        trade.closed_at = new Date();
      }
      trade.status = closeStatus;
      trade.pnl = dollarPnL;
      trade.pnl_pips = pips;
      trade.exit_price = exitPrice;
      trade.close_reason = closeReason;
      trade.isJustClosed = true;
    } else {
      // Live floating PnL
      const floating = calculatePnL(trade.symbol, trade.side, +trade.lot_size, entry, currentPrice);
      trade.current_price = currentPrice;
      trade.floating_pnl = floating.dollarPnL;
      trade.floating_pips = floating.pips;
    }
    updatedTrades.push(trade);
  }

  return updatedTrades;
}

// Place a new simulated trade
async function placeTrade(userId, { symbol, side, lotSize, entryPrice, slPrice, tp1Price, tp2Price }) {
  const normSymbol = (symbol || 'XAUUSD').toUpperCase().replace('/', '');
  const normSide = (side || 'BUY').toUpperCase();
  const lots = Math.max(0.01, Math.min(100, parseFloat(lotSize) || 0.10));

  // If entry price not passed or 0, fetch current live price
  let entry = parseFloat(entryPrice);
  if (!entry || isNaN(entry)) {
    const sig = await getSignal(normSymbol);
    entry = sig.price;
  }

  let sl = slPrice ? parseFloat(slPrice) : null;
  let tp1 = tp1Price ? parseFloat(tp1Price) : null;
  let tp2 = tp2Price ? parseFloat(tp2Price) : null;

  // Auto-populate TP and SL from signal if not provided
  if (!sl || !tp1 || !tp2) {
    const sig = await getSignal(normSymbol);
    if (!sl) sl = sig.stop;
    if (!tp1) tp1 = sig.target;
    if (!tp2) tp2 = sig.target2;
  }

  let newTrade;
  if (db.isConnectedToPostgres()) {
    const res = await db.query(
      `INSERT INTO simulated_trades (user_id, symbol, side, lot_size, entry_price, sl_price, tp1_price, tp2_price, status, opened_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'open', NOW())
       RETURNING *`,
      [userId, normSymbol, normSide, lots, entry, sl, tp1, tp2]
    );
    newTrade = res.rows[0];
  } else {
    newTrade = {
      id: 'trade-' + Date.now(),
      user_id: userId,
      symbol: normSymbol,
      side: normSide,
      lot_size: lots,
      entry_price: entry,
      sl_price: sl,
      tp1_price: tp1,
      tp2_price: tp2,
      exit_price: null,
      pnl: 0,
      pnl_pips: 0,
      status: 'open',
      close_reason: null,
      opened_at: new Date()
    };
    db.memoryStore.simulated_trades.unshift(newTrade);
  }

  return newTrade;
}

// Manually close an open position
async function closeTrade(userId, tradeId) {
  let trade;
  if (db.isConnectedToPostgres()) {
    const res = await db.query(`SELECT * FROM simulated_trades WHERE id = $1 AND user_id = $2 AND status = 'open'`, [tradeId, userId]);
    trade = res.rows[0];
  } else {
    trade = db.memoryStore.simulated_trades.find(t => t.id === tradeId && t.user_id === userId && t.status === 'open');
  }

  if (!trade) {
    throw new Error('Position not found or already closed.');
  }

  const sig = await getSignal(trade.symbol);
  const exitPrice = sig.price;
  const { dollarPnL, pips } = calculatePnL(trade.symbol, trade.side, +trade.lot_size, +trade.entry_price, exitPrice);

  if (db.isConnectedToPostgres()) {
    const updated = await db.query(
      `UPDATE simulated_trades 
       SET status = 'closed', exit_price = $1, pnl = $2, pnl_pips = $3, close_reason = 'Manually Closed by Trader', closed_at = NOW() 
       WHERE id = $4
       RETURNING *`,
      [exitPrice, dollarPnL, pips, tradeId]
    );
    return updated.rows[0];
  } else {
    trade.status = 'closed';
    trade.exit_price = exitPrice;
    trade.pnl = dollarPnL;
    trade.pnl_pips = pips;
    trade.close_reason = 'Manually Closed by Trader';
    trade.closed_at = new Date();
    return trade;
  }
}

// Get user trade history & performance stats
async function getTradeHistory(userId) {
  let allTrades = [];
  if (db.isConnectedToPostgres()) {
    const res = await db.query(
      `SELECT * FROM simulated_trades WHERE user_id = $1 ORDER BY opened_at DESC`,
      [userId]
    );
    allTrades = res.rows;
  } else {
    allTrades = db.memoryStore.simulated_trades.filter(t => t.user_id === userId);
  }

  const closed = allTrades.filter(t => t.status !== 'open');
  const open = allTrades.filter(t => t.status === 'open');

  const wins = closed.filter(t => +t.pnl > 0);
  const losses = closed.filter(t => +t.pnl < 0);
  const totalPnl = closed.reduce((acc, t) => acc + (+t.pnl || 0), 0);
  const totalWinPnl = wins.reduce((acc, t) => acc + (+t.pnl || 0), 0);
  const totalLossPnl = Math.abs(losses.reduce((acc, t) => acc + (+t.pnl || 0), 0));

  const winRate = closed.length ? Math.round((wins.length / closed.length) * 100) : 0;
  const profitFactor = totalLossPnl > 0 ? +(totalWinPnl / totalLossPnl).toFixed(2) : totalWinPnl > 0 ? 99.0 : 1.0;

  return {
    open,
    closed,
    stats: {
      totalTrades: closed.length,
      openTrades: open.length,
      wins: wins.length,
      losses: losses.length,
      winRate,
      totalPnl: +totalPnl.toFixed(2),
      profitFactor,
      initialBalance: 10000.00,
      currentEquity: +(10000.00 + totalPnl).toFixed(2)
    }
  };
}

module.exports = {
  calculatePnL,
  evaluateOpenTradesForUser,
  placeTrade,
  closeTrade,
  getTradeHistory
};
