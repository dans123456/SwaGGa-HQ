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
  timeLeft: 10
};

function el(tag, cls = '', text = '') {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text) node.textContent = text;
  return node;
}

export function renderBlitzPage(container) {
  container.replaceChildren();

  // Reset quiz state on page load
  resetQuiz();

  // Header Title
  const header = el('div', 'page-header');
  header.appendChild(el('h1', 'page-title', '⚡ SMC Blitz: Speed Recognition Trainer'));
  container.appendChild(header);

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

  // Stats Bar (Score, Lives, Streak)
  const statsBar = el('div', 'blitz-stats-bar');
  statsBar.style.display = 'flex';
  statsBar.style.justifyContent = 'space-between';
  statsBar.style.alignItems = 'center';
  statsBar.style.borderBottom = '1px solid rgba(255,255,255,0.06)';
  statsBar.style.paddingBottom = 'var(--space-3)';
  
  const scoreVal = el('span', '', 'Score: 0');
  scoreVal.style.fontWeight = '700';
  scoreVal.style.color = 'var(--cyan)';
  
  const streakVal = el('span', '', 'Streak: 🔥 0');
  streakVal.style.fontWeight = '700';
  streakVal.style.color = 'var(--purple)';

  const livesVal = el('span', '', '❤️ ❤️ ❤️');
  
  statsBar.appendChild(scoreVal);
  statsBar.appendChild(streakVal);
  statsBar.appendChild(livesVal);
  card.appendChild(statsBar);

  // Timer Bar Wrapper
  const timerTrack = el('div', '');
  timerTrack.style.width = '100%';
  timerTrack.style.height = '4px';
  timerTrack.style.background = 'rgba(255,255,255,0.05)';
  timerTrack.style.borderRadius = '2px';
  timerTrack.style.overflow = 'hidden';

  const timerBar = el('div', '');
  timerBar.style.width = '100%';
  timerBar.style.height = '100%';
  timerBar.style.background = 'var(--cyan)';
  timerBar.style.transition = 'width 1s linear';
  timerTrack.appendChild(timerBar);
  card.appendChild(timerTrack);

  // Canvas Drawing
  const canvas = document.createElement('canvas');
  canvas.width = 600;
  canvas.height = 220;
  canvas.style.width = '100%';
  canvas.style.background = 'rgba(13, 11, 15, 0.4)';
  canvas.style.borderRadius = 'var(--radius-md)';
  canvas.style.border = '1px solid rgba(255,255,255,0.05)';
  card.appendChild(canvas);

  // Question Prompt
  const promptText = el('p', 'blitz-prompt', 'Question Loading...');
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

  // Start the first question
  loadQuestion();

  function resetQuiz() {
    _quizState.score = 0;
    _quizState.lives = 3;
    _quizState.winStreak = 0;
    _quizState.timeLeft = 10;
    if (_quizState.timerInterval) clearInterval(_quizState.timerInterval);
  }

  function updateStatsUI() {
    scoreVal.textContent = `Score: ${_quizState.score}`;
    streakVal.textContent = `Streak: 🔥 ${_quizState.winStreak}`;
    
    // Lives Hearts
    let hearts = '';
    for (let i = 0; i < 3; i++) {
      hearts += i < _quizState.lives ? '❤️ ' : '🖤 ';
    }
    livesVal.textContent = hearts;
  }

  function loadQuestion() {
    updateStatsUI();
    if (_quizState.lives <= 0) {
      handleGameOver();
      return;
    }

    _quizState.timeLeft = 10;
    timerBar.style.width = '100%';
    timerBar.style.background = 'var(--cyan)';

    // Pick a random question generator
    const types = ['fvg', 'bos', 'ob', 'judas'];
    const type = types[Math.floor(Math.random() * types.length)];
    
    _quizState.currentQuestion = generateQuizScenario(type, canvas);
    promptText.textContent = _quizState.currentQuestion.prompt;

    // Build Option buttons
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

    // Start Timer
    if (_quizState.timerInterval) clearInterval(_quizState.timerInterval);
    _quizState.timerInterval = setInterval(() => {
      if (!isPageActive(container)) {
        clearInterval(_quizState.timerInterval);
        return;
      }

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

  function handleAnswer(selected, buttonElement) {
    if (_quizState.timerInterval) clearInterval(_quizState.timerInterval);
    
    // Disable all options
    const btns = optionsGrid.querySelectorAll('button');
    btns.forEach(b => b.disabled = true);

    const correct = _quizState.currentQuestion.correct;
    if (selected === correct) {
      // Correct!
      buttonElement.style.background = 'var(--neon-green-bg)';
      buttonElement.style.color = 'var(--neon-green)';
      buttonElement.style.borderColor = 'rgba(0, 255, 136, 0.4)';
      
      _quizState.score++;
      _quizState.winStreak++;
      
      playSynthSound('success');
      nativeHaptic('light');

      // Check freeze token milestone (5 streak)
      if (_quizState.winStreak === 5) {
        const tokens = storage.get('streak_freeze_tokens', 0);
        if (tokens < 3) {
          storage.set('streak_freeze_tokens', tokens + 1);
          showNotificationToast('🔥 5 Streak! Earned 1 Freeze Token! ❄️', '❄️');
        } else {
          showNotificationToast('🔥 5 Streak! Freeze tokens are at max capacity.', '✨');
        }
      }

      setTimeout(loadQuestion, 1500);
    } else {
      // Wrong!
      buttonElement.style.background = 'var(--neon-red-bg)';
      buttonElement.style.color = 'var(--neon-red)';
      buttonElement.style.borderColor = 'rgba(255, 71, 87, 0.4)';

      // Find and highlight correct button
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

      setTimeout(loadQuestion, 1800);
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
    
    playSynthSound('fail');
    nativeHapticNotification('WARNING');
    showNotificationToast('Time expired! ⏱️');

    setTimeout(loadQuestion, 1800);
  }

  function handleGameOver() {
    if (_quizState.timerInterval) clearInterval(_quizState.timerInterval);

    optionsGrid.replaceChildren();
    promptText.textContent = `❌ Game Over! You completed ${_quizState.score} challenge challenge challenges.`;
    
    // Award XP
    const earnedXP = _quizState.score * 5; // 5 XP per correct guess
    const bonusXP = _quizState.score >= 5 ? 25 : 0;
    const totalXP = earnedXP + bonusXP;
    
    if (totalXP > 0) {
      addXP('practice', totalXP);
      showNotificationToast(`Quiz complete! Earned +${totalXP} XP! 🪖⚡`);
    }

    const restartBtn = el('button', 'btn btn-primary', '🔄 Restart Trainer');
    restartBtn.style.padding = '0.75rem';
    restartBtn.style.marginTop = 'var(--space-3)';
    restartBtn.addEventListener('click', () => {
      resetQuiz();
      loadQuestion();
    });
    optionsGrid.appendChild(restartBtn);
  }

  // Watch for route hiding to safely clear intervals
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
function generateQuizScenario(type, canvas) {
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const drawCandle = (x, open, high, low, close, width = 24) => {
    const isGreen = close >= open;
    const color = isGreen ? '#39ff14' : '#ff3b3b';
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 2;

    // Wick
    ctx.beginPath();
    ctx.moveTo(x, high);
    ctx.lineTo(x, low);
    ctx.stroke();

    // Body
    const bodyHeight = Math.max(2, Math.abs(open - close));
    ctx.fillRect(x - width / 2, Math.min(open, close), width, bodyHeight);
  };

  if (type === 'fvg') {
    const c1Low = 80;
    const c3High = 120;

    // Draw grid guide
    ctx.fillStyle = 'rgba(0, 212, 255, 0.04)';
    ctx.fillRect(50, c1Low, 350, c3High - c1Low);
    ctx.strokeStyle = 'rgba(0, 212, 255, 0.3)';
    ctx.setLineDash([4, 4]);
    ctx.strokeRect(50, c1Low, 350, c3High - c1Low);
    ctx.setLineDash([]);

    // Label FVG zone
    ctx.fillStyle = '#00d4ff';
    ctx.font = 'bold 9px var(--font-heading), sans-serif';
    ctx.fillText('⚡ Pattern Inefficient Corridor', 60, c1Low + 15);

    // Draw candles
    drawCandle(100, 60, 50, c1Low, 75); // Candle 1
    drawCandle(200, 75, 70, 140, 135); // Candle 2 (Large drop)
    drawCandle(300, 135, c3High, 160, 150); // Candle 3

    return {
      prompt: 'A large institutional displacement candle created the gap highlighted in blue. What is this concept?',
      options: [
        'A) Fair Value Gap (FVG)',
        'B) Liquidity Pool Sweep',
        'C) Bearish Order Block Mitigation',
        'D) Support / Resistance Breakout'
      ],
      correct: 'A) Fair Value Gap (FVG)'
    };
  } else if (type === 'bos') {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(100, 140);
    ctx.lineTo(450, 140);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 8px var(--font-heading), sans-serif';
    ctx.fillText('🔑 Structural Breakpoint Line', 220, 134);

    // Draw candles showing drop, pullback, then breach
    drawCandle(100, 100, 80, 140, 130); // Swing low
    drawCandle(180, 130, 110, 135, 115); // Pullback up
    drawCandle(260, 115, 110, 125, 122); // Pullback high
    drawCandle(340, 122, 120, 160, 155); // Breaches structural line (BOS)
    drawCandle(420, 155, 150, 180, 175); // Continues drop

    return {
      prompt: 'Price breaches the previous structural swing low (dotted line), indicating trend continuation. What is this shift called?',
      options: [
        'A) Change of Character (CHoCH)',
        'B) Break of Structure (BOS)',
        'C) Bearish Supply Mitigation',
        'D) Double Bottom Liquidity Pool'
      ],
      correct: 'B) Break of Structure (BOS)'
    };
  } else if (type === 'ob') {
    ctx.fillStyle = 'rgba(57, 255, 20, 0.05)';
    ctx.fillRect(80, 95, 280, 60);
    ctx.strokeStyle = '#39ff14';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([3, 3]);
    ctx.strokeRect(80, 95, 280, 60);
    ctx.setLineDash([]);

    ctx.fillStyle = '#39ff14';
    ctx.font = 'bold 9px var(--font-heading), sans-serif';
    ctx.fillText('🛡️ Institutional buy volume block', 90, 110);

    // Candles
    drawCandle(100, 110, 95, 160, 150); // Down candle (Order block)
    drawCandle(180, 150, 120, 155, 125); // Large up displacement
    drawCandle(260, 125, 80, 130, 85); // Secondary expansion
    drawCandle(340, 85, 60, 90, 65); // Multi-bar extension

    return {
      prompt: 'The last down-closed candle prior to a rapid upward displacement is covered by the green box. What zone is this?',
      options: [
        'A) Bearish Supply Zone',
        'B) Bullish Order Block (Demand Zone)',
        'C) Liquidity Sweep Area',
        'D) Broken Flip Zone'
      ],
      correct: 'B) Bullish Order Block (Demand Zone)'
    };
  } else {
    ctx.fillStyle = 'rgba(255, 59, 59, 0.03)';
    ctx.fillRect(80, 100, 360, 40); // Asian Range Box
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.strokeRect(80, 100, 360, 40);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.font = '8px var(--font-heading), sans-serif';
    ctx.fillText('Asian Consolidation Range', 90, 115);

    // Judas spike
    drawCandle(160, 120, 115, 125, 120); // Asian Consolidation
    drawCandle(240, 120, 70, 125, 85); // Spike high above consolidation (Judas!)
    drawCandle(320, 85, 80, 160, 155); // Severe rejection engulfing candle (Trigger entry)
    drawCandle(400, 155, 140, 180, 175); // Expansion down

    return {
      prompt: 'During London Open, price runs a false breakout above the Asian high (liquidity sweep) before aggressively reversing short. What is this?',
      options: [
        'A) London Judas Swing',
        'B) Fair Value Gap retracement',
        'C) Bullish Displacement shift',
        'D) Premium-discount equilibrium tap'
      ],
      correct: 'A) London Judas Swing'
    };
  }
}
