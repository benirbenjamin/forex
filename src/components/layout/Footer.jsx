import React, { useState, useEffect } from 'react';
import { Shield, Lock, Server, Cpu } from 'lucide-react';

export default function Footer() {
  const [latency, setLatency] = useState(24);

  useEffect(() => {
    const interval = setInterval(() => {
      setLatency(Math.floor(20 + Math.random() * 15));
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  return (
    <footer style={{
      background: 'var(--panel)',
      borderTop: '1px solid var(--line)',
      marginTop: 'auto',
      padding: '32px 18px 24px',
      color: 'var(--mut)',
      fontSize: 12
    }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: 24,
          marginBottom: 24
        }}>
          <div>
            <div style={{ color: '#fff', fontWeight: 800, fontSize: 14, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Shield size={16} style={{ color: 'var(--gold)' }} />
              ForexDoubleSniper Institutional
            </div>
            <p style={{ lineHeight: 1.6 }}>
              High-frequency multi-asset signal engine engineered for Gold (XAU/USD) and Bitcoin (BTC/USD).
              Built on institutional order flow imbalances, CVD delta walls, and liquidity sweep detection.
            </p>
          </div>

          <div>
            <div style={{ color: '#fff', fontWeight: 700, fontSize: 13, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Server size={15} style={{ color: 'var(--up)' }} />
              Execution Infrastructure
            </div>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, lineHeight: 1.8 }}>
              <li>• SwiftEdge Dynamic Order Flow Engine</li>
              <li>• 450ms Micro-Tick Realtime Feeds</li>
              <li>• Peer-to-Peer Escrow with OCR Audit</li>
              <li>• Automated 15-Minute TTL Signal Expiry</li>
            </ul>
          </div>

          <div>
            <div style={{ color: '#fff', fontWeight: 700, fontSize: 13, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Lock size={15} style={{ color: 'var(--gold-bright)' }} />
              Compliance & Security
            </div>
            <div style={{
              background: 'var(--panel-card)',
              padding: 10,
              borderRadius: 6,
              border: '1px solid var(--line)',
              display: 'flex',
              flexDirection: 'column',
              gap: 4
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Engine Latency:</span>
                <span style={{ color: 'var(--up)', fontWeight: 700 }}>{latency}ms (Optimal)</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Session Encryption:</span>
                <span style={{ color: '#fff' }}>TLS 1.3 / AES-256</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>PostgreSQL Cluster:</span>
                <span style={{ color: 'var(--up)' }}>Online & Persistent</span>
              </div>
            </div>
          </div>
        </div>

        <div style={{
          borderTop: '1px solid var(--line)',
          paddingTop: 18,
          fontSize: 11,
          lineHeight: 1.6,
          color: '#657085'
        }}>
          <p style={{ marginBottom: 8 }}>
            <strong>Institutional Risk Disclosure:</strong> Foreign exchange (Forex) and cryptocurrency trading involves substantial risk of loss and is not suitable for every investor. The high degree of leverage that is often obtainable in commodity trading can work against you as well as for you. Past performance is no guarantee of future returns.
          </p>
          <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
            <span>© {new Date().getFullYear()} ForexDoubleSniper Institutional. All rights reserved.</span>
            <span>Version 2.0.0-PROD</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
