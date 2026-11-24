// Developer preview of every level badge: open the site with ?badges
// (e.g. https://scream-byte.github.io/rep-legends/?badges). Not linked from the game.
import { BADGE_TIERS, LevelBadge } from './LevelBadge';

export function BadgePreview() {
  const levels = Array.from({ length: 124 }, (_, i) => i + 1);
  return (
    <div style={{ minHeight: '100vh', overflow: 'auto', background: '#1f429e', padding: 16, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
      {levels.map((lvl) => (
        <div
          key={lvl}
          style={{
            display: 'grid',
            placeItems: 'center',
            width: 92,
            outline: (BADGE_TIERS as readonly number[]).includes(lvl) ? '2px dashed #ffe55c' : 'none',
          }}
        >
          <LevelBadge level={lvl} label="УР." size={54} />
        </div>
      ))}
    </div>
  );
}
