// SwaGGa HQ — Streak Tracking Module (Redesigned)

import storage from './storage.js';
import { generateId, sanitizeText, triggerConfetti } from './utils.js';
import { addXP } from './xp.js';
import { playSynthSound } from './audio.js';

// --- Constants ---

const STORAGE_KEY = 'habits';

function localDateKey(d) {
  const dt = d || new Date();
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const day = String(dt.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export const DEFAULT_HABITS = [
  { id: 'snap',     name: 'Snapchat',  emoji: '👻', color: '#FFFC00', bgColor: 'rgba(255, 252, 0, 0.08)',  borderColor: 'rgba(255, 252, 0, 0.25)',  tagline: 'Keep the streak alive', baseStreak: 0 },
  { id: 'tiktok',   name: 'TikTok',    emoji: '🎵', color: '#ff0050', bgColor: 'rgba(255, 0, 80, 0.08)',   borderColor: 'rgba(255, 0, 80, 0.25)',   tagline: 'Scroll & create daily', baseStreak: 0 },
  { id: 'duolingo', name: 'Duolingo',  emoji: '🦉', color: '#58cc02', bgColor: 'rgba(88, 204, 2, 0.08)',   borderColor: 'rgba(88, 204, 2, 0.25)',   tagline: 'Never miss a lesson', baseStreak: 44 },
];

// --- Data Layer ---

// Initialise default habits if none exist, then return all habits.
export function getHabits() {
  let habits = storage.get(STORAGE_KEY, null);
  if (!habits) {
    habits = DEFAULT_HABITS.map((h) => ({ ...h, log: {}, freezes: {} }));
    storage.set(STORAGE_KEY, habits);
  } else {
    // Migration: add baseStreak if missing, initialize log/freezes if null, and enforce correct duolingo base
    let migrated = false;
    habits.forEach(h => {
      if (!h.log) {
        h.log = {};
        migrated = true;
      }
      if (!h.freezes) {
        h.freezes = {};
        migrated = true;
      }
      if (h.baseStreak === undefined) {
        const def = DEFAULT_HABITS.find(d => d.id === h.id);
        h.baseStreak = def ? def.baseStreak : 0;
        migrated = true;
      }
      // Force duolingo base streak to be exactly 44 (so 44 + logged days = correct count)
      if (h.id === 'duolingo' && h.baseStreak !== 44) {
        h.baseStreak = 44;
        migrated = true;
      }
    });
    if (migrated) _saveHabits(habits);
  }
  return habits;
}

function _saveHabits(habits) {
  storage.set(STORAGE_KEY, habits);
}

// Add a custom habit.
export function addHabit(name, emoji) {
  const habits = getHabits();
  const habit = {
    id: generateId(),
    name: sanitizeText(name, 60),
    emoji: sanitizeText(emoji, 4),
    color: '#00d4ff',
    bgColor: 'rgba(0, 212, 255, 0.08)',
    borderColor: 'rgba(0, 212, 255, 0.25)',
    tagline: 'Stay consistent',
    log: {},
    freezes: {},
  };
  habits.push(habit);
  _saveHabits(habits);

  // Push updates to cloud immediately if signed in
  import('./firebase-sync.js').then(({ pushToCloud, getCurrentUser }) => {
    if (getCurrentUser()) pushToCloud();
  });

  return habit;
}

// Toggle a habit's completion for a given date.
export function toggleHabit(habitId, date) {
  const dateKey = date || localDateKey();
  const habits = getHabits();
  const habit = habits.find((h) => h.id === habitId);
  if (!habit) return;
  if (habit.log[dateKey]) {
    delete habit.log[dateKey];
  } else {
    habit.log[dateKey] = true;
  }
  _saveHabits(habits);
}

export function calculateStreak(habitId) {
  const habits = getHabits();
  const habit = habits.find((h) => h.id === habitId);
  if (!habit) return 0;

  let streak = 0;
  const d = new Date();
  
  // If today is not checked (and not frozen), start counting from yesterday
  const todayKey = localDateKey(d);
  const todayDone = habit.log[todayKey] || (habit.freezes && habit.freezes[todayKey]);
  if (!todayDone) {
    d.setDate(d.getDate() - 1);
  }

  while (true) {
    const key = localDateKey(d);
    if (habit.log[key] || (habit.freezes && habit.freezes[key])) {
      streak++;
      d.setDate(d.getDate() - 1);
    } else {
      break;
    }
  }
  return streak + (habit.baseStreak || 0);
}

// Get the all-time best streak for a habit.
export function getBestStreak(habitId) {
  const habits = getHabits();
  const habit = habits.find((h) => h.id === habitId);
  if (!habit) return 0;

  const logDates = Object.keys(habit.log || {});
  const freezeDates = Object.keys(habit.freezes || {});
  const allDates = [...new Set([...logDates, ...freezeDates])].sort();
  if (!allDates.length) return 0;

  let best = 1;
  let current = 1;
  for (let i = 1; i < allDates.length; i++) {
    const prev = new Date(allDates[i - 1]);
    const curr = new Date(allDates[i]);
    const diffDays = Math.round((curr - prev) / 86_400_000);
    if (diffDays === 1) {
      current++;
      if (current > best) best = current;
    } else {
      current = 1;
    }
  }
  return best;
}

// Check whether ALL habits were completed on a given date.
export function isPerfectDay(date) {
  const dateKey = date || localDateKey();
  const habits = getHabits();
  if (!habits.length) return false;
  return habits.every((h) => h.log[dateKey] || (h.freezes && h.freezes[dateKey]));
}

// --- Dom Helpers ---

function el(tag, cls = '', text = '') {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text) node.textContent = text;
  return node;
}

// --- Render Functions ---

/* ---------- Fire Status Banner ------------------------------------ */

function renderFireBanner(container) {
  container.replaceChildren();
  const today = localDateKey();
  const habits = getHabits();
  const doneCount = habits.filter((h) => h.log[today] || (h.freezes && h.freezes[today])).length;
  const total = habits.length;
  const perfect = doneCount === total && total > 0;

  const banner = el('div', `fire-banner${perfect ? ' fire-banner--lit' : ''}`);

  // Fire icon
  const fireIcon = el('div', 'fire-banner__icon');
  fireIcon.textContent = perfect ? '🔥' : '🌑';
  banner.appendChild(fireIcon);

  // Status text
  const info = el('div', 'fire-banner__info');
  const title = el('h3', 'fire-banner__title');
  title.textContent = perfect ? 'PERFECT DAY!' : `${doneCount} of ${total} completed`;
  info.appendChild(title);

  const subtitle = el('p', 'fire-banner__subtitle');
  subtitle.textContent = perfect
    ? 'All habits done today — the fire is lit! 🔥'
    : `Complete ${total - doneCount} more to light the fire`;
  info.appendChild(subtitle);

  banner.appendChild(info);

  // Progress dots
  const dots = el('div', 'fire-banner__dots');
  habits.forEach((h) => {
    const isCompleted = h.log[today] || (h.freezes && h.freezes[today]);
    const dot = el('span', `fire-dot${isCompleted ? ' fire-dot--done' : ''}`);
    dot.style.backgroundColor = isCompleted ? (h.color || '#00d4ff') : 'rgba(255,255,255,0.1)';
    dot.setAttribute('title', h.name);
    dots.appendChild(dot);
  });
  banner.appendChild(dots);

  container.appendChild(banner);
}

/* ---------- Streak Freeze Helpers --------------------------------- */

function getRecentMissedDate(habit) {
  const d = new Date();
  d.setDate(d.getDate() - 1); // Yesterday
  const yesterdayKey = localDateKey(d);
  
  const yesterdayDone = habit.log[yesterdayKey] || (habit.freezes && habit.freezes[yesterdayKey]);
  if (!yesterdayDone) {
    return yesterdayKey;
  }
  return null;
}

function playFreezeAnimation(cardElement, callback) {
  cardElement.classList.add('habit-card-pro--freezing');
  
  const overlay = el('div', 'ice-animation-overlay');
  overlay.textContent = '❄️❄️❄️';
  cardElement.appendChild(overlay);
  
  setTimeout(() => {
    overlay.classList.add('ice-animation-overlay--fade');
    overlay.textContent = '🔥 Restored! 🔥';
  }, 1000);

  setTimeout(() => {
    cardElement.classList.remove('habit-card-pro--freezing');
    overlay.remove();
    callback();
  }, 2200);
}

/* ---------- Professional Habit Card ------------------------------- */

export function renderHabitCard(habit, onToggle) {
  const today = localDateKey();
  const done = !!habit.log[today];
  const streak = calculateStreak(habit.id);
  const best = getBestStreak(habit.id);

  const card = el('div', `habit-card-pro${done ? ' habit-card-pro--done' : ''}`);
  card.style.borderColor = done ? (habit.borderColor || 'rgba(0,212,255,0.25)') : 'rgba(255,255,255,0.06)';
  if (done) {
    card.style.background = habit.bgColor || 'rgba(0,212,255,0.08)';
  }

  // Top row: emoji + name + brand accent
  const header = el('div', 'habit-pro__header');

  const avatarWrap = el('div', 'habit-pro__avatar');
  avatarWrap.style.background = habit.bgColor || 'rgba(0,212,255,0.08)';
  avatarWrap.style.borderColor = habit.borderColor || 'rgba(0,212,255,0.25)';
  avatarWrap.appendChild(el('span', '', habit.emoji));
  header.appendChild(avatarWrap);

  const nameBlock = el('div', 'habit-pro__name-block');
  const nameEl = el('h3', 'habit-pro__name', habit.name);
  nameEl.style.color = done ? (habit.color || '#00d4ff') : '#ffffff';
  nameBlock.appendChild(nameEl);
  nameBlock.appendChild(el('p', 'habit-pro__tagline', habit.tagline || ''));
  header.appendChild(nameBlock);

  // Status badge
  const badge = el('span', `habit-pro__badge${done ? ' habit-pro__badge--done' : ''}`);
  badge.textContent = done ? '✓ Done' : 'Pending';
  if (done) {
    badge.style.background = habit.bgColor || 'rgba(0,212,255,0.08)';
    badge.style.color = habit.color || '#00d4ff';
    badge.style.borderColor = habit.borderColor || 'rgba(0,212,255,0.25)';
  }
  header.appendChild(badge);

  card.appendChild(header);

  // Stats row
  const stats = el('div', 'habit-pro__stats');

  const streakStat = el('div', 'habit-pro__stat');
  streakStat.appendChild(el('span', 'habit-pro__stat-value', String(streak)));
  streakStat.appendChild(el('span', 'habit-pro__stat-label', 'Current'));
  stats.appendChild(streakStat);

  const bestStat = el('div', 'habit-pro__stat');
  bestStat.appendChild(el('span', 'habit-pro__stat-value', String(best)));
  bestStat.appendChild(el('span', 'habit-pro__stat-label', 'Best'));
  stats.appendChild(bestStat);

  const totalStat = el('div', 'habit-pro__stat');
  const totalDays = Object.keys(habit.log || {}).length;
  totalStat.appendChild(el('span', 'habit-pro__stat-value', String(totalDays)));
  totalStat.appendChild(el('span', 'habit-pro__stat-label', 'Total'));
  stats.appendChild(totalStat);

  card.appendChild(stats);

  // Action buttons
  const actionRow = el('div', 'habit-pro__action');
  
  const toggleBtn = el('button', `habit-pro__btn${done ? ' habit-pro__btn--done' : ''}`);
  toggleBtn.textContent = done ? '✓ Completed' : 'Mark Done';
  if (done) {
    toggleBtn.style.background = habit.color || '#00d4ff';
    toggleBtn.style.borderColor = habit.color || '#00d4ff';
    toggleBtn.style.color = '#0a0a0f';
  }
  toggleBtn.addEventListener('click', () => {
    const wasDone = done;
    toggleHabit(habit.id);
    // Award XP when marking a habit as done (not when un-marking)
    if (!wasDone) {
      addXP('habit', 10);
      // Check for perfect day bonus (all habits done)
      const today = localDateKey();
      const allHabits = getHabits();
      if (allHabits.length > 0 && allHabits.every(h => h.log[today])) {
        addXP('perfectDay', 50);
        playSynthSound('fanfare'); // Triumphant arpeggio fanfare!
        triggerConfetti(); // Celebrate perfect day milestone!
      } else {
        playSynthSound('success'); // Ascending success beep arpeggio!
      }
    } else {
      playSynthSound('click'); // Quick navigation beep on unchecking
    }
    // Push updates to cloud immediately if signed in to prevent any lag or refresh loss
    import('./firebase-sync.js').then(({ pushToCloud, getCurrentUser }) => {
      if (getCurrentUser()) pushToCloud();
    });
    if (typeof onToggle === 'function') onToggle();
  });
  actionRow.appendChild(toggleBtn);

  // Freeze button if yesterday was missed
  const yesterdayKey = getRecentMissedDate(habit);
  if (yesterdayKey) {
    const tokens = storage.get('streak_freeze_tokens', 0);
    const freezeBtn = el('button', 'btn btn-outline btn-sm habit-pro__freeze-btn');
    freezeBtn.textContent = `❄️ Freeze Yesterday (${tokens > 0 ? 'Use Token' : '0 Tokens'})`;
    
    if (tokens > 0) {
      freezeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        
        // Consume token
        storage.set('streak_freeze_tokens', tokens - 1);
        
        // Add freeze date to habit
        if (!habit.freezes) habit.freezes = {};
        habit.freezes[yesterdayKey] = true;
        
        const habits = getHabits();
        const index = habits.findIndex(h => h.id === habit.id);
        if (index !== -1) {
          habits[index] = habit;
          _saveHabits(habits);
        }

        // Push updates to cloud immediately if signed in
        import('./firebase-sync.js').then(({ pushToCloud, getCurrentUser }) => {
          if (getCurrentUser()) pushToCloud();
        });
        
        playFreezeAnimation(card, () => {
          triggerConfetti(); // Celebrate restoring the streak!
          if (typeof onToggle === 'function') onToggle();
        });
      });
    } else {
      freezeBtn.disabled = true;
      freezeBtn.classList.add('btn-disabled');
    }
    actionRow.appendChild(freezeBtn);
  }

  card.appendChild(actionRow);

  return card;
}

