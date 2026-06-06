// SwaGGa HQ — Streak Tracking Module (Redesigned)

import storage from './storage.js';
import { generateId, sanitizeText, triggerConfetti, showNotificationToast } from './utils.js';
import { addXP } from './xp.js';
import { playSynthSound } from './audio.js';
import router from './router.js';
import {
  nativeHaptic,
  nativeHapticNotification,
  sendLocalNotification,
  scheduleDailyReminder,
  cancelNotification
} from './native-bridge.js';

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
  { id: 'duolingo', name: 'Duolingo',  emoji: '🦉', color: '#58cc02', bgColor: 'rgba(88, 204, 2, 0.08)',   borderColor: 'rgba(88, 204, 2, 0.25)',   tagline: 'Never miss a lesson', baseStreak: 53 },
  { id: 'extra_study', name: 'Extra Study', emoji: '📓', color: '#f59e0b', bgColor: 'rgba(245, 158, 11, 0.08)', borderColor: 'rgba(245, 158, 11, 0.25)', tagline: 'Learn something new daily', baseStreak: 0 }
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

    // Remove course33 if present (user requested to delete it)
    const courseIndex = habits.findIndex(h => h.id === 'course33');
    if (courseIndex !== -1) {
      habits.splice(courseIndex, 1);
      migrated = true;
    }

    // Inject extra_study habit if missing (new feature migration)
    if (!habits.find(h => h.id === 'extra_study')) {
      const def = DEFAULT_HABITS.find(d => d.id === 'extra_study');
      if (def) {
        habits.push({ ...def, log: {}, freezes: {} });
        migrated = true;
      }
    }

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
      // Force duolingo base streak to be exactly 53 (so 53 + logged days = correct count)
      if (h.id === 'duolingo' && h.baseStreak !== 53) {
        h.baseStreak = 53;
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
export function addHabit(name, emoji, subTasks = []) {
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
    subTasks: subTasks.map(st => ({
      key: generateId(),
      label: sanitizeText(st.label, 80),
      desc: sanitizeText(st.desc || '', 120),
      special: st.special || null
    }))
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
  if (!habit.log) habit.log = {};
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
  const todayDone = (habit.log && habit.log[todayKey]) || (habit.freezes && habit.freezes[todayKey]);
  if (!todayDone) {
    d.setDate(d.getDate() - 1);
  }

  while (true) {
    const key = localDateKey(d);
    if ((habit.log && habit.log[key]) || (habit.freezes && habit.freezes[key])) {
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
  return habits.every((h) => (h.log && h.log[dateKey]) || (h.freezes && h.freezes[dateKey]));
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
  const doneCount = habits.filter((h) => (h.log && h.log[today]) || (h.freezes && h.freezes[today])).length;
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
    const isCompleted = (h.log && h.log[today]) || (h.freezes && h.freezes[today]);
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
  
  const yesterdayDone = (habit.log && habit.log[yesterdayKey]) || (habit.freezes && habit.freezes[yesterdayKey]);
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
  let done = !!(habit.log && habit.log[today]);
  if (habit.id === 'course33') {
    const lessonsList = storage.get('lessons', []);
    const todayLessonLogged = lessonsList.some(l => l.createdAt && l.createdAt.startsWith(today));
    done = done || todayLessonLogged;
  }
  if (habit.id === 'extra_study') {
    const journal = storage.get('extra_study_journal', []);
    const todayStudyLogged = journal.some(e => e.createdAt && e.createdAt.startsWith(today));
    done = done || todayStudyLogged;
  }
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

  // Settings/Edit Button for habit management
  const editBtn = el('button', 'habit-pro__edit-btn', '⚙️');
  editBtn.style.background = 'none';
  editBtn.style.border = 'none';
  editBtn.style.cursor = 'pointer';
  editBtn.style.fontSize = '1.1rem';
  editBtn.style.opacity = '0.5';
  editBtn.style.padding = 'var(--space-1)';
  editBtn.style.borderRadius = 'var(--radius-sm)';
  editBtn.style.transition = 'all 0.2s ease';
  editBtn.style.marginLeft = 'var(--space-2)';
  editBtn.addEventListener('mouseenter', () => { editBtn.style.opacity = '1'; editBtn.style.background = 'rgba(255,255,255,0.06)'; });
  editBtn.addEventListener('mouseleave', () => { editBtn.style.opacity = '0.5'; editBtn.style.background = 'none'; });
  editBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    openEditHabitModal(habit, onToggle);
  });
  header.appendChild(editBtn);

  card.appendChild(header);

  // Stats row
  const stats = el('div', 'habit-pro__stats');

  const totalDays = Object.keys(habit.log || {}).length;

  const displayStreak = done ? streak : (streak + 1);
  const displayBest = done ? best : Math.max(best, streak + 1);
  const displayTotal = done ? totalDays : (totalDays + 1);

  const streakStat = el('div', 'habit-pro__stat');
  const streakVal = el('span', 'habit-pro__stat-value', String(displayStreak));
  if (done) {
    streakVal.style.color = habit.color || 'var(--cyan)';
    streakVal.style.textShadow = `0 0 12px ${habit.borderColor || 'rgba(0, 212, 255, 0.4)'}`;
  } else {
    streakVal.style.color = 'rgba(255, 255, 255, 0.2)';
    streakVal.style.textShadow = 'none';
  }
  streakStat.appendChild(streakVal);
  streakStat.appendChild(el('span', 'habit-pro__stat-label', 'Current'));
  stats.appendChild(streakStat);

  const bestStat = el('div', 'habit-pro__stat');
  const bestVal = el('span', 'habit-pro__stat-value', String(displayBest));
  if (done) {
    bestVal.style.color = habit.color || 'var(--cyan)';
    bestVal.style.textShadow = `0 0 12px ${habit.borderColor || 'rgba(0, 212, 255, 0.4)'}`;
  } else {
    bestVal.style.color = 'rgba(255, 255, 255, 0.2)';
    bestVal.style.textShadow = 'none';
  }
  bestStat.appendChild(bestVal);
  bestStat.appendChild(el('span', 'habit-pro__stat-label', 'Best'));
  stats.appendChild(bestStat);

  const totalStat = el('div', 'habit-pro__stat');
  const totalVal = el('span', 'habit-pro__stat-value', String(displayTotal));
  if (done) {
    totalVal.style.color = habit.color || 'var(--cyan)';
    totalVal.style.textShadow = `0 0 12px ${habit.borderColor || 'rgba(0, 212, 255, 0.4)'}`;
  } else {
    totalVal.style.color = 'rgba(255, 255, 255, 0.2)';
    totalVal.style.textShadow = 'none';
  }
  totalStat.appendChild(totalVal);
  totalStat.appendChild(el('span', 'habit-pro__stat-label', 'Total'));
  stats.appendChild(totalStat);

  card.appendChild(stats);

  // --- Generalized Sub-Habits / Sub-Tasks Drawer ---
  if (habit.subTasks && habit.subTasks.length > 0) {
    const subTasks = habit.subTasks;
    const storageKey = habit.id === 'course33' ? `sub_habits_${today}` : `sub_habits_${habit.id}_${today}`;
    
    // Create the default state
    const defaultState = {};
    subTasks.forEach(st => {
      defaultState[st.key] = false;
    });
    if (habit.id === 'course33') {
      defaultState.link = '';
    } else {
      defaultState.links = {};
    }

    const subHabitsState = storage.get(storageKey, defaultState);

    // Sync sub-habits with actual logs/achievements:
    if (habit.id === 'course33') {
      // Sync course33 as before:
      const lessons = storage.get('lessons', []);
      const todayLessonLogged = lessons.some(l => l.createdAt && l.createdAt.startsWith(today));
      if (todayLessonLogged || done) {
        subHabitsState.watch = true;
        subHabitsState.journal = true;
      }
      storage.set(storageKey, subHabitsState);
    } else {
      // General habit sync if done
      if (done) {
        subTasks.forEach(st => {
          subHabitsState[st.key] = true;
        });
      }
    }

    const drawer = el('div', 'sub-habits-drawer');
    const themeColor = habit.color || '#00d4ff';
    const themeBg = habit.bgColor || 'rgba(0, 212, 255, 0.08)';
    const themeBorder = habit.borderColor || 'rgba(0, 212, 255, 0.25)';

    drawer.style.margin = 'var(--space-4) 0';
    drawer.style.padding = 'var(--space-3)';
    drawer.style.borderRadius = 'var(--radius-md)';
    drawer.style.background = themeBg.replace('0.08', '0.04');
    drawer.style.border = `1px solid ${themeBorder.replace('0.25', '0.15')}`;
    drawer.style.transition = 'all 0.3s ease';

    if (done) {
      // Completed state: Show a progress summary
      const summary = el('div', 'sub-habits-completed-summary');
      summary.style.display = 'flex';
      summary.style.flexDirection = 'column';
      summary.style.gap = 'var(--space-2)';
      summary.style.textAlign = 'center';

      const title = el('p', '', `⚡ ${habit.name} Daily Clear!`);
      title.style.color = themeColor;
      title.style.fontWeight = '700';
      title.style.fontSize = 'var(--text-sm)';
      summary.appendChild(title);

      const statsRow = el('div', '');
      statsRow.style.fontSize = 'var(--text-xs)';
      statsRow.style.color = 'var(--text-muted)';
      statsRow.textContent = `Completed ${subTasks.length}/${subTasks.length} daily tasks successfully`;
      summary.appendChild(statsRow);

      // Check if we have links to display
      if (habit.id === 'course33' && subHabitsState.link) {
        const linkPill = el('a', 'course33-link-pill');
        linkPill.href = subHabitsState.link;
        linkPill.target = '_blank';
        linkPill.rel = 'noopener noreferrer';
        linkPill.style.display = 'inline-flex';
        linkPill.style.alignItems = 'center';
        linkPill.style.justifyContent = 'center';
        linkPill.style.gap = 'var(--space-1)';
        linkPill.style.padding = '0.4rem 0.8rem';
        linkPill.style.borderRadius = 'var(--radius-md)';
        linkPill.style.background = themeBg;
        linkPill.style.border = `1px solid ${themeBorder}`;
        linkPill.style.color = themeColor;
        linkPill.style.textDecoration = 'none';
        linkPill.style.fontWeight = '600';
        linkPill.style.fontSize = 'var(--text-xs)';
        linkPill.style.marginTop = 'var(--space-1)';

        const linkIcon = el('span', '', '🔗');
        const linkText = el('span', '', "View Today's Chart 📈");
        linkPill.appendChild(linkIcon);
        linkPill.appendChild(linkText);
        summary.appendChild(linkPill);
      } else if (subHabitsState.links) {
        Object.entries(subHabitsState.links).forEach(([taskKey, taskLink]) => {
          if (taskLink) {
            const taskObj = subTasks.find(st => st.key === taskKey);
            const linkPill = el('a', 'sub-habit-link-pill');
            linkPill.href = taskLink;
            linkPill.target = '_blank';
            linkPill.rel = 'noopener noreferrer';
            linkPill.style.display = 'inline-flex';
            linkPill.style.alignItems = 'center';
            linkPill.style.justifyContent = 'center';
            linkPill.style.gap = 'var(--space-1)';
            linkPill.style.padding = '0.4rem 0.8rem';
            linkPill.style.borderRadius = 'var(--radius-md)';
            linkPill.style.background = themeBg;
            linkPill.style.border = `1px solid ${themeBorder}`;
            linkPill.style.color = themeColor;
            linkPill.style.textDecoration = 'none';
            linkPill.style.fontWeight = '600';
            linkPill.style.fontSize = 'var(--text-xs)';
            linkPill.style.marginTop = 'var(--space-1)';

            const linkIcon = el('span', '', '🔗');
            const linkText = el('span', '', `View ${taskObj ? taskObj.label : 'Link'} 📈`);
            linkPill.appendChild(linkIcon);
            linkPill.appendChild(linkText);
            summary.appendChild(linkPill);
          }
        });
      }

      // Add "Show checklist detail" toggle button to see the tasks even if done
      const viewTasksBtn = el('button', '');
      viewTasksBtn.style.background = 'none';
      viewTasksBtn.style.border = 'none';
      viewTasksBtn.style.color = 'var(--text-muted)';
      viewTasksBtn.style.fontSize = 'var(--text-xs)';
      viewTasksBtn.style.cursor = 'pointer';
      viewTasksBtn.style.textDecoration = 'underline';
      viewTasksBtn.style.marginTop = 'var(--space-2)';
      viewTasksBtn.textContent = 'Show checklist detail';
      
      const detailsContainer = el('div');
      detailsContainer.style.display = 'none';
      detailsContainer.style.flexDirection = 'column';
      detailsContainer.style.gap = 'var(--space-2)';
      detailsContainer.style.marginTop = 'var(--space-3)';
      detailsContainer.style.textAlign = 'left';

      subTasks.forEach(st => {
        const item = el('div', '');
        item.style.display = 'flex';
        item.style.alignItems = 'center';
        item.style.gap = 'var(--space-2)';
        item.style.fontSize = 'var(--text-xs)';
        item.style.color = 'var(--text-secondary)';

        const checkMark = el('span', '', '✓');
        checkMark.style.color = themeColor;
        checkMark.style.fontWeight = 'bold';
        
        const label = el('span', '', st.label);
        label.style.textDecoration = 'line-through';
        label.style.opacity = '0.7';

        item.appendChild(checkMark);
        item.appendChild(label);
        detailsContainer.appendChild(item);
      });

      viewTasksBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (detailsContainer.style.display === 'none') {
          detailsContainer.style.display = 'flex';
          viewTasksBtn.textContent = 'Hide checklist detail';
        } else {
          detailsContainer.style.display = 'none';
          viewTasksBtn.textContent = 'Show checklist detail';
        }
      });

      summary.appendChild(viewTasksBtn);
      summary.appendChild(detailsContainer);

      drawer.appendChild(summary);
      card.appendChild(drawer);
    } else {
      // Interactive daily checklist
      const checklistContainer = el('div', 'sub-habits-checklist-container');
      checklistContainer.style.display = 'flex';
      checklistContainer.style.flexDirection = 'column';
      checklistContainer.style.gap = 'var(--space-3)';

      const titleEl = el('p', 'checklist-title', `📋 Daily Tasks:`);
      titleEl.style.fontSize = 'var(--text-xs)';
      titleEl.style.fontWeight = '700';
      titleEl.style.textTransform = 'uppercase';
      titleEl.style.letterSpacing = '0.05em';
      titleEl.style.color = 'var(--text-muted)';
      titleEl.style.marginBottom = 'var(--space-1)';
      checklistContainer.appendChild(titleEl);

      subTasks.forEach(t => {
        const item = el('div', 'checklist-item');
        item.style.display = 'flex';
        item.style.alignItems = 'flex-start';
        item.style.gap = 'var(--space-3)';
        item.style.padding = 'var(--space-2)';
        item.style.borderRadius = 'var(--radius-md)';
        item.style.background = 'rgba(255,255,255,0.02)';
        item.style.border = '1px solid rgba(255,255,255,0.04)';
        item.style.cursor = 'pointer';
        item.style.transition = 'all 0.2s ease';

        const isChecked = !!subHabitsState[t.key];

        const checkWrap = el('div', '');
        checkWrap.style.fontSize = '1.2rem';
        checkWrap.textContent = isChecked ? '🩵' : '⬜';
        item.appendChild(checkWrap);

        const textBlock = el('div', '');
        const label = el('p', '', t.label);
        label.style.fontSize = 'var(--text-sm)';
        label.style.fontWeight = '600';
        label.style.color = isChecked ? themeColor : 'var(--text-primary)';
        label.style.textDecoration = isChecked ? 'line-through' : 'none';
        
        const desc = el('p', '', t.desc || '');
        desc.style.fontSize = 'var(--text-xs)';
        desc.style.color = 'var(--text-muted)';
        
        textBlock.appendChild(label);
        textBlock.appendChild(desc);
        item.appendChild(textBlock);

        item.addEventListener('mouseenter', () => {
          item.style.background = 'rgba(255,255,255,0.05)';
        });
        item.addEventListener('mouseleave', () => {
          item.style.background = 'rgba(255,255,255,0.02)';
        });

        item.addEventListener('click', (e) => {
          e.preventDefault();
          nativeHaptic('light');
          if (t.special === 'tradingview' || (habit.id === 'course33' && t.key === 'charting')) {
            if (isChecked) {
              if (habit.id === 'course33') {
                subHabitsState.charting = false;
                subHabitsState.link = '';
              } else {
                subHabitsState[t.key] = false;
                if (subHabitsState.links) delete subHabitsState.links[t.key];
              }
              saveChecklist();
            } else {
              openLinkPrompt(t.key);
            }
          } else {
            subHabitsState[t.key] = !isChecked;
            saveChecklist();
          }
        });

        checklistContainer.appendChild(item);
      });

      function openLinkPrompt(taskKey) {
        const inputWrap = el('div', 'sub-habit-input-prompt');
        inputWrap.style.display = 'flex';
        inputWrap.style.flexDirection = 'column';
        inputWrap.style.gap = 'var(--space-2)';
        inputWrap.style.marginTop = 'var(--space-2)';

        const input = document.createElement('input');
        input.type = 'url';
        input.className = 'form-input';
        input.placeholder = 'Paste link here... 📈';
        input.style.fontSize = 'var(--text-sm)';
        input.style.border = `1px solid ${themeBorder}`;
        input.style.background = 'rgba(10, 10, 15, 0.6)';
        input.style.color = '#fff';

        const submitBtn = el('button', 'btn btn-outline btn-sm', 'Attach Link 🚀');
        submitBtn.style.color = themeColor;
        submitBtn.style.borderColor = themeColor;
        
        submitBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          const val = input.value.trim();
          if (!val || (!val.startsWith('http://') && !val.startsWith('https://'))) {
            showNotificationToast('Please paste a valid link starting with http:// or https://');
            return;
          }
          if (habit.id === 'course33') {
            subHabitsState.charting = true;
            subHabitsState.link = val;
          } else {
            subHabitsState[taskKey] = true;
            if (!subHabitsState.links) subHabitsState.links = {};
            subHabitsState.links[taskKey] = val;
          }
          saveChecklist();
        });

        inputWrap.appendChild(input);
        inputWrap.appendChild(submitBtn);

        // Replace targeted item with link prompt
        checklistContainer.replaceChildren();
        checklistContainer.appendChild(titleEl);
        
        subTasks.forEach(t => {
          if (t.key === taskKey) {
            checklistContainer.appendChild(inputWrap);
          } else {
            const item = el('div', 'checklist-item');
            item.style.display = 'flex';
            item.style.alignItems = 'flex-start';
            item.style.gap = 'var(--space-3)';
            item.style.padding = 'var(--space-2)';
            item.style.borderRadius = 'var(--radius-md)';
            item.style.background = 'rgba(255,255,255,0.02)';
            item.style.border = '1px solid rgba(255,255,255,0.04)';
            item.style.opacity = '0.5';

            const checkWrap = el('div', '');
            checkWrap.style.fontSize = '1.2rem';
            checkWrap.textContent = subHabitsState[t.key] ? '🩵' : '⬜';
            item.appendChild(checkWrap);

            const textBlock = el('div', '');
            const label = el('p', '', t.label);
            label.style.fontSize = 'var(--text-sm)';
            label.style.fontWeight = '600';
            const desc = el('p', '', t.desc || '');
            desc.style.fontSize = 'var(--text-xs)';
            desc.style.color = 'var(--text-muted)';
            textBlock.appendChild(label);
            textBlock.appendChild(desc);
            item.appendChild(textBlock);
            checklistContainer.appendChild(item);
          }
        });
      }

      function saveChecklist() {
        storage.set(storageKey, subHabitsState);
        
        // Check if all are completed
        const allDone = subTasks.every(t => !!subHabitsState[t.key]);
        if (allDone) {
          const habits = getHabits();
          const hIndex = habits.findIndex(h => h.id === habit.id);
          if (hIndex !== -1) {
            const finalLink = habit.id === 'course33' ? subHabitsState.link : (subHabitsState.links ? Object.values(subHabitsState.links)[0] : '');
            habits[hIndex].log[today] = finalLink || true;
            _saveHabits(habits);

            if (habit.id === 'course33') {
              addXP('course_homework', 15);
              showNotificationToast('Market Mechanics Completed for Today! +15 XP! 🪖⚡');
            } else {
              addXP('habit', 10);
              showNotificationToast(`${habit.emoji} ${habit.name} Completed! +10 XP! ⚡`);
            }
            
            // Check streak milestones & achievements
            checkStreakMilestones(habits[hIndex]);
            checkAndUnlockAchievements('habit');

            // Perfect day bonus check
            const todayKey = localDateKey();
            if (habits.length > 0 && habits.every(h => h.log && h.log[todayKey])) {
              addXP('perfectDay', 50);
              playSynthSound('fanfare');
              triggerConfetti();
              showNotificationToast('PERFECT DAY! +50 XP bonus! 🏆🔥');
            } else {
              playSynthSound('fanfare');
              triggerConfetti();
            }

            import('./firebase-sync.js').then(({ pushToCloud, getCurrentUser }) => {
              if (getCurrentUser()) pushToCloud();
            });
          }
        } else {
          // Uncheck main habit if unchecked a sub-task
          const habits = getHabits();
          const hIndex = habits.findIndex(h => h.id === habit.id);
          if (hIndex !== -1 && habits[hIndex].log[today]) {
            delete habits[hIndex].log[today];
            _saveHabits(habits);
            import('./firebase-sync.js').then(({ pushToCloud, getCurrentUser }) => {
              if (getCurrentUser()) pushToCloud();
            });
          }
        }
        if (typeof onToggle === 'function') onToggle();
      }

      drawer.appendChild(checklistContainer);
      card.appendChild(drawer);
    }
  }

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
    
    // IF habit has subtasks, update their checked states
    if (habit.subTasks && habit.subTasks.length > 0) {
      const storageKey = `sub_habits_${habit.id}_${today}`;
      const defaultState = {};
      habit.subTasks.forEach(st => {
        defaultState[st.key] = false;
      });
      defaultState.links = {};
      const subHabitsState = storage.get(storageKey, defaultState);
      
      habit.subTasks.forEach(st => {
        subHabitsState[st.key] = !wasDone;
      });
      storage.set(storageKey, subHabitsState);
    }

    toggleHabit(habit.id);
    const updatedHabits = getHabits();
    const updatedHabit = updatedHabits.find(h => h.id === habit.id);

    // Award XP when marking a habit as done (not when un-marking)
    if (!wasDone) {
      addXP('habit', 10);
      nativeHaptic('medium'); // Buzz on Android when habit is marked done
      
      // Check streak milestones (multiples of 7)
      checkStreakMilestones(updatedHabit);

      // Check general achievements
      checkAndUnlockAchievements('habit');

      // Check for perfect day bonus (all habits done)
      const todayKey = localDateKey();
      if (updatedHabits.length > 0 && updatedHabits.every(h => h.log && h.log[todayKey])) {
        addXP('perfectDay', 50);
        nativeHapticNotification('SUCCESS'); // Strong buzz for perfect day!
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
    
    // Theme-matching colors for freeze button
    const habitColor = habit.color || '#00d4ff';
    const habitBorderColor = habit.borderColor || 'rgba(0, 212, 255, 0.25)';
    const hoverBgColor = habit.bgColor ? habit.bgColor.replace('0.08', '0.15') : 'rgba(0, 212, 255, 0.1)';
    const hoverShadowColor = habitColor.startsWith('#') ? `${habitColor}40` : 'rgba(0, 212, 255, 0.25)';
    
    freezeBtn.style.setProperty('--freeze-color', habitColor);
    freezeBtn.style.setProperty('--freeze-border', habitBorderColor);
    freezeBtn.style.setProperty('--freeze-hover-bg', hoverBgColor);
    freezeBtn.style.setProperty('--freeze-hover-shadow', hoverShadowColor);
    
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
    const count = habitData.filter((h) => (h.log && h.log[key]) || (h.freezes && h.freezes[key])).length;
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

export const ACHIEVEMENT_DEFS = {
  risk_manager: {
    id: 'risk_manager',
    name: 'Risk Manager',
    desc: 'Log 5 consecutive trades with risk <= 1%',
    emoji: '🛡️',
    xpReward: 100,
  },
  unstoppable: {
    id: 'unstoppable',
    name: 'Unstoppable',
    desc: 'Hit a 14-day habit streak on any habit',
    emoji: '🏃‍♂️',
    xpReward: 150,
  },
  perfect_week: {
    id: 'perfect_week',
    name: 'Perfect Week',
    desc: 'Achieve 7 consecutive perfect days (all habits completed)',
    emoji: '⚡',
    xpReward: 200,
    awardsToken: true,
  },
  absolute_discipline: {
    id: 'absolute_discipline',
    name: 'Absolute Discipline',
    desc: 'Log 5 curriculum lessons in the Learning Hub',
    emoji: '📚',
    xpReward: 100,
  },
  profitable_trader: {
    id: 'profitable_trader',
    name: 'Profitable Trader',
    desc: 'Record a 5-trade win streak in the journal',
    emoji: '💰',
    xpReward: 150,
  },
  psychology_shield: {
    id: 'psychology_shield',
    name: 'Psychology Shield',
    desc: 'Log 3 losses with a psychological mistake tagged',
    emoji: '🧠',
    xpReward: 100,
  }
};

export function getUnlockedAchievements() {
  return storage.get('unlocked_achievements', {});
}

export function checkAndUnlockAchievements(triggerType) {
  const unlocked = getUnlockedAchievements();
  let updated = false;

  function unlock(id) {
    if (unlocked[id]) return;
    unlocked[id] = { unlocked: true, unlockedAt: new Date().toISOString() };
    updated = true;

    const def = ACHIEVEMENT_DEFS[id];
    addXP('achievement', def.xpReward);

    if (def.awardsToken) {
      const currentTokens = storage.get('streak_freeze_tokens', 0);
      if (currentTokens < 3) {
        storage.set('streak_freeze_tokens', currentTokens + 1);
      }
    }

    showFreezeToast(`🏆 Trophy Unlocked: ${def.name}! +${def.xpReward} XP awarded!`);
    nativeHapticNotification('SUCCESS');
    playSynthSound('fanfare');
    triggerConfetti();
  }

  if (triggerType === 'habit') {
    const habits = getHabits();
    
    // Check "Unstoppable" (14-day habit streak on any habit)
    if (!unlocked.unstoppable) {
      const has14 = habits.some(h => calculateStreak(h.id) >= 14);
      if (has14) unlock('unstoppable');
    }

    // Check "Perfect Week" (7 consecutive perfect days)
    if (!unlocked.perfect_week) {
      let perfectStreak = 0;
      for (let i = 0; i < 30; i++) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        if (isPerfectDay(localDateKey(d))) {
          perfectStreak++;
          if (perfectStreak >= 7) {
            unlock('perfect_week');
            break;
          }
        } else {
          perfectStreak = 0;
        }
      }
    }
  }

  if (triggerType === 'trade') {
    import('./trading.js').then(({ getTrades }) => {
      const trades = getTrades();
      if (!trades.length) return;

      const sorted = [...trades].sort((a, b) => new Date(a.date) - new Date(b.date));

      // Check "Risk Manager" (5 consecutive trades with risk <= 1%)
      if (!unlocked.risk_manager) {
        let consecutiveLowRisk = 0;
        for (const t of sorted) {
          const risk = t.riskPct !== undefined ? t.riskPct : 1.0;
          if (risk <= 1.0) {
            consecutiveLowRisk++;
            if (consecutiveLowRisk >= 5) {
              unlock('risk_manager');
              break;
            }
          } else {
            consecutiveLowRisk = 0;
          }
        }
      }

      // Check "Profitable Trader" (5-trade win streak)
      if (!unlocked.profitable_trader) {
        let winStreak = 0;
        for (const t of sorted) {
          if (t.outcome === 'win') {
            winStreak++;
            if (winStreak >= 5) {
              unlock('profitable_trader');
              break;
            }
          } else if (t.outcome === 'loss') {
            winStreak = 0;
          }
        }
      }

      // Check "Psychology Shield" (Log 3 losses with a psychological mistake tagged)
      if (!unlocked.psychology_shield) {
        const lossesWithMistakes = sorted.filter(t => t.outcome === 'loss' && t.mistake && t.mistake !== '').length;
        if (lossesWithMistakes >= 3) {
          unlock('psychology_shield');
        }
      }
    });
  }

  if (triggerType === 'lesson') {
    import('./learning.js').then(({ getLessons }) => {
      const lessons = getLessons();
      if (!unlocked.absolute_discipline) {
        if (lessons.length >= 5) {
          unlock('absolute_discipline');
        }
      }
    });
  }

  if (updated) {
    storage.set('unlocked_achievements', unlocked);
    import('./firebase-sync.js').then(({ pushToCloud, getCurrentUser }) => {
      if (getCurrentUser()) pushToCloud();
    });
  }
}

function checkStreakMilestones(habit) {
  const currentStreak = calculateStreak(habit.id);
  if (currentStreak > 0 && currentStreak % 7 === 0) {
    const milestoneKey = `milestone_${habit.id}_${currentStreak}`;
    const milestones = storage.get('awarded_milestones', {});
    if (!milestones[milestoneKey]) {
      milestones[milestoneKey] = true;
      storage.set('awarded_milestones', milestones);

      const currentTokens = storage.get('streak_freeze_tokens', 0);
      if (currentTokens < 3) {
        storage.set('streak_freeze_tokens', currentTokens + 1);
        showFreezeToast(`❄️ Streak Milestone! Earned 1 Freeze Token for a ${currentStreak}-day streak on ${habit.emoji} ${habit.name}!`);
      } else {
        showFreezeToast(`✨ Streak Milestone! ${currentStreak}-day streak on ${habit.emoji} ${habit.name}! (Freeze tokens at max capacity)`);
      }
      playSynthSound('fanfare');
      triggerConfetti();
    }
  }
}

export function showFreezeToast(message) {
  let toast = document.querySelector('.freeze-toast');
  if (toast) toast.remove();
  
  toast = document.createElement('div');
  toast.className = 'freeze-toast';
  toast.textContent = message;
  document.body.appendChild(toast);
  
  requestAnimationFrame(() => {
    toast.classList.add('freeze-toast--visible');
  });
  
  setTimeout(() => {
    if (toast) {
      toast.classList.remove('freeze-toast--visible');
      setTimeout(() => toast.remove(), 300);
    }
  }, 4000);
}

export function renderTrophyCabinet(container) {
  container.replaceChildren();
  
  const section = el('div', 'streaks-trophy-cabinet');
  section.appendChild(el('h2', 'section-title', '🏆 Achievement Trophy Case'));
  
  const grid = el('div', 'trophy-cabinet-grid');
  const unlocked = getUnlockedAchievements();
  
  Object.values(ACHIEVEMENT_DEFS).forEach(def => {
    const isUnlocked = !!unlocked[def.id];
    const card = el('div', `trophy-card ${isUnlocked ? 'trophy-card--unlocked' : 'trophy-card--locked'}`);
    
    const header = el('div', 'trophy-card__header');
    const iconBox = el('div', 'trophy-card__icon-box');
    iconBox.textContent = def.emoji;
    header.appendChild(iconBox);
    
    const status = el('span', `trophy-card__status ${isUnlocked ? 'status--unlocked' : 'status--locked'}`);
    status.textContent = isUnlocked ? '🏆 Unlocked' : '🔒 Locked';
    card.appendChild(header);
    
    card.appendChild(el('h3', 'trophy-card__title', def.name));
    card.appendChild(el('p', 'trophy-card__desc', def.desc));
    
    const footer = el('div', 'trophy-card__footer');
    footer.appendChild(el('span', '', 'Reward'));
    footer.appendChild(el('span', 'trophy-card__xp', `+${def.xpReward} XP`));
    card.appendChild(footer);
    
    grid.appendChild(card);
  });
  
  section.appendChild(grid);
  container.appendChild(section);
}

/* ---------- Add Habit Form ---------------------------------------- */

export function openEditHabitModal(habit, onSaved) {
  const overlay = el('div', 'modal-overlay');
  const modal = el('div', 'modal');
  modal.style.maxWidth = '500px';

  // Mobile sheet grab bar
  const grabHandle = el('div', 'modal-swipe-handle');
  modal.appendChild(grabHandle);

  const topBar = el('div', 'modal__topbar');
  topBar.style.background = 'linear-gradient(90deg, var(--cyan), var(--purple), var(--neon-green))';
  modal.appendChild(topBar);

  const header = el('div', 'modal__header');
  header.appendChild(el('h2', 'modal__title', `⚙️ Edit ${habit.name}`));
  const closeBtn = el('button', 'modal__close', '✕');
  closeBtn.addEventListener('click', () => {
    overlay.style.opacity = '0';
    setTimeout(() => overlay.remove(), 250);
  });
  header.appendChild(closeBtn);
  modal.appendChild(header);

  const body = el('div', 'modal__body');
  const form = el('form', 'modal-form');
  form.setAttribute('novalidate', '');

  // 1. Name input
  const nGroup = el('div', 'form-group');
  nGroup.appendChild(el('label', 'form-label', 'Habit Name'));
  const nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.className = 'form-input';
  nameInput.value = habit.name;
  nameInput.required = true;
  nameInput.maxLength = 60;
  nGroup.appendChild(nameInput);
  form.appendChild(nGroup);

  // 2. Emoji input
  const eGroup = el('div', 'form-group');
  eGroup.appendChild(el('label', 'form-label', 'Emoji'));
  const emojiInput = document.createElement('input');
  emojiInput.type = 'text';
  emojiInput.className = 'form-input';
  emojiInput.value = habit.emoji;
  emojiInput.maxLength = 4;
  eGroup.appendChild(emojiInput);
  form.appendChild(eGroup);

  // 3. Sub-Tasks Management List
  const subTasksContainer = el('div', 'subtasks-management-container');
  subTasksContainer.style.marginTop = 'var(--space-4)';
  subTasksContainer.style.display = 'flex';
  subTasksContainer.style.flexDirection = 'column';
  subTasksContainer.style.gap = 'var(--space-2)';

  subTasksContainer.appendChild(el('label', 'form-label', 'Manage Sub-Tasks'));
  
  const subTaskList = el('div', 'subtasks-edit-list');
  subTaskList.style.display = 'flex';
  subTaskList.style.flexDirection = 'column';
  subTaskList.style.gap = 'var(--space-2)';
  subTasksContainer.appendChild(subTaskList);

  function createSubTaskRow(st = { label: '', desc: '', special: null }) {
    const row = el('div', 'subtask-edit-row');
    row.style.display = 'flex';
    row.style.alignItems = 'center';
    row.style.gap = 'var(--space-2)';

    const labelIn = document.createElement('input');
    labelIn.type = 'text';
    labelIn.className = 'form-input';
    labelIn.value = st.label;
    labelIn.placeholder = 'Sub-task label';
    labelIn.style.flex = '1';
    row.appendChild(labelIn);

    const descIn = document.createElement('input');
    descIn.type = 'text';
    descIn.className = 'form-input';
    descIn.value = st.desc || '';
    descIn.placeholder = 'Description (optional)';
    descIn.style.flex = '1';
    row.appendChild(descIn);

    const specialLabel = el('label', '');
    specialLabel.style.display = 'flex';
    specialLabel.style.alignItems = 'center';
    specialLabel.style.gap = '4px';
    specialLabel.style.fontSize = 'var(--text-xs)';
    specialLabel.style.color = 'var(--text-muted)';
    specialLabel.style.cursor = 'pointer';

    const specialCheck = document.createElement('input');
    specialCheck.type = 'checkbox';
    specialCheck.checked = !!st.special;
    specialLabel.appendChild(specialCheck);
    specialLabel.appendChild(document.createTextNode('Needs Link 🔗'));
    row.appendChild(specialLabel);

    const removeBtn = el('button', 'btn btn-outline btn-sm');
    removeBtn.type = 'button';
    removeBtn.textContent = '❌';
    removeBtn.addEventListener('click', () => {
      row.remove();
    });
    row.appendChild(removeBtn);

    subTaskList.appendChild(row);
  }

  // Populate existing subtasks
  if (habit.subTasks && habit.subTasks.length > 0) {
    habit.subTasks.forEach(st => createSubTaskRow(st));
  }

  const addSubBtn = el('button', 'btn btn-outline btn-sm', '+ Add Sub-Task');
  addSubBtn.type = 'button';
  addSubBtn.style.alignSelf = 'flex-start';
  addSubBtn.style.marginTop = 'var(--space-1)';
  addSubBtn.addEventListener('click', () => createSubTaskRow());
  subTasksContainer.appendChild(addSubBtn);
  form.appendChild(subTasksContainer);

  // 4. Save and Cancel actions
  const actionsRow = el('div', 'modal-actions-row');
  actionsRow.style.display = 'flex';
  actionsRow.style.gap = 'var(--space-3)';
  actionsRow.style.marginTop = 'var(--space-5)';

  const saveBtn = el('button', 'btn btn-primary', 'Save Changes 💾');
  saveBtn.type = 'submit';
  saveBtn.style.flex = '1';
  actionsRow.appendChild(saveBtn);

  // Deletion for custom habits
  const isDefaultHabit = ['snap', 'tiktok', 'duolingo', 'course33', 'extra_study'].includes(habit.id);
  if (!isDefaultHabit) {
    const deleteBtn = el('button', 'btn btn-danger', 'Delete Habit 🗑️');
    deleteBtn.type = 'button';
    deleteBtn.style.flex = '1';
    deleteBtn.style.background = 'rgba(255, 71, 87, 0.15)';
    deleteBtn.style.borderColor = 'rgba(255, 71, 87, 0.3)';
    deleteBtn.style.color = 'var(--neon-red)';
    deleteBtn.addEventListener('click', () => {
      if (confirm(`Are you sure you want to permanently delete the habit "${habit.name}"?`)) {
        const habits = getHabits();
        const index = habits.findIndex(h => h.id === habit.id);
        if (index !== -1) {
          habits.splice(index, 1);
          _saveHabits(habits);
          
          import('./firebase-sync.js').then(({ pushToCloud, getCurrentUser }) => {
            if (getCurrentUser()) pushToCloud();
          });

          overlay.style.opacity = '0';
          setTimeout(() => overlay.remove(), 250);
          if (typeof onSaved === 'function') onSaved();
          showNotificationToast(`Habit "${habit.name}" deleted! 🗑️`);
        }
      }
    });
    actionsRow.appendChild(deleteBtn);
  }

  form.appendChild(actionsRow);

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const updatedName = nameInput.value.trim();
    if (!updatedName) return;

    // Read subtasks
    const subTasks = [];
    const rows = subTaskList.querySelectorAll('.subtask-edit-row');
    rows.forEach(row => {
      const inputs = row.querySelectorAll('input');
      const labelVal = inputs[0].value.trim();
      const descVal = inputs[1].value.trim();
      const needsLink = inputs[2].checked;
      if (labelVal) {
        subTasks.push({
          key: generateId(),
          label: labelVal,
          desc: descVal,
          special: needsLink ? 'tradingview' : null
        });
      }
    });

    const habits = getHabits();
    const index = habits.findIndex(h => h.id === habit.id);
    if (index !== -1) {
      habits[index].name = sanitizeText(updatedName, 60);
      habits[index].emoji = sanitizeText(emojiInput.value.trim() || '✅', 4);
      habits[index].subTasks = subTasks;
      _saveHabits(habits);

      import('./firebase-sync.js').then(({ pushToCloud, getCurrentUser }) => {
        if (getCurrentUser()) pushToCloud();
      });

      overlay.style.opacity = '0';
      setTimeout(() => overlay.remove(), 250);
      if (typeof onSaved === 'function') onSaved();
      showNotificationToast(`Habit "${updatedName}" updated! 💾✨`);
    }
  });

  body.appendChild(form);
  modal.appendChild(body);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
}

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

  // Sub-tasks inputs container
  const subTasksContainer = el('div', 'subtasks-form-container');
  subTasksContainer.style.width = '100%';
  subTasksContainer.style.marginTop = 'var(--space-3)';
  subTasksContainer.style.display = 'flex';
  subTasksContainer.style.flexDirection = 'column';
  subTasksContainer.style.gap = 'var(--space-2)';

  const subTasksTitle = el('p', 'form-label', 'Sub-Tasks (Optional)');
  subTasksTitle.style.fontWeight = '700';
  subTasksContainer.appendChild(subTasksTitle);

  const subTaskList = el('div', 'subtasks-list-inputs');
  subTaskList.style.display = 'flex';
  subTaskList.style.flexDirection = 'column';
  subTaskList.style.gap = 'var(--space-2)';
  subTasksContainer.appendChild(subTaskList);

  const addSubTaskBtn = el('button', 'btn btn-outline btn-sm', '+ Add Sub-Task');
  addSubTaskBtn.type = 'button';
  addSubTaskBtn.style.alignSelf = 'flex-start';
  subTasksContainer.appendChild(addSubTaskBtn);

  function addSubTaskRow() {
    const row = el('div', 'subtask-input-row');
    row.style.display = 'flex';
    row.style.alignItems = 'center';
    row.style.gap = 'var(--space-2)';
    row.style.width = '100%';

    const labelInput = document.createElement('input');
    labelInput.type = 'text';
    labelInput.placeholder = 'e.g. Reply to DMs';
    labelInput.className = 'form-input';
    labelInput.style.flex = '1';
    labelInput.style.fontSize = 'var(--text-sm)';
    row.appendChild(labelInput);

    const descInput = document.createElement('input');
    descInput.type = 'text';
    descInput.placeholder = 'Description (optional)';
    descInput.className = 'form-input';
    descInput.style.flex = '1';
    descInput.style.fontSize = 'var(--text-sm)';
    row.appendChild(descInput);

    const specialLabel = el('label', '');
    specialLabel.style.display = 'flex';
    specialLabel.style.alignItems = 'center';
    specialLabel.style.gap = '4px';
    specialLabel.style.fontSize = 'var(--text-xs)';
    specialLabel.style.color = 'var(--text-muted)';
    specialLabel.style.cursor = 'pointer';

    const specialCheck = document.createElement('input');
    specialCheck.type = 'checkbox';
    specialCheck.style.cursor = 'pointer';
    specialLabel.appendChild(specialCheck);
    specialLabel.appendChild(document.createTextNode('Needs Link 🔗'));
    row.appendChild(specialLabel);

    const removeBtn = el('button', 'btn btn-sm btn-outline');
    removeBtn.type = 'button';
    removeBtn.textContent = '❌';
    removeBtn.style.padding = '0.4rem 0.6rem';
    removeBtn.addEventListener('click', () => {
      row.remove();
    });
    row.appendChild(removeBtn);

    subTaskList.appendChild(row);
  }

  addSubTaskBtn.addEventListener('click', addSubTaskRow);

  const submitBtn = el('button', 'btn btn-primary', 'Add Habit ✨');
  submitBtn.type = 'submit';

  form.appendChild(subTasksContainer);
  form.appendChild(submitBtn);

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const name = (fd.get('name') || '').trim();
    if (!name) {
      nameInput.focus();
      return;
    }

    // Retrieve sub-tasks from list inputs
    const subTasks = [];
    const rows = subTaskList.querySelectorAll('.subtask-input-row');
    rows.forEach(row => {
      const inputs = row.querySelectorAll('input');
      const labelVal = inputs[0].value.trim();
      const descVal = inputs[1].value.trim();
      const needsLink = inputs[2].checked;
      if (labelVal) {
        subTasks.push({
          label: labelVal,
          desc: descVal,
          special: needsLink ? 'tradingview' : null
        });
      }
    });

    addHabit(name, fd.get('emoji') || '✅', subTasks);
    form.reset();
    subTaskList.replaceChildren(); // Clear the dynamic rows
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

