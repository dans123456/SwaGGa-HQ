/**
 * SwaGGa HQ — Utility Helpers
 * Pure helper functions used across the application.
 * SECURITY: No DOM manipulation here. All text sanitization is defensive only.
 */

/**
 * Format a Date object into a human-readable string.
 * @param {Date|string|number} date - Value convertible to Date.
 * @param {string} format - One of 'short', 'long', 'iso', 'time', 'datetime'.
 * @returns {string} Formatted date string.
 */
export function formatDate(date, format = 'short') {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return '—';

  switch (format) {
    case 'long':
      return d.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    case 'iso':
      return d.toISOString().slice(0, 10);
    case 'time':
      return d.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
      });
    case 'datetime':
      return d.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    case 'short':
    default:
      return d.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
  }
}

/**
 * Format a number as a currency string.
 * @param {number} amount
 * @param {string} currency - ISO 4217 code (default 'USD').
 * @returns {string} Formatted currency string.
 */
export function formatCurrency(amount, currency = 'USD') {
  const num = Number(amount);
  if (Number.isNaN(num)) return '$0.00';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

/**
 * Generate a unique ID string.
 * Uses crypto.randomUUID when available, otherwise falls back to a
 * time-based pseudo-random string.
 * @returns {string}
 */
export function generateId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback: timestamp + random hex segment
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).substring(2, 10);
  return `${ts}-${rand}`;
}

/**
 * Calculate Profit & Loss for a single trade.
 * @param {number} entry   - Entry price.
 * @param {number} exit    - Exit price.
 * @param {number} size    - Position size (lots / units).
 * @param {'long'|'short'} direction - Trade direction.
 * @param {number} [fees=0]     - Total fees.
 * @param {number} [slippage=0] - Total slippage cost.
 * @returns {number} Net P&L value.
 */
export function calculatePnL(entry, exit, size, direction, fees = 0, slippage = 0) {
  const e = Number(entry);
  const x = Number(exit);
  const s = Number(size);
  const f = Number(fees) || 0;
  const sl = Number(slippage) || 0;

  if ([e, x, s].some(Number.isNaN)) return 0;

  const rawPnL = direction === 'short' ? (e - x) * s : (x - e) * s;
  return rawPnL - f - sl;
}

/**
 * Calculate Risk-to-Reward ratio.
 * @param {number} entry - Entry price.
 * @param {number} stop  - Stop-loss price.
 * @param {number} exit  - Take-profit / exit price.
 * @returns {number} R:R ratio (reward ÷ risk). Returns 0 if risk is zero.
 */
export function calculateRiskReward(entry, stop, exit) {
  const e = Number(entry);
  const s = Number(stop);
  const x = Number(exit);
  const risk = Math.abs(e - s);
  const reward = Math.abs(x - e);
  if (risk === 0) return 0;
  return parseFloat((reward / risk).toFixed(2));
}

/**
 * Calculate win-rate percentage from an array of trades.
 * A trade is considered a "win" if its `pnl` property is > 0.
 * @param {Array<{pnl: number}>} trades
 * @returns {number} Percentage 0-100.
 */
export function calculateWinRate(trades) {
  if (!Array.isArray(trades) || trades.length === 0) return 0;
  const wins = trades.filter((t) => Number(t.pnl) > 0).length;
  return parseFloat(((wins / trades.length) * 100).toFixed(1));
}

/**
 * Return a human-readable relative-time string ("2 hours ago").
 * @param {Date|string|number} date
 * @returns {string}
 */
export function getTimeAgo(date) {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return '—';

  const seconds = Math.floor((Date.now() - d.getTime()) / 1000);
  if (seconds < 0) return 'just now';

  const intervals = [
    { label: 'year', seconds: 31_536_000 },
    { label: 'month', seconds: 2_592_000 },
    { label: 'week', seconds: 604_800 },
    { label: 'day', seconds: 86_400 },
    { label: 'hour', seconds: 3_600 },
    { label: 'minute', seconds: 60 },
  ];

  for (const { label, seconds: s } of intervals) {
    const count = Math.floor(seconds / s);
    if (count >= 1) {
      return `${count} ${label}${count !== 1 ? 's' : ''} ago`;
    }
  }
  return 'just now';
}

/**
 * Debounce a function call.
 * @param {Function} fn    - Function to debounce.
 * @param {number}   delay - Delay in milliseconds.
 * @returns {Function} Debounced function.
 */
export function debounce(fn, delay = 300) {
  let timer;
  return function debounced(...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

/**
 * Clamp a number between min and max (inclusive).
 * @param {number} value
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
export function clamp(value, min, max) {
  return Math.min(Math.max(Number(value), Number(min)), Number(max));
}

/**
 * Sanitize text for safe display: trims whitespace and enforces a max length.
 * This is a *display-level* sanitization helper; the actual XSS protection
 * comes from always using textContent instead of innerHTML.
 * @param {string} text      - Raw user input.
 * @param {number} maxLength - Maximum allowed length (default 500).
 * @returns {string} Cleaned string.
 */
export function sanitizeText(text, maxLength = 500) {
  if (typeof text !== 'string') return '';
  const trimmed = text.trim();
  if (trimmed.length <= maxLength) return trimmed;
  return trimmed.substring(0, maxLength) + '…';
}
