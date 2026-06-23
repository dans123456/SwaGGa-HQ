/* ========================================================================
   SwaGGa HQ — Review Hub (Premium Upgrade 3)
   Multi-Timeframe Review Templates: Weekly / Monthly / Quarterly
   Uses createElement + textContent for XSS-safe DOM rendering.
   ======================================================================== */

import storage from './storage.js';
import { getTrades, calculateStats, MISTAKE_LABELS, getEffectiveConfluenceOptions } from './trading.js';
import { getHabits, calculateStreak } from './streaks.js';
import { getLessons } from './learning.js';
import { formatCurrency, sanitizeText, showNotificationToast, triggerConfetti, el } from './utils.js';
import { addXP } from './xp.js';
import { playSynthSound } from './audio.js';
import { nativeHaptic } from './native-bridge.js';

const REVIEW_STORAGE_KEY = 'reviews';

// --- Data Layer ---

function getReviews() {
  return storage.get(REVIEW_STORAGE_KEY, []);
}

function saveReview(review) {
  const reviews = getReviews();
  // Stamp with updatedAt so cloud merge can determine winner
  review.updatedAt = new Date().toISOString();
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

function getDateRange(type, period = 'previous') {
  const now = new Date();
  let startDate, endDate;

  if (type === 'weekly') {
    if (period === 'previous') {
      const day = now.getDay();
      const daysToLastMonday = (day === 0 ? 6 : day - 1) + 7;
      const lastMonday = new Date(now);
      lastMonday.setDate(now.getDate() - daysToLastMonday);
      const lastSunday = new Date(lastMonday);
      lastSunday.setDate(lastMonday.getDate() + 6);
      
      startDate = lastMonday.toISOString().slice(0, 10);
      endDate = lastSunday.toISOString().slice(0, 10);
    } else {
      const day = now.getDay();
      const daysToMonday = (day === 0 ? 6 : day - 1);
      const monday = new Date(now);
      monday.setDate(now.getDate() - daysToMonday);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      
      startDate = monday.toISOString().slice(0, 10);
      endDate = sunday.toISOString().slice(0, 10);
    }
  } else if (type === 'monthly') {
    if (period === 'previous') {
      const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
      
      startDate = lastMonthStart.toISOString().slice(0, 10);
      endDate = lastMonthEnd.toISOString().slice(0, 10);
    } else {
      const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      
      startDate = currentMonthStart.toISOString().slice(0, 10);
      endDate = currentMonthEnd.toISOString().slice(0, 10);
    }
  } else {
    if (period === 'previous') {
      const currentQuarter = Math.floor(now.getMonth() / 3);
      let prevQuarter = currentQuarter - 1;
      let prevQuarterYear = now.getFullYear();
      if (prevQuarter < 0) {
        prevQuarter = 3;
        prevQuarterYear--;
      }
      const lastQuarterStart = new Date(prevQuarterYear, prevQuarter * 3, 1);
      const lastQuarterEnd = new Date(prevQuarterYear, (prevQuarter + 1) * 3, 0);
      
      startDate = lastQuarterStart.toISOString().slice(0, 10);
      endDate = lastQuarterEnd.toISOString().slice(0, 10);
    } else {
      const currentQuarter = Math.floor(now.getMonth() / 3);
      const currentQuarterStart = new Date(now.getFullYear(), currentQuarter * 3, 1);
      const currentQuarterEnd = new Date(now.getFullYear(), (currentQuarter + 1) * 3, 0);
      
      startDate = currentQuarterStart.toISOString().slice(0, 10);
      endDate = currentQuarterEnd.toISOString().slice(0, 10);
    }
  }

  return { startDate, endDate };
}

function computeReviewStats(type, period = 'previous') {
  const { startDate, endDate } = getDateRange(type, period);
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

  // Main Page Tabs: Reflections vs Strategy Lab
  const mainTabWrapper = el('div', 'review-main-tabs');
  const reflectionsBtn = el('button', 'review-main-tab-btn review-main-tab-btn--active', '📝 Period Reflections');
  const strategyLabBtn = el('button', 'review-main-tab-btn', '🧪 Strategy Lab (Premium)');
  
  mainTabWrapper.appendChild(reflectionsBtn);
  mainTabWrapper.appendChild(strategyLabBtn);
  container.appendChild(mainTabWrapper);

  // Body container that switches based on active tab
  const bodyContainer = el('div', 'review-body-container');
  container.appendChild(bodyContainer);

  const renderReflectionsView = () => {
    bodyContainer.replaceChildren();

    // Period tabs
    const targetTab = storage.get('active_review_tab', 'weekly');
    const targetPeriod = storage.get('active_review_period', null);
    storage.delete('active_review_tab');
    storage.delete('active_review_period');
    let activeTab = targetTab;
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

    tabButtons[targetTab].classList.add('review-tab-btn--active');
    bodyContainer.appendChild(tabBar);
    bodyContainer.appendChild(contentArea);

    renderReviewContent(contentArea, targetTab, targetPeriod);

    // Past Reviews Section
    const historySection = el('div', 'review-history-section');
    historySection.appendChild(el('h2', 'review-section-title', '📂 Past Reviews'));
    renderReviewHistory(historySection);
    bodyContainer.appendChild(historySection);

    // Reminder Settings Section
    const settingsSection = el('div', 'review-settings-section glass-card');
    settingsSection.style.marginTop = 'var(--space-6)';
    settingsSection.style.padding = 'var(--space-5)';
    
    const settingsTitle = el('h3', 'review-form-title', '🔔 Review Reminder Settings');
    settingsTitle.style.margin = '0 0 var(--space-1) 0';
    settingsSection.appendChild(settingsTitle);
    
    const settingsDesc = el('p', '', 'Configure weekly, monthly, and quarterly native push notifications to maintain your review discipline.');
    settingsDesc.style.fontSize = 'var(--text-xs)';
    settingsDesc.style.color = 'var(--text-muted)';
    settingsDesc.style.margin = '0 0 var(--space-4) 0';
    settingsSection.appendChild(settingsDesc);

    const settingsGrid = el('div', 'review-settings-grid');
    settingsGrid.style.display = 'flex';
    settingsGrid.style.flexDirection = 'column';
    settingsGrid.style.gap = 'var(--space-3)';

    const reminderTypes = [
      { id: 'weekly', label: 'Weekly Review', defaultTime: '18:00', defaultEnabled: true, desc: 'Every Sunday at the specified time' },
      { id: 'monthly', label: 'Monthly Review', defaultTime: '09:00', defaultEnabled: true, desc: '1st of the month at the specified time' },
      { id: 'quarterly', label: 'Quarterly Review', defaultTime: '10:00', defaultEnabled: true, desc: '1st day of the quarter at the specified time' },
    ];

    reminderTypes.forEach(rt => {
      const enabledKey = `review_${rt.id}_reminder_enabled`;
      const timeKey = `review_${rt.id}_reminder_time`;
      
      const isEnabled = storage.get(enabledKey, rt.defaultEnabled);
      const timeVal = storage.get(timeKey, rt.defaultTime);

      const row = el('div', 'review-setting-row');
      row.style.display = 'flex';
      row.style.alignItems = 'center';
      row.style.justifyContent = 'space-between';
      row.style.padding = 'var(--space-2) var(--space-3)';
      row.style.background = 'rgba(255, 255, 255, 0.01)';
      row.style.border = '1px solid rgba(255, 255, 255, 0.04)';
      row.style.borderRadius = 'var(--radius-md)';

      const infoCol = el('div', '');
      const rowLabel = el('strong', '', rt.label);
      rowLabel.style.fontSize = 'var(--text-sm)';
      infoCol.appendChild(rowLabel);
      
      const rowDesc = el('div', '', rt.desc);
      rowDesc.style.fontSize = '10px';
      rowDesc.style.color = 'var(--text-muted)';
      infoCol.appendChild(rowDesc);
      row.appendChild(infoCol);

      const controls = el('div', '');
      controls.style.display = 'flex';
      controls.style.alignItems = 'center';
      controls.style.gap = 'var(--space-3)';

      // Time Input
      const timeInput = document.createElement('input');
      timeInput.type = 'time';
      timeInput.className = 'form-input';
      timeInput.style.padding = '0.2rem 0.4rem';
      timeInput.style.fontSize = '12px';
      timeInput.style.width = '100px';
      timeInput.style.background = 'rgba(0,0,0,0.2)';
      timeInput.style.border = '1px solid rgba(255,255,255,0.1)';
      timeInput.style.borderRadius = 'var(--radius-sm)';
      timeInput.style.color = '#fff';
      timeInput.value = timeVal;
      timeInput.disabled = !isEnabled;
      controls.appendChild(timeInput);

      // Toggle Switch
      const toggle = el('button', `btn btn-sm ${isEnabled ? 'btn-secondary' : 'btn-outline'}`);
      toggle.textContent = isEnabled ? 'Enabled' : 'Disabled';
      toggle.addEventListener('click', async () => {
        const currentEnabled = storage.get(enabledKey, rt.defaultEnabled);
        const newEnabled = !currentEnabled;
        storage.set(enabledKey, newEnabled);
        
        toggle.textContent = newEnabled ? 'Enabled' : 'Disabled';
        toggle.className = `btn btn-sm ${newEnabled ? 'btn-secondary' : 'btn-outline'}`;
        timeInput.disabled = !newEnabled;
        
        // reschedule
        import('./native-bridge.js').then(async (nb) => {
          await nb.scheduleReviewReminders();
        });
      });
      controls.appendChild(toggle);

      timeInput.addEventListener('change', () => {
        storage.set(timeKey, timeInput.value);
        // reschedule
        import('./native-bridge.js').then(async (nb) => {
          await nb.scheduleReviewReminders();
        });
      });

      row.appendChild(controls);
      settingsGrid.appendChild(row);
    });

    settingsSection.appendChild(settingsGrid);
    bodyContainer.appendChild(settingsSection);
  };

  const renderStrategyLabView = () => {
    bodyContainer.replaceChildren();
    renderStrategyLab(bodyContainer);
  };

  reflectionsBtn.addEventListener('click', () => {
    reflectionsBtn.className = 'review-main-tab-btn review-main-tab-btn--active';
    strategyLabBtn.className = 'review-main-tab-btn';
    playSynthSound('click');
    renderReflectionsView();
  });

  strategyLabBtn.addEventListener('click', () => {
    strategyLabBtn.className = 'review-main-tab-btn review-main-tab-btn--active';
    reflectionsBtn.className = 'review-main-tab-btn';
    playSynthSound('click');
    renderStrategyLabView();
  });

  // Default view
  renderReflectionsView();
}

function renderReviewContent(container, type, period = null) {
  // Determine if previous period is completed
  const prevRange = getDateRange(type, 'previous');
  const prevKey = `${type}_${prevRange.startDate}_${prevRange.endDate}`;
  const reviews = getReviews();
  const prevCompleted = reviews.some(r => r.periodKey === prevKey && r.type === type);

  // Smart default logic: if previous is completed, load current active period
  if (!period) {
    period = prevCompleted ? 'current' : 'previous';
  }

  const stats = computeReviewStats(type, period);
  const { startDate, endDate } = getDateRange(type, period);
  
  let periodLabel = '';
  if (type === 'weekly') {
    periodLabel = period === 'previous' ? 'Previous Week' : 'Current Week';
  } else if (type === 'monthly') {
    periodLabel = period === 'previous' ? 'Previous Month' : 'Current Month';
  } else {
    periodLabel = period === 'previous' ? 'Previous Quarter' : 'Current Quarter';
  }

  const periodKey = `${type}_${startDate}_${endDate}`;
  const existingReview = reviews.find(r => r.periodKey === periodKey && r.type === type);

  container.replaceChildren();

  // Period Selector Button Group
  const selectorWrapper = el('div', 'review-period-selector');

  const prevBtn = el('button', `review-period-btn${period === 'previous' ? ' review-period-btn--active' : ''}`);
  prevBtn.textContent = type === 'weekly' ? '⏮️ Previous Week' : type === 'monthly' ? '⏮️ Previous Month' : '⏮️ Previous Quarter';
  if (prevCompleted) {
    prevBtn.classList.add('review-period-btn--completed');
    prevBtn.textContent += ' (Completed)';
  }
  prevBtn.addEventListener('click', () => {
    playSynthSound('click');
    renderReviewContent(container, type, 'previous');
  });

  const currRange = getDateRange(type, 'current');
  const currKey = `${type}_${currRange.startDate}_${currRange.endDate}`;
  const currCompleted = reviews.some(r => r.periodKey === currKey && r.type === type);

  const currBtn = el('button', `review-period-btn${period === 'current' ? ' review-period-btn--active' : ''}`);
  currBtn.textContent = type === 'weekly' ? '⏭️ Current Week' : type === 'monthly' ? '⏭️ Current Month' : '⏭️ Current Quarter';
  if (currCompleted) {
    currBtn.classList.add('review-period-btn--completed');
    currBtn.textContent += ' (Completed)';
  }
  currBtn.addEventListener('click', () => {
    playSynthSound('click');
    renderReviewContent(container, type, 'current');
  });

  selectorWrapper.appendChild(prevBtn);
  selectorWrapper.appendChild(currBtn);
  container.appendChild(selectorWrapper);

  // Period Date Range Subtitle Info
  const boundsInfo = el('p', 'review-date-subtitle');
  boundsInfo.style.fontSize = 'var(--text-xs)';
  boundsInfo.style.color = 'var(--text-muted)';
  boundsInfo.style.textAlign = 'center';
  boundsInfo.style.marginBottom = 'var(--space-4)';
  boundsInfo.style.fontWeight = '600';
  boundsInfo.textContent = `📅 Period Bounds: ${startDate} to ${endDate}`;
  container.appendChild(boundsInfo);

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

    // Reload the content area so the Period Selector and forms reflect saved state immediately
    renderReviewContent(container, type, period);

    // Dynamic History section update
    const historySection = document.querySelector('.review-history-section');
    if (historySection) {
      historySection.replaceChildren();
      historySection.appendChild(el('h2', 'review-section-title', '📂 Past Reviews'));
      renderReviewHistory(historySection);
    }
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

// ========================================================================
// PREMIUM UPGRADES: Strategy Lab (Ep 27: Improve Your Strategy With Data)
// ========================================================================

function shortenConfluence(full) {
  return full.replace(/\s*\[Ep\s*\d+\]\s*$/i, '').trim();
}

// --- SwagAI Performance Critique Premium Upgrade ---

function compileCritiqueContext(trades) {
  const stats = calculateStats(trades);
  
  const confluenceMap = {};
  const mistakeMap = {};
  const pairMap = {};
  const sessionMap = {};
  
  trades.forEach(t => {
    if (Array.isArray(t.confluences)) {
      t.confluences.forEach(c => {
        if (!confluenceMap[c]) confluenceMap[c] = { pnl: 0, wins: 0, total: 0 };
        confluenceMap[c].pnl += Number(t.pnl) || 0;
        confluenceMap[c].total++;
        if (Number(t.pnl) > 0) confluenceMap[c].wins++;
      });
    }
    const m = t.mistake || 'none';
    if (m !== 'none') {
      mistakeMap[m] = (mistakeMap[m] || 0) + 1;
    }
    const p = t.asset || 'unknown';
    if (!pairMap[p]) pairMap[p] = { pnl: 0, wins: 0, total: 0 };
    pairMap[p].pnl += Number(t.pnl) || 0;
    pairMap[p].total++;
    if (Number(t.pnl) > 0) pairMap[p].wins++;
    
    const s = t.session || 'unknown';
    if (!sessionMap[s]) sessionMap[s] = { pnl: 0, wins: 0, total: 0 };
    sessionMap[s].pnl += Number(t.pnl) || 0;
    sessionMap[s].total++;
    if (Number(t.pnl) > 0) sessionMap[s].wins++;
  });

  const topConfluences = Object.entries(confluenceMap)
    .map(([name, data]) => `- ${name}: P&L: $${data.pnl.toFixed(2)}, WR: ${Math.round((data.wins/data.total)*100)}% (Over ${data.total} trades)`)
    .join('\n');
    
  const topMistakes = Object.entries(mistakeMap)
    .sort((a, b) => b[1] - a[1])
    .map(([m, count]) => `- ${m}: ${count} times`)
    .join('\n');
    
  const topPairs = Object.entries(pairMap)
    .map(([name, data]) => `- ${name}: P&L: $${data.pnl.toFixed(2)}, WR: ${Math.round((data.wins/data.total)*100)}% (Over ${data.total} trades)`)
    .join('\n');

  const topSessions = Object.entries(sessionMap)
    .map(([name, data]) => `- ${name}: P&L: $${data.pnl.toFixed(2)}, WR: ${Math.round((data.wins/data.total)*100)}% (Over ${data.total} trades)`)
    .join('\n');

  return `
USER: SwaGGa
TOTAL TRADES LOGGED: ${stats.totalTrades}
WIN RATE: ${stats.winRate}%
TOTAL P&L: $${stats.totalPnL.toFixed(2)}
AVERAGE R:R: ${stats.avgRR}R

PAIR METRICS:
${topPairs || 'No pairs logged.'}

SESSION METRICS:
${topSessions || 'No sessions logged.'}

CONFLUENCE PERFORMANCE:
${topConfluences || 'No confluences logged.'}

FREQUENT MISTAKE TAGS:
${topMistakes || 'No mistakes logged.'}
  `;
}

function renderSwagAICritiqueWidget(container, trades) {
  const card = el('div', 'strategy-lab-row strategy-lab-row--full glass-card');
  card.style.padding = 'var(--space-6)';
  card.style.marginBottom = 'var(--space-6)';
  card.style.border = '1px solid rgba(168, 85, 247, 0.2)';
  card.style.background = 'linear-gradient(135deg, rgba(168, 85, 247, 0.03) 0%, rgba(0, 212, 255, 0.02) 100%)';
  card.style.boxShadow = '0 10px 30px rgba(0, 0, 0, 0.4)';
  container.appendChild(card);

  const title = el('h3', 'review-form-title');
  title.style.margin = '0 0 var(--space-2) 0';
  title.style.display = 'flex';
  title.style.alignItems = 'center';
  title.style.gap = 'var(--space-2)';
  title.style.color = 'var(--purple)';
  title.textContent = '🤖 SwagAI Trade Performance Critique';
  card.appendChild(title);

  const desc = el('p', '', 'Get a direct, clinical, and data-driven analysis of your edge, trading mistakes, and risk parameters.');
  desc.style.fontSize = 'var(--text-xs)';
  desc.style.color = 'var(--text-muted)';
  desc.style.margin = '0 0 var(--space-4) 0';
  card.appendChild(desc);

  const contentArea = el('div', 'swaggai-critique-content');
  contentArea.style.minHeight = '60px';
  contentArea.style.padding = 'var(--space-4)';
  contentArea.style.borderRadius = 'var(--radius-md)';
  contentArea.style.background = 'rgba(0, 0, 0, 0.2)';
  contentArea.style.border = '1px solid rgba(255, 255, 255, 0.04)';
  contentArea.style.marginBottom = 'var(--space-4)';
  card.appendChild(contentArea);

  const savedCritique = storage.get('swagga:ai_performance_critique', null);
  const lastGenerated = storage.get('swagga:ai_performance_critique_timestamp', null);

  const renderCritiqueText = (text, timestamp) => {
    contentArea.replaceChildren();
    
    import('./coach.js').then(({ formatMarkdownText }) => {
      const formatted = formatMarkdownText(text);
      contentArea.appendChild(formatted);
    }).catch(() => {
      const pre = el('pre');
      pre.textContent = text;
      pre.style.whiteSpace = 'pre-wrap';
      pre.style.fontFamily = 'inherit';
      pre.style.fontSize = 'var(--text-xs)';
      contentArea.appendChild(pre);
    });

    if (timestamp) {
      const tsEl = el('div', '', `Last updated: ${new Date(timestamp).toLocaleString()}`);
      tsEl.style.fontSize = '9px';
      tsEl.style.color = 'var(--text-muted)';
      tsEl.style.marginTop = 'var(--space-3)';
      tsEl.style.textAlign = 'right';
      contentArea.appendChild(tsEl);
    }
  };

  if (savedCritique) {
    renderCritiqueText(savedCritique, lastGenerated);
  } else {
    const emptyHint = el('p', '', 'No critique generated for this data yet. Click the button below to analyze your journal.');
    emptyHint.style.fontSize = 'var(--text-xs)';
    emptyHint.style.color = 'var(--text-muted)';
    emptyHint.style.fontStyle = 'italic';
    emptyHint.style.margin = '0';
    contentArea.appendChild(emptyHint);
  }

  const btnRow = el('div');
  btnRow.style.display = 'flex';
  btnRow.style.justifyContent = 'flex-end';
  
  const genBtn = el('button', 'btn btn-purple btn-sm', savedCritique ? '🔄 Regenerate AI Critique' : '📊 Generate AI Critique');
  btnRow.appendChild(genBtn);
  card.appendChild(btnRow);

  genBtn.addEventListener('click', async () => {
    const model = storage.get('coach_selected_model', 'gemini');
    const apiKey = localStorage.getItem(model === 'gemini' ? 'swagga:gemini_api_key' : 'swagga:claude_api_key') || '';

    let cleanedApiKey = apiKey.trim();
    if (cleanedApiKey.startsWith('"') && cleanedApiKey.endsWith('"')) {
      try {
        const parsed = JSON.parse(cleanedApiKey);
        if (typeof parsed === 'string') cleanedApiKey = parsed.trim();
      } catch (e) {}
    }

    if (!cleanedApiKey) {
      showNotificationToast('Please configure your SwagAI API keys in the Coach settings tab first!', '⚠️');
      return;
    }

    genBtn.disabled = true;
    genBtn.textContent = '⏳ SwagAI is analyzing...';
    contentArea.replaceChildren();
    
    const loadingWrap = el('div');
    loadingWrap.style.display = 'flex';
    loadingWrap.style.flexDirection = 'column';
    loadingWrap.style.alignItems = 'center';
    loadingWrap.style.gap = 'var(--space-3)';
    loadingWrap.style.padding = 'var(--space-4) 0';

    const spinner = el('div', 'login-spinner');
    spinner.style.width = '24px';
    spinner.style.height = '24px';
    spinner.style.borderRadius = '50%';
    spinner.style.border = '2px solid rgba(168, 85, 247, 0.1)';
    spinner.style.borderTopColor = 'var(--purple)';
    spinner.style.animation = 'spin 1s infinite linear';

    const loadText = el('span', '', 'Reading trade logs, confluences, and mistake patterns...');
    loadText.style.fontSize = 'var(--text-xs)';
    loadText.style.color = 'var(--purple)';
    loadText.style.fontWeight = '600';
    loadText.style.animation = 'pulse 2s infinite ease-in-out';

    loadingWrap.appendChild(spinner);
    loadingWrap.appendChild(loadText);
    contentArea.appendChild(loadingWrap);

    try {
      const userText = compileCritiqueContext(trades);
      const systemPrompt = `You are "SwagAI", SwaGGa's elite quantitative trade reviewer and performance psychologist.
Analyze SwaGGa's trading history and write a blunt, direct, clinical performance review.
Keep it formatted in clean Markdown. Break it into three concise sections:
1. 📈 EDGE DIAGNOSTIC (Identify the pairs, confluences, and sessions that show real statistical edge)
2. 🩸 LEAK DETECTION (Identify the biggest mistakes, pair/session drag, or psychological errors costing money)
3. 🛠️ ACTIONABLE RX (Provide 2 specific, non-negotiable rules SwaGGa must add to their pre-market routine to fix the leak)
Speak like a strict trading mentor. Be concise. Avoid fluff.`;

      let aiResponse = '';

      if (model === 'gemini') {
        const modelsToTry = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-2.0-flash-lite'];
        let finalResponse = null;
        let lastError = null;

        for (const modelName of modelsToTry) {
          try {
            const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${cleanedApiKey}`;
            const res = await fetch(endpoint, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [{ parts: [{ text: userText }] }],
                systemInstruction: { parts: [{ text: systemPrompt }] }
              })
            });
            if (res.ok) {
              finalResponse = res;
              break;
            } else {
              const body = await res.text();
              lastError = new Error(`${modelName} failure: ${body.substring(0, 100)}`);
            }
          } catch (err) {
            lastError = err;
          }
        }

        if (!finalResponse) {
          throw lastError || new Error('All Gemini API endpoints failed.');
        }

        const data = await finalResponse.json();
        aiResponse = data.candidates[0].content.parts[0].text;
      } else {
        const endpoint = 'https://api.anthropic.com/v1/messages';
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'x-api-key': cleanedApiKey,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json',
            'anthropic-dangerous-direct-browser-access': 'true'
          },
          body: JSON.stringify({
            model: 'claude-3-5-sonnet-20241022',
            max_tokens: 1024,
            system: systemPrompt,
            messages: [{ role: 'user', content: userText }]
          })
        });

        if (!response.ok) {
          const body = await response.text();
          throw new Error(`Claude API Error ${response.status}: ${body.substring(0, 150)}`);
        }

        const data = await response.json();
        aiResponse = data.content[0].text;
      }

      const now = Date.now();
      storage.set('swagga:ai_performance_critique', aiResponse);
      storage.set('swagga:ai_performance_critique_timestamp', now);
      
      renderCritiqueText(aiResponse, now);
      genBtn.textContent = '🔄 Regenerate AI Critique';
      showNotificationToast('SwagAI Critique generated successfully! 🤖📊');
      playSynthSound('success');
      triggerConfetti();
      nativeHaptic();
    } catch (err) {
      console.error(err);
      contentArea.replaceChildren();
      
      const errText = el('p', '', `Failed to generate critique: ${err.message || err}`);
      errText.style.color = 'var(--neon-red)';
      errText.style.fontSize = 'var(--text-xs)';
      errText.style.margin = '0';
      contentArea.appendChild(errText);
      
      genBtn.textContent = savedCritique ? '🔄 Regenerate AI Critique' : '📊 Generate AI Critique';
      showNotificationToast('SwagAI query failed. Check console or API key.', '❌');
      playSynthSound('error');
    } finally {
      genBtn.disabled = false;
    }
  });
}

function renderStrategyLab(container) {
  const trades = getTrades();

  if (trades.length === 0) {
    const emptyState = el('div', 'review-empty-hint glass-card');
    emptyState.style.padding = 'var(--space-8)';
    emptyState.style.textAlign = 'center';
    
    const icon = el('span', '', '🧪');
    icon.style.display = 'block';
    icon.style.fontSize = '3rem';
    icon.style.marginBottom = 'var(--space-4)';
    emptyState.appendChild(icon);
    
    const title = el('h3', '', 'SMC Strategy Lab Unlocked!');
    title.style.fontFamily = 'var(--font-heading)';
    title.style.fontWeight = '800';
    title.style.fontSize = 'var(--text-md)';
    title.style.marginBottom = 'var(--space-2)';
    title.style.color = 'var(--purple)';
    emptyState.appendChild(title);
    
    const desc = el('p', '', 'Log at least one trade in your journal to unlock premium setup scorecard, session heatmap, mistake analyzer, expectancy tracker, and strategy evolution timeline. Let your own data tell you your edge!');
    emptyState.appendChild(desc);
    
    container.appendChild(emptyState);
    return;
  }

  // Strategy Lab Grid container
  const grid = el('div', 'strategy-lab-grid');
  container.appendChild(grid);

  // SwagAI Performance Critique Widget
  renderSwagAICritiqueWidget(grid, trades);

  // Top Row: calculator & mistake stats
  const topRow = el('div', 'strategy-lab-row strategy-lab-row--top');
  topRow.style.display = 'flex';
  topRow.style.flexWrap = 'wrap';
  topRow.style.gap = 'var(--space-4)';
  topRow.style.marginBottom = 'var(--space-4)';
  grid.appendChild(topRow);

  renderEdgeScoreWidget(topRow, trades);
  renderMistakeAnalyzerWidget(topRow, trades);

  // Scorecard & Chart
  const scorecardRow = el('div', 'strategy-lab-row strategy-lab-row--full glass-card');
  scorecardRow.style.padding = 'var(--space-5)';
  scorecardRow.style.marginBottom = 'var(--space-4)';
  grid.appendChild(scorecardRow);
  renderStrategyScorecardWidget(scorecardRow, trades);

  // Session Heatmap
  const heatmapRow = el('div', 'strategy-lab-row strategy-lab-row--full glass-card');
  heatmapRow.style.padding = 'var(--space-5)';
  heatmapRow.style.marginBottom = 'var(--space-4)';
  grid.appendChild(heatmapRow);
  renderSessionHeatmapWidget(heatmapRow, trades);

  // Evolution Timeline
  const evolutionRow = el('div', 'strategy-lab-row strategy-lab-row--full glass-card');
  evolutionRow.style.padding = 'var(--space-5)';
  grid.appendChild(evolutionRow);
  renderEvolutionTimelineWidget(evolutionRow, trades);
}

function renderEdgeScoreWidget(container, trades) {
  const card = el('div', 'strategy-lab-widget glass-card');
  card.style.flex = '1';
  card.style.minWidth = '280px';
  card.style.padding = 'var(--space-5)';
  container.appendChild(card);

  const title = el('h3', 'review-form-title', '🎯 Edge Score & A+ Setup Filter');
  title.style.margin = '0 0 var(--space-1) 0';
  card.appendChild(title);
  
  const desc = el('p', '', 'Find which confluence combinations give you the highest expectancy (Edge).');
  desc.style.fontSize = 'var(--text-xs)';
  desc.style.color = 'var(--text-muted)';
  desc.style.margin = '0 0 var(--space-4) 0';
  card.appendChild(desc);

  // Calculator panel
  const calcContainer = el('div', 'edge-calc-container');
  card.appendChild(calcContainer);

  const calcTitle = el('h4', '', '🧪 Interactive Pre-Trade Filter');
  calcTitle.style.fontSize = 'var(--text-xs)';
  calcTitle.style.fontWeight = '700';
  calcTitle.style.margin = '0 0 var(--space-2) 0';
  calcTitle.style.color = 'var(--cyan)';
  calcContainer.appendChild(calcTitle);

  // Confluences checkboxes checklist
  const checkboxList = el('div', 'edge-calc-checklist');
  checkboxList.style.maxHeight = '140px';
  checkboxList.style.overflowY = 'auto';
  checkboxList.style.border = '1px solid rgba(255, 255, 255, 0.08)';
  checkboxList.style.borderRadius = 'var(--radius-md)';
  checkboxList.style.padding = 'var(--space-2)';
  checkboxList.style.marginBottom = 'var(--space-3)';

  const activeConfs = getEffectiveConfluenceOptions();
  const checkboxes = [];

  activeConfs.forEach(c => {
    const label = el('label', 'edge-calc-label');
    label.style.display = 'flex';
    label.style.alignItems = 'center';
    label.style.gap = 'var(--space-2)';
    label.style.fontSize = '11px';
    label.style.cursor = 'pointer';
    label.style.marginBottom = 'var(--space-1)';

    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.value = c;
    label.appendChild(cb);
    label.appendChild(document.createTextNode(shortenConfluence(c)));
    checkboxList.appendChild(label);
    checkboxes.push(cb);
  });
  calcContainer.appendChild(checkboxList);

  // Result display
  const resultPanel = el('div', 'edge-calc-result');
  resultPanel.style.padding = 'var(--space-3)';
  resultPanel.style.borderRadius = 'var(--radius-md)';
  resultPanel.style.background = 'rgba(255,255,255,0.02)';
  resultPanel.style.border = '1px solid rgba(255,255,255,0.06)';
  resultPanel.style.textAlign = 'center';

  const resultStatus = el('div', 'edge-calc-status', 'Select confluences to check edge score');
  resultStatus.style.fontWeight = '800';
  resultStatus.style.fontSize = 'var(--text-sm)';
  resultPanel.appendChild(resultStatus);

  const resultStats = el('div', 'edge-calc-stats', 'No confluences selected');
  resultStats.style.fontSize = '10px';
  resultStats.style.color = 'var(--text-muted)';
  resultStats.style.marginTop = '4px';
  resultPanel.appendChild(resultStats);

  calcContainer.appendChild(resultPanel);

  const updateCalcResult = () => {
    const selected = checkboxes.filter(cb => cb.checked).map(cb => cb.value);
    if (selected.length === 0) {
      resultStatus.textContent = 'Select confluences to check edge score';
      resultStatus.style.color = 'var(--text-muted)';
      resultStats.textContent = 'No confluences selected';
      resultPanel.style.background = 'rgba(255,255,255,0.02)';
      resultPanel.style.borderColor = 'rgba(255,255,255,0.06)';
      return;
    }

    const matchingTrades = trades.filter(t => 
      Array.isArray(t.confluences) && selected.every(sc => t.confluences.includes(sc))
    );

    if (matchingTrades.length === 0) {
      resultStatus.textContent = '⚪ No Data';
      resultStatus.style.color = 'var(--text-muted)';
      resultStats.textContent = '0 trades logged with this combo';
      resultPanel.style.background = 'rgba(255, 255, 255, 0.04)';
      resultPanel.style.borderColor = 'rgba(255, 255, 255, 0.08)';
      return;
    }

    const wins = matchingTrades.filter(t => t.outcome === 'win' || (t.outcome !== 'loss' && Number(t.pnl) > 0));
    const losses = matchingTrades.filter(t => t.outcome === 'loss' || (t.outcome !== 'win' && Number(t.pnl) < 0));
    const winRate = wins.length / matchingTrades.length;
    const avgWinR = wins.length > 0 ? wins.reduce((sum, t) => sum + (Number(t.rr) || 0), 0) / wins.length : 0;
    const avgLossR = losses.length > 0 ? losses.reduce((sum, t) => sum + (Number(t.rr) || 1), 0) / losses.length : 1;
    const expectancy = (winRate * avgWinR) - ((1 - winRate) * avgLossR);

    const formattedEdge = expectancy.toFixed(2);
    const formattedWR = Math.round(winRate * 100);

    if (expectancy >= 1.0) {
      resultStatus.textContent = `🟢 A+ SETUP (Edge: +${formattedEdge}R)`;
      resultStatus.style.color = 'var(--neon-green)';
      resultPanel.style.background = 'rgba(57, 255, 20, 0.06)';
      resultPanel.style.borderColor = 'rgba(57, 255, 20, 0.2)';
    } else if (expectancy >= 0.2) {
      resultStatus.textContent = `🟡 B SETUP (Edge: +${formattedEdge}R)`;
      resultStatus.style.color = '#f59e0b';
      resultPanel.style.background = 'rgba(245, 158, 11, 0.06)';
      resultPanel.style.borderColor = 'rgba(245, 158, 11, 0.2)';
    } else {
      resultStatus.textContent = `🔴 AVOID (Edge: ${formattedEdge}R)`;
      resultStatus.style.color = 'var(--neon-red)';
      resultPanel.style.background = 'rgba(255, 59, 59, 0.06)';
      resultPanel.style.borderColor = 'rgba(255, 59, 59, 0.2)';
    }

    resultStats.textContent = `Trades: ${matchingTrades.length} | Win Rate: ${formattedWR}% | Avg Win: ${avgWinR.toFixed(1)}R | Avg Loss: ${avgLossR.toFixed(1)}R`;
  };

  checkboxes.forEach(cb => {
    cb.addEventListener('change', updateCalcResult);
  });
}

function renderMistakeAnalyzerWidget(container, trades) {
  const card = el('div', 'strategy-lab-widget glass-card');
  card.style.flex = '1';
  card.style.minWidth = '280px';
  card.style.padding = 'var(--space-5)';
  container.appendChild(card);

  const title = el('h3', 'review-form-title', '🧠 Mistake Pattern Analyzer');
  title.style.margin = '0 0 var(--space-1) 0';
  card.appendChild(title);
  
  const desc = el('p', '', 'Quantify the actual financial cost of your psychological leaks.');
  desc.style.fontSize = 'var(--text-xs)';
  desc.style.color = 'var(--text-muted)';
  desc.style.margin = '0 0 var(--space-4) 0';
  card.appendChild(desc);

  // Calculate mistake-free streak
  let mistakeFreeStreak = 0;
  const recentFirst = [...trades].sort((a, b) => new Date(b.date) - new Date(a.date));
  for (const t of recentFirst) {
    const hasMistake = t.mistake && t.mistake !== '' && t.mistake !== 'none';
    if (!hasMistake) {
      mistakeFreeStreak++;
    } else {
      break;
    }
  }

  // Render streak banner
  const streakBanner = el('div', 'streak-trophy-banner');
  streakBanner.style.background = 'linear-gradient(135deg, rgba(168, 85, 247, 0.08), rgba(0, 212, 255, 0.08))';
  streakBanner.style.border = '1px solid rgba(168, 85, 247, 0.2)';
  streakBanner.style.borderRadius = 'var(--radius-md)';
  streakBanner.style.padding = 'var(--space-3)';
  streakBanner.style.marginBottom = 'var(--space-4)';
  streakBanner.style.display = 'flex';
  streakBanner.style.alignItems = 'center';
  streakBanner.style.gap = 'var(--space-3)';

  const fireEmoji = el('div', '', '🧘');
  fireEmoji.style.fontSize = '1.8rem';
  streakBanner.appendChild(fireEmoji);

  const streakInfo = el('div', '');
  const streakTitle = el('div', '', `Streak: ${mistakeFreeStreak} Mistake-Free Trades`);
  streakTitle.style.fontWeight = '800';
  streakTitle.style.fontSize = 'var(--text-xs)';
  streakTitle.style.color = 'var(--cyan)';
  streakInfo.appendChild(streakTitle);

  const streakDesc = el('div', '');
  streakDesc.style.fontSize = '10px';
  streakDesc.style.color = 'var(--text-muted)';
  if (mistakeFreeStreak >= 10) {
    streakDesc.textContent = 'Clean Trader achievement active! 🛡️';
  } else {
    streakDesc.textContent = `${10 - mistakeFreeStreak} more clean trades to unlock Clean Trader trophy!`;
  }
  streakInfo.appendChild(streakDesc);
  streakBanner.appendChild(streakInfo);
  card.appendChild(streakBanner);

  // Group mistakes & cost
  const mistakeStats = {};
  Object.keys(MISTAKE_LABELS).forEach(k => {
    mistakeStats[k] = { key: k, label: MISTAKE_LABELS[k], count: 0, totalLoss: 0 };
  });

  trades.forEach(t => {
    const m = t.mistake;
    if (m && mistakeStats[m]) {
      const pnl = Number(t.pnl) || 0;
      mistakeStats[m].count++;
      if (pnl < 0) {
        mistakeStats[m].totalLoss += Math.abs(pnl);
      }
    }
  });

  const sortedLeaks = Object.values(mistakeStats)
    .filter(m => m.count > 0)
    .sort((a, b) => b.totalLoss - a.totalLoss);

  if (sortedLeaks.length === 0) {
    const cleanNotice = el('div', 'clean-notice');
    cleanNotice.style.padding = 'var(--space-4)';
    cleanNotice.style.textAlign = 'center';
    cleanNotice.style.background = 'rgba(57, 255, 20, 0.03)';
    cleanNotice.style.border = '1px solid rgba(57, 255, 20, 0.1)';
    cleanNotice.style.borderRadius = 'var(--radius-md)';
    cleanNotice.style.fontSize = 'var(--text-xs)';
    cleanNotice.appendChild(el('p', '', '🟢 Flawless discipline! You have logged zero psychological leaks in your trade history. Keep executing cleanly!'));
    card.appendChild(cleanNotice);
    return;
  }

  // Leak leaderboard
  const list = el('div', 'leak-leaderboard');
  list.style.display = 'flex';
  list.style.flexDirection = 'column';
  list.style.gap = 'var(--space-2)';

  sortedLeaks.forEach((leak, idx) => {
    const row = el('div', 'leak-leaderboard-row');
    row.style.display = 'flex';
    row.style.justifyContent = 'space-between';
    row.style.alignItems = 'center';
    row.style.padding = 'var(--space-2) var(--space-3)';
    row.style.background = 'rgba(255, 255, 255, 0.01)';
    row.style.border = '1px solid rgba(255, 255, 255, 0.04)';
    row.style.borderRadius = 'var(--radius-md)';

    const left = el('div', '');
    left.style.display = 'flex';
    left.style.alignItems = 'center';
    left.style.gap = 'var(--space-2)';
    left.style.fontSize = '11px';

    const medal = el('span', '', idx === 0 ? '🩸' : idx === 1 ? '⚠️' : '▫️');
    left.appendChild(medal);
    left.appendChild(el('span', '', leak.label, 'font-weight: 700;'));
    left.appendChild(el('span', '', `(${leak.count}x)`, 'color: var(--text-muted); font-size: 9px;'));

    const right = el('div', '', formatCurrency(-leak.totalLoss), 'font-weight: 800; color: var(--neon-red); font-size: 11px;');

    row.appendChild(left);
    row.appendChild(right);
    list.appendChild(row);
  });

  card.appendChild(list);
}

function renderStrategyScorecardWidget(container, trades) {
  const title = el('h3', 'review-form-title', '📊 SMC Setup Scorecard');
  title.style.margin = '0 0 var(--space-1) 0';
  container.appendChild(title);
  
  const desc = el('p', '', 'Ranked performance breakdown of your confluences (Setups).');
  desc.style.fontSize = 'var(--text-xs)';
  desc.style.color = 'var(--text-muted)';
  desc.style.margin = '0 0 var(--space-4) 0';
  container.appendChild(desc);

  const scorecardData = {};
  trades.forEach(t => {
    if (!Array.isArray(t.confluences)) return;
    t.confluences.forEach(c => {
      if (!scorecardData[c]) {
        scorecardData[c] = {
          name: c,
          total: 0,
          wins: 0,
          losses: 0,
          totalRR: 0,
          winRR: 0,
          lossRR: 0,
          pnl: 0
        };
      }
      const item = scorecardData[c];
      item.total++;
      const pnl = Number(t.pnl) || 0;
      item.pnl += pnl;
      const rr = Number(t.rr) || 0;
      item.totalRR += rr;
      
      const isWin = t.outcome === 'win' || (t.outcome !== 'loss' && pnl > 0);
      const isLoss = t.outcome === 'loss' || (t.outcome !== 'win' && pnl < 0);
      if (isWin) {
        item.wins++;
        item.winRR += rr;
      } else if (isLoss) {
        item.losses++;
        item.lossRR += rr;
      }
    });
  });

  const scorecards = Object.values(scorecardData).map(item => {
    const winRate = item.total > 0 ? item.wins / item.total : 0;
    const avgWinR = item.wins > 0 ? item.winRR / item.wins : 0;
    const avgLossR = item.losses > 0 ? item.lossRR / item.losses : 1.0;
    const expectancy = (winRate * avgWinR) - ((1 - winRate) * avgLossR);
    const avgRR = item.total > 0 ? item.totalRR / item.total : 0;
    
    return {
      ...item,
      winRate: Math.round(winRate * 100),
      avgRR: parseFloat(avgRR.toFixed(2)),
      expectancy: parseFloat(expectancy.toFixed(2)),
    };
  }).sort((a, b) => b.expectancy - a.expectancy);

  if (scorecards.length === 0) {
    container.appendChild(el('p', 'review-empty-hint', 'No trades with confluence tags found. Start tagging setups to see this scorecard!'));
    return;
  }

  // Row with Table on left, Chart on right
  const splitRow = el('div', 'scorecard-split-row');
  splitRow.style.display = 'flex';
  splitRow.style.flexWrap = 'wrap';
  splitRow.style.gap = 'var(--space-6)';
  splitRow.style.marginTop = 'var(--space-4)';
  container.appendChild(splitRow);

  // Table on Left
  const tableWrap = el('div', 'scorecard-table-wrap');
  tableWrap.style.flex = '3';
  tableWrap.style.minWidth = '320px';
  splitRow.appendChild(tableWrap);

  const table = el('table', 'scorecard-table');
  table.style.width = '100%';
  table.style.borderCollapse = 'collapse';
  table.style.fontSize = 'var(--text-xs)';

  // Headers
  const thead = el('thead');
  const hRow = el('tr');
  hRow.style.borderBottom = '1px solid rgba(255,255,255,0.08)';
  ['Setup Type', 'Trades', 'Win Rate', 'Avg R:R', 'Expectancy', 'P&L'].forEach(h => {
    const th = el('th', '', h);
    th.style.padding = 'var(--space-3) var(--space-2)';
    th.style.textAlign = h === 'Setup Type' ? 'left' : 'right';
    th.style.color = 'var(--text-muted)';
    th.style.fontWeight = '700';
    hRow.appendChild(th);
  });
  thead.appendChild(hRow);
  table.appendChild(thead);

  const tbody = el('tbody');
  scorecards.forEach((row, idx) => {
    const tr = el('tr');
    tr.style.borderBottom = '1px solid rgba(255,255,255,0.04)';
    
    // Highlight Top 3 green / Bottom 3 red
    if (scorecards.length >= 2) {
      if (idx < 3 && row.expectancy > 0) {
        tr.style.background = 'rgba(57, 255, 20, 0.02)';
      } else if (idx >= scorecards.length - 3 && row.expectancy < 0) {
        tr.style.background = 'rgba(255, 59, 59, 0.02)';
      }
    }

    const cells = [
      { val: shortenConfluence(row.name), align: 'left', bold: true },
      { val: String(row.total), align: 'right' },
      { val: `${row.winRate}%`, align: 'right' },
      { val: `${row.avgRR}R`, align: 'right' },
      { val: `${row.expectancy >= 0 ? '+' : ''}${row.expectancy}R`, align: 'right', color: row.expectancy >= 0 ? 'var(--neon-green)' : 'var(--neon-red)' },
      { val: formatCurrency(row.pnl), align: 'right', color: row.pnl >= 0 ? 'var(--neon-green)' : 'var(--neon-red)' }
    ];

    cells.forEach(c => {
      const td = el('td', '', c.val);
      td.style.padding = 'var(--space-3) var(--space-2)';
      td.style.textAlign = c.align;
      if (c.bold) td.style.fontWeight = '700';
      if (c.color) td.style.color = c.color;
      tr.appendChild(td);
    });

    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  tableWrap.appendChild(table);

  // Chart on Right
  const chartWrap = el('div', 'scorecard-chart-wrap');
  chartWrap.style.flex = '2';
  chartWrap.style.minWidth = '280px';
  chartWrap.style.height = '240px';
  splitRow.appendChild(chartWrap);

  const canvas = document.createElement('canvas');
  canvas.id = 'chart-setup-winrate';
  chartWrap.appendChild(canvas);

  // Load and render chart
  requestAnimationFrame(() => {
    import('./charts.js').then(({ createSetupWinRateChart }) => {
      createSetupWinRateChart(
        'chart-setup-winrate',
        scorecards.map(s => shortenConfluence(s.name)),
        scorecards.map(s => s.winRate),
        scorecards.map(s => s.total)
      );
    });
  });
}

function renderSessionHeatmapWidget(container, trades) {
  const title = el('h3', 'review-form-title', '⏰ Session/Killzone Performance Heatmap');
  title.style.margin = '0 0 var(--space-1) 0';
  container.appendChild(title);
  
  const desc = el('p', '', 'Find your optimal trading times. Tap cells on mobile to view statistics.');
  desc.style.fontSize = 'var(--text-xs)';
  desc.style.color = 'var(--text-muted)';
  desc.style.margin = '0 0 var(--space-4) 0';
  container.appendChild(desc);

  const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const SESSIONS_LIST = ['Asia', 'London', 'New York', 'London Close', 'Overlap'];
  const dayNameMap = {
    1: 'Monday',
    2: 'Tuesday',
    3: 'Wednesday',
    4: 'Thursday',
    5: 'Friday',
    6: 'Saturday',
    0: 'Sunday'
  };

  const heatmapData = {};
  DAYS.forEach(day => {
    heatmapData[day] = {};
    SESSIONS_LIST.forEach(sess => {
      heatmapData[day][sess] = { total: 0, wins: 0, pnl: 0 };
    });
  });

  trades.forEach(t => {
    const d = new Date(t.date);
    const dayName = dayNameMap[d.getDay()];
    const sess = t.session || 'New York';
    if (heatmapData[dayName] && heatmapData[dayName][sess]) {
      const cell = heatmapData[dayName][sess];
      cell.total++;
      const pnl = Number(t.pnl) || 0;
      cell.pnl += pnl;
      const isWin = t.outcome === 'win' || (t.outcome !== 'loss' && pnl > 0);
      if (isWin) cell.wins++;
    }
  });

  // Mobile info panel
  const infoPanel = el('div', 'heatmap-mobile-info');
  infoPanel.style.marginTop = 'var(--space-4)';
  infoPanel.style.padding = 'var(--space-3)';
  infoPanel.style.borderRadius = 'var(--radius-md)';
  infoPanel.style.background = 'rgba(255,255,255,0.01)';
  infoPanel.style.border = '1px solid rgba(255,255,255,0.04)';
  infoPanel.style.fontSize = 'var(--text-xs)';
  infoPanel.style.textAlign = 'center';
  infoPanel.style.color = 'var(--text-muted)';
  infoPanel.textContent = '💡 Tap any cell in the grid to view detailed session parameters';

  // Grid wrapper
  const gridWrapper = el('div', 'heatmap-grid-wrapper');
  gridWrapper.style.overflowX = 'auto';
  gridWrapper.style.marginTop = 'var(--space-4)';
  container.appendChild(gridWrapper);

  const table = el('table', 'heatmap-table');
  table.style.width = '100%';
  table.style.borderCollapse = 'collapse';
  table.style.textAlign = 'center';
  table.style.fontSize = 'var(--text-xs)';

  // Headers
  const thead = el('thead');
  const hRow = el('tr');
  const emptyTh = el('th', '', 'Day / Session');
  emptyTh.style.padding = 'var(--space-2)';
  emptyTh.style.textAlign = 'left';
  emptyTh.style.color = 'var(--text-muted)';
  hRow.appendChild(emptyTh);

  SESSIONS_LIST.forEach(s => {
    const th = el('th', '', s);
    th.style.padding = 'var(--space-2)';
    th.style.color = 'var(--text-muted)';
    hRow.appendChild(th);
  });
  thead.appendChild(hRow);
  table.appendChild(thead);

  // Rows
  const tbody = el('tbody');
  DAYS.forEach(day => {
    const tr = el('tr');
    
    const dayTd = el('td', '', day);
    dayTd.style.fontWeight = '700';
    dayTd.style.textAlign = 'left';
    dayTd.style.padding = 'var(--space-2)';
    dayTd.style.borderRight = '1px solid rgba(255,255,255,0.06)';
    tr.appendChild(dayTd);

    SESSIONS_LIST.forEach(sess => {
      const cell = heatmapData[day][sess];
      const winRate = cell.total > 0 ? Math.round((cell.wins / cell.total) * 100) : null;
      
      const cellTd = el('td', 'heatmap-cell');
      cellTd.style.padding = 'var(--space-3)';
      cellTd.style.fontWeight = '800';
      cellTd.style.cursor = 'pointer';
      cellTd.style.transition = 'all 0.2s ease';

      if (winRate === null) {
        cellTd.textContent = '—';
        cellTd.style.background = 'rgba(255, 255, 255, 0.01)';
        cellTd.style.color = 'rgba(255,255,255,0.15)';
      } else {
        cellTd.textContent = `${winRate}%`;
        if (winRate >= 60) {
          cellTd.style.background = 'rgba(57, 255, 20, 0.15)';
          cellTd.style.color = 'var(--neon-green)';
          cellTd.style.border = '1px solid rgba(57, 255, 20, 0.3)';
        } else if (winRate >= 40) {
          cellTd.style.background = 'rgba(245, 158, 11, 0.15)';
          cellTd.style.color = '#f59e0b';
          cellTd.style.border = '1px solid rgba(245, 158, 11, 0.3)';
        } else {
          cellTd.style.background = 'rgba(255, 59, 59, 0.15)';
          cellTd.style.color = 'var(--neon-red)';
          cellTd.style.border = '1px solid rgba(255, 59, 59, 0.3)';
        }
      }

      // Interaction
      const cellDetails = () => {
        nativeHaptic('light');
        if (winRate === null) {
          infoPanel.innerHTML = `📅 <strong>${day} (${sess} Session):</strong><br>No trades taken yet during this session.`;
        } else {
          const sign = cell.pnl >= 0 ? '+' : '';
          const pnlColor = cell.pnl >= 0 ? 'var(--neon-green)' : 'var(--neon-red)';
          infoPanel.innerHTML = `
            📅 <strong>${day} (${sess} Session) Performance:</strong><br>
            • Total Trades Taken: <strong>${cell.total}</strong><br>
            • Win Rate achieved: <strong style="color: ${winRate >= 60 ? 'var(--neon-green)' : winRate >= 40 ? '#f59e0b' : 'var(--neon-red)'}">${winRate}%</strong><br>
            • Total PnL: <strong style="color: ${pnlColor}">${sign}${formatCurrency(cell.pnl)}</strong>
          `;
        }
      };

      cellTd.addEventListener('click', cellDetails);
      tr.appendChild(cellTd);
    });

    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  gridWrapper.appendChild(table);
  container.appendChild(infoPanel);
}

function renderEvolutionTimelineWidget(container, trades) {
  const title = el('h3', 'review-form-title', '📈 Strategy Evolution Timeline');
  title.style.margin = '0 0 var(--space-1) 0';
  container.appendChild(title);
  
  const desc = el('p', '', 'Month-over-month performance grade and structural trend timeline.');
  desc.style.fontSize = 'var(--text-xs)';
  desc.style.color = 'var(--text-muted)';
  desc.style.margin = '0 0 var(--space-4) 0';
  container.appendChild(desc);

  // Group by month
  const monthlyStats = {};
  trades.forEach(t => {
    const dateStr = t.date || (t.createdAt ? t.createdAt.slice(0, 10) : '');
    if (!dateStr) return;
    const monthKey = dateStr.slice(0, 7); // 'YYYY-MM'
    if (!monthlyStats[monthKey]) {
      monthlyStats[monthKey] = {
        key: monthKey,
        trades: [],
      };
    }
    monthlyStats[monthKey].trades.push(t);
  });

  const sortedMonths = Object.keys(monthlyStats).sort();
  if (sortedMonths.length === 0) {
    container.appendChild(el('p', 'review-empty-hint', 'No monthly data available.'));
    return;
  }

  // Calculate stats per month
  const timelineData = sortedMonths.map(month => {
    const mTrades = monthlyStats[month].trades;
    const stats = calculateStats(mTrades);
    
    // Calculate mistake rate
    const mistakes = mTrades.filter(t => t.mistake && t.mistake !== '' && t.mistake !== 'none').length;
    const mistakeRate = mTrades.length > 0 ? Math.round((mistakes / mTrades.length) * 100) : 0;
    
    // Expectancy
    const wins = mTrades.filter(t => t.outcome === 'win' || (t.outcome !== 'loss' && Number(t.pnl) > 0));
    const losses = mTrades.filter(t => t.outcome === 'loss' || (t.outcome !== 'win' && Number(t.pnl) < 0));
    const winRateVal = wins.length / mTrades.length;
    const avgWinR = wins.length > 0 ? wins.reduce((sum, t) => sum + (Number(t.rr) || 0), 0) / wins.length : 0;
    const avgLossR = losses.length > 0 ? losses.reduce((sum, t) => sum + (Number(t.rr) || 1), 0) / losses.length : 1;
    const expectancy = (winRateVal * avgWinR) - ((1 - winRateVal) * avgLossR);

    // Calculate Grade
    let grade = 'F';
    const wr = stats.winRate;
    const exp = expectancy;
    const mr = mistakeRate;
    const count = mTrades.length;

    if (count < 3) {
      grade = 'N/A';
    } else {
      if (wr >= 60 && mr <= 10 && exp >= 1.0) grade = 'A+';
      else if (wr >= 55 && mr <= 15 && exp >= 0.5) grade = 'A';
      else if (wr >= 45 && mr <= 20 && exp >= 0.2) grade = 'B';
      else if (wr >= 35 && mr <= 30 && exp >= 0.0) grade = 'C';
      else if (wr >= 25 && mr <= 40 && exp < 0.0) grade = 'D';
      else grade = 'F';
    }

    // Format label like "May 2026"
    const [year, monthNum] = month.split('-');
    const dateObj = new Date(Number(year), Number(monthNum) - 1, 1);
    const label = dateObj.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

    return {
      month,
      label,
      totalTrades: stats.totalTrades,
      winRate: stats.winRate,
      avgRR: stats.avgRR,
      expectancy: parseFloat(expectancy.toFixed(2)),
      mistakeRate,
      totalPnL: stats.totalPnL,
      grade
    };
  });

  // Render Grading Panel
  const currentMonth = timelineData[timelineData.length - 1];
  const prevMonth = timelineData.length > 1 ? timelineData[timelineData.length - 2] : null;

  const summaryRow = el('div', 'timeline-summary-row');
  summaryRow.style.display = 'flex';
  summaryRow.style.flexWrap = 'wrap';
  summaryRow.style.gap = 'var(--space-4)';
  summaryRow.style.marginBottom = 'var(--space-6)';
  container.appendChild(summaryRow);

  // Grade Widget Card
  const gradeCard = el('div', 'timeline-grade-card');
  gradeCard.style.flex = '1';
  gradeCard.style.minWidth = '240px';
  gradeCard.style.background = 'rgba(255, 255, 255, 0.01)';
  gradeCard.style.border = '1px solid rgba(255, 255, 255, 0.04)';
  gradeCard.style.borderRadius = 'var(--radius-lg)';
  gradeCard.style.padding = 'var(--space-4)';
  gradeCard.style.display = 'flex';
  gradeCard.style.alignItems = 'center';
  gradeCard.style.justifyContent = 'space-between';
  summaryRow.appendChild(gradeCard);

  const gradeLeft = el('div', '');
  gradeLeft.appendChild(el('div', '', 'Monthly Grade', 'font-size: 9px; color: var(--text-muted); text-transform: uppercase; font-weight: 700; letter-spacing: 0.06em;'));
  gradeLeft.appendChild(el('div', '', currentMonth.label, 'font-size: var(--text-md); font-weight: 800; color: var(--text-primary); margin-top: 4px;'));
  gradeCard.appendChild(gradeLeft);

  const gradeRight = el('div', 'grade-badge', currentMonth.grade);
  gradeRight.style.fontSize = '3rem';
  gradeRight.style.fontWeight = '900';
  gradeRight.style.fontFamily = 'var(--font-heading)';
  const gradeColor = currentMonth.grade.startsWith('A') ? 'var(--neon-green)' : currentMonth.grade.startsWith('B') ? 'var(--cyan)' : currentMonth.grade.startsWith('C') ? '#f59e0b' : currentMonth.grade.startsWith('N') ? 'var(--text-muted)' : 'var(--neon-red)';
  gradeRight.style.color = gradeColor;
  gradeRight.style.textShadow = `0 0 20px ${gradeColor}40`;
  gradeCard.appendChild(gradeRight);

  // Deltas Comparison Card
  const deltaCard = el('div', 'timeline-delta-card');
  deltaCard.style.flex = '2';
  deltaCard.style.minWidth = '280px';
  deltaCard.style.background = 'rgba(255, 255, 255, 0.01)';
  deltaCard.style.border = '1px solid rgba(255, 255, 255, 0.04)';
  deltaCard.style.borderRadius = 'var(--radius-lg)';
  deltaCard.style.padding = 'var(--space-4)';
  summaryRow.appendChild(deltaCard);

  deltaCard.appendChild(el('div', '', 'Month-Over-Month Delta', 'font-size: 9px; color: var(--text-muted); text-transform: uppercase; font-weight: 700; letter-spacing: 0.06em; margin-bottom: var(--space-3);'));

  if (!prevMonth) {
    const note = el('div', '', 'No previous month data to compare yet.');
    note.style.fontSize = 'var(--text-xs)';
    note.style.color = 'var(--text-muted)';
    deltaCard.appendChild(note);
  } else {
    const deltasList = el('div', '');
    deltasList.style.display = 'grid';
    deltasList.style.gridTemplateColumns = 'repeat(2, 1fr)';
    deltasList.style.gap = 'var(--space-2)';
    deltaCard.appendChild(deltasList);

    const wrDiff = currentMonth.winRate - prevMonth.winRate;
    const wrArrow = wrDiff >= 0 ? `▲ +${wrDiff}%` : `▼ ${wrDiff}%`;
    const wrColor = wrDiff >= 0 ? 'var(--neon-green)' : 'var(--neon-red)';
    const wrEl = el('div', '', 'Win Rate: ');
    wrEl.style.fontSize = 'var(--text-xs)';
    wrEl.style.color = 'var(--text-secondary)';
    const wrSpan = el('span', '', wrArrow);
    wrSpan.style.color = wrColor;
    wrSpan.style.fontWeight = '700';
    wrEl.appendChild(wrSpan);
    deltasList.appendChild(wrEl);

    const expDiff = currentMonth.expectancy - prevMonth.expectancy;
    const expArrow = expDiff >= 0 ? `▲ +${expDiff.toFixed(2)}R` : `▼ ${expDiff.toFixed(2)}R`;
    const expColor = expDiff >= 0 ? 'var(--neon-green)' : 'var(--neon-red)';
    const expEl = el('div', '', 'Expectancy: ');
    expEl.style.fontSize = 'var(--text-xs)';
    expEl.style.color = 'var(--text-secondary)';
    const expSpan = el('span', '', expArrow);
    expSpan.style.color = expColor;
    expSpan.style.fontWeight = '700';
    expEl.appendChild(expSpan);
    deltasList.appendChild(expEl);

    const mrDiff = currentMonth.mistakeRate - prevMonth.mistakeRate;
    const mrArrow = mrDiff <= 0 ? `▼ ${mrDiff}%` : `▲ +${mrDiff}%`;
    const mrColor = mrDiff <= 0 ? 'var(--neon-green)' : 'var(--neon-red)';
    const mrEl = el('div', '', 'Mistake Rate: ');
    mrEl.style.fontSize = 'var(--text-xs)';
    mrEl.style.color = 'var(--text-secondary)';
    const mrSpan = el('span', '', mrArrow);
    mrSpan.style.color = mrColor;
    mrSpan.style.fontWeight = '700';
    mrEl.appendChild(mrSpan);
    deltasList.appendChild(mrEl);

    const pnlDiff = currentMonth.totalPnL - prevMonth.totalPnL;
    const pnlArrow = pnlDiff >= 0 ? `▲ +$${pnlDiff.toFixed(2)}` : `▼ -$${Math.abs(pnlDiff).toFixed(2)}`;
    const pnlColor = pnlDiff >= 0 ? 'var(--neon-green)' : 'var(--neon-red)';
    const pnlEl = el('div', '', 'Net P&L: ');
    pnlEl.style.fontSize = 'var(--text-xs)';
    pnlEl.style.color = 'var(--text-secondary)';
    const pnlSpan = el('span', '', pnlArrow);
    pnlSpan.style.color = pnlColor;
    pnlSpan.style.fontWeight = '700';
    pnlEl.appendChild(pnlSpan);
    deltasList.appendChild(pnlEl);
  }

  // Render Evolution Chart Container
  const chartWrap = el('div', 'evolution-chart-container');
  chartWrap.style.height = '260px';
  chartWrap.style.marginTop = 'var(--space-4)';
  container.appendChild(chartWrap);

  const canvas = document.createElement('canvas');
  canvas.id = 'chart-strategy-evolution';
  chartWrap.appendChild(canvas);

  // Load and render
  requestAnimationFrame(() => {
    import('./charts.js').then(({ createEvolutionChart }) => {
      createEvolutionChart(
        'chart-strategy-evolution',
        timelineData.map(td => td.label),
        timelineData.map(td => td.winRate),
        timelineData.map(td => td.avgRR),
        timelineData.map(td => td.expectancy),
        timelineData.map(td => td.mistakeRate)
      );
    });
  });
}

