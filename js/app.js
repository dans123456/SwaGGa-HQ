/**
 * SwaGGa HQ — Main Application Controller
 * Builds shell DOM, welcome popup, mobile menu, dashboard with live stats.
 * SECURITY: All DOM via createElement + textContent. No innerHTML.
 */

import router from './router.js';
import { renderTradingPage } from './trading.js';
import { renderChartPage } from './trading.js';
import { renderLearningPage, getLessons, getAssignments } from './learning.js';
import { renderStreaksPage, getHabits, calculateStreak } from './streaks.js';
import { getTrades, calculateStats } from './trading.js';
import { getTimeAgo, formatCurrency } from './utils.js';
import storage from './storage.js';
import { checkAutoAssignment } from './notifications.js';

function el(tag, cls = '', text = '') {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text) node.textContent = text;
  return node;
}

const NAV_ITEMS = [
  { hash: '#dashboard', label: 'Dashboard', icon: '🏠' },
  { hash: '#streaks', label: 'Streaks', icon: '🔥' },
  { hash: '#trading', label: 'Trading', icon: '💹' },
  { hash: '#chart', label: 'Live Chart', icon: '📊' },
  { hash: '#learning', label: 'Learning', icon: '📚' },
];

/* ================================================================ */
/*  WELCOME POPUP                                                    */
/* ================================================================ */

function showWelcomePopup() {
  // Show once per browser session (not once ever)
  if (sessionStorage.getItem('swagga_greeted')) return;
  sessionStorage.setItem('swagga_greeted', '1');

  const pendingAssignments = getAssignments().filter(a => !a.completed);
  const greeting = getGreeting();
  const trades = getTrades();
  const tradeStats = calculateStats(trades);

  const overlay = el('div', 'welcome-modal-overlay');
  const modal = el('div', 'welcome-modal');

  // Top glow bar
  const glow = el('div', 'welcome-glow-bar');
  modal.appendChild(glow);

  modal.appendChild(el('span', 'welcome-modal__emoji', '🪖'));
  modal.appendChild(el('h2', 'welcome-modal__title', `${greeting}, SwaGGa`));

  // Quick stats row
  const statsRow = el('div', 'welcome-stats-row');
  const statData = [
    { icon: '📊', value: String(tradeStats.totalTrades), label: 'Trades' },
    { icon: '🎯', value: `${tradeStats.winRate}%`, label: 'Win Rate' },
    { icon: '📝', value: String(pendingAssignments.length), label: 'Pending' },
  ];
  statData.forEach(s => {
    const item = el('div', 'welcome-stat-item');
    item.appendChild(el('span', 'welcome-stat-icon', s.icon));
    item.appendChild(el('span', 'welcome-stat-value', s.value));
    item.appendChild(el('span', 'welcome-stat-label', s.label));
    statsRow.appendChild(item);
  });
  modal.appendChild(statsRow);

  // Pending assignment reminder
  if (pendingAssignments.length > 0) {
    const reminder = el('div', 'welcome-reminder');
    reminder.appendChild(el('span', 'welcome-reminder-icon', '🔔'));
    const reminderText = pendingAssignments.length === 1
      ? 'You have 1 pending assignment waiting!'
      : `You have ${pendingAssignments.length} pending assignments waiting!`;
    reminder.appendChild(el('span', 'welcome-reminder-text', reminderText));
    modal.appendChild(reminder);
  }

  // Action buttons
  const actions = el('div', 'welcome-actions');

  const goBtn = el('button', 'welcome-modal__btn', "Let's Go 🚀");
  goBtn.addEventListener('click', () => {
    overlay.style.opacity = '0';
    setTimeout(() => overlay.remove(), 300);
  });
  actions.appendChild(goBtn);

  if (pendingAssignments.length > 0) {
    const assignBtn = el('button', 'welcome-modal__btn welcome-modal__btn--outline', '📝 View Assignments');
    assignBtn.addEventListener('click', () => {
      overlay.style.opacity = '0';
      setTimeout(() => {
        overlay.remove();
        router.navigate('#learning');
      }, 300);
    });
    actions.appendChild(assignBtn);
  }

  modal.appendChild(actions);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
}

/* ================================================================ */
/*  DASHBOARD                                                        */
/* ================================================================ */

