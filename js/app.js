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
import { getXPData, getLevel, getLevelProgress, getTitle, LEVELS, addXP } from './xp.js';
import { renderCalendarPage } from './calendar.js';

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
  { hash: '#calendar', label: 'Calendar', icon: '📅' },
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
  const _todayKey = (() => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}-${String(n.getDate()).padStart(2,'0')}`; })();
  const todayDone = habits.filter(h => h.log && h.log[_todayKey]).length;
  const lessons = getLessons();
  const assignments = getAssignments();
  const completedAssignments = assignments.filter(a => a.completed).length;

  const statsGrid = el('div', 'stats-grid stagger-children');
  const statItems = [
    { icon: '📊', label: 'Total Trades', value: String(tradeStats.totalTrades) },
    { icon: '🎯', label: 'Win Rate', value: `${tradeStats.winRate}%` },
    { icon: '💰', label: 'Total P&L', value: formatCurrency(tradeStats.totalPnL) },
    { icon: '🔥', label: 'Done Today', value: `${todayDone}/${habits.length}` },
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

  // Weekly Recap quick action
  const recapBtn = el('button', 'quick-action');
  recapBtn.appendChild(el('span', 'quick-action__icon', '📊'));
  recapBtn.appendChild(document.createTextNode(' Weekly Recap'));
  recapBtn.addEventListener('click', () => renderWeeklyRecap());
  actions.appendChild(recapBtn);

  container.appendChild(actions);

  /* ---- Two-column bottom: balanced Left Column vs. Right Column ---- */
  const bottomGrid = el('div', 'dashboard-bottom-grid');

  /* -- Left Column: Activity Feed + Achievements -- */
  const leftCol = el('div', 'dashboard-left-col stagger-children');

  // Recent Activity Feed
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
  leftCol.appendChild(activitySection);

  // Trophy Room (Achievements)
  const achievementsSection = el('div', 'dashboard-section achievements-section');
  achievementsSection.appendChild(el('h2', 'dashboard-section__title', '🏆 Trophy Room'));
  renderAchievementBadges(achievementsSection, trades, tradeStats, lessons, habits);
  leftCol.appendChild(achievementsSection);

  bottomGrid.appendChild(leftCol);

  /* -- Right Column: Rank, Clocks, combined stats overview -- */
  const panelsCol = el('div', 'dashboard-panels-col stagger-children');

  // 1. Rank & Level Progression Card
  const rankPanel = el('div', 'overview-panel rank-panel');
  rankPanel.appendChild(el('h3', 'overview-panel__title', '🎖️ Rank & Progression'));
  
  const lvl = getLevel();
  const prog = getLevelProgress();
  const xpData = getXPData();

  const rankRow = el('div', 'rank-card-row');
  const rankEmoji = el('span', 'rank-card-emoji', lvl.emoji);
  rankRow.appendChild(rankEmoji);

  const rankMeta = el('div', 'rank-card-meta');
  rankMeta.appendChild(el('span', 'rank-card-title', lvl.title));
  rankMeta.appendChild(el('span', 'rank-card-level', `Level ${lvl.level}`));
  rankRow.appendChild(rankMeta);
  rankPanel.appendChild(rankRow);

  const rankXpTrack = el('div', 'rank-xp-track');
  const rankXpFill = el('div', 'rank-xp-fill');
  rankXpFill.style.width = `${Math.round(prog.progress * 100)}%`;
  rankXpTrack.appendChild(rankXpFill);
  rankPanel.appendChild(rankXpTrack);

  const rankXpFooter = el('div', 'rank-xp-footer');
  rankXpFooter.appendChild(el('span', 'rank-xp-text', prog.progress >= 1 ? `${xpData.totalXP} XP (MAX)` : `${xpData.totalXP} / ${prog.next} XP`));
  if (prog.progress < 1) {
    rankXpFooter.appendChild(el('span', 'rank-xp-next', `Next: ${prog.nextEmoji} ${prog.nextTitle}`));
  }
  rankPanel.appendChild(rankXpFooter);
  panelsCol.appendChild(rankPanel);

  // 2. Combined Performance Overview
  const overviewPanel = el('div', 'overview-panel');
  overviewPanel.appendChild(el('h3', 'overview-panel__title', '📈 Performance & Curriculum'));

  const tGrid = el('div', 'overview-stats-grid');
  const pnlValues = trades.map(t => Number(t.pnl) || 0);
  const bestTrade = trades.length > 0 ? Math.max(...pnlValues) : 0;
  const conceptSet = new Set();
  lessons.forEach(l => {
    if (l.concepts) l.concepts.forEach(c => conceptSet.add(c));
  });

  const oItems = [
    { label: 'Win Rate', value: `${tradeStats.winRate}%` },
    { label: 'Total P&L', value: formatCurrency(tradeStats.totalPnL) },
    { label: 'Best Trade', value: formatCurrency(bestTrade) },
    { label: 'Lessons', value: `${lessons.length} / 33` },
    { label: 'Concepts', value: String(conceptSet.size) },
    { label: 'Assignments', value: `${completedAssignments} / ${assignments.length}` },
  ];

  oItems.forEach(({ label, value }) => {
    const item = el('div', 'overview-stat');
    item.appendChild(el('span', 'overview-stat__label', label));
    item.appendChild(el('span', 'overview-stat__value', value));
    tGrid.appendChild(item);
  });
  overviewPanel.appendChild(tGrid);

  const oProgBar = el('div', 'overview-progress-bar');
  const oProgFill = el('div', 'overview-progress-fill');
  oProgFill.style.width = `${Math.round((lessons.length / 33) * 100)}%`;
  oProgBar.appendChild(oProgFill);
  overviewPanel.appendChild(oProgBar);
  panelsCol.appendChild(overviewPanel);

  // 3. ICT Killzones widget
  const killzonesPanel = el('div', 'overview-panel killzones-panel');
  killzonesPanel.appendChild(el('h3', 'overview-panel__title', '⚡ ICT Killzones & Session Prep'));

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

  const sessionsList = el('div', 'kz-sessions');
  killzonesPanel.appendChild(sessionsList);

  const checklistContainer = el('div', 'kz-checklist-container');
  killzonesPanel.appendChild(checklistContainer);
  panelsCol.appendChild(killzonesPanel);

  // 4. Volatility Economic News Feed Widget
  const newsPanel = el('div', 'overview-panel news-panel');
  newsPanel.appendChild(el('h3', 'overview-panel__title', '📰 Volatility Economic Feed'));
  renderEconomicNewsWidget(newsPanel);
  panelsCol.appendChild(newsPanel);

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

  /* ---- Auto-show Weekly Recap on Sunday ---- */
  const dayOfWeek = new Date().getDay();
  if (dayOfWeek === 0) {
    const today = new Date().toISOString().slice(0, 10);
    const lastShown = storage.get('weekly_recap_shown', '');
    if (lastShown !== today) {
      setTimeout(() => renderWeeklyRecap(), 1500);
    }
  }
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
  const _now = new Date();
  const today = `${_now.getFullYear()}-${String(_now.getMonth()+1).padStart(2,'0')}-${String(_now.getDate()).padStart(2,'0')}`;
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
/*  ACHIEVEMENT BADGES / TROPHIES                                     */
/* ================================================================ */

const ACHIEVEMENTS = [
  { id: 'first-trade',   emoji: '🏆', name: 'First Trade',     desc: 'Log your first trade',                check: () => getTrades().length >= 1 },
  { id: '10-trades',     emoji: '💯', name: '10 Trades Club',  desc: 'Log 10 trades',                       check: () => getTrades().length >= 10 },
  { id: 'sharpshooter',  emoji: '🎯', name: 'Sharpshooter',    desc: '60%+ win rate (min 5 trades)',         check: () => { const t = getTrades(); return t.length >= 5 && calculateStats(t).winRate >= 60; } },
  { id: 'first-profit',  emoji: '💰', name: 'First Profit',    desc: 'First trade with positive P&L',       check: () => getTrades().some(t => Number(t.pnl) > 0) },
  { id: '100-club',      emoji: '💵', name: '$100 Club',       desc: 'Accumulate $100+ total P&L',          check: () => calculateStats(getTrades()).totalPnL >= 100 },
  { id: 'scholar',       emoji: '📚', name: 'Scholar',         desc: 'Complete 10 lessons',                  check: () => getLessons().length >= 10 },
  { id: 'graduate',      emoji: '🎓', name: 'Graduate',        desc: 'Complete all 33 lessons',              check: () => getLessons().length >= 33 },
  { id: '7-day-warrior', emoji: '🔥', name: '7-Day Warrior',   desc: '7-day streak on any habit',            check: () => getHabits().some(h => calculateStreak(h.id) >= 7) },
  { id: '30-day-legend', emoji: '🔥', name: '30-Day Legend',   desc: '30-day streak on any habit',           check: () => getHabits().some(h => calculateStreak(h.id) >= 30) },
  { id: 'perfect-week',  emoji: '⭐', name: 'Perfect Week',    desc: 'All habits done 7 straight days',      check: () => {
    const habits = getHabits();
    if (!habits.length) return false;
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      if (!habits.every(h => h.log && h.log[key])) return false;
    }
    return true;
  }},
  { id: 'rising-star',   emoji: '🏅', name: 'Rising Star',     desc: 'Reach Level 5 (Lieutenant)',           check: () => getLevel().level >= 5 },
  { id: 'the-legend',    emoji: '👑', name: 'The Legend',       desc: 'Reach Level 10 (Legend)',              check: () => getLevel().level >= 10 },
  // ---- New Premium upgrades ----
  { id: 'risk-manager',  emoji: '🛡️', name: 'Risk Manager',     desc: 'Log 5 consecutive trades with SL',      check: () => {
    const trades = getTrades();
    if (trades.length < 5) return false;
    const sorted = [...trades].sort((a,b) => new Date(a.date) - new Date(b.date));
    let run = 0;
    for (const t of sorted) {
      if (Number(t.stop || 0) > 0) {
        run++;
        if (run >= 5) return true;
      } else {
        run = 0;
      }
    }
    return false;
  }},
  { id: 'unstoppable',   emoji: '💪', name: 'Unstoppable',     desc: 'Hit a 14-day streak on any habit',     check: () => getHabits().some(h => calculateStreak(h.id) >= 14) },
  { id: 'flawless-execution', emoji: '⚔️', name: 'Flawless Win', desc: 'Record a 5-trade win streak',         check: () => {
    const trades = getTrades();
    if (trades.length < 5) return false;
    const sorted = [...trades].sort((a,b) => new Date(a.date) - new Date(b.date));
    let currentStreak = 0;
    let maxStreak = 0;
    for (const t of sorted) {
      if (t.outcome === 'win') {
        currentStreak++;
        if (currentStreak > maxStreak) maxStreak = currentStreak;
      } else if (t.outcome === 'loss') {
        currentStreak = 0;
      }
    }
    return maxStreak >= 5;
  }},
  { id: 'absolute-discipline', emoji: '🍅', name: 'Focus Master', desc: 'Complete 4 Pomodoro blocks in one day', check: () => {
    const pData = storage.get('pomodoro_data', null);
    return pData && pData.completedToday >= 4;
  }}
];

function renderAchievementBadges(container, trades, tradeStats, lessons, habits) {
  const grid = el('div', 'achieve-grid');

  ACHIEVEMENTS.forEach(a => {
    const unlocked = a.check();
    const badge = el('div', `achieve-badge${unlocked ? ' achieve-badge--unlocked' : ''}`);
    badge.style.cursor = 'pointer';
    badge.appendChild(el('span', 'achieve-badge__emoji', unlocked ? a.emoji : '🔒'));
    badge.appendChild(el('span', 'achieve-badge__name', a.name));
    badge.setAttribute('title', a.desc);
    
    badge.addEventListener('click', () => {
      openAchievementDetail(a);
    });
    grid.appendChild(badge);
  });

  container.appendChild(grid);
}

function openAchievementDetail(a) {
  // Setup overlay & modal
  const overlay = el('div', 'modal-overlay');
  const modal = el('div', 'modal');
  modal.style.maxWidth = '400px';

  const topBar = el('div', 'modal__topbar');
  topBar.style.background = 'linear-gradient(90deg, var(--cyan), var(--purple), var(--neon-green))';
  modal.appendChild(topBar);

  const header = el('div', 'modal__header');
  header.appendChild(el('h2', 'modal__title', '🏆 Milestone Achievement'));
  const closeBtn = el('button', 'modal__close', '✕');
  closeBtn.addEventListener('click', () => {
    overlay.style.opacity = '0';
    setTimeout(() => overlay.remove(), 250);
  });
  header.appendChild(closeBtn);
  modal.appendChild(header);

  const body = el('div', 'modal__body');
  const container = el('div', 'achieve-detail-modal');

  const unlocked = a.check();

  const emojiWrap = el('div', `achieve-detail-emoji-wrap ${unlocked ? 'unlocked' : 'locked'}`);
  emojiWrap.appendChild(el('span', 'achieve-detail-emoji', unlocked ? a.emoji : '🔒'));
  container.appendChild(emojiWrap);

  container.appendChild(el('h3', 'achieve-detail-name', a.name));
  
  const desc = el('p', 'achieve-detail-desc');
  desc.textContent = a.desc;
  container.appendChild(desc);

  const statusBox = el('div', `achieve-detail-status ${unlocked ? 'unlocked' : 'locked'}`);
  statusBox.textContent = unlocked ? '🔓 Status: Completed & Claimed (+50 XP)' : '🔒 Status: Locked (In Progress)';
  container.appendChild(statusBox);

  // Dynamic progress tracker inside modal
  const progressBox = el('div', 'achieve-detail-progress-box');
  let currentVal = 0;
  let targetVal = 1;
  let labelText = '';

  if (a.id === 'first-trade') {
    currentVal = getTrades().length;
    targetVal = 1;
    labelText = `${currentVal} / ${targetVal} trades logged`;
  } else if (a.id === '10-trades') {
    currentVal = getTrades().length;
    targetVal = 10;
    labelText = `${currentVal} / ${targetVal} trades logged`;
  } else if (a.id === 'sharpshooter') {
    const t = getTrades();
    currentVal = t.length >= 5 ? calculateStats(t).winRate : 0;
    targetVal = 60;
    labelText = `${currentVal.toFixed(0)}% / ${targetVal}% win rate`;
  } else if (a.id === 'first-profit') {
    currentVal = getTrades().some(t => Number(t.pnl) > 0) ? 1 : 0;
    targetVal = 1;
    labelText = currentVal > 0 ? 'Profit earned!' : 'No profitable trade logged';
  } else if (a.id === '100-club') {
    currentVal = calculateStats(getTrades()).totalPnL;
    targetVal = 100;
    labelText = `$${currentVal.toFixed(2)} / $${targetVal}.00 P&L earned`;
  } else if (a.id === 'scholar') {
    currentVal = getLessons().length;
    targetVal = 10;
    labelText = `${currentVal} / ${targetVal} lessons completed`;
  } else if (a.id === 'graduate') {
    currentVal = getLessons().length;
    targetVal = 33;
    labelText = `${currentVal} / ${targetVal} lessons completed`;
  } else if (a.id === '7-day-warrior') {
    const streaks = getHabits().map(h => calculateStreak(h.id));
    currentVal = streaks.length ? Math.max(...streaks) : 0;
    targetVal = 7;
    labelText = `${currentVal} / ${targetVal} day habit streak`;
  } else if (a.id === '30-day-legend') {
    const streaks = getHabits().map(h => calculateStreak(h.id));
    currentVal = streaks.length ? Math.max(...streaks) : 0;
    targetVal = 30;
    labelText = `${currentVal} / ${targetVal} day habit streak`;
  } else if (a.id === 'perfect-week') {
    let consec = 0;
    const habits = getHabits();
    if (habits.length) {
      for (let i = 0; i < 7; i++) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
        if (habits.every(h => h.log && h.log[key])) consec++;
        else break;
      }
    }
    currentVal = consec;
    targetVal = 7;
    labelText = `${currentVal} / ${targetVal} consecutive perfect days`;
  } else if (a.id === 'rising-star') {
    currentVal = getLevel().level;
    targetVal = 5;
    labelText = `Level ${currentVal} / ${targetVal} reached`;
  } else if (a.id === 'the-legend') {
    currentVal = getLevel().level;
    targetVal = 10;
    labelText = `Level ${currentVal} / ${targetVal} reached`;
  } else if (a.id === 'risk-manager') {
    const trades = getTrades();
    let run = 0;
    let maxRun = 0;
    if (trades.length) {
      const sorted = [...trades].sort((a,b) => new Date(a.date) - new Date(b.date));
      for (const t of sorted) {
        if (Number(t.stop || 0) > 0) {
          run++;
          if (run > maxRun) maxRun = run;
        } else {
          run = 0;
        }
      }
    }
    currentVal = maxRun;
    targetVal = 5;
    labelText = `${currentVal} / ${targetVal} consecutive protected trades`;
  } else if (a.id === 'unstoppable') {
    const streaks = getHabits().map(h => calculateStreak(h.id));
    currentVal = streaks.length ? Math.max(...streaks) : 0;
    targetVal = 14;
    labelText = `${currentVal} / ${targetVal} day habit streak`;
  } else if (a.id === 'flawless-execution') {
    const trades = getTrades();
    let run = 0;
    let maxRun = 0;
    if (trades.length) {
      const sorted = [...trades].sort((a,b) => new Date(a.date) - new Date(b.date));
      for (const t of sorted) {
        if (t.outcome === 'win') {
          run++;
          if (run > maxRun) maxRun = run;
        } else {
          run = 0;
        }
      }
    }
    currentVal = maxRun;
    targetVal = 5;
    labelText = `${currentVal} / ${targetVal} consecutive wins`;
  } else if (a.id === 'absolute-discipline') {
    const pData = storage.get('pomodoro_data', null);
    currentVal = pData ? pData.completedToday || 0 : 0;
    targetVal = 4;
    labelText = `${currentVal} / ${targetVal} focus blocks completed today`;
  }

  const pct = Math.min((currentVal / targetVal) * 100, 100);

  const progressText = el('span', 'achieve-progress-text', labelText);
  progressBox.appendChild(progressText);

  const track = el('div', 'achieve-progress-track');
  const fill = el('div', 'achieve-progress-fill');
  fill.style.width = `${pct}%`;
  if (unlocked) {
    fill.style.background = 'linear-gradient(90deg, var(--neon-green), var(--cyan))';
  }
  track.appendChild(fill);
  progressBox.appendChild(track);
  container.appendChild(progressBox);

  body.appendChild(container);
  modal.appendChild(body);
  overlay.appendChild(modal);
  
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeBtn.click(); });
  document.body.appendChild(overlay);
}

/* ================================================================ */
/*  WEEKLY RECAP REPORT                                               */
/* ================================================================ */

function renderWeeklyRecap() {
  // Calculate Monday–Sunday range for the current week
  const now = new Date();
  const dayIdx = now.getDay(); // 0=Sun, 1=Mon...
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((dayIdx + 6) % 7));
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const fmtShort = d => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const weekRange = `${fmtShort(monday)} – ${fmtShort(sunday)}, ${sunday.getFullYear()}`;

  // Build date keys for the week
  const weekKeys = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    weekKeys.push(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`);
  }

  // Trades this week
  const allTrades = getTrades();
  const weekTrades = allTrades.filter(t => {
    const td = (t.date || t.createdAt || '').slice(0, 10);
    return weekKeys.includes(td);
  });
  const weekStats = calculateStats(weekTrades);

  // Lessons this week
  const allLessons = getLessons();
  const weekLessons = allLessons.filter(l => {
    const ld = (l.createdAt || l.date || '').slice(0, 10);
    return weekKeys.includes(ld);
  });

  // Habits this week (total check-ins)
  const habits = getHabits();
  let totalCheckins = 0;
  habits.forEach(h => {
    weekKeys.forEach(key => {
      if (h.log && h.log[key]) totalCheckins++;
    });
  });

  // XP earned this week
  const xpData = getXPData();
  let weekXP = 0;
  (xpData.history || []).forEach(entry => {
    const ed = (entry.date || '').slice(0, 10);
    if (weekKeys.includes(ed)) weekXP += entry.xp;
  });

  // Best day — day with most activity
  let bestDay = weekKeys[0];
  let bestDayScore = 0;
  weekKeys.forEach(key => {
    let score = 0;
    score += allTrades.filter(t => (t.date || t.createdAt || '').slice(0, 10) === key).length * 2;
    score += allLessons.filter(l => (l.createdAt || l.date || '').slice(0, 10) === key).length * 2;
    habits.forEach(h => { if (h.log && h.log[key]) score++; });
    if (score > bestDayScore) { bestDayScore = score; bestDay = key; }
  });
  const bestDayName = new Date(bestDay + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long' });

  // Current level
  const lvl = getLevel();

  // Mark as shown
  storage.set('weekly_recap_shown', now.toISOString().slice(0, 10));

  // Build modal overlay
  const overlay = el('div', 'recap-overlay');
  const modal = el('div', 'recap-modal');

  // Glow bar
  const glow = el('div', 'recap-glow');
  modal.appendChild(glow);

  // Header
  const header = el('div', 'recap-header');
  header.appendChild(el('h2', 'recap-title', '📊 Weekly Recap'));
  const closeBtn = el('button', 'recap-close', '✕');
  closeBtn.addEventListener('click', () => {
    overlay.style.opacity = '0';
    setTimeout(() => overlay.remove(), 250);
  });
  header.appendChild(closeBtn);
  modal.appendChild(header);

  modal.appendChild(el('p', 'recap-range', weekRange));

  // Stats grid
  const grid = el('div', 'recap-grid');
  const recapItems = [
    { icon: '📊', label: 'Trades', value: String(weekStats.totalTrades) },
    { icon: '🎯', label: 'Win Rate', value: `${weekStats.winRate}%` },
    { icon: '💰', label: 'P&L', value: formatCurrency(weekStats.totalPnL) },
    { icon: '📚', label: 'Lessons', value: String(weekLessons.length) },
    { icon: '🔥', label: 'Habit Check-ins', value: String(totalCheckins) },
    { icon: '⚡', label: 'XP Earned', value: `+${weekXP}` },
    { icon: '🏆', label: 'Best Day', value: bestDayName },
    { icon: lvl.emoji, label: 'Current Rank', value: lvl.title },
  ];

  recapItems.forEach(({ icon, label, value }) => {
    const item = el('div', 'recap-stat');
    item.appendChild(el('span', 'recap-stat__icon', icon));
    item.appendChild(el('span', 'recap-stat__value', value));
    item.appendChild(el('span', 'recap-stat__label', label));
    grid.appendChild(item);
  });

  modal.appendChild(grid);

  // Motivational footer
  let message = 'Keep pushing — consistency is the key to becoming a legend! 💪';
  if (weekStats.totalTrades >= 5 && weekStats.winRate >= 60) message = 'Great trading week! Your edge is showing! 🔥';
  else if (weekXP >= 200) message = 'Massive XP gains! You\'re leveling up fast! ⚡';
  else if (totalCheckins >= 14) message = 'Habit machine! Your streaks are on fire! 🔥';
  modal.appendChild(el('p', 'recap-footer', message));

  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('recap-overlay--visible'));

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      overlay.style.opacity = '0';
      setTimeout(() => overlay.remove(), 250);
    }
  });
}

