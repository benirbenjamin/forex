// Crypto P2P Engine (Buy & Sell USDT, Inventory Deduction, AI Receipt Proof Verification, Order Flow)
const db = require('./db');
const { analyzePaymentScreenshot } = require('./receiptVerifier');
const { uploadToGoogleDrive } = require('./gdrive');
const { getUsdToRwfRate } = require('./currency');

// Track Admin Last Active Presence
let adminLastSeen = new Date();
let isAdminOnline = true;

function touchAdminPresence() {
  adminLastSeen = new Date();
  isAdminOnline = true;
}

function getAdminPresence() {
  const now = new Date();
  const diffMinutes = Math.floor((now - adminLastSeen) / 60000);
  if (diffMinutes < 5) {
    return { isOnline: true, statusText: 'Online (Support Agent Active)' };
  } else if (diffMinutes < 60) {
    return { isOnline: false, statusText: `Active ${diffMinutes} min ago` };
  } else {
    return { isOnline: false, statusText: 'Offline (Will respond soon)' };
  }
}

// Get P2P portal settings & current available inventory
async function getP2PInfo() {
  let inv;
  let paymentMethods = [];
  let adminWallets = [];
  const rate = await getUsdToRwfRate();

  if (db.isConnectedToPostgres()) {
    const invRes = await db.query('SELECT * FROM p2p_inventory LIMIT 1');
    inv = invRes.rows[0];

    const pmRes = await db.query('SELECT * FROM p2p_payment_methods WHERE is_active = TRUE');
    paymentMethods = pmRes.rows;

    const wRes = await db.query('SELECT * FROM p2p_admin_wallets WHERE is_active = TRUE');
    adminWallets = wRes.rows;
  } else {
    inv = db.memoryStore.p2p_inventory[0];
    paymentMethods = db.memoryStore.p2p_payment_methods.filter(p => p.is_active);
    adminWallets = db.memoryStore.p2p_admin_wallets.filter(w => w.is_active);
  }

  const sellPriceUsd = inv ? +inv.sell_price_usd : 1.00;
  const buyPriceUsd = inv ? +inv.buy_price_usd : 1.00;
  const availableInventory = inv ? +inv.available_inventory : 1000.00;
  const feeType = inv ? inv.fee_type : 'percent';
  const feeAmount = inv ? +inv.fee_amount : 2.00;

  return {
    symbol: 'USDT',
    availableInventory,
    sellPriceUsd,
    sellPriceRwf: Math.round(sellPriceUsd * rate),
    buyPriceUsd,
    buyPriceRwf: Math.round(buyPriceUsd * rate),
    exchangeRateRwf: rate,
    feeConfig: { type: feeType, amount: feeAmount },
    paymentMethods,
    adminWallets,
    adminPresence: getAdminPresence(),
    trc20Notice: 'Provide TRC20 wallet address. Note that the wrong address may result into losing money, no money-back guarantee.'
  };
}

// User Initiates P2P Buy Order
async function createBuyOrder(userId, { cryptoAmount, fiatCurrency, userWalletAddress }) {
  const amount = parseFloat(cryptoAmount);
  if (!amount || amount <= 0) {
    throw new Error('Please enter a valid USDT amount to buy.');
  }

  if (!userWalletAddress || userWalletAddress.trim().length < 15) {
    throw new Error('Valid TRC20 wallet address is required.');
  }

  const info = await getP2PInfo();

  if (amount > info.availableInventory) {
    throw new Error(`Insufficient inventory. Maximum available is ${info.availableInventory} USDT.`);
  }

  const currency = (fiatCurrency || 'USD').toUpperCase();
  const pricePerUnit = currency === 'RWF' ? info.sellPriceRwf : info.sellPriceUsd;

  // Calculate Fee
  let fee = 0;
  if (info.feeConfig.type === 'flat') {
    fee = currency === 'RWF' ? info.feeConfig.amount * info.exchangeRateRwf : info.feeConfig.amount;
  } else {
    fee = (amount * pricePerUnit) * (info.feeConfig.amount / 100);
  }

  const totalFiat = +(amount * pricePerUnit + fee).toFixed(2);

  let newOrder;
  if (db.isConnectedToPostgres()) {
    // 1. Deduct Inventory
    await db.query('UPDATE p2p_inventory SET available_inventory = available_inventory - $1', [amount]);

    // 2. Insert Order
    const res = await db.query(
      `INSERT INTO p2p_orders 
       (user_id, order_type, crypto_symbol, crypto_amount, price_per_unit, fee_amount, total_fiat, fiat_currency, user_wallet_address, status)
       VALUES ($1, 'buy', 'USDT', $2, $3, $4, $5, $6, $7, 'pending_payment')
       RETURNING *`,
      [userId, amount, pricePerUnit, fee, totalFiat, currency, userWalletAddress.trim()]
    );
    newOrder = res.rows[0];

    // 3. Create Admin Notification with Alert
    await db.query(
      `INSERT INTO admin_notifications (title, message, type, reference_id)
       VALUES ($1, $2, 'p2p_order', $3)`,
      ['New P2P Buy Order Placed', `User requested to buy ${amount} USDT (${totalFiat} ${currency}).`, newOrder.id]
    );
  } else {
    const inv = db.memoryStore.p2p_inventory[0];
    inv.available_inventory = Math.max(0, inv.available_inventory - amount);

    newOrder = {
      id: 'p2p-' + Date.now(),
      user_id: userId,
      order_type: 'buy',
      crypto_symbol: 'USDT',
      crypto_amount: amount,
      price_per_unit: pricePerUnit,
      fee_amount: fee,
      total_fiat: totalFiat,
      fiat_currency: currency,
      user_wallet_address: userWalletAddress.trim(),
      status: 'pending_payment',
      proof_screenshot_url: null,
      proof_analysis_status: null,
      created_at: new Date()
    };
    db.memoryStore.p2p_orders.unshift(newOrder);
  }

  return {
    order: newOrder,
    info
  };
}

