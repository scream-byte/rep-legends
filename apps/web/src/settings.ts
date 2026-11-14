// Player settings: stored in localStorage and applied live
// (audio volumes, vibration, picture brightness, reduced motion).
import { useCallback, useEffect, useState } from 'react';
import { setVolumes } from './audio/engine';
import { detectLang, type Lang } from './i18n';
import { keys, load, save } from './storage';
import { setHapticsEnabled } from './telegram/tg';

export interface Settings {
  lang: Lang;
  /** volumes 0..100 */
  master: number;
  music: number;
  sfx: number;
  /** picture brightness in %, 60..130 (100 = normal) */
  brightness: number;
  vibration: boolean;
  reduceMotion: boolean;
}

export const BRIGHTNESS_MIN = 60;
export const BRIGHTNESS_MAX = 130;

function defaults(): Settings {
  return {
    lang: detectLang(),
    master: 80,
    music: 60,
    sfx: 80,
    brightness: 100,
    vibration: true,
    reduceMotion: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false,
  };
}

function loadSettings(): Settings {
  const base = defaults();
  try {
    const saved = JSON.parse(load(keys.settings) ?? '{}') as Partial<Settings>;
    return { ...base, ...saved };
  } catch {
    return base;
  }
}

/** Pushes settings into the audio engine, haptics and the page styles. */
function apply(s: Settings) {
  setVolumes({ master: s.master, music: s.music, sfx: s.sfx });
  setHapticsEnabled(s.vibration);
  const root = document.documentElement;
  root.lang = s.lang;
  root.classList.toggle('reduce-motion', s.reduceMotion);
  const rootEl = document.getElementById('root');
  // Only add a filter when needed: filters cost GPU time on the camera screen.
  if (rootEl) rootEl.style.filter = s.brightness === 100 ? '' : `brightness(${s.brightness / 100})`;
}

export function useSettings() {
  const [settings, setSettings] = useState<Settings>(loadSettings);

  useEffect(() => {
    apply(settings);
    save(keys.settings, JSON.stringify(settings));
  }, [settings]);

  const update = useCallback((patch: Partial<Settings>) => setSettings((s) => ({ ...s, ...patch })), []);
  const reset = useCallback(() => setSettings({ ...defaults(), lang: settings.lang }), [settings.lang]);

  return { settings, update, reset };
}