function renderRemindersPanel(container) {
  container.replaceChildren();

  const card = el('div', 'streaks-reminders-card glass-card');
  card.style.padding = 'var(--space-4)';
  card.style.marginBottom = 'var(--space-6)';
  card.style.border = '1px solid rgba(0, 212, 255, 0.15)';
  card.style.borderRadius = 'var(--radius-lg)';

  const header = el('div', 'reminders-header');
  header.style.display = 'flex';
  header.style.alignItems = 'center';
  header.style.gap = 'var(--space-2)';
  header.style.marginBottom = 'var(--space-4)';
  
  const icon = el('span', '', '🔔');
  icon.style.fontSize = '1.3rem';
  header.appendChild(icon);
  
  const title = el('h3', 'reminders-title', 'Daily Alarm & Reminders Scheduler');
  title.style.fontSize = 'var(--text-sm)';
  title.style.fontWeight = '700';
  title.style.fontFamily = 'var(--font-heading)';
  title.style.color = 'var(--text-primary)';
  header.appendChild(title);
  card.appendChild(header);

  // Settings state loading
  let pmEnabled = storage.get('premarket_reminder_enabled', true);
  let pmTime = storage.get('premarket_reminder_time', '08:30');
  let hbEnabled = storage.get('habit_reminder_enabled', false);
  let hbTime = storage.get('habit_reminder_time', '20:00');

  // Option 1: Premarket routine reminder
  const pmRow = el('div', 'reminder-option-row');
  pmRow.style.display = 'flex';
  pmRow.style.alignItems = 'center';
  pmRow.style.justifyContent = 'space-between';
  pmRow.style.gap = 'var(--space-3)';
  pmRow.style.padding = 'var(--space-2) 0';
  pmRow.style.borderBottom = '1px solid rgba(255, 255, 255, 0.05)';

  const pmDetails = el('div', '');
  pmDetails.appendChild(el('p', 'reminder-opt-title', 'Daily Pre-Market Reminder'));
  pmDetails.querySelector('.reminder-opt-title').style.fontWeight = '600';
  pmDetails.querySelector('.reminder-opt-title').style.fontSize = 'var(--text-xs)';
  const pmDesc = el('p', 'reminder-opt-desc', 'Reminds you to check off your premarket routine.');
  pmDesc.style.fontSize = '10px';
  pmDesc.style.color = 'var(--text-muted)';
  pmDetails.appendChild(pmDesc);
  pmRow.appendChild(pmDetails);

  const pmControls = el('div', '');
  pmControls.style.display = 'flex';
  pmControls.style.alignItems = 'center';
  pmControls.style.gap = 'var(--space-2)';

  const pmTimeInput = document.createElement('input');
  pmTimeInput.type = 'time';
  pmTimeInput.className = 'form-input form-input-sm';
  pmTimeInput.value = pmTime;
  pmTimeInput.style.width = '100px';
  pmTimeInput.style.padding = '4px 8px';
  pmTimeInput.style.fontSize = 'var(--text-xs)';
  pmTimeInput.disabled = !pmEnabled;
  pmControls.appendChild(pmTimeInput);

  const pmToggle = document.createElement('input');
  pmToggle.type = 'checkbox';
  pmToggle.checked = pmEnabled;
  pmToggle.style.cursor = 'pointer';
  pmToggle.addEventListener('change', () => {
    pmEnabled = pmToggle.checked;
    pmTimeInput.disabled = !pmEnabled;
    nativeHaptic('light');
  });
  pmControls.appendChild(pmToggle);
  pmRow.appendChild(pmControls);
  card.appendChild(pmRow);

  // Option 2: Habit clean-up reminder
  const hbRow = el('div', 'reminder-option-row');
  hbRow.style.display = 'flex';
  hbRow.style.alignItems = 'center';
  hbRow.style.justifyContent = 'space-between';
  hbRow.style.gap = 'var(--space-3)';
  hbRow.style.padding = 'var(--space-2) 0';
  hbRow.style.borderBottom = '1px solid rgba(255, 255, 255, 0.05)';
  hbRow.style.marginTop = 'var(--space-2)';

  const hbDetails = el('div', '');
  hbDetails.appendChild(el('p', 'reminder-opt-title', 'Daily Habit Clean-up Reminder'));
  hbDetails.querySelector('.reminder-opt-title').style.fontWeight = '600';
  hbDetails.querySelector('.reminder-opt-title').style.fontSize = 'var(--text-xs)';
  const hbDesc = el('p', 'reminder-opt-desc', 'Reminds you to check off any pending habit streaks.');
  hbDesc.style.fontSize = '10px';
  hbDesc.style.color = 'var(--text-muted)';
  hbDetails.appendChild(hbDesc);
  hbRow.appendChild(hbDetails);

  const hbControls = el('div', '');
  hbControls.style.display = 'flex';
  hbControls.style.alignItems = 'center';
  hbControls.style.gap = 'var(--space-2)';

  const hbTimeInput = document.createElement('input');
  hbTimeInput.type = 'time';
  hbTimeInput.className = 'form-input form-input-sm';
  hbTimeInput.value = hbTime;
  hbTimeInput.style.width = '100px';
  hbTimeInput.style.padding = '4px 8px';
  hbTimeInput.style.fontSize = 'var(--text-xs)';
  hbTimeInput.disabled = !hbEnabled;
  hbControls.appendChild(hbTimeInput);

  const hbToggle = document.createElement('input');
  hbToggle.type = 'checkbox';
  hbToggle.checked = hbEnabled;
  hbToggle.style.cursor = 'pointer';
  hbToggle.addEventListener('change', () => {
    hbEnabled = hbToggle.checked;
    hbTimeInput.disabled = !hbEnabled;
    nativeHaptic('light');
  });
  hbControls.appendChild(hbToggle);
  hbRow.appendChild(hbControls);
  card.appendChild(hbRow);

  // Save Settings Button
  const saveBtn = el('button', 'btn btn-primary btn-sm', '💾 Save Reminder Alarms');
  saveBtn.style.marginTop = 'var(--space-4)';
  saveBtn.style.width = '100%';
  saveBtn.addEventListener('click', async () => {
    nativeHaptic('medium');
    
    // Save to storage
    storage.set('premarket_reminder_enabled', pmEnabled);
    storage.set('premarket_reminder_time', pmTimeInput.value);
    storage.set('habit_reminder_enabled', hbEnabled);
    storage.set('habit_reminder_time', hbTimeInput.value);

    // Apply native notifications changes
    // Premarket routine
    if (pmEnabled) {
      const [h, m] = pmTimeInput.value.split(':').map(Number);
      await scheduleDailyReminder(
        1001,
        '⚡ Pre-Market Routine',
        'Time to check the news, mark your bias, and set your levels. Lock in before the session!',
        h !== undefined && !isNaN(h) ? h : 8,
        m !== undefined && !isNaN(m) ? m : 30
      );
    } else {
      await cancelNotification(1001);
    }

    // Habit reminder
    if (hbEnabled) {
      const [h, m] = hbTimeInput.value.split(':').map(Number);
      await scheduleDailyReminder(
        1002,
        '🔥 Habit Streak Clean-up',
        'Check off your streaks before the day ends! Keep the fire lit!',
        h !== undefined && !isNaN(h) ? h : 20,
        m !== undefined && !isNaN(m) ? m : 0
      );
    } else {
      await cancelNotification(1002);
    }

    playSynthSound('success');
    showNotificationToast('Reminder alarms saved and scheduled successfully! 🔔✨');
  });
  card.appendChild(saveBtn);

  container.appendChild(card);
}

