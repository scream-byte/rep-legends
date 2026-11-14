import { useEffect, useState } from 'react';
import { detectLang, getDict, type Lang } from './i18n';
import { getPlatform, getTgVersion, getUser, haptic, insideTelegram } from './telegram/tg';
import { Hero } from './ui/Hero';
import {
  BoltIcon,
  DumbbellIcon,
  GearIcon,
  HeartIcon,
  HelmetIcon,
  HomeIcon,
  ScrollIcon,
  ShieldIcon,
  SwordsIcon,
  TrophyIcon,
} from './ui/icons';

// Placeholder hero progress until real data arrives in stage 4.
const HERO = { level: 1, xpPercent: 0, rank: 'E', attack: 1, strength: 1, endurance: 1, defense: 1 };

export function App() {
  const [lang, setLang] = useState<Lang>(detectLang);
  const [toast, setToast] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const t = getDict(lang);
  const name = getUser()?.first_name ?? t.guest;

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 1400);
    return () => clearTimeout(id);
  }, [toast]);

  function soon() {
    haptic('light');
    setToast(t.comingSoon);
  }

  const stats = [
    { key: 'attack', icon: <BoltIcon size={26} />, label: t.stats.attack, value: HERO.attack },
    { key: 'strength', icon: <DumbbellIcon size={26} />, label: t.stats.strength, value: HERO.strength },
    { key: 'endurance', icon: <HeartIcon size={26} />, label: t.stats.endurance, value: HERO.endurance },
    { key: 'defense', icon: <ShieldIcon size={26} />, label: t.stats.defense, value: HERO.defense },
  ];

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
          <div className="level-badge outlined">{HERO.level}</div>
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

      {/* Hero stats */}
      <section className="stats">
        {stats.map((s) => (
          <div key={s.key} className="stat">
            {s.icon}
            <div>
              <small>{s.label}</small>
              <b>{s.value}</b>
            </div>
          </div>
        ))}
      </section>

      {/* Stage: side buttons + hero */}
      <section className="stage">
        <button className="side-btn left" onClick={soon}>
          <TrophyIcon size={44} />
          <span className="outlined">{t.ranking}</span>
        </button>
        <button className="side-btn right" onClick={() => setSettingsOpen(true)}>
          <GearIcon size={44} />
          <span className="outlined">{t.settings}</span>
        </button>

        <div className="bubble">
          <b>{t.hello(name)}</b>
          <span>{t.readyLine}</span>
        </div>
        <Hero className="hero" />
      </section>

      {!insideTelegram && <p className="warn">{t.notInTelegram}</p>}

      {/* Main actions */}
      <section className="actions">
        <button
          className="btn3d play"
          onClick={() => {
            haptic('heavy');
            setToast(t.comingSoon);
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
        <div className="modal-backdrop" onClick={() => setSettingsOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2 className="outlined">{t.settings}</h2>
            <p className="modal-label">{t.language}</p>
            <div className="segmented">
              {(['ru', 'en'] as const).map((l) => (
                <button key={l} className={lang === l ? 'on' : ''} onClick={() => setLang(l)}>
                  {l === 'ru' ? 'Русский' : 'English'}
                </button>
              ))}
            </div>
            <details className="info">
              <summary>{t.info}</summary>
              <ul>
                <li>
                  {t.platform}: {getPlatform()}
                </li>
                <li>
                  {t.version}: {getTgVersion()}
                </li>
              </ul>
            </details>
            <button className="btn3d close" onClick={() => setSettingsOpen(false)}>
              {t.close}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
