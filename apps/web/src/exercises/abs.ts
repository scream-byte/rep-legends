// Sit-up ("abs") recognition: per-frame pose landmarks → counted reps.
//
// Camera: phone upright on the floor 2–3 m away, the athlete lying on the back SIDE-ON,
// knees bent. Only shoulders, hips and knees are needed (feet may be hidden).
//   * torso angle = shoulder–hip line vs the floor: ~0–15° lying, ~60°+ sitting up
// Lessons from squats applied from the start (real-phone tests, 2026-11-24):
//   * one LOCKED side (the far side is hidden side-on, MediaPipe may swap sides);
//   * every state change must hold for a couple of frames (debounce);
//   * attempts are measured from the athlete's own "rest level" (how they lie between
//     reps, e.g. with a slightly raised head), learned as an AVERAGE, not from noise;
//   * stay in place: shuffling to the phone and back must not count.
// A rep reaches the TOP (torso up to ~60°) only if the previous bottom was a real lie-down
// and both knees stayed bent; it is CONFIRMED when the athlete goes back down (or stays
// at the top 2 s) — sitting up to stand up and take the phone doesn't count (user's test
// 2026-11-25). "Moderate" standard: no need to touch the knees, safe for the lower back.

import { angle, toPx, type Pt } from '../pose/geometry.ts';
import type { BaseFrame, Counter, ExerciseDef, Landmark, RepRecord, RepUpdate } from './types.ts';

export const ABS_RULES = {
  /** top: torso at least this many degrees off the floor (≈ half-way up) */
  upAngle: 55, // the instructions say "about 60°": 5° of margin for camera jitter
  /** bottom: torso back down to this (or to `downAboveRest` above the rest level) */
  downAngle: 25,
  downAboveRest: 10,
  /** an attempt started: torso rose this far above the rest level … */
  startRise: 12,
  /** … for at least this long */
  attemptMs: 100,
  /** "higher!" only if the attempt really rose this much (smaller = jitter, ignored) */
  higherHintMin: 18,
  /** frames for reaching the top / the bottom (fast reps touch them briefly) */
  edgeFrames: 2,
  /** frames for "came back down" after a partial attempt */
  holdFrames: 3,
  /** leaving the floor (torso above `downAngle`) → top (`upAngle`) takes at least this
   *  long; only catches an extreme "throw" (a brisk 1 s sit-up needs ≈ 0.15–0.3 s;
   *  coarse at 15 fps, so the main "too fast" check is `minCycleMs`) */
  minRepMs: 80,
  /** … and top to top at least this long (a brisk 1 s sit-up is fine, throwing
   *  yourself up and down twice a second is not). Frame-rate proof, unlike the above */
  minCycleMs: 700,
  /** came down from the top (below this) without lying down → the next "up" is a new
   *  attempt that will NOT count ("lie down!") */
  releaseAngle: 42,
  /** after a counted rep, at least this long before the next attempt can start */
  restMs: 200,
  /** MediaPipe visibility needed for shoulder, hip and knee */
  minVisibility: 0.5,
  /** start position: lying (torso below this) with knees bent (knee angle below this) */
  startMaxTorso: 30,
  startMaxKnee: 150,
  /** switch the tracked side only if the other one is this much more visible … */
  sideSwitchMargin: 0.15,
  /** … for this many frames in a row */
  sideSwitchFrames: 8,
  /** rest level (lying): follows only small changes slowly; lower values must last */
  restCreepBand: 6,
  restAlpha: 0.05,
  restResetMs: 300,
  /** "left the spot": hips moved more than this many torso lengths, or the body looks
   *  this much bigger / smaller (moved towards / away from the phone) */
  maxHipShift: 0.6,
  maxScaleChange: 0.25,
  /** lying still elsewhere this long → accept it as the new spot */
  reanchorMs: 2500,
  /** smoothing for the torso angle (0..1, higher = less smoothing) */
  emaAlpha: 0.5,
  /** knees: a leg is "straight" above this angle; a rep with a straight leg in at least
   *  `straightShare` of the frames (where legs were visible) doesn't count */
  straightKnee: 150,
  straightShare: 0.5,
  /** a rep reached the top is CONFIRMED only when the athlete goes back down (below
   *  `releaseAngle`) or stays in place at the top this long. Getting up to take the phone
   *  (hips rise more than `getUpShift` torso lengths) cancels it. */
  confirmMs: 2000,
  getUpShift: 0.35,
} as const;

