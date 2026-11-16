import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ToastProvider } from './contexts/ToastContext';
import { AuthProvider } from './contexts/AuthContext';
import { MarketProvider } from './contexts/MarketContext';
import { ChatProvider } from './contexts/ChatContext';

import Navbar from './components/layout/Navbar';
import Footer from './components/layout/Footer';
import AuthModal from './components/layout/AuthModal';
import ToastContainer from './components/layout/ToastContainer';
import LiveChatDrawer from './components/chat/LiveChatDrawer';

import SignalsPage from './pages/SignalsPage';
import SimulatorPage from './pages/SimulatorPage';
import P2PPage from './pages/P2PPage';
import SubscriptionsPage from './pages/SubscriptionsPage';
import ReferralsPage from './pages/ReferralsPage';
import AdminDashboard from './pages/AdminDashboard';

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <MarketProvider>
          <ChatProvider>
            <BrowserRouter>
              <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
                <Navbar />
                <ToastContainer />
                <AuthModal />
                <LiveChatDrawer />

                <main style={{ flex: 1, padding: '16px 0 32px' }}>
                  <Routes>
                    <Route path="/" element={<SignalsPage />} />
                    <Route path="/simulator" element={<SimulatorPage />} />
                    <Route path="/p2p" element={<P2PPage />} />
                    <Route path="/subscriptions" element={<SubscriptionsPage />} />
                    <Route path="/referrals" element={<ReferralsPage />} />
                    <Route path="/admin" element={<AdminDashboard />} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Routes>
                </main>

                <Footer />
              </div>
            </BrowserRouter>
          </ChatProvider>
        </MarketProvider>
      </AuthProvider>
    </ToastProvider>
  );
}
