// Synthetic tests for the squat counter: knee-angle / torso-lean sequences for good,
// shallow, bouncing and bent-over reps, plus camera-position checks. Run with: npm test
import { measureSquat, squatCalibrationHint, SquatCounter, type SquatFrame } from './squat.ts';

const FPS = 30;
const frame = (knee: number, lean = 25, opts: Partial<SquatFrame> = {}): SquatFrame => ({
  visible: true,
  side: 'left',
  knee,
  lean,
  frontFacing: false,
  points: null,
  lines: [],
  debug: '',
  ...opts,
});

/** One squat: standing (`top`) → bottom → standing over `ms`; lean grows with depth. */
function squat(ms: number, bottom = 95, maxLean = 40, top = 172): SquatFrame[] {
  const n = Math.round((ms / 1000) * FPS);
  return Array.from({ length: n }, (_, i) => {
    const k = (1 - Math.cos((2 * Math.PI * i) / n)) / 2; // 0 → 1 → 0
    return frame(top + (bottom - top) * k, 8 + (maxLean - 8) * k);
  });
}
const stand = (n = 6) => Array.from({ length: n }, () => frame(172, 8));

let failed = false;
function run(name: string, seq: SquatFrame[], expect: number, expectHints: string[] = [], fps = FPS) {
  const c = new SquatCounter();
  const hints: string[] = [];
  let t = 1000;
  for (const f of [...stand(), ...seq, ...stand()]) {
    const u = c.update(f, t);
    if (u.hint && u.hint !== 'lost') hints.push(u.hint);
    t += 1000 / fps;
  }
  const ok = c.reps === expect && JSON.stringify(hints) === JSON.stringify(expectHints);
  console.log(`${ok ? 'PASS' : 'FAIL'}  squat: ${name}: reps=${c.reps} hints=${JSON.stringify(hints)}${ok ? '' : `  (expected reps=${expect} hints=${JSON.stringify(expectHints)})`}`);
  if (!ok) failed = true;
}

run('1 normal squat (thighs parallel, 1.6 s)', squat(1600), 1);
run('15 normal squats', Array.from({ length: 15 }, () => [...squat(1600), ...stand(3)]).flat(), 15);
run('just at the "moderate" depth (110°)', squat(1600, 110), 1);
run('deep squat (70°) also counts', squat(1800, 70, 45), 1);
run('half squat (130°) → "go lower"', squat(1400, 130), 0, ['lower']);
run('bent far forward (75° lean) → "chest up"', squat(1600, 95, 75), 0, ['chest']);
run('normal forward lean (50°) is fine', squat(1600, 95, 50), 1);
run('bouncing (0.45 s) → "too fast"', squat(450, 80), 0, ['fast']);
run('brisk but controlled (0.9 s)', squat(900), 1);
run('10 brisk squats (1.0 s each, no pause)', Array.from({ length: 10 }, () => squat(1000)).flat(), 10);
run('slow squat (4 s)', squat(4000), 1);
run('brief loss of tracking mid-rep', squat(1600).map((f, i) => (i > 18 && i < 24 ? { ...f, visible: false } : f)), 1);
run('15 fps phone', Array.from({ length: 5 }, () => [...squat(1600), ...stand(3)].filter((_, i) => i % 2 === 0)).flat(), 5, [], 15);
run('standing still with small knee wobble', Array.from({ length: 60 }, (_, i) => frame(170 + 4 * Math.sin(i), 8)), 0);

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
  return lms;
}
function check(name: string, ok: boolean, info: string) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  squat: ${name}: ${info}`);
  if (!ok) failed = true;
}
const standing = measureSquat(body({ kneeX: 0.5, kneeY: 0.68, hipY: 0.48, shX: 0.5, hipSpread: 0.02 }), 480, 640);
check('side view, standing → ready', standing.visible && !standing.frontFacing && squatCalibrationHint(standing) === 'hold', `${standing.debug} → ${squatCalibrationHint(standing)}`);
const bottom = measureSquat(body({ kneeX: 0.62, kneeY: 0.66, hipY: 0.66, shX: 0.6, hipSpread: 0.02 }), 480, 640);
check('side view, bottom → knee bent < 115°', (bottom.knee ?? 180) < 115, bottom.debug);
const front = measureSquat(body({ kneeX: 0.5, kneeY: 0.68, hipY: 0.48, shX: 0.5, hipSpread: 0.16 }), 480, 640);
check('facing the camera → "turn side-on"', front.frontFacing && squatCalibrationHint(front) === 'turnSide', `${front.debug} → ${squatCalibrationHint(front)}`);
const hidden = measureSquat(body({ kneeX: 0.5, kneeY: 0.68, hipY: 0.48, shX: 0.5, hipSpread: 0.02, vis: 0.3 }), 480, 640);
check('feet / legs not visible → "show whole body"', squatCalibrationHint(hidden) === 'notVisible', hidden.debug);

if (failed) process.exitCode = 1;
