/**
 * SwaGGa HQ — Learning Hub Module (Redesigned)
 *
 * 33-lesson Brah Goh curriculum with popup quiz (MCQ + open-ended)
 * and popup lesson logger. Quiz auto-generates from completed lessons.
 *
 * SECURITY: All DOM via createElement + textContent. No innerHTML.
 */

import storage from './storage.js';
import { generateId, formatDate, sanitizeText } from './utils.js';
import { addXP } from './xp.js';

/* ================================================================== */
/*  CONSTANTS                                                         */
/* ================================================================== */

/** Full 33-episode Brah Goh curriculum. Episodes 0-9 are detailed. */
export const BRAH_GOH_CURRICULUM = [
  { id: 'ep0',  episode: 0,  title: 'The Trading Mindset',             concepts: ['mindset', 'journey', 'inspiration', 'goal-setting'],                              description: 'Why mindset is everything. Defining your trading journey and setting realistic goals.' },
  { id: 'ep1',  episode: 1,  title: 'Finding Your Edge',               concepts: ['edge', 'discipline', 'professional-habits', 'routine'],                            description: 'What separates profitable traders. Building discipline and professional habits.' },
  { id: 'ep2',  episode: 2,  title: 'Price Action & Order Flow',       concepts: ['price-action', 'order-flow', 'market-mechanics', 'tape-reading'],                  description: 'How price really moves. Order flow, market mechanics, and reading the tape.' },
  { id: 'ep3',  episode: 3,  title: 'Forex Fundamentals',              concepts: ['forex-basics', 'currency-pairs', 'pips', 'lots', 'leverage', 'margin'],            description: 'Forex 101 — pairs, pips, lots, leverage. How the FX market operates.' },
  { id: 'ep4',  episode: 4,  title: 'Trading Psychology',              concepts: ['psychology', 'emotional-control', 'fear', 'greed', 'patience'],                    description: 'Mastering emotions. Managing fear, greed, and patience for consistent execution.' },
  { id: 'ep5',  episode: 5,  title: 'Market Structure',                concepts: ['market-structure', 'BOS', 'CHOCH', 'trend-identification', 'swing-points'],        description: 'Break of Structure, Change of Character, swing highs/lows.' },
  { id: 'ep6',  episode: 6,  title: 'Candlestick Patterns',            concepts: ['candlestick-patterns', 'engulfing', 'pin-bar', 'doji', 'wicks', 'momentum'],       description: 'Key patterns — engulfing, pin bars, dojis. What wicks say about momentum.' },
  { id: 'ep7',  episode: 7,  title: 'Supply & Demand',                 concepts: ['supply-demand', 'zones', 'institutional-order-flow', 'accumulation', 'distribution'], description: 'Institutional supply/demand zones. Accumulation vs distribution.' },
  { id: 'ep8',  episode: 8,  title: 'Premium / Discount & Fibonacci',  concepts: ['premium-discount', 'fibonacci', 'OTE', 'entry-timing', 'retracement'],            description: 'Buying discount, selling premium. Fibonacci for optimal entries.' },
  { id: 'ep9',  episode: 9,  title: 'Fair Value Gaps',                 concepts: ['fair-value-gap', 'imbalance', 'price-inefficiency', 'FVG', 'liquidity-void'],      description: 'Price inefficiencies. How FVGs form and how to trade them.' },
  // Locked episodes (10-32) — user can add details when released
  { id: 'ep10', episode: 10, title: 'Lesson 10', concepts: [], description: '', locked: true },
  { id: 'ep11', episode: 11, title: 'Top Down Analysis Strategy', concepts: ['top-down-analysis', 'HTF-bias', 'multi-timeframe', 'fractal-markets'], description: 'How to perform multi-timeframe analysis. Establish HTF bias on D1/H4 and execute on LTF (H1/M15) to avoid noise.', videoUrl: 'https://youtu.be/qtrATSo3-lQ?si=MhuT5JwI_Wkbp5eP' },
  { id: 'ep12', episode: 12, title: 'ICT Killzones', concepts: ['killzones', 'session-timing', 'london-killzone', 'new-york-killzone'], description: 'Understanding session timing and high-volume windows. Exact times for Asian, London, New York, and London Close sessions.', videoUrl: 'https://youtu.be/uLw-qdpV3uk?si=elqDijw5R0RU4MCK' },
  { id: 'ep13', episode: 13, title: 'Liquidity Concepts & Inducements', concepts: ['liquidity', 'inducement', 'liquidity-sweeps', 'retail-traps'], description: 'How smart money engineers traps to lure retail traders into early entries and sweep stop-losses for liquidity.', videoUrl: 'https://youtu.be/TthzSVTzWoE?si=4W_vBI8GGpg--REU' },
  { id: 'ep14', episode: 14, title: 'Lesson 14', concepts: [], description: '', locked: true },
  { id: 'ep15', episode: 15, title: 'Lesson 15', concepts: [], description: '', locked: true },
  { id: 'ep16', episode: 16, title: 'Lesson 16', concepts: [], description: '', locked: true },
  { id: 'ep17', episode: 17, title: 'Lesson 17', concepts: [], description: '', locked: true },
  { id: 'ep18', episode: 18, title: 'Lesson 18', concepts: [], description: '', locked: true },
  { id: 'ep19', episode: 19, title: 'Lesson 19', concepts: [], description: '', locked: true },
  { id: 'ep20', episode: 20, title: 'Lesson 20', concepts: [], description: '', locked: true },
  { id: 'ep21', episode: 21, title: 'Lesson 21', concepts: [], description: '', locked: true },
  { id: 'ep22', episode: 22, title: 'Lesson 22', concepts: [], description: '', locked: true },
  { id: 'ep23', episode: 23, title: 'Lesson 23', concepts: [], description: '', locked: true },
  { id: 'ep24', episode: 24, title: 'Lesson 24', concepts: [], description: '', locked: true },
  { id: 'ep25', episode: 25, title: 'Lesson 25', concepts: [], description: '', locked: true },
  { id: 'ep26', episode: 26, title: 'Lesson 26', concepts: [], description: '', locked: true },
  { id: 'ep27', episode: 27, title: 'Lesson 27', concepts: [], description: '', locked: true },
  { id: 'ep28', episode: 28, title: 'Lesson 28', concepts: [], description: '', locked: true },
  { id: 'ep29', episode: 29, title: 'Lesson 29', concepts: [], description: '', locked: true },
  { id: 'ep30', episode: 30, title: 'Lesson 30', concepts: [], description: '', locked: true },
  { id: 'ep31', episode: 31, title: 'Lesson 31', concepts: [], description: '', locked: true },
  { id: 'ep32', episode: 32, title: 'Lesson 32', concepts: [], description: '', locked: true },
];

/** MCQ question bank — auto-matched to concepts */
const QUIZ_BANK = [
  { concept: 'BOS',                q: 'What does BOS stand for?',                                      choices: ['Break of Structure', 'Balance of Supply', 'Base of Support', 'Band of Strength'],       answer: 0 },
  { concept: 'CHOCH',              q: 'What does CHOCH indicate?',                                     choices: ['Change of Character', 'Channel of Charts', 'Close of High/Open/Close/High', 'Check of Channel'], answer: 0 },
  { concept: 'fair-value-gap',     q: 'A Fair Value Gap is created by:',                               choices: ['Three candles with a gap between candle 1 and 3', 'Two equal highs', 'A single doji candle', 'A news event'], answer: 0 },
  { concept: 'engulfing',          q: 'An engulfing candle:',                                           choices: ['Completely covers the previous candle body', 'Has very long wicks', 'Is always green', 'Forms at market open only'], answer: 0 },
  { concept: 'pin-bar',            q: 'A pin bar is characterised by:',                                choices: ['A long wick and small body', 'Two equal bodies', 'No wick at all', 'A gap up'], answer: 0 },
  { concept: 'supply-demand',      q: 'A demand zone is where:',                                       choices: ['Institutional buyers placed large orders', 'Price always reverses', 'Volume is lowest', 'Spreads are widest'], answer: 0 },
  { concept: 'fibonacci',          q: 'The Optimal Trade Entry (OTE) Fibonacci zone is:',              choices: ['0.618 – 0.786 retracement', '0.0 – 0.236 retracement', '1.0 – 1.618 extension', '0.382 – 0.5 retracement'], answer: 0 },
  { concept: 'premium-discount',   q: 'In ICT terms, "discount" means price is:',                      choices: ['Below the 50% equilibrium level', 'Above the 50% equilibrium level', 'At the highest point', 'In consolidation'], answer: 0 },
  { concept: 'market-structure',   q: 'A higher high followed by a higher low indicates:',             choices: ['Bullish market structure', 'Bearish market structure', 'Consolidation', 'Reversal'], answer: 0 },
  { concept: 'pips',               q: 'How many pips is 1.2350 to 1.2400?',                            choices: ['50 pips', '5 pips', '500 pips', '0.5 pips'], answer: 0 },
  { concept: 'leverage',           q: '1:100 leverage means:',                                          choices: ['$1 controls $100', '$100 controls $1', 'You can only lose $1', 'You get 100% profit'], answer: 0 },
  { concept: 'psychology',         q: 'Revenge trading is caused by:',                                  choices: ['Emotional reaction to a loss', 'A good trading plan', 'Over-preparation', 'Low leverage'], answer: 0 },
  { concept: 'price-action',       q: 'Price action trading primarily uses:',                           choices: ['Raw price movement on charts', 'Only fundamental analysis', 'Only indicators', 'Automated bots'], answer: 0 },
  { concept: 'order-flow',         q: 'Order flow refers to:',                                          choices: ['The stream of buy and sell orders in the market', 'A type of chart pattern', 'A specific indicator', 'A risk management tool'], answer: 0 },
  { concept: 'imbalance',          q: 'An imbalance in price occurs when:',                             choices: ['One side (buyers/sellers) overwhelms the other', 'Price moves sideways', 'Volume is equal', 'Spreads are tight'], answer: 0 },
  { concept: 'liquidity-void',     q: 'A liquidity void is:',                                           choices: ['An area where price moved rapidly with no opposing orders', 'A support level', 'A resistance level', 'A trend line'], answer: 0 },
  { concept: 'discipline',         q: 'Trading discipline means:',                                      choices: ['Following your plan regardless of emotions', 'Taking every trade you see', 'Trading more when winning', 'Ignoring stop losses'], answer: 0 },
  { concept: 'mindset',            q: 'The growth mindset in trading involves:',                        choices: ['Viewing losses as learning opportunities', 'Never losing money', 'Trading without a plan', 'Only taking sure-win trades'], answer: 0 },
  { concept: 'doji',               q: 'A doji candle represents:',                                      choices: ['Indecision between buyers and sellers', 'Strong bullish momentum', 'A guaranteed reversal', 'Low volume'], answer: 0 },
  { concept: 'swing-points',       q: 'Swing highs and swing lows help identify:',                     choices: ['Market structure and trend direction', 'The exact entry price', 'News events', 'Lot sizes'], answer: 0 },
  { concept: 'top-down-analysis',  q: 'What is the primary purpose of top-down analysis?',             choices: ['To establish the overall market bias/direction from higher time frames', 'To find the exact entry down to the millisecond', 'To calculate the spread and commissions', 'To check the economic news calendar'], answer: 0 },
  { concept: 'HTF-bias',           q: 'If the Higher Time Frame (HTF) bias is bullish, you should:',    choices: ['Look strictly for buy setups on lower time frames', 'Look strictly for sell setups on lower time frames', 'Trade counter-trend on micro charts', 'Avoid trading completely'], answer: 0 },
  { concept: 'killzones',          q: 'ICT Killzones refer to:',                                       choices: ['Specific time windows of high institutional activity and volatility', 'Areas where your account is at risk of margin call', 'Support and resistance lines on the chart', 'Price levels where volume is zero'], answer: 0 },
  { concept: 'london-killzone',    q: 'When does the London Killzone occur in New York Time?',         choices: ['2:00 AM – 5:00 AM', '8:00 PM – 12:00 AM', '7:00 AM – 10:00 AM', '12:00 PM – 2:00 PM'], answer: 0 },
  { concept: 'new-york-killzone',   q: 'The New York Killzone is generally active during:',             choices: ['7:00 AM – 10:00 AM NY Time', '2:00 AM – 5:00 AM NY Time', '8:00 PM – 12:00 AM NY Time', '10:00 AM – 12:00 PM NY Time'], answer: 0 },
  { concept: 'inducement',         q: 'In SMC, an inducement (IDM) is defined as:',                    choices: ['A deliberate market trap to lure retail traders and build liquidity', 'An bonus payment from your broker', 'A candlestick patterns that is always green', 'A type of trailing stop loss'], answer: 0 },
  { concept: 'liquidity-sweeps',   q: 'A liquidity sweep occurs when price:',                          choices: ['Clears stop-losses above/below swing points before reversing', 'Moves sideways in low volume consolidation', 'Stays exactly at a key Fibonacci level', 'Breaks out with no retracement'], answer: 0 },
];

/** Open-ended question templates */
const OPEN_ENDED_TEMPLATES = [
  'In your own words, explain what "{concept}" means and how you would identify it on a chart.',
  'Describe a scenario where "{concept}" would help you make a better trading decision.',
  'How does "{concept}" connect to the other concepts you have learned so far?',
];

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

export function getLessons() { return storage.get(STORAGE_LESSONS, []); }

export function saveLessonEntry(lessonData) {
  const lessons = getLessons();
  const entry = { id: generateId(), ...lessonData, notes: sanitizeText(lessonData.notes || '', 2000), createdAt: new Date().toISOString() };
  lessons.push(entry);
  storage.set(STORAGE_LESSONS, lessons);
  return entry;
}

export function getAssignments() { return storage.get(STORAGE_ASSIGNMENTS, []); }

export function saveAssignment(assignment) {
  const assignments = getAssignments();
  const entry = { id: generateId(), ...assignment, completed: false, createdAt: new Date().toISOString() };
  assignments.push(entry);
  storage.set(STORAGE_ASSIGNMENTS, assignments);
  return entry;
}

export function getConceptLibrary() {
  const lessons = getLessons();
  const conceptSet = new Set();
  lessons.forEach((l) => { if (Array.isArray(l.concepts)) l.concepts.forEach((c) => conceptSet.add(c)); });
  BRAH_GOH_CURRICULUM.filter(ep => !ep.locked).forEach((ep) => { ep.concepts.forEach((c) => conceptSet.add(c)); });
  return [...conceptSet];
}

