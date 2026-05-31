// SwaGGa HQ — Trading Journal Module
// Handles logging, table rendering, stats, and confluence analytics.
// Keep it safe: all dynamic user data is rendered using createElement + textContent.

import storage from './storage.js';
import {
  generateId,
  formatDate,
  formatCurrency,
  calculatePnL,
  calculateRiskReward,
  calculateWinRate,
  sanitizeText,
} from './utils.js';
import { addXP } from './xp.js';

// --- Constants ---

// Tradeable assets catalog grouped by category
export const ASSETS = {
  'Forex Majors': [
    'EUR/USD', 'GBP/USD', 'USD/JPY', 'USD/CHF', 'AUD/USD', 'NZD/USD', 'USD/CAD',
  ],
  'Forex Minors': [
    'EUR/GBP', 'EUR/AUD', 'GBP/JPY', 'EUR/JPY', 'AUD/JPY',
    'GBP/AUD', 'EUR/CAD', 'GBP/CAD', 'AUD/NZD',
  ],
  'Gold & Metals': ['XAU/USD', 'XAU/EUR', 'XAG/USD'],
  'Crypto': ['BTC/USD', 'BTC/USDT'],
  'Indices': ['US30', 'NAS100', 'SPX500', 'GER40', 'UK100'],
  'Volatility Indices': [
    'Volatility 10', 'Volatility 15', 'Volatility 25',
    'Volatility 50', 'Volatility 75', 'Volatility 100',
  ],
  'Volatility (1s)': [
    'Volatility 10 (1s)', 'Volatility 15 (1s)', 'Volatility 25 (1s)',
    'Volatility 50 (1s)', 'Volatility 75 (1s)', 'Volatility 100 (1s)',
  ],
};

// Confluences / edge factors tagged on trades
export const CONFLUENCE_OPTIONS = [
  'Market Structure (BOS/CHOCH) [Ep 5]',
  'Candlestick Confirmation [Ep 6]',
  'Supply/Demand Zone [Ep 7]',
  'Premium / Discount (Fib OTE) [Ep 8]',
  'Fair Value Gaps (FVG) [Ep 9]',
  'Top Down Analysis (HTF Bias) [Ep 11]',
  'ICT Killzones Timing [Ep 12]',
  'Liquidity Sweeps / Inducements [Ep 13]',
];

const STORAGE_KEY = 'trades';

const TV_SYMBOL_MAP = {
  'EUR/USD': 'FX:EURUSD',
  'GBP/USD': 'FX:GBPUSD',
  'USD/JPY': 'FX:USDJPY',
  'USD/CHF': 'FX:USDCHF',
  'AUD/USD': 'FX:AUDUSD',
  'NZD/USD': 'FX:NZDUSD',
  'USD/CAD': 'FX:USDCAD',
  'EUR/GBP': 'FX:EURGBP',
  'EUR/AUD': 'FX:EURAUD',
  'GBP/JPY': 'FX:GBPJPY',
  'EUR/JPY': 'FX:EURJPY',
  'AUD/JPY': 'FX:AUDJPY',
  'GBP/AUD': 'FX:GBPAUD',
  'EUR/CAD': 'FX:EURCAD',
  'GBP/CAD': 'FX:GBPCAD',
  'AUD/NZD': 'FX:AUDNZD',
  'XAU/USD': 'TVC:GOLD',
  'XAU/EUR': 'FX:XAUEUR',
  'XAG/USD': 'TVC:SILVER',
  'BTC/USD': 'COINBASE:BTCUSD',
  'BTC/USDT': 'BINANCE:BTCUSDT',
  'US30': 'TVC:DJI',
  'NAS100': 'PEPPERSTONE:NAS100',
  'SPX500': 'FOREXCOM:SPXUSD',
  'GER40': 'PEPPERSTONE:GER40',
  'UK100': 'PEPPERSTONE:UK100',
  'Volatility 10': 'DERIV:VOLATILITY10',
  'Volatility 15': 'DERIV:VOLATILITY15',
  'Volatility 25': 'DERIV:VOLATILITY25',
  'Volatility 50': 'DERIV:VOLATILITY50',
  'Volatility 75': 'DERIV:VOLATILITY75',
  'Volatility 100': 'DERIV:VOLATILITY100',
  'Volatility 10 (1s)': 'DERIV:1HZ10V',
  'Volatility 15 (1s)': 'DERIV:1HZ15V',
  'Volatility 25 (1s)': 'DERIV:1HZ25V',
  'Volatility 50 (1s)': 'DERIV:1HZ50V',
  'Volatility 75 (1s)': 'DERIV:1HZ75V',
  'Volatility 100 (1s)': 'DERIV:1HZ100V',
};

// Flat list of all assets for the chart selector
const ALL_ASSETS = Object.values(ASSETS).flat();

// Symbol chosen via auto-assignment to pre-load on Live Chart
let _pendingChartSymbol = null;

// --- Data Layer ---

// Gets all trades saved in storage
export function getTrades() {
  return storage.get(STORAGE_KEY, []);
}

// Persists a new trade to local storage and updates setup quality
export function saveTrade(tradeData) {
  const trades = getTrades();
  const confCount = Array.isArray(tradeData.confluences) ? tradeData.confluences.length : 0;
  let setupQuality = 'C';
  if (confCount >= 5) setupQuality = 'A+';
  else if (confCount === 4) setupQuality = 'A';
  else if (confCount === 3) setupQuality = 'B';

  const trade = {
    id: generateId(),
    ...tradeData,
    setupQuality,
    pnl: calculatePnL(
      tradeData.entry,
      tradeData.exit,
      tradeData.size,
      tradeData.direction,
      tradeData.fees,
      tradeData.slippage,
    ),
    rr: calculateRiskReward(tradeData.entry, tradeData.stop, tradeData.exit),
    createdAt: new Date().toISOString(),
  };
  trades.push(trade);
  storage.set(STORAGE_KEY, trades);
  return trade;
}

// Remove a trade record
export function deleteTrade(id) {
  const trades = getTrades().filter((t) => t.id !== id);
  storage.set(STORAGE_KEY, trades);
}

// --- Stats Calculations ---

// Computes aggregate statistics for the dashboard/panels
export function calculateStats(trades) {
  if (!trades.length) {
    return { totalTrades: 0, winRate: 0, totalPnL: 0, avgRR: 0 };
  }
  const totalPnL = trades.reduce((s, t) => s + (Number(t.pnl) || 0), 0);
  const avgRR =
    trades.reduce((s, t) => s + (Number(t.rr) || 0), 0) / trades.length;
  return {
    totalTrades: trades.length,
    winRate: calculateWinRate(trades),
    totalPnL: parseFloat(totalPnL.toFixed(2)),
    avgRR: parseFloat(avgRR.toFixed(2)),
  };
}

// --- DOM Builders (exclusively createElement + textContent for safety) ---

// Helper to quickly create elements with class and text
function el(tag, classNames = '', text = '') {
  const node = document.createElement(tag);
  if (classNames) node.className = classNames;
  if (text) node.textContent = text;
  return node;
}

// Wrap forms with consistent labels and container classes
function formGroup(labelText, inputElement) {
  const group = el('div', 'form-group');
  const label = el('label', 'form-label', labelText);
  // Add appropriate class to the input element based on its tag
  const tag = inputElement.tagName.toLowerCase();
  if (tag === 'input') inputElement.classList.add('form-input');
  else if (tag === 'select') inputElement.classList.add('form-select');
  else if (tag === 'textarea') inputElement.classList.add('form-textarea');
  group.appendChild(label);
  group.appendChild(inputElement);
  return group;
}

// --- Stats Bar ---

function renderStatsBar(container, stats) {
  container.replaceChildren();
  const bar = el('div', 'stats-bar');

  const items = [
    { label: 'Total Trades', value: String(stats.totalTrades), icon: '📈' },
    { label: 'Win Rate', value: `${stats.winRate}%`, icon: '🎯' },
    { label: 'Total P&L', value: formatCurrency(stats.totalPnL), icon: '💰' },
    { label: 'Avg R:R', value: `${stats.avgRR}R`, icon: '⚖️' },
  ];

  items.forEach(({ label, value, icon }) => {
    const card = el('div', 'stat-card');
    const iconSpan = el('span', 'stat-icon', icon);
    const labelSpan = el('span', 'stat-label', label);
    const valueSpan = el('span', 'stat-value', value);
    card.appendChild(iconSpan);
    card.appendChild(labelSpan);
    card.appendChild(valueSpan);
    bar.appendChild(card);
  });

  container.appendChild(bar);
}

/* ---------- Canvas Chart Painter --------------------------------- */

