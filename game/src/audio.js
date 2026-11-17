// Synthesized WebAudio sound effects — no audio files, no network.
// The AudioContext is created lazily on the first user gesture (main.js
// calls ensureAudio() from a pointer/key handler). All methods are safe
// to call before that: they no-op until the context exists.
// This module touches the DOM (AudioContext) but is never imported by
// the Node-verified simulation (world.js / shots.js).

let ctx = null;
let master = null;
let droneNodes = null;
let muted = false;

export function isMuted() {
  return muted;
}

export function toggleMute() {
  muted = !muted;
  if (master) master.gain.value = muted ? 0 : 0.5;
  return muted;
}

// Must be called from a user gesture at least once.
export function ensureAudio() {
  if (ctx) {
    if (ctx.state === 'suspended') ctx.resume();
    return true;
  }
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.5;
    master.connect(ctx.destination);
    startDrone();
    return true;
  } catch (_e) {
    return false;
  }
}

function tone({ freq, freqEnd, dur, type = 'sine', vol = 0.3, delay = 0 }) {
  if (!ctx || !master) return;
  const t0 = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (freqEnd !== undefined) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, freqEnd), t0 + dur);
  }
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(vol, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g);
  g.connect(master);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

function noise({ dur, vol = 0.2, freq = 800, delay = 0 }) {
  if (!ctx || !master) return;
  const t0 = ctx.currentTime + delay;
  const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = freq;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(filter);
  filter.connect(g);
  g.connect(master);
  src.start(t0);
}

// Low ambient drone: two detuned sines through a lowpass, very quiet.
function startDrone() {
  if (!ctx || droneNodes) return;
  const g = ctx.createGain();
  g.gain.value = 0.05;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 220;
  const o1 = ctx.createOscillator();
  o1.type = 'sine';
  o1.frequency.value = 55;
  const o2 = ctx.createOscillator();
  o2.type = 'sine';
  o2.frequency.value = 55.7;
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 0.08;
  const lfoGain = ctx.createGain();
  lfoGain.gain.value = 0.02;
  lfo.connect(lfoGain);
  lfoGain.connect(g.gain);
  o1.connect(filter);
  o2.connect(filter);
  filter.connect(g);
  g.connect(master);
  o1.start();
  o2.start();
  lfo.start();
  droneNodes = { o1, o2, lfo, g };
}

export function playPickup() {
  tone({ freq: 880, freqEnd: 1320, dur: 0.14, type: 'sine', vol: 0.25 });
  tone({ freq: 1320, dur: 0.1, type: 'sine', vol: 0.15, delay: 0.06 });
}

export function playPulse() {
  tone({ freq: 160, freqEnd: 40, dur: 0.35, type: 'sine', vol: 0.5 });
  noise({ dur: 0.25, vol: 0.15, freq: 1200 });
}

export function playHit() {
  tone({ freq: 220, freqEnd: 55, dur: 0.4, type: 'sawtooth', vol: 0.35 });
  noise({ dur: 0.2, vol: 0.2, freq: 500 });
}

export function playWaveHorn() {
  tone({ freq: 196, dur: 0.5, type: 'triangle', vol: 0.3 });
  tone({ freq: 294, dur: 0.5, type: 'triangle', vol: 0.3, delay: 0.12 });
  tone({ freq: 392, dur: 0.6, type: 'triangle', vol: 0.25, delay: 0.24 });
}

export function playWin() {
  const notes = [523, 659, 784, 1047];
  notes.forEach((f, i) => tone({ freq: f, dur: 0.45, type: 'triangle', vol: 0.3, delay: i * 0.14 }));
  tone({ freq: 1319, dur: 0.8, type: 'triangle', vol: 0.25, delay: 0.6 });
}

export function playLose() {
  const notes = [392, 330, 262, 196];
  notes.forEach((f, i) => tone({ freq: f, dur: 0.5, type: 'sine', vol: 0.28, delay: i * 0.18 }));
}

export function playClick() {
  tone({ freq: 660, dur: 0.07, type: 'square', vol: 0.12 });
}

export function playKill() {
  tone({ freq: 520, freqEnd: 180, dur: 0.12, type: 'triangle', vol: 0.18 });
}
