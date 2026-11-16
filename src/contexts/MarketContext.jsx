import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';

const MarketContext = createContext(null);

const DEFAULT_RATES = {
  USD: 1.0,
  RWF: 1450.0,
  KES: 130.0,
  UGX: 3700.0,
  TZS: 2600.0,
  NGN: 1550.0,
  GHS: 15.5,
  ZAR: 18.5,
  EUR: 0.92,
  GBP: 0.78
};

export function MarketProvider({ children }) {
  const [activeSymbol, setActiveSymbol] = useState('XAUUSD'); // 'XAUUSD' | 'BTCUSD'
  const [activeCurrency, setActiveCurrency] = useState(() => localStorage.getItem('fds_currency') || 'USD');
  const [rates, setRates] = useState(DEFAULT_RATES);

  const [currentPrice, setCurrentPrice] = useState(3870.50);
  const [prevPrice, setPrevPrice] = useState(3870.50);
  const [priceDirection, setPriceDirection] = useState('neutral'); // 'up' | 'down' | 'neutral'

  const [signal, setSignal] = useState(null);
  const [signalLoading, setSignalLoading] = useState(true);

  const [soundEnabled, setSoundEnabled] = useState(() => localStorage.getItem('fds_sound') !== 'off');
  const [notifications, setNotifications] = useState([]);

  const audioCtxRef = useRef(null);
  const basePriceRef = useRef(3870.50);
  const lastSignalActionRef = useRef(null);

  // Currency selection persistence
  const changeCurrency = useCallback((curr) => {
    setActiveCurrency(curr);
    localStorage.setItem('fds_currency', curr);
  }, []);

  // Format currency helper
  const formatCurrency = useCallback((usdAmount, targetCurr = activeCurrency) => {
    const rate = rates[targetCurr] || 1;
    const converted = Number(usdAmount || 0) * rate;
    const symMap = {
      USD: '$',
      RWF: 'RWF ',
      KES: 'KSh ',
      UGX: 'UGX ',
      TZS: 'TZS ',
      NGN: '₦',
      GHS: 'GH₵ ',
      ZAR: 'R ',
      EUR: '€',
      GBP: '£'
    };
    const prefix = symMap[targetCurr] || '';
    if (targetCurr === 'USD' || targetCurr === 'EUR' || targetCurr === 'GBP') {
      return `${prefix}${converted.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    return `${prefix}${Math.round(converted).toLocaleString()}`;
  }, [rates, activeCurrency]);

  // Audio synthesizer via Web Audio API
  const getAudioContext = useCallback(() => {
    if (!audioCtxRef.current && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        audioCtxRef.current = new AudioCtx();
      }
    }
    if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }
    return audioCtxRef.current;
  }, []);

  const playSound = useCallback((soundType = 'ping') => {
    if (!soundEnabled) return;
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      const now = ctx.currentTime;

      if (soundType === 'opportunity' || soundType === 'entry') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(880, now);
        osc.frequency.exponentialRampToValueAtTime(1320, now + 0.15);
        gain.gain.setValueAtTime(0.35, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);
        osc.start(now);
        osc.stop(now + 0.35);
      } else if (soundType === 'exit' || soundType === 'loss') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.exponentialRampToValueAtTime(220, now + 0.25);
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
        osc.start(now);
        osc.stop(now + 0.3);
      } else if (soundType === 'tp' || soundType === 'win') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(587.33, now); // D5
        osc.frequency.setValueAtTime(880, now + 0.1); // A5
        osc.frequency.setValueAtTime(1174.66, now + 0.2); // D6
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
        osc.start(now);
        osc.stop(now + 0.4);
      } else {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(980, now);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
        osc.start(now);
        osc.stop(now + 0.15);
      }
    } catch (e) {
      // ignore audio errors
    }
  }, [soundEnabled, getAudioContext]);

  const toggleSound = useCallback(() => {
    setSoundEnabled((prev) => {
      const next = !prev;
      localStorage.setItem('fds_sound', next ? 'on' : 'off');
      if (next) {
        getAudioContext();
        playSound('ping');
      }
      return next;
    });
  }, [getAudioContext, playSound]);

  const addNotification = useCallback((title, message, type = 'info') => {
    const notif = {
      id: 'n_' + Date.now() + Math.random().toString(36).substring(2, 6),
      title,
      message,
      type,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    setNotifications((prev) => [notif, ...prev.slice(0, 30)]);
    if (type === 'opportunity') playSound('opportunity');
    else if (type === 'exit') playSound('exit');
    else if (type === 'tp') playSound('tp');
    else playSound('ping');
  }, [playSound]);

  const clearNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  // Fetch live signal from API
  const fetchSignal = useCallback(async () => {
    try {
      const res = await fetch(`/api/signal?symbol=${encodeURIComponent(activeSymbol)}`);
      if (res.ok) {
        const data = await res.json();
        setSignal(data);
        if (data.price) {
          basePriceRef.current = Number(data.price);
        }

        // Detect direction flip for sound notification
        if (data.action && data.action !== lastSignalActionRef.current) {
          if (lastSignalActionRef.current && (data.action === 'BUY' || data.action === 'SELL')) {
            playSound('opportunity');
            addNotification(
              `⚡ New ${data.action} Signal`,
              `${data.symbol} entry zone: $${data.entryZoneMin} - $${data.entryZoneMax}`,
              'opportunity'
            );
          }
          lastSignalActionRef.current = data.action;
        }
      }
    } catch (e) {
      console.warn('Signal fetch error:', e);
    } finally {
      setSignalLoading(false);
    }
  }, [activeSymbol, playSound, addNotification]);

  // Initial load & Polling for signals
  useEffect(() => {
    setSignalLoading(true);
    fetchSignal();
    const interval = setInterval(fetchSignal, 2500);
    return () => clearInterval(interval);
  }, [fetchSignal]);

  // Micro-tick engine: 450ms real-time price oscillations around server baseline
  useEffect(() => {
    const isGold = activeSymbol === 'XAUUSD';
    const tickInterval = setInterval(() => {
      const base = basePriceRef.current || (isGold ? 3870.50 : 64250.00);
      const spread = isGold ? 0.35 : 5.0;
      const noise = (Math.random() - 0.5) * spread;
      const nextPrice = Number((base + noise).toFixed(isGold ? 2 : 2));

      setCurrentPrice((prev) => {
        setPrevPrice(prev);
        if (nextPrice > prev) setPriceDirection('up');
        else if (nextPrice < prev) setPriceDirection('down');
        else setPriceDirection('neutral');
        return nextPrice;
      });
    }, 450);

    return () => clearInterval(tickInterval);
  }, [activeSymbol]);

  // Fetch P2P exchange rates to keep rates updated
  useEffect(() => {
    fetch('/api/p2p?action=info')
      .then((r) => r.json())
      .then((d) => {
        if (d && d.exchangeRate) {
          setRates((prev) => ({
            ...prev,
            RWF: Number(d.exchangeRate) || 1450.0
          }));
        }
      })
      .catch(() => {});
  }, []);

  return (
    <MarketContext.Provider
      value={{
        activeSymbol,
        setActiveSymbol,
        activeCurrency,
        changeCurrency,
        rates,
        formatCurrency,
        currentPrice,
        prevPrice,
        priceDirection,
        signal,
        signalLoading,
        soundEnabled,
        toggleSound,
        playSound,
        notifications,
        addNotification,
        clearNotifications,
        fetchSignal
      }}
    >
      {children}
    </MarketContext.Provider>
  );
}

export function useMarket() {
  const context = useContext(MarketContext);
  if (!context) {
    throw new Error('useMarket must be used within a MarketProvider');
  }
  return context;
}
