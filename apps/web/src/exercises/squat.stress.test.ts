// Stress test for the squat counter: hundreds of random, REALISTIC sets — varying pace,
// depth, incomplete lock-out at the top (fatigue), pauses, MediaPipe jitter and
// occasional spikes, 18–30 fps with uneven frame times. The count must be EXACT
// in every set (user's request 2026-11-24 after 20 of 22 reps were counted).
// Run with: npm test
import { SquatCounter, type SquatFrame } from './squat.ts';

// Small seeded random generator so failures are reproducible.
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}
const gauss = (r: () => number) => Math.sqrt(-2 * Math.log(r() + 1e-12)) * Math.cos(2 * Math.PI * r());

const STAND_H = 400;
function frame(knee: number, drop: number, lean: number, x: number): SquatFrame {
  return {
    visible: true,
    side: 'left',
    knee,
    lean,
    frontFacing: false,
    sides: { left: { vis: 0.9, knee, lean, points: [] }, right: { vis: 0.75, knee: knee + 6, lean, points: [] } },
    hipY: 600 - STAND_H * (1 - drop),
    ankleY: 600,
    ankleX: x,
    points: null,
    lines: [],
    debug: '',
  };
}

interface SetResult {
  expected: number;
  counted: number;
  hints: string[];
}

/** Simulates one set of `reps` squats with the given random generator. */
function simulate(seed: number, reps: number, opts: { fpsMin: number; fpsMax: number; noise: number; spikes: number }): SetResult {
  const r = rng(seed);
  const c = new SquatCounter();
  const hints: string[] = [];
  let t = 0;
  const fpsBase = opts.fpsMin + (opts.fpsMax - opts.fpsMin) * r();
  const x0 = 240 + 20 * gauss(r);

  // one camera frame of the given "true" pose, with jitter / spikes / uneven timing
  const emit = (knee: number, drop: number, lean: number) => {
    let k = knee + opts.noise * 4 * gauss(r);
    const d = drop + opts.noise * 0.012 * gauss(r);
    if (r() < opts.spikes) k += (r() < 0.5 ? -1 : 1) * (25 + 30 * r()); // MediaPipe glitch
    const u = c.update(frame(k, d, lean + 3 * gauss(r), x0 + 4 * gauss(r)), t);
    if (u.hint && u.hint !== 'lost') hints.push(u.hint);
    t += 1000 / (fpsBase * (0.85 + 0.3 * r())); // uneven frame times
  };
  const hold = (ms: number, knee: number, drop: number, lean: number) => {
    const end = t + ms;
    while (t < end) emit(knee, drop, lean);
  };

  hold(1500, 174, 0, 8); // standing after the countdown
  // where the athlete actually stands right now (the next rep starts from here — a real
  // person never "teleports" to a different standing height between frames)
  let prevTop: [number, number, number] = [174, 0, 8];
  for (let i = 0; i < reps; i++) {
    const fatigue = i / Math.max(1, reps - 1); // later reps: slower, shallower lock-out
    const down = 450 + 700 * r() + 400 * fatigue; // descent time
    const up = 400 + 600 * r() + 500 * fatigue; // ascent time
    const depthDrop = 0.33 + 0.22 * r(); // hips at the bottom: just-parallel … deep
    const depthKnee = 112 - 35 * ((depthDrop - 0.33) / 0.22) - 4 * r();
    const topDrop = 0.06 * r() * (0.5 + fatigue); // incomplete lock-out when tired
    const topKnee = 175 - 22 * r() * (0.4 + fatigue); // knees not fully straight
    const lean = 25 + 30 * r();
    const pauseBottom = r() < 0.3 ? 300 * r() : 0;
    const pauseTop = r() < 0.5 ? 600 * r() : 0; // many athletes don't pause at all

    const steps = (ms: number, from: [number, number, number], to: [number, number, number]) => {
      const start = t;
      while (t - start < ms) {
        const k = Math.min(1, (t - start) / ms);
        const e = (1 - Math.cos(Math.PI * k)) / 2; // smooth ease in/out
        emit(from[0] + (to[0] - from[0]) * e, from[1] + (to[1] - from[1]) * e, from[2] + (to[2] - from[2]) * e);
      }
    };
    const top: [number, number, number] = [topKnee, topDrop, 10];
    const bottom: [number, number, number] = [depthKnee, depthDrop, lean];
    steps(down, prevTop, bottom);
    if (pauseBottom) hold(pauseBottom, bottom[0], bottom[1], bottom[2]);
    steps(up, bottom, top);
    if (pauseTop) hold(pauseTop, top[0], top[1], top[2]);
    prevTop = top;
  }
  hold(1500, 174, 0, 8); // stands still at the end
  return { expected: reps, counted: c.reps, hints };
}

// Two requirements:
//   1. the COUNT must be exact in every single set (hard — this is what records rely on);
//   2. stray hints (e.g. a "a bit lower" caused by jitter) — at most 1 per 200 reps (soft:
//      they don't change the count; making the counter deafer would miss real mini squats).
let failed = 0;
let total = 0;
let exact = 0;
const report = (name: string, results: SetResult[]) => {
  const wrongCount = results.filter((x) => x.counted !== x.expected);
  const reps = results.reduce((s, x) => s + x.expected, 0);
  const counted = results.reduce((s, x) => s + x.counted, 0);
  const strayHints = results.reduce((s, x) => s + x.hints.length, 0);
  const hintsOk = strayHints <= reps / 200;
  const ok = wrongCount.length === 0 && hintsOk;
  total += results.length;
  exact += results.length - wrongCount.length;
  if (!ok) failed += 1;
  console.log(
    `${ok ? 'PASS' : 'FAIL'}  squat stress: ${name}: ${results.length} sets, ${reps} reps → counted ${counted}` +
      ` (exact in ${results.length - wrongCount.length}/${results.length} sets), stray hints ${strayHints} (1 per ${strayHints ? Math.round(reps / strayHints) : '∞'} reps)` +
      (wrongCount.length ? ` — e.g. expected ${wrongCount[0].expected} got ${wrongCount[0].counted}` : ''),
  );
};

const sets = (n: number, seed0: number, o: { fpsMin: number; fpsMax: number; noise: number; spikes: number }) =>
  Array.from({ length: n }, (_, i) => simulate(seed0 + i * 7919, 10 + ((seed0 + i) % 31), o));

report('good phone (28–30 fps, light jitter)', sets(120, 1, { fpsMin: 28, fpsMax: 30, noise: 1, spikes: 0.005 }));
report('average phone (20–28 fps, normal jitter, glitches)', sets(120, 1001, { fpsMin: 20, fpsMax: 28, noise: 1.5, spikes: 0.02 }));
report('weak phone (15–20 fps, strong jitter, more glitches)', sets(120, 5001, { fpsMin: 15, fpsMax: 20, noise: 2, spikes: 0.04 }));
report('record attempt: 100 squats in one set', [simulate(424242, 100, { fpsMin: 22, fpsMax: 28, noise: 1.5, spikes: 0.02 })]);

console.log(`squat stress total: count exact in ${exact}/${total} sets`);
if (failed) process.exitCode = 1;
