import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import {
  ShieldAlert,
  Users,
  Layers,
  Settings,
  DollarSign,
  MessageSquare,
  Sparkles,
  BarChart3,
  CheckCircle,
  XCircle,
  Eye,
  Key,
  Database,
  Save,
  Trash2,
  RefreshCw,
  Send
} from 'lucide-react';

export default function AdminDashboard() {
  const { user, token, isAdmin, openAuth } = useAuth();
  const { showToast, celebrate } = useToast();

  // Active tab with persistence in localStorage and URL hash
  const [activeTab, setActiveTab] = useState(() => {
    const hash = window.location.hash.replace('#', '');
    return hash || localStorage.getItem('fds_admin_tab') || 'overview';
  });

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    localStorage.setItem('fds_admin_tab', tab);
    window.location.hash = tab;
  };

  // State data
  const [users, setUsers] = useState([]);
  const [p2pOrders, setP2pOrders] = useState([]);
  const [plans, setPlans] = useState([]);
  const [withdrawals, setWithdrawals] = useState([]);
  const [threads, setThreads] = useState([]);
  const [selectedThread, setSelectedThread] = useState(null);
  const [threadMessages, setThreadMessages] = useState([]);
  const [adminReplyText, setAdminReplyText] = useState('');

  // Proof Modal
  const [viewProofUrl, setViewProofUrl] = useState(null);

  // Platform Settings State
  const [flutterwavePublic, setFlutterwavePublic] = useState('');
  const [flutterwaveSecret, setFlutterwaveSecret] = useState('');
  const [flutterwaveEncryption, setFlutterwaveEncryption] = useState('');
  const [flutterwaveWebhook, setFlutterwaveWebhook] = useState('');
  const [gdriveClientId, setGdriveClientId] = useState('');
  const [gdriveClientSecret, setGdriveClientSecret] = useState('');
  const [gdriveRefreshToken, setGdriveRefreshToken] = useState('');
  const [savingSettings, setSavingSettings] = useState(false);

  // USDT Inventory Form
  const [inventoryStock, setInventoryStock] = useState('1000.00');
  const [buyPriceUsd, setBuyPriceUsd] = useState('1.02');
  const [sellPriceUsd, setSellPriceUsd] = useState('1.00');
  const [rwfRate, setRwfRate] = useState('1450');

  // Load Admin Data
  const loadAdminData = async () => {
    if (!token || !isAdmin) return;
    try {
      // 1. Users
      const uRes = await fetch('/api/admin?action=users', { headers: { Authorization: `Bearer ${token}` } });
      if (uRes.ok) {
        const uData = await uRes.json();
        setUsers(uData.users || []);
      }

      // 2. P2P Orders
      const pRes = await fetch('/api/admin?action=p2p', { headers: { Authorization: `Bearer ${token}` } });
      if (pRes.ok) {
        const pData = await pRes.json();
        setP2pOrders(pData.orders || []);
      }

      // 3. Plans
      const plRes = await fetch('/api/admin?action=plans', { headers: { Authorization: `Bearer ${token}` } });
      if (plRes.ok) {
        const plData = await plRes.json();
        setPlans(plData.plans || []);
      }

      // 4. Withdrawals
      const wRes = await fetch('/api/admin?action=withdrawals', { headers: { Authorization: `Bearer ${token}` } });
      if (wRes.ok) {
        const wData = await wRes.json();
        setWithdrawals(wData.withdrawals || []);
      }

      // 5. Settings
      const sRes = await fetch('/api/admin?action=settings', { headers: { Authorization: `Bearer ${token}` } });
      if (sRes.ok) {
        const sData = await sRes.json();
        const cfg = sData.settings || {};
        if (cfg.flutterwave) {
          setFlutterwavePublic(cfg.flutterwave.publicKey || '');
          setFlutterwaveSecret(cfg.flutterwave.secretKey || '');
          setFlutterwaveEncryption(cfg.flutterwave.encryptionKey || '');
          setFlutterwaveWebhook(cfg.flutterwave.webhookSecret || '');
        }
        if (cfg.gdrive) {
          setGdriveClientId(cfg.gdrive.clientId || '');
          setGdriveClientSecret(cfg.gdrive.clientSecret || '');
          setGdriveRefreshToken(cfg.gdrive.refreshToken || '');
        }
      }

      // 6. P2P Info
      const infoRes = await fetch('/api/p2p?action=info');
      if (infoRes.ok) {
        const info = await infoRes.json();
        setInventoryStock(info.availableInventory || '1000.00');
        setBuyPriceUsd(info.sellPriceUsd || '1.02');
        setSellPriceUsd(info.buyPriceUsd || '1.00');
        setRwfRate(info.exchangeRateRwf || '1450');
      }

      // 7. Chat threads
      const tRes = await fetch('/api/p2p?action=threads', { headers: { Authorization: `Bearer ${token}` } });
      if (tRes.ok) {
        const tData = await tRes.json();
        setThreads(tData.threads || []);
      }
    } catch (e) {
      console.warn('Admin load error:', e);
    }
  };

  useEffect(() => {
    loadAdminData();
  }, [token, isAdmin]);

  // Save Settings via AJAX (NO PAGE RELOAD!)
  const handleSaveFlutterwaveKeys = async (e) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      const res = await fetch('/api/admin?action=settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          key: 'flutterwave',
          value: {
            publicKey: flutterwavePublic.trim(),
            secretKey: flutterwaveSecret.trim(),
            encryptionKey: flutterwaveEncryption.trim(),
            webhookSecret: flutterwaveWebhook.trim()
          }
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save settings');
      showToast('Flutterwave payment gateway keys saved successfully!', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleSaveGdriveKeys = async (e) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      const res = await fetch('/api/admin?action=settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          key: 'gdrive',
          value: {
            clientId: gdriveClientId.trim(),
            clientSecret: gdriveClientSecret.trim(),
            refreshToken: gdriveRefreshToken.trim()
          }
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save storage settings');
      showToast('Google Drive cloud storage credentials saved successfully!', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSavingSettings(false);
    }
  };

  // Update USDT inventory & rates
  const handleSaveInventory = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/admin?action=p2p&sub=inventory', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          availableInventory: parseFloat(inventoryStock),
          sellPriceUsd: parseFloat(buyPriceUsd),
          buyPriceUsd: parseFloat(sellPriceUsd),
          exchangeRateRwf: parseFloat(rwfRate)
        })
      });
      if (res.ok) {
        showToast('USDT Inventory & Exchange rates updated!', 'success');
      }
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  // P2P Confirm payment
  const handleConfirmPayment = async (orderId) => {
    try {
      const res = await fetch('/api/p2p?action=admin-confirm-payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ orderId })
      });
      if (res.ok) {
        showToast(`Payment confirmed for Order #${orderId}`, 'success');
        loadAdminData();
      }
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  // P2P Release USDT
  const handleReleaseCrypto = async (orderId) => {
    if (!window.confirm(`Release USDT escrow for Order #${orderId}?`)) return;
    try {
      const res = await fetch('/api/p2p?action=admin-release-crypto', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ orderId })
      });
      if (res.ok) {
        celebrate();
        showToast(`USDT released from escrow for Order #${orderId}!`, 'success');
        loadAdminData();
      }
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  // Confirm Affiliate Withdrawal
  const handleConfirmWithdrawal = async (wdrId) => {
    try {
      const res = await fetch('/api/admin?action=withdrawals', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ id: wdrId, status: 'confirmed_paid' })
      });
      if (res.ok) {
        showToast(`Payout marked as paid for Claim #${wdrId}!`, 'success');
        loadAdminData();
      }
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  // Fetch thread messages
  const handleSelectThread = async (orderId) => {
    setSelectedThread(orderId);
    try {
      const res = await fetch(`/api/p2p?action=chat&orderId=${encodeURIComponent(orderId)}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setThreadMessages(data.messages || []);
      }
    } catch (e) {
      console.warn('Failed to load thread messages:', e);
    }
  };

  // Send admin reply in thread
  const handleSendAdminReply = async (e) => {
    e.preventDefault();
    if (!selectedThread || !adminReplyText.trim()) return;

    try {
      const res = await fetch(`/api/p2p?action=chat&orderId=${encodeURIComponent(selectedThread)}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ message: adminReplyText.trim() })
      });
      if (res.ok) {
        setThreadMessages((prev) => [
          ...prev,
          {
            id: 'temp_' + Date.now(),
            orderId: selectedThread,
            senderRole: 'superadmin',
            message: adminReplyText.trim(),
            createdAt: new Date().toISOString()
          }
        ]);
        setAdminReplyText('');
      }
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  if (!isAdmin) {
    return (
      <div className="container" style={{ textAlign: 'center', padding: '80px 16px' }}>
        <div style={{
          width: 56,
          height: 56,
          borderRadius: '50%',
          background: 'rgba(255, 77, 79, 0.15)',
          border: '1px solid var(--dn)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--dn)',
          marginBottom: 16
        }}>
          <ShieldAlert size={30} />
        </div>
        <h2 style={{ fontSize: 24, fontWeight: 800, color: '#fff' }}>
          Super Admin Console Restricted
        </h2>
        <p style={{ fontSize: 14, color: 'var(--mut)', maxWidth: 460, margin: '8px auto 24px' }}>
          This console is strictly reserved for authorized institutional trading desk administrators.
        </p>
        <button
          onClick={() => openAuth('login')}
          className="btn btn-primary"
          style={{ padding: '12px 24px' }}
        >
          Sign In as Administrator
        </button>
      </div>
    );
  }

  return (
    <div className="container">
      {/* Admin Top Header */}
      <div style={{
        background: 'var(--panel)',
        border: '1px solid var(--line)',
        borderRadius: 'var(--radius)',
        padding: '16px 20px',
        marginBottom: 20,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 12
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 38,
            height: 38,
            borderRadius: 8,
            background: 'linear-gradient(135deg, #d4af37, #996515)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#0b0e14'
          }}>
            <ShieldAlert size={22} />
          </div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#fff', display: 'flex', alignItems: 'center', gap: 8 }}>
              Superadmin Control Center
              <span className="badge-gold">LEVEL 4 SECURITY</span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--mut)' }}>
              Logged in as: {user?.email}
            </div>
          </div>
        </div>

        <button
          onClick={loadAdminData}
          className="btn btn-outline"
          style={{ fontSize: 12, padding: '6px 12px' }}
        >
          <RefreshCw size={14} />
          <span>Refresh Data</span>
        </button>
      </div>

      {/* Admin Navigation Tabs */}
      <div style={{
        display: 'flex',
        gap: 6,
        overflowX: 'auto',
        background: 'var(--panel)',
        padding: 6,
        borderRadius: 'var(--radius)',
        border: '1px solid var(--line)',
        marginBottom: 20
      }}>
        {[
          { id: 'overview', label: 'Overview', icon: BarChart3 },
          { id: 'p2p', label: 'P2P Orders & Claims', icon: Layers },
          { id: 'inventory', label: 'USDT Inventory & Rates', icon: DollarSign },
          { id: 'users', label: 'User Management', icon: Users },
          { id: 'plans', label: 'Plans & Subscriptions', icon: Sparkles },
          { id: 'settings', label: 'Platform Settings', icon: Settings },
          { id: 'withdrawals', label: 'Referrals & Payouts', icon: DollarSign },
          { id: 'chat', label: 'Trader Live Chat', icon: MessageSquare }
        ].map((t) => {
          const Icon = t.icon;
          const isActive = activeTab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => handleTabChange(t.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 14px',
                borderRadius: 'var(--radius-sm)',
                fontSize: 12,
                fontWeight: 700,
                border: 'none',
                cursor: 'pointer',
                background: isActive ? 'var(--gold)' : 'transparent',
                color: isActive ? '#0b0e14' : 'var(--mut)',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease'
              }}
            >
              <Icon size={15} />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: OVERVIEW */}
      {activeTab === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div className="grid-4">
            <div className="panel-card">
              <div style={{ fontSize: 11, color: 'var(--mut)', fontWeight: 700 }}>REGISTERED TRADERS</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: '#fff', marginTop: 4 }}>
                {users.length} Users
              </div>
            </div>

            <div className="panel-card">
              <div style={{ fontSize: 11, color: 'var(--mut)', fontWeight: 700 }}>P2P VOLUME PROCESSED</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--gold-bright)', marginTop: 4 }}>
                ${p2pOrders.reduce((sum, o) => sum + (parseFloat(o.cryptoAmount) || 0), 0).toLocaleString()} USDT
              </div>
            </div>

            <div className="panel-card">
              <div style={{ fontSize: 11, color: 'var(--mut)', fontWeight: 700 }}>PENDING P2P CLAIMS</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--amber)', marginTop: 4 }}>
                {p2pOrders.filter((o) => o.status === 'payment_sent' || o.status === 'pending_payment').length} Pending
              </div>
            </div>

            <div className="panel-card">
              <div style={{ fontSize: 11, color: 'var(--mut)', fontWeight: 700 }}>AFFILIATE PAYOUT CLAIMS</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--up)', marginTop: 4 }}>
                {withdrawals.filter((w) => w.status === 'pending_confirmation').length} Unpaid
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: P2P ORDERS & CLAIMS */}
      {activeTab === 'p2p' && (
        <div style={{
          background: 'var(--panel)',
          border: '1px solid var(--line)',
          borderRadius: 'var(--radius)',
          padding: 20
        }}>
          <h3 style={{ fontSize: 16, fontWeight: 800, color: '#fff', marginBottom: 16 }}>
            P2P Orders & Proof Verification ({p2pOrders.length})
          </h3>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Order ID</th>
                  <th>Type</th>
                  <th>USDT</th>
                  <th>Fiat Amount</th>
                  <th>User Details / Wallet</th>
                  <th>Status</th>
                  <th>Proof</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {p2pOrders.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', color: 'var(--mut)', padding: 24 }}>
                      No P2P orders found.
                    </td>
                  </tr>
                ) : (
                  p2pOrders.map((o) => (
                    <tr key={o.id}>
                      <td style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12 }}>{o.id}</td>
                      <td>
                        <span className={o.type === 'buy' ? 'badge-up' : 'badge-dn'}>
                          {o.type?.toUpperCase()}
                        </span>
                      </td>
                      <td style={{ fontWeight: 800, color: 'var(--gold-bright)' }}>{o.cryptoAmount} USDT</td>
                      <td style={{ fontWeight: 700 }}>{o.fiatAmount} {o.fiatCurrency || 'RWF'}</td>
                      <td style={{ fontSize: 12, maxWidth: 180, wordBreak: 'break-all' }}>
                        {o.userWalletAddress || o.userPaymentDetails || '—'}
                      </td>
                      <td>
                        <span className="badge-gold">{o.status}</span>
                      </td>
                      <td>
                        {o.screenshotProofUrl ? (
                          <button
                            onClick={() => setViewProofUrl(o.screenshotProofUrl)}
                            className="btn btn-outline"
                            style={{ padding: '4px 8px', fontSize: 11 }}
                          >
                            <Eye size={13} />
                            View
                          </button>
                        ) : (
                          <span style={{ color: 'var(--mut)', fontSize: 11 }}>No Proof</span>
                        )}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button
                            onClick={() => handleConfirmPayment(o.id)}
                            className="btn btn-buy"
                            style={{ padding: '4px 8px', fontSize: 11 }}
                            title="Confirm receipt of fiat payment"
                          >
                            Confirm Paid
                          </button>
                          <button
                            onClick={() => handleReleaseCrypto(o.id)}
                            className="btn btn-primary"
                            style={{ padding: '4px 8px', fontSize: 11 }}
                            title="Release USDT from escrow"
                          >
                            Release USDT
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: USDT INVENTORY & RATES */}
      {activeTab === 'inventory' && (
        <div style={{
          background: 'var(--panel)',
          border: '1px solid var(--line)',
          borderRadius: 'var(--radius)',
          maxWidth: 600,
          padding: 24
        }}>
          <h3 style={{ fontSize: 16, fontWeight: 800, color: '#fff', marginBottom: 16 }}>
            Configure USDT Inventory & Exchange Rates
          </h3>

          <form onSubmit={handleSaveInventory}>
            <div className="form-group">
              <label className="form-label">Available USDT Inventory Stock</label>
              <input
                type="number"
                step="0.01"
                className="form-control"
                value={inventoryStock}
                onChange={(e) => setInventoryStock(e.target.value)}
                required
              />
            </div>

            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Price to Buy (1 USDT in USD)</label>
                <input
                  type="number"
                  step="0.01"
                  className="form-control"
                  value={buyPriceUsd}
                  onChange={(e) => setBuyPriceUsd(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Price to Sell (1 USDT in USD)</label>
                <input
                  type="number"
                  step="0.01"
                  className="form-control"
                  value={sellPriceUsd}
                  onChange={(e) => setSellPriceUsd(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">USD to RWF Base Exchange Rate</label>
              <input
                type="number"
                step="1"
                className="form-control"
                value={rwfRate}
                onChange={(e) => setRwfRate(e.target.value)}
                required
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%', padding: '12px', fontSize: 14, fontWeight: 800 }}
            >
              <Save size={16} />
              Save Inventory & Rates
            </button>
          </form>
        </div>
      )}

      {/* TAB 4: USER MANAGEMENT */}
      {activeTab === 'users' && (
        <div style={{
          background: 'var(--panel)',
          border: '1px solid var(--line)',
          borderRadius: 'var(--radius)',
          padding: 20
        }}>
          <h3 style={{ fontSize: 16, fontWeight: 800, color: '#fff', marginBottom: 16 }}>
            Platform Users ({users.length})
          </h3>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>User ID</th>
                  <th>Name / Email</th>
                  <th>Phone</th>
                  <th>Role</th>
                  <th>VIP Access</th>
                  <th>Registered</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12 }}>{u.id}</td>
                    <td style={{ fontWeight: 700, color: '#fff' }}>
                      {u.name || 'Trader'}
                      <div style={{ fontSize: 11, color: 'var(--mut)', fontWeight: 400 }}>{u.email}</div>
                    </td>
                    <td style={{ fontSize: 12 }}>{u.phone || '—'}</td>
                    <td>
                      <span className={u.role === 'superadmin' || u.role === 'admin' ? 'badge-gold' : 'badge-up'}>
                        {u.role || 'user'}
                      </span>
                    </td>
                    <td>
                      <span className={u.isVip ? 'badge-gold' : 'badge-up'}>
                        {u.isVip ? 'VIP Active' : 'Standard'}
                      </span>
                    </td>
                    <td style={{ color: 'var(--mut)', fontSize: 12 }}>
                      {new Date(u.createdAt || Date.now()).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 5: PLANS & SUBSCRIPTIONS */}
      {activeTab === 'plans' && (
        <div style={{
          background: 'var(--panel)',
          border: '1px solid var(--line)',
          borderRadius: 'var(--radius)',
          padding: 20
        }}>
          <h3 style={{ fontSize: 16, fontWeight: 800, color: '#fff', marginBottom: 16 }}>
            Subscription Plans & Pricing ({plans.length})
          </h3>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Plan ID</th>
                  <th>Name</th>
                  <th>Duration (Days)</th>
                  <th>Price (USD)</th>
                  <th>Price (RWF)</th>
                </tr>
              </thead>
              <tbody>
                {plans.map((p) => (
                  <tr key={p.id}>
                    <td style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12 }}>{p.id}</td>
                    <td style={{ fontWeight: 800, color: '#fff' }}>{p.name}</td>
                    <td>{p.days} Days</td>
                    <td style={{ fontWeight: 800, color: 'var(--gold-bright)' }}>${p.priceUsd?.toFixed(2)}</td>
                    <td style={{ fontWeight: 700 }}>{p.priceRwf?.toLocaleString()} RWF</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 6: PLATFORM SETTINGS (AJAX PERSISTENT SAVE WITHOUT RELOAD!) */}
      {activeTab === 'settings' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 20 }}>
          {/* Flutterwave Payment Gateway Credentials */}
          <div style={{
            background: 'var(--panel)',
            border: '1px solid var(--line)',
            borderRadius: 'var(--radius)',
            padding: 24
          }}>
            <h3 style={{ fontSize: 16, fontWeight: 800, color: 'var(--gold-bright)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Key size={18} />
              Flutterwave Payment Gateway Credentials
            </h3>

            <form onSubmit={handleSaveFlutterwaveKeys}>
              <div className="form-group">
                <label className="form-label">Flutterwave Public Key</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="FLWPUBK_TEST-..."
                  value={flutterwavePublic}
                  onChange={(e) => setFlutterwavePublic(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Flutterwave Secret Key</label>
                <input
                  type="password"
                  className="form-control"
                  placeholder="FLWSECK_TEST-..."
                  value={flutterwaveSecret}
                  onChange={(e) => setFlutterwaveSecret(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Flutterwave Encryption Key</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Encryption key"
                  value={flutterwaveEncryption}
                  onChange={(e) => setFlutterwaveEncryption(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Flutterwave Webhook Hash Secret</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Secret hash header"
                  value={flutterwaveWebhook}
                  onChange={(e) => setFlutterwaveWebhook(e.target.value)}
                />
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                disabled={savingSettings}
                style={{ width: '100%', padding: '12px', fontSize: 14, fontWeight: 800 }}
              >
                <Save size={15} />
                <span>{savingSettings ? 'Saving...' : 'Save Flutterwave Keys'}</span>
              </button>
            </form>
          </div>

          {/* Google Drive Storage Credentials */}
          <div style={{
            background: 'var(--panel)',
            border: '1px solid var(--line)',
            borderRadius: 'var(--radius)',
            padding: 24
          }}>
            <h3 style={{ fontSize: 16, fontWeight: 800, color: 'var(--gold-bright)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Database size={18} />
              Google Drive Storage Integration (OAuth2)
            </h3>

            <form onSubmit={handleSaveGdriveKeys}>
              <div className="form-group">
                <label className="form-label">Client ID</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Google OAuth2 Client ID"
                  value={gdriveClientId}
                  onChange={(e) => setGdriveClientId(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Client Secret</label>
                <input
                  type="password"
                  className="form-control"
                  placeholder="Google OAuth2 Client Secret"
                  value={gdriveClientSecret}
                  onChange={(e) => setGdriveClientSecret(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">OAuth2 Refresh Token</label>
                <input
                  type="password"
                  className="form-control"
                  placeholder="OAuth2 Refresh Token"
                  value={gdriveRefreshToken}
                  onChange={(e) => setGdriveRefreshToken(e.target.value)}
                />
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                disabled={savingSettings}
                style={{ width: '100%', padding: '12px', fontSize: 14, fontWeight: 800 }}
              >
                <Save size={15} />
                <span>{savingSettings ? 'Saving...' : 'Save Google Drive Keys'}</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* TAB 7: REFERRALS & PAYOUTS */}
      {activeTab === 'withdrawals' && (
        <div style={{
          background: 'var(--panel)',
          border: '1px solid var(--line)',
          borderRadius: 'var(--radius)',
          padding: 20
        }}>
          <h3 style={{ fontSize: 16, fontWeight: 800, color: '#fff', marginBottom: 16 }}>
            Affiliate Withdrawal Claims ({withdrawals.length})
          </h3>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Claim ID</th>
                  <th>User</th>
                  <th>Amount</th>
                  <th>Net Payout</th>
                  <th>Channel</th>
                  <th>Destination</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {withdrawals.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', color: 'var(--mut)', padding: 24 }}>
                      No affiliate payout requests.
                    </td>
                  </tr>
                ) : (
                  withdrawals.map((w) => (
                    <tr key={w.id}>
                      <td style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12 }}>{w.id}</td>
                      <td>{w.user_email || w.user_id}</td>
                      <td style={{ fontWeight: 800, color: '#fff' }}>${w.amount?.toFixed(2)}</td>
                      <td style={{ fontWeight: 800, color: 'var(--gold-bright)' }}>${w.net_amount?.toFixed(2)}</td>
                      <td style={{ textTransform: 'capitalize' }}>{w.method?.replace('_', ' ')}</td>
                      <td style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12 }}>{w.destination_account}</td>
                      <td>
                        <span className={w.status === 'confirmed_paid' ? 'badge-up' : 'badge-gold'}>
                          {w.status?.replace('_', ' ')}
                        </span>
                      </td>
                      <td>
                        {w.status !== 'confirmed_paid' && (
                          <button
                            onClick={() => handleConfirmWithdrawal(w.id)}
                            className="btn btn-buy"
                            style={{ padding: '4px 8px', fontSize: 11 }}
                          >
                            Mark Paid
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 8: TRADER LIVE CHAT CONSOLE */}
      {activeTab === 'chat' && (
        <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 20, minHeight: 480 }}>
          {/* Threads Sidebar */}
          <div style={{
            background: 'var(--panel)',
            border: '1px solid var(--line)',
            borderRadius: 'var(--radius)',
            padding: 14,
            display: 'flex',
            flexDirection: 'column',
            gap: 8
          }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--mut)', paddingBottom: 6, borderBottom: '1px solid var(--line)' }}>
              ACTIVE CHAT THREADS ({threads.length})
            </div>

            {threads.length === 0 ? (
              <div style={{ color: 'var(--mut)', fontSize: 12, textAlign: 'center', margin: 'auto 0' }}>
                No active conversations.
              </div>
            ) : (
              threads.map((t) => (
                <div
                  key={t.orderId}
                  onClick={() => handleSelectThread(t.orderId)}
                  style={{
                    background: selectedThread === t.orderId ? 'rgba(212,175,55,0.1)' : 'var(--panel-card)',
                    border: selectedThread === t.orderId ? '1px solid var(--gold)' : '1px solid var(--line)',
                    padding: 10,
                    borderRadius: 6,
                    cursor: 'pointer'
                  }}
                >
                  <div style={{ fontSize: 12, fontWeight: 800, color: '#fff' }}>Order #{t.orderId}</div>
                  <div style={{ fontSize: 11, color: 'var(--mut)', marginTop: 2 }}>{t.lastMessage || 'Active thread'}</div>
                </div>
              ))
            )}
          </div>

          {/* Active Thread Message Panel */}
          <div style={{
            background: 'var(--panel)',
            border: '1px solid var(--line)',
            borderRadius: 'var(--radius)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}>
            {selectedThread ? (
              <>
                <div style={{
                  padding: 14,
                  background: 'var(--panel-card)',
                  borderBottom: '1px solid var(--line)',
                  fontSize: 13,
                  fontWeight: 800,
                  color: '#fff'
                }}>
                  Conversation Thread: Order #{selectedThread}
                </div>

                <div style={{ flex: 1, padding: 16, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {threadMessages.map((m, idx) => {
                    const isMe = m.senderRole === 'admin' || m.senderRole === 'superadmin';
                    return (
                      <div
                        key={m.id || idx}
                        style={{
                          alignSelf: isMe ? 'flex-end' : 'flex-start',
                          maxWidth: '75%',
                          background: isMe ? 'var(--panel-card)' : 'rgba(212,175,55,0.1)',
                          border: isMe ? '1px solid var(--line-light)' : '1px solid rgba(212,175,55,0.3)',
                          padding: '8px 12px',
                          borderRadius: 6,
                          fontSize: 13
                        }}
                      >
                        <div style={{ fontSize: 10, color: 'var(--mut)', marginBottom: 2 }}>
                          {isMe ? '🛡️ Desk Support (You)' : 'Trader'}
                        </div>
                        <div style={{ color: '#fff' }}>{m.message}</div>
                      </div>
                    );
                  })}
                </div>

                <form
                  onSubmit={handleSendAdminReply}
                  style={{
                    display: 'flex',
                    padding: 10,
                    background: 'var(--panel-card)',
                    borderTop: '1px solid var(--line)',
                    gap: 8
                  }}
                >
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Type official response..."
                    value={adminReplyText}
                    onChange={(e) => setAdminReplyText(e.target.value)}
                  />
                  <button type="submit" className="btn btn-primary" style={{ padding: '8px 16px' }}>
                    <Send size={15} />
                  </button>
                </form>
              </>
            ) : (
              <div style={{ color: 'var(--mut)', fontSize: 13, textAlign: 'center', margin: 'auto' }}>
                Select a chat thread from the left sidebar to read and reply.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Proof Viewer Modal */}
      {viewProofUrl && (
        <div className="modal-overlay" onClick={() => setViewProofUrl(null)}>
          <div className="modal-card" style={{ maxWidth: 640 }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ fontSize: 16, fontWeight: 800, color: '#fff', marginBottom: 14 }}>
              Payment Screenshot Verification
            </h3>
            <img
              src={viewProofUrl}
              alt="Payment Proof"
              style={{ width: '100%', maxHeight: '65vh', objectFit: 'contain', borderRadius: 6, border: '1px solid var(--line)' }}
            />
            <div style={{ marginTop: 14, textAlign: 'right' }}>
              <button onClick={() => setViewProofUrl(null)} className="btn btn-outline">
                Close Viewer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
