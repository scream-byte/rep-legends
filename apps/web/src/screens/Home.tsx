import { useEffect, useState } from 'react';
import { isUnlocked, subscribeUnlocked } from '../audio/engine';
import { sfx } from '../audio/sfx';
import type { Dict } from '../i18n';
import type { Settings } from '../settings';
import { getUser, haptic, insideTelegram } from '../telegram/tg';
import { SettingsModal } from '../ui/SettingsModal';
import { StatsModal } from '../ui/StatsModal';
import { Hero } from '../ui/Hero';
import { LevelBadge } from '../ui/LevelBadge';
import {
  FriendsIcon,
  GearIcon,
  HelmetIcon,
  HomeIcon,
  ScrollIcon,
  StatsIcon,
  SwordsIcon,
  TrophyIcon,
} from '../ui/icons';

// Placeholder hero progress until real data arrives in stage 4.
const HERO = { level: 1, xpPercent: 0, rank: 'E', attack: 1, strength: 1, endurance: 1, defense: 1 };

interface Props {
  t: Dict;
  settings: Settings;
  update: (patch: Partial<Settings>) => void;
  reset: () => void;
  onPlay: () => void;
}

export function Home({ t, settings, update, reset, onPlay }: Props) {
  const [toast, setToast] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);
  const [soundOn, setSoundOn] = useState(isUnlocked);
  const name = getUser()?.first_name ?? t.guest;

  // Browsers block sound until the first tap: show a hint until audio is allowed.
  useEffect(() => {
    setSoundOn(isUnlocked());
    return subscribeUnlocked(setSoundOn);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 1400);
    return () => clearTimeout(id);
  }, [toast]);

  function soon() {
    sfx.click();
    haptic('light');
    setToast(t.comingSoon);
  }

  function openSettings() {
    sfx.click();
    setSettingsOpen(true);
  }

  function openStats() {
    sfx.click();
    setStatsOpen(true);
  }

  const nav = [
    { key: 'hero', icon: <HelmetIcon size={34} />, label: t.nav.hero },
    { key: 'arenas', icon: <SwordsIcon size={34} />, label: t.nav.arenas },
    { key: 'home', icon: <HomeIcon size={34} />, label: t.nav.home, active: true },
    { key: 'tasks', icon: <ScrollIcon size={34} />, label: t.nav.tasks },
    { key: 'ranking', icon: <TrophyIcon size={34} />, label: t.nav.ranking },
  ];

  return (
    <div className="app">
      <div className="rays" aria-hidden />

      {/* Top bar: level + XP, rank */}
      <header className="topbar">
        <div className="level">
          <LevelBadge level={HERO.level} label={t.levelShort} />
          <div className="xp-bar">
            <div className="xp-fill" style={{ width: `${Math.max(HERO.xpPercent, 4)}%` }} />
            <span className="outlined">{HERO.xpPercent}%</span>
          </div>
        </div>
        <div className="rank-pill">
          <span>{t.rank}</span>
          <b className="outlined">{HERO.rank}</b>
        </div>
      </header>

      {/* Stage: side buttons around the greeting, hero fills the rest */}
      <section className="stage">
        <button className="side-btn" onClick={soon}>
          <FriendsIcon size={40} />
          <span className="outlined">{t.friends}</span>
        </button>
        <div className="bubble">
          <b>{t.hello(name)}</b>
          <span>{t.readyLine}</span>
        </div>
        <button className="side-btn" onClick={openSettings}>
          <GearIcon size={40} />
          <span className="outlined">{t.settings}</span>
        </button>

        <div className="hero-box">
          <Hero className="hero" />
          {/* Hero stats live behind one button so the hero gets more room */}
          <button className="side-btn stats-btn" onClick={openStats}>
            <StatsIcon size={40} />
            <span className="outlined">{t.statsPanel.button}</span>
          </button>
          {!soundOn && (
            // Any tap unlocks audio (handled globally); this button just invites one.
            <button className="sound-hint" aria-label={t.enableSound} title={t.enableSound} onClick={() => haptic('light')}>
              <span aria-hidden>🔊</span>
            </button>
          )}
        </div>
      </section>

      {!insideTelegram && <p className="warn">{t.notInTelegram}</p>}

      {/* Main actions */}
      <section className="actions">
        <button
          className="btn3d play"
          onClick={() => {
            sfx.go();
            haptic('heavy');
            onPlay();
          }}
        >
          {t.play}
        </button>
        <button className="btn3d tile" onClick={soon}>
          <SwordsIcon size={44} />
          <span className="outlined">{t.arenas}</span>
        </button>
      </section>

      {/* Bottom navigation */}
      <nav className="bottom-nav">
        {nav.map((n) => (
          <button key={n.key} className={n.active ? 'active' : ''} onClick={n.active ? undefined : soon}>
            {n.icon}
            <span className="outlined">{n.label}</span>
          </button>
        ))}
      </nav>

      {toast && <div className="toast outlined">{toast}</div>}

      {settingsOpen && (
        <SettingsModal t={t} settings={settings} update={update} reset={reset} onClose={() => setSettingsOpen(false)} />
      )}

      {statsOpen && <StatsModal t={t} stats={HERO} onClose={() => setStatsOpen(false)} />}
    </div>
  );
}
