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

// ─── Mindset Zen Audio Generators ──────────────────────────────────────────

let _binauralNodes = null; // { leftOsc, rightOsc, leftGain, rightGain }

export function startBinauralBeat(frequencyLeft = 150, frequencyRight = 155) {
  if (isMuted()) return;
  stopBinauralBeat();
  const ctx = getAudioContext();
  if (!ctx) return;
  
  try {
    const now = ctx.currentTime;
    
    const leftOsc = ctx.createOscillator();
    const rightOsc = ctx.createOscillator();
    
    const leftGain = ctx.createGain();
    const rightGain = ctx.createGain();
    
    const leftPanner = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    const rightPanner = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    
    leftOsc.type = 'sine';
    leftOsc.frequency.setValueAtTime(frequencyLeft, now);
    
    rightOsc.type = 'sine';
    rightOsc.frequency.setValueAtTime(frequencyRight, now);
    
    leftGain.gain.setValueAtTime(0.08, now);
    rightGain.gain.setValueAtTime(0.08, now);
    
    if (leftPanner && rightPanner) {
      leftPanner.pan.setValueAtTime(-1, now);
      rightPanner.pan.setValueAtTime(1, now);
      
      leftOsc.connect(leftGain);
      leftGain.connect(leftPanner);
      leftPanner.connect(ctx.destination);
      
      rightOsc.connect(rightGain);
      rightGain.connect(rightPanner);
      rightPanner.connect(ctx.destination);
    } else {
      leftOsc.connect(leftGain);
      leftGain.connect(ctx.destination);
      
      rightOsc.connect(rightGain);
      rightGain.connect(ctx.destination);
    }
    
    leftOsc.start(now);
    rightOsc.start(now);
    
    _binauralNodes = { leftOsc, rightOsc, leftGain, rightGain };
  } catch (err) {
    console.warn('Binaural beat play failed:', err);
  }
}

export function stopBinauralBeat() {
  if (_binauralNodes) {
    try {
      _binauralNodes.leftOsc.stop();
      _binauralNodes.rightOsc.stop();
    } catch (e) {}
      _binauralNodes = null;
  }
}

let _ambientDroneNodes = null;

export function startAmbientDrone(type = 'focus') {
  if (isMuted()) return;
  stopAmbientDrone();
  const ctx = getAudioContext();
  if (!ctx) return;
  
  try {
    const now = ctx.currentTime;
    
    // Create oscillators
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const lfo = ctx.createOscillator();
    
    const osc1Gain = ctx.createGain();
    const osc2Gain = ctx.createGain();
    const masterGain = ctx.createGain();
    
    // Frequencies depending on type
    let f1 = 110; // A2
    let f2 = 165; // E3 (Perfect fifth)
    if (type === 'zen') {
      f1 = 82.41; // E2 (Lower grounding pitch)
      f2 = 123.47; // B2
    } else if (type === 'alpha') {
      f1 = 130.81; // C3
      f2 = 196.00; // G3
    }
    
    osc1.type = 'triangle';
    osc1.frequency.setValueAtTime(f1, now);
    
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(f2, now);
    
    // Slow LFO to modulate volume like ocean waves (~0.12 Hz frequency = ~8 seconds per wave cycle)
    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(0.12, now);
    
    const lfoGain = ctx.createGain();
    lfoGain.gain.setValueAtTime(0.04, now);
    
    osc1Gain.gain.setValueAtTime(0.04, now);
    osc2Gain.gain.setValueAtTime(0.03, now);
    
    masterGain.gain.setValueAtTime(0.12, now);
    
    // Connect LFO modulator to gain nodes
    lfo.connect(lfoGain);
    lfoGain.connect(masterGain.gain);
    
    osc1.connect(osc1Gain);
    osc2.connect(osc2Gain);
    
    osc1Gain.connect(masterGain);
    osc2Gain.connect(masterGain);
    
    masterGain.connect(ctx.destination);
    
    osc1.start(now);
    osc2.start(now);
    lfo.start(now);
    
    _ambientDroneNodes = { osc1, osc2, lfo, masterGain };
  } catch (err) {
    console.warn('Ambient drone play failed:', err);
  }
}

export function stopAmbientDrone() {
  if (_ambientDroneNodes) {
    try {
      _ambientDroneNodes.osc1.stop();
      _ambientDroneNodes.osc2.stop();
      _ambientDroneNodes.lfo.stop();
    } catch (e) {}
    _ambientDroneNodes = null;
  }
}
