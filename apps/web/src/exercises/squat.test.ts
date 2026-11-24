// Synthetic tests for the squat counter. Includes the user's real-phone problems
// (2026-11-24): missed / double reps from a noisy knee angle, 4–5 cm "mini squats"
// counted, a crouch next to the phone counted. Run with: npm test
import { measureSquat, squatCalibrationHint, SquatCounter, type SquatFrame } from './squat.ts';

const FPS = 30;
const STAND_H = 400; // hip height above the ankles when standing, px (~90 cm legs → 1 cm ≈ 4.4 px)

/** A frame: knee angle, hip drop (share of standing height), torso lean. */
const frame = (knee: number, drop = 0, lean = 10, opts: Partial<SquatFrame> & { scale?: number; x?: number; rightKnee?: number; leftVis?: number } = {}): SquatFrame => {
  const scale = opts.scale ?? 1;
  const h = STAND_H * scale;
  const ankleY = 600;
  return {
    visible: true,
    side: 'left',
    knee,
    lean,
    frontFacing: false,
    sides: {
      left: { vis: opts.leftVis ?? 0.95, knee, lean, points: [] },
      right: { vis: 0.75, knee: opts.rightKnee ?? knee + 8, lean, points: [] },
    },
    hipY: ankleY - h * (1 - drop),
    ankleY,
    ankleX: opts.x ?? 240,
    points: null,
    lines: [],
    debug: '',
    ...opts,
  };
};

/** One squat: standing → bottom (`knee`, `drop`, `lean`) → standing over `ms`. */
function squat(ms: number, knee = 95, drop = 0.45, lean = 40, extra: (i: number, f: SquatFrame) => SquatFrame = (_, f) => f): SquatFrame[] {
  const n = Math.round((ms / 1000) * FPS);
  return Array.from({ length: n }, (_, i) => {
    const k = (1 - Math.cos((2 * Math.PI * i) / n)) / 2; // 0 → 1 → 0
    return extra(i, frame(172 + (knee - 172) * k, drop * k, 10 + (lean - 10) * k));
  });
}
const stand = (n = 8, opts: Parameters<typeof frame>[3] = {}) => Array.from({ length: n }, () => frame(172, 0, 10, opts));

let failed = false;
function run(name: string, seq: SquatFrame[], expect: number, expectHints: string[] | ((h: string[]) => boolean) = [], fps = FPS) {
  const c = new SquatCounter();
  const hints: string[] = [];
  let t = 1000;
  for (const f of [...stand(), ...seq, ...stand()]) {
    const u = c.update(f, t);
    if (u.hint && u.hint !== 'lost') hints.push(u.hint);
    t += 1000 / fps;
  }
  const hintsOk = typeof expectHints === 'function' ? expectHints(hints) : JSON.stringify(hints) === JSON.stringify(expectHints);
  const ok = c.reps === expect && hintsOk;
  const shown = [...new Set(hints)].map((h) => `${h}×${hints.filter((x) => x === h).length}`).join(', ');
  console.log(`${ok ? 'PASS' : 'FAIL'}  squat: ${name}: reps=${c.reps} hints=[${shown}]${ok ? '' : `  (expected reps=${expect})`}`);
  if (!ok) failed = true;
}
const times = <T,>(n: number, fn: () => T[]) => Array.from({ length: n }, fn).flat();

// ---------- normal squats ----------
run('1 normal squat (thighs parallel, 1.6 s)', squat(1600), 1);
run('30 normal squats in a row (user\'s set)', times(30, () => [...squat(1600), ...stand(4)]), 30);
run('just at the "moderate" depth (110°, hips −32%)', squat(1600, 110, 0.32), 1);
run('deep squat (70°) also counts', squat(1800, 70, 0.6, 45), 1);
run('filmed at 45°: knee reads 125° but hips really went down', squat(1600, 125, 0.4), 1);
run('10 brisk squats (1.0 s each, no pause)', times(10, () => squat(1000)), 10);
run('slow squat (4 s)', squat(4000), 1);
run('15 fps phone', times(5, () => [...squat(1600), ...stand(4)].filter((_, i) => i % 2 === 0)), 5, [], 15);

// ---------- form ----------
run('half squat (130°, hips −15%) → "a bit lower"', squat(1400, 130, 0.15), 0, ['lower']);
run('bent far forward (75° lean) → "chest up"', squat(1600, 95, 0.45, 75), 0, ['chest']);
run('normal forward lean (50°) is fine', squat(1600, 95, 0.45, 50), 1);
run('bouncing (0.45 s) → "too fast"', squat(450, 80, 0.5), 0, ['fast']);

