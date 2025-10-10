/* Lightweight Charts demo for Trading-chart example */
(function () {
  const $ = (sel) => document.querySelector(sel);
  const on = (el, ev, fn) => el && el.addEventListener(ev, fn);

  const els = {
    area: $('#chartArea'),
    symbol: $('#symbol'),
    interval: $('#interval'),
    reload: $('#reload'),
    demoToggle: $('#demoToggle'),
    signals: $('#signals'),
    toast: $('#toast'),
  };

  if (!window.LightweightCharts || !els.area) return;

  let chart, series, markers = [];
  let timer = null;

  function toast(msg) {
    if (!els.toast) return;
    els.toast.textContent = msg;
    els.toast.style.opacity = '1';
    els.toast.style.transform = 'translateY(0)';
    setTimeout(() => {
      els.toast.style.opacity = '0';
      els.toast.style.transform = 'translateY(10px)';
    }, 1800);
  }

  // Random data generator (no external APIs to avoid CORS or rate limits)
  function genCandles(count = 180, startTs = Math.floor(Date.now() / 1000) - count * 60) {
    const candles = [];
    let last = 50000 + Math.random() * 2000; // arbitrary baseline
    for (let i = 0; i < count; i++) {
      const ts = startTs + i * 60; // 1m step by default, chart will just render
      const drift = (Math.random() - 0.5) * 100;
      const open = last;
      const close = last + drift;
      const high = Math.max(open, close) + Math.random() * 60;
      const low = Math.min(open, close) - Math.random() * 60;
      candles.push({ time: ts, open, high, low, close });
      last = close;
    }
    return candles;
  }

  function sizeChart() {
    if (!chart || !els.area) return;
    const rect = els.area.getBoundingClientRect();
    const w = Math.max(240, Math.floor(rect.width));
    const h = Math.max(200, Math.floor(rect.height));
    chart.resize(w, h);
  }

  function initChart() {
    if (chart) return;
    chart = LightweightCharts.createChart(els.area, {
      layout: {
        background: { type: 'solid', color: '#0b1b2d' },
        textColor: '#cbe6ff',
      },
      grid: {
        vertLines: { color: 'rgba(255,255,255,0.06)' },
        horzLines: { color: 'rgba(255,255,255,0.06)' },
      },
      crosshair: { mode: 1 },
      rightPriceScale: { borderColor: 'rgba(255,255,255,0.12)' },
      timeScale: { borderColor: 'rgba(255,255,255,0.12)', timeVisible: true, secondsVisible: false },
    });
    series = chart.addCandlestickSeries({
      upColor: '#00e18e', downColor: '#ff4d6d', borderVisible: false, wickUpColor: '#00e18e', wickDownColor: '#ff4d6d',
    });

    // Handle resize
    if (window.ResizeObserver) {
      const ro = new ResizeObserver(() => sizeChart());
      ro.observe(els.area);
    } else {
      window.addEventListener('resize', sizeChart);
    }
  }

  function regenData() {
    markers = [];
    series.setData(genCandles());
    series.setMarkers(markers);
    chart.timeScale().fitContent();
  }

  function addSignal(type) {
    if (!els.signals) return;
    const now = new Date();
    const el = document.createElement('div');
    el.className = 'sig';
    el.style.display = 'flex';
    el.style.alignItems = 'center';
    el.style.gap = '8px';
    const badge = document.createElement('span');
    badge.textContent = type === 'buy' ? 'COMPRA' : 'VENDA';
    badge.style.padding = '3px 8px';
    badge.style.borderRadius = '999px';
    badge.style.fontWeight = '800';
    badge.style.fontSize = '12px';
    badge.style.background = type === 'buy' ? '#074' : '#702';
    badge.style.color = '#fff';
    const text = document.createElement('span');
    text.style.opacity = '.9';
    text.textContent = `${now.toLocaleTimeString()} • ${els.symbol?.value || 'BTCUSDT'}`;
    el.appendChild(badge);
    el.appendChild(text);
    els.signals.prepend(el);

    // Put a marker on last bar
    const last = series && series._series && series._series._points ? null : null; // guard
    const typeChar = type === 'buy' ? 'arrowUp' : 'arrowDown';
    const marker = { time: Math.floor(Date.now() / 1000), position: type === 'buy' ? 'belowBar' : 'aboveBar', color: type === 'buy' ? '#0f8' : '#f55', shape: typeChar, text: type.toUpperCase() };
    markers.push(marker);
    series.setMarkers(markers);
  }

  function tickAppend() {
    // append new candle by mutating last close -> new candle
    const now = Math.floor(Date.now() / 1000);
    const lastData = series._data && series._data.length ? series._data[series._data.length - 1] : null;
    const prev = lastData || { time: now - 60, open: 50000, high: 50050, low: 49950, close: 50000 };
    const open = prev.close;
    const close = open + (Math.random() - 0.5) * 120;
    const high = Math.max(open, close) + Math.random() * 60;
    const low = Math.min(open, close) - Math.random() * 60;
    const candle = { time: prev.time + 60, open, high, low, close };
    series.update(candle);

    if (els.demoToggle && els.demoToggle.checked) {
      if (Math.random() < 0.5) addSignal(Math.random() < 0.5 ? 'buy' : 'sell');
    }
  }

  function startPolling() {
    stopPolling();
    timer = setInterval(tickAppend, 5000);
  }
  function stopPolling() { if (timer) { clearInterval(timer); timer = null; } }

  function boot() {
    initChart();
    regenData();
    sizeChart();

    on(els.reload, 'click', () => { regenData(); toast('Histórico recarregado'); });
    on(els.symbol, 'change', () => { regenData(); toast('Par alterado'); });
    on(els.interval, 'change', () => { regenData(); toast('Intervalo alterado'); });
    on(els.demoToggle, 'change', () => { toast(els.demoToggle.checked ? 'Demo ON' : 'Demo OFF'); });

    startPolling();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();

