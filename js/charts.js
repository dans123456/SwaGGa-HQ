/**
 * SwaGGa HQ — Chart.js Configuration Helpers
 *
 * NOTE: Chart.js is loaded via CDN in index.html and is available as
 * the global `Chart` object. These helpers create and return Chart
 * instances against an existing <canvas> element.
 *
 * Color palette (matching app theme):
 *   Neon Green : #39ff14
 *   Red        : #ff3b3b
 *   Purple     : #b44dff
 *   Cyan       : #00e5ff
 *   Grid       : rgba(255,255,255,0.08)
 *   Text       : #e0e0e0
 */

/* ------------------------------------------------------------------ */
/*  Shared theme                                                      */
/* ------------------------------------------------------------------ */

const COLORS = {
  green: '#39ff14',
  red: '#ff3b3b',
  purple: '#b44dff',
  cyan: '#00e5ff',
  gridLine: 'rgba(255,255,255,0.08)',
  text: '#e0e0e0',
  tooltipBg: 'rgba(30,30,30,0.95)',
};

/** Shared dark-theme defaults used across all chart types. */
function darkScaleOptions(showX = true) {
  return {
    x: {
      display: showX,
      ticks: { color: COLORS.text, maxRotation: 45 },
      grid: { color: COLORS.gridLine },
    },
    y: {
      ticks: { color: COLORS.text },
      grid: { color: COLORS.gridLine },
    },
  };
}

function darkPluginOptions(titleText = '') {
  const opts = {
    legend: {
      labels: { color: COLORS.text },
    },
    tooltip: {
      backgroundColor: COLORS.tooltipBg,
      titleColor: COLORS.text,
      bodyColor: COLORS.text,
      borderColor: COLORS.gridLine,
      borderWidth: 1,
    },
  };
  if (titleText) {
    opts.title = { display: true, text: titleText, color: COLORS.text, font: { size: 14 } };
  }
  return opts;
}

/* ------------------------------------------------------------------ */
/*  Helper: safely obtain a 2D context from a canvas id               */
/* ------------------------------------------------------------------ */

/**
 * @param {string} canvasId
 * @returns {CanvasRenderingContext2D|null}
 */

/** Track active chart instances so we can destroy them before re-creating */
const _chartInstances = new Map();

function getCtx(canvasId) {
  // Destroy any existing chart on this canvas first
  if (_chartInstances.has(canvasId)) {
    _chartInstances.get(canvasId).destroy();
    _chartInstances.delete(canvasId);
  }

  const canvas = document.getElementById(canvasId);
  if (!canvas) {
    console.error('Chart canvas not found:', canvasId);
    return null;
  }
  return canvas.getContext('2d');
}

/** Wrap Chart constructor to track instances */
function createTrackedChart(canvasId, ctx, config) {
  const chart = new Chart(ctx, config);
  _chartInstances.set(canvasId, chart);
  return chart;
}

/* ------------------------------------------------------------------ */
/*  Public chart creators                                             */
/* ------------------------------------------------------------------ */

/**
 * Create a cumulative equity (P&L) line chart.
 * @param {string} canvasId
 * @param {Array<{pnl: number, date: string}>} trades - Sorted by date.
 * @returns {Chart|null}
 */
export function createEquityCurve(canvasId, trades) {
  const ctx = getCtx(canvasId);
  if (!ctx) return null;

  let cumulative = 0;
  const labels = [];
  const data = [];
  const bgColors = [];

  const sorted = [...trades].sort((a, b) => new Date(a.date) - new Date(b.date));
  sorted.forEach((t) => {
    cumulative += Number(t.pnl) || 0;
    labels.push(new Date(t.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
    data.push(parseFloat(cumulative.toFixed(2)));
    bgColors.push(cumulative >= 0 ? COLORS.green : COLORS.red);
  });

  return createTrackedChart(canvasId, ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Equity',
          data,
          borderColor: COLORS.green,
          backgroundColor: 'rgba(57,255,20,0.10)',
          fill: true,
          tension: 0.3,
          pointRadius: 3,
          pointBackgroundColor: bgColors,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: darkPluginOptions('Equity Curve'),
      scales: darkScaleOptions(),
    },
  });
}

/**
 * Create a win / loss doughnut chart.
 * @param {string} canvasId
 * @param {Array<{pnl: number}>} trades
 * @returns {Chart|null}
 */
export function createWinLossChart(canvasId, trades) {
  const ctx = getCtx(canvasId);
  if (!ctx) return null;

  const wins = trades.filter((t) => Number(t.pnl) > 0).length;
  const losses = trades.filter((t) => Number(t.pnl) < 0).length;
  const breakeven = trades.length - wins - losses;

  return createTrackedChart(canvasId, ctx, {
    type: 'doughnut',
    data: {
      labels: ['Wins', 'Losses', 'Break-even'],
      datasets: [
        {
          data: [wins, losses, breakeven],
          backgroundColor: [COLORS.green, COLORS.red, COLORS.purple],
          borderColor: 'transparent',
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '60%',
      plugins: darkPluginOptions('Win / Loss'),
    },
  });
}

/**
 * Create a daily P&L bar chart.
 * Aggregates trades by date and renders a bar per day.
 * @param {string} canvasId
 * @param {Array<{pnl: number, date: string}>} trades
 * @returns {Chart|null}
 */
export function createDailyPnLChart(canvasId, trades) {
  const ctx = getCtx(canvasId);
  if (!ctx) return null;

  /** @type {Map<string, number>} */
  const byDay = new Map();
  trades.forEach((t) => {
    const key = new Date(t.date).toISOString().slice(0, 10);
    byDay.set(key, (byDay.get(key) || 0) + (Number(t.pnl) || 0));
  });

  const sortedKeys = [...byDay.keys()].sort();
  const data = sortedKeys.map((k) => parseFloat(byDay.get(k).toFixed(2)));
  const bgColors = data.map((v) => (v >= 0 ? COLORS.green : COLORS.red));
  const labels = sortedKeys.map((k) =>
    new Date(k).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
  );

  return createTrackedChart(canvasId, ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Daily P&L',
          data,
          backgroundColor: bgColors,
          borderRadius: 4,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: darkPluginOptions('Daily P&L'),
      scales: darkScaleOptions(),
    },
  });
}

/**
 * Create a streak-count bar chart.
 * @param {string} canvasId
 * @param {Array<{name: string, streak: number}>} streakData
 * @returns {Chart|null}
 */
export function createStreakChart(canvasId, streakData) {
  const ctx = getCtx(canvasId);
  if (!ctx) return null;

  const labels = streakData.map((s) => s.name);
  const data = streakData.map((s) => s.streak);
  const bgColors = [COLORS.green, COLORS.cyan, COLORS.purple, COLORS.red];

  return createTrackedChart(canvasId, ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Current Streak (days)',
          data,
          backgroundColor: data.map((_, i) => bgColors[i % bgColors.length]),
          borderRadius: 6,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: darkPluginOptions('Streak Overview'),
      scales: {
        ...darkScaleOptions(),
        y: {
          ...darkScaleOptions().y,
          beginAtZero: true,
          ticks: {
            ...darkScaleOptions().y.ticks,
            stepSize: 1,
          },
        },
      },
    },
  });
}