/* ================================================================ */
/*  XP REAL-TIME DYNAMIC UI HELPERS                                  */
/* ================================================================ */

function updateSidebarXP(container) {
  container.replaceChildren();

  const lvl = getLevel();
  const prog = getLevelProgress();
  const xpData = getXPData();

  // Rank Row
  const rankRow = el('div', 'sidebar-xp__rank-row');
  
  const rankEmoji = el('span', 'sidebar-xp__emoji', lvl.emoji);
  rankRow.appendChild(rankEmoji);

  const titleWrap = el('div', 'sidebar-xp__title-wrap');
  titleWrap.appendChild(el('span', 'sidebar-xp__title', lvl.title));
  titleWrap.appendChild(el('span', 'sidebar-xp__level-text', `Level ${lvl.level}`));
  rankRow.appendChild(titleWrap);
  
  container.appendChild(rankRow);

  // Progress Bar Track
  const progressTrack = el('div', 'sidebar-xp__progress');
  const progressFill = el('div', 'sidebar-xp__fill');
  progressFill.style.width = `${Math.round(prog.progress * 100)}%`;
  progressTrack.appendChild(progressFill);
  container.appendChild(progressTrack);

  // Footer text
  const footer = el('div', 'sidebar-xp__footer');
  footer.appendChild(el('span', 'sidebar-xp__text', prog.progress >= 1 ? `${xpData.totalXP} XP (MAX)` : `${xpData.totalXP} / ${prog.next} XP`));
  if (prog.progress < 1) {
    footer.appendChild(el('span', 'sidebar-xp__next', `${prog.nextEmoji} ${prog.nextTitle}`));
  }
  container.appendChild(footer);
}