export function generateCumulativeAssignment(episodeNum, asset, timeframe) {
  const steps = [];

  // Add Top Down if selected >= 11
  if (episodeNum >= 11) {
    steps.push({
      title: 'Top Down Analysis [Ep 11]',
      text: `Analyze the market structure on a Higher Time Frame (e.g., H4) to establish a clear directional bias, then zoom into the ${timeframe} chart to execute.`
    });
  }

  // Always include Market Structure if >= 5
  if (episodeNum >= 5) {
    steps.push({
      title: 'Market Structure [Ep 5]',
      text: `Identify the trend on the ${asset} ${timeframe} chart. Mark the most recent Break of Structure (BOS) or Change of Character (CHOCH), and label swing highs/lows.`
    });
  }

  // Include Supply & Demand if >= 7
  if (episodeNum >= 7) {
    steps.push({
      title: 'Supply & Demand [Ep 7]',
      text: `Locate and mark the institutional Supply or Demand zone (Order Block) responsible for the structural breakout.`
    });
  }

  // Include Premium/Discount if >= 8
  if (episodeNum >= 8) {
    steps.push({
      title: 'Premium / Discount & Fibonacci [Ep 8]',
      text: `Draw a Fibonacci retracement from the swing low to swing high (or vice-versa). Ensure the price is in Discount (for buys) or Premium (for sells) inside the OTE (0.618 - 0.786) region.`
    });
  }

  // Include Fair Value Gaps if >= 9
  if (episodeNum >= 9) {
    steps.push({
      title: 'Fair Value Gaps [Ep 9]',
      text: `Spot any unmitigated Fair Value Gaps (FVG) or imbalances overlapping with your zone of interest.`
    });
  }

  // Include Liquidity & Inducement if >= 13
  if (episodeNum >= 13) {
    steps.push({
      title: 'Liquidity & Inducements [Ep 13]',
      text: `Identify the Inducement (IDM) level / retail trap. Wait for price to sweep the liquidity of that swing high/low before entry.`
    });
  }

  // Include ICT Killzones if >= 12
  if (episodeNum >= 12) {
    steps.push({
      title: 'ICT Killzones [Ep 12]',
      text: `Verify that your trade execution falls strictly within a valid ICT Killzone (London: 2-5 AM, NY: 7-10 AM, or Asian: 8-12 PM New York time).`
    });
  }

  // Always include Candlestick trigger if >= 6
  if (episodeNum >= 6) {
    steps.push({
      title: 'Candlestick Confirmation [Ep 6]',
      text: `Wait for a candlestick rejection confirmation (e.g. bullish/bearish engulfing, pin bar, or strong wick rejection) inside the zone before entry.`
    });
  }

  // Handle any custom dynamic lessons (> 13)
  const overrides = storage.get('bg_unlocked_lessons', {});
  const unlockedList = Object.values(overrides).filter(x => x.episode <= episodeNum);
  unlockedList.forEach(ul => {
    if (ul.episode > 13) {
      if (Array.isArray(ul.concepts)) {
        ul.concepts.forEach(concept => {
          const exists = steps.some(s => s.title.toLowerCase().includes(concept.toLowerCase()));
          if (!exists) {
            steps.push({
              title: `Custom Confluence (${concept}) [Ep ${ul.episode}]`,
              text: `Locate and verify the ${concept} concept setup on the chart for ${asset}.`
            });
          }
        });
      }
    }
  });

  const text = `Cumulative Trade Setup [Level ${episodeNum}]: Perform a full multi-confluence analysis on ${asset} (${timeframe} chart) integrating all steps from Episode 5 up to Episode ${episodeNum}.`;
  
  return {
    text,
    episodeNum,
    asset,
    timeframe,
    steps
  };
}

export function generateAssignment(conceptLibrary) {
  // Fallback compatibility wrapper
  const asset = RANDOM_ASSETS[Math.floor(Math.random() * RANDOM_ASSETS.length)];
  const timeframe = RANDOM_TIMEFRAMES[Math.floor(Math.random() * RANDOM_TIMEFRAMES.length)];
  return generateCumulativeAssignment(9, asset, timeframe);
}

function openPracticeLevelSelector(onRefresh) {
  const { body, close } = createModal('🎲 Practice Level Selector');

  body.appendChild(el('p', 'unlock-hint', 'Choose your practice level. Level 5 covers Market Structure. Each higher level adds confluences cumulatively (e.g., Level 9 adds FVGs on top of S/D, Fib, and Structure).'));

  const form = el('form', 'modal-form');
  form.setAttribute('novalidate', '');

  // Level selection group
  const lvlGroup = el('div', 'form-group');
  lvlGroup.appendChild(el('label', 'form-label', 'Confluence Level'));
  
  const lvlSelect = document.createElement('select');
  lvlSelect.className = 'form-select';
  lvlSelect.name = 'level';
  
  // Find which levels are unlocked
  const overrides = storage.get('bg_unlocked_lessons', {});
  const effectiveCurriculum = BRAH_GOH_CURRICULUM.map(ep => {
    if (overrides[ep.id]) return { ...ep, ...overrides[ep.id], locked: false };
    return ep;
  });

  // Filter episodes >= 5 that are not locked
  const activeLevels = effectiveCurriculum.filter(ep => ep.episode >= 5 && !ep.locked);

  if (activeLevels.length === 0) {
    const opt = el('option', '', 'No levels unlocked yet (need Ep 5+)');
    opt.value = '';
    lvlSelect.appendChild(opt);
  } else {
    activeLevels.forEach(ep => {
      const opt = el('option', '', `Level ${ep.episode}: ${ep.title}`);
      opt.value = String(ep.episode);
      lvlSelect.appendChild(opt);
    });
  }
  lvlGroup.appendChild(lvlSelect);
  form.appendChild(lvlGroup);

  // Asset selection
  const assetGroup = el('div', 'form-group');
  assetGroup.appendChild(el('label', 'form-label', 'Asset Pair (Optional)'));
  const assetSelect = document.createElement('select');
  assetSelect.className = 'form-select';
  assetSelect.name = 'asset';
  const defAssetOpt = el('option', '', '— Random Asset —');
  defAssetOpt.value = '';
  assetSelect.appendChild(defAssetOpt);
  
  RANDOM_ASSETS.forEach(asset => {
    const opt = el('option', '', asset);
    opt.value = asset;
    assetSelect.appendChild(opt);
  });
  assetGroup.appendChild(assetSelect);
  form.appendChild(assetGroup);

  // Timeframe selection
  const tfGroup = el('div', 'form-group');
  tfGroup.appendChild(el('label', 'form-label', 'Timeframe (Optional)'));
  const tfSelect = document.createElement('select');
  tfSelect.className = 'form-select';
  tfSelect.name = 'timeframe';
  const defTfOpt = el('option', '', '— Random Timeframe —');
  defTfOpt.value = '';
  tfSelect.appendChild(defTfOpt);
  
  RANDOM_TIMEFRAMES.forEach(tf => {
    const opt = el('option', '', tf);
    opt.value = tf;
    tfSelect.appendChild(opt);
  });
  tfGroup.appendChild(tfSelect);
  form.appendChild(tfGroup);

  // Submit button
  const submitBtn = el('button', 'btn btn-primary btn-lg', 'Generate Setup ⚡');
  submitBtn.type = 'submit';
  if (activeLevels.length === 0) submitBtn.disabled = true;
  form.appendChild(submitBtn);

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const lvlVal = lvlSelect.value;
    if (!lvlVal) return;

    const level = Number(lvlVal);
    const asset = assetSelect.value || RANDOM_ASSETS[Math.floor(Math.random() * RANDOM_ASSETS.length)];
    const timeframe = tfSelect.value || RANDOM_TIMEFRAMES[Math.floor(Math.random() * RANDOM_TIMEFRAMES.length)];

    const assignment = generateCumulativeAssignment(level, asset, timeframe);
    close();
    openExercisePopup(assignment, onRefresh);
  });

  body.appendChild(form);
}

/** Resize and compress image file to target width/height and return base64 jpeg */
function compressImage(file, maxSize = 1000) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxSize) {
            height = Math.round((height * maxSize) / width);
            width = maxSize;
          }
        } else {
          if (height > maxSize) {
            width = Math.round((width * maxSize) / height);
            height = maxSize;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
        resolve(dataUrl);
      };
      img.onerror = () => reject(new Error('Image load error'));
      img.src = e.target.result;
    };
    reader.onerror = () => reject(new Error('File read error'));
    reader.readAsDataURL(file);
  });
}

/** Open full-size notes photo modal with download option */
function openNotesImageModal(title, imageSrc) {
  const { body } = createModal(title);
  
  const img = document.createElement('img');
  img.src = imageSrc;
  img.style.width = '100%';
  img.style.maxHeight = '70vh';
  img.style.objectFit = 'contain';
  img.style.borderRadius = 'var(--radius-md)';
  img.style.border = '1px solid rgba(255, 255, 255, 0.1)';
  
  const container = el('div');
  container.style.display = 'flex';
  container.style.flexDirection = 'column';
  container.style.gap = 'var(--space-3)';
  container.appendChild(img);
  
  const dlLink = el('a', 'btn btn-secondary', '📥 Download Notes');
  dlLink.href = imageSrc;
  dlLink.download = `${title.toLowerCase().replace(/[^a-z0-9]/g, '_')}.jpg`;
  dlLink.style.width = '100%';
  dlLink.style.justifyContent = 'center';
  dlLink.style.display = 'inline-flex';
  dlLink.style.alignItems = 'center';
  container.appendChild(dlLink);
  
  body.appendChild(container);
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

/** Create and show a modal overlay. Returns { overlay, modal, close } */
function createModal(title) {
  const overlay = el('div', 'modal-overlay');
  const modal = el('div', 'modal');

  // Top bar with colored stripe
  const topBar = el('div', 'modal__topbar');
  modal.appendChild(topBar);

  const header = el('div', 'modal__header');
  header.appendChild(el('h2', 'modal__title', title));
  const closeBtn = el('button', 'modal__close', '✕');
  header.appendChild(closeBtn);
  modal.appendChild(header);

  const body = el('div', 'modal__body');
  modal.appendChild(body);

  overlay.appendChild(modal);

  function close() {
    overlay.style.opacity = '0';
    setTimeout(() => overlay.remove(), 250);
  }

  closeBtn.addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

  document.body.appendChild(overlay);
  return { overlay, modal, body, close };
}

/* ================================================================== */
/*  RENDER FUNCTIONS                                                  */
/* ================================================================== */

/* ---------- Mentor Cards + Profile Popup -------------------------- */

function openMentorProfile(mentor, onViewCurriculum) {
  const { body } = createModal(`${mentor.emoji} ${mentor.name}`);

  const profile = el('div', 'mentor-profile');

  // Avatar — check for custom uploaded photo first, then default, then emoji
  const avatarKey = mentor.key || '';
  const customAvatar = avatarKey ? storage.get(`mentor_avatar_${avatarKey}`, null) : null;
  const avatarSrc = customAvatar || mentor.avatar || null;

  const avatarWrap = el('div', 'mentor-profile__avatar');
  avatarWrap.classList.add('mentor-profile__avatar--clickable');

  if (avatarSrc) {
    const img = document.createElement('img');
    img.src = avatarSrc;
    img.alt = mentor.name;
    img.className = 'mentor-profile__img';
    avatarWrap.appendChild(img);
  } else {
    avatarWrap.appendChild(el('span', 'mentor-profile__emoji', mentor.emoji));
  }

  // Camera overlay hint
  const camHint = el('div', 'mentor-profile__cam-hint');
  camHint.appendChild(el('span', '', '📷'));
  avatarWrap.appendChild(camHint);

  // Hidden file input
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = 'image/*';
  fileInput.style.display = 'none';
  fileInput.addEventListener('change', () => {
    const file = fileInput.files[0];
    if (!file || !file.type.startsWith('image/')) return;

    // Resize any image to 200x200 via canvas to keep localStorage small
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const SIZE = 200;
      canvas.width = SIZE;
      canvas.height = SIZE;
      const ctx = canvas.getContext('2d');

      // Crop to center square
      const minDim = Math.min(img.width, img.height);
      const sx = (img.width - minDim) / 2;
      const sy = (img.height - minDim) / 2;
      ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, SIZE, SIZE);

      const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
      const saved = storage.set(`mentor_avatar_${avatarKey}`, dataUrl);

      if (!saved) {
        const warn = el('p', 'mentor-profile__upload-warn', '⚠️ Could not save — storage may be full.');
        profile.insertBefore(warn, profile.children[1]);
        setTimeout(() => warn.remove(), 3000);
        return;
      }

      // Update displayed image immediately
      const existingImg = avatarWrap.querySelector('.mentor-profile__img');
      if (existingImg) {
        existingImg.src = dataUrl;
      } else {
        avatarWrap.replaceChildren();
        const newImg = document.createElement('img');
        newImg.src = dataUrl;
        newImg.alt = mentor.name;
        newImg.className = 'mentor-profile__img';
        avatarWrap.appendChild(newImg);
        avatarWrap.appendChild(camHint);
      }
    };
    img.src = URL.createObjectURL(file);
  });
  avatarWrap.appendChild(fileInput);

  avatarWrap.addEventListener('click', () => fileInput.click());
  profile.appendChild(avatarWrap);

  // Name + role
  profile.appendChild(el('h2', 'mentor-profile__name', mentor.name));
  profile.appendChild(el('p', 'mentor-profile__role', mentor.role));

  // Bio
  const bio = el('p', 'mentor-profile__bio');
  bio.textContent = mentor.bio;
  profile.appendChild(bio);

  // Stats
  if (mentor.stats) {
    const statsRow = el('div', 'mentor-profile__stats');
    mentor.stats.forEach(({ label, value, icon }) => {
      const stat = el('div', 'mentor-profile__stat');
      stat.appendChild(el('span', 'mentor-profile__stat-icon', icon));
      stat.appendChild(el('span', 'mentor-profile__stat-value', value));
      stat.appendChild(el('span', 'mentor-profile__stat-label', label));
      statsRow.appendChild(stat);
    });
    profile.appendChild(statsRow);
  }

  // Teaching style / focus areas
  if (mentor.focusAreas) {
    const tagSection = el('div', 'mentor-profile__focus');
    tagSection.appendChild(el('h4', 'mentor-profile__section-title', 'Focus Areas'));
    const tags = el('div', 'concept-tags');
    mentor.focusAreas.forEach(a => tags.appendChild(el('span', 'tag', a)));
    tagSection.appendChild(tags);
    profile.appendChild(tagSection);
  }

  // Channel links
  if (mentor.channels && mentor.channels.length > 0) {
    const chSection = el('div', 'mentor-profile__focus');
    chSection.appendChild(el('h4', 'mentor-profile__section-title', 'YouTube Channels'));
    const chGrid = el('div', '');
    chGrid.style.display = 'flex';
    chGrid.style.flexDirection = 'column';
    chGrid.style.gap = 'var(--space-2)';
    mentor.channels.forEach(ch => {
      const link = el('a', 'btn btn-ghost');
      link.textContent = `📺 ${ch.label}`;
      link.href = ch.url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.style.justifyContent = 'flex-start';
      link.style.textAlign = 'left';
      link.style.fontSize = 'var(--text-sm)';
      chGrid.appendChild(link);
    });
    chSection.appendChild(chGrid);
    profile.appendChild(chSection);
  }

  // Link (course playlist)
  if (mentor.link) {
    const linkBtn = el('a', 'btn btn-secondary btn-lg mentor-profile__link');
    linkBtn.textContent = `📺 ${mentor.linkLabel || 'Watch Playlist'}`;
    linkBtn.href = mentor.link;
    linkBtn.target = '_blank';
    linkBtn.rel = 'noopener noreferrer';
    profile.appendChild(linkBtn);
  }

  // Action to scroll to curriculum
  if (mentor.hasCurriculum) {
    const scrollBtn = el('button', 'btn btn-outline btn-lg', '📚 View Curriculum');
    scrollBtn.style.marginTop = 'var(--space-3)';
    scrollBtn.style.width = '100%';
    scrollBtn.addEventListener('click', () => {
      body.closest('.modal-overlay').style.opacity = '0';
      setTimeout(() => body.closest('.modal-overlay').remove(), 250);
      
      if (typeof onViewCurriculum === 'function') {
        onViewCurriculum();
      }

      setTimeout(() => {
        const selector = mentor.key === 'bossAckah' ? '.ba-curriculum-section' : '.curriculum-section:not(.ba-curriculum-section)';
        const timeline = document.querySelector(selector);
        if (timeline) timeline.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 300);
    });
    profile.appendChild(scrollBtn);
  }

  body.appendChild(profile);
}

