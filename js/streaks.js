/**
 * SwaGGa HQ — Streak Tracking Module (Redesigned)
 *
 * Professional habit cards with brand colors. Fire only lights
 * when ALL habits are completed for the day (perfect day).
 *
 * SECURITY:
 *  • All user input displayed via textContent — never innerHTML.
 *  • DOM built exclusively with createElement / appendChild.
 *  • Containers cleared with replaceChildren().
 */

import storage from './storage.js';
import { generateId, sanitizeText } from './utils.js';

/* ================================================================== */
/*  CONSTANTS                                                         */
/* ================================================================== */

const STORAGE_KEY = 'habits';

/** Default habits with brand-style theming. */
export const DEFAULT_HABITS = [
  { id: 'snap',     name: 'Snapchat',  emoji: '👻', color: '#FFFC00', bgColor: 'rgba(255, 252, 0, 0.08)',  borderColor: 'rgba(255, 252, 0, 0.25)',  tagline: 'Keep the streak alive' },
  { id: 'tiktok',   name: 'TikTok',    emoji: '🎵', color: '#ff0050', bgColor: 'rgba(255, 0, 80, 0.08)',   borderColor: 'rgba(255, 0, 80, 0.25)',   tagline: 'Scroll & create daily' },
  { id: 'duolingo', name: 'Duolingo',  emoji: '🦉', color: '#58cc02', bgColor: 'rgba(88, 204, 2, 0.08)',   borderColor: 'rgba(88, 204, 2, 0.25)',   tagline: 'Never miss a lesson' },
];

/* ================================================================== */
/*  DATA LAYER                                                        */
/* ================================================================== */

/**
 * Initialise default habits if none exist, then return all habits.
 * Each habit: { id, name, emoji, color, bgColor, borderColor, tagline, log: { 'YYYY-MM-DD': true } }
 * @returns {Array<object>}
 */
export function getHabits() {
  let habits = storage.get(STORAGE_KEY, null);
  if (!habits) {
    habits = DEFAULT_HABITS.map((h) => ({ ...h, log: {} }));
    storage.set(STORAGE_KEY, habits);
  }
  return habits;
}

function _saveHabits(habits) {
  storage.set(STORAGE_KEY, habits);
}

/**
 * Add a custom habit.
 * @param {string} name
 * @param {string} emoji
 * @returns {object} The new habit.
 */
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
  };
  habits.push(habit);
  _saveHabits(habits);
  return habit;
}

/**
 * Toggle a habit's completion for a given date.
 */
export function toggleHabit(habitId, date) {
  const dateKey = date || new Date().toISOString().slice(0, 10);
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

/**
 * Calculate current consecutive streak (counting back from today).
 */
export function calculateStreak(habitId) {
  const habits = getHabits();
  const habit = habits.find((h) => h.id === habitId);
  if (!habit) return 0;

  let streak = 0;
  const d = new Date();
  while (true) {
    const key = d.toISOString().slice(0, 10);
    if (habit.log[key]) {
      streak++;
      d.setDate(d.getDate() - 1);
    } else {
      break;
    }
  }
  return streak;
}

/**
 * Get the all-time best streak for a habit.
 */
export function getBestStreak(habitId) {
  const habits = getHabits();
  const habit = habits.find((h) => h.id === habitId);
  if (!habit) return 0;

  const dates = Object.keys(habit.log).sort();
  if (!dates.length) return 0;

  let best = 1;
  let current = 1;
  for (let i = 1; i < dates.length; i++) {
    const prev = new Date(dates[i - 1]);
    const curr = new Date(dates[i]);
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

/**
 * Check whether ALL habits were completed on a given date.
 */
export function isPerfectDay(date) {
  const dateKey = date || new Date().toISOString().slice(0, 10);
  const habits = getHabits();
  if (!habits.length) return false;
  return habits.every((h) => h.log[dateKey]);
}

/* ================================================================== */
/*  DOM HELPERS                                                       */
/* ================================================================== */

function el(tag, cls = '', text = '') {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text) node.textContent = text;
  return node;
}

/* ================================================================== */
/*  RENDER FUNCTIONS                                                  */
/* ================================================================== */

/* ---------- Fire Status Banner ------------------------------------ */

function renderFireBanner(container) {
  container.replaceChildren();
  const today = new Date().toISOString().slice(0, 10);
  const habits = getHabits();
  const doneCount = habits.filter((h) => h.log[today]).length;
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
    const dot = el('span', `fire-dot${h.log[today] ? ' fire-dot--done' : ''}`);
    dot.style.backgroundColor = h.log[today] ? (h.color || '#00d4ff') : 'rgba(255,255,255,0.1)';
    dot.setAttribute('title', h.name);
    dots.appendChild(dot);
  });
  banner.appendChild(dots);

  container.appendChild(banner);
}

/* ---------- Professional Habit Card ------------------------------- */

export function renderHabitCard(habit, onToggle) {
  const today = new Date().toISOString().slice(0, 10);
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

  // Action button
  const actionRow = el('div', 'habit-pro__action');
  const toggleBtn = el('button', `habit-pro__btn${done ? ' habit-pro__btn--done' : ''}`);
  toggleBtn.textContent = done ? '✓ Completed' : 'Mark Done';
  if (done) {
    toggleBtn.style.background = habit.color || '#00d4ff';
    toggleBtn.style.borderColor = habit.color || '#00d4ff';
    toggleBtn.style.color = '#0a0a0f';
  }
  toggleBtn.addEventListener('click', () => {
    toggleHabit(habit.id);
    if (typeof onToggle === 'function') onToggle();
  });
  actionRow.appendChild(toggleBtn);
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
    const key = d.toISOString().slice(0, 10);
    const count = habitData.filter((h) => h.log[key]).length;
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
    if (isPerfectDay(d.toISOString().slice(0, 10))) perfectCount++;
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

/* ================================================================== */
/*  MAIN RENDER                                                       */
/* ================================================================== */

/**
 * Build the full Streaks page.
 * @param {HTMLElement} container - #page-streaks element.
 */
export function renderStreaksPage(container) {
  container.replaceChildren();
  container.appendChild(el('h1', 'page-title', '🔥 Daily Streaks'));

  const fireContainer = el('div');
  const statsContainer = el('div');
  const cardsContainer = el('div');
  const heatmapContainer = el('div');
  const formContainer = el('div');

  container.appendChild(fireContainer);
  container.appendChild(statsContainer);
  container.appendChild(cardsContainer);
  container.appendChild(heatmapContainer);
  container.appendChild(formContainer);

  function refresh() {
    renderFireBanner(fireContainer);
    renderOverviewStats(statsContainer);
    renderHabitCards(cardsContainer, refresh);
    renderCalendarHeatmap(heatmapContainer, getHabits());
  }

  refresh();
  renderAddHabitForm(formContainer, refresh);
}
