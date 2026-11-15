// Synthetic tests for the pull-up counter: fake elbow / chin / swing sequences for
// good, half, too-fast, kipping and band reps on every difficulty. Run with: npm test
import {
  barScore,
  measurePullup,
  pullupCalibrationHint,
  PullupCounter,
  pullupExercise,
  type PullupFrame,
  type PullupOptions,
} from './pullup.ts';

const FPS = 30;
const MEDIUM: PullupOptions = { difficulty: 'medium', band: false };

// `chin` = chin above the bar in shoulder widths (front view). Shoulders are kept far
// below the bar so only the chin signal decides "at the bar".
const frame = (elbow: number, chin: number, opts: Partial<PullupFrame> = {}): PullupFrame => ({
  visible: true,
  hanging: true,
  elbow,
  shoulderLift: 1.5,
  chinHeight: chin,
  faceVisible: true,
  torsoPitch: 0,
  hipFlex: 172,
  hipSway: 0,
  points: null,
  lines: [],
  debug: '',
  ...opts,
});

/** One pull-up: hang (`fromElbow`) → top (`topElbow`, chin `topChin`) → hang, over `ms`.
 *  `swing(k)` can add kipping signals along the way (k: 0 → 1 → 0). */
function pull(ms: number, topElbow = 60, topChin = 0.2, fromElbow = 165, swing?: (k: number) => Partial<PullupFrame>): PullupFrame[] {
  const n = Math.round((ms / 1000) * FPS);
  return Array.from({ length: n }, (_, i) => {
    const k = (1 - Math.cos((2 * Math.PI * i) / n)) / 2;
    return frame(fromElbow + (topElbow - fromElbow) * k, -1.2 + (topChin + 1.2) * k, swing?.(k));
  });
}
const hang = (n = 6, elbow = 166) => Array.from({ length: n }, () => frame(elbow, -1.2));

/** Straight-line move between two (elbow, chin) poses over `ms`. */
function ramp(ms: number, from: [number, number], to: [number, number]): PullupFrame[] {
  const n = Math.round((ms / 1000) * FPS);
  return Array.from({ length: n }, (_, i) => {
    const k = i / (n - 1);
    return frame(from[0] + (to[0] - from[0]) * k, from[1] + (to[1] - from[1]) * k);
  });
}

// kipping signals: torso rocks ±18° (36° range) / knees driven up to 105°
const rock = (k: number) => ({ torsoPitch: -18 + 36 * k });
const kneeDrive = (k: number) => ({ hipFlex: 172 - 67 * k });
const calmRock = (k: number) => ({ torsoPitch: -5 + 10 * k }); // normal small sway

let failed = false;
function run(name: string, seq: PullupFrame[], expectScore: number, expectHints: string[] = [], fps = FPS, opts: PullupOptions = MEDIUM, startElbow = 166) {
  const c = new PullupCounter(opts);
  const hints: string[] = [];
  let t = 1000;
  for (const f of [...hang(6, startElbow), ...seq, ...hang(6, startElbow)]) {
    const u = c.update(f, t);
    if (u.hint && u.hint !== 'lost') hints.push(u.hint);
    t += 1000 / fps;
  }
  const ok = c.reps === expectScore && JSON.stringify(hints) === JSON.stringify(expectHints);
  const tag = `${opts.difficulty}${opts.band ? '+band' : ''}`;
  console.log(
    `${ok ? 'PASS' : 'FAIL'}  pullup[${tag}]: ${name}: score=${c.reps} hints=${JSON.stringify(hints)} ${JSON.stringify(c.breakdown)}${ok ? '' : `  (expected score=${expectScore} hints=${JSON.stringify(expectHints)})`}`,
  );
  if (!ok) failed = true;
  return c;
}

