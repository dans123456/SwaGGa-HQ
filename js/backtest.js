// SwaGGa HQ — Interactive Backtesting & Chart Simulator
// Renders the canvas chart, handles buy/sell mechanics, and saves results to the journal.

import { HISTORICAL_CHALLENGES, generateSMCCandles } from './backtest-data.js';
import { saveTrade } from './trading.js';
import { playSynthSound } from './audio.js';
import { addXP } from './xp.js';
import storage from './storage.js';

// --- State Management ---
let state = {
  candles: [],
  visibleCount: 20,
  balance: 10000,
  initialBalance: 10000,
  activeTrade: null, // { type: 'buy'|'sell', entry, stop, target, size, id }
  completedTrades: [],
  isPlaying: false,
  playSpeed: 1500, // ms per candle
  playInterval: null,
  activeAsset: 'EUR/USD',
  hoveredCandleIdx: -1
};

// --- DOM Builder & Tab Entry ---
export function renderBacktestSandbox(container) {
  container.replaceChildren();

  // Master Grid Layout
  const grid = el('div', 'backtest-grid');
  
  // Left Column (Chart & Playback Panel)
  const leftCol = el('div', 'backtest-left-col');
  const chartCard = el('div', 'backtest-chart-card glass-card');
  
  // Custom HUD at top of chart card
  const hud = el('div', 'backtest-hud');
  const sessionSelector = document.createElement('select');
  sessionSelector.className = 'form-select backtest-selector';
  
  const infiniteOpt = el('option', '', '🎯 Infinite SMC Sandbox');
  infiniteOpt.value = 'infinite';
  sessionSelector.appendChild(infiniteOpt);
  
  for (const [key, val] of Object.entries(HISTORICAL_CHALLENGES)) {
    const opt = el('option', '', val.name);
    opt.value = key;
    sessionSelector.appendChild(opt);
  }
  hud.appendChild(sessionSelector);

  const stats = el('div', 'backtest-hud-stats');
  const balSpan = el('span', 'backtest-hud-stat balance-stat', 'Balance: $10,000');
  const tradesSpan = el('span', 'backtest-hud-stat trades-stat', 'Trades: 0');
  stats.appendChild(balSpan);
  stats.appendChild(tradesSpan);
  hud.appendChild(stats);
  chartCard.appendChild(hud);

  // Canvas
  const canvasContainer = el('div', 'backtest-canvas-container');
  const canvas = document.createElement('canvas');
  canvas.id = 'backtest-canvas';
  canvasContainer.appendChild(canvas);
  chartCard.appendChild(canvasContainer);

  // Playback Control bar
  const playbackBar = el('div', 'backtest-playback-bar');
  const stepBtn = el('button', 'btn btn-outline btn-sm', '⏭ Step');
  const playBtn = el('button', 'btn btn-secondary btn-sm', '▶ Play');
  const speedSelect = document.createElement('select');
  speedSelect.className = 'form-select speed-selector btn-sm';
  
  const speedOptions = [
    { label: '1.0s / candle', val: 1000 },
    { label: '1.5s / candle', val: 1500 },
    { label: '2.5s / candle', val: 2500 }
  ];
  speedOptions.forEach(opt => {
    const elOpt = el('option', '', opt.label);
    elOpt.value = opt.val;
    speedSelect.appendChild(elOpt);
  });
  speedSelect.value = state.playSpeed;

  playbackBar.appendChild(stepBtn);
  playbackBar.appendChild(playBtn);
  playbackBar.appendChild(speedSelect);
  chartCard.appendChild(playbackBar);
  leftCol.appendChild(chartCard);

  // Right Column (Execution and Logs Panel)
  const rightCol = el('div', 'backtest-right-col');
  const executionCard = el('div', 'backtest-exec-card glass-card');
  executionCard.appendChild(el('h3', 'card-title', 'Execution Desk'));

  // Quick inputs
  const inputsGrid = el('div', 'backtest-inputs-grid');
  const sizeInput = document.createElement('input');
  sizeInput.type = 'number';
  sizeInput.value = '1';
  sizeInput.step = '0.1';
  sizeInput.className = 'form-input size-input';
  inputsGrid.appendChild(formGroup('Risk / Lots', sizeInput));

  const slInput = document.createElement('input');
  slInput.type = 'number';
  slInput.value = '0';
  slInput.step = 'any';
  slInput.className = 'form-input sl-input';
  inputsGrid.appendChild(formGroup('Stop Loss (SL)', slInput));

  const tpInput = document.createElement('input');
  tpInput.type = 'number';
  tpInput.value = '0';
  tpInput.step = 'any';
  tpInput.className = 'form-input tp-input';
  inputsGrid.appendChild(formGroup('Take Profit (TP)', tpInput));
  executionCard.appendChild(inputsGrid);

  // Buy/Sell buttons
  const orderRow = el('div', 'backtest-order-row');
  const buyBtn = el('button', 'btn btn-success buy-btn', '🟢 Market Buy');
  const sellBtn = el('button', 'btn btn-danger sell-btn', '🔴 Market Sell');
  orderRow.appendChild(buyBtn);
  orderRow.appendChild(sellBtn);
  executionCard.appendChild(orderRow);

  // Floating Position card
  const positionCard = el('div', 'backtest-position-card');
  executionCard.appendChild(positionCard);

  // Session stats & End Session button
  const endSessionBtn = el('button', 'btn btn-outline btn-sm end-session-btn', '🏁 End Backtest & Save');
  executionCard.appendChild(endSessionBtn);
  rightCol.appendChild(executionCard);

  // Recent simulated trades feed
  const historyCard = el('div', 'backtest-history-card glass-card');
  historyCard.appendChild(el('h3', 'card-title', 'Simulated Session Trades'));
  const listContainer = el('div', 'backtest-history-list');
  historyCard.appendChild(listContainer);
  rightCol.appendChild(historyCard);

  grid.appendChild(leftCol);
  grid.appendChild(rightCol);
  container.appendChild(grid);

  // --- Chart Sizing Helper ---
  function resizeCanvas() {
    const rect = canvasContainer.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = Math.max(rect.height, 350);
    drawChart();
  }

  // --- Active Position Rendering Helper ---
  function updatePositionHUD() {
    positionCard.replaceChildren();
    if (!state.activeTrade) {
      positionCard.style.display = 'none';
      buyBtn.disabled = false;
      sellBtn.disabled = false;
      return;
    }

    positionCard.style.display = 'block';
    buyBtn.disabled = true;
    sellBtn.disabled = true;

    const currentCandle = state.candles[state.visibleCount - 1];
    const currentPrice = currentCandle.close;
    
    // Floating P&L calculation
    let pnl = 0;
    if (state.activeTrade.type === 'buy') {
      pnl = (currentPrice - state.activeTrade.entry) * 100 * state.activeTrade.size;
    } else {
      pnl = (state.activeTrade.entry - currentPrice) * 100 * state.activeTrade.size;
    }

    const titleRow = el('div', 'pos-title-row');
    const badge = el('span', `pos-badge badge-${state.activeTrade.type}`, state.activeTrade.type.toUpperCase());
    const floatingSpan = el('span', `pos-pnl ${pnl >= 0 ? 'pnl-positive' : 'pnl-negative'}`);
    floatingSpan.textContent = `${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)}`;
    titleRow.appendChild(badge);
    titleRow.appendChild(floatingSpan);
    positionCard.appendChild(titleRow);

    const details = el('div', 'pos-details');
    details.appendChild(el('span', 'pos-detail-item', `Entry: ${state.activeTrade.entry}`));
    details.appendChild(el('span', 'pos-detail-item', `SL: ${state.activeTrade.stop || 'None'}`));
    details.appendChild(el('span', 'pos-detail-item', `TP: ${state.activeTrade.target || 'None'}`));
    positionCard.appendChild(details);

    const closeBtn = el('button', 'btn btn-outline btn-sm pos-close-btn', 'Close Position');
    closeBtn.addEventListener('click', () => {
      closePosition(currentPrice, 'Manual exit');
    });
    positionCard.appendChild(closeBtn);
  }

  // --- History List Rendering Helper ---
  function renderHistoryList() {
    listContainer.replaceChildren();
    if (!state.completedTrades.length) {
      listContainer.appendChild(el('div', 'empty-feed', 'No trades taken in this session.'));
      return;
    }

    state.completedTrades.forEach(t => {
      const item = el('div', 'sim-trade-item');
      const badge = el('span', `sim-badge badge-${t.type}`, t.type.toUpperCase());
      const pnlSpan = el('span', `sim-pnl ${t.pnl >= 0 ? 'pnl-positive' : 'pnl-negative'}`);
      pnlSpan.textContent = `${t.pnl >= 0 ? '+' : ''}$${t.pnl.toFixed(2)}`;
      
      const mainInfo = el('div', 'sim-info');
      mainInfo.appendChild(badge);
      mainInfo.appendChild(el('span', 'sim-pair', t.asset));
      mainInfo.appendChild(pnlSpan);
      
      const subInfo = el('span', 'sim-sub', `Entry: ${t.entry} → Exit: ${t.exit} | ${t.reason}`);
      
      item.appendChild(mainInfo);
      item.appendChild(subInfo);
      listContainer.appendChild(item);
    });

    tradesSpan.textContent = `Trades: ${state.completedTrades.length}`;
  }

  // --- Execute Buy/Sell Markets ---
  function openPosition(type) {
    const currentPrice = state.candles[state.visibleCount - 1].close;
    const size = parseFloat(sizeInput.value) || 1;
    const stop = parseFloat(slInput.value) || 0;
    const target = parseFloat(tpInput.value) || 0;

    state.activeTrade = {
      id: crypto.randomUUID ? crypto.randomUUID() : String(Math.random()),
      type,
      entry: currentPrice,
      stop,
      target,
      size
    };

    updatePositionHUD();
    drawChart();
  }

  function closePosition(exitPrice, reason = 'Exit') {
    if (!state.activeTrade) return;

    let pnl = 0;
    if (state.activeTrade.type === 'buy') {
      pnl = (exitPrice - state.activeTrade.entry) * 100 * state.activeTrade.size;
    } else {
      pnl = (state.activeTrade.entry - exitPrice) * 100 * state.activeTrade.size;
    }

    const tradeRecord = {
      asset: state.activeAsset,
      type: state.activeTrade.type,
      entry: state.activeTrade.entry,
      exit: exitPrice,
      stop: state.activeTrade.stop,
      target: state.activeTrade.target,
      size: state.activeTrade.size,
      pnl: parseFloat(pnl.toFixed(2)),
      reason
    };

    state.balance = parseFloat((state.balance + pnl).toFixed(2));
    state.completedTrades.push(tradeRecord);
    state.activeTrade = null;

    balSpan.textContent = `Balance: $${state.balance.toLocaleString()}`;

    // Synthetic audio beep feedback
    if (pnl > 0) {
      playSynthSound('success');
    } else {
      playSynthSound('fail');
    }

    updatePositionHUD();
    renderHistoryList();
    drawChart();
  }

  // --- Event Bindings ---
  buyBtn.addEventListener('click', () => openPosition('buy'));
  sellBtn.addEventListener('click', () => openPosition('sell'));

  stepBtn.addEventListener('click', () => {
    stepCandle();
  });

  playBtn.addEventListener('click', () => {
    if (state.isPlaying) {
      pauseTimeline();
    } else {
      playTimeline();
    }
  });

  speedSelect.addEventListener('change', () => {
    state.playSpeed = parseInt(speedSelect.value);
    if (state.isPlaying) {
      pauseTimeline();
      playTimeline();
    }
  });

  sessionSelector.addEventListener('change', () => {
    initSession(sessionSelector.value);
  });

  // End backtest & log to main journal
  endSessionBtn.addEventListener('click', () => {
    if (!state.completedTrades.length) {
      alert('You must execute at least one simulated trade to save a session.');
      return;
    }

    pauseTimeline();

    // Calculate aggregate performance
    const totalWins = state.completedTrades.filter(t => t.pnl > 0).length;
    const winRate = Math.round((totalWins / state.completedTrades.length) * 100);
    const netPnL = parseFloat(state.completedTrades.reduce((s, t) => s + t.pnl, 0).toFixed(2));
    const xpGained = state.completedTrades.length * 15 + (netPnL > 0 ? 50 : 0);

    // Save each simulated trade to the permanent storage trades namespace
    state.completedTrades.forEach(sim => {
      saveTrade({
        asset: `${sim.asset} [Backtest]`,
        direction: sim.type,
        entry: sim.entry,
        exit: sim.exit,
        stop: sim.stop,
        size: sim.size,
        fees: 0,
        slippage: 0,
        date: new Date().toISOString().slice(0, 10),
        timeframe: 'M15',
        session: 'Backtest Sandbox',
        confluences: ['Backtesting Simulator'],
        outcome: sim.pnl > 0 ? 'win' : (sim.pnl < 0 ? 'loss' : 'break-even'),
        notes: `Simulated trade during ${sessionSelector.options[sessionSelector.selectedIndex].text}. Exit Reason: ${sim.reason}.`
      });
    });

    // Award XP
    addXP(xpGained);
    playSynthSound('fanfare');

    // Notify user via overlay popup
    const overlay = el('div', 'welcome-modal-overlay');
    const modal = el('div', 'welcome-modal');
    modal.appendChild(el('span', 'welcome-modal__emoji', '🏆'));
    modal.appendChild(el('h2', 'welcome-modal__title', 'Session Complete!'));
    
    const statsRow = el('div', 'welcome-stats-row');
    const data = [
      { icon: '📊', value: String(state.completedTrades.length), label: 'Trades' },
      { icon: '🎯', value: `${winRate}%`, label: 'Win Rate' },
      { icon: '💰', value: `${netPnL >= 0 ? '+' : ''}$${netPnL}`, label: 'Net Return' }
    ];
    data.forEach(s => {
      const item = el('div', 'welcome-stat-item');
      item.appendChild(el('span', 'welcome-stat-icon', s.icon));
      item.appendChild(el('span', 'welcome-stat-value', s.value));
      item.appendChild(el('span', 'welcome-stat-label', s.label));
      statsRow.appendChild(item);
    });
    modal.appendChild(statsRow);

    const desc = el('p', 'welcome-modal__text');
    desc.textContent = `All simulated trades have been synced and saved to your permanent Trading Journal under [Backtest] tags. You earned +${xpGained} XP!`;
    modal.appendChild(desc);

    const btn = el('button', 'welcome-modal__btn', 'Awesome 🚀');
    btn.addEventListener('click', () => {
      overlay.remove();
      initSession(sessionSelector.value); // reset sandbox
    });
    modal.appendChild(btn);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
  });

  // Canvas Mouse interactions
  canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const padding = 45;
    const chartWidth = canvas.width - padding * 2;
    const candleWidth = chartWidth / state.visibleCount;
    
    const hoverIdx = Math.floor((x - padding) / candleWidth);
    if (hoverIdx >= 0 && hoverIdx < state.visibleCount) {
      state.hoveredCandleIdx = hoverIdx;
      drawChart();
    } else {
      state.hoveredCandleIdx = -1;
    }
  });

  canvas.addEventListener('mouseleave', () => {
    state.hoveredCandleIdx = -1;
    drawChart();
  });

  // --- Initialize Session data ---
  function initSession(sessionKey) {
    pauseTimeline();
    state.completedTrades = [];
    state.activeTrade = null;
    
    if (sessionKey === 'infinite') {
      state.candles = generateSMCCandles(80);
      state.activeAsset = 'EUR/USD';
      state.initialBalance = 10000;
    } else {
      const challenge = HISTORICAL_CHALLENGES[sessionKey];
      state.candles = JSON.parse(JSON.stringify(challenge.candles));
      state.activeAsset = challenge.asset;
      state.initialBalance = challenge.initialBalance;
    }

    state.visibleCount = Math.min(20, state.candles.length);
    state.balance = state.initialBalance;

    balSpan.textContent = `Balance: $${state.balance.toLocaleString()}`;
    
    // Auto-load current price inside SL/TP inputs
    const currentPrice = state.candles[state.visibleCount - 1].close;
    slInput.value = currentPrice;
    tpInput.value = currentPrice;

    updatePositionHUD();
    renderHistoryList();
    
    setTimeout(() => {
      resizeCanvas();
    }, 100);
  }

  // --- Playback Loop Mechanics ---
  function stepCandle() {
    if (state.visibleCount >= state.candles.length) {
      pauseTimeline();
      alert('You have reached the end of this backtesting scenario!');
      return;
    }

    state.visibleCount++;
    const currentCandle = state.candles[state.visibleCount - 1];
    const currentPrice = currentCandle.close;

    // Check mitigation of active positions
    if (state.activeTrade) {
      const t = state.activeTrade;
      const high = currentCandle.high;
      const low = currentCandle.low;

      if (t.type === 'buy') {
        if (t.stop && low <= t.stop) {
          closePosition(t.stop, 'Hit Stop Loss 🛑');
        } else if (t.target && high >= t.target) {
          closePosition(t.target, 'Hit Take Profit 🎯');
        }
      } else {
        if (t.stop && high >= t.stop) {
          closePosition(t.stop, 'Hit Stop Loss 🛑');
        } else if (t.target && low <= t.target) {
          closePosition(t.target, 'Hit Take Profit 🎯');
        }
      }
    }

    updatePositionHUD();
    drawChart();
  }

  function playTimeline() {
    state.isPlaying = true;
    playBtn.textContent = '⏸ Pause';
    state.playInterval = setInterval(stepCandle, state.playSpeed);
  }

  function pauseTimeline() {
    state.isPlaying = false;
    playBtn.textContent = '▶ Play';
    if (state.playInterval) {
      clearInterval(state.playInterval);
      state.playInterval = null;
    }
  }

  // Init canvas size bindings
  window.addEventListener('resize', resizeCanvas);
  initSession('infinite');
}

