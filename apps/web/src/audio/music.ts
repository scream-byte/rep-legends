// Original main-menu theme, synthesised live with Web Audio:
// a triumphant 8-bar loop in C major at 112 BPM — brass-like chords,
// a marching bass, a sparkling arpeggio, drums with a timpani roll,
// and a heroic fanfare melody on every other pass.

import { audio, midiToHz, noiseBuffer, onUnlock } from './engine';

const BPM = 112;
const STEP = 60 / BPM / 4; // one 16th note, seconds
const STEPS_PER_BAR = 16;
const BARS = 8;
const LOOKAHEAD = 0.15; // schedule this far ahead, seconds
const TICK_MS = 30;

// Chord per bar: [bass root, chord tones]  (MIDI note numbers)
const CHORDS: Array<[number, number[]]> = [
  [36, [60, 64, 67]], // C
  [43, [59, 62, 67]], // G/B voicing
  [45, [57, 60, 64]], // Am
  [41, [57, 60, 65]], // F
  [36, [60, 64, 67]], // C
  [43, [59, 62, 67]], // G
  [41, [57, 60, 65]], // F
  [43, [59, 62, 67]], // G
];

// Fanfare melody: per bar, [step, midi, length in 16ths]
const MELODY: Array<Array<[number, number, number]>> = [
  [[0, 67, 3], [3, 67, 1], [4, 72, 4], [8, 76, 6], [14, 74, 2]],
  [[0, 74, 3], [3, 71, 1], [4, 67, 4], [8, 74, 8]],
  [[0, 72, 3], [3, 72, 1], [4, 76, 4], [8, 79, 6], [14, 77, 2]],
  [[0, 76, 4], [4, 72, 4], [8, 77, 8]],
  [[0, 79, 3], [3, 79, 1], [4, 84, 8], [12, 83, 2], [14, 81, 2]],
  [[0, 79, 6], [6, 74, 2], [8, 79, 8]],
  [[0, 77, 3], [3, 76, 1], [4, 77, 4], [8, 81, 4], [12, 79, 4]],
  [[0, 79, 4], [4, 83, 4], [8, 86, 8]],
];

let timer: number | null = null;
let nextTime = 0;
let step = 0; // position in the whole loop, 0..BARS*16-1
let loop = 0;
let songBus: GainNode | null = null;
let wanted = false;

// ---------- instruments ----------

