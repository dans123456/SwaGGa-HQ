// SwaGGa HQ — Main Application Controller
// Orchestrates navigation, welcome popups, live stats calculations, and dashboard layout.
// Strictly uses createElement + textContent for ultimate visual performance and security.

import router from './router.js';
import { renderTradingPage } from './trading.js';
import { renderChartPage } from './trading.js';
import { renderLearningPage, getLessons, getAssignments } from './learning.js';
import { renderStreaksPage, getHabits, calculateStreak, initStreakNotifications, checkAndApplyAutoFreezes } from './streaks.js';
import { getTrades, calculateStats } from './trading.js';
import { getTimeAgo, formatCurrency, triggerConfetti, showNotificationToast, createModal } from './utils.js';
import storage from './storage.js';
import { checkAutoAssignment } from './notifications.js';
import { onAuthChange, signInWithGoogle, firebaseSignOut, syncNow, pushToCloud, getCurrentUser } from './firebase-sync.js';
import { getXPData, getLevel, getLevelProgress, getTitle, LEVELS, addXP } from './xp.js';
import { renderCalendarPage } from './calendar.js';
import { playSynthSound } from './audio.js';
import { renderSimulatorPage } from './simulator.js';
import { initNative, nativeHaptic, nativeHapticNotification, isNative } from './native-bridge.js';
import { renderMindsetPage } from './mindset.js';
import { renderBlitzPage } from './blitz.js';
import { renderReviewPage } from './review.js';
import { renderNotebookPage } from './notebook.js';
import { renderCoachPage } from './coach.js';
import { createEquityCurve } from './charts.js';

// Simple DOM element builder helper
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
  { hash: '#simulator', label: 'Simulator', icon: '🎮' },
  { hash: '#mindset', label: 'Mindset Room', icon: '🧘' },
  { hash: '#blitz', label: 'SMC Blitz', icon: '⚡' },
  { hash: '#review', label: 'Review Hub', icon: '📊' },
  { hash: '#notebook', label: 'Notebook', icon: '📝' },
  { hash: '#coach', label: 'SwagAI', icon: '🤖' },
];

let _killzonesInterval = null;

// --- Welcome Popup ---

function showWelcomePopup() {
  // Only greet once per session so they don't get annoyed on refresh
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

// --- ICT Killzones Helpers & Constants ---

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

function getNYTimeComponents() {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      hour12: false,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric'
    });
    
    const parts = formatter.formatToParts(new Date());
    const getPart = (type) => parseInt(parts.find(p => p.type === type).value, 10);
    
    return {
      year: getPart('year'),
      month: getPart('month'),
      day: getPart('day'),
      hours: getPart('hour'),
      minutes: getPart('minute'),
      seconds: getPart('second')
    };
  } catch (err) {
    // Robust fallback to local time in case of internationalization engine failure
    const now = new Date();
    return {
      year: now.getFullYear(),
      month: now.getMonth() + 1,
      day: now.getDate(),
      hours: now.getHours(),
      minutes: now.getMinutes(),
      seconds: now.getSeconds()
    };
  }
}

function isSessionActive(nyHours, start, end) {
  if (start < end) {
    return nyHours >= start && nyHours < end;
  } else {
    return nyHours >= start || nyHours < end;
  }
}

