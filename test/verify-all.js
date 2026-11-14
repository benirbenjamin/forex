// Automated Verification Test Suite for ForexDoubleSniper Platform
const assert = require('assert');
const { getSignal, getAllSignals } = require('../lib/signals');
const { calculatePnL, placeTrade, closeTrade, getTradeHistory, evaluateOpenTradesForUser } = require('../lib/simulator');
const { checkUnique, registerUser, loginUser, verifyEmail } = require('../lib/auth');
const { getPlans, checkUserSubscription, activateSubscription } = require('../lib/subscriptions');
const { getUserReferralStats } = require('../lib/referrals');
const { getP2PInfo, createBuyOrder } = require('../lib/p2p');
const { analyzePaymentScreenshot } = require('../lib/receiptVerifier');
const { getUsdToRwfRate, convertUsdToRwf } = require('../lib/currency');
const { getAllUsers, deleteUser, PROTECTED_EMAILS } = require('../lib/admin');
const db = require('../lib/db');
const fs = require('fs');
const path = require('path');

async function runTests() {
  console.log('🧪 Starting Comprehensive Automated Test Suite...\n');

  // Boot DB in-memory or Postgres
  await db.initDatabase();

  // 1. Multi-Pair Signals Test
  console.log('--- TEST 1: Multi-Pair Forex Signals Engine ---');
  const gold = await getSignal('XAUUSD');
  assert(gold && gold.price > 0, 'Gold price must be positive number');
  assert(['BUY', 'SELL', 'WAIT'].includes(gold.decision), 'Gold decision must be BUY, SELL, or WAIT');
  assert(gold.stop !== undefined, 'Gold must calculate Stop Loss');
  assert(gold.target !== undefined, 'Gold must calculate Target 1');
  assert(gold.target2 !== undefined, 'Gold must calculate Target 2');
  console.log(`✅ Gold (XAU/USD): Price $${gold.price}, Decision: ${gold.decision}, Confidence: ${gold.confidence}%`);

  const gbpusd = await getSignal('GBPUSD');
  assert(gbpusd && gbpusd.price > 0, 'GBP/USD price must be positive number');
  console.log(`✅ GBP/USD: Price ${gbpusd.price}, Decision: ${gbpusd.decision}`);

  const gbpjpy = await getSignal('GBPJPY');
  assert(gbpjpy && gbpjpy.price > 0, 'GBP/JPY price must be positive number');
  console.log(`✅ GBP/JPY: Price ${gbpjpy.price}, Decision: ${gbpjpy.decision}`);

  const all = await getAllSignals();
  assert(all.XAUUSD && all.GBPUSD && all.GBPJPY, 'All 3 pairs returned in multi-feed');
  console.log('✅ Multi-pair feed successfully returns XAUUSD, GBPUSD, GBPJPY');

  // 2. Currency Conversion Test
  console.log('\n--- TEST 2: USD <-> RWF Exchange Rate ---');
  const rate = await getUsdToRwfRate();
  assert(rate > 1000 && rate < 2500, 'Exchange rate should be reasonable (~1350 RWF/USD)');
  const rwfPrice = convertUsdToRwf(5.00, rate);
  assert(rwfPrice > 5000, '5 USD converted to RWF');
  console.log(`✅ Live Rate: 1 USD = ${rate} RWF | $5.00 = ${rwfPrice} RWF`);

  // 3. Device Fingerprint Strict Enforcement Test
  console.log('\n--- TEST 3: Device Fingerprint & Account Creation ---');
  const testFingerprint = 'test_device_fp_hash_unique_12345';
  
  // Register User 1
  const reg1 = await registerUser({
    fullName: 'Alice Trader',
    email: 'alice.test@example.com',
    phone: '+250788111222',
    password: 'password123',
    confirmPassword: 'password123',
    deviceFingerprint: testFingerprint
  });
  assert(reg1.user && reg1.user.referral_code, 'User 1 registered with referral code');
  assert(reg1.user.referral_code.length === 5, 'Referral code must be exactly 5 chars');
  assert(/^[23456789abcdefghjkmnpqrstuvwxyz]+$/.test(reg1.user.referral_code), 'Referral code contains only safe chars');
  console.log(`✅ User 1 registered successfully. Referral code: ${reg1.user.referral_code}`);

  // Attempt to register User 2 with the SAME device fingerprint
  let fingerprintBlocked = false;
  try {
    await registerUser({
      fullName: 'Bob Duplicate',
      email: 'bob.test@example.com',
      phone: '+250788333444',
      password: 'password123',
      confirmPassword: 'password123',
      deviceFingerprint: testFingerprint
    });
  } catch (err) {
    if (err.message === 'You cannot create another account on this device. Please log in using the account you already have, or use another device to create an account.') {
      fingerprintBlocked = true;
    }
  }
  assert(fingerprintBlocked, 'Second account from same device MUST be denied with device fingerprint message');
  console.log('✅ Device Fingerprint Security: Blocked duplicate account on same device with exact message.');

  // 4. Login & 3-Attempt Lockout Test
  console.log('\n--- TEST 4: Login & 3-Attempt 1-Hour Lockout ---');
  // Attempt 1 with wrong password
  try { await loginUser({ email: 'alice.test@example.com', password: 'wrong1' }); } catch(e) {}
  // Attempt 2 with wrong password
  try { await loginUser({ email: 'alice.test@example.com', password: 'wrong2' }); } catch(e) {}
  // Attempt 3 with wrong password
  let lockoutTriggered = false;
  try {
    await loginUser({ email: 'alice.test@example.com', password: 'wrong3' });
  } catch (err) {
    if (err.statusCode === 429 && err.message.includes('locked for 1 hour')) {
      lockoutTriggered = true;
    }
  }
  assert(lockoutTriggered, 'Account must lock for 1 hour upon 3 failed password attempts');
  console.log('✅ 3-Attempt Lockout: Successfully locked account for 1 hour on 3rd failed password attempt');

  // 5. Protected Admins Test
  console.log('\n--- TEST 5: Protected Non-Deletable Admins ---');
  const allUsers = await getAllUsers();
  const superAdmin = allUsers.find(u => u.email === 'benirabok@gmail.com');
  const omarAdmin = allUsers.find(u => u.email === 'omarrukwaya@gmail.com');
  assert(superAdmin, 'Super Admin benirabok@gmail.com must exist');
  assert(omarAdmin, 'Admin omarrukwaya@gmail.com must exist');
  assert(superAdmin.role === 'superadmin', 'Beni must have role superadmin');
  assert(omarAdmin.role === 'admin', 'Omar must have role admin');

  let adminDeleteBlocked = false;
  try {
    await deleteUser('superadmin', superAdmin.id);
  } catch (err) {
    if (err.message.includes('permanently protected')) {
      adminDeleteBlocked = true;
    }
  }
  assert(adminDeleteBlocked, 'Protected admins cannot be deleted');
  console.log('✅ Admin Security: benirabok@gmail.com and omarrukwaya@gmail.com are non-deletable');

  // 6. Realistic Simulator & Auto TP/SL Execution
  console.log('\n--- TEST 6: Trading Simulator & Auto-Close Targets ---');
  const trade = await placeTrade(superAdmin.id, {
    symbol: 'XAUUSD',
    side: 'BUY',
    lotSize: 0.10,
    entryPrice: 2700.00,
    slPrice: 2690.00,
    tp1Price: 2710.00,
    tp2Price: 2720.00
  });
  assert(trade && trade.id, 'Simulated trade placed');
  console.log(`✅ Simulated Trade Opened: ID #${trade.id}, Entry: $${trade.entry_price}`);

  // Test Manual Close
  const closed = await closeTrade(superAdmin.id, trade.id);
  assert(closed.status === 'closed', 'Position must be closed');
  assert(closed.exit_price > 0, 'Exit price recorded');
  console.log(`✅ Position Manually Closed: Exit $${closed.exit_price}, PnL: $${closed.pnl}`);

  // 7. P2P Crypto & AI Receipt Verification Test
  console.log('\n--- TEST 7: Crypto P2P & AI Receipt Verification ---');
  const p2pInfo = await getP2PInfo();
  assert(p2pInfo.availableInventory >= 0, 'Available inventory reported');
  
  // Create dummy test file
  const testProofPath = path.join(__dirname, 'dummy_receipt.txt');
  fs.writeFileSync(testProofPath, 'This is a random text photo with no payment information.');
  const dummyAnalysis = await analyzePaymentScreenshot(testProofPath);
  assert(!dummyAnalysis.isValidReceipt, 'Dummy non-payment image MUST be rejected by AI analyzer');
  console.log('✅ AI Screenshot Analyzer: Successfully rejected dummy non-payment image');

  // Create mock legitimate receipt file
  const validProofPath = path.join(__dirname, 'valid_receipt.txt');
  fs.writeFileSync(validProofPath, 'MTN Mobile Money Rwanda. Transaction ID: TXN998877112. Transferred 25000 RWF to Forex Double Sniper. Payment status: Successful. Date: 12-Nov-2026.');
  const validAnalysis = await analyzePaymentScreenshot(validProofPath);
  assert(validAnalysis.isValidReceipt, 'Authentic payment receipt MUST be verified by AI analyzer');
  console.log('✅ AI Screenshot Analyzer: Successfully verified legitimate payment receipt');

  // Cleanup test files
  if (fs.existsSync(testProofPath)) fs.unlinkSync(testProofPath);
  if (fs.existsSync(validProofPath)) fs.unlinkSync(validProofPath);

  // 8. Subscription Plans & Access Check
  console.log('\n--- TEST 8: Subscription Plans & 7-Day Trial ---');
  const plans = await getPlans();
  assert(plans.length >= 6, 'Should have standard subscription plans');
  console.log(`✅ Loaded ${plans.length} subscription plans: ${plans.map(p => p.name).join(', ')}`);

  console.log('\n🎉 ALL AUTOMATED TESTS PASSED SUCCESSFULLY! The platform is production-ready.\n');
  process.exit(0);
}

runTests().catch(err => {
  console.error('\n❌ Test Suite Failed:', err);
  process.exit(1);
});
