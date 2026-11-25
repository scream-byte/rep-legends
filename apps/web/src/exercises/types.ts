// Shared contract for every exercise (push-ups, pull-ups, later squats and abs).
// The workout screen only talks to this interface, so adding an exercise means
// writing one new file in src/exercises/ and registering it in index.ts.

import type { Pt } from '../pose/geometry.ts';

export type ExerciseId = 'pushup' | 'pullup' | 'squat' | 'abs';

/** Every exercise that will exist (all four are built now). */
export type ArenaId = ExerciseId;

export interface Landmark {
  x: number;
  y: number;
  visibility?: number;
}

/** What every exercise's per-frame measurement must provide. */
export interface BaseFrame {
  /** all key points are confidently visible */
  visible: boolean;
  /** pixel points to highlight in the debug overlay */
  points: Pt[] | null;
  /** pairs of indexes into `points` to connect with lines in the debug overlay */
  lines: Array<[number, number]>;
  /** one short line of numbers for the debug panel */
  debug: string;
}

/** Summary of one counted rep — will be sent to the server for checks later. */
export interface RepRecord {
  tMs: number;
  durationMs: number;
  [metric: string]: number;
}

export interface RepUpdate {
  counted: boolean;
  /** key of a hint to show (looked up in the exercise's i18n `hints`), e.g. 'lower'.
   *  May also come with counted=true (e.g. "kipping: half a point"). */
  hint: string | null;
}

/** How many reps of each kind made up the score (for the result screen). */
export interface Breakdown {
  clean: number;
  kipping: number;
  band: number;
}

export interface Counter<F extends BaseFrame> {
  /** the score: usually whole reps, but can be fractional (0.5 for kipping on medium) */
  reps: number;
  readonly log: RepRecord[];
  /** optional per-kind counts shown on the result screen */
  readonly breakdown?: Breakdown;
  update(f: F, t: number): RepUpdate;
}

/** 3D landmarks in metres around the hips (MediaPipe `worldLandmarks`), used for depth. */
export interface WorldLandmark {
  x: number;
  y: number;
  z: number;
}

export interface ExerciseDef<F extends BaseFrame = BaseFrame> {
  id: ExerciseId;
  measure(lms: Landmark[] | undefined, width: number, height: number, world?: WorldLandmark[]): F;
  /** what the player must fix before starting; 'hold' means "ready" */
  calibrationHint(f: F): string;
  createCounter(): Counter<F>;
  /** how long the start pose must be held, ms */
  holdMs: number;
  /** 3-2-1 countdown length in seconds; 0 = start the moment the pose is held */
  countdown: number;
  /** if set: the set ends automatically after `autoFinishMs` out of position (e.g. off the bar) */
  inPosition?: (f: F) => boolean;
  autoFinishMs?: number;
}