const MENTOR_DATA = {
  brahGoh: {
    emoji: '🧠',
    name: 'Brad Goh',
    role: 'ICT / SMC Trading Educator',
    avatar: 'img/brad-goh.png',
    bio: 'Brad Goh is a trading educator running three YouTube channels — @bradgtrades for trade breakdowns and live analysis, @bradgohofficial for personal branding and lifestyle content, and @thetradinggeek for in-depth trading education. His flagship 33-lesson course teaches ICT (Inner Circle Trader) and Smart Money Concepts from the ground up, covering market structure, price action, supply & demand zones, fair value gaps, Fibonacci entries, candlestick patterns, and the psychology behind consistent trading. Known for breaking down complex institutional concepts into practical, step-by-step lessons.',
    focusAreas: ['Market Structure', 'Price Action', 'Supply & Demand', 'Fair Value Gaps', 'Fibonacci / OTE', 'Candlestick Patterns', 'Trading Psychology', 'Order Flow', 'ICT Concepts', 'Smart Money'],
    link: 'https://youtube.com/playlist?list=PLBYSdC_HMWMrXE0cmstpBbcIN5pLgebEm',
    linkLabel: 'Course Playlist',
    hasCurriculum: true,
    channels: [
      { handle: '@bradgtrades', url: 'https://youtube.com/@bradgtrades', label: 'BradG Trades' },
      { handle: '@bradgohofficial', url: 'https://youtube.com/@bradgohofficial', label: 'Brad Goh Official' },
      { handle: '@thetradinggeek', url: 'https://youtube.com/@thetradinggeek', label: 'The Trading Geek' },
    ],
  },
  bossAckah: {
    emoji: '👑',
    name: 'Boss Ackah',
    role: 'Personal Mentor — Professional Skills',
    avatar: 'img/boss-ackah.png',
    bio: '"This is not a gimmick stuff. This is a professional skills acquisition course. It\'s not about the money — the money is embedded in the knowledge and experience. It\'s a very powerful skill to gain but requires a lot of commitment and focus. We will first focus on the mindset. That\'s the most important aspect of this venture because this money printing business — knowing that money clouds the mind if not well managed." — Boss Ackah',
    focusAreas: ['Trading Psychology', 'Mindset', 'Risk Management', 'Professional Skills', 'Discipline', 'Emotional Control'],
    link: null,
    linkLabel: null,
    hasCurriculum: true,
    channels: [],
  },
};

/** Boss Ackah curriculum — grows as lessons are assigned. */
export const BOSS_ACKAH_CURRICULUM = [
  {
    id: 'ba-1',
    lesson: 1,
    title: 'Trading for a Living — Psychology Audio',
    type: 'audio',
    concepts: ['trading-psychology', 'mindset', 'emotional-control', 'discipline', 'focus'],
    description: 'Listen to this audio as if your whole life depends on it. Take notes of the important points that make sense to you. Share your notes after this assignment.',
    resource: 'https://youtu.be/ocHNbkQohMQ?si=iz8rWMTz-dDjwrFn',
    resourceLabel: 'Trading for a Living — Psychology',
    instructions: 'Watch/listen → Take notes → Share notes with Boss Ackah',
  },
];

const STORAGE_BA_LESSONS = 'ba_lessons';
const STORAGE_BA_PROGRESS = 'ba_progress';

function getBaLessons() { return storage.get(STORAGE_BA_LESSONS, []); }
function getBaProgress(lessonId) { return storage.get(`${STORAGE_BA_PROGRESS}_${lessonId}`, { percent: 0, notes: '' }); }
function saveBaProgress(lessonId, data) { storage.set(`${STORAGE_BA_PROGRESS}_${lessonId}`, data); }


/** Which mentor tab is active. Persists across re-renders in the page session. */
let _activeMentor = 'bradGoh';

function renderMentorCards(container, onLessonLogged, curriculumContainer, baCurriculumContainer) {
  container.replaceChildren();
  const grid = el('div', 'mentor-grid');

  // ── Brad Goh card ──
  const completedCount = getLessons().length;
  const totalLessons = BRAH_GOH_CURRICULUM.length;

  const gohCard = el('div', `mentor-card mentor-active${_activeMentor === 'bradGoh' ? ' mentor-selected' : ''}`);
  gohCard.style.cursor = 'pointer';
  gohCard.appendChild(el('span', 'mentor-emoji', '🧠'));
  gohCard.appendChild(el('h3', 'mentor-name', 'Brad Goh'));
  gohCard.appendChild(el('p', 'mentor-status', `${completedCount} of ${totalLessons} lessons logged`));

  const progressWrap = el('div', 'mentor-progress');
  const progressBar = el('div', 'mentor-progress__bar');
  progressBar.style.width = `${(completedCount / totalLessons) * 100}%`;
  progressWrap.appendChild(progressBar);
  gohCard.appendChild(progressWrap);

  gohCard.appendChild(el('p', 'mentor-desc', 'Tap to view curriculum & profile'));

  // Profile on long-press / right-click alternative: small profile icon
  const gohProfileBtn = el('button', 'mentor-profile-btn', 'ℹ️');
  gohProfileBtn.setAttribute('aria-label', 'View profile');
  gohProfileBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const gohData = { ...MENTOR_DATA.brahGoh, key: 'brahGoh' };
    gohData.stats = [
      { icon: '📚', label: 'Lessons', value: `${completedCount}/${totalLessons}` },
      { icon: '📝', label: 'Assignments', value: String(getAssignments().length) },
      { icon: '🧩', label: 'Concepts', value: String(getConceptLibrary().length) },
    ];
    openMentorProfile(gohData, () => {
      _activeMentor = 'bradGoh';
      switchCurriculumTab(curriculumContainer, baCurriculumContainer, 'bradGoh');
      grid.querySelectorAll('.mentor-card').forEach(c => c.classList.remove('mentor-selected'));
      gohCard.classList.add('mentor-selected');
    });
  });
  gohCard.appendChild(gohProfileBtn);

  // Click to switch tab
  gohCard.addEventListener('click', () => {
    _activeMentor = 'bradGoh';
    switchCurriculumTab(curriculumContainer, baCurriculumContainer, 'bradGoh');
    // Update selected state
    grid.querySelectorAll('.mentor-card').forEach(c => c.classList.remove('mentor-selected'));
    gohCard.classList.add('mentor-selected');
  });
  grid.appendChild(gohCard);

  // ── Boss Ackah card ──
  const baLessons = getBaLessons();
  const baTotalLessons = BOSS_ACKAH_CURRICULUM.length;
  const baCompletedCount = baLessons.length;

  const ackahCard = el('div', `mentor-card mentor-active${_activeMentor === 'bossAckah' ? ' mentor-selected' : ''}`);
  ackahCard.style.cursor = 'pointer';
  ackahCard.appendChild(el('span', 'mentor-emoji', '👑'));
  ackahCard.appendChild(el('h3', 'mentor-name', 'Boss Ackah'));
  ackahCard.appendChild(el('p', 'mentor-status', `${baCompletedCount} of ${baTotalLessons} lesson${baTotalLessons !== 1 ? 's' : ''} logged`));

  const baProgressWrap = el('div', 'mentor-progress');
  const baProgressBar = el('div', 'mentor-progress__bar');
  baProgressBar.style.width = `${baTotalLessons > 0 ? (baCompletedCount / baTotalLessons) * 100 : 0}%`;
  baProgressBar.style.background = 'linear-gradient(90deg, #8e0e00, #b91c1c)';
  baProgressWrap.appendChild(baProgressBar);
  ackahCard.appendChild(baProgressWrap);

  ackahCard.appendChild(el('p', 'mentor-desc', 'Tap to view curriculum & profile'));

  const ackahProfileBtn = el('button', 'mentor-profile-btn', 'ℹ️');
  ackahProfileBtn.setAttribute('aria-label', 'View profile');
  ackahProfileBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const ackahData = { ...MENTOR_DATA.bossAckah, key: 'bossAckah' };
    ackahData.stats = [
      { icon: '📚', label: 'Lessons', value: `${baCompletedCount}/${baTotalLessons}` },
      { icon: '🧠', label: 'Focus', value: 'Psychology' },
    ];
    openMentorProfile(ackahData, () => {
      _activeMentor = 'bossAckah';
      switchCurriculumTab(curriculumContainer, baCurriculumContainer, 'bossAckah');
      grid.querySelectorAll('.mentor-card').forEach(c => c.classList.remove('mentor-selected'));
      ackahCard.classList.add('mentor-selected');
    });
  });
  ackahCard.appendChild(ackahProfileBtn);

  ackahCard.addEventListener('click', () => {
    _activeMentor = 'bossAckah';
    switchCurriculumTab(curriculumContainer, baCurriculumContainer, 'bossAckah');
    grid.querySelectorAll('.mentor-card').forEach(c => c.classList.remove('mentor-selected'));
    ackahCard.classList.add('mentor-selected');
  });
  grid.appendChild(ackahCard);

  container.appendChild(grid);

  // Set initial visibility
  switchCurriculumTab(curriculumContainer, baCurriculumContainer, _activeMentor);
}

/** Show/hide curriculum sections based on which mentor tab is active */
function switchCurriculumTab(gohContainer, baContainer, active) {
  if (gohContainer) gohContainer.style.display = active === 'bradGoh' ? 'block' : 'none';
  if (baContainer) baContainer.style.display = active === 'bossAckah' ? 'block' : 'none';
}

/* ---------- Curriculum Timeline ----------------------------------- */

function renderCurriculumLog(container) {
  container.replaceChildren();
  const lessons = getLessons();
  const wrapper = el('div', 'curriculum-section');
  wrapper.appendChild(el('h2', 'section-title', '🧠 Brad Goh Curriculum — 33 Lessons'));

  const timeline = el('div', 'curriculum-timeline');
  const loggedEpisodes = new Set(lessons.map((l) => l.episodeId));
  const STORAGE_UNLOCKED = 'bg_unlocked_lessons';

  /** Get user-unlocked lesson overrides from localStorage */
  function getUnlockedOverrides() {
    return storage.get(STORAGE_UNLOCKED, {});
  }

  /** Merge curriculum with user unlocks */
  function getEffectiveCurriculum() {
    const overrides = getUnlockedOverrides();
    return BRAH_GOH_CURRICULUM.map(ep => {
      if (overrides[ep.id]) {
        return { ...ep, ...overrides[ep.id], locked: false };
      }
      return ep;
    });
  }

  const effectiveCurriculum = getEffectiveCurriculum();

  effectiveCurriculum.forEach((ep) => {
    const isLogged = loggedEpisodes.has(ep.id);
    const isLocked = ep.locked;

    const item = el('div', `timeline-item${isLogged ? ' completed' : ''}${isLocked ? ' locked' : ''}`);

    const marker = el('div', 'timeline-marker');
    marker.textContent = isLogged ? '✅' : isLocked ? '🔒' : '⬜';
    item.appendChild(marker);

    const content = el('div', 'timeline-content');
    content.appendChild(el('h4', 'timeline-ep-title', `Ep ${ep.episode}: ${ep.title}`));

    if (!isLocked && ep.description) {
      content.appendChild(el('p', 'timeline-desc', ep.description));

      if (ep.concepts.length) {
        const tagBar = el('div', 'concept-tags');
        ep.concepts.forEach((c) => tagBar.appendChild(el('span', 'tag', c)));
        content.appendChild(tagBar);
      }
    } else if (isLocked) {
      const lockRow = el('div', 'timeline-lock-row');
      lockRow.appendChild(el('p', 'timeline-desc timeline-locked-text', 'Not released yet'));

      const unlockBtn = el('button', 'btn btn-sm btn-unlock', '🔓 Unlock');
      unlockBtn.addEventListener('click', () => openUnlockPopup(ep, container));
      lockRow.appendChild(unlockBtn);
      content.appendChild(lockRow);
    }

    // Show logged notes if any
    const lessonEntry = lessons.find(l => l.episodeId === ep.id);
    if (lessonEntry) {
      const noteCard = el('div', 'timeline-note');
      noteCard.appendChild(el('span', 'timeline-note-label', '📝 Your notes:'));
      noteCard.appendChild(el('p', 'timeline-note-text', lessonEntry.notes || 'No notes'));
      
      if (lessonEntry.notesImage) {
        const thumbDiv = el('div', 'timeline-note-image-thumb');
        thumbDiv.style.marginTop = 'var(--space-2)';
        thumbDiv.style.cursor = 'pointer';
        
        const img = document.createElement('img');
        img.src = lessonEntry.notesImage;
        img.style.maxWidth = '120px';
        img.style.maxHeight = '80px';
        img.style.borderRadius = 'var(--radius-sm)';
        img.style.border = '1px solid rgba(255, 255, 255, 0.1)';
        img.style.transition = 'transform 0.2s';
        
        img.addEventListener('mouseenter', () => img.style.transform = 'scale(1.05)');
        img.addEventListener('mouseleave', () => img.style.transform = 'scale(1)');
        
        img.addEventListener('click', (e) => {
          e.stopPropagation();
          openNotesImageModal(`Notes — Ep ${ep.episode}: ${ep.title}`, lessonEntry.notesImage);
        });
        
        thumbDiv.appendChild(img);
        noteCard.appendChild(thumbDiv);
      }
      
      noteCard.appendChild(el('span', 'timeline-note-date', formatDate(lessonEntry.createdAt)));
      content.appendChild(noteCard);
    }

    item.appendChild(content);
    timeline.appendChild(item);
  });

  wrapper.appendChild(timeline);
  container.appendChild(wrapper);
}

/** Map of keywords → concept tags for auto-detection from video titles */
const CONCEPT_KEYWORDS = {
  'market structure':  'market-structure',
  'bos':              'BOS',
  'choch':            'CHOCH',
  'break of structure': 'BOS',
  'change of character': 'CHOCH',
  'price action':     'price-action',
  'order flow':       'order-flow',
  'order block':      'order-block',
  'fair value gap':   'fair-value-gap',
  'fvg':              'fair-value-gap',
  'imbalance':        'imbalance',
  'supply':           'supply-demand',
  'demand':           'supply-demand',
  'fibonacci':        'fibonacci',
  'fib':              'fibonacci',
  'ote':              'OTE',
  'optimal trade entry': 'OTE',
  'premium':          'premium-discount',
  'discount':         'premium-discount',
  'candlestick':      'candlestick-patterns',
  'candle':           'candlestick-patterns',
  'engulfing':        'engulfing',
  'pin bar':          'pin-bar',
  'doji':             'doji',
  'wick':             'wicks',
  'psychology':       'psychology',
  'mindset':          'mindset',
  'discipline':       'discipline',
  'risk':             'risk-management',
  'money management': 'money-management',
  'forex':            'forex-basics',
  'leverage':         'leverage',
  'pip':              'pips',
  'lot':              'lots',
  'liquidity':        'liquidity',
  'sweep':            'liquidity-sweep',
  'inducement':       'inducement',
  'entry':            'entry-timing',
  'stop loss':        'stop-loss',
  'take profit':      'take-profit',
  'session':          'session-timing',
  'london':           'session-timing',
  'new york':         'session-timing',
  'asia':             'session-timing',
  'backtest':         'backtesting',
  'journal':          'trade-journaling',
  'trend':            'trend-identification',
  'swing':            'swing-points',
  'accumulation':     'accumulation',
  'distribution':     'distribution',
  'smart money':      'smart-money',
  'ict':              'ICT-concepts',
  'wyckoff':          'wyckoff',
  'chart pattern':    'chart-patterns',
  'head and shoulders': 'chart-patterns',
  'double top':       'chart-patterns',
  'double bottom':    'chart-patterns',
  'support':          'support-resistance',
  'resistance':       'support-resistance',
  'breakout':         'breakout',
  'reversal':         'reversal',
  'continuation':     'continuation',
  'momentum':         'momentum',
  'volume':           'volume',
  'gap':              'gaps',
  'range':            'range',
  'consolidation':    'consolidation',
  'news':             'fundamentals',
  'fundamental':      'fundamentals',
};

