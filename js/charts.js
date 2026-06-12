// chart.js config helpers (Chart global loaded via CDN)

const COLORS = {
  green: '#39ff14',
  red: '#ff3b3b',
  purple: '#b44dff',
  cyan: '#00e5ff',
  gridLine: 'rgba(255,255,255,0.08)',
  text: '#e0e0e0',
  tooltipBg: 'rgba(30,30,30,0.95)',
};

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

// ---

// track instances to destroy before re-creating
const _chartInstances = new Map();

function getCtx(canvasId) {

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

function createTrackedChart(canvasId, ctx, config) {
  const chart = new Chart(ctx, config);
  _chartInstances.set(canvasId, chart);
  return chart;
}

// ---- chart creators ----

/* cumulative equity (P&L) line chart */
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

// daily P&L bar chart
export function createDailyPnLChart(canvasId, trades) {
  const ctx = getCtx(canvasId);
  if (!ctx) return null;

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

export function createConfluenceWinRateChart(canvasId, trades) {
  const ctx = getCtx(canvasId);
  if (!ctx) return null;

  const buckets = {
    'Low (0-2)': { wins: 0, total: 0 },
    'Med (3-4)': { wins: 0, total: 0 },
    'High (5+)': { wins: 0, total: 0 }
  };

  trades.forEach(t => {
    const count = Array.isArray(t.confluences) ? t.confluences.length : 0;
    const isWin = t.outcome === 'win' || (Number(t.pnl) > 0);
    
    let bucketKey = 'Low (0-2)';
    if (count >= 5) bucketKey = 'High (5+)';
    else if (count >= 3) bucketKey = 'Med (3-4)';
    
    buckets[bucketKey].total++;
    if (isWin) buckets[bucketKey].wins++;
  });

  const labels = Object.keys(buckets);
  const winRates = labels.map(label => {
    const b = buckets[label];
    return b.total > 0 ? Math.round((b.wins / b.total) * 100) : 0;
  });

  return createTrackedChart(canvasId, ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Win Rate (%)',
          data: winRates,
          backgroundColor: [COLORS.red, COLORS.purple, COLORS.green],
          borderRadius: 6,
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: darkPluginOptions('Win Rate vs Confluences'),
      scales: {
        ...darkScaleOptions(),
        y: {
          ...darkScaleOptions().y,
          beginAtZero: true,
          max: 100,
          ticks: {
            ...darkScaleOptions().y.ticks,
            callback: value => value + '%'
          }
        }
      }
    }
  });
}

