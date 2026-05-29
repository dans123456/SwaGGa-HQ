/**
 * SwaGGa HQ — Main Application Controller
 * Builds shell DOM, welcome popup, mobile menu, dashboard with live stats.
 * SECURITY: All DOM via createElement + textContent. No innerHTML.
 */

import router from './router.js';
import { renderTradingPage } from './trading.js';
import { renderChartPage } from './trading.js';
import { renderLearningPage, getLessons, getAssignments } from './learning.js';
import { renderStreaksPage, getHabits, calculateStreak, initStreakNotifications } from './streaks.js';
import { getTrades, calculateStats } from './trading.js';
import { getTimeAgo, formatCurrency } from './utils.js';
import storage from './storage.js';
import { checkAutoAssignment } from './notifications.js';
import { onAuthChange, signInWithGoogle, firebaseSignOut, syncNow, pushToCloud, getCurrentUser } from './firebase-sync.js';

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

let _killzonesInterval = null;

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
/*  ICT KILLZONES HELPERS & CONSTANTS                                */
/* ================================================================ */

const SESSIONS = [
  { name: 'Asian', start: 20, end: 24, label: 'Asian Killzone', nyRange: '8:00 PM - 12:00 AM' },
  { name: 'London', start: 2, end: 5, label: 'London Killzone', nyRange: '2:00 AM - 5:00 AM' },
  { name: 'New York', start: 7, end: 10, label: 'New York Killzone', nyRange: '7:00 AM - 10:00 AM' },
  { name: 'London Close', start: 10, end: 12, label: 'London Close Killzone', nyRange: '10:00 AM - 12:00 PM' }
];

const PREP_CHECKLISTS = {
  'Asian': [
    'Mark Higher Time Frame (Daily/H4) structure and swing points.',
    'Draw current Premium vs Discount zones (Fibonacci 50% equilibrium).',
    'Check high-impact news releases for AUD, NZD, and JPY pairs.',
    'Identify major resting buy-stop and sell-stop liquidity pools.'
  ],
  'London': [
    'Check High-Impact News Calendar (GBP, EUR, USD news).',
    'Locate Asian Session High/Low (major liquidity sweep targets).',
    'Identify H4/H1 key Order Blocks and Fair Value Gaps.',
    'Watch for the London Judas Swing (fake breakout against HTF bias).'
  ],
  'New York': [
    'Check High-Impact USD News releases (e.g. 8:30 AM EST news).',
    'Mark Asian Session High/Low and London Session High/Low.',
    'Confirm that HTF directional bias aligns with lower timeframe entries.',
    'Wait for London Session high/low mitigation or liquidity sweeps.'
  ],
  'London Close': [
    'Identify the day\'s overall trend (expansion vs reversal profile).',
    'Look for key retracements back into NY Session Fair Value Gaps.',
    'Check if daily profit target has been achieved (avoid over-trading).',
    'Review logged trades and prepare to write lessons in the journal.'
  ],
  'General': [
    'Confirm your HTF (Daily/H4) bias is established.',
    'Mark key supply/demand zones and Fair Value Gaps on your chart.',
    'Ensure you are only executing trades within valid session hours.',
    'Verify that your risk per trade is strictly capped (e.g. 1% maximum).'
  ]
};

function isSessionActive(nyHours, start, end) {
  if (start < end) {
    return nyHours >= start && nyHours < end;
  } else {
    return nyHours >= start || nyHours < end;
  }
}