// User Uploads Payment Screenshot -> AI Analyzes & Verifies
async function uploadAndVerifyScreenshot(orderId, userId, filePath, originalFilename, mimeType, fileSize) {
  if (fileSize > 5 * 1024 * 1024) {
    throw new Error('Screenshot file size exceeds 5MB limit. Please upload a smaller image.');
  }

  // AI OCR Analysis
  const analysis = await analyzePaymentScreenshot(filePath);

  if (!analysis.isValidReceipt) {
    const err = new Error(analysis.reason || 'Invalid screenshot: The uploaded image does not appear to be an authentic payment receipt.');
    err.analysis = analysis;
    err.statusCode = 400;
    throw err;
  }

  // Upload to Google Drive / local fallback
  const uploaded = await uploadToGoogleDrive(filePath, originalFilename, mimeType);

  // Update order record
  if (db.isConnectedToPostgres()) {
    await db.query(
      `UPDATE p2p_orders 
       SET proof_screenshot_url = $1, proof_analysis_status = 'verified', proof_analysis_result = $2, updated_at = NOW() 
       WHERE id = $3`,
      [uploaded.url, JSON.stringify(analysis), orderId]
    );

    // Alert Admin
    await db.query(
      `INSERT INTO admin_notifications (title, message, type, reference_id)
       VALUES ($1, $2, 'p2p_screenshot', $3)`,
      ['Verified Payment Screenshot Uploaded', `A valid payment receipt was submitted for P2P Order #${orderId}.`, orderId]
    );
  } else {
    const ord = db.memoryStore.p2p_orders.find(o => o.id === orderId);
    if (ord) {
      ord.proof_screenshot_url = uploaded.url;
      ord.proof_analysis_status = 'verified';
      ord.proof_analysis_result = analysis;
    }
  }

  return {
    verified: true,
    proofUrl: uploaded.url,
    analysis,
    message: 'Payment screenshot verified! You can now click "I have sent money".'
  };
}

// User Clicks "I have sent money" (Only enabled if verified screenshot exists)
async function confirmUserSentPayment(orderId, userId) {
  let order;
  if (db.isConnectedToPostgres()) {
    const res = await db.query('SELECT * FROM p2p_orders WHERE id = $1 AND user_id = $2 LIMIT 1', [orderId, userId]);
    order = res.rows[0];
  } else {
    order = db.memoryStore.p2p_orders.find(o => o.id === orderId && o.user_id === userId);
  }

  if (!order) throw new Error('Order not found.');

  if (order.proof_analysis_status !== 'verified') {
    throw new Error('You must provide and verify a legitimate payment screenshot before confirming.');
  }

  if (db.isConnectedToPostgres()) {
    await db.query(
      `UPDATE p2p_orders SET status = 'payment_sent', updated_at = NOW() WHERE id = $1`,
      [orderId]
    );

    await db.query(
      `INSERT INTO admin_notifications (title, message, type, reference_id)
       VALUES ($1, $2, 'p2p_payment_sent', $3)`,
      ['User Confirmed: I Sent Money', `Trader confirmed payment for P2P Order #${orderId}. Please verify receipt in your account.`, orderId]
    );
  } else {
    order.status = 'payment_sent';
  }

  return { success: true, status: 'payment_sent', message: 'Admin notified! Waiting for payment confirmation.' };
}

// Admin Confirms: "Payment Received, Processing Order"
async function adminConfirmPaymentReceived(orderId, adminId) {
  touchAdminPresence();

  if (db.isConnectedToPostgres()) {
    await db.query(
      `UPDATE p2p_orders SET status = 'payment_received', updated_at = NOW() WHERE id = $1`,
      [orderId]
    );
  } else {
    const o = db.memoryStore.p2p_orders.find(x => x.id === orderId);
    if (o) o.status = 'payment_received';
  }

  return { success: true, status: 'payment_received', message: 'Payment confirmed. Status changed to processing.' };
}

