import { useState } from 'react';
import { detectLang, getDict, type Lang } from './i18n';
import { getPlatform, getTgVersion, getUser, haptic, insideTelegram } from './telegram/tg';

export function App() {
  const [lang, setLang] = useState<Lang>(detectLang);
  const [pressed, setPressed] = useState(false);
  const t = getDict(lang);
  const name = getUser()?.first_name ?? t.guest;

  function onPlay() {
    haptic('heavy');
    setPressed(true);
  }

  return (
    <main className="screen">
      <div className="halftone" aria-hidden />

      <header className="title-panel">
        <h1 className="logo">
          <span>REP</span>
          <span>LEGENDS</span>
        </h1>
        <p className="tagline">{t.tagline}</p>
      </header>

      <section className="speech">
        <p className="hello">{t.hello(name)}</p>
        <p>{t.stageNote}</p>
      </section>

      <button className="cta" onClick={onPlay}>
        {pressed ? t.comingSoon : t.play}
      </button>

      <button className="lang" onClick={() => setLang(lang === 'ru' ? 'en' : 'ru')}>
        {t.switchLang}
      </button>

      {!insideTelegram && <p className="warn">{t.notInTelegram}</p>}

      <details className="info">
        <summary>{t.info}</summary>
        <ul>
          <li>
            {t.language}: {lang}
          </li>
          <li>
            {t.platform}: {getPlatform()}
          </li>
          <li>
            {t.version}: {getTgVersion()}
          </li>
        </ul>
      </details>
    </main>
  );
}
