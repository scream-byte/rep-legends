// Registry of playable exercises (each one is an arena).
import { pullupExercise } from './pullup.ts';
import { pushupExercise } from './pushup.ts';
import type { ArenaId, BaseFrame, ExerciseDef, ExerciseId } from './types.ts';

export const EXERCISES: Record<ExerciseId, ExerciseDef<BaseFrame>> = {
  pushup: pushupExercise as unknown as ExerciseDef<BaseFrame>,
  pullup: pullupExercise as unknown as ExerciseDef<BaseFrame>,
};

/** Arena order on the arena screen; locked ones are shown as "coming soon". */
export const ARENAS: Array<{ id: ArenaId; stat: 'attack' | 'strength' | 'endurance' | 'defense'; playable: boolean }> = [
  { id: 'pushup', stat: 'attack', playable: true },
  { id: 'pullup', stat: 'strength', playable: true },
  { id: 'squat', stat: 'endurance', playable: false },
  { id: 'abs', stat: 'defense', playable: false },
];

export type { ArenaId, ExerciseId } from './types.ts';