function getConvertedLocalRange(nyStartHour, nyEndHour) {
  try {
    const now = new Date();
    
    // Get timezone offset difference in ms
    const localTime = new Date();
    const nyTimeStr = localTime.toLocaleString("en-US", { timeZone: "America/New_York" });
    const nyTime = new Date(nyTimeStr);
    const diffMs = localTime.getTime() - nyTime.getTime();
    
    // Format today in NY (MM/DD/YYYY)
    const nyDateStr = now.toLocaleDateString("en-US", { timeZone: "America/New_York" });
    const [m, d, y] = nyDateStr.split('/');
    
    const startNY = new Date(y, m - 1, d, nyStartHour, 0, 0);
    const endNY = new Date(y, m - 1, d, nyEndHour, 0, 0);
    
    if (nyEndHour <= nyStartHour) {
      endNY.setDate(endNY.getDate() + 1);
    }
    
    const localStart = new Date(startNY.getTime() + diffMs);
    const localEnd = new Date(endNY.getTime() + diffMs);
    
    const formatTime = (date) => {
      let hours = date.getHours();
      const minutes = String(date.getMinutes()).padStart(2, '0');
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12;
      hours = hours ? hours : 12; // the hour '0' should be '12'
      return `${hours}:${minutes} ${ampm}`;
    };
    
    return `${formatTime(localStart)} - ${formatTime(localEnd)}`;
  } catch (err) {
    const pad = (h) => String(h).padStart(2, '0');
    return `${pad(nyStartHour)}:00 - ${pad(nyEndHour)}:00 NY`;
  }
}

function getChecklistState(sessionKey) {
  return storage.get(`killzone_prep_${sessionKey}`, {});
}

function saveChecklistState(sessionKey, state) {
  storage.set(`killzone_prep_${sessionKey}`, state);
}

