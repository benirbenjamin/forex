// Flutterwave Payment Integration
// Production-Ready: Real API communication, strict verification, zero demo bypass
// Only verified payments grant subscription access; cancelled/failed payments are denied.

const db = require('./db');
const { activateSubscription } = require('./subscriptions');

async function getFlutterwaveCredentials() {
  let publicKey = process.env.FLUTTERWAVE_PUBLIC_KEY;
  let secretKey = process.env.FLUTTERWAVE_SECRET_KEY;
  let encryptionKey = process.env.FLUTTERWAVE_ENCRYPTION_KEY;
  let webhookHash = process.env.FLUTTERWAVE_WEBHOOK_HASH;

  // Check platform_settings for keys saved via Super Admin panel
  try {
    if (db.isConnectedToPostgres()) {
      const res = await db.query("SELECT value FROM platform_settings WHERE key = 'flutterwave_credentials' LIMIT 1");
      if (res.rowCount > 0 && res.rows[0].value) {
        const v = res.rows[0].value;
        if (v.public_key) publicKey = v.public_key;
        if (v.secret_key) secretKey = v.secret_key;
        if (v.encryption_key) encryptionKey = v.encryption_key;
        if (v.webhook_hash) webhookHash = v.webhook_hash;
      }
    }
  } catch (e) {}

  return { publicKey, secretKey, encryptionKey, webhookHash };
}

// Initialize payment session with Flutterwave
async function initializePayment({ userId, plan, amount, currency, email, phone, fullName, redirectUrl }) {
  const { publicKey, secretKey } = await getFlutterwaveCredentials();

  if (!secretKey) {
    throw new Error('Flutterwave secret key is not configured. Please contact Super Admin.');
  }

  const txRef = `FDS-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

  // Record pending payment in database
  let paymentId;
  if (db.isConnectedToPostgres()) {
    const payRes = await db.query(
      `INSERT INTO payments (user_id, flutterwave_tx_ref, amount, currency, status, payment_method)
       VALUES ($1, $2, $3, $4, 'pending', 'flutterwave')
       RETURNING id`,
      [userId, txRef, amount, currency]
    );
    paymentId = payRes.rows[0].id;
  } else {
    paymentId = 'pay-' + Date.now();
    db.memoryStore.payments.push({
      id: paymentId,
      user_id: userId,
      flutterwave_tx_ref: txRef,
      amount,
      currency,
      status: 'pending',
      payment_method: 'flutterwave',
      created_at: new Date()
    });
  }

  // Call Flutterwave Standard Payment API
  const payload = {
    tx_ref: txRef,
    amount: amount,
    currency: currency,
    redirect_url: redirectUrl || 'https://forexdoublesniper.com/billing?status=complete',
    payment_options: 'card,mobilemoneyrwanda,ussd,banktransfer,whatsapp',
    customer: {
      email: email,
      phonenumber: phone,
      name: fullName
    },
    customizations: {
      title: 'ForexDoubleSniper Subscription',
      description: `Access to live VIP trading signals (${plan.name})`,
      logo: 'https://forexdoublesniper.com/logo.svg'
    },
    meta: {
      userId,
      planId: plan.id,
      planName: plan.name,
      durationDays: plan.durationDays
    }
  };

  const response = await fetch('https://api.flutterwave.com/v3/payments', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${secretKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  const data = await response.json();

  if (data.status !== 'success' || !data.data || !data.data.link) {
    throw new Error(data.message || 'Failed to initialize payment gateway.');
  }

  return {
    paymentUrl: data.data.link,
    txRef,
    publicKey,
    instructions: {
      whatsappOtp: 'If paying via Mobile Money, Flutterwave will send a one-time OTP via WhatsApp / SMS.',
      mobilePopup: 'Confirm the debit prompt on your mobile handset immediately to finalize the transaction.'
    }
  };
}

// Verify payment transaction via Flutterwave API
async function verifyFlutterwavePayment(transactionId, txRef) {
  const { secretKey } = await getFlutterwaveCredentials();

  if (!secretKey) {
    throw new Error('Flutterwave secret key is missing.');
  }

  // Call official verification endpoint
  const verifyUrl = `https://api.flutterwave.com/v3/transactions/${transactionId}/verify`;
  const response = await fetch(verifyUrl, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${secretKey}`,
      'Content-Type': 'application/json'
    }
  });

  const result = await response.json();

  if (result.status !== 'success' || !result.data) {
    throw new Error('Transaction could not be verified by Flutterwave.');
  }

  const txData = result.data;
  const isSuccessful = txData.status === 'successful';

  if (!isSuccessful) {
    // Payment was cancelled, abandoned or failed
    if (db.isConnectedToPostgres()) {
      await db.query(
        `UPDATE payments SET status = 'cancelled', updated_at = NOW() WHERE flutterwave_tx_ref = $1`,
        [txRef || txData.tx_ref]
      );
    }
    return {
      success: false,
      accessGranted: false,
      status: txData.status,
      message: 'Payment was cancelled or failed. Access was not granted.'
    };
  }

  // Find payment record in database
  let payment;
  if (db.isConnectedToPostgres()) {
    const pRes = await db.query('SELECT * FROM payments WHERE flutterwave_tx_ref = $1 LIMIT 1', [txData.tx_ref]);
    payment = pRes.rows[0];
  } else {
    payment = db.memoryStore.payments.find(p => p.flutterwave_tx_ref === txData.tx_ref);
  }

  if (!payment) {
    throw new Error('Payment reference not found in records.');
  }

  // Prevent double-activation
  if (payment.status === 'successful') {
    return {
      success: true,
      accessGranted: true,
      message: 'Subscription is already active.'
    };
  }

  // Extract plan meta
  const meta = txData.meta || {};
  const durationDays = parseInt(meta.durationDays) || 30;
  const planName = meta.planName || 'VIP Signals Plan';

  // Activate subscription
  const sub = await activateSubscription(payment.user_id, {
    planId: meta.planId,
    planName,
    durationDays,
    amountPaid: txData.amount,
    currency: txData.currency,
    paymentMethod: 'flutterwave',
    txRef: txData.tx_ref
  });

  // Mark payment successful
  if (db.isConnectedToPostgres()) {
    await db.query(
      `UPDATE payments 
       SET status = 'successful', subscription_id = $1, flutterwave_id = $2, updated_at = NOW() 
       WHERE id = $3`,
      [sub.id, transactionId, payment.id]
    );
  } else {
    payment.status = 'successful';
    payment.subscription_id = sub.id;
    payment.flutterwave_id = transactionId;
  }

  return {
    success: true,
    accessGranted: true,
    subscription: sub,
    message: 'Payment confirmed! Signals subscription activated successfully.'
  };
}

module.exports = {
  initializePayment,
  verifyFlutterwavePayment,
  getFlutterwaveCredentials
};
