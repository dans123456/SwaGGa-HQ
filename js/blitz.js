import storage from './storage.js';
import { playSynthSound } from './audio.js';
import { addXP } from './xp.js';
import { nativeHaptic, nativeHapticNotification } from './native-bridge.js';
import { showNotificationToast } from './utils.js';

let _quizState = {
  score: 0,
  lives: 3,
  currentQuestion: null,
  winStreak: 0,
  timerInterval: null,
  timeLeft: 10,
  timerFrozen: false,
  mode: 'menu', // 'menu', 'blitz', 'zen'
  zenFilters: ['fvg', 'bos', 'ob', 'judas', 'choch', 'ote', 'liquidity_sweep', 'amd', 'breaker', 'risk_reward', 'pinbar', 'killzone'],
  questionHistory: []
};

// --- SCENARIO DATA DEFINITIONS ---
const SCENARIO_DETAILS = {
  fvg: {
    title: 'Fair Value Gaps (FVG)',
    prompt: 'A large institutional displacement candle created the gap highlighted in blue. What is this concept?',
    options: [
      'A) Fair Value Gap (FVG)',
      'B) Liquidity Pool Sweep',
      'C) Bearish Order Block Mitigation',
      'D) Support / Resistance Breakout'
    ],
    correct: 'A) Fair Value Gap (FVG)',
    explanation: 'A Fair Value Gap (FVG) represents a structural price imbalance. It is identified on a 3-candle sequence where the low of the 1st candle and the high of the 3rd candle do not overlap, leaving an inefficient corridor where price moved too rapidly.'
  },
  bos: {
    title: 'Break of Structure (BOS)',
    prompt: 'Price breaches the previous structural swing low (dotted line), indicating trend continuation. What is this shift called?',
    options: [
      'A) Change of Character (CHoCH)',
      'B) Break of Structure (BOS)',
      'C) Bearish Supply Mitigation',
      'D) Double Bottom Liquidity Pool'
    ],
    correct: 'B) Break of Structure (BOS)',
    explanation: 'Break of Structure (BOS) occurs when price continues in the current trend direction and closes beyond a previous swing high or swing low, validating trend continuation.'
  },
  ob: {
    title: 'Order Blocks & Demand',
    prompt: 'The last down-closed candle prior to a rapid upward displacement is covered by the green box. What zone is this?',
    options: [
      'A) Bearish Supply Zone',
      'B) Bullish Order Block (Demand Zone)',
      'C) Liquidity Sweep Area',
      'D) Broken Flip Zone'
    ],
    correct: 'B) Bullish Order Block (Demand Zone)',
    explanation: 'A Bullish Order Block is the last down-closed candle before a rapid upward expansion. It represents where institutions placed massive buying orders, establishing a strong demand zone.'
  },
  judas: {
    title: 'London Judas Swing',
    prompt: 'During London Open, price runs a false breakout above the Asian high (liquidity sweep) before aggressively reversing short. What is this?',
    options: [
      'A) London Judas Swing',
      'B) Fair Value Gap retracement',
      'C) Bullish Displacement shift',
      'D) Premium-discount equilibrium tap'
    ],
    correct: 'A) London Judas Swing',
    explanation: 'The London Judas Swing is a classic liquidity sweep at the London open session, pushing price past the Asian range extremes to trigger stop losses before expanding in the true daily trend direction.'
  },
  choch: {
    title: 'Change of Character (CHoCH)',
    prompt: 'Price breaks the counter-trend swing high (dotted line), indicating the first sign of a trend reversal. What is this shift called?',
    options: [
      'A) Change of Character (CHoCH)',
      'B) Break of Structure (BOS)',
      'C) Liquidity Void Mitigation',
      'D) Support / Resistance Consolidation'
    ],
    correct: 'A) Change of Character (CHoCH)',
    explanation: 'Change of Character (CHoCH) represents the initial shift in market structure, where a counter-trend swing high/low is broken, signaling a transition to a new trend direction.'
  },
  ote: {
    title: 'Optimal Trade Entry (OTE)',
    prompt: 'A Fibonacci retracement zone between 62% and 79% is highlighted. What trade entry setup does this represent?',
    options: [
      'A) Optimal Trade Entry (OTE)',
      'B) Equal Highs Liquidity Pool',
      'C) Breaker Block Mitigation',
      'D) Fair Value Gap Void'
    ],
    correct: 'A) Optimal Trade Entry (OTE)',
    explanation: 'Optimal Trade Entry (OTE) is the premium Fibonacci discount zone between the 62% (0.618) and 79% (0.786) retracement levels, offering optimal risk-to-reward parameters for high-probability setups.'
  },
  liquidity_sweep: {
    title: 'Liquidity Sweep (Stop Hunt)',
    prompt: 'Price runs just below equal lows (retail support) to collect sell stop orders before aggressively reversing high. What happened?',
    options: [
      'A) Bearish Trend Confirmation',
      'B) Liquidity Sweep (Stop Hunt)',
      'C) Fair Value Gap Fill',
      'D) Order Block Invalidation'
    ],
    correct: 'B) Liquidity Sweep (Stop Hunt)',
    explanation: 'A Liquidity Sweep targets stop-loss orders built up at obvious structural points like equal highs/lows, capturing the liquidity needed by institutions to run the counter move.'
  },
  amd: {
    title: 'Power of Three (AMD)',
    prompt: 'This institutional price cycle consists of Accumulation, Manipulation, and Distribution. What is this strategy/concept?',
    options: [
      'A) Wyckoff Re-accumulation',
      'B) Fibonacci Extension Drive',
      'C) Power of Three (AMD)',
      'D) Market Maker Sell Model'
    ],
    correct: 'C) Power of Three (AMD)',
    explanation: 'The Power of Three (AMD) is a core market maker model containing three phases: Accumulation (sideways consolidation), Manipulation (false move sweeping stops), and Distribution (real trend breakout).'
  },
  breaker: {
    title: 'Breaker Blocks',
    prompt: 'A failed order block that was broken through now acts as resistance upon price retesting it. What is this block called?',
    options: [
      'A) Mitigation Block',
      'B) Breaker Block',
      'C) Propulsion Block',
      'D) Rejection Block'
    ],
    correct: 'B) Breaker Block',
    explanation: 'A Breaker Block is a failed order block. If a bullish demand zone gets run over completely, it flips to become resistance (breaker block) when price returns to mitigate it from underneath.'
  },
  risk_reward: {
    title: 'Risk Management (RR)',
    prompt: 'If your Stop Loss is 10 pips and your Take Profit is 30 pips, what is the risk-to-reward ratio of this setup?',
    options: [
      'A) 1:3 RR',
      'B) 1:1 RR',
      'C) 1:5 RR',
      'D) 2:3 RR'
    ],
    correct: 'A) 1:3 RR',
    explanation: 'Risk-to-Reward (RR) ratio scales potential loss against potential gain. A 10-pip stop loss and a 30-pip target yield a 1:3 ratio, allowing you to remain profitable even with a lower win rate.'
  },
  pinbar: {
    title: 'Pin Bar Rejection',
    prompt: 'This single candlestick has a very long lower wick and a small body near the top, signaling rejection of lower prices. What is it?',
    options: [
      'A) Doji Indecision',
      'B) Bearish Engulfing',
      'C) Pin Bar (Hammer)',
      'D) Marubozu Momentum'
    ],
    correct: 'C) Pin Bar (Hammer)',
    explanation: 'A Pin Bar (Hammer) features a long shadow demonstrating rejection. It shows that price pushed deep below support, but aggressive buying interest entered and forced a close near the highs.'
  },
  killzone: {
    title: 'Session Killzones',
    prompt: 'Which high-volatility session timing window is active between 2:00 AM and 5:00 AM New York time?',
    options: [
      'A) Asian Consolidation',
      'B) New York Killzone',
      'C) London Close Killzone',
      'D) London Killzone'
    ],
    correct: 'D) London Killzone',
    explanation: 'The London Killzone spans 2:00 AM to 5:00 AM New York time (EST), capturing the high volume, liquidity sweeps, and initial daily trends engineered during the London Session Open.'
  }
};

