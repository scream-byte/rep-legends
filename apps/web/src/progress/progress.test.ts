// Tests for progress logic: levels, XP, records, and — most importantly — that
// saves can never lose data (multi-device merge / corruption / legacy migration).
// Run with: npm test
import {
  applySet,
  differs,
  emptyProgress,
  fromLegacyRecords,
  heroLevel,
  merge,
  newDeviceId,
  sanitize,
  statLevel,
  statXp,
  totals,
  DEVICE_ID,
  type Progress,
} from './progress.ts';

let failed = false;
function check(name: string, ok: boolean, info = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  progress: ${name}${info ? ` — ${info}` : ''}`);
  if (!ok) failed = true;
}

const PHONE = 'phoneaaa111';
const TABLET = 'tabletbbb22';

// ---------- levels ----------
check('stat level 1 at 0 XP, 10 XP to level 2', statLevel(0).level === 1 && statLevel(0).need === 10);
check('stat level 2 at 10 XP, then 15 more', statLevel(10).level === 2 && statLevel(10).into === 0 && statLevel(10).need === 15);
check('stat level 3 at 25 XP (10+15), then 20 more', statLevel(25).level === 3 && statLevel(25).need === 20);
check('stat level 4 at 45 XP (10+15+20)', statLevel(45).level === 4);
check('stat level percent', statLevel(5).percent === 50);
const heroAt = (xp: number) => heroLevel(applySet(emptyProgress(), { exercise: 'pushup', score: xp, recordKey: 'pushup' }, 'phoneaaa111').progress);
check('player level is unchanged: 50 XP to level 2, then 75', heroAt(49).level === 1 && heroAt(50).level === 2 && heroAt(124).level === 2 && heroAt(125).level === 3);
check('negative / huge XP is safe', statLevel(-5).level === 1 && statLevel(1e9).level <= 999);

// ---------- XP from sets ----------
let p = emptyProgress();
const s1 = applySet(p, { exercise: 'pushup', score: 25, recordKey: 'pushup', now: 1 }, PHONE);
check('25 push-ups → +25 Attack XP, Attack level 3', s1.xpGained === 25 && s1.stat === 'attack' && s1.statLevelBefore === 1 && s1.statLevelAfter === 3);
check('first set is a new record', s1.newRecord && s1.progress.records.pushup === 25);
check('input progress is not mutated', Object.keys(p.dev).length === 0 && !p.records.pushup);
p = s1.progress;
const s2 = applySet(p, { exercise: 'pullup', difficulty: 'hard', score: 5, recordKey: 'pullup.hard', now: 2 }, PHONE);
check('5 hard pull-ups → +20 Strength XP', s2.xpGained === 20 && s2.stat === 'strength');
const s3 = applySet(s2.progress, { exercise: 'pullup', difficulty: 'medium', score: 7.5, recordKey: 'pullup.medium', now: 3 }, PHONE);
check('7.5 medium points → +22.5 Strength XP, record 7.5', s3.xpGained === 22.5 && s3.progress.records['pullup.medium'] === 7.5);
const s4 = applySet(s3.progress, { exercise: 'pullup', difficulty: 'easy', score: 4, recordKey: 'pullup.easy', now: 4 }, PHONE);
check('easy pull-ups → 2 XP per point', s4.xpGained === 8);
const s5 = applySet(s4.progress, { exercise: 'pushup', score: 10, recordKey: 'pushup', now: 5 }, PHONE);
check('weaker set: no new record, record kept', !s5.newRecord && s5.progress.records.pushup === 25 && s5.previousRecord === 25);
check('XP keeps adding up', statXp(s5.progress, 'attack') === 35 && statXp(s5.progress, 'strength') === 50.5);
const t5 = totals(s5.progress);
check('totals', t5.pushupReps === 35 && t5.pullupPoints === 16.5 && t5.sets === 5);
const s0 = applySet(s5.progress, { exercise: 'pushup', score: 0, recordKey: 'pushup', now: 6 }, PHONE);
check('empty set (0 reps): no XP, not counted as a set', s0.xpGained === 0 && totals(s0.progress).sets === 5 && !s0.newRecord);
check('player level grows from all XP (85.5 XP → level 2)', heroLevel(s5.progress).level === 2);

// ---------- squats (stage 3) ----------
const sq = applySet(s5.progress, { exercise: 'squat', score: 12, recordKey: 'squat', now: 7 }, PHONE);
check('12 squats → +12 Endurance XP, Endurance level 2', sq.stat === 'endurance' && sq.xpGained === 12 && sq.statLevelAfter === 2 && sq.newRecord);
check('squat totals counted separately', totals(sq.progress).squatReps === 12 && totals(sq.progress).pushupReps === 35);
check('an older save without squatReps still loads (reads as 0)', totals(sanitize({ dev: { oldphone11: { xp: { attack: 5 }, pushupReps: 5, sets: 1 } } })).squatReps === 0);

// ---------- saves can never lose data ----------
const phone: Progress = s5.progress;
const oldCloud: Progress = s2.progress; // an older copy of the same device
check('merge with an OLDER copy keeps the newer data', !differs(merge(phone, oldCloud), phone));
check('merge is symmetric', !differs(merge(oldCloud, phone), merge(phone, oldCloud)));
check('merge with itself changes nothing', !differs(merge(phone, phone), phone));
check('merge with empty changes nothing', !differs(merge(phone, emptyProgress()), phone));

// Two devices start from the same synced state and BOTH earn XP offline.
const base = s1.progress; // phone: 25 attack XP, synced to the cloud
const onPhone = applySet(base, { exercise: 'pushup', score: 20, recordKey: 'pushup', now: 10 }, PHONE).progress;
const onTablet = applySet(base, { exercise: 'pushup', score: 30, recordKey: 'pushup', now: 11 }, TABLET).progress;
const synced = merge(onPhone, onTablet);
check('XP earned on two devices is ADDED, nothing lost (25 + 20 + 30)', statXp(synced, 'attack') === 75, `got ${statXp(synced, 'attack')}`);
check('…and merging again (any order, any number of times) stays the same', !differs(merge(synced, onPhone), synced) && !differs(merge(onTablet, synced), synced));
check('best record across devices wins', synced.records.pushup === 30 && synced.records.pushup >= 25);

// The phone's storage gets wiped: it starts as a NEW device, then syncs with the cloud.
const wipedPhone = applySet(emptyProgress(), { exercise: 'pushup', score: 5, recordKey: 'pushup', now: 12 }, 'newphone333').progress;
const restored = merge(wipedPhone, synced);
check('wiped phone + cloud → everything restored and the new set added', statXp(restored, 'attack') === 80 && restored.records.pushup === 30);

// ---------- corrupted data ----------
check('sanitize(null) → empty', !differs(sanitize(null), emptyProgress()));
check('sanitize(garbage string) → empty', !differs(sanitize('{{{oops'), emptyProgress()));
const bad = sanitize({
  dev: { goodphone1: { xp: { attack: 'abc', strength: -5, endurance: Infinity, defense: '12' }, sets: 3 }, 'BAD ID!': { xp: { attack: 999 } } },
  records: { pushup: 'NaN', 'pullup.hard': 3, 'evil key!': 99 },
});
const bc = bad.dev.goodphone1;
check('sanitize fixes bad numbers', bc.xp.attack === 0 && bc.xp.strength === 0 && bc.xp.endurance === 0 && bc.xp.defense === 12 && bc.sets === 3);
check('sanitize drops bad device ids, records and keys', !('BAD ID!' in bad.dev) && bad.records['pullup.hard'] === 3 && !('pushup' in bad.records) && !('evil key!' in bad.records));
check('save → load round trip is lossless', !differs(sanitize(JSON.parse(JSON.stringify(synced))), synced));
check('corrupted copy merged into good one loses nothing', !differs(merge(phone, sanitize('garbage')), phone));
check('JSON of 5 devices fits Telegram CloudStorage (≤ 4096 chars)', (() => {
  let big = synced;
  for (const d of ['dev1aaaaaa', 'dev2bbbbbb', 'dev3cccccc']) big = merge(big, applySet(big, { exercise: 'pullup', difficulty: 'hard', score: 12.5, recordKey: 'pullup.hard' }, d).progress);
  return JSON.stringify(big).length < 4096;
})());

// ---------- device ids ----------
const id1 = newDeviceId();
check('device id format', DEVICE_ID.test(id1) && id1 !== newDeviceId(), id1);

// ---------- legacy records (the "lost" record) ----------
const store: Record<string, string> = { 'best.pushup': '23', 'best.pullup': '12' };
const legacy = fromLegacyRecords((k) => store[k] ?? null);
check('old push-up record is recovered', legacy.records.pushup === 23);
check('old pull-up record (before difficulties) → medium', legacy.records['pullup.medium'] === 12);
store['best.pullup.medium'] = '15';
store['best.pullup.hard'] = '4';
const legacy2 = fromLegacyRecords((k) => store[k] ?? null);
check('newer per-difficulty record wins over the old one', legacy2.records['pullup.medium'] === 15 && legacy2.records['pullup.hard'] === 4);

// ---------- one-time XP credit for old records (user had record 6 but no XP) ----------
const oldOnly = fromLegacyRecords((k) => ({ 'best.pullup.medium': '6' })[k] ?? null);
check('old record 6 medium pull-ups → +18 Strength XP', statXp(oldOnly, 'strength') === 18, `got ${statXp(oldOnly, 'strength')}`);
const credit = fromLegacyRecords((k) => store[k] ?? null); // pushup 23, medium 15, hard 4
check('credit for all old records (23 push-ups; 15×3 + 4×4 strength)', statXp(credit, 'attack') === 23 && statXp(credit, 'strength') === 61);
const onPhone1 = merge(applySet(emptyProgress(), { exercise: 'pushup', score: 10, recordKey: 'pushup' }, PHONE).progress, credit);
const restartedTwice = merge(merge(onPhone1, fromLegacyRecords((k) => store[k] ?? null)), fromLegacyRecords((k) => store[k] ?? null));
check('credit is NOT added again on restarts', statXp(restartedTwice, 'attack') === 33, `got ${statXp(restartedTwice, 'attack')}`);
const secondPhone = merge(fromLegacyRecords((k) => store[k] ?? null), emptyProgress());
check('credit is NOT doubled when another phone syncs the same old records', statXp(merge(restartedTwice, secondPhone), 'attack') === 33);
check('no old records → no credit', Object.keys(fromLegacyRecords(() => null).dev).length === 0);

if (failed) process.exitCode = 1;
