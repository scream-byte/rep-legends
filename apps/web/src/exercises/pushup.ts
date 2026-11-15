// Push-up recognition: turns per-frame pose landmarks into counted reps.
//
// How it works (side view):
//   * elbow angle = shoulder–elbow–wrist; ~170° arms straight, <90° at the bottom
//   * body line   = shoulder–hip–ankle; ~180° for a straight plank
// A rep counts only after a full cycle UP → DOWN → UP that passes the checks
// below. Thresholds are starting values and will be tuned on real people.

import { angle, toPx } from '../pose/geometry.ts';
import type { BaseFrame, Counter, ExerciseDef, Landmark, RepRecord, RepUpdate } from './types.ts';

export const PUSHUP_RULES = {
  /** elbow angle below this = bottom of the rep */
  downAngle: 90,
  /** elbow angle above this = arms straight again */
  upAngle: 155,
  /** elbow angle below this = a rep attempt has started */
  descentStart: 140,
  /** shoulder–hip–ankle must stay above this (no sagging / piking) */
  minBodyLine: 150,
  /** a real push-up takes at least this long (measured from arms leaving the straight position) */
  minRepMs: 400,
  /** MediaPipe visibility needed for every key point */
  minVisibility: 0.6,
  /** body is "horizontal" if its width on screen is this many times its height */
  plankRatio: 1.3,
  /** smoothing for the elbow angle (0..1, higher = less smoothing) */
  emaAlpha: 0.4,
} as const;

// BlazePose landmark indices for each side of the body
const SIDES = {
  left: { sh: 11, el: 13, wr: 15, hip: 23, ank: 27 },
  right: { sh: 12, el: 14, wr: 16, hip: 24, ank: 28 },
} as const;
type Side = keyof typeof SIDES;

export interface PushupFrame extends BaseFrame {
  side: Side | null;
  plank: boolean;
  elbow: number | null;
  bodyLine: number | null;
}

const EMPTY: PushupFrame = {
  visible: false,
  side: null,
  plank: false,
  elbow: null,
  bodyLine: null,
  points: null,
  lines: [],
  debug: '—',
};

// shoulder–elbow–wrist and shoulder–hip–ankle, as indexes into `points`
const PUSHUP_LINES: Array<[number, number]> = [
  [0, 1],
  [1, 2],
  [0, 3],
  [3, 4],
];

/** Measures one frame. Picks whichever side of the body the camera sees better. */
export function measurePushup(lms: Landmark[] | undefined, width: number, height: number): PushupFrame {
  if (!lms || lms.length < 29) return EMPTY;
  let best: Side = 'left';
  let bestVis = -1;
  for (const side of Object.keys(SIDES) as Side[]) {
    const ids = Object.values(SIDES[side]);
    const vis = Math.min(...ids.map((i) => lms[i].visibility ?? 0));
    if (vis > bestVis) {
      bestVis = vis;
      best = side;
    }
  }
  const s = SIDES[best];
  const [sh, el, wr, hip, ank] = [s.sh, s.el, s.wr, s.hip, s.ank].map((i) => toPx(lms[i], width, height));
  const dx = Math.abs(sh.x - ank.x);
  const dy = Math.abs(sh.y - ank.y);
  const elbow = angle(sh, el, wr);
  const bodyLine = angle(sh, hip, ank);
  return {
    visible: bestVis >= PUSHUP_RULES.minVisibility,
    side: best,
    plank: dx > dy * PUSHUP_RULES.plankRatio,
    elbow,
    bodyLine,
    points: [sh, el, wr, hip, ank],
    lines: PUSHUP_LINES,
    debug: `${best} · elbow ${Math.round(elbow)}° · body ${Math.round(bodyLine)}°`,
  };
}

export type CalibrationHint = 'notVisible' | 'notPlank' | 'armsStraight' | 'hold';

/** What the player must fix before the set can start. */
export function calibrationHint(f: PushupFrame): CalibrationHint {
  if (!f.visible) return 'notVisible';
  if (!f.plank) return 'notPlank';
  if ((f.elbow ?? 0) < PUSHUP_RULES.upAngle - 5) return 'armsStraight';
  return 'hold';
}

/** Hint keys (texts live in i18n `exercises.pushup.hints`). */
export type RepHint = 'lower' | 'back' | 'fast' | 'lost' | 'plank';

export class PushupCounter implements Counter<PushupFrame> {
  reps = 0;
  readonly log: RepRecord[] = [];
  private phase: 'up' | 'down' = 'up';
  private smooth: number | null = null;
  private repStart: number | null = null;
  /** last moment the arms were straight — the true start of the next rep */
  private lastTopAt: number | null = null;
  private minElbow = 180;
  private minBody = 180;
  private leftPlank = false;

  /** Feed one measured frame; `t` is a timestamp in ms. */
  update(f: PushupFrame, t: number): RepUpdate {
    const R = PUSHUP_RULES;
    if (!f.visible || f.elbow == null || f.bodyLine == null) {
      // Pause: keep the current phase so a rep can finish when the player reappears.
      return { counted: false, hint: 'lost' };
    }

    this.smooth = this.smooth == null ? f.elbow : this.smooth + R.emaAlpha * (f.elbow - this.smooth);
    const a = this.smooth;

    if (this.phase === 'up' && a > R.upAngle) this.lastTopAt = t;

    if (this.repStart == null && a < R.descentStart) {
      this.repStart = this.lastTopAt ?? t;
      this.minElbow = a;
      this.minBody = f.bodyLine;
      this.leftPlank = false;
    }
    if (this.repStart != null) {
      this.minElbow = Math.min(this.minElbow, a);
      this.minBody = Math.min(this.minBody, f.bodyLine);
      if (!f.plank) this.leftPlank = true;
    }

    if (this.phase === 'up') {
      if (a < R.downAngle) {
        this.phase = 'down';
      } else if (this.repStart != null && a > R.upAngle) {
        // Went partway down and came back up: not deep enough.
        this.repStart = null;
        return { counted: false, hint: 'lower' };
      }
      return { counted: false, hint: null };
    }

    // phase === 'down': wait for arms to straighten
    if (a <= R.upAngle) return { counted: false, hint: null };

    const start = this.repStart ?? t;
    const duration = t - start;
    this.phase = 'up';
    this.repStart = null;

    if (this.leftPlank) return { counted: false, hint: 'plank' };
    if (this.minBody < R.minBodyLine) return { counted: false, hint: 'back' };
    if (duration < R.minRepMs) return { counted: false, hint: 'fast' };

    this.reps += 1;
    this.log.push({ tMs: t, durationMs: Math.round(duration), minElbow: Math.round(this.minElbow), minBodyLine: Math.round(this.minBody) });
    return { counted: true, hint: null };
  }
}

export const pushupExercise: ExerciseDef<PushupFrame> = {
  id: 'pushup',
  measure: measurePushup,
  calibrationHint,
  createCounter: () => new PushupCounter(),
  holdMs: 1000,
  countdown: 3,
};
