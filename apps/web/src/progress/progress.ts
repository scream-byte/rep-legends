// Player progress: stat XP, levels, personal records — pure logic, no browser APIs
// (so it can be unit-tested with Node). Storage lives in ./store.ts.
//
// Safety rules for saves:
//   * every device keeps its OWN counters (XP, totals) and the real value is the
//     SUM over devices. Merging two copies takes, per device, the max of each
//     counter. So XP earned on two phones is never lost, and an old / partial /
//     corrupted copy can never lower good data ("grow-only counter");
//   * personal records merge by max;
//   * everything read from storage goes through `sanitize` (bad values → 0);
//   * a version number allows future migrations.

export const PROGRESS_VERSION = 1;

export type StatKey = 'attack' | 'strength' | 'endurance' | 'defense';
export const STAT_KEYS: StatKey[] = ['attack', 'strength', 'endurance', 'defense'];

/** What one device has earned. Only ever grows. */
export interface Counters {
  xp: Record<StatKey, number>;
  pushupReps: number;
  pullupPoints: number;
  sets: number;
}

export interface Progress {
  v: number;
  /** per-device counters, keyed by a random device id */
  dev: Record<string, Counters>;
  /** personal records: 'pushup', 'pullup.easy', 'pullup.medium', 'pullup.hard', … */
  records: Record<string, number>;
  /** last change, ms since epoch (informational) */
  updatedAt: number;
}

export const emptyCounters = (): Counters => ({
  xp: { attack: 0, strength: 0, endurance: 0, defense: 0 },
  pushupReps: 0,
  pullupPoints: 0,
  sets: 0,
});

export function emptyProgress(): Progress {
  return { v: PROGRESS_VERSION, dev: {}, records: {}, updatedAt: 0 };
}

/** A safe, non-negative, finite number (anything else becomes 0). Keeps one decimal. */
const num = (x: unknown): number => {
  const n = typeof x === 'number' ? x : typeof x === 'string' ? Number(x) : NaN;
  return Number.isFinite(n) && n > 0 ? Math.round(n * 10) / 10 : 0;
};
const r1 = (n: number) => Math.round(n * 10) / 10;

const RECORD_KEY = /^[a-z]+(\.[a-z]+)?$/;
export const DEVICE_ID = /^[a-z0-9]{6,24}$/;

function sanitizeCounters(raw: unknown): Counters {
  const c = emptyCounters();
  if (!raw || typeof raw !== 'object') return c;
  const r = raw as Record<string, unknown>;
  const xp = (r.xp && typeof r.xp === 'object' ? r.xp : {}) as Record<string, unknown>;
  for (const k of STAT_KEYS) c.xp[k] = num(xp[k]);
  c.pushupReps = num(r.pushupReps);
  c.pullupPoints = num(r.pullupPoints);
  c.sets = num(r.sets);
  return c;
}

/** Turns anything (parsed JSON, garbage, null) into a valid Progress. Never throws. */
export function sanitize(raw: unknown): Progress {
  const p = emptyProgress();
  if (!raw || typeof raw !== 'object') return p;
  const r = raw as Record<string, unknown>;
  if (r.dev && typeof r.dev === 'object') {
    for (const [id, c] of Object.entries(r.dev as Record<string, unknown>)) if (DEVICE_ID.test(id)) p.dev[id] = sanitizeCounters(c);
  }
  if (r.records && typeof r.records === 'object') {
    for (const [k, val] of Object.entries(r.records as Record<string, unknown>)) if (RECORD_KEY.test(k) && num(val) > 0) p.records[k] = num(val);
  }
  p.updatedAt = num(r.updatedAt);
  return p;
}

function mergeCounters(a: Counters, b: Counters): Counters {
  const c = emptyCounters();
  for (const k of STAT_KEYS) c.xp[k] = Math.max(a.xp[k], b.xp[k]);
  c.pushupReps = Math.max(a.pushupReps, b.pushupReps);
  c.pullupPoints = Math.max(a.pullupPoints, b.pullupPoints);
  c.sets = Math.max(a.sets, b.sets);
  return c;
}

