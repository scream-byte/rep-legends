// Pull-up recognition (camera in front of the bar, low, looking up at the athlete).
//
// Per frame we measure:
//   * elbow angle (average of both arms): ~170° hanging, small at the top
//   * hanging: both wrists clearly above the head (= holding the bar)
//   * chin margin: how far the chin is above the line of the wrists (= the bar),
//     in shoulder widths, so it doesn't depend on distance to the camera
// A rep counts at the TOP (chin reaches the bar), but only if the previous
// bottom was a full hang with straight arms ("dead hang"). Thresholds are
// starting values and will be tuned on real people.

import { angle, toPx, type Pt } from '../pose/geometry.ts';
import type { BaseFrame, Counter, ExerciseDef, Landmark, RepRecord, RepUpdate } from './types.ts';

export const PULLUP_RULES = {
  /** elbow angle above this = arms straight (bottom / dead hang) */
  straightArms: 150,
  /** elbow angle below this = a real pull attempt started */
  pullStarted: 125,
  /** chin may be this many shoulder-widths below the wrist line and still count as "over the bar" */
  chinTolerance: 0.12,
  /** wrists must be this many shoulder-widths above the nose to count as hanging */
  hangMargin: 0.1,
  /** the pulling phase alone (leaving the dead hang → chin over bar) can't be faster than this */
  minRepMs: 300,
  /** MediaPipe visibility needed for arms, shoulders and face */
  minVisibility: 0.5,
  /** smoothing for the elbow angle (0..1, higher = less smoothing) */
  emaAlpha: 0.45,
} as const;

// BlazePose landmark indices
const I = { nose: 0, mouthL: 9, mouthR: 10, lSh: 11, rSh: 12, lEl: 13, rEl: 14, lWr: 15, rWr: 16 } as const;

export interface PullupFrame extends BaseFrame {
  /** both wrists above the head: holding the bar */
  hanging: boolean;
  /** average elbow angle of both arms */
  elbow: number | null;
  /** chin height above the wrist line, in shoulder widths (positive = above the bar) */
  chinMargin: number | null;
}

const EMPTY: PullupFrame = { visible: false, hanging: false, elbow: null, chinMargin: null, points: null, lines: [], debug: '—' };

// points: [lSh, lEl, lWr, rSh, rEl, rWr, chin]
const PULLUP_LINES: Array<[number, number]> = [
  [0, 1],
  [1, 2],
  [3, 4],
  [4, 5],
  [2, 5], // the bar (wrist to wrist)
  [0, 3],
];

export function measurePullup(lms: Landmark[] | undefined, width: number, height: number): PullupFrame {
  if (!lms || lms.length < 17) return EMPTY;
  const P = (i: number): Pt => toPx(lms[i], width, height);
  const vis = Math.min(...[I.nose, I.lSh, I.rSh, I.lEl, I.rEl, I.lWr, I.rWr].map((i) => lms[i].visibility ?? 0));

  const [nose, mL, mR, lSh, rSh, lEl, rEl, lWr, rWr] = [I.nose, I.mouthL, I.mouthR, I.lSh, I.rSh, I.lEl, I.rEl, I.lWr, I.rWr].map(P);
  const shoulderW = Math.max(1, Math.hypot(lSh.x - rSh.x, lSh.y - rSh.y));
  const mouth = { x: (mL.x + mR.x) / 2, y: (mL.y + mR.y) / 2 };
  // the chin sits roughly one nose-to-mouth distance below the mouth
  const chin = { x: mouth.x, y: mouth.y + (mouth.y - nose.y) * 0.9 };
  const wristY = (lWr.y + rWr.y) / 2;
  const elbow = (angle(lSh, lEl, lWr) + angle(rSh, rEl, rWr)) / 2;
  // screen y grows downwards, so "above" means a smaller y
  const hanging = wristY < nose.y - PULLUP_RULES.hangMargin * shoulderW;
  const chinMargin = (wristY - chin.y) / shoulderW;

  return {
    visible: vis >= PULLUP_RULES.minVisibility,
    hanging,
    elbow,
    chinMargin,
    points: [lSh, lEl, lWr, rSh, rEl, rWr, chin],
    lines: PULLUP_LINES,
    debug: `elbow ${Math.round(elbow)}° · chin ${chinMargin >= 0 ? '+' : ''}${chinMargin.toFixed(2)} · ${hanging ? 'hang' : 'off bar'}`,
  };
}

