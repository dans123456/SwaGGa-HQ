/**
 * SwaGGa HQ — Streak Tracking Module
 *
 * Track daily habits, compute consecutive streaks, and render a
 * 90-day calendar heatmap.
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

/** Default habits created on first run. */
export const DEFAULT_HABITS = [
  { id: 'snap', name: 'Snapchat', emoji: '👻' },
  { id: 'tiktok', name: 'TikTok', emoji: '🎵' },
  { id: 'duolingo', name: 'Duolingo', emoji: '🦉' },
];

/* ================================================================== */
/*  DATA LAYER                                                        */
/* ================================================================== */

/**
 * Initialise default habits if none exist, then return all habits.
 * Each habit: { id, name, emoji, log: { 'YYYY-MM-DD': true } }
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
    log: {},
  };
  habits.push(habit);
  _saveHabits(habits);
  return habit;
}

/**
 * Toggle a habit's completion for a given date.
 * @param {string} habitId
 * @param {string} [date] - ISO date string (YYYY-MM-DD). Defaults to today.
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
 * Calculate the current consecutive streak for a habit (counting back from today).
 * @param {string} habitId
 * @returns {number}
 */
export function calculateStreak(habitId) {
  const habits = getHabits();
  const habit = habits.find((h) => h.id === habitId);
  if (!habit) return 0;

  let streak = 0;
  const d = new Date();
  // eslint-disable-next-line no-constant-condition
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
 * @param {string} habitId
 * @returns {number}
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
 * Check whether all habits were completed on a given date.
 * @param {string} [date] - YYYY-MM-DD, defaults to today.
 * @returns {boolean}
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

/* ---------- Stats Overview ---------------------------------------- */

function renderOverviewStats(container) {
  container.replaceChildren();
  const habits = getHabits();
  const bar = el('div', 'stats-bar');

  const activeStreaks = habits.reduce((s, h) => s + (calculateStreak(h.id) > 0 ? 1 : 0), 0);
  const bestStreak = Math.max(0, ...habits.map((h) => getBestStreak(h.id)));

  // Perfect days in last 30 days.
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
    card.appendChild(el('span', 'stat-label', label));
    card.appendChild(el('span', 'stat-value', value));
    bar.appendChild(card);
  });

  container.appendChild(bar);
}

/* ---------- Habit Card -------------------------------------------- */

/**
 * Render a single habit card with toggle and streak info.
 * @param {object} habit
 * @param {Function} onToggle - Called after toggling, so page can re-render.
 * @returns {HTMLElement}
 */
export function renderHabitCard(habit, onToggle) {
  const today = new Date().toISOString().slice(0, 10);
  const done = !!habit.log[today];
  const streak = calculateStreak(habit.id);

  const card = el('div', `habit-card${done ? ' habit-done' : ''}`);

  // Emoji + name.
  const header = el('div', 'habit-header');
  header.appendChild(el('span', 'habit-emoji', habit.emoji));
  header.appendChild(el('span', 'habit-name', habit.name));
  card.appendChild(header);

  // Streak count.
  const streakEl = el('div', 'habit-streak');
  streakEl.appendChild(el('span', 'streak-fire', streak > 0 ? '🔥' : ''));
  streakEl.appendChild(el('span', 'streak-count', `${streak} day${streak !== 1 ? 's' : ''}`));
  card.appendChild(streakEl);

  // Toggle button.
  const toggleBtn = el('button', `btn btn-toggle${done ? ' active' : ''}`, done ? '✅ Done' : '⬜ Mark Done');
  toggleBtn.addEventListener('click', () => {
    toggleHabit(habit.id);
    if (typeof onToggle === 'function') onToggle();
  });
  card.appendChild(toggleBtn);

  return card;
}

/* ---------- Habit Cards Grid -------------------------------------- */

function renderHabitCards(container, onRefresh) {
  container.replaceChildren();
  const grid = el('div', 'habit-grid');
  const habits = getHabits();
  habits.forEach((h) => {
    grid.appendChild(renderHabitCard(h, onRefresh));
  });
  container.appendChild(grid);
}

/* ---------- Calendar Heatmap (90 days) ----------------------------- */

/**
 * Render a 90-day grid heatmap for all habits combined.
 * A day cell's intensity reflects the fraction of habits completed.
 * @param {HTMLElement} container
 * @param {Array<object>} habitData
 */
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
    // Intensity levels 0-4.
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

/* ================================================================== */
/*  MAIN RENDER                                                       */
/* ================================================================== */

/**
 * Build the full Streaks page.
 * @param {HTMLElement} container - #page-streaks element.
 */
export function renderStreaksPage(container) {
  container.replaceChildren();
  container.appendChild(el('h1', 'page-title', '🔥 Streaks'));

  const statsContainer = el('div');
  const cardsContainer = el('div');
  const heatmapContainer = el('div');
  const formContainer = el('div');

  container.appendChild(statsContainer);
  container.appendChild(cardsContainer);
  container.appendChild(heatmapContainer);
  container.appendChild(formContainer);

  function refresh() {
    renderOverviewStats(statsContainer);
    renderHabitCards(cardsContainer, refresh);
    renderCalendarHeatmap(heatmapContainer, getHabits());
  }

  refresh();
  renderAddHabitForm(formContainer, refresh);
}
