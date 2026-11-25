// Synthetic tests for the sit-up ("abs") counter. Lessons from squats applied up front:
// partial reps, lying-down check, jitter, side swaps, moving to the phone. Run with: npm test
import { absCalibrationHint, AbsCounter, measureAbs, type AbsFrame, type AbsSideData } from './abs.ts';

const FPS = 30;

type Opts = { knee?: number; vis?: number; otherVis?: number; otherTorso?: number; hipX?: number; len?: number };
/** A frame with the given torso angle off the floor (degrees). */
const frame = (torso: number, o: Opts = {}): AbsFrame => {
  const len = o.len ?? 150;
  const side = (vis: number, tor: number): AbsSideData => ({ vis, torso: tor, knee: o.knee ?? 80, torsoLen: len, hip: { x: o.hipX ?? 300, y: 520 }, points: [] });
  return {
    visible: true,
    side: 'left',
    torso,
    knee: o.knee ?? 80,
    sides: { left: side(o.vis ?? 0.95, torso), right: side(o.otherVis ?? 0.7, o.otherTorso ?? torso + 4) },
    points: null,
    lines: [],
    debug: '',
  };
};

/** One sit-up: lying (`rest`) → `top` → lying over `ms`. */
function situp(ms: number, top = 75, rest = 8, extra: (i: number, f: AbsFrame) => AbsFrame = (_, f) => f): AbsFrame[] {
  const n = Math.round((ms / 1000) * FPS);
  return Array.from({ length: n }, (_, i) => {
    const k = (1 - Math.cos((2 * Math.PI * i) / n)) / 2;
    return extra(i, frame(rest + (top - rest) * k));
  });
}
const lie = (n = 8, torso = 8, o: Opts = {}) => Array.from({ length: n }, () => frame(torso, o));
const times = <T,>(n: number, fn: () => T[]) => Array.from({ length: n }, fn).flat();

let failed = false;
function run(name: string, seq: AbsFrame[], expect: number, expectHints: string[] | ((h: string[]) => boolean) = [], fps = FPS) {
  const c = new AbsCounter();
  const hints: string[] = [];
  let t = 1000;
  for (const f of [...lie(), ...seq, ...lie()]) {
    const u = c.update(f, t);
    if (u.hint && u.hint !== 'lost') hints.push(u.hint);
    t += 1000 / fps;
  }
  const hintsOk = typeof expectHints === 'function' ? expectHints(hints) : JSON.stringify(hints) === JSON.stringify(expectHints);
  const ok = c.reps === expect && hintsOk;
  const shown = [...new Set(hints)].map((h) => `${h}×${hints.filter((x) => x === h).length}`).join(', ');
  console.log(`${ok ? 'PASS' : 'FAIL'}  abs: ${name}: reps=${c.reps} hints=[${shown}]${ok ? '' : `  (expected reps=${expect})`}`);
  if (!ok) failed = true;
}

// ---------- normal sit-ups ----------
run('1 normal sit-up (1.8 s)', situp(1800), 1);
run('30 sit-ups in a row', times(30, () => [...situp(1800), ...lie(4)]), 30);
run('just half-way up (62°) counts — moderate standard', situp(1800, 62), 1);
run('all the way to the knees (reads ~85°)', situp(2000, 85), 1);
run('15 brisk sit-ups (1.1 s each, no pause)', times(15, () => situp(1100)), 15);
run('slow sit-up (4 s)', situp(4000), 1);
run('lies with the head raised (rest 18°)', times(5, () => [...situp(1800, 75, 18), ...lie(4, 18)]), 5);
run('15 fps phone', times(5, () => [...situp(1800), ...lie(4)].filter((_, i) => i % 2 === 0)), 5, [], 15);
{
  // starts right after "3-2-1" without any lying frames before the first rep
  const c = new AbsCounter();
  let t = 0;
  for (const f of [...times(5, () => situp(1600)), ...lie(6)]) {
    c.update(f, t);
    t += 1000 / FPS;
  }
  const ok = c.reps === 5;
  console.log(`${ok ? 'PASS' : 'FAIL'}  abs: starts immediately after the countdown: reps=${c.reps} of 5`);
  if (!ok) failed = true;
}