/* ---------- Habit Cards Grid -------------------------------------- */

function renderHabitCards(container, onRefresh) {
  container.replaceChildren();
  const grid = el('div', 'habit-grid-pro');
  const habits = getHabits();
  habits.forEach((h) => {
    grid.appendChild(renderHabitCard(h, onRefresh));
  });
  container.appendChild(grid);
}

/* ---------- Calendar Heatmap (90 days) ----------------------------- */

export function renderCalendarHeatmap(container, habitData) {
  container.replaceChildren();
  const wrapper = el('div', 'heatmap-section');
  wrapper.appendChild(el('h2', 'section-title', '🗓️ Last 90 Days'));

  const grid = el('div', 'heatmap-grid');
  const totalHabits = habitData.length || 1;

  for (let i = 89; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = localDateKey(d);
    const count = habitData.filter((h) => h.log[key] || (h.freezes && h.freezes[key])).length;
    const ratio = count / totalHabits;

    const cell = el('div', 'heatmap-cell');
    let level = 0;
    if (ratio > 0 && ratio < 0.5) level = 1;
    else if (ratio >= 0.5 && ratio < 1) level = 2;
    else if (ratio === 1) level = 3;
    cell.classList.add(`heat-${level}`);

    cell.setAttribute('title', `${key}: ${count}/${totalHabits}`);
    cell.setAttribute('aria-label', `${key}: ${count} of ${totalHabits} habits done`);
    grid.appendChild(cell);
  }

  wrapper.appendChild(grid);

  // Legend explaining the heat-levels
  const legend = el('div', 'heatmap-legend');
  legend.style.display = 'flex';
  legend.style.justifyContent = 'flex-end';
  legend.style.alignItems = 'center';
  legend.style.gap = '6px';
  legend.style.marginTop = 'var(--space-3)';
  legend.style.fontSize = 'var(--text-xs)';
  legend.style.color = 'var(--text-muted)';

  legend.appendChild(el('span', '', 'Less'));
  [0, 1, 2, 3].forEach(lvl => {
    const box = el('div', `heatmap-cell heat-${lvl}`);
    box.style.width = '12px';
    box.style.height = '12px';
    box.style.borderRadius = '2px';
    box.style.aspectRatio = '1';
    legend.appendChild(box);
  });
  legend.appendChild(el('span', '', 'More (Perfect Day ⚡)'));
  wrapper.appendChild(legend);

  container.appendChild(wrapper);
}

