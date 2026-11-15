import { useEffect, useState } from 'react';
import { sfx } from '../audio/sfx';
import type { PullupDifficulty, PullupOptions } from '../exercises';
import type { Dict } from '../i18n';
import { keys, load, save } from '../storage';
import { haptic, showBackButton } from '../telegram/tg';
import { MenuBackdrop } from '../ui/MenuBackdrop';

interface Props {
  t: Dict;
  onStart: (opts: PullupOptions) => void;
  onBack: () => void;
}

const LEVELS: PullupDifficulty[] = ['easy', 'medium', 'hard'];

function loadOptions(): PullupOptions {
  try {
    const o = JSON.parse(load(keys.pullupOptions) ?? '{}') as Partial<PullupOptions>;
    return { difficulty: o.difficulty && LEVELS.includes(o.difficulty) ? o.difficulty : 'medium', band: !!o.band };
  } catch {
    return { difficulty: 'medium', band: false };
  }
}

/** Pull-up arena: pick a difficulty (with descriptions) and say if you use a band. */
export function PullupDifficultyScreen({ t, onStart, onBack }: Props) {
  useEffect(() => showBackButton(onBack), [onBack]);
  const D = t.pullupDifficulty;
  const [opts, setOpts] = useState<PullupOptions>(loadOptions);
  // On "hard" a band is never allowed, so the toggle is off and disabled.
  const band = opts.difficulty === 'hard' ? false : opts.band;

  function start() {
    const final = { ...opts, band };
    save(keys.pullupOptions, JSON.stringify(final));
    sfx.go();
    haptic('medium');
    onStart(final);
  }

  return (
    <div className="app arenas-screen difficulty-screen">
      <MenuBackdrop />
      <header className="arenas-head">
        <button
          className="arenas-back"
          aria-label={t.arenasScreen.back}
          onClick={() => {
            sfx.click();
            onBack();
          }}
        >
          ‹
        </button>
        <div>
          <h1 className="outlined">{t.exercises.pullup.name}</h1>
          <p>{D.subtitle}</p>
        </div>
      </header>

      <div className="difficulty-scroll">
        <ul className="difficulty-list" role="radiogroup">
          {LEVELS.map((lvl) => {
            const L = D[lvl];
            const on = opts.difficulty === lvl;
            return (
              <li key={lvl}>
                <button
                  className={`difficulty-card diff-${lvl} ${on ? 'on' : ''}`}
                  role="radio"
                  aria-checked={on}
                  onClick={() => {
                    sfx.tick();
                    setOpts((o) => ({ ...o, difficulty: lvl }));
                  }}
                >
                  <span className="diff-head">
                    <span className="diff-stars" aria-hidden>
                      {'★'.repeat(LEVELS.indexOf(lvl) + 1)}
                      <span className="dim">{'☆'.repeat(2 - LEVELS.indexOf(lvl))}</span>
                    </span>
                    <b className="outlined">{L.name}</b>
                    <small>{L.who}</small>
                    <span className="diff-check" aria-hidden>
                      {on ? '✓' : ''}
                    </span>
                  </span>
                  <ul className="diff-rules">
                    {L.rules.map((r) => (
                      <li key={r}>{r}</li>
                    ))}
                  </ul>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Always visible at the bottom: band toggle + Start */}
      <div className="difficulty-go">
        <button
          className="set-row set-toggle band-toggle"
          role="switch"
          aria-checked={band}
          disabled={opts.difficulty === 'hard'}
          onClick={() => {
            sfx.tick();
            setOpts((o) => ({ ...o, band: !o.band }));
          }}
        >
          <span className="set-label">
            🟣 {D.band}
            <small>{opts.difficulty === 'hard' ? D.bandHard : D.bandNote}</small>
          </span>
          <span className={`switch ${band ? 'on' : ''}`}>
            <span />
          </span>
        </button>
        <button className="btn3d primary" onClick={start}>
          {D.start}
        </button>
      </div>
    </div>
  );
}