function openCanvasPainter(originalDataUrl, onSave) {
  const overlay = el('div', 'painter-overlay');
  const modal = el('div', 'painter-modal glass-card');

  // Header Bar
  const header = el('div', 'painter-header');
  header.appendChild(el('h2', 'painter-title', '🎨 SwaGGa Chart Annotator'));
  const closeBtn = el('button', 'painter-close', '✕');
  closeBtn.addEventListener('click', () => overlay.remove());
  header.appendChild(closeBtn);
  modal.appendChild(header);

  // Tools & Colors Panel (Toolbelt)
  const toolbelt = el('div', 'painter-toolbelt');

  // Tool Selectors
  const toolsGroup = el('div', 'painter-tool-group');
  const tools = [
    { id: 'brush', label: '🖌️ Brush' },
    { id: 'line', label: '📐 Line' },
    { id: 'rect', label: '⬜ Zone' },
    { id: 'arrow', label: '↗ Arrow' },
    { id: 'text', label: '🔤 Text' }
  ];
  let activeTool = 'brush';
  const toolButtons = {};

  tools.forEach(t => {
    const btn = el('button', `btn btn-outline btn-sm tool-btn${t.id === activeTool ? ' active' : ''}`, t.label);
    btn.type = 'button';
    btn.addEventListener('click', () => {
      Object.values(toolButtons).forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeTool = t.id;
    });
    toolButtons[t.id] = btn;
    toolsGroup.appendChild(btn);
  });
  toolbelt.appendChild(toolsGroup);

  // Color Selectors
  const colorsGroup = el('div', 'painter-color-group');
  const colors = [
    { hex: '#089981', label: '🟢' },
    { hex: '#f23645', label: '🔴' },
    { hex: '#facc15', label: '🟡' },
    { hex: '#b44dff', label: '🟣' },
    { hex: '#ffffff', label: '⚪' }
  ];
  let activeColor = '#089981';
  const colorButtons = {};

  colors.forEach(c => {
    const btn = el('button', `painter-color-btn${c.hex === activeColor ? ' active' : ''}`);
    btn.type = 'button';
    btn.style.backgroundColor = c.hex;
    btn.addEventListener('click', () => {
      Object.values(colorButtons).forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeColor = c.hex;
    });
    colorButtons[c.hex] = btn;
    colorsGroup.appendChild(btn);
  });
  toolbelt.appendChild(colorsGroup);

  // Control Actions (Undo, Clear)
  const actionsGroup = el('div', 'painter-action-group');
  const undoBtn = el('button', 'btn btn-ghost btn-sm', '↩️ Undo');
  undoBtn.type = 'button';
  const clearBtn = el('button', 'btn btn-ghost btn-sm', '🗑️ Clear');
  clearBtn.type = 'button';
  actionsGroup.appendChild(undoBtn);
  actionsGroup.appendChild(clearBtn);
  toolbelt.appendChild(actionsGroup);

  modal.appendChild(toolbelt);

  // Canvas Workspace area
  const workspace = el('div', 'painter-workspace');
  const canvas = document.createElement('canvas');
  workspace.appendChild(canvas);
  modal.appendChild(workspace);

  // Save / Apply bar at bottom
  const footer = el('div', 'painter-footer');
  const cancelBtn = el('button', 'btn btn-outline btn-sm', 'Cancel');
  cancelBtn.type = 'button';
  const saveBtn = el('button', 'btn btn-primary btn-sm', '💾 Apply Annotations');
  saveBtn.type = 'button';
  footer.appendChild(cancelBtn);
  footer.appendChild(saveBtn);
  modal.appendChild(footer);

  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  // Canvas Rendering & Drawing Logic
  const ctx = canvas.getContext('2d');
  const img = new Image();
  img.src = originalDataUrl;

  let history = [];

  function saveState() {
    history.push(canvas.toDataURL());
  }

  img.onload = () => {
    // Resize canvas based on aspect ratio
    const maxWidth = window.innerWidth * 0.85;
    const maxHeight = window.innerHeight * 0.6;
    let width = img.width;
    let height = img.height;

    if (width > maxWidth) {
      height = (maxWidth / width) * height;
      width = maxWidth;
    }
    if (height > maxHeight) {
      width = (maxHeight / height) * width;
      height = maxHeight;
    }

    canvas.width = Math.floor(width);
    canvas.height = Math.floor(height);

    // Initial draw
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    saveState();
  };

  // Drawing event variables
  let drawing = false;
  let startX = 0;
  let startY = 0;

  function getMousePos(e) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  }

  function restoreLastState() {
    return new Promise((resolve) => {
      if (!history.length) return resolve();
      const lastImg = new Image();
      lastImg.src = history[history.length - 1];
      lastImg.onload = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(lastImg, 0, 0);
        resolve();
      };
    });
  }

  canvas.addEventListener('mousedown', (e) => {
    drawing = true;
    const pos = getMousePos(e);
    startX = pos.x;
    startY = pos.y;

    if (activeTool === 'brush') {
      saveState();
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y);
      ctx.strokeStyle = activeColor;
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
    } else if (activeTool === 'line' || activeTool === 'rect' || activeTool === 'arrow') {
      saveState();
    }
  });

  canvas.addEventListener('mousemove', async (e) => {
    if (!drawing) return;
    const pos = getMousePos(e);

    if (activeTool === 'brush') {
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
    } else if (activeTool === 'line') {
      await restoreLastState();
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(pos.x, pos.y);
      ctx.strokeStyle = activeColor;
      ctx.lineWidth = 3.5;
      ctx.stroke();
    } else if (activeTool === 'rect') {
      await restoreLastState();
      const w = pos.x - startX;
      const h = pos.y - startY;
      
      // Semi-transparent glowing fill + solid border
      ctx.fillStyle = hexToRgba(activeColor, 0.12);
      ctx.fillRect(startX, startY, w, h);
      ctx.strokeStyle = activeColor;
      ctx.lineWidth = 2;
      ctx.strokeRect(startX, startY, w, h);
    } else if (activeTool === 'arrow') {
      await restoreLastState();
      ctx.strokeStyle = activeColor;
      ctx.lineWidth = 3;
      drawArrow(ctx, startX, startY, pos.x, pos.y);
    }
  });

  canvas.addEventListener('mouseup', (e) => {
    if (!drawing) return;
    drawing = false;
    const pos = getMousePos(e);

    if (activeTool === 'text') {
      const textVal = prompt('Enter annotation label (e.g. BOS, FVG, OB):');
      if (textVal) {
        saveState();
        ctx.fillStyle = activeColor;
        ctx.font = 'bold 15px Outfit, sans-serif';
        ctx.textBaseline = 'middle';
        
        // Add a clean shadow for readability
        ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
        ctx.shadowBlur = 4;
        ctx.fillText(textVal.trim(), pos.x, pos.y);
        ctx.shadowBlur = 0; // reset shadow
      }
    }
  });

  canvas.addEventListener('mouseleave', () => {
    drawing = false;
  });

  // Undo button action
  undoBtn.addEventListener('click', () => {
    if (history.length > 1) {
      history.pop(); // remove current state
      const lastImg = new Image();
      lastImg.src = history[history.length - 1];
      lastImg.onload = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(lastImg, 0, 0);
      };
    }
  });

  // Clear button action
  clearBtn.addEventListener('click', () => {
    history = [];
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    saveState();
  });

  // Cancel and Apply actions
  cancelBtn.addEventListener('click', () => overlay.remove());
  
  saveBtn.addEventListener('click', () => {
    const finalDataUrl = canvas.toDataURL('image/jpeg', 0.9);
    onSave(finalDataUrl);
    overlay.remove();
  });

  // Helpers
  function hexToRgba(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  function drawArrow(ctx, fromX, fromY, toX, toY) {
    const headLength = 14;
    const dx = toX - fromX;
    const dy = toY - fromY;
    const angle = Math.atan2(dy, dx);
    ctx.beginPath();
    ctx.moveTo(fromX, fromY);
    ctx.lineTo(toX, toY);
    ctx.lineTo(toX - headLength * Math.cos(angle - Math.PI / 6), toY - headLength * Math.sin(angle - Math.PI / 6));
    ctx.moveTo(toX, toY);
    ctx.lineTo(toX - headLength * Math.cos(angle + Math.PI / 6), toY - headLength * Math.sin(angle + Math.PI / 6));
    ctx.stroke();
  }
}

/* ---------- Trade Form -------------------------------------------- */

