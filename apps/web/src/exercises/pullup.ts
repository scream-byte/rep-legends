// Pull-up recognition. The camera stands low, in front of OR behind the athlete
// (many bars are mounted so the face looks at a wall) — so the face is optional.
// Only arms and shoulders must be visible; legs/feet may be out of frame.
//
// Per frame we measure (all distances in shoulder widths, so the distance to
// the camera doesn't matter):
//   * elbow angle (average of both arms): ~170° in a dead hang, small at the top
//   * hanging: both wrists clearly above the shoulders (= holding the bar)
//   * "at the bar" score, from two independent signals:
//       - chin vs the wrist line (only when the face is visible, front view)
//       - how close the shoulders came up to the wrists (works from any side:
//         with the chin at the bar the shoulders are almost at bar level)
//     score ≥ 0 means "chin is at the bar"
// A rep counts at the TOP, but only if the previous bottom was a full hang with
// straight arms. Thresholds are starting values, tuned on real people.

import { angle, toPx, type Pt } from '../pose/geometry.ts';
import type { BaseFrame, Counter, ExerciseDef, Landmark, RepRecord, RepUpdate } from './types.ts';

export const PULLUP_RULES = {
  /** elbow angle above this = arms straight (bottom / dead hang). Real hangs measured ~157°. */
  straightArms: 145,
  /** elbow angle below this = a real pull attempt started */
  pullStarted: 125,
  /** front view: chin may be this far below the wrist line and still count */
  chinTolerance: 0.12,
  /** any view: at the top the shoulders are at most this far below the wrists (dead hang ≈ 1.4–1.7) */
  shoulderTopLift: 0.55,
  /** wrists must be at least this far above the shoulders to count as hanging on the bar.
   *  Small on purpose: at the top of a rep the shoulders come up to ~0.3–0.5 below the bar. */
  hangLift: 0.1,
  /** "came clearly down from the bar" = score below this */
  leftBarScore: -0.3,
  /** the pulling phase alone (leaving the dead hang → chin over bar) can't be faster than this.
   *  Trained athletes pull up in ~0.2–0.3 s (user's normal pace was rejected at 300).
   *  150 ms ≈ 4 frames at 28 fps: still rejects one-frame camera glitches. */
  minRepMs: 150,
  /** AVERAGE MediaPipe visibility of shoulders, elbows and wrists needed to trust the frame.
   *  Low on purpose ("trust mode"): from behind, bent arms at the bar get low visibility
   *  even though the points are placed correctly (seen on a real phone: top of rep went red). */
  minVisibility: 0.3,
  /** face (nose + mouth) counts as visible above this — otherwise we assume a back view */
  faceVisibility: 0.6,
  /** light smoothing for the elbow angle (0..1, higher = less smoothing): fast reps
   *  only touch straight arms for an instant, heavy smoothing would hide that */
  emaAlpha: 0.7,
} as const;

// BlazePose landmark indices
const I = { nose: 0, lEar: 7, rEar: 8, mouthL: 9, mouthR: 10, lSh: 11, rSh: 12, lEl: 13, rEl: 14, lWr: 15, rWr: 16 } as const;

export interface PullupFrame extends BaseFrame {
  /** both wrists above the shoulders: holding the bar */
  hanging: boolean;
  /** average elbow angle of both arms */
  elbow: number | null;
  /** ≥ 0 when the chin is at/over the bar (see header comment) */
  barScore: number | null;
  /** the face is visible (front view); false = probably filmed from behind */
  faceVisible: boolean;
}

const EMPTY: PullupFrame = {
  visible: false,
  hanging: false,
  elbow: null,
  barScore: null,
  faceVisible: false,
  points: null,
  lines: [],
  debug: '—',
};

// points: [lSh, lEl, lWr, rSh, rEl, rWr, head]
const PULLUP_LINES: Array<[number, number]> = [
  [0, 1],
  [1, 2],
  [3, 4],
  [4, 5],
  [2, 5], // the bar (wrist to wrist)
  [0, 3],
];

const signed = (n: number) => `${n >= 0 ? '+' : ''}${n.toFixed(2)}`;

