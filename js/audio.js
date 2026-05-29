// retro synth sound effects (Web Audio API)

import storage from './storage.js';

let _audioCtx = null;

function getAudioContext() {
  if (isMuted()) return null;
  
  if (!_audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      _audioCtx = new AudioContextClass();
    }
  }
  
  // resume if suspended (chrome/safari autoplay policy)
  if (_audioCtx && _audioCtx.state === 'suspended') {
    _audioCtx.resume();
  }
  
  return _audioCtx;
}

export function isMuted() {
  return storage.get('audio_muted', false);
}

export function setMuted(muted) {
  storage.set('audio_muted', !!muted);
  if (muted && _audioCtx) {
    _audioCtx.close().then(() => {
      _audioCtx = null;
    });
  }
}

export function toggleMute() {
  const nextState = !isMuted();
  setMuted(nextState);
  return nextState;
}

export function playSynthSound(type) {
  if (isMuted()) return;

  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    
    switch (type) {
      case 'click': {

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(1000, now);
        osc.frequency.exponentialRampToValueAtTime(1500, now + 0.04);

        gain.gain.setValueAtTime(0.06, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now);
        osc.stop(now + 0.05);
        break;
      }
      
      case 'success': {

        const notes = [523.25, 659.25, 783.99]; // C5, E5, G5
        notes.forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, now + idx * 0.08);
          
          gain.gain.setValueAtTime(0.08, now + idx * 0.08);
          gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.12);
          
          osc.connect(gain);
          gain.connect(ctx.destination);
          
          osc.start(now + idx * 0.08);
          osc.stop(now + idx * 0.08 + 0.15);
        });
        break;
      }
      
      case 'fail': {

        const notes = [196.00, 164.81]; // G3, E3
        notes.forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(freq, now + idx * 0.12);
          
          gain.gain.setValueAtTime(0.08, now + idx * 0.12);
          gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.12 + 0.16);
          
          osc.connect(gain);
          gain.connect(ctx.destination);
          
          osc.start(now + idx * 0.12);
          osc.stop(now + idx * 0.12 + 0.18);
        });
        break;
      }
      
      case 'fanfare': {

        const notes = [523.25, 783.99, 1046.50, 1318.51, 1567.98]; // C5, G5, C6, E6, G6
        notes.forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          
          osc.type = 'square';
          osc.frequency.setValueAtTime(freq, now + idx * 0.06);
          
          gain.gain.setValueAtTime(0.05, now + idx * 0.06);
          gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.06 + 0.25);
          
          osc.connect(gain);
          gain.connect(ctx.destination);
          
          osc.start(now + idx * 0.06);
          osc.stop(now + idx * 0.06 + 0.28);
        });
        break;
      }
    }
  } catch (err) {
    console.warn('Retro synth audio play failed:', err);
  }
}
