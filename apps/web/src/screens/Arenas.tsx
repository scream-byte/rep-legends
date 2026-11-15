import { useEffect, type ReactNode } from 'react';
import { sfx } from '../audio/sfx';
import { ARENAS, type ExerciseId } from '../exercises';
import type { Dict } from '../i18n';
import { keys, load } from '../storage';
import { haptic, showBackButton } from '../telegram/tg';
import { BoltIcon, DumbbellIcon, HeartIcon, ShieldIcon } from '../ui/icons';
import { MenuBackdrop } from '../ui/MenuBackdrop';

interface Props {
  t: Dict;
  onPick: (exercise: ExerciseId) => void;
  onBack: () => void;
}

const STAT_ICON: Record<string, ReactNode> = {
  attack: <BoltIcon size={44} />,
  strength: <DumbbellIcon size={44} />,
  endurance: <HeartIcon size={44} />,
  defense: <ShieldIcon size={44} />,
};

/** Arena picker: one arena per exercise, each trains its own hero stat. */
export function Arenas({ t, onPick, onBack }: Props) {
  useEffect(() => showBackButton(onBack), [onBack]);
  const A = t.arenasScreen;

  return (
    <div className="app arenas-screen">
      <MenuBackdrop />
      <header className="arenas-head">
        <button
          className="arenas-back"
          aria-label={A.back}
          onClick={() => {
            sfx.click();
            onBack();
          }}
        >
          ‹
        </button>
        <div>
          <h1 className="outlined">{A.title}</h1>
          <p>{A.subtitle}</p>
        </div>
      </header>

      <ul className="arena-list">
        {ARENAS.map((a) => {
          // pull-up records are kept per difficulty: show the best of them
          const ids = a.id === 'pullup' ? ['pullup.easy', 'pullup.medium', 'pullup.hard'] : [a.id];
          const best = Math.max(0, ...ids.map((id) => Number(load(keys.best(id)) ?? 0) || 0));
          return (
            <li key={a.id}>
              <button
                className={`arena-card arena-${a.id} ${a.playable ? '' : 'locked'}`}
                disabled={!a.playable}
                onClick={() => {
                  if (!a.playable) return;
                  sfx.go();
                  haptic('medium');
                  onPick(a.id as ExerciseId);
                }}
              >
                <span className="arena-icon">{STAT_ICON[a.stat]}</span>
                <span className="arena-text">
                  <b className="outlined">{t.exercises[a.id].name}</b>
                  <small>{A.trains(t.statsPanel[a.stat])}</small>
                </span>
                {a.playable ? (
                  <span className="arena-best">
                    <small>{A.best}</small>
                    <b className="outlined">{best}</b>
                  </span>
                ) : (
                  <span className="arena-lock">🔒 {A.locked}</span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
