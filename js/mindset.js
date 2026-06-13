import storage from './storage.js';
import { playSynthSound, startBinauralBeat, stopBinauralBeat, startAmbientDrone, stopAmbientDrone, isMuted } from './audio.js';
import { nativeHaptic, nativeHapticNotification } from './native-bridge.js';
import { addXP } from './xp.js';
import { triggerConfetti, showNotificationToast, el } from './utils.js';

// --- Configuration Constants ---
const AMBIENT_PRESETS = [
  { key: 'none', label: '🔇 Silence', url: '' },
  { key: 'rain', label: '🌧️ Gentle Rain', url: 'https://actions.google.com/sounds/v1/weather/rain_heavy_loud.ogg' },
  { key: 'waves', label: '🌊 Ocean Waves', url: 'https://actions.google.com/sounds/v1/ambiences/ocean_waves.ogg' },
  { key: 'forest', label: '🌲 Forest Birds', url: 'https://actions.google.com/sounds/v1/ambiences/morning_birds.ogg' },
  { key: 'fireplace', label: '🔥 Fireplace Crackle', url: 'https://actions.google.com/sounds/v1/household/fireplace_crackling.ogg' },
  { key: 'whitenoise', label: '💨 White Noise', url: 'https://actions.google.com/sounds/v1/tools/air_conditioner.ogg' }
];

const AUDIO_STREAMS = [
  { key: 'lofi', label: '🎧 Lofi Beats (Deep Focus)', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3', desc: 'Chill lofi tracks for background concentration' },
  { key: 'rain', label: '🌧️ Ambient Rain (Heavy)', url: 'https://actions.google.com/sounds/v1/weather/rain_heavy_loud.ogg', desc: 'Heavy white-noise rain loop' },
  { key: 'birds', label: '🌲 Forest Birds & Wind', url: 'https://actions.google.com/sounds/v1/ambiences/morning_birds.ogg', desc: 'Natural woodland morning ambiance' },
  { key: 'waves', label: '🌊 Ocean Waves (Zen)', url: 'https://actions.google.com/sounds/v1/ambiences/ocean_waves.ogg', desc: 'Relaxing shoreline water swells' }
];

const EXERCISES_LIBRARY = [
  // Reboot category
  { id: 'reboot_60s', category: 'reboot', title: '60-Second Reboot', desc: 'Quick box-breath to calm adrenaline spike after a trigger.', duration: '1 Min', embedUrl: 'https://www.youtube.com/embed/aNXK1M9CX1o' },
  { id: 'reboot_box', category: 'reboot', title: 'Box Breathing (4-4-4-4)', desc: 'Active breathing rhythm to restore heart rate equilibrium.', duration: '2 Min', isLocalBreathing: true },
  { id: 'reboot_deescalate', category: 'reboot', title: 'De-escalation Reset', desc: 'Deep parasympathetic exhale to release trading pressure.', duration: '3 Min', embedUrl: 'https://www.youtube.com/embed/F28MGLlpP90' },
  // Rewire category
  { id: 'rewire_identity', category: 'rewire', title: 'Trading Identity Reprogram', desc: 'Reprogram your subconscious mind to think and act like a professional.', duration: '10 Min', embedUrl: 'https://www.youtube.com/embed/z6X5oEIg6Ak' },
  { id: 'rewire_risk', category: 'rewire', title: 'Risk Acceptance Primer', desc: 'Accept random outcomes and prime yourself to execute without fear.', duration: '8 Min', embedUrl: 'https://www.youtube.com/embed/vPhz5M1B1gE' },
  { id: 'rewire_detachment', category: 'rewire', title: 'P&L Detachment Meditation', desc: 'Focus on the process, detach from individual trade results.', duration: '12 Min', embedUrl: 'https://www.youtube.com/embed/x1j7PqR8G40' },
  // Recovery category
  { id: 'recovery_adrenaline', category: 'recovery', title: 'Post-Session Adrenaline Flush', desc: 'Let go of the market and return to resting state after trading.', duration: '5 Min', embedUrl: 'https://www.youtube.com/embed/4pD3uN2gTuk' },
  { id: 'recovery_closure', category: 'recovery', title: 'Trading Day Closure Routine', desc: 'Close the journal, release today\'s results, and lock it in the past.', duration: '10 Min', embedUrl: 'https://www.youtube.com/embed/yFCl2J9QOIQ' },
  { id: 'recovery_sleep', category: 'recovery', title: 'Zen Sleep Recharge', desc: 'Slow-wave meditation to calm the nervous system before sleep.', duration: '15 Min', embedUrl: 'https://www.youtube.com/embed/1ZYbU85DM6w' }
];

// --- Module State Variables ---
let _activeInterval = null;
let _activeAudioType = 'off'; // 'off', 'alpha', 'theta', 'waves'
let _currentAudioStream = null;
let _activeAudioStreamKey = 'off';
let _streamVolume = storage.get('mindset_volume', 0.8);
let _activeTab = storage.get('mindset_active_tab', 'streams');
let _synthInitialized = false;

// Sanctuary Meditation Variables
let _meditationState = 'idle'; // 'idle', 'running', 'paused'
let _meditationTimeTotal = 600; // default 10 minutes
let _meditationTimeLeft = 600;
let _meditationTimerInterval = null;
let _meditationAudio = null;
let _meditationIntervalBell = 'none'; // 'none', '60', '120', '180', '300'
let _meditationAmbientSound = 'none';
let _previewAudio = null;
let _activeMainTab = storage.get('mindset_main_tab', 'meditation'); // 'meditation', 'breathing'
let _activeToolkitTab = 'reboot'; // 'favorites', 'reboot', 'rewire', 'recovery'

// --- Storage Data Accessors ---
function getMeditationSessions() {
  return storage.get('meditation_sessions', []);
}

function getFavorites() {
  return storage.get('mindset_favorites', []);
}

function toggleFavorite(id) {
  let favs = getFavorites();
  if (favs.includes(id)) {
    favs = favs.filter(x => x !== id);
  } else {
    favs.push(id);
  }
  storage.set('mindset_favorites', favs);
}

// --- Preview Audio Engine ---
function playHoverPreview(url) {
  if (!url || isMuted()) return;
  stopHoverPreview();
  try {
    _previewAudio = new Audio(url);
    _previewAudio.volume = 0.25 * _streamVolume;
    _previewAudio.play().catch(() => {});
    setTimeout(() => {
      stopHoverPreview();
    }, 2500);
  } catch (e) {}
}

function stopHoverPreview() {
  if (_previewAudio) {
    try {
      _previewAudio.pause();
    } catch(e) {}
    _previewAudio = null;
  }
}

// --- Dynamic Streak Calculation ---
function calculateMeditationStreak() {
  const sessions = getMeditationSessions();
  if (sessions.length === 0) return { current: 0, longest: 0 };
  
  const dates = [...new Set(sessions.map(s => s.date))].sort().reverse(); // newest first
  
  let currentStreak = 0;
  let longestStreak = 0;
  
  const todayStr = new Date().toISOString().slice(0, 10);
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().slice(0, 10);
  
  if (dates.includes(todayStr) || dates.includes(yesterdayStr)) {
    let checkDate = new Date();
    if (!dates.includes(todayStr)) {
      checkDate.setDate(checkDate.getDate() - 1);
    }
    
    while (true) {
      const checkStr = checkDate.toISOString().slice(0, 10);
      if (dates.includes(checkStr)) {
        currentStreak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        break;
      }
    }
  }
  
  const sortedDates = [...new Set(sessions.map(s => s.date))].sort(); // oldest first
  if (sortedDates.length > 0) {
    let tempStreak = 1;
    longestStreak = 1;
    for (let i = 1; i < sortedDates.length; i++) {
      const prev = new Date(sortedDates[i-1]);
      const curr = new Date(sortedDates[i]);
      const diffTime = Math.abs(curr - prev);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays === 1) {
        tempStreak++;
      } else if (diffDays > 1) {
        tempStreak = 1;
      }
      if (tempStreak > longestStreak) {
        longestStreak = tempStreak;
      }
    }
    if (tempStreak > longestStreak) {
      longestStreak = tempStreak;
    }
  }
  
  return { current: currentStreak, longest: Math.max(longestStreak, currentStreak) };
}

// --- Check-in and Video Guided Modals ---
function openMeditationCheckIn(durationSeconds) {
  const overlay = el('div', 'welcome-modal-overlay');
  const modal = el('div', 'welcome-modal');
  modal.style.maxWidth = '450px';
  modal.style.padding = 'var(--space-6)';
  modal.style.position = 'relative';

  const glow = el('div', 'welcome-glow-bar');
  glow.style.background = 'linear-gradient(90deg, var(--purple), var(--cyan))';
  modal.appendChild(glow);

  modal.appendChild(el('h2', 'welcome-modal__title', 'Zen Session Completed 🧘✨'));
  modal.appendChild(el('p', 'welcome-modal__text', `Congratulations on completing your ${Math.round(durationSeconds / 60)}m focus session. How do you feel?`));

  const moodPicker = el('div', 'end-mood-picker');
  moodPicker.style.display = 'grid';
  moodPicker.style.gridTemplateColumns = 'repeat(3, 1fr)';
  moodPicker.style.gap = 'var(--space-2)';
  moodPicker.style.marginBottom = 'var(--space-4)';

  const moods = [
    { key: 'calm', label: '🧘 Calm' },
    { key: 'happy', label: '😃 Happy' },
    { key: 'hyped', label: '🤩 Energized' },
    { key: 'neutral', label: '😐 Neutral' },
    { key: 'anxious', label: '😰 Anxious' },
    { key: 'angry', label: '😡 Impatient' }
  ];

  let selectedMood = 'calm';
  const moodButtons = [];

  moods.forEach(m => {
    const btn = el('button', 'btn', m.label);
    btn.style.padding = '10px 0';
    btn.style.fontSize = 'var(--text-xs)';
    btn.style.border = '1px solid rgba(255, 255, 255, 0.08)';
    btn.style.background = 'rgba(255, 255, 255, 0.02)';
    btn.style.transition = 'all 0.2s ease';
    btn.addEventListener('click', () => {
      selectedMood = m.key;
      moodButtons.forEach(b => {
        b.style.background = 'rgba(255, 255, 255, 0.02)';
        b.style.borderColor = 'rgba(255, 255, 255, 0.08)';
        b.style.color = 'var(--text-secondary)';
      });
      btn.style.background = 'rgba(168, 85, 247, 0.1)';
      btn.style.borderColor = 'var(--purple)';
      btn.style.color = '#fff';
    });
    if (m.key === 'calm') {
      btn.style.background = 'rgba(168, 85, 247, 0.1)';
      btn.style.borderColor = 'var(--purple)';
      btn.style.color = '#fff';
    }
    moodPicker.appendChild(btn);
    moodButtons.push(btn);
  });
  modal.appendChild(moodPicker);

  const notesLabel = el('label', '', 'Session Notes / Takeaways');
  notesLabel.style.display = 'block';
  notesLabel.style.fontSize = '11px';
  notesLabel.style.color = 'var(--text-muted)';
  notesLabel.style.marginBottom = '6px';
  notesLabel.style.fontWeight = 'bold';
  modal.appendChild(notesLabel);

  const notesArea = document.createElement('textarea');
  notesArea.className = 'form-input';
  notesArea.placeholder = 'Any intrusive thoughts? Did your mind drift? How did you settle it down?';
  notesArea.style.width = '100%';
  notesArea.style.height = '80px';
  notesArea.style.fontSize = 'var(--text-xs)';
  notesArea.style.marginBottom = 'var(--space-4)';
  notesArea.style.resize = 'none';
  modal.appendChild(notesArea);

  const saveBtn = el('button', 'btn btn-primary btn-block', 'Save & Return to Sanctuary');
  saveBtn.addEventListener('click', () => {
    const sessions = getMeditationSessions();
    const todayStr = new Date().toISOString().slice(0, 10);
    const newSession = {
      id: 'med_' + Date.now(),
      date: todayStr,
      durationSeconds,
      mood: selectedMood,
      notes: notesArea.value.trim(),
      timestamp: Date.now()
    };
    sessions.push(newSession);
    storage.set('meditation_sessions', sessions);

    let xpAward = 25;
    if (durationSeconds >= 1800) xpAward = 100;
    else if (durationSeconds >= 600) xpAward = 50;
    else if (durationSeconds >= 300) xpAward = 30;
    
    addXP('Meditation Sanctuary Session', xpAward);
    triggerConfetti();
    nativeHapticNotification('success');
    showNotificationToast(`Session Saved! +${xpAward} XP Awarded 🧘🏆`, '🎉');

    overlay.remove();
    
    const container = document.getElementById('page-mindset');
    if (container) renderMindsetPage(container);
  });

  modal.appendChild(saveBtn);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
}

