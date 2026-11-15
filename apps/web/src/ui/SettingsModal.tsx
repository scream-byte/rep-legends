import type { ReactNode } from 'react';
import { sfx } from '../audio/sfx';
import type { Dict } from '../i18n';
import { BRIGHTNESS_MAX, BRIGHTNESS_MIN, type Settings } from '../settings';
import { getPlatform, getTgVersion, haptic, setHapticsEnabled } from '../telegram/tg';

interface Props {
  t: Dict;
  settings: Settings;
  update: (patch: Partial<Settings>) => void;
  reset: () => void;
  onClose: () => void;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="set-section">
      <h3>{title}</h3>
      {children}
    </section>
  );
}

function Slider(props: {
  icon: string;
  label: string;
  value: number;
  min?: number;
  max?: number;
  onChange: (v: number) => void;
  onRelease?: () => void;
}) {
  const { icon, label, value, min = 0, max = 100, onChange, onRelease } = props;
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <label className="set-row">
      <span className="set-label">
        <span aria-hidden>{icon}</span> {label}
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={5}
        value={value}
        style={{ '--fill': `${pct}%` } as React.CSSProperties}
        onChange={(e) => onChange(Number(e.target.value))}
        onPointerUp={onRelease}
        onKeyUp={onRelease}
      />
      <b className="set-value">{value}%</b>
    </label>
  );
}

function Toggle({ icon, label, on, onChange }: { icon: string; label: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button className="set-row set-toggle" role="switch" aria-checked={on} onClick={() => onChange(!on)}>
      <span className="set-label">
        <span aria-hidden>{icon}</span> {label}
      </span>
      <span className={`switch ${on ? 'on' : ''}`}>
        <span />
      </span>
    </button>
  );
}

export function SettingsModal({ t, settings: s, update, reset, onClose }: Props) {
  const S = t.settingsPanel;
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal settings" onClick={(e) => e.stopPropagation()}>
        <h2 className="outlined">{t.settings}</h2>

        <Section title={S.language}>
          <div className="segmented">
            {(['ru', 'en'] as const).map((l) => (
              <button
                key={l}
                className={s.lang === l ? 'on' : ''}
                onClick={() => {
                  sfx.tick();
                  update({ lang: l });
                }}
              >
                {l === 'ru' ? 'Русский' : 'English'}
              </button>
            ))}
          </div>
        </Section>

        <Section title={S.sound}>
          <Slider icon="🔊" label={S.master} value={s.master} onChange={(v) => update({ master: v })} onRelease={sfx.tick} />
          <Slider icon="🎵" label={S.music} value={s.music} onChange={(v) => update({ music: v })} />
          <Slider icon="💥" label={S.effects} value={s.sfx} onChange={(v) => update({ sfx: v })} onRelease={sfx.rep} />
          <p className="set-note">{S.silentNote}</p>
        </Section>

        <Section title={S.screen}>
          <Slider
            icon="☀️"
            label={S.brightness}
            value={s.brightness}
            min={BRIGHTNESS_MIN}
            max={BRIGHTNESS_MAX}
            onChange={(v) => update({ brightness: v })}
          />
          <Toggle
            icon="🌀"
            label={S.reduceMotion}
            on={s.reduceMotion}
            onChange={(v) => {
              sfx.tick();
              update({ reduceMotion: v });
            }}
          />
        </Section>

        <Section title={S.other}>
          <Toggle
            icon="📳"
            label={S.vibration}
            on={s.vibration}
            onChange={(v) => {
              update({ vibration: v });
              sfx.tick();
              if (v) {
                setHapticsEnabled(true); // apply now so the confirmation buzz is felt
                haptic('medium');
              }
            }}
          />
          <button
            className="set-reset"
            onClick={() => {
              sfx.click();
              reset();
            }}
          >
            ↺ {S.reset}
          </button>
        </Section>

        <details className="info">
          <summary>{t.info}</summary>
          <ul>
            <li>
              {t.platform}: {getPlatform()}
            </li>
            <li>
              {t.version}: {getTgVersion()}
            </li>
            <li>
              {t.gameVersion}: {__BUILD_TIME__} UTC
            </li>
          </ul>
        </details>

        <button
          className="btn3d close"
          onClick={() => {
            sfx.click();
            onClose();
          }}
        >
          {t.close}
        </button>
      </div>
    </div>
  );
}