// Build the "Log Trade" form.
export function renderTradeForm(container, onSaved) {
  container.replaceChildren();
  const form = el('form', 'trade-form');
  form.setAttribute('novalidate', '');

  // ---- Asset select ----
  const assetSelect = document.createElement('select');
  assetSelect.name = 'asset';
  assetSelect.required = true;
  const defaultOpt = el('option', '', '— Select asset —');
  defaultOpt.value = '';
  assetSelect.appendChild(defaultOpt);

  for (const [category, symbols] of Object.entries(ASSETS)) {
    const optgroup = document.createElement('optgroup');
    optgroup.label = category;
    symbols.forEach((sym) => {
      const opt = el('option', '', sym);
      opt.value = sym;
      optgroup.appendChild(opt);
    });
    assetSelect.appendChild(optgroup);
  }
  form.appendChild(formGroup('Asset', assetSelect));

  // ---- Direction ----
  const dirSelect = document.createElement('select');
  dirSelect.name = 'direction';
  ['long', 'short'].forEach((d) => {
    const opt = el('option', '', d.charAt(0).toUpperCase() + d.slice(1));
    opt.value = d;
    dirSelect.appendChild(opt);
  });
  form.appendChild(formGroup('Direction', dirSelect));

  // ---- Numeric fields ----
  let entryInput, stopInput, exitInput;
  const numericFields = [
    { name: 'entry', label: 'Entry Price', step: 'any', required: true },
    { name: 'stop', label: 'Stop Loss', step: 'any', required: true },
    { name: 'exit', label: 'Exit Price', step: 'any', required: true },
  ];
  numericFields.forEach(({ name, label, step, required }) => {
    const input = document.createElement('input');
    input.type = 'number';
    input.name = name;
    input.step = step;
    input.placeholder = '0.00';
    if (required) input.required = true;
    
    if (name === 'entry') entryInput = input;
    else if (name === 'stop') stopInput = input;
    else if (name === 'exit') exitInput = input;
    
    form.appendChild(formGroup(label, input));
  });

  // ---- Active Lot-Size & Risk Position Calculator ----
  const riskHelper = el('div', 'trade-form__risk-helper glass-card');
  riskHelper.style.marginTop = 'var(--space-4)';
  riskHelper.style.marginBottom = 'var(--space-4)';
  riskHelper.style.padding = 'var(--space-4)';
  riskHelper.style.border = '1px solid rgba(0, 212, 255, 0.15)';
  
  const rhHeader = el('div', 'risk-helper-header');
  rhHeader.style.display = 'flex';
  rhHeader.style.alignItems = 'center';
  rhHeader.style.gap = 'var(--space-2)';
  rhHeader.style.marginBottom = 'var(--space-3)';
  rhHeader.appendChild(el('span', 'risk-helper-icon', '🧮'));
  rhHeader.appendChild(el('h4', 'risk-helper-title', 'Active Risk Sizer & Position Calculator'));
  riskHelper.appendChild(rhHeader);

  // Inputs: Balance and Risk %
  const rhInputs = el('div', 'risk-helper-inputs');
  rhInputs.style.display = 'grid';
  rhInputs.style.gridTemplateColumns = '1fr 1fr';
  rhInputs.style.gap = 'var(--space-3)';
  rhInputs.style.marginBottom = 'var(--space-3)';

  const balInput = document.createElement('input');
  balInput.type = 'number';
  balInput.className = 'form-input';
  balInput.value = storage.get('preset_balance', '10000'); // Load saved balance preset
  balInput.step = 'any';
  rhInputs.appendChild(formGroup('Account Balance ($)', balInput));

  const pctInput = document.createElement('input');
  pctInput.type = 'number';
  pctInput.className = 'form-input';
  pctInput.value = storage.get('preset_risk', '1'); // Load saved risk preset
  pctInput.step = '0.1';
  rhInputs.appendChild(formGroup('Risk Per Trade (%)', pctInput));

  // Auto-save preset when typed
  balInput.addEventListener('input', () => {
    storage.set('preset_balance', balInput.value);
  });
  pctInput.addEventListener('input', () => {
    storage.set('preset_risk', pctInput.value);
  });

  riskHelper.appendChild(rhInputs);

  // Outputs grid
  const rhGrid = el('div', 'risk-helper-grid');
  rhGrid.style.display = 'grid';
  rhGrid.style.gridTemplateColumns = '1fr 1fr';
  rhGrid.style.gap = 'var(--space-3)';
  rhGrid.style.marginBottom = 'var(--space-3)';

  const makeRhCard = (label, valText = '—', valClass = '') => {
    const card = el('div', 'risk-helper-card');
    card.style.background = 'rgba(255, 255, 255, 0.02)';
    card.style.border = '1px solid rgba(255, 255, 255, 0.04)';
    card.style.padding = 'var(--space-2) var(--space-3)';
    card.style.borderRadius = 'var(--radius-md)';
    card.style.display = 'flex';
    card.style.flexDirection = 'column';
    
    card.appendChild(el('span', 'risk-helper-card-label', label));
    const valNode = el('span', `risk-helper-card-value ${valClass}`, valText);
    card.appendChild(valNode);
    return { card, valNode };
  };

  const cashCell = makeRhCard('Risk Amount ($)');
  const distCell = makeRhCard('Stop Loss Distance');
  const sizeCell = makeRhCard('Suggested Position Size', '—', 'val-high');
  const dirCell = makeRhCard('Direction');

  rhGrid.appendChild(cashCell.card);
  rhGrid.appendChild(distCell.card);
  rhGrid.appendChild(sizeCell.card);
  rhGrid.appendChild(dirCell.card);
  riskHelper.appendChild(rhGrid);

  // TP Target Buttons
  const targetRow = el('div', 'risk-helper-targets');
  targetRow.style.display = 'grid';
  targetRow.style.gridTemplateColumns = '1fr 1fr';
  targetRow.style.gap = 'var(--space-3)';

  const tp2Btn = el('button', 'btn btn-outline btn-sm', '🎯 Auto-Fill 2R Target');
  tp2Btn.type = 'button';
  tp2Btn.disabled = true;

  const tp3Btn = el('button', 'btn btn-outline btn-sm', '🏆 Auto-Fill 3R Target');
  tp3Btn.type = 'button';
  tp3Btn.disabled = true;

  targetRow.appendChild(tp2Btn);
  targetRow.appendChild(tp3Btn);
  riskHelper.appendChild(targetRow);

  // Informative warning hint when empty
  const hint = el('p', 'risk-helper-hint', '💡 Enter Entry Price and Stop Loss to calculate optimal risk and position sizing.');
  hint.style.fontSize = 'var(--text-xs)';
  hint.style.color = 'var(--text-muted)';
  hint.style.fontStyle = 'italic';
  hint.style.marginTop = 'var(--space-2)';
  riskHelper.appendChild(hint);

  form.appendChild(riskHelper);

  let tp2Val = null;
  let tp3Val = null;

  function updateLiveRisk() {
    const entry = Number(entryInput.value);
    const stop = Number(stopInput.value);
    const balance = Number(balInput.value);
    const riskPct = Number(pctInput.value);

    // Calculate risk amount
    const riskAmount = (balance * riskPct) / 100;
    cashCell.valNode.textContent = formatCurrency(riskAmount);

    if (!entry || !stop || entry <= 0 || stop <= 0) {
      distCell.valNode.textContent = '—';
      sizeCell.valNode.textContent = '—';
      dirCell.valNode.textContent = '—';
      dirCell.valNode.className = 'risk-helper-card-value';
      tp2Btn.disabled = true;
      tp3Btn.disabled = true;
      tp2Val = null;
      tp3Val = null;
      return;
    }

    const slDistance = Math.abs(entry - stop);
    if (slDistance === 0) {
      distCell.valNode.textContent = 'Invalid (SL=Entry)';
      sizeCell.valNode.textContent = '—';
      dirCell.valNode.textContent = '—';
      tp2Btn.disabled = true;
      tp3Btn.disabled = true;
      tp2Val = null;
      tp3Val = null;
      return;
    }

    const direction = entry > stop ? 'LONG' : 'SHORT';
    dirCell.valNode.textContent = direction;
    dirCell.valNode.className = `risk-helper-card-value ${direction === 'LONG' ? 'val-high' : 'val-low'}`;

    // Format stop loss distance beautifully
    distCell.valNode.textContent = slDistance.toFixed(5);

    // Position size calculation
    const units = riskAmount / slDistance;
    // Assuming standard lots where 1 standard lot = 100,000 units
    const lots = units / 100000;
    
    sizeCell.valNode.textContent = `${units.toLocaleString(undefined, { maximumFractionDigits: 2 })} Units (${lots.toFixed(2)} Lots)`;

    // Calculate 2R and 3R Targets
    if (direction === 'LONG') {
      tp2Val = entry + slDistance * 2;
      tp3Val = entry + slDistance * 3;
    } else {
      tp2Val = entry - slDistance * 2;
      tp3Val = entry - slDistance * 3;
    }

    tp2Btn.textContent = `🎯 Auto-Fill 2R (${tp2Val.toFixed(5)})`;
    tp3Btn.textContent = `🏆 Auto-Fill 3R (${tp3Val.toFixed(5)})`;
    tp2Btn.disabled = false;
    tp3Btn.disabled = false;
  }

  // Event listeners for interactive ticking
  [entryInput, stopInput, balInput, pctInput].forEach(inp => {
    inp.addEventListener('input', updateLiveRisk);
    inp.addEventListener('change', updateLiveRisk);
  });

  // Handle auto-fill click actions
  tp2Btn.addEventListener('click', () => {
    if (tp2Val !== null) {
      exitInput.value = tp2Val.toFixed(5);
      exitInput.dispatchEvent(new Event('input'));
    }
  });

  tp3Btn.addEventListener('click', () => {
    if (tp3Val !== null) {
      exitInput.value = tp3Val.toFixed(5);
      exitInput.dispatchEvent(new Event('input'));
    }
  });


  // ---- Date ----
  const dateInput = document.createElement('input');
  dateInput.type = 'date';
  dateInput.name = 'date';
  dateInput.valueAsDate = new Date();
  form.appendChild(formGroup('Trade Date', dateInput));

  // ---- Timeframe ----
  const tfSelect = document.createElement('select');
  tfSelect.name = 'timeframe';
  ['M1', 'M5', 'M15', 'M30', 'H1', 'H4', 'D1', 'W1'].forEach((tf) => {
    const opt = el('option', '', tf);
    opt.value = tf;
    tfSelect.appendChild(opt);
  });
  form.appendChild(formGroup('Timeframe', tfSelect));

  // ---- Session ----
  const sessionSelect = document.createElement('select');
  sessionSelect.name = 'session';
  ['London', 'New York', 'Asia', 'London Close', 'Overlap'].forEach((s) => {
    const opt = el('option', '', s);
    opt.value = s;
    sessionSelect.appendChild(opt);
  });
  form.appendChild(formGroup('Session', sessionSelect));

  // ---- Confluence checkboxes ----
  const confFieldset = el('fieldset', 'confluence-fieldset');
  const confLegend = el('legend', '', 'Confluences');
  confFieldset.appendChild(confLegend);
  CONFLUENCE_OPTIONS.forEach((c) => {
    const wrapper = el('label', 'form-check');
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.name = 'confluences';
    cb.value = c;
    wrapper.appendChild(cb);
    const span = el('span', 'form-check-label', c);
    wrapper.appendChild(span);
    confFieldset.appendChild(wrapper);
  });
  form.appendChild(confFieldset);

  // ---- Outcome ----
  const outcomeSelect = document.createElement('select');
  outcomeSelect.name = 'outcome';
  ['Win', 'Loss', 'Break-even'].forEach((o) => {
    const opt = el('option', '', o);
    opt.value = o.toLowerCase();
    outcomeSelect.appendChild(opt);
  });
  form.appendChild(formGroup('Outcome', outcomeSelect));

  // ---- Mistake / Psychology Leak ----
  const mistakeSelect = document.createElement('select');
  mistakeSelect.name = 'mistake';
  const defaultMistakeOpt = el('option', '', '— None (Clean Execution) —');
  defaultMistakeOpt.value = '';
  mistakeSelect.appendChild(defaultMistakeOpt);

  const MISTAKE_OPTIONS = [
    { value: 'fomo', label: 'FOMO (Fear of Missing Out)' },
    { value: 'revenge', label: 'Revenge Trading' },
    { value: 'outside_killzone', label: 'Outside Killzone Timing' },
    { value: 'over_leveraging', label: 'Over-leveraging' },
    { value: 'moved_sl', label: 'Moved Stop Loss (Rule Violation)' },
    { value: 'early_exit', label: 'Early Exit (Fear)' },
    { value: 'chasing_price', label: 'Chasing Price' },
    { value: 'no_plan', label: 'No Trade Plan / Ad-hoc' }
  ];

  MISTAKE_OPTIONS.forEach((m) => {
    const opt = el('option', '', m.label);
    opt.value = m.value;
    mistakeSelect.appendChild(opt);
  });

  const mistakeGroup = formGroup('Mistake / Psychology Leak', mistakeSelect);
  mistakeGroup.style.display = 'none'; // Hidden by default
  form.appendChild(mistakeGroup);

  outcomeSelect.addEventListener('change', () => {
    if (outcomeSelect.value === 'loss') {
      mistakeGroup.style.display = 'block';
    } else {
      mistakeGroup.style.display = 'none';
      mistakeSelect.value = ''; // Reset on hide
    }
  });

  // ---- Notes ----
  const notes = document.createElement('textarea');
  notes.name = 'notes';
  notes.rows = 3;
  notes.placeholder = 'Trade notes, lessons, emotions…';
  form.appendChild(formGroup('Notes', notes));

  // ---- Attachment & Canvas Annotator ----
  const fileGroup = el('div', 'form-group screenshot-form-group');
  const fileLabel = el('label', 'form-label', '📷 Attach & Annotate Chart Screenshot');
  
  const screenshotInput = document.createElement('input');
  screenshotInput.type = 'hidden';
  screenshotInput.name = 'screenshot';
  
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = 'image/*';
  fileInput.style.display = 'none';
  
  const uploadBtn = el('button', 'btn btn-outline btn-sm', '📁 Upload Screenshot');
  uploadBtn.type = 'button';
  
  const previewContainer = el('div', 'screenshot-preview-container');
  previewContainer.style.display = 'none';
  
  const thumbnail = document.createElement('img');
  thumbnail.className = 'screenshot-thumbnail';
  
  const editBtn = el('button', 'btn btn-secondary btn-sm edit-screenshot-btn', '🎨 Annotate Chart');
  editBtn.type = 'button';
  
  const removeBtn = el('button', 'btn btn-ghost btn-sm remove-screenshot-btn', '✕ Remove');
  removeBtn.type = 'button';

  uploadBtn.addEventListener('click', () => fileInput.click());

  fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target.result;
      screenshotInput.value = dataUrl;
      thumbnail.src = dataUrl;
      previewContainer.style.display = 'flex';
      uploadBtn.style.display = 'none';
    };
    reader.readAsDataURL(file);
  });

  removeBtn.addEventListener('click', () => {
    screenshotInput.value = '';
    fileInput.value = '';
    previewContainer.style.display = 'none';
    uploadBtn.style.display = 'inline-flex';
  });

  editBtn.addEventListener('click', () => {
    if (screenshotInput.value) {
      openCanvasPainter(screenshotInput.value, (annotatedDataUrl) => {
        screenshotInput.value = annotatedDataUrl;
        thumbnail.src = annotatedDataUrl;
      });
    }
  });

  previewContainer.appendChild(thumbnail);
  previewContainer.appendChild(editBtn);
  previewContainer.appendChild(removeBtn);
  
  fileGroup.appendChild(fileLabel);
  fileGroup.appendChild(screenshotInput);
  fileGroup.appendChild(fileInput);
  fileGroup.appendChild(uploadBtn);
  fileGroup.appendChild(previewContainer);
  form.appendChild(fileGroup);

  // ---- Submit ----
  const submitBtn = el('button', 'btn btn-primary', 'Save Trade 💾');
  submitBtn.type = 'submit';
  form.appendChild(submitBtn);

  form.addEventListener('submit', (e) => {
    e.preventDefault();

    // Check form validity using browser validity mechanics
    const invalidFields = form.querySelectorAll(':invalid');
    if (invalidFields.length > 0) {
      invalidFields.forEach((field) => {
        field.classList.add('error');
        const clearError = () => {
          field.classList.remove('error');
          field.removeEventListener('input', clearError);
          field.removeEventListener('change', clearError);
        };
        field.addEventListener('input', clearError);
        field.addEventListener('change', clearError);
      });

      invalidFields[0].focus();

      // Inline validation warning notification banner
      let notice = form.querySelector('.trade-validation-notice');
      if (notice) notice.remove();

      notice = el('div', 'trade-validation-notice');
      notice.style.background = 'rgba(242, 54, 69, 0.1)';
      notice.style.border = '1px solid var(--neon-red)';
      notice.style.color = 'var(--neon-red)';
      notice.style.padding = 'var(--space-3) var(--space-4)';
      notice.style.borderRadius = 'var(--radius-md)';
      notice.style.marginTop = 'var(--space-4)';
      notice.style.marginBottom = 'var(--space-4)';
      notice.style.fontSize = 'var(--text-xs)';
      notice.style.fontWeight = '700';
      notice.style.textTransform = 'uppercase';
      notice.style.letterSpacing = '0.05em';
      notice.style.display = 'flex';
      notice.style.alignItems = 'center';
      notice.style.gap = 'var(--space-2)';
      notice.style.animation = 'fadeIn 0.3s ease';

      const icon = el('span', '', '⚠️');
      notice.appendChild(icon);
      notice.appendChild(document.createTextNode('Please fill in all required fields highlighted in neon red!'));

      form.insertBefore(notice, submitBtn);

      setTimeout(() => {
        if (notice && notice.parentNode) {
          notice.style.opacity = '0';
          notice.style.transition = 'opacity 0.3s ease';
          setTimeout(() => notice.remove(), 300);
        }
      }, 4000);

      return;
    }

    const fd = new FormData(form);

    // Collect checked confluences.
    const confluences = [];
    form.querySelectorAll('input[name="confluences"]:checked').forEach((cb) => {
      confluences.push(cb.value);
    });

    const tradeData = {
      asset: fd.get('asset'),
      direction: fd.get('direction'),
      entry: Number(fd.get('entry')),
      stop: Number(fd.get('stop')),
      exit: Number(fd.get('exit')),
      size: 1,
      fees: 0,
      slippage: 0,
      date: fd.get('date') || new Date().toISOString().slice(0, 10),
      timeframe: fd.get('timeframe'),
      session: fd.get('session'),
      confluences,
      outcome: fd.get('outcome'),
      mistake: fd.get('outcome') === 'loss' ? fd.get('mistake') : '',
      notes: sanitizeText(fd.get('notes') || '', 2000),
      screenshot: fd.get('screenshot') || '',
      balanceUsed: Number(balInput.value) || 10000,
      riskPct: Number(pctInput.value) || 1.0,
    };

    saveTrade(tradeData);
    addXP('trade', 25);

    // Check general achievements dynamically to prevent cycle
    try {
      import('./streaks.js').then(({ checkAndUnlockAchievements }) => {
        checkAndUnlockAchievements('trade');
      });
    } catch (e) {
      console.error(e);
    }
    form.reset();
    
    // Reset screenshot upload container
    screenshotInput.value = '';
    fileInput.value = '';
    previewContainer.style.display = 'none';
    uploadBtn.style.display = 'inline-flex';

    mistakeGroup.style.display = 'none'; // reset visibility
    dateInput.valueAsDate = new Date();
    
    // Clear any active validation notice
    const activeNotice = form.querySelector('.trade-validation-notice');
    if (activeNotice) activeNotice.remove();

    if (typeof onSaved === 'function') onSaved();
  });

  container.appendChild(form);
}

