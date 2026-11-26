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
  ArrowRight,
  Sliders,
  Calendar
} from 'lucide-react';

const DEFAULT_VIP_PLANS = [
  { id: '1', slug: '1-day', name: '1 Day Pass (24 Hours)', days: 1, priceUsd: 1.0, priceRwf: 1450 },
  { id: '2', slug: '1-week', name: '1 Week Access', days: 7, priceUsd: 5.0, priceRwf: 7250 },
  { id: '3', slug: '1-month', name: '1 Month Standard', days: 30, priceUsd: 20.0, priceRwf: 29000 },
  { id: '4', slug: '3-months', name: '3 Months Pro', days: 90, priceUsd: 50.0, priceRwf: 72500 },
  { id: '5', slug: '6-months', name: '6 Months Elite', days: 180, priceUsd: 90.0, priceRwf: 130500 },
  { id: '6', slug: '1-year', name: '1 Year VIP Institutional', days: 365, priceUsd: 150.0, priceRwf: 217500 }
];

export default function SubscriptionsPage() {
  const { user, subscription, token, isAuthenticated, openAuth, refreshUser } = useAuth();
  const { rates } = useMarket();
  const { showToast, celebrate } = useToast();

  const [plans, setPlans] = useState(DEFAULT_VIP_PLANS);
  const [selectedPlanId, setSelectedPlanId] = useState('3');
  const [checkoutCurrency, setCheckoutCurrency] = useState('RWF');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [statusNotice, setStatusNotice] = useState(null);

  // Custom duration state
  const [isCustomMode, setIsCustomMode] = useState(false);
  const [customDays, setCustomDays] = useState(30);
  const [umvaCharge, setUmvaCharge] = useState(null);
  const [cryptoCoin, setCryptoCoin] = useState('USDT.TRC20');

  // Fetch real plans from database
  useEffect(() => {
    fetch('/api/subscription?action=plans')
      .then((r) => r.json())
      .then((d) => {
        if (d && Array.isArray(d.plans) && d.plans.length > 0) {
          // Normalize priceUsd and priceRwf
          const mapped = d.plans.map(p => ({
            id: p.id || p.slug,
            slug: p.slug || p.id,
            name: p.name,
            days: p.duration_days || p.days || 30,
            priceUsd: Number(p.price_usd || p.priceUsd || 20),
            priceRwf: Number(p.price_rwf || p.priceRwf || 29000)
          }));
          setPlans(mapped);
        }
      })
      .catch((e) => {
        console.warn('Could not fetch DB plans, using default calibrated plans:', e);
      });
  }, []);

  const standardPlan = plans.find((p) => p.id === selectedPlanId || p.slug === selectedPlanId) || plans[2] || plans[0];

  // Calculate pricing
  const rate = rates[checkoutCurrency] || (checkoutCurrency === 'RWF' ? 1450 : 1);

  // Custom duration calculation based on $20.00 / month ($0.67 / day)
  const calculatedCustomUsd = Math.max(1.0, +(customDays * (20 / 30)).toFixed(2));
  const activePlanPriceUsd = isCustomMode ? calculatedCustomUsd : standardPlan.priceUsd;
  const activePlanName = isCustomMode ? `Custom ${customDays} Days Pass` : standardPlan.name;
  const activePlanDays = isCustomMode ? customDays : standardPlan.days;
  const payableAmount = Math.round(activePlanPriceUsd * rate);

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
          planId: isCustomMode ? `custom_${customDays}d` : (standardPlan.id || standardPlan.slug),
          customDays: isCustomMode ? customDays : undefined,
          cryptoCoin
        })
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to create crypto charge');
      }

      setUmvaCharge(data);
      setStatusNotice({
        type: 'success',
        text: data.message || 'Crypto charge created. Send the exact amount to the address shown below.'
      });
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  // After a UMVA charge is created, poll status. UMVA's IPN activates the
  // subscription on-chain, so we just watch for hasAccess becoming true.
  useEffect(() => {
    if (!umvaCharge || !token) return;
    let cancelled = false;
    const poll = async () => {
      try {
        const r = await fetch('/api/subscription?action=status', {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!r.ok) return;
        const s = await r.json();
        if (!cancelled && s && s.hasAccess) {
          celebrate();
          showToast('Payment confirmed! VIP access activated.', 'success');
          setUmvaCharge(null);
          setStatusNotice({ type: 'success', text: 'Payment confirmed. Your VIP access is now active!' });
          refreshUser();
        }
      } catch (e) {}
    };
    const id = setInterval(poll, 5000);
    poll();
    return () => { cancelled = true; clearInterval(id); };
  }, [umvaCharge, token, celebrate, showToast, refreshUser]);

  return (
    <div className="container">
      {/* Active VIP Status Banner (Real from DB) */}
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
          Select an institutional tier or choose custom days. Base monthly tier is just <strong>$20.00 USD</strong>.
          Instant activation via UMVA Pay — pay with USDT, BTC, ETH, or 50+ cryptocurrencies.
        </p>
      </div>

      {/* Pricing Cards Horizontal Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
        gap: 14,
        marginBottom: 24
      }}>
        {plans.map((p) => {
          const isSelected = !isCustomMode && (p.id === selectedPlanId || p.slug === selectedPlanId);
          return (
            <div
              key={p.id || p.slug}
              onClick={() => {
                setIsCustomMode(false);
                setSelectedPlanId(p.id || p.slug);
              }}
              style={{
                background: isSelected ? 'rgba(212, 175, 55, 0.08)' : 'var(--panel)',
                border: isSelected ? '2px solid var(--gold-bright)' : '1px solid var(--line)',
                borderRadius: 'var(--radius)',
                padding: '18px 12px',
                cursor: 'pointer',
                textAlign: 'center',
                transition: 'all 0.2s ease',
                transform: isSelected ? 'translateY(-2px)' : 'none',
                boxShadow: isSelected ? '0 8px 24px rgba(212, 175, 55, 0.25)' : 'none'
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 800, color: '#fff', marginBottom: 6 }}>
                {p.name}
              </div>
              <div style={{
                fontSize: 22,
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

      {/* Custom Duration Selector */}
      <div style={{
        background: isCustomMode ? 'rgba(212, 175, 55, 0.08)' : 'var(--panel)',
        border: isCustomMode ? '2px solid var(--gold-bright)' : '1px solid var(--line)',
        borderRadius: 'var(--radius)',
        maxWidth: 620,
        margin: '0 auto 24px',
        padding: '18px 22px',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 38,
            height: 38,
            borderRadius: 8,
            background: 'rgba(212, 175, 55, 0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--gold-bright)'
          }}>
            <Sliders size={20} />
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 800, color: '#fff' }}>
              Custom Duration (Choose Your Own Days or Months)
            </div>
            <div style={{ fontSize: 12, color: 'var(--mut)' }}>
              Pro-rated fairly at $0.67/day ($20/month baseline).
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <input
            type="number"
            min="1"
            max="730"
            value={customDays}
            onChange={(e) => {
              setIsCustomMode(true);
              setCustomDays(Math.max(1, parseInt(e.target.value) || 1));
            }}
            onClick={() => setIsCustomMode(true)}
            style={{
              width: 80,
              padding: '8px 10px',
              background: 'var(--panel-card)',
              border: '1px solid var(--gold)',
              borderRadius: 4,
              color: 'var(--gold-bright)',
              fontWeight: 800,
              fontSize: 14,
              textAlign: 'center'
            }}
          />
          <span style={{ fontSize: 12, color: 'var(--mut)' }}>Days</span>
          <button
            onClick={() => setIsCustomMode(true)}
            className={isCustomMode ? 'btn btn-primary' : 'btn btn-outline'}
            style={{ padding: '6px 14px', fontSize: 12 }}
          >
            {isCustomMode ? 'Selected' : 'Select'}
          </button>
        </div>
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
              Instant Checkout via UMVA Pay (Crypto)
            </h3>
            <p style={{ fontSize: 12, color: 'var(--mut)' }}>
              Pay with USDT, BTC, ETH or 50+ cryptocurrencies. On-chain confirmation is instant.
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
            <label className="form-label">Pay with Cryptocurrency</label>
            <select
              className="form-control"
              value={cryptoCoin}
              onChange={(e) => setCryptoCoin(e.target.value)}
            >
              <option value="USDT.TRC20">USDT - TRC20 (Tron) — lowest fees</option>
              <option value="USDT.ERC20">USDT - ERC20 (Ethereum)</option>
              <option value="USDT.BEP20">USDT - BEP20 (BNB Chain)</option>
              <option value="BTC">BTC - Bitcoin</option>
              <option value="ETH">ETH - Ethereum</option>
              <option value="LTC">LTC - Litecoin</option>
            </select>
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
              <strong style={{ color: '#fff' }}>{activePlanName} ({activePlanDays} Days)</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
              <span style={{ color: 'var(--mut)' }}>Total Payable Amount:</span>
              <strong style={{ color: 'var(--gold-bright)', fontSize: 16, fontFamily: 'JetBrains Mono, monospace' }}>
                ${activePlanPriceUsd.toFixed(2)} USD
              </strong>
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading}
            style={{ width: '100%', padding: '14px', fontSize: 15, fontWeight: 800 }}
          >
            {loading ? 'Creating crypto charge...' : 'Pay with Crypto (UMVA Pay)'}
          </button>
        </form>

        {umvaCharge && (
          <div style={{ marginTop: 20, padding: 18, background: 'var(--panel-card)', border: '1px solid var(--gold)', borderRadius: 8 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--gold-bright)', marginBottom: 10, textTransform: 'uppercase' }}>
              Send Payment — {umvaCharge.plan?.name || 'VIP Plan'}
            </div>
            <div style={{ fontSize: 12, color: 'var(--mut)' }}>Amount to send</div>
            <div style={{ fontSize: 22, fontWeight: 800, fontFamily: 'JetBrains Mono, monospace', color: '#fff', marginBottom: 10 }}>
              {umvaCharge.cryptoAmount} {umvaCharge.cryptoCoin}
            </div>
            <div style={{ fontSize: 12, color: 'var(--mut)' }}>Wallet address ({umvaCharge.network || 'crypto'})</div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4, marginBottom: 12 }}>
              <code style={{ flex: 1, fontSize: 12, color: '#fff', wordBreak: 'break-all', background: 'var(--panel)', padding: '8px 10px', borderRadius: 4, border: '1px solid var(--line)' }}>
                {umvaCharge.walletAddress}
              </code>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => {
                  if (navigator.clipboard && umvaCharge.walletAddress) {
                    navigator.clipboard.writeText(umvaCharge.walletAddress);
                    showToast('Wallet address copied.', 'success');
                  }
                }}
              >
                Copy
              </button>
            </div>
            <div style={{ fontSize: 12, color: 'var(--amber)' }}>
              ⏳ Waiting for on-chain confirmation via UMVA Pay. This page updates automatically once payment is detected.
            </div>
            <button
              type="button"
              className="btn btn-outline"
              style={{ marginTop: 12, width: '100%' }}
              onClick={() => { setUmvaCharge(null); setStatusNotice(null); }}
            >
              Start Over
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
