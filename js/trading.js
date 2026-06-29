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
  showNotificationToast,
  triggerConfetti,
  getContractMultiplier,
  createModal,
} from './utils.js';
import { addXP } from './xp.js';
import { playSynthSound } from './audio.js';
import { nativeHaptic, nativeHapticNotification } from './native-bridge.js';
import { getAssignments } from './learning.js';
import { setupVoiceDictation } from './voice.js';

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
  'Flip Zones / Mitigations [Ep 14]',
];

export const DEFAULT_CATEGORIZED_FACTORS = {
  bias: [
    'Market Structure (BOS/CHOCH) [Ep 5]',
    'Top Down Analysis (HTF Bias) [Ep 11]'
  ],
  confluences: [
    'Supply/Demand Zone [Ep 7]',
    'Premium / Discount (Fib OTE) [Ep 8]',
    'Fair Value Gaps (FVG) [Ep 9]',
    'Liquidity Sweeps / Inducements [Ep 13]',
    'Flip Zones / Mitigations [Ep 14]'
  ],
  triggers: [
    'Candlestick Confirmation [Ep 6]',
    'ICT Killzones Timing [Ep 12]'
  ]
};

export function getEffectiveCategorizedFactors() {
  const custom = storage.get('custom_edge_factors', { bias: [], confluences: [], triggers: [] });
  
  const bias = [...DEFAULT_CATEGORIZED_FACTORS.bias, ...(custom.bias || [])];
  const confluences = [...DEFAULT_CATEGORIZED_FACTORS.confluences, ...(custom.confluences || [])];
  const triggers = [...DEFAULT_CATEGORIZED_FACTORS.triggers, ...(custom.triggers || [])];
  
  const overrides = storage.get('bg_unlocked_lessons', {});
  Object.entries(overrides).forEach(([id, lesson]) => {
    const epNum = lesson.episode !== undefined ? lesson.episode : parseInt(id.replace('ep', ''), 10);
    if (epNum > 14 && Array.isArray(lesson.concepts)) {
      lesson.concepts.forEach(concept => {
        const cleanConcept = concept.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
        const label = `${cleanConcept} [Ep ${epNum}]`;
        if (!confluences.includes(label)) {
          confluences.push(label);
        }
      });
    }
  });
  
  return { bias, confluences, triggers };
}

export function getEffectiveConfluenceOptions() {
  const cat = getEffectiveCategorizedFactors();
  return [...cat.bias, ...cat.confluences, ...cat.triggers];
}

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

// Gets all trades saved in storage and runs sign self-correction migrations
function runMigrations(allTrades) {
  let changed = false;
  const migrated = allTrades.map(t => {
    let pnlVal = Number(t.pnl);
    if (isNaN(pnlVal)) return t;

    let newPnl = pnlVal;
    let newCustomPnl = t.customPnL;

    if (t.outcome === 'loss') {
      if (pnlVal > 0) {
        newPnl = -pnlVal;
        changed = true;
      }
      if (t.customPnL !== undefined && t.customPnL !== '' && t.customPnL !== null && Number(t.customPnL) > 0) {
        newCustomPnl = -Number(t.customPnL);
        changed = true;
      }
    } else if (t.outcome === 'win') {
      if (pnlVal < 0) {
        newPnl = Math.abs(pnlVal);
        changed = true;
      }
      if (t.customPnL !== undefined && t.customPnL !== '' && t.customPnL !== null && Number(t.customPnL) < 0) {
        newCustomPnl = Math.abs(Number(t.customPnL));
        changed = true;
      }
    }

    if (newPnl !== pnlVal || newCustomPnl !== t.customPnL) {
      return {
        ...t,
        pnl: newPnl,
        customPnL: newCustomPnl
      };
    }
    return t;
  });

  if (changed) {
    storage.set(STORAGE_KEY, migrated);
    import('./firebase-sync.js').then(({ pushToCloud, getCurrentUser }) => {
      if (getCurrentUser()) pushToCloud();
    }).catch(() => {});
    return migrated;
  }
  return allTrades;
}

export function getTrades(includeSimulated = false) {
  let allTrades = storage.get(STORAGE_KEY, []);
  allTrades = runMigrations(allTrades);
  if (includeSimulated) return allTrades;
  return allTrades.filter(t => !t.simulated);
}

export function getAssetConfig(assetName) {
  if (!assetName) return { decimals: 2, step: 0.01, pipText: '0.01' };
  const name = assetName.toUpperCase();
  if (name.includes('JPY')) {
    return { decimals: 3, step: 0.001, pipText: '0.001 (1 pip = 0.01)' };
  }
  if (name.includes('/') && !name.includes('BTC') && !name.includes('XAU') && !name.includes('XAG')) {
    return { decimals: 5, step: 0.0001, pipText: '0.0001 (1 pip = 0.0001)' };
  }
  if (name.includes('BTC') || name.includes('USDT')) {
    return { decimals: 2, step: 1.0, pipText: '1.00' };
  }
  if (name.includes('XAU') || name.includes('XAG') || name.includes('GOLD') || name.includes('SILVER')) {
    return { decimals: 2, step: 0.1, pipText: '0.10' };
  }
  if (name.includes('VOLATILITY') || name.includes('US30') || name.includes('NAS100') || name.includes('SPX500') || name.includes('GER40') || name.includes('UK100')) {
    return { decimals: 2, step: 0.1, pipText: '0.10' };
  }
  return { decimals: 2, step: 0.01, pipText: '0.01' };
}

export function createSpinnerInput(name, placeholder, initialValue = '', required = false, getDecimalsAndStep) {
  const container = el('div', 'spinner-input-container');
  container.style.display = 'flex';
  container.style.alignItems = 'center';
  container.style.gap = 'var(--space-2)';
  container.style.position = 'relative';

  const minusBtn = el('button', 'btn btn-outline btn-sm spinner-btn-minus', '−');
  minusBtn.type = 'button';
  minusBtn.style.padding = '0 var(--space-3)';
  minusBtn.style.height = 'var(--space-9)';
  minusBtn.style.minWidth = 'var(--space-9)';
  minusBtn.style.fontFamily = 'monospace';
  minusBtn.style.fontWeight = 'bold';
  minusBtn.style.fontSize = '1.2rem';
  minusBtn.style.borderRadius = 'var(--radius-md)';
  minusBtn.style.border = '1px solid rgba(255, 255, 255, 0.1)';
  minusBtn.style.background = 'rgba(255, 255, 255, 0.02)';
  minusBtn.style.color = 'var(--text-color)';
  minusBtn.style.cursor = 'pointer';

  const input = document.createElement('input');
  input.type = 'text';
  input.name = name;
  input.inputMode = 'decimal';
  input.pattern = '[0-9]*\\.?[0-9]*';
  input.placeholder = placeholder;
  input.className = 'form-input';
  input.style.flex = '1';
  input.style.textAlign = 'center';
  input.style.fontFamily = 'monospace';
  if (initialValue !== '') input.value = initialValue;
  if (required) input.required = true;

  const plusBtn = el('button', 'btn btn-outline btn-sm spinner-btn-plus', '+');
  plusBtn.type = 'button';
  plusBtn.style.padding = '0 var(--space-3)';
  plusBtn.style.height = 'var(--space-9)';
  plusBtn.style.minWidth = 'var(--space-9)';
  plusBtn.style.fontFamily = 'monospace';
  plusBtn.style.fontWeight = 'bold';
  plusBtn.style.fontSize = '1.2rem';
  plusBtn.style.borderRadius = 'var(--radius-md)';
  plusBtn.style.border = '1px solid rgba(255, 255, 255, 0.1)';
  plusBtn.style.background = 'rgba(255, 255, 255, 0.02)';
  plusBtn.style.color = 'var(--text-color)';
  plusBtn.style.cursor = 'pointer';

  // Apply hover and active styles via JS
  [minusBtn, plusBtn].forEach(btn => {
    btn.addEventListener('mouseenter', () => {
      btn.style.background = 'rgba(0, 212, 255, 0.1)';
      btn.style.borderColor = 'var(--cyan)';
    });
    btn.addEventListener('mouseleave', () => {
      btn.style.background = 'rgba(255, 255, 255, 0.02)';
      btn.style.borderColor = 'rgba(255, 255, 255, 0.1)';
    });
  });

  const adjustVal = (direction) => {
    const val = parseFloat(input.value) || 0;
    const { decimals, step } = getDecimalsAndStep();
    const multiplier = Math.pow(10, decimals);
    const scaledVal = Math.round(val * multiplier);
    const scaledStep = Math.round(step * multiplier);
    
    let newVal;
    if (direction === 'plus') {
      newVal = (scaledVal + scaledStep) / multiplier;
    } else {
      newVal = Math.max(0, (scaledVal - scaledStep) / multiplier);
    }
    input.value = newVal.toFixed(decimals);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  };

  minusBtn.addEventListener('click', () => adjustVal('minus'));
  plusBtn.addEventListener('click', () => adjustVal('plus'));

  // Allow long press for fast adjustments
  let timerId;
  const startAdjusting = (direction) => {
    adjustVal(direction);
    timerId = setInterval(() => adjustVal(direction), 100);
    window.addEventListener('mouseup', stopAdjusting);
    window.addEventListener('touchend', stopAdjusting);
  };
  const stopAdjusting = () => {
    if (timerId) {
      clearInterval(timerId);
      timerId = null;
    }
    window.removeEventListener('mouseup', stopAdjusting);
    window.removeEventListener('touchend', stopAdjusting);
  };

  minusBtn.addEventListener('mousedown', () => startAdjusting('minus'));
  minusBtn.addEventListener('touchstart', (e) => { e.preventDefault(); startAdjusting('minus'); }, { passive: false });
  
  plusBtn.addEventListener('mousedown', () => startAdjusting('plus'));
  plusBtn.addEventListener('touchstart', (e) => { e.preventDefault(); startAdjusting('plus'); }, { passive: false });

  // Filter input value
  input.addEventListener('input', () => {
    let cleaned = input.value.replace(/[^0-9.-]/g, '');
    const dotParts = cleaned.split('.');
    if (dotParts.length > 2) {
      cleaned = dotParts[0] + '.' + dotParts.slice(1).join('');
    }
    if (cleaned.lastIndexOf('-') > 0) {
      cleaned = (cleaned.startsWith('-') ? '-' : '') + cleaned.replace(/-/g, '');
    }
    if (input.value !== cleaned) {
      input.value = cleaned;
    }
  });

  container.appendChild(minusBtn);
  container.appendChild(input);
  container.appendChild(plusBtn);

  return { container, input };
}

function parseDrawdownLimit(limitStr) {
  if (!limitStr) return null;
  const cleaned = limitStr.trim();
  // Check for percentage
  const pctMatch = cleaned.match(/([\d.]+)\s*%/);
  if (pctMatch) {
    const val = parseFloat(pctMatch[1]);
    if (!isNaN(val)) {
      return { type: 'percent', value: val };
    }
  }
  // Check for currency/number
  const cashMatch = cleaned.match(/(?:\$)\s*([\d.]+)/) || cleaned.match(/([\d.]+)/);
  if (cashMatch) {
    const val = parseFloat(cashMatch[1]);
    if (!isNaN(val)) {
      // If the user typed a small number like 1, 2, 5 (<= 20) without a dollar sign,
      // treat it as a percentage (1%, 2%, 5%) as they likely forgot the % sign.
      if (val <= 20 && !cleaned.includes('$')) {
        return { type: 'percent', value: val };
      }
      return { type: 'cash', value: val };
    }
  }
  return null;
}

// Persists a new trade to local storage and updates setup quality
export function saveTrade(tradeData) {
  const trades = getTrades(true);
  let setupQuality = tradeData.setupQuality;
  if (!setupQuality) {
    const confCount = Array.isArray(tradeData.confluences) ? tradeData.confluences.length : 0;
    setupQuality = 'C';
    if (confCount >= 5) setupQuality = 'A+';
    else if (confCount === 4) setupQuality = 'A';
    else if (confCount === 3) setupQuality = 'B';
  }

  const trade = {
    id: generateId(),
    ...tradeData,
    setupQuality,
    riskPercent: Number(tradeData.riskPct) || 1.0,
    pnl: (() => {
      let val;
      if (tradeData.customPnL !== undefined && tradeData.customPnL !== '' && !isNaN(Number(tradeData.customPnL))) {
        val = Number(tradeData.customPnL);
      } else {
        val = calculatePnL(
          tradeData.entry,
          tradeData.exit,
          tradeData.size,
          tradeData.direction,
          tradeData.fees,
          tradeData.slippage,
        );
      }
      if (tradeData.outcome === 'loss') {
        return -Math.abs(val);
      } else if (tradeData.outcome === 'win') {
        return Math.abs(val);
      }
      return val;
    })(),
    rr: calculateRiskReward(tradeData.entry, tradeData.stop, tradeData.exit),
    createdAt: new Date().toISOString(),
  };
  trades.push(trade);
  storage.set(STORAGE_KEY, trades);

  // Sync to firestore if user signed in
  import('./firebase-sync.js').then(({ pushToCloud, getCurrentUser }) => {
    if (getCurrentUser()) pushToCloud();
  }).catch(err => console.warn('Background sync failed:', err));

  // Check for Revenge Trading Cool-down Lockout or Max Daily Drawdown breach
  const todayStr = new Date().toISOString().slice(0, 10);
  const todayTrades = trades.filter(t => t.date === todayStr || (t.createdAt && t.createdAt.slice(0, 10) === todayStr));
  const todayNetPnL = todayTrades.reduce((sum, t) => sum + (Number(t.pnl) || 0), 0);

  let isBreached = false;
  const routine = storage.get('premarket_routine');
  if (routine && routine.riskLimit) {
    const limit = parseDrawdownLimit(routine.riskLimit);
    if (limit) {
      if (limit.type === 'percent') {
        const lossPct = (-todayNetPnL / (tradeData.balanceUsed || 10000)) * 100;
        if (todayNetPnL < 0 && lossPct >= limit.value) {
          isBreached = true;
        }
      } else if (limit.type === 'cash') {
        if (todayNetPnL < 0 && -todayNetPnL >= limit.value) {
          isBreached = true;
        }
      }
    }
  }

  // Tilt Protection System: Check if the last 2 consecutive trades are losses
  let isTilted = false;
  const sortedTodayTrades = [...todayTrades].sort((a, b) => new Date(a.createdAt || a.date) - new Date(b.createdAt || b.date));
  if (sortedTodayTrades.length >= 2) {
    const len = sortedTodayTrades.length;
    const last1 = sortedTodayTrades[len - 1];
    const last2 = sortedTodayTrades[len - 2];
    if (last1.outcome === 'loss' && last2.outcome === 'loss') {
      isTilted = true;
    }
  }

  if (tradeData.executionMindset === 'revenge' || isBreached || isTilted) {
    const expiryTime = Date.now() + 15 * 60 * 1000; // 15 minutes lockout
    storage.set('cooldown_expiry', expiryTime);
    playSynthSound('fail');
    if (isTilted) {
      showNotificationToast('Tilt Protection: 2 consecutive losses. 15-min cooldown activated! 🛡️', '🚨');
    }
    setTimeout(() => {
      window.location.hash = '#cooldown-lockout';
    }, 800);
  }

  return trade;
}

// Remove a trade record
export function deleteTrade(id) {
  const trades = getTrades().filter((t) => t.id !== id);
  storage.set(STORAGE_KEY, trades);
  nativeHaptic('medium');
  // Sync to firestore if user signed in
  import('./firebase-sync.js').then(({ pushToCloud, getCurrentUser }) => {
    if (getCurrentUser()) pushToCloud();
  }).catch(err => console.warn('Background sync failed:', err));
}

// Update an existing trade record
export function updateTrade(id, updatedData) {
  const trades = getTrades(true);
  const index = trades.findIndex((t) => t.id === id);
  if (index !== -1) {
    const original = trades[index];
    const merged = {
      ...original,
      ...updatedData,
      riskPercent: Number(updatedData.riskPct) || 1.0,
      pnl: (() => {
        let val;
        if (updatedData.customPnL !== undefined && updatedData.customPnL !== '' && !isNaN(Number(updatedData.customPnL))) {
          val = Number(updatedData.customPnL);
        } else {
          val = calculatePnL(
            updatedData.entry,
            updatedData.exit,
            updatedData.size,
            updatedData.direction,
            updatedData.fees || 0,
            updatedData.slippage || 0
          );
        }
        if (updatedData.outcome === 'loss') {
          return -Math.abs(val);
        } else if (updatedData.outcome === 'win') {
          return Math.abs(val);
        }
        return val;
      })(),
      rr: calculateRiskReward(updatedData.entry, updatedData.stop, updatedData.exit),
      setupQuality: (() => {
        if (updatedData.setupQuality) return updatedData.setupQuality;
        const confCount = Array.isArray(updatedData.confluences) ? updatedData.confluences.length : 0;
        if (confCount >= 5) return 'A+';
        if (confCount === 4) return 'A';
        if (confCount === 3) return 'B';
        return 'C';
      })(),
    };
    trades[index] = merged;
    storage.set(STORAGE_KEY, trades);

    // Sync to firestore if user signed in
    import('./firebase-sync.js').then(({ pushToCloud, getCurrentUser }) => {
      if (getCurrentUser()) pushToCloud();
    }).catch(err => console.warn('Background sync failed:', err));

    // Haptics
    nativeHaptic('medium');

    // Drawdown / revenge check
    const todayStr = new Date().toISOString().slice(0, 10);
    const todayTrades = trades.filter(t => t.date === todayStr || (t.createdAt && t.createdAt.slice(0, 10) === todayStr));
    const todayNetPnL = todayTrades.reduce((sum, t) => sum + (Number(t.pnl) || 0), 0);

    let isBreached = false;
    const routine = storage.get('premarket_routine');
    if (routine && routine.riskLimit) {
      const limit = parseDrawdownLimit(routine.riskLimit);
      if (limit) {
        if (limit.type === 'percent') {
          const lossPct = (-todayNetPnL / (updatedData.balanceUsed || 10000)) * 100;
          if (todayNetPnL < 0 && lossPct >= limit.value) {
            isBreached = true;
          }
        } else if (limit.type === 'cash') {
          if (todayNetPnL < 0 && -todayNetPnL >= limit.value) {
            isBreached = true;
          }
        }
      }
    }

    if (updatedData.executionMindset === 'revenge' || isBreached) {
      const expiryTime = Date.now() + 15 * 60 * 1000;
      storage.set('cooldown_expiry', expiryTime);
      playSynthSound('fail');
      setTimeout(() => {
        window.location.hash = '#cooldown-lockout';
      }, 800);
    }

    return merged;
  }
  return null;
}

// --- Stats Calculations ---

// Computes aggregate statistics for the dashboard/panels
export function calculateStats(trades) {
  const liveTrades = trades.filter(t => !t.simulated);
  if (!liveTrades.length) {
    return { totalTrades: 0, winRate: 0, totalPnL: 0, avgRR: 0, avgEdgeScore: 100 };
  }
  const totalPnL = liveTrades.reduce((s, t) => s + (Number(t.pnl) || 0), 0);
  const avgRR =
    liveTrades.reduce((s, t) => s + (Number(t.rr) || 0), 0) / liveTrades.length;
  const totalEdgeScore = liveTrades.reduce((s, t) => s + (t.edgeScore !== undefined ? Number(t.edgeScore) : 100), 0);
  const avgEdgeScore = Math.round(totalEdgeScore / liveTrades.length);
  return {
    totalTrades: liveTrades.length,
    winRate: calculateWinRate(liveTrades),
    totalPnL: parseFloat(totalPnL.toFixed(2)),
    avgRR: parseFloat(avgRR.toFixed(2)),
    avgEdgeScore,
  };
}

export function updateEdgePreviewBadge(fieldset, badgeEl) {
  const selectedConfs = Array.from(fieldset.querySelectorAll('input[name="confluences"]:checked')).map(cb => cb.value);
  if (selectedConfs.length === 0) {
    badgeEl.style.display = 'none';
    return;
  }
  
  const trades = getTrades();
  const matchingTrades = trades.filter(t => 
    Array.isArray(t.confluences) && selectedConfs.every(sc => t.confluences.includes(sc))
  );
  
  badgeEl.style.display = 'block';
  if (matchingTrades.length === 0) {
    badgeEl.textContent = `⚡ Edge: No data (${matchingTrades.length} trades)`;
    badgeEl.style.background = 'rgba(255, 255, 255, 0.04)';
    badgeEl.style.color = 'var(--text-muted)';
    badgeEl.style.border = '1px solid rgba(255, 255, 255, 0.08)';
    return;
  }
  
  const wins = matchingTrades.filter(t => t.outcome === 'win' || (t.outcome !== 'loss' && Number(t.pnl) > 0));
  const losses = matchingTrades.filter(t => t.outcome === 'loss' || (t.outcome !== 'win' && Number(t.pnl) < 0));
  const winRate = wins.length / matchingTrades.length;
  const avgWinR = wins.length > 0 ? wins.reduce((sum, t) => sum + (Number(t.rr) || 0), 0) / wins.length : 0;
  const avgLossR = losses.length > 0 ? losses.reduce((sum, t) => sum + (Number(t.rr) || 1), 0) / losses.length : 1;
  const expectancy = (winRate * avgWinR) - ((1 - winRate) * avgLossR);
  
  const formattedEdge = expectancy.toFixed(2);
  
  if (expectancy >= 1.0) {
    badgeEl.textContent = `🔥 A+ Setup (Edge: +${formattedEdge}R | ${matchingTrades.length} trades)`;
    badgeEl.style.background = 'rgba(57, 255, 20, 0.08)';
    badgeEl.style.color = 'var(--neon-green)';
    badgeEl.style.border = '1px solid rgba(57, 255, 20, 0.2)';
  } else if (expectancy >= 0.2) {
    badgeEl.textContent = `⚡ B Setup (Edge: +${formattedEdge}R | ${matchingTrades.length} trades)`;
    badgeEl.style.background = 'rgba(245, 158, 11, 0.08)';
    badgeEl.style.color = '#f59e0b';
    badgeEl.style.border = '1px solid rgba(245, 158, 11, 0.2)';
  } else {
    badgeEl.textContent = `⚠️ Avoid (Edge: ${formattedEdge}R | ${matchingTrades.length} trades)`;
    badgeEl.style.background = 'rgba(255, 59, 59, 0.08)';
    badgeEl.style.color = 'var(--neon-red)';
    badgeEl.style.border = '1px solid rgba(255, 59, 59, 0.2)';
  }
}

