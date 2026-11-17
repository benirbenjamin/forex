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
  const [priceDirection, setPriceDirection] = useState('neutral');

  const [signal, setSignal] = useState(null);
  const [signalLoading, setSignalLoading] = useState(true);

  const [soundEnabled, setSoundEnabled] = useState(() => localStorage.getItem('fds_sound') !== 'off');
  const [notifications, setNotifications] = useState([]);

  const audioCtxRef = useRef(null);
  const basePriceRef = useRef(3870.50);
  const lastSignalActionRef = useRef(null);
  const audioUnlockedRef = useRef(false);

  // Global browser autoplay unlock listener
  useEffect(() => {
    const unlockAudio = () => {
      if (audioUnlockedRef.current) return;
      try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) {
          if (!audioCtxRef.current) {
            audioCtxRef.current = new AudioCtx();
          }
          if (audioCtxRef.current.state === 'suspended') {
            audioCtxRef.current.resume();
          }
        }
        audioUnlockedRef.current = true;
      } catch (e) {
        // ignore
      }
    };

    window.addEventListener('click', unlockAudio, { once: true, passive: true });
    window.addEventListener('touchstart', unlockAudio, { once: true, passive: true });
    window.addEventListener('keydown', unlockAudio, { once: true, passive: true });

    return () => {
      window.removeEventListener('click', unlockAudio);
      window.removeEventListener('touchstart', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
    };
  }, []);

  const changeCurrency = useCallback((curr) => {
    setActiveCurrency(curr);
    localStorage.setItem('fds_currency', curr);
  }, []);

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
      const now = ctx.currentTime;

      if (soundType === 'opportunity' || soundType === 'entry') {
        // Double rising harmonic chime
        const osc1 = ctx.createOscillator();
        const gain1 = ctx.createGain();
        osc1.connect(gain1);
        gain1.connect(ctx.destination);
        osc1.type = 'triangle';
        osc1.frequency.setValueAtTime(880, now);
        osc1.frequency.exponentialRampToValueAtTime(1320, now + 0.14);
        gain1.gain.setValueAtTime(0.4, now);
        gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
        osc1.start(now);
        osc1.stop(now + 0.3);

        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(1320, now + 0.15);
        osc2.frequency.exponentialRampToValueAtTime(1760, now + 0.32);
        gain2.gain.setValueAtTime(0.35, now + 0.15);
        gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.45);
        osc2.start(now + 0.15);
        osc2.stop(now + 0.45);
      } else if (soundType === 'exit' || soundType === 'loss') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.exponentialRampToValueAtTime(220, now + 0.28);
        gain.gain.setValueAtTime(0.35, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.32);
        osc.start(now);
        osc.stop(now + 0.32);
      } else if (soundType === 'tp' || soundType === 'win') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(587.33, now);
        osc.frequency.setValueAtTime(880, now + 0.1);
        osc.frequency.setValueAtTime(1174.66, now + 0.22);
        gain.gain.setValueAtTime(0.35, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.45);
        osc.start(now);
        osc.stop(now + 0.45);
      } else {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(980, now);
        gain.gain.setValueAtTime(0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.18);
        osc.start(now);
        osc.stop(now + 0.18);
      }
    } catch (e) {
      // ignore
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

  const fetchSignal = useCallback(async () => {
    try {
      const res = await fetch(`/api/signal?symbol=${encodeURIComponent(activeSymbol)}`);
      if (res.ok) {
        const data = await res.json();
        setSignal(data);
        if (data.price) {
          basePriceRef.current = Number(data.price);
        }

        // When a valid BUY or SELL signal is confirmed
        if (data.action && data.action !== lastSignalActionRef.current) {
          if (data.action === 'BUY' || data.action === 'SELL') {
            playSound('opportunity');
            addNotification(
              `⚡ Valid ${data.action} Signal: ${data.symbol || activeSymbol}`,
              `Entry Zone: $${data.entryZoneMin} - $${data.entryZoneMax} | TP1: $${data.takeProfit1 || '—'} | SL: $${data.stopLoss || '—'}`,
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

  useEffect(() => {
    setSignalLoading(true);
    fetchSignal();
    const interval = setInterval(fetchSignal, 2500);
    return () => clearInterval(interval);
  }, [fetchSignal]);

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