function getConvertedLocalRange(nyStartHour, nyEndHour) {
  try {
    const ny = getNYTimeComponents();
    const localTime = new Date();
    
    const nyClockDate = new Date(ny.year, ny.month - 1, ny.day, ny.hours, ny.minutes, ny.seconds);
    const diffMs = localTime.getTime() - nyClockDate.getTime();
    
    const startNY = new Date(ny.year, ny.month - 1, ny.day, nyStartHour, 0, 0);
    const endNY = new Date(ny.year, ny.month - 1, ny.day, nyEndHour, 0, 0);
    
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
      hours = hours ? hours : 12;
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
  const list = Object.prototype.hasOwnProperty.call(PREP_CHECKLISTS, sessionKey)
    ? PREP_CHECKLISTS[sessionKey]
    : PREP_CHECKLISTS['General'];
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
    cb.checked = !!(savedState && Object.prototype.hasOwnProperty.call(savedState, idx) && savedState[idx]);
    
    cb.addEventListener('change', () => {
      const currentState = getChecklistState(sessionKey);
      if (idx !== '__proto__' && idx !== 'constructor' && idx !== 'prototype') {
        currentState[idx] = cb.checked;
      }
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

// --- Revenge Trading Cooldown Lockout (Episode 16 Upgrade) ---

const EP16_QUOTES = [
  "Losses are just business operating costs. Professionals are indifferent to them.",
  "If you trade for entertainment, you will pay for it. Trade only when you have an edge.",
  "Revenge trading is an emotional response to a loss. Accept the loss and walk away.",
  "95% of traders fail because they lack the emotional independence to execute their plan.",
  "Adrenaline is the enemy of consistency. A good trade should feel boring.",
  "Do not chase the market. Let the market come to your zones.",
  "Your job is not to win every trade. Your job is to execute your edge perfectly."
];

function renderCooldownLockoutScreen(container) {
  container.replaceChildren();

  const wrap = el('div', 'cooldown-lockout-wrap');

  // Title
  wrap.appendChild(el('h1', 'cooldown-lockout-title', 'REVENGE TRADING COOLDOWN'));
  wrap.appendChild(el('p', 'cooldown-lockout-subtitle', 'Take a deep breath. SwaGGa HQ has locked execution access to enforce emotional independence.'));

  // Countdown timer element
  const timerContainer = el('div', 'cooldown-timer-container');
  const timerVal = el('span', 'cooldown-timer-val', '15:00');
  timerContainer.appendChild(timerVal);
  wrap.appendChild(timerContainer);

  // Breathing Guide Circle
  const breatheCircleOuter = el('div', 'breathe-circle-outer');
  const breatheCircleInner = el('div', 'breathe-circle-inner');
  const breatheText = el('span', 'breathe-text', 'Inhale...');
  breatheCircleInner.appendChild(breatheText);
  breatheCircleOuter.appendChild(breatheCircleInner);
  wrap.appendChild(breatheCircleOuter);

  // Quote Card
  const quoteCard = el('div', 'cooldown-quote-card glass-card');
  const randomQuote = EP16_QUOTES[Math.floor(Math.random() * EP16_QUOTES.length)];
  const quoteText = el('p', 'cooldown-quote-text', `"${randomQuote}"`);
  const quoteAuthor = el('p', 'cooldown-quote-author', '— Brah Goh, Episode 16');
  quoteCard.appendChild(quoteText);
  quoteCard.appendChild(quoteAuthor);
  wrap.appendChild(quoteCard);

  container.appendChild(wrap);

  // Breathing text animation switcher
  let isInhale = true;
  breatheText.textContent = 'Inhale...';
  const breatheInterval = setInterval(() => {
    if (!document.contains(breatheText)) {
      clearInterval(breatheInterval);
      return;
    }
    isInhale = !isInhale;
    breatheText.textContent = isInhale ? 'Inhale...' : 'Exhale...';
  }, 4000);

  // Timer tick interval
  const timerInterval = setInterval(() => {
    if (!document.contains(timerVal)) {
      clearInterval(timerInterval);
      return;
    }
    const expiry = storage.get('cooldown_expiry', 0);
    const remaining = expiry - Date.now();
    
    if (remaining <= 0) {
      clearInterval(timerInterval);
      clearInterval(breatheInterval);
      storage.delete('cooldown_expiry');
      window.location.hash = '#trading';
      return;
    }
    
    const minutes = Math.floor(remaining / 60000);
    const seconds = Math.floor((remaining % 60000) / 1000);
    timerVal.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }, 1000);
}

// --- Pre-Market Routine & Lockout ---

function renderPremarketLockoutScreen(container) {
  container.replaceChildren();

  const wrap = el('div', 'premarket-lockout-wrap');
  
  // Icon/Badge
  const iconBox = el('div', 'premarket-lockout-icon-box');
  const lockIcon = el('span', 'premarket-lockout-icon', '🔒');
  iconBox.appendChild(lockIcon);
  wrap.appendChild(iconBox);

  // Title & Subtitle
  wrap.appendChild(el('h1', 'premarket-lockout-title', 'PRE-MARKET ROUTINE LOCKED'));
  wrap.appendChild(el('p', 'premarket-lockout-subtitle', 'Enforce professional trading discipline. Enacting your daily routine is required to unlock the Simulator and Trading Log pages.'));

  // Dev Bypass Button
  const bypassBtn = el('button', 'btn btn-ghost dev-bypass-btn', '🔓 Dev Mode: Skip & Unlock Journal');
  bypassBtn.style.marginTop = 'var(--space-4)';
  bypassBtn.style.color = 'var(--cyan)';
  bypassBtn.style.border = '1px dashed var(--cyan)';
  bypassBtn.style.width = '100%';
  bypassBtn.addEventListener('click', () => {
    const today = new Date().toISOString().slice(0, 10);
    const routine = {
      date: today,
      completed: true,
      newsChecked: true,
      htfBias: 'bullish',
      htfLogic: 'Developer Bypass',
      keyLevels: 'Developer Bypass',
      riskChecked: true,
      riskLimit: 'Developer Bypass',
      rulesChecked: true,
      focusRule: 'Developer Bypass',
      sessionCommitment: 'london',
      physicalPrimed: true,
      mentalPrimed: true
    };
    storage.set('premarket_routine', routine);

    const history = storage.get('premarket_history', {});
    history[today] = { ...routine, completedAt: new Date().toISOString() };
    storage.set('premarket_history', history);

    import('./xp.js').then(({ addXP }) => {
      addXP('Pre-Market Discipline Bonus', 20);
    });
    
    showNotificationToast('Pre-Market Routine bypassed! 🔓');

    import('./firebase-sync.js').then(({ pushToCloud, getCurrentUser }) => {
      if (getCurrentUser()) pushToCloud();
    });

    updateFocusBanner();

    const originalTarget = storage.get('premarket_original_target') || '#dashboard';
    storage.delete('premarket_original_target');
    router.navigate(originalTarget);
  });
  wrap.appendChild(bypassBtn);

  // Checklist content
  const card = el('div', 'premarket-routine-card lockout-card');
  renderPremarketWidget(card, true); // True means render in lockout mode
  wrap.appendChild(card);

  container.appendChild(wrap);
}

function renderPremarketWidget(container, isLockout = false) {
  container.replaceChildren();

  const today = new Date().toISOString().slice(0, 10);
  let routine = storage.get('premarket_routine');

  // Initialize if not present or stale
  if (!routine || routine.date !== today) {
    routine = {
      date: today,
      completed: false,
      newsChecked: false,
      htfBias: '',
      htfLogic: '',
      keyLevels: '',
      riskChecked: false,
      riskLimit: '',
      rulesChecked: false,
      focusRule: '',
      sessionCommitment: '',
      physicalPrimed: false,
      mentalPrimed: false
    };
    storage.set('premarket_routine', routine);
  }

  // Header
  const header = el('div', 'premarket-widget-header');
  const title = el('h3', 'premarket-widget-title');
  title.textContent = routine.completed ? '🔓 Pre-Market Routine Completed' : '⚡ Pre-Market Routine Checklist';
  header.appendChild(title);
  
  if (routine.completed) {
    const badge = el('span', 'premarket-badge-complete', 'UNLOCKED');
    header.appendChild(badge);
  }
  container.appendChild(header);

  if (routine.completed) {
    // Render completed premium state
    const body = el('div', 'premarket-completed-body');
    const p = el('p', 'premarket-completed-text');
    p.textContent = "Discipline bonus claimed! Trading Log & Simulator unlocked. Let's execute like a professional today.";
    body.appendChild(p);

    const infoRow = el('div', 'premarket-completed-info');
    infoRow.appendChild(el('span', 'premarket-info-item', `🗺️ Bias: ${routine.htfBias ? routine.htfBias.toUpperCase() : '—'}`));
    if (routine.keyLevels) {
      infoRow.appendChild(el('span', 'premarket-info-item', `🎯 Levels: ${routine.keyLevels}`));
    }
    infoRow.appendChild(el('span', 'premarket-info-item', `🛡️ Max Drawdown: ${routine.riskLimit || '—'}`));
    if (routine.focusRule) {
      infoRow.appendChild(el('span', 'premarket-info-item', `🎯 Focus: ${routine.focusRule}`));
    }
    
    let sessionName = '—';
    if (routine.sessionCommitment === 'london') sessionName = 'London 🐂';
    else if (routine.sessionCommitment === 'newyork') sessionName = 'New York 🇺🇸';
    else if (routine.sessionCommitment === 'asian') sessionName = 'Asian 🌏';
    infoRow.appendChild(el('span', 'premarket-info-item', `⏱️ Session: ${sessionName}`));

    const primedStatus = (routine.physicalPrimed && routine.mentalPrimed) ? 'Yes 🏋️🧘' : 'No ❌';
    infoRow.appendChild(el('span', 'premarket-info-item', `🧠 Primed: ${primedStatus}`));
    
    body.appendChild(infoRow);

    const btn = el('button', 'btn btn-secondary btn-sm', '🔄 Re-enter Routine Details');
    btn.style.marginTop = 'var(--space-3)';
    btn.addEventListener('click', () => {
      playSynthSound('click');
      routine.completed = false;
      storage.set('premarket_routine', routine);
      updateFocusBanner();
      renderPremarketWidget(container, isLockout);
    });
    body.appendChild(btn);
    container.appendChild(body);
    return;
  }

  // Else, render the interactive checklist
  const form = el('form', 'premarket-form');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
  });

  // Helper to create flexible step headers with status indicators
  function createStepHeader(labelText) {
    const header = el('div', 'premarket-step-header-flex');
    header.style.display = 'flex';
    header.style.justifyContent = 'space-between';
    header.style.alignItems = 'center';
    header.style.marginBottom = 'var(--space-2)';
    
    const label = el('label', 'premarket-step-label block', labelText);
    label.style.margin = '0';
    header.appendChild(label);
    
    const status = el('span', 'premarket-step-status');
    status.style.fontSize = '9px';
    status.style.fontWeight = '800';
    status.style.background = 'rgba(255, 255, 255, 0.04)';
    status.style.padding = '2px 6px';
    status.style.borderRadius = '4px';
    status.style.letterSpacing = '0.05em';
    status.style.textTransform = 'uppercase';
    status.style.border = '1px solid rgba(255, 255, 255, 0.08)';
    header.appendChild(status);
    
    return { header, label, status };
  }

  // Step 1: News Check
  const step1 = el('div', 'premarket-step');
  const step1Header = el('div', 'premarket-step-header');
  step1Header.style.display = 'flex';
  step1Header.style.alignItems = 'center';
  step1Header.style.width = '100%';

  const step1Checkbox = document.createElement('input');
  step1Checkbox.type = 'checkbox';
  step1Checkbox.id = `${isLockout ? 'lockout' : 'widget'}-premarket-news-check`;
  step1Checkbox.checked = routine.newsChecked;
  step1Checkbox.addEventListener('change', () => {
    routine.newsChecked = step1Checkbox.checked;
    storage.set('premarket_routine', routine);
    validateForm();
  });
  step1Header.appendChild(step1Checkbox);
  
  const step1Label = el('label', 'premarket-step-label', 'Step 1: Check Economic News Calendar 📰');
  step1Label.setAttribute('for', step1Checkbox.id);
  step1Label.style.marginLeft = 'var(--space-2)';
  step1Header.appendChild(step1Label);

  const step1Status = el('span', 'premarket-step-status');
  step1Status.style.marginLeft = 'auto';
  step1Status.style.fontSize = '9px';
  step1Status.style.fontWeight = '800';
  step1Status.style.background = 'rgba(255, 255, 255, 0.04)';
  step1Status.style.padding = '2px 6px';
  step1Status.style.borderRadius = '4px';
  step1Status.style.letterSpacing = '0.05em';
  step1Status.style.textTransform = 'uppercase';
  step1Status.style.border = '1px solid rgba(255, 255, 255, 0.08)';
  step1Header.appendChild(step1Status);
  step1.appendChild(step1Header);

  const step1Desc = el('p', 'premarket-step-desc');
  step1Desc.textContent = 'Review high-impact USD or currency-specific news events scheduled for today. ';
  
  const calendarLink = el('span', 'premarket-link', 'View Economic Calendar Widget ➔');
  calendarLink.style.cursor = 'pointer';
  calendarLink.style.color = 'var(--cyan)';
  calendarLink.style.fontSize = '12px';
  calendarLink.style.fontWeight = '700';
  calendarLink.addEventListener('click', () => {
    playSynthSound('click');
    // Scroll to the Volatility News Feed widget on dashboard or redirect
    if (isLockout) {
      router.navigate('#dashboard');
      setTimeout(() => {
        const newsWidget = document.querySelector('.news-panel');
        if (newsWidget) newsWidget.scrollIntoView({ behavior: 'smooth' });
      }, 500);
    } else {
      const newsWidget = document.querySelector('.news-panel');
      if (newsWidget) newsWidget.scrollIntoView({ behavior: 'smooth' });
    }
    step1Checkbox.checked = true;
    routine.newsChecked = true;
    storage.set('premarket_routine', routine);
    validateForm();
  });
  step1Desc.appendChild(calendarLink);
  step1.appendChild(step1Desc);
  form.appendChild(step1);

  // Step 1.5: Session Commitment
  const stepSession = el('div', 'premarket-step');
  const { header: stepSessionHeader, status: stepSessionStatus } = createStepHeader('Step 1.5: Commit to Trading Session ⏱️');
  stepSession.appendChild(stepSessionHeader);

  const sessionSegment = el('div', 'premarket-segment-control');
  const sessions = [
    { key: 'london', label: '🐂 London' },
    { key: 'newyork', label: '🇺🇸 New York' },
    { key: 'asian', label: '🌏 Asian' }
  ];

  sessions.forEach(s => {
    const btn = el('button', `segment-btn${routine.sessionCommitment === s.key ? ' active' : ''}`, s.label);
    btn.type = 'button';
    btn.addEventListener('click', () => {
      playSynthSound('click');
      routine.sessionCommitment = s.key;
      storage.set('premarket_routine', routine);
      sessionSegment.querySelectorAll('.segment-btn').forEach(x => x.classList.remove('active'));
      btn.classList.add('active');
      validateForm();
    });
    sessionSegment.appendChild(btn);
  });
  stepSession.appendChild(sessionSegment);
  form.appendChild(stepSession);

  // Step 2: HTF Bias
  const step2 = el('div', 'premarket-step');
  const { header: step2Header, status: step2Status } = createStepHeader('Step 2: Establish HTF Directional Bias (D1/H4) 🗺️');
  step2.appendChild(step2Header);
  
  const htfSegment = el('div', 'premarket-segment-control');
  const biases = [
    { key: 'bullish', label: '🐂 Bullish', color: 'var(--neon-green)' },
    { key: 'bearish', label: '🐻 Bearish', color: 'var(--neon-red)' },
    { key: 'consolidating', label: '🦀 Range', color: 'var(--text-secondary)' }
  ];
  
  biases.forEach(b => {
    const btn = el('button', `segment-btn${routine.htfBias === b.key ? ' active' : ''}`, b.label);
    btn.type = 'button';
    btn.addEventListener('click', () => {
      playSynthSound('click');
      routine.htfBias = b.key;
      storage.set('premarket_routine', routine);
      htfSegment.querySelectorAll('.segment-btn').forEach(x => x.classList.remove('active'));
      btn.classList.add('active');
      validateForm();
    });
    htfSegment.appendChild(btn);
  });
  step2.appendChild(htfSegment);

  const biasInput = document.createElement('input');
  biasInput.type = 'text';
  biasInput.className = 'form-input premarket-text-input';
  biasInput.placeholder = 'Provide a brief explanation of your HTF narrative bias...';
  biasInput.value = routine.htfLogic || '';
  biasInput.addEventListener('input', () => {
    routine.htfLogic = biasInput.value;
    storage.set('premarket_routine', routine);
    validateForm();
  });
  step2.appendChild(biasInput);
  form.appendChild(step2);

  // Step 2.5: Identify Key Liquidity & Price Levels (Asian H/L, OBs, FVGs) 🎯
  const stepLevels = el('div', 'premarket-step');
  const { header: stepLevelsHeader, status: stepLevelsStatus } = createStepHeader('Step 2.5: Identify Key Liquidity & Price Levels (Asian H/L, OBs, FVGs) 🎯');
  stepLevels.appendChild(stepLevelsHeader);

  const levelsInput = document.createElement('input');
  levelsInput.type = 'text';
  levelsInput.className = 'form-input premarket-text-input';
  levelsInput.placeholder = 'e.g. Asia High 1.0820, Asia Low 1.0780, H4 Demand OB 1.0750...';
  levelsInput.value = routine.keyLevels || '';
  levelsInput.addEventListener('input', () => {
    routine.keyLevels = levelsInput.value;
    storage.set('premarket_routine', routine);
    validateForm();
  });
  stepLevels.appendChild(levelsInput);
  form.appendChild(stepLevels);

  // Step 3: Drawdown Limit Plan
  const step3 = el('div', 'premarket-step');
  const { header: step3Header, status: step3Status } = createStepHeader('Step 3: Establish Max Risk Drawdown Limit 🛡️');
  step3.appendChild(step3Header);
  
  const riskInput = document.createElement('input');
  riskInput.type = 'text';
  riskInput.className = 'form-input premarket-text-input';
  riskInput.placeholder = 'e.g. 1% max daily loss, 2 losses max and stop...';
  riskInput.value = routine.riskLimit || '';
  riskInput.addEventListener('input', () => {
    routine.riskLimit = riskInput.value;
    storage.set('premarket_routine', routine);
    validateForm();
  });
  step3.appendChild(riskInput);
  form.appendChild(step3);

  // Step 4: Mindset Checklist
  const step4 = el('div', 'premarket-step');
  const { header: step4Header, status: step4Status } = createStepHeader('Step 4: Check Off Mindset & Daily Rules 🧠');
  step4.appendChild(step4Header);
  
  const rulesText = storage.get('notepad_text', '') || '';
  // Smart list/bullet parsing: extract lines starting with list/bullet markers
  let rulesList = rulesText
    .split('\n')
    .map(r => r.trim())
    .filter(r => r.startsWith('-') || r.startsWith('*') || r.startsWith('•') || /^\d+[\.\)]/.test(r))
    .map(r => r.replace(/^[-*•\d\.\)]+\s*/, '').trim())
    .filter(Boolean);

  const defaultRules = [
    "I will not overtrade or revenge trade.",
    "I will only enter trades at high-probability session killzones.",
    "I will follow my risk management rules perfectly."
  ];
  const rulesToUse = rulesList.length > 0 ? rulesList : defaultRules;

  const rulesListContainer = el('div', 'premarket-rules-checklist');
  let checkedRulesCount = 0;
  const checkboxes = [];

  rulesToUse.forEach((rule, idx) => {
    const row = el('div', 'premarket-rule-row');
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.id = `${isLockout ? 'lockout' : 'widget'}-premarket-rule-${idx}`;
    checkbox.addEventListener('change', () => {
      updateRulesChecked();
    });
    checkboxes.push(checkbox);
    row.appendChild(checkbox);

    const label = el('label', 'premarket-rule-label', rule);
    label.setAttribute('for', checkbox.id);
    row.appendChild(label);

    rulesListContainer.appendChild(row);
  });
  step4.appendChild(rulesListContainer);
  form.appendChild(step4);

  // Step 5: Focus Rule
  const step5 = el('div', 'premarket-step');
  const { header: step5Header, status: step5Status } = createStepHeader('Step 5: Set Daily Mindset Focus Rule 🎯');
  step5.appendChild(step5Header);

  const focusSelect = document.createElement('select');
  focusSelect.className = 'form-select premarket-select-input';
  focusSelect.style.width = '100%';
  focusSelect.style.marginBottom = 'var(--space-2)';
  focusSelect.style.background = 'var(--bg-glass)';
  focusSelect.style.color = 'var(--text-primary)';
  focusSelect.style.border = '1px solid var(--gray-border)';
  focusSelect.style.padding = 'var(--space-2) var(--space-3)';
  focusSelect.style.borderRadius = 'var(--radius-md)';
  
  const options = [
    { value: '', text: '— Choose daily focus rule —' },
    { value: 'Patience: Wait for valid session killzone timing', text: '⏱️ Patience: Wait for valid session killzone timing' },
    { value: 'Risk: Cap max risk per trade at 1% strictly', text: '🛡️ Risk: Cap max risk per trade at 1% strictly' },
    { value: 'Execution: Wait for FVG mitigation & CHOCH confirmation', text: '⚡ Execution: Wait for FVG mitigation & CHOCH confirmation' },
    { value: 'Mindset: Accept losses as information, do not revenge trade', text: '🧠 Mindset: Accept losses as information, do not revenge trade' },
    { value: 'Discipline: Stop trading after 2 losses or daily target reached', text: '⚖️ Discipline: Stop trading after 2 losses or daily target reached' },
    { value: 'custom', text: '✍️ Custom Focus Rule (write below)...' }
  ];

  options.forEach(o => {
    const opt = document.createElement('option');
    opt.value = o.value;
    opt.textContent = o.text;
    focusSelect.appendChild(opt);
  });

  const focusInput = document.createElement('input');
  focusInput.type = 'text';
  focusInput.className = 'form-input premarket-text-input';
  focusInput.placeholder = 'Write your custom daily mindset focus rule...';
  focusInput.style.display = 'none';

  if (routine.focusRule) {
    const matched = options.find(o => o.value === routine.focusRule && o.value !== '');
    if (matched) {
      focusSelect.value = routine.focusRule;
    } else {
      focusSelect.value = 'custom';
      focusInput.style.display = 'block';
      focusInput.value = routine.focusRule;
    }
  }

  focusSelect.addEventListener('change', () => {
    playSynthSound('click');
    if (focusSelect.value === 'custom') {
      focusInput.style.display = 'block';
      routine.focusRule = focusInput.value;
    } else {
      focusInput.style.display = 'none';
      routine.focusRule = focusSelect.value;
    }
    storage.set('premarket_routine', routine);
    validateForm();
  });

  focusInput.addEventListener('input', () => {
    routine.focusRule = focusInput.value;
    storage.set('premarket_routine', routine);
    validateForm();
  });

  step5.appendChild(focusSelect);
  step5.appendChild(focusInput);
  form.appendChild(step5);

  // Step 5.5: Priming
  const stepPriming = el('div', 'premarket-step');
  const { header: stepPrimingHeader, status: stepPrimingStatus } = createStepHeader('Step 5.5: Physical & Mental Priming 🏋️');
  stepPriming.appendChild(stepPrimingHeader);

  const primingContainer = el('div', 'premarket-rules-checklist');

  // Physical checkbox
  const physRow = el('div', 'premarket-rule-row');
  const physCheckbox = document.createElement('input');
  physCheckbox.type = 'checkbox';
  physCheckbox.id = `${isLockout ? 'lockout' : 'widget'}-premarket-phys-primed`;
  physCheckbox.checked = !!routine.physicalPrimed;
  physCheckbox.addEventListener('change', () => {
    routine.physicalPrimed = physCheckbox.checked;
    storage.set('premarket_routine', routine);
    validateForm();
  });
  physRow.appendChild(physCheckbox);

  const physLabel = el('label', 'premarket-rule-label', '🏋️ Physical priming completed (workout, stretching, or breakfast)');
  physLabel.setAttribute('for', physCheckbox.id);
  physRow.appendChild(physLabel);
  primingContainer.appendChild(physRow);

  // Mental checkbox
  const mentRow = el('div', 'premarket-rule-row');
  const mentCheckbox = document.createElement('input');
  mentCheckbox.type = 'checkbox';
  mentCheckbox.id = `${isLockout ? 'lockout' : 'widget'}-premarket-ment-primed`;
  mentCheckbox.checked = !!routine.mentalPrimed;
  mentCheckbox.addEventListener('change', () => {
    routine.mentalPrimed = mentCheckbox.checked;
    storage.set('premarket_routine', routine);
    validateForm();
  });
  mentRow.appendChild(mentCheckbox);

  const mentLabel = el('label', 'premarket-rule-label', '🧘 Mental priming completed (focused breathing or visualization rehearsal)');
  mentLabel.setAttribute('for', mentCheckbox.id);
  mentRow.appendChild(mentLabel);
  primingContainer.appendChild(mentRow);

  stepPriming.appendChild(primingContainer);
  form.appendChild(stepPriming);

  // Step 6: Start Mood Selector
  const step6 = el('div', 'premarket-step');
  const { header: step6Header, status: step6Status } = createStepHeader('Step 6: Starting Session Mood 🧘');
  step6.appendChild(step6Header);

  const moodWrapper = el('div', 'mood-picker');
  moodWrapper.style.display = 'flex';
  moodWrapper.style.gap = 'var(--space-2)';
  moodWrapper.style.marginTop = 'var(--space-2)';

  const moods = [
    { key: 'hyped', label: '🤩 Hyped' },
    { key: 'calm', label: '🧘 Calm' },
    { key: 'neutral', label: '😐 Neutral' },
    { key: 'anxious', label: '😰 Anxious' },
    { key: 'angry', label: '😡 Impatient' }
  ];

  moods.forEach(m => {
    const pill = el('button', 'btn btn-outline btn-sm mood-pill', m.label);
    pill.type = 'button';
    pill.style.padding = '4px 8px';
    pill.style.fontSize = '11px';
    
    if (routine.startMood === m.key) {
      pill.style.background = 'var(--purple-bg)';
      pill.style.borderColor = 'var(--purple)';
      pill.style.color = '#fff';
    }
    
    pill.addEventListener('click', () => {
      playSynthSound('click');
      routine.startMood = m.key;
      storage.set('premarket_routine', routine);
      
      moodWrapper.querySelectorAll('.mood-pill').forEach(btn => {
        btn.style.background = 'transparent';
        btn.style.borderColor = 'var(--cyan)';
        btn.style.color = 'var(--cyan)';
      });
      pill.style.background = 'var(--purple-bg)';
      pill.style.borderColor = 'var(--purple)';
      pill.style.color = '#fff';
      
      validateForm();
    });
    moodWrapper.appendChild(pill);
  });
  step6.appendChild(moodWrapper);
  form.appendChild(step6);

  // Unlock button
  const submitBtn = el('button', 'btn btn-primary btn-block premarket-submit-btn', '🔓 Complete Routine & Unlock Pages');
  submitBtn.type = 'submit';
  submitBtn.disabled = true;
  submitBtn.addEventListener('click', () => {
    if (submitBtn.disabled) return;
    playSynthSound('success');
    triggerConfetti();

    // 1. Mark as complete
    routine.completed = true;
    storage.set('premarket_routine', routine);

    // 2. Add history log
    const history = storage.get('premarket_history', {});
    history[today] = { ...routine, completedAt: new Date().toISOString() };
    storage.set('premarket_history', history);

    // 3. Award XP (+20 discipline bonus)
    addXP('Pre-Market Discipline Bonus', 20);
    showNotificationToast('Pre-Market Routine Completed! +20 XP! 🔓🪖');

    // 4. Sync with cloud
    import('./firebase-sync.js').then(({ pushToCloud, getCurrentUser }) => {
      if (getCurrentUser()) pushToCloud();
    });

    updateFocusBanner();

    // 5. Navigate to original target or re-render widget
    const originalTarget = storage.get('premarket_original_target') || '#dashboard';
    storage.delete('premarket_original_target');
    
    if (isLockout) {
      router.navigate(originalTarget);
    } else {
      renderPremarketWidget(container, isLockout);
    }
  });
  form.appendChild(submitBtn);

  container.appendChild(form);

  // Form validator function
  function validateForm() {
    const isStep1 = !!routine.newsChecked;
    const isStepSession = routine.sessionCommitment !== undefined && routine.sessionCommitment !== '';
    const isStep2 = routine.htfBias !== undefined && routine.htfBias !== '' && !!(routine.htfLogic && routine.htfLogic.trim());
    const isStepLevels = !!(routine.keyLevels && routine.keyLevels.trim());
    const isStep3 = !!(routine.riskLimit && routine.riskLimit.trim());
    const isStep4 = checkedRulesCount === rulesToUse.length;
    const isStep5 = !!(routine.focusRule && routine.focusRule.trim());
    const isStepPriming = !!(routine.physicalPrimed && routine.mentalPrimed);
    const isStep6 = !!routine.startMood;

    // Update status labels in real-time
    updateIndicator(step1Status, isStep1);
    updateIndicator(stepSessionStatus, isStepSession);
    updateIndicator(step2Status, isStep2);
    updateIndicator(stepLevelsStatus, isStepLevels);
    updateIndicator(step3Status, isStep3);
    updateIndicator(step4Status, isStep4, `${checkedRulesCount}/${rulesToUse.length}`);
    updateIndicator(step5Status, isStep5);
    updateIndicator(stepPrimingStatus, isStepPriming);
    updateIndicator(step6Status, isStep6);

    const allValid = isStep1 && isStepSession && isStep2 && isStepLevels && isStep3 && isStep4 && isStep5 && isStepPriming && isStep6;
    submitBtn.disabled = !allValid;
  }

  function updateIndicator(el, isValid, customText = '') {
    if (isValid) {
      el.textContent = customText ? `✓ ${customText}` : '✓ Ready';
      el.style.color = '#39ff14'; // Neon Green
      el.style.background = 'rgba(57, 255, 20, 0.08)';
      el.style.border = '1px solid rgba(57, 255, 20, 0.2)';
    } else {
      el.textContent = customText ? `⚠️ ${customText}` : '* Required';
      el.style.color = 'var(--text-muted)';
      el.style.background = 'rgba(255, 255, 255, 0.02)';
      el.style.border = '1px solid rgba(255, 255, 255, 0.05)';
    }
  }

  function updateRulesChecked() {
    checkedRulesCount = 0;
    checkboxes.forEach((cb) => {
      if (cb.checked) {
        checkedRulesCount++;
      }
    });
    validateForm();
  }

  // Initialize rules count and run validation check on load
  updateRulesChecked();
}

