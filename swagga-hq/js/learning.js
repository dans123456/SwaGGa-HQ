/**
 * SwaGGa HQ — Learning Hub Module
 *
 * Curriculum tracking, assignments, and quizzes based on the
 * Brah Goh trading course.
 *
 * SECURITY:
 *  • All user input displayed via textContent — never innerHTML.
 *  • DOM built exclusively with createElement / appendChild.
 *  • Containers cleared with replaceChildren().
 */

import storage from './storage.js';
import { generateId, formatDate, sanitizeText } from './utils.js';

/* ================================================================== */
/*  CONSTANTS                                                         */
/* ================================================================== */

/** The full Brah Goh 10-episode curriculum. */
export const BRAH_GOH_CURRICULUM = [
  {
    id: 'ep0',
    episode: 0,
    title: 'The Trading Mindset',
    concepts: ['mindset', 'journey', 'inspiration', 'goal-setting'],
    description:
      'Laying the foundation — why mindset is everything. Defining your trading journey and setting realistic goals.',
  },
  {
    id: 'ep1',
    episode: 1,
    title: 'Finding Your Edge',
    concepts: ['edge', 'discipline', 'professional-habits', 'routine'],
    description:
      'What separates profitable traders from the rest. Building discipline and professional habits that stick.',
  },
  {
    id: 'ep2',
    episode: 2,
    title: 'Price Action & Order Flow',
    concepts: ['price-action', 'order-flow', 'market-mechanics', 'tape-reading'],
    description:
      'Understanding how price really moves. Order flow, market mechanics, and reading the tape.',
  },
  {
    id: 'ep3',
    episode: 3,
    title: 'Forex Fundamentals',
    concepts: ['forex-basics', 'currency-pairs', 'pips', 'lots', 'leverage', 'margin'],
    description:
      'Forex 101 — pairs, pips, lots, leverage. How the foreign exchange market operates.',
  },
  {
    id: 'ep4',
    episode: 4,
    title: 'Trading Psychology',
    concepts: ['psychology', 'emotional-control', 'fear', 'greed', 'patience'],
    description:
      'Mastering your emotions. Managing fear, greed, and the patience required for consistent execution.',
  },
  {
    id: 'ep5',
    episode: 5,
    title: 'Market Structure',
    concepts: ['market-structure', 'BOS', 'CHOCH', 'trend-identification', 'swing-points'],
    description:
      'Break of Structure, Change of Character, swing highs/lows. Reading the market like a pro.',
  },
  {
    id: 'ep6',
    episode: 6,
    title: 'Candlestick Patterns',
    concepts: ['candlestick-patterns', 'engulfing', 'pin-bar', 'doji', 'wicks', 'momentum'],
    description:
      'Key candlestick patterns — engulfing, pin bars, dojis. What wicks tell you about momentum.',
  },
  {
    id: 'ep7',
    episode: 7,
    title: 'Supply & Demand',
    concepts: ['supply-demand', 'zones', 'institutional-order-flow', 'accumulation', 'distribution'],
    description:
      'Identifying institutional supply and demand zones. Accumulation vs distribution phases.',
  },
  {
    id: 'ep8',
    episode: 8,
    title: 'Premium / Discount & Fibonacci',
    concepts: ['premium-discount', 'fibonacci', 'OTE', 'entry-timing', 'retracement'],
    description:
      'Buying at discount, selling at premium. Using Fibonacci for optimal trade entries.',
  },
  {
    id: 'ep9',
    episode: 9,
    title: 'Fair Value Gaps',
    concepts: ['fair-value-gap', 'imbalance', 'price-inefficiency', 'FVG', 'liquidity-void'],
    description:
      'Understanding price inefficiencies. How fair value gaps form and how to trade them.',
  },
];

/** Assignment template strings using {asset}, {timeframe}, {concept} placeholders. */
export const ASSIGNMENT_TEMPLATES = [
  'Identify 3 {concept} setups on {asset} ({timeframe} chart). Screenshot and annotate each.',
  'Back-test {concept} on {asset} over the last 20 candles on the {timeframe} timeframe. Record win rate.',
  'Mark all {concept} zones on the {asset} {timeframe} chart from the current week.',
  'Write a 100-word summary explaining how {concept} applies to {asset} on the {timeframe} timeframe.',
  'Find a live {concept} setup on {asset} ({timeframe}). Plan entry, stop, and target before it triggers.',
  'Compare {concept} across two timeframes on {asset}. Note differences in clarity.',
  'Journal 3 key observations about {concept} behaviour on {asset} ({timeframe}) during London session.',
  'Create a checklist for trading {concept} setups on {asset}. Include at least 5 criteria.',
];