function renderDashboard(container) {
  container.replaceChildren();

  /* ---- Hero banner ---- */
  const hero = el('div', 'dashboard-hero');
  const greeting = getGreeting();
  hero.appendChild(el('h1', 'hero-title', `${greeting}, SwaGGa 🪖`));
  hero.appendChild(el('p', 'hero-subtitle', 'Your personal command centre for trading, learning, and daily streaks.'));

  const dateBadge = el('span', 'welcome-banner__date');
  const now = new Date();
  dateBadge.textContent = `📅 ${now.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })}`;
  hero.appendChild(dateBadge);
  container.appendChild(hero);

  /* ---- Live stats grid ---- */
  const trades = getTrades();
  const tradeStats = calculateStats(trades);
  const habits = getHabits();
  const activeStreaks = habits.filter(h => calculateStreak(h.id) > 0).length;
  const lessons = getLessons();
  const assignments = getAssignments();
  const completedAssignments = assignments.filter(a => a.completed).length;

  const statsGrid = el('div', 'stats-grid stagger-children');
  const statItems = [
    { icon: '📊', label: 'Total Trades', value: String(tradeStats.totalTrades) },
    { icon: '🎯', label: 'Win Rate', value: `${tradeStats.winRate}%` },
    { icon: '💰', label: 'Total P&L', value: formatCurrency(tradeStats.totalPnL) },
    { icon: '🔥', label: 'Active Streaks', value: `${activeStreaks}/${habits.length}` },
    { icon: '📚', label: 'Lessons Done', value: `${lessons.length}/33` },
    { icon: '📝', label: 'Assignments', value: `${completedAssignments}/${assignments.length}` },
  ];

  statItems.forEach(({ icon, label, value }) => {
    const card = el('div', 'stat-card');
    card.appendChild(el('span', 'stat-icon', icon));
    const info = el('div', 'stat-info');
    info.appendChild(el('span', 'stat-label', label));
    info.appendChild(el('span', 'stat-value', value));
    card.appendChild(info);
    statsGrid.appendChild(card);
  });
  container.appendChild(statsGrid);

  /* ---- Quick Actions ---- */
  const actions = el('div', 'quick-actions');
  const quickItems = [
    { icon: '📊', label: 'Log Trade', route: '#trading' },
    { icon: '📝', label: 'Start Quiz', route: '#learning' },
    { icon: '🔥', label: 'Mark Streaks', route: '#streaks' },
    { icon: '📚', label: 'Log Lesson', route: '#learning' },
  ];
  quickItems.forEach(({ icon, label, route }) => {
    const btn = el('button', 'quick-action');
    btn.appendChild(el('span', 'quick-action__icon', icon));
    btn.appendChild(document.createTextNode(` ${label}`));
    btn.addEventListener('click', () => router.navigate(route));
    actions.appendChild(btn);
  });
  container.appendChild(actions);

  /* ---- Two-column bottom: Activity Feed + Overview Panels ---- */
  const bottomGrid = el('div', 'dashboard-bottom-grid');

  /* -- Recent Activity Feed -- */
  const activitySection = el('div', 'dashboard-section');
  const actHeader = el('div', 'dashboard-section__header');
  actHeader.appendChild(el('h2', 'dashboard-section__title', 'Recent Activity'));
  activitySection.appendChild(actHeader);

  const actList = el('div', 'activity-feed__list');
  const activityItems = buildActivityItems(trades, lessons, habits);

  if (activityItems.length === 0) {
    actList.appendChild(el('p', 'empty-hint', 'No activity yet. Start trading, learning, or marking streaks!'));
  } else {
    activityItems.slice(0, 8).forEach((item, idx) => {
      const row = el('div', 'activity-item');

      // Dot
      const dotWrap = el('div', 'activity-item__dot-wrap');
      const dot = el('div', `activity-item__dot activity-item__dot--${item.color}`);
      dotWrap.appendChild(dot);
      if (idx < Math.min(activityItems.length, 8) - 1) {
        dotWrap.appendChild(el('div', 'activity-item__line'));
      }
      row.appendChild(dotWrap);

      // Content
      const content = el('div', 'activity-item__content');
      content.appendChild(el('div', 'activity-item__title', item.title));
      content.appendChild(el('div', 'activity-item__desc', item.desc));
      row.appendChild(content);

      // Time
      row.appendChild(el('span', 'activity-item__time', item.timeAgo));
      actList.appendChild(row);
    });
  }
  activitySection.appendChild(actList);
  bottomGrid.appendChild(activitySection);

  /* -- Overview Panels Column -- */
  const panelsCol = el('div', 'dashboard-panels-col');

  // Trading Overview
  const tradingPanel = el('div', 'overview-panel');
  tradingPanel.appendChild(el('h3', 'overview-panel__title', '📊 Trading Overview'));

  if (trades.length > 0) {
    const pnlValues = trades.map(t => Number(t.pnl) || 0);
    const bestTrade = Math.max(...pnlValues);
    const worstTrade = Math.min(...pnlValues);

    const tGrid = el('div', 'overview-stats-grid');
    const tItems = [
      { label: 'Win Rate', value: `${tradeStats.winRate}%` },
      { label: 'Total P&L', value: formatCurrency(tradeStats.totalPnL) },
      { label: 'Best Trade', value: formatCurrency(bestTrade) },
      { label: 'Worst Trade', value: formatCurrency(worstTrade) },
    ];
    tItems.forEach(({ label, value }) => {
      const item = el('div', 'overview-stat');
      item.appendChild(el('span', 'overview-stat__label', label));
      item.appendChild(el('span', 'overview-stat__value', value));
      tGrid.appendChild(item);
    });
    tradingPanel.appendChild(tGrid);
  } else {
    tradingPanel.appendChild(el('p', 'empty-hint', 'No trades logged yet'));
  }
  panelsCol.appendChild(tradingPanel);

  // Learning Progress
  const learnPanel = el('div', 'overview-panel');
  learnPanel.appendChild(el('h3', 'overview-panel__title', '📚 Learning Progress'));

  const conceptSet = new Set();
  lessons.forEach(l => {
    if (l.concepts) l.concepts.forEach(c => conceptSet.add(c));
  });

  const lGrid = el('div', 'overview-stats-grid');
  const lItems = [
    { label: 'Lessons', value: `${lessons.length}/33` },
    { label: 'Concepts', value: String(conceptSet.size) },
    { label: 'Assignments', value: `${completedAssignments}/${assignments.length}` },
    { label: 'Progress', value: `${Math.round((lessons.length / 33) * 100)}%` },
  ];
  lItems.forEach(({ label, value }) => {
    const item = el('div', 'overview-stat');
    item.appendChild(el('span', 'overview-stat__label', label));
    item.appendChild(el('span', 'overview-stat__value', value));
    lGrid.appendChild(item);
  });
  learnPanel.appendChild(lGrid);

  // Progress bar
  const progBar = el('div', 'overview-progress-bar');
  const progFill = el('div', 'overview-progress-fill');
  progFill.style.width = `${Math.round((lessons.length / 33) * 100)}%`;
  progBar.appendChild(progFill);
  learnPanel.appendChild(progBar);

  panelsCol.appendChild(learnPanel);
  bottomGrid.appendChild(panelsCol);

  container.appendChild(bottomGrid);

  /* ---- Quick-link cards ---- */
  const grid = el('div', 'dashboard-grid');
  const cards = [
    { icon: '📊', title: 'Trading Journal', desc: 'Log trades, track P&L, and analyse your performance.', route: '#trading' },
    { icon: '📚', title: 'Learning Hub', desc: 'Follow the Brad Goh curriculum and complete assignments.', route: '#learning' },
    { icon: '🔥', title: 'Streaks', desc: 'Build habits and maintain daily streaks.', route: '#streaks' },
  ];

  cards.forEach(({ icon, title, desc, route }) => {
    const card = el('div', 'dash-card');
    card.appendChild(el('span', 'dash-card-icon', icon));
    card.appendChild(el('h3', 'dash-card-title', title));
    card.appendChild(el('p', 'dash-card-desc', desc));
    card.style.cursor = 'pointer';
    card.addEventListener('click', () => router.navigate(route));
    grid.appendChild(card);
  });
  container.appendChild(grid);
}