// --- HTML5 Canvas Custom Chart Renderer ---
function drawChart() {
  const canvas = document.getElementById('backtest-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const w = canvas.width;
  const h = canvas.height;
  
  // Clear canvas
  ctx.clearRect(0, 0, w, h);

  // Canvas bounds padding
  const paddingX = 45;
  const paddingTop = 40;
  const paddingBottom = 30;

  // Retrieve visible slice of data
  const visibleCandles = state.candles.slice(0, state.visibleCount);
  if (!visibleCandles.length) return;

  // Calculate dynamic scale limits (MIN / MAX including wicks)
  let maxPrice = -999999;
  let minPrice = 999999;
  visibleCandles.forEach(c => {
    if (c.high > maxPrice) maxPrice = c.high;
    if (c.low < minPrice) minPrice = c.low;
  });

  // Include open position SL/TP lines to prevent them drawing off-screen
  if (state.activeTrade) {
    const t = state.activeTrade;
    if (t.stop) {
      minPrice = Math.min(minPrice, t.stop);
      maxPrice = Math.max(maxPrice, t.stop);
    }
    if (t.target) {
      minPrice = Math.min(minPrice, t.target);
      maxPrice = Math.max(maxPrice, t.target);
    }
  }

  // Add 10% breathing room to price bounds
  const priceRange = maxPrice - minPrice;
  maxPrice += priceRange * 0.08;
  minPrice -= priceRange * 0.08;

  // Render Horizontal Gridlines & Price Scales
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
  ctx.lineWidth = 1;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
  ctx.font = '10px Outfit, sans-serif';
  ctx.textAlign = 'right';

  const gridLineCount = 5;
  for (let i = 0; i <= gridLineCount; i++) {
    const yVal = maxPrice - (i * (maxPrice - minPrice)) / gridLineCount;
    // Align grid line coordinates exactly on .5 for pixel sharpness
    const y = Math.floor(paddingTop + (i * (h - paddingTop - paddingBottom)) / gridLineCount) + 0.5;
    
    // Draw gridline
    ctx.beginPath();
    ctx.moveTo(paddingX, y);
    ctx.lineTo(w - paddingX, y);
    ctx.stroke();

    // Draw Price label
    ctx.fillText(yVal.toFixed(2), paddingX - 8, y + 3);
  }

  // Render Candlesticks
  const chartWidth = w - paddingX * 2;
  const candleWidth = chartWidth / state.visibleCount;
  
  // Human developer spacing: keep a clean, balanced gap between bodies
  const bodyPadding = Math.min(6, Math.max(1.5, candleWidth * 0.12));

  // Premium TradingView Palette
  const bullBody = 'rgba(8, 153, 129, 0.35)'; // semi-trans translucent green body fill
  const bullBorder = '#089981';                // crisp TradingView Emerald Green
  const bearBody = 'rgba(242, 54, 69, 0.35)';  // semi-trans translucent red body fill
  const bearBorder = '#f23645';                // crisp TradingView Crimson Red

  visibleCandles.forEach((c, idx) => {
    const x = paddingX + idx * candleWidth;
    
    // Convert price to Y coordinates
    const scaleY = (price) => {
      return paddingTop + ((maxPrice - price) / (maxPrice - minPrice)) * (h - paddingTop - paddingBottom);
    };

    const yOpen = scaleY(c.open);
    const yClose = scaleY(c.close);
    const yHigh = scaleY(c.high);
    const yLow = scaleY(c.low);

    const isBullish = c.close >= c.open;
    const bodyColor = isBullish ? bullBody : bearBody;
    const borderColor = isBullish ? bullBorder : bearBorder;

    // Center wick exactly on the 0.5px boundary for ultra-crisp 1.5px lines
    const wickX = Math.floor(x + candleWidth / 2) + 0.5;

    // 1. Draw thin, high-fidelity Wick
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(wickX, Math.floor(yHigh));
    ctx.lineTo(wickX, Math.floor(yLow));
    ctx.stroke();

    // 2. Draw Candlestick body with 1px border
    const rectX = Math.floor(x + bodyPadding);
    const rectY = Math.floor(Math.min(yOpen, yClose));
    const rectW = Math.floor(candleWidth - bodyPadding * 2);
    const rectH = Math.max(2, Math.floor(Math.abs(yClose - yOpen)));

    // Fill body
    ctx.fillStyle = bodyColor;
    ctx.fillRect(rectX, rectY, rectW, rectH);

    // Stroke body outline
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 1;
    ctx.strokeRect(rectX + 0.5, rectY + 0.5, rectW - 1, rectH - 1);

    // Highlight hovered candle
    if (idx === state.hoveredCandleIdx) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
      ctx.fillRect(Math.floor(x), paddingTop, Math.floor(candleWidth), h - paddingTop - paddingBottom);
    }
  });

  // Render Hover tooltip info
  if (state.hoveredCandleIdx >= 0 && state.hoveredCandleIdx < visibleCandles.length) {
    const c = visibleCandles[state.hoveredCandleIdx];
    ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
    ctx.font = '11px Outfit, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(
      `O: ${c.open.toFixed(2)}   H: ${c.high.toFixed(2)}   L: ${c.low.toFixed(2)}   C: ${c.close.toFixed(2)}`,
      paddingX,
      20
    );
  }

  // Render Trading SL / TP overlays
  if (state.activeTrade) {
    const t = state.activeTrade;
    const scaleY = (price) => {
      return paddingTop + ((maxPrice - price) / (maxPrice - minPrice)) * (h - paddingTop - paddingBottom);
    };

    const drawDashedLine = (price, color, label) => {
      const y = Math.floor(scaleY(price)) + 0.5;
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 4]);
      
      ctx.beginPath();
      ctx.moveTo(paddingX, y);
      ctx.lineTo(w - paddingX, y);
      ctx.stroke();
      ctx.setLineDash([]); // Reset line dash

      // Label badge background
      ctx.fillStyle = color;
      ctx.fillRect(w - paddingX - 65, y - 8, 65, 16);
      
      // Label text
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 9px Outfit, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(label, w - paddingX - 32, y + 3);
    };

    drawDashedLine(t.entry, '#facc15', 'ENTRY');
    if (t.stop) drawDashedLine(t.stop, '#f23645', `SL: ${t.stop}`);
    if (t.target) drawDashedLine(t.target, '#089981', `TP: ${t.target}`);
  }
}

// --- Element and Form utilities ---
function el(tag, classNames = '', text = '') {
  const node = document.createElement(tag);
  if (classNames) node.className = classNames;
  if (text) node.textContent = text;
  return node;
}

function formGroup(labelText, inputElement) {
  const group = el('div', 'form-group');
  const label = el('label', 'form-label', labelText);
  const tag = inputElement.tagName.toLowerCase();
  if (tag === 'input') inputElement.classList.add('form-input');
  else if (tag === 'select') inputElement.classList.add('form-select');
  group.appendChild(label);
  group.appendChild(inputElement);
  return group;
}