function updateDashboardRank() {
  const rankPanel = document.querySelector('.rank-panel');
  if (rankPanel) {
    const lvl = getLevel();
    const prog = getLevelProgress();
    const xpData = getXPData();

    const emojiEl = rankPanel.querySelector('.rank-card-emoji');
    if (emojiEl) emojiEl.textContent = lvl.emoji;

    const titleEl = rankPanel.querySelector('.rank-card-title');
    if (titleEl) titleEl.textContent = lvl.title;

    const lvlEl = rankPanel.querySelector('.rank-card-level');
    if (lvlEl) lvlEl.textContent = `Level ${lvl.level}`;

    const fillEl = rankPanel.querySelector('.rank-xp-fill');
    if (fillEl) fillEl.style.width = `${Math.round(prog.progress * 100)}%`;

    const textEl = rankPanel.querySelector('.rank-xp-text');
    if (textEl) textEl.textContent = prog.progress >= 1 ? `${xpData.totalXP} XP (MAX)` : `${xpData.totalXP} / ${prog.next} XP`;

    const nextEl = rankPanel.querySelector('.rank-xp-next');
    if (nextEl) {
      if (prog.progress >= 1) {
        nextEl.remove();
      } else {
        nextEl.textContent = `Next: ${prog.nextEmoji} ${prog.nextTitle}`;
      }
    } else if (prog.progress < 1) {
      const footer = rankPanel.querySelector('.rank-xp-footer');
      if (footer) {
        footer.appendChild(el('span', 'rank-xp-next', `Next: ${prog.nextEmoji} ${prog.nextTitle}`));
      }
    }
  }
}