/** Combines two copies so that nothing is ever lost (see the header comment). */
export function merge(a: Progress, b: Progress): Progress {
  const out = emptyProgress();
  for (const id of new Set([...Object.keys(a.dev), ...Object.keys(b.dev)])) {
    out.dev[id] = mergeCounters(a.dev[id] ?? emptyCounters(), b.dev[id] ?? emptyCounters());
  }
  for (const k of new Set([...Object.keys(a.records), ...Object.keys(b.records)])) {
    out.records[k] = Math.max(a.records[k] ?? 0, b.records[k] ?? 0);
  }
  out.updatedAt = Math.max(a.updatedAt, b.updatedAt);
  return out;
}

/** True if the two copies hold different data (ignoring the timestamp). */
export function differs(a: Progress, b: Progress): boolean {
  const norm = (p: Progress) => {
    const sorted = (o: Record<string, unknown>) => Object.fromEntries(Object.entries(o).sort(([x], [y]) => x.localeCompare(y)));
    return JSON.stringify({ dev: sorted(p.dev), records: sorted(p.records) });
  };
  return norm(a) !== norm(b);
}

/** The real totals: the sum over all devices. */
export function totals(p: Progress): Counters {
  const t = emptyCounters();
  for (const c of Object.values(p.dev)) {
    for (const k of STAT_KEYS) t.xp[k] = r1(t.xp[k] + c.xp[k]);
    t.pushupReps = r1(t.pushupReps + c.pushupReps);
    t.pullupPoints = r1(t.pullupPoints + c.pullupPoints);
    t.sets += c.sets;
  }
  return t;
}

// ---------- levels ----------

/** XP needed to go from stat level L to L+1: 10, 15, 20, 25, … (user's choice 2026-11-15) */
export const statXpToNext = (level: number) => 10 + 5 * (level - 1);
/** XP needed to go from hero level L to L+1: 25, 35, 45, … (sum of all stats) */
export const heroXpToNext = (level: number) => 25 + 10 * (level - 1);

export interface LevelInfo {
  level: number;
  /** XP collected inside the current level */
  into: number;
  /** XP the current level needs in total */
  need: number;
  /** 0..100 */
  percent: number;
}

function levelFrom(xp: number, toNext: (l: number) => number): LevelInfo {
  let level = 1;
  let rest = Math.max(0, xp);
  while (rest >= toNext(level) && level < 999) {
    rest -= toNext(level);
    level += 1;
  }
  const need = toNext(level);
  return { level, into: r1(rest), need, percent: Math.min(100, Math.floor((rest / need) * 100)) };
}

export const statLevel = (xp: number) => levelFrom(xp, statXpToNext);
export const statXp = (p: Progress, k: StatKey) => totals(p).xp[k];
export const totalXp = (p: Progress) => {
  const t = totals(p);
  return r1(STAT_KEYS.reduce((s, k) => s + t.xp[k], 0));
};
export const heroLevel = (p: Progress) => levelFrom(totalXp(p), heroXpToNext);

// ---------- earning XP ----------

/** Which stat each arena trains, and how much XP one rep / point is worth. */
export const XP_RULES = {
  pushup: { stat: 'attack' as StatKey, perRep: 1 },
  pullup: { stat: 'strength' as StatKey, perPoint: { easy: 2, medium: 3, hard: 4 } },
};

export interface SetInput {
  exercise: 'pushup' | 'pullup';
  /** pull-up difficulty (ignored for push-ups) */
  difficulty?: 'easy' | 'medium' | 'hard';
  /** reps / points scored in the set (may be fractional) */
  score: number;
  /** key under which the personal record is kept, e.g. 'pullup.hard' */
  recordKey: string;
  now?: number;
}

export interface SetOutcome {
  progress: Progress;
  stat: StatKey;
  xpGained: number;
  newRecord: boolean;
  previousRecord: number;
  statLevelBefore: number;
  statLevelAfter: number;
  heroLevelBefore: number;
  heroLevelAfter: number;
}

