import storage from './storage.js';
import { playSynthSound, startBinauralBeat, stopBinauralBeat, startAmbientDrone, stopAmbientDrone, isMuted } from './audio.js';
import { nativeHaptic, nativeHapticNotification } from './native-bridge.js';
import { addXP } from './xp.js';
import { triggerConfetti, showNotificationToast, el } from './utils.js';

let _activeInterval = null;
let _activeAudioType = 'off'; // 'off', 'alpha', 'theta', 'waves'
let _currentAudioStream = null;
let _activeAudioStreamKey = 'off';
let _streamVolume = storage.get('mindset_volume', 0.8);
let _activeTab = storage.get('mindset_active_tab', 'streams');
let _synthInitialized = false;

const AUDIO_STREAMS = [
  { key: 'lofi', label: '🎧 Lofi Beats (Deep Focus)', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3', desc: 'Chill lofi tracks for background concentration' },
  { key: 'rain', label: '🌧️ Ambient Rain (Heavy)', url: 'https://actions.google.com/sounds/v1/weather/rain_heavy_loud.ogg', desc: 'Heavy white-noise rain loop' },
  { key: 'birds', label: '🌲 Forest Birds & Wind', url: 'https://actions.google.com/sounds/v1/ambiences/morning_birds.ogg', desc: 'Natural woodland morning ambiance' },
  { key: 'waves', label: '🌊 Ocean Waves (Zen)', url: 'https://actions.google.com/sounds/v1/ambiences/ocean_waves.ogg', desc: 'Relaxing shoreline water swells' }
];

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
  layout.style.overflow = 'hidden';
  
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
  breathCard.style.minHeight = '280px';
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
  routineSelect.style.minWidth = '0';
  routineSelect.style.flex = '1 1 auto';
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
  durationSelect.style.minWidth = '0';
  durationSelect.style.flex = '0 1 auto';
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
  durationSelect.value = '120'; // Default to 2 Min
  breathControls.appendChild(durationSelect);

  const startBtn = el('button', 'btn btn-primary btn-sm', '▶ Start');
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

  // --- Mindset Sanctuary Session Mood Logs & History ---
  const mindsetCard = el('div', 'overview-panel glass-card');
  mindsetCard.style.padding = 'var(--space-6)';
  mindsetCard.style.marginTop = 'var(--space-6)';
  mindsetCard.style.display = 'flex';
  mindsetCard.style.flexDirection = 'column';
  mindsetCard.style.gap = 'var(--space-4)';

  const mindsetTitle = el('h2', '', '🧘 Session Mindset Logs');
  mindsetTitle.style.fontSize = 'var(--text-sm)';
  mindsetTitle.style.fontWeight = '800';
  mindsetTitle.style.textTransform = 'uppercase';
  mindsetTitle.style.letterSpacing = '0.08em';
  mindsetTitle.style.color = 'var(--purple)';
  mindsetCard.appendChild(mindsetTitle);

  // Today's Check-ins (Premarket start vs EOD end)
  const todayStr = new Date().toISOString().slice(0, 10);
  const routine = storage.get('premarket_routine');
  const hasPremarketToday = routine && routine.date === todayStr;
  const startMoodKey = hasPremarketToday ? routine.startMood : '';

  const journalEntries = storage.get('extra_study_journal', []);
  const todayReflection = journalEntries.find(e => e.localDate === todayStr && e.title.includes('End of Day'));
  const endMoodKey = todayReflection ? todayReflection.endMood : '';

  const moodsMap = {
    hyped: { label: '🤩 Hyped', emoji: '🤩' },
    calm: { label: '🧘 Calm', emoji: '🧘' },
    neutral: { label: '😐 Neutral', emoji: '😐' },
    anxious: { label: '😰 Anxious', emoji: '😰' },
    angry: { label: '😡 Impatient', emoji: '😡' },
    happy: { label: '😃 Good', emoji: '😃' }
  };

  const statusRow = el('div');
  statusRow.style.display = 'grid';
  statusRow.style.gridTemplateColumns = '1fr 1fr';
  statusRow.style.gap = 'var(--space-4)';

  // Start Mood block
  const startBlock = el('div', 'glass-card');
  startBlock.style.padding = 'var(--space-3)';
  startBlock.style.borderRadius = 'var(--radius-md)';
  startBlock.style.textAlign = 'center';
  startBlock.appendChild(el('div', '', 'Starting Session Mood'));
  const startVal = el('div', '', startMoodKey && moodsMap[startMoodKey] ? moodsMap[startMoodKey].label : '⏳ Not Started');
  startVal.style.fontSize = 'var(--text-md)';
  startVal.style.fontWeight = 'bold';
  startVal.style.marginTop = '4px';
  startVal.style.color = startMoodKey ? 'var(--cyan)' : 'var(--text-muted)';
  startBlock.appendChild(startVal);
  statusRow.appendChild(startBlock);

  // End Mood block
  const endBlock = el('div', 'glass-card');
  endBlock.style.padding = 'var(--space-3)';
  endBlock.style.borderRadius = 'var(--radius-md)';
  endBlock.style.textAlign = 'center';
  endBlock.appendChild(el('div', '', 'Ending Session Mood'));
  const endVal = el('div', '', endMoodKey && moodsMap[endMoodKey] ? moodsMap[endMoodKey].label : '⏳ Not Reviewed');
  endVal.style.fontSize = 'var(--text-md)';
  endVal.style.fontWeight = 'bold';
  endVal.style.marginTop = '4px';
  endVal.style.color = endMoodKey ? 'var(--neon-green)' : 'var(--text-muted)';
  endBlock.appendChild(endVal);
  statusRow.appendChild(endBlock);

  mindsetCard.appendChild(statusRow);

  // Reflection History Title
  const historyTitle = el('h3', '', 'Recent Mindset Reflections (Past 7 Days)');
  historyTitle.style.fontSize = 'var(--text-xs)';
  historyTitle.style.fontWeight = 'bold';
  historyTitle.style.color = 'var(--text-secondary)';
  historyTitle.style.marginTop = 'var(--space-2)';
  mindsetCard.appendChild(historyTitle);

  // List of reflections
  const historyList = el('div');
  historyList.style.display = 'flex';
  historyList.style.flexDirection = 'column';
  historyList.style.gap = 'var(--space-3)';

  const recentReflections = journalEntries
    .filter(e => e.title.includes('End of Day') || e.category === 'Mindset')
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 5);

  if (recentReflections.length === 0) {
    const emptyMsg = el('p', '', 'No recent mindset reflections found. Complete your daily review journal to see logs here.');
    emptyMsg.style.fontSize = 'var(--text-xs)';
    emptyMsg.style.color = 'var(--text-muted)';
    emptyMsg.style.fontStyle = 'italic';
    historyList.appendChild(emptyMsg);
  } else {
    recentReflections.forEach(ref => {
      const item = el('div', 'glass-card');
      item.style.padding = 'var(--space-3)';
      item.style.borderRadius = 'var(--radius-md)';
      item.style.display = 'flex';
      item.style.flexDirection = 'column';
      item.style.gap = '4px';

      const headerRow = el('div');
      headerRow.style.display = 'flex';
      headerRow.style.justifyContent = 'space-between';
      headerRow.style.fontSize = '11px';
      headerRow.style.fontWeight = 'bold';

      const dateStr = ref.localDate || ref.createdAt.slice(0, 10);
      const dateEl = el('span', '', dateStr);
      dateEl.style.color = 'var(--cyan)';

      const moodEmoji = ref.endMood && moodsMap[ref.endMood] ? moodsMap[ref.endMood].emoji : '📝';
      const moodEl = el('span', '', `End Mood: ${moodEmoji}`);

      headerRow.appendChild(dateEl);
      headerRow.appendChild(moodEl);
      item.appendChild(headerRow);

      const noteText = el('p', '', ref.takeaways);
      noteText.style.fontSize = '11px';
      noteText.style.color = 'var(--text-secondary)';
      noteText.style.margin = '4px 0 0 0';
      noteText.style.lineHeight = '1.4';
      item.appendChild(noteText);

      historyList.appendChild(item);
    });
  }

  mindsetCard.appendChild(historyList);
  leftCol.appendChild(mindsetCard);

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

  // Segmented Tab switcher
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

  // --- 1. STREAMS TAB CONTENT ---
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
    btn.style.transition = 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)';
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
    
    btn.addEventListener('mouseenter', () => {
      if (btn.classList.contains('active')) return;
      btn.style.background = 'rgba(255, 255, 255, 0.06)';
      btn.style.borderColor = 'rgba(255, 255, 255, 0.15)';
      btn.style.transform = 'translateX(4px)';
    });
    btn.addEventListener('mouseleave', () => {
      if (btn.classList.contains('active')) return;
      btn.style.background = 'rgba(255, 255, 255, 0.02)';
      btn.style.borderColor = 'rgba(255, 255, 255, 0.06)';
      btn.style.transform = 'none';
    });
    
    streamsList.appendChild(btn);
    streamButtons[stream.key] = btn;
  });
  tabContentAreas['streams'].appendChild(streamsList);

  const volumeContainer = el('div');
  volumeContainer.style.display = 'flex';
  volumeContainer.style.flexDirection = 'column';
  volumeContainer.style.gap = '6px';
  volumeContainer.style.marginTop = 'var(--space-2)';
  
  const volumeLabelRow = el('div');
  volumeLabelRow.style.display = 'flex';
  volumeLabelRow.style.justifyContent = 'space-between';
  volumeLabelRow.style.alignItems = 'center';
  
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
  
  const volumeSlider = document.createElement('input');
  volumeSlider.type = 'range';
  volumeSlider.min = '0';
  volumeSlider.max = '100';
  volumeSlider.value = String(_streamVolume * 100);
  volumeSlider.style.width = '100%';
  volumeSlider.style.cursor = 'pointer';
  volumeSlider.style.height = '6px';
  volumeSlider.style.background = 'rgba(255,255,255,0.1)';
  volumeSlider.style.borderRadius = '3px';
  volumeSlider.style.accentColor = 'var(--purple)';
  
  volumeSlider.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value) / 100;
    _streamVolume = val;
    storage.set('mindset_volume', val);
    volumeVal.textContent = `${Math.round(val * 100)}%`;
    if (_currentAudioStream) {
      _currentAudioStream.volume = val;
    }
  });
  
  volumeContainer.appendChild(volumeSlider);
  tabContentAreas['streams'].appendChild(volumeContainer);

  const stopStreamBtn = el('button', 'btn btn-sm', '⏹ Stop Stream');
  stopStreamBtn.style.width = '100%';
  stopStreamBtn.style.marginTop = 'var(--space-2)';
  stopStreamBtn.style.background = 'rgba(255, 71, 87, 0.08)';
  stopStreamBtn.style.color = 'var(--neon-red)';
  stopStreamBtn.style.borderColor = 'rgba(255, 71, 87, 0.15)';
  stopStreamBtn.style.fontWeight = '700';
  stopStreamBtn.style.transition = 'all 0.2s ease';
  
  stopStreamBtn.addEventListener('mouseenter', () => {
    stopStreamBtn.style.background = 'rgba(255, 71, 87, 0.15)';
    stopStreamBtn.style.borderColor = 'rgba(255, 71, 87, 0.3)';
    stopStreamBtn.style.boxShadow = '0 0 15px rgba(255, 71, 87, 0.15)';
  });
  stopStreamBtn.addEventListener('mouseleave', () => {
    stopStreamBtn.style.background = 'rgba(255, 71, 87, 0.08)';
    stopStreamBtn.style.borderColor = 'rgba(255, 71, 87, 0.15)';
    stopStreamBtn.style.boxShadow = 'none';
  });
  stopStreamBtn.addEventListener('click', () => {
    stopActiveStream();
  });
  tabContentAreas['streams'].appendChild(stopStreamBtn);

  // --- 2. SPOTIFY TAB CONTENT ---
  const spotifyDesc = el('p', '', 'Embed official Spotify player. Login to your Spotify account in this browser for full song previews.');
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
  spotifyInput.style.background = 'rgba(255, 255, 255, 0.02)';
  spotifyInput.style.border = '1px solid rgba(255, 255, 255, 0.08)';
  spotifyInput.style.color = '#fff';
  
  const storedPlaylist = storage.get('custom_spotify_playlist', 'https://open.spotify.com/playlist/37i9dQZF1DX8Uebhn2wRm1');
  spotifyInput.value = storedPlaylist;

  const spotifyLoadBtn = el('button', 'btn btn-sm', 'Load');
  spotifyLoadBtn.style.padding = '0 var(--space-4)';
  spotifyLoadBtn.style.fontSize = '11px';
  spotifyLoadBtn.style.fontWeight = '700';
  spotifyLoadBtn.style.background = 'rgba(168, 85, 247, 0.15)';
  spotifyLoadBtn.style.color = 'var(--purple)';
  spotifyLoadBtn.style.borderColor = 'rgba(168, 85, 247, 0.25)';
  spotifyLoadBtn.style.transition = 'all 0.2s ease';
  
  spotifyLoadBtn.addEventListener('mouseenter', () => {
    spotifyLoadBtn.style.background = 'rgba(168, 85, 247, 0.25)';
    spotifyLoadBtn.style.borderColor = 'var(--purple)';
    spotifyLoadBtn.style.boxShadow = '0 0 15px rgba(168, 85, 247, 0.2)';
  });
  spotifyLoadBtn.addEventListener('mouseleave', () => {
    spotifyLoadBtn.style.background = 'rgba(168, 85, 247, 0.15)';
    spotifyLoadBtn.style.borderColor = 'rgba(168, 85, 247, 0.25)';
    spotifyLoadBtn.style.boxShadow = 'none';
  });

  spotifyInputRow.appendChild(spotifyInput);
  spotifyInputRow.appendChild(spotifyLoadBtn);
  tabContentAreas['spotify'].appendChild(spotifyInputRow);

  const iframeContainer = el('div', 'spotify-iframe-container');
  iframeContainer.style.width = '100%';
  iframeContainer.style.height = '352px';
  iframeContainer.style.borderRadius = 'var(--radius-md)';
  iframeContainer.style.overflow = 'hidden';
  iframeContainer.style.background = 'transparent';
  iframeContainer.style.border = 'none';
  
  const spotifyIframe = document.createElement('iframe');
  spotifyIframe.style.border = '0';
  spotifyIframe.style.width = '100%';
  spotifyIframe.style.height = '100%';
  spotifyIframe.style.borderRadius = 'var(--radius-md)';
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

  // --- 3. SYNTH TAB CONTENT ---
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
  initBtn.style.transition = 'all 0.2s ease';
  
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
    btn.style.transition = 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)';
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

    btn.addEventListener('mouseenter', () => {
      if (btn.classList.contains('active')) return;
      btn.style.background = 'rgba(255, 255, 255, 0.06)';
      btn.style.borderColor = 'rgba(255, 255, 255, 0.15)';
      btn.style.transform = 'translateX(4px)';
    });
    btn.addEventListener('mouseleave', () => {
      if (btn.classList.contains('active')) return;
      btn.style.background = 'rgba(255, 255, 255, 0.02)';
      btn.style.borderColor = 'rgba(255, 255, 255, 0.06)';
      btn.style.transform = 'none';
    });

    synthListContainer.appendChild(btn);
    synthButtons[sp.key] = btn;
  });

  const audioWarning = el('p', '', '⚠️ Headphone Note: Binaural frequencies require stereo headphones to successfully trigger brainwave states.');
  audioWarning.style.fontSize = '9px';
  audioWarning.style.color = 'var(--text-muted)';
  audioWarning.style.lineHeight = '1.3';
  tabContentAreas['synth'].appendChild(audioWarning);

  rightCol.appendChild(soundCard);

  // --- Operations / Helpers ---
  
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
      if (id === tabId) {
        area.style.display = 'flex';
      } else {
        area.style.display = 'none';
      }
    });
  }

  function parseSpotifyEmbedUrl(url) {
    if (!url) return '';
    if (url.includes('spotify.com/embed')) return url;
    
    const match = url.match(/spotify\.com\/(playlist|album|track|artist)\/([a-zA-Z0-9]+)/);
    if (match) {
      const type = match[1];
      const id = match[2];
      return `https://open.spotify.com/embed/${type}/${id}?utm_source=generator&theme=0`;
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
      
      const playPromise = _currentAudioStream.play();
      if (playPromise !== undefined) {
        playPromise.catch(err => {
          console.warn('[Mindset Streams] Playback failed or was interrupted:', err);
        });
      }
    } catch (err) {
      console.error('[Mindset Streams] Failed to initialize audio:', err);
    }
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

  // Set initial States
  switchTab(_activeTab);
  loadSpotifyPlayer(storedPlaylist);
  updateInitBtnState();
  if (_activeAudioStreamKey !== 'off') {
    triggerStream(_activeAudioStreamKey);
  } else if (_activeAudioType !== 'off') {
    triggerAudio(_activeAudioType);
  }

  // --- Interactive Functions ---

  let breathingState = 'off'; // 'off', 'inhale', 'hold1', 'exhale', 'hold2'
  let breathCount = 0;
  let sessionTimeElapsed = 0;
  let sessionTimeTarget = 120;

  function handleBreathing() {
    if (breathingState === 'off') {
      // Start routine
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
  }

  function completeBreathingSession() {
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

    // Play success fanfare chime
    playSynthSound('success');
    
    // Haptics
    nativeHapticNotification('success');

    // Determine reward XP
    let xpAward = 30;
    if (sessionTimeTarget === 60) xpAward = 15;
    else if (sessionTimeTarget === 300) xpAward = 75;

    addXP('Focus Session Completed', xpAward);

    // Save session completion
    const completedCount = storage.get('mindset_sessions_completed', 0) + 1;
    storage.set('mindset_sessions_completed', completedCount);

    // Trigger confetti
    triggerConfetti();

    // Show toast
    showNotificationToast(`🧘 Focus Session Completed! +${xpAward} XP`, '🎉');

    // Update Circle Visualizer state to celebrate completion
    breathPrompt.textContent = 'WELL DONE!';
    breathPrompt.style.color = 'var(--neon-green)';
    breathTimer.textContent = `+${xpAward} XP Awarded`;
    
    circleOuter.style.transform = 'scale(1.1)';
    circleOuter.style.borderColor = 'var(--neon-green-border)';
    circleOuter.style.boxShadow = '0 0 40px rgba(57, 255, 20, 0.3)';
    circleInner.style.border = '1px solid var(--neon-green)';
    circleInner.style.boxShadow = 'var(--neon-green-glow)';
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
      
      // Increment elapsed session time
      sessionTimeElapsed++;
      const progressPercent = Math.min((sessionTimeElapsed / sessionTimeTarget) * 100, 100);
      progressBarFill.style.width = `${progressPercent}%`;
      
      if (sessionTimeElapsed >= sessionTimeTarget) {
        completeBreathingSession();
        return;
      }
      
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
