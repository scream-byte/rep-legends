// Stress test for the sit-up counter: hundreds of random, REALISTIC sets — varying pace
// and height, fatigue (lower tops, slower reps, head stays a bit raised between reps),
// pauses, MediaPipe jitter and glitches, 15–30 fps with uneven frame times.
// The count must be EXACT in every set (same standard as squats). Run with: npm test
import { AbsCounter, type AbsFrame } from './abs.ts';

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}
const gauss = (r: () => number) => Math.sqrt(-2 * Math.log(r() + 1e-12)) * Math.cos(2 * Math.PI * r());

function frame(torso: number, hipX: number, len: number, otherTorso: number): AbsFrame {
  const side = (vis: number, tor: number) => ({ vis, torso: Math.max(0, tor), knee: 80, torsoLen: len, hip: { x: hipX, y: 520 }, points: [] });
  return { visible: true, side: 'left', torso, knee: 80, sides: { left: side(0.9, torso), right: side(0.7, otherTorso) }, points: null, lines: [], debug: '' };
}

interface SetResult {
  expected: number;
  counted: number;
  hints: string[];
}

function simulate(seed: number, reps: number, o: { fpsMin: number; fpsMax: number; noise: number; spikes: number }): SetResult {
  const r = rng(seed);
  const c = new AbsCounter();
  const hints: string[] = [];
  let t = 0;
  const fpsBase = o.fpsMin + (o.fpsMax - o.fpsMin) * r();
  const hipX = 300 + 20 * gauss(r);
  const restBase = 3 + 10 * r(); // how this athlete lies: flat … head a bit raised

  const emit = (torso: number) => {
    let a = torso + o.noise * 2 * gauss(r);
    if (r() < o.spikes) a += (r() < 0.5 ? -1 : 1) * (20 + 30 * r()); // MediaPipe glitch
    const u = c.update(frame(Math.max(0, a), hipX + 3 * gauss(r), 150 + 3 * gauss(r), a + 5 * gauss(r)), t);
    if (u.hint && u.hint !== 'lost') hints.push(u.hint);
    t += 1000 / (fpsBase * (0.85 + 0.3 * r()));
  };
  const hold = (ms: number, a: number) => {
    const end = t + ms;
    while (t < end) emit(a);
  };
  const steps = (ms: number, from: number, to: number) => {
    const start = t;
    while (t - start < ms) {
      const k = Math.min(1, (t - start) / ms);
      emit(from + (to - from) * ((1 - Math.cos(Math.PI * k)) / 2));
    }
  };

  hold(1500, restBase);
  let prev = restBase;
  for (let i = 0; i < reps; i++) {
    const fatigue = i / Math.max(1, reps - 1);
    const up = 450 + 700 * r() + 500 * fatigue;
    const down = 400 + 700 * r() + 400 * fatigue;
    const top = 66 + 22 * r() - 4 * fatigue; // just past half-way … to the knees
    const bottom = restBase + 6 * r() * fatigue; // tired: head / shoulders stay a little up
    const pauseTop = r() < 0.3 ? 400 * r() : 0;
    const pauseBottom = r() < 0.6 ? 800 * r() : 0;
    steps(up, prev, top);
    if (pauseTop) hold(pauseTop, top);
    steps(down, top, bottom);
    if (pauseBottom) hold(pauseBottom, bottom);
    prev = bottom;
  }
  hold(1500, restBase);
  return { expected: reps, counted: c.reps, hints };
}

let failed = 0;
let total = 0;
let exact = 0;
const report = (name: string, results: SetResult[]) => {
  const wrong = results.filter((x) => x.counted !== x.expected);
  const reps = results.reduce((s, x) => s + x.expected, 0);
  const counted = results.reduce((s, x) => s + x.counted, 0);
  const stray = results.reduce((s, x) => s + x.hints.length, 0);
  const ok = wrong.length === 0 && stray <= reps / 200;
  total += results.length;
  exact += results.length - wrong.length;
  if (!ok) failed += 1;
  console.log(
    `${ok ? 'PASS' : 'FAIL'}  abs stress: ${name}: ${results.length} sets, ${reps} reps → counted ${counted}` +
      ` (exact in ${results.length - wrong.length}/${results.length} sets), stray hints ${stray}` +
      (wrong.length ? ` — e.g. expected ${wrong[0].expected} got ${wrong[0].counted}, hints [${wrong[0].hints.join(",")}]` : ''),
  );
};

const sets = (n: number, seed0: number, o: { fpsMin: number; fpsMax: number; noise: number; spikes: number }) =>
  Array.from({ length: n }, (_, i) => simulate(seed0 + i * 7919, 10 + ((seed0 + i) % 31), o));

report('good phone (28–30 fps, light jitter)', sets(120, 1, { fpsMin: 28, fpsMax: 30, noise: 1, spikes: 0.005 }));
report('average phone (20–28 fps, normal jitter, glitches)', sets(120, 1001, { fpsMin: 20, fpsMax: 28, noise: 1.5, spikes: 0.02 }));
report('weak phone (15–20 fps, strong jitter, more glitches)', sets(120, 5001, { fpsMin: 15, fpsMax: 20, noise: 2, spikes: 0.04 }));
report('record attempt: 100 sit-ups in one set', [simulate(424242, 100, { fpsMin: 22, fpsMax: 28, noise: 1.5, spikes: 0.02 })]);

console.log(`abs stress total: count exact in ${exact}/${total} sets`);
if (failed) process.exitCode = 1;