/* ---------- Add Habit Form ---------------------------------------- */

function renderAddHabitForm(container, onSaved) {
  container.replaceChildren();
  const wrapper = el('div', 'add-habit-section');
  wrapper.appendChild(el('h2', 'section-title', '➕ Add Habit'));

  const form = el('form', 'habit-form');
  form.setAttribute('novalidate', '');

  const nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.name = 'name';
  nameInput.placeholder = 'Habit name';
  nameInput.required = true;
  nameInput.maxLength = 60;
  const nGroup = el('div', 'form-group');
  nameInput.classList.add('form-input');
  nGroup.appendChild(el('label', 'form-label', 'Name'));
  nGroup.appendChild(nameInput);
  form.appendChild(nGroup);

  const emojiInput = document.createElement('input');
  emojiInput.type = 'text';
  emojiInput.name = 'emoji';
  emojiInput.placeholder = '🎯';
  emojiInput.maxLength = 4;
  const eGroup = el('div', 'form-group');
  emojiInput.classList.add('form-input');
  eGroup.appendChild(el('label', 'form-label', 'Emoji'));
  eGroup.appendChild(emojiInput);
  form.appendChild(eGroup);

  const submitBtn = el('button', 'btn btn-primary', 'Add Habit ✨');
  submitBtn.type = 'submit';
  form.appendChild(submitBtn);

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const name = (fd.get('name') || '').trim();
    if (!name) {
      nameInput.focus();
      return;
    }
    addHabit(name, fd.get('emoji') || '✅');
    form.reset();
    if (typeof onSaved === 'function') onSaved();
  });

  wrapper.appendChild(form);
  container.appendChild(wrapper);
}

