import type { ReactNode } from 'react';
import { sfx } from '../audio/sfx';
import type { Dict } from '../i18n';
import { BoltIcon, DumbbellIcon, HeartIcon, ShieldIcon } from './icons';

export interface HeroStats {
  attack: number;
  strength: number;
  endurance: number;
  defense: number;
}

interface Props {
  t: Dict;
  stats: HeroStats;
  onClose: () => void;
}

/** The hero's four stats and which exercise trains each of them. */
export function StatsModal({ t, stats, onClose }: Props) {
  const S = t.statsPanel;
  const rows: Array<{ key: keyof HeroStats; icon: ReactNode; name: string; from: string }> = [
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
          {rows.map((r) => (
            <li key={r.key} className={`stat-row stat-${r.key}`}>
              <span className="stat-icon">{r.icon}</span>
              <span className="stat-text">
                <b>{r.name}</b>
                <small>{r.from}</small>
              </span>
              <b className="stat-value outlined">{stats[r.key]}</b>
            </li>
          ))}
        </ul>
        <p className="set-note">{S.note}</p>
        <button className="btn3d close" onClick={close}>
          {t.close}
        </button>
      </div>
    </div>
  );
}
