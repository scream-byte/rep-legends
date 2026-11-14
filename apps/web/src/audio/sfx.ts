// Short synthesised sound effects (button taps, countdown, reps, finish).
// They go through the "effects" volume bus. Silent until the first tap.

import { audio, midiToHz, noiseBuffer } from './engine';

function tone(type: OscillatorType, freqFrom: number, freqTo: number, dur: number, level: number, delay = 0) {
  const a = audio();
  if (!a) return;
  const { ctx: c, sfx } = a;
  const t = c.currentTime + delay;
  const o = c.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freqFrom, t);
  if (freqTo !== freqFrom) o.frequency.exponentialRampToValueAtTime(freqTo, t + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(level, t + 0.005);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(sfx);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function thump(level: number) {
  const a = audio();
  if (!a) return;
  const { ctx: c, sfx } = a;
  const t = c.currentTime;
  const src = c.createBufferSource();
  src.buffer = noiseBuffer(c);
  const f = c.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = 1200;
  const g = c.createGain();
  g.gain.setValueAtTime(level, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
  src.connect(f).connect(g).connect(sfx);
  src.start(t);
  src.stop(t + 0.13);
}

export const sfx = {
  /** UI button tap */
  click() {
    tone('square', 660, 990, 0.06, 0.12);
  },
  /** soft toggle / slider feedback */
  tick() {
    tone('sine', 1200, 1200, 0.04, 0.1);
  },
  /** 3-2-1 countdown beep */
  countdown() {
    tone('sine', 880, 880, 0.14, 0.3);
  },
  /** "GO!" */
  go() {
    [72, 76, 79, 84].forEach((m) => tone('square', midiToHz(m), midiToHz(m), 0.35, 0.09));
    thump(0.4);
  },
  /** a counted rep: punchy hit + bright ping */
  rep() {
    thump(0.6);
    tone('sine', 160, 55, 0.18, 0.6);
    tone('triangle', midiToHz(84), midiToHz(84), 0.2, 0.18, 0.02);
  },
  /** form warning ("go lower!") */
  warn() {
    tone('square', 220, 180, 0.16, 0.1);
  },
  /** end of set: little fanfare */
  finish() {
    [
      [72, 0],
      [76, 0.12],
      [79, 0.24],
      [84, 0.36],
    ].forEach(([m, d]) => tone('sawtooth', midiToHz(m), midiToHz(m), d === 0.36 ? 0.6 : 0.16, 0.09, d));
  },
};
