// Pull-up recognition with three difficulty levels.
//
// Camera: low, in front of OR behind the athlete (face optional). Only arms and
// shoulders must be visible; hips/knees, when visible, are used to spot kipping.
//
// Per frame (distances in shoulder widths, so distance to the camera doesn't matter):
//   * elbow: average elbow angle — ~160–175° in a dead hang, small at the top
//   * hanging: wrists above the shoulders (= holding the bar)
//   * shoulderLift: how far the shoulders are below the wrists (dead hang ≈ 1.4–1.8, top ≈ 0.3–0.5)
//   * chinHeight: chin above the wrist line (only when the face is visible)
//   * swing signals for kipping: torso pitch (3D, from worldLandmarks), hip flexion
//     (knee drive), sideways hip sway (2D)
// A rep counts at the TOP (chin at the bar) after a dead hang. Its points depend on
// the difficulty: clean = 1; kipping / resistance band = 1 (easy), 0.5 (medium), 0 (hard).
// The band can't be seen by a camera, so the player declares it (trust mode).

import { angle, toPx, type Pt } from '../pose/geometry.ts';
import type { BaseFrame, Breakdown, Counter, ExerciseDef, Landmark, RepRecord, RepUpdate, WorldLandmark } from './types.ts';

export type PullupDifficulty = 'easy' | 'medium' | 'hard';

export interface PullupOptions {
  difficulty: PullupDifficulty;
  /** the player hangs with a resistance band (self-declared) */
  band: boolean;
}

/** Rules that change with difficulty. */
export const DIFFICULTY_RULES: Record<
  PullupDifficulty,
  {
    /** elbow angle at the bottom that counts as "arms straight" */
    straightArms: number;
    /** chin may be this far below the bar and still count (front view) */
    chinTolerance: number;
    /** at the top the shoulders may be at most this far below the wrists (any view) */
    shoulderTopLift: number;
    /** points for a kipping rep */
    kipValue: number;
    /** points for a rep with a resistance band */
    bandValue: number;
  }
> = {
  easy: { straightArms: 130, chinTolerance: 0.2, shoulderTopLift: 0.65, kipValue: 1, bandValue: 1 },
  medium: { straightArms: 145, chinTolerance: 0.12, shoulderTopLift: 0.55, kipValue: 0.5, bandValue: 0.5 },
  hard: { straightArms: 155, chinTolerance: 0, shoulderTopLift: 0.45, kipValue: 0, bandValue: 0 },
};

/** Rules that don't depend on difficulty. */
export const PULLUP_RULES = {
  /** elbow angle below this = a real pull attempt started */
  pullStarted: 125,
  /** wrists must be at least this far above the shoulders to count as hanging.
   *  Small on purpose: at the top the shoulders come up to ~0.3–0.5 below the bar. */
  hangLift: 0.1,
  /** "came clearly down from the bar" = bar score below this */
  leftBarScore: -0.3,
  /** the pulling phase alone can't be faster than this (≈4 frames at 28 fps) */
  minRepMs: 150,
  /** AVERAGE visibility of shoulders/elbows/wrists needed to trust a frame ("trust mode") */
  minVisibility: 0.3,
  /** face (nose + mouth) counts as visible above this — otherwise probably a back view */
  faceVisibility: 0.6,
  /** hips/knees must be at least this visible to judge kipping */
  legVisibility: 0.4,
  /** light elbow smoothing: fast reps touch straight arms only for an instant */
  emaAlpha: 0.7,
  // ---- kipping (any one is enough; starting values, tune on real people) ----
  /** torso rocking forward/back during one pull, degrees (3D) */
  kipPitchRange: 25,
  /** hips flexed (knees driven up) below this angle shoulder–hip–knee, degrees */
  kipHipFlex: 140,
  /** hips swinging sideways during one pull, shoulder widths (side view) */
  kipSwayRange: 0.5,
  /** how far back (ms) before the top to look for swinging */
  kipWindowMs: 1500,
} as const;

// BlazePose landmark indices
const I = {
  nose: 0, lEar: 7, rEar: 8, mouthL: 9, mouthR: 10,
  lSh: 11, rSh: 12, lEl: 13, rEl: 14, lWr: 15, rWr: 16,
  lHip: 23, rHip: 24, lKnee: 25, rKnee: 26,
} as const;

export interface PullupFrame extends BaseFrame {
  hanging: boolean;
  elbow: number | null;
  /** shoulders below the wrists, in shoulder widths */
  shoulderLift: number | null;
  /** chin above the wrist line in shoulder widths, or null when the face isn't visible */
  chinHeight: number | null;
  faceVisible: boolean;
  /** torso lean towards/away from the camera, degrees (null without 3D data or hips) */
  torsoPitch: number | null;
  /** shoulder–hip–knee angle, 180 = straight body (null if knees not visible) */
  hipFlex: number | null;
  /** hips' horizontal offset from the shoulders, shoulder widths (null if hips not visible) */
  hipSway: number | null;
}