/* ---------- CSV Export --------------------------------------------- */

function exportToCSV() {
  const trades = getTrades();
  if (!trades.length) return;

  const headers = ['Date','Asset','Direction','Entry','Exit','Stop','P&L','R:R','Outcome','Session','Timeframe','Confluences','Notes'];
  const rows = trades.map(t => [
    t.date, t.asset, t.direction, t.entry, t.exit, t.stop,
    t.pnl, t.rr, t.outcome, t.session || '',
    t.timeframe || '', (t.confluences || []).join('; '),
    (t.notes || '').replace(/[\n\r,]/g, ' ')
  ]);

  const csv = [headers.join(','), ...rows.map(r => r.map(v => `"${v}"`).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `swagga-trades-${new Date().toISOString().slice(0,10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

/* ---------- Trade Detail Modal ------------------------------------- */

export const MISTAKE_LABELS = {
  fomo: 'FOMO (Fear of Missing Out)',
  revenge: 'Revenge Trading',
  outside_killzone: 'Outside Killzone Timing',
  over_leveraging: 'Over-leveraging',
  moved_sl: 'Moved Stop Loss (Rule Violation)',
  early_exit: 'Early Exit (Fear)',
  chasing_price: 'Chasing Price',
  no_plan: 'No Trade Plan / Ad-hoc'
};

function openTradeDetail(trade) {
  const overlay = el('div', 'trade-modal-overlay');
  const modal = el('div', 'trade-modal');

  // Gradient topbar
  const topbar = el('div', '');
  topbar.style.height = '3px';
  topbar.style.background = 'linear-gradient(90deg, #8e0e00, var(--neon-green), var(--cyan))';
  modal.appendChild(topbar);

  // Header
  const header = el('div', 'trade-modal__header');
  const pnlVal = Number(trade.pnl) || 0;
  const titleText = `${trade.asset} — ${trade.direction ? trade.direction.toUpperCase() : 'TRADE'}`;
  header.appendChild(el('h2', 'trade-modal__title', titleText));
  const closeBtn = el('button', 'trade-modal__close', '✕');
  closeBtn.addEventListener('click', () => {
    overlay.classList.remove('trade-modal-overlay--visible');
    setTimeout(() => overlay.remove(), 200);
  });
  header.appendChild(closeBtn);
  modal.appendChild(header);

  // Body
  const body = el('div', 'trade-modal__body');
  const grid = el('div', 'trade-modal__detail-grid');

  const confCount = Array.isArray(trade.confluences) ? trade.confluences.length : 0;
  let dynamicQuality = trade.setupQuality;
  if (!dynamicQuality) {
    if (confCount >= 5) dynamicQuality = 'A+';
    else if (confCount === 4) dynamicQuality = 'A';
    else if (confCount === 3) dynamicQuality = 'B';
    else dynamicQuality = 'C';
  }

  let qualityCls = 'setup-c';
  if (dynamicQuality === 'A+') qualityCls = 'setup-aplus';
  else if (dynamicQuality === 'A') qualityCls = 'setup-a';
  else if (dynamicQuality === 'B') qualityCls = 'setup-b';

  const detailPairs = [
    { label: 'Date', value: formatDate(trade.date) },
    { label: 'Direction', value: trade.direction ? trade.direction.toUpperCase() : '—' },
    { label: 'Session', value: trade.session || '—' },
    { label: 'Timeframe', value: trade.timeframe || '—' },
    { label: 'Setup Quality', value: dynamicQuality === 'A+' ? 'A+ Setup ⚡' : `${dynamicQuality} Setup`, cls: qualityCls },
    { label: 'Entry Price', value: String(trade.entry) },
    { label: 'Exit Price', value: String(trade.exit) },
    { label: 'Stop Loss', value: String(trade.stop || '—') },
    { label: 'P&L', value: formatCurrency(pnlVal), cls: pnlVal >= 0 ? 'pnl-positive' : 'pnl-negative' },
    { label: 'Risk:Reward', value: `${trade.rr}R` },
    { label: 'Outcome', value: trade.outcome ? trade.outcome.charAt(0).toUpperCase() + trade.outcome.slice(1) : '—' },
  ];

  if (trade.outcome === 'loss') {
    const mistakeLabel = MISTAKE_LABELS[trade.mistake] || 'None (Clean Execution)';
    detailPairs.push({
      label: 'Psychology Leak',
      value: mistakeLabel,
      cls: trade.mistake ? 'pnl-negative' : 'pnl-positive'
    });
  }

  detailPairs.forEach(({ label, value, cls }) => {
    const item = el('div', 'trade-detail-item');
    item.appendChild(el('span', 'trade-detail-item__label', label));
    const val = el('span', `trade-detail-item__value${cls ? ' ' + cls : ''}`, value);
    item.appendChild(val);
    grid.appendChild(item);
  });
  body.appendChild(grid);

  // Confluences
  if (trade.confluences && trade.confluences.length) {
    const confSection = el('div', 'trade-modal__notes');
    confSection.appendChild(el('div', 'trade-modal__notes-title', 'Confluences'));
    const tags = el('div', '');
    tags.style.display = 'flex';
    tags.style.flexWrap = 'wrap';
    tags.style.gap = '6px';
    trade.confluences.forEach(c => {
      const tag = el('span', 'tag', c);
      tags.appendChild(tag);
    });
    confSection.appendChild(tags);
    body.appendChild(confSection);
  }

  if (trade.notes) {
    const notesSection = el('div', 'trade-modal__notes');
    notesSection.appendChild(el('div', 'trade-modal__notes-title', 'Notes'));
    notesSection.appendChild(el('div', 'trade-modal__notes-body', trade.notes));
    body.appendChild(notesSection);
  }

  // Attached Chart Screenshot
  if (trade.screenshot) {
    const ssSection = el('div', 'trade-modal__notes');
    ssSection.appendChild(el('div', 'trade-modal__notes-title', '🖼️ Attached Chart Screenshot'));
    
    const img = document.createElement('img');
    img.src = trade.screenshot;
    img.className = 'trade-modal__screenshot';
    img.style.width = '100%';
    img.style.borderRadius = 'var(--radius-md)';
    img.style.marginTop = 'var(--space-2)';
    img.style.border = '1px solid rgba(255, 255, 255, 0.08)';
    img.style.cursor = 'zoom-in';
    
    img.addEventListener('click', () => {
      const zoomOverlay = el('div', 'trade-modal-overlay trade-modal-overlay--visible');
      zoomOverlay.style.zIndex = '9999';
      
      const zoomImg = document.createElement('img');
      zoomImg.src = trade.screenshot;
      zoomImg.style.maxWidth = '90%';
      zoomImg.style.maxHeight = '90%';
      zoomImg.style.borderRadius = 'var(--radius-lg)';
      zoomImg.style.boxShadow = '0 24px 64px rgba(0,0,0,0.8)';
      
      zoomOverlay.appendChild(zoomImg);
      zoomOverlay.addEventListener('click', () => zoomOverlay.remove());
      document.body.appendChild(zoomOverlay);
    });
    
    ssSection.appendChild(img);
    body.appendChild(ssSection);
  }

  // ── Mentor Critique Simulator ─────────────────────────────
  const critiqueSection = el('div', 'trade-modal__notes trade-critique-section');
  critiqueSection.appendChild(el('div', 'trade-modal__notes-title', '💬 Mentor Critique Simulator'));

  const promptText = el('p', 'trade-critique-prompt');
  promptText.textContent = 'Select a mentor to analyze your trade confluences, session timing, and execution psychology:';
  critiqueSection.appendChild(promptText);

  const mentorsRow = el('div', 'trade-critique-mentors');

  // Brad Goh selector card
  const bgCard = el('div', 'trade-critique-mentor-btn');
  const bgAvatar = el('span', 'trade-critique-avatar-emoji', '🧠');
  bgCard.appendChild(bgAvatar);
  const bgInfo = el('div', 'trade-critique-mentor-info');
  bgInfo.appendChild(el('span', 'trade-critique-mentor-name', 'Brad Goh'));
  bgInfo.appendChild(el('span', 'trade-critique-mentor-role', 'ICT / SMC Educator'));
  bgCard.appendChild(bgInfo);
  mentorsRow.appendChild(bgCard);

  // Boss Ackah selector card
  const baCard = el('div', 'trade-critique-mentor-btn');
  const baAvatar = el('span', 'trade-critique-avatar-emoji', '👑');
  baCard.appendChild(baAvatar);
  const baInfo = el('div', 'trade-critique-mentor-info');
  baInfo.appendChild(el('span', 'trade-critique-mentor-name', 'Boss Ackah'));
  baInfo.appendChild(el('span', 'trade-critique-mentor-role', 'Mindset Mentor'));
  baCard.appendChild(baInfo);
  mentorsRow.appendChild(baCard);

  critiqueSection.appendChild(mentorsRow);

  // Bubble / Response Container
  const bubbleContainer = el('div', 'trade-critique-result');
  critiqueSection.appendChild(bubbleContainer);

  const handleSelectMentor = (mentorKey, activeBtn, inactiveBtn) => {
    activeBtn.classList.add('active');
    inactiveBtn.classList.remove('active');
    
    bubbleContainer.replaceChildren();
    
    // Show typing loading indicator
    const typing = el('div', 'critique-typing');
    const dot1 = el('span');
    const dot2 = el('span');
    const dot3 = el('span');
    typing.appendChild(dot1);
    typing.appendChild(dot2);
    typing.appendChild(dot3);
    const label = el('span', 'critique-typing-text', `${mentorKey === 'bradGoh' ? 'Brad' : 'Boss Ackah'} is analyzing trade parameters...`);
    typing.appendChild(label);
    bubbleContainer.appendChild(typing);
    
    // Delay feedback by 1.2s to simulate deep thinking
    setTimeout(() => {
      bubbleContainer.replaceChildren();
      
      const critiqueText = generateMentorCritique(mentorKey, trade);
      
      const bubble = el('div', `critique-bubble critique-bubble--${mentorKey}`);
      
      const headerObj = el('div', 'critique-bubble-header');
      const emoji = el('span', 'critique-bubble-avatar', mentorKey === 'bradGoh' ? '🧠' : '👑');
      headerObj.appendChild(emoji);
      const name = el('span', 'critique-bubble-name', mentorKey === 'bradGoh' ? 'Brad Goh' : 'Boss Ackah');
      headerObj.appendChild(name);
      bubble.appendChild(headerObj);
      
      const textNode = el('p', 'critique-bubble-text');
      const parts = critiqueText.split('**');
      parts.forEach((part, i) => {
        if (i % 2 === 1) {
          const bold = document.createElement('strong');
          bold.textContent = part;
          textNode.appendChild(bold);
        } else {
          textNode.appendChild(document.createTextNode(part));
        }
      });
      bubble.appendChild(textNode);
      bubbleContainer.appendChild(bubble);
      
      // Auto scroll
      bubble.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 1200);
  };

  bgCard.addEventListener('click', () => handleSelectMentor('bradGoh', bgCard, baCard));
  baCard.addEventListener('click', () => handleSelectMentor('bossAckah', baCard, bgCard));

  body.appendChild(critiqueSection);

  modal.appendChild(body);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  // Animate in
  requestAnimationFrame(() => overlay.classList.add('trade-modal-overlay--visible'));

  // Close on overlay click
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      overlay.classList.remove('trade-modal-overlay--visible');
      setTimeout(() => overlay.remove(), 200);
    }
  });
}

// Generate customized trade critique in the mentor's specific tone.
function generateMentorCritique(mentorKey, trade) {
  const isWin = trade.outcome === 'win';
  const asset = trade.asset || 'this pair';
  const dir = (trade.direction || 'buy').toUpperCase();
  const confluences = Array.isArray(trade.confluences) ? trade.confluences : [];
  
  // Helper checks
  const hasStructure = confluences.some(c => c.includes('Market Structure') || c.includes('BOS') || c.includes('CHOCH'));
  const hasKillzone = confluences.some(c => c.includes('Killzones') || c.includes('Timing'));
  const hasFvg = confluences.some(c => c.includes('Fair Value Gaps') || c.includes('FVG'));
  const hasOb = confluences.some(c => c.includes('Supply/Demand') || c.includes('Order Block'));
  const hasLiquidity = confluences.some(c => c.includes('Liquidity') || c.includes('Sweep') || c.includes('Inducements'));
  
  if (mentorKey === 'bradGoh') {
    if (isWin) {
      let text = `Let's go, SwaGGa! 🚀 That was an absolutely beautiful **${dir}** trade execution on **${asset}**! `;
      
      if (hasKillzone) {
        text += `I love that you respected the **ICT Killzone Timing**. Trading high volume windows is how we get rapid expansions and avoid consolidations! ⏱️ `;
      } else {
        text += `You got the win here, but be careful with timing, executing in low-volume sessions can sometimes draw down. `;
      }
      
      if (hasStructure && hasOb) {
        text += `Aligning with the swing structure and entering off that pristine **Supply/Demand zone** was textbook Smart Money. That's real professional-grade stuff! 📈 `;
      }
      
      if (hasFvg) {
        text += `Entering as the price filled that **Fair Value Gap (FVG)** was clean entry refinement. Imbalance fills are extremely consistent. `;
      }
      
      text += `This is exactly how we print money professionally, my friend! Keep this discipline up, log your wins, and let's keep winning! 🧠`;
      return text;
    } else {
      let text = `Hey SwaGGa, don't sweat the loss at all! A loss is just data and tuition for the market. Let's break down this **${dir}** on **${asset}** to learn from it: `;
      
      if (trade.mistake && trade.mistake !== 'none') {
        const mistakeStr = trade.mistake.replace(/_/g, ' ');
        text += `You logged a psychology leak: **"${mistakeStr}"**. Emotional triggers are the number one account killer. Re-read **Ep 4 on Trading Psychology** and get your head back in the game! 🧠 `;
      }
      
      if (!hasKillzone) {
        text += `🚨 **Key Issue:** I notice you didn't tag *ICT Killzones Timing*. Executing outside session windows gets you chopped up in retail traps! London (2-5 AM) and NY (7-10 AM) only! `;
      }
      
      if (!hasStructure) {
        text += `Always verify the swing structure bias. Did you have a clear **BOS or CHOCH** on your execution timeframe? Trading counter-trend is highly risky. `;
      } else if (!hasOb) {
        text += `You had the structure, but did you wait for price to mitigate a high-probability **Order Block or Supply/Demand zone**? Placing limit orders in no-mans-land is a trap. `;
      }
      
      if (hasLiquidity) {
        text += `It's good that you looked for a liquidity sweep, but ensure it wasn't an early inducement. `;
      } else {
        text += `Try to search for **Liquidity Sweeps [Ep 13]** next time. Let smart money sweep the retail stops first, then enter on the displacement. `;
      }
      
      text += `Go back, watch **Ep 5 (Market Structure)** or **Ep 12 (Killzones)**, review what went wrong, and let's conquer the next trade! ⚡`;
      return text;
    }
  } else if (mentorKey === 'bossAckah') {
    const mistakeName = trade.mistake && trade.mistake !== 'none' ? trade.mistake.replace(/_/g, ' ') : '';
    
    if (isWin) {
      let text = `A profitable outcome on **${asset}**, yes, but let us look closer. `;
      
      if (trade.setupQuality === 'A+' || confluences.length >= 5) {
        text += `Your confluences were highly structured, and you exercised patience in waiting for an **A+ trade quality** setup. This tells me you are developing real, professional skills. `;
      } else {
        text += `You won this trade, but with only **${confluences.length}** confluences tagged, was this a disciplined execution or did you gamble and get lucky? Be extremely honest with yourself. `;
      }
      
      if (mistakeName) {
        text += `Even though you won, you logged a mistake: **"${mistakeName}"**. A win with poor discipline is a hidden danger because it feeds bad habits. `;
      } else {
        text += `No psychology mistakes logged. Excellent. The profit is simply a byproduct of your focus and emotional control. `;
      }
      
      text += `Remain humble, SwaGGa. Do not let this win make you overconfident or cloud your mind. The money is in the knowledge. 👑`;
      return text;
    } else {
      let text = `This loss on **${asset}** is a powerful, necessary mirror for your mind, SwaGGa. `;
      
      if (trade.mistake && trade.mistake !== 'none') {
        text += `You logged a psychology leak: **"${mistakeName}"**. This is exactly the emotional cloud I warned you about in our mindset sessions! Greed, FOMO, and revenge trading are mechanisms that cloud the mind and lead to ruin. `;
      } else {
        text += `You logged no psychological mistakes, which means this was simply a statistical loss. That is acceptable; losses are expenses of doing business if your risk management is protected. `;
      }
      
      if (!hasStructure) {
        text += `You entered this trade without clear structural confluences. Trading without structure is not business — it is a gimmick, an emotional impulse. `;
      }
      
      text += `This is a professional skills acquisition course. Commitment and focus are your shields. Take a deep breath, close your terminal, listen to the **Psychology Audio (Trading for a Living)**, and regain your mental center. 🕯️`;
      return text;
    }
  }
  return '';
}