// BlazePose landmark indices per side
const SIDES = {
  left: { sh: 11, hip: 23, knee: 25, ank: 27 },
  right: { sh: 12, hip: 24, knee: 26, ank: 28 },
} as const;
export type Side = keyof typeof SIDES;

export interface AbsSideData {
  /** visibility of shoulder, hip, knee (min) */
  vis: number;
  /** torso angle off the floor, degrees: 0 lying flat, 90 sitting upright, MORE than 90
   *  leaning forward to the knees (measured towards the knees, so "elbows to knees"
   *  never looks like lying back down) */
  torso: number;
  /** hip–knee–ankle angle of this leg (null if the knee or ankle isn't visible) */
  knee: number | null;
  /** shoulder–hip length in pixels (scale for the stay-in-place check) */
  torsoLen: number;
  hip: Pt;
  points: Pt[];
}

export interface AbsFrame extends BaseFrame {
  /** best-visible side in THIS frame (calibration / debug); the counter locks its own */
  side: Side | null;
  torso: number | null;
  knee: number | null;
  sides: Record<Side, AbsSideData | null>;
}

const EMPTY: AbsFrame = { visible: false, side: null, torso: null, knee: null, sides: { left: null, right: null }, points: null, lines: [], debug: '—' };

// points: [shoulder, hip, knee, ankle]
const ABS_LINES: Array<[number, number]> = [
  [0, 1],
  [1, 2],
  [2, 3],
];

function sideData(lms: Landmark[], side: Side, w: number, h: number): AbsSideData {
  const s = SIDES[side];
  const v = (i: number) => lms[i].visibility ?? 0;
  const vis = Math.min(v(s.sh), v(s.hip), v(s.knee));
  const [sh, hip, knee, ank] = [s.sh, s.hip, s.knee, s.ank].map((i) => toPx(lms[i], w, h));
  // Lying, the shoulders are on the side AWAY from the knees. The angle is measured from
  // that direction (0°) through upright (90°) to leaning over the knees (> 90°).
  // Screen y grows downwards: shoulders above the hips → positive.
  const back = knee.x >= hip.x ? -1 : 1; // direction from the hips towards the head when lying
  const torso = (Math.atan2(hip.y - sh.y, (sh.x - hip.x) * back) * 180) / Math.PI;
  return {
    vis,
    torso: Math.min(180, Math.max(0, torso)),
    knee: Math.min(v(s.knee), v(s.ank)) >= 0.4 ? angle(hip, knee, ank) : null,
    torsoLen: Math.max(1, Math.hypot(sh.x - hip.x, sh.y - hip.y)),
    hip,
    points: [sh, hip, knee, ank],
  };
}

export function measureAbs(lms: Landmark[] | undefined, width: number, height: number): AbsFrame {
  if (!lms || lms.length < 29) return EMPTY;
  const sides = { left: sideData(lms, 'left', width, height), right: sideData(lms, 'right', width, height) };
  const best: Side = sides.left.vis >= sides.right.vis ? 'left' : 'right';
  const b = sides[best];
  return {
    visible: b.vis >= ABS_RULES.minVisibility,
    side: best,
    torso: b.torso,
    knee: b.knee,
    sides,
    points: b.points,
    lines: ABS_LINES,
    debug: `${best} · torso ${Math.round(b.torso)}° · knees ${kneeText(sides.left.knee)}/${kneeText(sides.right.knee)}`,
  };
}

const kneeText = (k: number | null) => (k == null ? '—' : `${Math.round(k)}°`);

/** The straightest visible knee in this frame (null if no leg is visible). */
export function straightestKnee(f: AbsFrame): number | null {
  const ks = [f.sides.left?.knee, f.sides.right?.knee].filter((k): k is number => k != null);
  return ks.length ? Math.max(...ks) : null;
}

export type AbsCalibration = 'notVisible' | 'lieDown' | 'bendKnees' | 'hold';

/** What the player must fix before the set can start. */
export function absCalibrationHint(f: AbsFrame): AbsCalibration {
  if (!f.visible) return 'notVisible';
  if ((f.torso ?? 90) > ABS_RULES.startMaxTorso) return 'lieDown';
  if ((straightestKnee(f) ?? 0) > ABS_RULES.startMaxKnee) return 'bendKnees'; // BOTH legs bent
  return 'hold';
}

/** Hint keys (texts live in i18n `exercises.abs.hints`). 'place' / 'lost' are lasting banners. */
export type AbsHint = 'higher' | 'down' | 'fast' | 'knees' | 'lost' | 'place';

