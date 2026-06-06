import storage from './storage.js';
import { playSynthSound, startBinauralBeat, stopBinauralBeat, startAmbientDrone, stopAmbientDrone } from './audio.js';
import { nativeHaptic } from './native-bridge.js';

let _activeInterval = null;
let _activeAudioType = 'off'; // 'off', 'alpha', 'theta', 'waves'

function el(tag, cls = '', text = '') {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text) node.textContent = text;
  return node;
}

export function renderMindsetPage(container) {
  container.replaceChildren();

  // Header Title
  const header = el('div', 'page-header');
  header.appendChild(el('h1', 'page-title', '🧘 Mindset & Focus Audio Room'));
  container.appendChild(header);

  // Main columns
  const layout = el('div', 'mindset-layout');
  layout.style.display = 'grid';
  layout.style.gridTemplateColumns = '1fr 340px';
  layout.style.gap = 'var(--space-6)';
  
  // Left Column: Breathing Guide
  const leftCol = el('div', 'mindset-main');
  layout.appendChild(leftCol);

  // Right Column: Ambient Sound Controller
  const rightCol = el('div', 'mindset-sidebar');
  layout.appendChild(rightCol);

  container.appendChild(layout);

  // --- Left Column: Breathing Box Guide ---
  const breathCard = el('div', 'overview-panel glass-card');
  breathCard.style.padding = 'var(--space-8)';
  breathCard.style.display = 'flex';
  breathCard.style.flexDirection = 'column';
  breathCard.style.alignItems = 'center';
  breathCard.style.justifyContent = 'center';
  breathCard.style.minHeight = '360px';
  breathCard.style.position = 'relative';
  
  const breathTitle = el('h2', '', 'Interactive Box Breathing Guide');
  breathTitle.style.fontSize = 'var(--text-sm)';
  breathTitle.style.fontWeight = '800';
  breathTitle.style.textTransform = 'uppercase';
  breathTitle.style.letterSpacing = '0.08em';
  breathTitle.style.color = 'var(--cyan)';
  breathTitle.style.marginBottom = 'var(--space-6)';
  breathCard.appendChild(breathTitle);

  // Circle visualizer
  const circleOuter = el('div', 'breathing-circle-outer');
  circleOuter.style.width = '180px';
  circleOuter.style.height = '180px';
  circleOuter.style.borderRadius = '50%';
  circleOuter.style.border = '2px solid rgba(0, 212, 255, 0.15)';
  circleOuter.style.boxShadow = '0 0 30px rgba(0, 212, 255, 0.05)';
  circleOuter.style.display = 'flex';
  circleOuter.style.alignItems = 'center';
  circleOuter.style.justifyContent = 'center';
  circleOuter.style.transition = 'transform 4s linear, border-color 0.4s, box-shadow 0.4s';
  
  const circleInner = el('div', 'breathing-circle-inner');
  circleInner.style.width = '120px';
  circleInner.style.height = '120px';
  circleInner.style.borderRadius = '50%';
  circleInner.style.background = 'radial-gradient(circle, var(--cyan-bg) 0%, rgba(0, 212, 255, 0.02) 100%)';
  circleInner.style.border = '1px solid var(--cyan)';
  circleInner.style.boxShadow = 'var(--cyan-glow)';
  circleInner.style.display = 'flex';
  circleInner.style.flexDirection = 'column';
  circleInner.style.alignItems = 'center';
  circleInner.style.justifyContent = 'center';
  circleInner.style.transition = 'all 0.4s ease';

  const breathPrompt = el('span', 'breath-prompt', 'READY');
  breathPrompt.style.fontFamily = 'var(--font-heading)';
  breathPrompt.style.fontWeight = '800';
  breathPrompt.style.fontSize = 'var(--text-sm)';
  breathPrompt.style.color = '#fff';
  
  const breathTimer = el('span', 'breath-timer', '—');
  breathTimer.style.fontSize = '10px';
  breathTimer.style.color = 'var(--text-muted)';
  breathTimer.style.marginTop = '4px';

  circleInner.appendChild(breathPrompt);
  circleInner.appendChild(breathTimer);
  circleOuter.appendChild(circleInner);
  breathCard.appendChild(circleOuter);

  // Settings & Start
  const breathControls = el('div', '');
  breathControls.style.display = 'flex';
  breathControls.style.gap = 'var(--space-3)';
  breathControls.style.marginTop = 'var(--space-6)';
  breathControls.style.alignItems = 'center';

  const routineSelect = document.createElement('select');
  routineSelect.className = 'form-select';
  routineSelect.style.width = '180px';
  routineSelect.style.fontSize = 'var(--text-xs)';
  
  const optBox = el('option', '', 'Box Breathing (4-4-4-4)');
  optBox.value = 'box';
  const optRelax = el('option', '', 'Relaxing Breath (4-7-8)');
  optRelax.value = 'relax';
  routineSelect.appendChild(optBox);
  routineSelect.appendChild(optRelax);
  breathControls.appendChild(routineSelect);

  const startBtn = el('button', 'btn btn-primary btn-sm', '▶ Start Breathing');
  startBtn.style.padding = '0.5rem var(--space-4)';
  breathControls.appendChild(startBtn);

  breathCard.appendChild(breathControls);
  leftCol.appendChild(breathCard);

  // Clean-up hint
  const hintText = el('p', '', '💡 Close your eyes and follow the vibrations. Light native haptic pulses will alert you when it is time to shift states.');
  hintText.style.fontSize = '10px';
  hintText.style.color = 'var(--text-muted)';
  hintText.style.textAlign = 'center';
  hintText.style.marginTop = 'var(--space-3)';
  leftCol.appendChild(hintText);

  // --- Right Column: Sound Synth Controls ---
  const soundCard = el('div', 'overview-panel glass-card');
  soundCard.style.padding = 'var(--space-4)';
  soundCard.style.display = 'flex';
  soundCard.style.flexDirection = 'column';
  soundCard.style.gap = 'var(--space-4)';
  
  const soundTitle = el('h3', '', '🎧 Focus Soundscapes');
  soundTitle.style.fontSize = 'var(--text-xs)';
  soundTitle.style.fontWeight = '800';
  soundTitle.style.textTransform = 'uppercase';
  soundTitle.style.color = 'var(--purple)';
  soundTitle.style.fontFamily = 'var(--font-heading)';
  soundCard.appendChild(soundTitle);

  const soundDesc = el('p', '', 'Generate offline binaural brainwave frequencies or slow wave patterns to filter out external noise and block psychological stress.');
  soundDesc.style.fontSize = '10px';
  soundDesc.style.color = 'var(--text-muted)';
  soundDesc.style.lineHeight = '1.4';
  soundCard.appendChild(soundDesc);

  const soundsList = el('div', 'soundscapes-list');
  soundsList.style.display = 'flex';
  soundsList.style.flexDirection = 'column';
  soundsList.style.gap = 'var(--space-2)';
  
  const soundPresets = [
    { key: 'alpha', label: '🧠 Deep Focus (Alpha Waves)', desc: '10Hz binaural waves for reading/charting' },
    { key: 'theta', label: '🧘 Zen Meditation (Theta Waves)', desc: '5Hz binaural waves to calm trading stress' },
    { key: 'waves', label: '🌊 Ocean Surf (Slow LFO Drone)', desc: 'Wave-like synthesiser swells for box breathing' },
    { key: 'off', label: '🔇 Silent Room (Off)', desc: 'Stop all ambient audio synthesiser output' }
  ];

  const soundButtons = {};
  soundPresets.forEach(sp => {
    const btn = el('button', `btn btn-outline sound-preset-btn${sp.key === _activeAudioType ? ' active' : ''}`);
    btn.style.display = 'flex';
    btn.style.flexDirection = 'column';
    btn.style.alignItems = 'start';
    btn.style.textAlign = 'left';
    btn.style.padding = 'var(--space-2) var(--space-3)';
    btn.style.gap = '2px';
    btn.style.border = '1px solid rgba(255,255,255,0.04)';
    btn.style.background = 'rgba(255,255,255,0.01)';
    
    const label = el('span', '', sp.label);
    label.style.fontSize = 'var(--text-xs)';
    label.style.fontWeight = '700';
    label.style.color = sp.key === _activeAudioType ? 'var(--purple)' : 'var(--text-primary)';
    
    const desc = el('span', '', sp.desc);
    desc.style.fontSize = '9px';
    desc.style.color = 'var(--text-muted)';
    
    btn.appendChild(label);
    btn.appendChild(desc);

    btn.addEventListener('click', () => {
      triggerAudio(sp.key);
    });

    soundsList.appendChild(btn);
    soundButtons[sp.key] = btn;
  });
  soundCard.appendChild(soundsList);

  const audioWarning = el('p', '', '⚠️ Headphone Note: Binaural frequencies require stereo headphones to successfully trigger brainwave states.');
  audioWarning.style.fontSize = '9px';
  audioWarning.style.color = 'var(--text-muted)';
  audioWarning.style.lineHeight = '1.3';
  soundCard.appendChild(audioWarning);

  rightCol.appendChild(soundCard);

  // --- Interactive Functions ---

  let breathingState = 'off'; // 'off', 'inhale', 'hold1', 'exhale', 'hold2'
  let breathCount = 0;

  function triggerAudio(type) {
    _activeAudioType = type;
    playSynthSound('click');

    // Reset buttons visual state
    Object.entries(soundButtons).forEach(([key, btn]) => {
      const lbl = btn.querySelector('span');
      if (key === type) {
        btn.classList.add('active');
        btn.style.borderColor = 'var(--purple-border)';
        btn.style.background = 'var(--purple-bg)';
        if (lbl) lbl.style.color = 'var(--purple)';
      } else {
        btn.classList.remove('active');
        btn.style.borderColor = 'rgba(255,255,255,0.04)';
        btn.style.background = 'rgba(255,255,255,0.01)';
        if (lbl) lbl.style.color = 'var(--text-primary)';
      }
    });

    // Control Web Audio
    stopBinauralBeat();
    stopAmbientDrone();

    if (type === 'alpha') {
      startBinauralBeat(150, 160); // 10Hz diff
    } else if (type === 'theta') {
      startBinauralBeat(100, 105); // 5Hz diff
    } else if (type === 'waves') {
      startAmbientDrone('zen');
    }
  }

  function handleBreathing() {
    if (breathingState === 'off') {
      // Start routine
      startBtn.textContent = '⏹️ Stop Guide';
      startBtn.classList.remove('btn-primary');
      startBtn.classList.add('btn-secondary');
      routineSelect.disabled = true;
      breathingState = 'inhale';
      breathCount = 4;
      
      triggerStateChange();
    } else {
      // Stop routine
      stopBreathing();
    }
  }

  function stopBreathing() {
    if (_activeInterval) {
      clearInterval(_activeInterval);
      _activeInterval = null;
    }
    breathingState = 'off';
    startBtn.textContent = '▶ Start Breathing';
    startBtn.classList.remove('btn-secondary');
    startBtn.classList.add('btn-primary');
    routineSelect.disabled = false;
    
    breathPrompt.textContent = 'READY';
    breathPrompt.style.color = '#fff';
    breathTimer.textContent = '—';
    
    circleOuter.style.transform = 'scale(1)';
    circleOuter.style.borderColor = 'rgba(0, 212, 255, 0.15)';
    circleOuter.style.boxShadow = '0 0 30px rgba(0, 212, 255, 0.05)';
    circleInner.style.border = '1px solid var(--cyan)';
    circleInner.style.boxShadow = 'var(--cyan-glow)';
  }

  function triggerStateChange() {
    if (!isPageActive(container)) {
      stopBreathing();
      stopBinauralBeat();
      stopAmbientDrone();
      return;
    }

    const routine = routineSelect.value;
    
    // Set circle scaling and colors based on state
    if (breathingState === 'inhale') {
      nativeHaptic('medium');
      breathPrompt.textContent = 'INHALE';
      breathPrompt.style.color = 'var(--cyan)';
      circleOuter.style.transform = 'scale(1.25)';
      circleOuter.style.borderColor = 'var(--cyan-border)';
      circleOuter.style.boxShadow = '0 0 40px rgba(0, 212, 255, 0.3)';
      circleInner.style.border = '1px solid var(--cyan)';
      circleInner.style.boxShadow = 'var(--cyan-glow)';
    } else if (breathingState === 'hold1') {
      nativeHaptic('light');
      breathPrompt.textContent = 'HOLD';
      breathPrompt.style.color = 'var(--purple)';
      circleOuter.style.borderColor = 'var(--purple-border)';
      circleOuter.style.boxShadow = '0 0 40px rgba(168, 85, 247, 0.3)';
      circleInner.style.border = '1px solid var(--purple)';
      circleInner.style.boxShadow = 'var(--purple-glow)';
    } else if (breathingState === 'exhale') {
      nativeHaptic('medium');
      breathPrompt.textContent = 'EXHALE';
      breathPrompt.style.color = 'var(--neon-green)';
      circleOuter.style.transform = 'scale(0.85)';
      circleOuter.style.borderColor = 'var(--neon-green-border)';
      circleOuter.style.boxShadow = '0 0 40px rgba(57, 255, 20, 0.3)';
      circleInner.style.border = '1px solid var(--neon-green)';
      circleInner.style.boxShadow = 'var(--neon-green-glow)';
    } else if (breathingState === 'hold2') {
      nativeHaptic('light');
      breathPrompt.textContent = 'HOLD';
      breathPrompt.style.color = 'var(--purple)';
      circleOuter.style.borderColor = 'var(--purple-border)';
      circleOuter.style.boxShadow = '0 0 40px rgba(168, 85, 247, 0.3)';
      circleInner.style.border = '1px solid var(--purple)';
      circleInner.style.boxShadow = 'var(--purple-glow)';
    }

    if (_activeInterval) clearInterval(_activeInterval);
    
    breathTimer.textContent = `${breathCount}s left`;
    
    _activeInterval = setInterval(() => {
      if (!isPageActive(container)) {
        stopBreathing();
        stopBinauralBeat();
        stopAmbientDrone();
        return;
      }
      
      breathCount--;
      breathTimer.textContent = `${breathCount}s left`;
      
      if (breathCount <= 0) {
        // Transition state
        if (routine === 'box') {
          if (breathingState === 'inhale') {
            breathingState = 'hold1';
            breathCount = 4;
          } else if (breathingState === 'hold1') {
            breathingState = 'exhale';
            breathCount = 4;
          } else if (breathingState === 'exhale') {
            breathingState = 'hold2';
            breathCount = 4;
          } else if (breathingState === 'hold2') {
            breathingState = 'inhale';
            breathCount = 4;
          }
        } else {
          // 4-7-8 routine
          if (breathingState === 'inhale') {
            breathingState = 'hold1';
            breathCount = 7;
          } else if (breathingState === 'hold1') {
            breathingState = 'exhale';
            breathCount = 8;
          } else if (breathingState === 'exhale') {
            breathingState = 'inhale';
            breathCount = 4;
          }
        }
        triggerStateChange();
      }
    }, 1000);
  }

  startBtn.addEventListener('click', () => {
    playSynthSound('click');
    handleBreathing();
  });

  // Watch for page hidden to kill audio/animation safely
  const observer = new MutationObserver(() => {
    if (!isPageActive(container)) {
      stopBreathing();
      stopBinauralBeat();
      stopAmbientDrone();
      _activeAudioType = 'off';
      observer.disconnect();
    }
  });
  observer.observe(container, { attributes: true, attributeFilter: ['style'] });
}

function isPageActive(container) {
  return container && container.style.display !== 'none';
}