export type PullupCalibration = 'notVisible' | 'notHanging' | 'armsStraight' | 'hold';

export function pullupCalibrationHint(f: PullupFrame): PullupCalibration {
  if (!f.visible) return 'notVisible';
  if (!f.hanging) return 'notHanging';
  if ((f.elbow ?? 0) < PULLUP_RULES.straightArms) return 'armsStraight';
  return 'hold';
}

/** Hint keys (texts live in i18n `exercises.pullup.hints`). */
export type PullupHint = 'higher' | 'extend' | 'fast' | 'lost';

export class PullupCounter implements Counter<PullupFrame> {
  reps = 0;
  readonly log: RepRecord[] = [];
  private smooth: number | null = null;
  /** true after a full dead hang: the next chin-over-bar may count */
  private armed = false;
  /** chin is at the bar right now (edge detection for counting) */
  private atTop = false;
  /** chin reached the bar at some point since the last dead hang */
  private topReached = false;
  private lastBottomAt: number | null = null;
  private pullStart: number | null = null;
  private minElbow = 180;

  update(f: PullupFrame, t: number): RepUpdate {
    const R = PULLUP_RULES;
    if (!f.visible || f.elbow == null || f.chinMargin == null) return { counted: false, hint: 'lost' };
    // Off the bar: nothing to count (the screen ends the set if this lasts).
    if (!f.hanging) return { counted: false, hint: null };

    this.smooth = this.smooth == null ? f.elbow : this.smooth + R.emaAlpha * (f.elbow - this.smooth);
    const a = this.smooth;

    // ----- bottom: arms straight (dead hang) -----
    if (a >= R.straightArms) {
      // pulled hard but the chin never reached the bar
      const missedTop = this.pullStart != null && !this.topReached && this.minElbow < R.pullStarted;
      this.armed = true;
      this.atTop = false;
      this.topReached = false;
      this.lastBottomAt = t;
      this.pullStart = null;
      this.minElbow = 180;
      return { counted: false, hint: missedTop ? 'higher' : null };
    }

    // ----- pulling -----
    if (this.pullStart == null) this.pullStart = this.lastBottomAt ?? t;
    this.minElbow = Math.min(this.minElbow, a);

    // Came clearly down from the bar (but arms not straight yet): the next
    // chin-over is a new attempt — useful to say "straighten your arms".
    if (this.atTop && f.chinMargin < -R.chinTolerance - 0.3) this.atTop = false;

    if (!this.atTop && f.chinMargin >= -R.chinTolerance) {
      this.atTop = true;
      this.topReached = true;
      // started this pull without a full hang (half rep from the middle)
      if (!this.armed) return { counted: false, hint: 'extend' };
      this.armed = false;
      const duration = t - this.pullStart;
      if (duration < R.minRepMs) return { counted: false, hint: 'fast' };
      this.reps += 1;
      this.log.push({
        tMs: t,
        durationMs: Math.round(duration),
        minElbow: Math.round(this.minElbow),
        chinMargin: Math.round(f.chinMargin * 100) / 100,
      });
      return { counted: true, hint: null };
    }
    return { counted: false, hint: null };
  }
}

export const pullupExercise: ExerciseDef<PullupFrame> = {
  id: 'pullup',
  measure: measurePullup,
  calibrationHint: pullupCalibrationHint,
  createCounter: () => new PullupCounter(),
  holdMs: 600,
  // Hanging is tiring: start the moment the athlete hangs still, no 3-2-1.
  countdown: 0,
  // Hands free on the bar → the set ends by itself after jumping off.
  inPosition: (f) => f.visible && f.hanging,
  autoFinishMs: 3000,
};
