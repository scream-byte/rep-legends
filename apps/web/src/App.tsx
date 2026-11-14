import { useEffect, useState } from 'react';
import { detectLang, getDict, type Lang } from './i18n';
import { getPlatform, getTgVersion, getUser, haptic, insideTelegram } from './telegram/tg';
import { Backdrop } from './ui/Backdrop';
import { Hero } from './ui/Hero';
import {
  BoltIcon,
  ChevronsIcon,
  DumbbellIcon,
  FriendsIcon,
  GearIcon,
  HeartIcon,
  HelmetIcon,
  HexBadge,
  HomeIcon,
  MapIcon,
  ScrollIcon,
  ShieldIcon,
  TicketIcon,
  TrophyIcon,
  Wing,
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

  function soon(style: 'light' | 'heavy' = 'light') {
    haptic(style);
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
    { key: 'arenas', icon: <TicketIcon size={34} />, label: t.nav.arenas },
    { key: 'home', icon: <HomeIcon size={34} />, label: t.nav.home, active: true },
    { key: 'tasks', icon: <ScrollIcon size={34} />, label: t.nav.tasks },
    { key: 'ranking', icon: <TrophyIcon size={34} />, label: t.nav.ranking },
  ];

  return (
    <div className="app">
      <Backdrop />

      {/* Top bar: power level + XP, rank with wings */}
      <header className="topbar">
        <div className="level">
          <HexBadge text={HERO.level} size={54} />
          <div className="level-right">
            <span className="level-label outlined">{t.powerLevel}</span>
            <div className="xp-bar">
              <div className="xp-fill" style={{ width: `${HERO.xpPercent}%` }} />
              <span className="outlined">{HERO.xpPercent}%</span>
            </div>
          </div>
        </div>
        <div className="rank">
          <Wing />
          <div className="rank-pill">
            <span className="outlined">{t.rank}</span>
            <HexBadge text={HERO.rank} size={30} />
          </div>
          <Wing flip />
        </div>
      </header>

      {/* Hero stats */}
      <section className="stats">
        {stats.map((s) => (
          <div key={s.key} className={`stat stat-${s.key}`}>
            <div className="stat-top">
              {s.icon}
              <b className="outlined">{s.value}</b>
            </div>
            <small className="outlined">{s.label}</small>
          </div>
        ))}
      </section>

      {/* Stage: glowing side buttons around the greeting, hero fills the rest */}
      <section className="stage">
        <button className="side-btn" onClick={() => soon()}>
          <FriendsIcon size={44} />
          <span className="outlined">{t.friends}</span>
        </button>
        <div className="bubble">
          <b>{t.hello(name)}</b>
          <span>{t.readyLine}</span>
        </div>
        <button className="side-btn" onClick={() => setSettingsOpen(true)}>
          <GearIcon size={44} />
          <span className="outlined">{t.settings}</span>
        </button>

        <div className="hero-box">
          <Hero className="hero" />
        </div>
      </section>

      {!insideTelegram && <p className="warn">{t.notInTelegram}</p>}

      {/* Main actions */}
      <section className="actions">
        <button className="play" onClick={() => soon('heavy')}>
          <span className="outlined">{t.play}</span>
          <ChevronsIcon size={30} />
        </button>
        <button className="tile" onClick={() => soon()}>
          <MapIcon size={50} />
          <span className="outlined">{t.arenas}</span>
        </button>
      </section>

      {/* Bottom navigation */}
      <nav className="bottom-nav">
        {nav.map((n) => (
          <button key={n.key} className={n.active ? 'active' : ''} onClick={n.active ? undefined : () => soon()}>
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
            <button className="close" onClick={() => setSettingsOpen(false)}>
              {t.close}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
