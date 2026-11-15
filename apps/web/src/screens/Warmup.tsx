import { useEffect } from 'react';
import type { Dict } from '../i18n';
import { keys, save } from '../storage';
import { haptic, showBackButton } from '../telegram/tg';
import { HeartIcon } from '../ui/icons';
import { MenuBackdrop } from '../ui/MenuBackdrop';

interface Props {
  t: Dict;
  onAccept: () => void;
  onBack: () => void;
}

/** Shown once before the first workout: warm-up + health disclaimer. */
export function Warmup({ t, onAccept, onBack }: Props) {
  useEffect(() => showBackButton(onBack), [onBack]);

  function accept() {
    save(keys.warmupAck, new Date().toISOString());
    haptic('medium');
    onAccept();
  }

  return (
    <div className="app panel-screen">
      <MenuBackdrop />
      <div className="panel">
        <div className="panel-icon">
          <HeartIcon size={56} />
        </div>
        <h2 className="outlined">{t.warmup.title}</h2>
        <ul className="panel-list">
          {t.warmup.points.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
        <p className="panel-note">🔒 {t.warmup.privacy}</p>
        <button className="btn3d primary" onClick={accept}>
          {t.warmup.accept}
        </button>
      </div>
    </div>
  );
}