/* ---------- Stats Overview ---------------------------------------- */

function renderOverviewStats(container) {
  container.replaceChildren();
  const habits = getHabits();
  const bar = el('div', 'stats-bar');

  const activeStreaks = habits.reduce((s, h) => s + (calculateStreak(h.id) > 0 ? 1 : 0), 0);
  const bestStreak = Math.max(0, ...habits.map((h) => getBestStreak(h.id)));

  let perfectCount = 0;
  for (let i = 0; i < 30; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    if (isPerfectDay(localDateKey(d))) perfectCount++;
  }

  const items = [
    { label: 'Active Streaks', value: String(activeStreaks), icon: '🔥' },
    { label: 'Best Streak', value: `${bestStreak} days`, icon: '🏆' },
    { label: 'Perfect Days (30d)', value: String(perfectCount), icon: '💯' },
  ];

  items.forEach(({ label, value, icon }) => {
    const card = el('div', 'stat-card');
    card.appendChild(el('span', 'stat-icon', icon));
    const info = el('div', 'stat-info');
    info.appendChild(el('span', 'stat-label', label));
    info.appendChild(el('span', 'stat-value', value));
    card.appendChild(info);
    bar.appendChild(card);
  });

  container.appendChild(bar);
}

// --- Main Render ---

function renderFreezeStatus(container) {
  container.replaceChildren();
  const tokens = storage.get('streak_freeze_tokens', 0);
  
  const card = el('div', 'freeze-banner-card');
  
  const icon = el('span', 'freeze-banner-icon', '❄️');
  card.appendChild(icon);
  
  const info = el('div', 'freeze-banner-info');
  const title = el('h3', 'freeze-banner-title', 'Streak Freeze Tokens');
  info.appendChild(title);
  
  const desc = el('p', 'freeze-banner-desc', 'Earn freezes by scoring 100% on quizzes or completing assignments. Use them to save your streak if you miss a day.');
  info.appendChild(desc);
  card.appendChild(info);
  
  const tokensContainer = el('div', 'freeze-tokens-wrap');
  for (let i = 1; i <= 3; i++) {
    const dot = el('span', `freeze-token-dot${i <= tokens ? ' freeze-token-dot--active' : ''}`);
    dot.textContent = '❄️';
    tokensContainer.appendChild(dot);
  }
  const label = el('span', 'freeze-tokens-count', `${tokens} / 3 Tokens`);
  tokensContainer.appendChild(label);
  
  card.appendChild(tokensContainer);
  container.appendChild(card);
}

