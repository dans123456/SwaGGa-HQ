/* ========================================================================
   SwaGGa HQ — Review Hub (Premium Upgrade 3)
   Multi-Timeframe Review Templates: Weekly / Monthly / Quarterly
   Uses createElement + textContent for XSS-safe DOM rendering.
   ======================================================================== */

import storage from './storage.js';
import { getTrades, calculateStats } from './trading.js';
import { getHabits, calculateStreak } from './streaks.js';
import { getLessons } from './learning.js';
import { formatCurrency, sanitizeText, showNotificationToast, triggerConfetti } from './utils.js';
import { addXP } from './xp.js';
import { playSynthSound } from './audio.js';

const REVIEW_STORAGE_KEY = 'reviews';

function el(tag, cls = '', text = '') {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text) node.textContent = text;
  return node;
}

// --- Data Layer ---

function getReviews() {
  return storage.get(REVIEW_STORAGE_KEY, []);
}

function saveReview(review) {
  const reviews = getReviews();
  // Check for existing review with same period + type, replace if found
  const idx = reviews.findIndex(r => r.periodKey === review.periodKey && r.type === review.type);
  if (idx !== -1) {
    reviews[idx] = review;
  } else {
    reviews.push(review);
  }
  storage.set(REVIEW_STORAGE_KEY, reviews);

  // Sync to cloud
  import('./firebase-sync.js').then(({ pushToCloud, getCurrentUser }) => {
    if (getCurrentUser()) pushToCloud();
  }).catch(() => {});
}

// --- Stats Computation Helpers ---

function getTradesInRange(startDate, endDate) {
  const trades = getTrades();
  return trades.filter(t => {
    const d = t.date || (t.createdAt ? t.createdAt.slice(0, 10) : '');
    return d >= startDate && d <= endDate;
  });
}

function getDateRange(type) {
  const now = new Date();
  const endDate = now.toISOString().slice(0, 10);
  let startDate;

  if (type === 'weekly') {
    const start = new Date(now);
    start.setDate(start.getDate() - 7);
    startDate = start.toISOString().slice(0, 10);
  } else if (type === 'monthly') {
    const start = new Date(now);
    start.setDate(start.getDate() - 30);
    startDate = start.toISOString().slice(0, 10);
  } else {
    const start = new Date(now);
    start.setDate(start.getDate() - 90);
    startDate = start.toISOString().slice(0, 10);
  }

  return { startDate, endDate };
}

function computeReviewStats(type) {
  const { startDate, endDate } = getDateRange(type);
  const trades = getTradesInRange(startDate, endDate);
  const stats = calculateStats(trades);

  // Best/worst performing asset
  const assetMap = {};
  trades.forEach(t => {
    if (!assetMap[t.asset]) assetMap[t.asset] = { pnl: 0, count: 0 };
    assetMap[t.asset].pnl += Number(t.pnl) || 0;
    assetMap[t.asset].count++;
  });

  const assetEntries = Object.entries(assetMap).sort((a, b) => b[1].pnl - a[1].pnl);
  const bestAsset = assetEntries.length > 0 ? { name: assetEntries[0][0], pnl: assetEntries[0][1].pnl, count: assetEntries[0][1].count } : null;
  const worstAsset = assetEntries.length > 1 ? { name: assetEntries[assetEntries.length - 1][0], pnl: assetEntries[assetEntries.length - 1][1].pnl, count: assetEntries[assetEntries.length - 1][1].count } : null;

  // Win/loss breakdown
  const wins = trades.filter(t => t.outcome === 'win');
  const losses = trades.filter(t => t.outcome === 'loss');

  // Rule break frequency
  const ruleBreaks = trades.filter(t =>
    t.executionMindset === 'revenge' ||
    t.executionMindset === 'anxious' ||
    (t.guardrails && (!t.guardrails.killzoneTiming || !t.guardrails.htfBiasAligned))
  ).length;

  // Average discipline score
  const avgDiscipline = trades.length > 0
    ? Math.round(trades.reduce((s, t) => s + (t.edgeScore !== undefined ? Number(t.edgeScore) : 100), 0) / trades.length)
    : 100;

  // Best setup type (most common confluence)
  const confMap = {};
  trades.forEach(t => {
    if (Array.isArray(t.confluences)) {
      t.confluences.forEach(c => {
        confMap[c] = (confMap[c] || 0) + 1;
      });
    }
  });
  const bestSetup = Object.entries(confMap).sort((a, b) => b[1] - a[1])[0];

  // Emotion breakdown
  const emotionMap = {};
  trades.forEach(t => {
    if (t.emotionTag) {
      emotionMap[t.emotionTag] = (emotionMap[t.emotionTag] || 0) + 1;
    }
  });

  return {
    startDate,
    endDate,
    totalTrades: stats.totalTrades,
    winRate: stats.winRate,
    totalPnL: stats.totalPnL,
    avgRR: stats.avgRR,
    avgDiscipline,
    wins: wins.length,
    losses: losses.length,
    bestAsset,
    worstAsset,
    ruleBreaks,
    bestSetup: bestSetup ? { name: bestSetup[0], count: bestSetup[1] } : null,
    emotionMap,
  };
}