/** Extract concepts from a video title by keyword matching */
function detectConcepts(title) {
  const lower = title.toLowerCase();
  const found = new Set();
  for (const [keyword, concept] of Object.entries(CONCEPT_KEYWORDS)) {
    if (lower.includes(keyword)) {
      found.add(concept);
    }
  }
  return [...found];
}

/** Generate a short description from a video title */
function generateDescription(title, episode) {
  return `Episode ${episode} of the Brad Goh ICT/SMC trading course: ${title}.`;
}

/** Popup to unlock a locked Brad Goh lesson via YouTube link */
function openUnlockPopup(ep, curriculumContainer) {
  const { body, close } = createModal(`🔓 Unlock Ep ${ep.episode}`);

  const form = el('form', 'modal-form');
  form.setAttribute('novalidate', '');

  // Instruction
  body.appendChild(el('p', 'unlock-hint', 'Paste the YouTube video link and the lesson details will be generated automatically.'));

  // YouTube URL input
  const urlGroup = el('div', 'form-group');
  urlGroup.appendChild(el('label', 'form-label', 'YouTube Video Link'));
  const urlInput = document.createElement('input');
  urlInput.type = 'url';
  urlInput.className = 'form-input';
  urlInput.placeholder = 'https://youtu.be/... or https://youtube.com/watch?v=...';
  urlInput.required = true;
  urlGroup.appendChild(urlInput);

  // Status / preview area
  const preview = el('div', 'unlock-preview');
  preview.style.display = 'none';
  urlGroup.appendChild(preview);

  form.appendChild(urlGroup);

  // Fetch button
  const fetchBtn = el('button', 'btn btn-outline', '🔍 Fetch Video Info');
  fetchBtn.type = 'button';

  let fetchedTitle = '';
  let fetchedConcepts = [];

  fetchBtn.addEventListener('click', async () => {
    const url = urlInput.value.trim();
    if (!url) return;

    fetchBtn.textContent = '⏳ Fetching...';
    fetchBtn.disabled = true;

    try {
      const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
      const resp = await fetch(oembedUrl);
      if (!resp.ok) throw new Error('Could not fetch video info');
      const data = await resp.json();

      fetchedTitle = data.title || '';
      fetchedConcepts = detectConcepts(fetchedTitle);

      // Show preview
      preview.replaceChildren();
      preview.style.display = 'block';

      preview.appendChild(el('p', 'unlock-preview-label', '📺 VIDEO FOUND:'));
      preview.appendChild(el('p', 'unlock-preview-title', fetchedTitle));

      if (fetchedConcepts.length) {
        const tagRow = el('div', 'concept-tags');
        fetchedConcepts.forEach(c => tagRow.appendChild(el('span', 'tag', c)));
        preview.appendChild(el('p', 'unlock-preview-label', '🏷️ DETECTED CONCEPTS:'));
        preview.appendChild(tagRow);
      } else {
        preview.appendChild(el('p', 'unlock-preview-sub', 'No trading concepts auto-detected — you can add them manually after unlocking.'));
      }

      fetchBtn.textContent = '✅ Fetched!';
      submitBtn.disabled = false;
    } catch (err) {
      preview.replaceChildren();
      preview.style.display = 'block';
      preview.appendChild(el('p', 'unlock-preview-error', '⚠️ Could not fetch. Check the link and try again.'));
      fetchBtn.textContent = '🔍 Fetch Video Info';
      fetchBtn.disabled = false;
    }
  });
  form.appendChild(fetchBtn);

  // Submit button (disabled until fetch succeeds)
  const submitBtn = el('button', 'btn btn-primary', '🔓 Unlock Lesson');
  submitBtn.type = 'submit';
  submitBtn.disabled = true;
  form.appendChild(submitBtn);

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!fetchedTitle) return;

    const overrides = storage.get('bg_unlocked_lessons', {});
    overrides[ep.id] = {
      title: sanitizeText(fetchedTitle),
      description: generateDescription(fetchedTitle, ep.episode),
      concepts: fetchedConcepts,
      videoUrl: urlInput.value.trim(),
    };
    storage.set('bg_unlocked_lessons', overrides);
    close();
    renderCurriculumLog(curriculumContainer);
  });

  body.appendChild(form);
}

/* ---------- Log Lesson POPUP -------------------------------------- */

function openLogLessonPopup(onSaved) {
  const { body, close } = createModal('📖 Log a Lesson');

  const form = el('form', 'modal-form');
  form.setAttribute('novalidate', '');

  // Episode select — unlocked episodes (including user-unlocked)
  const overrides = storage.get('bg_unlocked_lessons', {});
  const effectiveCurriculum = BRAH_GOH_CURRICULUM.map(ep => {
    if (overrides[ep.id]) return { ...ep, ...overrides[ep.id], locked: false };
    return ep;
  });

  const epSelect = document.createElement('select');
  epSelect.name = 'episodeId';
  epSelect.required = true;
  epSelect.classList.add('form-select');
  const defOpt = el('option', '', '— Select Episode —');
  defOpt.value = '';
  epSelect.appendChild(defOpt);
  effectiveCurriculum.filter(ep => !ep.locked).forEach((ep) => {
    const opt = el('option', '', `Ep ${ep.episode}: ${ep.title}`);
    opt.value = ep.id;
    epSelect.appendChild(opt);
  });
  const epGroup = el('div', 'form-group');
  epGroup.appendChild(el('label', 'form-label', 'Episode'));
  epGroup.appendChild(epSelect);
  form.appendChild(epGroup);

  // Key takeaways
  const takeawayInput = document.createElement('textarea');
  takeawayInput.name = 'notes';
  takeawayInput.rows = 4;
  takeawayInput.placeholder = 'Key takeaways from this lesson…';
  takeawayInput.classList.add('form-textarea');
  const taGroup = el('div', 'form-group');
  taGroup.appendChild(el('label', 'form-label', 'Takeaways / Notes'));
  taGroup.appendChild(takeawayInput);
  form.appendChild(taGroup);

  // Rating
  const ratingSelect = document.createElement('select');
  ratingSelect.name = 'rating';
  ratingSelect.classList.add('form-select');
  for (let i = 1; i <= 5; i++) {
    const opt = el('option', '', '⭐'.repeat(i));
    opt.value = String(i);
    ratingSelect.appendChild(opt);
  }
  const rGroup = el('div', 'form-group');
  rGroup.appendChild(el('label', 'form-label', 'Understanding'));
  rGroup.appendChild(ratingSelect);
  form.appendChild(rGroup);

  // Notes Image Upload
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.name = 'notesImageFile';
  fileInput.accept = 'image/*';
  fileInput.className = 'form-input';
  
  const filePreview = el('div', 'notes-file-preview');
  filePreview.style.display = 'none';
  filePreview.style.marginTop = 'var(--space-2)';
  
  let notesImageBase64 = null;
  
  fileInput.addEventListener('change', () => {
    const file = fileInput.files[0];
    if (!file || !file.type.startsWith('image/')) {
      filePreview.style.display = 'none';
      notesImageBase64 = null;
      return;
    }
    
    filePreview.replaceChildren();
    filePreview.style.display = 'block';
    filePreview.appendChild(el('p', '', '⏳ Compressing photo of notes...'));
    
    compressImage(file, 1000).then(base64 => {
      notesImageBase64 = base64;
      filePreview.replaceChildren();
      const img = document.createElement('img');
      img.src = base64;
      img.style.maxWidth = '100%';
      img.style.maxHeight = '150px';
      img.style.borderRadius = 'var(--radius-md)';
      img.style.border = '1px solid rgba(255, 255, 255, 0.1)';
      filePreview.appendChild(img);
    }).catch(err => {
      filePreview.replaceChildren();
      filePreview.appendChild(el('p', 'pnl-negative', '⚠️ Error reading image file.'));
      notesImageBase64 = null;
    });
  });
  
  const fileGroup = el('div', 'form-group');
  fileGroup.appendChild(el('label', 'form-label', 'Upload Photo of Notes (Optional)'));
  fileGroup.appendChild(fileInput);
  fileGroup.appendChild(filePreview);
  form.appendChild(fileGroup);

  const submitBtn = el('button', 'btn btn-primary btn-lg', 'Save Lesson 📖');
  submitBtn.type = 'submit';
  form.appendChild(submitBtn);

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const episodeId = fd.get('episodeId');
    if (!episodeId) { epSelect.focus(); return; }

    const ep = BRAH_GOH_CURRICULUM.find((c) => c.id === episodeId);
    saveLessonEntry({
      episodeId,
      episodeTitle: ep ? ep.title : '',
      concepts: ep ? ep.concepts : [],
      notes: fd.get('notes') || '',
      rating: Number(fd.get('rating')) || 3,
      notesImage: notesImageBase64
    });
    addXP('lesson', 30);

    close();
    if (typeof onSaved === 'function') onSaved();
  });

  body.appendChild(form);
}

/* ---------- Quiz POPUP with MCQ + Open-ended + Submit/Grade ------- */

function openQuizPopup() {
  const concepts = getConceptLibrary();
  if (!concepts.length) {
    const { body } = createModal('🧩 Quiz');
    body.appendChild(el('p', 'modal-empty', 'Log some lessons first to generate quiz questions.'));
    return;
  }

  const { body } = createModal('🧩 Quick Quiz');

  // Pick 5 MCQ questions that match known concepts
  const matchingMCQ = QUIZ_BANK.filter(q => concepts.includes(q.concept));
  const shuffledMCQ = [...matchingMCQ].sort(() => Math.random() - 0.5).slice(0, 5);

  // Pick 3 open-ended
  const shuffledConcepts = [...concepts].sort(() => Math.random() - 0.5).slice(0, 3);
  const openEnded = shuffledConcepts.map(c => {
    const template = OPEN_ENDED_TEMPLATES[Math.floor(Math.random() * OPEN_ENDED_TEMPLATES.length)];
    return { concept: c, question: template.replace('{concept}', c) };
  });

  let mcqScore = 0;
  let mcqAnswered = 0;
  const mcqTotal = shuffledMCQ.length;
  const openTotal = openEnded.length;
  const totalQ = mcqTotal + openTotal;

  const quizContainer = el('div', 'quiz-container');

  // Live score bar
  const scoreBar = el('div', 'quiz-score-bar');
  scoreBar.appendChild(el('span', '', 'Progress: '));
  const scoreText = el('span', 'quiz-score-text', `0 / ${mcqTotal} MCQ answered`);
  scoreBar.appendChild(scoreText);
  quizContainer.appendChild(scoreBar);

  // MCQ Questions
  shuffledMCQ.forEach((q, idx) => {
    const card = el('div', 'quiz-card');
    card.appendChild(el('p', 'quiz-q', `${idx + 1}. ${q.q}`));
    card.appendChild(el('span', 'quiz-concept-tag tag', q.concept));

    const optionsWrap = el('div', 'quiz-options');
    const choiceIndices = [0, 1, 2, 3].sort(() => Math.random() - 0.5);

    choiceIndices.forEach(ci => {
      const optBtn = el('button', 'quiz-option', q.choices[ci]);
      optBtn.addEventListener('click', () => {
        if (card.classList.contains('quiz-answered')) return;
        card.classList.add('quiz-answered');
        mcqAnswered++;

        if (ci === q.answer) {
          optBtn.classList.add('quiz-option--correct');
          mcqScore++;
        } else {
          optBtn.classList.add('quiz-option--wrong');
          const allOpts = optionsWrap.querySelectorAll('.quiz-option');
          allOpts.forEach(btn => {
            if (btn.textContent === q.choices[q.answer]) btn.classList.add('quiz-option--correct');
          });
        }
        scoreText.textContent = `${mcqAnswered} / ${mcqTotal} MCQ answered`;
      });
      optionsWrap.appendChild(optBtn);
    });

    card.appendChild(optionsWrap);
    quizContainer.appendChild(card);
  });

  // Open-ended Questions
  const textareas = [];
  openEnded.forEach((q, idx) => {
    const qNum = mcqTotal + idx + 1;
    const card = el('div', 'quiz-card quiz-card--open');
    card.appendChild(el('p', 'quiz-q', `${qNum}. ${q.question}`));
    card.appendChild(el('span', 'quiz-concept-tag tag', q.concept));
    card.appendChild(el('p', 'quiz-hint', '✍️ Type your answer below (min 20 characters)'));

    const textarea = document.createElement('textarea');
    textarea.classList.add('form-textarea');
    textarea.rows = 3;
    textarea.placeholder = 'Your answer…';
    card.appendChild(textarea);
    textareas.push({ textarea, card, concept: q.concept });

    quizContainer.appendChild(card);
  });

  // Results container (hidden initially)
  const resultsCard = el('div', 'quiz-results');
  resultsCard.style.display = 'none';
  quizContainer.appendChild(resultsCard);

  // Submit Button
  const submitBtn = el('button', 'btn btn-primary btn-lg quiz-submit-btn', '📝 Submit Quiz');
  submitBtn.addEventListener('click', () => {
    // Force-answer any unanswered MCQs as wrong
    const unansweredCards = quizContainer.querySelectorAll('.quiz-card:not(.quiz-answered):not(.quiz-card--open)');
    unansweredCards.forEach(card => {
      card.classList.add('quiz-answered', 'quiz-skipped');
    });

    // Score open-ended: 1 point if >= 20 chars, 0.5 if >= 10 chars
    let openScore = 0;
    textareas.forEach(({ textarea, card }) => {
      const text = textarea.value.trim();
      card.classList.add('quiz-answered');
      if (text.length >= 20) {
        openScore += 1;
        card.classList.add('quiz-card--pass');
      } else if (text.length >= 10) {
        openScore += 0.5;
        card.classList.add('quiz-card--partial');
      } else {
        card.classList.add('quiz-card--fail');
      }
      textarea.readOnly = true;
    });

    // Calculate final grade
    const totalScore = mcqScore + openScore;
    const maxScore = mcqTotal + openTotal;
    const percentage = Math.round((totalScore / maxScore) * 100);

    // Award XP for taking a quiz
    addXP('quiz', 15);

    // Save quiz score for achievements tracking
    const quizScores = storage.get('quiz_scores', []);
    quizScores.push(percentage);
    storage.set('quiz_scores', quizScores);
    
    if (percentage === 100) {
      const currentTokens = storage.get('streak_freeze_tokens', 0);
      if (currentTokens < 3) {
        storage.set('streak_freeze_tokens', currentTokens + 1);
        showNotificationToast('Perfect Score! Earned 1 Streak Freeze ❄️');
        import('./firebase-sync.js').then(({ pushToCloud, getCurrentUser }) => {
          if (getCurrentUser()) pushToCloud();
        });
      }
    }

    let grade = 'F';
    let gradeColor = '#ff4757';
    let gradeEmoji = '😤';
    if (percentage >= 90) { grade = 'A+'; gradeColor = '#00ff88'; gradeEmoji = '🔥'; }
    else if (percentage >= 80) { grade = 'A'; gradeColor = '#00ff88'; gradeEmoji = '💪'; }
    else if (percentage >= 70) { grade = 'B'; gradeColor = '#00d4ff'; gradeEmoji = '👏'; }
    else if (percentage >= 60) { grade = 'C'; gradeColor = '#FFFC00'; gradeEmoji = '📈'; }
    else if (percentage >= 50) { grade = 'D'; gradeColor = '#ff8800'; gradeEmoji = '🤔'; }
    else { grade = 'F'; gradeColor = '#ff4757'; gradeEmoji = '😤'; }

    // Build results
    resultsCard.replaceChildren();
    resultsCard.style.display = 'block';

    const gradeCircle = el('div', 'quiz-grade-circle');
    gradeCircle.style.borderColor = gradeColor;
    gradeCircle.appendChild(el('span', 'quiz-grade-letter', grade));
    gradeCircle.appendChild(el('span', 'quiz-grade-emoji', gradeEmoji));
    resultsCard.appendChild(gradeCircle);

    resultsCard.appendChild(el('h3', 'quiz-results__title', `You scored ${percentage}%`));
    resultsCard.appendChild(el('p', 'quiz-results__subtitle', `${totalScore} out of ${maxScore} points`));

    // Breakdown
    const breakdown = el('div', 'quiz-breakdown');
    const mcqRow = el('div', 'quiz-breakdown__row');
    mcqRow.appendChild(el('span', '', '📊 Multiple Choice:'));
    mcqRow.appendChild(el('span', 'quiz-breakdown__val', `${mcqScore} / ${mcqTotal}`));
    breakdown.appendChild(mcqRow);

    const openRow = el('div', 'quiz-breakdown__row');
    openRow.appendChild(el('span', '', '✍️ Open-ended:'));
    openRow.appendChild(el('span', 'quiz-breakdown__val', `${openScore} / ${openTotal}`));
    breakdown.appendChild(openRow);

    resultsCard.appendChild(breakdown);

    // Verdict
    let verdict = '';
    if (percentage >= 80) verdict = 'Excellent! You really understand these concepts. Keep pushing!';
    else if (percentage >= 60) verdict = 'Good effort! Review the concepts you missed and try again.';
    else verdict = 'Keep studying! Re-watch the lessons and come back stronger.';
    resultsCard.appendChild(el('p', 'quiz-results__verdict', verdict));

    // Hide submit button
    submitBtn.style.display = 'none';

    // Scroll to results
    resultsCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });

  quizContainer.appendChild(submitBtn);
  body.appendChild(quizContainer);
}