// ---------- form ----------
run('only lifted the shoulders (35°) → "higher!"', situp(1400, 35), 0, ['higher']);
run('5 small crunches (35°) → 0, "higher!" every time', times(5, () => [...situp(1200, 35), ...lie(6)]), 0, ['higher', 'higher', 'higher', 'higher', 'higher']);
run('head nods (16°) → nothing at all', times(5, () => [...situp(900, 16), ...lie(6)]), 0);
// the first jerk follows a slow rep (cycle long enough); throwing yourself up again and again is flagged
run('1 normal, then 3 jerks (0.5 s each) → "too fast" from the 2nd jerk', [...situp(1800), ...times(3, () => situp(500))], 2, ['fast', 'fast']);
run('20 brisk sit-ups at 1.0 s, 15 fps → all count', times(20, () => situp(1000)).filter((_, i) => i % 2 === 0), 20, [], 15);
{
  // lies down after rep 1, then hovers at ~40° (never lies down) → only the first hover rep counts
  const seq = [...situp(1800)];
  for (let i = 0; i < 4; i++) {
    const n = 54;
    for (let j = 0; j < n; j++) seq.push(frame(40 + 35 * (1 - Math.cos((2 * Math.PI * j) / n)) / 2));
  }
  run('stays half-up between reps (40°) → "lie down!", not counted', [...seq, ...lie(10)], 2, (h) => JSON.stringify(h) === JSON.stringify(['down', 'down', 'down']));
}

// ---------- camera noise ----------
run('lying still with single-frame spikes to 70° → 0', Array.from({ length: 120 }, (_, i) => (i % 13 === 6 ? frame(70) : frame(8))), 0, (h) => h.length === 0);
run('10 sit-ups with spikes (up AND down) → no double counts', times(10, () => [...situp(1800, 75, 8, (i, f) => (i % 7 === 3 ? frame(i % 14 === 3 ? 10 : 80) : f)), ...lie(4)]), 10);
run(
  'other side briefly "better" (3 frames) → no side jump',
  times(8, () => [...situp(1800, 75, 8, (i, f) => (i >= 20 && i <= 22 ? frame(f.torso!, { vis: 0.6, otherVis: 0.95, otherTorso: 5 }) : f)), ...lie(4)]),
  8,
);
run('brief loss of tracking mid-rep', situp(1800).map((f, i) => (i > 20 && i < 26 ? { ...f, visible: false } : f)), 1);

// walked to the phone (bigger + moved), "sat up" there → not counted
const walk = [
  ...Array.from({ length: 30 }, (_, i) => frame(10, { len: 150 * (1 + 0.5 * (i / 29)), hipX: 300 - 150 * (i / 29) })),
  ...situp(1600).map((f) => frame(f.torso!, { len: 225, hipX: 150 })),
];
run('moved to the phone and sat up there → NOT counted ("back to your spot")', walk, 0, (h) => h.includes('place'));
const newSpot = [
  ...Array.from({ length: 20 }, (_, i) => frame(8, { hipX: 300 + 200 * (i / 19) })),
  ...lie(100, 8, { hipX: 500 }),
  ...situp(1800).map((f) => frame(f.torso!, { hipX: 500 })),
];
run('lay down at a new spot and stayed → counts again', newSpot, 1, (h) => h.includes('place'));

// ---------- measureAbs on synthetic landmarks (480x640 portrait) ----------
function body(o: { shX: number; shY: number; kneeX: number; kneeY: number; ankX?: number; vis?: number }) {
  const lms = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 0.2 }));
  const v = o.vis ?? 0.95;
  const set = (i: number, x: number, y: number) => (lms[i] = { x, y, visibility: v });
  set(11, o.shX, o.shY); // left shoulder
  set(23, 0.5, 0.8); // left hip
  set(25, o.kneeX, o.kneeY); // left knee
  set(27, o.ankX ?? 0.8, 0.82); // left ankle
  return lms;
}
function check(name: string, ok: boolean, info: string) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  abs: ${name}: ${info}`);
  if (!ok) failed = true;
}
const lying = measureAbs(body({ shX: 0.15, shY: 0.79, kneeX: 0.68, kneeY: 0.7 }), 480, 640);
check('lying, knees bent → ready', lying.visible && absCalibrationHint(lying) === 'hold' && (lying.torso ?? 99) < 10, `${lying.debug} → ${absCalibrationHint(lying)}`);
const up = measureAbs(body({ shX: 0.38, shY: 0.6, kneeX: 0.68, kneeY: 0.7 }), 480, 640);
check('sitting up → torso > 60°', (up.torso ?? 0) > 60, up.debug);
const sitting = measureAbs(body({ shX: 0.45, shY: 0.55, kneeX: 0.68, kneeY: 0.7 }), 480, 640);
check('sitting at calibration → "lie down"', absCalibrationHint(sitting) === 'lieDown', `${sitting.debug} → ${absCalibrationHint(sitting)}`);
const straight = measureAbs(body({ shX: 0.15, shY: 0.79, kneeX: 0.68, kneeY: 0.805, ankX: 0.85 }), 480, 640);
check('legs straight → "bend your knees"', absCalibrationHint(straight) === 'bendKnees', `${straight.debug} → ${absCalibrationHint(straight)}`);
const hidden = measureAbs(body({ shX: 0.15, shY: 0.79, kneeX: 0.68, kneeY: 0.7, vis: 0.3 }), 480, 640);
check('body not visible → "not visible"', absCalibrationHint(hidden) === 'notVisible', hidden.debug);

if (failed) process.exitCode = 1;