// Build the full Streaks page.
export function renderStreaksPage(container) {
  container.replaceChildren();
  container.appendChild(el('h1', 'page-title', '🔥 Daily Streaks'));

  const freezeContainer = el('div');
  const fireContainer = el('div');
  const statsContainer = el('div');
  const cardsContainer = el('div');
  const heatmapContainer = el('div');
  const formContainer = el('div');

  container.appendChild(freezeContainer);
  container.appendChild(fireContainer);
  container.appendChild(statsContainer);
  container.appendChild(cardsContainer);
  container.appendChild(heatmapContainer);
  container.appendChild(formContainer);

  function refresh() {
    renderFireBanner(fireContainer);
    renderFreezeStatus(freezeContainer);
    renderOverviewStats(statsContainer);
    renderHabitCards(cardsContainer, refresh);
    renderCalendarHeatmap(heatmapContainer, getHabits());
  }

  refresh();
  renderAddHabitForm(formContainer, refresh);
}

// --- Streak Notifications ---

// Request notification permission and schedule streak reminders.
export function initStreakNotifications() {
  if (!('Notification' in window)) return;

  // Request permission on first visit
  if (Notification.permission === 'default') {
    Notification.requestPermission();
  }

  // Check every 30 minutes
  setInterval(() => {
    checkAndNotify();
  }, 30 * 60 * 1000);

  // Also check once on load
  setTimeout(() => checkAndNotify(), 5000);
}