/* ---------- Assignments ------------------------------------------- */

let _activeAssignmentTab = 'active';

function renderAssignments(container, onRefresh) {
  container.replaceChildren();
  const wrapper = el('div', 'assignments-section');
  wrapper.appendChild(el('h2', 'section-title', '📝 Assignments'));

  // Split assignments into Active and Completed
  const allAssignments = getAssignments();
  const activeAssignments = allAssignments.filter(a => !a.completed);
  const completedAssignments = allAssignments.filter(a => a.completed);

  // Tab bar container
  const tabContainer = el('div', 'tab-bar');
  tabContainer.style.marginBottom = 'var(--space-4)';

  const activeBtn = el('button', `tab-btn${_activeAssignmentTab === 'active' ? ' active' : ''}`, `🎯 Active (${activeAssignments.length})`);
  activeBtn.addEventListener('click', () => {
    _activeAssignmentTab = 'active';
    renderAssignments(container, onRefresh);
  });
  tabContainer.appendChild(activeBtn);

  const completedBtn = el('button', `tab-btn${_activeAssignmentTab === 'completed' ? ' active' : ''}`, `🏆 History (${completedAssignments.length})`);
  completedBtn.addEventListener('click', () => {
    _activeAssignmentTab = 'completed';
    renderAssignments(container, onRefresh);
  });
  tabContainer.appendChild(completedBtn);

  wrapper.appendChild(tabContainer);

  const genBtn = el('button', 'btn btn-secondary', '🎲 Generate Exercise');
  genBtn.style.marginBottom = 'var(--space-4)';
  genBtn.addEventListener('click', () => {
    openPracticeLevelSelector(onRefresh);
  });
  wrapper.appendChild(genBtn);

  const filteredAssignments = _activeAssignmentTab === 'active' ? activeAssignments : completedAssignments;

  if (!filteredAssignments.length) {
    const hintText = _activeAssignmentTab === 'active' 
      ? 'No active assignments. Click "Generate Exercise" to start practicing! 🎯' 
      : 'No completed assignments in history yet. Finish some exercises to build your track record! 🏆';
    wrapper.appendChild(el('p', 'empty-hint', hintText));
  } else {
    const list = el('div', 'assignment-list');
    [...filteredAssignments].reverse().forEach((a) => {
      const card = el('div', `assignment-card${a.completed ? ' done' : ''}`);
      card.appendChild(el('p', 'assignment-text', a.text));

      const meta = el('div', 'assignment-meta');
      const conceptTag = a.episodeNum ? `Level ${a.episodeNum}` : (a.concept || 'SMC');
      meta.appendChild(el('span', 'tag', conceptTag));
      meta.appendChild(el('span', 'tag', a.asset));
      meta.appendChild(el('span', 'tag', a.timeframe));
      card.appendChild(meta);

      // Action buttons row
      const actions = el('div', 'assignment-actions');

      // Go to Chart button
      if (!a.completed) {
        const chartBtn = el('button', 'btn btn-sm assignment-btn-chart', '📊 Open Chart');
        chartBtn.addEventListener('click', () => {
          import('./trading.js').then(({ loadChartSymbol }) => {
            loadChartSymbol(a.asset);
          });
        });
        actions.appendChild(chartBtn);
      }

      // View Steps button
      if (Array.isArray(a.steps) && a.steps.length > 0) {
        const stepsBtn = el('button', 'btn btn-sm assignment-btn-steps', '📋 View Steps');
        stepsBtn.addEventListener('click', () => openExercisePopup(a, onRefresh));
        actions.appendChild(stepsBtn);
      }

      const toggleBtn = el('button', 'btn btn-sm assignment-btn-toggle', a.completed ? '↩️ Reopen' : '✅ Done');
      toggleBtn.addEventListener('click', () => {
        const all = getAssignments();
        const target = all.find((x) => x.id === a.id);
        if (target) {
          const wasCompleted = target.completed;
          target.completed = !target.completed;
          
          if (!wasCompleted && target.completed) {
            addXP('assignment', 40);
            const currentTokens = storage.get('streak_freeze_tokens', 0);
            if (currentTokens < 3) {
              storage.set('streak_freeze_tokens', currentTokens + 1);
              showNotificationToast('Assignment Completed! Earned 1 Streak Freeze ❄️');
            }
          }
          
          storage.set(STORAGE_ASSIGNMENTS, all);
          
          import('./firebase-sync.js').then(({ pushToCloud, getCurrentUser }) => {
            if (getCurrentUser()) pushToCloud();
          });

          if (typeof onRefresh === 'function') onRefresh();
        }
      });
      actions.appendChild(toggleBtn);

      const delBtn = el('button', 'btn btn-sm assignment-btn-delete', '🗑️ Delete');
      delBtn.addEventListener('click', () => {
        const all = getAssignments().filter(x => x.id !== a.id);
        storage.set(STORAGE_ASSIGNMENTS, all);
        if (typeof onRefresh === 'function') onRefresh();
      });
      actions.appendChild(delBtn);

      card.appendChild(actions);
      list.appendChild(card);
    });
    wrapper.appendChild(list);
  }

  container.appendChild(wrapper);
}

/* ---------- Exercise Popup ---------------------------------------- */

function openExercisePopup(assignment, onRefresh) {
  const overlay = el('div', 'exercise-overlay');

  const card = el('div', 'exercise-card');

  // Gradient top strip
  const strip = el('div', 'exercise-strip');
  card.appendChild(strip);

  // Close button
  const closeBtn = el('button', 'exercise-close', '✕');
  closeBtn.addEventListener('click', () => {
    overlay.classList.add('exercise-closing');
    setTimeout(() => overlay.remove(), 300);
  });
  card.appendChild(closeBtn);

  // Icon + Title
  card.appendChild(el('span', 'exercise-icon', '🎯'));
  card.appendChild(el('h2', 'exercise-title', 'Chart Exercise'));
  card.appendChild(el('p', 'exercise-subtitle', 'Complete this task on the live chart'));

  // Task box
  const taskBox = el('div', 'exercise-task-box');
  taskBox.appendChild(el('span', 'exercise-task-label', 'YOUR TASK'));
  taskBox.appendChild(el('p', 'exercise-task-text', assignment.text));
  card.appendChild(taskBox);

  // Tags
  const tagRow = el('div', 'exercise-tag-row');
  const levelTag = assignment.episodeNum ? `Level ${assignment.episodeNum}` : (assignment.concept || 'SMC');
  [assignment.asset, assignment.timeframe, levelTag].forEach(t => {
    tagRow.appendChild(el('span', 'exercise-tag', t));
  });
  card.appendChild(tagRow);

  // Steps
  const stepsBox = el('div', 'exercise-steps-box');
  if (Array.isArray(assignment.steps) && assignment.steps.length > 0) {
    stepsBox.appendChild(el('p', 'exercise-steps-title', 'CONFLUENCE CHECKLIST'));
    assignment.steps.forEach((s, idx) => {
      const step = el('div', 'exercise-step-item');
      step.appendChild(el('span', 'exercise-step-num', String(idx + 1)));
      
      const stepTextWrap = el('div', 'exercise-step-text-wrap');
      stepTextWrap.appendChild(el('strong', 'exercise-step-title-inline', s.title + ': '));
      stepTextWrap.appendChild(el('span', '', s.text));
      step.appendChild(stepTextWrap);
      
      stepsBox.appendChild(step);
    });
  } else {
    stepsBox.appendChild(el('p', 'exercise-steps-title', 'HOW TO COMPLETE'));
    const stepData = [
      { num: '1', text: `Open the chart for ${assignment.asset}` },
      { num: '2', text: `Switch to ${assignment.timeframe} timeframe` },
      { num: '3', text: 'Mark & draw your analysis' },
      { num: '4', text: 'Come back and mark as Done ✅' },
    ];
    stepData.forEach(s => {
      const step = el('div', 'exercise-step-item');
      step.appendChild(el('span', 'exercise-step-num', s.num));
      step.appendChild(el('span', 'exercise-step-text', s.text));
      stepsBox.appendChild(step);
    });
  }
  card.appendChild(stepsBox);

  // Actions
  const actions = el('div', 'exercise-actions');
  const isAlreadySaved = !!assignment.id;

  const goBtn = el('button', 'exercise-btn-go', '📊 Go to Chart Now');
  goBtn.addEventListener('click', () => {
    if (!isAlreadySaved) {
      saveAssignment(assignment);
    }
    overlay.classList.add('exercise-closing');
    setTimeout(() => overlay.remove(), 300);
    if (typeof onRefresh === 'function') onRefresh();
    import('./trading.js').then(({ loadChartSymbol }) => {
      loadChartSymbol(assignment.asset);
    });
  });
  actions.appendChild(goBtn);

  if (!isAlreadySaved) {
    const laterBtn = el('button', 'exercise-btn-later', '💾 Save for Later');
    laterBtn.addEventListener('click', () => {
      saveAssignment(assignment);
      overlay.classList.add('exercise-closing');
      setTimeout(() => overlay.remove(), 300);
      if (typeof onRefresh === 'function') onRefresh();
    });
    actions.appendChild(laterBtn);
  }

  card.appendChild(actions);
  overlay.appendChild(card);
  document.body.appendChild(overlay);

  // Animate in
  requestAnimationFrame(() => overlay.classList.add('exercise-visible'));
}

/* ---------- Action Buttons Bar ------------------------------------ */

function renderActionBar(container, onRefresh) {
  container.replaceChildren();
  const bar = el('div', 'learning-action-bar');

  const logBtn = el('button', 'btn btn-primary btn-lg', '📖 Log a Lesson');
  logBtn.addEventListener('click', () => openLogLessonPopup(onRefresh));
  bar.appendChild(logBtn);

  const quizBtn = el('button', 'btn btn-secondary btn-lg', '🧩 Take a Quiz');
  quizBtn.addEventListener('click', () => openQuizPopup());
  bar.appendChild(quizBtn);

  const flashcardBtn = el('button', 'btn btn-outline btn-lg', '🃏 Flashcards');
  flashcardBtn.addEventListener('click', () => renderFlashcardMode());
  bar.appendChild(flashcardBtn);

  container.appendChild(bar);
}

/* ================================================================== */
/*  DAILY ICT TIPS                                                     */
/* ================================================================== */

const DAILY_ICT_TIPS = [
  'Always identify the HTF bias before looking for entries on LTF. Never trade against the trend.',
  'FVGs are magnets for price. When you see an unfilled FVG, expect price to return to it.',
  'The best setups happen during Killzones. Avoid trading outside London and New York sessions.',
  'A Break of Structure (BOS) confirms trend continuation. Wait for it before entering.',
  'Change of Character (CHOCH) is the first sign of a reversal. Watch for it at key levels.',
  'The OTE zone (0.618–0.786 Fibonacci retracement) is where smart money enters. Be patient for it.',
  'Supply and demand zones are not the same as support and resistance. S/D zones are one-touch areas.',
  'Liquidity rests above swing highs and below swing lows. Smart money hunts these levels before reversing.',
  'An inducement (IDM) is a trap. When you see one, wait for the sweep before entering.',
  'Always use a stop loss. Risk management is more important than any single trade setup.',
  'The Asian session creates the range. London sweeps it. New York continues or reverses.',
  'Pin bars with long wicks at supply/demand zones are powerful rejection signals.',
  'An engulfing candle at a key zone with confluence is one of the highest probability entries.',
  'Never risk more than 1-2% of your account on a single trade. Consistency beats home runs.',
  'Revenge trading after a loss is a guaranteed way to blow your account. Walk away after 2 losses.',
  'The trend is your friend until the CHOCH at a HTF POI. Then become the trend\'s new friend.',
  'Mark your sessions with vertical lines. Most setups form within the first 2 hours of a Killzone.',
  'A doji at a supply or demand zone shows indecision — wait for the next candle to confirm direction.',
  'Top-down analysis: D1 for bias, H4 for structure, H1 for POI, M15 for entry. Never skip steps.',
  'Fair Value Gaps inside the OTE zone are the highest quality entry points in ICT methodology.',
  'Price always seeks liquidity. If you can see where the stops are, you can predict where price will go.',
  'The London Killzone (2–5 AM NY time) often sets the high or low of the day. Trade accordingly.',
  'The New York Killzone (7–10 AM NY time) is where the most volume and best setups occur.',
  'Accumulation happens in a range. Distribution follows the trend. Learn to tell the difference.',
  'Your trading journal is your most valuable tool. Log every trade — winners AND losers.',
  'Backtesting builds confidence. Test your strategy on 100+ setups before trading it live.',
  'A clean chart is a clear mind. Remove unnecessary indicators and trust price action.',
  'Wicks tell stories. A long lower wick means buyers stepped in. A long upper wick means sellers rejected.',
  'Confluence is king: S/D zone + FVG + OTE + Killzone timing = high probability trade.',
  'Premium vs Discount: buy in discount (below 50% of range), sell in premium (above 50%).',
  'Smart money doesn\'t chase. They wait for price to come to their level. Learn to be patient.',
  'The Sunday candle open and the Monday range often set the tone for the entire week.',
  'When in doubt, stay out. No trade is better than a bad trade. Protect your capital always.',
  // — Brad Goh "Market Mechanics" Inspired Tips —
  'Trading is a mechanical process. Build rules, follow rules, trust the process. Emotions are the enemy of consistency.',
  'Your Point of Interest (POI) is where you expect smart money to react. Mark it on the HTF, refine it on the LTF.',
  'Success in trading is non-linear. You will have losing weeks. What matters is the long-term equity curve going up.',
  'Stop looking for the "holy grail" setup. One edge, mastered and backtested, is all you need to be profitable.',
  'The market doesn\'t care about your feelings. It only cares about liquidity. Learn to think like the market maker.',
  'Draw liquidity pools on your chart like magnets. Price is always moving toward the nearest cluster of stop losses.',
  'Do the work. 500 hours of screen time is the minimum before you should expect consistency. There are no shortcuts.',
  'Your win rate doesn\'t need to be 80%. A 40% win rate with 1:3 risk-to-reward is highly profitable. Do the math.',
  'The market moves in 3 phases: expansion, retracement, and continuation. Learn to identify which phase you\'re in.',
  'Order blocks are the last candle before a strong move. They represent institutional entry points. Trade with them, not against them.',
  'Every loss is tuition. If you journaled it, reviewed it, and found the mistake — it wasn\'t a loss, it was a lesson.',
  'Patience is not waiting for a setup. Patience is watching a setup form, waiting for confirmation, and THEN entering.',
  'Don\'t trade every day. The best traders wait for A+ setups and skip everything else. Quality over quantity.',
  'Before entering any trade, ask: "Where is the liquidity?" If you can\'t answer that, you shouldn\'t be trading.',
  'Fractal markets: what happens on D1 also happens on M15. The same patterns repeat across all timeframes.',
  'The goal is not to make money — the goal is to execute your plan perfectly. The money follows the discipline.',
];

