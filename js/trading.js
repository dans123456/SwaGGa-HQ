/**
 * SwaGGa HQ — Trading Journal Module
 *
 * Records, displays, and analyses trades. Every piece of user-provided text
 * is rendered via textContent; every DOM node is built with createElement.
 *
 * SECURITY:
 *  • All user input is displayed via textContent — never innerHTML.
 *  • DOM built exclusively with createElement / appendChild.
 *  • Containers cleared with replaceChildren().
 */

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

/* ================================================================== */
/*  CONSTANTS                                                         */
/* ================================================================== */

/** Tradeable asset catalogue grouped by category. */
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

/** Confluence / edge factors that can be tagged on a trade. */
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

/** Map SwaGGa asset names → TradingView symbol identifiers */
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

/** Flat list of all assets for the chart selector */
const ALL_ASSETS = Object.values(ASSETS).flat();

/** Currently requested chart symbol (set by auto-assignment flow) */
let _pendingChartSymbol = null;

/* ================================================================== */
/*  DATA LAYER                                                        */
/* ================================================================== */

/** @returns {Array<object>} All saved trades. */
export function getTrades() {
  return storage.get(STORAGE_KEY, []);
}

/**
 * Persist a new trade.
 * @param {object} tradeData - Form values (asset, direction, entry, exit, …).
 * @returns {object} The saved trade object (with generated id & timestamp).
 */
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

/**
 * Delete a trade by id.
 * @param {string} id
 */
export function deleteTrade(id) {
  const trades = getTrades().filter((t) => t.id !== id);
  storage.set(STORAGE_KEY, trades);
}

/* ================================================================== */
/*  STATS                                                             */
/* ================================================================== */

/**
 * Compute aggregate statistics for a list of trades.
 * @param {Array<object>} trades
 * @returns {{totalTrades: number, winRate: number, totalPnL: number, avgRR: number}}
 */
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

/* ================================================================== */
/*  DOM BUILDERS — all use createElement + textContent                */
/* ================================================================== */

/* ---------- tiny helpers ------------------------------------------ */

/** Create an element with optional classes and text. */
function el(tag, classNames = '', text = '') {
  const node = document.createElement(tag);
  if (classNames) node.className = classNames;
  if (text) node.textContent = text;
  return node;
}

/** Create a labelled form field wrapper. */
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

/* ---------- Stats bar --------------------------------------------- */

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

/* ---------- Trade Form -------------------------------------------- */

/**
 * Build the "Log Trade" form.
 * @param {HTMLElement} container
 * @param {Function} onSaved - Callback after a trade is saved.
 */
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
    form.appendChild(formGroup(label, input));
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

  // ---- Submit ----
  const submitBtn = el('button', 'btn btn-primary', 'Save Trade 💾');
  submitBtn.type = 'submit';
  form.appendChild(submitBtn);

  form.addEventListener('submit', (e) => {
    e.preventDefault();
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
    };

    if (!tradeData.asset || !tradeData.entry || !tradeData.exit) {
      // Simple validation — highlight first empty required field.
      const first = form.querySelector(':invalid');
      if (first) first.focus();
      return;
    }

    saveTrade(tradeData);
    form.reset();
    mistakeGroup.style.display = 'none'; // reset visibility
    dateInput.valueAsDate = new Date();
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

  // Notes
  if (trade.notes) {
    const notesSection = el('div', 'trade-modal__notes');
    notesSection.appendChild(el('div', 'trade-modal__notes-title', 'Notes'));
    notesSection.appendChild(el('div', 'trade-modal__notes-body', trade.notes));
    body.appendChild(notesSection);
  }

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

/* ---------- Trade History Table ------------------------------------ */

/**
 * Build the trade history table.
 * @param {HTMLElement} container
 * @param {Function} onRefresh - Called after a delete so the page can re-render.
 */
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

/** Simple tab bar: Log Trade | Trade History | Analytics */
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

/* ---------- Analytics panel --------------------------------------- */

function renderAnalytics(container) {
  container.replaceChildren();
  const trades = getTrades();

  if (!trades.length) {
    const empty = el('div', 'empty-state');
    empty.appendChild(el('span', 'empty-icon', '📊'));
    empty.appendChild(el('p', '', 'Log some trades to see analytics.'));
    container.appendChild(empty);

    // Still show Risk Calculator even with no trades
    container.appendChild(buildRiskCalculator());
    return;
  }

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

  // Lazy-import charts module so Chart.js can load via CDN first.
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

/* ================================================================== */
/*  MAIN RENDER                                                       */
/* ================================================================== */

/**
 * Build the full Trading page inside the given container.
 * @param {HTMLElement} container - #page-trading element.
 */
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

  /** Refresh callback — re-renders everything. */
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

/**
 * Standalone chart page renderer — own sidebar route.
 * @param {HTMLElement} container
 */
export function renderChartPage(container) {
  container.replaceChildren();
  renderLiveChart(container);
}

/**
 * Navigate to the chart page with a specific symbol loaded.
 * Called by the auto-assignment system.
 * @param {string} assetName - e.g. 'EUR/USD'
 */
export function loadChartSymbol(assetName) {
  _pendingChartSymbol = assetName;
  window.location.hash = '#chart';
}