function openGuidedVideoModal(title, embedUrl) {
  const overlay = el('div', 'welcome-modal-overlay');
  const modal = el('div', 'welcome-modal');
  modal.style.maxWidth = '600px';
  modal.style.width = '90%';
  modal.style.padding = '0';
  modal.style.overflow = 'hidden';

  const header = el('div', '');
  header.style.display = 'flex';
  header.style.justifyContent = 'space-between';
  header.style.alignItems = 'center';
  header.style.padding = 'var(--space-4) var(--space-5)';
  header.style.borderBottom = '1px solid rgba(255, 255, 255, 0.06)';
  header.style.background = 'rgba(0, 0, 0, 0.3)';

  const headerTitle = el('h3', '', title);
  headerTitle.style.fontSize = 'var(--text-sm)';
  headerTitle.style.fontWeight = 'bold';
  headerTitle.style.color = '#fff';
  headerTitle.style.margin = '0';

  const closeBtn = el('button', '', '✕');
  closeBtn.style.background = 'transparent';
  closeBtn.style.border = 'none';
  closeBtn.style.color = 'var(--text-muted)';
  closeBtn.style.cursor = 'pointer';
  closeBtn.style.fontSize = '1.2rem';
  closeBtn.addEventListener('click', () => {
    overlay.remove();
  });

  header.appendChild(headerTitle);
  header.appendChild(closeBtn);
  modal.appendChild(header);

  const videoWrap = el('div', '');
  videoWrap.style.position = 'relative';
  videoWrap.style.paddingBottom = '56.25%';
  videoWrap.style.height = '0';
  videoWrap.style.overflow = 'hidden';

  const iframe = document.createElement('iframe');
  iframe.src = embedUrl;
  iframe.style.position = 'absolute';
  iframe.style.top = '0';
  iframe.style.left = '0';
  iframe.style.width = '100%';
  iframe.style.height = '100%';
  iframe.style.border = '0';
  iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
  iframe.allowFullscreen = true;

  videoWrap.appendChild(iframe);
  modal.appendChild(videoWrap);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
}