// ---------- cheating / camera noise (the user's real problems) ----------
run('5 mini squats of ~4.5 cm → never counted, "a bit lower" EVERY time', times(5, () => [...squat(900, 160, 0.05), ...stand(6)]), 0, ['lower', 'lower', 'lower', 'lower', 'lower']);
run('5 mini squats of ~2 cm (noise level) → nothing at all', times(5, () => [...squat(900, 168, 0.02), ...stand(6)]), 0);
run('mini squats + knee angle spikes to 90° (MediaPipe glitch) → still 0', times(5, () => [...squat(900, 160, 0.05, 10, (i, f) => (i % 7 === 3 ? { ...f, sides: { ...f.sides, left: { ...f.sides.left!, knee: 90 } } } : f)), ...stand(6)]), 0, (h) => !h.length || h.every((x) => x === 'lower'));
run('standing still with knee spikes (single frames) → 0', Array.from({ length: 90 }, (_, i) => (i % 11 === 5 ? frame(95) : frame(172))), 0);
run('normal squats with knee spikes up AND down → no double counts', times(10, () => [...squat(1600, 95, 0.45, 40, (i, f) => (i % 6 === 2 ? { ...f, sides: { ...f.sides, left: { ...f.sides.left!, knee: i % 12 === 2 ? 170 : 85 } } } : f)), ...stand(4)]), 10);
run('legs swapped for 3 frames (other leg briefly "better") → no side jump', times(8, () => [...squat(1600, 95, 0.45, 40, (i, f) => (i === 20 || i === 21 || i === 22 ? { ...f, sides: { left: { ...f.sides.left!, vis: 0.6 }, right: { ...f.sides.right!, vis: 0.95, knee: 175 } } } : f)), ...stand(4)]), 8);
run('brief loss of tracking mid-rep', squat(1600).map((f, i) => (i > 18 && i < 24 ? { ...f, visible: false } : f)), 1);

// walked to the phone (bigger in frame + feet moved), crouched there to tap the screen
const walkAndCrouch = [
  ...Array.from({ length: 30 }, (_, i) => frame(172, 0, 10, { scale: 1 + 0.4 * (i / 29), x: 240 - 120 * (i / 29) })),
  ...squat(1500, 80, 0.5, 45).map((f) => ({ ...f, hipY: f.ankleY! - STAND_H * 1.4 * (1 - (1 - (f.ankleY! - f.hipY!) / STAND_H)), ankleX: 120 })),
];
run('walked to the phone and crouched there → NOT counted ("back to your spot")', walkAndCrouch, 0, (h) => h.includes('place') && !h.includes('lower'));
// moved to a new spot and stayed there: after a few seconds squats count again
const newSpot = [
  ...Array.from({ length: 20 }, (_, i) => frame(172, 0, 10, { x: 240 + 160 * (i / 19) })),
  ...stand(100, { x: 400 }), // ~3.3 s standing still at the new spot
  ...squat(1600).map((f) => ({ ...f, ankleX: 400 })),
];
run('moved to a new spot, stood still → squats count again', newSpot, 1, (h) => h.includes('place'));

// ---------- measureSquat on synthetic landmarks (480x640 portrait) ----------
function body(opts: { kneeX: number; kneeY: number; hipY: number; shX: number; hipSpread: number; vis?: number }) {
  const lms = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 0.2 }));
  const v = opts.vis ?? 0.95;
  const set = (i: number, x: number, y: number) => (lms[i] = { x, y, visibility: v });
  set(11, opts.shX, 0.25); // left shoulder
  set(23, 0.5 - opts.hipSpread / 2, opts.hipY); // left hip
  set(24, 0.5 + opts.hipSpread / 2, opts.hipY); // right hip
  set(25, opts.kneeX, opts.kneeY); // left knee
  set(27, 0.5, 0.88); // left ankle
  set(28, 0.5, 0.88); // right ankle
  return lms;
}
function check(name: string, ok: boolean, info: string) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  squat: ${name}: ${info}`);
  if (!ok) failed = true;
}
const standing = measureSquat(body({ kneeX: 0.5, kneeY: 0.68, hipY: 0.48, shX: 0.5, hipSpread: 0.02 }), 480, 640);
check('side view, standing → ready', standing.visible && !standing.frontFacing && squatCalibrationHint(standing) === 'hold', `${standing.debug} → ${squatCalibrationHint(standing)}`);
const bottom = measureSquat(body({ kneeX: 0.62, kneeY: 0.66, hipY: 0.66, shX: 0.6, hipSpread: 0.02 }), 480, 640);
check('side view, bottom → knee bent < 115°, hips lower', (bottom.knee ?? 180) < 115 && bottom.hipY! > standing.hipY!, bottom.debug);
const front = measureSquat(body({ kneeX: 0.5, kneeY: 0.68, hipY: 0.48, shX: 0.5, hipSpread: 0.16 }), 480, 640);
check('facing the camera → "turn side-on"', front.frontFacing && squatCalibrationHint(front) === 'turnSide', `${front.debug} → ${squatCalibrationHint(front)}`);
const hidden = measureSquat(body({ kneeX: 0.5, kneeY: 0.68, hipY: 0.48, shX: 0.5, hipSpread: 0.02, vis: 0.3 }), 480, 640);
check('feet / legs not visible → "show whole body"', squatCalibrationHint(hidden) === 'notVisible', hidden.debug);

if (failed) process.exitCode = 1;
