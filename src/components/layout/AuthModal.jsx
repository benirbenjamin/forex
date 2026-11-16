import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { X, Lock, Mail, User, Phone, KeyRound, ArrowRight, ShieldCheck, RefreshCw } from 'lucide-react';

export default function AuthModal() {
  const {
    authModalOpen,
    authModalMode,
    pendingEmail,
    setPendingEmail,
    closeAuth,
    setAuthModalMode,
    login,
    register,
    verifyEmail,
    resendCode,
    forgotPassword,
    resetPassword
  } = useAuth();

  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [referralCode, setReferralCode] = useState('');

  // OTP state: MUST START EMPTY! NO PRE-FILLED CODE!
  const [otpCode, setOtpCode] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const [loading, setLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  if (!authModalOpen) return null;

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
    } catch (err) {
      // toast shown in context
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await register({
        fullName,
        email,
        phone,
        password,
        referralCode: referralCode || undefined
      });
      // reset OTP field to ensure empty input
      setOtpCode('');
    } catch (err) {
      // toast shown in context
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await verifyEmail(pendingEmail || email, otpCode.trim());
    } catch (err) {
      // toast shown in context
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;
    try {
      await resendCode(pendingEmail || email);
      setResendCooldown(60);
      const timer = setInterval(() => {
        setResendCooldown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (err) {
      // toast shown in context
    }
  };

  const handleForgot = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await forgotPassword(email);
    } catch (err) {
      // toast shown in context
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await resetPassword(pendingEmail || email, otpCode.trim(), newPassword);
    } catch (err) {
      // toast shown in context
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={closeAuth}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={closeAuth}
          style={{
            position: 'absolute',
            top: 18,
            right: 18,
            background: 'transparent',
            border: 'none',
            color: 'var(--mut)',
            cursor: 'pointer'
          }}
        >
          <X size={20} />
        </button>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{
            width: 44,
            height: 44,
            borderRadius: '50%',
            background: 'rgba(212, 175, 55, 0.15)',
            border: '1px solid var(--gold)',
            color: 'var(--gold-bright)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 10
          }}>
            {authModalMode === 'otp' ? <ShieldCheck size={24} /> : <Lock size={22} />}
          </div>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: '#fff' }}>
            {authModalMode === 'login' && 'Sign In to Terminal'}
            {authModalMode === 'register' && 'Create VIP Trader Account'}
            {authModalMode === 'otp' && 'Verify Your Email'}
            {authModalMode === 'forgot' && 'Reset Password'}
            {authModalMode === 'reset' && 'Create New Password'}
          </h2>
          <p style={{ fontSize: 13, color: 'var(--mut)', marginTop: 4 }}>
            {authModalMode === 'login' && 'Access institutional signals, realistic simulator, and P2P gateway.'}
            {authModalMode === 'register' && 'Claim instant 7-Days Free VIP Access on registration.'}
            {authModalMode === 'otp' && `Enter the 6-digit verification code sent to ${pendingEmail || email || 'your email'}.`}
            {authModalMode === 'forgot' && 'Enter your email address to receive a password reset code.'}
            {authModalMode === 'reset' && 'Enter your verification code and choose a new password.'}
          </p>
        </div>

        {/* TAB 1: LOGIN */}
        {authModalMode === 'login' && (
          <form onSubmit={handleLogin}>
            <div className="form-group">
              <label className="form-label">Email Address</label>
              <div style={{ position: 'relative' }}>
                <input
                  type="email"
                  className="form-control"
                  style={{ paddingLeft: 36 }}
                  placeholder="name@domain.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
                <Mail size={16} style={{ position: 'absolute', left: 12, top: 12, color: 'var(--mut)' }} />
              </div>
            </div>

            <div className="form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <label className="form-label" style={{ marginBottom: 0 }}>Password</label>
                <button
                  type="button"
                  onClick={() => setAuthModalMode('forgot')}
                  style={{ background: 'none', border: 'none', color: 'var(--gold-bright)', fontSize: 11, cursor: 'pointer' }}
                >
                  Forgot?
                </button>
              </div>
              <div style={{ position: 'relative' }}>
                <input
                  type="password"
                  className="form-control"
                  style={{ paddingLeft: 36 }}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <Lock size={16} style={{ position: 'absolute', left: 12, top: 12, color: 'var(--mut)' }} />
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
              style={{ width: '100%', padding: '12px', fontSize: 14, marginTop: 8 }}
            >
              {loading ? 'Authenticating...' : 'Sign In Now'}
            </button>

            <div style={{ textAlign: 'center', marginTop: 18, fontSize: 13, color: 'var(--mut)' }}>
              Don't have an account?{' '}
              <button
                type="button"
                onClick={() => setAuthModalMode('register')}
                style={{ background: 'none', border: 'none', color: 'var(--gold-bright)', fontWeight: 700, cursor: 'pointer' }}
              >
                Create Account (7 Days Free)
              </button>
            </div>
          </form>
        )}

        {/* TAB 2: REGISTER */}
        {authModalMode === 'register' && (
          <form onSubmit={handleRegister}>
            <div className="form-group">
              <label className="form-label">Full Name</label>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  className="form-control"
                  style={{ paddingLeft: 36 }}
                  placeholder="Alex Morgan"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />
                <User size={16} style={{ position: 'absolute', left: 12, top: 12, color: 'var(--mut)' }} />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Email Address</label>
              <div style={{ position: 'relative' }}>
                <input
                  type="email"
                  className="form-control"
                  style={{ paddingLeft: 36 }}
                  placeholder="alex@domain.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
                <Mail size={16} style={{ position: 'absolute', left: 12, top: 12, color: 'var(--mut)' }} />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Phone Number (Optional)</label>
              <div style={{ position: 'relative' }}>
                <input
                  type="tel"
                  className="form-control"
                  style={{ paddingLeft: 36 }}
                  placeholder="+250 788 123 456"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
                <Phone size={16} style={{ position: 'absolute', left: 12, top: 12, color: 'var(--mut)' }} />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  type="password"
                  className="form-control"
                  style={{ paddingLeft: 36 }}
                  placeholder="At least 6 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                />
                <Lock size={16} style={{ position: 'absolute', left: 12, top: 12, color: 'var(--mut)' }} />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Affiliate / Referral Code (Optional)</label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. VIPGOLD"
                value={referralCode}
                onChange={(e) => setReferralCode(e.target.value)}
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
              style={{ width: '100%', padding: '12px', fontSize: 14, marginTop: 8 }}
            >
              {loading ? 'Creating Account...' : 'Get 7-Days Free VIP Access'}
            </button>

            <div style={{ textAlign: 'center', marginTop: 18, fontSize: 13, color: 'var(--mut)' }}>
              Already registered?{' '}
              <button
                type="button"
                onClick={() => setAuthModalMode('login')}
                style={{ background: 'none', border: 'none', color: 'var(--gold-bright)', fontWeight: 700, cursor: 'pointer' }}
              >
                Sign In
              </button>
            </div>
          </form>
        )}

        {/* TAB 3: OTP VERIFICATION (NO PRE-FILLED CODE!) */}
        {authModalMode === 'otp' && (
          <form onSubmit={handleVerifyOtp}>
            <div style={{
              background: 'rgba(212, 175, 55, 0.08)',
              border: '1px solid rgba(212, 175, 55, 0.25)',
              borderRadius: 6,
              padding: 12,
              marginBottom: 16,
              fontSize: 12,
              color: 'var(--gold-bright)',
              lineHeight: 1.5
            }}>
              ✉️ A 6-digit confirmation code was sent to <strong>{pendingEmail || email}</strong>.
              Please check your inbox or spam folder and enter it below.
            </div>

            <div className="form-group">
              <label className="form-label" style={{ textAlign: 'center' }}>
                Enter 6-Digit Verification Code
              </label>
              <input
                type="text"
                maxLength={6}
                className="form-control"
                style={{
                  textAlign: 'center',
                  fontSize: 24,
                  letterSpacing: 8,
                  fontWeight: 800,
                  color: 'var(--gold-bright)'
                }}
                placeholder="------"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                autoFocus
                required
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading || otpCode.length < 6}
              style={{ width: '100%', padding: '12px', fontSize: 14, marginTop: 10 }}
            >
              {loading ? 'Verifying Code...' : 'Confirm & Unlock VIP Access'}
            </button>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, fontSize: 12 }}>
              <button
                type="button"
                onClick={handleResend}
                disabled={resendCooldown > 0}
                style={{
                  background: 'none',
                  border: 'none',
                  color: resendCooldown > 0 ? 'var(--mut)' : 'var(--gold-bright)',
                  cursor: resendCooldown > 0 ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4
                }}
              >
                <RefreshCw size={13} />
                {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend Code'}
              </button>

              <button
                type="button"
                onClick={() => setAuthModalMode('login')}
                style={{ background: 'none', border: 'none', color: 'var(--mut)', cursor: 'pointer' }}
              >
                Back to Sign In
              </button>
            </div>
          </form>
        )}

        {/* TAB 4: FORGOT PASSWORD */}
        {authModalMode === 'forgot' && (
          <form onSubmit={handleForgot}>
            <div className="form-group">
              <label className="form-label">Email Address</label>
              <div style={{ position: 'relative' }}>
                <input
                  type="email"
                  className="form-control"
                  style={{ paddingLeft: 36 }}
                  placeholder="name@domain.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
                <Mail size={16} style={{ position: 'absolute', left: 12, top: 12, color: 'var(--mut)' }} />
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
              style={{ width: '100%', padding: '12px', fontSize: 14, marginTop: 8 }}
            >
              {loading ? 'Sending Code...' : 'Send Password Reset Code'}
            </button>

            <div style={{ textAlign: 'center', marginTop: 16 }}>
              <button
                type="button"
                onClick={() => setAuthModalMode('login')}
                style={{ background: 'none', border: 'none', color: 'var(--mut)', fontSize: 12, cursor: 'pointer' }}
              >
                Back to Sign In
              </button>
            </div>
          </form>
        )}

        {/* TAB 5: RESET PASSWORD */}
        {authModalMode === 'reset' && (
          <form onSubmit={handleReset}>
            <div className="form-group">
              <label className="form-label">Verification Code</label>
              <input
                type="text"
                maxLength={6}
                className="form-control"
                placeholder="6-digit reset code"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">New Password</label>
              <input
                type="password"
                className="form-control"
                placeholder="Enter new strong password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
              style={{ width: '100%', padding: '12px', fontSize: 14, marginTop: 8 }}
            >
              {loading ? 'Updating Password...' : 'Save New Password & Sign In'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