/** A condition that must hold for `n` frames in a row before it "fires". */
class Debounce {
  private count = 0;
  private readonly n: number;
  constructor(n: number) {
    this.n = n;
  }
  /** the condition is currently true (at least one frame) */
  get active(): boolean {
    return this.count > 0;
  }
  feed(cond: boolean): boolean {
    this.count = cond ? this.count + 1 : 0;
    return this.count >= this.n;
  }
  reset() {
    this.count = 0;
  }
}

export class AbsCounter implements Counter<AbsFrame> {
  reps = 0;
  readonly log: RepRecord[] = [];
  private side: Side | null = null;
  private otherBetter = 0;
  private smooth: number | null = null;
  /** torso angle while lying between reps */
  private rest: number | null = null;
  private lowerSince: number | null = null;
  private lowerSum = 0;
  private lowerN = 0;
  /** true after a real lie-down: the next "up" may count */
  private armed = false;
  /** currently at the top (edge detection) */
  private atTop = false;
  /** came part-way down from the top without lying down */
  private released = false;
  private lastTopAt = -Infinity;
  private attemptStart: number | null = null;
  private aboveSince: number | null = null;
  private lastBottomAt: number | null = null;
  private lastCountAt = -Infinity;
  private maxTorso = 0;
  /** where the athlete lies: reference hip position and torso length */
  private refHip: Pt | null = null;
  private refLen: number | null = null;
  private outSince: number | null = null;
  /** reached the top, waiting for confirmation (going back down / staying in place) */
  private pending: { t: number; hip: Pt; len: number; rec: RepRecord } | null = null;
  /** frames since the last top where a leg was visible / where a leg was straight */
  private legFrames = 0;
  private straightFrames = 0;
  private readonly upDeb = new Debounce(ABS_RULES.edgeFrames);
  private readonly downDeb = new Debounce(ABS_RULES.edgeFrames);
  private readonly backDeb = new Debounce(ABS_RULES.holdFrames);