const STORAGE_LESSONS = 'lessons';
const STORAGE_ASSIGNMENTS = 'assignments';

const RANDOM_ASSETS = ['EUR/USD', 'GBP/USD', 'XAU/USD', 'BTC/USD', 'NAS100', 'US30', 'GBP/JPY'];
const RANDOM_TIMEFRAMES = ['M15', 'M30', 'H1', 'H4', 'D1'];

/* ================================================================== */
/*  DATA LAYER                                                        */
/* ================================================================== */

export function getLessons() {
  return storage.get(STORAGE_LESSONS, []);
}

export function saveLessonEntry(lessonData) {
  const lessons = getLessons();
  const entry = {
    id: generateId(),
    ...lessonData,
    notes: sanitizeText(lessonData.notes || '', 2000),
    createdAt: new Date().toISOString(),
  };
  lessons.push(entry);
  storage.set(STORAGE_LESSONS, lessons);
  return entry;
}

export function getAssignments() {
  return storage.get(STORAGE_ASSIGNMENTS, []);
}

export function saveAssignment(assignment) {
  const assignments = getAssignments();
  const entry = {
    id: generateId(),
    ...assignment,
    completed: false,
    createdAt: new Date().toISOString(),
  };
  assignments.push(entry);
  storage.set(STORAGE_ASSIGNMENTS, assignments);
  return entry;
}

/**
 * Build a concept library from all logged lessons.
 * @returns {string[]} Unique concept strings.
 */
export function getConceptLibrary() {
  const lessons = getLessons();
  const conceptSet = new Set();
  lessons.forEach((l) => {
    if (Array.isArray(l.concepts)) {
      l.concepts.forEach((c) => conceptSet.add(c));
    }
  });
  // Also include curriculum concepts as a baseline.
  BRAH_GOH_CURRICULUM.forEach((ep) => {
    ep.concepts.forEach((c) => conceptSet.add(c));
  });
  return [...conceptSet];
}

/* ================================================================== */
/*  ASSIGNMENT & QUIZ GENERATORS                                      */
/* ================================================================== */

/**
 * Generate a random assignment.
 * @param {string[]} conceptLibrary
 * @returns {object}
 */
export function generateAssignment(conceptLibrary) {
  const concepts = conceptLibrary.length ? conceptLibrary : ['price-action'];
  const concept = concepts[Math.floor(Math.random() * concepts.length)];
  const asset = RANDOM_ASSETS[Math.floor(Math.random() * RANDOM_ASSETS.length)];
  const timeframe = RANDOM_TIMEFRAMES[Math.floor(Math.random() * RANDOM_TIMEFRAMES.length)];
  const template = ASSIGNMENT_TEMPLATES[Math.floor(Math.random() * ASSIGNMENT_TEMPLATES.length)];

  const text = template
    .replace('{concept}', concept)
    .replace('{asset}', asset)
    .replace('{timeframe}', timeframe);

  return { text, concept, asset, timeframe };
}

/**
 * Generate quiz questions from the concept library.
 * Each question is a simple "Define this concept" prompt.
 * @param {string[]} concepts
 * @param {number} count
 * @returns {Array<{question: string, concept: string}>}
 */