/* ---------- Trade History Table ------------------------------------ */

// Build the trade history table.
export function renderTradeHistory(container, onRefresh) {
  container.replaceChildren();
  const trades = getTrades();

  if (!trades.length) {
    const empty = el('div', 'empty-state');
    const icon = el('span', 'empty-icon', '📭');
    const msg = el('p', '', 'No trades logged yet. Start journaling!');
    empty.appendChild(icon);
    empty.appendChild(msg);
    container.appendChild(empty);
    return;
  }

  // Export bar
  const exportBar = el('div', 'export-bar');
  const countLabel = el('span', 'export-count');
  countLabel.textContent = `${trades.length} trade${trades.length !== 1 ? 's' : ''}`;
  exportBar.appendChild(countLabel);
  const exportBtn = el('button', 'btn btn-outline btn-sm', '📥 Export CSV');
  exportBtn.addEventListener('click', exportToCSV);
  exportBar.appendChild(exportBtn);
  container.appendChild(exportBar);

  const table = el('table', 'trade-table');
  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');
  const headers = ['Date', 'Asset', 'Dir', 'Entry', 'Exit', 'P&L', 'R:R', 'Outcome', 'Setup', ''];
  headers.forEach((h) => {
    const th = el('th', '', h);
    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');

  // Show newest first.
  [...trades].reverse().forEach((t) => {
    const row = document.createElement('tr');

    // Click row to open detail (but not on delete button)
    row.addEventListener('click', (e) => {
      if (e.target.closest('.btn-danger')) return;
      openTradeDetail(t);
    });

    const confCount = Array.isArray(t.confluences) ? t.confluences.length : 0;
    let dynamicQuality = t.setupQuality;
    if (!dynamicQuality) {
      if (confCount >= 5) dynamicQuality = 'A+';
      else if (confCount === 4) dynamicQuality = 'A';
      else if (confCount === 3) dynamicQuality = 'B';
      else dynamicQuality = 'C';
    }

    const cells = [
      formatDate(t.date),
      t.asset,
      t.direction,
      String(t.entry),
      String(t.exit),
      formatCurrency(t.pnl),
      `${t.rr}R`,
      t.outcome,
      dynamicQuality,
    ];

    cells.forEach((val, idx) => {
      const td = el('td');
      // Color P&L column.
      if (idx === 5) {
        td.textContent = val;
        td.classList.add(Number(t.pnl) >= 0 ? 'pnl-positive' : 'pnl-negative');
      } else if (idx === 1) {
        td.textContent = val;
        if (t.screenshot) {
          const clip = el('span', 'attachment-icon', ' 🖼️');
          clip.title = 'Screenshot Attached';
          td.appendChild(clip);
        }
      } else if (idx === 8) {
        const badge = el('span', `setup-${val.toLowerCase().replace('+', 'plus')}`, val);
        td.appendChild(badge);
      } else {
        td.textContent = val;
      }
      row.appendChild(td);
    });

    // Delete button.
    const actionTd = el('td');
    const delBtn = el('button', 'btn btn-sm btn-danger', '🗑️');
    delBtn.setAttribute('aria-label', 'Delete trade');
    delBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteTrade(t.id);
      if (typeof onRefresh === 'function') onRefresh();
    });
    actionTd.appendChild(delBtn);
    row.appendChild(actionTd);

    tbody.appendChild(row);
  });

  table.appendChild(tbody);
  container.appendChild(table);
}

