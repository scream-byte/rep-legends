// Squat recognition: per-frame pose landmarks → counted reps.
//
// Camera: phone upright on the floor 2–3 m away, the athlete SIDE-ON or at ~45°.
// Two independent signals must agree before a rep counts (real-phone test 2026-11-24
// showed the knee angle alone is too noisy side-on: the far leg is hidden, MediaPipe
// sometimes swaps legs → missed reps, double counts, and 4–5 cm "mini squats" counted):
//   * knee angle  = hip–knee–ankle of ONE locked side; ~175° standing, ~90–110° at parallel
//   * hip drop    = how far the hips went down, as a share of the standing hip height
//                   above the ankles (0 standing, ~0.4–0.5 at parallel). Hips are tracked
//                   much more steadily than knees.
// Every state change must hold for a few frames (debounce), and the athlete must stay
// in place (walking to the phone and crouching there must not count).
// "Moderate" standard (user's request): thighs roughly parallel, back not collapsed,
// no bouncing — safe for the joints, not competition-strict.

import { angle, toPx, type Pt } from '../pose/geometry.ts';
import type { BaseFrame, Counter, ExerciseDef, Landmark, RepRecord, RepUpdate } from './types.ts';

export const SQUAT_RULES = {
  /** bottom: knee angle below this AND hips dropped at least `minDrop` … */
  downAngle: 115,
  minDrop: 0.2,
  /** … OR hips dropped this much on their own (knee angle may read high at 45°) */
  deepDrop: 0.3,
  /** standing again: knee above this AND hips back up (drop below `upDrop`) */
  upAngle: 150,
  upDrop: 0.12,
  /** a squat attempt has started: hips went down by this share (~4 cm on 90 cm legs) */
  startDrop: 0.045,
  /** frames a state change must hold (≈0.1 s at 30 fps) */
  holdFrames: 3,
  /** torso lean above this = back collapsing forward (bad for the lower back) */
  maxLean: 65,
  /** a controlled squat takes at least this long (from leaving the standing position) */
  minRepMs: 500,
  /** after a counted rep, stand at least this long before the next one can start */
  restMs: 200,
  /** MediaPipe visibility needed for shoulder, hip, knee and ankle */
  minVisibility: 0.6,
  /** switch the tracked leg only if the other one is this much more visible … */
  sideSwitchMargin: 0.15,
  /** … for this many frames in a row */
  sideSwitchFrames: 8,
  /** standing upright for the start: knee above / lean below */
  startKnee: 160,
  startMaxLean: 30,
  /** hips' horizontal spread / torso length above this = facing the camera (turn side-on) */
  frontFacingRatio: 0.45,
  /** "left the spot": feet moved sideways more than this share of the standing height … */
  maxFootShift: 0.35,
  /** … or the body looks this much bigger/smaller (walked towards/away from the phone) */
  maxScaleChange: 0.2,
  /** standing still elsewhere this long → accept it as the new spot */
  reanchorMs: 2500,
  /** smoothing for the knee angle (0..1, higher = less smoothing) */
  emaAlpha: 0.5,
} as const;

// BlazePose landmark indices per side
const SIDES = {
  left: { sh: 11, hip: 23, knee: 25, ank: 27 },
  right: { sh: 12, hip: 24, knee: 26, ank: 28 },
} as const;
export type Side = keyof typeof SIDES;

export interface SideData {
  vis: number;
  knee: number;
  lean: number;
  points: Pt[];
}

export interface SquatFrame extends BaseFrame {
  /** best-visible side in THIS frame (calibration / debug); the counter locks its own */
  side: Side | null;
  knee: number | null;
  /** torso lean from vertical, degrees */
  lean: number | null;
  frontFacing: boolean;
  sides: Record<Side, SideData | null>;
  /** mid-hip / mid-ankle positions in pixels */
  hipY: number | null;
  ankleY: number | null;
  ankleX: number | null;
}

const EMPTY: SquatFrame = {
  visible: false,
  side: null,
  knee: null,
  lean: null,
  frontFacing: false,
  sides: { left: null, right: null },
  hipY: null,
  ankleY: null,
  ankleX: null,
  points: null,
  lines: [],
  debug: '—',
};

// points: [shoulder, hip, knee, ankle]
const SQUAT_LINES: Array<[number, number]> = [
  [0, 1],
  [1, 2],
  [2, 3],
];