// --- Mindset Sanctuary Page Controller ---
export function renderMindsetPage(container) {
  container.replaceChildren();

  // --- Title and Description ---
  const header = el('div', 'page-header');
  header.style.marginBottom = 'var(--space-4)';
  header.appendChild(el('h1', 'page-title', '🧘 Mindset Sanctuary'));
  
  const subtitle = el('p', '', 'Master your mind, regulate your nervous system, and trade like a professional machine.');
  subtitle.style.fontSize = 'var(--text-xs)';
  subtitle.style.color = 'var(--text-muted)';
  subtitle.style.marginTop = '-4px';
  header.appendChild(subtitle);
  container.appendChild(header);

  // --- Primary Tab Selector (Meditation vs Breathing/Soundscapes) ---
  const mainTabs = el('div', 'tab-bar');
  mainTabs.style.marginBottom = 'var(--space-6)';
  
  const tabMed = el('button', `tab-btn ${_activeMainTab === 'meditation' ? 'active' : ''}`, '🧘 Meditation Sanctuary');
  const tabBreath = el('button', `tab-btn ${_activeMainTab === 'breathing' ? 'active' : ''}`, '🌀 Breathing & Soundscapes');
  
  tabMed.addEventListener('click', () => {
    _activeMainTab = 'meditation';
    storage.set('mindset_main_tab', 'meditation');
    renderMindsetPage(container);
  });
  
  tabBreath.addEventListener('click', () => {
    _activeMainTab = 'breathing';
    storage.set('mindset_main_tab', 'breathing');
    renderMindsetPage(container);
  });
  
  mainTabs.appendChild(tabMed);
  mainTabs.appendChild(tabBreath);
  container.appendChild(mainTabs);

  // --- Main Layout ---
  const layout = el('div', 'mindset-layout');
  layout.style.display = 'grid';
  layout.style.gridTemplateColumns = '1fr 340px';
  layout.style.gap = 'var(--space-6)';
  layout.style.overflow = 'hidden';
  
  const leftCol = el('div', 'mindset-main');
  const rightCol = el('div', 'mindset-sidebar');
  layout.appendChild(leftCol);
  layout.appendChild(rightCol);
  container.appendChild(layout);

  // =========================================================================
  // LEFT COLUMN VIEW 1: MEDITATION SANCTUARY
  // =========================================================================
  if (_activeMainTab === 'meditation') {
    const medCard = el('div', 'overview-panel glass-card');
    medCard.style.padding = 'var(--space-6)';
    medCard.style.display = 'flex';
    medCard.style.flexDirection = 'column';
    medCard.style.gap = 'var(--space-5)';

    const medTitle = el('h2', '', '🧘 Zen Meditation Timer');
    medTitle.style.fontSize = 'var(--text-sm)';
    medTitle.style.fontWeight = '800';
    medTitle.style.textTransform = 'uppercase';
    medTitle.style.color = 'var(--cyan)';
    medCard.appendChild(medTitle);

    // circular visualizer and remaining time
    const timerCircle = el('div', 'breathing-circle-outer');
    timerCircle.style.width = '180px';
    timerCircle.style.height = '180px';
    timerCircle.style.borderRadius = '50%';
    timerCircle.style.border = '2px solid rgba(0, 212, 255, 0.15)';
    timerCircle.style.boxShadow = '0 0 30px rgba(0, 212, 255, 0.05)';
    timerCircle.style.display = 'flex';
    timerCircle.style.alignItems = 'center';
    timerCircle.style.justifyContent = 'center';
    timerCircle.style.margin = 'var(--space-4) auto';
    timerCircle.style.transition = 'all 0.3s ease';

    const timerInner = el('div', 'breathing-circle-inner');
    timerInner.style.width = '130px';
    timerInner.style.height = '130px';
    timerInner.style.borderRadius = '50%';
    timerInner.style.background = 'radial-gradient(circle, var(--cyan-bg) 0%, rgba(0, 212, 255, 0.02) 100%)';
    timerInner.style.border = '1px solid var(--cyan)';
    timerInner.style.boxShadow = 'var(--cyan-glow)';
    timerInner.style.display = 'flex';
    timerInner.style.flexDirection = 'column';
    timerInner.style.alignItems = 'center';
    timerInner.style.justifyContent = 'center';
    timerInner.style.transition = 'all 0.4s ease';

    const formatTimerText = (sec) => {
      const h = Math.floor(sec / 3600);
      const m = Math.floor((sec % 3600) / 60);
      const s = sec % 60;
      const pad = (n) => String(n).padStart(2, '0');
      return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
    };

    const timerText = el('span', '', formatTimerText(_meditationTimeLeft));
    timerText.style.fontFamily = 'var(--font-heading)';
    timerText.style.fontWeight = '800';
    timerText.style.fontSize = 'var(--text-xl)';
    timerText.style.color = '#fff';

    const timerStatus = el('span', '', _meditationState === 'idle' ? 'TAP START' : _meditationState === 'paused' ? 'PAUSED' : 'MEDITATING');
    timerStatus.style.fontSize = '8px';
    timerStatus.style.color = 'var(--cyan)';
    timerStatus.style.marginTop = '4px';
    timerStatus.style.textTransform = 'uppercase';
    timerStatus.style.letterSpacing = '0.1em';

    timerInner.appendChild(timerText);
    timerInner.appendChild(timerStatus);
    timerCircle.appendChild(timerInner);
    medCard.appendChild(timerCircle);

    // Active state pulse animation
    if (_meditationState === 'running') {
      timerCircle.style.transform = 'scale(1.05)';
      timerCircle.style.borderColor = 'var(--cyan)';
      timerCircle.style.boxShadow = '0 0 45px rgba(0, 212, 255, 0.2)';
    }

    // Timer configs row
    const configContainer = el('div');
    configContainer.style.display = _meditationState === 'idle' ? 'flex' : 'none';
    configContainer.style.flexDirection = 'column';
    configContainer.style.gap = 'var(--space-4)';

    // Preset time selector buttons
    const presetRow = el('div');
    presetRow.style.display = 'flex';
    presetRow.style.gap = '6px';
    presetRow.style.flexWrap = 'wrap';

    const presets = [
      { label: '5 Min', sec: 300 },
      { label: '10 Min', sec: 600 },
      { label: '15 Min', sec: 900 },
      { label: '30 Min', sec: 1800 },
      { label: '1 Hour', sec: 3600 },
      { label: 'Custom', sec: 0 }
    ];

    let activePresetIdx = presets.findIndex(p => p.sec === _meditationTimeTotal);
    if (activePresetIdx === -1 && _meditationTimeTotal !== 0) activePresetIdx = 5; // custom
    else if (activePresetIdx === -1) activePresetIdx = 1; // default 10m

    const customTimeInputs = el('div');
    customTimeInputs.style.display = activePresetIdx === 5 ? 'flex' : 'none';
    customTimeInputs.style.gap = 'var(--space-2)';
    customTimeInputs.style.alignItems = 'center';
    customTimeInputs.style.justifyContent = 'center';
    customTimeInputs.style.marginTop = 'var(--space-2)';

    const inputHour = document.createElement('input');
    inputHour.type = 'number';
    inputHour.placeholder = 'HH';
    inputHour.value = '0';
    inputHour.min = '0';
    inputHour.className = 'form-input';
    inputHour.style.width = '60px';
    inputHour.style.textAlign = 'center';

    const inputMin = document.createElement('input');
    inputMin.type = 'number';
    inputMin.placeholder = 'MM';
    inputMin.value = '10';
    inputMin.min = '0';
    inputMin.max = '59';
    inputMin.className = 'form-input';
    inputMin.style.width = '60px';
    inputMin.style.textAlign = 'center';

    const inputSec = document.createElement('input');
    inputSec.type = 'number';
    inputSec.placeholder = 'SS';
    inputSec.value = '0';
    inputSec.min = '0';
    inputSec.max = '59';
    inputSec.className = 'form-input';
    inputSec.style.width = '60px';
    inputSec.style.textAlign = 'center';

    customTimeInputs.appendChild(inputHour);
    customTimeInputs.appendChild(el('span', '', ':'));
    customTimeInputs.appendChild(inputMin);
    customTimeInputs.appendChild(el('span', '', ':'));
    customTimeInputs.appendChild(inputSec);

    const presetButtons = [];
    presets.forEach((p, idx) => {
      const isActive = idx === activePresetIdx;
      const btn = el('button', `btn btn-sm`, p.label);
      btn.style.flex = '1';
      btn.style.minWidth = '75px';
      btn.style.fontSize = '11px';
      btn.style.transition = 'all 0.2s ease';
      
      btn.style.background = isActive ? 'rgba(0, 212, 255, 0.1)' : 'rgba(255, 255, 255, 0.03)';
      btn.style.borderColor = isActive ? 'var(--cyan)' : 'rgba(255, 255, 255, 0.08)';
      btn.style.color = isActive ? '#fff' : 'var(--text-secondary)';
      if (isActive) {
        btn.style.boxShadow = '0 0 10px rgba(0, 212, 255, 0.2)';
      }
      
      const updatePresetSelection = () => {
        presetButtons.forEach(b => {
          b.style.background = 'rgba(255, 255, 255, 0.03)';
          b.style.borderColor = 'rgba(255, 255, 255, 0.08)';
          b.style.color = 'var(--text-secondary)';
          b.style.boxShadow = 'none';
        });
        btn.style.background = 'rgba(0, 212, 255, 0.1)';
        btn.style.borderColor = 'var(--cyan)';
        btn.style.color = '#fff';
        btn.style.boxShadow = '0 0 10px rgba(0, 212, 255, 0.2)';

        if (p.sec > 0) {
          customTimeInputs.style.display = 'none';
          _meditationTimeTotal = p.sec;
          _meditationTimeLeft = p.sec;
          timerText.textContent = formatTimerText(p.sec);
        } else {
          customTimeInputs.style.display = 'flex';
          const hrs = parseInt(inputHour.value, 10) || 0;
          const mins = parseInt(inputMin.value, 10) || 0;
          const secs = parseInt(inputSec.value, 10) || 0;
          const totalSec = hrs * 3600 + mins * 60 + secs;
          _meditationTimeTotal = totalSec;
          _meditationTimeLeft = totalSec;
          timerText.textContent = formatTimerText(totalSec);
        }
      };

      btn.addEventListener('click', updatePresetSelection);
      
      btn.addEventListener('mouseenter', () => {
        if (btn.style.borderColor !== 'var(--cyan)') {
          btn.style.background = 'rgba(255, 255, 255, 0.06)';
          btn.style.borderColor = 'rgba(255, 255, 255, 0.15)';
        }
      });
      btn.addEventListener('mouseleave', () => {
        if (btn.style.borderColor !== 'var(--cyan)') {
          btn.style.background = 'rgba(255, 255, 255, 0.03)';
          btn.style.borderColor = 'rgba(255, 255, 255, 0.08)';
        }
      });

      presetRow.appendChild(btn);
      presetButtons.push(btn);
    });

    const updateCustomTime = () => {
      const hrs = parseInt(inputHour.value, 10) || 0;
      const mins = parseInt(inputMin.value, 10) || 0;
      const secs = parseInt(inputSec.value, 10) || 0;
      const totalSec = hrs * 3600 + mins * 60 + secs;
      _meditationTimeTotal = totalSec;
      _meditationTimeLeft = totalSec;
      timerText.textContent = formatTimerText(totalSec);
    };

    inputHour.addEventListener('input', updateCustomTime);
    inputMin.addEventListener('input', updateCustomTime);
    inputSec.addEventListener('input', updateCustomTime);

    configContainer.appendChild(presetRow);
    configContainer.appendChild(customTimeInputs);

    // Config dropdowns (Interval bells, Ambient Sounds)
    const optionsGrid = el('div');
    optionsGrid.style.display = 'grid';
    optionsGrid.style.gridTemplateColumns = '1fr 1fr';
    optionsGrid.style.gap = 'var(--space-4)';
    
    // Interval Bell select
    const bellBox = el('div');
    const bellLabel = el('label', '', '🔔 Interval Chime');
    bellLabel.style.display = 'block';
    bellLabel.style.fontSize = '11px';
    bellLabel.style.color = 'var(--text-muted)';
    bellLabel.style.marginBottom = '6px';
    bellLabel.style.fontWeight = 'bold';
    
    const bellSelect = document.createElement('select');
    bellSelect.className = 'form-select';
    bellSelect.style.fontSize = 'var(--text-xs)';
    
    const bellOpts = [
      { label: 'None (Silence)', val: 'none' },
      { label: 'Every 1 Min', val: '60' },
      { label: 'Every 2 Min', val: '120' },
      { label: 'Every 3 Min', val: '180' },
      { label: 'Every 5 Min', val: '300' }
    ];
    bellOpts.forEach(o => {
      const opt = el('option', '', o.label);
      opt.value = o.val;
      if (_meditationIntervalBell === o.val) opt.selected = true;
      bellSelect.appendChild(opt);
    });
    bellSelect.addEventListener('change', () => {
      _meditationIntervalBell = bellSelect.value;
    });

    bellBox.appendChild(bellLabel);
    bellBox.appendChild(bellSelect);
    optionsGrid.appendChild(bellBox);

    // Ambient background sounds select
    const ambientBox = el('div');
    const ambientLabel = el('label', '', '🌧️ Ambient Sound Preset');
    ambientLabel.style.display = 'block';
    ambientLabel.style.fontSize = '11px';
    ambientLabel.style.color = 'var(--text-muted)';
    ambientLabel.style.marginBottom = '6px';
    ambientLabel.style.fontWeight = 'bold';

    const ambientList = el('div', 'streams-list');
    ambientList.style.display = 'flex';
    ambientList.style.gap = '4px';
    ambientList.style.overflowX = 'auto';
    ambientList.style.paddingBottom = '4px';

    AMBIENT_PRESETS.forEach(p => {
      const isActive = p.key === _meditationAmbientSound;
      const btn = el('button', `btn btn-sm sound-preset-btn ${isActive ? 'active' : ''}`, p.label);
      btn.style.fontSize = '10px';
      btn.style.padding = '6px 12px';
      btn.style.whiteSpace = 'nowrap';
      btn.style.transition = 'all 0.2s ease';
      
      btn.style.background = isActive ? 'rgba(168, 85, 247, 0.15)' : 'rgba(255, 255, 255, 0.03)';
      btn.style.borderColor = isActive ? 'var(--purple)' : 'rgba(255, 255, 255, 0.08)';
      btn.style.color = isActive ? '#fff' : 'var(--text-secondary)';

      btn.addEventListener('click', () => {
        _meditationAmbientSound = p.key;
        ambientList.querySelectorAll('button').forEach(b => {
          b.style.background = 'rgba(255, 255, 255, 0.03)';
          b.style.borderColor = 'rgba(255, 255, 255, 0.08)';
          b.style.color = 'var(--text-secondary)';
        });
        btn.style.background = 'rgba(168, 85, 247, 0.15)';
        btn.style.borderColor = 'var(--purple)';
        btn.style.color = '#fff';
        playSynthSound('click');
      });

      // Hover Sound Preview trigger
      btn.addEventListener('mouseenter', () => {
        if (btn.style.borderColor !== 'var(--purple)') {
          btn.style.background = 'rgba(255, 255, 255, 0.06)';
          btn.style.borderColor = 'rgba(255, 255, 255, 0.15)';
        }
        if (p.url && p.key !== _meditationAmbientSound) {
          playHoverPreview(p.url);
        }
      });
      btn.addEventListener('mouseleave', () => {
        if (btn.style.borderColor !== 'var(--purple)') {
          btn.style.background = 'rgba(255, 255, 255, 0.03)';
          btn.style.borderColor = 'rgba(255, 255, 255, 0.08)';
        }
        stopHoverPreview();
      });

      ambientList.appendChild(btn);
    });

    ambientBox.appendChild(ambientLabel);
    ambientBox.appendChild(ambientList);
    optionsGrid.appendChild(ambientBox);
    configContainer.appendChild(optionsGrid);

    // Ambient volume slider
    const volBox = el('div');
    volBox.style.marginTop = 'var(--space-2)';
    const volLabelRow = el('div');
    volLabelRow.style.display = 'flex';
    volLabelRow.style.justifyContent = 'space-between';
    volLabelRow.style.fontSize = '10px';
    volLabelRow.style.color = 'var(--text-muted)';
    volLabelRow.style.marginBottom = '4px';

    volLabelRow.appendChild(el('span', '', 'Ambient Sound Volume'));
    const volValText = el('span', '', `${Math.round(_streamVolume * 100)}%`);
    volLabelRow.appendChild(volValText);
    volBox.appendChild(volLabelRow);

    const volSlider = document.createElement('input');
    volSlider.type = 'range';
    volSlider.min = '0';
    volSlider.max = '100';
    volSlider.value = String(_streamVolume * 100);
    volSlider.style.width = '100%';
    volSlider.style.height = '4px';
    volSlider.style.accentColor = 'var(--purple)';
    volSlider.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value) / 100;
      _streamVolume = val;
      storage.set('mindset_volume', val);
      volValText.textContent = `${Math.round(val * 100)}%`;
      if (_meditationAudio) {
        _meditationAudio.volume = val;
      }
    });
    volBox.appendChild(volSlider);
    configContainer.appendChild(volBox);

    medCard.appendChild(configContainer);

    // Control Buttons Row (Start, Pause, Cancel)
    const controlRow = el('div');
    controlRow.style.display = 'flex';
    controlRow.style.gap = 'var(--space-3)';
    controlRow.style.justifyContent = 'center';
    controlRow.style.marginTop = 'var(--space-2)';

    const stopMedTimer = () => {
      if (_meditationTimerInterval) {
        clearInterval(_meditationTimerInterval);
        _meditationTimerInterval = null;
      }
      if (_meditationAudio) {
        _meditationAudio.pause();
        _meditationAudio = null;
      }
    };

    if (_meditationState === 'idle') {
      const startBtn = el('button', 'btn btn-primary btn-block', '▶ Begin Sanctuary Meditation');
      startBtn.style.padding = '0.75rem var(--space-6)';
      startBtn.style.fontSize = 'var(--text-sm)';
      startBtn.style.fontWeight = 'bold';
      
      startBtn.addEventListener('click', () => {
        playSynthSound('bell');
        nativeHaptic('heavy');
        _meditationState = 'running';
        
        // Start audio preset
        if (_meditationAmbientSound !== 'none') {
          const preset = AMBIENT_PRESETS.find(p => p.key === _meditationAmbientSound);
          if (preset && preset.url) {
            try {
              _meditationAudio = new Audio(preset.url);
              _meditationAudio.loop = true;
              _meditationAudio.volume = _streamVolume;
              _meditationAudio.play().catch(() => {});
            } catch(e) {}
          }
        }

        renderMeditationActiveControls();
        
        _meditationTimerInterval = setInterval(() => {
          if (!isPageActive(container)) {
            stopMedTimer();
            _meditationState = 'idle';
            return;
          }
          
          _meditationTimeLeft--;
          timerText.textContent = formatTimerText(_meditationTimeLeft);

          // Interval Bell Check
          if (_meditationIntervalBell !== 'none') {
            const elapsed = _meditationTimeTotal - _meditationTimeLeft;
            const secondsInterval = parseInt(_meditationIntervalBell, 10);
            if (elapsed > 0 && elapsed % secondsInterval === 0) {
              playSynthSound('bell');
            }
          }

          if (_meditationTimeLeft <= 0) {
            stopMedTimer();
            playSynthSound('bell');
            _meditationState = 'idle';
            openMeditationCheckIn(_meditationTimeTotal);
          }
        }, 1000);
      });
      controlRow.appendChild(startBtn);
    }

    function renderMeditationActiveControls() {
      controlRow.replaceChildren();
      
      // Pause/Resume button
      const pauseBtn = el('button', 'btn btn-secondary', _meditationState === 'paused' ? '▶ Resume' : '⏸️ Pause');
      pauseBtn.style.flex = '1';
      pauseBtn.addEventListener('click', () => {
        if (_meditationState === 'running') {
          _meditationState = 'paused';
          pauseBtn.textContent = '▶ Resume';
          timerStatus.textContent = 'PAUSED';
          timerCircle.style.transform = 'scale(1)';
          timerCircle.style.boxShadow = 'none';
          
          if (_meditationTimerInterval) {
            clearInterval(_meditationTimerInterval);
            _meditationTimerInterval = null;
          }
          if (_meditationAudio) {
            _meditationAudio.pause();
          }
          playSynthSound('click');
        } else {
          _meditationState = 'running';
          pauseBtn.textContent = '⏸️ Pause';
          timerStatus.textContent = 'MEDITATING';
          timerCircle.style.transform = 'scale(1.05)';
          timerCircle.style.borderColor = 'var(--cyan)';
          timerCircle.style.boxShadow = '0 0 45px rgba(0, 212, 255, 0.2)';
          
          if (_meditationAudio) {
            _meditationAudio.play().catch(() => {});
          }
          playSynthSound('click');

          _meditationTimerInterval = setInterval(() => {
            if (!isPageActive(container)) {
              stopMedTimer();
              _meditationState = 'idle';
              return;
            }
            
            _meditationTimeLeft--;
            timerText.textContent = formatTimerText(_meditationTimeLeft);

            if (_meditationIntervalBell !== 'none') {
              const elapsed = _meditationTimeTotal - _meditationTimeLeft;
              const secondsInterval = parseInt(_meditationIntervalBell, 10);
              if (elapsed > 0 && elapsed % secondsInterval === 0) {
                playSynthSound('bell');
              }
            }

            if (_meditationTimeLeft <= 0) {
              stopMedTimer();
              playSynthSound('bell');
              _meditationState = 'idle';
              openMeditationCheckIn(_meditationTimeTotal);
            }
          }, 1000);
        }
      });

      // Cancel button
      const cancelBtn = el('button', 'btn', '⏹️ End Session');
      cancelBtn.style.flex = '1';
      cancelBtn.style.background = 'rgba(255, 71, 87, 0.08)';
      cancelBtn.style.color = 'var(--neon-red)';
      cancelBtn.style.borderColor = 'rgba(255, 71, 87, 0.15)';
      cancelBtn.addEventListener('click', () => {
        stopMedTimer();
        _meditationState = 'idle';
        _meditationTimeLeft = _meditationTimeTotal;
        playSynthSound('click');
        renderMindsetPage(container);
      });

      controlRow.appendChild(pauseBtn);
      controlRow.appendChild(cancelBtn);
    }

    if (_meditationState !== 'idle') {
      renderMeditationActiveControls();
    }

    medCard.appendChild(controlRow);
    leftCol.appendChild(medCard);
  }

  // =========================================================================
  // LEFT COLUMN VIEW 2: INTERACTIVE BREATHING & FOCUS SOUNDSCAPES
  // =========================================================================
  if (_activeMainTab === 'breathing') {
    // --- Box Breathing Guide ---
    const breathCard = el('div', 'overview-panel glass-card');
    breathCard.style.padding = 'var(--space-6)';
    breathCard.style.display = 'flex';
    breathCard.style.flexDirection = 'column';
    breathCard.style.alignItems = 'center';
    breathCard.style.justifyContent = 'center';
    breathCard.style.minHeight = '280px';
    breathCard.style.position = 'relative';
    
    const breathTitle = el('h2', '', '🌀 Interactive Box Breathing Guide');
    breathTitle.style.fontSize = 'var(--text-sm)';
    breathTitle.style.fontWeight = '800';
    breathTitle.style.textTransform = 'uppercase';
    breathTitle.style.color = 'var(--cyan)';
    breathTitle.style.marginBottom = 'var(--space-6)';
    breathCard.appendChild(breathTitle);

    // Breathing circle visualizer
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

    // Session Progress bar
    const progressBarContainer = el('div', 'breathing-progress-bar-container');
    progressBarContainer.style.width = '100%';
    progressBarContainer.style.height = '6px';
    progressBarContainer.style.background = 'rgba(255, 255, 255, 0.05)';
    progressBarContainer.style.borderRadius = '3px';
    progressBarContainer.style.marginTop = 'var(--space-6)';
    progressBarContainer.style.overflow = 'hidden';
    progressBarContainer.style.display = 'none';
    
    const progressBarFill = el('div', 'breathing-progress-bar-fill');
    progressBarFill.style.height = '100%';
    progressBarFill.style.width = '0%';
    progressBarFill.style.background = 'var(--purple)';
    progressBarFill.style.transition = 'width 1s linear';
    progressBarContainer.appendChild(progressBarFill);
    breathCard.appendChild(progressBarContainer);

    // Settings & Start
    const breathControls = el('div', '');
    breathControls.style.display = 'flex';
    breathControls.style.gap = 'var(--space-3)';
    breathControls.style.marginTop = 'var(--space-6)';
    breathControls.style.alignItems = 'center';
    breathControls.style.flexWrap = 'wrap';
    breathControls.style.justifyContent = 'center';

    const routineSelect = document.createElement('select');
    routineSelect.className = 'form-select';
    routineSelect.style.width = '140px';
    routineSelect.style.fontSize = 'var(--text-xs)';
    
    const optBox = el('option', '', 'Box Breath (4-4-4-4)');
    optBox.value = 'box';
    const optRelax = el('option', '', 'Relaxing (4-7-8)');
    optRelax.value = 'relax';
    routineSelect.appendChild(optBox);
    routineSelect.appendChild(optRelax);
    breathControls.appendChild(routineSelect);

    const durationSelect = document.createElement('select');
    durationSelect.className = 'form-select';
    durationSelect.style.width = '80px';
    durationSelect.style.fontSize = 'var(--text-xs)';
    
    const opt1m = el('option', '', '1 Min');
    opt1m.value = '60';
    const opt2m = el('option', '', '2 Min');
    opt2m.value = '120';
    const opt5m = el('option', '', '5 Min');
    opt5m.value = '300';
    durationSelect.appendChild(opt1m);
    durationSelect.appendChild(opt2m);
    durationSelect.appendChild(opt5m);
    durationSelect.value = '120'; // Default 2 min
    breathControls.appendChild(durationSelect);

    const startBtn = el('button', 'btn btn-primary btn-sm', '▶ Start');
    startBtn.style.padding = '0.5rem var(--space-4)';
    breathControls.appendChild(startBtn);
    breathCard.appendChild(breathControls);
    leftCol.appendChild(breathCard);

    // Hint text
    const hintText = el('p', '', '💡 Close your eyes and follow the rhythm. Light native haptic pulses will alert you when to shift states.');
    hintText.style.fontSize = '10px';
    hintText.style.color = 'var(--text-muted)';
    hintText.style.textAlign = 'center';
    hintText.style.marginTop = 'var(--space-2)';
    hintText.style.marginBottom = 'var(--space-4)';
    leftCol.appendChild(hintText);

    // Box Breathing Animation Execution Functions
    let breathingState = 'off'; // 'off', 'inhale', 'hold1', 'exhale', 'hold2'
    let breathCount = 0;
    let sessionTimeElapsed = 0;
    let sessionTimeTarget = 120;

    const stopBreathing = () => {
      if (_activeInterval) {
        clearInterval(_activeInterval);
        _activeInterval = null;
      }
      breathingState = 'off';
      startBtn.textContent = '▶ Start';
      startBtn.classList.remove('btn-secondary');
      startBtn.classList.add('btn-primary');
      routineSelect.disabled = false;
      durationSelect.disabled = false;
      progressBarContainer.style.display = 'none';
      
      breathPrompt.textContent = 'READY';
      breathPrompt.style.color = '#fff';
      breathTimer.textContent = '—';
      
      circleOuter.style.transform = 'scale(1)';
      circleOuter.style.borderColor = 'rgba(0, 212, 255, 0.15)';
      circleOuter.style.boxShadow = '0 0 30px rgba(0, 212, 255, 0.05)';
      circleInner.style.border = '1px solid var(--cyan)';
      circleInner.style.boxShadow = 'var(--cyan-glow)';
    };

    const completeBreathingSession = () => {
      stopBreathing();
      playSynthSound('success');
      nativeHapticNotification('success');

      let xpAward = 30;
      if (sessionTimeTarget === 60) xpAward = 15;
      else if (sessionTimeTarget === 300) xpAward = 75;

      addXP('Focus Session Completed', xpAward);
      
      const completedCount = storage.get('mindset_sessions_completed', 0) + 1;
      storage.set('mindset_sessions_completed', completedCount);
      triggerConfetti();
      showNotificationToast(`🧘 Breathing Session Completed! +${xpAward} XP`, '🎉');

      breathPrompt.textContent = 'WELL DONE!';
      breathPrompt.style.color = 'var(--neon-green)';
      breathTimer.textContent = `+${xpAward} XP Awarded`;
      
      circleOuter.style.transform = 'scale(1.1)';
      circleOuter.style.borderColor = 'var(--neon-green-border)';
      circleOuter.style.boxShadow = '0 0 40px rgba(57, 255, 20, 0.3)';
      circleInner.style.border = '1px solid var(--neon-green)';
      circleInner.style.boxShadow = 'var(--neon-green-glow)';
    };

    const triggerStateChange = () => {
      if (!isPageActive(container)) {
        stopBreathing();
        stopBinauralBeat();
        stopAmbientDrone();
        return;
      }

      const routine = routineSelect.value;
      if (breathingState === 'inhale') {
        nativeHaptic('medium');
        breathPrompt.textContent = 'INHALE';
        breathPrompt.style.color = 'var(--cyan)';
        circleOuter.style.transform = 'scale(1.25)';
        circleOuter.style.borderColor = 'var(--cyan-border)';
        circleOuter.style.boxShadow = '0 0 40px rgba(0, 212, 255, 0.3)';
      } else if (breathingState === 'hold1') {
        nativeHaptic('light');
        breathPrompt.textContent = 'HOLD';
        breathPrompt.style.color = 'var(--purple)';
        circleOuter.style.borderColor = 'var(--purple-border)';
        circleOuter.style.boxShadow = '0 0 40px rgba(168, 85, 247, 0.3)';
      } else if (breathingState === 'exhale') {
        nativeHaptic('medium');
        breathPrompt.textContent = 'EXHALE';
        breathPrompt.style.color = 'var(--neon-green)';
        circleOuter.style.transform = 'scale(0.85)';
        circleOuter.style.borderColor = 'var(--neon-green-border)';
        circleOuter.style.boxShadow = '0 0 40px rgba(57, 255, 20, 0.3)';
      } else if (breathingState === 'hold2') {
        nativeHaptic('light');
        breathPrompt.textContent = 'HOLD';
        breathPrompt.style.color = 'var(--purple)';
        circleOuter.style.borderColor = 'var(--purple-border)';
        circleOuter.style.boxShadow = '0 0 40px rgba(168, 85, 247, 0.3)';
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
        
        sessionTimeElapsed++;
        const progressPercent = Math.min((sessionTimeElapsed / sessionTimeTarget) * 100, 100);
        progressBarFill.style.width = `${progressPercent}%`;
        
        if (sessionTimeElapsed >= sessionTimeTarget) {
          completeBreathingSession();
          return;
        }
        
        if (breathCount <= 0) {
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
    };

    startBtn.addEventListener('click', () => {
      playSynthSound('click');
      if (breathingState === 'off') {
        startBtn.textContent = '⏹️ Stop';
        startBtn.classList.remove('btn-primary');
        startBtn.classList.add('btn-secondary');
        routineSelect.disabled = true;
        durationSelect.disabled = true;
        progressBarContainer.style.display = 'block';
        progressBarFill.style.width = '0%';
        
        breathingState = 'inhale';
        breathCount = 4;
        sessionTimeElapsed = 0;
        sessionTimeTarget = parseInt(durationSelect.value, 10);
        
        triggerStateChange();
      } else {
        stopBreathing();
      }
    });

    // --- Focus Soundscapes (Ambient stream/synth presets) ---
    const soundCard = el('div', 'overview-panel glass-card');
    soundCard.style.padding = 'var(--space-5)';
    soundCard.style.display = 'flex';
    soundCard.style.flexDirection = 'column';
    soundCard.style.gap = 'var(--space-4)';
    
    const soundTitle = el('h3', '', '🎧 Focus Soundscapes presets');
    soundTitle.style.fontSize = 'var(--text-xs)';
    soundTitle.style.fontWeight = '800';
    soundTitle.style.textTransform = 'uppercase';
    soundTitle.style.color = 'var(--purple)';
    soundCard.appendChild(soundTitle);

    // Segmented Tab switcher for soundscapes
    const tabsContainer = el('div', 'mindset-tabs');
    tabsContainer.style.display = 'flex';
    tabsContainer.style.background = 'rgba(0, 0, 0, 0.2)';
    tabsContainer.style.borderRadius = 'var(--radius-md)';
    tabsContainer.style.padding = '4px';
    tabsContainer.style.gap = '4px';
    tabsContainer.style.border = '1px solid rgba(255, 255, 255, 0.05)';
    tabsContainer.style.marginBottom = '4px';

    const tabConfigs = [
      { id: 'streams', label: '🎧 Streams' },
      { id: 'spotify', label: '🎵 Spotify' },
      { id: 'synth', label: '🧠 Synth' }
    ];

    const tabButtons = {};
    const tabContentAreas = {};

    tabConfigs.forEach(tab => {
      const tabBtn = el('button', 'btn btn-sm', tab.label);
      tabBtn.style.flex = '1';
      tabBtn.style.padding = '8px 0';
      tabBtn.style.fontSize = '11px';
      tabBtn.style.fontWeight = '700';
      tabBtn.style.border = '1px solid transparent';
      tabBtn.style.borderRadius = 'var(--radius-sm)';
      tabBtn.style.cursor = 'pointer';
      tabBtn.style.transition = 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)';
      tabBtn.style.background = 'transparent';
      tabBtn.style.color = 'var(--text-muted)';
      
      tabBtn.addEventListener('click', () => {
        switchTab(tab.id);
      });
      
      tabsContainer.appendChild(tabBtn);
      tabButtons[tab.id] = tabBtn;

      const contentArea = el('div', `tab-content-${tab.id}`);
      contentArea.style.display = 'none';
      contentArea.style.flexDirection = 'column';
      contentArea.style.gap = 'var(--space-3)';
      tabContentAreas[tab.id] = contentArea;
    });
    
    soundCard.appendChild(tabsContainer);

    Object.values(tabContentAreas).forEach(area => {
      soundCard.appendChild(area);
    });

    // --- 1. STREAMS CONTENT ---
    const streamsDesc = el('p', '', 'High-quality ambient soundscapes streaming directly from secure networks to keep you focused.');
    streamsDesc.style.fontSize = '10px';
    streamsDesc.style.color = 'var(--text-secondary)';
    streamsDesc.style.lineHeight = '1.4';
    tabContentAreas['streams'].appendChild(streamsDesc);

    const streamsList = el('div', 'streams-list');
    streamsList.style.display = 'flex';
    streamsList.style.flexDirection = 'column';
    streamsList.style.gap = 'var(--space-2)';
    
    const streamButtons = {};
    AUDIO_STREAMS.forEach(stream => {
      const btn = el('button', 'btn sound-preset-btn');
      btn.style.display = 'flex';
      btn.style.flexDirection = 'column';
      btn.style.alignItems = 'start';
      btn.style.textAlign = 'left';
      btn.style.padding = 'var(--space-3) var(--space-4)';
      btn.style.gap = '4px';
      btn.style.borderRadius = 'var(--radius-md)';
      btn.style.border = '1px solid rgba(255, 255, 255, 0.05)';
      btn.style.background = 'rgba(255, 255, 255, 0.02)';
      btn.style.transition = 'all 0.2s ease';
      btn.style.width = '100%';
      
      const label = el('span', '', stream.label);
      label.style.fontSize = 'var(--text-xs)';
      label.style.fontWeight = '700';
      label.style.color = 'var(--text-primary)';
      
      const desc = el('span', '', stream.desc);
      desc.style.fontSize = '9px';
      desc.style.color = 'var(--text-muted)';
      
      btn.appendChild(label);
      btn.appendChild(desc);
      
      btn.addEventListener('click', () => {
        triggerStream(stream.key);
      });
      streamsList.appendChild(btn);
      streamButtons[stream.key] = btn;
    });
    tabContentAreas['streams'].appendChild(streamsList);

    // Streams Volume
    const volumeContainer = el('div');
    volumeContainer.style.display = 'flex';
    volumeContainer.style.flexDirection = 'column';
    volumeContainer.style.gap = '6px';
    volumeContainer.style.marginTop = 'var(--space-2)';
    
    const volumeLabelRow = el('div');
    volumeLabelRow.style.display = 'flex';
    volumeLabelRow.style.justifyContent = 'space-between';
    
    const volumeLabel = el('span', '', 'Stream Volume');
    volumeLabel.style.fontSize = '11px';
    volumeLabel.style.fontWeight = '700';
    volumeLabel.style.color = 'var(--text-secondary)';
    
    const volumeVal = el('span', '', `${Math.round(_streamVolume * 100)}%`);
    volumeVal.style.fontSize = '11px';
    volumeVal.style.color = 'var(--text-muted)';
    
    volumeLabelRow.appendChild(volumeLabel);
    volumeLabelRow.appendChild(volumeVal);
    volumeContainer.appendChild(volumeLabelRow);
    
    const volumeSliderStream = document.createElement('input');
    volumeSliderStream.type = 'range';
    volumeSliderStream.min = '0';
    volumeSliderStream.max = '100';
    volumeSliderStream.value = String(_streamVolume * 100);
    volumeSliderStream.style.width = '100%';
    volumeSliderStream.style.height = '6px';
    volumeSliderStream.style.accentColor = 'var(--purple)';
    volumeSliderStream.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value) / 100;
      _streamVolume = val;
      storage.set('mindset_volume', val);
      volumeVal.textContent = `${Math.round(val * 100)}%`;
      if (_currentAudioStream) {
        _currentAudioStream.volume = val;
      }
    });
    volumeContainer.appendChild(volumeSliderStream);
    tabContentAreas['streams'].appendChild(volumeContainer);

    const stopStreamBtn = el('button', 'btn btn-sm', '⏹ Stop Stream');
    stopStreamBtn.style.width = '100%';
    stopStreamBtn.style.marginTop = 'var(--space-2)';
    stopStreamBtn.style.background = 'rgba(255, 71, 87, 0.08)';
    stopStreamBtn.style.color = 'var(--neon-red)';
    stopStreamBtn.style.borderColor = 'rgba(255, 71, 87, 0.15)';
    stopStreamBtn.addEventListener('click', () => {
      stopActiveStream();
    });
    tabContentAreas['streams'].appendChild(stopStreamBtn);

    // --- 2. SPOTIFY CONTENT ---
    const spotifyDesc = el('p', '', 'Embed official Spotify player. Login to your Spotify account in this browser for full playlist listening.');
    spotifyDesc.style.fontSize = '10px';
    spotifyDesc.style.color = 'var(--text-secondary)';
    spotifyDesc.style.lineHeight = '1.4';
    tabContentAreas['spotify'].appendChild(spotifyDesc);

    const spotifyInputRow = el('div');
    spotifyInputRow.style.display = 'flex';
    spotifyInputRow.style.gap = 'var(--space-2)';
    
    const spotifyInput = document.createElement('input');
    spotifyInput.type = 'text';
    spotifyInput.placeholder = 'Paste Spotify playlist/album link...';
    spotifyInput.className = 'form-input';
    spotifyInput.style.flex = '1';
    spotifyInput.style.fontSize = '11px';
    spotifyInput.style.padding = '0.5rem 0.75rem';
    
    const storedPlaylist = storage.get('custom_spotify_playlist', 'https://open.spotify.com/playlist/37i9dQZF1DX8Uebhn2wRm1');
    spotifyInput.value = storedPlaylist;

    const spotifyLoadBtn = el('button', 'btn btn-sm', 'Load');
    spotifyInputRow.appendChild(spotifyInput);
    spotifyInputRow.appendChild(spotifyLoadBtn);
    tabContentAreas['spotify'].appendChild(spotifyInputRow);

    const iframeContainer = el('div', 'spotify-iframe-container');
    iframeContainer.style.width = '100%';
    iframeContainer.style.height = '350px';
    iframeContainer.style.borderRadius = 'var(--radius-md)';
    iframeContainer.style.overflow = 'hidden';
    
    const spotifyIframe = document.createElement('iframe');
    spotifyIframe.style.border = '0';
    spotifyIframe.style.width = '100%';
    spotifyIframe.style.height = '100%';
    spotifyIframe.allow = 'autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture';
    spotifyIframe.loading = 'lazy';
    
    iframeContainer.appendChild(spotifyIframe);
    tabContentAreas['spotify'].appendChild(iframeContainer);

    spotifyLoadBtn.addEventListener('click', () => {
      const url = spotifyInput.value.trim();
      if (url) {
        storage.set('custom_spotify_playlist', url);
        loadSpotifyPlayer(url);
        playSynthSound('success');
      }
    });

    // --- 3. SYNTH CONTENT ---
    const synthDesc = el('p', '', 'Generate offline binaural brainwave frequencies or slow wave patterns to filter out external noise and block psychological stress.');
    synthDesc.style.fontSize = '10px';
    synthDesc.style.color = 'var(--text-secondary)';
    synthDesc.style.lineHeight = '1.4';
    tabContentAreas['synth'].appendChild(synthDesc);

    const initBtn = el('button', 'btn btn-sm', '⚡ Initialize Synth Audio');
    initBtn.style.width = '100%';
    initBtn.style.padding = 'var(--space-3)';
    initBtn.style.fontSize = 'var(--text-xs)';
    initBtn.style.fontWeight = '700';
    
    const synthListContainer = el('div');
    synthListContainer.style.display = 'flex';
    synthListContainer.style.flexDirection = 'column';
    synthListContainer.style.gap = 'var(--space-2)';

    tabContentAreas['synth'].appendChild(initBtn);
    tabContentAreas['synth'].appendChild(synthListContainer);

    const synthPresets = [
      { key: 'alpha', label: '🧠 Deep Focus (Alpha Waves)', desc: '10Hz binaural waves for reading/charting' },
      { key: 'theta', label: '🧘 Zen Meditation (Theta Waves)', desc: '5Hz binaural waves to calm trading stress' },
      { key: 'waves', label: '🌊 Ocean Surf (Slow LFO Drone)', desc: 'Wave-like synthesiser swells for box breathing' },
      { key: 'off', label: '🔇 Silent Room (Off)', desc: 'Stop all ambient audio synthesiser output' }
    ];

    const synthButtons = {};
    synthPresets.forEach(sp => {
      const btn = el('button', 'btn sound-preset-btn');
      btn.style.display = 'flex';
      btn.style.flexDirection = 'column';
      btn.style.alignItems = 'start';
      btn.style.textAlign = 'left';
      btn.style.padding = 'var(--space-3) var(--space-4)';
      btn.style.gap = '4px';
      btn.style.borderRadius = 'var(--radius-md)';
      btn.style.border = '1px solid rgba(255, 255, 255, 0.05)';
      btn.style.background = 'rgba(255, 255, 255, 0.02)';
      btn.style.width = '100%';
      
      const label = el('span', '', sp.label);
      label.style.fontSize = 'var(--text-xs)';
      label.style.fontWeight = '700';
      label.style.color = 'var(--text-primary)';
      
      const desc = el('span', '', sp.desc);
      desc.style.fontSize = '9px';
      desc.style.color = 'var(--text-muted)';
      
      btn.appendChild(label);
      btn.appendChild(desc);

      btn.addEventListener('click', () => {
        _synthInitialized = true;
        updateInitBtnState();
        triggerAudio(sp.key);
      });
      synthListContainer.appendChild(btn);
      synthButtons[sp.key] = btn;
    });

    const audioWarning = el('p', '', '⚠️ Headphone Note: Binaural frequencies require stereo headphones to successfully trigger brainwave states.');
    audioWarning.style.fontSize = '9px';
    audioWarning.style.color = 'var(--text-muted)';
    audioWarning.style.lineHeight = '1.3';
    tabContentAreas['synth'].appendChild(audioWarning);

    leftCol.appendChild(soundCard);

    // Helpers for Soundscapes
    function switchTab(tabId) {
      _activeTab = tabId;
      storage.set('mindset_active_tab', tabId);
      
      Object.entries(tabButtons).forEach(([id, btn]) => {
        if (id === tabId) {
          btn.style.background = 'rgba(168, 85, 247, 0.15)';
          btn.style.color = 'var(--purple)';
          btn.style.borderColor = 'rgba(168, 85, 247, 0.3)';
          btn.style.boxShadow = '0 0 10px rgba(168, 85, 247, 0.1)';
        } else {
          btn.style.background = 'transparent';
          btn.style.color = 'var(--text-muted)';
          btn.style.borderColor = 'transparent';
          btn.style.boxShadow = 'none';
        }
      });

      Object.entries(tabContentAreas).forEach(([id, area]) => {
        area.style.display = id === tabId ? 'flex' : 'none';
      });
    }

    function parseSpotifyEmbedUrl(url) {
      if (!url) return '';
      if (url.includes('spotify.com/embed')) return url;
      const match = url.match(/spotify\.com\/(playlist|album|track|artist)\/([a-zA-Z0-9]+)/);
      if (match) {
        return `https://open.spotify.com/embed/${match[1]}/${match[2]}?utm_source=generator&theme=0`;
      }
      if (/^[a-zA-Z0-9]{22}$/.test(url.trim())) {
        return `https://open.spotify.com/embed/playlist/${url.trim()}?utm_source=generator&theme=0`;
      }
      return '';
    }

    function loadSpotifyPlayer(url) {
      const embedUrl = parseSpotifyEmbedUrl(url);
      if (embedUrl) {
        spotifyIframe.src = embedUrl;
        stopActiveStream();
        stopBinauralBeat();
        stopAmbientDrone();
        _activeAudioType = 'off';
        updateSynthButtons('off');
      }
    }

    function updateInitBtnState() {
      if (_synthInitialized) {
        initBtn.textContent = '✅ Synth Audio Active';
        initBtn.style.color = 'var(--neon-green)';
        initBtn.style.borderColor = 'rgba(57, 255, 20, 0.25)';
        initBtn.style.background = 'rgba(57, 255, 20, 0.08)';
        initBtn.style.boxShadow = '0 0 15px rgba(57, 255, 20, 0.1)';
      } else {
        initBtn.textContent = '⚡ Initialize Synth Audio';
        initBtn.style.color = 'var(--cyan)';
        initBtn.style.borderColor = 'rgba(0, 212, 255, 0.25)';
        initBtn.style.background = 'rgba(0, 212, 255, 0.08)';
        initBtn.style.boxShadow = 'none';
      }
    }

    initBtn.addEventListener('click', () => {
      _synthInitialized = true;
      updateInitBtnState();
      playSynthSound('click');
    });

    function triggerStream(key) {
      if (isMuted()) return;
      stopBinauralBeat();
      stopAmbientDrone();
      _activeAudioType = 'off';
      updateSynthButtons('off');
      
      if (_currentAudioStream) {
        _currentAudioStream.pause();
        _currentAudioStream = null;
      }
      
      const stream = AUDIO_STREAMS.find(s => s.key === key);
      if (!stream) return;
      
      _activeAudioStreamKey = key;
      playSynthSound('click');
      
      Object.entries(streamButtons).forEach(([k, btn]) => {
        const lbl = btn.querySelector('span');
        const desc = btn.querySelectorAll('span')[1];
        if (k === key) {
          btn.classList.add('active');
          btn.style.borderColor = 'rgba(168, 85, 247, 0.4)';
          btn.style.background = 'rgba(168, 85, 247, 0.08)';
          btn.style.boxShadow = '0 0 15px rgba(168, 85, 247, 0.1)';
          btn.style.transform = 'translateX(4px)';
          if (lbl) lbl.style.color = 'var(--purple)';
          if (desc) desc.style.color = 'rgba(168, 85, 247, 0.7)';
        } else {
          btn.classList.remove('active');
          btn.style.borderColor = 'rgba(255, 255, 255, 0.06)';
          btn.style.background = 'rgba(255, 255, 255, 0.02)';
          btn.style.boxShadow = 'none';
          btn.style.transform = 'none';
          if (lbl) lbl.style.color = 'var(--text-primary)';
          if (desc) desc.style.color = 'var(--text-muted)';
        }
      });
      
      try {
        _currentAudioStream = new Audio(stream.url);
        _currentAudioStream.loop = true;
        _currentAudioStream.volume = _streamVolume;
        _currentAudioStream.play().catch(() => {});
      } catch (err) {}
    }

    function stopActiveStream() {
      _activeAudioStreamKey = 'off';
      if (_currentAudioStream) {
        _currentAudioStream.pause();
        _currentAudioStream = null;
      }
      Object.entries(streamButtons).forEach(([k, btn]) => {
        const lbl = btn.querySelector('span');
        const desc = btn.querySelectorAll('span')[1];
        btn.classList.remove('active');
        btn.style.borderColor = 'rgba(255, 255, 255, 0.06)';
        btn.style.background = 'rgba(255, 255, 255, 0.02)';
        btn.style.boxShadow = 'none';
        btn.style.transform = 'none';
        if (lbl) lbl.style.color = 'var(--text-primary)';
        if (desc) desc.style.color = 'var(--text-muted)';
      });
    }

    function updateSynthButtons(type) {
      Object.entries(synthButtons).forEach(([key, btn]) => {
        const lbl = btn.querySelector('span');
        const desc = btn.querySelectorAll('span')[1];
        if (key === type) {
          btn.classList.add('active');
          btn.style.borderColor = 'rgba(168, 85, 247, 0.4)';
          btn.style.background = 'rgba(168, 85, 247, 0.08)';
          btn.style.boxShadow = '0 0 15px rgba(168, 85, 247, 0.1)';
          btn.style.transform = 'translateX(4px)';
          if (lbl) lbl.style.color = 'var(--purple)';
          if (desc) desc.style.color = 'rgba(168, 85, 247, 0.7)';
        } else {
          btn.classList.remove('active');
          btn.style.borderColor = 'rgba(255, 255, 255, 0.06)';
          btn.style.background = 'rgba(255, 255, 255, 0.02)';
          btn.style.boxShadow = 'none';
          btn.style.transform = 'none';
          if (lbl) lbl.style.color = 'var(--text-primary)';
          if (desc) desc.style.color = 'var(--text-muted)';
        }
      });
    }

    function triggerAudio(type) {
      _activeAudioType = type;
      playSynthSound('click');
      stopActiveStream();
      updateSynthButtons(type);

      stopBinauralBeat();
      stopAmbientDrone();

      if (type === 'alpha') {
        startBinauralBeat(150, 160);
      } else if (type === 'theta') {
        startBinauralBeat(100, 105);
      } else if (type === 'waves') {
        startAmbientDrone('zen');
      }
    }

    switchTab(_activeTab);
    loadSpotifyPlayer(storedPlaylist);
    updateInitBtnState();
    if (_activeAudioStreamKey !== 'off') triggerStream(_activeAudioStreamKey);
    else if (_activeAudioType !== 'off') triggerAudio(_activeAudioType);
  }

  // =========================================================================
  // MENTAL TOOLKIT (GUIDED BY PERFORM COACH SANJIV SANG) - ALWAYS IN LEFT COL
  // =========================================================================
  const toolkitSection = el('div', 'overview-panel glass-card');
  toolkitSection.style.padding = 'var(--space-6)';
  toolkitSection.style.marginTop = 'var(--space-6)';
  toolkitSection.style.display = 'flex';
  toolkitSection.style.flexDirection = 'column';
  toolkitSection.style.gap = 'var(--space-4)';

  const toolkitTitle = el('h2', '', '🧠 Mental Toolkit Library (Guided by Performance Coach)');
  toolkitTitle.style.fontSize = 'var(--text-xs)';
  toolkitTitle.style.fontWeight = '800';
  toolkitTitle.style.textTransform = 'uppercase';
  toolkitTitle.style.color = 'var(--purple)';
  toolkitSection.appendChild(toolkitTitle);

  // Sub-tabs for library categories
  const toolkitTabs = el('div', 'mindset-tabs');
  toolkitTabs.style.display = 'flex';
  toolkitTabs.style.background = 'rgba(0, 0, 0, 0.2)';
  toolkitTabs.style.borderRadius = 'var(--radius-md)';
  toolkitTabs.style.padding = '4px';
  toolkitTabs.style.gap = '4px';
  toolkitTabs.style.border = '1px solid rgba(255, 255, 255, 0.05)';

  const toolkitCategories = [
    { key: 'reboot', label: '⚡ Reboot' },
    { key: 'rewire', label: '🧠 Rewire' },
    { key: 'recovery', label: '🌊 Recovery' },
    { key: 'favorites', label: '⭐ Favorites' }
  ];

  toolkitCategories.forEach(cat => {
    const btn = el('button', `btn btn-sm ${cat.key === _activeToolkitTab ? 'active' : ''}`, cat.label);
    btn.style.flex = '1';
    btn.style.fontSize = '10px';
    btn.style.padding = '6px 0';
    btn.style.background = cat.key === _activeToolkitTab ? 'rgba(168, 85, 247, 0.15)' : 'transparent';
    btn.style.color = cat.key === _activeToolkitTab ? 'var(--purple)' : 'var(--text-muted)';
    btn.style.borderColor = cat.key === _activeToolkitTab ? 'rgba(168, 85, 247, 0.3)' : 'transparent';
    btn.addEventListener('click', () => {
      _activeToolkitTab = cat.key;
      playSynthSound('click');
      renderMindsetPage(container);
    });
    toolkitTabs.appendChild(btn);
  });
  toolkitSection.appendChild(toolkitTabs);

  // Exercises List
  const exercisesGrid = el('div');
  exercisesGrid.style.display = 'grid';
  exercisesGrid.style.gridTemplateColumns = '1fr';
  exercisesGrid.style.gap = 'var(--space-3)';

  let filteredExercises = EXERCISES_LIBRARY;
  if (_activeToolkitTab === 'favorites') {
    const favs = getFavorites();
    filteredExercises = EXERCISES_LIBRARY.filter(e => favs.includes(e.id));
  } else {
    filteredExercises = EXERCISES_LIBRARY.filter(e => e.category === _activeToolkitTab);
  }

  if (filteredExercises.length === 0) {
    const emptyMsg = el('p', '', 'No exercises found in this category.');
    emptyMsg.style.fontSize = 'var(--text-xs)';
    emptyMsg.style.color = 'var(--text-muted)';
    emptyMsg.style.fontStyle = 'italic';
    exercisesGrid.appendChild(emptyMsg);
  } else {
    filteredExercises.forEach(e => {
      const card = el('div', 'glass-card');
      card.style.display = 'flex';
      card.style.alignItems = 'center';
      card.style.padding = 'var(--space-3) var(--space-4)';
      card.style.borderRadius = 'var(--radius-md)';
      card.style.border = '1px solid rgba(255, 255, 255, 0.05)';
      card.style.gap = 'var(--space-4)';

      // Left Play Circle Button
      const playBtn = el('button', 'btn', '▶');
      playBtn.style.width = '32px';
      playBtn.style.height = '32px';
      playBtn.style.borderRadius = '50%';
      playBtn.style.display = 'flex';
      playBtn.style.alignItems = 'center';
      playBtn.style.justifyContent = 'center';
      playBtn.style.padding = '0';
      playBtn.style.color = 'var(--cyan)';
      playBtn.style.borderColor = 'rgba(0, 212, 255, 0.25)';
      playBtn.style.background = 'rgba(0, 212, 255, 0.05)';
      playBtn.style.fontSize = '12px';

      playBtn.addEventListener('click', () => {
        playSynthSound('click');
        if (e.isLocalBreathing) {
          // Switch to Breathing tab, scroll there, and trigger breathing
          _activeMainTab = 'breathing';
          storage.set('mindset_main_tab', 'breathing');
          renderMindsetPage(container);
          setTimeout(() => {
            const elBreath = container.querySelector('.overview-panel');
            if (elBreath) elBreath.scrollIntoView({ behavior: 'smooth' });
          }, 100);
        } else {
          openGuidedVideoModal(e.title, e.embedUrl);
        }
      });

      card.appendChild(playBtn);

      // Middle Description Details
      const details = el('div');
      details.style.flex = '1';
      details.style.display = 'flex';
      details.style.flexDirection = 'column';
      details.style.gap = '2px';

      const titleRow = el('div');
      titleRow.style.display = 'flex';
      titleRow.style.alignItems = 'center';
      titleRow.style.gap = 'var(--space-2)';

      const titleText = el('h4', '', e.title);
      titleText.style.margin = '0';
      titleText.style.fontSize = 'var(--text-xs)';
      titleText.style.fontWeight = 'bold';
      titleText.style.color = '#fff';

      const durationBadge = el('span', '', e.duration);
      durationBadge.style.fontSize = '9px';
      durationBadge.style.background = 'rgba(255, 255, 255, 0.04)';
      durationBadge.style.border = '1px solid rgba(255, 255, 255, 0.08)';
      durationBadge.style.padding = '1px 5px';
      durationBadge.style.borderRadius = 'var(--radius-sm)';
      durationBadge.style.color = 'var(--text-muted)';

      titleRow.appendChild(titleText);
      titleRow.appendChild(durationBadge);
      details.appendChild(titleRow);

      const descText = el('p', '', e.desc);
      descText.style.margin = '0';
      descText.style.fontSize = '9px';
      descText.style.color = 'var(--text-secondary)';
      details.appendChild(descText);
      
      card.appendChild(details);

      // Right Favorites Star Button
      const favs = getFavorites();
      const isFav = favs.includes(e.id);
      
      const starBtn = el('button', 'btn', isFav ? '★' : '☆');
      starBtn.style.border = 'none';
      starBtn.style.background = 'transparent';
      starBtn.style.fontSize = '1.1rem';
      starBtn.style.padding = '0';
      starBtn.style.cursor = 'pointer';
      starBtn.style.color = isFav ? 'var(--cyan)' : 'var(--text-muted)';
      starBtn.style.transition = 'all 0.2s ease';
      
      starBtn.addEventListener('click', () => {
        toggleFavorite(e.id);
        playSynthSound('click');
        renderMindsetPage(container);
      });
      card.appendChild(starBtn);

      exercisesGrid.appendChild(card);
    });
  }
  toolkitSection.appendChild(exercisesGrid);
  leftCol.appendChild(toolkitSection);

  // =========================================================================
  // SIDEBAR RIGHT COLUMN VIEW: INTENTION, STREAK AND HISTORY LOGS
  // =========================================================================

  // --- 1. Daily Intention Setting Widget ---
  const intentionCard = el('div', 'overview-panel glass-card');
  intentionCard.style.padding = 'var(--space-5)';
  intentionCard.style.display = 'flex';
  intentionCard.style.flexDirection = 'column';
  intentionCard.style.gap = 'var(--space-3)';

  const intentionTitle = el('h3', '', '🎯 Daily Intention Setting');
  intentionTitle.style.fontSize = 'var(--text-xs)';
  intentionTitle.style.fontWeight = '800';
  intentionTitle.style.textTransform = 'uppercase';
  intentionTitle.style.color = 'var(--cyan)';
  intentionCard.appendChild(intentionTitle);

  const todayDateStr = new Date().toISOString().slice(0, 10);
  const intentionData = storage.get('daily_intention_data', { date: '', text: '' });
  const isIntentionSet = intentionData.date === todayDateStr && intentionData.text.trim().length > 0;

  if (isIntentionSet) {
    const textQuoteWrap = el('div', 'welcome-reminder');
    textQuoteWrap.style.background = 'rgba(0, 212, 255, 0.04)';
    textQuoteWrap.style.border = '1px solid rgba(0, 212, 255, 0.15)';
    textQuoteWrap.style.padding = 'var(--space-3)';
    textQuoteWrap.style.borderRadius = 'var(--radius-md)';
    textQuoteWrap.style.display = 'flex';
    textQuoteWrap.style.flexDirection = 'column';
    textQuoteWrap.style.gap = 'var(--space-2)';

    const quoteLabel = el('span', '', 'Today\'s Grounding Rule:');
    quoteLabel.style.fontSize = '8px';
    quoteLabel.style.color = 'var(--cyan)';
    quoteLabel.style.fontWeight = 'bold';
    quoteLabel.style.textTransform = 'uppercase';

    const quoteText = el('p', '', `"${intentionData.text}"`);
    quoteText.style.margin = '0';
    quoteText.style.fontSize = 'var(--text-xs)';
    quoteText.style.fontWeight = '700';
    quoteText.style.color = '#fff';
    quoteText.style.lineHeight = '1.4';
    quoteText.style.fontStyle = 'italic';

    const editBtn = el('button', 'btn btn-sm', '✏️ Edit Intention');
    editBtn.style.marginTop = '4px';
    editBtn.style.fontSize = '9px';
    editBtn.style.padding = '3px 8px';
    editBtn.addEventListener('click', () => {
      // Clear date to trigger input view edit mode
      storage.set('daily_intention_data', { date: '', text: intentionData.text });
      playSynthSound('click');
      renderMindsetPage(container);
    });

    textQuoteWrap.appendChild(quoteLabel);
    textQuoteWrap.appendChild(quoteText);
    textQuoteWrap.appendChild(editBtn);
    intentionCard.appendChild(textQuoteWrap);
  } else {
    const descText = el('p', '', 'Define one behavioral rule for today\'s session. Make it process-oriented, behavioral, and within your control.');
    descText.style.margin = '0';
    descText.style.fontSize = '10px';
    descText.style.color = 'var(--text-muted)';
    descText.style.lineHeight = '1.3';
    intentionCard.appendChild(descText);

    const intInput = document.createElement('input');
    intInput.type = 'text';
    intInput.className = 'form-input';
    intInput.placeholder = 'e.g. Follow plan, take only A+ setups';
    intInput.style.fontSize = 'var(--text-xs)';
    intInput.style.padding = '0.5rem 0.75rem';
    intInput.value = intentionData.text || '';
    intentionCard.appendChild(intInput);

    const saveIntBtn = el('button', 'btn btn-primary btn-sm btn-block', 'Lock In Intention 🎯');
    saveIntBtn.addEventListener('click', () => {
      const val = intInput.value.trim();
      if (val.length === 0) return;
      
      storage.set('daily_intention_data', { date: todayDateStr, text: val });
      playSynthSound('success');
      nativeHapticNotification('success');
      showNotificationToast('Daily Intention Locked In! Stay focused.', '🏆');
      renderMindsetPage(container);
    });
    intentionCard.appendChild(saveIntBtn);
  }
  rightCol.appendChild(intentionCard);

  // --- 2. Streak Progress Tracker Widget ---
  const streakCard = el('div', 'overview-panel glass-card');
  streakCard.style.padding = 'var(--space-5)';
  streakCard.style.display = 'flex';
  streakCard.style.flexDirection = 'column';
  streakCard.style.gap = 'var(--space-3)';

  const streakTitle = el('h3', '', '🔥 Streak & Accountable Progress');
  streakTitle.style.fontSize = 'var(--text-xs)';
  streakTitle.style.fontWeight = '800';
  streakTitle.style.textTransform = 'uppercase';
  streakTitle.style.color = 'var(--purple)';
  streakCard.appendChild(streakTitle);

  // Stats
  const streakData = calculateMeditationStreak();
  const medSessions = getMeditationSessions();
  const totalSessions = medSessions.length;
  const totalMinutes = Math.round(medSessions.reduce((acc, s) => acc + (s.durationSeconds || 0), 0) / 60);

  const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const thisWeekSessions = medSessions.filter(s => s.timestamp >= oneWeekAgo);
  const thisWeekMinutes = Math.round(thisWeekSessions.reduce((acc, s) => acc + (s.durationSeconds || 0), 0) / 60);

  const statsGrid = el('div');
  statsGrid.style.display = 'grid';
  statsGrid.style.gridTemplateColumns = '1fr 1fr';
  statsGrid.style.gap = 'var(--space-3)';

  const stats = [
    { label: 'Current Streak', val: `${streakData.current} days` },
    { label: 'Longest Streak', val: `${streakData.longest} days` },
    { label: 'This Week', val: `${thisWeekSessions.length} sess (${thisWeekMinutes}m)` },
    { label: 'Total Practice', val: `${totalSessions} sess (${totalMinutes}m)` }
  ];

  stats.forEach(s => {
    const item = el('div', 'glass-card');
    item.style.padding = '8px';
    item.style.borderRadius = 'var(--radius-sm)';
    item.style.textAlign = 'center';

    const lbl = el('span', '', s.label);
    lbl.style.display = 'block';
    lbl.style.fontSize = '8px';
    lbl.style.color = 'var(--text-muted)';
    lbl.style.textTransform = 'uppercase';

    const val = el('span', '', s.val);
    val.style.display = 'block';
    val.style.fontSize = '11px';
    val.style.fontWeight = 'bold';
    val.style.color = '#fff';
    val.style.marginTop = '2px';

    item.appendChild(lbl);
    item.appendChild(val);
    statsGrid.appendChild(item);
  });
  streakCard.appendChild(statsGrid);

  // 7-day checklist
  function buildSevenDayTracker() {
    const tracker = el('div', 'streak-seven-days');
    tracker.style.display = 'flex';
    tracker.style.justifyContent = 'space-between';
    tracker.style.marginTop = 'var(--space-3)';
    tracker.style.gap = '6px';

    const completedDates = new Set(medSessions.map(s => s.date));

    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      const dayLetter = d.toLocaleDateString('en-US', { weekday: 'short' }).slice(0, 1);
      const isToday = i === 0;

      const dayCol = el('div');
      dayCol.style.display = 'flex';
      dayCol.style.flexDirection = 'column';
      dayCol.style.alignItems = 'center';
      dayCol.style.flex = '1';

      const hasCompleted = completedDates.has(dateStr);
      const bubble = el('div', '', hasCompleted ? '✓' : dayLetter);
      bubble.style.width = '24px';
      bubble.style.height = '24px';
      bubble.style.borderRadius = '50%';
      bubble.style.display = 'flex';
      bubble.style.alignItems = 'center';
      bubble.style.justifyContent = 'center';
      bubble.style.fontSize = '9px';
      bubble.style.fontWeight = 'bold';

      if (hasCompleted) {
        bubble.style.background = 'linear-gradient(135deg, var(--purple), var(--cyan))';
        bubble.style.color = '#fff';
        bubble.style.border = '1px solid var(--purple)';
        bubble.style.boxShadow = '0 0 10px rgba(168, 85, 247, 0.4)';
      } else {
        bubble.style.background = 'rgba(255, 255, 255, 0.02)';
        bubble.style.color = 'var(--text-muted)';
        bubble.style.border = '1px solid rgba(255, 255, 255, 0.05)';
      }

      if (isToday) {
        bubble.style.border = '1px solid var(--cyan)';
        if (!hasCompleted) bubble.style.color = 'var(--cyan)';
      }

      const label = el('span', '', isToday ? 'Today' : d.toLocaleDateString('en-US', { weekday: 'short' }));
      label.style.fontSize = '8px';
      label.style.color = isToday ? 'var(--cyan)' : 'var(--text-muted)';
      label.style.marginTop = '4px';

      dayCol.appendChild(bubble);
      dayCol.appendChild(label);
      tracker.appendChild(dayCol);
    }
    return tracker;
  }
  streakCard.appendChild(buildSevenDayTracker());

  rightCol.appendChild(streakCard);

  // --- 3. Session Meditation History Logs ---
  const historyCard = el('div', 'overview-panel glass-card');
  historyCard.style.padding = 'var(--space-5)';
  historyCard.style.display = 'flex';
  historyCard.style.flexDirection = 'column';
  historyCard.style.gap = 'var(--space-3)';

  const historyTitle = el('h3', '', '🧘 Session Mindset Logs');
  historyTitle.style.fontSize = 'var(--text-xs)';
  historyTitle.style.fontWeight = '800';
  historyTitle.style.textTransform = 'uppercase';
  historyTitle.style.color = 'var(--purple)';
  historyCard.appendChild(historyTitle);

  const historyList = el('div');
  historyList.style.display = 'flex';
  historyList.style.flexDirection = 'column';
  historyList.style.gap = 'var(--space-3)';

  const sortedSessions = getMeditationSessions()
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 5);

  const moodEmojisMap = {
    calm: '🧘 Calm',
    happy: '😃 Good',
    hyped: '🤩 Hyped',
    neutral: '😐 Neutral',
    anxious: '😰 Anxious',
    angry: '😡 Anger'
  };

  if (sortedSessions.length === 0) {
    const emptyMsg = el('p', '', 'No session logs yet. Complete a meditation to build your reflection ledger.');
    emptyMsg.style.fontSize = 'var(--text-xs)';
    emptyMsg.style.color = 'var(--text-muted)';
    emptyMsg.style.fontStyle = 'italic';
    historyList.appendChild(emptyMsg);
  } else {
    sortedSessions.forEach(s => {
      const item = el('div', 'glass-card');
      item.style.padding = 'var(--space-3)';
      item.style.borderRadius = 'var(--radius-md)';
      item.style.display = 'flex';
      item.style.flexDirection = 'column';
      item.style.gap = '4px';

      const headerRow = el('div');
      headerRow.style.display = 'flex';
      headerRow.style.justifyContent = 'space-between';
      headerRow.style.fontSize = '10px';
      headerRow.style.fontWeight = 'bold';

      const dateStr = s.date;
      const dateEl = el('span', '', dateStr);
      dateEl.style.color = 'var(--cyan)';

      const durationMins = Math.round(s.durationSeconds / 60);
      const moodLabel = moodEmojisMap[s.mood] || '🧘 Calm';
      const moodEl = el('span', '', `${durationMins}m - ${moodLabel}`);
      moodEl.style.color = 'var(--text-muted)';

      headerRow.appendChild(dateEl);
      headerRow.appendChild(moodEl);
      item.appendChild(headerRow);

      if (s.notes) {
        const notes = el('p', '', s.notes);
        notes.style.fontSize = '10px';
        notes.style.color = 'var(--text-secondary)';
        notes.style.margin = '4px 0 0 0';
        notes.style.lineHeight = '1.3';
        item.appendChild(notes);
      }
      
      historyList.appendChild(item);
    });
  }
  historyCard.appendChild(historyList);
  rightCol.appendChild(historyCard);

  // Watch for page hidden to kill audio/animation safely
  const observer = new MutationObserver(() => {
    if (!isPageActive(container)) {
      if (_meditationTimerInterval) {
        clearInterval(_meditationTimerInterval);
        _meditationTimerInterval = null;
      }
      if (_meditationAudio) {
        _meditationAudio.pause();
        _meditationAudio = null;
      }
      _meditationState = 'idle';

      stopBinauralBeat();
      stopAmbientDrone();
      stopActiveStream();
      _activeAudioType = 'off';
      _activeAudioStreamKey = 'off';
      observer.disconnect();
    }
  });
  observer.observe(container, { attributes: true, attributeFilter: ['style'] });
}

function isPageActive(container) {
  return container && container.style.display !== 'none';
}
