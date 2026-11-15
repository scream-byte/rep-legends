// Registry of playable exercises (each one is an arena).
import { makePullupExercise, type PullupOptions } from './pullup.ts';
import { pushupExercise } from './pushup.ts';
import type { ArenaId, BaseFrame, ExerciseDef, ExerciseId } from './types.ts';

/** Extra choices made before a set (only pull-ups have them for now). */
export interface ExerciseVariant {
  pullup?: PullupOptions;
}

/** Builds the exercise definition for a set, applying the chosen variant. */
export function getExercise(id: ExerciseId, variant: ExerciseVariant = {}): ExerciseDef<BaseFrame> {
  const def = id === 'pullup' ? makePullupExercise(variant.pullup) : pushupExercise;
  return def as unknown as ExerciseDef<BaseFrame>;
}

/** Storage key suffix for records: pull-up records are kept per difficulty. */
export function recordId(id: ExerciseId, variant: ExerciseVariant = {}): string {
  return id === 'pullup' && variant.pullup ? `pullup.${variant.pullup.difficulty}` : id;
}

/** Arena order on the arena screen; locked ones are shown as "coming soon". */
export const ARENAS: Array<{ id: ArenaId; stat: 'attack' | 'strength' | 'endurance' | 'defense'; playable: boolean }> = [
  { id: 'pushup', stat: 'attack', playable: true },
  { id: 'pullup', stat: 'strength', playable: true },
  { id: 'squat', stat: 'endurance', playable: false },
  { id: 'abs', stat: 'defense', playable: false },
];

export type { ArenaId, ExerciseId } from './types.ts';
export type { PullupDifficulty, PullupOptions } from './pullup.ts';