function brass(c: AudioContext, out: AudioNode, notes: number[], t: number, dur: number) {
  const filter = c.createBiquadFilter();
  filter.type = 'lowpass';
  filter.Q.value = 1;
  filter.frequency.setValueAtTime(700, t);
  filter.frequency.linearRampToValueAtTime(2200, t + 0.12);
  filter.frequency.linearRampToValueAtTime(1300, t + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(0.055, t + 0.06);
  g.gain.setValueAtTime(0.05, t + dur - 0.08);
  g.gain.linearRampToValueAtTime(0, t + dur);
  filter.connect(g).connect(out);
  for (const n of notes) {
    for (const detune of [-7, 7]) {
      const o = c.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = midiToHz(n);
      o.detune.value = detune;
      o.connect(filter);
      o.start(t);
      o.stop(t + dur + 0.02);
    }
  }
}

function bass(c: AudioContext, out: AudioNode, note: number, t: number) {
  const o = c.createOscillator();
  o.type = 'sawtooth';
  o.frequency.value = midiToHz(note);
  const f = c.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.setValueAtTime(900, t);
  f.frequency.exponentialRampToValueAtTime(200, t + STEP * 1.8);
  const g = c.createGain();
  g.gain.setValueAtTime(0.16, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + STEP * 1.9);
  o.connect(f).connect(g).connect(out);
  o.start(t);
  o.stop(t + STEP * 2);
}

function pluck(c: AudioContext, out: AudioNode, note: number, t: number) {
  const o = c.createOscillator();
  o.type = 'triangle';
  o.frequency.value = midiToHz(note);
  const g = c.createGain();
  g.gain.setValueAtTime(0.045, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
  o.connect(g).connect(out);
  o.start(t);
  o.stop(t + 0.2);
}

function lead(c: AudioContext, out: AudioNode, note: number, t: number, dur: number) {
  const g = c.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(0.085, t + 0.03);
  g.gain.setValueAtTime(0.075, t + Math.max(0.04, dur - 0.06));
  g.gain.linearRampToValueAtTime(0, t + dur);
  const f = c.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = 3000;
  f.connect(g).connect(out);
  // a touch of vibrato on long notes, like a trumpet
  const vib = c.createOscillator();
  const vibDepth = c.createGain();
  vib.frequency.value = 5.5;
  vibDepth.gain.setValueAtTime(0, t);
  vibDepth.gain.linearRampToValueAtTime(dur > 0.4 ? 9 : 0, t + 0.25);
  vib.connect(vibDepth);
  for (const [type, detune] of [['sawtooth', -4], ['square', 4]] as const) {
    const o = c.createOscillator();
    o.type = type;
    o.frequency.value = midiToHz(note);
    o.detune.value = detune;
    vibDepth.connect(o.detune);
    o.connect(f);
    o.start(t);
    o.stop(t + dur + 0.02);
  }
  vib.start(t);
  vib.stop(t + dur + 0.02);
}

function kick(c: AudioContext, out: AudioNode, t: number, level = 0.5) {
  const o = c.createOscillator();
  o.frequency.setValueAtTime(140, t);
  o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
  const g = c.createGain();
  g.gain.setValueAtTime(level, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
  o.connect(g).connect(out);
  o.start(t);
  o.stop(t + 0.26);
}

function noiseHit(c: AudioContext, out: AudioNode, t: number, type: BiquadFilterType, freq: number, level: number, decay: number) {
  const src = c.createBufferSource();
  src.buffer = noiseBuffer(c);
  const f = c.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  const g = c.createGain();
  g.gain.setValueAtTime(level, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + decay);
  src.connect(f).connect(g).connect(out);
  src.start(t, Math.random() * 0.5);
  src.stop(t + decay + 0.01);
}

function timpani(c: AudioContext, out: AudioNode, note: number, t: number, level: number) {
  const o = c.createOscillator();
  o.frequency.setValueAtTime(midiToHz(note) * 1.04, t);
  o.frequency.exponentialRampToValueAtTime(midiToHz(note), t + 0.08);
  const g = c.createGain();
  g.gain.setValueAtTime(level, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
  o.connect(g).connect(out);
  o.start(t);
  o.stop(t + 0.52);
}

// ---------- sequencer ----------

function scheduleStep(c: AudioContext, out: AudioNode, s: number, t: number) {
  const bar = Math.floor(s / STEPS_PER_BAR);
  const pos = s % STEPS_PER_BAR;
  const [root, chord] = CHORDS[bar];
  const lastBar = bar === BARS - 1;

  // chords: held for the whole bar
  if (pos === 0) brass(c, out, chord, t, STEP * STEPS_PER_BAR);

  // marching bass on 8ths, octave jump on the off-beat
  if (pos % 2 === 0) bass(c, out, pos % 4 === 2 ? root + 12 : root, t);

  // sparkling arpeggio, an octave up (second half of the loop only, to build energy)
  if (bar >= 4 || loop > 0) pluck(c, out, chord[pos % 3] + 12 + (pos % 6 >= 3 ? 12 : 0), t);

  // drums
  if (pos === 0 || pos === 8 || (pos === 10 && bar % 2 === 1)) kick(c, out, t);
  if (pos === 4 || pos === 12) noiseHit(c, out, t, 'bandpass', 1800, 0.35, 0.18); // snare
  if (pos % 2 === 0) noiseHit(c, out, t, 'highpass', 8000, pos % 4 === 0 ? 0.05 : 0.03, 0.04); // hi-hat

  // timpani roll leading back to the top of the loop
  if (lastBar && pos >= 8) timpani(c, out, pos >= 12 ? 43 : 36, t, 0.12 + (pos - 8) * 0.03);
  if (bar === 0 && pos === 0) noiseHit(c, out, t, 'highpass', 4000, 0.18, 1.2); // cymbal crash

  // fanfare melody every other pass
  if (loop % 2 === 1) {
    for (const [at, note, len] of MELODY[bar]) if (at === pos) lead(c, out, note, t, STEP * len * 0.95);
  }
}

function tick() {
  const a = audio();
  if (!a || !songBus) return;
  // After the app was in the background, don't fire a burst of missed notes.
  if (nextTime < a.ctx.currentTime - 0.2) nextTime = a.ctx.currentTime + 0.05;
  while (nextTime < a.ctx.currentTime + LOOKAHEAD) {
    scheduleStep(a.ctx, songBus, step, nextTime);
    nextTime += STEP;
    step += 1;
    if (step >= BARS * STEPS_PER_BAR) {
      step = 0;
      loop += 1;
    }
  }
}

function startNow() {
  const a = audio();
  if (!a || timer != null || !wanted) return;
  songBus = a.ctx.createGain();
  songBus.gain.setValueAtTime(0, a.ctx.currentTime);
  songBus.gain.linearRampToValueAtTime(1, a.ctx.currentTime + 1.5); // fade in
  songBus.connect(a.music);
  step = 0;
  loop = 0;
  nextTime = a.ctx.currentTime + 0.1;
  timer = window.setInterval(tick, TICK_MS);
  tick();
}

/** Starts the menu theme (waits for the first tap if audio is still locked). */
export function playMenuMusic(): void {
  wanted = true;
  onUnlock(startNow);
}

/** Fades the theme out and stops scheduling. */
export function stopMenuMusic(): void {
  wanted = false;
  if (timer != null) {
    clearInterval(timer);
    timer = null;
  }
  const a = audio();
  const bus = songBus;
  songBus = null;
  if (a && bus) {
    const t = a.ctx.currentTime;
    bus.gain.cancelScheduledValues(t);
    bus.gain.setValueAtTime(bus.gain.value, t);
    bus.gain.linearRampToValueAtTime(0, t + 0.6);
    window.setTimeout(() => bus.disconnect(), 800);
  }
}