/* ---------- Tabs -------------------------------------------------- */

function buildTabs(onSelect) {
  const tabs = el('div', 'tab-bar');
  const tabDefs = [
    { key: 'form', label: '📝 Log Trade' },
    { key: 'history', label: '📋 History' },
    { key: 'analytics', label: '📈 Analytics' },
  ];
  tabDefs.forEach(({ key, label }, idx) => {
    const btn = el('button', `tab-btn${idx === 0 ? ' active' : ''}`, label);
    btn.setAttribute('data-tab', key);
    btn.addEventListener('click', () => {
      tabs.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      onSelect(key);
    });
    tabs.appendChild(btn);
  });
  return tabs;
}

/* ---------- Confluence Correlation Engine ------------------------- */

function shortenConfluence(full) {
  return full.replace(/\s*\[Ep\s*\d+\]\s*$/i, '').trim();
}

function buildCorrelationEngine(trades) {
  const section = el('div', 'correlation-engine');

  const header = el('div', 'correlation-header');
  header.appendChild(el('span', 'correlation-icon', '🧬'));
  const titleWrap = el('div', 'correlation-title-wrap');
  titleWrap.appendChild(el('h2', 'correlation-title', 'Confluence Correlation Engine'));
  titleWrap.appendChild(el('p', 'correlation-subtitle', 'Which confluences actually make you money?'));
  header.appendChild(titleWrap);
  section.appendChild(header);

  // Need at least 3 trades with confluences to show meaningful data
  const tagged = trades.filter(t => Array.isArray(t.confluences) && t.confluences.length > 0);
  if (tagged.length < 3) {
    const notice = el('div', 'correlation-notice');
    notice.appendChild(el('span', '', '📉'));
    notice.appendChild(el('p', '', 'Log at least 3 trades with confluence tags to unlock correlation insights.'));
    section.appendChild(notice);
    return section;
  }

  // --- Individual confluence stats ---
  const confStats = new Map();
  tagged.forEach(t => {
    const isWin = t.outcome === 'win' || Number(t.pnl) > 0;
    const pnl = Number(t.pnl) || 0;
    t.confluences.forEach(c => {
      if (!confStats.has(c)) confStats.set(c, { wins: 0, losses: 0, total: 0, pnl: 0 });
      const s = confStats.get(c);
      s.total++;
      s.pnl += pnl;
      if (isWin) s.wins++; else s.losses++;
    });
  });

  // Sort by win rate descending (minimum 2 trades to rank)
  const ranked = [...confStats.entries()]
    .filter(([, s]) => s.total >= 2)
    .map(([name, s]) => ({
      name: shortenConfluence(name),
      fullName: name,
      winRate: Math.round((s.wins / s.total) * 100),
      total: s.total,
      wins: s.wins,
      pnl: s.pnl,
    }))
    .sort((a, b) => b.winRate - a.winRate || b.total - a.total);

  // --- Pair correlation stats ---
  const pairStats = new Map();
  tagged.forEach(t => {
    const isWin = t.outcome === 'win' || Number(t.pnl) > 0;
    const confs = t.confluences;
    for (let i = 0; i < confs.length; i++) {
      for (let j = i + 1; j < confs.length; j++) {
        const pair = [confs[i], confs[j]].sort().join(' + ');
        if (!pairStats.has(pair)) pairStats.set(pair, { wins: 0, total: 0 });
        const s = pairStats.get(pair);
        s.total++;
        if (isWin) s.wins++;
      }
    }
  });

  const topPairs = [...pairStats.entries()]
    .filter(([, s]) => s.total >= 2)
    .map(([pair, s]) => ({
      pair: pair.split(' + ').map(shortenConfluence).join(' + '),
      winRate: Math.round((s.wins / s.total) * 100),
      total: s.total,
      wins: s.wins,
    }))
    .sort((a, b) => b.winRate - a.winRate || b.total - a.total)
    .slice(0, 5);

  // Overall baseline win rate for comparison
  const baselineWins = tagged.filter(t => t.outcome === 'win' || Number(t.pnl) > 0).length;
  const baselineWR = Math.round((baselineWins / tagged.length) * 100);

  // --- Build the chart section ---
  if (ranked.length > 0) {
    const chartWrap = el('div', 'correlation-chart-wrap');
    const canvas = document.createElement('canvas');
    canvas.id = 'chart-correlation-engine';
    chartWrap.appendChild(canvas);
    section.appendChild(chartWrap);

    // Render chart after DOM insertion (needs to be in DOM for Chart.js)
    requestAnimationFrame(() => {
      import('./charts.js').then(({ createConfluenceCorrelationChart }) => {
        createConfluenceCorrelationChart(
          'chart-correlation-engine',
          ranked.map(r => r.name),
          ranked.map(r => r.winRate),
          ranked.map(r => r.total),
        );
      });
    });
  }

  // --- Top insight callout ---
  if (ranked.length > 0) {
    const best = ranked[0];
    const diff = best.winRate - baselineWR;
    if (diff > 0) {
      const insight = el('div', 'correlation-insight correlation-insight--positive');
      insight.appendChild(el('span', 'correlation-insight-icon', '🔥'));
      const txt = el('span', 'correlation-insight-text');
      txt.appendChild(document.createTextNode('When you use '));

      const strong = document.createElement('strong');
      strong.textContent = best.name;
      txt.appendChild(strong);

      txt.appendChild(document.createTextNode(`, your win rate is ${best.winRate}% — that's +${diff}% above your baseline of ${baselineWR}%.`));
      insight.appendChild(txt);
      section.appendChild(insight);
    }
  }

  // Worst confluence warning
  if (ranked.length > 1) {
    const worst = ranked[ranked.length - 1];
    if (worst.winRate < baselineWR) {
      const diff = baselineWR - worst.winRate;
      const warn = el('div', 'correlation-insight correlation-insight--negative');
      warn.appendChild(el('span', 'correlation-insight-icon', '⚠️'));
      const txt = el('span', 'correlation-insight-text');
      txt.appendChild(document.createTextNode('Watch out: '));

      const strong = document.createElement('strong');
      strong.textContent = worst.name;
      txt.appendChild(strong);

      txt.appendChild(document.createTextNode(` drags you ${diff}% below baseline (${worst.winRate}% win rate across ${worst.total} trades).`));
      warn.appendChild(txt);
      section.appendChild(warn);
    }
  }

  // --- Top Combo Pairs section ---
  if (topPairs.length > 0) {
    const comboSection = el('div', 'correlation-combos');
    comboSection.appendChild(el('h3', 'correlation-combos-title', 'Top Confluence Combos'));

    const comboGrid = el('div', 'correlation-combo-grid');

    topPairs.forEach((p, idx) => {
      const card = el('div', 'correlation-combo-card');
      if (idx === 0) card.classList.add('correlation-combo-card--best');

      const rankBadge = el('span', 'correlation-combo-rank', `#${idx + 1}`);
      card.appendChild(rankBadge);

      const pairLabel = el('div', 'correlation-combo-pair');
      const parts = p.pair.split(' + ');
      pairLabel.appendChild(el('span', 'correlation-combo-tag', parts[0]));
      pairLabel.appendChild(el('span', 'correlation-combo-plus', '+'));
      pairLabel.appendChild(el('span', 'correlation-combo-tag', parts[1]));
      card.appendChild(pairLabel);

      const statsRow = el('div', 'correlation-combo-stats');
      const wrSpan = el('span', 'correlation-combo-wr');
      wrSpan.textContent = `${p.winRate}%`;
      if (p.winRate >= 65) wrSpan.classList.add('wr-high');
      else if (p.winRate >= 45) wrSpan.classList.add('wr-mid');
      else wrSpan.classList.add('wr-low');
      statsRow.appendChild(wrSpan);

      statsRow.appendChild(el('span', 'correlation-combo-count', `${p.wins}W / ${p.total - p.wins}L · ${p.total} trades`));
      card.appendChild(statsRow);

      comboGrid.appendChild(card);
    });

    comboSection.appendChild(comboGrid);
    section.appendChild(comboSection);
  }

  return section;
}

