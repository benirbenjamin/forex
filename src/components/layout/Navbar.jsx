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
  ChevronDown,
  Layers,
  Sparkles
} from 'lucide-react';

export default function Navbar() {
  const { user, subscription, isAuthenticated, isAdmin, openAuth, logout } = useAuth();
  const {
    activeSymbol,
    setActiveSymbol,
    activeCurrency,
    changeCurrency,
    rates,
    soundEnabled,
    toggleSound,
    notifications,
    clearNotifications
  } = useMarket();

  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef(null);
  const navigate = useNavigate();

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
      background: 'rgba(11, 14, 20, 0.95)',
      backdropFilter: 'blur(12px)',
      borderBottom: '1px solid var(--line)',
      position: 'sticky',
      top: 0,
      zIndex: 1000
    }}>
      <div style={{
        maxWidth: 1320,
        margin: '0 auto',
        padding: '12px 18px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 12
      }}>
        {/* Brand & Symbol Switcher */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
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
              color: '#0b0e14'
            }}>
              <Zap size={20} strokeWidth={2.5} />
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, letterSpacing: -0.2, color: '#fff', display: 'flex', alignItems: 'center', gap: 6 }}>
                ForexDoubleSniper
                <span className="badge-gold" style={{ fontSize: 9, padding: '1px 5px' }}>INSTITUTIONAL</span>
              </div>
              <div style={{ fontSize: 10, color: 'var(--mut)', fontWeight: 600 }}>SWIFTEDGE ORDER FLOW CORE</div>
            </div>
          </Link>

          {/* Symbol Toggle */}
          <div style={{
            display: 'inline-flex',
            background: 'var(--panel)',
            border: '1px solid var(--line)',
            borderRadius: 'var(--radius-sm)',
            padding: 2
          }}>
            <button
              onClick={() => setActiveSymbol('XAUUSD')}
              style={{
                background: activeSymbol === 'XAUUSD' ? 'var(--gold)' : 'transparent',
                color: activeSymbol === 'XAUUSD' ? '#0b0e14' : 'var(--mut)',
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                padding: '4px 10px',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              🟡 XAU/USD (Gold)
            </button>
            <button
              onClick={() => setActiveSymbol('BTCUSD')}
              style={{
                background: activeSymbol === 'BTCUSD' ? 'var(--gold)' : 'transparent',
                color: activeSymbol === 'BTCUSD' ? '#0b0e14' : 'var(--mut)',
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                padding: '4px 10px',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              🟠 BTC/USD (Bitcoin)
            </button>
          </div>
        </div>

        {/* Navigation Links */}
        <nav style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
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
          {isAdmin && (
            <NavLink
              to="/admin"
              className={({ isActive }) => `nav-tab-btn ${isActive ? 'active' : ''}`}
              style={{ color: 'var(--gold-bright)', borderColor: 'rgba(212,175,55,0.4)' }}
            >
              <ShieldAlert size={15} />
              <span>Admin Console</span>
            </NavLink>
          )}
        </nav>

        {/* Global Controls & Auth */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
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
            style={{ padding: '6px 10px', fontSize: 12 }}
            title={soundEnabled ? 'Sound ON (Click to Mute)' : 'Sound Muted (Click to Enable)'}
          >
            {soundEnabled ? (
              <Volume2 size={16} style={{ color: 'var(--up)' }} />
            ) : (
              <VolumeX size={16} style={{ color: 'var(--mut)' }} />
            )}
          </button>

          {/* Notifications Dropdown */}
          <div style={{ position: 'relative' }} ref={notifRef}>
            <button
              onClick={() => setNotifOpen(!notifOpen)}
              className="btn btn-outline"
              style={{ padding: '6px 10px', position: 'relative' }}
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
                position: 'absolute',
                top: 40,
                right: 0,
                width: 320,
                background: 'var(--panel)',
                border: '1px solid var(--line-light)',
                borderRadius: 'var(--radius)',
                padding: 12,
                boxShadow: '0 12px 30px rgba(0,0,0,0.7)',
                zIndex: 1050
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, paddingBottom: 6, borderBottom: '1px solid var(--line)' }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--mut)' }}>NOTIFICATIONS</span>
                  {notifications.length > 0 && (
                    <button
                      onClick={clearNotifications}
                      style={{ background: 'none', border: 'none', color: 'var(--mut)', fontSize: 11, cursor: 'pointer' }}
                    >
                      Clear
                    </button>
                  )}
                </div>

                <div style={{ maxHeight: 280, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {notifications.length === 0 ? (
                    <div style={{ textAlign: 'center', color: 'var(--mut)', fontSize: 12, padding: '16px 0' }}>
                      No new market alerts.
                    </div>
                  ) : (
                    notifications.map((n) => (
                      <div
                        key={n.id}
                        style={{
                          background: 'var(--panel-card)',
                          padding: '8px 10px',
                          borderRadius: 4,
                          fontSize: 12,
                          borderLeft: `3px solid ${n.type === 'opportunity' ? 'var(--up)' : n.type === 'exit' ? 'var(--dn)' : 'var(--gold)'}`
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
                          <span style={{ color: '#fff' }}>{n.title}</span>
                          <span style={{ color: 'var(--mut)', fontSize: 10 }}>{n.time}</span>
                        </div>
                        <div style={{ color: 'var(--mut)', fontSize: 11, marginTop: 2 }}>{n.message}</div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* User Auth Info */}
          {isAuthenticated ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {/* VIP badge */}
              {subscription?.hasAccess ? (
                <div
                  onClick={() => navigate('/subscriptions')}
                  style={{
                    cursor: 'pointer',
                    background: 'rgba(212, 175, 55, 0.15)',
                    border: '1px solid var(--gold)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '4px 8px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-end',
                    lineHeight: 1.1
                  }}
                  title="VIP Access Active"
                >
                  <span style={{ color: 'var(--gold-bright)', fontSize: 11, fontWeight: 800 }}>
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
                  style={{ padding: '6px 12px', fontSize: 12 }}
                >
                  Upgrade VIP
                </button>
              )}

              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  background: 'var(--panel-card)',
                  border: '1px solid var(--line)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--gold-bright)',
                  fontSize: 13,
                  fontWeight: 700
                }}>
                  {user?.name ? user.name[0].toUpperCase() : user?.email[0].toUpperCase()}
                </div>
                <button
                  onClick={logout}
                  className="btn btn-outline"
                  style={{ padding: '6px 10px', fontSize: 12 }}
                  title="Sign Out"
                >
                  <LogOut size={15} />
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                onClick={() => openAuth('login')}
                className="btn btn-outline"
                style={{ padding: '6px 12px', fontSize: 12 }}
              >
                Sign In
              </button>
              <button
                onClick={() => openAuth('register')}
                className="btn btn-primary"
                style={{ padding: '6px 14px', fontSize: 12 }}
              >
                Get 7-Days Free VIP
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