function renderDailyTip(container) {
  container.replaceChildren();
  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 0);
  const diff = now - startOfYear;
  const oneDay = 1000 * 60 * 60 * 24;
  const dayOfYear = Math.floor(diff / oneDay);
  const tipIndex = dayOfYear % DAILY_ICT_TIPS.length;
  const tip = DAILY_ICT_TIPS[tipIndex];

  const card = el('div', 'daily-tip-card');

  const header = el('div', 'daily-tip-header');
  header.appendChild(el('span', 'daily-tip-icon', '💡'));
  header.appendChild(el('span', 'daily-tip-label', 'Daily ICT Tip'));
  card.appendChild(header);

  card.appendChild(el('p', 'daily-tip-text', tip));

  const footer = el('p', 'daily-tip-footer');
  footer.textContent = 'Tip #' + (tipIndex + 1) + ' of ' + DAILY_ICT_TIPS.length + ' — refreshes daily';
  card.appendChild(footer);

  container.appendChild(card);
}

/* ================================================================== */
/*  PROGRESS MILESTONES & BADGES                                       */
/* ================================================================== */

const MILESTONES = [
  { id: 'first-steps',     emoji: '🥉', name: 'First Steps',         desc: 'Complete 1 lesson',       check: () => getLessons().length >= 1 },
  { id: 'getting-serious', emoji: '🏅', name: 'Getting Serious',     desc: 'Complete 5 lessons',      check: () => getLessons().length >= 5 },
  { id: 'halfway',         emoji: '🥈', name: 'Halfway There',       desc: 'Complete 10 lessons',     check: () => getLessons().length >= 10 },
  { id: 'almost-pro',      emoji: '🥇', name: 'Almost Pro',          desc: 'Complete 20 lessons',     check: () => getLessons().length >= 20 },
  { id: 'graduate',        emoji: '🏆', name: 'Brah Goh Graduate',   desc: 'Complete all 33 lessons', check: () => getLessons().length >= 33 },
  { id: 'assignment-ace',  emoji: '📝', name: 'Assignment Ace',      desc: 'Complete 5 assignments',  check: () => getAssignments().filter(a => a.completed).length >= 5 },
  { id: 'quiz-master',     emoji: '🎯', name: 'Quiz Master',         desc: 'Score 80%+ on 10 quizzes', check: () => {
    const quizScores = storage.get('quiz_scores', []);
    return quizScores.filter(s => s >= 80).length >= 10;
  }},
  { id: 'streak-warrior',  emoji: '🔥', name: 'Streak Warrior',      desc: '7-day lesson streak',     check: () => {
    const lessons = getLessons();
    if (lessons.length < 7) return false;
    const dates = lessons.map(l => new Date(l.createdAt).toDateString());
    const uniqueDates = [...new Set(dates)].sort((a, b) => new Date(b) - new Date(a));
    let streak = 1;
    for (let i = 1; i < uniqueDates.length; i++) {
      const prev = new Date(uniqueDates[i - 1]);
      const curr = new Date(uniqueDates[i]);
      const diffDays = Math.round((prev - curr) / (1000 * 60 * 60 * 24));
      if (diffDays === 1) { streak++; if (streak >= 7) return true; }
      else { streak = 1; }
    }
    return streak >= 7;
  }},
];

function renderMilestones(container) {
  container.replaceChildren();
  const section = el('div', 'milestones-section');
  section.appendChild(el('h2', 'section-title', '🏅 Milestones & Badges'));

  const scroll = el('div', 'milestones-scroll');

  MILESTONES.forEach(m => {
    const unlocked = m.check();
    const badge = el('div', 'milestone-badge ' + (unlocked ? 'milestone-badge--unlocked' : 'milestone-badge--locked'));

    badge.appendChild(el('span', 'milestone-emoji', m.emoji));
    badge.appendChild(el('span', 'milestone-name', m.name));
    badge.appendChild(el('span', 'milestone-desc', m.desc));

    if (unlocked) {
      badge.appendChild(el('span', 'milestone-check', '✅'));
    } else {
      const lock = el('span', 'milestone-lock-overlay', '🔒');
      badge.appendChild(lock);
    }

    scroll.appendChild(badge);
  });

  section.appendChild(scroll);
  container.appendChild(section);
}

/* ================================================================== */
/*  FLASHCARD QUIZ MODE                                                */
/* ================================================================== */

const FLASHCARD_DATA = [
  { emoji: '📊', concept: 'Break of Structure (BOS)', answer: 'BOS occurs when price breaks a previous swing high (in an uptrend) or swing low (in a downtrend), confirming the current trend direction. It is the primary signal for trend continuation in ICT methodology.' },
  { emoji: '🔄', concept: 'Change of Character (CHOCH)', answer: 'CHOCH is the first break of structure in the opposite direction, signaling a potential trend reversal. For example, in an uptrend, CHOCH happens when price breaks below the most recent higher low.' },
  { emoji: '📦', concept: 'Fair Value Gap (FVG)', answer: 'An FVG is a three-candle pattern where the wicks of candle 1 and candle 3 do not overlap, creating a price inefficiency. Price tends to return to fill these gaps before continuing.' },
  { emoji: '🏦', concept: 'Supply & Demand Zones', answer: 'Supply zones are areas where institutional sellers placed large orders (price dropped from). Demand zones are where institutional buyers placed large orders (price rallied from). These are one-touch zones, unlike support/resistance.' },
  { emoji: '🎯', concept: 'Optimal Trade Entry (OTE)', answer: 'The OTE is the 0.618–0.786 Fibonacci retracement zone. Smart money typically enters positions in this zone during pullbacks, making it the highest probability entry area.' },
  { emoji: '💰', concept: 'Premium vs Discount', answer: 'Divide any range into two halves using the 50% equilibrium level. Above 50% is Premium (sell zone), below 50% is Discount (buy zone). Always buy in discount and sell in premium.' },
  { emoji: '🕐', concept: 'ICT Killzones', answer: 'Killzones are specific time windows of high institutional activity: Asian (8 PM–12 AM NY), London (2–5 AM NY), New York (7–10 AM NY), and London Close (10 AM–12 PM NY). Best setups form within these windows.' },
  { emoji: '💧', concept: 'Liquidity', answer: 'Liquidity is the collection of stop-loss orders resting above swing highs (buy-side liquidity) and below swing lows (sell-side liquidity). Smart money drives price to these levels to fill large orders.' },
  { emoji: '🪤', concept: 'Inducement (IDM)', answer: 'An inducement is a deliberate market trap designed to lure retail traders into early entries. Smart money creates these traps to build liquidity before the real move. Wait for the sweep before entering.' },
  { emoji: '🕯️', concept: 'Engulfing Candle', answer: 'An engulfing candle completely covers the body of the previous candle. Bullish engulfing at demand zones and bearish engulfing at supply zones are powerful reversal/continuation signals.' },
  { emoji: '📌', concept: 'Pin Bar', answer: 'A pin bar has a long wick and small body, showing strong rejection at a price level. The long wick indicates that price was pushed back aggressively, signaling potential reversal.' },
  { emoji: '⚖️', concept: 'Doji Candle', answer: 'A doji has nearly equal open and close prices, creating a cross shape. It represents indecision between buyers and sellers. At key zones, it signals a potential reversal — wait for the next candle to confirm.' },
  { emoji: '📐', concept: 'Fibonacci Retracement', answer: 'Fibonacci retracement levels (0.236, 0.382, 0.5, 0.618, 0.786) help identify potential reversal zones during pullbacks. The 0.618–0.786 zone is the most important for ICT entries.' },
  { emoji: '🧠', concept: 'Trading Psychology', answer: 'Mastering emotions is the #1 factor in trading success. Fear causes early exits, greed causes overtrading, and impatience causes bad entries. Develop a plan and follow it mechanically.' },
  { emoji: '📈', concept: 'Market Structure', answer: 'Market structure is defined by swing highs and swing lows. Higher highs + higher lows = bullish. Lower highs + lower lows = bearish. Always identify structure before placing any trade.' },
  { emoji: '🔝', concept: 'Top-Down Analysis', answer: 'Start from the highest timeframe (D1/W1) to establish directional bias, then move to H4 for structure, H1 for POI identification, and M15/M5 for precise entries. Never trade without HTF context.' },
  { emoji: '💹', concept: 'Order Flow', answer: 'Order flow is the stream of buy and sell orders that drives price movement. Understanding who is buying/selling and at what levels gives you an edge over retail traders who only see price.' },
  { emoji: '⚡', concept: 'Price Action', answer: 'Price action is the study of raw price movement without indicators. Candle patterns, structure, and S/D zones are all price action tools. It reveals the true story of supply and demand in real time.' },
  { emoji: '🎰', concept: 'Risk Management', answer: 'Never risk more than 1-2% per trade. Use proper position sizing. A 1:3 risk-to-reward ratio means you only need to win 25% of trades to be profitable. Protect capital above all else.' },
  { emoji: '🧊', concept: 'Liquidity Sweep', answer: 'A liquidity sweep occurs when price pushes past a swing point to trigger stop-losses, then reverses sharply. This is smart money collecting orders. The reversal after a sweep is a high-probability entry.' },
];

function renderFlashcardMode() {
  const reviewed = new Set();
  let currentIndex = 0;
  let isFlipped = false;

  const overlay = el('div', 'flashcard-overlay');

  // Header
  const header = el('div', 'flashcard-header');
  const titleEl = el('span', 'flashcard-title', 'Flashcards 🃏');
  const progressEl = el('span', 'flashcard-progress', '1 of ' + FLASHCARD_DATA.length);
  const closeBtn = el('button', 'flashcard-close', '✕');
  closeBtn.addEventListener('click', () => {
    overlay.style.opacity = '0';
    setTimeout(() => overlay.remove(), 300);
  });
  header.appendChild(titleEl);
  header.appendChild(progressEl);
  header.appendChild(closeBtn);
  overlay.appendChild(header);

  // Card scene (3D perspective)
  const scene = el('div', 'flashcard-scene');
  const card = el('div', 'flashcard-card');

  // Front face
  const front = el('div', 'flashcard-face flashcard-front');
  const frontEmoji = el('span', 'flashcard-emoji', FLASHCARD_DATA[0].emoji);
  const frontConcept = el('span', 'flashcard-concept', FLASHCARD_DATA[0].concept);
  const frontHint = el('span', 'flashcard-hint', 'Tap to reveal answer');
  front.appendChild(frontEmoji);
  front.appendChild(frontConcept);
  front.appendChild(frontHint);

  // Back face
  const back = el('div', 'flashcard-face flashcard-back');
  const backLabel = el('span', 'flashcard-answer-label', 'Answer');
  const backText = el('p', 'flashcard-answer-text', FLASHCARD_DATA[0].answer);
  back.appendChild(backLabel);
  back.appendChild(backText);

  card.appendChild(front);
  card.appendChild(back);
  scene.appendChild(card);
  overlay.appendChild(scene);

  // Flip handler
  card.addEventListener('click', () => {
    isFlipped = !isFlipped;
    if (isFlipped) {
      card.classList.add('flashcard-card--flipped');
      reviewed.add(currentIndex);
      updateDots();
    } else {
      card.classList.remove('flashcard-card--flipped');
    }
  });

  // Navigation
  const nav = el('div', 'flashcard-nav');
  const prevBtn = el('button', 'flashcard-nav-btn', '◀ Prev');
  const counterEl = el('span', 'flashcard-counter', '1 of ' + FLASHCARD_DATA.length);
  const nextBtn = el('button', 'flashcard-nav-btn', 'Next ▶');
  prevBtn.disabled = true;

  function updateCard() {
    const data = FLASHCARD_DATA[currentIndex];
    frontEmoji.textContent = data.emoji;
    frontConcept.textContent = data.concept;
    backText.textContent = data.answer;
    counterEl.textContent = (currentIndex + 1) + ' of ' + FLASHCARD_DATA.length;
    progressEl.textContent = (currentIndex + 1) + ' of ' + FLASHCARD_DATA.length + ' — ' + reviewed.size + ' reviewed';
    prevBtn.disabled = currentIndex === 0;
    nextBtn.disabled = currentIndex === FLASHCARD_DATA.length - 1;
    // Reset flip
    isFlipped = false;
    card.classList.remove('flashcard-card--flipped');
    updateDots();
  }

  prevBtn.addEventListener('click', () => {
    if (currentIndex > 0) { currentIndex--; updateCard(); }
  });
  nextBtn.addEventListener('click', () => {
    if (currentIndex < FLASHCARD_DATA.length - 1) { currentIndex++; updateCard(); }
  });

  nav.appendChild(prevBtn);
  nav.appendChild(counterEl);
  nav.appendChild(nextBtn);
  overlay.appendChild(nav);

  // Reviewed dots
  const dotsRow = el('div', 'flashcard-reviewed-row');
  const dots = [];
  for (let i = 0; i < FLASHCARD_DATA.length; i++) {
    const dot = el('span', 'flashcard-dot');
    dots.push(dot);
    dotsRow.appendChild(dot);
  }
  overlay.appendChild(dotsRow);

  function updateDots() {
    dots.forEach((dot, i) => {
      dot.className = 'flashcard-dot';
      if (i === currentIndex) dot.classList.add('flashcard-dot--active');
      if (reviewed.has(i)) dot.classList.add('flashcard-dot--reviewed');
    });
  }
  updateDots();

  // Keyboard navigation
  function handleKeydown(e) {
    if (e.key === 'ArrowLeft' && currentIndex > 0) { currentIndex--; updateCard(); }
    else if (e.key === 'ArrowRight' && currentIndex < FLASHCARD_DATA.length - 1) { currentIndex++; updateCard(); }
    else if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); card.click(); }
    else if (e.key === 'Escape') { closeBtn.click(); }
  }
  document.addEventListener('keydown', handleKeydown);
  // Cleanup keyboard on close
  const origClose = closeBtn.onclick;
  closeBtn.addEventListener('click', () => document.removeEventListener('keydown', handleKeydown));

  document.body.appendChild(overlay);
}

/* ================================================================== */
/*  MAIN RENDER                                                       */
/* ================================================================== */

export function renderLearningPage(container) {
  container.replaceChildren();
  container.appendChild(el('h1', 'page-title', '📚 Learning Hub'));

  const dailyTipContainer = el('div');
  const pomodoroContainer = el('div');
  const flashcardsContainer = el('div');
  const milestonesContainer = el('div');
  const actionContainer = el('div');
  const mentorContainer = el('div');
  const assignmentContainer = el('div');
  const curriculumContainer = el('div');
  const baCurriculumContainer = el('div');

  // Order: Daily Tip → Pomodoro → Flashcards → Milestones → Actions → Mentors → Assignments → Curriculum
  container.appendChild(dailyTipContainer);
  container.appendChild(pomodoroContainer);
  container.appendChild(flashcardsContainer);
  container.appendChild(milestonesContainer);
  container.appendChild(actionContainer);
  container.appendChild(mentorContainer);
  container.appendChild(assignmentContainer);
  container.appendChild(curriculumContainer);
  container.appendChild(baCurriculumContainer);

  function refresh() {
    renderDailyTip(dailyTipContainer);
    renderPomodoroTimer(pomodoroContainer);
    renderFlashcards(flashcardsContainer);
    renderMilestones(milestonesContainer);
    renderActionBar(actionContainer, refresh);
    renderMentorCards(mentorContainer, refresh, curriculumContainer, baCurriculumContainer);
    renderCurriculumLog(curriculumContainer);
    renderBossAckahCurriculum(baCurriculumContainer, refresh);
    renderAssignments(assignmentContainer, refresh);
  }

  refresh();
}