export function xpForSet(input: SetInput): { stat: StatKey; xp: number } {
  const score = num(input.score);
  if (input.exercise === 'pushup') return { stat: XP_RULES.pushup.stat, xp: r1(score * XP_RULES.pushup.perRep) };
  const per = XP_RULES.pullup.perPoint[input.difficulty ?? 'medium'];
  return { stat: XP_RULES.pullup.stat, xp: r1(score * per) };
}

/** Adds a finished set (earned on `deviceId`). Returns a NEW object; the input is untouched. */
export function applySet(p: Progress, input: SetInput, deviceId: string): SetOutcome {
  const score = num(input.score);
  const { stat, xp } = xpForSet(input);
  const next = merge(p, emptyProgress()); // deep copy
  const statBefore = statLevel(statXp(p, stat)).level;
  const heroBefore = heroLevel(p).level;

  const c = next.dev[deviceId] ?? emptyCounters();
  c.xp[stat] = r1(c.xp[stat] + xp);
  if (input.exercise === 'pushup') c.pushupReps = r1(c.pushupReps + score);
  else c.pullupPoints = r1(c.pullupPoints + score);
  if (score > 0) c.sets += 1;
  next.dev[deviceId] = c;

  const previousRecord = p.records[input.recordKey] ?? 0;
  const newRecord = score > previousRecord;
  if (newRecord) next.records[input.recordKey] = score;
  next.updatedAt = input.now ?? Date.now();

  return {
    progress: next,
    stat,
    xpGained: xp,
    newRecord,
    previousRecord,
    statLevelBefore: statBefore,
    statLevelAfter: statLevel(statXp(next, stat)).level,
    heroLevelBefore: heroBefore,
    heroLevelAfter: heroLevel(next).level,
  };
}

/** A random device id like "k3x9q2m7a1". */
export function newDeviceId(random: () => number = Math.random): string {
  const abc = 'abcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from({ length: 12 }, () => abc[Math.floor(random() * abc.length)]).join('');
}

// ---------- migration from the old per-key records ----------

/** Fixed pseudo-device that holds the one-time XP credit for old records. */
export const LEGACY_DEVICE = 'legacybonus';

/**
 * Before progress existed, records were stored as separate keys:
 *   best.pushup, best.pullup (before difficulties = medium rules), best.pullup.easy|medium|hard
 * Returns them as a Progress so it can be merged in:
 *   * the records themselves;
 *   * a one-time XP credit for those sets (they were really done, but XP didn't exist yet),
 *     stored under the fixed LEGACY_DEVICE id — merging uses max per device, so the credit
 *     is never added twice (restarts, other phones, cloud syncs).
 */
export function fromLegacyRecords(get: (key: string) => string | null): Progress {
  const p = emptyProgress();
  const take = (from: string, to: string) => {
    const v = num(get(from));
    if (v > 0) p.records[to] = Math.max(p.records[to] ?? 0, v);
  };
  take('best.pushup', 'pushup');
  take('best.pullup', 'pullup.medium'); // the old pull-up record used today's "medium" rules
  take('best.pullup.easy', 'pullup.easy');
  take('best.pullup.medium', 'pullup.medium');
  take('best.pullup.hard', 'pullup.hard');

  const r = p.records;
  if (Object.keys(r).length > 0) {
    const c = emptyCounters();
    const push = r.pushup ?? 0;
    const pulls = { easy: r['pullup.easy'] ?? 0, medium: r['pullup.medium'] ?? 0, hard: r['pullup.hard'] ?? 0 };
    c.xp.attack = r1(push * XP_RULES.pushup.perRep);
    c.xp.strength = r1(
      pulls.easy * XP_RULES.pullup.perPoint.easy + pulls.medium * XP_RULES.pullup.perPoint.medium + pulls.hard * XP_RULES.pullup.perPoint.hard,
    );
    c.pushupReps = push;
    c.pullupPoints = r1(pulls.easy + pulls.medium + pulls.hard);
    c.sets = Object.keys(r).length;
    p.dev[LEGACY_DEVICE] = c;
  }
  return p;
}