function sideData(lms: Landmark[], side: Side, w: number, h: number): SideData {
  const s = SIDES[side];
  const vis = Math.min(...Object.values(s).map((i) => lms[i].visibility ?? 0));
  const [sh, hip, knee, ank] = [s.sh, s.hip, s.knee, s.ank].map((i) => toPx(lms[i], w, h));
  // lean: 0° when the shoulder is straight above the hip (screen y grows downwards)
  const lean = (Math.atan2(Math.abs(sh.x - hip.x), Math.max(1e-6, hip.y - sh.y)) * 180) / Math.PI;
  return { vis, knee: angle(hip, knee, ank), lean, points: [sh, hip, knee, ank] };
}

export function measureSquat(lms: Landmark[] | undefined, width: number, height: number): SquatFrame {
  if (!lms || lms.length < 29) return EMPTY;
  const sides = { left: sideData(lms, 'left', width, height), right: sideData(lms, 'right', width, height) };
  const best: Side = sides.left.vis >= sides.right.vis ? 'left' : 'right';
  const b = sides[best];
  const P = (i: number) => toPx(lms[i], width, height);
  const hip = { x: (P(23).x + P(24).x) / 2, y: (P(23).y + P(24).y) / 2 };
  const ank = { x: (P(27).x + P(28).x) / 2, y: (P(27).y + P(28).y) / 2 };
  const [sh, sideHip] = [b.points[0], b.points[1]];
  const torso = Math.max(1, Math.hypot(sh.x - sideHip.x, sh.y - sideHip.y));
  const frontFacing = Math.abs(P(23).x - P(24).x) / torso > SQUAT_RULES.frontFacingRatio;

  return {
    visible: b.vis >= SQUAT_RULES.minVisibility,
    side: best,
    knee: b.knee,
    lean: b.lean,
    frontFacing,
    sides,
    hipY: hip.y,
    ankleY: ank.y,
    ankleX: ank.x,
    points: b.points,
    lines: SQUAT_LINES,
    debug: `${best} · knee ${Math.round(b.knee)}° · lean ${Math.round(b.lean)}°${frontFacing ? ' · FRONT' : ''}`,
  };
}

export type SquatCalibration = 'notVisible' | 'turnSide' | 'standUp' | 'hold';

/** What the player must fix before the set can start. */
export function squatCalibrationHint(f: SquatFrame): SquatCalibration {
  if (!f.visible) return 'notVisible';
  if (f.frontFacing) return 'turnSide';
  if ((f.knee ?? 0) < SQUAT_RULES.startKnee || (f.lean ?? 90) > SQUAT_RULES.startMaxLean) return 'standUp';
  return 'hold';
}

/** Hint keys (texts live in i18n `exercises.squat.hints`). 'place' is a lasting banner. */
export type SquatHint = 'lower' | 'chest' | 'fast' | 'lost' | 'place';

/** A condition that must hold for `n` frames in a row before it "fires". */
class Debounce {
  private count = 0;
  private readonly n: number;
  constructor(n: number) {
    this.n = n;
  }
  feed(cond: boolean): boolean {
    this.count = cond ? this.count + 1 : 0;
    return this.count >= this.n;
  }
  reset() {
    this.count = 0;
  }
}

export class SquatCounter implements Counter<SquatFrame> {
  reps = 0;
  readonly log: RepRecord[] = [];
  private phase: 'up' | 'down' = 'up';
  private side: Side | null = null;
  private otherBetter = 0;
  private smooth: number | null = null;
  /** hip height above the ankles when standing (pixels), learned while standing */
  private standH: number | null = null;
  /** where the athlete stands: reference ankle x and standing height */
  private refX: number | null = null;
  private refH: number | null = null;
  private outSince: number | null = null;
  private repStart: number | null = null;
  private lastTopAt: number | null = null;
  private lastCountAt = -Infinity;
  private minKnee = 180;
  private maxDrop = 0;
  private maxLean = 0;
  private readonly startDeb = new Debounce(SQUAT_RULES.holdFrames);
  private readonly downDeb = new Debounce(SQUAT_RULES.holdFrames);
  private readonly upDeb = new Debounce(SQUAT_RULES.holdFrames);

  /** Locks onto one leg; switches only if the other one is clearly better for a while. */
  private pickSide(f: SquatFrame): SideData | null {
    const R = SQUAT_RULES;
    const l = f.sides.left;
    const r = f.sides.right;
    if (!l || !r) return null;
    if (this.side == null) this.side = l.vis >= r.vis ? 'left' : 'right';
    const cur = f.sides[this.side]!;
    const other = f.sides[this.side === 'left' ? 'right' : 'left']!;
    if (other.vis > cur.vis + R.sideSwitchMargin) this.otherBetter += 1;
    else this.otherBetter = 0;
    if (this.otherBetter >= R.sideSwitchFrames || cur.vis < R.minVisibility - 0.2) {
      this.side = this.side === 'left' ? 'right' : 'left';
      this.otherBetter = 0;
      this.smooth = null; // don't mix angles of two different legs
    }
    return f.sides[this.side]!;
  }