  /** Locks onto one side; switches only if the other one is clearly better for a while. */
  private pickSide(f: AbsFrame): AbsSideData | null {
    const R = ABS_RULES;
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
      this.smooth = null;
    }
    return f.sides[this.side]!;
  }

  private endAttempt() {
    this.attemptStart = null;
    this.aboveSince = null;
    this.maxTorso = 0;
    this.backDeb.reset();
  }

  update(f: AbsFrame, t: number): RepUpdate {
    const R = ABS_RULES;
    const sd = f.visible ? this.pickSide(f) : null;
    if (!sd) return { counted: false, hint: 'lost' };

    this.smooth = this.smooth == null ? sd.torso : this.smooth + R.emaAlpha * (sd.torso - this.smooth);
    const a = this.smooth;

    // ----- legs: both knees must stay bent during the rep -----
    const k = straightestKnee(f);
    if (k != null) {
      this.legFrames += 1;
      if (k > R.straightKnee) this.straightFrames += 1;
    }

    // ----- stay in place -----
    if (this.refHip == null || this.refLen == null) {
      if (a > R.startMaxTorso) return { counted: false, hint: null }; // wait until lying
      this.refHip = sd.hip;
      this.refLen = sd.torsoLen;
    }
    const shifted = Math.hypot(sd.hip.x - this.refHip.x, sd.hip.y - this.refHip.y) > R.maxHipShift * this.refLen;
    const scaled = Math.abs(sd.torsoLen / this.refLen - 1) > R.maxScaleChange;
    if (shifted || scaled) {
      this.outSince ??= t;
      if (a <= R.startMaxTorso && t - this.outSince > R.reanchorMs) {
        this.refHip = sd.hip; // lay down at a new spot and stayed there
        this.refLen = sd.torsoLen;
        this.outSince = null;
        this.rest = null;
      } else {
        this.armed = false;
        this.atTop = false;
        this.pending = null; // e.g. got up and walked to the phone
        this.endAttempt();
        return { counted: false, hint: 'place' };
      }
    } else {
      this.outSince = null;
    }

    // ----- confirm the last rep: back down → counts; got up from the floor → cancelled -----
    let confirmed = false;
    if (this.pending) {
      const pd = this.pending;
      if (Math.hypot(sd.hip.x - pd.hip.x, sd.hip.y - pd.hip.y) > R.getUpShift * pd.len) {
        this.pending = null; // sat up only to stand up (e.g. to take the phone)
      } else if (a < R.releaseAngle || t - pd.t >= R.confirmMs) {
        this.reps += 1;
        this.log.push(pd.rec);
        this.pending = null;
        confirmed = true;
      }
    }
    const out = (hint: string | null): RepUpdate => ({ counted: confirmed, hint });

    // ----- rest level: how this athlete lies between reps -----
    if (this.rest == null) this.rest = a;
    const nearRest = Math.abs(a - this.rest) < R.restCreepBand;
    if (!this.atTop && this.attemptStart == null) {
      if (a < this.rest - R.restCreepBand) {
        // lies flatter than before — trust it only if it lasts, take the average
        if (this.lowerSince == null) {
          this.lowerSince = t;
          this.lowerSum = 0;
          this.lowerN = 0;
        }
        this.lowerSum += a;
        this.lowerN += 1;
        if (t - this.lowerSince >= R.restResetMs) {
          this.rest = this.lowerSum / this.lowerN;
          this.lowerSince = null;
        }
      } else {
        this.lowerSince = null;
        // follows small changes; while clearly lying it may also slowly move UP (otherwise one
        // flat moment would pin it low forever and ordinary lying would look like an attempt)
        if (nearRest || this.downDeb.active) this.rest += R.restAlpha * (a - this.rest);
      }
    }
    const rest = this.rest;

    // ----- bottom: lying down (shoulder blades near the floor) -----
    // judged on the smoothed OR the raw angle: on a slow phone a quick lie-down without a
    // pause shows only 1–2 low frames, and smoothing alone would hide them. The raw angle
    // only counts when the smoothed one is close too (a glitch at the top can't "lie down").
    const lowLine = Math.max(R.downAngle, rest + R.downAboveRest);
    const lying = a <= lowLine || (sd.torso <= lowLine && a <= lowLine + 15);
    const lyingStable = this.downDeb.feed(lying);
    if (lyingStable) {
      this.armed = true;
      this.atTop = false;
      this.released = false;
    }
    // the rep's duration is measured from the LAST lying frame (leaving the floor);
    // debounced, so a one-frame glitch mid-rise doesn't look like "just left the floor"
    if (lyingStable) this.lastBottomAt = t;

    // ----- an attempt: torso rises above the rest level for a moment -----
    const above = a - rest > R.startRise && t - this.lastCountAt > R.restMs;
    if (this.attemptStart == null && !this.atTop) {
      if (above) this.aboveSince ??= t;
      else this.aboveSince = null;
      if (this.aboveSince != null && t - this.aboveSince >= R.attemptMs) {
        this.attemptStart = this.lastBottomAt ?? this.aboveSince;
        this.maxTorso = a;
        this.backDeb.reset();
      }
    }
    if (this.attemptStart != null) this.maxTorso = Math.max(this.maxTorso, a);

    // ----- top -----
    if ((!this.atTop || this.released) && this.upDeb.feed(a >= R.upAngle)) {
      this.atTop = true;
      this.released = false;
      const cycle = t - this.lastTopAt;
      this.lastTopAt = t;
      const start = this.attemptStart ?? this.lastBottomAt ?? t;
      const maxTorso = Math.round(this.maxTorso);
      const straightLeg = this.legFrames >= 3 && this.straightFrames / this.legFrames >= R.straightShare;
      this.legFrames = 0;
      this.straightFrames = 0;
      this.endAttempt();
      if (!this.armed) return out('down'); // didn't lie down before this one
      this.armed = false;
      const duration = t - start;
      this.lastCountAt = t;
      if (straightLeg) return out('knees');
      if (duration < R.minRepMs || cycle < R.minCycleMs) return out('fast');
      const rec = { tMs: t, durationMs: Math.round(duration), maxTorso: Math.max(maxTorso, Math.round(a)), rest: Math.round(rest) };
      this.pending = { t, hip: sd.hip, len: sd.torsoLen, rec };
      return out(null);
    }
    if (a < R.upAngle) this.upDeb.feed(false);
    if (this.atTop && !this.released && !lying && this.backDeb.feed(a < R.releaseAngle)) {
      this.released = true; // came down part-way only: the next top won't count
      this.backDeb.reset();
    }

    // ----- partial attempt: rose a bit and lay back down without reaching the top -----
    if (this.attemptStart != null && !this.atTop && this.backDeb.feed(a - rest < R.startRise / 2)) {
      const real = this.maxTorso - rest >= R.higherHintMin;
      this.endAttempt();
      this.lastCountAt = t;
      return out(real ? 'higher' : null);
    }

    return out(null);
  }
}

export const absExercise: ExerciseDef<AbsFrame> = {
  id: 'abs',
  measure: measureAbs,
  calibrationHint: absCalibrationHint,
  createCounter: () => new AbsCounter(),
  holdMs: 1000,
  countdown: 3,
};