// ---------- basics (medium) ----------
run('1 good pull-up (1.8 s)', pull(1800), 1);
run('10 good pull-ups', Array.from({ length: 10 }, () => [...pull(1800), ...hang(3)]).flat(), 10);
run('chin stops below the bar', pull(1800, 70, -0.5), 0, ['higher']);
run('chin just at the bar (within tolerance)', pull(1800, 65, -0.08), 1);
run('too fast (0.5 s)', pull(500, 40, 0.3), 0, ['fast']);
const noExtend = [
  ...ramp(900, [165, -1.2], [60, 0.2]),
  ...ramp(600, [60, 0.2], [115, -0.7]),
  ...ramp(600, [115, -0.7], [60, 0.2]),
  ...ramp(900, [60, 0.2], [165, -1.2]),
];
run('second rep without straightening arms', noExtend, 1, ['extend']);
run('slow strict pull-up (4 s)', pull(4000), 1);
run('brief loss of tracking mid-rep', pull(1800).map((f, i) => (i > 10 && i < 16 ? { ...f, visible: false } : f)), 1);
run('jumps off the bar mid-way', pull(1800).map((f, i) => (i > 10 ? { ...f, hanging: false } : f)), 0);
run('15 fps phone', Array.from({ length: 4 }, () => [...pull(1800), ...hang(3)].filter((_, i) => i % 2 === 0)).flat(), 4, [], 15);
run('real phone sequence (hang 157°, top 65°)', [...ramp(600, [157, -1.3], [157, -1.3]), ...ramp(900, [157, -1.3], [65, 0.21]), ...ramp(900, [61, 0.11], [157, -1.3])], 1);
const fastSet = (cycleMs: number, n: number, from = 157) => Array.from({ length: n }, () => pull(cycleMs, 65, 0.3, from)).flat();
run('fast pace: 6 × 1.2 s, no pause (28 fps)', fastSet(1200, 6), 6, [], 28);
run('fast pace: 6 × 1.0 s, no pause (28 fps)', fastSet(1000, 6), 6, [], 28);
run('very fast: 6 × 0.8 s, no pause (28 fps)', fastSet(800, 6), 6, [], 28);

// ---------- difficulty: kipping ----------
const kipSet = Array.from({ length: 4 }, () => [...pull(1600, 60, 0.2, 165, rock), ...hang(3)]).flat();
run('kipping (torso rocks) ×4 → ½ each', kipSet, 2, ['kipHalf', 'kipHalf', 'kipHalf', 'kipHalf']);
run('kipping ×4 → full points on EASY', kipSet, 4, [], FPS, { difficulty: 'easy', band: false });
run('kipping ×4 → 0 on HARD', kipSet, 0, ['kipZero', 'kipZero', 'kipZero', 'kipZero'], FPS, { difficulty: 'hard', band: false });
run('knee drive counts as kipping → ½', pull(1600, 60, 0.2, 165, kneeDrive), 0.5, ['kipHalf']);
run('small natural sway is NOT kipping', pull(1800, 60, 0.2, 165, calmRock), 1);
const mixed = [...pull(1600), ...hang(3), ...pull(1600, 60, 0.2, 165, rock), ...hang(3), ...pull(1600)];
const cm = run('2 clean + 1 kipping → 2.5', mixed, 2.5, ['kipHalf']);
if (cm.breakdown.clean !== 2 || cm.breakdown.kipping !== 1) {
  console.log('FAIL  pullup: breakdown for mixed set', cm.breakdown);
  failed = true;
}

// ---------- difficulty: band (self-declared) ----------
const four = Array.from({ length: 4 }, () => [...pull(1800), ...hang(3)]).flat();
run('band ×4 → ½ each on MEDIUM', four, 2, [], FPS, { difficulty: 'medium', band: true });
run('band ×4 → full points on EASY', four, 4, [], FPS, { difficulty: 'easy', band: true });

