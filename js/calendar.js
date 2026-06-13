// monthly calendar view

import { getTrades } from './trading.js';
import { getLessons } from './learning.js';
import { getHabits, calculateStreak } from './streaks.js';
import { formatCurrency, formatDate, el } from './utils.js';
import storage from './storage.js';

let _currentYear = new Date().getFullYear();
let _currentMonth = new Date().getMonth(); // 0-indexed

export function renderCalendarPage(container) {
  container.replaceChildren();

  container.appendChild(el('h1', 'page-title', '📅 Monthly Calendar'));

  const wrapper = el('div', 'overview-panel calendar-wrapper');
  
  const header = el('div', 'calendar-header');
  const prevBtn = el('button', 'btn btn-outline btn-sm calendar-month-btn', '◀');
  const monthTitle = el('h2', 'calendar-month-title');
  const nextBtn = el('button', 'btn btn-outline btn-sm calendar-month-btn', '▶');

  prevBtn.addEventListener('click', () => {
    _currentMonth--;
    if (_currentMonth < 0) {
      _currentMonth = 11;
      _currentYear--;
    }
    updateCalendar();
  });

  nextBtn.addEventListener('click', () => {
    _currentMonth++;
    if (_currentMonth > 11) {
      _currentMonth = 0;
      _currentYear++;
    }
    updateCalendar();
  });

  header.appendChild(prevBtn);
  header.appendChild(monthTitle);
  header.appendChild(nextBtn);
  wrapper.appendChild(header);

  const weekdaysGrid = el('div', 'calendar-weekdays');
  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  weekdays.forEach(w => {
    weekdaysGrid.appendChild(el('div', 'calendar-weekday', w));
  });
  wrapper.appendChild(weekdaysGrid);

  const daysGrid = el('div', 'calendar-grid');
  wrapper.appendChild(daysGrid);
  container.appendChild(wrapper);

  function updateCalendar() {
    daysGrid.replaceChildren();

    const dummyDate = new Date(_currentYear, _currentMonth, 1);
    monthTitle.textContent = dummyDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    const firstDayIndex = new Date(_currentYear, _currentMonth, 1).getDay();
    const totalDays = new Date(_currentYear, _currentMonth + 1, 0).getDate();

    const trades = getTrades();
    const lessons = getLessons();
    const habits = getHabits();
    const dailyGrades = storage.get('daily_grades', {});
    const reviews = storage.get('reviews', []) || [];

    for (let i = 0; i < firstDayIndex; i++) {
      daysGrid.appendChild(el('div', 'calendar-day calendar-day--empty'));
    }

    for (let day = 1; day <= totalDays; day++) {
      const cellDate = new Date(_currentYear, _currentMonth, day);
      const dateKey = `${_currentYear}-${String(_currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      
      const dayCell = el('div', 'calendar-day');
      dayCell.appendChild(el('span', 'calendar-day-number', String(day)));

      // grade ring + badge
      const grade = dailyGrades[dateKey];
      if (grade) {
        dayCell.classList.add(`calendar-day--grade-${grade.replace('+', 'plus')}`);
        const badge = el('span', `calendar-day-grade-badge calendar-day-grade-badge--${grade.replace('+', 'plus')}`, grade);
        dayCell.appendChild(badge);
      }

      const indicators = el('div', 'calendar-day-indicators');

      const dayTrades = trades.filter(t => {
        const td = (t.date || t.createdAt || '').slice(0, 10);
        return td === dateKey;
      });

      if (dayTrades.length > 0) {
        const netPnL = dayTrades.reduce((sum, t) => sum + (Number(t.pnl) || 0), 0);
        const trIndicator = el('span', `calendar-day-indicator calendar-day-indicator--trade ${netPnL > 0 ? 'text-green' : netPnL < 0 ? 'text-red' : 'text-gray'}`);
        trIndicator.textContent = `${netPnL >= 0 ? '+' : ''}${formatCurrency(netPnL)}`;
        indicators.appendChild(trIndicator);

        if (netPnL > 0) {
          dayCell.classList.add('calendar-day--profit');
        } else if (netPnL < 0) {
          dayCell.classList.add('calendar-day--loss');
        } else {
          dayCell.classList.add('calendar-day--breakeven');
        }
      }

      const checkedHabits = habits.filter(h => h.log && h.log[dateKey]);
      const frozenHabits = habits.filter(h => h.freezes && h.freezes[dateKey]);

      if (checkedHabits.length > 0 || frozenHabits.length > 0) {
        const isPerfect = (checkedHabits.length + frozenHabits.length) === habits.length && habits.length > 0;
        const streakIndicator = el('span', 'calendar-day-indicator calendar-day-indicator--streak');
        if (isPerfect) {
          streakIndicator.textContent = '🔥 Perfect';
          streakIndicator.style.color = 'var(--purple)';
        } else {
          const emojis = [...checkedHabits.map(h => h.emoji), ...frozenHabits.map(() => '❄️')];
          streakIndicator.textContent = emojis.slice(0, 3).join('');
        }
        indicators.appendChild(streakIndicator);
      }

      const dayLessons = lessons.filter(l => {
        const ld = (l.date || l.loggedAt || l.createdAt || '').slice(0, 10);
        return ld === dateKey;
      });

      if (dayLessons.length > 0) {
        const lsIndicator = el('span', 'calendar-day-indicator calendar-day-indicator--lesson');
        lsIndicator.textContent = `📚 ${dayLessons.length} Lesson${dayLessons.length > 1 ? 's' : ''}`;
        indicators.appendChild(lsIndicator);
      }

      const dayReviews = reviews.filter(r => {
        const rd = (r.createdAt || '').slice(0, 10);
        return rd === dateKey;
      });

      if (dayReviews.length > 0) {
        const revIndicator = el('span', 'calendar-day-indicator calendar-day-indicator--review');
        const types = dayReviews.map(r => r.type === 'weekly' ? 'W' : r.type === 'monthly' ? 'M' : 'Q').join('/');
        revIndicator.textContent = `📝 Review (${types})`;
        indicators.appendChild(revIndicator);
      }

      const pomoCount = 0;

      dayCell.appendChild(indicators);

      const today = new Date();
      if (today.getDate() === day && today.getMonth() === _currentMonth && today.getFullYear() === _currentYear) {
        dayCell.classList.add('calendar-day--today');
      }

      dayCell.classList.add('calendar-day--active');
      dayCell.addEventListener('click', () => {
        openDayPopover(dateKey, dayTrades, checkedHabits, frozenHabits, dayLessons, pomoCount, grade, dayReviews);
      });

      daysGrid.appendChild(dayCell);
    }
  }

  updateCalendar();
}

function openDayPopover(dateKey, trades, checkedHabits, frozenHabits, lessons, pomoCount = 0, grade = null, dayReviews = []) {

  const existing = document.getElementById('calendar-popover');
  if (existing) existing.remove();

  const overlay = el('div', 'welcome-modal-overlay');
  overlay.id = 'calendar-popover';

  const modal = el('div', 'welcome-modal');
  modal.style.maxWidth = '520px';

  const glow = el('div', 'welcome-glow-bar');
  glow.style.background = 'linear-gradient(90deg, var(--cyan), var(--purple))';
  modal.appendChild(glow);

  const closeBtn = el('button', 'recap-close', '✕');
  closeBtn.addEventListener('click', () => {
    overlay.style.opacity = '0';
    setTimeout(() => overlay.remove(), 250);
  });
  modal.appendChild(closeBtn);

  const formattedDate = formatDate(dateKey, 'long');
  const title = el('h2', 'welcome-modal__title', formattedDate);
  title.style.fontSize = 'var(--text-xl)';
  title.style.marginBottom = 'var(--space-5)';
  modal.appendChild(title);

  const container = el('div', 'calendar-popover-content');
  container.style.textAlign = 'left';
  container.style.maxHeight = '400px';
  container.style.overflowY = 'auto';

  if (trades.length > 0) {
    const section = el('div', 'popover-section');
    section.appendChild(el('h3', 'popover-section-title', '📈 Trades Logged'));
    const list = el('div', 'popover-list');
    trades.forEach(t => {
      const item = el('div', 'popover-list-item');
      
      const details = el('span', 'popover-item-details');
      details.appendChild(el('strong', '', `${t.direction === 'short' ? '🔴 SHORT' : '🟢 LONG'} ${t.asset}`));
      details.appendChild(el('span', 'text-muted', ` | Pips: ${t.pips || '—'} | R:R: ${t.rr || '—'}`));
      item.appendChild(details);

      const pnlVal = Number(t.pnl) || 0;
      const pnlSpan = el('span', `popover-item-pnl ${pnlVal > 0 ? 'text-green' : pnlVal < 0 ? 'text-red' : 'text-gray'}`);
      pnlSpan.textContent = `${pnlVal >= 0 ? '+' : ''}${formatCurrency(pnlVal)}`;
      pnlSpan.style.fontWeight = '700';
      item.appendChild(pnlSpan);

      list.appendChild(item);
    });
    section.appendChild(list);
    container.appendChild(section);
  }

  if (checkedHabits.length > 0 || frozenHabits.length > 0) {
    const section = el('div', 'popover-section');
    section.style.marginTop = 'var(--space-4)';
    section.appendChild(el('h3', 'popover-section-title', '🔥 Habits Checked'));
    const list = el('div', 'popover-list-tags');
    checkedHabits.forEach(h => {
      const tag = el('span', 'popover-tag');
      tag.style.background = h.bgColor || 'rgba(0,212,255,0.08)';
      tag.style.borderColor = h.borderColor || 'rgba(0,212,255,0.25)';
      tag.style.color = h.color || '#00d4ff';
      tag.appendChild(el('span', '', `${h.emoji} ${h.name}`));
      list.appendChild(tag);
    });
    frozenHabits.forEach(h => {
      const tag = el('span', 'popover-tag');
      tag.style.background = 'rgba(0, 212, 255, 0.08)';
      tag.style.borderColor = 'rgba(0, 212, 255, 0.25)';
      tag.style.color = 'var(--cyan)';
      tag.appendChild(el('span', '', `❄️ ${h.name} (Frozen)`));
      list.appendChild(tag);
    });
    section.appendChild(list);
    container.appendChild(section);
  }

  if (lessons.length > 0) {
    const section = el('div', 'popover-section');
    section.style.marginTop = 'var(--space-4)';
    section.appendChild(el('h3', 'popover-section-title', '📚 Lessons Finished'));
    const list = el('div', 'popover-list');
    lessons.forEach(l => {
      const item = el('div', 'popover-list-item-lesson');
      item.appendChild(el('strong', '', `Episode ${l.episodeId || l.id}: ${l.title || 'Logged Lesson'}`));
      list.appendChild(item);
    });
    section.appendChild(list);
    container.appendChild(section);
  }

  if (pomoCount > 0) {
    const pomoSection = el('div', 'popover-section');
    pomoSection.style.marginTop = 'var(--space-4)';
    pomoSection.appendChild(el('h3', 'popover-section-title', '⏱️ Study Blocks'));
    const blockText = el('p', '', `You completed ${pomoCount} Pomodoro study focus block${pomoCount > 1 ? 's' : ''} on this day! 🍅`);
    blockText.style.fontSize = 'var(--text-sm)';
    blockText.style.color = 'var(--text-secondary)';
    blockText.style.marginTop = 'var(--space-2)';
    pomoSection.appendChild(blockText);
    container.appendChild(pomoSection);
  }

  if (dayReviews.length > 0) {
    const section = el('div', 'popover-section');
    section.style.marginTop = 'var(--space-4)';
    section.appendChild(el('h3', 'popover-section-title', '📊 Completed Reflections'));
    const list = el('div', 'popover-list');
    dayReviews.forEach(r => {
      const item = el('div', 'popover-list-item');
      item.style.display = 'flex';
      item.style.justifyContent = 'space-between';
      item.style.alignItems = 'center';
      
      const details = el('span', 'popover-item-details');
      const typeName = r.type.charAt(0).toUpperCase() + r.type.slice(1);
      details.appendChild(el('strong', '', `📝 ${typeName} Review`));
      details.appendChild(el('span', 'text-muted', ` | Range: ${r.startDate} to ${r.endDate}`));
      item.appendChild(details);

      if (r.rating) {
        const stars = el('span', 'review-history-stars', '⭐'.repeat(r.rating));
        item.appendChild(stars);
      }
      list.appendChild(item);
    });
    section.appendChild(list);
    container.appendChild(section);
  }

  // grade selection
  const gradeSection = el('div', 'popover-section');
  gradeSection.style.marginTop = 'var(--space-4)';
  gradeSection.style.borderTop = '1px solid rgba(255,255,255,0.06)';
  gradeSection.style.paddingTop = 'var(--space-4)';

  gradeSection.appendChild(el('h3', 'popover-section-title', '📊 Daily Discipline Grade'));
  
  const gradeSelectRow = el('div', 'grade-select-row');
  gradeSelectRow.style.display = 'flex';
  gradeSelectRow.style.flexWrap = 'wrap';
  gradeSelectRow.style.gap = 'var(--space-2)';
  gradeSelectRow.style.marginTop = 'var(--space-2)';

  const gradesList = ['None', 'A+', 'A', 'B', 'C', 'D', 'F'];
  gradesList.forEach(g => {
    const isActive = g === (grade || 'None');
    const btn = el('button', `btn btn-sm ${isActive ? 'btn-secondary' : 'btn-outline'}`);
    btn.textContent = g;
    btn.style.padding = '0.3rem 0.6rem';
    btn.addEventListener('click', () => {
      const dailyGradesMap = storage.get('daily_grades', {});
      if (g === 'None') {
        delete dailyGradesMap[dateKey];
      } else {
        dailyGradesMap[dateKey] = g;
      }
      storage.set('daily_grades', dailyGradesMap);

      import('./firebase-sync.js').then(({ pushToCloud, getCurrentUser }) => {
        if (getCurrentUser()) pushToCloud();
      });

      overlay.remove();

      const renderWrapper = document.getElementById('page-calendar');
      if (renderWrapper) {
        renderCalendarPage(renderWrapper);
      }

      openDayPopover(dateKey, trades, checkedHabits, frozenHabits, lessons, pomoCount, g === 'None' ? null : g, dayReviews);
    });
    gradeSelectRow.appendChild(btn);
  });
  gradeSection.appendChild(gradeSelectRow);
  container.appendChild(gradeSection);

  modal.appendChild(container);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      overlay.style.opacity = '0';
      setTimeout(() => overlay.remove(), 250);
    }
  });
}
