// Push-up recognition: turns per-frame pose landmarks into counted reps.
//
// How it works (side view):
//   * elbow angle = shoulderвЂ“elbowвЂ“wrist; ~170В° arms straight, <90В° at the bottom
//   * body line   = shoulderвЂ“hipвЂ“ankle; ~180В° for a straight plank
// A rep counts only after a full cycle UP в†’ DOWN в†’ UP that passes the checks
// below. Thresholds are starting values and will be tuned on real people.

import { angle, toPx, type Pt } from '../pose/geometry.ts';

export const PUSHUP_RULES = {
  /** elbow angle below this = bottom of the rep */
  downAngle: 90,
  /** elbow angle above this = arms straight again */
  upAngle: 155,
  /** elbow angle below this = a rep attempt has started */
  descentStart: 140,
  /** shoulderвЂ“hipвЂ“ankle must stay above this (no sagging / piking) */
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

export interface Landmark {
  x: number;
  y: number;
  visibility?: number;
}

export interface PushupFrame {
  visible: boolean;
  side: Side | null;
  plank: boolean;
  elbow: number | null;
  bodyLine: number | null;
  /** pixel points of the tracked side, for the debug overlay */
  points: Pt[] | null;
}

const EMPTY: PushupFrame = { visible: false, side: null, plank: false, elbow: null, bodyLine: null, points: null };

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
  return {
    visible: bestVis >= PUSHUP_RULES.minVisibility,
    side: best,
    plank: dx > dy * PUSHUP_RULES.plankRatio,
    elbow: angle(sh, el, wr),
    bodyLine: angle(sh, hip, ank),
    points: [sh, el, wr, hip, ank],
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

export type RepHint = 'lower' | 'back' | 'fast' | 'lost' | 'plank';

/** Summary of one counted rep вЂ” will be sent to the server for checks in stage 2. */
export interface RepRecord {
  tMs: number;
  durationMs: number;
  minElbow: number;
  minBodyLine: number;
}

export interface RepUpdate {
  counted: boolean;
  hint: RepHint | null;
}

export class PushupCounter {
  reps = 0;
  readonly log: RepRecord[] = [];
  private phase: 'up' | 'down' = 'up';
  private smooth: number | null = null;
  private repStart: number | null = null;
  /** last moment the arms were straight вЂ” the true start of the next rep */
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