// mistake/loss-psychology doughnut
export function createMistakeChart(canvasId, trades) {
  const ctx = getCtx(canvasId);
  if (!ctx) return null;

  const MISTAKE_LABELS = {
    fomo: 'FOMO',
    revenge: 'Revenge Trading',
    outside_killzone: 'Outside Killzone',
    over_leveraging: 'Over-leveraging',
    moved_sl: 'Moved Stop Loss',
    early_exit: 'Early Exit',
    chasing_price: 'Chasing Price',
    no_plan: 'No Plan'
  };

  const countsWithClean = {
    clean: 0
  };
  Object.keys(MISTAKE_LABELS).forEach(k => {
    countsWithClean[k] = 0;
  });

  trades.forEach((t) => {
    if (t.outcome === 'loss') {
      const m = t.mistake || 'clean';
      countsWithClean[m] = (countsWithClean[m] || 0) + 1;
    }
  });

  const labelsFiltered = [];
  const dataFiltered = [];
  const colorsFiltered = [];

  const MISTAKE_COLORS = {
    clean: COLORS.green,
    fomo: COLORS.red,
    revenge: COLORS.purple,
    outside_killzone: COLORS.cyan,
    over_leveraging: '#ff9100',
    moved_sl: '#ff3d00',
    early_exit: '#ffd600',
    chasing_price: '#e040fb',
    no_plan: '#7c4dff'
  };

  const labelMapping = {
    clean: 'Clean Execution',
    ...MISTAKE_LABELS
  };

  Object.entries(countsWithClean).forEach(([key, count]) => {
    if (count > 0) {
      labelsFiltered.push(labelMapping[key] || key);
      dataFiltered.push(count);
      colorsFiltered.push(MISTAKE_COLORS[key] || '#9e9e9e');
    }
  });

  if (dataFiltered.length === 0) {
    labelsFiltered.push('No Loss History');
    dataFiltered.push(1);
    colorsFiltered.push('#424242');
  }

  return createTrackedChart(canvasId, ctx, {
    type: 'doughnut',
    data: {
      labels: labelsFiltered,
      datasets: [
        {
          data: dataFiltered,
          backgroundColor: colorsFiltered,
          borderColor: 'transparent',
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '60%',
      plugins: darkPluginOptions('Loss Psychology Breakdown'),
    },
  });
}

export function createAssetPerformanceChart(canvasId, trades) {
  const ctx = getCtx(canvasId);
  if (!ctx) return null;

  const byAsset = new Map();
  trades.forEach(t => {
    const asset = t.asset || 'Unknown';
    byAsset.set(asset, (byAsset.get(asset) || 0) + (Number(t.pnl) || 0));
  });

  const sorted = [...byAsset.entries()].sort((a, b) => b[1] - a[1]);
  const labels = sorted.map(([a]) => a);
  const data = sorted.map(([, v]) => parseFloat(v.toFixed(2)));
  const bgColors = data.map(v => v >= 0 ? COLORS.green : COLORS.red);

  return createTrackedChart(canvasId, ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Total P&L',
        data,
        backgroundColor: bgColors,
        borderRadius: 6,
      }],
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: darkPluginOptions('P&L by Asset'),
      scales: darkScaleOptions(true),
    },
  });
}

export function createConfluenceCorrelationChart(canvasId, labels, winRates, tradeCounts) {
  const ctx = getCtx(canvasId);
  if (!ctx) return null;

  const bgColors = winRates.map(wr => {
    if (wr >= 65) return 'rgba(57, 255, 20, 0.7)';
    if (wr >= 45) return 'rgba(255, 200, 0, 0.7)';
    return 'rgba(255, 59, 59, 0.6)';
  });

  return createTrackedChart(canvasId, ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Win Rate (%)',
        data: winRates,
        backgroundColor: bgColors,
        borderRadius: 4,
        barPercentage: 0.75,
      }],
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        ...darkPluginOptions(),
        tooltip: {
          ...darkPluginOptions().tooltip,
          callbacks: {
            label: (ctx) => {
              const idx = ctx.dataIndex;
              return `Win Rate: ${winRates[idx]}% (${tradeCounts[idx]} trades)`;
            },
          },
        },
      },
      scales: {
        ...darkScaleOptions(true),
        x: {
          ...darkScaleOptions(true).x,
          beginAtZero: true,
          max: 100,
          ticks: { ...darkScaleOptions(true).x.ticks, callback: v => v + '%' },
        },
        y: {
          ...darkScaleOptions(true).y,
          ticks: { ...darkScaleOptions(true).y.ticks, font: { size: 11 } },
        },
      },
    },
  });
}

