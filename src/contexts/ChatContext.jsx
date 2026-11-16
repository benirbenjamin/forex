import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';

const ChatContext = createContext(null);

export function ChatProvider({ children }) {
  const { user, token } = useAuth();
  const { showToast } = useToast();

  const [isOpen, setIsOpen] = useState(false);
  const [activeOrderId, setActiveOrderId] = useState('support_general');
  const [messages, setMessages] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const toggleChat = useCallback(() => {
    setIsOpen((prev) => !prev);
    setUnreadCount(0);
  }, []);

  const openChatForOrder = useCallback((orderId) => {
    setActiveOrderId(orderId || 'support_general');
    setIsOpen(true);
    setUnreadCount(0);
  }, []);

  const fetchMessages = useCallback(async () => {
    if (!token || !activeOrderId) return;
    try {
      const res = await fetch(`/api/p2p?action=chat&orderId=${encodeURIComponent(activeOrderId)}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        const nextMsgs = data.messages || [];
        setMessages(nextMsgs);
      }
    } catch (e) {
      // ignore transient polling errors
    }
  }, [token, activeOrderId]);

  // Polling loop
  useEffect(() => {
    if (!token) return;
    fetchMessages();
    const interval = setInterval(fetchMessages, isOpen ? 3000 : 12000);
    return () => clearInterval(interval);
  }, [isOpen, token, fetchMessages]);

  const sendMessage = async (text) => {
    if (!token) {
      showToast('Please sign in to chat with support.', 'warning');
      return;
    }
    if (!text || !text.trim()) return;

    try {
      const res = await fetch(`/api/p2p?action=chat&orderId=${encodeURIComponent(activeOrderId)}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ message: text.trim() })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send message');

      // Append locally for immediate feedback
      setMessages((prev) => [
        ...prev,
        {
          id: 'temp_' + Date.now(),
          orderId: activeOrderId,
          senderRole: user?.role || 'user',
          message: text.trim(),
          createdAt: new Date().toISOString()
        }
      ]);
      fetchMessages();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  return (
    <ChatContext.Provider
      value={{
        isOpen,
        toggleChat,
        openChatForOrder,
        activeOrderId,
        setActiveOrderId,
        messages,
        unreadCount,
        loading,
        sendMessage,
        fetchMessages
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
}
