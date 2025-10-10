/* Lightweight Charts demo for Trading-chart example */
(function () {
  const $ = (sel) => document.querySelector(sel);
  const on = (el, ev, fn) => el && el.addEventListener(ev, fn);

  const els = {
    area: $('#chartArea'),
    symbol: $('#symbol'),
    interval: $('#interval'),
    strategy: $('#strategy'),
    reload: $('#reload'),
    demoToggle: $('#demoToggle'),
    signals: $('#signals'),
    toast: $('#toast'),
    // personalization & stats
    botName: $('#botName'),
    botNameDisplay: $('#botNameDisplay'),
    hdrSymbol: $('#hdrSymbol'),
    pillStrategy: $('#pillStrategy'),
    pillMode: $('#pillMode'),
    equity: $('#equity'),
    pnlReal: $('#pnlReal'),
    pnlUnreal: $('#pnlUnreal'),
    lastUpdate: $('#lastUpdate'),
    statusDot: $('#statusDot'),
    statusText: $('#statusText'),
    positionBox: $('#positionBox'),
    closePositionBtn: $('#closePositionBtn'),
    risk: $('#risk'),
  };

  if (!window.LightweightCharts || !els.area) return;

  let chart, series, markers = [];
  let timer = null;
  let data = [];
  const START_EQUITY = 10000;
  let equity = START_EQUITY;
  let pnlRealized = 0;
  let position = null; // { side:'long', entry:number, qty:number }
  let lastPrice = 0;

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
    data = genCandles();
    series.setData(data);
    series.setMarkers(markers);
    chart.timeScale().fitContent();
    lastPrice = data[data.length - 1]?.close || 0;
    updateStats();
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
    const typeChar = type === 'buy' ? 'arrowUp' : 'arrowDown';
    const marker = { time: Math.floor(Date.now() / 1000), position: type === 'buy' ? 'belowBar' : 'aboveBar', color: type === 'buy' ? '#0f8' : '#f55', shape: typeChar, text: type.toUpperCase() };
    markers.push(marker);
    series.setMarkers(markers);

    // paper trade simulation
    if (els.demoToggle && els.demoToggle.checked) {
      if (type === 'buy') openPosition();
      else if (type === 'sell') closePosition();
    }
  }

  function positionFractionFromRisk() {
    const r = parseFloat(els.risk?.value || '0.02');
    // map 1%->5%, 2%->10%, 5%->25%
    return Math.min(0.3, Math.max(0.02, r * 5));
  }

  function openPosition() {
    if (position || !lastPrice) return;
    const f = positionFractionFromRisk();
    const notional = equity * f;
    const qty = +(notional / lastPrice).toFixed(6);
    position = { side: 'long', entry: lastPrice, qty };
    updatePositionBox();
    updateStats();
  }

  function closePosition() {
    if (!position || !lastPrice) return;
    const pnl = (lastPrice - position.entry) * position.qty;
    pnlRealized += pnl;
    equity += pnl;
    position = null;
    updatePositionBox();
    updateStats();
  }

  function formatMoney(v) {
    try { return v.toLocaleString('pt-BR', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }); }
    catch { return `$${v.toFixed(2)}`; }
  }

  function updatePositionBox() {
    if (!els.positionBox) return;
    if (!position) {
      els.positionBox.textContent = 'Sem posição aberta';
      els.closePositionBtn && (els.closePositionBtn.disabled = true);
    } else {
      const unreal = (lastPrice - position.entry) * position.qty;
      els.positionBox.textContent = `Long ${position.qty} @ ${position.entry.toFixed(2)} | PnL: ${formatMoney(unreal)}`;
      els.closePositionBtn && (els.closePositionBtn.disabled = false);
    }
  }

  function updateStats() {
    els.equity && (els.equity.textContent = formatMoney(equity));
    els.pnlReal && (els.pnlReal.textContent = formatMoney(pnlRealized));
    const unreal = position ? (lastPrice - position.entry) * position.qty : 0;
    els.pnlUnreal && (els.pnlUnreal.textContent = formatMoney(unreal));
    els.lastUpdate && (els.lastUpdate.textContent = new Date().toLocaleTimeString());
    if (els.statusDot) {
      els.statusDot.style.background = '#28c76f';
      els.statusDot.style.boxShadow = '0 0 10px rgba(40,199,111,.6)';
    }
    els.hdrSymbol && (els.hdrSymbol.textContent = els.symbol?.value || '—');
    els.pillStrategy && (els.pillStrategy.textContent = strategyLabel());
    els.pillMode && (els.pillMode.textContent = els.demoToggle?.checked ? 'Demo ON' : 'Demo OFF');
  }

  function strategyLabel() {
    const map = { trend: 'Trend Following', rsi: 'RSI', breakout: 'Breakout' };
    return map[els.strategy?.value] || '—';
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
    lastPrice = close;
    updateStats();

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
    on(els.symbol, 'change', () => { localStorage.setItem('symbol', els.symbol.value); updateStats(); regenData(); toast('Par alterado'); });
    on(els.interval, 'change', () => { localStorage.setItem('interval', els.interval.value); regenData(); toast('Intervalo alterado'); });
    on(els.strategy, 'change', () => { localStorage.setItem('strategy', els.strategy.value); updateStats(); toast('Estratégia alterada'); });
    on(els.demoToggle, 'change', () => { updateStats(); toast(els.demoToggle.checked ? 'Demo ON' : 'Demo OFF'); });
    on(els.botName, 'input', () => { const v = els.botName.value.trim() || 'Meu Robô'; localStorage.setItem('botName', v); els.botNameDisplay && (els.botNameDisplay.textContent = v); });
    on(els.closePositionBtn, 'click', () => { closePosition(); toast('Posição zerada'); });
    on(els.risk, 'change', () => { localStorage.setItem('risk', els.risk.value); toast('Risco ajustado'); });

    // restore prefs
    try {
      const savedName = localStorage.getItem('botName');
      if (savedName) { els.botName.value = savedName; els.botNameDisplay && (els.botNameDisplay.textContent = savedName); }
      const savedSym = localStorage.getItem('symbol'); if (savedSym) els.symbol.value = savedSym;
      const savedInt = localStorage.getItem('interval'); if (savedInt) els.interval.value = savedInt;
      const savedStrat = localStorage.getItem('strategy'); if (savedStrat) els.strategy.value = savedStrat;
      const savedRisk = localStorage.getItem('risk'); if (savedRisk) els.risk.value = savedRisk;
      updateStats();
    } catch {}

    startPolling();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
