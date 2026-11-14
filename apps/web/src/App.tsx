import { useCallback, useEffect, useState } from 'react';
import { playMenuMusic, stopMenuMusic } from './audio/music';
import { getDict } from './i18n';
import { Home } from './screens/Home';
import { Pushups } from './screens/Pushups';
import { Warmup } from './screens/Warmup';
import { useSettings } from './settings';
import { keys, load } from './storage';

type Screen = 'home' | 'warmup' | 'pushups';

export function App() {
  const { settings, update, reset } = useSettings();
  const [screen, setScreen] = useState<Screen>('home');
  const t = getDict(settings.lang);

  const goHome = useCallback(() => setScreen('home'), []);
  const goPushups = useCallback(() => setScreen('pushups'), []);

  // Menu theme plays everywhere except the workout itself (so the player can focus).
  useEffect(() => {
    if (screen === 'pushups') stopMenuMusic();
    else playMenuMusic();
  }, [screen]);

  // The warm-up / health notice is shown before the very first workout.
  const play = () => setScreen(load(keys.warmupAck) ? 'pushups' : 'warmup');

  if (screen === 'warmup') return <Warmup t={t} onAccept={goPushups} onBack={goHome} />;
  if (screen === 'pushups') return <Pushups t={t} onExit={goHome} />;
  return <Home t={t} settings={settings} update={update} reset={reset} onPlay={play} />;
}