// --- Review Prompts ---

const WEEKLY_PROMPTS = [
  { key: 'top_wins', label: '🏆 Top 3 wins this week (what setups worked best?)' },
  { key: 'top_leaks', label: '🩸 Top 3 leaks this week (what mistakes keep repeating?)' },
  { key: 'lesson_learned', label: '📖 Key lesson learned this week' },
  { key: 'focus_next_week', label: '🎯 One focus area for next week' },
];

const MONTHLY_PROMPTS = [
  { key: 'biggest_accomplishment', label: '🏆 Biggest trading accomplishment this month' },
  { key: 'worst_habit', label: '🩸 Worst recurring habit this month' },
  { key: 'strategy_refinement', label: '🔧 Strategy refinement or new technique adopted' },
  { key: 'goal_progress', label: '📈 Progress toward monthly trading goals' },
  { key: 'lesson_learned', label: '📖 Most important lesson learned' },
];

const QUARTERLY_PROMPTS = [
  { key: 'goal_progress', label: '📈 Goal progress (are you on track for the year?)' },
  { key: 'strategy_changes', label: '🔧 Major strategy refinements this quarter' },
  { key: 'biggest_accomplishment', label: '🏆 Biggest accomplishment this quarter' },
  { key: 'area_for_improvement', label: '🩸 Area for most improvement next quarter' },
  { key: 'mindset_evolution', label: '🧘 How has your trading mindset evolved?' },
];

function getPrompts(type) {
  if (type === 'weekly') return WEEKLY_PROMPTS;
  if (type === 'monthly') return MONTHLY_PROMPTS;
  return QUARTERLY_PROMPTS;
}

// --- Render ---

export function renderReviewPage(container) {
  container.replaceChildren();

  const header = el('div', 'page-header');
  header.appendChild(el('h1', 'page-title', '📊 Trade Review Hub'));
  header.appendChild(el('p', 'page-subtitle', 'Structured review templates with auto-populated stats. Review your trading like a professional.'));
  container.appendChild(header);

  // Period tabs
  let activeTab = 'weekly';
  const tabBar = el('div', 'review-tab-bar');

  const tabs = [
    { id: 'weekly', label: '📅 Weekly', icon: '7d' },
    { id: 'monthly', label: '📆 Monthly', icon: '30d' },
    { id: 'quarterly', label: '📊 Quarterly', icon: '90d' },
  ];

  const tabButtons = {};
  const contentArea = el('div', 'review-content-area');

  tabs.forEach(tab => {
    const btn = el('button', 'review-tab-btn', tab.label);
    btn.addEventListener('click', () => {
      activeTab = tab.id;
      Object.values(tabButtons).forEach(b => b.classList.remove('review-tab-btn--active'));
      btn.classList.add('review-tab-btn--active');
      playSynthSound('click');
      renderReviewContent(contentArea, tab.id);
    });
    tabButtons[tab.id] = btn;
    tabBar.appendChild(btn);
  });

  tabButtons['weekly'].classList.add('review-tab-btn--active');
  container.appendChild(tabBar);
  container.appendChild(contentArea);

  renderReviewContent(contentArea, 'weekly');

  // Past Reviews Section
  const historySection = el('div', 'review-history-section');
  historySection.appendChild(el('h2', 'review-section-title', '📂 Past Reviews'));
  renderReviewHistory(historySection);
  container.appendChild(historySection);
}