export function generateQuiz(concepts, count = 5) {
  if (!concepts.length) return [];
  const shuffled = [...concepts].sort(() => Math.random() - 0.5);
  const selected = shuffled.slice(0, Math.min(count, shuffled.length));
  return selected.map((c) => ({
    concept: c,
    question: `In your own words, explain what "${c}" means and how you would use it in a trade.`,
  }));
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

/* ---------- Mentor Cards ------------------------------------------ */

export function renderMentorCards(container) {
  container.replaceChildren();
  const grid = el('div', 'mentor-grid');

  // Brah Goh — active
  const gohCard = el('div', 'mentor-card mentor-active');
  gohCard.appendChild(el('span', 'mentor-emoji', '🧠'));
  gohCard.appendChild(el('h3', 'mentor-name', 'Brah Goh'));
  gohCard.appendChild(el('p', 'mentor-status', 'Active Mentor'));
  gohCard.appendChild(el('p', 'mentor-desc', '10-episode ICT-style trading course. Price action, market structure, supply & demand.'));
  grid.appendChild(gohCard);

  // Boss Ackah — placeholder
  const ackahCard = el('div', 'mentor-card mentor-placeholder');
  ackahCard.appendChild(el('span', 'mentor-emoji', '👑'));
  ackahCard.appendChild(el('h3', 'mentor-name', 'Boss Ackah'));
  ackahCard.appendChild(el('p', 'mentor-status', 'Coming Soon'));
  ackahCard.appendChild(el('p', 'mentor-desc', 'Advanced concepts and strategies. Stay tuned.'));
  grid.appendChild(ackahCard);

  container.appendChild(grid);
}

/* ---------- Curriculum Log ---------------------------------------- */

export function renderCurriculumLog(container) {
  container.replaceChildren();
  const lessons = getLessons();
  const wrapper = el('div', 'curriculum-section');
  wrapper.appendChild(el('h2', 'section-title', '📚 Curriculum Timeline'));

  // Build timeline from the curriculum, marking logged episodes.
  const timeline = el('div', 'curriculum-timeline');
  const loggedEpisodes = new Set(lessons.map((l) => l.episodeId));

  BRAH_GOH_CURRICULUM.forEach((ep) => {
    const item = el('div', `timeline-item${loggedEpisodes.has(ep.id) ? ' completed' : ''}`);
    const marker = el('div', 'timeline-marker', loggedEpisodes.has(ep.id) ? '✅' : '⬜');
    const content = el('div', 'timeline-content');
    content.appendChild(el('h4', '', `Ep ${ep.episode}: ${ep.title}`));
    content.appendChild(el('p', 'timeline-desc', ep.description));

    // Show concepts as tags.
    const tagBar = el('div', 'concept-tags');
    ep.concepts.forEach((c) => {
      tagBar.appendChild(el('span', 'tag', c));
    });
    content.appendChild(tagBar);

    item.appendChild(marker);
    item.appendChild(content);
    timeline.appendChild(item);
  });

  wrapper.appendChild(timeline);
  container.appendChild(wrapper);
}

/* ---------- Assignments ------------------------------------------- */

export function renderAssignments(container, onRefresh) {
  container.replaceChildren();
  const wrapper = el('div', 'assignments-section');
  wrapper.appendChild(el('h2', 'section-title', '📝 Assignments'));

  // Generate button.
  const genBtn = el('button', 'btn btn-secondary', '🎲 Generate Assignment');
  genBtn.addEventListener('click', () => {
    const concepts = getConceptLibrary();
    const assignment = generateAssignment(concepts);
    saveAssignment(assignment);
    if (typeof onRefresh === 'function') onRefresh();
  });
  wrapper.appendChild(genBtn);

  const assignments = getAssignments();
  if (!assignments.length) {
    wrapper.appendChild(el('p', 'empty-hint', 'No assignments yet. Generate one!'));
  } else {
    const list = el('div', 'assignment-list');
    [...assignments].reverse().forEach((a) => {
      const card = el('div', `assignment-card${a.completed ? ' done' : ''}`);
      card.appendChild(el('p', 'assignment-text', a.text));

      const meta = el('div', 'assignment-meta');
      meta.appendChild(el('span', 'tag', a.concept));
      meta.appendChild(el('span', 'tag', a.asset));
      meta.appendChild(el('span', 'tag', a.timeframe));
      card.appendChild(meta);

      // Toggle complete.
      const toggleBtn = el('button', 'btn btn-sm', a.completed ? '↩️ Reopen' : '✅ Complete');
      toggleBtn.addEventListener('click', () => {
        const all = getAssignments();
        const target = all.find((x) => x.id === a.id);
        if (target) {
          target.completed = !target.completed;
          storage.set(STORAGE_ASSIGNMENTS, all);
          if (typeof onRefresh === 'function') onRefresh();
        }
      });
      card.appendChild(toggleBtn);
      list.appendChild(card);
    });
    wrapper.appendChild(list);
  }

  container.appendChild(wrapper);
}

/* ---------- Add Lesson Form --------------------------------------- */

function renderAddLessonForm(container, onSaved) {
  container.replaceChildren();
  const wrapper = el('div', 'add-lesson-section');
  wrapper.appendChild(el('h2', 'section-title', '➕ Log a Lesson'));

  const form = el('form', 'lesson-form');
  form.setAttribute('novalidate', '');

  // Episode select.
  const epSelect = document.createElement('select');
  epSelect.name = 'episodeId';
  epSelect.required = true;
  const defOpt = el('option', '', '— Select Episode —');
  defOpt.value = '';
  epSelect.appendChild(defOpt);
  BRAH_GOH_CURRICULUM.forEach((ep) => {
    const opt = el('option', '', `Ep ${ep.episode}: ${ep.title}`);
    opt.value = ep.id;
    epSelect.appendChild(opt);
  });
  const epGroup = el('div', 'form-group');
  epSelect.classList.add('form-select');
  epGroup.appendChild(el('label', 'form-label', 'Episode'));
  epGroup.appendChild(epSelect);
  form.appendChild(epGroup);

  // Key takeaways.
  const takeawayInput = document.createElement('textarea');
  takeawayInput.name = 'notes';
  takeawayInput.rows = 3;
  takeawayInput.placeholder = 'Key takeaways from this lesson…';
  const taGroup = el('div', 'form-group');
  takeawayInput.classList.add('form-textarea');
  taGroup.appendChild(el('label', 'form-label', 'Takeaways / Notes'));
  taGroup.appendChild(takeawayInput);
  form.appendChild(taGroup);

  // Rating.
  const ratingSelect = document.createElement('select');
  ratingSelect.name = 'rating';
  for (let i = 1; i <= 5; i++) {
    const opt = el('option', '', '⭐'.repeat(i));
    opt.value = String(i);
    ratingSelect.appendChild(opt);
  }
  const rGroup = el('div', 'form-group');
  ratingSelect.classList.add('form-select');
  rGroup.appendChild(el('label', 'form-label', 'Understanding'));
  rGroup.appendChild(ratingSelect);
  form.appendChild(rGroup);

  const submitBtn = el('button', 'btn btn-primary', 'Save Lesson 📖');
  submitBtn.type = 'submit';
  form.appendChild(submitBtn);

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const episodeId = fd.get('episodeId');
    if (!episodeId) {
      epSelect.focus();
      return;
    }

    const ep = BRAH_GOH_CURRICULUM.find((c) => c.id === episodeId);
    saveLessonEntry({
      episodeId,
      episodeTitle: ep ? ep.title : '',
      concepts: ep ? ep.concepts : [],
      notes: fd.get('notes') || '',
      rating: Number(fd.get('rating')) || 3,
    });
    form.reset();
    if (typeof onSaved === 'function') onSaved();
  });

  wrapper.appendChild(form);
  container.appendChild(wrapper);
}

