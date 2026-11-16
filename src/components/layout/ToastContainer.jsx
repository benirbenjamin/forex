import React from 'react';
import { useToast } from '../../contexts/ToastContext';
import { CheckCircle, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';

export default function ToastContainer() {
  const { toasts, removeToast } = useToast();

  if (!toasts.length) return null;

  return (
    <div className="toast-container">
      {toasts.map((t) => {
        const Icon =
          t.type === 'success' ? CheckCircle :
          t.type === 'error' ? AlertCircle :
          t.type === 'warning' ? AlertTriangle : Info;

        const iconColor =
          t.type === 'success' ? 'var(--up)' :
          t.type === 'error' ? 'var(--dn)' :
          t.type === 'warning' ? 'var(--amber)' : 'var(--accent)';

        return (
          <div key={t.id} className={`toast-item ${t.type}`}>
            <Icon size={18} style={{ color: iconColor, flexShrink: 0 }} />
            <div style={{ flex: 1, color: '#f0f3f8', wordBreak: 'break-word' }}>
              {t.message}
            </div>
            <button
              onClick={() => removeToast(t.id)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--mut)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                padding: '2px'
              }}
              title="Close"
            >
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