/** Build a sorted list of recent activity items from all modules. */
function buildActivityItems(trades, lessons, habits) {
  const items = [];

  // Trades
  trades.forEach(t => {
    const isWin = (t.outcome === 'win' || Number(t.pnl) > 0);
    items.push({
      title: `${isWin ? '✅' : '❌'} ${t.asset} — ${t.direction || 'trade'}`,
      desc: `P&L: ${formatCurrency(Number(t.pnl) || 0)} | ${t.outcome || 'closed'}`,
      color: isWin ? 'green' : 'red',
      date: t.createdAt || t.date,
      timeAgo: getTimeAgo(t.createdAt || t.date),
    });
  });

  // Lessons
  lessons.forEach(l => {
    items.push({
      title: `📖 Lesson logged`,
      desc: l.title || `Episode ${l.episodeId}`,
      color: 'cyan',
      date: l.date || l.loggedAt,
      timeAgo: getTimeAgo(l.date || l.loggedAt),
    });
  });

  // Today's streak completions
  const today = new Date().toISOString().slice(0, 10);
  habits.forEach(h => {
    if (h.log && h.log[today]) {
      items.push({
        title: `${h.emoji || '✅'} ${h.name} streak`,
        desc: `Day checked — streak: ${calculateStreak(h.id)} days`,
        color: 'purple',
        date: today,
        timeAgo: 'Today',
      });
    }
  });

  // Sort newest first
  items.sort((a, b) => {
    const da = new Date(a.date || 0).getTime();
    const db = new Date(b.date || 0).getTime();
    return db - da;
  });

  return items;
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good Morning';
  if (hour < 17) return 'Good Afternoon';
  return 'Good Evening';
}

