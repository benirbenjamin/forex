import React, { useState, useRef, useEffect } from 'react';
import { NavLink, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useMarket } from '../../contexts/MarketContext';
import {
  TrendingUp,
  Volume2,
  VolumeX,
  Bell,
  User,
  LogOut,
  ShieldAlert,
  Zap,
  Activity,
  Layers,
  Sparkles,
  Menu,
  X,
  Lock
} from 'lucide-react';

export default function Navbar() {
  const { user, subscription, isAuthenticated, isAdmin, openAuth, logout } = useAuth();
  const {
    activeCurrency,
    changeCurrency,
    rates,
    soundEnabled,
    toggleSound,
    notifications,
    clearNotifications
  } = useMarket();

  const [notifOpen, setNotifOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const notifRef = useRef(null);
  const notifBtnRef = useRef(null);
  const [notifPos, setNotifPos] = useState({ top: 52, left: 12, width: 340 });
  const navigate = useNavigate();

  const toggleNotif = () => {
    if (!notifOpen && notifBtnRef.current) {
      const rect = notifBtnRef.current.getBoundingClientRect();
      const width = Math.min(340, window.innerWidth - 24);
      let left = rect.right - width;
      if (left < 12) left = 12;
      if (left + width > window.innerWidth - 12) {
        left = window.innerWidth - width - 12;
      }
      setNotifPos({
        top: Math.round(rect.bottom + 8),
        left: Math.round(left),
        width: Math.round(width)
      });
    }
    setNotifOpen(!notifOpen);
  };

  // Close notifications on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setNotifOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header style={{
      background: 'rgba(11, 14, 20, 0.96)',
      backdropFilter: 'blur(12px)',
      borderBottom: '1px solid var(--line)',
      position: 'sticky',
      top: 0,
      zIndex: 1000
    }}>
      <div style={{
        maxWidth: 1320,
        margin: '0 auto',
        padding: '10px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 10
      }}>
        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
            <div style={{
              width: 34,
              height: 34,
              borderRadius: 8,
              background: 'linear-gradient(135deg, #d4af37, #855800)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 14px rgba(212,175,55,0.4)',
              color: '#0b0e14',
              flexShrink: 0
            }}>
              <Zap size={20} strokeWidth={2.5} />
            </div>
            <div>
              <div className="navbar-brand-text" style={{ fontSize: 16, fontWeight: 800, letterSpacing: -0.2, color: '#fff', display: 'flex', alignItems: 'center', gap: 6 }}>
                ForexDoubleSniper
                <span className="badge-gold navbar-institutional-badge" style={{ fontSize: 9, padding: '1px 5px' }}>INSTITUTIONAL</span>
              </div>
              <div className="navbar-subtitle" style={{ fontSize: 10, color: 'var(--mut)', fontWeight: 600 }}>SWIFTEDGE ORDER FLOW CORE</div>
            </div>
          </Link>
        </div>

        {/* Desktop Navigation Links (hidden on small screens via CSS/conditional) */}
        <nav className="desktop-nav" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <NavLink
            to="/"
            end
            className={({ isActive }) => `nav-tab-btn ${isActive ? 'active' : ''}`}
          >
            <TrendingUp size={15} />
            <span>Signals</span>
          </NavLink>
          <NavLink
            to="/simulator"
            className={({ isActive }) => `nav-tab-btn ${isActive ? 'active' : ''}`}
          >
            <Activity size={15} />
            <span>Simulator</span>
          </NavLink>
          <NavLink
            to="/p2p"
            className={({ isActive }) => `nav-tab-btn ${isActive ? 'active' : ''}`}
          >
            <Layers size={15} />
            <span>P2P Crypto</span>
          </NavLink>
          <NavLink
            to="/subscriptions"
            className={({ isActive }) => `nav-tab-btn ${isActive ? 'active' : ''}`}
          >
            <Sparkles size={15} />
            <span>VIP Plans</span>
          </NavLink>
          <NavLink
            to="/referrals"
            className={({ isActive }) => `nav-tab-btn ${isActive ? 'active' : ''}`}
          >
            <User size={15} />
            <span>Affiliates</span>
          </NavLink>

          {/* Desktop Admin Console Button */}
          {isAdmin ? (
            <NavLink
              to="/admin"
              className={({ isActive }) => `nav-tab-btn ${isActive ? 'active' : ''}`}
              style={{ color: 'var(--gold-bright)', borderColor: 'rgba(212,175,55,0.5)', background: 'rgba(212,175,55,0.1)' }}
            >
              <ShieldAlert size={15} />
              <span>Admin Console</span>
            </NavLink>
          ) : (
            <Link
              to="/admin"
              className="nav-tab-btn"
              style={{ color: 'var(--mut)', fontSize: 11 }}
              title="Admin Login Portal"
            >
              <Lock size={13} />
              <span>Admin Portal</span>
            </Link>
          )}
        </nav>

        {/* Global Controls & Auth */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div className="navbar-controls" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Currency Selector */}
          <select
            value={activeCurrency}
            onChange={(e) => changeCurrency(e.target.value)}
            style={{
              background: 'var(--panel)',
              border: '1px solid var(--line)',
              color: 'var(--gold-bright)',
              borderRadius: 'var(--radius-sm)',
              padding: '6px 8px',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              outline: 'none'
            }}
          >
            {Object.keys(rates).map((curr) => (
              <option key={curr} value={curr}>
                {curr}
              </option>
            ))}
          </select>

          {/* Sound Toggle */}
          <button
            onClick={toggleSound}
            className="btn btn-outline"
            style={{ padding: '6px 8px', fontSize: 12 }}
            title={soundEnabled ? 'Sound ON (Click to Mute)' : 'Sound Muted (Click to Enable)'}
          >
            {soundEnabled ? (
              <Volume2 size={16} style={{ color: 'var(--up)' }} />
            ) : (
              <VolumeX size={16} style={{ color: 'var(--mut)' }} />
            )}
          </button>

          {/* Notifications Dropdown (Fixed within viewport, never overflows!) */}
          <div style={{ position: 'relative' }} ref={notifRef}>
            <button
              ref={notifBtnRef}
              onClick={toggleNotif}
              className="btn btn-outline"
              style={{ padding: '6px 8px', position: 'relative' }}
              title="Notifications"
            >
              <Bell size={16} />
              {notifications.length > 0 && (
                <span style={{
                  position: 'absolute',
                  top: -4,
                  right: -4,
                  background: 'var(--gold)',
                  color: '#0b0e14',
                  fontSize: 10,
                  fontWeight: 800,
                  borderRadius: 10,
                  minWidth: 16,
                  height: 16,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '0 3px'
                }}>
                  {notifications.length}
                </span>
              )}
            </button>

            {notifOpen && (
              <div style={{
                position: 'fixed',
                top: notifPos.top,
                left: notifPos.left,
                width: notifPos.width,
                maxWidth: 'calc(100vw - 24px)',
                background: 'var(--panel)',
                border: '1px solid var(--line-light)',
                borderRadius: 'var(--radius)',
                padding: 14,
                boxShadow: '0 16px 40px rgba(0,0,0,0.8), 0 0 20px rgba(212,175,55,0.1)',
                zIndex: 1050
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, paddingBottom: 6, borderBottom: '1px solid var(--line)' }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--mut)' }}>MARKET & SIGNAL ALERTS</span>
                  {notifications.length > 0 && (
                    <button
                      onClick={clearNotifications}
                      style={{ background: 'none', border: 'none', color: 'var(--mut)', fontSize: 11, cursor: 'pointer' }}
                    >
                      Clear All
                    </button>
                  )}
                </div>

                <div style={{ maxHeight: 300, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {notifications.length === 0 ? (
                    <div style={{ textAlign: 'center', color: 'var(--mut)', fontSize: 12, padding: '20px 0' }}>
                      No new market alerts. Valid signals will notify here.
                    </div>
                  ) : (
                    notifications.map((n) => (
                      <div
                        key={n.id}
                        style={{
                          background: 'var(--panel-card)',
                          padding: '10px',
                          borderRadius: 6,
                          fontSize: 12,
                          borderLeft: `3px solid ${n.type === 'opportunity' ? 'var(--up)' : n.type === 'exit' ? 'var(--dn)' : 'var(--gold)'}`
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
                          <span style={{ color: '#fff' }}>{n.title}</span>
                          <span style={{ color: 'var(--mut)', fontSize: 10 }}>{n.time}</span>
                        </div>
                        <div style={{ color: '#d1d5db', fontSize: 11, marginTop: 3, lineHeight: 1.4 }}>{n.message}</div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
          </div>

          {/* User Auth Info (Desktop) */}
          {isAuthenticated ? (
            <div className="desktop-auth" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {subscription?.hasAccess ? (
                <div
                  onClick={() => navigate('/subscriptions')}
                  style={{
                    cursor: 'pointer',
                    background: 'rgba(212, 175, 55, 0.15)',
                    border: '1px solid var(--gold)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '3px 7px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-end',
                    lineHeight: 1.1
                  }}
                  title="VIP Access Active"
                >
                  <span style={{ color: 'var(--gold-bright)', fontSize: 10, fontWeight: 800 }}>
                    ⭐ {subscription.status === 'admin' ? 'SUPERADMIN' : 'VIP ACTIVE'}
                  </span>
                  <span style={{ color: 'var(--mut)', fontSize: 9 }}>
                    {subscription.status === 'admin' ? 'Lifetime' : `${subscription.remainingDays || 0}d left`}
                  </span>
                </div>
              ) : (
                <button
                  onClick={() => navigate('/subscriptions')}
                  className="btn btn-primary"
                  style={{ padding: '5px 10px', fontSize: 11 }}
                >
                  Upgrade
                </button>
              )}

              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <div style={{
                  width: 30,
                  height: 30,
                  borderRadius: '50%',
                  background: 'var(--panel-card)',
                  border: '1px solid var(--line)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--gold-bright)',
                  fontSize: 12,
                  fontWeight: 700
                }}>
                  {user?.name ? user.name[0].toUpperCase() : user?.email[0].toUpperCase()}
                </div>
                <button
                  onClick={logout}
                  className="btn btn-outline"
                  style={{ padding: '5px 8px' }}
                  title="Sign Out"
                >
                  <LogOut size={14} />
                </button>
              </div>
            </div>
          ) : (
            <div className="desktop-auth" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <button
                onClick={() => openAuth('login')}
                className="btn btn-outline"
                style={{ padding: '6px 10px', fontSize: 12 }}
              >
                Sign In
              </button>
              <button
                onClick={() => openAuth('register')}
                className="btn btn-primary"
                style={{ padding: '6px 12px', fontSize: 12 }}
              >
                Get 7-Days Free VIP
              </button>
            </div>
          )}

          {/* Mobile Menu Hamburger Toggle */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="mobile-menu-toggle btn btn-outline"
            style={{ padding: '6px 8px' }}
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div style={{
          background: 'var(--panel)',
          borderBottom: '1px solid var(--line)',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: 10
        }} className="mobile-drawer">
          {/* Prominent Admin Access Button in Mobile View */}
          <Link
            to="/admin"
            onClick={() => setMobileMenuOpen(false)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              padding: '10px 14px',
              borderRadius: 6,
              background: 'rgba(212, 175, 55, 0.15)',
              border: '1px solid var(--gold)',
              color: 'var(--gold-bright)',
              fontWeight: 800,
              fontSize: 13,
              textDecoration: 'none',
              marginBottom: 6
            }}
          >
            <ShieldAlert size={16} />
            <span>Admin Console Access</span>
          </Link>

          <NavLink
            to="/"
            end
            onClick={() => setMobileMenuOpen(false)}
            className={({ isActive }) => `nav-tab-btn ${isActive ? 'active' : ''}`}
            style={{ width: '100%', justifyContent: 'flex-start', padding: '10px 14px' }}
          >
            <TrendingUp size={16} />
            <span>Trading Signals</span>
          </NavLink>

          <NavLink
            to="/simulator"
            onClick={() => setMobileMenuOpen(false)}
            className={({ isActive }) => `nav-tab-btn ${isActive ? 'active' : ''}`}
            style={{ width: '100%', justifyContent: 'flex-start', padding: '10px 14px' }}
          >
            <Activity size={16} />
            <span>Trading Simulator</span>
          </NavLink>

          <NavLink
            to="/p2p"
            onClick={() => setMobileMenuOpen(false)}
            className={({ isActive }) => `nav-tab-btn ${isActive ? 'active' : ''}`}
            style={{ width: '100%', justifyContent: 'flex-start', padding: '10px 14px' }}
          >
            <Layers size={16} />
            <span>Crypto P2P Gateway</span>
          </NavLink>

          <NavLink
            to="/subscriptions"
            onClick={() => setMobileMenuOpen(false)}
            className={({ isActive }) => `nav-tab-btn ${isActive ? 'active' : ''}`}
            style={{ width: '100%', justifyContent: 'flex-start', padding: '10px 14px' }}
          >
            <Sparkles size={16} />
            <span>VIP Plans & Pricing</span>
          </NavLink>

          <NavLink
            to="/referrals"
            onClick={() => setMobileMenuOpen(false)}
            className={({ isActive }) => `nav-tab-btn ${isActive ? 'active' : ''}`}
            style={{ width: '100%', justifyContent: 'flex-start', padding: '10px 14px' }}
          >
            <User size={16} />
            <span>Affiliate Console</span>
          </NavLink>

          {/* Mobile Controls (moved from header on small screens) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, borderTop: '1px solid var(--line)', paddingTop: 12, marginTop: 4 }}>
            <span style={{ fontSize: 12, color: 'var(--mut)', fontWeight: 700 }}>Currency</span>
            <select
              value={activeCurrency}
              onChange={(e) => changeCurrency(e.target.value)}
              style={{ flex: 1, background: 'var(--panel-card)', border: '1px solid var(--line)', color: 'var(--gold-bright)', borderRadius: 'var(--radius-sm)', padding: '8px 10px', fontSize: 13, fontWeight: 700, outline: 'none' }}
            >
              {Object.keys(rates).map((curr) => (
                <option key={curr} value={curr}>{curr}</option>
              ))}
            </select>
            <button onClick={toggleSound} className="btn btn-outline" style={{ padding: '8px 10px' }}>
              {soundEnabled ? <Volume2 size={16} style={{ color: 'var(--up)' }} /> : <VolumeX size={16} style={{ color: 'var(--mut)' }} />}
              <span>{soundEnabled ? 'Sound On' : 'Muted'}</span>
            </button>
          </div>

          {/* Mobile Notifications */}
          <div style={{ borderTop: '1px solid var(--line)', paddingTop: 12, marginTop: 4 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--mut)' }}>MARKET ALERTS ({notifications.length})</span>
              {notifications.length > 0 && (
                <button onClick={clearNotifications} style={{ background: 'none', border: 'none', color: 'var(--mut)', fontSize: 11, cursor: 'pointer' }}>Clear All</button>
              )}
            </div>
            <div style={{ maxHeight: 220, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {notifications.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--mut)', fontSize: 12, padding: '10px 0' }}>
                  No new market alerts. Valid signals will notify here.
                </div>
              ) : (
                notifications.map((n) => (
                  <div key={n.id} style={{ background: 'var(--panel-card)', padding: '10px', borderRadius: 6, fontSize: 12, borderLeft: `3px solid ${n.type === 'opportunity' ? 'var(--up)' : n.type === 'exit' ? 'var(--dn)' : 'var(--gold)'}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
                      <span style={{ color: '#fff' }}>{n.title}</span>
                      <span style={{ color: 'var(--mut)', fontSize: 10 }}>{n.time}</span>
                    </div>
                    <div style={{ color: '#d1d5db', fontSize: 11, marginTop: 3, lineHeight: 1.4 }}>{n.message}</div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Mobile Auth Actions */}
          <div style={{ borderTop: '1px solid var(--line)', paddingTop: 12, marginTop: 4 }}>
            {isAuthenticated ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ fontSize: 12, color: 'var(--mut)' }}>
                  Signed in as: <strong style={{ color: '#fff' }}>{user?.email}</strong>
                </div>
                <button
                  onClick={() => { logout(); setMobileMenuOpen(false); }}
                  className="btn btn-outline"
                  style={{ width: '100%', justifyContent: 'center' }}
                >
                  <LogOut size={15} />
                  <span>Sign Out</span>
                </button>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <button
                  onClick={() => { openAuth('login'); setMobileMenuOpen(false); }}
                  className="btn btn-outline"
                  style={{ padding: '10px', fontSize: 13 }}
                >
                  Sign In
                </button>
                <button
                  onClick={() => { openAuth('register'); setMobileMenuOpen(false); }}
                  className="btn btn-primary"
                  style={{ padding: '10px', fontSize: 13 }}
                >
                  Get VIP Trial
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