// --- Advanced Performance Metrics Calculations ---

function calculateAdvancedMetrics(trades) {
  if (!trades.length) return null;

  // Sort trades chronologically by date
  const sorted = [...trades].sort((a, b) => new Date(a.date) - new Date(b.date));

  let grossProfits = 0;
  let grossLosses = 0;
  let winCount = 0;
  let lossCount = 0;

  // Win/Loss streaks
  let maxWinStreak = 0;
  let maxLossStreak = 0;
  let currentWinStreak = 0;
  let currentLossStreak = 0;

  // Drawdown tracking
  let equity = 10000; // Baseline virtual account size
  let peak = 10000;
  let maxDrawdownPercent = 0;

  const pnlList = [];

  sorted.forEach(t => {
    const pnl = Number(t.pnl) || 0;
    pnlList.push(pnl);

    if (pnl > 0) {
      grossProfits += pnl;
      winCount++;
      currentWinStreak++;
      if (currentWinStreak > maxWinStreak) maxWinStreak = currentWinStreak;
      currentLossStreak = 0;
    } else if (pnl < 0) {
      grossLosses += Math.abs(pnl);
      lossCount++;
      currentLossStreak++;
      if (currentLossStreak > maxLossStreak) maxLossStreak = currentLossStreak;
      currentWinStreak = 0;
    }

    // Peak-to-trough Drawdown
    equity += pnl;
    if (equity > peak) {
      peak = equity;
    }
    const drawdown = ((peak - equity) / peak) * 100;
    if (drawdown > maxDrawdownPercent) {
      maxDrawdownPercent = drawdown;
    }
  });

  // Profit Factor
  const profitFactor = grossLosses > 0 ? (grossProfits / grossLosses) : grossProfits;

  // Sharpe Ratio
  const n = pnlList.length;
  const averagePnL = pnlList.reduce((s, x) => s + x, 0) / n;
  let stdDev = 0;
  if (n > 1) {
    const variance = pnlList.reduce((s, x) => s + Math.pow(x - averagePnL, 2), 0) / n;
    stdDev = Math.sqrt(variance);
  }
  const sharpeRatio = stdDev > 0 ? (averagePnL / stdDev) : 0;

  // Average Win vs Average Loss
  const averageWin = winCount > 0 ? (grossProfits / winCount) : 0;
  const averageLoss = lossCount > 0 ? (grossLosses / lossCount) : 0;

  return {
    profitFactor: parseFloat(profitFactor.toFixed(2)),
    sharpeRatio: parseFloat(sharpeRatio.toFixed(2)),
    maxDrawdown: parseFloat(maxDrawdownPercent.toFixed(2)),
    maxWinStreak,
    maxLossStreak,
    averageWin: parseFloat(averageWin.toFixed(2)),
    averageLoss: parseFloat(averageLoss.toFixed(2))
  };
}

// Build the premium Advanced Performance Metrics Widget
function buildAdvancedMetricsWidget(trades) {
  const metrics = calculateAdvancedMetrics(trades);
  if (!metrics) return el('div');

  const section = el('div', 'metrics-section');

  const header = el('div', 'metrics-header');
  header.appendChild(el('span', 'metrics-header-icon', '⚡'));
  const titleWrap = el('div', 'metrics-title-wrap');
  titleWrap.appendChild(el('h2', 'metrics-title', 'Advanced Performance Analytics'));
  titleWrap.appendChild(el('p', 'metrics-subtitle', 'Professional-grade statistical calculations computed from your logs'));
  header.appendChild(titleWrap);
  section.appendChild(header);

  // 4-Column Grid
  const grid = el('div', 'metrics-summary-grid');

  // 1. Profit Factor Card
  const pfCard = el('div', 'metric-summary-card glass-card pf-card');
  const pfVal = el('span', 'metric-summary-value', String(metrics.profitFactor));
  if (metrics.profitFactor >= 1.5) pfVal.classList.add('val-high');
  else if (metrics.profitFactor >= 1.0) pfVal.classList.add('val-mid');
  else pfVal.classList.add('val-low');
  pfCard.appendChild(pfVal);
  pfCard.appendChild(el('span', 'metric-summary-label', 'Profit Factor'));
  pfCard.appendChild(el('span', 'metric-summary-desc', 'Gross Profits / Gross Losses'));
  grid.appendChild(pfCard);

  // 2. Sharpe Ratio Card
  const srCard = el('div', 'metric-summary-card glass-card sr-card');
  const srVal = el('span', 'metric-summary-value', String(metrics.sharpeRatio));
  if (metrics.sharpeRatio >= 1.0) srVal.classList.add('val-high');
  else if (metrics.sharpeRatio >= 0.0) srVal.classList.add('val-mid');
  else srVal.classList.add('val-low');
  srCard.appendChild(srVal);
  srCard.appendChild(el('span', 'metric-summary-label', 'Sharpe Ratio'));
  srCard.appendChild(el('span', 'metric-summary-desc', 'Avg P&L / Standard Deviation'));
  grid.appendChild(srCard);

  // 3. Max Drawdown Card
  const ddCard = el('div', 'metric-summary-card glass-card dd-card');
  const ddVal = el('span', 'metric-summary-value', `${metrics.maxDrawdown}%`);
  if (metrics.maxDrawdown <= 5) ddVal.classList.add('val-high');
  else if (metrics.maxDrawdown <= 15) ddVal.classList.add('val-mid');
  else ddVal.classList.add('val-low');
  ddCard.appendChild(ddVal);
  ddCard.appendChild(el('span', 'metric-summary-label', 'Max Drawdown %'));
  ddCard.appendChild(el('span', 'metric-summary-desc', 'Peak-to-trough equity drop'));
  grid.appendChild(ddCard);

  // 4. Streaks Record Card
  const stCard = el('div', 'metric-summary-card glass-card st-card');
  const stVal = el('span', 'metric-summary-value');
  stVal.appendChild(el('span', 'val-high', `${metrics.maxWinStreak}W`));
  stVal.appendChild(document.createTextNode(' · '));
  stVal.appendChild(el('span', 'val-low', `${metrics.maxLossStreak}L`));
  stCard.appendChild(stVal);
  stCard.appendChild(el('span', 'metric-summary-label', 'Streak Records'));
  stCard.appendChild(el('span', 'metric-summary-desc', 'Consecutive wins and losses'));
  grid.appendChild(stCard);

  section.appendChild(grid);

  // Average Win/Loss Ratio Gauge Card
  const gaugeCard = el('div', 'metrics-ratio-gauge-card glass-card');
  gaugeCard.appendChild(el('h3', 'gauge-card-title', 'Risk-to-Reward Ratio Split'));

  const ratioWrapper = el('div', 'gauge-ratio-wrapper');
  
  // Left: Avg Win
  const avgWinBlock = el('div', 'gauge-win-block');
  avgWinBlock.appendChild(el('span', 'gauge-block-label', 'Average Winning Trade'));
  avgWinBlock.appendChild(el('span', 'gauge-block-val val-high', `$${metrics.averageWin.toLocaleString()}`));
  ratioWrapper.appendChild(avgWinBlock);

  // Middle: Horizontal visual split bar
  const totalAvg = metrics.averageWin + metrics.averageLoss;
  const winPercent = totalAvg > 0 ? Math.round((metrics.averageWin / totalAvg) * 100) : 50;
  const lossPercent = 100 - winPercent;

  const barContainer = el('div', 'gauge-bar-container');
  const winBar = el('div', 'gauge-bar-segment segment-win');
  winBar.style.width = `${winPercent}%`;
  winBar.appendChild(el('span', 'segment-label', `${winPercent}%`));
  
  const lossBar = el('div', 'gauge-bar-segment segment-loss');
  lossBar.style.width = `${lossPercent}%`;
  lossBar.appendChild(el('span', 'segment-label', `${lossPercent}%`));

  barContainer.appendChild(winBar);
  barContainer.appendChild(lossBar);
  ratioWrapper.appendChild(barContainer);

  // Right: Avg Loss
  const avgLossBlock = el('div', 'gauge-loss-block');
  avgLossBlock.appendChild(el('span', 'gauge-block-label', 'Average Losing Trade'));
  avgLossBlock.appendChild(el('span', 'gauge-block-val val-low', `-$${metrics.averageLoss.toLocaleString()}`));
  ratioWrapper.appendChild(avgLossBlock);

  gaugeCard.appendChild(ratioWrapper);
  section.appendChild(gaugeCard);

  return section;
}

/* ---------- Analytics panel --------------------------------------- */

function renderAnalytics(container) {
  container.replaceChildren();
  const trades = getTrades();

  if (!trades.length) {
    const empty = el('div', 'empty-state');
    empty.appendChild(el('span', 'empty-icon', '📊'));
    empty.appendChild(el('p', '', 'Log some trades to see analytics.'));
    container.appendChild(empty);

    container.appendChild(buildRiskCalculator());
    return;
  }

  // Correlation Engine at the top
  container.appendChild(buildCorrelationEngine(trades));

  // Advanced Performance Metrics Widget immediately below
  container.appendChild(buildAdvancedMetricsWidget(trades));

  // Canvas wrappers (Chart.js will render into these).
  const grid = el('div', 'charts-grid');

  const makeCanvasCard = (title, canvasId) => {
    const card = el('div', 'chart-card');
    card.appendChild(el('h3', 'chart-title', title));
    const canvas = document.createElement('canvas');
    canvas.id = canvasId;
    card.appendChild(canvas);
    return card;
  };

  grid.appendChild(makeCanvasCard('Equity Curve', 'chart-equity'));
  grid.appendChild(makeCanvasCard('Win / Loss', 'chart-winloss'));
  grid.appendChild(makeCanvasCard('Daily P&L', 'chart-daily'));
  grid.appendChild(makeCanvasCard('Win Rate vs Confluences', 'chart-confluence'));
  grid.appendChild(makeCanvasCard('Loss Psychology Breakdown', 'chart-mistake'));
  grid.appendChild(makeCanvasCard('P&L by Asset', 'chart-asset'));
  grid.appendChild(makeCanvasCard('Performance by Session', 'chart-session'));
  container.appendChild(grid);

  import('./charts.js').then(({
    createEquityCurve, createWinLossChart, createDailyPnLChart,
    createConfluenceWinRateChart, createMistakeChart,
    createAssetPerformanceChart, createSessionPerformanceChart
  }) => {
    createEquityCurve('chart-equity', trades);
    createWinLossChart('chart-winloss', trades);
    createDailyPnLChart('chart-daily', trades);
    createConfluenceWinRateChart('chart-confluence', trades);
    createMistakeChart('chart-mistake', trades);
    createAssetPerformanceChart('chart-asset', trades);
    createSessionPerformanceChart('chart-session', trades);
  }).catch((err) => {
    console.error('Failed to load chart module:', err.message);
  });

  // Risk Calculator below charts
  container.appendChild(buildRiskCalculator());
}