// --- Discipline Dashboard & Guardrails ---

function renderDisciplineWidget(container) {
  container.replaceChildren();

  const trades = getTrades();
  const todayStr = new Date().toISOString().slice(0, 10);
  const todaysTrades = trades.filter(t => {
    const d = t.date || (t.createdAt ? t.createdAt.slice(0, 10) : '');
    return d === todayStr;
  });

  // Rule breaks checklist for today
  const ruleBreaks = [];

  // 1. Skipped Pre-market Routine
  const routine = storage.get('premarket_routine');
  const premarketCompleted = routine && routine.date === todayStr && routine.completed === true;
  if (!premarketCompleted) {
    ruleBreaks.push({ cat: 'Skipped Pre-Market', desc: 'Pre-market routine not completed today.' });
  }

  // 2. Cooldown active
  const cooldownExpiry = storage.get('cooldown_expiry', 0);
  const isCooldownActive = cooldownExpiry > Date.now();
  if (isCooldownActive) {
    ruleBreaks.push({ cat: 'Revenge Cooldown', desc: 'Daily loss limit or revenge trade cooldown active.' });
  }

  // 3. Trade guardrail breaks
  todaysTrades.forEach((t, idx) => {
    const tradeNum = idx + 1;
    const g = t.guardrails || { newsChecked: true, htfBiasAligned: true, killzoneTiming: true, sizeCalculatorUsed: true };
    if (!g.newsChecked) {
      ruleBreaks.push({ cat: 'News Violation', desc: `Trade #${tradeNum} (${t.asset}): Traded before checking news.` });
    }
    if (!g.htfBiasAligned) {
      ruleBreaks.push({ cat: 'Bias Violation', desc: `Trade #${tradeNum} (${t.asset}): Traded against narrative HTF bias.` });
    }
    if (!g.killzoneTiming) {
      ruleBreaks.push({ cat: 'Outside Killzone', desc: `Trade #${tradeNum} (${t.asset}): Traded outside ICT Killzone hours.` });
    }
    if (!g.sizeCalculatorUsed) {
      ruleBreaks.push({ cat: 'Over-leveraged', desc: `Trade #${tradeNum} (${t.asset}): Position size calculator skipped.` });
    }
    if (t.emotionTag === 'revenge' || t.executionMindset === 'revenge' || t.mistake === 'revenge') {
      ruleBreaks.push({ cat: 'Revenge Traded', desc: `Trade #${tradeNum} (${t.asset}): Executed with a revenge mindset.` });
    }
  });

  // Calculate score
  let score = 100;
  if (!premarketCompleted) score -= 20;
  todaysTrades.forEach(t => {
    const g = t.guardrails || { newsChecked: true, htfBiasAligned: true, killzoneTiming: true, sizeCalculatorUsed: true };
    if (!g.newsChecked) score -= 15;
    if (!g.htfBiasAligned) score -= 15;
    if (!g.killzoneTiming) score -= 15;
    if (!g.sizeCalculatorUsed) score -= 10;
    if (t.emotionTag === 'revenge' || t.executionMindset === 'revenge' || t.mistake === 'revenge') score -= 30;
  });
  score = Math.max(0, score);

  // Sparkline history (rolling 7 days)
  const historyData = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dayStr = d.toISOString().slice(0, 10);
    const dayTrades = trades.filter(t => {
      const td = t.date || (t.createdAt ? t.createdAt.slice(0, 10) : '');
      return td === dayStr;
    });
    const dayHistory = storage.get('premarket_history', {});
    const dayRoutine = dayHistory[dayStr] || (dayStr === todayStr ? routine : null);
    const dayPremarket = dayRoutine && dayRoutine.completed === true;

    let dayScore = 100;
    if (!dayPremarket) dayScore -= 20;
    dayTrades.forEach(t => {
      const g = t.guardrails || { newsChecked: true, htfBiasAligned: true, killzoneTiming: true, sizeCalculatorUsed: true };
      if (!g.newsChecked) dayScore -= 15;
      if (!g.htfBiasAligned) dayScore -= 15;
      if (!g.killzoneTiming) dayScore -= 15;
      if (!g.sizeCalculatorUsed) dayScore -= 10;
      if (t.emotionTag === 'revenge' || t.executionMindset === 'revenge' || t.mistake === 'revenge') dayScore -= 30;
    });
    historyData.push({ date: dayStr, score: Math.max(0, dayScore) });
  }

  // Render elements
  const title = el('h3', 'overview-panel__title', '🛡️ Discipline Score');
  container.appendChild(title);

  const scoreContainer = el('div', 'discipline-score-container');

  // Gauge
  const gaugeBox = el('div', 'discipline-gauge-box');
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 100 100');
  svg.setAttribute('class', 'discipline-svg-gauge');

  const circleBg = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  circleBg.setAttribute('cx', '50');
  circleBg.setAttribute('cy', '50');
  circleBg.setAttribute('r', '40');
  circleBg.setAttribute('class', 'gauge-circle-bg');

  const circleVal = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  circleVal.setAttribute('cx', '50');
  circleVal.setAttribute('cy', '50');
  circleVal.setAttribute('r', '40');
  circleVal.setAttribute('class', 'gauge-circle-val');

  const circumference = 2 * Math.PI * 40; // ~251.3
  circleVal.style.strokeDasharray = circumference;
  const offset = circumference - (score / 100) * circumference;
  circleVal.style.strokeDashoffset = offset;

  let scoreColor = 'var(--neon-green)';
  if (score < 50) scoreColor = 'var(--neon-red)';
  else if (score < 80) scoreColor = 'var(--purple)'; // acid purple
  circleVal.style.stroke = scoreColor;

  svg.appendChild(circleBg);
  svg.appendChild(circleVal);
  gaugeBox.appendChild(svg);

  const scoreValText = el('span', 'discipline-score-val-text', `${score}%`);
  scoreValText.style.color = scoreColor;
  gaugeBox.appendChild(scoreValText);

  scoreContainer.appendChild(gaugeBox);

  // Stats / breaks list
  const breaksBox = el('div', 'discipline-breaks-box');
  if (ruleBreaks.length === 0) {
    const perfectText = el('p', 'discipline-perfect-text', '✨ 100% disciplined today! All rules followed.');
    perfectText.style.color = 'var(--neon-green)';
    breaksBox.appendChild(perfectText);
  } else {
    const subtitle = el('span', 'discipline-breaks-subtitle', `Rule Breaks today:`);
    subtitle.style.color = 'var(--neon-red)';
    breaksBox.appendChild(subtitle);

    const breaksList = el('ul', 'discipline-breaks-list');
    ruleBreaks.forEach(b => {
      const item = el('li', 'discipline-break-item');
      
      const badge = el('span', 'discipline-break-badge', b.cat);
      badge.style.color = 'var(--neon-red)';
      badge.style.background = 'rgba(255, 71, 87, 0.1)';
      badge.style.padding = '2px 6px';
      badge.style.borderRadius = '4px';
      badge.style.fontSize = '10px';
      badge.style.fontWeight = 'bold';
      badge.style.marginRight = '8px';
      
      const desc = el('span', 'discipline-break-desc', b.desc);
      desc.style.fontSize = '11px';
      desc.style.color = 'var(--text-muted)';
      
      item.appendChild(badge);
      item.appendChild(desc);
      breaksList.appendChild(item);
    });
    breaksBox.appendChild(breaksList);
  }
  scoreContainer.appendChild(breaksBox);
  container.appendChild(scoreContainer);

  // Sparkline
  const sparklineContainer = el('div', 'discipline-sparkline-container');
  sparklineContainer.appendChild(el('span', 'sparkline-title', 'Discipline History (7-Day):'));
  const sparklineRow = el('div', 'discipline-sparkline-row');
  historyData.forEach(day => {
    const dayCol = el('div', 'sparkline-day-col');
    dayCol.setAttribute('title', `${day.date}: ${day.score}%`);
    
    const barTrack = el('div', 'sparkline-bar-track');
    const barFill = el('div', 'sparkline-bar-fill');
    barFill.style.height = `${day.score}%`;
    let color = 'var(--neon-green)';
    if (day.score < 50) color = 'var(--neon-red)';
    else if (day.score < 80) color = 'var(--purple)';
    barFill.style.background = color;
    barTrack.appendChild(barFill);
    
    const label = el('span', 'sparkline-bar-label', day.date.slice(8, 10)); // e.g. "11"
    dayCol.appendChild(barTrack);
    dayCol.appendChild(label);
    sparklineRow.appendChild(dayCol);
  });
  sparklineContainer.appendChild(sparklineRow);
  container.appendChild(sparklineContainer);
}

