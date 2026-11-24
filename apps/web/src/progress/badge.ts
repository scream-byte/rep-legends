// Which colour tier and how many ornaments the player's level badge shows.
// Pure logic (tested in badge.test.ts); drawing lives in ui/LevelBadge.tsx.
//   * milestones (user's choice 2026-11-24): 10, 25, 50, 75, 100 → 6 colour tiers
//   * inside a tier every level adds one ornament (0 at the tier's first level),
//     up to ORNAMENT_COUNT; ornaments start over at the next milestone.

/** First level of each tier: steel, teal, blue, purple, red, gold. */
export const BADGE_TIERS = [1, 10, 25, 50, 75, 100] as const;
/** Ornaments available per tier (the longest tiers have 25 levels: 0…24 ornaments). */
export const ORNAMENT_COUNT = 24;

export function badgeStage(level: number): { tier: number; ornaments: number } {
  const lvl = Number.isFinite(level) ? Math.max(1, Math.floor(level)) : 1;
  let tier = 0;
  for (let i = 0; i < BADGE_TIERS.length; i++) if (lvl >= BADGE_TIERS[i]) tier = i;
  return { tier, ornaments: Math.min(ORNAMENT_COUNT, lvl - BADGE_TIERS[tier]) };
}
