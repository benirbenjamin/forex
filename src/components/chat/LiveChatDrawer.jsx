import React, { useState, useEffect, useRef } from 'react';
import { useChat } from '../../contexts/ChatContext';
import { useAuth } from '../../contexts/AuthContext';
import { MessageSquare, X, Send, ShieldCheck, User, Paperclip } from 'lucide-react';

export default function LiveChatDrawer() {
  const { isOpen, toggleChat, activeOrderId, messages, sendMessage } = useChat();
  const { user, isAuthenticated, openAuth } = useAuth();
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    sendMessage(inputText);
    setInputText('');
  };

  const sendQuickReply = (text) => {
    sendMessage(text);
  };

  return (
    <>
      {/* Floating Launcher Button */}
      <button
        onClick={toggleChat}
        style={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          background: 'var(--gold)',
          color: '#0b0e14',
          border: 'none',
          borderRadius: 30,
          padding: '12px 20px',
          fontWeight: 800,
          fontSize: 14,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          boxShadow: '0 8px 24px rgba(212, 175, 55, 0.4)',
          zIndex: 998,
          transition: 'transform 0.2s ease'
        }}
        onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-2px)')}
        onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
      >
        <MessageSquare size={18} />
        <span>Live Support</span>
        <span style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: 'var(--up)',
          boxShadow: '0 0 8px var(--up)'
        }} />
      </button>

      {/* Floating Chat Drawer */}
      {isOpen && (
        <div className="chat-drawer">
          {/* Header */}
          <div style={{
            background: 'var(--panel-card)',
            padding: '14px 16px',
            borderBottom: '1px solid var(--line)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                background: 'rgba(212,175,55,0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--gold-bright)'
              }}>
                <ShieldCheck size={18} />
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 800, color: '#fff' }}>
                  Institutional Desk Support
                </div>
                <div style={{ fontSize: 10, color: 'var(--up)', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--up)' }}></span>
                  Escrow Officer Online
                </div>
              </div>
            </div>

            <button
              onClick={toggleChat}
              style={{ background: 'none', border: 'none', color: 'var(--mut)', cursor: 'pointer' }}
            >
              <X size={18} />
            </button>
          </div>

          {/* Messages Body */}
          <div style={{
            flex: 1,
            overflowY: 'auto',
            padding: 14,
            display: 'flex',
            flexDirection: 'column',
            gap: 12
          }}>
            <div style={{
              background: 'rgba(212,175,55,0.06)',
              border: '1px solid rgba(212,175,55,0.2)',
              borderRadius: 6,
              padding: 10,
              fontSize: 11,
              color: 'var(--mut)',
              lineHeight: 1.5,
              textAlign: 'center'
            }}>
              🔒 Official P2P Escrow & VIP Support Channel. Messages are securely logged for audit verification.
            </div>

            {messages.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--mut)', fontSize: 12, margin: 'auto 0' }}>
                How can our trading desk assist you today? Send a message below.
              </div>
            ) : (
              messages.map((m, idx) => {
                const role = m.sender_role || m.senderRole;
                const isAdmin = role === 'admin' || role === 'superadmin';
                const isMe = role === (user?.role || 'user');
                const timeStr = new Date(m.created_at || m.createdAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                return (
                  <div
                    key={m.id || idx}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: isMe && !isAdmin ? 'flex-end' : 'flex-start'
                    }}
                  >
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      fontSize: 10,
                      color: 'var(--mut)',
                      marginBottom: 2
                    }}>
                      <span>{isAdmin ? '🛡️ Institutional Support' : (isMe ? 'You' : 'Trader')}</span>
                      <span>{timeStr}</span>
                    </div>
                    <div style={{
                      maxWidth: '85%',
                      padding: '8px 12px',
                      borderRadius: 8,
                      fontSize: 13,
                      lineHeight: 1.4,
                      background: isMe && !isAdmin ? 'linear-gradient(135deg, #1e3a8a, #2563eb)' : 'var(--panel-card)',
                      color: '#fff',
                      border: isMe && !isAdmin ? '1px solid #3b82f6' : '1px solid var(--line-light)'
                    }}>
                      {m.message}
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Suggestions */}
          <div style={{
            display: 'flex',
            gap: 6,
            padding: '6px 14px',
            overflowX: 'auto',
            background: 'var(--bg-subtle)',
            borderTop: '1px solid var(--line)'
          }}>
            <button
              onClick={() => sendQuickReply('I completed my P2P payment, please verify receipt.')}
              style={{
                fontSize: 11,
                padding: '4px 8px',
                borderRadius: 4,
                background: 'var(--panel)',
                border: '1px solid var(--line)',
                color: 'var(--mut)',
                whiteSpace: 'nowrap',
                cursor: 'pointer'
              }}
            >
              💸 Payment Sent
            </button>
            <button
              onClick={() => sendQuickReply('How do I activate VIP subscription?')}
              style={{
                fontSize: 11,
                padding: '4px 8px',
                borderRadius: 4,
                background: 'var(--panel)',
                border: '1px solid var(--line)',
                color: 'var(--mut)',
                whiteSpace: 'nowrap',
                cursor: 'pointer'
              }}
            >
              ⭐ VIP Help
            </button>
            <button
              onClick={() => sendQuickReply('Please release my USDT order.')}
              style={{
                fontSize: 11,
                padding: '4px 8px',
                borderRadius: 4,
                background: 'var(--panel)',
                border: '1px solid var(--line)',
                color: 'var(--mut)',
                whiteSpace: 'nowrap',
                cursor: 'pointer'
              }}
            >
              ⚡ Release Escrow
            </button>
          </div>

          {/* Input Footer */}
          {isAuthenticated ? (
            <form
              onSubmit={handleSubmit}
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: 10,
                background: 'var(--panel)',
                borderTop: '1px solid var(--line)',
                gap: 8
              }}
            >
              <input
                type="text"
                placeholder="Type your message..."
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                style={{
                  flex: 1,
                  background: 'var(--panel-card)',
                  border: '1px solid var(--line)',
                  borderRadius: 4,
                  padding: '8px 12px',
                  color: '#fff',
                  fontSize: 13,
                  outline: 'none'
                }}
              />
              <button
                type="submit"
                className="btn btn-primary"
                style={{ padding: '8px 12px' }}
                disabled={!inputText.trim()}
              >
                <Send size={15} />
              </button>
            </form>
          ) : (
            <div style={{
              padding: 12,
              background: 'var(--panel)',
              borderTop: '1px solid var(--line)',
              textAlign: 'center'
            }}>
              <button
                onClick={() => openAuth('login')}
                className="btn btn-primary"
                style={{ width: '100%', fontSize: 13 }}
              >
                Sign In to Message Support
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
}
