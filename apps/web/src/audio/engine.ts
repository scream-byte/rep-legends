// Shared Web Audio setup: one AudioContext with three volume buses
//   master ← music
//          ← sfx
// Browsers only allow sound after the first tap, so the context is created /
// resumed on the first pointer event. Everything is synthesised in code —
// no audio files, nothing to license.

export interface Volumes {
  master: number; // 0..100
  music: number;
  sfx: number;
}

let ctx: AudioContext | null = null;
let masterBus: GainNode | null = null;
let musicBus: GainNode | null = null;
let sfxBus: GainNode | null = null;
let volumes: Volumes = { master: 80, music: 60, sfx: 80 };
const unlockListeners: Array<() => void> = [];

// Perceived loudness is roughly logarithmic: squaring the slider feels more even.
const toGain = (v: number) => Math.pow(Math.max(0, Math.min(100, v)) / 100, 2);

function applyVolumes() {
  if (!ctx || !masterBus || !musicBus || !sfxBus) return;
  const t = ctx.currentTime;
  masterBus.gain.setTargetAtTime(toGain(volumes.master), t, 0.05);
  musicBus.gain.setTargetAtTime(toGain(volumes.music), t, 0.05);
  sfxBus.gain.setTargetAtTime(toGain(volumes.sfx), t, 0.05);
}

function ensureContext(): AudioContext | null {
  if (ctx) return ctx;
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  masterBus = ctx.createGain();
  musicBus = ctx.createGain();
  sfxBus = ctx.createGain();
  // A gentle limiter so music + effects never clip.
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -6;
  limiter.ratio.value = 8;
  musicBus.connect(masterBus);
  sfxBus.connect(masterBus);
  masterBus.connect(limiter).connect(ctx.destination);
  applyVolumes();
  return ctx;
}

/** True once the browser allowed audio (after the first tap). */
export function isUnlocked(): boolean {
  return ctx?.state === 'running';
}

/** Runs `cb` as soon as audio is allowed (immediately if it already is). */
export function onUnlock(cb: () => void): void {
  if (isUnlocked()) cb();
  else unlockListeners.push(cb);
}

function unlock() {
  const c = ensureContext();
  if (!c) return;
  c.resume()
    .then(() => {
      while (unlockListeners.length) unlockListeners.shift()!();
    })
    .catch(() => {});
}

/** Call once at startup: listens for the first tap and pauses audio in the background. */
export function initAudio(): void {
  const events = ['pointerdown', 'touchend', 'keydown'] as const;
  const handler = () => {
    unlock();
    if (isUnlocked()) events.forEach((e) => window.removeEventListener(e, handler));
  };
  events.forEach((e) => window.addEventListener(e, handler, { passive: true }));

  document.addEventListener('visibilitychange', () => {
    if (!ctx) return;
    if (document.hidden) ctx.suspend().catch(() => {});
    else ctx.resume().catch(() => {});
  });
}

export function setVolumes(v: Volumes): void {
  volumes = v;
  applyVolumes();
}

/** The live context and buses, or null before the first tap. */
export function audio(): { ctx: AudioContext; music: GainNode; sfx: GainNode } | null {
  if (!ctx || !musicBus || !sfxBus || ctx.state !== 'running') return null;
  return { ctx, music: musicBus, sfx: sfxBus };
}

let noise: AudioBuffer | null = null;
/** One second of white noise, reused for drums and impacts. */
export function noiseBuffer(c: AudioContext): AudioBuffer {
  if (noise && noise.sampleRate === c.sampleRate) return noise;
  noise = c.createBuffer(1, c.sampleRate, c.sampleRate);
  const data = noise.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return noise;
}

export const midiToHz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
