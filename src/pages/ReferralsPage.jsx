import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import {
  Users,
  Copy,
  Check,
  DollarSign,
  Award,
  ArrowUpRight,
  ShieldCheck,
  CreditCard,
  Clock,
  RefreshCw
} from 'lucide-react';

export default function ReferralsPage() {
  const { user, token, isAuthenticated, openAuth } = useAuth();
  const { showToast, celebrate } = useToast();

  const [copied, setCopied] = useState(false);
  const [withdrawModalOpen, setWithdrawModalOpen] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('20');
  const [withdrawMethod, setWithdrawMethod] = useState('momo_rwanda');
  const [destAccount, setDestAccount] = useState('');
  const [withdrawals, setWithdrawals] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [loadingStats, setLoadingStats] = useState(true);

  // REAL DATA FROM DATABASE (NO DUMMY DATA!)
  const [stats, setStats] = useState({
    totalReferrals: 0,
    activeConversions: 0,
    totalEarned: 0.00,
    withdrawableBalance: 0.00
  });

  const refCode = user?.referralCode || (user?.email ? user.email.split('@')[0] : 'VIPTRADER');
  const referralUrl = typeof window !== 'undefined'
    ? `${window.location.origin}?ref=${encodeURIComponent(refCode)}`
    : `https://forex.benix.space?ref=${refCode}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(referralUrl);
    setCopied(true);
    showToast('Referral link copied to clipboard!', 'success');
    setTimeout(() => setCopied(false), 2500);
  };

  // Fetch real affiliate stats
  const fetchStats = async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/referrals?action=stats', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.stats) {
          setStats(data.stats);
        }
      }
    } catch (e) {
      console.warn('Could not load affiliate stats:', e);
    } finally {
      setLoadingStats(false);
    }
  };

  // Fetch real withdrawal history
  const fetchWithdrawals = async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/referrals/my-withdrawals', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setWithdrawals(data.withdrawals || []);
      }
    } catch (e) {
      console.warn('Could not load withdrawals:', e);
    }
  };

  useEffect(() => {
    fetchStats();
    fetchWithdrawals();
  }, [token]);

  const handleWithdrawSubmit = async (e) => {
    e.preventDefault();
    if (!token) {
      openAuth('login');
      return;
    }

    const amt = parseFloat(withdrawAmount);
    if (!amt || amt <= 0) {
      showToast('Please enter a valid withdrawal amount.', 'warning');
      return;
    }
    if (amt > stats.withdrawableBalance) {
      showToast(`Requested amount exceeds available balance ($${stats.withdrawableBalance.toFixed(2)}).`, 'error');
      return;
    }
    if (!destAccount || destAccount.trim().length < 5) {
      showToast('Please provide a valid account number or wallet address.', 'warning');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/referrals/withdraw', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          amount: amt,
          method: withdrawMethod,
          destinationAccount: destAccount.trim()
        })
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit withdrawal claim');
      }

      celebrate();
      showToast(data.message || 'Withdrawal request submitted successfully!', 'success');
      setWithdrawModalOpen(false);
      setDestAccount('');
      fetchStats();
      fetchWithdrawals();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="container" style={{ textAlign: 'center', padding: '60px 16px' }}>
        <div style={{
          width: 54,
          height: 54,
          borderRadius: '50%',
          background: 'rgba(212,175,55,0.15)',
          border: '1px solid var(--gold)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--gold-bright)',
          marginBottom: 16
        }}>
          <Users size={28} />
        </div>
        <h2 style={{ fontSize: 24, fontWeight: 800, color: '#fff' }}>
          Affiliate & Partner Program
        </h2>
        <p style={{ fontSize: 14, color: 'var(--mut)', maxWidth: 500, margin: '8px auto 24px', lineHeight: 1.6 }}>
          Earn recurring commissions on every VIP subscription renewal. Instant payouts to Mobile Money or USDT.
        </p>
        <button
          onClick={() => openAuth('register')}
          className="btn btn-primary"
          style={{ padding: '12px 24px', fontSize: 14 }}
        >
          Join Affiliate Program (Sign In / Register)
        </button>
      </div>
    );
  }

  return (
    <div className="container">
      {/* Header */}
      <div style={{
        background: 'var(--panel)',
        border: '1px solid var(--line)',
        borderRadius: 'var(--radius)',
        padding: '20px 24px',
        marginBottom: 20
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Users size={22} style={{ color: 'var(--gold)' }} />
              <h2 style={{ fontSize: 20, fontWeight: 800, color: '#fff' }}>
                Affiliate & Partner Console
              </h2>
            </div>
            <p style={{ fontSize: 13, color: 'var(--mut)', marginTop: 4 }}>
              Share your institutional link and earn recurring commissions on every subscription renewal. Real live metrics from database.
            </p>
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={() => { fetchStats(); fetchWithdrawals(); }}
              className="btn btn-outline"
              style={{ padding: '10px' }}
              title="Refresh Stats"
            >
              <RefreshCw size={15} />
            </button>
            <button
              onClick={() => setWithdrawModalOpen(true)}
              className="btn btn-primary"
              style={{ padding: '10px 18px' }}
              disabled={stats.withdrawableBalance <= 0}
            >
              <DollarSign size={16} />
              <span>Request Commission Payout</span>
            </button>
          </div>
        </div>

        {/* REAL METRICS (NO DUMMY DATA!) */}
        <div className="grid-4" style={{ marginTop: 20 }}>
          <div className="panel-card">
            <div style={{ fontSize: 11, color: 'var(--mut)', fontWeight: 700 }}>TOTAL REFERRALS</div>
            <div style={{ fontSize: 22, fontWeight: 800, fontFamily: 'JetBrains Mono, monospace', color: '#fff', marginTop: 4 }}>
              {stats.totalReferrals} {stats.totalReferrals === 1 ? 'Trader' : 'Traders'}
            </div>
          </div>

          <div className="panel-card">
            <div style={{ fontSize: 11, color: 'var(--mut)', fontWeight: 700 }}>ACTIVE VIP CONVERSIONS</div>
            <div style={{ fontSize: 22, fontWeight: 800, fontFamily: 'JetBrains Mono, monospace', color: 'var(--up)', marginTop: 4 }}>
              {stats.activeConversions} Active
            </div>
          </div>

          <div className="panel-card">
            <div style={{ fontSize: 11, color: 'var(--mut)', fontWeight: 700 }}>TOTAL EARNED</div>
            <div style={{ fontSize: 22, fontWeight: 800, fontFamily: 'JetBrains Mono, monospace', color: 'var(--gold-bright)', marginTop: 4 }}>
              ${stats.totalEarned.toFixed(2)}
            </div>
          </div>

          <div className="panel-card">
            <div style={{ fontSize: 11, color: 'var(--mut)', fontWeight: 700 }}>WITHDRAWABLE BALANCE</div>
            <div style={{ fontSize: 22, fontWeight: 800, fontFamily: 'JetBrains Mono, monospace', color: '#fff', marginTop: 4 }}>
              ${stats.withdrawableBalance.toFixed(2)}
            </div>
          </div>
        </div>
      </div>

      {/* Referral Link Card */}
      <div style={{
        background: 'var(--panel)',
        border: '1px solid var(--line)',
        borderRadius: 'var(--radius)',
        padding: 24,
        marginBottom: 24
      }}>
        <h3 style={{ fontSize: 16, fontWeight: 800, color: '#fff', marginBottom: 12 }}>
          Your Exclusive Affiliate Referral Link
        </h3>
        <p style={{ fontSize: 13, color: 'var(--mut)', marginBottom: 16 }}>
          Give your traders 7 Days Free VIP Access when they sign up with this link. All subsequent subscription renewals automatically credit your commission account.
        </p>

        <div style={{
          display: 'flex',
          gap: 10,
          background: 'var(--panel-card)',
          padding: 8,
          borderRadius: 6,
          border: '1px solid var(--line-light)',
          alignItems: 'center',
          flexWrap: 'wrap'
        }}>
          <input
            type="text"
            readOnly
            value={referralUrl}
            style={{
              flex: 1,
              minWidth: 220,
              background: 'transparent',
              border: 'none',
              color: 'var(--gold-bright)',
              fontSize: 14,
              fontFamily: 'JetBrains Mono, monospace',
              padding: '6px 10px',
              outline: 'none'
            }}
          />
          <button
            onClick={handleCopyLink}
            className="btn btn-primary"
            style={{ padding: '8px 16px' }}
          >
            {copied ? <Check size={16} /> : <Copy size={16} />}
            <span>{copied ? 'Copied!' : 'Copy Link'}</span>
          </button>
        </div>
      </div>

      {/* Payout History Table */}
      <div style={{
        background: 'var(--panel)',
        border: '1px solid var(--line)',
        borderRadius: 'var(--radius)',
        padding: 24
      }}>
        <h3 style={{ fontSize: 16, fontWeight: 800, color: '#fff', marginBottom: 16 }}>
          Commission Withdrawal Requests ({withdrawals.length})
        </h3>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Request ID</th>
                <th>Requested Amount</th>
                <th>Net Payout (2% Fee)</th>
                <th>Method</th>
                <th>Destination</th>
                <th>Status</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {withdrawals.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', color: 'var(--mut)', padding: 24 }}>
                    No withdrawal requests submitted yet.
                  </td>
                </tr>
              ) : (
                withdrawals.map((w) => (
                  <tr key={w.id}>
                    <td style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12 }}>{w.id}</td>
                    <td style={{ fontWeight: 800, color: '#fff' }}>${(w.amount || w.amount_requested)?.toFixed(2)}</td>
                    <td style={{ fontWeight: 800, color: 'var(--gold-bright)' }}>${(w.net_amount || (w.amount * 0.98))?.toFixed(2)}</td>
                    <td style={{ textTransform: 'capitalize' }}>{(w.method || 'momo')?.replace('_', ' ')}</td>
                    <td style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12 }}>{w.destination_account || w.payment_details}</td>
                    <td>
                      <span className={w.status === 'confirmed_paid' || w.status === 'approved' ? 'badge-up' : 'badge-gold'}>
                        {w.status?.replace('_', ' ')}
                      </span>
                    </td>
                    <td style={{ color: 'var(--mut)', fontSize: 12 }}>
                      {new Date(w.created_at || Date.now()).toLocaleDateString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Commission Withdrawal Modal */}
      {withdrawModalOpen && (
        <div className="modal-overlay" onClick={() => setWithdrawModalOpen(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ fontSize: 18, fontWeight: 800, color: '#fff', marginBottom: 12 }}>
              Request Commission Withdrawal
            </h3>
            <p style={{ fontSize: 13, color: 'var(--mut)', marginBottom: 16 }}>
              Available Withdrawable Balance: <strong>${stats.withdrawableBalance.toFixed(2)} USD</strong>.
              Withdraw directly to Mobile Money or USDT TRC20.
            </p>

            <form onSubmit={handleWithdrawSubmit}>
              <div className="form-group">
                <label className="form-label">Payment Channel</label>
                <select
                  className="form-control"
                  value={withdrawMethod}
                  onChange={(e) => setWithdrawMethod(e.target.value)}
                >
                  <option value="momo_rwanda">MTN Rwanda Mobile Money (FRw)</option>
                  <option value="airtel_rwanda">Airtel Rwanda Money (FRw)</option>
                  <option value="mpesa_kenya">Safaricom M-Pesa Kenya (KSh)</option>
                  <option value="usdt_trc20">USDT (TRC20 Wallet Address)</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Withdrawal Amount ($ USD)</label>
                <input
                  type="number"
                  min="5"
                  max={stats.withdrawableBalance}
                  step="0.01"
                  className="form-control"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Receiving Account Number / Wallet Address</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. 0788123456 or TRC20 address"
                  value={destAccount}
                  onChange={(e) => setDestAccount(e.target.value)}
                  required
                />
              </div>

              <div style={{
                background: 'var(--panel-card)',
                padding: 12,
                borderRadius: 6,
                border: '1px solid var(--line-light)',
                fontSize: 12,
                marginBottom: 20
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ color: 'var(--mut)' }}>Platform Fee (2%):</span>
                  <span>${(parseFloat(withdrawAmount || 0) * 0.02).toFixed(2)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800 }}>
                  <span style={{ color: '#fff' }}>Net Payout Received:</span>
                  <span style={{ color: 'var(--gold-bright)', fontSize: 14, fontFamily: 'JetBrains Mono, monospace' }}>
                    ${(parseFloat(withdrawAmount || 0) * 0.98).toFixed(2)} USD
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={submitting}
                  style={{ flex: 1, padding: '12px' }}
                >
                  {submitting ? 'Submitting...' : 'Confirm Withdrawal Request'}
                </button>
                <button
                  type="button"
                  onClick={() => setWithdrawModalOpen(false)}
                  className="btn btn-outline"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
