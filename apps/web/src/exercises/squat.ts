// Squat recognition: per-frame pose landmarks → counted reps.
//
// Camera: phone upright on the floor 2–3 m away, the athlete SIDE-ON or at ~45°
// (from straight in front the knee bend is barely visible in 2D).
//   * knee angle  = hip–knee–ankle; ~175° standing, ~90–110° with thighs near parallel
//   * torso lean  = shoulder–hip line vs vertical; 0° upright, a normal squat leans 20–50°
// "Moderate" standard (user's request): thighs roughly parallel, back not collapsed,
// no bouncing — safe for the joints, not competition-strict.

import { angle, toPx } from '../pose/geometry.ts';
import type { BaseFrame, Counter, ExerciseDef, Landmark, RepRecord, RepUpdate } from './types.ts';

export const SQUAT_RULES = {
  /** knee angle below this = deep enough (thighs about parallel to the floor) */
  downAngle: 115,
  /** knee angle above this = standing up again */
  upAngle: 160,
  /** knee angle below this = a squat attempt has started */
  descentStart: 145,
  /** torso lean above this = back collapsing forward (bad for the lower back) */
  maxLean: 65,
  /** a controlled squat takes at least this long (from leaving the standing position) */
  minRepMs: 500,
  /** MediaPipe visibility needed for shoulder, hip, knee and ankle */
  minVisibility: 0.6,
  /** standing upright for the start: lean below this */
  startMaxLean: 30,
  /** hips' horizontal spread / torso length above this = facing the camera (turn side-on) */
  frontFacingRatio: 0.45,
  /** smoothing for the knee angle (0..1, higher = less smoothing) */
  emaAlpha: 0.5,
} as const;

// BlazePose landmark indices per side
const SIDES = {
  left: { sh: 11, hip: 23, knee: 25, ank: 27 },
  right: { sh: 12, hip: 24, knee: 26, ank: 28 },
} as const;
type Side = keyof typeof SIDES;

export interface SquatFrame extends BaseFrame {
  side: Side | null;
  knee: number | null;
  /** torso lean from vertical, degrees */
  lean: number | null;
  /** standing facing the camera (knee bend not measurable) */
  frontFacing: boolean;
}

const EMPTY: SquatFrame = { visible: false, side: null, knee: null, lean: null, frontFacing: false, points: null, lines: [], debug: '—' };

// points: [shoulder, hip, knee, ankle]
const SQUAT_LINES: Array<[number, number]> = [
  [0, 1],
  [1, 2],
  [2, 3],
];

export function measureSquat(lms: Landmark[] | undefined, width: number, height: number): SquatFrame {
  if (!lms || lms.length < 29) return EMPTY;
  let best: Side = 'left';
  let bestVis = -1;
  for (const side of Object.keys(SIDES) as Side[]) {
    const vis = Math.min(...Object.values(SIDES[side]).map((i) => lms[i].visibility ?? 0));
    if (vis > bestVis) {
      bestVis = vis;
      best = side;
    }
  }
  const s = SIDES[best];
  const [sh, hip, knee, ank] = [s.sh, s.hip, s.knee, s.ank].map((i) => toPx(lms[i], width, height));
  const kneeAngle = angle(hip, knee, ank);
  // lean: 0° when the shoulder is straight above the hip (screen y grows downwards)
  const lean = (Math.atan2(Math.abs(sh.x - hip.x), Math.max(1e-6, hip.y - sh.y)) * 180) / Math.PI;
  // facing the camera: both hips far apart compared with the torso length
  const lHip = toPx(lms[23], width, height);
  const rHip = toPx(lms[24], width, height);
  const torso = Math.max(1, Math.hypot(sh.x - hip.x, sh.y - hip.y));
  const frontFacing = Math.abs(lHip.x - rHip.x) / torso > SQUAT_RULES.frontFacingRatio;

  return {
    visible: bestVis >= SQUAT_RULES.minVisibility,
    side: best,
    knee: kneeAngle,
    lean,
    frontFacing,
    points: [sh, hip, knee, ank],
    lines: SQUAT_LINES,
    debug: `${best} · knee ${Math.round(kneeAngle)}° · lean ${Math.round(lean)}°${frontFacing ? ' · FRONT' : ''}`,
  };
}

export type SquatCalibration = 'notVisible' | 'turnSide' | 'standUp' | 'hold';

/** What the player must fix before the set can start. */
export function squatCalibrationHint(f: SquatFrame): SquatCalibration {
  if (!f.visible) return 'notVisible';
  if (f.frontFacing) return 'turnSide';
  if ((f.knee ?? 0) < SQUAT_RULES.upAngle || (f.lean ?? 90) > SQUAT_RULES.startMaxLean) return 'standUp';
  return 'hold';
}

/** Hint keys (texts live in i18n `exercises.squat.hints`). */
export type SquatHint = 'lower' | 'chest' | 'fast' | 'lost';

export class SquatCounter implements Counter<SquatFrame> {
  reps = 0;
  readonly log: RepRecord[] = [];
  private phase: 'up' | 'down' = 'up';
  private smooth: number | null = null;
  private repStart: number | null = null;
  /** last moment the athlete was standing — the true start of the next rep */
  private lastTopAt: number | null = null;
  private minKnee = 180;
  private maxLean = 0;

  update(f: SquatFrame, t: number): RepUpdate {
    const R = SQUAT_RULES;
    if (!f.visible || f.knee == null || f.lean == null) return { counted: false, hint: 'lost' };

    this.smooth = this.smooth == null ? f.knee : this.smooth + R.emaAlpha * (f.knee - this.smooth);
    const a = this.smooth;

    if (this.phase === 'up' && a > R.upAngle) this.lastTopAt = t;

    if (this.repStart == null && a < R.descentStart) {
      this.repStart = this.lastTopAt ?? t;
      this.minKnee = a;
      this.maxLean = f.lean;
    }
    if (this.repStart != null) {
      this.minKnee = Math.min(this.minKnee, a);
      this.maxLean = Math.max(this.maxLean, f.lean);
    }

    if (this.phase === 'up') {
      if (a < R.downAngle) {
        this.phase = 'down';
      } else if (this.repStart != null && a > R.upAngle) {
        // went partway down and stood up again: not deep enough
        this.repStart = null;
        return { counted: false, hint: 'lower' };
      }
      return { counted: false, hint: null };
    }

    // phase === 'down': wait until standing up
    if (a <= R.upAngle) return { counted: false, hint: null };

    const duration = t - (this.repStart ?? t);
    this.phase = 'up';
    this.repStart = null;

    if (this.maxLean > R.maxLean) return { counted: false, hint: 'chest' };
    if (duration < R.minRepMs) return { counted: false, hint: 'fast' };

    this.reps += 1;
    this.log.push({ tMs: t, durationMs: Math.round(duration), minKnee: Math.round(this.minKnee), maxLean: Math.round(this.maxLean) });
    return { counted: true, hint: null };
  }
}

export const squatExercise: ExerciseDef<SquatFrame> = {
  id: 'squat',
  measure: measureSquat,
  calibrationHint: squatCalibrationHint,
  createCounter: () => new SquatCounter(),
  holdMs: 1000,
  countdown: 3,
};