function el(tag, cls = '', text = '') {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text) node.textContent = text;
  return node;
}

export function renderBlitzPage(container) {
  // Initialize default user tokens if not set
  if (!storage.has('streak_freeze_tokens')) storage.set('streak_freeze_tokens', 1);
  if (!storage.has('shield_tokens')) storage.set('shield_tokens', 1);

  // Initialize defaults for mastery stats
  const savedMastery = storage.get('blitz_mastery_stats', {});
  Object.keys(SCENARIO_DETAILS).forEach(k => {
    if (!savedMastery[k]) {
      savedMastery[k] = { attempts: 0, correct: 0 };
    }
  });
  storage.set('blitz_mastery_stats', savedMastery);

  renderMenu(container);
}

function renderMenu(container) {
  _quizState.mode = 'menu';
  if (_quizState.timerInterval) clearInterval(_quizState.timerInterval);

  container.replaceChildren();

  // Header Title
  const header = el('div', 'page-header');
  header.appendChild(el('h1', 'page-title', '⚡ SMC Blitz: Speed Recognition Trainer'));
  container.appendChild(header);

  // Mode Cards Container
  const modesContainer = el('div', 'blitz-modes-container');
  container.appendChild(modesContainer);

  // 1. Blitz Card
  const blitzCard = el('div', 'overview-panel glass-card blitz-mode-card');
  const blitzIcon = el('div', 'blitz-mode-icon', '⚔️');
  const blitzTitle = el('h3', '', 'Blitz Challenge');
  blitzTitle.style.margin = '0 0 var(--space-2) 0';
  blitzTitle.style.color = 'var(--cyan)';
  
  const highscore = storage.get('blitz_high_score', 0);
  const freezeCount = storage.get('streak_freeze_tokens', 1);
  const shieldCount = storage.get('shield_tokens', 1);

  const blitzDesc = el('p', '', 'Timed speed recognition challenge. 10-second timer. 3 lives. Earn power-ups at milestones!');
  blitzDesc.style.fontSize = 'var(--text-xs)';
  blitzDesc.style.opacity = '0.7';
  blitzDesc.style.marginBottom = 'var(--space-4)';

  const blitzStats = el('div', '', `🏆 High Score: ${highscore} | ❄️ ${freezeCount} | 🛡️ ${shieldCount}`);
  blitzStats.style.fontSize = 'var(--text-xs)';
  blitzStats.style.fontWeight = 'bold';
  blitzStats.style.marginBottom = 'var(--space-4)';
  blitzStats.style.color = 'var(--cyan)';

  const blitzBtn = el('button', 'btn btn-primary', 'Launch Blitz Challenge');
  blitzBtn.style.width = '100%';
  blitzBtn.addEventListener('click', () => {
    startBlitzGame(container);
  });

  blitzCard.appendChild(blitzIcon);
  blitzCard.appendChild(blitzTitle);
  blitzCard.appendChild(blitzDesc);
  blitzCard.appendChild(blitzStats);
  blitzCard.appendChild(blitzBtn);
  modesContainer.appendChild(blitzCard);

  // 2. Zen Card
  const zenCard = el('div', 'overview-panel glass-card blitz-mode-card zen');
  const zenIcon = el('div', 'blitz-mode-icon', '🧘');
  const zenTitle = el('h3', '', 'Zen Practice');
  zenTitle.style.margin = '0 0 var(--space-2) 0';
  zenTitle.style.color = 'var(--purple)';

  const zenDesc = el('p', '', 'Untimed study practice. Choose specific concepts to study. See detailed explanations and chart guides.');
  zenDesc.style.fontSize = 'var(--text-xs)';
  zenDesc.style.opacity = '0.7';
  zenDesc.style.marginBottom = 'var(--space-4)';

  // Concept Checklist Filters inside Zen selection
  const filterLabel = el('div', '', 'Select concepts to study:');
  filterLabel.style.fontSize = 'var(--text-xs)';
  filterLabel.style.fontWeight = 'bold';
  filterLabel.style.marginBottom = 'var(--space-2)';
  filterLabel.style.color = 'var(--purple)';

  const filterGrid = el('div', 'blitz-filter-grid');
  Object.keys(SCENARIO_DETAILS).forEach(k => {
    const item = el('label', 'blitz-filter-item');
    const chk = document.createElement('input');
    chk.type = 'checkbox';
    chk.checked = _quizState.zenFilters.includes(k);
    chk.addEventListener('change', () => {
      if (chk.checked) {
        if (!_quizState.zenFilters.includes(k)) _quizState.zenFilters.push(k);
      } else {
        _quizState.zenFilters = _quizState.zenFilters.filter(x => x !== k);
      }
    });
    const txt = el('span', '', SCENARIO_DETAILS[k].title);
    item.appendChild(chk);
    item.appendChild(txt);
    filterGrid.appendChild(item);
  });

  const zenBtn = el('button', 'btn btn-outline', 'Enter Zen Practice');
  zenBtn.style.width = '100%';
  zenBtn.style.borderColor = 'var(--purple)';
  zenBtn.style.color = 'var(--purple)';
  zenBtn.addEventListener('click', () => {
    if (_quizState.zenFilters.length === 0) {
      showNotificationToast('Please select at least 1 concept!', '⚠️');
      return;
    }
    startZenGame(container);
  });

  zenCard.appendChild(zenIcon);
  zenCard.appendChild(zenTitle);
  zenCard.appendChild(zenDesc);
  zenCard.appendChild(filterLabel);
  zenCard.appendChild(filterGrid);
  zenCard.appendChild(zenBtn);
  modesContainer.appendChild(zenCard);

  // 3. Mastery Stats Dashboard Block
  const dashboard = el('div', 'overview-panel glass-card');
  dashboard.style.maxWidth = '720px';
  dashboard.style.margin = '0 auto';
  dashboard.style.padding = 'var(--space-5)';

  const dbTitle = el('h3', '', '📈 Concept Mastery Dashboard');
  dbTitle.style.marginBottom = 'var(--space-4)';
  dbTitle.style.borderBottom = '1px solid rgba(255,255,255,0.06)';
  dbTitle.style.paddingBottom = 'var(--space-2)';
  dashboard.appendChild(dbTitle);

  const masteryList = el('div', 'blitz-mastery-list');
  const masteryStats = storage.get('blitz_mastery_stats', {});
  
  let totalCorrect = 0;
  let totalAttempts = 0;

  Object.keys(SCENARIO_DETAILS).forEach(k => {
    const data = masteryStats[k] || { attempts: 0, correct: 0 };
    totalCorrect += data.correct;
    totalAttempts += data.attempts;

    const row = el('div', 'blitz-mastery-row');
    const info = el('div', 'blitz-mastery-info');
    
    const pct = data.attempts > 0 ? Math.round((data.correct / data.attempts) * 100) : 0;
    const countText = `${data.correct}/${data.attempts}`;
    
    info.appendChild(el('span', '', SCENARIO_DETAILS[k].title));
    
    const statsSpan = el('span', '', `${data.attempts > 0 ? pct + '%' : 'Untested'} (${countText})`);
    statsSpan.style.fontWeight = 'bold';
    statsSpan.style.color = data.attempts > 0 ? (pct >= 80 ? 'var(--neon-green)' : pct >= 50 ? 'var(--yellow)' : 'var(--neon-red)') : 'rgba(255,255,255,0.3)';
    info.appendChild(statsSpan);

    const track = el('div', 'blitz-progress-track');
    const fill = el('div', 'blitz-progress-fill');
    fill.style.width = `${pct}%`;
    if (data.attempts === 0) fill.style.background = 'rgba(255,255,255,0.03)';
    else if (pct < 50) fill.style.background = 'var(--neon-red)';
    else if (pct < 80) fill.style.background = 'var(--yellow)';
    else fill.style.background = 'var(--neon-green)';

    track.appendChild(fill);
    row.appendChild(info);
    row.appendChild(track);
    masteryList.appendChild(row);
  });
  dashboard.appendChild(masteryList);

  // Summary Metrics Block
  const summaryBox = el('div', '');
  summaryBox.style.display = 'flex';
  summaryBox.style.justifyContent = 'space-between';
  summaryBox.style.marginTop = 'var(--space-4)';
  summaryBox.style.paddingTop = 'var(--space-3)';
  summaryBox.style.borderTop = '1px solid rgba(255,255,255,0.06)';
  
  const totalPct = totalAttempts > 0 ? Math.round((totalCorrect / totalAttempts) * 100) : 0;
  const leftSummary = el('span', '', `Total Correct: ${totalCorrect} / ${totalAttempts} (${totalPct}%)`);
  leftSummary.style.fontSize = 'var(--text-xs)';
  leftSummary.style.fontWeight = '600';
  leftSummary.style.color = 'rgba(255,255,255,0.6)';

  const resetBtn = el('button', 'btn btn-outline', 'Reset Stats');
  resetBtn.style.padding = '0.25rem 0.75rem';
  resetBtn.style.fontSize = 'var(--text-xxs)';
  resetBtn.style.borderColor = 'rgba(255,71,87,0.3)';
  resetBtn.style.color = 'var(--neon-red)';
  resetBtn.addEventListener('click', () => {
    if (confirm('Are you sure you want to reset all concept mastery statistics?')) {
      const resetStats = {};
      Object.keys(SCENARIO_DETAILS).forEach(k => {
        resetStats[k] = { attempts: 0, correct: 0 };
      });
      storage.set('blitz_mastery_stats', resetStats);
      storage.set('blitz_high_score', 0);
      showNotificationToast('SMC Blitz Stats Reset!', '🧹');
      renderMenu(container);
    }
  });

  summaryBox.appendChild(leftSummary);
  summaryBox.appendChild(resetBtn);
  dashboard.appendChild(summaryBox);
  container.appendChild(dashboard);
}

