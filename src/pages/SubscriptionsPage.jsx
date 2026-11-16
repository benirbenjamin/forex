import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useMarket } from '../contexts/MarketContext';
import { useToast } from '../contexts/ToastContext';
import {
  Sparkles,
  CheckCircle,
  Zap,
  CreditCard,
  ShieldCheck,
  Clock,
  ArrowRight
} from 'lucide-react';

const FALLBACK_PLANS = [
  { id: 'p_1d', slug: '1-day-pass', name: '1 Day Pass (24 Hours)', days: 1, priceUsd: 5.0, priceRwf: 7250 },
  { id: 'p_1w', slug: '1-week-access', name: '1 Week Access', days: 7, priceUsd: 25.0, priceRwf: 36250 },
  { id: 'p_1m', slug: '1-month-standard', name: '1 Month Standard', days: 30, priceUsd: 70.0, priceRwf: 101500 },
  { id: 'p_3m', slug: '3-months-pro', name: '3 Months Pro', days: 90, priceUsd: 180.0, priceRwf: 261000 },
  { id: 'p_6m', slug: '6-months-elite', name: '6 Months Elite', days: 180, priceUsd: 320.0, priceRwf: 464000 },
  { id: 'p_1y', slug: '1-year-vip-institutional', name: '1 Year VIP Institutional', days: 365, priceUsd: 550.0, priceRwf: 797500 }
];