export function renderCategorizedConfluencesChecklist(container, selectedValues = [], onCheckboxChange = null) {
  container.replaceChildren();

  const categories = getEffectiveCategorizedFactors();
  const sections = [
    { key: 'bias', title: '🌐 Market Context & Bias', items: categories.bias },
    { key: 'confluences', title: '📐 Areas of Value (Confluence)', items: categories.confluences },
    { key: 'triggers', title: '⚡ Execution & Timing Filters', items: categories.triggers }
  ];

  sections.forEach(sec => {
    if (sec.items.length === 0) return;

    const secHeader = el('div', 'confluence-category-header', sec.title);
    secHeader.style.fontSize = '12px';
    secHeader.style.fontWeight = '700';
    secHeader.style.color = 'var(--cyan)';
    secHeader.style.marginTop = 'var(--space-3)';
    secHeader.style.marginBottom = 'var(--space-2)';
    container.appendChild(secHeader);

    sec.items.forEach(c => {
      const isChecked = selectedValues.includes(c);
      const wrapper = el('label', 'form-check');
      wrapper.style.display = 'flex';
      wrapper.style.alignItems = 'center';
      wrapper.style.gap = '8px';
      wrapper.style.fontSize = '12px';
      wrapper.style.cursor = 'pointer';
      wrapper.style.marginBottom = 'var(--space-1)';

      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.name = 'confluences';
      cb.value = c;
      cb.checked = isChecked;

      cb.addEventListener('change', () => {
        if (onCheckboxChange) onCheckboxChange();
      });

      wrapper.appendChild(cb);

      const span = el('span', 'form-check-label', c);
      wrapper.appendChild(span);
      container.appendChild(wrapper);
    });
  });

  const manageBtn = el('button', 'btn btn-outline btn-sm', '⚙️ Manage Custom Factors');
  manageBtn.type = 'button';
  manageBtn.style.marginTop = 'var(--space-4)';
  manageBtn.style.fontSize = '11px';
  manageBtn.style.padding = 'var(--space-1) var(--space-2)';
  manageBtn.style.borderColor = 'rgba(0, 212, 255, 0.3)';
  manageBtn.style.color = 'var(--cyan)';
  manageBtn.style.background = 'transparent';
  manageBtn.style.width = 'fit-content';
  manageBtn.style.cursor = 'pointer';

  manageBtn.addEventListener('click', () => {
    openManageConfluencesModal(() => {
      // Re-render checklist keeping currently checked confluences
      const currentSelected = Array.from(container.querySelectorAll('input[name="confluences"]:checked')).map(cb => cb.value);
      renderCategorizedConfluencesChecklist(container, currentSelected, onCheckboxChange);
    });
  });

  container.appendChild(manageBtn);
}

export function openManageConfluencesModal(onUpdate) {
  const { overlay, modal, body, close } = createModal('Manage Edge Factors');
  modal.style.maxWidth = '500px';
  body.style.maxHeight = '70vh';
  body.style.overflowY = 'auto';
  body.style.padding = 'var(--space-6)';

  const renderContent = () => {
    body.replaceChildren();

    const desc = el('p', '', 'Add custom setup factors or remove existing custom ones. Grouping them ensures they display in the correct categories on your trade logging forms.');
    desc.style.fontSize = '12px';
    desc.style.color = 'var(--text-muted)';
    desc.style.marginBottom = 'var(--space-4)';
    body.appendChild(desc);

    // Form Section
    const addSection = el('div', '');
    addSection.style.display = 'flex';
    addSection.style.flexDirection = 'column';
    addSection.style.gap = 'var(--space-2)';
    addSection.style.padding = 'var(--space-4)';
    addSection.style.background = 'rgba(255, 255, 255, 0.02)';
    addSection.style.border = '1px solid rgba(255, 255, 255, 0.06)';
    addSection.style.borderRadius = 'var(--radius-md)';
    addSection.style.marginBottom = 'var(--space-5)';

    addSection.appendChild(el('label', 'form-label', 'New Factor Name'));
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'form-input';
    input.placeholder = 'e.g. 4H Liquidity Sweep, Daily Bias';
    addSection.appendChild(input);

    addSection.appendChild(el('label', 'form-label', 'Category'));
    const select = document.createElement('select');
    select.className = 'form-select';

    const optBias = el('option', '', 'Market Context & Bias');
    optBias.value = 'bias';
    const optConf = el('option', '', 'Area of Value (Confluence)');
    optConf.value = 'confluences';
    const optTrig = el('option', '', 'Execution & Timing Trigger');
    optTrig.value = 'triggers';

    select.appendChild(optBias);
    select.appendChild(optConf);
    select.appendChild(optTrig);
    addSection.appendChild(select);

    const addBtn = el('button', 'btn btn-primary', 'Add Factor ➕');
    addBtn.type = 'button';
    addBtn.style.marginTop = 'var(--space-2)';
    addBtn.addEventListener('click', () => {
      const name = input.value.trim();
      if (!name) {
        showNotificationToast('Please enter a factor name.', '⚠️');
        return;
      }

      // Check for duplicates
      const allExist = getEffectiveConfluenceOptions();
      if (allExist.includes(name)) {
        showNotificationToast('This factor name already exists.', '⚠️');
        return;
      }

      const custom = storage.get('custom_edge_factors', { bias: [], confluences: [], triggers: [] });
      const cat = select.value;
      if (!custom[cat]) custom[cat] = [];
      custom[cat].push(name);
      storage.set('custom_edge_factors', custom);

      showNotificationToast('Custom factor added! 🎯');
      playSynthSound('success');
      input.value = '';
      renderContent();
      if (onUpdate) onUpdate();
    });
    addSection.appendChild(addBtn);
    body.appendChild(addSection);

    // List Section
    body.appendChild(el('h4', '', 'Your Custom Factors'));
    const listContainer = el('div', '');
    listContainer.style.display = 'flex';
    listContainer.style.flexDirection = 'column';
    listContainer.style.gap = 'var(--space-2)';
    listContainer.style.marginTop = 'var(--space-2)';

    const custom = storage.get('custom_edge_factors', { bias: [], confluences: [], triggers: [] });
    let hasCustom = false;

    const categories = {
      bias: '🌐 Bias',
      confluences: '📐 Confluence',
      triggers: '⚡ Trigger'
    };

    Object.entries(categories).forEach(([catKey, catLabel]) => {
      const items = custom[catKey] || [];
      items.forEach((item, index) => {
        hasCustom = true;
        const row = el('div', '');
        row.style.display = 'flex';
        row.style.justifyContent = 'space-between';
        row.style.alignItems = 'center';
        row.style.padding = 'var(--space-2) var(--space-3)';
        row.style.background = 'rgba(255, 255, 255, 0.01)';
        row.style.border = '1px solid rgba(255, 255, 255, 0.04)';
        row.style.borderRadius = 'var(--radius-sm)';

        const textWrap = el('div', '');
        textWrap.style.display = 'flex';
        textWrap.style.flexDirection = 'column';
        textWrap.appendChild(el('span', '', item));

        const badge = el('span', '', catLabel);
        badge.style.fontSize = '10px';
        badge.style.color = 'var(--cyan)';
        badge.style.marginTop = '2px';
        textWrap.appendChild(badge);

        row.appendChild(textWrap);

        const delBtn = el('button', 'btn btn-outline btn-xs', '✕');
        delBtn.style.color = 'var(--neon-red)';
        delBtn.style.borderColor = 'rgba(255, 59, 59, 0.2)';
        delBtn.style.padding = '2px 6px';
        delBtn.style.cursor = 'pointer';
        delBtn.addEventListener('click', () => {
          const current = storage.get('custom_edge_factors', { bias: [], confluences: [], triggers: [] });
          current[catKey].splice(index, 1);
          storage.set('custom_edge_factors', current);

          showNotificationToast('Custom factor removed.');
          renderContent();
          if (onUpdate) onUpdate();
        });
        row.appendChild(delBtn);

        listContainer.appendChild(row);
      });
    });

    if (!hasCustom) {
      const empty = el('p', '', 'No custom factors created yet.');
      empty.style.color = 'var(--text-muted)';
      empty.style.fontSize = '12px';
      empty.style.fontStyle = 'italic';
      listContainer.appendChild(empty);
    }

    body.appendChild(listContainer);
  };

  renderContent();
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

  function getDisciplineGrade(score) {
    if (score >= 90) return 'A+';
    if (score >= 80) return 'A';
    if (score >= 70) return 'B';
    if (score >= 60) return 'C';
    return 'F';
  }

  const grade = stats.totalTrades > 0 ? getDisciplineGrade(stats.avgEdgeScore) : 'N/A';
  const scoreDisplay = stats.totalTrades > 0 ? `${stats.avgEdgeScore}% (${grade})` : '100% (A+)';

  const items = [
    { label: 'Total Trades', value: String(stats.totalTrades), icon: '📈' },
    { label: 'Win Rate', value: `${stats.winRate}%`, icon: '🎯' },
    { label: 'Total P&L', value: formatCurrency(stats.totalPnL), icon: '💰' },
    { label: 'Avg R:R', value: `${stats.avgRR}R`, icon: '⚖️' },
    { label: 'EdgeScore', value: scoreDisplay, icon: '🛡️' },
  ];

  items.forEach(({ label, value, icon }) => {
    const card = el('div', 'stat-card');
    const iconSpan = el('span', 'stat-icon', icon);
    const infoDiv = el('div', 'stat-info');
    const labelSpan = el('span', 'stat-label', label);
    const valueSpan = el('span', 'stat-value', value);
    
    infoDiv.appendChild(labelSpan);
    infoDiv.appendChild(valueSpan);
    card.appendChild(iconSpan);
    card.appendChild(infoDiv);
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

  // --- Drawdown Circuit Breaker check ---
  const todayStr = new Date().toISOString().slice(0, 10);
  const trades = getTrades(true);
  const todayTrades = trades.filter(t => t.date === todayStr || (t.createdAt && t.createdAt.slice(0, 10) === todayStr));
  const todayNetPnL = todayTrades.reduce((sum, t) => sum + (Number(t.pnl) || 0), 0);
  
  const routine = storage.get('premarket_routine');
  if (routine && routine.riskLimit && todayNetPnL < 0) {
    const limit = parseDrawdownLimit(routine.riskLimit);
    if (limit) {
      let lossProgressPercent = 0;
      if (limit.type === 'percent') {
        const presetBalance = Number(storage.get('preset_balance', '10000'));
        const lossPct = (-todayNetPnL / presetBalance) * 100;
        lossProgressPercent = (lossPct / limit.value) * 100;
      } else if (limit.type === 'cash') {
        lossProgressPercent = (-todayNetPnL / limit.value) * 100;
      }

      if (lossProgressPercent >= 50) {
        const drawdownWarningEl = el('div', 'drawdown-warning-banner');
        drawdownWarningEl.style.padding = 'var(--space-3) var(--space-4)';
        drawdownWarningEl.style.borderRadius = 'var(--radius-md)';
        drawdownWarningEl.style.marginBottom = 'var(--space-4)';
        drawdownWarningEl.style.fontSize = 'var(--text-xs)';
        drawdownWarningEl.style.fontWeight = 'bold';
        drawdownWarningEl.style.display = 'flex';
        drawdownWarningEl.style.alignItems = 'center';
        drawdownWarningEl.style.gap = 'var(--space-2)';
        
        let warningText = '';
        if (lossProgressPercent >= 100) {
          drawdownWarningEl.style.background = 'rgba(255, 59, 59, 0.15)';
          drawdownWarningEl.style.border = '1px solid var(--neon-red)';
          drawdownWarningEl.style.color = 'var(--neon-red)';
          warningText = `🔴 Locked Out: Daily drawdown limit breached (${lossProgressPercent.toFixed(0)}% breached).`;
        } else if (lossProgressPercent >= 75) {
          drawdownWarningEl.style.background = 'rgba(255, 136, 0, 0.15)';
          drawdownWarningEl.style.border = '1px solid #ff8800';
          drawdownWarningEl.style.color = '#ff8800';
          warningText = `🟠 Warning: Drawdown at ${lossProgressPercent.toFixed(0)}% of daily limit. Trade cautiously!`;
        } else {
          drawdownWarningEl.style.background = 'rgba(255, 252, 0, 0.1)';
          drawdownWarningEl.style.border = '1px solid #fffc00';
          drawdownWarningEl.style.color = '#fffc00';
          warningText = `🟡 Caution: Drawdown at ${lossProgressPercent.toFixed(0)}% of daily limit. Watch your risk sizing.`;
        }
        
        drawdownWarningEl.appendChild(el('span', '', '⚠️'));
        drawdownWarningEl.appendChild(document.createTextNode(warningText));
        form.appendChild(drawdownWarningEl);
      }
    }
  }

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

  // ---- News Warning Container ----
  const newsWarningContainer = el('div', 'news-warning-container');
  form.appendChild(newsWarningContainer);

  function updateNewsWarning(selectedAsset) {
    newsWarningContainer.replaceChildren();
    if (!selectedAsset) return;

    function getMatchingCurrencies(asset) {
      if (!asset) return [];
      if (asset.includes('/')) {
        return asset.split('/');
      }
      if (asset === 'XAU/USD' || asset === 'XAG/USD') {
        return ['USD'];
      }
      if (asset.includes('US30') || asset.includes('NAS100') || asset.includes('SPX500') || asset.includes('BTC/USD') || asset.includes('BTC/USDT')) {
        return ['USD'];
      }
      if (asset.includes('GER40')) {
        return ['EUR'];
      }
      if (asset.includes('UK100')) {
        return ['GBP'];
      }
      return [];
    }

    const matchedCurrencies = getMatchingCurrencies(selectedAsset);
    if (matchedCurrencies.length === 0) return;

    const events = storage.get('economic_calendar', []);
    if (!Array.isArray(events) || events.length === 0) return;

    const now = new Date();
    
    const activeNews = events.filter(e => {
      const isMatch = matchedCurrencies.includes(e.country);
      const isHigh = e.impact === 'High';
      if (!isMatch || !isHigh) return false;

      const eventDate = new Date(e.date);
      const diffMin = Math.round((eventDate - now) / 60000);
      
      return diffMin >= -30 && diffMin <= 120;
    });

    if (activeNews.length === 0) return;

    activeNews.forEach(e => {
      const eventDate = new Date(e.date);
      const diffMin = Math.round((eventDate - now) / 60000);
      
      const alert = el('div', 'news-warning-alert');
      
      const icon = el('span', '', '⚠️');
      icon.style.fontSize = '1.3rem';
      alert.appendChild(icon);

      const info = el('div', '');
      info.appendChild(el('h5', 'news-warning-alert__title', `High-Impact News: ${e.country} ${e.title}`));
      
      let timeText = '';
      if (diffMin < 0) {
        timeText = `Released ${Math.abs(diffMin)} minutes ago (Active Now).`;
      } else if (diffMin === 0) {
        timeText = 'Releasing active now!';
      } else {
        const hours = Math.floor(diffMin / 60);
        const mins = diffMin % 60;
        timeText = `Releasing in ${hours > 0 ? `${hours}h ` : ''}${mins}m.`;
      }

      info.appendChild(el('p', 'news-warning-alert__text', `${timeText} High risk of slippage, wild spreads, and rapid volatility.`));
      alert.appendChild(info);

      newsWarningContainer.appendChild(alert);
    });
  }

  function getSelectedAssetConfig() {
    return getAssetConfig(assetSelect.value);
  }

  assetSelect.addEventListener('change', () => {
    updateNewsWarning(assetSelect.value);
    updateAssetHints();
    if (typeof updateLiveRisk === 'function') {
      updateLiveRisk();
    }
  });

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
    { name: 'entry', label: 'Entry Price', placeholder: '0.00000', required: true },
    { name: 'stop', label: 'Stop Loss', placeholder: '0.00000', required: true },
    { name: 'exit', label: 'Exit Price', placeholder: '0.00000', required: true },
  ];

  numericFields.forEach(({ name, label, placeholder, required }) => {
    const spinner = createSpinnerInput(name, placeholder, '', required, getSelectedAssetConfig);
    const input = spinner.input;
    const spinnerWrap = spinner.container;

    if (name === 'entry') entryInput = input;
    else if (name === 'stop') stopInput = input;
    else if (name === 'exit') exitInput = input;

    form.appendChild(formGroup(label, spinnerWrap));
  });

  // ---- Sizing Mode ----
  const sizingModeSelect = document.createElement('select');
  sizingModeSelect.name = 'sizingMode';
  sizingModeSelect.className = 'form-select';
  
  const optAuto = el('option', '', 'Auto (Risk Calculator)');
  optAuto.value = 'auto';
  const optManual = el('option', '', 'Manual (Lots / Volume)');
  optManual.value = 'manual';
  
  sizingModeSelect.appendChild(optAuto);
  sizingModeSelect.appendChild(optManual);
  
  form.appendChild(formGroup('Sizing Mode', sizingModeSelect));

  // ---- Manual Lots Input ----
  const manualLotsInput = document.createElement('input');
  manualLotsInput.type = 'number';
  manualLotsInput.name = 'manualLots';
  manualLotsInput.step = 'any';
  manualLotsInput.placeholder = 'e.g. 0.01';
  manualLotsInput.className = 'form-input';
  
  const manualLotsGroup = formGroup('Position Volume (Lots)', manualLotsInput);
  manualLotsGroup.style.display = 'none'; // Hidden by default (starts in Auto mode)
  
  const lotsHint = el('span', 'input-format-hint');
  lotsHint.style.fontSize = 'var(--text-xs)';
  lotsHint.style.color = 'var(--text-muted)';
  lotsHint.style.marginTop = 'var(--space-1)';
  lotsHint.style.display = 'block';
  manualLotsGroup.appendChild(lotsHint);
  
  form.appendChild(manualLotsGroup);

  function updateLotsHint() {
    const assetName = assetSelect.value;
    const mult = getContractMultiplier(assetName);
    let assetClass = 'Units';
    if (assetName) {
      if (assetName.includes('XAU') || assetName.includes('GOLD')) assetClass = 'Ounces';
      else if (assetName.includes('XAG') || assetName.includes('SILVER')) assetClass = 'Ounces';
    }
    lotsHint.textContent = `1 Standard Lot = ${mult.toLocaleString()} ${assetClass}`;
  }

  function updateAssetHints() {
    const config = getSelectedAssetConfig();
    const formatHintText = `Format: ${config.decimals} decimals · Step: ${config.pipText}`;
    
    updateLotsHint();
    
    const fields = [
      { input: entryInput, name: 'entry' },
      { input: stopInput, name: 'stop' },
      { input: exitInput, name: 'exit' }
    ];
    
    fields.forEach(f => {
      if (f.input) {
        f.input.placeholder = (0).toFixed(config.decimals);
        const group = f.input.closest('.form-group');
        if (group) {
          let hint = group.querySelector('.input-format-hint');
          if (!hint) {
            hint = el('span', 'input-format-hint');
            hint.style.fontSize = 'var(--text-xs)';
            hint.style.color = 'var(--text-muted)';
            hint.style.marginTop = 'var(--space-1)';
            hint.style.display = 'block';
            group.appendChild(hint);
          }
          hint.textContent = formatHintText;
        }
      }
    });
  }

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

  // High Volatility / News Day risk capper toggle
  const newsToggleGroup = el('div', 'form-group');
  newsToggleGroup.style.display = 'flex';
  newsToggleGroup.style.alignItems = 'center';
  newsToggleGroup.style.gap = 'var(--space-2)';
  newsToggleGroup.style.marginBottom = 'var(--space-3)';

  const newsCheckbox = document.createElement('input');
  newsCheckbox.type = 'checkbox';
  newsCheckbox.id = 'trade-news-day-toggle';
  newsCheckbox.style.cursor = 'pointer';
  newsCheckbox.checked = storage.get('trade_news_day_active', false);

  const newsCheckboxLabel = el('label', 'form-label', '⚠️ High Volatility / News Day (Cap Risk at 0.5% max)');
  newsCheckboxLabel.setAttribute('for', 'trade-news-day-toggle');
  newsCheckboxLabel.style.cursor = 'pointer';
  newsCheckboxLabel.style.margin = '0';
  newsCheckboxLabel.style.color = 'var(--neon-red)';
  newsCheckboxLabel.style.fontSize = 'var(--text-xs)';

  newsToggleGroup.appendChild(newsCheckbox);
  newsToggleGroup.appendChild(newsCheckboxLabel);
  riskHelper.appendChild(newsToggleGroup);

  // Warning text if capped
  const newsWarning = el('p', 'news-warning-msg', '⚠️ News day risk capping is active! Risk is capped at 0.5% max.');
  newsWarning.style.fontSize = 'var(--text-xs)';
  newsWarning.style.color = 'var(--neon-red)';
  newsWarning.style.margin = '0 0 var(--space-2) 0';
  newsWarning.style.display = 'none';
  newsWarning.style.fontWeight = 'bold';
  riskHelper.appendChild(newsWarning);

  newsCheckbox.addEventListener('change', () => {
    storage.set('trade_news_day_active', newsCheckbox.checked);
    updateLiveRisk();
  });

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

  sizingModeSelect.addEventListener('change', () => {
    const isManual = sizingModeSelect.value === 'manual';
    if (isManual) {
      riskHelper.style.display = 'none';
      manualLotsGroup.style.display = 'block';
    } else {
      riskHelper.style.display = 'block';
      manualLotsGroup.style.display = 'none';
    }
  });

  let tp2Val = null;
  let tp3Val = null;

  function updateLiveRisk() {
    const entry = Number(entryInput.value);
    const stop = Number(stopInput.value);
    const balance = Number(balInput.value);
    let riskPct = Number(pctInput.value);

    if (newsCheckbox.checked) {
      newsWarning.style.display = 'block';
      if (riskPct > 0.5) {
        riskPct = 0.5;
      }
    } else {
      newsWarning.style.display = 'none';
    }

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
    const multiplier = getContractMultiplier(assetSelect.value);
    const lots = units / multiplier;
    
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

  const edgePreviewBadge = el('div', 'edge-preview-badge');
  edgePreviewBadge.style.display = 'none';
  edgePreviewBadge.style.marginTop = 'var(--space-2)';
  edgePreviewBadge.style.marginBottom = 'var(--space-3)';
  edgePreviewBadge.style.padding = 'var(--space-2) var(--space-3)';
  edgePreviewBadge.style.borderRadius = 'var(--radius-md)';
  edgePreviewBadge.style.fontSize = 'var(--text-xs)';
  edgePreviewBadge.style.fontWeight = '700';
  edgePreviewBadge.style.width = 'fit-content';
  confFieldset.appendChild(edgePreviewBadge);

  const checklistContainer = el('div', 'confluences-checklist-container');
  checklistContainer.style.display = 'flex';
  checklistContainer.style.flexDirection = 'column';
  checklistContainer.style.gap = 'var(--space-1)';
  confFieldset.appendChild(checklistContainer);

  renderCategorizedConfluencesChecklist(checklistContainer, [], () => {
    nativeHaptic('light');
    updateEdgePreviewBadge(confFieldset, edgePreviewBadge);
    autoSelectGradeFromConfluences();
  });

  form.appendChild(confFieldset);

  // ---- Setup Grade Picker (EdgeFlo A+ Setup integration) ----
  const gradeWrapper = el('div', 'form-group');
  const gradeLabel = el('label', 'form-label', '⭐ Setup Grade');
  gradeWrapper.appendChild(gradeLabel);

  const gradeSegment = el('div', 'premarket-segment-control');
  gradeSegment.style.marginBottom = 'var(--space-2)';

  const grades = [
    { key: 'A+', label: '🏆 A+' },
    { key: 'A', label: '🥇 A' },
    { key: 'B', label: '🥈 B' },
    { key: 'C', label: '🥉 C' }
  ];

  // Warning/info text container below picker
  const gradeWarning = el('div', 'grade-warning-banner');
  gradeWarning.style.display = 'none';
  gradeWarning.style.fontSize = 'var(--text-xs)';
  gradeWarning.style.padding = 'var(--space-2) var(--space-3)';
  gradeWarning.style.borderRadius = 'var(--radius-md)';
  gradeWarning.style.marginTop = 'var(--space-2)';

  let selectedGrade = '';
  let isGradeManuallySelected = false;

  const hiddenGradeInput = document.createElement('input');
  hiddenGradeInput.type = 'hidden';
  hiddenGradeInput.name = 'setupQuality';
  hiddenGradeInput.value = '';
  gradeWrapper.appendChild(hiddenGradeInput);

  grades.forEach(g => {
    const btn = el('button', 'segment-btn', g.label);
    btn.type = 'button';
    btn.addEventListener('click', () => {
      playSynthSound('click');
      isGradeManuallySelected = true;
      selectedGrade = g.key;
      hiddenGradeInput.value = g.key;
      gradeSegment.querySelectorAll('.segment-btn').forEach(x => x.classList.remove('active'));
      btn.classList.add('active');
      updateGradeWarning(g.key);
    });
    gradeSegment.appendChild(btn);
  });
  gradeWrapper.appendChild(gradeSegment);
  gradeWrapper.appendChild(gradeWarning);
  form.appendChild(gradeWrapper);

  function updateGradeWarning(grade) {
    if (!grade) {
      gradeWarning.style.display = 'none';
      return;
    }
    gradeWarning.style.display = 'block';
    if (grade === 'A+') {
      gradeWarning.textContent = '🟢 EdgeFlo: Optimal maximum confluence setup! High probability, execute cleanly.';
      gradeWarning.style.background = 'rgba(57, 255, 20, 0.08)';
      gradeWarning.style.color = 'var(--neon-green)';
      gradeWarning.style.border = '1px solid rgba(57, 255, 20, 0.2)';
    } else if (grade === 'A') {
      gradeWarning.textContent = '🟢 EdgeFlo: High conviction setup. Follow your execution plan closely.';
      gradeWarning.style.background = 'rgba(57, 255, 20, 0.05)';
      gradeWarning.style.color = 'var(--neon-green)';
      gradeWarning.style.border = '1px solid rgba(57, 255, 20, 0.1)';
    } else if (grade === 'B') {
      gradeWarning.textContent = '⚠️ EdgeFlo Warning: B-grade setup is missing a non-negotiable. Recommend skipping to protect capital.';
      gradeWarning.style.background = 'rgba(245, 158, 11, 0.08)';
      gradeWarning.style.color = '#f59e0b';
      gradeWarning.style.border = '1px solid rgba(245, 158, 11, 0.2)';
    } else {
      gradeWarning.textContent = '❌ EdgeFlo Caution: C-grade setup is low-conviction or ad-hoc. Trading C-grade setups breaks professional discipline. Do not trade!';
      gradeWarning.style.background = 'rgba(255, 59, 59, 0.08)';
      gradeWarning.style.color = 'var(--neon-red)';
      gradeWarning.style.border = '1px solid rgba(255, 59, 59, 0.2)';
    }
  }

  function autoSelectGradeFromConfluences() {
    if (isGradeManuallySelected) return;
    const confluencesCount = confFieldset.querySelectorAll('input[name="confluences"]:checked').length;
    let suggestedGrade = 'C';
    if (confluencesCount >= 5) suggestedGrade = 'A+';
    else if (confluencesCount === 4) suggestedGrade = 'A';
    else if (confluencesCount === 3) suggestedGrade = 'B';

    selectedGrade = suggestedGrade;
    hiddenGradeInput.value = suggestedGrade;
    
    // Update active button state in UI
    gradeSegment.querySelectorAll('.segment-btn').forEach(btn => {
      const isMatch = btn.textContent.includes(suggestedGrade);
      if (isMatch) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
    updateGradeWarning(suggestedGrade);
  }

  autoSelectGradeFromConfluences();

  // ---- EdgeFlo Discipline Checklist ----
  const guardrailsFieldset = el('fieldset', 'confluence-fieldset guardrails-fieldset');
  guardrailsFieldset.style.borderColor = 'rgba(0, 212, 255, 0.2)';
  const guardrailsLegend = el('legend', '', '🛡️ EdgeFlo Discipline Guardrails');
  guardrailsLegend.style.color = 'var(--cyan)';
  guardrailsFieldset.appendChild(guardrailsLegend);

  const guardrailsList = [
    { key: 'newsChecked', label: 'Checked high-impact news calendar?' },
    { key: 'htfBiasAligned', label: 'Setup aligns with HTF Narrative Bias?' },
    { key: 'killzoneTiming', label: 'Traded inside a session Killzone?' },
    { key: 'sizeCalculatorUsed', label: 'Used suggested position size calculator?' },
  ];

  guardrailsList.forEach(g => {
    const wrapper = el('label', 'form-check');
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.name = `guardrail_${g.key}`;
    cb.checked = true; // default checked to encourage good habits
    cb.addEventListener('change', () => nativeHaptic('light'));
    wrapper.appendChild(cb);
    const span = el('span', 'form-check-label', g.label);
    wrapper.appendChild(span);
    guardrailsFieldset.appendChild(wrapper);
  });
  form.appendChild(guardrailsFieldset);

  // ---- EdgeFlo Pre-Entry 7-Question Filter ----
  const filterFieldset = el('fieldset', 'confluence-fieldset pre-entry-fieldset');
  filterFieldset.style.borderColor = 'rgba(142, 94, 237, 0.2)';
  const filterLegend = el('legend', '', '📋 EdgeFlo Pre-Entry 7-Question Filter');
  filterLegend.style.color = 'var(--purple)';
  filterFieldset.appendChild(filterLegend);

  const filterQuestions = [
    { key: 'trendAligned', label: 'Higher-timeframe trend aligned with direction? 📈' },
    { key: 'setupMatch', label: 'Matches a documented setup in my playbook? 📖' },
    { key: 'invalidationSet', label: 'Exact invalidation price level identified? 🛑' },
    { key: 'rrOk', label: 'Potential R:R meets minimum target ratio? 🎯' },
    { key: 'sizingMath', label: 'Position size calculated mathematically (no feel)? 🧮' },
    { key: 'catalystPresent', label: 'Clear execution trigger or volume catalyst? ⚡' },
    { key: 'planAligned', label: 'Emotionally calm & fully aligned with trading plan? 🧘' }
  ];

  filterQuestions.forEach(q => {
    const wrapper = el('label', 'form-check');
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.name = `pretrade_${q.key}`;
    cb.checked = true; // Default checked to encourage professional discipline
    cb.addEventListener('change', () => nativeHaptic('light'));
    wrapper.appendChild(cb);
    const span = el('span', 'form-check-label', q.label);
    wrapper.appendChild(span);
    if (q.key === 'setupMatch') {
      const viewLink = el('span', 'playbook-ref-link', 'View Playbook 🔍');
      viewLink.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        openPlaybookReferenceModal();
      });
      wrapper.appendChild(viewLink);
    }
    filterFieldset.appendChild(wrapper);
  });
  form.appendChild(filterFieldset);

  // ---- Outcome ----
  const outcomeSelect = document.createElement('select');
  outcomeSelect.name = 'outcome';
  ['Win', 'Loss', 'Break-even'].forEach((o) => {
    const opt = el('option', '', o);
    opt.value = o.toLowerCase();
    outcomeSelect.appendChild(opt);
  });
  form.appendChild(formGroup('Outcome', outcomeSelect));

  // ---- Custom P&L (Optional) ----
  const customPnlInput = document.createElement('input');
  customPnlInput.type = 'number';
  customPnlInput.name = 'customPnL';
  customPnlInput.step = 'any';
  customPnlInput.placeholder = 'e.g. 26.00 (Leave blank to auto-calculate)';
  customPnlInput.className = 'form-input';
  form.appendChild(formGroup('Actual P&L ($) (Optional)', customPnlInput));

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
  renderMistakeTipsAndStudyGuide(mistakeSelect, mistakeGroup);

  outcomeSelect.addEventListener('change', () => {
    if (outcomeSelect.value === 'loss') {
      mistakeGroup.style.display = 'block';
    } else {
      mistakeGroup.style.display = 'none';
      mistakeSelect.value = ''; // Reset on hide
    }
  });

  // ---- Emotion Tag Picker ----
  const emotionInput = document.createElement('input');
  emotionInput.type = 'hidden';
  emotionInput.name = 'emotionTag';
  emotionInput.value = '';

  const emotionWrapper = el('div', 'emotion-tag-picker');
  const emotions = [
    { key: 'fomo', label: 'FOMO 😨' },
    { key: 'greed', label: 'Greed 🤑' },
    { key: 'calm', label: 'Calm 🧘' },
    { key: 'impatient', label: 'Impatient ⏳' },
    { key: 'confident', label: 'Confident 😎' },
    { key: 'anxious', label: 'Anxious 😰' },
    { key: 'revenge', label: 'Revenge 😡' }
  ];

  emotions.forEach(e => {
    const pill = el('button', 'emotion-pill', e.label);
    pill.type = 'button';
    pill.className = 'emotion-pill';
    pill.addEventListener('click', () => {
      const active = emotionInput.value === e.key;
      emotionWrapper.querySelectorAll('.emotion-pill').forEach(btn => {
        btn.classList.remove('emotion-pill--active');
      });
      if (active) {
        emotionInput.value = '';
      } else {
        emotionInput.value = e.key;
        pill.classList.add('emotion-pill--active');
        nativeHaptic('light');
      }
    });
    emotionWrapper.appendChild(pill);
  });

  form.appendChild(emotionInput);
  form.appendChild(formGroup('Emotion at Execution', emotionWrapper));

  // ---- Execution Mindset ----
  const mindsetSelect = document.createElement('select');
  mindsetSelect.name = 'executionMindset';
  mindsetSelect.required = true;
  
  const mindsetOptions = [
    { value: 'professional', label: '🧘 Professional (Indifferent / followed plan)' },
    { value: 'anxious', label: '⚠️ Anxious / Impatient (Felt FOMO / rushed)' },
    { value: 'revenge', label: '❌ Revenge / Frustrated (Traded out of anger)' }
  ];
  mindsetOptions.forEach(optData => {
    const opt = el('option', '', optData.label);
    opt.value = optData.value;
    mindsetSelect.appendChild(opt);
  });
  form.appendChild(formGroup('Execution Mindset (Ep 16)', mindsetSelect));

  // ---- Notes ----
  const notes = document.createElement('textarea');
  notes.name = 'notes';
  notes.rows = 3;
  notes.placeholder = 'Trade notes, lessons, emotions…';
  notes.classList.add('form-textarea');

  const notesWrapper = el('div');
  notesWrapper.style.display = 'flex';
  notesWrapper.style.gap = 'var(--space-2)';
  notesWrapper.style.alignItems = 'flex-end';
  
  const notesMicBtn = el('button', 'mic-btn', '🎙️');
  notesMicBtn.type = 'button';
  notesMicBtn.title = 'Speak to input notes';
  
  notesWrapper.appendChild(notes);
  notesWrapper.appendChild(notesMicBtn);
  
  setupVoiceDictation(notes, notesMicBtn);

  form.appendChild(formGroup('Notes', notesWrapper));

  // ---- Post-Trade Reflection Fields ----
  const wellTextarea = document.createElement('textarea');
  wellTextarea.name = 'reflection_well';
  wellTextarea.rows = 2;
  wellTextarea.placeholder = 'What went well with this execution?';
  form.appendChild(formGroup('🌟 What Went Well?', wellTextarea));

  const leakTextarea = document.createElement('textarea');
  leakTextarea.name = 'reflection_leak';
  leakTextarea.rows = 2;
  leakTextarea.placeholder = 'What was your biggest leak / mistake here?';
  form.appendChild(formGroup('🩸 Biggest Leak?', leakTextarea));

  const patternTextarea = document.createElement('textarea');
  patternTextarea.name = 'reflection_pattern';
  patternTextarea.rows = 2;
  patternTextarea.placeholder = 'What setup/pattern did you identify?';
  form.appendChild(formGroup('📐 Pattern Identified?', patternTextarea));

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

    // Collect checked guardrails.
    const newsChecked = form.querySelector('input[name="guardrail_newsChecked"]').checked;
    const htfBiasAligned = form.querySelector('input[name="guardrail_htfBiasAligned"]').checked;
    const killzoneTiming = form.querySelector('input[name="guardrail_killzoneTiming"]').checked;
    const sizeCalculatorUsed = form.querySelector('input[name="guardrail_sizeCalculatorUsed"]').checked;

    let edgeScore = 100;
    if (!newsChecked) edgeScore -= 15;
    if (!htfBiasAligned) edgeScore -= 15;
    if (!killzoneTiming) edgeScore -= 15;
    if (!sizeCalculatorUsed) edgeScore -= 15;

    const mindset = fd.get('executionMindset') || 'professional';
    if (mindset === 'anxious') edgeScore -= 15;
    else if (mindset === 'revenge') edgeScore -= 35;

    const emotionTag = fd.get('emotionTag') || '';
    if (emotionTag === 'fomo') edgeScore -= 20;
    else if (emotionTag === 'greed') edgeScore -= 15;
    else if (emotionTag === 'impatient') edgeScore -= 15;
    else if (emotionTag === 'revenge') edgeScore -= 30;
    else if (emotionTag === 'anxious') edgeScore -= 15;

    const outcome = fd.get('outcome');
    const mistake = outcome === 'loss' ? fd.get('mistake') : '';
    if (outcome === 'loss' && mistake) {
      edgeScore -= 20;
    }

    const preTradeChecklist = {
      trendAligned: form.querySelector('input[name="pretrade_trendAligned"]').checked,
      setupMatch: form.querySelector('input[name="pretrade_setupMatch"]').checked,
      invalidationSet: form.querySelector('input[name="pretrade_invalidationSet"]').checked,
      rrOk: form.querySelector('input[name="pretrade_rrOk"]').checked,
      sizingMath: form.querySelector('input[name="pretrade_sizingMath"]').checked,
      catalystPresent: form.querySelector('input[name="pretrade_catalystPresent"]').checked,
      planAligned: form.querySelector('input[name="pretrade_planAligned"]').checked,
    };

    let uncheckedPtcCount = 0;
    Object.values(preTradeChecklist).forEach(val => {
      if (!val) uncheckedPtcCount++;
    });
    edgeScore -= (uncheckedPtcCount * 10);
    edgeScore = Math.max(0, edgeScore);

    const entry = Number(fd.get('entry'));
    const stop = Number(fd.get('stop'));
    const sizingMode = fd.get('sizingMode') || 'auto';
    const balanceUsed = Number(balInput.value) || 10000;
    const riskPct = Number(pctInput.value) || 1.0;
    const slDistance = Math.abs(entry - stop);
    
    let size = 1;
    let manualLots = '';
    if (sizingMode === 'manual') {
      manualLots = Number(fd.get('manualLots')) || 0.01;
      const multiplier = getContractMultiplier(fd.get('asset'));
      size = manualLots * multiplier;
    } else {
      if (slDistance > 0) {
        const riskAmount = (balanceUsed * riskPct) / 100;
        size = riskAmount / slDistance;
      }
    }

    const customPnLVal = fd.get('customPnL');
    const tradeData = {
      asset: fd.get('asset'),
      direction: fd.get('direction'),
      entry,
      stop,
      exit: Number(fd.get('exit')),
      size,
      sizingMode,
      manualLots,
      fees: 0,
      slippage: 0,
      customPnL: (() => {
        if (customPnLVal === '' || customPnLVal === null) return '';
        const val = Number(customPnLVal);
        if (fd.get('outcome') === 'loss') return -Math.abs(val);
        if (fd.get('outcome') === 'win') return Math.abs(val);
        return val;
      })(),
      date: fd.get('date') || new Date().toISOString().slice(0, 10),
      timeframe: fd.get('timeframe'),
      session: fd.get('session'),
      confluences,
      outcome: fd.get('outcome'),
      mistake: fd.get('outcome') === 'loss' ? fd.get('mistake') : '',
      notes: sanitizeText(fd.get('notes') || '', 2000),
      screenshot: fd.get('screenshot') || '',
      balanceUsed,
      riskPct,
      executionMindset: fd.get('executionMindset') || 'professional',
      emotionTag: fd.get('emotionTag') || '',
      reflection_well: sanitizeText(fd.get('reflection_well') || '', 1000),
      reflection_leak: sanitizeText(fd.get('reflection_leak') || '', 1000),
      reflection_pattern: sanitizeText(fd.get('reflection_pattern') || '', 1000),
      guardrails: {
        newsChecked,
        htfBiasAligned,
        killzoneTiming,
        sizeCalculatorUsed,
      },
      edgeScore,
      setupQuality: fd.get('setupQuality'),
      preTradeChecklist,
    };

    saveTrade(tradeData);
    showNotificationToast('Trade entry logged successfully! 💾✨');
    addXP('trade', 25);
    nativeHaptic('medium');

    // Check general achievements dynamically to prevent cycle
    try {
      import('./streaks.js').then(({ checkAndUnlockAchievements }) => {
        checkAndUnlockAchievements('trade');
      });
    } catch (e) {
      console.error(e);
    }
    form.reset();

    // Box breathing suggest modal if outcome is loss and not locked out
    const cooldownExpiry = storage.get('cooldown_expiry', 0);
    const isCooldownActive = cooldownExpiry > Date.now();
    if (!isCooldownActive && tradeData.outcome === 'loss') {
      openPostLossBreathingModal();
    }
    
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

    if (typeof onSaved === 'function') onSaved(true);
  });

  // Initialize hints and calculations on load
  setTimeout(() => {
    updateAssetHints();
    updateLiveRisk();
  }, 50);

  container.appendChild(form);
}