function renderReviewContent(container, type) {
  container.replaceChildren();

  const stats = computeReviewStats(type);
  const { startDate, endDate } = getDateRange(type);
  const periodLabel = type === 'weekly' ? 'This Week' : type === 'monthly' ? 'This Month' : 'This Quarter';
  const periodKey = `${type}_${startDate}_${endDate}`;

  // Load existing review if any
  const reviews = getReviews();
  const existingReview = reviews.find(r => r.periodKey === periodKey && r.type === type);

  // Stats overview grid
  const statsGrid = el('div', 'review-stats-grid');

  const statItems = [
    { icon: '📊', label: 'Total Trades', value: String(stats.totalTrades) },
    { icon: '🎯', label: 'Win Rate', value: `${stats.winRate}%` },
    { icon: '💰', label: 'P&L', value: formatCurrency(stats.totalPnL) },
    { icon: '⚖️', label: 'Avg R:R', value: `${stats.avgRR}R` },
    { icon: '🛡️', label: 'Discipline', value: `${stats.avgDiscipline}%` },
    { icon: '⚠️', label: 'Rule Breaks', value: String(stats.ruleBreaks) },
  ];

  statItems.forEach(({ icon, label, value }) => {
    const card = el('div', 'review-stat-card');
    card.appendChild(el('span', 'review-stat-icon', icon));
    card.appendChild(el('span', 'review-stat-value', value));
    card.appendChild(el('span', 'review-stat-label', label));
    statsGrid.appendChild(card);
  });
  container.appendChild(statsGrid);

  // Asset performance cards
  if (stats.bestAsset || stats.worstAsset) {
    const assetRow = el('div', 'review-asset-row');

    if (stats.bestAsset) {
      const card = el('div', 'review-asset-card review-asset-card--best');
      card.appendChild(el('span', 'review-asset-badge', '🟢 Best Pair'));
      card.appendChild(el('span', 'review-asset-name', stats.bestAsset.name));
      card.appendChild(el('span', 'review-asset-pnl', formatCurrency(stats.bestAsset.pnl)));
      card.appendChild(el('span', 'review-asset-count', `${stats.bestAsset.count} trades`));
      assetRow.appendChild(card);
    }

    if (stats.worstAsset) {
      const card = el('div', 'review-asset-card review-asset-card--worst');
      card.appendChild(el('span', 'review-asset-badge', '🔴 Worst Pair'));
      card.appendChild(el('span', 'review-asset-name', stats.worstAsset.name));
      card.appendChild(el('span', 'review-asset-pnl', formatCurrency(stats.worstAsset.pnl)));
      card.appendChild(el('span', 'review-asset-count', `${stats.worstAsset.count} trades`));
      assetRow.appendChild(card);
    }

    if (stats.bestSetup) {
      const card = el('div', 'review-asset-card review-asset-card--setup');
      card.appendChild(el('span', 'review-asset-badge', '⭐ Top Setup'));
      card.appendChild(el('span', 'review-asset-name', stats.bestSetup.name));
      card.appendChild(el('span', 'review-asset-count', `Used ${stats.bestSetup.count}x`));
      assetRow.appendChild(card);
    }

    container.appendChild(assetRow);
  }

  // Review form
  const formCard = el('div', 'review-form-card glass-card');
  formCard.appendChild(el('h3', 'review-form-title', `📝 ${periodLabel} Reflection`));

  const form = el('form', 'review-form');
  form.addEventListener('submit', (e) => e.preventDefault());

  const prompts = getPrompts(type);
  const textareas = {};

  prompts.forEach(prompt => {
    const group = el('div', 'review-form-group');
    group.appendChild(el('label', 'review-form-label', prompt.label));
    const textarea = document.createElement('textarea');
    textarea.className = 'form-input review-textarea';
    textarea.placeholder = 'Type your reflection here...';
    textarea.rows = 3;
    textarea.value = existingReview ? (existingReview.responses[prompt.key] || '') : '';
    textareas[prompt.key] = textarea;
    group.appendChild(textarea);
    form.appendChild(group);
  });

  // Rating
  const ratingGroup = el('div', 'review-form-group');
  ratingGroup.appendChild(el('label', 'review-form-label', '⭐ Rate this period (1-5)'));
  const ratingRow = el('div', 'review-rating-row');

  let selectedRating = existingReview ? (existingReview.rating || 0) : 0;
  const starButtons = [];

  for (let i = 1; i <= 5; i++) {
    const star = el('button', 'review-star-btn', i <= selectedRating ? '⭐' : '☆');
    star.type = 'button';
    star.addEventListener('click', () => {
      selectedRating = i;
      starButtons.forEach((s, idx) => {
        s.textContent = idx < i ? '⭐' : '☆';
      });
    });
    starButtons.push(star);
    ratingRow.appendChild(star);
  }
  ratingGroup.appendChild(ratingRow);
  form.appendChild(ratingGroup);

  // Save button
  const saveBtn = el('button', 'btn btn-primary review-save-btn', '💾 Save Review');
  saveBtn.type = 'button';
  saveBtn.addEventListener('click', () => {
    const responses = {};
    prompts.forEach(p => {
      responses[p.key] = sanitizeText(textareas[p.key].value, 2000);
    });

    const review = {
      type,
      periodKey,
      startDate,
      endDate,
      createdAt: new Date().toISOString(),
      responses,
      rating: selectedRating,
      stats: {
        totalTrades: stats.totalTrades,
        winRate: stats.winRate,
        totalPnL: stats.totalPnL,
        avgRR: stats.avgRR,
        avgDiscipline: stats.avgDiscipline,
      },
    };

    saveReview(review);
    playSynthSound('success');
    triggerConfetti();
    addXP('review', 30);
    showNotificationToast(`${periodLabel} review saved! +30 XP 📊`);
  });
  form.appendChild(saveBtn);

  formCard.appendChild(form);
  container.appendChild(formCard);
}