/* ================================================================== */
/*  BOSS ACKAH CURRICULUM SECTION                                      */
/* ================================================================== */

function renderBossAckahCurriculum(container, onRefresh) {
  container.replaceChildren();
  const wrapper = el('div', 'curriculum-section ba-curriculum-section');
  wrapper.appendChild(el('h2', 'section-title', '👑 Boss Ackah Curriculum'));

  const baLessons = getBaLessons();
  const loggedIds = new Set(baLessons.map(l => l.lessonId));

  const timeline = el('div', 'curriculum-timeline');

  const effectiveBA = getEffectiveBaCurriculum();

  effectiveBA.forEach((lesson) => {
    const isLogged = loggedIds.has(lesson.id);
    const progress = getBaProgress(lesson.id);

    const item = el('div', `timeline-item${isLogged ? ' completed' : ''}`);

    const marker = el('div', 'timeline-marker');
    marker.textContent = isLogged ? '✅' : '📌';
    item.appendChild(marker);

    const content = el('div', 'timeline-content');
    content.appendChild(el('h4', 'timeline-ep-title', `Lesson ${lesson.lesson}: ${lesson.title}`));

    // Type badge
    const typeBadge = el('span', 'ba-type-badge');
    typeBadge.textContent = lesson.type === 'audio' ? '🎧 Audio/Video' : '📝 Session';
    content.appendChild(typeBadge);

    content.appendChild(el('p', 'timeline-desc', lesson.description));

    // Instructions
    if (lesson.instructions) {
      const instrBox = el('div', 'ba-instructions');
      instrBox.appendChild(el('span', 'ba-instructions__label', '📋 Assignment:'));
      instrBox.appendChild(el('p', 'ba-instructions__text', lesson.instructions));
      content.appendChild(instrBox);
    }

    // Concept tags
    if (lesson.concepts.length) {
      const tagBar = el('div', 'concept-tags');
      lesson.concepts.forEach(c => tagBar.appendChild(el('span', 'tag', c)));
      content.appendChild(tagBar);
    }

    // Resource link (YouTube etc)
    if (lesson.resource) {
      const resLink = el('a', 'btn btn-secondary btn-sm');
      resLink.textContent = `🔗 ${lesson.resourceLabel || 'Open Resource'}`;
      resLink.href = lesson.resource;
      resLink.target = '_blank';
      resLink.rel = 'noopener noreferrer';
      content.appendChild(resLink);
    }

    // Progress tracker
    const progressSection = el('div', 'ba-progress-tracker');
    const pLabel = el('span', 'ba-progress-label');
    pLabel.textContent = progress.percent >= 100 ? '✅ Completed' : `Progress: ${progress.percent}%`;
    progressSection.appendChild(pLabel);

    const pBar = el('div', 'ba-progress-bar');
    const pFill = el('div', 'ba-progress-fill');
    pFill.style.width = `${progress.percent}%`;
    pBar.appendChild(pFill);
    progressSection.appendChild(pBar);

    // Quick-tap step buttons instead of slider
    const stepRow = el('div', 'ba-step-buttons');
    const steps = [
      { label: 'Not Started', value: 0 },
      { label: '25%', value: 25 },
      { label: '50%', value: 50 },
      { label: '75%', value: 75 },
      { label: 'Done ✅', value: 100 },
    ];

    steps.forEach(({ label, value }) => {
      const stepBtn = el('button', `ba-step-btn${progress.percent >= value ? ' ba-step-active' : ''}`, label);
      stepBtn.addEventListener('click', () => {
        const existing = getBaProgress(lesson.id);
        saveBaProgress(lesson.id, { ...existing, percent: value });
        pFill.style.width = `${value}%`;
        pLabel.textContent = value >= 100 ? '✅ Completed' : `Progress: ${value}%`;
        // Update active states
        stepRow.querySelectorAll('.ba-step-btn').forEach((b, idx) => {
          b.classList.toggle('ba-step-active', steps[idx].value <= value);
        });
      });
      stepRow.appendChild(stepBtn);
    });
    progressSection.appendChild(stepRow);
    content.appendChild(progressSection);

    // Logged notes
    const lessonEntry = baLessons.find(l => l.lessonId === lesson.id);
    if (lessonEntry) {
      const noteCard = el('div', 'timeline-note');
      noteCard.appendChild(el('span', 'timeline-note-label', '📝 Your notes:'));
      noteCard.appendChild(el('p', 'timeline-note-text', lessonEntry.notes || 'No notes'));
      
      if (lessonEntry.notesImage) {
        const thumbDiv = el('div', 'timeline-note-image-thumb');
        thumbDiv.style.marginTop = 'var(--space-2)';
        thumbDiv.style.cursor = 'pointer';
        
        const img = document.createElement('img');
        img.src = lessonEntry.notesImage;
        img.style.maxWidth = '120px';
        img.style.maxHeight = '80px';
        img.style.borderRadius = 'var(--radius-sm)';
        img.style.border = '1px solid rgba(255, 255, 255, 0.1)';
        img.style.transition = 'transform 0.2s';
        
        img.addEventListener('mouseenter', () => img.style.transform = 'scale(1.05)');
        img.addEventListener('mouseleave', () => img.style.transform = 'scale(1)');
        
        img.addEventListener('click', (e) => {
          e.stopPropagation();
          openNotesImageModal(`Notes — Lesson ${lesson.lesson}: ${lesson.title}`, lessonEntry.notesImage);
        });
        
        thumbDiv.appendChild(img);
        noteCard.appendChild(thumbDiv);
      }
      
      noteCard.appendChild(el('span', 'timeline-note-date', formatDate(lessonEntry.createdAt)));
      content.appendChild(noteCard);
    }

    // Log lesson button (if not logged yet)
    if (!isLogged) {
      const logBtn = el('button', 'btn btn-primary btn-sm', '📖 Log Notes for This Lesson');
      logBtn.style.marginTop = 'var(--space-3)';
      logBtn.addEventListener('click', () => openBaLogPopup(lesson, onRefresh));
      content.appendChild(logBtn);
    }

    item.appendChild(content);
    timeline.appendChild(item);
  });

  wrapper.appendChild(timeline);

  // Add Lesson button
  const addBtn = el('button', 'btn btn-outline btn-add-ba-lesson', '➕ Add New Lesson');
  addBtn.addEventListener('click', () => openAddBaLessonPopup(effectiveBA.length + 1, container, onRefresh));
  wrapper.appendChild(addBtn);

  container.appendChild(wrapper);
}

/* ── Boss Ackah — User-Added Lessons ──────────────────────── */

const STORAGE_BA_USER_LESSONS = 'ba_user_lessons';

function getUserBaLessons() {
  return storage.get(STORAGE_BA_USER_LESSONS, []);
}

function getEffectiveBaCurriculum() {
  return [...BOSS_ACKAH_CURRICULUM, ...getUserBaLessons()];
}

/** Popup to add a new Boss Ackah lesson */
function openAddBaLessonPopup(nextNum, currContainer, onRefresh) {
  const { body, close } = createModal('➕ Add Boss Ackah Lesson');

  const form = el('form', 'modal-form');
  form.setAttribute('novalidate', '');

  // Title
  const titleGroup = el('div', 'form-group');
  titleGroup.appendChild(el('label', 'form-label', 'Lesson Title'));
  const titleInput = document.createElement('input');
  titleInput.type = 'text';
  titleInput.className = 'form-input';
  titleInput.placeholder = 'e.g. Risk Management Fundamentals';
  titleInput.required = true;
  titleGroup.appendChild(titleInput);
  form.appendChild(titleGroup);

  // Type
  const typeGroup = el('div', 'form-group');
  typeGroup.appendChild(el('label', 'form-label', 'Lesson Type'));
  const typeSelect = document.createElement('select');
  typeSelect.className = 'form-select';
  [
    { value: 'audio', label: '🎧 Audio / Video' },
    { value: 'session', label: '📝 Live Session' },
    { value: 'text', label: '📄 Text / Reading' },
    { value: 'assignment', label: '📋 Assignment' },
  ].forEach(opt => {
    const o = el('option', '', opt.label);
    o.value = opt.value;
    typeSelect.appendChild(o);
  });
  typeGroup.appendChild(typeSelect);
  form.appendChild(typeGroup);

  // Description / Boss Ackah's words
  const descGroup = el('div', 'form-group');
  descGroup.appendChild(el('label', 'form-label', 'Description / Boss Ackah\'s Words'));
  const descInput = document.createElement('textarea');
  descInput.className = 'form-textarea';
  descInput.rows = 4;
  descInput.placeholder = 'Paste what Boss Ackah said about this lesson...';
  descInput.required = true;
  descGroup.appendChild(descInput);
  form.appendChild(descGroup);

  // Resource link (optional)
  const linkGroup = el('div', 'form-group');
  linkGroup.appendChild(el('label', 'form-label', 'Resource Link (optional)'));
  const linkInput = document.createElement('input');
  linkInput.type = 'url';
  linkInput.className = 'form-input';
  linkInput.placeholder = 'https://youtu.be/... or any link';
  linkGroup.appendChild(linkInput);
  form.appendChild(linkGroup);

  // Link label
  const linkLabelGroup = el('div', 'form-group');
  linkLabelGroup.appendChild(el('label', 'form-label', 'Resource Label (optional)'));
  const linkLabelInput = document.createElement('input');
  linkLabelInput.type = 'text';
  linkLabelInput.className = 'form-input';
  linkLabelInput.placeholder = 'e.g. Risk Management Video';
  linkLabelGroup.appendChild(linkLabelInput);
  form.appendChild(linkLabelGroup);

  // Instructions
  const instrGroup = el('div', 'form-group');
  instrGroup.appendChild(el('label', 'form-label', 'Instructions (optional)'));
  const instrInput = document.createElement('input');
  instrInput.type = 'text';
  instrInput.className = 'form-input';
  instrInput.placeholder = 'e.g. Watch → Take notes → Share notes';
  instrGroup.appendChild(instrInput);
  form.appendChild(instrGroup);

  // Concepts
  const conceptGroup = el('div', 'form-group');
  conceptGroup.appendChild(el('label', 'form-label', 'Key Concepts (comma separated, optional)'));
  const conceptInput = document.createElement('input');
  conceptInput.type = 'text';
  conceptInput.className = 'form-input';
  conceptInput.placeholder = 'e.g. risk-management, position-sizing';
  conceptGroup.appendChild(conceptInput);
  form.appendChild(conceptGroup);

  const submitBtn = el('button', 'btn btn-primary btn-lg', '➕ Add Lesson');
  submitBtn.type = 'submit';
  form.appendChild(submitBtn);

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const title = sanitizeText(titleInput.value.trim());
    const desc = sanitizeText(descInput.value.trim(), 5000);
    if (!title || !desc) return;

    const newLesson = {
      id: `ba-${nextNum}`,
      lesson: nextNum,
      title,
      type: typeSelect.value,
      concepts: conceptInput.value.trim()
        ? conceptInput.value.split(',').map(c => sanitizeText(c.trim())).filter(Boolean)
        : [],
      description: desc,
      resource: linkInput.value.trim() || null,
      resourceLabel: sanitizeText(linkLabelInput.value.trim()) || null,
      instructions: sanitizeText(instrInput.value.trim()) || null,
    };

    const userLessons = getUserBaLessons();
    userLessons.push(newLesson);
    storage.set(STORAGE_BA_USER_LESSONS, userLessons);

    close();
    if (typeof onRefresh === 'function') onRefresh();
  });

  body.appendChild(form);
}

/** Popup to log notes for a Boss Ackah lesson. */
function openBaLogPopup(lesson, onSaved) {
  const { body, close } = createModal(`📖 Log Notes — Lesson ${lesson.lesson}`);

  const form = el('form', 'modal-form');
  form.setAttribute('novalidate', '');

  // Lesson title (read-only display)
  const titleBox = el('div', 'ba-lesson-title-box');
  titleBox.appendChild(el('h3', '', `Lesson ${lesson.lesson}: ${lesson.title}`));
  titleBox.appendChild(el('p', 'ba-lesson-desc', lesson.description));
  form.appendChild(titleBox);

  // Notes textarea
  const notesInput = document.createElement('textarea');
  notesInput.name = 'notes';
  notesInput.rows = 6;
  notesInput.placeholder = 'Write your key takeaways and important points here…';
  notesInput.classList.add('form-textarea');
  notesInput.required = true;
  const notesGroup = el('div', 'form-group');
  notesGroup.appendChild(el('label', 'form-label', 'Your Notes / Key Takeaways'));
  notesGroup.appendChild(notesInput);
  form.appendChild(notesGroup);

  // Rating
  const ratingSelect = document.createElement('select');
  ratingSelect.name = 'rating';
  ratingSelect.classList.add('form-select');
  for (let i = 1; i <= 5; i++) {
    const opt = el('option', '', '⭐'.repeat(i));
    opt.value = String(i);
    ratingSelect.appendChild(opt);
  }
  const rGroup = el('div', 'form-group');
  rGroup.appendChild(el('label', 'form-label', 'Understanding Level'));
  rGroup.appendChild(ratingSelect);
  form.appendChild(rGroup);

  // Notes Image Upload
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.name = 'notesImageFile';
  fileInput.accept = 'image/*';
  fileInput.className = 'form-input';
  
  const filePreview = el('div', 'notes-file-preview');
  filePreview.style.display = 'none';
  filePreview.style.marginTop = 'var(--space-2)';
  
  let baNotesImageBase64 = null;
  
  fileInput.addEventListener('change', () => {
    const file = fileInput.files[0];
    if (!file || !file.type.startsWith('image/')) {
      filePreview.style.display = 'none';
      baNotesImageBase64 = null;
      return;
    }
    
    filePreview.replaceChildren();
    filePreview.style.display = 'block';
    filePreview.appendChild(el('p', '', '⏳ Compressing photo of notes...'));
    
    compressImage(file, 1000).then(base64 => {
      baNotesImageBase64 = base64;
      filePreview.replaceChildren();
      const img = document.createElement('img');
      img.src = base64;
      img.style.maxWidth = '100%';
      img.style.maxHeight = '150px';
      img.style.borderRadius = 'var(--radius-md)';
      img.style.border = '1px solid rgba(255, 255, 255, 0.1)';
      filePreview.appendChild(img);
    }).catch(err => {
      filePreview.replaceChildren();
      filePreview.appendChild(el('p', 'pnl-negative', '⚠️ Error reading image file.'));
      baNotesImageBase64 = null;
    });
  });
  
  const fileGroup = el('div', 'form-group');
  fileGroup.appendChild(el('label', 'form-label', 'Upload Photo of Notes (Optional)'));
  fileGroup.appendChild(fileInput);
  fileGroup.appendChild(filePreview);
  form.appendChild(fileGroup);

  const submitBtn = el('button', 'btn btn-primary btn-lg', 'Save Notes 📖');
  submitBtn.type = 'submit';
  form.appendChild(submitBtn);

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const notes = sanitizeText(notesInput.value, 5000);
    if (!notes) { notesInput.focus(); return; }

    const entry = {
      id: generateId(),
      lessonId: lesson.id,
      lessonNumber: lesson.lesson,
      title: lesson.title,
      notes,
      rating: Number(ratingSelect.value),
      concepts: lesson.concepts,
      notesImage: baNotesImageBase64,
      createdAt: new Date().toISOString(),
    };

    const all = getBaLessons();
    all.push(entry);
    storage.set(STORAGE_BA_LESSONS, all);

    // Mark progress to 100% when logged
    saveBaProgress(lesson.id, { percent: 100, notes });

    close();
    if (typeof onSaved === 'function') onSaved();
  });

  body.appendChild(form);
}

