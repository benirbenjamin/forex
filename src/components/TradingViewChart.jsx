import React, { useEffect, useRef } from 'react';

// Maps internal symbols to TradingView exchange symbols.
const SYMBOL_MAP = {
  XAUUSD: 'OANDA:XAUUSD',
  BTCUSD: 'BINANCE:BTCUSDT'
};

/**
 * Embeds a live TradingView advanced chart.
 * Loads the official tv.js widget once and re-renders on symbol/interval change.
 * If the script is blocked/unavailable it simply renders an empty dark panel
 * (no crash, no layout break).
 */
export default function TradingViewChart({ symbol = 'XAUUSD', interval = '15', height = 480 }) {
  const containerRef = useRef(null);
  const containerId = useRef('tv_chart_' + Math.random().toString(36).slice(2, 9)).current;

  useEffect(() => {
    const tvSymbol = SYMBOL_MAP[symbol] || SYMBOL_MAP.XAUUSD;
    let cancelled = false;

    const renderWidget = () => {
      if (cancelled || !window.TradingView || !containerRef.current) return;
      // Clear any previous widget before re-creating for a new symbol/interval.
      containerRef.current.innerHTML = '';
      try {
        // eslint-disable-next-line no-new
        new window.TradingView.widget({
          container_id: containerId,
          autosize: true,
          symbol: tvSymbol,
          interval: String(interval),
          timezone: 'Etc/UTC',
          theme: 'dark',
          style: '1',
          locale: 'en',
          toolbar_bg: '#0b0e14',
          enable_publishing: false,
          hide_legend: false,
          allow_symbol_change: true,
          hide_side_toolbar: false,
          withdateranges: true
        });
      } catch (e) {
        // ignore widget render errors
      }
    };

    if (window.TradingView) {
      renderWidget();
    } else {
      const existing = document.getElementById('tradingview-tvjs');
      if (existing) {
        existing.addEventListener('load', renderWidget);
      } else {
        const script = document.createElement('script');
        script.id = 'tradingview-tvjs';
        script.type = 'text/javascript';
        script.src = 'https://s3.tradingview.com/tv.js';
        script.async = true;
        script.onload = renderWidget;
        document.body.appendChild(script);
      }
    }

    return () => {
      cancelled = true;
    };
  }, [symbol, interval, containerId]);

  return (
    <div
      id={containerId}
      ref={containerRef}
      style={{
        width: '100%',
        height,
        borderRadius: 8,
        overflow: 'hidden',
        background: 'var(--panel-card)',
        border: '1px solid var(--line)'
      }}
    />
  );
}
