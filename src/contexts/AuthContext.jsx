import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useToast } from './ToastContext';

const AuthContext = createContext(null);

export function getDeviceFingerprint() {
  if (typeof window === 'undefined') return 'server_fp';
  let stored = localStorage.getItem('fds_dfp');
  if (stored) return stored;
  const nav = window.navigator || {};
  const scr = window.screen || {};
  const raw = [
    nav.userAgent || '',
    nav.language || '',
    scr.colorDepth || '',
    (scr.width || '') + 'x' + (scr.height || ''),
    new Date().getTimezoneOffset()
  ].join('###');
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    hash = ((hash << 5) - hash) + raw.charCodeAt(i);
    hash |= 0;
  }
  const fp = 'fp_' + Math.abs(hash).toString(36) + '_' + Math.random().toString(36).substring(2, 8);
  localStorage.setItem('fds_dfp', fp);
  return fp;
}

export function AuthProvider({ children }) {
  const { showToast, celebrate } = useToast();
  const [user, setUser] = useState(null);
  const [subscription, setSubscription] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem('token') || null);
  const [loading, setLoading] = useState(true);

  // Modal state
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState('login'); // 'login' | 'register' | 'otp' | 'forgot' | 'reset'
  const [pendingEmail, setPendingEmail] = useState('');

  const openAuth = useCallback((mode = 'login', email = '') => {
    setAuthModalMode(mode);
    if (email) setPendingEmail(email);
    setAuthModalOpen(true);
  }, []);

  const closeAuth = useCallback(() => {
    setAuthModalOpen(false);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
    setSubscription(null);
    showToast('Signed out successfully.', 'info');
  }, [showToast]);

  const refreshUser = useCallback(async (jwtToken = token) => {
    if (!jwtToken) {
      setUser(null);
      setSubscription(null);
      setLoading(false);
      return;
    }
    try {
      const res = await fetch('/api/auth/me', {
        headers: {
          Authorization: `Bearer ${jwtToken}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
        setSubscription(data.subscription);
      } else {
        localStorage.removeItem('token');
        setToken(null);
        setUser(null);
        setSubscription(null);
      }
    } catch (e) {
      console.error('Failed to verify token:', e);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    refreshUser(token);
  }, [token, refreshUser]);

  const login = async (email, password) => {
    try {
      const fp = getDeviceFingerprint();
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, deviceFingerprint: fp })
      });
      const data = await res.json();

      if (!res.ok) {
        if (data.unverified || res.status === 403) {
          setPendingEmail(data.email || email);
          setAuthModalMode('otp');
          showToast(data.error || 'Please verify your email address.', 'warning');
          return { unverified: true, email: data.email || email };
        }
        throw new Error(data.error || 'Login failed');
      }

      localStorage.setItem('token', data.token);
      setToken(data.token);
      setUser(data.user);
      setSubscription(data.subscription || null);
      closeAuth();
      showToast(`Welcome back, ${data.user.name || data.user.email}!`, 'success');
      return { success: true };
    } catch (err) {
      showToast(err.message, 'error');
      throw err;
    }
  };

  const register = async (formData) => {
    try {
      const fp = getDeviceFingerprint();
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, deviceFingerprint: fp })
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Registration failed');
      }

      setPendingEmail(formData.email);
      setAuthModalMode('otp');
      showToast('Account created! Please enter the 6-digit verification code sent to your email.', 'success');
      return { success: true };
    } catch (err) {
      showToast(err.message, 'error');
      throw err;
    }
  };

  const verifyEmail = async (email, code) => {
    try {
      const res = await fetch('/api/auth/verify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code })
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Verification code invalid or expired');
      }

      if (data.token) {
        localStorage.setItem('token', data.token);
        setToken(data.token);
        setUser(data.user);
        setSubscription(data.subscription || null);
        closeAuth();
        celebrate();
        showToast('Email verified! You now have active VIP access.', 'success');
      } else {
        setAuthModalMode('login');
        showToast('Email verified successfully! Please sign in.', 'success');
      }
      return { success: true };
    } catch (err) {
      showToast(err.message, 'error');
      throw err;
    }
  };

  const resendCode = async (email) => {
    try {
      const res = await fetch('/api/auth/resend-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to resend code');
      showToast('A new 6-digit verification code has been dispatched to your email.', 'info');
      return { success: true };
    } catch (err) {
      showToast(err.message, 'error');
      throw err;
    }
  };

  const forgotPassword = async (email) => {
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to request reset');
      setPendingEmail(email);
      setAuthModalMode('reset');
      showToast('Password reset code sent to your email.', 'info');
      return { success: true };
    } catch (err) {
      showToast(err.message, 'error');
      throw err;
    }
  };

  const resetPassword = async (email, code, newPassword) => {
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code, newPassword })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to reset password');
      setAuthModalMode('login');
      showToast('Password reset successful! Please sign in with your new credentials.', 'success');
      return { success: true };
    } catch (err) {
      showToast(err.message, 'error');
      throw err;
    }
  };

  const isAdmin = user && (user.role === 'admin' || user.role === 'superadmin' || user.email === 'benirabok@gmail.com' || user.email === 'omarrukwaya@gmail.com');

  return (
    <AuthContext.Provider
      value={{
        user,
        subscription,
        token,
        loading,
        isAuthenticated: !!user,
        isAdmin,
        authModalOpen,
        authModalMode,
        pendingEmail,
        setPendingEmail,
        openAuth,
        closeAuth,
        setAuthModalMode,
        login,
        register,
        verifyEmail,
        resendCode,
        forgotPassword,
        resetPassword,
        logout,
        refreshUser
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
