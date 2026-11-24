// Tests for the level badge stages (colour tier + ornament count). Run with: npm test
import { badgeStage, ORNAMENT_COUNT } from './badge.ts';

let failed = false;
function check(name: string, ok: boolean, info = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  badge: ${name}${info ? ` — ${info}` : ''}`);
  if (!ok) failed = true;
}
const s = (l: number) => badgeStage(l);

check('level 1: steel, no ornaments', s(1).tier === 0 && s(1).ornaments === 0);
check('level 9: steel, 8 ornaments', s(9).tier === 0 && s(9).ornaments === 8);
check('level 10: NEW colour (teal), ornaments start over', s(10).tier === 1 && s(10).ornaments === 0);
check('level 24: teal, 14 ornaments', s(24).tier === 1 && s(24).ornaments === 14);
check('level 25: blue, reset', s(25).tier === 2 && s(25).ornaments === 0);
check('level 49: blue, all 24 ornaments', s(49).tier === 2 && s(49).ornaments === 24);
check('level 50: purple, reset', s(50).tier === 3 && s(50).ornaments === 0);
check('level 75: red, reset', s(75).tier === 4 && s(75).ornaments === 0);
check('level 100: gold, reset', s(100).tier === 5 && s(100).ornaments === 0);
check('level 500: gold, capped at the maximum', s(500).tier === 5 && s(500).ornaments === ORNAMENT_COUNT);
// every level inside a tier adds exactly one ornament (until the cap)
let everyLevelNew = true;
for (let l = 2; l < 100; l++) {
  const a = s(l - 1);
  const b = s(l);
  const sameTier = a.tier === b.tier;
  if (sameTier && b.ornaments !== Math.min(ORNAMENT_COUNT, a.ornaments + 1)) everyLevelNew = false;
  if (!sameTier && b.ornaments !== 0) everyLevelNew = false;
}
check('each level adds one ornament; each milestone resets them', everyLevelNew);
check('bad input is safe', s(0).tier === 0 && s(-3).ornaments === 0 && s(NaN).tier === 0);

if (failed) process.exitCode = 1;