  private resetRep() {
    this.repStart = null;
    this.minKnee = 180;
    this.maxDrop = 0;
    this.maxLean = 0;
    this.downDeb.reset();
  }

  update(f: SquatFrame, t: number): RepUpdate {
    const R = SQUAT_RULES;
    const sd = f.visible ? this.pickSide(f) : null;
    if (!sd || f.hipY == null || f.ankleY == null || f.ankleX == null) return { counted: false, hint: 'lost' };

    this.smooth = this.smooth == null ? sd.knee : this.smooth + R.emaAlpha * (sd.knee - this.smooth);
    const knee = this.smooth;
    const h = Math.max(1, f.ankleY - f.hipY);

    // ----- learn the standing height and the athlete's spot -----
    const standingNow = knee > R.upAngle && this.phase === 'up' && this.repStart == null;
    if (standingNow) {
      // Learn quickly upwards (stood up taller), but only VERY slowly downwards and only
      // within ~2%: otherwise a slow 4–5 cm dip would be learned as "the new standing
      // height" and never seen as an attempt.
      if (this.standH == null || h >= this.standH) this.standH = this.standH == null ? h : this.standH + 0.3 * (h - this.standH);
      else if (h > this.standH * 0.98) this.standH += 0.05 * (h - this.standH);
    }
    if (this.standH == null) return { counted: false, hint: null }; // wait for a first standing frame
    if (this.refX == null || this.refH == null) {
      this.refX = f.ankleX;
      this.refH = this.standH;
    }

    // ----- stay in place: walking to the phone / away must not count -----
    const shifted = Math.abs(f.ankleX - this.refX) > R.maxFootShift * this.refH;
    const scaled = Math.abs(this.standH / this.refH - 1) > R.maxScaleChange;
    if (shifted || scaled) {
      // standing still at the new spot for a while → accept it as the new spot
      this.outSince ??= t;
      if (standingNow && t - this.outSince > R.reanchorMs) {
        this.refX = f.ankleX;
        this.refH = this.standH;
        this.outSince = null;
      } else {
        this.phase = 'up';
        this.resetRep();
        return { counted: false, hint: 'place' };
      }
    } else {
      this.outSince = null;
    }

    const drop = 1 - h / this.standH; // 0 standing, ~0.4–0.5 at parallel
    if (this.phase === 'up' && knee > R.upAngle && drop < R.upDrop) this.lastTopAt = t;

    // ----- a rep attempt starts once the hips really go down -----
    const started = this.startDeb.feed(drop > R.startDrop);
    if (this.repStart == null && started && t - this.lastCountAt > R.restMs) {
      this.repStart = this.lastTopAt ?? t;
      this.minKnee = knee;
      this.maxDrop = drop;
      this.maxLean = sd.lean;
    }
    if (this.repStart != null) {
      this.minKnee = Math.min(this.minKnee, knee);
      this.maxDrop = Math.max(this.maxDrop, drop);
      this.maxLean = Math.max(this.maxLean, sd.lean);
    }

    const deep = (knee < R.downAngle && drop >= R.minDrop) || drop >= R.deepDrop;
    const standing = knee > R.upAngle && drop < R.upDrop;
    // back (almost) where the attempt started — used to spot shallow "mini squats"
    const backUp = knee > R.upAngle && drop < R.startDrop / 2;

    if (this.phase === 'up') {
      if (this.repStart == null) return { counted: false, hint: null };
      if (this.downDeb.feed(deep)) {
        this.phase = 'down';
        this.upDeb.reset();
      } else if (this.upDeb.feed(backUp)) {
        // went partway down and stood up again: not deep enough
        this.resetRep();
        this.upDeb.reset();
        this.lastCountAt = t; // short rest before the next attempt, no double hints
        return { counted: false, hint: 'lower' };
      }
      return { counted: false, hint: null };
    }

    // ----- phase 'down': wait until really standing again -----
    if (!this.upDeb.feed(standing)) return { counted: false, hint: null };

    const duration = t - (this.repStart ?? t);
    const lean = this.maxLean;
    const record = { minKnee: Math.round(this.minKnee), maxDrop: Math.round(this.maxDrop * 100) / 100, maxLean: Math.round(lean) };
    this.phase = 'up';
    this.resetRep();
    this.upDeb.reset();
    this.lastCountAt = t;

    if (lean > R.maxLean) return { counted: false, hint: 'chest' };
    if (duration < R.minRepMs) return { counted: false, hint: 'fast' };

    this.reps += 1;
    this.log.push({ tMs: t, durationMs: Math.round(duration), ...record });
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