// Admin Confirms: "I Sent Crypto" -> Status becomes "Crypto Released"
async function adminConfirmCryptoSent(orderId, adminId, txHash, adminProofUrl) {
  touchAdminPresence();

  if (db.isConnectedToPostgres()) {
    await db.query(
      `UPDATE p2p_orders 
       SET status = 'crypto_released', tx_hash = $1, admin_proof_url = $2, updated_at = NOW() 
       WHERE id = $3`,
      [txHash || null, adminProofUrl || null, orderId]
    );
  } else {
    const o = db.memoryStore.p2p_orders.find(x => x.id === orderId);
    if (o) {
      o.status = 'crypto_released';
      o.tx_hash = txHash;
      o.admin_proof_url = adminProofUrl;
    }
  }

  return { success: true, status: 'crypto_released', message: 'Crypto release confirmed to trader.' };
}

// User Submits Dispute: "Not Received (Claim)"
async function submitDisputeClaim(orderId, userId, { disputeTxId, disputeHash, disputeReason }) {
  if (!disputeTxId || !disputeHash || !disputeReason) {
    throw new Error('Transaction ID, network hash, and claim explanation are required to file a dispute.');
  }

  if (db.isConnectedToPostgres()) {
    await db.query(
      `UPDATE p2p_orders 
       SET status = 'disputed', dispute_tx_id = $1, dispute_hash = $2, dispute_reason = $3, updated_at = NOW() 
       WHERE id = $4 AND user_id = $5`,
      [disputeTxId, disputeHash, disputeReason, orderId, userId]
    );

    // Urgent notification to admin
    await db.query(
      `INSERT INTO admin_notifications (title, message, type, reference_id)
       VALUES ($1, $2, 'dispute', $3)`,
      ['🚨 P2P Crypto Claim Dispute Filed', `Trader filed a dispute on Order #${orderId}. Reason: ${disputeReason}. Hash: ${disputeHash}`, orderId]
    );
  } else {
    const o = db.memoryStore.p2p_orders.find(x => x.id === orderId && x.user_id === userId);
    if (o) {
      o.status = 'disputed';
      o.dispute_tx_id = disputeTxId;
      o.dispute_hash = disputeHash;
      o.dispute_reason = disputeReason;
    }
  }

  return { success: true, status: 'disputed', message: 'Dispute submitted! Admin team has been urgently notified.' };
}

// User Initiates P2P Sell Order (Selling USDT to Admin)
async function createSellOrder(userId, { cryptoAmount, fiatCurrency, userPaymentDetails }) {
  const amount = parseFloat(cryptoAmount);
  if (!amount || amount <= 0) {
    throw new Error('Please enter a valid USDT amount to sell.');
  }

  if (!userPaymentDetails || userPaymentDetails.trim().length < 8) {
    throw new Error('Please provide your bank or mobile money receiving account details.');
  }

  const info = await getP2PInfo();
  const currency = (fiatCurrency || 'USD').toUpperCase();
  const pricePerUnit = currency === 'RWF' ? info.buyPriceRwf : info.buyPriceUsd;

  let fee = 0;
  if (info.feeConfig.type === 'flat') {
    fee = currency === 'RWF' ? info.feeConfig.amount * info.exchangeRateRwf : info.feeConfig.amount;
  } else {
    fee = (amount * pricePerUnit) * (info.feeConfig.amount / 100);
  }

  const totalFiat = Math.max(0, +(amount * pricePerUnit - fee).toFixed(2));

  let newOrder;
  if (db.isConnectedToPostgres()) {
    const res = await db.query(
      `INSERT INTO p2p_orders 
       (user_id, order_type, crypto_symbol, crypto_amount, price_per_unit, fee_amount, total_fiat, fiat_currency, admin_notes, status)
       VALUES ($1, 'sell', 'USDT', $2, $3, $4, $5, $6, $7, 'pending_crypto')
       RETURNING *`,
      [userId, amount, pricePerUnit, fee, totalFiat, currency, userPaymentDetails.trim()]
    );
    newOrder = res.rows[0];

    await db.query(
      `INSERT INTO admin_notifications (title, message, type, reference_id)
       VALUES ($1, $2, 'p2p_sell', $3)`,
      ['New P2P Sell Order Placed', `Trader wants to sell ${amount} USDT for ${totalFiat} ${currency}.`, newOrder.id]
    );
  } else {
    newOrder = {
      id: 'p2p-sell-' + Date.now(),
      user_id: userId,
      order_type: 'sell',
      crypto_symbol: 'USDT',
      crypto_amount: amount,
      price_per_unit: pricePerUnit,
      fee_amount: fee,
      total_fiat: totalFiat,
      fiat_currency: currency,
      admin_notes: userPaymentDetails.trim(),
      status: 'pending_crypto',
      created_at: new Date()
    };
    db.memoryStore.p2p_orders.unshift(newOrder);
  }

  return {
    order: newOrder,
    adminDepositWallet: info.adminWallets[0] || { address: 'TYDzsYUE286846286TT123498877TRC20ADMIN', network: 'TRC20' },
    totalFiat,
    currency
  };
}

module.exports = {
  getP2PInfo,
  createBuyOrder,
  uploadAndVerifyScreenshot,
  confirmUserSentPayment,
  adminConfirmPaymentReceived,
  adminConfirmCryptoSent,
  submitDisputeClaim,
  createSellOrder,
  touchAdminPresence,
  getAdminPresence
};