const EMPTY: PullupFrame = {
  visible: false,
  hanging: false,
  elbow: null,
  shoulderLift: null,
  chinHeight: null,
  faceVisible: false,
  torsoPitch: null,
  hipFlex: null,
  hipSway: null,
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

const mid = (a: { x: number; y: number }, b: { x: number; y: number }) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
const fmt = (n: number | null, digits = 0) => (n == null ? '—' : n.toFixed(digits));

export function measurePullup(lms: Landmark[] | undefined, width: number, height: number, world?: WorldLandmark[]): PullupFrame {
  if (!lms || lms.length < 27) return EMPTY;
  const R = PULLUP_RULES;
  const P = (i: number): Pt => toPx(lms[i], width, height);
  const v = (i: number) => lms[i].visibility ?? 0;

  const armPts = [I.lSh, I.rSh, I.lEl, I.rEl, I.lWr, I.rWr];
  const armsVis = armPts.reduce((s, i) => s + v(i), 0) / armPts.length;
  const faceVisible = Math.min(v(I.nose), v(I.mouthL), v(I.mouthR)) >= R.faceVisibility;
  const hipsVisible = Math.min(v(I.lHip), v(I.rHip)) >= R.legVisibility;
  const kneesVisible = hipsVisible && Math.min(v(I.lKnee), v(I.rKnee)) >= R.legVisibility;

  const [lSh, rSh, lEl, rEl, lWr, rWr] = armPts.map(P);
  const shoulderW = Math.max(1, Math.hypot(lSh.x - rSh.x, lSh.y - rSh.y));
  const sh = mid(lSh, rSh);
  const wristY = (lWr.y + rWr.y) / 2;
  const elbow = (angle(lSh, lEl, lWr) + angle(rSh, rEl, rWr)) / 2;
  // screen y grows downwards, so "above" means a smaller y
  const hanging = wristY < sh.y - R.hangLift * shoulderW;
  const shoulderLift = (sh.y - wristY) / shoulderW;

  let head: Pt;
  let chinHeight: number | null = null;
  if (faceVisible) {
    const nose = P(I.nose);
    const mouth = mid(P(I.mouthL), P(I.mouthR));
    // the chin sits roughly one nose-to-mouth distance below the mouth
    head = { x: mouth.x, y: mouth.y + (mouth.y - nose.y) * 0.9 };
    chinHeight = (wristY - head.y) / shoulderW;
  } else {
    head = v(I.lEar) > 0.3 && v(I.rEar) > 0.3 ? mid(P(I.lEar), P(I.rEar)) : { x: sh.x, y: sh.y - 0.6 * shoulderW };
  }

  // ---- swing signals (kipping) ----
  let hipSway: number | null = null;
  let hipFlex: number | null = null;
  let torsoPitch: number | null = null;
  if (hipsVisible) {
    const hip = mid(P(I.lHip), P(I.rHip));
    hipSway = (hip.x - sh.x) / shoulderW;
    if (kneesVisible) hipFlex = angle(sh, hip, mid(P(I.lKnee), P(I.rKnee)));
    if (world && world.length >= 25) {
      const ws = { y: (world[I.lSh].y + world[I.rSh].y) / 2, z: (world[I.lSh].z + world[I.rSh].z) / 2 };
      const wh = { y: (world[I.lHip].y + world[I.rHip].y) / 2, z: (world[I.lHip].z + world[I.rHip].z) / 2 };
      // 0° = upright; positive/negative = leaning towards/away from the camera
      torsoPitch = (Math.atan2(ws.z - wh.z, wh.y - ws.y) * 180) / Math.PI;
    }
  }

  return {
    visible: armsVis >= R.minVisibility,
    hanging,
    elbow,
    shoulderLift,
    chinHeight,
    faceVisible,
    torsoPitch,
    hipFlex,
    hipSway,
    points: [lSh, lEl, lWr, rSh, rEl, rWr, head],
    lines: PULLUP_LINES,
    debug:
      `elbow ${Math.round(elbow)}° · lift ${shoulderLift.toFixed(2)} · ${faceVisible ? 'face' : 'back'} · ${hanging ? 'hang' : 'off bar'}\n` +
      `swing: pitch ${fmt(torsoPitch)}° · hips ${fmt(hipFlex)}° · sway ${fmt(hipSway, 2)}`,
  };
}

/** ≥ 0 when the chin is at/over the bar for the given difficulty (max of both signals). */
export function barScore(f: PullupFrame, difficulty: PullupDifficulty): number | null {
  if (f.shoulderLift == null) return null;
  const D = DIFFICULTY_RULES[difficulty];
  const byShoulders = D.shoulderTopLift - f.shoulderLift;
  const byChin = f.chinHeight == null ? -Infinity : f.chinHeight + D.chinTolerance;
  return Math.max(byShoulders, byChin);
}

export type PullupCalibration = 'notVisible' | 'notHanging' | 'armsStraight' | 'hold';

export function pullupCalibrationHint(f: PullupFrame, difficulty: PullupDifficulty = 'medium'): PullupCalibration {
  if (!f.visible) return 'notVisible';
  if (!f.hanging) return 'notHanging';
  if ((f.elbow ?? 0) < DIFFICULTY_RULES[difficulty].straightArms) return 'armsStraight';
  return 'hold';
}

/** Hint keys (texts live in i18n `exercises.pullup.hints`). */
export type PullupHint = 'higher' | 'extend' | 'fast' | 'lost' | 'kipHalf' | 'kipZero';

export class PullupCounter implements Counter<PullupFrame> {
  /** score (can be fractional on medium) */
  reps = 0;
  readonly log: RepRecord[] = [];
  readonly breakdown: Breakdown = { clean: 0, kipping: 0, band: 0 };
  private readonly opts: PullupOptions;
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
  /** swing samples since the previous top, limited to the last `kipWindowMs`.
   *  Kipping starts while still hanging with straight arms, so the dead hang counts too. */
  private swing: Array<{ t: number; pitch: number | null; sway: number | null; hip: number | null }> = [];

  constructor(opts: PullupOptions = { difficulty: 'medium', band: false }) {
    this.opts = opts;
  }

  private trackSwing(f: PullupFrame, t: number) {
    this.swing.push({ t, pitch: f.torsoPitch, sway: f.hipSway, hip: f.hipFlex });
    const from = t - PULLUP_RULES.kipWindowMs;
    while (this.swing.length && this.swing[0].t < from) this.swing.shift();
  }

  /** Did the body swing / knees drive in the run-up to this top? */
  private kipped(): boolean {
    const R = PULLUP_RULES;
    const range = (vals: number[]) => (vals.length ? Math.max(...vals) - Math.min(...vals) : 0);
    const pick = (k: 'pitch' | 'sway' | 'hip') => this.swing.map((s) => s[k]).filter((x): x is number => x != null);
    const hips = pick('hip');
    return (
      range(pick('pitch')) > R.kipPitchRange ||
      range(pick('sway')) > R.kipSwayRange ||
      (hips.length > 0 && Math.min(...hips) < R.kipHipFlex)
    );
  }

  update(f: PullupFrame, t: number): RepUpdate {
    const R = PULLUP_RULES;
    const D = DIFFICULTY_RULES[this.opts.difficulty];
    const score = barScore(f, this.opts.difficulty);
    if (!f.visible || f.elbow == null || score == null) return { counted: false, hint: 'lost' };
    // Off the bar: nothing to count (the screen ends the set if this lasts).
    if (!f.hanging) return { counted: false, hint: null };

    this.smooth = this.smooth == null ? f.elbow : this.smooth + R.emaAlpha * (f.elbow - this.smooth);
    const a = this.smooth;
    this.trackSwing(f, t);

    // ----- bottom: arms straight (dead hang) -----
    // The raw angle counts too: at a fast pace the arms are straight only for a frame or two.
    if (a >= D.straightArms || f.elbow >= D.straightArms) {
      const missedTop = this.pullStart != null && !this.topReached && this.minElbow < R.pullStarted;
      // Back in the hang after a pull: forget the previous rep's descent; the swing
      // (if any) for the next rep starts from here.
      if (this.pullStart != null) this.swing = this.swing.slice(-1);
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
    if (this.atTop && score < R.leftBarScore) this.atTop = false;

    if (!this.atTop && score >= 0) {
      this.atTop = true;
      this.topReached = true;
      if (!this.armed) return { counted: false, hint: 'extend' };
      this.armed = false;
      const duration = t - this.pullStart;
      if (duration < R.minRepMs) return { counted: false, hint: 'fast' };

      const kip = this.kipped();
      const points = Math.min(kip ? D.kipValue : 1, this.opts.band ? D.bandValue : 1);
      if (kip) this.breakdown.kipping += 1;
      else if (this.opts.band) this.breakdown.band += 1;
      else this.breakdown.clean += 1;

      this.log.push({
        tMs: t,
        durationMs: Math.round(duration),
        minElbow: Math.round(this.minElbow),
        points,
        kipping: kip ? 1 : 0,
        faceVisible: f.faceVisible ? 1 : 0,
      });
      if (points <= 0) return { counted: false, hint: 'kipZero' };
      this.reps += points;
      return { counted: true, hint: kip && points < 1 ? 'kipHalf' : null };
    }
    return { counted: false, hint: null };
  }
}

/** Builds the pull-up exercise for a chosen difficulty (and band on/off). */
export function makePullupExercise(opts: PullupOptions = { difficulty: 'medium', band: false }): ExerciseDef<PullupFrame> {
  return {
    id: 'pullup',
    measure: measurePullup,
    calibrationHint: (f) => pullupCalibrationHint(f, opts.difficulty),
    createCounter: () => new PullupCounter(opts),
    holdMs: 600,
    // Hanging is tiring: start the moment the athlete hangs still, no 3-2-1.
    countdown: 0,
    // Hands are busy on the bar → the set ends by itself after jumping off.
    // Only a CONFIDENT "arms below the bar" counts as off the bar; a frame the
    // camera isn't sure about (e.g. bent arms seen from behind) never ends the set.
    inPosition: (f) => !f.visible || f.hanging,
    autoFinishMs: 3000,
  };
}

/** Default (medium, no band) — used by tests and as a fallback. */
export const pullupExercise = makePullupExercise();
