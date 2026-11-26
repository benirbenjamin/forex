import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useMarket } from '../contexts/MarketContext';
import { useToast } from '../contexts/ToastContext';
import { useChat } from '../contexts/ChatContext';
import {
  Layers,
  ArrowRightLeft,
  ShieldCheck,
  AlertTriangle,
  Upload,
  MessageSquare,
  CheckCircle,
  Clock,
  FileText,
  AlertCircle
} from 'lucide-react';

export default function P2PPage() {
  const { user, token, isAuthenticated, openAuth } = useAuth();
  const { activeCurrency, formatCurrency } = useMarket();
  const { showToast, celebrate } = useToast();
  const { openChatForOrder } = useChat();

  const [p2pMode, setP2pMode] = useState('buy'); // 'buy' | 'sell'
  const [info, setInfo] = useState({
    availableInventory: 1000.0,
    buyPriceUsd: 1.00,
    sellPriceUsd: 1.02,
    buyPriceRwf: 1450,
    sellPriceRwf: 1480,
    exchangeRateRwf: 1450,
    feeConfig: { amount: 2, type: 'percent' },
    adminPaymentDetails: {
      momo: '0788123456 (BENI R.)',
      airtel: '0738123456 (BENI R.)',
      trc20: 'TQ9xK8...AdminTRC20Wallet'
    }
  });

  const [cryptoAmount, setCryptoAmount] = useState(20);
  const [walletAddress, setWalletAddress] = useState('');
  const [paymentDetails, setPaymentDetails] = useState('');
  const [loading, setLoading] = useState(false);

  // Active / recent orders
  const [activeOrder, setActiveOrder] = useState(null);

  // Proof upload state
  const [receiptBase64, setReceiptBase64] = useState(null);
  const [receiptFileName, setReceiptFileName] = useState('');
  const [verifyingProof, setVerifyingProof] = useState(false);
  const [ocrResult, setOcrResult] = useState(null);

  // Dispute modal state
  const [disputeModalOpen, setDisputeModalOpen] = useState(false);
  const [disputeReason, setDisputeReason] = useState('');

  // Fetch P2P platform info
  const fetchP2PInfo = async () => {
    try {
      const res = await fetch('/api/p2p?action=info');
      if (res.ok) {
        const data = await res.json();
        setInfo(data);
      }
    } catch (e) {
      console.warn('Failed to load P2P info:', e);
    }
  };

  useEffect(() => {
    fetchP2PInfo();
  }, []);

  // Calculate fiat total
  const ratePerUnit = p2pMode === 'buy' ? info.sellPriceRwf : info.buyPriceRwf;
  const fiatTotal = Math.round(cryptoAmount * ratePerUnit * (p2pMode === 'buy' ? 1.02 : 0.98));

  // Handle Order Submit
  const handleOrderSubmit = async (e) => {
    e.preventDefault();
    if (!isAuthenticated) {
      openAuth('login');
      return;
    }

    if (!cryptoAmount || cryptoAmount <= 0) {
      showToast('Please enter a valid USDT amount.', 'warning');
      return;
    }

    if (p2pMode === 'buy' && (!walletAddress || walletAddress.trim().length < 15)) {
      showToast('Please enter a valid TRC20 wallet address.', 'warning');
      return;
    }

    if (p2pMode === 'sell' && (!paymentDetails || paymentDetails.trim().length < 8)) {
      showToast('Please enter your receiving Mobile Money or Bank details.', 'warning');
      return;
    }

    setLoading(true);
    try {
      const action = p2pMode === 'buy' ? 'buy' : 'sell';
      const payload = p2pMode === 'buy'
        ? { cryptoAmount, fiatCurrency: 'RWF', userWalletAddress: walletAddress }
        : { cryptoAmount, fiatCurrency: 'RWF', userPaymentDetails: paymentDetails };

      const res = await fetch(`/api/p2p?action=${action}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit order');
      }

      setActiveOrder(data.order || data);
      showToast(`P2P ${p2pMode.toUpperCase()} order initiated successfully!`, 'success');
      fetchP2PInfo();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Handle Receipt File Selection
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showToast('Please select a valid image file (PNG/JPG).', 'error');
      return;
    }

    setReceiptFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      setReceiptBase64(reader.result);
      setOcrResult(null);
    };
    reader.readAsDataURL(file);
  };

  // Upload & Run OCR Verification
  const handleVerifyScreenshot = async () => {
    if (!activeOrder?.id) {
      showToast('No active order selected for verification.', 'warning');
      return;
    }
    if (!receiptBase64) {
      showToast('Please attach your payment screenshot first.', 'warning');
      return;
    }

    setVerifyingProof(true);
    setOcrResult(null);

    try {
      const res = await fetch('/api/p2p?action=upload-proof', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          orderId: activeOrder.id,
          imageBase64: receiptBase64,
          filename: receiptFileName,
          mimeType: 'image/jpeg'
        })
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Proof verification failed');
      }

      setOcrResult(data);
      if (data.verified) {
        celebrate();
        showToast('Receipt verified by OCR engine! Awaiting escrow release.', 'success');
      } else {
        showToast(data.message || 'Image rejected: authentic transaction text not detected.', 'error');
      }
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setVerifyingProof(false);
    }
  };

  // Confirm sent payment
  const handleConfirmSent = async () => {
    if (!activeOrder?.id) return;
    try {
      const res = await fetch('/api/p2p?action=confirm-payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ orderId: activeOrder.id })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update order');
      setActiveOrder((prev) => ({ ...prev, status: 'payment_sent' }));
      showToast('Payment confirmed sent! Escrow agent notified.', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  // Submit dispute
  const handleDispute = async (e) => {
    e.preventDefault();
    if (!activeOrder?.id || !disputeReason.trim()) return;

    try {
      const res = await fetch('/api/p2p?action=dispute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ orderId: activeOrder.id, reason: disputeReason.trim() })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to file dispute');
      setDisputeModalOpen(false);
      setDisputeReason('');
      showToast('Dispute ticket raised. Escrow officer has been paged.', 'warning');
      openChatForOrder(activeOrder.id);
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  return (
    <div className="container">
      {/* Header & Inventory Bar */}
      <div style={{
        background: 'var(--panel)',
        border: '1px solid var(--line)',
        borderRadius: 'var(--radius)',
        padding: '16px 20px',
        marginBottom: 20
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Layers size={22} style={{ color: 'var(--gold)' }} />
              <h2 style={{ fontSize: 20, fontWeight: 800, color: '#fff' }}>
                Crypto P2P Gateway (Buy / Sell USDT)
              </h2>
            </div>
            <p style={{ fontSize: 12, color: 'var(--mut)', marginTop: 4 }}>
              Direct peer-to-peer exchange with institutional escrow, zero hidden fees, and AI OCR receipt audit.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, color: 'var(--up)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--up)' }}></span>
              Escrow Support Desk Active
            </span>
            <div style={{ display: 'inline-flex', background: 'var(--panel-card)', padding: 3, borderRadius: 6 }}>
              <button
                onClick={() => setP2pMode('buy')}
                style={{
                  padding: '6px 14px',
                  borderRadius: 4,
                  fontWeight: 800,
                  fontSize: 12,
                  border: 'none',
                  cursor: 'pointer',
                  background: p2pMode === 'buy' ? 'var(--gold)' : 'transparent',
                  color: p2pMode === 'buy' ? '#0b0e14' : 'var(--mut)'
                }}
              >
                BUY USDT
              </button>
              <button
                onClick={() => setP2pMode('sell')}
                style={{
                  padding: '6px 14px',
                  borderRadius: 4,
                  fontWeight: 800,
                  fontSize: 12,
                  border: 'none',
                  cursor: 'pointer',
                  background: p2pMode === 'sell' ? 'var(--gold)' : 'transparent',
                  color: p2pMode === 'sell' ? '#0b0e14' : 'var(--mut)'
                }}
              >
                SELL USDT
              </button>
            </div>
          </div>
        </div>

        {/* Inventory & Pricing Grid */}
        <div className="grid-3" style={{ marginTop: 18 }}>
          <div className="panel-card">
            <div style={{ fontSize: 11, color: 'var(--mut)', fontWeight: 700 }}>AVAILABLE USDT INVENTORY</div>
            <div style={{ fontSize: 20, fontWeight: 800, fontFamily: 'JetBrains Mono, monospace', color: 'var(--gold-bright)', marginTop: 4 }}>
              {Number(info.availableInventory || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })} USDT
            </div>
          </div>

          <div className="panel-card">
            <div style={{ fontSize: 11, color: 'var(--mut)', fontWeight: 700 }}>PRICE TO BUY (1 USDT)</div>
            <div style={{ fontSize: 20, fontWeight: 800, fontFamily: 'JetBrains Mono, monospace', color: '#fff', marginTop: 4 }}>
              ${Number(info.sellPriceUsd || 1.02).toFixed(2)} ({info.sellPriceRwf || 1480} RWF)
            </div>
          </div>

          <div className="panel-card">
            <div style={{ fontSize: 11, color: 'var(--mut)', fontWeight: 700 }}>PRICE TO SELL (1 USDT)</div>
            <div style={{ fontSize: 20, fontWeight: 800, fontFamily: 'JetBrains Mono, monospace', color: '#fff', marginTop: 4 }}>
              ${Number(info.buyPriceUsd || 1.00).toFixed(2)} ({info.buyPriceRwf || 1450} RWF)
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(340px, 100%), 1fr))', gap: 20 }}>
        {/* Main P2P Order Ticket Form */}
        <div style={{
          background: 'var(--panel)',
          border: '1px solid var(--line)',
          borderRadius: 'var(--radius)',
          padding: 24
        }}>
          <h3 style={{ fontSize: 16, fontWeight: 800, color: '#fff', marginBottom: 16 }}>
            {p2pMode === 'buy' ? 'Buy USDT from Institutional Escrow' : 'Sell USDT to Desk'}
          </h3>

          <form onSubmit={handleOrderSubmit}>
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">USDT Amount (Min 10 USDT)</label>
                <input
                  type="number"
                  min="10"
                  step="1"
                  className="form-control"
                  value={cryptoAmount}
                  onChange={(e) => setCryptoAmount(Number(e.target.value))}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Total Payable / Receivable (RWF)</label>
                <input
                  type="text"
                  className="form-control"
                  value={`${fiatTotal.toLocaleString()} RWF (Incl. 2% fee)`}
                  disabled
                  style={{ color: 'var(--gold-bright)', fontWeight: 700 }}
                />
              </div>
            </div>

            {p2pMode === 'buy' ? (
              <div className="form-group">
                <label className="form-label">Your Receiving TRC20 Wallet Address</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. TThnedfgfgXXXXXXXXXX..."
                  value={walletAddress}
                  onChange={(e) => setWalletAddress(e.target.value)}
                  required
                />
              </div>
            ) : (
              <div className="form-group">
                <label className="form-label">Your Receiving Mobile Money / Bank Details</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. MTN MoMo +250 788 123 456 (Full Name)"
                  value={paymentDetails}
                  onChange={(e) => setPaymentDetails(e.target.value)}
                  required
                />
              </div>
            )}

            <div style={{
              background: 'rgba(255, 77, 79, 0.08)',
              border: '1px solid var(--dn)',
              borderRadius: 6,
              padding: 12,
              marginBottom: 16,
              fontSize: 12,
              color: '#ff8595',
              lineHeight: 1.5
            }}>
              ⚠️ <strong>NOTICE:</strong> Ensure the wallet network is strictly <strong>TRC20 (Tron)</strong>.
              Funds sent to wrong contract addresses or incorrect chains are unrecoverable.
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
              style={{ width: '100%', padding: '12px', fontSize: 14, fontWeight: 800 }}
            >
              {loading ? 'Processing Order...' : `Place P2P ${p2pMode.toUpperCase()} Order`}
            </button>
          </form>
        </div>

        {/* Escrow Desk & Payment Instructions */}
        <div style={{
          background: 'var(--panel)',
          border: '1px solid var(--line)',
          borderRadius: 'var(--radius)',
          padding: 24,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between'
        }}>
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 800, color: '#fff', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
              <ShieldCheck size={18} style={{ color: 'var(--up)' }} />
              Desk Payment Coordinates
            </h3>
            <p style={{ fontSize: 12, color: 'var(--mut)', marginBottom: 14 }}>
              When buying USDT, transfer the exact fiat amount to one of our designated official escrow channels below:
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ background: 'var(--panel-card)', padding: 12, borderRadius: 6, border: '1px solid var(--line)' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gold-bright)' }}>MTN RWANDA MOBILE MONEY</div>
                <div style={{ fontSize: 14, fontWeight: 800, color: '#fff', marginTop: 2 }}>{info.adminPaymentDetails?.momo || '0788123456 (ForexDoubleSniper Desk)'}</div>
              </div>

              <div style={{ background: 'var(--panel-card)', padding: 12, borderRadius: 6, border: '1px solid var(--line)' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gold-bright)' }}>AIRTEL RWANDA MONEY</div>
                <div style={{ fontSize: 14, fontWeight: 800, color: '#fff', marginTop: 2 }}>{info.adminPaymentDetails?.airtel || '0738123456 (ForexDoubleSniper Desk)'}</div>
              </div>

              <div style={{ background: 'var(--panel-card)', padding: 12, borderRadius: 6, border: '1px solid var(--line)' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gold-bright)' }}>DESK TRC20 DEPOSIT WALLET</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#fff', fontFamily: 'JetBrains Mono, monospace', marginTop: 2, wordBreak: 'break-all' }}>
                  {info.adminPaymentDetails?.trc20 || 'TQ9xK87f6h4AdminDepositWalletTRC20'}
                </div>
              </div>

              <div style={{ background: 'var(--panel-card)', padding: 12, borderRadius: 6, border: '1px solid var(--line)' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gold-bright)' }}>BANK TRANSFER (OFFICIAL)</div>
                <div style={{ fontSize: 14, fontWeight: 800, color: '#fff', marginTop: 2 }}>{info.adminPaymentDetails?.bank || 'Bank details will be provided by the desk on request.'}</div>
              </div>
            </div>
          </div>

          <div style={{ marginTop: 20, display: 'flex', gap: 10 }}>
            <button
              onClick={() => openChatForOrder(activeOrder?.id || 'p2p_desk')}
              className="btn btn-outline"
              style={{ flex: 1, padding: '10px' }}
            >
              <MessageSquare size={16} />
              <span>Contact Escrow Desk</span>
            </button>
            {activeOrder && (
              <button
                onClick={() => setDisputeModalOpen(true)}
                className="btn btn-outline"
                style={{ padding: '10px', color: 'var(--dn)', borderColor: 'var(--dn)' }}
              >
                File Dispute
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Active Order Details & AI OCR Verification */}
      {activeOrder && (
        <div style={{
          background: 'var(--panel)',
          border: '1px solid var(--line)',
          borderRadius: 'var(--radius)',
          padding: 24,
          marginTop: 24
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <span className="badge-gold">ACTIVE ESCROW ORDER</span>
              <h3 style={{ fontSize: 17, fontWeight: 800, color: '#fff', marginTop: 4 }}>
                Order #{activeOrder.id} • {activeOrder.type?.toUpperCase() || 'BUY'} {activeOrder.cryptoAmount} USDT
              </h3>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 12, color: 'var(--mut)' }}>Status:</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--gold-bright)', textTransform: 'uppercase' }}>
                {activeOrder.status || 'pending_payment'}
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, marginBottom: 20 }}>
            <div>
              <label className="form-label">Upload Proof of Payment (Screenshot)</label>
              <input
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                style={{
                  width: '100%',
                  padding: 10,
                  background: 'var(--panel-card)',
                  border: '1px dashed var(--line-light)',
                  borderRadius: 6,
                  color: 'var(--mut)',
                  fontSize: 12
                }}
              />
            </div>

            {receiptBase64 && (
              <div>
                <label className="form-label">Preview & AI OCR Verification</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <img
                    src={receiptBase64}
                    alt="Proof"
                    style={{ width: 60, height: 60, objectFit: 'cover', borderRadius: 4, border: '1px solid var(--line)' }}
                  />
                  <button
                    onClick={handleVerifyScreenshot}
                    className="btn btn-primary"
                    disabled={verifyingProof}
                    style={{ flex: 1, padding: '10px' }}
                  >
                    <Upload size={15} />
                    <span>{verifyingProof ? 'Auditing with AI OCR...' : 'Audit Receipt'}</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* OCR Result Badge */}
          {ocrResult && (
            <div style={{
              background: ocrResult.verified ? 'rgba(0,208,132,0.1)' : 'rgba(255,77,79,0.1)',
              border: `1px solid ${ocrResult.verified ? 'var(--up)' : 'var(--dn)'}`,
              borderRadius: 6,
              padding: 12,
              marginBottom: 16,
              fontSize: 13,
              display: 'flex',
              alignItems: 'center',
              gap: 10
            }}>
              {ocrResult.verified ? (
                <CheckCircle size={20} style={{ color: 'var(--up)' }} />
              ) : (
                <AlertCircle size={20} style={{ color: 'var(--dn)' }} />
              )}
              <div style={{ color: ocrResult.verified ? 'var(--up)' : '#ff8595' }}>
                <strong>{ocrResult.verified ? 'AI Verification Passed:' : 'Verification Failed:'}</strong>{' '}
                {ocrResult.message || (ocrResult.verified ? 'Payment confirmed by OCR engine.' : 'No authentic transaction signature found.')}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 12 }}>
            <button
              onClick={handleConfirmSent}
              className="btn btn-buy"
              style={{ flex: 1, padding: '12px' }}
            >
              I Have Completed Payment
            </button>
            <button
              onClick={() => openChatForOrder(activeOrder.id)}
              className="btn btn-outline"
              style={{ padding: '12px 18px' }}
            >
              <MessageSquare size={16} />
              <span>Chat with Desk</span>
            </button>
          </div>
        </div>
      )}

      {/* Dispute Modal */}
      {disputeModalOpen && (
        <div className="modal-overlay" onClick={() => setDisputeModalOpen(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ fontSize: 18, fontWeight: 800, color: '#fff', marginBottom: 12 }}>
              File P2P Escrow Dispute
            </h3>
            <p style={{ fontSize: 13, color: 'var(--mut)', marginBottom: 16 }}>
              Provide the details of the issue. Our dispute officer will step in and hold funds in escrow until resolved.
            </p>
            <form onSubmit={handleDispute}>
              <div className="form-group">
                <label className="form-label">Dispute Details</label>
                <textarea
                  className="form-control"
                  rows={4}
                  placeholder="Explain transaction issue or delay..."
                  value={disputeReason}
                  onChange={(e) => setDisputeReason(e.target.value)}
                  required
                />
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ flex: 1, background: 'var(--dn)', borderColor: 'var(--dn)' }}
                >
                  Submit Dispute Claim
                </button>
                <button
                  type="button"
                  onClick={() => setDisputeModalOpen(false)}
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
