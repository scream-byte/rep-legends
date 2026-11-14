// Synthetic tests for the push-up counter: fake elbow-angle sequences for good,
// partial, too-fast and bad-form reps. Run with: npm test
// (Node runs this TypeScript file directly; no test framework needed.)
import { calibrationHint, measurePushup, PushupCounter, type PushupFrame } from './pushup.ts';

const FPS = 30;
const frame = (elbow: number, opts: Partial<PushupFrame> = {}): PushupFrame => ({
  visible: true,
  side: 'left',
  plank: true,
  elbow,
  bodyLine: 175,
  points: null,
  ...opts,
});

/** Smooth rep: top -> bottom -> top over `ms`, as a cosine curve. */
function repAngles(top: number, bottom: number, ms: number): number[] {
  const n = Math.round((ms / 1000) * FPS);
  return Array.from({ length: n }, (_, i) => bottom + ((top - bottom) * (1 + Math.cos((2 * Math.PI * i) / n))) / 2);
}

function run(name: string, seq: PushupFrame[], expectReps: number, expectHints: string[] = [], fps = FPS) {
  const c = new PushupCounter();
  const hints: string[] = [];
  let t = 1000;
  for (const f of [frame(170), frame(170), ...seq, frame(170), frame(170), frame(170), frame(170)]) {
    const u = c.update(f, t);
    if (u.hint && u.hint !== 'lost') hints.push(u.hint);
    t += 1000 / fps;
  }
  const ok = c.reps === expectReps && JSON.stringify(hints) === JSON.stringify(expectHints);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}: reps=${c.reps} hints=${JSON.stringify(hints)}${ok ? '' : `  (expected reps=${expectReps} hints=${JSON.stringify(expectHints)})`}`);
  if (!ok) process.exitCode = 1;
}

const good = repAngles(170, 75, 1200).map((a) => frame(a));
run('1 good rep', good, 1);
run('20 good reps', Array.from({ length: 20 }, () => good).flat(), 20);
run('half rep (to 115°)', repAngles(170, 115, 1000).map((a) => frame(a)), 0, ['lower']);
run('way too fast (300 ms) — smoothing filters it out', repAngles(170, 70, 300).map((a) => frame(a)), 0, ['lower']);
run('too fast (380 ms, deep)', repAngles(175, 40, 380).map((a) => frame(a)), 0, ['fast']);
run('fast but real (500 ms)', repAngles(170, 65, 500).map((a) => frame(a)), 1);
run('fast but real (650 ms)', repAngles(170, 70, 650).map((a) => frame(a)), 1);
run('10 fast real reps (700 ms each)', Array.from({ length: 10 }, () => repAngles(170, 70, 700).map((a) => frame(a))).flat(), 10);
run('slow rep (3 s)', repAngles(170, 80, 3000).map((a) => frame(a)), 1);
run('15 fps phone, good reps', Array.from({ length: 5 }, () => repAngles(170, 75, 1200).filter((_, i) => i % 2 === 0).map((a) => frame(a))).flat(), 5, [], 15);
run('15 fps phone, fast reps (700 ms)', Array.from({ length: 5 }, () => repAngles(170, 70, 700).filter((_, i) => i % 2 === 0).map((a) => frame(a))).flat(), 5, [], 15);
run('sagging back', repAngles(170, 75, 1200).map((a) => frame(a, { bodyLine: 135 })), 0, ['back']);
run('standing (not plank)', repAngles(170, 75, 1200).map((a) => frame(a, { plank: false })), 0, ['plank']);
const withGap = repAngles(170, 75, 1200).map((a, i) => (i > 15 && i < 22 ? frame(a, { visible: false }) : frame(a)));
run('rep with brief loss of tracking', withGap, 1);
run('jitter at top (165-175)', Array.from({ length: 90 }, (_, i) => frame(170 + 5 * Math.sin(i))), 0);
run('jitter around bottom (85-95)', [...repAngles(170, 90, 600).slice(0, 9).map((a) => frame(a)), ...Array.from({ length: 30 }, (_, i) => frame(90 + 5 * Math.sin(i))), ...repAngles(170, 90, 1200).slice(18).map((a) => frame(a))], 1);

// measurePushup with synthetic landmarks: a straight plank, side-on, 640x480 frame
const lms = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 0.1 }));
const set = (i: number, x: number, y: number) => (lms[i] = { x, y, visibility: 0.95 });
set(11, 0.3, 0.5); // shoulder
set(13, 0.3, 0.62); // elbow (straight down)
set(15, 0.3, 0.74); // wrist
set(23, 0.55, 0.55); // hip
set(27, 0.85, 0.62); // ankle
const m = measurePushup(lms, 640, 480);
console.log('measure plank:', { visible: m.visible, side: m.side, plank: m.plank, elbow: Math.round(m.elbow!), body: Math.round(m.bodyLine!), hint: calibrationHint(m) });