/* ================================================================ */
/*  BUILD APP SHELL                                                  */
/* ================================================================ */

function buildAppShell() {
  const app = document.getElementById('app');
  if (!app) return;
  app.replaceChildren();

  // ---- Mobile hamburger ----
  const menuBtn = el('button', 'mobile-menu-btn', '☰');
  menuBtn.setAttribute('aria-label', 'Open menu');
  app.appendChild(menuBtn);

  // ---- Overlay ----
  const overlay = el('div', 'sidebar-overlay');
  app.appendChild(overlay);

  // ---- Sidebar ----
  const sidebar = el('div', 'sidebar');
  sidebar.id = 'sidebar';

  const brand = el('div', 'sidebar-brand');
  brand.appendChild(el('span', 'brand-logo', '🪖'));
  brand.appendChild(el('span', 'brand-text', 'SwaGGa HQ'));
  sidebar.appendChild(brand);

  const nav = el('nav', 'sidebar-nav');
  NAV_ITEMS.forEach(({ hash, label, icon }) => {
    const item = el('button', 'nav-item');
    item.setAttribute('data-route', hash);
    item.setAttribute('aria-label', label);
    item.appendChild(el('span', 'nav-icon', icon));
    item.appendChild(el('span', 'nav-label', label));
    item.addEventListener('click', () => {
      router.navigate(hash);
      closeMobileMenu();
    });
    nav.appendChild(item);
  });
  sidebar.appendChild(nav);

  const collapseBtn = el('button', 'sidebar-collapse-btn', '◀');
  collapseBtn.setAttribute('aria-label', 'Toggle sidebar');
  collapseBtn.addEventListener('click', () => {
    sidebar.classList.toggle('collapsed');
    collapseBtn.textContent = sidebar.classList.contains('collapsed') ? '▶' : '◀';
  });
  sidebar.appendChild(collapseBtn);

  app.appendChild(sidebar);

  // ---- Main content ----
  const main = el('main', 'main-content');
  main.id = 'main-content';

  const pages = ['dashboard', 'streaks', 'trading', 'chart', 'learning'];
  pages.forEach((page) => {
    const pageEl = el('div', 'page');
    pageEl.id = `page-${page}`;
    main.appendChild(pageEl);
  });

  app.appendChild(main);

  // ---- Mobile menu logic ----
  function openMobileMenu() {
    sidebar.classList.add('open');
    overlay.classList.add('visible');
    menuBtn.textContent = '✕';
  }

  function closeMobileMenu() {
    sidebar.classList.remove('open');
    overlay.classList.remove('visible');
    menuBtn.textContent = '☰';
  }

  menuBtn.addEventListener('click', () => {
    if (sidebar.classList.contains('open')) {
      closeMobileMenu();
    } else {
      openMobileMenu();
    }
  });

  overlay.addEventListener('click', closeMobileMenu);
}

/* ================================================================ */
/*  INIT                                                             */
/* ================================================================ */

function init() {
  buildAppShell();

  router.registerRoute('#dashboard', renderDashboard);
  router.registerRoute('#trading', renderTradingPage);
  router.registerRoute('#chart', renderChartPage);
  router.registerRoute('#learning', renderLearningPage);
  router.registerRoute('#streaks', renderStreaksPage);

  router.init();
  showWelcomePopup();

  // Auto-assignment check — fires popup on scheduled days
  checkAutoAssignment();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
