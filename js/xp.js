// xp & leveling system

import storage from './storage.js';

export const LEVELS = [
  { level: 1,  xp: 0,    title: 'Recruit',    emoji: '🪖' },
  { level: 2,  xp: 100,  title: 'Cadet',      emoji: '⭐' },
  { level: 3,  xp: 300,  title: 'Soldier',    emoji: '🎖️' },
  { level: 4,  xp: 600,  title: 'Sergeant',   emoji: '🏅' },
  { level: 5,  xp: 1000, title: 'Lieutenant', emoji: '⚔️' },
  { level: 6,  xp: 1500, title: 'Captain',    emoji: '🛡️' },
  { level: 7,  xp: 2200, title: 'Commander',  emoji: '🦅' },
  { level: 8,  xp: 3000, title: 'Colonel',    emoji: '🎯' },
  { level: 9,  xp: 4000, title: 'General',    emoji: '⭐⭐' },
  { level: 10, xp: 5500, title: 'Legend',     emoji: '👑' },
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
  return storage.get(STORAGE_KEY, { totalXP: 0, history: [] });
}

// award XP and persist — dispatches 'xp-change' event
export function addXP(action, amount) {

  const oldLevelObj = getLevel();
  
  const data = getXPData();
  data.totalXP += amount;
  data.history.push({
    action,
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
      newLevel: newLevelObj
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
      nextEmoji: '👑',
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