function showXPToast(amount, action) {
  const toastContainer = document.querySelector('.xp-toast-container') || (() => {
    const tc = el('div', 'xp-toast-container');
    document.body.appendChild(tc);
    return tc;
  })();

  const toast = el('div', 'xp-toast');
  
  const labels = {
    habit: 'Completed Habit',
    trade: 'Logged Trade',
    lesson: 'Finished Lesson',
    assignment: 'Completed Assignment',
    quiz: 'Finished Quiz',
    perfectDay: 'Perfect Day Streak!'
  };
  const label = labels[action] || action;

  toast.appendChild(el('span', 'xp-toast__icon', '⚡'));
  toast.appendChild(el('span', 'xp-toast__text', `+${amount} XP (${label})`));
  
  toastContainer.appendChild(toast);

  // Trigger slide in
  setTimeout(() => toast.classList.add('xp-toast--visible'), 10);

  // Auto-remove
  setTimeout(() => {
    toast.classList.remove('xp-toast--visible');
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

function showLevelUpModal(oldLvl, newLvl) {
  const overlay = el('div', 'welcome-modal-overlay level-up-overlay');
  const modal = el('div', 'welcome-modal level-up-modal');

  const glow = el('div', 'welcome-glow-bar');
  glow.style.background = 'linear-gradient(90deg, var(--cyan), var(--purple), var(--neon-green))';
  modal.appendChild(glow);

  modal.appendChild(el('span', 'welcome-modal__emoji level-up-emoji', newLvl.emoji));
  
  const title = el('h2', 'welcome-modal__title level-up-title', 'LEVEL UP!');
  modal.appendChild(title);

  const subtitle = el('h3', 'level-up-subtitle');
  subtitle.textContent = `You promoted from ${oldLvl.title} to ${newLvl.title}!`;
  modal.appendChild(subtitle);

  const text = el('p', 'welcome-modal__text');
  text.textContent = `Congratulations, SwaGGa! Your discipline, consistent habits, and trading mastery are paying off. Continue leading the charge! ⚡`;
  modal.appendChild(text);

  const btn = el('button', 'welcome-modal__btn level-up-btn', 'Acknowledge ⚔️');
  btn.addEventListener('click', () => {
    overlay.style.opacity = '0';
    setTimeout(() => overlay.remove(), 300);
  });
  modal.appendChild(btn);

  overlay.appendChild(modal);
  document.body.appendChild(overlay);
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
    try {
      signInBtn.textContent = '⏳ Signing in...';
      signInBtn.disabled = true;
      const res = await signInWithGoogle();
      if (res && res.redirecting) {
        signInBtn.textContent = '⏳ Redirecting...';
        return; // Redirect is in progress, keep disabled
      }
      if (!res) {
        signInBtn.textContent = '☁️ Sign In to Sync';
        signInBtn.disabled = false;
      }
    } catch (err) {
      console.error('Sign in click failed:', err);
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

  // ---- Sidebar XP & Level widget ----
  const sidebarXP = el('div', 'sidebar-xp');
  sidebar.appendChild(sidebarXP);
  updateSidebarXP(sidebarXP);

  sidebar.appendChild(syncSection);

  // Theme switcher toggle button in sidebar
  const currentTheme = storage.get('theme', 'dark');
  const themeBtn = el('button', 'theme-switch-btn');
  const themeEmoji = el('span', 'theme-switch-emoji', currentTheme === 'light' ? '🌙 Dark Mode' : '☀️ Light Mode');
  themeBtn.appendChild(themeEmoji);
  
  themeBtn.addEventListener('click', () => {
    const activeTheme = document.documentElement.getAttribute('data-theme') || 'dark';
    const newTheme = activeTheme === 'light' ? 'dark' : 'light';
    
    document.documentElement.setAttribute('data-theme', newTheme);
    storage.set('theme', newTheme);
    themeEmoji.textContent = newTheme === 'light' ? '🌙 Dark Mode' : '☀️ Light Mode';
  });
  sidebar.appendChild(themeBtn);

  const collapseBtn = el('button', 'sidebar-collapse-btn', '◀');
  collapseBtn.setAttribute('aria-label', 'Toggle sidebar');
  collapseBtn.addEventListener('click', () => {
    sidebar.classList.toggle('collapsed');
    collapseBtn.textContent = sidebar.classList.contains('collapsed') ? '▶' : '◀';
  });
  sidebar.appendChild(collapseBtn);

  app.appendChild(sidebar);

  // ---- Mobile Bottom Nav Bar ----
  const bottomNav = el('div', 'mobile-bottom-nav');
  const bottomNavItems = [
    { hash: '#dashboard', label: 'Dashboard', icon: '🏠' },
    { hash: '#streaks', label: 'Streaks', icon: '🔥' },
    { hash: '#trading', label: 'Trading', icon: '💹' },
    { hash: '#calendar', label: 'Calendar', icon: '📅' },
    { hash: '#learning', label: 'Learning', icon: '📚' },
  ];
  
  bottomNavItems.forEach(({ hash, label, icon }) => {
    const item = el('button', 'mobile-bottom-nav__item');
    item.setAttribute('data-bottom-route', hash);
    item.appendChild(el('span', 'mobile-bottom-nav__icon', icon));
    item.appendChild(el('span', 'mobile-bottom-nav__label', label));
    item.addEventListener('click', () => {
      router.navigate(hash);
      closeMobileMenu();
    });
    bottomNav.appendChild(item);
  });
  app.appendChild(bottomNav);

  // ---- Main content ----
  const main = el('main', 'main-content');
  main.id = 'main-content';

  const pages = ['dashboard', 'streaks', 'trading', 'calendar', 'chart', 'learning'];
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
    try {
      gText.textContent = 'Signing in...';
      googleBtn.disabled = true;
      googleBtn.classList.add('login-google-btn--loading');
      const res = await signInWithGoogle();
      if (res && res.redirecting) {
        gText.textContent = 'Redirecting to Google...';
        return; // Redirect is in progress, keep disabled
      }
      if (!res) {
        gText.textContent = 'Sign in with Google';
        googleBtn.disabled = false;
        googleBtn.classList.remove('login-google-btn--loading');
      }
    } catch (err) {
      console.error('Google sign in button failed:', err);
      gText.textContent = 'Sign in with Google';
      googleBtn.disabled = false;
      googleBtn.classList.remove('login-google-btn--loading');
    }
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
  router.registerRoute('#calendar', renderCalendarPage);

  // Real-time XP & Level progression reactive updater
  window.addEventListener('xp-change', (e) => {
    const { amount, action, leveledUp, oldLevel, newLevel } = e.detail;
    
    // 1. Show dynamic floating toast notification
    showXPToast(amount, action);
    
    // 2. Update sidebar XP widget
    const sidebarXP = document.querySelector('.sidebar-xp');
    if (sidebarXP) {
      updateSidebarXP(sidebarXP);
    }
    
    // 3. Update dashboard Rank panel if active
    const pageDashboard = document.getElementById('page-dashboard');
    if (pageDashboard && pageDashboard.style.display !== 'none') {
      updateDashboardRank();
    }
    
    // 4. Show gorgeous modal on rank promotion!
    if (leveledUp) {
      setTimeout(() => {
        showLevelUpModal(oldLevel, newLevel);
      }, 500);
    }
  });

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
  // Initialize the saved visual theme (defaults to dark mode)
  const savedTheme = storage.get('theme', 'dark');
  document.documentElement.setAttribute('data-theme', savedTheme);

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

/* ================================================================ */
/*  ECONOMIC CALENDAR NEWS FEED WIDGET SUPPORT                       */
/* ================================================================ */

function renderEconomicNewsWidget(container) {
  const listContainer = el('div', 'news-list-container');
  container.appendChild(listContainer);

  const loadingText = el('p', 'news-loading-text', '🔄 Fetching live economic calendar...');
  loadingText.style.fontSize = 'var(--text-xs)';
  loadingText.style.color = 'var(--text-muted)';
  listContainer.appendChild(loadingText);

  // We fetch through allorigins proxy with a curated fallback calendar so SwaGGa HQ NEVER breaks
  const proxyUrl = 'https://api.allorigins.win/raw?url=';
  const targetUrl = 'https://nfs.faireconomy.media/ff_calendar_thisweek.json';
  
  fetch(proxyUrl + encodeURIComponent(targetUrl))
    .then(res => {
      if (!res.ok) throw new Error('API request failed');
      return res.json();
    })
    .then(events => {
      if (!Array.isArray(events)) throw new Error('Invalid JSON structure');
      renderEventsList(listContainer, events);
    })
    .catch(err => {
      console.warn('Live news calendar fetch failed, loading curated fallback feed...', err);
      // Generate standard fallback high-impact releases for the current week
      const fallbackEvents = getCuratedFallbackEvents();
      renderEventsList(listContainer, fallbackEvents);
    });
}

function getCuratedFallbackEvents() {
  const events = [];
  const startOfWeek = new Date();
  // Set to Monday of the current week
  const day = startOfWeek.getDay();
  const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1);
  startOfWeek.setDate(diff);

  const buildDate = (daysOffset, hour, min) => {
    const d = new Date(startOfWeek);
    d.setDate(startOfWeek.getDate() + daysOffset);
    d.setHours(hour, min, 0, 0);
    return d.toISOString();
  };

  return [
    { title: 'USD ISM Manufacturing PMI', country: 'USD', impact: 'High', date: buildDate(0, 10, 0) }, // Monday 10:00 AM
    { title: 'AUD Cash Rate & RBA Rate Statement', country: 'AUD', impact: 'High', date: buildDate(1, 0, 30) }, // Tuesday 12:30 AM
    { title: 'GBP GDP MoM', country: 'GBP', impact: 'High', date: buildDate(2, 2, 0) }, // Wednesday 2:00 AM
    { title: 'USD ADP Non-Farm Employment Change', country: 'USD', impact: 'Medium', date: buildDate(2, 8, 15) }, // Wednesday 8:15 AM
    { title: 'EUR ECB Interest Rate Decision', country: 'EUR', impact: 'High', date: buildDate(3, 8, 15) }, // Thursday 8:15 AM
    { title: 'USD Unemployment Claims', country: 'USD', impact: 'Medium', date: buildDate(3, 8, 30) }, // Thursday 8:30 AM
    { title: 'USD Non-Farm Employment Change (NFP)', country: 'USD', impact: 'High', date: buildDate(4, 8, 30) }, // Friday 8:30 AM
    { title: 'USD Unemployment Rate', country: 'USD', impact: 'High', date: buildDate(4, 8, 30) }, // Friday 8:30 AM
  ];
}

function renderEventsList(container, events) {
  container.replaceChildren();

  const now = new Date();
  
  // Filter for major currencies, High and Medium impact events, and sort by date chronologically
  const filtered = events
    .filter(e => {
      const isMajor = ['USD', 'EUR', 'GBP', 'AUD', 'CAD', 'JPY', 'CHF', 'NZD'].includes(e.country);
      const isHighOrMed = ['High', 'Medium'].includes(e.impact);
      return isMajor && isHighOrMed;
    })
    .map(e => ({ ...e, parsedDate: new Date(e.date) }))
    .filter(e => {
      // Show events from today or the future of this week
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      return e.parsedDate >= startOfToday;
    })
    .sort((a, b) => a.parsedDate - b.parsedDate);

  if (filtered.length === 0) {
    container.appendChild(el('p', 'news-empty-text', '✅ No major high-impact news remaining this week.'));
    return;
  }

  const listEl = el('div', 'news-event-list');
  listEl.style.display = 'flex';
  listEl.style.flexDirection = 'column';
  listEl.style.gap = 'var(--space-3)';
  listEl.style.marginTop = 'var(--space-3)';

  // Volatility threat bar (if red news within 1 hour)
  let threatReleased = false;

  filtered.slice(0, 5).forEach(e => {
    const eventRow = el('div', 'news-event-item');
    eventRow.style.display = 'flex';
    eventRow.style.justifyContent = 'space-between';
    eventRow.style.alignItems = 'center';
    eventRow.style.padding = 'var(--space-3)';
    eventRow.style.borderRadius = 'var(--radius-md)';
    eventRow.style.background = 'rgba(255, 255, 255, 0.02)';
    eventRow.style.border = '1px solid rgba(255, 255, 255, 0.05)';
    eventRow.style.transition = 'all 0.3s ease';

    // Left: Folder Icon + Currency + Title
    const details = el('div', 'news-details');
    details.style.display = 'flex';
    details.style.alignItems = 'center';
    details.style.gap = 'var(--space-2)';

    // Folder badge
    const folder = el('span', `news-folder news-folder--${e.impact.toLowerCase()}`);
    folder.textContent = e.impact === 'High' ? '🔴' : '🟠';
    folder.style.fontSize = '12px';
    details.appendChild(folder);

    const currencyBadge = el('span', 'news-currency', e.country);
    currencyBadge.style.fontWeight = '800';
    currencyBadge.style.fontSize = 'var(--text-xs)';
    currencyBadge.style.color = e.impact === 'High' ? 'var(--crimson)' : 'var(--cyan)';
    currencyBadge.style.padding = '2px 6px';
    currencyBadge.style.borderRadius = '4px';
    currencyBadge.style.background = e.impact === 'High' ? 'rgba(142, 14, 0, 0.15)' : 'rgba(0, 212, 255, 0.1)';
    details.appendChild(currencyBadge);

    const titleEl = el('span', 'news-title-text', e.title);
    titleEl.style.fontSize = 'var(--text-xs)';
    titleEl.style.fontWeight = '500';
    details.appendChild(titleEl);
    eventRow.appendChild(details);

    // Right: Date & Time formatted locally
    const timeVal = e.parsedDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    const dayVal = e.parsedDate.toLocaleDateString('en-US', { weekday: 'short' });
    
    const timeBox = el('div', 'news-time-box');
    timeBox.style.textAlign = 'right';
    timeBox.appendChild(el('span', 'news-day-label', `${dayVal} `));
    
    const timeLabel = el('span', 'news-time-label', timeVal);
    timeLabel.style.fontWeight = '700';
    timeLabel.style.fontSize = 'var(--text-xs)';
    timeBox.appendChild(timeLabel);
    
    timeBox.style.fontSize = '11px';
    timeBox.style.color = 'var(--text-muted)';
    eventRow.appendChild(timeBox);

    // Threat Check: Check if high-impact USD, EUR, or GBP news is within 60 minutes
    const diffMin = Math.round((e.parsedDate - now) / 60000);
    if (!threatReleased && e.impact === 'High' && diffMin >= -30 && diffMin <= 60) {
      threatReleased = true;
      const threatBar = el('div', 'news-threat-alert');
      threatBar.style.background = 'linear-gradient(90deg, #8e0e00 0%, #1f1c18 100%)';
      threatBar.style.border = '1px solid rgba(142, 14, 0, 0.5)';
      threatBar.style.padding = 'var(--space-3)';
      threatBar.style.borderRadius = 'var(--radius-md)';
      threatBar.style.marginBottom = 'var(--space-3)';
      threatBar.style.display = 'flex';
      threatBar.style.alignItems = 'center';
      threatBar.style.gap = 'var(--space-2)';
      threatBar.style.animation = 'glow 1.5s infinite ease-in-out';
      
      threatBar.appendChild(el('span', '', '⚠️'));
      const text = el('span', '', `${e.country} ${e.title} release ${diffMin > 0 ? `in ${diffMin} mins` : 'active now'}! Volatility alert.`);
      text.style.fontSize = 'var(--text-xs)';
      text.style.fontWeight = '700';
      text.style.color = '#ffffff';
      threatBar.appendChild(text);
      
      container.appendChild(threatBar);
      
      // Also highlight this event row with a threat border
      eventRow.style.borderColor = 'var(--crimson)';
      eventRow.style.boxShadow = '0 0 10px rgba(142, 14, 0, 0.2)';
    }

    listEl.appendChild(eventRow);
  });

  container.appendChild(listEl);
}
