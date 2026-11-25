import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';

const ChatContext = createContext(null);

export function ChatProvider({ children }) {
  const { user, token, isAuthenticated } = useAuth();
  const { showToast } = useToast();

  const [isOpen, setIsOpen] = useState(false);
  const [activeOrderId, setActiveOrderId] = useState('support_general');
  const [messages, setMessages] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  // Default thread for authenticated user
  useEffect(() => {
    if (user?.id) {
      setActiveOrderId((prev) => (prev === 'support_general' ? `support_${user.id}` : prev));
    }
  }, [user]);

  const toggleChat = useCallback(() => {
    setIsOpen((prev) => !prev);
    setUnreadCount(0);
  }, []);

  const openChatForOrder = useCallback((orderId) => {
    setActiveOrderId(orderId || (user?.id ? `support_${user.id}` : 'support_general'));
    setIsOpen(true);
    setUnreadCount(0);
  }, [user]);

  const fetchMessages = useCallback(async () => {
    if (!token || !activeOrderId) return;
    try {
      const res = await fetch(`/api/p2p/chat/${encodeURIComponent(activeOrderId)}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        const nextMsgs = data.messages || [];
        setMessages(nextMsgs);
      }
    } catch (e) {
      // ignore transient error
    }
  }, [token, activeOrderId]);

  // Polling loop
  useEffect(() => {
    if (!token) return;
    fetchMessages();
    const interval = setInterval(fetchMessages, isOpen ? 2500 : 10000);
    return () => clearInterval(interval);
  }, [isOpen, token, fetchMessages]);

  const sendMessage = async (text) => {
    if (!token) {
      showToast('Please sign in to chat with trading desk.', 'warning');
      return;
    }
    if (!text || !text.trim()) return;

    const threadToUse = activeOrderId || (user?.id ? `support_${user.id}` : 'support_general');

    try {
      const res = await fetch(`/api/p2p/chat/${encodeURIComponent(threadToUse)}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ message: text.trim() })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send message');

      setMessages((prev) => [
        ...prev,
        {
          id: 'temp_' + Date.now(),
          order_id: threadToUse,
          sender_role: user?.role || 'user',
          message: text.trim(),
          created_at: new Date().toISOString()
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