function startBlitzGame(container) {
  _quizState.mode = 'blitz';
  _quizState.score = 0;
  _quizState.lives = 3;
  _quizState.winStreak = 0;
  _quizState.timeLeft = 10;
  _quizState.timerFrozen = false;
  
  setupGameContainer(container);
}

function startZenGame(container) {
  _quizState.mode = 'zen';
  _quizState.score = 0;
  _quizState.lives = 999;
  _quizState.winStreak = 0;
  _quizState.timeLeft = 999;
  
  setupGameContainer(container);
}

function setupGameContainer(container) {
  container.replaceChildren();

  // Back to Menu Button
  const backBtn = el('button', 'btn btn-outline', '⬅️ Back to Menu');
  backBtn.style.padding = '0.5rem 1rem';
  backBtn.style.fontSize = 'var(--text-xs)';
  backBtn.style.marginBottom = 'var(--space-3)';
  backBtn.addEventListener('click', () => {
    if (_quizState.timerInterval) clearInterval(_quizState.timerInterval);
    renderMenu(container);
  });
  container.appendChild(backBtn);

  // Main Card
  const card = el('div', 'overview-panel glass-card');
  card.style.padding = 'var(--space-6)';
  card.style.position = 'relative';
  card.style.maxWidth = '720px';
  card.style.margin = '0 auto';
  card.style.display = 'flex';
  card.style.flexDirection = 'column';
  card.style.gap = 'var(--space-4)';
  container.appendChild(card);

  // Stats Bar
  const statsBar = el('div', 'blitz-stats-bar');
  statsBar.style.display = 'flex';
  statsBar.style.justifyContent = 'space-between';
  statsBar.style.alignItems = 'center';
  statsBar.style.borderBottom = '1px solid rgba(255,255,255,0.06)';
  statsBar.style.paddingBottom = 'var(--space-3)';

  const scoreVal = el('span', '', '');
  scoreVal.style.fontWeight = '700';
  scoreVal.style.color = _quizState.mode === 'blitz' ? 'var(--cyan)' : 'var(--purple)';

  const streakVal = el('span', '', '');
  streakVal.style.fontWeight = '700';
  streakVal.style.color = 'var(--purple)';

  const livesVal = el('span', '', '');

  statsBar.appendChild(scoreVal);
  statsBar.appendChild(streakVal);
  statsBar.appendChild(livesVal);
  card.appendChild(statsBar);

  // Timer Bar Wrapper (Only for Blitz)
  const timerTrack = el('div', '');
  timerTrack.style.width = '100%';
  timerTrack.style.height = '4px';
  timerTrack.style.background = 'rgba(255,255,255,0.05)';
  timerTrack.style.borderRadius = '2px';
  timerTrack.style.overflow = 'hidden';
  timerTrack.style.display = _quizState.mode === 'blitz' ? 'block' : 'none';

  const timerBar = el('div', '');
  timerBar.style.width = '100%';
  timerBar.style.height = '100%';
  timerBar.style.background = 'var(--cyan)';
  timerBar.style.transition = 'width 1s linear';
  timerTrack.appendChild(timerBar);
  card.appendChild(timerTrack);

  // Canvas Drawing Frame
  const canvas = document.createElement('canvas');
  canvas.width = 600;
  canvas.height = 220;
  canvas.style.width = '100%';
  canvas.style.background = '#0d0b0f';
  canvas.style.borderRadius = 'var(--radius-md)';
  canvas.style.border = '1px solid rgba(255,255,255,0.05)';
  card.appendChild(canvas);

  // Power-ups Bar (Only in Blitz)
  const powerupsBar = el('div', 'blitz-powerups-bar');
  powerupsBar.style.display = _quizState.mode === 'blitz' ? 'flex' : 'none';
  card.appendChild(powerupsBar);

  const freezeBtn = el('button', 'blitz-powerup-btn', '❄️ Freeze Time');
  const shieldBtn = el('button', 'blitz-powerup-btn', '🛡️ 50/50 Shield');
  
  powerupsBar.appendChild(freezeBtn);
  powerupsBar.appendChild(shieldBtn);

  // Question Prompt
  const promptText = el('p', 'blitz-prompt', 'Loading scenario...');
  promptText.style.textAlign = 'center';
  promptText.style.fontSize = 'var(--text-sm)';
  promptText.style.fontWeight = '600';
  promptText.style.color = '#fff';
  card.appendChild(promptText);

  // Options buttons grid
  const optionsGrid = el('div', 'blitz-options-grid');
  optionsGrid.style.display = 'grid';
  optionsGrid.style.gridTemplateColumns = '1fr';
  optionsGrid.style.gap = 'var(--space-2)';
  card.appendChild(optionsGrid);

  // Detailed Explanation (Zen or post-game review)
  const explanationPanel = el('div', 'blitz-explanation-panel');
  explanationPanel.style.display = 'none';
  card.appendChild(explanationPanel);

  // Next Question Button (Zen mode)
  const nextBtn = el('button', 'btn btn-primary', 'Next Question ➡️');
  nextBtn.style.width = '100%';
  nextBtn.style.display = 'none';
  nextBtn.style.padding = '0.75rem';
  nextBtn.addEventListener('click', () => {
    explanationPanel.style.display = 'none';
    nextBtn.style.display = 'none';
    loadQuestion();
  });
  card.appendChild(nextBtn);

  // Launch first question
  loadQuestion();

  function updateGameStatsUI() {
    const fCount = storage.get('streak_freeze_tokens', 1);
    const sCount = storage.get('shield_tokens', 1);

    if (_quizState.mode === 'blitz') {
      scoreVal.textContent = `Score: ${_quizState.score}`;
      streakVal.textContent = `Streak: 🔥 ${_quizState.winStreak}`;
      
      let hearts = '';
      for (let i = 0; i < 3; i++) {
        hearts += i < _quizState.lives ? '❤️ ' : '🖤 ';
      }
      livesVal.textContent = hearts;

      // Power-up counts inside button labels
      freezeBtn.textContent = `❄️ Freeze Time (${fCount})`;
      freezeBtn.disabled = fCount <= 0 || _quizState.timerFrozen;
      
      shieldBtn.textContent = `🛡️ 50/50 Shield (${sCount})`;
      shieldBtn.disabled = sCount <= 0;
    } else {
      scoreVal.textContent = `🧘 Zen Mode`;
      streakVal.textContent = `Accuracy: ${_quizState.score} Correct`;
      livesVal.textContent = `🎯 Total: ${_quizState.questionHistory.length}`;
    }
  }

  function loadQuestion() {
    updateGameStatsUI();
    if (_quizState.lives <= 0) {
      handleGameOver();
      return;
    }

    _quizState.timerFrozen = false;
    card.style.boxShadow = '';
    freezeBtn.className = 'blitz-powerup-btn';
    
    if (_quizState.mode === 'blitz') {
      _quizState.timeLeft = 10;
      timerBar.style.width = '100%';
      timerBar.style.background = 'var(--cyan)';
    }

    // Pick concept
    let type = 'fvg';
    if (_quizState.mode === 'blitz') {
      const types = ['fvg', 'bos', 'ob', 'judas', 'choch', 'ote', 'liquidity_sweep', 'amd', 'breaker', 'risk_reward', 'pinbar', 'killzone'];
      type = types[Math.floor(Math.random() * types.length)];
    } else {
      // Zen Mode: pick randomly from checked filters
      const filterPool = _quizState.zenFilters;
      type = filterPool[Math.floor(Math.random() * filterPool.length)];
    }

    _quizState.currentQuestion = {
      type: type,
      ...SCENARIO_DETAILS[type]
    };

    // Draw initial state
    drawQuizScenario(type, canvas, false);
    promptText.textContent = _quizState.currentQuestion.prompt;

    // Build options
    optionsGrid.replaceChildren();
    _quizState.currentQuestion.options.forEach(opt => {
      const btn = el('button', 'btn btn-outline', opt);
      btn.style.padding = '0.75rem var(--space-4)';
      btn.style.fontSize = 'var(--text-xs)';
      btn.style.fontWeight = '600';
      btn.style.textAlign = 'left';
      btn.style.border = '1px solid rgba(255,255,255,0.06)';
      btn.style.background = 'rgba(255,255,255,0.01)';
      
      btn.addEventListener('click', () => {
        handleAnswer(opt, btn);
      });
      optionsGrid.appendChild(btn);
    });

    // Handle timer for Blitz
    if (_quizState.mode === 'blitz') {
      if (_quizState.timerInterval) clearInterval(_quizState.timerInterval);
      _quizState.timerInterval = setInterval(() => {
        if (!isPageActive(container)) {
          clearInterval(_quizState.timerInterval);
          return;
        }

        if (_quizState.timerFrozen) return; // Frozen!

        _quizState.timeLeft--;
        const pct = (_quizState.timeLeft / 10) * 100;
        timerBar.style.width = `${pct}%`;
        
        if (_quizState.timeLeft <= 3) {
          timerBar.style.background = 'var(--neon-red)';
        }

        if (_quizState.timeLeft <= 0) {
          clearInterval(_quizState.timerInterval);
          handleTimeout();
        }
      }, 1000);
    }
  }

  // --- POWER-UPS LOGIC HANDLERS ---
  freezeBtn.addEventListener('click', () => {
    const fCount = storage.get('streak_freeze_tokens', 1);
    if (fCount > 0 && !_quizState.timerFrozen && _quizState.mode === 'blitz') {
      storage.set('streak_freeze_tokens', fCount - 1);
      _quizState.timerFrozen = true;
      
      playSynthSound('click');
      nativeHaptic('light');
      showNotificationToast('Time Frozen! ❄️', '❄️');

      // Update UI
      timerBar.style.width = '100%';
      timerBar.style.background = '#00d4ff';
      freezeBtn.className = 'blitz-powerup-btn freeze-active';
      card.style.boxShadow = '0 0 25px rgba(0, 212, 255, 0.15)';
      
      updateGameStatsUI();
    }
  });

  shieldBtn.addEventListener('click', () => {
    const sCount = storage.get('shield_tokens', 1);
    if (sCount > 0 && _quizState.mode === 'blitz') {
      storage.set('shield_tokens', sCount - 1);
      
      playSynthSound('click');
      nativeHaptic('light');
      showNotificationToast('50/50 Shield Activated! 🛡️', '🛡️');

      // Eliminate 2 wrong choices
      const btns = Array.from(optionsGrid.querySelectorAll('button'));
      const correctText = _quizState.currentQuestion.correct;
      
      const wrongBtns = btns.filter(b => b.textContent !== correctText);
      // Randomly pick 2 to disable
      for (let i = 0; i < 2 && wrongBtns.length > 0; i++) {
        const idx = Math.floor(Math.random() * wrongBtns.length);
        const removedBtn = wrongBtns.splice(idx, 1)[0];
        removedBtn.disabled = true;
        removedBtn.style.opacity = '0.25';
        removedBtn.style.textDecoration = 'line-through';
        removedBtn.style.background = 'rgba(0,0,0,0.4)';
      }

      updateGameStatsUI();
    }
  });

  function handleAnswer(selected, buttonElement) {
    if (_quizState.mode === 'blitz' && _quizState.timerInterval) {
      clearInterval(_quizState.timerInterval);
    }
    
    // Disable all options
    const btns = optionsGrid.querySelectorAll('button');
    btns.forEach(b => b.disabled = true);

    const correct = _quizState.currentQuestion.correct;
    const isCorrect = (selected === correct);

    // Save history
    _quizState.questionHistory.push({
      type: _quizState.currentQuestion.type,
      correct: isCorrect
    });

    // Update Mastery Stats in LocalStorage
    const masteryStats = storage.get('blitz_mastery_stats', {});
    const conceptKey = _quizState.currentQuestion.type;
    if (!masteryStats[conceptKey]) {
      masteryStats[conceptKey] = { attempts: 0, correct: 0 };
    }
    masteryStats[conceptKey].attempts++;
    if (isCorrect) {
      masteryStats[conceptKey].correct++;
    }
    storage.set('blitz_mastery_stats', masteryStats);

    // Draw graph overlays/highlights
    drawQuizScenario(_quizState.currentQuestion.type, canvas, true);

    if (isCorrect) {
      buttonElement.style.background = 'var(--neon-green-bg)';
      buttonElement.style.color = 'var(--neon-green)';
      buttonElement.style.borderColor = 'rgba(0, 255, 136, 0.4)';
      
      _quizState.score++;
      _quizState.winStreak++;
      
      playSynthSound('success');
      nativeHaptic('light');

      // Win streak token awards
      if (_quizState.mode === 'blitz') {
        if (_quizState.winStreak === 5) {
          const tokens = storage.get('streak_freeze_tokens', 1);
          if (tokens < 3) {
            storage.set('streak_freeze_tokens', tokens + 1);
            showNotificationToast('🔥 5 Streak! Earned 1 Freeze Token! ❄️', '❄️');
            playSynthSound('fanfare');
          } else {
            showNotificationToast('🔥 5 Streak! Freeze capacity full.', '✨');
          }
        } else if (_quizState.winStreak === 10) {
          const tokens = storage.get('shield_tokens', 1);
          if (tokens < 3) {
            storage.set('shield_tokens', tokens + 1);
            showNotificationToast('🔥 10 Streak! Earned 1 Shield Token! 🛡️', '🛡️');
            playSynthSound('fanfare');
          } else {
            showNotificationToast('🔥 10 Streak! Shield capacity full.', '✨');
          }
        }
      }

      if (_quizState.mode === 'blitz') {
        setTimeout(loadQuestion, 1600);
      } else {
        // Zen mode displays the description panel and next button
        showZenExplanation();
      }
    } else {
      buttonElement.style.background = 'var(--neon-red-bg)';
      buttonElement.style.color = 'var(--neon-red)';
      buttonElement.style.borderColor = 'rgba(255, 71, 87, 0.4)';

      // Highlight correct option
      btns.forEach(b => {
        if (b.textContent === correct) {
          b.style.background = 'var(--neon-green-bg)';
          b.style.color = 'var(--neon-green)';
          b.style.borderColor = 'rgba(0, 255, 136, 0.4)';
        }
      });

      _quizState.lives--;
      _quizState.winStreak = 0;
      
      playSynthSound('fail');
      nativeHapticNotification('ERROR');

      if (_quizState.mode === 'blitz') {
        setTimeout(loadQuestion, 2000);
      } else {
        showZenExplanation();
      }
    }
  }

  function handleTimeout() {
    const btns = optionsGrid.querySelectorAll('button');
    btns.forEach(b => b.disabled = true);

    const correct = _quizState.currentQuestion.correct;
    btns.forEach(b => {
      if (b.textContent === correct) {
        b.style.background = 'var(--neon-green-bg)';
        b.style.color = 'var(--neon-green)';
        b.style.borderColor = 'rgba(0, 255, 136, 0.4)';
      }
    });

    _quizState.lives--;
    _quizState.winStreak = 0;
    
    // Save timeout in stats as attempt
    const masteryStats = storage.get('blitz_mastery_stats', {});
    const conceptKey = _quizState.currentQuestion.type;
    masteryStats[conceptKey].attempts++;
    storage.set('blitz_mastery_stats', masteryStats);

    drawQuizScenario(_quizState.currentQuestion.type, canvas, true);

    playSynthSound('fail');
    nativeHapticNotification('WARNING');
    showNotificationToast('Time expired! ⏱️');

    setTimeout(loadQuestion, 2000);
  }

  function showZenExplanation() {
    explanationPanel.replaceChildren();
    
    const title = el('h4', '');
    title.style.margin = '0 0 6px 0';
    title.style.color = 'var(--purple)';
    title.textContent = `💡 Concept Guide: ${_quizState.currentQuestion.title}`;
    
    const p = el('p', '');
    p.style.margin = '0';
    p.style.fontSize = 'var(--text-xs)';
    p.style.lineHeight = '1.4';
    p.style.opacity = '0.9';
    p.textContent = _quizState.currentQuestion.explanation;

    explanationPanel.appendChild(title);
    explanationPanel.appendChild(p);
    explanationPanel.style.display = 'block';

    nextBtn.style.display = 'block';
    updateGameStatsUI();
  }

  function handleGameOver() {
    if (_quizState.timerInterval) clearInterval(_quizState.timerInterval);

    optionsGrid.replaceChildren();
    explanationPanel.style.display = 'none';
    nextBtn.style.display = 'none';

    promptText.textContent = `❌ Game Over! You recognized ${_quizState.score} chart patterns!`;
    
    // High Score logic
    const oldHigh = storage.get('blitz_high_score', 0);
    let newHighText = '';
    if (_quizState.score > oldHigh) {
      storage.set('blitz_high_score', _quizState.score);
      newHighText = ' 🏆 NEW PERSONAL RECORD!';
      playSynthSound('fanfare');
    }

    const gameStatsPanel = el('div', '');
    gameStatsPanel.style.textAlign = 'center';
    gameStatsPanel.style.fontSize = 'var(--text-xs)';
    gameStatsPanel.style.color = 'rgba(255,255,255,0.7)';
    gameStatsPanel.style.margin = 'var(--space-2) 0';
    
    const earnedXP = _quizState.score * 5;
    const bonusXP = _quizState.score >= 5 ? 25 : 0;
    const totalXP = earnedXP + bonusXP;
    
    if (totalXP > 0) {
      addXP('practice', totalXP);
      gameStatsPanel.textContent = `Earned +${totalXP} XP (+${earnedXP} Base, +${bonusXP} Bonus XP).${newHighText}`;
    } else {
      gameStatsPanel.textContent = `Keep practicing to earn XP!${newHighText}`;
    }
    optionsGrid.appendChild(gameStatsPanel);

    const restartBtn = el('button', 'btn btn-primary', '🔄 Play Again');
    restartBtn.style.padding = '0.75rem';
    restartBtn.style.marginTop = 'var(--space-2)';
    restartBtn.addEventListener('click', () => {
      startBlitzGame(container);
    });
    optionsGrid.appendChild(restartBtn);
  }

  // Safe disconnection of MutationObserver
  const observer = new MutationObserver(() => {
    if (!isPageActive(container)) {
      if (_quizState.timerInterval) clearInterval(_quizState.timerInterval);
      observer.disconnect();
    }
  });
  observer.observe(container, { attributes: true, attributeFilter: ['style'] });
}