function renderReviewHistory(container) {
  const reviews = getReviews();
  if (reviews.length === 0) {
    container.appendChild(el('p', 'review-empty-hint', 'No reviews saved yet. Complete your first review above!'));
    return;
  }

  const list = el('div', 'review-history-list');
  reviews
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 10)
    .forEach(review => {
      const card = el('div', 'review-history-card glass-card');
      const headerRow = el('div', 'review-history-header');

      const typeBadge = el('span', `review-type-badge review-type-badge--${review.type}`);
      typeBadge.textContent = review.type.charAt(0).toUpperCase() + review.type.slice(1);
      headerRow.appendChild(typeBadge);

      const dateEl = el('span', 'review-history-date', new Date(review.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }));
      headerRow.appendChild(dateEl);

      if (review.rating) {
        const stars = el('span', 'review-history-stars', '⭐'.repeat(review.rating));
        headerRow.appendChild(stars);
      }

      card.appendChild(headerRow);

      // Mini stats
      if (review.stats) {
        const miniStats = el('div', 'review-history-stats');
        miniStats.appendChild(el('span', '', `📊 ${review.stats.totalTrades} trades`));
        miniStats.appendChild(el('span', '', `🎯 ${review.stats.winRate}%`));
        miniStats.appendChild(el('span', '', `💰 ${formatCurrency(review.stats.totalPnL)}`));
        card.appendChild(miniStats);
      }

      // Preview first response
      const firstKey = Object.keys(review.responses || {})[0];
      if (firstKey && review.responses[firstKey]) {
        const preview = el('p', 'review-history-preview', review.responses[firstKey].slice(0, 120) + (review.responses[firstKey].length > 120 ? '...' : ''));
        card.appendChild(preview);
      }

      list.appendChild(card);
    });

  container.appendChild(list);
}