export default function SubscriptionsPage() {
  const { user, subscription, token, isAuthenticated, openAuth, refreshUser } = useAuth();
  const { activeCurrency, rates } = useMarket();
  const { showToast, celebrate } = useToast();

  const [plans, setPlans] = useState(FALLBACK_PLANS);
  const [selectedPlanId, setSelectedPlanId] = useState('p_1m');
  const [checkoutCurrency, setCheckoutCurrency] = useState('RWF');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [statusNotice, setStatusNotice] = useState(null);

  // Fetch real plans from database
  useEffect(() => {
    fetch('/api/subscription?action=plans')
      .then((r) => r.json())
      .then((d) => {
        if (d && Array.isArray(d.plans) && d.plans.length > 0) {
          setPlans(d.plans);
        }
      })
      .catch((e) => {
        console.warn('Could not fetch DB plans, using baseline plans:', e);
      });
  }, []);

  const selectedPlan = plans.find((p) => p.id === selectedPlanId || p.slug === selectedPlanId) || plans[2] || plans[0];

  // Calculate local payable price
  const rate = rates[checkoutCurrency] || (checkoutCurrency === 'RWF' ? 1450 : 1);
  const payableAmount = Math.round(Number(selectedPlan?.priceUsd || 70) * rate);

  const handleCheckout = async (e) => {
    e.preventDefault();
    if (!isAuthenticated) {
      openAuth('login');
      return;
    }

    setLoading(true);
    setStatusNotice(null);

    try {
      const res = await fetch('/api/subscription?action=checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          planId: selectedPlan.id || selectedPlan.slug,
          phone: phone.trim(),
          currency: checkoutCurrency,
          paymentMethod: 'flutterwave'
        })
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to initiate checkout');
      }

      setStatusNotice({
        type: 'success',
        text: data.message || `Payment request initialized for ${selectedPlan.name}. Please confirm mobile money prompt or card authorization.`
      });

      // TRIGGER REAL FLUTTERWAVE INLINE CHECKOUT IF SDK IS LOADED
      if (typeof window !== 'undefined' && window.FlutterwaveCheckout) {
        const txRef = 'fds_tx_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
        
        window.FlutterwaveCheckout({
          public_key: window.fds_flw_pub || 'FLWPUBK_TEST-e08920959fd4e5d4a1fb5f52479f64e2-X',
          tx_ref: txRef,
          amount: payableAmount,
          currency: checkoutCurrency,
          payment_options: 'card,mobilemoneyrwanda,mobilemoneykenya,ussd,banktransfer',
          customer: {
            email: user?.email || 'trader@domain.com',
            phone_number: phone || user?.phone || '',
            name: user?.name || user?.email || 'Institutional Trader'
          },
          customizations: {
            title: 'ForexDoubleSniper VIP Access',
            description: `${selectedPlan.name} (${selectedPlan.days} Days)`,
            logo: `${window.location.origin}/logo.svg`
          },
          callback: async (response) => {
            console.log('Flutterwave payment callback:', response);
            if (response.status === 'successful' || response.status === 'completed') {
              celebrate();
              showToast('Payment successful! VIP subscription activated.', 'success');
              try {
                await fetch('/api/subscription?action=activate', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                  },
                  body: JSON.stringify({
                    transaction_id: response.transaction_id,
                    tx_ref: response.tx_ref,
                    planId: selectedPlan.id,
                    email: user?.email
                  })
                });
                refreshUser();
              } catch (e) {
                console.error('Activation sync error:', e);
              }
            } else {
              showToast('Payment pending or not confirmed: ' + (response.status || 'Incomplete'), 'warning');
            }
          },
          onclose: () => {
            showToast('Flutterwave checkout window closed.', 'info');
          }
        });
      } else if (data.paymentUrl) {
        // Fallback popup if inline script is blocked
        window.open(data.paymentUrl, '_blank');
      }
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container">
      {/* Active VIP Status Banner */}
      {subscription?.hasAccess && (
        <div style={{
          background: 'rgba(212, 175, 55, 0.12)',
          border: '1px solid var(--gold)',
          borderRadius: 'var(--radius)',
          padding: '16px 20px',
          marginBottom: 24,
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 40,
              height: 40,
              borderRadius: '50%',
              background: 'var(--gold)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#0b0e14'
            }}>
              <Sparkles size={22} />
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--gold-bright)' }}>
                ⭐ Active VIP Membership: {subscription.planName || 'Institutional VIP'}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text)' }}>
                {subscription.status === 'admin'
                  ? 'Unlimited Lifetime Access (Superadmin Privileges)'
                  : `Full access active. Remaining time: ${subscription.remainingDays || 0} days (${subscription.remainingHours || 0} hours left)`}
              </div>
            </div>
          </div>

          <div style={{
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: 13,
            color: 'var(--gold-bright)',
            fontWeight: 700
          }}>
            Expires: {subscription.expiresAt ? new Date(subscription.expiresAt).toLocaleDateString() : 'Permanent'}
          </div>
        </div>
      )}

      {/* Hero Header */}
      <div style={{ textAlign: 'center', marginBottom: 28 }}>
        <h2 style={{ fontSize: 28, fontWeight: 800, color: '#fff', letterSpacing: -0.5 }}>
          Subscription Plans & VIP Access
        </h2>
        <p style={{ fontSize: 14, color: 'var(--mut)', maxWidth: 650, margin: '8px auto 0', lineHeight: 1.6 }}>
          Select an institutional tier to unlock continuous real-time signals for Gold (XAU/USD) and Bitcoin (BTC/USD).
          Direct instant activation via Flutterwave or manual confirmation.
        </p>
      </div>

      {/* Pricing Cards Horizontal Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
        gap: 14,
        marginBottom: 28
      }}>
        {plans.map((p) => {
          const isSelected = (p.id === selectedPlanId || p.slug === selectedPlanId);
          return (
            <div
              key={p.id || p.slug}
              onClick={() => setSelectedPlanId(p.id || p.slug)}
              style={{
                background: isSelected ? 'rgba(212, 175, 55, 0.08)' : 'var(--panel)',
                border: isSelected ? '2px solid var(--gold-bright)' : '1px solid var(--line)',
                borderRadius: 'var(--radius)',
                padding: '20px 14px',
                cursor: 'pointer',
                textAlign: 'center',
                transition: 'all 0.2s ease',
                transform: isSelected ? 'translateY(-2px)' : 'none',
                boxShadow: isSelected ? '0 8px 24px rgba(212, 175, 55, 0.25)' : 'none'
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 800, color: '#fff', marginBottom: 8 }}>
                {p.name}
              </div>
              <div style={{
                fontSize: 24,
                fontWeight: 800,
                color: isSelected ? 'var(--gold-bright)' : '#fff',
                fontFamily: 'JetBrains Mono, monospace'
              }}>
                ${Number(p.priceUsd).toFixed(2)}
              </div>
              <div style={{ fontSize: 11, color: 'var(--mut)', marginTop: 4 }}>
                {p.days} Days Full Access
              </div>
            </div>
          );
        })}
      </div>

      {/* Instant Checkout Box */}
      <div style={{
        background: 'var(--panel)',
        border: '1px solid var(--line)',
        borderRadius: 'var(--radius)',
        maxWidth: 620,
        margin: '0 auto',
        padding: 28
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <Zap size={22} style={{ color: 'var(--gold)' }} />
          <div>
            <h3 style={{ fontSize: 17, fontWeight: 800, color: '#fff' }}>
              Instant Checkout via Flutterwave
            </h3>
            <p style={{ fontSize: 12, color: 'var(--mut)' }}>
              Choose your payment currency and enter your mobile number. Supports MTN MoMo, Airtel, M-Pesa, Bank Cards.
            </p>
          </div>
        </div>

        {statusNotice && (
          <div style={{
            background: 'rgba(0, 208, 132, 0.12)',
            border: '1px solid var(--up)',
            borderRadius: 6,
            padding: 12,
            marginBottom: 16,
            fontSize: 13,
            color: 'var(--up)',
            display: 'flex',
            alignItems: 'center',
            gap: 8
          }}>
            <CheckCircle size={18} />
            <span>{statusNotice.text}</span>
          </div>
        )}

        <form onSubmit={handleCheckout}>
          <div className="form-group">
            <label className="form-label">Select Payment Currency</label>
            <select
              className="form-control"
              value={checkoutCurrency}
              onChange={(e) => setCheckoutCurrency(e.target.value)}
            >
              <option value="RWF">RWF - Rwandan Franc (FRw - MTN & Airtel MoMo)</option>
              <option value="KES">KES - Kenyan Shilling (KSh - M-Pesa, Airtel & Card)</option>
              <option value="USD">USD - US Dollar (International Debit / Credit Cards)</option>
              <option value="UGX">UGX - Ugandan Shilling (MTN & Airtel MoMo)</option>
              <option value="TZS">TZS - Tanzanian Shilling (Vodacom M-Pesa & Tigo)</option>
              <option value="NGN">NGN - Nigerian Naira (Bank Transfer & Card)</option>
              <option value="GHS">GHS - Ghanaian Cedi (MTN MoMo & Vodafone)</option>
              <option value="ZAR">ZAR - South African Rand (EFT & Card)</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Mobile Phone Number (or WhatsApp for Payment Alert)</label>
            <input
              type="tel"
              className="form-control"
              placeholder="+250 788 123 456"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
            />
          </div>

          <div style={{
            background: 'var(--panel-card)',
            padding: 14,
            borderRadius: 6,
            border: '1px solid var(--line-light)',
            marginBottom: 20
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
              <span style={{ color: 'var(--mut)' }}>Selected Plan:</span>
              <strong style={{ color: '#fff' }}>{selectedPlan?.name}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
              <span style={{ color: 'var(--mut)' }}>Total Payable Amount:</span>
              <strong style={{ color: 'var(--gold-bright)', fontSize: 16, fontFamily: 'JetBrains Mono, monospace' }}>
                {payableAmount.toLocaleString()} {checkoutCurrency} (${Number(selectedPlan?.priceUsd || 70).toFixed(2)} USD)
              </strong>
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading}
            style={{ width: '100%', padding: '14px', fontSize: 15, fontWeight: 800 }}
          >
            {loading ? 'Initializing Gateway...' : 'Unlock Plan with Flutterwave'}
          </button>
        </form>
      </div>
    </div>
  );
}