export function measurePullup(lms: Landmark[] | undefined, width: number, height: number): PullupFrame {
  if (!lms || lms.length < 17) return EMPTY;
  const R = PULLUP_RULES;
  const P = (i: number): Pt => toPx(lms[i], width, height);
  const v = (i: number) => lms[i].visibility ?? 0;

  // Only arms + shoulders are required. Head and legs are optional.
  // Average (not minimum): one doubtful elbow shouldn't throw away the whole frame.
  const armPts = [I.lSh, I.rSh, I.lEl, I.rEl, I.lWr, I.rWr];
  const armsVis = armPts.reduce((s, i) => s + v(i), 0) / armPts.length;
  const faceVisible = Math.min(v(I.nose), v(I.mouthL), v(I.mouthR)) >= R.faceVisibility;

  const [lSh, rSh, lEl, rEl, lWr, rWr] = [I.lSh, I.rSh, I.lEl, I.rEl, I.lWr, I.rWr].map(P);
  const shoulderW = Math.max(1, Math.hypot(lSh.x - rSh.x, lSh.y - rSh.y));
  const shoulderY = (lSh.y + rSh.y) / 2;
  const wristY = (lWr.y + rWr.y) / 2;
  const elbow = (angle(lSh, lEl, lWr) + angle(rSh, rEl, rWr)) / 2;

  // screen y grows downwards, so "above" means a smaller y
  const hanging = wristY < shoulderY - R.hangLift * shoulderW;

  // signal 1 (any view): shoulders rose close to the bar
  const shoulderLift = (shoulderY - wristY) / shoulderW;
  const shoulderScore = R.shoulderTopLift - shoulderLift;

  // signal 2 (front view only): chin at the wrist line
  let head: Pt;
  let chinScore = -Infinity;
  if (faceVisible) {
    const nose = P(I.nose);
    const mouth = { x: (P(I.mouthL).x + P(I.mouthR).x) / 2, y: (P(I.mouthL).y + P(I.mouthR).y) / 2 };
    // the chin sits roughly one nose-to-mouth distance below the mouth
    head = { x: mouth.x, y: mouth.y + (mouth.y - nose.y) * 0.9 };
    chinScore = (wristY - head.y) / shoulderW + R.chinTolerance;
  } else {
    // back of the head: between the ears (or above the shoulders if ears are hidden)
    head = v(I.lEar) > 0.3 && v(I.rEar) > 0.3 ? { x: (P(I.lEar).x + P(I.rEar).x) / 2, y: (P(I.lEar).y + P(I.rEar).y) / 2 } : { x: (lSh.x + rSh.x) / 2, y: shoulderY - 0.6 * shoulderW };
  }
  const barScore = Math.max(chinScore, shoulderScore);

  return {
    visible: armsVis >= R.minVisibility,
    hanging,
    elbow,
    barScore,
    faceVisible,
    points: [lSh, lEl, lWr, rSh, rEl, rWr, head],
    lines: PULLUP_LINES,
    debug: `elbow ${Math.round(elbow)}° · bar ${signed(barScore)} · ${faceVisible ? 'face' : 'back'} · ${hanging ? 'hang' : 'off bar'}`,
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
    if (!f.visible || f.elbow == null || f.barScore == null) return { counted: false, hint: 'lost' };
    // Off the bar: nothing to count (the screen ends the set if this lasts).
    if (!f.hanging) return { counted: false, hint: null };

    this.smooth = this.smooth == null ? f.elbow : this.smooth + R.emaAlpha * (f.elbow - this.smooth);
    const a = this.smooth;

    // ----- bottom: arms straight (dead hang) -----
    // The raw angle counts too: at a fast pace the arms are straight only for a frame or two.
    if (a >= R.straightArms || f.elbow >= R.straightArms) {
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
    if (this.atTop && f.barScore < R.leftBarScore) this.atTop = false;

    if (!this.atTop && f.barScore >= 0) {
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
        barScore: Math.round(f.barScore * 100) / 100,
        faceVisible: f.faceVisible ? 1 : 0,
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
  // Hands are busy on the bar → the set ends by itself after jumping off.
  // Only a CONFIDENT "arms below the bar" counts as off the bar; a frame the
  // camera isn't sure about (e.g. bent arms seen from behind) never ends the set.
  inPosition: (f) => !f.visible || f.hanging,
  autoFinishMs: 3000,
};
