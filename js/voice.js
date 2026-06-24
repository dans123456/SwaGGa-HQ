// SwaGGa HQ — Voice Dictation Module
// Uses browser SpeechRecognition and renders a high-performance visual waveform overlay.

import { showNotificationToast } from './utils.js';
import { nativeHaptic } from './native-bridge.js';
import { playSynthSound } from './audio.js';

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

/**
 * Attaches voice dictation capability to a textarea and triggers it via a microphone button.
 * Creates an XSS-safe canvas wave overlay dynamically inside the textarea's parent wrapper.
 * 
 * @param {HTMLTextAreaElement} textarea - The target text input area.
 * @param {HTMLButtonElement} micBtn - The trigger button.
 */
export function setupVoiceDictation(textarea, micBtn) {
  if (!textarea || !micBtn) return;

  if (!SpeechRecognition) {
    micBtn.style.opacity = '0.4';
    micBtn.title = 'Speech recognition not supported in this browser';
    micBtn.addEventListener('click', () => {
      showNotificationToast('Voice dictation is not supported in this browser environment.', '⚠️');
    });
    return;
  }

  const parent = textarea.parentNode;
  if (parent) {
    const computedStyle = window.getComputedStyle(parent);
    if (computedStyle.position === 'static') {
      parent.style.position = 'relative';
    }
  }

  // Create UI overlay elements securely
  const overlay = document.createElement('div');
  overlay.className = 'voice-wave-container';
  overlay.style.position = 'absolute';
  overlay.style.inset = '0';
  overlay.style.background = 'rgba(13, 11, 15, 0.95)';
  overlay.style.zIndex = '10';
  overlay.style.display = 'none';
  overlay.style.alignItems = 'center';
  overlay.style.justifyContent = 'center';
  overlay.style.flexDirection = 'column';
  overlay.style.gap = '8px';
  overlay.style.padding = '12px';
  overlay.style.borderRadius = 'inherit';

  const status = document.createElement('span');
  status.className = 'voice-wave-status';
  status.textContent = '🎙️ Listening...';
  status.style.fontSize = '12px';
  status.style.fontWeight = 'bold';
  status.style.color = 'var(--cyan)';
  overlay.appendChild(status);

  const canvas = document.createElement('canvas');
  canvas.className = 'voice-wave-canvas';
  canvas.style.width = '80%';
  canvas.style.height = '40px';
  overlay.appendChild(canvas);

  const tip = document.createElement('span');
  tip.style.fontSize = '9px';
  tip.style.color = 'var(--text-muted)';
  tip.textContent = 'Speak clearly. Tap Mic again to finish.';
  overlay.appendChild(tip);

  if (parent) {
    parent.appendChild(overlay);
  }

  const ctx = canvas.getContext('2d');
  let recognition = null;
  let isRecording = false;
  let animFrameId = null;
  let wavePhase = 0;

  // Initialize speech recognition
  try {
    recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';
  } catch (err) {
    console.warn('SpeechRecognition failed to instantiate:', err);
    return;
  }

  // Siri wave animation loop (procedural canvas)
  function renderSiriWaves() {
    if (!isRecording) return;
    animFrameId = requestAnimationFrame(renderSiriWaves);

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    wavePhase += 0.15;

    // Draw 3 layered sine waves
    const waves = [
      { color: 'rgba(0, 212, 255, 0.7)', amp: 14, freq: 0.025, phaseShift: 0 },
      { color: 'rgba(168, 85, 247, 0.4)', amp: 10, freq: 0.035, phaseShift: Math.PI / 3 },
      { color: 'rgba(0, 255, 136, 0.25)', amp: 6, freq: 0.015, phaseShift: Math.PI / 1.5 }
    ];

    // Add a pulsing factor over time to make it feel responsive/alive
    const globalPulse = 1.0 + Math.sin(wavePhase * 0.4) * 0.2 + Math.random() * 0.15;

    waves.forEach(wave => {
      ctx.beginPath();
      ctx.strokeStyle = wave.color;
      ctx.lineWidth = 1.5;

      const midY = h / 2;

      for (let x = 0; x < w; x++) {
        // Gaussian envelope to taper wave off at borders: peak in center (midpoint)
        const mid = w / 2;
        const envelope = Math.exp(-Math.pow((x - mid) / (w / 3.5), 2));

        const y = midY + Math.sin(x * wave.freq + wavePhase + wave.phaseShift) * wave.amp * globalPulse * envelope;

        if (x === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();
    });
  }

  // Setup callbacks
  recognition.onstart = () => {
    isRecording = true;
    micBtn.classList.add('recording');
    overlay.style.display = 'flex';

    // Resize canvas pixels to match display size
    canvas.width = canvas.offsetWidth || 300;
    canvas.height = canvas.offsetHeight || 60;

    nativeHaptic('medium');
    playSynthSound('click');

    renderSiriWaves();
  };

  recognition.onresult = (evt) => {
    if (evt.results && evt.results[0] && evt.results[0][0]) {
      const text = evt.results[0][0].transcript;
      if (text) {
        // Safely append text to input
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const oldVal = textarea.value;

        const space = (oldVal && !oldVal.endsWith(' ') && start > 0) ? ' ' : '';
        const newVal = oldVal.substring(0, start) + space + text + oldVal.substring(end);
        
        textarea.value = newVal;
        textarea.focus();
        textarea.selectionStart = textarea.selectionEnd = start + space.length + text.length;

        // Dispatch input event for other framework listeners (like app state, sync counters)
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }
  };

  recognition.onerror = (evt) => {
    if (evt.error !== 'no-speech') {
      showNotificationToast(`Speech recognition error: ${evt.error}`, '⚠️');
      console.warn('Speech recognition error event:', evt.error);
    }
  };

  recognition.onend = () => {
    isRecording = false;
    micBtn.classList.remove('recording');
    overlay.style.display = 'none';

    if (animFrameId) {
      cancelAnimationFrame(animFrameId);
      animFrameId = null;
    }

    nativeHaptic('light');
  };

  // Toggle trigger
  micBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (isRecording) {
      recognition.stop();
    } else {
      try {
        recognition.start();
      } catch (err) {
        console.warn('Failed to start speech recognition:', err);
        showNotificationToast('Microphone is busy or permission was denied.', '⚠️');
      }
    }
  });
}