function checkAndNotify() {
  if (Notification.permission !== 'granted') return;

  const now = new Date();
  const hour = now.getHours();

  // Only notify between 8 AM and 11 PM
  if (hour < 8 || hour > 23) return;

  const today = localDateKey(now);
  const habits = getHabits();
  const undone = habits.filter(h => !h.log[today]);

  if (undone.length === 0) return; // All done!

  // Don't spam — check if we already notified in the last 2 hours
  const lastNotif = storage.get('streak_last_notif', null);
  if (lastNotif) {
    const elapsed = Date.now() - new Date(lastNotif).getTime();
    if (elapsed < 2 * 60 * 60 * 1000) return; // 2 hours
  }

  // Build notification
  const names = undone.map(h => `${h.emoji} ${h.name}`).join(', ');
  const body = undone.length === habits.length
    ? `None of your streaks are done today! Don't break them 💥`
    : `${undone.length} streak${undone.length > 1 ? 's' : ''} left: ${names}`;

  const notif = new Notification('🪖 SwaGGa HQ — Streak Reminder', {
    body,
    icon: 'img/icon-512.png',
    badge: 'img/icon-512.png',
    tag: 'streak-reminder',
    renotify: true,
  });

  notif.addEventListener('click', () => {
    window.focus();
    window.location.hash = '#streaks';
    notif.close();
  });

  storage.set('streak_last_notif', new Date().toISOString());
}