// --- Dashboard ---

function renderDashboard(container) {
  try {
    checkAndApplyAutoFreezes();
  } catch (e) {
    console.error('Error running checkAndApplyAutoFreezes on dashboard load:', e);
  }

  container.replaceChildren();

  const trades = getTrades();
  const tradeStats = calculateStats(trades);

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

  // ── Discipline / Revenge Warning Banner ──
  const cooldownExpiry = storage.get('cooldown_expiry', 0);
  const isCooldownActive = cooldownExpiry > Date.now();
  const todayStr = new Date().toISOString().slice(0, 10);
  const todaysTrades = trades.filter(t => t.date === todayStr || (t.createdAt && t.createdAt.slice(0, 10) === todayStr));
  const hasRevengeTradeToday = todaysTrades.some(t => t.executionMindset === 'revenge' || t.mistake === 'revenge');

  if (isCooldownActive || hasRevengeTradeToday || (trades.length >= 3 && tradeStats.avgEdgeScore < 70)) {
    const alert = el('div', 'dashboard-discipline-alert');
    alert.style.background = 'rgba(242, 54, 69, 0.08)';
    alert.style.border = '1px dashed var(--neon-red)';
    alert.style.boxShadow = '0 0 15px rgba(242, 54, 69, 0.15)';
    alert.style.borderRadius = 'var(--radius-md)';
    alert.style.padding = 'var(--space-3) var(--space-4)';
    alert.style.marginBottom = 'var(--space-4)';
    alert.style.display = 'flex';
    alert.style.alignItems = 'center';
    alert.style.gap = 'var(--space-3)';
    alert.style.animation = 'fadeIn 0.3s ease';

    const icon = el('span', '', '⚠️');
    icon.style.fontSize = '1.8rem';
    alert.appendChild(icon);

    const textWrap = el('div', '');
    const title = el('h4', '', 'DISCIPLINE WARNING LEVEL: CRITICAL');
    title.style.color = 'var(--neon-red)';
    title.style.margin = '0';
    title.style.fontSize = '13px';
    title.style.fontWeight = '800';
    textWrap.appendChild(title);

    let msg = '';
    if (isCooldownActive) {
      const remainingMin = Math.ceil((cooldownExpiry - Date.now()) / 60000);
      msg = `Revenge trading cooldown active. System lockout in place for another ${remainingMin} minutes. Step away from the charts!`;
    } else if (hasRevengeTradeToday) {
      msg = 'Revenge trading detected in today\'s log. Protect your capital: close your charting platform and take a break.';
    } else {
      msg = `Your average Discipline EdgeScore is currently very low (${tradeStats.avgEdgeScore}%). You are trading with high emotional leakage. Review your rules!`;
    }

    const desc = el('p', '', msg);
    desc.style.margin = 'var(--space-1) 0 0 0';
    desc.style.fontSize = '12px';
    desc.style.color = 'var(--text-muted)';
    textWrap.appendChild(desc);
    alert.appendChild(textWrap);
    container.appendChild(alert);
  }

  // ── Review Reminders Due Alerts ──
  const reviews = storage.get('reviews', []) || [];
  const reviewAlertsContainer = el('div', 'dashboard-review-alerts');
  reviewAlertsContainer.style.display = 'flex';
  reviewAlertsContainer.style.flexDirection = 'column';
  reviewAlertsContainer.style.gap = 'var(--space-3)';
  reviewAlertsContainer.style.marginBottom = 'var(--space-4)';

  let hasReviewAlert = false;

  // 1. Check Weekly Review (Smart check for last 3 weeks with weekend inclusion)
  const currentDayOfWeek = now.getDay();
  const isWeekend = (currentDayOfWeek === 0 || currentDayOfWeek === 6);
  
  // On weekends (Sat/Sun), the week just ending (offset 0) is ready to be reviewed.
  const weeksToCheck = isWeekend ? [-2, -1, 0] : [-3, -2, -1];
  let weeklyPendingRange = null;
  let pendingOffset = 0;

  // Helper to get Monday/Sunday of a week given an offset in weeks (0 = current week, -1 = last week, etc.)
  const getWeekBounds = (weekOffset) => {
    const d = new Date(now);
    const currentDay = d.getDay();
    const daysToMonday = (currentDay === 0 ? 6 : currentDay - 1);
    d.setDate(d.getDate() - daysToMonday + (weekOffset * 7));
    
    const mon = new Date(d);
    mon.setHours(0,0,0,0);
    const sun = new Date(mon);
    sun.setDate(mon.getDate() + 6);
    sun.setHours(23,59,59,999);
    
    return {
      mondayStr: mon.toISOString().slice(0, 10),
      sundayStr: sun.toISOString().slice(0, 10)
    };
  };

  for (let offset of weeksToCheck) {
    const bounds = getWeekBounds(offset);
    const key = `weekly_${bounds.mondayStr}_${bounds.sundayStr}`;
    const isCompleted = reviews.some(r => r.type === 'weekly' && (r.periodKey === key || (r.startDate === bounds.mondayStr && r.endDate === bounds.sundayStr)));
    
    if (!isCompleted) {
      weeklyPendingRange = bounds;
      pendingOffset = offset;
      break; // Show the oldest pending weekly review
    }
  }

  if (weeklyPendingRange) {
    hasReviewAlert = true;
    const alert = el('div', 'dashboard-discipline-alert');
    alert.style.background = 'rgba(0, 212, 255, 0.06)';
    alert.style.border = '1px solid var(--cyan)';
    alert.style.borderRadius = 'var(--radius-md)';
    alert.style.padding = 'var(--space-3) var(--space-4)';
    alert.style.display = 'flex';
    alert.style.alignItems = 'center';
    alert.style.justifyContent = 'space-between';
    alert.style.gap = 'var(--space-3)';
    alert.style.animation = 'fadeIn 0.3s ease';

    const left = el('div', 'alert-left');
    left.style.display = 'flex';
    left.style.alignItems = 'center';
    left.style.gap = 'var(--space-3)';
    left.style.flex = '1';
    left.style.minWidth = '0';
    left.appendChild(el('span', '', '📅'));
    
    const textWrap = el('div', 'alert-text-wrap');
    textWrap.style.flex = '1';
    textWrap.style.minWidth = '0';
    const title = el('h4', '', 'Weekly Review Pending');
    title.style.color = 'var(--cyan)';
    title.style.margin = '0';
    title.style.fontSize = '13px';
    title.style.fontWeight = '800';
    textWrap.appendChild(title);

    const desc = el('p', '', `Your Weekly review for ${weeklyPendingRange.mondayStr} to ${weeklyPendingRange.sundayStr} is due. Reflect on your performance and earn +30 XP!`);
    desc.style.margin = 'var(--space-1) 0 0 0';
    desc.style.fontSize = '12px';
    desc.style.color = 'var(--text-muted)';
    textWrap.appendChild(desc);
    left.appendChild(textWrap);
    alert.appendChild(left);

    const actionBtn = el('button', 'btn btn-sm btn-secondary', 'Review Now');
    actionBtn.style.flexShrink = '0';
    actionBtn.addEventListener('click', () => {
      storage.set('active_review_tab', 'weekly');
      storage.set('active_review_period', pendingOffset === 0 ? 'current' : 'previous');
      router.navigate('#review');
    });
    alert.appendChild(actionBtn);
    reviewAlertsContainer.appendChild(alert);
  }

  // 2. Check Monthly Review
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
  const lastMonthStartStr = lastMonthStart.toISOString().slice(0, 10);
  const lastMonthEndStr = lastMonthEnd.toISOString().slice(0, 10);
  const monthlyCompleted = reviews.some(r => r.type === 'monthly' && r.startDate <= lastMonthStartStr && r.endDate >= lastMonthEndStr);

  if (!monthlyCompleted) {
    hasReviewAlert = true;
    const alert = el('div', 'dashboard-discipline-alert');
    alert.style.background = 'rgba(168, 85, 247, 0.06)';
    alert.style.border = '1px solid var(--purple)';
    alert.style.borderRadius = 'var(--radius-md)';
    alert.style.padding = 'var(--space-3) var(--space-4)';
    alert.style.display = 'flex';
    alert.style.alignItems = 'center';
    alert.style.justifyContent = 'space-between';
    alert.style.gap = 'var(--space-3)';
    alert.style.animation = 'fadeIn 0.3s ease';

    const left = el('div', 'alert-left');
    left.style.display = 'flex';
    left.style.alignItems = 'center';
    left.style.gap = 'var(--space-3)';
    left.style.flex = '1';
    left.style.minWidth = '0';
    left.appendChild(el('span', '', '📆'));
    
    const textWrap = el('div', 'alert-text-wrap');
    textWrap.style.flex = '1';
    textWrap.style.minWidth = '0';
    const title = el('h4', '', 'Monthly Review Pending');
    title.style.color = 'var(--purple)';
    title.style.margin = '0';
    title.style.fontSize = '13px';
    title.style.fontWeight = '800';
    textWrap.appendChild(title);

    const desc = el('p', '', `Your Monthly review for the previous month is due. Analyze your setups and earn +30 XP!`);
    desc.style.margin = 'var(--space-1) 0 0 0';
    desc.style.fontSize = '12px';
    desc.style.color = 'var(--text-muted)';
    textWrap.appendChild(desc);
    left.appendChild(textWrap);
    alert.appendChild(left);

    const actionBtn = el('button', 'btn btn-sm btn-secondary', 'Review Now');
    actionBtn.style.flexShrink = '0';
    actionBtn.addEventListener('click', () => {
      storage.set('active_review_tab', 'monthly');
      router.navigate('#review');
    });
    alert.appendChild(actionBtn);
    reviewAlertsContainer.appendChild(alert);
  }

  // 3. Check Quarterly Review
  const currentQuarter = Math.floor(now.getMonth() / 3);
  let prevQuarter = currentQuarter - 1;
  let prevQuarterYear = now.getFullYear();
  if (prevQuarter < 0) {
    prevQuarter = 3;
    prevQuarterYear--;
  }
  const lastQuarterStart = new Date(prevQuarterYear, prevQuarter * 3, 1);
  const lastQuarterEnd = new Date(prevQuarterYear, (prevQuarter + 1) * 3, 0);
  const lastQuarterStartStr = lastQuarterStart.toISOString().slice(0, 10);
  const lastQuarterEndStr = lastQuarterEnd.toISOString().slice(0, 10);
  const quarterlyCompleted = reviews.some(r => r.type === 'quarterly' && r.startDate <= lastQuarterStartStr && r.endDate >= lastQuarterEndStr);

  if (!quarterlyCompleted) {
    hasReviewAlert = true;
    const alert = el('div', 'dashboard-discipline-alert');
    alert.style.background = 'rgba(236, 72, 153, 0.06)';
    alert.style.border = '1px solid #ec4899';
    alert.style.borderRadius = 'var(--radius-md)';
    alert.style.padding = 'var(--space-3) var(--space-4)';
    alert.style.display = 'flex';
    alert.style.alignItems = 'center';
    alert.style.justifyContent = 'space-between';
    alert.style.gap = 'var(--space-3)';
    alert.style.animation = 'fadeIn 0.3s ease';

    const left = el('div', 'alert-left');
    left.style.display = 'flex';
    left.style.alignItems = 'center';
    left.style.gap = 'var(--space-3)';
    left.style.flex = '1';
    left.style.minWidth = '0';
    left.appendChild(el('span', '', '📊'));
    
    const textWrap = el('div', 'alert-text-wrap');
    textWrap.style.flex = '1';
    textWrap.style.minWidth = '0';
    const title = el('h4', '', 'Quarterly Review Pending');
    title.style.color = '#ec4899';
    title.style.margin = '0';
    title.style.fontSize = '13px';
    title.style.fontWeight = '800';
    textWrap.appendChild(title);

    const desc = el('p', '', `Your Quarterly review is due. Reflect on your strategy and mindset evolution (+30 XP)!`);
    desc.style.margin = 'var(--space-1) 0 0 0';
    desc.style.fontSize = '12px';
    desc.style.color = 'var(--text-muted)';
    textWrap.appendChild(desc);
    left.appendChild(textWrap);
    alert.appendChild(left);

    const actionBtn = el('button', 'btn btn-sm btn-secondary', 'Review Now');
    actionBtn.style.flexShrink = '0';
    actionBtn.addEventListener('click', () => {
      storage.set('active_review_tab', 'quarterly');
      router.navigate('#review');
    });
    alert.appendChild(actionBtn);
    reviewAlertsContainer.appendChild(alert);
  }

  if (hasReviewAlert) {
    container.appendChild(reviewAlertsContainer);
  }

  /* ---- Live stats grid ---- */
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
    { icon: '🧘', label: 'Review Hub', route: '#review' },
    { icon: '📝', label: 'Start Quiz', route: '#learning' },
    { icon: '🔥', label: 'Mark Streaks', route: '#streaks' },
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

  if (trades.length > 0) {
    const chartCard = el('div', 'overview-panel dashboard-chart-card glass-card');
    chartCard.style.padding = 'var(--space-4)';
    chartCard.style.marginBottom = 'var(--space-4)';
    chartCard.style.height = '320px';
    chartCard.style.position = 'relative';

    const chartHeader = el('div', 'dashboard-section__header');
    chartHeader.style.marginBottom = 'var(--space-2)';
    
    const chartTitle = el('h3', 'overview-panel__title', '📈 Equity Curve (Running P&L)');
    chartTitle.style.margin = '0';
    chartHeader.appendChild(chartTitle);
    chartCard.appendChild(chartHeader);

    const canvasContainer = el('div', 'dashboard-chart-container');
    canvasContainer.style.height = '230px';
    canvasContainer.style.position = 'relative';
    
    const canvas = document.createElement('canvas');
    canvas.id = 'dashboard-equity-chart';
    canvasContainer.appendChild(canvas);
    chartCard.appendChild(canvasContainer);
    container.appendChild(chartCard);

    // Render chart on next tick when canvas is in DOM
    setTimeout(() => {
      createEquityCurve('dashboard-equity-chart', trades);
    }, 0);
  }

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

  // 📝 Workspace Notepad & Scratchpad Card
  const notepadSection = el('div', 'dashboard-section notepad-section');
  
  const npHeader = el('div', 'dashboard-section__header');
  npHeader.style.display = 'flex';
  npHeader.style.justifyContent = 'space-between';
  npHeader.style.alignItems = 'center';
  npHeader.appendChild(el('h2', 'dashboard-section__title', '📝 Daily Rules & Scratchpad'));
  
  const modeBtn = el('button', 'btn btn-outline btn-sm np-toggle-btn', '👁️ View Checklist');
  modeBtn.style.padding = '4px 10px';
  modeBtn.style.fontSize = '10px';
  modeBtn.style.fontWeight = '700';
  npHeader.appendChild(modeBtn);
  notepadSection.appendChild(npHeader);

  const notepadCard = el('div', 'overview-panel notepad-card');
  notepadCard.style.padding = 'var(--space-4)';
  notepadCard.style.position = 'relative';

  const statusLabel = el('span', 'notepad-status-label', 'Saved ✓');
  statusLabel.style.position = 'absolute';
  statusLabel.style.bottom = 'var(--space-4)';
  statusLabel.style.right = 'var(--space-5)';
  statusLabel.style.fontSize = '10px';
  statusLabel.style.fontWeight = '700';
  statusLabel.style.color = 'var(--neon-green)';
  statusLabel.style.opacity = '0.7';

  const textarea = document.createElement('textarea');
  textarea.className = 'form-input notepad-textarea';
  textarea.placeholder = 'Type your trading rules, mindset focus points, or scratchpad notes here...\n\nExample:\n- I will not overtrade\n- Wait for FVG confirmation';
  textarea.value = storage.get('notepad_text', '');
  textarea.style.width = '100%';
  textarea.style.minHeight = '140px';
  textarea.style.background = 'rgba(255, 255, 255, 0.01)';
  textarea.style.border = '1px solid rgba(255,255,255,0.06)';
  textarea.style.borderRadius = 'var(--radius-md)';
  textarea.style.color = 'var(--text-primary)';
  textarea.style.fontFamily = 'var(--font-body)';
  textarea.style.fontSize = 'var(--text-sm)';
  textarea.style.resize = 'vertical';
  textarea.style.padding = 'var(--space-3)';
  textarea.style.paddingBottom = 'var(--space-6)'; // buffer for status label

  const checklistView = el('div', 'notepad-checklist-view');
  checklistView.style.width = '100%';
  checklistView.style.minHeight = '140px';
  checklistView.style.display = 'none';

  let debounceTimeout = null;
  textarea.addEventListener('input', () => {
    statusLabel.textContent = 'Typing...';
    statusLabel.style.color = 'var(--cyan)';
    
    clearTimeout(debounceTimeout);
    debounceTimeout = setTimeout(() => {
      storage.set('notepad_text', textarea.value);
      statusLabel.textContent = 'Saved ✓';
      statusLabel.style.color = 'var(--neon-green)';
      
      // Sync to cloud immediately
      import('./firebase-sync.js').then(({ pushToCloud, getCurrentUser }) => {
        if (getCurrentUser()) pushToCloud();
      });
    }, 1000);
  });

  function renderChecklistMode() {
    checklistView.replaceChildren();
    const text = textarea.value.trim();
    if (!text) {
      const hint = el('p', 'empty-hint', 'No rules defined. Click "✍️ Edit Rules" to write some!');
      hint.style.fontSize = 'var(--text-xs)';
      hint.style.color = 'var(--text-muted)';
      checklistView.appendChild(hint);
      return;
    }

    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    const listContainer = el('ul', 'notepad-chk-list');
    listContainer.style.listStyle = 'none';
    listContainer.style.display = 'flex';
    listContainer.style.flexDirection = 'column';
    listContainer.style.gap = 'var(--space-2)';

    let checkedStates = storage.get('notepad_checked_states', {});
    
    lines.forEach((line) => {
      const isRule = line.startsWith('-') || line.startsWith('*') || line.startsWith('•') || /^\d+[\.\)]/.test(line);
      const cleanLine = line.replace(/^[-*•\d\.\)]+\s*/, '').trim();

      const item = el('li', 'np-check-item');
      item.style.display = 'flex';
      item.style.alignItems = 'flex-start';
      item.style.gap = 'var(--space-2)';
      item.style.padding = 'var(--space-2) var(--space-3)';
      item.style.borderRadius = 'var(--radius-sm)';
      item.style.background = 'rgba(255, 255, 255, 0.01)';
      item.style.border = '1px solid rgba(255, 255, 255, 0.04)';
      item.style.transition = 'all 0.3s ease';

      if (isRule) {
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.style.marginTop = '3px';
        cb.style.cursor = 'pointer';
        cb.checked = !!checkedStates[cleanLine];

        const label = el('span', 'np-check-label', cleanLine);
        label.style.fontSize = 'var(--text-sm)';
        label.style.cursor = 'pointer';
        label.style.transition = 'all 0.3s ease';

        const updateStyle = (checked) => {
          if (checked) {
            label.style.textDecoration = 'line-through';
            label.style.color = 'var(--text-muted)';
            item.style.opacity = '0.6';
            item.style.borderColor = 'rgba(57, 255, 20, 0.1)';
            item.style.background = 'rgba(57, 255, 20, 0.01)';
          } else {
            label.style.textDecoration = 'none';
            label.style.color = 'var(--text-primary)';
            item.style.opacity = '1';
            item.style.borderColor = 'rgba(255, 255, 255, 0.04)';
            item.style.background = 'rgba(255, 255, 255, 0.01)';
          }
        };

        cb.addEventListener('change', () => {
          import('./audio.js').then(({ playSynthSound }) => {
            playSynthSound('click');
          });
          checkedStates[cleanLine] = cb.checked;
          storage.set('notepad_checked_states', checkedStates);
          updateStyle(cb.checked);
          
          import('./firebase-sync.js').then(({ pushToCloud, getCurrentUser }) => {
            if (getCurrentUser()) pushToCloud();
          });
        });

        label.addEventListener('click', () => {
          cb.checked = !cb.checked;
          cb.dispatchEvent(new Event('change'));
        });

        updateStyle(cb.checked);
        item.appendChild(cb);
        item.appendChild(label);
      } else {
        const textSpan = el('span', 'np-text-section', line);
        textSpan.style.fontSize = 'var(--text-xs)';
        textSpan.style.fontWeight = '700';
        textSpan.style.color = 'var(--cyan)';
        textSpan.style.textTransform = 'uppercase';
        textSpan.style.letterSpacing = '0.05em';
        item.appendChild(textSpan);
        item.style.background = 'transparent';
        item.style.border = 'none';
        item.style.padding = 'var(--space-1) 0';
        item.style.marginTop = 'var(--space-2)';
      }

      listContainer.appendChild(item);
    });

    checklistView.appendChild(listContainer);
  }

  let isChecklistMode = storage.get('notepad_is_checklist', true);
  
  const toggleView = (forceChecklist) => {
    isChecklistMode = forceChecklist !== undefined ? forceChecklist : !isChecklistMode;
    storage.set('notepad_is_checklist', isChecklistMode);
    
    if (isChecklistMode) {
      textarea.style.display = 'none';
      statusLabel.style.display = 'none';
      checklistView.style.display = 'block';
      modeBtn.textContent = '✍️ Edit Rules';
      renderChecklistMode();
    } else {
      textarea.style.display = 'block';
      statusLabel.style.display = 'block';
      checklistView.style.display = 'none';
      modeBtn.textContent = '👁️ View Checklist';
    }
  };

  modeBtn.addEventListener('click', () => {
    import('./audio.js').then(({ playSynthSound }) => {
      playSynthSound('click');
    });
    toggleView();
  });

  notepadCard.appendChild(textarea);
  notepadCard.appendChild(checklistView);
  notepadCard.appendChild(statusLabel);
  notepadSection.appendChild(notepadCard);
  leftCol.appendChild(notepadSection);
  toggleView(isChecklistMode);

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
  // Discipline Score Widget
  const disciplineWidget = el('div', 'overview-panel discipline-widget');
  renderDisciplineWidget(disciplineWidget);
  panelsCol.appendChild(disciplineWidget);

  // Pre-Market Routine Checklist Widget
  const premarketWidget = el('div', 'overview-panel premarket-routine-card');
  renderPremarketWidget(premarketWidget);
  panelsCol.appendChild(premarketWidget);

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

  function getDisciplineGrade(score) {
    if (score >= 90) return 'A+';
    if (score >= 80) return 'A';
    if (score >= 70) return 'B';
    if (score >= 60) return 'C';
    return 'F';
  }

  const scoreGrade = trades.length > 0 ? getDisciplineGrade(tradeStats.avgEdgeScore) : 'N/A';
  const oItems = [
    { label: 'Win Rate', value: `${tradeStats.winRate}%` },
    { label: 'Total P&L', value: formatCurrency(tradeStats.totalPnL) },
    { label: 'EdgeScore 🛡️', value: trades.length > 0 ? `${tradeStats.avgEdgeScore}% (${scoreGrade})` : '100% (A+)' },
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
  const localClock = el('div', 'kz-clock');
  localClock.appendChild(el('span', 'kz-clock__label', 'Local Time'));
  const localClockTime = el('span', 'kz-clock__value kz-clock__value--local', '00:00:00');
  localClock.appendChild(localClockTime);
  
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
    
    // Update local clock display
    const localTimeStr = now.toLocaleTimeString('en-US', { hour12: false });
    localClockTime.textContent = localTimeStr;
    
    // Get current NY time details via robust Intl components
    const ny = getNYTimeComponents();
    const nyHours = ny.hours;
    
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
      details.appendChild(el('span', 'kz-session-item__times', `${localRange}`));
      
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

// --- Achievement Badges / Trophies ---

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
      if (!habits.every(h => h.log && Object.prototype.hasOwnProperty.call(h.log, key) && h.log[key])) return false;
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
  { id: 'mindset-master', emoji: '🧘', name: 'Mindset Master', desc: 'Complete 10 focus or breathing sessions', check: () => storage.get('mindset_sessions_completed', 0) >= 10 },
  { id: 'clean-trader', emoji: '🧘', name: 'Clean Trader', desc: 'Log 10 consecutive trades without a psychological mistake', check: () => {
    const trades = getTrades();
    if (trades.length < 10) return false;
    const sorted = [...trades].sort((a,b) => new Date(a.date) - new Date(b.date));
    let run = 0;
    for (const t of sorted) {
      const hasMistake = t.mistake && t.mistake !== '' && t.mistake !== 'none';
      if (!hasMistake) {
        run++;
        if (run >= 10) return true;
      } else {
        run = 0;
      }
    }
    return false;
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
        if (habits.every(h => h.log && Object.prototype.hasOwnProperty.call(h.log, key) && h.log[key])) consec++;
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

// --- Weekly Recap Report ---

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
      if (h.log && Object.prototype.hasOwnProperty.call(h.log, key) && h.log[key]) totalCheckins++;
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
    habits.forEach(h => { if (h.log && Object.prototype.hasOwnProperty.call(h.log, key) && h.log[key]) score++; });
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

// --- Xp Real-time Dynamic Ui Helpers ---

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

function showXPToast(amount, action, streakMultiplier = 1.0) {
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
  const label = Object.prototype.hasOwnProperty.call(labels, action) ? labels[action] : action;
  const bonusSuffix = streakMultiplier > 1.0 ? ` +${Math.round((streakMultiplier - 1.0) * 100)}% Streak Bonus!` : '';

  toast.appendChild(el('span', 'xp-toast__icon', '⚡'));
  toast.appendChild(el('span', 'xp-toast__text', `+${amount} XP (${label}${bonusSuffix})`));
  
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
  // Play Fanfare Audio Chord
  playSynthSound('fanfare');

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
export function updateFocusBanner() {
  const banner = document.getElementById('focus-banner');
  if (!banner) return;
  const today = new Date().toISOString().slice(0, 10);
  const routine = storage.get('premarket_routine');
  const completed = routine && routine.date === today && routine.completed === true;
  const ruleText = routine && routine.focusRule;

  if (completed && ruleText && ruleText.trim() !== '') {
    banner.replaceChildren();
    banner.style.display = 'flex';
    
    const icon = el('span', 'focus-banner-icon', '🧠');
    const title = el('span', 'focus-banner-title', 'Daily Focus:');
    const content = el('span', 'focus-banner-content', ruleText);
    
    banner.appendChild(icon);
    banner.appendChild(title);
    banner.appendChild(content);
  } else {
    banner.style.display = 'none';
    banner.replaceChildren();
  }
}

// --- Backup & Restore Modal (Upgrade #24) ---
function openBackupRestoreModal() {
  const { body, close } = createModal('💾 Data Backup & Restore');

  const desc = el('p', '', 'Secure your hard-earned progress. Download your local data as a JSON file, or restore from a previous backup file.');
  desc.style.fontSize = 'var(--text-xs)';
  desc.style.color = 'var(--text-muted)';
  desc.style.lineHeight = '1.5';
  desc.style.marginBottom = 'var(--space-4)';
  body.appendChild(desc);

  // Grid layout for import/export cards
  const grid = el('div', 'backup-grid');
  grid.style.display = 'grid';
  grid.style.gridTemplateColumns = '1fr 1fr';
  grid.style.gap = 'var(--space-3)';
  grid.style.marginBottom = 'var(--space-3)';

  // Export card
  const exportCard = el('div', 'backup-card glass-card');
  exportCard.style.padding = 'var(--space-3)';
  exportCard.style.border = '1px solid rgba(0, 212, 255, 0.15)';
  exportCard.style.background = 'rgba(0, 212, 255, 0.02)';
  exportCard.style.borderRadius = 'var(--radius-md)';
  exportCard.style.display = 'flex';
  exportCard.style.flexDirection = 'column';
  exportCard.style.alignItems = 'center';
  exportCard.style.gap = 'var(--space-2)';
  exportCard.style.cursor = 'pointer';

  exportCard.appendChild(el('span', '', '📤'));
  const exportTitle = el('h4', '', 'Export Backup');
  exportTitle.style.fontSize = 'var(--text-sm)';
  exportTitle.style.fontWeight = '700';
  exportTitle.style.margin = '0';
  exportCard.appendChild(exportTitle);
  
  const exportDesc = el('p', '', 'Save all your local data as a .json file.');
  exportDesc.style.fontSize = '10px';
  exportDesc.style.color = 'var(--text-muted)';
  exportDesc.style.textAlign = 'center';
  exportCard.appendChild(exportDesc);

  exportCard.addEventListener('click', () => {
    import('./audio.js').then(({ playSynthSound }) => playSynthSound('success'));
    const backup = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('swagga:')) {
        backup[key] = localStorage.getItem(key);
      }
    }
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `swagga_hq_backup_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showNotificationToast('Backup exported successfully! 💾', '📤');
  });
  grid.appendChild(exportCard);

  // Import card
  const importCard = el('div', 'backup-card glass-card');
  importCard.style.padding = 'var(--space-3)';
  importCard.style.border = '1px solid rgba(168, 85, 247, 0.15)';
  importCard.style.background = 'rgba(168, 85, 247, 0.02)';
  importCard.style.borderRadius = 'var(--radius-md)';
  importCard.style.display = 'flex';
  importCard.style.flexDirection = 'column';
  importCard.style.alignItems = 'center';
  importCard.style.gap = 'var(--space-2)';
  importCard.style.cursor = 'pointer';

  importCard.appendChild(el('span', '', '📥'));
  const importTitle = el('h4', '', 'Import Backup');
  importTitle.style.fontSize = 'var(--text-sm)';
  importTitle.style.fontWeight = '700';
  importTitle.style.margin = '0';
  importCard.appendChild(importTitle);

  const importDesc = el('p', '', 'Restore data from a saved .json file.');
  importDesc.style.fontSize = '10px';
  importDesc.style.color = 'var(--text-muted)';
  importDesc.style.textAlign = 'center';
  importCard.appendChild(importDesc);

  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = '.json';
  fileInput.style.display = 'none';

  fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = JSON.parse(evt.target.result);
        const keys = Object.keys(data);
        const hasSwaggaKeys = keys.some(k => k.startsWith('swagga:'));
        if (!hasSwaggaKeys) {
          showNotificationToast('Invalid backup file. SwaGGa data not found! ❌', '⚠️');
          return;
        }

        if (confirm('Importing this backup will overwrite your current local data. Are you sure?')) {
          keys.forEach(k => {
            if (k.startsWith('swagga:')) {
              localStorage.setItem(k, data[k]);
            }
          });
          showNotificationToast('Data restored successfully! Syncing... 🚀', '✅');
          import('./audio.js').then(({ playSynthSound }) => playSynthSound('success'));
          close();

          // Sync to cloud if user signed in
          import('./firebase-sync.js').then(async ({ pushToCloud, getCurrentUser }) => {
            if (getCurrentUser()) await pushToCloud();
            setTimeout(() => {
              window.location.reload();
            }, 1200);
          });
        }
      } catch (err) {
        showNotificationToast('Failed to parse JSON file! ❌', '⚠️');
      }
    };
    reader.readAsText(file);
  });

  importCard.appendChild(fileInput);
  importCard.addEventListener('click', () => {
    fileInput.click();
  });
  grid.appendChild(importCard);

  body.appendChild(grid);
}

// --- Build App Shell ---

function buildAppShell() {
  const app = document.getElementById('app');
  if (!app) return;
  app.replaceChildren();

  // ---- Mobile Top Header ----
  const mobileHeader = el('div', 'mobile-top-header');
  const headerLogo = el('span', 'mobile-header-logo', '🪖');
  const headerTitle = el('span', 'mobile-header-title', 'SwaGGa HQ');
  mobileHeader.appendChild(headerLogo);
  mobileHeader.appendChild(headerTitle);
  app.appendChild(mobileHeader);

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
      playSynthSound('click');
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

  // Group Sync and Sign Out side-by-side
  const syncActionsRow = el('div', 'sidebar-sync__actions-row');
  syncActionsRow.style.display = 'none';
  syncActionsRow.style.gap = 'var(--space-2)';
  syncActionsRow.style.marginTop = 'var(--space-2)';

  // Sync button
  const syncBtn = el('button', 'sidebar-sync__sync-btn', '🔄 Sync');
  syncBtn.style.flex = '1';
  syncBtn.style.margin = '0';
  syncBtn.style.padding = 'var(--space-2) var(--space-1)';
  syncBtn.style.fontSize = '11px';
  syncBtn.style.display = 'block';
  syncBtn.addEventListener('click', async () => {
    syncBtn.textContent = '⏳ ...';
    syncBtn.disabled = true;
    const result = await syncNow();
    syncBtn.textContent = result.success ? '✅ Done' : '❌ Fail';
    syncBtn.disabled = false;
    setTimeout(() => { syncBtn.textContent = '🔄 Sync'; }, 2000);
    if (result.success) {
      router.init();
      const sidebarXP = document.querySelector('.sidebar-xp');
      if (sidebarXP) {
        updateSidebarXP(sidebarXP);
      }
    }
  });
  syncActionsRow.appendChild(syncBtn);

  // Sign out
  const signOutBtn = el('button', 'sidebar-sync__signout', 'Sign Out');
  signOutBtn.style.flex = '1';
  signOutBtn.style.margin = '0';
  signOutBtn.style.padding = 'var(--space-2) var(--space-1)';
  signOutBtn.style.fontSize = '11px';
  signOutBtn.style.border = '1px solid rgba(255, 71, 87, 0.2)';
  signOutBtn.style.background = 'rgba(255, 71, 87, 0.04)';
  signOutBtn.style.color = 'var(--neon-red)';
  signOutBtn.style.fontWeight = '600';
  signOutBtn.style.display = 'block';
  signOutBtn.addEventListener('click', async () => {
    await firebaseSignOut();
  });
  syncActionsRow.appendChild(signOutBtn);

  syncSection.appendChild(syncActionsRow);

  // Listen for auth changes
  onAuthChange(async (user) => {
    if (user) {
      signInBtn.style.display = 'none';
      userRow.style.display = 'flex';
      syncActionsRow.style.display = 'flex';
      userAvatar.src = user.photoURL || '';
      userName.textContent = user.displayName || user.email || 'User';

      // Auto-sync on sign in
      syncBtn.textContent = '⏳ ...';
      const result = await syncNow();
      syncBtn.textContent = result.success ? '✅ Done' : '🔄 Sync';
      if (result.success) {
        setTimeout(() => { syncBtn.textContent = '🔄 Sync'; }, 2000);
        router.init();
        const sidebarXP = document.querySelector('.sidebar-xp');
        if (sidebarXP) {
          updateSidebarXP(sidebarXP);
        }
      }
    } else {
      signInBtn.style.display = 'block';
      userRow.style.display = 'none';
      syncActionsRow.style.display = 'none';
    }
  });

  // ---- Sidebar XP & Level widget ----
  const sidebarXP = el('div', 'sidebar-xp');
  sidebar.appendChild(sidebarXP);
  updateSidebarXP(sidebarXP);

  sidebar.appendChild(syncSection);

  // --- Cyber-Neon Theme Presets Selector in sidebar ---
  const themeContainer = el('div', 'sidebar-theme-container');
  themeContainer.style.display = 'flex';
  themeContainer.style.alignItems = 'center';
  themeContainer.style.justifyContent = 'space-between';
  themeContainer.style.background = 'rgba(255, 255, 255, 0.02)';
  themeContainer.style.border = '1px dashed rgba(255, 255, 255, 0.06)';
  themeContainer.style.borderRadius = 'var(--radius-md)';
  themeContainer.style.padding = 'var(--space-2) var(--space-3)';
  themeContainer.style.margin = 'var(--space-3) var(--space-4) var(--space-2)';

  const themeLabel = el('span', 'theme-switch-label');
  themeLabel.textContent = '🎨 Color:';
  themeLabel.style.fontSize = '11px';
  themeLabel.style.fontWeight = '800';
  themeLabel.style.color = 'var(--text-secondary)';
  themeLabel.style.textTransform = 'uppercase';
  themeLabel.style.letterSpacing = '0.05em';
  themeContainer.appendChild(themeLabel);

  const dotsContainer = el('div', 'theme-dots-row');
  dotsContainer.style.display = 'flex';
  dotsContainer.style.gap = 'var(--space-2)';

  const themes = [
    { key: 'cyan', color: '#00d4ff', label: 'Cyberpunk Cyan' },
    { key: 'purple', color: '#d946ef', label: 'Acid Purple' },
    { key: 'green', color: '#39ff14', label: 'Toxic Green' },
    { key: 'gold', color: '#ffcc00', label: 'Gold General' }
  ];

  const activeTheme = storage.get('neon_theme', 'cyan');

  themes.forEach(t => {
    const dot = el('button', `theme-dot theme-dot-${t.key}`);
    dot.setAttribute('title', t.label);
    dot.setAttribute('data-theme-key', t.key);
    dot.setAttribute('data-theme-color', t.color);
    dot.style.width = '14px';
    dot.style.height = '14px';
    dot.style.borderRadius = '50%';
    dot.style.border = t.key === activeTheme ? '2px solid #fff' : '1px solid rgba(255,255,255,0.2)';
    dot.style.background = t.color;
    dot.style.padding = '0';
    dot.style.cursor = 'pointer';
    dot.style.boxShadow = t.key === activeTheme ? `0 0 8px ${t.color}` : 'none';
    dot.style.transition = 'transform 0.2s, box-shadow 0.2s';

    dot.addEventListener('click', () => {
      import('./audio.js').then(({ playSynthSound }) => {
        playSynthSound('click');
      });
      setTheme(t.key);
      storage.set('neon_theme', t.key);
    });

    dotsContainer.appendChild(dot);
  });
  themeContainer.appendChild(dotsContainer);
  sidebar.appendChild(themeContainer);

  // Group Sound and Backup buttons side-by-side
  const utilsRow = el('div', 'sidebar-utils-row');
  utilsRow.style.display = 'flex';
  utilsRow.style.gap = 'var(--space-2)';
  utilsRow.style.margin = '0 var(--space-4) var(--space-3)';

  // 🔊 Retro Arcade Audio Mute Toggle in sidebar
  const audioMuted = storage.get('audio_muted', false);
  const audioBtn = el('button', 'theme-switch-btn audio-mute-btn');
  audioBtn.style.margin = '0';
  audioBtn.style.width = 'auto';
  audioBtn.style.flex = '1';
  audioBtn.style.padding = 'var(--space-2) var(--space-1)';
  const audioIcon = el('span', 'theme-switch-emoji', audioMuted ? '🔇 Sound Off' : '🔊 Sound On');
  audioBtn.appendChild(audioIcon);

  audioBtn.addEventListener('click', () => {
    import('./audio.js').then(({ toggleMute, playSynthSound }) => {
      const nextMuted = toggleMute();
      audioIcon.textContent = nextMuted ? '🔇 Sound Off' : '🔊 Sound On';
      if (!nextMuted) {
        playSynthSound('click');
      }
    });
  });
  utilsRow.appendChild(audioBtn);

  // 💾 Backup & Restore Button in sidebar
  const backupBtn = el('button', 'theme-switch-btn backup-restore-btn');
  backupBtn.style.margin = '0';
  backupBtn.style.width = 'auto';
  backupBtn.style.flex = '1';
  backupBtn.style.padding = 'var(--space-2) var(--space-1)';
  backupBtn.style.background = 'rgba(0, 212, 255, 0.05)';
  backupBtn.style.border = '1px solid rgba(0, 212, 255, 0.15)';
  backupBtn.style.color = 'var(--cyan)';
  
  const backupIcon = el('span', 'theme-switch-emoji', '💾 Backup');
  backupBtn.appendChild(backupIcon);

  backupBtn.addEventListener('click', () => {
    import('./audio.js').then(({ playSynthSound }) => {
      playSynthSound('click');
    });
    openBackupRestoreModal();
  });
  utilsRow.appendChild(backupBtn);

  sidebar.appendChild(utilsRow);

  // ⚡ Update App & Version panel in sidebar
  const updatePanel = el('div', 'sidebar-update-panel');
  
  const versionText = el('span', 'sidebar-version-text', 'v1.1.6');
  updatePanel.appendChild(versionText);

  const updateBtn = el('button', 'sidebar-update-btn', '⚡ Update App');
  updateBtn.type = 'button';
  updateBtn.addEventListener('click', async () => {
    updateBtn.textContent = '⏳ Clearing...';
    updateBtn.disabled = true;
    
    // Clear Service Workers
    if ('serviceWorker' in navigator) {
      try {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (let reg of registrations) {
          await reg.unregister();
        }
      } catch (e) {
        console.error('SW unregister failed:', e);
      }
    }
    
    // Clear Caches
    if ('caches' in window) {
      try {
        const keys = await caches.keys();
        for (let key of keys) {
          await caches.delete(key);
        }
      } catch (e) {
        console.error('Cache clear failed:', e);
      }
    }
    
    updateBtn.textContent = '🔄 Reloading...';
    setTimeout(() => {
      window.location.reload(true);
    }, 800);
  });
  
  updatePanel.appendChild(updateBtn);
  sidebar.appendChild(updatePanel);

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
      playSynthSound('click');
      router.navigate(hash);
      closeMobileMenu();
    });
    bottomNav.appendChild(item);
  });
  app.appendChild(bottomNav);

  // ---- Main content ----
  const main = el('main', 'main-content');
  main.id = 'main-content';

  // ---- Dynamic PWA Killzone Topbar HUD ----
  const topbar = el('div', 'killzone-topbar');
  topbar.id = 'killzone-topbar';
  topbar.style.display = 'none'; // Hidden when no session is active
  
  const tbLeft = el('div', 'killzone-topbar__left');
  const tbDot = el('div', 'killzone-topbar__dot');
  const tbText = el('span', 'killzone-topbar__text');
  tbLeft.appendChild(tbDot);
  tbLeft.appendChild(tbText);
  topbar.appendChild(tbLeft);
  
  const tbRight = el('div', 'killzone-topbar__right');
  
  const tbClockBox = el('div', 'killzone-topbar__clock-box');
  tbClockBox.appendChild(el('span', 'killzone-topbar__clock-label', 'Local Time'));
  const tbClockVal = el('span', 'killzone-topbar__clock-val', '00:00:00');
  tbClockBox.appendChild(tbClockVal);
  tbRight.appendChild(tbClockBox);
  
  const tbTimerBox = el('div', 'killzone-topbar__timer-box');
  tbTimerBox.appendChild(el('span', 'killzone-topbar__timer-label', 'Ends In'));
  const tbTimerVal = el('span', 'killzone-topbar__timer-val', '00:00:00');
  tbTimerBox.appendChild(tbTimerVal);
  tbRight.appendChild(tbTimerBox);
  
  topbar.appendChild(tbRight);
  
  main.appendChild(topbar);

  // Focus Banner Ticker
  const focusBanner = el('div', 'focus-banner');
  focusBanner.id = 'focus-banner';
  focusBanner.style.display = 'none';
  main.appendChild(focusBanner);

  const pages = ['dashboard', 'streaks', 'trading', 'calendar', 'chart', 'learning', 'simulator', 'premarket-lockout', 'cooldown-lockout', 'mindset', 'blitz', 'review', 'notebook', 'coach'];
  pages.forEach((page) => {
    const pageEl = el('div', 'page');
    pageEl.id = `page-${page}`;
    main.appendChild(pageEl);
  });

  app.appendChild(main);

  // Global Killzone Countdown Timer Interval
  function updateGlobalKillzoneTimer() {
    const now = new Date();
    const ny = getNYTimeComponents();
    
    // Find active session
    let activeSession = null;
    SESSIONS.forEach(s => {
      if (isSessionActive(ny.hours, s.start, s.end)) {
        activeSession = s;
      }
    });
    
    const topbarEl = document.getElementById('killzone-topbar');
    if (!topbarEl) return;
    
    if (activeSession) {
      const currentNYDate = new Date(ny.year, ny.month - 1, ny.day, ny.hours, ny.minutes, ny.seconds);
      
      let targetNYHour = activeSession.end;
      const targetNYDate = new Date(ny.year, ny.month - 1, ny.day, targetNYHour, 0, 0);
      if (activeSession.end <= activeSession.start) {
        targetNYDate.setDate(targetNYDate.getDate() + 1);
      }
      
      const diffMs = targetNYDate.getTime() - currentNYDate.getTime();
      
      if (diffMs > 0) {
        const hours = Math.floor(diffMs / 3600000);
        const minutes = Math.floor((diffMs % 3600000) / 60000);
        const seconds = Math.floor((diffMs % 60000) / 1000);
        const timeString = `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        
        tbText.replaceChildren();
        const strong = document.createElement('strong');
        strong.textContent = activeSession.label;
        tbText.appendChild(strong);
        
        const localRange = getConvertedLocalRange(activeSession.start, activeSession.end);
        const timeSpan = el('span');
        timeSpan.style.opacity = '0.65';
        timeSpan.style.fontSize = 'var(--text-xs)';
        timeSpan.style.marginLeft = 'var(--space-2)';
        timeSpan.style.fontWeight = '500';
        timeSpan.textContent = `(${localRange})`;
        tbText.appendChild(timeSpan);
        
        tbTimerVal.textContent = timeString;
        
        // Update topbar clock with current local time
        const localTimeStr = now.toLocaleTimeString('en-US', { hour12: false });
        tbClockVal.textContent = localTimeStr;
        
        topbarEl.style.display = 'flex';
      } else {
        topbarEl.style.display = 'none';
      }
    } else {
      topbarEl.style.display = 'none';
    }
  }
  
  updateGlobalKillzoneTimer();
  setInterval(updateGlobalKillzoneTimer, 1000);

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

// --- Login Screen ---

let _loginInteractiveArea = null;

function transitionToLoginButtons(interactiveArea) {
  interactiveArea.replaceChildren();

  // Google Sign-In button
  const googleBtn = el('button', 'login-google-btn animate-fade-in');
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
  interactiveArea.appendChild(googleBtn);

  // Offline fallback
  const skipBtn = el('button', 'login-skip animate-fade-in', 'Use offline — data syncs when you sign in later');
  skipBtn.addEventListener('click', () => {
    try {
      launchApp();
    } catch (launchErr) {
      console.error('Failed to launch application from skip:', launchErr);
      if (window.showGlobalError) {
        window.showGlobalError(
          'Application Launch Failed!',
          'An unexpected error occurred while launching SwaGGa HQ: ' + launchErr.message,
          'Please clear your browser cache or reset local storage.'
        );
      }
    }
  });
  interactiveArea.appendChild(skipBtn);
}

function showLoginScreen(isCheckingSession = false) {
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

  // Interactive Area
  const interactiveArea = el('div', 'login-interactive-area');
  interactiveArea.style.width = '100%';
  interactiveArea.style.display = 'flex';
  interactiveArea.style.flexDirection = 'column';
  interactiveArea.style.alignItems = 'center';
  interactiveArea.style.gap = 'var(--space-4)';
  interactiveArea.style.marginTop = 'var(--space-6)';

  if (isCheckingSession) {
    const loader = el('div', 'login-session-loader');
    loader.style.display = 'flex';
    loader.style.flexDirection = 'column';
    loader.style.alignItems = 'center';
    loader.style.gap = 'var(--space-3)';

    const spinner = el('div', 'login-spinner');
    spinner.style.width = '36px';
    spinner.style.height = '36px';
    spinner.style.borderRadius = '50%';
    spinner.style.border = '2px solid rgba(0, 212, 255, 0.1)';
    spinner.style.borderTopColor = 'var(--cyan)';
    spinner.style.animation = 'spin 1s infinite linear';

    const loaderText = el('span', 'login-loader-text', '⚡ Authenticating secure session...');
    loaderText.style.fontSize = 'var(--text-xs)';
    loaderText.style.fontFamily = 'var(--font-heading)';
    loaderText.style.fontWeight = '600';
    loaderText.style.color = 'var(--cyan)';
    loaderText.style.letterSpacing = '0.05em';
    loaderText.style.animation = 'pulse 2s infinite ease-in-out';

    loader.appendChild(spinner);
    loader.appendChild(loaderText);
    interactiveArea.appendChild(loader);
  } else {
    transitionToLoginButtons(interactiveArea);
  }

  card.appendChild(interactiveArea);
  screen.appendChild(card);
  appRoot.appendChild(screen);

  _loginInteractiveArea = interactiveArea;
}

// --- App Launch (after Login Or Skip) ---

function deduplicateReviews() {
  const reviews = storage.get('reviews', []) || [];
  if (!Array.isArray(reviews) || reviews.length === 0) return;

  const seen = new Map();
  let duplicateCount = 0;

  reviews.forEach(r => {
    if (!r || !r.type || !r.periodKey) return;
    const rKey = `${r.type}_${r.periodKey}`;
    const existing = seen.get(rKey);
    if (!existing) {
      seen.set(rKey, r);
    } else {
      duplicateCount++;
      const timeA = r.updatedAt ? new Date(r.updatedAt).getTime() : 0;
      const timeB = existing.updatedAt ? new Date(existing.updatedAt).getTime() : 0;
      if (timeA > timeB) {
        seen.set(rKey, r);
      }
    }
  });

  if (duplicateCount > 0) {
    const cleanedReviews = [...seen.values()];
    storage.set('reviews', cleanedReviews);
    console.log(`[Deduplicate] Removed ${duplicateCount} duplicate reviews.`);
    
    // Sync to cloud
    import('./firebase-sync.js').then(({ pushToCloud, getCurrentUser }) => {
      if (getCurrentUser()) {
        pushToCloud().then(ok => {
          console.log('[Deduplicate] Pushed cleaned reviews to cloud:', ok);
        });
      }
    }).catch(err => console.error('[Deduplicate] Sync failed:', err));
  }
}

let _appLaunched = false;

async function launchApp() {
  if (_appLaunched) return;
  _appLaunched = true;

  // Auto-apply streak freezes if tokens exist
  try {
    checkAndApplyAutoFreezes();
  } catch (e) {
    console.error('Error running checkAndApplyAutoFreezes on launch:', e);
  }

  // Auto-recovery for the user's streaks (Snapchat: 10, TikTok: 10, Duolingo: 10 logged + 44 base = 54)
  const habits = getHabits();
  const snapHabit = habits.find(h => h.id === 'snap');
  const snapLoggedCount = snapHabit && snapHabit.log ? Object.keys(snapHabit.log).length : 0;

  if (snapLoggedCount < 10) {
    const dates = [
      '2026-06-06', '2026-06-05', '2026-06-04', '2026-06-03', '2026-06-02',
      '2026-06-01', '2026-05-31', '2026-05-30', '2026-05-29', '2026-05-28'
    ];
    habits.forEach(h => {
      if (['snap', 'tiktok', 'duolingo'].includes(h.id)) {
        if (!h.log) h.log = {};
        dates.forEach(d => {
          h.log[d] = true;
        });
      }
    });
    storage.set('habits', habits);
    localStorage.setItem('streak_recovery_done_v2', 'true');
    import('./firebase-sync.js').then(({ pushToCloud, getCurrentUser }) => {
      if (getCurrentUser()) pushToCloud();
    });
  }

  buildAppShell();
  updateFocusBanner();

  // Deduplicate reviews by periodKey and type
  try {
    deduplicateReviews();
  } catch (e) {
    console.error('Error running deduplicateReviews:', e);
  }

  router.registerRoute('#dashboard', renderDashboard);
  router.registerRoute('#trading', renderTradingPage);
  router.registerRoute('#chart', renderChartPage);
  router.registerRoute('#learning', renderLearningPage);
  router.registerRoute('#streaks', renderStreaksPage);
  router.registerRoute('#calendar', renderCalendarPage);
  router.registerRoute('#simulator', renderSimulatorPage);
  router.registerRoute('#mindset', renderMindsetPage);
  router.registerRoute('#blitz', renderBlitzPage);
  router.registerRoute('#review', renderReviewPage);
  router.registerRoute('#notebook', renderNotebookPage);
  router.registerRoute('#coach', renderCoachPage);
  router.registerRoute('#premarket-lockout', renderPremarketLockoutScreen);
  router.registerRoute('#cooldown-lockout', renderCooldownLockoutScreen);

  // Real-time XP & Level progression reactive updater
  window.addEventListener('xp-change', (e) => {
    const { amount, action, leveledUp, oldLevel, newLevel, streakMultiplier } = e.detail;
    
    // 1. Show dynamic floating toast notification
    showXPToast(amount, action, streakMultiplier);
    
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

// --- Mobile Gestures & UX Polish ---

function initMobileGestures() {
  // Pull to Refresh
  const ptrContainer = document.createElement('div');
  ptrContainer.className = 'ptr-container';
  const ptrSpinner = document.createElement('div');
  ptrSpinner.className = 'ptr-spinner';
  ptrContainer.appendChild(ptrSpinner);
  document.body.appendChild(ptrContainer);

  let startY = 0;
  let currentY = 0;
  let pulling = false;

  document.body.addEventListener('touchstart', (e) => {
    if (window.scrollY === 0) {
      startY = e.touches[0].pageY;
      pulling = true;
    }
  }, { passive: true });

  document.body.addEventListener('touchmove', (e) => {
    if (!pulling) return;
    currentY = e.touches[0].pageY;
    const diff = currentY - startY;

    if (diff > 0) {
      ptrContainer.classList.add('ptr-container--pulling');
      const height = Math.min(diff * 0.4, 80);
      ptrContainer.style.height = `${height}px`;
      
      if (height >= 60 && !ptrContainer.dataset.bumped) {
        ptrContainer.dataset.bumped = 'true';
        nativeHaptic('light');
      } else if (height < 60) {
        delete ptrContainer.dataset.bumped;
      }
    }
  }, { passive: true });

  document.body.addEventListener('touchend', async () => {
    if (!pulling) return;
    pulling = false;
    delete ptrContainer.dataset.bumped;

    const height = parseInt(ptrContainer.style.height) || 0;
    ptrContainer.style.height = '0px';
    ptrContainer.classList.remove('ptr-container--pulling');

    if (height >= 60) {
      nativeHapticNotification('SUCCESS');
      const syncBtn = document.querySelector('.sidebar-sync__sync-btn');
      if (syncBtn) {
        syncBtn.click();
      }
    }
  });

  // Edge Swipe Sidebar
  let startX = 0;
  let currentX = 0;
  let swipingSidebar = false;

  document.body.addEventListener('touchstart', (e) => {
    const x = e.touches[0].clientX;
    const sidebar = document.getElementById('sidebar');
    const sidebarOpen = sidebar && sidebar.classList.contains('open');

    if (x < 30 && !sidebarOpen) {
      startX = x;
      swipingSidebar = 'open';
    } else if (sidebarOpen) {
      startX = x;
      swipingSidebar = 'close';
    }
  }, { passive: true });

  document.body.addEventListener('touchmove', (e) => {
    if (!swipingSidebar) return;
    currentX = e.touches[0].clientX;
    const diff = currentX - startX;
    
    if (swipingSidebar === 'open' && diff > 80) {
      const sidebar = document.getElementById('sidebar');
      if (sidebar && !sidebar.classList.contains('open')) {
        sidebar.classList.add('open');
        nativeHaptic('light');
        swipingSidebar = false;
      }
    } else if (swipingSidebar === 'close' && diff < -80) {
      const sidebar = document.getElementById('sidebar');
      if (sidebar && sidebar.classList.contains('open')) {
        sidebar.classList.remove('open');
        nativeHaptic('light');
        swipingSidebar = false;
      }
    }
  }, { passive: true });

  document.body.addEventListener('touchend', () => {
    swipingSidebar = false;
  });

  // Bottom Sheet Drag to Dismiss
  let activeModal = null;
  let modalStartY = 0;
  
  document.body.addEventListener('touchstart', (e) => {
    const handle = e.target.closest('.modal-swipe-handle');
    if (handle) {
      activeModal = handle.closest('.modal') || handle.closest('.trade-modal');
      if (activeModal) {
        modalStartY = e.touches[0].pageY;
        activeModal.style.transition = 'none';
      }
    }
  }, { passive: true });

  document.body.addEventListener('touchmove', (e) => {
    if (!activeModal) return;
    const currentY = e.touches[0].pageY;
    const diff = currentY - modalStartY;
    if (diff > 0) {
      activeModal.style.transform = `translateY(${diff}px)`;
    }
  }, { passive: true });

  document.body.addEventListener('touchend', (e) => {
    if (!activeModal) return;
    const modal = activeModal;
    activeModal = null;

    modal.style.transition = '';
    const transform = modal.style.transform;
    const match = transform ? transform.match(/translateY\((\d+)px\)/) : null;
    const diff = match ? parseInt(match[1]) : 0;
    modal.style.transform = '';

    if (diff > 120) {
      const closeBtn = modal.querySelector('.modal__close') || modal.querySelector('.trade-modal__close');
      if (closeBtn) {
        nativeHaptic('light');
        closeBtn.click();
      } else {
        const overlay = modal.closest('.modal-overlay') || modal.closest('.trade-modal-overlay');
        if (overlay) {
          overlay.style.opacity = '0';
          setTimeout(() => overlay.remove(), 250);
        }
      }
    }
  });
}

// --- Cyber-Neon Theme Engine ---
export function setTheme(themeKey) {
  const body = document.body;
  body.classList.remove('theme-cyan', 'theme-purple', 'theme-green', 'theme-gold');
  body.classList.add(`theme-${themeKey}`);
  
  // Update dots UI if sidebar is mounted
  const dots = document.querySelectorAll('.theme-dot');
  dots.forEach(d => {
    const key = d.getAttribute('data-theme-key');
    if (key === themeKey) {
      d.style.border = '2px solid #fff';
      const tColor = d.getAttribute('data-theme-color');
      d.style.boxShadow = `0 0 8px ${tColor}`;
      d.classList.add('active');
    } else {
      d.style.border = '1px solid rgba(255,255,255,0.2)';
      d.style.boxShadow = 'none';
      d.classList.remove('active');
    }
  });
}

// --- Init ---

function init() {
  // Temporary Cleanup for Episode 30 (run once if it exists)
  try {
    let changed = false;
    
    // Remove completion entry
    const lessons = storage.get('lessons', []);
    const filtered = lessons.filter(l => l.episodeId !== 'ep30');
    if (lessons.length !== filtered.length) {
      storage.set('lessons', filtered);
      changed = true;
      console.log('[App] Ep30 completion record removed successfully.');
    }

    // Remove unlock override so it locks back up
    const overrides = storage.get('bg_unlocked_lessons', {});
    if (overrides && overrides['ep30']) {
      delete overrides['ep30'];
      storage.set('bg_unlocked_lessons', overrides);
      changed = true;
      console.log('[App] Ep30 unlock override cleared successfully.');
    }

    if (changed) {
      // Push the updates to the cloud if a user is logged in
      import('./firebase-sync.js').then(({ pushToCloud, getCurrentUser }) => {
        if (getCurrentUser()) pushToCloud();
      }).catch(() => {});
    }
  } catch (e) {
    console.warn('[App] Cleanup failed:', e);
  }

  // Initialize mobile guestures/gestures
  initMobileGestures();

  // Initialize the saved visual theme (defaults to dark mode)
  const savedTheme = storage.get('theme', 'dark');
  document.documentElement.setAttribute('data-theme', savedTheme);

  // Initialize the cyber-neon theme engine
  const savedNeonTheme = storage.get('neon_theme', 'cyan');
  setTheme(savedNeonTheme);

  // Start periodic high-impact news alert scanner (every 60 seconds)
  setInterval(() => {
    const cached = storage.get('economic_calendar', null);
    if (cached) {
      checkAndVoiceNewsWarnings(cached);
    }
  }, 60000);

  // Show login screen in checking state first
  showLoginScreen(true);

  // When auth state resolves, either launch app or stay on login
  onAuthChange(async (user) => {
    if (user && !_appLaunched) {
      const textEl = document.querySelector('.login-loader-text');
      if (textEl) {
        textEl.textContent = '⚡ Authenticated secure session! Syncing cloud...';
        textEl.style.color = '#39ff14'; // Neon Green
        textEl.style.textShadow = '0 0 10px rgba(57, 255, 20, 0.4)';
      }
    }
    // Give a brief delay for a premium visual feedback loop
    setTimeout(async () => {
      if (user && !_appLaunched) {
        // Signed in — sync from cloud then launch
        try {
          // Add a 2.5-second timeout to sync on startup so a slow network never blocks the UI launch!
          await Promise.race([
            syncNow(),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Sync timeout')), 2500))
          ]);
        } catch (err) {
          console.warn('Initial cloud sync timed out or failed, proceeding with local data:', err);
        }
        try {
          await launchApp();
        } catch (launchErr) {
          console.error('Failed to launch application:', launchErr);
          if (window.showGlobalError) {
            window.showGlobalError(
              'Application Launch Failed!',
              'An unexpected error occurred while launching SwaGGa HQ: ' + launchErr.message,
              'Please clear your browser cache or reset local data. If this is on mobile, try closing and reopening the app.'
            );
          }
        }
      } else if (!_appLaunched) {
        // No session found — transition loader to show login buttons smoothly!
        if (_loginInteractiveArea) {
          transitionToLoginButtons(_loginInteractiveArea);
        }
      }
    }, 800); // 800ms brief loading to feel highly professional
  });
}

// Kick off native features (status bar, splash, notifications) — no-op on web
initNative().catch(err => console.warn('[App] Native init failed gracefully:', err));

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// --- Economic Calendar News Feed Widget Support ---

export function fetchEconomicCalendar() {
  const CACHE_KEY = 'economic_calendar';
  const FETCHED_KEY = 'economic_calendar_fetched';
  const CACHE_DURATION = 3 * 60 * 60 * 1000; // 3 hours

  const cachedData = storage.get(CACHE_KEY, null);
  const fetchedTime = storage.get(FETCHED_KEY, 0);
  const now = Date.now();

  if (cachedData && Array.isArray(cachedData) && (now - fetchedTime < CACHE_DURATION)) {
    return Promise.resolve(cachedData);
  }

  const targetUrl = 'https://nfs.faireconomy.media/ff_calendar_thisweek.json';

  if (isNative()) {
    return import('@capacitor/core').then(({ CapacitorHttp }) => {
      return CapacitorHttp.get({ url: targetUrl });
    }).then(res => {
      let data = res.data;
      if (typeof data === 'string') {
        data = JSON.parse(data);
      }
      if (!Array.isArray(data)) throw new Error('Invalid JSON structure');
      storage.set(CACHE_KEY, data);
      storage.set(FETCHED_KEY, now);
      return data;
    }).catch(err => {
      console.warn('Native news calendar fetch failed, using old cache or fallback...', err);
      if (cachedData && Array.isArray(cachedData)) {
        return cachedData;
      }
      return getCuratedFallbackEvents();
    });
  }

  const url = 'https://api.allorigins.win/raw?url=' + encodeURIComponent(targetUrl);
  return fetch(url)
    .then(res => {
      if (!res.ok) throw new Error('API request failed');
      return res.json();
    })
    .then(events => {
      if (!Array.isArray(events)) throw new Error('Invalid JSON structure');
      storage.set(CACHE_KEY, events);
      storage.set(FETCHED_KEY, now);
      return events;
    })
    .catch(err => {
      console.warn('Live news calendar fetch failed, using old cache or fallback...', err);
      if (cachedData && Array.isArray(cachedData)) {
        return cachedData;
      }
      return getCuratedFallbackEvents();
    });
}

function renderEconomicNewsWidget(container) {
  const filterRow = el('div', 'news-filter-row');
  filterRow.style.display = 'flex';
  filterRow.style.gap = 'var(--space-2)';
  filterRow.style.marginBottom = 'var(--space-3)';

  const btnAll = el('button', 'btn btn-xs', 'All Major News');
  btnAll.style.fontSize = '10px';
  btnAll.style.padding = '3px 8px';
  btnAll.style.borderRadius = '4px';

  const btnUSDHigh = el('button', 'btn btn-xs', '🔴 USD High Impact');
  btnUSDHigh.style.fontSize = '10px';
  btnUSDHigh.style.padding = '3px 8px';
  btnUSDHigh.style.borderRadius = '4px';

  filterRow.appendChild(btnAll);
  filterRow.appendChild(btnUSDHigh);
  container.appendChild(filterRow);

  const listContainer = el('div', 'news-list-container');
  container.appendChild(listContainer);

  const loadingText = el('p', 'news-loading-text', '🔄 Fetching live economic calendar...');
  loadingText.style.fontSize = 'var(--text-xs)';
  loadingText.style.color = 'var(--text-muted)';
  listContainer.appendChild(loadingText);

  function refreshNews() {
    listContainer.replaceChildren(loadingText);
    fetchEconomicCalendar()
      .then(events => {
        renderEventsList(listContainer, events);
      })
      .catch(err => {
        console.error('Failed to load economic news calendar:', err);
        listContainer.replaceChildren();
        listContainer.appendChild(el('p', 'news-empty-text', '❌ Failed to load economic calendar.'));
      });
  }

  function updateFilterButtons() {
    const active = storage.get('news_filter_usd_high', false);
    if (active) {
      btnUSDHigh.style.background = 'var(--cyan-bg)';
      btnUSDHigh.style.color = 'var(--cyan)';
      btnUSDHigh.style.borderColor = 'rgba(0, 212, 255, 0.3)';
      btnUSDHigh.style.boxShadow = '0 0 10px rgba(0, 212, 255, 0.1)';
      
      btnAll.style.background = 'rgba(255, 255, 255, 0.02)';
      btnAll.style.color = 'var(--text-secondary)';
      btnAll.style.borderColor = 'rgba(255, 255, 255, 0.05)';
      btnAll.style.boxShadow = 'none';
    } else {
      btnAll.style.background = 'var(--cyan-bg)';
      btnAll.style.color = 'var(--cyan)';
      btnAll.style.borderColor = 'rgba(0, 212, 255, 0.3)';
      btnAll.style.boxShadow = '0 0 10px rgba(0, 212, 255, 0.1)';
      
      btnUSDHigh.style.background = 'rgba(255, 255, 255, 0.02)';
      btnUSDHigh.style.color = 'var(--text-secondary)';
      btnUSDHigh.style.borderColor = 'rgba(255, 255, 255, 0.05)';
      btnUSDHigh.style.boxShadow = 'none';
    }
  }

  btnAll.addEventListener('click', () => {
    storage.set('news_filter_usd_high', false);
    updateFilterButtons();
    refreshNews();
  });

  btnUSDHigh.addEventListener('click', () => {
    storage.set('news_filter_usd_high', true);
    updateFilterButtons();
    refreshNews();
  });

  // Init
  updateFilterButtons();
  refreshNews();
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
  const filterUSDHigh = storage.get('news_filter_usd_high', false);
  const filtered = events
    .filter(e => {
      if (filterUSDHigh) {
        return e.country === 'USD' && e.impact === 'High';
      }
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

// Check and announce USD high-volatility news events starting in exactly 10 minutes
export function checkAndVoiceNewsWarnings(events) {
  if (!events || !Array.isArray(events)) return;
  const now = Date.now();
  const announced = storage.get('announced_news_warnings', {});
  let announcedChanged = false;

  events.forEach(e => {
    if (e.country === 'USD' && e.impact === 'High') {
      const eventTime = new Date(e.date).getTime();
      const diffMin = Math.round((eventTime - now) / 60000);
      
      // If it starts in 10 minutes (between 0 and 10 minutes from now)
      if (diffMin > 0 && diffMin <= 10) {
        const eventId = `${e.country}_${e.title}_${e.date}`;
        if (!announced[eventId]) {
          announced[eventId] = true;
          announcedChanged = true;
          
          announceNewsWarning(e);
        }
      }
    }
  });

  if (announcedChanged) {
    storage.set('announced_news_warnings', announced);
  }
}

function announceNewsWarning(event) {
  // 1. Show notification toast
  showNotificationToast(`⚠️ USD NEWS ALARM: ${event.title} in 10 mins!`);
  
  // 2. Play warning alert chime
  import('./audio.js').then(({ playSynthSound }) => {
    playSynthSound('fail');
  });
  
  // 3. Text-to-Speech (TTS)
  if ('speechSynthesis' in window) {
    const audioMuted = storage.get('audio_muted', false);
    if (!audioMuted) {
      setTimeout(() => {
        const text = `Warning. High volatility U.S. dollar news release, ${event.title}, in ten minutes. Manage your open positions.`;
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 0.95;
        utterance.volume = 1.0;
        utterance.pitch = 0.9;
        
        // Find English voice
        const voices = window.speechSynthesis.getVoices();
        const enVoice = voices.find(v => v.lang.startsWith('en-') && v.name.includes('Google'));
        if (enVoice) utterance.voice = enVoice;
        
        window.speechSynthesis.speak(utterance);
      }, 1200);
    }
  }
}