/* ---------- CSV Export --------------------------------------------- */

function exportToCSV(tradesToExport) {
  const trades = tradesToExport || getTrades(true);
  if (!trades.length) return;

  const headers = ['Date','Asset','Direction','Entry','Exit','Stop','P&L','R:R','Outcome','Session','Timeframe','EdgeScore','Confluences','Notes'];
  const rows = trades.map(t => [
    t.date, t.asset, t.direction, t.entry, t.exit, t.stop,
    t.pnl, t.rr, t.outcome, t.session || '',
    t.timeframe || '', t.edgeScore !== undefined ? t.edgeScore : 100, (t.confluences || []).join('; '),
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

function renderMistakeTipsAndStudyGuide(mistakeSelect, groupContainer) {
  // Banner
  const banner = el('div', 'mistake-guide-banner');
  banner.style.display = 'none';
  
  const bannerTitle = el('strong', '', '');
  const bannerText = document.createTextNode('');
  banner.appendChild(bannerTitle);
  banner.appendChild(bannerText);
  groupContainer.appendChild(banner);

  const MISTAKE_TIPS = {
    fomo: {
      title: '💡 EdgeFlo FOMO Fix:',
      text: 'Build directional bias on the Daily or 4H chart first. The 5-minute chart shows noise and is for execution timing only, not direction. If price is >10 pips past your planned entry, skip it!'
    },
    revenge: {
      title: '💡 EdgeFlo Revenge Fix:',
      text: 'Accept losses as normal statistical distribution. Cap yourself at maximum 2 trades per session. If you feel the urge to win back losses, close the platform immediately.'
    },
    outside_killzone: {
      title: '💡 EdgeFlo Timing Fix:',
      text: 'High-probability setups happen strictly inside session killzones. Traded volume and volatility dry up outside these windows. If the timer is inactive, do not execute.'
    },
    over_leveraging: {
      title: '💡 EdgeFlo Over-Leverage Fix:',
      text: 'Position size must be calculated mathematically using account balance, risk percentage, and structural stop-loss distance. Never trade based on "feel" or greed.'
    },
    moved_sl: {
      title: '💡 EdgeFlo Moved SL Fix:',
      text: 'Your invalidation level is set in advance. Moving your stop loss wider mid-trade to "give it room" converts a controlled planned loss into a catastrophic account drainer.'
    },
    early_exit: {
      title: '💡 EdgeFlo Early Exit Fix:',
      text: 'Exiting early due to anxiety cuts winners short and dilutes your mathematical edge. Honor your plan and let the trade hit either the take profit or the stop loss.'
    },
    chasing_price: {
      title: '💡 EdgeFlo Chasing Fix:',
      text: 'Stop buying or selling in the middle of a range. The highest-probability entries always occur at premium and discount extremes (supply/demand zones).'
    },
    no_plan: {
      title: '💡 EdgeFlo No Plan Fix:',
      text: 'Never improvise. Write your plan before the open, explicitly detailing directional bias, entry zone, target, and invalidation price level. No plan = no execution.'
    }
  };

  function updateBannerVisibility() {
    const val = mistakeSelect.value;
    if (val && MISTAKE_TIPS[val]) {
      bannerTitle.textContent = MISTAKE_TIPS[val].title;
      bannerText.textContent = ' ' + MISTAKE_TIPS[val].text;
      banner.style.display = 'block';
    } else {
      banner.style.display = 'none';
    }
  }

  mistakeSelect.addEventListener('change', updateBannerVisibility);
  updateBannerVisibility();

  // Accordion study guide
  const accordion = el('div', 'mistake-guide-accordion');
  const summary = el('div', 'mistake-guide-summary', '💡 EdgeFlo Study Guide: 5 Account-Draining Mistakes ➕');
  const content = el('div', 'mistake-guide-content');
  content.style.display = 'none';

  const mistakes = [
    { title: '1. Using the 5-Minute Chart for Your Bias', desc: 'Low timeframes show noise. Build directional bias on the Daily/4H first. Use 5M for entry execution only.' },
    { title: '2. Trading Your Feelings Instead of Your Plan', desc: 'Write your plan before the open (bias, target, invalidation). An unwritten plan is just a hope.' },
    { title: '3. Trading in the Middle of a Range', desc: 'Entering mid-range drops your R:R and win rate. Execute only at premium/discount extremes.' },
    { title: '4. Changing Your Bias Every Candle', desc: 'Your bias only changes when your pre-set invalidation level is hit. Ignore short-term wicks.' },
    { title: '5. Not Trusting Your Bias After Setting It', desc: 'Track your bias accuracy separately from trade P&L. Build trust through statistical evidence, not emotion.' }
  ];

  mistakes.forEach(m => {
    const item = el('div', 'mistake-guide-item');
    const itemTitle = el('div', 'mistake-guide-item-title', m.title);
    const itemDesc = el('span', '', m.desc);
    item.appendChild(itemTitle);
    item.appendChild(itemDesc);
    content.appendChild(item);
  });

  summary.addEventListener('click', () => {
    const isExpanded = content.style.display === 'block';
    content.style.display = isExpanded ? 'none' : 'block';
    summary.textContent = isExpanded 
      ? '💡 EdgeFlo Study Guide: 5 Account-Draining Mistakes ➕' 
      : '💡 EdgeFlo Study Guide: 5 Account-Draining Mistakes ➖';
  });

  accordion.appendChild(summary);
  accordion.appendChild(content);
  groupContainer.appendChild(accordion);
}

function openPlaybookReferenceModal() {
  const overlay = el('div', 'playbook-modal-overlay');
  const modal = el('div', 'playbook-modal');

  // Header
  const header = el('div', 'playbook-modal-header');
  const titleWrap = el('div', 'playbook-modal-title-wrap');
  titleWrap.appendChild(el('h3', 'playbook-modal-title', '📖 Simplified Trading Playbook'));
  titleWrap.appendChild(el('p', 'playbook-modal-subtitle', 'Your one-page operational reference guide. Follow rules, check criteria, protect capital.'));
  header.appendChild(titleWrap);

  const closeBtn = el('button', 'playbook-modal-close', '✕');
  closeBtn.addEventListener('click', () => {
    overlay.classList.remove('playbook-modal-overlay--visible');
    setTimeout(() => overlay.remove(), 250);
  });
  header.appendChild(closeBtn);
  modal.appendChild(header);

  // Tabs
  const tabsRow = el('div', 'playbook-modal-tabs');
  const btnCriteria = el('button', 'playbook-tab-btn active', '📋 Minimum Criteria');
  const btnModels = el('button', 'playbook-tab-btn', '📐 Entry Models');
  const btnUpgrades = el('button', 'playbook-tab-btn', '⭐ A+ Upgrades');
  tabsRow.appendChild(btnCriteria);
  tabsRow.appendChild(btnModels);
  tabsRow.appendChild(btnUpgrades);
  modal.appendChild(tabsRow);

  // Body
  const body = el('div', 'playbook-modal-body');

  // Tab Content 1: Minimum Criteria
  const contentCriteria = el('div', 'playbook-tab-content active');
  const criteriaList = el('div', 'playbook-criteria-list');
  const rules = [
    'Trend direction confirmed on Higher Timeframe (Daily/H4) 📈',
    'Price is at a valid point of interest (Demand/Supply, Breaker, FVG) 🎯',
    'At least two additional confluences present in setup 🤝',
    'Current session is active (London or New York Killzone) ⏱️',
    'Stop Loss is placed at structural level (not arbitrary pips) 🛑',
    'Risk-to-reward ratio is 3:1 or better before entry 🏆'
  ];
  rules.forEach((rule, idx) => {
    const row = el('div', 'playbook-criteria-row');
    const chk = document.createElement('input');
    chk.type = 'checkbox';
    chk.className = 'playbook-criteria-checkbox';
    chk.id = `playbook-modal-chk-${idx}`;
    chk.addEventListener('change', () => playSynthSound('click'));
    
    const lbl = el('label', '', rule);
    lbl.setAttribute('for', chk.id);
    lbl.style.cursor = 'pointer';
    
    row.appendChild(chk);
    row.appendChild(lbl);
    criteriaList.appendChild(row);
  });
  contentCriteria.appendChild(criteriaList);
  body.appendChild(contentCriteria);

  // Tab Content 2: Entry Models
  const contentModels = el('div', 'playbook-tab-content');
  const modelsGrid = el('div', 'playbook-models-grid');
  
  const models = [
    {
      name: '1. Breaker Block Retest',
      tag: 'STRUCTURE SHIFT',
      desc: 'Price sweeps a key liquidity pool, then aggressively breaks structure (BOS/CHOCH) creating a displacement zone. Enter when price retraces back to mitigate the Breaker Block.',
      steps: [
        'Identify HTF direction & draw key liquidity pools.',
        'Wait for liquidity sweep followed by a strong body close breaking structure.',
        'Place limit entry at the breaker zone boundary.',
        'Stop Loss set cleanly behind the sweep candle high/low.'
      ]
    },
    {
      name: '2. FVG Mitigation Sweep',
      tag: 'LIQUIDITY + GAP',
      desc: 'Price sweeps the Asian High or Low, then rapidly mitigates a Higher Timeframe Fair Value Gap (FVG). Enter on M5/M1 CHOCH candle confirmation tapping the FVG.',
      steps: [
        'Mark Asian High/Low as key buy/sell stop targets.',
        'Wait for price to sweep Asian High/Low and tap H4/H1 FVG.',
        'Zoom into M5/M1: wait for structure shift and FVG form.',
        'Enter retest of lower timeframe FVG; SL below structural shift swing.'
      ]
    },
    {
      name: '3. Judas Swing False Breakout',
      tag: 'SESSION MANIPULATION',
      desc: 'Occurs in first 30-60 mins of London session. Price makes a false breakout against HTF bias to grab liquidity before reversing strongly in the HTF direction.',
      steps: [
        'Establish clear daily trend bias before session open.',
        'Wait for early session move running counter to bias.',
        'Confirm false breakout sweep of key structural level.',
        'Enter on engulfing candle rejection; SL past sweep wick.'
      ]
    }
  ];

  models.forEach(m => {
    const card = el('div', 'playbook-model-card');
    
    const titleRow = el('div', 'playbook-model-title-row');
    titleRow.appendChild(el('h4', 'playbook-model-name', m.name));
    titleRow.appendChild(el('span', 'playbook-model-tag', m.tag));
    card.appendChild(titleRow);

    card.appendChild(el('p', 'playbook-model-desc', m.desc));

    const stepsContainer = el('ul', 'playbook-model-steps');
    m.steps.forEach(step => {
      const li = el('li', 'playbook-model-step-item', step);
      stepsContainer.appendChild(li);
    });
    card.appendChild(stepsContainer);

    modelsGrid.appendChild(card);
  });
  contentModels.appendChild(modelsGrid);
  body.appendChild(contentModels);

  // Tab Content 3: A+ Upgrades
  const contentUpgrades = el('div', 'playbook-tab-content');
  const upgradesList = el('div', 'playbook-upgrades-list');
  
  const upgrades = [
    { icon: '💎', title: 'Perfect Triple Alignment', desc: 'Higher timeframe trend direction (D1), point of interest location (H4 FVG), and execution timing (London Open) are fully aligned.' },
    { icon: '⚡', title: 'High displacement volume', desc: 'The candle breaking structure must have a wide range body and high volume, leaving behind a large, clean Fair Value Gap.' },
    { icon: '🧹', title: 'Clear Liquidity Sweep', desc: 'Price must cleanly sweep a major pool (Asian High/Low, Previous Daily High/Low) immediately before hitting the entry zone.' },
    { icon: '📰', title: 'Safe news window', desc: 'No high-impact economic news releases (red folder news) are scheduled within 2 hours of entry.' }
  ];

  upgrades.forEach(up => {
    const card = el('div', 'playbook-upgrade-item');
    card.appendChild(el('span', 'playbook-upgrade-icon', up.icon));
    const textWrap = el('div', 'playbook-upgrade-text-wrap');
    textWrap.appendChild(el('span', 'playbook-upgrade-title', up.title));
    textWrap.appendChild(el('span', 'playbook-upgrade-desc', up.desc));
    card.appendChild(textWrap);
    upgradesList.appendChild(card);
  });
  contentUpgrades.appendChild(upgradesList);
  body.appendChild(contentUpgrades);

  modal.appendChild(body);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  // Tab Switching Logic
  const tabs = [
    { btn: btnCriteria, content: contentCriteria },
    { btn: btnModels, content: contentModels },
    { btn: btnUpgrades, content: contentUpgrades }
  ];
  tabs.forEach(t => {
    t.btn.addEventListener('click', () => {
      playSynthSound('click');
      tabs.forEach(x => {
        x.btn.classList.remove('active');
        x.content.classList.remove('active');
      });
      t.btn.classList.add('active');
      t.content.classList.add('active');
    });
  });

  // Animate in
  requestAnimationFrame(() => overlay.classList.add('playbook-modal-overlay--visible'));
}

function openTradeDetail(trade, onRefresh = null) {
  const overlay = el('div', 'trade-modal-overlay');
  const modal = el('div', 'trade-modal');

  // Mobile sheet grab bar
  const grabHandle = el('div', 'modal-swipe-handle');
  modal.appendChild(grabHandle);

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

  // Edit button
  const editBtn = el('button', 'trade-modal__edit', '✏️ Edit');
  editBtn.style.background = 'transparent';
  editBtn.style.border = 'none';
  editBtn.style.color = 'var(--cyan)';
  editBtn.style.fontSize = '14px';
  editBtn.style.cursor = 'pointer';
  editBtn.style.marginRight = '12px';
  editBtn.style.fontWeight = 'bold';
  editBtn.addEventListener('click', () => {
    overlay.classList.remove('trade-modal-overlay--visible');
    setTimeout(() => {
      overlay.remove();
      openEditTradeModal(trade, onRefresh);
    }, 200);
  });
  header.appendChild(editBtn);

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

  function getDisciplineGrade(score) {
    if (score >= 90) return 'A+';
    if (score >= 80) return 'A';
    if (score >= 70) return 'B';
    if (score >= 60) return 'C';
    return 'F';
  }

  const scoreVal = trade.edgeScore !== undefined ? trade.edgeScore : 100;
  const grade = getDisciplineGrade(scoreVal);

  const mult = getContractMultiplier(trade.asset);
  const lotsVal = trade.manualLots !== undefined && trade.manualLots !== '' ? trade.manualLots : (trade.size / mult);

  const ptc = trade.preTradeChecklist || {
    trendAligned: true, setupMatch: true, invalidationSet: true, rrOk: true, sizingMath: true, catalystPresent: true, planAligned: true
  };
  let ptcChecked = 0;
  Object.values(ptc).forEach(val => {
    if (val) ptcChecked++;
  });

  const detailPairs = [
    { label: 'Date', value: formatDate(trade.date) },
    { label: 'Direction', value: trade.direction ? trade.direction.toUpperCase() : '—' },
    { label: 'Session', value: trade.session || '—' },
    { label: 'Timeframe', value: trade.timeframe || '—' },
    { label: 'Setup Quality', value: dynamicQuality === 'A+' ? 'A+ Setup ⚡' : `${dynamicQuality} Setup`, cls: qualityCls },
    { label: 'Entry Price', value: String(trade.entry) },
    { label: 'Exit Price', value: String(trade.exit) },
    { label: 'Stop Loss', value: String(trade.stop || '—') },
    { label: 'Volume (Lots)', value: `${Number(lotsVal).toFixed(2)} Lots` },
    { label: 'P&L', value: formatCurrency(pnlVal), cls: pnlVal >= 0 ? 'pnl-positive' : 'pnl-negative' },
    { label: 'Risk:Reward', value: `${trade.rr}R` },
    { label: 'Outcome', value: trade.outcome ? trade.outcome.charAt(0).toUpperCase() + trade.outcome.slice(1) : '—' },
    { label: 'EdgeScore', value: `${scoreVal}% (${grade})`, cls: scoreVal >= 80 ? 'pnl-positive' : scoreVal >= 60 ? 'pnl-neutral' : 'pnl-negative' },
    { label: 'Pre-Trade Filter', value: `${ptcChecked}/7 Questions Verified 📋`, cls: ptcChecked === 7 ? 'pnl-positive' : ptcChecked >= 5 ? 'pnl-neutral' : 'pnl-negative' },
  ];

  if (trade.simulated) {
    detailPairs.unshift({ label: 'Mode', value: '🎮 SIMULATED', cls: 'setup-simulated' });
  }

  if (trade.outcome === 'loss') {
    const mistakeLabel = MISTAKE_LABELS[trade.mistake] || 'None (Clean Execution)';
    detailPairs.push({
      label: 'Psychology Leak',
      value: mistakeLabel,
      cls: trade.mistake ? 'pnl-negative' : 'pnl-positive'
    });
  }

  if (trade.emotionTag) {
    const emotionLabels = {
      fomo: 'FOMO 😨',
      greed: 'Greed 🤑',
      calm: 'Calm 🧘',
      impatient: 'Impatient ⏳',
      confident: 'Confident 😎',
      anxious: 'Anxious 😰',
      revenge: 'Revenge 😡'
    };
    detailPairs.push({
      label: 'Emotion State',
      value: emotionLabels[trade.emotionTag] || trade.emotionTag
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

  // EdgeFlo Guardrails Status
  const guardrailsSection = el('div', 'trade-modal__notes');
  guardrailsSection.appendChild(el('div', 'trade-modal__notes-title', '🛡️ EdgeFlo Guardrails Checklist'));
  
  const gList = el('div', '');
  gList.style.display = 'grid';
  gList.style.gridTemplateColumns = '1fr 1fr';
  gList.style.gap = 'var(--space-2)';
  
  const gData = trade.guardrails || { newsChecked: true, htfBiasAligned: true, killzoneTiming: true, sizeCalculatorUsed: true };
  const gItems = [
    { label: 'News Checked', checked: gData.newsChecked },
    { label: 'Bias Aligned', checked: gData.htfBiasAligned },
    { label: 'Killzone Timing', checked: gData.killzoneTiming },
    { label: 'Position Sizing Used', checked: gData.sizeCalculatorUsed }
  ];
  
  gItems.forEach(item => {
    const row = el('div', '');
    row.style.display = 'flex';
    row.style.alignItems = 'center';
    row.style.gap = '6px';
    row.style.fontSize = 'var(--text-xs)';
    row.style.color = item.checked ? 'var(--neon-green)' : 'var(--neon-red)';
    row.style.fontWeight = '600';
    
    const badge = el('span', '', item.checked ? '✅' : '❌');
    row.appendChild(badge);
    row.appendChild(document.createTextNode(item.label));
    gList.appendChild(row);
  });
  guardrailsSection.appendChild(gList);
  body.appendChild(guardrailsSection);

  if (trade.notes) {
    const notesSection = el('div', 'trade-modal__notes');
    notesSection.appendChild(el('div', 'trade-modal__notes-title', 'Notes'));
    notesSection.appendChild(el('div', 'trade-modal__notes-body', trade.notes));
    body.appendChild(notesSection);
  }

  if (trade.reflection_well || trade.reflection_leak || trade.reflection_pattern) {
    const refSection = el('div', 'trade-modal__notes');
    refSection.appendChild(el('div', 'trade-modal__notes-title', '📓 Post-Trade Reflections'));
    
    const refBody = el('div', 'trade-modal__notes-body');
    refBody.style.display = 'flex';
    refBody.style.flexDirection = 'column';
    refBody.style.gap = 'var(--space-3)';
    refBody.style.marginTop = 'var(--space-2)';
    
    if (trade.reflection_well) {
      const p = el('p', '');
      p.appendChild(el('strong', '', '🌟 What went well: '));
      p.appendChild(document.createTextNode(trade.reflection_well));
      p.style.fontSize = '12px';
      refBody.appendChild(p);
    }
    
    if (trade.reflection_leak) {
      const p = el('p', '');
      p.appendChild(el('strong', '', '🩸 Biggest leak: '));
      p.appendChild(document.createTextNode(trade.reflection_leak));
      p.style.fontSize = '12px';
      refBody.appendChild(p);
    }
    
    if (trade.reflection_pattern) {
      const p = el('p', '');
      p.appendChild(el('strong', '', '📐 Best pattern: '));
      p.appendChild(document.createTextNode(trade.reflection_pattern));
      p.style.fontSize = '12px';
      refBody.appendChild(p);
    }
    
    refSection.appendChild(refBody);
    body.appendChild(refSection);
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
    // Fetch active trading plan to perform compliance checks
    let planViolationText = '';
    try {
      const plan = JSON.parse(localStorage.getItem('swagga:active_trading_plan'));
      if (plan) {
        const tradeRisk = parseFloat(trade.riskPct) || 0;
        const maxAllowedRisk = parseFloat(plan.riskPerTrade) || 1.0;
        
        if (tradeRisk > maxAllowedRisk) {
          planViolationText += `🚨 **Plan Violation:** You risked **${tradeRisk}%** on this trade, exceeding your maximum allowed plan limit of **${maxAllowedRisk}%**! Over-leveraging violates our core risk rules! `;
        }
        
        const isFocusAsset = plan.focusAssets.some(a => trade.asset && trade.asset.toUpperCase().includes(a.toUpperCase()));
        if (plan.focusAssets.length > 0 && !isFocusAsset) {
          planViolationText += `🚨 **Plan Violation:** **${asset}** is not listed in your focus assets (${plan.focusAssets.join(', ')}). Protect your focus by sticking to your main pairs! `;
        }

        if (!trade.stop || parseFloat(trade.stop) === 0) {
          planViolationText += `🚨 **Plan Violation:** This trade was executed without a Stop Loss! Entering without protection is gambling, not professional execution. `;
        }
      }
    } catch (e) {
      console.warn('Failed to parse trading plan for critique:', e);
    }

    if (isWin) {
      let text = `Let's go, SwaGGa! 🚀 That was an absolutely beautiful **${dir}** trade execution on **${asset}**! `;
      
      if (planViolationText) {
        text += planViolationText;
      }

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
      
      if (planViolationText) {
        text += planViolationText;
      }

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

// Render form to edit an existing trade
export function openEditTradeModal(trade, onRefresh) {
  const overlay = el('div', 'trade-modal-overlay');
  const modal = el('div', 'trade-modal');
  modal.style.maxWidth = '600px';

  // Mobile sheet grab bar
  const grabHandle = el('div', 'modal-swipe-handle');
  modal.appendChild(grabHandle);

  // Gradient topbar
  const topbar = el('div', '');
  topbar.style.height = '3px';
  topbar.style.background = 'linear-gradient(90deg, var(--cyan), var(--purple), var(--neon-green))';
  modal.appendChild(topbar);

  // Header
  const header = el('div', 'trade-modal__header');
  header.appendChild(el('h2', 'trade-modal__title', `✏️ Edit Trade (${trade.asset})`));
  const closeBtn = el('button', 'trade-modal__close', '✕');
  closeBtn.addEventListener('click', () => {
    overlay.classList.remove('trade-modal-overlay--visible');
    setTimeout(() => overlay.remove(), 250);
  });
  header.appendChild(closeBtn);
  modal.appendChild(header);

  // Body
  const body = el('div', 'trade-modal__body');
  body.style.maxHeight = '75vh';
  body.style.overflowY = 'auto';
  body.style.padding = 'var(--space-6)';

  const form = el('form', 'trade-form');
  form.setAttribute('novalidate', '');

  // ---- Asset Select ----
  const assetSelect = document.createElement('select');
  assetSelect.name = 'asset';
  assetSelect.required = true;
  assetSelect.className = 'form-select';
  
  for (const [category, symbols] of Object.entries(ASSETS)) {
    const optgroup = document.createElement('optgroup');
    optgroup.label = category;
    symbols.forEach((sym) => {
      const opt = el('option', '', sym);
      opt.value = sym;
      if (sym === trade.asset) opt.selected = true;
      optgroup.appendChild(opt);
    });
    assetSelect.appendChild(optgroup);
  }
  form.appendChild(formGroup('Asset', assetSelect));

  // ---- Direction ----
  const dirSelect = document.createElement('select');
  dirSelect.name = 'direction';
  dirSelect.className = 'form-select';
  ['long', 'short'].forEach((d) => {
    const opt = el('option', '', d.toUpperCase());
    opt.value = d;
    if (d === trade.direction) opt.selected = true;
    dirSelect.appendChild(opt);
  });
  form.appendChild(formGroup('Direction', dirSelect));

  // ---- Price inputs ----
  const getSelectedAssetConfig = () => getAssetConfig(assetSelect.value);

  const entrySpinner = createSpinnerInput('entry', 'Entry Price', String(trade.entry), true, getSelectedAssetConfig);
  form.appendChild(formGroup('Entry Price', entrySpinner.container));

  const stopSpinner = createSpinnerInput('stop', 'Stop Loss Price', String(trade.stop || ''), true, getSelectedAssetConfig);
  form.appendChild(formGroup('Stop Loss', stopSpinner.container));

  const exitSpinner = createSpinnerInput('exit', 'Exit Price', String(trade.exit), true, getSelectedAssetConfig);
  form.appendChild(formGroup('Exit Price', exitSpinner.container));

  // ---- Sizing Mode ----
  const sizingModeSelect = document.createElement('select');
  sizingModeSelect.name = 'sizingMode';
  sizingModeSelect.className = 'form-select';
  
  const optAuto = el('option', '', 'Auto (Risk Calculator)');
  optAuto.value = 'auto';
  const optManual = el('option', '', 'Manual (Lots / Volume)');
  optManual.value = 'manual';
  
  sizingModeSelect.appendChild(optAuto);
  sizingModeSelect.appendChild(optManual);
  
  const initialSizingMode = trade.sizingMode || 'auto';
  sizingModeSelect.value = initialSizingMode;
  form.appendChild(formGroup('Sizing Mode', sizingModeSelect));

  // ---- Manual Lots Input ----
  const manualLotsInput = document.createElement('input');
  manualLotsInput.type = 'number';
  manualLotsInput.name = 'manualLots';
  manualLotsInput.step = 'any';
  manualLotsInput.placeholder = 'e.g. 0.01';
  manualLotsInput.className = 'form-input';
  
  const multiplier = getContractMultiplier(trade.asset);
  const currentLotsVal = trade.manualLots !== undefined && trade.manualLots !== '' ? trade.manualLots : (trade.size / multiplier);
  manualLotsInput.value = currentLotsVal ? Number(currentLotsVal).toFixed(2) : '';
  
  const manualLotsGroup = formGroup('Position Volume (Lots)', manualLotsInput);
  manualLotsGroup.style.display = initialSizingMode === 'manual' ? 'block' : 'none';
  
  const lotsHint = el('span', 'input-format-hint');
  lotsHint.style.fontSize = 'var(--text-xs)';
  lotsHint.style.color = 'var(--text-muted)';
  lotsHint.style.marginTop = 'var(--space-1)';
  lotsHint.style.display = 'block';
  manualLotsGroup.appendChild(lotsHint);
  
  form.appendChild(manualLotsGroup);

  function updateLotsHint() {
    const assetName = assetSelect.value;
    const mult = getContractMultiplier(assetName);
    let assetClass = 'Units';
    if (assetName) {
      if (assetName.includes('XAU') || assetName.includes('GOLD')) assetClass = 'Ounces';
      else if (assetName.includes('XAG') || assetName.includes('SILVER')) assetClass = 'Ounces';
    }
    lotsHint.textContent = `1 Standard Lot = ${mult.toLocaleString()} ${assetClass}`;
  }

  updateLotsHint();
  assetSelect.addEventListener('change', updateLotsHint);

  sizingModeSelect.addEventListener('change', () => {
    manualLotsGroup.style.display = sizingModeSelect.value === 'manual' ? 'block' : 'none';
  });

  // ---- Date ----
  const dateInput = document.createElement('input');
  dateInput.type = 'date';
  dateInput.name = 'date';
  dateInput.className = 'form-input';
  dateInput.value = trade.date || new Date().toISOString().slice(0, 10);
  form.appendChild(formGroup('Date', dateInput));

  // ---- Timeframe & Session ----
  const tfSelect = document.createElement('select');
  tfSelect.name = 'timeframe';
  tfSelect.className = 'form-select';
  ['1m', '5m', '15m', '1h', '4h', 'Daily', 'Weekly'].forEach(tf => {
    const opt = el('option', '', tf);
    opt.value = tf;
    if (tf === trade.timeframe) opt.selected = true;
    tfSelect.appendChild(opt);
  });
  form.appendChild(formGroup('Timeframe', tfSelect));

  const sessionSelect = document.createElement('select');
  sessionSelect.name = 'session';
  sessionSelect.className = 'form-select';
  ['Asian', 'London', 'New York', 'London Close'].forEach(s => {
    const opt = el('option', '', s);
    opt.value = s.toLowerCase();
    if (s.toLowerCase() === (trade.session || '').toLowerCase()) opt.selected = true;
    sessionSelect.appendChild(opt);
  });
  form.appendChild(formGroup('Session', sessionSelect));

  // ---- Outcome ----
  const outcomeSelect = document.createElement('select');
  outcomeSelect.name = 'outcome';
  outcomeSelect.className = 'form-select';
  ['win', 'loss', 'break-even'].forEach(o => {
    const opt = el('option', '', o.toUpperCase());
    opt.value = o;
    if (o === trade.outcome) opt.selected = true;
    outcomeSelect.appendChild(opt);
  });
  form.appendChild(formGroup('Outcome', outcomeSelect));

  // ---- Custom P&L (Optional) ----
  const customPnlInput = document.createElement('input');
  customPnlInput.type = 'number';
  customPnlInput.name = 'customPnL';
  customPnlInput.step = 'any';
  customPnlInput.placeholder = 'e.g. 26.00 (Leave blank to auto-calculate)';
  customPnlInput.className = 'form-input';
  customPnlInput.value = trade.customPnL !== undefined ? trade.customPnL : '';
  form.appendChild(formGroup('Actual P&L ($) (Optional)', customPnlInput));

  // ---- Mistakes ----
  const mistakeSelect = document.createElement('select');
  mistakeSelect.name = 'mistake';
  mistakeSelect.className = 'form-select';
  const noMistakeOpt = el('option', '', 'None (Clean Execution)');
  noMistakeOpt.value = '';
  mistakeSelect.appendChild(noMistakeOpt);
  Object.entries(MISTAKE_LABELS).forEach(([k, label]) => {
    const opt = el('option', '', label);
    opt.value = k;
    if (k === trade.mistake) opt.selected = true;
    mistakeSelect.appendChild(opt);
  });
  const mistakeGroup = formGroup('Psychology Leak', mistakeSelect);
  mistakeGroup.style.display = trade.outcome === 'loss' ? 'block' : 'none';
  outcomeSelect.addEventListener('change', () => {
    mistakeGroup.style.display = outcomeSelect.value === 'loss' ? 'block' : 'none';
  });
  form.appendChild(mistakeGroup);
  renderMistakeTipsAndStudyGuide(mistakeSelect, mistakeGroup);

  // ---- Emotion Tag Picker ----
  const emotionInput = document.createElement('input');
  emotionInput.type = 'hidden';
  emotionInput.name = 'emotionTag';
  emotionInput.value = trade.emotionTag || '';

  const emotionWrapper = el('div', 'emotion-tag-picker');
  const emotions = [
    { key: 'fomo', label: 'FOMO 😨' },
    { key: 'greed', label: 'Greed 🤑' },
    { key: 'calm', label: 'Calm 🧘' },
    { key: 'impatient', label: 'Impatient ⏳' },
    { key: 'confident', label: 'Confident 😎' },
    { key: 'anxious', label: 'Anxious 😰' },
    { key: 'revenge', label: 'Revenge 😡' }
  ];

  emotions.forEach(e => {
    const pill = el('button', 'emotion-pill', e.label);
    pill.type = 'button';
    pill.className = 'emotion-pill';
    if (trade.emotionTag === e.key) {
      pill.classList.add('emotion-pill--active');
    }
    pill.addEventListener('click', () => {
      const active = emotionInput.value === e.key;
      emotionWrapper.querySelectorAll('.emotion-pill').forEach(btn => {
        btn.classList.remove('emotion-pill--active');
      });
      if (active) {
        emotionInput.value = '';
      } else {
        emotionInput.value = e.key;
        pill.classList.add('emotion-pill--active');
        nativeHaptic('light');
      }
    });
    emotionWrapper.appendChild(pill);
  });

  form.appendChild(emotionInput);
  form.appendChild(formGroup('Emotion at Execution', emotionWrapper));

  // ---- Execution Mindset ----
  const mindsetSelect = document.createElement('select');
  mindsetSelect.name = 'executionMindset';
  mindsetSelect.className = 'form-select';
  ['professional', 'anxious', 'revenge'].forEach(m => {
    const opt = el('option', '', m.toUpperCase());
    opt.value = m;
    if (m === trade.executionMindset) opt.selected = true;
    mindsetSelect.appendChild(opt);
  });
  form.appendChild(formGroup('Execution Mindset', mindsetSelect));

  // ---- Guardrails Checklist ----
  const gData = trade.guardrails || { newsChecked: true, htfBiasAligned: true, killzoneTiming: true, sizeCalculatorUsed: true };
  const createCheckbox = (label, name, checked) => {
    const wrap = el('label', 'checkbox-label');
    wrap.style.display = 'flex';
    wrap.style.alignItems = 'center';
    wrap.style.gap = 'var(--space-2)';
    wrap.style.fontSize = 'var(--text-xs)';
    wrap.style.cursor = 'pointer';
    wrap.style.marginBottom = 'var(--space-1)';

    const chk = document.createElement('input');
    chk.type = 'checkbox';
    chk.name = name;
    chk.checked = checked;
    wrap.appendChild(chk);
    wrap.appendChild(document.createTextNode(label));
    return { wrap, chk };
  };
  const gcNews = createCheckbox('Checked News Calendar 📰', 'guardrail_newsChecked', gData.newsChecked);
  const gcBias = createCheckbox('HTF Bias Aligned 📈', 'guardrail_htfBiasAligned', gData.htfBiasAligned);
  const gcKill = createCheckbox('Killzone Session Timing ⏱️', 'guardrail_killzoneTiming', gData.killzoneTiming);
  const gcSize = createCheckbox('Position Sizer Used 📐', 'guardrail_sizeCalculatorUsed', gData.sizeCalculatorUsed);

  const guardrailsWrap = el('div', '');
  guardrailsWrap.appendChild(gcNews.wrap);
  guardrailsWrap.appendChild(gcBias.wrap);
  guardrailsWrap.appendChild(gcKill.wrap);
  guardrailsWrap.appendChild(gcSize.wrap);
  form.appendChild(formGroup('EdgeFlo Guardrails Checklist', guardrailsWrap));

  // ---- EdgeFlo Pre-Entry 7-Question Filter ----
  const filterFieldset = el('fieldset', 'confluence-fieldset pre-entry-fieldset');
  filterFieldset.style.borderColor = 'rgba(142, 94, 237, 0.2)';
  const filterLegend = el('legend', '', '📋 EdgeFlo Pre-Entry 7-Question Filter');
  filterLegend.style.color = 'var(--purple)';
  filterFieldset.appendChild(filterLegend);

  const filterQuestions = [
    { key: 'trendAligned', label: 'Higher-timeframe trend aligned with direction? 📈' },
    { key: 'setupMatch', label: 'Matches a documented setup in my playbook? 📖' },
    { key: 'invalidationSet', label: 'Exact invalidation price level identified? 🛑' },
    { key: 'rrOk', label: 'Potential R:R meets minimum target ratio? 🎯' },
    { key: 'sizingMath', label: 'Position size calculated mathematically (no feel)? 🧮' },
    { key: 'catalystPresent', label: 'Clear execution trigger or volume catalyst? ⚡' },
    { key: 'planAligned', label: 'Emotionally calm & fully aligned with trading plan? 🧘' }
  ];

  const initialPreTrade = trade.preTradeChecklist || {
    trendAligned: true, setupMatch: true, invalidationSet: true, rrOk: true, sizingMath: true, catalystPresent: true, planAligned: true
  };

  const preTradeCheckboxes = {};

  filterQuestions.forEach(q => {
    const wrap = el('label', 'checkbox-label');
    wrap.style.display = 'flex';
    wrap.style.alignItems = 'center';
    wrap.style.gap = 'var(--space-2)';
    wrap.style.fontSize = 'var(--text-xs)';
    wrap.style.cursor = 'pointer';
    wrap.style.marginBottom = 'var(--space-1)';

    const chk = document.createElement('input');
    chk.type = 'checkbox';
    chk.name = `pretrade_${q.key}`;
    chk.checked = !!initialPreTrade[q.key];
    chk.addEventListener('change', () => nativeHaptic('light'));
    wrap.appendChild(chk);
    wrap.appendChild(document.createTextNode(q.label));
    if (q.key === 'setupMatch') {
      const viewLink = el('span', 'playbook-ref-link', 'View Playbook 🔍');
      viewLink.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        openPlaybookReferenceModal();
      });
      wrap.appendChild(viewLink);
    }
    filterFieldset.appendChild(wrap);
    preTradeCheckboxes[q.key] = chk;
  });
  form.appendChild(filterFieldset);

  // ---- Confluences Checklist ----
  const confTitle = el('label', 'form-label', 'Confluences');
  
  const edgePreviewBadge = el('div', 'edge-preview-badge');
  edgePreviewBadge.style.display = 'none';
  edgePreviewBadge.style.marginTop = 'var(--space-1)';
  edgePreviewBadge.style.marginBottom = 'var(--space-2)';
  edgePreviewBadge.style.padding = 'var(--space-2) var(--space-3)';
  edgePreviewBadge.style.borderRadius = 'var(--radius-md)';
  edgePreviewBadge.style.fontSize = 'var(--text-xs)';
  edgePreviewBadge.style.fontWeight = '700';
  edgePreviewBadge.style.width = 'fit-content';

  const confContainer = el('div', 'confluences-checklist-container');
  confContainer.style.maxHeight = '240px';
  confContainer.style.overflowY = 'auto';
  confContainer.style.border = '1px solid rgba(255,255,255,0.08)';
  confContainer.style.borderRadius = 'var(--radius-md)';
  confContainer.style.padding = 'var(--space-2)';
  confContainer.style.display = 'flex';
  confContainer.style.flexDirection = 'column';
  confContainer.style.gap = 'var(--space-1)';
  confContainer.style.marginBottom = 'var(--space-4)';

  const confWrapper = el('div', '');
  confWrapper.appendChild(confTitle);
  confWrapper.appendChild(edgePreviewBadge);
  confWrapper.appendChild(confContainer);

  const originalOnCheckboxChange = () => {
    updateEdgePreviewBadge(confWrapper, edgePreviewBadge);
    autoSelectGradeFromConfluences();
  };

  renderCategorizedConfluencesChecklist(confContainer, trade.confluences || [], originalOnCheckboxChange);
  
  form.appendChild(confWrapper);

  // ---- Setup Grade Picker (EdgeFlo A+ Setup integration) ----
  const gradeWrapper = el('div', 'form-group');
  const gradeLabel = el('label', 'form-label', '⭐ Setup Grade');
  gradeWrapper.appendChild(gradeLabel);

  const gradeSegment = el('div', 'premarket-segment-control');
  gradeSegment.style.marginBottom = 'var(--space-2)';

  const grades = [
    { key: 'A+', label: '🏆 A+' },
    { key: 'A', label: '🥇 A' },
    { key: 'B', label: '🥈 B' },
    { key: 'C', label: '🥉 C' }
  ];

  const gradeWarning = el('div', 'grade-warning-banner');
  gradeWarning.style.display = 'none';
  gradeWarning.style.fontSize = 'var(--text-xs)';
  gradeWarning.style.padding = 'var(--space-2) var(--space-3)';
  gradeWarning.style.borderRadius = 'var(--radius-md)';
  gradeWarning.style.marginTop = 'var(--space-2)';

  let selectedGrade = trade.setupQuality || '';
  let isGradeManuallySelected = !!trade.setupQuality;

  const hiddenGradeInput = document.createElement('input');
  hiddenGradeInput.type = 'hidden';
  hiddenGradeInput.name = 'setupQuality';
  hiddenGradeInput.value = selectedGrade;
  gradeWrapper.appendChild(hiddenGradeInput);

  grades.forEach(g => {
    const btn = el('button', `segment-btn${selectedGrade === g.key ? ' active' : ''}`, g.label);
    btn.type = 'button';
    btn.addEventListener('click', () => {
      playSynthSound('click');
      isGradeManuallySelected = true;
      selectedGrade = g.key;
      hiddenGradeInput.value = g.key;
      gradeSegment.querySelectorAll('.segment-btn').forEach(x => x.classList.remove('active'));
      btn.classList.add('active');
      updateGradeWarning(g.key);
    });
    gradeSegment.appendChild(btn);
  });
  gradeWrapper.appendChild(gradeSegment);
  gradeWrapper.appendChild(gradeWarning);
  form.appendChild(gradeWrapper);

  function updateGradeWarning(grade) {
    if (!grade) {
      gradeWarning.style.display = 'none';
      return;
    }
    gradeWarning.style.display = 'block';
    if (grade === 'A+') {
      gradeWarning.textContent = '🟢 EdgeFlo: Optimal maximum confluence setup! High probability, execute cleanly.';
      gradeWarning.style.background = 'rgba(57, 255, 20, 0.08)';
      gradeWarning.style.color = 'var(--neon-green)';
      gradeWarning.style.border = '1px solid rgba(57, 255, 20, 0.2)';
    } else if (grade === 'A') {
      gradeWarning.textContent = '🟢 EdgeFlo: High conviction setup. Follow your execution plan closely.';
      gradeWarning.style.background = 'rgba(57, 255, 20, 0.05)';
      gradeWarning.style.color = 'var(--neon-green)';
      gradeWarning.style.border = '1px solid rgba(57, 255, 20, 0.1)';
    } else if (grade === 'B') {
      gradeWarning.textContent = '⚠️ EdgeFlo Warning: B-grade setup is missing a non-negotiable. Recommend skipping to protect capital.';
      gradeWarning.style.background = 'rgba(245, 158, 11, 0.08)';
      gradeWarning.style.color = '#f59e0b';
      gradeWarning.style.border = '1px solid rgba(245, 158, 11, 0.2)';
    } else {
      gradeWarning.textContent = '❌ EdgeFlo Caution: C-grade setup is low-conviction or ad-hoc. Trading C-grade setups breaks professional discipline. Do not trade!';
      gradeWarning.style.background = 'rgba(255, 59, 59, 0.08)';
      gradeWarning.style.color = 'var(--neon-red)';
      gradeWarning.style.border = '1px solid rgba(255, 59, 59, 0.2)';
    }
  }

  function autoSelectGradeFromConfluences() {
    if (isGradeManuallySelected) return;
    const confluencesCount = confContainer.querySelectorAll('input[name="confluences"]:checked').length;
    let suggestedGrade = 'C';
    if (confluencesCount >= 5) suggestedGrade = 'A+';
    else if (confluencesCount === 4) suggestedGrade = 'A';
    else if (confluencesCount === 3) suggestedGrade = 'B';

    selectedGrade = suggestedGrade;
    hiddenGradeInput.value = suggestedGrade;
    
    gradeSegment.querySelectorAll('.segment-btn').forEach(btn => {
      const isMatch = btn.textContent.includes(suggestedGrade);
      if (isMatch) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
    updateGradeWarning(suggestedGrade);
  }

  if (selectedGrade) {
    updateGradeWarning(selectedGrade);
  } else {
    autoSelectGradeFromConfluences();
  }

  // Trigger initial calculation if confluences are checked
  updateEdgePreviewBadge(confWrapper, edgePreviewBadge);

  // ---- Notes ----
  const notesArea = document.createElement('textarea');
  notesArea.name = 'notes';
  notesArea.className = 'form-textarea';
  notesArea.value = trade.notes || '';
  notesArea.rows = 3;

  const notesEditWrapper = el('div');
  notesEditWrapper.style.display = 'flex';
  notesEditWrapper.style.gap = 'var(--space-2)';
  notesEditWrapper.style.alignItems = 'flex-end';
  
  const notesEditMicBtn = el('button', 'mic-btn', '🎙️');
  notesEditMicBtn.type = 'button';
  notesEditMicBtn.title = 'Speak to input notes';
  
  notesEditWrapper.appendChild(notesArea);
  notesEditWrapper.appendChild(notesEditMicBtn);
  
  setupVoiceDictation(notesArea, notesEditMicBtn);

  form.appendChild(formGroup('Notes', notesEditWrapper));

  // ---- Post-Trade Reflection Fields ----
  const wellTextarea = document.createElement('textarea');
  wellTextarea.name = 'reflection_well';
  wellTextarea.rows = 2;
  wellTextarea.value = trade.reflection_well || '';
  wellTextarea.placeholder = 'What went well with this execution?';
  form.appendChild(formGroup('🌟 What Went Well?', wellTextarea));

  const leakTextarea = document.createElement('textarea');
  leakTextarea.name = 'reflection_leak';
  leakTextarea.rows = 2;
  leakTextarea.value = trade.reflection_leak || '';
  leakTextarea.placeholder = 'What was your biggest leak / mistake here?';
  form.appendChild(formGroup('🩸 Biggest Leak?', leakTextarea));

  const patternTextarea = document.createElement('textarea');
  patternTextarea.name = 'reflection_pattern';
  patternTextarea.rows = 2;
  patternTextarea.value = trade.reflection_pattern || '';
  patternTextarea.placeholder = 'What setup/pattern did you identify?';
  form.appendChild(formGroup('📐 Pattern Identified?', patternTextarea));

  // ---- Hidden inputs ----
  const screenshotHidden = document.createElement('input');
  screenshotHidden.type = 'hidden';
  screenshotHidden.name = 'screenshot';
  screenshotHidden.value = trade.screenshot || '';
  form.appendChild(screenshotHidden);

  // ---- Actions row ----
  const actionsRow = el('div', 'modal-actions-row');
  actionsRow.style.display = 'flex';
  actionsRow.style.gap = 'var(--space-3)';
  actionsRow.style.marginTop = 'var(--space-5)';

  const saveBtn = el('button', 'btn btn-primary', 'Save Updates 💾');
  saveBtn.type = 'submit';
  saveBtn.style.flex = '1';
  actionsRow.appendChild(saveBtn);

  const cancelBtn = el('button', 'btn btn-outline', 'Cancel');
  cancelBtn.type = 'button';
  cancelBtn.style.flex = '1';
  cancelBtn.addEventListener('click', () => {
    overlay.classList.remove('trade-modal-overlay--visible');
    setTimeout(() => overlay.remove(), 250);
  });
  actionsRow.appendChild(cancelBtn);
  form.appendChild(actionsRow);

  body.appendChild(form);
  modal.appendChild(body);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  // Animate in
  requestAnimationFrame(() => overlay.classList.add('trade-modal-overlay--visible'));

  // Submit handler
  form.addEventListener('submit', (e) => {
    e.preventDefault();

    const entry = Number(entrySpinner.input.value);
    const stop = Number(stopSpinner.input.value);
    const exit = Number(exitSpinner.input.value);

    // Validation
    if (!entry || !stop || !exit) {
      showNotificationToast('Please fill in all entry/stop/exit prices.', '⚠️');
      return;
    }

    if (entry === stop) {
      showNotificationToast('Entry and Stop Loss prices cannot be equal.', '⚠️');
      return;
    }

    // Collect checklist checkboxes
    const confluences = [];
    form.querySelectorAll('input[name="confluences"]:checked').forEach(cb => {
      confluences.push(cb.value);
    });

    const newsChecked = gcNews.chk.checked;
    const htfBiasAligned = gcBias.chk.checked;
    const killzoneTiming = gcKill.chk.checked;
    const sizeCalculatorUsed = gcSize.chk.checked;

    let edgeScore = 100;
    if (!newsChecked) edgeScore -= 15;
    if (!htfBiasAligned) edgeScore -= 15;
    if (!killzoneTiming) edgeScore -= 15;
    if (!sizeCalculatorUsed) edgeScore -= 15;

    const mindset = mindsetSelect.value;
    if (mindset === 'anxious') edgeScore -= 15;
    else if (mindset === 'revenge') edgeScore -= 35;

    const emotionTag = form.querySelector('input[name="emotionTag"]').value;
    if (emotionTag === 'fomo') edgeScore -= 20;
    else if (emotionTag === 'greed') edgeScore -= 15;
    else if (emotionTag === 'impatient') edgeScore -= 15;
    else if (emotionTag === 'revenge') edgeScore -= 30;
    else if (emotionTag === 'anxious') edgeScore -= 15;

    const outcome = outcomeSelect.value;
    const mistake = outcome === 'loss' ? mistakeSelect.value : '';
    if (outcome === 'loss' && mistake) {
      edgeScore -= 20;
    }

    const preTradeChecklist = {
      trendAligned: form.querySelector('input[name="pretrade_trendAligned"]').checked,
      setupMatch: form.querySelector('input[name="pretrade_setupMatch"]').checked,
      invalidationSet: form.querySelector('input[name="pretrade_invalidationSet"]').checked,
      rrOk: form.querySelector('input[name="pretrade_rrOk"]').checked,
      sizingMath: form.querySelector('input[name="pretrade_sizingMath"]').checked,
      catalystPresent: form.querySelector('input[name="pretrade_catalystPresent"]').checked,
      planAligned: form.querySelector('input[name="pretrade_planAligned"]').checked,
    };

    let uncheckedPtcCount = 0;
    Object.values(preTradeChecklist).forEach(val => {
      if (!val) uncheckedPtcCount++;
    });
    edgeScore -= (uncheckedPtcCount * 10);
    edgeScore = Math.max(0, edgeScore);

    const sizingMode = sizingModeSelect.value;
    const balanceUsed = trade.balanceUsed || Number(storage.get('preset_balance', '10000'));
    const riskPct = trade.riskPct || Number(storage.get('preset_risk', '1.0'));
    const slDistance = Math.abs(entry - stop);
    
    let size = 1;
    let manualLots = '';
    if (sizingMode === 'manual') {
      manualLots = Number(manualLotsInput.value) || 0.01;
      const multiplier = getContractMultiplier(assetSelect.value);
      size = manualLots * multiplier;
    } else {
      if (slDistance > 0) {
        const riskAmount = (balanceUsed * riskPct) / 100;
        size = riskAmount / slDistance;
      }
    }

    const customPnLVal = form.querySelector('input[name="customPnL"]').value;
    const updatedData = {
      asset: assetSelect.value,
      direction: dirSelect.value,
      entry,
      stop,
      exit,
      size,
      sizingMode,
      manualLots,
      customPnL: (() => {
        if (customPnLVal === '') return '';
        const val = Number(customPnLVal);
        if (outcome === 'loss') return -Math.abs(val);
        if (outcome === 'win') return Math.abs(val);
        return val;
      })(),
      date: dateInput.value,
      timeframe: tfSelect.value,
      session: sessionSelect.value,
      confluences,
      outcome,
      mistake,
      notes: sanitizeText(notesArea.value, 2000),
      screenshot: screenshotHidden.value,
      executionMindset: mindset,
      emotionTag: form.querySelector('input[name="emotionTag"]').value,
      reflection_well: sanitizeText(form.querySelector('textarea[name="reflection_well"]').value, 1000),
      reflection_leak: sanitizeText(form.querySelector('textarea[name="reflection_leak"]').value, 1000),
      reflection_pattern: sanitizeText(form.querySelector('textarea[name="reflection_pattern"]').value, 1000),
      guardrails: {
        newsChecked,
        htfBiasAligned,
        killzoneTiming,
        sizeCalculatorUsed,
      },
      edgeScore,
      setupQuality: form.querySelector('input[name="setupQuality"]').value,
      preTradeChecklist,
    };

    updateTrade(trade.id, updatedData);
    playSynthSound('success');
    showNotificationToast('Trade entry updated successfully! 💾✨');

    overlay.classList.remove('trade-modal-overlay--visible');
    setTimeout(() => {
      overlay.remove();
      if (typeof onRefresh === 'function') onRefresh();
    }, 250);
  });
}

/* ---------- Trade History Table ------------------------------------ */

// Build the trade history table.
let _historyFilterMode = storage.get('history_filter_mode', 'all');

export function renderTradeHistory(container, onRefresh) {
  container.replaceChildren();
  const allTrades = getTrades(true);

  if (!allTrades.length) {
    const empty = el('div', 'empty-state');
    const icon = el('span', 'empty-icon', '📭');
    const msg = el('p', '', 'No trades logged yet. Start journaling!');
    empty.appendChild(icon);
    empty.appendChild(msg);
    container.appendChild(empty);
    return;
  }

  let filteredTrades = allTrades;
  if (_historyFilterMode === 'live') {
    filteredTrades = allTrades.filter(t => !t.simulated);
  } else if (_historyFilterMode === 'simulated') {
    filteredTrades = allTrades.filter(t => t.simulated);
  }

  // Export bar
  const exportBar = el('div', 'export-bar');
  const countLabel = el('span', 'export-count');
  countLabel.textContent = `${filteredTrades.length} trade${filteredTrades.length !== 1 ? 's' : ''}`;
  exportBar.appendChild(countLabel);

  const filterSelect = document.createElement('select');
  filterSelect.className = 'form-select form-select-sm';
  filterSelect.style.width = 'auto';
  filterSelect.style.marginRight = 'var(--space-2)';
  
  const optAll = el('option', '', 'All Trades');
  optAll.value = 'all';
  if (_historyFilterMode === 'all') optAll.selected = true;
  
  const optLive = el('option', '', 'Live Only');
  optLive.value = 'live';
  if (_historyFilterMode === 'live') optLive.selected = true;

  const optSim = el('option', '', 'Simulated Only');
  optSim.value = 'simulated';
  if (_historyFilterMode === 'simulated') optSim.selected = true;

  filterSelect.appendChild(optAll);
  filterSelect.appendChild(optLive);
  filterSelect.appendChild(optSim);

  filterSelect.addEventListener('change', () => {
    _historyFilterMode = filterSelect.value;
    storage.set('history_filter_mode', _historyFilterMode);
    if (typeof onRefresh === 'function') onRefresh();
  });

  const exportBtn = el('button', 'btn btn-outline btn-sm', '📥 Export CSV');
  exportBtn.addEventListener('click', () => exportToCSV(filteredTrades));

  const reviewBtn = el('button', 'btn btn-primary btn-sm review-reset-btn', '🧘 Daily Review & Reset');
  reviewBtn.style.marginLeft = 'var(--space-2)';
  reviewBtn.addEventListener('click', () => openDailyReviewModal(onRefresh));

  const controls = el('div', 'export-controls');
  controls.style.display = 'flex';
  controls.style.alignItems = 'center';
  controls.style.gap = 'var(--space-2)';
  controls.appendChild(filterSelect);
  controls.appendChild(exportBtn);
  controls.appendChild(reviewBtn);

  exportBar.appendChild(controls);

  container.appendChild(exportBar);

  const table = el('table', 'trade-table');
  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');
  const headers = ['Date', 'Asset', 'Dir', 'Entry', 'Exit', 'P&L', 'R:R', 'Score', 'Setup', ''];
  headers.forEach((h) => {
    const th = el('th', '', h);
    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');

  // Show newest first.
  [...filteredTrades].reverse().forEach((t) => {
    const row = document.createElement('tr');

    // Click row to open detail (but not on delete button)
    row.addEventListener('click', (e) => {
      if (e.target.closest('.btn-danger')) return;
      openTradeDetail(t, onRefresh);
    });

    const confCount = Array.isArray(t.confluences) ? t.confluences.length : 0;
    let dynamicQuality = t.setupQuality;
    if (t.simulated) {
      dynamicQuality = 'SIM';
    } else if (!dynamicQuality) {
      if (confCount >= 5) dynamicQuality = 'A+';
      else if (confCount === 4) dynamicQuality = 'A';
      else if (confCount === 3) dynamicQuality = 'B';
      else dynamicQuality = 'C';
    }

    const scoreVal = t.edgeScore !== undefined ? t.edgeScore : 100;
    const cells = [
      formatDate(t.date),
      t.asset,
      t.direction,
      String(t.entry),
      String(t.exit),
      formatCurrency(t.pnl),
      `${t.rr}R`,
      `${scoreVal}%`,
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
        if (t.simulated) {
          const simBadge = el('span', 'setup-simulated', ' 🎮 SIM');
          simBadge.style.marginLeft = '6px';
          simBadge.style.fontSize = '9px';
          simBadge.style.padding = '2px 4px';
          simBadge.title = 'Simulated Trade';
          td.appendChild(simBadge);
        }
        if (t.screenshot) {
          const clip = el('span', 'attachment-icon', ' 🖼️');
          clip.title = 'Screenshot Attached';
          td.appendChild(clip);
        }
        if (t.emotionTag) {
          const emotionEmojis = {
            fomo: '😨',
            greed: '🤑',
            calm: '🧘',
            impatient: '⏳',
            confident: '😎',
            anxious: '😰',
            revenge: '😡'
          };
          const emoBadge = el('span', `emotion-badge emotion-badge--${t.emotionTag}`);
          emoBadge.textContent = ` ${emotionEmojis[t.emotionTag] || ''}`;
          emoBadge.title = `Emotion: ${t.emotionTag}`;
          td.appendChild(emoBadge);
        }
      } else if (idx === 7) {
        td.textContent = val;
        td.classList.add(scoreVal >= 80 ? 'pnl-positive' : scoreVal >= 60 ? 'pnl-neutral' : 'pnl-negative');
      } else if (idx === 8) {
        const badgeClass = t.simulated ? 'setup-simulated' : `setup-${val.toLowerCase().replace('+', 'plus')}`;
        const badge = el('span', badgeClass, val);
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

  const tableWrap = el('div', 'trade-table-wrap');
  const tableContainer = el('div', 'trade-table-container');
  tableContainer.appendChild(table);
  tableWrap.appendChild(tableContainer);
  container.appendChild(tableWrap);
}

function openDailyReviewModal(onRefresh) {
  const overlay = el('div', 'trade-modal-overlay');
  const modal = el('div', 'trade-modal daily-review-modal');
  modal.style.maxWidth = '550px';

  const grabHandle = el('div', 'modal-swipe-handle');
  modal.appendChild(grabHandle);

  const topbar = el('div', 'modal__topbar');
  topbar.style.height = '4px';
  topbar.style.background = 'linear-gradient(90deg, var(--purple), var(--cyan))';
  modal.appendChild(topbar);

  const header = el('div', 'trade-modal__header');
  header.appendChild(el('h2', 'trade-modal__title', '📅 Daily Review & Sanctuary Reset'));
  const closeBtn = el('button', 'trade-modal__close', '✕');
  closeBtn.addEventListener('click', () => {
    stopMeditationAudio();
    overlay.classList.remove('trade-modal-overlay--visible');
    setTimeout(() => overlay.remove(), 250);
  });
  header.appendChild(closeBtn);
  modal.appendChild(header);

  const body = el('div', 'trade-modal__body');
  body.style.padding = 'var(--space-6)';
  modal.appendChild(body);

  overlay.appendChild(modal);

  // Modal State
  let currentStep = 1;
  let meditationSeconds = 600; // 10 minutes
  let meditationInterval = null;
  let audioCtx = null;
  let osc1 = null;
  let osc2 = null;

  function stopMeditationAudio() {
    if (osc1) { try { osc1.stop(); } catch(e){} osc1 = null; }
    if (osc2) { try { osc2.stop(); } catch(e){} osc2 = null; }
    if (audioCtx) { try { audioCtx.close(); } catch(e){} audioCtx = null; }
  }

  function startMeditationAudio() {
    stopMeditationAudio();
    try {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const gainNode = audioCtx.createGain();
      gainNode.gain.value = 0.04; // low volume hum

      osc1 = audioCtx.createOscillator();
      osc2 = audioCtx.createOscillator();

      osc1.frequency.value = 100; // 100 Hz hum
      osc2.frequency.value = 104; // 4 Hz binaural brainwave beat

      osc1.connect(gainNode);
      osc2.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      osc1.start();
      osc2.start();
    } catch(e) {
      console.error('Web Audio not supported or blocked:', e);
    }
  }

  // Calculate Today's Stats
  const todayStr = new Date().toISOString().slice(0, 10);
  const trades = getTrades(true);
  const todayTrades = trades.filter(t => t.date === todayStr || (t.createdAt && t.createdAt.slice(0, 10) === todayStr));
  const todayPnL = todayTrades.reduce((sum, t) => sum + (Number(t.pnl) || 0), 0);
  const todayScore = todayTrades.length > 0 ? Math.round(todayTrades.reduce((sum, t) => sum + (t.edgeScore !== undefined ? t.edgeScore : 100), 0) / todayTrades.length) : 100;

  function renderStep() {
    body.replaceChildren();

    if (currentStep === 1) {
      // Step 1: Battle Feedback
      body.appendChild(el('h3', 'step-title', 'Step 1: Daily Battle Feedback (Ep 24)'));
      body.appendChild(el('p', 'step-hint', 'Evaluate your quantitative trading metrics for today before entering the inner work reflection.'));

      // Stats cards row
      const statsGrid = el('div', 'step-stats-grid');
      statsGrid.style.display = 'grid';
      statsGrid.style.gridTemplateColumns = 'repeat(3, 1fr)';
      statsGrid.style.gap = 'var(--space-3)';
      statsGrid.style.margin = 'var(--space-4) 0';

      const addStatCard = (label, val, cls = '') => {
        const card = el('div', 'step-stat-card glass-card');
        card.style.padding = 'var(--space-3)';
        card.style.borderRadius = 'var(--radius-md)';
        card.style.textAlign = 'center';
        card.appendChild(el('div', 'step-stat-label', label));
        
        const valEl = el('div', 'step-stat-value', val);
        valEl.style.fontSize = 'var(--text-lg)';
        valEl.style.fontWeight = 'bold';
        if (cls) valEl.className += ` ${cls}`;
        card.appendChild(valEl);
        statsGrid.appendChild(card);
      };

      addStatCard('Trades Logged', String(todayTrades.length));
      
      const pnlFormatted = todayPnL >= 0 ? `+$${todayPnL.toFixed(2)}` : `-$${Math.abs(todayPnL).toFixed(2)}`;
      addStatCard('Net P&L', pnlFormatted, todayPnL >= 0 ? 'pnl-positive' : 'pnl-negative');
      
      addStatCard('EdgeScore', `${todayScore}%`, todayScore >= 80 ? 'pnl-positive' : 'pnl-negative');
      body.appendChild(statsGrid);

      // Mentor evaluation text
      const quoteBox = el('div', 'mentor-quote-box glass-card');
      quoteBox.style.padding = 'var(--space-4)';
      quoteBox.style.borderRadius = 'var(--radius-md)';
      quoteBox.style.borderLeft = '3px solid var(--cyan)';
      quoteBox.style.background = 'rgba(0, 212, 255, 0.02)';
      quoteBox.style.margin = 'var(--space-4) 0';

      let mentorQuote = '';
      if (todayTrades.length === 0) {
        mentorQuote = 'Brad Goh: "You did not take any trades today. Remember: knowing when NOT to trade is one of the highest levels of discipline. You protected your capital. Excellent job."';
      } else if (todayPnL >= 0 && todayScore >= 80) {
        mentorQuote = `Brad Goh: "Excellent performance today! You finished green (${pnlFormatted}) while maintaining a solid discipline score of ${todayScore}%. You waited for your edge and executed cleanly. Let's reset your mind so you remain grounded."`;
      } else if (todayPnL < 0 && todayScore >= 80) {
        mentorQuote = `Brad Goh: "You finished red today, but you followed your checklist perfectly (EdgeScore: ${todayScore}%). Taking structured, disciplined losses is just part of the statistical game. Accept it and move on."`;
      } else {
        mentorQuote = `Brad Goh: "Your discipline broke today (EdgeScore: ${todayScore}%). You took trades outside your plan. The green or red outcome does not matter—your rules do. Review your logs, identify the emotional leak, and correct it."`;
      }
      
      const quoteText = el('p', 'step-quote', mentorQuote);
      quoteText.style.fontStyle = 'italic';
      quoteText.style.fontSize = 'var(--text-xs)';
      quoteText.style.lineHeight = '1.6';
      quoteText.style.margin = '0';
      quoteBox.appendChild(quoteText);
      body.appendChild(quoteBox);

      // Actions
      const btnRow = el('div', 'step-btn-row');
      btnRow.style.display = 'flex';
      btnRow.style.justifyContent = 'flex-end';
      btnRow.style.marginTop = 'var(--space-5)';

      const nextBtn = el('button', 'btn btn-primary btn-sm', 'Continue to Inner Work ➔');
      nextBtn.addEventListener('click', () => {
        currentStep = 2;
        renderStep();
      });
      btnRow.appendChild(nextBtn);
      body.appendChild(btnRow);

    } else if (currentStep === 2) {
      // Step 2: Inner Work
      body.appendChild(el('h3', 'step-title', 'Step 2: Inner Work Reflection'));
      body.appendChild(el('p', 'step-hint', 'Brad Goh: "For every hour of chart work, spend an hour on inner work. Reflect on what the market mirrored about you today."'));

      const textareaGroup = el('div', 'form-group');
      textareaGroup.style.margin = 'var(--space-4) 0';
      textareaGroup.appendChild(el('label', 'form-label', 'Qualitative Reflection / Mental Leaks'));
      
      const reflectionArea = document.createElement('textarea');
      reflectionArea.className = 'form-textarea';
      reflectionArea.rows = 4;
      reflectionArea.placeholder = 'Did you feel FOMO? Did you feel greedy? Did you rush entries? What did you learn about your character today...';
      textareaGroup.appendChild(reflectionArea);

      // Session End Mood Picker
      const moodLabel = el('label', 'form-label', 'Session End Mood 🧘');
      moodLabel.style.marginTop = 'var(--space-4)';
      textareaGroup.appendChild(moodLabel);

      const endMoodWrapper = el('div', 'end-mood-picker');
      endMoodWrapper.style.display = 'flex';
      endMoodWrapper.style.gap = 'var(--space-2)';
      endMoodWrapper.style.marginTop = 'var(--space-2)';

      const endMoods = [
        { key: 'hyped', label: '🤩', name: 'Hyped' },
        { key: 'happy', label: '😃', name: 'Good' },
        { key: 'neutral', label: '😐', name: 'Calm' },
        { key: 'anxious', label: '😰', name: 'Anxious' },
        { key: 'angry', label: '😡', name: 'Impatient' }
      ];

      let selectedEndMood = 'neutral';

      endMoods.forEach(em => {
        const btn = el('button', 'btn btn-outline end-mood-btn', `${em.label} ${em.name}`);
        btn.type = 'button';
        btn.style.padding = '6px 12px';
        btn.style.fontSize = '12px';
        btn.style.borderRadius = 'var(--radius-md)';
        btn.style.transition = 'all 0.2s ease';
        
        const updateBtnStyle = () => {
          if (selectedEndMood === em.key) {
            btn.style.background = 'var(--purple-bg)';
            btn.style.borderColor = 'var(--purple)';
            btn.style.color = '#fff';
            btn.style.boxShadow = '0 0 10px rgba(168, 85, 247, 0.3)';
          } else {
            btn.style.background = 'rgba(255, 255, 255, 0.02)';
            btn.style.borderColor = 'rgba(255, 255, 255, 0.1)';
            btn.style.color = 'var(--text-secondary)';
            btn.style.boxShadow = 'none';
          }
        };

        updateBtnStyle();

        btn.addEventListener('click', () => {
          selectedEndMood = em.key;
          endMoodWrapper.querySelectorAll('.end-mood-btn').forEach((otherBtn, idx) => {
            const otherKey = endMoods[idx].key;
            if (otherKey === selectedEndMood) {
              otherBtn.style.background = 'var(--purple-bg)';
              otherBtn.style.borderColor = 'var(--purple)';
              otherBtn.style.color = '#fff';
              otherBtn.style.boxShadow = '0 0 10px rgba(168, 85, 247, 0.3)';
            } else {
              otherBtn.style.background = 'rgba(255, 255, 255, 0.02)';
              otherBtn.style.borderColor = 'rgba(255, 255, 255, 0.1)';
              otherBtn.style.color = 'var(--text-secondary)';
              otherBtn.style.boxShadow = 'none';
            }
          });
        });

        btn.addEventListener('mouseenter', () => {
          if (selectedEndMood !== em.key) {
            btn.style.background = 'rgba(255, 255, 255, 0.06)';
            btn.style.borderColor = 'rgba(255, 255, 255, 0.2)';
            btn.style.color = '#fff';
          }
        });
        btn.addEventListener('mouseleave', () => {
          if (selectedEndMood !== em.key) {
            btn.style.background = 'rgba(255, 255, 255, 0.02)';
            btn.style.borderColor = 'rgba(255, 255, 255, 0.1)';
            btn.style.color = 'var(--text-secondary)';
          }
        });

        endMoodWrapper.appendChild(btn);
      });

      textareaGroup.appendChild(endMoodWrapper);
      body.appendChild(textareaGroup);

      // Actions
      const btnRow = el('div', 'step-btn-row');
      btnRow.style.display = 'flex';
      btnRow.style.justifyContent = 'space-between';
      btnRow.style.marginTop = 'var(--space-5)';

      const backBtn = el('button', 'btn btn-outline btn-sm', '◁ Back');
      backBtn.addEventListener('click', () => {
        currentStep = 1;
        renderStep();
      });
      btnRow.appendChild(backBtn);

      const nextBtn = el('button', 'btn btn-primary btn-sm', 'Save & Enter Sanctuary 🧘');
      nextBtn.addEventListener('click', () => {
        const reflectionText = reflectionArea.value.trim();
        // Log to Study Journal (always create or at least save mood)
        const journalEntries = storage.get('extra_study_journal', []);
        const entry = {
          id: generateId(),
          title: 'End of Day Reflection (Ep 24)',
          source: 'Brad Goh',
          takeaways: reflectionText || 'Completed EOD Mindset Sanctuary Routine.',
          category: 'Mindset',
          createdAt: new Date().toISOString(),
          localDate: todayStr,
          endMood: selectedEndMood
        };
        journalEntries.push(entry);
        storage.set('extra_study_journal', journalEntries);

        if (reflectionText) {
          // Award discipline XP
          addXP('extra_study', 10);
          showNotificationToast('Reflection saved to Study Journal! +10 XP 📝', '🧠');
        } else {
          showNotificationToast('Mood check-in saved! 🧘', '🧠');
        }
        
        // Sync to Cloud if user exists
        import('./firebase-sync.js').then(({ pushToCloud, getCurrentUser }) => {
          if (getCurrentUser()) pushToCloud();
        });
        
        currentStep = 3;
        renderStep();
      });
      btnRow.appendChild(nextBtn);
      body.appendChild(btnRow);

    } else if (currentStep === 3) {
      // Step 3: Sanctuary
      body.appendChild(el('h3', 'step-title', 'Step 3: Reset Sanctuary (10-Min Meditation)'));
      body.appendChild(el('p', 'step-hint', 'Brad Goh: "Use these 10 minutes of meditation to reset your nervous system, let go of today\'s trades, and return to equilibrium."'));

      // Timer Display
      const timerContainer = el('div', 'meditation-timer-container');
      timerContainer.style.display = 'flex';
      timerContainer.style.flexDirection = 'column';
      timerContainer.style.alignItems = 'center';
      timerContainer.style.margin = 'var(--space-6) 0';

      const timerCircle = el('div', 'meditation-circle');
      timerCircle.style.width = '140px';
      timerCircle.style.height = '140px';
      timerCircle.style.borderRadius = '50%';
      timerCircle.style.border = '3px solid var(--purple)';
      timerCircle.style.display = 'flex';
      timerCircle.style.alignItems = 'center';
      timerCircle.style.justifyContent = 'center';
      timerCircle.style.fontSize = '2rem';
      timerCircle.style.fontFamily = 'monospace';
      timerCircle.style.fontWeight = 'bold';
      timerCircle.style.boxShadow = '0 0 20px rgba(168, 85, 247, 0.2)';

      const formatTime = (sec) => {
        const m = Math.floor(sec / 60);
        const s = sec % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
      };

      timerCircle.textContent = formatTime(meditationSeconds);
      timerContainer.appendChild(timerCircle);

      // Audio Toggle Button
      let audioPlaying = false;
      const audioBtn = el('button', 'btn btn-ghost btn-sm', '🔊 Play Binaural Brainwave Hum (4Hz Theta)');
      audioBtn.style.marginTop = 'var(--space-4)';
      audioBtn.addEventListener('click', () => {
        audioPlaying = !audioPlaying;
        if (audioPlaying) {
          startMeditationAudio();
          audioBtn.textContent = '🔇 Mute Binaural Brainwave Hum';
          audioBtn.style.color = 'var(--purple)';
        } else {
          stopMeditationAudio();
          audioBtn.textContent = '🔊 Play Binaural Brainwave Hum (4Hz Theta)';
          audioBtn.style.color = '';
        }
      });
      timerContainer.appendChild(audioBtn);
      body.appendChild(timerContainer);

      // Play/Pause Action Button
      const controls = el('div', 'meditation-controls');
      controls.style.display = 'flex';
      controls.style.gap = 'var(--space-3)';
      controls.style.justifyContent = 'center';

      let timerActive = false;
      const startBtn = el('button', 'btn btn-outline btn-sm', '▶ Start Sanctuary Session');
      startBtn.addEventListener('click', () => {
        timerActive = !timerActive;
        if (timerActive) {
          startBtn.textContent = '⏸ Pause Session';
          if (!audioPlaying) {
            audioBtn.click(); // auto play audio
          }
          meditationInterval = setInterval(() => {
            if (meditationSeconds > 0) {
              meditationSeconds--;
              timerCircle.textContent = formatTime(meditationSeconds);
              nativeHaptic('light');
            } else {
              // Timer Finished
              clearInterval(meditationInterval);
              meditationInterval = null;
              timerActive = false;
              stopMeditationAudio();
              triggerConfetti();
              addXP('meditation', 25);
              nativeHapticNotification('success');
              showNotificationToast('Sanctuary Reset Completed! +25 XP 🧘✨', '🏆');
              
              // Complete early automatically
              completeBtn.click();
            }
          }, 1000);
        } else {
          startBtn.textContent = '▶ Resume Session';
          clearInterval(meditationInterval);
          meditationInterval = null;
          if (audioPlaying) {
            audioBtn.click(); // mute audio
          }
        }
      });
      controls.appendChild(startBtn);

      const completeBtn = el('button', 'btn btn-primary btn-sm', 'Complete & Close 🏁');
      completeBtn.style.marginLeft = 'var(--space-2)';
      completeBtn.addEventListener('click', () => {
        clearInterval(meditationInterval);
        meditationInterval = null;
        stopMeditationAudio();
        
        // Award XP if completed with at least 1 minute of session
        if (meditationSeconds < 540) {
          addXP('meditation', 15);
          triggerConfetti();
          showNotificationToast('Reset Session Logged! +15 XP 🧘', '⭐');
        }

        // Sync to cloud
        import('./firebase-sync.js').then(({ pushToCloud, getCurrentUser }) => {
          if (getCurrentUser()) pushToCloud();
        });

        // Close modal
        overlay.classList.remove('trade-modal-overlay--visible');
        setTimeout(() => {
          overlay.remove();
          if (typeof onRefresh === 'function') onRefresh();
        }, 250);
      });
      controls.appendChild(completeBtn);

      body.appendChild(controls);
    }
  }

  // Initial render of first step
  renderStep();

  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('trade-modal-overlay--visible'));
}

function openPostLossBreathingModal() {
  const overlay = el('div', 'trade-modal-overlay');
  const modal = el('div', 'trade-modal post-loss-modal');
  modal.style.maxWidth = '450px';

  const grabHandle = el('div', 'modal-swipe-handle');
  modal.appendChild(grabHandle);

  const topbar = el('div', 'modal__topbar');
  topbar.style.height = '4px';
  topbar.style.background = 'linear-gradient(90deg, var(--neon-red), var(--purple))';
  modal.appendChild(topbar);

  const header = el('div', 'trade-modal__header');
  header.appendChild(el('h2', 'trade-modal__title', '🛡️ Nervous System Reset Suggestion'));
  const closeBtn = el('button', 'trade-modal__close', '✕');
  closeBtn.addEventListener('click', () => {
    overlay.classList.remove('trade-modal-overlay--visible');
    setTimeout(() => overlay.remove(), 250);
  });
  header.appendChild(closeBtn);
  modal.appendChild(header);

  const body = el('div', 'trade-modal__body');
  body.style.padding = 'var(--space-6)';
  body.style.display = 'flex';
  body.style.flexDirection = 'column';
  body.style.gap = 'var(--space-4)';
  body.style.textAlign = 'center';

  const iconEl = el('div', '', '🧘');
  iconEl.style.fontSize = '3.5rem';
  iconEl.style.animation = 'pulse 2s infinite';
  body.appendChild(iconEl);

  const titleEl = el('h3', '', 'Reset Your Baseline');
  titleEl.style.color = '#fff';
  titleEl.style.fontWeight = 'bold';
  body.appendChild(titleEl);

  const textEl = el('p', '', 'Brad Goh says: "When you experience a loss, your nervous system triggers a fight-or-flight response. Taking a 2-minute box breathing session resets your baseline, preventing emotional revenge trading."');
  textEl.style.fontSize = 'var(--text-xs)';
  textEl.style.lineHeight = '1.6';
  textEl.style.color = 'var(--text-secondary)';
  body.appendChild(textEl);

  // Actions
  const controls = el('div', '');
  controls.style.display = 'flex';
  controls.style.flexDirection = 'column';
  controls.style.gap = 'var(--space-3)';
  controls.style.marginTop = 'var(--space-4)';

  const acceptBtn = el('button', 'btn btn-primary btn-block', '🧘 Enter Mindset Sanctuary');
  acceptBtn.addEventListener('click', () => {
    overlay.classList.remove('trade-modal-overlay--visible');
    setTimeout(() => {
      overlay.remove();
      window.location.hash = '#mindset';
    }, 250);
  });

  const dismissBtn = el('button', 'btn btn-outline btn-block', 'Keep Trading (Dismiss)');
  dismissBtn.addEventListener('click', () => {
    overlay.classList.remove('trade-modal-overlay--visible');
    setTimeout(() => overlay.remove(), 250);
  });

  controls.appendChild(acceptBtn);
  controls.appendChild(dismissBtn);
  body.appendChild(controls);

  modal.appendChild(body);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('trade-modal-overlay--visible'));
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

  // Risk conformance tracking
  let riskConformingCount = 0;
  let tradesWithRiskCount = 0;
  const targetRiskLimit = Number(storage.get('preset_risk', '1'));

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

    // Risk discipline tracking
    let tRisk = t.riskPercent;
    if (tRisk === undefined) {
      const entry = Number(t.entry);
      const stop = Number(t.stop);
      const size = Number(t.size) || 1;
      const balance = Number(t.balanceUsed) || 10000;
      if (entry && stop && entry !== stop) {
        tRisk = (Math.abs(entry - stop) * size / balance) * 100;
      } else {
        tRisk = 1.0;
      }
    }
    if (tRisk <= targetRiskLimit) {
      riskConformingCount++;
    }
    tradesWithRiskCount++;
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

  // Kelly Criterion
  const totalCount = winCount + lossCount;
  const winRate = totalCount > 0 ? (winCount / totalCount) : 0;
  const rRatio = averageLoss > 0 ? (averageWin / averageLoss) : averageWin;
  
  let kellyPercent = 0;
  if (totalCount >= 3 && rRatio > 0) {
    kellyPercent = winRate - ((1 - winRate) / rRatio);
  }

  const riskDisciplineScore = tradesWithRiskCount > 0 ? Math.round((riskConformingCount / tradesWithRiskCount) * 100) : 100;

  return {
    profitFactor: parseFloat(profitFactor.toFixed(2)),
    sharpeRatio: parseFloat(sharpeRatio.toFixed(2)),
    maxDrawdown: parseFloat(maxDrawdownPercent.toFixed(2)),
    maxWinStreak,
    maxLossStreak,
    averageWin: parseFloat(averageWin.toFixed(2)),
    averageLoss: parseFloat(averageLoss.toFixed(2)),
    kellyPercent: parseFloat((kellyPercent * 100).toFixed(1)),
    riskDisciplineScore
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

  // 6-Column Grid
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

  // 5. Kelly Criterion Card
  const kellyCard = el('div', 'metric-summary-card glass-card sr-card');
  const kellyVal = el('span', 'metric-summary-value');
  const kellyValNum = metrics.kellyPercent;
  const halfKellyValNum = kellyValNum / 2;
  
  if (trades.length < 3) {
    kellyVal.textContent = '—';
    kellyVal.classList.add('val-muted');
  } else {
    kellyVal.textContent = `${kellyValNum > 0 ? '+' : ''}${kellyValNum}%`;
    if (kellyValNum > 0) kellyVal.classList.add('val-high');
    else kellyVal.classList.add('val-low');
  }
  
  kellyCard.appendChild(kellyVal);
  kellyCard.appendChild(el('span', 'metric-summary-label', 'Kelly Criterion'));
  
  const kellyDesc = el('span', 'metric-summary-desc');
  if (trades.length < 3) {
    kellyDesc.textContent = 'Requires 3+ logged trades';
  } else if (kellyValNum > 0) {
    kellyDesc.textContent = `Sizing: Edge detected. Half-Kelly suggests risking ${halfKellyValNum.toFixed(1)}% per trade.`;
  } else {
    kellyDesc.textContent = 'No edge detected. Reduce risk sizing.';
  }
  kellyCard.appendChild(kellyDesc);
  grid.appendChild(kellyCard);

  // 6. Risk Discipline Score Card
  const disciplineCard = el('div', 'metric-summary-card glass-card st-card');
  const disciplineVal = el('span', 'metric-summary-value', `${metrics.riskDisciplineScore}%`);
  if (metrics.riskDisciplineScore >= 90) disciplineVal.classList.add('val-high');
  else if (metrics.riskDisciplineScore >= 70) disciplineVal.classList.add('val-mid');
  else disciplineVal.classList.add('val-low');
  
  disciplineCard.appendChild(disciplineVal);
  disciplineCard.appendChild(el('span', 'metric-summary-label', 'Risk Discipline Score'));
  
  const presetRiskVal = storage.get('preset_risk', '1');
  const disciplineDesc = el('span', 'metric-summary-desc', `${metrics.riskDisciplineScore}% of trades followed the ≤ ${presetRiskVal}% risk rule`);
  disciplineCard.appendChild(disciplineDesc);
  grid.appendChild(disciplineCard);

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

// Build the premium Discipline & Psychology Insights Widget (Ep 23 upgrade)
function buildPsychologyInsightsWidget(trades) {
  const stats = calculateStats(trades);
  if (!stats || stats.totalTrades === 0) return el('div');

  const section = el('div', 'metrics-section psychology-insights-section');

  const header = el('div', 'metrics-header');
  header.appendChild(el('span', 'metrics-header-icon', '🛡️'));
  const titleWrap = el('div', 'metrics-title-wrap');
  titleWrap.appendChild(el('h2', 'metrics-title', 'Discipline & Psychology Insights'));
  titleWrap.appendChild(el('p', 'metrics-subtitle', 'Personalised mentor feedback derived from your trade journal (Ep 23)'));
  header.appendChild(titleWrap);
  section.appendChild(header);

  // Insights Grid
  const grid = el('div', 'insights-grid');

  // --- Insight 1: Discipline Rating (Brad Goh) ---
  let disciplineTitle = '';
  let disciplineText = '';
  let disciplineBadgeClass = '';
  const score = stats.avgEdgeScore;

  if (score >= 90) {
    disciplineTitle = '🏆 Elite Discipline Tier';
    disciplineBadgeClass = 'badge-green';
    disciplineText = `Brad Goh: "Phenomenal execution! Your EdgeScore of ${score}% proves you are treating trading as a business, not a hobby. You are strictly waiting for A+ setups and following your rules. Let the mathematical edge play out."`;
  } else if (score >= 70) {
    disciplineTitle = '🛡️ Consistent Execution';
    disciplineBadgeClass = 'badge-cyan';
    disciplineText = `Brad Goh: "Good job following your plan, but you have minor discipline leaks (EdgeScore: ${score}%). You might be rushing some setups, skipping pre-trade checklists, or neglecting news filters. Tighten your rules to hit that 90%+ tier!"`;
  } else {
    disciplineTitle = '🚨 Discipline Warning: Leakage Detected';
    disciplineBadgeClass = 'badge-red';
    disciplineText = `Brad Goh: "Your EdgeScore is currently very low (${score}%). This means you are trading with high emotional leakage—jumping into trades, skipping size calculations, or trading outside of killzones. Stop immediately, review your plan, and log back in only when disciplined."`;
  }

  const discCard = el('div', 'insight-card glass-card');
  const discHeader = el('div', 'insight-card-header');
  discHeader.appendChild(el('span', 'insight-card-title', disciplineTitle));
  discHeader.appendChild(el('span', `insight-badge ${disciplineBadgeClass}`, 'DISCIPLINE'));
  discCard.appendChild(discHeader);
  discCard.appendChild(el('p', 'insight-card-quote', disciplineText));
  grid.appendChild(discCard);

  // --- Insight 2: Psychology Leak (Boss Ackah) ---
  const losses = trades.filter(t => t.outcome === 'loss');
  const mistakeCounts = {};
  let totalMistakes = 0;

  losses.forEach(t => {
    if (t.mistake) {
      mistakeCounts[t.mistake] = (mistakeCounts[t.mistake] || 0) + 1;
      totalMistakes++;
    }
  });

  let topMistake = '';
  let maxCount = 0;
  Object.entries(mistakeCounts).forEach(([m, count]) => {
    if (count > maxCount) {
      maxCount = count;
      topMistake = m;
    }
  });

  const MISTAKE_LABELS = {
    fomo: 'FOMO (Fear of Missing Out)',
    revenge: 'Revenge Trading',
    outside_killzone: 'Outside Killzone Timing',
    over_leveraging: 'Over-leveraging',
    moved_sl: 'Moved Stop Loss',
    early_exit: 'Early Exit (Fear)',
    chasing_price: 'Chasing Price',
    no_plan: 'No Plan'
  };

  let psychTitle = '🧘 Clean Psychological State';
  let psychText = `Boss Ackah: "No critical execution leaks logged in your recent losses. You accepted your stop-losses cleanly like a professional. The money is embedded in the knowledge and emotional indifference. Excellent focus."`;
  let psychBadgeClass = 'badge-green';

  if (topMistake) {
    const label = MISTAKE_LABELS[topMistake] || topMistake;
    const percentage = Math.round((maxCount / losses.length) * 100);
    psychTitle = `🧠 Psychology Leak: ${label}`;
    psychBadgeClass = 'badge-red';

    switch (topMistake) {
      case 'fomo':
        psychText = `Boss Ackah: "FOMO is draining your account. It represents ${percentage}% of your losses. You are chasing candles because you're scared of missing the move. Remember: missing a trade doesn't cost you money. Chasing does. Wait for the market to come to you."`;
        break;
      case 'revenge':
        psychText = `Brad Goh: "Revenge trading is the fastest way to blow your account! You traded out of frustration on ${maxCount} occasions. Step away from the screens immediately! A 15-minute cooldown lockout will help reset your emotions."`;
        break;
      case 'outside_killzone':
        psychText = `Brad Goh: "You are executing outside of ICT Killzones. Without high institutional volume, price consolidates and spreads eat your edge. Focus your trading strictly between 2:00-5:00 AM and 7:00-10:00 AM NY time."`;
        break;
      case 'over_leveraging':
        psychText = `Boss Ackah: "Leveraging too much size clouds your judgment. You over-leveraged on ${maxCount} losses. When the risk is too high, you cannot remain emotionally independent. Reduce your size to under 2% immediately."`;
        break;
      case 'moved_sl':
        psychText = `Brad Goh: "Moving your Stop Loss is a fatal mistake. You committed this rule violation on ${maxCount} trades. Accept the risk before entry, and let the market hit your stop. Increasing your risk mid-trade ruins your expectancy."`;
        break;
      case 'early_exit':
        psychText = `Brad Goh: "Exiting early out of fear kills your risk-to-reward ratio. You exited early on ${maxCount} trades. Trust your analysis, set your TP and SL, and let the statistics do the work. Indifference is key."`;
        break;
      case 'chasing_price':
        psychText = `Brad Goh: "Chasing price leads directly to stop-outs. You chased the market on ${maxCount} trades. Never buy green candles or sell red candles. Wait for the discount OTE retracement."`;
        break;
      case 'no_plan':
        psychText = `Boss Ackah: "This is a professional skills acquisition, not a casino! You entered ${maxCount} trades without a plan. Write down your exact entry, target, and invalidation rules before you push any button."`;
        break;
      default:
        psychText = `Boss Ackah: "You logged '${label}' as your primary leak. Every loss is tuition. Focus on identifying why you broke discipline on these ${maxCount} trades and correct it."`;
    }
  }

  const psychCard = el('div', 'insight-card glass-card');
  const psychHeader = el('div', 'insight-card-header');
  psychHeader.appendChild(el('span', 'insight-card-title', psychTitle));
  psychHeader.appendChild(el('span', `insight-badge ${psychBadgeClass}`, 'PSYCHOLOGY'));
  psychCard.appendChild(psychHeader);
  psychCard.appendChild(el('p', 'insight-card-quote', psychText));
  grid.appendChild(psychCard);

  // --- Insight 3: Asset focus optimization (Brad Goh) ---
  const byAsset = {};
  trades.forEach(t => {
    if (t.asset) {
      byAsset[t.asset] = (byAsset[t.asset] || 0) + (Number(t.pnl) || 0);
    }
  });

  let bestAsset = '';
  let bestPnl = -Infinity;
  Object.entries(byAsset).forEach(([asset, pnl]) => {
    if (pnl > bestPnl) {
      bestPnl = pnl;
      bestAsset = asset;
    }
  });

  if (bestAsset && bestPnl > 0) {
    const focusCard = el('div', 'insight-card glass-card insight-card-full');
    const focusHeader = el('div', 'insight-card-header');
    focusHeader.appendChild(el('span', 'insight-card-title', `🎯 Focus Optimization: Trade ${bestAsset}`));
    focusHeader.appendChild(el('span', 'insight-badge badge-green', 'PERFORMANCE'));
    focusCard.appendChild(focusHeader);
    
    const formattedPnl = bestPnl > 0 ? `+$${bestPnl.toFixed(2)}` : `$${bestPnl.toFixed(2)}`;
    focusCard.appendChild(el('p', 'insight-card-quote', `Brad Goh: "Your journal statistics show that ${bestAsset} is your highest performing asset, generating a net profit of ${formattedPnl}! Consider hyper-focusing your attention and capital on this pair to maximize your trading efficiency."`));
    grid.appendChild(focusCard);
  }

  section.appendChild(grid);
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

  // Psychology and Discipline Insights below metrics
  container.appendChild(buildPsychologyInsightsWidget(trades));

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

  // Asset Select
  const assetSelect = document.createElement('select');
  assetSelect.id = 'rc-asset';
  assetSelect.className = 'form-select';
  
  const defaultAssetOpt = el('option', '', 'EUR/USD');
  defaultAssetOpt.value = 'EUR/USD';
  defaultAssetOpt.selected = true;
  assetSelect.appendChild(defaultAssetOpt);

  for (const [category, symbols] of Object.entries(ASSETS)) {
    const optgroup = document.createElement('optgroup');
    optgroup.label = category;
    symbols.forEach((sym) => {
      if (sym !== 'EUR/USD') {
        const opt = el('option', '', sym);
        opt.value = sym;
        optgroup.appendChild(opt);
      }
    });
    assetSelect.appendChild(optgroup);
  }
  form.appendChild(formGroup('Asset / Instrument', assetSelect));

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
  entryInput.placeholder = 'e.g. 1.08500';
  entryInput.step = '0.00001';
  entryInput.id = 'rc-entry';
  form.appendChild(formGroup('Entry Price', entryInput));

  // Stop Loss Price
  const stopInput = document.createElement('input');
  stopInput.type = 'number';
  stopInput.className = 'form-input';
  stopInput.placeholder = 'e.g. 1.08300';
  stopInput.step = '0.00001';
  stopInput.id = 'rc-stop';
  form.appendChild(formGroup('Stop Loss Price', stopInput));

  // Update step/placeholder on asset change
  const updateInputPlaceholders = () => {
    const assetName = assetSelect.value;
    const config = getAssetConfig(assetName);
    
    entryInput.step = config.step;
    stopInput.step = config.step;
    
    if (assetName) {
      if (assetName.includes('JPY')) {
        entryInput.placeholder = 'e.g. 156.450';
        stopInput.placeholder = 'e.g. 156.250';
      } else if (assetName.includes('/') && !assetName.includes('BTC') && !assetName.includes('XAU') && !assetName.includes('XAG')) {
        entryInput.placeholder = 'e.g. 1.08500';
        stopInput.placeholder = 'e.g. 1.08300';
      } else if (assetName.includes('BTC')) {
        entryInput.placeholder = 'e.g. 68500';
        stopInput.placeholder = 'e.g. 68000';
      } else if (assetName.includes('XAU') || assetName.includes('XAG')) {
        entryInput.placeholder = 'e.g. 2350.50';
        stopInput.placeholder = 'e.g. 2345.00';
      } else {
        entryInput.placeholder = 'e.g. 100.00';
        stopInput.placeholder = 'e.g. 95.00';
      }
    }
  };
  assetSelect.addEventListener('change', updateInputPlaceholders);

  // Stop Loss Assistant Toggle Button
  const slAssistantToggle = el('button', 'btn btn-outline btn-sm sl-assistant-toggle', '🛡️ Open Stop Loss Assistant (Brad Goh Rules)');
  slAssistantToggle.type = 'button';
  slAssistantToggle.style.gridColumn = '1 / -1';
  slAssistantToggle.style.marginTop = 'var(--space-2)';
  slAssistantToggle.style.marginBottom = 'var(--space-2)';
  form.appendChild(slAssistantToggle);

  // Stop Loss Assistant Container
  const slAssistantContainer = el('div', 'sl-assistant-container collapsed');
  slAssistantContainer.style.gridColumn = '1 / -1';
  slAssistantContainer.style.display = 'none';
  form.appendChild(slAssistantContainer);

  // Assistant Tabs
  const slTabs = el('div', 'sl-tabs');
  slAssistantContainer.appendChild(slTabs);

  const slTabContents = el('div', 'sl-tab-contents');
  slAssistantContainer.appendChild(slTabContents);

  const models = [
    { id: 'structure', label: 'Structure Low/High', icon: '⛰️' },
    { id: 'atr', label: 'ATR Volatility', icon: '🌪️' },
    { id: 'ote', label: 'Fibonacci OTE', icon: '🌀' }
  ];

  let activeTab = 'structure';
  const tabButtons = {};
  const tabPanels = {};

  models.forEach(model => {
    const tabBtn = el('button', 'sl-tab-btn', `${model.icon} ${model.label}`);
    tabBtn.type = 'button';
    tabBtn.addEventListener('click', () => {
      models.forEach(m => {
        tabButtons[m.id].classList.remove('active');
        tabPanels[m.id].style.display = 'none';
      });
      tabBtn.classList.add('active');
      tabPanels[model.id].style.display = 'block';
      activeTab = model.id;
      playSynthSound('click');
      updateLiveCalculation();
    });
    slTabs.appendChild(tabBtn);
    tabButtons[model.id] = tabBtn;

    const panel = el('div', `sl-tab-panel sl-panel-${model.id}`);
    panel.style.display = 'none';
    slTabContents.appendChild(panel);
    tabPanels[model.id] = panel;
  });

  // Activate first tab by default
  tabButtons['structure'].classList.add('active');
  tabPanels['structure'].style.display = 'block';

  // --- Model 1: Structure Invalidation Inputs ---
  const structurePriceInput = document.createElement('input');
  structurePriceInput.type = 'number';
  structurePriceInput.placeholder = 'e.g. 1.08450';
  structurePriceInput.step = 'any';
  
  const structureBufferInput = document.createElement('input');
  structureBufferInput.type = 'number';
  structureBufferInput.value = '2';
  structureBufferInput.step = 'any';

  const structureDirectionSelect = document.createElement('select');
  const dirOptLong = el('option', '', '🟢 LONG (Buy Setup)');
  dirOptLong.value = 'long';
  const dirOptShort = el('option', '', '🔴 SHORT (Sell Setup)');
  dirOptShort.value = 'short';
  structureDirectionSelect.appendChild(dirOptLong);
  structureDirectionSelect.appendChild(dirOptShort);

  const gridStructure = el('div', 'sl-inputs-grid');
  gridStructure.appendChild(formGroup('Swing High/Low Price', structurePriceInput));
  gridStructure.appendChild(formGroup('Breathing Buffer (Pips)', structureBufferInput));
  gridStructure.appendChild(formGroup('Direction', structureDirectionSelect));
  tabPanels['structure'].appendChild(gridStructure);

  // --- Model 2: ATR Inputs ---
  const atrEntryInput = document.createElement('input');
  atrEntryInput.type = 'number';
  atrEntryInput.placeholder = 'Entry Price';
  atrEntryInput.step = 'any';

  const atrValueInput = document.createElement('input');
  atrValueInput.type = 'number';
  atrValueInput.placeholder = 'e.g. 0.0012';
  atrValueInput.step = 'any';

  const atrMultiplierInput = document.createElement('input');
  atrMultiplierInput.type = 'number';
  atrMultiplierInput.value = '1.5';
  atrMultiplierInput.step = '0.1';

  const atrDirectionSelect = document.createElement('select');
  const atrDirLong = el('option', '', '🟢 LONG (Buy Setup)');
  atrDirLong.value = 'long';
  const atrDirShort = el('option', '', '🔴 SHORT (Sell Setup)');
  atrDirShort.value = 'short';
  atrDirectionSelect.appendChild(atrDirLong);
  atrDirectionSelect.appendChild(atrDirShort);

  const gridAtr = el('div', 'sl-inputs-grid');
  gridAtr.appendChild(formGroup('Entry Price Reference', atrEntryInput));
  gridAtr.appendChild(formGroup('ATR Value', atrValueInput));
  gridAtr.appendChild(formGroup('ATR Multiplier', atrMultiplierInput));
  gridAtr.appendChild(formGroup('Direction', atrDirectionSelect));
  tabPanels['atr'].appendChild(gridAtr);

  // --- Model 3: Fibonacci OTE Inputs ---
  const fibSwingLowInput = document.createElement('input');
  fibSwingLowInput.type = 'number';
  fibSwingLowInput.placeholder = 'e.g. 1.08200';
  fibSwingLowInput.step = 'any';

  const fibSwingHighInput = document.createElement('input');
  fibSwingHighInput.type = 'number';
  fibSwingHighInput.placeholder = 'e.g. 1.09000';
  fibSwingHighInput.step = 'any';

  const fibBufferInput = document.createElement('input');
  fibBufferInput.type = 'number';
  fibBufferInput.value = '2';
  fibBufferInput.step = 'any';

  const fibDirectionSelect = document.createElement('select');
  const fibDirLong = el('option', '', '🟢 LONG (Buy Setup)');
  fibDirLong.value = 'long';
  const fibDirShort = el('option', '', '🔴 SHORT (Sell Setup)');
  fibDirShort.value = 'short';
  fibDirectionSelect.appendChild(fibDirLong);
  fibDirectionSelect.appendChild(fibDirShort);

  const gridFib = el('div', 'sl-inputs-grid');
  gridFib.appendChild(formGroup('Swing Low Price', fibSwingLowInput));
  gridFib.appendChild(formGroup('Swing High Price', fibSwingHighInput));
  gridFib.appendChild(formGroup('Breathing Buffer (Pips)', fibBufferInput));
  gridFib.appendChild(formGroup('Direction', fibDirectionSelect));
  tabPanels['ote'].appendChild(gridFib);

  // Mentor Message Section
  const mentorQuoteBox = el('div', 'sl-mentor-quote');
  const mentorQuoteText = el('p', 'sl-mentor-text', '');
  mentorQuoteBox.appendChild(mentorQuoteText);
  slAssistantContainer.appendChild(mentorQuoteBox);

  // Result Preview & Action Bar
  const previewBox = el('div', 'sl-preview-box');
  const previewLabel = el('span', 'sl-preview-label', 'Live Preview:');
  const previewValue = el('span', 'sl-preview-value', '—');
  previewBox.appendChild(previewLabel);
  previewBox.appendChild(previewValue);
  slAssistantContainer.appendChild(previewBox);

  const applyBtn = el('button', 'btn btn-primary sl-apply-btn', '🎯 Apply Stop Loss Price');
  applyBtn.type = 'button';
  slAssistantContainer.appendChild(applyBtn);

  // Helper to calculate the pip value in price terms
  const getPipValue = (assetName) => {
    const name = (assetName || '').toUpperCase();
    if (name.includes('JPY')) return 0.01;
    if (name.includes('/') && !name.includes('BTC') && !name.includes('XAU') && !name.includes('XAG')) return 0.0001;
    if (name.includes('XAU') || name.includes('XAG') || name.includes('GOLD') || name.includes('SILVER')) return 0.1;
    if (name.includes('BTC')) return 1.0;
    if (name.includes('VOLATILITY') || name.includes('US30') || name.includes('NAS100') || name.includes('SPX500') || name.includes('GER40') || name.includes('UK100')) return 1.0;
    return 0.01;
  };

  let lastCalculatedStopLoss = null;

  const updateLiveCalculation = () => {
    const assetName = assetSelect.value;
    const config = getAssetConfig(assetName);
    const pipVal = getPipValue(assetName);

    let calculatedStop = null;
    let quote = '';

    if (activeTab === 'structure') {
      const swing = Number(structurePriceInput.value);
      const buffer = Number(structureBufferInput.value) || 0;
      const dir = structureDirectionSelect.value;

      quote = `Brad Goh: "Identify the Order Block or Liquidity Sweep wick, then place your stop ${buffer} pips behind it to prevent spread stop-outs. This is structural invalidation."`;

      if (swing) {
        if (dir === 'long') {
          calculatedStop = swing - (buffer * pipVal);
        } else {
          calculatedStop = swing + (buffer * pipVal);
        }
      }
    } else if (activeTab === 'atr') {
      if (!atrEntryInput.value && entryInput.value) {
        atrEntryInput.value = entryInput.value;
      }
      const entry = Number(atrEntryInput.value);
      const atr = Number(atrValueInput.value);
      const mult = Number(atrMultiplierInput.value) || 1.5;
      const dir = atrDirectionSelect.value;

      quote = `Brad Goh: "Using an ATR multiplier of ${mult}x places your stop outside the current market volatility. This gives your trade room to breathe."`;

      if (entry && atr) {
        if (dir === 'long') {
          calculatedStop = entry - (atr * mult);
        } else {
          calculatedStop = entry + (atr * mult);
        }
      }
    } else if (activeTab === 'ote') {
      const low = Number(fibSwingLowInput.value);
      const high = Number(fibSwingHighInput.value);
      const buffer = Number(fibBufferInput.value) || 0;
      const dir = fibDirectionSelect.value;

      quote = `Brad Goh: "For Optimal Trade Entry, your structural invalidation is the start of the swing. The stop goes ${buffer} pips beyond the high/low."`;

      if (low && high) {
        if (dir === 'long') {
          calculatedStop = low - (buffer * pipVal);
        } else {
          calculatedStop = high + (buffer * pipVal);
        }
      }
    }

    mentorQuoteText.textContent = quote;

    if (calculatedStop !== null && !isNaN(calculatedStop)) {
      lastCalculatedStopLoss = calculatedStop;
      previewValue.textContent = calculatedStop.toFixed(config.decimals);
      applyBtn.disabled = false;
    } else {
      lastCalculatedStopLoss = null;
      previewValue.textContent = 'Enter values...';
      applyBtn.disabled = true;
    }
  };

  const allInputs = [
    assetSelect,
    structurePriceInput, structureBufferInput, structureDirectionSelect,
    atrEntryInput, atrValueInput, atrMultiplierInput, atrDirectionSelect,
    fibSwingLowInput, fibSwingHighInput, fibBufferInput, fibDirectionSelect
  ];

  allInputs.forEach(inp => {
    inp.addEventListener('input', updateLiveCalculation);
    inp.addEventListener('change', updateLiveCalculation);
  });

  entryInput.addEventListener('input', () => {
    if (activeTab === 'atr' && !atrEntryInput.value) {
      atrEntryInput.value = entryInput.value;
      updateLiveCalculation();
    }
  });

  // Toggle open/closed
  slAssistantToggle.addEventListener('click', () => {
    const isCollapsed = slAssistantContainer.classList.contains('collapsed');
    if (isCollapsed) {
      slAssistantContainer.classList.remove('collapsed');
      slAssistantContainer.style.display = 'block';
      slAssistantToggle.textContent = '🛡️ Close Stop Loss Assistant';
      if (entryInput.value) {
        atrEntryInput.value = entryInput.value;
      }
      updateLiveCalculation();
    } else {
      slAssistantContainer.classList.add('collapsed');
      slAssistantContainer.style.display = 'none';
      slAssistantToggle.textContent = '🛡️ Open Stop Loss Assistant (Brad Goh Rules)';
    }
    playSynthSound('click');
  });

  // Apply stop loss price
  applyBtn.addEventListener('click', () => {
    if (lastCalculatedStopLoss !== null) {
      const config = getAssetConfig(assetSelect.value);
      stopInput.value = lastCalculatedStopLoss.toFixed(config.decimals);
      
      if (entryInput.value) {
        calcBtn.click();
      }
      
      showNotificationToast('Stop Loss Applied successfully! 🛑');
      
      slAssistantContainer.classList.add('collapsed');
      slAssistantContainer.style.display = 'none';
      slAssistantToggle.textContent = '🛡️ Open Stop Loss Assistant (Brad Goh Rules)';
      
      playSynthSound('success');
      if (typeof nativeHapticNotification === 'function') {
        nativeHapticNotification('success');
      }
    }
  });

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
    const activeAsset = assetSelect.value;
    const config = getAssetConfig(activeAsset);

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
      { label: 'SL Distance', value: `${slDistance.toFixed(config.decimals)}`, icon: '📏' },
      { label: 'Position Size', value: `${positionSize.toFixed(config.decimals === 5 ? 0 : 2)} units`, icon: '📐' },
      { label: 'Direction', value: direction, icon: direction === 'LONG' ? '🟢' : '🔴' },
      { label: 'Risk/Reward at 2R', value: `TP: ${(direction === 'LONG' ? entry + slDistance * 2 : entry - slDistance * 2).toFixed(config.decimals)}`, icon: '🎯' },
      { label: 'Risk/Reward at 3R', value: `TP: ${(direction === 'LONG' ? entry + slDistance * 3 : entry - slDistance * 3).toFixed(config.decimals)}`, icon: '🏆' },
    ];

    // Lot Sizing based on contract multiplier
    const multiplier = getContractMultiplier(activeAsset);
    const lotSize = positionSize / multiplier;
    let lotLabel = 'Suggested Lots';
    let lotIcon = '🪖';
    if (activeAsset.includes('XAU') || activeAsset.includes('GOLD')) {
      lotLabel = 'Gold Lots (100oz)';
      lotIcon = '🏆';
    } else if (activeAsset.includes('XAG') || activeAsset.includes('SILVER')) {
      lotLabel = 'Silver Lots (5koz)';
      lotIcon = '🥈';
    } else if (activeAsset.includes('/') && !activeAsset.includes('BTC')) {
      lotLabel = 'Forex Lots (100k)';
      lotIcon = '🪖';
    } else if (activeAsset.includes('BTC')) {
      lotLabel = 'Crypto Coins / Lots';
      lotIcon = '🪙';
    } else {
      lotLabel = 'Contracts / Lots';
      lotIcon = '📈';
    }
    items.splice(3, 0, { label: lotLabel, value: `${lotSize.toFixed(2)} lots`, icon: lotIcon });

    items.forEach(({ label, value, icon }) => {
      const card = el('div', 'risk-result-card');
      card.appendChild(el('span', 'risk-result-icon', icon));
      card.appendChild(el('span', 'risk-result-label', label));
      card.appendChild(el('span', 'risk-result-value', value));
      grid.appendChild(card);
    });

    results.appendChild(grid);

    // Auto-Fill Button
    const autoFillBtn = el('button', 'btn btn-secondary sl-autofill-btn', '🎯 Auto-Fill into Log Form');
    autoFillBtn.type = 'button';
    autoFillBtn.style.marginTop = 'var(--space-4)';
    autoFillBtn.style.width = '100%';
    autoFillBtn.style.color = 'var(--cyan)';
    autoFillBtn.style.border = '1px solid var(--cyan)';
    autoFillBtn.style.background = 'rgba(0, 212, 255, 0.05)';
    autoFillBtn.addEventListener('click', () => {
      const logForm = document.querySelector('.tab-panel form.trade-form');
      if (logForm) {
        // Set Asset
        const assetEl = logForm.querySelector('select[name="asset"]');
        if (assetEl) {
          assetEl.value = activeAsset;
          assetEl.dispatchEvent(new Event('change'));
        }
        
        // Set Entry Price
        const entryEl = logForm.querySelector('input[name="entry"]');
        if (entryEl) {
          entryEl.value = entry.toFixed(config.decimals);
          entryEl.dispatchEvent(new Event('input'));
        }
        
        // Set Stop Loss Price
        const stopEl = logForm.querySelector('input[name="stop"]');
        if (stopEl) {
          stopEl.value = stop.toFixed(config.decimals);
          stopEl.dispatchEvent(new Event('input'));
        }
        
        // Set Sizing Mode to manual
        const modeEl = logForm.querySelector('select[name="sizingMode"]');
        if (modeEl) {
          modeEl.value = 'manual';
          modeEl.dispatchEvent(new Event('change'));
        }
        
        // Set Manual Lots to the calculated lotSize
        const lotsEl = logForm.querySelector('input[name="manualLots"]');
        if (lotsEl) {
          lotsEl.value = lotSize.toFixed(2);
          lotsEl.dispatchEvent(new Event('input'));
        }
        
        // Check "Used suggested position size calculator?" checkbox
        const gcSizeEl = logForm.querySelector('input[name="guardrail_sizeCalculatorUsed"]');
        if (gcSizeEl) {
          gcSizeEl.checked = true;
        }

        showNotificationToast('Calculated trade size loaded into Log Form! 📝✨');
        playSynthSound('success');
        if (typeof nativeHapticNotification === 'function') {
          nativeHapticNotification('success');
        }

        // Switch tab to "Log Trade"
        const logTabBtn = document.querySelector('button[data-tab="form"]');
        if (logTabBtn) {
          logTabBtn.click();
        }
      } else {
        showNotificationToast('Could not find the Log Trade form.', '⚠️');
      }
    });

    results.appendChild(autoFillBtn);
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

  function refresh(switchToHistory = false) {
    const trades = getTrades();
    const stats = calculateStats(trades);
    renderStatsBar(statsContainer, stats);
    renderTradeHistory(historyPanel, refresh);

    if (switchToHistory) {
      const historyTabBtn = tabs.querySelector('button[data-tab="history"]');
      if (historyTabBtn) historyTabBtn.click();
    }
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
  wrapper.style.position = 'relative';

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

  // Append floating sizer
  const sizer = buildFloatingRiskSizer();
  wrapper.appendChild(sizer);

  // Append floating assignment HUD
  const hud = buildFloatingAssignmentHUD(() => {
    renderLiveChart(container);
  });
  if (hud) {
    wrapper.appendChild(hud);
  }

  // Load the chart
  loadTVChart(chartDiv, defaultSymbol);

  // Clear pending symbol after loading
  _pendingChartSymbol = null;
}

function buildFloatingAssignmentHUD(onRefresh) {
  const activeAssignments = getAssignments().filter(a => !a.completed);
  if (activeAssignments.length === 0) return null;

  // Show the latest active assignment
  const assignment = activeAssignments[activeAssignments.length - 1];

  const panel = el('div', 'floating-assignment-hud collapsed');
  panel.style.position = 'absolute';
  panel.style.bottom = '24px';
  panel.style.left = '24px'; // sizer is on right, HUD on left
  panel.style.width = '320px';
  panel.style.zIndex = '1000';
  panel.style.display = 'flex';
  panel.style.flexDirection = 'column';

  // Header
  const header = el('div', 'floating-hud-header');
  const icon = el('span', 'floating-hud-icon', '🎯');
  const title = el('span', 'floating-hud-title', `Task: ${assignment.asset}`);
  const toggleBtn = el('button', 'btn-toggle-hud', '▲');
  header.appendChild(icon);
  header.appendChild(title);
  header.appendChild(toggleBtn);
  panel.appendChild(header);

  // Body
  const body = el('div', 'floating-hud-body');

  // Goal text
  const goalBox = el('div', 'hud-goal-box');
  goalBox.appendChild(el('strong', 'hud-goal-lbl', 'ACTIVE ASSIGNMENT:'));
  goalBox.appendChild(el('p', 'hud-goal-text', assignment.text));
  body.appendChild(goalBox);

  // Meta row (Level, timeframe)
  const metaRow = el('div', 'hud-meta-row');
  const levelTag = assignment.episodeNum ? `Level ${assignment.episodeNum}` : 'SMC';
  metaRow.appendChild(el('span', 'tag tag-sm', levelTag));
  metaRow.appendChild(el('span', 'tag tag-sm', assignment.timeframe));
  body.appendChild(metaRow);

  // Checklist
  const checklistBox = el('div', 'hud-checklist-box');
  checklistBox.appendChild(el('p', 'hud-checklist-title', 'CONFLUENCE CHECKLIST:'));

  const steps = assignment.steps || [];
  const checkboxList = [];

  if (steps.length > 0) {
    steps.forEach((s, idx) => {
      const row = el('div', 'hud-checkbox-row');
      const chk = document.createElement('input');
      chk.type = 'checkbox';
      chk.id = `hud-step-${assignment.id}-${idx}`;
      chk.className = 'hud-step-chk';

      const lbl = el('label', 'hud-step-lbl', s.title);
      lbl.setAttribute('for', chk.id);
      
      chk.addEventListener('change', () => {
        playSynthSound('click');
        updateCompleteBtnState();
      });

      row.appendChild(chk);
      row.appendChild(lbl);
      checklistBox.appendChild(row);
      checkboxList.push(chk);
    });
  } else {
    // Fallback steps
    const defaultSteps = [
      'Identify trends and swing highs/lows',
      'Locate key supply/demand zones',
      'Draw analysis on the live chart',
      'Verify rejection confirmation candle'
    ];
    defaultSteps.forEach((s, idx) => {
      const row = el('div', 'hud-checkbox-row');
      const chk = document.createElement('input');
      chk.type = 'checkbox';
      chk.id = `hud-step-fallback-${idx}`;
      chk.className = 'hud-step-chk';

      const lbl = el('label', 'hud-step-lbl', s);
      lbl.setAttribute('for', chk.id);

      chk.addEventListener('change', () => {
        playSynthSound('click');
        updateCompleteBtnState();
      });

      row.appendChild(chk);
      row.appendChild(lbl);
      checklistBox.appendChild(row);
      checkboxList.push(chk);
    });
  }
  body.appendChild(checklistBox);

  // Complete button
  const completeBtn = el('button', 'btn btn-primary hud-complete-btn', '✅ Mark Done (+40 XP)');
  completeBtn.style.marginTop = 'var(--space-2)';
  completeBtn.disabled = true;

  function updateCompleteBtnState() {
    const allChecked = checkboxList.every(chk => chk.checked);
    completeBtn.disabled = !allChecked;
    if (allChecked) {
      completeBtn.classList.add('hud-btn-active');
    } else {
      completeBtn.classList.remove('hud-btn-active');
    }
  }

  completeBtn.addEventListener('click', () => {
    // Complete the assignment
    const all = getAssignments();
    const target = all.find(x => x.id === assignment.id);
    if (target) {
      const wasCompleted = target.completed;
      target.completed = true;
      storage.set('assignments', all);
      
      // Award XP
      if (!wasCompleted) {
        addXP('assignment', 40);
        
        // Award streak freeze token if < 3
        const currentTokens = storage.get('streak_freeze_tokens', 0);
        if (currentTokens < 3) {
          storage.set('streak_freeze_tokens', currentTokens + 1);
          showNotificationToast('Assignment Completed! Earned 1 Streak Freeze ❄️');
          playSynthSound('fanfare');
        } else {
          playSynthSound('success');
        }
      }

      triggerConfetti();

      // Cloud Sync
      import('./firebase-sync.js').then(({ pushToCloud, getCurrentUser }) => {
        if (getCurrentUser()) pushToCloud();
      });

      // Remove HUD panel and trigger page refresh
      panel.remove();
      if (typeof onRefresh === 'function') onRefresh();
    }
  });

  body.appendChild(completeBtn);
  panel.appendChild(body);

  // Toggle Collapse
  const toggle = (e) => {
    e.stopPropagation();
    const isCollapsed = panel.classList.contains('collapsed');
    if (isCollapsed) {
      panel.classList.remove('collapsed');
      toggleBtn.textContent = '▼';
    } else {
      panel.classList.add('collapsed');
      toggleBtn.textContent = '▲';
    }
    playSynthSound('click');
  };

  header.addEventListener('click', toggle);

  return panel;
}

function buildFloatingRiskSizer() {
  const panel = el('div', 'floating-risk-sizer collapsed');
  
  // Toggle / Header bar
  const header = el('div', 'floating-sizer-header');
  const icon = el('span', 'floating-sizer-icon', '🧮');
  const title = el('span', 'floating-sizer-title', 'Risk Calculator');
  
  const toggleBtn = el('button', 'btn-toggle-sizer', '▲');
  header.appendChild(icon);
  header.appendChild(title);
  header.appendChild(toggleBtn);
  panel.appendChild(header);

  // Content body
  const body = el('div', 'floating-sizer-body');
  
  // Inputs
  const balInput = document.createElement('input');
  balInput.type = 'number';
  balInput.className = 'form-input form-input-sm';
  balInput.value = storage.get('preset_balance', '10000');
  balInput.step = 'any';
  
  const riskInput = document.createElement('input');
  riskInput.type = 'number';
  riskInput.className = 'form-input form-input-sm';
  riskInput.value = storage.get('preset_risk', '1');
  riskInput.step = 'any';

  const entryInput = document.createElement('input');
  entryInput.type = 'number';
  entryInput.className = 'form-input form-input-sm';
  entryInput.placeholder = 'Entry';
  entryInput.step = 'any';

  const stopInput = document.createElement('input');
  stopInput.type = 'number';
  stopInput.className = 'form-input form-input-sm';
  stopInput.placeholder = 'Stop';
  stopInput.step = 'any';

  const grid = el('div', 'sizer-input-grid');
  grid.appendChild(formGroup('Balance ($)', balInput));
  grid.appendChild(formGroup('Risk (%)', riskInput));
  grid.appendChild(formGroup('Entry', entryInput));
  grid.appendChild(formGroup('Stop', stopInput));
  body.appendChild(grid);

  // Results area
  const results = el('div', 'sizer-results');
  results.style.display = 'none';
  body.appendChild(results);

  panel.appendChild(body);

  // Auto-calculate helper
  const calculate = () => {
    const balance = Number(balInput.value);
    const riskPct = Number(riskInput.value);
    const entry = Number(entryInput.value);
    const stop = Number(stopInput.value);

    // Save presets
    storage.set('preset_balance', balInput.value);
    storage.set('preset_risk', riskInput.value);

    if (!balance || !riskPct || !entry || !stop) {
      results.style.display = 'none';
      return;
    }

    const riskAmount = (balance * riskPct) / 100;
    const slDistance = Math.abs(entry - stop);

    if (slDistance === 0) {
      results.style.display = 'block';
      results.replaceChildren(el('p', 'risk-calc-error', 'Entry & Stop same.'));
      return;
    }

    const positionSize = riskAmount / slDistance;
    const direction = entry > stop ? 'LONG' : 'SHORT';

    results.style.display = 'block';
    results.replaceChildren();

    const statsGrid = el('div', 'sizer-results-grid');
    const items = [
      { label: 'Risk Cash', value: `$${riskAmount.toFixed(2)}` },
      { label: 'Size', value: `${positionSize.toFixed(3)} units` },
      { label: 'TP 2R', value: (direction === 'LONG' ? entry + slDistance * 2 : entry - slDistance * 2).toFixed(5) },
      { label: 'TP 3R', value: (direction === 'LONG' ? entry + slDistance * 3 : entry - slDistance * 3).toFixed(5) }
    ];

    items.forEach(item => {
      const card = el('div', 'sizer-result-card');
      card.appendChild(el('span', 'sizer-result-lbl', item.label));
      card.appendChild(el('span', 'sizer-result-val', item.value));
      statsGrid.appendChild(card);
    });

    results.appendChild(statsGrid);
  };

  [balInput, riskInput, entryInput, stopInput].forEach(inp => {
    inp.addEventListener('input', calculate);
  });

  // Toggle open/closed
  const toggle = (e) => {
    e.stopPropagation();
    const isCollapsed = panel.classList.contains('collapsed');
    if (isCollapsed) {
      panel.classList.remove('collapsed');
      toggleBtn.textContent = '▼';
    } else {
      panel.classList.add('collapsed');
      toggleBtn.textContent = '▲';
    }
    playSynthSound('click');
  };

  header.addEventListener('click', toggle);

  // Initialize calculate
  calculate();

  return panel;
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
