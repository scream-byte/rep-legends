import type { ReactNode } from 'react';
import { sfx } from '../audio/sfx';
import type { Dict } from '../i18n';
import { statLevel, statXp, type Progress, type StatKey } from '../progress/progress';
import type { SyncState } from '../progress/store';
import { BoltIcon, DumbbellIcon, HeartIcon, ShieldIcon } from './icons';

interface Props {
  t: Dict;
  progress: Progress;
  sync: SyncState;
  onClose: () => void;
}

/** Stats that already have an arena (the others show "soon"). */
const ACTIVE: StatKey[] = ['attack', 'strength', 'endurance', 'defense'];

/** The hero's four stats: level, XP bar, and which exercise trains each. */
export function StatsModal({ t, progress, sync, onClose }: Props) {
  const S = t.statsPanel;
  const rows: Array<{ key: StatKey; icon: ReactNode; name: string; from: string }> = [
    { key: 'attack', icon: <BoltIcon size={38} />, name: S.attack, from: S.attackFrom },
    { key: 'strength', icon: <DumbbellIcon size={38} />, name: S.strength, from: S.strengthFrom },
    { key: 'endurance', icon: <HeartIcon size={38} />, name: S.endurance, from: S.enduranceFrom },
    { key: 'defense', icon: <ShieldIcon size={38} />, name: S.defense, from: S.defenseFrom },
  ];

  const close = () => {
    sfx.click();
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={close}>
      <div className="modal stats-modal" onClick={(e) => e.stopPropagation()}>
        <h2 className="outlined">{S.title}</h2>
        <ul className="stat-list">
          {rows.map((r) => {
            const active = ACTIVE.includes(r.key);
            const L = statLevel(statXp(progress, r.key));
            return (
              <li key={r.key} className={`stat-row stat-${r.key} ${active ? '' : 'stat-soon'}`}>
                <span className="stat-icon">{r.icon}</span>
                <span className="stat-text">
                  <b>{r.name}</b>
                  <small>{r.from}</small>
                  {active ? (
                    <span className="stat-bar" aria-label={`${L.into} / ${L.need} XP`}>
                      <span className="stat-bar-fill" style={{ width: `${L.percent}%` }} />
                      <span className="stat-bar-text">{S.toNext(Math.round((L.need - L.into) * 10) / 10, L.level + 1)}</span>
                    </span>
                  ) : (
                    <small className="stat-soon-label">🔒 {t.comingSoon}</small>
                  )}
                </span>
                <span className="stat-value-box">
                  <small>{S.lvl}</small>
                  <b className="stat-value outlined">{L.level}</b>
                </span>
              </li>
            );
          })}
        </ul>
        <p className="set-note">{S.note}</p>
        <p className={`sync-note sync-${sync}`}>{S.sync[sync]}</p>
        <button className="btn3d close" onClick={close}>
          {t.close}
        </button>
      </div>
    </div>
  );
}