function renderChecklist(container, sessionKey) {
  container.replaceChildren();
  const list = PREP_CHECKLISTS[sessionKey] || PREP_CHECKLISTS['General'];
  const savedState = getChecklistState(sessionKey);

  const title = el('h4', 'prep-checklist__title', `📝 ${sessionKey} Session Prep`);
  container.appendChild(title);

  const listEl = el('ul', 'prep-checklist');
  list.forEach((item, idx) => {
    const li = el('li', 'prep-item');
    const label = el('label', 'prep-item__label');
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.className = 'prep-item__checkbox';
    cb.checked = !!savedState[idx];
    
    cb.addEventListener('change', () => {
      const currentState = getChecklistState(sessionKey);
      currentState[idx] = cb.checked;
      saveChecklistState(sessionKey, currentState);
      if (cb.checked) {
        li.classList.add('prep-item--completed');
      } else {
        li.classList.remove('prep-item--completed');
      }
    });

    if (cb.checked) {
      li.classList.add('prep-item--completed');
    }

    label.appendChild(cb);
    label.appendChild(el('span', 'prep-item__text', item));
    li.appendChild(label);
    listEl.appendChild(li);
  });
  container.appendChild(listEl);
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

  // ---- ICT Killzones widget ----
  const killzonesPanel = el('div', 'overview-panel killzones-panel');
  killzonesPanel.appendChild(el('h3', 'overview-panel__title', '⚡ ICT Killzones & Session Prep'));

  // Clock row
  const clockRow = el('div', 'kz-clocks');
  
  const nyClock = el('div', 'kz-clock');
  nyClock.appendChild(el('span', 'kz-clock__label', 'New York Time'));
  const nyClockTime = el('span', 'kz-clock__value kz-clock__value--ny', '00:00:00');
  nyClock.appendChild(nyClockTime);
  
  const localClock = el('div', 'kz-clock');
  localClock.appendChild(el('span', 'kz-clock__label', 'Local Time'));
  const localClockTime = el('span', 'kz-clock__value kz-clock__value--local', '00:00:00');
  localClock.appendChild(localClockTime);
  
  clockRow.appendChild(nyClock);
  clockRow.appendChild(localClock);
  killzonesPanel.appendChild(clockRow);

  // Sessions list
  const sessionsList = el('div', 'kz-sessions');
  killzonesPanel.appendChild(sessionsList);

  // Active checklist container
  const checklistContainer = el('div', 'kz-checklist-container');
  killzonesPanel.appendChild(checklistContainer);

  panelsCol.appendChild(killzonesPanel);

  let lastActiveSession = null;

  function updateKillzonesWidget() {
    const pageDashboard = document.getElementById('page-dashboard');
    if (!pageDashboard || pageDashboard.style.display === 'none') {
      return;
    }

    const now = new Date();
    
    // Update digital clocks
    const nyTimeStr = now.toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour12: false });
    const localTimeStr = now.toLocaleTimeString('en-US', { hour12: false });
    
    nyClockTime.textContent = nyTimeStr;
    localClockTime.textContent = localTimeStr;

    // Get current NY time details
    const nyLocaleStr = now.toLocaleString("en-US", { timeZone: "America/New_York" });
    const nyTime = new Date(nyLocaleStr);
    const nyHours = nyTime.getHours();

    // Determine active session
    let currentActiveSession = 'General';
    sessionsList.replaceChildren();

    SESSIONS.forEach(s => {
      const active = isSessionActive(nyHours, s.start, s.end);
      if (active) {
        currentActiveSession = s.name;
      }

      const item = el('div', `kz-session-item${active ? ' kz-session-item--active' : ''}`);
      
      const details = el('div', 'kz-session-item__details');
      details.appendChild(el('span', 'kz-session-item__name', s.label));
      
      const localRange = getConvertedLocalRange(s.start, s.end);
      details.appendChild(el('span', 'kz-session-item__times', `NY: ${s.nyRange} | Local: ${localRange}`));
      
      item.appendChild(details);
      
      const badge = el('span', `kz-session-item__badge ${active ? 'kz-session-badge--active' : 'kz-session-badge--inactive'}`);
      badge.textContent = active ? 'ACTIVE ⚡' : 'INACTIVE';
      item.appendChild(badge);

      sessionsList.appendChild(item);
    });

    if (currentActiveSession !== lastActiveSession) {
      lastActiveSession = currentActiveSession;
      renderChecklist(checklistContainer, currentActiveSession);
    }
  }

  // Clear any old interval first to prevent leakage
  if (_killzonesInterval) {
    clearInterval(_killzonesInterval);
  }
  
  // Initial run and start interval
  updateKillzonesWidget();
  _killzonesInterval = setInterval(updateKillzonesWidget, 1000);

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

  // ---- Cloud Sync section ----
  const syncSection = el('div', 'sidebar-sync');
  const syncDivider = el('div', 'sidebar-divider');
  syncSection.appendChild(syncDivider);

  // Signed-out state
  const signInBtn = el('button', 'sidebar-sync__btn', '☁️ Sign In to Sync');
  signInBtn.addEventListener('click', async () => {
    signInBtn.textContent = '⏳ Signing in...';
    signInBtn.disabled = true;
    const user = await signInWithGoogle();
    if (!user) {
      signInBtn.textContent = '☁️ Sign In to Sync';
      signInBtn.disabled = false;
    }
  });
  syncSection.appendChild(signInBtn);

  // Signed-in state (hidden initially)
  const userRow = el('div', 'sidebar-sync__user');
  userRow.style.display = 'none';

  const userAvatar = document.createElement('img');
  userAvatar.className = 'sidebar-sync__avatar';
  userAvatar.alt = 'User';
  userRow.appendChild(userAvatar);

  const userName = el('span', 'sidebar-sync__name');
  userRow.appendChild(userName);
  syncSection.appendChild(userRow);

  // Sync button
  const syncBtn = el('button', 'sidebar-sync__sync-btn', '🔄 Sync Now');
  syncBtn.style.display = 'none';
  syncBtn.addEventListener('click', async () => {
    syncBtn.textContent = '⏳ Syncing...';
    syncBtn.disabled = true;
    const result = await syncNow();
    syncBtn.textContent = result.success ? '✅ Synced!' : '❌ Sync failed';
    syncBtn.disabled = false;
    setTimeout(() => { syncBtn.textContent = '🔄 Sync Now'; }, 2000);
    if (result.success) {
      // Refresh current page to show synced data
      router.init();
    }
  });
  syncSection.appendChild(syncBtn);

  // Sign out
  const signOutBtn = el('button', 'sidebar-sync__signout', 'Sign Out');
  signOutBtn.style.display = 'none';
  signOutBtn.addEventListener('click', async () => {
    await firebaseSignOut();
  });
  syncSection.appendChild(signOutBtn);

  // Listen for auth changes
  onAuthChange(async (user) => {
    if (user) {
      signInBtn.style.display = 'none';
      userRow.style.display = 'flex';
      syncBtn.style.display = 'block';
      signOutBtn.style.display = 'block';
      userAvatar.src = user.photoURL || '';
      userName.textContent = user.displayName || user.email || 'User';

      // Auto-sync on sign in
      syncBtn.textContent = '⏳ Syncing...';
      const result = await syncNow();
      syncBtn.textContent = result.success ? '✅ Synced!' : '🔄 Sync Now';
      if (result.success) {
        setTimeout(() => { syncBtn.textContent = '🔄 Sync Now'; }, 2000);
        router.init();
      }
    } else {
      signInBtn.style.display = 'block';
      userRow.style.display = 'none';
      syncBtn.style.display = 'none';
      signOutBtn.style.display = 'none';
    }
  });

  sidebar.appendChild(syncSection);

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
/*  LOGIN SCREEN                                                      */
/* ================================================================ */