/* ---------- Risk Calculator --------------------------------------- */

function buildRiskCalculator() {
  const section = el('div', 'risk-calc-section');

  const header = el('div', 'risk-calc-header');
  header.appendChild(el('span', 'risk-calc-icon', '🧮'));
  header.appendChild(el('h2', 'risk-calc-title', 'Position Size Calculator'));
  section.appendChild(header);

  const desc = el('p', 'risk-calc-desc', 'Enter your account details to calculate the optimal position size based on your risk tolerance.');
  section.appendChild(desc);

  const form = el('div', 'risk-calc-form');

  // Account Balance
  const balInput = document.createElement('input');
  balInput.type = 'number';
  balInput.className = 'form-input';
  balInput.placeholder = 'e.g. 1000';
  balInput.step = 'any';
  balInput.id = 'rc-balance';
  form.appendChild(formGroup('Account Balance ($)', balInput));

  // Risk %
  const riskInput = document.createElement('input');
  riskInput.type = 'number';
  riskInput.className = 'form-input';
  riskInput.placeholder = 'e.g. 1';
  riskInput.step = 'any';
  riskInput.min = '0.1';
  riskInput.max = '100';
  riskInput.id = 'rc-risk';
  form.appendChild(formGroup('Risk Per Trade (%)', riskInput));

  // Entry Price
  const entryInput = document.createElement('input');
  entryInput.type = 'number';
  entryInput.className = 'form-input';
  entryInput.placeholder = 'e.g. 2650.50';
  entryInput.step = 'any';
  entryInput.id = 'rc-entry';
  form.appendChild(formGroup('Entry Price', entryInput));

  // Stop Loss Price
  const stopInput = document.createElement('input');
  stopInput.type = 'number';
  stopInput.className = 'form-input';
  stopInput.placeholder = 'e.g. 2645.00';
  stopInput.step = 'any';
  stopInput.id = 'rc-stop';
  form.appendChild(formGroup('Stop Loss Price', stopInput));

  // Calculate button
  const calcBtn = el('button', 'btn btn-primary', 'Calculate Position Size 📐');
  form.appendChild(calcBtn);

  section.appendChild(form);

  // Results panel (hidden initially)
  const results = el('div', 'risk-calc-results');
  results.style.display = 'none';
  section.appendChild(results);

  calcBtn.addEventListener('click', () => {
    const balance = Number(balInput.value);
    const riskPct = Number(riskInput.value);
    const entry = Number(entryInput.value);
    const stop = Number(stopInput.value);

    if (!balance || !riskPct || !entry || !stop) {
      results.style.display = 'block';
      results.replaceChildren();
      results.appendChild(el('p', 'risk-calc-error', '⚠️ Please fill in all fields.'));
      return;
    }

    const riskAmount = (balance * riskPct) / 100;
    const slDistance = Math.abs(entry - stop);

    if (slDistance === 0) {
      results.style.display = 'block';
      results.replaceChildren();
      results.appendChild(el('p', 'risk-calc-error', '⚠️ Entry and Stop Loss cannot be the same.'));
      return;
    }

    const positionSize = riskAmount / slDistance;
    const direction = entry > stop ? 'LONG' : 'SHORT';

    results.style.display = 'block';
    results.replaceChildren();

    const grid = el('div', 'risk-results-grid');

    const items = [
      { label: 'Risk Amount', value: `$${riskAmount.toFixed(2)}`, icon: '💵' },
      { label: 'SL Distance', value: `${slDistance.toFixed(5)}`, icon: '📏' },
      { label: 'Position Size', value: `${positionSize.toFixed(4)} units`, icon: '📐' },
      { label: 'Direction', value: direction, icon: direction === 'LONG' ? '🟢' : '🔴' },
      { label: 'Risk/Reward at 2R', value: `TP: ${(direction === 'LONG' ? entry + slDistance * 2 : entry - slDistance * 2).toFixed(5)}`, icon: '🎯' },
      { label: 'Risk/Reward at 3R', value: `TP: ${(direction === 'LONG' ? entry + slDistance * 3 : entry - slDistance * 3).toFixed(5)}`, icon: '🏆' },
    ];

    items.forEach(({ label, value, icon }) => {
      const card = el('div', 'risk-result-card');
      card.appendChild(el('span', 'risk-result-icon', icon));
      card.appendChild(el('span', 'risk-result-label', label));
      card.appendChild(el('span', 'risk-result-value', value));
      grid.appendChild(card);
    });

    results.appendChild(grid);
  });

  return section;
}

// --- Main Render Function ---

// Entrypoint: renders the entire trading page within the container
export function renderTradingPage(container) {
  container.replaceChildren();

  // Title.
  container.appendChild(el('h1', 'page-title', '💹 Trading Journal'));

  // Stats bar.
  const statsContainer = el('div', 'stats-container');
  container.appendChild(statsContainer);

  // Tab panels.
  const formPanel = el('div', 'tab-panel');
  const historyPanel = el('div', 'tab-panel');
  historyPanel.style.display = 'none';
  const analyticsPanel = el('div', 'tab-panel');
  analyticsPanel.style.display = 'none';

  const panels = { form: formPanel, history: historyPanel, analytics: analyticsPanel };

  const tabs = buildTabs((key) => {
    Object.entries(panels).forEach(([k, p]) => {
      p.style.display = k === key ? 'block' : 'none';
    });
    if (key === 'history') renderTradeHistory(historyPanel, refresh);
    if (key === 'analytics') renderAnalytics(analyticsPanel);
  });

  container.appendChild(tabs);
  container.appendChild(formPanel);
  container.appendChild(historyPanel);
  container.appendChild(analyticsPanel);

  function refresh() {
    const trades = getTrades();
    const stats = calculateStats(trades);
    renderStatsBar(statsContainer, stats);
    renderTradeHistory(historyPanel, refresh);
  }

  // Initial render.
  const trades = getTrades();
  renderStatsBar(statsContainer, calculateStats(trades));
  renderTradeForm(formPanel, refresh);
}

/* ---------- TradingView Live Chart -------------------------------- */

let _tvWidget = null;

function renderLiveChart(container) {
  container.replaceChildren();

  const wrapper = el('div', 'tv-chart-section');

  // Symbol selector bar
  const selectorBar = el('div', 'tv-selector-bar');
  selectorBar.appendChild(el('span', 'tv-selector-label', '📈 Symbol:'));

  const select = document.createElement('select');
  select.className = 'form-select tv-symbol-select';

  // Default symbol
  const defaultSymbol = _pendingChartSymbol || 'EUR/USD';

  Object.entries(ASSETS).forEach(([category, assets]) => {
    const optgroup = document.createElement('optgroup');
    optgroup.label = category;
    assets.forEach(asset => {
      const opt = document.createElement('option');
      opt.value = asset;
      opt.textContent = asset;
      if (asset === defaultSymbol) opt.selected = true;
      optgroup.appendChild(opt);
    });
    select.appendChild(optgroup);
  });

  select.addEventListener('change', () => {
    loadTVChart(chartDiv, select.value);
  });
  selectorBar.appendChild(select);
  wrapper.appendChild(selectorBar);

  // Chart container
  const chartDiv = el('div', 'tv-chart-container');
  chartDiv.id = 'tv-chart-' + Date.now();
  wrapper.appendChild(chartDiv);

  // Attribution note
  const attr = el('p', 'tv-attribution', 'Charts provided by TradingView');
  wrapper.appendChild(attr);

  container.appendChild(wrapper);

  // Load the chart
  loadTVChart(chartDiv, defaultSymbol);

  // Clear pending symbol after loading
  _pendingChartSymbol = null;
}

function loadTVChart(container, assetName) {
  const tvSymbol = TV_SYMBOL_MAP[assetName] || 'FX:EURUSD';
  container.replaceChildren();

  // TradingView needs a unique container id
  const chartId = 'tv-widget-' + Date.now();
  const innerDiv = el('div');
  innerDiv.id = chartId;
  innerDiv.style.height = '100%';
  container.appendChild(innerDiv);

  // Check if TradingView library is loaded
  if (typeof TradingView === 'undefined') {
    const msg = el('div', 'tv-loading');
    msg.appendChild(el('p', '', '📊 Loading TradingView chart...'));
    msg.appendChild(el('p', 'tv-loading-sub', 'If this takes too long, check your internet connection.'));
    container.replaceChildren(msg);
    // Retry after a delay
    setTimeout(() => loadTVChart(container, assetName), 2000);
    return;
  }

  try {
    // TradingView widget needs actual pixel values, not CSS percentages
    const rect = container.getBoundingClientRect();
    const chartHeight = Math.max(rect.height || 600, 500);
    const chartWidth = Math.max(rect.width || 800, 400);

    _tvWidget = new TradingView.widget({
      container_id: chartId,
      symbol: tvSymbol,
      interval: '15',
      timezone: 'Etc/UTC',
      theme: 'dark',
      style: '1',
      locale: 'en',
      toolbar_bg: '#0d0b0f',
      enable_publishing: false,
      allow_symbol_change: true,
      hide_side_toolbar: false,
      withdateranges: true,
      details: true,
      hotlist: false,
      calendar: false,
      width: chartWidth,
      height: chartHeight,
      autosize: true,
      save_image: true,
      studies: [],
      backgroundColor: '#0d0b0f',
      gridColor: 'rgba(255, 255, 255, 0.04)',
    });
  } catch (err) {
    const errMsg = el('div', 'tv-loading');
    errMsg.appendChild(el('p', '', '⚠️ Could not load chart'));
    errMsg.appendChild(el('p', 'tv-loading-sub', 'TradingView may be temporarily unavailable.'));
    container.replaceChildren(errMsg);
  }
}

// Standalone chart page renderer — own sidebar route.
export function renderChartPage(container) {
  container.replaceChildren();
  renderLiveChart(container);
}

// Navigate to the chart page with a specific symbol loaded.
export function loadChartSymbol(assetName) {
  _pendingChartSymbol = assetName;
  window.location.hash = '#chart';
}