export function createSessionPerformanceChart(canvasId, trades) {
  const ctx = getCtx(canvasId);
  if (!ctx) return null;

  const sessions = ['London', 'New York', 'Asia', 'London Close', 'Overlap'];
  const winRates = [];
  const tradeCounts = [];

  sessions.forEach(s => {
    const sessionTrades = trades.filter(t => t.session === s);
    tradeCounts.push(sessionTrades.length);
    const wins = sessionTrades.filter(t => t.outcome === 'win' || Number(t.pnl) > 0).length;
    winRates.push(sessionTrades.length > 0 ? Math.round((wins / sessionTrades.length) * 100) : 0);
  });

  return createTrackedChart(canvasId, ctx, {
    type: 'bar',
    data: {
      labels: sessions,
      datasets: [
        {
          label: 'Win Rate (%)',
          data: winRates,
          backgroundColor: COLORS.green,
          borderRadius: 6,
        },
        {
          label: 'Total Trades',
          data: tradeCounts,
          backgroundColor: COLORS.cyan,
          borderRadius: 6,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: darkPluginOptions('Performance by Session'),
      scales: {
        ...darkScaleOptions(),
        y: {
          ...darkScaleOptions().y,
          beginAtZero: true,
        },
      },
    },
  });
}

export function createSetupWinRateChart(canvasId, labels, winRates, tradeCounts) {
  const ctx = getCtx(canvasId);
  if (!ctx) return null;

  const bgColors = winRates.map(wr => {
    if (wr >= 60) return 'rgba(57, 255, 20, 0.7)';
    if (wr >= 40) return 'rgba(255, 200, 0, 0.7)';
    return 'rgba(255, 59, 59, 0.6)';
  });

  return createTrackedChart(canvasId, ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Win Rate (%)',
        data: winRates,
        backgroundColor: bgColors,
        borderRadius: 4,
        barPercentage: 0.75,
      }],
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        ...darkPluginOptions('Win Rate by Setup'),
        tooltip: {
          ...darkPluginOptions().tooltip,
          callbacks: {
            label: (context) => {
              const idx = context.dataIndex;
              return `Win Rate: ${winRates[idx]}% (${tradeCounts[idx]} trades)`;
            },
          },
        },
      },
      scales: {
        ...darkScaleOptions(true),
        x: {
          ...darkScaleOptions(true).x,
          beginAtZero: true,
          max: 100,
          ticks: { ...darkScaleOptions(true).x.ticks, callback: v => v + '%' },
        },
        y: {
          ...darkScaleOptions(true).y,
          ticks: { ...darkScaleOptions(true).y.ticks, font: { size: 11 } },
        },
      },
    },
  });
}

export function createEvolutionChart(canvasId, labels, winRates, rrs, expectancies, mistakeRates) {
  const ctx = getCtx(canvasId);
  if (!ctx) return null;

  return createTrackedChart(canvasId, ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Win Rate (%)',
          data: winRates,
          borderColor: COLORS.green,
          backgroundColor: 'rgba(57, 255, 20, 0.05)',
          yAxisID: 'yPercent',
          tension: 0.3,
          pointRadius: 4,
        },
        {
          label: 'Mistake Rate (%)',
          data: mistakeRates,
          borderColor: COLORS.red,
          backgroundColor: 'rgba(255, 59, 59, 0.05)',
          yAxisID: 'yPercent',
          tension: 0.3,
          pointRadius: 4,
        },
        {
          label: 'Avg R:R (R)',
          data: rrs,
          borderColor: COLORS.purple,
          backgroundColor: 'rgba(180, 77, 255, 0.05)',
          yAxisID: 'yRValue',
          tension: 0.3,
          pointRadius: 4,
        },
        {
          label: 'Expectancy (R)',
          data: expectancies,
          borderColor: COLORS.cyan,
          backgroundColor: 'rgba(0, 229, 255, 0.05)',
          yAxisID: 'yRValue',
          tension: 0.3,
          pointRadius: 4,
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: darkPluginOptions('Strategy Evolution Timeline'),
      scales: {
        x: {
          ticks: { color: COLORS.text },
          grid: { color: COLORS.gridLine },
        },
        yPercent: {
          type: 'linear',
          position: 'left',
          min: 0,
          max: 100,
          ticks: {
            color: COLORS.text,
            callback: v => v + '%',
          },
          grid: { color: COLORS.gridLine },
          title: {
            display: true,
            text: 'Percentage',
            color: COLORS.text,
          }
        },
        yRValue: {
          type: 'linear',
          position: 'right',
          ticks: {
            color: COLORS.text,
            callback: v => v + 'R',
          },
          grid: { drawOnChartArea: false },
          title: {
            display: true,
            text: 'R-Value',
            color: COLORS.text,
          }
        }
      }
    }
  });
}