// ---------- difficulty: how straight the arms must be at the bottom ----------
run('EASY: hang with bent arms (135°) still arms the rep', pull(1800, 60, 0.2, 135), 1, [], FPS, { difficulty: 'easy', band: false }, 135);
run('MEDIUM: hang at 135° is not a full hang → not counted', pull(1800, 60, 0.2, 135), 0, ['extend'], FPS, MEDIUM, 135);
run('HARD: hang at 150° is not a full hang → not counted', pull(1800, 60, 0.2, 150), 0, ['extend'], FPS, { difficulty: 'hard', band: false }, 150);
run('HARD: strict rep (hang 165°, chin over bar)', pull(1800, 55, 0.15, 165), 1, [], FPS, { difficulty: 'hard', band: false });
run('HARD: chin just below the bar is not enough', pull(1800, 60, -0.08, 165), 0, ['higher'], FPS, { difficulty: 'hard', band: false });

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
  set(23, 0.45, shY + 0.25, legs);
  set(24, 0.55, shY + 0.25, legs); // hips
  set(25, 0.45, shY + 0.45, legs);
  set(26, 0.55, shY + 0.45, legs); // knees (straight body)
  return lms;
}
function check(name: string, ok: boolean, info: string) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  pullup: ${name}: ${info.replace('\n', ' | ')}`);
  if (!ok) failed = true;
}
const deadHang = { shY: 0.5, elY: 0.35, elX: 0.13 };
const top = { shY: 0.27, elY: 0.3, elX: 0.2 };
const bs = (f: PullupFrame) => barScore(f, 'medium') ?? -9;

const fh = measurePullup(body({ face: 0.95, legs: 0.9, ...deadHang }), 480, 640);
check('front view, dead hang → ready', fh.visible && fh.hanging && fh.faceVisible && bs(fh) < 0 && pullupCalibrationHint(fh) === 'hold', fh.debug);
const bh = measurePullup(body({ face: 0.1, legs: 0.9, ...deadHang }), 480, 640);
check('BACK view, dead hang → ready', bh.visible && bh.hanging && !bh.faceVisible && pullupCalibrationHint(bh) === 'hold', bh.debug);
const bt = measurePullup(body({ face: 0.1, legs: 0.9, ...top }), 480, 640);
check('BACK view, top → at the bar', bt.visible && bt.hanging && bs(bt) >= 0, bt.debug);
check('straight body → hip angle ~180, no knee drive', (bh.hipFlex ?? 0) > 165, bh.debug);
const nf = measurePullup(body({ face: 0.1, legs: 0.0, ...deadHang }), 480, 640);
check('feet/legs out of frame → still ready, swing unknown', nf.visible && pullupCalibrationHint(nf) === 'hold' && nf.hipFlex == null && nf.hipSway == null, nf.debug);
const lowVisTop = body({ face: 0.1, legs: 0.0, ...top }).map((p, i) => ([13, 14, 15, 16].includes(i) ? { ...p, visibility: 0.25 } : p));
const lt = measurePullup(lowVisTop, 480, 640);
check('BACK view top, elbows/wrists low visibility → still trusted & at bar', lt.visible && lt.hanging && bs(lt) >= 0, lt.debug);
check('auto-finish: doubtful frame does not end the set', pullupExercise.inPosition!({ ...lt, visible: false }) === true, 'visible=false → inPosition=true');
const standing = measurePullup(body({ face: 0.95, legs: 0.9, shY: 0.5, elY: 0.65, elX: 0.12 }).map((p, i) => (i === 15 || i === 16 ? { ...p, y: 0.8 } : p)), 480, 640);
check('standing with arms down → not hanging', !standing.hanging && pullupCalibrationHint(standing) === 'notHanging', standing.debug);
check('auto-finish: confidently off the bar ends the set', pullupExercise.inPosition!(standing) === false, 'arms down → inPosition=false');
// 3D torso pitch from world landmarks: shoulders 0.2 m closer to the camera than the hips → ~-35°
const world = Array.from({ length: 33 }, () => ({ x: 0, y: 0, z: 0 }));
world[11] = { x: -0.2, y: -0.5, z: -0.2 };
world[12] = { x: 0.2, y: -0.5, z: -0.2 };
world[23] = { x: -0.1, y: 0, z: 0 };
world[24] = { x: 0.1, y: 0, z: 0 };
const wp = measurePullup(body({ face: 0.1, legs: 0.9, ...deadHang }), 480, 640, world);
check('torso pitch from 3D landmarks', wp.torsoPitch != null && Math.abs(wp.torsoPitch + 21.8) < 1, wp.debug);

if (failed) process.exitCode = 1;
