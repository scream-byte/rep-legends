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
  /** standing again: hips back near the top (drop ≤ `upDrop`) and knees fairly straight */
  upAngle: 135,
  upDrop: 0.15,
  /** a squat attempt has started: hips went this much below the athlete's rest level (~2.7 cm) */
  startDrop: 0.03,
  /** "a bit lower" is shown only if the attempt really went this deep (~3.2 cm) —
   *  shallower = just jitter, ended silently */
  lowerHintMin: 0.035,
  /** rest level follows small changes within this band (imperfect lock-out between reps) */
  restBand: 0.03,
  /** how fast the rest level follows (slow: a 4 cm dip must not be "learned" as the new rest) */
  restAlpha: 0.03,
  /** … and only follows jitter this small (≈2.5 cm), never a real dip */
  restCreepBand: 0.028,
  /** standing clearly taller must last this long before it becomes the new rest level */
  restResetMs: 300,
  /** standing height: averaged over this first period of standing */
  standLearnMs: 1000,
  /** … later only re-learned when standing taller by more than this share (and it lasts) */
  standTallerBand: 0.03,
  /** … and follows slow drift within this share */
  standDriftBand: 0.015,
  /** hips must stay below the rest level this long to count as an attempt */
  attemptMs: 100,
  /** frames an attempt start / "came back up" must hold (≈0.1 s at 30 fps) */
  holdFrames: 3,
  /** frames for reaching the bottom / standing up (shorter: fast reps touch them briefly) */
  edgeFrames: 2,
  /** smoothing for the hip drop (0..1, higher = less smoothing) */
  dropAlpha: 0.6,
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
  /** smoothed hip drop */
  private drop: number | null = null;
  /** hip drop while resting at the top between reps (see update) */
  private rest: number | null = null;
  /** since when the hips are below the rest level (attempt detection) */
  private belowSince: number | null = null;
  /** since when the athlete looks clearly taller than the rest level (+ running average) */
  private tallerSince: number | null = null;
  private tallerSum = 0;
  private tallerN = 0;
  /** the standing height is averaged until this time */
  private learnUntil = 0;
  /** since when the athlete stands clearly taller than the learned standing height */
  private standTallerSince: number | null = null;
  private readonly startDeb = new Debounce(SQUAT_RULES.holdFrames);
  private readonly backDeb = new Debounce(SQUAT_RULES.holdFrames);
  private readonly downDeb = new Debounce(SQUAT_RULES.edgeFrames);
  private readonly upDeb = new Debounce(SQUAT_RULES.edgeFrames);

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
    this.backDeb.reset();
    this.startDeb.reset();
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
      // Standing hip height = the AVERAGE over the first second of standing (jitter cancels
      // out — taking the highest frames made normal standing look like a small squat).
      // Later it only follows tiny drift, or a clearly taller stance that LASTS. Never a
      // dip: a slow 4 cm mini squat must not become "the new standing height".
      if (this.standH == null) {
        this.standH = h;
        this.learnUntil = t + R.standLearnMs;
      } else if (t < this.learnUntil) {
        // average only frames that look like standing (an athlete who starts squatting
        // right after "3-2-1" must not have the start of the squat learned as standing)
        if (h > this.standH * 0.99) this.standH += 0.15 * (h - this.standH);
      } else if (h > this.standH * (1 + R.standTallerBand)) {
        this.standTallerSince ??= t;
        if (t - this.standTallerSince >= R.restResetMs) {
          this.standH = h;
          this.standTallerSince = null;
        }
      } else {
        this.standTallerSince = null;
        if (Math.abs(h / this.standH - 1) < R.standDriftBand) this.standH += 0.02 * (h - this.standH);
      }
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
        this.rest = null;
      } else {
        this.phase = 'up';
        this.resetRep();
        this.rest = null;
        return { counted: false, hint: 'place' };
      }
    } else {
      this.outSince = null;
    }

    // hip drop (0 standing, ~0.4–0.5 at parallel), lightly smoothed against jitter
    const rawDrop = 1 - h / this.standH;
    this.drop = this.drop == null ? rawDrop : this.drop + R.dropAlpha * (rawDrop - this.drop);
    const drop = this.drop;

    const deep = (knee < R.downAngle && drop >= R.minDrop) || drop >= R.deepDrop;
    // "stood up": hips back near the top. Knees may stay a bit bent — tired athletes
    // rarely lock out fully late in a long set (the cause of 20/22 on a real phone).
    const standing = drop <= R.upDrop && knee > R.upAngle;

    if (this.phase === 'up') {
      // Rest level = how this athlete stands between reps right now (may be a bit
      // below a perfect lock-out). Attempts / "a bit lower" are measured from it, so
      // jitter around an imperfect top never looks like an attempt.
      if (this.repStart == null) {
        // slow average of the resting hip height (jitter cancels out); drops quickly
        // only when the athlete clearly stands taller
        if (this.rest == null) this.rest = drop;
        if (drop < this.rest - R.restBand) {
          // clearly taller — but trust it only if it lasts, and take the AVERAGE of that
          // period (a single low jitter frame would make normal jitter look like an attempt)
          if (this.tallerSince == null) {
            this.tallerSince = t;
            this.tallerSum = 0;
            this.tallerN = 0;
          }
          this.tallerSum += drop;
          this.tallerN += 1;
          if (t - this.tallerSince >= R.restResetMs) {
            this.rest = this.tallerSum / this.tallerN;
            this.tallerSince = null;
          }
        } else {
          this.tallerSince = null;
          if (Math.abs(drop - this.rest) < R.restCreepBand) this.rest += R.restAlpha * (drop - this.rest);
        }
        if (knee > R.upAngle && drop <= R.upDrop) this.lastTopAt = t;
      }
      const rest = this.rest ?? 0;
      // an attempt = hips below the rest level for at least `attemptMs` (time, not frames,
      // so slow and fast phones behave the same)
      const below = this.repStart == null && drop - rest > R.startDrop && t - this.lastCountAt > R.restMs;
      if (below) this.belowSince ??= t;
      else this.belowSince = null;
      if (this.repStart == null) {
        if (this.belowSince == null || t - this.belowSince < R.attemptMs) return { counted: false, hint: null };
        this.belowSince = null;
        this.repStart = this.lastTopAt ?? t;
        this.minKnee = knee;
        this.maxDrop = drop;
        this.maxLean = sd.lean;
        this.backDeb.reset();
      }
      this.minKnee = Math.min(this.minKnee, knee);
      this.maxDrop = Math.max(this.maxDrop, drop);
      this.maxLean = Math.max(this.maxLean, sd.lean);
      if (this.downDeb.feed(deep)) {
        this.phase = 'down';
        this.upDeb.reset();
      } else if (this.backDeb.feed(drop - rest < R.startDrop / 2)) {
        // came back up without reaching the bottom: a real shallow squat → "a bit lower";
        // a tiny wobble (jitter) → ended silently
        const realDip = this.maxDrop - rest >= R.lowerHintMin;
        this.resetRep();
        this.lastCountAt = t; // short rest before the next attempt, no double hints
        return { counted: false, hint: realDip ? 'lower' : null };
      }
      return { counted: false, hint: null };
    }

    // ----- phase 'down': track the bottom, wait until standing again -----
    this.minKnee = Math.min(this.minKnee, knee);
    this.maxDrop = Math.max(this.maxDrop, drop);
    this.maxLean = Math.max(this.maxLean, sd.lean);
    if (!this.upDeb.feed(standing)) return { counted: false, hint: null };

    const duration = t - (this.repStart ?? t);
    const lean = this.maxLean;
    const record = { minKnee: Math.round(this.minKnee), maxDrop: Math.round(this.maxDrop * 100) / 100, maxLean: Math.round(lean) };
    this.phase = 'up';
    this.resetRep();
    this.upDeb.reset();
    this.rest = drop; // new rest level = where the athlete stood up to
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
