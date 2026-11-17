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
  Send,
  Edit,
  Plus,
  Lock,
  Calendar,
  AlertTriangle
} from 'lucide-react';

export default function AdminDashboard() {
  const { user, token, isAdmin, openAuth } = useAuth();
  const { showToast, celebrate } = useToast();

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
  const [subscriptions, setSubscriptions] = useState([]);
  const [withdrawals, setWithdrawals] = useState([]);
  const [threads, setThreads] = useState([]);
  const [selectedThread, setSelectedThread] = useState(null);
  const [threadMessages, setThreadMessages] = useState([]);
  const [adminReplyText, setAdminReplyText] = useState('');

  // Proof Modal
  const [viewProofUrl, setViewProofUrl] = useState(null);

  // User Edit Modal State
  const [editUserModalOpen, setEditUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [editUserName, setEditUserName] = useState('');
  const [editUserPhone, setEditUserPhone] = useState('');
  const [editUserRole, setEditUserRole] = useState('user');
  const [editUserIsVip, setEditUserIsVip] = useState(false);
  const [editUserVipDays, setEditUserVipDays] = useState(30);

  // Plan Edit / Create Modal State
  const [planModalOpen, setPlanModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState(null);
  const [planName, setPlanName] = useState('');
  const [planSlug, setPlanSlug] = useState('');
  const [planDays, setPlanDays] = useState(30);
  const [planPriceUsd, setPlanPriceUsd] = useState(20);
  const [planPriceRwf, setPlanPriceRwf] = useState(29000);

  // Platform Settings State
  const [flutterwavePublic, setFlutterwavePublic] = useState('');
  const [flutterwaveSecret, setFlutterwaveSecret] = useState('');
  const [flutterwaveEncryption, setFlutterwaveEncryption] = useState('');
  const [flutterwaveWebhook, setFlutterwaveWebhook] = useState('');
  const [gdriveClientId, setGdriveClientId] = useState('');
  const [gdriveClientSecret, setGdriveClientSecret] = useState('');
  const [gdriveRefreshToken, setGdriveRefreshToken] = useState('');
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsOrigin, setSettingsOrigin] = useState('');

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

      // 4. Real DB Subscriptions
      const sRes = await fetch('/api/admin?action=subscriptions', { headers: { Authorization: `Bearer ${token}` } });
      if (sRes.ok) {
        const sData = await sRes.json();
        setSubscriptions(sData.subscriptions || []);
      }

      // 5. Withdrawals
      const wRes = await fetch('/api/admin?action=withdrawals', { headers: { Authorization: `Bearer ${token}` } });
      if (wRes.ok) {
        const wData = await wRes.json();
        setWithdrawals(wData.withdrawals || []);
      }

      // 6. Settings (Database first, ENV fallback)
      const stRes = await fetch('/api/admin?action=settings', { headers: { Authorization: `Bearer ${token}` } });
      if (stRes.ok) {
        const stData = await stRes.json();
        const cfg = stData.settings || {};
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
        setSettingsOrigin(stData.settings?.loadedFromDb ? 'Database (Active)' : 'Environment Variable (Fallback)');
      }

      // 7. P2P Info
      const infoRes = await fetch('/api/p2p?action=info');
      if (infoRes.ok) {
        const info = await infoRes.json();
        setInventoryStock(info.availableInventory || '1000.00');
        setBuyPriceUsd(info.sellPriceUsd || '1.02');
        setSellPriceUsd(info.buyPriceUsd || '1.00');
        setRwfRate(info.exchangeRateRwf || '1450');
      }

      // 8. Chat threads
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

  // Save Settings via AJAX (Writes to DB so DB overrides ENV!)
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
      showToast('Flutterwave keys saved to Database! (Overrides environment variables)', 'success');
      setSettingsOrigin('Database (Active)');
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
      showToast('Google Drive credentials saved to Database!', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSavingSettings(false);
    }
  };

  // User CRUD Operations
  const handleOpenEditUser = (u) => {
    setEditingUser(u);
    setEditUserName(u.full_name || u.name || '');
    setEditUserPhone(u.phone || '');
    setEditUserRole(u.role || 'user');
    setEditUserIsVip(u.isVip || u.sub_status === 'active');
    setEditUserVipDays(30);
    setEditUserModalOpen(true);
  };

  const handleSaveUser = async (e) => {
    e.preventDefault();
    if (!editingUser) return;
    try {
      const res = await fetch('/api/admin?action=users&sub=update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          userId: editingUser.id,
          fullName: editUserName,
          phone: editUserPhone,
          role: editUserRole,
          isVip: editUserIsVip,
          vipDays: editUserVipDays
        })
      });
      if (!res.ok) throw new Error('Failed to update user');
      showToast(`User ${editUserName || editingUser.email} updated successfully!`, 'success');
      setEditUserModalOpen(false);
      loadAdminData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleDeleteUser = async (userId, userEmail) => {
    if (!window.confirm(`Permanently delete user ${userEmail}?`)) return;
    try {
      const res = await fetch(`/api/admin?action=users&id=${userId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        showToast(`User ${userEmail} deleted.`, 'info');
        loadAdminData();
      }
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  // Plan CRUD Operations
  const handleOpenCreatePlan = () => {
    setEditingPlan(null);
    setPlanName('');
    setPlanSlug('');
    setPlanDays(30);
    setPlanPriceUsd(20);
    setPlanPriceRwf(29000);
    setPlanModalOpen(true);
  };

  const handleOpenEditPlan = (p) => {
    setEditingPlan(p);
    setPlanName(p.name);
    setPlanSlug(p.slug || p.id);
    setPlanDays(p.duration_days || p.days || 30);
    setPlanPriceUsd(p.price_usd || p.priceUsd || 20);
    setPlanPriceRwf(p.price_rwf || p.priceRwf || 29000);
    setPlanModalOpen(true);
  };

  const handleSavePlan = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/admin?action=plans', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          id: editingPlan?.id,
          name: planName,
          slug: planSlug || planName.toLowerCase().replace(/\s+/g, '-'),
          durationDays: parseInt(planDays),
          priceUsd: parseFloat(planPriceUsd),
          priceRwf: parseFloat(planPriceRwf),
          isActive: true
        })
      });
      if (!res.ok) throw new Error('Failed to save plan');
      showToast('Plan saved successfully in database!', 'success');
      setPlanModalOpen(false);
      loadAdminData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleDeletePlan = async (planId, planName) => {
    if (!window.confirm(`Delete plan "${planName}"?`)) return;
    try {
      const res = await fetch(`/api/admin?action=plans&id=${planId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        showToast(`Plan ${planName} deleted.`, 'info');
        loadAdminData();
      }
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  // P2P Confirm / Release
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

  // Chat Thread Selection & Message Polling
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
            order_id: selectedThread,
            sender_role: 'superadmin',
            message: adminReplyText.trim(),
            created_at: new Date().toISOString()
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

  // Badges calculations
  const pendingP2pCount = p2pOrders.filter((o) => o.status === 'payment_sent' || o.status === 'pending_payment').length;
  const pendingWithdrawalCount = withdrawals.filter((w) => w.status === 'pending_confirmation' || w.status === 'pending').length;
  const activeChatCount = threads.length;

  return (
    <div className="container" style={{ maxWidth: 1400 }}>
      {/* Top Bar */}
      <div style={{
        background: 'var(--panel)',
        border: '1px solid var(--line)',
        borderRadius: 'var(--radius)',
        padding: '14px 20px',
        marginBottom: 18,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 12
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 36,
            height: 36,
            borderRadius: 8,
            background: 'linear-gradient(135deg, #d4af37, #996515)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#0b0e14'
          }}>
            <ShieldAlert size={20} />
          </div>
          <div>
            <div style={{ fontSize: 17, fontWeight: 800, color: '#fff', display: 'flex', alignItems: 'center', gap: 8 }}>
              Superadmin Control Center
              <span className="badge-gold">LEVEL 4 SECURITY</span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--mut)' }}>
              Logged in: <strong>{user?.email}</strong>
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

      {/* SIDEBAR + MAIN CONTENT LAYOUT */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(230px, 260px) 1fr', gap: 20 }} className="admin-layout-grid">
        {/* LEFT NAVIGATION SIDEBAR */}
        <aside style={{
          background: 'var(--panel)',
          border: '1px solid var(--line)',
          borderRadius: 'var(--radius)',
          padding: '16px 12px',
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          height: 'fit-content'
        }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--mut)', padding: '0 8px 10px', borderBottom: '1px solid var(--line)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Administration Menu
          </div>

          {[
            { id: 'overview', label: 'Overview', icon: BarChart3, badge: null },
            { id: 'p2p', label: 'P2P Orders & Claims', icon: Layers, badge: pendingP2pCount },
            { id: 'inventory', label: 'USDT Inventory & Rates', icon: DollarSign, badge: null },
            { id: 'users', label: 'User Management', icon: Users, badge: users.length },
            { id: 'plans', label: 'Subscription Plans', icon: Sparkles, badge: plans.length },
            { id: 'subscriptions', label: 'Database Subscriptions', icon: Calendar, badge: subscriptions.length },
            { id: 'withdrawals', label: 'Referrals & Payouts', icon: DollarSign, badge: pendingWithdrawalCount },
            { id: 'chat', label: 'Trader Live Chat', icon: MessageSquare, badge: activeChatCount },
            { id: 'settings', label: 'Platform Settings', icon: Settings, badge: null }
          ].map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleTabChange(item.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 12px',
                  borderRadius: 6,
                  border: 'none',
                  background: isActive ? 'linear-gradient(135deg, rgba(212, 175, 55, 0.2), rgba(212, 175, 55, 0.05))' : 'transparent',
                  color: isActive ? 'var(--gold-bright)' : 'var(--text)',
                  borderLeft: isActive ? '3px solid var(--gold-bright)' : '3px solid transparent',
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: isActive ? 800 : 600,
                  transition: 'all 0.15s ease',
                  textAlign: 'left'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Icon size={16} style={{ color: isActive ? 'var(--gold-bright)' : 'var(--mut)' }} />
                  <span>{item.label}</span>
                </div>
                {item.badge !== null && item.badge > 0 && (
                  <span style={{
                    background: item.id === 'withdrawals' || item.id === 'p2p' ? 'var(--amber)' : 'rgba(212, 175, 55, 0.25)',
                    color: item.id === 'withdrawals' || item.id === 'p2p' ? '#0b0e14' : 'var(--gold-bright)',
                    fontSize: 11,
                    fontWeight: 800,
                    padding: '2px 7px',
                    borderRadius: 10
                  }}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </aside>

        {/* RIGHT MAIN WORKSPACE */}
        <div style={{ minWidth: 0 }}>
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div className="grid-4">
                <div className="panel-card">
                  <div style={{ fontSize: 11, color: 'var(--mut)', fontWeight: 700 }}>REGISTERED TRADERS</div>
                  <div style={{ fontSize: 24, fontWeight: 800, color: '#fff', marginTop: 4 }}>
                    {users.length} Users
                  </div>
                </div>

                <div className="panel-card">
                  <div style={{ fontSize: 11, color: 'var(--mut)', fontWeight: 700 }}>ACTIVE VIP SUBSCRIBERS</div>
                  <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--up)', marginTop: 4 }}>
                    {subscriptions.filter(s => s.status === 'active').length} Active
                  </div>
                </div>

                <div className="panel-card">
                  <div style={{ fontSize: 11, color: 'var(--mut)', fontWeight: 700 }}>PENDING P2P CLAIMS</div>
                  <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--amber)', marginTop: 4 }}>
                    {pendingP2pCount} Pending
                  </div>
                </div>

                <div className="panel-card">
                  <div style={{ fontSize: 11, color: 'var(--mut)', fontWeight: 700 }}>UNPAID COMMISSIONS</div>
                  <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--gold-bright)', marginTop: 4 }}>
                    {pendingWithdrawalCount} Claims
                  </div>
                </div>
              </div>

              <div style={{
                background: 'var(--panel)',
                border: '1px solid var(--line)',
                borderRadius: 'var(--radius)',
                padding: 20
              }}>
                <h3 style={{ fontSize: 15, fontWeight: 800, color: '#fff', marginBottom: 10 }}>
                  Trading Desk Status & Core Health
                </h3>
                <div style={{ fontSize: 13, color: 'var(--mut)', lineHeight: 1.6 }}>
                  PostgreSQL cluster is operational. Settings are loaded with precedence: <strong>{settingsOrigin || 'Database first, ENV fallback'}</strong>.
                  All subscriptions and affiliate payouts reflect live data directly from the persistent database.
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: P2P ORDERS & CLAIMS */}
          {activeTab === 'p2p' && (
            <div style={{ background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 'var(--radius)', padding: 20 }}>
              <h3 style={{ fontSize: 16, fontWeight: 800, color: '#fff', marginBottom: 16 }}>
                P2P Orders & Claims Verification ({p2pOrders.length})
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
                      <tr><td colSpan={8} style={{ textAlign: 'center', color: 'var(--mut)', padding: 24 }}>No P2P orders found.</td></tr>
                    ) : (
                      p2pOrders.map((o) => (
                        <tr key={o.id}>
                          <td style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12 }}>{o.id}</td>
                          <td><span className={o.type === 'buy' ? 'badge-up' : 'badge-dn'}>{o.type?.toUpperCase()}</span></td>
                          <td style={{ fontWeight: 800, color: 'var(--gold-bright)' }}>{o.cryptoAmount} USDT</td>
                          <td style={{ fontWeight: 700 }}>{o.fiatAmount} {o.fiatCurrency || 'RWF'}</td>
                          <td style={{ fontSize: 12, maxWidth: 180, wordBreak: 'break-all' }}>{o.userWalletAddress || o.userPaymentDetails || '—'}</td>
                          <td><span className="badge-gold">{o.status}</span></td>
                          <td>
                            {o.screenshotProofUrl ? (
                              <button onClick={() => setViewProofUrl(o.screenshotProofUrl)} className="btn btn-outline" style={{ padding: '4px 8px', fontSize: 11 }}>
                                <Eye size={13} /> View
                              </button>
                            ) : <span style={{ color: 'var(--mut)', fontSize: 11 }}>No Proof</span>}
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: 6 }}>
                              <button onClick={() => handleConfirmPayment(o.id)} className="btn btn-buy" style={{ padding: '4px 8px', fontSize: 11 }}>Confirm Paid</button>
                              <button onClick={() => handleReleaseCrypto(o.id)} className="btn btn-primary" style={{ padding: '4px 8px', fontSize: 11 }}>Release USDT</button>
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

          {/* TAB 3: USDT INVENTORY */}
          {activeTab === 'inventory' && (
            <div style={{ background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 'var(--radius)', maxWidth: 580, padding: 24 }}>
              <h3 style={{ fontSize: 16, fontWeight: 800, color: '#fff', marginBottom: 16 }}>Configure USDT Inventory & Rates</h3>
              <form onSubmit={async (e) => {
                e.preventDefault();
                await fetch('/api/admin?action=p2p&sub=inventory', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                  body: JSON.stringify({
                    availableInventory: parseFloat(inventoryStock),
                    sellPriceUsd: parseFloat(buyPriceUsd),
                    buyPriceUsd: parseFloat(sellPriceUsd),
                    exchangeRateRwf: parseFloat(rwfRate)
                  })
                });
                showToast('Inventory & Exchange rates updated!', 'success');
              }}>
                <div className="form-group">
                  <label className="form-label">Available USDT Inventory Stock</label>
                  <input type="number" step="0.01" className="form-control" value={inventoryStock} onChange={(e) => setInventoryStock(e.target.value)} required />
                </div>
                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">Price to Buy (1 USDT in USD)</label>
                    <input type="number" step="0.01" className="form-control" value={buyPriceUsd} onChange={(e) => setBuyPriceUsd(e.target.value)} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Price to Sell (1 USDT in USD)</label>
                    <input type="number" step="0.01" className="form-control" value={sellPriceUsd} onChange={(e) => setSellPriceUsd(e.target.value)} required />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">USD to RWF Base Rate</label>
                  <input type="number" step="1" className="form-control" value={rwfRate} onChange={(e) => setRwfRate(e.target.value)} required />
                </div>
                <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '12px' }}>
                  <Save size={16} /> Save Inventory & Rates
                </button>
              </form>
            </div>
          )}

          {/* TAB 4: USER MANAGEMENT (FULL CRUD) */}
          {activeTab === 'users' && (
            <div style={{ background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 'var(--radius)', padding: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h3 style={{ fontSize: 16, fontWeight: 800, color: '#fff' }}>User Management ({users.length})</h3>
              </div>

              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>User ID</th>
                      <th>Name / Email</th>
                      <th>Phone</th>
                      <th>Role</th>
                      <th>VIP Access</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => (
                      <tr key={u.id}>
                        <td style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12 }}>{u.id?.slice(0, 8)}...</td>
                        <td style={{ fontWeight: 700, color: '#fff' }}>
                          {u.full_name || u.name || 'Trader'}
                          <div style={{ fontSize: 11, color: 'var(--mut)', fontWeight: 400 }}>{u.email}</div>
                        </td>
                        <td style={{ fontSize: 12 }}>{u.phone || '—'}</td>
                        <td>
                          <span className={u.role === 'superadmin' || u.role === 'admin' ? 'badge-gold' : 'badge-up'}>
                            {u.role || 'user'}
                          </span>
                        </td>
                        <td>
                          <span className={u.isVip || u.sub_status === 'active' ? 'badge-gold' : 'badge-up'}>
                            {u.isVip || u.sub_status === 'active' ? 'VIP Active' : 'Standard'}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button
                              onClick={() => handleOpenEditUser(u)}
                              className="btn btn-outline"
                              style={{ padding: '4px 8px', fontSize: 11 }}
                            >
                              <Edit size={13} /> Edit
                            </button>
                            {!['benirabok@gmail.com', 'omarrukwaya@gmail.com'].includes(u.email) && (
                              <button
                                onClick={() => handleDeleteUser(u.id, u.email)}
                                className="btn btn-outline"
                                style={{ padding: '4px 8px', fontSize: 11, color: 'var(--dn)', borderColor: 'var(--dn)' }}
                              >
                                <Trash2 size={13} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 5: PLANS & SUBSCRIPTIONS (FULL CRUD) */}
          {activeTab === 'plans' && (
            <div style={{ background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 'var(--radius)', padding: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 800, color: '#fff' }}>Subscription Plans ({plans.length})</h3>
                  <div style={{ fontSize: 12, color: 'var(--mut)' }}>Standard monthly baseline: <strong>$20.00 USD (29,000 RWF)</strong></div>
                </div>
                <button onClick={handleOpenCreatePlan} className="btn btn-primary" style={{ padding: '6px 14px' }}>
                  <Plus size={15} /> Add Plan
                </button>
              </div>

              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Plan ID / Slug</th>
                      <th>Name</th>
                      <th>Duration</th>
                      <th>Price (USD)</th>
                      <th>Price (RWF)</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {plans.map((p) => (
                      <tr key={p.id || p.slug}>
                        <td style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12 }}>{p.id || p.slug}</td>
                        <td style={{ fontWeight: 800, color: '#fff' }}>{p.name}</td>
                        <td>{p.duration_days || p.days} Days</td>
                        <td style={{ fontWeight: 800, color: 'var(--gold-bright)' }}>${(p.price_usd || p.priceUsd)?.toFixed(2)}</td>
                        <td style={{ fontWeight: 700 }}>{(p.price_rwf || p.priceRwf)?.toLocaleString()} RWF</td>
                        <td>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button onClick={() => handleOpenEditPlan(p)} className="btn btn-outline" style={{ padding: '4px 8px', fontSize: 11 }}>
                              <Edit size={13} /> Edit
                            </button>
                            <button onClick={() => handleDeletePlan(p.id, p.name)} className="btn btn-outline" style={{ padding: '4px 8px', fontSize: 11, color: 'var(--dn)', borderColor: 'var(--dn)' }}>
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 6: REAL DATABASE SUBSCRIPTIONS */}
          {activeTab === 'subscriptions' && (
            <div style={{ background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 'var(--radius)', padding: 20 }}>
              <h3 style={{ fontSize: 16, fontWeight: 800, color: '#fff', marginBottom: 16 }}>
                Real Database Subscriptions ({subscriptions.length})
              </h3>

              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Sub ID</th>
                      <th>User</th>
                      <th>Plan</th>
                      <th>Status</th>
                      <th>Starts At</th>
                      <th>Expires At</th>
                      <th>Amount Paid</th>
                    </tr>
                  </thead>
                  <tbody>
                    {subscriptions.length === 0 ? (
                      <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--mut)', padding: 24 }}>No subscriptions found in database.</td></tr>
                    ) : (
                      subscriptions.map((s) => (
                        <tr key={s.id}>
                          <td style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12 }}>{s.id?.slice(0, 8)}...</td>
                          <td style={{ fontWeight: 700, color: '#fff' }}>
                            {s.user_name || 'Trader'}
                            <div style={{ fontSize: 11, color: 'var(--mut)' }}>{s.user_email}</div>
                          </td>
                          <td style={{ fontWeight: 700 }}>{s.plan_name}</td>
                          <td><span className={s.status === 'active' ? 'badge-up' : 'badge-gold'}>{s.status}</span></td>
                          <td style={{ color: 'var(--mut)', fontSize: 12 }}>{new Date(s.starts_at || Date.now()).toLocaleDateString()}</td>
                          <td style={{ color: 'var(--gold-bright)', fontWeight: 700, fontSize: 12 }}>{new Date(s.expires_at || Date.now()).toLocaleDateString()}</td>
                          <td style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 800 }}>${s.amount_paid} {s.currency || 'USD'}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 7: REFERRALS & PAYOUTS */}
          {activeTab === 'withdrawals' && (
            <div style={{ background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 'var(--radius)', padding: 20 }}>
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
                      <tr><td colSpan={8} style={{ textAlign: 'center', color: 'var(--mut)', padding: 24 }}>No affiliate payout claims.</td></tr>
                    ) : (
                      withdrawals.map((w) => (
                        <tr key={w.id}>
                          <td style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12 }}>{w.id}</td>
                          <td>{w.user_email || w.user_id}</td>
                          <td style={{ fontWeight: 800, color: '#fff' }}>${(w.amount || w.amount_requested)?.toFixed(2)}</td>
                          <td style={{ fontWeight: 800, color: 'var(--gold-bright)' }}>${(w.net_amount || (w.amount * 0.98))?.toFixed(2)}</td>
                          <td style={{ textTransform: 'capitalize' }}>{(w.method || 'momo')?.replace('_', ' ')}</td>
                          <td style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12 }}>{w.destination_account || w.payment_details}</td>
                          <td>
                            <span className={w.status === 'confirmed_paid' || w.status === 'approved' ? 'badge-up' : 'badge-gold'}>
                              {w.status?.replace('_', ' ')}
                            </span>
                          </td>
                          <td>
                            {w.status !== 'confirmed_paid' && w.status !== 'approved' && (
                              <button onClick={() => handleConfirmWithdrawal(w.id)} className="btn btn-buy" style={{ padding: '4px 8px', fontSize: 11 }}>
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
            <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 16, minHeight: 520 }}>
              {/* Threads Sidebar */}
              <div style={{ background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 'var(--radius)', padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--mut)', paddingBottom: 6, borderBottom: '1px solid var(--line)' }}>
                  TRADER CHAT THREADS ({threads.length})
                </div>

                {threads.length === 0 ? (
                  <div style={{ color: 'var(--mut)', fontSize: 12, textAlign: 'center', margin: 'auto 0' }}>No active conversations.</div>
                ) : (
                  threads.map((t) => {
                    const id = t.thread_id || t.orderId;
                    return (
                      <div
                        key={id}
                        onClick={() => handleSelectThread(id)}
                        style={{
                          background: selectedThread === id ? 'rgba(212,175,55,0.1)' : 'var(--panel-card)',
                          border: selectedThread === id ? '1px solid var(--gold)' : '1px solid var(--line)',
                          padding: 10,
                          borderRadius: 6,
                          cursor: 'pointer'
                        }}
                      >
                        <div style={{ fontSize: 12, fontWeight: 800, color: '#fff' }}>{t.trader_name || `Trader #${id?.slice(-6)}`}</div>
                        <div style={{ fontSize: 10, color: 'var(--gold-bright)' }}>{t.trader_email || id}</div>
                        <div style={{ fontSize: 11, color: 'var(--mut)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {t.last_message || 'Active conversation'}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Message Panel */}
              <div style={{ background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 'var(--radius)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                {selectedThread ? (
                  <>
                    <div style={{ padding: 14, background: 'var(--panel-card)', borderBottom: '1px solid var(--line)', fontSize: 13, fontWeight: 800, color: '#fff' }}>
                      Conversation: {selectedThread}
                    </div>

                    <div style={{ flex: 1, padding: 16, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {threadMessages.map((m, idx) => {
                        const isMe = m.sender_role === 'superadmin' || m.senderRole === 'superadmin' || m.sender_role === 'admin' || m.senderRole === 'admin';
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
                              {isMe ? '🛡️ Desk Support (You)' : (m.sender_name || 'Trader')}
                            </div>
                            <div style={{ color: '#fff' }}>{m.message}</div>
                          </div>
                        );
                      })}
                    </div>

                    <form onSubmit={handleSendAdminReply} style={{ display: 'flex', padding: 10, background: 'var(--panel-card)', borderTop: '1px solid var(--line)', gap: 8 }}>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Type response to trader..."
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
                    Select a trader conversation thread on the left to read and send replies.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 9: PLATFORM SETTINGS (DATABASE FIRST, ENV FALLBACK) */}
          {activeTab === 'settings' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 20 }}>
              {/* Flutterwave Payment Gateway */}
              <div style={{ background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 'var(--radius)', padding: 24 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <h3 style={{ fontSize: 16, fontWeight: 800, color: 'var(--gold-bright)', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Key size={18} /> Flutterwave Payment Gateway
                  </h3>
                  <span className="badge-gold" style={{ fontSize: 10 }}>{settingsOrigin}</span>
                </div>

                <form onSubmit={handleSaveFlutterwaveKeys}>
                  <div className="form-group">
                    <label className="form-label">Flutterwave Public Key</label>
                    <input type="text" className="form-control" value={flutterwavePublic} onChange={(e) => setFlutterwavePublic(e.target.value)} placeholder="FLWPUBK_TEST-..." required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Flutterwave Secret Key</label>
                    <input type="password" className="form-control" value={flutterwaveSecret} onChange={(e) => setFlutterwaveSecret(e.target.value)} placeholder="FLWSECK_TEST-..." required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Encryption Key</label>
                    <input type="text" className="form-control" value={flutterwaveEncryption} onChange={(e) => setFlutterwaveEncryption(e.target.value)} placeholder="Optional" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Webhook Hash Secret</label>
                    <input type="text" className="form-control" value={flutterwaveWebhook} onChange={(e) => setFlutterwaveWebhook(e.target.value)} placeholder="Secret hash" />
                  </div>
                  <button type="submit" className="btn btn-primary" disabled={savingSettings} style={{ width: '100%', padding: '12px', fontWeight: 800 }}>
                    <Save size={15} /> Save to Database (Permanent Override)
                  </button>
                </form>
              </div>

              {/* Google Drive Credentials */}
              <div style={{ background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 'var(--radius)', padding: 24 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <h3 style={{ fontSize: 16, fontWeight: 800, color: 'var(--gold-bright)', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Database size={18} /> Google Drive Cloud Storage
                  </h3>
                  <span className="badge-gold" style={{ fontSize: 10 }}>{settingsOrigin}</span>
                </div>

                <form onSubmit={handleSaveGdriveKeys}>
                  <div className="form-group">
                    <label className="form-label">OAuth2 Client ID</label>
                    <input type="text" className="form-control" value={gdriveClientId} onChange={(e) => setGdriveClientId(e.target.value)} placeholder="Client ID" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">OAuth2 Client Secret</label>
                    <input type="password" className="form-control" value={gdriveClientSecret} onChange={(e) => setGdriveClientSecret(e.target.value)} placeholder="Client Secret" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">OAuth2 Refresh Token</label>
                    <input type="password" className="form-control" value={gdriveRefreshToken} onChange={(e) => setGdriveRefreshToken(e.target.value)} placeholder="Refresh Token" />
                  </div>
                  <button type="submit" className="btn btn-primary" disabled={savingSettings} style={{ width: '100%', padding: '12px', fontWeight: 800 }}>
                    <Save size={15} /> Save to Database (Permanent Override)
                  </button>
                </form>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* USER EDIT MODAL */}
      {editUserModalOpen && (
        <div className="modal-overlay" onClick={() => setEditUserModalOpen(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ fontSize: 18, fontWeight: 800, color: '#fff', marginBottom: 12 }}>Edit Trader Account: {editingUser?.email}</h3>
            <form onSubmit={handleSaveUser}>
              <div className="form-group">
                <label className="form-label">Full Name</label>
                <input type="text" className="form-control" value={editUserName} onChange={(e) => setEditUserName(e.target.value)} required />
              </div>
              <div className="form-group">
                <label className="form-label">Phone Number</label>
                <input type="tel" className="form-control" value={editUserPhone} onChange={(e) => setEditUserPhone(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">User Role</label>
                <select className="form-control" value={editUserRole} onChange={(e) => setEditUserRole(e.target.value)}>
                  <option value="user">Trader (Standard User)</option>
                  <option value="admin">Administrator</option>
                  <option value="superadmin">Super Administrator</option>
                </select>
              </div>
              <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <input type="checkbox" id="userVipCheck" checked={editUserIsVip} onChange={(e) => setEditUserIsVip(e.target.checked)} />
                <label htmlFor="userVipCheck" style={{ fontSize: 13, color: '#fff', cursor: 'pointer' }}>Grant Active VIP Access</label>
              </div>
              {editUserIsVip && (
                <div className="form-group">
                  <label className="form-label">VIP Duration (Days)</label>
                  <input type="number" min="1" max="365" className="form-control" value={editUserVipDays} onChange={(e) => setEditUserVipDays(e.target.value)} />
                </div>
              )}
              <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>Save User Changes</button>
                <button type="button" onClick={() => setEditUserModalOpen(false)} className="btn btn-outline">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PLAN CREATE / EDIT MODAL */}
      {planModalOpen && (
        <div className="modal-overlay" onClick={() => setPlanModalOpen(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ fontSize: 18, fontWeight: 800, color: '#fff', marginBottom: 12 }}>{editingPlan ? 'Edit VIP Plan' : 'Create New VIP Plan'}</h3>
            <form onSubmit={handleSavePlan}>
              <div className="form-group">
                <label className="form-label">Plan Name</label>
                <input type="text" className="form-control" placeholder="e.g. 1 Month Standard" value={planName} onChange={(e) => setPlanName(e.target.value)} required />
              </div>
              <div className="form-group">
                <label className="form-label">Plan Slug (Identifier)</label>
                <input type="text" className="form-control" placeholder="e.g. 1-month" value={planSlug} onChange={(e) => setPlanSlug(e.target.value)} required />
              </div>
              <div className="form-group">
                <label className="form-label">Duration (Days)</label>
                <input type="number" min="1" className="form-control" value={planDays} onChange={(e) => setPlanDays(e.target.value)} required />
              </div>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Price in USD ($)</label>
                  <input type="number" step="0.01" className="form-control" value={planPriceUsd} onChange={(e) => setPlanPriceUsd(e.target.value)} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Price in RWF (FRw)</label>
                  <input type="number" step="100" className="form-control" value={planPriceRwf} onChange={(e) => setPlanPriceRwf(e.target.value)} required />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>Save Plan</button>
                <button type="button" onClick={() => setPlanModalOpen(false)} className="btn btn-outline">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PROOF VIEWER MODAL */}
      {viewProofUrl && (
        <div className="modal-overlay" onClick={() => setViewProofUrl(null)}>
          <div className="modal-card" style={{ maxWidth: 640 }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ fontSize: 16, fontWeight: 800, color: '#fff', marginBottom: 14 }}>Payment Screenshot Verification</h3>
            <img src={viewProofUrl} alt="Proof" style={{ width: '100%', maxHeight: '65vh', objectFit: 'contain', borderRadius: 6, border: '1px solid var(--line)' }} />
            <div style={{ marginTop: 14, textAlign: 'right' }}>
              <button onClick={() => setViewProofUrl(null)} className="btn btn-outline">Close Viewer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
