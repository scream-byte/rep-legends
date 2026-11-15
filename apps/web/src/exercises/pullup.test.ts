// Synthetic tests for the pull-up counter: fake elbow-angle + chin sequences
// for good, half, too-fast and partial-bottom reps. Run with: npm test
import { measurePullup, pullupCalibrationHint, PullupCounter, type PullupFrame } from './pullup.ts';

const FPS = 30;
const CHIN_TOL = 0.12;
// The second argument is the chin height above the bar in shoulder widths (front-view
// meaning); the counter works with `barScore` = chin + tolerance (≥ 0 = at the bar).
const frame = (elbow: number, chin: number, opts: Partial<PullupFrame> = {}): PullupFrame => ({
  visible: true,
  hanging: true,
  elbow,
  barScore: chin + CHIN_TOL,
  faceVisible: true,
  points: null,
  lines: [],
  debug: '',
  ...opts,
});

/**
 * One pull-up: hang (165°) → top (`topElbow`, chin `topChin`) → hang, over `ms`.
 * Chin goes from -1.2 (well below the bar) to topChin following the same curve.
 */
function pull(ms: number, topElbow = 60, topChin = 0.2, fromElbow = 165): PullupFrame[] {
  const n = Math.round((ms / 1000) * FPS);
  return Array.from({ length: n }, (_, i) => {
    const k = (1 - Math.cos((2 * Math.PI * i) / n)) / 2; // 0 → 1 → 0
    return frame(fromElbow + (topElbow - fromElbow) * k, -1.2 + (topChin + 1.2) * k);
  });
}
const hang = (n = 6) => Array.from({ length: n }, () => frame(166, -1.2));

let failed = false;
/** Straight-line move between two (elbow, chin) poses over `ms`. */
function ramp(ms: number, from: [number, number], to: [number, number]): PullupFrame[] {
  const n = Math.round((ms / 1000) * FPS);
  return Array.from({ length: n }, (_, i) => {
    const k = i / (n - 1);
    return frame(from[0] + (to[0] - from[0]) * k, from[1] + (to[1] - from[1]) * k);
  });
}

function run(name: string, seq: PullupFrame[], expectReps: number, expectHints: string[] = [], fps = FPS) {
  const c = new PullupCounter();
  const hints: string[] = [];
  let t = 1000;
  for (const f of [...hang(), ...seq, ...hang()]) {
    const u = c.update(f, t);
    if (u.hint && u.hint !== 'lost') hints.push(u.hint);
    t += 1000 / fps;
  }
  const ok = c.reps === expectReps && JSON.stringify(hints) === JSON.stringify(expectHints);
  console.log(`${ok ? 'PASS' : 'FAIL'}  pullup: ${name}: reps=${c.reps} hints=${JSON.stringify(hints)}${ok ? '' : `  (expected reps=${expectReps} hints=${JSON.stringify(expectHints)})`}`);
  if (!ok) failed = true;
}

run('1 good pull-up (1.8 s)', pull(1800), 1);
run('10 good pull-ups', Array.from({ length: 10 }, () => [...pull(1800), ...hang(3)]).flat(), 10);
run('chin stops below the bar', pull(1800, 70, -0.5), 0, ['higher']);
run('chin just at the bar (within tolerance)', pull(1800, 65, -0.08), 1);
run('too fast (0.5 s)', pull(500, 40, 0.3), 0, ['fast']);
// up → only half-way down (arms still bent at 115°) → up again → full hang
const noExtend = [
  ...ramp(900, [165, -1.2], [60, 0.2]),
  ...ramp(600, [60, 0.2], [115, -0.7]),
  ...ramp(600, [115, -0.7], [60, 0.2]),
  ...ramp(900, [60, 0.2], [165, -1.2]),
];
run('second rep without straightening arms', noExtend, 1, ['extend']);
run('slow strict pull-up (4 s)', pull(4000), 1);
const withGap = pull(1800).map((f, i) => (i > 10 && i < 16 ? { ...f, visible: false } : f));
run('brief loss of tracking mid-rep', withGap, 1);
// lets go of the bar before the chin gets close (frame 10 of 54 ≈ chin far below)
run('jumps off the bar mid-way', pull(1800).map((f, i) => (i > 10 ? { ...f, hanging: false } : f)), 0);
run('15 fps phone', Array.from({ length: 4 }, () => [...pull(1800), ...hang(3)].filter((_, i) => i % 2 === 0)).flat(), 4, [], 15);

// ---------- measurePullup on synthetic landmarks (480x640 portrait frame) ----------
type Pose = { face: number; shY: number; elY: number; elX: number; legs: number };
function body({ face, shY, elY, elX, legs }: Pose) {
  const lms = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.9, visibility: legs }));
  const set = (i: number, x: number, y: number, vis = 0.95) => (lms[i] = { x, y, visibility: vis });
  set(0, 0.5, shY - 0.08, face); // nose
  set(9, 0.48, shY - 0.04, face);
  set(10, 0.52, shY - 0.04, face); // mouth
  set(7, 0.43, shY - 0.09, 0.6);
  set(8, 0.57, shY - 0.09, 0.6); // ears
  set(11, 0.4, shY);
  set(12, 0.6, shY); // shoulders
  set(13, 0.5 - elX, elY);
  set(14, 0.5 + elX, elY); // elbows
  set(15, 0.35, 0.2);
  set(16, 0.65, 0.2); // wrists on the bar
  return lms;
}
function check(name: string, ok: boolean, info: string) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  pullup: ${name}: ${info}`);
  if (!ok) failed = true;
}
// dead hang: shoulders far below the wrists, straight arms
const deadHang = { shY: 0.5, elY: 0.35, elX: 0.13 };
// top: shoulders came up close to the bar, elbows bent out to the sides
const top = { shY: 0.27, elY: 0.3, elX: 0.2 };

const fh = measurePullup(body({ face: 0.95, legs: 0.9, ...deadHang }), 480, 640);
check('front view, dead hang → ready', fh.visible && fh.hanging && fh.faceVisible && (fh.barScore ?? 0) < 0 && pullupCalibrationHint(fh) === 'hold', `${fh.debug} → ${pullupCalibrationHint(fh)}`);

const bh = measurePullup(body({ face: 0.1, legs: 0.9, ...deadHang }), 480, 640);
check('BACK view (face hidden), dead hang → ready', bh.visible && bh.hanging && !bh.faceVisible && pullupCalibrationHint(bh) === 'hold', `${bh.debug} → ${pullupCalibrationHint(bh)}`);

const bt = measurePullup(body({ face: 0.1, legs: 0.9, ...top }), 480, 640);
check('BACK view, top → at the bar', bt.visible && bt.hanging && (bt.barScore ?? -1) >= 0, bt.debug);

const nf = measurePullup(body({ face: 0.1, legs: 0.0, ...deadHang }), 480, 640);
check('feet/legs out of frame → still ready', nf.visible && pullupCalibrationHint(nf) === 'hold', `${nf.debug} → ${pullupCalibrationHint(nf)}`);

const standing = measurePullup(body({ face: 0.95, legs: 0.9, shY: 0.5, elY: 0.65, elX: 0.12 }).map((p, i) => (i === 15 || i === 16 ? { ...p, y: 0.8 } : p)), 480, 640);
check('standing with arms down → not hanging', !standing.hanging && pullupCalibrationHint(standing) === 'notHanging', standing.debug);

if (failed) process.exitCode = 1;