function isPageActive(container) {
  return container && container.style.display !== 'none';
}

// --- Dynamic Canvas SMC Chart Drawer ---
export function drawQuizScenario(type, canvas, highlightAnswer = false) {
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Background and Grid
  ctx.fillStyle = '#0d0b0f';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // Subtle grid lines
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.02)';
  ctx.lineWidth = 1;
  for (let x = 50; x < canvas.width; x += 50) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }
  for (let y = 30; y < canvas.height; y += 30) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }

  // Draw Candlestick helper
  const drawCandle = (x, open, high, low, close, width = 16) => {
    const isGreen = close <= open; // On canvas, smaller Y is higher price (bullish)
    const color = isGreen ? '#39ff14' : '#ff3b3b';
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 1.5;

    // Wick
    ctx.beginPath();
    ctx.moveTo(x, high);
    ctx.lineTo(x, low);
    ctx.stroke();

    // Body
    const bodyHeight = Math.max(2, Math.abs(open - close));
    ctx.fillRect(x - width / 2, Math.min(open, close), width, bodyHeight);
  };

  const scenario = SCENARIO_DETAILS[type];
  if (!scenario) return null;

  switch (type) {
    case 'fvg': {
      const c1Low = 80;
      const c3High = 120;

      // Shaded imbalance corridor
      ctx.fillStyle = 'rgba(0, 212, 255, 0.05)';
      ctx.fillRect(50, c1Low, 350, c3High - c1Low);
      ctx.strokeStyle = 'rgba(0, 212, 255, 0.25)';
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(50, c1Low, 350, c3High - c1Low);
      ctx.setLineDash([]);

      // Draw candles
      drawCandle(100, 60, 50, c1Low, 75); // Candle 1 (Bearish)
      drawCandle(200, 75, 70, 140, 135); // Candle 2 (Large drop displacement)
      drawCandle(300, 135, c3High, 160, 150); // Candle 3 (Bearish)

      ctx.fillStyle = '#00d4ff';
      ctx.font = 'bold 9px sans-serif';
      ctx.fillText('⚡ Imbalance Corridor (FVG)', 60, c1Low + 15);

      if (highlightAnswer) {
        ctx.strokeStyle = '#00d4ff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(330, c1Low);
        ctx.lineTo(350, c1Low);
        ctx.moveTo(340, c1Low);
        ctx.lineTo(340, c3High);
        ctx.moveTo(330, c3High);
        ctx.lineTo(350, c3High);
        ctx.stroke();
        
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 10px sans-serif';
        ctx.fillText('👈 FVG: Gap between Candle 1 low and Candle 3 high', 70, 103);
      }
      break;
    }
    
    case 'bos': {
      // Dotted breakpoint line
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(100, 140);
      ctx.lineTo(450, 140);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.font = 'bold 9px sans-serif';
      ctx.fillText('🔑 Structural Breakpoint Line', 220, 134);

      // Candles
      drawCandle(100, 100, 80, 140, 130); // Swing low
      drawCandle(180, 130, 110, 135, 115); // Pullback
      drawCandle(260, 115, 110, 125, 122); // Pullback high
      drawCandle(340, 122, 120, 160, 155); // Breaches structural line (BOS)
      drawCandle(420, 155, 150, 180, 175); // Continuation

      if (highlightAnswer) {
        ctx.strokeStyle = '#39ff14';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(340, 148, 15, 0, 2 * Math.PI);
        ctx.stroke();
        ctx.fillStyle = '#39ff14';
        ctx.font = 'bold 11px sans-serif';
        ctx.fillText('🔥 BOS: Structural Trend Continuation Breach!', 170, 200);
      }
      break;
    }

    case 'ob': {
      // Shaded OB box
      ctx.fillStyle = 'rgba(57, 255, 20, 0.05)';
      ctx.fillRect(80, 95, 280, 60);
      ctx.strokeStyle = 'rgba(57, 255, 20, 0.3)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([3, 3]);
      ctx.strokeRect(80, 95, 280, 60);
      ctx.setLineDash([]);

      ctx.fillStyle = '#39ff14';
      ctx.font = 'bold 9px sans-serif';
      ctx.fillText('🛡️ Institutional demand volume block', 90, 110);

      // Candles
      drawCandle(100, 110, 95, 160, 150); // Down candle (Order Block)
      drawCandle(180, 150, 120, 155, 125); // Large up displacement
      drawCandle(260, 125, 80, 130, 85); // Continuation
      drawCandle(340, 85, 60, 90, 65);

      if (highlightAnswer) {
        ctx.strokeStyle = '#39ff14';
        ctx.lineWidth = 2;
        ctx.strokeRect(80, 95, 280, 60);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 11px sans-serif';
        ctx.fillText('👈 Last down-closed candle before bullish expansion', 110, 140);
      }
      break;
    }

    case 'judas': {
      // Asian Range Box
      ctx.fillStyle = 'rgba(255, 255, 255, 0.02)';
      ctx.fillRect(80, 100, 360, 40);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.strokeRect(80, 100, 360, 40);

      ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.font = '8px sans-serif';
      ctx.fillText('Asian Consolidation Range', 90, 115);

      // Candles
      drawCandle(120, 120, 115, 125, 120);
      drawCandle(180, 120, 118, 123, 119);
      drawCandle(240, 120, 70, 125, 85); // Spike high above consolidation (Judas!)
      drawCandle(300, 85, 80, 160, 155); // Severe engulfing down
      drawCandle(360, 155, 140, 180, 175);
      drawCandle(420, 175, 160, 200, 195);

      if (highlightAnswer) {
        ctx.strokeStyle = '#ff3b3b';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(240, 45);
        ctx.lineTo(240, 65);
        ctx.lineTo(235, 60);
        ctx.moveTo(240, 65);
        ctx.lineTo(245, 60);
        ctx.stroke();

        ctx.fillStyle = '#ff3b3b';
        ctx.font = 'bold 10px sans-serif';
        ctx.fillText('🛑 Judas Swing: False break sweeps Asian highs', 180, 35);
      }
      break;
    }

    case 'choch': {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(150, 100);
      ctx.lineTo(400, 100);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.font = 'bold 8px sans-serif';
      ctx.fillText('Recent Swing High Level', 170, 94);

      // Down swing
      drawCandle(100, 130, 120, 175, 170); // Bearish
      drawCandle(180, 170, 100, 170, 110); // Swing High pullback
      drawCandle(260, 110, 105, 190, 180); // Lower low
      drawCandle(340, 180, 80, 185, 85);  // Massive up break (CHoCH)
      drawCandle(420, 85, 80, 105, 95);   // Bullish retest

      if (highlightAnswer) {
        ctx.strokeStyle = '#a855f7';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(340, 100, 15, 0, 2 * Math.PI);
        ctx.stroke();
        ctx.fillStyle = '#a855f7';
        ctx.font = 'bold 10px sans-serif';
        ctx.fillText('🔮 CHoCH: Shift in trend direction!', 240, 195);
      }
      break;
    }

    case 'ote': {
      const lowY = 180;
      const highY = 60;
      const h = lowY - highY;
      const fib62 = highY + h * 0.618;
      const fib79 = highY + h * 0.786;

      // Shade OTE Zone
      ctx.fillStyle = 'rgba(255, 179, 0, 0.08)';
      ctx.fillRect(50, fib62, 450, fib79 - fib62);

      // Draw lines
      ctx.strokeStyle = 'rgba(255, 179, 0, 0.4)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(50, fib62); ctx.lineTo(500, fib62);
      ctx.moveTo(50, fib79); ctx.lineTo(500, fib79);
      ctx.stroke();

      ctx.fillStyle = '#ffb300';
      ctx.font = '8px sans-serif';
      ctx.fillText('0.618 Fib (62%)', 420, fib62 - 4);
      ctx.fillText('0.786 Fib (79%)', 420, fib79 + 8);

      // Candles
      drawCandle(100, 180, 130, 180, 140);
      drawCandle(180, 140, 95, 145, 100);
      drawCandle(260, 100, 50, 110, 60);
      drawCandle(340, 60, 55, 115, 110);
      drawCandle(420, 110, 105, 150, 142); // Tapped OTE Zone (Low Y=150 is between 134 and 154)
      drawCandle(480, 142, 85, 145, 90);   // Rebound

      if (highlightAnswer) {
        ctx.strokeStyle = '#ffb300';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(50, fib62, 450, fib79 - fib62);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 10px sans-serif';
        ctx.fillText('🔥 Optimal Trade Entry tapped! (62%-79% Retracement)', 80, 205);
      }
      break;
    }

    case 'liquidity_sweep': {
      const supportY = 150;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(80, supportY);
      ctx.lineTo(440, supportY);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.font = 'bold 8px sans-serif';
      ctx.fillText('Retail Support (Equal Lows)', 90, supportY - 6);

      // Candles
      drawCandle(120, 110, 105, supportY, 130);
      drawCandle(200, 130, 125, supportY, 140);
      drawCandle(280, 140, 120, 190, 135); // Sweeper Wick
      drawCandle(360, 135, 80, 140, 85);

      if (highlightAnswer) {
        ctx.strokeStyle = '#ff3b3b';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(280, 170, 18, 0, 2 * Math.PI);
        ctx.stroke();
        ctx.fillStyle = '#ff3b3b';
        ctx.font = 'bold 11px sans-serif';
        ctx.fillText('🎯 Sweep: Stop losses below support hunted!', 140, 210);
      }
      break;
    }

    case 'amd': {
      // Accumulation Box
      ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
      ctx.fillRect(40, 100, 180, 40);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.strokeRect(40, 100, 180, 40);

      // Candles
      drawCandle(60, 120, 115, 125, 120);
      drawCandle(110, 120, 118, 123, 119);
      drawCandle(160, 119, 115, 124, 121);
      
      // Manipulation spike
      drawCandle(240, 121, 110, 185, 130);
      
      // Distribution
      drawCandle(320, 130, 80, 135, 85);
      drawCandle(380, 85, 55, 90, 60);
      drawCandle(440, 60, 45, 65, 50);

      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.font = 'bold 8px sans-serif';
      ctx.fillText('Accumulation', 90, 155);
      ctx.fillText('Manipulation', 210, 195);
      ctx.fillText('Distribution', 370, 45);

      if (highlightAnswer) {
        ctx.strokeStyle = '#39ff14';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(150, 120);
        ctx.lineTo(240, 150);
        ctx.lineTo(380, 75);
        ctx.stroke();
        
        ctx.fillStyle = '#39ff14';
        ctx.font = 'bold 11px sans-serif';
        ctx.fillText('💎 AMD: Smart Money Accumulates ➔ Manipulates ➔ Distributes!', 50, 212);
      }
      break;
    }

    case 'breaker': {
      // Breaker box
      ctx.fillStyle = 'rgba(255, 122, 0, 0.05)';
      ctx.fillRect(80, 120, 420, 35);
      ctx.strokeStyle = 'rgba(255, 122, 0, 0.2)';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.strokeRect(80, 120, 420, 35);
      ctx.setLineDash([]);

      ctx.fillStyle = '#ff7a00';
      ctx.font = 'bold 8px sans-serif';
      ctx.fillText('Breaker Block Level (Failed Bullish OB)', 90, 115);

      // Candles
      drawCandle(100, 135, 120, 155, 150); // Down candle (Bullish OB)
      drawCandle(180, 150, 100, 155, 105); // Up impulse
      drawCandle(260, 105, 90, 195, 190);  // Crashes past OB low
      drawCandle(340, 190, 130, 195, 135); // Retest breaker block level Y=135
      drawCandle(420, 135, 135, 215, 210); // Rejects and tanks

      if (highlightAnswer) {
        ctx.strokeStyle = '#ff7a00';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(340, 135, 15, 0, 2 * Math.PI);
        ctx.stroke();
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 10px sans-serif';
        ctx.fillText('🛑 Failed Bullish OB blocks price from above. Breaker retest!', 100, 205);
      }
      break;
    }

    case 'risk_reward': {
      // Green target box
      ctx.fillStyle = 'rgba(57, 255, 20, 0.07)';
      ctx.fillRect(150, 40, 300, 80);
      ctx.strokeStyle = 'rgba(57, 255, 20, 0.3)';
      ctx.strokeRect(150, 40, 300, 80);

      // Red risk box
      ctx.fillStyle = 'rgba(255, 59, 59, 0.07)';
      ctx.fillRect(150, 120, 300, 27);
      ctx.strokeStyle = 'rgba(255, 59, 59, 0.3)';
      ctx.strokeRect(150, 120, 300, 27);

      // Line bounds
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(150, 40); ctx.lineTo(450, 40); ctx.stroke(); // TP
      ctx.beginPath(); ctx.moveTo(150, 120); ctx.lineTo(450, 120); ctx.stroke(); // Entry
      ctx.beginPath(); ctx.moveTo(150, 147); ctx.lineTo(450, 147); ctx.stroke(); // SL

      ctx.fillStyle = '#39ff14';
      ctx.font = 'bold 10px sans-serif';
      ctx.fillText('🎯 TAKE PROFIT (TP): 30 Pips', 160, 55);

      ctx.fillStyle = '#fff';
      ctx.font = 'bold 10px sans-serif';
      ctx.fillText('⚡ ENTRY: 1.2000', 160, 115);

      ctx.fillStyle = '#ff3b3b';
      ctx.font = 'bold 10px sans-serif';
      ctx.fillText('🛑 STOP LOSS (SL): 10 Pips', 160, 140);

      if (highlightAnswer) {
        ctx.strokeStyle = '#39ff14';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(465, 40); ctx.lineTo(475, 40);
        ctx.moveTo(470, 40); ctx.lineTo(470, 147);
        ctx.moveTo(465, 147); ctx.lineTo(475, 147);
        ctx.stroke();

        ctx.fillStyle = '#fff';
        ctx.font = 'bold 11px sans-serif';
        ctx.fillText('30 pips TP / 10 pips SL = 3.0 Risk-Reward Ratio (1:3 RR)', 120, 195);
      }
      break;
    }

    case 'pinbar': {
      const supY = 160;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(100, supY);
      ctx.lineTo(500, supY);
      ctx.stroke();

      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.font = 'bold 8px sans-serif';
      ctx.fillText('Key Support Zone', 120, supY - 6);

      // Pin Bar
      ctx.strokeStyle = '#39ff14';
      ctx.fillStyle = '#39ff14';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(300, 70);
      ctx.lineTo(300, 210);
      ctx.stroke();
      ctx.fillRect(300 - 10, 80, 20, 15);

      if (highlightAnswer) {
        ctx.strokeStyle = '#39ff14';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.ellipse(300, 160, 15, 50, 0, 0, 2 * Math.PI);
        ctx.stroke();
        
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 11px sans-serif';
        ctx.fillText('👉 Long wick sweeps below support, closing high = Bullish rejection!', 120, 45);
      }
      break;
    }

    case 'killzone': {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(50, 130);
      ctx.lineTo(550, 130);
      ctx.stroke();

      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.font = '8px sans-serif';
      const hours = ['0:00', '4:00', '8:00', '12:00', '16:00', '20:00', '24:00'];
      hours.forEach((hStr, i) => {
        const xVal = 50 + i * (500 / 6);
        ctx.beginPath();
        ctx.moveTo(xVal, 125);
        ctx.lineTo(xVal, 135);
        ctx.stroke();
        ctx.fillText(hStr, xVal - 10, 148);
      });

      const startX = 50 + (2 / 24) * 500;
      const endX = 50 + (5 / 24) * 500;
      
      ctx.fillStyle = 'rgba(0, 212, 255, 0.1)';
      ctx.fillRect(startX, 80, endX - startX, 48);
      ctx.strokeStyle = 'rgba(0, 212, 255, 0.4)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(startX, 80, endX - startX, 48);

      ctx.fillStyle = '#00d4ff';
      ctx.font = 'bold 9px sans-serif';
      ctx.fillText('⏰ Active window (2 AM - 5 AM NY)', startX, 72);

      if (highlightAnswer) {
        ctx.strokeStyle = '#00d4ff';
        ctx.lineWidth = 2;
        ctx.strokeRect(startX, 80, endX - startX, 48);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 11px sans-serif';
        ctx.fillText('London Killzone window: sweeps Asian range and forms daily trends!', 80, 205);
      }
      break;
    }
  }

  return scenario;
}
