import { useCallback, useEffect, useState } from 'react';
import { playMenuMusic, stopMenuMusic } from './audio/music';
import type { ExerciseId } from './exercises';
import { getDict } from './i18n';
import { Arenas } from './screens/Arenas';
import { Home } from './screens/Home';
import { Warmup } from './screens/Warmup';
import { Workout } from './screens/Workout';
import { useSettings } from './settings';
import { keys, load } from './storage';

type Screen = 'home' | 'arenas' | 'warmup' | 'workout';

export function App() {
  const { settings, update, reset } = useSettings();
  const [screen, setScreen] = useState<Screen>('home');
  const [exercise, setExercise] = useState<ExerciseId>('pushup');
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
  const pick = useCallback((id: ExerciseId) => {
    setExercise(id);
    setScreen(load(keys.warmupAck) ? 'workout' : 'warmup');
  }, []);

  if (screen === 'arenas') return <Arenas t={t} onPick={pick} onBack={goHome} />;
  if (screen === 'warmup') return <Warmup t={t} onAccept={goWorkout} onBack={goArenas} />;
  if (screen === 'workout') return <Workout key={exercise} t={t} exercise={exercise} onBack={goArenas} onHome={goHome} />;
  return <Home t={t} settings={settings} update={update} reset={reset} onPlay={goArenas} />;
}
