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
  'Gold': ['XAU/USD'],
  'Crypto': ['BTC/USD', 'BTC/USDT'],
  'Indices': ['US30', 'NAS100', 'SPX500', 'GER40', 'UK100'],
  'Synthetics': ['V15', 'V25', 'V75', 'V100'],
};

/** Confluence / edge factors that can be tagged on a trade. */
export const CONFLUENCE_OPTIONS = [
  'Market Structure (BOS/CHOCH)',
  'Order Block',
  'Fair Value Gap',
  'Liquidity Sweep',
  'Supply/Demand Zone',
  'Key Level',
  'Fibonacci',
  'Session Timing',
  'HTF Alignment',
  'News/Fundamentals',
];

const STORAGE_KEY = 'trades';

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
  const trade = {
    id: generateId(),
    ...tradeData,
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
    { name: 'size', label: 'Position Size', step: 'any', required: true },
    { name: 'fees', label: 'Fees', step: 'any', required: false },
    { name: 'slippage', label: 'Slippage', step: 'any', required: false },
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
      size: Number(fd.get('size')),
      fees: Number(fd.get('fees')) || 0,
      slippage: Number(fd.get('slippage')) || 0,
      date: fd.get('date') || new Date().toISOString().slice(0, 10),
      timeframe: fd.get('timeframe'),
      session: fd.get('session'),
      confluences,
      outcome: fd.get('outcome'),
      notes: sanitizeText(fd.get('notes') || '', 2000),
    };

    if (!tradeData.asset || !tradeData.entry || !tradeData.exit || !tradeData.size) {
      // Simple validation — highlight first empty required field.
      const first = form.querySelector(':invalid');
      if (first) first.focus();
      return;
    }

    saveTrade(tradeData);
    form.reset();
    dateInput.valueAsDate = new Date();
    if (typeof onSaved === 'function') onSaved();
  });

  container.appendChild(form);
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

  const table = el('table', 'trade-table');
  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');
  const headers = ['Date', 'Asset', 'Dir', 'Entry', 'Exit', 'Size', 'P&L', 'R:R', 'Outcome', ''];
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

    const cells = [
      formatDate(t.date),
      t.asset,
      t.direction,
      String(t.entry),
      String(t.exit),
      String(t.size),
      formatCurrency(t.pnl),
      `${t.rr}R`,
      t.outcome,
    ];

    cells.forEach((val, idx) => {
      const td = el('td');
      td.textContent = val;
      // Color P&L column.
      if (idx === 6) {
        td.classList.add(Number(t.pnl) >= 0 ? 'pnl-positive' : 'pnl-negative');
      }
      row.appendChild(td);
    });

    // Delete button.
    const actionTd = el('td');
    const delBtn = el('button', 'btn btn-sm btn-danger', '🗑️');
    delBtn.setAttribute('aria-label', 'Delete trade');
    delBtn.addEventListener('click', () => {
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
    { key: 'form', label: 'Log Trade' },
    { key: 'history', label: 'Trade History' },
    { key: 'analytics', label: 'Analytics' },
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
  container.appendChild(grid);

  // Lazy-import charts module so Chart.js can load via CDN first.
  import('./charts.js').then(({ createEquityCurve, createWinLossChart, createDailyPnLChart }) => {
    createEquityCurve('chart-equity', trades);
    createWinLossChart('chart-winloss', trades);
    createDailyPnLChart('chart-daily', trades);
  }).catch((err) => {
    console.error('Failed to load chart module:', err.message);
  });
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
  container.appendChild(el('h1', 'page-title', '📊 Trading Journal'));

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
    // Re-render content when switching to the tab.
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