function showLoginScreen() {
  const appRoot = document.getElementById('app');
  appRoot.replaceChildren();

  const screen = el('div', 'login-screen');

  // Background glow effects
  const glow1 = el('div', 'login-glow login-glow--1');
  const glow2 = el('div', 'login-glow login-glow--2');
  screen.appendChild(glow1);
  screen.appendChild(glow2);

  const card = el('div', 'login-card');

  // Logo
  const logoWrap = el('div', 'login-logo');
  logoWrap.appendChild(el('span', 'login-logo__icon', '🪖'));
  card.appendChild(logoWrap);

  // Title
  card.appendChild(el('h1', 'login-title', 'SwaGGa HQ'));
  card.appendChild(el('p', 'login-subtitle', 'Your personal command center for trading, learning & daily streaks'));

  // Features list
  const features = el('div', 'login-features');
  const featureItems = [
    { icon: '📊', text: 'Track your trades & analytics' },
    { icon: '📚', text: 'Learn from Brah Goh & Boss Ackah' },
    { icon: '🔥', text: 'Build daily streaks & habits' },
    { icon: '☁️', text: 'Sync across all your devices' },
  ];
  featureItems.forEach(({ icon, text }) => {
    const item = el('div', 'login-feature');
    item.appendChild(el('span', 'login-feature__icon', icon));
    item.appendChild(el('span', 'login-feature__text', text));
    features.appendChild(item);
  });
  card.appendChild(features);

  // Google Sign-In button
  const googleBtn = el('button', 'login-google-btn');
  const gIcon = el('span', 'login-google-btn__icon', '🔐');
  const gText = el('span', 'login-google-btn__text', 'Sign in with Google');
  googleBtn.appendChild(gIcon);
  googleBtn.appendChild(gText);

  googleBtn.addEventListener('click', async () => {
    gText.textContent = 'Signing in...';
    googleBtn.disabled = true;
    googleBtn.classList.add('login-google-btn--loading');
    const user = await signInWithGoogle();
    if (!user) {
      gText.textContent = 'Sign in with Google';
      googleBtn.disabled = false;
      googleBtn.classList.remove('login-google-btn--loading');
    }
    // onAuthChange will handle the rest
  });
  card.appendChild(googleBtn);

  // Offline fallback
  const skipBtn = el('button', 'login-skip', 'Use offline — data syncs when you sign in later');
  skipBtn.addEventListener('click', () => {
    launchApp();
  });
  card.appendChild(skipBtn);

  screen.appendChild(card);
  appRoot.appendChild(screen);
}

/* ================================================================ */
/*  APP LAUNCH (after login or skip)                                  */
/* ================================================================ */

let _appLaunched = false;

async function launchApp() {
  if (_appLaunched) return;
  _appLaunched = true;

  buildAppShell();

  router.registerRoute('#dashboard', renderDashboard);
  router.registerRoute('#trading', renderTradingPage);
  router.registerRoute('#chart', renderChartPage);
  router.registerRoute('#learning', renderLearningPage);
  router.registerRoute('#streaks', renderStreaksPage);

  router.init();
  showWelcomePopup();
  checkAutoAssignment();
  initStreakNotifications();

  // Auto-save to cloud every 30 seconds if signed in
  setInterval(async () => {
    const user = getCurrentUser();
    if (user) {
      await pushToCloud();
    }
  }, 30000);
}

/* ================================================================ */
/*  INIT                                                             */
/* ================================================================ */

function init() {
  // Show login screen first
  showLoginScreen();

  // When auth state resolves, either launch app or stay on login
  onAuthChange(async (user) => {
    if (user && !_appLaunched) {
      // Signed in — sync from cloud then launch
      await syncNow();
      launchApp();
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
