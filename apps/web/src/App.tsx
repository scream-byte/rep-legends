import { useCallback, useEffect, useState } from 'react';
import { playMenuMusic, stopMenuMusic } from './audio/music';
import type { ExerciseId, ExerciseVariant, PullupOptions } from './exercises';
import { getDict } from './i18n';
import { Arenas } from './screens/Arenas';
import { Home } from './screens/Home';
import { PullupDifficultyScreen } from './screens/PullupDifficulty';
import { Warmup } from './screens/Warmup';
import { Workout } from './screens/Workout';
import { useSettings } from './settings';
import { keys, load } from './storage';

type Screen = 'home' | 'arenas' | 'pullupDifficulty' | 'warmup' | 'workout';

export function App() {
  const { settings, update, reset } = useSettings();
  const [screen, setScreen] = useState<Screen>('home');
  const [exercise, setExercise] = useState<ExerciseId>('pushup');
  const [variant, setVariant] = useState<ExerciseVariant>({});
  const t = getDict(settings.lang);

  const goHome = useCallback(() => setScreen('home'), []);
  const goArenas = useCallback(() => setScreen('arenas'), []);
  const goWorkout = useCallback(() => setScreen('workout'), []);

  // Menu theme plays everywhere except the workout itself (so the player can focus).
  useEffect(() => {
    if (screen === 'workout') stopMenuMusic();
    else playMenuMusic();
  }, [screen]);

  // The warm-up / health notice is shown before the very first workout.
  const startWorkout = useCallback((id: ExerciseId, v: ExerciseVariant) => {
    setExercise(id);
    setVariant(v);
    setScreen(load(keys.warmupAck) ? 'workout' : 'warmup');
  }, []);

  // Pull-ups first ask for a difficulty; other arenas start right away.
  const pick = useCallback(
    (id: ExerciseId) => (id === 'pullup' ? setScreen('pullupDifficulty') : startWorkout(id, {})),
    [startWorkout],
  );
  const startPullups = useCallback((opts: PullupOptions) => startWorkout('pullup', { pullup: opts }), [startWorkout]);
  // Back from a pull-up set returns to the difficulty screen.
  const backFromWorkout = useCallback(() => setScreen(exercise === 'pullup' ? 'pullupDifficulty' : 'arenas'), [exercise]);

  if (screen === 'arenas') return <Arenas t={t} onPick={pick} onBack={goHome} />;
  if (screen === 'pullupDifficulty') return <PullupDifficultyScreen t={t} onStart={startPullups} onBack={goArenas} />;
  if (screen === 'warmup') return <Warmup t={t} onAccept={goWorkout} onBack={backFromWorkout} />;
  if (screen === 'workout') {
    const key = `${exercise}-${variant.pullup?.difficulty ?? ''}-${variant.pullup?.band ?? ''}`;
    return <Workout key={key} t={t} exercise={exercise} variant={variant} onBack={backFromWorkout} onHome={goHome} />;
  }
  return <Home t={t} settings={settings} update={update} reset={reset} onPlay={goArenas} />;
}
