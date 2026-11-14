import { useCallback, useState } from 'react';
import { detectLang, getDict, type Lang } from './i18n';
import { Home } from './screens/Home';
import { Pushups } from './screens/Pushups';
import { Warmup } from './screens/Warmup';
import { keys, load } from './storage';

type Screen = 'home' | 'warmup' | 'pushups';

export function App() {
  const [lang, setLang] = useState<Lang>(detectLang);
  const [screen, setScreen] = useState<Screen>('home');
  const t = getDict(lang);

  const goHome = useCallback(() => setScreen('home'), []);
  const goPushups = useCallback(() => setScreen('pushups'), []);

  // The warm-up / health notice is shown before the very first workout.
  const play = () => setScreen(load(keys.warmupAck) ? 'pushups' : 'warmup');

  if (screen === 'warmup') return <Warmup t={t} onAccept={goPushups} onBack={goHome} />;
  if (screen === 'pushups') return <Pushups t={t} onExit={goHome} />;
  return <Home t={t} lang={lang} setLang={setLang} onPlay={play} />;
}