// Build the full Streaks page.
export function renderStreaksPage(container) {
  container.replaceChildren();
  container.appendChild(el('h1', 'page-title', '🔥 Daily Streaks'));

  const freezeContainer = el('div');
  const fireContainer = el('div');
  const statsContainer = el('div');
  const remindersContainer = el('div');
  const cardsContainer = el('div');
  const heatmapContainer = el('div');
  const trophyContainer = el('div');
  const formContainer = el('div');

  container.appendChild(freezeContainer);
  container.appendChild(fireContainer);
  container.appendChild(statsContainer);
  container.appendChild(remindersContainer);
  container.appendChild(cardsContainer);
  container.appendChild(heatmapContainer);
  container.appendChild(trophyContainer);
  container.appendChild(formContainer);

  function refresh() {
    renderFireBanner(fireContainer);
    renderFreezeStatus(freezeContainer);
    renderOverviewStats(statsContainer);
    renderRemindersPanel(remindersContainer);
    renderHabitCards(cardsContainer, refresh);
    renderCalendarHeatmap(heatmapContainer, getHabits());
    renderTrophyCabinet(trophyContainer);
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
    try {
      const p = Notification.requestPermission();
      if (p && typeof p.catch === 'function') {
        p.catch(err => {
          console.warn('[Notifications] Permission request was blocked or rejected:', err);
        });
      }
    } catch (err) {
      console.warn('[Notifications] Notification.requestPermission error:', err);
    }
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
  const undone = habits.filter(h => !(h.log && h.log[today]));

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

  sendLocalNotification('🪖 SwaGGa HQ — Streak Reminder', body);

  storage.set('streak_last_notif', new Date().toISOString());
}
