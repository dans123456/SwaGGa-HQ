// xp & leveling system

import storage from './storage.js';

export const LEVELS = [
  { level: 1,  xp: 0,     title: 'Recruit',       emoji: '🪖' },
  { level: 2,  xp: 100,   title: 'Cadet',         emoji: '⭐' },
  { level: 3,  xp: 300,   title: 'Soldier',       emoji: '🎖️' },
  { level: 4,  xp: 600,   title: 'Sergeant',      emoji: '🏅' },
  { level: 5,  xp: 1000,  title: 'Lieutenant',    emoji: '⚔️' },
  { level: 6,  xp: 1500,  title: 'Captain',       emoji: '🛡️' },
  { level: 7,  xp: 2200,  title: 'Commander',     emoji: '🦅' },
  { level: 8,  xp: 3000,  title: 'Colonel',       emoji: '🎯' },
  { level: 9,  xp: 4000,  title: 'General',       emoji: '⭐⭐' },
  { level: 10, xp: 5500,  title: 'Legend',        emoji: '👑' },
  { level: 11, xp: 8000,  title: 'Warlord',      emoji: '🔱' },
  { level: 12, xp: 11000, title: 'Titan',         emoji: '🗿' },
  { level: 13, xp: 15000, title: 'Sovereign',     emoji: '🏛️' },
  { level: 14, xp: 20000, title: 'Mythic',        emoji: '🐉' },
  { level: 15, xp: 26000, title: 'Sage',          emoji: '🧙' },
  { level: 16, xp: 33000, title: 'Ascendant',     emoji: '🌟' },
  { level: 17, xp: 42000, title: 'Immortal',      emoji: '💀' },
  { level: 18, xp: 53000, title: 'Overlord',      emoji: '👁️' },
  { level: 19, xp: 67000, title: 'God',           emoji: '⚜️' },
  { level: 20, xp: 85000, title: 'The Infinite',  emoji: '♾️' },
];

export const XP_REWARDS = {
  habit: 10,
  trade: 25,
  lesson: 30,
  assignment: 40,
  quiz: 15,
  perfectDay: 50,
};

const STORAGE_KEY = 'xp_data';

// ---- data layer ----

export function getXPData() {
  const data = storage.get(STORAGE_KEY, { totalXP: 0, history: [] });
  // Self-heal and sanitize: If totalXP is NaN or represented as a string, recalculate it dynamically from the history array
  if (data && (typeof data.totalXP !== 'number' || isNaN(data.totalXP))) {
    let sum = 0;
    if (Array.isArray(data.history)) {
      data.history.forEach(h => {
        // If action and xp values were reversed during the previous bug
        if (typeof h.action === 'number') {
          const temp = h.action;
          h.action = h.xp;
          h.xp = temp;
        }
        
        // Correct the pre-market routine bonus value if it was saved as a string/NaN
        if (h.action === 'Pre-Market Discipline Bonus' && (typeof h.xp !== 'number' || isNaN(h.xp))) {
          h.xp = 20;
        }

        const val = Number(h.xp);
        if (!isNaN(val)) {
          sum += val;
        }
      });
    }
    data.totalXP = sum;
    storage.set(STORAGE_KEY, data);
  }
  return data;
}

export function getStreakMultiplier() {
  try {
    const habits = storage.get('habits', []);
    if (!Array.isArray(habits) || !habits.length) return 1.0;

    let maxStreak = 0;
    
    // YYYY-MM-DD local formatter
    const localDateKey = (dt) => {
      const y = dt.getFullYear();
      const m = String(dt.getMonth() + 1).padStart(2, '0');
      const day = String(dt.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    };

    habits.forEach(habit => {
      let streak = 0;
      const d = new Date();
      
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
      
      const currentStreak = streak + (habit.baseStreak || 0);
      if (currentStreak > maxStreak) {
        maxStreak = currentStreak;
      }
    });

    if (maxStreak >= 30) return 1.5;
    if (maxStreak >= 14) return 1.3;
    if (maxStreak >= 7) return 1.2;
    if (maxStreak >= 3) return 1.1;
  } catch (e) {
    console.error('XP Multiplier Error:', e);
  }
  return 1.0;
}

// award XP and persist — dispatches 'xp-change' event
export function addXP(action, amount) {

  const oldLevelObj = getLevel();
  const mult = getStreakMultiplier();
  amount = Math.round(amount * mult);
  
  const data = getXPData();
  data.totalXP += amount;
  data.history.push({
    action: mult > 1.0 ? `${action} (x${mult} Streak Bonus)` : action,
    xp: amount,
    date: new Date().toISOString(),
  });
  storage.set(STORAGE_KEY, data);

  const newLevelObj = getLevel();
  const leveledUp = newLevelObj.level > oldLevelObj.level;

  window.dispatchEvent(new CustomEvent('xp-change', {
    detail: {
      action,
      amount,
      totalXP: data.totalXP,
      leveledUp,
      oldLevel: oldLevelObj,
      newLevel: newLevelObj,
      streakMultiplier: mult
    }
  }));
  
  return data.totalXP;
}

export function getLevel() {
  const { totalXP } = getXPData();
  let current = LEVELS[0];
  for (const lvl of LEVELS) {
    if (totalXP >= lvl.xp) {
      current = lvl;
    } else {
      break;
    }
  }
  return current;
}

// progress toward next level (0-1 float)
export function getLevelProgress() {
  const { totalXP } = getXPData();
  const currentLvl = getLevel();
  const nextIdx = LEVELS.findIndex(l => l.level === currentLvl.level) + 1;

  if (nextIdx >= LEVELS.length) {
    return {
      current: totalXP,
      next: currentLvl.xp,
      progress: 1,
      nextTitle: 'MAX',
      nextEmoji: '♾️',
    };
  }

  const nextLvl = LEVELS[nextIdx];
  const xpIntoLevel = totalXP - currentLvl.xp;
  const xpNeeded = nextLvl.xp - currentLvl.xp;
  const progress = xpNeeded > 0 ? Math.min(xpIntoLevel / xpNeeded, 1) : 1;

  return {
    current: totalXP,
    next: nextLvl.xp,
    progress,
    nextTitle: nextLvl.title,
    nextEmoji: nextLvl.emoji,
  };
}

export function getTitle() {
  return getLevel().title;
}