/* ---------- Quiz Section ------------------------------------------ */

function renderQuizSection(container) {
  container.replaceChildren();
  const wrapper = el('div', 'quiz-section');
  wrapper.appendChild(el('h2', 'section-title', '🧩 Quick Quiz'));

  const quizArea = el('div', 'quiz-area');

  const genBtn = el('button', 'btn btn-secondary', '🎲 Generate Quiz');
  genBtn.addEventListener('click', () => {
    quizArea.replaceChildren();
    const concepts = getConceptLibrary();
    const questions = generateQuiz(concepts, 5);

    if (!questions.length) {
      quizArea.appendChild(el('p', 'empty-hint', 'Log some lessons first to generate quiz questions.'));
      return;
    }

    questions.forEach((q, idx) => {
      const card = el('div', 'quiz-card');
      card.appendChild(el('p', 'quiz-q', `${idx + 1}. ${q.question}`));
      const answer = document.createElement('textarea');
      answer.classList.add('form-textarea');
      answer.rows = 2;
      answer.placeholder = 'Your answer…';
      card.appendChild(answer);
      quizArea.appendChild(card);
    });
  });

  wrapper.appendChild(genBtn);
  wrapper.appendChild(quizArea);
  container.appendChild(wrapper);
}

/* ================================================================== */
/*  MAIN RENDER                                                       */
/* ================================================================== */

/**
 * Build the full Learning page.
 * @param {HTMLElement} container - #page-learning element.
 */
export function renderLearningPage(container) {
  container.replaceChildren();
  container.appendChild(el('h1', 'page-title', '📚 Learning Hub'));

  const mentorContainer = el('div');
  const curriculumContainer = el('div');
  const lessonFormContainer = el('div');
  const assignmentContainer = el('div');
  const quizContainer = el('div');

  container.appendChild(mentorContainer);
  container.appendChild(curriculumContainer);
  container.appendChild(lessonFormContainer);
  container.appendChild(assignmentContainer);
  container.appendChild(quizContainer);

  function refresh() {
    renderCurriculumLog(curriculumContainer);
    renderAssignments(assignmentContainer, refresh);
  }

  renderMentorCards(mentorContainer);
  renderCurriculumLog(curriculumContainer);
  renderAddLessonForm(lessonFormContainer, refresh);
  renderAssignments(assignmentContainer, refresh);
  renderQuizSection(quizContainer);
}