function showNotificationToast(message) {
  const toast = document.createElement('div');
  toast.className = 'freeze-toast';
  const icon = document.createElement('span');
  icon.textContent = '❄️ ';
  toast.appendChild(icon);
  toast.appendChild(document.createTextNode(message));
  document.body.appendChild(toast);

  // Force layout reflow
  toast.offsetHeight;

  toast.classList.add('freeze-toast--visible');

  setTimeout(() => {
    toast.classList.remove('freeze-toast--visible');
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

/* ================================================================== */
/*  3D GLASSMORPHIC FLASHCARDS SYSTEM                                 */
/* ================================================================== */

const FLASHCARD_TERMS = [
  {
    id: 'bos',
    concept: 'BOS',
    title: 'Break of Structure',
    definition: 'A continuation signal where price breaks past a previous swing high (in an uptrend) or swing low (in a downtrend), validating the trend direction.',
    emoji: '📈'
  },
  {
    id: 'choch',
    concept: 'CHOCH',
    title: 'Change of Character',
    definition: 'The first signal of a potential trend reversal. It occurs when price breaks the opposite swing point (e.g., a swing low in a bullish trend).',
    emoji: '🔄'
  },
  {
    id: 'fvg',
    concept: 'FVG',
    title: 'Fair Value Gap',
    definition: 'A 3-candle imbalance. Forms when candle 1\'s wick and candle 3\'s wick do not overlap, leaving a visual "void" that price tends to retrace and fill.',
    emoji: '🧩'
  },
  {
    id: 'sweep',
    concept: 'Sweep',
    title: 'Liquidity Sweep',
    definition: 'A raid where price briefly breaks a key level (e.g., previous highs/lows) to trigger stop-losses and engineering liquidity, before rapidly reversing.',
    emoji: '🧹'
  },
  {
    id: 'ote',
    concept: 'OTE',
    title: 'Optimal Trade Entry',
    definition: 'The high-probability Fibonacci retracement window located strictly between the 61.8% and 78.6% levels, ideal for entering high-confluence setups.',
    emoji: '📐'
  },
  {
    id: 'ob',
    concept: 'OB',
    title: 'Order Block',
    definition: 'The last opposite candle before a strong impulse leg. It represents where institutions placed massive block orders, acting as high-confluence support/resistance.',
    emoji: '🧱'
  },
  {
    id: 'idm',
    concept: 'IDM',
    title: 'Inducement',
    definition: 'A minor swing high or low that acts as a trap. It entices early retail traders to buy or sell, building liquidity for smart money to sweep.',
    emoji: '🪤'
  },
  {
    id: 'mindset',
    concept: 'Mindset',
    title: 'Trading Mindset',
    definition: 'Boss Ackah\'s core psychology: acquiring a powerful professional skill through commitment, emotional control, and not letting the lure of money cloud the mind.',
    emoji: '🕯️'
  }
];

export function renderFlashcards(container) {
  container.replaceChildren();

  // Read mastered terms
  const mastered = storage.get('mastered_terms', []);
  const masteredCount = mastered.length;
  const totalCount = FLASHCARD_TERMS.length;
  const percent = totalCount > 0 ? Math.round((masteredCount / totalCount) * 100) : 0;

  const section = el('div', 'flashcards-section');

  // Header & Mastery Progress bar
  const headerRow = el('div', 'flashcards-header');
  const title = el('h2', 'section-title', '🎴 3D Concept Flashcards');
  headerRow.appendChild(title);

  const progressContainer = el('div', 'flashcards-progress-wrap');
  const progressLabel = el('span', 'flashcards-progress-label', `🧩 Mastery: ${masteredCount}/${totalCount} (${percent}%)`);
  progressContainer.appendChild(progressLabel);

  const barTrack = el('div', 'flashcards-progress-track');
  const barFill = el('div', 'flashcards-progress-fill');
  barFill.style.width = `${percent}%`;
  barTrack.appendChild(barFill);
  progressContainer.appendChild(barTrack);
  headerRow.appendChild(progressContainer);
  
  section.appendChild(headerRow);

  // Cards Grid
  const grid = el('div', 'flashcards-grid');
  
  FLASHCARD_TERMS.forEach(item => {
    const isMastered = mastered.includes(item.id);
    
    // Outer Perspective container
    const cardWrap = el('div', 'flashcard-container');
    
    // Card itself
    const card = el('div', 'flashcard-card');
    
    // Inner wrapper
    const cardInner = el('div', 'flashcard-inner');
    
    // FRONT Side
    const front = el('div', 'flashcard-front');
    front.appendChild(el('span', 'flashcard-front__emoji', item.emoji));
    front.appendChild(el('h3', 'flashcard-front__concept', item.concept));
    front.appendChild(el('span', 'flashcard-front__title', item.title));
    front.appendChild(el('span', 'flashcard-front__hint', '👇 Click to Flip'));
    
    // BACK Side
    const back = el('div', 'flashcard-back');
    back.appendChild(el('h4', 'flashcard-back__title', item.title));
    back.appendChild(el('p', 'flashcard-back__def', item.definition));
    
    // Mastered Checkbox Button (prevents flip bubble)
    const masterBtn = el('button', `btn btn-sm flashcard-back__btn${isMastered ? ' active' : ''}`);
    masterBtn.textContent = isMastered ? '✅ Mastered!' : '🧩 Mark Mastered';
    masterBtn.addEventListener('click', (e) => {
      e.stopPropagation(); // prevent card flip
      
      let currentMastered = storage.get('mastered_terms', []);
      if (currentMastered.includes(item.id)) {
        currentMastered = currentMastered.filter(id => id !== item.id);
        masterBtn.textContent = '🧩 Mark Mastered';
        masterBtn.classList.remove('active');
      } else {
        currentMastered.push(item.id);
        masterBtn.textContent = '✅ Mastered!';
        masterBtn.classList.add('active');
        
        // Show notification toast
        showNotificationToast(`🧩 Mastered term: ${item.concept}! Keep it up! ⚡`);
      }
      
      storage.set('mastered_terms', currentMastered);
      
      // Update sync immediately
      import('./firebase-sync.js').then(({ pushToCloud, getCurrentUser }) => {
        if (getCurrentUser()) pushToCloud();
      });
      
      // Re-render flashcard progress bar
      const updatedPercent = Math.round((currentMastered.length / totalCount) * 100);
      progressLabel.textContent = `🧩 Mastery: ${currentMastered.length}/${totalCount} (${updatedPercent}%)`;
      barFill.style.width = `${updatedPercent}%`;
    });
    back.appendChild(masterBtn);
    
    cardInner.appendChild(front);
    cardInner.appendChild(back);
    card.appendChild(cardInner);
    
    // Click card to flip
    card.addEventListener('click', () => {
      card.classList.toggle('flipped');
    });
    
    cardWrap.appendChild(card);
    grid.appendChild(cardWrap);
  });
  
  section.appendChild(grid);
  container.appendChild(section);
}

/* ================================================================== */
/*  POMODORO FOCUS TIMER                                              */
/* ================================================================== */

// Module-level Pomodoro state (survives tab switches!)
let _pomoState = {
  duration: 25 * 60, // default 25 minutes
  timeLeft: 25 * 60,
  isRunning: false,
  timerId: null,
  mode: 'focus', // 'focus', 'short', 'long'
  completedToday: 0,
  lastUpdatedDate: new Date().toDateString()
};

function initPomoData() {
  const saved = storage.get('pomodoro_data', null);
  const todayStr = new Date().toDateString();
  
  if (saved) {
    _pomoState.completedToday = saved.date === todayStr ? (saved.completedToday || 0) : 0;
    _pomoState.lastUpdatedDate = saved.date || todayStr;
  } else {
    _pomoState.completedToday = 0;
    _pomoState.lastUpdatedDate = todayStr;
  }
}

function savePomoData() {
  storage.set('pomodoro_data', {
    completedToday: _pomoState.completedToday,
    date: _pomoState.lastUpdatedDate
  });

  // Log focus block completion historically under pomodoro_history
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const dateKey = `${y}-${m}-${d}`;

  const history = storage.get('pomodoro_history', {});
  history[dateKey] = _pomoState.completedToday;
  storage.set('pomodoro_history', history);

  // Sync to Firestore immediately upon focus block completion
  import('./firebase-sync.js').then(({ pushToCloud, getCurrentUser }) => {
    if (getCurrentUser()) pushToCloud();
  });
}

function formatPomoTime(secs) {
  const m = String(Math.floor(secs / 60)).padStart(2, '0');
  const s = String(secs % 60).padStart(2, '0');
  return `${m}:${s}`;
}

export function renderPomodoroTimer(container) {
  container.replaceChildren();
  initPomoData();

  const card = el('div', 'overview-panel pomodoro-card');
  
  // Left: SVG Progress Ring
  const ringCol = el('div', 'pomodoro-ring-col');
  
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'pomodoro-svg');
  svg.setAttribute('viewBox', '0 0 120 120');

  const circleTrack = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  circleTrack.setAttribute('class', 'pomodoro-circle-track');
  circleTrack.setAttribute('cx', '60');
  circleTrack.setAttribute('cy', '60');
  circleTrack.setAttribute('r', '50');
  svg.appendChild(circleTrack);

  const circleFill = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  circleFill.setAttribute('class', `pomodoro-circle-fill pomodoro-circle-fill--${_pomoState.mode}`);
  circleFill.setAttribute('cx', '60');
  circleFill.setAttribute('cy', '60');
  circleFill.setAttribute('r', '50');
  
  const c = 314.16; // Circumference = 2 * PI * r = 2 * 3.14159 * 50
  circleFill.style.strokeDasharray = `${c}`;
  const progressRatio = _pomoState.timeLeft / _pomoState.duration;
  circleFill.style.strokeDashoffset = `${c - (progressRatio * c)}`;
  svg.appendChild(circleFill);
  ringCol.appendChild(svg);

  // Time Text in the center
  const timeDisplay = el('span', 'pomodoro-time-text', formatPomoTime(_pomoState.timeLeft));
  ringCol.appendChild(timeDisplay);
  card.appendChild(ringCol);

  // Right: Controls & Modes
  const controlsCol = el('div', 'pomodoro-controls-col');
  
  const title = el('h3', 'pomodoro-title', '⏱️ ICT Pomodoro Timer');
  controlsCol.appendChild(title);

  // Mode buttons row
  const modesRow = el('div', 'pomodoro-modes-row');
  const modes = [
    { id: 'focus', label: '🎯 Focus (25m)', duration: 25 * 60 },
    { id: 'short', label: '☕ Short (5m)', duration: 5 * 60 },
    { id: 'long', label: '🌴 Long (15m)', duration: 15 * 60 }
  ];

  modes.forEach(m => {
    const btn = el('button', `pomodoro-mode-btn${_pomoState.mode === m.id ? ' active' : ''}`, m.label);
    btn.addEventListener('click', () => {
      if (_pomoState.isRunning) {
        clearInterval(_pomoState.timerId);
        _pomoState.isRunning = false;
      }
      _pomoState.mode = m.id;
      _pomoState.duration = m.duration;
      _pomoState.timeLeft = m.duration;
      
      timeDisplay.textContent = formatPomoTime(_pomoState.timeLeft);
      circleFill.style.strokeDashoffset = '0';
      circleFill.className.baseVal = `pomodoro-circle-fill pomodoro-circle-fill--${m.id}`;
      
      modesRow.querySelectorAll('.pomodoro-mode-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      playBtn.textContent = '▶ Start';
    });
    modesRow.appendChild(btn);
  });
  controlsCol.appendChild(modesRow);

  // Action Buttons Row (Start / Pause, Reset)
  const actionsRow = el('div', 'pomodoro-actions-row');
  
  const playBtn = el('button', 'btn btn-primary pomodoro-action-btn', _pomoState.isRunning ? '⏸ Pause' : '▶ Start');
  const resetBtn = el('button', 'btn btn-outline pomodoro-action-btn', '🔄 Reset');

  playBtn.addEventListener('click', () => {
    if (_pomoState.isRunning) {
      clearInterval(_pomoState.timerId);
      _pomoState.isRunning = false;
      playBtn.textContent = '▶ Start';
    } else {
      _pomoState.isRunning = true;
      playBtn.textContent = '⏸ Pause';
      
      _pomoState.timerId = setInterval(() => {
        _pomoState.timeLeft--;
        
        // Update DOM in real-time
        timeDisplay.textContent = formatPomoTime(_pomoState.timeLeft);
        const ratio = _pomoState.timeLeft / _pomoState.duration;
        circleFill.style.strokeDashoffset = `${c - (ratio * c)}`;
        
        // If finished
        if (_pomoState.timeLeft <= 0) {
          clearInterval(_pomoState.timerId);
          _pomoState.isRunning = false;
          playBtn.textContent = '▶ Start';
          
          handleTimerCompletion();
        }
      }, 1000);
    }
  });

  resetBtn.addEventListener('click', () => {
    if (_pomoState.isRunning) {
      clearInterval(_pomoState.timerId);
      _pomoState.isRunning = false;
    }
    _pomoState.timeLeft = _pomoState.duration;
    timeDisplay.textContent = formatPomoTime(_pomoState.timeLeft);
    circleFill.style.strokeDashoffset = '0';
    playBtn.textContent = '▶ Start';
  });

  actionsRow.appendChild(playBtn);
  actionsRow.appendChild(resetBtn);
  controlsCol.appendChild(actionsRow);

  // Tally
  const tally = el('div', 'pomodoro-tally');
  tally.appendChild(el('span', 'pomodoro-tally-icon', '🍅'));
  const tallyCount = el('span', 'pomodoro-tally-text');
  tallyCount.textContent = `Completed focus sessions today: ${_pomoState.completedToday} / 4`;
  tally.appendChild(tallyCount);
  controlsCol.appendChild(tally);

  card.appendChild(controlsCol);
  container.appendChild(card);
}

function handleTimerCompletion() {
  const isFocus = _pomoState.mode === 'focus';
  
  if (isFocus) {
    _pomoState.completedToday++;
    _pomoState.lastUpdatedDate = new Date().toDateString();
    savePomoData();

    // 1. Award XP (+30 XP)
    addXP('quiz', 30); // Award study completion XP

    // 2. Play Audio Bell
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, audioCtx.currentTime); // A5 note
      osc.frequency.exponentialRampToValueAtTime(1200, audioCtx.currentTime + 0.1);
      osc.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 1.2);
      osc.start();
      osc.stop(audioCtx.currentTime + 1.2);
    } catch (e) {
      // Audio not supported or blocked
    }

    // 3. Show Confetti!
    import('./utils.js').then(({ triggerConfetti }) => {
      triggerConfetti();
    });

    // 4. Show Notification Toast
    showNotificationToast('🍅 Study Block Finished! Earned +30 XP! ❄️');

    // 5. Push immediately to Cloud backup
    import('./firebase-sync.js').then(({ pushToCloud, getCurrentUser }) => {
      if (getCurrentUser()) pushToCloud();
    });
  } else {
    showNotificationToast('☕ Break over! Time to get back to work! 🎯');
  }

  // Reload the widget to display updated tally count
  const container = document.querySelector('.pomodoro-card')?.parentElement;
  if (container) {
    renderPomodoroTimer(container);
  }
}
